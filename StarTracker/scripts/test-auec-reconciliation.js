/**
 * Accept-title / wiki-estimate aUEC must not stack with confirmed Awarded lines.
 */
const assert = require("assert");
const { createSession, pushEvent, snapshot } = require("../electron/session");
const { aggregateRewards } = require("../electron/rewardFormat");
const {
  maybeAddEstimatedPayout,
  buildEstimatedRewardEvent,
} = require("../electron/contractPayoutEnrichment");

const MISSION = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function assertEq(actual, expected, msg) {
  assert.strictEqual(actual, expected, `${msg} (got ${actual}, want ${expected})`);
}

// --- accept-title provisional + Awarded → only Awarded counts as earned ---
{
  const session = createSession();
  pushEvent(session, {
    type: "reward",
    at: "2026-06-08T12:00:00.000Z",
    summary: "Earned: ~25000 aUEC (not confirmed)",
    detail: {
      missionId: MISSION,
      auec: 25000,
      auecFromAcceptTitle: true,
      auecConfirmed: false,
    },
  });
  assertEq(session.stats.auecEstimated, 25000, "accept-title goes to estimated");
  assertEq(session.stats.auecEarned || 0, 0, "accept-title is not confirmed earned");

  pushEvent(session, {
    type: "reward",
    at: "2026-06-08T12:00:01.000Z",
    summary: "Earned: 25,000 aUEC",
    detail: {
      missionId: MISSION,
      auec: 25000,
      auecConfirmed: true,
      auecEstimated: false,
    },
  });
  assertEq(session.stats.auecEarned, 25000, "Awarded counts as earned");
  assertEq(session.stats.auecEstimated, 0, "provisional cleared after Awarded");

  const provisional = session.events.find(
    (e) => e.type === "reward" && e.detail?.auecFromAcceptTitle
  );
  assert(provisional.detail.auecSuperseded === true, "accept-title marked superseded");
  assert(provisional.detail.auec == null, "superseded provisional auec nulled");

  const rollup = snapshot(session).rollup;
  assertEq(rollup.rewardTotals.totalAuec, 25000, "rollup confirmed aUEC");
  assertEq(rollup.rewardTotals.totalAuecEstimated || 0, 0, "rollup estimated cleared");
}

// --- aggregateRewards dedupes per mission ---
{
  const totals = aggregateRewards([
    {
      missionId: MISSION,
      auec: 12000,
      auecFromAcceptTitle: true,
      auecConfirmed: false,
    },
    {
      missionId: MISSION,
      auec: 15000,
      auecEstimated: true,
    },
    {
      missionId: MISSION,
      auec: 18000,
      auecConfirmed: true,
    },
  ]);
  assertEq(totals.totalAuec, 18000, "aggregate prefers confirmed");
  assertEq(totals.totalAuecEstimated, 0, "aggregate ignores provisional when confirmed exists");
}

// --- estimate skipped when accept-title already present ---
async function runAsync() {
  const session = createSession();
  pushEvent(session, {
    type: "reward",
    at: "2026-06-08T12:00:00.000Z",
    summary: "provisional",
    detail: {
      missionId: MISSION,
      auec: 25000,
      auecFromAcceptTitle: true,
      auecConfirmed: false,
    },
  });
  const skip = await maybeAddEstimatedPayout(session, {
    type: "contract",
    at: "2026-06-08T12:00:01.000Z",
    detail: {
      action: "completed",
      missionId: MISSION,
      title: "Test contract",
      contractDefinitionId: "00000000-0000-0000-0000-000000000001",
    },
  });
  assert(skip === null, "skips wiki estimate when accept-title aUEC exists");

  // estimate then Awarded still reconciles
  const session2 = createSession();
  const est = buildEstimatedRewardEvent({
    at: "2026-06-08T12:00:00.000Z",
    missionId: MISSION,
    contractTitle: "Test",
    estimate: {
      auec: 42000,
      estimateSource: "wiki_rep_tier",
      estimateNote: "test",
      contractDefinitionId: "x",
      missionTitle: "Test",
    },
  });
  pushEvent(session2, est);
  assertEq(session2.stats.auecEstimated, 42000, "estimate tracked");
  pushEvent(session2, {
    type: "reward",
    at: "2026-06-08T12:00:02.000Z",
    summary: "Earned: 40,000 aUEC",
    detail: {
      missionId: MISSION,
      auec: 40000,
      auecConfirmed: true,
    },
  });
  assertEq(session2.stats.auecEarned, 40000, "Awarded after estimate");
  assertEq(session2.stats.auecEstimated, 0, "estimate superseded");
  console.log("test-auec-reconciliation: OK");
}

runAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
