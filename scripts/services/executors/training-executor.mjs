/**
 * Training Service Executor
 * Handles skill, weapon, tool, and language training.
 * Tracks training progress via actor flags and grants proficiency on completion.
 */

const MODULE_ID = "bobs-talking-npcs";
import { convertToGold } from "../../data/merchant-model.mjs";
import { localize, formatCurrency } from "../../utils/helpers.mjs";
import { getPrivateWhisperTargets } from "../../utils/chat.mjs";

export const TrainingExecutor = {
  id: "training",
  serviceTypes: ["skill_training", "weapon_training", "tool_training", "language_training", "sparring"],

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
      case "skill_training":
        resultMessage = await _trainSkill(actor, serviceDef, options);
        break;

      case "weapon_training":
        resultMessage = await _trainWeapon(actor, serviceDef, options);
        break;

      case "tool_training":
        resultMessage = await _trainTool(actor, serviceDef, options);
        break;

      case "language_training":
        resultMessage = await _trainLanguage(actor, serviceDef, options);
        break;

      case "sparring":
        resultMessage = await _sparringSession(actor, serviceDef, options);
        break;

      default:
        resultMessage = `${serviceDef.name} completed.`;
    }

    // Send chat message
    const content = `
      <div class="bobsnpc-chat-message service-training ${serviceType}">
        <div class="service-header">
          <i class="fa-solid ${_getTrainingIcon(serviceType)}"></i>
          <strong>${serviceDef.name || "Training"}</strong>
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
      speaker: { alias: merchant?.name || "Trainer" },
      flags: { [MODULE_ID]: { type: "serviceTraining", serviceType } }
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
    return ctx.serviceDef?.description || "Training and practice services.";
  }
};

/**
 * Track skill training progress
 */
async function _trainSkill(actor, serviceDef, options) {
  const trainingTarget = options?.skill || serviceDef.customData?.skill;
  if (!trainingTarget) {
    return `${actor.name} participated in a training session.`;
  }

  // Get existing training progress
  const trainingFlags = actor.getFlag(MODULE_ID, "training") || {};
  const existing = trainingFlags[`skill_${trainingTarget}`] || { hoursCompleted: 0, hoursRequired: 250 };

  const hoursPerSession = serviceDef.customData?.hoursPerSession || 8;
  existing.hoursCompleted += hoursPerSession;
  existing.lastSession = Date.now();

  if (existing.hoursCompleted >= existing.hoursRequired) {
    // Training complete - grant proficiency
    existing.completed = true;
    await actor.setFlag(MODULE_ID, `training.skill_${trainingTarget}`, existing);

    // Try to set skill proficiency
    const skillPath = `system.skills.${trainingTarget}.proficient`;
    const currentProf = foundry.utils.getProperty(actor, skillPath);
    if (currentProf === 0) {
      await actor.update({ [skillPath]: 1 });
      return `Training complete! ${actor.name} is now proficient in ${_formatSkillName(trainingTarget)}!`;
    }
    return `${actor.name} has completed ${trainingTarget} training. (Already proficient)`;
  }

  await actor.setFlag(MODULE_ID, `training.skill_${trainingTarget}`, existing);

  const remaining = existing.hoursRequired - existing.hoursCompleted;
  return `${actor.name} trained in ${_formatSkillName(trainingTarget)}. Progress: ${existing.hoursCompleted}/${existing.hoursRequired} hours (${remaining}h remaining)`;
}

/**
 * Track weapon training progress
 */
async function _trainWeapon(actor, serviceDef, options) {
  const weapon = options?.weapon || serviceDef.customData?.weapon;

  const trainingFlags = actor.getFlag(MODULE_ID, "training") || {};
  const key = `weapon_${weapon || "general"}`;
  const existing = trainingFlags[key] || { hoursCompleted: 0, hoursRequired: 250 };

  const hoursPerSession = serviceDef.customData?.hoursPerSession || 8;
  existing.hoursCompleted += hoursPerSession;
  existing.lastSession = Date.now();

  await actor.setFlag(MODULE_ID, `training.${key}`, existing);

  if (existing.hoursCompleted >= existing.hoursRequired) {
    existing.completed = true;
    return `Weapon training complete! ${actor.name} has mastered ${weapon || "combat techniques"}!`;
  }

  const remaining = existing.hoursRequired - existing.hoursCompleted;
  return `${actor.name} trained with ${weapon || "weapons"}. Progress: ${existing.hoursCompleted}/${existing.hoursRequired} hours (${remaining}h remaining)`;
}

/**
 * Track tool training progress
 */
async function _trainTool(actor, serviceDef, options) {
  const tool = options?.tool || serviceDef.customData?.tool;

  const trainingFlags = actor.getFlag(MODULE_ID, "training") || {};
  const key = `tool_${tool || "general"}`;
  const existing = trainingFlags[key] || { hoursCompleted: 0, hoursRequired: 250 };

  const hoursPerSession = serviceDef.customData?.hoursPerSession || 8;
  existing.hoursCompleted += hoursPerSession;
  existing.lastSession = Date.now();

  await actor.setFlag(MODULE_ID, `training.${key}`, existing);

  if (existing.hoursCompleted >= existing.hoursRequired) {
    existing.completed = true;
    return `Tool training complete! ${actor.name} is now proficient with ${tool || "tools"}!`;
  }

  const remaining = existing.hoursRequired - existing.hoursCompleted;
  return `${actor.name} trained with ${tool || "tools"}. Progress: ${existing.hoursCompleted}/${existing.hoursRequired} hours (${remaining}h remaining)`;
}

/**
 * Track language training
 */
async function _trainLanguage(actor, serviceDef, options) {
  const language = options?.language || serviceDef.customData?.language;

  const trainingFlags = actor.getFlag(MODULE_ID, "training") || {};
  const key = `language_${language || "common"}`;
  const existing = trainingFlags[key] || { hoursCompleted: 0, hoursRequired: 250 };

  const hoursPerSession = serviceDef.customData?.hoursPerSession || 8;
  existing.hoursCompleted += hoursPerSession;
  existing.lastSession = Date.now();

  await actor.setFlag(MODULE_ID, `training.${key}`, existing);

  if (existing.hoursCompleted >= existing.hoursRequired) {
    existing.completed = true;
    return `Language training complete! ${actor.name} can now speak ${language || "the language"}!`;
  }

  const remaining = existing.hoursRequired - existing.hoursCompleted;
  return `${actor.name} studied ${language || "languages"}. Progress: ${existing.hoursCompleted}/${existing.hoursRequired} hours (${remaining}h remaining)`;
}

/**
 * Sparring session - temporary combat buff
 */
async function _sparringSession(actor, serviceDef, options) {
  // Apply a temporary combat buff
  const effectData = {
    name: "Combat Training",
    icon: "icons/svg/sword.svg",
    origin: `${MODULE_ID}.sparring`,
    duration: { seconds: 86400 }, // 24h in-game
    flags: { [MODULE_ID]: { type: "sparringBuff" } },
    changes: [
      {
        key: "system.bonuses.mwak.attack",
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: "+1",
        priority: 20
      }
    ]
  };

  await ActiveEffect.create(effectData, { parent: actor });

  return `${actor.name} completed a sparring session. (+1 to melee attack rolls for 24 hours)`;
}

function _formatSkillName(skill) {
  const names = {
    acr: "Acrobatics", ani: "Animal Handling", arc: "Arcana",
    ath: "Athletics", dec: "Deception", his: "History",
    ins: "Insight", itm: "Intimidation", inv: "Investigation",
    med: "Medicine", nat: "Nature", prc: "Perception",
    prf: "Performance", per: "Persuasion", rel: "Religion",
    slt: "Sleight of Hand", ste: "Stealth", sur: "Survival"
  };
  return names[skill] || skill;
}

function _getTrainingIcon(serviceType) {
  const icons = {
    skill_training: "fa-graduation-cap",
    weapon_training: "fa-swords",
    tool_training: "fa-screwdriver-wrench",
    language_training: "fa-language",
    sparring: "fa-hand-fist"
  };
  return icons[serviceType] || "fa-graduation-cap";
}
