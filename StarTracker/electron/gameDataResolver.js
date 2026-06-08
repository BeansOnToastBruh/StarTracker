const fs = require("fs");
const path = require("path");

const API_BASE = "https://api.star-citizen.wiki/api";
const CACHE_VERSION = 1;
const MIN_FETCH_GAP_MS = 1100;

let cachePath = null;
let seed = {};
let cache = { version: CACHE_VERSION, byClassName: {} };
let initialized = false;
let saveTimer = null;
let lastFetchAt = 0;
const inFlight = new Map();

function classNameToSlug(className) {
  return String(className || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function vehicleDisplayName(data) {
  const mfr = data?.manufacturer?.name || data?.manufacturer || null;
  const name = data?.name || data?.displayName;
  if (!name) return null;
  if (mfr && !String(name).toLowerCase().includes(String(mfr).toLowerCase())) {
    return `${mfr} ${name}`;
  }
  return name;
}

function entryFromVehicle(data) {
  if (!data) return null;
  return {
    type: "vehicle",
    name: vehicleDisplayName(data),
    displayName: data.name || null,
    manufacturer: data.manufacturer?.name || data.manufacturer || null,
    className: data.class_name || data.className || null,
    slug: data.slug || null,
    source: "api",
    resolvedAt: new Date().toISOString(),
  };
}

function entryFromItem(data) {
  if (!data?.name) return null;
  return {
    type: "item",
    name: data.name,
    displayName: data.name,
    manufacturer: data.manufacturer?.name || null,
    className: data.class_name || data.className || null,
    slug: data.slug || null,
    classification: data.classification_label || data.classification || null,
    source: "api",
    resolvedAt: new Date().toISOString(),
  };
}

function scheduleSave() {
  if (!cachePath) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
    } catch {
      /* ignore cache write errors */
    }
  }, 400);
}

function ensureInit() {
  if (!initialized) init({});
}

function init(options = {}) {
  if (initialized) return;
  cachePath = options.cachePath || null;
  try {
    const seedPath = path.join(__dirname, "..", "data", "game-data-seed.json");
    if (fs.existsSync(seedPath)) {
      seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
    }
  } catch {
    seed = {};
  }
  if (cachePath && fs.existsSync(cachePath)) {
    try {
      const loaded = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      if (loaded?.byClassName) cache = loaded;
    } catch {
      cache = { version: CACHE_VERSION, byClassName: {} };
    }
  }
  initialized = true;
}

function getEntry(className) {
  ensureInit();
  if (!className) return null;
  const key = String(className).trim();
  return cache.byClassName[key] || seed[key] || null;
}

function putEntry(className, entry) {
  if (!className || !entry?.name) return;
  cache.byClassName[String(className).trim()] = entry;
  scheduleSave();
}

function formatLabel(className, options = {}) {
  const entry = getEntry(className);
  const quantity = options.quantity ?? null;
  if (entry?.name) {
    if (quantity != null && quantity > 1) {
      return `${entry.name} ×${quantity}`;
    }
    return entry.name;
  }
  return null;
}

async function throttleFetch() {
  const now = Date.now();
  const wait = Math.max(0, MIN_FETCH_GAP_MS - (now - lastFetchAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt = Date.now();
}

async function fetchVehicle(className) {
  const slug = classNameToSlug(className);
  let res = await fetch(`${API_BASE}/vehicles/${slug}`);
  if (res.ok) {
    const json = await res.json();
    return entryFromVehicle(json.data);
  }
  res = await fetch(
    `${API_BASE}/vehicles?filter[class_name]=${encodeURIComponent(className)}`
  );
  if (!res.ok) return null;
  const json = await res.json();
  return entryFromVehicle(json.data?.[0]);
}

async function fetchItem(className) {
  let res = await fetch(
    `${API_BASE}/search/${encodeURIComponent(className)}`
  );
  if (res.ok) {
    const json = await res.json();
    const row = json.data;
    if (row && (row.class_name === className || row.name)) {
      return entryFromItem(row);
    }
  }
  res = await fetch(
    `${API_BASE}/items?filter[class_name]=${encodeURIComponent(className)}`
  );
  if (!res.ok) return null;
  const json = await res.json();
  return entryFromItem(json.data?.[0]);
}

async function fetchFromApi(className) {
  const vehicle = await fetchVehicle(className);
  if (vehicle?.name) return vehicle;
  return fetchItem(className);
}

async function ensureResolved(className) {
  if (!className) return null;
  const key = String(className).trim();
  const existing = getEntry(key);
  if (existing?.name) return existing;

  if (inFlight.has(key)) return inFlight.get(key);

  const task = (async () => {
    try {
      await throttleFetch();
      const entry = await fetchFromApi(key);
      if (entry?.name) putEntry(key, entry);
      return entry || null;
    } catch {
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, task);
  return task;
}

async function ensureAll(classNames, options = {}) {
  const timeoutMs = options.timeoutMs ?? 12000;
  const unique = [...new Set((classNames || []).filter(Boolean))];
  const pending = unique.filter((c) => !getEntry(c)?.name);
  if (!pending.length) return { resolved: 0, pending: 0 };

  const started = Date.now();
  let resolved = 0;
  for (const className of pending) {
    if (Date.now() - started > timeoutMs) break;
    const entry = await ensureResolved(className);
    if (entry?.name) resolved += 1;
  }
  return {
    resolved,
    pending: pending.length - resolved,
    cached: unique.length - pending.length,
  };
}

function getStats() {
  return {
    cached: Object.keys(cache.byClassName).length,
    seeded: Object.keys(seed).length,
    inFlight: inFlight.size,
  };
}

module.exports = {
  init,
  getEntry,
  putEntry,
  formatLabel,
  ensureResolved,
  ensureAll,
  getStats,
  vehicleDisplayName,
};
