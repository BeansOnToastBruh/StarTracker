const { filenameFromUrl } = require("../electron/updateInstaller");
const {
  semverGreaterThan,
  normalizeTag,
  isLinuxReleaseTag,
} = require("../electron/updateChecker");

function isWindowsReleaseTag(tag) {
  return /^v\d+\.\d+\.\d+$/i.test(String(tag || "").trim());
}

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    return false;
  }
  console.log("PASS:", message);
  return true;
}

assert(
  filenameFromUrl(
    "https://github.com/BeansOnToastBruh/StarTracker/releases/download/v1.0.3/StarTracker-1.0.3-x64.exe",
    "windows"
  ) === "StarTracker-1.0.3-x64.exe",
  "Windows filename parsed from GitHub URL"
);

assert(
  filenameFromUrl(
    "https://github.com/BeansOnToastBruh/StarTracker/releases/download/v1.0.4-linux/StarTracker-1.0.4-x64.AppImage",
    "linux"
  ) === "StarTracker-1.0.4-x64.AppImage",
  "Linux AppImage filename parsed from GitHub URL"
);

assert(semverGreaterThan("1.0.3", "1.0.1"), "1.0.3 newer than 1.0.1");
assert(semverGreaterThan("1.0.4", "1.0.3"), "1.0.4 newer than 1.0.3");
assert(!semverGreaterThan("1.0.3", "1.0.3"), "same version not newer");
assert(normalizeTag("v1.0.4-linux") === "1.0.4", "normalizeTag strips linux suffix");
assert(isLinuxReleaseTag("v1.0.4-linux"), "v1.0.4-linux is linux tag");
assert(isWindowsReleaseTag("v1.0.3"), "v1.0.3 is windows tag");
assert(!isWindowsReleaseTag("v1.0.4-linux"), "linux tag not windows tag");

const { releaseIsNewerBuild } = require("../electron/updateChecker");
assert(
  releaseIsNewerBuild(
    { published_at: "2026-05-30T12:00:00Z" },
    { builtAt: "2026-05-29T12:00:00Z" }
  ),
  "newer GitHub release detected for same version"
);
assert(
  !releaseIsNewerBuild(
    { published_at: "2026-05-29T12:00:00Z" },
    { builtAt: "2026-05-29T12:00:00Z" }
  ),
  "same-day build within grace window not flagged"
);

if (!process.exitCode) console.log("test-update-installer: ok");
