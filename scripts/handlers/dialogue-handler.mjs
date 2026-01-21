/**
 * Bob's Talking NPCs - Dialogue Handler
 * Manages dialogue trees, node traversal, condition evaluation, and responses
 */

import { MODULE_ID } from "../module.mjs";
import {
  createDialogue,
  createDialogueNode,
  createDialogueResponse,
  NodeType,
  ConditionType,
  ActionType,
  validateDialogue
} from "../data/dialogue-model.mjs";
import { generateId, getFlag, setFlag, localize } from "../utils/helpers.mjs";

/**
 * Storage keys for dialogue data
 */
const STORAGE_KEYS = {
  DIALOGUES: "dialogues",
  ACTIVE_DIALOGUES: "activeDialogues",
  DIALOGUE_HISTORY: "dialogueHistory",
  UNLOCKED_OPTIONS: "unlockedDialogueOptions"
};

/**
 * Active dialogue session data
 */
class DialogueSession {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.dialogueId = data.dialogueId || null;
    this.npcActorUuid = data.npcActorUuid || null;
    this.participants = data.participants || [];  // Player actor UUIDs
    this.currentNodeId = data.currentNodeId || null;
    this.visitedNodes = data.visitedNodes || [];
    this.choices = data.choices || [];  // History of choices made
    this.variables = data.variables || {};  // Session-specific variables
    this.startedAt = data.startedAt || Date.now();
    this.lastActivity = data.lastActivity || Date.now();
    this.votingEnabled = data.votingEnabled ?? false;
    this.currentVotes = data.currentVotes || {};  // {responseId: [actorUuids]}
  }
}

/**
 * Dialogue Handler Class
 * Singleton managing all dialogue operations
 */
export class DialogueHandler {
  constructor() {
    this._initialized = false;
    this._dialogueCache = new Map();
    this._activeSessions = new Map();
    this._conditionEvaluators = new Map();
    this._actionExecutors = new Map();
  }

  /**
   * Initialize the dialogue handler
   */
  async initialize() {
    if (this._initialized) return;

    // Load dialogues from storage
    await this._loadDialogues();

    // Register built-in condition evaluators
    this._registerBuiltInConditions();

    // Register built-in action executors
    this._registerBuiltInActions();

    // Register socket handlers
    this._registerSocketHandlers();

    this._initialized = true;
    console.log(`${MODULE_ID} | Dialogue Handler initialized`);
  }

  /**
   * Register built-in condition evaluators
   * @private
   */
  _registerBuiltInConditions() {
    // Quest conditions
    this.registerCondition(ConditionType.QUEST_COMPLETE, async (condition, context) => {
      const { questId } = condition;
      return await game.bobsnpc?.quests?.hasCompletedQuest(context.actorUuid, questId) ?? false;
    });

    this.registerCondition(ConditionType.QUEST_ACTIVE, async (condition, context) => {
      const playerQuests = await game.bobsnpc?.quests?.getPlayerQuests(context.actorUuid) ?? [];
      return playerQuests.some(q => q.id === condition.questId);
    });

    this.registerCondition(ConditionType.QUEST_NOT_STARTED, async (condition, context) => {
      const playerQuests = await game.bobsnpc?.quests?.getPlayerQuests(context.actorUuid) ?? [];
      const completedQuests = await game.bobsnpc?.quests?.getCompletedQuests(context.actorUuid) ?? [];
      return !playerQuests.some(q => q.id === condition.questId) &&
        !completedQuests.some(q => q.id === condition.questId);
    });

    // Faction conditions
    this.registerCondition(ConditionType.FACTION_RANK, async (condition, context) => {
      const standing = await game.bobsnpc?.factions?.getStanding(context.actorUuid, condition.factionId);
      if (!standing) return false;
      return this._compareValue(standing.rank, condition.rank, condition.comparison || ">=");
    });

    this.registerCondition(ConditionType.FACTION_REPUTATION, async (condition, context) => {
      const standing = await game.bobsnpc?.factions?.getStanding(context.actorUuid, condition.factionId);
      if (!standing) return false;
      return this._compareValue(standing.reputation, condition.value, condition.comparison || ">=");
    });

    // Relationship conditions
    this.registerCondition(ConditionType.RELATIONSHIP, async (condition, context) => {
      const relationship = await game.bobsnpc?.relationships?.getRelationship(
        context.actorUuid,
        condition.npcActorUuid || context.npcActorUuid
      );
      if (!relationship) return false;
      return this._compareValue(relationship.value, condition.value, condition.comparison || ">=");
    });

    this.registerCondition(ConditionType.RELATIONSHIP_TIER, async (condition, context) => {
      const relationship = await game.bobsnpc?.relationships?.getRelationship(
        context.actorUuid,
        condition.npcActorUuid || context.npcActorUuid
      );
      if (!relationship) return false;
      return relationship.tier === condition.tier;
    });

    // Player attribute conditions
    this.registerCondition(ConditionType.PLAYER_LEVEL, async (condition, context) => {
      const actor = await fromUuid(context.actorUuid);
      const level = actor?.system?.details?.level || 0;
      return this._compareValue(level, condition.value, condition.comparison || ">=");
    });

    this.registerCondition(ConditionType.PLAYER_CLASS, async (condition, context) => {
      const actor = await fromUuid(context.actorUuid);
      const playerClass = actor?.system?.details?.class?.toLowerCase() || "";
      return condition.classes?.some(c => playerClass.includes(c.toLowerCase())) ?? false;
    });

    this.registerCondition(ConditionType.PLAYER_RACE, async (condition, context) => {
      const actor = await fromUuid(context.actorUuid);
      const race = actor?.system?.details?.race?.toLowerCase() || "";
      return condition.races?.some(r => race.includes(r.toLowerCase())) ?? false;
    });

    // Item conditions
    this.registerCondition(ConditionType.HAS_ITEM, async (condition, context) => {
      const actor = await fromUuid(context.actorUuid);
      if (!actor) return false;

      const item = actor.items.find(i =>
        i.uuid === condition.itemUuid ||
        i.name.toLowerCase() === condition.itemName?.toLowerCase()
      );

      if (!item) return false;
      const quantity = item.system?.quantity || 1;
      return quantity >= (condition.quantity || 1);
    });

    // Gold conditions
    this.registerCondition(ConditionType.HAS_GOLD, async (condition, context) => {
      const actor = await fromUuid(context.actorUuid);
      const gold = actor?.system?.currency?.gp || 0;
      return gold >= condition.amount;
    });

    // Skill check conditions
    this.registerCondition(ConditionType.SKILL_CHECK, async (condition, context) => {
      // This returns the DC for the UI to display
      // Actual roll happens when player selects this option
      return {
        requiresRoll: true,
        skill: condition.skill,
        dc: condition.dc,
        ability: condition.ability
      };
    });

    // Time conditions
    this.registerCondition(ConditionType.TIME_OF_DAY, async (condition, context) => {
      const worldTime = game.time?.worldTime || 0;
      const hour = Math.floor((worldTime / 3600) % 24);
      return hour >= condition.fromHour && hour < condition.toHour;
    });

    // Visit count conditions
    this.registerCondition(ConditionType.VISIT_COUNT, async (condition, context) => {
      const npcConfig = await this._getNPCConfig(context.npcActorUuid);
      const visitCount = npcConfig?.visitCount?.[context.actorUuid] || 0;
      return this._compareValue(visitCount, condition.count, condition.comparison || ">=");
    });

    // First visit condition
    this.registerCondition(ConditionType.FIRST_VISIT, async (condition, context) => {
      const npcConfig = await this._getNPCConfig(context.npcActorUuid);
      const visitCount = npcConfig?.visitCount?.[context.actorUuid] || 0;
      return visitCount === 0;
    });

    // Variable conditions
    this.registerCondition(ConditionType.VARIABLE, async (condition, context) => {
      const value = context.session?.variables?.[condition.variable] ??
        await this._getDialogueVariable(context.dialogueId, condition.variable);
      return this._compareValue(value, condition.value, condition.comparison || "==");
    });

    // Random chance
    this.registerCondition(ConditionType.RANDOM, async (condition, context) => {
      return Math.random() < (condition.chance || 0.5);
    });

    // Unlocked dialogue option
    this.registerCondition(ConditionType.UNLOCKED, async (condition, context) => {
      const actor = await fromUuid(context.actorUuid);
      const unlocked = getFlag(actor, STORAGE_KEYS.UNLOCKED_OPTIONS) || [];
      return unlocked.includes(condition.optionId || condition.nodeId);
    });

    // Crime/bounty conditions
    this.registerCondition(ConditionType.HAS_BOUNTY, async (condition, context) => {
      const bounty = await game.bobsnpc?.crime?.getTotalBounty(context.actorUuid);
      if (condition.regionId) {
        const regionBounty = await game.bobsnpc?.crime?.getBounty(context.actorUuid, condition.regionId);
        return (regionBounty?.amount || 0) >= (condition.minimum || 1);
      }
      return (bounty || 0) >= (condition.minimum || 1);
    });
  }

  /**
   * Register built-in action executors
   * @private
   */
  _registerBuiltInActions() {
    // Quest actions
    this.registerAction(ActionType.START_QUEST, async (action, context) => {
      const result = await game.bobsnpc?.quests?.acceptQuest(action.questId, [await fromUuid(context.actorUuid)]);
      return result?.success ?? false;
    });

    this.registerAction(ActionType.COMPLETE_QUEST, async (action, context) => {
      const actors = await Promise.all(context.session.participants.map(uuid => fromUuid(uuid)));
      const result = await game.bobsnpc?.quests?.completeQuest(action.questId, actors.filter(a => a));
      return result?.success ?? false;
    });

    this.registerAction(ActionType.FAIL_QUEST, async (action, context) => {
      const result = await game.bobsnpc?.quests?.failQuest(action.questId, action.reason);
      return result?.success ?? false;
    });

    this.registerAction(ActionType.UPDATE_OBJECTIVE, async (action, context) => {
      await game.bobsnpc?.quests?.updateObjective(action.questId, action.objectiveId, action.updates);
      return true;
    });

    // Faction actions
    this.registerAction(ActionType.MODIFY_REPUTATION, async (action, context) => {
      for (const actorUuid of context.session.participants) {
        await game.bobsnpc?.factions?.modifyReputation(actorUuid, action.factionId, action.amount);
      }
      return true;
    });

    // Relationship actions
    this.registerAction(ActionType.MODIFY_RELATIONSHIP, async (action, context) => {
      for (const actorUuid of context.session.participants) {
        await game.bobsnpc?.relationships?.modifyRelationship(
          actorUuid,
          action.npcActorUuid || context.npcActorUuid,
          action.amount,
          { type: "dialogue", sourceId: context.dialogueId }
        );
      }
      return true;
    });

    // Item actions
    this.registerAction(ActionType.GIVE_ITEM, async (action, context) => {
      for (const actorUuid of context.session.participants) {
        const actor = await fromUuid(actorUuid);
        if (actor) {
          const item = await fromUuid(action.itemUuid);
          if (item) {
            const itemData = item.toObject();
            itemData.system.quantity = action.quantity || 1;
            await actor.createEmbeddedDocuments("Item", [itemData]);
          }
        }
      }
      return true;
    });

    this.registerAction(ActionType.TAKE_ITEM, async (action, context) => {
      for (const actorUuid of context.session.participants) {
        const actor = await fromUuid(actorUuid);
        if (actor) {
          const item = actor.items.find(i =>
            i.uuid === action.itemUuid || i.name === action.itemName
          );
          if (item) {
            const currentQty = item.system?.quantity || 1;
            const takeQty = action.quantity || 1;
            if (currentQty <= takeQty) {
              await item.delete();
            } else {
              await item.update({ "system.quantity": currentQty - takeQty });
            }
          }
        }
      }
      return true;
    });

    // Gold actions
    this.registerAction(ActionType.GIVE_GOLD, async (action, context) => {
      for (const actorUuid of context.session.participants) {
        const actor = await fromUuid(actorUuid);
        if (actor) {
          const currentGold = actor.system?.currency?.gp || 0;
          await actor.update({ "system.currency.gp": currentGold + action.amount });
        }
      }
      return true;
    });

    this.registerAction(ActionType.TAKE_GOLD, async (action, context) => {
      for (const actorUuid of context.session.participants) {
        const actor = await fromUuid(actorUuid);
        if (actor) {
          const currentGold = actor.system?.currency?.gp || 0;
          await actor.update({ "system.currency.gp": Math.max(0, currentGold - action.amount) });
        }
      }
      return true;
    });

    // XP actions
    this.registerAction(ActionType.GIVE_XP, async (action, context) => {
      for (const actorUuid of context.session.participants) {
        const actor = await fromUuid(actorUuid);
        if (actor) {
          const currentXP = actor.system?.details?.xp?.value || 0;
          await actor.update({ "system.details.xp.value": currentXP + action.amount });
        }
      }
      return true;
    });

    // Variable actions
    this.registerAction(ActionType.SET_VARIABLE, async (action, context) => {
      if (action.scope === "session") {
        context.session.variables[action.variable] = action.value;
      } else {
        await this._setDialogueVariable(context.dialogueId, action.variable, action.value);
      }
      return true;
    });

    // Unlock dialogue option
    this.registerAction(ActionType.UNLOCK_DIALOGUE, async (action, context) => {
      for (const actorUuid of context.session.participants) {
        const actor = await fromUuid(actorUuid);
        if (actor) {
          const unlocked = getFlag(actor, STORAGE_KEYS.UNLOCKED_OPTIONS) || [];
          if (!unlocked.includes(action.optionId)) {
            await setFlag(actor, STORAGE_KEYS.UNLOCKED_OPTIONS, [...unlocked, action.optionId]);
          }
        }
      }
      return true;
    });

    // Open shop
    this.registerAction(ActionType.OPEN_SHOP, async (action, context) => {
      Hooks.callAll("bobsNPCOpenShop", context.npcActorUuid, action.shopId);
      return true;
    });

    // Open bank
    this.registerAction(ActionType.OPEN_BANK, async (action, context) => {
      Hooks.callAll("bobsNPCOpenBank", context.npcActorUuid, action.bankId);
      return true;
    });

    // Play sound
    this.registerAction(ActionType.PLAY_SOUND, async (action, context) => {
      if (game.settings.get(MODULE_ID, "soundEffectsEnabled")) {
        AudioHelper.play({ src: action.soundPath, volume: action.volume || 0.8 }, true);
      }
      return true;
    });

    // Run macro
    this.registerAction(ActionType.RUN_MACRO, async (action, context) => {
      const macro = game.macros.get(action.macroId) || game.macros.getName(action.macroName);
      if (macro) {
        await macro.execute({ dialogueContext: context });
      }
      return true;
    });

    // End dialogue
    this.registerAction(ActionType.END_DIALOGUE, async (action, context) => {
      await this.endDialogue(context.session.id);
      return true;
    });

    // Combat
    this.registerAction(ActionType.START_COMBAT, async (action, context) => {
      const npc = await fromUuid(context.npcActorUuid);
      if (npc) {
        const combat = await Combat.create({});
        const npcToken = canvas.tokens.placeables.find(t => t.actor?.uuid === context.npcActorUuid);
        if (npcToken) {
          await combat.createEmbeddedDocuments("Combatant", [{ tokenId: npcToken.id }]);
        }

        for (const actorUuid of context.session.participants) {
          const playerToken = canvas.tokens.placeables.find(t => t.actor?.uuid === actorUuid);
          if (playerToken) {
            await combat.createEmbeddedDocuments("Combatant", [{ tokenId: playerToken.id }]);
          }
        }

        await combat.startCombat();
      }
      return true;
    });
  }

  /**
   * Register socket handlers
   * @private
   */
  _registerSocketHandlers() {
    game.socket?.on(`module.${MODULE_ID}`, async (data) => {
      if (!data.type?.startsWith("dialogue.")) return;

      const event = data.type.replace("dialogue.", "");

      switch (event) {
        case "sessionStarted":
          this._onRemoteSessionStarted(data.data);
          break;
        case "nodeChanged":
          this._onRemoteNodeChanged(data.data);
          break;
        case "responseSelected":
          this._onRemoteResponseSelected(data.data);
          break;
        case "sessionEnded":
          this._onRemoteSessionEnded(data.data);
          break;
        case "voteSubmitted":
          this._onRemoteVoteSubmitted(data.data);
          break;
      }
    });
  }

  // ==================== DIALOGUE STORAGE ====================

  /**
   * Load dialogues from storage
   * @private
   */
  async _loadDialogues() {
    const worldData = game.settings.get(MODULE_ID, "worldData") || {};
    const dialogues = worldData.dialogues || {};

    this._dialogueCache.clear();
    for (const [id, dialogueData] of Object.entries(dialogues)) {
      this._dialogueCache.set(id, createDialogue(dialogueData));
    }
  }

  /**
   * Save dialogues to storage
   * @private
   */
  async _saveDialogues() {
    const worldData = game.settings.get(MODULE_ID, "worldData") || {};
    worldData.dialogues = Object.fromEntries(this._dialogueCache);
    await game.settings.set(MODULE_ID, "worldData", worldData);
  }

  /**
   * Get a dialogue by ID
   * @param {string} dialogueId - Dialogue ID
   * @returns {object|null}
   */
  getDialogue(dialogueId) {
    return this._dialogueCache.get(dialogueId) || null;
  }

  /**
   * Get all dialogues
   * @returns {object[]}
   */
  getAllDialogues() {
    return Array.from(this._dialogueCache.values());
  }

  // ==================== DIALOGUE CRUD ====================

  /**
   * Create a new dialogue
   * @param {object} data - Dialogue data
   * @returns {object}
   */
  async createDialogue(data) {
    const dialogue = createDialogue({
      ...data,
      id: data.id || generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    this._dialogueCache.set(dialogue.id, dialogue);
    await this._saveDialogues();

    Hooks.callAll("bobsNPCDialogueCreated", dialogue);

    return dialogue;
  }

  /**
   * Update a dialogue
   * @param {string} dialogueId - Dialogue ID
   * @param {object} updates - Updates to apply
   * @returns {object|null}
   */
  async updateDialogue(dialogueId, updates) {
    const dialogue = this.getDialogue(dialogueId);
    if (!dialogue) return null;

    const updatedDialogue = {
      ...dialogue,
      ...updates,
      id: dialogueId,
      updatedAt: Date.now()
    };

    this._dialogueCache.set(dialogueId, updatedDialogue);
    await this._saveDialogues();

    Hooks.callAll("bobsNPCDialogueUpdated", updatedDialogue);

    return updatedDialogue;
  }

  /**
   * Delete a dialogue
   * @param {string} dialogueId - Dialogue ID
   * @returns {boolean}
   */
  async deleteDialogue(dialogueId) {
    const dialogue = this.getDialogue(dialogueId);
    if (!dialogue) return false;

    this._dialogueCache.delete(dialogueId);
    await this._saveDialogues();

    Hooks.callAll("bobsNPCDialogueDeleted", dialogueId);

    return true;
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Start a new dialogue session
   * @param {string} dialogueId - Dialogue ID
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {string[]} participantUuids - Player actor UUIDs
   * @param {object} options - Additional options
   * @returns {object} {success, session, message}
   */
  async startDialogue(dialogueId, npcActorUuid, participantUuids, options = {}) {
    const dialogue = this.getDialogue(dialogueId);
    if (!dialogue) {
      return { success: false, session: null, message: localize("BOBSNPC.DialogueNotFound") };
    }

    // Create session
    const session = new DialogueSession({
      dialogueId,
      npcActorUuid,
      participants: participantUuids,
      votingEnabled: options.votingEnabled ?? game.settings.get(MODULE_ID, "dialogueVoting"),
      currentNodeId: dialogue.startNodeId
    });

    this._activeSessions.set(session.id, session);

    // Record visit
    await this._recordVisit(npcActorUuid, participantUuids[0]);

    // Get first node
    const startNode = await this.getNode(dialogueId, dialogue.startNodeId);

    // Execute entry actions for start node
    if (startNode?.onEnter?.length > 0) {
      await this._executeActions(startNode.onEnter, this._createContext(session));
    }

    // Broadcast to other clients
    this._emitSocket("sessionStarted", {
      sessionId: session.id,
      dialogueId,
      npcActorUuid,
      participants: participantUuids,
      currentNodeId: dialogue.startNodeId
    });

    Hooks.callAll("bobsNPCDialogueStarted", session, dialogue);

    return {
      success: true,
      session,
      node: startNode,
      message: null
    };
  }

  /**
   * Get current session for a participant
   * @param {string} actorUuid - Player actor UUID
   * @returns {DialogueSession|null}
   */
  getActiveSession(actorUuid) {
    for (const session of this._activeSessions.values()) {
      if (session.participants.includes(actorUuid)) {
        return session;
      }
    }
    return null;
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {DialogueSession|null}
   */
  getSession(sessionId) {
    return this._activeSessions.get(sessionId) || null;
  }

  /**
   * End a dialogue session
   * @param {string} sessionId - Session ID
   * @returns {boolean}
   */
  async endDialogue(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return false;

    // Execute exit actions for current node
    const currentNode = await this.getNode(session.dialogueId, session.currentNodeId);
    if (currentNode?.onExit?.length > 0) {
      await this._executeActions(currentNode.onExit, this._createContext(session));
    }

    this._activeSessions.delete(sessionId);

    // Broadcast
    this._emitSocket("sessionEnded", { sessionId });

    Hooks.callAll("bobsNPCDialogueEnded", session);

    return true;
  }

  // ==================== NODE NAVIGATION ====================

  /**
   * Get a dialogue node
   * @param {string} dialogueId - Dialogue ID
   * @param {string} nodeId - Node ID
   * @returns {object|null}
   */
  async getNode(dialogueId, nodeId) {
    const dialogue = this.getDialogue(dialogueId);
    if (!dialogue) return null;

    return dialogue.nodes.find(n => n.id === nodeId) || null;
  }

  /**
   * Get available responses for current node
   * @param {string} sessionId - Session ID
   * @returns {object[]} Available responses with visibility info
   */
  async getAvailableResponses(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return [];

    const node = await this.getNode(session.dialogueId, session.currentNodeId);
    if (!node) return [];

    const context = this._createContext(session);
    const responses = [];

    for (const response of node.responses) {
      const availability = await this._evaluateResponseConditions(response, context);
      responses.push({
        ...response,
        available: availability.available,
        visible: availability.visible,
        reason: availability.reason,
        rollRequired: availability.rollRequired
      });
    }

    return responses;
  }

  /**
   * Select a response and navigate to next node
   * @param {string} sessionId - Session ID
   * @param {string} responseId - Response ID
   * @param {object} rollResult - Optional roll result for skill checks
   * @returns {object} {success, node, message}
   */
  async selectResponse(sessionId, responseId, rollResult = null) {
    const session = this.getSession(sessionId);
    if (!session) {
      return { success: false, node: null, message: localize("BOBSNPC.SessionNotFound") };
    }

    const currentNode = await this.getNode(session.dialogueId, session.currentNodeId);
    if (!currentNode) {
      return { success: false, node: null, message: localize("BOBSNPC.NodeNotFound") };
    }

    const response = currentNode.responses.find(r => r.id === responseId);
    if (!response) {
      return { success: false, node: null, message: localize("BOBSNPC.ResponseNotFound") };
    }

    const context = this._createContext(session);

    // Check conditions
    const availability = await this._evaluateResponseConditions(response, context);
    if (!availability.available) {
      return { success: false, node: null, message: availability.reason };
    }

    // Handle skill check if required
    if (availability.rollRequired && !rollResult) {
      return {
        success: false,
        node: null,
        message: localize("BOBSNPC.RollRequired"),
        rollRequired: availability.rollRequired
      };
    }

    // Determine next node based on roll result
    let nextNodeId = response.nextNodeId;
    if (rollResult && response.onFailNodeId) {
      if (!rollResult.success) {
        nextNodeId = response.onFailNodeId;
      }
    }

    // Execute response actions
    if (response.actions?.length > 0) {
      await this._executeActions(response.actions, context);
    }

    // Execute exit actions for current node
    if (currentNode.onExit?.length > 0) {
      await this._executeActions(currentNode.onExit, context);
    }

    // Record choice
    session.choices.push({
      nodeId: session.currentNodeId,
      responseId,
      timestamp: Date.now(),
      rollResult
    });

    // Navigate to next node
    if (nextNodeId) {
      session.visitedNodes.push(session.currentNodeId);
      session.currentNodeId = nextNodeId;
      session.lastActivity = Date.now();

      const nextNode = await this.getNode(session.dialogueId, nextNodeId);

      // Execute entry actions for next node
      if (nextNode?.onEnter?.length > 0) {
        await this._executeActions(nextNode.onEnter, context);
      }

      // Check for auto-end nodes
      if (nextNode?.type === NodeType.END) {
        await this.endDialogue(sessionId);
      }

      // Broadcast
      this._emitSocket("responseSelected", {
        sessionId,
        responseId,
        nextNodeId,
        rollResult
      });

      Hooks.callAll("bobsNPCResponseSelected", session, response, nextNode);

      return { success: true, node: nextNode, message: null };
    } else {
      // No next node - end dialogue
      await this.endDialogue(sessionId);
      return { success: true, node: null, message: localize("BOBSNPC.DialogueEnded") };
    }
  }

  // ==================== VOTING ====================

  /**
   * Submit a vote for a response (multiplayer)
   * @param {string} sessionId - Session ID
   * @param {string} responseId - Response ID
   * @param {string} actorUuid - Voting actor UUID
   */
  async submitVote(sessionId, responseId, actorUuid) {
    const session = this.getSession(sessionId);
    if (!session || !session.votingEnabled) return;

    // Remove previous vote from this actor
    for (const [respId, voters] of Object.entries(session.currentVotes)) {
      session.currentVotes[respId] = voters.filter(uuid => uuid !== actorUuid);
    }

    // Add new vote
    if (!session.currentVotes[responseId]) {
      session.currentVotes[responseId] = [];
    }
    session.currentVotes[responseId].push(actorUuid);

    // Broadcast
    this._emitSocket("voteSubmitted", {
      sessionId,
      responseId,
      actorUuid,
      votes: session.currentVotes
    });

    // Check if all participants have voted
    const totalVotes = Object.values(session.currentVotes).flat().length;
    if (totalVotes >= session.participants.length) {
      // Determine winner
      const winner = this._determineVoteWinner(session.currentVotes);
      if (winner) {
        await this.selectResponse(sessionId, winner);
      }
    }
  }

  /**
   * Determine voting winner
   * @param {object} votes - Vote counts
   * @returns {string|null} Winning response ID
   * @private
   */
  _determineVoteWinner(votes) {
    let maxVotes = 0;
    let winners = [];

    for (const [responseId, voters] of Object.entries(votes)) {
      if (voters.length > maxVotes) {
        maxVotes = voters.length;
        winners = [responseId];
      } else if (voters.length === maxVotes) {
        winners.push(responseId);
      }
    }

    // Random tiebreaker
    if (winners.length > 1) {
      return winners[Math.floor(Math.random() * winners.length)];
    }

    return winners[0] || null;
  }

  // ==================== CONDITION EVALUATION ====================

  /**
   * Register a custom condition evaluator
   * @param {string} type - Condition type
   * @param {Function} evaluator - Evaluator function
   */
  registerCondition(type, evaluator) {
    this._conditionEvaluators.set(type, evaluator);
  }

  /**
   * Evaluate a single condition
   * @param {object} condition - Condition data
   * @param {object} context - Evaluation context
   * @returns {Promise<boolean|object>}
   */
  async evaluateCondition(condition, context) {
    const evaluator = this._conditionEvaluators.get(condition.type);
    if (!evaluator) {
      console.warn(`${MODULE_ID} | Unknown condition type: ${condition.type}`);
      return true;  // Unknown conditions pass by default
    }

    try {
      return await evaluator(condition, context);
    } catch (error) {
      console.error(`${MODULE_ID} | Error evaluating condition:`, error);
      return false;
    }
  }

  /**
   * Evaluate all conditions for a response
   * @param {object} response - Response data
   * @param {object} context - Evaluation context
   * @returns {object} {available, visible, reason, rollRequired}
   * @private
   */
  async _evaluateResponseConditions(response, context) {
    // Check if already selected (for once-only responses)
    if (response.onceOnly && context.session.choices.some(c => c.responseId === response.id)) {
      return { available: false, visible: false, reason: "Already selected" };
    }

    // Evaluate conditions
    let available = true;
    let visible = true;
    let reason = null;
    let rollRequired = null;

    for (const condition of response.conditions || []) {
      const result = await this.evaluateCondition(condition, context);

      // Handle skill check conditions specially
      if (result && typeof result === "object" && result.requiresRoll) {
        rollRequired = result;
        continue;
      }

      if (!result) {
        available = false;

        // Determine visibility based on condition settings
        if (condition.hideIfFailed) {
          visible = false;
        }

        reason = condition.failMessage || localize("BOBSNPC.ConditionNotMet");
        break;
      }
    }

    return { available, visible, reason, rollRequired };
  }

  // ==================== ACTION EXECUTION ====================

  /**
   * Register a custom action executor
   * @param {string} type - Action type
   * @param {Function} executor - Executor function
   */
  registerAction(type, executor) {
    this._actionExecutors.set(type, executor);
  }

  /**
   * Execute an array of actions
   * @param {object[]} actions - Actions to execute
   * @param {object} context - Execution context
   * @private
   */
  async _executeActions(actions, context) {
    for (const action of actions) {
      const executor = this._actionExecutors.get(action.type);
      if (!executor) {
        console.warn(`${MODULE_ID} | Unknown action type: ${action.type}`);
        continue;
      }

      try {
        await executor(action, context);
      } catch (error) {
        console.error(`${MODULE_ID} | Error executing action:`, error);
      }
    }
  }

  // ==================== HELPERS ====================

  /**
   * Create context object for condition/action evaluation
   * @param {DialogueSession} session - Dialogue session
   * @returns {object}
   * @private
   */
  _createContext(session) {
    return {
      session,
      dialogueId: session.dialogueId,
      npcActorUuid: session.npcActorUuid,
      actorUuid: session.participants[0],  // Primary participant
      participants: session.participants
    };
  }

  /**
   * Compare values with operator
   * @param {*} a - First value
   * @param {*} b - Second value
   * @param {string} operator - Comparison operator
   * @returns {boolean}
   * @private
   */
  _compareValue(a, b, operator) {
    switch (operator) {
      case "==": return a === b;
      case "!=": return a !== b;
      case ">": return a > b;
      case ">=": return a >= b;
      case "<": return a < b;
      case "<=": return a <= b;
      default: return a === b;
    }
  }

  /**
   * Get NPC configuration
   * @param {string} npcActorUuid - NPC actor UUID
   * @returns {object|null}
   * @private
   */
  async _getNPCConfig(npcActorUuid) {
    const actor = await fromUuid(npcActorUuid);
    return getFlag(actor, "config") || null;
  }

  /**
   * Record NPC visit
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {string} playerActorUuid - Player actor UUID
   * @private
   */
  async _recordVisit(npcActorUuid, playerActorUuid) {
    const actor = await fromUuid(npcActorUuid);
    if (!actor) return;

    const config = getFlag(actor, "config") || {};
    config.visitCount = config.visitCount || {};
    config.lastVisit = config.lastVisit || {};

    config.visitCount[playerActorUuid] = (config.visitCount[playerActorUuid] || 0) + 1;
    config.lastVisit[playerActorUuid] = Date.now();

    await setFlag(actor, "config", config);
  }

  /**
   * Get dialogue variable
   * @param {string} dialogueId - Dialogue ID
   * @param {string} variable - Variable name
   * @returns {*}
   * @private
   */
  async _getDialogueVariable(dialogueId, variable) {
    const worldData = game.settings.get(MODULE_ID, "worldData") || {};
    return worldData.dialogueVariables?.[dialogueId]?.[variable];
  }

  /**
   * Set dialogue variable
   * @param {string} dialogueId - Dialogue ID
   * @param {string} variable - Variable name
   * @param {*} value - Value to set
   * @private
   */
  async _setDialogueVariable(dialogueId, variable, value) {
    const worldData = game.settings.get(MODULE_ID, "worldData") || {};
    worldData.dialogueVariables = worldData.dialogueVariables || {};
    worldData.dialogueVariables[dialogueId] = worldData.dialogueVariables[dialogueId] || {};
    worldData.dialogueVariables[dialogueId][variable] = value;
    await game.settings.set(MODULE_ID, "worldData", worldData);
  }

  // ==================== SOCKET HANDLERS ====================

  /**
   * Handle remote session started
   * @private
   */
  _onRemoteSessionStarted(data) {
    if (!this._activeSessions.has(data.sessionId)) {
      const session = new DialogueSession({
        id: data.sessionId,
        dialogueId: data.dialogueId,
        npcActorUuid: data.npcActorUuid,
        participants: data.participants,
        currentNodeId: data.currentNodeId
      });
      this._activeSessions.set(data.sessionId, session);
    }

    Hooks.callAll("bobsNPCRemoteDialogueStarted", data);
  }

  /**
   * Handle remote node change
   * @private
   */
  _onRemoteNodeChanged(data) {
    const session = this.getSession(data.sessionId);
    if (session) {
      session.currentNodeId = data.nodeId;
    }

    Hooks.callAll("bobsNPCRemoteNodeChanged", data);
  }

  /**
   * Handle remote response selection
   * @private
   */
  _onRemoteResponseSelected(data) {
    const session = this.getSession(data.sessionId);
    if (session) {
      session.visitedNodes.push(session.currentNodeId);
      session.currentNodeId = data.nextNodeId;
      session.choices.push({
        responseId: data.responseId,
        timestamp: Date.now()
      });
    }

    Hooks.callAll("bobsNPCRemoteResponseSelected", data);
  }

  /**
   * Handle remote session ended
   * @private
   */
  _onRemoteSessionEnded(data) {
    this._activeSessions.delete(data.sessionId);
    Hooks.callAll("bobsNPCRemoteDialogueEnded", data);
  }

  /**
   * Handle remote vote submitted
   * @private
   */
  _onRemoteVoteSubmitted(data) {
    const session = this.getSession(data.sessionId);
    if (session) {
      session.currentVotes = data.votes;
    }

    Hooks.callAll("bobsNPCRemoteVoteSubmitted", data);
  }

  /**
   * Emit socket event
   * @param {string} event - Event name
   * @param {object} data - Event data
   * @private
   */
  _emitSocket(event, data) {
    game.socket?.emit(`module.${MODULE_ID}`, {
      type: `dialogue.${event}`,
      data
    });
  }
}

// Singleton instance
export const dialogueHandler = new DialogueHandler();
