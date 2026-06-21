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
    hint: "Gear on your character when you spawned or swapped armor mid-session (from Game.log AttachmentReceived lines).",
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
    hint: "Official RSI patch notes plus StarTracker-specific tracking notes for each version.",
    empty: "No patch notes loaded yet.",
  },
  {
    id: "guides-commodities",
    group: "guides",
    label: "Commodities",
    hint: "Trade materials with buy and sell prices per SCU from UEX community data.",
    empty: "No commodity data loaded yet. Use Refresh prices below.",
  },
  {
    id: "guides-mining",
    group: "guides",
    label: "Mining",
    hint: "Extractable and harvestable materials with sell prices per SCU at terminals.",
    empty: "No mining commodity data loaded yet. Use Refresh prices below.",
  },
  {
    id: "guides-smuggling",
    group: "guides",
    label: "Smuggler routes",
    hint: "Curated illegal cargo routes with commodity hints and buy/sell location notes.",
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
    hint: "Pick a hull, view stock hardpoints, and swap weapons to compare simplified total DPS.",
    empty: "Load a ship to start building.",
  },
];

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
    "Armor, weapons, medpens, and backpack from Game.log when you spawn or change gear. Cosmetic DNA pieces are hidden in the list.",
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
    "RSI patch notes and StarTracker tracking notes. See what changed for log parsing and contract estimates each patch.",
  "guides-commodities":
    "Buy and sell prices per SCU for trade commodities. Compare spread and open a row for terminal breakdown.",
  "guides-mining":
    "Sell prices per SCU for mined and harvested materials. Use when planning mining runs and refinery drops.",
  "guides-smuggling":
    "Curated smuggling routes with risk level, commodity hints, and location notes. Verify prices before hauling.",
  "guides-loops":
    "Short guides for common game loops with tips and links to related StarTracker tabs.",
  "guides-combat":
    "Look up weapon DPS, armor, and ship stats. Fleet compare and Ship builder are one click away from here.",
  "guides-fleet":
    "Every flyable ship, sortable like a fleet chart. Hull, shields, speed, cargo, and signatures from the wiki datamine.",
  "guides-loadout":
    "Pick a hull, see stock hardpoints, swap guns, and compare simplified total DPS. Great for quick what-if loadouts.",
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
  "guides-mining": "⛏",
  "guides-smuggling": "◐",
  "guides-loops": "↻",
  "guides-combat": "⚔",
  "guides-fleet": "🚀",
  "guides-loadout": "🔧",
};

const QUICK_NAV = [
  { id: "overview", label: "Overview" },
  { id: "guides-fleet", label: "Fleet compare" },
  { id: "guides-loadout", label: "Ship builder" },
  { id: "guides-commodities", label: "Trade prices" },
  { id: "guides-combat", label: "Combat intel" },
  { id: "catalog-ships", label: "Ship catalog" },
];

const EMPTY_TIPS = {
  missions: "Accept a contract in-game and StarTracker will pick it up from Game.log.",
  rewards: "Complete missions with aUEC payouts. Awarded popups in the log are the most reliable source.",
  "guides-fleet": "Tap Refresh index to pull the latest ship list from the wiki.",
  "guides-loadout": "Try gladius, cutlass-black, or hurricane as a starting slug.",
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
  "guides-mining": { query: "", offset: 0, sort: "sell", filter: "mining" },
  "guides-fleet": { query: "", offset: 0, sort: "hull" },
};
let guideCommodityMeta = null;
let fleetCompareMeta = null;
let loadoutBuilderState = { shipSlug: null, slotAssignments: {} };
let loadoutBuilderBlueprint = null;
let guideCommodityRefreshBusy = false;
let guideDetailCommodityId = null;
let loadoutCombatBusy = false;
let catalogDetailKey = null;

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
  if (activeTab === tabId) loadCatalogTab(tabId, { resetOffset: true });
}, 320);

const debouncedGuideSearch = debounce((tabId) => {
  if (activeTab === tabId) loadGuideTab(tabId, { resetOffset: true });
}, 320);

const debouncedFleetSearch = debounce((tabId) => {
  if (activeTab === tabId) loadFleetCompareTab(tabId, { resetOffset: true });
}, 320);

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
  el.innerHTML = `<div class="tab-briefing">
    <span class="tab-briefing-icon" aria-hidden="true">${icon}</span>
    <div>
      <strong class="tab-briefing-title">${escapeHtml(tab?.label || tabId)}</strong>
      <p class="tab-briefing-text">${escapeHtml(text)}</p>
    </div>
  </div>`;
  el.hidden = false;
}

function updateQuickNavActive(tabId) {
  document.querySelectorAll(".quick-nav-chip").forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.tab === tabId);
  });
}

function initQuickNav() {
  const nav = $("quickNav");
  if (!nav) return;
  nav.innerHTML = `<span class="quick-nav-label">Jump to</span>${QUICK_NAV.map(
    (item) =>
      `<button type="button" class="quick-nav-chip${item.id === activeTab ? " is-active" : ""}" data-tab="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`
  ).join("")}`;
  nav.querySelectorAll(".quick-nav-chip").forEach((chip) => {
    chip.addEventListener("click", () => setActiveTab(chip.dataset.tab));
  });
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
  return `<button type="button" class="tab-btn${groupClass} ${selected ? "is-active" : ""}" role="tab" id="tab-${tab.id}" data-tab="${tab.id}" aria-selected="${selected}" aria-controls="panel-${tab.id}"><span class="tab-label">${escapeHtml(tab.label)}</span><span class="tab-count" aria-hidden="true"></span></button>`;
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

function setActiveTab(id) {
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
  if (id === "loadout") {
    enrichLoadoutCombatPanel();
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

function buildLoadout(rollup) {
  if (!rollup?.loadoutSnapshots?.length) return emptyPanel(tabById("loadout"));
  return rollup.loadoutSnapshots
    .slice()
    .reverse()
    .map((snap) => {
      const gear = (snap.items || []).filter((i) => i.category !== "cosmetic");
      const badge =
        snap.reason === "gear_change"
          ? "Gear change"
          : snap.reason === "spawn"
            ? "Spawn"
            : "Loadout";
      const rows = gear
        .map(
          (i) =>
            `<li><strong>${escapeHtml(i.slotLabel || i.port || "Slot")}:</strong> ${escapeHtml(i.label || i.className || "?")}${i.verified ? "" : " <span class=\"muted\">(estimated name)</span>"}</li>`
        )
        .join("");
      const cosmeticN = (snap.items || []).length - gear.length;
      const foot =
        cosmeticN > 0
          ? `<p class="muted" style="margin-top:8px;font-size:0.85rem">${cosmeticN} cosmetic/DNA attachment${cosmeticN === 1 ? "" : "s"} hidden.</p>`
          : "";
      return entryCard({
        time: fmtDateTime(snap.at),
        badge,
        badgeClass: "",
        title: snap.summary || badge,
        description: rows
          ? `<ul class="loadout-list">${rows}</ul>${foot}`
          : "No combat gear in this snapshot.",
      });
    })
    .join("");
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

function renderCatalogItemRows(rows, tabId) {
  if (!rows.length) return emptyPanel(tabById(tabId));
  return `<div class="catalog-table-wrap"><table class="catalog-table">
    <thead><tr>
      <th>Item</th><th>Type</th><th>Manufacturer</th><th>Best price</th><th>Combat</th><th>Shop / location</th>
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
        return `<tr class="catalog-row" data-catalog-item="${escapeAttr(key)}">
          <td><button type="button" class="catalog-link" data-catalog-item="${escapeAttr(key)}">${displayText(row.name)}</button>${row.className ? `<div class="muted small mono">${escapeHtml(row.className)}</div>` : ""}</td>
          <td>${displayText(row.category || row.section || "")}</td>
          <td>${displayText(row.manufacturer || "")}</td>
          <td>${escapeHtml(fmtAuec(min))}</td>
          <td class="muted small">Click row for DPS / DR stats</td>
          <td>${displayText(loc)}${listings.length > 1 ? ` <span class="muted small">(+${listings.length - 1})</span>` : ""}</td>
        </tr>`;
      })
      .join("")}</tbody></table></div>`;
}

function renderCatalogShipRows(rows) {
  if (!rows.length) return emptyPanel(tabById("catalog-ships"));
  return `<div class="catalog-table-wrap"><table class="catalog-table">
    <thead><tr>
      <th>Ship</th><th>Manufacturer</th><th>Cargo</th><th>Crew</th><th>Buy / rent</th><th>Hull / shields</th><th>Location</th>
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
        return `<tr class="catalog-row" data-catalog-item="${escapeAttr(key)}">
          <td><button type="button" class="catalog-link" data-catalog-item="${escapeAttr(key)}">${displayText(row.name)}</button><div class="muted small mono">${escapeHtml(row.className || "")}</div></td>
          <td>${displayText(row.manufacturer || "")}</td>
          <td>${row.cargo != null ? `${row.cargo} SCU` : EMPTY_DISPLAY}</td>
          <td>${row.crew != null ? String(row.crew) : EMPTY_DISPLAY}</td>
          <td>${escapeHtml(priceBits.join(" / ") || EMPTY_DISPLAY)}</td>
          <td class="muted small">Hull, fuel, power · SPViewer link in detail</td>
          <td>${displayText(loc)}</td>
        </tr>`;
      })
      .join("")}</tbody></table></div>`;
}

function renderCatalogShipServiceRows(rows) {
  if (!rows.length) return emptyPanel(tabById("catalog-ship-services"));
  let body = "";
  let lastSystem = null;
  for (const row of rows) {
    if (row.system !== lastSystem) {
      lastSystem = row.system;
      body += `<tr class="catalog-system-row"><td colspan="3"><span class="catalog-system-label">${displayText(row.system || "Unknown system")}</span></td></tr>`;
    }
    body += `<tr class="catalog-row" data-catalog-place="${escapeAttr(row.key)}">
      <td><button type="button" class="catalog-link" data-catalog-place="${escapeAttr(row.key)}">${displayText(row.name)}</button></td>
      <td class="muted small">${displayText(row.location || "")}</td>
      <td>${displayText(row.kind || "")}</td>
    </tr>`;
  }
  return `<div class="catalog-table-wrap"><table class="catalog-table catalog-ship-services-table">
    <thead><tr><th>Place</th><th>Location</th><th>Type</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

function renderCatalogShopRows(rows) {
  if (!rows.length) return emptyPanel(tabById("catalog-shops"));
  return `<div class="catalog-table-wrap"><table class="catalog-table">
    <thead><tr><th>Shop</th><th>Location</th><th>System</th><th>Items listed</th></tr></thead>
    <tbody>${rows
      .map((row) => {
        const key = String(row.terminalId || row.terminal);
        return `<tr class="catalog-row" data-catalog-shop="${escapeAttr(key)}">
          <td><button type="button" class="catalog-link" data-catalog-shop="${escapeAttr(key)}">${displayText(row.terminal || row.terminalCode || "Shop")}</button></td>
          <td>${displayText(row.location || "")}</td>
          <td>${displayText(row.system || "")}</td>
          <td>${row.items?.length || 0}</td>
        </tr>`;
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
  return `<article class="catalog-detail">
    <header class="catalog-detail-head">
      <h3>${displayText(detail.name)}</h3>
      <button type="button" class="link" data-catalog-detail-close>Close</button>
    </header>
    <p class="muted small">${displayText(detail.system || "")} · ${displayText(detail.location || "")}</p>
    <p class="muted small">Ship services pad and shop terminals at this location.</p>
    <div class="catalog-table-wrap"><table class="catalog-table">
      <thead><tr><th>Terminal</th><th>Type</th></tr></thead>
      <tbody>${terminals || `<tr><td colspan="2" class="muted">No terminals listed</td></tr>`}</tbody>
    </table></div>
  </article>`;
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

  return `<article class="catalog-detail">
    <header class="catalog-detail-head">
      <h3>${displayText(title)}</h3>
      <button type="button" class="link" data-catalog-detail-close>Close</button>
    </header>
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
        `<button type="button" class="btn btn-sm btn-ghost combat-tool-link" data-guide-external="${escapeAttr(t.url)}">${escapeHtml(t.name)}</button>`
    )
    .join("");
  if (!inline && !toolBtns) return "";
  return `<details class="combat-advanced-tools">
    <summary class="muted small">Advanced external tools</summary>
    ${inline}
    ${toolBtns ? `<div class="combat-advanced-tools-grid">${toolBtns}</div>` : ""}
    <p class="muted small">Optional: heat sims, cutaways, and community charts not built into StarTracker.</p>
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

function renderLoadoutCombatSummary(items) {
  if (!items?.length) return "";
  const cards = items
    .map((row) => {
      if (!row.combat?.headline && !row.combat?.profile?.stats?.length) {
        return `<article class="combat-loadout-card">
          <h4>${displayText(row.label || row.className)}</h4>
          <p class="muted small">${displayText(row.slotLabel || row.port || "Gear")} · stats not found</p>
        </article>`;
      }
      return `<article class="combat-loadout-card">
        <header><h4>${displayText(row.label || row.className)}</h4><span class="combat-kind-badge">${escapeHtml(combatKindLabel(row.combat.kind))}</span></header>
        <p class="muted small">${displayText(row.slotLabel || row.port || "Gear")}</p>
        ${row.combat.headline ? `<p class="combat-headline">${escapeHtml(row.combat.headline)}</p>` : ""}
        ${renderCombatStatGrid(row.combat.profile)}
      </article>`;
    })
    .join("");
  return `<section class="combat-loadout-summary"><h3 class="guide-section-title">Combat breakdown</h3><div class="combat-loadout-grid">${cards}</div></section>`;
}

function renderCombatHubPanel(toolsData, searchHtml) {
  const intro = `<div class="hub-intro">
    <strong>Your combat command center.</strong> Look up weapons, armor, and ship stats without leaving the app.
    Fleet rankings and loadout planning live here too. Need heat sims or cutaways? Expand Advanced tools at the bottom.
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
  const advanced = renderAdvancedToolsFooter([], toolsData?.tools || []);
  return `${intro}${inApp}
    <section class="guide-section"><h2 class="guide-section-title">Search any item or ship</h2>${searchHtml}</section>
    <section class="guide-section"><div id="combatSearchResults"></div></section>
    ${advanced}`;
}

function renderCombatSearchResults(rows) {
  if (!rows?.length) return `<p class="muted">No matches. Try a weapon, armor, or ship name.</p>`;
  return `<div class="catalog-table-wrap"><table class="catalog-table">
    <thead><tr><th>Name</th><th>Type</th><th></th></tr></thead>
    <tbody>${rows
      .map((r) => {
        const key = r.className || r.slug;
        const kind = r.resourceType === "vehicle" ? "vehicle" : "item";
        return `<tr>
          <td>${displayText(r.name)}</td>
          <td class="muted small">${escapeHtml(kind)}</td>
          <td><button type="button" class="link combat-search-open" data-combat-kind="${escapeAttr(kind)}" data-combat-key="${escapeAttr(key)}">View stats</button></td>
        </tr>`;
      })
      .join("")}</tbody></table></div>
    <div id="combatSearchDetail"></div>`;
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
  const body = rows
    .map(
      (r) => `<tr>
        <td>${displayText(r.name)}</td>
        <td class="muted small">${displayText(r.manufacturer || r.size || "—")}</td>
        <td>${formatFleetCell(r.hullHp)}</td>
        <td>${formatFleetCell(r.shieldHp)}</td>
        <td>${formatFleetCell(r.scm)}</td>
        <td>${formatFleetCell(r.cargo)}</td>
        <td>${formatFleetCell(r.mass)}</td>
        <td><button type="button" class="link fleet-row-open" data-fleet-slug="${escapeAttr(r.slug)}" data-fleet-key="${escapeAttr(r.className || r.slug)}">Stats</button></td>
      </tr>`
    )
    .join("");
  return `<div class="catalog-table-wrap"><table class="catalog-table fleet-compare-table">
    <thead><tr><th>Ship</th><th>Mfg / size</th><th>Hull</th><th>Shield</th><th>SCM</th><th>Cargo</th><th>Mass</th><th></th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>
  <div id="fleetCompareDetail"></div>`;
}

function renderLoadoutBuilderShell() {
  const slug = loadoutBuilderState.shipSlug || "";
  return `<div class="hub-intro">
    <strong>Plan your loadout in minutes.</strong> Pick a ship, review its stock hardpoints from the wiki,
    then swap guns and see combined DPS. This is a simplified builder, not a full heat or power simulator.
  </div>
  <section class="guide-section">
    <div class="catalog-toolbar">
      <input type="search" id="loadoutShipInput" class="catalog-search" placeholder="Ship wiki slug (e.g. gladius, cutlass-black)" value="${escapeAttr(slug)}" />
      <button type="button" class="btn btn-sm" id="loadoutLoadShipBtn">Load ship</button>
    </div>
  </section>
  <div id="loadoutBuilderBody"><p class="muted small">Enter a ship slug above and tap Load ship to begin.</p></div>`;
}

function renderLoadoutBuilderBody(blueprint, summary) {
  if (!blueprint?.ok) {
    return `<p class="muted">${escapeHtml(blueprint?.error || "Could not load ship.")}</p>`;
  }
  const weapons = summary?.weapons || blueprint.stockSummary?.weapons || [];
  const totals = summary || blueprint.stockSummary;
  const rows = weapons
    .map((w) => {
      const assigned =
        loadoutBuilderState.slotAssignments[w.portId] || w.className || w.stockClassName || "";
      return `<tr>
        <td>${displayText(w.label)}</td>
        <td>S${displayText(w.sizeMax ?? "—")}</td>
        <td>${displayText(w.name || assigned || "Empty")}</td>
        <td>${formatFleetCell(w.dps)}</td>
        <td>
          <input type="search" class="loadout-slot-input catalog-search" data-loadout-port="${escapeAttr(w.portId)}" placeholder="Weapon slug or class" value="${escapeAttr(assigned)}" />
          <button type="button" class="btn btn-sm btn-ghost loadout-slot-search" data-loadout-port="${escapeAttr(w.portId)}" data-loadout-size="${escapeAttr(w.sizeMax ?? "")}">Find</button>
          <div class="loadout-slot-results" data-loadout-results="${escapeAttr(w.portId)}"></div>
        </td>
      </tr>`;
    })
    .join("");
  const components = (blueprint.stockComponents || [])
    .slice(0, 12)
    .map((c) => `<li class="muted small">${displayText(c.type)} · ${displayText(c.name)}${c.size ? ` (S${c.size})` : ""}</li>`)
    .join("");
  return `<section class="guide-card loadout-builder-panel">
    <header class="combat-profile-head">
      <h3>${displayText(blueprint.ship?.name)}</h3>
      <button type="button" class="btn btn-sm" id="loadoutRecalcBtn">Recalculate</button>
    </header>
    <p class="combat-headline">Combined DPS: ${formatFleetCell(totals?.totalDps)} · Alpha burst: ${formatFleetCell(totals?.totalAlpha)} · ${totals?.weaponCount ?? weapons.length} guns</p>
    <p class="muted small">${displayText(totals?.note || blueprint.limitations || "")}</p>
    <div class="catalog-table-wrap"><table class="catalog-table">
      <thead><tr><th>Hardpoint</th><th>Size</th><th>Weapon</th><th>DPS</th><th>Swap</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    ${components ? `<h4 class="guide-section-title">Stock components</h4><ul class="guide-list">${components}</ul>` : ""}
    <div id="loadoutHullProfile"></div>
  </section>`;
}

async function loadFleetCompareTab(tabId, options = {}) {
  const state = guideQueryByTab[tabId] || { query: "", offset: 0, sort: "hull" };
  if (options.resetOffset) state.offset = 0;
  guideQueryByTab[tabId] = state;

  setPanelHtml(
    tabId,
    `<div class="hub-intro"><strong>Compare the whole fleet.</strong> Sort ships by hull, shields, SCM, cargo, mass, and IR signature. Click Stats on any row for the full performance breakdown.</div>${fleetMetaLine(fleetCompareMeta)}${fleetCompareToolbar(tabId)}<p class="muted small">Loading fleet index…</p>`
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
    setPanelHtml(
      tabId,
      `<div class="hub-intro"><strong>Compare the whole fleet.</strong> Sort ships by hull, shields, SCM, cargo, mass, and IR signature. Click Stats on any row for the full performance breakdown.</div>${fleetMetaLine(result.meta)}${fleetCompareToolbar(tabId)}${renderFleetCompareRows(result.rows)}`
    );
  } catch (e) {
    setPanelHtml(
      tabId,
      `${fleetMetaLine(fleetCompareMeta)}${fleetCompareToolbar(tabId)}<p class="muted">Fleet compare error: ${escapeHtml(e.message || String(e))}</p>`
    );
  }
}

async function loadLoadoutBuilderTab(tabId) {
  setPanelHtml(tabId, renderLoadoutBuilderShell());
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

async function enrichLoadoutCombatPanel() {
  const panel = document.querySelector("#panel-loadout .panel-body");
  if (!panel || loadoutCombatBusy) return;
  const rollup = getViewRollup(lastKnownState);
  const snap = rollup?.loadoutSnapshots?.[rollup.loadoutSnapshots.length - 1];
  if (!snap?.items?.length) return;

  loadoutCombatBusy = true;
  panel.querySelector(".combat-loadout-summary")?.remove();
  panel.insertAdjacentHTML(
    "beforeend",
    `<section class="combat-loadout-summary"><p class="muted small">Loading combat stats for your gear…</p></section>`
  );
  try {
    const gear = snap.items.filter((i) => i.category !== "cosmetic");
    const result = await window.debrief.combatGetLoadoutSummary(
      gear.map((i) => ({
        port: i.port,
        slotLabel: i.slotLabel,
        className: i.className,
        label: i.label,
        category: i.category,
      }))
    );
    panel.querySelector(".combat-loadout-summary")?.remove();
    panel.insertAdjacentHTML("beforeend", renderLoadoutCombatSummary(result.items));
  } catch (e) {
    panel.querySelector(".combat-loadout-summary")?.remove();
    panel.insertAdjacentHTML(
      "beforeend",
      `<p class="muted small">Could not load combat stats: ${escapeHtml(e.message || String(e))}</p>`
    );
  } finally {
    loadoutCombatBusy = false;
  }
}

async function attachCombatProfileToDetail(detail, kind) {
  const panel = document.querySelector(`#panel-${activeTab} .panel-body`);
  if (!panel || !detail) return;
  const key = detail.className || detail.slug || catalogDetailKey;
  if (!key) return;

  panel.querySelector(".combat-profile-panel")?.remove();
  panel.insertAdjacentHTML(
    "beforeend",
    `<section class="combat-profile-panel guide-card"><p class="muted small">Loading combat stats…</p></section>`
  );

  const isVehicle = activeTab === "catalog-ships" || kind === "vehicle";
  try {
    const data = isVehicle
      ? await window.debrief.combatGetVehicleProfile({ className: key, slug: detail.slug || key })
      : await window.debrief.combatGetItemProfile({ className: key, slug: detail.slug || key });
    panel.querySelector(".combat-profile-panel")?.remove();
    panel.insertAdjacentHTML("beforeend", renderCombatProfilePanel(data));
  } catch (e) {
    panel.querySelector(".combat-profile-panel")?.remove();
    panel.insertAdjacentHTML(
      "beforeend",
      renderCombatProfilePanel({ ok: false, error: e.message || String(e) })
    );
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
    if (tabId === "catalog-ships") {
      result = await window.debrief.catalogQueryVehicles({
        query: state.query,
        offset: state.offset,
        limit: 60,
        withListingsOnly: true,
      });
      setPanelHtml(
        tabId,
        `${catalogMetaLine()}${catalogToolbar(tabId)}${renderCatalogShipRows(result.rows)}${renderCatalogPager(tabId, result)}${catalogDetailKey ? "" : ""}`
      );
    } else if (tabId === "catalog-shops") {
      result = await window.debrief.catalogQueryShops({
        query: state.query,
        offset: state.offset,
        limit: 50,
      });
      setPanelHtml(
        tabId,
        `${catalogMetaLine()}${catalogToolbar(tabId)}${renderCatalogShopRows(result.rows)}${renderCatalogPager(tabId, result)}`
      );
    } else if (tabId === "catalog-ship-services") {
      result = await window.debrief.catalogQueryPlaces({
        query: state.query,
        offset: state.offset,
        limit: 80,
      });
      setPanelHtml(
        tabId,
        `${catalogMetaLine()}${catalogToolbar(tabId)}${renderCatalogShipServiceRows(result.rows)}${renderCatalogPager(tabId, result)}`
      );
    } else {
      result = await window.debrief.catalogQueryItems({
        query: state.query,
        offset: state.offset,
        limit: 80,
        section: state.section,
        withListingsOnly: true,
      });
      setPanelHtml(
        tabId,
        `${catalogMetaLine()}${catalogToolbar(tabId)}${renderCatalogItemRows(result.rows, tabId)}${renderCatalogPager(tabId, result)}`
      );
    }
    if (catalogDetailKey) {
      const kind =
        tabId === "catalog-shops"
          ? "shop"
          : tabId === "catalog-ship-services"
            ? "place"
            : "item";
      await showCatalogDetail(catalogDetailKey, kind);
    }
  } catch (e) {
    setPanelHtml(
      tabId,
      `${catalogMetaLine()}${catalogToolbar(tabId)}<p class="muted">Catalog error: ${escapeHtml(e.message || String(e))}</p>`
    );
  }
}

async function showCatalogDetail(key, kind) {
  catalogDetailKey = key;
  const panel = document.querySelector(`#panel-${activeTab} .panel-body`);
  if (!panel) return;
  const detail =
    kind === "shop"
      ? await window.debrief.catalogShopDetail(key)
      : kind === "place"
        ? await window.debrief.catalogPlaceDetail(key)
        : await window.debrief.catalogItemDetail(key);
  const existing = panel.querySelector(".catalog-detail");
  if (existing) existing.remove();
  panel.insertAdjacentHTML("beforeend", renderCatalogDetail(detail, kind));
  await attachCombatProfileToDetail(detail, kind);
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

function guidesCommodityToolbar(tabId) {
  const state = guideQueryByTab[tabId] || { query: "", sort: "name" };
  const busy = guideCommodityRefreshBusy ? " disabled" : "";
  return `<div class="catalog-toolbar">
    <input type="search" class="catalog-search" data-guide-search="${escapeAttr(tabId)}" placeholder="Search name, code, kind…" value="${escapeAttr(state.query || "")}" />
    <button type="button" class="btn btn-sm btn-ghost" data-guide-search-btn="${escapeAttr(tabId)}">Search</button>
    <select class="guide-sort-select" data-guide-sort="${escapeAttr(tabId)}" aria-label="Sort commodities">
      <option value="name"${state.sort === "name" ? " selected" : ""}>Sort: name</option>
      <option value="spread"${state.sort === "spread" ? " selected" : ""}>Sort: spread</option>
      <option value="sell"${state.sort === "sell" ? " selected" : ""}>Sort: sell</option>
      <option value="buy"${state.sort === "buy" ? " selected" : ""}>Sort: buy</option>
    </select>
    <button type="button" class="btn btn-sm" data-guide-refresh${busy}>Refresh prices</button>
  </div>
  <p class="muted small">Refresh with catalog sync or the Refresh prices button above.</p>`;
}

function renderGuideCommodityRows(rows, tabId) {
  if (!rows?.length) {
    return tabId ? emptyPanel(tabById(tabId)) : `<p class="muted">No commodities match your search.</p>`;
  }
  const body = rows
    .map((row) => {
      const spreadClass =
        row.spread != null && row.spread > 0 ? " commodity-spread-positive" : "";
      const illegal = row.isIllegal ? "Yes" : EMPTY_DISPLAY;
      return `<tr class="guide-commodity-row" data-guide-commodity="${row.id}">
        <td><button type="button" class="catalog-link" data-guide-commodity="${row.id}">${displayText(row.name)}</button><div class="muted small mono">${escapeHtml(row.code || "")}</div></td>
        <td>${displayText(row.kind)}</td>
        <td>${escapeHtml(fmtScuPrice(row.priceBuy))}</td>
        <td>${escapeHtml(fmtScuPrice(row.priceSell))}</td>
        <td class="${spreadClass.trim()}">${row.spread != null && row.spread > 0 ? escapeHtml(fmtScuPrice(row.spread)) : EMPTY_DISPLAY}</td>
        <td>${escapeHtml(illegal)}</td>
      </tr>`;
    })
    .join("");
  return `<div class="catalog-table-wrap"><table class="catalog-table">
    <thead><tr><th>Name</th><th>Kind</th><th>Buy (aUEC/SCU)</th><th>Sell (aUEC/SCU)</th><th>Spread</th><th>Illegal</th></tr></thead>
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

  return `<article class="catalog-detail guide-detail">
    <header class="catalog-detail-head">
      <h3>${displayText(c.name)}</h3>
      <button type="button" class="link" data-guide-detail-close>Close</button>
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
  const localCards = (data.local || [])
    .map((note) => {
      const stNotes = (note.startrackerNotes || [])
        .map((n) => `<li>${displayText(n)}</li>`)
        .join("");
      const plNotes = (note.playerNotes || [])
        .map((n) => `<li>${displayText(n)}</li>`)
        .join("");
      const rsi = note.rsiUrl
        ? `<p><button type="button" class="link" data-guide-external="${escapeAttr(note.rsiUrl)}">Read on RSI</button></p>`
        : "";
      return `<article class="patch-note-card guide-card">
        <header><h3>${displayText(note.title || note.version)}</h3><span class="muted small">${escapeHtml(note.date || note.version || "")}</span></header>
        ${stNotes ? `<h4 class="guide-detail-sub">StarTracker</h4><ul class="guide-list">${stNotes}</ul>` : ""}
        ${plNotes ? `<h4 class="guide-detail-sub">For players</h4><ul class="guide-list">${plNotes}</ul>` : ""}
        ${rsi}
      </article>`;
    })
    .join("");

  const remoteCards = (data.remote || [])
    .map((link) => {
      const url = link.rsiUrl || "";
      const titleBtn = url
        ? `<button type="button" class="catalog-link" data-guide-external="${escapeAttr(url)}">${displayText(link.title)}</button>`
        : displayText(link.title);
      return `<article class="patch-note-card guide-card guide-card-remote">
        <header><h3>${titleBtn}</h3><span class="muted small">${escapeHtml(link.dateHuman || link.channel || "")}</span></header>
        ${link.series ? `<p class="muted small">${displayText(link.series)}</p>` : ""}
      </article>`;
    })
    .join("");

  const meta = data.meta?.fetchedAt
    ? `<p class="guides-meta muted small">Wiki comm-links cached ${escapeHtml(fmtDateTime(data.meta.fetchedAt))}.</p>`
    : "";

  return `${meta}${localCards || ""}${remoteCards ? `<h3 class="guide-section-title">Recent from RSI / Wiki</h3>${remoteCards}` : ""}${!localCards && !remoteCards ? `<p class="muted">No patch notes available.</p>` : ""}`;
}

function buildSmugglerRoutesPanel(data) {
  const routes = data.routes || [];
  if (!routes.length) return `<p class="muted">No smuggler routes loaded.</p>`;
  const cards = routes
    .map((route) => {
      const hints = (route.commodityHints || []).map((h) => displayText(h)).join(", ");
      const buys = (route.buyLocations || []).map((l) => `<li>${displayText(l)}</li>`).join("");
      const sells = (route.sellLocations || []).map((l) => `<li>${displayText(l)}</li>`).join("");
      return `<article class="guide-route-card guide-card">
        <header><h3>${displayText(route.name)}</h3><span class="entry-badge">${escapeHtml(route.risk || "Unknown")} risk</span></header>
        ${hints ? `<p class="muted small"><strong>Commodities:</strong> ${hints}</p>` : ""}
        ${buys ? `<h4 class="guide-detail-sub">Buy</h4><ul class="guide-list">${buys}</ul>` : ""}
        ${sells ? `<h4 class="guide-detail-sub">Sell</h4><ul class="guide-list">${sells}</ul>` : ""}
        ${route.notes ? `<p class="overview-prose">${displayText(route.notes)}</p>` : ""}
      </article>`;
    })
    .join("");
  const disclaimer = data.disclaimer
    ? `<p class="guides-meta muted small">${displayText(data.disclaimer)}</p>`
    : "";
  return `${disclaimer}${cards}`;
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

async function showGuideCommodityDetail(commodityId) {
  guideDetailCommodityId = commodityId;
  const panel = document.querySelector(`#panel-${activeTab} .panel-body`);
  if (!panel) return;
  const existing = panel.querySelector(".guide-detail");
  if (existing) existing.remove();
  panel.insertAdjacentHTML(
    "beforeend",
    `<p class="muted small guide-detail-loading">Loading terminal prices…</p>`
  );
  try {
    const detail = await window.debrief.guidesGetCommodityDetail(commodityId);
    panel.querySelector(".guide-detail-loading")?.remove();
    panel.insertAdjacentHTML("beforeend", renderGuideCommodityDetail(detail));
  } catch (e) {
    panel.querySelector(".guide-detail-loading")?.remove();
    panel.insertAdjacentHTML(
      "beforeend",
      `<p class="muted">Could not load detail: ${escapeHtml(e.message || String(e))}</p>`
    );
  }
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

  if (tabId === "guides-commodities" || tabId === "guides-mining") {
    const state = guideQueryByTab[tabId] || {
      query: "",
      offset: 0,
      sort: tabId === "guides-mining" ? "sell" : "name",
      filter: tabId === "guides-mining" ? "mining" : "trade",
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
      setPanelHtml(
        tabId,
        `${guidesMetaLine(result.meta)}${guidesCommodityToolbar(tabId)}${renderGuideCommodityRows(result.rows, tabId)}${renderGuideCommodityPager(tabId, result)}`
      );
      if (guideDetailCommodityId) {
        await showGuideCommodityDetail(guideDetailCommodityId);
      }
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

    const searchBtn = e.target.closest("[data-guide-search-btn]");
    if (searchBtn) {
      const tabId = searchBtn.dataset.guideSearchBtn;
      const input = document.querySelector(`[data-guide-search="${tabId}"]`);
      if (input && guideQueryByTab[tabId]) {
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
      state.offset = Math.max(0, state.offset + (dir === "next" ? 80 : -80));
      loadGuideTab(tabId);
      return;
    }

    const commodityBtn = e.target.closest("[data-guide-commodity]");
    if (commodityBtn) {
      await showGuideCommodityDetail(Number(commodityBtn.dataset.guideCommodity));
      return;
    }

    if (e.target.closest("[data-guide-detail-close]")) {
      guideDetailCommodityId = null;
      document.querySelectorAll(".guide-detail").forEach((el) => el.remove());
      return;
    }

    if (e.target.id === "combatSearchBtn" || e.target.closest("#combatSearchBtn")) {
      const input = $("combatSearchInput");
      const resultsEl = $("combatSearchResults");
      if (!input || !resultsEl) return;
      resultsEl.innerHTML = `<p class="muted small">Searching…</p>`;
      try {
        const data = await window.debrief.combatSearch({ query: input.value.trim(), limit: 20 });
        resultsEl.innerHTML = renderCombatSearchResults(data.rows);
      } catch (err) {
        resultsEl.innerHTML = `<p class="muted">Search failed: ${escapeHtml(err.message || String(err))}</p>`;
      }
      return;
    }

    const combatOpen = e.target.closest(".combat-search-open");
    if (combatOpen) {
      const kind = combatOpen.dataset.combatKind;
      const key = combatOpen.dataset.combatKey;
      const detailEl = $("combatSearchDetail");
      if (!detailEl || !key) return;
      detailEl.innerHTML = `<p class="muted small">Loading stats…</p>`;
      try {
        const [data, tools] = await Promise.all([
          kind === "vehicle"
            ? window.debrief.combatGetVehicleProfile({ className: key, slug: key })
            : window.debrief.combatGetItemProfile({ className: key, slug: key }),
          window.debrief.combatGetExternalTools(),
        ]);
        detailEl.innerHTML = renderCombatProfilePanel(data, { advancedTools: tools.tools });
      } catch (err) {
        detailEl.innerHTML = renderCombatProfilePanel({ ok: false, error: err.message });
      }
      return;
    }

    const fleetRefresh = e.target.closest("[data-fleet-refresh]");
    if (fleetRefresh && activeTab === "guides-fleet") {
      loadFleetCompareTab("guides-fleet", { forceRefresh: true, resetOffset: true });
      return;
    }

    const fleetOpen = e.target.closest(".fleet-row-open");
    if (fleetOpen) {
      const key = fleetOpen.dataset.fleetKey || fleetOpen.dataset.fleetSlug;
      const detailEl = $("fleetCompareDetail");
      if (!detailEl || !key) return;
      detailEl.innerHTML = `<p class="muted small">Loading ship performance…</p>`;
      try {
        const [data, tools] = await Promise.all([
          window.debrief.combatGetVehicleProfile({ className: key, slug: fleetOpen.dataset.fleetSlug || key }),
          window.debrief.combatGetExternalTools(),
        ]);
        detailEl.innerHTML = renderCombatProfilePanel(data, { advancedTools: tools.tools });
      } catch (err) {
        detailEl.innerHTML = renderCombatProfilePanel({ ok: false, error: err.message });
      }
      return;
    }

    if (e.target.id === "loadoutLoadShipBtn" || e.target.closest("#loadoutLoadShipBtn")) {
      const input = $("loadoutShipInput");
      const slug = input?.value.trim().toLowerCase();
      if (!slug) return;
      loadoutBuilderState = { shipSlug: slug, slotAssignments: {} };
      loadoutBuilderBlueprint = null;
      loadLoadoutBuilderTab("guides-loadout");
      return;
    }

    if (e.target.id === "loadoutRecalcBtn" || e.target.closest("#loadoutRecalcBtn")) {
      const assignments = {};
      document.querySelectorAll(".loadout-slot-input").forEach((input) => {
        const port = input.dataset.loadoutPort;
        const val = input.value.trim();
        if (port && val) assignments[port] = val;
      });
      loadoutBuilderState.slotAssignments = assignments;
      loadLoadoutBuilderTab("guides-loadout");
      return;
    }

    const loadoutSearch = e.target.closest(".loadout-slot-search");
    if (loadoutSearch) {
      const port = loadoutSearch.dataset.loadoutPort;
      const sizeMax = loadoutSearch.dataset.loadoutSize;
      const input = document.querySelector(`[data-loadout-port="${port}"]`);
      const resultsEl = document.querySelector(`[data-loadout-results="${port}"]`);
      if (!input || !resultsEl) return;
      resultsEl.innerHTML = `<p class="muted small">Searching…</p>`;
      try {
        const data = await window.debrief.loadoutSearchWeapons({
          query: input.value.trim() || "repeater",
          sizeMax: sizeMax ? Number(sizeMax) : null,
        });
        if (!data.rows?.length) {
          resultsEl.innerHTML = `<p class="muted small">No WeaponGun matches.</p>`;
          return;
        }
        resultsEl.innerHTML = data.rows
          .map(
            (r) =>
              `<button type="button" class="link loadout-pick-weapon" data-loadout-port="${escapeAttr(port)}" data-loadout-weapon="${escapeAttr(r.className || r.slug)}">${displayText(r.name)}${r.dps != null ? ` · ${formatFleetCell(r.dps)} DPS` : ""}</button>`
          )
          .join(" ");
      } catch (err) {
        resultsEl.innerHTML = `<p class="muted small">${escapeHtml(err.message || String(err))}</p>`;
      }
      return;
    }

    const loadoutPick = e.target.closest(".loadout-pick-weapon");
    if (loadoutPick) {
      const port = loadoutPick.dataset.loadoutPort;
      const weapon = loadoutPick.dataset.loadoutWeapon;
      const input = document.querySelector(`[data-loadout-port="${port}"]`);
      if (input && weapon) input.value = weapon;
      if (port && weapon) {
        loadoutBuilderState.slotAssignments[port] = weapon;
        loadLoadoutBuilderTab("guides-loadout");
      }
      return;
    }
  });

  $("tabPanels")?.addEventListener("change", (e) => {
    const fleetSort = e.target.closest("[data-fleet-sort]");
    if (fleetSort) {
      const tabId = fleetSort.dataset.fleetSort;
      if (!guideQueryByTab[tabId]) return;
      guideQueryByTab[tabId].sort = fleetSort.value;
      loadFleetCompareTab(tabId, { resetOffset: true });
      return;
    }

    const sortSelect = e.target.closest("[data-guide-sort]");
    if (!sortSelect) return;
    const tabId = sortSelect.dataset.guideSort;
    if (!guideQueryByTab[tabId]) return;
    guideQueryByTab[tabId].sort = sortSelect.value;
    loadGuideTab(tabId, { resetOffset: true });
  });

  $("tabPanels")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (e.target.id === "loadoutShipInput") {
      $("loadoutLoadShipBtn")?.click();
      return;
    }
    const fleetInput = e.target.closest("[data-fleet-search]");
    if (fleetInput) {
      const tabId = fleetInput.dataset.fleetSearch;
      if (!guideQueryByTab[tabId]) return;
      guideQueryByTab[tabId].query = fleetInput.value.trim();
      loadFleetCompareTab(tabId, { resetOffset: true });
      return;
    }
    const input = e.target.closest("[data-guide-search]");
    if (!input) return;
    const tabId = input.dataset.guideSearch;
    if (!guideQueryByTab[tabId]) return;
    guideQueryByTab[tabId].query = input.value.trim();
    loadGuideTab(tabId, { resetOffset: true });
  });

  $("tabPanels")?.addEventListener("input", (e) => {
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
      loadCatalogTab(tabId);
      return;
    }

    const itemBtn = e.target.closest("[data-catalog-item]");
    if (itemBtn) {
      await showCatalogDetail(itemBtn.dataset.catalogItem, "item");
      return;
    }

    const shopBtn = e.target.closest("[data-catalog-shop]");
    if (shopBtn) {
      await showCatalogDetail(shopBtn.dataset.catalogShop, "shop");
      return;
    }

    const placeBtn = e.target.closest("[data-catalog-place]");
    if (placeBtn) {
      await showCatalogDetail(placeBtn.dataset.catalogPlace, "place");
      return;
    }

    if (e.target.closest("[data-catalog-detail-close]")) {
      catalogDetailKey = null;
      document.querySelectorAll(".catalog-detail").forEach((el) => el.remove());
    }
  });

  $("tabPanels")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const input = e.target.closest("[data-catalog-search]");
    if (!input) return;
    const tabId = input.dataset.catalogSearch;
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
  if (activeTab === "loadout") enrichLoadoutCombatPanel();
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
initAppInfo();
initUpdateUi();
initArchiveUi();
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
