const { randomUUID } = require("crypto");

const MAX_EVENTS = 600;

function createSession(overrides = {}) {
  return {
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: "active",
    playerNick: null,
    inUniverse: false,
    spawnCount: 0,
    events: [],
    stats: {
      deaths: 0,
      kills: 0,
      vehiclesLost: 0,
      contractsAccepted: 0,
      contractsCompleted: 0,
      contractsFailed: 0,
      contractsAbandoned: 0,
      quantumJumps: 0,
      rewards: 0,
      auecEarned: 0,
      auecEstimated: 0,
      flightKmEstimate: 0,
      finesTotal: 0,
      fineCount: 0,
      insuranceClaims: 0,
      shopSpend: 0,
      shopPurchases: 0,
      commodityHauls: 0,
      commodityProfit: 0,
    },
    ...overrides,
  };
}

function applyMeta(session, event) {
  if (event.detail?.playerNick) session.playerNick = event.detail.playerNick;
  if (event.detail?.inUniverse) session.inUniverse = true;
}

function bumpStats(session, event) {
  const s = session.stats;
  switch (event.type) {
    case "combat":
      if (event.detail?.youDied) s.deaths += 1;
      if (event.detail?.youKilled) s.kills += 1;
      break;
    case "vehicle":
      if (event.detail?.yours) s.vehiclesLost += 1;
      break;
    case "contract":
      if (event.detail?.action === "accepted") s.contractsAccepted += 1;
      if (event.detail?.action === "completed") s.contractsCompleted += 1;
      if (event.detail?.action === "failed") s.contractsFailed += 1;
      if (event.detail?.action === "abandoned") s.contractsAbandoned += 1;
      break;
    case "travel":
      s.quantumJumps += 1;
      if (event.detail?.estimatedKm) s.flightKmEstimate += event.detail.estimatedKm;
      break;
    case "reward":
      s.rewards += 1;
      if (event.detail?.auec) {
        if (event.detail.auecEstimated) {
          s.auecEstimated = (s.auecEstimated || 0) + event.detail.auec;
        } else {
          s.auecEarned = (s.auecEarned || 0) + event.detail.auec;
        }
      }
      break;
    case "fine":
      s.fineCount += 1;
      if (event.detail?.amount) s.finesTotal += event.detail.amount;
      break;
    case "insurance":
      if (event.detail?.action === "claim_complete") s.insuranceClaims += 1;
      break;
    case "shop_purchase":
      s.shopPurchases += 1;
      if (event.detail?.price) s.shopSpend += event.detail.price;
      break;
    case "commodity_haul":
      s.commodityHauls += 1;
      if (event.detail?.profit != null) s.commodityProfit += event.detail.profit;
      break;
    default:
      break;
  }
}

function pushEvent(session, event) {
  if (!event) return session;
  if (event.type === "meta") {
    applyMeta(session, event);
    return session;
  }
  if (event.type === "travel" && event.detail?.fromSystem && event.detail?.toSystem) {
    const { estimateJumpKm } = require("./travelEstimate");
    event.detail.estimatedKm = estimateJumpKm(
      event.detail.fromSystem,
      event.detail.toSystem
    );
  }
  if (event.type === "spawn") {
    session.spawnCount += 1;
    if (session.spawnCount >= 2 || session.inUniverse) {
      session.inUniverse = true;
      event.summary = "Spawned in universe";
    }
  }
  bumpStats(session, event);
  session.events.push(event);
  if (session.events.length > MAX_EVENTS) {
    session.events = session.events.slice(-MAX_EVENTS);
  }
  return session;
}

function endSession(session, at) {
  session.status = "ended";
  session.endedAt = at || new Date().toISOString();
  return session;
}

function sessionDurationMs(session) {
  const end = session.endedAt ? new Date(session.endedAt) : new Date();
  const start = new Date(session.startedAt);
  return Math.max(0, end - start);
}

function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function snapshot(session) {
  const { buildRollup } = require("./rollup");
  const base = {
    ...session,
    events: [...session.events],
    stats: { ...session.stats },
    durationLabel: formatDuration(sessionDurationMs(session)),
  };
  base.rollup = buildRollup(base);
  if (base.rollup) {
    base.stats.flightKmEstimate = base.rollup.totalFlightKm;
  }
  return base;
}

const IMPORT_MAX_EVENTS = 8000;

function importEvents(session, events) {
  for (const event of events) {
    if (!event) continue;
    if (event.type === "meta") {
      applyMeta(session, event);
      continue;
    }
    if (event.type === "travel" && event.detail?.fromSystem && event.detail?.toSystem) {
      const { estimateJumpKm } = require("./travelEstimate");
      event.detail.estimatedKm = estimateJumpKm(
        event.detail.fromSystem,
        event.detail.toSystem
      );
    }
    if (event.type === "spawn") {
      session.spawnCount += 1;
      if (session.spawnCount >= 2 || session.inUniverse) {
        session.inUniverse = true;
      }
    }
    bumpStats(session, event);
    session.events.push(event);
  }
  if (session.events.length > IMPORT_MAX_EVENTS) {
    session.events = session.events.slice(-IMPORT_MAX_EVENTS);
  }
  return session;
}

module.exports = {
  createSession,
  pushEvent,
  endSession,
  snapshot,
  formatDuration,
  sessionDurationMs,
  importEvents,
  MAX_EVENTS,
  IMPORT_MAX_EVENTS,
};
