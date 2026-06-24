const fs = require("fs");
const path = require("path");

const WIKI_BASE = "https://api.star-citizen.wiki/api";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_GAP_MS = 350;
const DEFAULT_BASELINE_QUALITY = 500;

let cacheDir = null;
const memoryCache = new Map();

function init(options = {}) {
  cacheDir = options.cacheDir || null;
}

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

function cacheFileKey(kind, id) {
  const safe = String(id).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return path.join(cacheDir || "", `${kind}-${safe}.json`);
}

function readDiskCache(kind, id) {
  if (!cacheDir) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(cacheFileKey(kind, id), "utf8"));
    if (!raw?.fetchedAt) return null;
    if (Date.now() - new Date(raw.fetchedAt).getTime() > CACHE_TTL_MS) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeDiskCache(kind, id, payload) {
  if (!cacheDir) return;
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      cacheFileKey(kind, id),
      JSON.stringify({ fetchedAt: new Date().toISOString(), ...payload }, null, 2),
      "utf8"
    );
  } catch {
    /* ignore */
  }
}

function slugFromBlueprint(data) {
  const url = data?.web_url || "";
  const m = url.match(/\/blueprints\/([^/?#]+)/i);
  return m ? m[1] : null;
}

function defaultQualityForModifier(mod) {
  const min = mod?.quality_range?.min ?? 0;
  const max = mod?.quality_range?.max ?? 1000;
  if (min <= DEFAULT_BASELINE_QUALITY && max >= DEFAULT_BASELINE_QUALITY) {
    return DEFAULT_BASELINE_QUALITY;
  }
  return min;
}

function modifierAtQuality(mod, quality) {
  const min = mod?.quality_range?.min ?? 0;
  const max = mod?.quality_range?.max ?? 1000;
  const q = Math.max(min, Math.min(max, Number(quality) || min));
  const lo = mod?.modifier_range?.at_min_quality ?? 1;
  const hi = mod?.modifier_range?.at_max_quality ?? 1;
  if (max <= min) return lo;
  const t = (q - min) / (max - min);
  return lo + t * (hi - lo);
}

function parseBaseStats(descriptionData) {
  const stats = {};
  for (const row of descriptionData || []) {
    const name = String(row?.name || "");
    const val = String(row?.value || "");
    if (name === "Damage Reduction") {
      const n = parseFloat(val);
      if (Number.isFinite(n)) stats.armor_damagemitigation = n / 100;
    }
    if (name === "Temp. Rating") {
      const m = val.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/);
      if (m) {
        stats.armor_temperaturemin = parseFloat(m[1]);
        stats.armor_temperaturemax = parseFloat(m[2]);
      }
    }
  }
  return stats;
}

function extractCraftInputs(blueprint) {
  const inputs = [];
  for (const group of blueprint?.requirement_groups || []) {
    for (const child of group.children || []) {
      if (child.kind !== "resource" && child.kind !== "item") continue;
      const inputKey = child.uuid || child.name;
      const groupModifiers = group.modifiers || [];
      let defaultQuality = DEFAULT_BASELINE_QUALITY;
      if (groupModifiers.length) {
        defaultQuality = defaultQualityForModifier(groupModifiers[0]);
      }
      inputs.push({
        inputKey,
        groupKey: group.key || group.name,
        groupName: group.name || group.key || "Requirement",
        name: child.name,
        kind: child.kind,
        quantityScu: child.quantity_scu ?? child.quantity ?? null,
        minQuality: child.min_quality ?? 0,
        modifiers: groupModifiers,
        defaultQuality,
        oreUuid: child.ore_uuid || null,
      });
    }
  }
  return inputs;
}

function buildPropertyMap(blueprint) {
  const map = new Map();
  for (const group of blueprint?.requirement_groups || []) {
    for (const child of group.children || []) {
      if (child.kind !== "resource" && child.kind !== "item") continue;
      const inputKey = child.uuid || child.name;
      for (const mod of group.modifiers || []) {
        map.set(mod.property_key, {
          modifier: mod,
          inputKey,
          inputName: child.name,
          groupName: group.name || group.key,
        });
      }
    }
  }
  return map;
}

function formatStatValue(propertyKey, value) {
  if (propertyKey === "armor_damagemitigation") {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (propertyKey === "armor_temperaturemin" || propertyKey === "armor_temperaturemax") {
    return `${Math.round(value)} °C`;
  }
  if (Math.abs(value) >= 100 || Number.isInteger(value)) return String(Math.round(value * 10) / 10);
  return value.toFixed(2);
}

function formatDelta(propertyKey, delta, betterWhen) {
  const sign = delta > 0 ? "+" : delta < 0 ? "" : "";
  let good = delta > 0;
  if (betterWhen === "lower") good = delta < 0;
  if (betterWhen === "higher") good = delta > 0;
  if (propertyKey === "armor_damagemitigation") {
    return { text: `${sign}${(delta * 100).toFixed(1)}%`, good };
  }
  if (propertyKey === "armor_temperaturemin" || propertyKey === "armor_temperaturemax") {
    return { text: `${sign}${Math.round(delta)} °C`, good };
  }
  return { text: `${sign}${delta.toFixed(2)}`, good: delta >= 0 };
}

function computeCraftPreview(blueprint, baseStats, qualitiesByInputKey) {
  const propertyMap = buildPropertyMap(blueprint);
  const inputs = extractCraftInputs(blueprint);
  const qualities = { ...qualitiesByInputKey };
  for (const input of inputs) {
    if (qualities[input.inputKey] == null) {
      qualities[input.inputKey] = input.defaultQuality;
    }
  }

  const stats = [];
  const summaryKeys =
    blueprint?.summary_properties?.map((p) => p.property_key) ||
    [...propertyMap.keys()];

  for (const propertyKey of summaryKeys) {
    const binding = propertyMap.get(propertyKey);
    const summaryMeta = (blueprint?.summary_properties || []).find(
      (p) => p.property_key === propertyKey
    );
    const label = binding?.modifier?.label || summaryMeta?.label || propertyKey;
    const betterWhen = binding?.modifier?.better_when || summaryMeta?.better_when || "higher";
    const baseValue = baseStats[propertyKey];

    if (binding?.modifier) {
      const baselineQ = defaultQualityForModifier(binding.modifier);
      const baselineMod = modifierAtQuality(binding.modifier, baselineQ);
      const currentQ = qualities[binding.inputKey] ?? baselineQ;
      const currentMod = modifierAtQuality(binding.modifier, currentQ);

      if (baseValue != null && Number.isFinite(baseValue)) {
        const baselineValue = baseValue * baselineMod;
        const projectedValue = baseValue * currentMod;
        const delta = projectedValue - baselineValue;
        const deltaFmt = formatDelta(propertyKey, delta, betterWhen);
        stats.push({
          propertyKey,
          label,
          betterWhen,
          inputKey: binding.inputKey,
          inputName: binding.inputName,
          groupName: binding.groupName,
          quality: currentQ,
          baselineQuality: baselineQ,
          baselineModifier: baselineMod,
          currentModifier: currentMod,
          baseValue,
          baselineValue,
          projectedValue,
          delta,
          baselineFormatted: formatStatValue(propertyKey, baselineValue),
          projectedFormatted: formatStatValue(propertyKey, projectedValue),
          deltaFormatted: deltaFmt.text,
          deltaGood: deltaFmt.good,
          hasBaseStat: true,
        });
      } else {
        stats.push({
          propertyKey,
          label,
          betterWhen,
          inputKey: binding.inputKey,
          inputName: binding.inputName,
          groupName: binding.groupName,
          quality: currentQ,
          baselineQuality: baselineQ,
          baselineModifier: baselineMod,
          currentModifier: currentMod,
          modifierDelta: currentMod - baselineMod,
          baselineFormatted: `${(baselineMod * 100).toFixed(1)}%`,
          projectedFormatted: `${(currentMod * 100).toFixed(1)}%`,
          deltaFormatted: `${currentMod >= baselineMod ? "+" : ""}${((currentMod - baselineMod) * 100).toFixed(1)}%`,
          deltaGood: betterWhen === "lower" ? currentMod <= baselineMod : currentMod >= baselineMod,
          hasBaseStat: false,
        });
      }
    }
  }

  return { stats, qualities };
}

function shapeBlueprintSummary(row) {
  return {
    id: row.uuid || slugFromBlueprint(row) || row.key,
    uuid: row.uuid || null,
    slug: slugFromBlueprint(row) || null,
    outputName: row.output_name || row.name || "Blueprint",
    outputClass: row.output_class || null,
    craftTimeLabel: row.craft_time_label || null,
    craftTimeSeconds: row.craft_time_seconds ?? null,
    ingredientCount: row.ingredient_count ?? (row.ingredients || []).length,
    missionCount: row.unlocking_missions_count ?? (row.unlocking_missions || []).length,
    outputTypeLabel: row.output?.type_label || null,
    webUrl: row.web_url || null,
  };
}

function shapeBlueprintDetail(raw, outputItem) {
  const blueprint = {
    uuid: raw.uuid,
    slug: slugFromBlueprint(raw),
    key: raw.key,
    outputName: raw.output_name,
    outputClass: raw.output_class,
    craftTimeLabel: raw.craft_time_label,
    craftTimeSeconds: raw.craft_time_seconds,
    isAvailableByDefault: !!raw.is_available_by_default,
    gameVersion: raw.game_version || null,
    ingredients: raw.ingredients || [],
    dismantle: raw.dismantle || null,
    dismantleReturns: raw.dismantle_returns || [],
    requirementGroups: raw.requirement_groups || [],
    summaryProperties: raw.summary_properties || [],
    unlockingMissions: raw.unlocking_missions || [],
    unlockingMissionsGrouped: raw.unlocking_missions_grouped || [],
    output: raw.output || null,
    webUrl: raw.web_url || null,
    outputItemWebUrl: raw.output_item_web_url || null,
  };

  const baseStats = parseBaseStats(outputItem?.description_data);
  const inputs = extractCraftInputs(raw);
  const defaultQualities = Object.fromEntries(
    inputs.map((i) => [i.inputKey, i.defaultQuality])
  );
  const preview = computeCraftPreview(raw, baseStats, defaultQualities);

  return {
    blueprint,
    inputs,
    baseStats,
    outputItem: outputItem
      ? {
          uuid: outputItem.uuid,
          name: outputItem.name,
          typeLabel: outputItem.type_label || outputItem.type,
          subType: outputItem.sub_type || outputItem.subtype,
          grade: outputItem.grade,
          descriptionData: outputItem.description_data || [],
        }
      : null,
    preview,
    disclaimer:
      "Crafting previews use star-citizen.wiki datamine quality curves. In-game rounding may differ slightly. Baseline quality is 500 when that value sits inside the material range.",
  };
}

async function fetchBlueprintRaw(id) {
  const key = String(id || "").trim();
  if (!key) return null;
  const memKey = `bp:${key}`;
  if (memoryCache.has(memKey)) return memoryCache.get(memKey);

  const disk = readDiskCache("blueprint", key);
  if (disk?.data) {
    memoryCache.set(memKey, disk.data);
    return disk.data;
  }

  let json = null;
  try {
    json = await fetchJson(`${WIKI_BASE}/blueprints/${encodeURIComponent(key)}`);
  } catch {
    json = null;
  }

  if (!json?.data && key.includes("-")) {
    try {
      const list = await fetchJson(
        `${WIKI_BASE}/blueprints?${new URLSearchParams({
          "filter[query]": key,
          per_page: "5",
        }).toString()}`
      );
      const hit = (list?.data || []).find(
        (row) => slugFromBlueprint(row) === key || row.uuid === key
      );
      if (hit?.uuid) {
        await sleep(FETCH_GAP_MS);
        json = await fetchJson(`${WIKI_BASE}/blueprints/${encodeURIComponent(hit.uuid)}`);
      }
    } catch {
      json = null;
    }
  }

  const data = json?.data || null;
  if (!data) return null;

  memoryCache.set(memKey, data);
  writeDiskCache("blueprint", key, { data });
  if (data.uuid && data.uuid !== key) writeDiskCache("blueprint", data.uuid, { data });
  return data;
}

async function fetchOutputItem(outputItemUuid) {
  if (!outputItemUuid) return null;
  const memKey = `item:${outputItemUuid}`;
  if (memoryCache.has(memKey)) return memoryCache.get(memKey);

  const disk = readDiskCache("craft-item", outputItemUuid);
  if (disk?.data) {
    memoryCache.set(memKey, disk.data);
    return disk.data;
  }

  try {
    const json = await fetchJson(`${WIKI_BASE}/items/${encodeURIComponent(outputItemUuid)}`);
    const data = json?.data || null;
    if (data) {
      memoryCache.set(memKey, data);
      writeDiskCache("craft-item", outputItemUuid, { data });
    }
    return data;
  } catch {
    return null;
  }
}

async function searchBlueprints(options = {}) {
  const query = String(options.query || "").trim();
  const page = Math.max(Number(options.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(options.perPage) || 25, 5), 50);
  const params = new URLSearchParams({
    "page[number]": String(page),
    per_page: String(perPage),
  });
  if (query) params.set("filter[query]", query);

  const json = await fetchJson(`${WIKI_BASE}/blueprints?${params.toString()}`);
  const rows = (json?.data || []).map(shapeBlueprintSummary);
  return {
    ok: true,
    rows,
    meta: {
      query,
      page,
      perPage,
      total: json?.meta?.total ?? rows.length,
      lastPage: json?.meta?.last_page ?? 1,
      fetchedAt: new Date().toISOString(),
      source: "star-citizen.wiki",
    },
  };
}

async function getBlueprintDetail(id) {
  const raw = await fetchBlueprintRaw(id);
  if (!raw) return { ok: false, error: "Blueprint not found" };

  let outputItem = null;
  const outputUuid = raw.output_item_uuid || raw.output?.uuid;
  if (outputUuid) {
    await sleep(FETCH_GAP_MS);
    outputItem = await fetchOutputItem(outputUuid);
  }

  const shaped = shapeBlueprintDetail(raw, outputItem);
  return {
    ok: true,
    ...shaped,
    meta: {
      fetchedAt: new Date().toISOString(),
      source: "star-citizen.wiki",
      gameVersion: raw.game_version || null,
    },
  };
}

async function calculateCraftPreview(id, qualitiesByInputKey = {}) {
  const raw = await fetchBlueprintRaw(id);
  if (!raw) return { ok: false, error: "Blueprint not found" };

  let outputItem = null;
  const outputUuid = raw.output_item_uuid || raw.output?.uuid;
  if (outputUuid) {
    outputItem = await fetchOutputItem(outputUuid);
  }

  const baseStats = parseBaseStats(outputItem?.description_data);
  const preview = computeCraftPreview(raw, baseStats, qualitiesByInputKey || {});
  return { ok: true, preview, baseStats };
}

module.exports = {
  init,
  DEFAULT_BASELINE_QUALITY,
  modifierAtQuality,
  defaultQualityForModifier,
  parseBaseStats,
  extractCraftInputs,
  computeCraftPreview,
  searchBlueprints,
  getBlueprintDetail,
  calculateCraftPreview,
};
