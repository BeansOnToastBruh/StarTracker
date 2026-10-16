#!/usr/bin/env node
/**
 * Build bundled mission payout index from star-citizen.wiki.
 * Run: node scripts/build-mission-payout-seed.js
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const WIKI_API = "https://api.star-citizen.wiki/api/missions";
const OUT_DIR = path.join(__dirname, "..", "data", "missions");
const OUT_FILE = path.join(OUT_DIR, "mission-payouts.json.gz");
const PAGE_SIZE = 100;

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "StarTracker/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function compactMission(m) {
  const rewardMin = Number(m.reward_min);
  const rewardMax = Number(m.reward_max);
  const rep = Number(m.reputation_amount);
  const rank = Number(m.rank_index);
  return {
    u: m.uuid,
    t: m.title || null,
    rm: Number.isFinite(rewardMin) && rewardMin > 0 ? rewardMin : null,
    rx: Number.isFinite(rewardMax) && rewardMax > 0 ? rewardMax : null,
    ra: Number.isFinite(rep) && rep > 0 ? rep : null,
    ri: Number.isFinite(rank) ? rank : null,
    f: m.faction?.name || m.mission_giver || null,
    g: m.mission_giver || null,
    d: m.debug_name || null,
    l: m.link || m.web_url || null,
  };
}

async function main() {
  console.log("Building mission payout seed from star-citizen.wiki…");
  const started = Date.now();
  const first = await fetchJson(`${WIKI_API}?page[size]=${PAGE_SIZE}&page[number]=1`);
  const lastPage = Number(first.meta?.last_page) || 1;
  const total = Number(first.meta?.total) || 0;
  const missions = [];

  const ingest = (rows) => {
    for (const row of rows || []) {
      if (!row?.uuid) continue;
      missions.push(compactMission(row));
    }
  };
  ingest(first.data);

  for (let page = 2; page <= lastPage; page++) {
    process.stdout.write(`\rpage ${page}/${lastPage} (${missions.length}/${total || "?"})   `);
    const json = await fetchJson(
      `${WIKI_API}?page[size]=${PAGE_SIZE}&page[number]=${page}`
    );
    ingest(json.data);
  }

  const withPayout = missions.filter((m) => m.rm != null).length;
  const payload = {
    format: "mission-payouts-v1",
    syncedAt: new Date().toISOString(),
    source: "api.star-citizen.wiki",
    counts: {
      missions: missions.length,
      withRewardMin: withPayout,
    },
    missions,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const raw = Buffer.from(JSON.stringify(payload), "utf8");
  fs.writeFileSync(OUT_FILE, zlib.gzipSync(raw, { level: 9 }));
  const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
  console.log(
    `\nWrote ${missions.length} missions (${withPayout} with reward_min) → ${OUT_FILE} (${kb} KB) in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
