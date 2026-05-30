const fs = require("fs");
const path = require("path");
const { LineAssembler } = require("../electron/lineAssembler");
const { createCombatCtx } = require("../electron/combatContext");
const { createVehicleCtx } = require("../electron/vehicleContext");
const { parseLine } = require("../electron/parser");
const { createSession, pushEvent, snapshot } = require("../electron/session");

const logPath =
  process.argv[2] ||
  "C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\Game.log";

const raw = fs.readFileSync(logPath, "utf8");
const assembler = new LineAssembler();
const ctx = {
  playerNick: "BeansOnToastBruh",
  inUniverse: true,
  playerGEID: "204771992619",
  ...createCombatCtx(),
  ...createVehicleCtx(),
};
const session = createSession({ playerNick: ctx.playerNick });

function feed(line) {
  for (const ready of assembler.push(line)) {
    const parsed = parseLine(ready, ctx);
    const events = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    for (const event of events) {
      if (event.type === "meta" && event.detail?.playerNick) {
        ctx.playerNick = event.detail.playerNick;
      }
      if (event.type === "meta" && event.detail?.inUniverse) {
        ctx.inUniverse = true;
      }
      if (event.type === "contract" && event.detail?.action === "completed") {
        ctx.lastCompletedMissionId = event.detail.missionId;
      }
      pushEvent(session, event);
    }
  }
}

for (const line of raw.split(/\r?\n/)) feed(line);

const r = snapshot(session).rollup;
console.log(
  JSON.stringify(
    {
      rewardTotals: r.rewardTotals,
      rewardEntries: r.rewardEntries,
      completedWithRewards: r.completed.map((c) => ({
        title: c.title,
        rewards: c.rewards,
      })),
      stats: r.stats,
    },
    null,
    2
  )
);
