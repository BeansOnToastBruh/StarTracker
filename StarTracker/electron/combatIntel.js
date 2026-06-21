const fs = require("fs");
const path = require("path");
const {
  formatWikiItem,
  formatVehicle,
  combatHeadline,
} = require("./combatIntelFormat");

const WIKI_BASE = "https://api.star-citizen.wiki/api";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_GAP_MS = 350;

let cacheDir = null;
let seedDir = null;
const memoryCache = new Map();

function init(options = {}) {
  cacheDir = options.cacheDir || null;
  seedDir = options.seedDir || null;
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

function classNameToSlug(className) {
  return String(className || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
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

function readSeed(name) {
  if (!seedDir) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(seedDir, name), "utf8"));
  } catch {
    return null;
  }
}

function wikiLinkForData(data) {
  const slug = data?.slug || classNameToSlug(data?.class_name);
  const wikiUrl = data?.web_url || data?.link || (slug ? `https://starcitizen.tools/${slug}` : null);
  if (!wikiUrl) return [];
  return [{ label: "Wiki page", url: wikiUrl, source: "wiki" }];
}

function externalLinksForItem(data) {
  return wikiLinkForData(data);
}

function externalLinksForVehicle(data) {
  return wikiLinkForData(data);
}

function getAdvancedExternalTools() {
  const tools = readSeed("external-tools.json") || [];
  return Array.isArray(tools) ? tools : [];
}

async function resolveWikiItem(identifier) {
  const id = String(identifier || "").trim();
  if (!id) return null;
  const memKey = `item:${id}`;
  if (memoryCache.has(memKey)) return memoryCache.get(memKey);

  const disk = readDiskCache("item", id);
  if (disk?.data) {
    memoryCache.set(memKey, disk);
    return disk;
  }

  let json = null;
  const slugCandidates = id.includes("_") ? [id, classNameToSlug(id)] : [id];
  for (const slug of slugCandidates) {
    try {
      const hit = await fetchJson(`${WIKI_BASE}/items/${encodeURIComponent(slug)}`);
      if (hit?.data) {
        json = hit;
        break;
      }
    } catch {
      /* try next slug */
    }
  }

  if (!json?.data) {
    try {
      json = await fetchJson(
        `${WIKI_BASE}/items?filter[class_name]=${encodeURIComponent(id)}&per_page=1`
      );
      const row = json?.data?.[0];
      if (row?.slug) {
        await sleep(FETCH_GAP_MS);
        json = await fetchJson(`${WIKI_BASE}/items/${encodeURIComponent(row.slug)}`);
      }
    } catch {
      json = null;
    }
  }

  const data = json?.data || null;
  if (!data) return null;

  const profile = formatWikiItem(data);
  const payload = {
    name: data.name || data.game_name,
    className: data.class_name || null,
    slug: data.slug || null,
    manufacturer: data.manufacturer?.name || null,
    size: data.size || null,
    type: data.type || null,
    profile,
    headline: combatHeadline(profile),
    externalLinks: externalLinksForItem(data),
    source: "api.star-citizen.wiki",
  };
  const entry = { data: payload };
  memoryCache.set(memKey, entry);
  writeDiskCache("item", id, entry);
  await sleep(FETCH_GAP_MS);
  return entry;
}

async function resolveWikiVehicle(identifier) {
  const id = String(identifier || "").trim();
  if (!id) return null;
  const memKey = `vehicle:${id}`;
  if (memoryCache.has(memKey)) return memoryCache.get(memKey);

  const disk = readDiskCache("vehicle", id);
  if (disk?.data) {
    memoryCache.set(memKey, disk);
    return disk;
  }

  const slugCandidates = id.includes("_") ? [id, classNameToSlug(id)] : [id];
  let json = null;
  for (const slug of slugCandidates) {
    try {
      const hit = await fetchJson(`${WIKI_BASE}/vehicles/${encodeURIComponent(slug)}`);
      if (hit?.data) {
        json = hit;
        break;
      }
    } catch {
      /* try next slug */
    }
  }

  if (!json?.data) {
    try {
      json = await fetchJson(
        `${WIKI_BASE}/vehicles?filter[class_name]=${encodeURIComponent(id)}&per_page=1`
      );
      const row = json?.data?.[0];
      if (row?.slug) {
        await sleep(FETCH_GAP_MS);
        json = await fetchJson(`${WIKI_BASE}/vehicles/${encodeURIComponent(row.slug)}`);
      }
    } catch {
      json = null;
    }
  }

  const data = json?.data || null;
  if (!data) return null;

  const profile = formatVehicle(data);
  const payload = {
    name: data.name || data.game_name,
    className: data.class_name || null,
    slug: data.slug || null,
    manufacturer: data.manufacturer?.name || null,
    profile,
    headline: combatHeadline(profile),
    externalLinks: externalLinksForVehicle(data),
    performanceSource: profile?.performanceSource || null,
    source: "api.star-citizen.wiki",
  };
  const entry = { data: payload };
  memoryCache.set(memKey, entry);
  writeDiskCache("vehicle", id, entry);
  await sleep(FETCH_GAP_MS);
  return entry;
}

async function getItemCombatProfile(options = {}) {
  const key = options.className || options.slug || options.key;
  if (!key) return { ok: false, error: "missing identifier" };
  try {
    const entry = await resolveWikiItem(key);
    if (!entry?.data) return { ok: false, error: "item not found" };
    return { ok: true, ...entry.data };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function getVehicleCombatProfile(options = {}) {
  const key = options.className || options.slug || options.key;
  if (!key) return { ok: false, error: "missing identifier" };
  try {
    const entry = await resolveWikiVehicle(key);
    if (!entry?.data) return { ok: false, error: "vehicle not found" };
    return { ok: true, ...entry.data };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function getLoadoutCombatSummary(items = []) {
  const results = [];
  for (const item of items) {
    const className = item.className || item.class_name;
    if (!className) {
      results.push({ ...item, combat: null });
      continue;
    }
    const entry = await resolveWikiItem(className);
    results.push({
      port: item.port,
      slotLabel: item.slotLabel,
      className,
      label: item.label || entry?.data?.name || className,
      category: item.category,
      combat: entry?.data
        ? {
            headline: entry.data.headline,
            kind: entry.data.profile?.kind,
            profile: entry.data.profile,
            externalLinks: entry.data.externalLinks,
          }
        : null,
    });
  }
  return { items: results };
}

function getExternalTools() {
  const tools = getAdvancedExternalTools();
  return {
    tools,
    note: "Stats in StarTracker come from the wiki datamine. External tools below are optional for heat sims, cutaways, and community rankings.",
  };
}

async function searchCombatProfiles(options = {}) {
  const query = String(options.query || "").trim();
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 40);
  if (!query) return { rows: [] };

  const json = await fetchJson(
    `${WIKI_BASE}/search/${encodeURIComponent(query)}?limit=${limit}`
  );
  const rows = [];
  for (const hit of json?.data || []) {
    const type = String(hit.type || hit.resource_type || "").toLowerCase();
    const id = hit.class_name || hit.slug || hit.identifier;
    if (!id) continue;
    rows.push({
      name: hit.name || hit.title || id,
      className: hit.class_name || null,
      slug: hit.slug || null,
      resourceType: type.includes("vehicle") ? "vehicle" : "item",
    });
  }
  return { rows: rows.slice(0, limit) };
}

module.exports = {
  init,
  getItemCombatProfile,
  getVehicleCombatProfile,
  getLoadoutCombatSummary,
  getExternalTools,
  getAdvancedExternalTools,
  searchCombatProfiles,
  combatHeadline,
};
