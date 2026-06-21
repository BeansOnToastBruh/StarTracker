/** Format AttachmentReceived ports and class names for loadout display. */

const COSMETIC_PORTS =
  /^(Head_|Hair_|Eyebrow_|Eyelash|Eyedetail|Eyes_|Teeth_|Lens_|Universal_Scalp|helmet_visor|mobiglas|legacy_mobiglas|FP_Visor|radar$|universal_necksock)/i;

const PORT_CATEGORY = [
  [/^(Armor_|Body_ItemPort|backpack)/i, "armor"],
  [/^(wep_|magazine_)/i, "weapon"],
  [/^(medPen|oxyPen)/i, "medical"],
  [/^(utility_|module_)/i, "utility"],
  [/^(consumable)/i, "consumable"],
];

function portCategory(port) {
  const p = String(port || "");
  if (COSMETIC_PORTS.test(p)) return "cosmetic";
  for (const [re, cat] of PORT_CATEGORY) {
    if (re.test(p)) return cat;
  }
  return "gear";
}

function titleCaseWords(s) {
  return String(s || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (w.length <= 4 && w === w.toUpperCase()) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

function formatPortLabel(port) {
  const p = String(port || "").trim();
  if (!p) return "Unknown slot";
  const cleaned = p
    .replace(/^Armor_/i, "")
    .replace(/^wep_/i, "Weapon ")
    .replace(/^magazine_/i, "Magazine ")
    .replace(/_/g, " ")
    .replace(/\battach\b/i, "")
    .trim();
  return titleCaseWords(cleaned) || "Unknown slot";
}

function isCosmeticPort(port) {
  return portCategory(port) === "cosmetic";
}

module.exports = {
  portCategory,
  formatPortLabel,
  isCosmeticPort,
  COSMETIC_PORTS,
};
