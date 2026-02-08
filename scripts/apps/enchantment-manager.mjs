/**
 * Bob's Talking NPCs - Enchantment Manager
 * GM interface for managing the master enchantment list
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";
import {
  createEnchantment,
  EnchantmentItemType,
  EnchantmentRarity,
  DEFAULT_ENCHANTMENTS
} from "../data/enchantment-model.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Get enchantment handler instance from API
 */
function getEnchantmentHandler() {
  return game.bobsnpc?.handlers?.enchantment;
}

/**
 * Enchantment Manager Application
 * Allows GMs to manage the master list of enchantments
 */
export class EnchantmentManager extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._editingId = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-enchantment-manager",
    classes: ["bobsnpc", "enchantment-manager"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.Enchantment.Manager",
      icon: "fa-solid fa-wand-sparkles",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 700,
      height: 600
    },
    actions: {
      addEnchantment: EnchantmentManager.#onAddEnchantment,
      editEnchantment: EnchantmentManager.#onEditEnchantment,
      deleteEnchantment: EnchantmentManager.#onDeleteEnchantment,
      saveEnchantment: EnchantmentManager.#onSaveEnchantment,
      cancelEdit: EnchantmentManager.#onCancelEdit,
      resetDefaults: EnchantmentManager.#onResetDefaults,
      exportEnchantments: EnchantmentManager.#onExportEnchantments,
      importEnchantments: EnchantmentManager.#onImportEnchantments
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/enchantment-manager.hbs`,
      scrollable: [".enchantment-list"]
    }
  };

  /** @override */
  get title() {
    return localize("Enchantment.Manager");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const handler = getEnchantmentHandler();
    const enchantments = handler?.getAllEnchantments() || [];

    // Prepare enchantments for display
    const preparedEnchantments = enchantments.map(ench => ({
      ...ench,
      typeLabel: localize(`Enchantment.Types.${ench.type}`),
      rarityLabel: localize(`Enchantment.Rarity.${ench.rarity}`),
      effectsList: ench.effects?.join(", ") || "",
      isEditing: ench.id === this._editingId
    }));

    // Group by type
    const groupedEnchantments = {};
    for (const ench of preparedEnchantments) {
      if (!groupedEnchantments[ench.type]) {
        groupedEnchantments[ench.type] = {
          type: ench.type,
          typeLabel: ench.typeLabel,
          enchantments: []
        };
      }
      groupedEnchantments[ench.type].enchantments.push(ench);
    }

    // Type options for form
    const typeOptions = Object.entries(EnchantmentItemType).map(([key, value]) => ({
      value,
      label: localize(`Enchantment.Types.${value}`),
      selected: false
    }));

    // Rarity options for form
    const rarityOptions = Object.entries(EnchantmentRarity).map(([key, value]) => ({
      value,
      label: localize(`Enchantment.Rarity.${value}`),
      selected: false
    }));

    // Get editing enchantment if any
    let editingEnchantment = null;
    if (this._editingId) {
      editingEnchantment = handler?.getEnchantment(this._editingId);
    }

    return {
      ...context,
      enchantments: preparedEnchantments,
      groupedEnchantments: Object.values(groupedEnchantments),
      hasEnchantments: preparedEnchantments.length > 0,
      enchantmentCount: preparedEnchantments.length,
      typeOptions,
      rarityOptions,
      isEditing: this._editingId !== null,
      editingEnchantment,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  // ==================== Actions ====================

  static async #onAddEnchantment(event, target) {
    this._editingId = "new";
    this.render();
  }

  static async #onEditEnchantment(event, target) {
    const enchantmentId = target.dataset.enchantmentId;
    this._editingId = enchantmentId;
    this.render();
  }

  static async #onDeleteEnchantment(event, target) {
    const enchantmentId = target.dataset.enchantmentId;

    const confirmed = await Dialog.confirm({
      title: localize("Enchantment.Delete"),
      content: `<p>${localize("Enchantment.ConfirmDelete")}</p>`
    });

    if (!confirmed) return;

    const handler = getEnchantmentHandler();
    await handler?.deleteEnchantment(enchantmentId);

    ui.notifications.info(localize("Enchantment.Deleted"));
    this.render();
  }

  static async #onSaveEnchantment(event, target) {
    event.preventDefault();

    const form = this.element.querySelector("form.enchantment-form");
    if (!form) return;

    const formData = new FormData(form);
    const data = {
      name: formData.get("name"),
      description: formData.get("description"),
      type: formData.get("type"),
      rarity: formData.get("rarity"),
      baseCost: parseInt(formData.get("baseCost")) || 100,
      effects: formData.get("effects")?.split("\n").filter(e => e.trim()) || [],
      icon: formData.get("icon") || "fa-wand-sparkles"
    };

    const handler = getEnchantmentHandler();

    try {
      if (this._editingId === "new") {
        await handler.createEnchantment(data);
      } else {
        await handler.updateEnchantment(this._editingId, data);
      }

      ui.notifications.info(localize("Enchantment.Saved"));
      this._editingId = null;
      this.render();
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onCancelEdit(event, target) {
    this._editingId = null;
    this.render();
  }

  static async #onResetDefaults(event, target) {
    const confirmed = await Dialog.confirm({
      title: "Reset to Defaults",
      content: "<p>This will replace all enchantments with the default set. Continue?</p>"
    });

    if (!confirmed) return;

    const handler = getEnchantmentHandler();
    await handler?.resetToDefaults();

    ui.notifications.info("Enchantments reset to defaults");
    this.render();
  }

  static async #onExportEnchantments(event, target) {
    const handler = getEnchantmentHandler();
    const json = handler?.exportEnchantments();

    if (!json) return;

    // Create download
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bobsnpc-enchantments.json";
    a.click();
    URL.revokeObjectURL(url);

    ui.notifications.info("Enchantments exported");
  }

  static async #onImportEnchantments(event, target) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const text = await file.text();

      const replace = await Dialog.confirm({
        title: "Import Enchantments",
        content: "<p>Replace existing enchantments or add to them?</p>",
        yes: "Replace All",
        no: "Add to Existing"
      });

      const handler = getEnchantmentHandler();
      try {
        const count = await handler?.importEnchantments(text, replace);
        ui.notifications.info(`Imported ${count} enchantments`);
        this.render();
      } catch (error) {
        ui.notifications.error(`Import failed: ${error.message}`);
      }
    };

    input.click();
  }

  // ==================== Static Factory ====================

  /**
   * Open the enchantment manager
   * @returns {EnchantmentManager}
   */
  static async open() {
    // Check if already open
    const existing = Object.values(ui.windows).find(w => w instanceof EnchantmentManager);
    if (existing) {
      existing.bringToTop();
      return existing;
    }

    const manager = new EnchantmentManager();
    await manager.render(true);
    return manager;
  }
}
