/**
 * Verifies in-progress contracts move to Abandoned only with log evidence.
 */
const { parseLine } = require("../electron/parser");
const { createSession, pushEvent, snapshot } = require("../electron/session");

const MISSION = "fbbe91b7-b9df-4649-909f-f6dcf8032ccd";

const lines = [
  `<2026-05-29T09:14:29.726Z> [Notice] <SHUDEvent_OnNotification> Added notification "Contract Accepted:  Suspect Apprehension Certification : " [67] to queue. New queue size: 1, MissionId: [${MISSION}], ObjectiveId: [] [Team_CoreGameplayFeatures][Missions][Comms]`,
  `<2026-05-29T09:20:36.077Z> [Notice] <EndMission> Ending mission for player. MissionId[${MISSION}] Player[BeansOnToastBruh] PlayerId[204771992619] CompletionType[Abandon] Reason[Player left] [Team_MissionFeatures][Missions]`,
];

const ctx = { playerNick: "BeansOnToastBruh", inUniverse: true };
const session = createSession({ playerNick: ctx.playerNick });

for (const line of lines) {
  const event = parseLine(line, ctx);
  const events = Array.isArray(event) ? event : event ? [event] : [];
  for (const e of events) pushEvent(session, e);
}

const r = snapshot(session).rollup;
const abandoned = r.abandoned || [];
const inProgress = r.inProgress || [];

let failed = false;

if (abandoned.length !== 1) {
  console.error(`Expected 1 abandoned contract, got ${abandoned.length}`);
  failed = true;
}
if (inProgress.length !== 0) {
  console.error(`Expected 0 in-progress after abandon, got ${inProgress.length}`);
  failed = true;
}
if (abandoned[0]?.missionId !== MISSION) {
  console.error(`Wrong mission id: ${abandoned[0]?.missionId}`);
  failed = true;
}
if (abandoned[0]?.abandonReason !== "Player left") {
  console.error(`Expected abandon reason "Player left", got ${abandoned[0]?.abandonReason}`);
  failed = true;
}

// Accepted-only line must stay in progress (no abandon evidence)
const session2 = createSession({ playerNick: ctx.playerNick });
const acceptOnly = parseLine(lines[0], ctx);
pushEvent(session2, acceptOnly);
const r2 = snapshot(session2).rollup;
if (r2.inProgress.length !== 1 || (r2.abandoned || []).length !== 0) {
  console.error("Accepted-only contract should remain in progress");
  failed = true;
}

if (failed) process.exit(1);
console.log("test-contract-abandon: ok");
