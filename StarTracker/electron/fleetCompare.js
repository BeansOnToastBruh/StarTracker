const fs = require("fs");
const path = require("path");
const fetchUtil = require("./fetchUtil");

const WIKI_BASE = "https://api.star-citizen.wiki/api";
const INDEX_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_GAP_MS = 350;

let cacheDir = null;

function init(options = {}) {
  cacheDir = options.cacheDir || null;
}

function indexPath() {
  return path.join(cacheDir || "", "fleet-index.json");
}

const sleep = fetchUtil.sleep;

async function fetchJson(url) {
  return fetchUtil.fetchJson(url);
}

function compactFleetRow(v) {
  const sig = v.signature || v.emission || {};
  return {
    slug: v.slug,
    className: v.class_name,
    name: v.name || v.game_name,
    manufacturer: v.manufacturer?.name || null,
    size: v.size_class || (v.sizes?.length != null ? String(v.sizes.length) : null),
    role: v.role || null,
    hullHp: typeof v.health === "number" ? v.health : v.health?.hull_hp ?? null,
    shieldHp: v.shield_hp ?? v.shield?.hp ?? null,
    scm: v.speed?.scm ?? null,
    maxSpeed: v.speed?.max ?? null,
    h2Capacity: v.fuel?.capacity ?? null,
    qtFuel: v.quantum?.quantum_fuel_capacity ?? null,
    cargo: v.cargo_capacity ?? null,
    mass: v.mass ?? null,
    irShields: sig.ir_shields ?? sig.ir ?? null,
    emShields: sig.em_shields ?? sig.em ?? null,
  };
}

function readIndex() {
  if (!cacheDir) return null;
  try {
    return JSON.parse(fs.readFileSync(indexPath(), "utf8"));
  } catch {
    return null;
  }
}

function writeIndex(payload) {
  if (!cacheDir) return;
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(indexPath(), JSON.stringify(payload, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}

async function refreshFleetIndex() {
  const rows = [];
  let page = 1;
  let lastPage = 1;
  while (page <= lastPage) {
    const json = await fetchJson(`${WIKI_BASE}/vehicles?per_page=50&page=${page}`);
    lastPage = json.meta?.last_page || 1;
    for (const v of json.data || []) {
      if (!v.slug) continue;
      rows.push(compactFleetRow(v));
    }
    page += 1;
    if (page <= lastPage) await sleep(FETCH_GAP_MS);
  }
  const payload = { fetchedAt: new Date().toISOString(), rows, total: rows.length };
  writeIndex(payload);
  return payload;
}

async function getFleetIndex(options = {}) {
  const cached = readIndex();
  const stale =
    !cached?.fetchedAt ||
    Date.now() - new Date(cached.fetchedAt).getTime() > INDEX_TTL_MS;

  if (!options.forceRefresh && cached?.rows?.length && !stale) {
    return { ok: true, ...cached, stale: false };
  }

  if (!options.forceRefresh && cached?.rows?.length && stale) {
    refreshFleetIndex().catch(() => {});
    return { ok: true, ...cached, stale: true };
  }

  try {
    const fresh = await refreshFleetIndex();
    return { ok: true, ...fresh, stale: false };
  } catch (err) {
    if (cached?.rows?.length) {
      return { ok: true, ...cached, stale: true, error: err.message || String(err) };
    }
    return { ok: false, error: err.message || String(err), rows: [] };
  }
}

const SORT_COMPARE = {
  name: (a, b) => String(a.name || "").localeCompare(String(b.name || "")),
  manufacturer: (a, b) => {
    const ma = String(a.manufacturer || "ZZZ").localeCompare(String(b.manufacturer || "ZZZ"));
    if (ma !== 0) return ma;
    return String(a.name || "").localeCompare(String(b.name || ""));
  },
  hull: (a, b) => (b.hullHp ?? -1) - (a.hullHp ?? -1),
  shield: (a, b) => (b.shieldHp ?? -1) - (a.shieldHp ?? -1),
  scm: (a, b) => (b.scm ?? -1) - (a.scm ?? -1),
  cargo: (a, b) => (b.cargo ?? -1) - (a.cargo ?? -1),
  mass: (a, b) => (a.mass ?? Number.MAX_SAFE_INTEGER) - (b.mass ?? Number.MAX_SAFE_INTEGER),
  h2: (a, b) => (b.h2Capacity ?? -1) - (a.h2Capacity ?? -1),
  ir: (a, b) => (a.irShields ?? Number.MAX_SAFE_INTEGER) - (b.irShields ?? Number.MAX_SAFE_INTEGER),
};

function queryFleetCompare(options = {}) {
  const index = options.index;
  if (!index?.rows?.length) return { rows: [], total: 0, meta: index?.fetchedAt ? { fetchedAt: index.fetchedAt, stale: index.stale } : null };

  const query = String(options.query || "")
    .trim()
    .toLowerCase();
  const sort = SORT_COMPARE[options.sort] ? options.sort : "hull";
  const offset = Math.max(Number(options.offset) || 0, 0);
  const limit = Math.min(Math.max(Number(options.limit) || 60, 1), 120);

  let rows = index.rows;
  if (query) {
    rows = rows.filter((r) => {
      const hay = `${r.name || ""} ${r.manufacturer || ""} ${r.role || ""} ${r.slug || ""}`.toLowerCase();
      return hay.includes(query);
    });
  }

  rows = [...rows].sort(SORT_COMPARE[sort]);
  const total = rows.length;
  const page = rows.slice(offset, offset + limit);

  return {
    rows: page,
    total,
    offset,
    limit,
    meta: {
      fetchedAt: index.fetchedAt,
      stale: index.stale,
      indexTotal: index.total,
      sort,
    },
  };
}

async function getFleetCompare(options = {}) {
  const index = await getFleetIndex({ forceRefresh: options.forceRefresh });
  if (!index.ok) return index;
  const result = queryFleetCompare({ ...options, index });
  return { ok: true, ...result };
}

function buildFleetLookup(index) {
  const bySlug = new Map();
  const byClass = new Map();
  for (const row of index?.rows || []) {
    if (row.slug) bySlug.set(String(row.slug).toLowerCase(), row);
    if (row.className) byClass.set(String(row.className).toLowerCase(), row);
  }
  return { bySlug, byClass };
}

function lookupFleetRow(vehicle, lookup) {
  if (!vehicle || !lookup) return null;
  const slug = String(vehicle.slug || "").toLowerCase();
  const className = String(vehicle.className || "").toLowerCase();
  return (
    (slug && lookup.bySlug.get(slug)) ||
    (className && lookup.byClass.get(className)) ||
    null
  );
}

function enrichVehicleRow(vehicle, lookup) {
  const fleet = lookupFleetRow(vehicle, lookup);
  if (!fleet) return vehicle;
  return {
    ...vehicle,
    hullHp: fleet.hullHp ?? vehicle.hullHp ?? null,
    shieldHp: fleet.shieldHp ?? vehicle.shieldHp ?? null,
    scm: fleet.scm ?? vehicle.scm ?? null,
    maxSpeed: fleet.maxSpeed ?? vehicle.maxSpeed ?? null,
    h2Capacity: fleet.h2Capacity ?? vehicle.h2Capacity ?? null,
    qtFuel: fleet.qtFuel ?? vehicle.qtFuel ?? null,
    cargo: vehicle.cargo ?? fleet.cargo ?? null,
    mass: fleet.mass ?? vehicle.mass ?? null,
    irShields: fleet.irShields ?? vehicle.irShields ?? null,
    emShields: fleet.emShields ?? vehicle.emShields ?? null,
    role: fleet.role ?? vehicle.role ?? null,
    fleetSize: fleet.size ?? vehicle.size ?? null,
  };
}

function enrichVehicleRows(rows, index) {
  if (!rows?.length || !index?.rows?.length) return rows || [];
  const lookup = buildFleetLookup(index);
  return rows.map((row) => enrichVehicleRow(row, lookup));
}

async function enrichVehicleFromIndex(vehicle) {
  if (!vehicle) return vehicle;
  const index = await getFleetIndex();
  if (!index.ok) return vehicle;
  return enrichVehicleRow(vehicle, buildFleetLookup(index));
}

function vehicleHaystack(row) {
  return `${row.name || ""} ${row.manufacturer || ""} ${row.slug || ""} ${row.className || ""} ${row.role || ""}`.toLowerCase();
}

function matchesVehicleQuery(row, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = vehicleHaystack(row);
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => hay.includes(t));
}

async function lookupVehicleBySlugGuess(query) {
  const raw = String(query || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "");
  if (!raw) return null;
  const slugPart = raw.replace(/\s+/g, "-");
  const prefixes = ["orig", "crus", "aegs", "misc", "anvl", "drak", "rsi", "cnst", "gama"];
  const candidates = new Set([
    slugPart,
    `orig-${slugPart}`,
    `crus-${slugPart}`,
    `aegs-${slugPart}`,
    `misc-${slugPart}`,
    `anvl-${slugPart}`,
    `drak-${slugPart}`,
  ]);
  for (const prefix of prefixes) {
    candidates.add(`${prefix}-${slugPart}`);
    candidates.add(`${prefix}-starlifter-${slugPart}`);
  }
  for (const slug of candidates) {
    try {
      const json = await fetchJson(`${WIKI_BASE}/vehicles/${encodeURIComponent(slug)}`);
      if (json.data?.slug) return compactFleetRow(json.data);
    } catch {
      /* try next slug */
    }
  }
  return null;
}

async function searchFleetVehicles(query, options = {}) {
  const q = String(query || "").trim();
  if (!q) return { ok: true, rows: [], source: "empty" };

  let index = await getFleetIndex(options);
  if (!index.ok || !index.rows?.length) {
    index = await getFleetIndex({ forceRefresh: true });
  }

  let rows = (index.rows || []).filter((r) => matchesVehicleQuery(r, q));
  if (rows.length) {
    return { ok: true, rows, source: "index", meta: { fetchedAt: index.fetchedAt, stale: index.stale } };
  }

  const lookedUp = await lookupVehicleBySlugGuess(q);
  if (lookedUp) {
    return { ok: true, rows: [lookedUp], source: "wiki-slug" };
  }

  return { ok: true, rows: [], source: "none", meta: { fetchedAt: index.fetchedAt, stale: index.stale } };
}

module.exports = {
  init,
  compactFleetRow,
  getFleetIndex,
  refreshFleetIndex,
  queryFleetCompare,
  getFleetCompare,
  buildFleetLookup,
  lookupFleetRow,
  enrichVehicleRow,
  enrichVehicleRows,
  enrichVehicleFromIndex,
  matchesVehicleQuery,
  searchFleetVehicles,
  lookupVehicleBySlugGuess,
};
