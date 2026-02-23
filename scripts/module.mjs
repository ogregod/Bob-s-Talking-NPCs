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
import { BankingManager } from "./apps/bank-manager.mjs";
import { FactionWindow } from "./apps/faction-window.mjs";
import { HirelingManager } from "./apps/hireling-manager.mjs";
import { PropertyManager } from "./apps/property-manager.mjs";
import { NPCConfig } from "./apps/npc-config.mjs";
import { GMDashboard } from "./apps/gm-dashboard.mjs";
import { TradeWindow } from "./apps/trade-window.mjs";
import { ShopManager } from "./apps/shop-manager.mjs";
import { ShopEditor } from "./apps/shop-editor.mjs";
import { ServiceApprovalDialog } from "./apps/service-approval-dialog.mjs";
import { ServiceDatabaseManager } from "./apps/service-database-manager.mjs";
import { EnchantmentManager } from "./apps/enchantment-manager.mjs";
import { EnchantmentPicker } from "./apps/enchantment-picker.mjs";

// Import migrations
import { registerMigrationSetting, migrateServicePricingToV2 } from "./migrations/service-pricing-v2-migration.mjs";

// Export UI applications for external use
export {
  DialogueWindow,
  QuestLog,
  QuestTracker,
  ShopWindow,
  BankWindow,
  BankingManager,
  FactionWindow,
  HirelingManager,
  PropertyManager,
  NPCConfig,
  GMDashboard,
  TradeWindow,
  ShopManager,
  ShopEditor,
  ServiceApprovalDialog,
  EnchantmentManager,
  EnchantmentPicker
};

/**
 * Initialize the module during Foundry's init hook
 * This runs before the game is fully ready
 */
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing ${MODULE_NAME}`);

  // Register module settings
  registerSettings();

  // Register migration settings
  registerMigrationSetting();

  // Initialize hooks and load templates
  initializeHooks();

  console.log(`${MODULE_ID} | Initialization complete`);
});

/**
 * Set up the module after Foundry is fully ready
 * Game data and user information is available at this point
 */
Hooks.once("ready", async () => {
  console.log(`${MODULE_ID} | Setting up ${MODULE_NAME}`);

  // Register socket handlers for multiplayer sync
  registerSocket();

  // IMPORTANT: Create the API FIRST, before initializing handlers
  // This way registerReadyHooks() can add handlers to the existing API object
  game.bobsnpc = new BobsNPCAPI();

  // Run migrations (GM only) before initializing handlers
  if (game.user.isGM) {
    await migrateServicePricingToV2();
  }

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

      case "shop":
      case "shops":
      case "merchant":
        game.bobsnpc?.ui?.openShopManager();
        break;

      case "enchant":
      case "enchantments":
      case "enchantment":
        game.bobsnpc?.ui?.openEnchantmentManager();
        break;

      case "services":
      case "orders":
      case "queue":
        if (game.user.isGM) {
          ServiceDatabaseManager.open();
        } else {
          // Players see their own service orders
          const playerActor = game.user.character;
          if (playerActor) {
            game.bobsnpc?.ui?.openServiceOrders(playerActor.uuid);
          } else {
            ui.notifications.warn("Select a character first.");
          }
        }
        break;

      case "bank":
      case "banks":
      case "banking":
        if (game.user.isGM) {
          // GMs see the Banking Management System
          BankingManager.open();
        } else {
          ui.notifications.warn("Only GMs can access the Banking Manager. Use a Bank NPC to access your accounts.");
        }
        break;

      case "npc": {
        // Configure selected token's NPC
        const selectedToken = canvas.tokens?.controlled?.[0];
        if (selectedToken?.actor?.type === "npc") {
          // Always use the base world actor, not synthetic token actors
          // This ensures config is saved to the actor in game.actors and visible in dashboard
          const baseActor = selectedToken.document.actorLink
            ? selectedToken.actor
            : game.actors.get(selectedToken.actor.id) || selectedToken.actor;
          game.bobsnpc?.ui?.openNPCConfig(baseActor);
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
              ${game.user.isGM ? '<tr><td><code>/bobsnpc shops</code></td><td>Open Shop Manager</td></tr>' : ''}
              ${game.user.isGM ? '<tr><td><code>/bobsnpc bank</code></td><td>Manage Banks & Branches</td></tr>' : ''}
              ${game.user.isGM ? '<tr><td><code>/bobsnpc enchantments</code></td><td>Open Enchantment Manager</td></tr>' : ''}
              ${game.user.isGM ? '<tr><td><code>/bobsnpc services</code></td><td>Manage Service Orders</td></tr>' : ''}
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
 * Handle service request approve/deny buttons in chat messages
 */
Hooks.on("renderChatMessage", (message, html) => {
  // Check if this is a service request message from our module
  const flags = message.flags?.[MODULE_ID];
  if (!flags?.type || flags.type !== "serviceRequest") return;

  // Only GMs can interact with these buttons
  if (!game.user.isGM) return;

  // Wire up the approve button
  const approveBtn = html.find ? html.find(".approve-btn") : html.querySelector?.(".approve-btn");
  const $approveBtn = approveBtn?.length ? approveBtn : (approveBtn ? [approveBtn] : []);

  for (const btn of $approveBtn) {
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      const requestId = btn.dataset.requestId;
      if (!requestId) return;

      const handler = game.bobsnpc?.handlers?.merchant;
      if (handler) {
        // Use the approval dialog so GM can set custom time
        const result = await handler.showServiceApprovalDialog(requestId);

        if (result?.success) {
          ui.notifications.info(result.message);
          // Update the message to show it's been processed
          const newContent = message.content.replace(
            /<div class="service-actions">[\s\S]*?<\/div>/,
            '<div class="service-actions processed"><i class="fa-solid fa-check"></i> Approved</div>'
          );
          await message.update({ content: newContent });
        } else if (result?.message === "denied") {
          // User chose to deny from the dialog
          const newContent = message.content.replace(
            /<div class="service-actions">[\s\S]*?<\/div>/,
            '<div class="service-actions processed"><i class="fa-solid fa-times"></i> Denied</div>'
          );
          await message.update({ content: newContent });
        }
        // If dialog was closed without action, don't update the message
      }
    });
  }

  // Wire up the deny button
  const denyBtn = html.find ? html.find(".deny-btn") : html.querySelector?.(".deny-btn");
  const $denyBtn = denyBtn?.length ? denyBtn : (denyBtn ? [denyBtn] : []);

  for (const btn of $denyBtn) {
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      const requestId = btn.dataset.requestId;
      if (!requestId) return;

      const handler = game.bobsnpc?.handlers?.merchant;
      if (handler) {
        await handler.processServiceRequest(requestId, false);
        ui.notifications.info("Service request denied");
        // Update the message to show it's been processed
        const newContent = message.content.replace(
          /<div class="service-actions">[\s\S]*?<\/div>/,
          '<div class="service-actions processed"><i class="fa-solid fa-times"></i> Denied</div>'
        );
        await message.update({ content: newContent });
      }
    });
  }
});

/**
 * Handle module setup errors gracefully
 */
Hooks.once("error", (location, error) => {
  if (location.includes(MODULE_ID)) {
    console.error(`${MODULE_ID} | Error during initialization:`, error);
  }
});
