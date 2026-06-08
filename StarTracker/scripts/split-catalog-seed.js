#!/usr/bin/env node
/**
 * Convert bundled catalog.json to gzip-split sections (smaller install footprint).
 * Run: node scripts/split-catalog-seed.js
 */
const fs = require("fs");
const path = require("path");
const {
  writeSplitCatalog,
  readLegacyCatalog,
  legacyPath,
  hasLegacyCatalog,
} = require("../electron/catalogStorage");

const OUT_DIR = path.join(__dirname, "..", "data", "catalog");

function main() {
  if (!hasLegacyCatalog(OUT_DIR)) {
    console.error(`No ${legacyPath(OUT_DIR)} found. Run build:catalog first.`);
    process.exit(1);
  }
  const catalog = readLegacyCatalog(OUT_DIR);
  writeSplitCatalog(OUT_DIR, catalog);
  const legacy = legacyPath(OUT_DIR);
  fs.unlinkSync(legacy);
  const sizes = fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.startsWith("catalog-"))
    .map((f) => {
      const p = path.join(OUT_DIR, f);
      return { file: f, kb: (fs.statSync(p).size / 1024).toFixed(1) };
    });
  console.log("Split catalog written:");
  for (const { file, kb } of sizes) console.log(`  ${file}: ${kb} KB`);
}

main();
