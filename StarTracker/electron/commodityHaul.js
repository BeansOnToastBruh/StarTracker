const { formatShopName } = require("./commerceFormat");

const PAIR_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const PENDING_TTL_MS = 120 * 1000;

function createCommodityCtx() {
  return {
    commodityPending: new Map(),
    commodityBuyLots: [],
  };
}

function formatCommodityName(raw) {
  if (!raw) return "Unknown commodity";
  let s = String(raw).trim();
  s = s.replace(/^ResourceType\./i, "");
  s = s.replace(/_/g, " ");
  s = s.replace(/([a-z])([A-Z0-9])/g, "$1 $2");
  return s.trim() || raw;
}

function commodityKey(raw) {
  return formatCommodityName(raw).toLowerCase();
}

function parseCommodityFields(body) {
  const side = /CommoditySellRequest|SendCommoditySellRequest/i.test(body)
    ? "sell"
    : /CommodityBuyRequest|SendCommodityBuyRequest/i.test(body)
      ? "buy"
      : null;
  if (!side) return null;

  const playerM = body.match(/playerId\[(\d+)\]/i);
  const shopM = body.match(/shopName\[([^\]]+)\]/i);
  const commodityM = body.match(/commodityName\[([^\]]+)\]/i);
  const priceM = body.match(/(?:client_price|totalPrice|price)\[([\d.]+)\]/i);
  const scuM = body.match(/(?:scu|quantity|amount)\[(\d+)\]/i);

  if (!playerM || !shopM || !commodityM || !priceM) return null;

  const price = Number(priceM[1]);
  const scu = scuM ? Math.max(1, Number(scuM[1]) || 1) : 1;
  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    side,
    playerId: playerM[1],
    shopRaw: shopM[1],
    shop: formatShopName(shopM[1]),
    commodityRaw: commodityM[1],
    commodity: formatCommodityName(commodityM[1]),
    priceTotal: price,
    scu,
    unitPrice: price / scu,
  };
}

function pendingKey(playerId, shopRaw, side) {
  return `${playerId}|${shopRaw}|${side}`;
}

function prunePending(ctx, at) {
  if (!ctx.commodityPending?.size) return;
  const now = new Date(at).getTime();
  for (const [key, row] of ctx.commodityPending.entries()) {
    const t = new Date(row.requestedAt).getTime();
    if (Number.isFinite(now) && Number.isFinite(t) && now - t > PENDING_TTL_MS) {
      ctx.commodityPending.delete(key);
    }
  }
}

function recordBuyLot(ctx, row, at) {
  if (!ctx.commodityBuyLots) ctx.commodityBuyLots = [];
  ctx.commodityBuyLots.push({
    key: commodityKey(row.commodityRaw),
    commodity: row.commodity,
    commodityRaw: row.commodityRaw,
    shop: row.shop,
    shopRaw: row.shopRaw,
    scuRemaining: row.scu,
    priceTotal: row.priceTotal,
    unitPrice: row.unitPrice,
    at,
  });
}

function tryEmitHaul(ctx, sellRow, sellAt, emit) {
  const key = commodityKey(sellRow.commodityRaw);
  let sellScuLeft = sellRow.scu;
  const sellUnit = sellRow.unitPrice;

  while (sellScuLeft > 0 && ctx.commodityBuyLots?.length) {
    const lotIdx = ctx.commodityBuyLots.findIndex(
      (lot) => lot.key === key && lot.scuRemaining > 0
    );
    if (lotIdx < 0) break;

    const lot = ctx.commodityBuyLots[lotIdx];
    const matchedScu = Math.min(sellScuLeft, lot.scuRemaining);
    const buyCost = Math.round(lot.unitPrice * matchedScu);
    const sellPayout = Math.round(sellUnit * matchedScu);
    const profit = sellPayout - buyCost;

    lot.scuRemaining -= matchedScu;
    if (lot.scuRemaining <= 0) ctx.commodityBuyLots.splice(lotIdx, 1);
    sellScuLeft -= matchedScu;

    const profitLabel =
      profit >= 0
        ? `+${profit.toLocaleString()} aUEC`
        : `${profit.toLocaleString()} aUEC`;
    emit({
      type: "commodity_haul",
      at: sellAt,
      summary: `Haul: ${sellRow.commodity} (${matchedScu} SCU) · ${profitLabel}`,
      detail: {
        commodity: sellRow.commodity,
        commodityRaw: sellRow.commodityRaw,
        scu: matchedScu,
        buyShop: lot.shop,
        sellShop: sellRow.shop,
        buyPriceTotal: buyCost,
        sellPriceTotal: sellPayout,
        profit,
        buyAt: lot.at,
        sellAt,
        verified: true,
      },
    });
  }
}

function appendCommodityCommerce(body, at, ctx, emit) {
  if (!ctx.commodityPending) ctx.commodityPending = new Map();
  if (!ctx.commodityBuyLots) ctx.commodityBuyLots = [];
  prunePending(ctx, at);

  const request = parseCommodityFields(body);
  if (request) {
    if (!ctx.playerGEID) ctx.playerGEID = request.playerId;
    if (request.playerId !== ctx.playerGEID) return;

    ctx.commodityPending.set(
      pendingKey(request.playerId, request.shopRaw, request.side),
      { ...request, requestedAt: at }
    );
    return;
  }

  const flowM = body.match(
    /ShopFlowResponse.*?playerId\[(\d+)\].*?shopName\[([^\]]+)\].*?result\[(\w+)\].*?type\[(Buying|Selling)\]/i
  );
  if (!flowM) return;

  const [, playerId, shopRaw, result, flowType] = flowM;
  if (!ctx.playerGEID) ctx.playerGEID = playerId;
  if (playerId !== ctx.playerGEID) return;
  if (!/^success$/i.test(result)) {
    ctx.commodityPending.delete(
      pendingKey(playerId, shopRaw, flowType === "Buying" ? "buy" : "sell")
    );
    return;
  }

  const side = flowType === "Buying" ? "buy" : "sell";
  const pending = ctx.commodityPending.get(pendingKey(playerId, shopRaw, side));
  if (!pending) return;

  ctx.commodityPending.delete(pendingKey(playerId, shopRaw, side));

  if (side === "buy") {
    recordBuyLot(ctx, pending, at);
    emit({
      type: "commodity_trade",
      at,
      summary: `Bought ${pending.scu} SCU ${pending.commodity} for ${Math.round(pending.priceTotal).toLocaleString()} aUEC`,
      detail: {
        action: "buy",
        ...pending,
        verified: true,
      },
    });
    return;
  }

  emit({
    type: "commodity_trade",
    at,
    summary: `Sold ${pending.scu} SCU ${pending.commodity} for ${Math.round(pending.priceTotal).toLocaleString()} aUEC`,
    detail: {
      action: "sell",
      ...pending,
      verified: true,
    },
  });
  tryEmitHaul(ctx, pending, at, emit);
}

module.exports = {
  createCommodityCtx,
  appendCommodityCommerce,
  formatCommodityName,
  commodityKey,
  PAIR_TIMEOUT_MS,
};
