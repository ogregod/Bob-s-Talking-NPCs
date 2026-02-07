/**
 * Bob's Talking NPCs - Shop Editor
 * Detailed editor for creating and modifying shops
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize, generateId } from "../utils/helpers.mjs";
import {
  ShopType,
  StockRefreshType,
  PriceDisplayMode,
  ItemRarity,
  createShopItem
} from "../data/merchant-model.mjs";

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
    id: "bobsnpc-shop-editor",
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
      browseCompendium: ShopEditor.#onBrowseCompendium,
      selectIcon: ShopEditor.#onSelectIcon,
      selectBanner: ShopEditor.#onSelectBanner,
      linkNpc: ShopEditor.#onLinkNpc,
      unlinkNpc: ShopEditor.#onUnlinkNpc,
      previewShop: ShopEditor.#onPreviewShop,
      duplicateShop: ShopEditor.#onDuplicateShop,
      exportShop: ShopEditor.#onExportShop
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

  /** @override */
  async _preFirstRender(context, options) {
    await super._preFirstRender(context, options);

    console.log(`${MODULE_ID} | ShopEditor._preFirstRender - shopId: ${this.shopId}`);

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
        // Don't throw - just create a new shop
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

  /**
   * Ensure shop has all required default values
   * @param {object} shop - Shop data
   * @returns {object} Shop with defaults applied
   */
  _ensureShopDefaults(shop) {
    // Ensure critical fields have valid values
    shop.id = shop.id || generateId();
    shop.name = shop.name || "";
    shop.type = shop.type || ShopType.GENERAL;
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
    shop.buyBack = shop.buyBack || { enabled: false };

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
      type: ShopType.GENERAL,
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
    const context = await super._prepareContext(options);

    if (!this._shop) {
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

    // Build options for selects
    const typeOptions = Object.entries(ShopType).map(([key, value]) => ({
      value,
      label: localize(`ShopTypes.${key}`),
      selected: this._shop.type === value
    }));

    console.log(`${MODULE_ID} | ShopEditor._prepareContext - typeOptions:`, typeOptions);
    console.log(`${MODULE_ID} | ShopEditor._prepareContext - shop.type:`, this._shop.type);
    console.log(`${MODULE_ID} | ShopEditor._prepareContext - shop.color:`, this._shop.color);

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

    return {
      ...context,
      shop: this._shop,
      activeTab: this._activeTab,
      tabs: this._getTabs(),

      // Basic tab
      typeOptions,
      linkedNpc: linkedNpc ? { name: linkedNpc.name, img: linkedNpc.img } : null,

      // Inventory tab
      inventory: enrichedInventory,
      inventoryCount: enrichedInventory.length,
      hasInventory: enrichedInventory.length > 0,

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

      // Access tab
      access: this._shop.access,

      // Buyback
      buyBack: this._shop.buyBack
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
    return [
      { id: "basic", label: localize("ShopEditor.TabBasic"), icon: "fa-info-circle", active: this._activeTab === "basic" },
      { id: "inventory", label: localize("ShopEditor.TabInventory"), icon: "fa-boxes", active: this._activeTab === "inventory", badge: inventoryCount > 0 ? inventoryCount : null },
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

    // Convert numeric values
    if (input.type === "number") {
      value = parseFloat(value) || 0;
    }

    // Update shop object using dot notation path
    foundry.utils.setProperty(this._shop, name, value);
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
}
