/**
 * Item Creation Service Executor
 * Handles brew potion, scribe scroll, custom orders, and any service
 * that creates a new item in the player's inventory.
 */

const MODULE_ID = "bobs-talking-npcs";
import { convertToGold } from "../../data/merchant-model.mjs";
import { localize, formatCurrency } from "../../utils/helpers.mjs";
import { getPrivateWhisperTargets } from "../../utils/chat.mjs";

export const ItemCreationExecutor = {
  id: "itemCreation",
  serviceTypes: ["brew_potion", "scribe_scroll"],

  validate(ctx) {
    const errors = [];
    if (!ctx.actor) errors.push("No actor provided");
    return { valid: errors.length === 0, errors };
  },

  async execute(ctx) {
    const { actor, merchant, serviceDef, options } = ctx;

    const cost = serviceDef?.basePrice ?? 0;
    if (cost > 0) {
      const gold = convertToGold(actor.system?.currency || {});
      if (gold < cost) {
        return { success: false, message: localize("Shop.InsufficientFunds") };
      }
      await ctx.deductGold(actor, cost);
    }

    let resultMessage = "";
    let createdItem = null;

    // Try to create the item from a compendium UUID or inline data
    const outputUuid = serviceDef.customData?.outputItemUuid || options?.outputItemUuid;
    const outputData = serviceDef.customData?.outputItemData || options?.outputItemData;

    if (outputUuid) {
      // Load from compendium
      try {
        const sourceItem = await fromUuid(outputUuid);
        if (sourceItem) {
          const itemData = sourceItem.toObject();
          const created = await actor.createEmbeddedDocuments("Item", [itemData]);
          createdItem = created[0];
          resultMessage = `${createdItem.name} has been created and added to ${actor.name}'s inventory.`;
        } else {
          resultMessage = `The ${serviceDef.name} service has been completed. The GM will provide the result.`;
        }
      } catch (err) {
        console.error(`${MODULE_ID} | Failed to create item from UUID:`, err);
        resultMessage = `The ${serviceDef.name} service has been completed. The GM will provide the item.`;
      }
    } else if (outputData) {
      // Create from inline data
      try {
        const created = await actor.createEmbeddedDocuments("Item", [outputData]);
        createdItem = created[0];
        resultMessage = `${createdItem.name} has been created and added to ${actor.name}'s inventory.`;
      } catch (err) {
        console.error(`${MODULE_ID} | Failed to create item from data:`, err);
        resultMessage = `The ${serviceDef.name} service has been completed. The GM will provide the item.`;
      }
    } else {
      // No item data configured - generic result
      resultMessage = `The ${serviceDef.name || 'item creation'} service has been completed. The GM will provide the crafted item.`;
    }

    // Send chat message
    const content = `
      <div class="bobsnpc-chat-message service-creation ${serviceDef.type}">
        <div class="service-header">
          <i class="fa-solid ${serviceDef.icon || 'fa-flask'}"></i>
          <strong>${serviceDef.name || "Item Crafted"}</strong>
        </div>
        <div class="service-details">
          ${createdItem ? `<div class="created-item"><img src="${createdItem.img}" alt="${createdItem.name}" class="item-icon"><span>${createdItem.name}</span></div>` : ''}
          <p>${resultMessage}</p>
          ${cost > 0 ? `<p class="service-cost"><i class="fa-solid fa-coins"></i> ${formatCurrency(cost * 100)}</p>` : ''}
        </div>
      </div>
    `;

    await ChatMessage.create({
      content,
      whisper: getPrivateWhisperTargets(game.user?.id),
      speaker: { alias: merchant?.name || "Craftsman" },
      flags: { [MODULE_ID]: { type: "serviceCreation", serviceType: serviceDef.type } }
    });

    return {
      success: true,
      cost,
      serviceType: serviceDef.type,
      serviceName: serviceDef.name,
      message: resultMessage,
      data: { createdItemId: createdItem?.id }
    };
  },

  getDescription(ctx) {
    return ctx.serviceDef?.description || "Create or craft an item.";
  }
};
