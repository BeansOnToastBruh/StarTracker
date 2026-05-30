const HANGAR_SPAWN_WINDOW_MS = 90_000;
/** Still treat as "your ship" shortly after last pilot / control lines. */
const PILOT_RECENCY_MS = 20 * 60 * 1000;
/** Planet-kill spams many lines; separate incidents are usually minutes apart. */
const DESTROY_DEDUPE_MS = 45 * 60 * 1000;

const SHIP_CHANNEL_YOURS =
  /(?:Added notification|Notification) .*joined channel '[^']+ : ([^']+)'/i;

const PLANET_KILL_DESTROYED =
  /CEntityComponentPlanetKillVolume::Update: Entity '(?<vehicle>[^']+)' \[(?<entityId>\d+)\] in zone '(?<zone>[^']+)'[\s\S]*?destroyed by planet kill volume/i;

const FATAL_COLLISION_PILOT =
  /<FatalCollision> Fatal Collision occured for vehicle (?<vehicle>[^[]+) \[Part: [^\]]+, Pos: .+?, Zone: (?<zone>[^,]+), PlayerPilot: 1\]/i;

const PILOTING_NAV =
  /\| NOT AUTH \| ([^[\|]+)\[(\d+)\]\|CSCItemNavigation/i;

const VEHICLE_DESTROY_LEVEL =
  /CVehicle::OnAdvanceDestroyLevel: Vehicle '(?<vehicle>[^']+)' \[(?<entityId>\d+)\] in zone '(?<zone>[^']+)'(?: \[[^\]]+\])? .*?driven by '(?<driver>[^']+)' \[\d+\] advanced from destroy level (?<destroyFrom>\d+) to (?<destroyTo>\d+) caused by '(?<causer>[^']+)' \[\d+\] with '(?<cause>[^']+)'/i;

/** Root hull prefixes (subcomponents like HTNK_/QTNK_ are excluded). */
const FLYABLE_HULL =
  /^(RSI|ANVL|ORIG|DRAK|AEGS|MISC|CRUS|CNST|CNOU|GLSN|MRAI|ARGO|XIAN|ESPR|GAMA|KRIG|LGMN|TMBL|AOPA|DRAK|GRIN)_/i;

const NOT_A_HULL =
  /^(HTNK|QTNK|MineableRock|GroundVehicle|AImodule|Player_|body_|PlanetKill|LoadingPlatform|FreightElevator|ShipElevator)/i;

function createVehicleCtx() {
  return {
    /** @type {Map<string, { name: string, reason: string }>} */
    ownedVehicleIds: new Map(),
    /** @type {Map<string, string>} entityId -> last loss ISO timestamp */
    destroyedVehicleIds: new Map(),
    /** @type {Map<string, { at: string, vehicle: string, zone: string }>} */
    pendingPilotCollisions: new Map(),
    /** Last hull you were actively flying (nav / control token). */
    lastPilotedVehicle: null,
    lastHangarCompleteAt: null,
    lastHangarDedupeClear: null,
  };
}

function parseEntityRef(entityName) {
  if (!entityName) return null;
  const m = entityName.match(/^(.+)_(\d{9,})$/);
  if (!m) return { name: entityName, id: null };
  return { name: entityName, id: m[2], hull: m[1] };
}

function isFlyableHull(entityName) {
  if (!entityName || NOT_A_HULL.test(entityName)) return false;
  const { hull } = parseEntityRef(entityName);
  const base = hull || entityName;
  return FLYABLE_HULL.test(base);
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

function isLocalPlayerGeid(geid, ctx) {
  return geid && ctx.playerGEID && geid === ctx.playerGEID;
}

const WEAK_OWNERSHIP_REASONS = new Set(["ship_channel"]);

function registerOwned(ctx, entityId, entityName, reason) {
  if (!entityId || !isFlyableHull(entityName)) return;
  const prev = ctx.ownedVehicleIds.get(entityId);
  if (
    !prev ||
    !WEAK_OWNERSHIP_REASONS.has(reason) ||
    WEAK_OWNERSHIP_REASONS.has(prev.reason)
  ) {
    ctx.ownedVehicleIds.set(entityId, { name: entityName, reason });
  }
}

function notePiloting(ctx, entityId, entityName, at, reason) {
  if (!entityId || !entityName || !at) return;
  ctx.lastPilotedVehicle = { entityId, name: entityName, at };
  registerOwned(ctx, entityId, entityName, reason);
}

function wasRecentlyPiloted(ctx, entityId, at) {
  const lp = ctx.lastPilotedVehicle;
  if (!lp || lp.entityId !== entityId || !at) return false;
  const gap = new Date(at).getTime() - new Date(lp.at).getTime();
  return gap >= 0 && gap <= PILOT_RECENCY_MS;
}

function maybeRegisterFromHangarControl(ctx, entityName, entityId, at) {
  if (!ctx.lastHangarCompleteAt || !entityId || !at) return;
  const elapsed = new Date(at).getTime() - new Date(ctx.lastHangarCompleteAt).getTime();
  if (elapsed < 0 || elapsed > HANGAR_SPAWN_WINDOW_MS) return;
  registerOwned(ctx, entityId, entityName, "hangar_spawn");
}

function hasForeignDriver(body, playerNick) {
  const m = body.match(/driven by '([^']+)'/i);
  if (!m) return false;
  return !isPlayerEntity(m[1], playerNick);
}

/**
 * Only hulls you were already tied to (registry / recent pilot / you driving at destroy).
 * Planet-kill spam on other players' ships never passes without a prior pilot signal.
 */
function resolveOwnership(
  ctx,
  entityId,
  entityName,
  { driver, playerNick, body, at, allowDriverAtDestroy = false }
) {
  if (hasForeignDriver(body, playerNick)) {
    return { owned: false, level: null, reason: null };
  }

  if (entityId && ctx.ownedVehicleIds.has(entityId)) {
    return {
      owned: true,
      level: "confirmed",
      reason: ctx.ownedVehicleIds.get(entityId).reason,
    };
  }

  if (entityId && at && wasRecentlyPiloted(ctx, entityId, at)) {
    registerOwned(ctx, entityId, entityName, "recent_pilot");
    return { owned: true, level: "confirmed", reason: "recent_pilot" };
  }

  if (
    allowDriverAtDestroy &&
    driver &&
    isPlayerEntity(driver, playerNick) &&
    entityId
  ) {
    registerOwned(ctx, entityId, entityName, "driver_at_destroy");
    return { owned: true, level: "confirmed", reason: "driver_at_destroy" };
  }

  return { owned: false, level: null, reason: null };
}

function ownershipLabel(reason) {
  const labels = {
    control_token: "You had ship control",
    hangar_spawn: "Spawned from hangar and you took control",
    piloting: "You were actively piloting",
    recent_pilot: "You were piloting this hull shortly before it was destroyed",
    driver_at_destroy: "You were the driver when the hull was destroyed",
    driver_line: "You were driving this ship",
    ship_channel: "Your name on the ship comms channel while flying",
  };
  return labels[reason] || "Matched to your character";
}

function notePilotCollision(ctx, entityId, vehicle, zone, at) {
  if (!entityId) return;
  ctx.pendingPilotCollisions.set(entityId, { at, vehicle, zone });
}

function tryEmitPendingCollision(ctx, entityId, at, playerNick, playerGEID, beautifyName, confirmReason) {
  const pending = ctx.pendingPilotCollisions.get(entityId);
  if (!pending) return null;
  const gap = new Date(at).getTime() - new Date(pending.at).getTime();
  if (gap < 0 || gap > 60_000) return null;

  const ownership = resolveOwnership(ctx, entityId, pending.vehicle, {
    playerNick,
    body: "",
    at,
  });
  if (!ownership.owned) {
    ctx.pendingPilotCollisions.delete(entityId);
    return null;
  }
  if (!shouldEmitDestruction(ctx, entityId, pending.at)) {
    ctx.pendingPilotCollisions.delete(entityId);
    return null;
  }

  markDestruction(ctx, entityId, pending.at);
  ctx.pendingPilotCollisions.delete(entityId);

  const shipLabel = beautifyName(pending.vehicle);
  const zoneLabel = beautifyName(pending.zone);
  return buildShipLostEvent(pending.at, {
    vehicle: pending.vehicle,
    entityId,
    zone: pending.zone,
    driver: null,
    causer: confirmReason,
    cause: "Fatal collision (player pilot)",
    method: "fatal_collision",
    ownership: ownership.level,
    ownershipReason: ownership.reason,
    ownershipNote: ownershipLabel(ownership.reason),
    shipLabel,
    zoneLabel,
    yours: true,
  });
}

/** Track ownership hints before destruction lines are parsed. */
function ingestVehicleSignals(body, ctx, playerNick, playerGEID, at) {
  if (/Added notification "Hangar Request Completed/i.test(body) && at) {
    ctx.lastHangarCompleteAt = at;
    const lastClear = ctx.lastHangarDedupeClear;
    if (!lastClear || new Date(at).getTime() - new Date(lastClear).getTime() > 60_000) {
      ctx.destroyedVehicleIds.clear();
      ctx.lastHangarDedupeClear = at;
    }
  }

  let m = body.match(
    /VehicleListQuery> Fetching vehicle list for player (\d+) completed/i
  );
  if (m && isLocalPlayerGeid(m[1], ctx)) {
    ctx.playerGEID = ctx.playerGEID || m[1];
  }

  m = body.match(PILOTING_NAV);
  if (m && ctx.inUniverse) {
    notePiloting(ctx, m[2], m[1].trim(), at, "piloting");
  }

  m = body.match(SHIP_CHANNEL_YOURS);
  if (m && isPlayerEntity(m[1], playerNick) && ctx.lastPilotedVehicle?.entityId) {
    const lp = ctx.lastPilotedVehicle;
    registerOwned(ctx, lp.entityId, lp.name, "ship_channel");
  }

  m = body.match(
    /Local client node \[(\d+)\] (acquiring|releasing) control token for '([^']+)' \[(\d+)\]/i
  );
  if (m && isLocalPlayerGeid(m[1], ctx)) {
    const action = m[2].toLowerCase();
    if (action === "acquiring") {
      maybeRegisterFromHangarControl(ctx, m[3], m[4], at);
    }
    notePiloting(ctx, m[4], m[3], at, "control_token");
    return;
  }

  m = body.match(/driven by '([^']+)' \[\d+\]/i);
  if (m && isPlayerEntity(m[1], playerNick) && ctx.inUniverse) {
    const ent = body.match(/Vehicle '([^']+)' \[(\d+)\]/i);
    if (ent) notePiloting(ctx, ent[2], ent[1], at, "driver_line");
  }

}

function shouldEmitDestruction(ctx, entityId, at) {
  const prev = ctx.destroyedVehicleIds.get(entityId);
  if (!prev) return true;
  const gap = new Date(at).getTime() - new Date(prev).getTime();
  return gap > DESTROY_DEDUPE_MS;
}

function markDestruction(ctx, entityId, at) {
  ctx.destroyedVehicleIds.set(entityId, at);
}

function buildShipLostEvent(at, detail) {
  return {
    type: "vehicle",
    at,
    summary: `Ship lost: ${detail.shipLabel} (${detail.zoneLabel}). ${detail.cause}`,
    detail: { ...detail, yours: true },
  };
}

function tryEmitShipDestruction(body, at, ctx, playerNick, playerGEID, beautifyName) {
  if (/starting countdown/i.test(body) && /planet kill volume/i.test(body)) {
    return null;
  }

  let m = body.match(VEHICLE_DESTROY_LEVEL);
  if (m?.groups) {
    const { vehicle, entityId, zone, driver, causer, cause, destroyTo, destroyFrom } =
      m.groups;
    if (!isFlyableHull(vehicle)) return null;

    const ownership = resolveOwnership(ctx, entityId, vehicle, {
      driver,
      playerNick,
      body,
      at,
      allowDriverAtDestroy: true,
    });
    if (!ownership.owned) return null;
    if (!shouldEmitDestruction(ctx, entityId, at)) return null;
    markDestruction(ctx, entityId, at);

    const shipLabel = beautifyName(vehicle);
    const zoneLabel = beautifyName(zone);
    return buildShipLostEvent(at, {
      vehicle,
      entityId,
      zone,
      driver,
      causer,
      cause: cause || "Unknown",
      method: "destroy_level",
      ownershipNote: ownershipLabel(ownership.reason),
      destroyLevelFrom: destroyFrom,
      destroyLevelTo: destroyTo,
      ownership: ownership.level,
      ownershipReason: ownership.reason,
      shipLabel,
      zoneLabel,
      yours: true,
    });
  }

  m = body.match(PLANET_KILL_DESTROYED);
  if (m?.groups) {
    const { vehicle, entityId, zone } = m.groups;
    if (!isFlyableHull(vehicle)) return null;

    const ownership = resolveOwnership(ctx, entityId, vehicle, {
      playerNick,
      body,
      at,
    });
    if (!ownership.owned) return null;
    if (!shouldEmitDestruction(ctx, entityId, at)) return null;
    markDestruction(ctx, entityId, at);

    const shipLabel = beautifyName(vehicle);
    const zoneLabel = beautifyName(zone);
    return buildShipLostEvent(at, {
      vehicle,
      entityId,
      zone,
      driver: null,
      causer: "Planet",
      cause: "Planet kill boundary",
      method: "planet_kill",
      ownershipNote: ownershipLabel(ownership.reason),
      ownership: ownership.level,
      ownershipReason: ownership.reason,
      shipLabel,
      zoneLabel,
      yours: true,
    });
  }

  m = body.match(
    /<Boundary Violation>.*Entity '(?<vehicle>[^']+)' \[(?<entityId>\d+)\] in zone '(?<zone>[^']+)'[\s\S]*?destroyed by '(?<causer>[^']+)'/i
  );
  if (m?.groups && !/planet kill volume/i.test(body)) {
    const { vehicle, entityId, zone, causer } = m.groups;
    if (!isFlyableHull(vehicle)) return null;

    const ownership = resolveOwnership(ctx, entityId, vehicle, {
      playerNick,
      body,
      at,
    });
    if (!ownership.owned) return null;
    if (!shouldEmitDestruction(ctx, entityId, at)) return null;
    markDestruction(ctx, entityId, at);

    const shipLabel = beautifyName(vehicle);
    const zoneLabel = beautifyName(zone);
    const cause = causer.includes("PlanetKill")
      ? "Planet kill boundary"
      : beautifyName(causer);
    return buildShipLostEvent(at, {
      vehicle,
      entityId,
      zone,
      driver: null,
      causer,
      cause,
      method: "boundary",
      ownershipNote: ownershipLabel(ownership.reason),
      ownership: ownership.level,
      ownershipReason: ownership.reason,
      shipLabel,
      zoneLabel,
      yours: true,
    });
  }

  m = body.match(FATAL_COLLISION_PILOT);
  if (m?.groups) {
    const { vehicle, zone } = m.groups;
    const vehicleTrim = vehicle.trim();
    if (!isFlyableHull(vehicleTrim)) return null;

    const { id: entityId } = parseEntityRef(vehicleTrim);
    if (!entityId) return null;

    const ownership = resolveOwnership(ctx, entityId, vehicleTrim, {
      playerNick,
      body,
      at,
    });
    if (!ownership.owned) return null;

    notePilotCollision(ctx, entityId, vehicleTrim, zone, at);
    return null;
  }

  return null;
}

function tryEmitCollisionAfterActorDead(body, at, ctx, playerNick, playerGEID, beautifyName) {
  const m = body.match(
    /\[ActorState\] Dead.*ejected from zone '([^']+)' \[(\d+)\].*destroyed vehicle/i
  );
  if (!m) return null;
  return tryEmitPendingCollision(
    ctx,
    m[2],
    at,
    playerNick,
    playerGEID,
    beautifyName,
    "Vehicle destroyed"
  );
}

module.exports = {
  createVehicleCtx,
  ingestVehicleSignals,
  tryEmitShipDestruction,
  tryEmitCollisionAfterActorDead,
  isFlyableHull,
  registerOwned,
  resolveOwnership,
  ownershipLabel,
};
