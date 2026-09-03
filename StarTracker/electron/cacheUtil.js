/**
 * Shared on-disk cache helpers for the domain/intel modules in this
 * directory. Two shapes were being hand-rolled (near-identically) across
 * several files:
 *
 *  - a "per-id" cache: one small JSON file per cached entity, keyed by a
 *    `kind` + id (combatIntel.js item/vehicle profiles, craftingIntel.js
 *    blueprints), each stamped with `fetchedAt` and expired by a TTL.
 *  - a "blob" cache: one JSON file holding a whole fetched payload
 *    (guidesHub.js commodities, wikeloIntel.js trades, catalogSync.js),
 *    also stamped with `fetchedAt` and checked with `isFresh`.
 *
 * Both take `cacheDir`/`seedDir` explicitly rather than closing over module
 * state, so callers keep owning their own `init({ cacheDir, seedDir })`.
 */
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------
// Per-id disk cache
// ---------------------------------------------------------------------

function cacheFileKey(cacheDir, kind, id) {
  const safe = String(id).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return path.join(cacheDir || "", `${kind}-${safe}.json`);
}

/** Returns the cached `{fetchedAt, ...payload}` blob, or null if missing/stale. */
function readDiskCache(cacheDir, kind, id, ttlMs) {
  if (!cacheDir) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(cacheFileKey(cacheDir, kind, id), "utf8"));
    if (!raw?.fetchedAt) return null;
    if (Date.now() - new Date(raw.fetchedAt).getTime() > ttlMs) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeDiskCache(cacheDir, kind, id, payload) {
  if (!cacheDir) return;
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      cacheFileKey(cacheDir, kind, id),
      JSON.stringify({ fetchedAt: new Date().toISOString(), ...payload }, null, 2),
      "utf8"
    );
  } catch {
    /* best-effort cache write */
  }
}

// ---------------------------------------------------------------------
// Blob disk cache
// ---------------------------------------------------------------------

function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function cachePath(cacheDir, name) {
  return cacheDir ? path.join(cacheDir, name) : null;
}

function isFresh(entry, ttlMs) {
  if (!entry?.fetchedAt) return false;
  return Date.now() - new Date(entry.fetchedAt).getTime() < ttlMs;
}

// ---------------------------------------------------------------------
// Bundled seed data (fallback when there's no cache and no network yet)
// ---------------------------------------------------------------------

function readSeed(seedDir, name) {
  if (!seedDir) return null;
  return readJsonFile(path.join(seedDir, name), null);
}

module.exports = {
  cacheFileKey,
  readDiskCache,
  writeDiskCache,
  readJsonFile,
  writeJsonFile,
  cachePath,
  isFresh,
  readSeed,
};
