const { getCommoditiesCache, shapeCommodityRow } = require("./guidesHub");
const { terminalStockScu, terminalDemandScu, parseTerminalStock, parseTerminalDemand } = require("./uexStock");

const UEX_BASE = "https://api.uexcorp.space/2.0";
const terminalCache = new Map();
const TERMINAL_CACHE_MS = 10 * 60 * 1000;

function clearTerminalCache() {
  terminalCache.clear();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "StarTracker/1.0.5" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function locationLabel(row) {
  return [row.city_name, row.planet_name, row.star_system_name].filter(Boolean).join(", ");
}

function terminalPlayerPrices(raw) {
  // UEX commodities_prices + commodities_routes use the same field names as /commodities:
  // price_buy = your purchase cost per SCU at this terminal (route origin price)
  // price_sell = your sale payout per SCU at this terminal (route destination price)
  const sellToYou =
    Number(raw.price_buy) ||
    Number(raw.price_buy_avg) ||
    Number(raw.price_buy_avg_week) ||
    0;
  const buyFromYou =
    Number(raw.price_sell) ||
    Number(raw.price_sell_avg) ||
    Number(raw.price_sell_avg_week) ||
    0;
  return { sellToYou, buyFromYou };
}

function shapeTerminalRow(raw) {
  const { sellToYou, buyFromYou } = terminalPlayerPrices(raw);
  const stock = parseTerminalStock(raw);
  const demand = parseTerminalDemand(raw);
  const modified =
    Number(raw.date_modified) > 0 ? new Date(Number(raw.date_modified) * 1000).toISOString() : null;
  return {
    terminal: raw.terminal_name || "Unknown terminal",
    terminalCode: raw.terminal_code || null,
    location: locationLabel(raw),
    system: raw.star_system_name || null,
    buyFromYouPrice: buyFromYou,
    sellToYouPrice: sellToYou,
    stockScu: stock.stockScu,
    stockScuLast: stock.stockScuLast,
    stockScuMin: stock.stockScuMin,
    stockScuAvg: stock.stockScuAvg,
    haulStockScu: stock.haulScu,
    demandScu: demand.demandScu,
    demandScuLast: demand.demandScuLast,
    demandScuMin: demand.demandScuMin,
    haulDemandScu: demand.haulDemandScu,
    statusBuy: raw.status_buy,
    statusSell: raw.status_sell,
    stockUpdatedAt: modified,
  };
}

async function fetchCommodityTerminals(commodityId) {
  const id = Number(commodityId);
  if (!id) return [];
  const cached = terminalCache.get(id);
  if (cached && Date.now() - cached.at < TERMINAL_CACHE_MS) return cached.rows;

  const json = await fetchJson(`${UEX_BASE}/commodities_prices?id_commodity=${id}`);
  const rows = (json.data || []).map(shapeTerminalRow).filter((t) => t.buyFromYouPrice > 0 || t.sellToYouPrice > 0);
  terminalCache.set(id, { at: Date.now(), rows });
  return rows;
}

function normalizeHint(hint) {
  return String(hint || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function terminalMatchesHint(terminal, hint) {
  const STOP = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "when",
    "listed",
    "check",
    "varies",
    "depending",
    "patch",
    "economy",
    "select",
    "goods",
    "illegal",
    "outposts",
    "stations",
    "buyers",
    "any",
    "commodity",
    "marked",
    "uex",
    "typical",
    "areas",
    "major",
    "ports",
    "linked",
    "terminals",
  ]);
  const h = normalizeHint(hint);
  if (!h) return false;
  const hay = normalizeHint(
    `${terminal.terminal || ""} ${terminal.location || ""} ${terminal.system || ""}`
  );
  if (hay.includes(h) && h.length >= 4) return true;
  const tokens = h.split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  if (!tokens.length) return false;
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return hits >= Math.min(2, tokens.length) || (tokens.length === 1 && hits === 1);
}

function hintList(...sources) {
  const out = [];
  const seen = new Set();
  for (const source of sources) {
    const list = Array.isArray(source) ? source : [source];
    for (const item of list) {
      const s = String(item || "").trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

function pickTerminal(terminals, hints, mode) {
  if (!terminals?.length) return null;
  const modeRows =
    mode === "buy"
      ? terminals.filter((t) => t.sellToYouPrice > 0)
      : terminals.filter((t) => t.buyFromYouPrice > 0);
  if (!modeRows.length) return null;

  const list = hintList(hints);
  if (list.length) {
    for (const h of list) {
      const matched = modeRows.filter((t) => terminalMatchesHint(t, h));
      if (!matched.length) continue;
      if (mode === "buy") {
        // Prefer terminals that actually have reported stock, then cheapest.
        return matched.sort((a, b) => {
          const stockA = a.stockScu > 0 ? 1 : 0;
          const stockB = b.stockScu > 0 ? 1 : 0;
          if (stockB !== stockA) return stockB - stockA;
          return a.sellToYouPrice - b.sellToYouPrice;
        })[0];
      }
      return matched.sort((a, b) => {
        const demandA = a.demandScu > 0 ? 1 : 0;
        const demandB = b.demandScu > 0 ? 1 : 0;
        if (demandB !== demandA) return demandB - demandA;
        return b.buyFromYouPrice - a.buyFromYouPrice;
      })[0];
    }
    // Hint was provided but nothing matched — do not invent another terminal.
    return null;
  }
  return mode === "buy" ? bestBuyTerminal(modeRows) : bestSellTerminal(modeRows);
}

async function getSmugglerRouteLive(route, cargoScu = 128) {
  const cache = await getCommoditiesCache(false);
  const buyHints = hintList(route.buyTerminalName, route.buyLocations);
  const sellHints = hintList(route.sellTerminalName, route.sellLocations);
  const requireHints = buyHints.length > 0 || sellHints.length > 0;

  const candidateIds = (route.commodities || [])
    .map((c) => Number(c.id))
    .filter(Boolean);
  if (!candidateIds.length && route.topCommodityId) {
    candidateIds.push(Number(route.topCommodityId));
  }

  let best = null;
  for (const id of candidateIds.slice(0, 10)) {
    const raw = (cache.rows || []).find((r) => r.id === id);
    if (!raw) continue;
    try {
      const terminals = await fetchCommodityTerminals(id);
      const buyTerminal = pickTerminal(terminals, buyHints, "buy");
      const sellTerminal = pickTerminal(terminals, sellHints, "sell");
      if (!buyTerminal || !sellTerminal) continue;
      if (buyTerminal.terminal === sellTerminal.terminal) continue;
      const shaped = raw.spread != null ? raw : shapeCommodityRow(raw);
      const result = routeFromTerminals(shaped, buyTerminal, sellTerminal, cargoScu);
      if (!result) continue;
      if (!result.commodityUnits || result.commodityUnits <= 0) continue;
      // Prefer routes that use live buy stock when comparing equal profit.
      const score = result.totalProfit + (buyTerminal.stockScu > 0 ? 0.01 : 0);
      const bestScore = best
        ? best.totalProfit + (best.buyTerminal?.stockScu > 0 ? 0.01 : 0)
        : null;
      if (!best || score > bestScore) {
        best = result;
      }
    } catch {
      /* try next commodity */
    }
  }

  if (!best && requireHints) {
    // Explicit route terminals didn't resolve — leave live block empty rather than
    // substituting unrelated UEX best-buy/best-sell terminals.
    return null;
  }
  return best;
}

function bestBuyTerminal(terminals) {
  return (
    terminals
      .filter((t) => t.sellToYouPrice > 0)
      .sort((a, b) => a.sellToYouPrice - b.sellToYouPrice)[0] || null
  );
}

function bestSellTerminal(terminals) {
  return (
    terminals
      .filter((t) => t.buyFromYouPrice > 0)
      .sort((a, b) => b.buyFromYouPrice - a.buyFromYouPrice)[0] || null
  );
}

function routeFromTerminals(commodity, buyTerminal, sellTerminal, cargoScu) {
  if (!commodity || !buyTerminal || !sellTerminal) return null;
  const weight = Number(commodity.weightScu) > 0 ? Number(commodity.weightScu) : 1;
  const cargoCap = Math.max(Number(cargoScu) || 0, 0);
  const stockCap =
    buyTerminal.haulStockScu > 0
      ? buyTerminal.haulStockScu
      : buyTerminal.stockScu > 0
        ? buyTerminal.stockScu
        : cargoCap;
  const demandCap =
    sellTerminal.haulDemandScu > 0
      ? sellTerminal.haulDemandScu
      : sellTerminal.demandScu > 0
        ? sellTerminal.demandScu
        : cargoCap;
  const haulScu = Math.max(0, Math.min(cargoCap, stockCap, demandCap));
  const units = weight > 0 ? Math.floor(haulScu / weight) : haulScu;
  const hasTerminalPrices = buyTerminal.sellToYouPrice > 0 && sellTerminal.buyFromYouPrice > 0;
  const spread = hasTerminalPrices
    ? sellTerminal.buyFromYouPrice - buyTerminal.sellToYouPrice
    : commodity.spread || 0;
  const commodityScu = units * weight;
  const invest = commodityScu * (buyTerminal.sellToYouPrice || commodity.priceBuy || 0);
  const profit = commodityScu * spread;
  return {
    commodityId: commodity.id,
    name: commodity.name,
    code: commodity.code,
    weightScu: weight,
    isIllegal: commodity.isIllegal,
    buyTerminal,
    sellTerminal,
    commodityUnits: units,
    commodityScu,
    spreadPerScu: spread,
    spreadIsEstimate: !hasTerminalPrices,
    investAuec: invest,
    totalProfit: profit,
    profitPerScu: spread,
    stockLimited: stockCap < cargoCap,
    demandLimited: demandCap < cargoCap,
  };
}

async function getCommodityTradeRoute(commodityId, cargoScu = 128) {
  const cache = await getCommoditiesCache(false);
  const commodity = (cache.rows || []).find((r) => r.id === Number(commodityId));
  if (!commodity) return { ok: false, error: "Commodity not found" };

  const terminals = await fetchCommodityTerminals(commodity.id);
  const buyTerminal = bestBuyTerminal(terminals);
  const sellTerminal = bestSellTerminal(terminals);
  const route = routeFromTerminals(
    commodity.spread != null ? commodity : shapeCommodityRow(commodity),
    buyTerminal,
    sellTerminal,
    cargoScu
  );

  return {
    ok: true,
    route,
    terminals: terminals.slice(0, 30),
    meta: { fetchedAt: cache.fetchedAt, source: "api.uexcorp.space" },
    disclaimer:
      "Buy and sell terminals, prices, and SCU stock come from UEX community reports. Stock and demand change in-game. Estimates only.",
  };
}

async function buildTerminalTradeRoutes(options = {}) {
  const cargoScu = Math.min(Math.max(Number(options.cargoScu) || 128, 1), 100000);
  const includeIllegal = !!options.includeIllegal;
  const query = String(options.query || "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(options.limit) || 40, 1), 80);

  const cache = await getCommoditiesCache(false);
  let rows = (cache.rows || [])
    .map((r) => (r.spread != null ? r : shapeCommodityRow(r)))
    .filter(
      (r) =>
        r.isBuyable &&
        r.isSellable &&
        !r.isRaw &&
        r.priceBuy > 0 &&
        r.priceSell > 0 &&
        r.spread > 0
    );
  if (!includeIllegal) rows = rows.filter((r) => !r.isIllegal);
  if (query) rows = rows.filter((r) => `${r.name} ${r.code}`.toLowerCase().includes(query));
  rows.sort((a, b) => b.spread - a.spread);

  const routes = [];
  for (const row of rows.slice(0, limit * 2)) {
    if (routes.length >= limit) break;
    try {
      const terminals = await fetchCommodityTerminals(row.id);
      const buyTerminal = bestBuyTerminal(terminals);
      const sellTerminal = bestSellTerminal(terminals);
      const route = routeFromTerminals(row, buyTerminal, sellTerminal, cargoScu);
      if (route && route.totalProfit > 0 && route.commodityUnits > 0) routes.push(route);
    } catch {
      /* skip commodity */
    }
  }

  routes.sort((a, b) => b.totalProfit - a.totalProfit || b.spreadPerScu - a.spreadPerScu);

  return {
    routes: routes.slice(0, limit),
    cargoScu,
    meta: {
      fetchedAt: cache.fetchedAt,
      stale: !!cache.stale,
      source: "api.uexcorp.space",
    },
    disclaimer:
      "Routes pair best UEX buy and sell terminals with reported stock and demand SCU. Profit is capped by the smallest of cargo, stock, and demand. Estimates only.",
  };
}

module.exports = {
  shapeTerminalRow,
  terminalPlayerPrices,
  terminalStockScu,
  terminalDemandScu,
  fetchCommodityTerminals,
  getCommodityTradeRoute,
  getSmugglerRouteLive,
  buildTerminalTradeRoutes,
  bestBuyTerminal,
  bestSellTerminal,
  routeFromTerminals,
  clearTerminalCache,
  terminalMatchesHint,
  pickTerminal,
  hintList,
};
