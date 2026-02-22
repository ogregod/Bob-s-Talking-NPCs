/**
 * Repair Service Executor
 * Handles item repair, sharpening, reinforcing, refitting, and similar services.
 * Uses the item escrow pattern: item is removed from player, stored in request,
 * and restored after GM approval + work duration.
 */

const MODULE_ID = "bobs-talking-npcs";
import { convertToGold } from "../../data/merchant-model.mjs";
import { localize, formatCurrency } from "../../utils/helpers.mjs";
import {
  createServiceRequest,
  ServiceRequestStatus,
  getCurrentGameTime
} from "../../data/service-request-model.mjs";
import { sendServiceRequestToGM, sendRepairMessage, getPrivateWhisperTargets } from "../../utils/chat.mjs";
import { emitToGM, SocketEvents } from "../../socket.mjs";

export const RepairExecutor = {
  id: "repair",
  serviceTypes: [
    "repair", "sharpen", "reinforce", "refitting", "resize",
    "custom_order", "alterations", "polish", "engrave",
    "hafting", "armor_spikes", "heraldry",
    "wheel_repair", "wagon_repair",
    "restringing", "cobbling", "cooperage"
  ],

  validate(ctx) {
    const errors = [];
    if (!ctx.actor) errors.push("No actor provided");
    if (!ctx.options?.itemId) errors.push("No item selected for service");
    return { valid: errors.length === 0, errors };
  },

  /**
   * Execute the repair service.
   * This ALWAYS creates a pending request (item escrow) regardless of approval mode,
   * because the item must be physically handed over for the work.
   */
  async execute(ctx) {
    const { actor, merchant, serviceDef, options } = ctx;

    const item = actor.items.get(options.itemId);
    if (!item) {
      return { success: false, message: localize("Shop.ItemNotFound") };
    }

    // Calculate cost
    const cost = await _calculateRepairCost(serviceDef, item);
    const gold = convertToGold(actor.system?.currency || {});

    if (gold < cost) {
      return { success: false, message: localize("Shop.InsufficientFunds") };
    }

    // ITEM ESCROW: Store full item data before removing
    const itemData = item.toObject();

    // Get queue position
    const activeOrders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
    const merchantOrders = activeOrders.filter(o => o.merchantId === merchant.id);
    const queuePosition = merchantOrders.length + 1;

    // Create service request
    const request = createServiceRequest({
      type: serviceDef.type || "repair",
      merchantId: merchant.id,
      merchantName: merchant.name || "Merchant",
      playerActorUuid: actor.uuid,
      playerActorId: actor.id,
      playerName: actor.name,
      playerId: game.user?.id,
      itemId: item.id,
      itemUuid: item.uuid,
      itemName: item.name,
      itemImg: item.img,
      itemType: item.type,
      itemData,
      queuePosition,
      cost,
      serviceName: serviceDef.name || "Repair",
      serviceIcon: serviceDef.icon || "fa-wrench"
    });

    // Store the request
    if (game.user.isGM) {
      const pendingRequests = game.settings.get(MODULE_ID, "pendingServiceRequests") || [];
      pendingRequests.push(request);
      await game.settings.set(MODULE_ID, "pendingServiceRequests", pendingRequests);
    } else {
      emitToGM(SocketEvents.SERVICE_REQUEST, { request });
    }

    // Remove item from player inventory
    await item.delete();
    console.log(`${MODULE_ID} | Item "${itemData.name}" escrowed for ${serviceDef.type || 'repair'} service`);

    // Notify GM
    await sendServiceRequestToGM({
      type: serviceDef.type || "repair",
      playerName: actor.name,
      merchantName: merchant.name || "Merchant",
      itemName: itemData.name,
      itemImg: itemData.img,
      cost,
      requestId: request.id,
      serviceName: serviceDef.name
    });

    ui.notifications.info(localize("Service.ItemDroppedOff", { item: itemData.name }));

    return {
      success: true,
      pending: true,
      requestId: request.id,
      cost,
      queuePosition,
      message: localize("Shop.Service.PendingApproval")
    };
  },

  /**
   * Called when a repair order is picked up (after GM approval + duration elapsed).
   * Restores the item from escrow.
   */
  async onPickup(order, actor, restoreItemFromEscrow) {
    const resultItem = await restoreItemFromEscrow(actor, order.itemData);

    await sendRepairMessage({
      playerName: order.playerName,
      merchantName: order.merchantName,
      itemName: resultItem.name,
      itemImg: resultItem.img,
      cost: order.cost,
      playerId: order.playerId
    });

    return { success: true, item: resultItem };
  },

  getDescription(ctx) {
    return ctx.serviceDef?.description || "Repair or modify an item.";
  }
};

async function _calculateRepairCost(serviceDef, item) {
  // Use centralized pricing calculator (supports percent, itemValue, and other modes)
  const { calculateServicePrice } = await import("../service-pricing.mjs");
  return calculateServicePrice(serviceDef, { item });
}
