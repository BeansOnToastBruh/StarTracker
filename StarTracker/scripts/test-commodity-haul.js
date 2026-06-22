const assert = require("assert");
const { parseLine } = require("../electron/parser");
const { createCommodityCtx } = require("../electron/commodityHaul");
const { createCombatCtx } = require("../electron/combatContext");
const { createVehicleCtx } = require("../electron/vehicleContext");
const { createSession, pushEvent, snapshot } = require("../electron/session");

const PLAYER = "204771992619";
const BUY_SHOP = "Admin_Area18";
const SELL_SHOP = "Admin_Lorville";

function makeCtx() {
  return {
    playerGEID: PLAYER,
    playerNick: "TestPilot",
    inUniverse: true,
    ...createCombatCtx(),
    ...createVehicleCtx(),
    ...createCommodityCtx(),
  };
}

function ts(label) {
  return `<2025-06-21T12:00:${label}Z>`;
}

function feed(ctx, session, line) {
  const parsed = parseLine(line, ctx);
  const events = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  for (const event of events) pushEvent(session, event);
  return events;
}

function commodityBuyLine(scu, price, shop = BUY_SHOP) {
  return (
    `${ts("10.000")} [Notice] <SendCommodityBuyRequest> ` +
    `playerId[${PLAYER}] shopName[${shop}] commodityName[ResourceType.Agricium] ` +
    `client_price[${price}] scu[${scu}]`
  );
}

function commoditySellLine(scu, price, shop = SELL_SHOP) {
  return (
    `${ts("20.000")} [Notice] <SendCommoditySellRequest> ` +
    `playerId[${PLAYER}] shopName[${shop}] commodityName[ResourceType.Agricium] ` +
    `client_price[${price}] scu[${scu}]`
  );
}

function flowResponse(shop, type, result = "Success", label = "30.000") {
  return (
    `${ts(label)} [Notice] <ShopFlowResponse> ` +
    `playerId[${PLAYER}] shopName[${shop}] result[${result}] type[${type}]`
  );
}

function runScenario() {
  const ctx = makeCtx();
  const session = createSession({ playerNick: "TestPilot" });

  feed(ctx, session, commodityBuyLine(10, 5000));
  feed(ctx, session, flowResponse(BUY_SHOP, "Buying", "Success", "11.000"));

  feed(ctx, session, commoditySellLine(10, 8000));
  feed(ctx, session, flowResponse(SELL_SHOP, "Selling", "Success", "21.000"));

  const rollup = snapshot(session).rollup;
  assert.strictEqual(rollup.commodityHauls.length, 1, "one completed haul");
  assert.strictEqual(rollup.commodityHauls[0].scu, 10);
  assert.strictEqual(rollup.commodityHauls[0].profit, 3000);
  assert.strictEqual(rollup.commodityProfitTotal, 3000);
  assert.strictEqual(rollup.stats.commodityHauls, 1);
  assert.strictEqual(rollup.stats.commodityProfit, 3000);

  const trades = session.events.filter((e) => e.type === "commodity_trade");
  assert.strictEqual(trades.length, 2, "buy and sell trade events");
  assert.strictEqual(trades[0].detail.action, "buy");
  assert.strictEqual(trades[1].detail.action, "sell");
}

function runPartialHaul() {
  const ctx = makeCtx();
  const session = createSession();

  feed(ctx, session, commodityBuyLine(20, 10000));
  feed(ctx, session, flowResponse(BUY_SHOP, "Buying"));
  feed(ctx, session, commoditySellLine(8, 4800));
  feed(ctx, session, flowResponse(SELL_SHOP, "Selling"));

  const rollup = snapshot(session).rollup;
  assert.strictEqual(rollup.commodityHauls.length, 1);
  assert.strictEqual(rollup.commodityHauls[0].scu, 8);
  assert.strictEqual(rollup.commodityHauls[0].profit, 800);
  assert.strictEqual(ctx.commodityBuyLots.length, 1);
  assert.strictEqual(ctx.commodityBuyLots[0].scuRemaining, 12);
}

function runRejectedFlow() {
  const ctx = makeCtx();
  const session = createSession();

  feed(ctx, session, commodityBuyLine(5, 2500));
  feed(ctx, session, flowResponse(BUY_SHOP, "Buying", "Failed"));

  const rollup = snapshot(session).rollup;
  assert.strictEqual(rollup.commodityHauls.length, 0);
  assert.strictEqual(ctx.commodityBuyLots.length, 0);
}

function runLossHaul() {
  const ctx = makeCtx();
  const session = createSession();

  feed(ctx, session, commodityBuyLine(10, 10000));
  feed(ctx, session, flowResponse(BUY_SHOP, "Buying"));
  feed(ctx, session, commoditySellLine(10, 7000));
  feed(ctx, session, flowResponse(SELL_SHOP, "Selling"));

  const rollup = snapshot(session).rollup;
  assert.strictEqual(rollup.commodityHauls[0].profit, -3000);
  assert.strictEqual(rollup.stats.commodityProfit, -3000);
}

function runShopPurchaseUntouched() {
  const ctx = makeCtx();
  const session = createSession();

  const shopLine =
    `${ts("05.000")} [Notice] <SShopBuyRequest> ` +
    `playerId[${PLAYER}] shopName[shop_astro_armada] client_price[1250.00] ` +
    `itemName[WeaponPersonal_M4A] quantity[1]`;

  feed(ctx, session, shopLine);
  const purchases = session.events.filter((e) => e.type === "shop_purchase");
  assert.strictEqual(purchases.length, 1);
  assert.strictEqual(purchases[0].detail.price, 1250);
}

runScenario();
runPartialHaul();
runRejectedFlow();
runLossHaul();
runShopPurchaseUntouched();

console.log("test-commodity-haul: all passed");
