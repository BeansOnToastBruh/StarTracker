const referenceLinks = require("./referenceLinks");
const fetchUtil = require("./fetchUtil");

const WIKI_BASE = "https://api.star-citizen.wiki/api";
const cache = new Map();
const CACHE_MS = 24 * 60 * 60 * 1000;
const systemsCache = { at: 0, value: null };

async function fetchJson(url) {
  return fetchUtil.fetchJson(url);
}

function pickBestLocation(rows, query) {
  if (!rows?.length) return null;
  const q = String(query || "").toLowerCase();
  const exact = rows.find((r) => String(r.name || "").toLowerCase() === q);
  if (exact) return exact;
  const partial = rows.find((r) => String(r.name || "").toLowerCase().includes(q) || q.includes(String(r.name || "").toLowerCase()));
  return partial || rows[0];
}

async function lookupLocation(name) {
  const key = String(name || "").trim().toLowerCase();
  if (!key || key.length < 3) return { ok: false, error: "Name too short" };

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  try {
    const json = await fetchJson(
      `${WIKI_BASE}/locations?filter[name]=${encodeURIComponent(name.trim())}&page[size]=8`
    );
    const row = pickBestLocation(json.data, name);
    if (!row) {
      const value = { ok: false, error: "Location not found", links: referenceLinks.buildLocationLinks({ name }) };
      cache.set(key, { at: Date.now(), value });
      return value;
    }

    const webUrl = row.web_url
      ? row.web_url.replace("https://api.star-citizen.wiki", "https://starcitizen.tools")
      : referenceLinks.wikiToolsUrl(row.slug);

    const value = {
      ok: true,
      location: {
        name: row.name,
        slug: row.slug,
        uuid: row.uuid,
        system: row.system || row.star?.name || null,
        parent: row.parent?.name || null,
        description: row.description || null,
        type: row.type?.name || row.radar_contact_type?.display_name || null,
        webUrl,
      },
      links: referenceLinks.buildLocationLinks({
        name: row.name,
        slug: row.slug,
        uuid: row.uuid,
        webUrl,
        system: row.system || row.star?.name,
      }),
      source: "api.star-citizen.wiki (scunpacked starmap data)",
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      links: referenceLinks.buildLocationLinks({ name }),
      source: "api.star-citizen.wiki",
    };
  }
}

/**
 * List star systems. Unlike lookupLocation, this used to have no error
 * handling at all — a network hiccup threw straight out of the IPC handler.
 * Now it falls back to the last good result (if any) instead of failing
 * the whole "Starmap" panel over a transient timeout.
 */
async function listStarSystems(limit = 12) {
  try {
    const json = await fetchJson(`${WIKI_BASE}/celestial-objects?filter[type]=STAR&page[size]=${limit}`);
    const systems = (json.data || [])
      .map((s) => {
        const name = s.name || s.designation || String(s.code || s.slug || "").split(".").pop() || "System";
        return {
          name,
          slug: s.slug || s.code,
          designation: s.designation,
          webUrl: s.web_url?.replace("https://api.star-citizen.wiki", "https://starcitizen.tools") || null,
          rsiUrl: referenceLinks.rsiStarmapSearch(name),
        };
      })
      .filter((s) => s.name);
    systemsCache.at = Date.now();
    systemsCache.value = systems;
    return systems;
  } catch (err) {
    if (systemsCache.value && Date.now() - systemsCache.at < CACHE_MS) {
      return systemsCache.value;
    }
    throw err;
  }
}

module.exports = {
  lookupLocation,
  listStarSystems,
};
