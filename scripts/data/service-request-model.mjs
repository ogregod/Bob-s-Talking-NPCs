/**
 * Bob's Talking NPCs - Service Request Model
 * Data structure for GM-approved service requests (repair, enchant)
 */

import { generateId } from "../utils/helpers.mjs";

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
    workDuration: data.workDuration || null,
    readyAt: data.readyAt || null,
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
 * @param {object} request - Service request
 * @returns {boolean}
 */
export function isRequestReady(request) {
  if (request.status === ServiceRequestStatus.READY) return true;
  if (request.status === ServiceRequestStatus.APPROVED && request.readyAt) {
    return Date.now() >= request.readyAt;
  }
  return false;
}

/**
 * Get time remaining until item is ready (in milliseconds)
 * @param {object} request - Service request
 * @returns {number|null} Milliseconds remaining, or null if ready or not applicable
 */
export function getTimeUntilReady(request) {
  if (!request.readyAt || request.status !== ServiceRequestStatus.APPROVED) return null;
  const remaining = request.readyAt - Date.now();
  return remaining > 0 ? remaining : 0;
}

/**
 * Format time duration for display
 * @param {number} ms - Duration in milliseconds
 * @returns {string}
 */
export function formatDuration(ms) {
  if (!ms || ms <= 0) return "Ready now";

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
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
