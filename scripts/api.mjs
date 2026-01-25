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

    // Handlers property for backwards compatibility with app files
    // Apps can access game.bobsnpc.handlers.quest, game.bobsnpc.handlers.faction, etc.
    this.handlers = {
      quest: this.quests,
      faction: this.factions,
      relationship: this.relationships,
      shop: this.shop,
      bank: this.bank,
      crime: this.crime,
      hireling: this.hirelings,
      mount: this.mounts,
      trade: this.trade,
      npc: new NPCHandler()
    };

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
 * Quests API
 */
class QuestsAPI {
  /**
   * Get a quest by ID
   * @param {string} questId
   * @returns {object|null}
   */
  get(questId) {
    // Implementation: retrieve from JournalEntryPage flags
    return null;
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
    // Implementation: retrieve from JournalEntryPages
    return [];
  }

  /**
   * Get all quests for the party
   * @returns {object[]}
   */
  getPartyQuests() {
    return this.getAll();
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
    // Implementation: create JournalEntryPage with quest data
    return null;
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
    // Implementation: update JournalEntryPage flags
    return null;
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
    // Implementation: delete JournalEntryPage
    return false;
  }

  /**
   * Accept a quest for players
   * @param {string} questId
   * @param {string[]} playerUuids - Player actor UUIDs
   * @returns {Promise<boolean>}
   */
  async accept(questId, playerUuids = []) {
    emit(SocketEvents.QUEST_ACCEPT, { questId, playerUuids });
    Hooks.call(`${MODULE_ID}.questAccepted`, { questId, playerUuids });
    return true;
  }

  /**
   * Complete a quest
   * @param {string} questId
   * @returns {Promise<boolean>}
   */
  async complete(questId) {
    emit(SocketEvents.QUEST_COMPLETE, { questId });
    return true;
  }

  /**
   * Fail a quest
   * @param {string} questId
   * @param {string} reason
   * @returns {Promise<boolean>}
   */
  async fail(questId, reason) {
    emit(SocketEvents.QUEST_FAIL, { questId, reason });
    return true;
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
    emit(SocketEvents.QUEST_ABANDON, { questId, playerUuid });
    return true;
  }

  /**
   * Complete an objective
   * @param {string} questId
   * @param {string} objectiveId
   * @returns {Promise<boolean>}
   */
  async completeObjective(questId, objectiveId) {
    emit(SocketEvents.QUEST_OBJECTIVE, { questId, objectiveId, completed: true });
    return true;
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
    // Implementation: filter quests by acceptedBy array
    return [];
  }
}

/**
 * Factions API
 */
class FactionsAPI {
  get(factionId) { return null; }
  getAll() { return []; }

  /**
   * Alias for getAll() - used by faction-window.mjs
   * @returns {object[]}
   */
  getAllFactions() {
    return this.getAll();
  }

  async create(factionData) { return null; }
  async update(factionId, updates) { return null; }
  async delete(factionId) { return false; }

  async modifyReputation(factionId, playerUuid, amount) {
    emit(SocketEvents.FACTION_REPUTATION, { factionId, playerUuid, amount });
    return true;
  }

  getReputation(actorUuid, factionId) { return 0; }
  getRank(actorUuid, factionId) { return null; }

  /**
   * Get reputation level string from numeric value
   * @param {number} reputation - Reputation value
   * @returns {string} Level string
   */
  getReputationLevel(reputation) {
    if (reputation >= 2000) return "exalted";
    if (reputation >= 1000) return "revered";
    if (reputation >= 500) return "honored";
    if (reputation >= 100) return "friendly";
    if (reputation >= -100) return "neutral";
    if (reputation >= -500) return "unfriendly";
    if (reputation >= -1000) return "hostile";
    return "hated";
  }

  /**
   * Get NPCs belonging to a faction
   * @param {string} factionId
   * @returns {Promise<object[]>}
   */
  async getFactionNPCs(factionId) {
    // Implementation: search actors with faction flag
    return [];
  }

  async setRank(factionId, playerUuid, rankId) {
    if (!game.user.isGM) {
      throw new Error("Only GM can set faction ranks");
    }
    emit(SocketEvents.FACTION_RANK, { factionId, playerUuid, newRank: rankId });
    return true;
  }
}

/**
 * Relationships API
 */
class RelationshipsAPI {
  /**
   * Get relationship value between NPC and player
   * @param {string} npcUuid
   * @param {string} playerUuid
   * @returns {number} Value from -100 to 100
   */
  get(npcUuid, playerUuid) {
    // Implementation: get from NPC actor flags
    return 0;
  }

  /**
   * Modify relationship value
   * @param {string} npcUuid
   * @param {string} playerUuid
   * @param {number} amount
   * @returns {Promise<boolean>}
   */
  async modify(npcUuid, playerUuid, amount) {
    emit(SocketEvents.RELATIONSHIP_CHANGE, { npcUuid, playerUuid, amount });
    return true;
  }

  /**
   * Set relationship to specific value
   * @param {string} npcUuid
   * @param {string} playerUuid
   * @param {number} value
   * @returns {Promise<boolean>}
   */
  async set(npcUuid, playerUuid, value) {
    const clamped = Math.max(-100, Math.min(100, value));
    // Implementation: set flag directly
    return true;
  }

  /**
   * Get relationship tier name
   * @param {string} npcUuid
   * @param {string} playerUuid
   * @returns {string}
   */
  getTier(npcUuid, playerUuid) {
    const value = this.get(npcUuid, playerUuid);
    if (value <= -75) return "hostile";
    if (value <= -50) return "hated";
    if (value <= -25) return "unfriendly";
    if (value < 25) return "neutral";
    if (value < 50) return "friendly";
    if (value < 75) return "trusted";
    return "allied";
  }
}

/**
 * Shop API
 */
class ShopAPI {
  async open(npcUuid, playerUuid = null) {
    Hooks.call(`${MODULE_ID}.openShop`, { npcUuid, playerUuid });
  }

  async close(npcUuid) {
    Hooks.call(`${MODULE_ID}.closeShop`, { npcUuid });
  }

  getInventory(npcUuid) { return []; }

  async buy(npcUuid, playerUuid, itemId, quantity) {
    emit(SocketEvents.SHOP_TRANSACTION, {
      npcUuid,
      playerUuid,
      transaction: { type: "buy", itemId, quantity }
    });
    return true;
  }

  async sell(npcUuid, playerUuid, itemId, quantity) {
    emit(SocketEvents.SHOP_TRANSACTION, {
      npcUuid,
      playerUuid,
      transaction: { type: "sell", itemId, quantity }
    });
    return true;
  }

  getPrice(npcUuid, playerUuid, itemId, isBuying) {
    // Implementation: calculate price with modifiers
    return 0;
  }
}

/**
 * Bank API
 */
class BankAPI {
  async open(npcUuid, playerUuid = null) {
    Hooks.call(`${MODULE_ID}.openBank`, { npcUuid, playerUuid });
  }

  async deposit(npcUuid, playerUuid, amount) {
    emit(SocketEvents.BANK_TRANSACTION, {
      npcUuid,
      playerUuid,
      transaction: { type: "deposit", amount }
    });
    return true;
  }

  async withdraw(npcUuid, playerUuid, amount) {
    emit(SocketEvents.BANK_TRANSACTION, {
      npcUuid,
      playerUuid,
      transaction: { type: "withdraw", amount }
    });
    return true;
  }

  getBalance(npcUuid, playerUuid) { return 0; }

  async takeLoan(npcUuid, playerUuid, amount) {
    emit(SocketEvents.BANK_TRANSACTION, {
      npcUuid,
      playerUuid,
      transaction: { type: "loan", amount }
    });
    return true;
  }

  async repayLoan(npcUuid, playerUuid, amount) {
    emit(SocketEvents.BANK_TRANSACTION, {
      npcUuid,
      playerUuid,
      transaction: { type: "repay", amount }
    });
    return true;
  }
}

/**
 * Crime API
 */
class CrimeAPI {
  async addBounty(playerUuid, region, amount, crime) {
    if (!getSetting("bountyEnabled")) return false;
    emit(SocketEvents.CRIME_BOUNTY, { playerUuid, region, amount, crime });
    return true;
  }

  getBounty(playerUuid, region = null) {
    // Implementation: get from world flags
    return 0;
  }

  async clearBounty(playerUuid, region, method) {
    // Implementation: remove bounty
    return true;
  }

  async attemptSteal(playerUuid, npcUuid, itemId) {
    if (!getSetting("stealingEnabled")) {
      ui.notifications.warn("Stealing is disabled");
      return null;
    }
    // Implementation: perform steal check
    return null;
  }
}

/**
 * Hirelings API
 */
class HirelingsAPI {
  async hire(hirelingUuid, employerUuid, terms) { return false; }
  async dismiss(hirelingUuid) { return false; }
  async pay(hirelingUuid) { return false; }
  getLoyalty(hirelingUuid) { return 0; }
  async modifyLoyalty(hirelingUuid, amount) { return false; }
}

/**
 * Mounts API
 */
class MountsAPI {
  async purchase(mountUuid, buyerUuid) { return false; }
  async stable(mountUuid, stableNpcUuid) { return false; }
  async retrieve(mountUuid) { return false; }
  async summon(mountUuid, sceneId, position) { return false; }
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
 * World State API
 */
class WorldStateAPI {
  /**
   * Get a world state flag
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    return game.world.getFlag(MODULE_ID, `worldState.${key}`);
  }

  /**
   * Set a world state flag
   * @param {string} key
   * @param {*} value
   * @returns {Promise<*>}
   */
  async set(key, value) {
    if (!game.user.isGM) {
      throw new Error("Only GM can set world state");
    }
    return game.world.setFlag(MODULE_ID, `worldState.${key}`, value);
  }

  /**
   * Delete a world state flag
   * @param {string} key
   * @returns {Promise<*>}
   */
  async delete(key) {
    if (!game.user.isGM) {
      throw new Error("Only GM can delete world state");
    }
    return game.world.unsetFlag(MODULE_ID, `worldState.${key}`);
  }

  /**
   * Get all world state
   * @returns {object}
   */
  getAll() {
    return game.world.getFlag(MODULE_ID, "worldState") || {};
  }
}

/**
 * Events API
 */
class EventsAPI {
  async trigger(eventId) {
    if (!game.user.isGM) {
      throw new Error("Only GM can trigger events");
    }
    Hooks.call(`${MODULE_ID}.eventTriggered`, { eventId });
    return true;
  }

  async end(eventId) {
    if (!game.user.isGM) {
      throw new Error("Only GM can end events");
    }
    Hooks.call(`${MODULE_ID}.eventEnded`, { eventId });
    return true;
  }

  getActive() {
    return game.world.getFlag(MODULE_ID, "activeEvents") || [];
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
