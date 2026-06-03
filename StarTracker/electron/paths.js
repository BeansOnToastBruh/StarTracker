const fs = require("fs");
const os = require("os");
const path = require("path");

const WINDOWS_PROGRAM_FILES = path.join(
  "C:",
  "Program Files",
  "Roberts Space Industries",
  "StarCitizen",
  "LIVE",
  "Game.log"
);

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

function getDefaultLogCandidates() {
  if (process.platform === "win32") {
    return [
      WINDOWS_PROGRAM_FILES,
      path.join(
        process.env.LOCALAPPDATA || "",
        "Star Citizen",
        "LIVE",
        "Game.log"
      ),
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

function resolveLogPath(configured) {
  if (configured && fs.existsSync(configured)) return configured;
  for (const candidate of getDefaultLogCandidates()) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return configured || DEFAULT_LOG;
}

module.exports = { DEFAULT_LOG, resolveLogPath, getDefaultLogCandidates };
