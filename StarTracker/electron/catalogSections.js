/** Catalog sections synced from UEX + Star Citizen Wiki. */
const UEX_BASE = "https://api.uexcorp.space/2.0";
const WIKI_BASE = "https://api.star-citizen.wiki/api";

/** UEX item category IDs grouped for UI tabs. */
const UEX_CATEGORY_GROUPS = {
  armor: {
    label: "Armor",
    tab: "catalog-armor",
    categoryIds: [1, 2, 3, 4, 5, 7, 24],
  },
  fps_weapons: {
    label: "FPS weapons",
    tab: "catalog-weapons",
    categoryIds: [17, 18],
  },
  ship_weapons: {
    label: "Ship weapons",
    tab: "catalog-ship-weapons",
    categoryIds: [32, 33, 34, 35, 70, 79, 90],
  },
  ship_components: {
    label: "Ship components",
    tab: "catalog-ship-parts",
    categoryIds: [19, 21, 22, 23, 82, 83, 86],
  },
  ship_utility: {
    label: "Ship utility",
    tab: "catalog-ship-parts",
    categoryIds: [25, 26, 28, 29, 30, 31, 67, 109, 110],
  },
};

/** Star Citizen Wiki item type filters (class names + shop data). */
const WIKI_ITEM_GROUPS = {
  fps_weapons: {
    label: "FPS weapons",
    tab: "catalog-weapons",
    types: ["WeaponPersonal", "WeaponAttachment"],
  },
  armor: {
    label: "Armor",
    tab: "catalog-armor",
    types: [
      "Armor",
      "Char_Armor_Helmet",
      "Char_Armor_Torso",
      "Char_Armor_Arms",
      "Char_Armor_Legs",
      "Char_Armor_Backpack",
      "Char_Armor_Undersuit",
    ],
  },
  ship_weapons: {
    label: "Ship weapons",
    tab: "catalog-ship-weapons",
    types: [
      "WeaponGun",
      "MissileLauncher",
      "Missile",
      "Turret",
      "TurretBase",
      "WeaponDefensive",
      "GroundVehicleMissileLauncher",
    ],
  },
  ship_components: {
    label: "Ship components",
    tab: "catalog-ship-parts",
    types: [
      "PowerPlant",
      "Cooler",
      "Shield",
      "QuantumDrive",
      "ShieldController",
      "WeaponController",
    ],
  },
};

const ALL_UEX_CATEGORY_IDS = [
  ...new Set(
    Object.values(UEX_CATEGORY_GROUPS).flatMap((g) => g.categoryIds)
  ),
];

function formatLocation(row) {
  const parts = [
    row.city_name,
    row.moon_name,
    row.planet_name,
    row.space_station_name,
    row.outpost_name,
    row.orbit_name,
  ].filter(Boolean);
  const unique = [...new Set(parts.map((p) => String(p).trim()).filter(Boolean))];
  return unique.join(", ") || row.terminal_name || "Unknown";
}

function compactListingFromUexPrice(row) {
  return {
    terminalId: row.id_terminal,
    terminal: row.terminal_name || null,
    terminalCode: row.terminal_code || null,
    location: formatLocation(row),
    system: row.star_system_name || null,
    priceBuy: row.price_buy > 0 ? row.price_buy : null,
    priceSell: row.price_sell > 0 ? row.price_sell : null,
    gameVersion: row.game_version || null,
  };
}

function compactListingFromWikiUex(entry) {
  const loc = entry.starmap_location || {};
  const locationParts = [
    loc.name,
    loc.parent_name,
    loc.star_system_name,
  ].filter(Boolean);
  return {
    terminalId: entry.terminal_id || null,
    terminal: entry.terminal_name || null,
    terminalCode: entry.terminal_code || null,
    location: locationParts.join(", ") || entry.terminal_name || null,
    system: loc.star_system_name || null,
    priceBuy: entry.price_buy > 0 ? entry.price_buy : null,
    priceSell: entry.price_sell > 0 ? entry.price_sell : null,
    priceRent: entry.price_rent > 0 ? entry.price_rent : null,
    gameVersion: entry.game_version || null,
    uexLink: entry.uex_link || null,
  };
}

function compactUexItem(row) {
  return {
    source: "uex",
    uexId: row.id,
    uuid: row.uuid || null,
    name: row.name,
    section: row.section || null,
    category: row.category || null,
    manufacturer: row.company_name || null,
    slug: row.slug || null,
    className: null,
    gameVersion: row.game_version || null,
  };
}

function compactWikiItem(row) {
  const purchase = (row.uex_prices?.purchase || []).map(compactListingFromWikiUex);
  const rental = (row.uex_prices?.rental || []).map(compactListingFromWikiUex);
  return {
    source: "wiki",
    uuid: row.uuid || null,
    name: row.game_name || row.name,
    displayName: row.name || null,
    section: row.classification_label || row.classification || null,
    category: row.type || null,
    manufacturer: row.manufacturer?.name || null,
    slug: row.slug || null,
    className: row.class_name || null,
    size: row.size || null,
    listings: [...purchase, ...rental],
  };
}

function compactWikiVehicle(row) {
  const purchase = (row.uex_prices?.purchase || []).map(compactListingFromWikiUex);
  const rental = (row.uex_prices?.rental || []).map(compactListingFromWikiUex);
  return {
    source: "wiki",
    uuid: row.uuid || null,
    name: row.game_name || row.name,
    displayName: row.name || null,
    section: "Ships",
    category: row.role || row.type || "Vehicle",
    manufacturer: row.manufacturer?.name || null,
    slug: row.slug || null,
    className: row.class_name || null,
    cargo: row.cargo_capacity ?? null,
    crew: row.crew?.max ?? row.crew?.min ?? null,
    size: row.size || null,
    listings: [...purchase, ...rental],
  };
}

function compactTerminal(row) {
  return {
    id: row.id,
    name: row.name,
    fullname: row.fullname || row.name,
    code: row.code || null,
    type: row.type || null,
    location: formatLocation(row),
    system: row.star_system_name || null,
    displayName: row.displayname || null,
    planet: row.planet_name || null,
    moon: row.moon_name || null,
    station: row.space_station_name || null,
    city: row.city_name || null,
    outpost: row.outpost_name || null,
    orbit: row.orbit_name || null,
    services: {
      refuel: Boolean(row.is_refuel),
      repair: Boolean(row.is_repair),
      restock: Boolean(row.is_shop_fps),
      vehicleShop: Boolean(row.is_shop_vehicle),
      food: Boolean(row.is_food),
      medical: Boolean(row.is_medical),
      refinery: Boolean(row.is_refinery),
      cargo: Boolean(row.is_cargo_center),
      fuel: row.type === "fuel",
    },
    isShopFps: Boolean(row.is_shop_fps),
    isShopVehicle: Boolean(row.is_shop_vehicle),
  };
}

function placeLabelFromTerminal(row) {
  return (
    row.displayName ||
    row.city ||
    row.station ||
    row.moon ||
    row.outpost ||
    row.orbit ||
    row.planet ||
    row.name ||
    "Unknown"
  );
}

function placeKindFromTerminal(row) {
  if (row.city) return "City";
  if (row.station) return "Station";
  if (row.moon) return "Moon";
  if (row.outpost) return "Outpost";
  if (row.orbit && !row.planet) return "Orbit";
  if (row.type === "fuel") return "Fuel depot";
  return "Location";
}

function mergeServiceFlags(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (value) target[key] = true;
  }
}

function normalizeTerminal(terminal) {
  if (!terminal) return terminal;
  if (terminal.services) return terminal;
  return {
    ...terminal,
    services: {
      refuel: false,
      repair: false,
      restock: Boolean(terminal.isShopFps),
      vehicleShop: Boolean(terminal.isShopVehicle),
      food: false,
      medical: false,
      refinery: false,
      cargo: false,
      fuel: terminal.type === "fuel",
    },
  };
}

function buildPlacesFromTerminals(terminals) {
  const byKey = new Map();
  for (const terminal of (terminals || []).map(normalizeTerminal)) {
    const placeName = placeLabelFromTerminal(terminal);
    const key = [
      terminal.system || "unknown",
      placeName,
      terminal.planet || "",
      terminal.moon || "",
    ].join("|");

    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        name: placeName,
        system: terminal.system || null,
        planet: terminal.planet || null,
        moon: terminal.moon || null,
        station: terminal.station || null,
        city: terminal.city || null,
        outpost: terminal.outpost || null,
        orbit: terminal.orbit || null,
        kind: placeKindFromTerminal(terminal),
        location: terminal.location || placeName,
        services: {
          refuel: false,
          repair: false,
          restock: false,
          vehicleShop: false,
          food: false,
          medical: false,
          refinery: false,
          cargo: false,
          fuel: false,
        },
        terminals: [],
      });
    }

    const place = byKey.get(key);
    mergeServiceFlags(place.services, terminal.services);
    place.terminals.push({
      id: terminal.id,
      name: terminal.name,
      code: terminal.code,
      type: terminal.type,
      services: terminal.services,
    });
  }

  return [...byKey.values()]
    .filter((place) =>
      Object.values(place.services).some(Boolean)
    )
    .sort((a, b) =>
      `${a.system} ${a.name}`.localeCompare(`${b.system} ${b.name}`)
    );
}

module.exports = {
  UEX_BASE,
  WIKI_BASE,
  UEX_CATEGORY_GROUPS,
  WIKI_ITEM_GROUPS,
  ALL_UEX_CATEGORY_IDS,
  compactListingFromUexPrice,
  compactListingFromWikiUex,
  compactUexItem,
  compactWikiItem,
  compactWikiVehicle,
  compactTerminal,
  buildPlacesFromTerminals,
  normalizeTerminal,
  placeLabelFromTerminal,
  formatLocation,
};
