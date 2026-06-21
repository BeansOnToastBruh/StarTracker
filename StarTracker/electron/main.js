const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  shell,
  dialog,
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
const { resolveLogPath, getLogPathInfo } = require("./paths");
const { listLogArchives, quickScanAwardedAuec } = require("./logArchive");
const { parseLogFileToSession } = require("./logImporter");
const { checkForUpdates } = require("./updateChecker");
const { downloadAndInstallUpdate } = require("./updateInstaller");
const gameData = require("./gameDataResolver");
const gameDatabase = require("./gameDatabase");
const guidesHub = require("./guidesHub");
const combatIntel = require("./combatIntel");
const fleetCompare = require("./fleetCompare");
const loadoutBuilder = require("./loadoutBuilder");
const refineryIntel = require("./refineryIntel");
const craftingIntel = require("./craftingIntel");
const tradeIntel = require("./tradeIntel");
const terminalIntel = require("./terminalIntel");
const externalToolsHub = require("./externalToolsHub");
const reputationIntel = require("./reputationIntel");
const {
  enrichSession,
  applyLabelsToSession,
} = require("./sessionEnrichment");
const factionRepStore = require("./factionRepStore");
const {
  maybeAddEstimatedPayout,
  trackRepFromReward,
} = require("./contractPayoutEnrichment");

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
const GAME_DATA_CACHE_PATH = () =>
  path.join(app.getPath("userData"), "game-data-cache.json");
const GAME_DATABASE_DIR = () =>
  path.join(app.getPath("userData"), "game-database");
const GUIDES_CACHE_DIR = () => path.join(app.getPath("userData"), "guides");
const GUIDES_SEED_DIR = () =>
  path.join(__dirname, "..", "data", "guides");
const COMBAT_CACHE_DIR = () => path.join(app.getPath("userData"), "combat-intel");
const COMBAT_SEED_DIR = () => path.join(__dirname, "..", "data", "combat");
const FLEET_CACHE_DIR = () => path.join(app.getPath("userData"), "fleet-compare");
const CRAFTING_CACHE_DIR = () => path.join(app.getPath("userData"), "crafting-intel");

let tray = null;
let mainWindow = null;
let watcher = null;
let currentSession = null;
let pastSessions = [];
let watching = false;
let autoTrack = true;
let gameInUniverse = false;

const DEFAULT_UPDATE_REPO = "BeansOnToastBruh/StarTracker";

function defaultConfig() {
  return {
    logPath: null,
    logPathCustom: false,
    autoTrack: true,
    startMinimized: true,
    updateRepo: DEFAULT_UPDATE_REPO,
    favoriteTabs: [],
  };
}

function loadConfig() {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_PATH(), "utf8"));
  } catch {
    return defaultConfig();
  }

  let changed = false;
  const repo = String(cfg.updateRepo || "");
  if (!repo || /YOUR_USER/i.test(repo)) {
    cfg.updateRepo = DEFAULT_UPDATE_REPO;
    changed = true;
  }
  if (changed) saveConfig(cfg);
  if (!Array.isArray(cfg.favoriteTabs)) cfg.favoriteTabs = [];
  return cfg;
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
  } catch (e) {
    const result = {
      available: false,
      error: e?.message || "Update check failed.",
    };
    sendUpdateStatus(result);
    return result;
  }
}

function logSettingsPayload() {
  const cfg = loadConfig();
  const info = getLogPathInfo(cfg);
  return {
    logPath: watcher?.path || (info.exists ? info.resolved : null),
    logPathInfo: info,
  };
}

let cachedLogAuecScan = { path: null, mtimeMs: 0, total: 0 };

function getLogFileAuecTotal(logPath) {
  if (!logPath || !fs.existsSync(logPath)) return 0;
  try {
    const mtimeMs = fs.statSync(logPath).mtimeMs;
    if (
      cachedLogAuecScan.path === logPath &&
      cachedLogAuecScan.mtimeMs === mtimeMs
    ) {
      return cachedLogAuecScan.total;
    }
    const total = quickScanAwardedAuec(logPath);
    cachedLogAuecScan = { path: logPath, mtimeMs, total };
    return total;
  } catch {
    return 0;
  }
}

function broadcastState() {
  const logSettings = logSettingsPayload();
  const payload = {
    watching,
    autoTrack,
    ...logSettings,
    logFileAuecTotal: getLogFileAuecTotal(logSettings.logPath),
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
      label: "Choose Game.log…",
      click: () => {
        showWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("focus-log-path");
        }
      },
    },
    {
      label: "Open log folder",
      click: () => openLogFolder(),
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
      (event.type === "reward" && event.detail?.auec) ||
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
  if (event.type === "reward") trackRepFromReward(event);
  maybeRefreshGameLabels(event);
  if (event.type === "loadout") maybeRefreshLoadoutLabels(event);
  maybeEstimateContractPayout(event);
  broadcastState();
}

function maybeRefreshLoadoutLabels(event) {
  if (!currentSession || event.type !== "loadout") return;
  applyLabelsToSession(currentSession);
  const names = (event.detail?.items || []).map((i) => i.className).filter(Boolean);
  if (!names.length) return;
  gameData.ensureAll(names, { timeoutMs: 12000 }).then(() => {
    if (!currentSession) return;
    applyLabelsToSession(currentSession);
    broadcastState();
  });
}

function maybeEstimateContractPayout(event) {
  if (!currentSession || event.type !== "contract" || event.detail?.action !== "completed") {
    return;
  }
  maybeAddEstimatedPayout(currentSession, event)
    .then((estimated) => {
      if (!estimated || !currentSession) return;
      pushEvent(currentSession, estimated);
      broadcastState();
    })
    .catch(() => {});
}

function maybeRefreshGameLabels(event) {
  const raw =
    event?.type === "shop_purchase"
      ? event.detail?.itemRaw
      : event?.type === "insurance"
        ? event.detail?.shipRaw
        : null;
  if (!raw || event.detail?.verified) return;
  gameData.ensureResolved(raw).then(() => {
    if (!currentSession) return;
    applyLabelsToSession(currentSession);
    broadcastState();
  });
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

function watcherTargetPath() {
  const cfg = loadConfig();
  return resolveLogPath(cfg.logPath, { custom: cfg.logPathCustom });
}

async function startWatcher() {
  await stopWatcher();
  const resolved = watcherTargetPath();
  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Couldn't find Game.log.\n${resolved}\n\nUse Browse in the app footer to select your Game.log (usually in .../StarCitizen/LIVE/Game.log).`
    );
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
    startWatcher().catch((e) => {
      if (mainWindow) mainWindow.webContents.send("error", e.message);
    });
  }
}

app.whenReady().then(async () => {
  factionRepStore.init(path.join(app.getPath("userData"), "faction-rep.json"));
  gameData.init({ cachePath: GAME_DATA_CACHE_PATH() });
  gameDatabase.init({ dbDir: GAME_DATABASE_DIR() });
  guidesHub.init({
    cacheDir: GUIDES_CACHE_DIR(),
    seedDir: GUIDES_SEED_DIR(),
  });
  combatIntel.init({
    cacheDir: COMBAT_CACHE_DIR(),
    seedDir: COMBAT_SEED_DIR(),
  });
  fleetCompare.init({ cacheDir: FLEET_CACHE_DIR() });
  refineryIntel.init({ seedDir: GUIDES_SEED_DIR() });
  craftingIntel.init({ cacheDir: CRAFTING_CACHE_DIR() });
  externalToolsHub.init({ seedDir: GUIDES_SEED_DIR() });
  gameDatabase.onSyncProgress((payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("catalog-sync", payload);
    }
  });
  if (gameDatabase.isStale()) {
    gameDatabase.refreshCatalog().catch(() => {});
  }
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
    await startWatcher();
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

ipcMain.handle("get-state", () => {
  const logSettings = logSettingsPayload();
  return {
    watching,
    autoTrack,
    ...logSettings,
    logFileAuecTotal: getLogFileAuecTotal(logSettings.logPath),
    current: currentSession ? snapshot(currentSession) : null,
    history: pastSessions,
  };
});

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

function openLogFolder() {
  const info = getLogPathInfo(loadConfig());
  const p = info.resolved;
  if (info.exists) {
    shell.showItemInFolder(p);
    return p;
  }
  showWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("focus-log-path");
  }
  return null;
}

ipcMain.handle("open-log", () => openLogFolder());

ipcMain.handle("browse-log-file", async () => {
  const info = getLogPathInfo(loadConfig());
  const defaultDir = info.exists
    ? path.dirname(info.resolved)
    : info.autoDetected
      ? path.dirname(info.autoDetected)
      : app.getPath("home");

  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    title: "Select Star Citizen Game.log",
    defaultPath: path.join(defaultDir, "Game.log"),
    properties: ["openFile"],
    filters: [{ name: "Star Citizen log", extensions: ["log"] }],
  });

  if (result.canceled || !result.filePaths?.[0]) {
    return { canceled: true };
  }
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle("set-log-path", async (_, opts) => {
  const cfg = loadConfig();

  if (opts?.auto) {
    cfg.logPathCustom = false;
    cfg.logPath = null;
    saveConfig(cfg);
  } else {
    const p = typeof opts?.path === "string" ? opts.path.trim() : "";
    if (!p) return { ok: false, error: "No path selected." };
    if (!fs.existsSync(p)) {
      return { ok: false, error: `File not found:\n${p}` };
    }
    if (path.basename(p).toLowerCase() !== "game.log") {
      return {
        ok: false,
        error: "Select the Game.log file (usually in .../StarCitizen/LIVE/Game.log).",
      };
    }
    cfg.logPath = p;
    cfg.logPathCustom = true;
    saveConfig(cfg);
  }

  try {
    await startWatcher();
    broadcastState();
    return { ok: true, ...logSettingsPayload() };
  } catch (e) {
    broadcastState();
    return { ok: false, error: e.message, ...logSettingsPayload() };
  }
});

ipcMain.handle("get-app-info", () => ({
  version: app.getVersion(),
}));

ipcMain.handle("check-for-updates", () => runUpdateCheck());

ipcMain.handle("download-and-install-update", async (event, payload) => {
  const downloadUrl = payload?.downloadUrl;
  const platform = payload?.platform;
  if (typeof downloadUrl !== "string" || !/^https?:\/\//i.test(downloadUrl)) {
    return { ok: false, error: "No download URL for this update." };
  }
  const win = BrowserWindow.fromWebContents(event.sender);
  const sendProgress = (progress) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("update-download-progress", progress);
    }
  };
  try {
    return await downloadAndInstallUpdate({
      downloadUrl,
      platform,
      onProgress: sendProgress,
    });
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});

ipcMain.handle("open-update-url", (_, url) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return false;
  shell.openExternal(url);
  return true;
});

function resolvePathForLogArchives() {
  const cfg = loadConfig();
  const info = getLogPathInfo(cfg);
  const live = watcherTargetPath();
  if (fs.existsSync(live)) return live;
  if (info.resolved && fs.existsSync(info.resolved)) return info.resolved;
  if (info.autoDetected && fs.existsSync(info.autoDetected)) return info.autoDetected;
  return live || info.resolved || info.autoDetected || null;
}

ipcMain.handle("list-log-archives", () => {
  const pathForList = resolvePathForLogArchives();
  try {
    const archives = listLogArchives(pathForList);
    return { ok: true, archives, logPath: pathForList };
  } catch (e) {
    return {
      ok: false,
      error: e.message || String(e),
      archives: [],
    };
  }
});

ipcMain.handle("parse-log-archive", async (_, archiveId) => {
  if (!archiveId || typeof archiveId !== "string") {
    return { ok: false, error: "No archive selected." };
  }
  const pathForList = resolvePathForLogArchives();
  const archives = listLogArchives(pathForList);
  const row = archives.find((a) => a.id === archiveId);
  if (!row?.path || !fs.existsSync(row.path)) {
    return { ok: false, error: "Log file not found." };
  }
  try {
    let session = parseLogFileToSession(row.path);
    session = await enrichSession(session, { timeoutMs: 15000 });
    return {
      ok: true,
      archive: row,
      session,
      gameData: gameData.getStats(),
    };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});

ipcMain.handle("catalog-stats", () => gameDatabase.getStats());

ipcMain.handle("catalog-query-vehicles", async (_, options) => {
  const result = gameDatabase.queryVehicles(options || {});
  try {
    const index = await fleetCompare.getFleetIndex();
    if (index.ok) {
      result.rows = fleetCompare.enrichVehicleRows(result.rows, index);
    }
  } catch {
    /* fleet stats are optional enrichment */
  }
  return result;
});

ipcMain.handle("catalog-query-items", (_, options) =>
  gameDatabase.queryItems(options || {})
);

ipcMain.handle("catalog-query-shops", (_, options) =>
  gameDatabase.queryShops(options || {})
);

ipcMain.handle("catalog-query-places", (_, options) =>
  gameDatabase.queryPlaces(options || {})
);

ipcMain.handle("catalog-item-detail", async (_, key) => {
  const detail = gameDatabase.getItemDetail(key);
  if (!detail) return null;
  if (detail.section === "Ships") {
    try {
      return await fleetCompare.enrichVehicleFromIndex(detail);
    } catch {
      return detail;
    }
  }
  return detail;
});

ipcMain.handle("catalog-shop-detail", (_, terminalKey) =>
  gameDatabase.getShopDetail(terminalKey)
);

ipcMain.handle("catalog-place-detail", (_, placeKey) =>
  gameDatabase.getPlaceDetail(placeKey)
);

ipcMain.handle("catalog-refresh", async () => gameDatabase.refreshCatalog());

ipcMain.handle("guides-get-patch-notes", (_, force) => guidesHub.getPatchNotes(!!force));
ipcMain.handle("guides-refresh-patch-notes", () => guidesHub.refreshPatchNotes());

ipcMain.handle("guides-get-commodities", (_, options) =>
  guidesHub.getCommodityList(options || {})
);

ipcMain.handle("guides-get-commodity-detail", (_, commodityId) =>
  guidesHub.getCommodityDetail(commodityId)
);

ipcMain.handle("guides-get-smuggler-routes", async () => {
  const data = await guidesHub.getSmugglerRoutes();
  const routes = data.routes || [];
  await Promise.all(
    routes.slice(0, 8).map(async (route) => {
      const top = route.commodities?.[0];
      if (!top?.id) return;
      try {
        const detail = await terminalIntel.getCommodityTradeRoute(top.id, 128);
        route.terminalRoute = detail.route;
        route.topCommodityId = top.id;
      } catch {
        /* optional UEX detail */
      }
    })
  );
  return data;
});

ipcMain.handle("guides-get-game-loops", () => guidesHub.getGameLoops());

ipcMain.handle("guides-refresh-commodities", () =>
  guidesHub.refreshCommodities()
);

ipcMain.handle("guides-get-refinery", () =>
  refineryIntel.getRefineryGuide(() => guidesHub.getCommoditiesCache(false))
);

ipcMain.handle("guides-calculate-refinery", (_, options) =>
  refineryIntel.calculateRefineryRun(
    () => guidesHub.getCommoditiesCache(false),
    options || {}
  )
);

ipcMain.handle("crafting-search-blueprints", (_, options) =>
  craftingIntel.searchBlueprints(options || {})
);

ipcMain.handle("crafting-get-blueprint", (_, id) =>
  craftingIntel.getBlueprintDetail(id)
);

ipcMain.handle("crafting-calculate-preview", (_, options) =>
  craftingIntel.calculateCraftPreview(
    options?.blueprintId || options?.id,
    options?.qualities || {}
  )
);

ipcMain.handle("ui-get-favorite-tabs", () => {
  const cfg = loadConfig();
  return Array.isArray(cfg.favoriteTabs) ? cfg.favoriteTabs : [];
});

ipcMain.handle("ui-toggle-favorite-tab", (_, tabId) => {
  const id = String(tabId || "").trim();
  if (!id) return loadConfig().favoriteTabs || [];
  const cfg = loadConfig();
  const fav = Array.isArray(cfg.favoriteTabs) ? [...cfg.favoriteTabs] : [];
  const idx = fav.indexOf(id);
  if (idx >= 0) fav.splice(idx, 1);
  else fav.push(id);
  cfg.favoriteTabs = fav;
  saveConfig(cfg);
  return fav;
});

ipcMain.handle("combat-get-item-profile", (_, options) =>
  combatIntel.getItemCombatProfile(options || {})
);

ipcMain.handle("combat-get-vehicle-profile", (_, options) =>
  combatIntel.getVehicleCombatProfile(options || {})
);

ipcMain.handle("combat-get-loadout-summary", (_, items) =>
  combatIntel.getLoadoutCombatSummary(items || [])
);

ipcMain.handle("combat-get-external-tools", () =>
  externalToolsHub.getCombatExternalTools()
);

ipcMain.handle("combat-search", (_, options) =>
  combatIntel.searchCombatProfiles(options || {})
);

ipcMain.handle("fleet-compare-query", (_, options) =>
  fleetCompare.getFleetCompare(options || {})
);

ipcMain.handle("fleet-compare-refresh", () =>
  fleetCompare.getFleetCompare({ forceRefresh: true })
);

ipcMain.handle("loadout-get-blueprint", (_, slug) =>
  loadoutBuilder.getShipBlueprint(combatIntel, slug)
);

ipcMain.handle("loadout-search-weapons", (_, options) =>
  loadoutBuilder.searchShipWeapons(options || {})
);

ipcMain.handle("loadout-simulate", (_, options) =>
  loadoutBuilder.simulateLoadout(combatIntel, options || {})
);

ipcMain.handle("guides-get-trade-routes", (_, options) =>
  terminalIntel.buildTerminalTradeRoutes(options || {})
);

ipcMain.handle("guides-get-trade-route-detail", (_, options) =>
  terminalIntel.getCommodityTradeRoute(options?.commodityId, options?.cargoScu)
);

ipcMain.handle("guides-get-trade-presets", () => ({
  presets: tradeIntel.getCargoPresets(),
}));

ipcMain.handle("guides-get-external-tools-hub", () =>
  externalToolsHub.getExternalToolsHub()
);

ipcMain.handle("guides-get-reputation", () => {
  const snap = currentSession ? snapshot(currentSession) : null;
  const sessionRep = snap?.rollup?.rewardTotals?.repByFaction || [];
  return reputationIntel.getReputationSummary(sessionRep);
});
