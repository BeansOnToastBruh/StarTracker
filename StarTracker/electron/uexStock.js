/** Round to one decimal like existing terminal rows. */
function roundScu(n) {
  return Math.round(Number(n) * 10) / 10;
}

/** Prefer reports newer than this as "fresh". */
const STOCK_FRESH_MS = 48 * 60 * 60 * 1000;
/** Beyond this, prefer week averages over a single stale last report. */
const STOCK_STALE_MS = 72 * 60 * 60 * 1000;

/** Current LIVE patch label used to prefer matching UEX rows. */
const CURRENT_LIVE_PATCH = "4.10.2";

function stockAgeMs(raw, nowMs = Date.now()) {
  const modified = Number(raw?.date_modified);
  if (!(modified > 0)) return null;
  return Math.max(0, nowMs - modified * 1000);
}

function stockAgeHours(raw, nowMs = Date.now()) {
  const ms = stockAgeMs(raw, nowMs);
  return ms == null ? null : Math.round((ms / 3600000) * 10) / 10;
}

function isStockFresh(raw, nowMs = Date.now()) {
  const ms = stockAgeMs(raw, nowMs);
  if (ms == null) return false;
  return ms <= STOCK_FRESH_MS;
}

function isStockStale(raw, nowMs = Date.now()) {
  const ms = stockAgeMs(raw, nowMs);
  // Unknown age: keep last-reported stock; only mark stale when we know it's old.
  if (ms == null) return false;
  return ms > STOCK_STALE_MS;
}

function patchVersionScore(gameVersion, current = CURRENT_LIVE_PATCH) {
  const v = String(gameVersion || "").trim();
  if (!v) return 0;
  if (v === current) return 2;
  if (v.startsWith(current.split(".").slice(0, 2).join("."))) return 1;
  return 0;
}

/**
 * Raw UEX buy-stock fields.
 * Fresh rows prefer last-reported scu_buy.
 * Stale rows prefer week/month averages so haul caps are not stuck on an old spike.
 */
function parseTerminalStock(raw, nowMs = Date.now()) {
  const last = Number(raw.scu_buy);
  const min = Number(raw.scu_buy_min);
  const avg = Number(raw.scu_buy_avg);
  const avgWeek = Number(raw.scu_buy_avg_week);
  const avgMonth = Number(raw.scu_buy_avg_month);
  const max = Number(raw.scu_buy_max);
  const users = Number(raw.scu_buy_users);

  const lastScu = last > 0 ? roundScu(last) : null;
  const minScu = min > 0 ? roundScu(min) : null;
  const avgScu = avg > 0 ? roundScu(avg) : null;
  const avgWeekScu = avgWeek > 0 ? roundScu(avgWeek) : null;
  const avgMonthScu = avgMonth > 0 ? roundScu(avgMonth) : null;
  const usersScu = users > 0 ? roundScu(users) : null;

  const stale = isStockStale(raw, nowMs);
  const fresh = isStockFresh(raw, nowMs);

  let displayScu = null;
  let haulScu = 0;
  let stockSource = null;

  if (!stale && lastScu != null) {
    displayScu = lastScu;
    stockSource = "last";
  } else if (stale && avgWeekScu != null) {
    displayScu = avgWeekScu;
    stockSource = "avg_week";
  } else if (stale && avgMonthScu != null) {
    displayScu = avgMonthScu;
    stockSource = "avg_month";
  } else if (usersScu != null) {
    displayScu = usersScu;
    stockSource = "users";
  } else if (lastScu != null) {
    displayScu = lastScu;
    stockSource = "last";
  } else if (avgWeekScu != null) {
    displayScu = avgWeekScu;
    stockSource = "avg_week";
  } else if (avgScu != null) {
    displayScu = avgScu;
    stockSource = "avg";
  } else if (minScu != null) {
    displayScu = minScu;
    stockSource = "min";
  } else if (max > 0) {
    displayScu = roundScu(max);
    stockSource = "max";
  }

  // Haul cap: when last and min both exist and min is lower, use min (safer shard).
  // On stale rows, prefer the display average, still capped by min when present.
  if (displayScu != null && minScu != null && minScu < displayScu) {
    haulScu = minScu;
  } else if (displayScu != null) {
    haulScu = displayScu;
  }

  return {
    stockScuLast: lastScu,
    stockScuMin: minScu,
    stockScuAvg: avgScu,
    stockScuAvgWeek: avgWeekScu,
    stockScu: displayScu ?? haulScu,
    haulScu,
    stockSource,
    stockFresh: fresh,
    stockStale: stale,
    stockAgeHours: stockAgeHours(raw, nowMs),
    gameVersion: raw.game_version || null,
    statusBuy: Number(raw.status_buy) || 0,
  };
}

/** @deprecated use parseTerminalStock — returns display buy SCU. */
function terminalStockScu(raw) {
  return parseTerminalStock(raw).stockScu ?? 0;
}

function parseTerminalDemand(raw, nowMs = Date.now()) {
  const last = Number(raw.scu_sell);
  const min = Number(raw.scu_sell_min);
  const avg = Number(raw.scu_sell_avg);
  const avgWeek = Number(raw.scu_sell_avg_week);
  const stock = Number(raw.scu_sell_stock);
  const stockAvg = Number(raw.scu_sell_stock_avg);

  const lastScu = last > 0 ? roundScu(last) : null;
  const minScu = min > 0 ? roundScu(min) : null;
  const avgScu = avg > 0 ? roundScu(avg) : null;
  const avgWeekScu = avgWeek > 0 ? roundScu(avgWeek) : null;
  const inventoryScu = stock > 0 ? roundScu(stock) : null;
  const inventoryAvgScu = stockAvg > 0 ? roundScu(stockAvg) : null;

  const stale = isStockStale(raw, nowMs);
  const fresh = isStockFresh(raw, nowMs);

  let displayScu = null;
  let haulScu = 0;
  let demandSource = null;

  if (!stale && lastScu != null) {
    displayScu = lastScu;
    demandSource = "last";
  } else if (stale && avgWeekScu != null) {
    displayScu = avgWeekScu;
    demandSource = "avg_week";
  } else if (lastScu != null) {
    displayScu = lastScu;
    demandSource = "last";
  } else if (avgWeekScu != null) {
    displayScu = avgWeekScu;
    demandSource = "avg_week";
  } else if (avgScu != null) {
    displayScu = avgScu;
    demandSource = "avg";
  } else if (minScu != null) {
    displayScu = minScu;
    demandSource = "min";
  } else if (inventoryScu != null) {
    displayScu = inventoryScu;
    demandSource = "inventory";
  } else if (inventoryAvgScu != null) {
    displayScu = inventoryAvgScu;
    demandSource = "inventory_avg";
  }

  if (displayScu != null && minScu != null && minScu < displayScu) {
    haulScu = minScu;
  } else if (displayScu != null) {
    haulScu = displayScu;
  }

  return {
    demandScuLast: lastScu,
    demandScuMin: minScu,
    demandScu: displayScu ?? haulScu,
    haulDemandScu: haulScu,
    demandSource,
    demandFresh: fresh,
    demandStale: stale,
    demandAgeHours: stockAgeHours(raw, nowMs),
    statusSell: Number(raw.status_sell) || 0,
  };
}

function terminalDemandScu(raw) {
  return parseTerminalDemand(raw).demandScu ?? 0;
}

/**
 * Sort key for buy terminals: stocked + fresh + current patch + cheap.
 * Higher score is better before price sort.
 */
function buyTerminalQuality(terminal) {
  let score = 0;
  if (Number(terminal.stockScu) > 0) score += 40;
  if (terminal.stockFresh) score += 20;
  else if (!terminal.stockStale) score += 8;
  score += patchVersionScore(terminal.gameVersion) * 5;
  if (Number(terminal.haulStockScu) > 0) score += 5;
  return score;
}

function sellTerminalQuality(terminal) {
  let score = 0;
  if (Number(terminal.demandScu) > 0) score += 40;
  if (terminal.demandFresh || terminal.stockFresh) score += 20;
  else if (!(terminal.demandStale || terminal.stockStale)) score += 8;
  score += patchVersionScore(terminal.gameVersion) * 5;
  if (Number(terminal.haulDemandScu) > 0) score += 5;
  return score;
}

module.exports = {
  parseTerminalStock,
  parseTerminalDemand,
  terminalStockScu,
  terminalDemandScu,
  roundScu,
  stockAgeHours,
  isStockFresh,
  isStockStale,
  buyTerminalQuality,
  sellTerminalQuality,
  patchVersionScore,
  CURRENT_LIVE_PATCH,
  STOCK_FRESH_MS,
  STOCK_STALE_MS,
};
