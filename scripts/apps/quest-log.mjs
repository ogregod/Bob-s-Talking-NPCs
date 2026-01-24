/**
 * Bob's Talking NPCs - Quest Log
 * Player quest management interface using Foundry V13 ApplicationV2
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";
import { QuestStatus, ObjectiveType } from "../data/quest-model.mjs";

/**
 * Get quest handler instance from API
 * @returns {object}
 */
function getQuestHandler() {
  return game.bobsnpc?.handlers?.quest;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Quest Log Application
 * Displays all quests for a player with filtering and tracking
 */
export class QuestLog extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options - Application options
   * @param {string} options.actorUuid - Player actor UUID
   */
  constructor(options = {}) {
    super(options);

    this.actorUuid = options.actorUuid || null;
    this._filter = "active"; // active, completed, failed, all
    this._sortBy = "recent"; // recent, name, progress
    this._searchQuery = "";
    this._expandedQuests = new Set();
    this._selectedQuestId = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-quest-log",
    classes: ["bobsnpc", "quest-log"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.QuestLog.Title",
      icon: "fa-solid fa-book-open",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 700,
      height: 600
    },
    actions: {
      setFilter: QuestLog.#onSetFilter,
      setSort: QuestLog.#onSetSort,
      search: QuestLog.#onSearch,
      toggleQuest: QuestLog.#onToggleQuest,
      selectQuest: QuestLog.#onSelectQuest,
      trackQuest: QuestLog.#onTrackQuest,
      abandonQuest: QuestLog.#onAbandonQuest,
      shareQuest: QuestLog.#onShareQuest,
      showOnMap: QuestLog.#onShowOnMap
    }
  };

  /** @override */
  static PARTS = {
    sidebar: {
      template: `modules/${MODULE_ID}/templates/quest-log/sidebar.hbs`
    },
    details: {
      template: `modules/${MODULE_ID}/templates/quest-log/details.hbs`,
      scrollable: [".quest-details-content"]
    }
  };

  /** @override */
  get title() {
    return localize("QuestLog.Title");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Get all quests for this actor
    const allQuests = await this._getPlayerQuests();
    const filteredQuests = this._applyFilters(allQuests);
    const sortedQuests = this._applySorting(filteredQuests);

    // Get selected quest details
    let selectedQuest = null;
    if (this._selectedQuestId) {
      selectedQuest = allQuests.find(q => q.id === this._selectedQuestId);
      if (!selectedQuest && sortedQuests.length > 0) {
        selectedQuest = sortedQuests[0];
        this._selectedQuestId = selectedQuest.id;
      }
    } else if (sortedQuests.length > 0) {
      selectedQuest = sortedQuests[0];
      this._selectedQuestId = selectedQuest.id;
    }

    // Count quests by status
    const counts = {
      active: allQuests.filter(q => q.status === QuestStatus.ACTIVE).length,
      completed: allQuests.filter(q => q.status === QuestStatus.COMPLETED).length,
      failed: allQuests.filter(q => q.status === QuestStatus.FAILED).length,
      all: allQuests.length
    };

    // Get tracked quest
    const trackedQuestId = await this._getTrackedQuestId();

    return {
      ...context,
      actorUuid: this.actorUuid,
      filter: this._filter,
      sortBy: this._sortBy,
      searchQuery: this._searchQuery,
      counts,
      quests: sortedQuests.map(q => this._prepareQuestForDisplay(q, trackedQuestId)),
      selectedQuest: selectedQuest ? this._prepareQuestDetails(selectedQuest, trackedQuestId) : null,
      hasQuests: sortedQuests.length > 0,
      isEmpty: allQuests.length === 0,
      isGM: game.user.isGM,
      settings: {
        allowAbandonment: game.settings.get(MODULE_ID, "allowQuestAbandonment"),
        showLockedQuests: game.settings.get(MODULE_ID, "showLockedQuests"),
        questMarkers: game.settings.get(MODULE_ID, "questMarkers")
      }
    };
  }

  /**
   * Get quests for the player
   * @returns {object[]}
   * @private
   */
  async _getPlayerQuests() {
    if (!this.actorUuid) {
      // Get quests for all party members if no specific actor
      return getQuestHandler().getPartyQuests();
    }
    return getQuestHandler().getPlayerQuests(this.actorUuid);
  }

  /**
   * Apply filters to quest list
   * @param {object[]} quests - All quests
   * @returns {object[]}
   * @private
   */
  _applyFilters(quests) {
    let filtered = quests;

    // Status filter
    switch (this._filter) {
      case "active":
        filtered = filtered.filter(q =>
          q.status === QuestStatus.ACTIVE ||
          q.status === QuestStatus.IN_PROGRESS
        );
        break;
      case "completed":
        filtered = filtered.filter(q => q.status === QuestStatus.COMPLETED);
        break;
      case "failed":
        filtered = filtered.filter(q =>
          q.status === QuestStatus.FAILED ||
          q.status === QuestStatus.ABANDONED
        );
        break;
      // "all" shows everything
    }

    // Search filter
    if (this._searchQuery) {
      const query = this._searchQuery.toLowerCase();
      filtered = filtered.filter(q =>
        q.name.toLowerCase().includes(query) ||
        q.description?.toLowerCase().includes(query) ||
        q.giver?.name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  /**
   * Apply sorting to quest list
   * @param {object[]} quests - Filtered quests
   * @returns {object[]}
   * @private
   */
  _applySorting(quests) {
    const sorted = [...quests];

    switch (this._sortBy) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "progress":
        sorted.sort((a, b) => {
          const progressA = this._calculateProgress(a);
          const progressB = this._calculateProgress(b);
          return progressB - progressA;
        });
        break;
      case "recent":
      default:
        sorted.sort((a, b) => (b.updatedAt || b.acceptedAt || 0) - (a.updatedAt || a.acceptedAt || 0));
        break;
    }

    return sorted;
  }

  /**
   * Calculate quest progress percentage
   * @param {object} quest - Quest data
   * @returns {number}
   * @private
   */
  _calculateProgress(quest) {
    if (!quest.objectives?.length) return 0;

    const completed = quest.objectives.filter(o => o.completed).length;
    return Math.round((completed / quest.objectives.length) * 100);
  }

  /**
   * Prepare quest for sidebar display
   * @param {object} quest - Quest data
   * @param {string} trackedQuestId - Currently tracked quest ID
   * @returns {object}
   * @private
   */
  _prepareQuestForDisplay(quest, trackedQuestId) {
    const progress = this._calculateProgress(quest);

    return {
      id: quest.id,
      name: quest.name,
      status: quest.status,
      statusLabel: localize(`QuestStatus.${quest.status}`),
      statusIcon: this._getStatusIcon(quest.status),
      statusClass: `status-${quest.status}`,
      progress,
      progressLabel: `${progress}%`,
      isTracked: quest.id === trackedQuestId,
      isSelected: quest.id === this._selectedQuestId,
      isExpanded: this._expandedQuests.has(quest.id),
      type: quest.type,
      typeLabel: localize(`QuestType.${quest.type}`),
      typeIcon: this._getTypeIcon(quest.type),
      giver: quest.giver?.name,
      hasTimeLimit: !!quest.timeLimit?.enabled
    };
  }

  /**
   * Prepare quest details for display
   * @param {object} quest - Quest data
   * @param {string} trackedQuestId - Currently tracked quest ID
   * @returns {object}
   * @private
   */
  _prepareQuestDetails(quest, trackedQuestId) {
    return {
      ...quest,
      statusLabel: localize(`QuestStatus.${quest.status}`),
      statusIcon: this._getStatusIcon(quest.status),
      statusClass: `status-${quest.status}`,
      typeLabel: localize(`QuestType.${quest.type}`),
      typeIcon: this._getTypeIcon(quest.type),
      progress: this._calculateProgress(quest),
      isTracked: quest.id === trackedQuestId,
      canAbandon: quest.status === QuestStatus.ACTIVE && game.settings.get(MODULE_ID, "allowQuestAbandonment"),
      objectives: (quest.objectives || []).map(o => this._prepareObjective(o)),
      rewards: this._prepareRewards(quest.rewards),
      hasBranches: quest.branches?.length > 0,
      branches: (quest.branches || []).map(b => ({
        ...b,
        isChosen: quest.chosenBranch === b.id
      })),
      timeLimit: quest.timeLimit?.enabled ? this._prepareTimeLimit(quest.timeLimit) : null,
      acceptedDate: quest.acceptedAt ? new Date(quest.acceptedAt).toLocaleDateString() : null,
      completedDate: quest.completedAt ? new Date(quest.completedAt).toLocaleDateString() : null
    };
  }

  /**
   * Prepare objective for display
   * @param {object} objective - Objective data
   * @returns {object}
   * @private
   */
  _prepareObjective(objective) {
    let progressText = "";

    switch (objective.type) {
      case ObjectiveType.COLLECT:
      case ObjectiveType.KILL:
        progressText = `${objective.current || 0}/${objective.target}`;
        break;
      case ObjectiveType.DISCOVER:
      case ObjectiveType.TALK_TO:
      case ObjectiveType.INTERACT:
        progressText = objective.completed ? localize("Complete") : localize("Incomplete");
        break;
      case ObjectiveType.CUSTOM:
        if (objective.target > 1) {
          progressText = `${objective.current || 0}/${objective.target}`;
        } else {
          progressText = objective.completed ? localize("Complete") : localize("Incomplete");
        }
        break;
    }

    return {
      ...objective,
      typeLabel: localize(`ObjectiveType.${objective.type}`),
      typeIcon: this._getObjectiveIcon(objective.type),
      progressText,
      progressPercent: objective.target > 0 ?
        Math.round(((objective.current || 0) / objective.target) * 100) : 0,
      isOptional: objective.optional,
      isHidden: objective.hidden && !objective.revealed,
      isSecret: objective.secret && !game.user.isGM
    };
  }

  /**
   * Prepare rewards for display
   * @param {object} rewards - Rewards data
   * @returns {object}
   * @private
   */
  _prepareRewards(rewards) {
    if (!rewards) return null;

    return {
      xp: rewards.xp > 0 ? rewards.xp : null,
      gold: rewards.gold > 0 ? rewards.gold : null,
      items: rewards.items?.length > 0 ? rewards.items : null,
      reputation: rewards.reputation?.length > 0 ? rewards.reputation.map(r => ({
        ...r,
        sign: r.amount >= 0 ? "+" : ""
      })) : null,
      custom: rewards.custom?.length > 0 ? rewards.custom : null,
      hasAny: rewards.xp > 0 || rewards.gold > 0 ||
        rewards.items?.length > 0 || rewards.reputation?.length > 0 ||
        rewards.custom?.length > 0
    };
  }

  /**
   * Prepare time limit for display
   * @param {object} timeLimit - Time limit data
   * @returns {object}
   * @private
   */
  _prepareTimeLimit(timeLimit) {
    if (!timeLimit.deadline) return null;

    const now = Date.now();
    const remaining = timeLimit.deadline - now;
    const isExpired = remaining <= 0;
    const isUrgent = remaining > 0 && remaining < 24 * 60 * 60 * 1000; // Less than 24 hours

    let remainingText;
    if (isExpired) {
      remainingText = localize("TimeLimit.Expired");
    } else {
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const days = Math.floor(hours / 24);
      if (days > 0) {
        remainingText = localize("TimeLimit.Days", { days });
      } else {
        remainingText = localize("TimeLimit.Hours", { hours });
      }
    }

    return {
      deadline: new Date(timeLimit.deadline).toLocaleString(),
      remaining: remainingText,
      isExpired,
      isUrgent
    };
  }

  /**
   * Get tracked quest ID
   * @returns {string|null}
   * @private
   */
  async _getTrackedQuestId() {
    if (!this.actorUuid) return null;
    const actor = await fromUuid(this.actorUuid);
    if (!actor) return null;
    return actor.getFlag(MODULE_ID, "trackedQuest") || null;
  }

  // ==================== Icon Helpers ====================

  _getStatusIcon(status) {
    const icons = {
      [QuestStatus.AVAILABLE]: "fa-circle",
      [QuestStatus.ACTIVE]: "fa-circle-play",
      [QuestStatus.IN_PROGRESS]: "fa-spinner",
      [QuestStatus.COMPLETED]: "fa-circle-check",
      [QuestStatus.FAILED]: "fa-circle-xmark",
      [QuestStatus.ABANDONED]: "fa-circle-minus"
    };
    return icons[status] || "fa-circle-question";
  }

  _getTypeIcon(type) {
    const icons = {
      main: "fa-crown",
      side: "fa-scroll",
      daily: "fa-calendar-day",
      repeatable: "fa-repeat",
      event: "fa-star",
      hidden: "fa-eye-slash"
    };
    return icons[type] || "fa-scroll";
  }

  _getObjectiveIcon(type) {
    const icons = {
      [ObjectiveType.COLLECT]: "fa-box",
      [ObjectiveType.KILL]: "fa-skull",
      [ObjectiveType.TALK_TO]: "fa-comments",
      [ObjectiveType.DISCOVER]: "fa-map-marker-alt",
      [ObjectiveType.ESCORT]: "fa-walking",
      [ObjectiveType.DEFEND]: "fa-shield-alt",
      [ObjectiveType.INTERACT]: "fa-hand-pointer",
      [ObjectiveType.CUSTOM]: "fa-tasks"
    };
    return icons[type] || "fa-tasks";
  }

  // ==================== Actions ====================

  static #onSetFilter(event, target) {
    this._filter = target.dataset.filter;
    this._selectedQuestId = null;
    this.render();
  }

  static #onSetSort(event, target) {
    this._sortBy = target.dataset.sort;
    this.render();
  }

  static #onSearch(event, target) {
    this._searchQuery = target.value;
    this.render();
  }

  static #onToggleQuest(event, target) {
    const questId = target.dataset.questId;
    if (this._expandedQuests.has(questId)) {
      this._expandedQuests.delete(questId);
    } else {
      this._expandedQuests.add(questId);
    }
    this.render();
  }

  static #onSelectQuest(event, target) {
    this._selectedQuestId = target.dataset.questId;
    this.render();
  }

  static async #onTrackQuest(event, target) {
    const questId = target.dataset.questId;

    if (!this.actorUuid) {
      ui.notifications.warn(localize("Errors.NoActorSelected"));
      return;
    }

    const actor = await fromUuid(this.actorUuid);
    if (!actor) return;

    const currentTracked = await actor.getFlag(MODULE_ID, "trackedQuest");
    if (currentTracked === questId) {
      // Untrack
      await actor.unsetFlag(MODULE_ID, "trackedQuest");
    } else {
      // Track
      await actor.setFlag(MODULE_ID, "trackedQuest", questId);
    }

    Hooks.callAll(`${MODULE_ID}.questTracked`, questId, this.actorUuid);
    this.render();
  }

  static async #onAbandonQuest(event, target) {
    const questId = target.dataset.questId;

    // Confirm abandonment
    const confirmed = await Dialog.confirm({
      title: localize("QuestLog.AbandonTitle"),
      content: `<p>${localize("QuestLog.AbandonConfirm")}</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });

    if (!confirmed) return;

    try {
      await getQuestHandler().abandonQuest(questId, this.actorUuid);
      ui.notifications.info(localize("QuestLog.QuestAbandoned"));
      this.render();
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onShareQuest(event, target) {
    const questId = target.dataset.questId;
    const quest = getQuestHandler().getQuest(questId);

    if (!quest) return;

    // Create chat message with quest details
    const content = await renderTemplate(
      `modules/${MODULE_ID}/templates/chat/quest-share.hbs`,
      { quest: this._prepareQuestDetails(quest, null) }
    );

    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor: await fromUuid(this.actorUuid) })
    });
  }

  static #onShowOnMap(event, target) {
    const questId = target.dataset.questId;
    const quest = getQuestHandler().getQuest(questId);

    if (!quest?.location?.sceneId) {
      ui.notifications.warn(localize("QuestLog.NoLocation"));
      return;
    }

    // Navigate to scene and ping location
    const scene = game.scenes.get(quest.location.sceneId);
    if (scene) {
      scene.view();
      if (quest.location.coordinates) {
        canvas.ping(quest.location.coordinates);
      }
    }
  }

  // ==================== Hooks ====================

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    // Register for quest updates
    this._hookId = Hooks.on(`${MODULE_ID}.questUpdated`, () => this.render());
  }

  /** @override */
  async _onClose(options) {
    await super._onClose(options);

    if (this._hookId) {
      Hooks.off(`${MODULE_ID}.questUpdated`, this._hookId);
    }
  }

  // ==================== Static Factory ====================

  /**
   * Open quest log for an actor
   * @param {string} actorUuid - Actor UUID (optional)
   * @returns {QuestLog}
   */
  static async open(actorUuid = null) {
    // If no actor specified, try to get the current user's character
    if (!actorUuid && game.user.character) {
      actorUuid = game.user.character.uuid;
    }

    const window = new QuestLog({ actorUuid });
    await window.render(true);
    return window;
  }
}
