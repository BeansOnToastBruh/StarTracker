/** Normalize star-citizen.wiki combat fields into display-friendly profiles. */

function roundNum(n, digits = 1) {
  if (n == null || Number.isNaN(Number(n))) return null;
  const v = Number(n);
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString();
  return Number(v.toFixed(digits));
}

function pctFromMultiplier(m) {
  if (m == null) return null;
  const v = Number(m);
  if (Number.isNaN(v)) return null;
  if (v <= 1) return `${Math.round((1 - v) * 100)}% DR`;
  return `${Math.round((v - 1) * 100)}% weak`;
}

const ARMOR_DAMAGE_RESISTANCE = [
  { key: "physical", label: "Physical DR", title: "Physical damage reduction" },
  { key: "energy", label: "Energy DR", title: "Energy damage reduction" },
  { key: "distortion", label: "Distortion DR", title: "Distortion damage reduction" },
];

function normalizeVehicleArmor(armorRaw) {
  if (!armorRaw || typeof armorRaw !== "object" || Array.isArray(armorRaw)) return {};
  return armorRaw;
}

function armorDamageMultiplier(armor, type) {
  const mult = armor.damage_multiplier || armor.damage_multipliers || {};
  if (mult[type] != null) return mult[type];
  const flatKey = `damage_${type}`;
  if (armor[flatKey] != null) return armor[flatKey];
  return null;
}

function armorDamageResistanceRows(armorRaw) {
  const armor = normalizeVehicleArmor(armorRaw);
  return ARMOR_DAMAGE_RESISTANCE.map(({ key, label, title }) => {
    const mult = armorDamageMultiplier(armor, key);
    if (mult == null || Number(mult) === 1) return null;
    return { label, title, value: pctFromMultiplier(mult) };
  }).filter(Boolean);
}

function descriptionMap(descriptionData) {
  const map = {};
  for (const row of descriptionData || []) {
    const name = String(row?.name || "").trim();
    if (!name) continue;
    map[name.toLowerCase()] = row.value ?? row.type ?? null;
  }
  return map;
}

function damageTypeRows(damageObj) {
  if (!damageObj || typeof damageObj !== "object") return [];
  const alpha = damageObj.alpha || damageObj.dps || damageObj;
  const rows = [];
  for (const [type, val] of Object.entries(alpha)) {
    if (type === "total" || val == null || Number(val) === 0) continue;
    rows.push({ type, value: roundNum(val) });
  }
  return rows;
}

function formatPersonalWeapon(pw) {
  if (!pw) return null;
  const dmg = pw.damage || {};
  const stats = [];
  if (dmg.dps_total != null) stats.push({ label: "DPS", value: roundNum(dmg.dps_total), highlight: true });
  if (dmg.alpha_total != null) stats.push({ label: "Alpha", value: roundNum(dmg.alpha_total), highlight: true });
  if (pw.damage_per_shot != null) stats.push({ label: "Damage / shot", value: roundNum(pw.damage_per_shot) });
  if (pw.rpm != null) stats.push({ label: "Rate of fire", value: `${roundNum(pw.rpm, 0)} rpm` });
  if (pw.magazine_size != null) stats.push({ label: "Magazine", value: String(pw.magazine_size) });
  if (pw.effective_range != null) stats.push({ label: "Range", value: `${roundNum(pw.effective_range, 0)} m` });
  if (pw.class) stats.push({ label: "Class", value: pw.class });
  if (pw.type) stats.push({ label: "Type", value: pw.type });
  return {
    kind: "fps_weapon",
    stats,
    damageTypes: damageTypeRows(dmg),
    modes: (pw.modes || []).map((m) => m.mode || m.localised).filter(Boolean),
  };
}

function formatVehicleWeapon(vw) {
  if (!vw) return null;
  const dmg = vw.damage || {};
  const dpsTotal =
    dmg.dps_total ??
    dmg.burst ??
    dmg.sustained_60s ??
    (typeof dmg.maximum === "number" ? dmg.maximum : null);
  const stats = [];
  if (dpsTotal != null) stats.push({ label: "DPS", value: roundNum(dpsTotal), highlight: true });
  if (dmg.alpha_total != null) stats.push({ label: "Alpha", value: roundNum(dmg.alpha_total), highlight: true });
  if (vw.damage_per_shot != null) stats.push({ label: "Damage / shot", value: roundNum(vw.damage_per_shot) });
  if (vw.rpm != null) stats.push({ label: "Rate of fire", value: `${roundNum(vw.rpm, 0)} rpm` });
  if (vw.range != null) stats.push({ label: "Range", value: `${roundNum(vw.range, 0)} m` });
  if (vw.heat?.max != null) stats.push({ label: "Heat capacity", value: roundNum(vw.heat.max, 0) });
  if (vw.class) stats.push({ label: "Class", value: vw.class });
  if (vw.type) stats.push({ label: "Type", value: vw.type });
  return {
    kind: "ship_weapon",
    stats,
    damageTypes: damageTypeRows(dmg),
    modes: (vw.modes || []).map((m) => m.mode || m.localised).filter(Boolean),
  };
}

function formatShield(sh) {
  if (!sh) return null;
  const stats = [];
  if (sh.max_shield_health != null) stats.push({ label: "Shield pool", value: roundNum(sh.max_shield_health, 0), highlight: true });
  if (sh.max_health != null && sh.max_shield_health == null) stats.push({ label: "Shield pool", value: roundNum(sh.max_health, 0), highlight: true });
  if (sh.regen_rate != null) stats.push({ label: "Regen rate", value: `${roundNum(sh.regen_rate, 0)}/s` });
  if (sh.max_shield_regen != null) stats.push({ label: "Max regen", value: `${roundNum(sh.max_shield_regen, 0)}/s` });
  if (sh.regen_delay != null) stats.push({ label: "Regen delay", value: `${roundNum(sh.regen_delay, 1)} s` });
  if (sh.regen_time != null) stats.push({ label: "Regen time", value: `${roundNum(sh.regen_time, 1)} s` });
  return { kind: "shield", stats, damageTypes: [] };
}

function formatPowerPlant(pp) {
  if (!pp) return null;
  const stats = [];
  const output = pp.power_output ?? pp.power_segment_generation;
  if (output != null) stats.push({ label: "Power output", value: roundNum(output, 0), highlight: true });
  if (pp.energy_generation != null) stats.push({ label: "Energy generation", value: roundNum(pp.energy_generation, 0) });
  return { kind: "power_plant", stats, damageTypes: [] };
}

function formatCooler(cl) {
  if (!cl) return null;
  const stats = [];
  if (cl.cooling_rate != null) stats.push({ label: "Cooling rate", value: roundNum(cl.cooling_rate, 0), highlight: true });
  if (cl.health != null) stats.push({ label: "HP", value: roundNum(cl.health, 0) });
  return { kind: "cooler", stats, damageTypes: [] };
}

function formatArmorFromDescription(descriptionData) {
  const map = descriptionMap(descriptionData);
  const stats = [];
  if (map["damage reduction"]) stats.push({ label: "Damage reduction", value: map["damage reduction"], highlight: true });
  if (map["carrying capacity"]) stats.push({ label: "Capacity", value: map["carrying capacity"] });
  if (map["radiation protection"]) stats.push({ label: "Radiation protection", value: map["radiation protection"] });
  if (map["radiation scrub rate"]) stats.push({ label: "Rad scrub", value: map["radiation scrub rate"] });
  if (map["temp. rating"] || map["temp rating"]) stats.push({ label: "Temp rating", value: map["temp. rating"] || map["temp rating"] });
  if (map["item type"]) stats.push({ label: "Type", value: map["item type"] });
  const armorSignals = ["damage reduction", "carrying capacity", "radiation protection"];
  const looksLikeArmor = armorSignals.some((k) => map[k]);
  if (!stats.length || !looksLikeArmor) return null;
  return { kind: "armor", stats, damageTypes: [] };
}

function formatVehicle(data) {
  if (!data) return null;

  const sections = [];
  const pushSection = (id, title, stats) => {
    const filtered = stats.filter((s) => s && s.value != null);
    if (filtered.length) sections.push({ id, title, stats: filtered });
  };

  const healthRaw = data.health;
  const health = typeof healthRaw === "object" && healthRaw ? healthRaw : {};
  const hullHp =
    typeof healthRaw === "number"
      ? healthRaw
      : health.hull_hp ?? health.hull ?? data.hull_hp;
  const shieldHp = data.shield_hp ?? data.shield?.hp;
  const shield = data.shield || {};
  const armor = normalizeVehicleArmor(data.armor);

  pushSection("durability", "Durability", [
    hullHp != null ? { label: "Hull HP", value: roundNum(hullHp, 0), highlight: true } : null,
    shieldHp != null ? { label: "Shield HP", value: roundNum(shieldHp, 0), highlight: true } : null,
    shield.regeneration != null
      ? { label: "Shield regen", value: `${roundNum(shield.regeneration, 0)}/s` }
      : null,
    shield.face_type ? { label: "Shield face", value: shield.face_type } : null,
    armor.health != null ? { label: "Armor HP", value: roundNum(armor.health, 0) } : null,
    ...armorDamageResistanceRows(armor),
  ]);

  const speed = data.speed || {};
  pushSection("flight", "Flight performance", [
    speed.scm != null ? { label: "SCM speed", value: `${roundNum(speed.scm, 0)} m/s`, highlight: true } : null,
    speed.max != null ? { label: "Max speed", value: `${roundNum(speed.max, 0)} m/s` } : null,
    speed.boost_forward != null ? { label: "Boost forward", value: `${roundNum(speed.boost_forward, 0)} m/s` } : null,
    speed.zero_to_scm != null ? { label: "0 to SCM", value: `${roundNum(speed.zero_to_scm, 1)} s` } : null,
    speed.zero_to_max != null ? { label: "0 to max", value: `${roundNum(speed.zero_to_max, 1)} s` } : null,
    speed.scm_to_zero != null ? { label: "SCM to stop", value: `${roundNum(speed.scm_to_zero, 0)} m` } : null,
    data.mass != null ? { label: "Mass", value: `${roundNum(data.mass, 0)} kg` } : null,
    data.cargo_capacity != null ? { label: "Cargo", value: `${data.cargo_capacity} SCU` } : null,
  ]);

  const fuel = data.fuel || {};
  const fuelUsage = fuel.usage || {};
  pushSection("fuel", "Fuel and hydrogen", [
    fuel.capacity != null ? { label: "H2 capacity", value: `${roundNum(fuel.capacity, 1)}`, highlight: true } : null,
    fuel.intake_rate != null && fuel.intake_rate > 0
      ? { label: "Intake rate", value: `${roundNum(fuel.intake_rate, 2)}` }
      : null,
    fuelUsage.main != null ? { label: "Usage (main)", value: roundNum(fuelUsage.main, 2) } : null,
    fuelUsage.maneuvering != null ? { label: "Usage (maneuver)", value: roundNum(fuelUsage.maneuvering, 2) } : null,
    fuelUsage.retro != null ? { label: "Usage (retro)", value: roundNum(fuelUsage.retro, 2) } : null,
  ]);

  const qt = data.quantum || {};
  pushSection("quantum", "Quantum travel", [
    qt.quantum_fuel_capacity != null
      ? { label: "QT fuel capacity", value: roundNum(qt.quantum_fuel_capacity, 2), highlight: true }
      : null,
    qt.quantum_spool_time != null ? { label: "Spool time", value: `${roundNum(qt.quantum_spool_time, 1)} s` } : null,
    qt.quantum_range != null ? { label: "QT range", value: roundNum(qt.quantum_range, 0) } : null,
    qt.port_olisar_to_arccorp_time != null
      ? {
          label: "Oli → ArcCorp time",
          title: "Port Olisar to ArcCorp travel time",
          value: `${roundNum(qt.port_olisar_to_arccorp_time, 0)} s`,
        }
      : null,
    qt.port_olisar_to_arccorp_fuel != null
      ? {
          label: "Oli → ArcCorp fuel",
          title: "Port Olisar to ArcCorp quantum fuel",
          value: roundNum(qt.port_olisar_to_arccorp_fuel, 0),
        }
      : null,
  ]);

  const power = data.power || {};
  pushSection("power", "Power grid", [
    power.generation_segments != null
      ? { label: "Generation segments", value: roundNum(power.generation_segments, 0), highlight: true }
      : null,
    power.used_segments_shields != null
      ? { label: "Draw (shields)", value: roundNum(power.used_segments_shields, 1) }
      : null,
    power.used_segments_quantum != null
      ? { label: "Draw (quantum)", value: roundNum(power.used_segments_quantum, 1) }
      : null,
  ]);

  const cooling = data.cooling || {};
  pushSection("cooling", "Cooling", [
    cooling.generation_segments != null
      ? { label: "Cooling segments", value: roundNum(cooling.generation_segments, 0), highlight: true }
      : null,
    cooling.usage_shields_pct != null
      ? { label: "Load at shields (%)", value: `${Math.round(Number(cooling.usage_shields_pct) * 100)}%` }
      : null,
    cooling.usage_quantum_pct != null
      ? { label: "Load at quantum (%)", value: `${Math.round(Number(cooling.usage_quantum_pct) * 100)}%` }
      : null,
    cooling.used_segments_shields != null
      ? { label: "Used (shields)", value: roundNum(cooling.used_segments_shields, 1) }
      : null,
  ]);

  const sig = data.signature || data.emission || {};
  pushSection("signatures", "Signatures (IR / EM)", [
    sig.ir_shields != null ? { label: "IR (shields up)", value: roundNum(sig.ir_shields, 0) } : null,
    sig.ir_quantum != null ? { label: "IR (quantum)", value: roundNum(sig.ir_quantum, 0) } : null,
    sig.em_shields != null ? { label: "EM (shields up)", value: roundNum(sig.em_shields, 0) } : null,
    sig.em_quantum != null ? { label: "EM (quantum)", value: roundNum(sig.em_quantum, 0) } : null,
    data.emission?.ir != null ? { label: "IR (legacy)", value: roundNum(data.emission.ir, 0) } : null,
    data.emission?.em != null ? { label: "EM (legacy)", value: roundNum(data.emission.em, 0) } : null,
  ]);

  const stats = sections.flatMap((s) => s.stats);
  return {
    kind: "vehicle",
    stats,
    sections,
    damageTypes: [],
    className: data.class_name || null,
    slug: data.slug || null,
    performanceSource: "star-citizen.wiki datamine",
  };
}

function formatWikiItem(data) {
  if (!data) return null;
  if (data.personal_weapon) return formatPersonalWeapon(data.personal_weapon);
  if (data.vehicle_weapon) return formatVehicleWeapon(data.vehicle_weapon);
  if (data.shield) return formatShield(data.shield);
  if (data.power_plant) return formatPowerPlant(data.power_plant);
  if (data.cooler) return formatCooler(data.cooler);
  const desc = formatArmorFromDescription(data.description_data);
  if (desc) return desc;
  return null;
}

function combatHeadline(profile) {
  if (!profile?.stats?.length) return null;
  const hi = profile.stats.find((s) => s.highlight) || profile.stats[0];
  return hi ? `${hi.label}: ${hi.value}` : null;
}

module.exports = {
  formatWikiItem,
  formatVehicle,
  combatHeadline,
  descriptionMap,
};
