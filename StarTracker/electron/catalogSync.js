const {
  UEX_BASE,
  WIKI_BASE,
  ALL_UEX_CATEGORY_IDS,
  WIKI_ITEM_GROUPS,
  compactListingFromUexPrice,
  compactUexItem,
  compactWikiItem,
  compactWikiVehicle,
  compactTerminal,
  buildPlacesFromTerminals,
} = require("./catalogSections");
const fetchUtil = require("./fetchUtil");

const SYNC_VERSION = 3;
const WIKI_PAGE_SIZE = 50;
const FETCH_GAP_MS = 350;

const sleep = fetchUtil.sleep;

async function fetchJson(url, options = {}) {
  return fetchUtil.fetchJson(url, { retries: options.retries ?? 2 });
}

async function fetchUexItemsByCategory(categoryId) {
  const json = await fetchJson(`${UEX_BASE}/items?id_category=${categoryId}`);
  return (json.data || []).map((row) => ({ ...row, _uexCategoryId: categoryId }));
}

async function fetchUexPricesByCategory(categoryId) {
  const json = await fetchJson(`${UEX_BASE}/items_prices?id_category=${categoryId}`);
  return json.data || [];
}

async function fetchUexTerminals() {
  const json = await fetchJson(`${UEX_BASE}/terminals`);
  return (json.data || []).map(compactTerminal);
}

async function fetchWikiVehicles(onProgress) {
  const vehicles = [];
  let page = 1;
  let lastPage = 1;
  while (page <= lastPage) {
    const json = await fetchJson(
      `${WIKI_BASE}/vehicles?per_page=${WIKI_PAGE_SIZE}&page[number]=${page}&sort=name`
    );
    lastPage = json.meta?.last_page || 1;
    for (const row of json.data || []) {
      vehicles.push(compactWikiVehicle(row));
    }
    onProgress?.({
      phase: "vehicles",
      page,
      lastPage,
      count: vehicles.length,
    });
    page += 1;
    if (page <= lastPage) await sleep(FETCH_GAP_MS);
  }
  return vehicles;
}

async function fetchWikiItemsByType(type, onProgress) {
  const items = [];
  let page = 1;
  let lastPage = 1;
  while (page <= lastPage) {
    const json = await fetchJson(
      `${WIKI_BASE}/items?filter[type]=${encodeURIComponent(type)}&per_page=${WIKI_PAGE_SIZE}&page[number]=${page}&sort=name`
    );
    lastPage = json.meta?.last_page || 1;
    for (const row of json.data || []) {
      const compact = compactWikiItem(row);
      if (compact.listings.length || compact.className) items.push(compact);
    }
    onProgress?.({
      phase: "wiki-items",
      type,
      page,
      lastPage,
      count: items.length,
    });
    page += 1;
    if (page <= lastPage) await sleep(FETCH_GAP_MS);
  }
  return items;
}

function mergeUexCatalog(items, prices) {
  const byItemId = new Map();
  for (const item of items) {
    byItemId.set(item.id, {
      ...compactUexItem(item),
      uexCategoryId: item._uexCategoryId || item.id_category || null,
    });
  }
  const listingsByItem = new Map();
  for (const price of prices) {
    const id = price.id_item;
    if (!listingsByItem.has(id)) listingsByItem.set(id, []);
    listingsByItem.get(id).push(compactListingFromUexPrice(price));
  }

  const merged = [];
  for (const [id, item] of byItemId.entries()) {
    const listings = listingsByItem.get(id) || [];
    if (!listings.length) continue;
    merged.push({
      ...item,
      uexItemId: id,
      uexCategoryId: item.uexCategoryId || null,
      listings,
      minPrice:
        listings
          .map((l) => l.priceBuy)
          .filter((p) => p != null)
          .sort((a, b) => a - b)[0] ?? null,
    });
  }
  return merged;
}

function indexByClassName(rows) {
  const map = {};
  for (const row of rows) {
    if (row.className) map[row.className] = row;
  }
  return map;
}

function buildShopIndex(allRows) {
  const byTerminal = {};
  const byItemKey = {};

  for (const row of allRows) {
    const key = row.className || `uex:${row.uexId}` || row.slug || row.name;
    if (!byItemKey[key]) {
      byItemKey[key] = {
        key,
        name: row.name,
        className: row.className || null,
        section: row.section || null,
        category: row.category || null,
        manufacturer: row.manufacturer || null,
        listings: [],
      };
    }
    for (const listing of row.listings || []) {
      byItemKey[key].listings.push(listing);
      const termKey = String(listing.terminalId || listing.terminal || "unknown");
      if (!byTerminal[termKey]) {
        byTerminal[termKey] = {
          terminalId: listing.terminalId,
          terminal: listing.terminal,
          terminalCode: listing.terminalCode,
          location: listing.location,
          system: listing.system,
          items: [],
        };
      }
      byTerminal[termKey].items.push({
        itemKey: key,
        name: row.name,
        className: row.className || null,
        section: row.section || null,
        category: row.category || null,
        priceBuy: listing.priceBuy,
        priceSell: listing.priceSell,
        priceRent: listing.priceRent || null,
      });
    }
  }

  return { byTerminal, byItemKey };
}

async function syncCatalog(onProgress) {
  const started = Date.now();
  onProgress?.({ phase: "start", message: "Fetching shop terminals…" });
  const terminals = await fetchUexTerminals();

  onProgress?.({ phase: "vehicles", message: "Syncing ships from Star Citizen Wiki…" });
  const vehicles = await fetchWikiVehicles(onProgress);

  const uexItems = [];
  const totalCats = ALL_UEX_CATEGORY_IDS.length;
  for (let i = 0; i < totalCats; i += 1) {
    const categoryId = ALL_UEX_CATEGORY_IDS[i];
    onProgress?.({
      phase: "uex",
      message: `UEX category ${categoryId} (${i + 1}/${totalCats})…`,
      current: i + 1,
      total: totalCats,
    });
    const [items, prices] = await Promise.all([
      fetchUexItemsByCategory(categoryId),
      fetchUexPricesByCategory(categoryId),
    ]);
    uexItems.push(...mergeUexCatalog(items, prices));
    await sleep(FETCH_GAP_MS);
  }

  const wikiItems = [];
  const wikiTypes = [
    ...new Set(
      Object.values(WIKI_ITEM_GROUPS).flatMap((g) => g.types)
    ),
  ];
  for (let i = 0; i < wikiTypes.length; i += 1) {
    const type = wikiTypes[i];
    onProgress?.({
      phase: "wiki-items",
      message: `Wiki items: ${type} (${i + 1}/${wikiTypes.length})…`,
      current: i + 1,
      total: wikiTypes.length,
    });
    const rows = await fetchWikiItemsByType(type, onProgress);
    wikiItems.push(...rows);
  }

  const catalogItems = [...uexItems];
  const wikiByClass = indexByClassName(wikiItems);
  for (const row of catalogItems) {
    if (row.uuid && wikiByClass[row.uuid]) {
      row.className = wikiByClass[row.uuid].className;
    }
  }
  for (const row of wikiItems) {
    if (!row.listings?.length) continue;
    const exists = catalogItems.some(
      (c) =>
        (c.className && c.className === row.className) ||
        (c.uuid && row.uuid && c.uuid === row.uuid)
    );
    if (!exists) catalogItems.push(row);
  }

  const shopIndex = buildShopIndex([...catalogItems, ...vehicles]);
  const places = buildPlacesFromTerminals(terminals);

  const meta = {
    version: SYNC_VERSION,
    syncedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    counts: {
      vehicles: vehicles.length,
      items: catalogItems.length,
      terminals: terminals.length,
      shopsWithStock: Object.keys(shopIndex.byTerminal).length,
      places: places.length,
    },
    sources: ["api.star-citizen.wiki", "api.uexcorp.space"],
  };

  return {
    meta,
    terminals,
    vehicles,
    items: catalogItems,
    shopIndex,
    places,
  };
}

module.exports = {
  SYNC_VERSION,
  syncCatalog,
  buildShopIndex,
};
