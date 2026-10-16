const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const https = require("https");

const WIKI_API = "https://api.star-citizen.wiki/api/missions";
const UEX_CONTRACTS = "https://api.uexcorp.space/2.0/contracts";
const SC_CODEX_CONTRACTS = "https://sc-codex.ru/api/public/v1/contracts";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const UEX_TTL_MS = 24 * 60 * 60 * 1000;
const TITLE_LOOKUP_TTL_MS = 6 * 60 * 60 * 1000;

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
  {
    re: /a swift reprisal/i,
    reward_min: 12000,
    rank_index: 0,
    faction: "Headhunters",
  },
];

const memoryCache = new Map();
const titleLookupCache = new Map();

let seedDir = null;
let scCodexApiKey = null;
let seedIndex = null;
let uexIndex = null;
let uexFetchedAt = 0;

function init(options = {}) {
  seedDir = options.seedDir || null;
  scCodexApiKey = options.scCodexApiKey || process.env.STARTRACKER_SC_CODEX_KEY || null;
  seedIndex = null;
}

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "StarTracker/1.0",
          ...headers,
        },
        timeout: 15000,
      },
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

function normalizeTitle(title) {
  return String(title || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/contract\s+(accepted|complete|completed)\s*:?/gi, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function expandSeedRow(row) {
  if (!row?.u) return null;
  return {
    uuid: row.u,
    title: row.t || null,
    reward_min: row.rm,
    reward_max: row.rx,
    reputation_amount: row.ra,
    rank_index: row.ri,
    faction: row.f ? { name: row.f } : null,
    mission_giver: row.g || row.f || null,
    debug_name: row.d || null,
    link: row.l || null,
    estimateSource: "wiki_seed",
  };
}

function loadSeedIndex() {
  if (seedIndex) return seedIndex;
  const byUuid = new Map();
  const byTitle = new Map();

  const tryLoad = (filePath) => {
    if (!fs.existsSync(filePath)) return false;
    let raw;
    if (filePath.endsWith(".gz")) {
      raw = zlib.gunzipSync(fs.readFileSync(filePath)).toString("utf8");
    } else {
      raw = fs.readFileSync(filePath, "utf8");
    }
    const payload = JSON.parse(raw);
    for (const row of payload.missions || []) {
      const mission = expandSeedRow(row);
      if (!mission) continue;
      byUuid.set(String(mission.uuid).toLowerCase(), mission);
      const key = normalizeTitle(mission.title);
      if (!key) continue;
      if (!byTitle.has(key)) byTitle.set(key, []);
      byTitle.get(key).push(mission);
    }
    seedIndex = {
      byUuid,
      byTitle,
      syncedAt: payload.syncedAt || null,
      counts: payload.counts || null,
    };
    return true;
  };

  const candidates = [];
  if (seedDir) {
    candidates.push(path.join(seedDir, "mission-payouts.json.gz"));
    candidates.push(path.join(seedDir, "mission-payouts.json"));
    candidates.push(path.join(seedDir, "..", "missions", "mission-payouts.json.gz"));
  }
  candidates.push(path.join(__dirname, "..", "data", "missions", "mission-payouts.json.gz"));

  for (const filePath of candidates) {
    try {
      if (tryLoad(filePath)) return seedIndex;
    } catch {
      /* try next */
    }
  }

  seedIndex = { byUuid, byTitle, syncedAt: null, counts: null };
  return seedIndex;
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

function pickBestPayoutSibling(candidates, preferRank = null) {
  const paid = (candidates || []).filter((m) => Number(m.reward_min) > 0);
  if (!paid.length) return null;
  if (preferRank != null) {
    const sameRank = paid.filter((m) => Number(m.rank_index) === Number(preferRank));
    if (sameRank.length) {
      sameRank.sort((a, b) => Number(b.reward_min) - Number(a.reward_min));
      return sameRank[0];
    }
  }
  paid.sort((a, b) => Number(b.reward_min) - Number(a.reward_min));
  return paid[0];
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

function missionFromSeedTitle(contractTitle, preferRank = null) {
  const key = normalizeTitle(contractTitle);
  if (!key) return null;
  const index = loadSeedIndex();
  const sibling = pickBestPayoutSibling(index.byTitle.get(key) || [], preferRank);
  if (!sibling) return null;
  return { ...sibling, estimateSource: "wiki_title_sibling" };
}

async function fetchMissionsByTitleLive(contractTitle) {
  const title = String(contractTitle || "").trim();
  if (!title) return [];
  const key = normalizeTitle(title);
  const cached = titleLookupCache.get(key);
  if (cached && Date.now() - cached.at < TITLE_LOOKUP_TTL_MS) return cached.rows;

  try {
    const encoded = encodeURIComponent(title);
    const res = await fetchJson(
      `${WIKI_API}?filter[title]=${encoded}&page[size]=25&page[number]=1`
    );
    const rows = (res?.data || []).map((m) => ({
      ...m,
      estimateSource: "wiki_title_search",
    }));
    titleLookupCache.set(key, { at: Date.now(), rows });
    return rows;
  } catch {
    return [];
  }
}

async function ensureUexIndex() {
  if (uexIndex && Date.now() - uexFetchedAt < UEX_TTL_MS) return uexIndex;
  try {
    const res = await fetchJson(UEX_CONTRACTS);
    const byTitle = new Map();
    for (const row of res?.data || []) {
      const key = normalizeTitle(row.name);
      if (!key) continue;
      const payout = Number(row.payout);
      if (!Number.isFinite(payout) || payout <= 0) continue;
      byTitle.set(key, {
        title: row.name,
        reward_min: payout,
        reward_max: null,
        reputation_amount: null,
        rank_index: null,
        faction: {
          name: row.faction_name || row.company_name || row.contact_name || null,
        },
        mission_giver: row.contact_name || row.company_name || null,
        estimateSource: "uex_contracts",
        link: "https://uexcorp.space/",
      });
    }
    uexIndex = byTitle;
    uexFetchedAt = Date.now();
  } catch {
    uexIndex = uexIndex || new Map();
  }
  return uexIndex;
}

async function fetchScCodexByUuid(uuid) {
  if (!scCodexApiKey || !uuid) return null;
  try {
    const res = await fetchJson(`${SC_CODEX_CONTRACTS}/${uuid}`, {
      Accept: "application/vnd.api+json",
      "X-Api-Key": scCodexApiKey,
    });
    const attrs = res?.data?.attributes || res?.data || null;
    if (!attrs) return null;
    const rewardMin = Number(attrs.reward_auec_min ?? attrs.reward_min);
    return {
      uuid,
      title: attrs.title || null,
      reward_min: Number.isFinite(rewardMin) && rewardMin > 0 ? rewardMin : null,
      reward_max: Number(attrs.reward_auec_max) > 0 ? Number(attrs.reward_auec_max) : null,
      reputation_amount: null,
      rank_index: attrs.rank_index ?? null,
      faction: attrs.faction_name ? { name: attrs.faction_name } : null,
      mission_giver: attrs.faction_name || null,
      estimateSource: "sc_codex",
      link: `https://sc-codex.ru/`,
    };
  } catch {
    return null;
  }
}

function resolveMissionRecord(uuid, contractTitle) {
  const id = String(uuid || "").trim().toLowerCase();
  if (id && LOCAL_MISSION_BY_UUID[id]) {
    return { ...LOCAL_MISSION_BY_UUID[id], estimateSource: "local_datamine" };
  }
  if (id) {
    const cached = cacheGet(id);
    if (cached) return cached;
    const seeded = loadSeedIndex().byUuid.get(id);
    if (seeded) return seeded;
  }
  return missionFromTitleHint(contractTitle) || missionFromSeedTitle(contractTitle);
}

async function enrichMissingPayout(mission, contractTitle) {
  if (!mission) return null;
  if (Number(mission.reward_min) > 0) return mission;

  const preferRank = mission.rank_index;
  const title = contractTitle || mission.title;

  const seedHit = missionFromSeedTitle(title, preferRank);
  if (seedHit && Number(seedHit.reward_min) > 0) {
    return {
      ...mission,
      reward_min: seedHit.reward_min,
      reward_max: seedHit.reward_max ?? mission.reward_max,
      estimateSource: "wiki_title_sibling",
      payoutDonorUuid: seedHit.uuid || null,
      payoutDonorTitle: seedHit.title || null,
    };
  }

  const liveRows = await fetchMissionsByTitleLive(title);
  const liveHit = pickBestPayoutSibling(liveRows, preferRank);
  if (liveHit && Number(liveHit.reward_min) > 0) {
    return {
      ...mission,
      reward_min: liveHit.reward_min,
      reward_max: liveHit.reward_max ?? mission.reward_max,
      estimateSource: "wiki_title_sibling",
      payoutDonorUuid: liveHit.uuid || null,
      payoutDonorTitle: liveHit.title || null,
    };
  }

  const uex = await ensureUexIndex();
  const uexHit = uex.get(normalizeTitle(title));
  if (uexHit) {
    return {
      ...mission,
      reward_min: uexHit.reward_min,
      estimateSource: "uex_contracts",
      mission_giver: mission.mission_giver || uexHit.mission_giver,
      faction: mission.faction || uexHit.faction,
    };
  }

  return mission;
}

async function fetchMissionByUuid(uuid, contractTitle) {
  const id = String(uuid || "").trim().toLowerCase();
  if (!id || id === "00000000-0000-0000-0000-000000000000") {
    return (
      missionFromTitleHint(contractTitle) ||
      missionFromSeedTitle(contractTitle) ||
      null
    );
  }

  const local = LOCAL_MISSION_BY_UUID[id];
  if (local) return { ...local, estimateSource: "local_datamine" };

  const cached = cacheGet(id);
  if (cached) return enrichMissingPayout(cached, contractTitle || cached.title);

  const seeded = loadSeedIndex().byUuid.get(id);
  if (seeded) {
    cacheSet(id, seeded);
    return enrichMissingPayout(seeded, contractTitle || seeded.title);
  }

  try {
    const res = await fetchJson(`${WIKI_API}/${id}`);
    const mission = res?.data || null;
    if (mission) {
      cacheSet(id, mission);
      return enrichMissingPayout(mission, contractTitle || mission.title);
    }
  } catch {
    /* fall through */
  }

  const codex = await fetchScCodexByUuid(id);
  if (codex) {
    cacheSet(id, codex);
    return enrichMissingPayout(codex, contractTitle || codex.title);
  }

  return (
    missionFromTitleHint(contractTitle) ||
    missionFromSeedTitle(contractTitle) ||
    null
  );
}

async function fetchMissionByTitle(contractTitle) {
  const title = String(contractTitle || "").trim();
  if (!title) return null;

  const hint = missionFromTitleHint(title);
  if (hint) return hint;

  const seedHit = missionFromSeedTitle(title);
  if (seedHit && Number(seedHit.reward_min) > 0) return seedHit;

  const liveRows = await fetchMissionsByTitleLive(title);
  const liveHit = pickBestPayoutSibling(liveRows);
  if (liveHit) return liveHit;

  const uex = await ensureUexIndex();
  const uexHit = uex.get(normalizeTitle(title));
  if (uexHit) return uexHit;

  return seedHit || null;
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
          : mission.estimateSource === "wiki_title_sibling"
            ? "wiki_title_sibling"
            : mission.estimateSource === "uex_contracts"
              ? "uex_contracts"
              : mission.estimateSource === "sc_codex"
                ? "sc_codex"
                : mission.estimateSource === "wiki_seed"
                  ? "wiki_datamine"
                  : "wiki_datamine";
    const note =
      src === "local_datamine"
        ? "Estimated from known defend/ambush contract data (4.8–4.10). Not confirmed in Game.log."
        : src === "title_heuristic"
          ? "Estimated from contract title pattern and typical 4.8–4.10 payouts. Not confirmed in Game.log."
          : src === "wiki_title_sibling"
            ? "Datamined payout from a same-title wiki mission variant (your UUID had no reward_min). May scale with rep."
            : src === "uex_contracts"
              ? "Community payout from UEX contracts database. Not confirmed in Game.log."
              : src === "sc_codex"
                ? "Payout from SC Codex contract catalog. Not confirmed in Game.log."
                : "Datamined base payout from star-citizen.wiki. Your in-game amount may scale with rep.";
    const rewardMax = Number(mission.reward_max);
    return {
      auec: roundToNiceAuec(rewardMin),
      auecMax:
        Number.isFinite(rewardMax) && rewardMax > rewardMin
          ? roundToNiceAuec(rewardMax)
          : null,
      reputationAmount:
        Number(mission.reputation_amount) > 0
          ? Number(mission.reputation_amount)
          : null,
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
    auecMax: null,
    reputationAmount:
      Number(mission.reputation_amount) > 0
        ? Number(mission.reputation_amount)
        : null,
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
  let mission = null;
  if (contractDefinitionId) {
    mission = await fetchMissionByUuid(contractDefinitionId, contractTitle);
  }
  if (!mission && contractTitle) {
    mission = await fetchMissionByTitle(contractTitle);
  }
  if (!mission) return null;

  const factionName =
    faction || mission.faction?.name || mission.mission_giver || null;
  const standing = standingName || "Neutral";
  const est = estimateAuecFromMission(mission, standing);
  if (!est) return null;

  return {
    ...est,
    contractDefinitionId: contractDefinitionId || mission.uuid || null,
    missionTitle: mission.title || contractTitle || null,
    debugName: mission.debug_name || null,
    faction: factionName,
    standing,
    wikiUrl: mission.link || mission.web_url || null,
    payoutDonorUuid: mission.payoutDonorUuid || null,
  };
}

function clearCacheForTests() {
  memoryCache.clear();
  titleLookupCache.clear();
  seedIndex = null;
  uexIndex = null;
  uexFetchedAt = 0;
}

function getSeedStats() {
  const index = loadSeedIndex();
  return {
    syncedAt: index.syncedAt,
    counts: index.counts,
    uuidEntries: index.byUuid.size,
    titleEntries: index.byTitle.size,
  };
}

module.exports = {
  init,
  fetchMissionByUuid,
  fetchMissionByTitle,
  estimateAuecFromMission,
  estimatePayoutForContract,
  roundToNiceAuec,
  clearCacheForTests,
  LOCAL_MISSION_BY_UUID,
  TITLE_ESTIMATE_HINTS,
  missionFromTitleHint,
  missionFromSeedTitle,
  normalizeTitle,
  STANDING_AUEC_MULT,
  BASE_AUEC_BY_RANK,
  getSeedStats,
  loadSeedIndex,
};
