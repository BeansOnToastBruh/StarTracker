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
    hint: "Gear snapshots from spawn and mid-session changes. Click a row to expand slots and combat stats.",
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
    id: "history",
    group: "session",
    label: "Log archive",
    hint: "Game.log backups since patch 4.8. Click one to view everything we can parse from that file.",
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
    hint: "Stations, cities, and ports where you can get ship services (refuel, repair, ammo restock). Grouped by star system. Data from UEX.",
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
    hint: "Rank commodities by spread and estimated profit for your cargo SCU. UEX average prices, not terminal pairs.",
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
    id: "guides-loops",
    group: "guides",
    label: "Game loops",
    hint: "Quick intros for hauling, mining, smuggling, merc work, and refuel loops with links to relevant tabs.",
    empty: "No game loop guides loaded yet.",
  },
  {
    id: "guides-reputation",
    group: "guides",
    label: "Reputation",
    hint: "Faction rep tracked across sessions from Game.log rewards. Tier names are wiki estimates.",
    empty: "No faction reputation recorded yet.",
  },
  {
    id: "guides-external-tools",
    group: "guides",
    label: "Tools hub",
    hint: "Popular Star Citizen companion sites with links to in-app StarTracker tabs where we cover similar features.",
    empty: "External tools list not loaded.",
  },
  {
    id: "guides-combat",
    group: "guides",
    label: "Combat intel",
    hint: "Weapon DPS, armor values, ship hull and shield stats. Use Fleet compare and Ship builder tabs for rankings and loadouts.",
    empty: "Combat intel not loaded yet.",
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
];

const INTEL_TAB_META = {
  "guides-patch-notes": "news",
  "guides-commodities": "economy",
  "guides-trade-routes": "economy",
  "guides-smuggling": "economy",
  "guides-loops": "economy",
  "guides-refinery": "production",
  "guides-crafting": "production",
  "guides-reputation": "progress",
  "guides-external-tools": "reference",
  "guides-combat": "combat",
  "guides-fleet": "combat",
  "guides-loadout": "combat",
};

const TABS = [...SESSION_TABS, ...CATALOG_TABS, ...GUIDE_TABS];

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
    "Click a snapshot to expand gear by slot. Combat stats load for weapons and armor when wiki data exists.",
  blueprints:
    "Blueprint unlocks when the log names them. Look here after contract payouts that grant schematics.",
  deaths:
    "Every time you went down and respawned. Use this to review how often you died and where it happened.",
  kills:
    "Players you killed or neutralized, including PvP bounty targets. Handy after bounty hunting or combat sessions.",
  ships:
    "Hulls you lost while flying or in control. Check this when you want a list of your own ship destructions.",
  history:
    "Game.log backups since patch 4.8. Open an archive to review parsed stats from an older play session.",
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
    "Single-hop profit estimates from UEX spread times your cargo SCU. Pick a hauler preset or enter custom capacity.",
  "guides-refinery":
    "Decide whether to refine ore or sell raw. Calculator uses UEX sell prices and community yield estimates.",
  "guides-crafting":
    "Blueprint recipes from the wiki datamine. Tune material quality (0 to 1000) and preview how output stats shift.",
  "guides-smuggling":
    "Curated smuggling routes with risk level, commodity hints, and location notes. Verify prices before hauling.",
  "guides-loops":
    "Short guides for common game loops with tips and links to related StarTracker tabs.",
  "guides-reputation":
    "Persistent faction rep from parsed rewards plus this session's gains. Progress bars use wiki contractor tier thresholds (estimates).",
  "guides-external-tools":
    "Curated list of community tools like SC Trade Tools, Erkul, Hangar Link, and SCodex. In-app equivalents are marked.",
  "guides-combat":
    "Look up weapon DPS, armor, and ship stats. Fleet compare and Ship builder are one click away from here.",
  "guides-fleet":
    "Every flyable ship, sortable like a fleet chart. Hull, shields, speed, cargo, and signatures from the wiki datamine.",
  "guides-loadout":
    "Step through ship, weapons, components, and hull stats. DPS updates live as you swap guns. Reset to stock anytime.",
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
  "guides-loops": "↻",
  "guides-reputation": "★",
  "guides-external-tools": "⊞",
  "guides-combat": "⚔",
  "guides-fleet": "🚀",
  "guides-loadout": "🔧",
};

const QUICK_NAV_EMPTY_HINT =
  "Star tabs you use often with Add to Jump to on the tab bar. Your favorites will appear here for one-click access.";

let favoriteTabIds = [];

const EMPTY_TIPS = {
  missions: "Accept a contract in-game and StarTracker will pick it up from Game.log.",
  rewards: "Complete missions with aUEC payouts. Awarded popups in the log are the most reliable source.",
  "guides-fleet": "Tap Refresh index to pull the latest ship list from the wiki.",
  "guides-loadout": "Try gladius, cutlass-black, or hurricane as a starting slug.",
  "guides-refinery": "Start with Quantainium or Bexalite to compare refine vs raw sell value.",
  "guides-crafting": "Try ADP Core or search your armor piece to see mission sources and quality curves.",
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
  "guides-fleet": { query: "", offset: 0, sort: "manufacturer" },
};
let guideCommodityMeta = null;
let fleetCompareMeta = null;
let loadoutBuilderState = {
  shipSlug: null,
  slotAssignments: {},
  stockBaseline: null,
  shipFilter: "",
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
let catalogLastPayload = null;
let lastCombatSearchRows = null;
let guideCommodityLastPayload = null;
let craftingDetailCache = null;
let craftingSearchLastRows = null;

const INLINE_HOST = {
  FLEET: "fleet",
  COMBAT: "combat-search",
  CATALOG: "catalog",
  COMMODITY: "guide-commodity",
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
    const listingsHtml = renderCatalogDetail(detail, "item");
    return `${perfHtml}${listingsHtml}`;
  }
  let html = renderCatalogDetail(detail, kind);
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
    default:
      break;
  }
}

function patchPanelTable(panelSelector, tableHtml) {
  const panel = document.querySelector(`${panelSelector} .panel-body`);
  const old = panel?.querySelector(".catalog-table-wrap");
  if (old) old.outerHTML = tableHtml;
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
    }
    if (inlineExpand.host === host && String(inlineExpand.key) === String(key)) {
      inlineExpand.html = html;
      inlineExpand.loading = false;
      await refreshInlineExpandHost(host);
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
  if (activeTab === tabId) loadCatalogTab(tabId, { resetOffset: true });
}, 320);

const debouncedGuideSearch = debounce((tabId) => {
  clearInlineExpand();
  if (activeTab === tabId) loadGuideTab(tabId, { resetOffset: true });
}, 320);

const debouncedFleetSearch = debounce((tabId) => {
  clearInlineExpand();
  if (activeTab === tabId) loadFleetCompareTab(tabId, { resetOffset: true });
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

function contractMissionExtra(c, innerAfterObjectives = "") {
  return `<div class="entry-extra">${renderContractObjectives(c)}${innerAfterObjectives}</div>`;
}

function panelShell(tab, innerHtml) {
  const selected = tab.id === activeTab;
  return `<section
    id="panel-${tab.id}"
    class="tab-panel ${selected ? "is-active" : ""}"
    role="tabpanel"
    aria-labelledby="tab-${tab.id}"
    ${selected ? "" : 'hidden'}
  >
    <div class="panel-body">${innerHtml}</div>
  </section>`;
}

function tabLabel(tabId) {
  return tabById(tabId)?.label || tabId;
}

function isFavoriteTab(tabId) {
  return favoriteTabIds.includes(tabId);
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
  const intelCat = INTEL_TAB_META[tabId];
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
  return `<div class="empty-state">
    <div class="empty-state-icon" aria-hidden="true">${icon}</div>
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
  const groupClass =
    tab.group === "catalog"
      ? " tab-btn-catalog"
      : tab.group === "guides"
        ? " tab-btn-guides"
        : "";
  const intelCat = INTEL_TAB_META[tab.id];
  const intelClass = intelCat ? ` tab-btn-intel-${intelCat}` : "";
  return `<button type="button" class="tab-btn${groupClass}${intelClass} ${selected ? "is-active" : ""}" role="tab" id="tab-${tab.id}" data-tab="${tab.id}" aria-selected="${selected}" aria-controls="panel-${tab.id}"><span class="tab-label">${escapeHtml(tab.label)}</span><span class="tab-count" aria-hidden="true"></span></button>`;
}

function initTabs() {
  const nav = $("tabNav");
  const panels = $("tabPanels");
  const sessionButtons = SESSION_TABS.map(tabButtonHtml).join("");
  const catalogButtons = CATALOG_TABS.map(tabButtonHtml).join("");
  const guideButtons = GUIDE_TABS.map(tabButtonHtml).join("");
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
  </div>`;
  panels.innerHTML = TABS.map((t) => panelShell(t, emptyPanel(t))).join("");

  nav.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
  updateTabDescription(activeTab);
}

function scrollActiveTabIntoView() {
  const btn = document.getElementById(`tab-${activeTab}`);
  const scroller = document.querySelector(".tabs-scroll");
  if (!btn || !scroller) return;
  const btnLeft = btn.offsetLeft;
  const btnRight = btnLeft + btn.offsetWidth;
  const viewLeft = scroller.scrollLeft;
  const viewRight = viewLeft + scroller.clientWidth;
  if (btnLeft < viewLeft || btnRight > viewRight) {
    btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }
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
      return rollup.rewardEntries?.length || 0;
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
      return rollup.shopPurchases?.length || 0;
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

function setPanelHtml(tabId, html) {
  const panel = document.querySelector(`#panel-${tabId} .panel-body`);
  if (panel) panel.innerHTML = html;
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
  const confirmed =
    t?.totalAuec ?? s?.auecEarned ?? sumAuecFromEvents(session, { estimated: false }) ?? 0;
  const estimatedTotal =
    t?.totalAuecEstimated ?? s?.auecEstimated ?? sumAuecFromEvents(session, { estimated: true }) ?? 0;
  if (confirmed > 0 || estimatedTotal > 0) {
    return { total: confirmed, estimated: estimatedTotal, source: "session" };
  }
  if (archiveViewSession && archiveViewMeta?.awardedAuecTotal > 0) {
    return { total: archiveViewMeta.awardedAuecTotal, source: "archive-scan" };
  }
  if (!archiveViewSession && (state?.logFileAuecTotal ?? 0) > 0) {
    return { total: state.logFileAuecTotal, source: "log-scan" };
  }
  return { total: 0, estimated: 0, source: "none" };
}

function renderStats(session, state = lastKnownState) {
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
  const values = {
    session: r?.durationLabel ?? EMPTY_DISPLAY,
    contracts: s?.contractsCompleted ?? 0,
    deaths: s?.deaths ?? 0,
    ships: s?.vehiclesLost ?? 0,
    kills: s?.kills ?? 0,
    auec:
      auecInfo.estimated > 0 && auecInfo.total > 0
        ? `${auecInfo.total.toLocaleString()} + ~${auecInfo.estimated.toLocaleString()} est`
        : auecInfo.estimated > 0
          ? `~${auecInfo.estimated.toLocaleString()} est`
          : auecInfo.total.toLocaleString(),
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
      const hint =
        auecInfo.source === "log-scan"
          ? "Awarded aUEC in your current Game.log (full-file scan). Not your wallet balance."
          : auecInfo.source === "archive-scan"
            ? "Awarded aUEC in this log archive. Not your wallet balance."
            : auecInfo.estimated > 0
              ? `Confirmed aUEC from Awarded HUD lines: ${auecInfo.total.toLocaleString()}. Estimated (not confirmed): ~${auecInfo.estimated.toLocaleString()} from wiki + rep tier.`
              : "aUEC from Awarded X aUEC HUD lines this session when the game logs them. Not your wallet balance.";
      card.title = hint;
    }
  }
}

function buildOverview(session) {
  const r = session?.rollup;
  if (!session) return emptyPanel(tabById("overview"));
  if (!r) {
    return `<div class="overview-prose"><p>Session is active and still gathering events. Keep playing and check back in a moment.</p></div>`;
  }

  const s = r.stats;
  const t = r.rewardTotals;
  const pilot = r.playerNick || session.playerNick || "Pilot";
  const lines = [
    `<div class="overview-welcome">
      <h2>Welcome back, ${escapeHtml(pilot)}</h2>
      <p>Here is your flight log for this session (${escapeHtml(r.durationLabel || "in progress")}). Everything below updates as you play.</p>
    </div>`,
    `<p class="overview-lead">Session at a glance</p>`,
    `<ul class="overview-list">`,
    `<li><strong>${s.contractsCompleted}</strong> contract${s.contractsCompleted === 1 ? "" : "s"} completed${(() => {
      const open =
        (s.contractsAccepted || 0) -
        (s.contractsCompleted || 0) -
        (s.contractsFailed || 0) -
        (s.contractsAbandoned || 0);
      return open > 0 ? ` · <strong>${open}</strong> still open` : "";
    })()}</li>`,
    `<li><strong>${s.deaths}</strong> death${s.deaths === 1 ? "" : "s"} · <strong>${s.kills}</strong> kill${s.kills === 1 ? "" : "s"} · <strong>${s.vehiclesLost}</strong> ship${s.vehiclesLost === 1 ? "" : "s"} lost</li>`,
    `<li><strong>${s.rewards}</strong> payout popup${s.rewards === 1 ? "" : "s"} logged</li>`,
    `<li>aUEC confirmed: <strong>${(t?.totalAuec ?? 0).toLocaleString()}</strong>${(t?.totalAuecEstimated ?? 0) > 0 ? ` · estimated: <strong>~${t.totalAuecEstimated.toLocaleString()}</strong> (not confirmed)` : ""}</li>`,
    `<li>Fines: <strong>${(r.finesTotal ?? 0).toLocaleString()}</strong> UEC · Insurance claims: <strong>${r.insuranceClaims?.length ?? 0}</strong> · Shop spend: <strong>${Math.round(r.shopSpendTotal ?? 0).toLocaleString()}</strong> aUEC · Loadout snapshots: <strong>${r.loadoutSnapshots?.length ?? 0}</strong></li>`,
  ];
  if (t?.repByFaction?.length) {
    for (const { faction, rep } of t.repByFaction) {
      lines.push(
        `<li>Rep: <strong>${rep.toLocaleString()}</strong> with <strong>${escapeHtml(faction)}</strong></li>`
      );
    }
  }
  if (t?.itemCount > 0) {
    lines.push(
      `<li>Item bundles: <strong>${t.itemCount}</strong> reward item${t.itemCount === 1 ? "" : "s"} (${t.itemBundles} payout${t.itemBundles === 1 ? "" : "s"})</li>`
    );
  }
  lines.push(
    `</ul>`,
    `<p class="overview-foot muted">Open the tabs above for details, or use <strong>Jump to</strong> for Fleet compare, trade prices, and combat tools. Rewards uses <strong>Awarded X aUEC</strong> HUD lines when logged. This is not your wallet balance.</p>`
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

function buildRewards(rollup) {
  if (!rollup) return emptyPanel(tabById("rewards"));
  const entries = rollup.rewardEntries || [];
  if (!entries.length) return emptyPanel(tabById("rewards"));

  const t = rollup.rewardTotals || {};
  const parts = [];

  if (t.totalAuec > 0 || t.totalAuecEstimated > 0 || t.repByFaction?.length || t.itemCount > 0) {
    const totals = [];
    if (t.totalAuec > 0) {
      totals.push(
        `<div class="reward-total-card"><span class="reward-lbl">aUEC confirmed</span><span class="reward-total-val">${t.totalAuec.toLocaleString()}</span></div>`
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
    parts.push(
      `<div class="reward-totals">${totals.join("")}</div><div class="subhead">By payout</div>`
    );
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
    return `<div class="overview-prose"><p>Scanning logbackups since 4.8…</p></div>`;
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
  if (!rollup?.shopPurchases?.length) return emptyPanel(tabById("shopping"));
  const total = Math.round(rollup.shopSpendTotal ?? 0);
  const head = `<p class="panel-summary">Shop spend logged: <strong>${total.toLocaleString()} aUEC</strong></p>`;
  const rows = rollup.shopPurchases
    .slice()
    .reverse()
    .map((p) => {
      const badge =
        p.category === "ship"
          ? "Ship"
          : p.category === "equipment"
            ? "Equipment"
            : "Purchase";
      const qty =
        p.quantity > 1 ? ` · Qty ${p.quantity}` : "";
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
    .join("");
  return head + rows;
}

function loadoutCategoryLabel(category) {
  const map = {
    weapon: "Weapons",
    armor: "Armor",
    attachment: "Attachments",
    medical: "Medical",
    utility: "Utility",
    item: "Inventory",
    cosmetic: "Cosmetics",
  };
  return map[category] || "Gear";
}

function loadoutSnapshotKey(snap, index) {
  return String(snap.at || index);
}

function findLoadoutSnapshot(key) {
  const rollup = getViewRollup(lastKnownState);
  const snaps = (rollup?.loadoutSnapshots || []).slice().reverse();
  return snaps.find((s, i) => loadoutSnapshotKey(s, i) === key) || null;
}

function groupLoadoutGear(items) {
  const order = ["weapon", "armor", "attachment", "medical", "utility", "item"];
  const groups = new Map();
  for (const item of items) {
    const cat = item.category || "item";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(item);
  }
  const sorted = [...groups.entries()].sort((a, b) => {
    const ai = order.indexOf(a[0]);
    const bi = order.indexOf(b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return sorted;
}

function renderLoadoutGearList(snap) {
  const gear = (snap.items || []).filter((i) => i.category !== "cosmetic");
  if (!gear.length) return `<p class="muted small">No combat gear in this snapshot.</p>`;
  const groups = groupLoadoutGear(gear);
  const sections = groups
    .map(([category, rows]) => {
      const lis = rows
        .map(
          (i) => `<li class="loadout-gear-item">
            <span class="loadout-gear-slot">${displayText(i.slotLabel || i.port || "Slot")}</span>
            <span class="loadout-gear-name">${displayText(i.label || i.className || "?")}</span>
            ${i.verified ? "" : `<span class="muted small loadout-gear-est">estimated</span>`}
          </li>`
        )
        .join("");
      return `<section class="loadout-gear-group">
        <h4 class="loadout-gear-group-title">${escapeHtml(loadoutCategoryLabel(category))}</h4>
        <ul class="loadout-list">${lis}</ul>
      </section>`;
    })
    .join("");
  const cosmeticN = (snap.items || []).length - gear.length;
  const foot =
    cosmeticN > 0
      ? `<p class="muted small loadout-cosmetic-note">${cosmeticN} cosmetic/DNA attachment${cosmeticN === 1 ? "" : "s"} hidden.</p>`
      : "";
  return `<div class="loadout-gear-panel">${sections}${foot}</div>`;
}

function renderLoadoutCombatSummary(items, options = {}) {
  if (!items?.length) return "";
  const withStats = items.filter(
    (row) => row.combat?.headline || row.combat?.profile?.stats?.length
  );
  if (!withStats.length) {
    if (options.hideEmpty) return "";
    return `<p class="muted small">No wiki combat stats for gear in this snapshot (food, attachments, and misc items are listed above).</p>`;
  }
  const cards = withStats
    .map(
      (row) => `<article class="combat-loadout-card">
        <header><h4>${displayText(row.label || row.className)}</h4><span class="combat-kind-badge">${escapeHtml(combatKindLabel(row.combat.kind))}</span></header>
        <p class="muted small">${displayText(row.slotLabel || row.port || "Gear")}</p>
        ${row.combat.headline ? `<p class="combat-headline">${escapeHtml(row.combat.headline)}</p>` : ""}
        ${renderCombatStatGrid(row.combat.profile)}
      </article>`
    )
    .join("");
  return `<section class="combat-loadout-summary"><h4 class="loadout-detail-sub">Combat stats</h4><div class="combat-loadout-grid">${cards}</div></section>`;
}

function renderLoadoutSnapshotBody(snap, key) {
  const gearHtml = renderLoadoutGearList(snap);
  if (loadoutCombatLoadingKey === key) {
    return `${gearHtml}<p class="muted small loadout-combat-loading">Loading combat stats…</p>`;
  }
  const combatItems = loadoutCombatByKey[key];
  const combatHtml = combatItems
    ? renderLoadoutCombatSummary(combatItems, { hideEmpty: true })
    : "";
  return `${gearHtml}${combatHtml}`;
}

function renderLoadoutSnapshot(snap, index) {
  const key = loadoutSnapshotKey(snap, index);
  const gear = (snap.items || []).filter((i) => i.category !== "cosmetic");
  const expanded = loadoutExpandKey === key;
  const badge =
    snap.reason === "gear_change"
      ? "Gear change"
      : snap.reason === "spawn"
        ? "Spawn"
        : "Loadout";
  const title = snap.summary || `${gear.length} gear item${gear.length === 1 ? "" : "s"}`;
  return `<article class="loadout-snapshot${expanded ? " is-expanded" : ""}" data-loadout-snap="${escapeAttr(key)}">
    <button type="button" class="loadout-snap-head" aria-expanded="${expanded}">
      <span class="expand-chevron" aria-hidden="true">${expanded ? "▾" : "▸"}</span>
      <time class="loadout-snap-time">${escapeHtml(fmtDateTime(snap.at))}</time>
      <span class="entry-badge loadout-snap-badge">${escapeHtml(badge)}</span>
      <span class="loadout-snap-title">${displayText(title)}</span>
      <span class="muted small loadout-snap-count">${gear.length} item${gear.length === 1 ? "" : "s"}</span>
    </button>
    ${expanded ? `<div class="loadout-snap-body">${renderLoadoutSnapshotBody(snap, key)}</div>` : ""}
  </article>`;
}

function buildLoadout(rollup) {
  if (!rollup?.loadoutSnapshots?.length) return emptyPanel(tabById("loadout"));
  const snaps = rollup.loadoutSnapshots.slice().reverse();
  if (
    loadoutExpandKey &&
    !snaps.some((s, i) => loadoutSnapshotKey(s, i) === loadoutExpandKey)
  ) {
    loadoutExpandKey = null;
  }
  return `<div class="loadout-snapshots">${snaps.map((snap, i) => renderLoadoutSnapshot(snap, i)).join("")}</div>`;
}

async function refreshLoadoutPanel() {
  const rollup = getViewRollup(lastKnownState);
  setPanelHtml("loadout", buildLoadout(rollup));
}

async function toggleLoadoutExpand(key) {
  if (loadoutExpandKey === key) {
    loadoutExpandKey = null;
    await refreshLoadoutPanel();
    return;
  }
  const snap = findLoadoutSnapshot(key);
  if (!snap) return;
  loadoutExpandKey = key;
  await refreshLoadoutPanel();

  if (loadoutCombatByKey[key]) return;

  const gear = (snap.items || []).filter((i) => i.category !== "cosmetic");
  if (!gear.length) return;

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
    loadoutCombatByKey[key] = result.items || [];
  } catch {
    loadoutCombatByKey[key] = [];
  } finally {
    loadoutCombatLoadingKey = null;
    if (loadoutExpandKey === key) await refreshLoadoutPanel();
  }
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

function renderCatalogShipServiceRows(rows) {
  if (!rows.length) return emptyPanel(tabById("catalog-ship-services"));
  const host = INLINE_HOST.CATALOG;
  const colspan = 4;
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
    </tr>${renderInlineDetailRow(colspan, host, key)}`;
  }
  return `<div class="catalog-table-wrap"><table class="catalog-table catalog-ship-services-table">
    <thead><tr><th></th><th>Place</th><th>Location</th><th>Type</th></tr></thead>
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
      </tr>`
    )
    .join("");
  return `<article class="catalog-detail inline-detail-inner">
    <header class="catalog-detail-head">
      <h3>${displayText(detail.name)}</h3>
    </header>
    <p class="muted small">${displayText(detail.system || "")} · ${displayText(detail.location || "")}</p>
    <p class="muted small">Ship services pad and shop terminals at this location.</p>
    <div class="catalog-table-wrap"><table class="catalog-table">
      <thead><tr><th>Terminal</th><th>Type</th></tr></thead>
      <tbody>${terminals || `<tr><td colspan="2" class="muted">No terminals listed</td></tr>`}</tbody>
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
        <span class="combat-stat-label">${escapeHtml(s.label)}</span>
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
    <p class="muted small"><button type="button" class="link guide-tab-link" data-tab="guides-external-tools">Open full Tools hub</button> for overlays, loot tables, and hangar sync.</p>
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
    <strong>Combat command center.</strong> Search weapons, armor, and ships. Fleet rankings and loadout planning are one click away. Heat sims and cutaways stay in the Tools hub.
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
    ? `<section class="guide-section"><h2 class="guide-section-title">External sims</h2><div class="combat-advanced-tools-grid">${quickTools}</div><p class="muted small"><button type="button" class="link guide-tab-link" data-tab="guides-external-tools">Tools hub</button> lists every community site and what StarTracker replaces in-app.</p></section>`
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
        <td class="muted small">${displayText(r.manufacturer || r.size || "—")}</td>
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
  { slug: "gladius", label: "Gladius" },
  { slug: "cutlass-black", label: "Cutlass Black" },
  { slug: "hurricane", label: "Hurricane" },
  { slug: "prospector", label: "Prospector" },
  { slug: "caterpillar", label: "Caterpillar" },
  { slug: "c2-hercules", label: "C2 Hercules" },
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

async function renderLoadoutBuilderShell() {
  const slug = loadoutBuilderState.shipSlug || "";
  const filter = (loadoutBuilderState.shipFilter || "").trim().toLowerCase();
  let shipOptions = `<option value="">Choose a ship…</option>`;
  try {
    const fleet = await window.debrief.fleetCompareQuery({ sort: "manufacturer", limit: 250 });
    if (fleet.ok && fleet.rows?.length) {
      let lastMfg = null;
      for (const r of fleet.rows) {
        const hay = `${r.name || ""} ${r.manufacturer || ""} ${r.slug || ""}`.toLowerCase();
        if (filter && !hay.includes(filter)) continue;
        const mfg = r.manufacturer || "Other";
        if (mfg !== lastMfg) {
          if (lastMfg != null) shipOptions += `</optgroup>`;
          shipOptions += `<optgroup label="${escapeAttr(mfg)}">`;
          lastMfg = mfg;
        }
        shipOptions += `<option value="${escapeAttr(r.slug)}"${r.slug === slug ? " selected" : ""}>${displayText(r.name)}</option>`;
      }
      if (lastMfg != null) shipOptions += `</optgroup>`;
    }
  } catch {
    /* fleet index optional */
  }
  const quickChips = LOADOUT_QUICK_SHIPS.map(
    (s) =>
      `<button type="button" class="loadout-quick-ship btn btn-sm btn-ghost" data-loadout-quick-ship="${escapeAttr(s.slug)}">${escapeHtml(s.label)}</button>`
  ).join("");
  const hasShip = Boolean(slug);
  return `<div class="hub-intro">
    <strong>Build and compare in four steps.</strong> Pick a hull, swap weapons, tune components, then read hull stats. Changes update DPS instantly.
  </div>
  <div class="loadout-steps" aria-hidden="true">
    <span class="loadout-step is-active">1. Ship</span>
    <span class="loadout-step${hasShip ? " is-active" : ""}">2. Weapons</span>
    <span class="loadout-step${hasShip ? " is-active" : ""}">3. Components</span>
    <span class="loadout-step${hasShip ? " is-active" : ""}">4. Stats</span>
  </div>
  <section class="guide-section loadout-ship-pick">
    <h2 class="guide-section-title">1. Choose your hull</h2>
    <div class="loadout-quick-ships">${quickChips}</div>
    <div class="catalog-toolbar">
      <input type="search" id="loadoutShipFilter" class="catalog-search" placeholder="Filter ships…" value="${escapeAttr(loadoutBuilderState.shipFilter || "")}" />
      <select id="loadoutShipSelect" class="guide-sort-select loadout-ship-select">${shipOptions}</select>
      <button type="button" class="btn btn-sm" id="loadoutLoadShipBtn">Load ship</button>
    </div>
    <p class="muted small">Quick picks above, or filter the full fleet list. Only items that fit each hardpoint size appear in slot dropdowns.</p>
  </section>
  <div id="loadoutBuilderBody">${hasShip ? `<p class="muted small">Loading ${escapeHtml(slug)}…</p>` : `<p class="muted small">Select a ship and tap Load ship to begin.</p>`}</div>`;
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
        <td>${displayText(w.label)}</td>
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
        <td>${displayText(c.label)}</td>
        <td>${displayText(c.componentType)}</td>
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
    <header class="combat-profile-head">
      <h3>${displayText(blueprint.ship?.manufacturer ? `${blueprint.ship.manufacturer} ${blueprint.ship.name}` : blueprint.ship?.name)}</h3>
      <button type="button" class="btn btn-sm btn-ghost" id="loadoutResetStockBtn">Reset to stock</button>
    </header>
    ${renderLoadoutSummaryStrip(totals, baseline)}
    <p class="muted small">${displayText(totals?.note || blueprint.limitations || "")}</p>
    ${stockComponents ? `<p class="loadout-stock-row muted small">Stock components: ${stockComponents}</p>` : ""}
    <details class="loadout-builder-section" open>
      <summary><h4 class="guide-section-title">2. Weapons</h4></summary>
      <div class="catalog-table-wrap"><table class="catalog-table">
        <thead><tr><th>Hardpoint</th><th>Size</th><th>DPS</th><th>Equip</th></tr></thead>
        <tbody>${weaponRows || `<tr><td colspan="4" class="muted">No weapon hardpoints found.</td></tr>`}</tbody>
      </table></div>
    </details>
    ${
      componentRows
        ? `<details class="loadout-builder-section" open>
      <summary><h4 class="guide-section-title">3. Components</h4></summary>
      <div class="catalog-table-wrap"><table class="catalog-table">
        <thead><tr><th>Slot</th><th>Type</th><th>Size</th><th>Equip</th></tr></thead>
        <tbody>${componentRows}</tbody>
      </table></div>
    </details>`
        : ""
    }
    <details class="loadout-builder-section">
      <summary><h4 class="guide-section-title">4. Hull performance</h4></summary>
      <div id="loadoutHullProfile"></div>
    </details>
  </section>`;
}

async function loadFleetCompareTab(tabId, options = {}) {
  const state = guideQueryByTab[tabId] || { query: "", offset: 0, sort: "manufacturer" };
  if (options.resetOffset) state.offset = 0;
  guideQueryByTab[tabId] = state;

  setPanelHtml(
    tabId,
    `<div class="hub-intro"><strong>Compare the whole fleet.</strong> Sort ships by hull, shields, SCM, cargo, mass, and IR signature. Click any row for the full performance breakdown. Click again to collapse.</div>${fleetMetaLine(fleetCompareMeta)}${fleetCompareToolbar(tabId)}<p class="muted small">Loading fleet index…</p>`
  );

  try {
    const result = await window.debrief.fleetCompareQuery({
      query: state.query,
      sort: state.sort,
      offset: state.offset,
      limit: 80,
      forceRefresh: options.forceRefresh,
    });
    if (!result.ok) throw new Error(result.error || "fleet compare failed");
    fleetCompareMeta = result.meta;
    fleetCompareLastRows = result.rows;
    setPanelHtml(
      tabId,
      `<div class="hub-intro"><strong>Compare the whole fleet.</strong> Sort ships by hull, shields, SCM, cargo, mass, and IR signature. Click any row for the full performance breakdown. Click again to collapse.</div>${fleetMetaLine(result.meta)}${fleetCompareToolbar(tabId)}${renderFleetCompareRows(result.rows)}`
    );
  } catch (e) {
    setPanelHtml(
      tabId,
      `${fleetMetaLine(fleetCompareMeta)}${fleetCompareToolbar(tabId)}<p class="muted">Fleet compare error: ${escapeHtml(e.message || String(e))}</p>`
    );
  }
}

async function loadLoadoutBuilderTab(tabId) {
  setPanelHtml(tabId, `<p class="muted small">Loading ship list…</p>`);
  setPanelHtml(tabId, await renderLoadoutBuilderShell());
  if (!loadoutBuilderState.shipSlug) return;

  const body = document.getElementById("loadoutBuilderBody");
  if (!body) return;
  body.innerHTML = `<p class="muted small">Loading ${escapeHtml(loadoutBuilderState.shipSlug)}…</p>`;
  try {
    const blueprint = await window.debrief.loadoutGetBlueprint(loadoutBuilderState.shipSlug);
    loadoutBuilderBlueprint = blueprint;
    const sim = await window.debrief.loadoutSimulate({
      shipSlug: loadoutBuilderState.shipSlug,
      slotAssignments: loadoutBuilderState.slotAssignments,
    });
    if (!loadoutBuilderState.stockBaseline && sim.summary) {
      loadoutBuilderState.stockBaseline = {
        totalDps: sim.summary.totalDps,
        totalAlpha: sim.summary.totalAlpha,
      };
    }
    body.innerHTML = renderLoadoutBuilderBody(blueprint, sim.summary);
    if (sim.hullProfile) {
      document.getElementById("loadoutHullProfile")?.insertAdjacentHTML(
        "beforeend",
        renderCombatPerformanceSections(sim.hullProfile)
      );
    }
  } catch (e) {
    body.innerHTML = `<p class="muted">Loadout error: ${escapeHtml(e.message || String(e))}</p>`;
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
  const body = document.getElementById("loadoutBuilderBody");
  if (!body || !loadoutBuilderState.shipSlug) return;
  try {
    const blueprint = loadoutBuilderBlueprint?.ok
      ? loadoutBuilderBlueprint
      : await window.debrief.loadoutGetBlueprint(loadoutBuilderState.shipSlug);
    const sim = await window.debrief.loadoutSimulate({
      shipSlug: loadoutBuilderState.shipSlug,
      slotAssignments: loadoutBuilderState.slotAssignments,
    });
    if (!loadoutBuilderState.stockBaseline && sim.summary) {
      loadoutBuilderState.stockBaseline = {
        totalDps: sim.summary.totalDps,
        totalAlpha: sim.summary.totalAlpha,
      };
    }
    body.innerHTML = renderLoadoutBuilderBody(blueprint, sim.summary);
    if (sim.hullProfile) {
      document.getElementById("loadoutHullProfile")?.insertAdjacentHTML(
        "beforeend",
        renderCombatPerformanceSections(sim.hullProfile)
      );
    }
  } catch (e) {
    body.innerHTML = `<p class="muted">Loadout error: ${escapeHtml(e.message || String(e))}</p>`;
  }
}

async function loadCatalogTab(tabId, options = {}) {
  if (!tabId.startsWith("catalog-")) return;
  const state = catalogQueryByTab[tabId] || { query: "", offset: 0 };
  if (options.resetOffset) state.offset = 0;
  catalogQueryByTab[tabId] = state;

  setPanelHtml(
    tabId,
    `${catalogMetaLine()}${catalogToolbar(tabId)}<p class="muted small">Loading catalog…</p>`
  );

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
      catalogLastPayload = { tabId, html: tableHtml };
      setPanelHtml(
        tabId,
        `${catalogMetaLine()}${catalogToolbar(tabId)}${tableHtml}${renderCatalogPager(tabId, result)}`
      );
    } else if (tabId === "catalog-shops") {
      result = await window.debrief.catalogQueryShops({
        query: state.query,
        offset: state.offset,
        limit: 50,
      });
      tableHtml = renderCatalogShopRows(result.rows);
      catalogLastPayload = { tabId, html: tableHtml };
      setPanelHtml(
        tabId,
        `${catalogMetaLine()}${catalogToolbar(tabId)}${tableHtml}${renderCatalogPager(tabId, result)}`
      );
    } else if (tabId === "catalog-ship-services") {
      result = await window.debrief.catalogQueryPlaces({
        query: state.query,
        offset: state.offset,
        limit: 80,
      });
      tableHtml = renderCatalogShipServiceRows(result.rows);
      catalogLastPayload = { tabId, html: tableHtml };
      setPanelHtml(
        tabId,
        `${catalogMetaLine()}${catalogToolbar(tabId)}${tableHtml}${renderCatalogPager(tabId, result)}`
      );
    } else {
      result = await window.debrief.catalogQueryItems({
        query: state.query,
        offset: state.offset,
        limit: 80,
        section: state.section,
        withListingsOnly: true,
      });
      tableHtml = renderCatalogItemRows(result.rows, tabId);
      catalogLastPayload = { tabId, html: tableHtml };
      setPanelHtml(
        tabId,
        `${catalogMetaLine()}${catalogToolbar(tabId)}${tableHtml}${renderCatalogPager(tabId, result)}`
      );
    }
  } catch (e) {
    setPanelHtml(
      tabId,
      `${catalogMetaLine()}${catalogToolbar(tabId)}<p class="muted">Catalog error: ${escapeHtml(e.message || String(e))}</p>`
    );
  }
}

function fmtScuPrice(n) {
  if (n == null || n <= 0) return EMPTY_DISPLAY;
  return `${Number(n).toLocaleString()} aUEC/SCU`;
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

function buildPatchNotesPanel(data) {
  const remoteCards = (data.remote || [])
    .map((link) => {
      const url = link.rsiUrl || "";
      const version = link.version ? `Alpha ${link.version}` : "";
      const openBtn = url
        ? `<button type="button" class="btn btn-sm patch-read-rsi" data-guide-external="${escapeAttr(url)}">Read full patch notes on RSI</button>`
        : "";
      return `<article class="patch-note-card guide-card patch-note-game">
        <header>
          <h3>${displayText(link.title)}</h3>
          <span class="patch-version-badge">${escapeHtml(version || link.channel || "RSI")}</span>
        </header>
        <p class="muted small">${escapeHtml(link.dateHuman || link.date || "")}${link.channel ? ` · ${escapeHtml(link.channel)}` : ""}</p>
        <p class="patch-note-lead">Official game patch from Roberts Space Industries. Open on RSI for the full notes, balance changes, and known issues.</p>
        ${openBtn}
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
    ? `<p class="guides-meta muted small">Game patches from RSI comm-links · cached ${escapeHtml(fmtDateTime(data.meta.fetchedAt))}</p>`
    : "";

  const appSection = localCards
    ? `<details class="patch-app-notes"><summary>StarTracker app release notes (not game patches)</summary>${localCards}</details>`
    : "";

  if (!remoteCards && !localCards) {
    return `${meta}<p class="muted">No patch notes available. Check back after RSI publishes the next comm-link.</p>`;
  }

  return `${meta}
    <section class="guide-section"><h2 class="guide-section-title">Star Citizen game patches</h2>${remoteCards || `<p class="muted">No Alpha patch comm-links in cache. Use Refresh below or open RSI directly.</p>`}</section>
    ${appSection}
    <p class="guides-meta muted small"><button type="button" class="link" data-guide-external="https://robertsspaceindustries.com/en/comm-link">Browse all RSI comm-links</button></p>`;
}

function buildRefineryPanel(data, calcResult) {
  const state = guideQueryByTab["guides-refinery"] || {};
  const oreOptions = (data.oreCatalog || [])
    .map((o) => {
      const volatile = o.volatile ? " · volatile" : "";
      const priceHint =
        o.refined?.priceSell > 0
          ? ` · ${fmtScuPrice(o.refined.priceSell)} sell`
          : "";
      return `<option value="${escapeAttr(o.id)}"${state.oreId === o.id ? " selected" : ""}>${displayText(o.label)}${priceHint}${volatile}</option>`;
    })
    .join("");
  const selectedOre = (data.oreCatalog || []).find((o) => o.id === state.oreId);
  const yieldVal =
    state.yieldPercent != null ? state.yieldPercent : selectedOre?.defaultYieldPercent ?? data.defaultYieldPercent ?? 80;
  const feeVal = state.feePercent ?? data.defaultStationFeePercent ?? 5;
  const result = calcResult?.ok ? calcResult.result : null;
  const worthClass = result?.worthRefining ? " refinery-profit-positive" : result ? " refinery-profit-negative" : "";
  const resultHtml = result
    ? `<div class="refinery-result-grid${worthClass}">
        <div class="refinery-result-card"><span class="refinery-result-label">Refined SCU out</span><strong>${formatFleetCell(result.refinedScu)}</strong></div>
        <div class="refinery-result-card"><span class="refinery-result-label">Raw sell total</span><strong>${fmtAuec(result.grossRaw)}</strong></div>
        <div class="refinery-result-card"><span class="refinery-result-label">Refined sell (gross)</span><strong>${fmtAuec(result.grossRefined)}</strong></div>
        <div class="refinery-result-card"><span class="refinery-result-label">Refinery fee</span><strong>${fmtAuec(result.refineryFee)}</strong></div>
        <div class="refinery-result-card refinery-result-highlight"><span class="refinery-result-label">Net vs selling raw</span><strong>${fmtAuec(result.profitVsRaw)}</strong><span class="muted small">${fmtAuec(result.profitPerOreScu)} per ore SCU</span></div>
      </div>
      <p class="muted small refinery-verdict">${result.worthRefining ? "Refining looks profitable at these UEX sell prices." : "Selling raw may beat refining at these prices. Adjust yield or check terminals."}</p>`
    : `<p class="muted small">Pick an ore and SCU amount to run the calculator.</p>`;

  const stations = (data.stations || [])
    .map(
      (s) => `<tr>
        <td>${displayText(s.name)}</td>
        <td>${displayText(s.system || "")}</td>
        <td>${displayText(s.body || "")}</td>
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
    <div class="hub-intro"><strong>Refine or sell?</strong> Compare raw ore value against refined output using community yield estimates and live sell prices.</div>
    <section class="guide-section refinery-calc-section">
      <h2 class="guide-section-title">Refinery calculator</h2>
      <div class="refinery-calc-form catalog-toolbar">
        <label class="refinery-field"><span>Ore type</span>
          <select id="refineryOreSelect" class="guide-sort-select">${oreOptions}</select>
        </label>
        <label class="refinery-field"><span>Ore SCU</span>
          <input type="number" id="refineryOreScu" class="catalog-search refinery-num-input" min="0" step="1" value="${escapeAttr(String(state.oreScu ?? 100))}" />
        </label>
        <label class="refinery-field"><span>Yield %</span>
          <input type="number" id="refineryYield" class="catalog-search refinery-num-input" min="1" max="100" step="1" value="${escapeAttr(String(yieldVal))}" />
        </label>
        <label class="refinery-field"><span>Station fee %</span>
          <input type="number" id="refineryFee" class="catalog-search refinery-num-input" min="0" max="50" step="0.5" value="${escapeAttr(String(feeVal))}" />
        </label>
        <button type="button" class="btn btn-sm" id="refineryCalcBtn">Recalculate</button>
      </div>
      ${calcResult?.prices?.rawName ? `<p class="muted small">Raw: ${displayText(calcResult.prices.rawName)} (${fmtScuPrice(calcResult.prices.rawSellPerScu)}) · Refined: ${displayText(calcResult.prices.refinedName || "—")} (${fmtScuPrice(calcResult.prices.refinedSellPerScu)})</p>` : ""}
      ${selectedOre?.notes ? `<p class="muted small refinery-ore-note">${displayText(selectedOre.notes)}</p>` : ""}
      ${resultHtml}
    </section>
    <section class="guide-section">
      <h2 class="guide-section-title">Refinery stations</h2>
      <div class="catalog-table-wrap"><table class="catalog-table">
        <thead><tr><th>Station</th><th>System</th><th>Body</th><th>Notes</th></tr></thead>
        <tbody>${stations || `<tr><td colspan="4" class="muted">No stations listed.</td></tr>`}</tbody>
      </table></div>
    </section>
    <section class="guide-section">
      <h2 class="guide-section-title">Mining loop tips</h2>
      <ul class="guide-list">${tips}</ul>
      <p class="muted small"><button type="button" class="link guide-tab-link" data-tab="guides-commodities">Market prices</button> · <button type="button" class="link guide-tab-link" data-tab="guides-loops">Game loops</button></p>
    </section>`;
}

async function loadRefineryTab(tabId) {
  setPanelHtml(tabId, `<p class="muted small">Loading refinery data…</p>`);
  try {
    const data = await window.debrief.guidesGetRefinery();
    const state = guideQueryByTab[tabId] || {};
    const calc = await window.debrief.guidesCalculateRefinery({
      oreId: state.oreId,
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
  return `<div class="catalog-table-wrap"><table class="catalog-table crafting-search-table">
    <thead><tr><th></th><th>Output</th><th>Type</th><th>Craft time</th><th>Materials</th><th>Missions</th></tr></thead>
    <tbody>${rows
      .map((row) => {
        const id = row.slug || row.uuid || row.id;
        const selected = id === selectedId;
        return `<tr class="crafting-blueprint-row expandable-row${selected ? " is-selected" : ""}" data-crafting-blueprint="${escapeAttr(id)}">
          <td class="expand-chevron" aria-hidden="true">${selected ? "▾" : "▸"}</td>
          <td>${displayText(row.outputName)}</td>
          <td class="muted small">${displayText(row.outputTypeLabel || "—")}</td>
          <td>${displayText(row.craftTimeLabel || "—")}</td>
          <td>${formatFleetCell(row.ingredientCount)}</td>
          <td>${formatFleetCell(row.missionCount)}</td>
        </tr>`;
      })
      .join("")}</tbody></table></div>`;
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

function buildCraftingPanel(searchData, detail, previewOverride) {
  const state = guideQueryByTab["guides-crafting"] || {};
  const query = state.query || "";
  const selectedId = state.blueprintId || null;
  const preview = previewOverride || detail?.preview || null;
  const meta = detail?.meta?.fetchedAt
    ? `<p class="guides-meta muted small">Blueprint data from star-citizen.wiki · cached ${escapeHtml(fmtDateTime(detail.meta.fetchedAt))}${detail.meta.gameVersion ? ` · ${escapeHtml(detail.meta.gameVersion)}` : ""}</p>`
    : searchData?.meta?.fetchedAt
      ? `<p class="guides-meta muted small">Search from star-citizen.wiki · ${escapeHtml(fmtDateTime(searchData.meta.fetchedAt))}</p>`
      : "";
  const disclaimer = detail?.disclaimer
    ? `<p class="guides-meta muted small">${displayText(detail.disclaimer)}</p>`
    : "";

  const searchBlock = `<section class="guide-section crafting-search-section">
    <h2 class="guide-section-title">Find a blueprint</h2>
    <div class="catalog-toolbar">
      <input type="search" id="craftingSearchInput" class="catalog-search" data-crafting-search="guides-crafting"
        placeholder="Search blueprints: ADP Core, Omnisky, ship part…" value="${escapeAttr(query)}" />
      <button type="button" class="btn btn-sm" id="craftingSearchBtn">Search</button>
    </div>
    <div id="craftingSearchResults">${renderCraftingSearchRows(craftingSearchLastRows || searchData?.rows || [], selectedId)}</div>
  </section>`;

  if (!detail?.ok) {
    return `${meta}${disclaimer}
      <div class="hub-intro"><strong>Crafting workshop</strong> Pick a blueprint to see mission sources, material amounts, quality sliders, and projected stat changes.</div>
      ${searchBlock}
      <p class="muted small">Select a row above or search, then click a blueprint to load the workshop.</p>
      <p class="muted small"><button type="button" class="link guide-tab-link" data-tab="blueprints">Session blueprint unlocks</button> · <button type="button" class="link guide-tab-link" data-tab="guides-loops">Game loops</button></p>`;
  }

  const bp = detail.blueprint;
  const output = detail.outputItem;
  const ingredientList = (bp.ingredients || [])
    .map((i) => `${displayText(i.name)}${i.quantity_scu != null ? ` (${formatFleetCell(i.quantity_scu)} SCU)` : ""}`)
    .join(", ");
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

  return `${meta}${disclaimer}
    <div class="hub-intro"><strong>${displayText(bp.outputName || "Blueprint")}</strong>${outputMeta ? `<span class="muted"> · ${escapeHtml(outputMeta)}</span>` : ""}</div>
    ${searchBlock}
    <section class="guide-section">
      <h2 class="guide-section-title">Recipe overview</h2>
      <p class="muted small">${ingredientList || "No flat ingredient list."}${bp.isAvailableByDefault ? " · Available by default" : " · Mission or loot unlock"}</p>
      ${baseStatsList ? `<h3 class="guide-detail-sub">Wiki base output stats</h3><ul class="guide-list">${baseStatsList}</ul>` : ""}
      ${bp.webUrl ? `<p class="muted small"><button type="button" class="link" data-guide-external="${escapeAttr(bp.webUrl)}">Open blueprint on wiki</button>${bp.outputItemWebUrl ? ` · <button type="button" class="link" data-guide-external="${escapeAttr(bp.outputItemWebUrl)}">Output item</button>` : ""}</p>` : ""}
    </section>
    <section class="guide-section">
      <h2 class="guide-section-title">Materials and quality</h2>
      <p class="muted small">Slide each material quality (0–1000). Baseline column uses Q500 when that value is in range.</p>
      ${buildCraftingMaterialsSection(detail, state)}
    </section>
    <section class="guide-section">
      <h2 class="guide-section-title">Projected stats</h2>
      <div id="craftingStatsPreview">${buildCraftingStatsSection(preview)}</div>
    </section>
    <section class="guide-section">
      <h2 class="guide-section-title">Unlock missions</h2>
      ${buildCraftingMissionsSection(detail)}
      <p class="muted small"><button type="button" class="link guide-tab-link" data-tab="missions">Session missions</button> · <button type="button" class="link guide-tab-link" data-tab="blueprints">Blueprint unlocks</button> · <button type="button" class="link" data-market-jump="mining">Market: mining</button></p>
    </section>`;
}

async function loadCraftingTab(tabId, options = {}) {
  const state = guideQueryByTab[tabId] || {};
  if (!options.keepHtml) {
    setPanelHtml(tabId, `<p class="muted small">Loading crafting workshop…</p>`);
  }
  try {
    let searchData = await window.debrief.craftingSearchBlueprints({
      query: state.query || "",
      page: state.page || 1,
      perPage: 25,
    });
    craftingSearchLastRows = searchData.rows || [];

    let detail = null;
    if (state.blueprintId) {
      detail = await window.debrief.craftingGetBlueprint(state.blueprintId);
      if (detail?.ok) {
        craftingDetailCache = detail;
        if (!state.qualities || !Object.keys(state.qualities).length) {
          state.qualities = { ...(detail.preview?.qualities || {}) };
          guideQueryByTab[tabId] = state;
        } else {
          const calc = await window.debrief.craftingCalculatePreview({
            blueprintId: state.blueprintId,
            qualities: state.qualities,
          });
          if (calc?.ok) detail.preview = calc.preview;
        }
      }
    }

    setPanelHtml(tabId, buildCraftingPanel(searchData, detail));
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
    state.qualities[key] = Number(slider.value) || 0;
    const out = slider.parentElement?.querySelector(".crafting-quality-value");
    if (out) out.textContent = slider.value;
  });
  guideQueryByTab["guides-crafting"] = state;

  const statsEl = $("craftingStatsPreview");
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
  const state = guideQueryByTab["guides-crafting"] || {};
  state.blueprintId = blueprintId;
  state.qualities = {};
  guideQueryByTab["guides-crafting"] = state;
  await loadCraftingTab("guides-crafting");
}

async function refreshRefineryCalculator() {
  if (activeTab !== "guides-refinery") return;
  const state = guideQueryByTab["guides-refinery"] || {};
  const oreSelect = $("refineryOreSelect");
  const oreScu = $("refineryOreScu");
  const yieldInput = $("refineryYield");
  const feeInput = $("refineryFee");
  if (oreSelect) state.oreId = oreSelect.value;
  if (oreScu) state.oreScu = Number(oreScu.value) || 0;
  if (yieldInput) state.yieldPercent = Number(yieldInput.value) || null;
  if (feeInput) state.feePercent = Number(feeInput.value) || 0;
  guideQueryByTab["guides-refinery"] = state;
  await loadRefineryTab("guides-refinery");
}

function buildSmugglerRoutesPanel(data) {
  const routes = data.routes || [];
  if (!routes.length) return `<p class="muted">No smuggler routes loaded.</p>`;
  const disclaimer = data.disclaimer
    ? `<p class="guides-meta muted small">${displayText(data.disclaimer)}</p>`
    : "";
  const intro = `<div class="hub-intro hub-intro-accent"><strong>Curated smuggling loops.</strong> Location notes and risk levels live here. Prices and spreads come from Market prices (Illegal filter) and Trade routes.</div>`;
  const cards = routes
    .map((route) => {
      const topCommodity = route.commodities?.[0];
      const topLine = topCommodity
        ? `<p class="muted small">Top UEX spread: <strong>${displayText(topCommodity.name)}</strong> · ${formatFleetCell(topCommodity.spread)} aUEC/SCU</p>`
        : route.topSpread != null
          ? `<p class="combat-headline">Best spread: ${formatFleetCell(route.topSpread)} aUEC per SCU</p>`
          : "";
      const moreCommodities =
        route.commodities?.length > 1
          ? `<p class="muted small">+ ${route.commodities.length - 1} more illegal commodities on UEX</p>`
          : "";
      const buys = (route.buyLocations || []).map((l) => `<li>${displayText(l)}</li>`).join("");
      const sells = (route.sellLocations || []).map((l) => `<li>${displayText(l)}</li>`).join("");
      return `<article class="guide-route-card guide-card">
        <header><h3>${displayText(route.name)}</h3><span class="entry-badge">${escapeHtml(route.risk || "Unknown")} risk</span></header>
        ${topLine}${moreCommodities}
        <p class="muted small route-action-links">
          <button type="button" class="link" data-market-jump="illegal">Market: illegal</button>
          · <button type="button" class="link guide-tab-link" data-tab="guides-trade-routes">Trade routes</button>
        </p>
        ${buys ? `<h4 class="guide-detail-sub">Typical buy</h4><ul class="guide-list">${buys}</ul>` : ""}
        ${sells ? `<h4 class="guide-detail-sub">Typical sell</h4><ul class="guide-list">${sells}</ul>` : ""}
        ${route.notes ? `<p class="overview-prose muted small">${displayText(route.notes)}</p>` : ""}
      </article>`;
    })
    .join("");
  return `${intro}${disclaimer}${cards}`;
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

function buildTradeRoutesPanel(data, presets) {
  const state = guideQueryByTab["guides-trade-routes"] || {};
  const routes = data.routes || [];
  const toolbar = buildTradeRoutesToolbar(state, presets);
  const disclaimer = data.disclaimer
    ? `<p class="guides-meta muted small">${displayText(data.disclaimer)}</p>`
    : "";
  const meta = data.meta?.fetchedAt
    ? `<p class="guides-meta muted small">${data.meta.totalCandidates ?? routes.length} commodities with spread · UEX cached ${escapeHtml(fmtDateTime(data.meta.fetchedAt))}${data.meta.stale ? " · using stale cache" : ""}</p>`
    : "";

  if (!routes.length) {
    return `${meta}${toolbar}${disclaimer}<p class="muted">No profitable routes match your filters. Try lowering min spread or refreshing UEX prices.</p>`;
  }

  const rows = routes
    .map((r) => {
      const illegal = r.isIllegal ? `<span class="badge badge-warn">Illegal</span>` : "";
      return `<tr>
        <td>${displayText(r.name)}${illegal ? ` ${illegal}` : ""}<div class="muted small mono">${escapeHtml(r.code || "")}</div></td>
        <td>${escapeHtml(fmtScuPrice(r.priceBuy))}</td>
        <td>${escapeHtml(fmtScuPrice(r.priceSell))}</td>
        <td class="commodity-spread-positive">${escapeHtml(fmtScuPrice(r.spread))}</td>
        <td>${formatFleetCell(r.commodityScu)}</td>
        <td>${fmtAuec(r.investAuec)}</td>
        <td class="commodity-spread-positive"><strong>${fmtAuec(r.totalProfit)}</strong></td>
        <td>${r.roiPercent != null ? `${formatFleetCell(r.roiPercent)}%` : EMPTY_DISPLAY}</td>
      </tr>`;
    })
    .join("");

  return `${meta}
    <div class="hub-intro"><strong>Single-hop haul planner.</strong> Ranks commodities by estimated profit for ${escapeHtml(String(data.cargoScu || state.cargoScu || 128))} SCU of cargo. Uses UEX average buy and sell, not a specific terminal pair. For multi-stop routes with travel time, see Tools hub → SC Trade Tools.</div>
    ${toolbar}
    ${disclaimer}
    <div class="catalog-table-wrap"><table class="catalog-table trade-routes-table">
      <thead><tr><th>Commodity</th><th>Buy</th><th>Sell</th><th>Spread</th><th>Units</th><th>Buy cost</th><th>Est. profit</th><th>ROI</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="muted small"><button type="button" class="link guide-tab-link" data-tab="guides-commodities">Terminal breakdown</button> · <button type="button" class="link guide-tab-link" data-tab="guides-smuggling">Smuggler routes</button></p>`;
}

function buildExternalToolsHubPanel(data) {
  const categories = data.categories || [];
  const inAppCount = data.inAppCount || 0;
  const disclaimer = data.disclaimer
    ? `<p class="guides-meta muted small">${displayText(data.disclaimer)}</p>`
    : "";
  const intro = `<div class="hub-intro"><strong>Community tools directory.</strong> ${inAppCount} tools have a similar feature inside StarTracker. External links open in your browser.</div>`;

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
            : `<p class="muted small external-tool-external-only">External only${tool.inAppNote ? `: ${displayText(tool.inAppNote)}` : ""}</p>`;
          const tags = (tool.tags || [])
            .map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`)
            .join("");
          return `<article class="guide-card external-tool-card">
            <header><h3>${status}${displayText(tool.name)}</h3>${tags ? `<div class="tag-row">${tags}</div>` : ""}</header>
            <p>${displayText(tool.description)}</p>
            ${inApp}
            <button type="button" class="btn btn-sm btn-ghost" data-guide-external="${escapeAttr(tool.url)}">Open site</button>
          </article>`;
        })
        .join("");
      if (!cards) return "";
      return `<section class="guide-section"><h2 class="guide-section-title">${displayText(cat.title)}</h2><p class="muted small">${displayText(cat.summary || "")}</p><div class="external-tools-grid">${cards}</div></section>`;
    })
    .join("");

  return `${intro}${disclaimer}${sections || `<p class="muted">No tools listed.</p>`}`;
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

async function refreshTradeRoutesTab() {
  if (activeTab !== "guides-trade-routes") return;
  const state = guideQueryByTab["guides-trade-routes"] || {};
  const cargoInput = $("tradeCargoScu");
  const searchInput = $("tradeRouteSearch");
  const illegalInput = $("tradeIncludeIllegal");
  const sortInput = $("tradeRouteSort");
  if (cargoInput) state.cargoScu = Math.max(1, Number(cargoInput.value) || 128);
  if (searchInput) state.query = searchInput.value.trim();
  if (illegalInput) state.includeIllegal = illegalInput.checked;
  if (sortInput) state.sort = sortInput.value || "profit";
  guideQueryByTab["guides-trade-routes"] = state;
  await loadGuideTab("guides-trade-routes");
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
    setPanelHtml(tabId, `<p class="muted small">Calculating trade routes…</p>`);
    try {
      const [presetsData, data] = await Promise.all([
        window.debrief.guidesGetTradePresets(),
        window.debrief.guidesGetTradeRoutes({
          cargoScu: state.cargoScu || 128,
          includeIllegal: !!state.includeIllegal,
          minSpread: state.minSpread || 0,
          query: state.query || "",
          sort: state.sort || "profit",
        }),
      ]);
      setPanelHtml(
        tabId,
        buildTradeRoutesPanel(data, presetsData.presets || [])
      );
    } catch (e) {
      setPanelHtml(
        tabId,
        `<p class="muted">Trade routes error: ${escapeHtml(e.message || String(e))}</p>`
      );
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
    setPanelHtml(tabId, `<p class="muted small">Loading tools hub…</p>`);
    try {
      const data = await window.debrief.guidesGetExternalToolsHub();
      setPanelHtml(tabId, buildExternalToolsHubPanel(data));
    } catch (e) {
      setPanelHtml(
        tabId,
        `<p class="muted">Tools hub error: ${escapeHtml(e.message || String(e))}</p>`
      );
    }
    return;
  }

  if (tabId === "guides-combat") {
    setPanelHtml(tabId, `<p class="muted small">Loading combat intel…</p>`);
    try {
      const tools = await window.debrief.combatGetExternalTools();
      const searchHtml = `<div class="catalog-toolbar">
        <input type="search" id="combatSearchInput" class="catalog-search" placeholder="Search weapons, armor, shields, ships…" />
        <button type="button" class="btn btn-sm" id="combatSearchBtn">Search</button>
      </div>`;
      setPanelHtml(tabId, renderCombatHubPanel(tools, searchHtml));
    } catch (e) {
      setPanelHtml(
        tabId,
        `<p class="muted">Combat intel error: ${escapeHtml(e.message || String(e))}</p>`
      );
    }
    return;
  }

  if (tabId === "guides-fleet") {
    await loadFleetCompareTab(tabId, options);
    return;
  }

  if (tabId === "guides-loadout") {
    await loadLoadoutBuilderTab(tabId);
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

    setPanelHtml(
      tabId,
      `${guidesMetaLine(guideCommodityMeta)}${guidesCommodityToolbar(tabId)}<p class="muted small">Loading commodities…</p>`
    );

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
      setPanelHtml(
        tabId,
        `${guidesMetaLine(result.meta)}${guidesCommodityToolbar(tabId)}${tableHtml}${renderGuideCommodityPager(tabId, result)}`
      );
    } catch (e) {
      setPanelHtml(
        tabId,
        `${guidesMetaLine(guideCommodityMeta)}${guidesCommodityToolbar(tabId)}<p class="muted">Commodity error: ${escapeHtml(e.message || String(e))}</p>`
      );
    }
  }
}

function initGuidesUi() {
  $("tabPanels")?.addEventListener("click", async (e) => {
    const external = e.target.closest("[data-guide-external]");
    if (external?.dataset.guideExternal) {
      window.debrief.openUpdateUrl(external.dataset.guideExternal);
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
      if (!state) return;
      clearInlineExpand();
      state.offset = Math.max(0, state.offset + (dir === "next" ? 80 : -80));
      loadGuideTab(tabId);
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
      await loadCraftingTab("guides-crafting");
      return;
    }

    const craftingRow = e.target.closest("[data-crafting-blueprint]");
    if (craftingRow?.dataset.craftingBlueprint) {
      await selectCraftingBlueprint(craftingRow.dataset.craftingBlueprint);
      return;
    }

    if (e.target.id === "loadoutResetStockBtn" || e.target.closest("#loadoutResetStockBtn")) {
      loadoutBuilderState.slotAssignments = {};
      loadoutBuilderState.stockBaseline = null;
      applyLoadoutAssignments();
      return;
    }

    const quickShip = e.target.closest("[data-loadout-quick-ship]");
    if (quickShip?.dataset.loadoutQuickShip) {
      loadoutBuilderState.shipSlug = quickShip.dataset.loadoutQuickShip;
      loadoutBuilderState.slotAssignments = {};
      loadoutBuilderState.stockBaseline = null;
      loadoutBuilderBlueprint = null;
      loadLoadoutBuilderTab("guides-loadout");
      return;
    }

    if (e.target.id === "loadoutLoadShipBtn" || e.target.closest("#loadoutLoadShipBtn")) {
      const select = $("loadoutShipSelect");
      const slug = select?.value.trim().toLowerCase();
      if (!slug) return;
      const filter = loadoutBuilderState.shipFilter || "";
      loadoutBuilderState = {
        shipSlug: slug,
        slotAssignments: {},
        stockBaseline: null,
        shipFilter: filter,
      };
      loadoutBuilderBlueprint = null;
      loadLoadoutBuilderTab("guides-loadout");
      return;
    }
  });

  $("tabPanels")?.addEventListener("change", (e) => {
    if (e.target.id === "refineryOreSelect") {
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

    if (e.target.id === "tradeRouteSort" || e.target.id === "tradeIncludeIllegal") {
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
      loadoutBuilderState.shipFilter = e.target.value;
      loadLoadoutBuilderTab("guides-loadout");
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
    const head = e.target.closest(".loadout-snap-head");
    if (!head) return;
    const article = head.closest("[data-loadout-snap]");
    const key = article?.dataset.loadoutSnap;
    if (!key) return;
    await toggleLoadoutExpand(key);
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
  text.textContent = `Update available${plat}: ${formatVersion(updateInfo.latestVersion)}`;
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

initTheme();
initStats();
initTabs();
initQuickNav();
initFavoriteUi();
loadFavoriteTabs();
initAppInfo();
initUpdateUi();
initArchiveUi();
initLoadoutUi();
initCatalogUi();
initGuidesUi();

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
