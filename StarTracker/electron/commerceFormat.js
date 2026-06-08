const MANUFACTURER_LABELS = {
  RSI: "RSI",
  ANVL: "Anvil",
  ORIG: "Origin",
  DRAK: "Drake",
  AEGS: "Aegis",
  MISC: "MISC",
  CRUS: "Crusader",
  CNST: "Consolidated Outland",
  CNOU: "Crusader",
  GLSN: "Gallaban",
  MRAI: "Mirai",
  ARGO: "Argo",
  XIAN: "Xi'an",
  ESPR: "Esperia",
  GAMA: "Gatac",
  KRIG: "Kruger",
  LGMN: "Legionnaire",
  TMBL: "Tumbril",
  AOPA: "Aopoa",
  GRIN: "Greycat",
  KLWE: "Klaus & Werner",
  KSAR: "Kastak Arms",
  BEHR: "Behring",
  GNSS: "Gemini",
  VOLT: "Volt",
};

const ITEM_WORDS = {
  rifle: "Rifle",
  smg: "SMG",
  pistol: "Pistol",
  shotgun: "Shotgun",
  sniper: "Sniper rifle",
  lmg: "LMG",
  energy: "Energy",
  multi: "Multi-caliber",
  ballistic: "Ballistic",
  gree: "Gree",
  mag: "Magazine",
  ammo: "Ammo",
  attachment: "Attachment",
  undersuit: "Undersuit",
  helmet: "Helmet",
  armor: "Armor",
  consumable: "Consumable",
  healing: "Med pen",
};

const SHOP_LABELS = {
  SCShop_Entity_CubbyBlast_Area18: "Cubby Blast (Area18)",
  "SCShop_ConscientiousObjects_Levski-001": "Conscientious Objects (Levski)",
  SCShop_Levski_Dealership_Teachs: "Teach's Ship Shop (Levski)",
  SCShop_Levski_Dealership: "Levski Dealership",
};

const HULL_PREFIX =
  /^(RSI|ANVL|ORIG|DRAK|AEGS|MISC|CRUS|CNST|CNOU|GLSN|MRAI|ARGO|XIAN|ESPR|GAMA|KRIG|LGMN|TMBL|AOPA|GRIN)_/i;

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

function splitInternalName(raw) {
  return String(raw || "")
    .replace(/^none_/, "")
    .split("_")
    .filter(Boolean);
}

function formatVehicleLabel(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/\d+$/g, "")
    .replace(/_\d+$/g, "")
    .trim();
  const parts = cleaned.split("_").filter(Boolean);
  if (!parts.length) return cleaned;
  const mfr = parts[0].toUpperCase();
  if (HULL_PREFIX.test(cleaned)) {
    const label = MANUFACTURER_LABELS[mfr] || parts[0];
    const model = parts.slice(1).join(" ");
    return model ? `${label} ${titleCaseWords(model.replace(/_/g, " "))}` : label;
  }
  return titleCaseWords(cleaned.replace(/_/g, " "));
}

function formatShopItemName(raw, quantity = null) {
  if (!raw) return "Unknown item";
  const name = String(raw).trim();

  if (HULL_PREFIX.test(name) && !/_mag$|_ammo$/i.test(name)) {
    return formatVehicleLabel(name) || name;
  }

  const parts = splitInternalName(name);
  const words = [];
  let i = 0;
  if (parts[i] && MANUFACTURER_LABELS[parts[i].toUpperCase()]) {
    words.push(MANUFACTURER_LABELS[parts[i].toUpperCase()]);
    i += 1;
  } else if (parts[i] && /^[a-z]{3,5}$/i.test(parts[i]) && parts[i] !== "none") {
    words.push(parts[i].toUpperCase());
    i += 1;
  }

  for (; i < parts.length; i += 1) {
    const token = parts[i].toLowerCase();
    if (/^\d+$/.test(token)) continue;
    if (ITEM_WORDS[token]) {
      words.push(ITEM_WORDS[token]);
      continue;
    }
    if (token === "01" || token === "02" || token === "03") continue;
    words.push(token);
  }

  let label = titleCaseWords(words.join(" "));
  if (/_mag$|_ammo$/i.test(name)) {
    if (!/magazine|ammo/i.test(label)) label += " (magazine)";
  }
  if (quantity != null && quantity > 1) {
    label += ` ×${quantity}`;
  }
  return label || titleCaseWords(name.replace(/_/g, " "));
}

function formatShopName(raw) {
  if (!raw) return "Unknown shop";
  const exact = SHOP_LABELS[raw];
  if (exact) return exact;

  let s = String(raw)
    .replace(/^SCShop[_ ]/i, "")
    .replace(/_/g, " ")
    .replace(/-(\d+)\b/g, "")
    .trim();

  s = s
    .replace(/Entity /i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  if (/dealership/i.test(s)) {
    s = s.replace(/dealership/i, "Dealership");
  }
  return titleCaseWords(s) || raw;
}

function formatLocationLabel(raw) {
  if (!raw) return null;
  return String(raw)
    .replace(/^RR_/i, "Rest & Relax ")
    .replace(/^Stanton\d+_/i, "")
    .replace(/_/g, " ")
    .trim();
}

function shopItemCategory(raw, price = 0) {
  const name = String(raw || "");
  if (HULL_PREFIX.test(name) && !/_mag$|_ammo$/i.test(name)) return "ship";
  if (price >= 500000) return "ship";
  if (/_mag$|_ammo$|rifle|smg|pistol|shotgun|lmg|energy_01/i.test(name)) {
    return "equipment";
  }
  return "item";
}

module.exports = {
  formatShopItemName,
  formatShopName,
  formatVehicleLabel,
  formatLocationLabel,
  shopItemCategory,
};
