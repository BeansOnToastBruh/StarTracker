/**
 * Contract complete titles embed rep/aUEC in HUD markup; Awarded aUEC lines are separate.
 */
const { parseLine } = require("../electron/parser");
const { createCombatCtx } = require("../electron/combatContext");
const { createVehicleCtx } = require("../electron/vehicleContext");
const {
  parseContractPayoutFromTitle,
  parseAwardedAuec,
  stripHudMarkup,
  sumAuecPayoutsInText,
} = require("../electron/rewardFormat");

const MISSION = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

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

function parseNotificationLine(text, missionId = MISSION, ctx = makeCtx()) {
  const line = `<2026-06-08T12:00:00.000Z> [Notice] <SHUDEvent_OnNotification> Added notification "${text}" [1] to queue. MissionId: [${missionId}], ObjectiveId: []`;
  const result = parseLine(line, ctx);
  return Array.isArray(result) ? result : result ? [result] : [];
}

// --- parseContractPayoutFromTitle unit cases ---

const deepSpaceTitle = 'Deep space hit <EM4>[50 Rep] [BP]</EM4>:';
const deepSpacePayout = parseContractPayoutFromTitle(deepSpaceTitle);
assert(deepSpacePayout.rep === 50, "Deep space hit title parses rep=50");
assert(deepSpacePayout.auec == null, "Deep space hit title has no auec");
assert(deepSpacePayout.kind === "reputation", "Deep space hit kind is reputation");

const mixedTitle =
  "Deep space hit <EM4>[50 Rep] [25000 aUEC] [BP]</EM4>:";
const mixedPayout = parseContractPayoutFromTitle(mixedTitle);
assert(mixedPayout.rep === 50, "Mixed title parses rep=50");
assert(mixedPayout.auec === 25000, "Mixed title parses auec=25000");
assert(mixedPayout.kind === "mixed", "Mixed rep+auec kind is mixed");

const auecTitle = "Bounty Hunt <EM2>[5000 aUEC]</EM2>:";
const auecPayout = parseContractPayoutFromTitle(auecTitle);
assert(auecPayout.auec === 5000, "Bracket title parses auec=5000");
assert(auecPayout.rep == null, "aUEC-only title has no rep");

assert(
  parseAwardedAuec("Awarded 56000 aUEC") === 56000,
  "Classic Awarded aUEC still parses"
);

assert(
  stripHudMarkup(deepSpaceTitle) === "Deep space hit [50 Rep] [BP]",
  "stripHudMarkup removes EM tags and trailing colon"
);

// --- parseLine integration: contract complete emits reward for rep ---

const events = parseNotificationLine(`Contract Complete: ${deepSpaceTitle}`);
const contractEv = events.find((e) => e.type === "contract" && e.detail?.action === "completed");
const rewardEv = events.find((e) => e.type === "reward");

assert(!!contractEv, "Contract complete event emitted");
assert(
  contractEv.detail.title === "Deep space hit [50 Rep] [BP]",
  "Contract title stripped of HUD markup"
);
assert(!!rewardEv, "Reward event emitted for rep-only contract complete");
assert(rewardEv.detail.rep === 50, "Reward event carries rep=50");
assert(rewardEv.detail.auec == null, "Reward event has no auec");
assert(rewardEv.detail.linkedFromContractComplete === true, "Reward linked from contract complete");
assert(rewardEv.detail.missionId === MISSION, "Reward carries mission id");

// --- blueprint line with [BP] suffix ---

const bpEvents = parseNotificationLine(
  "Received Blueprint: Scalpel Sniper Rifle Magazine (12 cap) [BP]"
);
const bpEv = bpEvents.find((e) => e.type === "blueprint");
assert(!!bpEv, "Blueprint event emitted");
assert(
  bpEv.detail.blueprintName === "Scalpel Sniper Rifle Magazine (12 cap)",
  "Blueprint name strips [BP] suffix"
);

// --- Awarded aUEC line still produces reward ---

const awardedEvents = parseNotificationLine("Awarded 56000 aUEC");
const awardedEv = awardedEvents.find((e) => e.type === "reward");
assert(!!awardedEv, "Awarded aUEC still emits reward");
assert(awardedEv.detail.auec === 56000, "Awarded aUEC reward amount=56000");

// --- log scan: legacy Awarded lines + contract title brackets ---

const legacyLogSnippet = [
  'Added notification "Awarded 56000 aUEC: "',
  'Added notification "Awarded 25000 aUEC: "',
  'Added notification "Contract Complete: Cargo <EM4>[10000 aUEC]</EM4>: "',
].join("\n");
assert(
  sumAuecPayoutsInText(legacyLogSnippet) === 91000,
  "Log scan sums Awarded + contract-bracket aUEC"
);

const earnedLine = parseNotificationLine("You've Earned: 12500 aUEC");
const earnedAuecEv = earnedLine.find((e) => e.type === "reward");
assert(!!earnedAuecEv, "You've Earned aUEC emits reward");
assert(earnedAuecEv.detail.auec === 12500, "You've Earned aUEc amount=12500");

// --- accept-time aUEC carries through when complete title omits it ---

const ACCEPT_MISSION = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
const acceptCtx = makeCtx();
const acceptEvents = parseNotificationLine(
  `Contract Accepted: Bounty <EM4>[25000 aUEC]</EM4>:`,
  ACCEPT_MISSION,
  acceptCtx
);
assert(acceptEvents.some((e) => e.type === "contract"), "Contract accept emitted");
const completeEvents = parseNotificationLine(
  "Contract Complete: Bounty <EM4>[50 Rep] [BP]</EM4>:",
  ACCEPT_MISSION,
  acceptCtx
);
const completeReward = completeEvents.find((e) => e.type === "reward");
assert(!!completeReward, "Complete emits reward with accept-time aUEC");
assert(completeReward.detail.auec === 25000, "Accept-time aUEC merged on complete");
assert(completeReward.detail.rep === 50, "Complete-time rep still parsed");
assert(
  completeReward.detail.auecFromAcceptTitle === true,
  "Accept-merged aUEC flagged as auecFromAcceptTitle"
);
assert(
  completeReward.detail.auecConfirmed === false,
  "Accept-merged aUEC is not treated as confirmed Awarded"
);

// --- MissionId-first: HUD MissionId wins over a different pending complete ---

const M1 = "11111111-1111-1111-1111-111111111111";
const M2 = "22222222-2222-2222-2222-222222222222";
const linkCtx = makeCtx();
parseNotificationLine(
  "Contract Complete: Earlier bounty <EM4>[10 Rep]</EM4>:",
  M1,
  linkCtx
);
const midAwarded = parseNotificationLine("Awarded 99000 aUEC", M2, linkCtx);
const midEv = midAwarded.find((e) => e.type === "reward");
assert(!!midEv, "Awarded with MissionId emits reward");
assert(
  midEv.detail.missionId === M2,
  "Awarded keeps HUD MissionId (does not FIFO-steal earlier complete)"
);
assert(midEv.detail.linkSource === "mission_id", "Awarded linkSource is mission_id");

// --- Soft MissionEnded Complete primes payout when Awarded has zero MissionId ---

const ZERO = "00000000-0000-0000-0000-000000000000";
const softCtx2 = makeCtx();
parseLine(
  `<2026-06-08T12:00:00.000Z> [Notice] <MissionEnded> Received MissionEnded push message for: mission_id ${M1} - mission_state MISSION_STATE_COMPLETED [Team_GameServices][Missions]`,
  softCtx2
);
const softAwarded2 = parseLine(
  `<2026-06-08T12:00:00.500Z> [Notice] <SHUDEvent_OnNotification> Added notification "Awarded 42000 aUEC" [1] to queue. MissionId: [${ZERO}], ObjectiveId: []`,
  softCtx2
);
const softEvents = Array.isArray(softAwarded2) ? softAwarded2 : softAwarded2 ? [softAwarded2] : [];
const softEv = softEvents.find((e) => e.type === "reward");
assert(!!softEv, "Soft-primed Awarded emits reward");
assert(softEv.detail.missionId === M1, "Zero-MissionId Awarded links via MissionEnded pending");
assert(
  softEv.detail.linkSource === "pending_complete",
  "Soft-primed Awarded uses pending_complete linkSource"
);

  // Soft EndMission Complete also primes pending (real LIVE format)
  const softEndCtx = makeCtx();
  parseLine(
    `<2026-06-08T12:00:00.000Z> [Notice] <EndMission> Ending mission for player. MissionId[${M1}] Player[TestPilot] PlayerId[1] CompletionType[Complete] Reason[Mission Ended] [Team_MissionFeatures][Missions]`,
    softEndCtx
  );
  const softEndAwarded = parseLine(
    `<2026-06-08T12:00:00.400Z> [Notice] <SHUDEvent_OnNotification> Added notification "Awarded 15000 aUEC" [1] to queue. MissionId: [${ZERO}], ObjectiveId: []`,
    softEndCtx
  );
  const softEndEvents = Array.isArray(softEndAwarded)
    ? softEndAwarded
    : softEndAwarded
      ? [softEndAwarded]
      : [];
  const softEndEv = softEndEvents.find((e) => e.type === "reward");
  assert(!!softEndEv, "EndMission Complete soft-prime emits Awarded reward");
  assert(
    softEndEv.detail.missionId === M1,
    "EndMission Complete primes zero-MissionId Awarded"
  );

// --- You've Earned shares the same MissionId-first linker ---

const earnedCtx = makeCtx();
parseNotificationLine("Contract Complete: Cargo run <EM4>[5 Rep]</EM4>:", M1, earnedCtx);
const earnedZero = parseLine(
  `<2026-06-08T12:00:00.200Z> [Notice] <SHUDEvent_OnNotification> Added notification "You've Earned: 8000 aUEC" [1] to queue. MissionId: [${ZERO}], ObjectiveId: []`,
  earnedCtx
);
const earnedEvents = Array.isArray(earnedZero) ? earnedZero : earnedZero ? [earnedZero] : [];
const earnedEv = earnedEvents.find((e) => e.type === "reward");
assert(!!earnedEv, "You've Earned with zero MissionId emits");
assert(
  earnedEv.detail.missionId === M1,
  "You've Earned links to pending Contract Complete MissionId"
);

// --- modern build 11952564: no aUEC strings in log (Deep space hit session) ---

const modernSnippet = [
  'Added notification "Contract Complete: Deep space hit <EM4>[50 Rep] [BP]</EM4>: "',
  'Added notification "<EM4>Received Blueprint: Scalpel Sniper Rifle Magazine (12 cap) [BP]</EM4>: "',
].join("\n");
assert(
  sumAuecPayoutsInText(modernSnippet) === 0,
  "Modern contract complete without aUEC in log scans as 0"
);

if (process.exitCode) {
  console.error("test-contract-reward-parser: FAILED");
  process.exit(1);
}
console.log("test-contract-reward-parser: ok");
