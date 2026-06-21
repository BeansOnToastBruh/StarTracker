const { snapshot } = require("./session");
const gameData = require("./gameDataResolver");
const { formatPortLabel } = require("./loadoutFormat");
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
    if (e.type === "loadout" && Array.isArray(e.detail?.items)) {
      for (const item of e.detail.items) {
        if (item.className) names.add(item.className);
      }
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
    if (e.type === "loadout" && Array.isArray(e.detail?.items)) {
      let gear = 0;
      for (const item of e.detail.items) {
        const label = labelForClassName(item.className);
        item.label = label;
        item.slotLabel = formatPortLabel(item.port);
        item.verified = isVerified(item.className);
        if (item.category !== "cosmetic") gear += 1;
      }
      e.detail.gearCount = gear;
      const reason =
        e.detail.reason === "gear_change"
          ? "Gear updated"
          : e.detail.reason === "spawn"
            ? "Spawn loadout"
            : "Loadout snapshot";
      e.summary =
        gear > 0
          ? `${reason}: ${gear} gear item${gear === 1 ? "" : "s"}`
          : `${reason} (${e.detail.items.length} attachments)`;
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
