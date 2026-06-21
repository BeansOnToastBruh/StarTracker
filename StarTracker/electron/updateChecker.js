const { readBuildMeta } = require("./buildMeta");

const PLACEHOLDER_PATTERN = /YOUR_USER/i;
const REQUEST_TIMEOUT_MS = 8000;

function userAgent() {
  try {
    const { app } = require("electron");
    return `StarTracker/${app.getVersion()}`;
  } catch {
    return "StarTracker";
  }
}

function parseSemver(version) {
  const parts = String(version)
    .replace(/^v/i, "")
    .replace(/-linux$/i, "")
    .trim()
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function semverGreaterThan(a, b) {
  const av = parseSemver(a);
  const bv = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (av[i] > bv[i]) return true;
    if (av[i] < bv[i]) return false;
  }
  return false;
}

function parseRepoString(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0 || slash >= trimmed.length - 1) return null;
  const owner = trimmed.slice(0, slash).trim();
  const repo = trimmed.slice(slash + 1).trim();
  if (!owner || !repo) return null;
  return { owner, repo };
}

function isPlaceholder(value) {
  return !value || PLACEHOLDER_PATTERN.test(String(value));
}

function resolveUpdateRepo(cfg = {}) {
  const envRepo = process.env.STARTRACKER_UPDATE_REPO;
  if (envRepo && !isPlaceholder(envRepo)) {
    return parseRepoString(envRepo);
  }

  const envOwner = process.env.STARTRACKER_GITHUB_OWNER || process.env.GITHUB_OWNER;
  const envRepoName =
    process.env.STARTRACKER_GITHUB_REPO || process.env.GITHUB_REPO;
  if (envOwner && envRepoName && !isPlaceholder(envOwner)) {
    return { owner: envOwner.trim(), repo: envRepoName.trim() };
  }

  if (cfg.updateRepo && !isPlaceholder(cfg.updateRepo)) {
    return parseRepoString(cfg.updateRepo);
  }

  if (
    cfg.githubOwner &&
    cfg.githubRepo &&
    !isPlaceholder(cfg.githubOwner) &&
    !isPlaceholder(cfg.githubRepo)
  ) {
    return {
      owner: String(cfg.githubOwner).trim(),
      repo: String(cfg.githubRepo).trim(),
    };
  }

  return null;
}

function isLinuxReleaseTag(tag) {
  return /-linux$/i.test(String(tag || ""));
}

function isWindowsReleaseTag(tag) {
  return /^v\d+\.\d+\.\d+$/i.test(String(tag || "").trim());
}

function wantsLinuxRelease() {
  return process.platform === "linux";
}

function releaseAssets(release) {
  return Array.isArray(release?.assets) ? release.assets : [];
}

function releaseHasWindowsInstaller(release) {
  return releaseAssets(release).some(
    (a) =>
      a?.browser_download_url &&
      /\.exe$/i.test(a.name || "") &&
      /StarTracker/i.test(a.name || "")
  );
}

function releaseHasLinuxAppImage(release) {
  return releaseAssets(release).some(
    (a) =>
      a?.browser_download_url &&
      /\.AppImage$/i.test(a.name || "") &&
      /StarTracker/i.test(a.name || "")
  );
}

function pickDownloadUrl(release) {
  const assets = releaseAssets(release);
  const name = (a) => a?.name || "";

  if (process.platform === "linux") {
    const appImage = assets.find(
      (a) =>
        a?.browser_download_url &&
        /\.AppImage$/i.test(name(a)) &&
        /StarTracker/i.test(name(a))
    );
    if (appImage?.browser_download_url) return appImage.browser_download_url;
    return null;
  }

  if (process.platform === "win32") {
    const installer = assets.find(
      (a) =>
        a?.browser_download_url &&
        /-x64\.exe$/i.test(name(a)) &&
        /StarTracker/i.test(name(a)) &&
        !/portable/i.test(name(a))
    );
    if (installer?.browser_download_url) return installer.browser_download_url;

    const portable = assets.find(
      (a) =>
        a?.browser_download_url &&
        /portable\.exe$/i.test(name(a)) &&
        /StarTracker/i.test(name(a))
    );
    if (portable?.browser_download_url) return portable.browser_download_url;

    return null;
  }

  return release?.html_url || null;
}

function normalizeTag(tag) {
  return String(tag || "")
    .replace(/^v/i, "")
    .replace(/-linux$/i, "")
    .trim();
}

function platformReleaseLabel(release) {
  if (isLinuxReleaseTag(release?.tag_name)) return "Linux";
  if (releaseHasWindowsInstaller(release)) return "Windows";
  return "release";
}

async function fetchReleases(owner, repo) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=40`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": userAgent(),
      },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Latest release for this OS (Windows-only tags vs v*-linux). */
async function fetchLatestPlatformRelease(owner, repo) {
  const releases = await fetchReleases(owner, repo);
  if (!Array.isArray(releases)) return null;

  if (wantsLinuxRelease()) {
    for (const release of releases) {
      if (release.draft) continue;
      if (!isLinuxReleaseTag(release.tag_name)) continue;
      if (!releaseHasLinuxAppImage(release)) continue;
      return release;
    }
    return null;
  }

  for (const release of releases) {
    if (release.draft) continue;
    if (isLinuxReleaseTag(release.tag_name)) continue;
    if (!isWindowsReleaseTag(release.tag_name)) continue;
    if (!releaseHasWindowsInstaller(release)) continue;
    return release;
  }
  return null;
}

function releaseIsNewerBuild(release, buildMeta) {
  if (!buildMeta?.builtAt || !release?.published_at) return false;
  const built = new Date(buildMeta.builtAt).getTime();
  const published = new Date(release.published_at).getTime();
  if (!Number.isFinite(built) || !Number.isFinite(published)) return false;
  return published > built + 60_000;
}

async function checkForUpdates(cfg) {
  const repo = resolveUpdateRepo(cfg);
  if (!repo) {
    return {
      available: false,
      error: "Update repo not configured. Set updateRepo in config.json.",
    };
  }

  const release = await fetchLatestPlatformRelease(repo.owner, repo.repo);
  if (!release?.tag_name) {
    return {
      available: false,
      error: wantsLinuxRelease()
        ? "No Linux release found (look for a v*-linux tag with an AppImage)."
        : "No Windows release found (look for a v* tag with a .exe installer).",
    };
  }

  let currentVersion;
  try {
    const { app } = require("electron");
    currentVersion = app.getVersion();
  } catch {
    return null;
  }
  const latestVersion = normalizeTag(release.tag_name);
  const downloadUrl = pickDownloadUrl(release);
  const platformLabel = platformReleaseLabel(release);
  const buildMeta = readBuildMeta();
  const versionNewer = semverGreaterThan(latestVersion, currentVersion);
  const sameVersionNewerBuild =
    !versionNewer &&
    latestVersion === normalizeTag(currentVersion) &&
    releaseIsNewerBuild(release, buildMeta);

  if (!versionNewer && !sameVersionNewerBuild) {
    return {
      available: false,
      currentVersion,
      latestVersion,
      platformLabel,
    };
  }

  const rebuildNote = sameVersionNewerBuild
    ? `A newer ${platformLabel} build of v${latestVersion} is available.`
    : null;

  if (!downloadUrl) {
    return {
      available: true,
      currentVersion,
      latestVersion,
      platformLabel,
      releaseUrl: release.html_url || null,
      downloadUrl: null,
      rebuildNote,
      error: `Update ${latestVersion} exists but no ${platformLabel} installer was found on that release.`,
    };
  }

  return {
    available: true,
    currentVersion,
    latestVersion,
    releaseUrl: release.html_url || null,
    downloadUrl,
    platformLabel,
    platform: wantsLinuxRelease() ? "linux" : "windows",
    rebuildNote,
  };
}

module.exports = {
  checkForUpdates,
  resolveUpdateRepo,
  semverGreaterThan,
  isLinuxReleaseTag,
  normalizeTag,
  releaseIsNewerBuild,
};
