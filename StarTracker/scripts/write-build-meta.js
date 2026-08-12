const fs = require("fs");
const path = require("path");

const pkg = require("../package.json");
const releaseTag =
  process.env.RELEASE_TAG ||
  process.env.GITHUB_REF_NAME ||
  (pkg.version ? `v${pkg.version}` : null);
const meta = {
  version: pkg.version,
  releaseTag: releaseTag || null,
  commit: process.env.GITHUB_SHA || process.env.GIT_COMMIT || null,
  builtAt: new Date().toISOString(),
};

const out = path.join(__dirname, "..", "build-meta.json");
fs.writeFileSync(out, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
console.log(`Wrote ${out} (${meta.version} @ ${meta.builtAt})`);
