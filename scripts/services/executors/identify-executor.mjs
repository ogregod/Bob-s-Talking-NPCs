/**
 * Identify Service Executor
 * Marks items as identified in the D&D 5e system.
 */

const MODULE_ID = "bobs-talking-npcs";
import { convertToGold } from "../../data/merchant-model.mjs";
import { localize } from "../../utils/helpers.mjs";
import { sendIdentifyMessage } from "../../utils/chat.mjs";

export const IdentifyExecutor = {
  id: "identify",
  serviceTypes: ["identify"],

  validate(ctx) {
    const errors = [];
    if (!ctx.actor) errors.push("No actor provided");
    if (!ctx.options?.itemId) errors.push("No item selected for identification");
    return { valid: errors.length === 0, errors };
  },

  async execute(ctx) {
    const { actor, merchant, serviceDef, options } = ctx;

    const item = actor.items.get(options.itemId);
    if (!item) {
      return { success: false, message: localize("Shop.ItemNotFound") };
    }

    // Already identified?
    if (item.system?.identified === true) {
      return { success: false, message: localize("Shop.ItemAlreadyIdentified") };
    }

    const cost = serviceDef?.basePrice ?? 25;
    const gold = convertToGold(actor.system?.currency || {});

    if (gold < cost) {
      return { success: false, message: localize("Shop.InsufficientFunds") };
    }

    await ctx.deductGold(actor, cost);

    // Mark item as identified
    await item.update({ "system.identified": true });

    // Send private chat message
    await sendIdentifyMessage({
      playerName: actor.name,
      merchantName: merchant?.name || "Merchant",
      itemName: item.name,
      itemImg: item.img,
      cost,
      playerId: game.user?.id
    });

    return {
      success: true,
      cost,
      message: `${item.name} ${localize("Shop.HasBeenIdentified")}`
    };
  },

  getDescription() {
    return "Reveal the properties of an unidentified magic item.";
  }
};
