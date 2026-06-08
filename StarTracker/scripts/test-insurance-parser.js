const fs = require("fs");
const path = require("path");
const { LineAssembler } = require("../electron/lineAssembler");
const { createCombatCtx } = require("../electron/combatContext");
const { createVehicleCtx } = require("../electron/vehicleContext");
const { parseLine } = require("../electron/parser");

const PLAYER_GEID = "5566542615073";

function parseLogFile(logPath, playerGEID = PLAYER_GEID) {
  const raw = fs.readFileSync(logPath, "utf8");
  const assembler = new LineAssembler();
  const ctx = {
    playerNick: "TestPilot",
    inUniverse: true,
    playerGEID,
    ...createCombatCtx(),
    ...createVehicleCtx(),
  };
  const insuranceEvents = [];

  for (const line of raw.split(/\r?\n/)) {
    for (const ready of assembler.push(line)) {
      const parsed = parseLine(ready, ctx);
      const events = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
      for (const event of events) {
        if (event.type === "insurance" && event.detail?.action === "claim_complete") {
          insuranceEvents.push({
            at: event.at,
            requestId: event.detail.requestId,
            shipName: event.detail.shipName,
            urn: event.detail.entitlementUrn,
          });
        }
      }
    }
  }

  return insuranceEvents;
}

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    return false;
  }
  console.log("PASS:", message);
  return true;
}

const logDir =
  "C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\logbackups";
const may01 = path.join(
  logDir,
  "Game Build(11715810) 01 May 26 (00 00 06).log"
);
const may02 = path.join(
  logDir,
  "Game Build(11715810) 02 May 26 (23 29 59).log"
);

if (!fs.existsSync(may01) || !fs.existsSync(may02)) {
  console.error("Game.log backups not found; skipping log verification.");
  process.exit(0);
}

const may01Claims = parseLogFile(may01);
assert(
  may01Claims.length === 0,
  `May 01 log: expected 0 insurance claims, got ${may01Claims.length}`
);

const may02Claims = parseLogFile(may02);
const may26Claims = may02Claims.filter((c) => c.at?.startsWith("2026-05-03T07:26"));
assert(
  may26Claims.length === 2,
  `May 02 log 07:26 window: expected 2 claims, got ${may26Claims.length} (${JSON.stringify(may26Claims)})`
);
assert(
  may26Claims.every((c) => c.requestId === 1 || c.requestId === 2),
  "May 02 07:26 claims should be requestId 1 and 2"
);

console.log("\nAll insurance events in May 02 log:", may02Claims.length);
for (const c of may02Claims) {
  console.log(`  ${c.at} requestId=${c.requestId} ship=${c.shipName || "(unknown)"}`);
}

process.exit(process.exitCode || 0);
