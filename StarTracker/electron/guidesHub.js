const fs = require("fs");
const path = require("path");
const {
  parsePatchNotesText,
  splitPatchDocument,
  isPatchNotesBody,
  comparePatchVersions,
  normalizeRsiUrl,
  wikiCommLinkUrl,
} = require("./patchNotesFormat");

const RSI_STACKED_PATCH_PAGES = [
  {
    wikiId: 21245,
    versionRe: /^4\.9(?:\.\d+)?$/,
    majorVersion: "4.9",
    url: "https://robertsspaceindustries.com/en/comm-link/Patch-Notes/21245-Star-Citizen-Alpha-49",
  },
  {
    wikiId: 21168,
    versionRe: /^4\.8(?:\.\d+)?$/,
    majorVersion: "4.8",
    url: "https://robertsspaceindustries.com/en/comm-link/Patch-Notes/21168-Star-Citizen-Alpha-48",
  },
];

const UEX_BASE = "https://api.uexcorp.space/2.0";
const WIKI_COMM_LINKS = "https://api.star-citizen.wiki/api/comm-links";

const COMMODITIES_TTL_MS = 24 * 60 * 60 * 1000;
const PATCH_NOTES_TTL_MS = 6 * 60 * 60 * 1000;
const PATCH_NOTES_CACHE_FILE = "patch-notes-cache-v3.json";

let cacheDir = null;
let seedDir = null;
let rsiPlainTextFetcher = null;

function init(options = {}) {
  cacheDir = options.cacheDir || null;
  seedDir = options.seedDir || null;
  rsiPlainTextFetcher = options.rsiPlainTextFetcher || null;
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
  if (filter === "all") {
    return row.priceBuy > 0 || row.priceSell > 0;
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
  const playerBuyPerScu =
    Number(row.price_buy) ||
    Number(row.price_buy_avg) ||
    Number(row.price_buy_avg_week) ||
    0;
  const playerSellPerScu =
    Number(row.price_sell) ||
    Number(row.price_sell_avg) ||
    Number(row.price_sell_avg_week) ||
    0;
  const { terminalStockScu, terminalDemandScu } = require("./uexStock");
  const stockScu = terminalStockScu(row);
  const demandScu = terminalDemandScu(row);
  return {
    terminal: row.terminal_name || null,
    location: location || null,
    system: row.star_system_name || null,
    priceBuy: playerBuyPerScu,
    priceSell: playerSellPerScu,
    stockScu: Math.round(stockScu * 10) / 10,
    demandScu: Math.round(demandScu * 10) / 10,
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

function isGamePatchCommLink(row) {
  const title = String(row.title || "").trim();
  const channel = String(row.channel || "");
  if (/^Star Citizen Live$/i.test(title)) return false;
  if (/Tech Talk|Roadmap Roundup|Letter from the Chairman/i.test(title)) return false;
  if (/Star Citizen Alpha \d/i.test(title)) return true;
  if (/Patch Notes/i.test(channel)) return true;
  return false;
}

function isPatchCommLink(row) {
  return isGamePatchCommLink(row);
}

function sanitizePatchNoteEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const title = String(entry.title || entry.headline || "").trim();
  if (/^Star Citizen Live$/i.test(title)) return null;
  if (!isGamePatchCommLink({ title, channel: entry.channel })) return null;
  const wikiId = entry.wikiId ?? entry.id;
  const rsiUrl = normalizeRsiUrl(entry.rsiUrl ?? entry.rsi_url, wikiId, title);
  return {
    ...entry,
    title: entry.title || title,
    rsiUrl,
  };
}

function sanitizePatchNotesRemote(remote) {
  if (!Array.isArray(remote)) return [];
  const out = [];
  for (const row of remote) {
    const clean = sanitizePatchNoteEntry(row);
    if (clean) out.push(clean);
  }
  return out;
}

function parsePatchVersion(title) {
  const m = String(title || "").match(/Alpha\s*(\d+(?:\.\d+)*)/i);
  return m ? m[1] : null;
}

async function fetchPatchNoteDetail(wikiId) {
  const json = await fetchJson(`${WIKI_COMM_LINKS}/${wikiId}`);
  const row = json.data || json;
  const body = row.translations?.en_EN || row.content || "";
  const parsed = parsePatchNotesText(body);
  return {
    bodyText: body,
    parsed,
    rsiUrl: normalizeRsiUrl(row.rsi_url, wikiId, row.title),
    wikiUrl: wikiCommLinkUrl(wikiId, row.api_public_url),
    title: row.title,
    date: row.created_at || null,
    dateHuman: row.created_at_human || null,
    channel: row.channel || null,
    series: row.series || null,
  };
}

async function fetchRsiStackedPlainText(page) {
  if (!rsiPlainTextFetcher || !page?.url) return "";
  try {
    return await rsiPlainTextFetcher(page.url);
  } catch {
    return "";
  }
}

function buildStackedPatchEntries(page, wikiDetail, rsiText) {
  const splits = splitPatchDocument(rsiText);
  if (!splits.length) return [];

  const wikiBody = wikiDetail?.bodyText || "";
  const wikiParsed = wikiDetail?.parsed || parsePatchNotesText(wikiBody);
  const rsiUrl = wikiDetail?.rsiUrl || page.url;
  const wikiUrl = wikiDetail?.wikiUrl || wikiCommLinkUrl(page.wikiId);

  const patches = splits
    .map((split) => {
      const version = split.version || parsePatchVersion(split.headline);
      if (!version || !page.versionRe.test(version)) return null;

      const useWikiBody =
        version === page.majorVersion &&
        wikiBody.length > (split.text?.length || 0) + 500;
      const parsed = useWikiBody ? wikiParsed : split.parsed;
      const intro = parsed?.intro?.length ? parsed.intro : split.parsed?.intro || [];
      const sections = parsed?.sections?.length
        ? parsed.sections
        : split.parsed?.sections || [];

      return sanitizePatchNoteEntry({
        id: `rsi-${page.wikiId}-v${version.replace(/\./g, "-")}`,
        wikiId: page.wikiId,
        title: `Star Citizen Alpha ${version}`,
        version,
        date: wikiDetail?.date || null,
        dateHuman: split.dateHuman || wikiDetail?.dateHuman || null,
        channel: "Patch Notes",
        series: wikiDetail?.series || null,
        rsiUrl,
        wikiUrl,
        headline: split.headline || `Star Citizen Alpha ${version}`,
        intro,
        sections,
        source: useWikiBody ? "rsi+star-citizen.wiki" : "rsi",
        isGamePatch: true,
      });
    })
    .filter(Boolean);

  patches.sort((a, b) => comparePatchVersions(a.version, b.version));
  return patches;
}

function stripStackedWikiDuplicates(remote, stackedPatches) {
  if (!stackedPatches?.length) return remote;
  const versions = new Set(stackedPatches.map((p) => p.version).filter(Boolean));
  const wikiIds = new Set(stackedPatches.map((p) => p.wikiId).filter(Boolean));
  return remote.filter((row) => {
    if (row?.wikiId && wikiIds.has(row.wikiId) && versions.has(row.version)) return false;
    if (row?.version && versions.has(row.version)) return false;
    return true;
  });
}

async function fetchPatchNotesRemote() {
  const json = await fetchJson(`${WIKI_COMM_LINKS}?limit=120`);
  const candidates = (json.data || []).filter(isGamePatchCommLink).slice(0, 12);
  const wikiDetailsById = new Map();
  const remote = [];
  for (const row of candidates) {
    let detail = {
      bodyText: "",
      parsed: { headline: null, intro: [], sections: [] },
      rsiUrl: null,
      wikiUrl: null,
      title: row.title,
      date: row.created_at || null,
      dateHuman: row.created_at_human || null,
      channel: row.channel || null,
      series: row.series || null,
    };
    try {
      detail = await fetchPatchNoteDetail(row.id);
    } catch {
      detail.rsiUrl = normalizeRsiUrl(row.rsi_url, row.id, row.title);
      detail.wikiUrl = wikiCommLinkUrl(row.id, row.api_public_url);
    }

    wikiDetailsById.set(Number(row.id), detail);

    if (!isPatchNotesBody(detail.bodyText)) continue;

    const sanitized = sanitizePatchNoteEntry({
      id: `wiki-${row.id}`,
      wikiId: row.id,
      title: row.title,
      version: parsePatchVersion(row.title),
      date: row.created_at || null,
      dateHuman: row.created_at_human || null,
      channel: row.channel || null,
      series: row.series || null,
      rsiUrl: detail.rsiUrl || normalizeRsiUrl(row.rsi_url, row.id, row.title),
      wikiUrl: detail.wikiUrl || wikiCommLinkUrl(row.id, row.api_public_url),
      headline: detail.parsed.headline || row.title,
      intro: detail.parsed.intro || [],
      sections: detail.parsed.sections || [],
      source: "star-citizen.wiki",
      isGamePatch: true,
    });
    if (sanitized) remote.push(sanitized);
  }

  // Also try wiki detail for known RSI stacked pages even if they weren't in the list.
  for (const page of RSI_STACKED_PATCH_PAGES) {
    if (wikiDetailsById.has(page.wikiId)) continue;
    try {
      wikiDetailsById.set(page.wikiId, await fetchPatchNoteDetail(page.wikiId));
    } catch {
      /* RSI fetch below may still succeed */
    }
  }

  const stackedPatches = [];
  for (const page of RSI_STACKED_PATCH_PAGES) {
    const rsiText = await fetchRsiStackedPlainText(page);
    const pagePatches = buildStackedPatchEntries(
      page,
      wikiDetailsById.get(page.wikiId) || null,
      rsiText
    );
    stackedPatches.push(...pagePatches);
  }

  let merged = stripStackedWikiDuplicates(remote, stackedPatches);
  if (stackedPatches.length) {
    merged = [...stackedPatches, ...merged];
  }

  merged.sort((a, b) => {
    const byVersion = comparePatchVersions(a.version, b.version);
    if (byVersion !== 0) return byVersion;
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });
  const entry = {
    fetchedAt: new Date().toISOString(),
    remote: merged,
  };
  const cp = cachePath(PATCH_NOTES_CACHE_FILE);
  if (cp) writeJsonFile(cp, entry);
  return entry;
}

async function getPatchNotesCache(force = false) {
  const cp = cachePath(PATCH_NOTES_CACHE_FILE);
  if (!force && cp) {
    const cached = readJsonFile(cp, null);
    if (cached && isFresh(cached, PATCH_NOTES_TTL_MS)) {
      return { ...cached, remote: sanitizePatchNotesRemote(cached.remote) };
    }
  }
  try {
    return await fetchPatchNotesRemote();
  } catch (err) {
    if (cp) {
      const cached = readJsonFile(cp, null);
      if (cached?.remote?.length) {
        return {
          ...cached,
          remote: sanitizePatchNotesRemote(cached.remote),
          stale: true,
          error: err.message,
        };
      }
    }
    return { fetchedAt: null, remote: [], stale: true, error: err.message };
  }
}

async function getPatchNotes(force = false) {
  const local = readSeed("patch-notes-local.json") || [];
  const cache = await getPatchNotesCache(force);
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

async function refreshPatchNotes() {
  return getPatchNotes(true);
}

function matchCommodityHint(hint, rows) {
  const h = String(hint || "").toLowerCase();
  if (!h || h.includes("any commodity") || h.includes("varies")) return rows;
  return rows.filter((r) => {
    const name = String(r.name || "").toLowerCase();
    return name.includes(h) || h.includes(name.split(" ")[0]);
  });
}

async function getSmugglerRoutes() {
  const routes = readSeed("smuggler-routes.json") || [];
  let illegalRows = [];
  try {
    const cache = await getCommoditiesCache(false);
    illegalRows = (cache.rows || [])
      .map((r) => (r.spread != null ? r : shapeCommodityRow(r)))
      .filter((r) => r.isIllegal && r.priceBuy > 0 && r.priceSell > 0 && r.spread != null);
    illegalRows.sort((a, b) => (b.spread || 0) - (a.spread || 0));
  } catch {
    illegalRows = [];
  }

  const enriched = (Array.isArray(routes) ? routes : []).map((route) => {
    let matched = [];
    for (const hint of route.commodityHints || []) {
      matched.push(...matchCommodityHint(hint, illegalRows));
    }
    const byId = new Map();
    for (const row of matched) byId.set(row.id, row);
    const commodities = [...byId.values()].sort((a, b) => (b.spread || 0) - (a.spread || 0));
    const top = commodities[0] || null;
    return {
      ...route,
      commodities: commodities.slice(0, 8).map((c) => ({
        id: c.id,
        name: c.name,
        buy: c.priceBuy,
        sell: c.priceSell,
        spread: c.spread,
        profitPerScu: c.spread,
      })),
      topSpread: top?.spread ?? null,
      topProfitPerScu: top?.spread ?? null,
    };
  });

  enriched.sort((a, b) => (b.topSpread ?? 0) - (a.topSpread ?? 0));

  return {
    routes: enriched,
    meta: {
      source: "data/guides/smuggler-routes.json + UEX illegal commodities",
      illegalCommodityCount: illegalRows.length,
    },
    disclaimer:
      "Live stock is last-reported UEX buy SCU at the route's buy terminal. Profit uses that stock plus sell-terminal demand. Community data can lag in-game inventory.",
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
  refreshPatchNotes,
  getSmugglerRoutes,
  getGameLoops,
  refreshCommodities,
  getCommoditiesCache,
};
