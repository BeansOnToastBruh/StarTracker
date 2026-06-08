const https = require("https");

const WIKI_API = "https://api.star-citizen.wiki/api/missions";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Mercenary-style contracts without datamined reward_min scale with faction standing. */
const STANDING_AUEC_MULT = {
  Neutral: 1,
  "Jr. Contractor": 1.1,
  Contractor: 1.25,
  "Sr. Contractor": 1.4,
  "Veteran Contractor": 1.55,
  "Head Contractor": 1.75,
  "Elite Contractor": 1.9,
};

const BASE_AUEC_BY_RANK = {
  0: 24000,
  1: 32000,
  2: 45000,
  3: 60000,
};

const memoryCache = new Map();

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { Accept: "application/json", "User-Agent": "StarTracker/1.0" }, timeout: 15000 },
      (res) => {
        let body = "";
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

function cacheGet(uuid) {
  const hit = memoryCache.get(uuid);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    memoryCache.delete(uuid);
    return null;
  }
  return hit.data;
}

function cacheSet(uuid, data) {
  memoryCache.set(uuid, { at: Date.now(), data });
}

async function fetchMissionByUuid(uuid) {
  const id = String(uuid || "").trim().toLowerCase();
  if (!id || id === "00000000-0000-0000-0000-000000000000") return null;
  const cached = cacheGet(id);
  if (cached) return cached;
  try {
    const res = await fetchJson(`${WIKI_API}/${id}`);
    const mission = res?.data || null;
    if (mission) cacheSet(id, mission);
    return mission;
  } catch {
    return null;
  }
}

function roundToNiceAuec(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 10000) return Math.round(v / 1000) * 1000;
  if (v >= 1000) return Math.round(v / 100) * 100;
  return Math.round(v);
}

/**
 * Estimate aUEC when Game.log omits payout. Uses wiki reward_min when present,
 * otherwise rank_index + tracked faction rep standing.
 */
function estimateAuecFromMission(mission, standingName) {
  if (!mission) return null;

  const rewardMin = Number(mission.reward_min);
  if (Number.isFinite(rewardMin) && rewardMin > 0) {
    return {
      auec: roundToNiceAuec(rewardMin),
      estimateSource: "wiki_datamine",
      estimateNote: "Datamined base payout from star-citizen.wiki. Your in-game amount may scale with rep.",
    };
  }

  const rank = Number(mission.rank_index) || 0;
  const base = BASE_AUEC_BY_RANK[rank] ?? BASE_AUEC_BY_RANK[0];
  const mult = STANDING_AUEC_MULT[standingName] ?? STANDING_AUEC_MULT.Neutral;
  const auec = roundToNiceAuec(base * mult);
  if (!auec) return null;

  return {
    auec,
    estimateSource: "wiki_rep_tier",
    estimateNote: `Estimated from wiki mission rank ${rank} and ${standingName || "Neutral"} standing with ${mission.faction?.name || mission.mission_giver || "faction"}. Not confirmed in Game.log.`,
  };
}

async function estimatePayoutForContract({ contractDefinitionId, faction, standingName }) {
  const mission = await fetchMissionByUuid(contractDefinitionId);
  if (!mission) return null;

  const factionName = faction || mission.faction?.name || mission.mission_giver || null;
  const standing = standingName || "Neutral";
  const est = estimateAuecFromMission(mission, standing);
  if (!est) return null;

  return {
    ...est,
    contractDefinitionId,
    missionTitle: mission.title || null,
    debugName: mission.debug_name || null,
    faction: factionName,
    standing,
    wikiUrl: mission.link || mission.web_url || null,
  };
}

function clearCacheForTests() {
  memoryCache.clear();
}

module.exports = {
  fetchMissionByUuid,
  estimateAuecFromMission,
  estimatePayoutForContract,
  roundToNiceAuec,
  clearCacheForTests,
  STANDING_AUEC_MULT,
  BASE_AUEC_BY_RANK,
};
