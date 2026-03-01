/**
 * Bob's Talking NPCs - Service Selection Dialog
 * Enhanced player UI for selecting service options (tiers, spell levels, etc.)
 * Provides real-time pricing calculation for dynamic service pricing modes.
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize, formatCurrency } from "../utils/helpers.mjs";
import { PriceType } from "../data/merchant-model.mjs";
import { calculateServicePrice, getPricingSummary } from "../services/service-pricing.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Service Selection Dialog
 * Shows enhanced UI for services with dynamic pricing (tiered, spell level, enchantment, etc.)
 */
export class ServiceSelectionDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(serviceDef, context = {}, options = {}) {
    super(options);

    this.serviceDef = serviceDef;
    this.context = context;
    this.item = context.item;
    this.merchant = context.merchant;
    this.actor = context.actor;

    // Selection state
    this._selectedTier = 0;
    this._selectedSpellLevel = 1;
    this._selectedQuantity = 1;
    this._selectedEnchantment = null;

    // Result promise
    this._resolvePromise = null;
    this._rejectPromise = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-service-selection",
    classes: ["bobsnpc", "service-selection-dialog"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "Select Service Options",
      icon: "fa-solid fa-hand-pointer",
      minimizable: false,
      resizable: false
    },
    position: {
      width: 520,
      height: "auto"
    },
    actions: {
      selectTier: ServiceSelectionDialog.#onSelectTier,
      updateSpellLevel: ServiceSelectionDialog.#onUpdateSpellLevel,
      updateQuantity: ServiceSelectionDialog.#onUpdateQuantity,
      pickEnchantment: ServiceSelectionDialog.#onPickEnchantment,
      confirm: ServiceSelectionDialog.#onConfirm,
      cancel: ServiceSelectionDialog.#onCancel
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/service-selection-dialog.hbs`,
      scrollable: [".dialog-content"]
    }
  };

  /** @override */
  get title() {
    return this.serviceDef?.name || localize("Service.SelectOptions");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const priceType = this.serviceDef?.priceType || PriceType.FIXED;

    // Calculate current price based on selections
    const pricingContext = {
      ...this.context,
      selectedTier: this._selectedTier,
      spellLevel: this._selectedSpellLevel,
      enchantment: this._selectedEnchantment,
      quantity: this._selectedQuantity
    };

    const basePrice = calculateServicePrice(this.serviceDef, pricingContext);
    const totalPrice = basePrice * this._selectedQuantity;

    // Prepare tier data for tiered services
    let tiers = null;
    if (priceType === PriceType.TIERED) {
      tiers = (this.serviceDef.pricingTiers || []).map((tier, index) => ({
        ...tier,
        index,
        selected: index === this._selectedTier,
        priceFormatted: formatCurrency(tier.price * 100),
        // Add specific tier details
        healAmountDisplay: tier.healAmount ? this._formatHealAmount(tier.healAmount) : null,
        spellLevelDisplay: tier.spellLevel ? `${localize("SpellLevel")} ${tier.spellLevel}` : null,
        crMaxDisplay: tier.crMax !== undefined ? `CR ${tier.crMax}` : null
      }));
    }

    return {
      ...context,
      serviceName: this.serviceDef.name,
      serviceDescription: this.serviceDef.description,
      priceType,

      // Item context
      hasItem: !!this.item,
      itemName: this.item?.name,
      itemImg: this.item?.img,
      itemValue: this.item?.system?.price?.value || 0,
      itemValueFormatted: formatCurrency((this.item?.system?.price?.value || 0) * 100),

      // Tiered pricing
      isTiered: priceType === PriceType.TIERED,
      tiers,
      selectedTier: this._selectedTier,

      // Spell level pricing
      isSpellLevel: priceType === PriceType.SPELL_LEVEL,
      spellLevel: this._selectedSpellLevel,
      spellLevelBase: this.serviceDef.spellLevelBase || 25,
      spellLevelMultiplier: this.serviceDef.spellLevelMultiplier || 50,

      // Enchantment pricing
      isEnchantment: priceType === PriceType.ENCHANTMENT,
      selectedEnchantment: this._selectedEnchantment,
      enchantmentName: this._selectedEnchantment?.name,

      // Item value pricing
      isItemValue: priceType === PriceType.ITEM_VALUE,
      itemValuePercent: this.serviceDef.itemValuePercent || 10,
      itemValueMinimum: this.serviceDef.itemValueMinimum || 0,

      // Quantity (for applicable services)
      supportsQuantity: this._supportsQuantity(),
      quantity: this._selectedQuantity,

      // Pricing display
      basePrice,
      basePriceFormatted: formatCurrency(basePrice * 100),
      totalPrice,
      totalPriceFormatted: formatCurrency(totalPrice * 100),
      pricingSummary: getPricingSummary(this.serviceDef),

      // Actor's gold
      actorGold: this.actor?.system?.currency?.gp || 0,
      actorGoldFormatted: formatCurrency((this.actor?.system?.currency?.gp || 0) * 100),
      canAfford: (this.actor?.system?.currency?.gp || 0) >= totalPrice,

      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /**
   * Format heal amount for display
   * @param {string|number} healAmount
   * @returns {string}
   * @private
   */
  _formatHealAmount(healAmount) {
    if (healAmount === 0 || healAmount === "0") return "Full Healing";
    if (typeof healAmount === "string") return healAmount;
    return `${healAmount} HP`;
  }

  /**
   * Check if this service supports quantity selection
   * @returns {boolean}
   * @private
   */
  _supportsQuantity() {
    const type = this.serviceDef?.type;
    // Services that make sense to have quantity
    const quantityServices = ["scribeScroll", "brewPotion", "specialtyAmmo", "companionSale"];
    return quantityServices.includes(type);
  }

  // ==================== Actions ====================

  static async #onSelectTier(event, target) {
    const tierIndex = parseInt(target.dataset.tier);
    if (isNaN(tierIndex)) return;

    this._selectedTier = tierIndex;
    this.render();
  }

  static async #onUpdateSpellLevel(event, target) {
    const value = parseInt(target.value);
    if (isNaN(value)) return;

    // Clamp to valid spell level range
    this._selectedSpellLevel = Math.max(0, Math.min(9, value));
    this.render();
  }

  static async #onUpdateQuantity(event, target) {
    const value = parseInt(target.value);
    if (isNaN(value)) return;

    this._selectedQuantity = Math.max(1, value);
    this.render();
  }

  static async #onPickEnchantment(event, target) {
    // Integration with enchantment picker
    // This would call the existing enchantment selection UI
    try {
      const merchantId = this.merchant?.id;
      if (!merchantId) {
        ui.notifications.warn("No merchant context for enchantment selection");
        return;
      }

      // Call enchantment picker (assumes it exists in the module)
      const enchantmentHandler = game.bobsnpc?.handlers?.enchantment;
      if (!enchantmentHandler) {
        ui.notifications.error("Enchantment system not available");
        return;
      }

      // Open the enchantment picker dialog
      const { EnchantmentPicker } = await import("./enchantment-picker.mjs");
      const enchantmentId = await EnchantmentPicker.pick(merchantId, this.item);
      if (enchantmentId) {
        this._selectedEnchantment = enchantmentHandler.getEnchantment(enchantmentId);
        this.render();
      }

    } catch (error) {
      console.error(`${MODULE_ID} | Error picking enchantment:`, error);
      ui.notifications.error("Failed to open enchantment picker");
    }
  }

  static async #onConfirm(event, target) {
    // Build result with all selections
    const result = {
      confirmed: true,
      tier: this._selectedTier,
      spellLevel: this._selectedSpellLevel,
      quantity: this._selectedQuantity,
      enchantment: this._selectedEnchantment,

      // Calculated pricing
      basePrice: calculateServicePrice(this.serviceDef, {
        ...this.context,
        selectedTier: this._selectedTier,
        spellLevel: this._selectedSpellLevel,
        enchantment: this._selectedEnchantment
      }),
      totalPrice: calculateServicePrice(this.serviceDef, {
        ...this.context,
        selectedTier: this._selectedTier,
        spellLevel: this._selectedSpellLevel,
        enchantment: this._selectedEnchantment
      }) * this._selectedQuantity
    };

    if (this._resolvePromise) {
      this._resolvePromise(result);
    }

    this.close();
  }

  static async #onCancel(event, target) {
    if (this._resolvePromise) {
      this._resolvePromise({ confirmed: false });
    }

    this.close();
  }

  // ==================== Static Factory ====================

  /**
   * Show service selection dialog and wait for user input
   * @param {object} serviceDef - Service definition
   * @param {object} context - Service context (item, merchant, actor, etc.)
   * @param {object} options - Dialog options
   * @returns {Promise<object>} Selection result
   */
  static async show(serviceDef, context = {}, options = {}) {
    return new Promise((resolve, reject) => {
      const dialog = new ServiceSelectionDialog(serviceDef, context, options);
      dialog._resolvePromise = resolve;
      dialog._rejectPromise = reject;
      dialog.render(true);
    });
  }

  /**
   * Determine if a service needs selection dialog
   * @param {object} serviceDef - Service definition
   * @returns {boolean} True if dialog should be shown
   */
  static needsDialog(serviceDef) {
    const priceType = serviceDef?.priceType;

    // Dialog needed for these pricing types
    const needsDialogTypes = [
      PriceType.TIERED,
      PriceType.SPELL_LEVEL,
      PriceType.ENCHANTMENT
    ];

    return needsDialogTypes.includes(priceType);
  }
}
