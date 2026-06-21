const fs = require("fs");
const path = require("path");
const { syncCatalog, SYNC_VERSION } = require("./catalogSync");
const {
  UEX_CATEGORY_GROUPS,
  WIKI_ITEM_GROUPS,
  buildPlacesFromTerminals,
} = require("./catalogSections");
const {
  SPLIT_SECTIONS,
  hasSplitCatalog,
  hasLegacyCatalog,
  writeSplitCatalog,
  writeLegacyCatalog,
  copySplitCatalog,
  readSplitMeta,
  readSplitSection,
  readLegacyCatalog,
} = require("./catalogStorage");

let dbDir = null;
let bundledDir = null;
let catalog = null;
let catalogSourceDir = null;
let catalogFormat = null;
const loadedSections = new Set();
const sectionItemCache = new Map();
let syncInFlight = null;
let progressListeners = new Set();

const EMPTY_CATALOG = {
  meta: { version: SYNC_VERSION, syncedAt: null, counts: {} },
  terminals: [],
  vehicles: [],
  items: [],
  shopIndex: { byTerminal: {}, byItemKey: {} },
  places: [],
};

function emitProgress(payload) {
  for (const cb of progressListeners) {
    try {
      cb(payload);
    } catch {
      /* ignore */
    }
  }
}

function init(options = {}) {
  dbDir = options.dbDir || null;
  bundledDir = options.bundledDir || path.join(__dirname, "..", "data", "catalog");
  loadCatalog();
}

function catalogPath() {
  return dbDir ? path.join(dbDir, "catalog.json") : null;
}

function ensureDbDir() {
  if (!dbDir) return;
  fs.mkdirSync(dbDir, { recursive: true });
}

function ensurePlacesIndex(catalogData) {
  if (!catalogData) return catalogData;
  catalogData.places = buildPlacesFromTerminals(catalogData.terminals || []);
  if (catalogData.meta?.counts) {
    catalogData.meta.counts.places = catalogData.places.length;
  }
  return catalogData;
}

function ensureSection(section) {
  if (!catalog || loadedSections.has(section)) return;
  if (catalogFormat !== "split" || !catalogSourceDir) {
    loadedSections.add(section);
    return;
  }
  catalog[section] = readSplitSection(catalogSourceDir, section);
  loadedSections.add(section);
  if (section === "terminals") {
    ensurePlacesIndex(catalog);
  }
}

function loadSplitCatalog(sourceDir) {
  catalog = {
    ...EMPTY_CATALOG,
    meta: readSplitMeta(sourceDir),
  };
  catalogFormat = "split";
  catalogSourceDir = sourceDir;
  loadedSections.clear();
  sectionItemCache.clear();
  ensureSection("terminals");
  return catalog;
}

function loadLegacyCatalog(sourceDir) {
  catalog = ensurePlacesIndex(readLegacyCatalog(sourceDir));
  catalogFormat = "legacy";
  catalogSourceDir = sourceDir;
  for (const section of SPLIT_SECTIONS) loadedSections.add(section);
  sectionItemCache.clear();
  return catalog;
}

function loadCatalog() {
  const userDir = dbDir;
  if (userDir && hasSplitCatalog(userDir)) {
    return loadSplitCatalog(userDir);
  }
  if (userDir && hasLegacyCatalog(userDir)) {
    try {
      return loadLegacyCatalog(userDir);
    } catch {
      catalog = null;
    }
  }

  if (hasSplitCatalog(bundledDir)) {
    const loaded = loadSplitCatalog(bundledDir);
    if (userDir) {
      try {
        copySplitCatalog(bundledDir, userDir);
      } catch {
        /* keep bundled copy in memory */
      }
    }
    return loaded;
  }

  if (hasLegacyCatalog(bundledDir)) {
    try {
      const loaded = loadLegacyCatalog(bundledDir);
      if (userDir) {
        ensureDbDir();
        writeLegacyCatalog(userDir, loaded);
      }
      return loaded;
    } catch {
      catalog = null;
    }
  }

  catalog = { ...EMPTY_CATALOG };
  catalogFormat = "empty";
  catalogSourceDir = null;
  loadedSections.clear();
  sectionItemCache.clear();
  return catalog;
}

function saveCatalog(next) {
  catalog = ensurePlacesIndex(next);
  catalogFormat = "legacy";
  catalogSourceDir = dbDir || bundledDir;
  for (const section of SPLIT_SECTIONS) loadedSections.add(section);
  sectionItemCache.clear();
  const userDir = dbDir;
  if (!userDir) return;
  ensureDbDir();
  writeSplitCatalog(userDir, catalog);
}

function getCatalog() {
  if (!catalog) loadCatalog();
  return catalog;
}

function getStats() {
  const c = getCatalog();
  return {
    ...c.meta,
    loaded: Boolean(c.meta?.syncedAt),
    itemCount: c.meta?.counts?.items ?? c.items?.length ?? 0,
    vehicleCount: c.meta?.counts?.vehicles ?? c.vehicles?.length ?? 0,
    terminalCount: c.meta?.counts?.terminals ?? c.terminals?.length ?? 0,
    shopCount:
      c.meta?.counts?.shopsWithStock ??
      Object.keys(c.shopIndex?.byTerminal || {}).length,
    placeCount: c.meta?.counts?.places ?? c.places?.length ?? 0,
  };
}

function normalizeQuery(q) {
  return String(q || "")
    .trim()
    .toLowerCase();
}

function rowMatchesQuery(row, q) {
  if (!q) return true;
  const hay = [
    row.name,
    row.displayName,
    row.className,
    row.manufacturer,
    row.section,
    row.category,
    row.slug,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function paginate(rows, options = {}) {
  const limit = Math.min(Math.max(options.limit ?? 80, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  return {
    total: rows.length,
    offset,
    limit,
    rows: rows.slice(offset, offset + limit),
  };
}

function filterItemsBySection(rows, section) {
  if (!section) return rows;
  const group = UEX_CATEGORY_GROUPS[section] || WIKI_ITEM_GROUPS[section];
  let filtered = rows;

  if (group?.categoryIds) {
    const cats = new Set(group.categoryIds.map((id) => Number(id)));
    filtered = filtered.filter((r) => cats.has(Number(r.uexCategoryId)));
  }
  if (group?.types) {
    const types = new Set(group.types.map((t) => t.toLowerCase()));
    filtered = filtered.filter(
      (r) =>
        types.has(String(r.category || "").toLowerCase()) ||
        types.has(String(r.section || "").toLowerCase()) ||
        group.label.toLowerCase() === String(r.section || "").toLowerCase()
    );
  }
  if (section === "armor") {
    filtered = filtered.filter(
      (r) =>
        /armor|undersuit|helmet|torso|legs|arms|backpack/i.test(
          `${r.section} ${r.category}`
        ) || rowMatchesQuery(r, "armor")
    );
  }
  if (section === "fps_weapons") {
    filtered = filtered.filter(
      (r) =>
        /weapon|attachment|personal/i.test(`${r.section} ${r.category}`) &&
        !/ship|vehicle|turret|missile rack/i.test(`${r.section} ${r.category}`)
    );
  }
  if (section === "ship_weapons") {
    filtered = filtered.filter((r) =>
      /ship|vehicle|turret|missile|gun|cannon|bomb/i.test(
        `${r.section} ${r.category}`
      )
    );
  }
  if (section === "ship_components" || section === "ship_utility") {
    filtered = filtered.filter((r) =>
      /system|avionics|propulsion|utility|cooler|power|shield|quantum|module|docking|mining|tractor|salvage/i.test(
        `${r.section} ${r.category}`
      )
    );
  }
  return filtered;
}

function itemsForSection(section) {
  ensureSection("items");
  if (!section) return catalog.items || [];
  if (sectionItemCache.has(section)) return sectionItemCache.get(section);
  const filtered = filterItemsBySection(catalog.items || [], section);
  sectionItemCache.set(section, filtered);
  return filtered;
}

function queryVehicles(options = {}) {
  ensureSection("vehicles");
  const q = normalizeQuery(options.query);
  let rows = (catalog.vehicles || []).filter((r) => rowMatchesQuery(r, q));
  if (options.withListingsOnly) {
    rows = rows.filter((r) => (r.listings || []).length > 0);
  }
  rows.sort((a, b) => {
    const ma = String(a.manufacturer || "ZZZ").localeCompare(String(b.manufacturer || "ZZZ"));
    if (ma !== 0) return ma;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
  return paginate(rows, options);
}

function queryItems(options = {}) {
  const q = normalizeQuery(options.query);
  const section = options.section || null;
  let rows = itemsForSection(section);
  rows = rows.filter((r) => rowMatchesQuery(r, q));
  if (options.withListingsOnly !== false) {
    rows = rows.filter((r) => (r.listings || []).length > 0);
  }
  rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return paginate(rows, options);
}

function queryShops(options = {}) {
  ensureSection("shopIndex");
  const q = normalizeQuery(options.query);
  const entries = Object.values(catalog.shopIndex?.byTerminal || {});
  let rows = entries.filter((shop) => {
    if (!q) return true;
    const hay = [
      shop.terminal,
      shop.location,
      shop.system,
      shop.terminalCode,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
  rows.sort((a, b) => String(a.terminal).localeCompare(String(b.terminal)));
  return paginate(rows, options);
}

function getShopDetail(terminalKey) {
  ensureSection("shopIndex");
  return catalog.shopIndex?.byTerminal?.[String(terminalKey)] || null;
}

function queryPlaces(options = {}) {
  ensureSection("terminals");
  const q = normalizeQuery(options.query);
  let rows = (catalog.places || []).filter((place) => {
    if (!q) return true;
    const hay = [
      place.name,
      place.system,
      place.planet,
      place.moon,
      place.station,
      place.city,
      place.outpost,
      place.kind,
      place.location,
      ...place.terminals.map((t) => t.name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
  rows.sort((a, b) =>
    `${a.system || ""} ${a.name}`.localeCompare(`${b.system || ""} ${b.name}`)
  );
  return paginate(rows, options);
}

function getPlaceDetail(key) {
  ensureSection("terminals");
  return (catalog.places || []).find((p) => p.key === key) || null;
}

function getItemDetail(key) {
  ensureSection("shopIndex");
  ensureSection("items");
  ensureSection("vehicles");
  const item = catalog.shopIndex?.byItemKey?.[String(key)] || null;
  if (item) return item;
  const vehicle = (catalog.vehicles || []).find(
    (v) => v.className === key || v.slug === key
  );
  if (vehicle) return { ...vehicle, key: vehicle.className || vehicle.slug };
  const row = (catalog.items || []).find(
    (v) =>
      v.className === key ||
      v.slug === key ||
      String(v.uexId) === key ||
      `uex:${v.uexId}` === key
  );
  if (!row) return null;
  return {
    key,
    name: row.name,
    className: row.className,
    section: row.section,
    category: row.category,
    manufacturer: row.manufacturer,
    listings: row.listings || [],
  };
}

function onSyncProgress(cb) {
  progressListeners.add(cb);
  return () => progressListeners.delete(cb);
}

async function refreshCatalog(options = {}) {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    try {
      emitProgress({ phase: "start", message: "Starting catalog sync…" });
      const next = await syncCatalog((p) => emitProgress(p));
      saveCatalog(next);
      emitProgress({
        phase: "done",
        message: "Catalog sync complete.",
        stats: getStats(),
      });
      return { ok: true, stats: getStats() };
    } catch (err) {
      emitProgress({
        phase: "error",
        message: err?.message || "Catalog sync failed.",
      });
      return { ok: false, error: err?.message || "sync failed" };
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

function isStale() {
  const c = getCatalog();
  if (!c.meta?.syncedAt) return true;
  const ageMs = Date.now() - new Date(c.meta.syncedAt).getTime();
  return ageMs > 7 * 24 * 60 * 60 * 1000;
}

module.exports = {
  init,
  getCatalog,
  getStats,
  queryVehicles,
  queryItems,
  queryShops,
  queryPlaces,
  getShopDetail,
  getPlaceDetail,
  getItemDetail,
  refreshCatalog,
  onSyncProgress,
  isStale,
  SYNC_VERSION,
};
