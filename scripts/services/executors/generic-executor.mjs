/**
 * Generic Service Executor - Fallback
 * Handles any service type that doesn't have a dedicated executor.
 * Deducts gold and posts a chat message. No mechanical effects.
 */

const MODULE_ID = "bobs-talking-npcs";
import { convertToGold } from "../../data/merchant-model.mjs";
import { localize, formatCurrency } from "../../utils/helpers.mjs";

export const GenericExecutor = {
  id: "generic",
  serviceTypes: [], // Catches everything not claimed by other executors

  validate(ctx) {
    const errors = [];
    if (!ctx.actor) errors.push("No actor provided");
    if (!ctx.serviceDef) errors.push("No service definition provided");
    return { valid: errors.length === 0, errors };
  },

  async execute(ctx) {
    const { actor, merchant, serviceDef, options } = ctx;
    const cost = _calculateCost(serviceDef, actor, options);

    // Check funds
    if (cost > 0) {
      const gold = convertToGold(actor.system?.currency || {});
      if (gold < cost) {
        return { success: false, message: localize("Shop.InsufficientFunds") };
      }
      await ctx.deductGold(actor, cost);
    }

    // Send a chat message about the completed service
    const merchantName = merchant?.name || "Merchant";
    const content = `
      <div class="bobsnpc-chat-message service-complete">
        <div class="service-header">
          <i class="fa-solid ${serviceDef.icon || 'fa-concierge-bell'}"></i>
          <strong>${serviceDef.name || serviceDef.type}</strong>
        </div>
        <div class="service-details">
          <p>${serviceDef.description || localize("Shop.ServiceComplete", { service: serviceDef.name, cost: formatCurrency(cost * 100) })}</p>
          ${cost > 0 ? `<p class="service-cost"><i class="fa-solid fa-coins"></i> ${formatCurrency(cost * 100)}</p>` : ''}
        </div>
      </div>
    `;

    await ChatMessage.create({
      content,
      whisper: _getWhisperTargets(),
      speaker: { alias: merchantName },
      flags: { [MODULE_ID]: { type: "serviceComplete", serviceType: serviceDef.type } }
    });

    return {
      success: true,
      cost,
      serviceType: serviceDef.type,
      serviceName: serviceDef.name,
      message: localize("Shop.ServiceComplete", { service: serviceDef.name, cost: formatCurrency(cost * 100) })
    };
  },

  getDescription(ctx) {
    return ctx.serviceDef?.description || "A general service.";
  }
};

/**
 * Calculate cost based on service definition
 */
function _calculateCost(serviceDef, actor, options) {
  let cost = serviceDef.basePrice || 0;

  if (serviceDef.priceType === "percent" && options?.itemId) {
    const item = actor.items.get(options.itemId);
    if (item) {
      const itemValue = item.system?.price?.value || 0;
      cost = Math.round(itemValue * ((serviceDef.pricePercent || serviceDef.basePrice || 10) / 100));
    }
  } else if (serviceDef.priceType === "perDay" && options?.days) {
    cost = (serviceDef.pricePerUnit || serviceDef.basePrice || 0) * options.days;
  } else if (serviceDef.priceType === "perItem" && options?.quantity) {
    cost = (serviceDef.pricePerUnit || serviceDef.basePrice || 0) * options.quantity;
  }

  return cost;
}

/**
 * Get whisper targets for private messages
 */
function _getWhisperTargets() {
  const userId = game.user?.id;
  if (!userId) return [];
  // Whisper to self + all GMs
  const targets = [userId];
  for (const user of game.users) {
    if (user.isGM && user.id !== userId) targets.push(user.id);
  }
  return targets;
}
