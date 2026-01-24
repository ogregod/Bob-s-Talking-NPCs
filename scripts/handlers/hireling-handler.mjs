/**
 * Bob's Talking NPCs - Hireling Handler
 * Business logic for hirelings, contracts, loyalty, and mounts
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";
import { localize, getFlag, setFlag, generateId } from "../utils/helpers.mjs";
import {
  HirelingType,
  MountType,
  ContractType,
  HirelingStatus,
  LoyaltyLevel,
  createHireling,
  createMount,
  createContract,
  createLoyaltyTracker,
  createStableConfig,
  createHirelingFromTemplate,
  createMountFromTemplate,
  modifyLoyalty,
  getLoyaltyLevel,
  calculateHiringCost,
  checkLoyaltyConsequences,
  validateHireling,
  validateMount
} from "../data/hireling-model.mjs";

/**
 * Hireling Handler class
 * Manages all hireling, contract, and mount operations
 */
export class HirelingHandler {
  constructor() {
    this._initialized = false;
    this._hirelingCache = new Map();
    this._mountCache = new Map();
    this._stableCache = new Map();
    this._playerHirelingsCache = new Map();
    this._playerMountsCache = new Map();
  }

  /**
   * Initialize the hireling handler
   */
  async initialize() {
    if (this._initialized) return;

    await this._loadHirelings();
    await this._loadMounts();
    await this._loadStables();

    this._initialized = true;
    console.log(`${MODULE_ID} | Hireling handler initialized`);
  }

  // ==================== Data Loading ====================

  /**
   * Load all hirelings from world settings
   * @private
   */
  async _loadHirelings() {
    const hirelings = game.settings.get(MODULE_ID, "hirelings") || {};
    this._hirelingCache.clear();
    for (const [id, data] of Object.entries(hirelings)) {
      this._hirelingCache.set(id, data);
    }
  }

  /**
   * Load all mounts from world settings
   * @private
   */
  async _loadMounts() {
    const mounts = game.settings.get(MODULE_ID, "mounts") || {};
    this._mountCache.clear();
    for (const [id, data] of Object.entries(mounts)) {
      this._mountCache.set(id, data);
    }
  }

  /**
   * Load all stable configs from world settings
   * @private
   */
  async _loadStables() {
    const stables = game.settings.get(MODULE_ID, "stables") || {};
    this._stableCache.clear();
    for (const [id, data] of Object.entries(stables)) {
      this._stableCache.set(id, data);
    }
  }

  /**
   * Save hirelings to world settings
   * @private
   */
  async _saveHirelings() {
    const data = Object.fromEntries(this._hirelingCache);
    await game.settings.set(MODULE_ID, "hirelings", data);
  }

  /**
   * Save mounts to world settings
   * @private
   */
  async _saveMounts() {
    const data = Object.fromEntries(this._mountCache);
    await game.settings.set(MODULE_ID, "mounts", data);
  }

  /**
   * Save stables to world settings
   * @private
   */
  async _saveStables() {
    const data = Object.fromEntries(this._stableCache);
    await game.settings.set(MODULE_ID, "stables", data);
  }

  // ==================== Hireling Management ====================

  /**
   * Create a new hireling
   * @param {object} data - Hireling data
   * @returns {object} Created hireling
   */
  async createHireling(data) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const hireling = createHireling(data);
    const validation = validateHireling(hireling);
    if (!validation.valid) {
      throw new Error(validation.errors.join(", "));
    }

    this._hirelingCache.set(hireling.id, hireling);
    await this._saveHirelings();

    Hooks.callAll(`${MODULE_ID}.hirelingCreated`, hireling);
    return hireling;
  }

  /**
   * Create hireling from template
   * @param {string} templateName - Template name
   * @param {object} overrides - Data overrides
   * @returns {object} Created hireling
   */
  async createHirelingFromTemplate(templateName, overrides = {}) {
    const hireling = createHirelingFromTemplate(templateName, overrides);
    this._hirelingCache.set(hireling.id, hireling);
    await this._saveHirelings();

    Hooks.callAll(`${MODULE_ID}.hirelingCreated`, hireling);
    return hireling;
  }

  /**
   * Get hireling by ID
   * @param {string} hirelingId - Hireling ID
   * @returns {object|null}
   */
  getHireling(hirelingId) {
    return this._hirelingCache.get(hirelingId) || null;
  }

  /**
   * Get all hirelings
   * @returns {object[]}
   */
  getAllHirelings() {
    return Array.from(this._hirelingCache.values());
  }

  /**
   * Get available hirelings for recruitment
   * @param {string} playerActorUuid - Player actor UUID (for requirement checks)
   * @returns {object[]}
   */
  async getAvailableHirelings(playerActorUuid = null) {
    const available = [];
    const player = playerActorUuid ? await fromUuid(playerActorUuid) : null;

    for (const hireling of this._hirelingCache.values()) {
      if (hireling.status !== HirelingStatus.AVAILABLE) continue;

      // Check requirements
      if (player && !await this._meetsRequirements(player, hireling.requirements)) {
        continue;
      }

      available.push(hireling);
    }

    return available;
  }

  /**
   * Check if player meets hireling requirements
   * @param {Actor} player - Player actor
   * @param {object} requirements - Requirements object
   * @returns {boolean}
   * @private
   */
  async _meetsRequirements(player, requirements) {
    if (!requirements) return true;

    // Check level
    if (requirements.playerLevel > 0) {
      const level = player.system?.details?.level || 0;
      if (level < requirements.playerLevel) return false;
    }

    // Check faction
    if (requirements.factionId) {
      const factionHandler = game.bobsnpc?.factions;
      if (factionHandler) {
        const rank = await factionHandler.getRank(player.uuid, requirements.factionId);
        if (!rank) return false;
        if (requirements.factionRank && rank.tier < requirements.factionRank) return false;
      }
    }

    // Check quest completion
    if (requirements.questCompleted) {
      const questHandler = game.bobsnpc?.quests;
      if (questHandler) {
        const quest = questHandler.getQuest(requirements.questCompleted);
        if (!quest || quest.status !== "completed") return false;
      }
    }

    return true;
  }

  /**
   * Update hireling
   * @param {string} hirelingId - Hireling ID
   * @param {object} updates - Updates to apply
   * @returns {object} Updated hireling
   */
  async updateHireling(hirelingId, updates) {
    const hireling = this._hirelingCache.get(hirelingId);
    if (!hireling) {
      throw new Error(localize("Errors.HirelingNotFound"));
    }

    const updated = {
      ...hireling,
      ...updates,
      id: hirelingId,
      updatedAt: Date.now()
    };

    this._hirelingCache.set(hirelingId, updated);
    await this._saveHirelings();

    Hooks.callAll(`${MODULE_ID}.hirelingUpdated`, updated);
    this._emitSocket("hirelingUpdated", { hireling: updated });

    return updated;
  }

  /**
   * Delete hireling
   * @param {string} hirelingId - Hireling ID
   */
  async deleteHireling(hirelingId) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    this._hirelingCache.delete(hirelingId);
    await this._saveHirelings();

    Hooks.callAll(`${MODULE_ID}.hirelingDeleted`, hirelingId);
  }

  // ==================== Hiring System ====================

  /**
   * Hire a hireling
   * @param {string} hirelingId - Hireling ID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {object} contractTerms - Contract terms
   * @returns {object} {success, hireling, contract, cost}
   */
  async hireHireling(hirelingId, playerActorUuid, contractTerms = {}) {
    const hireling = this._hirelingCache.get(hirelingId);
    if (!hireling) {
      return { success: false, error: localize("Errors.HirelingNotFound") };
    }

    if (hireling.status !== HirelingStatus.AVAILABLE) {
      return { success: false, error: localize("Errors.HirelingUnavailable") };
    }

    const player = await fromUuid(playerActorUuid);
    if (!player) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    // Check requirements
    if (!await this._meetsRequirements(player, hireling.requirements)) {
      return { success: false, error: localize("Errors.RequirementsNotMet") };
    }

    // Calculate cost
    const costInfo = calculateHiringCost(hireling, contractTerms);

    // Check funds
    const currency = player.system?.currency;
    if (currency) {
      const totalGold = this._calculateTotalGold(currency);
      if (totalGold < costInfo.total) {
        return {
          success: false,
          error: localize("Errors.InsufficientFunds"),
          required: costInfo.total,
          available: totalGold
        };
      }

      // Deduct payment
      await this._deductCurrency(player, costInfo.total);
    }

    // Create contract
    const contract = createContract({
      ...contractTerms,
      startDate: Date.now(),
      lastPayment: Date.now(),
      totalPaid: costInfo.total
    });

    // Calculate next payment due
    if (contract.type !== ContractType.PERMANENT && contract.type !== ContractType.QUEST) {
      contract.nextPaymentDue = this._calculateNextPaymentDue(contract);
    }

    // Update hireling
    hireling.status = HirelingStatus.HIRED;
    hireling.employer = playerActorUuid;
    hireling.contract = contract;
    hireling.updatedAt = Date.now();

    this._hirelingCache.set(hirelingId, hireling);
    await this._saveHirelings();

    // Update player cache
    this._addToPlayerHirelings(playerActorUuid, hirelingId);

    Hooks.callAll(`${MODULE_ID}.hirelingHired`, hireling, playerActorUuid, contract);
    this._emitSocket("hirelingHired", { hireling, playerActorUuid });

    ui.notifications.info(
      localize("Hirelings.Hired", { name: hireling.name })
    );

    return {
      success: true,
      hireling,
      contract,
      cost: costInfo
    };
  }

  /**
   * Calculate next payment due date
   * @param {object} contract - Contract
   * @returns {number} Timestamp
   * @private
   */
  _calculateNextPaymentDue(contract) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    switch (contract.type) {
      case ContractType.DAILY:
        return now + day;
      case ContractType.WEEKLY:
        return now + (day * 7);
      case ContractType.MONTHLY:
        return now + (day * 30);
      default:
        return null;
    }
  }

  /**
   * Dismiss a hireling
   * @param {string} hirelingId - Hireling ID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {object} options - Options
   * @returns {object}
   */
  async dismissHireling(hirelingId, playerActorUuid, options = {}) {
    const { returnEquipment = true, payOwed = true } = options;

    const hireling = this._hirelingCache.get(hirelingId);
    if (!hireling) {
      return { success: false, error: localize("Errors.HirelingNotFound") };
    }

    if (hireling.employer !== playerActorUuid) {
      return { success: false, error: localize("Errors.NotYourHireling") };
    }

    const player = await fromUuid(playerActorUuid);

    // Pay any owed wages
    if (payOwed && hireling.contract?.owedAmount > 0 && player) {
      const currency = player.system?.currency;
      if (currency) {
        const totalGold = this._calculateTotalGold(currency);
        if (totalGold >= hireling.contract.owedAmount) {
          await this._deductCurrency(player, hireling.contract.owedAmount);
        }
      }
    }

    // Return provided equipment
    if (returnEquipment && hireling.providedEquipment.length > 0) {
      // Just clear the list - actual item transfer would happen through other means
      hireling.providedEquipment = [];
    }

    // Archive employment
    if (hireling.contract) {
      hireling.employmentHistory.push({
        employer: playerActorUuid,
        contract: { ...hireling.contract },
        endDate: Date.now(),
        reason: "dismissed"
      });
    }

    // Update hireling
    hireling.status = HirelingStatus.AVAILABLE;
    hireling.employer = null;
    hireling.contract = null;
    hireling.loyalty = createLoyaltyTracker();
    hireling.updatedAt = Date.now();

    this._hirelingCache.set(hirelingId, hireling);
    await this._saveHirelings();

    // Update player cache
    this._removeFromPlayerHirelings(playerActorUuid, hirelingId);

    Hooks.callAll(`${MODULE_ID}.hirelingDismissed`, hireling, playerActorUuid);
    this._emitSocket("hirelingDismissed", { hirelingId, playerActorUuid });

    ui.notifications.info(
      localize("Hirelings.Dismissed", { name: hireling.name })
    );

    return { success: true, hireling };
  }

  /**
   * Get hirelings for a player
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object[]}
   */
  getPlayerHirelings(playerActorUuid) {
    const hirelings = [];
    for (const hireling of this._hirelingCache.values()) {
      if (hireling.employer === playerActorUuid &&
          hireling.status !== HirelingStatus.DISMISSED) {
        hirelings.push(hireling);
      }
    }
    return hirelings;
  }

  /**
   * Add hireling to player cache
   * @param {string} playerActorUuid - Player UUID
   * @param {string} hirelingId - Hireling ID
   * @private
   */
  _addToPlayerHirelings(playerActorUuid, hirelingId) {
    if (!this._playerHirelingsCache.has(playerActorUuid)) {
      this._playerHirelingsCache.set(playerActorUuid, new Set());
    }
    this._playerHirelingsCache.get(playerActorUuid).add(hirelingId);
  }

  /**
   * Remove hireling from player cache
   * @param {string} playerActorUuid - Player UUID
   * @param {string} hirelingId - Hireling ID
   * @private
   */
  _removeFromPlayerHirelings(playerActorUuid, hirelingId) {
    if (this._playerHirelingsCache.has(playerActorUuid)) {
      this._playerHirelingsCache.get(playerActorUuid).delete(hirelingId);
    }
  }

  // ==================== Loyalty Management ====================

  /**
   * Modify hireling loyalty
   * @param {string} hirelingId - Hireling ID
   * @param {number} amount - Amount to change
   * @param {string} reason - Reason for change
   * @returns {object} {hireling, previousLevel, newLevel, consequences}
   */
  async modifyLoyalty(hirelingId, amount, reason = "") {
    const hireling = this._hirelingCache.get(hirelingId);
    if (!hireling) {
      throw new Error(localize("Errors.HirelingNotFound"));
    }

    if (!hireling.loyalty) {
      hireling.loyalty = createLoyaltyTracker();
    }

    const previousLevel = hireling.loyalty.level;
    hireling.loyalty = modifyLoyalty(hireling.loyalty, amount, reason);
    const newLevel = hireling.loyalty.level;

    // Check for consequences
    const consequences = checkLoyaltyConsequences(hireling.loyalty);

    // Handle desertion
    if (consequences.willDesert) {
      await this._handleDesertion(hireling);
    }

    hireling.updatedAt = Date.now();
    this._hirelingCache.set(hirelingId, hireling);
    await this._saveHirelings();

    // Emit level change if applicable
    if (previousLevel !== newLevel) {
      Hooks.callAll(`${MODULE_ID}.loyaltyLevelChanged`, hireling, previousLevel, newLevel);
      this._emitSocket("loyaltyLevelChanged", {
        hirelingId,
        previousLevel,
        newLevel,
        employer: hireling.employer
      });
    }

    return {
      hireling,
      previousLevel,
      newLevel,
      consequences
    };
  }

  /**
   * Handle hireling desertion
   * @param {object} hireling - Hireling
   * @private
   */
  async _handleDesertion(hireling) {
    const employer = hireling.employer;

    // Archive employment
    if (hireling.contract) {
      hireling.employmentHistory.push({
        employer,
        contract: { ...hireling.contract },
        endDate: Date.now(),
        reason: "deserted"
      });
    }

    // Update status
    hireling.status = HirelingStatus.UNAVAILABLE;
    hireling.employer = null;
    hireling.contract = null;

    // Remove from player cache
    if (employer) {
      this._removeFromPlayerHirelings(employer, hireling.id);
    }

    Hooks.callAll(`${MODULE_ID}.hirelingDeserted`, hireling, employer);

    ui.notifications.warn(
      localize("Hirelings.Deserted", { name: hireling.name })
    );
  }

  /**
   * Apply loyalty modifier by type
   * @param {string} hirelingId - Hireling ID
   * @param {string} modifierType - Modifier type from loyalty.modifiers
   * @returns {object}
   */
  async applyLoyaltyModifier(hirelingId, modifierType) {
    const hireling = this._hirelingCache.get(hirelingId);
    if (!hireling || !hireling.loyalty) {
      throw new Error(localize("Errors.HirelingNotFound"));
    }

    const modifier = hireling.loyalty.modifiers[modifierType];
    if (modifier === undefined) {
      throw new Error(`Unknown modifier type: ${modifierType}`);
    }

    return this.modifyLoyalty(hirelingId, modifier, modifierType);
  }

  // ==================== Payment Processing ====================

  /**
   * Process wage payment
   * @param {string} hirelingId - Hireling ID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {number} amount - Amount to pay (null = full due)
   * @returns {object}
   */
  async payWages(hirelingId, playerActorUuid, amount = null) {
    const hireling = this._hirelingCache.get(hirelingId);
    if (!hireling) {
      return { success: false, error: localize("Errors.HirelingNotFound") };
    }

    if (hireling.employer !== playerActorUuid) {
      return { success: false, error: localize("Errors.NotYourHireling") };
    }

    if (!hireling.contract) {
      return { success: false, error: localize("Errors.NoContract") };
    }

    const player = await fromUuid(playerActorUuid);
    if (!player) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    // Calculate amount due
    const wage = hireling.contract.wage;
    const owed = hireling.contract.owedAmount || 0;
    const payAmount = amount ?? (wage + owed);

    // Check funds
    const currency = player.system?.currency;
    if (currency) {
      const totalGold = this._calculateTotalGold(currency);
      if (totalGold < payAmount) {
        return {
          success: false,
          error: localize("Errors.InsufficientFunds"),
          required: payAmount,
          available: totalGold
        };
      }

      await this._deductCurrency(player, payAmount);
    }

    // Update contract
    hireling.contract.lastPayment = Date.now();
    hireling.contract.totalPaid += payAmount;
    hireling.contract.owedAmount = Math.max(0, owed - (payAmount - wage));
    hireling.contract.nextPaymentDue = this._calculateNextPaymentDue(hireling.contract);

    // Loyalty bonus for on-time payment
    await this.applyLoyaltyModifier(hirelingId, "paidOnTime");

    hireling.updatedAt = Date.now();
    this._hirelingCache.set(hirelingId, hireling);
    await this._saveHirelings();

    Hooks.callAll(`${MODULE_ID}.wagesPaid`, hireling, payAmount);

    return {
      success: true,
      hireling,
      paid: payAmount,
      nextDue: hireling.contract.nextPaymentDue
    };
  }

  /**
   * Process missed payment
   * @param {string} hirelingId - Hireling ID
   */
  async processMissedPayment(hirelingId) {
    const hireling = this._hirelingCache.get(hirelingId);
    if (!hireling || !hireling.contract) return;

    // Add to owed amount
    hireling.contract.owedAmount += hireling.contract.wage;

    // Apply loyalty penalty
    const missedCount = Math.floor(hireling.contract.owedAmount / hireling.contract.wage);
    if (missedCount >= 2) {
      await this.applyLoyaltyModifier(hirelingId, "noPay");
    } else {
      await this.applyLoyaltyModifier(hirelingId, "latePay");
    }

    hireling.updatedAt = Date.now();
    this._hirelingCache.set(hirelingId, hireling);
    await this._saveHirelings();

    Hooks.callAll(`${MODULE_ID}.paymentMissed`, hireling);
  }

  /**
   * Check for due payments across all hirelings
   */
  async checkDuePayments() {
    const now = Date.now();

    for (const hireling of this._hirelingCache.values()) {
      if (hireling.status !== HirelingStatus.HIRED) continue;
      if (!hireling.contract?.nextPaymentDue) continue;

      if (now >= hireling.contract.nextPaymentDue) {
        await this.processMissedPayment(hireling.id);
      }
    }
  }

  // ==================== Hireling Inventory ====================

  /**
   * Add item to hireling inventory (porter)
   * @param {string} hirelingId - Hireling ID
   * @param {string} itemUuid - Item UUID
   * @returns {object}
   */
  async addToInventory(hirelingId, itemUuid) {
    const hireling = this._hirelingCache.get(hirelingId);
    if (!hireling) {
      throw new Error(localize("Errors.HirelingNotFound"));
    }

    if (!hireling.inventory.enabled) {
      throw new Error(localize("Errors.NoInventory"));
    }

    if (hireling.inventory.items.length >= hireling.inventory.maxSlots) {
      throw new Error(localize("Errors.InventoryFull"));
    }

    const item = await fromUuid(itemUuid);
    if (!item) {
      throw new Error(localize("Errors.ItemNotFound"));
    }

    // Check weight
    const itemWeight = item.system?.weight || 0;
    const currentWeight = await this._calculateInventoryWeight(hireling.inventory.items);
    if (currentWeight + itemWeight > hireling.inventory.maxWeight) {
      throw new Error(localize("Errors.TooHeavy"));
    }

    hireling.inventory.items.push(itemUuid);
    hireling.updatedAt = Date.now();

    this._hirelingCache.set(hirelingId, hireling);
    await this._saveHirelings();

    Hooks.callAll(`${MODULE_ID}.inventoryUpdated`, hireling);
    return { success: true, hireling };
  }

  /**
   * Remove item from hireling inventory
   * @param {string} hirelingId - Hireling ID
   * @param {string} itemUuid - Item UUID
   * @returns {object}
   */
  async removeFromInventory(hirelingId, itemUuid) {
    const hireling = this._hirelingCache.get(hirelingId);
    if (!hireling) {
      throw new Error(localize("Errors.HirelingNotFound"));
    }

    const index = hireling.inventory.items.indexOf(itemUuid);
    if (index === -1) {
      throw new Error(localize("Errors.ItemNotInInventory"));
    }

    hireling.inventory.items.splice(index, 1);
    hireling.updatedAt = Date.now();

    this._hirelingCache.set(hirelingId, hireling);
    await this._saveHirelings();

    Hooks.callAll(`${MODULE_ID}.inventoryUpdated`, hireling);
    return { success: true, hireling };
  }

  /**
   * Calculate inventory weight
   * @param {string[]} itemUuids - Item UUIDs
   * @returns {number} Total weight
   * @private
   */
  async _calculateInventoryWeight(itemUuids) {
    let total = 0;
    for (const uuid of itemUuids) {
      const item = await fromUuid(uuid);
      if (item) {
        total += item.system?.weight || 0;
      }
    }
    return total;
  }

  // ==================== Mount Management ====================

  /**
   * Create a new mount
   * @param {object} data - Mount data
   * @returns {object} Created mount
   */
  async createMount(data) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const mount = createMount(data);
    const validation = validateMount(mount);
    if (!validation.valid) {
      throw new Error(validation.errors.join(", "));
    }

    this._mountCache.set(mount.id, mount);
    await this._saveMounts();

    Hooks.callAll(`${MODULE_ID}.mountCreated`, mount);
    return mount;
  }

  /**
   * Create mount from template
   * @param {string} templateName - Template name
   * @param {object} overrides - Data overrides
   * @returns {object}
   */
  async createMountFromTemplate(templateName, overrides = {}) {
    const mount = createMountFromTemplate(templateName, overrides);
    this._mountCache.set(mount.id, mount);
    await this._saveMounts();

    Hooks.callAll(`${MODULE_ID}.mountCreated`, mount);
    return mount;
  }

  /**
   * Get mount by ID
   * @param {string} mountId - Mount ID
   * @returns {object|null}
   */
  getMount(mountId) {
    return this._mountCache.get(mountId) || null;
  }

  /**
   * Get all mounts
   * @returns {object[]}
   */
  getAllMounts() {
    return Array.from(this._mountCache.values());
  }

  /**
   * Purchase a mount
   * @param {string} mountId - Mount ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object}
   */
  async purchaseMount(mountId, playerActorUuid) {
    const mount = this._mountCache.get(mountId);
    if (!mount) {
      return { success: false, error: localize("Errors.MountNotFound") };
    }

    if (mount.owner && mount.owner !== playerActorUuid) {
      return { success: false, error: localize("Errors.MountOwned") };
    }

    const player = await fromUuid(playerActorUuid);
    if (!player) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    // Check requirements
    if (!await this._meetsRequirements(player, mount.requirements)) {
      return { success: false, error: localize("Errors.RequirementsNotMet") };
    }

    const cost = mount.pricing.purchase;

    // Check funds
    const currency = player.system?.currency;
    if (currency) {
      const totalGold = this._calculateTotalGold(currency);
      if (totalGold < cost) {
        return {
          success: false,
          error: localize("Errors.InsufficientFunds"),
          required: cost,
          available: totalGold
        };
      }

      await this._deductCurrency(player, cost);
    }

    // Update mount
    mount.owner = playerActorUuid;
    mount.status = HirelingStatus.HIRED;
    mount.isRented = false;
    mount.updatedAt = Date.now();

    this._mountCache.set(mountId, mount);
    await this._saveMounts();

    // Update player cache
    this._addToPlayerMounts(playerActorUuid, mountId);

    Hooks.callAll(`${MODULE_ID}.mountPurchased`, mount, playerActorUuid);
    this._emitSocket("mountPurchased", { mount, playerActorUuid });

    ui.notifications.info(
      localize("Mounts.Purchased", { name: mount.name })
    );

    return { success: true, mount, cost };
  }

  /**
   * Rent a mount
   * @param {string} mountId - Mount ID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {number} days - Number of days
   * @returns {object}
   */
  async rentMount(mountId, playerActorUuid, days = 1) {
    const mount = this._mountCache.get(mountId);
    if (!mount) {
      return { success: false, error: localize("Errors.MountNotFound") };
    }

    if (mount.status !== HirelingStatus.AVAILABLE) {
      return { success: false, error: localize("Errors.MountUnavailable") };
    }

    const player = await fromUuid(playerActorUuid);
    if (!player) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    const rentalCost = mount.pricing.rental * days;
    const deposit = mount.pricing.deposit;
    const totalCost = rentalCost + deposit;

    // Check funds
    const currency = player.system?.currency;
    if (currency) {
      const totalGold = this._calculateTotalGold(currency);
      if (totalGold < totalCost) {
        return {
          success: false,
          error: localize("Errors.InsufficientFunds"),
          required: totalCost,
          available: totalGold
        };
      }

      await this._deductCurrency(player, totalCost);
    }

    // Update mount
    mount.owner = playerActorUuid;
    mount.status = HirelingStatus.HIRED;
    mount.isRented = true;
    mount.rentalExpires = Date.now() + (days * 24 * 60 * 60 * 1000);
    mount.updatedAt = Date.now();

    this._mountCache.set(mountId, mount);
    await this._saveMounts();

    this._addToPlayerMounts(playerActorUuid, mountId);

    Hooks.callAll(`${MODULE_ID}.mountRented`, mount, playerActorUuid, days);

    ui.notifications.info(
      localize("Mounts.Rented", { name: mount.name, days })
    );

    return { success: true, mount, cost: totalCost, deposit };
  }

  /**
   * Return a rented mount
   * @param {string} mountId - Mount ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object}
   */
  async returnMount(mountId, playerActorUuid) {
    const mount = this._mountCache.get(mountId);
    if (!mount) {
      return { success: false, error: localize("Errors.MountNotFound") };
    }

    if (mount.owner !== playerActorUuid) {
      return { success: false, error: localize("Errors.NotYourMount") };
    }

    if (!mount.isRented) {
      return { success: false, error: localize("Errors.MountNotRented") };
    }

    const player = await fromUuid(playerActorUuid);

    // Return deposit (if mount is in good condition)
    if (player && mount.condition.health >= 80 && !mount.condition.injured) {
      const currency = player.system?.currency;
      if (currency) {
        await this._addCurrency(player, mount.pricing.deposit);
      }
    }

    // Reset mount
    mount.owner = null;
    mount.status = HirelingStatus.AVAILABLE;
    mount.isRented = false;
    mount.rentalExpires = null;
    mount.updatedAt = Date.now();

    this._mountCache.set(mountId, mount);
    await this._saveMounts();

    this._removeFromPlayerMounts(playerActorUuid, mountId);

    Hooks.callAll(`${MODULE_ID}.mountReturned`, mount, playerActorUuid);

    ui.notifications.info(
      localize("Mounts.Returned", { name: mount.name })
    );

    return { success: true, mount };
  }

  /**
   * Get mounts for a player
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object[]}
   */
  getPlayerMounts(playerActorUuid) {
    const mounts = [];
    for (const mount of this._mountCache.values()) {
      if (mount.owner === playerActorUuid) {
        mounts.push(mount);
      }
    }
    return mounts;
  }

  /**
   * Add mount to player cache
   * @private
   */
  _addToPlayerMounts(playerActorUuid, mountId) {
    if (!this._playerMountsCache.has(playerActorUuid)) {
      this._playerMountsCache.set(playerActorUuid, new Set());
    }
    this._playerMountsCache.get(playerActorUuid).add(mountId);
  }

  /**
   * Remove mount from player cache
   * @private
   */
  _removeFromPlayerMounts(playerActorUuid, mountId) {
    if (this._playerMountsCache.has(playerActorUuid)) {
      this._playerMountsCache.get(playerActorUuid).delete(mountId);
    }
  }

  // ==================== Stable Management ====================

  /**
   * Create stable configuration
   * @param {object} data - Stable data
   * @returns {object}
   */
  async createStable(data) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const stable = createStableConfig(data);
    this._stableCache.set(stable.npcActorUuid, stable);
    await this._saveStables();

    Hooks.callAll(`${MODULE_ID}.stableCreated`, stable);
    return stable;
  }

  /**
   * Get stable by NPC UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @returns {object|null}
   */
  getStable(npcActorUuid) {
    return this._stableCache.get(npcActorUuid) || null;
  }

  /**
   * Stable a mount
   * @param {string} stableNpcUuid - Stable NPC UUID
   * @param {string} mountId - Mount ID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {number} days - Days to stable
   * @returns {object}
   */
  async stableMount(stableNpcUuid, mountId, playerActorUuid, days = 7) {
    const stable = this._stableCache.get(stableNpcUuid);
    if (!stable) {
      return { success: false, error: localize("Errors.StableNotFound") };
    }

    if (!stable.services.stabling) {
      return { success: false, error: localize("Errors.StablingUnavailable") };
    }

    const mount = this._mountCache.get(mountId);
    if (!mount || mount.owner !== playerActorUuid) {
      return { success: false, error: localize("Errors.NotYourMount") };
    }

    // Check capacity
    if (stable.currentOccupancy >= stable.maxCapacity) {
      return { success: false, error: localize("Errors.StableFull") };
    }

    const player = await fromUuid(playerActorUuid);
    const cost = stable.pricing.stablingPerDay * days;

    // Check funds
    if (player) {
      const currency = player.system?.currency;
      if (currency) {
        const totalGold = this._calculateTotalGold(currency);
        if (totalGold < cost) {
          return {
            success: false,
            error: localize("Errors.InsufficientFunds"),
            required: cost,
            available: totalGold
          };
        }

        await this._deductCurrency(player, cost);
      }
    }

    // Update mount
    mount.stablingPaidUntil = Date.now() + (days * 24 * 60 * 60 * 1000);
    mount.status = HirelingStatus.UNAVAILABLE;
    this._mountCache.set(mountId, mount);
    await this._saveMounts();

    // Update stable
    if (!stable.stabledMounts[playerActorUuid]) {
      stable.stabledMounts[playerActorUuid] = [];
    }
    if (!stable.stabledMounts[playerActorUuid].includes(mountId)) {
      stable.stabledMounts[playerActorUuid].push(mountId);
      stable.currentOccupancy++;
    }
    this._stableCache.set(stableNpcUuid, stable);
    await this._saveStables();

    Hooks.callAll(`${MODULE_ID}.mountStabled`, mount, stableNpcUuid, days);

    return { success: true, mount, cost, paidUntil: mount.stablingPaidUntil };
  }

  /**
   * Retrieve mount from stable
   * @param {string} stableNpcUuid - Stable NPC UUID
   * @param {string} mountId - Mount ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object}
   */
  async retrieveMount(stableNpcUuid, mountId, playerActorUuid) {
    const stable = this._stableCache.get(stableNpcUuid);
    if (!stable) {
      return { success: false, error: localize("Errors.StableNotFound") };
    }

    const mount = this._mountCache.get(mountId);
    if (!mount || mount.owner !== playerActorUuid) {
      return { success: false, error: localize("Errors.NotYourMount") };
    }

    // Update mount
    mount.status = HirelingStatus.HIRED;
    this._mountCache.set(mountId, mount);
    await this._saveMounts();

    // Update stable
    if (stable.stabledMounts[playerActorUuid]) {
      const index = stable.stabledMounts[playerActorUuid].indexOf(mountId);
      if (index > -1) {
        stable.stabledMounts[playerActorUuid].splice(index, 1);
        stable.currentOccupancy--;
      }
    }
    this._stableCache.set(stableNpcUuid, stable);
    await this._saveStables();

    Hooks.callAll(`${MODULE_ID}.mountRetrieved`, mount, stableNpcUuid);

    return { success: true, mount };
  }

  // ==================== Currency Helpers ====================

  /**
   * Calculate total gold from currency
   * @private
   */
  _calculateTotalGold(currency) {
    return (
      (currency.pp || 0) * 10 +
      (currency.gp || 0) +
      (currency.ep || 0) * 0.5 +
      (currency.sp || 0) * 0.1 +
      (currency.cp || 0) * 0.01
    );
  }

  /**
   * Deduct currency from actor
   * @private
   */
  async _deductCurrency(actor, amount) {
    const currency = { ...actor.system.currency };
    let remaining = amount;

    const denominations = [
      { key: "cp", rate: 0.01 },
      { key: "sp", rate: 0.1 },
      { key: "ep", rate: 0.5 },
      { key: "gp", rate: 1 },
      { key: "pp", rate: 10 }
    ];

    for (const { key, rate } of denominations) {
      if (remaining <= 0) break;
      const available = currency[key] || 0;
      const deductCoins = Math.min(available, Math.ceil(remaining / rate));
      const deductValue = deductCoins * rate;

      if (deductValue <= remaining + 0.001) {
        currency[key] = available - deductCoins;
        remaining -= deductValue;
      }
    }

    await actor.update({ "system.currency": currency });
  }

  /**
   * Add currency to actor
   * @private
   */
  async _addCurrency(actor, amount) {
    const currency = { ...actor.system.currency };
    currency.gp = (currency.gp || 0) + Math.floor(amount);
    await actor.update({ "system.currency": currency });
  }

  // ==================== Socket Handling ====================

  /**
   * Emit socket event
   * @private
   */
  _emitSocket(event, data) {
    if (game.socket) {
      game.socket.emit(`module.${MODULE_ID}`, {
        type: `hireling.${event}`,
        ...data
      });
    }
  }

  /**
   * Handle incoming socket events
   * @param {object} data - Socket data
   */
  async handleSocket(data) {
    const { type } = data;

    switch (type) {
      case "hireling.hirelingHired":
      case "hireling.hirelingDismissed":
      case "hireling.hirelingUpdated":
        if (!game.user.isGM) {
          await this._loadHirelings();
        }
        break;

      case "hireling.mountPurchased":
      case "hireling.mountRented":
        if (!game.user.isGM) {
          await this._loadMounts();
        }
        break;

      case "hireling.loyaltyLevelChanged":
        Hooks.callAll(`${MODULE_ID}.loyaltyLevelChanged`,
          data.hirelingId, data.previousLevel, data.newLevel);
        break;
    }
  }

  // ==================== Data Export/Import ====================

  /**
   * Export all hireling/mount data
   * @returns {object}
   */
  exportData() {
    return {
      hirelings: Object.fromEntries(this._hirelingCache),
      mounts: Object.fromEntries(this._mountCache),
      stables: Object.fromEntries(this._stableCache)
    };
  }

  /**
   * Import hireling/mount data
   * @param {object} data - Import data
   */
  async importData(data) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    if (data.hirelings) {
      this._hirelingCache.clear();
      for (const [id, hireling] of Object.entries(data.hirelings)) {
        this._hirelingCache.set(id, hireling);
      }
      await this._saveHirelings();
    }

    if (data.mounts) {
      this._mountCache.clear();
      for (const [id, mount] of Object.entries(data.mounts)) {
        this._mountCache.set(id, mount);
      }
      await this._saveMounts();
    }

    if (data.stables) {
      this._stableCache.clear();
      for (const [id, stable] of Object.entries(data.stables)) {
        this._stableCache.set(id, stable);
      }
      await this._saveStables();
    }
  }
}

// Singleton instance
export const hirelingHandler = new HirelingHandler();
