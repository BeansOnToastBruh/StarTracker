const { portCategory, isCosmeticPort } = require("./loadoutFormat");

const BATCH_GAP_MS = 4000;

function createLoadoutCtx() {
  return {
    batch: null,
  };
}

function isPlayerAttachment(playerName, ctx) {
  if (!playerName || !ctx.playerNick) return false;
  return playerName.toLowerCase() === ctx.playerNick.toLowerCase();
}

function finalizeLoadoutBatch(ctx) {
  const batch = ctx.batch;
  ctx.batch = null;
  if (!batch?.items?.length) return null;

  const gear = batch.items.filter((i) => !isCosmeticPort(i.port));
  const cosmetic = batch.items.filter((i) => isCosmeticPort(i.port));

  return {
    type: "loadout",
    at: batch.at,
    summary:
      gear.length > 0
        ? `Loadout: ${gear.length} gear item${gear.length === 1 ? "" : "s"} equipped`
        : `Loadout snapshot (${batch.items.length} attachments)`,
    detail: {
      reason: batch.reason || "spawn",
      items: batch.items,
      gearCount: gear.length,
      cosmeticCount: cosmetic.length,
    },
  };
}

function noteLoadoutAttachment(ctx, at, item) {
  const t = new Date(at).getTime();
  const batch = ctx.batch;

  if (
    batch &&
    batch.lastAt &&
    Number.isFinite(t) &&
    t - new Date(batch.lastAt).getTime() > BATCH_GAP_MS
  ) {
    const ev = finalizeLoadoutBatch(ctx);
    ctx.batch = { at, lastAt: at, reason: "gear_change", items: [item] };
    return ev;
  }

  if (!batch) {
    ctx.batch = { at, lastAt: at, reason: "loading", items: [item] };
    return null;
  }

  batch.items.push(item);
  batch.lastAt = at;
  return null;
}

function onPlayerSpawned(ctx, at) {
  if (ctx.batch?.items?.length) {
    ctx.batch.reason = "spawn";
    ctx.batch.at = at;
    return finalizeLoadoutBatch(ctx);
  }
  ctx.batch = null;
  return null;
}

function flushLoadoutBatch(ctx) {
  return finalizeLoadoutBatch(ctx);
}

function parseAttachmentLine(body) {
  const m = body.match(
    /<AttachmentReceived>\s*Player\[([^\]]+)\]\s*Attachment\[([^,\]]+),\s*([^,\]]+),\s*([^\]]+)\]\s*Status\[([^\]]+)\]\s*Port\[([^\]]+)\]/i
  );
  if (!m) return null;
  return {
    player: m[1],
    entityName: m[2].trim(),
    className: m[3].trim(),
    entityId: m[4].trim(),
    status: m[5].trim(),
    port: m[6].trim(),
    category: portCategory(m[6].trim()),
  };
}

module.exports = {
  createLoadoutCtx,
  isPlayerAttachment,
  noteLoadoutAttachment,
  onPlayerSpawned,
  flushLoadoutBatch,
  parseAttachmentLine,
};
