/**
 * Bob's Talking NPCs - Enchantment Handler
 * Manages the master enchantment list and per-shop enchantment assignments
 */

const MODULE_ID = "bobs-talking-npcs";

import {
  createEnchantment,
  validateEnchantment,
  DEFAULT_ENCHANTMENTS,
  MechanicalEffectType,
  DamageType,
  DurationType,
  ActivationType
} from "../data/enchantment-model.mjs";
import { generateId } from "../utils/helpers.mjs";

/**
 * Mapping of D&D 5e abilities
 */
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

/**
 * Mapping of D&D 5e skills to their ability
 */
const SKILLS = {
  acr: "dex", ani: "wis", arc: "int", ath: "str", dec: "cha",
  his: "int", ins: "wis", itm: "cha", inv: "int", med: "wis",
  nat: "int", prc: "wis", prf: "cha", per: "cha", rel: "int",
  slt: "dex", ste: "dex", sur: "wis"
};

/**
 * Enchantment Handler Class
 * Singleton managing all enchantment operations
 */
export class EnchantmentHandler {
  constructor() {
    this._initialized = false;
    this._enchantmentCache = new Map();
  }

  /**
   * Initialize the enchantment handler
   */
  async initialize() {
    if (this._initialized) return;

    await this._loadEnchantments();
    await this._seedDefaultsIfEmpty();

    this._initialized = true;
    console.log(`${MODULE_ID} | Enchantment Handler initialized with ${this._enchantmentCache.size} enchantments`);
  }

  // ==================== ENCHANTMENT STORAGE ====================

  /**
   * Load enchantments from storage
   * @private
   */
  async _loadEnchantments() {
    this._enchantmentCache.clear();

    const enchantments = game.settings.get(MODULE_ID, "masterEnchantments") || {};

    for (const [id, enchantmentData] of Object.entries(enchantments)) {
      this._enchantmentCache.set(id, createEnchantment(enchantmentData));
    }
  }

  /**
   * Save enchantments to storage
   * @private
   */
  async _saveMasterEnchantments() {
    const enchantments = Object.fromEntries(this._enchantmentCache);
    await game.settings.set(MODULE_ID, "masterEnchantments", enchantments);
  }

  /**
   * Seed default enchantments if none exist
   * @private
   */
  async _seedDefaultsIfEmpty() {
    if (this._enchantmentCache.size === 0) {
      console.log(`${MODULE_ID} | Seeding default enchantments`);

      for (const enchantData of DEFAULT_ENCHANTMENTS) {
        const enchantment = createEnchantment(enchantData);
        this._enchantmentCache.set(enchantment.id, enchantment);
      }

      await this._saveMasterEnchantments();
    }
  }

  // ==================== MASTER LIST CRUD ====================

  /**
   * Get all enchantments from the master list
   * @returns {object[]}
   */
  getAllEnchantments() {
    return Array.from(this._enchantmentCache.values());
  }

  /**
   * Get enchantments filtered by type
   * @param {string} type - Item type to filter by
   * @returns {object[]}
   */
  getEnchantmentsByType(type) {
    return this.getAllEnchantments().filter(e =>
      e.type === type || e.type === "any"
    );
  }

  /**
   * Get a single enchantment by ID
   * @param {string} id - Enchantment ID
   * @returns {object|null}
   */
  getEnchantment(id) {
    return this._enchantmentCache.get(id) || null;
  }

  /**
   * Create a new enchantment
   * @param {object} data - Enchantment data
   * @returns {object}
   */
  async createEnchantment(data) {
    const enchantment = createEnchantment({
      ...data,
      id: data.id || generateId()
    });

    const validation = validateEnchantment(enchantment);
    if (!validation.valid) {
      console.warn(`${MODULE_ID} | Enchantment validation errors:`, validation.errors);
      throw new Error(validation.errors.join(", "));
    }

    this._enchantmentCache.set(enchantment.id, enchantment);
    await this._saveMasterEnchantments();

    Hooks.callAll("bobsNPCEnchantmentCreated", enchantment);

    return enchantment;
  }

  /**
   * Update an existing enchantment
   * @param {string} id - Enchantment ID
   * @param {object} updates - Updates to apply
   * @returns {object|null}
   */
  async updateEnchantment(id, updates) {
    const existing = this._enchantmentCache.get(id);
    if (!existing) return null;

    const updated = createEnchantment({
      ...existing,
      ...updates,
      id // Preserve ID
    });

    const validation = validateEnchantment(updated);
    if (!validation.valid) {
      console.warn(`${MODULE_ID} | Enchantment validation errors:`, validation.errors);
      throw new Error(validation.errors.join(", "));
    }

    this._enchantmentCache.set(id, updated);
    await this._saveMasterEnchantments();

    Hooks.callAll("bobsNPCEnchantmentUpdated", updated);

    return updated;
  }

  /**
   * Delete an enchantment from the master list
   * @param {string} id - Enchantment ID
   * @returns {boolean}
   */
  async deleteEnchantment(id) {
    if (!this._enchantmentCache.has(id)) return false;

    this._enchantmentCache.delete(id);
    await this._saveMasterEnchantments();

    Hooks.callAll("bobsNPCEnchantmentDeleted", id);

    return true;
  }

  /**
   * Reset to default enchantments
   * @returns {Promise<void>}
   */
  async resetToDefaults() {
    this._enchantmentCache.clear();

    for (const enchantData of DEFAULT_ENCHANTMENTS) {
      const enchantment = createEnchantment(enchantData);
      this._enchantmentCache.set(enchantment.id, enchantment);
    }

    await this._saveMasterEnchantments();

    Hooks.callAll("bobsNPCEnchantmentsReset");
  }

  // ==================== PER-SHOP ENCHANTMENTS ====================

  /**
   * Normalize availableEnchantments to array format
   * Handles both array format (legacy) and object format (from form checkboxes)
   * @param {Array|object} data - The availableEnchantments data
   * @returns {string[]} Array of enchantment IDs
   * @private
   */
  _normalizeEnchantmentIds(data) {
    if (!data) return [];

    if (Array.isArray(data)) {
      return data;
    }

    if (typeof data === "object") {
      // Convert object format to array of IDs where value is truthy
      return Object.entries(data)
        .filter(([, enabled]) => enabled)
        .map(([id]) => id);
    }

    return [];
  }

  /**
   * Get enchantments available at a specific shop
   * @param {string} merchantId - Merchant/shop ID
   * @returns {object[]}
   */
  getShopEnchantments(merchantId) {
    const merchant = game.bobsnpc?.handlers?.merchant?.getMerchant(merchantId);
    if (!merchant) return [];

    const availableIds = this._normalizeEnchantmentIds(merchant.services?.availableEnchantments);
    const enchantments = [];

    for (const id of availableIds) {
      const enchantment = this.getEnchantment(id);
      if (enchantment && enchantment.active) {
        enchantments.push(enchantment);
      }
    }

    return enchantments;
  }

  /**
   * Get enchantments available at a shop, filtered by item type
   * @param {string} merchantId - Merchant/shop ID
   * @param {string} itemType - Item type to filter by
   * @returns {object[]}
   */
  getShopEnchantmentsForItem(merchantId, itemType) {
    return this.getShopEnchantments(merchantId).filter(e =>
      e.type === itemType || e.type === "any"
    );
  }

  /**
   * Set available enchantments for a shop
   * @param {string} merchantId - Merchant/shop ID
   * @param {string[]} enchantmentIds - Array of enchantment IDs to enable
   * @returns {Promise<boolean>}
   */
  async setShopEnchantments(merchantId, enchantmentIds) {
    const merchantHandler = game.bobsnpc?.handlers?.merchant;
    if (!merchantHandler) return false;

    const merchant = merchantHandler.getMerchant(merchantId);
    if (!merchant) return false;

    // Validate all IDs exist
    const validIds = enchantmentIds.filter(id => this._enchantmentCache.has(id));

    await merchantHandler.updateMerchant(merchantId, {
      services: {
        ...merchant.services,
        availableEnchantments: validIds
      }
    });

    return true;
  }

  /**
   * Add an enchantment to a shop's available list
   * @param {string} merchantId - Merchant/shop ID
   * @param {string} enchantmentId - Enchantment ID to add
   * @returns {Promise<boolean>}
   */
  async addEnchantmentToShop(merchantId, enchantmentId) {
    if (!this._enchantmentCache.has(enchantmentId)) return false;

    const merchantHandler = game.bobsnpc?.handlers?.merchant;
    if (!merchantHandler) return false;

    const merchant = merchantHandler.getMerchant(merchantId);
    if (!merchant) return false;

    const currentIds = this._normalizeEnchantmentIds(merchant.services?.availableEnchantments);
    if (currentIds.includes(enchantmentId)) return true; // Already added

    await merchantHandler.updateMerchant(merchantId, {
      services: {
        ...merchant.services,
        availableEnchantments: [...currentIds, enchantmentId]
      }
    });

    return true;
  }

  /**
   * Remove an enchantment from a shop's available list
   * @param {string} merchantId - Merchant/shop ID
   * @param {string} enchantmentId - Enchantment ID to remove
   * @returns {Promise<boolean>}
   */
  async removeEnchantmentFromShop(merchantId, enchantmentId) {
    const merchantHandler = game.bobsnpc?.handlers?.merchant;
    if (!merchantHandler) return false;

    const merchant = merchantHandler.getMerchant(merchantId);
    if (!merchant) return false;

    const currentIds = this._normalizeEnchantmentIds(merchant.services?.availableEnchantments);
    const updatedIds = currentIds.filter(id => id !== enchantmentId);

    await merchantHandler.updateMerchant(merchantId, {
      services: {
        ...merchant.services,
        availableEnchantments: updatedIds
      }
    });

    return true;
  }

  // ==================== IMPORT/EXPORT ====================

  /**
   * Export all enchantments to JSON
   * @returns {string}
   */
  exportEnchantments() {
    const enchantments = this.getAllEnchantments();
    return JSON.stringify(enchantments, null, 2);
  }

  /**
   * Import enchantments from JSON
   * @param {string} jsonString - JSON string to import
   * @param {boolean} [replace=false] - Replace existing enchantments
   * @returns {Promise<number>} Number of enchantments imported
   */
  async importEnchantments(jsonString, replace = false) {
    const enchantments = JSON.parse(jsonString);

    if (!Array.isArray(enchantments)) {
      throw new Error("Invalid enchantment data - expected array");
    }

    if (replace) {
      this._enchantmentCache.clear();
    }

    let count = 0;
    for (const data of enchantments) {
      const enchantment = createEnchantment({
        ...data,
        id: data.id || generateId()
      });

      const validation = validateEnchantment(enchantment);
      if (validation.valid) {
        this._enchantmentCache.set(enchantment.id, enchantment);
        count++;
      }
    }

    await this._saveMasterEnchantments();

    return count;
  }

  // ==================== ACTIVE EFFECT BUILDER ====================

  /**
   * Build Active Effect changes array for D&D 5e from enchantment
   * @param {object} enchantment - Enchantment data
   * @returns {object[]} Array of Active Effect changes
   */
  buildActiveEffectChanges(enchantment) {
    const changes = [];

    if (!enchantment.mechanicalEffects || !Array.isArray(enchantment.mechanicalEffects)) {
      return changes;
    }

    for (const effect of enchantment.mechanicalEffects) {
      const effectChanges = this._buildSingleEffectChange(effect);
      changes.push(...effectChanges);
    }

    return changes;
  }

  /**
   * Build changes for a single mechanical effect
   * @param {object} effect - Mechanical effect object
   * @returns {object[]} Array of changes for this effect
   * @private
   */
  _buildSingleEffectChange(effect) {
    const changes = [];

    switch (effect.type) {
      case MechanicalEffectType.ATTACK_BONUS: {
        // Apply to both melee and ranged weapon attacks
        const value = effect.value || 0;
        changes.push({
          key: "system.bonuses.mwak.attack",
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: String(value)
        });
        changes.push({
          key: "system.bonuses.rwak.attack",
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: String(value)
        });
        break;
      }

      case MechanicalEffectType.DAMAGE_BONUS: {
        // Build damage string like "1d6[fire]"
        let damageStr = "";
        if (effect.diceCount && effect.diceSize) {
          damageStr = `${effect.diceCount}d${effect.diceSize}`;
        } else if (effect.value) {
          damageStr = String(effect.value);
        }
        if (effect.damageType && damageStr) {
          damageStr += `[${effect.damageType}]`;
        }
        if (damageStr) {
          changes.push({
            key: "system.bonuses.mwak.damage",
            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            value: damageStr
          });
          changes.push({
            key: "system.bonuses.rwak.damage",
            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            value: damageStr
          });
        }
        break;
      }

      case MechanicalEffectType.AC_BONUS: {
        changes.push({
          key: "system.attributes.ac.bonus",
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: String(effect.value || 0)
        });
        break;
      }

      case MechanicalEffectType.SAVE_BONUS: {
        if (effect.ability && ABILITIES.includes(effect.ability)) {
          // Bonus to specific save
          changes.push({
            key: `system.abilities.${effect.ability}.bonuses.save`,
            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            value: String(effect.value || 0)
          });
        } else {
          // Bonus to all saves
          changes.push({
            key: "system.bonuses.abilities.save",
            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            value: String(effect.value || 0)
          });
        }
        break;
      }

      case MechanicalEffectType.ABILITY_BONUS: {
        if (effect.ability && ABILITIES.includes(effect.ability)) {
          changes.push({
            key: `system.abilities.${effect.ability}.value`,
            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            value: String(effect.value || 0)
          });
        }
        break;
      }

      case MechanicalEffectType.RESISTANCE: {
        if (effect.damageType) {
          changes.push({
            key: "system.traits.dr.value",
            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            value: effect.damageType
          });
        }
        break;
      }

      case MechanicalEffectType.IMMUNITY: {
        if (effect.damageType) {
          changes.push({
            key: "system.traits.di.value",
            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            value: effect.damageType
          });
        }
        break;
      }

      case MechanicalEffectType.SPEED_BONUS: {
        changes.push({
          key: "system.attributes.movement.walk",
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: String(effect.value || 0)
        });
        break;
      }

      case MechanicalEffectType.SKILL_BONUS: {
        if (effect.skill && SKILLS[effect.skill]) {
          changes.push({
            key: `system.skills.${effect.skill}.bonuses.check`,
            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            value: String(effect.value || 0)
          });
        }
        break;
      }

      case MechanicalEffectType.HP_BONUS: {
        changes.push({
          key: "system.attributes.hp.bonuses.overall",
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: String(effect.value || 0)
        });
        break;
      }

      case MechanicalEffectType.CUSTOM: {
        // Custom key/value for advanced users
        if (effect.customKey) {
          changes.push({
            key: effect.customKey,
            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            value: String(effect.value || 0)
          });
        }
        break;
      }
    }

    return changes;
  }

  /**
   * Build duration object for Active Effect
   * @param {object} enchantment - Enchantment data
   * @returns {object} Duration configuration
   * @private
   */
  _buildDuration(enchantment) {
    const duration = {};

    switch (enchantment.durationType) {
      case DurationType.PERMANENT:
        // No duration for permanent effects
        break;

      case DurationType.ROUNDS:
        duration.rounds = enchantment.durationValue || 1;
        break;

      case DurationType.MINUTES:
        // Convert minutes to seconds for Foundry
        duration.seconds = (enchantment.durationValue || 1) * 60;
        break;

      case DurationType.HOURS:
        duration.seconds = (enchantment.durationValue || 1) * 60 * 60;
        break;

      case DurationType.CONCENTRATION:
        duration.concentration = true;
        duration.rounds = enchantment.durationValue || 10;
        break;
    }

    return duration;
  }

  /**
   * Create complete Active Effect data object for an enchantment
   * @param {object} enchantment - Enchantment data
   * @param {object} [options] - Additional options
   * @param {string} [options.itemName] - Name of the item being enchanted
   * @param {string} [options.origin] - Origin UUID for the effect
   * @returns {object} Complete Active Effect data
   */
  createActiveEffectData(enchantment, options = {}) {
    const changes = this.buildActiveEffectChanges(enchantment);
    const duration = this._buildDuration(enchantment);

    // Determine transfer behavior based on activation type
    const isPassive = enchantment.activationType === ActivationType.PASSIVE;

    const effectData = {
      name: enchantment.name,
      icon: this._getEffectIcon(enchantment),
      origin: options.origin || null,
      disabled: false,
      transfer: isPassive, // Passive effects transfer to actor when equipped
      changes,
      duration,
      flags: {
        [MODULE_ID]: {
          enchantmentId: enchantment.id,
          enchantmentName: enchantment.name,
          activationType: enchantment.activationType,
          activationCost: enchantment.activationCost,
          charges: enchantment.charges,
          rechargeType: enchantment.rechargeType,
          appliedTo: options.itemName || null
        }
      }
    };

    // Add description if available
    if (enchantment.description) {
      effectData.description = enchantment.description;
    }

    return effectData;
  }

  /**
   * Get appropriate icon for an enchantment effect
   * @param {object} enchantment - Enchantment data
   * @returns {string} Icon path
   * @private
   */
  _getEffectIcon(enchantment) {
    // Map Font Awesome icons to Foundry icons
    const iconMap = {
      "fa-fire": "icons/magic/fire/flame-burning-yellow-orange.webp",
      "fa-snowflake": "icons/magic/water/snowflake-ice-blue-white.webp",
      "fa-bolt": "icons/magic/lightning/bolt-strike-blue.webp",
      "fa-shield-halved": "icons/equipment/shield/heater-steel-worn.webp",
      "fa-feather": "icons/commodities/biological/feather-white.webp",
      "fa-ghost": "icons/magic/unholy/silhouette-evil-horned-giant.webp",
      "fa-sun": "icons/magic/light/explosion-star-glow-silhouette.webp",
      "fa-moon": "icons/magic/light/orb-beams-moon-purple.webp",
      "fa-skull": "icons/magic/death/skull-humanoid-white-red.webp",
      "fa-heart": "icons/magic/life/heart-glowing-red.webp",
      "fa-eye": "icons/magic/perception/eye-ringed-glow-angry-teal.webp",
      "fa-wind": "icons/magic/air/wind-swirl-gray.webp",
      "fa-gem": "icons/commodities/gems/gem-faceted-radiant-purple.webp"
    };

    if (enchantment.icon && iconMap[enchantment.icon]) {
      return iconMap[enchantment.icon];
    }

    // Default magic icon
    return "icons/magic/symbols/runes-star-pentagon-blue.webp";
  }

  /**
   * Apply an enchantment's Active Effect to an item
   * @param {Item} item - The item to enchant
   * @param {object} enchantment - The enchantment to apply
   * @returns {Promise<ActiveEffect>} The created Active Effect
   */
  async applyEnchantmentToItem(item, enchantment) {
    const effectData = this.createActiveEffectData(enchantment, {
      itemName: item.name,
      origin: item.uuid
    });

    const [effect] = await item.createEmbeddedDocuments("ActiveEffect", [effectData]);

    console.log(`${MODULE_ID} | Applied enchantment "${enchantment.name}" to item "${item.name}"`);

    return effect;
  }

  /**
   * Check if an item has a specific enchantment applied
   * @param {Item} item - The item to check
   * @param {string} enchantmentId - The enchantment ID to look for
   * @returns {boolean}
   */
  hasEnchantment(item, enchantmentId) {
    if (!item.effects) return false;

    return item.effects.some(effect =>
      effect.flags?.[MODULE_ID]?.enchantmentId === enchantmentId
    );
  }

  /**
   * Get all enchantments applied to an item
   * @param {Item} item - The item to check
   * @returns {object[]} Array of enchantment data from effects
   */
  getItemEnchantments(item) {
    if (!item.effects) return [];

    return item.effects
      .filter(effect => effect.flags?.[MODULE_ID]?.enchantmentId)
      .map(effect => ({
        effectId: effect.id,
        enchantmentId: effect.flags[MODULE_ID].enchantmentId,
        enchantmentName: effect.flags[MODULE_ID].enchantmentName,
        activationType: effect.flags[MODULE_ID].activationType
      }));
  }

  /**
   * Remove an enchantment from an item
   * @param {Item} item - The item to remove from
   * @param {string} enchantmentId - The enchantment ID to remove
   * @returns {Promise<boolean>}
   */
  async removeEnchantmentFromItem(item, enchantmentId) {
    if (!item.effects) return false;

    const effect = item.effects.find(e =>
      e.flags?.[MODULE_ID]?.enchantmentId === enchantmentId
    );

    if (!effect) return false;

    await effect.delete();
    console.log(`${MODULE_ID} | Removed enchantment "${enchantmentId}" from item "${item.name}"`);

    return true;
  }
}
