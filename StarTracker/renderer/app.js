const $ = (id) => document.getElementById(id);

const THEME_KEY = "sc-debrief-theme";
/** Shown when a stat or timestamp is missing (not an em dash). */
const EMPTY_DISPLAY = "n/a";

function sanitizeDisplayText(s) {
  if (s == null) return "";
  return String(s).replace(/\u2014/g, ", ");
}

function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function themeToggleLabel(theme) {
  return theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
}

function themeToggleIcon(theme) {
  return theme === "dark" ? "☀️" : "🌙";
}

function applyTheme(theme, persist) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  if (persist) localStorage.setItem(THEME_KEY, next);
  const btn = $("btnTheme");
  if (btn) {
    btn.textContent = themeToggleIcon(next);
    btn.setAttribute("aria-label", themeToggleLabel(next));
  }
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const theme = stored === "light" ? "light" : "dark";
  applyTheme(theme, false);
}

function toggleTheme() {
  applyTheme(getTheme() === "dark" ? "light" : "dark", true);
}

const SESSION_TABS = [
  {
    id: "overview",
    group: "session",
    label: "Overview",
    hint: "A quick snapshot of your session.",
    empty: "Hop in and play. Once you're tracking a session, your summary shows up here.",
  },
  {
    id: "missions",
    group: "session",
    label: "Missions",
    hint: "Contracts you accepted, completed, failed, or walked away from, with per-objective progress when the log shows it.",
    empty: "No contracts yet. Grab a mission in-game. You'll see Started when you accept, and Complete when you finish.",
  },
  {
    id: "rewards",
    group: "session",
    label: "Rewards",
    hint: "Confirmed: Awarded X aUEC HUD lines in Game.log. Estimated: wiki + your faction rep tier when the log omits cash. Not your wallet balance.",
    empty: "No payouts logged yet. Finish a contract to see confirmed log payouts or wiki-based estimates.",
  },
  {
    id: "fines",
    group: "session",
    label: "Fines",
    hint: "UEC fines from CrimeStat and monitored-space infraction popups.",
    empty: "No fines logged this session.",
  },
  {
    id: "insurance",
    group: "session",
    label: "Insurance",
    hint: "Ship insurance claims that completed (hull respawn at station).",
    empty: "No insurance claims logged this session.",
  },
  {
    id: "shopping",
    group: "session",
    label: "Shopping",
    hint: "Items bought at shops and kiosks when the log records your purchase.",
    empty: "No shop purchases logged this session.",
  },
  {
    id: "loadout",
    group: "session",
    label: "Loadout",
    hint: "Weapons and armor from spawn and gear changes. Combat stats from the wiki datamine. Food, drinks, and cosmetics are hidden.",
    empty: "No loadout snapshots yet. StarTracker captures gear when you spawn into the universe.",
  },
  {
    id: "blueprints",
    group: "session",
    label: "Blueprints",
    hint: "Blueprint unlocks from contracts when Game.log includes the name. Generic reward bundles without a name won't appear here.",
    empty: "No blueprints logged yet. Complete a mission that grants a blueprint. The log must include the blueprint name in the payout text.",
  },
  {
    id: "deaths",
    group: "session",
    label: "Deaths",
    hint: "Every time you went down and respawned.",
    empty: "No deaths this session. Downed-and-respawn runs and instant ship deaths show up here when they happen.",
  },
  {
    id: "kills",
    group: "session",
    label: "Kills",
    hint: "Players you killed or neutralized, especially PvP bounty targets when you finish the contract.",
    empty: "No kills tracked yet. Finish a PvP bounty after you neutralize the target and it will show up here.",
  },
  {
    id: "ships",
    group: "session",
    label: "Ships lost",
    hint: "Your hulls that were destroyed while you were flying or had control. Other players' ships are ignored.",
    empty: "Nothing lost yet. A ship shows up here when a hull you were flying gets destroyed.",
  },
  {
    id: "guides-reputation",
    group: "session",
    label: "Reputation",
    hint: "Faction rep tracked across sessions from Game.log rewards. Tier names are wiki estimates.",
    empty: "No faction reputation recorded yet.",
  },
  {
    id: "history",
    group: "session",
    label: "Log archive",
    hint: "Game.log backups since patch 4.8 (includes 4.9 LIVE). Click one to view everything we can parse from that file.",
    empty: "No log archives found. Set your Game.log path to the StarCitizen LIVE folder (logbackups lives beside it).",
  },
];

const CATALOG_TABS = [
  {
    id: "catalog-ships",
    group: "catalog",
    label: "Ships",
    hint: "Flyable ships with in-game buy and rent prices by station. Data from Star Citizen Wiki and UEX.",
    empty: "No ship catalog loaded yet. Use Refresh catalog below or wait for the background sync.",
  },
  {
    id: "catalog-weapons",
    group: "catalog",
    label: "FPS weapons",
    hint: "Personal weapons and attachments sold at in-game shops, with prices and locations.",
    empty: "No weapon catalog loaded yet. Use Refresh catalog below.",
  },
  {
    id: "catalog-armor",
    group: "catalog",
    label: "Armor",
    hint: "Armor pieces and undersuits for sale at shops, with station and aUEC price.",
    empty: "No armor catalog loaded yet. Use Refresh catalog below.",
  },
  {
    id: "catalog-ship-weapons",
    group: "catalog",
    label: "Ship weapons",
    hint: "Ship guns, turrets, missiles, and racks with shop availability and prices.",
    empty: "No ship weapon catalog loaded yet. Use Refresh catalog below.",
  },
  {
    id: "catalog-ship-parts",
    group: "catalog",
    label: "Ship parts",
    hint: "Coolers, power plants, shields, quantum drives, and utility components for sale.",
    empty: "No ship parts catalog loaded yet. Use Refresh catalog below.",
  },
  {
    id: "catalog-shops",
    group: "catalog",
    label: "Shops",
    hint: "Browse shops and stations to see what they sell. Search by location or terminal name.",
    empty: "No shop data loaded yet. Use Refresh catalog below.",
  },
  {
    id: "catalog-ship-services",
    group: "catalog",
    label: "Ship services",
    hint: "Landing pads and weapon shops from UEX. Refuel/repair use in-game landing services, not commodity admin desks. Refresh catalog after patches.",
    empty: "No ship service locations loaded yet. Use Refresh catalog below.",
  },
];

const GUIDE_TABS = [
  {
    id: "guides-patch-notes",
    group: "guides",
    label: "Patch notes",
    hint: "Official RSI Alpha patch notes. StarTracker app notes are at the bottom, collapsed.",
    empty: "No patch notes loaded yet.",
  },
  {
    id: "guides-commodities",
    group: "guides",
    label: "Market prices",
    hint: "UEX buy and sell prices per SCU. Filter trade, mining, or illegal goods. Expand a row for terminal breakdown.",
    empty: "No commodity data loaded yet. Use Refresh prices below.",
  },
  {
    id: "guides-trade-routes",
    group: "guides",
    label: "Trade routes",
    hint: "Terminal-level buy and sell pairs with stock and demand SCU caps for your cargo.",
    empty: "No trade routes loaded yet. Set cargo SCU and refresh.",
  },
  {
    id: "guides-refinery",
    group: "guides",
    label: "Refinery",
    hint: "Refine-or-sell calculator, yield estimates, and refinery station notes for mining loops.",
    empty: "Refinery data not loaded yet.",
  },
  {
    id: "guides-crafting",
    group: "guides",
    label: "Crafting workshop",
    hint: "Pick a blueprint, see unlock missions, material amounts, quality sliders, and projected stat boosts.",
    empty: "Search for a blueprint to open the workshop.",
  },
  {
    id: "guides-smuggling",
    group: "guides",
    label: "Smuggler routes",
    hint: "Illegal trade routes ranked by UEX spread. See buy, sell, profit per SCU for matched commodities.",
    empty: "No smuggler routes loaded yet.",
  },
  {
    id: "guides-exec-hangar",
    group: "guides",
    label: "Exec hangar",
    hint: "PYAM Executive Hangar live cooldown — five status lights and countdown synced to the global cycle.",
    empty: "Hangar timer config not loaded yet.",
  },
  {
    id: "guides-loops",
    group: "guides",
    label: "Game loops",
    hint: "Quick intros for hauling, mining, smuggling, merc work, and refuel loops with links to relevant tabs.",
    empty: "No game loop guides loaded yet.",
  },
  {
    id: "guides-fleet",
    group: "guides",
    label: "Fleet compare",
    hint: "Sortable ship rankings: hull, shields, SCM, cargo, mass, and signatures from the wiki datamine.",
    empty: "Fleet index not loaded yet.",
  },
  {
    id: "guides-loadout",
    group: "guides",
    label: "Ship builder",
    hint: "Step through ship, weapons, components, and hull stats. DPS updates live as you swap guns.",
    empty: "Load a ship to start building.",
  },
  {
    id: "guides-external-tools",
    group: "guides",
    label: "Credits to",
    hint: "Popular Star Citizen companion sites with links to in-app StarTracker tabs where we cover similar features.",
    empty: "External tools list not loaded.",
  },
  {
    id: "guides-star-strings",
    group: "guides",
    label: "Star Strings",
    hint: "One-click install for MrKraken's Star Strings — in-game contract [BP] tags, blueprint pools, and cleaner titles.",
    empty: "Set your Game.log path in the footer, then install Star Strings here.",
  },
];

const WIKIelo_TABS = [
  {
    id: "wikelo-all",
    group: "wikelo",
    label: "All",
    hint: "Every Wikelo Emporium trade contract from star-citizen.wiki. Expand a row for the full ingredient list and description.",
    empty: "No Wikelo trades loaded yet. Use Refresh below.",
  },
  {
    id: "wikelo-favor",
    group: "wikelo",
    label: "Favor",
    hint: "Turn in materials to earn Wikelo Favor tokens for higher-tier Emporium rewards.",
    empty: "No favor trades match your search.",
  },
  {
    id: "wikelo-armor",
    group: "wikelo",
    label: "Armor & gear",
    hint: "Armor sets, backpacks, and undersuit pieces crafted by Wikelo from your haul.",
    empty: "No armor trades match your search.",
  },
  {
    id: "wikelo-weapons",
    group: "wikelo",
    label: "Weapons",
    hint: "FPS weapons and magazines available through Wikelo Emporium contracts.",
    empty: "No weapon trades match your search.",
  },
  {
    id: "wikelo-ships",
    group: "wikelo",
    label: "Ships",
    hint: "Special Wikelo paint schemes and limited ship variants.",
    empty: "No ship trades match your search.",
  },
  {
    id: "wikelo-other",
    group: "wikelo",
    label: "Other",
    hint: "Miscellaneous Wikelo trades that do not fit the other categories.",
    empty: "No other trades match your search.",
  },
];

const SESSION_TAB_META = {
  overview: "pulse",
  missions: "contract",
  rewards: "economy",
  fines: "alert",
  insurance: "utility",
  shopping: "economy",
  loadout: "combat",
  blueprints: "production",
  deaths: "alert",
  kills: "combat",
  ships: "alert",
  history: "reference",
  "guides-reputation": "progress",
};

const CATALOG_TAB_META = {
  "catalog-ships": "ships",
  "catalog-weapons": "combat",
  "catalog-armor": "combat",
  "catalog-ship-weapons": "combat",
  "catalog-ship-parts": "utility",
  "catalog-shops": "economy",
  "catalog-ship-services": "utility",
};

const INTEL_TAB_META = {
  "guides-patch-notes": "news",
  "guides-commodities": "economy",
  "guides-trade-routes": "economy",
  "guides-smuggling": "economy",
  "guides-exec-hangar": "economy",
  "guides-loops": "economy",
  "guides-refinery": "production",
  "guides-crafting": "production",
  "guides-reputation": "progress",
  "guides-external-tools": "reference",
  "guides-star-strings": "reference",
  "guides-fleet": "combat",
  "guides-loadout": "combat",
};

const WIKIelo_TAB_META = {
  "wikelo-all": "progress",
  "wikelo-favor": "progress",
  "wikelo-armor": "combat",
  "wikelo-weapons": "combat",
  "wikelo-ships": "ships",
  "wikelo-other": "reference",
};

function tabMetaCategory(tabId) {
  return (
    INTEL_TAB_META[tabId] ||
    WIKIelo_TAB_META[tabId] ||
    SESSION_TAB_META[tabId] ||
    CATALOG_TAB_META[tabId] ||
    "reference"
  );
}

const TABS = [...SESSION_TABS, ...CATALOG_TABS, ...GUIDE_TABS, ...WIKIelo_TABS];

const TAB_DESCRIPTIONS = {
  overview:
    "Your home base. A friendly snapshot of this play session before you dive into contracts, combat, or the intel hub.",
  missions:
    "Contracts you accepted, finished, failed, or walked away from. Use this to track what you worked on and how objectives progressed.",
  rewards:
    "Confirmed aUEC comes from Awarded X aUEC HUD lines. When those are missing, StarTracker estimates payout from star-citizen.wiki and your tracked faction rep. Estimates are labeled and are not confirmed.",
  fines:
    "UEC fines from CrimeStat and monitored-space popups. Check here when you want to see penalties that hit you this session.",
  insurance:
    "Ship insurance claims that completed with a hull respawn. Helpful after you lose a ship and want to confirm the claim went through.",
  shopping:
    "Items you bought at shops and kiosks when the log records the purchase. Useful for tracking gear you picked up during a run.",
  loadout:
    "Weapons and armor combat stats from spawn and gear changes. Pick a snapshot chip to compare loadouts.",
  blueprints:
    "Blueprint unlocks when the log names them. Look here after contract payouts that grant schematics.",
  deaths:
    "Every time you went down and respawned. Use this to review how often you died and where it happened.",
  kills:
    "Players you killed or neutralized, including PvP bounty targets. Handy after bounty hunting or combat sessions.",
  ships:
    "Hulls you lost while flying or in control. Check this when you want a list of your own ship destructions.",
  history:
    "Game.log backups since patch 4.8 (includes 4.9 LIVE). Open an archive to review parsed stats from an older play session.",
  "guides-reputation":
    "Persistent faction rep from parsed rewards plus this session's gains. Progress bars use wiki contractor tier thresholds (estimates).",
  "catalog-ships":
    "Flyable ships with buy and rent prices by station. Use when you are shopping for a new ship or comparing rental costs.",
  "catalog-weapons":
    "Personal weapons and attachments sold in-game. Helpful when you need prices and which station stocks what.",
  "catalog-armor":
    "Armor pieces and undersuits for sale. Browse here before gearing up at a new location.",
  "catalog-ship-weapons":
    "Ship guns, turrets, missiles, and racks. Use when upgrading loadouts and checking shop availability.",
  "catalog-ship-parts":
    "Coolers, power plants, shields, quantum drives, and utility parts. Open this when planning component upgrades.",
  "catalog-shops":
    "Browse terminals and stations to see what they sell. Search by location when you know where you are headed.",
  "catalog-ship-services":
    "Places that offer refuel, repair, or ship ammo restock. Check before long trips or after combat damage.",
  "guides-patch-notes":
    "Official Star Citizen patch notes from RSI, pulled via the wiki comm-link feed. StarTracker app notes are tucked at the bottom.",
  "guides-commodities":
    "UEX terminal prices per SCU. Use filters for trade haul goods, mined materials, or illegal cargo. Expand rows for best buy and sell locations.",
  "guides-trade-routes":
    "Single-hop profit from UEX buy and sell terminals, capped by stock, demand, and your cargo SCU.",
  "guides-refinery":
    "Decide whether to refine ore or sell raw. Calculator uses UEX sell prices and community yield estimates.",
  "guides-crafting":
    "Blueprint recipes from the wiki datamine. Tune material quality (0 to 1000) and preview how output stats shift.",
  "guides-smuggling":
    "Curated smuggling routes with risk level, commodity hints, and location notes. Verify prices before hauling.",
  "guides-exec-hangar":
    "Live PYAM Executive Hangar cycle with five status lights and countdown. Insert compboards only while lights are green and none are red.",
  "guides-loops":
    "Short guides for common game loops with tips and links to related StarTracker tabs.",
  "guides-external-tools":
    "Curated list of community tools like SC Trade Tools, Erkul, Hangar Link, and SCodex. In-app equivalents are marked.",
  "guides-fleet":
    "Every flyable ship, sortable like a fleet chart. Hull, shields, speed, cargo, and signatures from the wiki datamine.",
  "guides-loadout":
    "Step through ship, weapons, components, and hull stats. DPS updates live as you swap guns. Reset to stock anytime.",
  "wikelo-all":
    "Browse every Wikelo Emporium trade contract. See what to haul in and what you receive, with rep requirements when the wiki lists them.",
  "wikelo-favor":
    "Contracts that pay Wikelo Favor. Collect favors to unlock higher-tier Emporium crafts when stock rotates.",
  "wikelo-armor":
    "Armor and gear trades at the Wikelo Emporium. Expand a row for the full ingredient list.",
  "wikelo-weapons":
    "Personal weapons and magazines from Wikelo contracts. Check haul requirements before you fly.",
  "wikelo-ships":
    "Limited ship variants and Wikelo war specials. Rep and material costs vary by contract.",
  "wikelo-other":
    "Miscellaneous Wikelo Emporium trades including colors, components, and uncategorized rewards.",
};

const TAB_ICONS = {
  overview: "◎",
  missions: "◈",
  rewards: "✦",
  fines: "△",
  insurance: "◇",
  shopping: "◆",
  loadout: "⬡",
  blueprints: "▣",
  deaths: "✕",
  kills: "◉",
  ships: "✧",
  history: "⏱",
  "catalog-ships": "🛸",
  "catalog-weapons": "⚔",
  "catalog-armor": "⬢",
  "catalog-ship-weapons": "✹",
  "catalog-ship-parts": "⚙",
  "catalog-shops": "◫",
  "catalog-ship-services": "⛽",
  "guides-patch-notes": "📡",
  "guides-commodities": "◫",
  "guides-trade-routes": "⇄",
  "guides-refinery": "⚗",
  "guides-crafting": "▣",
  "guides-smuggling": "◐",
  "guides-exec-hangar": "◉",
  "guides-loops": "↻",
  "guides-reputation": "★",
  "guides-external-tools": "⊞",
  "guides-star-strings": "☰",
  "guides-fleet": "🚀",
  "guides-loadout": "🔧",
  "wikelo-all": "◈",
  "wikelo-favor": "★",
  "wikelo-armor": "⬢",
  "wikelo-weapons": "⚔",
  "wikelo-ships": "🛸",
  "wikelo-other": "✦",
};

const QUICK_NAV_EMPTY_HINT =
  "Star tabs you use often with Add to Jump to on the tab bar. Your favorites will appear here for one-click access.";

let favoriteTabIds = [];
let shipBuilderFavorites = [];
let shipBuilderPickMode = "all";

const EMPTY_TIPS = {
  missions: "Accept a contract in-game and StarTracker will pick it up from Game.log.",
  rewards: "Complete missions with aUEC payouts. Awarded popups in the log are the most reliable source.",
  "guides-fleet": "Tap Refresh index to pull the latest ship list from the wiki.",
  "guides-loadout": "Try aegs-gladius, drak-cutlass-black, or anvl-hurricane as a starting slug.",
  "guides-refinery": "Start with Quantanium or Bexalite to compare refine vs raw sell value.",
  "guides-crafting": "Try ADP Core or search your armor piece to see mission sources and quality curves.",
  "guides-star-strings": "Install Star Strings to show blueprint pools and [BP] tags on contracts in-game.",
  "wikelo-favor": "Search carinite or kopion to find common favor turn-ins.",
  loadout: "Change gear or respawn in-game to capture a loadout snapshot.",
};

let activeTab = "overview";
/** Last session snapshot used when main briefly sends current:null (stale log replay). */
let lastDisplaySession = null;
/** Latest state from main process (for safe tab counts during async archive scan). */
let lastKnownState = null;
/** Full parse of a selected log archive (replaces live session in UI). */
let archiveViewSession = null;
let archiveViewMeta = null;
let logArchiveList = [];
let logArchiveLoading = false;
let logArchiveError = null;
/** Latest update check result from main process. */
let updateInfo = null;
let updateBannerDismissed = false;
let updateInstalling = false;
/** Game catalog (ships, items, shops) from main process. */
let catalogStats = null;
let catalogSyncMessage = null;
let catalogSyncBusy = false;
const catalogQueryByTab = {
  "catalog-ships": { query: "", offset: 0 },
  "catalog-weapons": { query: "", offset: 0, section: "fps_weapons" },
  "catalog-armor": { query: "", offset: 0, section: "armor" },
  "catalog-ship-weapons": { query: "", offset: 0, section: "ship_weapons" },
  "catalog-ship-parts": { query: "", offset: 0, section: "ship_components" },
  "catalog-shops": { query: "", offset: 0 },
  "catalog-ship-services": { query: "", offset: 0 },
};
const guideQueryByTab = {
  "guides-commodities": { query: "", offset: 0, sort: "name", filter: "trade" },
  "guides-trade-routes": { cargoScu: 128, includeIllegal: false, minSpread: 0, query: "", sort: "profit" },
  "guides-refinery": {
    oreId: "quantainium",
    oreScu: 100,
    yieldPercent: null,
    feePercent: 5,
  },
  "guides-crafting": {
    query: "",
    blueprintId: null,
    qualities: {},
    page: 1,
  },
  "guides-fleet": { query: "", offset: 0, sort: "manufacturer", limit: 80 },
  "guides-loadout": { query: "" },
};
const wikeloQueryByTab = {
  "wikelo-all": { query: "" },
  "wikelo-favor": { query: "" },
  "wikelo-armor": { query: "" },
  "wikelo-weapons": { query: "" },
  "wikelo-ships": { query: "" },
  "wikelo-other": { query: "" },
};
const WIKELO_CATEGORY_BY_TAB = {
  "wikelo-all": "all",
  "wikelo-favor": "favor",
  "wikelo-armor": "armor",
  "wikelo-weapons": "weapons",
  "wikelo-ships": "ships",
  "wikelo-other": "other",
};
let guideCommodityMeta = null;
let fleetCompareMeta = null;
let loadoutBuilderState = {
  shipSlug: null,
  slotAssignments: {},
  stockBaseline: null,
};
let loadoutBuilderBlueprint = null;
let guideCommodityRefreshBusy = false;
let guideDetailCommodityId = null;
let catalogDetailKey = null;

/** Loadout tab accordion: which snapshot is expanded (snap.at ISO key). */
let loadoutExpandKey = null;
let loadoutCombatByKey = Object.create(null);
let loadoutCombatLoadingKey = null;

/** Inline accordion expand: detail renders directly under the selected row. */
let inlineExpand = {
  host: null,
  key: null,
  kind: null,
  html: null,
  loading: false,
};
let fleetCompareLastRows = null;
let fleetCompareCacheKey = null;
let catalogLastPayload = null;
let lastCombatSearchRows = null;
let guideCommodityLastPayload = null;
let tradeRoutesLastPayload = null;
let smugglerRoutesLastPayload = null;
let wikeloMeta = null;
let wikeloRefreshBusy = false;
/** Star Strings installer panel state */
let starStringsUiState = {
  busy: false,
  progress: null,
  message: null,
  status: null,
};
let wikeloTradesLastPayload = null;
let craftingDetailCache = null;
let craftingSearchLastRows = null;
let craftingSearchMeta = null;
let shipBuilderLastPayload = null;
let fleetComparePageMeta = null;

const INLINE_HOST = {
  FLEET: "fleet",
  COMBAT: "combat-search",
  CATALOG: "catalog",
  COMMODITY: "guide-commodity",
  TRADE: "trade-route",
  SMUGGLE: "smuggle-route",
  WIKELO: "wikelo-trade",
  CRAFTING: "crafting-blueprint",
  SHIP_BUILDER: "ship-builder",
};

function clearInlineExpand() {
  inlineExpand = { host: null, key: null, kind: null, html: null, loading: false };
  catalogDetailKey = null;
  guideDetailCommodityId = null;
}

function isInlineExpanded(host, key) {
  return inlineExpand.host === host && String(inlineExpand.key) === String(key);
}

function expandChevron(host, key) {
  return isInlineExpanded(host, key) ? "▾" : "▸";
}

function renderReferenceLinkBar(links, note) {
  if (!links?.length) return "";
  const btns = links
    .map(
      (l) =>
        `<button type="button" class="btn btn-sm btn-ghost ref-link-btn" data-guide-external="${escapeAttr(l.url)}" title="${escapeAttr(l.source || l.label)}">${escapeHtml(l.label)}</button>`
    )
    .join("");
  return `<div class="reference-link-bar">${note ? `<span class="reference-link-note muted small">${displayText(note)}</span>` : ""}<div class="reference-link-buttons">${btns}</div></div>`;
}

async function fetchReferenceLinkBar(options, note) {
  try {
    const links = await window.debrief.referenceBuildLinks(options);
    return renderReferenceLinkBar(links, note);
  } catch {
    return "";
  }
}

async function buildTerminalStarmapLinks(terminalRoute) {
  if (!terminalRoute?.buyTerminal && !terminalRoute?.sellTerminal) return "";
  const blocks = [];
  for (const [label, term] of [
    ["Buy terminal", terminalRoute.buyTerminal],
    ["Sell terminal", terminalRoute.sellTerminal],
  ]) {
    if (!term?.terminal) continue;
    const loc = await window.debrief.starmapLookupLocation(term.terminal);
    if (loc?.location?.description) {
      blocks.push(`<p class="muted small starmap-loc-blurb"><strong>${escapeHtml(label)}:</strong> ${displayText(String(loc.location.description).slice(0, 220))}${String(loc.location.description).length > 220 ? "…" : ""}</p>`);
    }
    if (loc?.links?.length) {
      blocks.push(renderReferenceLinkBar(loc.links, `${label} · ${term.terminal}`));
    }
  }
  return blocks.length ? `<div class="starmap-ref-block">${blocks.join("")}</div>` : "";
}

function renderInlineDetailRow(colspan, host, key) {
  if (!isInlineExpanded(host, key)) return "";
  const inner = inlineExpand.loading
    ? `<p class="muted small inline-detail-loading">Loading…</p>`
    : inlineExpand.html || "";
  return `<tr class="inline-detail-row" data-inline-detail-for="${escapeAttr(String(key))}"><td colspan="${colspan}"><div class="inline-detail-panel">${inner}</div></td></tr>`;
}

async function fetchCombatProfileHtml(detail, kind) {
  const key = detail?.className || detail?.slug;
  if (!key) return "";
  const isVehicle = activeTab === "catalog-ships" || kind === "vehicle";
  try {
    const [data, tools] = await Promise.all([
      isVehicle
        ? window.debrief.combatGetVehicleProfile({ className: key, slug: detail.slug || key })
        : window.debrief.combatGetItemProfile({ className: key, slug: detail.slug || key }),
      window.debrief.combatGetExternalTools(),
    ]);
    return renderCombatProfilePanel(data, { advancedTools: tools.tools });
  } catch (e) {
    return renderCombatProfilePanel({ ok: false, error: e.message || String(e) });
  }
}

async function buildCatalogInlineHtml(key, kind) {
  const detail =
    kind === "shop"
      ? await window.debrief.catalogShopDetail(key)
      : kind === "place"
        ? await window.debrief.catalogPlaceDetail(key)
        : await window.debrief.catalogItemDetail(key);
  const isShip =
    kind === "vehicle" || activeTab === "catalog-ships" || detail?.section === "Ships";
  if (isShip) {
    const perfHtml = await fetchCombatProfileHtml(detail, "vehicle");
    const refBar = await fetchReferenceLinkBar(
      { kind: "ship", name: detail.name, slug: detail.slug, className: detail.className },
      "Cross-reference"
    );
    const listingsHtml = renderCatalogDetail(detail, "item");
    return `${refBar}${perfHtml}${listingsHtml}`;
  }
  let html = renderCatalogDetail(detail, kind);
  const refBar = await fetchReferenceLinkBar(
    {
      kind: kind === "place" ? "location" : "item",
      name: detail.name || detail.terminal,
      slug: detail.slug,
      className: detail.className,
    },
    "Cross-reference"
  );
  html = refBar + html;
  const combatHtml = await fetchCombatProfileHtml(detail, kind);
  if (combatHtml) html += combatHtml;
  return html;
}

async function refreshInlineExpandHost(host) {
  switch (host) {
    case INLINE_HOST.FLEET:
      if (activeTab === "guides-fleet" && fleetCompareLastRows) {
        patchPanelTable("#panel-guides-fleet", renderFleetCompareRows(fleetCompareLastRows));
      } else if (activeTab === "guides-fleet") {
        await loadFleetCompareTab("guides-fleet");
      }
      break;
    case INLINE_HOST.COMBAT: {
      const el = $("combatSearchResults");
      if (el && lastCombatSearchRows) el.innerHTML = renderCombatSearchResults(lastCombatSearchRows);
      break;
    }
    case INLINE_HOST.CATALOG:
      if (activeTab.startsWith("catalog-") && catalogLastPayload) {
        patchPanelTable(`#panel-${catalogLastPayload.tabId}`, catalogLastPayload.html);
      } else if (activeTab.startsWith("catalog-")) {
        await loadCatalogTab(activeTab);
      }
      break;
    case INLINE_HOST.COMMODITY:
      if (activeTab.startsWith("guides-") && guideCommodityLastPayload) {
        patchPanelTable(`#panel-${guideCommodityLastPayload.tabId}`, guideCommodityLastPayload.tableHtml);
      } else if (activeTab.startsWith("guides-")) {
        await loadGuideTab(activeTab);
      }
      break;
    case INLINE_HOST.TRADE:
      if (activeTab === "guides-trade-routes" && tradeRoutesLastPayload?.routes) {
        patchPanelTable(
          "#panel-guides-trade-routes",
          renderTradeRouteRows(tradeRoutesLastPayload.routes)
        );
      } else if (activeTab === "guides-trade-routes") {
        await loadGuideTab("guides-trade-routes");
      }
      break;
    case INLINE_HOST.SMUGGLE:
      if (activeTab === "guides-smuggling" && smugglerRoutesLastPayload?.routes) {
        patchPanelTable(
          "#panel-guides-smuggling",
          renderSmugglerRouteRows(smugglerRoutesLastPayload.routes)
        );
      } else if (activeTab === "guides-smuggling") {
        await loadGuideTab("guides-smuggling");
      }
      break;
    case INLINE_HOST.WIKELO:
      if (activeTab.startsWith("wikelo-") && wikeloTradesLastPayload?.rows) {
        patchPanelTable(
          `#panel-${wikeloTradesLastPayload.tabId}`,
          renderWikeloTradeRows(wikeloTradesLastPayload.rows, wikeloTradesLastPayload.tabId)
        );
      } else if (activeTab.startsWith("wikelo-")) {
        await loadWikeloTab(activeTab);
      }
      break;
    case INLINE_HOST.CRAFTING: {
      const el = $("craftingSearchResults");
      if (el && craftingSearchLastRows) {
        el.innerHTML = renderCraftingSearchRows(
          craftingSearchLastRows,
          guideQueryByTab["guides-crafting"]?.blueprintId || null
        );
      }
      break;
    }
    case INLINE_HOST.SHIP_BUILDER:
      if (activeTab === "guides-loadout" && shipBuilderLastPayload?.rows) {
        patchShipBuilderTableFromPayload();
      }
      break;
    default:
      break;
  }
}

function patchPanelTable(panelSelector, tableHtml) {
  const panel = document.querySelector(`${panelSelector} .panel-body`);
  const old = panel?.querySelector(".catalog-table-wrap");
  if (old) old.outerHTML = tableHtml;
}

function patchPanelResults(panelSelector, tableHtml, pagerHtml = "") {
  patchPanelTable(panelSelector, tableHtml);
  const panel = document.querySelector(`${panelSelector} .panel-body`);
  if (!panel) return;
  const pager = panel.querySelector(".catalog-pager");
  if (pagerHtml) {
    if (pager) pager.outerHTML = pagerHtml;
    else panel.querySelector(".catalog-table-wrap")?.insertAdjacentHTML("afterend", pagerHtml);
  } else if (pager) {
    pager.remove();
  }
}

function patchShipBuilderTable(tableHtml) {
  const scroll = document.querySelector("#panel-guides-loadout .ship-picker-table-scroll");
  const top = scroll?.scrollTop ?? 0;
  const wrap = document.querySelector("#panel-guides-loadout .ship-picker-table-wrap");
  if (wrap) {
    wrap.outerHTML = tableHtml;
    const next = document.querySelector("#panel-guides-loadout .ship-picker-table-scroll");
    if (next) next.scrollTop = top;
  }
}

function patchShipBuilderTableFromPayload() {
  if (!shipBuilderLastPayload?.rows) return;
  patchShipBuilderTable(
    renderShipBuilderRows(shipBuilderLastPayload.rows, shipBuilderLastPayload.emptyMessage)
  );
}

function scrollShipBuilderExpandIntoView(slug) {
  const row =
    document.querySelector(
      `#panel-guides-loadout tr[data-ship-builder-key="${CSS.escape(String(slug))}"]`
    ) ||
    document.querySelector(
      `#panel-guides-loadout tr[data-inline-detail-for="${CSS.escape(String(slug))}"]`
    );
  row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

async function toggleInlineExpand(host, key, meta = {}) {
  if (isInlineExpanded(host, key)) {
    clearInlineExpand();
    await refreshInlineExpandHost(host);
    return;
  }
  inlineExpand = { host, key: String(key), kind: meta.kind || null, html: null, loading: true };
  if (host === INLINE_HOST.CATALOG) catalogDetailKey = String(key);
  if (host === INLINE_HOST.COMMODITY) guideDetailCommodityId = Number(key);
  await refreshInlineExpandHost(host);

  try {
    let html = "";
    if (host === INLINE_HOST.FLEET) {
      const slug = meta.subKey || key;
      const [data, tools] = await Promise.all([
        window.debrief.combatGetVehicleProfile({ className: slug, slug }),
        window.debrief.combatGetExternalTools(),
      ]);
      html = renderCombatProfilePanel(data, { advancedTools: tools.tools });
    } else if (host === INLINE_HOST.COMBAT) {
      const kind = meta.kind || "item";
      const [data, tools] = await Promise.all([
        kind === "vehicle"
          ? window.debrief.combatGetVehicleProfile({ className: key, slug: key })
          : window.debrief.combatGetItemProfile({ className: key, slug: key }),
        window.debrief.combatGetExternalTools(),
      ]);
      html = renderCombatProfilePanel(data, { advancedTools: tools.tools });
    } else if (host === INLINE_HOST.CATALOG) {
      html = await buildCatalogInlineHtml(String(key), meta.kind || "item");
    } else if (host === INLINE_HOST.COMMODITY) {
      const detail = await window.debrief.guidesGetCommodityDetail(Number(key));
      html = renderGuideCommodityDetail(detail);
    } else if (host === INLINE_HOST.TRADE) {
      const state = guideQueryByTab["guides-trade-routes"] || {};
      const cargoScu = state.cargoScu || tradeRoutesLastPayload?.cargoScu || 128;
      const detail = await window.debrief.guidesGetTradeRouteDetail({
        commodityId: Number(key),
        cargoScu,
      });
      html = renderTradeRouteInlineDetail(detail);
      html += await buildTerminalStarmapLinks(detail?.route);
    } else if (host === INLINE_HOST.SMUGGLE) {
      const route =
        meta.route ||
        smugglerRoutesLastPayload?.routes?.find(
          (r) => String(r.id || r.name) === String(key)
        ) ||
        null;
      html = renderSmugglerRouteInlineDetail(route);
      html += await buildTerminalStarmapLinks(route?.terminalRoute);
    } else if (host === INLINE_HOST.WIKELO) {
      const row =
        wikeloTradesLastPayload?.rows?.find((t) => String(t.id) === String(key)) || null;
      html = renderWikeloTradeDetail(row);
    } else if (host === INLINE_HOST.CRAFTING) {
      const detail = await window.debrief.craftingGetBlueprint(key);
      if (detail?.ok) {
        craftingDetailCache = detail;
        const state = guideQueryByTab["guides-crafting"] || {};
        if (!state.qualities || !Object.keys(state.qualities).length) {
          state.qualities = { ...(detail.preview?.qualities || {}) };
          guideQueryByTab["guides-crafting"] = state;
        } else {
          const calc = await window.debrief.craftingCalculatePreview({
            blueprintId: key,
            qualities: state.qualities,
          });
          if (calc?.ok) detail.preview = calc.preview;
        }
        state.blueprintId = key;
        guideQueryByTab["guides-crafting"] = state;
      }
      html = buildCraftingInlineDetail(detail, guideQueryByTab["guides-crafting"] || {});
    } else if (host === INLINE_HOST.SHIP_BUILDER) {
      html = await buildShipBuilderInlineHtml(String(key));
    }
    if (inlineExpand.host === host && String(inlineExpand.key) === String(key)) {
      inlineExpand.html = html;
      inlineExpand.loading = false;
      await refreshInlineExpandHost(host);
      if (host === INLINE_HOST.SHIP_BUILDER) {
        scrollShipBuilderExpandIntoView(key);
        // Fill equipment dropdowns without blocking the first paint.
        finishShipBuilderSlotOptions(String(key));
      }
    }
  } catch (e) {
    if (inlineExpand.host === host && String(inlineExpand.key) === String(key)) {
      inlineExpand.html = `<p class="muted">${escapeHtml(e.message || String(e))}</p>`;
      inlineExpand.loading = false;
      await refreshInlineExpandHost(host);
    }
  }
}

const STAT_KEYS = [
  { key: "session", label: "Session" },
  { key: "contracts", label: "Contracts done" },
  { key: "deaths", label: "Deaths" },
  { key: "ships", label: "Ships lost" },
  { key: "kills", label: "Kills" },
  { key: "auec", label: "aUEC earned" },
  { key: "earn", label: "Payouts" },
];

const tabById = (id) => TABS.find((t) => t.id === id) || TABS[0];

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

const debouncedCatalogSearch = debounce((tabId) => {
  clearInlineExpand();
  if (activeTab === tabId) loadCatalogTab(tabId, { resetOffset: true, filterOnly: true });
}, 320);

const debouncedGuideSearch = debounce((tabId) => {
  clearInlineExpand();
  if (activeTab === tabId) loadGuideTab(tabId, { resetOffset: true, filterOnly: true });
}, 320);

const debouncedWikeloSearch = debounce((tabId) => {
  clearInlineExpand();
  if (activeTab === tabId) loadWikeloTab(tabId, { filterOnly: true });
}, 320);

const debouncedFleetSearch = debounce((tabId) => {
  clearInlineExpand();
  if (activeTab === tabId) loadFleetCompareTab(tabId, { resetOffset: true, filterOnly: true });
}, 320);

const debouncedShipBuilderFilter = debounce(() => {
  if (activeTab === "guides-loadout") refreshShipBuilderFilter();
}, 320);

const debouncedTradeRouteSearch = debounce(() => {
  if (activeTab === "guides-trade-routes") refreshTradeRoutesTab({ filterOnly: true });
}, 320);

const debouncedTradeRouteScu = debounce(() => {
  if (activeTab === "guides-trade-routes") refreshTradeRoutesTab();
}, 450);

const debouncedCraftingSearch = debounce(() => {
  clearInlineExpand();
  if (activeTab !== "guides-crafting") return;
  const state = guideQueryByTab["guides-crafting"] || {};
  state.page = 1;
  guideQueryByTab["guides-crafting"] = state;
  loadCraftingTab("guides-crafting");
}, 320);

const debouncedCraftingPreview = debounce(async () => {
  await refreshCraftingPreview();
}, 180);

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function fmtDateTime(iso) {
  try {
    return new Date(iso).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function displayText(s) {
  return escapeHtml(sanitizeDisplayText(s));
}

function renderRewardBreakdown(reward) {
  const lines = reward.displayLines || [];
  if (lines.length) {
    return `<ul class="reward-breakdown">${lines
      .map(
        (l) =>
          `<li><span class="reward-lbl">${escapeHtml(l.label)}</span> <span class="reward-val">${escapeHtml(l.value)}</span></li>`
      )
      .join("")}</ul>`;
  }
  return `<p class="muted small">${displayText(reward.summary || "Payout details weren't clear")}</p>`;
}

function entryCard({ time, badge, badgeClass, title, description, extraHtml }) {
  const descBlock =
    description != null && String(description).trim() !== ""
      ? `<p class="entry-desc">${displayText(description)}</p>`
      : "";
  return `<article class="entry ${badgeClass || ""}">
    <header class="entry-head">
      ${badge ? `<span class="entry-badge">${escapeHtml(badge)}</span>` : ""}
      <time class="entry-time">${escapeHtml(time)}</time>
    </header>
    <h3 class="entry-title">${displayText(title)}</h3>
    ${descBlock}
    ${extraHtml || ""}
  </article>`;
}

function beautifyContractTitle(title) {
  return String(title || "")
    .replace(/\s*:\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function renderContractObjectives(c) {
  const objs = c.objectives || [];
  if (!objs.length) {
    return `<p class="objective-empty muted small">No objectives logged for this contract yet.</p>`;
  }
  return `<ul class="objective-list">${objs
    .map((o) => {
      const done = Boolean(o.complete);
      const badge = done ? "Complete" : "Pending";
      const badgeClass = done ? "obj-badge-done" : "obj-badge-pending";
      return `<li><span class="objective-title">${escapeHtml(o.title)}</span><span class="obj-badge ${badgeClass}">${badge}</span></li>`;
    })
    .join("")}</ul>`;
}

function formatMissionOrgLabel(name) {
  if (!name) return "";
  return String(name)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

function contractMissionExtra(c, innerAfterObjectives = "") {
  const metaBits = [];
  if (c.organization) metaBits.push(formatMissionOrgLabel(c.organization));
  if (c.missionType) metaBits.push(c.missionType);
  const meta = metaBits.length
    ? `<p class="muted small">${escapeHtml(metaBits.join(" · "))}</p>`
    : "";
  return `<div class="entry-extra">${meta}${renderContractObjectives(c)}${innerAfterObjectives}</div>`;
}

const GUIDE_THEME_LABELS = {
  economy: { label: "Economy Intel", tag: "TRADE LANES" },
  combat: { label: "Combat Systems", tag: "TARGETING" },
  production: { label: "Production Bay", tag: "REFINERY" },
  progress: { label: "Standing Tracker", tag: "REP GRID" },
  reference: { label: "Nav Database", tag: "LINKS" },
  news: { label: "Comm Link", tag: "PATCH FEED" },
};

const GUIDE_TAB_BANNER = {
  "guides-commodities": { label: "Market Prices", tag: "MARKET" },
  "guides-trade-routes": { label: "Trade Routes", tag: "ROUTES" },
  "guides-smuggling": { label: "Smuggler Routes", tag: "SMUGGLE" },
  "guides-exec-hangar": { label: "Exec Hangar", tag: "PYAM" },
  "guides-loops": { label: "Game Loops", tag: "LOOPS" },
  "guides-refinery": { label: "Production Bay", tag: "REFINERY" },
  "guides-crafting": { label: "Crafting Workshop", tag: "WORKSHOP" },
  "guides-fleet": { label: "Fleet Compare", tag: "FLEET" },
  "guides-loadout": { label: "Ship Builder", tag: "BUILDER" },
  "guides-patch-notes": { label: "Patch Notes", tag: "PATCH" },
  "guides-external-tools": { label: "Credits To", tag: "TOOLS" },
  "guides-star-strings": { label: "Star Strings", tag: "STRINGS" },
  "guides-reputation": { label: "Reputation", tag: "STANDING" },
};

const WIKIelo_TAB_BANNER = {
  "wikelo-all": { label: "Emporium Trades", tag: "WIKELO" },
  "wikelo-favor": { label: "Favor Trades", tag: "FAVOR" },
  "wikelo-armor": { label: "Armor & Gear", tag: "ARMOR" },
  "wikelo-weapons": { label: "Weapons", tag: "GUNS" },
  "wikelo-ships": { label: "Ship Specials", tag: "SHIPS" },
  "wikelo-other": { label: "Other Trades", tag: "MISC" },
};

function guideThemeBanner(tabId) {
  if (!tabId.startsWith("guides-") && !tabId.startsWith("wikelo-")) return "";
  const cat = tabMetaCategory(tabId);
  const theme =
    GUIDE_TAB_BANNER[tabId] ||
    WIKIelo_TAB_BANNER[tabId] ||
    GUIDE_THEME_LABELS[cat] ||
    GUIDE_THEME_LABELS.reference;
  const icon = TAB_ICONS[tabId] || "✦";
  return `<div class="panel-theme-banner panel-theme-banner-${escapeAttr(cat)}" aria-hidden="true">
    <span class="panel-theme-banner-icon">${icon}</span>
    <span class="panel-theme-banner-tag">${escapeHtml(theme.tag)}</span>
    <span class="panel-theme-banner-label">${escapeHtml(theme.label)}</span>
    <span class="panel-theme-banner-line"></span>
  </div>`;
}

function panelShell(tab, innerHtml) {
  const selected = tab.id === activeTab;
  const themeClass =
    tab.id.startsWith("guides-") || tab.id.startsWith("wikelo-")
      ? ` panel-theme-${tabMetaCategory(tab.id)}`
      : "";
  return `<section
    id="panel-${tab.id}"
    class="tab-panel${themeClass} ${selected ? "is-active" : ""}"
    role="tabpanel"
    aria-labelledby="tab-${tab.id}"
    ${selected ? "" : 'hidden'}
  >
    ${guideThemeBanner(tab.id)}
    <div class="panel-body">${innerHtml}</div>
  </section>`;
}

function tabLabel(tabId) {
  return tabById(tabId)?.label || tabId;
}

function isFavoriteTab(tabId) {
  return favoriteTabIds.includes(tabId);
}

async function loadShipBuilderFavorites() {
  try {
    shipBuilderFavorites = await window.debrief.uiGetShipFavorites();
    if (!Array.isArray(shipBuilderFavorites)) shipBuilderFavorites = [];
  } catch {
    shipBuilderFavorites = [];
  }
}

function isShipFavorited(slug) {
  return shipBuilderFavorites.some((s) => s.slug === slug);
}

async function toggleShipFavorite(slug, name, manufacturer) {
  shipBuilderFavorites = await window.debrief.uiToggleShipFavorite({ slug, name, manufacturer });
  return shipBuilderFavorites;
}

async function loadFavoriteTabs() {
  try {
    const fav = await window.debrief.uiGetFavoriteTabs();
    favoriteTabIds = Array.isArray(fav)
      ? [...new Set(fav.map((id) => resolveTabId(id)).filter((id) => tabById(id)))]
      : [];
  } catch {
    favoriteTabIds = [];
  }
  renderQuickNav();
}

async function toggleFavoriteTab(tabId) {
  if (!tabById(tabId)) return;
  try {
    favoriteTabIds = await window.debrief.uiToggleFavoriteTab(tabId);
    favoriteTabIds = favoriteTabIds.filter((id) => tabById(id));
  } catch {
    /* ignore */
  }
  renderQuickNav();
  updateTabDescription(activeTab);
}

function renderQuickNav() {
  const nav = $("quickNav");
  if (!nav) return;
  const favorites = favoriteTabIds.filter((id) => tabById(id));
  if (!favorites.length) {
    nav.innerHTML = `<span class="quick-nav-label">Jump to</span><p class="quick-nav-empty muted small">${escapeHtml(QUICK_NAV_EMPTY_HINT)}</p>`;
    return;
  }
  nav.innerHTML = `<span class="quick-nav-label">Jump to</span>${favorites
    .map(
      (id) =>
        `<button type="button" class="quick-nav-chip${id === activeTab ? " is-active" : ""}" data-tab="${escapeAttr(id)}" title="${escapeAttr(tabLabel(id))}"><span class="quick-nav-chip-icon" aria-hidden="true">${TAB_ICONS[id] || "✦"}</span>${escapeHtml(tabLabel(id))}</button>`
    )
    .join("")}`;
  nav.querySelectorAll(".quick-nav-chip").forEach((chip) => {
    chip.addEventListener("click", () => setActiveTab(chip.dataset.tab));
  });
}

function updateTabDescription(tabId) {
  const el = $("tabDescription");
  if (!el) return;
  const tab = tabById(tabId);
  const text = TAB_DESCRIPTIONS[tabId] || tab?.hint || "";
  if (!text) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  const icon = TAB_ICONS[tabId] || "✦";
  const favorited = isFavoriteTab(tabId);
  const intelCat = tabMetaCategory(tabId);
  const intelLabels = {
    economy: "Economy",
    production: "Production",
    combat: "Combat",
    progress: "Progress",
    reference: "Reference",
    news: "News",
  };
  const catBadge = intelCat
    ? `<span class="tab-intel-cat tab-intel-cat-${escapeAttr(intelCat)}">${escapeHtml(intelLabels[intelCat] || intelCat)}</span>`
    : "";
  el.innerHTML = `<div class="tab-briefing">
    <span class="tab-briefing-icon" aria-hidden="true">${icon}</span>
    <div class="tab-briefing-copy">
      <div class="tab-briefing-head">
        <strong class="tab-briefing-title">${escapeHtml(tab?.label || tabId)}</strong>
        ${catBadge}
      </div>
      <p class="tab-briefing-text">${escapeHtml(text)}</p>
    </div>
    <button type="button" class="tab-favorite-btn${favorited ? " is-favorited" : ""}" data-favorite-tab="${escapeAttr(tabId)}" aria-pressed="${favorited}" title="${favorited ? "Remove from Jump to" : "Add to Jump to"}">
      <span class="tab-favorite-icon" aria-hidden="true">${favorited ? "★" : "☆"}</span>
      <span class="tab-favorite-label">${favorited ? "In Jump to" : "Add to Jump to"}</span>
    </button>
  </div>`;
  el.hidden = false;
}

function updateQuickNavActive(tabId) {
  document.querySelectorAll(".quick-nav-chip").forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.tab === tabId);
  });
}

function initQuickNav() {
  renderQuickNav();
}

function emptyPanel(tab) {
  const icon = TAB_ICONS[tab.id] || "✦";
  const tip = EMPTY_TIPS[tab.id];
  const tipBlock = tip
    ? `<p class="empty-state-tip"><strong>Tip:</strong> ${escapeHtml(tip)}</p>`
    : "";
  return `<div class="empty-state empty-state-orbit">
    <div class="empty-state-visual" aria-hidden="true">
      <div class="orbit-ring"></div>
      <div class="orbit-core">${icon}</div>
    </div>
    <p class="empty-state-title">Nothing here yet</p>
    <p>${escapeHtml(tab.empty)}</p>
    ${tipBlock}
  </div>`;
}

function initStats() {
  const el = $("stats");
  const statTitles = {
    auec: "aUEC from Awarded X aUEC HUD lines when logged. Not your wallet balance.",
  };
  el.innerHTML = STAT_KEYS.map(
    ({ key, label }) => {
      const title = statTitles[key]
        ? ` title="${escapeHtml(statTitles[key])}"`
        : "";
      return `<div class="stat" data-stat="${key}"${title}><div class="val">${EMPTY_DISPLAY}</div><div class="lbl">${escapeHtml(label)}</div></div>`;
    }
  ).join("");
}

function tabButtonHtml(tab) {
  const selected = tab.id === activeTab;
  const icon = TAB_ICONS[tab.id] || "✦";
  const groupClass =
    tab.group === "catalog"
      ? " tab-btn-catalog"
      : tab.group === "guides"
        ? " tab-btn-guides"
        : tab.group === "wikelo"
          ? " tab-btn-wikelo"
          : " tab-btn-session";
  const metaCat = tabMetaCategory(tab.id);
  const metaClass = ` tab-btn-cat-${metaCat}`;
  return `<button type="button" class="tab-btn${groupClass}${metaClass} ${selected ? "is-active" : ""}" role="tab" id="tab-${tab.id}" data-tab="${tab.id}" aria-selected="${selected}" aria-controls="panel-${tab.id}"><span class="tab-icon" aria-hidden="true">${icon}</span><span class="tab-label">${escapeHtml(tab.label)}</span><span class="tab-count" aria-hidden="true"></span></button>`;
}

function initTabs() {
  const nav = $("tabNav");
  const panels = $("tabPanels");
  const sessionButtons = SESSION_TABS.map(tabButtonHtml).join("");
  const catalogButtons = CATALOG_TABS.map(tabButtonHtml).join("");
  const guideButtons = GUIDE_TABS.map(tabButtonHtml).join("");
  const wikeloButtons = WIKIelo_TABS.map(tabButtonHtml).join("");
  nav.innerHTML = `<div class="tabs-scroll">
    <div class="tabs-group tabs-group-session" role="presentation">
      <span class="tabs-group-label">Session</span>${sessionButtons}
    </div>
    <span class="tabs-divider" role="presentation" aria-hidden="true"></span>
    <div class="tabs-group tabs-group-catalog" role="presentation">
      <span class="tabs-group-label">Catalog</span>${catalogButtons}
    </div>
    <span class="tabs-divider" role="presentation" aria-hidden="true"></span>
    <div class="tabs-group tabs-group-guides" role="presentation">
      <span class="tabs-group-label">Intel</span>${guideButtons}
    </div>
    <span class="tabs-divider" role="presentation" aria-hidden="true"></span>
    <div class="tabs-group tabs-group-wikelo" role="presentation">
      <span class="tabs-group-label">Wikelo</span>${wikeloButtons}
    </div>
  </div>`;
  panels.innerHTML = TABS.map((t) => panelShell(t, emptyPanel(t))).join("");

  nav.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
  updateTabDescription(activeTab);
}

function scrollActiveTabIntoView() {
  /* Tabs wrap — no horizontal scroll needed. */
}

function tabBadgeCount(tabId, rollup) {
  if (!rollup) return 0;
  switch (tabId) {
    case "missions":
      return (
        rollup.completed.length +
        rollup.inProgress.length +
        rollup.failed.length +
        (rollup.abandoned?.length || 0)
      );
    case "rewards":
      return (
        (rollup.rewardEntries?.length || 0) +
        (rollup.commodityHauls?.length || 0) +
        (rollup.commodityTrades?.length || 0)
      );
    case "blueprints":
      return rollup.blueprintEntries?.length || 0;
    case "deaths":
      return rollup.deaths?.length || 0;
    case "kills":
      return rollup.kills?.length || 0;
    case "ships":
      return rollup.shipsLost?.length || 0;
    case "fines":
      return rollup.fines?.length || 0;
    case "insurance":
      return rollup.insuranceClaims?.length || 0;
    case "shopping":
      return (
        (rollup.shopPurchases?.length || 0) +
        (rollup.commodityTrades?.filter((t) => t.action === "buy").length || 0)
      );
    case "loadout":
      return rollup.loadoutSnapshots?.length || 0;
    case "history":
      return logArchiveList.length;
    case "catalog-ships":
      return catalogStats?.vehicleCount || 0;
    case "catalog-weapons":
    case "catalog-armor":
    case "catalog-ship-weapons":
    case "catalog-ship-parts":
      return catalogStats?.itemCount || 0;
    case "catalog-shops":
      return catalogStats?.shopCount || 0;
    case "catalog-ship-services":
      return catalogStats?.placeCount || 0;
    default:
      return 0;
  }
}

function updateTabCounts(rollup) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const countEl = btn.querySelector(".tab-count");
    if (!countEl) return;
    const n = tabBadgeCount(btn.dataset.tab, rollup);
    const next = n > 0 ? ` (${n})` : "";
    if (countEl.textContent !== next) countEl.textContent = next;
  });
}

function resolveTabId(id) {
  if (id === "guides-mining") {
    const state = guideQueryByTab["guides-commodities"] || {
      query: "",
      offset: 0,
      sort: "sell",
      filter: "mining",
    };
    state.filter = "mining";
    if (!state.sort || state.sort === "name") state.sort = "sell";
    guideQueryByTab["guides-commodities"] = state;
    return "guides-commodities";
  }
  return id;
}

function setActiveTab(id) {
  id = resolveTabId(id);
  if (!TABS.some((t) => t.id === id)) return;
  if (activeTab === "guides-exec-hangar" && id !== "guides-exec-hangar") {
    stopExecHangarTick();
  }
  activeTab = id;
  if (id === "history" && !archiveViewSession) {
    refreshLogArchiveList();
  }
  if (id.startsWith("catalog-")) {
    loadCatalogTab(id);
  }
  if (id.startsWith("guides-")) {
    loadGuideTab(id);
  }
  if (id.startsWith("wikelo-")) {
    loadWikeloTab(id);
  }
  if (id === "loadout") {
    refreshLoadoutPanel().then(() => {
      if (loadoutExpandKey) loadLoadoutCombat(loadoutExpandKey).catch(() => {});
    });
  }
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const on = btn.dataset.tab === id;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const on = panel.id === `panel-${id}`;
    panel.classList.toggle("is-active", on);
    if (on) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden", "");
  });
  updateTabDescription(id);
  updateQuickNavActive(id);
  scrollActiveTabIntoView();
}

function isTextField(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function searchFieldRestoreSelector(el) {
  if (!el) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.dataset?.fleetSearch) return `[data-fleet-search="${CSS.escape(el.dataset.fleetSearch)}"]`;
  if (el.dataset?.wikeloSearch) return `[data-wikelo-search="${CSS.escape(el.dataset.wikeloSearch)}"]`;
  if (el.dataset?.guideSearch) return `[data-guide-search="${CSS.escape(el.dataset.guideSearch)}"]`;
  if (el.dataset?.catalogSearch) return `[data-catalog-search="${CSS.escape(el.dataset.catalogSearch)}"]`;
  if (el.dataset?.craftingSearch) return `[data-crafting-search="${CSS.escape(el.dataset.craftingSearch)}"]`;
  return null;
}

function restorePanelFieldFocus(panel, restore) {
  if (!restore?.sel || !panel) return;
  const el = panel.querySelector(restore.sel);
  if (!el || !isTextField(el)) return;
  el.focus({ preventScroll: true });
  if (typeof el.setSelectionRange === "function" && restore.start != null) {
    try {
      const len = el.value.length;
      const start = Math.min(restore.start, len);
      const end = Math.min(restore.end ?? start, len);
      el.setSelectionRange(start, end);
    } catch {
      /* some input types disallow selection */
    }
  }
}

function setPanelHtml(tabId, html) {
  const panel = document.querySelector(`#panel-${tabId} .panel-body`);
  if (!panel) return;

  const active = document.activeElement;
  const restore =
    active && panel.contains(active) && isTextField(active)
      ? {
          sel: searchFieldRestoreSelector(active),
          start: active.selectionStart,
          end: active.selectionEnd,
        }
      : null;

  panel.innerHTML = html;
  restorePanelFieldFocus(panel, restore);
}

function deathDescription(d) {
  if (d.kind === "vehicle") {
    return d.note
      ? `Your ship was destroyed and you died before respawning. ${d.note}. Location: ${d.zone}.`
      : `You died when your ship was destroyed near ${d.zone}. No downed state recorded. Instant death from the wreck.`;
  }
  if (d.kind === "incap") {
    return d.note
      ? `Medical down: ${d.note}. You were incapacitated, recovered your gear, and respawned.`
      : "You were incapacitated, recovered your corpse gear, and respawned.";
  }
  return `Killed by ${d.killer} in ${d.zone}${d.weapon && d.weapon !== EMPTY_DISPLAY ? ` using ${d.weapon}` : ""}${d.damageType ? ` (${d.damageType})` : ""}.`;
}

function deathBadge(d) {
  if (d.kind === "vehicle") return "Ship destroyed";
  if (d.kind === "incap") return "Downed & respawned";
  return "Combat death";
}

function sumAuecFromEvents(session, { estimated = false } = {}) {
  const events = session?.events;
  if (!events?.length) return null;
  let sum = 0;
  let found = false;
  for (const e of events) {
    if (e.type !== "reward" || e.detail?.auec == null) continue;
    const isEst = !!e.detail.auecEstimated;
    if (estimated ? isEst : !isEst) {
      sum += e.detail.auec;
      found = true;
    }
  }
  return found ? sum : null;
}

function resolveAuecTotal(session, state) {
  const r = session?.rollup;
  const s = r?.stats ?? session?.stats;
  const t = r?.rewardTotals;
  const haulProfit = r?.commodityProfitTotal ?? s?.commodityProfit ?? 0;
  const confirmed =
    t?.totalAuec ?? s?.auecEarned ?? sumAuecFromEvents(session, { estimated: false }) ?? 0;
  const estimatedTotal =
    t?.totalAuecEstimated ?? s?.auecEstimated ?? sumAuecFromEvents(session, { estimated: true }) ?? 0;
  if (confirmed > 0 || estimatedTotal > 0 || haulProfit !== 0) {
    return {
      total: confirmed,
      estimated: estimatedTotal,
      haulProfit,
      combinedTotal: confirmed + haulProfit,
      source: "session",
    };
  }
  if (archiveViewSession && archiveViewMeta?.awardedAuecTotal > 0) {
    return { total: archiveViewMeta.awardedAuecTotal, haulProfit: 0, combinedTotal: archiveViewMeta.awardedAuecTotal, source: "archive-scan" };
  }
  if (!archiveViewSession && (state?.logFileAuecTotal ?? 0) > 0) {
    return { total: state.logFileAuecTotal, haulProfit: 0, combinedTotal: state.logFileAuecTotal, source: "log-scan" };
  }
  return { total: 0, estimated: 0, haulProfit: 0, combinedTotal: 0, source: "none" };
}

function renderStats(session, state = lastKnownState) {
  const statsEl = $("stats");
  if (statsEl) {
    statsEl.classList.toggle("is-live", session?.status === "active");
  }
  if (!session) {
    for (const { key } of STAT_KEYS) {
      const card = document.querySelector(`#stats [data-stat="${key}"]`);
      if (!card) continue;
      const valEl = card.querySelector(".val");
      if (valEl) {
        const idle =
          key === "contracts" ||
          key === "deaths" ||
          key === "ships" ||
          key === "kills" ||
          key === "earn" ||
          key === "auec"
            ? "0"
            : EMPTY_DISPLAY;
        if (valEl.textContent !== idle) valEl.textContent = idle;
      }
    }
    return;
  }
  const r = session.rollup;
  const s = r?.stats ?? session?.stats;
  const auecInfo = resolveAuecTotal(session, state);
  const haulProfit = auecInfo.haulProfit ?? 0;
  const combinedAuec = auecInfo.combinedTotal ?? auecInfo.total;
  const values = {
    session: r?.durationLabel ?? EMPTY_DISPLAY,
    contracts: s?.contractsCompleted ?? 0,
    deaths: s?.deaths ?? 0,
    ships: s?.vehiclesLost ?? 0,
    kills: s?.kills ?? 0,
    auec:
      auecInfo.estimated > 0 && combinedAuec > 0
        ? `${combinedAuec.toLocaleString()} + ~${auecInfo.estimated.toLocaleString()} est`
        : auecInfo.estimated > 0
          ? `~${auecInfo.estimated.toLocaleString()} est`
          : combinedAuec.toLocaleString(),
    earn: s?.rewards ?? 0,
  };
  for (const { key } of STAT_KEYS) {
    const card = document.querySelector(`#stats [data-stat="${key}"]`);
    if (!card) continue;
    const valEl = card.querySelector(".val");
    if (valEl) {
      const next = String(values[key]);
      if (valEl.textContent !== next) valEl.textContent = next;
    }
    if (key === "auec") {
      const haulNote =
        haulProfit !== 0
          ? ` Includes ${haulProfit >= 0 ? "+" : ""}${haulProfit.toLocaleString()} aUEC from ${r?.commodityHauls?.length ?? s?.commodityHauls ?? 0} cargo haul(s).`
          : "";
      const hint =
        auecInfo.source === "log-scan"
          ? `Awarded aUEC in your current Game.log (full-file scan).${haulNote} Not your wallet balance.`
          : auecInfo.source === "archive-scan"
            ? `Awarded aUEC in this log archive.${haulNote} Not your wallet balance.`
            : auecInfo.estimated > 0
              ? `Confirmed aUEC from Awarded HUD lines: ${auecInfo.total.toLocaleString()}. Estimated (not confirmed): ~${auecInfo.estimated.toLocaleString()} from wiki + rep tier.${haulNote}`
              : `Mission aUEC from Awarded HUD lines plus confirmed cargo haul profit from Game.log.${haulNote} Not your wallet balance.`;
      card.title = hint;
    }
  }
}

function buildOverview(session) {
  const r = session?.rollup;
  if (!session) {
    const jumps = [
      ["guides-loadout", "Ship builder", "Plan loadouts & DPS"],
      ["guides-trade-routes", "Trade routes", "UEX profit calculator"],
      ["guides-refinery", "Refinery", "Raw vs refined ore"],
      ["guides-fleet", "Fleet compare", "Hull & cargo stats"],
      ["guides-patch-notes", "Patch notes", "Latest Alpha patches"],
    ];
    const cards = jumps
      .map(
        ([id, title, blurb]) =>
          `<button type="button" class="welcome-card guide-tab-link" data-tab="${escapeAttr(id)}">
            <span class="welcome-card-icon" aria-hidden="true">${TAB_ICONS[id] || "✦"}</span>
            <strong>${escapeHtml(title)}</strong>
            <span class="muted small">${escapeHtml(blurb)}</span>
          </button>`
      )
      .join("");
    return `<div class="welcome-dashboard">
      <div class="welcome-hero guide-card command-hero">
        <div class="command-hero-visual" aria-hidden="true">
          <div class="radar-ring"></div>
          <div class="radar-sweep"></div>
          <div class="radar-core"></div>
        </div>
        <p class="welcome-eyebrow">Star Citizen companion</p>
        <h2 class="welcome-title">Welcome aboard, pilot</h2>
        <p class="welcome-lead">StarTracker reads your <strong>Game.log</strong> while you play — contracts, payouts, deaths, loadouts, and more. Start a session with the button above, or explore intel tools below.</p>
      </div>
      <div class="sci-fi-divider"><span>Quick launch</span></div>
      <div class="welcome-grid">${cards}</div>
    </div>`;
  }
  if (!r) {
    return `<div class="overview-scanning">
      <div class="overview-scanning-visual" aria-hidden="true"></div>
      <div>
        <p class="overview-lead" style="margin:0">Scanning Game.log…</p>
        <p class="muted small">Session is active and still gathering events. Keep playing and check back in a moment.</p>
      </div>
    </div>`;
  }

  const s = r.stats;
  const t = r.rewardTotals;
  const pilot = r.playerNick || session.playerNick || "Pilot";
  const openContracts =
    (s.contractsAccepted || 0) -
    (s.contractsCompleted || 0) -
    (s.contractsFailed || 0) -
    (s.contractsAbandoned || 0);

  const statCard = (icon, value, label, sub, tone) =>
    `<div class="overview-stat-card" data-tone="${tone}">
      <span class="overview-stat-icon" aria-hidden="true">${icon}</span>
      <span class="overview-stat-value">${value}</span>
      <span class="overview-stat-label">${escapeHtml(label)}</span>
      ${sub ? `<span class="overview-stat-sub">${sub}</span>` : ""}
    </div>`;

  const haulProfit = r.commodityProfitTotal ?? 0;
  const auecHeaderTotal = (t?.totalAuec ?? 0) + haulProfit;
  const statCards = [
    statCard(
      "◈",
      String(s.contractsCompleted),
      "Contracts done",
      openContracts > 0 ? `${openContracts} still open` : "",
      "contract"
    ),
    statCard("✕", String(s.deaths), "Deaths", `${s.kills} kill${s.kills === 1 ? "" : "s"}`, "combat"),
    statCard("✧", String(s.vehiclesLost), "Ships lost", "", "alert"),
    statCard(
      "✦",
      auecHeaderTotal.toLocaleString(),
      "aUEC earned",
      haulProfit !== 0
        ? `${haulProfit >= 0 ? "+" : ""}${haulProfit.toLocaleString()} cargo haul`
        : (t?.totalAuecEstimated ?? 0) > 0
          ? `~${t.totalAuecEstimated.toLocaleString()} estimated`
          : `${s.rewards} payout${s.rewards === 1 ? "" : "s"}`,
      "economy"
    ),
    statCard(
      "△",
      (r.finesTotal ?? 0).toLocaleString(),
      "Fines (UEC)",
      `${r.insuranceClaims?.length ?? 0} insurance claim${(r.insuranceClaims?.length ?? 0) === 1 ? "" : "s"}`,
      "alert"
    ),
    statCard(
      "◆",
      Math.round(r.shopSpendTotal ?? 0).toLocaleString(),
      "Shop spend",
      `${r.commodityTrades?.filter((t) => t.action === "buy").length ?? 0} commodity buy${(r.commodityTrades?.filter((t) => t.action === "buy").length ?? 0) === 1 ? "" : "s"} · ${r.loadoutSnapshots?.length ?? 0} loadout snap${(r.loadoutSnapshots?.length ?? 0) === 1 ? "" : "s"}`,
      "utility"
    ),
  ];

  const lines = [
    `<div class="overview-command">`,
    `<div class="overview-welcome">
      <h2>Welcome back, ${escapeHtml(pilot)}</h2>
      <p>Flight log for this session (${escapeHtml(r.durationLabel || "in progress")}). Everything below updates as you play.</p>
    </div>`,
    `<div class="sci-fi-divider"><span>Session at a glance</span></div>`,
    `<div class="overview-stat-grid">${statCards.join("")}</div>`,
  ];
  if (t?.repByFaction?.length) {
    lines.push(`<div class="sci-fi-divider"><span>Faction rep</span></div>`);
    lines.push(`<div class="overview-stat-grid">`);
    for (const { faction, rep } of t.repByFaction) {
      lines.push(
        statCard("◇", rep.toLocaleString(), escapeHtml(faction), "This session", "progress")
      );
    }
    lines.push(`</div>`);
  }
  if (r.commodityTrades?.length) {
    lines.push(`<div class="sci-fi-divider"><span>Commodity trades</span></div>`);
    lines.push(`<ul class="mini-feed commodity-trade-feed">`);
    for (const trade of [...r.commodityTrades].reverse().slice(0, 8)) {
      const actionLabel = trade.action === "sell" ? "Sold" : "Bought";
      lines.push(
        `<li><span class="muted">${fmtTime(trade.at)}</span> ` +
          `<strong>${escapeHtml(trade.commodity)}</strong> · ${trade.scu} SCU · ` +
          `${actionLabel} at ${escapeHtml(displayText(trade.shop))} · ` +
          `${Math.round(trade.priceTotal).toLocaleString()} aUEC</li>`
      );
    }
    lines.push(`</ul>`);
  }
  if (r.commodityHauls?.length) {
    lines.push(`<div class="sci-fi-divider"><span>Cargo hauls</span></div>`);
    lines.push(`<ul class="mini-feed commodity-haul-feed">`);
    for (const haul of [...r.commodityHauls].reverse().slice(0, 8)) {
      const profitClass =
        haul.profit >= 0 ? "commodity-spread-positive" : "trade-profit-loss";
      lines.push(
        `<li><span class="muted">${fmtTime(haul.sellAt || haul.at)}</span> ` +
          `<strong>${escapeHtml(haul.commodity)}</strong> · ${haul.scu} SCU · ` +
          `${escapeHtml(displayText(haul.buyShop))} → ${escapeHtml(displayText(haul.sellShop))} · ` +
          `<span class="${profitClass}">${haul.profit >= 0 ? "+" : ""}${Math.round(haul.profit).toLocaleString()} aUEC</span></li>`
      );
    }
    lines.push(`</ul>`);
  }
  if (r.quantumJumps?.length) {
    lines.push(`<div class="sci-fi-divider"><span>Quantum travel</span></div>`);
    lines.push(`<ul class="mini-feed">`);
    for (const jump of [...r.quantumJumps].reverse().slice(0, 8)) {
      lines.push(
        `<li><span class="muted">${fmtTime(jump.at)}</span> ` +
          `${escapeHtml(jump.from)} → ${escapeHtml(jump.to)}` +
          `${jump.estimatedKm ? ` · ~${Math.round(jump.estimatedKm).toLocaleString()} km` : ""}</li>`
      );
    }
    lines.push(`</ul>`);
  }
  if (r.locations?.length) {
    lines.push(`<div class="sci-fi-divider"><span>Locations visited</span></div>`);
    lines.push(`<ul class="mini-feed">`);
    for (const loc of [...r.locations].reverse().slice(0, 8)) {
      lines.push(
        `<li><span class="muted">${fmtTime(loc.at)}</span> ${escapeHtml(loc.location)}</li>`
      );
    }
    lines.push(`</ul>`);
  }
  if (r.partyEvents?.length) {
    lines.push(`<div class="sci-fi-divider"><span>Party</span></div>`);
    lines.push(`<ul class="mini-feed">`);
    for (const p of [...r.partyEvents].reverse().slice(0, 4)) {
      lines.push(
        `<li><span class="muted">${fmtTime(p.at)}</span> ${escapeHtml(p.summary)}</li>`
      );
    }
    lines.push(`</ul>`);
  }
  if (t?.itemCount > 0) {
    lines.push(
      `<p class="overview-foot muted">Item bundles: <strong>${t.itemCount}</strong> reward item${t.itemCount === 1 ? "" : "s"} (${t.itemBundles} payout${t.itemBundles === 1 ? "" : "s"})</p>`
    );
  }
  lines.push(
    `<p class="overview-foot muted">Open the tabs above for details, or use <strong>Jump to</strong> for Fleet compare, trade prices, and combat tools. Rewards uses <strong>Awarded X aUEC</strong> HUD lines when logged. This is not your wallet balance.</p>`,
    `</div>`
  );

  if (session.status === "active") {
    const recent = session.events
      .filter(
        (e) =>
          !["meta", "objective", "contract_ref", "contract_objective"].includes(
            e.type
          )
      )
      .slice(-5)
      .reverse();
    if (recent.length) {
      lines.push(`<div class="subhead">Latest activity</div>`);
      lines.push(
        `<ul class="mini-feed">${recent
          .map(
            (e) =>
              `<li><span class="muted">${fmtTime(e.at)}</span> ${displayText(e.summary)}</li>`
          )
          .join("")}</ul>`
      );
    }
  }

  return lines.join("");
}

function buildMissions(rollup) {
  if (!rollup) return emptyPanel(tabById("missions"));

  const entries = [];

  for (const c of rollup.completed) {
    const rewards =
      c.rewards.length > 0
        ? c.rewards
            .map(
              (r) =>
                `<div class="reward-block"><span class="muted small">${fmtTime(r.at)}</span>${renderRewardBreakdown(r)}</div>`
            )
            .join("")
        : `<p class="entry-extra muted">Payout not shown in session data. You may still have received aUEC, rep, or items in-game.</p>`;
    entries.push({
      sortAt: c.completedAt || c.acceptedAt,
      html: entryCard({
        time: fmtDateTime(c.completedAt || c.acceptedAt),
        badge: "Complete",
        badgeClass: "entry-good",
        title: beautifyContractTitle(c.title),
        description: "",
        extraHtml: contractMissionExtra(
          c,
          `<div class="entry-steps"><span class="step done">Started ${c.acceptedAt ? fmtTime(c.acceptedAt) : EMPTY_DISPLAY}</span><span class="step done">Complete ${fmtTime(c.completedAt)}</span></div><div class="entry-extra-label">Rewards</div>${rewards}`
        ),
      }),
    });
  }

  for (const c of rollup.inProgress) {
    entries.push({
      sortAt: c.acceptedAt,
      html: entryCard({
        time: fmtDateTime(c.acceptedAt),
        badge: "In progress",
        badgeClass: "entry-warn",
        title: beautifyContractTitle(c.title),
        description: "",
        extraHtml: contractMissionExtra(
          c,
          `<div class="entry-steps"><span class="step done">Started ${fmtTime(c.acceptedAt)}</span><span class="step pending">Complete (pending)</span></div>`
        ),
      }),
    });
  }

  for (const c of rollup.failed) {
    entries.push({
      sortAt: c.failedAt || c.acceptedAt,
      html: entryCard({
        time: fmtDateTime(c.failedAt || c.acceptedAt),
        badge: "Failed",
        badgeClass: "entry-bad",
        title: beautifyContractTitle(c.title),
        description: "",
        extraHtml: contractMissionExtra(
          c,
          `<div class="entry-steps"><span class="step done">Started ${c.acceptedAt ? fmtTime(c.acceptedAt) : EMPTY_DISPLAY}</span><span class="step bad">Failed ${fmtTime(c.failedAt)}</span></div>`
        ),
      }),
    });
  }

  for (const c of rollup.abandoned || []) {
    entries.push({
      sortAt: c.abandonedAt || c.acceptedAt,
      html: entryCard({
        time: fmtDateTime(c.abandonedAt || c.acceptedAt),
        badge: "Abandoned",
        badgeClass: "entry-warn",
        title: beautifyContractTitle(c.title),
        description: c.abandonReason
          ? `Reason: ${escapeHtml(c.abandonReason)}`
          : "",
        extraHtml: contractMissionExtra(
          c,
          `<div class="entry-steps"><span class="step done">Started ${c.acceptedAt ? fmtTime(c.acceptedAt) : EMPTY_DISPLAY}</span><span class="step pending">Abandoned ${fmtTime(c.abandonedAt)}</span></div>`
        ),
      }),
    });
  }

  if (!entries.length) return emptyPanel(tabById("missions"));

  entries.sort((a, b) => new Date(b.sortAt) - new Date(a.sortAt));
  return entries.map((e) => e.html).join("");
}

function buildCommodityHaulRows(hauls) {
  return hauls
    .slice()
    .reverse()
    .map((haul) => {
      const profitClass =
        haul.profit >= 0 ? "commodity-spread-positive" : "trade-profit-loss";
      const profitLabel = `${haul.profit >= 0 ? "+" : ""}${Math.round(haul.profit).toLocaleString()} aUEC`;
      return entryCard({
        time: fmtDateTime(haul.sellAt || haul.at),
        badge: "Haul",
        badgeClass: haul.profit >= 0 ? "entry-good" : "entry-warn",
        title: haul.commodity,
        description: `${haul.scu} SCU · ${displayText(haul.buyShop)} → ${displayText(haul.sellShop)}`,
        extraHtml: `<p class="entry-extra"><span class="${profitClass}"><strong>${profitLabel}</strong></span> · bought ${fmtTime(haul.buyAt)} · sold ${fmtTime(haul.sellAt || haul.at)}</p>`,
      });
    })
    .join("");
}

function buildCommodityTradeRows(trades) {
  return trades
    .slice()
    .reverse()
    .map((trade) => {
      const isBuy = trade.action === "buy";
      return entryCard({
        time: fmtDateTime(trade.at),
        badge: isBuy ? "Cargo buy" : "Cargo sell",
        badgeClass: isBuy ? "entry-warn" : "entry-good",
        title: trade.commodity,
        description: `${trade.scu} SCU at ${displayText(trade.shop)} · ${Math.round(trade.priceTotal).toLocaleString()} aUEC`,
        extraHtml: isBuy
          ? `<p class="entry-extra muted">${Math.round(trade.unitPrice).toLocaleString()} aUEC per SCU · commodity terminal purchase</p>`
          : `<p class="entry-extra muted">${Math.round(trade.unitPrice).toLocaleString()} aUEC per SCU · commodity terminal sale</p>`,
      });
    })
    .join("");
}

function buildCommodityOpenSummary(lots) {
  if (!lots?.length) return "";
  const lines = lots.map(
    (lot) =>
      `${lot.scuRemaining} SCU ${lot.commodity} at ${displayText(lot.shop)}`
  );
  return `<p class="panel-summary muted">Open cargo: <strong>${lines.join(" · ")}</strong></p>`;
}

function buildRewards(rollup) {
  if (!rollup) return emptyPanel(tabById("rewards"));
  const entries = rollup.rewardEntries || [];
  const hauls = rollup.commodityHauls || [];
  const trades = rollup.commodityTrades || [];
  const openLots = rollup.commodityOpenLots || [];
  const haulProfit = rollup.commodityProfitTotal ?? 0;
  const commoditySpend = rollup.commoditySpendTotal ?? 0;
  if (!entries.length && !hauls.length && !trades.length) return emptyPanel(tabById("rewards"));

  const t = rollup.rewardTotals || {};
  const parts = [];
  const totals = [];

  if (t.totalAuec > 0) {
    totals.push(
      `<div class="reward-total-card"><span class="reward-lbl">aUEC confirmed</span><span class="reward-total-val">${t.totalAuec.toLocaleString()}</span></div>`
    );
  }
  if (commoditySpend > 0) {
    totals.push(
      `<div class="reward-total-card"><span class="reward-lbl">Commodity spend</span><span class="reward-total-val">${Math.round(commoditySpend).toLocaleString()}</span></div>`
    );
  }
  if (haulProfit !== 0) {
    totals.push(
      `<div class="reward-total-card"><span class="reward-lbl">Cargo haul profit</span><span class="reward-total-val ${haulProfit >= 0 ? "commodity-spread-positive" : "trade-profit-loss"}">${haulProfit >= 0 ? "+" : ""}${Math.round(haulProfit).toLocaleString()}</span></div>`
    );
  }
  if (t.totalAuec > 0 && haulProfit !== 0) {
    totals.push(
      `<div class="reward-total-card"><span class="reward-lbl">aUEC + hauls</span><span class="reward-total-val">${(t.totalAuec + haulProfit).toLocaleString()}</span></div>`
    );
  }
  if (t.totalAuecEstimated > 0) {
    totals.push(
      `<div class="reward-total-card"><span class="reward-lbl">aUEC estimated</span><span class="reward-total-val">~${t.totalAuecEstimated.toLocaleString()}</span></div>`
    );
  }
  if (t.repByFaction?.length) {
    for (const { faction, rep } of t.repByFaction) {
      totals.push(
        `<div class="reward-total-card"><span class="reward-lbl">${escapeHtml(faction)}</span><span class="reward-total-val">${rep.toLocaleString()} rep</span></div>`
      );
    }
  }
  if (t.itemCount > 0) {
    totals.push(
      `<div class="reward-total-card"><span class="reward-lbl">Item bundles</span><span class="reward-total-val">${t.itemCount} items</span></div>`
    );
  }
  if (totals.length) {
    parts.push(`<div class="reward-totals">${totals.join("")}</div>`);
  }

  if (entries.length) {
    parts.push(`<div class="subhead">By payout</div>`);
  }

  parts.push(
    entries
      .slice()
      .reverse()
      .map((r) => {
        const title = r.contractTitle
          ? r.contractTitle
          : r.linkedFromRecentContract
            ? "Linked to last completed contract"
            : "Session reward";
        const isEst = !!r.auecEstimated;
        return entryCard({
          time: fmtDateTime(r.at),
          badge: isEst ? "Est." : r.kind === "auec" ? "Currency" : r.kind === "reputation" ? "Rep" : "Items",
          badgeClass: isEst ? "entry-warn" : "entry-good",
          title,
          description: isEst
            ? `Estimated payout from wiki + rep tier. Not confirmed in Game.log.`
            : r.contractTitle
              ? `Payout after completing this contract.`
              : `Reward popup (couldn't match to a specific contract).`,
          extraHtml: renderRewardBreakdown(r),
        });
      })
      .join("")
  );

  if (openLots.length) {
    parts.push(buildCommodityOpenSummary(openLots));
  }

  if (trades.length) {
    parts.push(`<div class="subhead">Commodity terminal</div>`);
    parts.push(buildCommodityTradeRows(trades));
  }

  if (hauls.length) {
    parts.push(`<div class="subhead">Cargo hauls</div>`);
    parts.push(buildCommodityHaulRows(hauls));
  }

  return parts.join("");
}

function buildBlueprints(rollup) {
  if (!rollup) return emptyPanel(tabById("blueprints"));
  const entries = rollup.blueprintEntries || [];
  if (!entries.length) return emptyPanel(tabById("blueprints"));

  return entries
    .slice()
    .reverse()
    .map((bp) => {
      const unnamed = bp.name === "Blueprint (name not in log)";
      return entryCard({
        time: fmtDateTime(bp.at),
        badge: "Blueprint",
        badgeClass: "entry-good",
        title: beautifyContractTitle(bp.name),
        description: bp.contractTitle
          ? `Unlocked from ${beautifyContractTitle(bp.contractTitle)}.`
          : "Blueprint line from Game.log (contract not matched).",
        extraHtml:
          unnamed && bp.summary
            ? `<p class="entry-extra muted">${displayText(bp.summary)}</p>`
            : "",
      });
    })
    .join("");
}

function buildDeaths(rollup) {
  if (!rollup?.deaths?.length) return emptyPanel(tabById("deaths"));
  return rollup.deaths
    .slice()
    .reverse()
    .map((d) =>
      entryCard({
        time: fmtDateTime(d.at),
        badge: deathBadge(d),
        badgeClass: "entry-bad",
        title: d.kind === "kill" ? `Killed by ${d.killer}` : "You died",
        description: deathDescription(d),
        extraHtml:
          d.note && d.kind !== "incap"
            ? `<p class="entry-extra muted">${displayText(d.note)}</p>`
            : d.note
              ? `<p class="entry-extra muted">${displayText(d.note)}</p>`
              : "",
      })
    )
    .join("");
}

function buildKills(rollup) {
  if (!rollup?.kills?.length) return emptyPanel(tabById("kills"));
  return rollup.kills
    .slice()
    .reverse()
    .map((k) => {
      const isBounty = k.kind === "pvp_bounty";
      return entryCard({
        time: fmtDateTime(k.at),
        badge: isBounty ? "PvP bounty" : "Kill",
        badgeClass: "entry-good",
        title: isBounty ? `Neutralized ${k.victim}` : `Killed ${k.victim}`,
        description: isBounty
          ? `Bounty complete. You neutralized the bounty target.`
          : `Kill recorded${k.zone && k.zone !== EMPTY_DISPLAY ? ` near ${k.zone}` : ""}.`,
        extraHtml:
          k.contractTitle || (k.weapon && k.weapon !== EMPTY_DISPLAY && k.weapon !== "Unknown")
            ? `<div class="entry-extra">${k.contractTitle ? `<div class="detail-line">${displayText(k.contractTitle.replace(/:\s*$/, ""))}</div>` : ""}${k.weapon && k.weapon !== EMPTY_DISPLAY ? `<div class="detail-line">Weapon: ${displayText(k.weapon)}</div>` : ""}</div>`
            : "",
      });
    })
    .join("");
}

function buildShips(rollup) {
  if (!rollup?.shipsLost?.length) return emptyPanel(tabById("ships"));
  return rollup.shipsLost
    .slice()
    .reverse()
    .map((s) => {
      const destroyed =
        s.method === "fatal_collision"
          ? "Your ship was destroyed after a fatal collision while you were the pilot."
          : s.method === "planet_kill"
            ? "Your ship crossed the planet kill boundary and was destroyed."
            : s.method === "destroy_level"
              ? "Your ship's hull was destroyed."
              : "Your ship was destroyed.";
      const ownership = s.ownershipNote
        ? s.ownershipNote
        : "We linked this hull to you before it was destroyed.";
      return entryCard({
        time: fmtDateTime(s.at),
        badge: "Your ship destroyed",
        badgeClass: "entry-warn",
        title: s.ship,
        description: `${destroyed} Location: ${s.zone}. ${s.cause}.`,
        extraHtml: `<p class="entry-extra muted"><strong>Why counted as yours:</strong> ${displayText(ownership)}</p>`,
      });
    })
    .join("");
}

function formatArchiveSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildHistoryArchives() {
  const tab = tabById("history");
  if (logArchiveLoading) {
    return `<div class="overview-prose"><p>Scanning logbackups since 4.8 (incl. 4.9)…</p></div>`;
  }
  if (logArchiveError) {
    return `<div class="overview-prose"><p class="entry-warn">Could not scan log archives: ${escapeHtml(logArchiveError)}</p></div>`;
  }
  if (!logArchiveList.length) return emptyPanel(tab);
  return `<div class="archive-list">${logArchiveList
    .map((a, idx) => {
      const kind =
        a.kind === "live" ? "Live" : a.build ? `Build ${a.build}` : "Backup";
      const auecLabel =
        (a.awardedAuecTotal ?? 0) > 0
          ? `${Number(a.awardedAuecTotal).toLocaleString()} aUEC`
          : "No Awarded aUEC";
      return `<button type="button" class="archive-row" data-archive-idx="${idx}">
        <span class="archive-row-main">
          <strong>${escapeHtml(a.label)}</strong>
          <span class="muted">${escapeHtml(kind)} · ${escapeHtml(formatArchiveSize(a.sizeBytes))} · ${escapeHtml(auecLabel)}</span>
        </span>
        <span class="archive-row-meta muted">${escapeHtml(fmtDateTime(a.mtime))}</span>
      </button>`;
    })
    .join("")}</div>
    <p class="overview-foot muted">Click a row to load that log. aUEC shown is from Awarded popups in that file. Recent logs may show 0 if you did not earn contract payouts that session.</p>`;
}

function buildFines(rollup) {
  if (!rollup?.fines?.length) return emptyPanel(tabById("fines"));
  const total = rollup.finesTotal ?? 0;
  const head = `<p class="panel-summary">Total fined: <strong>${total.toLocaleString()} UEC</strong></p>`;
  const rows = rollup.fines
    .slice()
    .reverse()
    .map((f) =>
      entryCard({
        time: fmtDateTime(f.at),
        badge: "Fine",
        badgeClass: "entry-warn",
        title: `${f.amount.toLocaleString()} ${f.currency || "UEC"}`,
        description: "Monitored-space or CrimeStat fine popup from Game.log.",
      })
    )
    .join("");
  return head + rows;
}

function buildInsurance(rollup) {
  if (!rollup?.insuranceClaims?.length) return emptyPanel(tabById("insurance"));
  return rollup.insuranceClaims
    .slice()
    .reverse()
    .map((c) => {
      const ship = c.shipName || null;
      const title = ship ? ship : "Insurance claim completed";
      const bits = ["Hull respawned at station."];
      if (c.location) bits.push(`Location: ${c.location}.`);
      if (c.verified) {
        bits.push("Name verified from Star Citizen game data.");
      } else if (!ship) {
        bits.push(
          "Ship name was not in this log line. Game.log usually only logs an entitlement ID for claims."
        );
      } else {
        bits.push("Name estimated from log text (not yet verified online).");
      }
      return entryCard({
        time: fmtDateTime(c.at),
        badge: "Claim",
        badgeClass: "",
        title,
        description: bits.join(" "),
      });
    })
    .join("");
}

function buildShopping(rollup) {
  const shopRows = rollup?.shopPurchases || [];
  const commodityBuys = (rollup?.commodityTrades || []).filter((t) => t.action === "buy");
  if (!shopRows.length && !commodityBuys.length) return emptyPanel(tabById("shopping"));

  const parts = [];
  const shopTotal = Math.round(rollup.shopSpendTotal ?? 0);
  const commodityTotal = Math.round(rollup.commoditySpendTotal ?? 0);

  if (shopRows.length) {
    parts.push(
      `<p class="panel-summary">Shop spend logged: <strong>${shopTotal.toLocaleString()} aUEC</strong></p>`
    );
    parts.push(
      shopRows
        .slice()
        .reverse()
        .map((p) => {
          const badge =
            p.category === "ship"
              ? "Ship"
              : p.category === "equipment"
                ? "Equipment"
                : "Purchase";
          const qty = p.quantity > 1 ? ` · Qty ${p.quantity}` : "";
          const verifyNote = p.verified
            ? "Verified from Star Citizen game data."
            : "Name estimated until looked up online.";
          return entryCard({
            time: fmtDateTime(p.at),
            badge,
            badgeClass: "",
            title: p.item,
            description: `${Math.round(p.price).toLocaleString()} aUEC at ${displayText(p.shop)}${qty}. ${verifyNote}`,
          });
        })
        .join("")
    );
  }

  if (commodityBuys.length) {
    parts.push(
      `<p class="panel-summary">Commodity terminal spend: <strong>${commodityTotal.toLocaleString()} aUEC</strong></p>`
    );
    parts.push(buildCommodityTradeRows(commodityBuys));
  }

  return parts.join("");
}

function isLoadoutCombatGear(item) {
  const cat = item.category || "item";
  const cn = String(item.className || "").toLowerCase();
  const port = String(item.port || "").toLowerCase();
  if (cat === "cosmetic") return false;
  if (cat === "medical" || cat === "consumable") return false;
  if (/food|drink|hydrat|nutrition|meal|snack|beverage|alcohol|consumable_healing|consumable_med|medpen|med_pen|oxy_pen|oxygen/.test(cn)) {
    return false;
  }
  if (/facial_hair|pcg_|piercing|eyebrow|eyelash|teeth_|hair_|legacy_mobiglas|mobiglas|visor/.test(cn)) {
    return false;
  }
  if (/facial_hair|pcg_|hair_|eyebrow|mobiglas|visor/.test(port)) return false;
  if (cat === "weapon" || cat === "armor") return true;
  if (cat === "utility" && /multitool|grenade|tractor/i.test(cn)) return true;
  if (/grenade|frag_01|flashbang|ksar_gren/.test(cn)) return true;
  if (cat === "attachment" && /magazine|mag_attach/i.test(port)) return false;
  return false;
}

function loadoutCombatGroupKind(row) {
  const kind = row.combat?.kind;
  if (kind === "fps_weapon" || kind === "ship_weapon") return "weapon";
  if (kind === "armor") return "armor";
  return "other";
}

function ensureLoadoutSelection(rollup) {
  const snaps = rollup?.loadoutSnapshots?.slice().reverse() || [];
  if (!snaps.length) return null;
  const valid = snaps.some((s, i) => loadoutSnapshotKey(s, i) === loadoutExpandKey);
  if (!loadoutExpandKey || !valid) {
    loadoutExpandKey = loadoutSnapshotKey(snaps[0], 0);
  }
  return loadoutExpandKey;
}

function loadoutHiddenNote(snap) {
  const items = snap.items || [];
  if (!items.length) return "";
  const combatN = items.filter(isLoadoutCombatGear).length;
  const hiddenN = items.length - combatN;
  if (hiddenN <= 0) return "";
  return `<p class="muted small loadout-hidden-note">${hiddenN} food, drink, medical, cosmetic, and misc item${hiddenN === 1 ? "" : "s"} hidden.</p>`;
}

function capitalizeSlotLabel(label) {
  return String(label || "Slot")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (w.length <= 4 && w === w.toUpperCase()) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

function loadoutGearDisplayName(item) {
  const label = item.label ? String(item.label).trim() : "";
  const raw = item.className ? String(item.className).trim() : "";
  if (label && (!raw || label.toLowerCase() !== raw.toLowerCase())) {
    return displayText(label);
  }
  return displayText(label || raw || "?");
}

function loadoutSnapshotKey(snap, index) {
  return String(snap.at || index);
}

function findLoadoutSnapshot(key) {
  const rollup = getViewRollup(lastKnownState);
  const snaps = (rollup?.loadoutSnapshots || []).slice().reverse();
  return snaps.find((s, i) => loadoutSnapshotKey(s, i) === key) || null;
}

function renderLoadoutCombatStatStack(profile) {
  if (!profile?.stats?.length) return "";
  return `<div class="loadout-combat-stat-stack">${profile.stats
    .map(
      (s) => `<div class="loadout-stat-box${s.highlight ? " is-primary" : ""}">
        <span class="loadout-stat-label">${escapeHtml(String(s.label).toUpperCase())}</span>
        <span class="loadout-stat-value">${escapeHtml(String(s.value))}</span>
      </div>`
    )
    .join("")}</div>`;
}

function renderLoadoutCombatCard(row) {
  const kind = combatKindLabel(row.combat.kind);
  const slot = capitalizeSlotLabel(row.slotLabel || row.port || "Gear");
  const slotLine = kind ? `${kind} · ${slot}` : slot;
  return `<article class="combat-loadout-card">
    <header class="combat-loadout-card-head">
      <div class="combat-loadout-card-titles">
        <h4 class="combat-loadout-name">${loadoutGearDisplayName(row)}</h4>
        <p class="combat-loadout-slot muted small">${escapeHtml(slotLine)}</p>
      </div>
      <span class="combat-kind-badge">${escapeHtml(kind.toUpperCase() || "GEAR")}</span>
    </header>
    ${renderLoadoutCombatStatStack(row.combat.profile)}
  </article>`;
}

function renderLoadoutCombatSummary(items) {
  if (!items?.length) {
    return `<p class="muted small">No weapons or armor in this snapshot.</p>`;
  }
  const withStats = items.filter(
    (row) => row.combat?.headline || row.combat?.profile?.stats?.length
  );
  if (!withStats.length) {
    return `<p class="muted small">No wiki combat stats for equipped weapons and armor.</p>`;
  }

  const groups = { weapon: [], armor: [] };
  for (const row of withStats) {
    const kind = loadoutCombatGroupKind(row);
    if (kind === "weapon" || kind === "armor") groups[kind].push(row);
  }

  const sectionDefs = [
    ["weapon", "Weapons"],
    ["armor", "Armor"],
  ];

  return sectionDefs
    .filter(([key]) => groups[key].length)
    .map(
      ([key, title]) => `<section class="loadout-category-open">
        <h3 class="loadout-category-title">${escapeHtml(title)}</h3>
        <div class="loadout-combat-row">${groups[key].map(renderLoadoutCombatCard).join("")}</div>
      </section>`
    )
    .join("");
}

function renderLoadoutCombatPanel(snap, key) {
  if (loadoutCombatLoadingKey === key) {
    return `<p class="muted small loadout-combat-loading">Loading combat stats…</p>`;
  }
  const combatItems = loadoutCombatByKey[key];
  if (combatItems === undefined) {
    return `<p class="muted small loadout-combat-loading">Loading combat stats…</p>`;
  }
  return `${renderLoadoutCombatSummary(combatItems)}${loadoutHiddenNote(snap)}`;
}

function buildLoadout(rollup) {
  if (!rollup?.loadoutSnapshots?.length) return emptyPanel(tabById("loadout"));
  const snaps = rollup.loadoutSnapshots.slice().reverse();
  ensureLoadoutSelection(rollup);
  const activeKey = loadoutExpandKey;
  const activeSnap = findLoadoutSnapshot(activeKey);

  const chips = snaps
    .map((snap, i) => {
      const key = loadoutSnapshotKey(snap, i);
      const badge =
        snap.reason === "gear_change"
          ? "Gear change"
          : snap.reason === "spawn"
            ? "Spawn"
            : "Loadout";
      const combatN = (snap.items || []).filter(isLoadoutCombatGear).length;
      return `<button type="button" class="loadout-snap-chip${key === activeKey ? " is-active" : ""}" data-loadout-snap="${escapeAttr(key)}">
        <time class="loadout-snap-time">${escapeHtml(fmtDateTime(snap.at))}</time>
        <span class="entry-badge loadout-snap-badge">${escapeHtml(badge)}</span>
        <span class="muted small">${combatN} combat item${combatN === 1 ? "" : "s"}</span>
      </button>`;
    })
    .join("");

  const body = activeSnap
    ? `<div class="loadout-combat-panel">${renderLoadoutCombatPanel(activeSnap, activeKey)}</div>`
    : "";

  return `<div class="loadout-panel">
    <header class="loadout-panel-head">
      <span class="loadout-panel-icon" aria-hidden="true">${TAB_ICONS.loadout}</span>
      <div>
        <h2 class="loadout-panel-title">Loadout</h2>
        <p class="muted small">Weapons and armor combat stats from spawn and gear changes. Pick a snapshot chip to compare loadouts.</p>
      </div>
    </header>
    <div class="loadout-snap-strip">${chips}</div>
    ${body}
  </div>`;
}

async function refreshLoadoutPanel() {
  const rollup = getViewRollup(lastKnownState);
  setPanelHtml("loadout", buildLoadout(rollup));
}

async function loadLoadoutCombat(key) {
  const snap = findLoadoutSnapshot(key);
  if (!snap) return;
  if (loadoutCombatByKey[key] !== undefined) return;

  const gear = (snap.items || []).filter(isLoadoutCombatGear);
  if (!gear.length) {
    loadoutCombatByKey[key] = [];
    await refreshLoadoutPanel();
    return;
  }

  loadoutCombatLoadingKey = key;
  await refreshLoadoutPanel();
  try {
    const result = await window.debrief.combatGetLoadoutSummary(
      gear.map((i) => ({
        port: i.port,
        slotLabel: i.slotLabel,
        className: i.className,
        label: i.label,
        category: i.category,
      }))
    );
    loadoutCombatByKey[key] = (result.items || []).filter(isLoadoutCombatGear);
  } catch {
    loadoutCombatByKey[key] = [];
  } finally {
    loadoutCombatLoadingKey = null;
    if (loadoutExpandKey === key) await refreshLoadoutPanel();
  }
}

async function selectLoadoutSnapshot(key) {
  if (loadoutExpandKey !== key) {
    loadoutExpandKey = key;
  }
  await refreshLoadoutPanel();
  await loadLoadoutCombat(key);
}

async function refreshLogArchiveList() {
  logArchiveLoading = true;
  logArchiveError = null;
  if (activeTab === "history") {
    setPanelHtml("history", buildHistoryArchives());
  }
  try {
    const result = await window.debrief.listLogArchives();
    if (result && typeof result === "object" && "ok" in result) {
      if (result.ok) {
        logArchiveList = result.archives || [];
      } else {
        logArchiveList = [];
        logArchiveError = result.error || "Failed to scan log archives.";
      }
    } else {
      logArchiveList = result || [];
    }
  } catch (e) {
    logArchiveList = [];
    logArchiveError = e.message || String(e);
  } finally {
    logArchiveLoading = false;
    try {
      updateTabCounts(getViewRollup(lastKnownState));
    } catch {
      updateTabCounts(getViewRollup(null));
    }
    if (activeTab === "history" && !archiveViewSession) {
      setPanelHtml("history", buildHistoryArchives());
    }
  }
}

async function openLogArchive(archiveId, archiveMeta = null) {
  const status = $("statusLine");
  const prev = status?.textContent || "";
  if (status) status.textContent = "Parsing log archive…";
  try {
    const result = await window.debrief.parseLogArchive(archiveId);
    if (!result.ok) {
      if (status) status.textContent = `Error: ${result.error}`;
      return;
    }
    archiveViewSession = result.session;
    archiveViewMeta = {
      ...(result.archive || {}),
      ...(archiveMeta || {}),
      awardedAuecTotal:
        archiveMeta?.awardedAuecTotal ??
        result.archive?.awardedAuecTotal ??
        0,
    };
    renderArchiveBanner();
    setActiveTab("overview");
    renderAllPanels(null);
    if (status) {
      status.textContent = `Viewing archive: ${archiveViewMeta.label}`;
    }
  } catch (e) {
    if (status) status.textContent = `Error: ${e.message || e}`;
  }
}

function clearArchiveView() {
  archiveViewSession = null;
  archiveViewMeta = null;
  renderArchiveBanner();
  if (activeTab === "history") {
    setPanelHtml("history", buildHistoryArchives());
  }
}

function renderArchiveBanner() {
  const banner = $("archiveBanner");
  const text = $("archiveBannerText");
  if (!banner || !text) return;
  if (!archiveViewSession || !archiveViewMeta) {
    banner.classList.add("hidden");
    return;
  }
  text.textContent = `Viewing log archive: ${archiveViewMeta.label}. Other tabs show parsed data from this file.`;
  banner.classList.remove("hidden");
}

function getViewSession(state) {
  if (archiveViewSession) return archiveViewSession;
  if (!state) return lastDisplaySession;
  return resolveDisplaySession(state);
}

function getViewRollup(state) {
  return getViewSession(state)?.rollup || archiveViewSession?.rollup || null;
}

function fmtAuec(n) {
  if (n == null || n <= 0) return EMPTY_DISPLAY;
  return `${Number(n).toLocaleString()} aUEC`;
}

function catalogMetaLine() {
  if (!catalogStats?.syncedAt) {
    return `<p class="catalog-meta muted small">Catalog not synced yet. Prices from UEX and Star Citizen Wiki.</p>`;
  }
  const when = fmtDateTime(catalogStats.syncedAt);
  const counts = [
    catalogStats.vehicleCount ? `${catalogStats.vehicleCount} ships` : null,
    catalogStats.itemCount ? `${catalogStats.itemCount} items` : null,
    catalogStats.shopCount ? `${catalogStats.shopCount} shops` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `<p class="catalog-meta muted small">Last synced ${escapeHtml(when)}. ${escapeHtml(counts)}.${catalogSyncMessage ? ` ${escapeHtml(catalogSyncMessage)}` : ""}</p>`;
}

function catalogToolbar(tabId) {
  const q = catalogQueryByTab[tabId]?.query || "";
  const busy = catalogSyncBusy ? " disabled" : "";
  const searchPlaceholder =
    tabId === "catalog-ship-services"
      ? "Search system, planet, station, city…"
      : "Search name, class, manufacturer, location…";
  return `<div class="catalog-toolbar">
    <input type="search" class="catalog-search" data-catalog-search="${escapeAttr(tabId)}" placeholder="${searchPlaceholder}" value="${escapeAttr(q)}" />
    <button type="button" class="btn btn-sm btn-ghost" data-catalog-search-btn="${escapeAttr(tabId)}">Search</button>
    <button type="button" class="btn btn-sm" data-catalog-refresh${busy}>Refresh catalog</button>
  </div>`;
}

function listingSummary(listings) {
  if (!listings?.length) return EMPTY_DISPLAY;
  const prices = listings.map((l) => l.priceBuy).filter((p) => p > 0);
  const min = prices.length ? Math.min(...prices) : null;
  const loc = listings[0]?.location || listings[0]?.terminal || "";
  const more = listings.length > 1 ? ` (+${listings.length - 1})` : "";
  return `${fmtAuec(min)} @ ${sanitizeDisplayText(loc)}${more}`;
}

function expandableRowClass(host, key) {
  return `expandable-row${isInlineExpanded(host, key) ? " is-expanded" : ""}`;
}

function renderCatalogItemRows(rows, tabId) {
  if (!rows.length) return emptyPanel(tabById(tabId));
  const host = INLINE_HOST.CATALOG;
  const colspan = 6;
  return `<div class="catalog-table-wrap"><table class="catalog-table">
    <thead><tr>
      <th></th><th>Item</th><th>Type</th><th>Manufacturer</th><th>Best price</th><th>Combat</th><th>Shop / location</th>
    </tr></thead>
    <tbody>${rows
      .map((row) => {
        const key = row.className || row.slug || `uex:${row.uexId}` || row.name;
        const listings = row.listings || [];
        const prices = listings.map((l) => l.priceBuy).filter((p) => p > 0);
        const min = prices.length ? Math.min(...prices) : null;
        const first = listings[0];
        const loc = first
          ? `${first.terminal || ""}${first.location ? `, ${first.location}` : ""}`
          : EMPTY_DISPLAY;
        const expanded = isInlineExpanded(host, key);
        return `<tr class="catalog-row ${expandableRowClass(host, key)}" data-catalog-item="${escapeAttr(key)}" data-catalog-kind="item" tabindex="0" role="button" aria-expanded="${expanded}">
          <td class="expand-chevron-cell"><span class="expand-chevron" aria-hidden="true">${expandChevron(host, key)}</span></td>
          <td>${displayText(row.name)}${row.className ? `<div class="muted small mono">${escapeHtml(row.className)}</div>` : ""}</td>
          <td>${displayText(row.category || row.section || "")}</td>
          <td>${displayText(row.manufacturer || "")}</td>
          <td>${escapeHtml(fmtAuec(min))}</td>
          <td class="muted small">Expand for DPS / DR</td>
          <td>${displayText(loc)}${listings.length > 1 ? ` <span class="muted small">(+${listings.length - 1})</span>` : ""}</td>
        </tr>${renderInlineDetailRow(colspan + 1, host, key)}`;
      })
      .join("")}</tbody></table></div>`;
}

function renderCatalogShipRows(rows) {
  if (!rows.length) return emptyPanel(tabById("catalog-ships"));
  const host = INLINE_HOST.CATALOG;
  const colspan = 11;
  return `<div class="catalog-table-wrap"><table class="catalog-table fleet-compare-table">
    <thead><tr>
      <th></th><th>Ship</th><th>Manufacturer</th><th>Hull</th><th>Shield</th><th>SCM</th><th>Cargo</th><th>Mass</th><th>Crew</th><th>Buy / rent</th><th>Location</th>
    </tr></thead>
    <tbody>${rows
      .map((row) => {
        const key = row.className || row.slug;
        const listings = row.listings || [];
        const buy = listings.find((l) => l.priceBuy > 0);
        const rent = listings.find((l) => l.priceRent > 0);
        const priceBits = [
          buy ? fmtAuec(buy.priceBuy) : null,
          rent ? `${fmtAuec(rent.priceRent)} rent` : null,
        ].filter(Boolean);
        const first = buy || rent || listings[0];
        const loc = first
          ? `${first.terminal || ""}${first.location ? `, ${first.location}` : ""}`
          : EMPTY_DISPLAY;
        const expanded = isInlineExpanded(host, key);
        return `<tr class="catalog-row ${expandableRowClass(host, key)}" data-catalog-item="${escapeAttr(key)}" data-catalog-kind="vehicle" tabindex="0" role="button" aria-expanded="${expanded}">
          <td class="expand-chevron-cell"><span class="expand-chevron" aria-hidden="true">${expandChevron(host, key)}</span></td>
          <td>${displayText(row.name)}<div class="muted small mono">${escapeHtml(row.className || "")}</div></td>
          <td>${displayText(row.manufacturer || "")}</td>
          <td>${formatFleetCell(row.hullHp)}</td>
          <td>${formatFleetCell(row.shieldHp)}</td>
          <td>${formatFleetCell(row.scm)}</td>
          <td>${row.cargo != null ? `${row.cargo} SCU` : formatFleetCell(row.cargo)}</td>
          <td>${formatFleetCell(row.mass)}</td>
          <td>${row.crew != null ? String(row.crew) : EMPTY_DISPLAY}</td>
          <td>${escapeHtml(priceBits.join(" / ") || EMPTY_DISPLAY)}</td>
          <td>${displayText(loc)}</td>
        </tr>${renderInlineDetailRow(colspan, host, key)}`;
      })
      .join("")}</tbody></table></div>`;
}

function renderServiceChips(services) {
  if (!services) return `<span class="muted">—</span>`;
  const chips = [];
  if (services.refuel) chips.push(`<span class="service-chip service-refuel">Refuel</span>`);
  if (services.repair) chips.push(`<span class="service-chip service-repair">Repair</span>`);
  if (services.shipAmmo) chips.push(`<span class="service-chip service-ammo">Ammo</span>`);
  return chips.length ? chips.join(" ") : `<span class="muted">—</span>`;
}

function renderCatalogShipServiceRows(rows) {
  if (!rows.length) return emptyPanel(tabById("catalog-ship-services"));
  const host = INLINE_HOST.CATALOG;
  const colspan = 5;
  let body = "";
  let lastSystem = null;
  for (const row of rows) {
    if (row.system !== lastSystem) {
      lastSystem = row.system;
      body += `<tr class="catalog-system-row"><td colspan="${colspan}"><span class="catalog-system-label">${displayText(row.system || "Unknown system")}</span></td></tr>`;
    }
    const key = row.key;
    const expanded = isInlineExpanded(host, key);
    body += `<tr class="catalog-row ${expandableRowClass(host, key)}" data-catalog-place="${escapeAttr(key)}" data-catalog-kind="place" tabindex="0" role="button" aria-expanded="${expanded}">
      <td class="expand-chevron-cell"><span class="expand-chevron" aria-hidden="true">${expandChevron(host, key)}</span></td>
      <td>${displayText(row.name)}</td>
      <td class="muted small">${displayText(row.location || "")}</td>
      <td>${displayText(row.kind || "")}</td>
      <td class="ship-service-chips">${renderServiceChips(row.services)}</td>
    </tr>${renderInlineDetailRow(colspan, host, key)}`;
  }
  return `<div class="catalog-table-wrap"><table class="catalog-table catalog-ship-services-table">
    <thead><tr><th></th><th>Place</th><th>Location</th><th>Type</th><th>Services</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

function renderCatalogShopRows(rows) {
  if (!rows.length) return emptyPanel(tabById("catalog-shops"));
  const host = INLINE_HOST.CATALOG;
  const colspan = 5;
  return `<div class="catalog-table-wrap"><table class="catalog-table">
    <thead><tr><th></th><th>Shop</th><th>Location</th><th>System</th><th>Items listed</th></tr></thead>
    <tbody>${rows
      .map((row) => {
        const key = String(row.terminalId || row.terminal);
        const expanded = isInlineExpanded(host, key);
        return `<tr class="catalog-row ${expandableRowClass(host, key)}" data-catalog-shop="${escapeAttr(key)}" data-catalog-kind="shop" tabindex="0" role="button" aria-expanded="${expanded}">
          <td class="expand-chevron-cell"><span class="expand-chevron" aria-hidden="true">${expandChevron(host, key)}</span></td>
          <td>${displayText(row.terminal || row.terminalCode || "Shop")}</td>
          <td>${displayText(row.location || "")}</td>
          <td>${displayText(row.system || "")}</td>
          <td>${row.items?.length || 0}</td>
        </tr>${renderInlineDetailRow(colspan, host, key)}`;
      })
      .join("")}</tbody></table></div>`;
}

function renderCatalogPager(tabId, result) {
  if (!result || result.total <= result.limit) return "";
  const prevDisabled = result.offset <= 0 ? " disabled" : "";
  const nextDisabled =
    result.offset + result.limit >= result.total ? " disabled" : "";
  const page = Math.floor(result.offset / result.limit) + 1;
  const pages = Math.max(1, Math.ceil(result.total / result.limit));
  return `<div class="catalog-pager">
    <button type="button" class="btn btn-sm btn-ghost" data-catalog-page="${escapeAttr(tabId)}" data-catalog-dir="prev"${prevDisabled}>Previous</button>
    <span class="muted small">Page ${page} of ${pages} (${result.total} results)</span>
    <button type="button" class="btn btn-sm btn-ghost" data-catalog-page="${escapeAttr(tabId)}" data-catalog-dir="next"${nextDisabled}>Next</button>
  </div>`;
}

function renderPlaceDetail(detail) {
  if (!detail) return "";
  const terminals = (detail.terminals || [])
    .map(
      (t) => `<tr>
        <td>${displayText(t.name)}</td>
        <td>${displayText(t.type || "")}</td>
        <td class="ship-service-chips">${renderServiceChips(t.services)}</td>
      </tr>`
    )
    .join("");
  return `<article class="catalog-detail inline-detail-inner">
    <header class="catalog-detail-head">
      <h3>${displayText(detail.name)}</h3>
    </header>
    <p class="muted small">${displayText(detail.system || "")} · ${displayText(detail.location || "")}</p>
    <p class="ship-service-summary">Available here: ${renderServiceChips(detail.services)}</p>
    <div class="catalog-table-wrap"><table class="catalog-table">
      <thead><tr><th>Terminal</th><th>Type</th><th>Services</th></tr></thead>
      <tbody>${terminals || `<tr><td colspan="3" class="muted">No service terminals listed</td></tr>`}</tbody>
    </table></div>
  </article>`;
}

function renderCatalogShipListingsIntro(detail) {
  if (!detail?.listings?.length) return "";
  return `<h4 class="guide-detail-sub">Where to buy or rent</h4>`;
}

function renderCatalogDetail(detail, kind) {
  if (!detail) return "";
  if (kind === "place") return renderPlaceDetail(detail);
  const listings = detail.listings || detail.items || [];
  const title = detail.name || detail.terminal || "Details";
  const rows =
    kind === "shop"
      ? (detail.items || [])
          .map(
            (it) => `<tr>
            <td>${displayText(it.name)}</td>
            <td>${displayText(it.section || it.category || "")}</td>
            <td>${escapeHtml(fmtAuec(it.priceBuy))}</td>
            <td>${escapeHtml(fmtAuec(it.priceSell))}</td>
          </tr>`
          )
          .join("")
      : (detail.listings || [])
          .map(
            (l) => `<tr>
            <td>${displayText(l.terminal || "")}</td>
            <td>${displayText(l.location || "")}</td>
            <td>${displayText(l.system || "")}</td>
            <td>${escapeHtml(fmtAuec(l.priceBuy))}</td>
            <td>${escapeHtml(fmtAuec(l.priceSell))}</td>
            <td>${l.priceRent ? escapeHtml(fmtAuec(l.priceRent)) : EMPTY_DISPLAY}</td>
          </tr>`
          )
          .join("");

  const head =
    kind === "shop"
      ? "<th>Item</th><th>Type</th><th>Buy</th><th>Sell</th>"
      : "<th>Shop</th><th>Location</th><th>System</th><th>Buy</th><th>Sell</th><th>Rent</th>";

  return `<article class="catalog-detail inline-detail-inner">
    <header class="catalog-detail-head">
      <h3>${displayText(title)}</h3>
    </header>
    ${detail.section === "Ships" ? renderCatalogShipListingsIntro(detail) : ""}
    ${detail.className ? `<p class="muted small mono">${escapeHtml(detail.className)}</p>` : ""}
    ${detail.manufacturer ? `<p class="muted small">${displayText(detail.manufacturer)}</p>` : ""}
    <div class="catalog-table-wrap"><table class="catalog-table"><thead><tr>${head}</tr></thead><tbody>${rows || `<tr><td colspan="6" class="muted">No listings</td></tr>`}</tbody></table></div>
  </article>`;
}

function combatKindLabel(kind) {
  const map = {
    fps_weapon: "FPS weapon",
    ship_weapon: "Ship weapon",
    armor: "Armor",
    shield: "Shield",
    power_plant: "Power plant",
    cooler: "Cooler",
    vehicle: "Ship",
  };
  return map[kind] || kind || "Combat";
}

function renderCombatStatGrid(profile) {
  if (!profile?.stats?.length) {
    return `<p class="muted small">No combat stats available for this item.</p>`;
  }
  const cells = profile.stats
    .map(
      (s) => `<div class="combat-stat${s.highlight ? " combat-stat-highlight" : ""}">
        <span class="combat-stat-label"${s.title ? ` title="${escapeAttr(s.title)}"` : ""}>${escapeHtml(s.label)}</span>
        <span class="combat-stat-value">${escapeHtml(String(s.value))}</span>
      </div>`
    )
    .join("");
  return `<div class="combat-stat-grid">${cells}</div>`;
}

function renderCombatPerformanceSections(profile) {
  if (!profile?.sections?.length) return renderCombatStatGrid(profile);
  return profile.sections
    .map(
      (section) => `<div class="combat-performance-section">
        <h5 class="combat-performance-title">${escapeHtml(section.title)}</h5>
        ${renderCombatStatGrid({ stats: section.stats })}
      </div>`
    )
    .join("");
}

function renderDamageTypeChips(damageTypes) {
  if (!damageTypes?.length) return "";
  const chips = damageTypes
    .map(
      (d) =>
        `<span class="combat-damage-chip" data-damage-type="${escapeAttr(d.type)}">${escapeHtml(d.type)} ${escapeHtml(String(d.value))}</span>`
    )
    .join("");
  return `<div class="combat-damage-types">${chips}</div>`;
}

function renderExternalToolLinks(links) {
  if (!links?.length) return "";
  const btns = links
    .map(
      (l) =>
        `<button type="button" class="btn btn-sm btn-ghost combat-tool-link" data-guide-external="${escapeAttr(l.url)}">${escapeHtml(l.label)}</button>`
    )
    .join("");
  return `<div class="combat-external-links">${btns}</div>`;
}

function renderAdvancedToolsFooter(links, tools) {
  const inline = renderExternalToolLinks(links);
  const toolBtns = (tools || [])
    .map(
      (t) =>
        `<button type="button" class="btn btn-sm btn-ghost combat-tool-link" data-guide-external="${escapeAttr(t.url)}" title="${escapeAttr(t.description || "")}">${escapeHtml(t.name)}</button>`
    )
    .join("");
  if (!inline && !toolBtns) return "";
  return `<details class="combat-advanced-tools">
    <summary class="muted small">More community tools</summary>
    ${inline}
    ${toolBtns ? `<div class="combat-advanced-tools-grid">${toolBtns}</div>` : ""}
    <p class="muted small"><button type="button" class="link guide-tab-link" data-tab="guides-external-tools">Open Credits to</button> for overlays, loot tables, and hangar sync.</p>
  </details>`;
}

function renderCombatProfilePanel(data, options = {}) {
  if (!data?.ok && !data?.profile) {
    return `<section class="combat-profile-panel guide-card">
      <p class="muted small">${escapeHtml(data?.error || "Combat stats unavailable.")}</p>
    </section>`;
  }
  const profile = data.profile;
  const kind = combatKindLabel(profile?.kind);
  const modes = profile?.modes?.length
    ? `<p class="muted small">Fire modes: ${escapeHtml(profile.modes.join(", "))}</p>`
    : "";
  const perfTitle = profile?.kind === "vehicle" ? "Ship performance" : "Combat stats";
  const sourceNote = profile?.performanceSource
    ? `Source: ${profile.performanceSource}.`
    : "Datamine via star-citizen.wiki.";
  const advancedTools = options.advancedTools || [];
  return `<section class="combat-profile-panel guide-card">
    <header class="combat-profile-head">
      <h4>${escapeHtml(perfTitle)}</h4>
      <span class="combat-kind-badge">${escapeHtml(kind)}</span>
    </header>
    ${data.headline ? `<p class="combat-headline">${escapeHtml(data.headline)}</p>` : ""}
    ${profile?.kind === "vehicle" ? renderCombatPerformanceSections(profile) : renderCombatStatGrid(profile)}
    ${renderDamageTypeChips(profile?.damageTypes)}
    ${modes}
    ${renderAdvancedToolsFooter(data.externalLinks, advancedTools)}
    <p class="muted small combat-source-note">${escapeHtml(sourceNote)} Patch changes may lag the live game.</p>
  </section>`;
}

function renderCombatHubPanel(toolsData, searchHtml) {
  const intro = `<div class="hub-intro hub-intro-accent">
    <strong>Combat command center.</strong> Search weapons, armor, and ships. Fleet rankings and loadout planning are one click away. Heat sims and cutaways stay in Credits to.
  </div>`;
  const inApp = `<section class="guide-section">
    <h2 class="guide-section-title">Start here</h2>
    <div class="combat-inapp-grid">
      <button type="button" class="guide-tab-link combat-inapp-card" data-tab="guides-fleet">
        <span class="inapp-icon" aria-hidden="true">🚀</span>
        <h3>Fleet compare</h3>
        <p class="muted small">Rank every flyable ship by hull, shields, speed, cargo, and signatures.</p>
      </button>
      <button type="button" class="guide-tab-link combat-inapp-card" data-tab="guides-loadout">
        <span class="inapp-icon" aria-hidden="true">🔧</span>
        <h3>Ship builder</h3>
        <p class="muted small">Load a hull, see stock guns, swap weapons, and compare total DPS.</p>
      </button>
    </div>
  </section>`;
  const quickTools = (toolsData?.tools || [])
    .slice(0, 4)
    .map(
      (t) =>
        `<button type="button" class="btn btn-sm btn-ghost" data-guide-external="${escapeAttr(t.url)}">${escapeHtml(t.name)}</button>`
    )
    .join("");
  const toolsStrip = quickTools
    ? `<section class="guide-section"><h2 class="guide-section-title">External sims</h2><div class="combat-advanced-tools-grid">${quickTools}</div><p class="muted small"><button type="button" class="link guide-tab-link" data-tab="guides-external-tools">Credits to</button> lists every community site and what StarTracker replaces in-app.</p></section>`
    : "";
  return `${intro}${inApp}${toolsStrip}
    <section class="guide-section"><h2 class="guide-section-title">Search any item or ship</h2>${searchHtml}</section>
    <section class="guide-section"><div id="combatSearchResults"></div></section>`;
}

function renderCombatSearchResults(rows) {
  if (!rows?.length) return `<p class="muted">No matches. Try a weapon, armor, or ship name.</p>`;
  const host = INLINE_HOST.COMBAT;
  const colspan = 3;
  return `<div class="catalog-table-wrap"><table class="catalog-table">
    <thead><tr><th></th><th>Name</th><th>Type</th></tr></thead>
    <tbody>${rows
      .map((r) => {
        const key = r.className || r.slug;
        const kind = r.resourceType === "vehicle" ? "vehicle" : "item";
        const expanded = isInlineExpanded(host, key);
        return `<tr class="${expandableRowClass(host, key)}" data-combat-key="${escapeAttr(key)}" data-combat-kind="${escapeAttr(kind)}" tabindex="0" role="button" aria-expanded="${expanded}">
          <td class="expand-chevron-cell"><span class="expand-chevron" aria-hidden="true">${expandChevron(host, key)}</span></td>
          <td>${displayText(r.name)}</td>
          <td class="muted small">${escapeHtml(kind)}</td>
        </tr>${renderInlineDetailRow(colspan, host, key)}`;
      })
      .join("")}</tbody></table></div>`;
}

function formatFleetCell(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString();
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function fleetMetaLine(meta) {
  if (!meta?.fetchedAt) return "";
  const stale = meta.stale ? " · index may be refreshing" : "";
  const total = meta.indexTotal ?? meta.total ?? "?";
  return `<p class="guides-meta muted small">${total} ships in index · updated ${new Date(meta.fetchedAt).toLocaleString()}${stale}</p>`;
}

function fleetStateKey(state) {
  return `${state.query || ""}|${state.sort || "manufacturer"}|${state.offset || 0}|${state.limit || 80}`;
}

async function getLoadoutFleetIndex(forceRefresh = false) {
  try {
    const index = await window.debrief.fleetGetIndex({ forceRefresh });
    if (index.ok && index.rows?.length) {
      return {
        rows: index.rows,
        meta: {
          fetchedAt: index.fetchedAt,
          stale: index.stale,
          total: index.rows.length,
        },
      };
    }
    if (!forceRefresh) return getLoadoutFleetIndex(true);
  } catch {
    if (!forceRefresh) return getLoadoutFleetIndex(true);
  }
  return { rows: [], meta: { total: 0 } };
}

function filterShipBuilderRows(rows, state, favSlugs) {
  const filter = (state?.query || "").trim().toLowerCase();
  return (rows || []).filter((r) => {
    if (shipBuilderPickMode === "favorites" && !favSlugs.has(r.slug)) return false;
    if (!filter) return true;
    const hay = `${r.name || ""} ${r.manufacturer || ""} ${r.slug || ""} ${r.className || ""} ${r.role || ""}`.toLowerCase();
    const tokens = filter.split(/\s+/).filter(Boolean);
    return tokens.every((t) => hay.includes(t));
  });
}

async function resolveShipBuilderRows(state, favSlugs) {
  const fleet = await getLoadoutFleetIndex();
  const baseRows = fleet.rows || [];
  let filtered = filterShipBuilderRows(baseRows, state, favSlugs);
  let remoteSource = null;

  const q = (state?.query || "").trim();
  if (!filtered.length && q.length >= 2) {
    try {
      const remote = await window.debrief.fleetSearchVehicles(q);
      remoteSource = remote.source;
      const extras = remote.rows || [];
      const merged = [...baseRows];
      for (const row of extras) {
        if (!merged.some((r) => r.slug === row.slug)) merged.push(row);
      }
      filtered = filterShipBuilderRows(merged, state, favSlugs);
    } catch {
      /* optional wiki lookup */
    }
  }

  return {
    rows: filtered,
    fleetEmpty: !baseRows.length,
    remoteSource,
    meta: fleet.meta,
  };
}

function fleetCompareToolbar(tabId) {
  const state = guideQueryByTab[tabId] || { query: "", sort: "hull", offset: 0 };
  const sorts = [
    ["manufacturer", "Manufacturer A–Z"],
    ["hull", "Hull HP"],
    ["shield", "Shield HP"],
    ["scm", "SCM speed"],
    ["cargo", "Cargo SCU"],
    ["mass", "Mass (low first)"],
    ["h2", "H2 capacity"],
    ["ir", "IR signature"],
    ["name", "Name"],
  ];
  const options = sorts
    .map(
      ([val, label]) =>
        `<option value="${escapeAttr(val)}"${state.sort === val ? " selected" : ""}>${escapeHtml(label)}</option>`
    )
    .join("");
  return `<div class="catalog-toolbar">
    <input type="search" class="catalog-search" data-fleet-search="${escapeAttr(tabId)}" placeholder="Filter ships…" value="${escapeAttr(state.query || "")}" />
    <select class="guide-sort-select" data-fleet-sort="${escapeAttr(tabId)}">${options}</select>
    <button type="button" class="btn btn-sm" data-fleet-refresh>Refresh index</button>
  </div>`;
}

function manufacturerTone(manufacturer) {
  const m = String(manufacturer || "").toLowerCase();
  if (m.includes("origin")) return "origin";
  if (m.includes("aegis")) return "aegis";
  if (m.includes("anvil")) return "anvil";
  if (m.includes("drake")) return "drake";
  if (m.includes("roberts") || m === "rsi") return "rsi";
  if (m.includes("crusader")) return "crusader";
  if (m.includes("misc")) return "misc";
  if (m.includes("aopoa")) return "aopoa";
  return "generic";
}

function fleetMfgBadge(manufacturer, size) {
  const label = manufacturer || size || "—";
  if (!manufacturer && !size) return `<span class="fleet-mfg" data-mfg="generic">—</span>`;
  const tone = manufacturer ? manufacturerTone(manufacturer) : "generic";
  return `<span class="fleet-mfg" data-mfg="${tone}">${displayText(label)}</span>`;
}

function renderFleetCompareRows(rows) {
  if (!rows?.length) return `<p class="muted">No ships match this filter.</p>`;
  const host = INLINE_HOST.FLEET;
  const colspan = 8;
  const body = rows
    .map((r) => {
      const key = r.className || r.slug;
      const expanded = isInlineExpanded(host, key);
      return `<tr class="${expandableRowClass(host, key)}" data-fleet-key="${escapeAttr(key)}" data-fleet-slug="${escapeAttr(r.slug)}" tabindex="0" role="button" aria-expanded="${expanded}">
        <td class="expand-chevron-cell"><span class="expand-chevron" aria-hidden="true">${expandChevron(host, key)}</span></td>
        <td>${displayText(r.name)}</td>
        <td>${fleetMfgBadge(r.manufacturer, r.size)}</td>
        <td>${formatFleetCell(r.hullHp)}</td>
        <td>${formatFleetCell(r.shieldHp)}</td>
        <td>${formatFleetCell(r.scm)}</td>
        <td>${formatFleetCell(r.cargo)}</td>
        <td>${formatFleetCell(r.mass)}</td>
      </tr>${renderInlineDetailRow(colspan, host, key)}`;
    })
    .join("");
  return `<div class="catalog-table-wrap"><table class="catalog-table fleet-compare-table">
    <thead><tr><th></th><th>Ship</th><th>Mfg / size</th><th>Hull</th><th>Shield</th><th>SCM</th><th>Cargo</th><th>Mass</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function renderLoadoutSlotSelect(portId, componentType, sizeMax, assigned, stockClassName, stockName, slotOptions) {
  const key = `${componentType}:${sizeMax}`;
  const opts = slotOptions?.[key]?.rows || [];
  const current = assigned || stockClassName || "";
  const optionsHtml = opts
    .map((o) => {
      const selected = current && (current === o.className || current === o.slug);
      const dpsLabel = o.dps != null ? ` · ${formatFleetCell(o.dps)} DPS` : o.headline ? ` · ${o.headline}` : "";
      return `<option value="${escapeAttr(o.className || o.slug)}"${selected ? " selected" : ""}>${displayText(o.name)}${dpsLabel}</option>`;
    })
    .join("");
  const stockLabel = stockName ? `Stock: ${stockName}` : "Stock loadout";
  return `<select class="loadout-slot-select guide-sort-select" data-loadout-port="${escapeAttr(portId)}" data-loadout-slot-type="${escapeAttr(componentType)}" aria-label="Select ${escapeAttr(componentType)} for ${escapeAttr(portId)}">
    <option value="${escapeAttr(stockClassName || "")}"${!current || current === stockClassName ? " selected" : ""}>${displayText(stockLabel)}</option>
    ${optionsHtml}
  </select>`;
}

const LOADOUT_QUICK_SHIPS = [
  { slug: "aegs-gladius", label: "Gladius" },
  { slug: "drak-cutlass-black", label: "Cutlass Black" },
  { slug: "anvl-hurricane", label: "Hurricane" },
  { slug: "misc-prospector", label: "Prospector" },
  { slug: "drak-caterpillar", label: "Caterpillar" },
  { slug: "crus-starlifter-c2", label: "C2 Hercules" },
];

function loadoutDeltaHtml(current, baseline, label) {
  if (current == null || baseline == null || current === baseline) return "";
  const delta = Math.round((current - baseline) * 10) / 10;
  const sign = delta > 0 ? "+" : "";
  const cls = delta > 0 ? " loadout-delta-up" : delta < 0 ? " loadout-delta-down" : "";
  return `<span class="loadout-delta${cls}">${sign}${delta} ${label}</span>`;
}

function renderLoadoutSummaryStrip(totals, baseline) {
  const guns = totals?.weaponCount ?? 0;
  return `<div class="loadout-summary-strip">
    <div class="loadout-summary-card">
      <span class="loadout-summary-label">Combined DPS</span>
      <span class="loadout-summary-value">${formatFleetCell(totals?.totalDps)}${loadoutDeltaHtml(totals?.totalDps, baseline?.totalDps, "DPS")}</span>
    </div>
    <div class="loadout-summary-card">
      <span class="loadout-summary-label">Alpha strike</span>
      <span class="loadout-summary-value">${formatFleetCell(totals?.totalAlpha)}${loadoutDeltaHtml(totals?.totalAlpha, baseline?.totalAlpha, "alpha")}</span>
    </div>
    <div class="loadout-summary-card">
      <span class="loadout-summary-label">Guns</span>
      <span class="loadout-summary-value">${guns}</span>
    </div>
  </div>`;
}

function shipBuilderEmptyMessage(state, fleetEmpty, remoteSource) {
  const q = (state?.query || "").trim();
  if (fleetEmpty) {
    return `Ship database still loading. Wait a moment or click <strong>Refresh ship index</strong> below.`;
  }
  if (q) {
    const remoteHint =
      remoteSource === "wiki-slug"
        ? " Found via wiki slug lookup."
        : remoteSource === "none"
          ? " Try the full name (e.g. Origin M80) or a slug like orig-m80."
          : "";
    return `No ships match “${escapeHtml(q)}”.${remoteHint}`;
  }
  return shipBuilderPickMode === "favorites"
    ? "No favorite hulls yet. Switch to <strong>All ships</strong> and tap ☆ on a hull to pin it here."
    : "No ships match. Clear your filter or refresh the ship index.";
}

function renderShipBuilderRows(rows, emptyMessage) {
  if (!rows?.length) {
    const msg = emptyMessage || "No ships match your filter.";
    return `<div class="catalog-table-wrap ship-picker-table-wrap"><div class="ship-picker-table-scroll"><table class="catalog-table ship-picker-table">
      <thead><tr><th></th><th></th><th>Mfg</th><th>Ship</th><th>Role</th></tr></thead>
      <tbody><tr><td colspan="5" class="muted">${msg}</td></tr></tbody>
    </table></div></div>`;
  }
  const host = INLINE_HOST.SHIP_BUILDER;
  const colspan = 5;
  const body = rows
    .map((r) => {
      const key = r.slug;
      const starred = isShipFavorited(r.slug);
      const expanded = isInlineExpanded(host, key);
      return `<tr class="ship-picker-row ${expandableRowClass(host, key)}" data-ship-builder-key="${escapeAttr(key)}" tabindex="0" role="button" aria-expanded="${expanded}">
        <td class="expand-chevron-cell"><span class="expand-chevron" aria-hidden="true">${expandChevron(host, key)}</span></td>
        <td><button type="button" class="ship-fav-btn${starred ? " is-favorited" : ""}" data-ship-fav-toggle="${escapeAttr(r.slug)}" data-ship-name="${escapeAttr(r.name || r.slug)}" data-ship-mfg="${escapeAttr(r.manufacturer || "")}" aria-label="${starred ? "Remove from favorites" : "Add to favorites"}">${starred ? "★" : "☆"}</button></td>
        <td>${displayText(r.manufacturer || "—")}</td>
        <td>${displayText(r.name)}</td>
        <td class="muted small">${displayText(r.role || r.focus || "")}</td>
      </tr>${renderInlineDetailRow(colspan, host, key)}`;
    })
    .join("");
  return `<div class="catalog-table-wrap ship-picker-table-wrap"><div class="ship-picker-table-scroll"><table class="catalog-table ship-picker-table">
    <thead><tr><th></th><th></th><th>Mfg</th><th>Ship</th><th>Role</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div></div>`;
}

function renderFleetComparePager(tabId, result) {
  if (!result || result.total <= result.limit) return "";
  const prevDisabled = result.offset <= 0 ? " disabled" : "";
  const nextDisabled = result.offset + result.limit >= result.total ? " disabled" : "";
  const page = Math.floor(result.offset / result.limit) + 1;
  const pages = Math.max(1, Math.ceil(result.total / result.limit));
  return `<div class="catalog-pager fleet-compare-pager">
    <button type="button" class="btn btn-sm btn-ghost" data-fleet-page="${escapeAttr(tabId)}" data-fleet-dir="prev"${prevDisabled}>Previous</button>
    <span class="muted small">Page ${page} of ${pages} (${result.total} total)</span>
    <button type="button" class="btn btn-sm btn-ghost" data-fleet-page="${escapeAttr(tabId)}" data-fleet-dir="next"${nextDisabled}>Next</button>
  </div>`;
}

async function buildShipBuilderInlineHtml(slug) {
  if (loadoutBuilderState.shipSlug !== slug) {
    loadoutBuilderState.shipSlug = slug;
    loadoutBuilderState.slotAssignments = {};
    loadoutBuilderState.stockBaseline = null;
    loadoutBuilderBlueprint = null;
  }

  // Fast path: stock DPS + hull. Equipment catalogs fill in afterward.
  const sim = await window.debrief.loadoutSimulate({
    shipSlug: slug,
    slotAssignments: loadoutBuilderState.slotAssignments,
  });
  let blueprint = sim?.blueprint || null;
  if (!blueprint?.ok) {
    blueprint = await window.debrief.loadoutGetBlueprint(slug);
  }
  if (blueprint?.ok) loadoutBuilderBlueprint = blueprint;
  if (!loadoutBuilderState.stockBaseline && sim?.summary) {
    loadoutBuilderState.stockBaseline = {
      totalDps: sim.summary.totalDps,
      totalAlpha: sim.summary.totalAlpha,
    };
  }
  if (!sim?.ok && !blueprint?.ok) {
    return `<p class="muted">${escapeHtml(sim?.error || blueprint?.error || "Could not load ship.")}</p>`;
  }

  const summary = sim?.ok ? sim.summary : blueprint.stockSummary;
  let html = renderLoadoutBuilderBody(blueprint, summary);
  if (blueprint?.slotOptionsPending) {
    html =
      `<p class="muted small ship-builder-options-pending">Loading weapon and component options…</p>` +
      html;
  }
  const hull = sim?.hullProfile || blueprint?.hullProfile;
  if (hull) {
    const hullHtml = renderCombatPerformanceSections(hull);
    html = html.replace(
      '<div id="loadoutHullProfile"></div>',
      `<div id="loadoutHullProfile">${hullHtml}</div>`
    );
  }
  return html;
}

async function finishShipBuilderSlotOptions(slug) {
  if (!slug || !window.debrief.loadoutAwaitSlotOptions) return;
  try {
    const full = await window.debrief.loadoutAwaitSlotOptions(slug);
    if (!full?.ok) return;
    if (inlineExpand.host !== INLINE_HOST.SHIP_BUILDER) return;
    if (String(inlineExpand.key) !== String(slug)) return;
    loadoutBuilderBlueprint = full;
    const sim = await window.debrief.loadoutSimulate({
      shipSlug: slug,
      slotAssignments: loadoutBuilderState.slotAssignments,
    });
    let html = renderLoadoutBuilderBody(full, sim?.summary || full.stockSummary);
    const hull = sim?.hullProfile || full.hullProfile;
    if (hull) {
      const hullHtml = renderCombatPerformanceSections(hull);
      html = html.replace(
        '<div id="loadoutHullProfile"></div>',
        `<div id="loadoutHullProfile">${hullHtml}</div>`
      );
    }
    inlineExpand.html = html;
    inlineExpand.loading = false;
    await refreshInlineExpandHost(INLINE_HOST.SHIP_BUILDER);
    scrollShipBuilderExpandIntoView(slug);
  } catch {
    /* keep first-paint UI */
  }
}

async function renderLoadoutBuilderShell() {
  await loadShipBuilderFavorites();
  // Favorites-only with zero stars looks like a broken empty panel — fall back to all ships.
  if (shipBuilderPickMode === "favorites" && !shipBuilderFavorites.length) {
    shipBuilderPickMode = "all";
  }
  const tabId = "guides-loadout";
  const state = guideQueryByTab[tabId] || { query: "" };
  guideQueryByTab[tabId] = state;
  const favSlugs = new Set(shipBuilderFavorites.map((s) => s.slug));
  const resolved = await resolveShipBuilderRows(state, favSlugs);
  const displayRows = resolved.rows;
  const emptyMsg = shipBuilderEmptyMessage(state, resolved.fleetEmpty, resolved.remoteSource);

  const favChips = shipBuilderFavorites.length
    ? shipBuilderFavorites
        .map(
          (s) =>
            `<button type="button" class="ship-builder-fav-chip${s.slug === loadoutBuilderState.shipSlug ? " is-active" : ""}" data-ship-fav-load="${escapeAttr(s.slug)}" title="${escapeAttr(s.name)}"><span aria-hidden="true">★</span> ${escapeHtml(s.name || s.slug)}</button>`
        )
        .join("")
    : `<p class="ship-builder-favorites-empty muted small">No favorite hulls yet. Stay on <strong>All ships</strong> and tap ☆ on any ship to pin it here — like Jump to, but for ship builder.</p>`;

  const tableHtml = renderShipBuilderRows(displayRows, emptyMsg);
  shipBuilderLastPayload = { rows: displayRows, emptyMessage: emptyMsg };

  const modeFavActive = shipBuilderPickMode === "favorites" ? " is-active" : "";
  const modeAllActive = shipBuilderPickMode === "all" ? " is-active" : "";
  const expandedHint =
    inlineExpand.host === INLINE_HOST.SHIP_BUILDER && inlineExpand.key
      ? ""
      : `<p class="muted small ship-builder-hint">Click a ship row to expand loadout details inline. Click again to collapse.</p>`;
  const indexTotal = resolved.meta?.total || 0;
  const indexMeta =
    indexTotal > 0
      ? `<p class="guides-meta muted small ship-builder-index-meta">${displayRows.length} shown${state.query ? " (filtered)" : ""} · ${indexTotal} flyable hulls indexed${resolved.meta?.stale ? " · background refresh running" : ""}</p>`
      : "";

  return `<div class="hub-intro loadout-builder-intro hub-intro-accent">
    <strong>Ship builder.</strong> Favorite hulls, swap weapons and components, read live DPS and hull stats. Search by name, manufacturer, or slug (e.g. <em>M80</em>, <em>orig-m80</em>).
  </div>
  <nav class="ship-builder-mode-nav" aria-label="Ship picker mode">
    <button type="button" class="filter-chip ship-builder-mode${modeFavActive}" data-ship-builder-mode="favorites">★ Favorites</button>
    <button type="button" class="filter-chip ship-builder-mode${modeAllActive}" data-ship-builder-mode="all">All ships</button>
  </nav>
  <section class="guide-section ship-builder-favorites-section">
    <h2 class="guide-section-title loadout-section-title">Favorite hulls</h2>
    <div class="ship-builder-fav-strip">${favChips}</div>
  </section>
  <section class="guide-section loadout-ship-pick">
    <h2 class="guide-section-title loadout-section-title">${shipBuilderPickMode === "favorites" ? "Your favorites" : "Pick a hull"}</h2>
    <div class="catalog-toolbar">
      <input type="search" id="loadoutShipFilter" class="catalog-search" placeholder="Filter ships… (M80, Gladius, orig-m80)" value="${escapeAttr(state.query || "")}" />
      <button type="button" class="btn btn-sm" id="shipBuilderRefreshBtn">Refresh ship index</button>
    </div>
    ${indexMeta}${tableHtml}${expandedHint}
  </section>`;
}

function renderLoadoutBuilderBody(blueprint, summary) {
  if (!blueprint?.ok) {
    return `<p class="muted">${escapeHtml(blueprint?.error || "Could not load ship.")}</p>`;
  }
  const slotOptions = blueprint.slotOptions || {};
  const weapons = summary?.weapons || blueprint.stockSummary?.weapons || [];
  const totals = summary || blueprint.stockSummary;
  const baseline = loadoutBuilderState.stockBaseline;
  const stockByPort = Object.fromEntries(
    (blueprint.stockSummary?.weapons || []).map((w) => [w.portId, w])
  );
  const weaponRows = weapons
    .map((w) => {
      const assigned =
        loadoutBuilderState.slotAssignments[w.portId] || w.className || w.stockClassName || "";
      const stockDps = stockByPort[w.portId]?.dps;
      const dpsDelta =
        w.dps != null && stockDps != null && w.dps !== stockDps
          ? loadoutDeltaHtml(w.dps, stockDps, "")
          : "";
      return `<tr>
        <td>${escapeHtml(capitalizeSlotLabel(w.label))}</td>
        <td>S${displayText(w.sizeMax ?? "—")}</td>
        <td>${formatFleetCell(w.dps)}${dpsDelta ? `<div class="muted small">stock ${formatFleetCell(stockDps)}</div>` : ""}</td>
        <td>${renderLoadoutSlotSelect(w.portId, "WeaponGun", w.sizeMax, assigned, w.stockClassName || w.className, w.name || w.stockName, slotOptions)}</td>
      </tr>`;
    })
    .join("");

  const componentRows = (blueprint.componentSlots || [])
    .map((c) => {
      const assigned =
        loadoutBuilderState.slotAssignments[c.portId] || c.stockClassName || "";
      return `<tr>
        <td>${escapeHtml(capitalizeSlotLabel(c.label))}</td>
        <td>${escapeHtml(capitalizeSlotLabel(c.componentType))}</td>
        <td>S${displayText(c.sizeMax ?? "—")}</td>
        <td>${renderLoadoutSlotSelect(c.portId, c.componentType, c.sizeMax, assigned, c.stockClassName, c.stockName, slotOptions)}</td>
      </tr>`;
    })
    .join("");

  const stockComponents = (blueprint.stockComponents || [])
    .map(
      (c) =>
        `<span class="loadout-stock-chip">${displayText(c.type)} S${displayText(c.size ?? "—")} ×${c.quantity ?? 1}</span>`
    )
    .join("");

  return `<section class="guide-card loadout-builder-panel">
    <header class="combat-profile-head loadout-builder-head">
      <div class="loadout-builder-head-main">
        <h3 class="loadout-ship-title">${displayText(blueprint.ship?.manufacturer ? `${blueprint.ship.manufacturer} ${blueprint.ship.name}` : blueprint.ship?.name)}</h3>
        <button type="button" class="ship-fav-btn loadout-ship-fav-btn${isShipFavorited(blueprint.ship?.slug || loadoutBuilderState.shipSlug) ? " is-favorited" : ""}" data-ship-fav-toggle="${escapeAttr(blueprint.ship?.slug || loadoutBuilderState.shipSlug)}" data-ship-name="${escapeAttr(blueprint.ship?.name || "")}" data-ship-mfg="${escapeAttr(blueprint.ship?.manufacturer || "")}" aria-label="Toggle favorite">${isShipFavorited(blueprint.ship?.slug || loadoutBuilderState.shipSlug) ? "★ Favorited" : "☆ Favorite hull"}</button>
      </div>
      <button type="button" class="btn btn-sm btn-ghost" id="loadoutResetStockBtn">Reset to stock</button>
    </header>
    ${renderLoadoutSummaryStrip(totals, baseline)}
    <p class="muted small">${displayText(totals?.note || blueprint.limitations || "")}</p>
    ${stockComponents ? `<p class="loadout-stock-row muted small">Stock components: ${stockComponents}</p>` : ""}
    <details class="loadout-builder-section" open>
      <summary><h4 class="guide-section-title loadout-section-title">2. Weapons</h4></summary>
      <div class="catalog-table-wrap"><table class="catalog-table">
        <thead><tr><th>Hardpoint</th><th>Size</th><th>DPS</th><th>Equip</th></tr></thead>
        <tbody>${weaponRows || `<tr><td colspan="4" class="muted">No weapon hardpoints found.</td></tr>`}</tbody>
      </table></div>
    </details>
    ${
      componentRows
        ? `<details class="loadout-builder-section" open>
      <summary><h4 class="guide-section-title loadout-section-title">3. Components</h4></summary>
      <div class="catalog-table-wrap"><table class="catalog-table">
        <thead><tr><th>Slot</th><th>Type</th><th>Size</th><th>Equip</th></tr></thead>
        <tbody>${componentRows}</tbody>
      </table></div>
    </details>`
        : ""
    }
    <details class="loadout-builder-section" open>
      <summary><h4 class="guide-section-title loadout-section-title">4. Hull Performance</h4></summary>
      <div id="loadoutHullProfile"></div>
    </details>
  </section>`;
}

async function refreshShipBuilderFilter() {
  if (activeTab !== "guides-loadout") return;
  const tabId = "guides-loadout";
  const state = guideQueryByTab[tabId] || { query: "" };
  guideQueryByTab[tabId] = state;

  const favSlugs = new Set(shipBuilderFavorites.map((s) => s.slug));
  const resolved = await resolveShipBuilderRows(state, favSlugs);
  const emptyMsg = shipBuilderEmptyMessage(state, resolved.fleetEmpty, resolved.remoteSource);
  shipBuilderLastPayload = { rows: resolved.rows, emptyMessage: emptyMsg };

  if (document.querySelector("#panel-guides-loadout .ship-picker-table-wrap")) {
    patchShipBuilderTable(renderShipBuilderRows(resolved.rows, emptyMsg));
    document.querySelector("#panel-guides-loadout .ship-builder-pager")?.remove();
    const metaEl = document.querySelector("#panel-guides-loadout .ship-builder-index-meta");
    const indexTotal = resolved.meta?.total || 0;
    if (metaEl && indexTotal > 0) {
      metaEl.textContent = `${resolved.rows.length} shown${state.query ? " (filtered)" : ""} · ${indexTotal} flyable hulls indexed${resolved.meta?.stale ? " · background refresh running" : ""}`;
    }
    if (inlineExpand.host === INLINE_HOST.SHIP_BUILDER && inlineExpand.key) {
      await refreshInlineExpandHost(INLINE_HOST.SHIP_BUILDER);
    }
    return;
  }

  await loadLoadoutBuilderTab(tabId);
}

async function loadFleetCompareTab(tabId, options = {}) {
  const filterOnly =
    !!options.filterOnly && document.querySelector(`#panel-${tabId} .catalog-toolbar`);

  const state = guideQueryByTab[tabId] || { query: "", offset: 0, sort: "manufacturer", limit: 80 };
  if (!state.limit) state.limit = 80;
  if (options.resetOffset) state.offset = 0;
  guideQueryByTab[tabId] = state;

  const cacheKey = fleetStateKey(state);
  const intro = `<div class="hub-intro"><strong>Compare the whole fleet.</strong> Sort ships by hull, shields, SCM, cargo, mass, and IR signature. Click any row for the full performance breakdown. Click again to collapse.</div>`;
  const applyFleetPanel = (meta, rows, pageMeta) => {
    const tableHtml = renderFleetCompareRows(rows);
    const pagerHtml = renderFleetComparePager(tabId, pageMeta);
    if (filterOnly) {
      patchPanelResults(`#panel-${tabId}`, tableHtml, pagerHtml);
    } else {
      setPanelHtml(
        tabId,
        `${intro}${fleetMetaLine(meta)}${fleetCompareToolbar(tabId)}${tableHtml}${pagerHtml}`
      );
    }
  };

  if (!options.forceRefresh && fleetCompareLastRows && fleetCompareCacheKey === cacheKey && fleetComparePageMeta) {
    applyFleetPanel(fleetCompareMeta, fleetCompareLastRows, fleetComparePageMeta);
    return;
  }

  if (!filterOnly) {
    setPanelHtml(
      tabId,
      `${intro}${fleetMetaLine(fleetCompareMeta)}${fleetCompareToolbar(tabId)}<p class="muted small">Loading fleet index…</p>`
    );
  }

  try {
    const result = await window.debrief.fleetCompareQuery({
      query: state.query,
      sort: state.sort,
      offset: state.offset,
      limit: state.limit,
      forceRefresh: options.forceRefresh,
    });
    if (!result.ok) throw new Error(result.error || "fleet compare failed");
    fleetCompareMeta = result.meta;
    fleetCompareLastRows = result.rows;
    fleetComparePageMeta = { total: result.total, offset: result.offset, limit: result.limit };
    fleetCompareCacheKey = cacheKey;
    applyFleetPanel(result.meta, result.rows, fleetComparePageMeta);
  } catch (e) {
    if (!filterOnly) {
      setPanelHtml(
        tabId,
        `${fleetMetaLine(fleetCompareMeta)}${fleetCompareToolbar(tabId)}<p class="muted">Fleet compare error: ${escapeHtml(e.message || String(e))}</p>`
      );
    }
  }
}

async function loadLoadoutBuilderTab(tabId, options = {}) {
  const soft = !!options.soft;
  const preserveKey =
    inlineExpand.host === INLINE_HOST.SHIP_BUILDER ? inlineExpand.key : null;
  const preserveHtml = preserveKey ? inlineExpand.html : null;
  const preserveLoading = preserveKey ? inlineExpand.loading : false;

  if (!soft) {
    setPanelHtml(tabId, `<p class="muted small">Loading ship index…</p>`);
  }
  try {
    const shell = await renderLoadoutBuilderShell();
    if (soft) {
      const scroll = document.querySelector(`#panel-${tabId} .ship-picker-table-scroll`);
      const top = scroll?.scrollTop ?? 0;
      setPanelHtml(tabId, shell);
      const next = document.querySelector(`#panel-${tabId} .ship-picker-table-scroll`);
      if (next) next.scrollTop = top;
    } else {
      setPanelHtml(tabId, shell);
    }
  } catch (e) {
    setPanelHtml(
      tabId,
      `<p class="muted">Ship builder error: ${escapeHtml(e.message || String(e))}. Try <strong>Refresh ship index</strong>.</p>`
    );
    return;
  }

  if (preserveKey) {
    const state = guideQueryByTab["guides-loadout"] || {};
    const favSlugs = new Set(shipBuilderFavorites.map((s) => s.slug));
    const resolved = await resolveShipBuilderRows(state, favSlugs);
    const stillVisible = resolved.rows.some((r) => r.slug === preserveKey);
    if (!stillVisible) {
      clearInlineExpand();
    } else {
      inlineExpand = {
        host: INLINE_HOST.SHIP_BUILDER,
        key: String(preserveKey),
        kind: null,
        html: preserveHtml,
        loading: preserveLoading,
      };
    }
    await refreshInlineExpandHost(INLINE_HOST.SHIP_BUILDER);
  }
}

function gatherLoadoutAssignments() {
  const assignments = { ...loadoutBuilderState.slotAssignments };
  document.querySelectorAll(".loadout-slot-select").forEach((sel) => {
    const port = sel.dataset.loadoutPort;
    const val = sel.value.trim();
    if (port && val) assignments[port] = val;
  });
  return assignments;
}

async function applyLoadoutAssignments() {
  loadoutBuilderState.slotAssignments = gatherLoadoutAssignments();
  if (!loadoutBuilderState.shipSlug) return;
  if (!isInlineExpanded(INLINE_HOST.SHIP_BUILDER, loadoutBuilderState.shipSlug)) return;
  inlineExpand.loading = true;
  await refreshInlineExpandHost(INLINE_HOST.SHIP_BUILDER);
  try {
    inlineExpand.html = await buildShipBuilderInlineHtml(loadoutBuilderState.shipSlug);
    inlineExpand.loading = false;
    await refreshInlineExpandHost(INLINE_HOST.SHIP_BUILDER);
  } catch (e) {
    inlineExpand.html = `<p class="muted">Loadout error: ${escapeHtml(e.message || String(e))}</p>`;
    inlineExpand.loading = false;
    await refreshInlineExpandHost(INLINE_HOST.SHIP_BUILDER);
  }
}

async function loadCatalogTab(tabId, options = {}) {
  if (!tabId.startsWith("catalog-")) return;
  const filterOnly =
    !!options.filterOnly && document.querySelector(`#panel-${tabId} .catalog-toolbar`);

  const state = catalogQueryByTab[tabId] || { query: "", offset: 0 };
  if (options.resetOffset) state.offset = 0;
  catalogQueryByTab[tabId] = state;

  if (!filterOnly) {
    setPanelHtml(
      tabId,
      `${catalogMetaLine()}${catalogToolbar(tabId)}<p class="muted small">Loading catalog…</p>`
    );
  }

  try {
    let result;
    let tableHtml;
    if (tabId === "catalog-ships") {
      result = await window.debrief.catalogQueryVehicles({
        query: state.query,
        offset: state.offset,
        limit: 60,
        withListingsOnly: true,
      });
      tableHtml = renderCatalogShipRows(result.rows);
    } else if (tabId === "catalog-shops") {
      result = await window.debrief.catalogQueryShops({
        query: state.query,
        offset: state.offset,
        limit: 50,
      });
      tableHtml = renderCatalogShopRows(result.rows);
    } else if (tabId === "catalog-ship-services") {
      result = await window.debrief.catalogQueryPlaces({
        query: state.query,
        offset: state.offset,
        limit: 80,
      });
      tableHtml = renderCatalogShipServiceRows(result.rows);
    } else {
      result = await window.debrief.catalogQueryItems({
        query: state.query,
        offset: state.offset,
        limit: 80,
        section: state.section,
        withListingsOnly: true,
      });
      tableHtml = renderCatalogItemRows(result.rows, tabId);
    }
    catalogLastPayload = { tabId, html: tableHtml };
    const pagerHtml = renderCatalogPager(tabId, result);
    if (filterOnly) {
      patchPanelResults(`#panel-${tabId}`, tableHtml, pagerHtml);
    } else {
      setPanelHtml(
        tabId,
        `${catalogMetaLine()}${catalogToolbar(tabId)}${tableHtml}${pagerHtml}`
      );
    }
  } catch (e) {
    if (!filterOnly) {
      setPanelHtml(
        tabId,
        `${catalogMetaLine()}${catalogToolbar(tabId)}<p class="muted">Catalog error: ${escapeHtml(e.message || String(e))}</p>`
      );
    }
  }
}

function fmtScuPrice(n) {
  if (n == null || n <= 0) return EMPTY_DISPLAY;
  return `${Number(n).toLocaleString()} aUEC/SCU`;
}

function fmtPurchaseCostPerScu(n) {
  if (n == null || n <= 0) return EMPTY_DISPLAY;
  return `<span class="trade-price-main">${Number(n).toLocaleString()} aUEC/SCU</span> <span class="trade-price-hint">leaves your wallet when you buy</span>`;
}

function fmtSalePayoutPerScu(n) {
  if (n == null || n <= 0) return EMPTY_DISPLAY;
  return `<span class="trade-price-main">${Number(n).toLocaleString()} aUEC/SCU</span> <span class="trade-price-hint">into your wallet when you sell</span>`;
}

function fmtNetPerScuLine(buyCost, sellPayout) {
  const buy = Number(buyCost);
  const sell = Number(sellPayout);
  if (!(buy > 0) || !(sell > 0)) return "";
  const net = sell - buy;
  const netAbs = Math.abs(net).toLocaleString();
  if (net >= 0) {
    return `<p class="trade-net-summary">Per SCU: buy ${buy.toLocaleString()} → sell ${sell.toLocaleString()} → <strong class="commodity-spread-positive">+${netAbs} aUEC profit</strong></p>`;
  }
  return `<p class="trade-net-summary">Per SCU: buy ${buy.toLocaleString()} → sell ${sell.toLocaleString()} → <strong class="commodity-spread-negative">−${netAbs} aUEC loss</strong></p>`;
}

function fmtSpreadPerScu(spreadVal) {
  if (spreadVal == null || spreadVal === 0) return EMPTY_DISPLAY;
  const cls = spreadVal < 0 ? "commodity-spread-negative" : "commodity-spread-positive";
  const prefix = spreadVal < 0 ? "Loss" : "Profit";
  return `<span class="${cls}">${prefix} ${escapeHtml(fmtScuPrice(Math.abs(spreadVal)))}</span>`;
}

function guidesMetaLine(meta) {
  const fetchedAt =
    meta && typeof meta === "object" ? meta.fetchedAt : meta || null;
  const stale = meta && typeof meta === "object" && meta.stale;
  const when = fetchedAt ? fmtDateTime(fetchedAt) : null;
  const busy = guideCommodityRefreshBusy ? " Refreshing prices…" : "";
  const base = when
    ? `Prices from UEX Corp community data. Cached ${escapeHtml(when)}.${busy}`
    : `Prices from UEX Corp community data. Not cached yet.${busy}`;
  const staleNote = stale ? " Using cached copy." : "";
  return `<p class="guides-meta muted small">${base}${staleNote} Per SCU at trading terminals.</p>`;
}

function renderMarketFilterChips(state) {
  const filters = [
    { id: "trade", label: "Trade" },
    { id: "mining", label: "Mining" },
    { id: "illegal", label: "Illegal" },
    { id: "all", label: "All" },
  ];
  const active = state.filter || "trade";
  return `<div class="filter-chip-row" role="group" aria-label="Market filter">${filters
    .map(
      (f) =>
        `<button type="button" class="filter-chip${active === f.id ? " is-active" : ""}" data-market-filter="${escapeAttr(f.id)}">${escapeHtml(f.label)}</button>`
    )
    .join("")}</div>`;
}

function guidesCommodityToolbar(tabId) {
  const state = guideQueryByTab[tabId] || { query: "", sort: "name", filter: "trade" };
  const busy = guideCommodityRefreshBusy ? " disabled" : "";
  const filterHint =
    state.filter === "mining"
      ? "Extractable and harvestable materials for mining loops."
      : state.filter === "illegal"
        ? "Illegal goods for smuggling. Pair with Smuggler routes for locations."
        : state.filter === "all"
          ? "All commodities with UEX prices."
          : "Legal trade goods with buy and sell spread.";
  return `${renderMarketFilterChips(state)}
  <div class="catalog-toolbar catalog-toolbar-sticky">
    <input type="search" class="catalog-search" data-guide-search="${escapeAttr(tabId)}" placeholder="Search name, code, kind…" value="${escapeAttr(state.query || "")}" />
    <button type="button" class="btn btn-sm btn-ghost" data-guide-search-btn="${escapeAttr(tabId)}">Search</button>
    <select class="guide-sort-select" data-guide-sort="${escapeAttr(tabId)}" aria-label="Sort commodities">
      <option value="name"${state.sort === "name" ? " selected" : ""}>Sort: name</option>
      <option value="spread"${state.sort === "spread" ? " selected" : ""}>Sort: spread</option>
      <option value="sell"${state.sort === "sell" ? " selected" : ""}>Sort: sell</option>
      <option value="buy"${state.sort === "buy" ? " selected" : ""}>Sort: buy</option>
    </select>
    <button type="button" class="btn btn-sm" data-guide-refresh${busy}>Refresh prices</button>
    <button type="button" class="btn btn-sm btn-ghost guide-tab-link" data-tab="guides-trade-routes">Profit calculator</button>
  </div>
  <p class="muted small">${escapeHtml(filterHint)}</p>`;
}

function renderGuideCommodityRows(rows, tabId) {
  if (!rows?.length) {
    return tabId ? emptyPanel(tabById(tabId)) : `<p class="muted">No commodities match your search.</p>`;
  }
  const host = INLINE_HOST.COMMODITY;
  const colspan = 7;
  const body = rows
    .map((row) => {
      const spreadClass =
        row.spread != null && row.spread > 0 ? " commodity-spread-positive" : "";
      const illegal = row.isIllegal ? "Yes" : EMPTY_DISPLAY;
      const expanded = isInlineExpanded(host, row.id);
      return `<tr class="guide-commodity-row ${expandableRowClass(host, row.id)}" data-guide-commodity="${row.id}" tabindex="0" role="button" aria-expanded="${expanded}">
        <td class="expand-chevron-cell"><span class="expand-chevron" aria-hidden="true">${expandChevron(host, row.id)}</span></td>
        <td>${displayText(row.name)}<div class="muted small mono">${escapeHtml(row.code || "")}</div></td>
        <td>${displayText(row.kind)}</td>
        <td>${escapeHtml(fmtScuPrice(row.priceBuy))}</td>
        <td>${escapeHtml(fmtScuPrice(row.priceSell))}</td>
        <td class="${spreadClass.trim()}">${row.spread != null && row.spread > 0 ? escapeHtml(fmtScuPrice(row.spread)) : EMPTY_DISPLAY}</td>
        <td>${escapeHtml(illegal)}</td>
      </tr>${renderInlineDetailRow(colspan, host, row.id)}`;
    })
    .join("");
  return `<div class="catalog-table-wrap"><table class="catalog-table">
    <thead><tr><th></th><th>Name</th><th>Kind</th><th>Buy (aUEC/SCU)</th><th>Sell (aUEC/SCU)</th><th>Spread</th><th>Illegal</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function renderGuideCommodityPager(tabId, result) {
  if (!result || result.total <= result.limit) return "";
  const prevDisabled = result.offset <= 0 ? " disabled" : "";
  const nextDisabled = result.offset + result.limit >= result.total ? " disabled" : "";
  const page = Math.floor(result.offset / result.limit) + 1;
  const pages = Math.max(1, Math.ceil(result.total / result.limit));
  return `<div class="catalog-pager">
    <button type="button" class="btn btn-sm btn-ghost" data-guide-page="${escapeAttr(tabId)}" data-guide-dir="prev"${prevDisabled}>Previous</button>
    <span class="muted small">Page ${page} of ${pages} (${result.total} total)</span>
    <button type="button" class="btn btn-sm btn-ghost" data-guide-page="${escapeAttr(tabId)}" data-guide-dir="next"${nextDisabled}>Next</button>
  </div>`;
}

function renderGuideCommodityDetail(detail) {
  if (!detail?.commodity) return "";
  const c = detail.commodity;
  const terminals = detail.terminals || [];
  const topBuy = terminals
    .filter((t) => t.priceBuy > 0)
    .sort((a, b) => a.priceBuy - b.priceBuy)
    .slice(0, 8);
  const topSell = terminals
    .filter((t) => t.priceSell > 0)
    .sort((a, b) => b.priceSell - a.priceSell)
    .slice(0, 8);
  const termRows = (rows, kind) =>
    rows
      .map(
        (t) => `<tr>
          <td>${displayText(t.terminal)}</td>
          <td>${displayText(t.location || t.system)}</td>
          <td>${escapeHtml(fmtScuPrice(kind === "buy" ? t.priceBuy : t.priceSell))}</td>
        </tr>`
      )
      .join("");

  const bestBuy = detail.bestBuy
    ? `<p class="muted small">Best buy: <strong>${escapeHtml(fmtScuPrice(detail.bestBuy.priceBuy))}</strong> at ${displayText(detail.bestBuy.terminal || detail.bestBuy.location)}</p>`
    : "";
  const bestSell = detail.bestSell
    ? `<p class="muted small">Best sell: <strong>${escapeHtml(fmtScuPrice(detail.bestSell.priceSell))}</strong> at ${displayText(detail.bestSell.terminal || detail.bestSell.location)}</p>`
    : "";

  return `<article class="catalog-detail guide-detail inline-detail-inner">
    <header class="catalog-detail-head">
      <h3>${displayText(c.name)}</h3>
    </header>
    <p class="muted small">${displayText(c.kind)} · ${escapeHtml(c.code || "")}${c.isIllegal ? " · Illegal" : ""}</p>
    ${bestBuy}${bestSell}
    <h4 class="guide-detail-sub">Top buy terminals</h4>
    <div class="catalog-table-wrap"><table class="catalog-table"><thead><tr><th>Terminal</th><th>Location</th><th>Buy</th></tr></thead><tbody>${termRows(topBuy, "buy") || `<tr><td colspan="3" class="muted">No buy prices</td></tr>`}</tbody></table></div>
    <h4 class="guide-detail-sub">Top sell terminals</h4>
    <div class="catalog-table-wrap"><table class="catalog-table"><thead><tr><th>Terminal</th><th>Location</th><th>Sell</th></tr></thead><tbody>${termRows(topSell, "sell") || `<tr><td colspan="3" class="muted">No sell prices</td></tr>`}</tbody></table></div>
  </article>`;
}

function renderPatchSectionItems(items, limit = 24) {
  if (!items?.length) return "";
  const slice = items.slice(0, limit);
  const more = items.length > limit ? `<li class="muted small">…and ${items.length - limit} more (open full notes on RSI or Wiki)</li>` : "";
  return `<ul class="patch-note-list">${slice.map((item) => `<li>${displayText(item)}</li>`).join("")}${more}</ul>`;
}

function renderPatchNoteSections(sections) {
  if (!sections?.length) return "";
  return sections
    .map((section, idx) => {
      const open = idx === 0 ? " open" : "";
      const subHtml = (section.subsections || [])
        .map(
          (sub) => `<div class="patch-note-subsection">
            <h5 class="patch-note-subhead">${displayText(sub.title)}</h5>
            ${renderPatchSectionItems(sub.items, 16)}
          </div>`
        )
        .join("");
      const directItems = renderPatchSectionItems(section.items, 20);
      const body = subHtml || directItems;
      if (!body) return "";
      return `<details class="patch-note-section"${open}>
        <summary>${displayText(section.title)}</summary>
        <div class="patch-note-section-body">${body}</div>
      </details>`;
    })
    .join("");
}

function buildPatchNotesPanel(data) {
  const remoteCards = (data.remote || [])
    .map((link) => {
      const rsiUrl = link.rsiUrl || "";
      const wikiUrl = link.wikiUrl || "";
      const version = link.version ? `Alpha ${link.version}` : "";
      const intro = (link.intro || [])
        .slice(0, 4)
        .map((p) => `<p class="patch-note-intro">${displayText(p)}</p>`)
        .join("");
      const sectionsHtml = renderPatchNoteSections(link.sections);
      const rsiValid =
        rsiUrl &&
        !/Star-Citizen-Live/i.test(rsiUrl) &&
        !/\/transmission\//i.test(rsiUrl);
      const linkRow = [
        rsiValid
          ? `<button type="button" class="btn btn-sm patch-read-rsi" data-guide-external="${escapeAttr(rsiUrl)}">Open on RSI</button>`
          : "",
        wikiUrl
          ? `<button type="button" class="btn btn-sm btn-ghost patch-read-wiki" data-guide-external="${escapeAttr(wikiUrl)}">Wiki mirror</button>`
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<article class="patch-note-card guide-card patch-note-game">
        <header>
          <h3>${displayText(link.headline || link.title)}</h3>
          <span class="patch-version-badge">${escapeHtml(version || link.channel || "RSI")}</span>
        </header>
        <p class="muted small">${escapeHtml(link.dateHuman || link.date || "")}${link.channel ? ` · ${escapeHtml(link.channel)}` : ""}</p>
        ${intro}
        ${sectionsHtml || `<p class="patch-note-lead muted small">Full notes could not be parsed. Use the links below.</p>`}
        <div class="patch-note-links">${linkRow}</div>
      </article>`;
    })
    .join("");

  const localCards = (data.local || [])
    .map((note) => {
      const stNotes = (note.startrackerNotes || [])
        .map((n) => `<li>${displayText(n)}</li>`)
        .join("");
      return `<article class="patch-note-card guide-card patch-note-app">
        <header><h3>${displayText(note.title || `StarTracker ${note.version || ""}`)}</h3><span class="muted small">${escapeHtml(note.date || "")}</span></header>
        ${stNotes ? `<ul class="guide-list">${stNotes}</ul>` : ""}
      </article>`;
    })
    .join("");

  const meta = data.meta?.fetchedAt
    ? `<p class="guides-meta muted small">Game patches from RSI (Alpha 4.9 / 4.8.x) and star-citizen.wiki · cached ${escapeHtml(fmtDateTime(data.meta.fetchedAt))}${data.meta.stale ? " (stale)" : ""} · <button type="button" class="link" id="patchNotesRefreshBtn">Refresh patch notes</button></p>`
    : `<p class="guides-meta muted small"><button type="button" class="link" id="patchNotesRefreshBtn">Refresh patch notes</button></p>`;

  const appSection = localCards
    ? `<details class="patch-app-notes"><summary>StarTracker app release notes (not game patches)</summary>${localCards}</details>`
    : "";

  if (!remoteCards && !localCards) {
    return `${meta}<p class="muted">No patch notes available. Check back after RSI publishes the next comm-link.</p>`;
  }

  return `${meta}
    <section class="guide-section"><h2 class="guide-section-title">Star Citizen game patches</h2>${remoteCards || `<p class="muted">No Alpha patch comm-links in cache. Use Refresh below or open RSI directly.</p>`}</section>
    ${appSection}
    <p class="guides-meta muted small"><button type="button" class="link" data-guide-external="https://robertsspaceindustries.com/en/comm-link/Patch-Notes">Browse RSI patch notes</button></p>`;
}

function buildRefineryYieldTable(oreCatalog, opts = {}) {
  if (!oreCatalog?.length) return "";
  const rows = oreCatalog
    .map((o) => {
      const volatile = o.volatile ? `<span class="badge badge-warn">Volatile</span>` : "";
      const raw = o.ore?.priceSell > 0 ? fmtScuPrice(o.ore.priceSell) : EMPTY_DISPLAY;
      const refined = o.refined?.priceSell > 0 ? fmtScuPrice(o.refined.priceSell) : EMPTY_DISPLAY;
      return `<tr>
        <td>${displayText(o.label)} ${volatile}</td>
        <td>${raw}</td>
        <td>${refined}</td>
        <td><strong>${formatFleetCell(o.defaultYieldPercent ?? 80)}%</strong></td>
        <td class="muted small">${displayText(o.notes || "")}</td>
      </tr>`;
    })
    .join("");
  const table = `<div class="catalog-table-wrap refinery-yield-table-wrap"><table class="catalog-table refinery-yield-table">
      <thead><tr><th>Ore</th><th>Raw sell</th><th>Refined sell</th><th>Default yield</th><th>Notes</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  if (opts.bare) {
    return `<p class="muted small">Community yield estimates per ore type. Tap an ore chip above to load its default yield.</p>${table}`;
  }
  return `<section class="guide-section">
    <h2 class="guide-section-title">Ore yield reference</h2>
    <p class="muted small">Community yield estimates per ore type. Select an ore below to load its default yield into the calculator.</p>
    ${table}
  </section>`;
}

function buildRefineryOreChips(oreCatalog, selectedId) {
  const pickIds = ["quantainium", "bexalite", "laranite", "taranite", "broadstone", "gneiss"];
  return pickIds
    .map((id) => oreCatalog.find((o) => o.id === id))
    .filter(Boolean)
    .map(
      (o) =>
        `<button type="button" class="refinery-ore-chip${o.id === selectedId ? " is-active" : ""}" data-refinery-ore="${escapeAttr(o.id)}">${displayText(o.label)}${o.volatile ? " ⚡" : ""}</button>`
    )
    .join("");
}

function buildRefineryStationCards(stations, selectedId) {
  const bySystem = {};
  for (const s of stations) {
    const sys = s.system || "Other";
    if (!bySystem[sys]) bySystem[sys] = [];
    bySystem[sys].push(s);
  }
  return Object.entries(bySystem)
    .map(
      ([sys, list]) => `<div class="refinery-system-group">
      <h4 class="refinery-system-label">${escapeHtml(sys)}</h4>
      <div class="refinery-station-cards">${list
        .map(
          (s) =>
            `<button type="button" class="refinery-station-card${s.name === selectedId ? " is-active" : ""}" data-refinery-station="${escapeAttr(s.name)}" title="${escapeAttr(s.notes || "")}">
          <strong>${displayText(s.name.replace(/\s+Refinery$/i, ""))}</strong>
          <span class="muted small">${displayText(s.body || "")}</span>
          <span class="refinery-station-fee">${s.defaultFeePercent != null ? `${formatFleetCell(s.defaultFeePercent)}% fee` : EMPTY_DISPLAY}</span>
        </button>`
        )
        .join("")}</div></div>`
    )
    .join("");
}

function buildRefineryPanel(data, calcResult) {
  const state = guideQueryByTab["guides-refinery"] || {};
  const oreOptions = (data.oreCatalog || [])
    .map((o) => {
      const volatile = o.volatile ? " · volatile" : "";
      const priceHint =
        o.refined?.priceSell > 0
          ? ` · ${fmtScuPrice(o.refined.priceSell)} sell`
          : o.ore?.priceSell > 0
            ? ` · ${fmtScuPrice(o.ore.priceSell)} raw`
            : "";
      return `<option value="${escapeAttr(o.id)}"${state.oreId === o.id ? " selected" : ""}>${displayText(o.label)}${priceHint}${volatile}</option>`;
    })
    .join("");
  const selectedOre = (data.oreCatalog || []).find((o) => o.id === state.oreId) || data.oreCatalog?.[0];
  const stations = data.stations || [];
  const stationId = state.stationId || stations[0]?.name || "";
  const selectedStation = stations.find((s) => s.name === stationId) || stations[0] || null;
  const stationOptions = stations
    .map((s) => {
      const fee =
        s.defaultFeePercent != null ? ` · ${formatFleetCell(s.defaultFeePercent)}% fee` : "";
      return `<option value="${escapeAttr(s.name)}"${s.name === stationId ? " selected" : ""}>${displayText(s.name)}${s.system ? ` (${displayText(s.system)})` : ""}${fee}</option>`;
    })
    .join("");
  const yieldVal =
    state.yieldPercent != null
      ? state.yieldPercent
      : selectedOre?.defaultYieldPercent ?? data.defaultYieldPercent ?? 80;
  const feeVal =
    state.feePercent != null
      ? state.feePercent
      : selectedStation?.defaultFeePercent ?? data.defaultStationFeePercent ?? 5;
  const result = calcResult?.ok ? calcResult.result : null;
  const worthClass = result?.worthRefining ? " refinery-profit-positive" : result ? " refinery-profit-negative" : "";
  const verdictLabel = result?.worthRefining ? "Refine it" : result ? "Sell raw" : "Run the numbers";
  const verdictIcon = result?.worthRefining ? "⚗" : result ? "📦" : "◎";
  const resultHero = result
    ? `<div class="refinery-verdict-hero${worthClass}">
        <div class="refinery-verdict-icon" aria-hidden="true">${verdictIcon}</div>
        <div class="refinery-verdict-body">
          <span class="refinery-verdict-label">${escapeHtml(verdictLabel)}</span>
          <strong class="refinery-verdict-profit">${fmtAuec(result.profitVsRaw)}</strong>
          <span class="muted small">net vs selling ${formatFleetCell(result.oreScu)} SCU raw · ${fmtAuec(result.profitPerOreScu)}/SCU ore</span>
        </div>
      </div>
      <div class="refinery-result-grid refinery-result-compact">
        <div class="refinery-result-card"><span class="refinery-result-label">Yield</span><strong>${formatFleetCell(result.yieldPercent)}%</strong><span class="muted small">${formatFleetCell(result.refinedScu)} SCU refined</span></div>
        <div class="refinery-result-card"><span class="refinery-result-label">Raw sell</span><strong>${fmtAuec(result.grossRaw)}</strong></div>
        <div class="refinery-result-card"><span class="refinery-result-label">Refined (net)</span><strong>${fmtAuec(result.netRefined)}</strong><span class="muted small">fee ${fmtAuec(result.refineryFee)}</span></div>
      </div>`
    : `<p class="muted small refinery-verdict-placeholder">Pick ore, station, and SCU — results update as you change values.</p>`;

  const stationRows = stations
    .map(
      (s) => `<tr${s.name === stationId ? ' class="is-selected"' : ""}>
        <td>${displayText(s.name)}</td>
        <td>${displayText(s.system || "")}</td>
        <td>${displayText(s.body || "")}</td>
        <td>${s.defaultFeePercent != null ? `${formatFleetCell(s.defaultFeePercent)}%` : EMPTY_DISPLAY}</td>
        <td class="muted small">${displayText(s.notes || "")}</td>
      </tr>`
    )
    .join("");
  const tips = (data.loopTips || [])
    .map((t) => `<li>${displayText(t)}</li>`)
    .join("");
  const meta = data.meta?.fetchedAt
    ? `<p class="guides-meta muted small">Prices from UEX · cached ${escapeHtml(fmtDateTime(data.meta.fetchedAt))}${data.meta.stale ? " (stale)" : ""}</p>`
    : "";
  const disclaimer = data.disclaimer
    ? `<p class="guides-meta muted small">${displayText(data.disclaimer)}</p>`
    : "";

  return `${meta}${disclaimer}
    <div class="hub-intro hub-intro-accent refinery-hub-intro"><strong>Mining refinery loop.</strong> Mine ore → process at a station → sell refined goods at TDDs. Compare raw vs refined using live UEX sell prices. In-game refinery UI is always authoritative for yield and fees.</div>
    <div class="refinery-step-strip" aria-hidden="true"><span>Mine</span><span class="refinery-step-arrow">→</span><span>Refine</span><span class="refinery-step-arrow">→</span><span>Sell</span></div>
    <div class="refinery-workbench">
      <section class="refinery-calc-panel guide-card">
        <h2 class="guide-section-title">Calculator</h2>
        <div class="refinery-ore-chips">${buildRefineryOreChips(data.oreCatalog || [], state.oreId || selectedOre?.id)}</div>
        <div class="refinery-calc-form refinery-calc-form-compact">
          <label class="refinery-field refinery-field-ore"><span>Ore type</span>
            <select id="refineryOreSelect" class="guide-sort-select">${oreOptions}</select>
          </label>
          <label class="refinery-field refinery-field-scu"><span>Cargo SCU (ore)</span>
            <input type="number" id="refineryOreScu" class="refinery-num-input" min="0" step="1" value="${escapeAttr(String(state.oreScu ?? 100))}" />
          </label>
          <label class="refinery-field refinery-field-yield"><span>Yield %</span>
            <input type="number" id="refineryYield" class="refinery-num-input" min="1" max="100" step="1" value="${escapeAttr(String(yieldVal))}" title="Community yield estimate" />
          </label>
          <label class="refinery-field refinery-field-fee"><span>Station fee %</span>
            <input type="number" id="refineryFee" class="refinery-num-input" min="0" max="50" step="0.5" value="${escapeAttr(String(feeVal))}" />
          </label>
        </div>
        <label class="refinery-field refinery-field-station refinery-field-station-select"><span>Refinery station</span>
          <select id="refineryStationSelect" class="guide-sort-select">${stationOptions}</select>
        </label>
        ${selectedOre?.volatile ? `<p class="refinery-volatile-note">⚡ Volatile ore — refine and sell quickly before decay.</p>` : ""}
        ${selectedOre?.notes ? `<p class="muted small refinery-ore-note">${displayText(selectedOre.notes)}</p>` : ""}
        ${calcResult?.prices?.rawName ? `<p class="muted small refinery-price-line">UEX sell: raw ${displayText(calcResult.prices.rawName)} ${fmtScuPrice(calcResult.prices.rawSellPerScu)}/SCU · refined ${displayText(calcResult.prices.refinedName || "n/a")} ${fmtScuPrice(calcResult.prices.refinedSellPerScu)}/SCU</p>` : ""}
        ${resultHero}
      </section>
      <aside class="refinery-station-rail">
        <h3 class="refinery-rail-title">Pick a refinery</h3>
        <p class="muted small">Tap a station card or use the dropdown. Grim HEX has 0% admin fee.</p>
        <div class="refinery-station-rail-scroll">${buildRefineryStationCards(stations, stationId)}</div>
      </aside>
    </div>
    <details class="refinery-advanced-panel">
      <summary>Ore yield reference (all types)</summary>
      ${buildRefineryYieldTable(data.oreCatalog, { bare: true })}
    </details>
    <details class="refinery-advanced-panel">
      <summary>All stations table (${stations.length})</summary>
      <div class="catalog-table-wrap"><table class="catalog-table">
        <thead><tr><th>Station</th><th>System</th><th>Body</th><th>Fee</th><th>Notes</th></tr></thead>
        <tbody>${stationRows || `<tr><td colspan="5" class="muted">No stations listed.</td></tr>`}</tbody>
      </table></div>
    </details>
    <details class="refinery-advanced-panel">
      <summary>Mining loop tips</summary>
      <ul class="guide-list">${tips}</ul>
      <p class="muted small"><button type="button" class="link guide-tab-link" data-tab="guides-commodities">Market prices</button> · <button type="button" class="link guide-tab-link" data-tab="guides-loops">Game loops</button></p>
    </details>`;
}

let refineryGuideLastData = null;

async function loadRefineryTab(tabId) {
  setPanelHtml(tabId, `<p class="muted small">Loading refinery data…</p>`);
  try {
    const data = await window.debrief.guidesGetRefinery();
    refineryGuideLastData = data;
    const state = guideQueryByTab[tabId] || {};
    if (!state.oreId && data.oreCatalog?.length) {
      state.oreId = data.oreCatalog[0].id;
    }
    if (!state.stationId && data.stations?.length) {
      state.stationId = data.stations[0].name;
    }
    const selectedOre = data.oreCatalog?.find((o) => o.id === state.oreId);
    const selectedStation = data.stations?.find((s) => s.name === state.stationId);
    if (state.yieldPercent == null && selectedOre) {
      state.yieldPercent = selectedOre.defaultYieldPercent ?? data.defaultYieldPercent ?? 80;
    }
    if (state.feePercent == null && selectedStation?.defaultFeePercent != null) {
      state.feePercent = selectedStation.defaultFeePercent;
    } else if (state.feePercent == null) {
      state.feePercent = data.defaultStationFeePercent ?? 5;
    }
    guideQueryByTab[tabId] = state;
    const calc = await window.debrief.guidesCalculateRefinery({
      oreId: state.oreId,
      stationId: state.stationId,
      oreScu: state.oreScu,
      yieldPercent: state.yieldPercent,
      stationFeePercent: state.feePercent,
    });
    setPanelHtml(tabId, buildRefineryPanel(data, calc));
  } catch (e) {
    setPanelHtml(tabId, `<p class="muted">Refinery error: ${escapeHtml(e.message || String(e))}</p>`);
  }
}

function renderCraftingSearchRows(rows, selectedId) {
  if (!rows?.length) {
    return `<p class="muted small">No blueprints matched. Try a ship weapon, armor piece, or component name.</p>`;
  }
  const host = INLINE_HOST.CRAFTING;
  const colspan = 6;
  return `<div class="catalog-table-wrap"><table class="catalog-table crafting-search-table">
    <thead><tr><th></th><th>Output</th><th>Type</th><th>Craft time</th><th>Materials</th><th>Missions</th></tr></thead>
    <tbody>${rows
      .map((row) => {
        const id = row.slug || row.uuid || row.id;
        const expanded = isInlineExpanded(host, id);
        return `<tr class="crafting-blueprint-row ${expandableRowClass(host, id)}" data-crafting-blueprint="${escapeAttr(id)}" tabindex="0" role="button" aria-expanded="${expanded}">
          <td class="expand-chevron-cell"><span class="expand-chevron" aria-hidden="true">${expandChevron(host, id)}</span></td>
          <td>${displayText(row.outputName)}</td>
          <td class="muted small">${displayText(row.outputTypeLabel || "n/a")}</td>
          <td>${displayText(row.craftTimeLabel || "n/a")}</td>
          <td>${formatFleetCell(row.ingredientCount)}</td>
          <td>${formatFleetCell(row.missionCount)}</td>
        </tr>${renderInlineDetailRow(colspan, host, id)}`;
      })
      .join("")}</tbody></table></div>`;
}

function buildCraftingInlineDetail(detail, state) {
  if (!detail?.ok) {
    return `<p class="muted small">${escapeHtml(detail?.error || "Could not load blueprint.")}</p>`;
  }
  const bp = detail.blueprint;
  const output = detail.outputItem;
  const preview = detail.preview || null;
  const outputMeta = [
    output?.typeLabel,
    output?.subType,
    output?.grade ? `Grade ${output.grade}` : null,
    bp.craftTimeLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  const baseStatsList = (output?.descriptionData || [])
    .map((row) => `<li><strong>${displayText(row.name)}:</strong> ${displayText(row.value)}</li>`)
    .join("");
  return `<article class="inline-detail-inner crafting-inline-detail">
    <header class="crafting-inline-head">
      <h3>${displayText(bp.outputName || "Blueprint")}</h3>
      ${outputMeta ? `<p class="muted small">${escapeHtml(outputMeta)}</p>` : ""}
    </header>
    ${baseStatsList ? `<ul class="guide-list">${baseStatsList}</ul>` : ""}
    <h4 class="guide-detail-sub">Materials and quality</h4>
    ${buildCraftingMaterialsSection(detail, state)}
    <h4 class="guide-detail-sub">Projected stats</h4>
    <div id="craftingStatsPreview">${buildCraftingStatsSection(preview)}</div>
    <h4 class="guide-detail-sub">Unlock missions</h4>
    ${buildCraftingMissionsSection(detail)}
    ${bp.webUrl ? `<p class="muted small"><button type="button" class="link" data-guide-external="${escapeAttr(bp.webUrl)}">Open blueprint on wiki</button></p>` : ""}
  </article>`;
}

function buildCraftingMaterialsSection(detail, state) {
  const inputs = detail?.inputs || [];
  if (!inputs.length) {
    return `<p class="muted small">No material requirements listed for this blueprint.</p>`;
  }
  const qualities = state.qualities || {};
  const rows = inputs
    .map((input) => {
      const q = qualities[input.inputKey] ?? input.defaultQuality ?? 500;
      const modLabels = (input.modifiers || [])
        .map((m) => displayText(m.label || m.property_key))
        .join(", ");
      return `<tr>
        <td>
          <strong>${displayText(input.name)}</strong>
          <div class="muted small">${displayText(input.groupName)}${modLabels ? ` · affects ${modLabels}` : ""}</div>
        </td>
        <td>${input.quantityScu != null ? `${formatFleetCell(input.quantityScu)} SCU` : "—"}</td>
        <td class="crafting-quality-cell">
          <div class="crafting-quality-control">
            <input type="range" class="crafting-quality-slider" min="0" max="1000" step="1"
              data-crafting-input="${escapeAttr(input.inputKey)}" value="${escapeAttr(String(q))}" />
            <output class="crafting-quality-value">${escapeHtml(String(q))}</output>
          </div>
          <div class="muted small">Min ${input.minQuality ?? 0}</div>
        </td>
      </tr>`;
    })
    .join("");
  return `<div class="catalog-table-wrap"><table class="catalog-table crafting-materials-table">
    <thead><tr><th>Material</th><th>Amount</th><th>Quality (0–1000)</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function buildCraftingStatsSection(preview) {
  const stats = preview?.stats || [];
  if (!stats.length) {
    return `<p class="muted small">No quality-driven stats listed. Output may still craft at base wiki values.</p>`;
  }
  const rows = stats
    .map((stat) => {
      const deltaClass = stat.deltaGood ? "crafting-stat-boost" : stat.delta ? "crafting-stat-drop" : "";
      const deltaCell = stat.deltaFormatted
        ? `<span class="${deltaClass}">${escapeHtml(stat.deltaFormatted)}</span>`
        : `<span class="muted">—</span>`;
      const via = stat.inputName
        ? `<div class="muted small">via ${displayText(stat.inputName)} @ Q${stat.quality}</div>`
        : "";
      return `<tr>
        <td>${displayText(stat.label)}${via}</td>
        <td>${escapeHtml(stat.baselineFormatted || "—")}</td>
        <td><strong>${escapeHtml(stat.projectedFormatted || "—")}</strong></td>
        <td>${deltaCell}</td>
      </tr>`;
    })
    .join("");
  return `<div class="catalog-table-wrap"><table class="catalog-table crafting-stats-table">
    <thead><tr><th>Stat</th><th>Baseline (Q500)</th><th>Your preview</th><th>Delta</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function buildCraftingMissionsSection(detail) {
  const missions = detail?.blueprint?.unlockingMissions || [];
  if (!missions.length) {
    return `<p class="muted small">No mission unlock sources listed. This schematic may be default or vendor-only.</p>`;
  }
  const rows = missions
    .slice(0, 40)
    .map((m) => {
      const title =
        m.title && !m.title.includes("UNINITIALIZED") ? m.title : m.debug_name || m.title || "Unknown mission";
      const chance =
        m.chance != null && m.chance < 1
          ? `${Math.round(m.chance * 100)}%`
          : "Guaranteed";
      const link = m.web_url
        ? `<button type="button" class="link" data-guide-external="${escapeAttr(m.web_url)}">Wiki</button>`
        : "";
      return `<tr>
        <td>${displayText(title)}</td>
        <td>${displayText(m.reward_scope || "—")}</td>
        <td>${escapeHtml(chance)}</td>
        <td>${link}</td>
      </tr>`;
    })
    .join("");
  const more =
    missions.length > 40
      ? `<p class="muted small">Showing 40 of ${missions.length} mission sources.</p>`
      : "";
  return `${more}<div class="catalog-table-wrap"><table class="catalog-table crafting-missions-table">
    <thead><tr><th>Mission</th><th>Type</th><th>Drop chance</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderCraftingPager(meta) {
  if (!meta || meta.total <= meta.perPage) return "";
  const page = meta.page || 1;
  const pages = meta.lastPage || Math.max(1, Math.ceil(meta.total / meta.perPage));
  const prevDisabled = page <= 1 ? " disabled" : "";
  const nextDisabled = page >= pages ? " disabled" : "";
  return `<div class="catalog-pager crafting-pager">
    <button type="button" class="btn btn-sm btn-ghost" data-crafting-page="prev"${prevDisabled}>Previous</button>
    <span class="muted small">Page ${page} of ${pages} (${meta.total} total)</span>
    <button type="button" class="btn btn-sm btn-ghost" data-crafting-page="next"${nextDisabled}>Next</button>
  </div>`;
}

function buildCraftingPanel(searchData) {
  const state = guideQueryByTab["guides-crafting"] || {};
  const query = state.query || "";
  const meta = searchData?.meta?.fetchedAt
    ? `<p class="guides-meta muted small">Search from star-citizen.wiki · ${escapeHtml(fmtDateTime(searchData.meta.fetchedAt))}</p>`
    : "";

  return `${meta}
    <div class="hub-intro"><strong>Crafting workshop</strong> Search for a blueprint, then expand a row to tune material quality and preview stat changes.</div>
    <section class="guide-section crafting-search-section">
      <h2 class="guide-section-title">Find a blueprint</h2>
      <div class="catalog-toolbar">
        <input type="search" id="craftingSearchInput" class="catalog-search" data-crafting-search="guides-crafting"
          placeholder="Search blueprints: ADP Core, Omnisky, ship part…" value="${escapeAttr(query)}" />
        <button type="button" class="btn btn-sm" id="craftingSearchBtn">Search</button>
      </div>
      <div id="craftingSearchResults">${renderCraftingSearchRows(craftingSearchLastRows || searchData?.rows || [], state.blueprintId)}</div>
      ${renderCraftingPager(craftingSearchMeta || searchData?.meta)}
    </section>
    <p class="muted small"><button type="button" class="link guide-tab-link" data-tab="blueprints">Session blueprint unlocks</button> · <button type="button" class="link guide-tab-link" data-tab="guides-loops">Game loops</button></p>`;
}

async function loadCraftingTab(tabId, options = {}) {
  const state = guideQueryByTab[tabId] || {};
  if (!options.keepHtml) {
    setPanelHtml(tabId, `<p class="muted small">Loading crafting workshop…</p>`);
  }
  try {
    const searchData = await window.debrief.craftingSearchBlueprints({
      query: state.query || "",
      page: state.page || 1,
      perPage: 25,
    });
    craftingSearchLastRows = searchData.rows || [];
    craftingSearchMeta = searchData.meta || null;
    setPanelHtml(tabId, buildCraftingPanel(searchData));
    if (inlineExpand.host === INLINE_HOST.CRAFTING) {
      const el = $("craftingSearchResults");
      if (el) {
        el.innerHTML = renderCraftingSearchRows(craftingSearchLastRows, state.blueprintId);
      }
    }
  } catch (e) {
    setPanelHtml(tabId, `<p class="muted">Crafting error: ${escapeHtml(e.message || String(e))}</p>`);
  }
}

async function refreshCraftingPreview() {
  if (activeTab !== "guides-crafting") return;
  const state = guideQueryByTab["guides-crafting"] || {};
  if (!state.blueprintId) return;

  document.querySelectorAll(".crafting-quality-slider").forEach((slider) => {
    const key = slider.dataset.craftingInput;
    if (!key) return;
    if (!state.qualities) state.qualities = {};
    state.qualities[key] = Number(slider.value) || 0;
    const out = slider.parentElement?.querySelector(".crafting-quality-value");
    if (out) out.textContent = slider.value;
  });
  guideQueryByTab["guides-crafting"] = state;

  const statsEl = document.querySelector(
    `.inline-detail-row[data-inline-detail-for="${String(state.blueprintId).replace(/"/g, '\\"')}"] #craftingStatsPreview`
  ) || $("craftingStatsPreview");
  if (statsEl) statsEl.innerHTML = `<p class="muted small">Updating preview…</p>`;

  try {
    const calc = await window.debrief.craftingCalculatePreview({
      blueprintId: state.blueprintId,
      qualities: state.qualities,
    });
    if (statsEl && calc?.ok) {
      statsEl.innerHTML = buildCraftingStatsSection(calc.preview);
    }
  } catch {
    if (statsEl) statsEl.innerHTML = `<p class="muted">Preview update failed.</p>`;
  }
}

async function selectCraftingBlueprint(blueprintId) {
  await toggleInlineExpand(INLINE_HOST.CRAFTING, blueprintId);
}

async function refreshRefineryCalculator() {
  if (activeTab !== "guides-refinery") return;
  const state = guideQueryByTab["guides-refinery"] || {};
  const oreSelect = $("refineryOreSelect");
  const stationSelect = $("refineryStationSelect");
  const oreScu = $("refineryOreScu");
  const yieldInput = $("refineryYield");
  const feeInput = $("refineryFee");
  const prevOre = state.oreId;
  const prevStation = state.stationId;
  if (oreSelect) state.oreId = oreSelect.value;
  if (stationSelect) state.stationId = stationSelect.value;
  if (oreScu) state.oreScu = Number(oreScu.value) || 0;
  if (yieldInput && yieldInput !== document.activeElement) {
    state.yieldPercent = Number(yieldInput.value) || null;
  }
  if (feeInput && feeInput !== document.activeElement) {
    state.feePercent = Number(feeInput.value) || 0;
  }
  const guide = refineryGuideLastData;
  if (guide && state.oreId !== prevOre) {
    const ore = guide.oreCatalog?.find((o) => o.id === state.oreId);
    if (ore) state.yieldPercent = ore.defaultYieldPercent ?? guide.defaultYieldPercent ?? 80;
  }
  if (guide && state.stationId !== prevStation) {
    const station = guide.stations?.find((s) => s.name === state.stationId);
    if (station?.defaultFeePercent != null) state.feePercent = station.defaultFeePercent;
  }
  guideQueryByTab["guides-refinery"] = state;
  await loadRefineryTab("guides-refinery");
}

function smugglerRiskClass(risk) {
  const r = String(risk || "").toLowerCase();
  if (r.includes("very high") || r === "high") return "risk-high";
  if (r.includes("medium")) return "risk-medium";
  return "risk-low";
}

function renderSmugglerRouteInlineDetail(route) {
  if (!route) return `<p class="muted small">Route data unavailable.</p>`;

  const hints = (route.commodityHints || [])
    .map((h) => `<span class="tag-chip">${escapeHtml(h)}</span>`)
    .join("");
  const commodityRows = (route.commodities || [])
    .map(
      (c) => `<tr>
        <td><strong>${displayText(c.name)}</strong></td>
        <td>${escapeHtml(fmtScuPrice(c.buy))}<div class="muted small">avg purchase cost</div></td>
        <td>${escapeHtml(fmtScuPrice(c.sell))}<div class="muted small">avg sale payout</div></td>
        <td class="${(c.spread || 0) < 0 ? "commodity-spread-negative" : "commodity-spread-positive"}">${escapeHtml(fmtScuPrice(c.spread))}</td>
      </tr>`
    )
    .join("");

  const tr = route.terminalRoute;
  const topName =
    tr?.name || route.commodities?.[0]?.name || route.commodityHints?.[0] || "Unknown commodity";
  const routeLoss = tr && tr.spreadPerScu < 0;
  const lossBanner = routeLoss
    ? `<p class="trade-route-loss-warn"><strong>This route loses money at these terminals.</strong> You spend more to buy each SCU than the sell terminal pays you for it. That is not two separate payouts — buy cost and sale payout are compared for the same cargo.</p>`
    : "";

  let terminalHtml = "";
  if (tr?.buyTerminal && tr?.sellTerminal) {
    const buy = tr.buyTerminal;
    const sell = tr.sellTerminal;
    const caps = [
      tr.stockLimited ? "stock capped" : null,
      tr.demandLimited ? "demand capped" : null,
    ]
      .filter(Boolean)
      .join(", ");
    const profitClass = tr.totalProfit < 0 ? "trade-profit-loss" : "commodity-spread-positive";
    terminalHtml = `${lossBanner}${fmtNetPerScuLine(buy.sellToYouPrice, sell.buyFromYouPrice)}<div class="trade-route-detail-grid">
      <div class="trade-route-detail-card">
        <span class="refinery-result-label">1 · Buy cargo here</span>
        <strong>${displayText(topName)}</strong>
        <span>${displayText(buy.terminal || "Unknown terminal")}</span>
        <span class="muted small">${displayText(buy.location || buy.system || "")}</span>
        <span>${fmtPurchaseCostPerScu(buy.sellToYouPrice)} · <strong>${formatFleetCell(buy.stockScu)} SCU in stock</strong>${buy.stockUpdatedAt ? ` <span class="muted small">(${escapeHtml(fmtDateTime(buy.stockUpdatedAt))})</span>` : ""}</span>
      </div>
      <div class="trade-route-detail-card">
        <span class="refinery-result-label">2 · Sell cargo here</span>
        <strong>${displayText(topName)}</strong>
        <span>${displayText(sell.terminal || "Unknown terminal")}</span>
        <span class="muted small">${displayText(sell.location || sell.system || "")}</span>
        <span>${fmtSalePayoutPerScu(sell.buyFromYouPrice)} · demand ${formatFleetCell(sell.demandScu)} SCU</span>
      </div>
      <div class="trade-route-detail-card trade-route-profit-card">
        <span class="refinery-result-label">Est. ${tr.totalProfit < 0 ? "loss" : "profit"} (${formatFleetCell(tr.commodityScu || 0)} SCU haul)</span>
        <strong class="${profitClass}">${fmtAuec(tr.totalProfit)}</strong>
        <span class="muted small">${formatFleetCell(tr.commodityUnits)} units · ${formatFleetCell(tr.commodityScu)} SCU${caps ? ` · ${caps}` : ""}</span>
        <span class="muted small">${tr.spreadIsEstimate ? "UEX average spread (not this terminal pair): " : "Net per SCU: "}${fmtSpreadPerScu(tr.spreadPerScu)}</span>
      </div>
    </div>`;
  }

  const buys = (route.buyLocations || []).map((l) => `<li>${displayText(l)}</li>`).join("");
  const sells = (route.sellLocations || []).map((l) => `<li>${displayText(l)}</li>`).join("");

  return `<article class="inline-detail-inner smuggle-route-detail">
    <header class="smuggle-detail-head">
      <h4>${displayText(route.name)}</h4>
      <span class="risk-badge ${smugglerRiskClass(route.risk)}">${escapeHtml(route.risk || "Unknown")}</span>
    </header>
    <p class="smuggle-commodity-headline"><strong>What to buy:</strong> ${displayText(topName)}</p>
    ${hints ? `<div class="tag-row smuggle-hint-row">${hints}</div>` : ""}
    ${terminalHtml}
    ${commodityRows ? `<h4 class="guide-detail-sub">Matching illegal commodities (UEX)</h4>
      <div class="catalog-table-wrap"><table class="catalog-table smuggle-commodity-table">
        <thead><tr><th>Commodity</th><th>Avg buy cost</th><th>Avg sell payout</th><th>Spread</th></tr></thead>
        <tbody>${commodityRows}</tbody>
      </table></div>` : `<p class="muted small">No UEX illegal commodity matches for this route's hints yet. Refresh prices on the Market tab.</p>`}
    ${route.notes ? `<p class="muted small">${displayText(route.notes)}</p>` : ""}
    ${buys ? `<h4 class="guide-detail-sub">Typical buy areas</h4><ul class="guide-list">${buys}</ul>` : ""}
    ${sells ? `<h4 class="guide-detail-sub">Typical sell areas</h4><ul class="guide-list">${sells}</ul>` : ""}
    <p class="muted small route-action-links">
      <button type="button" class="link" data-market-jump="illegal">Market: illegal filter</button>
      · <button type="button" class="link guide-tab-link" data-tab="guides-trade-routes">Trade routes</button>
    </p>
  </article>`;
}

function renderSmugglerRouteRows(routes) {
  if (!routes?.length) return `<p class="muted">No smuggler routes loaded.</p>`;
  const host = INLINE_HOST.SMUGGLE;
  const colspan = 8;
  const body = routes
    .map((route) => {
      const key = route.id || route.name;
      const tr = route.terminalRoute;
      const commodityName =
        tr?.name || route.commodities?.[0]?.name || route.commodityHints?.[0] || EMPTY_DISPLAY;
      const stockScu = tr?.buyTerminal?.stockScu;
      const stockUpdated = tr?.buyTerminal?.stockUpdatedAt;
      const stockCell =
        stockScu != null && stockScu > 0
          ? `<strong class="smuggle-stock-live">${formatFleetCell(stockScu)} SCU</strong><div class="muted small">${stockUpdated ? `UEX · ${escapeHtml(fmtDateTime(stockUpdated))}` : "at buy terminal"}</div>`
          : tr
            ? `<span class="muted">0 / unknown</span><div class="muted small">no live buy stock</div>`
            : `<span class="muted">—</span><div class="muted small">no matching terminals</div>`;
      const buyCell = tr?.buyTerminal
        ? `${displayText(tr.buyTerminal.terminal)}<div class="muted small">${fmtPurchaseCostPerScu(tr.buyTerminal.sellToYouPrice)}</div>`
        : displayText(route.buyTerminalName || route.buyLocations?.[0] || EMPTY_DISPLAY);
      const sellCell = tr?.sellTerminal
        ? `${displayText(tr.sellTerminal.terminal)}<div class="muted small">${fmtSalePayoutPerScu(tr.sellTerminal.buyFromYouPrice)}</div>`
        : displayText(route.sellTerminalName || route.sellLocations?.[0] || EMPTY_DISPLAY);
      const profitCell = tr
        ? fmtTradeProfit(tr.totalProfit, tr.spreadPerScu)
        : route.topSpread != null
          ? `${escapeHtml(fmtScuPrice(route.topSpread))}<div class="muted small">UEX avg spread</div>`
          : EMPTY_DISPLAY;
      const expanded = isInlineExpanded(host, key);
      return `<tr class="smuggle-route-row ${expandableRowClass(host, key)}" data-smuggle-route="${escapeAttr(key)}" tabindex="0" role="button" aria-expanded="${expanded}">
        <td class="expand-chevron-cell"><span class="expand-chevron" aria-hidden="true">${expandChevron(host, key)}</span></td>
        <td>${displayText(route.name)}</td>
        <td><strong>${displayText(commodityName)}</strong></td>
        <td><span class="risk-badge ${smugglerRiskClass(route.risk)}">${escapeHtml(route.risk || "Unknown")}</span></td>
        <td>${stockCell}</td>
        <td>${buyCell}</td>
        <td>${sellCell}</td>
        <td>${profitCell}</td>
      </tr>${renderInlineDetailRow(colspan, host, key)}`;
    })
    .join("");
  return `<div class="catalog-table-wrap"><table class="catalog-table smuggler-routes-table">
    <thead><tr><th></th><th>Route</th><th>Commodity</th><th>Risk</th><th>Terminal stock</th><th>Buy</th><th>Sell</th><th>Est. profit</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function buildStarStringsPanel(status, opts = {}) {
  const busy = !!opts.busy;
  const progress = opts.progress || null;
  const message = opts.message || status?.error || null;
  const liveOk = !!status?.liveDirExists;
  const installed = !!(status?.filesPresent || status?.installedViaApp);
  const updateAvailable = !!status?.updateAvailable;
  const langOk = !!status?.languageOk;

  const statusLabel = !liveOk
    ? "LIVE folder not found"
    : updateAvailable
      ? "Update available"
      : installed
        ? "Installed"
        : "Not installed";
  const statusClass = !liveOk
    ? "warn"
    : updateAvailable
      ? "update"
      : installed
        ? "ok"
        : "idle";

  const liveLine = status?.liveDir
    ? `<p class="muted small"><strong>LIVE folder:</strong> <code class="star-strings-path">${escapeHtml(status.liveDir)}</code></p>`
    : `<p class="muted small">Set your Game.log path in the footer so StarTracker can find <code>StarCitizen/LIVE</code>.</p>`;

  const installedBits = [];
  if (status?.installed?.name) installedBits.push(escapeHtml(status.installed.name));
  if (status?.installed?.installedAt) {
    installedBits.push(`installed ${escapeHtml(fmtDateTime(status.installed.installedAt))}`);
  }
  if (status?.fileMtime && !status?.installed?.name) {
    installedBits.push(`global.ini · ${escapeHtml(fmtDateTime(status.fileMtime))}`);
  }
  const installedLine = installedBits.length
    ? `<p class="muted small"><strong>Current pack:</strong> ${installedBits.join(" · ")}</p>`
    : "";

  const remoteLine = status?.remote?.name
    ? `<p class="muted small"><strong>Latest release:</strong> ${escapeHtml(status.remote.name)}${
        status.remote.publishedAt ? ` · ${escapeHtml(fmtDateTime(status.remote.publishedAt))}` : ""
      }</p>`
    : "";

  const cfgLine = liveOk
    ? `<p class="muted small"><strong>user.cfg language:</strong> ${
        langOk ? "g_language = english ✓" : "will add g_language = english on install"
      }</p>`
    : "";

  let progressHtml = "";
  if (busy && progress) {
    const pct = progress.percent != null ? `${progress.percent}%` : "";
    const phase = progress.phase ? escapeHtml(String(progress.phase).replace(/_/g, " ")) : "working";
    progressHtml = `<p class="star-strings-progress muted small">Status: ${phase}${pct ? ` · ${pct}` : ""}</p>
      <div class="star-strings-progress-bar" role="progressbar" aria-valuenow="${escapeAttr(String(progress.percent || 0))}" aria-valuemin="0" aria-valuemax="100">
        <span style="width:${Math.max(0, Math.min(100, Number(progress.percent) || 0))}%"></span>
      </div>`;
  }

  const msgHtml = message
    ? `<p class="star-strings-message ${status?.ok === false ? "warn" : ""}">${escapeHtml(message)}</p>`
    : "";

  const installLabel = updateAvailable
    ? "Update Star Strings"
    : installed
      ? "Reinstall Star Strings"
      : "Install Star Strings";

  const actions = `<div class="star-strings-actions">
    <button type="button" class="btn" data-star-strings-install${busy || !liveOk ? " disabled" : ""}>${escapeHtml(installLabel)}</button>
    <button type="button" class="btn btn-ghost" data-star-strings-check${busy ? " disabled" : ""}>Check for updates</button>
    <button type="button" class="btn btn-ghost" data-star-strings-uninstall${busy || !installed ? " disabled" : ""}>Uninstall / restore</button>
    <button type="button" class="btn btn-ghost" data-guide-external="${escapeAttr(status?.projectUrl || "https://github.com/MrKraken/StarStrings")}">Open MrKraken/StarStrings</button>
  </div>`;

  return `<div class="hub-intro hub-intro-accent"><strong>Star Strings</strong> by <button type="button" class="link" data-guide-external="https://github.com/MrKraken/StarStrings">MrKraken</button> adds blueprint pools, <code>[BP]</code> tags, and clearer contract titles in-game. StarTracker installs the official release into your LIVE folder — we do not rehost the pack.</div>
  <section class="guide-section star-strings-panel">
    <h2 class="guide-section-title">Install status</h2>
    <p><span class="star-strings-badge star-strings-badge-${statusClass}">${escapeHtml(statusLabel)}</span></p>
    ${liveLine}
    ${installedLine}
    ${remoteLine}
    ${cfgLine}
    ${progressHtml}
    ${msgHtml}
    ${actions}
  </section>
  <section class="guide-section">
    <h2 class="guide-section-title">Before you install</h2>
    <ul class="star-strings-notes">
      <li>Unofficial community localization. Use at your own discretion (same as installing the zip by hand).</li>
      <li>Update after every Star Citizen patch — stale files cause blank or missing in-game text.</li>
      <li>LIVE only. Avoid PTU builds; new strings appear every wave.</li>
      <li>Your existing <code>user.cfg</code> is kept. We only ensure <code>g_language = english</code> is set.</li>
      <li>Previous <code>global.ini</code> is backed up so Uninstall can restore it.</li>
    </ul>
  </section>`;
}

async function loadStarStringsTab(tabId, options = {}) {
  if (options.busy != null) starStringsUiState.busy = !!options.busy;
  if ("progress" in options) starStringsUiState.progress = options.progress;
  if ("message" in options) starStringsUiState.message = options.message;
  if (options.status) starStringsUiState.status = options.status;

  const shouldFetch = !!options.forceStatus || !starStringsUiState.status;
  if (shouldFetch) {
    setPanelHtml(tabId, `<p class="muted small">Checking Star Strings…</p>`);
    try {
      const status = await window.debrief.starStringsStatus({
        checkRemote: !!options.checkRemote,
      });
      starStringsUiState.status = status;
      if (status?.error && !starStringsUiState.message) {
        starStringsUiState.message = status.error;
      }
    } catch (e) {
      setPanelHtml(
        tabId,
        `<p class="muted">Star Strings error: ${escapeHtml(e.message || String(e))}</p>`
      );
      return;
    }
  }

  setPanelHtml(
    tabId,
    buildStarStringsPanel(starStringsUiState.status, {
      busy: starStringsUiState.busy,
      progress: starStringsUiState.progress,
      message: starStringsUiState.message,
    })
  );
}

function buildSmugglerRoutesPanel(data) {
  const routes = data.routes || [];
  if (!routes.length) return `<p class="muted">No smuggler routes loaded.</p>`;
  const disclaimer = data.disclaimer
    ? `<p class="guides-meta muted small">${displayText(data.disclaimer)}</p>`
    : "";
  const stockMeta = data.meta?.stockFetchedAt
    ? `<p class="guides-meta muted small">Live UEX buy stock (last reported SCU) · ${escapeHtml(fmtDateTime(data.meta.stockFetchedAt))} · <button type="button" class="link" id="smugglerRefreshStockBtn">Refresh stock</button></p>`
    : "";
  const intro = `<div class="hub-intro hub-intro-accent"><strong>Curated smuggling loops.</strong> Terminal stock is last-reported UEX buy SCU for the matched buy terminal — not a historical minimum. Rows without a match show — instead of inventing another terminal.</div>`;
  const tableHtml = renderSmugglerRouteRows(routes);
  smugglerRoutesLastPayload = { tableHtml, routes };
  return `${intro}${stockMeta}${disclaimer}${tableHtml}`;
}

let execHangarTickTimer = null;
let execHangarLastStatus = null;

function stopExecHangarTick() {
  if (execHangarTickTimer) {
    clearInterval(execHangarTickTimer);
    execHangarTickTimer = null;
  }
}

function formatExecCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function computeExecHangarClientStatus(base, nowMs = Date.now()) {
  if (!base?.ok) return base;
  const elapsed = nowMs - new Date(base.at).getTime();
  const tic =
    (((base.timeInCycleMs + elapsed) % base.cycleDurationMs) + base.cycleDurationMs) %
    base.cycleDurationMs;
  const online = tic < base.openDurationMs;
  // Recompute light pattern client-side from time-in-cycle.
  const GREEN_STEP = 12 * 60 * 1000;
  const RED_STEP = 24 * 60 * 1000;
  let lights;
  if (tic < base.openDurationMs) {
    if (tic >= GREEN_STEP * 5) lights = ["empty", "empty", "empty", "empty", "empty"];
    else {
      const greenCount = Math.max(0, 5 - Math.floor(tic / GREEN_STEP));
      lights = Array.from({ length: 5 }, (_, i) => (i < greenCount ? "green" : "empty"));
    }
  } else {
    const offlineMs = tic - base.openDurationMs;
    const greened = Math.min(4, Math.floor(offlineMs / RED_STEP));
    lights = Array.from({ length: 5 }, (_, i) => (i < greened ? "green" : "red"));
  }
  const green = lights.filter((c) => c === "green").length;
  const red = lights.filter((c) => c === "red").length;
  const empty = lights.filter((c) => c === "empty").length;
  let phase;
  if (online && green > 0 && red === 0) {
    phase = { id: "open", label: "OPEN", detail: "Insert compboards — hangar access window", canInsert: true };
  } else if (online && empty === 5) {
    phase = { id: "reset", label: "RESET", detail: "Blackout / death zone — evacuate before doors close", canInsert: false };
  } else if (!online && red > 0) {
    phase = { id: "charging", label: "CHARGING", detail: "Hangar closed — red lights turning green", canInsert: false };
  } else {
    phase = { id: "unknown", label: "UNKNOWN", detail: "Wait for next light change", canInsert: false };
  }
  const boundaries = [];
  for (let i = 1; i <= 5; i += 1) boundaries.push(i * GREEN_STEP);
  boundaries.push(base.openDurationMs);
  for (let i = 1; i <= 5; i += 1) boundaries.push(base.openDurationMs + i * RED_STEP);
  boundaries.push(base.cycleDurationMs);
  const nextBoundary = boundaries.find((b) => b > tic + 0.5) ?? base.cycleDurationMs;
  const msToLight = nextBoundary - tic;
  const msToPhase = online ? base.openDurationMs - tic : base.cycleDurationMs - tic;
  return {
    ...base,
    online,
    status: online ? "ONLINE" : "OFFLINE",
    phase,
    lights,
    greenCount: green,
    redCount: red,
    timeInCycleMs: tic,
    msToNextLight: msToLight,
    msToPhaseChange: msToPhase,
    nextLightIn: formatExecCountdown(msToLight),
    phaseEndsIn: formatExecCountdown(msToPhase),
  };
}

function renderExecHangarLights(lights) {
  return (lights || [])
    .map((color, i) => {
      const cls =
        color === "green" ? "is-green" : color === "red" ? "is-red" : "is-empty";
      return `<span class="exec-hangar-light ${cls}" title="Light ${i + 1}: ${color}" aria-label="Light ${i + 1} ${color}"></span>`;
    })
    .join("");
}

function buildExecHangarPanel(status) {
  if (!status?.ok) {
    return `<p class="muted">${escapeHtml(status?.error || "Hangar timer unavailable.")}</p>
      <p class="muted small"><button type="button" class="link" id="execHangarRefreshBtn">Sync timer config</button></p>`;
  }
  const live = computeExecHangarClientStatus(status);
  const phaseClass = `exec-phase-${live.phase?.id || "unknown"}`;
  const statusClass = live.online ? "is-online" : "is-offline";
  const upcoming = (status.upcoming || [])
    .map(
      (e) => `<tr>
        <td>${escapeHtml(e.label || e.status)}</td>
        <td>${escapeHtml(fmtDateTime(e.at))}</td>
        <td><span class="exec-phase-chip exec-phase-${escapeAttr(e.phase?.id || "")}">${escapeHtml(e.phase?.label || e.status)}</span></td>
      </tr>`
    )
    .join("");
  const offsetMin = Math.round((live.offsetMs || 0) / 60000);
  const attr = live.attribution
    ? `<p class="muted small">Cycle calibrated from <button type="button" class="link" data-guide-external="${escapeAttr(live.attribution.url || "https://github.com/ArkanisCorporation/Exec-Hangar")}">${escapeHtml(live.attribution.name || "community timer")}</button>. ${escapeHtml(live.attribution.note || "")}</p>`
    : "";
  const refreshNote = status.refreshError
    ? `<p class="muted small">Sync warning: ${escapeHtml(status.refreshError)} — using ${escapeHtml(live.source || "seed")} config.</p>`
    : "";

  return `<div class="exec-hangar-panel" data-exec-hangar-root>
    <div class="hub-intro hub-intro-accent"><strong>PYAM Executive Hangar.</strong> Global cycle — five lights match the hangar EVA indicators. Compboards only while green with no reds.</div>
    <div class="exec-hangar-status-card ${statusClass} ${phaseClass}">
      <div class="exec-hangar-status-top">
        <div>
          <span class="exec-hangar-status-label">${escapeHtml(live.status)}</span>
          <strong class="exec-hangar-phase" data-exec-phase>${escapeHtml(live.phase?.label || "—")}</strong>
          <p class="muted small" data-exec-phase-detail>${escapeHtml(live.phase?.detail || "")}</p>
        </div>
        <div class="exec-hangar-countdowns">
          <div>
            <span class="refinery-result-label">Next light</span>
            <strong class="exec-hangar-clock" data-exec-next-light>${escapeHtml(live.nextLightIn)}</strong>
          </div>
          <div>
            <span class="refinery-result-label">${live.online ? "Window ends" : "Opens in"}</span>
            <strong class="exec-hangar-clock" data-exec-phase-end>${escapeHtml(live.phaseEndsIn)}</strong>
          </div>
        </div>
      </div>
      <div class="exec-hangar-lights" data-exec-lights aria-label="Hangar status lights">
        ${renderExecHangarLights(live.lights)}
      </div>
      <p class="exec-hangar-insert ${live.phase?.canInsert ? "is-ready" : "is-blocked"}" data-exec-insert>
        ${live.phase?.canInsert ? "Ready — insert all 7 compboards" : "Do not insert — wait for open window"}
      </p>
    </div>
    <div class="exec-hangar-toolbar">
      <button type="button" class="btn btn-sm" id="execHangarRefreshBtn">Sync cycle</button>
      <button type="button" class="btn btn-sm btn-ghost" id="execHangarOffsetMinus" title="Nudge −1 min">−1m</button>
      <button type="button" class="btn btn-sm btn-ghost" id="execHangarOffsetPlus" title="Nudge +1 min">+1m</button>
      <button type="button" class="btn btn-sm btn-ghost" id="execHangarOffsetReset" title="Clear nudge">Reset nudge</button>
      <span class="muted small">Offset: <strong data-exec-offset>${offsetMin}m</strong></span>
    </div>
    ${refreshNote}
    <p class="guides-meta muted small">${escapeHtml(live.versionInfo || "Community hangar cycle")}${live.fetchedAt ? ` · synced ${escapeHtml(fmtDateTime(live.fetchedAt))}` : ` · ${escapeHtml(live.source || "seed")}`}</p>
    ${upcoming ? `<h3 class="guide-section-title">Upcoming phase changes</h3>
      <div class="catalog-table-wrap"><table class="catalog-table">
        <thead><tr><th>Event</th><th>Local time</th><th>Phase</th></tr></thead>
        <tbody>${upcoming}</tbody>
      </table></div>` : ""}
    ${attr}
    <p class="muted small">Keep Windows time sync on for accuracy. After a major patch, use <strong>Sync cycle</strong>. If in-game lights disagree, nudge ±1 minute.</p>
  </div>`;
}

function patchExecHangarLiveDom() {
  const root = document.querySelector("#panel-guides-exec-hangar [data-exec-hangar-root]");
  if (!root || !execHangarLastStatus?.ok) return;
  const live = computeExecHangarClientStatus(execHangarLastStatus);
  const phaseEl = root.querySelector("[data-exec-phase]");
  const detailEl = root.querySelector("[data-exec-phase-detail]");
  const nextEl = root.querySelector("[data-exec-next-light]");
  const endEl = root.querySelector("[data-exec-phase-end]");
  const lightsEl = root.querySelector("[data-exec-lights]");
  const insertEl = root.querySelector("[data-exec-insert]");
  const card = root.querySelector(".exec-hangar-status-card");
  if (phaseEl) phaseEl.textContent = live.phase?.label || "—";
  if (detailEl) detailEl.textContent = live.phase?.detail || "";
  if (nextEl) nextEl.textContent = live.nextLightIn;
  if (endEl) endEl.textContent = live.phaseEndsIn;
  if (lightsEl) lightsEl.innerHTML = renderExecHangarLights(live.lights);
  if (insertEl) {
    insertEl.classList.toggle("is-ready", !!live.phase?.canInsert);
    insertEl.classList.toggle("is-blocked", !live.phase?.canInsert);
    insertEl.textContent = live.phase?.canInsert
      ? "Ready — insert all 7 compboards"
      : "Do not insert — wait for open window";
  }
  if (card) {
    card.classList.toggle("is-online", !!live.online);
    card.classList.toggle("is-offline", !live.online);
    card.className = card.className
      .replace(/exec-phase-\w+/g, "")
      .trim();
    card.classList.add(`exec-phase-${live.phase?.id || "unknown"}`);
  }
}

function startExecHangarTick() {
  stopExecHangarTick();
  patchExecHangarLiveDom();
  execHangarTickTimer = setInterval(patchExecHangarLiveDom, 1000);
}

async function loadExecHangarTab(tabId) {
  stopExecHangarTick();
  setPanelHtml(tabId, `<p class="muted small">Loading hangar timer…</p>`);
  try {
    const status = await window.debrief.guidesGetExecHangar();
    execHangarLastStatus = status;
    setPanelHtml(tabId, buildExecHangarPanel(status));
    startExecHangarTick();
  } catch (e) {
    setPanelHtml(
      tabId,
      `<p class="muted">Hangar timer error: ${escapeHtml(e.message || String(e))}</p>`
    );
  }
}

function summarizeWikeloInputs(inputs) {
  if (!inputs?.length) return EMPTY_DISPLAY;
  if (inputs.length === 1) return inputs[0].requirement || inputs[0].name;
  const first = inputs[0].requirement || inputs[0].name;
  return `${first} +${inputs.length - 1} more`;
}

function summarizeWikeloRewards(rewards) {
  if (!rewards?.length) return EMPTY_DISPLAY;
  return rewards
    .map((r) => `${r.name}${r.amount > 1 ? ` ×${r.amount}` : ""}`)
    .join(", ");
}

function wikeloToolbar(tabId) {
  const state = wikeloQueryByTab[tabId] || { query: "" };
  const busy = wikeloRefreshBusy ? " disabled" : "";
  return `<div class="catalog-toolbar catalog-toolbar-sticky wikelo-toolbar">
    <input type="search" class="catalog-search" data-wikelo-search="${escapeAttr(tabId)}" placeholder="Search contract, item, reward…" value="${escapeAttr(state.query || "")}" />
    <button type="button" class="btn btn-sm btn-ghost" data-wikelo-search-btn="${escapeAttr(tabId)}">Search</button>
    <button type="button" class="btn btn-sm" data-wikelo-refresh${busy}>Refresh trades</button>
  </div>
  <p class="muted small">Deposit listed items at Wikelo Emporium freight elevators. Expand a row for the full haul list.</p>`;
}

function wikeloMetaLine(meta, total) {
  const when = meta?.fetchedAt ? fmtDateTime(meta.fetchedAt) : null;
  const stale = meta?.stale ? " Using cached copy." : "";
  const busy = wikeloRefreshBusy ? " Refreshing…" : "";
  const count = total != null ? `${total} trades · ` : "";
  const base = when
    ? `${count}Wikelo Emporium from star-citizen.wiki · cached ${escapeHtml(when)}.${busy}${stale}`
    : `${count}Wikelo Emporium from star-citizen.wiki. Not cached yet.${busy}${stale}`;
  return `<p class="guides-meta muted small">${base}</p>`;
}

function renderWikeloItemList(items, label) {
  if (!items?.length) return `<p class="muted small">No ${escapeHtml(label)} listed.</p>`;
  const rows = items
    .map((item) => {
      const amt =
        item.requirement && item.requirement !== item.name
          ? ` — ${escapeHtml(item.requirement)}`
          : item.amount != null && item.amount !== 1
            ? ` ×${escapeHtml(String(item.amount))}`
            : "";
      const link = item.wikiUrl
        ? `<button type="button" class="link" data-guide-external="${escapeAttr(item.wikiUrl)}">${displayText(item.name)}</button>`
        : displayText(item.name);
      return `<li>${link}${amt}</li>`;
    })
    .join("");
  return `<ul class="guide-list wikelo-item-list">${rows}</ul>`;
}

function renderWikeloTradeRows(rows, tabId) {
  if (!rows?.length) {
    return tabId ? emptyPanel(tabById(tabId)) : `<p class="muted">No Wikelo trades match your search.</p>`;
  }
  const host = INLINE_HOST.WIKELO;
  const colspan = 5;
  const body = rows
    .map((row) => {
      const expanded = isInlineExpanded(host, row.id);
      return `<tr class="wikelo-trade-row ${expandableRowClass(host, row.id)}" data-wikelo-trade="${escapeAttr(row.id)}" tabindex="0" role="button" aria-expanded="${expanded}">
        <td class="expand-chevron-cell"><span class="expand-chevron" aria-hidden="true">${expandChevron(host, row.id)}</span></td>
        <td>${displayText(row.title)}</td>
        <td>${displayText(summarizeWikeloInputs(row.inputs))}</td>
        <td>${displayText(summarizeWikeloRewards(row.rewards))}</td>
        <td>${row.repRequired ? displayText(row.repRequired) : EMPTY_DISPLAY}</td>
      </tr>${renderInlineDetailRow(colspan, host, row.id)}`;
    })
    .join("");
  return `<div class="catalog-table-wrap"><table class="catalog-table wikelo-trades-table">
    <thead><tr><th></th><th>Contract</th><th>Trade in</th><th>Reward</th><th>Rep required</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function renderWikeloTradeDetail(row) {
  if (!row) return `<p class="muted small">Trade not found.</p>`;
  const locations = (row.locations || [])
    .slice(0, 12)
    .map((loc) => `<li>${displayText(loc)}</li>`)
    .join("");
  const wikiBtn = row.wikiUrl
    ? `<button type="button" class="btn btn-sm btn-ghost" data-guide-external="${escapeAttr(row.wikiUrl)}">Wiki page</button>`
    : "";
  const repGain =
    row.repGain != null && row.repGain !== 0
      ? `<p class="muted small">Reputation gain: +${escapeHtml(String(row.repGain))}</p>`
      : "";
  return `<article class="inline-detail-inner wikelo-trade-detail">
    ${row.description ? `<p class="muted small">${displayText(row.description)}</p>` : ""}
    <div class="wikelo-detail-grid">
      <div>
        <h4 class="guide-detail-sub">Trade in</h4>
        ${renderWikeloItemList(row.inputs, "inputs")}
      </div>
      <div>
        <h4 class="guide-detail-sub">You receive</h4>
        ${renderWikeloItemList(row.rewards, "rewards")}
      </div>
    </div>
    ${locations ? `<h4 class="guide-detail-sub">Locations</h4><ul class="guide-list">${locations}</ul>` : ""}
    ${repGain}
    ${row.gameVersion ? `<p class="muted small">Game version: ${escapeHtml(row.gameVersion)}</p>` : ""}
    ${wikiBtn}
  </article>`;
}

async function loadWikeloTab(tabId, options = {}) {
  if (!tabId.startsWith("wikelo-")) return;
  const state = wikeloQueryByTab[tabId] || { query: "" };
  wikeloQueryByTab[tabId] = state;
  const category = WIKELO_CATEGORY_BY_TAB[tabId] || "all";
  const filterOnly =
    !!options.filterOnly && document.querySelector(`#panel-${tabId} .wikelo-toolbar`);

  if (!filterOnly) {
    setPanelHtml(
      tabId,
      `${wikeloMetaLine(wikeloMeta)}${wikeloToolbar(tabId)}<p class="muted small">Loading Wikelo trades…</p>`
    );
  }

  try {
    const data = await window.debrief.wikeloGetTrades({
      category,
      query: (state.query || "").trim(),
    });
    wikeloMeta = data.meta;
    const tableHtml = renderWikeloTradeRows(data.rows, tabId);
    wikeloTradesLastPayload = { tabId, rows: data.rows || [], meta: data.meta };
    if (filterOnly) {
      const metaEl = document.querySelector(`#panel-${tabId} .guides-meta`);
      if (metaEl) metaEl.outerHTML = wikeloMetaLine(data.meta, data.total);
      patchPanelTable(`#panel-${tabId}`, tableHtml);
    } else {
      setPanelHtml(
        tabId,
        `${wikeloMetaLine(data.meta, data.total)}${wikeloToolbar(tabId)}${tableHtml}`
      );
    }
  } catch (e) {
    if (!filterOnly) {
      setPanelHtml(
        tabId,
        `${wikeloMetaLine(wikeloMeta)}${wikeloToolbar(tabId)}<p class="muted">Wikelo trades error: ${escapeHtml(e.message || String(e))}</p>`
      );
    }
  }
}

function buildGameLoopsPanel(data) {
  const loops = data.loops || [];
  if (!loops.length) return `<p class="muted">No game loop guides loaded.</p>`;
  return loops
    .map((loop) => {
      const tips = (loop.tips || []).map((t) => `<li>${displayText(t)}</li>`).join("");
      const related = (loop.relatedTabs || [])
        .map((tabId) => {
          const tab = TABS.find((t) => t.id === tabId);
          const label = tab?.label || tabId;
          return `<button type="button" class="link guide-tab-link" data-tab="${escapeAttr(tabId)}">${escapeHtml(label)}</button>`;
        })
        .join(" · ");
      return `<article class="guide-card">
        <header><h3>${displayText(loop.title)}</h3></header>
        <p>${displayText(loop.summary)}</p>
        ${tips ? `<ul class="guide-list">${tips}</ul>` : ""}
        ${related ? `<p class="muted small">Related: ${related}</p>` : ""}
      </article>`;
    })
    .join("");
}

function buildTradeRoutesToolbar(state, presets) {
  const presetOptions = (presets || [])
    .map((p) => {
      const val = p.scu != null ? p.scu : state.cargoScu || 128;
      const selected =
        p.scu != null && Number(state.cargoScu) === p.scu ? " selected" : "";
      return `<option value="${escapeAttr(String(val))}" data-preset="${escapeAttr(p.id)}"${selected}>${escapeHtml(p.label)}${p.scu != null ? ` (${p.scu} SCU)` : ""}</option>`;
    })
    .join("");
  const illegalChecked = state.includeIllegal ? " checked" : "";
  return `<div class="catalog-toolbar trade-routes-toolbar">
    <label class="trade-field"><span class="muted small">Cargo SCU</span>
      <input type="number" id="tradeCargoScu" min="1" max="100000" value="${escapeAttr(String(state.cargoScu || 128))}" />
    </label>
    <select id="tradeShipPreset" class="guide-sort-select" aria-label="Hauler preset">${presetOptions}</select>
    <input type="search" id="tradeRouteSearch" class="catalog-search" placeholder="Filter commodities…" value="${escapeAttr(state.query || "")}" />
    <label class="trade-field trade-checkbox"><input type="checkbox" id="tradeIncludeIllegal"${illegalChecked} /> Include illegal</label>
    <select id="tradeRouteSort" class="guide-sort-select">
      <option value="profit"${state.sort !== "spread" ? " selected" : ""}>Sort: total profit</option>
      <option value="spread"${state.sort === "spread" ? " selected" : ""}>Sort: spread / SCU</option>
    </select>
    <button type="button" class="btn btn-sm" id="tradeRouteCalcBtn">Calculate</button>
    <button type="button" class="btn btn-sm btn-ghost" data-guide-refresh>Refresh prices</button>
  </div>`;
}

function renderTradeRouteInlineDetail(detail) {
  if (!detail?.ok || !detail.route) {
    return `<p class="muted small">${escapeHtml(detail?.error || "Could not load terminal route.")}</p>`;
  }
  const r = detail.route;
  const buy = r.buyTerminal;
  const sell = r.sellTerminal;
  const termRows = (detail.terminals || [])
    .slice(0, 12)
    .map(
      (t) => `<tr>
        <td>${displayText(t.terminal)}</td>
        <td>${displayText(t.location || t.system || "")}</td>
        <td>${escapeHtml(fmtScuPrice(t.sellToYouPrice))}</td>
        <td>${escapeHtml(fmtScuPrice(t.buyFromYouPrice))}</td>
        <td>${formatFleetCell(t.stockScu)}</td>
        <td>${formatFleetCell(t.demandScu)}</td>
      </tr>`
    )
    .join("");
  const caps = [
    r.stockLimited ? "limited by buy stock" : null,
    r.demandLimited ? "limited by sell demand" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return `<article class="inline-detail-inner trade-route-detail">
    ${fmtNetPerScuLine(buy?.sellToYouPrice, sell?.buyFromYouPrice)}
    <div class="trade-route-detail-grid">
      <div class="trade-route-detail-card">
        <span class="refinery-result-label">1 · Buy cargo here</span>
        <strong>${displayText(buy?.terminal || "Unknown")}</strong>
        <span class="muted small">${displayText(buy?.location || buy?.system || "")}</span>
        <span>${fmtPurchaseCostPerScu(buy?.sellToYouPrice)} · ${formatFleetCell(buy?.stockScu)} SCU stock</span>
      </div>
      <div class="trade-route-detail-card">
        <span class="refinery-result-label">2 · Sell cargo here</span>
        <strong>${displayText(sell?.terminal || "Unknown")}</strong>
        <span class="muted small">${displayText(sell?.location || sell?.system || "")}</span>
        <span>${fmtSalePayoutPerScu(sell?.buyFromYouPrice)} · ${formatFleetCell(sell?.demandScu)} SCU demand</span>
      </div>
      <div class="trade-route-detail-card trade-route-profit-card">
        <span class="refinery-result-label">Route ${r.totalProfit < 0 ? "loss" : "profit"}</span>
        <strong class="${r.totalProfit < 0 ? "trade-profit-loss" : "commodity-spread-positive"}">${fmtAuec(r.totalProfit)}</strong>
        <span class="muted small">${formatFleetCell(r.commodityUnits)} units · invest ${fmtAuec(r.investAuec)}${caps ? ` · ${caps}` : ""}</span>
        <span class="muted small">Net per SCU: ${fmtSpreadPerScu(r.spreadPerScu)}</span>
      </div>
    </div>
    ${detail.disclaimer ? `<p class="muted small">${displayText(detail.disclaimer)}</p>` : ""}
    <h4 class="guide-detail-sub">Other terminals</h4>
    <div class="catalog-table-wrap"><table class="catalog-table">
      <thead><tr><th>Terminal</th><th>Location</th><th>Buy cost / SCU</th><th>Sell payout / SCU</th><th>Stock</th><th>Demand</th></tr></thead>
      <tbody>${termRows || `<tr><td colspan="6" class="muted">No terminal data</td></tr>`}</tbody>
    </table></div>
  </article>`;
}

function fmtTradeStock(stockScu, isTerminal) {
  if (!isTerminal || stockScu == null) {
    return `<span class="muted small">—</span><div class="muted small">UEX avg</div>`;
  }
  const v = Number(stockScu);
  const cls =
    v <= 0 ? "trade-stock-empty" : v < 64 ? "trade-stock-low" : "trade-stock-ok";
  return `<strong class="mono data-readout ${cls}">${formatFleetCell(v)}</strong><div class="muted small">SCU at terminal</div>`;
}

function fmtRouteHaulScu(route) {
  const scu = route?.commodityScu ?? route?.cargoScuUsed ?? 0;
  const units = route?.commodityUnits;
  const weight = route?.weightScu;
  const unitHint =
    units != null && weight > 1 && units !== scu
      ? `<div class="muted small">${formatFleetCell(units)}× ${formatFleetCell(weight)} SCU units</div>`
      : "";
  return `<span class="mono data-readout">${formatFleetCell(scu)}</span>${unitHint}<div class="muted small">max haul SCU</div>`;
}

function fmtTradeDemand(demandScu, isTerminal) {
  if (!isTerminal || demandScu == null) {
    return `<span class="muted small">—</span>`;
  }
  return `<span class="mono data-readout">${formatFleetCell(demandScu)}</span><div class="muted small">SCU demand</div>`;
}

function fmtTradeProfit(profitVal, spreadVal) {
  const loss = Number(profitVal) < 0 || Number(spreadVal) < 0;
  const tier = loss
    ? "trade-profit-loss"
    : profitVal >= 500000
      ? "trade-profit-high"
      : profitVal >= 100000
        ? "trade-profit-mid"
        : "trade-profit-low";
  const spreadLabel =
    spreadVal != null && spreadVal !== 0
      ? loss
        ? `Loss ${escapeHtml(fmtScuPrice(Math.abs(spreadVal)))}/SCU`
        : `${escapeHtml(fmtScuPrice(spreadVal))}/SCU`
      : "";
  return `<strong class="mono data-readout ${tier}">${fmtAuec(profitVal)}</strong>${spreadLabel ? `<div class="muted small">${spreadLabel}</div>` : ""}`;
}

function renderTradeRouteRows(routes) {
  if (!routes?.length) return "";
  const host = INLINE_HOST.TRADE;
  const colspan = 8;
  const body = routes
    .map((r) => {
      const key = r.commodityId || r.id;
      const buy = r.buyTerminal;
      const sell = r.sellTerminal;
      const isTerminal = Boolean(buy?.terminal || sell?.terminal);
      const buyPrice = buy?.sellToYouPrice ?? r.priceBuy;
      const sellPrice = sell?.buyFromYouPrice ?? r.priceSell;
      const buyLabel = buy?.terminal || "UEX avg buy";
      const sellLabel = sell?.terminal || "UEX avg sell";
      const buyLoc = buy?.location || buy?.system || "";
      const sellLoc = sell?.location || sell?.system || "";
      const illegal = r.isIllegal ? `<span class="badge badge-warn">Illegal</span>` : "";
      const expanded = isInlineExpanded(host, key);
      const spreadVal = r.spreadPerScu ?? r.spread ?? r.profitPerScu ?? 0;
      const profitVal = r.totalProfit ?? 0;
      const routeLane = isTerminal
        ? `<div class="trade-route-lane muted small"><span class="trade-route-origin" title="${escapeAttr(buyLoc)}">${displayText(buyLabel)}</span><span class="trade-route-arrow" aria-hidden="true">⟶</span><span class="trade-route-dest" title="${escapeAttr(sellLoc)}">${displayText(sellLabel)}</span></div>`
        : "";
      return `<tr class="trade-route-row ${expandableRowClass(host, key)}" data-trade-route="${key}" tabindex="0" role="button" aria-expanded="${expanded}">
        <td class="expand-chevron-cell"><span class="expand-chevron" aria-hidden="true">${expandChevron(host, key)}</span></td>
        <td class="trade-route-commodity">${displayText(r.name)}${illegal ? ` ${illegal}` : ""}<div class="muted small mono">${escapeHtml(r.code || "")}</div>${routeLane}</td>
        <td class="trade-route-buy">${displayText(buyLabel)}<div class="muted small mono">${fmtPurchaseCostPerScu(buyPrice > 0 ? buyPrice : null)}</div></td>
        <td class="trade-route-stock">${fmtTradeStock(buy?.stockScu, isTerminal)}</td>
        <td class="trade-route-sell">${displayText(sellLabel)}<div class="muted small mono">${fmtSalePayoutPerScu(sellPrice > 0 ? sellPrice : null)}</div></td>
        <td class="trade-route-demand">${fmtTradeDemand(sell?.demandScu, isTerminal)}</td>
        <td class="trade-route-scu">${fmtRouteHaulScu(r)}</td>
        <td class="trade-route-profit">${fmtTradeProfit(profitVal, spreadVal)}</td>
      </tr>${renderInlineDetailRow(colspan, host, key)}`;
    })
    .join("");
  return `<div class="catalog-table-wrap trade-routes-wrap"><table class="catalog-table trade-routes-table">
    <thead><tr><th></th><th>Commodity</th><th>Buy cost / SCU</th><th>Stock</th><th>Sell payout / SCU</th><th>Demand</th><th>SCU</th><th>Est. profit</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function buildTradeRoutesPanel(data, presets) {
  const state = guideQueryByTab["guides-trade-routes"] || {};
  let routes = [...(data.routes || [])].map((r) => ({
    ...r,
    spreadPerScu: r.spreadPerScu ?? r.spread ?? r.profitPerScu ?? 0,
  }));
  if (state.sort === "spread") {
    routes.sort((a, b) => (b.spreadPerScu || 0) - (a.spreadPerScu || 0) || (b.totalProfit || 0) - (a.totalProfit || 0));
  } else {
    routes.sort((a, b) => (b.totalProfit || 0) - (a.totalProfit || 0) || (b.spreadPerScu || 0) - (a.spreadPerScu || 0));
  }
  const toolbar = buildTradeRoutesToolbar(state, presets);
  const disclaimer = data.disclaimer
    ? `<p class="guides-meta muted small">${displayText(data.disclaimer)}</p>`
    : "";
  const meta = data.meta?.fetchedAt
    ? `<p class="guides-meta muted small">${routes.length} terminal routes · UEX cached ${escapeHtml(fmtDateTime(data.meta.fetchedAt))}${data.meta.stale ? " · using stale cache" : ""}</p>`
    : "";

  if (!routes.length) {
    return `${meta}${toolbar}${disclaimer}<p class="muted">No profitable routes match your filters. Try refreshing UEX prices or including more commodities.</p>`;
  }

  const tableHtml = renderTradeRouteRows(routes);
  tradeRoutesLastPayload = { tableHtml, routes, cargoScu: data.cargoScu || state.cargoScu || 128 };

  return `${meta}
    <div class="hub-intro hub-intro-accent hub-intro-trade"><strong>Trade profit calculator.</strong> Terminal-level buy/sell pairs for <span class="mono data-readout">${escapeHtml(String(data.cargoScu || state.cargoScu || 128))} SCU</span> cargo — profit capped by stock &amp; demand. <strong>Expand any row</strong> for all terminals.</div>
    ${toolbar}
    ${disclaimer}
    ${tableHtml}
    <p class="muted small"><button type="button" class="link guide-tab-link" data-tab="guides-commodities">Terminal breakdown</button> · <button type="button" class="link guide-tab-link" data-tab="guides-smuggling">Smuggler routes</button></p>`;
}

function buildExternalToolsHubPanel(data, starmapSystems = []) {
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  const inAppCount = data?.inAppCount || 0;
  const dataSources = Array.isArray(data?.dataSources) ? data.dataSources : [];
  const systems = Array.isArray(starmapSystems) ? starmapSystems : [];
  const disclaimer = data?.disclaimer
    ? `<p class="guides-meta muted small">${displayText(data.disclaimer)}</p>`
    : "";
  const intro = `<div class="hub-intro"><strong>Community tools directory.</strong> ${inAppCount} tools overlap with in-app tabs. ${dataSources.filter((d) => d.integrated === true).length} data sources are integrated into StarTracker; others open in your browser.</div>`;

  const stackCards = dataSources
    .map((src) => {
      const badge =
        src.integrated === true
          ? `<span class="badge badge-success">Integrated</span>`
          : src.integrated === "links"
            ? `<span class="badge badge-warn">Cross-linked</span>`
            : `<span class="badge badge-muted">External</span>`;
      const powers = (src.powers || []).map((p) => `<li>${displayText(p)}</li>`).join("");
      const openBtn = src.url
        ? `<button type="button" class="btn btn-sm btn-ghost" data-guide-external="${escapeAttr(src.url)}">Open</button>`
        : "";
      return `<article class="guide-card data-source-card">
        <header><h3>${displayText(src.name)} ${badge}</h3></header>
        <p>${displayText(src.description)}</p>
        ${powers ? `<ul class="guide-list data-source-powers">${powers}</ul>` : ""}
        ${openBtn}
      </article>`;
    })
    .join("");

  const systemChips = systems
    .filter((s) => s?.rsiUrl || s?.webUrl)
    .map(
      (s) =>
        `<button type="button" class="quick-nav-chip" data-guide-external="${escapeAttr(s.rsiUrl || s.webUrl)}" title="RSI Starmap">${escapeHtml(s.name || "System")}</button>`
    )
    .join("");

  const starmapSection = systemChips
    ? `<section class="guide-section"><h2 class="guide-section-title">Starmap systems (RSI + scunpacked)</h2><p class="muted small">Quick jump to major systems on RSI Starmap. Location data comes from api.star-citizen.wiki — the same scunpacked pipeline SCUnpacked and starcitizen.tools use.</p><div class="starmap-system-chips">${systemChips}</div></section>`
    : "";

  const dataStackSection = stackCards
    ? `<section class="guide-section"><h2 class="guide-section-title">Integrated data stack</h2><p class="muted small">What powers StarTracker vs what we link out to (SCodex loot tables, HubCitizen RSI sync, etc.).</p><div class="data-source-grid">${stackCards}</div></section>`
    : "";

  const sections = categories
    .map((cat) => {
      const cards = (cat.tools || [])
        .map((tool) => {
          const status =
            tool.status === "deprecated"
              ? `<span class="badge badge-muted">Ended</span> `
              : "";
          const inApp = tool.inAppTab
            ? `<p class="external-tool-inapp"><span class="badge badge-success">In StarTracker</span> <button type="button" class="link guide-tab-link" data-tab="${escapeAttr(tool.inAppTab)}">${escapeHtml(TABS.find((t) => t.id === tool.inAppTab)?.label || tool.inAppTab)}</button>${tool.inAppNote ? `<span class="muted small"> · ${displayText(tool.inAppNote)}</span>` : ""}</p>`
            : tool.integrated === true
              ? `<p class="external-tool-inapp"><span class="badge badge-success">Data integrated</span>${tool.inAppNote ? `<span class="muted small"> · ${displayText(tool.inAppNote)}</span>` : ""}</p>`
              : tool.integrated === "links"
                ? `<p class="external-tool-inapp"><span class="badge badge-warn">Cross-linked</span>${tool.inAppNote ? `<span class="muted small"> · ${displayText(tool.inAppNote)}</span>` : ""}</p>`
                : `<p class="muted small external-tool-external-only">External only${tool.inAppNote ? `: ${displayText(tool.inAppNote)}` : ""}</p>`;
          const tags = (tool.tags || [])
            .map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`)
            .join("");
          const openBtn = tool.url
            ? `<button type="button" class="btn btn-sm btn-ghost" data-guide-external="${escapeAttr(tool.url)}">Open site</button>`
            : "";
          return `<article class="guide-card external-tool-card">
            <header><h3>${status}${displayText(tool.name)}</h3>${tags ? `<div class="tag-row">${tags}</div>` : ""}</header>
            <p>${displayText(tool.description)}</p>
            ${inApp}
            ${openBtn}
          </article>`;
        })
        .join("");
      if (!cards) return "";
      return `<section class="guide-section"><h2 class="guide-section-title">${displayText(cat.title)}</h2><p class="muted small">${displayText(cat.summary || "")}</p><div class="external-tools-grid">${cards}</div></section>`;
    })
    .join("");

  return `${intro}${disclaimer}${dataStackSection}${starmapSection}${sections || `<p class="muted">No tools listed.</p>`}`;
}

function buildReputationPanel(data) {
  const factions = data.factions || [];
  const disclaimer = data.disclaimer
    ? `<p class="guides-meta muted small">${displayText(data.disclaimer)}</p>`
    : "";
  const sessionLine =
    data.sessionTotal > 0
      ? `<p class="guides-meta muted small">This session: <strong>${formatFleetCell(data.sessionTotal)}</strong> rep from confirmed Game.log rewards.</p>`
      : `<p class="guides-meta muted small">No reputation rewards logged this session yet.</p>`;

  if (!factions.length) {
    return `${sessionLine}${disclaimer}<p class="muted">Complete contracts that award reputation. StarTracker accumulates totals locally across sessions.</p>
      <p class="muted small"><button type="button" class="link guide-tab-link" data-tab="rewards">Open Rewards tab</button></p>`;
  }

  const tierLegend = (data.tiers || [])
    .map((t) => `<span class="rep-tier-chip">${escapeHtml(t.name)} (${formatFleetCell(t.min)}+)</span>`)
    .join(" ");

  const rows = factions
    .map((f) => {
      const bar =
        f.nextStanding && f.progressPercent != null
          ? `<div class="rep-progress" role="progressbar" aria-valuenow="${f.progressPercent}" aria-valuemin="0" aria-valuemax="100"><div class="rep-progress-fill" style="width:${Math.min(100, f.progressPercent)}%"></div></div><p class="muted small">${formatFleetCell(f.repToNext)} rep to ${escapeHtml(f.nextStanding)} (est.)</p>`
          : `<p class="muted small">Max wiki tier reached (est.)</p>`;
      const sessionBadge =
        f.sessionRep > 0
          ? `<span class="badge badge-success">+${formatFleetCell(f.sessionRep)} session</span>`
          : "";
      return `<article class="guide-card rep-faction-card">
        <header><h3>${displayText(f.faction)} ${sessionBadge}</h3><span class="rep-standing-badge">${escapeHtml(f.standing)}</span></header>
        <p><strong>${formatFleetCell(f.totalRep)}</strong> total rep <span class="muted small">(persistent)</span></p>
        ${bar}
      </article>`;
    })
    .join("");

  return `${sessionLine}${disclaimer}
    <section class="guide-section"><h2 class="guide-section-title">Faction standing</h2><div class="rep-faction-grid">${rows}</div></section>
    <details class="rep-tier-legend"><summary class="muted small">Wiki contractor tiers (estimates)</summary><p class="muted small">${tierLegend}</p></details>
    <p class="muted small"><button type="button" class="link guide-tab-link" data-tab="rewards">Session rewards</button> · <button type="button" class="link guide-tab-link" data-tab="missions">Missions</button></p>`;
}

async function refreshTradeRoutesTab(options = {}) {
  if (activeTab !== "guides-trade-routes") return;
  const state = guideQueryByTab["guides-trade-routes"] || {};
  const cargoInput = $("tradeCargoScu");
  const searchInput = $("tradeRouteSearch");
  const illegalInput = $("tradeIncludeIllegal");
  const sortInput = $("tradeRouteSort");
  if (cargoInput) state.cargoScu = Math.max(1, Number(cargoInput.value) || 128);
  if (searchInput) state.query = searchInput.value;
  if (illegalInput) state.includeIllegal = illegalInput.checked;
  if (sortInput) state.sort = sortInput.value || "profit";
  guideQueryByTab["guides-trade-routes"] = state;
  await loadGuideTab("guides-trade-routes", { filterOnly: !!options.filterOnly });
}

function resortTradeRoutesClient() {
  const state = guideQueryByTab["guides-trade-routes"] || {};
  if (!tradeRoutesLastPayload?.routes?.length) {
    refreshTradeRoutesTab();
    return;
  }
  let routes = [...tradeRoutesLastPayload.routes].map((r) => ({
    ...r,
    spreadPerScu: r.spreadPerScu ?? r.spread ?? r.profitPerScu ?? 0,
  }));
  if (state.sort === "spread") {
    routes.sort(
      (a, b) =>
        (b.spreadPerScu || 0) - (a.spreadPerScu || 0) ||
        (b.totalProfit || 0) - (a.totalProfit || 0)
    );
  } else {
    routes.sort(
      (a, b) =>
        (b.totalProfit || 0) - (a.totalProfit || 0) ||
        (b.spreadPerScu || 0) - (a.spreadPerScu || 0)
    );
  }
  tradeRoutesLastPayload = { ...tradeRoutesLastPayload, routes };
  patchPanelTable("#panel-guides-trade-routes", renderTradeRouteRows(routes));
}

async function loadGuideTab(tabId, options = {}) {
  if (!tabId.startsWith("guides-")) return;

  if (tabId === "guides-patch-notes") {
    setPanelHtml(tabId, `<p class="muted small">Loading patch notes…</p>`);
    try {
      const data = await window.debrief.guidesGetPatchNotes();
      setPanelHtml(tabId, buildPatchNotesPanel(data));
    } catch (e) {
      setPanelHtml(
        tabId,
        `<p class="muted">Patch notes error: ${escapeHtml(e.message || String(e))}</p>`
      );
    }
    return;
  }

  if (tabId === "guides-refinery") {
    await loadRefineryTab(tabId);
    return;
  }

  if (tabId === "guides-crafting") {
    await loadCraftingTab(tabId, options);
    return;
  }

  if (tabId === "guides-smuggling") {
    setPanelHtml(tabId, `<p class="muted small">Loading routes…</p>`);
    try {
      const data = await window.debrief.guidesGetSmugglerRoutes();
      setPanelHtml(tabId, buildSmugglerRoutesPanel(data));
    } catch (e) {
      setPanelHtml(
        tabId,
        `<p class="muted">Routes error: ${escapeHtml(e.message || String(e))}</p>`
      );
    }
    return;
  }

  if (tabId === "guides-exec-hangar") {
    await loadExecHangarTab(tabId);
    return;
  }

  if (tabId === "guides-loops") {
    setPanelHtml(tabId, `<p class="muted small">Loading game loops…</p>`);
    try {
      const data = await window.debrief.guidesGetGameLoops();
      setPanelHtml(tabId, buildGameLoopsPanel(data));
    } catch (e) {
      setPanelHtml(
        tabId,
        `<p class="muted">Game loops error: ${escapeHtml(e.message || String(e))}</p>`
      );
    }
    return;
  }

  if (tabId === "guides-trade-routes") {
    const state = guideQueryByTab["guides-trade-routes"] || {};
    const filterOnly =
      !!options.filterOnly &&
      document.querySelector("#panel-guides-trade-routes .trade-routes-toolbar");
    if (!filterOnly) {
      setPanelHtml(tabId, `<p class="muted small">Loading terminal routes &amp; stock from UEX…</p>`);
    }
    try {
      const [presetsData, data] = await Promise.all([
        window.debrief.guidesGetTradePresets(),
        window.debrief.guidesGetTradeRoutesTerminal({
          cargoScu: state.cargoScu || 128,
          includeIllegal: !!state.includeIllegal,
          query: (state.query || "").trim(),
          sort: state.sort || "profit",
          limit: 50,
        }),
      ]);
      const panelHtml = buildTradeRoutesPanel(data, presetsData.presets || []);
      if (filterOnly) {
        const panel = document.querySelector("#panel-guides-trade-routes .panel-body");
        const table = panel?.querySelector(".trade-routes-wrap, .catalog-table-wrap");
        const emptyMsg = panel?.querySelector(".trade-routes-empty");
        const routes = data.routes || [];
        if (routes.length) {
          emptyMsg?.remove();
          const tableHtml = renderTradeRouteRows(routes);
          if (table) patchPanelTable("#panel-guides-trade-routes", tableHtml);
          else panel?.insertAdjacentHTML("beforeend", tableHtml);
          tradeRoutesLastPayload = {
            routes,
            cargoScu: data.cargoScu || state.cargoScu || 128,
          };
        } else if (panel && !emptyMsg) {
          table?.remove();
          tradeRoutesLastPayload = { routes: [], cargoScu: data.cargoScu || state.cargoScu || 128 };
          panel
            .querySelector(".trade-routes-toolbar")
            ?.insertAdjacentHTML(
              "afterend",
              `<p class="muted trade-routes-empty">No profitable routes match your filters. Try refreshing UEX prices or including more commodities.</p>`
            );
        }
      } else {
        setPanelHtml(tabId, panelHtml);
      }
    } catch (e) {
      if (!filterOnly) {
        setPanelHtml(
          tabId,
          `<p class="muted">Trade routes error: ${escapeHtml(e.message || String(e))}</p>`
        );
      }
    }
    return;
  }

  if (tabId === "guides-reputation") {
    setPanelHtml(tabId, `<p class="muted small">Loading reputation…</p>`);
    try {
      const data = await window.debrief.guidesGetReputation();
      setPanelHtml(tabId, buildReputationPanel(data));
    } catch (e) {
      setPanelHtml(
        tabId,
        `<p class="muted">Reputation error: ${escapeHtml(e.message || String(e))}</p>`
      );
    }
    return;
  }

  if (tabId === "guides-external-tools") {
    setPanelHtml(tabId, `<p class="muted small">Loading Credits to & starmap…</p>`);
    try {
      const [data, systems] = await Promise.all([
        window.debrief.guidesGetExternalToolsHub(),
        window.debrief.starmapListSystems().catch(() => []),
      ]);
      setPanelHtml(tabId, buildExternalToolsHubPanel(data, systems));
    } catch (e) {
      setPanelHtml(
        tabId,
        `<p class="muted">Credits to error: ${escapeHtml(e.message || String(e))}</p>`
      );
    }
    return;
  }

  if (tabId === "guides-star-strings") {
    await loadStarStringsTab(tabId, { forceStatus: true, checkRemote: true });
    return;
  }

  if (tabId === "guides-fleet") {
    await loadFleetCompareTab(tabId, options);
    return;
  }

  if (tabId === "guides-loadout") {
    await loadLoadoutBuilderTab(tabId, options);
    return;
  }

  if (tabId === "guides-commodities") {
    const state = guideQueryByTab[tabId] || {
      query: "",
      offset: 0,
      sort: "name",
      filter: "trade",
    };
    if (options.resetOffset) state.offset = 0;
    guideQueryByTab[tabId] = state;

    const filterOnly =
      !!options.filterOnly && document.querySelector(`#panel-${tabId} .catalog-toolbar`);

    if (!filterOnly) {
      setPanelHtml(
        tabId,
        `${guidesMetaLine(guideCommodityMeta)}${guidesCommodityToolbar(tabId)}<p class="muted small">Loading commodities…</p>`
      );
    }

    try {
      const result = await window.debrief.guidesGetCommodities({
        filter: state.filter,
        query: state.query,
        offset: state.offset,
        limit: 80,
        sort: state.sort,
      });
      guideCommodityMeta = result.meta;
      const tableHtml = renderGuideCommodityRows(result.rows, tabId);
      guideCommodityLastPayload = { tabId, tableHtml };
      const pagerHtml = renderGuideCommodityPager(tabId, result);
      if (filterOnly) {
        patchPanelResults(`#panel-${tabId}`, tableHtml, pagerHtml);
      } else {
        setPanelHtml(
          tabId,
          `${guidesMetaLine(result.meta)}${guidesCommodityToolbar(tabId)}${tableHtml}${pagerHtml}`
        );
      }
    } catch (e) {
      if (!filterOnly) {
        setPanelHtml(
          tabId,
          `${guidesMetaLine(guideCommodityMeta)}${guidesCommodityToolbar(tabId)}<p class="muted">Commodity error: ${escapeHtml(e.message || String(e))}</p>`
        );
      }
    }
  }
}

function initGuidesUi() {
  $("tabPanels")?.addEventListener("click", async (e) => {
    const external = e.target.closest("[data-guide-external]");
    if (external?.dataset.guideExternal) {
      const url = external.dataset.guideExternal.trim();
      if (url) window.debrief.openUpdateUrl(url);
      return;
    }

    if (e.target.closest("#patchNotesRefreshBtn")) {
      setPanelHtml("guides-patch-notes", `<p class="muted small">Refreshing patch notes from wiki…</p>`);
      try {
        const data = await window.debrief.guidesRefreshPatchNotes();
        setPanelHtml("guides-patch-notes", buildPatchNotesPanel(data));
      } catch (err) {
        setPanelHtml(
          "guides-patch-notes",
          `<p class="muted">Refresh failed: ${escapeHtml(err.message || String(err))}</p>`
        );
      }
      return;
    }

    if (e.target.closest("[data-star-strings-check]")) {
      await loadStarStringsTab("guides-star-strings", {
        forceStatus: true,
        checkRemote: true,
        message: null,
      });
      return;
    }

    if (e.target.closest("[data-star-strings-install]")) {
      if (starStringsUiState.busy) return;
      starStringsUiState.busy = true;
      starStringsUiState.message = null;
      starStringsUiState.progress = { phase: "starting", percent: 0 };
      await loadStarStringsTab("guides-star-strings", {
        busy: true,
        progress: starStringsUiState.progress,
        message: null,
      });
      try {
        const result = await window.debrief.starStringsInstall();
        starStringsUiState.busy = false;
        starStringsUiState.progress = null;
        if (result?.ok) {
          starStringsUiState.status = result.status || null;
          starStringsUiState.message = result.message || "Installed.";
          await loadStarStringsTab("guides-star-strings", {
            busy: false,
            progress: null,
            forceStatus: !result.status,
            checkRemote: true,
            message: starStringsUiState.message,
            status: result.status || undefined,
          });
        } else {
          starStringsUiState.message = result?.error || "Install failed.";
          await loadStarStringsTab("guides-star-strings", {
            busy: false,
            progress: null,
            forceStatus: true,
            checkRemote: false,
            message: starStringsUiState.message,
          });
        }
      } catch (err) {
        starStringsUiState.busy = false;
        starStringsUiState.progress = null;
        starStringsUiState.message = err.message || String(err);
        await loadStarStringsTab("guides-star-strings", {
          busy: false,
          progress: null,
          forceStatus: true,
          message: starStringsUiState.message,
        });
      }
      return;
    }

    if (e.target.closest("[data-star-strings-uninstall]")) {
      if (starStringsUiState.busy) return;
      const ok = window.confirm(
        "Remove Star Strings from your LIVE folder and restore the previous global.ini backup if one exists?"
      );
      if (!ok) return;
      starStringsUiState.busy = true;
      starStringsUiState.message = null;
      await loadStarStringsTab("guides-star-strings", {
        busy: true,
        message: null,
      });
      try {
        const result = await window.debrief.starStringsUninstall();
        starStringsUiState.busy = false;
        if (result?.ok) {
          starStringsUiState.status = result.status || null;
          starStringsUiState.message = result.message || "Uninstalled.";
        } else {
          starStringsUiState.message = result?.error || "Uninstall failed.";
        }
        await loadStarStringsTab("guides-star-strings", {
          busy: false,
          forceStatus: true,
          checkRemote: true,
          message: starStringsUiState.message,
          status: result?.status || undefined,
        });
      } catch (err) {
        starStringsUiState.busy = false;
        starStringsUiState.message = err.message || String(err);
        await loadStarStringsTab("guides-star-strings", {
          busy: false,
          forceStatus: true,
          message: starStringsUiState.message,
        });
      }
      return;
    }

    const tabLink = e.target.closest(".guide-tab-link");
    if (tabLink?.dataset.tab) {
      setActiveTab(tabLink.dataset.tab);
      return;
    }

    const marketJump = e.target.closest("[data-market-jump]");
    if (marketJump?.dataset.marketJump) {
      const filter = marketJump.dataset.marketJump;
      const state = guideQueryByTab["guides-commodities"] || {
        query: "",
        offset: 0,
        sort: filter === "mining" ? "sell" : "spread",
        filter,
      };
      state.filter = filter;
      state.offset = 0;
      if (filter === "mining") state.sort = "sell";
      if (filter === "illegal") state.sort = "spread";
      guideQueryByTab["guides-commodities"] = state;
      setActiveTab("guides-commodities");
      return;
    }

    const marketFilter = e.target.closest("[data-market-filter]");
    if (marketFilter?.dataset.marketFilter) {
      const tabId = "guides-commodities";
      const state = guideQueryByTab[tabId] || { query: "", offset: 0, sort: "name", filter: "trade" };
      state.filter = marketFilter.dataset.marketFilter;
      state.offset = 0;
      if (state.filter === "mining" && state.sort === "name") state.sort = "sell";
      guideQueryByTab[tabId] = state;
      clearInlineExpand();
      loadGuideTab(tabId, { resetOffset: true });
      return;
    }

    const wikeloSearchBtn = e.target.closest("[data-wikelo-search-btn]");
    if (wikeloSearchBtn) {
      const tabId = wikeloSearchBtn.dataset.wikeloSearchBtn;
      const input = document.querySelector(`[data-wikelo-search="${tabId}"]`);
      if (input && wikeloQueryByTab[tabId]) {
        clearInlineExpand();
        wikeloQueryByTab[tabId].query = input.value.trim();
        loadWikeloTab(tabId, { filterOnly: true });
      }
      return;
    }

    if (e.target.closest("[data-wikelo-refresh]")) {
      wikeloRefreshBusy = true;
      if (activeTab.startsWith("wikelo-")) loadWikeloTab(activeTab);
      try {
        await window.debrief.wikeloRefreshTrades();
      } finally {
        wikeloRefreshBusy = false;
        if (activeTab.startsWith("wikelo-")) loadWikeloTab(activeTab);
      }
      return;
    }

    const wikeloRow = e.target.closest("[data-wikelo-trade]");
    if (wikeloRow?.dataset.wikeloTrade) {
      await toggleInlineExpand(INLINE_HOST.WIKELO, wikeloRow.dataset.wikeloTrade);
      return;
    }

    const searchBtn = e.target.closest("[data-guide-search-btn]");
    if (searchBtn) {
      const tabId = searchBtn.dataset.guideSearchBtn;
      const input = document.querySelector(`[data-guide-search="${tabId}"]`);
      if (input && guideQueryByTab[tabId]) {
        clearInlineExpand();
        guideQueryByTab[tabId].query = input.value.trim();
        loadGuideTab(tabId, { resetOffset: true });
      }
      return;
    }

    const refreshBtn = e.target.closest("[data-guide-refresh]");
    if (refreshBtn) {
      guideCommodityRefreshBusy = true;
      if (activeTab.startsWith("guides-")) loadGuideTab(activeTab);
      try {
        await window.debrief.guidesRefreshCommodities();
      } finally {
        guideCommodityRefreshBusy = false;
        if (activeTab.startsWith("guides-")) loadGuideTab(activeTab);
      }
      return;
    }

    const pageBtn = e.target.closest("[data-guide-page]");
    if (pageBtn && !pageBtn.disabled) {
      const tabId = pageBtn.dataset.guidePage;
      const dir = pageBtn.dataset.guideDir;
      const state = guideQueryByTab[tabId];
      if (!state || tabId === "guides-loadout") return;
      const limit = state.limit || 80;
      clearInlineExpand();
      state.offset = Math.max(0, state.offset + (dir === "next" ? limit : -limit));
      loadGuideTab(tabId);
      return;
    }

    const fleetPageBtn = e.target.closest("[data-fleet-page]");
    if (fleetPageBtn && !fleetPageBtn.disabled) {
      const tabId = fleetPageBtn.dataset.fleetPage;
      const dir = fleetPageBtn.dataset.fleetDir;
      const state = guideQueryByTab[tabId];
      if (!state) return;
      clearInlineExpand();
      const limit = state.limit || 80;
      state.offset = Math.max(0, state.offset + (dir === "next" ? limit : -limit));
      guideQueryByTab[tabId] = state;
      loadFleetCompareTab(tabId);
      return;
    }

    const craftingPageBtn = e.target.closest("[data-crafting-page]");
    if (craftingPageBtn && !craftingPageBtn.disabled) {
      const dir = craftingPageBtn.dataset.craftingPage;
      const state = guideQueryByTab["guides-crafting"] || {};
      const meta = craftingSearchMeta || {};
      const pages = meta.lastPage || Math.max(1, Math.ceil((meta.total || 0) / (meta.perPage || 25)));
      const nextPage = (state.page || 1) + (dir === "next" ? 1 : -1);
      if (nextPage < 1 || nextPage > pages) return;
      state.page = nextPage;
      guideQueryByTab["guides-crafting"] = state;
      clearInlineExpand();
      loadCraftingTab("guides-crafting");
      return;
    }

    const commodityRow = e.target.closest(".guide-commodity-row.expandable-row");
    if (commodityRow?.dataset.guideCommodity) {
      await toggleInlineExpand(INLINE_HOST.COMMODITY, commodityRow.dataset.guideCommodity);
      return;
    }

    if (e.target.id === "combatSearchBtn" || e.target.closest("#combatSearchBtn")) {
      const input = $("combatSearchInput");
      const resultsEl = $("combatSearchResults");
      if (!input || !resultsEl) return;
      clearInlineExpand();
      resultsEl.innerHTML = `<p class="muted small">Searching…</p>`;
      try {
        const data = await window.debrief.combatSearch({ query: input.value.trim(), limit: 20 });
        lastCombatSearchRows = data.rows;
        resultsEl.innerHTML = renderCombatSearchResults(data.rows);
      } catch (err) {
        resultsEl.innerHTML = `<p class="muted">Search failed: ${escapeHtml(err.message || String(err))}</p>`;
      }
      return;
    }

    const combatRow = e.target.closest("tr[data-combat-key]");
    if (combatRow?.dataset.combatKey) {
      await toggleInlineExpand(INLINE_HOST.COMBAT, combatRow.dataset.combatKey, {
        kind: combatRow.dataset.combatKind || "item",
      });
      return;
    }

    const fleetRefresh = e.target.closest("[data-fleet-refresh]");
    if (fleetRefresh && activeTab === "guides-fleet") {
      clearInlineExpand();
      fleetCompareCacheKey = null;
      loadFleetCompareTab("guides-fleet", { forceRefresh: true, resetOffset: true });
      return;
    }

    const fleetRow = e.target.closest("tr[data-fleet-key]");
    if (fleetRow?.dataset.fleetKey) {
      await toggleInlineExpand(INLINE_HOST.FLEET, fleetRow.dataset.fleetKey, {
        subKey: fleetRow.dataset.fleetSlug || fleetRow.dataset.fleetKey,
      });
      return;
    }

    if (e.target.id === "refineryCalcBtn" || e.target.closest("#refineryCalcBtn")) {
      await refreshRefineryCalculator();
      return;
    }

    if (e.target.id === "tradeRouteCalcBtn" || e.target.closest("#tradeRouteCalcBtn")) {
      await refreshTradeRoutesTab();
      return;
    }

    if (e.target.id === "craftingSearchBtn" || e.target.closest("#craftingSearchBtn")) {
      const input = $("craftingSearchInput");
      const state = guideQueryByTab["guides-crafting"] || {};
      if (input) state.query = input.value.trim();
      state.page = 1;
      guideQueryByTab["guides-crafting"] = state;
      clearInlineExpand();
      await loadCraftingTab("guides-crafting");
      return;
    }

    const craftingRow = e.target.closest("[data-crafting-blueprint]");
    if (craftingRow?.dataset.craftingBlueprint) {
      await selectCraftingBlueprint(craftingRow.dataset.craftingBlueprint);
      return;
    }

    const tradeRow = e.target.closest("[data-trade-route]");
    if (tradeRow?.dataset.tradeRoute) {
      await toggleInlineExpand(INLINE_HOST.TRADE, tradeRow.dataset.tradeRoute);
      return;
    }

    const smuggleRow = e.target.closest("[data-smuggle-route]");
    if (smuggleRow?.dataset.smuggleRoute) {
      const route = smugglerRoutesLastPayload?.routes?.find(
        (r) => String(r.id || r.name) === smuggleRow.dataset.smuggleRoute
      );
      await toggleInlineExpand(INLINE_HOST.SMUGGLE, smuggleRow.dataset.smuggleRoute, { route });
      return;
    }

    if (e.target.closest("#smugglerRefreshStockBtn")) {
      setPanelHtml("guides-smuggling", `<p class="muted small">Refreshing live UEX stock…</p>`);
      try {
        const data = await window.debrief.guidesRefreshSmugglerRoutes();
        setPanelHtml("guides-smuggling", buildSmugglerRoutesPanel(data));
      } catch (err) {
        setPanelHtml("guides-smuggling", `<p class="muted">Refresh failed: ${escapeHtml(err.message || String(err))}</p>`);
      }
      return;
    }

    if (e.target.closest("#execHangarRefreshBtn")) {
      setPanelHtml("guides-exec-hangar", `<p class="muted small">Syncing hangar cycle…</p>`);
      stopExecHangarTick();
      try {
        const status = await window.debrief.guidesRefreshExecHangar();
        execHangarLastStatus = status;
        setPanelHtml("guides-exec-hangar", buildExecHangarPanel(status));
        startExecHangarTick();
      } catch (err) {
        setPanelHtml(
          "guides-exec-hangar",
          `<p class="muted">Sync failed: ${escapeHtml(err.message || String(err))}</p>`
        );
      }
      return;
    }

    if (e.target.closest("#execHangarOffsetMinus") || e.target.closest("#execHangarOffsetPlus") || e.target.closest("#execHangarOffsetReset")) {
      const cur = execHangarLastStatus?.offsetMs || 0;
      let next = cur;
      if (e.target.closest("#execHangarOffsetMinus")) next = cur - 60000;
      if (e.target.closest("#execHangarOffsetPlus")) next = cur + 60000;
      if (e.target.closest("#execHangarOffsetReset")) next = 0;
      try {
        const status = await window.debrief.guidesSetExecHangarOffset(next);
        execHangarLastStatus = status;
        setPanelHtml("guides-exec-hangar", buildExecHangarPanel(status));
        startExecHangarTick();
      } catch (err) {
        setPanelHtml(
          "guides-exec-hangar",
          `<p class="muted">Offset failed: ${escapeHtml(err.message || String(err))}</p>`
        );
      }
      return;
    }

    if (e.target.id === "loadoutResetStockBtn" || e.target.closest("#loadoutResetStockBtn")) {
      loadoutBuilderState.slotAssignments = {};
      loadoutBuilderState.stockBaseline = null;
      applyLoadoutAssignments();
      return;
    }

    const shipBuilderRow = e.target.closest("tr[data-ship-builder-key]");
    if (shipBuilderRow?.dataset.shipBuilderKey && !e.target.closest("[data-ship-fav-toggle]")) {
      await toggleInlineExpand(INLINE_HOST.SHIP_BUILDER, shipBuilderRow.dataset.shipBuilderKey);
      return;
    }

    const shipFavToggle = e.target.closest("[data-ship-fav-toggle]");
    if (shipFavToggle?.dataset.shipFavToggle) {
      await toggleShipFavorite(
        shipFavToggle.dataset.shipFavToggle,
        shipFavToggle.dataset.shipName,
        shipFavToggle.dataset.shipMfg
      );
      if (activeTab === "guides-loadout") await loadLoadoutBuilderTab("guides-loadout", { soft: true });
      return;
    }

    const shipFavLoad = e.target.closest("[data-ship-fav-load]");
    if (shipFavLoad?.dataset.shipFavLoad) {
      await toggleInlineExpand(INLINE_HOST.SHIP_BUILDER, shipFavLoad.dataset.shipFavLoad);
      return;
    }

    const shipBuilderMode = e.target.closest("[data-ship-builder-mode]");
    if (shipBuilderMode?.dataset.shipBuilderMode) {
      shipBuilderPickMode = shipBuilderMode.dataset.shipBuilderMode;
      loadLoadoutBuilderTab("guides-loadout");
      return;
    }

    if (e.target.closest("#shipBuilderRefreshBtn")) {
      await window.debrief.fleetCompareRefresh();
      loadLoadoutBuilderTab("guides-loadout");
      return;
    }

    const refineryOreChip = e.target.closest("[data-refinery-ore]");
    if (refineryOreChip?.dataset.refineryOre) {
      const state = guideQueryByTab["guides-refinery"] || {};
      state.oreId = refineryOreChip.dataset.refineryOre;
      guideQueryByTab["guides-refinery"] = state;
      const sel = $("refineryOreSelect");
      if (sel) sel.value = state.oreId;
      refreshRefineryCalculator();
      return;
    }

    const refineryStationCard = e.target.closest("[data-refinery-station]");
    if (refineryStationCard?.dataset.refineryStation) {
      const state = guideQueryByTab["guides-refinery"] || {};
      state.stationId = refineryStationCard.dataset.refineryStation;
      guideQueryByTab["guides-refinery"] = state;
      const sel = $("refineryStationSelect");
      if (sel) sel.value = state.stationId;
      refreshRefineryCalculator();
      return;
    }
  });

  $("tabPanels")?.addEventListener("change", (e) => {
    if (e.target.id === "refineryOreSelect" || e.target.id === "refineryStationSelect") {
      refreshRefineryCalculator();
      return;
    }

    if (e.target.id === "tradeShipPreset") {
      const scu = Number(e.target.value);
      if (Number.isFinite(scu) && scu > 0) {
        const cargoInput = $("tradeCargoScu");
        if (cargoInput) cargoInput.value = String(scu);
        refreshTradeRoutesTab();
      }
      return;
    }

    if (e.target.id === "tradeRouteSort") {
      const state = guideQueryByTab["guides-trade-routes"] || {};
      state.sort = e.target.value || "profit";
      guideQueryByTab["guides-trade-routes"] = state;
      resortTradeRoutesClient();
      return;
    }

    if (e.target.id === "tradeIncludeIllegal") {
      refreshTradeRoutesTab();
      return;
    }

    const loadoutSlot = e.target.closest(".loadout-slot-select");
    if (loadoutSlot) {
      applyLoadoutAssignments();
      return;
    }

    const fleetSort = e.target.closest("[data-fleet-sort]");
    if (fleetSort) {
      const tabId = fleetSort.dataset.fleetSort;
      if (!guideQueryByTab[tabId]) return;
      clearInlineExpand();
      guideQueryByTab[tabId].sort = fleetSort.value;
      loadFleetCompareTab(tabId, { resetOffset: true });
      return;
    }

    const sortSelect = e.target.closest("[data-guide-sort]");
    if (!sortSelect) return;
    const tabId = sortSelect.dataset.guideSort;
    if (!guideQueryByTab[tabId]) return;
    clearInlineExpand();
    guideQueryByTab[tabId].sort = sortSelect.value;
    loadGuideTab(tabId, { resetOffset: true });
  });

  $("tabPanels")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest(".expandable-row");
    if (!row) return;
    e.preventDefault();
    row.click();
  });

  $("tabPanels")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const craftingInput = e.target.closest("[data-crafting-search]");
    if (craftingInput) {
      const state = guideQueryByTab["guides-crafting"] || {};
      state.query = craftingInput.value.trim();
      state.page = 1;
      guideQueryByTab["guides-crafting"] = state;
      loadCraftingTab("guides-crafting");
      return;
    }
    const fleetInput = e.target.closest("[data-fleet-search]");
    if (fleetInput) {
      const tabId = fleetInput.dataset.fleetSearch;
      if (!guideQueryByTab[tabId]) return;
      clearInlineExpand();
      guideQueryByTab[tabId].query = fleetInput.value.trim();
      loadFleetCompareTab(tabId, { resetOffset: true });
      return;
    }
    if (e.target.id === "tradeCargoScu") {
      refreshTradeRoutesTab();
      return;
    }
    const wikeloInput = e.target.closest("[data-wikelo-search]");
    if (wikeloInput) {
      const tabId = wikeloInput.dataset.wikeloSearch;
      if (!wikeloQueryByTab[tabId]) return;
      clearInlineExpand();
      wikeloQueryByTab[tabId].query = wikeloInput.value.trim();
      loadWikeloTab(tabId, { filterOnly: true });
      return;
    }
    const input = e.target.closest("[data-guide-search]");
    if (!input) return;
    const tabId = input.dataset.guideSearch;
    if (!guideQueryByTab[tabId]) return;
    clearInlineExpand();
    guideQueryByTab[tabId].query = input.value.trim();
    loadGuideTab(tabId, { resetOffset: true });
  });

  $("tabPanels")?.addEventListener("input", (e) => {
    if (e.target.classList?.contains("crafting-quality-slider")) {
      debouncedCraftingPreview();
      return;
    }

    if (e.target.id === "loadoutShipFilter") {
      const state = guideQueryByTab["guides-loadout"] || { query: "" };
      state.query = e.target.value;
      guideQueryByTab["guides-loadout"] = state;
      debouncedShipBuilderFilter();
      return;
    }

    if (e.target.id === "tradeRouteSearch") {
      const state = guideQueryByTab["guides-trade-routes"] || {};
      state.query = e.target.value;
      guideQueryByTab["guides-trade-routes"] = state;
      debouncedTradeRouteSearch();
      return;
    }

    if (e.target.id === "tradeCargoScu") {
      debouncedTradeRouteScu();
      return;
    }

    const craftingInput = e.target.closest("[data-crafting-search]");
    if (craftingInput) {
      const state = guideQueryByTab["guides-crafting"] || {};
      state.query = craftingInput.value;
      state.page = 1;
      guideQueryByTab["guides-crafting"] = state;
      debouncedCraftingSearch();
      return;
    }

    const fleetInput = e.target.closest("[data-fleet-search]");
    if (fleetInput) {
      const tabId = fleetInput.dataset.fleetSearch;
      if (!guideQueryByTab[tabId]) return;
      guideQueryByTab[tabId].query = fleetInput.value;
      debouncedFleetSearch(tabId);
      return;
    }
    const wikeloInput = e.target.closest("[data-wikelo-search]");
    if (wikeloInput) {
      const tabId = wikeloInput.dataset.wikeloSearch;
      if (!wikeloQueryByTab[tabId]) return;
      wikeloQueryByTab[tabId].query = wikeloInput.value;
      debouncedWikeloSearch(tabId);
      return;
    }
    const input = e.target.closest("[data-guide-search]");
    if (!input) return;
    const tabId = input.dataset.guideSearch;
    if (!guideQueryByTab[tabId]) return;
    guideQueryByTab[tabId].query = input.value;
    debouncedGuideSearch(tabId);
  });
}

async function refreshCatalogStats() {
  try {
    catalogStats = await window.debrief.catalogStats();
    updateTabCounts(getViewRollup(lastKnownState));
  } catch {
    catalogStats = null;
  }
}

function initFavoriteUi() {
  $("tabDescription")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-favorite-tab]");
    if (!btn?.dataset.favoriteTab) return;
    await toggleFavoriteTab(btn.dataset.favoriteTab);
  });
}

function initLoadoutUi() {
  $("tabPanels")?.addEventListener("click", async (e) => {
    const chip = e.target.closest(".loadout-snap-chip");
    if (!chip) return;
    const key = chip.dataset.loadoutSnap;
    if (!key) return;
    await selectLoadoutSnapshot(key);
  });
}

function initCatalogUi() {
  refreshCatalogStats();

  window.debrief.onCatalogSync((payload) => {
    catalogSyncMessage = payload.message || payload.phase || null;
    catalogSyncBusy = payload.phase && payload.phase !== "done" && payload.phase !== "error";
    if (payload.phase === "done" || payload.phase === "error") {
      catalogSyncBusy = false;
      refreshCatalogStats();
      if (activeTab.startsWith("catalog-")) loadCatalogTab(activeTab);
    } else if (activeTab.startsWith("catalog-")) {
      const panel = document.querySelector(`#panel-${activeTab} .panel-body`);
      const meta = panel?.querySelector(".catalog-meta");
      if (meta && catalogSyncMessage) {
        meta.textContent = `Syncing catalog: ${sanitizeDisplayText(catalogSyncMessage)}`;
      }
    }
  });

  $("tabPanels")?.addEventListener("click", async (e) => {
    const searchBtn = e.target.closest("[data-catalog-search-btn]");
    if (searchBtn) {
      const tabId = searchBtn.dataset.catalogSearchBtn;
      const input = document.querySelector(`[data-catalog-search="${tabId}"]`);
      if (input && catalogQueryByTab[tabId]) {
        clearInlineExpand();
        catalogQueryByTab[tabId].query = input.value.trim();
        loadCatalogTab(tabId, { resetOffset: true });
      }
      return;
    }

    const refreshBtn = e.target.closest("[data-catalog-refresh]");
    if (refreshBtn) {
      catalogSyncBusy = true;
      catalogSyncMessage = "Starting…";
      if (activeTab.startsWith("catalog-")) loadCatalogTab(activeTab);
      await window.debrief.catalogRefresh();
      return;
    }

    const pageBtn = e.target.closest("[data-catalog-page]");
    if (pageBtn && !pageBtn.disabled) {
      const tabId = pageBtn.dataset.catalogPage;
      const dir = pageBtn.dataset.catalogDir;
      const state = catalogQueryByTab[tabId];
      if (!state) return;
      const step =
        tabId === "catalog-ships" || tabId === "catalog-ship-services"
          ? 80
          : tabId === "catalog-shops"
            ? 50
            : 80;
      state.offset = Math.max(
        0,
        state.offset + (dir === "next" ? step : -step)
      );
      clearInlineExpand();
      loadCatalogTab(tabId);
      return;
    }

    const catalogRow = e.target.closest(".catalog-row.expandable-row");
    if (catalogRow) {
      const key =
        catalogRow.dataset.catalogItem ||
        catalogRow.dataset.catalogShop ||
        catalogRow.dataset.catalogPlace;
      const kind = catalogRow.dataset.catalogKind || "item";
      if (key) await toggleInlineExpand(INLINE_HOST.CATALOG, key, { kind });
      return;
    }
  });

  $("tabPanels")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const input = e.target.closest("[data-catalog-search]");
    if (!input) return;
    const tabId = input.dataset.catalogSearch;
    clearInlineExpand();
    catalogQueryByTab[tabId].query = input.value.trim();
    loadCatalogTab(tabId, { resetOffset: true });
  });

  $("tabPanels")?.addEventListener("input", (e) => {
    const input = e.target.closest("[data-catalog-search]");
    if (!input) return;
    const tabId = input.dataset.catalogSearch;
    if (!catalogQueryByTab[tabId]) return;
    catalogQueryByTab[tabId].query = input.value;
    debouncedCatalogSearch(tabId);
  });

}

function renderAllPanels(state) {
  const session = archiveViewSession || getViewSession(state);
  const rollup = session?.rollup;
  renderStats(session, state);
  setPanelHtml("overview", buildOverview(session));
  setPanelHtml("missions", buildMissions(rollup));
  setPanelHtml("rewards", buildRewards(rollup));
  setPanelHtml("blueprints", buildBlueprints(rollup));
  setPanelHtml("fines", buildFines(rollup));
  setPanelHtml("insurance", buildInsurance(rollup));
  setPanelHtml("shopping", buildShopping(rollup));
  setPanelHtml("loadout", buildLoadout(rollup));
  if (activeTab === "loadout" && loadoutExpandKey && loadoutCombatByKey[loadoutExpandKey] === undefined) {
    loadLoadoutCombat(loadoutExpandKey).catch(() => {});
  }
  setPanelHtml("deaths", buildDeaths(rollup));
  setPanelHtml("kills", buildKills(rollup));
  setPanelHtml("ships", buildShips(rollup));
  if (!archiveViewSession && !logArchiveLoading) {
    setPanelHtml("history", buildHistoryArchives());
  }
  updateTabCounts(rollup);
}

function resolveDisplaySession(state) {
  if (!state) return lastDisplaySession;
  const current = state.current;
  if (current) {
    lastDisplaySession = current;
    return current;
  }
  const archived =
    lastDisplaySession &&
    state.history?.some((h) => h.id === lastDisplaySession.id);
  if (
    lastDisplaySession?.status === "active" &&
    state.watching &&
    !archived
  ) {
    return lastDisplaySession;
  }
  if (!current) lastDisplaySession = null;
  return null;
}

function formatVersion(version) {
  if (!version) return "";
  return version.startsWith("v") ? version : `v${version}`;
}

function applyUpdateStatus(result) {
  if (!result) return;
  updateInfo = result;
  renderUpdateBanner();
}

function renderUpdateBanner() {
  const banner = $("updateBanner");
  const text = $("updateBannerText");
  if (!banner || !text) return;

  const show =
    updateInfo?.available &&
    !updateBannerDismissed &&
    updateInfo.latestVersion;

  if (!show) {
    banner.classList.add("hidden");
    return;
  }

  const plat = updateInfo.platformLabel ? ` (${updateInfo.platformLabel})` : "";
  text.textContent =
    updateInfo.rebuildNote ||
    `Update available${plat}: ${formatVersion(updateInfo.latestVersion)}`;
  banner.classList.remove("hidden");
}

function initAppInfo() {
  window.debrief.getAppInfo().then((info) => {
    const el = $("appVersion");
    if (el && info?.version) {
      el.textContent = formatVersion(info.version);
    }
  });
}

function initUpdateUi() {
  $("btnDownloadUpdate")?.addEventListener("click", () => installAvailableUpdate());

  $("btnDismissUpdate")?.addEventListener("click", () => {
    updateBannerDismissed = true;
    renderUpdateBanner();
  });

  $("btnCheckUpdates")?.addEventListener("click", async () => {
    const btn = $("btnCheckUpdates");
    const status = $("statusLine");
    const prevStatus = status?.textContent || "";
    if (btn) btn.disabled = true;
    try {
      updateBannerDismissed = false;
      const result = await window.debrief.checkForUpdates();
      applyUpdateStatus(result);
      if (result?.error && status) {
        status.textContent = result.error;
        setTimeout(() => {
          if (status.textContent === result.error) status.textContent = prevStatus;
        }, 6000);
      } else if (result?.available && status) {
        status.textContent = `Update ${formatVersion(result.latestVersion)} ready — click Install update above.`;
      } else if (result && !result.available && !result.error && status) {
        status.textContent = `You're on the latest release (${formatVersion(result.currentVersion)}).`;
        setTimeout(() => {
          if (status.textContent.startsWith("You're on the latest"))
            status.textContent = prevStatus;
        }, 4000);
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  window.debrief.onUpdateDownloadProgress?.((progress) => {
    if (!updateInstalling) return;
    const btn = $("btnDownloadUpdate");
    const status = $("statusLine");
    if (progress?.phase === "installing") {
      if (btn) btn.textContent = "Starting installer…";
      if (status) status.textContent = "Download complete. Starting installer…";
      return;
    }
    if (btn && progress?.percent != null) {
      btn.textContent = `Downloading… ${progress.percent}%`;
    }
    if (status && progress?.percent != null) {
      status.textContent = `Downloading update… ${progress.percent}%`;
    }
  });

  window.debrief.onStarStringsProgress?.((progress) => {
    if (!starStringsUiState.busy) return;
    starStringsUiState.progress = progress;
    if (activeTab !== "guides-star-strings") return;

    const panel = document.querySelector("#panel-guides-star-strings");
    const bar = panel?.querySelector(".star-strings-progress-bar > span");
    const label = panel?.querySelector(".star-strings-progress");
    const phase = progress?.phase
      ? String(progress.phase).replace(/_/g, " ")
      : "working";
    const pct = progress?.percent != null ? `${progress.percent}%` : "";
    if (bar && progress?.percent != null) {
      bar.style.width = `${Math.max(0, Math.min(100, Number(progress.percent) || 0))}%`;
      bar.parentElement?.setAttribute(
        "aria-valuenow",
        String(Math.max(0, Math.min(100, Number(progress.percent) || 0)))
      );
      if (label) label.textContent = `Status: ${phase}${pct ? ` · ${pct}` : ""}`;
      return;
    }

    // Throttle full re-renders when the progress chrome is not yet on screen.
    const now = Date.now();
    if (now - (starStringsUiState._lastProgressRenderAt || 0) < 250) return;
    starStringsUiState._lastProgressRenderAt = now;
    loadStarStringsTab("guides-star-strings", {
      busy: true,
      progress,
    });
  });

  window.debrief.onUpdateStatus(applyUpdateStatus);
}

async function installAvailableUpdate() {
  const url = updateInfo?.downloadUrl;
  const status = $("statusLine");
  const btn = $("btnDownloadUpdate");
  if (!url || updateInstalling) {
    const fallback = updateInfo?.releaseUrl || url;
    if (fallback) window.debrief.openUpdateUrl(fallback);
    return;
  }

  updateInstalling = true;
  const prevLabel = btn?.textContent || "Install update";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Downloading…";
  }
  if (status) status.textContent = "Downloading update…";

  try {
    const result = await window.debrief.downloadAndInstallUpdate({
      downloadUrl: url,
      platform: updateInfo.platform,
    });
    if (result?.ok) {
      if (status) status.textContent = result.message || "Installer started.";
      if (btn) btn.textContent = "Closing…";
      return;
    }
    if (status) {
      status.textContent =
        result?.error ||
        "Could not install automatically. Opening the release page instead.";
    }
    window.debrief.openUpdateUrl(updateInfo.releaseUrl || url);
  } catch (e) {
    if (status) status.textContent = "Install failed. Opening the release page instead.";
    window.debrief.openUpdateUrl(updateInfo.releaseUrl || url);
  } finally {
    updateInstalling = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevLabel;
    }
  }
}

function applyState(state) {
  lastKnownState = state;
  const liveSession = state.current;
  const session = resolveDisplaySession(state);
  const active = liveSession?.status === "active";

  $("autoTrack").checked = state.autoTrack;
  $("btnEnd").disabled = !active || !!archiveViewSession;

  if (!archiveViewSession) {
    let status = state.watching ? "Tracking session" : "Tracking paused";
    if (active) {
      status += ` · Recording (${liveSession.events.length} events)`;
    } else if (liveSession?.status === "ended" || session?.status === "ended") {
      status += " · Last session ended";
    } else if (
      session?.status === "active" &&
      state.watching &&
      !liveSession
    ) {
      status += ` · Recording (${session.events.length} events)`;
    } else if (state.autoTrack) {
      status += " · Auto-track on";
    }
    $("statusLine").textContent = status;
    const led = $("statusLed");
    if (led) {
      led.classList.toggle("is-recording", !!active && state.watching);
      led.classList.toggle("is-paused", !state.watching);
      led.classList.toggle("is-idle", !active && state.watching);
    }
  }

  applyLogPathState(state);
  renderAllPanels(state);
}

function initArchiveUi() {
  $("btnArchiveBack")?.addEventListener("click", () => {
    clearArchiveView();
    window.debrief.getState().then(applyState);
  });

  $("tabPanels")?.addEventListener("click", (e) => {
    const row = e.target.closest("[data-archive-idx]");
    if (!row) return;
    const idx = Number(row.dataset.archiveIdx);
    const archive = logArchiveList[idx];
    if (archive?.id) openLogArchive(archive.id, archive);
  });

  refreshLogArchiveList();
}

function initHudParallax() {
  /* Disabled — mouse parallax + backdrop-filter caused blurry, shifting UI in Electron. */
}

initTheme();
initStats();
initTabs();
initQuickNav();
initFavoriteUi();
loadFavoriteTabs();
loadShipBuilderFavorites();
initAppInfo();
initUpdateUi();
initArchiveUi();
initLoadoutUi();
initCatalogUi();
initGuidesUi();
initHudParallax();

$("btnTheme").addEventListener("click", toggleTheme);
$("btnNew").addEventListener("click", () => window.debrief.startSession());
$("btnEnd").addEventListener("click", () => window.debrief.endSession());
$("autoTrack").addEventListener("change", (e) =>
  window.debrief.setAutoTrack(e.target.checked)
);
$("btnLog").addEventListener("click", () => window.debrief.openLog());

function applyLogPathState(state) {
  const info = state.logPathInfo || {};
  const input = $("logPathInput");
  const banner = $("logBanner");
  const watching = state.watching && !!state.logPath;
  const displayPath =
    state.logPath ||
    info.resolved ||
    info.autoDetected ||
    info.defaultGuess ||
    "";

  input.value = displayPath;
  input.classList.toggle("log-missing", !watching && !info.exists);

  const modeLabel = info.mode === "custom" ? "Custom path" : "Auto-detect";
  input.title = info.exists
    ? `${modeLabel}: ${displayPath}`
    : `Game.log not found. ${modeLabel} last tried: ${displayPath}`;

  banner.classList.toggle("hidden", watching || info.exists);
  if (!watching && !info.exists) {
    $("logBannerText").textContent =
      "Game.log not found at the usual locations. Use Browse to select your Game.log (.../StarCitizen/LIVE/Game.log), or Auto-detect to scan again.";
  }
}

async function browseAndSetLogPath() {
  const pick = await window.debrief.browseLogFile();
  if (pick.canceled || !pick.path) return;
  const result = await window.debrief.setLogPath({ path: pick.path });
  if (!result.ok && result.error) {
    $("statusLine").textContent = `Error: ${result.error}`;
  } else {
    refreshLogArchiveList();
  }
}

async function autoDetectLogPath() {
  const result = await window.debrief.setLogPath({ auto: true });
  if (!result.ok && result.error) {
    $("statusLine").textContent = `Error: ${result.error}`;
  } else {
    refreshLogArchiveList();
  }
}

$("btnBrowseLog").addEventListener("click", () => browseAndSetLogPath());
$("btnAutoLog").addEventListener("click", () => autoDetectLogPath());
window.debrief.onFocusLogPath(() => {
  $("logPathInput").focus();
  $("btnBrowseLog").click();
});

window.debrief.getState().then(applyState);
window.debrief.onState(applyState);
window.debrief.onError((msg) => {
  $("statusLine").textContent = `Error: ${msg}`;
});
