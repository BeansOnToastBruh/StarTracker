/**
 * Wiki payout estimates and mission marker parsing.
 */
const { parseLine } = require("../electron/parser");
const { createCombatCtx } = require("../electron/combatContext");
const { createVehicleCtx } = require("../electron/vehicleContext");
const {
  estimateAuecFromMission,
  roundToNiceAuec,
  STANDING_AUEC_MULT,
} = require("../electron/contractWiki");
const {
  maybeAddEstimatedPayout,
  buildEstimatedRewardEvent,
} = require("../electron/contractPayoutEnrichment");
const factionRepStore = require("../electron/factionRepStore");
const { createSession, pushEvent } = require("../electron/session");

const SWIFT_UUID = "5916ef35-13d3-4223-8fe3-c399a02290ce";
const MISSION = "675ee368-a6ef-4347-9203-06f99505a8fe";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    return false;
  }
  console.log("PASS:", message);
  return true;
}

function makeCtx(overrides = {}) {
  return {
    playerNick: "TestPilot",
    inUniverse: true,
    ...createCombatCtx(),
    ...createVehicleCtx(),
    ...overrides,
  };
}

// --- estimateAuecFromMission ---
const hhMission = {
  title: "A Swift Reprisal",
  rank_index: 0,
  reward_min: null,
  faction: { name: "Headhunters" },
};

assert(
  estimateAuecFromMission(hhMission, "Head Contractor").auec === 42000,
  "Headhunters rank 0 at Head Contractor estimates 42000"
);
assert(
  estimateAuecFromMission(hhMission, "Neutral").auec === 24000,
  "Headhunters rank 0 at Neutral estimates 24000"
);

const fixedMission = { title: "Test", rank_index: 0, reward_min: 15000, faction: { name: "microTech" } };
const fixed = estimateAuecFromMission(fixedMission, "Neutral");
assert(fixed.auec === 15000, "wiki reward_min used when present");
assert(fixed.estimateSource === "wiki_datamine", "fixed payout source is wiki_datamine");

assert(roundToNiceAuec(42500) === 43000 || roundToNiceAuec(42500) === 42000, "roundToNiceAuec rounds large values");

// --- mission marker + contract accept carries definition id ---
const ctx = makeCtx();
const markerLine = `<2026-06-08T06:49:58.110Z> [Notice] <CLocalMissionPhaseMarker::CreateMarker> Creating objective marker: missionId [${MISSION}], generator name [HeadHunters_Mercenary_FPS], contract [HH_Pyro_RegionA_E_DerelictOutpostsCaves_EliminateAll], contractDefinitionId[${SWIFT_UUID}], objectiveId [b1cfdbee-db83-f940-b772-84bfe15b742a], markerEntityId [11731], zoneHostId [434620267936], position [x: 0, y: 0, z: 0]`;
parseLine(markerLine, ctx);

const acceptEvents = parseLine(
  `<2026-06-08T06:49:58.116Z> [Notice] <SHUDEvent_OnNotification> Added notification "Contract Accepted:  A Swift Reprisal <EM4>[50 Rep] [BP]*</EM4>: " [38] to queue. New queue size: 1, MissionId: [${MISSION}], ObjectiveId: []`,
  ctx
);
const acceptBatch = Array.isArray(acceptEvents) ? acceptEvents : acceptEvents ? [acceptEvents] : [];
const accepted = acceptBatch.find((e) => e.type === "contract" && e.detail?.action === "accepted");
assert(accepted?.detail?.contractDefinitionId === SWIFT_UUID, "Contract accept carries contractDefinitionId from marker");

// --- maybeAddEstimatedPayout skips when confirmed auec exists ---
factionRepStore.resetForTests();
let session = createSession();
pushEvent(session, {
  type: "reward",
  at: "2026-06-08T07:00:00.000Z",
  summary: "Earned: 50000 aUEC",
  detail: { missionId: MISSION, auec: 50000, auecConfirmed: true },
});
async function runAsyncTests() {
  const skip = await maybeAddEstimatedPayout(session, {
    type: "contract",
    at: "2026-06-08T07:00:01.000Z",
    detail: {
      action: "completed",
      missionId: MISSION,
      title: "A Swift Reprisal",
      contractDefinitionId: SWIFT_UUID,
    },
  });
  assert(skip === null, "Skips estimate when confirmed aUEC already logged");
}

// --- buildEstimatedRewardEvent shape ---
const estEvent = buildEstimatedRewardEvent({
  at: "2026-06-08T07:00:00.000Z",
  missionId: MISSION,
  contractTitle: "A Swift Reprisal",
  estimate: {
    auec: 42000,
    estimateSource: "wiki_rep_tier",
    estimateNote: "test note",
    contractDefinitionId: SWIFT_UUID,
    missionTitle: "A Swift Reprisal",
    faction: "Headhunters",
    standing: "Head Contractor",
  },
});
assert(estEvent.detail.auecEstimated === true, "Estimated reward flagged");
assert(estEvent.detail.auec === 42000, "Estimated reward amount");
assert(/not confirmed/i.test(estEvent.summary), "Summary says not confirmed");

runAsyncTests().then(() => {
  if (!process.exitCode) console.log("test-contract-wiki-estimate: ok");
});
