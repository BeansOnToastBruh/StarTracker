#!/usr/bin/env node
/**
 * Runs every self-contained test in scripts/test-*.js as `npm test`.
 *
 * These scripts were previously only ever run by hand (if at all) — nothing
 * in package.json or CI executed them. Each one is a plain node script that
 * exits non-zero on failure (see the `assert()` helper most of them share),
 * so running them here and propagating the worst exit code is enough to
 * make them a real CI gate.
 *
 * Two scripts are intentionally skipped:
 *  - test-parse-log.js: a manual dev tool that parses a real Game.log path
 *    passed on argv — there's no log file in CI, and it's not a pass/fail
 *    assertion script.
 *  - test-star-strings-installer.js: needs the optional `adm-zip` dependency
 *    installed (`npm install`, not `npm install --production`) — skipped
 *    with a clear message rather than failing when it's missing, since dev
 *    installs always have it.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SCRIPTS_DIR = __dirname;
const SKIP = new Set(["test-parse-log.js"]);

function hasAdmZip() {
  try {
    require.resolve("adm-zip");
    return true;
  } catch {
    return false;
  }
}

const files = fs
  .readdirSync(SCRIPTS_DIR)
  .filter((f) => f.startsWith("test-") && f.endsWith(".js"))
  .sort();

let failed = 0;
let skipped = 0;
let passed = 0;

for (const file of files) {
  if (SKIP.has(file)) {
    console.log(`SKIP  ${file} (manual dev tool, needs a real Game.log path)`);
    skipped += 1;
    continue;
  }
  if (file === "test-star-strings-installer.js" && !hasAdmZip()) {
    console.log(`SKIP  ${file} (adm-zip not installed — run \`npm install\` for the full dev suite)`);
    skipped += 1;
    continue;
  }

  const result = spawnSync(process.execPath, [path.join(SCRIPTS_DIR, file)], {
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.status === 0) {
    console.log(`PASS  ${file}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${file}`);
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped (${files.length} total)`);
process.exit(failed > 0 ? 1 : 0);
