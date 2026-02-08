/**
 * Bob's Talking NPCs - Enchantment Handler
 * Manages the master enchantment list and per-shop enchantment assignments
 */

const MODULE_ID = "bobs-talking-npcs";

import {
  createEnchantment,
  validateEnchantment,
  DEFAULT_ENCHANTMENTS
} from "../data/enchantment-model.mjs";
import { generateId } from "../utils/helpers.mjs";

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
   * Get enchantments available at a specific shop
   * @param {string} merchantId - Merchant/shop ID
   * @returns {object[]}
   */
  getShopEnchantments(merchantId) {
    const merchant = game.bobsnpc?.handlers?.merchant?.getMerchant(merchantId);
    if (!merchant) return [];

    const availableIds = merchant.services?.availableEnchantments || [];
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

    const currentIds = merchant.services?.availableEnchantments || [];
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

    const currentIds = merchant.services?.availableEnchantments || [];
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
}

// Singleton instance
export const enchantmentHandler = new EnchantmentHandler();
