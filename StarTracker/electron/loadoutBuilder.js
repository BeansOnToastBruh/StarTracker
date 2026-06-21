const { formatVehicle, formatWikiItem, combatHeadline } = require("./combatIntelFormat");

const WIKI_BASE = "https://api.star-citizen.wiki/api";
const FETCH_GAP_MS = 350;

const blueprintCache = new Map();

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
  let totalDps = 0;
  let totalAlpha = 0;
  let dpsCount = 0;
  const weapons = [];

  for (const slot of slots) {
    const assigned = assignments[slot.portId] || slot.stockClassName || slot.stockSlug;
    let profile = null;
    let name = slot.stockName || assigned;
    if (assigned) {
      const item = await resolveItemProfile(combatIntel, assigned);
      if (item) {
        profile = item.profile;
        name = item.name || name;
      }
      await sleep(FETCH_GAP_MS);
    }
    const { dps, alpha } = weaponDpsFromProfile(profile);
    if (dps != null) {
      totalDps += dps;
      dpsCount += 1;
    }
    if (alpha != null) totalAlpha += alpha;
    weapons.push({
      portId: slot.portId,
      label: slot.label,
      name,
      className: assigned,
      dps,
      alpha,
      headline: profile ? combatHeadline(profile) : null,
      sizeMax: slot.sizeMax,
    });
  }

  return {
    weapons,
    totalDps: dpsCount ? Math.round(totalDps * 10) / 10 : null,
    totalAlpha: dpsCount ? Math.round(totalAlpha * 10) / 10 : null,
    weaponCount: slots.length,
    note:
      "Simplified loadout math: weapon DPS values are summed from wiki datamine stats. Power, heat, and capacitor interactions are not simulated.",
  };
}

async function getShipBlueprint(combatIntel, slug) {
  const key = String(slug || "").trim();
  if (!key) return { ok: false, error: "missing ship slug" };
  if (blueprintCache.has(key)) return blueprintCache.get(key);

  let json = null;
  try {
    json = await fetchJson(
      `${WIKI_BASE}/vehicles/${encodeURIComponent(key)}?include=ports,components`
    );
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }

  const data = json?.data;
  if (!data) return { ok: false, error: "ship not found" };

  const weaponSlots = collectWeaponGunPorts(data.ports);
  const stockComponents = (data.components || []).map((c) => ({
    type: c.type,
    name: c.name,
    size: c.component_size || c.size || null,
    quantity: c.quantity ?? 1,
  }));

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
    stockComponents,
    stockSummary,
    hullProfile: formatVehicle(data),
    limitations:
      "Stock weapons are read from wiki port data. Swap guns below to compare simplified total DPS. For full heat and power sims use ERkul (linked under Advanced tools).",
  };
  blueprintCache.set(key, payload);
  return payload;
}

async function searchShipWeapons(options = {}) {
  const query = String(options.query || "").trim();
  const sizeMax = options.sizeMax != null ? Number(options.sizeMax) : null;
  if (!query || query.length < 2) return { rows: [] };

  const json = await fetchJson(
    `${WIKI_BASE}/items?search=${encodeURIComponent(query)}&per_page=40`
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

  const blueprint = await getShipBlueprint(combatIntel, slug);
  if (!blueprint.ok) return blueprint;

  const assignments = options.slotAssignments && typeof options.slotAssignments === "object"
    ? options.slotAssignments
    : {};

  const summary = await simulateWeaponSlots(combatIntel, blueprint.weaponSlots, assignments);
  return {
    ok: true,
    ship: blueprint.ship,
    summary,
    hullProfile: blueprint.hullProfile,
  };
}

module.exports = {
  collectWeaponGunPorts,
  weaponDpsFromProfile,
  getShipBlueprint,
  searchShipWeapons,
  simulateLoadout,
};
