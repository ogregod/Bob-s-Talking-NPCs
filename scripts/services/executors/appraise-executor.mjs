/**
 * Appraise Service Executor
 * Reveals the monetary value of items.
 */

const MODULE_ID = "bobs-talking-npcs";
import { convertToGold } from "../../data/merchant-model.mjs";
import { localize, formatCurrency } from "../../utils/helpers.mjs";
import { sendAppraiseMessage } from "../../utils/chat.mjs";

export const AppraiseExecutor = {
  id: "appraise",
  serviceTypes: ["appraise", "authenticate"],

  validate(ctx) {
    const errors = [];
    if (!ctx.actor) errors.push("No actor provided");
    if (!ctx.options?.itemId) errors.push("No item selected for appraisal");
    return { valid: errors.length === 0, errors };
  },

  async execute(ctx) {
    const { actor, merchant, serviceDef, options } = ctx;

    const item = actor.items.get(options.itemId);
    if (!item) {
      return { success: false, message: localize("Shop.ItemNotFound") };
    }

    const cost = serviceDef?.basePrice ?? 5;
    const gold = convertToGold(actor.system?.currency || {});

    if (gold < cost) {
      return { success: false, message: localize("Shop.InsufficientFunds") };
    }

    await ctx.deductGold(actor, cost);

    const value = item.system?.price?.value || 0;

    await sendAppraiseMessage({
      playerName: actor.name,
      merchantName: merchant?.name || "Merchant",
      itemName: item.name,
      itemImg: item.img,
      appraisedValue: value,
      cost,
      playerId: game.user?.id
    });

    return {
      success: true,
      cost,
      appraisedValue: value,
      message: `${item.name}: ${formatCurrency(value * 100)}`
    };
  },

  getDescription() {
    return "Determine the market value of an item.";
  }
};
