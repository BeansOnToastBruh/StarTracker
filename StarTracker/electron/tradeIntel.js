const { getCommoditiesCache, rowMatchesQuery, shapeCommodityRow } = require("./guidesHub");

/** How many commodity SCU fit in a cargo hold given per-unit weight. */
function commodityScuForCargo(cargoScu, weightScu) {
  const cap = Math.max(Number(cargoScu) || 0, 0);
  const w = Number(weightScu) > 0 ? Number(weightScu) : 1;
  return Math.floor(cap / w);
}

function buildTradeRow(row, cargoScu) {
  const commodityScu = commodityScuForCargo(cargoScu, row.weightScu);
  const spread = row.spread ?? 0;
  const buyCost = commodityScu * (row.priceBuy || 0);
  const grossSell = commodityScu * (row.priceSell || 0);
  const totalProfit = commodityScu * spread;
  const cargoUsed = commodityScu * (row.weightScu > 0 ? row.weightScu : 1);
  const roiPercent =
    buyCost > 0 ? Math.round((totalProfit / buyCost) * 1000) / 10 : null;

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    kind: row.kind,
    weightScu: row.weightScu,
    priceBuy: row.priceBuy,
    priceSell: row.priceSell,
    spread,
    isIllegal: row.isIllegal,
    commodityScu,
    cargoScuUsed: cargoUsed,
    investAuec: buyCost,
    grossSellAuec: grossSell,
    totalProfit,
    profitPerScu: spread,
    roiPercent,
  };
}

async function getTradeRoutes(options = {}) {
  const cargoScu = Math.min(Math.max(Number(options.cargoScu) || 128, 1), 100000);
  const includeIllegal = !!options.includeIllegal;
  const minSpread = Math.max(Number(options.minSpread) || 0, 0);
  const query = String(options.query || "").trim();
  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);
  const sort = options.sort === "spread" ? "spread" : "profit";

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
        r.spread != null &&
        r.spread > 0
    );

  if (!includeIllegal) rows = rows.filter((r) => !r.isIllegal);
  if (minSpread > 0) rows = rows.filter((r) => r.spread >= minSpread);
  if (query) rows = rows.filter((r) => rowMatchesQuery(r, query));

  let routes = rows.map((r) => buildTradeRow(r, cargoScu));
  if (sort === "spread") {
    routes.sort((a, b) => b.spread - a.spread || a.name.localeCompare(b.name));
  } else {
    routes.sort(
      (a, b) => b.totalProfit - a.totalProfit || b.spread - a.spread || a.name.localeCompare(b.name)
    );
  }

  routes = routes.slice(0, limit);

  return {
    routes,
    cargoScu,
    meta: {
      fetchedAt: cache.fetchedAt,
      stale: !!cache.stale,
      source: "api.uexcorp.space",
      totalCandidates: rows.length,
    },
    disclaimer:
      "Profit uses UEX average buy and sell per SCU, not terminal-specific pairs. Spread is sell minus buy per commodity SCU. Actual profit depends on location, stock, and travel time. Estimates only.",
  };
}

/** Popular hauler presets for quick cargo SCU selection. */
function getCargoPresets() {
  return [
    { id: "cutter", label: "Cutter", scu: 4 },
    { id: "nomad", label: "Nomad", scu: 24 },
    { id: "cutlass", label: "Cutlass Black", scu: 46 },
    { id: "freelancer", label: "Freelancer MAX", scu: 120 },
    { id: "c2", label: "C2 Hercules", scu: 696 },
    { id: "caterpillar", label: "Caterpillar", scu: 576 },
    { id: "raft", label: "RAFT", scu: 672 },
    { id: "caterpillar-custom", label: "Custom SCU", scu: null },
  ];
}

module.exports = {
  commodityScuForCargo,
  buildTradeRow,
  getTradeRoutes,
  getCargoPresets,
};
