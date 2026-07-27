const fs = require("fs");
const path = require("path");
const { sumAwardedAuecInText } = require("./rewardFormat");

/** Approximate LIVE build floor for Star Citizen 4.8+ (includes 4.9 LIVE archives). */
const PATCH_4_8_MIN_BUILD = 11550000;
const PATCH_4_8_MIN_MS = Date.parse("2025-04-01T00:00:00Z");

const MONTH = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function parseBuildFromName(name) {
  const m = name.match(/Build\((\d+)\)/i);
  return m ? Number(m[1]) : null;
}

function parseFilenameDate(name) {
  const m = name.match(/(\d{2})\s+(\w{3})\s+(\d{2})\s+\(/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = MONTH[m[2]];
  const year = 2000 + Number(m[3]);
  if (mon == null || Number.isNaN(day) || Number.isNaN(year)) return null;
  return new Date(year, mon, day).getTime();
}

function isSince48({ build, mtimeMs, nameDateMs }) {
  if (build != null && build >= PATCH_4_8_MIN_BUILD) return true;
  const t = nameDateMs ?? mtimeMs;
  return t != null && t >= PATCH_4_8_MIN_MS;
}

function formatArchiveLabel(name, build, mtimeMs) {
  if (build) {
    const d = parseFilenameDate(name);
    if (d) {
      return `Build ${build} · ${new Date(d).toLocaleDateString()}`;
    }
    return `Build ${build}`;
  }
  return name.replace(/^Game\s*/i, "").trim() || name;
}

function getLogArchiveDir(liveLogPath) {
  if (!liveLogPath) return null;
  return path.join(path.dirname(liveLogPath), "logbackups");
}

function quickScanAwardedAuec(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return 0;
  try {
    return sumAwardedAuecInText(fs.readFileSync(filePath, "utf8"));
  } catch {
    return 0;
  }
}

/**
 * @param {string} liveLogPath resolved Game.log path
 */
function listLogArchives(liveLogPath) {
  if (!liveLogPath || !fs.existsSync(path.dirname(liveLogPath))) {
    return [];
  }

  const entries = [];
  const pushEntry = (filePath, kind) => {
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return;
    }
    const name = path.basename(filePath);
    const build = parseBuildFromName(name);
    const nameDateMs = parseFilenameDate(name);
    if (!isSince48({ build, mtimeMs: stat.mtimeMs, nameDateMs })) return;

    entries.push({
      id: kind === "live" ? "__live__" : filePath,
      path: filePath,
      kind,
      name,
      build,
      label: kind === "live" ? "Current Game.log (live)" : formatArchiveLabel(name, build, stat.mtimeMs),
      mtime: stat.mtime.toISOString(),
      sizeBytes: stat.size,
      awardedAuecTotal: quickScanAwardedAuec(filePath),
    });
  };

  if (fs.existsSync(liveLogPath)) {
    pushEntry(liveLogPath, "live");
  }

  const backupDir = getLogArchiveDir(liveLogPath);
  if (backupDir && fs.existsSync(backupDir)) {
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => /\.log$/i.test(f))
      .map((f) => path.join(backupDir, f));

    for (const filePath of files) {
      pushEntry(filePath, "backup");
    }
  }

  entries.sort((a, b) => {
    if (a.kind === "live") return -1;
    if (b.kind === "live") return 1;
    return new Date(b.mtime).getTime() - new Date(a.mtime).getTime();
  });

  return entries;
}

module.exports = {
  listLogArchives,
  getLogArchiveDir,
  quickScanAwardedAuec,
  PATCH_4_8_MIN_BUILD,
};
