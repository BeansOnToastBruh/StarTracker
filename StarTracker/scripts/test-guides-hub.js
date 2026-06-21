const path = require("path");
const assert = require("assert");
const {
  init,
  shapeCommodityRow,
  matchesCommodityFilter,
  rowMatchesQuery,
  sortCommodities,
  getSmugglerRoutes,
  getGameLoops,
} = require("../electron/guidesHub");

init({
  seedDir: path.join(__dirname, "..", "data", "guides"),
  cacheDir: null,
});

const sample = shapeCommodityRow({
  id: 1,
  name: "Agricium",
  code: "AGRI",
  kind: "Metal",
  weight_scu: 1.2,
  price_buy: 7930,
  price_sell: 9557,
  is_illegal: 0,
  is_extractable: 1,
  is_harvestable: 0,
  is_mineral: 1,
  is_refined: 1,
  is_raw: 0,
  is_buyable: 1,
  is_sellable: 1,
});

assert.strictEqual(sample.spread, 1627);
assert.strictEqual(sample.priceBuy, 7930);
assert.strictEqual(matchesCommodityFilter(sample, "mining"), true);
assert.strictEqual(matchesCommodityFilter(sample, "trade"), true);
assert.strictEqual(rowMatchesQuery(sample, "agri"), true);
assert.strictEqual(rowMatchesQuery(sample, "xyz"), false);

const sorted = sortCommodities(
  [
    { name: "B", spread: 100, priceSell: 500, priceBuy: 400 },
    { name: "A", spread: 200, priceSell: 600, priceBuy: 400 },
  ],
  "spread"
);
assert.strictEqual(sorted[0].name, "A");

const routes = getSmugglerRoutes();
assert.ok(routes.routes.length >= 3, "expected smuggler routes seed");

const loops = getGameLoops();
assert.ok(loops.loops.length >= 4, "expected game loops seed");

console.log("test-guides-hub: OK");
