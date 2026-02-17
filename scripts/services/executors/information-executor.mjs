/**
 * Information Service Executor
 * Handles rumors, research, translation, map purchases, guide hiring, and lore.
 * Delivers information via private chat messages or journal entries.
 */

const MODULE_ID = "bobs-talking-npcs";
import { convertToGold } from "../../data/merchant-model.mjs";
import { localize, formatCurrency } from "../../utils/helpers.mjs";
import { getPrivateWhisperTargets } from "../../utils/chat.mjs";

export const InformationExecutor = {
  id: "information",
  serviceTypes: ["rumors", "research", "translation", "map_purchase", "guide_hire", "lore_research", "fortune_telling"],

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
    let informationContent = "";

    switch (serviceType) {
      case "rumors":
        informationContent = _getRandomRumor(serviceDef);
        resultMessage = "The merchant leans in and whispers...";
        break;

      case "research":
      case "lore_research":
        informationContent = _getResearchResult(serviceDef, options);
        resultMessage = "After consulting their references...";
        break;

      case "translation":
        informationContent = _getTranslation(serviceDef, options);
        resultMessage = "The translator studies the text carefully...";
        break;

      case "map_purchase":
        informationContent = _getMapInfo(serviceDef, options);
        resultMessage = "A map has been provided.";
        break;

      case "guide_hire":
        informationContent = _getGuideInfo(serviceDef, options);
        resultMessage = "A guide has been arranged.";
        break;

      case "fortune_telling":
        informationContent = _getFortune(serviceDef);
        resultMessage = "The fortune teller gazes into the beyond...";
        break;

      default:
        informationContent = serviceDef.customData?.information || "Information provided.";
        resultMessage = "Information received.";
    }

    // Send as private chat message
    const merchantName = merchant?.name || "Informant";
    const content = `
      <div class="bobsnpc-chat-message service-information ${serviceType}">
        <div class="service-header">
          <i class="fa-solid ${_getInfoIcon(serviceType)}"></i>
          <strong>${serviceDef.name || "Information"}</strong>
        </div>
        <div class="service-details">
          <p class="service-flavor"><em>${resultMessage}</em></p>
          <div class="information-content">
            <p>${informationContent}</p>
          </div>
          ${cost > 0 ? `<p class="service-cost"><i class="fa-solid fa-coins"></i> ${formatCurrency(cost * 100)}</p>` : ''}
        </div>
      </div>
    `;

    await ChatMessage.create({
      content,
      whisper: getPrivateWhisperTargets(game.user?.id),
      speaker: { alias: merchantName },
      flags: { [MODULE_ID]: { type: "serviceInformation", serviceType } }
    });

    return {
      success: true,
      cost,
      serviceType,
      serviceName: serviceDef.name,
      message: resultMessage,
      data: { information: informationContent }
    };
  },

  getDescription(ctx) {
    return ctx.serviceDef?.description || "Information and knowledge services.";
  }
};

/**
 * Get a random rumor from the service's configured list or generate a generic one
 */
function _getRandomRumor(serviceDef) {
  const rumors = serviceDef.customData?.rumors || [];
  if (rumors.length > 0) {
    return rumors[Math.floor(Math.random() * rumors.length)];
  }

  // Generic rumors as fallback
  const genericRumors = [
    "They say strange lights have been seen near the old ruins to the north.",
    "A merchant caravan went missing on the eastern road last tenday.",
    "The local lord has been acting strangely since his advisor arrived.",
    "Miners found something unusual deep in the quarry - they won't talk about it.",
    "A new bounty has been posted at the town hall for a creature terrorizing farms.",
    "The river's been running strange colors upstream. Folks are worried.",
    "A traveling bard was singing about a hidden treasure near here.",
    "The temple has been unusually busy with visitors from the capital.",
    "Some say the old witch in the woods has been gathering ingredients for something big.",
    "A ship came into port with no crew aboard. Just drifted in on its own."
  ];
  return genericRumors[Math.floor(Math.random() * genericRumors.length)];
}

function _getResearchResult(serviceDef, options) {
  return serviceDef.customData?.researchResult
    || options?.topic
    ? `Research on "${options.topic}" has yielded useful information. The GM will provide details.`
    : "The research has been completed. Consult the GM for the results.";
}

function _getTranslation(serviceDef, options) {
  return serviceDef.customData?.translationResult
    || "The text has been translated. The GM will provide the translated content.";
}

function _getMapInfo(serviceDef, options) {
  return serviceDef.customData?.mapDescription
    || "A detailed map of the local area has been provided. The GM will share the map.";
}

function _getGuideInfo(serviceDef, options) {
  return serviceDef.customData?.guideDescription
    || "A knowledgeable local guide has been hired for the journey. They will provide advantage on Survival checks to navigate the area.";
}

function _getFortune(serviceDef) {
  const fortunes = serviceDef.customData?.fortunes || [
    "I see a great challenge ahead, but also a great reward...",
    "Beware the one who smiles too widely - not all friends are true.",
    "Your path leads underground. Bring light, and bring courage.",
    "An old debt will come due soon. Be ready to pay - or to fight.",
    "The stars align in your favor, but only for a short while. Act soon."
  ];
  return fortunes[Math.floor(Math.random() * fortunes.length)];
}

function _getInfoIcon(serviceType) {
  const icons = {
    rumors: "fa-ear-listen",
    research: "fa-book",
    lore_research: "fa-scroll",
    translation: "fa-language",
    map_purchase: "fa-map",
    guide_hire: "fa-compass",
    fortune_telling: "fa-crystal-ball"
  };
  return icons[serviceType] || "fa-circle-info";
}
