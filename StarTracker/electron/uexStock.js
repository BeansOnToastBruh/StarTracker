/** UEX buy-side stock is SCU volume at the terminal (player purchase inventory). */
function terminalStockScu(raw) {
  const current = Number(raw.scu_buy);
  const min = Number(raw.scu_buy_min);
  const avg = Number(raw.scu_buy_avg);
  const max = Number(raw.scu_buy_max);
  if (current > 0) {
    if (min > 0 && min < current) return min;
    return current;
  }
  if (min > 0) return min;
  if (avg > 0) return avg;
  if (max > 0) return max;
  return 0;
}

/** UEX sell-side demand is SCU volume the terminal will buy from the player. */
function terminalDemandScu(raw) {
  const stock = Number(raw.scu_sell_stock);
  const current = Number(raw.scu_sell);
  const avg = Number(raw.scu_sell_avg);
  const min = Number(raw.scu_sell_min);
  if (stock > 0) return stock;
  if (current > 0) {
    if (min > 0 && min < current) return min;
    return current;
  }
  if (avg > 0) return avg;
  return 0;
}

module.exports = { terminalStockScu, terminalDemandScu };
