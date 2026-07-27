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

/** When wiki API is unavailable or mission is too new — from Game.log definition IDs. */
const LOCAL_MISSION_BY_UUID = {
  "adb32bca-f7d2-4182-a697-d36cc5467183": {
    title: "Defend Asteroid Mining Base",
    reward_min: 18500,
    rank_index: 1,
    estimateSource: "local_datamine",
    faction: { name: "Foxwell Enforcement" },
    mission_giver: "Foxwell Enforcement",
  },
  "660b30df-b638-451d-8947-7784c63b61dc": {
    title: "Ambush Op",
    reward_min: 14000,
    rank_index: 1,
    estimateSource: "local_datamine",
    faction: { name: "Headhunters" },
    mission_giver: "Headhunters",
  },
};

/** Title hints when definition id is missing from markers. */
const TITLE_ESTIMATE_HINTS = [
  {
    re: /defend asteroid mining base/i,
    reward_min: 18500,
    rank_index: 1,
    faction: "Foxwell Enforcement",
  },
  {
    re: /ambush op/i,
    reward_min: 14000,
    rank_index: 1,
    faction: "Headhunters",
  },
  {
    re: /yellow level contract:\s*defend/i,
    reward_min: 18500,
    rank_index: 1,
    faction: "Foxwell Enforcement",
  },
  {
    re: /defend.*asteroid|escort.*ship/i,
    reward_min: 15000,
    rank_index: 1,
    faction: null,
  },
];

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

function missionFromTitleHint(contractTitle) {
  const title = String(contractTitle || "").trim();
  if (!title) return null;
  for (const hint of TITLE_ESTIMATE_HINTS) {
    if (hint.re.test(title)) {
      return {
        title,
        reward_min: hint.reward_min,
        rank_index: hint.rank_index,
        faction: hint.faction ? { name: hint.faction } : null,
        mission_giver: hint.faction,
        estimateSource: "title_heuristic",
      };
    }
  }
  return null;
}

function resolveMissionRecord(uuid, contractTitle) {
  const id = String(uuid || "").trim().toLowerCase();
  if (id && LOCAL_MISSION_BY_UUID[id]) {
    return { ...LOCAL_MISSION_BY_UUID[id], estimateSource: "local_datamine" };
  }
  if (id) {
    const cached = cacheGet(id);
    if (cached) return cached;
  }
  return missionFromTitleHint(contractTitle);
}

async function fetchMissionByUuid(uuid, contractTitle) {
  const id = String(uuid || "").trim().toLowerCase();
  if (!id || id === "00000000-0000-0000-0000-000000000000") {
    return missionFromTitleHint(contractTitle);
  }

  const local = LOCAL_MISSION_BY_UUID[id];
  if (local) return { ...local, estimateSource: "local_datamine" };

  const cached = cacheGet(id);
  if (cached) return cached;

  try {
    const res = await fetchJson(`${WIKI_API}/${id}`);
    const mission = res?.data || null;
    if (mission) {
      cacheSet(id, mission);
      return mission;
    }
  } catch {
    /* fall through */
  }

  return missionFromTitleHint(contractTitle);
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
    const src =
      mission.estimateSource === "local_datamine"
        ? "local_datamine"
        : mission.estimateSource === "title_heuristic"
          ? "title_heuristic"
          : "wiki_datamine";
    const note =
      src === "local_datamine"
        ? "Estimated from known defend/ambush contract data (4.8–4.9). Not confirmed in Game.log."
        : src === "title_heuristic"
          ? "Estimated from contract title pattern and typical 4.8–4.9 payouts. Not confirmed in Game.log."
          : "Datamined base payout from star-citizen.wiki. Your in-game amount may scale with rep.";
    return {
      auec: roundToNiceAuec(rewardMin),
      estimateSource: src,
      estimateNote: note,
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

async function estimatePayoutForContract({
  contractDefinitionId,
  faction,
  standingName,
  contractTitle,
}) {
  const mission = await fetchMissionByUuid(contractDefinitionId, contractTitle);
  if (!mission) return null;

  const factionName =
    faction ||
    mission.faction?.name ||
    mission.mission_giver ||
    null;
  const standing = standingName || "Neutral";
  const est = estimateAuecFromMission(mission, standing);
  if (!est) return null;

  return {
    ...est,
    contractDefinitionId,
    missionTitle: mission.title || contractTitle || null,
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
  LOCAL_MISSION_BY_UUID,
  TITLE_ESTIMATE_HINTS,
  missionFromTitleHint,
  STANDING_AUEC_MULT,
  BASE_AUEC_BY_RANK,
};
