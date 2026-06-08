const fs = require("fs");
const path = require("path");

/** Standard faction rep tiers (matches star-citizen.wiki tables). */
const REP_TIERS = [
  { name: "Neutral", min: 0 },
  { name: "Jr. Contractor", min: 800 },
  { name: "Contractor", min: 2200 },
  { name: "Sr. Contractor", min: 5800 },
  { name: "Veteran Contractor", min: 15000 },
  { name: "Head Contractor", min: 38000 },
  { name: "Elite Contractor", min: 95250 },
];

let storePath = null;
let repByFaction = {};

function init(filePath) {
  storePath = filePath;
  load();
}

function load() {
  if (!storePath) return;
  try {
    const raw = JSON.parse(fs.readFileSync(storePath, "utf8"));
    repByFaction = raw?.repByFaction && typeof raw.repByFaction === "object" ? raw.repByFaction : {};
  } catch {
    repByFaction = {};
  }
}

function save() {
  if (!storePath) return;
  try {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify({ repByFaction, updatedAt: new Date().toISOString() }, null, 2));
  } catch {
    /* ignore persistence errors */
  }
}

function normalizeFaction(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

function getRep(faction) {
  const key = normalizeFaction(faction);
  if (!key) return 0;
  return Number(repByFaction[key]) || 0;
}

function addRep(faction, amount) {
  const key = normalizeFaction(faction);
  const n = Number(amount);
  if (!key || !Number.isFinite(n) || n <= 0) return getRep(key);
  repByFaction[key] = getRep(key) + n;
  save();
  return repByFaction[key];
}

function standingForRep(totalRep) {
  const xp = Math.max(0, Number(totalRep) || 0);
  let standing = REP_TIERS[0];
  for (const tier of REP_TIERS) {
    if (xp >= tier.min) standing = tier;
  }
  return standing.name;
}

function resetForTests() {
  repByFaction = {};
  storePath = null;
}

module.exports = {
  REP_TIERS,
  init,
  load,
  save,
  getRep,
  addRep,
  standingForRep,
  normalizeFaction,
  resetForTests,
};
