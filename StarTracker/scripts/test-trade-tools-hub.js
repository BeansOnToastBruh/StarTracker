const path = require("path");
const assert = require("assert");
const guidesHub = require("../electron/guidesHub");
const tradeIntel = require("../electron/tradeIntel");
const externalToolsHub = require("../electron/externalToolsHub");
const reputationIntel = require("../electron/reputationIntel");
const factionRepStore = require("../electron/factionRepStore");

const seedDir = path.join(__dirname, "..", "data", "guides");

guidesHub.init({ seedDir, cacheDir: null });
externalToolsHub.init({ seedDir });

async function main() {
  assert.strictEqual(tradeIntel.commodityScuForCargo(128, 1), 128);
  assert.strictEqual(tradeIntel.commodityScuForCargo(128, 1.2), 106);

  const sampleRow = {
    id: 2,
    name: "Laranite",
    code: "LARA",
    kind: "Metal",
    weightScu: 1,
    priceBuy: 3000,
    priceSell: 3500,
    spread: 500,
    isIllegal: false,
    isBuyable: true,
    isSellable: true,
    isRaw: false,
  };

  const built = tradeIntel.buildTradeRow(sampleRow, 46);
  assert.strictEqual(built.commodityScu, 46);
  assert.strictEqual(built.totalProfit, 46 * 500);
  assert.strictEqual(built.investAuec, 46 * 3000);

  const hub = externalToolsHub.getExternalToolsHub();
  assert.ok(hub.categories.length >= 4, "expected tool categories");
  assert.ok(hub.tools.length >= 10, "expected external tools seed");
  assert.ok(hub.inAppCount >= 5, "expected in-app mappings");

  const scTrade = hub.tools.find((t) => t.id === "sc-trade-tools");
  assert.strictEqual(scTrade.inAppTab, "guides-trade-routes");

  const combatTools = externalToolsHub.getCombatExternalTools();
  assert.ok(combatTools.tools.length >= 3, "expected combat quick links from hub");
  assert.ok(combatTools.tools.every((t) => t.url), "combat tools need urls");
  const names = combatTools.tools.map((t) => t.name);
  assert.ok(!names.filter((n) => n.toLowerCase().includes("erkul")).length || names.filter((n) => n.toLowerCase().includes("erkul")).length === 1, "dedupe erkul");

  factionRepStore.resetForTests();
  factionRepStore.init(path.join(__dirname, ".test-faction-rep.json"));
  factionRepStore.addRep("Headhunters", 900);
  factionRepStore.addRep("Headhunters", 500);

  const rep = reputationIntel.getReputationSummary([
    { faction: "Headhunters", rep: 200 },
    { faction: "Covalex", rep: 50 },
  ]);
  assert.strictEqual(rep.factions[0].faction, "Headhunters");
  assert.strictEqual(rep.factions[0].totalRep, 1400);
  assert.strictEqual(rep.factions[0].sessionRep, 200);
  assert.strictEqual(rep.factions[0].standing, "Jr. Contractor");
  assert.ok(rep.factions[0].nextStanding, "expected next tier");
  assert.strictEqual(rep.sessionTotal, 250);

  const tierAtMax = reputationIntel.nextTierInfo(100000);
  assert.strictEqual(tierAtMax.nextStanding, null);
  assert.strictEqual(tierAtMax.progressPercent, 100);

  try {
    require("fs").unlinkSync(path.join(__dirname, ".test-faction-rep.json"));
  } catch {
    /* ignore */
  }

  console.log("test-trade-tools-hub: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
