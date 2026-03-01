/**
 * Bob's Talking NPCs - Initialization and Hooks
 * Registers all Foundry hooks and loads templates
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";
import { initializeAppearance, getSetting } from "./settings.mjs";

// Import handlers for initialization
import { QuestHandler } from "./handlers/quest-handler.mjs";
import { DialogueHandler } from "./handlers/dialogue-handler.mjs";
import { FactionHandler } from "./handlers/faction-handler.mjs";
import { RelationshipHandler } from "./handlers/relationship-handler.mjs";
import { MerchantHandler } from "./handlers/merchant-handler.mjs";
import { BankHandler } from "./handlers/bank-handler.mjs";
import { CrimeHandler } from "./handlers/crime-handler.mjs";
import { HirelingHandler } from "./handlers/hireling-handler.mjs";
import { PropertyHandler } from "./handlers/property-handler.mjs";
import { NPCHandler } from "./handlers/npc-handler.mjs";
import { EnchantmentHandler } from "./handlers/enchantment-handler.mjs";

// Import apps needed for hook callbacks
import { DialogueEditor } from "./apps/dialogue-editor.mjs";

// Import service approval hooks
import { registerServiceApprovalHooks } from "./apps/service-approval-dialog.mjs";

// Import service database
import { ServiceDatabase } from "./data/service-database.mjs";

// Import service executor registry
import { registerExecutor } from "./services/service-executor-registry.mjs";
import { GenericExecutor } from "./services/executors/generic-executor.mjs";
import { IdentifyExecutor } from "./services/executors/identify-executor.mjs";
import { AppraiseExecutor } from "./services/executors/appraise-executor.mjs";
import { RepairExecutor } from "./services/executors/repair-executor.mjs";
import { EnchantExecutor } from "./services/executors/enchant-executor.mjs";
import { HealingExecutor } from "./services/executors/healing-executor.mjs";
import { RestExecutor } from "./services/executors/rest-executor.mjs";
import { TrainingExecutor } from "./services/executors/training-executor.mjs";
import { InformationExecutor } from "./services/executors/information-executor.mjs";
import { ItemModificationExecutor } from "./services/executors/item-modification-executor.mjs";
import { ItemCreationExecutor } from "./services/executors/item-creation-executor.mjs";
import { FinancialExecutor } from "./services/executors/financial-executor.mjs";

/**
 * Handler instances
 */
const handlers = {};

/**
 * State for right-click dialogue triggering
 */
const tokenClickState = {
  rightClickTimeout: null,
  rightClickToken: null,
  rightClickDelay: 400, // milliseconds - delay before triggering dialogue
  lastRightClickTime: 0,
  doubleRightClickThreshold: 300 // milliseconds - to detect double-right-click (targeting)
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
    `modules/${MODULE_ID}/templates/gm-dashboard/tools.hbs`,

    // Trade Window templates
    `modules/${MODULE_ID}/templates/trade/header.hbs`,
    `modules/${MODULE_ID}/templates/trade/your-offer.hbs`,
    `modules/${MODULE_ID}/templates/trade/their-offer.hbs`,
    `modules/${MODULE_ID}/templates/trade/footer.hbs`,

    // Dialogue Editor templates
    `modules/${MODULE_ID}/templates/dialogue-editor/toolbar.hbs`,
    `modules/${MODULE_ID}/templates/dialogue-editor/canvas.hbs`,
    `modules/${MODULE_ID}/templates/dialogue-editor/sidebar.hbs`,
    `modules/${MODULE_ID}/templates/dialogue-editor/node-panel.hbs`,

    // Dialogue Node Config templates
    `modules/${MODULE_ID}/templates/dialogue-node-config/tabs.hbs`,
    `modules/${MODULE_ID}/templates/dialogue-node-config/content.hbs`,
    `modules/${MODULE_ID}/templates/dialogue-node-config/responses.hbs`,
    `modules/${MODULE_ID}/templates/dialogue-node-config/conditions.hbs`,
    `modules/${MODULE_ID}/templates/dialogue-node-config/effects.hbs`,
    `modules/${MODULE_ID}/templates/dialogue-node-config/footer.hbs`,

    // Quest Editor templates
    `modules/${MODULE_ID}/templates/quest-editor/tabs.hbs`,
    `modules/${MODULE_ID}/templates/quest-editor/general.hbs`,
    `modules/${MODULE_ID}/templates/quest-editor/objectives.hbs`,
    `modules/${MODULE_ID}/templates/quest-editor/rewards.hbs`,
    `modules/${MODULE_ID}/templates/quest-editor/prerequisites.hbs`,
    `modules/${MODULE_ID}/templates/quest-editor/advanced.hbs`,
    `modules/${MODULE_ID}/templates/quest-editor/footer.hbs`,

    // Faction Editor templates
    `modules/${MODULE_ID}/templates/faction-editor/tabs.hbs`,
    `modules/${MODULE_ID}/templates/faction-editor/general.hbs`,
    `modules/${MODULE_ID}/templates/faction-editor/ranks.hbs`,
    `modules/${MODULE_ID}/templates/faction-editor/roles.hbs`,
    `modules/${MODULE_ID}/templates/faction-editor/relationships.hbs`,
    `modules/${MODULE_ID}/templates/faction-editor/settings.hbs`,
    `modules/${MODULE_ID}/templates/faction-editor/footer.hbs`,

    // Service Manager template
    `modules/${MODULE_ID}/templates/service-manager.hbs`
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

  // Concat helper - concatenates strings together
  Handlebars.registerHelper("concat", function(...args) {
    // Remove the Handlebars options object from the end
    args.pop();
    return args.join("");
  });

  // Join array helper - joins array elements with a separator
  Handlebars.registerHelper("join", function(array, separator) {
    if (!Array.isArray(array)) return "";
    if (typeof separator !== "string") separator = ", ";
    return array.join(separator);
  });

  // Include helper - check if array includes a value
  Handlebars.registerHelper("includes", function(array, value) {
    if (!Array.isArray(array)) return false;
    return array.includes(value);
  });

  // Add helper - add numbers together
  Handlebars.registerHelper("add", function(a, b) {
    return (Number(a) || 0) + (Number(b) || 0);
  });

  // Subtract helper
  Handlebars.registerHelper("subtract", function(a, b) {
    return (Number(a) || 0) - (Number(b) || 0);
  });

  // Lookup helper - get value from object by key
  Handlebars.registerHelper("lookup", function(obj, key) {
    if (!obj || key === undefined) return undefined;
    return obj[key];
  });

  // Truncate helper - truncate string to a specified length
  Handlebars.registerHelper("truncate", function(str, length) {
    if (typeof str !== "string") return "";
    if (typeof length !== "number") length = 20;
    if (str.length <= length) return str;
    return str.substring(0, length) + "...";
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

  // Initialize all handlers
  initializeHandlers();

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

  // Register time-based hooks for decay/payment/upgrade processing
  registerTimeHooks();

  console.log(`${MODULE_ID} | Ready hooks registered`);
}

/**
 * Register world time hooks for periodic system processing.
 * Only the GM processes these to avoid duplicate world state changes.
 */
function registerTimeHooks() {
  Hooks.on("updateWorldTime", async (worldTime, dt) => {
    if (!game.user.isGM) return;

    const h = handlers;

    // Process bounty decay (crime system)
    if (h.crime) {
      try { await h.crime.processBountyDecay(); } catch (e) {
        console.error(`${MODULE_ID} | processBountyDecay error:`, e);
      }
    }

    // Apply relationship decay
    if (h.relationship) {
      try { await h.relationship.applyRelationshipDecay(); } catch (e) {
        console.error(`${MODULE_ID} | applyRelationshipDecay error:`, e);
      }
    }

    // Check hireling due payments
    if (h.hireling) {
      try { await h.hireling.checkDuePayments(); } catch (e) {
        console.error(`${MODULE_ID} | checkDuePayments error:`, e);
      }
    }

    // Process property condition decay and check completed upgrades
    if (h.property) {
      try {
        await h.property.processConditionDecay();
        await h.property.checkCompletedUpgrades();
      } catch (e) {
        console.error(`${MODULE_ID} | property time update error:`, e);
      }
    }

    // Check repeatable quest resets
    if (h.quest) {
      try { await h.quest.checkRepeatableQuests(); } catch (e) {
        console.error(`${MODULE_ID} | checkRepeatableQuests error:`, e);
      }
    }
  });
}

/**
 * Initialize all module handlers
 */
async function initializeHandlers() {
  try {
    // Create handler instances
    handlers.quest = new QuestHandler();
    handlers.dialogue = new DialogueHandler();
    handlers.faction = new FactionHandler();
    handlers.relationship = new RelationshipHandler();
    handlers.merchant = new MerchantHandler();
    handlers.bank = new BankHandler();
    handlers.crime = new CrimeHandler();
    handlers.hireling = new HirelingHandler();
    handlers.property = new PropertyHandler();
    handlers.npc = new NPCHandler();
    handlers.enchantment = new EnchantmentHandler();

    // Initialize each handler
    for (const [name, handler] of Object.entries(handlers)) {
      if (typeof handler.initialize === "function") {
        handler.initialize();
      }
    }

    // Expose handlers at game.bobsnpc.handlers for debugging
    if (game.bobsnpc) {
      game.bobsnpc.handlers = handlers;
    }

    // Register all service executors
    registerServiceExecutors();

    // Initialize the service database
    handlers.serviceDatabase = new ServiceDatabase();
    await handlers.serviceDatabase.initialize();

    // Register service approval hooks for GM notifications
    registerServiceApprovalHooks();

    console.log(`${MODULE_ID} | Handlers initialized`);
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to initialize handlers:`, error);
  }
}

/**
 * Register all service executors with the executor registry.
 * Order matters: generic must be first (it's the fallback).
 */
function registerServiceExecutors() {
  try {
    registerExecutor(GenericExecutor);
    registerExecutor(IdentifyExecutor);
    registerExecutor(AppraiseExecutor);
    registerExecutor(RepairExecutor);
    registerExecutor(EnchantExecutor);
    registerExecutor(HealingExecutor);
    registerExecutor(RestExecutor);
    registerExecutor(TrainingExecutor);
    registerExecutor(InformationExecutor);
    registerExecutor(ItemModificationExecutor);
    registerExecutor(ItemCreationExecutor);
    registerExecutor(FinancialExecutor);
    console.log(`${MODULE_ID} | Service executors registered`);
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to register service executors:`, error);
  }
}

/**
 * Get a handler instance by name
 * @param {string} name - Handler name
 * @returns {object|null}
 */
export function getHandler(name) {
  return handlers[name] || null;
}

/**
 * Register token interaction hooks
 */
function registerTokenHooks() {
  // Right-click dialogue triggering on tokens
  Hooks.on("canvasReady", () => {
    if (!canvas?.stage) return;

    canvas.stage.on("rightdown", handleCanvasRightClick);
    canvas.stage.on("rightup", handleCanvasRightUp);

    // Refresh all token indicators when canvas is ready
    refreshAllTokenIndicators();

    // Also register right-click on individual tokens
    registerTokenRightClickHandlers();
  });

  // Token HUD integration for NPC indicators
  Hooks.on("renderTokenHUD", (hud, html, data) => {
    if (!getSetting("npcIndicators")) return;
    addTokenIndicators(hud, html, data);
  });

  // Add persistent indicators when tokens are drawn/refreshed
  Hooks.on("refreshToken", (token) => {
    if (!getSetting("npcIndicators")) return;
    addPersistentTokenIndicator(token);
    // Also ensure right-click handler is attached
    attachTokenRightClickHandler(token);
  });

  // Also handle token creation
  Hooks.on("createToken", (tokenDoc) => {
    if (!getSetting("npcIndicators")) return;
    // Small delay to ensure token is fully rendered
    setTimeout(() => {
      const token = canvas.tokens?.get(tokenDoc.id);
      if (token) {
        addPersistentTokenIndicator(token);
        attachTokenRightClickHandler(token);
      }
    }, 100);
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
 * Register right-click handlers on all existing tokens
 */
function registerTokenRightClickHandlers() {
  if (!canvas?.tokens?.placeables) return;
  for (const token of canvas.tokens.placeables) {
    attachTokenRightClickHandler(token);
  }
}

/**
 * Attach right-click handler to a specific token
 * @param {Token} token - The token to attach handler to
 */
function attachTokenRightClickHandler(token) {
  if (!token || token._bobsnpcRightClickHandler) return;

  // Mark that we've attached the handler
  token._bobsnpcRightClickHandler = true;

  // Make token interactive if it isn't already
  if (token.eventMode !== "static" && token.eventMode !== "dynamic") {
    token.eventMode = "static";
  }

  // Listen for right-click on the token directly
  token.on("rightdown", (event) => {
    console.log(`${MODULE_ID} | Token rightdown event on ${token.name}`);

    const actor = token.actor;
    if (!actor) return;

    const npcConfig = actor.getFlag(MODULE_ID, "config");
    if (!npcConfig?.enabled) return;

    const hasDialogue = npcConfig.defaultDialogue || npcConfig.dialogueId || (npcConfig.dialogues?.length > 0);
    if (!hasDialogue) return;

    // Check for double-click (targeting)
    const now = Date.now();
    const timeSinceLastRightClick = now - tokenClickState.lastRightClickTime;

    if (
      token === tokenClickState.rightClickToken &&
      timeSinceLastRightClick < tokenClickState.doubleRightClickThreshold
    ) {
      console.log(`${MODULE_ID} | Double right-click on token, cancelling dialogue`);
      cancelRightClickDialogue();
      tokenClickState.lastRightClickTime = 0;
      return;
    }

    tokenClickState.lastRightClickTime = now;
    tokenClickState.rightClickToken = token;

    cancelRightClickDialogue();
    console.log(`${MODULE_ID} | Starting dialogue timer for ${token.name}`);
    tokenClickState.rightClickTimeout = setTimeout(() => {
      handleTokenRightClickDialogue(token);
    }, tokenClickState.rightClickDelay);
  });
}

/**
 * Refresh indicators for all tokens on the canvas
 */
function refreshAllTokenIndicators() {
  if (!canvas?.tokens?.placeables) return;
  for (const token of canvas.tokens.placeables) {
    addPersistentTokenIndicator(token);
  }
}

/**
 * Add persistent indicator to a token (shows even without HUD)
 * @param {Token} token - The token object
 */
function addPersistentTokenIndicator(token) {
  if (!token?.actor) return;

  // Remove existing indicator if present
  const existingIndicator = token.children?.find(c => c.name === "bobsnpc-indicator");
  if (existingIndicator) {
    token.removeChild(existingIndicator);
  }

  const npcConfig = token.actor.getFlag(MODULE_ID, "config");
  if (!npcConfig?.enabled) return;

  // Check if NPC has dialogue configured
  const hasDialogue = npcConfig.defaultDialogue || npcConfig.dialogueId || (npcConfig.dialogues?.length > 0);
  if (!hasDialogue) return;

  // Create indicator container
  const indicator = new PIXI.Container();
  indicator.name = "bobsnpc-indicator";

  // Make the indicator interactive so it can receive click events
  indicator.eventMode = "static";
  indicator.cursor = "pointer";

  // Position above token
  const tokenSize = Math.max(token.w, token.h);
  indicator.position.set(tokenSize / 2, -10);

  // Create chat bubble background
  const bg = new PIXI.Graphics();
  bg.beginFill(0x4fc3f7, 0.9);
  bg.drawCircle(0, 0, 12);
  bg.endFill();
  // Add border
  bg.lineStyle(2, 0xffffff, 0.8);
  bg.drawCircle(0, 0, 12);
  indicator.addChild(bg);

  // Create icon using text (emoji as fallback)
  const icon = new PIXI.Text("💬", {
    fontSize: 12,
    fill: 0xffffff
  });
  icon.anchor.set(0.5);
  icon.position.set(0, 1);
  indicator.addChild(icon);

  // Add hit area for the indicator (circle with radius 12)
  indicator.hitArea = new PIXI.Circle(0, 0, 14);

  // Add click handler to trigger dialogue
  indicator.on("pointerdown", (event) => {
    console.log(`${MODULE_ID} | Chat bubble clicked for ${token.actor?.name}`);
    event.stopPropagation();
    handleIndicatorClick(token);
  });

  token.addChild(indicator);
}

/**
 * Handle click on the chat bubble indicator
 * @param {Token} token - The token whose indicator was clicked
 */
function handleIndicatorClick(token) {
  const actor = token?.actor;
  if (!actor) return;

  const npcConfig = actor.getFlag(MODULE_ID, "config");
  if (!npcConfig?.enabled) return;

  // Check if there's a dialogue configured
  const dialogueId = npcConfig.defaultDialogue || npcConfig.dialogueId || (npcConfig.dialogues?.[0]);
  if (!dialogueId) return;

  // Get the player's character
  const playerActor = game.user.character;
  if (!playerActor) {
    ui.notifications.warn(game.i18n.localize("BOBSNPC.Errors.NoActorSelected"));
    return;
  }

  // Find the player's token on the canvas
  const playerToken = canvas.tokens.placeables.find(t => t.actor?.uuid === playerActor.uuid);
  if (!playerToken) {
    ui.notifications.warn(game.i18n.localize("BOBSNPC.Errors.NotOnScene"));
    return;
  }

  // Check proximity
  const interactionRange = npcConfig.behavior?.interactionRange ?? 2;
  const distance = getTokenDistance(playerToken, token);

  if (distance > interactionRange) {
    const msg = game.i18n.format("BOBSNPC.Errors.TooFarToTalk", { npc: actor.name });
    ui.notifications.warn(msg);
    return;
  }

  // Emit hook and start dialogue
  Hooks.call(`${MODULE_ID}.npcInteraction`, {
    token,
    actor,
    config: npcConfig,
    initiator: game.user,
    playerToken
  });

  game.bobsnpc?.startDialogue(actor.uuid);
  console.log(`${MODULE_ID} | NPC interaction triggered via indicator for ${actor.name}`);
}

/**
 * Handle canvas right-click down event
 * @param {PIXI.InteractionEvent} event
 */
function handleCanvasRightClick(event) {
  // Get the click position - try different methods for PIXI v7+ compatibility
  let screenPoint;
  if (event.data?.global) {
    screenPoint = event.data.global;
  } else if (event.global) {
    screenPoint = event.global;
  } else if (event.client) {
    // PIXI v7+ uses client coordinates
    screenPoint = { x: event.client.x, y: event.client.y };
  } else if (event.nativeEvent) {
    // Fallback to native browser event
    screenPoint = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
  } else {
    console.log(`${MODULE_ID} | Right-click event structure:`, event);
    return;
  }

  console.log(`${MODULE_ID} | Right-click at screen:`, screenPoint.x, screenPoint.y);

  // Find if a token was right-clicked
  const token = getTokenAtPoint(screenPoint);
  console.log(`${MODULE_ID} | Token found:`, token?.name || "none");

  if (!token) {
    cancelRightClickDialogue();
    return;
  }

  // Check if this NPC has dialogue before proceeding
  const npcConfig = token.actor?.getFlag(MODULE_ID, "config");
  if (!npcConfig?.enabled) {
    console.log(`${MODULE_ID} | Token ${token.name} is not configured as an NPC`);
    cancelRightClickDialogue();
    return;
  }

  const hasDialogue = npcConfig.defaultDialogue || npcConfig.dialogueId || (npcConfig.dialogues?.length > 0);
  if (!hasDialogue) {
    console.log(`${MODULE_ID} | Token ${token.name} has no dialogue configured`);
    cancelRightClickDialogue();
    return;
  }

  const now = Date.now();
  const timeSinceLastRightClick = now - tokenClickState.lastRightClickTime;

  // Check if this is a double-right-click (targeting) - cancel dialogue trigger
  if (
    token === tokenClickState.rightClickToken &&
    timeSinceLastRightClick < tokenClickState.doubleRightClickThreshold
  ) {
    // Double-right-click detected - this is targeting, cancel any pending dialogue
    console.log(`${MODULE_ID} | Double right-click detected, cancelling dialogue`);
    cancelRightClickDialogue();
    tokenClickState.lastRightClickTime = 0;
    return;
  }

  // Record this right-click
  tokenClickState.lastRightClickTime = now;
  tokenClickState.rightClickToken = token;

  // Start a delayed trigger for dialogue
  // If the user releases quickly and doesn't double-right-click, dialogue will trigger
  cancelRightClickDialogue(); // Cancel any existing timeout
  console.log(`${MODULE_ID} | Starting ${tokenClickState.rightClickDelay}ms timer for dialogue trigger`);
  tokenClickState.rightClickTimeout = setTimeout(() => {
    handleTokenRightClickDialogue(token);
  }, tokenClickState.rightClickDelay);
}

/**
 * Handle canvas right-click up event
 * @param {PIXI.InteractionEvent} event
 */
function handleCanvasRightUp(event) {
  // Right-click released - the timeout will handle the dialogue trigger
  // We don't cancel here because we want the delay to complete
}

/**
 * Cancel pending right-click dialogue trigger
 */
function cancelRightClickDialogue() {
  if (tokenClickState.rightClickTimeout) {
    clearTimeout(tokenClickState.rightClickTimeout);
    tokenClickState.rightClickTimeout = null;
  }
}

/**
 * Get token at a given screen point
 * @param {object} screenPoint - Screen coordinates from PIXI event
 * @returns {Token|null}
 */
function getTokenAtPoint(screenPoint) {
  const tokens = canvas.tokens?.placeables || [];

  // Convert screen coordinates to canvas world coordinates
  // First transform to the canvas app coordinate space, then to world space
  let canvasPoint;

  try {
    // Get the canvas element's bounding rect for proper offset calculation
    const canvasRect = canvas.app.view.getBoundingClientRect();
    const adjustedX = screenPoint.x - canvasRect.left;
    const adjustedY = screenPoint.y - canvasRect.top;

    // Transform through the canvas stage
    const transform = canvas.stage.worldTransform;
    const invTransform = transform.clone().invert();

    canvasPoint = {
      x: invTransform.a * adjustedX + invTransform.c * adjustedY + invTransform.tx,
      y: invTransform.b * adjustedX + invTransform.d * adjustedY + invTransform.ty
    };
  } catch (e) {
    // Fallback: try direct stage.toLocal
    const pixiPoint = new PIXI.Point(screenPoint.x, screenPoint.y);
    canvasPoint = canvas.stage.toLocal(pixiPoint);
  }

  console.log(`${MODULE_ID} | Canvas point:`, canvasPoint.x, canvasPoint.y);

  for (const token of tokens) {
    if (!token.visible) continue;

    // Check if point is within token bounds
    const bounds = token.bounds;
    console.log(`${MODULE_ID} | Checking token ${token.name} bounds:`, bounds.x, bounds.y, bounds.width, bounds.height);

    if (canvasPoint.x >= bounds.x &&
        canvasPoint.x <= bounds.x + bounds.width &&
        canvasPoint.y >= bounds.y &&
        canvasPoint.y <= bounds.y + bounds.height) {
      return token;
    }
  }

  return null;
}

/**
 * Handle right-click dialogue trigger on a token
 * @param {Token} npcToken - The NPC token that was right-clicked
 */
function handleTokenRightClickDialogue(npcToken) {
  // Clear the timeout reference
  tokenClickState.rightClickTimeout = null;

  // Check if this is an NPC with module configuration
  const actor = npcToken.actor;
  if (!actor) return;

  const npcConfig = actor.getFlag(MODULE_ID, "config");
  if (!npcConfig?.enabled) return;

  // Check if there's a dialogue configured (support multiple formats)
  const dialogueId = npcConfig.defaultDialogue || npcConfig.dialogueId || (npcConfig.dialogues?.[0]);
  if (!dialogueId) return;

  // Get the player's character token
  const playerActor = game.user.character;
  if (!playerActor) {
    ui.notifications.warn(game.i18n.localize("BOBSNPC.Errors.NoActorSelected"));
    return;
  }

  // Find the player's token on the canvas
  const playerToken = canvas.tokens.placeables.find(t => t.actor?.uuid === playerActor.uuid);
  if (!playerToken) {
    ui.notifications.warn(game.i18n.localize("BOBSNPC.Errors.NotOnScene"));
    return;
  }

  // Check proximity - get interaction range from NPC config or use default
  const interactionRange = npcConfig.behavior?.interactionRange ?? 2; // Default 2 squares
  const distance = getTokenDistance(playerToken, npcToken);

  if (distance > interactionRange) {
    const msg = game.i18n.format("BOBSNPC.Errors.TooFarToTalk", { npc: actor.name });
    ui.notifications.warn(msg);
    return;
  }

  // Emit hook for dialogue initiation
  Hooks.call(`${MODULE_ID}.npcInteraction`, {
    token: npcToken,
    actor,
    config: npcConfig,
    initiator: game.user,
    playerToken
  });

  // Start dialogue
  game.bobsnpc?.startDialogue(actor.uuid);
  console.log(`${MODULE_ID} | NPC interaction triggered for ${actor.name}`);
}

/**
 * Calculate distance between two tokens in grid squares
 * @param {Token} token1
 * @param {Token} token2
 * @returns {number} Distance in grid squares
 */
function getTokenDistance(token1, token2) {
  // Get the center points of the tokens
  const t1Center = token1.center;
  const t2Center = token2.center;

  // Calculate pixel distance
  const dx = t1Center.x - t2Center.x;
  const dy = t1Center.y - t2Center.y;
  const pixelDistance = Math.sqrt(dx * dx + dy * dy);

  // Convert to grid squares
  const gridSize = canvas.grid.size;
  return pixelDistance / gridSize;
}

/**
 * Check if NPC has a specific role (supports both array and object formats)
 * @param {object} config - NPC config
 * @param {string} role - Role to check
 * @returns {boolean}
 */
function checkNPCRole(config, role) {
  if (!config?.roles) return false;
  // Handle array format
  if (Array.isArray(config.roles)) {
    return config.roles.includes(role);
  }
  // Handle object format
  return config.roles[role] ?? false;
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

  // Determine which indicators to show based on roles and config
  const indicators = [];

  // Check for dialogue (chat bubble)
  const hasDialogue = npcConfig.defaultDialogue || npcConfig.dialogueId || (npcConfig.dialogues?.length > 0);
  if (hasDialogue) {
    indicators.push({
      icon: "fa-comment",
      class: "bobsnpc-indicator-dialogue",
      title: game.i18n.localize("BOBSNPC.NPC.HasDialogue"),
      color: "#4fc3f7"
    });
  }

  // Check roles using helper function
  if (checkNPCRole(npcConfig, "questGiver")) {
    indicators.push({
      icon: "fa-exclamation",
      class: "bobsnpc-indicator-quest",
      title: game.i18n.localize("BOBSNPC.NPC.Roles.QuestGiver"),
      color: "#ffd700"
    });
  }

  if (checkNPCRole(npcConfig, "merchant")) {
    indicators.push({
      icon: "fa-coins",
      class: "bobsnpc-indicator-merchant",
      title: game.i18n.localize("BOBSNPC.NPC.Roles.Merchant"),
      color: "#ff9800"
    });
  }

  if (checkNPCRole(npcConfig, "banker")) {
    indicators.push({
      icon: "fa-landmark",
      class: "bobsnpc-indicator-banker",
      title: game.i18n.localize("BOBSNPC.NPC.Roles.Banker"),
      color: "#4caf50"
    });
  }

  if (checkNPCRole(npcConfig, "innkeeper")) {
    indicators.push({
      icon: "fa-bed",
      class: "bobsnpc-indicator-innkeeper",
      title: game.i18n.localize("BOBSNPC.NPC.Roles.Innkeeper"),
      color: "#795548"
    });
  }

  if (checkNPCRole(npcConfig, "trainer")) {
    indicators.push({
      icon: "fa-graduation-cap",
      class: "bobsnpc-indicator-trainer",
      title: game.i18n.localize("BOBSNPC.NPC.Roles.Trainer"),
      color: "#2196f3"
    });
  }

  // Don't add anything if no indicators
  if (indicators.length === 0) return;

  // Create indicator container
  const indicatorContainer = document.createElement("div");
  indicatorContainer.className = "bobsnpc-hud-indicators";
  indicatorContainer.style.cssText = `
    position: absolute;
    top: -30px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 4px;
    z-index: 100;
  `;

  // Add each indicator
  for (const indicator of indicators) {
    const indicatorEl = document.createElement("div");
    indicatorEl.className = `bobsnpc-hud-indicator ${indicator.class}`;
    indicatorEl.title = indicator.title;
    indicatorEl.style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: ${indicator.color || "#607d8b"};
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: pointer;
    `;
    indicatorEl.innerHTML = `<i class="fa-solid ${indicator.icon}" style="color: white; font-size: 12px;"></i>`;
    indicatorContainer.appendChild(indicatorEl);
  }

  // Append to HUD
  html[0].appendChild(indicatorContainer);
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
        if (dialogueId) DialogueEditor.open(dialogueId);
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
        // Always use the base world actor, not synthetic token actors
        // This ensures config is saved to game.actors and visible in dashboard
        const baseActor = actor.isToken
          ? game.actors.get(actor.id) || actor
          : actor;
        game.bobsnpc?.ui?.openNPCConfig(baseActor);
      }
    });
  });

  // Add module shortcuts to sidebar tabs
  Hooks.on("renderSidebarTab", (app, html) => {
    const root = html[0] ?? html;

    // Add Quest Log button to Journal sidebar header
    if (app.tabName === "journal") {
      const header = root.querySelector(".directory-header");
      if (header && !header.querySelector(".bobsnpc-quest-log-btn")) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "bobsnpc-quest-log-btn";
        btn.title = game.i18n.localize("BOBSNPC.QuestLog.Title");
        btn.innerHTML = `<i class="fas fa-scroll"></i> ${game.i18n.localize("BOBSNPC.QuestLog.Title")}`;
        btn.addEventListener("click", () => game.bobsnpc?.ui?.openQuestLog());
        const headerActions = header.querySelector(".header-actions");
        if (headerActions) headerActions.prepend(btn);
        else header.appendChild(btn);
      }
    }

    // Add NPC Dashboard button to Actors sidebar header (GM only)
    if (app.tabName === "actors" && game.user.isGM) {
      const header = root.querySelector(".directory-header");
      if (header && !header.querySelector(".bobsnpc-dashboard-btn")) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "bobsnpc-dashboard-btn";
        btn.title = game.i18n.localize("BOBSNPC.GMDashboard.Title");
        btn.innerHTML = `<i class="fas fa-comments"></i> ${game.i18n.localize("BOBSNPC.GMDashboard.Title")}`;
        btn.addEventListener("click", () => game.bobsnpc?.ui?.openGmDashboard());
        const headerActions = header.querySelector(".header-actions");
        if (headerActions) headerActions.prepend(btn);
        else header.appendChild(btn);
      }
    }
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

