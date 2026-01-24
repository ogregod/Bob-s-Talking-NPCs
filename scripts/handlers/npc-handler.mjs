/**
 * Bob's Talking NPCs - NPC Handler
 * Business logic for NPC configuration, roles, interactions, and coordination
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";
import { localize, getFlag, setFlag, generateId } from "../utils/helpers.mjs";
import {
  NPCRole,
  PortraitSource,
  ScheduleDays,
  createNPCConfig,
  createNPCFromTemplate,
  createRoles,
  createScheduleConfig,
  createPortraitConfig,
  createHagglingConfig,
  getActiveRoles,
  hasRole,
  getPrimaryIndicator,
  isNPCAvailable,
  recordVisit,
  getVisitCount,
  validateNPCConfig,
  NPCTemplates
} from "../data/npc-model.mjs";

/**
 * NPC Handler class
 * Manages NPC configuration, interactions, and service coordination
 */
export class NPCHandler {
  constructor() {
    this._initialized = false;
    this._configuredNPCs = new Map(); // actorUuid -> config
    this._indicatorTokens = new Set(); // Token IDs with indicators
  }

  /**
   * Initialize the NPC handler
   */
  async initialize() {
    if (this._initialized) return;

    await this._loadConfiguredNPCs();
    this._registerHooks();

    this._initialized = true;
    console.log(`${MODULE_ID} | NPC handler initialized`);
  }

  /**
   * Register Foundry hooks
   * @private
   */
  _registerHooks() {
    // Token creation - add indicators
    Hooks.on("createToken", (token) => {
      this._updateTokenIndicator(token);
    });

    // Token update - refresh indicators
    Hooks.on("updateToken", (token) => {
      this._updateTokenIndicator(token);
    });

    // Canvas ready - refresh all indicators
    Hooks.on("canvasReady", () => {
      this._refreshAllIndicators();
    });
  }

  // ==================== Data Loading ====================

  /**
   * Load configured NPCs from actor flags
   * @private
   */
  async _loadConfiguredNPCs() {
    this._configuredNPCs.clear();

    // Scan all actors for NPC configurations
    for (const actor of game.actors) {
      const config = getFlag(actor, "config");
      if (config?.enabled) {
        this._configuredNPCs.set(actor.uuid, config);
      }
    }
  }

  /**
   * Reload configuration for a specific actor
   * @param {string} actorUuid - Actor UUID
   */
  async reloadConfig(actorUuid) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return;

    const config = getFlag(actor, "config");
    if (config?.enabled) {
      this._configuredNPCs.set(actorUuid, config);
    } else {
      this._configuredNPCs.delete(actorUuid);
    }
  }

  // ==================== Configuration Management ====================

  /**
   * Configure an NPC
   * @param {string} actorUuid - Actor UUID
   * @param {object} configData - Configuration data
   * @returns {object} Created configuration
   */
  async configureNPC(actorUuid, configData = {}) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const actor = await fromUuid(actorUuid);
    if (!actor) {
      throw new Error(localize("Errors.ActorNotFound"));
    }

    const config = createNPCConfig({
      ...configData,
      configuredAt: Date.now(),
      configuredBy: game.user.id
    });

    const validation = validateNPCConfig(config);
    if (!validation.valid) {
      throw new Error(validation.errors.join(", "));
    }

    // Log warnings
    if (validation.warnings.length > 0) {
      console.warn(`${MODULE_ID} | NPC config warnings for ${actor.name}:`, validation.warnings);
    }

    await setFlag(actor, "config", config);
    this._configuredNPCs.set(actorUuid, config);

    // Update token indicators
    this._refreshActorTokens(actor);

    Hooks.callAll(`${MODULE_ID}.npcConfigured`, actor, config);
    this._emitSocket("npcConfigured", { actorUuid, config });

    return config;
  }

  /**
   * Configure NPC from template
   * @param {string} actorUuid - Actor UUID
   * @param {string} templateName - Template name
   * @param {object} overrides - Data overrides
   * @returns {object}
   */
  async configureFromTemplate(actorUuid, templateName, overrides = {}) {
    const config = createNPCFromTemplate(templateName, {
      ...overrides,
      configuredAt: Date.now(),
      configuredBy: game.user.id
    });

    const actor = await fromUuid(actorUuid);
    if (!actor) {
      throw new Error(localize("Errors.ActorNotFound"));
    }

    await setFlag(actor, "config", config);
    this._configuredNPCs.set(actorUuid, config);

    this._refreshActorTokens(actor);

    Hooks.callAll(`${MODULE_ID}.npcConfigured`, actor, config);
    return config;
  }

  /**
   * Get NPC configuration
   * @param {string} actorUuid - Actor UUID
   * @returns {object|null}
   */
  getConfig(actorUuid) {
    return this._configuredNPCs.get(actorUuid) || null;
  }

  /**
   * Get NPC configuration from actor
   * @param {Actor} actor - Actor document
   * @returns {object|null}
   */
  getConfigFromActor(actor) {
    if (!actor) return null;
    return this._configuredNPCs.get(actor.uuid) || getFlag(actor, "config") || null;
  }

  /**
   * Update NPC configuration
   * @param {string} actorUuid - Actor UUID
   * @param {object} updates - Updates to apply
   * @returns {object} Updated configuration
   */
  async updateConfig(actorUuid, updates) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const actor = await fromUuid(actorUuid);
    if (!actor) {
      throw new Error(localize("Errors.ActorNotFound"));
    }

    const currentConfig = this.getConfig(actorUuid) || createNPCConfig();
    const updatedConfig = {
      ...currentConfig,
      ...updates,
      configuredAt: Date.now()
    };

    await setFlag(actor, "config", updatedConfig);
    this._configuredNPCs.set(actorUuid, updatedConfig);

    this._refreshActorTokens(actor);

    Hooks.callAll(`${MODULE_ID}.npcConfigUpdated`, actor, updatedConfig);
    this._emitSocket("npcConfigUpdated", { actorUuid, config: updatedConfig });

    return updatedConfig;
  }

  /**
   * Disable NPC functionality
   * @param {string} actorUuid - Actor UUID
   */
  async disableNPC(actorUuid) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const actor = await fromUuid(actorUuid);
    if (!actor) return;

    const config = this.getConfig(actorUuid);
    if (config) {
      config.enabled = false;
      await setFlag(actor, "config", config);
    }

    this._configuredNPCs.delete(actorUuid);
    this._refreshActorTokens(actor);

    Hooks.callAll(`${MODULE_ID}.npcDisabled`, actorUuid);
  }

  /**
   * Remove NPC configuration entirely
   * @param {string} actorUuid - Actor UUID
   */
  async removeConfig(actorUuid) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const actor = await fromUuid(actorUuid);
    if (actor) {
      await actor.unsetFlag(MODULE_ID, "config");
    }

    this._configuredNPCs.delete(actorUuid);
    this._refreshActorTokens(actor);

    Hooks.callAll(`${MODULE_ID}.npcConfigRemoved`, actorUuid);
  }

  /**
   * Get all configured NPCs
   * @returns {Map} Map of actorUuid -> config
   */
  getAllConfiguredNPCs() {
    return new Map(this._configuredNPCs);
  }

  /**
   * Get NPCs by role
   * @param {string} role - NPC role
   * @returns {object[]} Array of {actorUuid, config}
   */
  getNPCsByRole(role) {
    const results = [];
    for (const [actorUuid, config] of this._configuredNPCs.entries()) {
      if (hasRole(config, role)) {
        results.push({ actorUuid, config });
      }
    }
    return results;
  }

  /**
   * Get NPCs by faction
   * @param {string} factionId - Faction ID
   * @returns {object[]}
   */
  getNPCsByFaction(factionId) {
    const results = [];
    for (const [actorUuid, config] of this._configuredNPCs.entries()) {
      if (config.factions?.includes(factionId)) {
        results.push({ actorUuid, config });
      }
    }
    return results;
  }

  // ==================== Role Management ====================

  /**
   * Add role to NPC
   * @param {string} actorUuid - Actor UUID
   * @param {string} role - Role to add
   * @returns {object} Updated config
   */
  async addRole(actorUuid, role) {
    const config = this.getConfig(actorUuid);
    if (!config) {
      throw new Error(localize("Errors.NPCNotConfigured"));
    }

    if (!Object.values(NPCRole).includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    config.roles[role] = true;
    return this.updateConfig(actorUuid, { roles: config.roles });
  }

  /**
   * Remove role from NPC
   * @param {string} actorUuid - Actor UUID
   * @param {string} role - Role to remove
   * @returns {object} Updated config
   */
  async removeRole(actorUuid, role) {
    const config = this.getConfig(actorUuid);
    if (!config) {
      throw new Error(localize("Errors.NPCNotConfigured"));
    }

    config.roles[role] = false;
    return this.updateConfig(actorUuid, { roles: config.roles });
  }

  /**
   * Check if NPC has role
   * @param {string} actorUuid - Actor UUID
   * @param {string} role - Role to check
   * @returns {boolean}
   */
  hasRole(actorUuid, role) {
    const config = this.getConfig(actorUuid);
    return hasRole(config, role);
  }

  /**
   * Get active roles for NPC
   * @param {string} actorUuid - Actor UUID
   * @returns {string[]}
   */
  getActiveRoles(actorUuid) {
    const config = this.getConfig(actorUuid);
    return getActiveRoles(config);
  }

  // ==================== Interaction Handling ====================

  /**
   * Start interaction with NPC
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {object} options - Interaction options
   * @returns {object} {available, dialogueId, services, error}
   */
  async startInteraction(npcActorUuid, playerActorUuid, options = {}) {
    const config = this.getConfig(npcActorUuid);
    if (!config || !config.enabled) {
      return { available: false, error: localize("Errors.NPCNotConfigured") };
    }

    const npcActor = await fromUuid(npcActorUuid);
    const playerActor = await fromUuid(playerActorUuid);

    if (!npcActor || !playerActor) {
      return { available: false, error: localize("Errors.ActorNotFound") };
    }

    // Check schedule availability
    const gameTime = this._getGameTime();
    if (!isNPCAvailable(config, gameTime)) {
      return {
        available: false,
        unavailable: true,
        dialogueId: config.schedule.unavailableDialogueId,
        message: config.schedule.unavailableMessage
      };
    }

    // Check location if expected
    if (config.expectedScenes?.length > 0) {
      const currentScene = game.scenes.active?.uuid;
      if (!config.expectedScenes.includes(currentScene)) {
        return {
          available: false,
          wrongLocation: true,
          dialogueId: config.wrongLocationDialogueId,
          message: config.wrongLocationMessage
        };
      }
    }

    // Record visit
    if (config.remembersPlayers) {
      recordVisit(config, playerActorUuid);
      await this.updateConfig(npcActorUuid, {
        visitCount: config.visitCount,
        lastVisit: config.lastVisit
      });
    }

    // Build available services
    const services = this._getAvailableServices(config, npcActorUuid);

    // Get appropriate dialogue
    let dialogueId = config.dialogueId;

    // Check for greeting overrides based on conditions
    if (config.greetingOverrides) {
      const overrideId = await this._evaluateGreetingOverrides(
        config.greetingOverrides,
        { npcActor, playerActor, config }
      );
      if (overrideId) {
        dialogueId = overrideId;
      }
    }

    Hooks.callAll(`${MODULE_ID}.npcInteractionStarted`, npcActor, playerActor);
    this._emitSocket("interactionStarted", { npcActorUuid, playerActorUuid });

    return {
      available: true,
      dialogueId,
      services,
      npcName: npcActor.name,
      portrait: this._getPortraitPath(npcActor, config),
      visitCount: getVisitCount(config, playerActorUuid),
      roles: getActiveRoles(config)
    };
  }

  /**
   * Get available services for NPC
   * @param {object} config - NPC config
   * @param {string} npcActorUuid - NPC actor UUID
   * @returns {object[]}
   * @private
   */
  _getAvailableServices(config, npcActorUuid) {
    const services = [];

    if (hasRole(config, NPCRole.MERCHANT)) {
      services.push({
        type: "merchant",
        label: localize("Services.Shop"),
        icon: "fa-shopping-cart",
        handler: "merchant"
      });
    }

    if (hasRole(config, NPCRole.BANKER)) {
      services.push({
        type: "banker",
        label: localize("Services.Bank"),
        icon: "fa-landmark",
        handler: "bank"
      });
    }

    if (hasRole(config, NPCRole.STABLE_MASTER)) {
      services.push({
        type: "stable",
        label: localize("Services.Stable"),
        icon: "fa-horse",
        handler: "hireling"
      });
    }

    if (hasRole(config, NPCRole.INNKEEPER)) {
      services.push({
        type: "inn",
        label: localize("Services.Inn"),
        icon: "fa-bed",
        data: config.services?.inn
      });
    }

    if (hasRole(config, NPCRole.TRAINER)) {
      services.push({
        type: "training",
        label: localize("Services.Training"),
        icon: "fa-graduation-cap",
        data: config.services?.training
      });
    }

    if (hasRole(config, NPCRole.HIRELING_RECRUITER)) {
      services.push({
        type: "hirelings",
        label: localize("Services.Hirelings"),
        icon: "fa-users",
        handler: "hireling",
        data: { hirelings: config.hirelings }
      });
    }

    if (hasRole(config, NPCRole.QUEST_GIVER)) {
      services.push({
        type: "quests",
        label: localize("Services.Quests"),
        icon: "fa-scroll",
        handler: "quest"
      });
    }

    if (hasRole(config, NPCRole.FACTION_REPRESENTATIVE)) {
      services.push({
        type: "faction",
        label: localize("Services.Faction"),
        icon: "fa-flag",
        handler: "faction",
        data: { factions: config.factions }
      });
    }

    if (hasRole(config, NPCRole.FENCE)) {
      services.push({
        type: "fence",
        label: localize("Services.Fence"),
        icon: "fa-mask",
        handler: "merchant"
      });
    }

    return services;
  }

  /**
   * Get game time for schedule checking
   * @returns {object|null}
   * @private
   */
  _getGameTime() {
    // Try to get game time from SimpleCalendar or other time modules
    if (game.modules.get("foundryvtt-simple-calendar")?.active) {
      const calendar = SimpleCalendar;
      if (calendar?.api) {
        const date = calendar.api.currentDateTime();
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        return {
          hour: date.hour,
          dayOfWeek: days[date.dayOfWeek] || "monday"
        };
      }
    }

    // Fallback - assume available
    return null;
  }

  /**
   * Evaluate greeting overrides
   * @param {object} overrides - Override conditions
   * @param {object} context - Context
   * @returns {string|null} Override dialogue ID
   * @private
   */
  async _evaluateGreetingOverrides(overrides, context) {
    for (const [condition, dialogueId] of Object.entries(overrides)) {
      // Simple condition evaluation
      switch (condition) {
        case "firstVisit":
          if (getVisitCount(context.config, context.playerActor.uuid) <= 1) {
            return dialogueId;
          }
          break;
        case "returningVisitor":
          if (getVisitCount(context.config, context.playerActor.uuid) > 1) {
            return dialogueId;
          }
          break;
        case "frequentVisitor":
          if (getVisitCount(context.config, context.playerActor.uuid) >= 10) {
            return dialogueId;
          }
          break;
        // Additional conditions can be added here
      }
    }
    return null;
  }

  /**
   * Get portrait path for NPC
   * @param {Actor} actor - Actor
   * @param {object} config - NPC config
   * @returns {string|null}
   * @private
   */
  _getPortraitPath(actor, config) {
    if (!config?.portrait) return actor.img;

    switch (config.portrait.source) {
      case PortraitSource.TOKEN:
        return actor.prototypeToken?.texture?.src || actor.img;
      case PortraitSource.ACTOR:
        return actor.img;
      case PortraitSource.CUSTOM:
        return config.portrait.customPath || actor.img;
      default:
        return actor.img;
    }
  }

  /**
   * Access NPC service
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} serviceType - Service type
   * @returns {object}
   */
  async accessService(npcActorUuid, playerActorUuid, serviceType) {
    const config = this.getConfig(npcActorUuid);
    if (!config) {
      return { success: false, error: localize("Errors.NPCNotConfigured") };
    }

    // Route to appropriate handler
    switch (serviceType) {
      case "merchant":
      case "fence":
        if (!hasRole(config, NPCRole.MERCHANT) && !hasRole(config, NPCRole.FENCE)) {
          return { success: false, error: localize("Errors.ServiceUnavailable") };
        }
        return {
          success: true,
          handler: "merchant",
          merchantId: npcActorUuid,
          isFence: hasRole(config, NPCRole.FENCE)
        };

      case "banker":
        if (!hasRole(config, NPCRole.BANKER)) {
          return { success: false, error: localize("Errors.ServiceUnavailable") };
        }
        return {
          success: true,
          handler: "bank",
          bankId: npcActorUuid
        };

      case "stable":
        if (!hasRole(config, NPCRole.STABLE_MASTER)) {
          return { success: false, error: localize("Errors.ServiceUnavailable") };
        }
        return {
          success: true,
          handler: "hireling",
          stableId: npcActorUuid,
          mounts: config.mounts
        };

      case "hirelings":
        if (!hasRole(config, NPCRole.HIRELING_RECRUITER)) {
          return { success: false, error: localize("Errors.ServiceUnavailable") };
        }
        return {
          success: true,
          handler: "hireling",
          recruiterId: npcActorUuid,
          hirelings: config.hirelings
        };

      case "inn":
        if (!hasRole(config, NPCRole.INNKEEPER)) {
          return { success: false, error: localize("Errors.ServiceUnavailable") };
        }
        return {
          success: true,
          handler: "inn",
          innData: config.services?.inn
        };

      case "training":
        if (!hasRole(config, NPCRole.TRAINER)) {
          return { success: false, error: localize("Errors.ServiceUnavailable") };
        }
        return {
          success: true,
          handler: "training",
          trainingData: config.services?.training
        };

      case "faction":
        if (!hasRole(config, NPCRole.FACTION_REPRESENTATIVE)) {
          return { success: false, error: localize("Errors.ServiceUnavailable") };
        }
        return {
          success: true,
          handler: "faction",
          factions: config.factions,
          factionRanks: config.factionRanks
        };

      default:
        return { success: false, error: localize("Errors.UnknownService") };
    }
  }

  // ==================== Token Indicators ====================

  /**
   * Update token indicator
   * @param {Token} token - Token document
   * @private
   */
  _updateTokenIndicator(token) {
    if (!token?.actor) return;

    const config = this.getConfigFromActor(token.actor);
    if (!config?.enabled) {
      this._removeIndicator(token);
      return;
    }

    // Check if indicators are enabled in settings
    if (!game.settings.get(MODULE_ID, "npcIndicators")) {
      return;
    }

    const indicator = getPrimaryIndicator(config);
    if (indicator) {
      this._addIndicator(token, indicator);
    } else {
      this._removeIndicator(token);
    }
  }

  /**
   * Add indicator to token
   * @param {Token} token - Token
   * @param {object} indicator - Indicator data
   * @private
   */
  _addIndicator(token, indicator) {
    // Store indicator info for rendering
    this._indicatorTokens.add(token.id);

    // Trigger indicator render (implementation depends on UI layer)
    Hooks.callAll(`${MODULE_ID}.indicatorUpdate`, token, indicator);
  }

  /**
   * Remove indicator from token
   * @param {Token} token - Token
   * @private
   */
  _removeIndicator(token) {
    this._indicatorTokens.delete(token.id);
    Hooks.callAll(`${MODULE_ID}.indicatorRemove`, token);
  }

  /**
   * Refresh indicators for an actor's tokens
   * @param {Actor} actor - Actor
   * @private
   */
  _refreshActorTokens(actor) {
    if (!actor) return;

    // Find all tokens for this actor
    for (const scene of game.scenes) {
      for (const token of scene.tokens) {
        if (token.actor?.id === actor.id) {
          this._updateTokenIndicator(token);
        }
      }
    }
  }

  /**
   * Refresh all indicators
   * @private
   */
  _refreshAllIndicators() {
    if (!game.canvas?.tokens) return;

    for (const token of game.canvas.tokens.placeables) {
      this._updateTokenIndicator(token.document);
    }
  }

  /**
   * Get indicator for token
   * @param {string} tokenId - Token ID
   * @returns {object|null}
   */
  getIndicatorForToken(tokenId) {
    const token = game.canvas?.tokens?.get(tokenId);
    if (!token?.actor) return null;

    const config = this.getConfigFromActor(token.actor);
    return getPrimaryIndicator(config);
  }

  // ==================== Faction Integration ====================

  /**
   * Add faction to NPC
   * @param {string} actorUuid - Actor UUID
   * @param {string} factionId - Faction ID
   * @param {string} rankId - Optional rank ID
   * @returns {object}
   */
  async addFaction(actorUuid, factionId, rankId = null) {
    const config = this.getConfig(actorUuid);
    if (!config) {
      throw new Error(localize("Errors.NPCNotConfigured"));
    }

    if (!config.factions.includes(factionId)) {
      config.factions.push(factionId);
    }

    if (rankId) {
      config.factionRanks[factionId] = rankId;
    }

    return this.updateConfig(actorUuid, {
      factions: config.factions,
      factionRanks: config.factionRanks
    });
  }

  /**
   * Remove faction from NPC
   * @param {string} actorUuid - Actor UUID
   * @param {string} factionId - Faction ID
   * @returns {object}
   */
  async removeFaction(actorUuid, factionId) {
    const config = this.getConfig(actorUuid);
    if (!config) {
      throw new Error(localize("Errors.NPCNotConfigured"));
    }

    config.factions = config.factions.filter(f => f !== factionId);
    delete config.factionRanks[factionId];

    return this.updateConfig(actorUuid, {
      factions: config.factions,
      factionRanks: config.factionRanks
    });
  }

  // ==================== Dialogue Integration ====================

  /**
   * Set NPC dialogue
   * @param {string} actorUuid - Actor UUID
   * @param {string} dialogueId - Dialogue ID
   * @returns {object}
   */
  async setDialogue(actorUuid, dialogueId) {
    return this.updateConfig(actorUuid, { dialogueId });
  }

  /**
   * Set greeting override
   * @param {string} actorUuid - Actor UUID
   * @param {string} condition - Condition key
   * @param {string} dialogueNodeId - Dialogue node ID
   * @returns {object}
   */
  async setGreetingOverride(actorUuid, condition, dialogueNodeId) {
    const config = this.getConfig(actorUuid);
    if (!config) {
      throw new Error(localize("Errors.NPCNotConfigured"));
    }

    const overrides = { ...config.greetingOverrides, [condition]: dialogueNodeId };
    return this.updateConfig(actorUuid, { greetingOverrides: overrides });
  }

  // ==================== Schedule Management ====================

  /**
   * Set NPC schedule
   * @param {string} actorUuid - Actor UUID
   * @param {object} scheduleData - Schedule data
   * @returns {object}
   */
  async setSchedule(actorUuid, scheduleData) {
    const schedule = createScheduleConfig(scheduleData);
    return this.updateConfig(actorUuid, { schedule });
  }

  /**
   * Check if NPC is currently available
   * @param {string} actorUuid - Actor UUID
   * @returns {boolean}
   */
  isAvailable(actorUuid) {
    const config = this.getConfig(actorUuid);
    if (!config) return false;

    const gameTime = this._getGameTime();
    return isNPCAvailable(config, gameTime);
  }

  // ==================== Utility ====================

  /**
   * Get available NPC templates
   * @returns {object}
   */
  getTemplates() {
    return { ...NPCTemplates };
  }

  /**
   * Get available roles
   * @returns {object}
   */
  getRoles() {
    return { ...NPCRole };
  }

  /**
   * Validate configuration
   * @param {object} config - Config to validate
   * @returns {object}
   */
  validate(config) {
    return validateNPCConfig(config);
  }

  // ==================== Socket Handling ====================

  /**
   * Emit socket event
   * @private
   */
  _emitSocket(event, data) {
    if (game.socket) {
      game.socket.emit(`module.${MODULE_ID}`, {
        type: `npc.${event}`,
        ...data
      });
    }
  }

  /**
   * Handle incoming socket events
   * @param {object} data - Socket data
   */
  async handleSocket(data) {
    const { type } = data;

    switch (type) {
      case "npc.npcConfigured":
      case "npc.npcConfigUpdated":
        if (!game.user.isGM) {
          await this.reloadConfig(data.actorUuid);
        }
        break;

      case "npc.interactionStarted":
        Hooks.callAll(`${MODULE_ID}.npcInteractionStarted`, data.npcActorUuid, data.playerActorUuid);
        break;
    }
  }

  // ==================== Data Export/Import ====================

  /**
   * Export all NPC configurations
   * @returns {object}
   */
  exportData() {
    return {
      npcs: Object.fromEntries(this._configuredNPCs)
    };
  }

  /**
   * Import NPC configurations
   * @param {object} data - Import data
   */
  async importData(data) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    if (data.npcs) {
      for (const [actorUuid, config] of Object.entries(data.npcs)) {
        const actor = await fromUuid(actorUuid);
        if (actor) {
          await setFlag(actor, "config", config);
          this._configuredNPCs.set(actorUuid, config);
        }
      }
    }
  }
}

// Singleton instance
export const npcHandler = new NPCHandler();
