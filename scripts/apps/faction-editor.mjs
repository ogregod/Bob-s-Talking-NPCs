/**
 * Bob's Talking NPCs - Faction Editor
 * GM tool for creating and editing factions using Foundry V13 ApplicationV2
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize, generateId } from "../utils/helpers.mjs";
import {
  createFaction,
  createRank,
  createDefaultRanks,
  createFactionRelationship,
  FactionRelationType,
  ReputationLevel
} from "../data/faction-model.mjs";

/** Get faction handler instance */
function getFactionHandler() {
  return game.bobsnpc?.handlers?.faction;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Faction Editor Application
 * Comprehensive GM tool for creating and editing factions
 */
export class FactionEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} faction - Existing faction data (null for new faction)
   * @param {object} options - Application options
   */
  constructor(faction = null, options = {}) {
    super(options);

    this._activeTab = options.tab || "general";
    this._isNew = !faction;

    // Working copy of faction data
    this._faction = faction ? foundry.utils.deepClone(faction) : createFaction({
      name: game.i18n.localize("BOBSNPC.FactionEditor.NewFaction")
    });
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-faction-editor",
    classes: ["bobsnpc", "faction-editor"],
    tag: "form",
    form: {
      handler: FactionEditor.#onFormSubmit,
      closeOnSubmit: false,
      submitOnChange: true
    },
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.FactionEditor.Title",
      icon: "fa-solid fa-flag",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 700,
      height: 650
    },
    actions: {
      changeTab: FactionEditor.#onChangeTab,
      addRank: FactionEditor.#onAddRank,
      removeRank: FactionEditor.#onRemoveRank,
      moveRankUp: FactionEditor.#onMoveRankUp,
      moveRankDown: FactionEditor.#onMoveRankDown,
      useDefaultRanks: FactionEditor.#onUseDefaultRanks,
      addRelationship: FactionEditor.#onAddRelationship,
      removeRelationship: FactionEditor.#onRemoveRelationship,
      saveFaction: FactionEditor.#onSaveFaction,
      cancelEdit: FactionEditor.#onCancelEdit,
      deleteFaction: FactionEditor.#onDeleteFaction,
      duplicateFaction: FactionEditor.#onDuplicateFaction,
      pickColor: FactionEditor.#onPickColor,
      pickIcon: FactionEditor.#onPickIcon
    }
  };

  /** @override */
  static PARTS = {
    tabs: {
      template: `modules/${MODULE_ID}/templates/faction-editor/tabs.hbs`
    },
    general: {
      template: `modules/${MODULE_ID}/templates/faction-editor/general.hbs`,
      scrollable: [".tab-content"]
    },
    ranks: {
      template: `modules/${MODULE_ID}/templates/faction-editor/ranks.hbs`,
      scrollable: [".tab-content"]
    },
    relationships: {
      template: `modules/${MODULE_ID}/templates/faction-editor/relationships.hbs`,
      scrollable: [".tab-content"]
    },
    settings: {
      template: `modules/${MODULE_ID}/templates/faction-editor/settings.hbs`,
      scrollable: [".tab-content"]
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/faction-editor/footer.hbs`
    }
  };

  /** @override */
  get title() {
    if (this._isNew) {
      return game.i18n.localize("BOBSNPC.FactionEditor.TitleNew");
    }
    return game.i18n.format("BOBSNPC.FactionEditor.TitleEdit", { name: this._faction.name });
  }

  /** @override */
  async _prepareContext(options) {
    const allFactions = getFactionHandler()?.getAllFactions() || [];
    const otherFactions = allFactions.filter(f => f.id !== this._faction.id);

    // Prepare ranks display data
    const ranksDisplay = (this._faction.ranks || []).map((rank, index) => ({
      ...rank,
      index,
      canMoveUp: index > 0,
      canMoveDown: index < this._faction.ranks.length - 1
    }));

    // Prepare relationships display data
    const relationshipsDisplay = (this._faction.factionRelationships || []).map((rel, index) => {
      const faction = allFactions.find(f => f.id === rel.factionId);
      return {
        ...rel,
        index,
        factionName: faction?.name || rel.factionId || "Unknown Faction"
      };
    });

    return {
      faction: this._faction,
      isNew: this._isNew,
      activeTab: this._activeTab,
      theme: game.settings.get(MODULE_ID, "theme") || "default",

      // Related data
      otherFactions,
      ranksDisplay,
      relationshipsDisplay,

      // Enum options
      relationshipTypeOptions: this._getRelationshipTypeOptions(),
      decayIntervalOptions: this._getDecayIntervalOptions(),

      // Predefined icons
      iconOptions: this._getIconOptions(),

      // Helpers
      isGM: game.user.isGM
    };
  }

  /** @override */
  _preparePartContext(partId, context) {
    context.tab = partId;
    return context;
  }

  // ==================== OPTION GETTERS ====================

  _getRelationshipTypeOptions() {
    return [
      { value: FactionRelationType.ALLIED, label: localize("FactionEditor.Relationship.Allied") },
      { value: FactionRelationType.NEUTRAL, label: localize("FactionEditor.Relationship.Neutral") },
      { value: FactionRelationType.RIVAL, label: localize("FactionEditor.Relationship.Rival") },
      { value: FactionRelationType.ENEMY, label: localize("FactionEditor.Relationship.Enemy") }
    ];
  }

  _getDecayIntervalOptions() {
    return [
      { value: "day", label: localize("FactionEditor.Decay.Day") },
      { value: "week", label: localize("FactionEditor.Decay.Week") },
      { value: "month", label: localize("FactionEditor.Decay.Month") }
    ];
  }

  _getIconOptions() {
    return [
      { value: "fa-flag", label: "Flag" },
      { value: "fa-shield", label: "Shield" },
      { value: "fa-crown", label: "Crown" },
      { value: "fa-chess-rook", label: "Tower" },
      { value: "fa-dragon", label: "Dragon" },
      { value: "fa-skull", label: "Skull" },
      { value: "fa-star", label: "Star" },
      { value: "fa-sun", label: "Sun" },
      { value: "fa-moon", label: "Moon" },
      { value: "fa-tree", label: "Tree" },
      { value: "fa-anchor", label: "Anchor" },
      { value: "fa-hammer", label: "Hammer" },
      { value: "fa-book", label: "Book" },
      { value: "fa-scroll", label: "Scroll" },
      { value: "fa-gem", label: "Gem" },
      { value: "fa-hand-fist", label: "Fist" }
    ];
  }

  // ==================== FORM HANDLING ====================

  /**
   * Handle form submission
   */
  static async #onFormSubmit(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);

    // Update faction data from form
    if (data.faction) {
      foundry.utils.mergeObject(this._faction, data.faction, { overwrite: true });
    }
  }

  // ==================== TAB ACTIONS ====================

  /**
   * Handle tab change
   */
  static async #onChangeTab(event, target) {
    const tab = target.dataset.tab;
    if (tab && tab !== this._activeTab) {
      this._activeTab = tab;
      this.render();
    }
  }

  // ==================== RANK ACTIONS ====================

  /**
   * Add new rank
   */
  static async #onAddRank(event, target) {
    const newRank = createRank({
      name: game.i18n.localize("BOBSNPC.FactionEditor.NewRank"),
      order: this._faction.ranks.length
    });
    this._faction.ranks.push(newRank);
    this.render();
  }

  /**
   * Remove rank
   */
  static async #onRemoveRank(event, target) {
    const index = parseInt(target.dataset.index, 10);
    if (!isNaN(index) && index >= 0 && index < this._faction.ranks.length) {
      this._faction.ranks.splice(index, 1);
      // Reorder remaining ranks
      this._faction.ranks.forEach((rank, i) => rank.order = i);
      this.render();
    }
  }

  /**
   * Move rank up
   */
  static async #onMoveRankUp(event, target) {
    const index = parseInt(target.dataset.index, 10);
    if (index > 0) {
      const temp = this._faction.ranks[index];
      this._faction.ranks[index] = this._faction.ranks[index - 1];
      this._faction.ranks[index - 1] = temp;
      // Update order
      this._faction.ranks.forEach((rank, i) => rank.order = i);
      this.render();
    }
  }

  /**
   * Move rank down
   */
  static async #onMoveRankDown(event, target) {
    const index = parseInt(target.dataset.index, 10);
    if (index < this._faction.ranks.length - 1) {
      const temp = this._faction.ranks[index];
      this._faction.ranks[index] = this._faction.ranks[index + 1];
      this._faction.ranks[index + 1] = temp;
      // Update order
      this._faction.ranks.forEach((rank, i) => rank.order = i);
      this.render();
    }
  }

  /**
   * Reset to default ranks
   */
  static async #onUseDefaultRanks(event, target) {
    const confirmed = await Dialog.confirm({
      title: game.i18n.localize("BOBSNPC.FactionEditor.ResetRanksTitle"),
      content: game.i18n.localize("BOBSNPC.FactionEditor.ResetRanksContent")
    });
    if (confirmed) {
      this._faction.ranks = createDefaultRanks();
      this._faction.useDefaultRanks = true;
      this.render();
    }
  }

  // ==================== RELATIONSHIP ACTIONS ====================

  /**
   * Add new relationship
   */
  static async #onAddRelationship(event, target) {
    const allFactions = getFactionHandler()?.getAllFactions() || [];
    const existingRelIds = (this._faction.factionRelationships || []).map(r => r.factionId);
    const availableFactions = allFactions.filter(
      f => f.id !== this._faction.id && !existingRelIds.includes(f.id)
    );

    if (availableFactions.length === 0) {
      ui.notifications.warn(game.i18n.localize("BOBSNPC.FactionEditor.NoFactionsAvailable"));
      return;
    }

    if (!this._faction.factionRelationships) {
      this._faction.factionRelationships = [];
    }

    this._faction.factionRelationships.push(createFactionRelationship({
      factionId: availableFactions[0].id,
      type: FactionRelationType.NEUTRAL
    }));
    this.render();
  }

  /**
   * Remove relationship
   */
  static async #onRemoveRelationship(event, target) {
    const index = parseInt(target.dataset.index, 10);
    if (!isNaN(index) && this._faction.factionRelationships) {
      this._faction.factionRelationships.splice(index, 1);
      this.render();
    }
  }

  // ==================== VISUAL ACTIONS ====================

  /**
   * Pick color
   */
  static async #onPickColor(event, target) {
    // Colors will be picked via the native color input in the form
  }

  /**
   * Pick icon
   */
  static async #onPickIcon(event, target) {
    const icon = target.dataset.icon;
    if (icon) {
      this._faction.icon = icon;
      this.render();
    }
  }

  // ==================== SAVE/CANCEL ACTIONS ====================

  /**
   * Save faction
   */
  static async #onSaveFaction(event, target) {
    // Validate faction
    if (!this._faction.name?.trim()) {
      ui.notifications.error(game.i18n.localize("BOBSNPC.FactionEditor.NameRequired"));
      return;
    }

    const handler = getFactionHandler();
    if (!handler) {
      ui.notifications.error(game.i18n.localize("BOBSNPC.FactionEditor.HandlerNotFound"));
      return;
    }

    try {
      if (this._isNew) {
        await handler.createFaction(this._faction);
        ui.notifications.info(game.i18n.localize("BOBSNPC.FactionEditor.FactionCreated"));
      } else {
        await handler.updateFaction(this._faction.id, this._faction);
        ui.notifications.info(game.i18n.localize("BOBSNPC.FactionEditor.FactionUpdated"));
      }

      // Refresh GM Dashboard if open
      const dashboard = Object.values(ui.windows).find(w => w.id === "bobsnpc-gm-dashboard");
      if (dashboard) dashboard.render();

      this.close();
    } catch (error) {
      console.error(`${MODULE_ID} | Error saving faction:`, error);
      ui.notifications.error(game.i18n.localize("BOBSNPC.FactionEditor.SaveError"));
    }
  }

  /**
   * Cancel edit
   */
  static async #onCancelEdit(event, target) {
    this.close();
  }

  /**
   * Delete faction
   */
  static async #onDeleteFaction(event, target) {
    if (this._isNew) {
      this.close();
      return;
    }

    const confirmed = await Dialog.confirm({
      title: game.i18n.localize("BOBSNPC.FactionEditor.DeleteConfirmTitle"),
      content: game.i18n.format("BOBSNPC.FactionEditor.DeleteConfirmContent", { name: this._faction.name })
    });

    if (!confirmed) return;

    const handler = getFactionHandler();
    if (handler) {
      await handler.deleteFaction(this._faction.id);
      ui.notifications.info(game.i18n.localize("BOBSNPC.FactionEditor.FactionDeleted"));

      // Refresh GM Dashboard if open
      const dashboard = Object.values(ui.windows).find(w => w.id === "bobsnpc-gm-dashboard");
      if (dashboard) dashboard.render();
    }

    this.close();
  }

  /**
   * Duplicate faction
   */
  static async #onDuplicateFaction(event, target) {
    const duplicatedFaction = createFaction({
      ...this._faction,
      id: generateId(),
      name: `${this._faction.name} (Copy)`,
      members: []
    });

    // Reset rank IDs
    duplicatedFaction.ranks.forEach(rank => {
      rank.id = generateId();
    });

    // Open new editor with duplicated faction
    const editor = new FactionEditor(duplicatedFaction);
    editor._isNew = true;
    editor.render(true);
  }
}
