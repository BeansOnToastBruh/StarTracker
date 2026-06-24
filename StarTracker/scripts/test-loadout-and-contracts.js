#!/usr/bin/env node
/** Tests for AttachmentReceived loadout parsing and 4.8.x contract fallbacks. */
const assert = require("assert");
const { parseLine } = require("../electron/parser");
const { buildRollup } = require("../electron/rollup");
const { applyLabelsToSession } = require("../electron/sessionEnrichment");
const { labelForClassName } = require("../electron/sessionEnrichment");
const contractWiki = require("../electron/contractWiki");

const ATTACH =
  '<2026-06-19T07:52:39.103Z> [Notice] <AttachmentReceived> Player[BeansOnToastBruh] Attachment[kap_combat_light_helmet_03_01_01_521511855020, kap_combat_light_helmet_03_01_01, 521511855020] Status[persistent] Port[Armor_Helmet] Elapsed[73.609268] [Team_CoreGameplayFeatures][Inventory]';
const SPAWN = "<2026-06-19T07:52:40.000Z> [CSessionManager::OnClientSpawned] Spawned!";

async function run() {
  const ctx = { playerNick: "BeansOnToastBruh", inUniverse: true };
  const events = [];
  for (const line of [ATTACH, SPAWN]) {
    const ev = parseLine(line, ctx);
    if (Array.isArray(ev)) events.push(...ev);
    else if (ev) events.push(ev);
  }
  const loadouts = events.filter((e) => e.type === "loadout");
  assert.equal(loadouts.length, 1, "one loadout on spawn");
  assert.ok(loadouts[0].detail.items.some((i) => i.port === "Armor_Helmet"));

  const session = {
    playerNick: "BeansOnToastBruh",
    events: loadouts,
    stats: {},
  };
  applyLabelsToSession(session);
  assert.ok(session.events[0].detail.items[0].label);

  assert.equal(labelForClassName("GAMA_Railen"), "Gatac Railen");
  assert.equal(labelForClassName("GAMA_Tyilui"), "Gatac Tyilui");

  const fox = contractWiki.estimateAuecFromMission(
    contractWiki.LOCAL_MISSION_BY_UUID["adb32bca-f7d2-4182-a697-d36cc5467183"],
    "Contractor"
  );
  assert.ok(fox.auec >= 18000);
  assert.equal(fox.estimateSource, "local_datamine");

  const title = contractWiki.missionFromTitleHint("Contract Complete: Ambush Op: ");
  assert.ok(title.reward_min >= 10000);

  const rollup = buildRollup({
    playerNick: "BeansOnToastBruh",
    events: loadouts,
    stats: { contractsCompleted: 0, deaths: 0, kills: 0, vehiclesLost: 0, rewards: 0 },
  });
  assert.equal(rollup.loadoutSnapshots.length, 1);

  let capturedWeaponSearchUrl = null;
  const loadoutBuilder = require("../electron/loadoutBuilder");
  const origFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes("/api/items?")) capturedWeaponSearchUrl = String(url);
    return { ok: true, json: async () => ({ data: [] }) };
  };
  await loadoutBuilder.searchShipWeapons({ query: "Omnisky" });
  global.fetch = origFetch;
  assert.ok(capturedWeaponSearchUrl, "searchShipWeapons should call items API");
  assert.ok(
    capturedWeaponSearchUrl.includes("filter%5Bquery%5D=Omnisky") ||
      capturedWeaponSearchUrl.includes("filter[query]=Omnisky"),
    `expected filter[query] in weapon search URL, got ${capturedWeaponSearchUrl}`
  );

  console.log("test-loadout-and-contracts: OK");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
