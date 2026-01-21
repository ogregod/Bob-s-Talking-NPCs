/**
 * Bob's Talking NPCs - Shop Window
 * Merchant interface for buying/selling items using Foundry V13 ApplicationV2
 */

import { MODULE_ID } from "../module.mjs";
import { localize, formatCurrency } from "../utils/helpers.mjs";
import { merchantHandler } from "../handlers/merchant-handler.mjs";
import { ItemCategory } from "../data/merchant-model.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Shop Window Application
 * Displays merchant inventory with buy/sell functionality
 */
export class ShopWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options - Application options
   * @param {string} options.merchantId - Merchant NPC UUID
   * @param {string} options.playerActorUuid - Player actor UUID
   */
  constructor(options = {}) {
    super(options);

    this.merchantId = options.merchantId;
    this.playerActorUuid = options.playerActorUuid;

    this._merchantActor = null;
    this._playerActor = null;
    this._session = null;
    this._sessionId = null;

    this._tab = "buy"; // buy, sell, services
    this._category = "all";
    this._searchQuery = "";
    this._cart = new Map(); // itemId -> quantity
    this._sellCart = new Map(); // itemUuid -> quantity

    this._sortBy = "name"; // name, price, category
    this._sortAsc = true;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-shop",
    classes: ["bobsnpc", "shop-window"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.Shop.Title",
      icon: "fa-solid fa-store",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 800,
      height: 650
    },
    actions: {
      setTab: ShopWindow.#onSetTab,
      setCategory: ShopWindow.#onSetCategory,
      search: ShopWindow.#onSearch,
      sort: ShopWindow.#onSort,
      addToCart: ShopWindow.#onAddToCart,
      removeFromCart: ShopWindow.#onRemoveFromCart,
      updateCartQuantity: ShopWindow.#onUpdateCartQuantity,
      addToSellCart: ShopWindow.#onAddToSellCart,
      removeFromSellCart: ShopWindow.#onRemoveFromSellCart,
      checkout: ShopWindow.#onCheckout,
      sell: ShopWindow.#onSell,
      haggle: ShopWindow.#onHaggle,
      useService: ShopWindow.#onUseService,
      close: ShopWindow.#onCloseShop
    }
  };

  /** @override */
  static PARTS = {
    header: {
      template: `modules/${MODULE_ID}/templates/shop/header.hbs`
    },
    tabs: {
      template: `modules/${MODULE_ID}/templates/shop/tabs.hbs`
    },
    inventory: {
      template: `modules/${MODULE_ID}/templates/shop/inventory.hbs`,
      scrollable: [".shop-items"]
    },
    cart: {
      template: `modules/${MODULE_ID}/templates/shop/cart.hbs`,
      scrollable: [".cart-items"]
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/shop/footer.hbs`
    }
  };

  /** @override */
  get title() {
    return this._merchantActor?.name || localize("Shop.Title");
  }

  /** @override */
  async _preFirstRender(context, options) {
    await super._preFirstRender(context, options);

    // Load actors
    this._merchantActor = await fromUuid(this.merchantId);
    this._playerActor = await fromUuid(this.playerActorUuid);

    if (!this._merchantActor) {
      throw new Error(localize("Errors.ActorNotFound"));
    }

    // Open shop session
    const result = await merchantHandler.openShop(this.merchantId, this.playerActorUuid);
    this._session = result.session;
    this._sessionId = result.sessionId;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const merchant = merchantHandler.getMerchant(this.merchantId);
    const playerGold = this._getPlayerGold();

    // Get inventory based on tab
    let items = [];
    if (this._tab === "buy") {
      items = this._prepareBuyItems(merchant);
    } else if (this._tab === "sell") {
      items = this._prepareSellItems();
    }

    // Apply filters
    items = this._filterItems(items);
    items = this._sortItems(items);

    // Calculate cart totals
    const cartTotal = this._calculateCartTotal(merchant);
    const sellTotal = this._calculateSellTotal(merchant);

    // Get categories
    const categories = this._getCategories(merchant);

    // Get services if available
    const services = this._tab === "services" ? this._prepareServices(merchant) : [];

    return {
      ...context,
      merchant: {
        name: this._merchantActor.name,
        portrait: this._merchantActor.img,
        uuid: this.merchantId,
        goldAvailable: merchant?.gold ?? 0,
        buysItems: merchant?.buysItems ?? true,
        buyMultiplier: merchant?.buyMultiplier ?? 0.5
      },
      player: {
        name: this._playerActor?.name,
        uuid: this.playerActorUuid,
        gold: playerGold,
        goldFormatted: formatCurrency(playerGold)
      },
      tab: this._tab,
      category: this._category,
      searchQuery: this._searchQuery,
      sortBy: this._sortBy,
      sortAsc: this._sortAsc,
      categories,
      items,
      cart: this._prepareCart(merchant),
      cartTotal,
      cartTotalFormatted: formatCurrency(cartTotal),
      canAfford: playerGold >= cartTotal,
      sellCart: this._prepareSellCart(merchant),
      sellTotal,
      sellTotalFormatted: formatCurrency(sellTotal),
      services,
      hasServices: services.length > 0,
      settings: {
        hagglingEnabled: game.settings.get(MODULE_ID, "hagglingEnabled"),
        charismaAffectsPrices: game.settings.get(MODULE_ID, "charismaAffectsPrices")
      },
      isGM: game.user.isGM,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /**
   * Prepare buy items from merchant inventory
   * @param {object} merchant - Merchant data
   * @returns {object[]}
   * @private
   */
  _prepareBuyItems(merchant) {
    if (!merchant?.inventory) return [];

    return merchant.inventory.map(item => {
      const inCart = this._cart.get(item.id) || 0;
      const price = this._calculateBuyPrice(item, merchant);

      return {
        id: item.id,
        uuid: item.itemUuid,
        name: item.name,
        img: item.img,
        price,
        priceFormatted: formatCurrency(price),
        originalPrice: item.basePrice,
        discount: item.discount || 0,
        quantity: item.quantity,
        unlimited: item.unlimited,
        inStock: item.unlimited || item.quantity > inCart,
        inCart,
        category: item.category,
        categoryLabel: localize(`ItemCategory.${item.category}`),
        description: item.description,
        rarity: item.rarity,
        rarityClass: `rarity-${item.rarity || "common"}`
      };
    });
  }

  /**
   * Prepare player items for selling
   * @returns {object[]}
   * @private
   */
  _prepareSellItems() {
    if (!this._playerActor) return [];

    const items = this._playerActor.items.filter(item => {
      // Filter out equipped items, containers, etc.
      const type = item.type;
      return ["weapon", "equipment", "consumable", "tool", "loot"].includes(type);
    });

    const merchant = merchantHandler.getMerchant(this.merchantId);
    const buyMultiplier = merchant?.buyMultiplier ?? 0.5;

    return items.map(item => {
      const basePrice = item.system.price?.value || 0;
      const sellPrice = Math.floor(basePrice * buyMultiplier);
      const inSellCart = this._sellCart.get(item.uuid) || 0;
      const quantity = item.system.quantity || 1;

      return {
        id: item.id,
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        price: sellPrice,
        priceFormatted: formatCurrency(sellPrice),
        basePrice,
        quantity,
        availableToSell: quantity - inSellCart,
        inSellCart,
        category: this._getItemCategory(item),
        categoryLabel: localize(`ItemCategory.${this._getItemCategory(item)}`),
        rarity: item.system.rarity || "common",
        rarityClass: `rarity-${item.system.rarity || "common"}`
      };
    });
  }

  /**
   * Get item category for D&D 5e items
   * @param {Item} item - Item document
   * @returns {string}
   * @private
   */
  _getItemCategory(item) {
    switch (item.type) {
      case "weapon": return ItemCategory.WEAPONS;
      case "equipment":
        if (item.system.armor?.type) return ItemCategory.ARMOR;
        return ItemCategory.GEAR;
      case "consumable":
        if (item.system.consumableType === "potion") return ItemCategory.POTIONS;
        if (item.system.consumableType === "scroll") return ItemCategory.SCROLLS;
        return ItemCategory.CONSUMABLES;
      case "tool": return ItemCategory.TOOLS;
      case "loot": return ItemCategory.MISC;
      default: return ItemCategory.MISC;
    }
  }

  /**
   * Calculate buy price with modifiers
   * @param {object} item - Item data
   * @param {object} merchant - Merchant data
   * @returns {number}
   * @private
   */
  _calculateBuyPrice(item, merchant) {
    let price = item.basePrice || 0;

    // Apply discount
    if (item.discount > 0) {
      price *= (1 - item.discount);
    }

    // Apply price multiplier from merchant
    if (merchant?.priceMultiplier) {
      price *= merchant.priceMultiplier;
    }

    // Apply charisma modifier if enabled
    if (game.settings.get(MODULE_ID, "charismaAffectsPrices") && this._playerActor) {
      const cha = this._playerActor.system.abilities?.cha?.mod || 0;
      price *= (1 - cha * 0.02); // 2% discount per CHA mod
    }

    return Math.max(1, Math.round(price));
  }

  /**
   * Filter items based on category and search
   * @param {object[]} items - Items to filter
   * @returns {object[]}
   * @private
   */
  _filterItems(items) {
    let filtered = items;

    // Category filter
    if (this._category !== "all") {
      filtered = filtered.filter(item => item.category === this._category);
    }

    // Search filter
    if (this._searchQuery) {
      const query = this._searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  /**
   * Sort items
   * @param {object[]} items - Items to sort
   * @returns {object[]}
   * @private
   */
  _sortItems(items) {
    const sorted = [...items];
    const mult = this._sortAsc ? 1 : -1;

    switch (this._sortBy) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name) * mult);
        break;
      case "price":
        sorted.sort((a, b) => (a.price - b.price) * mult);
        break;
      case "category":
        sorted.sort((a, b) => a.category.localeCompare(b.category) * mult);
        break;
    }

    return sorted;
  }

  /**
   * Get available categories
   * @param {object} merchant - Merchant data
   * @returns {object[]}
   * @private
   */
  _getCategories(merchant) {
    const categories = new Set(["all"]);

    if (this._tab === "buy" && merchant?.inventory) {
      merchant.inventory.forEach(item => {
        if (item.category) categories.add(item.category);
      });
    } else if (this._tab === "sell" && this._playerActor) {
      this._playerActor.items.forEach(item => {
        categories.add(this._getItemCategory(item));
      });
    }

    return Array.from(categories).map(cat => ({
      id: cat,
      label: cat === "all" ? localize("Shop.AllCategories") : localize(`ItemCategory.${cat}`),
      selected: cat === this._category
    }));
  }

  /**
   * Prepare cart for display
   * @param {object} merchant - Merchant data
   * @returns {object[]}
   * @private
   */
  _prepareCart(merchant) {
    const cartItems = [];

    for (const [itemId, quantity] of this._cart.entries()) {
      const item = merchant?.inventory?.find(i => i.id === itemId);
      if (!item) continue;

      const price = this._calculateBuyPrice(item, merchant);

      cartItems.push({
        id: itemId,
        name: item.name,
        img: item.img,
        quantity,
        price,
        priceFormatted: formatCurrency(price),
        total: price * quantity,
        totalFormatted: formatCurrency(price * quantity)
      });
    }

    return cartItems;
  }

  /**
   * Calculate cart total
   * @param {object} merchant - Merchant data
   * @returns {number}
   * @private
   */
  _calculateCartTotal(merchant) {
    let total = 0;

    for (const [itemId, quantity] of this._cart.entries()) {
      const item = merchant?.inventory?.find(i => i.id === itemId);
      if (!item) continue;

      const price = this._calculateBuyPrice(item, merchant);
      total += price * quantity;
    }

    return total;
  }

  /**
   * Prepare sell cart for display
   * @param {object} merchant - Merchant data
   * @returns {object[]}
   * @private
   */
  _prepareSellCart(merchant) {
    const cartItems = [];
    const buyMultiplier = merchant?.buyMultiplier ?? 0.5;

    for (const [itemUuid, quantity] of this._sellCart.entries()) {
      const item = this._playerActor?.items.find(i => i.uuid === itemUuid);
      if (!item) continue;

      const basePrice = item.system.price?.value || 0;
      const price = Math.floor(basePrice * buyMultiplier);

      cartItems.push({
        uuid: itemUuid,
        name: item.name,
        img: item.img,
        quantity,
        price,
        priceFormatted: formatCurrency(price),
        total: price * quantity,
        totalFormatted: formatCurrency(price * quantity)
      });
    }

    return cartItems;
  }

  /**
   * Calculate sell cart total
   * @param {object} merchant - Merchant data
   * @returns {number}
   * @private
   */
  _calculateSellTotal(merchant) {
    let total = 0;
    const buyMultiplier = merchant?.buyMultiplier ?? 0.5;

    for (const [itemUuid, quantity] of this._sellCart.entries()) {
      const item = this._playerActor?.items.find(i => i.uuid === itemUuid);
      if (!item) continue;

      const basePrice = item.system.price?.value || 0;
      const price = Math.floor(basePrice * buyMultiplier);
      total += price * quantity;
    }

    return total;
  }

  /**
   * Prepare services for display
   * @param {object} merchant - Merchant data
   * @returns {object[]}
   * @private
   */
  _prepareServices(merchant) {
    if (!merchant?.services) return [];

    return merchant.services.map(service => ({
      ...service,
      priceFormatted: formatCurrency(service.price),
      icon: this._getServiceIcon(service.type)
    }));
  }

  /**
   * Get service icon
   * @param {string} type - Service type
   * @returns {string}
   * @private
   */
  _getServiceIcon(type) {
    const icons = {
      repair: "fa-wrench",
      identify: "fa-search",
      enchant: "fa-magic",
      upgrade: "fa-arrow-up",
      custom: "fa-cog"
    };
    return icons[type] || "fa-cog";
  }

  /**
   * Get player gold amount
   * @returns {number}
   * @private
   */
  _getPlayerGold() {
    if (!this._playerActor) return 0;

    const currency = this._playerActor.system.currency;
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
    this._category = "all";
    this._cart.clear();
    this._sellCart.clear();
    this.render();
  }

  static #onSetCategory(event, target) {
    this._category = target.dataset.category;
    this.render();
  }

  static #onSearch(event, target) {
    this._searchQuery = target.value;
    this.render();
  }

  static #onSort(event, target) {
    const sortBy = target.dataset.sort;
    if (this._sortBy === sortBy) {
      this._sortAsc = !this._sortAsc;
    } else {
      this._sortBy = sortBy;
      this._sortAsc = true;
    }
    this.render();
  }

  static #onAddToCart(event, target) {
    const itemId = target.dataset.itemId;
    const current = this._cart.get(itemId) || 0;
    this._cart.set(itemId, current + 1);
    this.render();
  }

  static #onRemoveFromCart(event, target) {
    const itemId = target.dataset.itemId;
    const current = this._cart.get(itemId) || 0;
    if (current <= 1) {
      this._cart.delete(itemId);
    } else {
      this._cart.set(itemId, current - 1);
    }
    this.render();
  }

  static #onUpdateCartQuantity(event, target) {
    const itemId = target.dataset.itemId;
    const quantity = parseInt(target.value) || 0;
    if (quantity <= 0) {
      this._cart.delete(itemId);
    } else {
      this._cart.set(itemId, quantity);
    }
    this.render();
  }

  static #onAddToSellCart(event, target) {
    const itemUuid = target.dataset.itemUuid;
    const current = this._sellCart.get(itemUuid) || 0;
    this._sellCart.set(itemUuid, current + 1);
    this.render();
  }

  static #onRemoveFromSellCart(event, target) {
    const itemUuid = target.dataset.itemUuid;
    const current = this._sellCart.get(itemUuid) || 0;
    if (current <= 1) {
      this._sellCart.delete(itemUuid);
    } else {
      this._sellCart.set(itemUuid, current - 1);
    }
    this.render();
  }

  static async #onCheckout(event, target) {
    if (this._cart.size === 0) return;

    const purchases = [];
    for (const [itemId, quantity] of this._cart.entries()) {
      purchases.push({ itemId, quantity });
    }

    try {
      const result = await merchantHandler.purchaseItems(this._sessionId, purchases);

      if (result.success) {
        ui.notifications.info(localize("Shop.PurchaseComplete", {
          count: result.itemsReceived,
          total: formatCurrency(result.totalCost)
        }));
        this._cart.clear();
        this.render();
      } else {
        ui.notifications.error(result.error);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onSell(event, target) {
    if (this._sellCart.size === 0) return;

    const sales = [];
    for (const [itemUuid, quantity] of this._sellCart.entries()) {
      sales.push({ itemUuid, quantity });
    }

    try {
      const result = await merchantHandler.sellItems(this._sessionId, sales);

      if (result.success) {
        ui.notifications.info(localize("Shop.SaleComplete", {
          count: result.itemsSold,
          total: formatCurrency(result.totalEarned)
        }));
        this._sellCart.clear();
        this.render();
      } else {
        ui.notifications.error(result.error);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onHaggle(event, target) {
    const itemId = target.dataset.itemId;
    const skill = target.dataset.skill || "persuasion";

    // Roll the skill check
    const roll = await this._playerActor.rollSkill(skill, { chatMessage: true });

    try {
      const result = await merchantHandler.attemptHaggle(
        this._sessionId,
        itemId,
        skill,
        roll.total
      );

      if (result.success) {
        ui.notifications.info(localize("Shop.HaggleSuccess", {
          discount: Math.round(result.discount * 100)
        }));
      } else {
        ui.notifications.warn(localize("Shop.HaggleFailed"));
      }

      this.render();
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onUseService(event, target) {
    const serviceId = target.dataset.serviceId;
    // Service usage would be implemented based on service type
    ui.notifications.info(localize("Shop.ServiceUsed"));
  }

  static async #onCloseShop(event, target) {
    await this.close();
  }

  /** @override */
  async _onClose(options) {
    await super._onClose(options);

    // Close shop session
    if (this._sessionId) {
      await merchantHandler.closeShop(this._sessionId);
    }
  }

  // ==================== Static Factory ====================

  /**
   * Open shop window
   * @param {string} merchantId - Merchant NPC UUID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {ShopWindow}
   */
  static async open(merchantId, playerActorUuid) {
    const window = new ShopWindow({ merchantId, playerActorUuid });
    await window.render(true);
    return window;
  }
}
