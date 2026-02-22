/**
 * Bob's Talking NPCs - Shop Editor
 * Detailed editor for creating and modifying shops
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize, generateId } from "../utils/helpers.mjs";
import {
  ShopDisplayMode,
  StockRefreshType,
  PriceDisplayMode,
  ItemRarity,
  BusinessType,
  BusinessCategory,
  createShopItem
} from "../data/merchant-model.mjs";
import {
  BusinessTypeRegistry,
  getBusinessDefinition,
  getBusinessesByCategory
} from "../data/business-registry.mjs";

/** Get merchant handler instance */
function getMerchantHandler() {
  return game.bobsnpc?.handlers?.merchant;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Shop Editor Application
 * Full editor for shop configuration
 */
export class ShopEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.shopId = options.shopId;
    this.npcActorUuid = options.npcActorUuid || null; // For auto-linking when creating from NPC Config
    this._shop = null;
    this._activeTab = "basic";
    this._pendingChanges = {};
    this._inventoryChanges = [];
  }

  /**
   * Unique application ID per shop
   * This ensures each shop gets its own editor window
   * @override
   */
  get id() {
    return `bobsnpc-shop-editor-${this.shopId || 'new'}`;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    // Note: id is set dynamically via the 'id' getter based on shopId
    classes: ["bobsnpc", "shop-editor"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.ShopEditor.Title",
      icon: "fa-solid fa-store",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 800,
      height: 700
    },
    actions: {
      switchTab: ShopEditor.#onSwitchTab,
      save: ShopEditor.#onSave,
      cancel: ShopEditor.#onCancel,
      addItem: ShopEditor.#onAddItem,
      removeItem: ShopEditor.#onRemoveItem,
      editItem: ShopEditor.#onEditItem,
      incrementItemQty: ShopEditor.#onIncrementItemQty,
      decrementItemQty: ShopEditor.#onDecrementItemQty,
      updateItemQty: ShopEditor.#onUpdateItemQty,
      updateItemPrice: ShopEditor.#onUpdateItemPrice,
      toggleUnlimited: ShopEditor.#onToggleUnlimited,
      browseCompendium: ShopEditor.#onBrowseCompendium,
      selectIcon: ShopEditor.#onSelectIcon,
      selectBanner: ShopEditor.#onSelectBanner,
      linkNpc: ShopEditor.#onLinkNpc,
      unlinkNpc: ShopEditor.#onUnlinkNpc,
      previewShop: ShopEditor.#onPreviewShop,
      duplicateShop: ShopEditor.#onDuplicateShop,
      exportShop: ShopEditor.#onExportShop,
      // Back Room actions
      moveToStorefront: ShopEditor.#onMoveToStorefront,
      moveToBackroom: ShopEditor.#onMoveToBackroom,
      removeBackroomItem: ShopEditor.#onRemoveBackroomItem,
      // Enhanced services actions
      toggleService: ShopEditor.#onToggleService,
      addService: ShopEditor.#onAddService,
      editService: ShopEditor.#onEditService,
      removeService: ShopEditor.#onRemoveService
    }
  };

  /** @override */
  static PARTS = {
    navigation: {
      template: `modules/${MODULE_ID}/templates/shop-editor/navigation.hbs`
    },
    basic: {
      template: `modules/${MODULE_ID}/templates/shop-editor/tab-basic.hbs`
    },
    inventory: {
      template: `modules/${MODULE_ID}/templates/shop-editor/tab-inventory.hbs`,
      scrollable: [".inventory-list"]
    },
    backroom: {
      template: `modules/${MODULE_ID}/templates/shop-editor/tab-backroom.hbs`,
      scrollable: [".backroom-list"]
    },
    pricing: {
      template: `modules/${MODULE_ID}/templates/shop-editor/tab-pricing.hbs`
    },
    haggling: {
      template: `modules/${MODULE_ID}/templates/shop-editor/tab-haggling.hbs`
    },
    stock: {
      template: `modules/${MODULE_ID}/templates/shop-editor/tab-stock.hbs`
    },
    services: {
      template: `modules/${MODULE_ID}/templates/shop-editor/tab-services.hbs`
    },
    access: {
      template: `modules/${MODULE_ID}/templates/shop-editor/tab-access.hbs`
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/shop-editor/footer.hbs`
    }
  };

  /** @override */
  get title() {
    return this._shop?.name
      ? localize("ShopEditor.TitleEdit", { name: this._shop.name })
      : localize("ShopEditor.TitleNew");
  }

  /**
   * Load shop data from storage
   * @private
   */
  async _loadShopData() {
    // Only load if not already loaded
    if (this._shop) return;

    console.log(`${MODULE_ID} | ShopEditor._loadShopData - shopId: ${this.shopId}`);

    // Load shop data or create default
    if (this.shopId) {
      const handler = getMerchantHandler();
      console.log(`${MODULE_ID} | ShopEditor - handler available: ${!!handler}`);

      let shopData = handler?.getMerchant(this.shopId);
      console.log(`${MODULE_ID} | ShopEditor - shop from handler: ${shopData?.name || 'not found'}`);

      // Also try direct settings lookup if not found via handler
      if (!shopData) {
        const shopsSettings = game.settings.get(MODULE_ID, "shops") || {};
        shopData = shopsSettings[this.shopId];
        console.log(`${MODULE_ID} | ShopEditor - shop from settings: ${shopData?.name || 'not found'}`);
      }

      // Also try worldData.merchants
      if (!shopData) {
        const worldData = game.settings.get(MODULE_ID, "worldData") || {};
        shopData = worldData.merchants?.[this.shopId];
        console.log(`${MODULE_ID} | ShopEditor - shop from worldData: ${shopData?.name || 'not found'}`);
      }

      if (!shopData) {
        console.warn(`${MODULE_ID} | Shop not found: ${this.shopId}, creating new shop`);
        this._shop = this._createDefaultShop();
      } else {
        // Create a working copy and ensure all required fields exist
        this._shop = this._ensureShopDefaults(foundry.utils.deepClone(shopData));
      }
    } else {
      // Create new shop with defaults
      this._shop = this._createDefaultShop();
    }

    console.log(`${MODULE_ID} | ShopEditor - final shop:`, this._shop?.name, this._shop?.id);
  }

  /** @override */
  async _preFirstRender(context, options) {
    await super._preFirstRender(context, options);
    // Load shop data if not already loaded
    await this._loadShopData();
  }

  /**
   * Ensure shop has all required default values
   * @param {object} shop - Shop data
   * @returns {object} Shop with defaults applied
   */
  _ensureShopDefaults(shop) {
    // Ensure critical fields have valid values
    shop.id = shop.id || generateId();
    shop.name = shop.name || "";
    shop.type = shop.type || "general";
    shop.displayMode = shop.displayMode || ShopDisplayMode.AUTO;
    shop.icon = shop.icon || "icons/svg/chest.svg";
    // Ensure color is a valid hex color (empty string breaks color input)
    shop.color = (shop.color && shop.color.startsWith("#")) ? shop.color : "#7b68ee";
    shop.inventory = shop.inventory || [];
    shop.pricing = shop.pricing || {
      buyMultiplier: 1.0,
      sellMultiplier: 0.5,
      useCharisma: false,
      charismaMultiplier: 0.02,
      displayMode: PriceDisplayMode.GOLD_DOWN
    };
    shop.haggling = shop.haggling || { enabled: false };
    shop.stockRefresh = shop.stockRefresh || { type: StockRefreshType.NEVER };
    shop.services = shop.services || {};
    shop.access = shop.access || {};

    // Ensure buyBack has all required fields
    shop.buyBack = shop.buyBack || {};
    shop.buyBack.enabled = shop.buyBack.enabled ?? false;
    shop.buyBack.itemTypes = shop.buyBack.itemTypes || [];
    shop.buyBack.excludeTypes = shop.buyBack.excludeTypes || [];
    shop.buyBack.typeMultipliers = shop.buyBack.typeMultipliers || {};
    shop.buyBack.requireIdentified = shop.buyBack.requireIdentified ?? true;
    shop.buyBack.excludeEquipped = shop.buyBack.excludeEquipped ?? true;
    shop.buyBack.excludeAttuned = shop.buyBack.excludeAttuned ?? true;
    shop.buyBack.maxValue = shop.buyBack.maxValue ?? 0;

    // Ensure backroom has all required fields
    shop.backroom = shop.backroom || {};
    shop.backroom.enabled = shop.backroom.enabled ?? true;
    shop.backroom.inventory = shop.backroom.inventory || [];
    shop.backroom.autoAddPurchasedItems = shop.backroom.autoAddPurchasedItems ?? true;
    shop.backroom.notes = shop.backroom.notes || "";

    // Ensure servicesList exists
    shop.servicesList = shop.servicesList || [];

    return shop;
  }

  /**
   * Create a default shop structure
   * @returns {object}
   */
  _createDefaultShop() {
    return {
      id: generateId(),
      name: "",
      description: "",
      type: "general",
      icon: "icons/svg/chest.svg",
      color: "#7b68ee",
      bannerImage: null,
      npcActorUuid: this.npcActorUuid, // Auto-link if created from NPC Config
      inventory: [],
      pricing: {
        buyMultiplier: 1.0,
        sellMultiplier: 0.5,
        useCharisma: false,
        charismaMultiplier: 0.02,
        displayMode: PriceDisplayMode.GOLD_DOWN
      },
      haggling: {
        enabled: false,
        skill: "persuasion",
        baseDC: 15,
        maxDiscount: 20,
        discountPerPoint: 2,
        attemptsPerVisit: 3,
        cooldownHours: 24,
        failurePenalty: 10,
        critFailEffect: "none"
      },
      stockRefresh: {
        type: StockRefreshType.NEVER,
        customIntervalDays: 7,
        randomizeStock: false,
        variationPercent: 20
      },
      services: {
        identify: { enabled: false, basePrice: 25, scaleByRarity: true },
        repair: { enabled: false, pricePercent: 10 },
        appraise: { enabled: false, price: 5 },
        enchant: { enabled: false, priceMultiplier: 1.0 }
      },
      access: {
        minLevel: 0,
        maxLevel: 0,
        requiredFaction: null,
        minReputation: 0,
        requiredRank: null,
        requiredQuests: [],
        operatingHours: { enabled: false, openHour: 8, closeHour: 20 }
      },
      buyBack: {
        enabled: false,
        duration: "session",
        penalty: 0.1
      },
      currencyDrawer: {
        enabled: false,
        maxGold: 1000,
        refreshType: "daily"
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /** @override */
  async _prepareContext(options) {
    // Ensure shop data is loaded before preparing context
    // This handles cases where _prepareContext runs before _preFirstRender
    await this._loadShopData();

    console.log(`${MODULE_ID} | ShopEditor._prepareContext - this._shop:`, this._shop?.name, this._shop?.id);

    const context = await super._prepareContext(options);

    if (!this._shop) {
      console.error(`${MODULE_ID} | ShopEditor._prepareContext - NO SHOP DATA!`);
      return { ...context, error: "Shop not found" };
    }

    // Ensure shop has valid defaults before building context
    this._shop = this._ensureShopDefaults(this._shop);

    // Enrich inventory items with full item data
    const enrichedInventory = await this._enrichInventory(this._shop.inventory || []);

    // Get linked NPC info
    let linkedNpc = null;
    if (this._shop.npcActorUuid) {
      try {
        linkedNpc = await fromUuid(this._shop.npcActorUuid);
      } catch (e) {
        console.warn(`${MODULE_ID} | Could not load linked NPC:`, e);
      }
    }

    // Business category options
    const businessCategoryOptions = [
      { value: "", label: localize("ShopEditor.AllCategories"), selected: !this._shop.businessCategory },
      ...Object.entries(BusinessCategory).map(([key, value]) => ({
        value,
        label: localize(`BusinessCategories.${value}`),
        selected: this._shop.businessCategory === value
      }))
    ];

    // Business type options (filtered by selected category if any)
    const selectedCategory = this._shop.businessCategory || null;
    const businessTypeOptions = [];
    for (const [, def] of BusinessTypeRegistry) {
      if (selectedCategory && def.category !== selectedCategory) continue;
      businessTypeOptions.push({
        value: def.type,
        label: def.name,
        category: def.category,
        categoryLabel: def.category ? localize(`BusinessCategories.${def.category}`) : "",
        selected: this._shop.businessType === def.type
      });
    }

    const refreshTypeOptions = Object.entries(StockRefreshType).map(([key, value]) => ({
      value,
      label: localize(`StockRefreshTypes.${key}`),
      selected: this._shop.stockRefresh?.type === value
    }));

    const priceDisplayOptions = Object.entries(PriceDisplayMode).map(([key, value]) => ({
      value,
      label: localize(`PriceDisplayModes.${key}`),
      selected: this._shop.pricing?.displayMode === value
    }));

    const displayModeOptions = Object.entries(ShopDisplayMode).map(([key, value]) => ({
      value,
      label: localize(`DisplayModes.${key}`),
      selected: (this._shop.displayMode || ShopDisplayMode.AUTO) === value
    }));

    // Enrich backroom inventory
    const enrichedBackroom = await this._enrichInventory(this._shop.backroom?.inventory || []);

    // Prepare enhanced services list for display
    const enrichedServicesList = this._prepareEnhancedServicesList();

    return {
      ...context,
      shop: this._shop,
      activeTab: this._activeTab,
      tabs: this._getTabs(),

      // Basic tab
      businessCategoryOptions,
      businessTypeOptions,
      displayModeOptions,
      linkedNpc: linkedNpc ? { name: linkedNpc.name, img: linkedNpc.img } : null,

      // Inventory tab
      inventory: enrichedInventory,
      inventoryCount: enrichedInventory.length,
      hasInventory: enrichedInventory.length > 0,

      // Back Room tab
      backroom: this._shop.backroom,
      backroomInventory: enrichedBackroom,
      backroomCount: enrichedBackroom.length,
      hasBackroomInventory: enrichedBackroom.length > 0,

      // Pricing tab
      priceDisplayOptions,
      pricing: this._shop.pricing,

      // Haggling tab
      haggling: this._shop.haggling,

      // Stock tab
      refreshTypeOptions,
      stockRefresh: this._shop.stockRefresh,

      // Services tab
      services: this._shop.services,
      availableEnchantments: this._prepareEnchantmentsList(),
      servicesList: enrichedServicesList,
      hasServicesList: enrichedServicesList.length > 0,
      ...this._prepareServiceTiers(),

      // Access tab
      access: this._shop.access,

      // Buyback
      buyBack: this._shop.buyBack,
      buybackTypeOptions: this._prepareBuybackTypeOptions()
    };
  }

  /**
   * Prepare context for individual template parts
   * Required by Foundry v13 ApplicationV2 for multi-part templates
   * @override
   */
  _preparePartContext(partId, context) {
    context.tab = partId;
    return context;
  }

  /**
   * Get tab configuration
   * @returns {object[]}
   */
  _getTabs() {
    const inventoryCount = this._shop?.inventory?.length || 0;
    const backroomCount = this._shop?.backroom?.inventory?.length || 0;
    return [
      { id: "basic", label: localize("ShopEditor.TabBasic"), icon: "fa-info-circle", active: this._activeTab === "basic" },
      { id: "inventory", label: localize("ShopEditor.TabInventory"), icon: "fa-boxes", active: this._activeTab === "inventory", badge: inventoryCount > 0 ? inventoryCount : null },
      { id: "backroom", label: localize("ShopEditor.TabBackroom"), icon: "fa-door-closed", active: this._activeTab === "backroom", badge: backroomCount > 0 ? backroomCount : null },
      { id: "pricing", label: localize("ShopEditor.TabPricing"), icon: "fa-coins", active: this._activeTab === "pricing" },
      { id: "haggling", label: localize("ShopEditor.TabHaggling"), icon: "fa-handshake", active: this._activeTab === "haggling" },
      { id: "stock", label: localize("ShopEditor.TabStock"), icon: "fa-warehouse", active: this._activeTab === "stock" },
      { id: "services", label: localize("ShopEditor.TabServices"), icon: "fa-concierge-bell", active: this._activeTab === "services" },
      { id: "access", label: localize("ShopEditor.TabAccess"), icon: "fa-lock", active: this._activeTab === "access" }
    ];
  }

  /**
   * Enrich inventory items with full data
   * @param {object[]} inventory - Raw inventory
   * @returns {Promise<object[]>}
   */
  async _enrichInventory(inventory) {
    const enriched = [];

    for (const shopItem of inventory) {
      let item = null;
      let itemName = shopItem.name || "Unknown Item";
      let itemImg = "icons/svg/item-bag.svg";
      let itemType = "unknown";
      let itemRarity = "common";
      let itemPrice = shopItem.basePrice || 0;

      if (shopItem.itemUuid) {
        try {
          item = await fromUuid(shopItem.itemUuid);
          if (item) {
            itemName = item.name;
            itemImg = item.img;
            itemType = item.type;
            itemRarity = item.system?.rarity || "common";
            itemPrice = shopItem.basePrice ?? item.system?.price?.value ?? 0;
          }
        } catch (e) {
          console.warn(`${MODULE_ID} | Could not load item: ${shopItem.itemUuid}`);
        }
      }

      enriched.push({
        ...shopItem,
        itemName,
        itemImg,
        itemType,
        itemRarity,
        displayPrice: itemPrice,
        quantityDisplay: shopItem.quantity === -1 ? "∞" : shopItem.quantity,
        isUnlimited: shopItem.quantity === -1,
        rarityClass: `rarity-${itemRarity}`
      });
    }

    return enriched;
  }

  /**
   * Prepare enchantments list for services tab
   * @returns {object[]}
   * @private
   */
  _prepareEnchantmentsList() {
    const enchantmentHandler = game.bobsnpc?.handlers?.enchantment;
    if (!enchantmentHandler) return [];

    const allEnchantments = enchantmentHandler.getAllEnchantments();
    const availableData = this._shop?.services?.availableEnchantments;

    // Handle both array and object formats for enabled enchantments
    const isEnabled = (enchId) => {
      if (!availableData) return false;
      if (Array.isArray(availableData)) {
        return availableData.includes(enchId);
      }
      if (typeof availableData === "object") {
        return !!availableData[enchId];
      }
      return false;
    };

    return allEnchantments.map(ench => ({
      id: ench.id,
      name: ench.name,
      description: ench.description,
      baseCost: ench.baseCost,
      type: ench.type,
      typeLabel: localize(`Enchantment.Types.${ench.type}`),
      rarity: ench.rarity,
      icon: ench.icon,
      enabled: isEnabled(ench.id)
    }));
  }

  /**
   * Prepare buyback item type options
   * @returns {object[]}
   * @private
   */
  _prepareBuybackTypeOptions() {
    const itemTypes = [
      { value: "weapon", label: localize("ItemTypes.weapon"), icon: "fa-sword" },
      { value: "equipment", label: localize("ItemTypes.equipment"), icon: "fa-shield" },
      { value: "consumable", label: localize("ItemTypes.consumable"), icon: "fa-flask" },
      { value: "tool", label: localize("ItemTypes.tool"), icon: "fa-wrench" },
      { value: "loot", label: localize("ItemTypes.loot"), icon: "fa-gem" }
    ];

    const acceptedTypes = this._shop.buyBack?.itemTypes || [];
    const typeMultipliers = this._shop.buyBack?.typeMultipliers || {};
    const defaultMultiplier = this._shop.pricing?.baseSellMultiplier || 0.5;

    return itemTypes.map(type => ({
      ...type,
      // If no types specified, all are accepted
      checked: acceptedTypes.length === 0 || acceptedTypes.includes(type.value),
      multiplier: typeMultipliers[type.value] ?? defaultMultiplier,
      multiplierPercent: Math.round((typeMultipliers[type.value] ?? defaultMultiplier) * 100)
    }));
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);

    // Set up form change listeners
    this._setupFormListeners();

    // Set up drag-drop for inventory
    this._setupDragDrop();

    // Show only active tab content
    this._updateTabVisibility();
  }

  /**
   * Set up form change listeners
   */
  _setupFormListeners() {
    const form = this.element;

    // Listen to all input changes
    form.querySelectorAll("input, select, textarea").forEach(input => {
      input.addEventListener("change", (event) => {
        this._onInputChange(event);
      });
    });
  }

  /**
   * Handle input changes
   * @param {Event} event
   */
  _onInputChange(event) {
    const input = event.target;
    const name = input.name;
    let value = input.type === "checkbox" ? input.checked : input.value;

    // Special handling for buyBack.itemTypes checkboxes (array of checked values)
    if (name === "buyBack.itemTypes") {
      this._handleBuybackTypeChange();
      return;
    }

    // Special handling for inventory quantity fields (inventory-qty-{itemId})
    if (name.startsWith("inventory-qty-")) {
      const itemId = name.replace("inventory-qty-", "");
      const item = this._shop.inventory.find(i => i.id === itemId);
      if (item) {
        item.quantity = Math.max(0, parseInt(value) || 0);
      }
      return;
    }

    // Special handling for inventory price fields (inventory-price-{itemId})
    if (name.startsWith("inventory-price-")) {
      const itemId = name.replace("inventory-price-", "");
      const item = this._shop.inventory.find(i => i.id === itemId);
      if (item) {
        item.basePrice = Math.max(0, parseFloat(value) || 0);
      }
      return;
    }

    // Special handling for business category change (re-filter type options)
    if (name === "businessCategory") {
      this._shop.businessCategory = value || null;
      this.render();
      return;
    }

    // Special handling for business type change (apply defaults from registry)
    if (name === "businessType") {
      this._onBusinessTypeChange(value);
      return;
    }

    // Convert numeric values
    if (input.type === "number") {
      value = parseFloat(value) || 0;
    }

    // Update shop object using dot notation path
    foundry.utils.setProperty(this._shop, name, value);
  }

  /**
   * Handle business type change - apply defaults from registry
   * @param {string} businessType - New BusinessType value
   * @private
   */
  _onBusinessTypeChange(businessType) {
    if (!businessType) return;

    const def = getBusinessDefinition(businessType);
    if (!def) return;

    this._shop.businessType = businessType;
    this._shop.businessCategory = def.category;
    this._shop.type = def.type;
    this._shop.displayMode = def.displayMode || this._shop.displayMode;

    // Apply registry defaults for icon and color only if they haven't been customized
    if (this._shop.icon === "icons/svg/chest.svg" || !this._shop.icon) {
      this._shop.icon = def.icon;
    }
    if (this._shop.color === "#7b68ee" || !this._shop.color) {
      this._shop.color = def.color;
    }

    // Apply registry defaults for pricing/haggling/buyBack
    if (def.pricing) {
      this._shop.pricing.buyMultiplier = def.pricing.baseBuyMultiplier ?? this._shop.pricing.buyMultiplier;
      this._shop.pricing.sellMultiplier = def.pricing.baseSellMultiplier ?? this._shop.pricing.sellMultiplier;
    }
    if (def.haggling) {
      this._shop.haggling.enabled = def.haggling.enabled ?? this._shop.haggling.enabled;
      if (def.haggling.persuasionDC) this._shop.haggling.baseDC = def.haggling.persuasionDC;
    }
    if (def.buyBack) {
      this._shop.buyBack.enabled = def.buyBack.enabled ?? this._shop.buyBack.enabled;
      if (def.buyBack.itemTypes) this._shop.buyBack.itemTypes = [...def.buyBack.itemTypes];
    }
    if (def.backroom) {
      this._shop.backroom.enabled = def.backroom.enabled ?? this._shop.backroom.enabled;
    }

    this.render();
  }

  /**
   * Handle buyback item type checkbox changes
   * Gathers all checked types into an array
   * @private
   */
  _handleBuybackTypeChange() {
    const checkboxes = this.element.querySelectorAll('input[name="buyBack.itemTypes"]:checked');
    const selectedTypes = Array.from(checkboxes).map(cb => cb.value);

    // Ensure buyBack object exists
    if (!this._shop.buyBack) {
      this._shop.buyBack = {};
    }

    // If all types are checked, store empty array (means "accept all")
    const allTypes = ["weapon", "equipment", "consumable", "tool", "loot"];
    if (selectedTypes.length === allTypes.length) {
      this._shop.buyBack.itemTypes = [];
    } else {
      this._shop.buyBack.itemTypes = selectedTypes;
    }
  }

  /**
   * Set up drag-drop for inventory
   */
  _setupDragDrop() {
    const inventoryList = this.element.querySelector(".inventory-list");
    if (!inventoryList) return;

    // Allow dropping items
    inventoryList.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      inventoryList.classList.add("drag-over");
    });

    inventoryList.addEventListener("dragleave", (event) => {
      inventoryList.classList.remove("drag-over");
    });

    inventoryList.addEventListener("drop", async (event) => {
      event.preventDefault();
      inventoryList.classList.remove("drag-over");

      try {
        const data = JSON.parse(event.dataTransfer.getData("text/plain"));
        await this._handleItemDrop(data);
      } catch (e) {
        console.error(`${MODULE_ID} | Error handling drop:`, e);
      }
    });
  }

  /**
   * Handle item drop onto inventory
   * @param {object} data - Drop data
   */
  async _handleItemDrop(data) {
    // Handle item drops
    if (data.type !== "Item") {
      ui.notifications.warn(localize("ShopEditor.OnlyItemsAllowed"));
      return;
    }

    const item = await fromUuid(data.uuid);
    if (!item) {
      ui.notifications.error(localize("ShopEditor.ItemNotFound"));
      return;
    }

    // Check if already in inventory
    if (this._shop.inventory.some(i => i.itemUuid === data.uuid)) {
      ui.notifications.warn(localize("ShopEditor.ItemAlreadyInInventory"));
      return;
    }

    // Create shop item
    const shopItem = createShopItem({
      itemUuid: data.uuid,
      name: item.name,
      basePrice: item.system?.price?.value || 0,
      quantity: -1 // Unlimited by default
    });

    this._shop.inventory.push(shopItem);
    await this.render();

    ui.notifications.info(localize("ShopEditor.ItemAdded", { name: item.name }));
  }

  /**
   * Update tab visibility
   */
  _updateTabVisibility() {
    // Hide all tab contents except active
    const tabContents = this.element.querySelectorAll("[data-tab-content]");
    tabContents.forEach(content => {
      const isActive = content.dataset.tabContent === this._activeTab;
      content.style.display = isActive ? "" : "none";
    });
  }

  // ==================== Actions ====================

  /**
   * Switch tab
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onSwitchTab(event, target) {
    const tabId = target.dataset.tab;
    if (tabId && tabId !== this._activeTab) {
      this._activeTab = tabId;
      await this.render();
    }
  }

  /**
   * Save changes
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onSave(event, target) {
    // Validate shop name
    if (!this._shop.name?.trim()) {
      ui.notifications.error(localize("ShopEditor.NameRequired"));
      return;
    }

    // Update timestamp
    this._shop.updatedAt = Date.now();

    // Save to handler
    const handler = getMerchantHandler();
    const isNewShop = !this.shopId;

    if (this.shopId) {
      // Update existing shop
      if (handler?.updateMerchant) {
        await handler.updateMerchant(this.shopId, this._shop);
      } else {
        // Fallback: save to world settings
        await this._saveShopToSettings(this._shop);
      }
      ui.notifications.info(localize("ShopEditor.Saved", { name: this._shop.name }));
    } else {
      // Create new shop
      if (handler?.createMerchant) {
        await handler.createMerchant(this._shop);
      } else {
        // Fallback: save to world settings
        await this._saveShopToSettings(this._shop);
      }
      // Set shopId now that it's saved
      this.shopId = this._shop.id;
      ui.notifications.info(localize("ShopEditor.Created", { name: this._shop.name }));
    }

    // If this is a new shop created from NPC Config, auto-link it to the NPC
    if (isNewShop && this.npcActorUuid) {
      await this._autoLinkToNpc();
    }

    // Refresh shop manager if open
    const manager = Object.values(ui.windows).find(w => w.constructor.name === "ShopManager");
    if (manager) {
      await manager.render();
    }

    // Refresh NPC Config if open for this NPC
    const npcConfig = Object.values(ui.windows).find(
      w => w.constructor.name === "NPCConfig" && w.npc?.uuid === this._shop.npcActorUuid
    );
    if (npcConfig) {
      await npcConfig.render();
    }

    await this.close();
  }

  /**
   * Auto-link this shop to the NPC when created from NPC Config
   */
  async _autoLinkToNpc() {
    try {
      const npc = await fromUuid(this.npcActorUuid);
      if (!npc) return;

      // Get current config
      const config = npc.getFlag(MODULE_ID, "config") || {};

      // Update merchant service with this shop ID
      const services = config.services || {};
      services.merchant = services.merchant || {};
      services.merchant.shopId = this._shop.id;

      // Save back to NPC
      await npc.setFlag(MODULE_ID, "config", {
        ...config,
        services
      });

      console.log(`${MODULE_ID} | Auto-linked shop "${this._shop.name}" to NPC "${npc.name}"`);
    } catch (e) {
      console.error(`${MODULE_ID} | Failed to auto-link shop to NPC:`, e);
    }
  }

  /**
   * Save shop to world settings (fallback when handler not available)
   * @param {object} shop - Shop data
   */
  async _saveShopToSettings(shop) {
    const shops = game.settings.get(MODULE_ID, "shops") || {};
    shops[shop.id] = shop;
    await game.settings.set(MODULE_ID, "shops", shops);
  }

  /**
   * Cancel editing
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onCancel(event, target) {
    await this.close();
  }

  /**
   * Add item manually
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onAddItem(event, target) {
    // Create empty shop item
    const shopItem = createShopItem({
      name: "New Item",
      basePrice: 10,
      quantity: -1
    });

    this._shop.inventory.push(shopItem);
    await this.render();
  }

  /**
   * Remove item from inventory
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onRemoveItem(event, target) {
    const itemId = target.closest("[data-item-id]").dataset.itemId;
    this._shop.inventory = this._shop.inventory.filter(i => i.id !== itemId);
    await this.render();
  }

  /**
   * Increment item quantity
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onIncrementItemQty(event, target) {
    const itemId = target.dataset.itemId;
    const item = this._shop.inventory.find(i => i.id === itemId);
    if (item && item.quantity !== -1) {
      item.quantity = (item.quantity || 0) + 1;
      await this.render();
    }
  }

  /**
   * Decrement item quantity
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onDecrementItemQty(event, target) {
    const itemId = target.dataset.itemId;
    const item = this._shop.inventory.find(i => i.id === itemId);
    if (item && item.quantity !== -1 && item.quantity > 0) {
      item.quantity = item.quantity - 1;
      await this.render();
    }
  }

  /**
   * Update item quantity from input
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onUpdateItemQty(event, target) {
    const itemId = target.dataset.itemId;
    const item = this._shop.inventory.find(i => i.id === itemId);
    if (item) {
      const newQty = parseInt(target.value) || 0;
      item.quantity = Math.max(0, newQty);
      // Don't re-render on every keystroke, just update the data
    }
  }

  /**
   * Update item price from input
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onUpdateItemPrice(event, target) {
    const itemId = target.dataset.itemId;
    const item = this._shop.inventory.find(i => i.id === itemId);
    if (item) {
      const newPrice = parseFloat(target.value) || 0;
      item.basePrice = Math.max(0, newPrice);
      // Don't re-render on every keystroke, just update the data
    }
  }

  /**
   * Toggle unlimited quantity for item
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onToggleUnlimited(event, target) {
    const itemId = target.dataset.itemId;
    const item = this._shop.inventory.find(i => i.id === itemId);
    if (item) {
      if (item.quantity === -1) {
        // Switch from unlimited to limited (default 10)
        item.quantity = 10;
      } else {
        // Switch to unlimited
        item.quantity = -1;
      }
      await this.render();
    }
  }

  /**
   * Edit item details
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onEditItem(event, target) {
    const itemId = target.closest("[data-item-id]").dataset.itemId;
    const shopItem = this._shop.inventory.find(i => i.id === itemId);

    if (!shopItem) return;

    // Open item editor dialog
    const { ShopItemEditor } = await import("./shop-item-editor.mjs");
    const editor = new ShopItemEditor({
      shopItem,
      callback: async (updatedItem) => {
        // Update item in inventory
        const index = this._shop.inventory.findIndex(i => i.id === itemId);
        if (index >= 0) {
          this._shop.inventory[index] = updatedItem;
          await this.render();
        }
      }
    });
    editor.render(true);
  }

  /**
   * Browse compendium for items
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onBrowseCompendium(event, target) {
    // Open compendium browser
    const compendiumBrowser = game.packs.filter(p => p.documentName === "Item");

    if (compendiumBrowser.length === 0) {
      ui.notifications.warn(localize("ShopEditor.NoItemCompendiums"));
      return;
    }

    // Use FilePicker style dialog to select compendium
    const content = `
      <form>
        <div class="form-group">
          <label>${localize("ShopEditor.SelectCompendium")}</label>
          <select name="compendium">
            ${compendiumBrowser.map(c => `<option value="${c.collection}">${c.title}</option>`).join("")}
          </select>
        </div>
      </form>
    `;

    const dialog = new Dialog({
      title: localize("ShopEditor.BrowseCompendium"),
      content,
      buttons: {
        open: {
          icon: '<i class="fas fa-folder-open"></i>',
          label: localize("ShopEditor.Open"),
          callback: async (html) => {
            const packId = html.find("select[name=compendium]").val();
            const pack = game.packs.get(packId);
            if (pack) {
              pack.render(true);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: localize("Cancel")
        }
      },
      default: "open"
    });

    dialog.render(true);
  }

  /**
   * Select icon
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onSelectIcon(event, target) {
    const iconPicker = new FilePicker({
      type: "image",
      current: this._shop.icon || "",
      callback: (path) => {
        this._shop.icon = path;
        this.render();
      }
    });
    iconPicker.render(true);
  }

  /**
   * Select banner image
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onSelectBanner(event, target) {
    const picker = new FilePicker({
      type: "image",
      current: this._shop.bannerImage || "",
      callback: (path) => {
        this._shop.bannerImage = path;
        this.render();
      }
    });
    picker.render(true);
  }

  /**
   * Link NPC
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onLinkNpc(event, target) {
    // Get all NPC actors
    const npcs = game.actors.filter(a => a.type === "npc");

    if (npcs.length === 0) {
      ui.notifications.warn(localize("ShopEditor.NoNPCsFound"));
      return;
    }

    const content = `
      <form>
        <div class="form-group">
          <label>${localize("ShopEditor.SelectNPC")}</label>
          <select name="npc">
            <option value="">${localize("ShopEditor.None")}</option>
            ${npcs.map(n => `<option value="${n.uuid}">${n.name}</option>`).join("")}
          </select>
        </div>
      </form>
    `;

    const dialog = new Dialog({
      title: localize("ShopEditor.LinkNPC"),
      content,
      buttons: {
        link: {
          icon: '<i class="fas fa-link"></i>',
          label: localize("ShopEditor.Link"),
          callback: async (html) => {
            const npcUuid = html.find("select[name=npc]").val();
            this._shop.npcActorUuid = npcUuid || null;
            await this.render();
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: localize("Cancel")
        }
      },
      default: "link"
    });

    dialog.render(true);
  }

  /**
   * Unlink NPC
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onUnlinkNpc(event, target) {
    this._shop.npcActorUuid = null;
    await this.render();
  }

  /**
   * Preview shop as it would appear to players
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onPreviewShop(event, target) {
    // Validate shop has required fields
    if (!this._shop?.name?.trim()) {
      ui.notifications.warn(localize("ShopEditor.SaveBeforePreview"));
      return;
    }

    // Get a player actor for preview
    let playerActorUuid = null;
    if (game.user.character) {
      playerActorUuid = game.user.character.uuid;
    } else {
      const ownedActor = game.actors.find(a => a.isOwner && a.type === "character");
      if (ownedActor) {
        playerActorUuid = ownedActor.uuid;
      }
    }

    if (!playerActorUuid) {
      ui.notifications.warn(localize("ShopManager.NoPlayerActor"));
      return;
    }

    // Open the shop window in preview mode
    try {
      const { ShopWindow } = await import("./shop-window.mjs");
      const preview = new ShopWindow({
        merchantId: this._shop.id,
        playerActorUuid,
        previewMode: true,
        previewData: this._shop
      });
      preview.render(true);
    } catch (e) {
      console.error(`${MODULE_ID} | Error opening shop preview:`, e);
      ui.notifications.error(localize("ShopEditor.PreviewError"));
    }
  }

  /**
   * Duplicate this shop
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onDuplicateShop(event, target) {
    // Create a copy of the shop with new ID
    const duplicate = foundry.utils.deepClone(this._shop);
    duplicate.id = generateId();
    duplicate.name = `${duplicate.name} (Copy)`;
    duplicate.createdAt = Date.now();
    duplicate.updatedAt = Date.now();

    // Save the duplicate
    const handler = getMerchantHandler();
    if (handler?.createMerchant) {
      await handler.createMerchant(duplicate);
    } else {
      await this._saveShopToSettings(duplicate);
    }

    ui.notifications.info(localize("ShopEditor.Duplicated", { name: duplicate.name }));

    // Refresh shop manager if open
    const manager = Object.values(ui.windows).find(w => w.constructor.name === "ShopManager");
    if (manager) {
      await manager.render();
    }
  }

  /**
   * Export shop to JSON file
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onExportShop(event, target) {
    // Validate shop has required fields
    if (!this._shop?.name?.trim()) {
      ui.notifications.warn(localize("ShopEditor.NameRequiredForExport"));
      return;
    }

    // Create export data
    const exportData = foundry.utils.deepClone(this._shop);

    // Create filename
    const filename = `shop-${exportData.name.slugify()}-${Date.now()}.json`;

    // Create and download file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    ui.notifications.info(localize("ShopEditor.Exported", { name: exportData.name }));
  }

  // ==================== Back Room Actions ====================

  /**
   * Move an item from backroom to storefront inventory
   */
  static async #onMoveToStorefront(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    if (!itemId || !this._shop.backroom?.inventory) return;

    const itemIndex = this._shop.backroom.inventory.findIndex(i => i.id === itemId);
    if (itemIndex < 0) return;

    // Remove from backroom
    const [item] = this._shop.backroom.inventory.splice(itemIndex, 1);

    // Add to storefront inventory
    this._shop.inventory.push(item);

    ui.notifications.info(`Moved "${item.name}" to storefront`);
    await this.render();
  }

  /**
   * Move an item from storefront to backroom
   */
  static async #onMoveToBackroom(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;

    const itemIndex = this._shop.inventory.findIndex(i => i.id === itemId);
    if (itemIndex < 0) return;

    // Ensure backroom exists
    if (!this._shop.backroom) {
      this._shop.backroom = { enabled: true, inventory: [], autoAddPurchasedItems: true, notes: "" };
    }
    if (!this._shop.backroom.inventory) {
      this._shop.backroom.inventory = [];
    }

    // Remove from storefront
    const [item] = this._shop.inventory.splice(itemIndex, 1);

    // Add to backroom
    this._shop.backroom.inventory.push(item);

    ui.notifications.info(`Moved "${item.name}" to back room`);
    await this.render();
  }

  /**
   * Remove an item from the backroom entirely
   */
  static async #onRemoveBackroomItem(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    if (!itemId || !this._shop.backroom?.inventory) return;

    const itemIndex = this._shop.backroom.inventory.findIndex(i => i.id === itemId);
    if (itemIndex < 0) return;

    const item = this._shop.backroom.inventory[itemIndex];

    const confirmed = await Dialog.confirm({
      title: localize("ShopEditor.RemoveItem"),
      content: `<p>Remove "${item.name}" from the back room?</p>`
    });

    if (!confirmed) return;

    this._shop.backroom.inventory.splice(itemIndex, 1);
    await this.render();
  }

  // ==================== Enhanced Services Actions ====================

  /**
   * Toggle an enhanced service on/off
   */
  static async #onToggleService(event, target) {
    const serviceIndex = parseInt(target.dataset.serviceIndex);
    if (isNaN(serviceIndex) || !this._shop.servicesList?.[serviceIndex]) return;

    this._shop.servicesList[serviceIndex].enabled = !this._shop.servicesList[serviceIndex].enabled;
    await this.render();
  }

  /**
   * Add a new service to the shop
   */
  static async #onAddService(event, target) {
    // Get available service templates
    const { getServiceDatabase } = await import("../data/service-database.mjs");
    const serviceDB = getServiceDatabase();
    const templates = serviceDB?.getAllTemplates() || [];

    if (templates.length === 0) {
      ui.notifications.warn("No service templates available. Create templates in the Service Database Manager first.");
      return;
    }

    // Group templates by category
    const grouped = {};
    for (const template of templates) {
      const category = template.category || "misc";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(template);
    }

    // Build dialog content with categorized service list
    let content = `
      <form class="bobsnpc-service-selector">
        <div class="form-group">
          <label>Select a service to add:</label>
          <select name="serviceTemplate" style="width: 100%; padding: 6px; margin-top: 8px;">
            <option value="">-- Choose a service --</option>
    `;

    for (const [category, services] of Object.entries(grouped)) {
      content += `<optgroup label="${category.toUpperCase()}">`;
      for (const service of services) {
        const pricing = service.priceType === "fixed"
          ? `${service.basePrice}gp`
          : service.priceType;
        content += `<option value="${service.type}">${service.name} (${pricing})</option>`;
      }
      content += `</optgroup>`;
    }

    content += `
          </select>
        </div>
        <p class="hint" style="margin-top: 8px; font-size: 0.9em; color: #999;">
          Service templates can be managed in the Service Database Manager
        </p>
      </form>
    `;

    // Show dialog
    const selectedType = await new Promise(resolve => {
      new Dialog({
        title: "Add Service to Shop",
        content,
        buttons: {
          add: {
            icon: '<i class="fas fa-plus"></i>',
            label: "Add Service",
            callback: html => {
              const select = html.find('[name="serviceTemplate"]');
              resolve(select.val());
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => resolve(null)
          }
        },
        default: "add"
      }, {
        classes: ["bobsnpc", "service-selector-dialog"],
        width: 450
      }).render(true);
    });

    if (!selectedType) return;

    // Find the selected template
    const template = templates.find(t => t.type === selectedType);
    if (!template) {
      ui.notifications.error("Service template not found");
      return;
    }

    // Clone the template and add to shop
    const { createServiceDefinition } = await import("../data/merchant-model.mjs");
    const newService = createServiceDefinition({
      ...template,
      enabled: true // Enable by default when adding to shop
    });

    if (!this._shop.servicesList) {
      this._shop.servicesList = [];
    }

    this._shop.servicesList.push(newService);
    ui.notifications.info(`Added "${template.name}" to shop services`);
    await this.render();
  }

  /**
   * Edit a service in the shop
   */
  static async #onEditService(event, target) {
    const serviceIndex = parseInt(target.dataset.serviceIndex);
    if (isNaN(serviceIndex) || !this._shop.servicesList?.[serviceIndex]) return;

    const service = this._shop.servicesList[serviceIndex];
    const { PriceType } = await import("../data/merchant-model.mjs");

    // Build edit dialog content
    let content = `
      <form class="bobsnpc-service-edit-form">
        <div class="form-group">
          <label>Service Name</label>
          <input type="text" name="name" value="${service.name}" style="width: 100%;">
        </div>

        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="3" style="width: 100%;">${service.description || ''}</textarea>
        </div>

        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label>Pricing Mode</label>
            <select name="priceType" style="width: 100%;">
              <option value="fixed" ${service.priceType === 'fixed' ? 'selected' : ''}>Fixed Price</option>
              <option value="percent" ${service.priceType === 'percent' ? 'selected' : ''}>Percentage</option>
              <option value="perDay" ${service.priceType === 'perDay' ? 'selected' : ''}>Per Day</option>
              <option value="itemValue" ${service.priceType === 'itemValue' ? 'selected' : ''}>Item Value %</option>
              <option value="spellLevel" ${service.priceType === 'spellLevel' ? 'selected' : ''}>Spell Level</option>
              <option value="enchantment" ${service.priceType === 'enchantment' ? 'selected' : ''}>Enchantment</option>
              <option value="tiered" ${service.priceType === 'tiered' ? 'selected' : ''}>Tiered</option>
            </select>
          </div>
          <div class="form-group">
            <label>Base Price (gp)</label>
            <input type="number" name="basePrice" value="${service.basePrice || 0}" min="0" step="0.01" style="width: 100%;">
          </div>
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" name="requiresGMApproval" ${service.requiresGMApproval ? 'checked' : ''}>
            Requires GM Approval
          </label>
        </div>

        <p class="hint" style="margin-top: 10px; font-size: 0.9em; color: #999;">
          For advanced pricing options (tiers, spell levels, etc.), edit the service template in the Service Database Manager.
        </p>
      </form>
    `;

    // Show dialog
    const result = await new Promise(resolve => {
      new Dialog({
        title: `Edit Service: ${service.name}`,
        content,
        buttons: {
          save: {
            icon: '<i class="fas fa-save"></i>',
            label: "Save Changes",
            callback: html => {
              const formData = new FormData(html.find('form')[0]);
              resolve({
                name: formData.get('name'),
                description: formData.get('description'),
                priceType: formData.get('priceType'),
                basePrice: parseFloat(formData.get('basePrice')) || 0,
                requiresGMApproval: formData.get('requiresGMApproval') === 'on'
              });
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => resolve(null)
          }
        },
        default: "save"
      }, {
        classes: ["bobsnpc", "service-edit-dialog"],
        width: 500
      }).render(true);
    });

    if (!result) return;

    // Update service with edited values
    Object.assign(service, result);
    ui.notifications.info(`Updated "${service.name}"`);
    await this.render();
  }

  /**
   * Remove a service from the shop
   */
  static async #onRemoveService(event, target) {
    const serviceIndex = parseInt(target.dataset.serviceIndex);
    if (isNaN(serviceIndex) || !this._shop.servicesList?.[serviceIndex]) return;

    const service = this._shop.servicesList[serviceIndex];
    const confirmed = await Dialog.confirm({
      title: "Remove Service",
      content: `<p>Remove "${service.name}" from this shop?</p>`
    });

    if (!confirmed) return;

    this._shop.servicesList.splice(serviceIndex, 1);
    await this.render();
  }

  /**
   * Prepare enhanced services list for display
   * Groups services by category
   * @returns {object[]}
   * @private
   */
  _prepareEnhancedServicesList() {
    if (!this._shop?.servicesList) return [];

    return this._shop.servicesList.map((service, index) => ({
      ...service,
      index,
      categoryLabel: localize(`ServiceCategories.${service.category}`) || service.category,
      typeLabel: localize(`ServiceTypes.${service.type}`) || service.type,
      priceDisplay: this._formatServicePrice(service)
    }));
  }

  /**
   * Format service price for display
   * @param {object} service - Service definition
   * @returns {string}
   * @private
   */
  _formatServicePrice(service) {
    switch (service.priceType) {
      case "fixed":
        return `${service.basePrice} gp`;
      case "percent":
        return `${(service.pricePercent || service.basePrice || 0)}% of value`;
      case "perDay":
        return `${service.pricePerUnit || service.basePrice || 0} gp/day`;
      case "perItem":
        return `${service.pricePerUnit || service.basePrice || 0} gp/item`;
      case "variable":
        return "Price varies";
      default:
        return `${service.basePrice || 0} gp`;
    }
  }

  /**
   * Prepare tiered service data from the business registry
   * @returns {object} { coreServices, crossCompatibleServices, hasCoreServices, hasCrossCompatible, businessDef }
   * @private
   */
  _prepareServiceTiers() {
    const businessType = this._shop?.businessType;
    if (!businessType) {
      return {
        coreServices: [],
        crossCompatibleServices: [],
        hasCoreServices: false,
        hasCrossCompatible: false,
        businessDef: null
      };
    }

    const def = getBusinessDefinition(businessType);
    if (!def) {
      return {
        coreServices: [],
        crossCompatibleServices: [],
        hasCoreServices: false,
        hasCrossCompatible: false,
        businessDef: null
      };
    }

    const coreServices = def.coreServices.map(s => ({
      ...s,
      categoryLabel: localize(`ServiceCategories.${s.category}`) || s.category,
      typeLabel: localize(`ServiceTypes.${s.type}`) || s.type,
      priceDisplay: this._formatServicePrice(s)
    }));

    const crossCompatibleServices = def.crossCompatibleServices.map(s => ({
      ...s,
      categoryLabel: localize(`ServiceCategories.${s.category}`) || s.category,
      typeLabel: localize(`ServiceTypes.${s.type}`) || s.type,
      priceDisplay: this._formatServicePrice(s),
      sourceName: s.sourceType ? (getBusinessDefinition(s.sourceType)?.name || s.sourceType) : ""
    }));

    return {
      coreServices,
      crossCompatibleServices,
      hasCoreServices: coreServices.length > 0,
      hasCrossCompatible: crossCompatibleServices.length > 0,
      businessDef: { name: def.name, icon: def.icon, color: def.color, subtitle: def.subtitle }
    };
  }
}
