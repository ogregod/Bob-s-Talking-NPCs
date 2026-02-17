/**
 * Financial Service Executor
 * Handles currency exchange, loans, pawning, safe deposit, and money transfers.
 * Modifies actor currency directly.
 */

const MODULE_ID = "bobs-talking-npcs";
import { convertToGold, convertToCurrency } from "../../data/merchant-model.mjs";
import { localize, formatCurrency } from "../../utils/helpers.mjs";
import { getPrivateWhisperTargets } from "../../utils/chat.mjs";

export const FinancialExecutor = {
  id: "financial",
  serviceTypes: ["currency_exchange", "money_transfer", "item_storage", "safe_deposit", "loan", "pawn", "debt_collection", "bail", "fine_payment", "tax_collection"],

  validate(ctx) {
    const errors = [];
    if (!ctx.actor) errors.push("No actor provided");
    return { valid: errors.length === 0, errors };
  },

  async execute(ctx) {
    const { actor, merchant, serviceDef, options } = ctx;

    const serviceType = serviceDef.type;
    let resultMessage = "";
    let cost = serviceDef?.basePrice ?? 0;

    switch (serviceType) {
      case "currency_exchange":
        resultMessage = await _currencyExchange(actor, options, serviceDef);
        cost = 0; // Exchange fee is built into the rate
        break;

      case "safe_deposit":
      case "item_storage":
        if (cost > 0) {
          const gold = convertToGold(actor.system?.currency || {});
          if (gold < cost) {
            return { success: false, message: localize("Shop.InsufficientFunds") };
          }
          await ctx.deductGold(actor, cost);
        }
        resultMessage = `Storage secured at ${merchant?.name || "the bank"}. Your items are safe. (${formatCurrency(cost * 100)}/month)`;
        break;

      case "loan":
        resultMessage = await _processLoan(actor, merchant, serviceDef, options);
        break;

      case "pawn":
        resultMessage = await _processPawn(actor, merchant, serviceDef, options);
        break;

      case "bail":
      case "fine_payment":
      case "tax_collection":
        if (cost > 0) {
          const gold = convertToGold(actor.system?.currency || {});
          if (gold < cost) {
            return { success: false, message: localize("Shop.InsufficientFunds") };
          }
          await ctx.deductGold(actor, cost);
        }
        resultMessage = `Payment of ${formatCurrency(cost * 100)} processed. The ${serviceType.replace("_", " ")} has been settled.`;
        break;

      case "money_transfer":
        if (cost > 0) {
          const gold = convertToGold(actor.system?.currency || {});
          if (gold < cost) {
            return { success: false, message: localize("Shop.InsufficientFunds") };
          }
          await ctx.deductGold(actor, cost);
        }
        resultMessage = `Funds transferred successfully. Transfer fee: ${formatCurrency(cost * 100)}.`;
        break;

      default:
        if (cost > 0) {
          const gold = convertToGold(actor.system?.currency || {});
          if (gold < cost) {
            return { success: false, message: localize("Shop.InsufficientFunds") };
          }
          await ctx.deductGold(actor, cost);
        }
        resultMessage = `${serviceDef.name} completed.`;
    }

    // Send chat message
    const content = `
      <div class="bobsnpc-chat-message service-financial ${serviceType}">
        <div class="service-header">
          <i class="fa-solid ${serviceDef.icon || 'fa-coins'}"></i>
          <strong>${serviceDef.name || "Financial Service"}</strong>
        </div>
        <div class="service-details">
          <p>${resultMessage}</p>
        </div>
      </div>
    `;

    await ChatMessage.create({
      content,
      whisper: getPrivateWhisperTargets(game.user?.id),
      speaker: { alias: merchant?.name || "Banker" },
      flags: { [MODULE_ID]: { type: "serviceFinancial", serviceType } }
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
    return ctx.serviceDef?.description || "Financial services.";
  }
};

/**
 * Currency exchange - convert between denominations with a fee
 */
async function _currencyExchange(actor, options, serviceDef) {
  const feePercent = serviceDef.customData?.exchangeFee || 5; // 5% default fee

  // Consolidate all currency to gold equivalent, apply fee, then set
  const currency = actor.system?.currency || {};
  const totalGold = convertToGold(currency);
  const fee = Math.ceil(totalGold * (feePercent / 100));
  const afterFee = totalGold - fee;

  if (afterFee <= 0) {
    return "Not enough currency to exchange after fees.";
  }

  // Convert to the target denomination (default: gold pieces)
  const targetDenom = options?.targetDenomination || "gp";

  // Set all currency to 0, then set the target
  const newCurrency = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

  switch (targetDenom) {
    case "pp":
      newCurrency.pp = Math.floor(afterFee / 10);
      newCurrency.gp = Math.round((afterFee % 10) * 100) / 100;
      break;
    case "gp":
      newCurrency.gp = afterFee;
      break;
    case "sp":
      newCurrency.sp = afterFee * 10;
      break;
    case "cp":
      newCurrency.cp = afterFee * 100;
      break;
    default:
      newCurrency.gp = afterFee;
  }

  await actor.update({ "system.currency": newCurrency });

  return `Currency exchanged. Fee: ${feePercent}% (${formatCurrency(fee * 100)}). New balance: ${formatCurrency(afterFee * 100)}.`;
}

/**
 * Process a loan - give gold to player, track as debt
 */
async function _processLoan(actor, merchant, serviceDef, options) {
  const loanAmount = options?.amount || serviceDef.customData?.loanAmount || 100;
  const interestRate = serviceDef.customData?.interestRate || 10; // 10% default

  // Give gold to player
  const currentGold = actor.system?.currency?.gp || 0;
  await actor.update({ "system.currency.gp": currentGold + loanAmount });

  // Track debt via actor flags
  const debts = actor.getFlag(MODULE_ID, "debts") || [];
  debts.push({
    id: foundry.utils.randomID(),
    merchantId: merchant?.id,
    merchantName: merchant?.name || "Lender",
    principal: loanAmount,
    interestRate,
    totalOwed: Math.ceil(loanAmount * (1 + interestRate / 100)),
    issuedAt: Date.now(),
    issuedAtGameTime: game?.time?.worldTime ?? 0
  });
  await actor.setFlag(MODULE_ID, "debts", debts);

  const totalOwed = Math.ceil(loanAmount * (1 + interestRate / 100));
  return `Loan of ${loanAmount} gp received. Interest: ${interestRate}%. Total owed: ${totalOwed} gp.`;
}

/**
 * Process a pawn - take item, give gold
 */
async function _processPawn(actor, merchant, serviceDef, options) {
  if (!options?.itemId) {
    return "No item selected to pawn.";
  }

  const item = actor.items.get(options.itemId);
  if (!item) {
    return "Item not found.";
  }

  // Pay a fraction of the item's value
  const pawnRate = serviceDef.customData?.pawnRate || 40; // 40% of value
  const itemValue = item.system?.price?.value || 0;
  const pawnValue = Math.max(1, Math.floor(itemValue * (pawnRate / 100)));

  // Give gold
  const currentGold = actor.system?.currency?.gp || 0;
  await actor.update({ "system.currency.gp": currentGold + pawnValue });

  // Remove item
  const itemName = item.name;
  await item.delete();

  return `${itemName} pawned for ${pawnValue} gp (${pawnRate}% of value).`;
}
