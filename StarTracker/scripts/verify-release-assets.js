"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const version = process.argv[2];
const platform = (process.argv[3] || "").toLowerCase();

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: node verify-release-assets.js <semver> windows|linux");
  process.exit(2);
}

function existsAny(candidates) {
  return candidates.find((p) => fs.existsSync(path.join(ROOT, p)));
}

if (platform === "windows") {
  const installer = existsAny([
    `StarTracker-${version}-x64.exe`,
    `dist/StarTracker-${version}-x64.exe`,
  ]);
  const portable = existsAny([
    `StarTracker-${version}-portable.exe`,
    `dist/StarTracker-${version}-portable.exe`,
  ]);
  if (!installer) {
    console.error(`Missing Windows installer for version ${version}`);
    process.exit(1);
  }
  if (!portable) {
    console.error(`Missing Windows portable for version ${version}`);
    process.exit(1);
  }
  console.log(`verify-release-assets: OK Windows ${version}`);
  process.exit(0);
}

if (platform === "linux") {
  const appImage = existsAny([
    `StarTracker-${version}-x86_64.AppImage`,
    `StarTracker-${version}-x64.AppImage`,
    `dist/StarTracker-${version}-x86_64.AppImage`,
    `dist/StarTracker-${version}-x64.AppImage`,
  ]);
  if (!appImage) {
    console.error(`Missing Linux AppImage for version ${version}`);
    process.exit(1);
  }
  console.log(`verify-release-assets: OK Linux ${version} (${appImage})`);
  process.exit(0);
}

console.error('Platform must be "windows" or "linux"');
process.exit(2);
