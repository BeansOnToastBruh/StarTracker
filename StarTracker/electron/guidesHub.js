const fs = require("fs");
const path = require("path");

const UEX_BASE = "https://api.uexcorp.space/2.0";
const WIKI_COMM_LINKS = "https://api.star-citizen.wiki/api/comm-links";

const COMMODITIES_TTL_MS = 24 * 60 * 60 * 1000;
const PATCH_NOTES_TTL_MS = 6 * 60 * 60 * 1000;

let cacheDir = null;
let seedDir = null;

function init(options = {}) {
  cacheDir = options.cacheDir || null;
  seedDir = options.seedDir || null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, options = {}) {
  const retries = options.retries ?? 2;
  let lastErr = null;
  for (let i = 0; i <= retries; i += 1) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "StarTracker/1.0" },
      });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (i < retries) await sleep(600 * (i + 1));
    }
  }
  throw lastErr;
}

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function readSeed(name) {
  if (!seedDir) return null;
  return readJsonFile(path.join(seedDir, name), null);
}

function cachePath(name) {
  return cacheDir ? path.join(cacheDir, name) : null;
}

function isFresh(entry, ttlMs) {
  if (!entry?.fetchedAt) return false;
  return Date.now() - new Date(entry.fetchedAt).getTime() < ttlMs;
}

function shapeCommodityRow(raw) {
  const priceBuy = Number(raw.price_buy) || 0;
  const priceSell = Number(raw.price_sell) || 0;
  const spread =
    priceBuy > 0 && priceSell > 0 ? Math.max(0, priceSell - priceBuy) : null;
  return {
    id: raw.id,
    name: raw.name,
    code: raw.code || null,
    kind: raw.kind || null,
    weightScu: Number(raw.weight_scu) || 0,
    priceBuy,
    priceSell,
    spread,
    isIllegal: !!raw.is_illegal,
    isExtractable: !!raw.is_extractable,
    isHarvestable: !!raw.is_harvestable,
    isMineral: !!raw.is_mineral,
    isRefined: !!raw.is_refined,
    isRaw: !!raw.is_raw,
    isBuyable: !!raw.is_buyable,
    isSellable: !!raw.is_sellable,
    wiki: raw.wiki || null,
    gameVersion: raw.game_version || null,
  };
}

function matchesCommodityFilter(row, filter) {
  if (filter === "mining") {
    const hasSell = row.priceSell > 0;
    return (
      hasSell &&
      (row.isExtractable || row.isHarvestable || row.isMineral) &&
      !row.name.includes("(Ore)")
    );
  }
  if (filter === "illegal") {
    return row.isIllegal && (row.priceBuy > 0 || row.priceSell > 0);
  }
  if (filter === "trade") {
    return (
      row.isBuyable &&
      row.isSellable &&
      !row.isRaw &&
      (row.priceBuy > 0 || row.priceSell > 0) &&
      !row.name.includes("(Ore)")
    );
  }
  return row.priceBuy > 0 || row.priceSell > 0;
}

function rowMatchesQuery(row, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const hay = [row.name, row.code, row.kind]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function sortCommodities(rows, sort) {
  const list = [...rows];
  switch (sort) {
    case "spread":
      list.sort(
        (a, b) => (b.spread ?? -1) - (a.spread ?? -1) || a.name.localeCompare(b.name)
      );
      break;
    case "sell":
      list.sort(
        (a, b) => (b.priceSell || 0) - (a.priceSell || 0) || a.name.localeCompare(b.name)
      );
      break;
    case "buy":
      list.sort(
        (a, b) => (a.priceBuy || Infinity) - (b.priceBuy || Infinity) || a.name.localeCompare(b.name)
      );
      break;
    default:
      list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return list;
}

async function fetchCommoditiesRemote() {
  const json = await fetchJson(`${UEX_BASE}/commodities`);
  const rows = (json.data || []).map(shapeCommodityRow);
  const entry = { fetchedAt: new Date().toISOString(), rows };
  const cp = cachePath("commodities-cache.json");
  if (cp) writeJsonFile(cp, entry);
  return entry;
}

async function getCommoditiesCache(force = false) {
  const cp = cachePath("commodities-cache.json");
  if (!force && cp) {
    const cached = readJsonFile(cp, null);
    if (cached && isFresh(cached, COMMODITIES_TTL_MS)) return cached;
  }
  try {
    return await fetchCommoditiesRemote();
  } catch (err) {
    if (cp) {
      const cached = readJsonFile(cp, null);
      if (cached?.rows?.length) {
        return { ...cached, stale: true, error: err.message };
      }
    }
    throw err;
  }
}

async function getCommodityList(options = {}) {
  const {
    filter = "trade",
    query = "",
    offset = 0,
    limit = 80,
    sort = "name",
  } = options;
  const cache = await getCommoditiesCache(false);
  let rows = (cache.rows || []).filter((r) => matchesCommodityFilter(r, filter));
  rows = rows.filter((r) => rowMatchesQuery(r, query.trim()));
  rows = sortCommodities(rows, sort);
  const total = rows.length;
  const lim = Math.min(Math.max(limit, 1), 200);
  const off = Math.max(offset, 0);
  return {
    total,
    offset: off,
    limit: lim,
    rows: rows.slice(off, off + lim),
    meta: {
      fetchedAt: cache.fetchedAt,
      stale: !!cache.stale,
      source: "api.uexcorp.space",
    },
  };
}

function compactTerminalPrice(row) {
  const location = [
    row.city_name,
    row.planet_name,
    row.star_system_name,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    terminal: row.terminal_name || null,
    location: location || null,
    system: row.star_system_name || null,
    priceBuy: Number(row.price_buy) || 0,
    priceSell: Number(row.price_sell) || 0,
  };
}

async function getCommodityDetail(commodityId) {
  const id = Number(commodityId);
  if (!id) return null;
  const cache = await getCommoditiesCache(false);
  const commodity = (cache.rows || []).find((r) => r.id === id);
  if (!commodity) return null;

  let terminals = [];
  try {
    const json = await fetchJson(`${UEX_BASE}/commodities_prices?id_commodity=${id}`);
    terminals = (json.data || [])
      .map(compactTerminalPrice)
      .filter((t) => t.priceBuy > 0 || t.priceSell > 0);
  } catch {
    terminals = [];
  }

  const buyRows = terminals.filter((t) => t.priceBuy > 0);
  const sellRows = terminals.filter((t) => t.priceSell > 0);
  buyRows.sort((a, b) => a.priceBuy - b.priceBuy);
  sellRows.sort((a, b) => b.priceSell - a.priceSell);

  return {
    commodity,
    bestBuy: buyRows[0] || null,
    bestSell: sellRows[0] || null,
    terminals: terminals.slice(0, 40),
    meta: { fetchedAt: cache.fetchedAt, source: "api.uexcorp.space" },
  };
}

function isPatchCommLink(row) {
  const title = String(row.title || "");
  const channel = String(row.channel || "");
  const series = String(row.series || "");
  if (/patch notes/i.test(channel)) return true;
  if (/patch|alpha|live|update|weekly/i.test(series)) return true;
  if (/Alpha\s*\d|Patch\s*\d|This Week in Star Citizen|Live\b/i.test(title)) {
    return true;
  }
  return false;
}

async function fetchPatchNotesRemote() {
  const json = await fetchJson(`${WIKI_COMM_LINKS}?limit=40`);
  const remote = (json.data || [])
    .filter(isPatchCommLink)
    .map((row) => ({
      id: `wiki-${row.id}`,
      title: row.title,
      date: row.created_at || null,
      dateHuman: row.created_at_human || null,
      channel: row.channel || null,
      series: row.series || null,
      rsiUrl: row.rsi_url || null,
      source: "star-citizen.wiki",
    }));
  const entry = {
    fetchedAt: new Date().toISOString(),
    remote,
  };
  const cp = cachePath("patch-notes-cache.json");
  if (cp) writeJsonFile(cp, entry);
  return entry;
}

async function getPatchNotesCache(force = false) {
  const cp = cachePath("patch-notes-cache.json");
  if (!force && cp) {
    const cached = readJsonFile(cp, null);
    if (cached && isFresh(cached, PATCH_NOTES_TTL_MS)) return cached;
  }
  try {
    return await fetchPatchNotesRemote();
  } catch (err) {
    if (cp) {
      const cached = readJsonFile(cp, null);
      if (cached?.remote?.length) {
        return { ...cached, stale: true, error: err.message };
      }
    }
    return { fetchedAt: null, remote: [], stale: true, error: err.message };
  }
}

async function getPatchNotes() {
  const local = readSeed("patch-notes-local.json") || [];
  const cache = await getPatchNotesCache(false);
  return {
    local: Array.isArray(local) ? local : [],
    remote: cache.remote || [],
    meta: {
      fetchedAt: cache.fetchedAt,
      stale: !!cache.stale,
      sources: ["data/guides", "api.star-citizen.wiki"],
    },
  };
}

function getSmugglerRoutes() {
  const routes = readSeed("smuggler-routes.json");
  return {
    routes: Array.isArray(routes) ? routes : [],
    meta: { source: "data/guides/smuggler-routes.json" },
  };
}

function getGameLoops() {
  const loops = readSeed("game-loops.json");
  return {
    loops: Array.isArray(loops) ? loops : [],
    meta: { source: "data/guides/game-loops.json" },
  };
}

async function refreshCommodities() {
  return getCommoditiesCache(true);
}

module.exports = {
  init,
  shapeCommodityRow,
  matchesCommodityFilter,
  rowMatchesQuery,
  sortCommodities,
  getCommodityList,
  getCommodityDetail,
  getPatchNotes,
  getSmugglerRoutes,
  getGameLoops,
  refreshCommodities,
};
