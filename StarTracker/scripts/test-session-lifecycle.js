/**
 * Simulates the Game.log tail replay bug: auto-start from historical events,
 * then a stale session_end must not wipe currentSession.
 */
const { createSession, pushEvent, endSession, snapshot } = require("../electron/session");

let currentSession = null;
let watching = true;

function isStaleSessionEnd(event) {
  if (!currentSession?.startedAt || !event?.at) return false;
  const endMs = new Date(event.at).getTime();
  const startMs = new Date(currentSession.startedAt).getTime();
  if (Number.isNaN(endMs) || Number.isNaN(startMs)) return false;
  return endMs < startMs - 5000;
}

function startSession(firstEventAt) {
  currentSession = createSession({
    status: "active",
    startedAt: firstEventAt,
    events: [
      {
        type: "note",
        at: firstEventAt,
        summary: "Session started (auto)",
      },
    ],
  });
}

function handleLogEvent(event) {
  if (!watching) return;

  if (event.type === "session_end" && currentSession?.status === "active") {
    if (isStaleSessionEnd(event)) return;
    pushEvent(currentSession, event);
    endSession(currentSession, event.at);
    return;
  }

  if (!currentSession && event.type === "contract") {
    startSession(event.at);
  }

  if (!currentSession) return;
  pushEvent(currentSession, event);
}

// Old behavior: startedAt = now, stale quit clears session via finishSession(null)
function simulateOldBug(events) {
  let session = null;
  for (const event of events) {
    if (!session && event.type === "contract") {
      session = createSession({
        startedAt: new Date().toISOString(),
        events: [{ type: "note", at: new Date().toISOString(), summary: "auto" }],
      });
    }
    if (event.type === "session_end" && session?.status === "active") {
      session = null;
      continue;
    }
    if (session) pushEvent(session, event);
  }
  return session;
}

const tail = [
  {
    type: "contract",
    at: "2026-05-30T10:00:00.000Z",
    summary: "Contract accepted",
    detail: { action: "accepted" },
  },
  {
    type: "contract",
    at: "2026-05-30T10:05:00.000Z",
    summary: "Contract complete",
    detail: { action: "completed" },
  },
  {
    type: "session_end",
    at: "2026-05-30T10:45:00.000Z",
    summary: "Game session ended",
  },
];

for (const event of tail) handleLogEvent(event);

const snap = currentSession ? snapshot(currentSession) : null;
const old = simulateOldBug(tail);

function isStaleSessionEndFor(session, event) {
  if (!session?.startedAt || !event?.at) return false;
  const endMs = new Date(event.at).getTime();
  const startMs = new Date(session.startedAt).getTime();
  if (Number.isNaN(endMs) || Number.isNaN(startMs)) return false;
  return endMs < startMs - 5000;
}

function simulateFixedWithWallClockStart(events) {
  let session = null;
  for (const event of events) {
    if (event.type === "session_end" && session?.status === "active") {
      if (isStaleSessionEndFor(session, event)) continue;
      pushEvent(session, event);
      endSession(session, event.at);
      continue;
    }
    if (!session && event.type === "contract") {
      session = createSession({
        startedAt: new Date().toISOString(),
        events: [{ type: "note", at: new Date().toISOString(), summary: "auto" }],
      });
    }
    if (!session) continue;
    pushEvent(session, event);
  }
  return session;
}

const tailPastQuit = [
  {
    type: "contract",
    at: "2026-05-29T10:00:00.000Z",
    summary: "Contract accepted",
    detail: { action: "accepted" },
  },
  {
    type: "session_end",
    at: "2026-05-29T10:45:00.000Z",
    summary: "Game session ended",
  },
];

const wallClock = simulateFixedWithWallClockStart(tailPastQuit);

console.log(
  JSON.stringify(
    {
      fixedSessionKept: !!currentSession,
      fixedEventCount: currentSession?.events.length ?? 0,
      fixedStatus: currentSession?.status ?? null,
      fixedRollupContracts: snap?.rollup?.completed?.length ?? 0,
      wallClockStatus: wallClock?.status ?? null,
      wallClockKept: !!wallClock,
      oldBugSessionKept: !!old,
      oldBugEventCount: old?.events.length ?? 0,
    },
    null,
    2
  )
);

if (!currentSession) {
  console.error("FAIL: session was cleared");
  process.exit(1);
}
if (!wallClock || wallClock.status !== "active") {
  console.error("FAIL: wall-clock start should ignore stale quit and stay active");
  process.exit(1);
}
if (old) {
  console.error("WARN: old simulation unexpectedly kept session");
}
console.log("OK: stale session_end no longer wipes replayed session");
