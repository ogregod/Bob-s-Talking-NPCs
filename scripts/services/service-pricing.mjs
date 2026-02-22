/**
 * Bob's Talking NPCs - Service Pricing Calculator
 * Centralized pricing logic for all dynamic service pricing modes.
 * Used by service executors to calculate service costs based on various factors.
 */

const MODULE_ID = "bobs-talking-npcs";

import { PriceType } from "../data/merchant-model.mjs";
import { calculateEnchantmentCost } from "../data/enchantment-model.mjs";

/**
 * Calculate service price based on pricing configuration
 * @param {object} serviceDef - Service definition with pricing configuration
 * @param {object} context - Pricing context with relevant data
 * @param {object} [context.item] - Item being serviced (for item-based pricing)
 * @param {number} [context.spellLevel] - Spell level (for spell-level pricing)
 * @param {object} [context.enchantment] - Enchantment data (for enchantment pricing)
 * @param {number} [context.selectedTier] - Selected tier index (for tiered pricing)
 * @param {object} [context.options] - Additional options from service request
 * @param {object} [context.merchant] - Merchant data
 * @param {object} [context.actor] - Actor requesting service
 * @returns {number} Final price in gold
 */
export function calculateServicePrice(serviceDef, context = {}) {
  if (!serviceDef) {
    console.warn(`${MODULE_ID} | calculateServicePrice: No service definition provided`);
    return 0;
  }

  const priceType = serviceDef.priceType || "fixed";

  try {
    switch (priceType) {
      case PriceType.FIXED:
      case "fixed":
        return serviceDef.basePrice || 0;

      case PriceType.PERCENT:
      case "percent":
        return _calculatePercentPrice(serviceDef, context);

      case PriceType.PER_DAY:
      case "perDay":
        return serviceDef.pricePerUnit || serviceDef.basePrice || 0;

      case PriceType.PER_ITEM:
      case "perItem":
        return serviceDef.pricePerUnit || serviceDef.basePrice || 0;

      case PriceType.ITEM_VALUE:
      case "itemValue":
        return _calculateItemValuePrice(serviceDef, context);

      case PriceType.SPELL_LEVEL:
      case "spellLevel":
        return _calculateSpellLevelPrice(serviceDef, context);

      case PriceType.ENCHANTMENT:
      case "enchantment":
        return _calculateEnchantmentPrice(serviceDef, context);

      case PriceType.TIERED:
      case "tiered":
        return _calculateTieredPrice(serviceDef, context);

      case PriceType.VARIABLE:
      case "variable":
        // Variable pricing returns basePrice as fallback, actual price set at use
        return serviceDef.basePrice || 0;

      default:
        console.warn(`${MODULE_ID} | Unknown price type: ${priceType}, using basePrice`);
        return serviceDef.basePrice || 0;
    }
  } catch (error) {
    console.error(`${MODULE_ID} | Error calculating service price:`, error);
    return serviceDef.basePrice || 0;  // Fallback to basePrice on error
  }
}

/**
 * Calculate price as percentage of item value
 * @private
 */
function _calculatePercentPrice(serviceDef, context) {
  const item = context.item;
  if (!item) {
    console.warn(`${MODULE_ID} | Percent pricing requires item context`);
    return serviceDef.basePrice || 0;
  }

  const itemValue = item.system?.price?.value || 0;
  const percent = serviceDef.pricePercent || serviceDef.basePrice || 10;
  const calculated = Math.round(itemValue * (percent / 100));

  return calculated || serviceDef.basePrice || 0;
}

/**
 * Calculate price based on percentage of item value with minimum floor
 * @private
 */
function _calculateItemValuePrice(serviceDef, context) {
  const item = context.item;
  if (!item) {
    console.warn(`${MODULE_ID} | Item value pricing requires item context`);
    return serviceDef.basePrice || 0;
  }

  const itemValue = item.system?.price?.value || 0;
  const percent = serviceDef.itemValuePercent || 10;
  const calculated = Math.round(itemValue * (percent / 100));
  const minimum = serviceDef.itemValueMinimum || 0;

  // Return higher of calculated value or minimum
  return Math.max(calculated, minimum);
}

/**
 * Calculate price based on spell level formula: base + (level × multiplier)
 * @private
 */
function _calculateSpellLevelPrice(serviceDef, context) {
  const spellLevel = context.spellLevel || context.options?.spellLevel || 1;

  // Validate spell level is in valid range
  const validatedLevel = Math.max(0, Math.min(9, parseInt(spellLevel) || 1));

  const base = serviceDef.spellLevelBase || 25;
  const multiplier = serviceDef.spellLevelMultiplier || 50;

  const calculated = base + (validatedLevel * multiplier);

  return Math.max(calculated, 0);  // Ensure non-negative
}

/**
 * Calculate price using enchantment system pricing
 * @private
 */
function _calculateEnchantmentPrice(serviceDef, context) {
  const enchantment = context.enchantment;
  const item = context.item;

  if (!enchantment) {
    console.warn(`${MODULE_ID} | Enchantment pricing requires enchantment context`);
    return serviceDef.basePrice || 100;
  }

  try {
    // Get item rarity for pricing calculation
    const itemRarity = item?.system?.rarity || "common";

    // Get shop-specific modifier
    const modifier = serviceDef.enchantmentPriceModifier || 1.0;

    // Use existing enchantment pricing system
    const calculatedCost = calculateEnchantmentCost(enchantment, itemRarity, modifier);

    return Math.max(calculatedCost, 0);
  } catch (error) {
    console.error(`${MODULE_ID} | Error calculating enchantment price:`, error);
    return serviceDef.basePrice || 100;
  }
}

/**
 * Calculate price from selected tier
 * @private
 */
function _calculateTieredPrice(serviceDef, context) {
  const selectedTier = context.selectedTier ?? context.options?.tier ?? 0;
  const tiers = serviceDef.pricingTiers || [];

  if (tiers.length === 0) {
    console.warn(`${MODULE_ID} | Tiered pricing has no tiers defined`);
    return serviceDef.basePrice || 0;
  }

  // Validate tier index
  const tierIndex = Math.max(0, Math.min(tiers.length - 1, parseInt(selectedTier) || 0));
  const tier = tiers[tierIndex];

  if (!tier) {
    console.warn(`${MODULE_ID} | Invalid tier index: ${selectedTier}`);
    return tiers[0]?.price || serviceDef.basePrice || 0;
  }

  return tier.price || 0;
}

/**
 * Get pricing summary for display purposes
 * @param {object} serviceDef - Service definition
 * @returns {string} Human-readable pricing summary
 */
export function getPricingSummary(serviceDef) {
  if (!serviceDef) return "Price unknown";

  const priceType = serviceDef.priceType || "fixed";

  switch (priceType) {
    case PriceType.FIXED:
    case "fixed":
      return `${serviceDef.basePrice || 0}gp`;

    case PriceType.PERCENT:
    case "percent":
      return `${serviceDef.pricePercent || serviceDef.basePrice}% of item value`;

    case PriceType.PER_DAY:
    case "perDay":
      return `${serviceDef.pricePerUnit || serviceDef.basePrice}gp/day`;

    case PriceType.PER_ITEM:
    case "perItem":
      return `${serviceDef.pricePerUnit || serviceDef.basePrice}gp/item`;

    case PriceType.ITEM_VALUE:
    case "itemValue":
      const percent = serviceDef.itemValuePercent || 10;
      const min = serviceDef.itemValueMinimum || 0;
      return min > 0
        ? `${percent}% of item value (min ${min}gp)`
        : `${percent}% of item value`;

    case PriceType.SPELL_LEVEL:
    case "spellLevel":
      const base = serviceDef.spellLevelBase || 25;
      const mult = serviceDef.spellLevelMultiplier || 50;
      return `${base} + (level × ${mult})gp`;

    case PriceType.ENCHANTMENT:
    case "enchantment":
      return "Based on enchantment rarity";

    case PriceType.TIERED:
    case "tiered":
      const tiers = serviceDef.pricingTiers || [];
      if (tiers.length === 0) return "Tiered pricing (no tiers)";
      const minPrice = tiers[0]?.price || 0;
      const maxPrice = tiers[tiers.length - 1]?.price || 0;
      return `${tiers.length} tiers (${minPrice}-${maxPrice}gp)`;

    case PriceType.VARIABLE:
    case "variable":
      return "Variable (set at use)";

    default:
      return serviceDef.basePrice ? `${serviceDef.basePrice}gp` : "Price varies";
  }
}

/**
 * Validate pricing configuration
 * @param {object} serviceDef - Service definition to validate
 * @returns {object} Validation result: {valid: boolean, errors: string[]}
 */
export function validatePricingConfig(serviceDef) {
  const errors = [];

  if (!serviceDef) {
    errors.push("No service definition provided");
    return { valid: false, errors };
  }

  const priceType = serviceDef.priceType || "fixed";

  // Validate based on price type
  switch (priceType) {
    case PriceType.ITEM_VALUE:
    case "itemValue":
      if (typeof serviceDef.itemValuePercent !== "number" || serviceDef.itemValuePercent < 0) {
        errors.push("Item value percentage must be a non-negative number");
      }
      if (typeof serviceDef.itemValueMinimum !== "number" || serviceDef.itemValueMinimum < 0) {
        errors.push("Item value minimum must be a non-negative number");
      }
      break;

    case PriceType.SPELL_LEVEL:
    case "spellLevel":
      if (typeof serviceDef.spellLevelBase !== "number" || serviceDef.spellLevelBase < 0) {
        errors.push("Spell level base must be a non-negative number");
      }
      if (typeof serviceDef.spellLevelMultiplier !== "number" || serviceDef.spellLevelMultiplier < 0) {
        errors.push("Spell level multiplier must be a non-negative number");
      }
      break;

    case PriceType.ENCHANTMENT:
    case "enchantment":
      if (typeof serviceDef.enchantmentPriceModifier !== "number" || serviceDef.enchantmentPriceModifier <= 0) {
        errors.push("Enchantment price modifier must be a positive number");
      }
      break;

    case PriceType.TIERED:
    case "tiered":
      if (!Array.isArray(serviceDef.pricingTiers)) {
        errors.push("Pricing tiers must be an array");
      } else if (serviceDef.pricingTiers.length === 0) {
        errors.push("Tiered pricing must have at least one tier");
      } else {
        serviceDef.pricingTiers.forEach((tier, index) => {
          if (typeof tier.price !== "number" || tier.price < 0) {
            errors.push(`Tier ${index}: price must be a non-negative number`);
          }
          if (!tier.name || tier.name.trim() === "") {
            errors.push(`Tier ${index}: name is required`);
          }
        });
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
