/**
 * Bob's Talking NPCs - D&D 5e Item Categories
 * Comprehensive categorization for items based on official D&D 5e types
 */

import { localize } from "../utils/helpers.mjs";

/**
 * Main item categories (official D&D 5e categories)
 */
export const ItemCategory = Object.freeze({
  // Equipment
  WEAPON: "weapon",
  ARMOR: "armor",
  SHIELD: "shield",

  // Magic Items
  WONDROUS_ITEM: "wondrousItem",
  RING: "ring",
  ROD: "rod",
  STAFF: "staff",
  WAND: "wand",

  // Consumables
  POTION: "potion",
  SCROLL: "scroll",
  AMMUNITION: "ammunition",
  POISON: "poison",
  FOOD: "food",

  // Adventuring Gear
  ADVENTURING_GEAR: "adventuringGear",
  TOOL: "tool",
  MOUNT: "mount",
  VEHICLE: "vehicle",

  // Trade Goods & Currency
  TRADE_GOOD: "tradeGood",
  TREASURE: "treasure",
  GEMSTONE: "gemstone",
  ART_OBJECT: "artObject",

  // Other
  CLOTHING: "clothing",
  TRINKET: "trinket",
  MISC: "misc"
});

/**
 * Weapon subcategories
 */
export const WeaponSubcategory = Object.freeze({
  SIMPLE_MELEE: "simpleMelee",
  SIMPLE_RANGED: "simpleRanged",
  MARTIAL_MELEE: "martialMelee",
  MARTIAL_RANGED: "martialRanged",
  FIREARM: "firearm",
  NATURAL: "natural",
  IMPROVISED: "improvised",
  SIEGE: "siege"
});

/**
 * Armor subcategories
 */
export const ArmorSubcategory = Object.freeze({
  LIGHT: "light",
  MEDIUM: "medium",
  HEAVY: "heavy"
});

/**
 * Tool subcategories
 */
export const ToolSubcategory = Object.freeze({
  ARTISAN: "artisan",
  GAMING: "gaming",
  MUSICAL: "musical",
  VEHICLE: "vehicle",
  OTHER: "other"
});

/**
 * Mapping of D&D 5e system weapon types to our subcategories
 */
const WEAPON_TYPE_MAP = {
  simpleM: WeaponSubcategory.SIMPLE_MELEE,
  simpleR: WeaponSubcategory.SIMPLE_RANGED,
  martialM: WeaponSubcategory.MARTIAL_MELEE,
  martialR: WeaponSubcategory.MARTIAL_RANGED,
  natural: WeaponSubcategory.NATURAL,
  improv: WeaponSubcategory.IMPROVISED,
  siege: WeaponSubcategory.SIEGE
};

/**
 * Mapping of D&D 5e system armor types to our categories
 */
const ARMOR_TYPE_MAP = {
  light: { category: ItemCategory.ARMOR, subcategory: ArmorSubcategory.LIGHT },
  medium: { category: ItemCategory.ARMOR, subcategory: ArmorSubcategory.MEDIUM },
  heavy: { category: ItemCategory.ARMOR, subcategory: ArmorSubcategory.HEAVY },
  shield: { category: ItemCategory.SHIELD, subcategory: null },
  trinket: { category: ItemCategory.TRINKET, subcategory: null },
  clothing: { category: ItemCategory.CLOTHING, subcategory: null },
  ring: { category: ItemCategory.RING, subcategory: null },
  wondrous: { category: ItemCategory.WONDROUS_ITEM, subcategory: null }
};

/**
 * Mapping of D&D 5e consumable types
 */
const CONSUMABLE_TYPE_MAP = {
  ammo: ItemCategory.AMMUNITION,
  potion: ItemCategory.POTION,
  poison: ItemCategory.POISON,
  scroll: ItemCategory.SCROLL,
  wand: ItemCategory.WAND,
  rod: ItemCategory.ROD,
  food: ItemCategory.FOOD,
  trinket: ItemCategory.TRINKET
};

/**
 * Categorize an item based on D&D 5e system data
 * @param {Item} item - Foundry Item document
 * @returns {object} { category, subcategory, displayCategory, displaySubcategory }
 */
export function categorizeItem(item) {
  if (!item) {
    return {
      category: ItemCategory.MISC,
      subcategory: null,
      displayCategory: "Miscellaneous",
      displaySubcategory: null
    };
  }

  const system = item.system || {};
  let category = ItemCategory.MISC;
  let subcategory = null;

  switch (item.type) {
    case "weapon":
      category = ItemCategory.WEAPON;
      // Get weapon type from D&D 5e system data
      const weaponType = system.type?.value || system.weaponType;
      // Check for firearms first (properties or name)
      if (system.properties?.fir ||
          weaponType?.includes("firearm") ||
          item.name?.toLowerCase().includes("pistol") ||
          item.name?.toLowerCase().includes("musket") ||
          item.name?.toLowerCase().includes("rifle")) {
        subcategory = WeaponSubcategory.FIREARM;
      } else {
        subcategory = WEAPON_TYPE_MAP[weaponType] || null;
      }
      break;

    case "equipment":
      // Equipment can be armor, shields, rings, wondrous items, etc.
      const armorType = system.armor?.type || system.type?.value;
      if (armorType && ARMOR_TYPE_MAP[armorType]) {
        const mapping = ARMOR_TYPE_MAP[armorType];
        category = mapping.category;
        subcategory = mapping.subcategory;
      } else if (system.armor?.type) {
        // Has armor data but unknown type
        category = ItemCategory.ARMOR;
      } else {
        // Generic equipment - check for specific types
        category = ItemCategory.ADVENTURING_GEAR;
      }
      break;

    case "consumable":
      const consumableType = system.consumableType || system.type?.value;
      category = CONSUMABLE_TYPE_MAP[consumableType] || ItemCategory.MISC;
      break;

    case "tool":
      category = ItemCategory.TOOL;
      const toolType = system.toolType || system.type?.value;
      if (toolType) {
        if (toolType.includes("art") || ["alchemist", "brewer", "calligrapher", "carpenter",
            "cartographer", "cobbler", "cook", "glassblower", "jeweler", "leatherworker",
            "mason", "painter", "potter", "smith", "tinker", "weaver", "woodcarver"].includes(toolType)) {
          subcategory = ToolSubcategory.ARTISAN;
        } else if (["card", "chess", "dice", "dragonchess", "playingCard", "threedragon"].some(g => toolType.includes(g))) {
          subcategory = ToolSubcategory.GAMING;
        } else if (["bagpipes", "drum", "dulcimer", "flute", "horn", "lute", "lyre",
                    "panflute", "shawm", "viol"].includes(toolType)) {
          subcategory = ToolSubcategory.MUSICAL;
        } else if (["vehicles", "water", "land", "air"].some(v => toolType.includes(v))) {
          subcategory = ToolSubcategory.VEHICLE;
        } else {
          subcategory = ToolSubcategory.OTHER;
        }
      }
      break;

    case "loot":
      // Loot can be treasure, gems, art objects, or trade goods
      const lootType = system.type?.value || "";
      if (lootType.includes("gem") || item.name?.toLowerCase().includes("gem")) {
        category = ItemCategory.GEMSTONE;
      } else if (lootType.includes("art") || item.name?.toLowerCase().includes("painting") ||
                 item.name?.toLowerCase().includes("statue") || item.name?.toLowerCase().includes("tapestry")) {
        category = ItemCategory.ART_OBJECT;
      } else if (system.price?.value > 100) {
        category = ItemCategory.TREASURE;
      } else {
        category = ItemCategory.TRADE_GOOD;
      }
      break;

    case "container":
      category = ItemCategory.ADVENTURING_GEAR;
      break;

    default:
      category = ItemCategory.MISC;
  }

  return {
    category,
    subcategory,
    displayCategory: getCategoryLabel(category),
    displaySubcategory: subcategory ? getSubcategoryLabel(category, subcategory) : null
  };
}

/**
 * Get display label for a category
 * @param {string} category - Category ID
 * @returns {string}
 */
export function getCategoryLabel(category) {
  // Try localization first, fallback to hardcoded labels
  const localizedLabel = localize(`ItemCategory.Categories.${category}`);
  if (localizedLabel && !localizedLabel.includes("ItemCategory.Categories.")) {
    return localizedLabel;
  }

  // Fallback labels
  const labels = {
    [ItemCategory.WEAPON]: "Weapons",
    [ItemCategory.ARMOR]: "Armor",
    [ItemCategory.SHIELD]: "Shields",
    [ItemCategory.WONDROUS_ITEM]: "Wondrous Items",
    [ItemCategory.RING]: "Rings",
    [ItemCategory.ROD]: "Rods",
    [ItemCategory.STAFF]: "Staves",
    [ItemCategory.WAND]: "Wands",
    [ItemCategory.POTION]: "Potions",
    [ItemCategory.SCROLL]: "Scrolls",
    [ItemCategory.AMMUNITION]: "Ammunition",
    [ItemCategory.POISON]: "Poisons",
    [ItemCategory.FOOD]: "Food & Drink",
    [ItemCategory.ADVENTURING_GEAR]: "Adventuring Gear",
    [ItemCategory.TOOL]: "Tools",
    [ItemCategory.MOUNT]: "Mounts",
    [ItemCategory.VEHICLE]: "Vehicles",
    [ItemCategory.TRADE_GOOD]: "Trade Goods",
    [ItemCategory.TREASURE]: "Treasure",
    [ItemCategory.GEMSTONE]: "Gemstones",
    [ItemCategory.ART_OBJECT]: "Art Objects",
    [ItemCategory.CLOTHING]: "Clothing",
    [ItemCategory.TRINKET]: "Trinkets",
    [ItemCategory.MISC]: "Miscellaneous"
  };
  return labels[category] || "Miscellaneous";
}

/**
 * Get display label for a subcategory
 * @param {string} category - Parent category ID
 * @param {string} subcategory - Subcategory ID
 * @returns {string}
 */
export function getSubcategoryLabel(category, subcategory) {
  if (!subcategory) return null;

  // Get category key for localization path
  let categoryKey = "Weapon";
  if (category === ItemCategory.ARMOR) categoryKey = "Armor";
  else if (category === ItemCategory.TOOL) categoryKey = "Tool";
  else if (category === ItemCategory.VEHICLE) categoryKey = "Vehicle";

  // Try localization first
  const localizedLabel = localize(`ItemCategory.Subcategories.${categoryKey}.${subcategory}`);
  if (localizedLabel && !localizedLabel.includes("ItemCategory.Subcategories.")) {
    return localizedLabel;
  }

  // Fallback labels
  const labels = {
    // Weapon subcategories
    [WeaponSubcategory.SIMPLE_MELEE]: "Simple Melee",
    [WeaponSubcategory.SIMPLE_RANGED]: "Simple Ranged",
    [WeaponSubcategory.MARTIAL_MELEE]: "Martial Melee",
    [WeaponSubcategory.MARTIAL_RANGED]: "Martial Ranged",
    [WeaponSubcategory.FIREARM]: "Firearms",
    [WeaponSubcategory.NATURAL]: "Natural Weapons",
    [WeaponSubcategory.IMPROVISED]: "Improvised",
    [WeaponSubcategory.SIEGE]: "Siege Weapons",

    // Armor subcategories
    [ArmorSubcategory.LIGHT]: "Light Armor",
    [ArmorSubcategory.MEDIUM]: "Medium Armor",
    [ArmorSubcategory.HEAVY]: "Heavy Armor",

    // Tool subcategories
    [ToolSubcategory.ARTISAN]: "Artisan's Tools",
    [ToolSubcategory.GAMING]: "Gaming Sets",
    [ToolSubcategory.MUSICAL]: "Musical Instruments",
    [ToolSubcategory.VEHICLE]: "Vehicles",
    [ToolSubcategory.OTHER]: "Other Tools"
  };

  return labels[subcategory] || subcategory;
}

/**
 * Get full category display string (category + subcategory)
 * @param {object} itemInfo - Result from categorizeItem()
 * @returns {string}
 */
export function getFullCategoryDisplay(itemInfo) {
  if (itemInfo.displaySubcategory) {
    return `${itemInfo.displayCategory} - ${itemInfo.displaySubcategory}`;
  }
  return itemInfo.displayCategory;
}

/**
 * Get all available categories for filtering
 * @returns {object[]} Array of { id, label, icon }
 */
export function getAllCategories() {
  return [
    { id: "all", label: "All Items", icon: "fa-boxes-stacked" },
    { id: ItemCategory.WEAPON, label: "Weapons", icon: "fa-sword" },
    { id: ItemCategory.ARMOR, label: "Armor", icon: "fa-shield-halved" },
    { id: ItemCategory.SHIELD, label: "Shields", icon: "fa-shield" },
    { id: ItemCategory.WONDROUS_ITEM, label: "Wondrous Items", icon: "fa-wand-sparkles" },
    { id: ItemCategory.RING, label: "Rings", icon: "fa-ring" },
    { id: ItemCategory.ROD, label: "Rods", icon: "fa-wand-magic" },
    { id: ItemCategory.WAND, label: "Wands", icon: "fa-wand-magic-sparkles" },
    { id: ItemCategory.POTION, label: "Potions", icon: "fa-flask" },
    { id: ItemCategory.SCROLL, label: "Scrolls", icon: "fa-scroll" },
    { id: ItemCategory.AMMUNITION, label: "Ammunition", icon: "fa-bullseye-arrow" },
    { id: ItemCategory.ADVENTURING_GEAR, label: "Adventuring Gear", icon: "fa-backpack" },
    { id: ItemCategory.TOOL, label: "Tools", icon: "fa-hammer" },
    { id: ItemCategory.TRADE_GOOD, label: "Trade Goods", icon: "fa-boxes" },
    { id: ItemCategory.TREASURE, label: "Treasure", icon: "fa-gem" },
    { id: ItemCategory.CLOTHING, label: "Clothing", icon: "fa-shirt" },
    { id: ItemCategory.MISC, label: "Miscellaneous", icon: "fa-box" }
  ];
}

/**
 * Get subcategories for a given category
 * @param {string} category - Category ID
 * @returns {object[]} Array of { id, label }
 */
export function getSubcategories(category) {
  switch (category) {
    case ItemCategory.WEAPON:
      return [
        { id: "all", label: "All Weapons" },
        { id: WeaponSubcategory.SIMPLE_MELEE, label: "Simple Melee" },
        { id: WeaponSubcategory.SIMPLE_RANGED, label: "Simple Ranged" },
        { id: WeaponSubcategory.MARTIAL_MELEE, label: "Martial Melee" },
        { id: WeaponSubcategory.MARTIAL_RANGED, label: "Martial Ranged" },
        { id: WeaponSubcategory.FIREARM, label: "Firearms" }
      ];
    case ItemCategory.ARMOR:
      return [
        { id: "all", label: "All Armor" },
        { id: ArmorSubcategory.LIGHT, label: "Light Armor" },
        { id: ArmorSubcategory.MEDIUM, label: "Medium Armor" },
        { id: ArmorSubcategory.HEAVY, label: "Heavy Armor" }
      ];
    case ItemCategory.TOOL:
      return [
        { id: "all", label: "All Tools" },
        { id: ToolSubcategory.ARTISAN, label: "Artisan's Tools" },
        { id: ToolSubcategory.GAMING, label: "Gaming Sets" },
        { id: ToolSubcategory.MUSICAL, label: "Musical Instruments" }
      ];
    default:
      return [];
  }
}

/**
 * Get enchantment type for an item (for filtering enchantments)
 * @param {Item} item - Foundry Item document
 * @returns {string} Enchantment type filter
 */
export function getEnchantmentType(item) {
  const info = categorizeItem(item);

  switch (info.category) {
    case ItemCategory.WEAPON:
      return "weapon";
    case ItemCategory.ARMOR:
      return "armor";
    case ItemCategory.SHIELD:
      return "shield";
    case ItemCategory.RING:
    case ItemCategory.WONDROUS_ITEM:
    case ItemCategory.ROD:
    case ItemCategory.STAFF:
    case ItemCategory.WAND:
      return "wondrous";
    default:
      return "any";
  }
}

/**
 * Check if an item matches a category filter
 * @param {Item} item - Item to check
 * @param {string} categoryFilter - Category to filter by
 * @param {string} subcategoryFilter - Subcategory to filter by (optional)
 * @returns {boolean}
 */
export function matchesCategory(item, categoryFilter, subcategoryFilter = null) {
  if (categoryFilter === "all") return true;

  const info = categorizeItem(item);

  if (info.category !== categoryFilter) return false;

  if (subcategoryFilter && subcategoryFilter !== "all") {
    return info.subcategory === subcategoryFilter;
  }

  return true;
}
