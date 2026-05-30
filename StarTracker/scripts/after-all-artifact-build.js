"use strict";

const fs = require("fs/promises");
const path = require("path");

/** NSIS installer and portable exe only (not blockmaps or unpacked app). */
const SHIPPING_EXE = /^StarTracker-.+-(?:x64|portable)\.exe$/;

/**
 * Move shipping installers from dist/ to the project root so they are visible
 * when opening the folder. Intermediate artifacts stay in dist/.
 */
module.exports = async function afterAllArtifactBuild(buildResult) {
  const projectDir = path.resolve(__dirname, "..");
  const promoted = [];

  for (const artifactPath of buildResult.artifactPaths) {
    const base = path.basename(artifactPath);
    if (!SHIPPING_EXE.test(base)) continue;

    const dest = path.join(projectDir, base);
    if (path.resolve(artifactPath) === dest) continue;

    try {
      await fs.rename(artifactPath, dest);
    } catch {
      await fs.copyFile(artifactPath, dest);
      await fs.unlink(artifactPath);
    }
    promoted.push(dest);
  }

  return promoted;
};
