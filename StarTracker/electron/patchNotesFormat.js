/** Parse RSI patch note plain text (from star-citizen.wiki translations) into sections. */

const SKIP_BLOCKS = [
  /^Share Feedback$/i,
  /^Join the Discussion$/i,
  /^Report a Bug$/i,
  /^RSI Launcher$/i,
  /^Download the launcher/i,
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

function normalizeRsiUrl(rsiUrl, wikiId) {
  const url = String(rsiUrl || "").trim();
  if (/Star-Citizen-Live/i.test(url)) return wikiId ? buildPatchNotesUrl(wikiId, url) : null;
  if (url && /\/Patch-Notes\//i.test(url)) return url;
  if (url && wikiId && /Alpha|Patch|Star-Citizen/i.test(url)) {
    return buildPatchNotesUrl(wikiId, url);
  }
  if (wikiId) return buildPatchNotesUrl(wikiId, url);
  return url || null;
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
  normalizeRsiUrl,
  wikiCommLinkUrl,
  MAJOR_HEADERS,
};
