const DEATH_RESPAWN_MS = 3 * 60 * 1000;
/** Ignore corpse/respawn signals in the first few seconds after incap (weapon swap noise). */
const MIN_MS_AFTER_INCAP = 8_000;
/** Downed but revived — abandon stale incap if corpse comes much later. */
const MAX_MS_INCAP_TO_CORPSE = 20 * 60 * 1000;
const GENERIC_NEUTRALIZE = /^target$/i;

function createCombatCtx() {
  return {
    deathSeq: null,
    /** @type {Map<string, { targetName: string, otherPlayerIds: Set<string>, killEmitted: boolean }>} */
    bountyMissions: new Map(),
  };
}

function ensureBountyMission(ctx, missionId) {
  if (!missionId || missionId === "00000000-0000-0000-0000-000000000000") return null;
  if (!ctx.bountyMissions.has(missionId)) {
    ctx.bountyMissions.set(missionId, {
      targetName: null,
      otherPlayerIds: new Set(),
      killEmitted: false,
    });
  }
  return ctx.bountyMissions.get(missionId);
}

function parseNeutralizeTarget(text) {
  const cleaned = text.replace(/^New Objective:\s*/i, "").replace(/:\s*$/, "").trim();
  const m = cleaned.match(/^Neutralize\s+(.+)$/i);
  if (!m) return null;
  const name = m[1].trim();
  if (!name || GENERIC_NEUTRALIZE.test(name)) return null;
  return name;
}

function isPlayerLikeTarget(name) {
  return /^[A-Za-z][A-Za-z0-9]*_\d+$/i.test(name) || /^[A-Za-z0-9]+_[A-Za-z0-9_]+$/.test(name);
}

function onActorStateDead(ctx, at, body, playerNick) {
  if (!playerNick) return;

  const zoneM = body.match(
    /ejected from zone '([^']+)' \[\d+\] to zone '([^']+)'/i
  );
  const fromVehicle = zoneM?.[1] || null;
  const toZone = zoneM?.[2] || null;
  const vehicleDeath = /destroyed vehicle/i.test(body);

  if (ctx.deathSeq?.emitted) {
    ctx.deathSeq = {
      incapAt: null,
      corpseAt: at,
      emitted: false,
      deathKind: vehicleDeath ? "vehicle_destroyed" : "actor_dead",
      fromVehicle,
      toZone,
    };
    return;
  }

  if (ctx.deathSeq && !ctx.deathSeq.emitted) {
    if (!ctx.deathSeq.corpseAt) {
      ctx.deathSeq.corpseAt = at;
      ctx.deathSeq.deathKind = vehicleDeath ? "vehicle_destroyed" : "actor_dead";
      ctx.deathSeq.fromVehicle = fromVehicle;
      ctx.deathSeq.toZone = toZone;
    }
    return;
  }

  ctx.deathSeq = {
    incapAt: null,
    corpseAt: at,
    emitted: false,
    deathKind: vehicleDeath ? "vehicle_destroyed" : "actor_dead",
    fromVehicle,
    toZone,
  };
}

function onIncapacitated(ctx, at, playerNick) {
  if (ctx.deathSeq?.emitted) {
    ctx.deathSeq = { incapAt: at, corpseAt: null, emitted: false };
    return;
  }
  if (ctx.deathSeq && !ctx.deathSeq.emitted) {
    if (!ctx.deathSeq.incapAt) ctx.deathSeq.incapAt = at;
    return;
  }
  ctx.deathSeq = { incapAt: at, corpseAt: null, emitted: false };
}

function onCorpseRecovery(ctx, at) {
  if (ctx.deathSeq?.emitted) {
    ctx.deathSeq = { incapAt: null, corpseAt: at, emitted: false };
    return;
  }

  if (
    ctx.deathSeq?.incapAt &&
    !ctx.deathSeq.corpseAt &&
    new Date(at).getTime() - new Date(ctx.deathSeq.incapAt).getTime() > MAX_MS_INCAP_TO_CORPSE
  ) {
    ctx.deathSeq = { incapAt: null, corpseAt: at, emitted: false };
    return;
  }

  if (!ctx.deathSeq) {
    ctx.deathSeq = { incapAt: null, corpseAt: at, emitted: false };
    return;
  }

  if (ctx.deathSeq.corpseAt) {
    if (new Date(at).getTime() > new Date(ctx.deathSeq.corpseAt).getTime()) {
      ctx.deathSeq.corpseAt = at;
    }
    return;
  }

  if (ctx.deathSeq.incapAt) {
    const dt = new Date(at).getTime() - new Date(ctx.deathSeq.incapAt).getTime();
    if (dt < MIN_MS_AFTER_INCAP) return;
  }

  ctx.deathSeq.corpseAt = at;
}

function buildIncapDeathEvent(ctx, at, playerNick) {
  const seq = ctx.deathSeq;
  if (!seq || seq.emitted || !seq.corpseAt) return null;

  const respawn = new Date(at).getTime();
  const corpse = new Date(seq.corpseAt).getTime();
  if (respawn < corpse || respawn - corpse > DEATH_RESPAWN_MS) return null;

  const incapAt = seq.incapAt || seq.corpseAt;
  const hadIncap = Boolean(seq.incapAt);
  const vehicleDeath = seq.deathKind === "vehicle_destroyed";

  let summary;
  if (vehicleDeath) {
    summary = "Died and respawned (killed in destroyed vehicle)";
  } else if (seq.deathKind === "actor_dead") {
    summary = "Died and respawned (instant death, no incap/corpse in log)";
  } else if (hadIncap) {
    summary = "Downed and respawned (incapacitated → corpse recovery)";
  } else {
    summary = "Died and respawned (corpse recovery, incap not in log)";
  }

  seq.emitted = true;
  const event = {
    type: "combat",
    at: incapAt,
    summary,
    detail: {
      youDied: true,
      deathKind: seq.deathKind || "incap_sequence",
      incapAt: seq.incapAt || null,
      corpseAt: seq.corpseAt,
      respawnAt: at,
      incapMissingInLog: !hadIncap,
      killer: "Unknown",
      weapon: "n/a",
      zone: seq.toZone || "n/a",
      fromVehicle: seq.fromVehicle || null,
      victim: playerNick || "You",
    },
  };
  ctx.deathSeq = null;
  return event;
}

function isCorpseRecoveryLine(body) {
  return (
    /CSCActorCorpseUtils::PopulateItemPortForItemRecoveryEntitlement/.test(body) &&
    /Item 'body_01_noMagicPocket/.test(body)
  );
}

function isRespawnLine(body, playerNick, deathSeq) {
  if (!playerNick) return false;
  const nick = playerNick.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (
    new RegExp(
      `Player\\[${nick}\\].*Attachment\\[body_01_noMagicPocket[^\\]]*\\].*Port\\[Body_ItemPort\\]`,
      "i"
    ).test(body)
  ) {
    return true;
  }
  if (/\[CSessionManager::OnClientSpawned\] Spawned!/i.test(body)) {
    return true;
  }
  if (
    deathSeq?.incapAt &&
    new RegExp(
      `Player\\[${nick}\\].*Attachment\\[[^\\]]*361\\d{9,}`,
      "i"
    ).test(body)
  ) {
    return true;
  }
  return false;
}

function tryRespawnFinalize(ctx, at, body, playerNick) {
  if (!ctx.playerNick || !ctx.deathSeq?.corpseAt || ctx.deathSeq.emitted) {
    return null;
  }
  const t = new Date(at).getTime();
  const afterCorpse = t >= new Date(ctx.deathSeq.corpseAt).getTime();
  if (!afterCorpse) return null;

  if (ctx.deathSeq.incapAt) {
    const afterIncap = t - new Date(ctx.deathSeq.incapAt).getTime() >= MIN_MS_AFTER_INCAP;
    if (!afterIncap) return null;
  }

  if (isRespawnLine(body, playerNick, ctx.deathSeq)) {
    return tryFinalizeDeath(ctx, at, playerNick);
  }
  return null;
}

function tryFinalizeDeath(ctx, at, playerNick) {
  if (!ctx.deathSeq?.corpseAt) return null;
  return buildIncapDeathEvent(ctx, at, playerNick);
}

function registerBountyObjective(ctx, missionId, objectiveText) {
  const target = parseNeutralizeTarget(objectiveText);
  if (!target) return;
  const row = ensureBountyMission(ctx, missionId);
  if (row) row.targetName = target;
}

function registerBountyPlayer(ctx, missionId, playerId, selfGeid) {
  const row = ensureBountyMission(ctx, missionId);
  if (!row || !playerId) return;
  if (selfGeid && playerId === selfGeid) return;
  row.otherPlayerIds.add(playerId);
}

function tryBountyKill(ctx, missionId, at, contractTitle, beautifyName) {
  const row = ctx.bountyMissions.get(missionId);
  if (!row?.targetName || row.killEmitted) return null;

  const hasOtherPlayer = row.otherPlayerIds.size > 0;
  const namedPlayer = isPlayerLikeTarget(row.targetName);
  if (!hasOtherPlayer && !namedPlayer) return null;
  if (!hasOtherPlayer) return null;

  row.killEmitted = true;
  const victim = beautifyName(row.targetName);
  return {
    type: "combat",
    at,
    summary: `You neutralized bounty target ${victim}`,
    detail: {
      youKilled: true,
      killKind: "pvp_bounty",
      victim: row.targetName,
      victimLabel: row.targetName,
      missionId,
      contractTitle: contractTitle || null,
      otherPlayerIds: [...row.otherPlayerIds],
      zone: "n/a",
      weapon: "n/a",
    },
  };
}

module.exports = {
  createCombatCtx,
  onActorStateDead,
  onIncapacitated,
  onCorpseRecovery,
  tryFinalizeDeath,
  tryRespawnFinalize,
  isRespawnLine,
  isCorpseRecoveryLine,
  registerBountyObjective,
  registerBountyPlayer,
  tryBountyKill,
  parseNeutralizeTarget,
};
