const { snapshot } = require("./session");
const gameData = require("./gameDataResolver");
const {
  formatShopItemName,
  formatVehicleLabel,
} = require("./commerceFormat");

function collectClassNames(session) {
  const names = new Set();
  for (const e of session?.events || []) {
    if (e.type === "shop_purchase" && e.detail?.itemRaw) {
      names.add(e.detail.itemRaw);
    }
    if (e.type === "insurance" && e.detail?.shipRaw) {
      names.add(e.detail.shipRaw);
    }
  }
  return [...names];
}

function isVerified(className) {
  return !!gameData.getEntry(className)?.name;
}

function labelForClassName(className, options = {}) {
  const fromDb = gameData.formatLabel(className, options);
  if (fromDb) return fromDb;
  const entry = gameData.getEntry(className);
  if (entry?.type === "vehicle") {
    return gameData.vehicleDisplayName(entry) || formatVehicleLabel(className);
  }
  return formatShopItemName(className, options.quantity ?? null);
}

function applyLabelsToSession(session) {
  if (!session) return session;
  for (const e of session.events || []) {
    if (e.type === "shop_purchase" && e.detail?.itemRaw) {
      const label = labelForClassName(e.detail.itemRaw, {
        quantity: e.detail.quantity,
      });
      e.detail.item = label;
      e.detail.verified = isVerified(e.detail.itemRaw);
      e.summary = `Bought ${label} for ${Math.round(e.detail.price || 0).toLocaleString()} aUEC`;
    }
    if (e.type === "insurance" && e.detail?.shipRaw) {
      const label = labelForClassName(e.detail.shipRaw);
      if (label) {
        e.detail.shipName = label;
        e.detail.verified = isVerified(e.detail.shipRaw);
        e.summary = `Insurance claim: ${label}`;
      }
    }
  }
  return session;
}

async function enrichSession(session, options = {}) {
  if (!session) return session;
  const classNames = collectClassNames(session);
  await gameData.ensureAll(classNames, options);
  applyLabelsToSession(session);
  return snapshot(session);
}

module.exports = {
  collectClassNames,
  applyLabelsToSession,
  enrichSession,
  labelForClassName,
  isVerified,
};
