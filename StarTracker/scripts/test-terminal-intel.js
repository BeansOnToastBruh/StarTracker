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
    price_buy: 3400,
    price_sell: 2600,
    scu_sell_stock: 12.5,
    scu_buy_avg: 40,
  });
  assert.strictEqual(shaped.terminal, "Test TDD");
  assert.strictEqual(shaped.sellToYouPrice, 3400, "price_buy is what you pay to buy");
  assert.strictEqual(shaped.buyFromYouPrice, 2600, "price_sell is what you receive when selling");
  assert.strictEqual(shaped.stockScu, 12.5);
  assert.strictEqual(shaped.demandScu, 40);

  console.log("test-terminal-intel: OK");
}

main();
