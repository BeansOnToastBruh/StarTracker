const assert = require("assert");
const { parseLine } = require("../electron/parser");
const { createCommodityCtx } = require("../electron/commodityHaul");
const { createCombatCtx } = require("../electron/combatContext");
const { createVehicleCtx } = require("../electron/vehicleContext");
const { buildRollup } = require("../electron/rollup");
const { createSession, pushEvent, snapshot } = require("../electron/session");

const PLAYER = "204771992619";
const SHOP = "SCShop_Admin_Golden_Riviera";
const COMMODITY = "ResourceType.OsoianHides";

function line(body) {
  return `<2026-06-21T12:00:00.000Z> [Notice] ${body}`;
}

function ctx() {
  return {
    playerGEID: PLAYER,
    playerNick: "TestPilot",
    inUniverse: true,
    ...createCombatCtx(),
    ...createVehicleCtx(),
    ...createCommodityCtx(),
  };
}

function feed(body, context, session) {
  const events = parseLine(line(body), context);
  const list = Array.isArray(events) ? events : events ? [events] : [];
  for (const event of list) {
    if (event) pushEvent(session, event);
  }
  return list;
}

function buyRequest() {
  return `<CEntityComponentCommodityUIProvider::SendCommodityBuyRequest> Sending CommodityBuyRequest - playerId[${PLAYER}] shopName[${SHOP}] commodityName[${COMMODITY}] client_price[844500.000000] scu[3]`;
}

function sellRequest(shop) {
  return `<CEntityComponentCommodityUIProvider::SendCommoditySellRequest> Sending CommoditySellRequest - playerId[${PLAYER}] shopName[${shop}] commodityName[${COMMODITY}] client_price[2610000.000000] scu[3]`;
}

function flowOk(shop, type) {
  return `<CEntityComponentCommodityUIProvider::RmShopFlowResponse> Received ShopFlowResponse - playerId[${PLAYER}] shopName[${shop}] result[Success] type[${type}]`;
}

const session = createSession({ playerNick: "TestPilot" });
const c = ctx();

feed(buyRequest(), c, session);
feed(flowOk(SHOP, "Buying"), c, session);
feed(sellRequest("SCShop_Admin_Devlin"), c, session);
feed(flowOk("SCShop_Admin_Devlin", "Selling"), c, session);

const rolled = snapshot(session).rollup;
assert.equal(rolled.commodityHauls.length, 1, "expected one paired haul");
assert.equal(rolled.commodityHauls[0].commodity, "Osoian Hides");
assert.equal(rolled.commodityHauls[0].scu, 3);
assert.equal(rolled.commodityProfitTotal, 1765500);

console.log("test-commodity-haul: OK");
