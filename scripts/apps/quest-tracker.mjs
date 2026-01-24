/**
 * Bob's Talking NPCs - Quest Tracker
 * Minimal on-screen HUD showing current tracked quest objectives
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";

import { localize, getFlag } from "../utils/helpers.mjs";
import { QuestStatus, ObjectiveType } from "../data/quest-model.mjs";

/** Get quest handler instance from API */
function getQuestHandler() {
  return game.bobsnpc?.handlers?.quest;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Quest Tracker Application
 * Persistent on-screen widget showing tracked quest progress
 */
export class QuestTracker extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * Singleton instance
   * @type {QuestTracker|null}
   */
  static _instance = null;

  /**
   * @param {object} options - Application options
   */
  constructor(options = {}) {
    super(options);

    this._trackedQuestId = null;
    this._collapsed = false;
    this._position = this._loadPosition();
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-quest-tracker",
    classes: ["bobsnpc", "quest-tracker"],
    tag: "div",
    window: {
      frame: false,
      positioned: true,
      minimizable: false,
      resizable: false
    },
    position: {
      width: 280,
      height: "auto"
    },
    actions: {
      toggleCollapse: QuestTracker.#onToggleCollapse,
      openQuestLog: QuestTracker.#onOpenQuestLog,
      cycleQuest: QuestTracker.#onCycleQuest,
      checkObjective: QuestTracker.#onCheckObjective
    }
  };

  /** @override */
  static PARTS = {
    tracker: {
      template: `modules/${MODULE_ID}/templates/quest-tracker/tracker.hbs`
    }
  };

  /**
   * Get singleton instance
   * @returns {QuestTracker}
   */
  static getInstance() {
    if (!QuestTracker._instance) {
      QuestTracker._instance = new QuestTracker();
    }
    return QuestTracker._instance;
  }

  /**
   * Load saved position from client settings
   * @returns {object}
   * @private
   */
  _loadPosition() {
    try {
      const saved = game.settings.get(MODULE_ID, "questTrackerPosition");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // Use default
    }

    // Default position: top-right corner
    return {
      top: 100,
      left: window.innerWidth - 300
    };
  }

  /**
   * Save position to client settings
   * @private
   */
  async _savePosition() {
    const pos = this.position;
    await game.settings.set(MODULE_ID, "questTrackerPosition", JSON.stringify({
      top: pos.top,
      left: pos.left
    }));
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Get tracked quest
    const trackedQuest = await this._getTrackedQuest();

    if (!trackedQuest) {
      return {
        ...context,
        hasQuest: false,
        collapsed: this._collapsed,
        theme: game.settings.get(MODULE_ID, "theme") || "dark"
      };
    }

    // Prepare objectives
    const objectives = (trackedQuest.objectives || [])
      .filter(o => !o.hidden || o.revealed)
      .filter(o => !o.secret || game.user.isGM)
      .slice(0, 5) // Show max 5 objectives
      .map(o => this._prepareObjective(o));

    // Calculate overall progress
    const completedCount = trackedQuest.objectives?.filter(o => o.completed).length || 0;
    const totalCount = trackedQuest.objectives?.length || 0;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      ...context,
      hasQuest: true,
      collapsed: this._collapsed,
      quest: {
        id: trackedQuest.id,
        name: trackedQuest.name,
        status: trackedQuest.status,
        progress,
        progressLabel: `${completedCount}/${totalCount}`
      },
      objectives,
      hasMoreObjectives: (trackedQuest.objectives?.length || 0) > 5,
      moreCount: Math.max(0, (trackedQuest.objectives?.length || 0) - 5),
      theme: game.settings.get(MODULE_ID, "theme") || "dark",
      canCycle: await this._canCycleQuest()
    };
  }

  /**
   * Get the currently tracked quest
   * @returns {object|null}
   * @private
   */
  async _getTrackedQuest() {
    const actor = game.user.character;
    if (!actor) return null;

    const trackedId = await actor.getFlag(MODULE_ID, "trackedQuest");
    if (!trackedId) return null;

    this._trackedQuestId = trackedId;
    return getQuestHandler().getQuest(trackedId);
  }

  /**
   * Check if player has multiple quests to cycle through
   * @returns {boolean}
   * @private
   */
  async _canCycleQuest() {
    const actor = game.user.character;
    if (!actor) return false;

    const quests = getQuestHandler().getPlayerQuests(actor.uuid);
    const activeQuests = quests.filter(q =>
      q.status === QuestStatus.ACTIVE ||
      q.status === QuestStatus.IN_PROGRESS
    );

    return activeQuests.length > 1;
  }

  /**
   * Prepare objective for display
   * @param {object} objective - Objective data
   * @returns {object}
   * @private
   */
  _prepareObjective(objective) {
    let progressText = "";
    let progressPercent = 0;

    if (objective.target > 1) {
      const current = objective.current || 0;
      progressText = `${current}/${objective.target}`;
      progressPercent = Math.round((current / objective.target) * 100);
    }

    return {
      id: objective.id,
      description: objective.description,
      completed: objective.completed,
      optional: objective.optional,
      progressText,
      progressPercent,
      hasProgress: objective.target > 1,
      icon: this._getObjectiveIcon(objective.type)
    };
  }

  /**
   * Get icon for objective type
   * @param {string} type - Objective type
   * @returns {string}
   * @private
   */
  _getObjectiveIcon(type) {
    const icons = {
      [ObjectiveType.COLLECT]: "fa-box",
      [ObjectiveType.KILL]: "fa-skull",
      [ObjectiveType.TALK_TO]: "fa-comments",
      [ObjectiveType.DISCOVER]: "fa-map-marker-alt",
      [ObjectiveType.ESCORT]: "fa-walking",
      [ObjectiveType.DEFEND]: "fa-shield-alt",
      [ObjectiveType.INTERACT]: "fa-hand-pointer",
      [ObjectiveType.CUSTOM]: "fa-circle"
    };
    return icons[type] || "fa-circle";
  }

  // ==================== Actions ====================

  static #onToggleCollapse(event, target) {
    this._collapsed = !this._collapsed;
    this.render();
  }

  static #onOpenQuestLog(event, target) {
    game.bobsnpc?.ui?.openQuestLog();
  }

  static async #onCycleQuest(event, target) {
    const actor = game.user.character;
    if (!actor) return;

    const quests = getQuestHandler().getPlayerQuests(actor.uuid);
    const activeQuests = quests.filter(q =>
      q.status === QuestStatus.ACTIVE ||
      q.status === QuestStatus.IN_PROGRESS
    );

    if (activeQuests.length <= 1) return;

    // Find current index and cycle to next
    const currentIndex = activeQuests.findIndex(q => q.id === this._trackedQuestId);
    const nextIndex = (currentIndex + 1) % activeQuests.length;
    const nextQuest = activeQuests[nextIndex];

    await actor.setFlag(MODULE_ID, "trackedQuest", nextQuest.id);
    this._trackedQuestId = nextQuest.id;
    this.render();

    // Show notification
    ui.notifications.info(localize("QuestTracker.NowTracking", { name: nextQuest.name }));
  }

  static async #onCheckObjective(event, target) {
    // GM-only: manually check off an objective
    if (!game.user.isGM) return;

    const objectiveId = target.dataset.objectiveId;
    const questId = this._trackedQuestId;

    if (!questId || !objectiveId) return;

    const quest = getQuestHandler().getQuest(questId);
    const objective = quest?.objectives?.find(o => o.id === objectiveId);

    if (!objective) return;

    // Toggle completion
    await getQuestHandler().updateObjective(questId, objectiveId, {
      completed: !objective.completed,
      current: objective.completed ? 0 : objective.target
    });

    this.render();
  }

  // ==================== Lifecycle ====================

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    // Make draggable
    this._makeDraggable();

    // Register hooks for updates
    this._registerHooks();

    // Apply saved position
    this.setPosition(this._position);
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);

    // Add theme class
    this.element.classList.remove("theme-dark", "theme-light", "theme-parchment", "theme-high-contrast");
    this.element.classList.add(`theme-${context.theme}`);
  }

  /** @override */
  async _onClose(options) {
    await super._onClose(options);

    this._unregisterHooks();
    QuestTracker._instance = null;
  }

  /**
   * Make the tracker draggable
   * @private
   */
  _makeDraggable() {
    const header = this.element.querySelector(".tracker-header");
    if (!header) return;

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.style.cursor = "move";

    header.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return; // Don't drag when clicking buttons

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const pos = this.position;
      startLeft = pos.left;
      startTop = pos.top;

      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      this.setPosition({
        left: Math.max(0, Math.min(window.innerWidth - 300, startLeft + deltaX)),
        top: Math.max(0, Math.min(window.innerHeight - 100, startTop + deltaY))
      });
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        this._savePosition();
      }
    });
  }

  /**
   * Register hooks for quest updates
   * @private
   */
  _registerHooks() {
    this._hooks = [
      Hooks.on(`${MODULE_ID}.questUpdated`, () => this.render()),
      Hooks.on(`${MODULE_ID}.questTracked`, () => this.render()),
      Hooks.on(`${MODULE_ID}.objectiveUpdated`, () => this.render()),
      Hooks.on("updateActor", (actor) => {
        if (actor.id === game.user.character?.id) {
          this.render();
        }
      })
    ];
  }

  /**
   * Unregister hooks
   * @private
   */
  _unregisterHooks() {
    if (this._hooks) {
      this._hooks.forEach(id => Hooks.off(id));
      this._hooks = null;
    }
  }

  // ==================== Static Methods ====================

  /**
   * Show the quest tracker
   */
  static async show() {
    if (!game.settings.get(MODULE_ID, "questTrackerEnabled")) return;

    const tracker = QuestTracker.getInstance();
    await tracker.render(true);
    return tracker;
  }

  /**
   * Hide the quest tracker
   */
  static hide() {
    if (QuestTracker._instance) {
      QuestTracker._instance.close();
    }
  }

  /**
   * Toggle the quest tracker
   */
  static toggle() {
    if (QuestTracker._instance?.rendered) {
      QuestTracker.hide();
    } else {
      QuestTracker.show();
    }
  }

  /**
   * Refresh the quest tracker
   */
  static refresh() {
    if (QuestTracker._instance?.rendered) {
      QuestTracker._instance.render();
    }
  }

  /**
   * Update tracked quest
   * @param {string} questId - Quest ID to track
   */
  static async track(questId) {
    const actor = game.user.character;
    if (!actor) return;

    await actor.setFlag(MODULE_ID, "trackedQuest", questId);
    QuestTracker.refresh();
  }

  /**
   * Untrack current quest
   */
  static async untrack() {
    const actor = game.user.character;
    if (!actor) return;

    await actor.unsetFlag(MODULE_ID, "trackedQuest");
    QuestTracker.refresh();
  }
}
