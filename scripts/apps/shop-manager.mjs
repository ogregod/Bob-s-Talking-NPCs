/**
 * Bob's Talking NPCs - Shop Manager
 * Main interface for creating and managing shops
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";
import {
  ShopType,
  MerchantTemplates,
  createMerchantFromTemplate
} from "../data/merchant-model.mjs";

/** Get merchant handler instance */
function getMerchantHandler() {
  return game.bobsnpc?.handlers?.merchant;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Shop Manager Application
 * Lists all shops and provides create/edit/delete functionality
 */
export class ShopManager extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._searchFilter = "";
    this._typeFilter = "all";
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-shop-manager",
    classes: ["bobsnpc", "shop-manager"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.ShopManager.Title",
      icon: "fa-solid fa-store",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 700,
      height: 600
    },
    actions: {
      createShop: ShopManager.#onCreateShop,
      openShop: ShopManager.#onOpenShop,
      editShop: ShopManager.#onEditShop,
      deleteShop: ShopManager.#onDeleteShop,
      duplicateShop: ShopManager.#onDuplicateShop,
      filterType: ShopManager.#onFilterType,
      search: ShopManager.#onSearch,
      clearSearch: ShopManager.#onClearSearch,
      useTemplate: ShopManager.#onUseTemplate
    }
  };

  /** @override */
  static PARTS = {
    header: {
      template: `modules/${MODULE_ID}/templates/shop-manager/header.hbs`
    },
    list: {
      template: `modules/${MODULE_ID}/templates/shop-manager/list.hbs`,
      scrollable: [".shop-list"]
    },
    templates: {
      template: `modules/${MODULE_ID}/templates/shop-manager/templates.hbs`
    }
  };

  /** @override */
  get title() {
    return localize("ShopManager.Title");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const handler = getMerchantHandler();

    // Get all shops - try handler first, fall back to settings
    let shops = handler?.getAllMerchants() || [];
    if (shops.length === 0) {
      const shopsSettings = game.settings.get(MODULE_ID, "shops") || {};
      shops = Object.values(shopsSettings);
    }

    // Apply type filter
    if (this._typeFilter && this._typeFilter !== "all") {
      shops = shops.filter(s => s.type === this._typeFilter);
    }

    // Apply search filter
    if (this._searchFilter) {
      const search = this._searchFilter.toLowerCase();
      shops = shops.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.description?.toLowerCase().includes(search)
      );
    }

    // Sort by name
    shops.sort((a, b) => a.name.localeCompare(b.name));

    // Enrich shop data for display
    const enrichedShops = await Promise.all(shops.map(async shop => {
      let linkedNpcName = null;
      if (shop.npcActorUuid) {
        try {
          const npc = await fromUuid(shop.npcActorUuid);
          linkedNpcName = npc?.name || "Unknown NPC";
        } catch (e) {
          linkedNpcName = "Invalid NPC";
        }
      }

      return {
        ...shop,
        itemCount: shop.inventory?.length || 0,
        linkedNpcName,
        typeLabel: this._getTypeLabel(shop.type),
        typeIcon: this._getTypeIcon(shop.type)
      };
    }));

    // Build type filter options
    const typeOptions = [
      { value: "all", label: localize("ShopManager.AllTypes"), selected: this._typeFilter === "all" },
      ...Object.entries(ShopType).map(([key, value]) => ({
        value,
        label: localize(`ShopTypes.${key}`),
        selected: this._typeFilter === value
      }))
    ];

    // Build template options
    const templates = Object.entries(MerchantTemplates).map(([key, template]) => ({
      key,
      name: template.name,
      type: template.type,
      icon: template.icon || "fa-store",
      color: template.color || "#ff9800",
      description: this._getTemplateDescription(key)
    }));

    // Calculate total shops (before filtering)
    let totalShops = handler?.getAllMerchants()?.length || 0;
    if (totalShops === 0) {
      const shopsSettings = game.settings.get(MODULE_ID, "shops") || {};
      totalShops = Object.keys(shopsSettings).length;
    }

    return {
      ...context,
      shops: enrichedShops,
      shopCount: enrichedShops.length,
      totalShops,
      hasShops: enrichedShops.length > 0,
      typeOptions,
      templates,
      searchFilter: this._searchFilter,
      isFiltered: this._searchFilter || this._typeFilter !== "all"
    };
  }

  /**
   * Prepare context for individual template parts
   * @override
   */
  _preparePartContext(partId, context) {
    context.tab = partId;
    return context;
  }

  /**
   * Get type label
   * @param {string} type - Shop type
   * @returns {string}
   */
  _getTypeLabel(type) {
    const key = Object.keys(ShopType).find(k => ShopType[k] === type);
    return key ? localize(`ShopTypes.${key}`) : type;
  }

  /**
   * Get type icon
   * @param {string} type - Shop type
   * @returns {string}
   */
  _getTypeIcon(type) {
    const icons = {
      [ShopType.GENERAL]: "fa-store",
      [ShopType.WEAPONS]: "fa-sword",
      [ShopType.ARMOR]: "fa-shield",
      [ShopType.MAGIC]: "fa-wand-sparkles",
      [ShopType.POTIONS]: "fa-flask",
      [ShopType.SCROLLS]: "fa-scroll",
      [ShopType.TOOLS]: "fa-wrench",
      [ShopType.FOOD]: "fa-utensils",
      [ShopType.JEWELRY]: "fa-gem",
      [ShopType.BLACKSMITH]: "fa-hammer",
      [ShopType.TAILOR]: "fa-scissors",
      [ShopType.STABLE]: "fa-horse",
      [ShopType.INN]: "fa-bed",
      [ShopType.BLACK_MARKET]: "fa-mask",
      [ShopType.CUSTOM]: "fa-cog"
    };
    return icons[type] || "fa-store";
  }

  /**
   * Get template description
   * @param {string} templateKey - Template key
   * @returns {string}
   */
  _getTemplateDescription(templateKey) {
    const descriptions = {
      general_store: "A versatile shop selling common goods and supplies",
      blacksmith: "Weapons, armor, and repair services",
      alchemist: "Potions, ingredients, and identification services",
      magic_shop: "Magical items and enchanting services",
      fence: "Black market goods, no questions asked",
      inn: "Food, drink, and lodging",
      blank: "Start from scratch with default settings"
    };
    return descriptions[templateKey] || "";
  }

  // ==================== Helper Methods ====================

  /**
   * Get a shop by ID from handler or settings
   * @param {string} shopId - Shop ID
   * @returns {Object|null}
   */
  _getShop(shopId) {
    const handler = getMerchantHandler();
    let shop = handler?.getMerchant(shopId);
    if (!shop) {
      const shopsSettings = game.settings.get(MODULE_ID, "shops") || {};
      shop = shopsSettings[shopId];
    }
    return shop || null;
  }

  /**
   * Save a shop to settings
   * @param {Object} shop - Shop data
   */
  async _saveShopToSettings(shop) {
    const shops = game.settings.get(MODULE_ID, "shops") || {};
    shops[shop.id] = shop;
    await game.settings.set(MODULE_ID, "shops", shops);
  }

  /**
   * Delete a shop from settings
   * @param {string} shopId - Shop ID
   */
  async _deleteShopFromSettings(shopId) {
    const shops = game.settings.get(MODULE_ID, "shops") || {};
    delete shops[shopId];
    await game.settings.set(MODULE_ID, "shops", shops);
  }

  // ==================== Actions ====================

  /**
   * Create a new shop
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onCreateShop(event, target) {
    // Show template picker section
    const templateSection = this.element.querySelector(".shop-templates");
    if (templateSection) {
      templateSection.classList.toggle("visible");
    }
  }

  /**
   * Use a template to create shop
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onUseTemplate(event, target) {
    const templateKey = target.dataset.template;

    // Create shop from template
    const handler = getMerchantHandler();
    const shopData = createMerchantFromTemplate(templateKey);
    let shop;

    if (handler?.createMerchant) {
      shop = await handler.createMerchant(shopData);
    } else {
      // Fall back to settings storage
      shop = shopData;
      await this._saveShopToSettings(shop);
    }

    // Hide template picker
    const templateSection = this.element.querySelector(".shop-templates");
    if (templateSection) {
      templateSection.classList.remove("visible");
    }

    // Open editor for the new shop
    const { ShopEditor } = await import("./shop-editor.mjs");
    const editor = new ShopEditor({ shopId: shop.id });
    editor.render(true);

    // Refresh list
    await this.render();

    ui.notifications.info(localize("ShopManager.ShopCreated", { name: shop.name }));
  }

  /**
   * Open a shop (view as player would see it)
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onOpenShop(event, target) {
    const shopId = target.closest("[data-shop-id]").dataset.shopId;
    const shop = this._getShop(shopId);

    if (!shop) {
      ui.notifications.error(localize("ShopManager.ShopNotFound"));
      return;
    }

    // Get the current user's character or first owned character
    let playerActorUuid = null;
    if (game.user.character) {
      playerActorUuid = game.user.character.uuid;
    } else {
      // Find first owned character actor
      const ownedActor = game.actors.find(a => a.isOwner && a.type === "character");
      if (ownedActor) {
        playerActorUuid = ownedActor.uuid;
      }
    }

    if (!playerActorUuid) {
      ui.notifications.warn(localize("ShopManager.NoPlayerActor"));
      return;
    }

    // Open the shop window
    const { ShopWindow } = await import("./shop-window.mjs");
    const shopWindow = new ShopWindow({
      shopId: shop.id,
      playerActorUuid
    });
    shopWindow.render(true);
  }

  /**
   * Edit a shop
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onEditShop(event, target) {
    const shopId = target.closest("[data-shop-id]").dataset.shopId;

    const { ShopEditor } = await import("./shop-editor.mjs");
    const editor = new ShopEditor({ shopId });
    editor.render(true);
  }

  /**
   * Delete a shop
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onDeleteShop(event, target) {
    const shopId = target.closest("[data-shop-id]").dataset.shopId;
    const shop = this._getShop(shopId);

    if (!shop) return;

    const confirmed = await Dialog.confirm({
      title: localize("ShopManager.DeleteConfirmTitle"),
      content: `<p>${localize("ShopManager.DeleteConfirmContent", { name: shop.name })}</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });

    if (confirmed) {
      const handler = getMerchantHandler();
      if (handler?.deleteMerchant) {
        await handler.deleteMerchant(shopId);
      } else {
        await this._deleteShopFromSettings(shopId);
      }
      await this.render();
      ui.notifications.info(localize("ShopManager.ShopDeleted", { name: shop.name }));
    }
  }

  /**
   * Duplicate a shop
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onDuplicateShop(event, target) {
    const shopId = target.closest("[data-shop-id]").dataset.shopId;
    const shop = this._getShop(shopId);

    if (!shop) return;

    // Import generateId for new shop ID
    const { generateId } = await import("../utils/helpers.mjs");

    // Create copy with new ID and modified name
    const copy = {
      ...foundry.utils.deepClone(shop),
      id: generateId(),
      name: `${shop.name} (Copy)`,
      npcActorUuid: null, // Don't link to same NPC
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const handler = getMerchantHandler();
    let newShop;
    if (handler?.createMerchant) {
      newShop = await handler.createMerchant(copy);
    } else {
      newShop = copy;
      await this._saveShopToSettings(copy);
    }

    await this.render();

    ui.notifications.info(localize("ShopManager.ShopDuplicated", { name: newShop.name }));
  }

  /**
   * Filter by type
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onFilterType(event, target) {
    this._typeFilter = target.value;
    await this.render();
  }

  /**
   * Search shops
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onSearch(event, target) {
    this._searchFilter = target.value;
    await this.render();
  }

  /**
   * Clear search
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onClearSearch(event, target) {
    this._searchFilter = "";
    this._typeFilter = "all";
    await this.render();
  }

  // ==================== Static Factory ====================

  /**
   * Open the shop manager
   * @returns {ShopManager}
   */
  static async open() {
    const existing = Object.values(ui.windows).find(w => w instanceof ShopManager);
    if (existing) {
      existing.bringToTop();
      return existing;
    }

    const manager = new ShopManager();
    await manager.render(true);
    return manager;
  }
}
