/**
 * Bob's Talking NPCs - Service Request Model
 * Data structure for GM-approved service requests (repair, enchant)
 * Uses in-game time for service durations
 */

import { generateId } from "../utils/helpers.mjs";

/**
 * Time constants for game time calculations (in seconds)
 */
export const GameTimeUnits = Object.freeze({
  MINUTE: 60,
  HOUR: 60 * 60,
  DAY: 24 * 60 * 60,
  WEEK: 7 * 24 * 60 * 60
});

/**
 * Service request status enum
 */
export const ServiceRequestStatus = Object.freeze({
  PENDING: "pending",           // Waiting for GM approval
  APPROVED: "approved",         // GM approved, item being worked on
  READY: "ready",               // Work complete, ready for pickup
  COMPLETED: "completed",       // Item picked up by player
  DENIED: "denied",             // GM denied the request
  EXPIRED: "expired"            // Request timed out
});

/**
 * Service types requiring approval
 */
export const ApprovalRequiredServices = Object.freeze({
  REPAIR: "repair",
  ENCHANT: "enchant"
});

/**
 * Create a new service request
 * @param {object} data - Request data
 * @returns {object}
 */
export function createServiceRequest(data) {
  return {
    id: data.id || generateId(),
    type: data.type,                      // "repair" or "enchant"
    status: data.status || ServiceRequestStatus.PENDING,

    // Merchant info
    merchantId: data.merchantId,
    merchantName: data.merchantName || "Unknown Merchant",

    // Player info
    playerActorUuid: data.playerActorUuid,
    playerActorId: data.playerActorId,
    playerName: data.playerName || "Unknown Player",
    playerId: data.playerId,              // User ID for notifications

    // Item info
    itemId: data.itemId,
    itemUuid: data.itemUuid,
    itemName: data.itemName || "Unknown Item",
    itemImg: data.itemImg || "icons/svg/item-bag.svg",
    itemType: data.itemType,

    // Enchantment info (for enchant requests)
    enchantmentId: data.enchantmentId || null,
    enchantmentName: data.enchantmentName || null,

    // Cost
    cost: data.cost || 0,

    // ITEM ESCROW: Full item data backup
    itemData: data.itemData || null,          // item.toObject() - complete item backup for restoration

    // Queue position tracking
    queuePosition: data.queuePosition ?? 0,   // Position in merchant's queue

    // Timestamps
    requestedAt: data.requestedAt || Date.now(),
    processedAt: data.processedAt || null,
    processedBy: data.processedBy || null,    // GM user ID who processed

    // Drop-off / Pick-up tracking
    itemDroppedOff: data.itemDroppedOff || false,
    droppedOffAt: data.droppedOffAt || null,
    workDuration: data.workDuration || null,           // Duration in game time seconds
    readyAt: data.readyAt || null,                     // Legacy: real time timestamp (deprecated)
    readyAtGameTime: data.readyAtGameTime || null,     // Game time in seconds when ready
    startedAtGameTime: data.startedAtGameTime || null, // Game time in seconds when work started
    pickedUpAt: data.pickedUpAt || null,

    // Fail tracking (for enchantments)
    failRollResult: data.failRollResult ?? null,      // null = not rolled yet, number = roll result
    enchantmentFailed: data.enchantmentFailed ?? false,
    failConsequence: data.failConsequence || null,    // "none", "destroyed", "cursed"

    // Result item data (after enchantment applied, before pickup)
    resultItemData: data.resultItemData || null,

    // Expiration (24 hours default for pending requests)
    expiresAt: data.expiresAt || (Date.now() + 24 * 60 * 60 * 1000)
  };
}

/**
 * Check if a service request is expired
 * @param {object} request - Service request
 * @returns {boolean}
 */
export function isRequestExpired(request) {
  return Date.now() > request.expiresAt;
}

/**
 * Check if a service request is pending
 * @param {object} request - Service request
 * @returns {boolean}
 */
export function isRequestPending(request) {
  return request.status === ServiceRequestStatus.PENDING && !isRequestExpired(request);
}

/**
 * Check if a service request is ready for pickup
 * Uses in-game time (game.time.worldTime)
 * @param {object} request - Service request
 * @returns {boolean}
 */
export function isRequestReady(request) {
  if (request.status === ServiceRequestStatus.READY) return true;
  if (request.status === ServiceRequestStatus.APPROVED) {
    // Prefer game time if available
    if (request.readyAtGameTime !== null && request.readyAtGameTime !== undefined) {
      const currentGameTime = game?.time?.worldTime ?? 0;
      return currentGameTime >= request.readyAtGameTime;
    }
    // Fallback to real time for legacy requests
    if (request.readyAt) {
      return Date.now() >= request.readyAt;
    }
  }
  return false;
}

/**
 * Get time remaining until item is ready (in game time seconds)
 * @param {object} request - Service request
 * @returns {number|null} Seconds remaining in game time, or null if ready or not applicable
 */
export function getTimeUntilReady(request) {
  if (request.status !== ServiceRequestStatus.APPROVED) return null;

  // Prefer game time if available
  if (request.readyAtGameTime !== null && request.readyAtGameTime !== undefined) {
    const currentGameTime = game?.time?.worldTime ?? 0;
    const remaining = request.readyAtGameTime - currentGameTime;
    return remaining > 0 ? remaining : 0;
  }

  // Fallback to real time for legacy requests (convert ms to seconds for consistency)
  if (request.readyAt) {
    const remaining = request.readyAt - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  return null;
}

/**
 * Format game time duration for display
 * @param {number} seconds - Duration in game time seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "Ready now";

  const days = Math.floor(seconds / GameTimeUnits.DAY);
  const hours = Math.floor((seconds % GameTimeUnits.DAY) / GameTimeUnits.HOUR);
  const minutes = Math.floor((seconds % GameTimeUnits.HOUR) / GameTimeUnits.MINUTE);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`); // Only show minutes if less than a day

  return parts.length > 0 ? parts.join(" ") : "< 1m";
}

/**
 * Format game time duration in a verbose way
 * @param {number} seconds - Duration in game time seconds
 * @returns {string}
 */
export function formatDurationVerbose(seconds) {
  if (!seconds || seconds <= 0) return "Ready now";

  const days = Math.floor(seconds / GameTimeUnits.DAY);
  const hours = Math.floor((seconds % GameTimeUnits.DAY) / GameTimeUnits.HOUR);
  const minutes = Math.floor((seconds % GameTimeUnits.HOUR) / GameTimeUnits.MINUTE);

  const parts = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);

  return parts.length > 0 ? parts.join(", ") : "Less than a minute";
}

/**
 * Convert days/hours to game time seconds
 * @param {number} days - Number of days
 * @param {number} hours - Number of hours
 * @returns {number} Total duration in game time seconds
 */
export function toGameTimeSeconds(days = 0, hours = 0) {
  return (days * GameTimeUnits.DAY) + (hours * GameTimeUnits.HOUR);
}

/**
 * Get the current game time
 * @returns {number} Current world time in seconds
 */
export function getCurrentGameTime() {
  return game?.time?.worldTime ?? 0;
}

/**
 * Calculate ready time from current game time plus duration
 * @param {number} durationSeconds - Duration in game time seconds
 * @returns {number} Game time when item will be ready
 */
export function calculateReadyGameTime(durationSeconds) {
  return getCurrentGameTime() + durationSeconds;
}

/**
 * Validate a service request
 * @param {object} request - Service request to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateServiceRequest(request) {
  const errors = [];

  if (!request.type) {
    errors.push("Service type is required");
  } else if (!Object.values(ApprovalRequiredServices).includes(request.type)) {
    errors.push(`Invalid service type: ${request.type}`);
  }

  if (!request.merchantId) {
    errors.push("Merchant ID is required");
  }

  if (!request.playerActorUuid && !request.playerActorId) {
    errors.push("Player actor reference is required");
  }

  if (!request.itemId && !request.itemUuid) {
    errors.push("Item reference is required");
  }

  if (request.type === ApprovalRequiredServices.ENCHANT && !request.enchantmentId) {
    errors.push("Enchantment ID is required for enchant requests");
  }

  if (typeof request.cost !== "number" || request.cost < 0) {
    errors.push("Valid cost is required");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
