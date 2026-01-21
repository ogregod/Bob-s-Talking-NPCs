/**
 * Bob's Talking NPCs - Hireling Manager
 * Hireling and mount management interface using Foundry V13 ApplicationV2
 */

import { MODULE_ID } from "../module.mjs";
import { localize, formatCurrency } from "../utils/helpers.mjs";
import { hirelingHandler } from "../handlers/hireling-handler.mjs";
import { HirelingStatus, LoyaltyLevel, ContractType } from "../data/hireling-model.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Hireling Manager Application
 * Displays and manages hired companions and mounts
 */
export class HirelingManager extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options - Application options
   * @param {string} options.actorUuid - Player actor UUID
   * @param {string} options.recruiterId - Recruiter NPC UUID (for hiring)
   */
  constructor(options = {}) {
    super(options);

    this.actorUuid = options.actorUuid || game.user.character?.uuid;
    this.recruiterId = options.recruiterId || null;

    this._tab = "hirelings"; // hirelings, mounts, recruit
    this._selectedId = null;
    this._filter = "active"; // active, all
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-hireling-manager",
    classes: ["bobsnpc", "hireling-manager"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.Hirelings.Title",
      icon: "fa-solid fa-users",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 800,
      height: 650
    },
    actions: {
      setTab: HirelingManager.#onSetTab,
      setFilter: HirelingManager.#onSetFilter,
      select: HirelingManager.#onSelect,
      hire: HirelingManager.#onHire,
      dismiss: HirelingManager.#onDismiss,
      payWages: HirelingManager.#onPayWages,
      viewInventory: HirelingManager.#onViewInventory,
      purchaseMount: HirelingManager.#onPurchaseMount,
      rentMount: HirelingManager.#onRentMount,
      returnMount: HirelingManager.#onReturnMount,
      stableMount: HirelingManager.#onStableMount,
      retrieveMount: HirelingManager.#onRetrieveMount
    }
  };

  /** @override */
  static PARTS = {
    tabs: {
      template: `modules/${MODULE_ID}/templates/hirelings/tabs.hbs`
    },
    list: {
      template: `modules/${MODULE_ID}/templates/hirelings/list.hbs`,
      scrollable: [".hireling-list"]
    },
    details: {
      template: `modules/${MODULE_ID}/templates/hirelings/details.hbs`,
      scrollable: [".hireling-details-content"]
    }
  };

  /** @override */
  get title() {
    return localize("Hirelings.Title");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const playerGold = await this._getPlayerGold();

    // Get data based on tab
    let listItems = [];
    let selectedItem = null;

    switch (this._tab) {
      case "hirelings":
        listItems = this._prepareHirelings();
        break;
      case "mounts":
        listItems = this._prepareMounts();
        break;
      case "recruit":
        listItems = await this._prepareRecruitment();
        break;
    }

    // Apply filter
    if (this._filter === "active") {
      listItems = listItems.filter(item =>
        item.status === HirelingStatus.HIRED ||
        item.status === HirelingStatus.WORKING
      );
    }

    // Select first if none selected
    if (!this._selectedId && listItems.length > 0) {
      this._selectedId = listItems[0].id;
    }

    selectedItem = listItems.find(item => item.id === this._selectedId);

    // Count items
    const counts = {
      hirelings: hirelingHandler.getPlayerHirelings(this.actorUuid).length,
      mounts: hirelingHandler.getPlayerMounts(this.actorUuid).length
    };

    return {
      ...context,
      actorUuid: this.actorUuid,
      recruiterId: this.recruiterId,
      tab: this._tab,
      filter: this._filter,
      counts,
      items: listItems.map(item => this._prepareListItem(item)),
      selectedItem: selectedItem ? this._prepareDetails(selectedItem) : null,
      hasItems: listItems.length > 0,
      player: {
        gold: playerGold,
        goldFormatted: formatCurrency(playerGold)
      },
      isRecruiting: this._tab === "recruit",
      isGM: game.user.isGM,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /**
   * Prepare player's hirelings
   * @returns {object[]}
   * @private
   */
  _prepareHirelings() {
    const hirelings = hirelingHandler.getPlayerHirelings(this.actorUuid);
    return hirelings.map(h => ({
      ...h,
      itemType: "hireling"
    }));
  }

  /**
   * Prepare player's mounts
   * @returns {object[]}
   * @private
   */
  _prepareMounts() {
    const mounts = hirelingHandler.getPlayerMounts(this.actorUuid);
    return mounts.map(m => ({
      ...m,
      itemType: "mount"
    }));
  }

  /**
   * Prepare available hirelings/mounts for recruitment
   * @returns {object[]}
   * @private
   */
  async _prepareRecruitment() {
    const available = [];

    // Get available hirelings
    const hirelings = await hirelingHandler.getAvailableHirelings(this.actorUuid);
    available.push(...hirelings.map(h => ({
      ...h,
      itemType: "hireling"
    })));

    // Get available mounts (if at stable)
    if (this.recruiterId) {
      const stable = hirelingHandler.getStable(this.recruiterId);
      if (stable) {
        for (const mountId of stable.mountsForSale || []) {
          const mount = hirelingHandler.getMount(mountId);
          if (mount && mount.status === HirelingStatus.AVAILABLE) {
            available.push({ ...mount, itemType: "mount", forSale: true });
          }
        }
        for (const mountId of stable.mountsForRent || []) {
          const mount = hirelingHandler.getMount(mountId);
          if (mount && mount.status === HirelingStatus.AVAILABLE) {
            available.push({ ...mount, itemType: "mount", forRent: true });
          }
        }
      }
    }

    return available;
  }

  /**
   * Prepare item for list display
   * @param {object} item - Hireling or mount
   * @returns {object}
   * @private
   */
  _prepareListItem(item) {
    const isHireling = item.itemType === "hireling";

    return {
      id: item.id,
      name: item.name,
      type: item.itemType,
      typeLabel: isHireling ?
        localize(`HirelingType.${item.type}`) :
        localize(`MountType.${item.type}`),
      portrait: item.portrait || item.tokenImage,
      status: item.status,
      statusLabel: localize(`HirelingStatus.${item.status}`),
      statusClass: `status-${item.status}`,
      isSelected: item.id === this._selectedId,

      // Hireling specific
      loyalty: isHireling ? item.loyalty?.value : null,
      loyaltyLevel: isHireling ? item.loyalty?.level : null,
      loyaltyLabel: isHireling && item.loyalty ?
        localize(`LoyaltyLevel.${item.loyalty.level}`) : null,
      wagesDue: isHireling && item.contract?.owedAmount > 0,

      // Mount specific
      isRented: !isHireling && item.isRented,
      condition: !isHireling ? item.condition?.health : null,

      // Recruitment
      forSale: item.forSale,
      forRent: item.forRent,
      hireCost: isHireling ? item.hireCost?.base : null,
      purchasePrice: !isHireling ? item.pricing?.purchase : null,
      rentalPrice: !isHireling ? item.pricing?.rental : null
    };
  }

  /**
   * Prepare item details
   * @param {object} item - Hireling or mount
   * @returns {object}
   * @private
   */
  _prepareDetails(item) {
    const isHireling = item.itemType === "hireling";

    const details = {
      ...item,
      isHireling,
      isMount: !isHireling,
      typeLabel: isHireling ?
        localize(`HirelingType.${item.type}`) :
        localize(`MountType.${item.type}`),
      statusLabel: localize(`HirelingStatus.${item.status}`),
      statusClass: `status-${item.status}`
    };

    if (isHireling) {
      return this._prepareHirelingDetails(details);
    } else {
      return this._prepareMountDetails(details);
    }
  }

  /**
   * Prepare hireling details
   * @param {object} hireling - Hireling data
   * @returns {object}
   * @private
   */
  _prepareHirelingDetails(hireling) {
    // Prepare skills
    const skills = [];
    if (hireling.skills) {
      for (const [skill, value] of Object.entries(hireling.skills)) {
        if (skill !== "custom" && value > 0) {
          skills.push({
            name: localize(`Skills.${skill}`),
            value,
            bars: Array(10).fill(null).map((_, i) => ({ filled: i < value }))
          });
        }
      }
    }

    // Prepare loyalty
    let loyalty = null;
    if (hireling.loyalty) {
      loyalty = {
        value: hireling.loyalty.value,
        level: hireling.loyalty.level,
        levelLabel: localize(`LoyaltyLevel.${hireling.loyalty.level}`),
        levelClass: `loyalty-${hireling.loyalty.level}`,
        percent: hireling.loyalty.value
      };
    }

    // Prepare contract
    let contract = null;
    if (hireling.contract) {
      contract = {
        type: hireling.contract.type,
        typeLabel: localize(`ContractType.${hireling.contract.type}`),
        wage: hireling.contract.wage,
        wageFormatted: formatCurrency(hireling.contract.wage),
        owedAmount: hireling.contract.owedAmount,
        owedFormatted: formatCurrency(hireling.contract.owedAmount || 0),
        nextPaymentDue: hireling.contract.nextPaymentDue ?
          new Date(hireling.contract.nextPaymentDue).toLocaleDateString() : null,
        isOverdue: hireling.contract.owedAmount > 0
      };
    }

    // Prepare inventory (for porters)
    let inventory = null;
    if (hireling.inventory?.enabled) {
      inventory = {
        slots: hireling.inventory.maxSlots,
        used: hireling.inventory.items?.length || 0,
        weight: hireling.inventory.maxWeight,
        items: hireling.inventory.items || []
      };
    }

    return {
      ...hireling,
      skills,
      loyalty,
      contract,
      inventory,
      abilities: hireling.abilities || [],
      canDismiss: hireling.status === HirelingStatus.HIRED,
      canPayWages: contract?.owedAmount > 0,
      hasInventory: inventory !== null
    };
  }

  /**
   * Prepare mount details
   * @param {object} mount - Mount data
   * @returns {object}
   * @private
   */
  _prepareMountDetails(mount) {
    // Prepare stats
    const stats = [];
    if (mount.stats) {
      stats.push(
        { name: localize("Stats.Speed"), value: mount.stats.speed, icon: "fa-running" },
        { name: localize("Stats.CarryCapacity"), value: `${mount.stats.carryCapacity} lb`, icon: "fa-weight-hanging" },
        { name: localize("Stats.Passengers"), value: mount.stats.passengers, icon: "fa-user" }
      );
      if (mount.stats.fly) {
        stats.push({ name: localize("Stats.FlySpeed"), value: mount.stats.flySpeed, icon: "fa-dove" });
      }
    }

    // Prepare condition
    let condition = null;
    if (mount.condition) {
      condition = {
        health: mount.condition.health,
        healthClass: mount.condition.health > 60 ? "good" :
          mount.condition.health > 30 ? "moderate" : "poor",
        fatigue: mount.condition.fatigue,
        injured: mount.condition.injured,
        injuryDescription: mount.condition.injuryDescription
      };
    }

    // Prepare training
    let training = null;
    if (mount.training) {
      training = {
        level: mount.training.level,
        levelLabel: localize(`TrainingLevel.${mount.training.level}`),
        tricks: mount.training.tricks || [],
        combatTrained: mount.training.combatTrained,
        mountedCombat: mount.training.mountedCombat
      };
    }

    // Prepare saddlebags
    let saddlebags = null;
    if (mount.saddlebags?.enabled) {
      saddlebags = {
        slots: mount.saddlebags.maxSlots,
        used: mount.saddlebags.items?.length || 0,
        items: mount.saddlebags.items || []
      };
    }

    return {
      ...mount,
      stats,
      condition,
      training,
      saddlebags,
      canReturn: mount.isRented,
      canStable: !mount.isRented && mount.status === HirelingStatus.HIRED,
      hasSaddlebags: saddlebags !== null,
      rentalExpires: mount.rentalExpires ?
        new Date(mount.rentalExpires).toLocaleDateString() : null,
      stablingPaidUntil: mount.stablingPaidUntil ?
        new Date(mount.stablingPaidUntil).toLocaleDateString() : null
    };
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
    this._selectedId = null;
    this.render();
  }

  static #onSetFilter(event, target) {
    this._filter = target.dataset.filter;
    this.render();
  }

  static #onSelect(event, target) {
    this._selectedId = target.dataset.id;
    this.render();
  }

  static async #onHire(event, target) {
    const id = target.dataset.id;
    const type = target.dataset.type;

    if (type === "hireling") {
      // Show hire dialog for contract options
      const hireling = hirelingHandler.getHireling(id);
      if (!hireling) return;

      const content = await renderTemplate(
        `modules/${MODULE_ID}/templates/hirelings/hire-dialog.hbs`,
        { hireling, contractTypes: Object.values(ContractType) }
      );

      new Dialog({
        title: localize("Hirelings.HireDialog"),
        content,
        buttons: {
          hire: {
            icon: '<i class="fas fa-handshake"></i>',
            label: localize("Hirelings.Hire"),
            callback: async (html) => {
              const contractType = html.find("[name=contractType]").val();
              const days = parseInt(html.find("[name=days]").val()) || 1;

              const result = await hirelingHandler.hireHireling(
                id, this.actorUuid, { type: contractType, days }
              );

              if (result.success) {
                ui.notifications.info(localize("Hirelings.Hired", { name: hireling.name }));
                this._tab = "hirelings";
                this.render();
              } else {
                ui.notifications.error(result.error);
              }
            }
          },
          cancel: {
            label: localize("Cancel")
          }
        }
      }).render(true);
    }
  }

  static async #onDismiss(event, target) {
    const id = target.dataset.id;

    const confirmed = await Dialog.confirm({
      title: localize("Hirelings.DismissTitle"),
      content: `<p>${localize("Hirelings.DismissConfirm")}</p>`
    });

    if (!confirmed) return;

    const result = await hirelingHandler.dismissHireling(id, this.actorUuid);
    if (result.success) {
      ui.notifications.info(localize("Hirelings.Dismissed", { name: result.hireling.name }));
      this._selectedId = null;
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static async #onPayWages(event, target) {
    const id = target.dataset.id;

    const result = await hirelingHandler.payWages(id, this.actorUuid);
    if (result.success) {
      ui.notifications.info(localize("Hirelings.WagesPaid", {
        amount: formatCurrency(result.paid)
      }));
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static #onViewInventory(event, target) {
    const id = target.dataset.id;
    // Open inventory interface
    ui.notifications.info("Opening inventory...");
  }

  static async #onPurchaseMount(event, target) {
    const id = target.dataset.id;

    const result = await hirelingHandler.purchaseMount(id, this.actorUuid);
    if (result.success) {
      ui.notifications.info(localize("Mounts.Purchased", { name: result.mount.name }));
      this._tab = "mounts";
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static async #onRentMount(event, target) {
    const id = target.dataset.id;

    // Show rental dialog
    const content = `
      <form>
        <div class="form-group">
          <label>${localize("Mounts.RentalDays")}</label>
          <input type="number" name="days" value="1" min="1" max="30">
        </div>
      </form>
    `;

    new Dialog({
      title: localize("Mounts.RentDialog"),
      content,
      buttons: {
        rent: {
          icon: '<i class="fas fa-key"></i>',
          label: localize("Mounts.Rent"),
          callback: async (html) => {
            const days = parseInt(html.find("[name=days]").val()) || 1;

            const result = await hirelingHandler.rentMount(id, this.actorUuid, days);
            if (result.success) {
              ui.notifications.info(localize("Mounts.Rented", {
                name: result.mount.name, days
              }));
              this._tab = "mounts";
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

  static async #onReturnMount(event, target) {
    const id = target.dataset.id;

    const result = await hirelingHandler.returnMount(id, this.actorUuid);
    if (result.success) {
      ui.notifications.info(localize("Mounts.Returned", { name: result.mount.name }));
      this._selectedId = null;
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static async #onStableMount(event, target) {
    const id = target.dataset.id;

    if (!this.recruiterId) {
      ui.notifications.warn(localize("Mounts.NoStable"));
      return;
    }

    const result = await hirelingHandler.stableMount(
      this.recruiterId, id, this.actorUuid, 7
    );

    if (result.success) {
      ui.notifications.info(localize("Mounts.Stabled"));
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  static async #onRetrieveMount(event, target) {
    const id = target.dataset.id;

    if (!this.recruiterId) {
      ui.notifications.warn(localize("Mounts.NoStable"));
      return;
    }

    const result = await hirelingHandler.retrieveMount(
      this.recruiterId, id, this.actorUuid
    );

    if (result.success) {
      ui.notifications.info(localize("Mounts.Retrieved"));
      this.render();
    } else {
      ui.notifications.error(result.error);
    }
  }

  // ==================== Static Factory ====================

  /**
   * Open hireling manager
   * @param {string} actorUuid - Actor UUID
   * @param {string} recruiterId - Recruiter NPC UUID (optional)
   * @returns {HirelingManager}
   */
  static async open(actorUuid = null, recruiterId = null) {
    if (!actorUuid && game.user.character) {
      actorUuid = game.user.character.uuid;
    }

    const window = new HirelingManager({ actorUuid, recruiterId });
    await window.render(true);
    return window;
  }
}
