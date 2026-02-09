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
 * Enchantment fail consequences
 */
export const FailConsequence = Object.freeze({
  NONE: "none",           // Item returned unenchanted
  DESTROYED: "destroyed", // Item is destroyed
  CURSED: "cursed"        // Item becomes cursed
});

/**
 * Activation types for enchantments
 */
export const ActivationType = Object.freeze({
  PASSIVE: "passive",      // Always active when equipped
  ACTION: "action",        // Requires action to activate
  BONUS_ACTION: "bonus",   // Requires bonus action
  REACTION: "reaction",    // Triggered by reaction
  FREE: "free"             // Free action
});

/**
 * Activation cost types
 */
export const ActivationCost = Object.freeze({
  NONE: "none",                   // No cost (passive/at-will)
  CHARGES_DAY: "charges_day",     // X charges per day
  USES_SHORT_REST: "uses_short",  // X uses per short rest
  USES_LONG_REST: "uses_long",    // X uses per long rest
  AT_WILL: "at_will"              // Unlimited uses (but requires activation)
});

/**
 * Duration types
 */
export const DurationType = Object.freeze({
  PERMANENT: "permanent",         // Always active
  CONCENTRATION: "concentration", // Requires concentration
  ROUNDS: "rounds",
  MINUTES: "minutes",
  HOURS: "hours"
});

/**
 * Mechanical effect types for Active Effects
 */
export const MechanicalEffectType = Object.freeze({
  DAMAGE_BONUS: "damage_bonus",      // +Xd6 fire, etc.
  ATTACK_BONUS: "attack_bonus",      // +1, +2, +3
  AC_BONUS: "ac_bonus",
  SAVE_BONUS: "save_bonus",
  ABILITY_BONUS: "ability_bonus",
  RESISTANCE: "resistance",
  IMMUNITY: "immunity",
  SPEED_BONUS: "speed_bonus",
  SKILL_BONUS: "skill_bonus",
  HP_BONUS: "hp_bonus",
  CUSTOM: "custom"
});

/**
 * Damage types for D&D 5e
 */
export const DamageType = Object.freeze({
  FIRE: "fire",
  COLD: "cold",
  LIGHTNING: "lightning",
  THUNDER: "thunder",
  ACID: "acid",
  POISON: "poison",
  NECROTIC: "necrotic",
  RADIANT: "radiant",
  PSYCHIC: "psychic",
  FORCE: "force",
  SLASHING: "slashing",
  PIERCING: "piercing",
  BLUDGEONING: "bludgeoning"
});

/**
 * Recharge types for charges
 */
export const RechargeType = Object.freeze({
  DAWN: "dawn",
  SHORT_REST: "shortRest",
  LONG_REST: "longRest"
});

/**
 * Create a new enchantment
 * @param {object} data - Enchantment data
 * @returns {object}
 */
export function createEnchantment(data) {
  return {
    // Basic info
    id: data.id || generateId(),
    name: data.name || "Unknown Enchantment",
    description: data.description || "",
    type: data.type || EnchantmentItemType.ANY,
    rarity: data.rarity || EnchantmentRarity.UNCOMMON,
    baseCost: data.baseCost || 100,
    effects: data.effects || [],              // Text descriptions for display
    requirements: data.requirements || [],
    icon: data.icon || "fa-wand-sparkles",
    active: data.active !== false,

    // Fail mechanics
    failRate: data.failRate ?? 0,             // 0-100 percentage
    failConsequence: data.failConsequence || FailConsequence.NONE,
    cursedEnchantmentId: data.cursedEnchantmentId || null,

    // Activation configuration
    activationType: data.activationType || ActivationType.PASSIVE,
    activationCost: data.activationCost || ActivationCost.NONE,
    charges: data.charges ?? 0,
    rechargeType: data.rechargeType || RechargeType.DAWN,

    // Duration configuration
    durationType: data.durationType || DurationType.PERMANENT,
    durationValue: data.durationValue ?? 0,

    // Target configuration
    targetType: data.targetType || "self",    // self, touch, ranged
    targetRange: data.targetRange ?? 0,       // Range in feet for ranged

    // Mechanical effects (translated to Active Effects)
    mechanicalEffects: data.mechanicalEffects || [],
    // Each mechanicalEffect: {
    //   type: MechanicalEffectType,
    //   value: number or string,
    //   damageType: DamageType (optional),
    //   diceCount: number (optional for damage),
    //   diceSize: number (optional for damage),
    //   ability: string (optional for ability/save bonuses),
    //   skill: string (optional for skill bonuses),
    //   customKey: string (optional for custom effects),
    //   customMode: number (optional, CONST.ACTIVE_EFFECT_MODES)
    // }

    // Work duration (how long enchanting takes)
    workDurationHours: data.workDurationHours ?? null  // null = use global setting
  };
}

/**
 * Create a mechanical effect object
 * @param {object} data - Effect data
 * @returns {object}
 */
export function createMechanicalEffect(data) {
  return {
    type: data.type || MechanicalEffectType.ATTACK_BONUS,
    value: data.value ?? 0,
    damageType: data.damageType || null,
    diceCount: data.diceCount ?? 0,
    diceSize: data.diceSize ?? 6,
    ability: data.ability || null,      // str, dex, con, int, wis, cha
    skill: data.skill || null,          // acr, ani, arc, ath, dec, his, ins, itm, inv, med, nat, prc, prf, per, rel, slt, ste, sur
    customKey: data.customKey || null,
    customMode: data.customMode ?? 2    // CONST.ACTIVE_EFFECT_MODES.ADD
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
    icon: "fa-fire",
    failRate: 5,
    mechanicalEffects: [
      { type: MechanicalEffectType.DAMAGE_BONUS, diceCount: 1, diceSize: 6, damageType: DamageType.FIRE }
    ]
  },
  {
    id: "frost",
    name: "Frost",
    description: "The weapon is imbued with ice magic, dealing additional cold damage on each hit.",
    type: EnchantmentItemType.WEAPON,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 500,
    effects: ["+1d6 cold damage on hit"],
    icon: "fa-snowflake",
    failRate: 5,
    mechanicalEffects: [
      { type: MechanicalEffectType.DAMAGE_BONUS, diceCount: 1, diceSize: 6, damageType: DamageType.COLD }
    ]
  },
  {
    id: "shock",
    name: "Shock",
    description: "The weapon crackles with electrical energy, dealing lightning damage on each hit.",
    type: EnchantmentItemType.WEAPON,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 500,
    effects: ["+1d6 lightning damage on hit"],
    icon: "fa-bolt",
    failRate: 5,
    mechanicalEffects: [
      { type: MechanicalEffectType.DAMAGE_BONUS, diceCount: 1, diceSize: 6, damageType: DamageType.LIGHTNING }
    ]
  },
  {
    id: "weapon-plus-1",
    name: "+1 Weapon",
    description: "A magically enhanced weapon with +1 to attack and damage rolls.",
    type: EnchantmentItemType.WEAPON,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 1000,
    effects: ["+1 to attack and damage rolls"],
    icon: "fa-plus",
    failRate: 3,
    mechanicalEffects: [
      { type: MechanicalEffectType.ATTACK_BONUS, value: 1 },
      { type: MechanicalEffectType.DAMAGE_BONUS, value: 1 }
    ]
  },
  {
    id: "weapon-plus-2",
    name: "+2 Weapon",
    description: "A magically enhanced weapon with +2 to attack and damage rolls.",
    type: EnchantmentItemType.WEAPON,
    rarity: EnchantmentRarity.RARE,
    baseCost: 4000,
    effects: ["+2 to attack and damage rolls"],
    icon: "fa-plus",
    failRate: 10,
    mechanicalEffects: [
      { type: MechanicalEffectType.ATTACK_BONUS, value: 2 },
      { type: MechanicalEffectType.DAMAGE_BONUS, value: 2 }
    ]
  },
  {
    id: "keen",
    name: "Keen Edge",
    description: "The weapon's edge is supernaturally sharp, increasing critical hit chance.",
    type: EnchantmentItemType.WEAPON,
    rarity: EnchantmentRarity.RARE,
    baseCost: 1000,
    effects: ["Critical hit range increased by 1 (19-20)"],
    icon: "fa-crosshairs",
    failRate: 10,
    mechanicalEffects: []  // Custom effect, needs special handling
  },
  {
    id: "vorpal",
    name: "Vorpal",
    description: "A legendary enchantment that can decapitate enemies on a critical hit.",
    type: EnchantmentItemType.WEAPON,
    rarity: EnchantmentRarity.LEGENDARY,
    baseCost: 10000,
    effects: ["On a natural 20, target must make DC 15 CON save or be decapitated"],
    icon: "fa-skull",
    failRate: 25,
    failConsequence: FailConsequence.DESTROYED,
    mechanicalEffects: []  // Special effect
  },

  // Armor Enchantments
  {
    id: "armor-plus-1",
    name: "+1 Armor",
    description: "Magically enhanced armor providing +1 to AC.",
    type: EnchantmentItemType.ARMOR,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 1000,
    effects: ["+1 to AC"],
    icon: "fa-shield",
    failRate: 3,
    mechanicalEffects: [
      { type: MechanicalEffectType.AC_BONUS, value: 1 }
    ]
  },
  {
    id: "armor-plus-2",
    name: "+2 Armor",
    description: "Magically enhanced armor providing +2 to AC.",
    type: EnchantmentItemType.ARMOR,
    rarity: EnchantmentRarity.RARE,
    baseCost: 4000,
    effects: ["+2 to AC"],
    icon: "fa-shield",
    failRate: 10,
    mechanicalEffects: [
      { type: MechanicalEffectType.AC_BONUS, value: 2 }
    ]
  },
  {
    id: "shadow",
    name: "Shadow",
    description: "The armor is infused with shadow magic, making the wearer harder to detect.",
    type: EnchantmentItemType.ARMOR,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 750,
    effects: ["+2 bonus to Stealth checks"],
    icon: "fa-moon",
    failRate: 5,
    mechanicalEffects: [
      { type: MechanicalEffectType.SKILL_BONUS, skill: "ste", value: 2 }
    ]
  },
  {
    id: "fire-resistance",
    name: "Fire Resistance",
    description: "The armor provides protection against fire damage.",
    type: EnchantmentItemType.ARMOR,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 600,
    effects: ["Resistance to fire damage"],
    icon: "fa-fire-flame-curved",
    failRate: 5,
    mechanicalEffects: [
      { type: MechanicalEffectType.RESISTANCE, damageType: DamageType.FIRE }
    ]
  },
  {
    id: "cold-resistance",
    name: "Cold Resistance",
    description: "The armor provides protection against cold damage.",
    type: EnchantmentItemType.ARMOR,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 600,
    effects: ["Resistance to cold damage"],
    icon: "fa-temperature-low",
    failRate: 5,
    mechanicalEffects: [
      { type: MechanicalEffectType.RESISTANCE, damageType: DamageType.COLD }
    ]
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
    icon: "fa-shield",
    failRate: 5,
    mechanicalEffects: [
      { type: MechanicalEffectType.AC_BONUS, value: 1 }
    ]
  },
  {
    id: "resistance-saves",
    name: "Resistance",
    description: "The ring grants a bonus to saving throws.",
    type: EnchantmentItemType.RING,
    rarity: EnchantmentRarity.RARE,
    baseCost: 2000,
    effects: ["+1 to all saving throws"],
    icon: "fa-hand-fist",
    failRate: 10,
    mechanicalEffects: [
      { type: MechanicalEffectType.SAVE_BONUS, ability: "all", value: 1 }
    ]
  },
  {
    id: "health",
    name: "Health",
    description: "The amulet bolsters the wearer's vitality.",
    type: EnchantmentItemType.AMULET,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 800,
    effects: ["+5 maximum hit points"],
    icon: "fa-heart",
    failRate: 5,
    mechanicalEffects: [
      { type: MechanicalEffectType.HP_BONUS, value: 5 }
    ]
  },
  {
    id: "strength",
    name: "Giant Strength",
    description: "The amulet grants the wearer enhanced strength.",
    type: EnchantmentItemType.AMULET,
    rarity: EnchantmentRarity.RARE,
    baseCost: 3000,
    effects: ["+2 to Strength"],
    icon: "fa-dumbbell",
    failRate: 10,
    mechanicalEffects: [
      { type: MechanicalEffectType.ABILITY_BONUS, ability: "str", value: 2 }
    ]
  },

  // Wondrous Item Enchantments
  {
    id: "speed",
    name: "Speed",
    description: "The item quickens the wearer's movements.",
    type: EnchantmentItemType.WONDROUS,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 750,
    effects: ["+10 feet movement speed"],
    icon: "fa-wind",
    failRate: 5,
    mechanicalEffects: [
      { type: MechanicalEffectType.SPEED_BONUS, value: 10 }
    ]
  },
  {
    id: "darkvision",
    name: "Darkvision",
    description: "The item grants the ability to see in darkness.",
    type: EnchantmentItemType.WONDROUS,
    rarity: EnchantmentRarity.UNCOMMON,
    baseCost: 500,
    effects: ["Darkvision 60 feet"],
    icon: "fa-eye",
    failRate: 5,
    mechanicalEffects: []  // Special handling for sense
  }
];
