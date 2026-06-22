const fs = require("fs");
const { parseLine } = require("./parser");
const { LineAssembler } = require("./lineAssembler");
const { createCombatCtx } = require("./combatContext");
const { createVehicleCtx } = require("./vehicleContext");
const { createCommodityCtx } = require("./commodityHaul");
const { createSession, importEvents, snapshot } = require("./session");
const { extractTimestamp } = require("./parser");

function ingestParsedEvent(ctx, events, event) {
  if (!event) return;
  if (event.type === "meta" && event.detail?.playerNick) {
    ctx.playerNick = event.detail.playerNick;
  }
  if (event.type === "meta" && event.detail?.inUniverse) {
    ctx.inUniverse = true;
  }
  if (event.type === "contract" && event.detail?.action === "completed") {
    ctx.lastCompletedMissionId = event.detail.missionId || null;
    ctx.lastCompletedContractTitle = event.detail.title || null;
    ctx.lastCompletedAt = event.at;
  }
  events.push(event);
}

/**
 * Parse an entire Game.log file into a ended session snapshot.
 * @param {string} filePath
 */
function parseLogFileToSession(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  const ctx = {
    playerNick: null,
    inUniverse: false,
    playerGEID: null,
    ...createCombatCtx(),
    ...createVehicleCtx(),
    ...createCommodityCtx(),
  };
  const assembler = new LineAssembler();
  const events = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const assembled = assembler.push(line);
    for (const ready of assembled) {
      const parsed = parseLine(ready, ctx);
      const batch = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
      for (const event of batch) {
        ingestParsedEvent(ctx, events, event);
      }
    }
  }

  const noteEvents = events.filter((e) => e.type !== "meta");
  const startedAt =
    noteEvents.find((e) => e.at)?.at ||
    extractTimestamp(lines.find((l) => l.trim()) || "") ||
    new Date().toISOString();
  const endedAt = noteEvents.length
    ? noteEvents[noteEvents.length - 1].at
    : startedAt;

  let session = createSession({
    status: "ended",
    startedAt,
    endedAt,
    playerNick: ctx.playerNick,
    inUniverse: ctx.inUniverse,
    events: [
      {
        type: "note",
        at: startedAt,
        summary: `Imported from log archive`,
      },
    ],
  });

  importEvents(session, events);

  session.endedAt = endedAt;
  return snapshot(session);
}

module.exports = { parseLogFileToSession };
