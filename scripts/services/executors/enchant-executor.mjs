/**
 * Enchant Service Executor
 * Handles enchanting, disenchanting, recharging, and attuning.
 * Uses item escrow pattern with enchantment failure mechanics.
 */

const MODULE_ID = "bobs-talking-npcs";
import { convertToGold } from "../../data/merchant-model.mjs";
import { localize } from "../../utils/helpers.mjs";
import {
  createServiceRequest,
  ServiceRequestStatus,
  getCurrentGameTime
} from "../../data/service-request-model.mjs";
import { sendServiceRequestToGM, sendEnchantMessage, getPrivateWhisperTargets } from "../../utils/chat.mjs";
import { emitToGM, SocketEvents } from "../../socket.mjs";
import { FailConsequence } from "../../data/enchantment-model.mjs";

export const EnchantExecutor = {
  id: "enchant",
  serviceTypes: ["enchant", "disenchant", "recharge", "attune", "scribe_scroll", "brew_potion", "remove_curse"],

  validate(ctx) {
    const errors = [];
    if (!ctx.actor) errors.push("No actor provided");
    if (!ctx.options?.itemId) errors.push("No item selected");
    // Enchant specifically requires enchantment selection
    if (ctx.serviceDef?.type === "enchant" && !ctx.options?.enchantmentId) {
      errors.push("No enchantment selected");
    }
    return { valid: errors.length === 0, errors };
  },

  async execute(ctx) {
    const { actor, merchant, serviceDef, options } = ctx;

    const item = actor.items.get(options.itemId);
    if (!item) {
      return { success: false, message: localize("Shop.ItemNotFound") };
    }

    // Get enchantment info if applicable
    const enchantmentId = options.enchantmentId;
    const enchantmentHandler = game.bobsnpc?.handlers?.enchantment;
    let enchantment = null;
    let cost = 0;

    if (enchantmentId && enchantmentHandler) {
      enchantment = enchantmentHandler.getEnchantment(enchantmentId);
      if (!enchantment) {
        return { success: false, message: localize("Enchantment.NotFound") };
      }

      const { calculateEnchantmentCost } = await import("../../data/enchantment-model.mjs");
      const priceModifier = serviceDef?.enchantmentPriceModifier || merchant.services?.enchantmentPriceModifier || 1;
      cost = calculateEnchantmentCost(enchantment, item.system?.rarity || "common", priceModifier);
    } else {
      // Non-enchant services (disenchant, recharge, etc.) use service price
      cost = serviceDef?.basePrice || 0;
      if (serviceDef?.priceType === "percent") {
        const basePrice = item.system?.price?.value || 100;
        cost = Math.round(basePrice * ((serviceDef.pricePercent || cost || 10) / 100));
      }
    }

    const gold = convertToGold(actor.system?.currency || {});
    if (gold < cost) {
      return { success: false, message: localize("Shop.InsufficientFunds") };
    }

    // ITEM ESCROW
    const itemData = item.toObject();

    const activeOrders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
    const merchantOrders = activeOrders.filter(o => o.merchantId === merchant.id);
    const queuePosition = merchantOrders.length + 1;

    const request = createServiceRequest({
      type: serviceDef.type || "enchant",
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
      enchantmentId: enchantmentId || null,
      enchantmentName: enchantment?.name || serviceDef.name || "Enchantment",
      cost,
      serviceName: serviceDef.name || "Enchantment",
      serviceIcon: serviceDef.icon || "fa-wand-magic-sparkles"
    });

    if (game.user.isGM) {
      const pendingRequests = game.settings.get(MODULE_ID, "pendingServiceRequests") || [];
      pendingRequests.push(request);
      await game.settings.set(MODULE_ID, "pendingServiceRequests", pendingRequests);
    } else {
      emitToGM(SocketEvents.SERVICE_REQUEST, { request });
    }

    await item.delete();
    console.log(`${MODULE_ID} | Item "${itemData.name}" escrowed for ${serviceDef.type || 'enchant'} service`);

    await sendServiceRequestToGM({
      type: serviceDef.type || "enchant",
      playerName: actor.name,
      merchantName: merchant.name || "Merchant",
      itemName: itemData.name,
      itemImg: itemData.img,
      enchantmentName: enchantment?.name || serviceDef.name,
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
   * Called on pickup. Handles enchantment failure rolls.
   */
  async onPickup(order, actor, restoreItemFromEscrow, handleFailedEnchantment, applyEnchantmentAndRestore) {
    const enchantmentHandler = game.bobsnpc?.handlers?.enchantment;
    let enchantment = null;

    if (order.enchantmentId && enchantmentHandler) {
      enchantment = enchantmentHandler.getEnchantment(order.enchantmentId);
    }

    // Roll for failure if not already rolled
    if (order.failRollResult === null && enchantment && enchantment.failRate > 0) {
      const failRoll = Math.random() * 100;
      order.failRollResult = failRoll;
      order.enchantmentFailed = failRoll < enchantment.failRate;
      if (order.enchantmentFailed) {
        order.failConsequence = enchantment.failConsequence || FailConsequence.NONE;
      }
    }

    if (order.enchantmentFailed) {
      const failResult = await handleFailedEnchantment(actor, order, enchantment);
      return { success: true, item: failResult.item, failed: true, failConsequence: order.failConsequence };
    }

    // Success: apply enchantment
    const resultItem = await applyEnchantmentAndRestore(actor, order, enchantment);

    await sendEnchantMessage({
      playerName: order.playerName,
      merchantName: order.merchantName,
      itemName: resultItem.name,
      itemImg: resultItem.img,
      enchantmentName: order.enchantmentName,
      cost: order.cost,
      playerId: order.playerId
    });

    return { success: true, item: resultItem };
  },

  getDescription(ctx) {
    return ctx.serviceDef?.description || "Apply magical enchantments to items.";
  }
};
