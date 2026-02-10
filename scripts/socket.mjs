/**
 * Bob's Talking NPCs - Socket Handler
 * Handles multiplayer synchronization via Foundry's socket system
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";

/**
 * Socket namespace for this module
 */
const SOCKET_NAME = `module.${MODULE_ID}`;

/**
 * Socket event types enum
 */
export const SocketEvents = Object.freeze({
  // Dialogue events
  DIALOGUE_START: "dialogueStart",
  DIALOGUE_CHOICE: "dialogueChoice",
  DIALOGUE_END: "dialogueEnd",
  DIALOGUE_JOIN: "dialogueJoin",
  DIALOGUE_LEAVE: "dialogueLeave",
  DIALOGUE_VOTE: "dialogueVote",
  DIALOGUE_SYNC: "dialogueSync",

  // Quest events
  QUEST_ACCEPT: "questAccept",
  QUEST_UPDATE: "questUpdate",
  QUEST_COMPLETE: "questComplete",
  QUEST_FAIL: "questFail",
  QUEST_ABANDON: "questAbandon",
  QUEST_OBJECTIVE: "questObjective",

  // Trade events
  TRADE_REQUEST: "tradeRequest",
  TRADE_ACCEPT: "tradeAccept",
  TRADE_DECLINE: "tradeDecline",
  TRADE_UPDATE: "tradeUpdate",
  TRADE_CONFIRM: "tradeConfirm",
  TRADE_COMPLETE: "tradeComplete",
  TRADE_CANCEL: "tradeCancel",

  // Faction events
  FACTION_REPUTATION: "factionReputation",
  FACTION_RANK: "factionRank",

  // Relationship events
  RELATIONSHIP_CHANGE: "relationshipChange",

  // Shop events
  SHOP_TRANSACTION: "shopTransaction",
  SHOP_HAGGLE: "shopHaggle",

  // Service request events
  SERVICE_REQUEST: "serviceRequest",
  SERVICE_APPROVE: "serviceApprove",
  SERVICE_DENY: "serviceDeny",
  SERVICE_PICKUP: "servicePickup",
  SERVICE_PICKUP_RESULT: "servicePickupResult",

  // Bank events
  BANK_TRANSACTION: "bankTransaction",

  // Loot events
  LOOT_TAKE: "lootTake",
  LOOT_ROLL: "lootRoll",

  // Crime events
  CRIME_BOUNTY: "crimeBounty",

  // General sync
  STATE_SYNC: "stateSync",
  REQUEST_SYNC: "requestSync"
});

/**
 * Registry of socket event handlers
 * @type {Map<string, Function>}
 */
const handlers = new Map();

/**
 * Active dialogues state for synchronization
 * @type {Map<string, object>}
 */
const activeDialogues = new Map();

/**
 * Active trades state
 * @type {Map<string, object>}
 */
const activeTrades = new Map();

/**
 * Register socket handler and default event handlers
 * Called during the ready hook
 */
export function registerSocket() {
  // Listen for socket events
  game.socket.on(SOCKET_NAME, handleSocketEvent);

  // Register default handlers
  registerDefaultHandlers();

  console.log(`${MODULE_ID} | Socket registered on ${SOCKET_NAME}`);
}

/**
 * Handle incoming socket events
 * @param {object} data - Socket event data
 */
function handleSocketEvent(data) {
  const { type, payload, userId, timestamp } = data;

  // Don't process our own events (unless explicitly needed)
  if (userId === game.user.id && !data.processLocal) {
    return;
  }

  // Find and execute handler
  const handler = handlers.get(type);
  if (handler) {
    try {
      handler(payload, userId, timestamp);
    } catch (error) {
      console.error(`${MODULE_ID} | Error handling socket event ${type}:`, error);
    }
  } else if (!type?.startsWith("dialogue.")) {
    // Only warn for unhandled events that aren't dialogue events
    // (dialogue events are handled by DialogueHandler's own socket listener)
    console.warn(`${MODULE_ID} | Unknown socket event type: ${type}`);
  }
}

/**
 * Register a handler for a socket event type
 * @param {string} eventType - Event type from SocketEvents
 * @param {Function} handler - Handler function(payload, userId, timestamp)
 */
export function registerHandler(eventType, handler) {
  if (handlers.has(eventType)) {
    console.warn(`${MODULE_ID} | Overwriting existing handler for ${eventType}`);
  }
  handlers.set(eventType, handler);
}

/**
 * Unregister a handler for a socket event type
 * @param {string} eventType - Event type to unregister
 */
export function unregisterHandler(eventType) {
  handlers.delete(eventType);
}

/**
 * Emit a socket event to all clients
 * @param {string} eventType - Event type from SocketEvents
 * @param {object} payload - Event payload data
 * @param {object} options - Emit options
 * @param {boolean} options.processLocal - Also process locally (default: true)
 * @param {string[]} options.recipients - Specific user IDs to send to (default: all)
 */
export function emit(eventType, payload, options = {}) {
  const { processLocal = true, recipients = null } = options;

  const data = {
    type: eventType,
    payload,
    userId: game.user.id,
    timestamp: Date.now(),
    processLocal
  };

  // Emit to all or specific recipients
  if (recipients) {
    // Filter socket emit to specific users - Foundry handles this via socketlib or custom logic
    // For now, emit to all and let handlers filter
    game.socket.emit(SOCKET_NAME, { ...data, recipients });
  } else {
    game.socket.emit(SOCKET_NAME, data);
  }

  // Process locally if requested
  if (processLocal) {
    const handler = handlers.get(eventType);
    if (handler) {
      handler(payload, game.user.id, data.timestamp);
    }
  }
}

/**
 * Emit an event that only the GM should process
 * If current user is GM, process immediately
 * Otherwise, send to GM via socket
 * @param {string} eventType - Event type
 * @param {object} payload - Event payload
 */
export function emitToGM(eventType, payload) {
  if (game.user.isGM) {
    // Process directly
    const handler = handlers.get(eventType);
    if (handler) {
      handler(payload, game.user.id, Date.now());
    }
  } else {
    // Send to GM(s) only
    emit(eventType, { ...payload, gmOnly: true }, { processLocal: false });
  }
}

/**
 * Request data sync from the GM
 * @param {string} dataType - Type of data to sync
 */
export function requestSync(dataType) {
  emit(SocketEvents.REQUEST_SYNC, { dataType }, { processLocal: false });
}

/**
 * Register default event handlers
 */
function registerDefaultHandlers() {
  // Dialogue handlers
  registerHandler(SocketEvents.DIALOGUE_START, handleDialogueStart);
  registerHandler(SocketEvents.DIALOGUE_CHOICE, handleDialogueChoice);
  registerHandler(SocketEvents.DIALOGUE_END, handleDialogueEnd);
  registerHandler(SocketEvents.DIALOGUE_JOIN, handleDialogueJoin);
  registerHandler(SocketEvents.DIALOGUE_LEAVE, handleDialogueLeave);
  registerHandler(SocketEvents.DIALOGUE_VOTE, handleDialogueVote);
  registerHandler(SocketEvents.DIALOGUE_SYNC, handleDialogueSync);

  // Quest handlers
  registerHandler(SocketEvents.QUEST_ACCEPT, handleQuestAccept);
  registerHandler(SocketEvents.QUEST_UPDATE, handleQuestUpdate);
  registerHandler(SocketEvents.QUEST_COMPLETE, handleQuestComplete);
  registerHandler(SocketEvents.QUEST_FAIL, handleQuestFail);
  registerHandler(SocketEvents.QUEST_ABANDON, handleQuestAbandon);
  registerHandler(SocketEvents.QUEST_OBJECTIVE, handleQuestObjective);

  // Trade handlers
  registerHandler(SocketEvents.TRADE_REQUEST, handleTradeRequest);
  registerHandler(SocketEvents.TRADE_ACCEPT, handleTradeAccept);
  registerHandler(SocketEvents.TRADE_DECLINE, handleTradeDecline);
  registerHandler(SocketEvents.TRADE_UPDATE, handleTradeUpdate);
  registerHandler(SocketEvents.TRADE_CONFIRM, handleTradeConfirm);
  registerHandler(SocketEvents.TRADE_COMPLETE, handleTradeComplete);
  registerHandler(SocketEvents.TRADE_CANCEL, handleTradeCancel);

  // Other handlers
  registerHandler(SocketEvents.FACTION_REPUTATION, handleFactionReputation);
  registerHandler(SocketEvents.FACTION_RANK, handleFactionRank);
  registerHandler(SocketEvents.RELATIONSHIP_CHANGE, handleRelationshipChange);
  registerHandler(SocketEvents.SHOP_TRANSACTION, handleShopTransaction);
  registerHandler(SocketEvents.BANK_TRANSACTION, handleBankTransaction);
  registerHandler(SocketEvents.LOOT_TAKE, handleLootTake);
  registerHandler(SocketEvents.CRIME_BOUNTY, handleCrimeBounty);
  registerHandler(SocketEvents.STATE_SYNC, handleStateSync);
  registerHandler(SocketEvents.REQUEST_SYNC, handleRequestSync);

  // Service request handlers
  registerHandler(SocketEvents.SERVICE_REQUEST, handleServiceRequest);
  registerHandler(SocketEvents.SERVICE_APPROVE, handleServiceApprove);
  registerHandler(SocketEvents.SERVICE_DENY, handleServiceDeny);
  registerHandler(SocketEvents.SERVICE_PICKUP, handleServicePickup);
  registerHandler(SocketEvents.SERVICE_PICKUP_RESULT, handleServicePickupResult);
}

// ===== Dialogue Handlers =====

function handleDialogueStart(payload, userId) {
  const { npcUuid, nodeId, participants } = payload;

  activeDialogues.set(npcUuid, {
    npcUuid,
    currentNodeId: nodeId,
    participants: new Set(participants),
    leader: userId,
    votes: new Map(),
    startTime: Date.now()
  });

  Hooks.call(`${MODULE_ID}.dialogueStarted`, { npcUuid, userId, nodeId });
  console.log(`${MODULE_ID} | Dialogue started with ${npcUuid} by user ${userId}`);
}

function handleDialogueChoice(payload, userId) {
  const { npcUuid, nodeId, choiceId, nextNodeId } = payload;

  const dialogue = activeDialogues.get(npcUuid);
  if (dialogue) {
    dialogue.currentNodeId = nextNodeId;
    dialogue.votes.clear();
  }

  Hooks.call(`${MODULE_ID}.dialogueChoice`, { npcUuid, nodeId, choiceId, nextNodeId, userId });
  console.log(`${MODULE_ID} | Dialogue choice made: ${choiceId}`);
}

function handleDialogueEnd(payload, userId) {
  const { npcUuid, reason } = payload;

  activeDialogues.delete(npcUuid);

  Hooks.call(`${MODULE_ID}.dialogueEnded`, { npcUuid, reason, userId });
  console.log(`${MODULE_ID} | Dialogue ended with ${npcUuid}`);
}

function handleDialogueJoin(payload, userId) {
  const { npcUuid } = payload;

  const dialogue = activeDialogues.get(npcUuid);
  if (dialogue) {
    dialogue.participants.add(userId);
  }

  Hooks.call(`${MODULE_ID}.dialogueJoined`, { npcUuid, userId });
  console.log(`${MODULE_ID} | User ${userId} joined dialogue with ${npcUuid}`);
}

function handleDialogueLeave(payload, userId) {
  const { npcUuid } = payload;

  const dialogue = activeDialogues.get(npcUuid);
  if (dialogue) {
    dialogue.participants.delete(userId);
    dialogue.votes.delete(userId);
  }

  Hooks.call(`${MODULE_ID}.dialogueLeft`, { npcUuid, userId });
  console.log(`${MODULE_ID} | User ${userId} left dialogue with ${npcUuid}`);
}

function handleDialogueVote(payload, userId) {
  const { npcUuid, choiceId } = payload;

  const dialogue = activeDialogues.get(npcUuid);
  if (dialogue) {
    dialogue.votes.set(userId, choiceId);
  }

  Hooks.call(`${MODULE_ID}.dialogueVoted`, { npcUuid, choiceId, userId });
  console.log(`${MODULE_ID} | User ${userId} voted for choice ${choiceId}`);
}

function handleDialogueSync(payload, userId) {
  const { npcUuid, state } = payload;

  if (state) {
    activeDialogues.set(npcUuid, {
      ...state,
      participants: new Set(state.participants),
      votes: new Map(Object.entries(state.votes || {}))
    });
  }
}

// ===== Quest Handlers =====

function handleQuestAccept(payload, userId) {
  const { questId, playerUuids } = payload;
  Hooks.call(`${MODULE_ID}.questAccepted`, { questId, playerUuids, userId });
  console.log(`${MODULE_ID} | Quest ${questId} accepted`);
}

function handleQuestUpdate(payload, userId) {
  const { questId, updates } = payload;
  Hooks.call(`${MODULE_ID}.questUpdated`, { questId, updates, userId });
}

function handleQuestComplete(payload, userId) {
  const { questId, rewards, players } = payload;
  Hooks.call(`${MODULE_ID}.questCompleted`, { questId, rewards, players, userId });
  console.log(`${MODULE_ID} | Quest ${questId} completed`);
}

function handleQuestFail(payload, userId) {
  const { questId, reason } = payload;
  Hooks.call(`${MODULE_ID}.questFailed`, { questId, reason, userId });
  console.log(`${MODULE_ID} | Quest ${questId} failed: ${reason}`);
}

function handleQuestAbandon(payload, userId) {
  const { questId, playerUuid } = payload;
  Hooks.call(`${MODULE_ID}.questAbandoned`, { questId, playerUuid, userId });
}

function handleQuestObjective(payload, userId) {
  const { questId, objectiveId, completed } = payload;
  Hooks.call(`${MODULE_ID}.questObjectiveUpdated`, { questId, objectiveId, completed, userId });
}

// ===== Trade Handlers =====

function handleTradeRequest(payload, userId) {
  const { tradeId, initiatorUuid, recipientUuid } = payload;

  activeTrades.set(tradeId, {
    id: tradeId,
    initiator: initiatorUuid,
    recipient: recipientUuid,
    initiatorOffer: { gold: 0, items: [] },
    recipientOffer: { gold: 0, items: [] },
    initiatorConfirmed: false,
    recipientConfirmed: false,
    status: "pending"
  });

  Hooks.call(`${MODULE_ID}.tradeRequested`, { tradeId, initiatorUuid, recipientUuid, userId });
  console.log(`${MODULE_ID} | Trade request from ${initiatorUuid} to ${recipientUuid}`);
}

function handleTradeAccept(payload, userId) {
  const { tradeId } = payload;
  const trade = activeTrades.get(tradeId);
  if (trade) {
    trade.status = "active";
  }
  Hooks.call(`${MODULE_ID}.tradeAccepted`, { tradeId, userId });
}

function handleTradeDecline(payload, userId) {
  const { tradeId } = payload;
  activeTrades.delete(tradeId);
  Hooks.call(`${MODULE_ID}.tradeDeclined`, { tradeId, userId });
}

function handleTradeUpdate(payload, userId) {
  const { tradeId, side, offer } = payload;
  const trade = activeTrades.get(tradeId);
  if (trade) {
    if (side === "initiator") {
      trade.initiatorOffer = offer;
      trade.initiatorConfirmed = false;
    } else {
      trade.recipientOffer = offer;
      trade.recipientConfirmed = false;
    }
  }
  Hooks.call(`${MODULE_ID}.tradeUpdated`, { tradeId, side, offer, userId });
}

function handleTradeConfirm(payload, userId) {
  const { tradeId, side } = payload;
  const trade = activeTrades.get(tradeId);
  if (trade) {
    if (side === "initiator") {
      trade.initiatorConfirmed = true;
    } else {
      trade.recipientConfirmed = true;
    }
  }
  Hooks.call(`${MODULE_ID}.tradeConfirmed`, { tradeId, side, userId });
}

function handleTradeComplete(payload, userId) {
  const { tradeId } = payload;
  activeTrades.delete(tradeId);
  Hooks.call(`${MODULE_ID}.tradeCompleted`, { tradeId, userId });
  console.log(`${MODULE_ID} | Trade ${tradeId} completed`);
}

function handleTradeCancel(payload, userId) {
  const { tradeId, reason } = payload;
  activeTrades.delete(tradeId);
  Hooks.call(`${MODULE_ID}.tradeCancelled`, { tradeId, reason, userId });
}

// ===== Other Handlers =====

function handleFactionReputation(payload, userId) {
  const { factionId, playerUuid, amount, newTotal } = payload;
  Hooks.call(`${MODULE_ID}.factionReputationChanged`, { factionId, playerUuid, amount, newTotal, userId });
}

function handleFactionRank(payload, userId) {
  const { factionId, playerUuid, newRank, oldRank } = payload;
  Hooks.call(`${MODULE_ID}.factionRankChanged`, { factionId, playerUuid, newRank, oldRank, userId });
}

function handleRelationshipChange(payload, userId) {
  const { npcUuid, playerUuid, amount, newTotal } = payload;
  Hooks.call(`${MODULE_ID}.relationshipChanged`, { npcUuid, playerUuid, amount, newTotal, userId });
}

function handleShopTransaction(payload, userId) {
  const { npcUuid, playerUuid, transaction } = payload;
  Hooks.call(`${MODULE_ID}.shopTransaction`, { npcUuid, playerUuid, transaction, userId });
}

function handleBankTransaction(payload, userId) {
  const { npcUuid, playerUuid, transaction } = payload;
  Hooks.call(`${MODULE_ID}.bankTransaction`, { npcUuid, playerUuid, transaction, userId });
}

function handleLootTake(payload, userId) {
  const { containerId, itemId, playerUuid } = payload;
  Hooks.call(`${MODULE_ID}.lootTaken`, { containerId, itemId, playerUuid, userId });
}

function handleCrimeBounty(payload, userId) {
  const { playerUuid, region, amount, crime } = payload;
  Hooks.call(`${MODULE_ID}.bountyAdded`, { playerUuid, region, amount, crime, userId });
}

function handleStateSync(payload, userId) {
  // Only process if we requested sync or it's from GM
  const senderUser = game.users.get(userId);
  if (!senderUser?.isGM) return;

  const { dataType, data } = payload;
  Hooks.call(`${MODULE_ID}.stateSync`, { dataType, data, userId });
}

function handleRequestSync(payload, userId) {
  // Only GM should respond to sync requests
  if (!game.user.isGM) return;

  const { dataType } = payload;

  // Gather data and send back
  // Implementation depends on what data is being synced
  console.log(`${MODULE_ID} | Sync requested for ${dataType} by user ${userId}`);
}

// ===== Service Request Handlers =====

async function handleServiceRequest(payload, userId) {
  // Only GM should handle service requests
  if (!game.user.isGM) return;

  const { request } = payload;

  // Store the request
  const pendingRequests = game.settings.get(MODULE_ID, "pendingServiceRequests") || [];
  pendingRequests.push(request);
  await game.settings.set(MODULE_ID, "pendingServiceRequests", pendingRequests);

  // Notify GM via hook (UI will handle display)
  Hooks.call(`${MODULE_ID}.serviceRequestReceived`, request);

  console.log(`${MODULE_ID} | Service request received from ${request.playerName}: ${request.type} for ${request.itemName}`);
}

function handleServiceApprove(payload, userId) {
  const { requestId, playerId } = payload;

  // If this is the player who made the request, show notification
  if (game.user.id === playerId) {
    Hooks.call(`${MODULE_ID}.serviceRequestApproved`, requestId);
    ui.notifications.info(game.i18n.localize("BOBSNPC.Service.RequestApproved"));
  }

  console.log(`${MODULE_ID} | Service request ${requestId} approved`);
}

function handleServiceDeny(payload, userId) {
  const { requestId, playerId, reason } = payload;

  // If this is the player who made the request, show notification
  if (game.user.id === playerId) {
    Hooks.call(`${MODULE_ID}.serviceRequestDenied`, requestId, reason);
    ui.notifications.warn(game.i18n.localize("BOBSNPC.Service.RequestDenied"));
  }

  console.log(`${MODULE_ID} | Service request ${requestId} denied`);
}

/**
 * Handle service pickup request from player
 * GM processes the pickup and sends result back
 */
async function handleServicePickup(payload, userId) {
  // Only GM should process pickup requests
  if (!game.user.isGM) return;

  const { orderId, playerActorUuid, playerId } = payload;

  console.log(`${MODULE_ID} | Processing pickup request for order ${orderId} from player ${playerId}`);

  const handler = game.bobsnpc?.handlers?.merchant;
  if (!handler) {
    emit(SocketEvents.SERVICE_PICKUP_RESULT, {
      success: false,
      message: "Handler not available",
      playerId,
      orderId
    });
    return;
  }

  try {
    // Process the pickup on GM side (this will update settings)
    const result = await handler._processPickupAsGM(orderId, playerActorUuid);

    // Send result back to the player
    emit(SocketEvents.SERVICE_PICKUP_RESULT, {
      ...result,
      playerId,
      orderId
    });
  } catch (error) {
    console.error(`${MODULE_ID} | Error processing pickup:`, error);
    emit(SocketEvents.SERVICE_PICKUP_RESULT, {
      success: false,
      message: error.message,
      playerId,
      orderId
    });
  }
}

/**
 * Handle pickup result sent back from GM
 */
function handleServicePickupResult(payload, userId) {
  const { success, message, playerId, orderId } = payload;

  // Only the requesting player should process this
  if (game.user.id !== playerId) return;

  // Store the result for the waiting promise
  const pendingPickup = pendingPickups.get(orderId);
  if (pendingPickup) {
    pendingPickup.resolve({ success, message });
    pendingPickups.delete(orderId);
  }
}

/**
 * Map to store pending pickup promises
 */
const pendingPickups = new Map();

/**
 * Request a pickup from the GM and wait for result
 * @param {string} orderId
 * @param {string} playerActorUuid
 * @returns {Promise<object>}
 */
export function requestPickupFromGM(orderId, playerActorUuid) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingPickups.delete(orderId);
      reject(new Error("Pickup request timed out"));
    }, 30000); // 30 second timeout

    pendingPickups.set(orderId, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      }
    });

    // Send request to GM
    emit(SocketEvents.SERVICE_PICKUP, {
      orderId,
      playerActorUuid,
      playerId: game.user.id
    }, { processLocal: false });
  });
}

// ===== Utility Functions =====

/**
 * Get the current state of an active dialogue
 * @param {string} npcUuid
 * @returns {object|null}
 */
export function getActiveDialogue(npcUuid) {
  return activeDialogues.get(npcUuid) || null;
}

/**
 * Get all active dialogues
 * @returns {Map}
 */
export function getAllActiveDialogues() {
  return new Map(activeDialogues);
}

/**
 * Get the current state of an active trade
 * @param {string} tradeId
 * @returns {object|null}
 */
export function getActiveTrade(tradeId) {
  return activeTrades.get(tradeId) || null;
}

/**
 * Get all active trades
 * @returns {Map}
 */
export function getAllActiveTrades() {
  return new Map(activeTrades);
}
