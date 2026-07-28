const factionRepStore = require("./factionRepStore");
const contractWiki = require("./contractWiki");

function missionHasConfirmedAuec(session, missionId) {
  if (!missionId || !session?.events) return false;
  for (const e of session.events) {
    if (e.type !== "reward" || e.detail?.missionId !== missionId) continue;
    if (e.detail?.auec == null || e.detail?.auecEstimated) continue;
    // Accept-title brackets are provisional; wiki estimates / Awarded lines may still apply.
    if (e.detail?.auecFromAcceptTitle) continue;
    return true;
  }
  return false;
}

function missionHasEstimatedAuec(session, missionId) {
  if (!missionId || !session?.events) return false;
  for (const e of session.events) {
    if (e.type !== "reward" || e.detail?.missionId !== missionId) continue;
    if (e.detail?.auec != null && e.detail?.auecEstimated) return true;
  }
  return false;
}

function findContractMeta(session, missionId) {
  if (!session?.events || !missionId) return null;
  for (let i = session.events.length - 1; i >= 0; i--) {
    const e = session.events[i];
    if (e.type === "contract" && e.detail?.missionId === missionId && e.detail?.contractDefinitionId) {
      return {
        contractDefinitionId: e.detail.contractDefinitionId,
        title: e.detail.title,
        faction: e.detail.faction || null,
      };
    }
  }
  return null;
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
    linkedFromWikiEstimate: true,
  };
  return {
    type: "reward",
    at,
    summary: `Estimated: ~${estimate.auec.toLocaleString()} aUEC (not confirmed)`,
    detail,
  };
}

async function maybeAddEstimatedPayout(session, contractEvent) {
  if (!session || contractEvent?.type !== "contract") return null;
  if (contractEvent.detail?.action !== "completed") return null;

  const missionId = contractEvent.detail?.missionId;
  if (!missionId || missionId === "00000000-0000-0000-0000-000000000000") return null;
  if (missionHasConfirmedAuec(session, missionId) || missionHasEstimatedAuec(session, missionId)) {
    return null;
  }

  const meta =
    contractEvent.detail?.contractDefinitionId
      ? {
          contractDefinitionId: contractEvent.detail.contractDefinitionId,
          title: contractEvent.detail.title,
          faction: contractEvent.detail.faction || null,
        }
      : findContractMeta(session, missionId);

  if (!meta?.contractDefinitionId) return null;

  const faction = meta.faction;
  const standing = faction ? factionRepStore.standingForRep(factionRepStore.getRep(faction)) : "Neutral";

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
    contractTitle: contractEvent.detail?.title || meta.title || estimate.missionTitle,
    estimate,
  });
}

module.exports = {
  maybeAddEstimatedPayout,
  trackRepFromReward,
  missionHasConfirmedAuec,
  buildEstimatedRewardEvent,
};
