/**
 * Bob's Talking NPCs - Property Manager
 * Property management interface using Foundry V13 ApplicationV2
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";

import { localize, formatCurrency } from "../utils/helpers.mjs";
import { propertyHandler } from "../handlers/property-handler.mjs";
import { PropertyStatus, PropertyType, UpgradeType } from "../data/property-model.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Property Manager Application
 * Displays and manages player-owned properties
 */
export class PropertyManager extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options - Application options
   * @param {string} options.actorUuid - Player actor UUID
   * @param {string} options.propertyId - Specific property to show
   * @param {string} options.sellerId - Property seller NPC UUID (for browsing)
   */
  constructor(options = {}) {
    super(options);

    this.actorUuid = options.actorUuid || game.user.character?.uuid;
    this.initialPropertyId = options.propertyId || null;
    this.sellerId = options.sellerId || null;

    this._tab = options.sellerId ? "browse" : "owned"; // owned, browse, details
    this._selectedPropertyId = options.propertyId || null;
    this._filter = "all";
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-property-manager",
    classes: ["bobsnpc", "property-manager"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.Properties.Title",
      icon: "fa-solid fa-home",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 850,
      height: 700
    },
    actions: {
      setTab: PropertyManager.#onSetTab,
      setFilter: PropertyManager.#onSetFilter,
      selectProperty: PropertyManager.#onSelectProperty,
      purchase: PropertyManager.#onPurchase,
      rent: PropertyManager.#onRent,
      sell: PropertyManager.#onSell,
      endLease: PropertyManager.#onEndLease,
      installUpgrade: PropertyManager.#onInstallUpgrade,
      hireStaff: PropertyManager.#onHireStaff,
      fireStaff: PropertyManager.#onFireStaff,
      collectIncome: PropertyManager.#onCollectIncome,
      payExpenses: PropertyManager.#onPayExpenses,
      payMortgage: PropertyManager.#onPayMortgage,
      maintenance: PropertyManager.#onMaintenance,
      repair: PropertyManager.#onRepair,
      accessStorage: PropertyManager.#onAccessStorage
    }
  };

  /** @override */
  static PARTS = {
    tabs: {
      template: `modules/${MODULE_ID}/templates/properties/tabs.hbs`
    },
    list: {
      template: `modules/${MODULE_ID}/templates/properties/list.hbs`,
      scrollable: [".property-list"]
    },
    details: {
      template: `modules/${MODULE_ID}/templates/properties/details.hbs`,
      scrollable: [".property-details-content"]
    }
  };

  /** @override */
  get title() {
    return localize("Properties.Title");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const playerGold = await this._getPlayerGold();

    // Get properties based on tab
    let properties = [];
    switch (this._tab) {
      case "owned":
        properties = propertyHandler.getPlayerProperties(this.actorUuid);
        break;
      case "browse":
        properties = propertyHandler.getAvailableProperties({});
        break;
    }

    // Apply filter
    if (this._filter !== "all") {
      properties = properties.filter(p => p.type === this._filter);
    }

    // Select first if none selected
    if (!this._selectedPropertyId && properties.length > 0) {
      this._selectedPropertyId = properties[0].id;
    }

    const selectedProperty = properties.find(p => p.id === this._selectedPropertyId);

    // Get counts
    const ownedProperties = propertyHandler.getPlayerProperties(this.actorUuid);
    const counts = {
      owned: ownedProperties.length,
      available: propertyHandler.getAvailableProperties({}).length,
      totalValue: ownedProperties.reduce((sum, p) =>
        sum + (p.pricing?.appraisedValue || p.pricing?.purchasePrice || 0), 0)
    };

    // Get property types for filter
    const propertyTypes = Object.values(PropertyType).map(type => ({
      id: type,
      label: localize(`PropertyType.${type}`),
      selected: type === this._filter
    }));

    return {
      ...context,
      actorUuid: this.actorUuid,
      sellerId: this.sellerId,
      tab: this._tab,
      filter: this._filter,
      counts,
      propertyTypes,
      properties: properties.map(p => this._preparePropertyListItem(p)),
      selectedProperty: selectedProperty ?
        await this._preparePropertyDetails(selectedProperty) : null,
      hasProperties: properties.length > 0,
      player: {
        gold: playerGold,
        goldFormatted: formatCurrency(playerGold)
      },
      isBrowsing: this._tab === "browse",
      isGM: game.user.isGM,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /**
   * Prepare property for list display
   * @param {object} property - Property data
   * @returns {object}
   * @private
   */
  _preparePropertyListItem(property) {
    return {
      id: property.id,
      name: property.name,
      type: property.type,
      typeLabel: localize(`PropertyType.${property.type}`),
      typeIcon: this._getPropertyIcon(property.type),
      status: property.status,
      statusLabel: localize(`PropertyStatus.${property.status}`),
      statusClass: `status-${property.status}`,
      location: property.location?.address || property.location?.region,
      portrait: property.portrait || property.exteriorImage,
      price: property.pricing?.purchasePrice,
      priceFormatted: formatCurrency(property.pricing?.purchasePrice || 0),
      isRented: property.rental?.isRented,
      condition: property.condition?.overall,
      conditionClass: property.condition?.overall > 60 ? "good" :
        property.condition?.overall > 30 ? "moderate" : "poor",
      isSelected: property.id === this._selectedPropertyId,
      hasMortgage: property.finances?.mortgage?.enabled,
      hasIncome: property.finances?.income?.enabled
    };
  }

  /**
   * Prepare property details
   * @param {object} property - Property data
   * @returns {object}
   * @private
   */
  async _preparePropertyDetails(property) {
    const isOwned = property.ownership?.ownerUuid === this.actorUuid;
    const isRented = property.rental?.isRented &&
      property.ownership?.ownerUuid === this.actorUuid;

    // Prepare storage
    const storage = propertyHandler.getStorageSummary(property.id);

    // Prepare upgrades
    const upgrades = await propertyHandler.getAvailableUpgrades(
      property.id, this.actorUuid
    );

    // Prepare staff
    const staff = (property.staff?.members || []).map(s => ({
      ...s,
      wageFormatted: formatCurrency(s.wage),
      loyaltyClass: s.loyalty >= 70 ? "high" : s.loyalty >= 40 ? "medium" : "low"
    }));

    // Prepare finances
    const finances = this._prepareFinances(property);

    // Prepare features
    const features = this._prepareFeatures(property);

    // Prepare condition
    const condition = {
      overall: property.condition?.overall || 100,
      structural: property.condition?.structural || 100,
      cleanliness: property.condition?.cleanliness || 100,
      overallClass: (property.condition?.overall || 100) > 60 ? "good" :
        (property.condition?.overall || 100) > 30 ? "moderate" : "poor",
      damaged: property.condition?.damaged,
      damageDescription: property.condition?.damageDescription,
      repairCost: property.condition?.repairCost,
      repairCostFormatted: formatCurrency(property.condition?.repairCost || 0),
      maintenanceCost: property.condition?.maintenanceCost,
      maintenanceCostFormatted: formatCurrency(property.condition?.maintenanceCost || 0)
    };

    return {
      ...property,
      typeLabel: localize(`PropertyType.${property.type}`),
      typeIcon: this._getPropertyIcon(property.type),
      statusLabel: localize(`PropertyStatus.${property.status}`),
      statusClass: `status-${property.status}`,
      isOwned,
      isRented,
      isAvailable: property.status === PropertyStatus.AVAILABLE,
      canPurchase: property.status === PropertyStatus.AVAILABLE,
      canRent: property.status === PropertyStatus.AVAILABLE &&
        property.pricing?.rentalPrice > 0,
      canSell: isOwned && !isRented,
      canEndLease: isRented,

      // Pricing
      purchasePrice: property.pricing?.purchasePrice,
      purchasePriceFormatted: formatCurrency(property.pricing?.purchasePrice || 0),
      rentalPrice: property.pricing?.rentalPrice,
      rentalPriceFormatted: formatCurrency(property.pricing?.rentalPrice || 0),
      appraisedValue: property.pricing?.appraisedValue,
      appraisedValueFormatted: formatCurrency(property.pricing?.appraisedValue || 0),
      mortgageAvailable: property.pricing?.mortgageAvailable,
      mortgageDownPayment: property.pricing?.mortgageDownPayment ?
        `${(property.pricing.mortgageDownPayment * 100).toFixed(0)}%` : null,

      // Size
      sizeLabel: `${property.size?.rooms || 1} ${localize("Properties.Rooms")}, ${property.size?.floors || 1} ${localize("Properties.Floors")}`,
      bedrooms: property.size?.bedrooms,
      guestCapacity: property.size?.guestCapacity,

      // Storage
      storage,
      hasStorage: storage && storage.totalSlots > 0,

      // Upgrades
      upgrades: upgrades.map(u => ({
        ...u,
        costFormatted: formatCurrency(u.cost?.gold || 0),
        typeLabel: localize(`UpgradeType.${u.type}`),
        canInstall: u.canInstall,
        blockedReasons: u.blockedReasons
      })),
      installedUpgrades: (property.installedUpgrades || []).map(id => {
        const upgrade = property.availableUpgrades?.find(u => u.id === id);
        return upgrade ? {
          id,
          name: upgrade.name,
          description: upgrade.description
        } : null;
      }).filter(Boolean),
      upgradeInProgress: property.upgradeInProgress,
      upgradeCompletionDate: property.upgradeCompletionDate ?
        new Date(property.upgradeCompletionDate).toLocaleDateString() : null,

      // Staff
      staff,
      hasStaff: staff.length > 0,
      canHireStaff: (property.staff?.maxSlots || 0) > staff.length,
      staffSlots: `${staff.length}/${property.staff?.maxSlots || 0}`,

      // Finances
      finances,
      hasFinances: finances.hasIncome || finances.hasExpenses || finances.hasMortgage,

      // Features
      features,

      // Condition
      condition,

      // Security
      security: {
        level: property.security?.level || 0,
        hasLocks: property.security?.locks,
        lockDC: property.security?.lockDC,
        guards: property.security?.guards || 0,
        hasWards: property.security?.magicalWards,
        wardDescription: property.security?.wardDescription
      },

      // Rental info
      rental: property.rental?.isRented ? {
        rentAmount: property.rental.rentAmount,
        rentFormatted: formatCurrency(property.rental.rentAmount || 0),
        dueDate: property.rental.rentDueDate ?
          new Date(property.rental.rentDueDate).toLocaleDateString() : null,
        leaseEnds: property.rental.leaseEnds ?
          new Date(property.rental.leaseEnds).toLocaleDateString() : null
      } : null
    };
  }

  /**
   * Prepare finances for display
   * @param {object} property - Property data
   * @returns {object}
   * @private
   */
  _prepareFinances(property) {
    const finances = property.finances || {};

    const income = finances.income?.enabled ? {
      base: finances.income.baseAmount,
      bonus: finances.income.bonusAmount,
      total: (finances.income.baseAmount || 0) + (finances.income.bonusAmount || 0),
      totalFormatted: formatCurrency(
        (finances.income.baseAmount || 0) + (finances.income.bonusAmount || 0)
      ),
      pending: finances.income.pendingAmount || 0,
      pendingFormatted: formatCurrency(finances.income.pendingAmount || 0),
      lastCollection: finances.income.lastCollection ?
        new Date(finances.income.lastCollection).toLocaleDateString() : null
    } : null;

    const expenses = {
      maintenance: finances.expenses?.maintenance || 0,
      staffWages: finances.expenses?.staffWages || 0,
      taxes: finances.expenses?.taxes || 0,
      other: finances.expenses?.other || 0,
      total: (finances.expenses?.maintenance || 0) +
        (finances.expenses?.staffWages || 0) +
        (finances.expenses?.taxes || 0) +
        (finances.expenses?.other || 0),
      overdue: finances.expenses?.overdueAmount || 0
    };
    expenses.totalFormatted = formatCurrency(expenses.total);
    expenses.overdueFormatted = formatCurrency(expenses.overdue);

    const mortgage = finances.mortgage?.enabled ? {
      total: finances.mortgage.totalAmount,
      remaining: finances.mortgage.remainingAmount,
      remainingFormatted: formatCurrency(finances.mortgage.remainingAmount || 0),
      payment: finances.mortgage.paymentAmount,
      paymentFormatted: formatCurrency(finances.mortgage.paymentAmount || 0),
      interestRate: `${((finances.mortgage.interestRate || 0.05) * 100).toFixed(1)}%`,
      missedPayments: finances.mortgage.missedPayments || 0,
      progress: finances.mortgage.totalAmount > 0 ?
        Math.round(((finances.mortgage.totalAmount - finances.mortgage.remainingAmount) /
          finances.mortgage.totalAmount) * 100) : 0
    } : null;

    return {
      income,
      expenses,
      mortgage,
      hasIncome: income !== null,
      hasExpenses: expenses.total > 0,
      hasMortgage: mortgage !== null,
      netIncome: (income?.total || 0) - expenses.total,
      netIncomeFormatted: formatCurrency((income?.total || 0) - expenses.total)
    };
  }

  /**
   * Prepare features for display
   * @param {object} property - Property data
   * @returns {object[]}
   * @private
   */
  _prepareFeatures(property) {
    const features = [];
    const f = property.features || {};

    if (f.restBonus > 0) {
      features.push({
        icon: "fa-bed",
        label: localize("Features.RestBonus"),
        value: `+${f.restBonus}`
      });
    }

    if (f.craftingStation) {
      features.push({
        icon: "fa-hammer",
        label: localize("Features.CraftingStation"),
        value: f.craftingTypes?.join(", ") || localize("Features.General")
      });
    }

    if (f.alchemyLab) {
      features.push({
        icon: "fa-flask",
        label: localize("Features.AlchemyLab")
      });
    }

    if (f.library) {
      features.push({
        icon: "fa-book",
        label: localize("Features.Library"),
        value: f.libraryBonus ? `+${f.libraryBonus}` : null
      });
    }

    if (f.stable) {
      features.push({
        icon: "fa-horse",
        label: localize("Features.Stable"),
        value: `${f.stableCapacity} ${localize("Features.Capacity")}`
      });
    }

    if (f.garden) {
      features.push({
        icon: "fa-seedling",
        label: localize("Features.Garden")
      });
    }

    if (f.teleportCircle) {
      features.push({
        icon: "fa-magic",
        label: localize("Features.TeleportCircle")
      });
    }

    return features;
  }

  /**
   * Get property type icon
   * @param {string} type - Property type
   * @returns {string}
   * @private
   */
  _getPropertyIcon(type) {
    const icons = {
      [PropertyType.HOUSE]: "fa-home",
      [PropertyType.APARTMENT]: "fa-building",
      [PropertyType.MANOR]: "fa-chess-rook",
      [PropertyType.CASTLE]: "fa-fort-awesome",
      [PropertyType.SHOP]: "fa-store",
      [PropertyType.TAVERN]: "fa-beer",
      [PropertyType.WORKSHOP]: "fa-hammer",
      [PropertyType.FARM]: "fa-tractor",
      [PropertyType.WAREHOUSE]: "fa-warehouse",
      [PropertyType.GUILD_HALL]: "fa-landmark",
      [PropertyType.SHIP]: "fa-ship",
      [PropertyType.CAMP]: "fa-campground"
    };
    return icons[type] || "fa-home";
  }

  /**
   * Get player gold
   * @returns {number}
   * @private
   */
  async _getPlayerGold() {
    const actor = await fromUuid(this.actorUuid);
    if (!actor) return 0;

    const currency = actor.system.currency;
    if (!currency) return 0;

    return (
      (currency.pp || 0) * 10 +
      (currency.gp || 0) +
      (currency.ep || 0) * 0.5 +
      (currency.sp || 0) * 0.1 +
      (currency.cp || 0) * 0.01
    );
  }

  // ==================== Actions ====================

  static #onSetTab(event, target) {
    this._tab = target.dataset.tab;
    this._selectedPropertyId = null;
    this.render();
  }

  static #onSetFilter(event, target) {
    this._filter = target.dataset.filter;
    this.render();
  }

  static #onSelectProperty(event, target) {
    this._selectedPropertyId = target.dataset.propertyId;
    this.render();
  }

  static async #onPurchase(event, target) {
    const propertyId = target.dataset.propertyId;
    const useMortgage = target.dataset.mortgage === "true";

    const result = await propertyHandler.purchaseProperty(
      propertyId, this.actorUuid, { useMortgage }
    );

    if (result.success) {
      ui.notifications.info(localize("Properties.Purchased", {
        name: result.property.name
      }));
      this._tab = "owned";
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static async #onRent(event, target) {
    const propertyId = target.dataset.propertyId;

    // Show rental dialog
    const content = `
      <form>
        <div class="form-group">
          <label>${localize("Properties.RentalWeeks")}</label>
          <input type="number" name="weeks" value="4" min="1" max="52">
        </div>
      </form>
    `;

    new Dialog({
      title: localize("Properties.RentDialog"),
      content,
      buttons: {
        rent: {
          icon: '<i class="fas fa-key"></i>',
          label: localize("Properties.Rent"),
          callback: async (html) => {
            const weeks = parseInt(html.find("[name=weeks]").val()) || 4;

            const result = await propertyHandler.rentProperty(
              propertyId, this.actorUuid, weeks
            );

            if (result.success) {
              ui.notifications.info(localize("Properties.Rented", {
                name: result.property.name
              }));
              this._tab = "owned";
              this.render();
            } else {
              ui.notifications.error(result.error);
            }
          }
        },
        cancel: { label: localize("Cancel") }
      }
    }).render(true);
  }

  static async #onSell(event, target) {
    const propertyId = target.dataset.propertyId;
    const property = propertyHandler.getProperty(propertyId);

    const confirmed = await Dialog.confirm({
      title: localize("Properties.SellTitle"),
      content: `<p>${localize("Properties.SellConfirm", { name: property.name })}</p>`
    });

    if (!confirmed) return;

    const result = await propertyHandler.sellProperty(propertyId, this.actorUuid);

    if (result.success) {
      ui.notifications.info(localize("Properties.Sold", {
        name: property.name,
        amount: formatCurrency(result.netProceeds)
      }));
      this._selectedPropertyId = null;
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static async #onEndLease(event, target) {
    const propertyId = target.dataset.propertyId;

    const result = await propertyHandler.endLease(propertyId, this.actorUuid);

    if (result.success) {
      ui.notifications.info(localize("Properties.LeaseEnded"));
      this._selectedPropertyId = null;
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static async #onInstallUpgrade(event, target) {
    const propertyId = target.dataset.propertyId;
    const upgradeId = target.dataset.upgradeId;

    const result = await propertyHandler.installUpgrade(
      propertyId, upgradeId, this.actorUuid
    );

    if (result.success) {
      ui.notifications.info(localize("Properties.UpgradeInstalled", {
        name: result.upgrade.name
      }));
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static async #onHireStaff(event, target) {
    const propertyId = target.dataset.propertyId;

    // Show staff hiring dialog
    ui.notifications.info("Staff hiring dialog would open here");
  }

  static async #onFireStaff(event, target) {
    const propertyId = target.dataset.propertyId;
    const staffId = target.dataset.staffId;

    const result = await propertyHandler.fireStaff(
      propertyId, staffId, this.actorUuid
    );

    if (result.success) {
      ui.notifications.info(localize("Properties.StaffFired"));
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static async #onCollectIncome(event, target) {
    const propertyId = target.dataset.propertyId;

    const result = await propertyHandler.collectIncome(propertyId, this.actorUuid);

    if (result.success) {
      ui.notifications.info(localize("Properties.IncomeCollected", {
        amount: formatCurrency(result.collected)
      }));
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static async #onPayExpenses(event, target) {
    const propertyId = target.dataset.propertyId;

    const result = await propertyHandler.payExpenses(propertyId, this.actorUuid);

    if (result.success) {
      ui.notifications.info(localize("Properties.ExpensesPaid", {
        amount: formatCurrency(result.paid)
      }));
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static async #onPayMortgage(event, target) {
    const propertyId = target.dataset.propertyId;

    const result = await propertyHandler.makeMortgagePayment(
      propertyId, this.actorUuid
    );

    if (result.success) {
      ui.notifications.info(localize("Properties.MortgagePayment", {
        amount: formatCurrency(result.paid)
      }));
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static async #onMaintenance(event, target) {
    const propertyId = target.dataset.propertyId;

    const result = await propertyHandler.performMaintenance(
      propertyId, this.actorUuid
    );

    if (result.success) {
      ui.notifications.info(localize("Properties.MaintenancePerformed"));
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static async #onRepair(event, target) {
    const propertyId = target.dataset.propertyId;

    const result = await propertyHandler.repairDamage(propertyId, this.actorUuid);

    if (result.success) {
      ui.notifications.info(localize("Properties.Repaired"));
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static #onAccessStorage(event, target) {
    const propertyId = target.dataset.propertyId;
    // Open storage interface
    ui.notifications.info("Storage interface would open here");
  }

  // ==================== Static Factory ====================

  /**
   * Open property manager
   * @param {string} actorUuid - Actor UUID
   * @param {object} options - Additional options
   * @returns {PropertyManager}
   */
  static async open(actorUuid = null, options = {}) {
    if (!actorUuid && game.user.character) {
      actorUuid = game.user.character.uuid;
    }

    const window = new PropertyManager({ actorUuid, ...options });
    await window.render(true);
    return window;
  }
}
