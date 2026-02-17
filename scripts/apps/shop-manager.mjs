/**
 * Bob's Talking NPCs - Shop Manager
 * Main interface for creating and managing shops
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";
import {
  BusinessCategory,
  BusinessType,
  createMerchant
} from "../data/merchant-model.mjs";
import {
  getBusinessDefinition,
  getBusinessesByCategory,
  getAllBusinessTypes,
  createMerchantFromBusinessType
} from "../data/business-registry.mjs";

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
      useTemplate: ShopManager.#onUseTemplate,
      useBusinessTemplate: ShopManager.#onUseBusinessTemplate
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

    console.log(`${MODULE_ID} | ShopManager._prepareContext - handler available:`, !!handler);

    // Get all shops - try handler first, fall back to settings
    let shops = handler?.getAllMerchants() || [];
    console.log(`${MODULE_ID} | ShopManager._prepareContext - shops from handler:`, shops.length);

    if (shops.length === 0) {
      const shopsSettings = game.settings.get(MODULE_ID, "shops") || {};
      shops = Object.values(shopsSettings);
      console.log(`${MODULE_ID} | ShopManager._prepareContext - shops from settings:`, shops.length);
    }

    // Debug: Log shop IDs
    console.log(`${MODULE_ID} | ShopManager._prepareContext - shop IDs:`, shops.map(s => ({ id: s.id, name: s.name })));

    // Apply type filter (matches legacy ShopType or new BusinessType)
    if (this._typeFilter && this._typeFilter !== "all") {
      shops = shops.filter(s =>
        s.type === this._typeFilter || s.businessType === this._typeFilter
      );
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

    // Build type filter options with optgroup-style categories
    const typeOptions = [
      { value: "all", label: localize("ShopManager.AllTypes"), selected: this._typeFilter === "all" }
    ];

    // Add BusinessType options for filtering
    for (const [key, value] of Object.entries(BusinessType)) {
      typeOptions.push({
        value,
        label: localize(`BusinessTypes.${key}`) || key.replace(/_/g, " "),
        selected: this._typeFilter === value
      });
    }

    // Legacy templates removed - use business registry templates instead
    const templates = [];

    // Build categorized business type templates from registry
    const businessCategories = this._prepareCategorizedTemplates();

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
      businessCategories,
      hasBusinessCategories: businessCategories.length > 0,
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
    // Try BusinessType localization first, fall back to raw type
    const key = Object.keys(BusinessType).find(k => BusinessType[k] === type);
    if (key) return localize(`BusinessTypes.${key}`) || key.replace(/_/g, " ");
    return type || "Unknown";
  }

  /**
   * Get type icon
   * @param {string} type - Shop type
   * @returns {string}
   */
  _getTypeIcon(type) {
    const icons = {
      general: "fa-store",
      weapons: "fa-sword",
      armor: "fa-shield",
      magic: "fa-wand-sparkles",
      potions: "fa-flask",
      scrolls: "fa-scroll",
      tools: "fa-wrench",
      food: "fa-utensils",
      jewelry: "fa-gem",
      blacksmith: "fa-hammer",
      tailor: "fa-scissors",
      stable: "fa-horse",
      inn: "fa-bed",
      blackMarket: "fa-mask",
      custom: "fa-cog"
    };
    // Check by legacy type string, then try to find from business registry
    if (icons[type]) return icons[type];
    // Look up from business registry definition
    const def = game.bobsnpc?.handlers?.merchant?._getBusinessDefinition?.(type);
    return def?.icon || "fa-store";
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
      inn: "Food, drink, rooms, and rest",
      tailor: "Custom clothing, alterations, and repairs",
      stable: "Horse boarding, rentals, and mount care",
      temple: "Healing, blessings, and divine services",
      guild_hall: "Training, contracts, and guild services",
      bank: "Currency exchange, storage, and transfers",
      tavern: "Drinks, meals, gambling, and rumors",
      jeweler: "Gems, jewelry, appraisals, and engraving",
      scribe: "Scrolls, translations, and research",
      arena: "Combat, training, and wagering",
      dock_master: "Ship passage, warehouse storage, and port services",
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
    // Use business registry to create merchant from template
    const { createMerchantFromBusinessType } = await import("../data/business-registry.mjs");
    const shopData = createMerchantFromBusinessType?.(templateKey) || createMerchant({ name: "New Shop" });
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

    // Open the shop window - pass merchantId (which is the shop ID)
    const { ShopWindow } = await import("./shop-window.mjs");
    const shopWindow = new ShopWindow({
      merchantId: shop.id,
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
    const shopEntry = target.closest("[data-shop-id]");
    const shopId = shopEntry?.dataset?.shopId;

    console.log(`${MODULE_ID} | ShopManager.#onEditShop - shopEntry:`, shopEntry);
    console.log(`${MODULE_ID} | ShopManager.#onEditShop - shopId:`, shopId);

    if (!shopId) {
      console.error(`${MODULE_ID} | No shopId found for edit action`);
      ui.notifications.error(localize("ShopManager.ShopNotFound"));
      return;
    }

    // Check if there's already an editor open for this shop
    const existingEditorId = `bobsnpc-shop-editor-${shopId}`;
    const existingEditor = Object.values(ui.windows).find(w => w.id === existingEditorId);
    if (existingEditor) {
      existingEditor.bringToTop();
      return;
    }

    // Close any "new shop" editor that might be open
    const newShopEditor = Object.values(ui.windows).find(w => w.id === "bobsnpc-shop-editor-new");
    if (newShopEditor) {
      await newShopEditor.close();
    }

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

  /**
   * Use a business type template to create a shop
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onUseBusinessTemplate(event, target) {
    const businessType = target.dataset.businessType;
    if (!businessType) return;

    const handler = getMerchantHandler();
    const shopData = createMerchantFromBusinessType(businessType);
    let shop;

    if (handler?.createMerchant) {
      shop = await handler.createMerchant(shopData);
    } else {
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

    await this.render();

    ui.notifications.info(localize("ShopManager.ShopCreated", { name: shop.name }));
  }

  /**
   * Prepare categorized business type templates from the registry
   * @returns {object[]} Array of { category, categoryLabel, categoryIcon, categoryColor, businesses }
   * @private
   */
  _prepareCategorizedTemplates() {
    const categoryMeta = {
      [BusinessCategory.FORGE_STONE_EARTH]: { icon: "fa-hammer", color: "#8B4513" },
      [BusinessCategory.WOOD_HIDE_FIBER]: { icon: "fa-tree", color: "#228B22" },
      [BusinessCategory.ARCANE_ACADEMIC]: { icon: "fa-hat-wizard", color: "#7B2D8E" },
      [BusinessCategory.FOOD_PROVISIONS]: { icon: "fa-wheat-awn", color: "#DAA520" },
      [BusinessCategory.HOSPITALITY_TRAVEL]: { icon: "fa-bed", color: "#4169E1" },
      [BusinessCategory.CIVIC_FAITH_LAW]: { icon: "fa-landmark", color: "#CD853F" },
      [BusinessCategory.ARTS_LEISURE_BODY]: { icon: "fa-palette", color: "#DB7093" },
      [BusinessCategory.ILLICIT_NICHE_MARITIME]: { icon: "fa-skull-crossbones", color: "#2F4F4F" }
    };

    const categories = [];

    for (const [catKey, catValue] of Object.entries(BusinessCategory)) {
      const businesses = getBusinessesByCategory(catValue);
      if (!businesses?.length) continue;

      const meta = categoryMeta[catValue] || { icon: "fa-store", color: "#666" };

      categories.push({
        category: catValue,
        categoryLabel: localize(`BusinessCategories.${catValue}`) || catKey,
        categoryIcon: meta.icon,
        categoryColor: meta.color,
        businessCount: businesses.length,
        businesses: businesses.map(def => ({
          type: def.type,
          name: def.name,
          subtitle: def.subtitle || "",
          description: def.description || "",
          icon: def.icon || "fa-store",
          color: def.color || meta.color
        }))
      });
    }

    return categories;
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
