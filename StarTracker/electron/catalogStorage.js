const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const MANIFEST_NAME = "catalog-manifest.json";
const LEGACY_NAME = "catalog.json";
const SPLIT_SECTIONS = ["terminals", "vehicles", "items", "shopIndex"];

function gzipJson(data) {
  return zlib.gzipSync(JSON.stringify(data), { level: 9 });
}

function readGzipJson(filePath) {
  const raw = fs.readFileSync(filePath);
  const text = zlib.gunzipSync(raw).toString("utf8");
  return JSON.parse(text);
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sectionPath(dir, section) {
  return path.join(dir, `catalog-${section}.json.gz`);
}

function manifestPath(dir) {
  return path.join(dir, MANIFEST_NAME);
}

function legacyPath(dir) {
  return path.join(dir, LEGACY_NAME);
}

function hasSplitCatalog(dir) {
  return fs.existsSync(manifestPath(dir));
}

function hasLegacyCatalog(dir) {
  return fs.existsSync(legacyPath(dir));
}

function writeSplitCatalog(dir, catalog) {
  fs.mkdirSync(dir, { recursive: true });
  for (const section of SPLIT_SECTIONS) {
    fs.writeFileSync(sectionPath(dir, section), gzipJson(catalog[section] || {}));
  }
  const manifest = {
    format: "split-v1",
    sections: SPLIT_SECTIONS,
    meta: catalog.meta || {},
  };
  fs.writeFileSync(manifestPath(dir), JSON.stringify(manifest), "utf8");
}

function readSplitMeta(dir) {
  const manifest = readJsonFile(manifestPath(dir));
  return manifest.meta || {};
}

function readSplitSection(dir, section) {
  const gzPath = sectionPath(dir, section);
  if (!fs.existsSync(gzPath)) {
    throw new Error(`Missing catalog section: ${section}`);
  }
  return readGzipJson(gzPath);
}

function readLegacyCatalog(dir) {
  return readJsonFile(legacyPath(dir));
}

function writeLegacyCatalog(dir, catalog) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(legacyPath(dir), JSON.stringify(catalog), "utf8");
}

function copySplitCatalog(fromDir, toDir) {
  fs.mkdirSync(toDir, { recursive: true });
  fs.copyFileSync(manifestPath(fromDir), manifestPath(toDir));
  for (const section of SPLIT_SECTIONS) {
    fs.copyFileSync(sectionPath(fromDir, section), sectionPath(toDir, section));
  }
}

module.exports = {
  MANIFEST_NAME,
  LEGACY_NAME,
  SPLIT_SECTIONS,
  hasSplitCatalog,
  hasLegacyCatalog,
  writeSplitCatalog,
  writeLegacyCatalog,
  copySplitCatalog,
  readSplitMeta,
  readSplitSection,
  readLegacyCatalog,
  manifestPath,
  legacyPath,
};
