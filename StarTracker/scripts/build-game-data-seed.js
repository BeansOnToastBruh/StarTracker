/**
 * Refresh bundled seed entries from api.star-citizen.wiki (run manually).
 * Usage: node scripts/build-game-data-seed.js
 */
const fs = require("fs");
const path = require("path");

const API = "https://api.star-citizen.wiki/api";
const CLASS_NAMES = [
  "GLSN_Shiv",
  "none_rifle_multi_01_mag",
  "none_smg_energy_01_mag",
  "ksar_rifle_energy_01_mag",
  "grin_tractor_01",
  "CRUS_Intrepid",
  "ESPR_Prowler_Utility",
];

async function fetchEntry(className) {
  let res = await fetch(
    `${API}/vehicles?filter[class_name]=${encodeURIComponent(className)}`
  );
  if (res.ok) {
    const json = await res.json();
    const d = json.data?.[0];
    if (d?.name) {
      const mfr = d.manufacturer?.name;
      return {
        type: "vehicle",
        name: mfr ? `${mfr} ${d.name}` : d.name,
        displayName: d.name,
        manufacturer: mfr || null,
        className: d.class_name,
        source: "seed",
      };
    }
  }
  res = await fetch(`${API}/search/${encodeURIComponent(className)}`);
  if (res.ok) {
    const json = await res.json();
    const d = json.data;
    if (d?.name) {
      return {
        type: "item",
        name: d.name,
        displayName: d.name,
        className: d.class_name,
        source: "seed",
      };
    }
  }
  return null;
}

async function main() {
  const out = {};
  for (const className of CLASS_NAMES) {
    const entry = await fetchEntry(className);
    if (entry) out[className] = entry;
    await new Promise((r) => setTimeout(r, 1200));
  }
  const target = path.join(__dirname, "..", "data", "game-data-seed.json");
  fs.writeFileSync(target, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`Wrote ${Object.keys(out).length} entries to ${target}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
