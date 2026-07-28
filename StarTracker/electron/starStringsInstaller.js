/**
 * One-click installer for MrKraken's Star Strings (community localization QoL).
 * Downloads the GitHub release zip into the Star Citizen LIVE folder and merges user.cfg.
 */
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { downloadFile } = require("./updateInstaller");

const STAR_STRINGS_REPO = "MrKraken/StarStrings";
const RELEASE_API = `https://api.github.com/repos/${STAR_STRINGS_REPO}/releases/latest`;
const RELEASE_PAGE = `https://github.com/${STAR_STRINGS_REPO}/releases/tag/latest`;
const PROJECT_PAGE = `https://github.com/${STAR_STRINGS_REPO}`;
const LANGUAGE_LINE = "g_language = english";
const ZERO_WIDTH = /\uFEFF/g;
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  "github.com",
  "www.github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
]);

function normalizeNewlines(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(ZERO_WIDTH, "");
}

function resolveLiveDir(logPath) {
  if (!logPath || typeof logPath !== "string") return null;
  const trimmed = logPath.trim();
  if (!trimmed) return null;
  return path.dirname(path.resolve(trimmed));
}

function localizationPaths(liveDir) {
  return {
    dataDir: path.join(liveDir, "data"),
    localizationDir: path.join(liveDir, "data", "Localization", "english"),
    globalIni: path.join(liveDir, "data", "Localization", "english", "global.ini"),
    userCfg: path.join(liveDir, "user.cfg"),
  };
}

function sanitizeAssetName(name) {
  const base = path.basename(String(name || "StarStrings-LIVE.zip"));
  const cleaned = base.replace(/[^\w.\-]+/g, "_");
  return cleaned.toLowerCase().endsWith(".zip") ? cleaned : `${cleaned || "StarStrings-LIVE"}.zip`;
}

function assertSafeDownloadUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid Star Strings download URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Star Strings download must be HTTPS");
  }
  if (!ALLOWED_DOWNLOAD_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(`Blocked download host: ${parsed.hostname}`);
  }
  return parsed.toString();
}

function pickZipAsset(assets) {
  const list = Array.isArray(assets) ? assets : [];
  const prefer = list.find((a) => /StarStrings-LIVE\.zip$/i.test(a.name || ""));
  if (prefer) return prefer;
  return list.find((a) => /\.zip$/i.test(a.name || "")) || null;
}

async function fetchLatestRelease({ fetchImpl } = {}) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch(RELEASE_API, {
    headers: {
      "User-Agent": "StarTracker",
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) {
    throw new Error(`Could not reach Star Strings releases (HTTP ${res.status})`);
  }
  const json = await res.json();
  const asset = pickZipAsset(json.assets);
  if (!asset?.browser_download_url) {
    throw new Error("Star Strings release has no zip asset");
  }
  return {
    tag: json.tag_name || "latest",
    name: json.name || "Star Strings",
    publishedAt: json.published_at || null,
    body: json.body || "",
    assetName: sanitizeAssetName(asset.name),
    downloadUrl: asset.browser_download_url,
    size: asset.size || null,
    releaseUrl: json.html_url || RELEASE_PAGE,
  };
}

function hasEnglishLanguageLine(content) {
  return /^\s*g_language\s*=\s*english\s*$/im.test(normalizeNewlines(content));
}

/**
 * Ensure user.cfg enables the english localization folder (Star Strings requirement).
 * Does not overwrite unrelated cfg lines.
 */
function ensureUserCfgLanguage(userCfgPath) {
  const existed = fs.existsSync(userCfgPath);
  let content = existed ? fs.readFileSync(userCfgPath, "utf8") : "";
  content = normalizeNewlines(content);

  if (hasEnglishLanguageLine(content)) {
    return { addedLanguageLine: false, createdFile: false, replacedLanguage: false };
  }

  let replacedLanguage = false;
  if (/^\s*g_language\s*=/im.test(content)) {
    content = content.replace(/^\s*g_language\s*=.*$/im, LANGUAGE_LINE);
    replacedLanguage = true;
  } else {
    const trimmed = content.replace(/\s+$/, "");
    content = trimmed ? `${trimmed}\n${LANGUAGE_LINE}\n` : `${LANGUAGE_LINE}\n`;
  }

  fs.mkdirSync(path.dirname(userCfgPath), { recursive: true });
  fs.writeFileSync(userCfgPath, content.replace(/\n/g, "\r\n"), "utf8");
  return {
    addedLanguageLine: true,
    createdFile: !existed,
    replacedLanguage,
  };
}

function removeLanguageLineIfOurs(userCfgPath, starStringsState) {
  if (!starStringsState?.addedLanguageLine) return false;
  if (!fs.existsSync(userCfgPath)) return false;
  let content = normalizeNewlines(fs.readFileSync(userCfgPath, "utf8"));
  if (!hasEnglishLanguageLine(content)) return false;
  content = content
    .split("\n")
    .filter((line) => !/^\s*g_language\s*=\s*english\s*$/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "");
  if (!content.trim()) {
    fs.unlinkSync(userCfgPath);
  } else {
    fs.writeFileSync(userCfgPath, content.replace(/\n/g, "\r\n"), "utf8");
  }
  return true;
}

function copyFileSafe(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function assertLiveDirWritable(liveDir) {
  const probe = path.join(liveDir, `.startracker-write-test-${process.pid}`);
  try {
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
  } catch (e) {
    throw new Error(
      `Cannot write to LIVE folder (run StarTracker as your user, or check folder permissions): ${e.message || e}`
    );
  }
}

function backupExisting(liveDir, backupRoot) {
  const paths = localizationPaths(liveDir);
  fs.mkdirSync(backupRoot, { recursive: true });
  const metaPath = path.join(backupRoot, "meta.json");
  const existingBackupIni = path.join(backupRoot, "global.ini");

  // Keep the first restore point forever (even when there was no prior global.ini).
  if (fs.existsSync(metaPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (prev?.backedUpAt) return prev;
    } catch {
      /* rewrite below */
    }
  }

  const meta = {
    backedUpAt: new Date().toISOString(),
    liveDir,
    hadGlobalIni: false,
    hadUserCfg: false,
  };

  if (fs.existsSync(paths.globalIni)) {
    copyFileSafe(paths.globalIni, existingBackupIni);
    meta.hadGlobalIni = true;
  }
  if (fs.existsSync(paths.userCfg)) {
    copyFileSafe(paths.userCfg, path.join(backupRoot, "user.cfg"));
    meta.hadUserCfg = true;
  }

  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");
  return meta;
}

function clearBackup(backupRoot) {
  if (!backupRoot || !fs.existsSync(backupRoot)) return;
  try {
    fs.rmSync(backupRoot, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

function findIniInExtract(extractDir) {
  const preferred = [
    path.join(extractDir, "Data", "Localization", "english", "global.ini"),
    path.join(extractDir, "data", "Localization", "english", "global.ini"),
  ];
  for (const c of preferred) {
    if (fs.existsSync(c)) return c;
  }

  let fallback = null;
  const queue = [extractDir];
  let visited = 0;
  while (queue.length && visited < 400) {
    const dir = queue.shift();
    visited += 1;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isFile() && /^global\.ini$/i.test(ent.name)) {
        if (/Localization[\\/]+english[\\/]+global\.ini$/i.test(full)) return full;
        if (!fallback) fallback = full;
      }
      if (ent.isDirectory()) queue.push(full);
    }
  }
  return fallback;
}

function installFromExtract(extractDir, liveDir) {
  const iniSrc = findIniInExtract(extractDir);
  if (!iniSrc) {
    throw new Error("Zip did not contain Localization/english/global.ini");
  }
  const paths = localizationPaths(liveDir);
  fs.mkdirSync(paths.localizationDir, { recursive: true });
  copyFileSafe(iniSrc, paths.globalIni);
  return paths.globalIni;
}

function readInstalledMarker(globalIniPath) {
  if (!fs.existsSync(globalIniPath)) {
    return { present: false, size: 0, mtime: null };
  }
  const st = fs.statSync(globalIniPath);
  return {
    present: true,
    size: st.size,
    mtime: st.mtime.toISOString(),
  };
}

function getStatus({
  logPath,
  starStringsState,
  remote = null,
  checkRemote = false,
} = {}) {
  const liveDir = resolveLiveDir(logPath);
  const paths = liveDir ? localizationPaths(liveDir) : null;
  const file = paths ? readInstalledMarker(paths.globalIni) : { present: false };
  const userCfgExists = !!(paths && fs.existsSync(paths.userCfg));
  const languageOk =
    userCfgExists && hasEnglishLanguageLine(fs.readFileSync(paths.userCfg, "utf8"));

  const installedViaApp = !!(starStringsState?.installed && starStringsState?.publishedAt);
  let updateAvailable = false;
  if (remote?.publishedAt) {
    const remoteMs = new Date(remote.publishedAt).getTime();
    if (Number.isFinite(remoteMs)) {
      if (installedViaApp) {
        const installedMs = new Date(starStringsState.publishedAt).getTime();
        updateAvailable = Number.isFinite(installedMs) && remoteMs > installedMs;
      } else if (file.present && file.mtime) {
        // Manual / unknown install: offer update if remote is newer than on-disk file.
        const fileMs = new Date(file.mtime).getTime();
        updateAvailable = Number.isFinite(fileMs) && remoteMs > fileMs;
      }
    }
  }

  return {
    ok: true,
    liveDir,
    liveDirExists: !!(liveDir && fs.existsSync(liveDir)),
    globalIniPath: paths?.globalIni || null,
    userCfgPath: paths?.userCfg || null,
    filesPresent: !!file.present,
    fileSize: file.size || 0,
    fileMtime: file.mtime,
    languageOk,
    userCfgExists,
    installedViaApp,
    installed: starStringsState || null,
    remote,
    updateAvailable,
    checkRemote,
    projectUrl: PROJECT_PAGE,
    releaseUrl: remote?.releaseUrl || RELEASE_PAGE,
    credit: "Star Strings by MrKraken — community localization QoL for Star Citizen.",
  };
}

/**
 * Download + install Star Strings into LIVE.
 */
async function installStarStrings(opts = {}) {
  const {
    logPath,
    starStringsState = null,
    backupRoot,
    tempRoot,
    onProgress,
    fetchImpl,
    release: releaseIn,
  } = opts;

  if (!backupRoot || !tempRoot) {
    throw new Error("Missing backup/temp paths for Star Strings install");
  }

  const liveDir = resolveLiveDir(logPath);
  if (!liveDir || !fs.existsSync(liveDir)) {
    throw new Error(
      "Could not find your Star Citizen LIVE folder. Set Game.log path in the footer first."
    );
  }
  assertLiveDirWritable(liveDir);

  onProgress?.({ phase: "checking", percent: 0 });
  const release = releaseIn || (await fetchLatestRelease({ fetchImpl }));
  // Only enforce host allowlist for real network downloads.
  if (typeof opts.downloadFileImpl !== "function") {
    assertSafeDownloadUrl(release.downloadUrl);
  }

  fs.mkdirSync(tempRoot, { recursive: true });
  const zipPath = path.join(tempRoot, sanitizeAssetName(release.assetName));
  const extractDir = path.join(tempRoot, "extract");

  onProgress?.({ phase: "downloading", percent: 0, release });
  const download = typeof opts.downloadFileImpl === "function" ? opts.downloadFileImpl : downloadFile;
  await download(release.downloadUrl, zipPath, (p) => {
    onProgress?.({
      phase: "downloading",
      percent: p.percent,
      received: p.received,
      total: p.total,
      release,
    });
  });

  if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 64) {
    throw new Error("Downloaded Star Strings zip looks empty or incomplete");
  }

  onProgress?.({ phase: "extracting", percent: 90, release });
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(extractDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(extractDir, true);

  onProgress?.({ phase: "backing_up", percent: 93, release });
  const backupMeta = backupExisting(liveDir, backupRoot);

  onProgress?.({ phase: "installing", percent: 96, release });
  const installedIni = installFromExtract(extractDir, liveDir);
  const cfgResult = ensureUserCfgLanguage(localizationPaths(liveDir).userCfg);

  const nextState = {
    installed: true,
    installedAt: new Date().toISOString(),
    tag: release.tag,
    name: release.name,
    publishedAt: release.publishedAt,
    assetName: release.assetName,
    downloadUrl: release.downloadUrl,
    releaseUrl: release.releaseUrl,
    liveDir,
    globalIniPath: installedIni,
    backupRoot,
    addedLanguageLine:
      !!(starStringsState?.addedLanguageLine) || cfgResult.addedLanguageLine,
    createdUserCfg: !!(starStringsState?.createdUserCfg) || cfgResult.createdFile,
    credit: "MrKraken/StarStrings",
  };

  onProgress?.({ phase: "done", percent: 100, release });

  try {
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);
  } catch {
    /* temp cleanup best-effort */
  }

  return {
    ok: true,
    message: `Installed ${release.name}. Restart Star Citizen if it is already running.`,
    release,
    backup: backupMeta,
    starStrings: nextState,
    status: getStatus({
      logPath,
      starStringsState: nextState,
      remote: release,
    }),
  };
}

async function uninstallStarStrings(opts = {}) {
  const { logPath, starStringsState, backupRoot } = opts;
  const liveDir = resolveLiveDir(logPath) || starStringsState?.liveDir;
  if (!liveDir) {
    throw new Error("LIVE folder unknown. Set Game.log path first.");
  }

  const paths = localizationPaths(liveDir);
  const root = backupRoot || starStringsState?.backupRoot;
  let restored = false;
  let removed = false;

  let backupMeta = null;
  const backupIni = root ? path.join(root, "global.ini") : null;
  if (root && fs.existsSync(path.join(root, "meta.json"))) {
    try {
      backupMeta = JSON.parse(fs.readFileSync(path.join(root, "meta.json"), "utf8"));
    } catch {
      backupMeta = null;
    }
  }

  const canRestore =
    !!backupIni &&
    fs.existsSync(backupIni) &&
    backupMeta?.hadGlobalIni !== false &&
    (backupMeta?.hadGlobalIni === true || !backupMeta);

  if (canRestore) {
    copyFileSafe(backupIni, paths.globalIni);
    restored = true;
  } else if (fs.existsSync(paths.globalIni)) {
    fs.unlinkSync(paths.globalIni);
    removed = true;
  }

  removeLanguageLineIfOurs(paths.userCfg, starStringsState);

  if (starStringsState?.createdUserCfg && fs.existsSync(paths.userCfg)) {
    const left = normalizeNewlines(fs.readFileSync(paths.userCfg, "utf8")).trim();
    if (!left) fs.unlinkSync(paths.userCfg);
  }

  if (root) clearBackup(root);

  return {
    ok: true,
    message: restored
      ? "Restored your previous localization file and removed Star Strings."
      : removed
        ? "Removed Star Strings localization file."
        : "Star Strings uninstall finished.",
    starStrings: null,
    status: getStatus({
      logPath: logPath || path.join(liveDir, "Game.log"),
      starStringsState: null,
    }),
  };
}

module.exports = {
  STAR_STRINGS_REPO,
  RELEASE_PAGE,
  PROJECT_PAGE,
  LANGUAGE_LINE,
  resolveLiveDir,
  localizationPaths,
  sanitizeAssetName,
  assertSafeDownloadUrl,
  pickZipAsset,
  fetchLatestRelease,
  hasEnglishLanguageLine,
  ensureUserCfgLanguage,
  removeLanguageLineIfOurs,
  backupExisting,
  clearBackup,
  findIniInExtract,
  installFromExtract,
  getStatus,
  installStarStrings,
  uninstallStarStrings,
};
