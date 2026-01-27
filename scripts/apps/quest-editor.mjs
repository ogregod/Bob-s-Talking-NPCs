/**
 * Bob's Talking NPCs - Quest Editor
 * GM tool for creating and editing quests using Foundry V13 ApplicationV2
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize, generateId } from "../utils/helpers.mjs";
import {
  createQuest,
  createObjective,
  createRewards,
  QuestStatus,
  QuestCategory,
  QuestVisibility,
  ObjectiveType,
  RewardDistribution,
  RepeatableType,
  OnGiverDeath,
  validateQuest
} from "../data/quest-model.mjs";

/** Get quest handler instance */
function getQuestHandler() {
  return game.bobsnpc?.handlers?.quest;
}

/** Get faction handler instance */
function getFactionHandler() {
  return game.bobsnpc?.handlers?.faction;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Quest Editor Application
 * Comprehensive GM tool for creating and editing quests
 */
export class QuestEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} quest - Existing quest data (null for new quest)
   * @param {object} options - Application options
   */
  constructor(quest = null, options = {}) {
    super(options);

    this._activeTab = options.tab || "general";
    this._isNew = !quest;

    // Working copy of quest data
    this._quest = quest ? foundry.utils.deepClone(quest) : createQuest({
      name: game.i18n.localize("BOBSNPC.QuestEditor.NewQuest"),
      status: QuestStatus.AVAILABLE
    });
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-quest-editor",
    classes: ["bobsnpc", "quest-editor"],
    tag: "form",
    form: {
      handler: QuestEditor.#onFormSubmit,
      closeOnSubmit: false,
      submitOnChange: true
    },
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.QuestEditor.Title",
      icon: "fa-solid fa-scroll",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 750,
      height: 700
    },
    actions: {
      changeTab: QuestEditor.#onChangeTab,
      addObjective: QuestEditor.#onAddObjective,
      removeObjective: QuestEditor.#onRemoveObjective,
      moveObjectiveUp: QuestEditor.#onMoveObjectiveUp,
      moveObjectiveDown: QuestEditor.#onMoveObjectiveDown,
      addRewardItem: QuestEditor.#onAddRewardItem,
      removeRewardItem: QuestEditor.#onRemoveRewardItem,
      addReputationReward: QuestEditor.#onAddReputationReward,
      removeReputationReward: QuestEditor.#onRemoveReputationReward,
      addPrereqQuest: QuestEditor.#onAddPrereqQuest,
      removePrereqQuest: QuestEditor.#onRemovePrereqQuest,
      selectQuestGiver: QuestEditor.#onSelectQuestGiver,
      clearQuestGiver: QuestEditor.#onClearQuestGiver,
      selectTurnInActor: QuestEditor.#onSelectTurnInActor,
      clearTurnInActor: QuestEditor.#onClearTurnInActor,
      saveQuest: QuestEditor.#onSaveQuest,
      cancelEdit: QuestEditor.#onCancelEdit,
      deleteQuest: QuestEditor.#onDeleteQuest,
      duplicateQuest: QuestEditor.#onDuplicateQuest
    }
  };

  /** @override */
  static PARTS = {
    tabs: {
      template: `modules/${MODULE_ID}/templates/quest-editor/tabs.hbs`
    },
    general: {
      template: `modules/${MODULE_ID}/templates/quest-editor/general.hbs`,
      scrollable: [".tab-content"]
    },
    objectives: {
      template: `modules/${MODULE_ID}/templates/quest-editor/objectives.hbs`,
      scrollable: [".tab-content"]
    },
    rewards: {
      template: `modules/${MODULE_ID}/templates/quest-editor/rewards.hbs`,
      scrollable: [".tab-content"]
    },
    prerequisites: {
      template: `modules/${MODULE_ID}/templates/quest-editor/prerequisites.hbs`,
      scrollable: [".tab-content"]
    },
    advanced: {
      template: `modules/${MODULE_ID}/templates/quest-editor/advanced.hbs`,
      scrollable: [".tab-content"]
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/quest-editor/footer.hbs`
    }
  };

  /** @override */
  get title() {
    if (this._isNew) {
      return game.i18n.localize("BOBSNPC.QuestEditor.TitleNew");
    }
    return game.i18n.format("BOBSNPC.QuestEditor.TitleEdit", { name: this._quest.name });
  }

  /** @override */
  async _prepareContext(options) {
    const factions = getFactionHandler()?.getAllFactions() || [];
    const allQuests = getQuestHandler()?.getAllQuests() || [];
    const otherQuests = allQuests.filter(q => q.id !== this._quest.id);

    // Get giver actor data
    let giverActor = null;
    if (this._quest.giver?.actorUuid) {
      giverActor = await fromUuid(this._quest.giver.actorUuid);
    }

    // Get turn-in actor data
    let turnInActor = null;
    if (this._quest.giver?.turnInActorUuid) {
      turnInActor = await fromUuid(this._quest.giver.turnInActorUuid);
    }

    // Prepare objectives display data
    const objectivesDisplay = this._quest.objectives.map((obj, index) => ({
      ...obj,
      index,
      typeLabel: this._getObjectiveTypeLabel(obj.type),
      canMoveUp: index > 0,
      canMoveDown: index < this._quest.objectives.length - 1
    }));

    // Prepare reward items display
    const rewardItemsDisplay = await Promise.all(
      (this._quest.rewards?.items || []).map(async (item, index) => {
        let itemData = null;
        if (item.compendiumId) {
          try {
            itemData = await fromUuid(item.compendiumId);
          } catch (e) {
            // Item not found
          }
        }
        return {
          ...item,
          index,
          name: itemData?.name || item.compendiumId || "Unknown Item",
          img: itemData?.img || "icons/svg/item-bag.svg"
        };
      })
    );

    // Prepare reputation rewards display
    const reputationRewardsDisplay = (this._quest.rewards?.reputation || []).map((rep, index) => {
      const faction = factions.find(f => f.id === rep.factionId);
      return {
        ...rep,
        index,
        factionName: faction?.name || rep.factionId || "Unknown Faction"
      };
    });

    // Prepare prerequisite quests display
    const prereqQuestsDisplay = (this._quest.prerequisites?.quests || []).map((questId, index) => {
      const quest = allQuests.find(q => q.id === questId);
      return {
        questId,
        index,
        name: quest?.name || questId || "Unknown Quest"
      };
    });

    return {
      quest: this._quest,
      isNew: this._isNew,
      activeTab: this._activeTab,
      theme: game.settings.get(MODULE_ID, "theme") || "default",

      // Enum options
      statusOptions: this._getStatusOptions(),
      categoryOptions: this._getCategoryOptions(),
      visibilityOptions: this._getVisibilityOptions(),
      objectiveTypeOptions: this._getObjectiveTypeOptions(),
      distributionOptions: this._getDistributionOptions(),
      repeatableOptions: this._getRepeatableOptions(),
      onGiverDeathOptions: this._getOnGiverDeathOptions(),

      // Related data
      factions,
      otherQuests,
      objectivesDisplay,
      rewardItemsDisplay,
      reputationRewardsDisplay,
      prereqQuestsDisplay,

      // Actor data
      giverActor: giverActor ? {
        uuid: this._quest.giver.actorUuid,
        name: giverActor.name,
        img: giverActor.img
      } : null,
      turnInActor: turnInActor ? {
        uuid: this._quest.giver.turnInActorUuid,
        name: turnInActor.name,
        img: turnInActor.img
      } : null,

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

  _getStatusOptions() {
    return [
      { value: QuestStatus.AVAILABLE, label: localize("QuestEditor.Status.Available") },
      { value: QuestStatus.ACCEPTED, label: localize("QuestEditor.Status.Accepted") },
      { value: QuestStatus.IN_PROGRESS, label: localize("QuestEditor.Status.InProgress") },
      { value: QuestStatus.COMPLETED, label: localize("QuestEditor.Status.Completed") },
      { value: QuestStatus.FAILED, label: localize("QuestEditor.Status.Failed") }
    ];
  }

  _getCategoryOptions() {
    return [
      { value: QuestCategory.MAIN_STORY, label: localize("QuestEditor.Category.MainStory") },
      { value: QuestCategory.SIDE_QUEST, label: localize("QuestEditor.Category.SideQuest") },
      { value: QuestCategory.BOUNTY, label: localize("QuestEditor.Category.Bounty") },
      { value: QuestCategory.DAILY, label: localize("QuestEditor.Category.Daily") },
      { value: QuestCategory.GUILD_CONTRACT, label: localize("QuestEditor.Category.GuildContract") },
      { value: QuestCategory.CUSTOM, label: localize("QuestEditor.Category.Custom") }
    ];
  }

  _getVisibilityOptions() {
    return [
      { value: QuestVisibility.PARTY, label: localize("QuestEditor.Visibility.Party") },
      { value: QuestVisibility.INDIVIDUAL, label: localize("QuestEditor.Visibility.Individual") },
      { value: QuestVisibility.CLASS_SPECIFIC, label: localize("QuestEditor.Visibility.ClassSpecific") },
      { value: QuestVisibility.SECRET, label: localize("QuestEditor.Visibility.Secret") }
    ];
  }

  _getObjectiveTypeOptions() {
    return [
      { value: ObjectiveType.MANUAL, label: localize("QuestEditor.ObjectiveType.Manual") },
      { value: ObjectiveType.KILL_COUNT, label: localize("QuestEditor.ObjectiveType.KillCount") },
      { value: ObjectiveType.ITEM_COLLECT, label: localize("QuestEditor.ObjectiveType.ItemCollect") },
      { value: ObjectiveType.LOCATION, label: localize("QuestEditor.ObjectiveType.Location") }
    ];
  }

  _getDistributionOptions() {
    return [
      { value: RewardDistribution.SPLIT, label: localize("QuestEditor.Distribution.Split") },
      { value: RewardDistribution.FULL_EACH, label: localize("QuestEditor.Distribution.FullEach") },
      { value: RewardDistribution.GM_CHOICE, label: localize("QuestEditor.Distribution.GMChoice") }
    ];
  }

  _getRepeatableOptions() {
    return [
      { value: RepeatableType.NONE, label: localize("QuestEditor.Repeatable.None") },
      { value: RepeatableType.DAILY, label: localize("QuestEditor.Repeatable.Daily") },
      { value: RepeatableType.WEEKLY, label: localize("QuestEditor.Repeatable.Weekly") },
      { value: RepeatableType.INFINITE, label: localize("QuestEditor.Repeatable.Infinite") },
      { value: RepeatableType.COOLDOWN, label: localize("QuestEditor.Repeatable.Cooldown") }
    ];
  }

  _getOnGiverDeathOptions() {
    return [
      { value: OnGiverDeath.GM_PROMPT, label: localize("QuestEditor.OnGiverDeath.GMPrompt") },
      { value: OnGiverDeath.FAIL, label: localize("QuestEditor.OnGiverDeath.Fail") },
      { value: OnGiverDeath.CONTINUE, label: localize("QuestEditor.OnGiverDeath.Continue") },
      { value: OnGiverDeath.USE_ALTERNATIVE, label: localize("QuestEditor.OnGiverDeath.UseAlternative") }
    ];
  }

  _getObjectiveTypeLabel(type) {
    const labels = {
      [ObjectiveType.MANUAL]: localize("QuestEditor.ObjectiveType.Manual"),
      [ObjectiveType.KILL_COUNT]: localize("QuestEditor.ObjectiveType.KillCount"),
      [ObjectiveType.ITEM_COLLECT]: localize("QuestEditor.ObjectiveType.ItemCollect"),
      [ObjectiveType.LOCATION]: localize("QuestEditor.ObjectiveType.Location")
    };
    return labels[type] || type;
  }

  // ==================== FORM HANDLING ====================

  /**
   * Handle form submission
   */
  static async #onFormSubmit(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);

    // Update quest data from form
    if (data.quest) {
      foundry.utils.mergeObject(this._quest, data.quest, { overwrite: true });
    }

    this._quest.updatedAt = Date.now();
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

  // ==================== OBJECTIVE ACTIONS ====================

  /**
   * Add new objective
   */
  static async #onAddObjective(event, target) {
    const newObjective = createObjective({
      text: game.i18n.localize("BOBSNPC.QuestEditor.NewObjective"),
      order: this._quest.objectives.length
    });
    this._quest.objectives.push(newObjective);
    this.render();
  }

  /**
   * Remove objective
   */
  static async #onRemoveObjective(event, target) {
    const index = parseInt(target.dataset.index, 10);
    if (!isNaN(index) && index >= 0 && index < this._quest.objectives.length) {
      this._quest.objectives.splice(index, 1);
      // Reorder remaining objectives
      this._quest.objectives.forEach((obj, i) => obj.order = i);
      this.render();
    }
  }

  /**
   * Move objective up
   */
  static async #onMoveObjectiveUp(event, target) {
    const index = parseInt(target.dataset.index, 10);
    if (index > 0) {
      const temp = this._quest.objectives[index];
      this._quest.objectives[index] = this._quest.objectives[index - 1];
      this._quest.objectives[index - 1] = temp;
      // Update order
      this._quest.objectives.forEach((obj, i) => obj.order = i);
      this.render();
    }
  }

  /**
   * Move objective down
   */
  static async #onMoveObjectiveDown(event, target) {
    const index = parseInt(target.dataset.index, 10);
    if (index < this._quest.objectives.length - 1) {
      const temp = this._quest.objectives[index];
      this._quest.objectives[index] = this._quest.objectives[index + 1];
      this._quest.objectives[index + 1] = temp;
      // Update order
      this._quest.objectives.forEach((obj, i) => obj.order = i);
      this.render();
    }
  }

  // ==================== REWARD ACTIONS ====================

  /**
   * Add reward item
   */
  static async #onAddRewardItem(event, target) {
    // Open item picker
    const item = await this._pickItem();
    if (item) {
      if (!this._quest.rewards.items) this._quest.rewards.items = [];
      this._quest.rewards.items.push({
        compendiumId: item.uuid,
        quantity: 1
      });
      this.render();
    }
  }

  /**
   * Remove reward item
   */
  static async #onRemoveRewardItem(event, target) {
    const index = parseInt(target.dataset.index, 10);
    if (!isNaN(index) && this._quest.rewards?.items) {
      this._quest.rewards.items.splice(index, 1);
      this.render();
    }
  }

  /**
   * Add reputation reward
   */
  static async #onAddReputationReward(event, target) {
    if (!this._quest.rewards.reputation) this._quest.rewards.reputation = [];
    const factions = getFactionHandler()?.getAllFactions() || [];
    if (factions.length === 0) {
      ui.notifications.warn(game.i18n.localize("BOBSNPC.QuestEditor.NoFactionsAvailable"));
      return;
    }
    // Add first faction as default
    this._quest.rewards.reputation.push({
      factionId: factions[0].id,
      amount: 10
    });
    this.render();
  }

  /**
   * Remove reputation reward
   */
  static async #onRemoveReputationReward(event, target) {
    const index = parseInt(target.dataset.index, 10);
    if (!isNaN(index) && this._quest.rewards?.reputation) {
      this._quest.rewards.reputation.splice(index, 1);
      this.render();
    }
  }

  // ==================== PREREQUISITE ACTIONS ====================

  /**
   * Add prerequisite quest
   */
  static async #onAddPrereqQuest(event, target) {
    if (!this._quest.prerequisites.quests) this._quest.prerequisites.quests = [];
    const allQuests = getQuestHandler()?.getAllQuests() || [];
    const availableQuests = allQuests.filter(
      q => q.id !== this._quest.id && !this._quest.prerequisites.quests.includes(q.id)
    );
    if (availableQuests.length === 0) {
      ui.notifications.warn(game.i18n.localize("BOBSNPC.QuestEditor.NoQuestsAvailable"));
      return;
    }
    // Open quest picker dialog
    const questId = await this._pickQuest(availableQuests);
    if (questId) {
      this._quest.prerequisites.quests.push(questId);
      this.render();
    }
  }

  /**
   * Remove prerequisite quest
   */
  static async #onRemovePrereqQuest(event, target) {
    const index = parseInt(target.dataset.index, 10);
    if (!isNaN(index) && this._quest.prerequisites?.quests) {
      this._quest.prerequisites.quests.splice(index, 1);
      this.render();
    }
  }

  // ==================== ACTOR SELECTION ACTIONS ====================

  /**
   * Select quest giver
   */
  static async #onSelectQuestGiver(event, target) {
    const actor = await this._pickActor();
    if (actor) {
      if (!this._quest.giver) this._quest.giver = {};
      this._quest.giver.actorUuid = actor.uuid;
      this.render();
    }
  }

  /**
   * Clear quest giver
   */
  static async #onClearQuestGiver(event, target) {
    if (this._quest.giver) {
      this._quest.giver.actorUuid = null;
      this.render();
    }
  }

  /**
   * Select turn-in actor
   */
  static async #onSelectTurnInActor(event, target) {
    const actor = await this._pickActor();
    if (actor) {
      if (!this._quest.giver) this._quest.giver = {};
      this._quest.giver.turnInActorUuid = actor.uuid;
      this.render();
    }
  }

  /**
   * Clear turn-in actor
   */
  static async #onClearTurnInActor(event, target) {
    if (this._quest.giver) {
      this._quest.giver.turnInActorUuid = null;
      this.render();
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Open item picker dialog
   * @returns {Promise<Item|null>}
   */
  async _pickItem() {
    return new Promise((resolve) => {
      new Dialog({
        title: game.i18n.localize("BOBSNPC.QuestEditor.SelectItem"),
        content: `
          <form>
            <div class="form-group">
              <label>${game.i18n.localize("BOBSNPC.QuestEditor.ItemUUID")}</label>
              <input type="text" name="itemUuid" placeholder="Item.xxxx or Compendium.xxx.xxx" />
              <p class="hint">${game.i18n.localize("BOBSNPC.QuestEditor.ItemUUIDHint")}</p>
            </div>
          </form>
        `,
        buttons: {
          select: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize("BOBSNPC.QuestEditor.Select"),
            callback: async (html) => {
              const uuid = html.find('[name="itemUuid"]').val();
              if (uuid) {
                const item = await fromUuid(uuid);
                resolve(item);
              } else {
                resolve(null);
              }
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("BOBSNPC.QuestEditor.Cancel"),
            callback: () => resolve(null)
          }
        },
        default: "select"
      }).render(true);
    });
  }

  /**
   * Open actor picker dialog
   * @returns {Promise<Actor|null>}
   */
  async _pickActor() {
    return new Promise((resolve) => {
      const actors = game.actors.filter(a => a.type === "npc");
      const options = actors.map(a => `<option value="${a.uuid}">${a.name}</option>`).join("");

      new Dialog({
        title: game.i18n.localize("BOBSNPC.QuestEditor.SelectActor"),
        content: `
          <form>
            <div class="form-group">
              <label>${game.i18n.localize("BOBSNPC.QuestEditor.Actor")}</label>
              <select name="actorUuid">
                <option value="">${game.i18n.localize("BOBSNPC.QuestEditor.SelectActorPrompt")}</option>
                ${options}
              </select>
            </div>
          </form>
        `,
        buttons: {
          select: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize("BOBSNPC.QuestEditor.Select"),
            callback: async (html) => {
              const uuid = html.find('[name="actorUuid"]').val();
              if (uuid) {
                const actor = await fromUuid(uuid);
                resolve(actor);
              } else {
                resolve(null);
              }
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("BOBSNPC.QuestEditor.Cancel"),
            callback: () => resolve(null)
          }
        },
        default: "select"
      }).render(true);
    });
  }

  /**
   * Open quest picker dialog
   * @param {object[]} quests - Available quests
   * @returns {Promise<string|null>}
   */
  async _pickQuest(quests) {
    return new Promise((resolve) => {
      const options = quests.map(q => `<option value="${q.id}">${q.name}</option>`).join("");

      new Dialog({
        title: game.i18n.localize("BOBSNPC.QuestEditor.SelectQuest"),
        content: `
          <form>
            <div class="form-group">
              <label>${game.i18n.localize("BOBSNPC.QuestEditor.Quest")}</label>
              <select name="questId">
                <option value="">${game.i18n.localize("BOBSNPC.QuestEditor.SelectQuestPrompt")}</option>
                ${options}
              </select>
            </div>
          </form>
        `,
        buttons: {
          select: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize("BOBSNPC.QuestEditor.Select"),
            callback: (html) => {
              const questId = html.find('[name="questId"]').val();
              resolve(questId || null);
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("BOBSNPC.QuestEditor.Cancel"),
            callback: () => resolve(null)
          }
        },
        default: "select"
      }).render(true);
    });
  }

  // ==================== SAVE/CANCEL ACTIONS ====================

  /**
   * Save quest
   */
  static async #onSaveQuest(event, target) {
    // Validate quest
    const validation = validateQuest(this._quest);
    if (!validation.valid) {
      ui.notifications.error(validation.errors.join(", "));
      return;
    }

    const handler = getQuestHandler();
    if (!handler) {
      ui.notifications.error(game.i18n.localize("BOBSNPC.QuestEditor.HandlerNotFound"));
      return;
    }

    try {
      if (this._isNew) {
        await handler.createQuest(this._quest);
        ui.notifications.info(game.i18n.localize("BOBSNPC.QuestEditor.QuestCreated"));
      } else {
        await handler.updateQuest(this._quest.id, this._quest);
        ui.notifications.info(game.i18n.localize("BOBSNPC.QuestEditor.QuestUpdated"));
      }

      // Refresh GM Dashboard if open
      const dashboard = Object.values(ui.windows).find(w => w.id === "bobsnpc-gm-dashboard");
      if (dashboard) dashboard.render();

      this.close();
    } catch (error) {
      console.error(`${MODULE_ID} | Error saving quest:`, error);
      ui.notifications.error(game.i18n.localize("BOBSNPC.QuestEditor.SaveError"));
    }
  }

  /**
   * Cancel edit
   */
  static async #onCancelEdit(event, target) {
    this.close();
  }

  /**
   * Delete quest
   */
  static async #onDeleteQuest(event, target) {
    if (this._isNew) {
      this.close();
      return;
    }

    const confirmed = await Dialog.confirm({
      title: game.i18n.localize("BOBSNPC.QuestEditor.DeleteConfirmTitle"),
      content: game.i18n.format("BOBSNPC.QuestEditor.DeleteConfirmContent", { name: this._quest.name })
    });

    if (!confirmed) return;

    const handler = getQuestHandler();
    if (handler) {
      await handler.deleteQuest(this._quest.id);
      ui.notifications.info(game.i18n.localize("BOBSNPC.QuestEditor.QuestDeleted"));

      // Refresh GM Dashboard if open
      const dashboard = Object.values(ui.windows).find(w => w.id === "bobsnpc-gm-dashboard");
      if (dashboard) dashboard.render();
    }

    this.close();
  }

  /**
   * Duplicate quest
   */
  static async #onDuplicateQuest(event, target) {
    const duplicatedQuest = createQuest({
      ...this._quest,
      id: generateId(),
      name: `${this._quest.name} (Copy)`,
      status: QuestStatus.AVAILABLE,
      acceptedBy: [],
      acceptedAt: null,
      completedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // Reset objective completion
    duplicatedQuest.objectives.forEach(obj => {
      obj.id = generateId();
      obj.completed = false;
      obj.killCurrent = 0;
      obj.itemCurrent = 0;
    });

    // Open new editor with duplicated quest
    const editor = new QuestEditor(duplicatedQuest);
    editor._isNew = true;
    editor.render(true);
  }
}
