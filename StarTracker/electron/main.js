const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { LogWatcher } = require("./logWatcher");
const {
  createSession,
  pushEvent,
  endSession,
  snapshot,
} = require("./session");
const { resolveLogPath, DEFAULT_LOG } = require("./paths");
const { checkForUpdates } = require("./updateChecker");

app.setName("StarTracker");
if (process.platform === "win32") {
  app.setAppUserModelId("com.startracker.app");
}

const legacyUserData = path.join(app.getPath("appData"), "sc-session-debrief");
app.setPath(
  "userData",
  fs.existsSync(legacyUserData)
    ? legacyUserData
    : path.join(app.getPath("appData"), "startracker")
);

const CONFIG_PATH = () => path.join(app.getPath("userData"), "config.json");
const HISTORY_PATH = () => path.join(app.getPath("userData"), "sessions.json");

let tray = null;
let mainWindow = null;
let watcher = null;
let currentSession = null;
let pastSessions = [];
let watching = false;
let autoTrack = true;
let gameInUniverse = false;

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH(), "utf8"));
  } catch {
    return {
      logPath: DEFAULT_LOG,
      autoTrack: true,
      startMinimized: true,
      updateRepo: "YOUR_USER/startracker",
    };
  }
}

function saveConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH()), { recursive: true });
  fs.writeFileSync(CONFIG_PATH(), JSON.stringify(cfg, null, 2), "utf8");
}

function loadHistory() {
  try {
    const data = JSON.parse(fs.readFileSync(HISTORY_PATH(), "utf8"));
    pastSessions = Array.isArray(data.sessions) ? data.sessions.slice(0, 40) : [];
  } catch {
    pastSessions = [];
  }
}

function saveHistory() {
  fs.mkdirSync(path.dirname(HISTORY_PATH()), { recursive: true });
  fs.writeFileSync(
    HISTORY_PATH(),
    JSON.stringify({ sessions: pastSessions.slice(0, 40) }, null, 2),
    "utf8"
  );
}

function trayIcon() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    const x = i % size;
    const y = Math.floor(i / size);
    const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
    const fill = !edge && x > 2 && y > 2 && x < 13 && y < 13;
    canvas[o] = fill ? 90 : edge ? 40 : 0;
    canvas[o + 1] = fill ? 160 : edge ? 120 : 0;
    canvas[o + 2] = fill ? 255 : edge ? 180 : 0;
    canvas[o + 3] = fill || edge ? 255 : 0;
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function sendUpdateStatus(result) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", result);
  }
}

async function runUpdateCheck() {
  try {
    const result = await checkForUpdates(loadConfig());
    if (result) sendUpdateStatus(result);
    return result;
  } catch {
    return null;
  }
}

function broadcastState() {
  const payload = {
    watching,
    autoTrack,
    logPath: watcher?.path,
    current: currentSession ? snapshot(currentSession) : null,
    history: pastSessions.slice(0, 10),
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("state", payload);
  }
  updateTrayMenu();
}

function updateTrayTooltip() {
  if (!tray) return;
  if (!currentSession) {
    tray.setToolTip(
      watching
        ? "StarTracker: waiting for session"
        : "StarTracker (paused)"
    );
    return;
  }
  const s = currentSession.stats;
  tray.setToolTip(
    `StarTracker (${currentSession.status === "active" ? "recording" : "ended"})\n` +
      `Contracts: ${s.contractsCompleted}/${s.contractsAccepted} · Deaths: ${s.deaths}`
  );
}

function updateTrayMenu() {
  if (!tray) return;
  const active = currentSession?.status === "active";
  const menu = Menu.buildFromTemplate([
    {
      label: active
        ? `Recording (${currentSession.events.length} events)`
        : currentSession
          ? "View last session"
          : "No active session",
      enabled: !!currentSession,
      click: () => showWindow(),
    },
    { type: "separator" },
    {
      label: "New session",
      click: () => startSession(true),
    },
    {
      label: "End session",
      enabled: active,
      click: () => finishSession(),
    },
    {
      label: autoTrack ? "✓ Auto-track when you play" : "Auto-track when you play",
      type: "checkbox",
      checked: autoTrack,
      click: (item) => {
        autoTrack = item.checked;
        const cfg = loadConfig();
        cfg.autoTrack = autoTrack;
        saveConfig(cfg);
        broadcastState();
      },
    },
    {
      label: watching ? "Pause tracking" : "Resume tracking",
      click: () => toggleWatch(),
    },
    { type: "separator" },
    {
      label: "Open log folder",
      click: () => {
        const p = resolveLogPath(loadConfig().logPath);
        shell.showItemInFolder(p);
      },
    },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  updateTrayTooltip();
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    show: false,
    title: "StarTracker",
    backgroundColor: "#0c1018",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  mainWindow.webContents.once("did-finish-load", () => runUpdateCheck());
  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.once("ready-to-show", () => broadcastState());
}

function isStaleSessionEnd(event) {
  if (!currentSession?.startedAt || !event?.at) return false;
  const endMs = new Date(event.at).getTime();
  const startMs = new Date(currentSession.startedAt).getTime();
  if (Number.isNaN(endMs) || Number.isNaN(startMs)) return false;
  // Ignore quit lines from before this debrief session (common when replaying Game.log tail).
  return endMs < startMs - 5000;
}

function handleLogEvent(event) {
  if (!watching) return;

  if (event.type === "session_end" && currentSession?.status === "active") {
    if (isStaleSessionEnd(event)) return;
    pushEvent(currentSession, event);
    endSession(currentSession, event.at);
    broadcastState();
    return;
  }

  if (event.detail?.inUniverse) gameInUniverse = true;

  if (autoTrack && !currentSession) {
    const shouldStart =
      event.detail?.inUniverse ||
      event.type === "contract" ||
      (event.type === "spawn" && gameInUniverse);
    if (shouldStart) startSession(false, { firstEventAt: event.at });
  }

  if (!currentSession) return;

  if (event.type === "meta") {
    applyMetaToSession(event);
    broadcastState();
    return;
  }

  pushEvent(currentSession, event);
  broadcastState();
}

function applyMetaToSession(event) {
  if (event.detail?.playerNick) currentSession.playerNick = event.detail.playerNick;
  if (event.detail?.inUniverse) currentSession.inUniverse = true;
}

function startSession(manual, opts = {}) {
  if (currentSession?.status === "active") finishSession();
  const startedAt = manual ? new Date().toISOString() : opts.firstEventAt || new Date().toISOString();
  currentSession = createSession({
    status: "active",
    startedAt,
    events: manual
      ? [{ type: "note", at: startedAt, summary: "Session started manually" }]
      : [{ type: "note", at: startedAt, summary: "Session started (auto)" }],
  });
  broadcastState();
}

function finishSession(endedAt) {
  if (!currentSession) return;
  endSession(currentSession, endedAt);
  pushEvent(currentSession, {
    type: "note",
    at: currentSession.endedAt,
    summary: "Session ended",
  });
  pastSessions.unshift(snapshot(currentSession));
  saveHistory();
  currentSession = null;
  broadcastState();
}

async function startWatcher(logPath) {
  await stopWatcher();
  const resolved = resolveLogPath(logPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Couldn't find your Star Citizen log file:\n${resolved}`);
  }
  watching = true;
  watcher = new LogWatcher({
    path: resolved,
    onEvent: handleLogEvent,
    onError: (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("error", err.message);
      }
    },
  });
  await watcher.start();
  broadcastState();
}

async function stopWatcher() {
  watching = false;
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
}

function toggleWatch() {
  if (watching) {
    stopWatcher().then(() => broadcastState());
  } else {
    const cfg = loadConfig();
    startWatcher(cfg.logPath).catch((e) => {
      if (mainWindow) mainWindow.webContents.send("error", e.message);
    });
  }
}

app.whenReady().then(async () => {
  loadHistory();
  const cfg = loadConfig();
  autoTrack = cfg.autoTrack !== false;

  tray = new Tray(trayIcon());
  tray.setToolTip("StarTracker");
  tray.on("double-click", () => showWindow());
  tray.on("click", () => showWindow());

  createWindow();
  updateTrayMenu();

  try {
    await startWatcher(cfg.logPath);
  } catch (e) {
    if (mainWindow) mainWindow.webContents.send("error", e.message);
  }

  if (!cfg.startMinimized) showWindow();
  else broadcastState();
});

app.on("window-all-closed", (e) => e.preventDefault());

app.on("before-quit", async () => {
  app.isQuitting = true;
  if (currentSession?.status === "active") finishSession();
  await stopWatcher();
});

ipcMain.handle("get-state", () => ({
  watching,
  autoTrack,
  logPath: watcher?.path,
  current: currentSession ? snapshot(currentSession) : null,
  history: pastSessions,
}));

ipcMain.handle("start-session", () => {
  startSession(true);
  return snapshot(currentSession);
});

ipcMain.handle("end-session", () => {
  finishSession();
  return pastSessions[0] || null;
});

ipcMain.handle("set-auto-track", (_, value) => {
  autoTrack = !!value;
  const cfg = loadConfig();
  cfg.autoTrack = autoTrack;
  saveConfig(cfg);
  broadcastState();
  return autoTrack;
});

ipcMain.handle("open-log", () => {
  const p = resolveLogPath(loadConfig().logPath);
  shell.showItemInFolder(p);
  return p;
});

ipcMain.handle("get-app-info", () => ({
  version: app.getVersion(),
}));

ipcMain.handle("check-for-updates", () => runUpdateCheck());

ipcMain.handle("open-update-url", (_, url) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return false;
  shell.openExternal(url);
  return true;
});
