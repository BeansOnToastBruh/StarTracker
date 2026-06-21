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

function formatPortLabel(port) {
  const p = String(port || "").trim();
  if (!p) return "Unknown slot";
  return p
    .replace(/^Armor_/i, "")
    .replace(/_/g, " ")
    .replace(/\battach\b/i, "")
    .trim();
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
