/**
 * Bob's Talking NPCs - GM Dashboard
 * Central management interface for GMs to oversee all module features
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";

import { QuestEditor } from "./quest-editor.mjs";
import { FactionEditor } from "./faction-editor.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM Dashboard for managing NPCs, quests, factions, and world state
 * @extends ApplicationV2
 */
export class GMDashboard extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-gm-dashboard",
    classes: ["bobsnpc", "gm-dashboard"],
    tag: "div",
    window: {
      title: "BOBSNPC.GMDashboard.Title",
      icon: "fa-solid fa-gauge-high",
      resizable: true,
      minimizable: true
    },
    position: {
      width: 900,
      height: 700
    },
    actions: {
      changeTab: GMDashboard.#onChangeTab,
      createQuest: GMDashboard.#onCreateQuest,
      editQuest: GMDashboard.#onEditQuest,
      deleteQuest: GMDashboard.#onDeleteQuest,
      createFaction: GMDashboard.#onCreateFaction,
      editFaction: GMDashboard.#onEditFaction,
      deleteFaction: GMDashboard.#onDeleteFaction,
      configureNPC: GMDashboard.#onConfigureNPC,
      setWorldState: GMDashboard.#onSetWorldState,
      deleteWorldState: GMDashboard.#onDeleteWorldState,
      triggerEvent: GMDashboard.#onTriggerEvent,
      endEvent: GMDashboard.#onEndEvent,
      createBackup: GMDashboard.#onCreateBackup,
      restoreBackup: GMDashboard.#onRestoreBackup,
      exportData: GMDashboard.#onExportData,
      importData: GMDashboard.#onImportData,
      refreshData: GMDashboard.#onRefreshData
    }
  };

  /** @override */
  static PARTS = {
    tabs: {
      template: `modules/${MODULE_ID}/templates/gm-dashboard/tabs.hbs`
    },
    overview: {
      template: `modules/${MODULE_ID}/templates/gm-dashboard/overview.hbs`
    },
    quests: {
      template: `modules/${MODULE_ID}/templates/gm-dashboard/quests.hbs`
    },
    npcs: {
      template: `modules/${MODULE_ID}/templates/gm-dashboard/npcs.hbs`
    },
    factions: {
      template: `modules/${MODULE_ID}/templates/gm-dashboard/factions.hbs`
    },
    world: {
      template: `modules/${MODULE_ID}/templates/gm-dashboard/world.hbs`
    },
    tools: {
      template: `modules/${MODULE_ID}/templates/gm-dashboard/tools.hbs`
    }
  };

  /**
   * The currently active tab
   * @type {string}
   */
  #activeTab = "overview";

  /**
   * Cached data for the dashboard
   * @type {object}
   */
  #cachedData = null;

  /** @override */
  async _prepareContext(options) {
    const context = {
      moduleId: MODULE_ID,
      activeTab: this.#activeTab,
      tabs: this.#getTabs(),
      theme: game.settings.get(MODULE_ID, "theme")
    };

    // Load data based on active tab
    switch (this.#activeTab) {
      case "overview":
        context.overview = await this.#prepareOverviewData();
        break;
      case "quests":
        context.quests = await this.#prepareQuestsData();
        break;
      case "npcs":
        context.npcs = await this.#prepareNPCsData();
        break;
      case "factions":
        context.factions = await this.#prepareFactionsData();
        break;
      case "world":
        context.world = await this.#prepareWorldData();
        break;
      case "tools":
        context.tools = await this.#prepareToolsData();
        break;
    }

    this.#cachedData = context;
    return context;
  }

  /**
   * Get tab configuration
   * @returns {object[]}
   */
  #getTabs() {
    return [
      { id: "overview", label: "BOBSNPC.GMDashboard.Tabs.Overview", icon: "fa-solid fa-chart-pie" },
      { id: "quests", label: "BOBSNPC.GMDashboard.Tabs.Quests", icon: "fa-solid fa-scroll" },
      { id: "npcs", label: "BOBSNPC.GMDashboard.Tabs.NPCs", icon: "fa-solid fa-users" },
      { id: "factions", label: "BOBSNPC.GMDashboard.Tabs.Factions", icon: "fa-solid fa-flag" },
      { id: "world", label: "BOBSNPC.GMDashboard.Tabs.World", icon: "fa-solid fa-globe" },
      { id: "tools", label: "BOBSNPC.GMDashboard.Tabs.Tools", icon: "fa-solid fa-wrench" }
    ];
  }

  /**
   * Prepare overview statistics
   * @returns {Promise<object>}
   */
  async #prepareOverviewData() {
    // Get configured NPCs
    const configuredNPCs = game.actors.filter(a =>
      a.type === "npc" && a.getFlag(MODULE_ID, "config")?.enabled
    );

    // Get quests from journal
    const questJournal = game.journal.getName("Bob's NPCs - Quests");
    const quests = questJournal?.pages?.contents || [];

    // Get factions from settings or journal
    const factions = game.settings.get(MODULE_ID, "factions") || [];

    // Get active events from settings (V13 compatible)
    const activeEvents = game.settings.get(MODULE_ID, "activeEvents") || [];

    // Calculate statistics
    const stats = {
      totalNPCs: configuredNPCs.length,
      npcsByRole: this.#countNPCsByRole(configuredNPCs),
      totalQuests: quests.length,
      questsByStatus: this.#countQuestsByStatus(quests),
      totalFactions: factions.length,
      activeEvents: activeEvents.length,
      worldStateCount: Object.keys(game.settings.get(MODULE_ID, "worldState") || {}).length
    };

    // Recent activity
    const recentActivity = await this.#getRecentActivity();

    return {
      stats,
      recentActivity,
      configuredNPCs: configuredNPCs.slice(0, 5),
      activeQuests: quests.filter(q => q.getFlag(MODULE_ID, "status") === "active").slice(0, 5)
    };
  }

  /**
   * Prepare quests management data
   * @returns {Promise<object>}
   */
  async #prepareQuestsData() {
    const questJournal = game.journal.getName("Bob's NPCs - Quests");
    const quests = questJournal?.pages?.contents || [];

    const questList = quests.map(page => {
      const data = page.getFlag(MODULE_ID, "questData") || {};
      return {
        id: page.id,
        name: page.name,
        status: data.status || "available",
        category: data.category || "main",
        giver: data.giverName || "Unknown",
        level: data.level || "-",
        objectivesComplete: this.#countCompletedObjectives(data.objectives),
        objectivesTotal: data.objectives?.length || 0
      };
    });

    return {
      quests: questList,
      categories: ["main", "side", "faction", "personal", "daily", "weekly"],
      statuses: ["available", "accepted", "active", "complete", "failed", "expired"]
    };
  }

  /**
   * Prepare NPCs management data
   * @returns {Promise<object>}
   */
  async #prepareNPCsData() {
    const allNPCs = game.actors.filter(a => a.type === "npc");

    const npcList = allNPCs.map(npc => {
      const config = npc.getFlag(MODULE_ID, "config") || {};
      return {
        id: npc.id,
        uuid: npc.uuid,
        name: npc.name,
        img: npc.img,
        configured: config.enabled || false,
        roles: this.#getRoleIcons(config.roles || {}),
        hasDialogue: !!config.dialogueId,
        location: config.location || "-"
      };
    });

    // Sort: configured first, then alphabetically
    npcList.sort((a, b) => {
      if (a.configured !== b.configured) return b.configured - a.configured;
      return a.name.localeCompare(b.name);
    });

    return {
      npcs: npcList,
      totalConfigured: npcList.filter(n => n.configured).length,
      totalUnconfigured: npcList.filter(n => !n.configured).length
    };
  }

  /**
   * Prepare factions management data
   * @returns {Promise<object>}
   */
  async #prepareFactionsData() {
    const factionsData = game.settings.get(MODULE_ID, "factions") || {};
    // Convert object to array if needed (settings stores as Object)
    const factions = Array.isArray(factionsData) ? factionsData : Object.values(factionsData);

    const factionList = factions.map(faction => ({
      id: faction.id,
      name: faction.name,
      icon: faction.icon || "fa-flag",
      color: faction.color || "#808080",
      memberCount: this.#countFactionMembers(faction.id),
      rankCount: faction.ranks?.length || 0,
      description: faction.description || ""
    }));

    return {
      factions: factionList,
      totalFactions: factionList.length
    };
  }

  /**
   * Prepare world state data
   * @returns {Promise<object>}
   */
  async #prepareWorldData() {
    const worldState = game.settings.get(MODULE_ID, "worldState") || {};
    const activeEvents = game.settings.get(MODULE_ID, "activeEvents") || [];

    const stateEntries = Object.entries(worldState).map(([key, value]) => ({
      key,
      value: typeof value === "object" ? JSON.stringify(value) : String(value),
      type: typeof value
    }));

    const eventList = activeEvents.map(event => ({
      id: event.id,
      name: event.name,
      startedAt: event.startedAt,
      duration: event.duration || "Indefinite"
    }));

    return {
      worldState: stateEntries,
      activeEvents: eventList,
      totalStates: stateEntries.length,
      totalEvents: eventList.length
    };
  }

  /**
   * Prepare tools data
   * @returns {Promise<object>}
   */
  async #prepareToolsData() {
    const moduleVersion = game.modules.get(MODULE_ID)?.version || "Unknown";

    return {
      moduleVersion,
      foundryVersion: game.version,
      systemVersion: game.system.version,
      exportFormats: ["json", "yaml"],
      importSupported: true
    };
  }

  /**
   * Count NPCs by role
   * @param {Actor[]} npcs
   * @returns {object}
   */
  #countNPCsByRole(npcs) {
    const counts = {
      questGiver: 0,
      merchant: 0,
      banker: 0,
      trainer: 0,
      innkeeper: 0,
      guard: 0,
      other: 0
    };

    for (const npc of npcs) {
      const roles = npc.getFlag(MODULE_ID, "config")?.roles || {};
      let hasRole = false;
      for (const [role, enabled] of Object.entries(roles)) {
        if (enabled && counts.hasOwnProperty(role)) {
          counts[role]++;
          hasRole = true;
        }
      }
      if (!hasRole) counts.other++;
    }

    return counts;
  }

  /**
   * Count quests by status
   * @param {JournalEntryPage[]} quests
   * @returns {object}
   */
  #countQuestsByStatus(quests) {
    const counts = {
      available: 0,
      accepted: 0,
      active: 0,
      complete: 0,
      failed: 0
    };

    for (const quest of quests) {
      const status = quest.getFlag(MODULE_ID, "status") || "available";
      if (counts.hasOwnProperty(status)) {
        counts[status]++;
      }
    }

    return counts;
  }

  /**
   * Count completed objectives
   * @param {object[]} objectives
   * @returns {number}
   */
  #countCompletedObjectives(objectives) {
    if (!objectives) return 0;
    return objectives.filter(o => o.completed).length;
  }

  /**
   * Get role icons for NPC
   * @param {object} roles
   * @returns {object[]}
   */
  #getRoleIcons(roles) {
    const roleIcons = {
      questGiver: { icon: "fa-exclamation", color: "#ffd700", label: "Quest Giver" },
      merchant: { icon: "fa-coins", color: "#ff9800", label: "Merchant" },
      banker: { icon: "fa-landmark", color: "#4caf50", label: "Banker" },
      trainer: { icon: "fa-graduation-cap", color: "#2196f3", label: "Trainer" },
      innkeeper: { icon: "fa-bed", color: "#9c27b0", label: "Innkeeper" },
      guard: { icon: "fa-shield-halved", color: "#607d8b", label: "Guard" },
      blacksmith: { icon: "fa-hammer", color: "#795548", label: "Blacksmith" },
      healer: { icon: "fa-heart", color: "#e91e63", label: "Healer" }
    };

    return Object.entries(roles)
      .filter(([_, enabled]) => enabled)
      .map(([role, _]) => roleIcons[role] || { icon: "fa-user", color: "#808080", label: role });
  }

  /**
   * Count faction members
   * @param {string} factionId
   * @returns {number}
   */
  #countFactionMembers(factionId) {
    let count = 0;
    for (const actor of game.actors) {
      const factions = actor.getFlag(MODULE_ID, "factions") || [];
      if (factions.some(f => f.id === factionId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get recent activity
   * @returns {Promise<object[]>}
   */
  async #getRecentActivity() {
    // Placeholder - would track actual activity
    return [];
  }

  /* ===== Action Handlers ===== */

  /**
   * Handle tab change
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static #onChangeTab(event, target) {
    const tab = target.dataset.tab;
    if (tab) {
      this.#activeTab = tab;
      this.render();
    }
  }

  /**
   * Create new quest
   */
  static async #onCreateQuest(event, target) {
    const editor = new QuestEditor(null);
    editor.render(true);
  }

  /**
   * Edit quest
   */
  static async #onEditQuest(event, target) {
    const questId = target.dataset.questId;
    const quest = game.bobsnpc?.handlers?.quest?.getQuest(questId);
    if (!quest) {
      ui.notifications.error(game.i18n.localize("BOBSNPC.GMDashboard.QuestNotFound"));
      return;
    }
    const editor = new QuestEditor(quest);
    editor.render(true);
  }

  /**
   * Delete quest
   */
  static async #onDeleteQuest(event, target) {
    const questId = target.dataset.questId;
    const quest = game.bobsnpc?.handlers?.quest?.getQuest(questId);
    const questName = quest?.name || questId;

    const confirmed = await Dialog.confirm({
      title: game.i18n.localize("BOBSNPC.GMDashboard.DeleteQuest"),
      content: game.i18n.format("BOBSNPC.GMDashboard.DeleteQuestConfirm", { name: questName })
    });

    if (confirmed) {
      await game.bobsnpc?.handlers?.quest?.deleteQuest(questId);
      ui.notifications.info(game.i18n.format("BOBSNPC.GMDashboard.QuestDeleted", { name: questName }));
      this.render();
    }
  }

  /**
   * Create new faction
   */
  static async #onCreateFaction(event, target) {
    const editor = new FactionEditor(null);
    editor.render(true);
  }

  /**
   * Edit faction
   */
  static async #onEditFaction(event, target) {
    const factionId = target.dataset.factionId;
    const faction = game.bobsnpc?.handlers?.faction?.getFaction(factionId);
    if (!faction) {
      ui.notifications.error(game.i18n.localize("BOBSNPC.GMDashboard.FactionNotFound"));
      return;
    }
    const editor = new FactionEditor(faction);
    editor.render(true);
  }

  /**
   * Delete faction
   */
  static async #onDeleteFaction(event, target) {
    const factionId = target.dataset.factionId;
    const faction = game.bobsnpc?.handlers?.faction?.getFaction(factionId);
    const factionName = faction?.name || factionId;

    const confirmed = await Dialog.confirm({
      title: game.i18n.localize("BOBSNPC.GMDashboard.DeleteFaction"),
      content: game.i18n.format("BOBSNPC.GMDashboard.DeleteFactionConfirm", { name: factionName })
    });

    if (confirmed) {
      await game.bobsnpc?.handlers?.faction?.deleteFaction(factionId);
      ui.notifications.info(game.i18n.format("BOBSNPC.GMDashboard.FactionDeleted", { name: factionName }));
      this.render();
    }
  }

  /**
   * Configure NPC
   */
  static async #onConfigureNPC(event, target) {
    const npcId = target.dataset.npcId;
    const npc = game.actors.get(npcId);
    if (npc) {
      game.bobsnpc.ui.openNPCConfig(npc);
    }
  }

  /**
   * Set world state variable
   */
  static async #onSetWorldState(event, target) {
    const key = target.dataset.key || await this.#promptForKey();
    if (!key) return;

    const value = await this.#promptForValue(key);
    if (value !== null) {
      await game.bobsnpc.worldState.set(key, value);
      this.render();
    }
  }

  /**
   * Delete world state variable
   */
  static async #onDeleteWorldState(event, target) {
    const key = target.dataset.key;
    if (!key) return;

    const confirmed = await Dialog.confirm({
      title: game.i18n.localize("BOBSNPC.GMDashboard.DeleteWorldState"),
      content: game.i18n.format("BOBSNPC.GMDashboard.DeleteWorldStateConfirm", { key })
    });

    if (confirmed) {
      await game.bobsnpc.worldState.delete(key);
      this.render();
    }
  }

  /**
   * Trigger world event
   */
  static async #onTriggerEvent(event, target) {
    ui.notifications.info("Trigger event not yet implemented");
  }

  /**
   * End world event
   */
  static async #onEndEvent(event, target) {
    const eventId = target.dataset.eventId;
    await game.bobsnpc.events.end(eventId);
    this.render();
  }

  /**
   * Create data backup
   */
  static async #onCreateBackup(event, target) {
    try {
      const backup = await game.bobsnpc.backup.create();

      // Download backup as JSON file
      const dataStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bobsnpc-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      ui.notifications.info(game.i18n.localize("BOBSNPC.GMDashboard.BackupCreated"));
    } catch (error) {
      console.error(`${MODULE_ID} | Backup failed:`, error);
      ui.notifications.error(game.i18n.localize("BOBSNPC.GMDashboard.BackupFailed"));
    }
  }

  /**
   * Restore from backup
   */
  static async #onRestoreBackup(event, target) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        await game.bobsnpc.backup.restore(backup);
        ui.notifications.info(game.i18n.localize("BOBSNPC.GMDashboard.BackupRestored"));
        this.render();
      } catch (error) {
        console.error(`${MODULE_ID} | Restore failed:`, error);
        ui.notifications.error(game.i18n.localize("BOBSNPC.GMDashboard.RestoreFailed"));
      }
    };
    input.click();
  }

  /**
   * Export module data
   */
  static async #onExportData(event, target) {
    const type = target.dataset.exportType || "world";
    try {
      const data = await game.bobsnpc.export(type);

      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bobsnpc-export-${type}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      ui.notifications.info(game.i18n.localize("BOBSNPC.GMDashboard.ExportComplete"));
    } catch (error) {
      console.error(`${MODULE_ID} | Export failed:`, error);
      ui.notifications.error(game.i18n.localize("BOBSNPC.GMDashboard.ExportFailed"));
    }
  }

  /**
   * Import module data
   */
  static async #onImportData(event, target) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const results = await game.bobsnpc.import(data);

        ui.notifications.info(game.i18n.format("BOBSNPC.GMDashboard.ImportComplete", {
          success: results.success.length,
          skipped: results.skipped.length,
          errors: results.errors.length
        }));
        this.render();
      } catch (error) {
        console.error(`${MODULE_ID} | Import failed:`, error);
        ui.notifications.error(game.i18n.localize("BOBSNPC.GMDashboard.ImportFailed"));
      }
    };
    input.click();
  }

  /**
   * Refresh dashboard data
   */
  static #onRefreshData(event, target) {
    this.#cachedData = null;
    this.render();
  }

  /* ===== Helper Methods ===== */

  /**
   * Prompt for a key name
   * @returns {Promise<string|null>}
   */
  async #promptForKey() {
    return new Promise((resolve) => {
      new Dialog({
        title: game.i18n.localize("BOBSNPC.GMDashboard.EnterKey"),
        content: `<input type="text" name="key" placeholder="variable_name" style="width: 100%"/>`,
        buttons: {
          ok: {
            label: game.i18n.localize("BOBSNPC.Common.OK"),
            callback: (html) => resolve(html.find('[name="key"]').val())
          },
          cancel: {
            label: game.i18n.localize("BOBSNPC.Common.Cancel"),
            callback: () => resolve(null)
          }
        },
        default: "ok"
      }).render(true);
    });
  }

  /**
   * Prompt for a value
   * @param {string} key
   * @returns {Promise<*>}
   */
  async #promptForValue(key) {
    return new Promise((resolve) => {
      new Dialog({
        title: game.i18n.format("BOBSNPC.GMDashboard.EnterValue", { key }),
        content: `<input type="text" name="value" placeholder="value" style="width: 100%"/>`,
        buttons: {
          ok: {
            label: game.i18n.localize("BOBSNPC.Common.OK"),
            callback: (html) => {
              const val = html.find('[name="value"]').val();
              // Try to parse as JSON, otherwise keep as string
              try {
                resolve(JSON.parse(val));
              } catch {
                resolve(val);
              }
            }
          },
          cancel: {
            label: game.i18n.localize("BOBSNPC.Common.Cancel"),
            callback: () => resolve(null)
          }
        },
        default: "ok"
      }).render(true);
    });
  }
}
