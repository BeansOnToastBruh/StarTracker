const fs = require("fs");
const path = require("path");

const DEFAULT_LOG = path.join(
  "C:",
  "Program Files",
  "Roberts Space Industries",
  "StarCitizen",
  "LIVE",
  "Game.log"
);

function resolveLogPath(configured) {
  if (configured && fs.existsSync(configured)) return configured;
  if (fs.existsSync(DEFAULT_LOG)) return DEFAULT_LOG;
  const local = path.join(
    process.env.LOCALAPPDATA || "",
    "Star Citizen",
    "LIVE",
    "Game.log"
  );
  if (local && fs.existsSync(local)) return local;
  return configured || DEFAULT_LOG;
}

module.exports = { DEFAULT_LOG, resolveLogPath };
