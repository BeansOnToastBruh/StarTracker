const { formatDuration, sessionDurationMs } = require("./session");
const { beautifyName } = require("./parser");
const { estimateJumpKm, formatKm } = require("./travelEstimate");
const {
  buildRewardDisplayLines,
  aggregateRewards,
} = require("./rewardFormat");

function fmtShort(iso) {
  if (!iso) return "?";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "?";
  }
}

function extractBlueprintName(entry) {
  if (entry?.blueprintName) return entry.blueprintName;
  const m = String(entry?.summary || entry?.raw || "").match(
    /blueprint[:\s]+(.+?)(?:\.|Access|$)/i
  );
  return m ? m[1].trim() : null;
}

function buildBlueprintEntries(rewardEntries, blueprintEvents, contractByMission) {
  const seen = new Set();
  const out = [];

  const push = ({ at, name, missionId, contractTitle, summary }) => {
    const label = name || "Blueprint (name not in log)";
    const key = `${at}|${label.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ at, name: label, missionId, contractTitle, summary });
  };

  for (const r of rewardEntries) {
    if (r.kind === "blueprint" || r.blueprintName) {
      push({
        at: r.at,
        name: extractBlueprintName(r),
        missionId: r.missionId,
        contractTitle: r.contractTitle,
        summary: r.summary,
      });
    }
  }

  for (const b of blueprintEvents) {
    const contract = b.missionId ? contractByMission.get(b.missionId) : null;
    push({
      at: b.at,
      name: extractBlueprintName(b),
      missionId: b.missionId,
      contractTitle: contract?.title || null,
      summary: b.summary,
    });
  }

  out.sort((a, b) => new Date(a.at) - new Date(b.at));
  return out;
}

function dedupeRewards(rewards) {
  const seen = new Set();
  return rewards.filter((r) => {
    const key = `${r.at}|${r.kind}|${r.auec}|${r.rep}|${r.itemCount}|${r.blueprintName}|${r.raw || r.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function enrichRewardRow(r) {
  return {
    ...r,
    displayLines: buildRewardDisplayLines(r),
  };
}

function normObjectiveTitle(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/:\s*$/, "")
    .trim();
}

function findObjectiveIndex(objectives, title) {
  const n = normObjectiveTitle(title);
  if (!n) return -1;
  let idx = objectives.findIndex((o) => normObjectiveTitle(o.title) === n);
  if (idx >= 0) return idx;
  return objectives.findIndex(
    (o) =>
      normObjectiveTitle(o.title).includes(n) ||
      n.includes(normObjectiveTitle(o.title))
  );
}

/** When the contract finished, objectives missing from the log tail still count as done. */
function markObjectivesCompleteForFinishedContract(row) {
  if (!row.completedAt || !row.objectives?.length) return;
  for (const o of row.objectives) {
    if (!o.complete) {
      o.complete = true;
      if (!o.completedAt) o.completedAt = row.completedAt;
    }
  }
}

function applyContractObjective(row, e) {
  if (!row.objectives) row.objectives = [];
  const { title, action } = e.detail || {};
  if (!title) return;
  if (action === "added") {
    const idx = findObjectiveIndex(row.objectives, title);
    if (idx >= 0) return;
    row.objectives.push({
      title,
      complete: false,
      addedAt: e.at,
      completedAt: null,
    });
    return;
  }
  if (action === "completed") {
    const idx = findObjectiveIndex(row.objectives, title);
    if (idx >= 0) {
      row.objectives[idx].complete = true;
      row.objectives[idx].completedAt = e.at;
      return;
    }
    row.objectives.push({
      title,
      complete: true,
      addedAt: null,
      completedAt: e.at,
    });
  }
}

function linkRewardsToContracts(contracts, rewards) {
  for (const r of rewards) {
    let linked = false;
    if (r.missionId && r.missionId !== "00000000-0000-0000-0000-000000000000") {
      for (const c of contracts) {
        if (c.missionId === r.missionId) {
          c.rewards.push(r);
          linked = true;
          break;
        }
      }
    }
    if (!linked) {
      const t = new Date(r.at).getTime();
      let best = null;
      let bestDt = Infinity;
      for (const c of contracts) {
        if (!c.completedAt) continue;
        const dt = t - new Date(c.completedAt).getTime();
        if (dt >= -2_000 && dt < 180_000 && dt < bestDt) {
          best = c;
          bestDt = dt;
        }
      }
      if (best) {
        best.rewards.push(r);
        linked = true;
      }
    }
    if (!linked) {
      const orphan = contracts.find((c) => c._orphanRewards);
      if (orphan) orphan.rewards.push(r);
      else {
        contracts.push({
          title: "(Session payouts)",
          missionId: null,
          acceptedAt: null,
          completedAt: null,
          failedAt: null,
          abandonedAt: null,
          abandonReason: null,
          rewards: [r],
          _orphanRewards: true,
        });
      }
    }
  }
}

/**
 * @param {import('./session').Session} session
 */
function buildRollup(session) {
  if (!session) return null;

  const contracts = [];
  const contractMap = new Map();
  const rewards = [];
  const deaths = [];
  const kills = [];
  const shipsLost = [];
  const quantumJumps = [];
  const blueprints = [];
  const otherRewards = [];
  const fines = [];
  const insuranceClaims = [];
  const shopPurchases = [];

  for (const e of session.events) {
    switch (e.type) {
      case "contract": {
        const key = e.detail?.missionId || e.detail?.title || e.at;
        let row = contractMap.get(key);
        if (!row) {
          row = {
            title: e.detail?.title || "Unnamed contract",
            missionId: e.detail?.missionId || null,
            acceptedAt: null,
            completedAt: null,
            failedAt: null,
            abandonedAt: null,
            abandonReason: null,
            rewards: [],
            objectives: [],
          };
          contractMap.set(key, row);
          contracts.push(row);
        }
        if (e.detail?.action === "accepted") row.acceptedAt = e.at;
        if (e.detail?.action === "completed") row.completedAt = e.at;
        if (e.detail?.action === "failed") row.failedAt = e.at;
        if (e.detail?.action === "abandoned") {
          row.abandonedAt = e.at;
          if (e.detail?.reason) row.abandonReason = e.detail.reason;
        }
        break;
      }
      case "contract_objective": {
        const missionId = e.detail?.missionId;
        if (!missionId || missionId === "00000000-0000-0000-0000-000000000000") break;
        let row = contractMap.get(missionId);
        if (!row) {
          row = {
            title: "(Unknown contract)",
            missionId,
            acceptedAt: null,
            completedAt: null,
            failedAt: null,
            abandonedAt: null,
            abandonReason: null,
            rewards: [],
            objectives: [],
          };
          contractMap.set(missionId, row);
          contracts.push(row);
        }
        applyContractObjective(row, e);
        break;
      }
      case "reward": {
        const r = {
          at: e.at,
          summary: e.summary,
          missionId: e.detail?.missionId || null,
          ...e.detail,
        };
        rewards.push(r);
        if (e.detail?.kind === "blueprint") blueprints.push(r);
        else otherRewards.push(r);
        break;
      }
      case "combat":
        if (e.detail?.youDied) {
          const isIncap = e.detail.deathKind === "incap_sequence";
          const isVehicleDeath = e.detail.deathKind === "vehicle_destroyed";
          const isActorDead =
            e.detail.deathKind === "actor_dead" || isVehicleDeath;
          deaths.push({
            at: e.at,
            kind: isIncap ? "incap" : isVehicleDeath ? "vehicle" : "kill",
            zone: isIncap ? "n/a" : beautifyName(e.detail.zone),
            killer: isIncap
              ? "Unknown (not in log)"
              : isActorDead
                ? "Unknown (not in log)"
                : beautifyName(e.detail.killer),
            weapon: isIncap || isActorDead ? "n/a" : beautifyName(e.detail.weapon),
            damageType: e.detail.damageType
              ? beautifyName(e.detail.damageType)
              : null,
            victim: beautifyName(e.detail.victim),
            note:
              isVehicleDeath && e.detail.fromVehicle
                ? `Ship: ${beautifyName(e.detail.fromVehicle)}`
                : isIncap && e.detail.corpseAt && e.detail.respawnAt
                  ? e.detail.incapAt
                    ? `Downed ${fmtShort(e.detail.incapAt)} → corpse ${fmtShort(e.detail.corpseAt)} → respawn ${fmtShort(e.detail.respawnAt)}`
                    : `Corpse ${fmtShort(e.detail.corpseAt)} → respawn ${fmtShort(e.detail.respawnAt)} (incap not in log)`
                  : isActorDead && e.detail.respawnAt
                    ? `Respawn ${fmtShort(e.detail.respawnAt)} (no incap/corpse in log)`
                    : null,
          });
        } else if (e.detail?.youKilled) {
          const isBounty = e.detail.killKind === "pvp_bounty";
          kills.push({
            at: e.at,
            kind: isBounty ? "pvp_bounty" : "kill",
            victim: e.detail.victimLabel || beautifyName(e.detail.victim),
            zone: beautifyName(e.detail.zone),
            weapon: beautifyName(e.detail.weapon),
            contractTitle: e.detail.contractTitle || null,
          });
        }
        break;
      case "vehicle":
        if (e.detail?.yours) {
          shipsLost.push({
            at: e.at,
            ship: e.detail.shipLabel || beautifyName(e.detail.vehicle),
            zone: e.detail.zoneLabel || beautifyName(e.detail.zone),
            cause: e.detail.cause || "Unknown",
            causer: beautifyName(e.detail.causer),
            method: e.detail.method || null,
            ownership: e.detail.ownership || "confirmed",
            ownershipReason: e.detail.ownershipReason || null,
            ownershipNote: e.detail.ownershipNote || null,
            destroyLevel: e.detail.destroyLevelTo || null,
          });
        }
        break;
      case "travel": {
        const km = estimateJumpKm(e.detail?.fromSystem, e.detail?.toSystem);
        quantumJumps.push({
          at: e.at,
          from: `${beautifyName(e.detail?.fromSystem)} (${beautifyName(e.detail?.fromZone)})`,
          to: `${beautifyName(e.detail?.toSystem)} (${beautifyName(e.detail?.toZone)})`,
          fromSystem: e.detail?.fromSystem,
          toSystem: e.detail?.toSystem,
          estimatedKm: km,
        });
        break;
      }
      case "blueprint":
        blueprints.push({
          at: e.at,
          summary: e.summary,
          missionId: e.detail?.missionId,
          blueprintName: e.detail?.blueprintName || extractBlueprintName(e.detail),
          raw: e.detail?.raw,
        });
        break;
      case "fine":
        fines.push({
          at: e.at,
          amount: e.detail?.amount ?? 0,
          currency: e.detail?.currency || "UEC",
          summary: e.summary,
        });
        break;
      case "insurance":
        if (e.detail?.action === "claim_complete") {
          insuranceClaims.push({
            at: e.at,
            summary: e.summary,
          });
        }
        break;
      case "shop_purchase":
        shopPurchases.push({
          at: e.at,
          shop: e.detail?.shop || "Unknown shop",
          item: e.detail?.item || "Unknown item",
          price: e.detail?.price ?? 0,
          summary: e.summary,
        });
        break;
      default:
        break;
    }
  }

  const rewardsDeduped = dedupeRewards(rewards.map(enrichRewardRow));

  linkRewardsToContracts(contracts, rewardsDeduped);

  for (const c of contracts) {
    if (c.completedAt) markObjectivesCompleteForFinishedContract(c);
  }

  const contractByMission = new Map();
  for (const c of contracts) {
    if (c.missionId) contractByMission.set(c.missionId, c);
  }

  const rewardEntries = rewardsDeduped.map((r) => {
    const contract = r.missionId ? contractByMission.get(r.missionId) : null;
    return {
      ...r,
      contractTitle: contract?.title || null,
    };
  });

  const rewardTotals = aggregateRewards(rewardEntries);

  const blueprintEntries = buildBlueprintEntries(
    rewardEntries,
    blueprints,
    contractByMission
  );

  const completed = contracts.filter((c) => c.completedAt && !c._orphanRewards);
  const failed = contracts.filter((c) => c.failedAt);
  const abandoned = contracts.filter((c) => c.abandonedAt);
  const inProgress = contracts.filter(
    (c) =>
      c.acceptedAt &&
      !c.completedAt &&
      !c.failedAt &&
      !c.abandonedAt &&
      !c._orphanRewards
  );

  const totalFlightKm = quantumJumps.reduce((s, j) => s + j.estimatedKm, 0);
  const finesTotal = fines.reduce((s, f) => s + (f.amount || 0), 0);
  const shopSpendTotal = shopPurchases.reduce((s, p) => s + (p.price || 0), 0);

  return {
    durationLabel: formatDuration(sessionDurationMs(session)),
    playerNick: session.playerNick,
    completed,
    failed,
    abandoned,
    inProgress,
    rewards,
    rewardEntries,
    rewardTotals,
    otherRewards,
    blueprints,
    blueprintEntries,
    deaths,
    kills,
    shipsLost,
    quantumJumps,
    totalFlightKm,
    totalFlightLabel: formatKm(totalFlightKm),
    flightIsEstimate: true,
    fines,
    finesTotal,
    insuranceClaims,
    shopPurchases,
    shopSpendTotal,
    stats: { ...session.stats },
  };
}

module.exports = { buildRollup };
