const { formatShopName } = require("./commerceFormat");

const PAIR_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const PENDING_TTL_MS = 120 * 1000;

const DEFAULT_COMMODITY_GUID_MAP = {
  "999e3149-fd10-49ac-914f-8911e61c6122": "ResourceType.Bexalite",
};

function createCommodityCtx() {
  return {
    commodityPending: new Map(),
    commodityBuyLots: [],
    commodityGuidMap: { ...DEFAULT_COMMODITY_GUID_MAP },
    commodityTradeDedupe: new Set(),
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

function resolveCommodityFromGuid(ctx, guid) {
  if (!guid) return null;
  const key = String(guid).toLowerCase();
  return ctx?.commodityGuidMap?.[key] || null;
}

function learnCommodityGuid(ctx, guid, name) {
  if (!guid || !name || !ctx) return;
  if (!ctx.commodityGuidMap) ctx.commodityGuidMap = { ...DEFAULT_COMMODITY_GUID_MAP };
  ctx.commodityGuidMap[String(guid).toLowerCase()] = name;
}

function parseCargoBoxScu(body) {
  const boxM = body.match(/boxSize\[([\d.]+)\].*?unitAmount\[(\d+)\]/i);
  if (!boxM) return null;
  const box = Number(boxM[1]);
  const units = Number(boxM[2]);
  if (!Number.isFinite(box) || !Number.isFinite(units) || box <= 0 || units <= 0) {
    return null;
  }
  const scu = box * units;
  return Number.isFinite(scu) && scu > 0 ? scu : null;
}

function parseScu(body) {
  const boxScu = parseCargoBoxScu(body);
  const cscuM = body.match(/quantity\[([\d.]+)\s*cSCU\]/i);
  if (cscuM) {
    const scu = Number(cscuM[1]) / 100;
    if (Number.isFinite(scu) && scu > 0) return scu;
  }
  const scuM = body.match(/(?:^|[^\w])scu\[(\d+)\]/i);
  if (scuM) return Math.max(1, Number(scuM[1]) || 1);
  const qtyM = body.match(/(?:^|[^\w])quantity\[([\d.]+)\]/i);
  if (qtyM) {
    const qty = Number(qtyM[1]);
    if (Number.isFinite(qty) && qty > 0) {
      if (boxScu && Math.abs(qty - boxScu) < 0.01) return boxScu;
      return qty;
    }
  }
  if (boxScu) return boxScu;
  const amountM = body.match(/(?:^|[^\w])volume\[(\d+)\]/i);
  if (amountM) return Math.max(1, Number(amountM[1]) || 1);
  return 1;
}

function isModernCommodityRequest(body) {
  return (
    /SShopCommodity(?:Buy|Sell)Request/i.test(body) || /resourceGUID\[/i.test(body)
  );
}

function parseCommodityFields(body, ctx) {
  const side = /CommoditySellRequest|SendCommoditySellRequest|SShopCommoditySellRequest/i.test(
    body
  )
    ? "sell"
    : /CommodityBuyRequest|SendCommodityBuyRequest|SShopCommodityBuyRequest/i.test(body)
      ? "buy"
      : null;
  if (!side) return null;

  const playerM = body.match(/playerId\[(\d+)\]/i);
  const shopM = body.match(/shopName\[([^\]]+)\]/i);
  const commodityM =
    body.match(/commodityName\[([^\]]+)\]/i) ||
    body.match(/commodity\[([^\]]+)\]/i) ||
    body.match(/itemName\[([^\]]+)\]/i);
  const guidM = body.match(/resourceGUID\[([^\]]+)\]/i);
  const priceM = body.match(
    /(?:client_price|totalPrice|total_price|price|amount)\[([\d.]+)\]/i
  );

  if (!playerM || !shopM || !priceM) return null;

  let commodityRaw = commodityM?.[1] || null;
  let resourceGuid = guidM?.[1] || null;
  if (!commodityRaw && resourceGuid) {
    commodityRaw = resolveCommodityFromGuid(ctx, resourceGuid) || resourceGuid;
  }
  if (!commodityRaw) return null;

  const price = Number(priceM[1]);
  const scu = parseScu(body);
  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    side,
    playerId: playerM[1],
    shopRaw: shopM[1],
    shop: formatShopName(shopM[1]),
    commodityRaw,
    commodity: formatCommodityName(commodityRaw),
    resourceGuid,
    priceTotal: price,
    scu,
    unitPrice: price / scu,
    isModern: isModernCommodityRequest(body),
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

function tradeDedupeKey(row, at) {
  const t = new Date(at).getTime();
  const bucket = Number.isFinite(t) ? Math.floor(t / 2000) : 0;
  return [
    row.side,
    row.shopRaw,
    row.resourceGuid || row.commodityRaw,
    Math.round(row.priceTotal),
    Math.round(row.scu * 100),
    bucket,
  ].join("|");
}

function shouldSkipDuplicateTrade(ctx, row, at) {
  if (!ctx.commodityTradeDedupe) ctx.commodityTradeDedupe = new Set();
  const key = tradeDedupeKey(row, at);
  if (ctx.commodityTradeDedupe.has(key)) return true;
  ctx.commodityTradeDedupe.add(key);
  if (ctx.commodityTradeDedupe.size > 400) {
    ctx.commodityTradeDedupe = new Set([key]);
  }
  return false;
}

function emitCommodityTrade(ctx, row, at, emit) {
  if (shouldSkipDuplicateTrade(ctx, row, at)) return;

  const priceLabel = Math.round(row.priceTotal).toLocaleString();
  if (row.side === "buy") {
    recordBuyLot(ctx, row, at);
    emit({
      type: "commodity_trade",
      at,
      summary: `Bought ${row.scu} SCU ${row.commodity} for ${priceLabel} aUEC`,
      detail: {
        action: "buy",
        ...row,
        verified: true,
      },
    });
    return;
  }

  emit({
    type: "commodity_trade",
    at,
    summary: `Sold ${row.scu} SCU ${row.commodity} for ${priceLabel} aUEC`,
    detail: {
      action: "sell",
      ...row,
      verified: true,
    },
  });
  tryEmitHaul(ctx, row, at, emit);
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

function trackCommodityGuidHints(body, ctx) {
  if (!ctx) return false;
  if (!/AddingCommodityBox|AddPlayerCommodityItem/i.test(body)) return false;

  const guidM = body.match(/resourceGUID\[([^\]]+)\]/i);
  if (!guidM) return false;

  const nameM =
    body.match(/commodityName\[([^\]]+)\]/i) ||
    body.match(/commodity\[([^\]]+)\]/i) ||
    body.match(/itemName\[([^\]]+)\]/i) ||
    body.match(/resourceName\[([^\]]+)\]/i);
  if (nameM) learnCommodityGuid(ctx, guidM[1], nameM[1]);
  return true;
}

function appendCommodityCommerce(body, at, ctx, emit) {
  if (!ctx.commodityPending) ctx.commodityPending = new Map();
  if (!ctx.commodityBuyLots) ctx.commodityBuyLots = [];
  if (!ctx.commodityGuidMap) ctx.commodityGuidMap = { ...DEFAULT_COMMODITY_GUID_MAP };
  prunePending(ctx, at);

  if (trackCommodityGuidHints(body, ctx) && !/Commodity(?:Buy|Sell)Request/i.test(body)) {
    return;
  }

  const request = parseCommodityFields(body, ctx);
  if (request) {
    if (!ctx.playerGEID) ctx.playerGEID = request.playerId;
    if (request.playerId !== ctx.playerGEID) return;

    if (request.isModern) {
      emitCommodityTrade(ctx, request, at, emit);
      return;
    }

    ctx.commodityPending.set(
      pendingKey(request.playerId, request.shopRaw, request.side),
      { ...request, requestedAt: at }
    );
    return;
  }

  if (!/ShopFlowResponse/i.test(body)) return;

  const playerM = body.match(/playerId\[(\d+)\]/i);
  const shopM = body.match(/shopName\[([^\]]+)\]/i);
  const resultM =
    body.match(/result\[(\w+)\]/i) || body.match(/result[=:\s]+(\w+)/i);
  const typeM =
    body.match(/type\[(Buying|Selling)\]/i) ||
    body.match(/type[=:\s]+(Buying|Selling)/i);
  if (!playerM || !shopM || !resultM || !typeM) return;

  const playerId = playerM[1];
  const shopRaw = shopM[1];
  const result = resultM[1];
  const flowType = typeM[1];
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
  emitCommodityTrade(ctx, pending, at, emit);
}

module.exports = {
  createCommodityCtx,
  appendCommodityCommerce,
  formatCommodityName,
  commodityKey,
  parseCommodityFields,
  DEFAULT_COMMODITY_GUID_MAP,
  PAIR_TIMEOUT_MS,
};
