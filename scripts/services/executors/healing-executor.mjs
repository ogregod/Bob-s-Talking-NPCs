/**
 * Healing Service Executor
 * Handles healing, cure disease, cure poison, restoration, resurrection, and blessings.
 * Actually modifies actor HP and removes conditions via Active Effects.
 */

const MODULE_ID = "bobs-talking-npcs";
import { convertToGold } from "../../data/merchant-model.mjs";
import { localize, formatCurrency } from "../../utils/helpers.mjs";
import { getPrivateWhisperTargets } from "../../utils/chat.mjs";

export const HealingExecutor = {
  id: "healing",
  serviceTypes: ["healing", "cure_disease", "cure_poison", "restoration", "resurrection", "blessing"],

  validate(ctx) {
    const errors = [];
    if (!ctx.actor) errors.push("No actor provided");
    if (ctx.serviceDef?.type === "resurrection" && !ctx.options?.targetActorUuid) {
      // Resurrection may target a different (dead) actor
      // But can also target self for pre-emptive services
    }
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
    let effectData = null;

    switch (serviceType) {
      case "healing":
        resultMessage = await _applyHealing(actor, serviceDef);
        break;

      case "cure_disease":
        resultMessage = await _removeCondition(actor, ["diseased"], "Disease");
        break;

      case "cure_poison":
        resultMessage = await _removeCondition(actor, ["poisoned"], "Poison");
        break;

      case "restoration":
        resultMessage = await _applyRestoration(actor, serviceDef, options);
        break;

      case "resurrection":
        resultMessage = await _applyResurrection(actor, options);
        break;

      case "blessing":
        resultMessage = await _applyBlessing(actor, serviceDef);
        break;

      default:
        resultMessage = `${serviceDef.name} completed.`;
    }

    // Send chat message
    const merchantName = merchant?.name || "Merchant";
    const healIcon = _getServiceIcon(serviceType);

    const content = `
      <div class="bobsnpc-chat-message service-healing ${serviceType}">
        <div class="service-header">
          <i class="fa-solid ${healIcon}"></i>
          <strong>${serviceDef.name || "Healing Service"}</strong>
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
      speaker: { alias: merchantName },
      flags: { [MODULE_ID]: { type: "serviceHealing", serviceType } }
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
    return ctx.serviceDef?.description || "Healing services.";
  }
};

/**
 * Apply healing to actor
 */
async function _applyHealing(actor, serviceDef) {
  const hp = actor.system?.attributes?.hp;
  if (!hp) return "Could not determine hit points.";

  const maxHp = hp.max || 0;
  const currentHp = hp.value || 0;

  if (currentHp >= maxHp) {
    return `${actor.name} is already at full health.`;
  }

  // Determine heal amount from service config or heal to full
  const healAmount = serviceDef.customData?.healAmount || (maxHp - currentHp);
  const newHp = Math.min(currentHp + healAmount, maxHp);
  const actualHeal = newHp - currentHp;

  await actor.update({ "system.attributes.hp.value": newHp });

  return `${actor.name} healed for ${actualHeal} hit points. (${newHp}/${maxHp} HP)`;
}

/**
 * Remove conditions/effects matching status IDs
 */
async function _removeCondition(actor, statusIds, conditionName) {
  const removedEffects = [];

  for (const effect of actor.effects) {
    const statusId = effect.statuses?.first() || effect.flags?.core?.statusId;
    if (statusId && statusIds.includes(statusId)) {
      removedEffects.push(effect.name || conditionName);
      await effect.delete();
    }
  }

  // Also check for disease/poison flags from the dnd5e system
  for (const effect of actor.effects) {
    const isDiseased = effect.flags?.dnd5e?.disease;
    const isPoisoned = effect.flags?.dnd5e?.poisoned;
    if ((statusIds.includes("diseased") && isDiseased) ||
        (statusIds.includes("poisoned") && isPoisoned)) {
      removedEffects.push(effect.name || conditionName);
      await effect.delete();
    }
  }

  if (removedEffects.length > 0) {
    return `${conditionName} cured! Removed: ${removedEffects.join(", ")}`;
  }
  return `No ${conditionName.toLowerCase()} conditions found on ${actor.name}.`;
}

/**
 * Apply restoration (Greater/Lesser)
 */
async function _applyRestoration(actor, serviceDef, options) {
  const results = [];

  // Remove exhaustion levels
  const exhaustion = actor.system?.attributes?.exhaustion || 0;
  if (exhaustion > 0) {
    const levelsToRemove = serviceDef.customData?.exhaustionLevels || 1;
    const newExhaustion = Math.max(0, exhaustion - levelsToRemove);
    await actor.update({ "system.attributes.exhaustion": newExhaustion });
    results.push(`Exhaustion reduced from ${exhaustion} to ${newExhaustion}`);
  }

  // Remove debilitating conditions (blinded, deafened, paralyzed, etc.)
  const restorationConditions = ["blinded", "deafened", "paralyzed", "petrified", "stunned"];
  for (const effect of actor.effects) {
    const statusId = effect.statuses?.first() || effect.flags?.core?.statusId;
    if (statusId && restorationConditions.includes(statusId)) {
      results.push(`Removed: ${effect.name || statusId}`);
      await effect.delete();
    }
  }

  // Restore ability score reductions (if any)
  // This is system-specific and may require Active Effect removal

  if (results.length === 0) {
    return `${actor.name} has no conditions to restore.`;
  }
  return `Restoration applied to ${actor.name}: ${results.join("; ")}`;
}

/**
 * Apply resurrection
 */
async function _applyResurrection(actor, options) {
  const hp = actor.system?.attributes?.hp;
  if (!hp) return "Could not determine hit points.";

  // Check if actor is at 0 HP (dead)
  if (hp.value > 0) {
    return `${actor.name} is not dead and does not need resurrection.`;
  }

  // Set HP to 1
  await actor.update({
    "system.attributes.hp.value": 1,
    "system.attributes.death.success": 0,
    "system.attributes.death.failure": 0
  });

  // Remove the "dead" status effect if present
  for (const effect of actor.effects) {
    const statusId = effect.statuses?.first() || effect.flags?.core?.statusId;
    if (statusId === "dead") {
      await effect.delete();
    }
  }

  return `${actor.name} has been raised from the dead! (1 HP)`;
}

/**
 * Apply a blessing (temporary buff)
 */
async function _applyBlessing(actor, serviceDef) {
  // Create a temporary Active Effect for the blessing
  const blessingData = serviceDef.customData?.blessing || {};
  const duration = blessingData.duration || 86400; // Default: 24h in-game

  const effectData = {
    name: serviceDef.name || "Divine Blessing",
    icon: `icons/svg/${serviceDef.icon?.replace("fa-", "") || "aura"}.svg`,
    origin: `${MODULE_ID}.blessing`,
    duration: {
      seconds: duration
    },
    flags: {
      [MODULE_ID]: {
        type: "serviceBlessing",
        serviceType: serviceDef.type
      }
    },
    changes: blessingData.changes || [
      {
        key: "system.bonuses.abilities.save",
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: "+1",
        priority: 20
      }
    ]
  };

  await ActiveEffect.create(effectData, { parent: actor });

  return `${actor.name} has received a blessing! (${serviceDef.name})`;
}

function _getServiceIcon(serviceType) {
  const icons = {
    healing: "fa-heart",
    cure_disease: "fa-virus-slash",
    cure_poison: "fa-flask-vial",
    restoration: "fa-sparkles",
    resurrection: "fa-cross",
    blessing: "fa-hand-sparkles"
  };
  return icons[serviceType] || "fa-heart";
}
