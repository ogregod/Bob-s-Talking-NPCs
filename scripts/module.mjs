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
import { TradeWindow } from "./apps/trade-window.mjs";

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
  GMDashboard,
  TradeWindow
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

  // IMPORTANT: Create the API FIRST, before initializing handlers
  // This way registerReadyHooks() can add handlers to the existing API object
  game.bobsnpc = new BobsNPCAPI();

  // Register hooks that require game to be ready (this adds handlers to game.bobsnpc)
  registerReadyHooks();

  // Log ready message with version
  const moduleData = game.modules.get(MODULE_ID);
  console.log(`${MODULE_ID} | ${MODULE_NAME} v${moduleData?.version} is ready`);

  // Send welcome message to chat (GM only to avoid spam)
  if (game.user.isGM) {
    ChatMessage.create({
      content: `<div style="border: 2px solid #7b68ee; border-radius: 8px; padding: 10px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);">
        <h3 style="margin: 0 0 8px 0; color: #7b68ee; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-comments"></i> Bob's Talking NPCs
        </h3>
        <p style="margin: 0; color: #e0e0e0; font-size: 0.9em;">
          Module loaded successfully! v${moduleData?.version || "0.1.0"}
        </p>
        <p style="margin: 4px 0 0 0; color: #a0a0a0; font-size: 0.8em;">
          Double-click an NPC token to start a dialogue. Type <code>/bobsnpc</code> for commands.
        </p>
      </div>`,
      whisper: [game.user.id],
      speaker: { alias: "Bob's Talking NPCs" }
    });
  }

  // Emit hook for other modules to know we're ready
  Hooks.callAll("bobsNPCReady", game.bobsnpc);
});

/**
 * Handle /bobsnpc chat command
 * This hook intercepts chat messages starting with /bobsnpc
 */
Hooks.on("chatMessage", (chatLog, message, chatData) => {
  // Only handle messages starting with /bobsnpc
  if (!message.startsWith("/bobsnpc")) return true;

  try {
    const args = message.slice(9).trim().split(/\s+/);
    const command = args[0]?.toLowerCase() || "help";

    console.log(`${MODULE_ID} | Processing command: ${command}`);

    switch (command) {
      case "quest":
      case "quests":
      case "log":
        game.bobsnpc?.ui?.openQuestLog();
        break;

      case "faction":
      case "factions":
      case "rep":
        game.bobsnpc?.ui?.openFactionOverview();
        break;

      case "tracker":
        game.bobsnpc?.ui?.openQuestTracker();
        break;

      case "dashboard":
      case "gm":
        game.bobsnpc?.ui?.openGmDashboard();
        break;

      case "npc": {
        // Configure selected token's NPC
        const selectedToken = canvas.tokens?.controlled?.[0];
        if (selectedToken?.actor?.type === "npc") {
          game.bobsnpc?.ui?.openNPCConfig(selectedToken.actor);
        } else {
          ui.notifications.warn("Select an NPC token first");
        }
        break;
      }

      case "help":
      default:
        // Show help message
        ChatMessage.create({
          content: `<div style="border: 2px solid #7b68ee; border-radius: 8px; padding: 10px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);">
            <h3 style="margin: 0 0 10px 0; color: #7b68ee;">
              <i class="fas fa-comments"></i> Bob's Talking NPCs Commands
            </h3>
            <table style="width: 100%; color: #e0e0e0; font-size: 0.85em;">
              <tr><td><code>/bobsnpc quest</code></td><td>Open Quest Log</td></tr>
              <tr><td><code>/bobsnpc faction</code></td><td>Open Faction Overview</td></tr>
              <tr><td><code>/bobsnpc tracker</code></td><td>Open Quest Tracker</td></tr>
              <tr><td><code>/bobsnpc npc</code></td><td>Configure selected NPC</td></tr>
              ${game.user.isGM ? '<tr><td><code>/bobsnpc dashboard</code></td><td>Open GM Dashboard</td></tr>' : ''}
            </table>
            <p style="margin: 10px 0 0 0; color: #a0a0a0; font-size: 0.8em;">
              <strong>Keybindings:</strong> J = Quest Log, Shift+J = Factions, Shift+T = Toggle Tracker
            </p>
          </div>`,
          whisper: [game.user.id],
          speaker: { alias: "Bob's Talking NPCs" }
        });
        break;
    }
  } catch (error) {
    console.error(`${MODULE_ID} | Error processing command:`, error);
    ui.notifications.error("Error processing Bob's Talking NPCs command");
  }

  // Prevent the message from being posted to chat
  return false;
});

/**
 * Handle module setup errors gracefully
 */
Hooks.once("error", (location, error) => {
  if (location.includes(MODULE_ID)) {
    console.error(`${MODULE_ID} | Error during initialization:`, error);
  }
});
