/** Round to one decimal like existing terminal rows. */
function roundScu(n) {
  return Math.round(Number(n) * 10) / 10;
}

/**
 * Raw UEX buy-stock fields — no blending. last = scu_buy (last report).
 * haulScu = lower of last/min when min is set (safe cap for route math).
 */
function parseTerminalStock(raw) {
  const last = Number(raw.scu_buy);
  const min = Number(raw.scu_buy_min);
  const avg = Number(raw.scu_buy_avg);
  const max = Number(raw.scu_buy_max);

  const lastScu = last > 0 ? roundScu(last) : null;
  const minScu = min > 0 ? roundScu(min) : null;
  const avgScu = avg > 0 ? roundScu(avg) : null;

  let haulScu = 0;
  if (lastScu != null && minScu != null && minScu < lastScu) {
    haulScu = minScu;
  } else if (lastScu != null) {
    haulScu = lastScu;
  } else if (avgScu != null) {
    haulScu = avgScu;
  } else if (minScu != null) {
    haulScu = minScu;
  } else if (max > 0) {
    haulScu = roundScu(max);
  }

  return {
    stockScuLast: lastScu,
    stockScuMin: minScu,
    stockScuAvg: avgScu,
    stockScu: lastScu ?? haulScu,
    haulScu,
  };
}

/** @deprecated use parseTerminalStock — returns last-reported buy SCU. */
function terminalStockScu(raw) {
  return parseTerminalStock(raw).stockScu ?? 0;
}

function parseTerminalDemand(raw) {
  const last = Number(raw.scu_sell);
  const min = Number(raw.scu_sell_min);
  const avg = Number(raw.scu_sell_avg);
  const stock = Number(raw.scu_sell_stock);

  const lastScu = last > 0 ? roundScu(last) : null;
  const minScu = min > 0 ? roundScu(min) : null;

  let haulScu = 0;
  if (lastScu != null && minScu != null && minScu < lastScu) {
    haulScu = minScu;
  } else if (lastScu != null) {
    haulScu = lastScu;
  } else if (avg > 0) {
    haulScu = roundScu(avg);
  } else if (minScu != null) {
    haulScu = minScu;
  } else if (stock > 0) {
    haulScu = roundScu(stock);
  }

  return {
    demandScuLast: lastScu,
    demandScuMin: minScu,
    demandScu: lastScu ?? haulScu,
    haulDemandScu: haulScu,
  };
}

function terminalDemandScu(raw) {
  return parseTerminalDemand(raw).demandScu ?? 0;
}

module.exports = {
  parseTerminalStock,
  parseTerminalDemand,
  terminalStockScu,
  terminalDemandScu,
  roundScu,
};
