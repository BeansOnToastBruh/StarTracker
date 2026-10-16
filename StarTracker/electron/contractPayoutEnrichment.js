const factionRepStore = require("./factionRepStore");
const contractWiki = require("./contractWiki");

const ZERO_MISSION = "00000000-0000-0000-0000-000000000000";

function isConfirmedAuecDetail(detail) {
  if (!detail || detail.auec == null || detail.auecSuperseded) return false;
  if (detail.auecEstimated || detail.auecFromAcceptTitle) return false;
  if (detail.auecConfirmed === false) return false;
  return true;
}

function isProvisionalAuecDetail(detail) {
  if (!detail || detail.auec == null || detail.auecSuperseded) return false;
  return !!(detail.auecEstimated || detail.auecFromAcceptTitle);
}

function missionHasConfirmedAuec(session, missionId) {
  if (!missionId || !session?.events) return false;
  for (const e of session.events) {
    if (e.type !== "reward" || e.detail?.missionId !== missionId) continue;
    if (isConfirmedAuecDetail(e.detail)) return true;
  }
  return false;
}

function missionHasEstimatedAuec(session, missionId) {
  if (!missionId || !session?.events) return false;
  for (const e of session.events) {
    if (e.type !== "reward" || e.detail?.missionId !== missionId) continue;
    if (e.detail?.auec != null && e.detail?.auecEstimated && !e.detail?.auecSuperseded) {
      return true;
    }
  }
  return false;
}

function missionHasAcceptTitleAuec(session, missionId) {
  if (!missionId || !session?.events) return false;
  for (const e of session.events) {
    if (e.type !== "reward" || e.detail?.missionId !== missionId) continue;
    if (
      e.detail?.auec != null &&
      e.detail?.auecFromAcceptTitle &&
      !e.detail?.auecSuperseded
    ) {
      return true;
    }
  }
  return false;
}

/**
 * When a confirmed Awarded/You've Earned line arrives, drop provisional
 * accept-title brackets and wiki estimates for the same mission so totals
 * do not double-count.
 */
function supersedeProvisionalAuec(session, missionId) {
  if (!session?.events || !missionId || missionId === ZERO_MISSION) return 0;
  let cleared = 0;
  for (const e of session.events) {
    if (e.type !== "reward" || e.detail?.missionId !== missionId) continue;
    if (!isProvisionalAuecDetail(e.detail)) continue;
    const amt = Number(e.detail.auec) || 0;
    if (amt > 0 && session.stats) {
      session.stats.auecEstimated = Math.max(
        0,
        (session.stats.auecEstimated || 0) - amt
      );
    }
    e.detail.auecSuperseded = true;
    e.detail.auecWas = amt;
    e.detail.auec = null;
    e.summary = e.detail.auecEstimated
      ? "Estimated payout replaced by Awarded line"
      : "Accept-title aUEC replaced by Awarded line";
    cleared += 1;
  }
  return cleared;
}

/**
 * Call after pushing a reward event. Confirmed payouts clear provisional ones.
 */
function reconcileAuecAfterReward(session, event) {
  if (!session || event?.type !== "reward") return false;
  if (!isConfirmedAuecDetail(event.detail)) return false;
  const missionId = event.detail?.missionId;
  if (!missionId || missionId === ZERO_MISSION) return false;
  return supersedeProvisionalAuec(session, missionId) > 0;
}

function findContractMeta(session, missionId) {
  if (!session?.events || !missionId) return null;
  let best = null;
  for (let i = session.events.length - 1; i >= 0; i--) {
    const e = session.events[i];
    if (e.type !== "contract" || e.detail?.missionId !== missionId) continue;
    const meta = {
      contractDefinitionId: e.detail.contractDefinitionId || null,
      title: e.detail.title || null,
      faction: e.detail.faction || null,
    };
    if (meta.contractDefinitionId) return meta;
    if (!best && meta.title) best = meta;
  }
  return best;
}

function trackRepFromReward(event) {
  if (event?.type !== "reward") return;
  const rep = event.detail?.rep;
  const faction = event.detail?.faction;
  if (rep != null && faction) {
    factionRepStore.addRep(faction, rep);
  }
}

function buildEstimatedRewardEvent({ at, missionId, contractTitle, estimate }) {
  const detail = {
    missionId,
    contractTitle,
    kind: "auec",
    auec: estimate.auec,
    auecMax: estimate.auecMax || null,
    auecEstimated: true,
    auecConfirmed: false,
    estimateSource: estimate.estimateSource,
    estimateNote: estimate.estimateNote,
    contractDefinitionId: estimate.contractDefinitionId,
    wikiMissionTitle: estimate.missionTitle,
    debugName: estimate.debugName,
    faction: estimate.faction,
    repStanding: estimate.standing,
    wikiUrl: estimate.wikiUrl || null,
    wikiReputationAmount: estimate.reputationAmount || null,
    payoutDonorUuid: estimate.payoutDonorUuid || null,
    linkedFromWikiEstimate: true,
  };
  const range =
    estimate.auecMax && estimate.auecMax > estimate.auec
      ? `~${estimate.auec.toLocaleString()}–${estimate.auecMax.toLocaleString()}`
      : `~${estimate.auec.toLocaleString()}`;
  return {
    type: "reward",
    at,
    summary: `Estimated: ${range} aUEC (not confirmed)`,
    detail,
  };
}

async function maybeAddEstimatedPayout(session, contractEvent) {
  if (!session || contractEvent?.type !== "contract") return null;
  if (contractEvent.detail?.action !== "completed") return null;

  const missionId = contractEvent.detail?.missionId;
  if (!missionId || missionId === ZERO_MISSION) return null;
  if (
    missionHasConfirmedAuec(session, missionId) ||
    missionHasEstimatedAuec(session, missionId) ||
    missionHasAcceptTitleAuec(session, missionId)
  ) {
    return null;
  }

  const meta =
    contractEvent.detail?.contractDefinitionId || contractEvent.detail?.title
      ? {
          contractDefinitionId: contractEvent.detail.contractDefinitionId || null,
          title: contractEvent.detail.title || null,
          faction: contractEvent.detail.faction || null,
        }
      : findContractMeta(session, missionId);

  if (!meta?.contractDefinitionId && !meta?.title) return null;

  const faction = meta.faction;
  const standing = faction
    ? factionRepStore.standingForRep(factionRepStore.getRep(faction))
    : "Neutral";

  const estimate = await contractWiki.estimatePayoutForContract({
    contractDefinitionId: meta.contractDefinitionId,
    faction,
    standingName: standing,
    contractTitle: contractEvent.detail?.title || meta.title,
  });
  if (!estimate?.auec) return null;

  return buildEstimatedRewardEvent({
    at: contractEvent.at,
    missionId,
    contractTitle:
      contractEvent.detail?.title || meta.title || estimate.missionTitle,
    estimate,
  });
}

module.exports = {
  maybeAddEstimatedPayout,
  trackRepFromReward,
  missionHasConfirmedAuec,
  missionHasEstimatedAuec,
  missionHasAcceptTitleAuec,
  buildEstimatedRewardEvent,
  reconcileAuecAfterReward,
  supersedeProvisionalAuec,
  isConfirmedAuecDetail,
  isProvisionalAuecDetail,
};
