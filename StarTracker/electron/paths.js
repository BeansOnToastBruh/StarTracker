const fs = require("fs");
const os = require("os");
const path = require("path");

const SC_LOG_PARTS = [
  "Roberts Space Industries",
  "StarCitizen",
  "LIVE",
  "Game.log",
];

const WINDOWS_PROGRAM_FILES = path.join("C:", "Program Files", ...SC_LOG_PARTS);

function wineGameLog(home, prefix) {
  return path.join(
    home,
    prefix,
    "drive_c",
    "Program Files",
    "Roberts Space Industries",
    "StarCitizen",
    "LIVE",
    "Game.log"
  );
}

function windowsDriveCandidates() {
  const out = [];
  for (const letter of "CDEFGHIJKLMNOPQRSTUVWXYZ") {
    const root = `${letter}:\\`;
    out.push(path.join(root, "Program Files", ...SC_LOG_PARTS));
    out.push(path.join(root, "Games", "StarCitizen", "LIVE", "Game.log"));
    out.push(path.join(root, "Games", "Star Citizen", "LIVE", "Game.log"));
    out.push(path.join(root, ...SC_LOG_PARTS));
  }
  return out;
}

function getDefaultLogCandidates() {
  if (process.platform === "win32") {
    return [
      WINDOWS_PROGRAM_FILES,
      path.join(process.env.LOCALAPPDATA || "", "Star Citizen", "LIVE", "Game.log"),
      path.join(process.env.PROGRAMFILES || "", ...SC_LOG_PARTS),
      path.join(process.env["ProgramFiles(x86)"] || "", ...SC_LOG_PARTS),
      ...windowsDriveCandidates(),
    ].filter(Boolean);
  }

  if (process.platform === "linux") {
    const home = os.homedir();
    return [
      wineGameLog(home, ".wine"),
      wineGameLog(home, ".local/share/lutris/runners/wine"),
      path.join(
        home,
        "Games",
        "star-citizen",
        "drive_c",
        "Program Files",
        "Roberts Space Industries",
        "StarCitizen",
        "LIVE",
        "Game.log"
      ),
      path.join(home, ".local", "share", "Star Citizen", "LIVE", "Game.log"),
      path.join(home, "Games", "StarCitizen", "drive_c", "Program Files", ...SC_LOG_PARTS),
    ];
  }

  if (process.platform === "darwin") {
    const home = os.homedir();
    return [
      path.join(
        home,
        "Library",
        "Application Support",
        "Star Citizen",
        "LIVE",
        "Game.log"
      ),
      wineGameLog(home, ".wine"),
    ];
  }

  return [WINDOWS_PROGRAM_FILES];
}

const DEFAULT_LOG = getDefaultLogCandidates()[0];

function findExistingCandidate() {
  for (const candidate of getDefaultLogCandidates()) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * @param {string | null | undefined} configured
 * @param {{ custom?: boolean }} [options]
 */
function resolveLogPath(configured, options = {}) {
  const { custom = false } = options;

  if (custom && configured) {
    return configured;
  }

  if (configured && fs.existsSync(configured)) {
    return configured;
  }

  const found = findExistingCandidate();
  if (found) return found;

  return configured || DEFAULT_LOG;
}

/**
 * @param {{ logPath?: string | null, logPathCustom?: boolean }} config
 */
function getLogPathInfo(config = {}) {
  const custom = !!config.logPathCustom;
  const configured = config.logPath || null;
  const resolved = resolveLogPath(configured, { custom });
  const exists = fs.existsSync(resolved);
  const autoDetected = findExistingCandidate();

  return {
    mode: custom ? "custom" : "auto",
    configured: custom ? configured : null,
    resolved,
    exists,
    autoDetected,
    defaultGuess: DEFAULT_LOG,
  };
}

module.exports = {
  DEFAULT_LOG,
  resolveLogPath,
  getDefaultLogCandidates,
  getLogPathInfo,
  findExistingCandidate,
};
