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
  contractGen: /contract: (?<id>[\w_-]+)/,
  notification:
    /\[Notice\] <SHUDEvent_OnNotification> Added notification "(?<text>[^"]+)" \[\d+\].*MissionId: \[(?<missionId>[^\]]+)\]/,
  contractBroker: /ContractBrokerService/,
  hudContinuation: /^\s*"(?<text>[^"]+)"(?:\s*\[\d+\])?\s*$/,
  channelDisconnected:
    /\[Notice\] <Channel Disconnected>.*gamerules="SC_Default".*reason="(?<reason>[^"]+)"/,
  notificationAdded:
    /Added notification "(?<text>.+?)"\s*\[(?<notifId>\d+)\].*?MissionId: \[(?<missionId>[^\]]+)\]/,
};
const ZERO_MISSION = "00000000-0000-0000-0000-000000000000";
const {
  enrichRewardDetail,
  rewardSummaryFromDetail,
  parseAwardedAuec,
  parseFinedUec,
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

/** HUD "New Objective:" / "Objective Complete:" body (no prefix). */
function parseObjectiveTitle(text) {
  const cleaned = text
    .replace(/^New Objective:\s*/i, "")
    .replace(/^Objective Complete:\s*/i, "")
    .replace(/:\s*$/, "")
    .trim();
  return cleaned || null;
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

function appendCommerceEvents(body, at, ctx, out) {
  const shopBuyM = body.match(
    /SShopBuyRequest.*playerId\[(\d+)\].*shopName\[([^\]]+)\].*client_price\[([\d.]+)\].*itemName\[([^\]]+)\]/gi
  );
  if (shopBuyM) {
    for (const match of shopBuyM) {
      const parts = match.match(
        /SShopBuyRequest.*playerId\[(\d+)\].*shopName\[([^\]]+)\].*client_price\[([\d.]+)\].*itemName\[([^\]]+)\]/i
      );
      if (!parts) continue;
      const [, playerId, shopName, priceRaw, itemName] = parts;
      if (!ctx.playerGEID) ctx.playerGEID = playerId;
      if (playerId !== ctx.playerGEID) continue;
      const price = Number(priceRaw);
      if (!Number.isFinite(price) || price <= 0) continue;
      emit(out, {
        type: "shop_purchase",
        at,
        summary: `Bought ${beautifyName(itemName)} for ${Math.round(price).toLocaleString()} aUEC`,
        detail: {
          shop: beautifyName(shopName),
          item: beautifyName(itemName),
          price,
          playerId,
        },
      });
    }
  }

  if (
    /CWallet::RmMulticastOnProcessClaimCallback/i.test(body) &&
    /Claim Complete/i.test(body)
  ) {
    emit(out, {
      type: "insurance",
      at,
      summary: "Insurance claim completed",
      detail: { action: "claim_complete", raw: body.slice(0, 240) },
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
  if (isNoiseNotification(text)) return null;

  if (/^Contract (Accepted|Complete|Failed|Abandoned):/i.test(text)) return null;
  if (/^Objective Complete:/i.test(text)) return null;
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
      detail: { fromSystem, toSystem, fromZone, toZone },
    };
  }

  m = body.match(PATTERNS.notificationAdded) || body.match(PATTERNS.notification);
  if (m?.groups) {
    const text = m.groups.text.trim().replace(/\s+/g, " ");
    let missionId = m.groups.missionId;
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
      const title = text.replace(/^Contract Accepted:\s*/i, "").trim();
      return finish(
        emit(out, {
          type: "contract",
          at,
          summary: `Accepted: ${title}`,
          detail: { action: "accepted", title, missionId },
        })
      );
    }
    if (/^Contract Complete:/i.test(text)) {
      const title = text.replace(/^Contract Complete:\s*/i, "").trim();
      if (missionId && missionId !== ZERO_MISSION) {
        emit(out, tryBountyKill(ctx, missionId, at, title, beautifyName));
        queueCompletedContract(ctx, missionId, title, at);
      }
      ctx.lastCompletedMissionId = missionId;
      ctx.lastCompletedContractTitle = title;
      ctx.lastCompletedAt = at;
      emit(out, {
        type: "contract",
        at,
        summary: `Completed: ${title}`,
        detail: { action: "completed", title, missionId },
      });
      return finish(out);
    }
    if (/^Contract Failed:/i.test(text)) {
      const title = text.replace(/^Contract Failed:\s*/i, "").trim();
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
      const title = text.replace(/^Contract Abandoned:\s*/i, "").trim();
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
    if (/blueprint/i.test(text)) {
      const detail = parseRewardDetail(text, missionId);
      detail.kind = "blueprint";
      return finish(
        emit(out, {
          type: "blueprint",
          at,
          summary: text,
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
};
