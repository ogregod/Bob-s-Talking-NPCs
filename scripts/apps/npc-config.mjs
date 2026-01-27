/**
 * Bob's Talking NPCs - NPC Configuration Window
 * GM tool for configuring NPC settings using Foundry V13 ApplicationV2
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";
import { NPCRole, IndicatorType } from "../data/npc-model.mjs";

/** Get NPC handler instance from API */
function getNpcHandler() {
  return game.bobsnpc?.handlers?.npc;
}

/** Get dialogue handler instance from API */
function getDialogueHandler() {
  return game.bobsnpc?.handlers?.dialogue;
}

/** Get faction handler instance from API */
function getFactionHandler() {
  return game.bobsnpc?.handlers?.faction;
}

/** Get quest handler instance from API */
function getQuestHandler() {
  return game.bobsnpc?.handlers?.quest;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * NPC Configuration Application
 * Comprehensive GM tool for setting up NPC behaviors, services, and dialogues
 */
export class NPCConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {Actor} npc - The NPC actor to configure
   * @param {object} options - Application options
   */
  constructor(npc, options = {}) {
    super(options);

    this.npc = npc;
    this._activeTab = options.tab || "general";
    this._unsavedChanges = false;

    // Working copy of NPC config
    // Get existing config from actor flags, or use default
    const existingConfig = npc?.getFlag?.(MODULE_ID, "config") || null;
    this._config = foundry.utils.deepClone(existingConfig || this._getDefaultConfig());
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-npc-config",
    classes: ["bobsnpc", "npc-config"],
    tag: "form",
    form: {
      handler: NPCConfig.#onFormSubmit,
      closeOnSubmit: false,
      submitOnChange: true
    },
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.NPCConfig.Title",
      icon: "fa-solid fa-user-gear",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 700,
      height: 650
    },
    actions: {
      changeTab: NPCConfig.#onChangeTab,
      addRole: NPCConfig.#onAddRole,
      removeRole: NPCConfig.#onRemoveRole,
      addScheduleEntry: NPCConfig.#onAddScheduleEntry,
      removeScheduleEntry: NPCConfig.#onRemoveScheduleEntry,
      addDialogue: NPCConfig.#onAddDialogue,
      removeDialogue: NPCConfig.#onRemoveDialogue,
      editDialogue: NPCConfig.#onEditDialogue,
      addFaction: NPCConfig.#onAddFaction,
      removeFaction: NPCConfig.#onRemoveFaction,
      addServiceItem: NPCConfig.#onAddServiceItem,
      removeServiceItem: NPCConfig.#onRemoveServiceItem,
      testIndicator: NPCConfig.#onTestIndicator,
      saveConfig: NPCConfig.#onSaveConfig,
      resetConfig: NPCConfig.#onResetConfig,
      importConfig: NPCConfig.#onImportConfig,
      exportConfig: NPCConfig.#onExportConfig
    }
  };

  /** @override */
  static PARTS = {
    tabs: {
      template: `modules/${MODULE_ID}/templates/npc-config/tabs.hbs`
    },
    general: {
      template: `modules/${MODULE_ID}/templates/npc-config/general.hbs`,
      scrollable: [".tab-content"]
    },
    roles: {
      template: `modules/${MODULE_ID}/templates/npc-config/roles.hbs`,
      scrollable: [".tab-content"]
    },
    dialogue: {
      template: `modules/${MODULE_ID}/templates/npc-config/dialogue.hbs`,
      scrollable: [".tab-content"]
    },
    schedule: {
      template: `modules/${MODULE_ID}/templates/npc-config/schedule.hbs`,
      scrollable: [".tab-content"]
    },
    services: {
      template: `modules/${MODULE_ID}/templates/npc-config/services.hbs`,
      scrollable: [".tab-content"]
    },
    factions: {
      template: `modules/${MODULE_ID}/templates/npc-config/factions.hbs`,
      scrollable: [".tab-content"]
    },
    appearance: {
      template: `modules/${MODULE_ID}/templates/npc-config/appearance.hbs`,
      scrollable: [".tab-content"]
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/npc-config/footer.hbs`
    }
  };

  /** @override */
  get title() {
    return `${localize("NPCConfig.Title")}: ${this.npc.name}`;
  }

  /**
   * Get default NPC configuration
   * @returns {object}
   * @private
   */
  _getDefaultConfig() {
    return {
      enabled: true,
      roles: [],
      primaryRole: null,
      dialogues: [],
      defaultDialogue: null,
      schedule: {
        enabled: false,
        entries: []
      },
      factions: [],
      services: {
        merchant: { enabled: false, shopId: null, markup: 1.0 },
        questGiver: { enabled: false, questIds: [] },
        banker: { enabled: false, bankId: null },
        trainer: { enabled: false, skills: [], maxLevel: 5 },
        innkeeper: { enabled: false, roomPrice: 5, services: [] },
        stablemaster: { enabled: false, services: [] },
        blacksmith: { enabled: false, services: [] },
        fence: { enabled: false, markup: 0.5 }
      },
      appearance: {
        portrait: null,
        indicator: IndicatorType.NONE,
        customIndicator: null,
        nameDisplay: "always",
        titleDisplay: true
      },
      behavior: {
        interactionRange: 1,
        greetOnApproach: false,
        greetingDialogue: null,
        requireLineOfSight: true,
        cooldownBetweenInteractions: 0
      },
      metadata: {
        notes: "",
        tags: [],
        lastModified: null,
        modifiedBy: null
      }
    };
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Get available data for dropdowns
    const allDialogues = getDialogueHandler()?.getAllDialogues() || [];
    const allFactions = getFactionHandler()?.getAllFactions() || [];
    const allQuests = getQuestHandler()?.getAllQuests() || [];
    const allShops = await this._getAvailableShops();
    const allBanks = await this._getAvailableBanks();

    // Get assigned quest IDs for filtering
    const assignedQuestIds = this._config.services?.questGiver?.quests || [];

    return {
      ...context,
      npc: this.npc,
      npcId: this.npc.id,
      npcUuid: this.npc.uuid,
      config: this._config,
      activeTab: this._activeTab,
      unsavedChanges: this._unsavedChanges,

      // Tab definitions
      tabs: this._prepareTabs(),

      // Dropdown options
      availableRoles: this._prepareRoleOptions(),
      availableDialogues: allDialogues.map(d => ({ id: d.id, name: d.name })),
      availableFactions: allFactions.map(f => ({ id: f.id, name: f.name })),
      availableQuests: allQuests
        .filter(q => !assignedQuestIds.includes(q.id))
        .map(q => ({
          id: q.id,
          name: q.name,
          category: q.category,
          categoryLabel: this._getCategoryLabel(q.category),
          status: q.status
        })),
      availableShops: allShops,
      availableBanks: allBanks,
      availableIndicators: this._prepareIndicatorOptions(),
      availableNameDisplays: this._prepareNameDisplayOptions(),

      // Processed config data for display
      rolesDisplay: this._prepareRolesDisplay(),
      dialoguesDisplay: this._prepareDialoguesDisplay(allDialogues),
      scheduleDisplay: this._prepareScheduleDisplay(),
      factionsDisplay: this._prepareFactionsDisplay(allFactions),
      servicesDisplay: this._prepareServicesDisplay(allQuests),

      // System info
      isGM: game.user.isGM,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /**
   * Get category display label
   * @param {string} category
   * @returns {string}
   * @private
   */
  _getCategoryLabel(category) {
    const labels = {
      main_story: localize("QuestEditor.Category.MainStory"),
      side_quest: localize("QuestEditor.Category.SideQuest"),
      bounty: localize("QuestEditor.Category.Bounty"),
      daily: localize("QuestEditor.Category.Daily"),
      guild_contract: localize("QuestEditor.Category.GuildContract"),
      custom: localize("QuestEditor.Category.Custom")
    };
    return labels[category] || category;
  }

  /**
   * Get status display label
   * @param {string} status
   * @returns {string}
   * @private
   */
  _getStatusLabel(status) {
    const labels = {
      available: localize("QuestEditor.Status.Available"),
      accepted: localize("QuestEditor.Status.Accepted"),
      in_progress: localize("QuestEditor.Status.InProgress"),
      completed: localize("QuestEditor.Status.Completed"),
      failed: localize("QuestEditor.Status.Failed")
    };
    return labels[status] || status;
  }

  /**
   * Prepare tab definitions
   * @returns {object[]}
   * @private
   */
  _prepareTabs() {
    const tabs = [
      { id: "general", label: localize("NPCConfig.Tabs.General"), icon: "fa-info-circle" },
      { id: "roles", label: localize("NPCConfig.Tabs.Roles"), icon: "fa-user-tag" },
      { id: "dialogue", label: localize("NPCConfig.Tabs.Dialogue"), icon: "fa-comments" },
      { id: "schedule", label: localize("NPCConfig.Tabs.Schedule"), icon: "fa-clock" },
      { id: "services", label: localize("NPCConfig.Tabs.Services"), icon: "fa-concierge-bell" },
      { id: "factions", label: localize("NPCConfig.Tabs.Factions"), icon: "fa-flag" },
      { id: "appearance", label: localize("NPCConfig.Tabs.Appearance"), icon: "fa-palette" }
    ];

    return tabs.map(tab => ({
      ...tab,
      active: tab.id === this._activeTab,
      cssClass: tab.id === this._activeTab ? "active" : ""
    }));
  }

  /**
   * Prepare role options for dropdown
   * @returns {object[]}
   * @private
   */
  _prepareRoleOptions() {
    return Object.values(NPCRole).map(role => ({
      value: role,
      label: localize(`NPCRole.${role}`),
      selected: this._config.roles.includes(role)
    }));
  }

  /**
   * Prepare indicator options
   * @returns {object[]}
   * @private
   */
  _prepareIndicatorOptions() {
    return Object.values(IndicatorType).map(type => ({
      value: type,
      label: localize(`IndicatorType.${type}`),
      selected: this._config.appearance.indicator === type
    }));
  }

  /**
   * Prepare name display options
   * @returns {object[]}
   * @private
   */
  _prepareNameDisplayOptions() {
    const options = ["always", "hover", "never", "known"];
    return options.map(opt => ({
      value: opt,
      label: localize(`NameDisplay.${opt}`),
      selected: this._config.appearance.nameDisplay === opt
    }));
  }

  /**
   * Prepare roles for display
   * @returns {object[]}
   * @private
   */
  _prepareRolesDisplay() {
    return this._config.roles.map((role, index) => ({
      role,
      label: localize(`NPCRole.${role}`),
      icon: this._getRoleIcon(role),
      isPrimary: role === this._config.primaryRole,
      index
    }));
  }

  /**
   * Get icon for role
   * @param {string} role - Role type
   * @returns {string}
   * @private
   */
  _getRoleIcon(role) {
    const icons = {
      [NPCRole.QUEST_GIVER]: "fa-scroll",
      [NPCRole.MERCHANT]: "fa-store",
      [NPCRole.BANKER]: "fa-landmark",
      [NPCRole.TRAINER]: "fa-graduation-cap",
      [NPCRole.INNKEEPER]: "fa-bed",
      [NPCRole.STABLEMASTER]: "fa-horse",
      [NPCRole.BLACKSMITH]: "fa-hammer",
      [NPCRole.GUARD]: "fa-shield-alt",
      [NPCRole.COMMONER]: "fa-user",
      [NPCRole.NOBLE]: "fa-crown",
      [NPCRole.FENCE]: "fa-mask",
      [NPCRole.INFORMANT]: "fa-ear-listen",
      [NPCRole.HIRELING]: "fa-person-military-pointing"
    };
    return icons[role] || "fa-user";
  }

  /**
   * Prepare dialogues for display
   * @param {object[]} allDialogues - All available dialogues
   * @returns {object[]}
   * @private
   */
  _prepareDialoguesDisplay(allDialogues) {
    return this._config.dialogues.map((dialogueId, index) => {
      const dialogue = allDialogues.find(d => d.id === dialogueId);
      return {
        id: dialogueId,
        name: dialogue?.name || dialogueId,
        description: dialogue?.description || "",
        isDefault: dialogueId === this._config.defaultDialogue,
        index
      };
    });
  }

  /**
   * Prepare schedule for display
   * @returns {object}
   * @private
   */
  _prepareScheduleDisplay() {
    const schedule = this._config.schedule;
    return {
      enabled: schedule.enabled,
      entries: schedule.entries.map((entry, index) => ({
        ...entry,
        index,
        timeDisplay: this._formatTimeRange(entry.startTime, entry.endTime),
        daysDisplay: this._formatDays(entry.days),
        locationName: entry.locationName || entry.sceneId || localize("NPCConfig.UnknownLocation")
      }))
    };
  }

  /**
   * Format time range for display
   * @param {number} start - Start hour (0-23)
   * @param {number} end - End hour (0-23)
   * @returns {string}
   * @private
   */
  _formatTimeRange(start, end) {
    const formatHour = (h) => {
      const period = h >= 12 ? "PM" : "AM";
      const hour = h % 12 || 12;
      return `${hour}:00 ${period}`;
    };
    return `${formatHour(start)} - ${formatHour(end)}`;
  }

  /**
   * Format days for display
   * @param {string[]} days - Array of day names
   * @returns {string}
   * @private
   */
  _formatDays(days) {
    if (!days || days.length === 0) return localize("NPCConfig.EveryDay");
    if (days.length === 7) return localize("NPCConfig.EveryDay");
    return days.map(d => localize(`Day.${d}`)).join(", ");
  }

  /**
   * Prepare factions for display
   * @param {object[]} allFactions - All available factions
   * @returns {object[]}
   * @private
   */
  _prepareFactionsDisplay(allFactions) {
    return this._config.factions.map((factionEntry, index) => {
      const faction = allFactions.find(f => f.id === factionEntry.factionId);
      return {
        ...factionEntry,
        name: faction?.name || factionEntry.factionId,
        icon: faction?.icon || "fa-flag",
        color: faction?.color || "#666666",
        index
      };
    });
  }

  /**
   * Prepare services for display
   * @param {object[]} allQuests - All available quests
   * @returns {object}
   * @private
   */
  _prepareServicesDisplay(allQuests = []) {
    const services = this._config.services;

    // Get assigned quest IDs (support both 'quests' and 'questIds' for backwards compatibility)
    const assignedQuestIds = services.questGiver?.quests || services.questGiver?.questIds || [];

    return {
      merchant: {
        ...services.merchant,
        hasRole: this._config.roles.includes(NPCRole.MERCHANT)
      },
      questGiver: {
        ...services.questGiver,
        hasRole: this._config.roles.includes(NPCRole.QUEST_GIVER),
        assignedQuests: assignedQuestIds.map((questId, index) => {
          const quest = allQuests.find(q => q.id === questId);
          return {
            id: questId,
            name: quest?.name || questId,
            status: quest?.status || "unknown",
            statusLabel: this._getStatusLabel(quest?.status || "unknown"),
            index
          };
        })
      },
      banker: {
        ...services.banker,
        hasRole: this._config.roles.includes(NPCRole.BANKER)
      },
      trainer: {
        ...services.trainer,
        hasRole: this._config.roles.includes(NPCRole.TRAINER),
        skillsDisplay: (services.trainer.skills || []).join(", ")
      },
      innkeeper: {
        ...services.innkeeper,
        hasRole: this._config.roles.includes(NPCRole.INNKEEPER)
      },
      stablemaster: {
        ...services.stablemaster,
        hasRole: this._config.roles.includes(NPCRole.STABLEMASTER)
      },
      blacksmith: {
        ...services.blacksmith,
        hasRole: this._config.roles.includes(NPCRole.BLACKSMITH)
      },
      fence: {
        ...services.fence,
        hasRole: this._config.roles.includes(NPCRole.FENCE)
      }
    };
  }

  /**
   * Get available shops
   * @returns {Promise<object[]>}
   * @private
   */
  async _getAvailableShops() {
    // Get shops from journal entries or other storage
    const shops = [];
    const journalEntries = game.journal.filter(j =>
      j.getFlag(MODULE_ID, "shopData")
    );

    for (const journal of journalEntries) {
      const shopData = journal.getFlag(MODULE_ID, "shopData");
      if (shopData) {
        shops.push({
          id: journal.id,
          name: journal.name
        });
      }
    }

    return shops;
  }

  /**
   * Get available banks
   * @returns {Promise<object[]>}
   * @private
   */
  async _getAvailableBanks() {
    // Get banks from journal entries or other storage
    const banks = [];
    const journalEntries = game.journal.filter(j =>
      j.getFlag(MODULE_ID, "bankData")
    );

    for (const journal of journalEntries) {
      const bankData = journal.getFlag(MODULE_ID, "bankData");
      if (bankData) {
        banks.push({
          id: journal.id,
          name: journal.name
        });
      }
    }

    return banks;
  }

  // ==================== Form Handling ====================

  /** @override */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    this._unsavedChanges = true;
  }

  static async #onFormSubmit(event, form, formData) {
    // Merge form data into config
    const data = foundry.utils.expandObject(formData.object);

    // Update config with form values
    if (data.config) {
      foundry.utils.mergeObject(this._config, data.config);
    }

    this._unsavedChanges = true;
  }

  // ==================== Actions ====================

  static #onChangeTab(event, target) {
    this._activeTab = target.dataset.tab;
    this.render();
  }

  static #onAddRole(event, target) {
    const select = this.element.querySelector('select[name="newRole"]');
    const role = select?.value;

    if (role && !this._config.roles.includes(role)) {
      this._config.roles.push(role);
      if (!this._config.primaryRole) {
        this._config.primaryRole = role;
      }
      this._unsavedChanges = true;
      this.render();
    }
  }

  static #onRemoveRole(event, target) {
    const index = parseInt(target.dataset.index);
    const role = this._config.roles[index];

    this._config.roles.splice(index, 1);

    if (this._config.primaryRole === role) {
      this._config.primaryRole = this._config.roles[0] || null;
    }

    this._unsavedChanges = true;
    this.render();
  }

  static #onAddScheduleEntry(event, target) {
    this._config.schedule.entries.push({
      startTime: 9,
      endTime: 17,
      days: [],
      sceneId: null,
      locationName: "",
      position: { x: 0, y: 0 },
      activity: "working"
    });

    this._unsavedChanges = true;
    this.render();
  }

  static #onRemoveScheduleEntry(event, target) {
    const index = parseInt(target.dataset.index);
    this._config.schedule.entries.splice(index, 1);
    this._unsavedChanges = true;
    this.render();
  }

  static #onAddDialogue(event, target) {
    const select = this.element.querySelector('select[name="newDialogue"]');
    const dialogueId = select?.value;

    if (dialogueId && !this._config.dialogues.includes(dialogueId)) {
      this._config.dialogues.push(dialogueId);
      if (!this._config.defaultDialogue) {
        this._config.defaultDialogue = dialogueId;
      }
      this._unsavedChanges = true;
      this.render();
    }
  }

  static #onRemoveDialogue(event, target) {
    const index = parseInt(target.dataset.index);
    const dialogueId = this._config.dialogues[index];

    this._config.dialogues.splice(index, 1);

    if (this._config.defaultDialogue === dialogueId) {
      this._config.defaultDialogue = this._config.dialogues[0] || null;
    }

    this._unsavedChanges = true;
    this.render();
  }

  static async #onEditDialogue(event, target) {
    const dialogueId = target.dataset.dialogueId;

    // Dynamically import and open dialogue editor
    const { DialogueEditor } = await import("./dialogue-editor.mjs");
    const dialogue = getDialogueHandler()?.getDialogue(dialogueId);
    DialogueEditor.open(dialogue || dialogueId);
  }

  static #onAddFaction(event, target) {
    const select = this.element.querySelector('select[name="newFaction"]');
    const factionId = select?.value;

    if (factionId && !this._config.factions.find(f => f.factionId === factionId)) {
      this._config.factions.push({
        factionId,
        rank: null,
        role: "member"
      });
      this._unsavedChanges = true;
      this.render();
    }
  }

  static #onRemoveFaction(event, target) {
    const index = parseInt(target.dataset.index);
    this._config.factions.splice(index, 1);
    this._unsavedChanges = true;
    this.render();
  }

  static #onAddServiceItem(event, target) {
    const service = target.dataset.service;
    const itemType = target.dataset.itemType;

    if (service === "questGiver" && itemType === "quest") {
      const select = this.element.querySelector('select.quest-select[data-service="questGiver"]');
      const questId = select?.value;

      if (!questId) {
        ui.notifications.warn(localize("NPCConfig.SelectQuestFirst"));
        return;
      }

      // Initialize the quests array if needed
      if (!this._config.services.questGiver.quests) {
        this._config.services.questGiver.quests = [];
      }

      // Add the quest ID if not already present
      if (!this._config.services.questGiver.quests.includes(questId)) {
        this._config.services.questGiver.quests.push(questId);
        this._unsavedChanges = true;
        this.render();
      }
    }
  }

  static #onRemoveServiceItem(event, target) {
    const service = target.dataset.service;
    const index = parseInt(target.dataset.index);

    if (service === "questGiver") {
      if (!this._config.services.questGiver.quests) return;

      this._config.services.questGiver.quests.splice(index, 1);
      this._unsavedChanges = true;
      this.render();
    }
  }

  static async #onTestIndicator(event, target) {
    const indicator = this._config.appearance.indicator;

    // Show indicator on token
    const token = this.npc.getActiveTokens()[0];
    if (token) {
      await getNpcHandler().showIndicator(token, indicator);
      ui.notifications.info(localize("NPCConfig.IndicatorTestShown"));
    } else {
      ui.notifications.warn(localize("NPCConfig.NoActiveToken"));
    }
  }

  static async #onSaveConfig(event, target) {
    try {
      // Update metadata
      this._config.metadata.lastModified = Date.now();
      this._config.metadata.modifiedBy = game.user.id;

      // Save to NPC
      await getNpcHandler().configureNPC(this.npc, this._config);

      this._unsavedChanges = false;
      ui.notifications.info(localize("NPCConfig.Saved"));
      this.render();
    } catch (error) {
      console.error(`${MODULE_ID} | Error saving NPC config:`, error);
      ui.notifications.error(localize("NPCConfig.SaveError"));
    }
  }

  static async #onResetConfig(event, target) {
    const confirmed = await Dialog.confirm({
      title: localize("NPCConfig.ResetConfirmTitle"),
      content: localize("NPCConfig.ResetConfirmContent")
    });

    if (confirmed) {
      this._config = this._getDefaultConfig();
      this._unsavedChanges = true;
      this.render();
    }
  }

  static async #onImportConfig(event, target) {
    // Create file input
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text);

        // Validate structure
        if (!imported.roles || !imported.appearance) {
          throw new Error("Invalid NPC config format");
        }

        this._config = foundry.utils.mergeObject(
          this._getDefaultConfig(),
          imported
        );
        this._unsavedChanges = true;
        this.render();

        ui.notifications.info(localize("NPCConfig.ImportSuccess"));
      } catch (error) {
        console.error(`${MODULE_ID} | Error importing config:`, error);
        ui.notifications.error(localize("NPCConfig.ImportError"));
      }
    };

    input.click();
  }

  static #onExportConfig(event, target) {
    const data = JSON.stringify(this._config, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `npc-config-${this.npc.name.slugify()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    ui.notifications.info(localize("NPCConfig.ExportSuccess"));
  }

  // ==================== Lifecycle ====================

  /** @override */
  async _onClose(options) {
    if (this._unsavedChanges) {
      const save = await Dialog.confirm({
        title: localize("NPCConfig.UnsavedChangesTitle"),
        content: localize("NPCConfig.UnsavedChangesContent")
      });

      if (save) {
        await NPCConfig.#onSaveConfig.call(this);
      }
    }

    await super._onClose(options);
  }

  // ==================== Static Factory ====================

  /**
   * Open NPC configuration window
   * @param {Actor|string} npc - NPC actor or UUID
   * @param {object} options - Additional options
   * @returns {Promise<NPCConfig>}
   */
  static async open(npc, options = {}) {
    // Resolve actor from UUID if needed
    if (typeof npc === "string") {
      npc = await fromUuid(npc);
    }

    if (!npc) {
      ui.notifications.error(localize("NPCConfig.NPCNotFound"));
      return null;
    }

    // Check permissions
    if (!game.user.isGM && !npc.isOwner) {
      ui.notifications.error(localize("NPCConfig.NoPermission"));
      return null;
    }

    const config = new NPCConfig(npc, options);
    await config.render(true);
    return config;
  }

  /**
   * Quick configure - opens config for selected token
   * @returns {Promise<NPCConfig|null>}
   */
  static async quickConfigure() {
    const token = canvas.tokens.controlled[0];
    if (!token?.actor) {
      ui.notifications.warn(localize("NPCConfig.SelectToken"));
      return null;
    }

    return NPCConfig.open(token.actor);
  }
}
