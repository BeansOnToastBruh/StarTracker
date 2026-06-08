#!/usr/bin/env node
/**
 * Build bundled catalog seed from Star Citizen Wiki + UEX.
 * Run: node scripts/build-catalog-seed.js
 */
const fs = require("fs");
const path = require("path");
const { syncCatalog } = require("../electron/catalogSync");

const OUT_DIR = path.join(__dirname, "..", "data", "catalog");

async function main() {
  console.log("Building catalog seed (this may take several minutes)…");
  const started = Date.now();
  const catalog = await syncCatalog((p) => {
    if (p.phase === "uex" || p.phase === "vehicles" || p.phase === "wiki-items") {
      process.stdout.write(
        `\r[${p.phase}] ${p.message || ""} ${p.count != null ? `(${p.count})` : ""}   `
      );
    }
  });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, "catalog.json");
  fs.writeFileSync(outPath, JSON.stringify(catalog));
  const mb = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2);
  console.log(
    `\nWrote ${outPath} (${mb} MB) in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
  console.log("Counts:", catalog.meta.counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
