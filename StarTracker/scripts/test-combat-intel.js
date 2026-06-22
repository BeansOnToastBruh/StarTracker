const assert = require("assert");
const {
  formatWikiItem,
  formatVehicle,
  combatHeadline,
} = require("../electron/combatIntelFormat");

const pw = formatWikiItem({
  personal_weapon: {
    class: "Ballistic",
    type: "Rifle",
    damage_per_shot: 42.5,
    rpm: 225,
    magazine_size: 15,
    effective_range: 1600,
    damage: {
      dps_total: 159.4,
      alpha_total: 42.5,
      dps: { physical: 159.4 },
      alpha: { physical: 42.5 },
    },
  },
});
assert.strictEqual(pw.kind, "fps_weapon");
assert.ok(pw.stats.some((s) => s.label === "DPS"));
assert.strictEqual(combatHeadline(pw), "DPS: 159.4");

const armor = formatWikiItem({
  description_data: [
    { name: "Damage Reduction", value: "40%" },
    { name: "Item Type", value: "Heavy Armor" },
  ],
});
assert.strictEqual(armor.kind, "armor");
assert.ok(armor.stats[0].value.includes("40"));

const ship = formatVehicle({
  health: 6110,
  shield_hp: 6336,
  shield: { regeneration: 1204 },
  mass: 48552,
  speed: { scm: 226, max: 1193 },
  fuel: { capacity: 13.5, usage: { main: 29.89 } },
  armor: { damage_multiplier: { physical: 0.75, energy: 0.6 } },
});
assert.ok(ship.stats.some((s) => s.label === "Hull HP"));
assert.ok(ship.stats.some((s) => s.label === "Shield HP"));
const durability = ship.sections?.find((s) => s.id === "durability");
assert.ok(durability?.stats.some((s) => s.label === "Physical DR" && s.value === "25% DR"));
assert.ok(durability?.stats.some((s) => s.label === "Energy DR" && s.value === "40% DR"));
assert.ok(ship.sections?.some((s) => s.id === "fuel"));
assert.ok(ship.sections?.some((s) => s.id === "flight"));

console.log("test-combat-intel: OK");
