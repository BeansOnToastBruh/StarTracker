const fs = require("fs");
const path = require("path");

const LIGHT_COUNT = 5;
const GREEN_STEP_MS = 12 * 60 * 1000;
const RED_STEP_MS = 24 * 60 * 1000;
const DEFAULT_OPEN_MS = 65 * 60 * 1000 + 93;
const DEFAULT_CLOSE_MS = 120 * 60 * 1000 + 173;

let seedDir = null;
let cacheDir = null;
let userOffsetMs = 0;

function init(options = {}) {
  seedDir = options.seedDir || null;
  cacheDir = options.cacheDir || null;
  userOffsetMs = Number(options.userOffsetMs) || 0;
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function seedPath() {
  return seedDir ? path.join(seedDir, "exec-hangar-timer.json") : null;
}

function cachePath() {
  return cacheDir ? path.join(cacheDir, "exec-hangar-timer-cache.json") : null;
}

function offsetPath() {
  return cacheDir ? path.join(cacheDir, "exec-hangar-offset.json") : null;
}

function loadOffset() {
  const file = offsetPath();
  if (!file) return userOffsetMs;
  const data = readJson(file, null);
  if (data && Number.isFinite(Number(data.offsetMs))) {
    userOffsetMs = Number(data.offsetMs);
  }
  return userOffsetMs;
}

function setUserOffsetMs(ms) {
  userOffsetMs = Number(ms) || 0;
  const file = offsetPath();
  if (file) writeJson(file, { offsetMs: userOffsetMs, updatedAt: new Date().toISOString() });
  return userOffsetMs;
}

function loadConfig() {
  loadOffset();
  const cached = cachePath() ? readJson(cachePath(), null) : null;
  const seeded = seedPath() ? readJson(seedPath(), null) : null;
  const base = cached?.serverStartTimes ? cached : seeded;
  if (!base?.serverStartTimes?.initialOpenTime) {
    return {
      ok: false,
      error: "Executive hangar timer config missing",
      offsetMs: userOffsetMs,
    };
  }
  const sst = base.serverStartTimes;
  return {
    ok: true,
    versionInfo: base.versionInfo || cached?.versionInfo || seeded?.versionInfo || null,
    attribution: base.attribution || seeded?.attribution || null,
    remoteConfigUrl: base.remoteConfigUrl || seeded?.remoteConfigUrl || null,
    initialOpenTime: sst.initialOpenTime,
    openDurationMs: Number(sst.openDurationMs) || DEFAULT_OPEN_MS,
    closeDurationMs: Number(sst.closeDurationMs) || DEFAULT_CLOSE_MS,
    fetchedAt: cached?.fetchedAt || null,
    source: cached?.serverStartTimes ? "cache" : "seed",
    offsetMs: userOffsetMs,
  };
}

async function fetchRemoteConfig() {
  const local = loadConfig();
  const url =
    local.remoteConfigUrl ||
    "https://raw.githubusercontent.com/ArkanisCorporation/Exec-Hangar/main/config.json";
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "StarTracker/1.0",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const json = await res.json();
  if (!json?.serverStartTimes?.initialOpenTime) {
    throw new Error("Remote config missing serverStartTimes.initialOpenTime");
  }
  const payload = {
    ...json,
    remoteConfigUrl: url,
    attribution: local.attribution || {
      name: "ArkanisCorporation / Exec-Hangar",
      url: "https://github.com/ArkanisCorporation/Exec-Hangar",
    },
    fetchedAt: new Date().toISOString(),
  };
  const file = cachePath();
  if (file) writeJson(file, payload);
  return loadConfig();
}

function cycleDurationMs(config) {
  return config.openDurationMs + config.closeDurationMs;
}

function timeInCycleMs(config, atMs) {
  const epoch = new Date(config.initialOpenTime).getTime();
  if (!Number.isFinite(epoch)) return 0;
  const adjusted = atMs + (config.offsetMs || 0);
  const elapsed = adjusted - epoch;
  const cycle = cycleDurationMs(config);
  return ((elapsed % cycle) + cycle) % cycle;
}

/**
 * Light colors for the five hangar LEDs.
 * Ported from community Arkanis Exec-Hangar thresholds (online then charging).
 */
function lightsForTimeInCycle(timeInCycle, openDurationMs) {
  if (timeInCycle < openDurationMs) {
    if (timeInCycle >= GREEN_STEP_MS * LIGHT_COUNT) {
      return Array(LIGHT_COUNT).fill("empty");
    }
    const steps = Math.floor(timeInCycle / GREEN_STEP_MS);
    const greenCount = Math.max(0, LIGHT_COUNT - steps);
    return Array.from({ length: LIGHT_COUNT }, (_, i) => (i < greenCount ? "green" : "empty"));
  }

  const offlineMs = timeInCycle - openDurationMs;
  const greened = Math.min(LIGHT_COUNT - 1, Math.floor(offlineMs / RED_STEP_MS));
  return Array.from({ length: LIGHT_COUNT }, (_, i) => (i < greened ? "green" : "red"));
}

function phaseFor(lights, online) {
  const green = lights.filter((c) => c === "green").length;
  const red = lights.filter((c) => c === "red").length;
  const empty = lights.filter((c) => c === "empty").length;
  const canInsert = green > 0 && red === 0;
  if (online && canInsert) {
    return {
      id: "open",
      label: "OPEN",
      detail: "Insert compboards. Hangar access window.",
      canInsert: true,
    };
  }
  if (online && empty === LIGHT_COUNT) {
    return {
      id: "reset",
      label: "RESET",
      detail: "Blackout / death zone. Evacuate before doors close.",
      canInsert: false,
    };
  }
  if (!online && red > 0) {
    return {
      id: "charging",
      label: "CHARGING",
      detail: "Hangar closed. Red lights turning green.",
      canInsert: false,
    };
  }
  return {
    id: "unknown",
    label: "UNKNOWN",
    detail: "Wait for next light change",
    canInsert: false,
  };
}

function nextBoundaryMs(timeInCycle, openDurationMs, closeDurationMs) {
  const cycle = openDurationMs + closeDurationMs;
  const boundaries = [];
  for (let i = 1; i <= LIGHT_COUNT; i += 1) boundaries.push(i * GREEN_STEP_MS);
  boundaries.push(openDurationMs);
  for (let i = 1; i <= LIGHT_COUNT; i += 1) boundaries.push(openDurationMs + i * RED_STEP_MS);
  boundaries.push(cycle);
  const next = boundaries.find((b) => b > timeInCycle + 0.5);
  return next != null ? next : cycle;
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getStatus(at = Date.now()) {
  const config = loadConfig();
  if (!config.ok) return config;

  const atMs = typeof at === "number" ? at : new Date(at).getTime();
  const tic = timeInCycleMs(config, atMs);
  const online = tic < config.openDurationMs;
  const lights = lightsForTimeInCycle(tic, config.openDurationMs);
  const phase = phaseFor(lights, online);
  const nextBoundary = nextBoundaryMs(tic, config.openDurationMs, config.closeDurationMs);
  const msToLight = nextBoundary - tic;
  const msToPhase = online ? config.openDurationMs - tic : cycleDurationMs(config) - tic;

  const green = lights.filter((c) => c === "green").length;
  const red = lights.filter((c) => c === "red").length;

  return {
    ok: true,
    at: new Date(atMs).toISOString(),
    online,
    status: online ? "ONLINE" : "OFFLINE",
    phase,
    lights,
    greenCount: green,
    redCount: red,
    timeInCycleMs: tic,
    cycleDurationMs: cycleDurationMs(config),
    msToNextLight: msToLight,
    msToPhaseChange: msToPhase,
    nextLightIn: formatDuration(msToLight),
    phaseEndsIn: formatDuration(msToPhase),
    openDurationMs: config.openDurationMs,
    closeDurationMs: config.closeDurationMs,
    initialOpenTime: config.initialOpenTime,
    versionInfo: config.versionInfo,
    attribution: config.attribution,
    fetchedAt: config.fetchedAt,
    source: config.source,
    offsetMs: config.offsetMs,
  };
}

function upcomingEvents(limit = 8, at = Date.now()) {
  const config = loadConfig();
  if (!config.ok) return [];
  const atMs = typeof at === "number" ? at : new Date(at).getTime();
  const events = [];
  let cursor = atMs;
  let guard = 0;
  while (events.length < limit && guard < 40) {
    guard += 1;
    const status = getStatus(cursor);
    if (!status.ok) break;
    const delta = Math.max(1000, status.msToPhaseChange);
    cursor += delta;
    const next = getStatus(cursor);
    events.push({
      at: next.at,
      status: next.status,
      phase: next.phase,
      label: next.online ? "Hangar opens" : "Hangar closes",
    });
  }
  return events;
}

module.exports = {
  init,
  loadConfig,
  fetchRemoteConfig,
  getStatus,
  upcomingEvents,
  setUserOffsetMs,
  loadOffset,
  lightsForTimeInCycle,
  timeInCycleMs,
  formatDuration,
  GREEN_STEP_MS,
  RED_STEP_MS,
  LIGHT_COUNT,
};
