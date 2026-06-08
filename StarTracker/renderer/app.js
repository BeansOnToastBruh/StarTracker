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

const TABS = [
  {
    id: "overview",
    label: "Overview",
    hint: "A quick snapshot of your session.",
    empty: "Hop in and play. Once you're tracking a session, your summary shows up here.",
  },
  {
    id: "missions",
    label: "Missions",
    hint: "Contracts you accepted, completed, failed, or walked away from, with per-objective progress when the log shows it.",
    empty: "No contracts yet. Grab a mission in-game. You'll see Started when you accept, and Complete when you finish.",
  },
  {
    id: "rewards",
    label: "Rewards",
    hint: "aUEC from Awarded popups, rep, and loot bundles. Not your wallet balance. Matched to contracts when we can.",
    empty: "No payouts logged yet. Finish a contract and look for Awarded aUEC or You've Earned popups in-game.",
  },
  {
    id: "fines",
    label: "Fines",
    hint: "UEC fines from CrimeStat and monitored-space infraction popups.",
    empty: "No fines logged this session.",
  },
  {
    id: "insurance",
    label: "Insurance",
    hint: "Ship insurance claims that completed (hull respawn at station).",
    empty: "No insurance claims logged this session.",
  },
  {
    id: "shopping",
    label: "Shopping",
    hint: "Items bought at shops and kiosks when the log records your purchase.",
    empty: "No shop purchases logged this session.",
  },
  {
    id: "catalog-ships",
    label: "Ship catalog",
    hint: "Flyable ships with in-game buy and rent prices by station. Data from Star Citizen Wiki and UEX.",
    empty: "No ship catalog loaded yet. Use Refresh catalog below or wait for the background sync.",
  },
  {
    id: "catalog-weapons",
    label: "FPS weapons",
    hint: "Personal weapons and attachments sold at in-game shops, with prices and locations.",
    empty: "No weapon catalog loaded yet. Use Refresh catalog below.",
  },
  {
    id: "catalog-armor",
    label: "Armor",
    hint: "Armor pieces and undersuits for sale at shops, with station and aUEC price.",
    empty: "No armor catalog loaded yet. Use Refresh catalog below.",
  },
  {
    id: "catalog-ship-weapons",
    label: "Ship weapons",
    hint: "Ship guns, turrets, missiles, and racks with shop availability and prices.",
    empty: "No ship weapon catalog loaded yet. Use Refresh catalog below.",
  },
  {
    id: "catalog-ship-parts",
    label: "Ship parts",
    hint: "Coolers, power plants, shields, quantum drives, and utility components for sale.",
    empty: "No ship parts catalog loaded yet. Use Refresh catalog below.",
  },
  {
    id: "catalog-shops",
    label: "Shop finder",
    hint: "Browse shops and stations to see what they sell. Search by location or terminal name.",
    empty: "No shop data loaded yet. Use Refresh catalog below.",
  },
  {
    id: "catalog-places",
    label: "Places",
    hint: "Planets, stations, and ports with ship services: refuel, repair, and ship ammo restock. Data from UEX terminal records.",
    empty: "No place data loaded yet. Use Refresh catalog below.",
  },
  {
    id: "blueprints",
    label: "Blueprints",
    hint: "Blueprint unlocks from contracts when Game.log includes the name. Generic reward bundles without a name won't appear here.",
    empty: "No blueprints logged yet. Complete a mission that grants a blueprint. The log must include the blueprint name in the payout text.",
  },
  {
    id: "deaths",
    label: "Deaths",
    hint: "Every time you went down and respawned.",
    empty: "No deaths this session. Downed-and-respawn runs and instant ship deaths show up here when they happen.",
  },
  {
    id: "kills",
    label: "Kills",
    hint: "Players you killed or neutralized, especially PvP bounty targets when you finish the contract.",
    empty: "No kills tracked yet. Finish a PvP bounty after you neutralize the target and it will show up here.",
  },
  {
    id: "ships",
    label: "Ships lost",
    hint: "Your hulls that were destroyed while you were flying or had control. Other players' ships are ignored.",
    empty: "Nothing lost yet. A ship shows up here when a hull you were flying gets destroyed.",
  },
  {
    id: "history",
    label: "Log archive",
    hint: "Game.log backups since patch 4.8. Click one to view everything we can parse from that file.",
    empty: "No log archives found. Set your Game.log path to the StarCitizen LIVE folder (logbackups lives beside it).",
  },
];

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
  "catalog-places": { query: "", offset: 0, services: [] },
};
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
    <p class="panel-hint">${escapeHtml(tab.hint)}</p>
    <div class="panel-body">${innerHtml}</div>
  </section>`;
}

function emptyPanel(tab) {
  return `<div class="empty-state">
    <p>${escapeHtml(tab.empty)}</p>
  </div>`;
}

function initStats() {
  const el = $("stats");
  const statTitles = {
    auec: "aUEC from payout popups this session. Not your wallet balance.",
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

function initTabs() {
  const nav = $("tabNav");
  const panels = $("tabPanels");
  nav.innerHTML = TABS.map(
    (t) =>
      `<button type="button" class="tab-btn ${t.id === activeTab ? "is-active" : ""}" role="tab" id="tab-${t.id}" data-tab="${t.id}" aria-selected="${t.id === activeTab}" aria-controls="panel-${t.id}"><span class="tab-label">${escapeHtml(t.label)}</span><span class="tab-count" aria-hidden="true"></span></button>`
  ).join("");
  panels.innerHTML = TABS.map((t) => panelShell(t, emptyPanel(t))).join("");

  nav.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
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
    case "catalog-places":
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

function sumAuecFromEvents(session) {
  const events = session?.events;
  if (!events?.length) return null;
  let sum = 0;
  let found = false;
  for (const e of events) {
    if (e.type === "reward" && e.detail?.auec != null) {
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
  const fromSession =
    t?.totalAuec ?? s?.auecEarned ?? sumAuecFromEvents(session) ?? 0;
  if (fromSession > 0) return { total: fromSession, source: "session" };
  if (archiveViewSession && archiveViewMeta?.awardedAuecTotal > 0) {
    return { total: archiveViewMeta.awardedAuecTotal, source: "archive-scan" };
  }
  if (!archiveViewSession && (state?.logFileAuecTotal ?? 0) > 0) {
    return { total: state.logFileAuecTotal, source: "log-scan" };
  }
  return { total: 0, source: "none" };
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
    auec: auecInfo.total.toLocaleString(),
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
            : "aUEC from payout popups this session. Not your wallet balance.";
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
    `<p class="overview-lead"><strong>${escapeHtml(pilot)}</strong>, session length <strong>${escapeHtml(r.durationLabel || "?")}</strong>.</p>`,
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
    `<li>aUEC earned: <strong>${(t?.totalAuec ?? 0).toLocaleString()}</strong></li>`,
    `<li>Fines: <strong>${(r.finesTotal ?? 0).toLocaleString()}</strong> UEC · Insurance claims: <strong>${r.insuranceClaims?.length ?? 0}</strong> · Shop spend: <strong>${Math.round(r.shopSpendTotal ?? 0).toLocaleString()}</strong> aUEC</li>`,
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
    `<p class="overview-foot muted">Use the tabs above for the full breakdown. <strong>Rewards</strong> includes <strong>Awarded aUEC</strong> popups and item bundles. This is not your wallet balance. Game.log does not log wallet totals.</p>`
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

  if (t.totalAuec > 0 || t.repByFaction?.length || t.itemCount > 0) {
    const totals = [];
    if (t.totalAuec > 0) {
      totals.push(
        `<div class="reward-total-card"><span class="reward-lbl">aUEC earned (session)</span><span class="reward-total-val">${t.totalAuec.toLocaleString()}</span></div>`
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
        return entryCard({
          time: fmtDateTime(r.at),
          badge: r.kind === "auec" ? "Currency" : r.kind === "reputation" ? "Rep" : "Items",
          badgeClass: "entry-good",
          title,
          description: r.contractTitle
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

const PLACE_SERVICE_FILTERS = [
  { id: "refuel", label: "Refuel" },
  { id: "repair", label: "Ship repair" },
  { id: "shipAmmo", label: "Ship ammo" },
];

function serviceBadge(on, label) {
  const cls = on ? "svc-yes" : "svc-no";
  return `<span class="svc-badge ${cls}">${escapeHtml(label)}</span>`;
}

function catalogToolbar(tabId) {
  const q = catalogQueryByTab[tabId]?.query || "";
  const busy = catalogSyncBusy ? " disabled" : "";
  const serviceFilters =
    tabId === "catalog-places"
      ? `<div class="catalog-service-filters" role="group" aria-label="Service filters">${PLACE_SERVICE_FILTERS.map(
          (f) => {
            const on = (catalogQueryByTab[tabId]?.services || []).includes(f.id);
            return `<label class="catalog-filter-chip"><input type="checkbox" data-catalog-service="${escapeAttr(f.id)}" data-catalog-service-tab="${escapeAttr(tabId)}"${on ? " checked" : ""} /><span>${escapeHtml(f.label)}</span></label>`;
          }
        ).join("")}</div>`
      : "";
  return `<div class="catalog-toolbar">
    <input type="search" class="catalog-search" data-catalog-search="${escapeAttr(tabId)}" placeholder="${tabId === "catalog-places" ? "Search system, planet, station, city…" : "Search name, class, manufacturer, location…"}" value="${escapeAttr(q)}" />
    <button type="button" class="btn btn-sm btn-ghost" data-catalog-search-btn="${escapeAttr(tabId)}">Search</button>
    <button type="button" class="btn btn-sm" data-catalog-refresh${busy}>Refresh catalog</button>
  </div>${serviceFilters}`;
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
      <th>Item</th><th>Type</th><th>Manufacturer</th><th>Best price</th><th>Shop / location</th>
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
          <td>${displayText(loc)}${listings.length > 1 ? ` <span class="muted small">(+${listings.length - 1})</span>` : ""}</td>
        </tr>`;
      })
      .join("")}</tbody></table></div>`;
}

function renderCatalogShipRows(rows) {
  if (!rows.length) return emptyPanel(tabById("catalog-ships"));
  return `<div class="catalog-table-wrap"><table class="catalog-table">
    <thead><tr>
      <th>Ship</th><th>Manufacturer</th><th>Cargo</th><th>Crew</th><th>Buy / rent</th><th>Location</th>
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
          <td>${displayText(loc)}</td>
        </tr>`;
      })
      .join("")}</tbody></table></div>`;
}

function renderCatalogPlaceRows(rows) {
  if (!rows.length) return emptyPanel(tabById("catalog-places"));
  return `<div class="catalog-table-wrap"><table class="catalog-table">
    <thead><tr>
      <th>Place</th><th>System</th><th>Type</th><th>Refuel</th><th>Repair</th><th>Ship ammo</th>
    </tr></thead>
    <tbody>${rows
      .map((row) => {
        const svc = row.services || {};
        return `<tr class="catalog-row" data-catalog-place="${escapeAttr(row.key)}">
          <td><button type="button" class="catalog-link" data-catalog-place="${escapeAttr(row.key)}">${displayText(row.name)}</button><div class="muted small">${displayText(row.location || "")}</div></td>
          <td>${displayText(row.system || "")}</td>
          <td>${displayText(row.kind || "")}</td>
          <td>${serviceBadge(svc.refuel, svc.refuel ? "Yes" : "n/a")}</td>
          <td>${serviceBadge(svc.repair, svc.repair ? "Yes" : "n/a")}</td>
          <td>${serviceBadge(svc.shipAmmo, svc.shipAmmo ? "Yes" : "n/a")}</td>
        </tr>`;
      })
      .join("")}</tbody></table></div>`;
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
  const svc = detail.services || {};
  const svcLine = PLACE_SERVICE_FILTERS.map((f) =>
    serviceBadge(Boolean(svc[f.id]), f.label)
  ).join(" ");
  const terminals = (detail.terminals || [])
    .map((t) => {
      const bits = PLACE_SERVICE_FILTERS.filter((f) => t.services?.[f.id]).map(
        (f) => f.label
      );
      return `<tr>
        <td>${displayText(t.name)}</td>
        <td>${displayText(t.type || "")}</td>
        <td class="muted small">${escapeHtml(bits.join(", ") || EMPTY_DISPLAY)}</td>
      </tr>`;
    })
    .join("");
  return `<article class="catalog-detail">
    <header class="catalog-detail-head">
      <h3>${displayText(detail.name)}</h3>
      <button type="button" class="link" data-catalog-detail-close>Close</button>
    </header>
    <p class="muted small">${displayText(detail.location || "")} · ${displayText(detail.system || "")}</p>
    <div class="catalog-service-line">${svcLine}</div>
    <div class="catalog-table-wrap"><table class="catalog-table">
      <thead><tr><th>Terminal</th><th>Type</th><th>Services</th></tr></thead>
      <tbody>${terminals || `<tr><td colspan="3" class="muted">No terminals listed</td></tr>`}</tbody>
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
    } else if (tabId === "catalog-places") {
      result = await window.debrief.catalogQueryPlaces({
        query: state.query,
        offset: state.offset,
        limit: 60,
        services: state.services || [],
      });
      setPanelHtml(
        tabId,
        `${catalogMetaLine()}${catalogToolbar(tabId)}${renderCatalogPlaceRows(result.rows)}${renderCatalogPager(tabId, result)}`
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
          : tabId === "catalog-places"
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
        tabId === "catalog-ships" || tabId === "catalog-places"
          ? 60
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
  });

  $("tabPanels")?.addEventListener("change", (e) => {
    const box = e.target.closest("[data-catalog-service]");
    if (!box) return;
    const tabId = box.dataset.catalogServiceTab;
    const state = catalogQueryByTab[tabId];
    if (!state) return;
    const svc = box.dataset.catalogService;
    const set = new Set(state.services || []);
    if (box.checked) set.add(svc);
    else set.delete(svc);
    state.services = [...set];
    loadCatalogTab(tabId, { resetOffset: true });
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
  $("btnDownloadUpdate")?.addEventListener("click", () => {
    const url = updateInfo?.downloadUrl || updateInfo?.releaseUrl;
    if (url) window.debrief.openUpdateUrl(url);
  });

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

  window.debrief.onUpdateStatus(applyUpdateStatus);
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
initAppInfo();
initUpdateUi();
initArchiveUi();
initCatalogUi();

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
