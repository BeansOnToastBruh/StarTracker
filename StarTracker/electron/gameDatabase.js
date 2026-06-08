const fs = require("fs");
const path = require("path");
const { syncCatalog, SYNC_VERSION } = require("./catalogSync");
const {
  UEX_CATEGORY_GROUPS,
  WIKI_ITEM_GROUPS,
  buildPlacesFromTerminals,
} = require("./catalogSections");

let dbDir = null;
let bundledDir = null;
let catalog = null;
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensurePlacesIndex(catalogData) {
  if (!catalogData) return catalogData;
  catalogData.places = buildPlacesFromTerminals(catalogData.terminals || []);
  if (catalogData.meta?.counts) {
    catalogData.meta.counts.places = catalogData.places.length;
  }
  return catalogData;
}

function loadCatalog() {
  const userPath = catalogPath();
  if (userPath && fs.existsSync(userPath)) {
    try {
      catalog = ensurePlacesIndex(readJson(userPath));
      return catalog;
    } catch {
      catalog = null;
    }
  }

  const bundledPath = path.join(bundledDir, "catalog.json");
  if (fs.existsSync(bundledPath)) {
    try {
      catalog = ensurePlacesIndex(readJson(bundledPath));
      if (userPath) {
        ensureDbDir();
        fs.writeFileSync(userPath, JSON.stringify(catalog), "utf8");
      }
      return catalog;
    } catch {
      catalog = null;
    }
  }

  catalog = { ...EMPTY_CATALOG };
  return catalog;
}

function saveCatalog(next) {
  catalog = next;
  const userPath = catalogPath();
  if (!userPath) return;
  ensureDbDir();
  fs.writeFileSync(userPath, JSON.stringify(catalog), "utf8");
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
    itemCount: c.items?.length || 0,
    vehicleCount: c.vehicles?.length || 0,
    terminalCount: c.terminals?.length || 0,
    shopCount: Object.keys(c.shopIndex?.byTerminal || {}).length,
    placeCount: c.places?.length || 0,
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

function queryVehicles(options = {}) {
  const c = getCatalog();
  const q = normalizeQuery(options.query);
  let rows = (c.vehicles || []).filter((r) => rowMatchesQuery(r, q));
  if (options.withListingsOnly) {
    rows = rows.filter((r) => (r.listings || []).length > 0);
  }
  rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return paginate(rows, options);
}

function queryItems(options = {}) {
  const c = getCatalog();
  const q = normalizeQuery(options.query);
  const section = options.section || null;
  let rows = c.items || [];

  if (section) {
    const group = UEX_CATEGORY_GROUPS[section] || WIKI_ITEM_GROUPS[section];
    if (group?.categoryIds) {
      const cats = new Set(group.categoryIds.map((id) => Number(id)));
      rows = rows.filter((r) => cats.has(Number(r.uexCategoryId)));
    }
    if (group?.types) {
      const types = new Set(group.types.map((t) => t.toLowerCase()));
      rows = rows.filter(
        (r) =>
          types.has(String(r.category || "").toLowerCase()) ||
          types.has(String(r.section || "").toLowerCase()) ||
          group.label.toLowerCase() === String(r.section || "").toLowerCase()
      );
    }
    if (section === "armor") {
      rows = rows.filter(
        (r) =>
          /armor|undersuit|helmet|torso|legs|arms|backpack/i.test(
            `${r.section} ${r.category}`
          ) || rowMatchesQuery(r, "armor")
      );
    }
    if (section === "fps_weapons") {
      rows = rows.filter(
        (r) =>
          /weapon|attachment|personal/i.test(`${r.section} ${r.category}`) &&
          !/ship|vehicle|turret|missile rack/i.test(`${r.section} ${r.category}`)
      );
    }
    if (section === "ship_weapons") {
      rows = rows.filter((r) =>
        /ship|vehicle|turret|missile|gun|cannon|bomb/i.test(
          `${r.section} ${r.category}`
        )
      );
    }
    if (section === "ship_components" || section === "ship_utility") {
      rows = rows.filter((r) =>
        /system|avionics|propulsion|utility|cooler|power|shield|quantum|module|docking|mining|tractor|salvage/i.test(
          `${r.section} ${r.category}`
        )
      );
    }
  }

  rows = rows.filter((r) => rowMatchesQuery(r, q));
  if (options.withListingsOnly !== false) {
    rows = rows.filter((r) => (r.listings || []).length > 0);
  }
  rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return paginate(rows, options);
}

function queryShops(options = {}) {
  const c = getCatalog();
  const q = normalizeQuery(options.query);
  const entries = Object.values(c.shopIndex?.byTerminal || {});
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
  const c = getCatalog();
  return c.shopIndex?.byTerminal?.[String(terminalKey)] || null;
}

function placeMatchesServices(place, services = []) {
  const wanted = (services || []).filter(Boolean);
  if (!wanted.length) return true;
  return wanted.every((svc) => place.services?.[svc]);
}

function queryPlaces(options = {}) {
  const c = getCatalog();
  const q = normalizeQuery(options.query);
  const services = options.services || [];
  let rows = (c.places || []).filter((place) => {
    if (!placeMatchesServices(place, services)) return false;
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
  const c = getCatalog();
  return (c.places || []).find((p) => p.key === key) || null;
}

function getItemDetail(key) {
  const c = getCatalog();
  const item = c.shopIndex?.byItemKey?.[String(key)] || null;
  if (item) return item;
  const vehicle = (c.vehicles || []).find(
    (v) => v.className === key || v.slug === key
  );
  if (vehicle) return { ...vehicle, key: vehicle.className || vehicle.slug };
  const row = (c.items || []).find(
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
