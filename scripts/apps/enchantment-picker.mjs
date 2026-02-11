/**
 * Bob's Talking NPCs - Enchantment Picker
 * Player dialog for selecting an enchantment from a shop's available options
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize, formatCurrency } from "../utils/helpers.mjs";
import { calculateEnchantmentCost } from "../data/enchantment-model.mjs";
import { getEnchantmentType, categorizeItem, getFullCategoryDisplay } from "../data/item-categories.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Get enchantment handler instance from API
 */
function getEnchantmentHandler() {
  return game.bobsnpc?.handlers?.enchantment;
}

/**
 * Enchantment Picker Dialog
 * Allows players to select an enchantment for their item
 */
export class EnchantmentPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options
   * @param {string} options.merchantId - Merchant/shop ID
   * @param {object} options.item - Item to enchant
   * @param {Function} options.callback - Callback with selected enchantment ID
   */
  constructor(options = {}) {
    super(options);

    this.merchantId = options.merchantId;
    this.item = options.item;
    this.callback = options.callback;
    this._selectedId = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-enchantment-picker",
    classes: ["bobsnpc", "enchantment-picker"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.Enchantment.SelectEnchantment",
      icon: "fa-solid fa-wand-sparkles",
      minimizable: false,
      resizable: true
    },
    position: {
      width: 500,
      height: 450
    },
    actions: {
      selectEnchantment: EnchantmentPicker.#onSelectEnchantment,
      confirm: EnchantmentPicker.#onConfirm,
      cancel: EnchantmentPicker.#onCancel
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/enchantment-picker.hbs`,
      scrollable: [".enchantment-options"]
    }
  };

  /** @override */
  get title() {
    return localize("Enchantment.SelectEnchantment");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const handler = getEnchantmentHandler();
    const merchantHandler = game.bobsnpc?.handlers?.merchant;

    // Get merchant for price modifier
    const merchant = merchantHandler?.getMerchant(this.merchantId);
    const priceModifier = merchant?.services?.enchantmentPriceModifier || 1;

    // Get enchantments available at this shop, filtered by item type
    const itemType = this._getItemEnchantmentType(this.item);
    let enchantments = handler?.getShopEnchantmentsForItem(this.merchantId, itemType) || [];

    // If no specific enchantments are configured, show all compatible ones
    if (enchantments.length === 0) {
      enchantments = handler?.getEnchantmentsByType(itemType) || [];
    }

    // Calculate costs and prepare for display
    const itemRarity = this.item.system?.rarity || "common";
    const preparedEnchantments = enchantments.map(ench => {
      const cost = calculateEnchantmentCost(ench, itemRarity, priceModifier);
      return {
        ...ench,
        cost,
        costFormatted: formatCurrency(cost * 100),
        typeLabel: localize(`Enchantment.Types.${ench.type}`),
        rarityLabel: localize(`Enchantment.Rarity.${ench.rarity}`),
        effectsList: ench.effects?.join(", ") || "",
        isSelected: ench.id === this._selectedId
      };
    });

    // Get selected enchantment details
    const selectedEnchantment = preparedEnchantments.find(e => e.id === this._selectedId);

    return {
      ...context,
      item: {
        name: this.item.name,
        img: this.item.img,
        rarity: itemRarity,
        rarityLabel: this._getRarityLabel(itemRarity)
      },
      enchantments: preparedEnchantments,
      hasEnchantments: preparedEnchantments.length > 0,
      selectedEnchantment,
      hasSelection: this._selectedId !== null,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /**
   * Get the enchantment type for an item
   * Uses the new comprehensive item categorization system
   * @param {object} item
   * @returns {string}
   * @private
   */
  _getItemEnchantmentType(item) {
    return getEnchantmentType(item);
  }

  /**
   * Get rarity label
   * @param {string} rarity
   * @returns {string}
   * @private
   */
  _getRarityLabel(rarity) {
    const labels = {
      common: "Common",
      uncommon: "Uncommon",
      rare: "Rare",
      veryRare: "Very Rare",
      legendary: "Legendary",
      artifact: "Artifact"
    };
    return labels[rarity] || "Common";
  }

  // ==================== Actions ====================

  static #onSelectEnchantment(event, target) {
    const enchantmentId = target.dataset.enchantmentId;
    this._selectedId = enchantmentId;
    this.render();
  }

  static async #onConfirm(event, target) {
    if (!this._selectedId) {
      ui.notifications.warn(localize("Enchantment.SelectEnchantment"));
      return;
    }

    if (this.callback) {
      this.callback(this._selectedId);
    }

    await this.close();
  }

  static async #onCancel(event, target) {
    if (this.callback) {
      this.callback(null);
    }
    await this.close();
  }

  // ==================== Static Factory ====================

  /**
   * Open the enchantment picker
   * @param {string} merchantId - Merchant/shop ID
   * @param {object} item - Item to enchant
   * @returns {Promise<string|null>} Selected enchantment ID or null
   */
  static async pick(merchantId, item) {
    return new Promise((resolve) => {
      const picker = new EnchantmentPicker({
        merchantId,
        item,
        callback: resolve
      });
      picker.render(true);
    });
  }
}
