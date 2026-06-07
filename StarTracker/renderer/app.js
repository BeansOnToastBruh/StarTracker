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
    hint: "aUEC, rep, and loot from payout popups when the game shows amounts. Not your wallet balance. Matched to contracts when we can.",
    empty: "No payouts logged yet. Finish a contract and watch for the reward popup in-game. That's what we pick up.",
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
    label: "History",
    hint: "Your past sessions, saved when you end a session.",
    empty: "Past sessions land here after you click End session.",
  },
];

let activeTab = "overview";
/** Last session snapshot used when main briefly sends current:null (stale log replay). */
let lastDisplaySession = null;
/** Latest update check result from main process. */
let updateInfo = null;
let updateBannerDismissed = false;

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

function renderStats(session) {
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
  const t = r?.rewardTotals;
  const values = {
    session: r?.durationLabel ?? EMPTY_DISPLAY,
    contracts: s?.contractsCompleted ?? 0,
    deaths: s?.deaths ?? 0,
    ships: s?.vehiclesLost ?? 0,
    kills: s?.kills ?? 0,
    auec: (t?.totalAuec ?? 0).toLocaleString(),
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
    `<p class="overview-foot muted">Use the tabs above for the full breakdown. <strong>Rewards</strong> sums aUEC from payout popups when the game shows an amount. This is not your wallet balance. Game.log does not log wallet totals. Some bounties pay out without a detailed popup. You may still have received everything in-game.</p>`
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

function buildHistory(history) {
  if (!history?.length) return emptyPanel(tabById("history"));
  return history
    .slice(0, 12)
    .map((s) => {
      const r = s.rollup;
      const st = s.stats || r?.stats || {};
      return entryCard({
        time: fmtDateTime(s.startedAt),
        badge: "Ended",
        badgeClass: "",
        title: s.durationLabel || "Session",
        description: `${st.contractsCompleted ?? 0} contracts completed · ${st.deaths ?? 0} deaths · ${st.kills ?? 0} kills · ${st.vehiclesLost ?? 0} ships lost`,
      });
    })
    .join("");
}

function resolveDisplaySession(state) {
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
  const liveSession = state.current;
  const session = resolveDisplaySession(state);
  const active = liveSession?.status === "active";
  const rollup = session?.rollup;

  $("autoTrack").checked = state.autoTrack;
  $("btnEnd").disabled = !active;

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

  applyLogPathState(state);

  renderStats(session);

  setPanelHtml("overview", buildOverview(session));
  setPanelHtml("missions", buildMissions(rollup));
  setPanelHtml("rewards", buildRewards(rollup));
  setPanelHtml("blueprints", buildBlueprints(rollup));
  setPanelHtml("deaths", buildDeaths(rollup));
  setPanelHtml("kills", buildKills(rollup));
  setPanelHtml("ships", buildShips(rollup));
  setPanelHtml("history", buildHistory(state.history));

  updateTabCounts(rollup);
}

initTheme();
initStats();
initTabs();
initAppInfo();
initUpdateUi();

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
      "Game.log not found at the usual locations. Use Browse to select your Game.log (StarCitizen\\LIVE), or Auto-detect to scan again.";
  }
}

async function browseAndSetLogPath() {
  const pick = await window.debrief.browseLogFile();
  if (pick.canceled || !pick.path) return;
  const result = await window.debrief.setLogPath({ path: pick.path });
  if (!result.ok && result.error) {
    $("statusLine").textContent = `Error: ${result.error}`;
  }
}

async function autoDetectLogPath() {
  const result = await window.debrief.setLogPath({ auto: true });
  if (!result.ok && result.error) {
    $("statusLine").textContent = `Error: ${result.error}`;
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
