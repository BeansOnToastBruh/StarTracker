/**
 * Contract objectives: New Objective / Objective Complete roll up to mission cards.
 */
const { parseLine, parseObjectiveTitle } = require("../electron/parser");
const { createCombatCtx } = require("../electron/combatContext");
const { createSession, pushEvent, snapshot } = require("../electron/session");

const MISSION = "fbbe91b7-b9df-4649-909f-f6dcf8032ccd";

const lines = [
  `<2026-05-29T09:14:29.726Z> [Notice] <SHUDEvent_OnNotification> Added notification "Contract Accepted:  Suspect Apprehension Certification : " [67] to queue. New queue size: 1, MissionId: [${MISSION}], ObjectiveId: [] [Team_CoreGameplayFeatures][Missions][Comms]`,
  `<2026-05-29T09:14:30.599Z> [Notice] <SHUDEvent_OnNotification> Added notification "New Objective: Neutralize YuZaiMAX: " [68] to queue. New queue size: 2, MissionId: [${MISSION}], ObjectiveId: [9943915a-c815-d60a-2f44-86d5c0a9d997] [Team_CoreGameplayFeatures][Missions][Comms]`,
  `<2026-05-29T09:18:00.000Z> [Notice] <SHUDEvent_OnNotification> Added notification "Objective Complete: Neutralize YuZaiMAX: " [70] to queue. New queue size: 1, MissionId: [${MISSION}], ObjectiveId: [9943915a-c815-d60a-2f44-86d5c0a9d997] [Team_CoreGameplayFeatures][Missions][Comms]`,
  `<2026-05-29T09:18:30.000Z> [Notice] <SHUDEvent_OnNotification> Added notification "New Objective: Return to station: " [71] to queue. New queue size: 1, MissionId: [${MISSION}], ObjectiveId: [e24c31af-a44a-b5f4-35c8-86b8e515d29e] [Team_CoreGameplayFeatures][Missions][Comms]`,
];

const ctx = {
  playerNick: "BeansOnToastBruh",
  inUniverse: true,
  ...createCombatCtx(),
};
const session = createSession({ playerNick: ctx.playerNick });

for (const line of lines) {
  const parsed = parseLine(line, ctx);
  const events = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  for (const e of events) pushEvent(session, e);
}

const r = snapshot(session).rollup;
const row = r.inProgress[0];

let failed = false;

if (parseObjectiveTitle("New Objective: Neutralize YuZaiMAX: ") !== "Neutralize YuZaiMAX") {
  console.error("parseObjectiveTitle failed for New Objective");
  failed = true;
}

if (!row) {
  console.error("Expected in-progress contract");
  failed = true;
} else {
  const objs = row.objectives || [];
  if (objs.length !== 2) {
    console.error(`Expected 2 objectives, got ${objs.length}`, objs);
    failed = true;
  }
  const first = objs.find((o) => /neutralize/i.test(o.title));
  const second = objs.find((o) => /return/i.test(o.title));
  if (!first?.complete) {
    console.error("First objective should be complete");
    failed = true;
  }
  if (second?.complete) {
    console.error("Second objective should still be pending");
    failed = true;
  }
}

const objectiveEvents = session.events.filter((e) => e.type === "contract_objective");
if (objectiveEvents.length !== 3) {
  console.error(`Expected 3 contract_objective events, got ${objectiveEvents.length}`);
  failed = true;
}

if (failed) process.exit(1);

// Completed contract: objectives still pending in log should roll up as complete.
const MISSION_DONE = "c8e2f1a0-4b3d-4e5f-9a8b-7c6d5e4f3a2b";
const completeLines = [
  `<2026-05-29T10:00:00.000Z> [Notice] <SHUDEvent_OnNotification> Added notification "Contract Accepted:  Tracker Beginner's Permit Certification : " [80] to queue. New queue size: 1, MissionId: [${MISSION_DONE}], ObjectiveId: [] [Team_CoreGameplayFeatures][Missions][Comms]`,
  `<2026-05-29T10:01:00.000Z> [Notice] <SHUDEvent_OnNotification> Added notification "New Objective: Prepare to Engage Targets: " [81] to queue. New queue size: 2, MissionId: [${MISSION_DONE}], ObjectiveId: [11111111-1111-1111-1111-111111111111] [Team_CoreGameplayFeatures][Missions][Comms]`,
  `<2026-05-29T10:02:00.000Z> [Notice] <SHUDEvent_OnNotification> Added notification "New Objective: Neutralize Target: " [82] to queue. New queue size: 3, MissionId: [${MISSION_DONE}], ObjectiveId: [22222222-2222-2222-2222-222222222222] [Team_CoreGameplayFeatures][Missions][Comms]`,
  `<2026-05-29T10:30:00.000Z> [Notice] <SHUDEvent_OnNotification> Added notification "Contract Complete:  Tracker Beginner's Permit Certification : " [83] to queue. New queue size: 1, MissionId: [${MISSION_DONE}], ObjectiveId: [] [Team_CoreGameplayFeatures][Missions][Comms]`,
];

const ctx2 = {
  playerNick: "BeansOnToastBruh",
  inUniverse: true,
  ...createCombatCtx(),
};
const session2 = createSession({ playerNick: ctx2.playerNick });

for (const line of completeLines) {
  const parsed = parseLine(line, ctx2);
  const events = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  for (const e of events) pushEvent(session2, e);
}

const completedRow = snapshot(session2).rollup.completed[0];
if (!completedRow) {
  console.error("Expected completed contract for objective inference test");
  process.exit(1);
}
const doneObjs = completedRow.objectives || [];
if (doneObjs.length !== 2) {
  console.error(`Expected 2 objectives on completed contract, got ${doneObjs.length}`, doneObjs);
  process.exit(1);
}
for (const o of doneObjs) {
  if (!o.complete) {
    console.error(`Objective should be complete when contract is complete: ${o.title}`);
    process.exit(1);
  }
}

console.log("test-contract-objectives: ok");
