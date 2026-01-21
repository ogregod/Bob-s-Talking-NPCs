/**
 * Bob's Talking NPCs - Initialization and Hooks
 * Registers all Foundry hooks and loads templates
 */

import { MODULE_ID } from "./module.mjs";
import { initializeAppearance, getSetting } from "./settings.mjs";

/**
 * State for double-click detection on tokens
 */
const tokenClickState = {
  lastClickTime: 0,
  lastClickedToken: null,
  doubleClickThreshold: 300 // milliseconds
};

/**
 * Initialize all module hooks and load templates
 * Called during the init hook
 */
export function initializeHooks() {
  // Load Handlebars templates
  loadTemplates();

  // Register Handlebars helpers
  registerHandlebarsHelpers();

  console.log(`${MODULE_ID} | Hooks initialized`);
}

/**
 * Load all Handlebars templates
 */
async function loadTemplates() {
  const templatePaths = [
    // Dialogue window templates
    `modules/${MODULE_ID}/templates/dialogue/header.hbs`,
    `modules/${MODULE_ID}/templates/dialogue/content.hbs`,
    `modules/${MODULE_ID}/templates/dialogue/responses.hbs`,
    `modules/${MODULE_ID}/templates/dialogue/footer.hbs`,

    // Quest log templates
    `modules/${MODULE_ID}/templates/quest-log/sidebar.hbs`,
    `modules/${MODULE_ID}/templates/quest-log/details.hbs`,

    // Quest tracker template
    `modules/${MODULE_ID}/templates/quest-tracker/tracker.hbs`,

    // Shop templates
    `modules/${MODULE_ID}/templates/shop/header.hbs`,
    `modules/${MODULE_ID}/templates/shop/tabs.hbs`,
    `modules/${MODULE_ID}/templates/shop/inventory.hbs`,
    `modules/${MODULE_ID}/templates/shop/cart.hbs`,
    `modules/${MODULE_ID}/templates/shop/footer.hbs`,

    // Bank templates
    `modules/${MODULE_ID}/templates/bank/header.hbs`,
    `modules/${MODULE_ID}/templates/bank/tabs.hbs`,
    `modules/${MODULE_ID}/templates/bank/content.hbs`,
    `modules/${MODULE_ID}/templates/bank/footer.hbs`,

    // Faction templates
    `modules/${MODULE_ID}/templates/factions/sidebar.hbs`,
    `modules/${MODULE_ID}/templates/factions/details.hbs`,
    `modules/${MODULE_ID}/templates/factions/members-dialog.hbs`,

    // Hireling templates
    `modules/${MODULE_ID}/templates/hireling/tabs.hbs`,
    `modules/${MODULE_ID}/templates/hireling/content.hbs`,
    `modules/${MODULE_ID}/templates/hireling/footer.hbs`,

    // Property templates
    `modules/${MODULE_ID}/templates/property/tabs.hbs`,
    `modules/${MODULE_ID}/templates/property/content.hbs`,
    `modules/${MODULE_ID}/templates/property/footer.hbs`,

    // NPC Config templates
    `modules/${MODULE_ID}/templates/npc-config/tabs.hbs`,
    `modules/${MODULE_ID}/templates/npc-config/general.hbs`,
    `modules/${MODULE_ID}/templates/npc-config/roles.hbs`,
    `modules/${MODULE_ID}/templates/npc-config/dialogue.hbs`,
    `modules/${MODULE_ID}/templates/npc-config/schedule.hbs`,
    `modules/${MODULE_ID}/templates/npc-config/services.hbs`,
    `modules/${MODULE_ID}/templates/npc-config/factions.hbs`,
    `modules/${MODULE_ID}/templates/npc-config/appearance.hbs`,
    `modules/${MODULE_ID}/templates/npc-config/footer.hbs`,

    // GM Dashboard templates
    `modules/${MODULE_ID}/templates/gm-dashboard/tabs.hbs`,
    `modules/${MODULE_ID}/templates/gm-dashboard/overview.hbs`,
    `modules/${MODULE_ID}/templates/gm-dashboard/quests.hbs`,
    `modules/${MODULE_ID}/templates/gm-dashboard/npcs.hbs`,
    `modules/${MODULE_ID}/templates/gm-dashboard/factions.hbs`,
    `modules/${MODULE_ID}/templates/gm-dashboard/world.hbs`,
    `modules/${MODULE_ID}/templates/gm-dashboard/tools.hbs`
  ];

  try {
    await foundry.applications.handlebars.loadTemplates(templatePaths);
    console.log(`${MODULE_ID} | Templates loaded`);
  } catch (error) {
    // Templates don't exist yet, that's OK for now
    console.log(`${MODULE_ID} | Template loading skipped (templates not yet created)`);
  }
}

/**
 * Register custom Handlebars helpers
 */
function registerHandlebarsHelpers() {
  // Localization helper
  Handlebars.registerHelper("bobsnpc-localize", function(key, options) {
    return game.i18n.localize(`BOBSNPC.${key}`);
  });

  // Format helper with localization
  Handlebars.registerHelper("bobsnpc-format", function(key, options) {
    return game.i18n.format(`BOBSNPC.${key}`, options.hash);
  });

  // Currency formatting helper
  Handlebars.registerHelper("bobsnpc-currency", function(amount, options) {
    const format = getSetting("currencyDisplay");
    return formatCurrencyDisplay(amount, format);
  });

  // Relationship tier helper
  Handlebars.registerHelper("bobsnpc-relationship-tier", function(value) {
    return getRelationshipTier(value);
  });

  // Quest status badge class helper
  Handlebars.registerHelper("bobsnpc-quest-badge", function(status) {
    return `bobsnpc-badge-quest-${status}`;
  });

  // Equality check helper
  Handlebars.registerHelper("bobsnpc-eq", function(a, b) {
    return a === b;
  });

  // Greater than helper
  Handlebars.registerHelper("bobsnpc-gt", function(a, b) {
    return a > b;
  });

  // Less than helper
  Handlebars.registerHelper("bobsnpc-lt", function(a, b) {
    return a < b;
  });

  // Percentage calculation helper
  Handlebars.registerHelper("bobsnpc-percent", function(current, max) {
    if (max === 0) return 0;
    return Math.round((current / max) * 100);
  });

  console.log(`${MODULE_ID} | Handlebars helpers registered`);
}

/**
 * Register ready-time hooks
 * Called after the game is fully ready
 */
export function registerReadyHooks() {
  // Initialize appearance settings
  initializeAppearance();

  // Register token interaction hooks
  registerTokenHooks();

  // Register actor update hooks for quest tracking
  registerActorHooks();

  // Register chat hooks
  registerChatHooks();

  // Register combat hooks for loot consolidation
  registerCombatHooks();

  // Register render hooks for UI integration
  registerRenderHooks();

  console.log(`${MODULE_ID} | Ready hooks registered`);
}

/**
 * Register token interaction hooks
 */
function registerTokenHooks() {
  // Double-click detection on tokens
  Hooks.on("canvasReady", () => {
    if (!canvas?.stage) return;

    canvas.stage.on("pointerdown", handleCanvasClick);
  });

  // Token HUD integration for NPC indicators
  Hooks.on("renderTokenHUD", (hud, html, data) => {
    if (!getSetting("npcIndicators")) return;
    addTokenIndicators(hud, html, data);
  });

  // Token control for selection tracking
  Hooks.on("controlToken", (token, controlled) => {
    if (controlled) {
      // Track selected token for potential interactions
      Hooks.call(`${MODULE_ID}.tokenSelected`, token);
    }
  });
}

/**
 * Handle canvas click events for double-click detection
 * @param {PIXI.InteractionEvent} event
 */
function handleCanvasClick(event) {
  // Find if a token was clicked
  const token = getTokenAtPoint(event.data.global);
  if (!token) {
    tokenClickState.lastClickedToken = null;
    return;
  }

  const now = Date.now();
  const timeSinceLastClick = now - tokenClickState.lastClickTime;

  // Check for double-click
  if (
    token === tokenClickState.lastClickedToken &&
    timeSinceLastClick < tokenClickState.doubleClickThreshold
  ) {
    // Double-click detected!
    handleTokenDoubleClick(token);
    tokenClickState.lastClickedToken = null;
    tokenClickState.lastClickTime = 0;
  } else {
    // Single click - record for potential double-click
    tokenClickState.lastClickedToken = token;
    tokenClickState.lastClickTime = now;
  }
}

/**
 * Get token at a given screen point
 * @param {PIXI.Point} point
 * @returns {Token|null}
 */
function getTokenAtPoint(point) {
  const tokens = canvas.tokens?.placeables || [];

  for (const token of tokens) {
    if (token.visible && token.bounds.contains(point.x, point.y)) {
      return token;
    }
  }

  return null;
}

/**
 * Handle double-click on a token
 * @param {Token} token
 */
function handleTokenDoubleClick(token) {
  // Check if this is an NPC with module configuration
  const actor = token.actor;
  if (!actor) return;

  const npcConfig = actor.getFlag(MODULE_ID, "config");
  if (!npcConfig?.enabled) return;

  // Emit hook for dialogue initiation
  Hooks.call(`${MODULE_ID}.npcInteraction`, {
    token,
    actor,
    config: npcConfig,
    initiator: game.user
  });

  // Start dialogue if the NPC has one configured
  if (npcConfig.dialogueId) {
    game.bobsnpc?.startDialogue(actor.uuid);
  }

  console.log(`${MODULE_ID} | NPC interaction triggered for ${actor.name}`);
}

/**
 * Add role indicators to token HUD
 * @param {TokenHUD} hud
 * @param {jQuery} html
 * @param {object} data
 */
function addTokenIndicators(hud, html, data) {
  const token = hud.object;
  const actor = token?.actor;
  if (!actor) return;

  const npcConfig = actor.getFlag(MODULE_ID, "config");
  if (!npcConfig?.enabled) return;

  // Determine which indicators to show based on roles
  const indicators = [];

  if (npcConfig.roles?.questGiver) {
    // Check if NPC has available quests
    indicators.push({
      icon: "fa-exclamation",
      class: "bobsnpc-indicator-quest",
      title: game.i18n.localize("BOBSNPC.NPC.Roles.QuestGiver")
    });
  }

  if (npcConfig.roles?.merchant) {
    indicators.push({
      icon: "fa-coins",
      class: "bobsnpc-indicator-merchant",
      title: game.i18n.localize("BOBSNPC.NPC.Roles.Merchant")
    });
  }

  // Add indicators to HUD (implementation depends on desired visual style)
  // This is a placeholder - full implementation would add DOM elements
}

/**
 * Register actor update hooks
 */
function registerActorHooks() {
  // Track inventory changes for item collection quests
  Hooks.on("updateActor", (actor, changes, options, userId) => {
    if (!changes.system?.currency && !changes.items) return;

    // Emit hook for quest system to check objectives
    Hooks.call(`${MODULE_ID}.actorInventoryChanged`, {
      actor,
      changes,
      userId
    });
  });

  // Track item creation for collection quests
  Hooks.on("createItem", (item, options, userId) => {
    const actor = item.parent;
    if (!(actor instanceof Actor)) return;

    Hooks.call(`${MODULE_ID}.itemGained`, {
      actor,
      item,
      userId
    });
  });

  // Track item deletion
  Hooks.on("deleteItem", (item, options, userId) => {
    const actor = item.parent;
    if (!(actor instanceof Actor)) return;

    Hooks.call(`${MODULE_ID}.itemLost`, {
      actor,
      item,
      userId
    });
  });
}

/**
 * Register chat message hooks
 */
function registerChatHooks() {
  // Add context menu options for dialogue-related messages
  Hooks.on("getChatLogEntryContext", (html, options) => {
    // Add "View in Dialogue" option for dialogue-related messages
    options.push({
      name: game.i18n.localize("BOBSNPC.Dialogue.Title"),
      icon: '<i class="fas fa-comments"></i>',
      condition: (li) => {
        const message = game.messages.get(li.data("messageId"));
        return message?.getFlag(MODULE_ID, "dialogueId");
      },
      callback: (li) => {
        const message = game.messages.get(li.data("messageId"));
        const dialogueId = message?.getFlag(MODULE_ID, "dialogueId");
        // Open dialogue viewer - implementation pending
      }
    });
  });
}

/**
 * Register combat hooks
 */
function registerCombatHooks() {
  // Consolidate loot after combat ends
  Hooks.on("deleteCombat", (combat, options, userId) => {
    if (!getSetting("corpseConsolidation")) return;
    if (!game.user.isGM) return;

    // Get defeated enemies from combat
    const defeated = combat.combatants.filter(c => c.isDefeated && !c.isNPC === false);

    if (defeated.length > 0) {
      Hooks.call(`${MODULE_ID}.combatEnded`, {
        combat,
        defeated: defeated.map(c => c.actor)
      });
    }
  });
}

/**
 * Register UI render hooks
 */
function registerRenderHooks() {
  // Add module button to actor sheet header
  Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
    if (!game.user.isGM) return;

    const actor = sheet.actor;
    if (actor.type !== "npc") return;

    buttons.unshift({
      label: game.i18n.localize("BOBSNPC.ModuleName"),
      class: "bobsnpc-config",
      icon: "fas fa-comments",
      onclick: () => {
        // Open NPC configuration - implementation pending
        Hooks.call(`${MODULE_ID}.openNPCConfig`, actor);
      }
    });
  });

  // Add module section to sidebar
  Hooks.on("renderSidebarTab", (app, html, data) => {
    // Could add quest log shortcut to journal tab, etc.
  });
}

/**
 * Format currency for display
 * @param {number} amount - Amount in copper pieces
 * @param {string} format - Display format
 * @returns {string}
 */
function formatCurrencyDisplay(amount, format) {
  if (format === "all") {
    const pp = Math.floor(amount / 1000);
    const gp = Math.floor((amount % 1000) / 100);
    const ep = Math.floor((amount % 100) / 50);
    const sp = Math.floor((amount % 50) / 10);
    const cp = amount % 10;

    const parts = [];
    if (pp) parts.push(`${pp}pp`);
    if (gp) parts.push(`${gp}gp`);
    if (ep) parts.push(`${ep}ep`);
    if (sp) parts.push(`${sp}sp`);
    if (cp) parts.push(`${cp}cp`);

    return parts.join(" ") || "0cp";
  }

  // gold_down format
  const gp = Math.floor(amount / 100);
  const sp = Math.floor((amount % 100) / 10);
  const cp = amount % 10;

  const parts = [];
  if (gp) parts.push(`${gp}gp`);
  if (sp) parts.push(`${sp}sp`);
  if (cp) parts.push(`${cp}cp`);

  return parts.join(" ") || "0gp";
}

/**
 * Get relationship tier from value
 * @param {number} value - Relationship value (-100 to 100)
 * @returns {string} Tier name
 */
function getRelationshipTier(value) {
  if (value <= -75) return "hostile";
  if (value <= -50) return "hated";
  if (value <= -25) return "unfriendly";
  if (value < 25) return "neutral";
  if (value < 50) return "friendly";
  if (value < 75) return "trusted";
  return "allied";
}

// Export for use by other modules
export { registerReadyHooks };
