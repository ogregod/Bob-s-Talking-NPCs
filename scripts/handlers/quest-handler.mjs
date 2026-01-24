/**
 * Bob's Talking NPCs - Quest Handler
 * Manages quest state, objectives, rewards, and player progress
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";
import {
  createQuest,
  createObjective,
  QuestStatus,
  QuestCategory,
  QuestVisibility,
  ObjectiveType,
  RewardDistribution,
  RepeatableType,
  OnGiverDeath,
  validateQuest,
  checkPrerequisites,
  calculateProgress,
  isQuestReadyForTurnIn
} from "../data/quest-model.mjs";
import { generateId, getFlag, setFlag, localize } from "../utils/helpers.mjs";

/**
 * Quest storage keys
 */
const STORAGE_KEYS = {
  QUESTS: "quests",
  PLAYER_QUESTS: "playerQuests",
  COMPLETED_QUESTS: "completedQuests",
  FAILED_QUESTS: "failedQuests"
};

/**
 * Quest Handler Class
 * Singleton managing all quest operations
 */
export class QuestHandler {
  constructor() {
    this._initialized = false;
    this._questCache = new Map();
    this._playerQuestCache = new Map();
  }

  /**
   * Initialize the quest handler
   */
  async initialize() {
    if (this._initialized) return;

    // Load quests from world storage
    await this._loadQuests();

    // Register hooks
    this._registerHooks();

    this._initialized = true;
    console.log(`${MODULE_ID} | Quest Handler initialized`);
  }

  /**
   * Register Foundry hooks
   * @private
   */
  _registerHooks() {
    // Actor deletion - handle quest giver death
    Hooks.on("deleteActor", (actor) => this._onActorDeleted(actor));

    // Item transfer - check for collect objectives
    Hooks.on("createItem", (item, options, userId) => this._onItemCreated(item, options, userId));
    Hooks.on("deleteItem", (item, options, userId) => this._onItemDeleted(item, options, userId));

    // Combat end - check for kill objectives
    Hooks.on("deleteCombatant", (combatant, options, userId) => this._onCombatantDeleted(combatant));

    // Scene change - check for location objectives
    Hooks.on("canvasReady", (canvas) => this._onSceneChange(canvas));
  }

  // ==================== QUEST STORAGE ====================

  /**
   * Load quests from world storage
   * @private
   */
  async _loadQuests() {
    const worldQuests = game.settings.get(MODULE_ID, "worldData")?.quests || {};

    this._questCache.clear();
    for (const [id, questData] of Object.entries(worldQuests)) {
      this._questCache.set(id, createQuest(questData));
    }
  }

  /**
   * Save quests to world storage
   * @private
   */
  async _saveQuests() {
    const worldData = game.settings.get(MODULE_ID, "worldData") || {};
    worldData.quests = Object.fromEntries(this._questCache);
    await game.settings.set(MODULE_ID, "worldData", worldData);
  }

  /**
   * Get a quest by ID
   * @param {string} questId - Quest ID
   * @returns {object|null}
   */
  getQuest(questId) {
    return this._questCache.get(questId) || null;
  }

  /**
   * Get all quests
   * @returns {object[]}
   */
  getAllQuests() {
    return Array.from(this._questCache.values());
  }

  /**
   * Get quests by status
   * @param {string} status - Quest status
   * @returns {object[]}
   */
  getQuestsByStatus(status) {
    return this.getAllQuests().filter(q => q.status === status);
  }

  /**
   * Get quests by category
   * @param {string} category - Quest category
   * @returns {object[]}
   */
  getQuestsByCategory(category) {
    return this.getAllQuests().filter(q => q.category === category);
  }

  // ==================== QUEST CRUD ====================

  /**
   * Create a new quest
   * @param {object} data - Quest data
   * @returns {object} Created quest
   */
  async createQuest(data) {
    const quest = createQuest({
      ...data,
      id: data.id || generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    const validation = validateQuest(quest);
    if (!validation.valid) {
      console.warn(`${MODULE_ID} | Quest validation warnings:`, validation.errors);
    }

    this._questCache.set(quest.id, quest);
    await this._saveQuests();

    Hooks.callAll("bobsNPCQuestCreated", quest);
    this._emitSocket("questCreated", { quest });

    return quest;
  }

  /**
   * Update an existing quest
   * @param {string} questId - Quest ID
   * @param {object} updates - Updates to apply
   * @returns {object|null} Updated quest
   */
  async updateQuest(questId, updates) {
    const quest = this.getQuest(questId);
    if (!quest) return null;

    const updatedQuest = {
      ...quest,
      ...updates,
      id: questId,  // Prevent ID change
      updatedAt: Date.now()
    };

    this._questCache.set(questId, updatedQuest);
    await this._saveQuests();

    Hooks.callAll("bobsNPCQuestUpdated", updatedQuest, quest);
    this._emitSocket("questUpdated", { quest: updatedQuest, previous: quest });

    return updatedQuest;
  }

  /**
   * Delete a quest
   * @param {string} questId - Quest ID
   * @returns {boolean} Success
   */
  async deleteQuest(questId) {
    const quest = this.getQuest(questId);
    if (!quest) return false;

    this._questCache.delete(questId);
    await this._saveQuests();

    // Clean up player quest data
    await this._removeQuestFromAllPlayers(questId);

    Hooks.callAll("bobsNPCQuestDeleted", quest);
    this._emitSocket("questDeleted", { questId });

    return true;
  }

  // ==================== QUEST STATE MANAGEMENT ====================

  /**
   * Accept a quest for a player/party
   * @param {string} questId - Quest ID
   * @param {Actor|Actor[]} actors - Player actor(s)
   * @returns {object} {success, quest, message}
   */
  async acceptQuest(questId, actors) {
    const quest = this.getQuest(questId);
    if (!quest) {
      return { success: false, quest: null, message: localize("BOBSNPC.QuestNotFound") };
    }

    // Normalize actors to array
    const actorArray = Array.isArray(actors) ? actors : [actors];
    const actorUuids = actorArray.map(a => a.uuid);

    // Check if already accepted
    if (quest.acceptedBy.some(uuid => actorUuids.includes(uuid))) {
      return { success: false, quest, message: localize("BOBSNPC.QuestAlreadyAccepted") };
    }

    // Check prerequisites for first actor (party leader)
    const prereqCheck = checkPrerequisites(quest, actorArray[0]);
    if (!prereqCheck.met) {
      return {
        success: false,
        quest,
        message: localize("BOBSNPC.QuestPrerequisitesNotMet") + ": " + prereqCheck.reasons.join(", ")
      };
    }

    // Check mutual exclusivity
    for (const exclusiveQuestId of quest.mutuallyExclusive) {
      const playerQuests = await this.getPlayerQuests(actorArray[0].uuid);
      if (playerQuests.some(q => q.id === exclusiveQuestId && q.status === QuestStatus.ACCEPTED)) {
        return {
          success: false,
          quest,
          message: localize("BOBSNPC.QuestMutuallyExclusive")
        };
      }
    }

    // Accept the quest
    const updatedQuest = await this.updateQuest(questId, {
      status: QuestStatus.ACCEPTED,
      acceptedBy: [...quest.acceptedBy, ...actorUuids],
      acceptedAt: Date.now()
    });

    // Add to player quest lists
    for (const actor of actorArray) {
      await this._addQuestToPlayer(actor.uuid, questId);
    }

    // Reveal handouts
    await this._revealQuestHandouts(updatedQuest, "accept");

    // Notify
    this._notifyQuestAccepted(updatedQuest, actorArray);

    Hooks.callAll("bobsNPCQuestAccepted", updatedQuest, actorArray);

    return { success: true, quest: updatedQuest, message: localize("BOBSNPC.QuestAccepted") };
  }

  /**
   * Abandon a quest
   * @param {string} questId - Quest ID
   * @param {Actor} actor - Player actor
   * @returns {object} {success, quest, message}
   */
  async abandonQuest(questId, actor) {
    const quest = this.getQuest(questId);
    if (!quest) {
      return { success: false, quest: null, message: localize("BOBSNPC.QuestNotFound") };
    }

    // Check if abandonment is allowed
    if (!quest.abandonment.allowed) {
      return { success: false, quest, message: localize("BOBSNPC.QuestCannotAbandon") };
    }

    // Check world setting
    if (!game.settings.get(MODULE_ID, "allowQuestAbandonment")) {
      return { success: false, quest, message: localize("BOBSNPC.QuestAbandonmentDisabled") };
    }

    // Remove actor from quest
    const newAcceptedBy = quest.acceptedBy.filter(uuid => uuid !== actor.uuid);

    // Apply abandonment consequences
    await this._applyAbandonmentConsequences(quest, actor);

    // If no one left, reset quest to available
    if (newAcceptedBy.length === 0) {
      await this.updateQuest(questId, {
        status: QuestStatus.AVAILABLE,
        acceptedBy: [],
        acceptedAt: null,
        objectives: quest.objectives.map(obj => ({ ...obj, completed: false }))
      });
    } else {
      await this.updateQuest(questId, { acceptedBy: newAcceptedBy });
    }

    // Remove from player's quest list
    await this._removeQuestFromPlayer(actor.uuid, questId);

    Hooks.callAll("bobsNPCQuestAbandoned", quest, actor);

    return { success: true, quest: this.getQuest(questId), message: localize("BOBSNPC.QuestAbandoned") };
  }

  /**
   * Complete a quest
   * @param {string} questId - Quest ID
   * @param {Actor[]} actors - Actors completing the quest
   * @param {string} branchId - Optional branch ID for branching quests
   * @returns {object} {success, quest, rewards, message}
   */
  async completeQuest(questId, actors, branchId = null) {
    const quest = this.getQuest(questId);
    if (!quest) {
      return { success: false, quest: null, rewards: null, message: localize("BOBSNPC.QuestNotFound") };
    }

    // Check if ready for turn-in
    if (!isQuestReadyForTurnIn(quest)) {
      return { success: false, quest, rewards: null, message: localize("BOBSNPC.QuestObjectivesIncomplete") };
    }

    // Determine rewards (branch-specific or default)
    let rewards = quest.rewards;
    if (branchId && quest.branches.length > 0) {
      const branch = quest.branches.find(b => b.id === branchId);
      if (branch) {
        rewards = branch.rewards;
        await this.updateQuest(questId, { activeBranch: branchId });
      }
    }

    // Distribute rewards
    const distributedRewards = await this._distributeRewards(rewards, actors);

    // Consume collected items if required
    await this._consumeQuestItems(quest, actors);

    // Update quest status
    const updatedQuest = await this.updateQuest(questId, {
      status: QuestStatus.COMPLETED,
      completedAt: Date.now()
    });

    // Handle repeatable quests
    if (quest.repeatable.enabled) {
      await this._handleRepeatableCompletion(updatedQuest);
    }

    // Fail conflicting quests
    for (const conflictQuestId of quest.conflictsWith) {
      await this.failQuest(conflictQuestId, "Conflicting quest completed");
    }

    // Move to completed for players
    for (const actor of actors) {
      await this._moveQuestToCompleted(actor.uuid, questId);
    }

    // Notify
    this._notifyQuestCompleted(updatedQuest, actors, distributedRewards);

    Hooks.callAll("bobsNPCQuestCompleted", updatedQuest, actors, distributedRewards);

    return {
      success: true,
      quest: updatedQuest,
      rewards: distributedRewards,
      message: localize("BOBSNPC.QuestCompleted")
    };
  }

  /**
   * Fail a quest
   * @param {string} questId - Quest ID
   * @param {string} reason - Failure reason
   * @returns {object} {success, quest, message}
   */
  async failQuest(questId, reason = "") {
    const quest = this.getQuest(questId);
    if (!quest) {
      return { success: false, quest: null, message: localize("BOBSNPC.QuestNotFound") };
    }

    const updatedQuest = await this.updateQuest(questId, {
      status: QuestStatus.FAILED,
      completedAt: Date.now()
    });

    // Move to failed for all players
    for (const actorUuid of quest.acceptedBy) {
      await this._moveQuestToFailed(actorUuid, questId);
    }

    // Notify
    this._notifyQuestFailed(updatedQuest, reason);

    Hooks.callAll("bobsNPCQuestFailed", updatedQuest, reason);

    return { success: true, quest: updatedQuest, message: localize("BOBSNPC.QuestFailed") };
  }

  // ==================== OBJECTIVE MANAGEMENT ====================

  /**
   * Update an objective's progress
   * @param {string} questId - Quest ID
   * @param {string} objectiveId - Objective ID
   * @param {object} updates - Updates to apply
   * @returns {object|null} Updated quest
   */
  async updateObjective(questId, objectiveId, updates) {
    const quest = this.getQuest(questId);
    if (!quest) return null;

    const objectiveIndex = quest.objectives.findIndex(o => o.id === objectiveId);
    if (objectiveIndex === -1) return null;

    const updatedObjectives = [...quest.objectives];
    updatedObjectives[objectiveIndex] = {
      ...updatedObjectives[objectiveIndex],
      ...updates
    };

    // Check if objective is now complete
    const objective = updatedObjectives[objectiveIndex];
    if (this._isObjectiveComplete(objective)) {
      updatedObjectives[objectiveIndex].completed = true;

      // Reveal objective-specific handouts
      await this._revealQuestHandouts(quest, "objective", objectiveId);
    }

    const updatedQuest = await this.updateQuest(questId, {
      objectives: updatedObjectives,
      status: quest.status === QuestStatus.ACCEPTED ? QuestStatus.IN_PROGRESS : quest.status
    });

    // Notify of objective update
    this._notifyObjectiveUpdate(updatedQuest, objective);

    Hooks.callAll("bobsNPCObjectiveUpdated", updatedQuest, objective);

    return updatedQuest;
  }

  /**
   * Complete an objective manually
   * @param {string} questId - Quest ID
   * @param {string} objectiveId - Objective ID
   * @returns {object|null} Updated quest
   */
  async completeObjective(questId, objectiveId) {
    return this.updateObjective(questId, objectiveId, { completed: true });
  }

  /**
   * Check if an objective is complete based on its type
   * @param {object} objective - Objective data
   * @returns {boolean}
   * @private
   */
  _isObjectiveComplete(objective) {
    if (objective.completed) return true;

    switch (objective.type) {
      case ObjectiveType.KILL_COUNT:
        return objective.killCurrent >= objective.killCount;
      case ObjectiveType.ITEM_COLLECT:
        return objective.itemCurrent >= objective.itemCount;
      case ObjectiveType.LOCATION:
        return objective.completed;  // Set by location trigger
      case ObjectiveType.MANUAL:
      default:
        return objective.completed;
    }
  }

  /**
   * Increment kill count for relevant objectives
   * @param {string} targetName - Name of killed target
   * @param {string} targetUuid - UUID of killed target
   */
  async incrementKillCount(targetName, targetUuid) {
    const activeQuests = this.getQuestsByStatus(QuestStatus.IN_PROGRESS)
      .concat(this.getQuestsByStatus(QuestStatus.ACCEPTED));

    for (const quest of activeQuests) {
      for (const objective of quest.objectives) {
        if (objective.type !== ObjectiveType.KILL_COUNT) continue;
        if (objective.completed) continue;

        // Check if target matches
        const targetMatch = objective.killTarget === targetName ||
          objective.killTarget === targetUuid ||
          targetName.toLowerCase().includes(objective.killTarget?.toLowerCase() || "");

        if (targetMatch) {
          await this.updateObjective(quest.id, objective.id, {
            killCurrent: objective.killCurrent + 1
          });
        }
      }
    }
  }

  /**
   * Update item collection progress for relevant objectives
   * @param {string} itemUuid - Item UUID
   * @param {number} count - New count
   */
  async updateItemCollection(itemUuid, count) {
    const activeQuests = this.getQuestsByStatus(QuestStatus.IN_PROGRESS)
      .concat(this.getQuestsByStatus(QuestStatus.ACCEPTED));

    for (const quest of activeQuests) {
      for (const objective of quest.objectives) {
        if (objective.type !== ObjectiveType.ITEM_COLLECT) continue;
        if (objective.completed) continue;
        if (objective.itemId !== itemUuid) continue;

        await this.updateObjective(quest.id, objective.id, {
          itemCurrent: count
        });
      }
    }
  }

  /**
   * Trigger location-based objective completion
   * @param {string} sceneId - Scene ID
   * @param {string} regionId - Optional region ID
   */
  async triggerLocationObjective(sceneId, regionId = null) {
    const activeQuests = this.getQuestsByStatus(QuestStatus.IN_PROGRESS)
      .concat(this.getQuestsByStatus(QuestStatus.ACCEPTED));

    for (const quest of activeQuests) {
      for (const objective of quest.objectives) {
        if (objective.type !== ObjectiveType.LOCATION) continue;
        if (objective.completed) continue;

        const sceneMatch = objective.locationSceneId === sceneId;
        const regionMatch = !objective.locationRegion || objective.locationRegion === regionId;

        if (sceneMatch && regionMatch) {
          await this.completeObjective(quest.id, objective.id);
        }
      }
    }
  }

  // ==================== PLAYER QUEST DATA ====================

  /**
   * Get quests for a player
   * @param {string} actorUuid - Player actor UUID
   * @returns {object[]} Player's quests
   */
  async getPlayerQuests(actorUuid) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return [];

    const questIds = getFlag(actor, STORAGE_KEYS.PLAYER_QUESTS) || [];
    return questIds.map(id => this.getQuest(id)).filter(q => q !== null);
  }

  /**
   * Get completed quests for a player
   * @param {string} actorUuid - Player actor UUID
   * @returns {object[]}
   */
  async getCompletedQuests(actorUuid) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return [];

    const questIds = getFlag(actor, STORAGE_KEYS.COMPLETED_QUESTS) || [];
    return questIds.map(id => this.getQuest(id)).filter(q => q !== null);
  }

  /**
   * Check if player has completed a specific quest
   * @param {string} actorUuid - Player actor UUID
   * @param {string} questId - Quest ID
   * @returns {boolean}
   */
  async hasCompletedQuest(actorUuid, questId) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return false;

    const completedIds = getFlag(actor, STORAGE_KEYS.COMPLETED_QUESTS) || [];
    return completedIds.includes(questId);
  }

  /**
   * Add quest to player's active list
   * @param {string} actorUuid - Player actor UUID
   * @param {string} questId - Quest ID
   * @private
   */
  async _addQuestToPlayer(actorUuid, questId) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return;

    const currentQuests = getFlag(actor, STORAGE_KEYS.PLAYER_QUESTS) || [];
    if (!currentQuests.includes(questId)) {
      await setFlag(actor, STORAGE_KEYS.PLAYER_QUESTS, [...currentQuests, questId]);
    }
  }

  /**
   * Remove quest from player's active list
   * @param {string} actorUuid - Player actor UUID
   * @param {string} questId - Quest ID
   * @private
   */
  async _removeQuestFromPlayer(actorUuid, questId) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return;

    const currentQuests = getFlag(actor, STORAGE_KEYS.PLAYER_QUESTS) || [];
    await setFlag(actor, STORAGE_KEYS.PLAYER_QUESTS, currentQuests.filter(id => id !== questId));
  }

  /**
   * Move quest to completed list
   * @param {string} actorUuid - Player actor UUID
   * @param {string} questId - Quest ID
   * @private
   */
  async _moveQuestToCompleted(actorUuid, questId) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return;

    // Remove from active
    await this._removeQuestFromPlayer(actorUuid, questId);

    // Add to completed
    const completed = getFlag(actor, STORAGE_KEYS.COMPLETED_QUESTS) || [];
    if (!completed.includes(questId)) {
      await setFlag(actor, STORAGE_KEYS.COMPLETED_QUESTS, [...completed, questId]);
    }
  }

  /**
   * Move quest to failed list
   * @param {string} actorUuid - Player actor UUID
   * @param {string} questId - Quest ID
   * @private
   */
  async _moveQuestToFailed(actorUuid, questId) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return;

    // Remove from active
    await this._removeQuestFromPlayer(actorUuid, questId);

    // Add to failed
    const failed = getFlag(actor, STORAGE_KEYS.FAILED_QUESTS) || [];
    if (!failed.includes(questId)) {
      await setFlag(actor, STORAGE_KEYS.FAILED_QUESTS, [...failed, questId]);
    }
  }

  /**
   * Remove quest from all players
   * @param {string} questId - Quest ID
   * @private
   */
  async _removeQuestFromAllPlayers(questId) {
    for (const actor of game.actors.filter(a => a.hasPlayerOwner)) {
      await this._removeQuestFromPlayer(actor.uuid, questId);

      const completed = getFlag(actor, STORAGE_KEYS.COMPLETED_QUESTS) || [];
      await setFlag(actor, STORAGE_KEYS.COMPLETED_QUESTS, completed.filter(id => id !== questId));

      const failed = getFlag(actor, STORAGE_KEYS.FAILED_QUESTS) || [];
      await setFlag(actor, STORAGE_KEYS.FAILED_QUESTS, failed.filter(id => id !== questId));
    }
  }

  // ==================== REWARDS ====================

  /**
   * Distribute rewards to actors
   * @param {object} rewards - Rewards data
   * @param {Actor[]} actors - Actors receiving rewards
   * @returns {object} Distributed rewards summary
   * @private
   */
  async _distributeRewards(rewards, actors) {
    const distribution = game.settings.get(MODULE_ID, "questDistribution") || rewards.distribution;
    const summary = {
      gold: 0,
      xp: 0,
      items: [],
      reputation: [],
      perActor: {}
    };

    if (actors.length === 0) return summary;

    // Calculate per-actor amounts based on distribution method
    let goldPerActor = 0;
    let xpPerActor = 0;

    switch (distribution) {
      case RewardDistribution.SPLIT:
        goldPerActor = Math.floor(rewards.gold / actors.length);
        xpPerActor = Math.floor(rewards.xp / actors.length);
        break;
      case RewardDistribution.FULL_EACH:
        goldPerActor = rewards.gold;
        xpPerActor = rewards.xp;
        break;
      case RewardDistribution.GM_CHOICE:
        // GM will handle manually
        goldPerActor = rewards.gold;
        xpPerActor = rewards.xp;
        break;
    }

    // Distribute to each actor
    for (const actor of actors) {
      summary.perActor[actor.uuid] = { gold: 0, xp: 0, items: [] };

      // Gold
      if (goldPerActor > 0) {
        await this._giveGold(actor, goldPerActor);
        summary.perActor[actor.uuid].gold = goldPerActor;
        summary.gold += goldPerActor;
      }

      // XP
      if (xpPerActor > 0) {
        await this._giveXP(actor, xpPerActor);
        summary.perActor[actor.uuid].xp = xpPerActor;
        summary.xp += xpPerActor;
      }

      // Items (each actor gets a copy in FULL_EACH, or first actor in SPLIT)
      if (distribution === RewardDistribution.FULL_EACH || actor === actors[0]) {
        for (const itemReward of rewards.items) {
          const item = await this._giveItem(actor, itemReward.compendiumId, itemReward.quantity);
          if (item) {
            summary.perActor[actor.uuid].items.push(item);
            summary.items.push(item);
          }
        }
      }
    }

    // Reputation changes (apply to all actors)
    for (const repChange of rewards.reputation) {
      for (const actor of actors) {
        // Delegate to faction handler
        Hooks.callAll("bobsNPCReputationChange", actor.uuid, repChange.factionId, repChange.amount);
      }
      summary.reputation.push(repChange);
    }

    // Relationship changes
    for (const relChange of rewards.relationship) {
      for (const actor of actors) {
        Hooks.callAll("bobsNPCRelationshipChange", actor.uuid, relChange.actorUuid, relChange.amount);
      }
    }

    // Titles
    if (rewards.titles?.length > 0) {
      for (const actor of actors) {
        const currentTitles = getFlag(actor, "titles") || [];
        await setFlag(actor, "titles", [...new Set([...currentTitles, ...rewards.titles])]);
      }
    }

    return summary;
  }

  /**
   * Give gold to an actor
   * @param {Actor} actor - Actor
   * @param {number} amount - Gold amount
   * @private
   */
  async _giveGold(actor, amount) {
    const currentGold = actor.system?.currency?.gp || 0;
    await actor.update({ "system.currency.gp": currentGold + amount });
  }

  /**
   * Give XP to an actor
   * @param {Actor} actor - Actor
   * @param {number} amount - XP amount
   * @private
   */
  async _giveXP(actor, amount) {
    const currentXP = actor.system?.details?.xp?.value || 0;
    await actor.update({ "system.details.xp.value": currentXP + amount });
  }

  /**
   * Give an item to an actor
   * @param {Actor} actor - Actor
   * @param {string} compendiumId - Compendium item ID
   * @param {number} quantity - Quantity
   * @returns {Item|null}
   * @private
   */
  async _giveItem(actor, compendiumId, quantity = 1) {
    try {
      const item = await fromUuid(compendiumId);
      if (!item) return null;

      const itemData = item.toObject();
      itemData.system.quantity = quantity;

      const created = await actor.createEmbeddedDocuments("Item", [itemData]);
      return created[0] || null;
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to give item:`, error);
      return null;
    }
  }

  /**
   * Consume quest items from actors' inventories
   * @param {object} quest - Quest data
   * @param {Actor[]} actors - Actors
   * @private
   */
  async _consumeQuestItems(quest, actors) {
    for (const objective of quest.objectives) {
      if (objective.type !== ObjectiveType.ITEM_COLLECT) continue;
      if (!objective.consumeItems) continue;

      for (const actor of actors) {
        const item = actor.items.find(i => i.uuid === objective.itemId);
        if (item) {
          const currentQty = item.system.quantity || 1;
          const newQty = currentQty - objective.itemCount;

          if (newQty <= 0) {
            await item.delete();
          } else {
            await item.update({ "system.quantity": newQty });
          }
        }
      }
    }
  }

  // ==================== REPEATABLE QUESTS ====================

  /**
   * Handle repeatable quest completion
   * @param {object} quest - Quest data
   * @private
   */
  async _handleRepeatableCompletion(quest) {
    if (!quest.repeatable.enabled) return;

    const newCount = quest.repeatable.completionCount + 1;
    const updates = {
      "repeatable.completionCount": newCount,
      "repeatable.lastCompleted": Date.now()
    };

    // Reset quest for next run (after cooldown)
    if (quest.repeatable.type !== RepeatableType.NONE) {
      // Schedule reset
      const cooldownMs = quest.repeatable.cooldownDays * 24 * 60 * 60 * 1000;

      // For now, we'll handle this via the ready hook checking timestamps
      // A more robust implementation would use a scheduled task
    }

    await this.updateQuest(quest.id, updates);
  }

  /**
   * Check and reset repeatable quests
   */
  async checkRepeatableQuests() {
    const completedQuests = this.getQuestsByStatus(QuestStatus.COMPLETED);
    const now = Date.now();

    for (const quest of completedQuests) {
      if (!quest.repeatable.enabled) continue;
      if (!quest.repeatable.lastCompleted) continue;

      let shouldReset = false;
      const lastCompleted = quest.repeatable.lastCompleted;

      switch (quest.repeatable.type) {
        case RepeatableType.DAILY:
          shouldReset = now - lastCompleted > 24 * 60 * 60 * 1000;
          break;
        case RepeatableType.WEEKLY:
          shouldReset = now - lastCompleted > 7 * 24 * 60 * 60 * 1000;
          break;
        case RepeatableType.COOLDOWN:
          const cooldownMs = quest.repeatable.cooldownDays * 24 * 60 * 60 * 1000;
          shouldReset = now - lastCompleted > cooldownMs;
          break;
        case RepeatableType.INFINITE:
          shouldReset = true;
          break;
      }

      if (shouldReset) {
        await this.resetQuest(quest.id);
      }
    }
  }

  /**
   * Reset a quest to available state
   * @param {string} questId - Quest ID
   */
  async resetQuest(questId) {
    const quest = this.getQuest(questId);
    if (!quest) return;

    await this.updateQuest(questId, {
      status: QuestStatus.AVAILABLE,
      acceptedBy: [],
      acceptedAt: null,
      completedAt: null,
      activeBranch: null,
      objectives: quest.objectives.map(obj => ({
        ...obj,
        completed: false,
        killCurrent: 0,
        itemCurrent: 0
      }))
    });
  }

  // ==================== EVENT HANDLERS ====================

  /**
   * Handle actor deletion (quest giver death)
   * @param {Actor} actor - Deleted actor
   * @private
   */
  async _onActorDeleted(actor) {
    const affectedQuests = this.getAllQuests().filter(
      q => q.giver.actorUuid === actor.uuid &&
        [QuestStatus.AVAILABLE, QuestStatus.ACCEPTED, QuestStatus.IN_PROGRESS].includes(q.status)
    );

    for (const quest of affectedQuests) {
      switch (quest.onGiverDeath) {
        case OnGiverDeath.FAIL:
          await this.failQuest(quest.id, "Quest giver has died");
          break;
        case OnGiverDeath.CONTINUE:
          // Do nothing, quest continues
          break;
        case OnGiverDeath.USE_ALTERNATIVE:
          if (quest.giver.turnInAlternatives.length > 0) {
            await this.updateQuest(quest.id, {
              "giver.turnInActorUuid": quest.giver.turnInAlternatives[0]
            });
          }
          break;
        case OnGiverDeath.GM_PROMPT:
        default:
          // Notify GM to decide
          this._notifyGMQuestGiverDeath(quest, actor);
          break;
      }
    }
  }

  /**
   * Handle item creation (for collect objectives)
   * @private
   */
  async _onItemCreated(item, options, userId) {
    if (!item.parent?.hasPlayerOwner) return;

    await this.updateItemCollection(item.uuid, item.system.quantity || 1);
  }

  /**
   * Handle item deletion
   * @private
   */
  async _onItemDeleted(item, options, userId) {
    if (!item.parent?.hasPlayerOwner) return;

    await this.updateItemCollection(item.uuid, 0);
  }

  /**
   * Handle combatant death (for kill objectives)
   * @private
   */
  async _onCombatantDeleted(combatant) {
    const actor = combatant.actor;
    if (!actor) return;

    // Check if this was a kill (not just removed from combat)
    const currentHP = actor.system?.attributes?.hp?.value || 0;
    if (currentHP <= 0) {
      await this.incrementKillCount(actor.name, actor.uuid);
    }
  }

  /**
   * Handle scene change (for location objectives)
   * @private
   */
  async _onSceneChange(canvas) {
    const sceneId = canvas.scene?.id;
    if (!sceneId) return;

    // Get player tokens on this scene
    const playerTokens = canvas.tokens?.placeables?.filter(t => t.actor?.hasPlayerOwner) || [];

    if (playerTokens.length > 0) {
      await this.triggerLocationObjective(sceneId);
    }
  }

  // ==================== NOTIFICATIONS ====================

  /**
   * Notify quest accepted
   * @private
   */
  _notifyQuestAccepted(quest, actors) {
    const message = `${localize("BOBSNPC.QuestAccepted")}: ${quest.name}`;
    ui.notifications.info(message);

    // Chat message
    this._postQuestChatMessage(quest, "accepted", actors);
  }

  /**
   * Notify quest completed
   * @private
   */
  _notifyQuestCompleted(quest, actors, rewards) {
    const message = `${localize("BOBSNPC.QuestCompleted")}: ${quest.name}`;
    ui.notifications.success(message);

    // Chat message with rewards
    this._postQuestChatMessage(quest, "completed", actors, rewards);
  }

  /**
   * Notify quest failed
   * @private
   */
  _notifyQuestFailed(quest, reason) {
    const message = `${localize("BOBSNPC.QuestFailed")}: ${quest.name}`;
    ui.notifications.error(message);

    this._postQuestChatMessage(quest, "failed", [], null, reason);
  }

  /**
   * Notify objective update
   * @private
   */
  _notifyObjectiveUpdate(quest, objective) {
    if (objective.completed) {
      ui.notifications.info(`${localize("BOBSNPC.ObjectiveComplete")}: ${objective.text}`);
    }
  }

  /**
   * Notify GM of quest giver death
   * @private
   */
  _notifyGMQuestGiverDeath(quest, actor) {
    if (!game.user.isGM) return;

    Dialog.confirm({
      title: localize("BOBSNPC.QuestGiverDeath"),
      content: `<p>${actor.name} ${localize("BOBSNPC.QuestGiverDeathMessage")}</p>
                <p><strong>${quest.name}</strong></p>
                <p>${localize("BOBSNPC.QuestGiverDeathPrompt")}</p>`,
      yes: () => this.failQuest(quest.id, "Quest giver died"),
      no: () => { }, // Continue quest
      defaultYes: false
    });
  }

  /**
   * Post quest-related chat message
   * @private
   */
  _postQuestChatMessage(quest, type, actors = [], rewards = null, reason = "") {
    const showMessages = game.settings.get(MODULE_ID, "questChatMessages") ?? true;
    if (!showMessages) return;

    let content = `<div class="bobsnpc-quest-message ${type}">`;
    content += `<h3>${quest.name}</h3>`;

    switch (type) {
      case "accepted":
        content += `<p>${localize("BOBSNPC.QuestAcceptedBy")} ${actors.map(a => a.name).join(", ")}</p>`;
        break;
      case "completed":
        content += `<p>${localize("BOBSNPC.QuestCompletedMessage")}</p>`;
        if (rewards) {
          content += `<div class="rewards">`;
          if (rewards.gold > 0) content += `<p>💰 ${rewards.gold} ${localize("BOBSNPC.Gold")}</p>`;
          if (rewards.xp > 0) content += `<p>⭐ ${rewards.xp} ${localize("BOBSNPC.XP")}</p>`;
          content += `</div>`;
        }
        break;
      case "failed":
        content += `<p>${localize("BOBSNPC.QuestFailedMessage")}</p>`;
        if (reason) content += `<p><em>${reason}</em></p>`;
        break;
    }

    content += `</div>`;

    ChatMessage.create({
      content,
      speaker: { alias: MODULE_ID },
      flags: { [MODULE_ID]: { questId: quest.id, type } }
    });
  }

  // ==================== HANDOUTS ====================

  /**
   * Reveal quest handouts
   * @param {object} quest - Quest data
   * @param {string} trigger - Trigger type (accept, objective)
   * @param {string} objectiveId - Objective ID (for objective triggers)
   * @private
   */
  async _revealQuestHandouts(quest, trigger, objectiveId = null) {
    for (const handout of quest.handouts) {
      let shouldReveal = false;

      if (trigger === "accept" && handout.revealOnAccept) {
        shouldReveal = true;
      } else if (trigger === "objective" && handout.revealOnObjective === objectiveId) {
        shouldReveal = true;
      }

      if (shouldReveal) {
        await this._showHandout(handout);
      }
    }
  }

  /**
   * Show a handout to players
   * @param {object} handout - Handout data
   * @private
   */
  async _showHandout(handout) {
    switch (handout.type) {
      case "image":
        new ImagePopout(handout.url, { title: handout.name }).render(true);
        break;
      case "journal":
        const journal = await fromUuid(handout.pageId);
        if (journal) journal.sheet.render(true);
        break;
      case "text":
        Dialog.prompt({
          title: handout.name,
          content: `<div class="handout-content">${handout.content}</div>`,
          callback: () => { }
        });
        break;
    }
  }

  // ==================== ABANDONMENT ====================

  /**
   * Apply consequences for abandoning a quest
   * @param {object} quest - Quest data
   * @param {Actor} actor - Actor abandoning
   * @private
   */
  async _applyAbandonmentConsequences(quest, actor) {
    const consequences = quest.abandonment.consequences;

    // Reputation loss
    for (const repLoss of consequences.reputationLoss) {
      Hooks.callAll("bobsNPCReputationChange", actor.uuid, repLoss.factionId, -repLoss.amount);
    }

    // Relationship loss
    for (const relLoss of consequences.relationshipLoss) {
      Hooks.callAll("bobsNPCRelationshipChange", actor.uuid, relLoss.actorUuid, -relLoss.amount);
    }

    // Fail related quests
    for (const relatedQuestId of consequences.failRelatedQuests) {
      await this.failQuest(relatedQuestId, "Related quest abandoned");
    }

    // Apply cooldown (store timestamp)
    if (consequences.cooldownDays > 0) {
      const cooldownUntil = Date.now() + (consequences.cooldownDays * 24 * 60 * 60 * 1000);
      const cooldowns = getFlag(actor, "questCooldowns") || {};
      cooldowns[quest.id] = cooldownUntil;
      await setFlag(actor, "questCooldowns", cooldowns);
    }
  }

  // ==================== SOCKET ====================

  /**
   * Emit socket event
   * @param {string} event - Event name
   * @param {object} data - Event data
   * @private
   */
  _emitSocket(event, data) {
    game.socket?.emit(`module.${MODULE_ID}`, {
      type: `quest.${event}`,
      data
    });
  }
}

// Singleton instance
export const questHandler = new QuestHandler();
