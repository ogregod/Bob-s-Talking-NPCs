/**
 * Rest Service Executor
 * Handles long rest, short rest, and lodging services.
 * Triggers Foundry VTT's rest mechanics and applies comfort bonuses.
 */

const MODULE_ID = "bobs-talking-npcs";
import { convertToGold } from "../../data/merchant-model.mjs";
import { localize, formatCurrency } from "../../utils/helpers.mjs";
import { getPrivateWhisperTargets } from "../../utils/chat.mjs";

export const RestExecutor = {
  id: "rest",
  serviceTypes: [
    "long_rest", "short_rest",
    "room_common", "room_private", "room_suite",
    "bath", "laundry"
  ],

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

    const serviceType = serviceDef.type;
    let resultMessage = "";

    switch (serviceType) {
      case "long_rest":
      case "room_common":
      case "room_private":
      case "room_suite":
        resultMessage = await _performLongRest(actor, serviceDef);
        break;

      case "short_rest":
        resultMessage = await _performShortRest(actor, serviceDef);
        break;

      case "bath":
        resultMessage = await _applyBathEffect(actor, serviceDef);
        break;

      case "laundry":
        resultMessage = `${actor.name}'s gear has been cleaned and refreshed.`;
        break;

      default:
        resultMessage = `${serviceDef.name} completed.`;
    }

    // Send chat message
    const content = `
      <div class="bobsnpc-chat-message service-rest ${serviceType}">
        <div class="service-header">
          <i class="fa-solid ${_getRestIcon(serviceType)}"></i>
          <strong>${serviceDef.name || "Rest"}</strong>
        </div>
        <div class="service-details">
          <p>${resultMessage}</p>
          ${cost > 0 ? `<p class="service-cost"><i class="fa-solid fa-coins"></i> ${formatCurrency(cost * 100)}</p>` : ''}
        </div>
      </div>
    `;

    await ChatMessage.create({
      content,
      whisper: getPrivateWhisperTargets(game.user?.id),
      speaker: { alias: merchant?.name || "Innkeeper" },
      flags: { [MODULE_ID]: { type: "serviceRest", serviceType } }
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
    return ctx.serviceDef?.description || "Rest and recovery services.";
  }
};

/**
 * Perform a long rest via Foundry's API
 */
async function _performLongRest(actor, serviceDef) {
  try {
    // Apply comfort bonus if it's a nice room
    const comfortBonus = serviceDef.customData?.comfortBonus || 0;

    if (comfortBonus > 0) {
      // Temporary HP bonus from comfortable rest
      const tempHp = actor.system?.attributes?.hp?.temp || 0;
      if (comfortBonus > tempHp) {
        await actor.update({ "system.attributes.hp.temp": comfortBonus });
      }
    }

    // Trigger the actual long rest
    await actor.longRest({ dialog: false, chat: true });

    const roomQuality = _getRoomQuality(serviceDef.type);
    return `${actor.name} enjoyed a ${roomQuality} and completed a long rest.${comfortBonus > 0 ? ` (+${comfortBonus} temporary HP from comfortable lodging)` : ''}`;
  } catch (err) {
    console.error(`${MODULE_ID} | Long rest failed:`, err);
    return `${actor.name} rested, but the rest mechanics could not be fully applied.`;
  }
}

/**
 * Perform a short rest
 */
async function _performShortRest(actor, serviceDef) {
  try {
    await actor.shortRest({ dialog: false, chat: true });
    return `${actor.name} completed a short rest.`;
  } catch (err) {
    console.error(`${MODULE_ID} | Short rest failed:`, err);
    return `${actor.name} rested briefly.`;
  }
}

/**
 * Apply bath effect - remove exhaustion level
 */
async function _applyBathEffect(actor, serviceDef) {
  const results = [];

  // Remove one level of exhaustion (homebrew mechanic)
  const exhaustion = actor.system?.attributes?.exhaustion || 0;
  if (exhaustion > 0 && (serviceDef.customData?.removeExhaustion !== false)) {
    const newExhaustion = Math.max(0, exhaustion - 1);
    await actor.update({ "system.attributes.exhaustion": newExhaustion });
    results.push(`Exhaustion reduced from ${exhaustion} to ${newExhaustion}`);
  }

  if (results.length === 0) {
    return `${actor.name} enjoyed a refreshing bath.`;
  }
  return `${actor.name} enjoyed a refreshing bath. ${results.join("; ")}`;
}

function _getRoomQuality(serviceType) {
  const qualities = {
    room_common: "night in the common room",
    room_private: "night in a private room",
    room_suite: "luxurious night in a suite",
    long_rest: "full night's rest"
  };
  return qualities[serviceType] || "rest";
}

function _getRestIcon(serviceType) {
  const icons = {
    long_rest: "fa-bed",
    short_rest: "fa-mug-hot",
    room_common: "fa-bed",
    room_private: "fa-door-closed",
    room_suite: "fa-crown",
    bath: "fa-bath",
    laundry: "fa-shirt"
  };
  return icons[serviceType] || "fa-bed";
}
