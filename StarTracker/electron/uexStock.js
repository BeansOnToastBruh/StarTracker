/** UEX buy-side stock is SCU volume available to purchase (last reported). */
function terminalStockScu(raw) {
  const current = Number(raw.scu_buy);
  const avg = Number(raw.scu_buy_avg);
  const min = Number(raw.scu_buy_min);
  const max = Number(raw.scu_buy_max);
  // Prefer last-reported live stock. Min/avg are historical, not "live".
  if (current > 0) return current;
  if (avg > 0) return avg;
  if (min > 0) return min;
  if (max > 0) return max;
  return 0;
}

/**
 * UEX sell-side demand: how much SCU the terminal will buy from the player.
 * scu_sell is forecasted demand; scu_sell_stock is reported inventory (fallback only).
 */
function terminalDemandScu(raw) {
  const current = Number(raw.scu_sell);
  const avg = Number(raw.scu_sell_avg);
  const min = Number(raw.scu_sell_min);
  const stock = Number(raw.scu_sell_stock);
  if (current > 0) return current;
  if (avg > 0) return avg;
  if (min > 0) return min;
  if (stock > 0) return stock;
  return 0;
}

module.exports = { terminalStockScu, terminalDemandScu };
