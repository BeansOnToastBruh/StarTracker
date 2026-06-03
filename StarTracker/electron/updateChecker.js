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

function pickDownloadUrl(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const name = (a) => a?.name || "";

  if (process.platform === "linux") {
    const appImage = assets.find(
      (a) =>
        a?.browser_download_url &&
        /\.AppImage$/i.test(name(a)) &&
        /StarTracker/i.test(name(a))
    );
    if (appImage?.browser_download_url) return appImage.browser_download_url;

    const deb = assets.find(
      (a) =>
        a?.browser_download_url &&
        /\.deb$/i.test(name(a)) &&
        /StarTracker/i.test(name(a))
    );
    if (deb?.browser_download_url) return deb.browser_download_url;
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
  }

  const anyExe = assets.find(
    (a) => a?.browser_download_url && /\.exe$/i.test(name(a))
  );
  if (anyExe?.browser_download_url) return anyExe.browser_download_url;

  const anyAppImage = assets.find(
    (a) => a?.browser_download_url && /\.AppImage$/i.test(name(a))
  );
  if (anyAppImage?.browser_download_url) return anyAppImage.browser_download_url;

  return release?.html_url || null;
}

function normalizeTag(tag) {
  return String(tag || "")
    .replace(/^v/i, "")
    .trim();
}

async function fetchLatestRelease(owner, repo) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`;
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

async function checkForUpdates(cfg) {
  const repo = resolveUpdateRepo(cfg);
  if (!repo) return null;

  const release = await fetchLatestRelease(repo.owner, repo.repo);
  if (!release?.tag_name) return null;

  let currentVersion;
  try {
    const { app } = require("electron");
    currentVersion = app.getVersion();
  } catch {
    return null;
  }
  const latestVersion = normalizeTag(release.tag_name);

  if (!latestVersion || !semverGreaterThan(latestVersion, currentVersion)) {
    return {
      available: false,
      currentVersion,
      latestVersion,
    };
  }

  return {
    available: true,
    currentVersion,
    latestVersion,
    releaseUrl: release.html_url || null,
    downloadUrl: pickDownloadUrl(release),
  };
}

module.exports = {
  checkForUpdates,
  resolveUpdateRepo,
  semverGreaterThan,
};
