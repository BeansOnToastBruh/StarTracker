const assert = require("assert");
const {
  init,
  modifierAtQuality,
  defaultQualityForModifier,
  parseBaseStats,
  computeCraftPreview,
} = require("../electron/craftingIntel");

init({ cacheDir: null });

const sampleModifier = {
  property_key: "armor_damagemitigation",
  label: "Damage Mitigation",
  better_when: "higher",
  quality_range: { min: 0, max: 1000 },
  modifier_range: { at_min_quality: 0.85, at_max_quality: 1.15 },
};

assert.strictEqual(defaultQualityForModifier(sampleModifier), 500);
assert.strictEqual(modifierAtQuality(sampleModifier, 500), 1);
assert.strictEqual(modifierAtQuality(sampleModifier, 0), 0.85);
assert.strictEqual(modifierAtQuality(sampleModifier, 1000), 1.15);

const stats = parseBaseStats([
  { name: "Damage Reduction", value: "40%" },
  { name: "Temp. Rating", value: "-75 / 105 °C" },
]);
assert.strictEqual(stats.armor_damagemitigation, 0.4);
assert.strictEqual(stats.armor_temperaturemin, -75);
assert.strictEqual(stats.armor_temperaturemax, 105);

const blueprint = {
  summary_properties: [
    { property_key: "armor_damagemitigation", label: "Damage Mitigation", better_when: "higher" },
  ],
  requirement_groups: [
    {
      key: "ARM",
      name: "Armored Carapace",
      modifiers: [sampleModifier],
      children: [
        {
          kind: "resource",
          uuid: "ore-1",
          name: "Ouratite",
          quantity_scu: 0.07,
        },
      ],
    },
  ],
};

const preview = computeCraftPreview(blueprint, stats, { "ore-1": 1000 });
assert.strictEqual(preview.stats[0].projectedFormatted, "46.0%");
assert.strictEqual(preview.stats[0].baselineFormatted, "40.0%");

console.log("test-crafting-intel: OK");
