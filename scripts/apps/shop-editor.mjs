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
    this._shop = null;
    this._activeTab = "basic";
    this._pendingChanges = {};
    this._inventoryChanges = [];
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
      unlinkNpc: ShopEditor.#onUnlinkNpc
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

    // Load shop data
    if (this.shopId) {
      this._shop = getMerchantHandler().getMerchant(this.shopId);
      if (!this._shop) {
        throw new Error(`Shop not found: ${this.shopId}`);
      }
      // Create a working copy
      this._shop = foundry.utils.deepClone(this._shop);
    }
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    if (!this._shop) {
      return { ...context, error: "Shop not found" };
    }

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
   * Get tab configuration
   * @returns {object[]}
   */
  _getTabs() {
    return [
      { id: "basic", label: localize("ShopEditor.TabBasic"), icon: "fa-info-circle", active: this._activeTab === "basic" },
      { id: "inventory", label: localize("ShopEditor.TabInventory"), icon: "fa-boxes", active: this._activeTab === "inventory" },
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
    // Update timestamp
    this._shop.updatedAt = Date.now();

    // Save to handler
    const handler = getMerchantHandler();
    await handler.updateMerchant(this.shopId, this._shop);

    ui.notifications.info(localize("ShopEditor.Saved", { name: this._shop.name }));

    // Refresh shop manager if open
    const manager = Object.values(ui.windows).find(w => w.constructor.name === "ShopManager");
    if (manager) {
      await manager.render();
    }

    await this.close();
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
}
