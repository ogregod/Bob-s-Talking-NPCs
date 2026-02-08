/**
 * Bob's Talking NPCs - Enchantment Model
 * Data structure for enchantments that can be applied to items
 */

import { generateId } from "../utils/helpers.mjs";

/**
 * Enchantment item types
 */
export const EnchantmentItemType = Object.freeze({
  WEAPON: "weapon",
  ARMOR: "armor",
  RING: "ring",
  AMULET: "amulet",
  WONDROUS: "wondrous",
  ANY: "any"
});

/**
 * Enchantment rarity levels
 */
export const EnchantmentRarity = Object.freeze({
  COMMON: "common",
  UNCOMMON: "uncommon",
  RARE: "rare",
  VERY_RARE: "veryRare",
  LEGENDARY: "legendary"
});

/**
 * Create a new enchantment
 * @param {object} data - Enchantment data
 * @returns {object}
 */
export function createEnchantment(data) {
  return {
    id: data.id || generateId(),
    name: data.name || "Unknown Enchantment",
    description: data.description || "",
    type: data.type || EnchantmentItemType.ANY,       // What items it can apply to
    rarity: data.rarity || EnchantmentRarity.UNCOMMON,
    baseCost: data.baseCost || 100,                   // Base cost in gold
    effects: data.effects || [],                       // Array of effect descriptions
    requirements: data.requirements || [],             // Prerequisites
    icon: data.icon || "fa-wand-sparkles",
    active: data.active !== false                      // Whether it's available for use
  };
}

/**
 * Calculate enchantment cost based on item rarity
 * @param {object} enchantment - The enchantment
 * @param {string} itemRarity - The item's rarity
 * @param {number} [priceModifier=1] - Shop price modifier
 * @returns {number}
 */
export function calculateEnchantmentCost(enchantment, itemRarity = "common", priceModifier = 1) {
  const rarityMultipliers = {
    common: 1,
    uncommon: 1.5,
    rare: 2,
    veryRare: 3,
    legendary: 5,
    artifact: 10
  };

  const itemMult = rarityMultipliers[itemRarity] || 1;
  return Math.round(enchantment.baseCost * itemMult * priceModifier);
}

/**
 * Check if an enchantment can be applied to an item
 * @param {object} enchantment - The enchantment
 * @param {object} item - The item (Foundry Item document or plain object)
 * @returns {object} { canApply: boolean, reason: string|null }
 */
export function canApplyEnchantment(enchantment, item) {
  // Check item type compatibility
  if (enchantment.type !== EnchantmentItemType.ANY) {
    const itemType = item.type || item.system?.type;

    const typeMapping = {
      weapon: [EnchantmentItemType.WEAPON],
      equipment: [EnchantmentItemType.ARMOR, EnchantmentItemType.RING, EnchantmentItemType.AMULET, EnchantmentItemType.WONDROUS],
      consumable: [],
      tool: [],
      loot: [EnchantmentItemType.WONDROUS]
    };

    const allowedTypes = typeMapping[itemType] || [];
    if (!allowedTypes.includes(enchantment.type)) {
      return {
        canApply: false,
        reason: `This enchantment can only be applied to ${enchantment.type} items`
      };
    }
  }

  return { canApply: true, reason: null };
}

/**
 * Validate an enchantment
 * @param {object} enchantment - Enchantment to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateEnchantment(enchantment) {
  const errors = [];

  if (!enchantment.name || enchantment.name.trim() === "") {
    errors.push("Name is required");
  }

  if (!Object.values(EnchantmentItemType).includes(enchantment.type)) {
    errors.push(`Invalid item type: ${enchantment.type}`);
  }

  if (!Object.values(EnchantmentRarity).includes(enchantment.rarity)) {
    errors.push(`Invalid rarity: ${enchantment.rarity}`);
  }

  if (typeof enchantment.baseCost !== "number" || enchantment.baseCost < 0) {
    errors.push("Base cost must be a non-negative number");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Default enchantments to seed the master list
 */
export const DEFAULT_ENCHANTMENTS = [
  // Weapon Enchantments
  {
    id: "flaming",
    name: "Flaming",
    description: "The weapon is imbued with fire magic, dealing additional fire damage on each hit.",
    type: EnchantmentItemType.WEAPON,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 500,
    effects: ["+1d6 fire damage on hit"],
    icon: "fa-fire"
  },
  {
    id: "frost",
    name: "Frost",
    description: "The weapon is imbued with ice magic, dealing additional cold damage on each hit.",
    type: EnchantmentItemType.WEAPON,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 500,
    effects: ["+1d6 cold damage on hit"],
    icon: "fa-snowflake"
  },
  {
    id: "shock",
    name: "Shock",
    description: "The weapon crackles with electrical energy, dealing lightning damage on each hit.",
    type: EnchantmentItemType.WEAPON,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 500,
    effects: ["+1d6 lightning damage on hit"],
    icon: "fa-bolt"
  },
  {
    id: "keen",
    name: "Keen Edge",
    description: "The weapon's edge is supernaturally sharp, increasing critical hit chance.",
    type: EnchantmentItemType.WEAPON,
    rarity: EnchantmentRarity.RARE,
    baseCost: 1000,
    effects: ["Critical hit range increased by 1 (19-20)"],
    icon: "fa-crosshairs"
  },
  {
    id: "vorpal",
    name: "Vorpal",
    description: "A legendary enchantment that can decapitate enemies on a critical hit.",
    type: EnchantmentItemType.WEAPON,
    rarity: EnchantmentRarity.LEGENDARY,
    baseCost: 10000,
    effects: ["On a natural 20, target must make DC 15 CON save or be decapitated"],
    icon: "fa-skull"
  },

  // Armor Enchantments
  {
    id: "fortification",
    name: "Fortification",
    description: "The armor is reinforced with magical protection, providing resistance to critical hits.",
    type: EnchantmentItemType.ARMOR,
    rarity: EnchantmentRarity.RARE,
    baseCost: 1500,
    effects: ["25% chance to negate critical hit damage"],
    icon: "fa-shield-halved"
  },
  {
    id: "shadow",
    name: "Shadow",
    description: "The armor is infused with shadow magic, making the wearer harder to detect.",
    type: EnchantmentItemType.ARMOR,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 750,
    effects: ["+2 bonus to Stealth checks"],
    icon: "fa-moon"
  },
  {
    id: "fire-resistance",
    name: "Fire Resistance",
    description: "The armor provides protection against fire damage.",
    type: EnchantmentItemType.ARMOR,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 600,
    effects: ["Resistance to fire damage"],
    icon: "fa-fire-flame-curved"
  },
  {
    id: "cold-resistance",
    name: "Cold Resistance",
    description: "The armor provides protection against cold damage.",
    type: EnchantmentItemType.ARMOR,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 600,
    effects: ["Resistance to cold damage"],
    icon: "fa-temperature-low"
  },

  // Ring/Amulet Enchantments
  {
    id: "protection",
    name: "Protection",
    description: "A ward of magical protection surrounds the wearer.",
    type: EnchantmentItemType.RING,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 500,
    effects: ["+1 to AC"],
    icon: "fa-shield"
  },
  {
    id: "spell-storing",
    name: "Spell Storing",
    description: "The item can store a spell to be released later.",
    type: EnchantmentItemType.RING,
    rarity: EnchantmentRarity.RARE,
    baseCost: 2000,
    effects: ["Can store one spell of 3rd level or lower"],
    icon: "fa-hand-sparkles"
  },
  {
    id: "health",
    name: "Health",
    description: "The amulet bolsters the wearer's vitality.",
    type: EnchantmentItemType.AMULET,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 800,
    effects: ["+5 maximum hit points"],
    icon: "fa-heart"
  },

  // Wondrous Item Enchantments
  {
    id: "feather-falling",
    name: "Feather Falling",
    description: "The item allows the wearer to fall slowly and safely.",
    type: EnchantmentItemType.WONDROUS,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 500,
    effects: ["Fall at a rate of 60 feet per round, taking no falling damage"],
    icon: "fa-feather"
  },
  {
    id: "water-breathing",
    name: "Water Breathing",
    description: "The item allows the wearer to breathe underwater.",
    type: EnchantmentItemType.WONDROUS,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 400,
    effects: ["Can breathe underwater"],
    icon: "fa-water"
  },
  {
    id: "darkvision",
    name: "Darkvision",
    description: "The item grants the ability to see in darkness.",
    type: EnchantmentItemType.WONDROUS,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 500,
    effects: ["Darkvision 60 feet"],
    icon: "fa-eye"
  }
];
