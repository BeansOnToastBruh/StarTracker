/**
 * Parse and format contract reward text from HUD / Game.log notifications.
 */

function parseNumber(s) {
  if (!s) return null;
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseAwardedAuec(text) {
  const m = String(text || "").match(/^Awarded\s+([\d,.]+)\s*aUEC/i);
  return m ? parseNumber(m[1]) : null;
}

/**
 * Sum aUEC payout amounts from raw Game.log text.
 * Only counts primary `Added notification` lines to avoid double-counting
 * continuation/UpdateNotificationItem duplicates.
 */
function sumAuecPayoutsInText(text) {
  let total = 0;
  const raw = String(text || "");
  const patterns = [
    /Added notification "Awarded\s+([\d,.]+)\s*aUEC/gi,
    /Added notification "You(?:'ve| have) [Ee]arned:\s*([\d,.]+)\s*aUEC/gi,
    /Added notification "Contract (?:Complete|Accepted):[^"]*\[([\d,.]+)\s*aUEC\s*\]/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(raw))) {
      const n = parseNumber(m[1]);
      if (n != null) total += n;
    }
  }
  return total;
}

/** @deprecated alias — use sumAuecPayoutsInText */
function sumAwardedAuecInText(text) {
  return sumAuecPayoutsInText(text);
}

function parseFinedUec(text) {
  const m = String(text || "").match(/^Fined\s+([\d,.]+)\s*UEC/i);
  return m ? parseNumber(m[1]) : null;
}

/** Remove HUD markup tags (e.g. `<EM4>`) and trailing colons. */
function stripHudMarkup(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, "")
    .replace(/:\s*$/, "")
    .trim();
}

function applyRewardPatterns(detail, text) {
  for (const bracketAuecM of text.matchAll(/\[\s*([\d,.]+)\s*aUEC\s*\]/gi)) {
    const n = parseNumber(bracketAuecM[1]);
    if (n != null) {
      detail.auec = (detail.auec || 0) + n;
    }
  }

  for (const bracketRepM of text.matchAll(
    /\[\s*([\d,.]+)\s*Rep(?:utation)?(?:\s+([^\]]+?))?\s*\]/gi
  )) {
    const n = parseNumber(bracketRepM[1]);
    if (n != null) {
      detail.rep = (detail.rep || 0) + n;
      const factionPart = bracketRepM[2]?.trim();
      if (factionPart && !/^BP$/i.test(factionPart) && !detail.faction) {
        detail.faction = factionPart;
      }
    }
  }

  const auecM = text.match(/([\d,.]+)\s*aUEC/i);
  if (auecM && detail.auec == null) detail.auec = parseNumber(auecM[1]);

  const repWithM =
    text.match(
      /([\d,.]+)\s*(?:Rep(?:utation)?)\s+with\s+(.+?)(?:\s*\.|Access Them|to queue|:|\[|$)/i
    ) ||
    text.match(
      /([\d,.]+)\s*Reputation\s+with\s+(.+?)(?:\s*\.|Access Them|to queue|:|\[|$)/i
    );
  if (repWithM) {
    detail.rep = parseNumber(repWithM[1]);
    detail.faction = repWithM[2].trim().replace(/:\s*$/, "");
  }

  const repBareM = text.match(/([\d,.]+)\s*(?:Rep(?:utation)?)(?!\s+with)/i);
  if (repBareM && detail.rep == null) {
    detail.rep = parseNumber(repBareM[1]);
  }

  const factionOnlyM = text.match(/Reputation\s+with\s+(.+?)(?:\.|Access|$)/i);
  if (factionOnlyM && !detail.faction) {
    detail.faction = factionOnlyM[1].trim();
  }

  const rewardsM = text.match(/([\d]+)\s+Rewards?\b/i);
  if (rewardsM) detail.itemCount = Number(rewardsM[1]);

  const deliveryM = text.match(/Access Them at\s+(.+?)(?:\s*:\s*"\s*\[|$)/i);
  if (deliveryM) {
    detail.deliveryNote = deliveryM[1].replace(/:\s*$/, "").trim();
  }

  const receivedBpM = text.match(/Received\s+Blueprint:\s*(.+)$/i);
  if (receivedBpM) {
    detail.blueprintName = receivedBpM[1]
      .replace(/\s*\[BP\]\s*$/i, "")
      .trim();
  }

  const bpM = text.match(/blueprint[:\s]+(.+?)(?:\.|Access|$)/i);
  if (bpM && !detail.blueprintName) {
    detail.blueprintName = bpM[1].replace(/\s*\[BP\]\s*$/i, "").trim();
  }

  const itemNameM = text.match(
    /^You(?:'ve| have) [Ee]arned:\s*(.+?)(?:\s+x(\d+))?\s*$/i
  );
  if (
    itemNameM &&
    !/^\d/.test(itemNameM[1]) &&
    !/aUEC|Rep|Reward|Reputation/i.test(itemNameM[1])
  ) {
    detail.itemName = itemNameM[1].trim();
    if (itemNameM[2]) detail.itemQuantity = Number(itemNameM[2]);
  }
}

function finalizeRewardKind(detail) {
  if (detail.auec != null && detail.rep != null) detail.kind = "mixed";
  else if (detail.auec != null) detail.kind = "auec";
  else if (detail.rep != null) detail.kind = "reputation";
  else if (detail.itemCount != null) detail.kind = "reward_bundle";
  else if (detail.blueprintName) detail.kind = "blueprint";
  else if (detail.itemName) detail.kind = "item";
  else if (detail.kind === "other" && (detail.deliveryNote || detail.itemCount)) {
    detail.kind = "reward_bundle";
  }
  return detail;
}

/**
 * @param {string} text inner earned body (after "You've Earned:")
 * @param {object} detail partial detail from parseRewardDetail
 */
function enrichRewardDetail(detail, text) {
  if (!text) return detail;

  const cleaned = stripHudMarkup(text);
  const parts = cleaned.split(/\s+and\s+/i);
  if (parts.length > 1) {
    for (const part of parts) {
      applyRewardPatterns(detail, part.trim());
    }
  } else {
    applyRewardPatterns(detail, cleaned);
  }

  return finalizeRewardKind(detail);
}

/** Parse rep/aUEC payout hints embedded in a contract complete title. */
function parseContractPayoutFromTitle(title) {
  const cleaned = stripHudMarkup(title);
  const detail = {
    raw: title,
    kind: "other",
    auec: null,
    rep: null,
    faction: null,
    itemCount: null,
    itemName: null,
    itemQuantity: null,
    blueprintName: null,
    deliveryNote: null,
  };
  applyRewardPatterns(detail, cleaned);
  return finalizeRewardKind(detail);
}

function buildRewardDisplayLines(detail) {
  const lines = [];
  if (detail.auec != null) {
    const est = !!detail.auecEstimated;
    lines.push({
      key: "auec",
      label: est ? "Currency (estimated)" : "Currency",
      value: est
        ? `~${detail.auec.toLocaleString()} aUEC (not confirmed)`
        : `${detail.auec.toLocaleString()} aUEC`,
    });
    if (est && detail.estimateNote) {
      lines.push({
        key: "estimate_note",
        label: "Estimate basis",
        value: detail.estimateNote,
      });
    }
  }
  if (detail.rep != null) {
    lines.push({
      key: "rep",
      label: "Reputation",
      value: detail.faction
        ? `${detail.rep.toLocaleString()} with ${detail.faction}`
        : `${detail.rep.toLocaleString()} rep`,
    });
  }
  if (detail.itemCount != null) {
    lines.push({
      key: "bundle",
      label: "Items",
      value: `${detail.itemCount} reward item${detail.itemCount === 1 ? "" : "s"}`,
    });
  }
  if (detail.itemName) {
    const qty = detail.itemQuantity > 1 ? ` ×${detail.itemQuantity}` : "";
    lines.push({
      key: "item",
      label: "Item",
      value: `${detail.itemName}${qty}`,
    });
  }
  if (detail.blueprintName) {
    lines.push({
      key: "blueprint",
      label: "Blueprint",
      value: detail.blueprintName,
    });
  }
  if (detail.deliveryNote) {
    lines.push({
      key: "delivery",
      label: "Pickup",
      value: detail.deliveryNote,
    });
  }
  if (!lines.length && detail.raw) {
    lines.push({ key: "raw", label: "As shown in-game", value: detail.raw.slice(0, 200) });
  }
  return lines;
}

function rewardSummaryFromDetail(detail, fallbackText) {
  const lines = buildRewardDisplayLines(detail);
  if (lines.length) return lines.map((l) => l.value).join(" · ");
  return fallbackText;
}

function aggregateRewards(rewardRows) {
  let totalAuec = 0;
  let totalAuecEstimated = 0;
  const repByFaction = new Map();
  let itemBundles = 0;
  let itemCount = 0;

  for (const r of rewardRows) {
    if (r.auec != null) {
      if (r.auecEstimated) totalAuecEstimated += r.auec;
      else totalAuec += r.auec;
    }
    if (r.rep != null) {
      const f = r.faction || "Unknown faction";
      repByFaction.set(f, (repByFaction.get(f) || 0) + r.rep);
    }
    if (r.itemCount != null) {
      itemBundles += 1;
      itemCount += r.itemCount;
    }
  }

  return {
    totalAuec,
    totalAuecEstimated,
    repByFaction: [...repByFaction.entries()].map(([faction, rep]) => ({
      faction,
      rep,
    })),
    itemBundles,
    itemCount,
  };
}

module.exports = {
  enrichRewardDetail,
  buildRewardDisplayLines,
  rewardSummaryFromDetail,
  aggregateRewards,
  parseAwardedAuec,
  sumAuecPayoutsInText,
  sumAwardedAuecInText,
  parseFinedUec,
  parseNumber,
  stripHudMarkup,
  parseContractPayoutFromTitle,
  finalizeRewardKind,
};
