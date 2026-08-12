const assert = require("assert");
const terminalIntel = require("../electron/terminalIntel");

function sampleCommodity(overrides = {}) {
  return {
    id: 42,
    name: "Laranite",
    code: "LARA",
    kind: "Metal",
    weightScu: 1,
    priceBuy: 3000,
    priceSell: 3500,
    spread: 500,
    isIllegal: false,
    isBuyable: true,
    isSellable: true,
    isRaw: false,
    ...overrides,
  };
}

function sampleTerminal(overrides = {}) {
  return {
    terminal: "Area18 TDD",
    terminalCode: "area18_tdd",
    location: "Area18, Stanton",
    system: "Stanton",
    sellToYouPrice: 2800,
    buyFromYouPrice: 3400,
    stockScu: 200,
    demandScu: 150,
    ...overrides,
  };
}

function main() {
  const buy = sampleTerminal({ sellToYouPrice: 2500, stockScu: 100 });
  const sell = sampleTerminal({
    terminal: "Lorville TDD",
    sellToYouPrice: 0,
    buyFromYouPrice: 3600,
    demandScu: 80,
  });
  const commodity = sampleCommodity();

  const route = terminalIntel.routeFromTerminals(commodity, buy, sell, 128);
  assert.ok(route, "expected route");
  assert.strictEqual(route.commodityUnits, 80, "demand should cap units");
  assert.strictEqual(route.commodityScu, 80);
  assert.strictEqual(route.spreadPerScu, 1100);
  assert.strictEqual(route.totalProfit, 80 * 1100);
  assert.strictEqual(route.demandLimited, true);

  const stockCapped = terminalIntel.routeFromTerminals(
    commodity,
    sampleTerminal({ sellToYouPrice: 2500, stockScu: 30 }),
    sampleTerminal({ terminal: "Sell", buyFromYouPrice: 3600, demandScu: 500 }),
    128
  );
  assert.strictEqual(stockCapped.commodityUnits, 30);
  assert.strictEqual(stockCapped.stockLimited, true);

  const bestBuy = terminalIntel.bestBuyTerminal([
    sampleTerminal({ sellToYouPrice: 3000 }),
    sampleTerminal({ sellToYouPrice: 2500, terminal: "Cheap" }),
  ]);
  assert.strictEqual(bestBuy.terminal, "Cheap");

  const bestSell = terminalIntel.bestSellTerminal([
    sampleTerminal({ buyFromYouPrice: 3200 }),
    sampleTerminal({ buyFromYouPrice: 3600, terminal: "Rich" }),
  ]);
  assert.strictEqual(bestSell.terminal, "Rich");

  const shaped = terminalIntel.shapeTerminalRow({
    terminal_name: "Test TDD",
    terminal_code: "test",
    city_name: "Area18",
    star_system_name: "Stanton",
    price_buy: 2600,
    price_sell: 3400,
    scu_sell: 80,
    scu_sell_stock: 12.5,
    scu_buy_avg: 40,
    scu_buy: 40,
  });
  assert.strictEqual(shaped.terminal, "Test TDD");
  assert.strictEqual(shaped.sellToYouPrice, 2600, "price_buy is player purchase cost per SCU");
  assert.strictEqual(shaped.buyFromYouPrice, 3400, "price_sell is player sale payout per SCU");
  assert.strictEqual(shaped.stockScu, 40);
  assert.strictEqual(shaped.demandScu, 80, "prefer live demand scu_sell over inventory stock");

  const liveStock = terminalIntel.shapeTerminalRow({
    terminal_name: "Golden",
    price_buy: 100,
    scu_buy: 138,
    scu_buy_min: 12,
    scu_buy_avg: 105,
  });
  assert.strictEqual(liveStock.stockScu, 138, "live stock uses last-reported scu_buy, not historical min");

  const avgFallback = terminalIntel.shapeTerminalRow({
    terminal_name: "Avg only",
    price_buy: 100,
    scu_buy: 0,
    scu_buy_avg: 40,
    scu_buy_min: 1,
  });
  assert.strictEqual(avgFallback.stockScu, 40, "fall back to avg when last stock missing");

  const devlin = terminalIntel.shapeTerminalRow({
    terminal_name: "Devlin Scrap and Salvage",
    price_buy: 0,
    price_sell: 870000,
    scu_sell: 140,
    scu_sell_stock: 4,
  });
  assert.strictEqual(devlin.sellToYouPrice, 0);
  assert.strictEqual(devlin.buyFromYouPrice, 870000);
  assert.strictEqual(devlin.demandScu, 140, "sell demand uses scu_sell");

  const golden = terminalIntel.shapeTerminalRow({
    terminal_name: "The Golden Riviera",
    price_buy: 281500,
    price_sell: 0,
    scu_buy: 4,
    scu_buy_min: 3,
  });
  assert.strictEqual(golden.buyFromYouPrice, 0);
  assert.strictEqual(golden.sellToYouPrice, 281500);
  assert.strictEqual(golden.stockScu, 4, "show live buy stock");

  const hinted = terminalIntel.pickTerminal(
    [
      sampleTerminal({ terminal: "Wrong Place", sellToYouPrice: 100, stockScu: 999 }),
      sampleTerminal({ terminal: "The Golden Riviera", sellToYouPrice: 200, stockScu: 4 }),
    ],
    "The Golden Riviera",
    "buy"
  );
  assert.strictEqual(hinted.terminal, "The Golden Riviera");

  const noMatch = terminalIntel.pickTerminal(
    [sampleTerminal({ terminal: "Wrong Place", sellToYouPrice: 100, stockScu: 999 })],
    "Admin - Magnus Marketing",
    "buy"
  );
  assert.strictEqual(noMatch, null, "do not invent a terminal when the route hint misses");

  console.log("test-terminal-intel: OK");
}

main();
