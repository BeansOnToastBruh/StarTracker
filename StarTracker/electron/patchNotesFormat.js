/** Parse RSI patch note plain text (from star-citizen.wiki translations) into sections. */

const SKIP_BLOCKS = [
  /^Share Feedback$/i,
  /^Join the Discussion$/i,
  /^Report a Bug$/i,
  /^RSI Launcher$/i,
  /^Download the launcher/i,
  /^EXPAND ALL \/ COLLAPSE ALL$/i,
  /^EXPAND ALL$/i,
  /^COLLAPSE ALL$/i,
  /^Update$/i,
  /^Home$/i,
  /^Patch Notes$/i,
  /^Features$/i,
  /^Bug Fixes$/i,
  /^Known Issues$/i,
  /^4\.\d+ Previous Release Notes$/i,
  /^4\.\d+ Release Notes$/i,
  /^Occupying:/i,
  /^Professional Merchants/i,
  /^A dozen confused/i,
  /^Noah waited/i,
  /^The Imperator/i,
  /^Don't try and twist/i,
  /^Head on over to our Issue Council/i,
  /^Talk with other players/i,
  /^Want to discuss the latest Release/i,
  /^Click the image above/i,
  /^Reminder\. Citizens always imprint/i,
];

const MAJOR_HEADERS = [
  "Build Information",
  "Features and Gameplay",
  "Features & Updates",
  "Content & Feature Updates",
  "Content",
  "UI Changes",
  "Bug Fixes & Technical Updates",
  "Known Issues & Information",
  "Ships and Vehicles",
  "Locations",
];

const SUB_HEADERS = new Set([
  "Build Info",
  "Bug Fixes",
  "Known Issues",
  "Stability & Performance",
  "Inventory",
  "Missions",
  "UI and MobiGlas",
  "Ships",
  "Vehicles",
  "Gameplay",
  "Core Tech",
]);

function shouldSkipLine(line) {
  const t = line.trim();
  if (!t) return true;
  return SKIP_BLOCKS.some((re) => re.test(t));
}

function isMajorHeader(line) {
  const t = line.trim();
  return MAJOR_HEADERS.some((h) => t === h || t.startsWith(`${h} `));
}

function isSubHeader(line) {
  const t = line.trim();
  if (t.length > 64 || t.length < 3) return false;
  if (/^\d+\.\d+(?:\.\d+)?:\s+/i.test(t)) return true;
  if (/^(Fixed|Added|Updated|Players|Client|Server|Improved|Adjusted|Resolved|Removed|Changed)\b/i.test(t)) {
    return false;
  }
  if (/^\d+\.\s/.test(t)) return false;
  if (SUB_HEADERS.has(t)) return true;
  if (/^[A-Z][A-Za-z0-9 &/-]+$/.test(t) && !t.includes(".") && t.split(" ").length <= 5) {
    return true;
  }
  return false;
}

function isListItem(line) {
  const t = line.trim();
  return (
    /^(Fixed|Added|Updated|Players should|Client Crash|Server Crash|Improved|Adjusted|Resolved|Removed|Changed)\b/i.test(
      t
    ) || /^\d+\.\s/.test(t)
  );
}

function parsePatchNotesText(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n");
  if (!text.trim()) return { headline: null, intro: null, sections: [] };

  const lines = text.split("\n");
  let headline = null;
  let intro = [];
  const sections = [];
  let currentMajor = null;
  let currentSub = null;
  let currentItems = [];

  function flushItems() {
    if (!currentItems.length) return;
    const target = currentSub || currentMajor;
    if (target) target.items.push(...currentItems);
    currentItems = [];
  }

  function flushSub() {
    flushItems();
    if (currentSub && currentMajor) {
      currentMajor.subsections.push(currentSub);
      currentSub = null;
    }
  }

  function flushMajor() {
    flushSub();
    if (currentMajor) sections.push(currentMajor);
    currentMajor = null;
  }

  for (const line of lines) {
    const t = line.trim();
    if (shouldSkipLine(line)) continue;

    if (!headline && /^Star Citizen Alpha/i.test(t)) {
      headline = t;
      continue;
    }

    if (!headline && /^ALPHA\s+\d/i.test(t)) {
      headline = `Star Citizen ${t.replace(/^ALPHA\s+/i, "Alpha ")}`;
      continue;
    }

    if (isMajorHeader(t)) {
      flushMajor();
      currentMajor = { title: t.replace(/\s+$/, ""), subsections: [], items: [] };
      currentSub = null;
      continue;
    }

    if (currentMajor && isSubHeader(t)) {
      flushSub();
      currentSub = { title: t, items: [] };
      continue;
    }

    if (isListItem(t)) {
      if (!currentMajor) {
        if (intro.length < 6) intro.push(t);
      } else {
        currentItems.push(t.replace(/^\d+\.\s*/, ""));
      }
      continue;
    }

    if (!currentMajor) {
      if (t.length > 20 && intro.length < 8) intro.push(t);
      continue;
    }

    if (t.length > 12) currentItems.push(t);
  }

  flushMajor();

  const dedupedIntro = [];
  const seen = new Set();
  for (const line of intro) {
    const key = line.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    dedupedIntro.push(line);
  }

  return {
    headline,
    intro: dedupedIntro.filter(Boolean),
    sections: sections.filter((s) => s.items.length || s.subsections.length),
  };
}

function comparePatchVersions(a, b) {
  const pa = String(a || "0")
    .split(".")
    .map((n) => Number(n) || 0);
  const pb = String(b || "0")
    .split(".")
    .map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return db - da;
  }
  return 0;
}

function extractPatchDateHuman(text) {
  const m = String(text || "").match(
    /\n((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\n/i
  );
  return m ? m[1].trim() : null;
}

function isPatchNotesBody(text) {
  const t = String(text || "");
  if (/DEFENDERS NEEDED/i.test(t) && !/Bug Fixes/i.test(t)) return false;
  if (t.length < 250) return false;
  return (
    /Bug Fixes|Build Information|Known Issues|Features and Gameplay|Features & Updates|Build Update:/i.test(
      t
    )
  );
}

/**
 * RSI stacks multiple LIVE patches on one comm-link (e.g. 4.8.2, 4.8.1, 4.8 on 21168).
 */
function splitPatchDocument(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const markers = [];
  const re = /Star Citizen Alpha (4\.\d+(?:\.\d+)?) LIVE/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    markers.push({
      index: match.index,
      version: match[1],
      headline: match[0],
    });
  }

  if (!markers.length) {
    return [
      {
        version: null,
        headline: null,
        dateHuman: extractPatchDateHuman(text),
        text,
        parsed: parsePatchNotesText(text),
      },
    ];
  }

  const out = [];
  for (let i = 0; i < markers.length; i += 1) {
    const chunk = text
      .slice(markers[i].index, markers[i + 1]?.index ?? text.length)
      .trim();
    out.push({
      version: markers[i].version,
      headline: markers[i].headline,
      dateHuman: extractPatchDateHuman(chunk),
      text: chunk,
      parsed: parsePatchNotesText(chunk),
    });
  }
  return out;
}

function isSclOrBadTransmission(url, title) {
  const u = String(url || "").trim();
  const t = String(title || "").trim();
  if (/Star-Citizen-Live/i.test(u) || /Star-Citizen-Live/i.test(t)) return true;
  if (/transmission\/21215|21215-Star-Citizen-Live/i.test(u)) return true;
  if (/\/transmission\//i.test(u)) return true;
  return false;
}

function isAlphaPatchCommLink(url, title) {
  const u = String(url || "").trim();
  const t = String(title || "").trim();
  if (isSclOrBadTransmission(u, t)) return false;
  if (/\/Patch-Notes\//i.test(u) && /Alpha/i.test(u)) return true;
  if (/Star Citizen Alpha/i.test(t)) return true;
  if (/Alpha/i.test(u) && !/Live/i.test(u)) return true;
  return false;
}

function normalizeRsiUrl(rsiUrl, wikiId, title) {
  const url = String(rsiUrl || "").trim();
  const entryTitle = title != null ? title : "";
  if (isSclOrBadTransmission(url, entryTitle)) return null;
  if (url && /\/Patch-Notes\//i.test(url)) {
    if (/Star-Citizen-Live|\/transmission\//i.test(url)) return null;
    return url;
  }
  if (wikiId && isAlphaPatchCommLink(url, entryTitle)) {
    return buildPatchNotesUrl(wikiId, url);
  }
  if (url && !/\/transmission\//i.test(url) && /\/Patch-Notes\//i.test(url)) return url;
  return null;
}

function buildPatchNotesUrl(wikiId, rsiUrl) {
  const slugMatch = String(rsiUrl || "").match(/\/(\d+-[^/?#]+)/);
  const slug = slugMatch ? slugMatch[1] : String(wikiId);
  return `https://robertsspaceindustries.com/en/comm-link/Patch-Notes/${slug}`;
}

function wikiCommLinkUrl(wikiId, apiPublicUrl) {
  if (apiPublicUrl) return apiPublicUrl.replace(/^https:\/\/api\./, "https://");
  if (wikiId) return `https://star-citizen.wiki/en/comm-link/${wikiId}`;
  return null;
}

module.exports = {
  parsePatchNotesText,
  splitPatchDocument,
  isPatchNotesBody,
  comparePatchVersions,
  extractPatchDateHuman,
  normalizeRsiUrl,
  wikiCommLinkUrl,
  MAJOR_HEADERS,
};
