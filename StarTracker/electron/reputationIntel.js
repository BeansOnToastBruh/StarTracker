const factionRepStore = require("./factionRepStore");

function nextTierInfo(totalRep) {
  const xp = Math.max(0, Number(totalRep) || 0);
  const tiers = factionRepStore.REP_TIERS;
  let current = tiers[0];
  let next = null;
  for (let i = 0; i < tiers.length; i += 1) {
    if (xp >= tiers[i].min) current = tiers[i];
    else {
      next = tiers[i];
      break;
    }
  }
  const progressToNext =
    next && next.min > current.min
      ? Math.min(100, Math.round(((xp - current.min) / (next.min - current.min)) * 1000) / 10)
      : 100;
  return {
    standing: current.name,
    tierMin: current.min,
    nextStanding: next?.name || null,
    nextTierMin: next?.min ?? null,
    progressPercent: progressToNext,
    repToNext: next ? Math.max(0, next.min - xp) : 0,
  };
}

function buildFactionRow(faction, totalRep, sessionRep) {
  const tier = nextTierInfo(totalRep);
  return {
    faction,
    totalRep,
    sessionRep: sessionRep || 0,
    ...tier,
  };
}

function getReputationSummary(sessionRepByFaction = []) {
  const sessionMap = new Map();
  for (const row of sessionRepByFaction) {
    const key = factionRepStore.normalizeFaction(row.faction);
    if (!key) continue;
    sessionMap.set(key, (sessionMap.get(key) || 0) + (Number(row.rep) || 0));
  }

  const allKeys = new Set([
    ...Object.keys(factionRepStore.getAllRep()),
    ...sessionMap.keys(),
  ]);

  const factions = [...allKeys]
    .map((faction) =>
      buildFactionRow(
        faction,
        factionRepStore.getRep(faction),
        sessionMap.get(faction) || 0
      )
    )
    .sort((a, b) => b.totalRep - a.totalRep || a.faction.localeCompare(b.faction));

  const sessionTotal = [...sessionMap.values()].reduce((s, n) => s + n, 0);

  return {
    factions,
    tiers: factionRepStore.REP_TIERS,
    sessionTotal,
    meta: {
      source: "Game.log session rewards + local faction-rep.json",
      tierSource: "star-citizen.wiki contractor tiers (estimate)",
    },
    disclaimer:
      "Persistent rep accumulates from parsed session rewards. Tier names and thresholds are wiki estimates; in-game standing may differ. Session rep is confirmed only when Game.log reports reputation earned.",
  };
}

module.exports = {
  nextTierInfo,
  getReputationSummary,
};
