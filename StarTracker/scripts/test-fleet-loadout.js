const assert = require("assert");
const {
  compactFleetRow,
  queryFleetCompare,
  buildFleetLookup,
  enrichVehicleRow,
} = require("../electron/fleetCompare");
const {
  collectWeaponGunPorts,
  weaponDpsFromProfile,
} = require("../electron/loadoutBuilder");
const { formatWikiItem } = require("../electron/combatIntelFormat");

const row = compactFleetRow({
  slug: "gladius",
  class_name: "AEGS_Gladius",
  name: "Gladius",
  manufacturer: { name: "Aegis" },
  health: 6110,
  shield_hp: 6336,
  speed: { scm: 226, max: 1193 },
  fuel: { capacity: 13.5 },
  cargo_capacity: 0,
  mass: 48552,
  signature: { ir_shields: 1200, em_shields: 800 },
});
assert.strictEqual(row.slug, "gladius");
assert.strictEqual(row.hullHp, 6110);
assert.strictEqual(row.scm, 226);

const index = {
  fetchedAt: new Date().toISOString(),
  rows: [
    row,
    compactFleetRow({
      slug: "arrow",
      name: "Arrow",
      health: 3000,
      shield_hp: 4000,
      speed: { scm: 240 },
    }),
  ],
};
const sorted = queryFleetCompare({ index, sort: "hull" });
assert.strictEqual(sorted.rows[0].slug, "gladius");

const lookup = buildFleetLookup(index);
const catalogShip = {
  section: "Ships",
  slug: "gladius",
  className: "AEGS_Gladius",
  name: "Gladius",
  cargo: 0,
  listings: [{ terminal: "Area18", priceBuy: 1000000 }],
};
const enriched = enrichVehicleRow(catalogShip, lookup);
assert.strictEqual(enriched.hullHp, 6110);
assert.strictEqual(enriched.shieldHp, 6336);
assert.strictEqual(enriched.listings.length, 1);

const ports = [
  {
    name: "hardpoint_gun_nose",
    type: "Turret",
    ports: [
      {
        name: "hardpoint_class_2",
        type: "WeaponGun",
        sizes: { max: 3 },
        equipped_item: { name: "Test Gun", class_name: "TEST_Gun" },
      },
    ],
  },
];
const slots = collectWeaponGunPorts(ports);
assert.strictEqual(slots.length, 1);
assert.strictEqual(slots[0].stockClassName, "TEST_Gun");

const weaponProfile = formatWikiItem({
  vehicle_weapon: {
    damage: { burst: 500, alpha_total: 40 },
    rpm: 750,
  },
});
const dps = weaponDpsFromProfile(weaponProfile);
assert.strictEqual(dps.dps, 500);

console.log("test-fleet-loadout: OK");
