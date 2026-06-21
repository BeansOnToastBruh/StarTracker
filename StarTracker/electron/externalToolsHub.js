const fs = require("fs");
const path = require("path");

let seedDir = null;

function init(options = {}) {
  seedDir = options.seedDir || null;
}

function readSeed(name) {
  if (!seedDir) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(seedDir, name), "utf8"));
  } catch {
    return null;
  }
}

function getExternalToolsHub() {
  const seed = readSeed("external-tools-hub.json") || {};
  const categories = Array.isArray(seed.categories) ? seed.categories : [];
  const tools = Array.isArray(seed.tools) ? seed.tools : [];

  const byCategory = categories.map((cat) => ({
    ...cat,
    tools: tools.filter((t) => t.category === cat.id),
  }));

  const inAppCount = tools.filter((t) => t.inAppTab).length;

  return {
    categories: byCategory,
    tools,
    inAppCount,
    meta: {
      source: "data/guides/external-tools-hub.json",
      updated: seed.updated || null,
    },
    disclaimer:
      "Community tools listed for reference. StarTracker marks tabs that cover similar features in-app. Drop rates and live prices may require external sites.",
  };
}

function getCombatExternalTools() {
  const seed = readSeed("external-tools-hub.json") || {};
  const tools = (Array.isArray(seed.tools) ? seed.tools : []).filter(
    (t) =>
      (t.category === "combat" || t.category === "fleet") && t.status !== "deprecated"
  );
  const seen = new Set();
  const deduped = [];
  for (const tool of tools) {
    const key = String(tool.url || tool.name || tool.id)
      .toLowerCase()
      .replace(/\/+$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      url: tool.url,
      tags: tool.tags || [],
      inAppTab: tool.inAppTab || null,
    });
    if (deduped.length >= 5) break;
  }
  return {
    tools: deduped,
    meta: { source: "data/guides/external-tools-hub.json", category: "combat" },
  };
}

module.exports = {
  init,
  getExternalToolsHub,
  getCombatExternalTools,
};
