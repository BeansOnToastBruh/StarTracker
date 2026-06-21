/** Deep links to community reference sites (SCodex, SCUnpacked, RSI Starmap, HubCitizen, OmniCore). */

function enc(value) {
  return encodeURIComponent(String(value || "").trim());
}

function wikiToolsUrl(slug) {
  const s = String(slug || "").trim();
  if (!s) return "https://starcitizen.tools/";
  return `https://starcitizen.tools/${s.replace(/^\/+/, "")}`;
}

function rsiStarmapSearch(query) {
  return `https://robertsspaceindustries.com/en/starmap/search?q=${enc(query)}`;
}

function rsiStarmapLocation(uuid) {
  if (!uuid) return rsiStarmapSearch("");
  return `https://robertsspaceindustries.com/starmap/location/${encodeURIComponent(uuid)}`;
}

function scodexSearch(query) {
  return `https://scodex.garga.net/scodex/LIVE/?search=${enc(query)}`;
}

function scodexClass(className) {
  if (!className) return scodexSearch("");
  return `https://scodex.garga.net/scodex/LIVE/data/items/${enc(className)}`;
}

function scUnpackedSearch(query) {
  return `https://scunpacked.com/?q=${enc(query)}`;
}

function scUnpackedClass(className) {
  if (!className) return scUnpackedSearch("");
  return `https://scunpacked.com/#/items/${enc(className)}`;
}

function hubCitizenPath(path) {
  return `https://hubcitizen.com/${String(path || "").replace(/^\/+/, "")}`;
}

function buildItemLinks({ name, slug, className, webUrl } = {}) {
  const label = name || slug || className || "item";
  const links = [];
  if (webUrl) {
    links.push({ id: "wiki", label: "Wiki", url: webUrl, source: "starcitizen.tools" });
  } else if (slug) {
    links.push({ id: "wiki", label: "Wiki", url: wikiToolsUrl(slug), source: "starcitizen.tools" });
  }
  if (className) {
    links.push({ id: "scodex", label: "SCodex", url: scodexClass(className), source: "scodex" });
    links.push({ id: "scunpacked", label: "SCUnpacked", url: scUnpackedClass(className), source: "scunpacked" });
  } else if (label) {
    links.push({ id: "scodex", label: "SCodex", url: scodexSearch(label), source: "scodex" });
    links.push({ id: "scunpacked", label: "SCUnpacked", url: scUnpackedSearch(label), source: "scunpacked" });
  }
  links.push({ id: "omnicore", label: "OmniCore", url: "https://lolindark.github.io/StarCitizen-OmniCore/", source: "omnicore" });
  return links;
}

function buildLocationLinks({ name, slug, uuid, webUrl, system } = {}) {
  const label = name || slug || "location";
  const links = [];
  if (webUrl) {
    links.push({ id: "wiki", label: "Wiki map", url: webUrl.replace("api.star-citizen.wiki", "starcitizen.tools"), source: "wiki-starmap" });
  } else if (slug) {
    links.push({ id: "wiki", label: "Wiki map", url: wikiToolsUrl(slug), source: "wiki-starmap" });
  }
  if (uuid) {
    links.push({ id: "rsi-starmap", label: "RSI Starmap", url: rsiStarmapLocation(uuid), source: "rsi-starmap" });
  } else {
    links.push({ id: "rsi-starmap", label: "RSI Starmap", url: rsiStarmapSearch(system ? `${label} ${system}` : label), source: "rsi-starmap" });
  }
  links.push({
    id: "hubcitizen",
    label: "HubCitizen",
    url: hubCitizenPath("commodities"),
    source: "hubcitizen",
  });
  return links;
}

function buildShipLinks({ name, slug, className } = {}) {
  const links = buildItemLinks({ name, slug, className });
  links.push({ id: "hubcitizen-loadout", label: "HubCitizen loadouts", url: hubCitizenPath("loadouts"), source: "hubcitizen" });
  links.push({ id: "erkul", label: "Erkul", url: "https://www.erkul.games/", source: "erkul" });
  return links;
}

module.exports = {
  buildItemLinks,
  buildLocationLinks,
  buildShipLinks,
  rsiStarmapSearch,
  rsiStarmapLocation,
  scodexSearch,
  scUnpackedSearch,
  hubCitizenPath,
};
