/**
 * Bob's Talking NPCs - Shop Window
 * Merchant interface for buying/selling items using Foundry V13 ApplicationV2
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";

import { localize, formatCurrency } from "../utils/helpers.mjs";
import { ItemCategory } from "../data/merchant-model.mjs";
import {
  categorizeItem,
  getCategoryLabel,
  getFullCategoryDisplay,
  getAllCategories,
  getSubcategories,
  ItemCategory as ItemCat,
  WeaponSubcategory,
  ArmorSubcategory
} from "../data/item-categories.mjs";

/** Get merchant handler instance from API */
function getMerchantHandler() {
  return game.bobsnpc?.handlers?.merchant;
}

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
      height: 650,
      top: 50
    },
    actions: {
      setTab: ShopWindow.#onSetTab,
      setCategory: ShopWindow.#onSetCategory,
      search: ShopWindow.#onSearch,
      sort: ShopWindow.#onSort,
      addToCart: ShopWindow.#onAddToCart,
      removeFromCart: ShopWindow.#onRemoveFromCart,
      incrementQuantity: ShopWindow.#onIncrementQuantity,
      decrementQuantity: ShopWindow.#onDecrementQuantity,
      clearCart: ShopWindow.#onClearCart,
      updateCartQuantity: ShopWindow.#onUpdateCartQuantity,
      addToSellCart: ShopWindow.#onAddToSellCart,
      removeFromSellCart: ShopWindow.#onRemoveFromSellCart,
      checkout: ShopWindow.#onCheckout,
      sell: ShopWindow.#onSell,
      haggle: ShopWindow.#onHaggle,
      useService: ShopWindow.#onUseService,
      viewOrders: ShopWindow.#onViewOrders,
      openServiceManagement: ShopWindow.#onOpenServiceManagement,
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

    console.log(`${MODULE_ID} | ShopWindow._preFirstRender - merchantId: ${this.merchantId}`);

    // Load player actor
    this._playerActor = await fromUuid(this.playerActorUuid);

    // merchantId can be either a shop ID or an NPC actor UUID
    // First, try to load as actor UUID
    this._merchantActor = await fromUuid(this.merchantId);
    console.log(`${MODULE_ID} | ShopWindow - fromUuid result:`, this._merchantActor?.name || "null");

    if (!this._merchantActor) {
      // If not an actor UUID, it might be a shop ID - get shop data and find the NPC
      const handler = getMerchantHandler();
      let shopData = handler?.getMerchant(this.merchantId);
      console.log(`${MODULE_ID} | ShopWindow - handler.getMerchant result:`, shopData?.name || "null");

      // Also check settings fallback
      if (!shopData) {
        const shopsSettings = game.settings.get(MODULE_ID, "shops") || {};
        shopData = shopsSettings[this.merchantId];
        console.log(`${MODULE_ID} | ShopWindow - settings fallback result:`, shopData?.name || "null");
      }

      if (shopData?.npcActorUuid) {
        console.log(`${MODULE_ID} | ShopWindow - loading NPC from shop data: ${shopData.npcActorUuid}`);
        this._merchantActor = await fromUuid(shopData.npcActorUuid);
        // Store the shop ID for later use
        this._shopId = this.merchantId;
      }
    }

    // Always ensure we have a merchant actor (even if just a fallback)
    if (!this._merchantActor) {
      console.warn(`${MODULE_ID} | Could not find merchant actor for: ${this.merchantId}`);
      // Create a fallback merchant actor representation
      this._merchantActor = {
        name: localize("Shop.UnknownMerchant"),
        img: "icons/svg/mystery-man.svg"
      };
    }

    console.log(`${MODULE_ID} | ShopWindow - final merchantActor:`, this._merchantActor?.name);

    // Open shop session
    try {
      const handler = getMerchantHandler();
      if (handler?.openShop) {
        const result = await handler.openShop(this.merchantId, this.playerActorUuid);
        this._session = result?.session;
        this._sessionId = result?.sessionId;
      }
    } catch (e) {
      console.warn(`${MODULE_ID} | Could not open shop session:`, e);
    }
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const merchant = this._getMerchant();
    const playerGold = this._getPlayerGold();

    // Get inventory based on tab
    let items = [];
    if (this._tab === "buy") {
      items = await this._prepareBuyItems(merchant);
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

    // Get services if available - always prepare to check hasServices
    const services = this._prepareServices(merchant);
    const hasServices = services.length > 0;

    // Ensure we have merchant actor data (defensive)
    const merchantName = this._merchantActor?.name || localize("Shop.UnknownMerchant");
    const merchantImg = this._merchantActor?.img || "icons/svg/mystery-man.svg";

    // Get price modifier info
    const priceMultiplier = merchant?.priceMultiplier ?? 1;
    const priceModifier = priceMultiplier !== 1 ? priceMultiplier : null;
    const priceModifierPercent = priceModifier ? Math.abs(Math.round((priceMultiplier - 1) * 100)) : 0;
    const discountPercent = priceModifier && priceModifier < 1 ? Math.round((1 - priceMultiplier) * 100) : 0;

    // Generate merchant greeting
    const merchantGreeting = this._getMerchantGreeting();

    // Get active service orders for this player at this shop
    const merchantHandler = getMerchantHandler();
    const activeOrders = merchantHandler?.getPlayerServiceOrders(this.playerActorUuid) || [];
    const shopOrders = activeOrders.filter(o => o.merchantId === (this._shopId || this.merchantId));
    const hasActiveOrders = shopOrders.length > 0;
    const activeOrderCount = shopOrders.length;
    const readyOrderCount = shopOrders.filter(o => o.isReady).length;

    return {
      ...context,
      // Header data
      shopName: merchant?.name || merchantName,
      shopIcon: merchant?.icon || "fa-store",
      shopColor: merchant?.color || "#7c4dff",
      merchantName,
      merchantPortrait: merchantImg,
      merchantGreeting,
      priceModifier,
      priceModifierPercent,
      discountPercent,
      reputationDiscount: merchant?.reputationDiscount || null,
      hagglingEnabled: merchant?.haggling?.enabled ?? false,
      playerGold: Math.floor(playerGold),
      hasActiveOrders,
      activeOrderCount,
      readyOrderCount,

      // Legacy merchant object for compatibility
      merchant: {
        name: merchantName,
        portrait: merchantImg,
        uuid: this.merchantId,
        goldAvailable: merchant?.gold ?? 0,
        buysItems: merchant?.buysItems ?? true,
        buyMultiplier: merchant?.buyMultiplier ?? 0.5
      },
      player: {
        name: this._playerActor?.name,
        uuid: this.playerActorUuid,
        gold: playerGold,
        goldFormatted: formatCurrency(playerGold * 100)
      },
      // Tabs
      activeTab: this._tab,
      tab: this._tab,
      category: this._category,
      searchQuery: this._searchQuery,
      sortBy: this._sortBy,
      sortAsc: this._sortAsc,
      categories,
      // Items
      items,
      hasItems: items.length > 0,
      playerItems: this._tab === "sell" ? items : [],
      hasPlayerItems: this._tab === "sell" && items.length > 0,
      // Cart
      cartItems: await this._prepareCart(merchant),
      cartTotal,
      cartTotalFormatted: formatCurrency(cartTotal * 100),
      canAfford: playerGold >= cartTotal,
      cartItemCount: this._cart.size,
      cartEmpty: this._cart.size === 0,
      // Sell cart
      sellCart: this._prepareSellCart(merchant),
      sellTotal,
      sellTotalFormatted: formatCurrency(sellTotal * 100),
      // Services
      services,
      hasServices,
      // Settings
      settings: {
        hagglingEnabled: game.settings.get(MODULE_ID, "hagglingEnabled"),
        charismaAffectsPrices: game.settings.get(MODULE_ID, "charismaAffectsPrices")
      },
      isGM: game.user.isGM,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /**
   * Get a random merchant greeting message
   * @returns {string}
   * @private
   */
  _getMerchantGreeting() {
    const greetings = [
      "Welcome, friend!",
      "Browse my wares!",
      "Fine goods today!",
      "What can I get you?",
      "Special deals today!",
      "Quality merchandise!",
      "Come, take a look!",
      "Best prices in town!",
      "Greetings, traveler!",
      "Looking to buy?"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  /**
   * Get merchant data - tries multiple lookup methods
   * @returns {object|null}
   * @private
   */
  _getMerchant() {
    const handler = getMerchantHandler();

    // If we have a stored shop ID (from when merchantId was a shop ID), use it first
    if (this._shopId) {
      let merchant = handler?.getMerchant(this._shopId);
      if (!merchant) {
        // Check settings fallback
        const shopsSettings = game.settings.get(MODULE_ID, "shops") || {};
        merchant = shopsSettings[this._shopId];
      }
      if (merchant) return merchant;
    }

    // Try by shop ID (merchantId might be a shop ID)
    let merchant = handler?.getMerchant(this.merchantId);
    if (!merchant) {
      // Check settings fallback
      const shopsSettings = game.settings.get(MODULE_ID, "shops") || {};
      merchant = shopsSettings[this.merchantId];
    }

    if (!merchant) {
      // Try by NPC UUID
      merchant = handler?.getMerchantForNPC?.(this.merchantId);
    }

    if (!merchant && this._merchantActor?.uuid) {
      // Try getting shop ID from NPC config
      const npcConfig = this._merchantActor.getFlag?.(MODULE_ID, "config");
      const shopId = npcConfig?.services?.merchant?.shopId;
      if (shopId) {
        merchant = handler?.getMerchant(shopId);
        if (!merchant) {
          const shopsSettings = game.settings.get(MODULE_ID, "shops") || {};
          merchant = shopsSettings[shopId];
        }
      }
    }

    return merchant;
  }

  /**
   * Get default image for an item based on its type/category
   * @param {object} item - Item data
   * @returns {string} Image path
   * @private
   */
  _getDefaultItemImage(item) {
    // If item has a valid image, use it
    if (item.img && item.img !== "icons/svg/item-bag.svg" && item.img !== "") {
      return item.img;
    }

    // Default images by category
    const categoryDefaults = {
      weapons: "icons/weapons/swords/sword-guard-steel.webp",
      armor: "icons/equipment/chest/breastplate-layered-steel.webp",
      potions: "icons/consumables/potions/potion-bottle-corked-red.webp",
      scrolls: "icons/sundries/scrolls/scroll-runed-brown-purple.webp",
      consumables: "icons/sundries/misc/bag-leather-brown-tan.webp",
      gear: "icons/equipment/back/backpack-leather-tan.webp",
      tools: "icons/tools/smithing/hammer-double-yellow.webp",
      misc: "icons/sundries/misc/sack-leather-brown.webp",
      wondrous: "icons/equipment/neck/amulet-round-glow-blue.webp",
      jewelry: "icons/equipment/finger/ring-gold-gem-red.webp",
      food: "icons/consumables/food/meat-roasted-leg-brown.webp",
      ammunition: "icons/weapons/ammunition/arrows-bodkin-leather.webp",
      clothing: "icons/equipment/back/cloak-heavy-purple.webp"
    };

    // Default images by item type (for DnD 5e)
    const typeDefaults = {
      weapon: "icons/weapons/swords/sword-guard-steel.webp",
      equipment: "icons/equipment/chest/breastplate-layered-steel.webp",
      consumable: "icons/consumables/potions/potion-bottle-corked-red.webp",
      tool: "icons/tools/smithing/hammer-double-yellow.webp",
      loot: "icons/sundries/misc/sack-leather-brown.webp",
      container: "icons/sundries/misc/chest-wood-gold.webp",
      spell: "icons/magic/light/explosion-star-glow-silhouette.webp",
      feat: "icons/svg/book.svg",
      class: "icons/svg/combat.svg",
      subclass: "icons/svg/combat.svg",
      background: "icons/svg/book.svg",
      race: "icons/svg/mystery-man.svg"
    };

    // Try category first
    const category = item.category?.toLowerCase() || "";
    if (categoryDefaults[category]) {
      return categoryDefaults[category];
    }

    // Try item type
    const type = item.type?.toLowerCase() || "";
    if (typeDefaults[type]) {
      return typeDefaults[type];
    }

    // Ultimate fallback
    return "icons/svg/item-bag.svg";
  }

  /**
   * Prepare buy items from merchant inventory
   * @param {object} merchant - Merchant data
   * @returns {Promise<object[]>}
   * @private
   */
  async _prepareBuyItems(merchant) {
    if (!merchant?.inventory) return [];

    const playerGold = this._getPlayerGold();
    const items = [];

    for (const item of merchant.inventory) {
      const inCart = this._cart.get(item.id) || 0;
      const price = this._calculateBuyPrice(item, merchant);
      const quantity = item.quantity ?? -1;
      const soldOut = !item.unlimited && quantity !== -1 && quantity <= 0;

      // Fetch actual item data from UUID if available
      let itemImg = item.img;
      let linkedItem = null;
      if (item.itemUuid) {
        try {
          linkedItem = await fromUuid(item.itemUuid);
          if (linkedItem && !itemImg) {
            itemImg = linkedItem.img;
          }
        } catch (e) {
          console.warn(`Could not load item for ${item.itemUuid}:`, e);
        }
      }

      // Get category info - use linked item for proper D&D 5e categorization if available
      let categoryInfo;
      if (linkedItem) {
        categoryInfo = this._getItemCategoryInfo(linkedItem);
      } else {
        // Fallback to stored category
        categoryInfo = {
          category: item.category || "misc",
          subcategory: item.subcategory || null,
          displayCategory: getCategoryLabel(item.category || "misc"),
          displaySubcategory: null
        };
      }

      items.push({
        id: item.id,
        uuid: item.itemUuid,
        name: item.name,
        img: itemImg || this._getDefaultItemImage(item),
        price,
        priceFormatted: formatCurrency(price * 100),
        originalPrice: item.basePrice !== price ? item.basePrice : null,
        discounted: item.basePrice && item.basePrice > price,
        discount: item.discount || 0,
        quantity: item.unlimited || quantity === -1 ? null : quantity,
        unlimited: item.unlimited || quantity === -1,
        inStock: item.unlimited || quantity === -1 || quantity > inCart,
        soldOut,
        inCart,
        category: categoryInfo.category,
        subcategory: categoryInfo.subcategory,
        categoryLabel: getFullCategoryDisplay(categoryInfo),
        description: item.description,
        rarity: item.rarity || "common",
        rarityLabel: this._getRarityLabel(item.rarity),
        rarityClass: `rarity-${item.rarity || "common"}`,
        // New properties for enhanced UI
        canAfford: playerGold >= price,
        limitedStock: !item.unlimited && quantity !== -1 && quantity > 0 && quantity <= 5,
        typeLabel: categoryInfo.displayCategory || item.typeLabel || item.type || "Item"
      });
    }

    return items;
  }

  /**
   * Get human-readable rarity label
   * @param {string} rarity - Rarity key
   * @returns {string}
   * @private
   */
  _getRarityLabel(rarity) {
    const labels = {
      common: "Common",
      uncommon: "Uncommon",
      rare: "Rare",
      veryrare: "Very Rare",
      legendary: "Legendary",
      artifact: "Artifact"
    };
    return labels[rarity] || "Common";
  }

  /**
   * Prepare player items for selling
   * @returns {object[]}
   * @private
   */
  _prepareSellItems() {
    if (!this._playerActor) return [];

    const merchant = this._getMerchant();
    const defaultMultiplier = merchant?.pricing?.baseSellMultiplier ?? 0.5;
    const typeMultipliers = merchant?.buyBack?.typeMultipliers || {};
    const acceptedTypes = merchant?.buyBack?.itemTypes || [];

    const items = this._playerActor.items.filter(item => {
      // Filter out equipped items, containers, etc.
      const type = item.type;
      const validTypes = ["weapon", "equipment", "consumable", "tool", "loot"];
      if (!validTypes.includes(type)) return false;

      // Check if shop accepts this type (empty array = all types)
      if (acceptedTypes.length > 0 && !acceptedTypes.includes(type)) {
        return false;
      }

      return true;
    });

    return items.map(item => {
      const basePrice = item.system.price?.value || 0;
      // Use type-specific multiplier if available
      const multiplier = typeMultipliers[item.type] ?? defaultMultiplier;
      const sellPrice = Math.floor(basePrice * multiplier);
      const inSellCart = this._sellCart.get(item.uuid) || 0;
      const quantity = item.system.quantity || 1;

      const categoryInfo = this._getItemCategoryInfo(item);

      return {
        id: item.id,
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        type: item.type,
        typeLabel: localize(`ItemTypes.${item.type}`),
        price: sellPrice,
        priceFormatted: formatCurrency(sellPrice * 100),
        sellPrice,
        basePrice,
        quantity,
        availableToSell: quantity - inSellCart,
        inSellCart,
        sellable: true,  // Items that pass the filter are sellable
        category: categoryInfo.category,
        subcategory: categoryInfo.subcategory,
        categoryLabel: getFullCategoryDisplay(categoryInfo),
        rarity: item.system.rarity || "common",
        rarityClass: `rarity-${item.system.rarity || "common"}`,
        multiplier,
        multiplierPercent: Math.round(multiplier * 100)
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
    const info = categorizeItem(item);
    return info.category;
  }

  /**
   * Get full item categorization info
   * @param {Item} item - Item document
   * @returns {object} { category, subcategory, displayCategory, displaySubcategory }
   * @private
   */
  _getItemCategoryInfo(item) {
    return categorizeItem(item);
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
      label: cat === "all" ? localize("Shop.AllCategories") : getCategoryLabel(cat),
      selected: cat === this._category
    }));
  }

  /**
   * Prepare cart for display
   * @param {object} merchant - Merchant data
   * @returns {Promise<object[]>}
   * @private
   */
  async _prepareCart(merchant) {
    const cartItems = [];

    for (const [itemId, quantity] of this._cart.entries()) {
      const item = merchant?.inventory?.find(i => i.id === itemId);
      if (!item) continue;

      const price = this._calculateBuyPrice(item, merchant);

      // Fetch actual item image from UUID if available
      let itemImg = item.img;
      if (item.itemUuid && !itemImg) {
        try {
          const linkedItem = await fromUuid(item.itemUuid);
          if (linkedItem) {
            itemImg = linkedItem.img;
          }
        } catch (e) {
          console.warn(`Could not load item image for ${item.itemUuid}:`, e);
        }
      }

      cartItems.push({
        id: itemId,
        name: item.name,
        img: itemImg || this._getDefaultItemImage(item),
        quantity,
        unitPrice: price,
        price,
        priceFormatted: formatCurrency(price * 100),
        total: price * quantity,
        totalFormatted: formatCurrency(price * quantity * 100),
        atMax: !item.unlimited && item.quantity !== -1 && quantity >= item.quantity
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
    const defaultMultiplier = merchant?.pricing?.baseSellMultiplier ?? 0.5;
    const typeMultipliers = merchant?.buyBack?.typeMultipliers || {};

    for (const [itemUuid, quantity] of this._sellCart.entries()) {
      const item = this._playerActor?.items.find(i => i.uuid === itemUuid);
      if (!item) continue;

      const basePrice = item.system.price?.value || 0;
      // Use type-specific multiplier if available
      const multiplier = typeMultipliers[item.type] ?? defaultMultiplier;
      const price = Math.floor(basePrice * multiplier);

      cartItems.push({
        uuid: itemUuid,
        name: item.name,
        img: item.img,
        quantity,
        price,
        priceFormatted: formatCurrency(price * 100),
        total: price * quantity,
        totalFormatted: formatCurrency(price * quantity * 100)
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

    const services = [];
    const svc = merchant.services;

    // Identify Service
    if (svc.identify) {
      services.push({
        id: "identify",
        type: "identify",
        name: localize("Shop.Service.Identify"),
        description: localize("Shop.Service.IdentifyDesc"),
        price: svc.identifyPrice || 25,
        priceFormatted: formatCurrency((svc.identifyPrice || 25) * 100),
        icon: "fa-search",
        available: true
      });
    }

    // Repair Service
    if (svc.repair) {
      const repairPercent = Math.round((svc.repairPricePercent || 0.1) * 100);
      services.push({
        id: "repair",
        type: "repair",
        name: localize("Shop.Service.Repair"),
        description: localize("Shop.Service.RepairDesc", { percent: repairPercent }),
        price: null, // Variable based on item
        priceFormatted: `${repairPercent}% of item value`,
        icon: "fa-wrench",
        available: true
      });
    }

    // Appraise Service
    if (svc.appraise) {
      services.push({
        id: "appraise",
        type: "appraise",
        name: localize("Shop.Service.Appraise"),
        description: localize("Shop.Service.AppraiseDesc"),
        price: svc.appraisePrice || 5,
        priceFormatted: formatCurrency((svc.appraisePrice || 5) * 100),
        icon: "fa-magnifying-glass-dollar",
        available: true
      });
    }

    // Enchant Service
    if (svc.enchant) {
      services.push({
        id: "enchant",
        type: "enchant",
        name: localize("Shop.Service.Enchant"),
        description: localize("Shop.Service.EnchantDesc"),
        price: null, // Variable based on enchantment
        priceFormatted: localize("Shop.Service.PriceVaries"),
        icon: "fa-wand-magic-sparkles",
        available: true
      });
    }

    return services;
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
    // Remove entire stack from cart
    this._cart.delete(itemId);
    this.render();
  }

  static #onIncrementQuantity(event, target) {
    const itemId = target.dataset.itemId;
    const current = this._cart.get(itemId) || 0;
    this._cart.set(itemId, current + 1);
    this.render();
  }

  static #onDecrementQuantity(event, target) {
    const itemId = target.dataset.itemId;
    const current = this._cart.get(itemId) || 0;
    if (current <= 1) {
      this._cart.delete(itemId);
    } else {
      this._cart.set(itemId, current - 1);
    }
    this.render();
  }

  static #onClearCart(event, target) {
    this._cart.clear();
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
      const result = await getMerchantHandler().purchaseItems(this._sessionId, purchases);

      if (result.success) {
        ui.notifications.info(localize("Shop.PurchaseComplete", {
          count: result.itemsReceived,
          total: formatCurrency(result.totalCost * 100)
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
      const result = await getMerchantHandler().sellItems(this._sessionId, sales);

      if (result.success) {
        ui.notifications.info(localize("Shop.SaleComplete", {
          count: result.itemsSold,
          total: formatCurrency(result.totalEarned * 100)
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
      const result = await getMerchantHandler().attemptHaggle(
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

    if (!this._sessionId || !this._playerActor) {
      ui.notifications.error(localize("Shop.NoSession"));
      return;
    }

    // Get items that can use this service
    const eligibleItems = this._getEligibleItemsForService(serviceId);

    if (eligibleItems.length === 0) {
      ui.notifications.warn(localize("Shop.NoEligibleItems"));
      return;
    }

    // Show item picker dialog
    const selectedItemId = await this._showServiceItemPicker(serviceId, eligibleItems);
    if (!selectedItemId) return;

    // For enchant service, also show enchantment picker
    let enchantmentId = null;
    if (serviceId === "enchant") {
      const item = this._playerActor.items.get(selectedItemId);
      if (item) {
        // Dynamically import the enchantment picker
        const { EnchantmentPicker } = await import("./enchantment-picker.mjs");
        const merchant = this._getMerchant();
        enchantmentId = await EnchantmentPicker.pick(merchant?.id || this.merchantId, item);

        if (!enchantmentId) {
          // User cancelled enchantment selection
          return;
        }
      }
    }

    // Call the merchant handler to use the service
    const handler = getMerchantHandler();
    const serviceOptions = { itemId: selectedItemId };
    if (enchantmentId) {
      serviceOptions.enchantmentId = enchantmentId;
    }

    const result = await handler.useService(this._sessionId, serviceId, serviceOptions);

    if (result.success) {
      // Check if it's pending GM approval
      if (result.pending) {
        ui.notifications.info(result.message || localize("Shop.Service.PendingApproval"));
      } else {
        ui.notifications.info(result.message || localize("Shop.ServiceComplete"));
      }
      // Refresh to update gold display
      this.render();
    } else {
      ui.notifications.error(result.message || localize("Shop.ServiceFailed"));
    }
  }

  /**
   * Get items eligible for a specific service
   * @param {string} serviceType
   * @returns {object[]}
   * @private
   */
  _getEligibleItemsForService(serviceType) {
    if (!this._playerActor?.items) return [];

    const items = Array.from(this._playerActor.items);

    switch (serviceType) {
      case "identify":
        // Items that can be identified (unidentified magic items)
        return items.filter(item => {
          const identified = item.system?.identified ?? true;
          return !identified || item.getFlag("core", "sourceId");
        }).map(item => ({
          id: item.id,
          name: item.name,
          img: item.img,
          type: item.type
        }));

      case "repair":
        // Items that can be repaired (weapons, armor, equipment)
        return items.filter(item => {
          const types = ["weapon", "equipment", "armor", "loot"];
          return types.includes(item.type);
        }).map(item => ({
          id: item.id,
          name: item.name,
          img: item.img,
          type: item.type
        }));

      case "appraise":
        // Any item can be appraised
        return items.filter(item => {
          const types = ["weapon", "equipment", "armor", "loot", "consumable", "container", "tool"];
          return types.includes(item.type);
        }).map(item => ({
          id: item.id,
          name: item.name,
          img: item.img,
          type: item.type,
          value: item.system?.price?.value || "?"
        }));

      case "enchant":
        // Items that can be enchanted (weapons, armor, equipment)
        return items.filter(item => {
          const types = ["weapon", "equipment"];
          return types.includes(item.type);
        }).map(item => ({
          id: item.id,
          name: item.name,
          img: item.img,
          type: item.type,
          rarity: item.system?.rarity || "common"
        }));

      default:
        return [];
    }
  }

  /**
   * Show item picker dialog for service
   * @param {string} serviceType
   * @param {object[]} items
   * @returns {Promise<string|null>}
   * @private
   */
  async _showServiceItemPicker(serviceType, items) {
    const serviceLabels = {
      identify: localize("Shop.Service.Identify"),
      repair: localize("Shop.Service.Repair"),
      appraise: localize("Shop.Service.Appraise"),
      enchant: localize("Shop.Service.Enchant")
    };

    const itemOptions = items.map(item =>
      `<option value="${item.id}">${item.name} (${item.type})</option>`
    ).join("");

    return new Promise((resolve) => {
      new Dialog({
        title: serviceLabels[serviceType] || localize("Shop.SelectItem"),
        content: `
          <form class="service-item-picker">
            <p>${localize("Shop.SelectItemForService")}</p>
            <div class="form-group">
              <label>${localize("Shop.Item")}</label>
              <select name="itemId" style="width: 100%;">
                ${itemOptions}
              </select>
            </div>
          </form>
        `,
        buttons: {
          use: {
            icon: '<i class="fas fa-check"></i>',
            label: localize("Shop.UseService"),
            callback: (html) => {
              const itemId = html.find('[name="itemId"]').val();
              resolve(itemId);
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: localize("Shop.Cancel"),
            callback: () => resolve(null)
          }
        },
        default: "use"
      }).render(true);
    });
  }

  /**
   * Handle viewing service orders
   * Opens the service orders window for this shop
   */
  static async #onViewOrders(event, target) {
    if (!this.playerActorUuid) {
      ui.notifications.warn(localize("Service.NoPlayer"));
      return;
    }

    // Open the service orders window
    const merchantId = this._shopId || this.merchantId;
    game.bobsnpc?.ui?.openServiceOrders(this.playerActorUuid, merchantId);
  }

  /**
   * Handle opening service management (GM only)
   * Opens the service approval/management dialog
   */
  static async #onOpenServiceManagement(event, target) {
    if (!game.user.isGM) return;

    // Dynamically import to avoid circular dependency
    const { ServiceApprovalDialog } = await import("./service-approval-dialog.mjs");
    ServiceApprovalDialog.open();
  }

  static async #onCloseShop(event, target) {
    await this.close();
  }

  /** @override */
  async _onClose(options) {
    await super._onClose(options);

    // Close shop session
    if (this._sessionId) {
      await getMerchantHandler().closeShop(this._sessionId);
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
