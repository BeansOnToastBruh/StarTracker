const fs = require("fs");
const path = require("path");

let seedDir = null;

function init(options = {}) {
  seedDir = options.seedDir || null;
}

function readSeed(name) {
  if (!seedDir) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(seedDir, name), "utf8"));
  } catch {
    return null;
  }
}

function nameHay(name) {
  return String(name || "").toLowerCase();
}

function matchesTokens(name, tokens, exclude = []) {
  const hay = nameHay(name);
  if (exclude.some((t) => hay.includes(String(t).toLowerCase()))) return false;
  return tokens.some((t) => hay.includes(String(t).toLowerCase()));
}

function findCommodityByRules(rows, rules, preferRaw) {
  return (
    rows.find((row) => {
      const hay = nameHay(row.name);
      if (preferRaw && !row.isRaw && !hay.includes("(ore)")) return false;
      if (!preferRaw && row.isRaw && hay.includes("(ore)")) return false;
      return matchesTokens(row.name, rules.match || [], rules.excludeRefined || ["ore"]);
    }) || null
  );
}

function resolveOrePair(oreType, commodities) {
  const rows = commodities || [];
  const oreRow =
    findCommodityByRules(rows, oreType, true) ||
    rows.find(
      (r) =>
        r.isRaw &&
        matchesTokens(r.name, oreType.match || [], oreType.excludeRefined || [])
    );
  const refinedRow =
    rows.find(
      (r) =>
        !r.isRaw &&
        matchesTokens(r.name, oreType.refinedMatch || oreType.match || [], ["(ore)"])
    ) || null;
  return { oreRow, refinedRow };
}

function buildOreCatalog(commodities) {
  const seed = readSeed("refinery.json") || {};
  const oreTypes = seed.oreTypes || [];
  const rows = commodities || [];
  const catalog = [];
  const usedIds = new Set();

  for (const oreType of oreTypes) {
    const { oreRow, refinedRow } = resolveOrePair(oreType, rows);
    if (!oreRow && !refinedRow) continue;
    if (oreRow?.id) usedIds.add(oreRow.id);
    if (refinedRow?.id) usedIds.add(refinedRow.id);
    catalog.push({
      id: oreType.id,
      label: oreType.id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      ore: oreRow,
      refined: refinedRow,
      defaultYieldPercent: oreType.defaultYieldPercent ?? seed.defaultYieldPercent ?? 80,
      volatile: !!oreType.volatile,
      notes: oreType.notes || null,
    });
  }

  const extras = rows.filter(
    (r) =>
      !usedIds.has(r.id) &&
      (r.isRaw || /\(ore\)/i.test(r.name || "")) &&
      (r.priceSell > 0 || r.priceBuy > 0)
  );
  for (const oreRow of extras) {
    const baseName = String(oreRow.name || "")
      .replace(/\s*\(ore\)/i, "")
      .trim();
    const refinedRow =
      rows.find(
        (r) =>
          r.id !== oreRow.id &&
          !r.isRaw &&
          String(r.name || "").toLowerCase() === baseName.toLowerCase()
      ) || null;
    catalog.push({
      id: `ore-${oreRow.id}`,
      label: baseName || oreRow.name,
      ore: oreRow,
      refined: refinedRow,
      defaultYieldPercent: seed.defaultYieldPercent ?? 80,
      volatile: /quant/i.test(baseName),
      notes: null,
    });
  }

  catalog.sort((a, b) => a.label.localeCompare(b.label));
  return catalog;
}

function calculateRefinement(options = {}) {
  const seed = readSeed("refinery.json") || {};
  const oreScu = Math.max(Number(options.oreScu) || 0, 0);
  const yieldPercent = Math.min(
    Math.max(
      options.yieldPercent != null && options.yieldPercent !== ""
        ? Number(options.yieldPercent)
        : seed.defaultYieldPercent ?? 80,
      0
    ),
    100
  );
  const feePercent = Math.max(
    options.stationFeePercent != null && options.stationFeePercent !== ""
      ? Number(options.stationFeePercent)
      : seed.defaultStationFeePercent ?? 5,
    0
  );
  const rawSellPerScu = Math.max(Number(options.rawSellPerScu) || 0, 0);
  const refinedSellPerScu = Math.max(Number(options.refinedSellPerScu) || 0, 0);

  const refinedScu = Math.round(oreScu * (yieldPercent / 100) * 100) / 100;
  const grossRaw = Math.round(oreScu * rawSellPerScu);
  const grossRefined = Math.round(refinedScu * refinedSellPerScu);
  const refineryFee = Math.round(grossRefined * (feePercent / 100));
  const netRefined = grossRefined - refineryFee;
  const profitVsRaw = netRefined - grossRaw;
  const profitPerOreScu = oreScu > 0 ? Math.round(profitVsRaw / oreScu) : 0;

  return {
    oreScu,
    yieldPercent,
    feePercent,
    refinedScu,
    grossRaw,
    grossRefined,
    refineryFee,
    netRefined,
    profitVsRaw,
    profitPerOreScu,
    worthRefining: profitVsRaw > 0,
  };
}

async function getRefineryGuide(getCommoditiesCache) {
  const seed = readSeed("refinery.json") || {};
  const cache = await getCommoditiesCache(false);
  const oreCatalog = buildOreCatalog(cache.rows || []);
  return {
    disclaimer: seed.disclaimer || null,
    defaultYieldPercent: seed.defaultYieldPercent ?? 80,
    defaultStationFeePercent: seed.defaultStationFeePercent ?? 5,
    stations: seed.stations || [],
    loopTips: seed.loopTips || [],
    oreCatalog,
    meta: {
      fetchedAt: cache.fetchedAt || null,
      stale: !!cache.stale,
      source: "data/guides/refinery.json + UEX commodities",
    },
  };
}

async function calculateRefineryRun(getCommoditiesCache, options = {}) {
  const guide = await getRefineryGuide(getCommoditiesCache);
  const oreId = String(options.oreId || "").trim();
  const entry = guide.oreCatalog.find((o) => o.id === oreId);
  if (!entry) return { ok: false, error: "unknown ore type" };

  const rawSellPerScu =
    options.rawSellPerScu != null
      ? Number(options.rawSellPerScu)
      : entry.ore?.priceSell || 0;
  const refinedSellPerScu =
    options.refinedSellPerScu != null
      ? Number(options.refinedSellPerScu)
      : entry.refined?.priceSell || 0;

  const result = calculateRefinement({
    oreScu: options.oreScu,
    yieldPercent: options.yieldPercent ?? entry.defaultYieldPercent,
    stationFeePercent: options.stationFeePercent,
    rawSellPerScu,
    refinedSellPerScu,
  });

  return {
    ok: true,
    ore: entry,
    prices: {
      rawSellPerScu,
      refinedSellPerScu,
      rawName: entry.ore?.name || null,
      refinedName: entry.refined?.name || null,
    },
    result,
  };
}

module.exports = {
  init,
  buildOreCatalog,
  calculateRefinement,
  getRefineryGuide,
  calculateRefineryRun,
};
