"use strict";

const fs = require("fs/promises");
const path = require("path");

/** Shipping installers moved to project root (not blockmaps / unpacked dirs). */
const SHIPPING_ARTIFACT = /^StarTracker-.+\.(exe|AppImage|deb)$/;

/**
 * Move shipping builds from dist/ to the project root so they are visible
 * when opening the folder. Intermediate artifacts stay in dist/.
 */
module.exports = async function afterAllArtifactBuild(buildResult) {
  const projectDir = path.resolve(__dirname, "..");
  const promoted = [];

  for (const artifactPath of buildResult.artifactPaths) {
    const base = path.basename(artifactPath);
    if (!SHIPPING_ARTIFACT.test(base)) continue;

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
