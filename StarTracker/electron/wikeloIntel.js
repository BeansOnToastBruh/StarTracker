const fs = require("fs");
const path = require("path");

const WIKI_MISSIONS = "https://api.star-citizen.wiki/api/missions";
const CACHE_FILE = "wikelo-trades-cache-v1.json";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DETAIL_CONCURRENCY = 8;

let cacheDir = null;

function init(options = {}) {
  cacheDir = options.cacheDir || null;
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

function cachePath(name) {
  return cacheDir ? path.join(cacheDir, name) : null;
}

function isFresh(entry, ttlMs) {
  if (!entry?.fetchedAt) return false;
  return Date.now() - new Date(entry.fetchedAt).getTime() < ttlMs;
}

function formatRequirement(order) {
  const name = order?.name || "Unknown";
  const minScu = order?.min_scu;
  const maxScu = order?.max_scu;
  if (minScu != null || maxScu != null) {
    if (minScu != null && maxScu != null && minScu === maxScu) {
      return `${name} ${minScu} SCU`;
    }
    if (maxScu != null && minScu == null) return `${name} up to ${maxScu} SCU`;
    if (minScu != null && maxScu == null) return `${name} min ${minScu} SCU`;
    return `${name} ${minScu ?? "?"}–${maxScu ?? "?"} SCU`;
  }

  const minAmount = order?.min_amount;
  const maxAmount = order?.max_amount;
  if (minAmount != null && maxAmount != null && minAmount === maxAmount) {
    return `${name} ×${maxAmount}`;
  }
  if (maxAmount != null && minAmount == null) return `${name} up to ×${maxAmount}`;
  if (minAmount != null && maxAmount == null) return `${name} min ×${minAmount}`;
  return name;
}

function categorizeTrade(rewards) {
  const names = (rewards || [])
    .map((r) => String(r.name || r).toLowerCase())
    .join(" ");
  if (names.includes("favor")) return "favor";
  if (
    /\b(ship|sabre|asgard|scorpius|fortune|f8c|atls|misc|anvil|aegis|rsi)\b/.test(names) ||
    names.includes("wikelo war special") ||
    names.includes("wikelo special") ||
    names.includes("sneak special")
  ) {
    return "ships";
  }
  if (
    /\b(pistol|rifle|lmg|launcher|rocket|magazine|boomtube|coda|parallax|s71|f55|kruger|energy assault)\b/.test(
      names
    )
  ) {
    return "weapons";
  }
  if (
    /\b(arms|core|helmet|legs|backpack|armor|suit|testudo|strata|venture|ana|endo|heatwave|clanguard|ascension)\b/.test(
      names
    )
  ) {
    return "armor";
  }
  return "other";
}

function shapeLocation(loc) {
  if (!loc) return null;
  if (typeof loc === "string") return loc.trim() || null;
  const parts = [loc.name, loc.label, loc.display_name, loc.system_name]
    .filter(Boolean)
    .map((s) => String(s).trim());
  return parts[0] || null;
}

function normalizeMission(raw) {
  const hauling = raw.hauling_orders || [];
  const rewards = raw.reward_items || [];
  return {
    id: raw.uuid,
    title: raw.title || raw.debug_name || "Untitled",
    category: categorizeTrade(rewards),
    inputs: hauling.map((o) => ({
      name: o.name,
      kind: o.kind || null,
      requirement: formatRequirement(o),
      minAmount: o.min_amount ?? null,
      maxAmount: o.max_amount ?? null,
      minScu: o.min_scu ?? null,
      maxScu: o.max_scu ?? null,
      wikiUrl: o.web_url || null,
    })),
    rewards: rewards.map((r) => ({
      name: r.name,
      amount: r.amount ?? 1,
      wikiUrl: r.web_url || null,
    })),
    repRequired: raw.min_standing_name || null,
    repGain: raw.reputation_amount ?? null,
    gameVersion: raw.game_version || null,
    description: raw.description || null,
    locations: (raw.merged_locations || []).map(shapeLocation).filter(Boolean),
    wikiUrl: raw.web_url || raw.link || null,
  };
}

async function fetchMissionSummaries() {
  const rows = [];
  let page = 1;
  let lastPage = 1;
  while (page <= lastPage) {
    const url = `${WIKI_MISSIONS}?filter[mission_giver]=Wikelo&per_page=100&page[number]=${page}`;
    const json = await fetchJson(url);
    rows.push(...(json.data || []));
    lastPage = json.meta?.last_page || 1;
    page += 1;
    if (page <= lastPage) await sleep(200);
  }
  return rows;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index;
      index += 1;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function fetchMissionDetail(uuid) {
  const json = await fetchJson(`${WIKI_MISSIONS}/${uuid}`);
  return json.data || null;
}

async function fetchAllTradesRemote() {
  const summaries = await fetchMissionSummaries();
  const details = await mapWithConcurrency(summaries, DETAIL_CONCURRENCY, async (summary) => {
    try {
      const detail = await fetchMissionDetail(summary.uuid);
      return detail ? normalizeMission(detail) : null;
    } catch {
      return summary?.uuid ? normalizeMission({ ...summary, hauling_orders: summary.hauling_summary || [], reward_items: [] }) : null;
    }
  });

  const rows = details.filter(Boolean).sort((a, b) => a.title.localeCompare(b.title));
  const entry = {
    fetchedAt: new Date().toISOString(),
    rows,
  };
  const cp = cachePath(CACHE_FILE);
  if (cp) writeJsonFile(cp, entry);
  return entry;
}

async function getTradesCache(force = false) {
  const cp = cachePath(CACHE_FILE);
  if (!force && cp) {
    const cached = readJsonFile(cp, null);
    if (cached && isFresh(cached, CACHE_TTL_MS)) return cached;
  }
  try {
    return await fetchAllTradesRemote();
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

function rowMatchesQuery(row, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const hay = [
    row.title,
    row.category,
    row.repRequired,
    ...(row.inputs || []).flatMap((i) => [i.name, i.requirement]),
    ...(row.rewards || []).map((r) => r.name),
    row.description,
    ...(row.locations || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function matchesCategory(row, category) {
  if (!category || category === "all") return true;
  return row.category === category;
}

async function getTrades(options = {}) {
  const { category = "all", query = "" } = options;
  const cache = await getTradesCache(false);
  let rows = (cache.rows || []).filter((r) => matchesCategory(r, category));
  rows = rows.filter((r) => rowMatchesQuery(r, query.trim()));
  return {
    total: rows.length,
    rows,
    meta: {
      fetchedAt: cache.fetchedAt,
      stale: !!cache.stale,
      source: "api.star-citizen.wiki",
      missionGiver: "Wikelo",
    },
  };
}

async function refreshTrades(options = {}) {
  await getTradesCache(true);
  return getTrades(options);
}

module.exports = {
  init,
  fetchJson,
  formatRequirement,
  categorizeTrade,
  normalizeMission,
  getTrades,
  refreshTrades,
  CACHE_TTL_MS,
  CACHE_FILE,
};
