/**
 * Bob's Talking NPCs
 * The complete NPC interaction system for Foundry VTT V13 and D&D 5e
 *
 * @module bobs-talking-npcs
 * @author Arcana5e
 * @license GPL-3.0-or-later
 */

// Module constants
export const MODULE_ID = "bobs-talking-npcs";
export const MODULE_NAME = "Bob's Talking NPCs";

// Import core components
import { registerSettings } from "./settings.mjs";
import { initializeHooks, registerReadyHooks } from "./init.mjs";
import { registerSocket } from "./socket.mjs";
import { BobsNPCAPI } from "./api.mjs";

// Import UI applications
import { DialogueWindow } from "./apps/dialogue-window.mjs";
import { QuestLog } from "./apps/quest-log.mjs";
import { QuestTracker } from "./apps/quest-tracker.mjs";
import { ShopWindow } from "./apps/shop-window.mjs";
import { BankWindow } from "./apps/bank-window.mjs";
import { FactionWindow } from "./apps/faction-window.mjs";
import { HirelingManager } from "./apps/hireling-manager.mjs";
import { PropertyManager } from "./apps/property-manager.mjs";
import { NPCConfig } from "./apps/npc-config.mjs";
import { GMDashboard } from "./apps/gm-dashboard.mjs";

// Export UI applications for external use
export {
  DialogueWindow,
  QuestLog,
  QuestTracker,
  ShopWindow,
  BankWindow,
  FactionWindow,
  HirelingManager,
  PropertyManager,
  NPCConfig,
  GMDashboard
};

/**
 * Initialize the module during Foundry's init hook
 * This runs before the game is fully ready
 */
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing ${MODULE_NAME}`);

  // Register module settings
  registerSettings();

  // Initialize hooks and load templates
  initializeHooks();

  console.log(`${MODULE_ID} | Initialization complete`);
});

/**
 * Set up the module after Foundry is fully ready
 * Game data and user information is available at this point
 */
Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Setting up ${MODULE_NAME}`);

  // Register socket handlers for multiplayer sync
  registerSocket();

  // Register hooks that require game to be ready
  registerReadyHooks();

  // Expose the public API at game.bobsnpc
  game.bobsnpc = new BobsNPCAPI();

  // Log ready message with version
  const moduleData = game.modules.get(MODULE_ID);
  console.log(`${MODULE_ID} | ${MODULE_NAME} v${moduleData?.version} is ready`);

  // Emit hook for other modules to know we're ready
  Hooks.callAll("bobsNPCReady", game.bobsnpc);
});

/**
 * Handle module setup errors gracefully
 */
Hooks.once("error", (location, error) => {
  if (location.includes(MODULE_ID)) {
    console.error(`${MODULE_ID} | Error during initialization:`, error);
  }
});
