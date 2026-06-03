"use strict";

const { execSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(ROOT, "..");

const BANNED_TRACKED = [
  /\.exe$/i,
  /\.AppImage$/i,
  /\.deb$/i,
  /(^|\/)dist\//i,
  /win-unpacked/i,
  /\.blockmap$/i,
  /builder-debug\.yml$/i,
  /builder-effective-config\.yaml$/i,
];

function gitLsFiles() {
  try {
    return execSync("git ls-files", {
      cwd: REPO_ROOT,
      encoding: "utf8",
    })
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
  } catch (e) {
    console.error("verify-repo-hygiene: git ls-files failed", e.message);
    process.exit(2);
  }
}

const tracked = gitLsFiles();
const banned = tracked.filter((f) => BANNED_TRACKED.some((re) => re.test(f)));

if (banned.length) {
  console.error(
    "ERROR: Installers and build artifacts must not be committed to git.\n" +
      "Releases are built in GitHub Actions when you push a tag.\n" +
      "Remove these files from the repo and add them to .gitignore:\n"
  );
  for (const f of banned) console.error("  -", f);
  process.exit(1);
}

console.log(
  `verify-repo-hygiene: OK (${tracked.length} tracked files, no installers in git)`
);
