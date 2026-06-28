const assert = require("assert");
const {
  init,
  formatRequirement,
  categorizeTrade,
  normalizeMission,
  getTrades,
} = require("../electron/wikeloIntel");

init({ cacheDir: null });

assert.strictEqual(
  formatRequirement({ name: "Carinite", max_amount: 50 }),
  "Carinite up to ×50"
);
assert.strictEqual(
  formatRequirement({ name: "Quantanium", max_scu: 8, min_scu: 8 }),
  "Quantanium 8 SCU"
);
assert.strictEqual(
  categorizeTrade([{ name: "Wikelo Favor" }]),
  "favor"
);
assert.strictEqual(
  categorizeTrade([{ name: "RSI Scorpius Wikelo Sneak Special" }]),
  "ships"
);

const row = normalizeMission({
  uuid: "test-uuid",
  title: "Turn Things to Favor",
  hauling_orders: [{ name: "Carinite", max_amount: 50 }],
  reward_items: [{ name: "Wikelo Favor", amount: 1 }],
  min_standing_name: null,
  reputation_amount: null,
  game_version: "4.8.2-LIVE.12030094",
});
assert.strictEqual(row.id, "test-uuid");
assert.strictEqual(row.inputs[0].requirement, "Carinite up to ×50");
assert.strictEqual(row.rewards[0].name, "Wikelo Favor");
assert.strictEqual(row.category, "favor");

let listUrl = null;
global.fetch = async (url) => {
  const u = String(url);
  if (u.includes("/api/missions?")) {
    listUrl = u;
    return {
      ok: true,
      json: async () => ({
        data: [
          {
            uuid: "a",
            title: "Sample Trade",
            hauling_summary: [{ name: "Ore", max_amount: 1 }],
            reward_items: [],
          },
        ],
        meta: { last_page: 1 },
      }),
    };
  }
  if (u.includes("/api/missions/a")) {
    return {
      ok: true,
      json: async () => ({
        data: {
          uuid: "a",
          title: "Sample Trade",
          hauling_orders: [{ name: "Ore", max_amount: 1 }],
          reward_items: [{ name: "Sample Reward", amount: 1 }],
        },
      }),
    };
  }
  throw new Error(`unexpected fetch ${u}`);
};

(async () => {
  const result = await getTrades({ query: "Sample", category: "all" });
  assert.ok(
    listUrl?.includes("filter%5Bmission_giver%5D=Wikelo") ||
      listUrl?.includes("filter[mission_giver]=Wikelo")
  );
  assert.strictEqual(result.rows.length, 1);
  assert.strictEqual(result.rows[0].title, "Sample Trade");
  assert.strictEqual(result.rows[0].rewards[0].name, "Sample Reward");
  console.log("test-wikelo-intel: OK");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
