const { formatVehicle, formatWikiItem, combatHeadline } = require("./combatIntelFormat");

const WIKI_BASE = "https://api.star-citizen.wiki/api";
/** Soft gap between wiki pages in a single paged fetch (keep low — we parallelize slot catalogs). */
const FETCH_GAP_MS = 40;

const blueprintCache = new Map();
const blueprintInflight = new Map();
const slotOptionsInflight = new Map();
const BLUEPRINT_CACHE_VERSION = 3;
const slotOptionsCache = new Map();

const WIKI_ITEM_TYPES = {
  WeaponGun: "WeaponGun",
  Shield: "Shield",
  PowerPlant: "PowerPlant",
  Cooler: "Cooler",
  QuantumDrive: "QuantumDrive",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "StarTracker/1.0" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function classNameToSlug(className) {
  return String(className || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function collectWeaponGunPorts(ports, parentLabel = "") {
  const out = [];
  for (const port of ports || []) {
    const shortParent = parentLabel.replace(/^hardpoint_/, "").replace(/_/g, " ");
    if (port.type === "WeaponGun") {
      const eq = port.equipped_item && typeof port.equipped_item === "object" ? port.equipped_item : null;
      out.push({
        portId: port.name,
        label: shortParent ? `${shortParent} gun` : port.name.replace(/^hardpoint_/, "").replace(/_/g, " "),
        sizeMin: port.sizes?.min ?? null,
        sizeMax: port.sizes?.max ?? null,
        stockClassName: eq?.class_name || null,
        stockName: eq?.name || null,
        stockSlug: eq?.slug || null,
      });
    }
    if (port.ports?.length) {
      out.push(...collectWeaponGunPorts(port.ports, port.name));
    }
  }
  return out;
}

function collectComponentPorts(ports) {
  const out = [];
  for (const port of ports || []) {
    if (port.type && port.type !== "WeaponGun" && WIKI_ITEM_TYPES[port.type]) {
      const eq = port.equipped_item && typeof port.equipped_item === "object" ? port.equipped_item : null;
      out.push({
        portId: port.name,
        label: port.name.replace(/^hardpoint_/i, "").replace(/_/g, " "),
        componentType: port.type,
        sizeMin: port.sizes?.min ?? null,
        sizeMax: port.sizes?.max ?? null,
        stockClassName: eq?.class_name || null,
        stockName: eq?.name || null,
        stockSlug: eq?.slug || null,
      });
    }
    if (port.ports?.length) out.push(...collectComponentPorts(port.ports));
  }
  return out;
}

function slotOptionsKey(componentType, sizeMax) {
  return `${componentType}:${sizeMax}`;
}

async function fetchSlotOptions(componentType, sizeMax) {
  const wikiType = WIKI_ITEM_TYPES[componentType] || componentType;
  const size = Number(sizeMax);
  if (!wikiType || !Number.isFinite(size)) return { rows: [] };

  const cacheKey = slotOptionsKey(componentType, size);
  if (slotOptionsCache.has(cacheKey)) return slotOptionsCache.get(cacheKey);
  if (slotOptionsInflight.has(cacheKey)) return slotOptionsInflight.get(cacheKey);

  const work = (async () => {
    const rows = [];
    let page = 1;
    let lastPage = 1;
    while (page <= lastPage && rows.length < 80) {
      const json = await fetchJson(
        `${WIKI_BASE}/items?filter[type]=${encodeURIComponent(wikiType)}&filter[size]=${size}&per_page=50&page=${page}`
      );
      lastPage = json.meta?.last_page || 1;
      for (const item of json.data || []) {
        const preview = formatWikiItem(item);
        const { dps } = weaponDpsFromProfile(preview);
        rows.push({
          name: item.name || item.game_name,
          slug: item.slug,
          className: item.class_name,
          size: item.size ?? null,
          dps,
          headline: preview ? combatHeadline(preview) : null,
        });
      }
      page += 1;
      if (page <= lastPage) await sleep(FETCH_GAP_MS);
    }

    if (componentType === "WeaponGun") {
      rows.sort((a, b) => (b.dps ?? -1) - (a.dps ?? -1));
    } else {
      rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }

    const payload = { rows };
    slotOptionsCache.set(cacheKey, payload);
    return payload;
  })();

  slotOptionsInflight.set(cacheKey, work);
  try {
    return await work;
  } finally {
    slotOptionsInflight.delete(cacheKey);
  }
}

async function loadSlotOptionsForBlueprint(blueprint) {
  const slotOptions = {};
  const keys = new Set();
  for (const slot of blueprint.weaponSlots || []) {
    if (slot.sizeMax != null) keys.add(slotOptionsKey("WeaponGun", slot.sizeMax));
  }
  for (const slot of blueprint.componentSlots || []) {
    if (slot.sizeMax != null) keys.add(slotOptionsKey(slot.componentType, slot.sizeMax));
  }
  // Fetch every size/type catalog in parallel (shared cache/inflight dedupes overlaps).
  await Promise.all(
    [...keys].map(async (key) => {
      const [componentType, sizeStr] = key.split(":");
      slotOptions[key] = await fetchSlotOptions(componentType, Number(sizeStr));
    })
  );
  return slotOptions;
}

function weaponDpsFromProfile(profile) {
  if (!profile?.stats?.length) return { dps: null, alpha: null };
  const dpsStat = profile.stats.find((s) => s.label === "DPS");
  const alphaStat = profile.stats.find((s) => s.label === "Alpha");
  const parseNum = (v) => {
    if (v == null) return null;
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  return { dps: parseNum(dpsStat?.value), alpha: parseNum(alphaStat?.value) };
}

async function resolveItemProfile(combatIntel, identifier) {
  if (!identifier) return null;
  const result = await combatIntel.getItemCombatProfile({
    className: identifier,
    slug: identifier.includes("_") ? classNameToSlug(identifier) : identifier,
  });
  return result?.ok ? result : null;
}

async function simulateWeaponSlots(combatIntel, slots, assignments = {}) {
  const weapons = await Promise.all(
    (slots || []).map(async (slot) => {
      const assigned = assignments[slot.portId] || slot.stockClassName || slot.stockSlug;
      let profile = null;
      let name = slot.stockName || assigned;
      if (assigned) {
        const item = await resolveItemProfile(combatIntel, assigned);
        if (item) {
          profile = item.profile;
          name = item.name || name;
        }
      }
      const { dps, alpha } = weaponDpsFromProfile(profile);
      return {
        portId: slot.portId,
        label: slot.label,
        name,
        className: assigned,
        dps,
        alpha,
        headline: profile ? combatHeadline(profile) : null,
        sizeMax: slot.sizeMax,
        stockClassName: slot.stockClassName || null,
        stockName: slot.stockName || null,
      };
    })
  );

  let totalDps = 0;
  let totalAlpha = 0;
  let dpsCount = 0;
  for (const w of weapons) {
    if (w.dps != null) {
      totalDps += w.dps;
      dpsCount += 1;
    }
    if (w.alpha != null) totalAlpha += w.alpha;
  }

  return {
    weapons,
    totalDps: dpsCount ? Math.round(totalDps * 10) / 10 : null,
    totalAlpha: dpsCount ? Math.round(totalAlpha * 10) / 10 : null,
    weaponCount: weapons.length,
    note:
      "Simplified loadout math: weapon DPS values are summed from wiki datamine stats. Power, heat, and capacitor interactions are not simulated.",
  };
}

function startSlotOptionsLoad(payload) {
  if (!payload?.ok || payload._slotOptionsPromise) return payload._slotOptionsPromise;
  payload.slotOptionsPending = true;
  payload._slotOptionsPromise = loadSlotOptionsForBlueprint(payload)
    .then((slotOptions) => {
      payload.slotOptions = slotOptions;
      payload.slotOptionsPending = false;
      return payload;
    })
    .catch((err) => {
      payload.slotOptionsPending = false;
      payload.slotOptionsError = err.message || String(err);
      return payload;
    });
  return payload._slotOptionsPromise;
}

/** Strip non-cloneable fields before IPC (Promises break structured clone). */
function toIpcBlueprint(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const { _slotOptionsPromise, ...rest } = payload;
  return rest;
}

async function getShipBlueprint(combatIntel, slug, options = {}) {
  const waitForSlotOptions = options.waitForSlotOptions === true;
  const key = `${BLUEPRINT_CACHE_VERSION}:${String(slug || "").trim()}`;
  if (!key || key === `${BLUEPRINT_CACHE_VERSION}:`) return { ok: false, error: "missing ship slug" };

  const cached = blueprintCache.get(key);
  if (cached?.ok) {
    if (waitForSlotOptions && cached.slotOptionsPending && cached._slotOptionsPromise) {
      await cached._slotOptionsPromise;
    }
    return toIpcBlueprint(cached);
  }
  if (blueprintInflight.has(key)) {
    const pending = await blueprintInflight.get(key);
    if (pending?.ok && waitForSlotOptions && pending.slotOptionsPending && pending._slotOptionsPromise) {
      await pending._slotOptionsPromise;
    }
    return toIpcBlueprint(pending);
  }

  const work = (async () => {
    const slugPath = String(slug || "").trim();
    let json = null;
    try {
      json = await fetchJson(
        `${WIKI_BASE}/vehicles/${encodeURIComponent(slugPath)}?include=ports,components`
      );
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }

    const data = json?.data;
    if (!data) return { ok: false, error: "ship not found" };

    const weaponSlots = collectWeaponGunPorts(data.ports);
    const componentSlots = collectComponentPorts(data.ports);
    const stockComponents = (data.components || []).map((c) => ({
      type: c.type,
      name: c.name,
      size: c.component_size || c.size || null,
      quantity: c.quantity ?? 1,
    }));

    // Fast path: stock DPS + hull only. Equipment catalogs load in the background.
    const stockSummary = await simulateWeaponSlots(combatIntel, weaponSlots, {});
    const payload = {
      ok: true,
      ship: {
        name: data.name || data.game_name,
        slug: data.slug,
        className: data.class_name,
        manufacturer: data.manufacturer?.name || null,
      },
      weaponSlots,
      componentSlots,
      slotOptions: {},
      slotOptionsPending: true,
      stockComponents,
      stockSummary,
      hullProfile: formatVehicle(data),
      limitations:
        "Stock weapons are read from wiki port data. Swap guns below to compare simplified total DPS. For full heat and power sims use ERkul (linked under Advanced tools).",
    };
    blueprintCache.set(key, payload);
    startSlotOptionsLoad(payload);
    return payload;
  })();

  blueprintInflight.set(key, work);
  try {
    const payload = await work;
    if (payload?.ok && waitForSlotOptions && payload.slotOptionsPending && payload._slotOptionsPromise) {
      await payload._slotOptionsPromise;
    }
    return toIpcBlueprint(payload);
  } finally {
    blueprintInflight.delete(key);
  }
}

async function searchShipWeapons(options = {}) {
  const query = String(options.query || "").trim();
  const sizeMax = options.sizeMax != null ? Number(options.sizeMax) : null;
  if (!query || query.length < 2) return { rows: [] };

  const json = await fetchJson(
    `${WIKI_BASE}/items?filter[query]=${encodeURIComponent(query)}&per_page=40`
  );
  const rows = [];
  for (const item of json?.data || []) {
    if (item.type !== "WeaponGun" && !item.vehicle_weapon) continue;
    const size = Number(item.size);
    if (sizeMax != null && Number.isFinite(size) && size > sizeMax) continue;
    const preview = formatWikiItem(item);
    const { dps } = weaponDpsFromProfile(preview);
    rows.push({
      name: item.name || item.game_name,
      slug: item.slug,
      className: item.class_name,
      size: item.size ?? null,
      dps,
      headline: preview ? combatHeadline(preview) : null,
    });
    if (rows.length >= 20) break;
  }
  rows.sort((a, b) => (b.dps ?? -1) - (a.dps ?? -1));
  return { rows };
}

async function simulateLoadout(combatIntel, options = {}) {
  const slug = String(options.shipSlug || options.slug || "").trim();
  if (!slug) return { ok: false, error: "missing ship slug" };

  // First paint: don't block on equipment catalogs.
  const blueprint = await getShipBlueprint(combatIntel, slug, { waitForSlotOptions: false });
  if (!blueprint.ok) return blueprint;

  const assignments =
    options.slotAssignments && typeof options.slotAssignments === "object"
      ? options.slotAssignments
      : {};

  const hasCustom =
    Object.keys(assignments).length > 0 &&
    Object.values(assignments).some((v) => v && String(v).trim());
  const summary = hasCustom
    ? await simulateWeaponSlots(combatIntel, blueprint.weaponSlots, assignments)
    : blueprint.stockSummary;

  return {
    ok: true,
    ship: blueprint.ship,
    summary,
    hullProfile: blueprint.hullProfile,
    blueprint: toIpcBlueprint(blueprint),
    slotOptionsPending: !!blueprint.slotOptionsPending,
  };
}

async function awaitShipSlotOptions(combatIntel, slug) {
  return getShipBlueprint(combatIntel, slug, { waitForSlotOptions: true });
}

module.exports = {
  collectWeaponGunPorts,
  collectComponentPorts,
  weaponDpsFromProfile,
  fetchSlotOptions,
  getShipBlueprint,
  awaitShipSlotOptions,
  searchShipWeapons,
  simulateLoadout,
};
