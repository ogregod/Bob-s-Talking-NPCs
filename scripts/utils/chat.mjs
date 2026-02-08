/**
 * Bob's Talking NPCs - Chat Utilities
 * Handles private transaction messages and formatted chat output
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize, formatCurrency } from "./helpers.mjs";

/**
 * Get all GM user IDs
 * @returns {string[]}
 */
function getGMUserIds() {
  return game.users.filter(u => u.isGM).map(u => u.id);
}

/**
 * Get whisper targets for private transaction (player + all GMs)
 * @param {string} [playerId] - Optional specific player ID
 * @returns {string[]}
 */
function getPrivateWhisperTargets(playerId = null) {
  const targets = new Set(getGMUserIds());
  if (playerId) {
    targets.add(playerId);
  } else if (game.user) {
    targets.add(game.user.id);
  }
  return Array.from(targets);
}

/**
 * Format item list for chat message
 * @param {object[]} items - Array of {name, quantity, price}
 * @returns {string}
 */
function formatItemList(items) {
  return items.map(item => {
    const qty = item.quantity > 1 ? ` x${item.quantity}` : "";
    const price = item.price ? ` - ${formatCurrency(item.price * 100)}` : "";
    return `<li>${item.name}${qty}${price}</li>`;
  }).join("");
}

/**
 * Send a private transaction message (purchase)
 * @param {object} options
 * @param {string} options.playerName - Player character name
 * @param {string} options.merchantName - Merchant/shop name
 * @param {object[]} options.items - Array of {name, quantity, price}
 * @param {number} options.total - Total cost in gold
 * @param {string} [options.playerId] - Player user ID for whisper targeting
 */
export async function sendPurchaseMessage({ playerName, merchantName, items, total, playerId }) {
  const itemList = formatItemList(items);

  const content = `
    <div class="bobsnpc-chat-message transaction purchase">
      <div class="transaction-header">
        <i class="fa-solid fa-shopping-cart"></i>
        <strong>${localize("Chat.Transaction.Purchase")}</strong>
      </div>
      <div class="transaction-parties">
        <span class="player-name">${playerName}</span>
        <i class="fa-solid fa-arrow-right"></i>
        <span class="merchant-name">${merchantName}</span>
      </div>
      <ul class="transaction-items">${itemList}</ul>
      <div class="transaction-total">
        <strong>${localize("Chat.Transaction.Total")}:</strong>
        <span class="total-amount">${formatCurrency(total * 100)}</span>
      </div>
    </div>
  `;

  await ChatMessage.create({
    content,
    whisper: getPrivateWhisperTargets(playerId),
    speaker: { alias: merchantName },
    flags: {
      [MODULE_ID]: {
        type: "transaction",
        subtype: "purchase"
      }
    }
  });
}

/**
 * Send a private transaction message (sale)
 * @param {object} options
 * @param {string} options.playerName - Player character name
 * @param {string} options.merchantName - Merchant/shop name
 * @param {object[]} options.items - Array of {name, quantity, price}
 * @param {number} options.total - Total earned in gold
 * @param {string} [options.playerId] - Player user ID for whisper targeting
 */
export async function sendSaleMessage({ playerName, merchantName, items, total, playerId }) {
  const itemList = formatItemList(items);

  const content = `
    <div class="bobsnpc-chat-message transaction sale">
      <div class="transaction-header">
        <i class="fa-solid fa-hand-holding-dollar"></i>
        <strong>${localize("Chat.Transaction.Sale")}</strong>
      </div>
      <div class="transaction-parties">
        <span class="player-name">${playerName}</span>
        <i class="fa-solid fa-arrow-left"></i>
        <span class="merchant-name">${merchantName}</span>
      </div>
      <ul class="transaction-items">${itemList}</ul>
      <div class="transaction-total">
        <strong>${localize("Chat.Transaction.Earned")}:</strong>
        <span class="total-amount">${formatCurrency(total * 100)}</span>
      </div>
    </div>
  `;

  await ChatMessage.create({
    content,
    whisper: getPrivateWhisperTargets(playerId),
    speaker: { alias: merchantName },
    flags: {
      [MODULE_ID]: {
        type: "transaction",
        subtype: "sale"
      }
    }
  });
}

/**
 * Send a private service message (identify)
 * @param {object} options
 * @param {string} options.playerName - Player character name
 * @param {string} options.merchantName - Merchant/shop name
 * @param {string} options.itemName - Item that was identified
 * @param {string} [options.itemImg] - Item image path
 * @param {number} options.cost - Service cost in gold
 * @param {string} [options.playerId] - Player user ID
 */
export async function sendIdentifyMessage({ playerName, merchantName, itemName, itemImg, cost, playerId }) {
  const imgHtml = itemImg ? `<img src="${itemImg}" class="item-icon" alt="${itemName}">` : "";

  const content = `
    <div class="bobsnpc-chat-message service identify">
      <div class="service-header">
        <i class="fa-solid fa-search"></i>
        <strong>${localize("Chat.Service.IdentifyTitle")}</strong>
      </div>
      <div class="service-details">
        ${imgHtml}
        <div class="service-text">
          <p>${localize("Chat.Service.IdentifyComplete", { player: playerName, item: itemName, merchant: merchantName })}</p>
          <p class="service-cost"><strong>${localize("Chat.Service.Cost")}:</strong> ${formatCurrency(cost * 100)}</p>
        </div>
      </div>
    </div>
  `;

  await ChatMessage.create({
    content,
    whisper: getPrivateWhisperTargets(playerId),
    speaker: { alias: merchantName },
    flags: {
      [MODULE_ID]: {
        type: "service",
        subtype: "identify"
      }
    }
  });
}

/**
 * Send a private service message (repair)
 * @param {object} options
 * @param {string} options.playerName - Player character name
 * @param {string} options.merchantName - Merchant/shop name
 * @param {string} options.itemName - Item that was repaired
 * @param {string} [options.itemImg] - Item image path
 * @param {number} options.cost - Service cost in gold
 * @param {string} [options.playerId] - Player user ID
 */
export async function sendRepairMessage({ playerName, merchantName, itemName, itemImg, cost, playerId }) {
  const imgHtml = itemImg ? `<img src="${itemImg}" class="item-icon" alt="${itemName}">` : "";

  const content = `
    <div class="bobsnpc-chat-message service repair">
      <div class="service-header">
        <i class="fa-solid fa-wrench"></i>
        <strong>${localize("Chat.Service.RepairTitle")}</strong>
      </div>
      <div class="service-details">
        ${imgHtml}
        <div class="service-text">
          <p>${localize("Chat.Service.RepairComplete", { player: playerName, item: itemName, merchant: merchantName })}</p>
          <p class="service-cost"><strong>${localize("Chat.Service.Cost")}:</strong> ${formatCurrency(cost * 100)}</p>
        </div>
      </div>
    </div>
  `;

  await ChatMessage.create({
    content,
    whisper: getPrivateWhisperTargets(playerId),
    speaker: { alias: merchantName },
    flags: {
      [MODULE_ID]: {
        type: "service",
        subtype: "repair"
      }
    }
  });
}

/**
 * Send a private service message (appraise)
 * @param {object} options
 * @param {string} options.playerName - Player character name
 * @param {string} options.merchantName - Merchant/shop name
 * @param {string} options.itemName - Item that was appraised
 * @param {string} [options.itemImg] - Item image path
 * @param {number} options.appraisedValue - Appraised value in gold
 * @param {number} options.cost - Service cost in gold
 * @param {string} [options.playerId] - Player user ID
 */
export async function sendAppraiseMessage({ playerName, merchantName, itemName, itemImg, appraisedValue, cost, playerId }) {
  const imgHtml = itemImg ? `<img src="${itemImg}" class="item-icon" alt="${itemName}">` : "";

  const content = `
    <div class="bobsnpc-chat-message service appraise">
      <div class="service-header">
        <i class="fa-solid fa-magnifying-glass-dollar"></i>
        <strong>${localize("Chat.Service.AppraiseTitle")}</strong>
      </div>
      <div class="service-details">
        ${imgHtml}
        <div class="service-text">
          <p>${localize("Chat.Service.AppraiseComplete", { merchant: merchantName, item: itemName, player: playerName })}</p>
          <p class="appraised-value"><strong>${localize("Chat.Service.Worth")}:</strong> ${formatCurrency(appraisedValue * 100)}</p>
          <p class="service-cost"><strong>${localize("Chat.Service.Cost")}:</strong> ${formatCurrency(cost * 100)}</p>
        </div>
      </div>
    </div>
  `;

  await ChatMessage.create({
    content,
    whisper: getPrivateWhisperTargets(playerId),
    speaker: { alias: merchantName },
    flags: {
      [MODULE_ID]: {
        type: "service",
        subtype: "appraise"
      }
    }
  });
}

/**
 * Send a private service message (enchant)
 * @param {object} options
 * @param {string} options.playerName - Player character name
 * @param {string} options.merchantName - Merchant/shop name
 * @param {string} options.itemName - Item that was enchanted
 * @param {string} [options.itemImg] - Item image path
 * @param {string} options.enchantmentName - Name of the enchantment applied
 * @param {number} options.cost - Service cost in gold
 * @param {string} [options.playerId] - Player user ID
 */
export async function sendEnchantMessage({ playerName, merchantName, itemName, itemImg, enchantmentName, cost, playerId }) {
  const imgHtml = itemImg ? `<img src="${itemImg}" class="item-icon" alt="${itemName}">` : "";

  const content = `
    <div class="bobsnpc-chat-message service enchant">
      <div class="service-header">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <strong>${localize("Chat.Service.EnchantTitle")}</strong>
      </div>
      <div class="service-details">
        ${imgHtml}
        <div class="service-text">
          <p>${localize("Chat.Service.EnchantComplete", { player: playerName, item: itemName, enchantment: enchantmentName, merchant: merchantName })}</p>
          <p class="service-cost"><strong>${localize("Chat.Service.Cost")}:</strong> ${formatCurrency(cost * 100)}</p>
        </div>
      </div>
    </div>
  `;

  await ChatMessage.create({
    content,
    whisper: getPrivateWhisperTargets(playerId),
    speaker: { alias: merchantName },
    flags: {
      [MODULE_ID]: {
        type: "service",
        subtype: "enchant"
      }
    }
  });
}

/**
 * Send a service request notification to GMs
 * @param {object} options
 * @param {string} options.type - Service type (repair, enchant)
 * @param {string} options.playerName - Player character name
 * @param {string} options.merchantName - Merchant/shop name
 * @param {string} options.itemName - Item name
 * @param {string} [options.itemImg] - Item image path
 * @param {string} [options.enchantmentName] - Enchantment name (for enchant requests)
 * @param {number} options.cost - Proposed cost
 * @param {string} options.requestId - Unique request ID for approval
 */
export async function sendServiceRequestToGM({ type, playerName, merchantName, itemName, itemImg, enchantmentName, cost, requestId }) {
  const imgHtml = itemImg ? `<img src="${itemImg}" class="item-icon" alt="${itemName}">` : "";
  const serviceIcon = type === "repair" ? "fa-wrench" : "fa-wand-magic-sparkles";
  const serviceTitle = type === "repair" ? localize("Chat.Service.RepairRequest") : localize("Chat.Service.EnchantRequest");

  const enchantmentLine = enchantmentName
    ? `<p><strong>${localize("Enchantment.Name")}:</strong> ${enchantmentName}</p>`
    : "";

  const content = `
    <div class="bobsnpc-chat-message service-request ${type}">
      <div class="service-header">
        <i class="fa-solid ${serviceIcon}"></i>
        <strong>${serviceTitle}</strong>
      </div>
      <div class="service-details">
        ${imgHtml}
        <div class="service-text">
          <p><strong>${localize("GM.RequestFrom", { player: playerName })}</strong></p>
          <p><strong>${localize("Shop.Merchant")}:</strong> ${merchantName}</p>
          <p><strong>${localize("Shop.Item")}:</strong> ${itemName}</p>
          ${enchantmentLine}
          <p><strong>${localize("Chat.Service.Cost")}:</strong> ${formatCurrency(cost * 100)}</p>
        </div>
      </div>
      <div class="service-actions">
        <button type="button" class="approve-btn" data-action="approveServiceRequest" data-request-id="${requestId}">
          <i class="fa-solid fa-check"></i> ${localize("GM.ApproveRequest")}
        </button>
        <button type="button" class="deny-btn" data-action="denyServiceRequest" data-request-id="${requestId}">
          <i class="fa-solid fa-times"></i> ${localize("GM.DenyRequest")}
        </button>
      </div>
    </div>
  `;

  await ChatMessage.create({
    content,
    whisper: getGMUserIds(),
    speaker: { alias: MODULE_ID },
    flags: {
      [MODULE_ID]: {
        type: "serviceRequest",
        requestId,
        serviceType: type
      }
    }
  });
}

/**
 * Send a notification that a service request was approved/denied
 * @param {object} options
 * @param {string} options.type - Service type
 * @param {string} options.status - "approved" or "denied"
 * @param {string} options.itemName - Item name
 * @param {string} [options.playerId] - Player user ID
 */
export async function sendServiceRequestResult({ type, status, itemName, playerId }) {
  const isApproved = status === "approved";
  const icon = isApproved ? "fa-check-circle" : "fa-times-circle";
  const colorClass = isApproved ? "approved" : "denied";
  const message = isApproved
    ? localize("Service.RequestApproved")
    : localize("Service.RequestDenied");

  const content = `
    <div class="bobsnpc-chat-message service-result ${colorClass}">
      <div class="result-header">
        <i class="fa-solid ${icon}"></i>
        <strong>${message}</strong>
      </div>
      <p>${localize("Chat.Service.RequestItem", { item: itemName })}</p>
    </div>
  `;

  await ChatMessage.create({
    content,
    whisper: getPrivateWhisperTargets(playerId),
    flags: {
      [MODULE_ID]: {
        type: "serviceResult",
        status
      }
    }
  });
}
