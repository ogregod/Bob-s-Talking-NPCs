/**
 * Item Modification Service Executor
 * Handles silvering, armor spikes, heraldry, hafting, hoof care, shoeing,
 * and other services that modify item properties.
 */

const MODULE_ID = "bobs-talking-npcs";
import { convertToGold } from "../../data/merchant-model.mjs";
import { localize, formatCurrency } from "../../utils/helpers.mjs";
import { getPrivateWhisperTargets } from "../../utils/chat.mjs";

export const ItemModificationExecutor = {
  id: "itemModification",
  serviceTypes: [
    "silvering", "blade_honing", "armor_spikes", "heraldry",
    "hafting", "hoof_care", "shoeing",
    "fine_metalwork", "distillery_parts",
    "dyeing", "waterproofing",
    "key_cutting", "lock_opening",
    "caulking"
  ],

  validate(ctx) {
    const errors = [];
    if (!ctx.actor) errors.push("No actor provided");
    // Most item modification services require an item
    const noItemTypes = ["hoof_care", "shoeing", "heraldry", "distillery_parts", "key_cutting"];
    if (!noItemTypes.includes(ctx.serviceDef?.type) && !ctx.options?.itemId) {
      errors.push("No item selected for modification");
    }
    return { valid: errors.length === 0, errors };
  },

  async execute(ctx) {
    const { actor, merchant, serviceDef, options } = ctx;

    // Calculate cost
    let cost = serviceDef?.basePrice ?? 0;
    let item = null;

    if (options?.itemId) {
      item = actor.items.get(options.itemId);
      if (!item) {
        return { success: false, message: localize("Shop.ItemNotFound") };
      }
      if (serviceDef.priceType === "percent") {
        const itemValue = item.system?.price?.value || 0;
        cost = Math.round(itemValue * ((serviceDef.pricePercent || serviceDef.basePrice || 10) / 100));
      }
    }

    if (cost > 0) {
      const gold = convertToGold(actor.system?.currency || {});
      if (gold < cost) {
        return { success: false, message: localize("Shop.InsufficientFunds") };
      }
      await ctx.deductGold(actor, cost);
    }

    const serviceType = serviceDef.type;
    let resultMessage = "";

    switch (serviceType) {
      case "silvering":
        resultMessage = await _applySilvering(item);
        break;

      case "blade_honing":
        resultMessage = await _applyBladeHoning(actor, item);
        break;

      case "armor_spikes":
        resultMessage = await _applyArmorSpikes(item);
        break;

      case "heraldry":
        resultMessage = _applyHeraldry(item, options);
        break;

      case "hafting":
        resultMessage = _applyHafting(item);
        break;

      case "hoof_care":
      case "shoeing":
        resultMessage = _applyHoofCare(serviceType);
        break;

      case "dyeing":
        resultMessage = _applyDyeing(item, options);
        break;

      case "waterproofing":
        resultMessage = await _applyWaterproofing(item);
        break;

      case "key_cutting":
        resultMessage = "A copy of the key has been made.";
        break;

      case "lock_opening":
        resultMessage = "The lock has been opened by the locksmith.";
        break;

      default:
        resultMessage = `${serviceDef.name} has been applied${item ? ` to ${item.name}` : ''}.`;
    }

    // Send chat message
    const content = `
      <div class="bobsnpc-chat-message service-modification ${serviceType}">
        <div class="service-header">
          <i class="fa-solid ${serviceDef.icon || 'fa-hammer'}"></i>
          <strong>${serviceDef.name || "Item Modification"}</strong>
        </div>
        <div class="service-details">
          ${item ? `<div class="modified-item"><img src="${item.img}" alt="${item.name}" class="item-icon"><span>${item.name}</span></div>` : ''}
          <p>${resultMessage}</p>
          ${cost > 0 ? `<p class="service-cost"><i class="fa-solid fa-coins"></i> ${formatCurrency(cost * 100)}</p>` : ''}
        </div>
      </div>
    `;

    await ChatMessage.create({
      content,
      whisper: getPrivateWhisperTargets(game.user?.id),
      speaker: { alias: merchant?.name || "Craftsman" },
      flags: { [MODULE_ID]: { type: "serviceModification", serviceType } }
    });

    return {
      success: true,
      cost,
      serviceType,
      serviceName: serviceDef.name,
      message: resultMessage
    };
  },

  getDescription(ctx) {
    return ctx.serviceDef?.description || "Modify or enhance an item.";
  }
};

/**
 * Apply silver coating to a weapon
 */
async function _applySilvering(item) {
  if (!item) return "No item to silver.";

  // Set the silvered property on the item
  const updates = {};
  // D&D 5e system stores properties as an object or set
  const properties = item.system?.properties;
  if (properties instanceof Set) {
    properties.add("sil");
    updates["system.properties"] = [...properties];
  } else if (typeof properties === "object") {
    updates["system.properties.sil"] = true;
  }

  // Also add a flag for tracking
  updates[`flags.${MODULE_ID}.silvered`] = true;

  await item.update(updates);
  return `${item.name} has been coated in silver. It now counts as silvered for overcoming resistance.`;
}

/**
 * Apply blade honing - temporary damage buff
 */
async function _applyBladeHoning(actor, item) {
  if (!item) return "No weapon to hone.";

  // Create a temporary Active Effect
  const effectData = {
    name: `Honed: ${item.name}`,
    icon: item.img || "icons/svg/sword.svg",
    origin: `${MODULE_ID}.bladeHoning`,
    duration: { seconds: 86400 }, // 24h in-game
    flags: { [MODULE_ID]: { type: "bladeHoning", itemId: item.id } },
    changes: [
      {
        key: "system.bonuses.mwak.damage",
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: "+1",
        priority: 20
      }
    ]
  };

  await ActiveEffect.create(effectData, { parent: actor });
  return `${item.name} has been honed to a razor edge. (+1 melee damage for 24 hours)`;
}

/**
 * Apply armor spikes
 */
async function _applyArmorSpikes(item) {
  if (!item) return "No armor to modify.";

  await item.update({
    [`flags.${MODULE_ID}.armorSpikes`]: true
  });

  return `Armor spikes have been added to ${item.name}. Grappling opponents take 1d4 piercing damage.`;
}

function _applyHeraldry(item, options) {
  const crest = options?.crest || "a noble crest";
  return `${crest} has been etched onto ${item?.name || "the item"}.`;
}

function _applyHafting(item) {
  return `The handle on ${item?.name || "the weapon"} has been replaced with a fresh haft.`;
}

function _applyHoofCare(serviceType) {
  if (serviceType === "shoeing") {
    return "New iron shoes have been fitted. The mount is ready for travel.";
  }
  return "The mount's hooves have been trimmed and treated.";
}

function _applyDyeing(item, options) {
  const color = options?.color || "a new color";
  return `${item?.name || "The item"} has been dyed ${color}.`;
}

async function _applyWaterproofing(item) {
  if (!item) return "No item to waterproof.";

  await item.update({
    [`flags.${MODULE_ID}.waterproofed`]: true
  });

  return `${item.name} has been waterproofed with protective grease.`;
}
