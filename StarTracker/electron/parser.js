const TIMESTAMP = /^(?:<\d{4}-\d{2}-\d{2}T[\d:.]+Z>\s*)?/;

const PATTERNS = {
  nickname: /nickname="([^"]+)"/,
  connectStarted: /\[CSessionManager::ConnectCmd\] Connect started!/,
  connected: /\[CSessionManager::OnClientConnected\] Connected!/,
  spawned: /\[CSessionManager::OnClientSpawned\] Spawned!/,
  quitLobby: /\[EALobby\]\[CEALobby::RequestQuitLobby\]/,
  systemQuit: /<SystemQuit>|CSystem::Quit invoked/,
  inUniverse: /gamerules="SC_Default"/,
  actorDeath:
    /\[Notice\].*CActor::Kill: '(?<victim>[^']+)' \[\d+\] in zone '(?<zone>[^']+)' killed by '(?<killer>[^']+)' \[\d+\] using '(?<weapon>[^']+)'(?: \[Class [^\]]+\])? with damage type '(?<damageType>[^']+)'/,
  quantum:
    /\[Notice\].*Transitioning from zone (?<fromZone>[\w_-]+) in (?<fromSystem>[\w_-]+) to zone (?<toZone>[\w_-]+) in (?<toSystem>[\w_-]+)/,
  /** Alpha 4.9+ — old zone-transition QT lines are gone; arrival notices remain. */
  quantumArrived:
    /\[Notice\].*<Quantum Drive Arrived - Arrived at Final Destination>.*?\| (?:NOT AUTH \| )?(?<shipKey>[A-Za-z0-9_]+)\[(?<entityId>\d+)\]\|CSCItemNavigation::OnQuantumDriveArrived/,
  contractGen: /contract: (?<id>[\w_-]+)/,
  notification:
    /\[Notice\] <SHUDEvent_OnNotification> Added notification "(?<text>[^"]+)" \[\d+\].*MissionId: \[(?<missionId>[^\]]+)\]/,
  contractBroker: /ContractBrokerService/,
  hudContinuation: /^\s*"(?<text>[^"]+)"(?:\s*\[\d+\])?\s*$/,
  channelDisconnected:
    /\[Notice\] <Channel Disconnected>.*gamerules="SC_Default".*reason="(?<reason>[^"]+)"/,
  notificationAdded:
    /Added notification "(?<text>.+?)"\s*\[(?<notifId>\d+)\].*?MissionId: \[(?<missionId>[^\]]+)\]/,
  missionMarker:
    /CreateMarker> Creating objective marker: missionId \[(?<missionId>[^\]]+)\], generator name \[(?<generator>[^\]]+)\], contract \[(?<contract>[^\]]+)\], contractDefinitionId\[(?<definitionId>[^\]]+)\]/,
};
const ZERO_MISSION = "00000000-0000-0000-0000-000000000000";
const {
  enrichRewardDetail,
  rewardSummaryFromDetail,
  parseAwardedAuec,
  parseFinedUec,
  stripHudMarkup,
  parseContractPayoutFromTitle,
  finalizeRewardKind,
} = require("./rewardFormat");
const {
  onActorStateDead,
  onIncapacitated,
  onCorpseRecovery,
  tryFinalizeDeath,
  tryRespawnFinalize,
  isCorpseRecoveryLine,
  registerBountyObjective,
  registerBountyPlayer,
  tryBountyKill,
} = require("./combatContext");
const {
  ingestVehicleSignals,
  tryEmitShipDestruction,
  tryEmitCollisionAfterActorDead,
} = require("./vehicleContext");
const { appendCommodityCommerce } = require("./commodityHaul");
const {
  formatShopName,
  formatVehicleLabel,
  formatLocationLabel,
  shopItemCategory,
} = require("./commerceFormat");
const {
  parseAttachmentLine,
  isPlayerAttachment,
  noteLoadoutAttachment,
  onPlayerSpawned,
  flushLoadoutBatch,
} = require("./loadoutContext");
const { formatPortLabel } = require("./loadoutFormat");
const { labelForClassName, isVerified } = require("./sessionEnrichment");

function emit(events, event) {
  if (!event) return events;
  events.push(event);
  return events;
}

function finish(events) {
  if (!events.length) return null;
  if (events.length === 1) return events[0];
  return events;
}

const NOISE_PREFIXES = [
  "Entering Armistice Zone",
  "Leaving Armistice Zone",
  "Medical Bed:",
  "Medical Device:",
  "Entered ",
  "Exited Monitored",
  "Entering Private Property",
  "Leaving Private Property",
  "Quantum Travel:",
  "Hangar Request",
  "Refueling Process:",
  "You have joined channel",
  "Hangar Request Completed",
];

function stripTimestamp(line) {
  return line.replace(TIMESTAMP, "").trim();
}

function extractTimestamp(line) {
  const m = line.match(/<(\d{4}-\d{2}-\d{2}T[\d:.]+Z)>/);
  return m ? m[1] : new Date().toISOString();
}

function beautifyName(name) {
  if (!name) return "Unknown";
  const parts = name.split("_");
  if (parts.length > 1 && /^[a-z0-9]+$/i.test(parts[parts.length - 1])) {
    return parts.slice(0, -1).join(" ");
  }
  return name.replace(/_/g, " ");
}

/** HUD "New Objective:" / "Objective Complete:" / "Objective Withdrawn:" body (no prefix). */
function parseObjectiveTitle(text) {
  const cleaned = text
    .replace(/^New Objective:\s*/i, "")
    .replace(/^Objective Complete:\s*/i, "")
    .replace(/^Objective Withdrawn:\s*/i, "")
    .replace(/:\s*$/, "")
    .trim();
  return cleaned || null;
}

/** Ship class from entity keys like GAMA_Railen_738956821393 or ORIG_m80_739100912651. */
function shipClassFromQtKey(shipKey) {
  const key = String(shipKey || "");
  const m = key.match(/^(.+)_(\d+)$/);
  return m ? m[1] : key || null;
}

function formatShipClassLabel(shipClass) {
  if (!shipClass) return null;
  const spaced = String(shipClass).replace(/_/g, " ");
  try {
    const labeled = labelForClassName(shipClass);
    // Prefer enrichment only when it expands the class (never truncates model codes).
    if (labeled && labeled !== shipClass && labeled.length > spaced.length) {
      return labeled;
    }
  } catch {
    /* enrichment optional */
  }
  return spaced;
}

function isPlayerEntity(name, playerNick) {
  if (!name || !playerNick) return false;
  const n = name.toLowerCase();
  const p = playerNick.toLowerCase();
  return (
    n === p ||
    n.includes(p) ||
    (n.startsWith("player_") && n.includes(p.replace(/\s/g, "")))
  );
}

function isNoiseNotification(text) {
  return NOISE_PREFIXES.some((p) => text.startsWith(p));
}

function hudTextKey(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function markHudTextSeen(ctx, text) {
  if (!text) return;
  if (!ctx.seenHudTexts) ctx.seenHudTexts = new Set();
  ctx.seenHudTexts.add(hudTextKey(text));
}

function isHudTextSeen(ctx, text) {
  return ctx.seenHudTexts?.has(hudTextKey(text));
}

function queueCompletedContract(ctx, missionId, title, at) {
  if (!ctx.completedContractQueue) ctx.completedContractQueue = [];
  if (!missionId || missionId === ZERO_MISSION) return;
  ctx.completedContractQueue.push({ missionId, title, at });
  if (ctx.completedContractQueue.length > 48) {
    ctx.completedContractQueue.shift();
  }
}

function popLinkedContract(ctx) {
  if (ctx.completedContractQueue?.length) {
    return ctx.completedContractQueue.shift();
  }
  if (ctx.lastCompletedMissionId && ctx.lastCompletedMissionId !== ZERO_MISSION) {
    return {
      missionId: ctx.lastCompletedMissionId,
      title: ctx.lastCompletedContractTitle || null,
      at: ctx.lastCompletedAt || null,
      linkedFromRecentContract: true,
    };
  }
  return null;
}

function buildAwardedAuecReward(text, missionId, ctx) {
  const auec = parseAwardedAuec(text);
  if (auec == null) return null;
  const linked = popLinkedContract(ctx);
  const detail = enrichRewardDetail(
    {
      missionId: linked?.missionId || missionId || null,
      raw: text,
      kind: "auec",
      auec,
      rep: null,
      faction: null,
      itemCount: null,
      itemName: null,
      itemQuantity: null,
      blueprintName: null,
      deliveryNote: null,
      contractTitle: linked?.title || null,
      linkedFromRecentContract: !!linked,
    },
    text
  );
  return {
    type: "reward",
    at: null,
    summary: `Earned: ${auec.toLocaleString()} aUEC`,
    detail,
  };
}

function buildFineEvent(text) {
  const amount = parseFinedUec(text);
  if (amount == null) return null;
  return {
    type: "fine",
    summary: `Fined ${amount.toLocaleString()} UEC`,
    detail: { amount, currency: "UEC", raw: text },
  };
}

const ASOP_WINDOW_MS = 120000;
const INSURANCE_BATCH_FLUSH_GAP_MS = 5000;
const MODERN_CLAIM_DELIVERY_MS = 90000;
const NON_SHIP_HOST_RE = /^(QTNK|HTNK|FuelPod|Default_|ui_entity)/i;

function extendAsopSession(ctx, at, geid) {
  if (geid && !ctx.playerGEID) ctx.playerGEID = geid;
  const t = new Date(at).getTime();
  if (Number.isFinite(t)) {
    ctx.asopActiveUntil = t + ASOP_WINDOW_MS;
  }
}

function isAsopActive(ctx, at) {
  if (!ctx.asopActiveUntil || !at) return false;
  const t = new Date(at).getTime();
  return Number.isFinite(t) && t <= ctx.asopActiveUntil;
}

function isPlayerInsuranceUrn(urn, ctx) {
  if (!urn) return false;
  if (/^urn:sc:global:entitlement:uuid:/.test(urn)) return true;
  const geidM = urn.match(/^urn:sc:entitygraph:ltp:geid:(\d+)/);
  if (geidM) return ctx.playerGEID && geidM[1] === ctx.playerGEID;
  return false;
}

function isInsuranceClaimLine(body) {
  return (
    /CWallet::(ProcessClaimToNextStep|RmMulticastOnProcessClaimCallback)/i.test(
      body
    ) ||
    /Insured entity changed cb -> erase request/i.test(body) ||
    /PayExpeditedProcessingFee failed/i.test(body)
  );
}

function noteAsopVehicleList(ctx, at, geid) {
  extendAsopSession(ctx, at, geid);
  const t = new Date(at).getTime();
  if (Number.isFinite(t)) {
    ctx.asopFetchCompletedAt = t;
    ctx.lastAsopVehicleListAt = t;
  }
}

function trackAsopSignals(body, at, ctx) {
  const vehicleListM = body.match(
    /VehicleListQuery> Fetching vehicle list for player (\d+) completed/
  );
  if (vehicleListM) {
    ctx.insuranceBatchTainted = false;
    ctx.insuranceCompleteBatch = [];
    ctx.staleClaimUrns = new Set();
    noteAsopVehicleList(ctx, at, vehicleListM[1]);
    return;
  }

  const entitlementsM = body.match(
    /Getting player insured entitlements for player (\d+)/
  );
  if (entitlementsM) {
    ctx.insuranceBatchTainted = false;
    ctx.insuranceCompleteBatch = [];
    ctx.staleClaimUrns = new Set();
    extendAsopSession(ctx, at, entitlementsM[1]);
    return;
  }
  if (/Fetching ship list for local client/.test(body)) {
    extendAsopSession(ctx, at, ctx.playerGEID);
  }
  const fetchDoneM = body.match(
    /Fetching vehicle list for player (\d+) completed/
  );
  if (fetchDoneM && (!ctx.playerGEID || fetchDoneM[1] === ctx.playerGEID)) {
    noteAsopVehicleList(ctx, at, fetchDoneM[1]);
  }
}

function isLikelyShipHost(classPrefix) {
  if (!classPrefix || NON_SHIP_HOST_RE.test(classPrefix)) return false;
  const parts = classPrefix.split("_");
  return parts.length >= 2 && parts[0].length >= 2 && parts[0].length <= 6;
}

function emitModernInsuranceClaim(ctx, at, shipRaw, out) {
  const shipName = labelForClassName(shipRaw);
  const location = ctx.lastInsuranceLocation || null;
  emit(out, {
    type: "insurance",
    at,
    summary: shipName
      ? `Insurance claim: ${shipName}`
      : "Insurance claim completed",
    detail: {
      action: "claim_complete",
      shipName,
      shipRaw,
      verified: isVerified(shipRaw),
      location,
      entitlementUrn: null,
      requestId: null,
      raw: shipRaw,
      source: "modern_asop",
    },
  });
}

function handleModernInsuranceSignals(body, at, ctx, out) {
  const locInvM = body.match(
    /RequestLocationInventory> Player\[[^\]]+\] requested inventory for Location\[([^\]]+)\]/
  );
  if (locInvM) {
    ctx.lastInsuranceLocation = formatLocationLabel(locInvM[1]);
  }

  const atcLocM = body.match(/ATC Location:\s*([A-Za-z0-9_]+)/i);
  if (atcLocM) {
    ctx.lastInsuranceLocation = formatLocationLabel(atcLocM[1]);
  }

  if (/Claim Failed>|\[CLAIM FAILED\]/i.test(body)) {
    ctx.pendingModernClaim = null;
    invalidateInsuranceBatch(ctx);
    return;
  }

  if (
    /LoadingPlatformManager_ShipElevator/i.test(body) &&
    /LoweringPlatform/.test(body) &&
    isAsopActive(ctx, at) &&
    ctx.lastAsopVehicleListAt
  ) {
    const t = new Date(at).getTime();
    if (
      Number.isFinite(t) &&
      t - ctx.lastAsopVehicleListAt <= MODERN_CLAIM_DELIVERY_MS
    ) {
      ctx.pendingModernClaim = { at, startedAt: t };
    }
    return;
  }

  if (!ctx.pendingModernClaim) return;

  const hostM = body.match(/Host\s*:([A-Za-z0-9_]+_\d+)/);
  if (!hostM) return;

  const shipRaw = hostM[1];
  const classPrefix = shipRaw.replace(/_\d+$/, "");
  if (!isLikelyShipHost(classPrefix)) return;

  const t = new Date(at).getTime();
  const started = ctx.pendingModernClaim.startedAt;
  if (
    !Number.isFinite(t) ||
    !Number.isFinite(started) ||
    t - started > MODERN_CLAIM_DELIVERY_MS
  ) {
    return;
  }

  ctx.pendingModernClaim = null;
  emitModernInsuranceClaim(ctx, at, shipRaw, out);
}

function invalidateInsuranceBatch(ctx) {
  ctx.insuranceBatchTainted = true;
  ctx.insuranceCompleteBatch = [];
}

function flushInsuranceBatch(ctx, out) {
  if (!ctx.insuranceCompleteBatch?.length) return;
  if (ctx.insuranceBatchTainted) {
    ctx.insuranceCompleteBatch = [];
    return;
  }
  for (const event of ctx.insuranceCompleteBatch) {
    emit(out, event);
  }
  ctx.insuranceCompleteBatch = [];
}

function maybeFlushInsuranceBatch(body, at, ctx, out) {
  if (!ctx.insuranceCompleteBatch?.length) return;
  if (isInsuranceClaimLine(body)) return;
  const t = new Date(at).getTime();
  const lastAt = ctx.insuranceBatchLastAt;
  if (
    Number.isFinite(t) &&
    Number.isFinite(lastAt) &&
    t - lastAt < INSURANCE_BATCH_FLUSH_GAP_MS
  ) {
    return;
  }
  flushInsuranceBatch(ctx, out);
}

function queueInsuranceComplete(ctx, at, event) {
  if (ctx.insuranceBatchTainted) return;
  if (!ctx.insuranceCompleteBatch) ctx.insuranceCompleteBatch = [];
  ctx.insuranceCompleteBatch.push(event);
  const t = new Date(at).getTime();
  if (Number.isFinite(t)) ctx.insuranceBatchLastAt = t;
}

function ingestInsuranceVehicleHint(body, at, ctx) {
  const spawnM = body.match(
    /\[VEHICLE SPAWN\].*\(([^)]+)\)\s+by player\s+(\d+)/
  );
  if (!spawnM) return;
  if (!ctx.playerGEID) ctx.playerGEID = spawnM[2];
  if (spawnM[2] !== ctx.playerGEID) return;
  ctx.lastInsuranceVehicleHint = {
    at,
    raw: spawnM[1],
    name: formatVehicleLabel(spawnM[1]),
  };
}

function insuranceHintForClaim(ctx, at) {
  const hint = ctx.lastInsuranceVehicleHint;
  if (!hint?.name || !hint.at || !at) return null;
  const dt = new Date(at).getTime() - new Date(hint.at).getTime();
  if (dt < -5000 || dt > 45000) return null;
  return hint.name;
}

function appendCommerceEvents(body, at, ctx, out) {
  maybeFlushInsuranceBatch(body, at, ctx, out);
  trackAsopSignals(body, at, ctx);
  handleModernInsuranceSignals(body, at, ctx, out);
  ingestInsuranceVehicleHint(body, at, ctx);

  if (/PayExpeditedProcessingFee failed/i.test(body)) {
    invalidateInsuranceBatch(ctx);
  }

  const existingActiveM = body.match(
    /Existing Active Claim Found - Entitilement URN: (urn:[^\s]+)/i
  );
  if (existingActiveM) {
    const staleUrn = existingActiveM[1];
    if (!ctx.staleClaimUrns) ctx.staleClaimUrns = new Set();
    ctx.staleClaimUrns.add(staleUrn);
    if (ctx.insuranceClaimHints) {
      for (const key of ctx.insuranceClaimHints.keys()) {
        if (key.startsWith(`${staleUrn}|`)) ctx.insuranceClaimHints.delete(key);
      }
    }
  }

  const shopBuyRe =
    /SShopBuyRequest.*?playerId\[(\d+)\].*?shopName\[([^\]]+)\].*?client_price\[([\d.]+)\].*?itemName\[([^\]]+)\](?:.*?quantity\[(\d+)\])?/gis;
  let shopMatch;
  while ((shopMatch = shopBuyRe.exec(body)) !== null) {
      const [, playerId, shopName, priceRaw, itemName, qtyRaw] = shopMatch;
      if (!ctx.playerGEID) ctx.playerGEID = playerId;
      if (playerId !== ctx.playerGEID) continue;
      const price = Number(priceRaw);
      if (!Number.isFinite(price) || price <= 0) continue;
      const quantity = qtyRaw ? Number(qtyRaw) : 1;
      const itemLabel = labelForClassName(itemName, { quantity });
      const shopLabel = formatShopName(shopName);
      const category = shopItemCategory(itemName, price);
      emit(out, {
        type: "shop_purchase",
        at,
        summary: `Bought ${itemLabel} for ${Math.round(price).toLocaleString()} aUEC`,
        detail: {
          shop: shopLabel,
          item: itemLabel,
          itemRaw: itemName,
          verified: isVerified(itemName),
          price,
          quantity,
          category,
          playerId,
        },
      });
  }

  appendCommodityCommerce(body, at, ctx, (event) => emit(out, event));

  const claimRequestM = body.match(
    /CWallet::ProcessClaimToNextStep> New Insurance Claim Request - entitlementURN: (urn:[^\s,]+).*?requestId\s*:\s*(\d+)/i
  );
  if (claimRequestM) {
    const urn = claimRequestM[1];
    const requestId = claimRequestM[2];
    const staleActiveClaim = /Existing Active Claim Found/i.test(body);
    if (
      !staleActiveClaim &&
      !ctx.staleClaimUrns?.has(urn) &&
      isAsopActive(ctx, at) &&
      isPlayerInsuranceUrn(urn, ctx)
    ) {
      if (!ctx.insuranceClaimHints) ctx.insuranceClaimHints = new Map();
      const shipName = insuranceHintForClaim(ctx, at);
      let location = null;
      const atcM = body.match(/ATC Location:\s*([A-Za-z0-9_]+)/i);
      if (atcM) location = formatLocationLabel(atcM[1]);
      ctx.insuranceClaimHints.set(`${urn}|${requestId}`, {
        shipName,
        shipRaw: ctx.lastInsuranceVehicleHint?.raw || null,
        location,
        requestedAt: at,
      });
    }
  }

  const claimCompleteM = body.match(
    /CWallet::RmMulticastOnProcessClaimCallback> Claim Complete - entitlementURN: (urn:[^\s,]+).*?requestId:\s*(\d+)/i
  );
  if (claimCompleteM) {
    const resultM = body.match(/result:\s*(\d+)/i);
    if (resultM?.[1] === "7") return;

    const urn = claimCompleteM[1];
    const requestId = claimCompleteM[2];
    const hintKey = `${urn}|${requestId}`;
    const hint = ctx.insuranceClaimHints?.get(hintKey);
    if (!hint) return;

    ctx.insuranceClaimHints.delete(hintKey);

    const shipRaw = hint.shipRaw || null;
    const shipName =
      (shipRaw ? labelForClassName(shipRaw) : null) ||
      hint.shipName ||
      insuranceHintForClaim(ctx, at) ||
      null;
    const location = hint.location || null;
    const title = shipName
      ? `Insurance claim: ${shipName}`
      : "Insurance claim completed";
    queueInsuranceComplete(ctx, at, {
      type: "insurance",
      at,
      summary: title,
      detail: {
        action: "claim_complete",
        shipName,
        shipRaw,
        verified: !!(shipRaw && isVerified(shipRaw)),
        location,
        entitlementUrn: urn,
        requestId: Number(requestId),
        raw: body.slice(0, 240),
      },
    });
  }
}

function parseEarnedBody(text, missionId, ctx) {
  let inner = text
    .replace(/^You(?:'ve| have) [Ee]arned:\s*/i, "")
    .replace(/:\s*$/, "")
    .trim();

  const detail = enrichRewardDetail(parseRewardDetail(inner, missionId), inner);

  if (
    (!detail.missionId || detail.missionId === ZERO_MISSION) &&
    ctx?.lastCompletedMissionId &&
    ctx.lastCompletedMissionId !== ZERO_MISSION
  ) {
    detail.missionId = ctx.lastCompletedMissionId;
    detail.linkedFromRecentContract = true;
  }

  return detail;
}

function parseRewardDetail(text, missionId) {
  return enrichRewardDetail(
    {
      missionId: missionId || null,
      raw: text,
      kind: "other",
      auec: null,
      rep: null,
      faction: null,
      itemCount: null,
      itemName: null,
      itemQuantity: null,
      blueprintName: null,
      deliveryNote: null,
    },
    text
  );
}

/**
 * HUD queue sometimes logs a second line: `   "You've Earned: ..."`
 */
function parseHudContinuation(line, ctx) {
  const at = extractTimestamp(line);
  const body = stripTimestamp(line);
  const m = body.match(PATTERNS.hudContinuation);
  if (!m?.groups) return null;

  const text = m.groups.text.trim();
  if (isHudTextSeen(ctx, text)) return null;
  if (isNoiseNotification(text)) return null;

  if (/^Contract (Accepted|Complete|Failed|Abandoned):/i.test(text)) return null;
  if (/^Objective Complete:/i.test(text)) return null;
  if (/^Objective Withdrawn:/i.test(text)) return null;
  if (/^New Objective:/i.test(text)) return null;

  if (/^You've Earned:/i.test(text) || /^You have earned:/i.test(text)) {
    const detail = parseEarnedBody(text, null, ctx);
    return {
      type: "reward",
      at,
      summary: `Earned: ${rewardSummaryFromDetail(detail, text)}`,
      detail,
    };
  }

  const awarded = buildAwardedAuecReward(text, null, ctx);
  if (awarded) {
    awarded.at = at;
    if (awarded.detail) {
      awarded.detail.auecConfirmed = true;
      awarded.detail.auecEstimated = false;
    }
    return awarded;
  }

  const fine = buildFineEvent(text);
  if (fine) {
    fine.at = at;
    return fine;
  }

  return null;
}

/**
 * @param {string} line raw log line
 * @param {{ playerNick?: string, inUniverse?: boolean }} ctx
 */
function parseLine(line, ctx = {}) {
  if (!line || line.length < 12) return null;

  const out = [];

  const cont = parseHudContinuation(line, ctx);
  if (cont) return cont;

  const at = extractTimestamp(line);
  const body = stripTimestamp(line);

  appendCommerceEvents(body, at, ctx, out);

  const attachment = parseAttachmentLine(body);
  if (attachment && isPlayerAttachment(attachment.player, ctx)) {
    const finalized = noteLoadoutAttachment(ctx, at, attachment);
    if (finalized) emit(out, finalized);
    return finish(out);
  }

  const geidM = body.match(/playerGEID=(\d+)/);
  if (geidM && !ctx.playerGEID) ctx.playerGEID = geidM[1];

  if (ctx.playerNick && !ctx.playerGEID) {
    const nickEsc = ctx.playerNick.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nickGeidM = body.match(new RegExp(`'${nickEsc}' \\[(\\d+)\\]`, "i"));
    if (nickGeidM) ctx.playerGEID = nickGeidM[1];
  }

  ingestVehicleSignals(body, ctx, ctx.playerNick, ctx.playerGEID, at);
  const shipLost = tryEmitShipDestruction(
    body,
    at,
    ctx,
    ctx.playerNick,
    ctx.playerGEID,
    beautifyName
  );
  if (shipLost) emit(out, shipLost);

  if (/Incapacitated:/i.test(body) && !/Medical Device/i.test(body)) {
    onIncapacitated(ctx, at, ctx.playerNick);
  }

  if (isCorpseRecoveryLine(body)) {
    onCorpseRecovery(ctx, at);
  }

  const actorDeadM = body.match(
    /\[ActorState\] Dead.*Actor '(?<nick>[^']+)' \[\d+\]/i
  );
  if (actorDeadM?.groups && isPlayerEntity(actorDeadM.groups.nick, ctx.playerNick)) {
    onActorStateDead(ctx, at, body, ctx.playerNick);
    emit(
      out,
      tryEmitCollisionAfterActorDead(
        body,
        at,
        ctx,
        ctx.playerNick,
        ctx.playerGEID,
        beautifyName
      )
    );
  }

  emit(out, tryRespawnFinalize(ctx, at, body, ctx.playerNick));

  const playerJoinedM = body.match(
    /<PlayerJoined>.*mission_id ([a-f0-9-]+) - player_id (\d+)/i
  );
  if (playerJoinedM) {
    registerBountyPlayer(ctx, playerJoinedM[1], playerJoinedM[2], ctx.playerGEID);
  }

  const markerM = body.match(PATTERNS.missionMarker);
  if (markerM?.groups) {
    const { missionId, generator, contract, definitionId } = markerM.groups;
    if (missionId && definitionId) {
      if (!ctx.missionWikiByMissionId) ctx.missionWikiByMissionId = new Map();
      ctx.missionWikiByMissionId.set(missionId, {
        contractDefinitionId: definitionId,
        debugContract: contract,
        generatorName: generator,
      });
    }
  }

  if (PATTERNS.nickname.test(line) && !ctx.playerNick) {
    const m = line.match(PATTERNS.nickname);
    return finish(
      emit(out, {
        type: "meta",
        at,
        summary: `Pilot: ${m[1]}`,
        detail: { playerNick: m[1] },
      })
    );
  }

  if (PATTERNS.connectStarted.test(body)) {
    return finish(
      emit(out, { type: "game", at, summary: "Connecting to Star Citizen…" })
    );
  }

  if (PATTERNS.connected.test(body)) {
    return finish(
      emit(out, { type: "game", at, summary: "Connected to server" })
    );
  }

  if (PATTERNS.spawned.test(body)) {
    const loadoutEv = onPlayerSpawned(ctx, at);
    if (loadoutEv) emit(out, loadoutEv);
    emit(out, {
      type: "spawn",
      at,
      summary: ctx.inUniverse ? "Spawned in universe" : "Spawned (loading)",
    });
    if (ctx.inUniverse) {
      emit(out, tryFinalizeDeath(ctx, at, ctx.playerNick));
    }
    return finish(out);
  }

  if (PATTERNS.inUniverse.test(line)) {
    return finish(
      emit(out, {
        type: "meta",
        at,
        summary: "Entered Persistent Universe",
        detail: { inUniverse: true },
      })
    );
  }

  if (PATTERNS.quitLobby.test(body) || PATTERNS.systemQuit.test(body)) {
    const loadoutEv = flushLoadoutBatch(ctx);
    if (loadoutEv) emit(out, loadoutEv);
    return finish(
      emit(out, { type: "session_end", at, summary: "Game session ended" })
    );
  }

  if (PATTERNS.contractBroker.test(body)) {
    return finish(
      emit(out, {
        type: "meta",
        at,
        summary: "Contract manager online",
        detail: { inUniverse: true },
      })
    );
  }

  const endMissionM = body.match(
    /<EndMission>\s*Ending mission for player\.\s*MissionId\[(?<missionId>[a-f0-9-]+)\].*?CompletionType\[(?<completion>[^\]]+)\](?:\s*Reason\[(?<reason>[^\]]+)\])?/i
  );
  if (endMissionM?.groups && /^Abandon$/i.test(endMissionM.groups.completion)) {
    return {
      type: "contract",
      at,
      summary: "Abandoned contract",
      detail: {
        action: "abandoned",
        missionId: endMissionM.groups.missionId,
        reason: endMissionM.groups.reason?.trim() || null,
      },
    };
  }

  const missionEndedM = body.match(
    /<MissionEnded>.*mission_id (?<missionId>[a-f0-9-]+).*mission_state (?<state>MISSION_STATE_\w+)/i
  );
  if (missionEndedM?.groups && /ABANDON/i.test(missionEndedM.groups.state)) {
    return {
      type: "contract",
      at,
      summary: "Abandoned contract (mission ended)",
      detail: {
        action: "abandoned",
        missionId: missionEndedM.groups.missionId,
        reason: missionEndedM.groups.state,
      },
    };
  }

  if (PATTERNS.channelDisconnected.test(body)) {
    const reason = body.match(PATTERNS.channelDisconnected)?.groups?.reason || "disconnected";
    return {
      type: "network",
      at,
      summary: `Disconnected from server (${reason})`,
      detail: { reason },
    };
  }

  if (/UpdateNotificationItem> Notification /.test(body)) {
    return finish(out);
  }

  let m = body.match(PATTERNS.actorDeath);
  if (m?.groups) {
    const { victim, killer, zone, weapon, damageType } = m.groups;
    const you = isPlayerEntity(victim, ctx.playerNick);
    const youKilled = isPlayerEntity(killer, ctx.playerNick);
    if (you || youKilled) {
      return {
        type: "combat",
        at,
        summary: you
          ? `Died in ${beautifyName(zone)}. Killed by ${beautifyName(killer)} (${beautifyName(weapon)}, ${beautifyName(damageType)})`
          : `Killed ${beautifyName(victim)} (${beautifyName(zone)})`,
        detail: {
          victim,
          killer,
          zone,
          weapon,
          damageType,
          youDied: you,
          youKilled,
        },
      };
    }
  }

  m = body.match(PATTERNS.quantum);
  if (m?.groups) {
    const { fromSystem, toSystem, fromZone, toZone } = m.groups;
    return {
      type: "travel",
      at,
      summary: `QT ${beautifyName(fromSystem)} → ${beautifyName(toSystem)}`,
      detail: { fromSystem, toSystem, fromZone, toZone, source: "zone_transition" },
    };
  }

  m = body.match(PATTERNS.quantumArrived);
  if (m?.groups) {
    const shipClass = shipClassFromQtKey(m.groups.shipKey);
    const shipLabel = formatShipClassLabel(shipClass) || shipClass || "Unknown ship";
    return {
      type: "travel",
      at,
      summary: `QT arrived (${shipLabel})`,
      detail: {
        shipClass,
        shipLabel,
        entityId: m.groups.entityId || null,
        source: "quantum_arrived",
      },
    };
  }

  m = body.match(PATTERNS.notificationAdded) || body.match(PATTERNS.notification);
  if (m?.groups) {
    const text = m.groups.text.trim().replace(/\s+/g, " ");
    let missionId = m.groups.missionId;
    markHudTextSeen(ctx, text);
    if (isNoiseNotification(text)) return finish(out);

    if (/^Journal Entry Added:/i.test(text)) {
      const title = text.replace(/^Journal Entry Added:\s*/i, "").replace(/:\s*$/, "").trim();
      return finish(
        emit(out, {
          type: "journal",
          at,
          summary: `Journal: ${title}`,
          detail: { title },
        })
      );
    }

    if (/^Contract Accepted:/i.test(text)) {
      const rawTitle = text.replace(/^Contract Accepted:\s*/i, "").trim();
      const title = stripHudMarkup(rawTitle);
      const wikiMeta = ctx.missionWikiByMissionId?.get(missionId);
      const acceptPayout = parseContractPayoutFromTitle(rawTitle);
      if (missionId && missionId !== ZERO_MISSION) {
        if (acceptPayout.auec != null || acceptPayout.rep != null) {
          if (!ctx.contractPayoutByMission) ctx.contractPayoutByMission = new Map();
          ctx.contractPayoutByMission.set(missionId, acceptPayout);
        }
      }
      return finish(
        emit(out, {
          type: "contract",
          at,
          summary: `Accepted: ${title}`,
          detail: {
            action: "accepted",
            title,
            missionId,
            contractDefinitionId: wikiMeta?.contractDefinitionId || null,
            debugContract: wikiMeta?.debugContract || null,
            faction: acceptPayout.faction || null,
          },
        })
      );
    }
    if (/^Contract Complete:/i.test(text)) {
      const rawTitle = text.replace(/^Contract Complete:\s*/i, "").trim();
      const title = stripHudMarkup(rawTitle);
      if (missionId && missionId !== ZERO_MISSION) {
        emit(out, tryBountyKill(ctx, missionId, at, title, beautifyName));
        queueCompletedContract(ctx, missionId, title, at);
      }
      ctx.lastCompletedMissionId = missionId;
      ctx.lastCompletedContractTitle = title;
      ctx.lastCompletedAt = at;
      const wikiMeta = ctx.missionWikiByMissionId?.get(missionId);
      const payout = parseContractPayoutFromTitle(rawTitle);
      if (missionId && ctx.contractPayoutByMission?.has(missionId)) {
        const expected = ctx.contractPayoutByMission.get(missionId);
        if (payout.auec == null && expected.auec != null) payout.auec = expected.auec;
        if (payout.rep == null && expected.rep != null) payout.rep = expected.rep;
        if (!payout.faction && expected.faction) payout.faction = expected.faction;
        finalizeRewardKind(payout);
        ctx.contractPayoutByMission.delete(missionId);
      }
      emit(out, {
        type: "contract",
        at,
        summary: `Completed: ${title}`,
        detail: {
          action: "completed",
          title,
          missionId,
          contractDefinitionId: wikiMeta?.contractDefinitionId || null,
          debugContract: wikiMeta?.debugContract || null,
          faction: payout.faction || null,
        },
      });
      if (payout.rep != null || payout.auec != null) {
        const rewardDetail = {
          missionId:
            missionId && missionId !== ZERO_MISSION ? missionId : null,
          raw: rawTitle,
          kind: payout.kind,
          auec: payout.auec,
          rep: payout.rep,
          faction: payout.faction,
          itemCount: null,
          itemName: null,
          itemQuantity: null,
          blueprintName: null,
          deliveryNote: null,
          contractTitle: title,
          linkedFromContractComplete: true,
        };
        emit(out, {
          type: "reward",
          at,
          summary: `Earned: ${rewardSummaryFromDetail(rewardDetail, rawTitle)}`,
          detail: rewardDetail,
        });
      }
      return finish(out);
    }
    if (/^Contract Failed:/i.test(text)) {
      const title = stripHudMarkup(text.replace(/^Contract Failed:\s*/i, "").trim());
      return finish(
        emit(out, {
          type: "contract",
          at,
          summary: `Failed: ${title}`,
          detail: { action: "failed", title, missionId },
        })
      );
    }
    if (/^Contract Abandoned:/i.test(text)) {
      const title = stripHudMarkup(text.replace(/^Contract Abandoned:\s*/i, "").trim());
      return finish(
        emit(out, {
          type: "contract",
          at,
          summary: `Abandoned: ${title}`,
          detail: { action: "abandoned", title, missionId },
        })
      );
    }
    if (/^You've Earned:/i.test(text) || /^You have earned:/i.test(text)) {
      const detail = parseEarnedBody(text, missionId, ctx);
      return finish(
        emit(out, {
          type: "reward",
          at,
          summary: `Earned: ${rewardSummaryFromDetail(detail, text)}`,
          detail,
        })
      );
    }
    const awarded = buildAwardedAuecReward(text, missionId, ctx);
    if (awarded) {
      awarded.at = at;
      if (awarded.detail) {
        awarded.detail.auecConfirmed = true;
        awarded.detail.auecEstimated = false;
      }
      return finish(emit(out, awarded));
    }
    const fine = buildFineEvent(text);
    if (fine) {
      fine.at = at;
      return finish(emit(out, fine));
    }
    if (/^Incapacitated:/i.test(text)) {
      onIncapacitated(ctx, at, ctx.playerNick);
      return finish(
        emit(out, {
          type: "combat",
          at,
          summary: "Incapacitated (downed)",
          detail: { youDowned: true, incapAt: at },
        })
      );
    }

    if (/^New Objective:/i.test(text)) {
      if (missionId && missionId !== ZERO_MISSION) {
        registerBountyObjective(ctx, missionId, text);
        const title = parseObjectiveTitle(text);
        if (title) {
          emit(out, {
            type: "contract_objective",
            at,
            summary: `Objective: ${title}`,
            detail: { missionId, title, action: "added" },
          });
        }
      }
      return finish(out);
    }
    if (/^Objective Complete:/i.test(text)) {
      if (missionId && missionId !== ZERO_MISSION) {
        const title = parseObjectiveTitle(text);
        if (title) {
          emit(out, {
            type: "contract_objective",
            at,
            summary: `Objective done: ${title}`,
            detail: { missionId, title, action: "completed" },
          });
        }
      }
      return finish(out);
    }
    if (/^Objective Withdrawn:/i.test(text)) {
      if (missionId && missionId !== ZERO_MISSION) {
        const title = parseObjectiveTitle(text);
        if (title) {
          emit(out, {
            type: "contract_objective",
            at,
            summary: `Objective withdrawn: ${title}`,
            detail: { missionId, title, action: "withdrawn" },
          });
        }
      }
      return finish(out);
    }
    if (/blueprint/i.test(text)) {
      const cleanedText = stripHudMarkup(text);
      const detail = parseRewardDetail(cleanedText, missionId);
      detail.kind = "blueprint";
      detail.raw = cleanedText;
      const summaryName = detail.blueprintName || cleanedText;
      return finish(
        emit(out, {
          type: "blueprint",
          at,
          summary: summaryName,
          detail,
        })
      );
    }

    if (missionId && missionId !== "00000000-0000-0000-0000-000000000000") {
      if (/aUEC|reputation|earned|reward/i.test(text)) {
        const detail = parseEarnedBody(text, missionId, ctx);
        return finish(
          emit(out, {
            type: "reward",
            at,
            summary: `Earned: ${rewardSummaryFromDetail(detail, text)}`,
            detail,
          })
        );
      }
    }
  }

  return finish(out);
}

module.exports = {
  parseLine,
  parseHudContinuation,
  beautifyName,
  parseObjectiveTitle,
  extractTimestamp,
  parseRewardDetail,
  rewardSummaryFromDetail,
  isAsopActive,
  isPlayerInsuranceUrn,
};
