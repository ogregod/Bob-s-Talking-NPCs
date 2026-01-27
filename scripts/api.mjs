/**
 * Bob's Talking NPCs - Public API
 * Exposes the game.bobsnpc API for external access and macro support
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";
import { emit, SocketEvents, getActiveDialogue } from "./socket.mjs";
import { getSetting } from "./settings.mjs";

// Import UI applications
import { DialogueWindow } from "./apps/dialogue-window.mjs";
import { QuestLog } from "./apps/quest-log.mjs";
import { QuestTracker } from "./apps/quest-tracker.mjs";
import { ShopWindow } from "./apps/shop-window.mjs";
import { BankWindow } from "./apps/bank-window.mjs";
import { FactionWindow } from "./apps/faction-window.mjs";
import { HirelingManager } from "./apps/hireling-manager.mjs";
import { PropertyManager } from "./apps/property-manager.mjs";
import { NPCConfig } from "./apps/npc-config.mjs";
import { GMDashboard } from "./apps/gm-dashboard.mjs";
import { TradeWindow } from "./apps/trade-window.mjs";

/**
 * Singleton instances of UI applications
 * @type {Map<string, ApplicationV2>}
 */
const appInstances = new Map();

/**
 * Main API class exposed at game.bobsnpc
 */
export class BobsNPCAPI {
  constructor() {
    // Initialize sub-APIs
    this.quests = new QuestsAPI();
    this.factions = new FactionsAPI();
    this.relationships = new RelationshipsAPI();
    this.shop = new ShopAPI();
    this.bank = new BankAPI();
    this.crime = new CrimeAPI();
    this.hirelings = new HirelingsAPI();
    this.mounts = new MountsAPI();
    this.trade = new TradeAPI();
    this.worldState = new WorldStateAPI();
    this.events = new EventsAPI();
    this.ui = new UIAPI();
    this.backup = new BackupAPI();

    // Note: handlers property is set by init.mjs after API creation
    // This allows real handler classes (QuestHandler, FactionHandler, etc.) to be used
    // instead of the placeholder sub-API classes

    console.log(`${MODULE_ID} | API initialized`);
  }

  /**
   * Start a dialogue with an NPC
   * @param {string} actorUuid - UUID of the NPC actor
   * @param {object} options - Dialogue options
   * @param {string} options.startNodeId - Override starting node
   * @param {string[]} options.participants - Player UUIDs to include
   * @returns {Promise<boolean>} Success status
   */
  async startDialogue(actorUuid, options = {}) {
    console.log(`${MODULE_ID} | Starting dialogue with ${actorUuid}`);

    const actor = await fromUuid(actorUuid);
    if (!actor) {
      console.error(`${MODULE_ID} | Actor not found: ${actorUuid}`);
      return false;
    }

    const config = actor.getFlag(MODULE_ID, "config");
    if (!config?.dialogueId) {
      console.warn(`${MODULE_ID} | No dialogue configured for ${actor.name}`);
      return false;
    }

    // Emit dialogue start event
    emit(SocketEvents.DIALOGUE_START, {
      npcUuid: actorUuid,
      nodeId: options.startNodeId || config.startNodeId,
      participants: options.participants || [game.user.character?.uuid].filter(Boolean)
    });

    // Open dialogue window - to be implemented
    Hooks.call(`${MODULE_ID}.openDialogueWindow`, { actorUuid, config });

    return true;
  }

  /**
   * End the current dialogue with an NPC
   * @param {string} actorUuid - UUID of the NPC actor
   */
  async endDialogue(actorUuid) {
    console.log(`${MODULE_ID} | Ending dialogue with ${actorUuid}`);

    emit(SocketEvents.DIALOGUE_END, {
      npcUuid: actorUuid,
      reason: "player_ended"
    });
  }

  /**
   * Get the active dialogue state for an NPC
   * @param {string} actorUuid - UUID of the NPC actor
   * @returns {object|null} Dialogue state or null
   */
  getActiveDialogue(actorUuid) {
    return getActiveDialogue(actorUuid);
  }

  /**
   * Export module data
   * @param {string} type - Export type: "npc", "quest", "faction", "pack", "world"
   * @param {string} id - Specific ID to export (optional for "pack" and "world")
   * @returns {Promise<object>} Exported data
   */
  async export(type, id = null) {
    console.log(`${MODULE_ID} | Exporting ${type}${id ? `: ${id}` : ""}`);

    const exportData = {
      moduleId: MODULE_ID,
      version: game.modules.get(MODULE_ID)?.version,
      exportType: type,
      exportDate: new Date().toISOString(),
      data: {}
    };

    switch (type) {
      case "npc":
        if (!id) throw new Error("NPC UUID required for export");
        exportData.data = await this._exportNPC(id);
        break;
      case "quest":
        if (!id) throw new Error("Quest ID required for export");
        exportData.data = await this._exportQuest(id);
        break;
      case "faction":
        if (!id) throw new Error("Faction ID required for export");
        exportData.data = await this._exportFaction(id);
        break;
      case "pack":
        exportData.data = await this._exportPack(id);
        break;
      case "world":
        exportData.data = await this._exportWorld();
        break;
      default:
        throw new Error(`Unknown export type: ${type}`);
    }

    return exportData;
  }

  /**
   * Import module data
   * @param {object} data - Data to import (from export)
   * @param {object} options - Import options
   * @param {string} options.conflictResolution - "replace", "skip", "rename"
   * @returns {Promise<object>} Import results
   */
  async import(data, options = { conflictResolution: "skip" }) {
    console.log(`${MODULE_ID} | Importing ${data.exportType} data`);

    if (data.moduleId !== MODULE_ID) {
      throw new Error("Invalid import data: wrong module ID");
    }

    // Validate and import based on type
    const results = {
      success: [],
      skipped: [],
      errors: []
    };

    // Implementation placeholder
    console.log(`${MODULE_ID} | Import complete`, results);
    return results;
  }

  // Private export methods (placeholders)
  async _exportNPC(uuid) { return {}; }
  async _exportQuest(id) { return {}; }
  async _exportFaction(id) { return {}; }
  async _exportPack(filter) { return {}; }
  async _exportWorld() { return {}; }
}

/**
 * Quests API - Delegates to quest-handler
 */
class QuestsAPI {
  /** @returns {object|null} Quest handler instance */
  get #handler() {
    return game.bobsnpc?.handlers?.quest;
  }

  /**
   * Get a quest by ID
   * @param {string} questId
   * @returns {object|null}
   */
  get(questId) {
    return this.#handler?.getQuest(questId) || null;
  }

  /**
   * Alias for get() - used by quest-log.mjs
   * @param {string} questId
   * @returns {object|null}
   */
  getQuest(questId) {
    return this.get(questId);
  }

  /**
   * Get all quests matching filter
   * @param {object} filter
   * @param {string} filter.status - Filter by status
   * @param {string} filter.category - Filter by category
   * @param {string} filter.giver - Filter by giver UUID
   * @returns {object[]}
   */
  getAll(filter = {}) {
    const quests = this.#handler?.getAllQuests() || [];
    if (!filter || Object.keys(filter).length === 0) return quests;

    return quests.filter(q => {
      if (filter.status && q.status !== filter.status) return false;
      if (filter.category && q.category !== filter.category) return false;
      if (filter.giver && q.giverId !== filter.giver) return false;
      return true;
    });
  }

  /**
   * Get all quests for the party
   * @returns {object[]}
   */
  getPartyQuests() {
    return this.#handler?.getPartyQuests() || [];
  }

  /**
   * Abandon a quest
   * @param {string} questId
   * @param {string} actorUuid
   * @returns {Promise<boolean>}
   */
  async abandonQuest(questId, actorUuid) {
    return this.abandon(questId, actorUuid);
  }

  /**
   * Create a new quest
   * @param {object} questData
   * @returns {Promise<object>}
   */
  async create(questData) {
    if (!game.user.isGM) {
      throw new Error("Only GM can create quests");
    }
    return this.#handler?.createQuest(questData) || null;
  }

  /**
   * Update a quest
   * @param {string} questId
   * @param {object} updates
   * @returns {Promise<object>}
   */
  async update(questId, updates) {
    if (!game.user.isGM) {
      throw new Error("Only GM can update quests");
    }
    return this.#handler?.updateQuest(questId, updates) || null;
  }

  /**
   * Delete a quest
   * @param {string} questId
   * @returns {Promise<boolean>}
   */
  async delete(questId) {
    if (!game.user.isGM) {
      throw new Error("Only GM can delete quests");
    }
    return this.#handler?.deleteQuest(questId) || false;
  }

  /**
   * Accept a quest for players
   * @param {string} questId
   * @param {string[]} playerUuids - Player actor UUIDs
   * @returns {Promise<boolean>}
   */
  async accept(questId, playerUuids = []) {
    const actors = playerUuids.map(uuid => fromUuidSync(uuid)).filter(Boolean);
    return this.#handler?.acceptQuest(questId, actors) || false;
  }

  /**
   * Complete a quest
   * @param {string} questId
   * @returns {Promise<boolean>}
   */
  async complete(questId) {
    return this.#handler?.completeQuest(questId) || false;
  }

  /**
   * Fail a quest
   * @param {string} questId
   * @param {string} reason
   * @returns {Promise<boolean>}
   */
  async fail(questId, reason) {
    return this.#handler?.failQuest(questId, reason) || false;
  }

  /**
   * Abandon a quest
   * @param {string} questId
   * @param {string} playerUuid
   * @returns {Promise<boolean>}
   */
  async abandon(questId, playerUuid) {
    if (!getSetting("allowQuestAbandonment")) {
      ui.notifications.warn(game.i18n.localize("BOBSNPC.Quest.Messages.CannotAbandon"));
      return false;
    }
    const actor = await fromUuid(playerUuid);
    return this.#handler?.abandonQuest(questId, actor) || false;
  }

  /**
   * Complete an objective
   * @param {string} questId
   * @param {string} objectiveId
   * @returns {Promise<boolean>}
   */
  async completeObjective(questId, objectiveId) {
    return this.#handler?.completeObjective(questId, objectiveId) || false;
  }

  /**
   * Get quest status
   * @param {string} questId
   * @returns {string|null}
   */
  getStatus(questId) {
    const quest = this.get(questId);
    return quest?.status || null;
  }

  /**
   * Get quests for a player
   * @param {string} playerUuid
   * @param {string} status - Optional status filter
   * @returns {object[]}
   */
  getPlayerQuests(playerUuid, status = null) {
    const actor = fromUuidSync(playerUuid);
    if (!actor) return [];
    const quests = this.#handler?.getPlayerQuests(actor) || [];
    if (!status) return quests;
    return quests.filter(q => q.status === status);
  }
}

/**
 * Factions API - Delegates to faction-handler
 */
class FactionsAPI {
  /** @returns {object|null} Faction handler instance */
  get #handler() {
    return game.bobsnpc?.handlers?.faction;
  }

  /**
   * Get a faction by ID
   * @param {string} factionId
   * @returns {object|null}
   */
  get(factionId) {
    return this.#handler?.getFaction(factionId) || null;
  }

  /**
   * Get all factions
   * @returns {object[]}
   */
  getAll() {
    return this.#handler?.getAllFactions() || [];
  }

  /**
   * Alias for getAll() - used by faction-window.mjs
   * @returns {object[]}
   */
  getAllFactions() {
    return this.getAll();
  }

  /**
   * Create a new faction
   * @param {object} factionData
   * @returns {Promise<object>}
   */
  async create(factionData) {
    if (!game.user.isGM) {
      throw new Error("Only GM can create factions");
    }
    return this.#handler?.createFaction(factionData) || null;
  }

  /**
   * Update a faction
   * @param {string} factionId
   * @param {object} updates
   * @returns {Promise<object>}
   */
  async update(factionId, updates) {
    if (!game.user.isGM) {
      throw new Error("Only GM can update factions");
    }
    return this.#handler?.updateFaction(factionId, updates) || null;
  }

  /**
   * Delete a faction
   * @param {string} factionId
   * @returns {Promise<boolean>}
   */
  async delete(factionId) {
    if (!game.user.isGM) {
      throw new Error("Only GM can delete factions");
    }
    return this.#handler?.deleteFaction(factionId) || false;
  }

  /**
   * Modify reputation with a faction
   * @param {string} factionId
   * @param {string} playerUuid
   * @param {number} amount
   * @returns {Promise<boolean>}
   */
  async modifyReputation(factionId, playerUuid, amount) {
    const actor = await fromUuid(playerUuid);
    if (!actor) return false;
    return this.#handler?.modifyReputation(factionId, actor, amount) || false;
  }

  /**
   * Get player reputation with a faction
   * @param {string} actorUuid
   * @param {string} factionId
   * @returns {number}
   */
  getReputation(actorUuid, factionId) {
    const actor = fromUuidSync(actorUuid);
    if (!actor) return 0;
    return this.#handler?.getReputation(factionId, actor) || 0;
  }

  /**
   * Get player rank in a faction
   * @param {string} actorUuid
   * @param {string} factionId
   * @returns {object|null}
   */
  getRank(actorUuid, factionId) {
    const actor = fromUuidSync(actorUuid);
    if (!actor) return null;
    return this.#handler?.getRank(factionId, actor) || null;
  }

  /**
   * Get reputation level string from numeric value
   * @param {number} reputation - Reputation value
   * @returns {string} Level string
   */
  getReputationLevel(reputation) {
    return this.#handler?.getReputationLevel(reputation) || "neutral";
  }

  /**
   * Get NPCs belonging to a faction
   * @param {string} factionId
   * @returns {Promise<object[]>}
   */
  async getFactionNPCs(factionId) {
    return this.#handler?.getFactionNPCs(factionId) || [];
  }

  /**
   * Set a player's rank in a faction
   * @param {string} factionId
   * @param {string} playerUuid
   * @param {string} rankId
   * @returns {Promise<boolean>}
   */
  async setRank(factionId, playerUuid, rankId) {
    if (!game.user.isGM) {
      throw new Error("Only GM can set faction ranks");
    }
    const actor = await fromUuid(playerUuid);
    if (!actor) return false;
    return this.#handler?.setRank(factionId, actor, rankId) || false;
  }
}

/**
 * Relationships API - Delegates to relationship-handler
 */
class RelationshipsAPI {
  /** @returns {object|null} Relationship handler instance */
  get #handler() {
    return game.bobsnpc?.handlers?.relationship;
  }

  /**
   * Get relationship value between NPC and player
   * @param {string} npcUuid
   * @param {string} playerUuid
   * @returns {number} Value from -100 to 100
   */
  get(npcUuid, playerUuid) {
    const npc = fromUuidSync(npcUuid);
    const player = fromUuidSync(playerUuid);
    if (!npc || !player) return 0;
    return this.#handler?.getRelationship(npc, player)?.value || 0;
  }

  /**
   * Modify relationship value
   * @param {string} npcUuid
   * @param {string} playerUuid
   * @param {number} amount
   * @returns {Promise<boolean>}
   */
  async modify(npcUuid, playerUuid, amount) {
    const npc = await fromUuid(npcUuid);
    const player = await fromUuid(playerUuid);
    if (!npc || !player) return false;
    return this.#handler?.modifyRelationship(npc, player, amount) || false;
  }

  /**
   * Set relationship to specific value
   * @param {string} npcUuid
   * @param {string} playerUuid
   * @param {number} value
   * @returns {Promise<boolean>}
   */
  async set(npcUuid, playerUuid, value) {
    const npc = await fromUuid(npcUuid);
    const player = await fromUuid(playerUuid);
    if (!npc || !player) return false;
    const clamped = Math.max(-100, Math.min(100, value));
    return this.#handler?.setRelationship(npc, player, clamped) || false;
  }

  /**
   * Get relationship tier name
   * @param {string} npcUuid
   * @param {string} playerUuid
   * @returns {string}
   */
  getTier(npcUuid, playerUuid) {
    const npc = fromUuidSync(npcUuid);
    const player = fromUuidSync(playerUuid);
    if (!npc || !player) return "neutral";
    return this.#handler?.getRelationshipTier(npc, player) || "neutral";
  }

  /**
   * Get all relationships for a player
   * @param {string} playerUuid
   * @returns {object[]}
   */
  getAllForPlayer(playerUuid) {
    const player = fromUuidSync(playerUuid);
    if (!player) return [];
    return this.#handler?.getPlayerRelationships(player) || [];
  }
}

/**
 * Shop API - Delegates to merchant-handler
 */
class ShopAPI {
  /** @returns {object|null} Merchant handler instance */
  get #handler() {
    return game.bobsnpc?.handlers?.merchant;
  }

  /**
   * Open a shop session
   * @param {string} npcUuid
   * @param {string} playerUuid
   * @returns {Promise<string>} Session ID
   */
  async open(npcUuid, playerUuid = null) {
    const merchant = await fromUuid(npcUuid);
    const customer = playerUuid ? await fromUuid(playerUuid) : game.user.character;
    if (!merchant) return null;
    return this.#handler?.openShop(merchant, customer) || null;
  }

  /**
   * Close a shop session
   * @param {string} sessionId
   * @returns {Promise<boolean>}
   */
  async close(sessionId) {
    return this.#handler?.closeShop(sessionId) || false;
  }

  /**
   * Get shop inventory
   * @param {string} npcUuid
   * @returns {object[]}
   */
  getInventory(npcUuid) {
    const merchant = fromUuidSync(npcUuid);
    if (!merchant) return [];
    return this.#handler?.getInventory(merchant) || [];
  }

  /**
   * Purchase items from a shop
   * @param {string} sessionId
   * @param {object[]} items - Items to buy [{itemId, quantity}]
   * @returns {Promise<object>}
   */
  async buy(sessionId, items) {
    return this.#handler?.purchaseItems(sessionId, items) || { success: false };
  }

  /**
   * Sell items to a shop
   * @param {string} sessionId
   * @param {object[]} items - Items to sell [{itemId, quantity}]
   * @returns {Promise<object>}
   */
  async sell(sessionId, items) {
    return this.#handler?.sellItems(sessionId, items) || { success: false };
  }

  /**
   * Get price for an item
   * @param {string} merchantUuid
   * @param {string} customerUuid
   * @param {string} itemId
   * @param {boolean} isBuying
   * @returns {number}
   */
  getPrice(merchantUuid, customerUuid, itemId, isBuying) {
    const merchant = fromUuidSync(merchantUuid);
    const customer = fromUuidSync(customerUuid);
    if (!merchant) return 0;
    return this.#handler?.calculatePrice(merchant, customer, itemId, isBuying) || 0;
  }

  /**
   * Attempt to haggle
   * @param {string} sessionId
   * @returns {Promise<object>}
   */
  async haggle(sessionId) {
    return this.#handler?.attemptHaggle(sessionId) || { success: false };
  }
}

/**
 * Bank API - Delegates to bank-handler
 */
class BankAPI {
  /** @returns {object|null} Bank handler instance */
  get #handler() {
    return game.bobsnpc?.handlers?.bank;
  }

  /**
   * Open a bank session
   * @param {string} bankId
   * @param {string} playerUuid
   * @returns {Promise<string>} Session ID
   */
  async open(bankId, playerUuid = null) {
    const player = playerUuid ? await fromUuid(playerUuid) : game.user.character;
    if (!player) return null;
    return this.#handler?.openBank(bankId, player) || null;
  }

  /**
   * Deposit currency
   * @param {string} accountId
   * @param {number} amount - Amount in copper pieces
   * @returns {Promise<object>}
   */
  async deposit(accountId, amount) {
    return this.#handler?.deposit(accountId, amount) || { success: false };
  }

  /**
   * Withdraw currency
   * @param {string} accountId
   * @param {number} amount - Amount in copper pieces
   * @returns {Promise<object>}
   */
  async withdraw(accountId, amount) {
    return this.#handler?.withdraw(accountId, amount) || { success: false };
  }

  /**
   * Get account balance
   * @param {string} accountId
   * @returns {number} Balance in copper pieces
   */
  getBalance(accountId) {
    return this.#handler?.getBalance(accountId) || 0;
  }

  /**
   * Get player's account at a bank
   * @param {string} bankId
   * @param {string} playerUuid
   * @returns {object|null}
   */
  getAccount(bankId, playerUuid) {
    const player = fromUuidSync(playerUuid);
    if (!player) return null;
    return this.#handler?.getAccount(bankId, player) || null;
  }

  /**
   * Take a loan
   * @param {string} bankId
   * @param {string} playerUuid
   * @param {number} amount
   * @returns {Promise<object>}
   */
  async takeLoan(bankId, playerUuid, amount) {
    const player = await fromUuid(playerUuid);
    if (!player) return { success: false };
    return this.#handler?.takeLoan(bankId, player, amount) || { success: false };
  }

  /**
   * Repay a loan
   * @param {string} loanId
   * @param {number} amount
   * @returns {Promise<object>}
   */
  async repayLoan(loanId, amount) {
    return this.#handler?.repayLoan(loanId, amount) || { success: false };
  }

  /**
   * Get player's loans
   * @param {string} playerUuid
   * @returns {object[]}
   */
  getLoans(playerUuid) {
    const player = fromUuidSync(playerUuid);
    if (!player) return [];
    return this.#handler?.getPlayerLoans(player) || [];
  }
}

/**
 * Crime API - Delegates to crime-handler
 */
class CrimeAPI {
  /** @returns {object|null} Crime handler instance */
  get #handler() {
    return game.bobsnpc?.handlers?.crime;
  }

  /**
   * Add a bounty
   * @param {string} playerUuid
   * @param {string} jurisdictionId
   * @param {number} amount
   * @param {string} crime
   * @returns {Promise<boolean>}
   */
  async addBounty(playerUuid, jurisdictionId, amount, crime) {
    if (!getSetting("bountyEnabled")) return false;
    const player = await fromUuid(playerUuid);
    if (!player) return false;
    return this.#handler?.addBounty(jurisdictionId, player, amount, crime) || false;
  }

  /**
   * Get bounty for a player
   * @param {string} playerUuid
   * @param {string} jurisdictionId
   * @returns {number}
   */
  getBounty(playerUuid, jurisdictionId = null) {
    const player = fromUuidSync(playerUuid);
    if (!player) return 0;
    return this.#handler?.getBounty(jurisdictionId, player) || 0;
  }

  /**
   * Clear a bounty
   * @param {string} playerUuid
   * @param {string} jurisdictionId
   * @param {string} method - "pay", "jail", "pardon"
   * @returns {Promise<boolean>}
   */
  async clearBounty(playerUuid, jurisdictionId, method) {
    const player = await fromUuid(playerUuid);
    if (!player) return false;

    switch (method) {
      case "pay":
        return this.#handler?.payBounty(jurisdictionId, player) || false;
      case "jail":
        return this.#handler?.serveJailTime(jurisdictionId, player) || false;
      case "pardon":
        return this.#handler?.grantPardon(jurisdictionId, player) || false;
      default:
        return false;
    }
  }

  /**
   * Attempt to steal from an NPC
   * @param {string} playerUuid
   * @param {string} npcUuid
   * @param {string} itemId
   * @returns {Promise<object>}
   */
  async attemptSteal(playerUuid, npcUuid, itemId) {
    if (!getSetting("stealingEnabled")) {
      ui.notifications.warn("Stealing is disabled");
      return { success: false, reason: "disabled" };
    }
    const player = await fromUuid(playerUuid);
    const npc = await fromUuid(npcUuid);
    if (!player || !npc) return { success: false, reason: "invalid_actors" };
    return this.#handler?.attemptSteal(player, npc, itemId) || { success: false };
  }

  /**
   * Report a crime
   * @param {string} playerUuid
   * @param {string} crimeType
   * @param {object} details
   * @returns {Promise<object>}
   */
  async reportCrime(playerUuid, crimeType, details = {}) {
    const player = await fromUuid(playerUuid);
    if (!player) return { success: false };
    return this.#handler?.reportCrime(player, crimeType, details) || { success: false };
  }

  /**
   * Get criminal record
   * @param {string} playerUuid
   * @returns {object}
   */
  getCriminalRecord(playerUuid) {
    const player = fromUuidSync(playerUuid);
    if (!player) return null;
    return this.#handler?.getCriminalRecord(player) || null;
  }
}

/**
 * Hirelings API - Delegates to hireling-handler
 */
class HirelingsAPI {
  /** @returns {object|null} Hireling handler instance */
  get #handler() {
    return game.bobsnpc?.handlers?.hireling;
  }

  /**
   * Hire a hireling
   * @param {string} hirelingId
   * @param {string} employerUuid
   * @param {object} terms - Contract terms
   * @returns {Promise<object>}
   */
  async hire(hirelingId, employerUuid, terms = {}) {
    const employer = await fromUuid(employerUuid);
    if (!employer) return { success: false };
    return this.#handler?.hireHireling(hirelingId, employer, terms) || { success: false };
  }

  /**
   * Dismiss a hireling
   * @param {string} hirelingId
   * @returns {Promise<boolean>}
   */
  async dismiss(hirelingId) {
    return this.#handler?.dismissHireling(hirelingId) || false;
  }

  /**
   * Pay a hireling's wages
   * @param {string} hirelingId
   * @returns {Promise<object>}
   */
  async pay(hirelingId) {
    return this.#handler?.payWages(hirelingId) || { success: false };
  }

  /**
   * Get hireling loyalty
   * @param {string} hirelingId
   * @returns {number}
   */
  getLoyalty(hirelingId) {
    return this.#handler?.getLoyalty(hirelingId) || 0;
  }

  /**
   * Modify hireling loyalty
   * @param {string} hirelingId
   * @param {number} amount
   * @returns {Promise<boolean>}
   */
  async modifyLoyalty(hirelingId, amount) {
    return this.#handler?.modifyLoyalty(hirelingId, amount) || false;
  }

  /**
   * Get all hirelings for an employer
   * @param {string} employerUuid
   * @returns {object[]}
   */
  getHirelings(employerUuid) {
    const employer = fromUuidSync(employerUuid);
    if (!employer) return [];
    return this.#handler?.getPlayerHirelings(employer) || [];
  }

  /**
   * Get available hirelings for hire
   * @returns {object[]}
   */
  getAvailable() {
    return this.#handler?.getAvailableHirelings() || [];
  }
}

/**
 * Mounts API - Delegates to hireling-handler (mounts are managed there)
 */
class MountsAPI {
  /** @returns {object|null} Hireling handler instance (handles mounts) */
  get #handler() {
    return game.bobsnpc?.handlers?.hireling;
  }

  /**
   * Purchase a mount
   * @param {string} mountId
   * @param {string} buyerUuid
   * @returns {Promise<object>}
   */
  async purchase(mountId, buyerUuid) {
    const buyer = await fromUuid(buyerUuid);
    if (!buyer) return { success: false };
    return this.#handler?.purchaseMount(mountId, buyer) || { success: false };
  }

  /**
   * Stable a mount
   * @param {string} mountId
   * @param {string} stableId
   * @returns {Promise<object>}
   */
  async stable(mountId, stableId) {
    return this.#handler?.stableMount(mountId, stableId) || { success: false };
  }

  /**
   * Retrieve a mount from stable
   * @param {string} mountId
   * @returns {Promise<object>}
   */
  async retrieve(mountId) {
    return this.#handler?.retrieveMount(mountId) || { success: false };
  }

  /**
   * Summon a mount to a location
   * @param {string} mountId
   * @param {string} sceneId
   * @param {object} position - {x, y}
   * @returns {Promise<object>}
   */
  async summon(mountId, sceneId, position) {
    return this.#handler?.summonMount(mountId, sceneId, position) || { success: false };
  }

  /**
   * Get all mounts for an owner
   * @param {string} ownerUuid
   * @returns {object[]}
   */
  getMounts(ownerUuid) {
    const owner = fromUuidSync(ownerUuid);
    if (!owner) return [];
    return this.#handler?.getPlayerMounts(owner) || [];
  }

  /**
   * Get available stables
   * @returns {object[]}
   */
  getStables() {
    return this.#handler?.getStables() || [];
  }
}

/**
 * Trade API
 */
class TradeAPI {
  async initiate(initiatorUuid, recipientUuid) {
    const tradeId = foundry.utils.randomID(16);
    emit(SocketEvents.TRADE_REQUEST, { tradeId, initiatorUuid, recipientUuid });
    return tradeId;
  }

  async addItem(tradeId, side, itemId) {
    emit(SocketEvents.TRADE_UPDATE, { tradeId, side, type: "addItem", itemId });
    return true;
  }

  async setGold(tradeId, side, amount) {
    emit(SocketEvents.TRADE_UPDATE, { tradeId, side, type: "setGold", amount });
    return true;
  }

  async confirm(tradeId, side) {
    emit(SocketEvents.TRADE_CONFIRM, { tradeId, side });
    return true;
  }

  async cancel(tradeId) {
    emit(SocketEvents.TRADE_CANCEL, { tradeId });
    return true;
  }
}

/**
 * World State API - Uses game.settings for V13 compatibility
 */
class WorldStateAPI {
  /**
   * Get a world state variable
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    const worldState = game.settings.get(MODULE_ID, "worldState") || {};
    return worldState[key];
  }

  /**
   * Set a world state variable
   * @param {string} key
   * @param {*} value
   * @returns {Promise<*>}
   */
  async set(key, value) {
    if (!game.user.isGM) {
      throw new Error("Only GM can set world state");
    }
    const worldState = game.settings.get(MODULE_ID, "worldState") || {};
    worldState[key] = value;
    return game.settings.set(MODULE_ID, "worldState", worldState);
  }

  /**
   * Delete a world state variable
   * @param {string} key
   * @returns {Promise<*>}
   */
  async delete(key) {
    if (!game.user.isGM) {
      throw new Error("Only GM can delete world state");
    }
    const worldState = game.settings.get(MODULE_ID, "worldState") || {};
    delete worldState[key];
    return game.settings.set(MODULE_ID, "worldState", worldState);
  }

  /**
   * Get all world state
   * @returns {object}
   */
  getAll() {
    return game.settings.get(MODULE_ID, "worldState") || {};
  }
}

/**
 * Events API - World events management
 */
class EventsAPI {
  /**
   * Trigger a world event
   * @param {string} eventId
   * @param {object} eventData - Optional event data
   * @returns {Promise<boolean>}
   */
  async trigger(eventId, eventData = {}) {
    if (!game.user.isGM) {
      throw new Error("Only GM can trigger events");
    }

    // Add to active events
    const activeEvents = game.settings.get(MODULE_ID, "activeEvents") || [];
    const event = {
      id: eventId,
      startedAt: Date.now(),
      ...eventData
    };
    activeEvents.push(event);
    await game.settings.set(MODULE_ID, "activeEvents", activeEvents);

    Hooks.call(`${MODULE_ID}.eventTriggered`, { eventId, event });
    return true;
  }

  /**
   * End a world event
   * @param {string} eventId
   * @returns {Promise<boolean>}
   */
  async end(eventId) {
    if (!game.user.isGM) {
      throw new Error("Only GM can end events");
    }

    // Remove from active events
    const activeEvents = game.settings.get(MODULE_ID, "activeEvents") || [];
    const index = activeEvents.findIndex(e => e.id === eventId);
    if (index === -1) return false;

    const [event] = activeEvents.splice(index, 1);
    await game.settings.set(MODULE_ID, "activeEvents", activeEvents);

    Hooks.call(`${MODULE_ID}.eventEnded`, { eventId, event });
    return true;
  }

  /**
   * Get all active events
   * @returns {object[]}
   */
  getActive() {
    return game.settings.get(MODULE_ID, "activeEvents") || [];
  }

  /**
   * Check if an event is active
   * @param {string} eventId
   * @returns {boolean}
   */
  isActive(eventId) {
    const activeEvents = this.getActive();
    return activeEvents.some(e => e.id === eventId);
  }

  /**
   * Get a specific active event
   * @param {string} eventId
   * @returns {object|null}
   */
  get(eventId) {
    const activeEvents = this.getActive();
    return activeEvents.find(e => e.id === eventId) || null;
  }
}

/**
 * UI API
 */
class UIAPI {
  /**
   * Open the quest log window
   * @param {string} playerUuid - Optional player UUID to show quests for
   */
  openQuestLog(playerUuid = null) {
    Hooks.call(`${MODULE_ID}.openQuestLog`, { playerUuid });

    let questLog = appInstances.get("questLog");
    if (!questLog) {
      questLog = new QuestLog({ playerUuid });
      appInstances.set("questLog", questLog);
    }
    questLog.render(true);
    console.log(`${MODULE_ID} | Opening quest log`);
  }

  /**
   * Open the quest tracker HUD
   */
  openQuestTracker() {
    let tracker = appInstances.get("questTracker");
    if (!tracker) {
      tracker = new QuestTracker();
      appInstances.set("questTracker", tracker);
    }
    tracker.render(true);
    console.log(`${MODULE_ID} | Opening quest tracker`);
  }

  /**
   * Close the quest tracker HUD
   */
  closeQuestTracker() {
    const tracker = appInstances.get("questTracker");
    if (tracker) {
      tracker.close();
    }
  }

  /**
   * Open the faction window
   * @param {string} playerUuid - Optional player UUID to show factions for
   */
  openFactionOverview(playerUuid = null) {
    Hooks.call(`${MODULE_ID}.openFactionOverview`, { playerUuid });

    let factionWindow = appInstances.get("factionWindow");
    if (!factionWindow) {
      factionWindow = new FactionWindow({ playerUuid });
      appInstances.set("factionWindow", factionWindow);
    }
    factionWindow.render(true);
    console.log(`${MODULE_ID} | Opening faction overview`);
  }

  /**
   * Open dialogue window with an NPC
   * @param {Actor} npc - The NPC actor
   * @param {object} options - Dialogue options
   */
  async openDialogue(npc, options = {}) {
    Hooks.call(`${MODULE_ID}.openDialogueWindow`, { npc, options });

    // Create new dialogue window for each conversation
    const dialogueWindow = new DialogueWindow({ npc, ...options });
    dialogueWindow.render(true);
    console.log(`${MODULE_ID} | Opening dialogue with ${npc.name}`);
    return dialogueWindow;
  }

  /**
   * Open shop window
   * @param {Actor} merchant - The merchant NPC
   * @param {Actor} customer - The customer actor
   */
  async openShop(merchant, customer = null) {
    Hooks.call(`${MODULE_ID}.openShop`, { merchant, customer });

    const shopWindow = new ShopWindow({ merchant, customer });
    shopWindow.render(true);
    console.log(`${MODULE_ID} | Opening shop for ${merchant.name}`);
    return shopWindow;
  }

  /**
   * Open bank window
   * @param {Actor} banker - The banker NPC
   * @param {Actor} customer - The customer actor
   */
  async openBank(banker, customer = null) {
    Hooks.call(`${MODULE_ID}.openBank`, { banker, customer });

    const bankWindow = new BankWindow({ banker, customer });
    bankWindow.render(true);
    console.log(`${MODULE_ID} | Opening bank for ${banker.name}`);
    return bankWindow;
  }

  /**
   * Open the hireling manager
   * @param {Actor} employer - The employer actor
   */
  openHirelingManager(employer = null) {
    let hirelingManager = appInstances.get("hirelingManager");
    if (!hirelingManager) {
      hirelingManager = new HirelingManager({ employer });
      appInstances.set("hirelingManager", hirelingManager);
    }
    hirelingManager.render(true);
    console.log(`${MODULE_ID} | Opening hireling manager`);
  }

  /**
   * Open the property manager
   * @param {Actor} owner - The property owner
   */
  openPropertyManager(owner = null) {
    let propertyManager = appInstances.get("propertyManager");
    if (!propertyManager) {
      propertyManager = new PropertyManager({ owner });
      appInstances.set("propertyManager", propertyManager);
    }
    propertyManager.render(true);
    console.log(`${MODULE_ID} | Opening property manager`);
  }

  /**
   * Open NPC configuration window (GM only)
   * @param {Actor} npc - The NPC to configure
   */
  openNPCConfig(npc) {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("BOBSNPC.Errors.GMOnly"));
      return;
    }

    // Create new config window for each NPC
    const npcConfig = new NPCConfig({ npc });
    npcConfig.render(true);
    console.log(`${MODULE_ID} | Opening NPC config for ${npc.name}`);
    return npcConfig;
  }

  /**
   * Open GM Dashboard (GM only)
   */
  openGmDashboard() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("BOBSNPC.Errors.GMOnly"));
      return;
    }
    Hooks.call(`${MODULE_ID}.openGmDashboard`);

    let dashboard = appInstances.get("gmDashboard");
    if (!dashboard) {
      dashboard = new GMDashboard();
      appInstances.set("gmDashboard", dashboard);
    }
    dashboard.render(true);
    console.log(`${MODULE_ID} | Opening GM dashboard`);
  }

  /**
   * Open trade window with another player
   * @param {Actor} yourActor - Your actor
   * @param {Actor} theirActor - The other player's actor
   * @param {string} tradeId - Optional trade session ID
   * @returns {TradeWindow}
   */
  openTrade(yourActor, theirActor, tradeId = null) {
    Hooks.call(`${MODULE_ID}.openTrade`, { yourActor, theirActor });

    const tradeWindow = new TradeWindow({
      yourActor,
      theirActor,
      tradeId: tradeId || foundry.utils.randomID()
    });
    tradeWindow.render(true);
    console.log(`${MODULE_ID} | Opening trade with ${theirActor.name}`);
    return tradeWindow;
  }

  /**
   * Close all open module windows
   */
  closeAll() {
    for (const [key, app] of appInstances) {
      if (app?.rendered) {
        app.close();
      }
    }
    console.log(`${MODULE_ID} | All windows closed`);
  }

  /**
   * Get a specific app instance
   * @param {string} appId - The app identifier
   * @returns {ApplicationV2|null}
   */
  getApp(appId) {
    return appInstances.get(appId) || null;
  }

  /**
   * Show a toast notification
   * @param {string} message
   * @param {string} type - "info", "success", "warning", "error"
   */
  toast(message, type = "info") {
    if (!getSetting("toastEnabled")) return;

    const notificationTypes = {
      info: "info",
      success: "info",
      warning: "warn",
      error: "error"
    };

    ui.notifications[notificationTypes[type] || "info"](message);
  }
}

/**
 * Backup API
 */
class BackupAPI {
  async create() {
    if (!game.user.isGM) {
      throw new Error("Only GM can create backups");
    }

    const backup = {
      date: new Date().toISOString(),
      version: game.modules.get(MODULE_ID)?.version,
      worldState: game.world.getFlag(MODULE_ID, "worldState"),
      // Add other data to backup
    };

    console.log(`${MODULE_ID} | Backup created`);
    return backup;
  }

  async restore(backupData) {
    if (!game.user.isGM) {
      throw new Error("Only GM can restore backups");
    }

    // Validate backup
    if (!backupData?.date || !backupData?.version) {
      throw new Error("Invalid backup data");
    }

    // Implementation: restore data
    console.log(`${MODULE_ID} | Backup restored from ${backupData.date}`);
    return true;
  }
}

/**
 * NPC Handler
 * Manages NPC configuration and behavior
 */
class NPCHandler {
  /**
   * Get NPC configuration
   * @param {string} actorUuid - NPC actor UUID
   * @returns {object|null}
   */
  getNPCConfig(actorUuid) {
    const actor = fromUuidSync(actorUuid);
    if (!actor) return null;
    return actor.getFlag(MODULE_ID, "config") || null;
  }

  /**
   * Set NPC configuration
   * @param {string} actorUuid - NPC actor UUID
   * @param {object} config - Configuration object
   * @returns {Promise<object>}
   */
  async setNPCConfig(actorUuid, config) {
    const actor = await fromUuid(actorUuid);
    if (!actor) throw new Error("Actor not found");
    return actor.setFlag(MODULE_ID, "config", config);
  }

  /**
   * Check if actor is configured as an NPC
   * @param {string} actorUuid - Actor UUID
   * @returns {boolean}
   */
  isConfigured(actorUuid) {
    return !!this.getNPCConfig(actorUuid);
  }

  /**
   * Get all configured NPCs
   * @returns {object[]}
   */
  getAllConfiguredNPCs() {
    return game.actors.filter(a => a.getFlag(MODULE_ID, "config"))
      .map(a => ({
        uuid: a.uuid,
        name: a.name,
        config: a.getFlag(MODULE_ID, "config")
      }));
  }
}
