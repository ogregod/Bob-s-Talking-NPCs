/**
 * Bob's Talking NPCs - Property Handler
 * Business logic for player-owned properties, housing, businesses, and upgrades
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";
import { localize, getFlag, setFlag, generateId } from "../utils/helpers.mjs";
import {
  PropertyType,
  PropertyStatus,
  UpgradeType,
  createProperty,
  createPropertyFromTemplate,
  createUpgrade,
  createStaffMember,
  createStorageConfig,
  createPropertyFinances,
  calculateStorageCapacity,
  calculateWeeklyExpenses,
  calculateWeeklyIncome,
  applyConditionDecay,
  checkUpgradeRequirements,
  getRestBonus,
  validateProperty
} from "../data/property-model.mjs";

/**
 * Property Handler class
 * Manages all property, housing, and business operations
 */
export class PropertyHandler {
  constructor() {
    this._initialized = false;
    this._propertyCache = new Map();
    this._playerPropertiesCache = new Map();
  }

  /**
   * Initialize the property handler
   */
  async initialize() {
    if (this._initialized) return;

    await this._loadProperties();

    this._initialized = true;
    console.log(`${MODULE_ID} | Property handler initialized`);
  }

  // ==================== Data Loading ====================

  /**
   * Load all properties from world settings
   * @private
   */
  async _loadProperties() {
    const properties = game.settings.get(MODULE_ID, "properties") || {};
    this._propertyCache.clear();
    this._playerPropertiesCache.clear();

    for (const [id, data] of Object.entries(properties)) {
      this._propertyCache.set(id, data);

      // Build player cache
      if (data.ownership?.ownerUuid) {
        this._addToPlayerCache(data.ownership.ownerUuid, id);
      }
    }
  }

  /**
   * Save properties to world settings
   * @private
   */
  async _saveProperties() {
    const data = Object.fromEntries(this._propertyCache);
    await game.settings.set(MODULE_ID, "properties", data);
  }

  /**
   * Add property to player cache
   * @private
   */
  _addToPlayerCache(playerUuid, propertyId) {
    if (!this._playerPropertiesCache.has(playerUuid)) {
      this._playerPropertiesCache.set(playerUuid, new Set());
    }
    this._playerPropertiesCache.get(playerUuid).add(propertyId);
  }

  /**
   * Remove property from player cache
   * @private
   */
  _removeFromPlayerCache(playerUuid, propertyId) {
    if (this._playerPropertiesCache.has(playerUuid)) {
      this._playerPropertiesCache.get(playerUuid).delete(propertyId);
    }
  }

  // ==================== Property Management ====================

  /**
   * Create a new property
   * @param {object} data - Property data
   * @returns {object} Created property
   */
  async createProperty(data) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const property = createProperty(data);
    const validation = validateProperty(property);
    if (!validation.valid) {
      throw new Error(validation.errors.join(", "));
    }

    this._propertyCache.set(property.id, property);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.propertyCreated`, property);
    return property;
  }

  /**
   * Create property from template
   * @param {string} templateName - Template name
   * @param {object} overrides - Data overrides
   * @returns {object}
   */
  async createPropertyFromTemplate(templateName, overrides = {}) {
    const property = createPropertyFromTemplate(templateName, overrides);
    this._propertyCache.set(property.id, property);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.propertyCreated`, property);
    return property;
  }

  /**
   * Get property by ID
   * @param {string} propertyId - Property ID
   * @returns {object|null}
   */
  getProperty(propertyId) {
    return this._propertyCache.get(propertyId) || null;
  }

  /**
   * Get all properties
   * @returns {object[]}
   */
  getAllProperties() {
    return Array.from(this._propertyCache.values());
  }

  /**
   * Get available properties for purchase/rent
   * @param {object} options - Filter options
   * @returns {object[]}
   */
  getAvailableProperties(options = {}) {
    const { type, maxPrice, region } = options;
    const available = [];

    for (const property of this._propertyCache.values()) {
      if (property.status !== PropertyStatus.AVAILABLE) continue;

      if (type && property.type !== type) continue;
      if (maxPrice && property.pricing.purchasePrice > maxPrice) continue;
      if (region && property.location.region !== region) continue;

      available.push(property);
    }

    return available;
  }

  /**
   * Get properties for a player
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object[]}
   */
  getPlayerProperties(playerActorUuid) {
    const properties = [];
    for (const property of this._propertyCache.values()) {
      if (property.ownership?.ownerUuid === playerActorUuid ||
          property.ownership?.coOwners?.includes(playerActorUuid)) {
        properties.push(property);
      }
    }
    return properties;
  }

  /**
   * Update property
   * @param {string} propertyId - Property ID
   * @param {object} updates - Updates to apply
   * @returns {object} Updated property
   */
  async updateProperty(propertyId, updates) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      throw new Error(localize("Errors.PropertyNotFound"));
    }

    const updated = {
      ...property,
      ...updates,
      id: propertyId,
      updatedAt: Date.now()
    };

    this._propertyCache.set(propertyId, updated);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.propertyUpdated`, updated);
    this._emitSocket("propertyUpdated", { property: updated });

    return updated;
  }

  /**
   * Delete property
   * @param {string} propertyId - Property ID
   */
  async deleteProperty(propertyId) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const property = this._propertyCache.get(propertyId);
    if (property?.ownership?.ownerUuid) {
      this._removeFromPlayerCache(property.ownership.ownerUuid, propertyId);
    }

    this._propertyCache.delete(propertyId);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.propertyDeleted`, propertyId);
  }

  // ==================== Purchase & Rental ====================

  /**
   * Purchase a property
   * @param {string} propertyId - Property ID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {object} options - Purchase options
   * @returns {object}
   */
  async purchaseProperty(propertyId, playerActorUuid, options = {}) {
    const { useMortgage = false, coOwners = [] } = options;

    const property = this._propertyCache.get(propertyId);
    if (!property) {
      return { success: false, error: localize("Errors.PropertyNotFound") };
    }

    if (property.status !== PropertyStatus.AVAILABLE) {
      return { success: false, error: localize("Errors.PropertyUnavailable") };
    }

    const player = await fromUuid(playerActorUuid);
    if (!player) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    // Check requirements
    if (!await this._meetsRequirements(player, property.requirements)) {
      return { success: false, error: localize("Errors.RequirementsNotMet") };
    }

    let totalCost = property.pricing.purchasePrice;
    let mortgageData = null;

    // Handle mortgage
    if (useMortgage && property.pricing.mortgageAvailable) {
      const downPayment = Math.ceil(totalCost * property.pricing.mortgageDownPayment);
      mortgageData = {
        enabled: true,
        totalAmount: totalCost - downPayment,
        remainingAmount: totalCost - downPayment,
        paymentAmount: Math.ceil((totalCost - downPayment) / 52), // Weekly payments for 1 year
        paymentFrequency: "weekly",
        interestRate: 0.05,
        missedPayments: 0
      };
      totalCost = downPayment;
    }

    // Check and deduct funds
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

    // Update property
    property.status = PropertyStatus.OWNED;
    property.ownership = {
      ownerUuid: playerActorUuid,
      ownerName: player.name,
      coOwners,
      purchaseDate: Date.now(),
      purchasePrice: property.pricing.purchasePrice
    };

    if (mortgageData) {
      property.finances.mortgage = mortgageData;
    }

    property.updatedAt = Date.now();
    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    // Update player cache
    this._addToPlayerCache(playerActorUuid, propertyId);

    Hooks.callAll(`${MODULE_ID}.propertyPurchased`, property, playerActorUuid);
    this._emitSocket("propertyPurchased", { property, playerActorUuid });

    ui.notifications.info(
      localize("Property.Purchased", { name: property.name })
    );

    return {
      success: true,
      property,
      cost: totalCost,
      mortgage: mortgageData
    };
  }

  /**
   * Rent a property
   * @param {string} propertyId - Property ID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {number} weeks - Number of weeks
   * @returns {object}
   */
  async rentProperty(propertyId, playerActorUuid, weeks = 4) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      return { success: false, error: localize("Errors.PropertyNotFound") };
    }

    if (property.status !== PropertyStatus.AVAILABLE) {
      return { success: false, error: localize("Errors.PropertyUnavailable") };
    }

    const player = await fromUuid(playerActorUuid);
    if (!player) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    const rentCost = property.pricing.rentalPrice * weeks;
    const deposit = property.rental.deposit || Math.ceil(property.pricing.rentalPrice * 2);
    const totalCost = rentCost + deposit;

    // Check and deduct funds
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

    // Calculate dates
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    // Update property
    property.status = PropertyStatus.RENTED;
    property.rental = {
      ...property.rental,
      isRented: true,
      rentAmount: property.pricing.rentalPrice,
      rentFrequency: "weekly",
      rentDueDate: now + weekMs,
      leaseEnds: now + (weeks * weekMs),
      deposit
    };
    property.ownership = {
      ownerUuid: playerActorUuid,
      ownerName: player.name,
      coOwners: [],
      purchaseDate: null,
      purchasePrice: 0
    };

    property.updatedAt = Date.now();
    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    this._addToPlayerCache(playerActorUuid, propertyId);

    Hooks.callAll(`${MODULE_ID}.propertyRented`, property, playerActorUuid, weeks);

    ui.notifications.info(
      localize("Property.Rented", { name: property.name, weeks })
    );

    return {
      success: true,
      property,
      cost: totalCost,
      deposit,
      leaseEnds: property.rental.leaseEnds
    };
  }

  /**
   * Sell a property
   * @param {string} propertyId - Property ID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {number} sellPrice - Sell price (null = market value)
   * @returns {object}
   */
  async sellProperty(propertyId, playerActorUuid, sellPrice = null) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      return { success: false, error: localize("Errors.PropertyNotFound") };
    }

    if (property.ownership?.ownerUuid !== playerActorUuid) {
      return { success: false, error: localize("Errors.NotYourProperty") };
    }

    if (property.rental?.isRented) {
      return { success: false, error: localize("Errors.PropertyRented") };
    }

    const player = await fromUuid(playerActorUuid);
    if (!player) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    // Calculate sale price
    const marketValue = property.pricing.appraisedValue || property.pricing.purchasePrice;
    const conditionMultiplier = property.condition.overall / 100;
    const basePrice = sellPrice ?? Math.floor(marketValue * conditionMultiplier * 0.8);

    // Pay off mortgage if any
    let mortgageDeduction = 0;
    if (property.finances.mortgage?.enabled && property.finances.mortgage.remainingAmount > 0) {
      mortgageDeduction = property.finances.mortgage.remainingAmount;
    }

    const netProceeds = Math.max(0, basePrice - mortgageDeduction);

    // Add currency to player
    if (netProceeds > 0) {
      await this._addCurrency(player, netProceeds);
    }

    // Reset property
    property.status = PropertyStatus.AVAILABLE;
    property.ownership = {
      ownerUuid: null,
      ownerName: null,
      coOwners: [],
      purchaseDate: null,
      purchasePrice: 0
    };
    property.finances.mortgage = {
      enabled: false,
      totalAmount: 0,
      remainingAmount: 0,
      paymentAmount: 0,
      missedPayments: 0
    };

    property.updatedAt = Date.now();
    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    this._removeFromPlayerCache(playerActorUuid, propertyId);

    Hooks.callAll(`${MODULE_ID}.propertySold`, property, playerActorUuid, netProceeds);

    ui.notifications.info(
      localize("Property.Sold", { name: property.name, amount: netProceeds })
    );

    return {
      success: true,
      property,
      salePrice: basePrice,
      mortgageDeduction,
      netProceeds
    };
  }

  /**
   * End rental lease
   * @param {string} propertyId - Property ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object}
   */
  async endLease(propertyId, playerActorUuid) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      return { success: false, error: localize("Errors.PropertyNotFound") };
    }

    if (property.ownership?.ownerUuid !== playerActorUuid || !property.rental?.isRented) {
      return { success: false, error: localize("Errors.NotYourRental") };
    }

    const player = await fromUuid(playerActorUuid);

    // Return deposit if property in good condition
    let depositReturn = 0;
    if (player && property.condition.overall >= 80 && property.condition.cleanliness >= 60) {
      depositReturn = property.rental.deposit;
      await this._addCurrency(player, depositReturn);
    }

    // Reset property
    property.status = PropertyStatus.AVAILABLE;
    property.ownership = {
      ownerUuid: null,
      ownerName: null,
      coOwners: [],
      purchaseDate: null,
      purchasePrice: 0
    };
    property.rental = {
      ...property.rental,
      isRented: false,
      rentDueDate: null,
      leaseEnds: null
    };

    property.updatedAt = Date.now();
    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    this._removeFromPlayerCache(playerActorUuid, propertyId);

    Hooks.callAll(`${MODULE_ID}.leaseEnded`, property, playerActorUuid);

    return {
      success: true,
      property,
      depositReturned: depositReturn
    };
  }

  // ==================== Upgrades ====================

  /**
   * Install an upgrade on a property
   * @param {string} propertyId - Property ID
   * @param {string} upgradeId - Upgrade ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object}
   */
  async installUpgrade(propertyId, upgradeId, playerActorUuid) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      return { success: false, error: localize("Errors.PropertyNotFound") };
    }

    if (property.ownership?.ownerUuid !== playerActorUuid) {
      return { success: false, error: localize("Errors.NotYourProperty") };
    }

    const upgrade = property.availableUpgrades.find(u => u.id === upgradeId);
    if (!upgrade) {
      return { success: false, error: localize("Errors.UpgradeNotFound") };
    }

    const player = await fromUuid(playerActorUuid);
    if (!player) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    // Check requirements
    const playerLevel = player.system?.details?.level || 0;
    const currency = player.system?.currency;
    const gold = currency ? this._calculateTotalGold(currency) : 0;

    const reqCheck = checkUpgradeRequirements(property, upgrade, { playerLevel, gold });
    if (!reqCheck.canInstall) {
      return {
        success: false,
        error: localize("Errors.RequirementsNotMet"),
        reasons: reqCheck.reasons
      };
    }

    // Deduct cost
    if (upgrade.cost.gold > 0 && currency) {
      await this._deductCurrency(player, upgrade.cost.gold);
    }

    // Handle construction time
    if (upgrade.cost.laborDays > 0) {
      property.upgradeInProgress = upgradeId;
      property.upgradeCompletionDate = Date.now() + (upgrade.cost.laborDays * 24 * 60 * 60 * 1000);
    } else {
      // Instant install
      property.installedUpgrades.push(upgradeId);

      // Apply effects
      if (upgrade.effects.storageBonus) {
        property.storage.bonusSlots += upgrade.effects.storageBonus;
      }
      if (upgrade.effects.staffSlots) {
        property.staff.maxSlots += upgrade.effects.staffSlots;
      }
    }

    property.updatedAt = Date.now();
    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.upgradeInstalled`, property, upgrade);

    ui.notifications.info(
      localize("Property.UpgradeInstalled", { name: upgrade.name })
    );

    return {
      success: true,
      property,
      upgrade,
      constructionTime: upgrade.cost.laborDays
    };
  }

  /**
   * Complete pending upgrade
   * @param {string} propertyId - Property ID
   * @returns {object}
   */
  async completeUpgrade(propertyId) {
    const property = this._propertyCache.get(propertyId);
    if (!property || !property.upgradeInProgress) {
      return { success: false, error: localize("Errors.NoUpgradeInProgress") };
    }

    const upgradeId = property.upgradeInProgress;
    const upgrade = property.availableUpgrades.find(u => u.id === upgradeId);

    property.installedUpgrades.push(upgradeId);
    property.upgradeInProgress = null;
    property.upgradeCompletionDate = null;

    // Apply effects
    if (upgrade?.effects.storageBonus) {
      property.storage.bonusSlots += upgrade.effects.storageBonus;
    }
    if (upgrade?.effects.staffSlots) {
      property.staff.maxSlots += upgrade.effects.staffSlots;
    }

    property.updatedAt = Date.now();
    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.upgradeCompleted`, property, upgrade);

    return { success: true, property, upgrade };
  }

  /**
   * Get available upgrades for a property
   * @param {string} propertyId - Property ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object[]}
   */
  async getAvailableUpgrades(propertyId, playerActorUuid = null) {
    const property = this._propertyCache.get(propertyId);
    if (!property) return [];

    let context = {};
    if (playerActorUuid) {
      const player = await fromUuid(playerActorUuid);
      if (player) {
        context = {
          playerLevel: player.system?.details?.level || 0,
          gold: player.system?.currency ? this._calculateTotalGold(player.system.currency) : 0
        };
      }
    }

    const available = [];
    for (const upgrade of property.availableUpgrades) {
      const reqCheck = checkUpgradeRequirements(property, upgrade, context);
      available.push({
        ...upgrade,
        canInstall: reqCheck.canInstall,
        blockedReasons: reqCheck.reasons
      });
    }

    return available;
  }

  // ==================== Staff Management ====================

  /**
   * Hire staff for property
   * @param {string} propertyId - Property ID
   * @param {object} staffData - Staff member data
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object}
   */
  async hireStaff(propertyId, staffData, playerActorUuid) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      return { success: false, error: localize("Errors.PropertyNotFound") };
    }

    if (property.ownership?.ownerUuid !== playerActorUuid) {
      return { success: false, error: localize("Errors.NotYourProperty") };
    }

    if (property.staff.members.length >= property.staff.maxSlots) {
      return { success: false, error: localize("Errors.StaffFull") };
    }

    const staff = createStaffMember(staffData);
    property.staff.members.push(staff);

    // Update expense tracking
    property.finances.expenses.staffWages += staff.wage;

    property.updatedAt = Date.now();
    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.staffHired`, property, staff);

    return { success: true, property, staff };
  }

  /**
   * Fire staff from property
   * @param {string} propertyId - Property ID
   * @param {string} staffId - Staff member ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object}
   */
  async fireStaff(propertyId, staffId, playerActorUuid) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      return { success: false, error: localize("Errors.PropertyNotFound") };
    }

    if (property.ownership?.ownerUuid !== playerActorUuid) {
      return { success: false, error: localize("Errors.NotYourProperty") };
    }

    const staffIndex = property.staff.members.findIndex(s => s.id === staffId);
    if (staffIndex === -1) {
      return { success: false, error: localize("Errors.StaffNotFound") };
    }

    const staff = property.staff.members[staffIndex];
    property.staff.members.splice(staffIndex, 1);

    // Update expense tracking
    property.finances.expenses.staffWages -= staff.wage;

    property.updatedAt = Date.now();
    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.staffFired`, property, staff);

    return { success: true, property, staff };
  }

  /**
   * Pay staff wages
   * @param {string} propertyId - Property ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object}
   */
  async payStaffWages(propertyId, playerActorUuid) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      return { success: false, error: localize("Errors.PropertyNotFound") };
    }

    const player = await fromUuid(playerActorUuid);
    if (!player) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    const totalWages = property.staff.members.reduce((sum, s) => sum + s.wage, 0);
    if (totalWages === 0) {
      return { success: true, paid: 0 };
    }

    const currency = player.system?.currency;
    if (currency) {
      const totalGold = this._calculateTotalGold(currency);
      if (totalGold < totalWages) {
        return {
          success: false,
          error: localize("Errors.InsufficientFunds"),
          required: totalWages,
          available: totalGold
        };
      }

      await this._deductCurrency(player, totalWages);
    }

    // Update last paid for all staff
    const now = Date.now();
    for (const staff of property.staff.members) {
      staff.lastPaid = now;
      // Slight loyalty boost
      staff.loyalty = Math.min(100, staff.loyalty + 2);
    }

    property.finances.expenses.lastPayment = now;
    property.updatedAt = Date.now();

    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.staffPaid`, property, totalWages);

    return { success: true, paid: totalWages };
  }

  // ==================== Storage ====================

  /**
   * Add item to property storage
   * @param {string} propertyId - Property ID
   * @param {string} containerId - Container ID (null for main storage)
   * @param {string} itemUuid - Item UUID
   * @returns {object}
   */
  async addToStorage(propertyId, containerId, itemUuid) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      throw new Error(localize("Errors.PropertyNotFound"));
    }

    if (!property.storage.enabled) {
      throw new Error(localize("Errors.StorageDisabled"));
    }

    const capacity = calculateStorageCapacity(property);

    if (containerId) {
      // Add to specific container
      const container = property.storage.containers.find(c => c.id === containerId);
      if (!container) {
        throw new Error(localize("Errors.ContainerNotFound"));
      }

      if (container.items.length >= container.slots) {
        throw new Error(localize("Errors.ContainerFull"));
      }

      container.items.push(itemUuid);
    } else {
      // Count items in main storage (not in containers)
      const mainItems = this._getMainStorageItems(property);
      if (mainItems.length >= property.storage.baseSlots + property.storage.bonusSlots) {
        throw new Error(localize("Errors.StorageFull"));
      }

      // Add to first available container or create implicit storage
      if (!property.storage._mainItems) {
        property.storage._mainItems = [];
      }
      property.storage._mainItems.push(itemUuid);
    }

    property.updatedAt = Date.now();
    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.storageUpdated`, property);
    return { success: true, property };
  }

  /**
   * Remove item from property storage
   * @param {string} propertyId - Property ID
   * @param {string} itemUuid - Item UUID
   * @returns {object}
   */
  async removeFromStorage(propertyId, itemUuid) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      throw new Error(localize("Errors.PropertyNotFound"));
    }

    // Check all containers
    for (const container of property.storage.containers) {
      const index = container.items.indexOf(itemUuid);
      if (index !== -1) {
        container.items.splice(index, 1);
        property.updatedAt = Date.now();
        this._propertyCache.set(propertyId, property);
        await this._saveProperties();
        return { success: true, property };
      }
    }

    // Check main storage
    if (property.storage._mainItems) {
      const index = property.storage._mainItems.indexOf(itemUuid);
      if (index !== -1) {
        property.storage._mainItems.splice(index, 1);
        property.updatedAt = Date.now();
        this._propertyCache.set(propertyId, property);
        await this._saveProperties();
        return { success: true, property };
      }
    }

    throw new Error(localize("Errors.ItemNotInStorage"));
  }

  /**
   * Get all items in main storage
   * @param {object} property - Property
   * @returns {string[]} Item UUIDs
   * @private
   */
  _getMainStorageItems(property) {
    return property.storage._mainItems || [];
  }

  /**
   * Get storage summary for property
   * @param {string} propertyId - Property ID
   * @returns {object}
   */
  getStorageSummary(propertyId) {
    const property = this._propertyCache.get(propertyId);
    if (!property) return null;

    const capacity = calculateStorageCapacity(property);
    let usedSlots = (property.storage._mainItems || []).length;

    for (const container of property.storage.containers) {
      usedSlots += container.items.length;
    }

    return {
      totalSlots: capacity.slots,
      usedSlots,
      availableSlots: capacity.slots - usedSlots,
      maxWeight: capacity.weight,
      containers: property.storage.containers.map(c => ({
        id: c.id,
        name: c.name,
        slots: c.slots,
        used: c.items.length,
        locked: c.locked
      }))
    };
  }

  // ==================== Finances ====================

  /**
   * Collect property income
   * @param {string} propertyId - Property ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object}
   */
  async collectIncome(propertyId, playerActorUuid) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      return { success: false, error: localize("Errors.PropertyNotFound") };
    }

    if (property.ownership?.ownerUuid !== playerActorUuid) {
      return { success: false, error: localize("Errors.NotYourProperty") };
    }

    if (!property.finances.income.enabled) {
      return { success: false, error: localize("Errors.NoIncome") };
    }

    const player = await fromUuid(playerActorUuid);
    if (!player) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    const income = calculateWeeklyIncome(property) + property.finances.income.pendingAmount;
    if (income <= 0) {
      return { success: false, error: localize("Errors.NoIncomeAvailable") };
    }

    // Add to player currency
    await this._addCurrency(player, income);

    // Update property
    property.finances.income.lastCollection = Date.now();
    property.finances.income.pendingAmount = 0;

    property.updatedAt = Date.now();
    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.incomeCollected`, property, income);

    return { success: true, collected: income };
  }

  /**
   * Pay property expenses
   * @param {string} propertyId - Property ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object}
   */
  async payExpenses(propertyId, playerActorUuid) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      return { success: false, error: localize("Errors.PropertyNotFound") };
    }

    const player = await fromUuid(playerActorUuid);
    if (!player) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    const expenses = calculateWeeklyExpenses(property);
    const totalDue = expenses.total + property.finances.expenses.overdueAmount;

    if (totalDue === 0) {
      return { success: true, paid: 0 };
    }

    const currency = player.system?.currency;
    if (currency) {
      const totalGold = this._calculateTotalGold(currency);
      if (totalGold < totalDue) {
        // Partial payment or failure
        property.finances.expenses.overdueAmount += expenses.total;
        property.updatedAt = Date.now();
        this._propertyCache.set(propertyId, property);
        await this._saveProperties();

        return {
          success: false,
          error: localize("Errors.InsufficientFunds"),
          required: totalDue,
          available: totalGold
        };
      }

      await this._deductCurrency(player, totalDue);
    }

    // Update property
    property.finances.expenses.lastPayment = Date.now();
    property.finances.expenses.overdueAmount = 0;

    property.updatedAt = Date.now();
    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.expensesPaid`, property, totalDue);

    return {
      success: true,
      paid: totalDue,
      breakdown: expenses.breakdown
    };
  }

  /**
   * Make mortgage payment
   * @param {string} propertyId - Property ID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {number} amount - Payment amount (null = regular payment)
   * @returns {object}
   */
  async makeMortgagePayment(propertyId, playerActorUuid, amount = null) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      return { success: false, error: localize("Errors.PropertyNotFound") };
    }

    if (!property.finances.mortgage?.enabled) {
      return { success: false, error: localize("Errors.NoMortgage") };
    }

    const player = await fromUuid(playerActorUuid);
    if (!player) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    const paymentAmount = amount ?? property.finances.mortgage.paymentAmount;
    const currency = player.system?.currency;

    if (currency) {
      const totalGold = this._calculateTotalGold(currency);
      if (totalGold < paymentAmount) {
        // Missed payment
        property.finances.mortgage.missedPayments += 1;

        // Check for foreclosure
        if (property.finances.mortgage.missedPayments >= property.finances.mortgage.foreclosureThreshold) {
          await this._foreclose(property, playerActorUuid);
          return { success: false, foreclosed: true };
        }

        property.updatedAt = Date.now();
        this._propertyCache.set(propertyId, property);
        await this._saveProperties();

        return {
          success: false,
          error: localize("Errors.InsufficientFunds"),
          missedPayments: property.finances.mortgage.missedPayments
        };
      }

      await this._deductCurrency(player, paymentAmount);
    }

    // Apply payment
    property.finances.mortgage.remainingAmount = Math.max(
      0,
      property.finances.mortgage.remainingAmount - paymentAmount
    );
    property.finances.mortgage.lastPayment = Date.now();

    // Check if paid off
    if (property.finances.mortgage.remainingAmount === 0) {
      property.finances.mortgage.enabled = false;
      ui.notifications.info(localize("Property.MortgagePaidOff"));
    }

    property.updatedAt = Date.now();
    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.mortgagePayment`, property, paymentAmount);

    return {
      success: true,
      paid: paymentAmount,
      remaining: property.finances.mortgage.remainingAmount
    };
  }

  /**
   * Foreclose on property
   * @param {object} property - Property
   * @param {string} playerActorUuid - Player actor UUID
   * @private
   */
  async _foreclose(property, playerActorUuid) {
    property.status = PropertyStatus.FORECLOSED;
    property.ownership = {
      ownerUuid: null,
      ownerName: null,
      coOwners: [],
      purchaseDate: null,
      purchasePrice: 0
    };
    property.finances.mortgage.enabled = false;

    this._removeFromPlayerCache(playerActorUuid, property.id);

    property.updatedAt = Date.now();
    this._propertyCache.set(property.id, property);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.propertyForeclosed`, property, playerActorUuid);

    ui.notifications.warn(
      localize("Property.Foreclosed", { name: property.name })
    );
  }

  // ==================== Maintenance ====================

  /**
   * Perform maintenance on property
   * @param {string} propertyId - Property ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object}
   */
  async performMaintenance(propertyId, playerActorUuid) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      return { success: false, error: localize("Errors.PropertyNotFound") };
    }

    const player = await fromUuid(playerActorUuid);
    if (!player) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    const cost = property.condition.maintenanceCost;
    const currency = player.system?.currency;

    if (cost > 0 && currency) {
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

    // Restore condition
    property.condition.overall = Math.min(100, property.condition.overall + 25);
    property.condition.structural = Math.min(100, property.condition.structural + 15);
    property.condition.cleanliness = 100;
    property.condition.lastMaintenance = Date.now();
    property.condition.damaged = false;
    property.condition.damageDescription = null;

    property.updatedAt = Date.now();
    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.maintenancePerformed`, property);

    return { success: true, property, cost };
  }

  /**
   * Repair property damage
   * @param {string} propertyId - Property ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object}
   */
  async repairDamage(propertyId, playerActorUuid) {
    const property = this._propertyCache.get(propertyId);
    if (!property) {
      return { success: false, error: localize("Errors.PropertyNotFound") };
    }

    if (!property.condition.damaged) {
      return { success: false, error: localize("Errors.NotDamaged") };
    }

    const player = await fromUuid(playerActorUuid);
    if (!player) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    const cost = property.condition.repairCost;
    const currency = player.system?.currency;

    if (cost > 0 && currency) {
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

    // Repair
    property.condition.overall = 100;
    property.condition.structural = 100;
    property.condition.damaged = false;
    property.condition.damageDescription = null;
    property.condition.repairCost = 0;
    property.status = PropertyStatus.OWNED;

    property.updatedAt = Date.now();
    this._propertyCache.set(propertyId, property);
    await this._saveProperties();

    Hooks.callAll(`${MODULE_ID}.propertyRepaired`, property);

    return { success: true, property, cost };
  }

  /**
   * Process condition decay for all properties
   */
  async processConditionDecay() {
    if (!game.user.isGM) return;

    for (const [id, property] of this._propertyCache.entries()) {
      if (property.status !== PropertyStatus.OWNED &&
          property.status !== PropertyStatus.RENTED) {
        continue;
      }

      const updated = applyConditionDecay(property, 1);
      if (updated.condition.overall !== property.condition.overall) {
        this._propertyCache.set(id, updated);
      }
    }

    await this._saveProperties();
  }

  // ==================== Requirements & Helpers ====================

  /**
   * Check if player meets property requirements
   * @private
   */
  async _meetsRequirements(player, requirements) {
    if (!requirements) return true;

    if (requirements.playerLevel > 0) {
      const level = player.system?.details?.level || 0;
      if (level < requirements.playerLevel) return false;
    }

    if (requirements.gold > 0) {
      const currency = player.system?.currency;
      if (!currency) return false;
      const gold = this._calculateTotalGold(currency);
      if (gold < requirements.gold) return false;
    }

    return true;
  }

  /**
   * Calculate total gold
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
   * Deduct currency
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
   * Add currency
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
        type: `property.${event}`,
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
      case "property.propertyPurchased":
      case "property.propertyUpdated":
        if (!game.user.isGM) {
          await this._loadProperties();
        }
        break;
    }
  }

  // ==================== Data Export/Import ====================

  /**
   * Export all property data
   * @returns {object}
   */
  exportData() {
    return {
      properties: Object.fromEntries(this._propertyCache)
    };
  }

  /**
   * Import property data
   * @param {object} data - Import data
   */
  async importData(data) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    if (data.properties) {
      this._propertyCache.clear();
      this._playerPropertiesCache.clear();

      for (const [id, property] of Object.entries(data.properties)) {
        this._propertyCache.set(id, property);
        if (property.ownership?.ownerUuid) {
          this._addToPlayerCache(property.ownership.ownerUuid, id);
        }
      }

      await this._saveProperties();
    }
  }
}

// Singleton instance
export const propertyHandler = new PropertyHandler();
