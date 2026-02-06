/**
 * Bob's Talking NPCs - Dialogue Window
 * Main NPC conversation interface using Foundry V13 ApplicationV2
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";

/** Get dialogue handler instance from API */
function getDialogueHandler() {
  return game.bobsnpc?.handlers?.dialogue;
}

/** Get NPC handler instance from API */
function getNpcHandler() {
  return game.bobsnpc?.handlers?.npc;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dialogue Window Application
 * Displays NPC conversations with portrait, text, and response options
 */
export class DialogueWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options - Application options
   * @param {string} options.npcActorUuid - NPC actor UUID
   * @param {string} options.playerActorUuid - Player actor UUID
   * @param {string} options.dialogueId - Dialogue tree ID
   * @param {string} options.sessionId - Existing session ID (for rejoining)
   */
  constructor(options = {}) {
    super(options);

    this.npcActorUuid = options.npcActorUuid;
    this.playerActorUuid = options.playerActorUuid;
    this.dialogueId = options.dialogueId;
    this.sessionId = options.sessionId || null;

    this._npcActor = null;
    this._playerActor = null;
    this._currentNode = null;
    this._session = null;
    this._typewriterInterval = null;
    this._displayedText = "";
    this._fullText = "";
    this._isTyping = false;
    this._initialized = false;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-dialogue",
    classes: ["bobsnpc", "dialogue-window"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.Dialogue.Title",
      icon: "fa-solid fa-comments",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 600,
      height: 500
    },
    actions: {
      selectResponse: DialogueWindow.#onSelectResponse,
      skipTypewriter: DialogueWindow.#onSkipTypewriter,
      openService: DialogueWindow.#onOpenService,
      endDialogue: DialogueWindow.#onEndDialogue
    }
  };

  /** @override */
  static PARTS = {
    header: {
      template: `modules/${MODULE_ID}/templates/dialogue/header.hbs`
    },
    content: {
      template: `modules/${MODULE_ID}/templates/dialogue/content.hbs`,
      scrollable: [".dialogue-text-container"]
    },
    responses: {
      template: `modules/${MODULE_ID}/templates/dialogue/responses.hbs`
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/dialogue/footer.hbs`
    }
  };

  /** @override */
  get title() {
    return this._npcActor?.name || localize("Dialogue.Title");
  }

  /** @override */
  async _preFirstRender(context, options) {
    await super._preFirstRender(context, options);
    // Register for socket updates
    this._registerSocketListener();
  }

  /**
   * Initialize dialogue data (lazy loading for _prepareContext)
   * @private
   */
  async _ensureInitialized() {
    // Only initialize once
    if (this._initialized) return;
    this._initialized = true;

    // Load actors
    this._npcActor = await fromUuid(this.npcActorUuid);
    this._playerActor = await fromUuid(this.playerActorUuid);

    if (!this._npcActor) {
      throw new Error(localize("Errors.ActorNotFound"));
    }

    // Start or resume dialogue session
    if (this.sessionId) {
      this._session = getDialogueHandler().getSession(this.sessionId);
    }

    if (!this._session) {
      console.log(`${MODULE_ID} | Starting dialogue session with dialogueId: "${this.dialogueId}"`);
      const result = await getDialogueHandler().startDialogue(
        this.dialogueId,
        this.npcActorUuid,
        [this.playerActorUuid] // Pass as array since handler expects participantUuids
      );
      console.log(`${MODULE_ID} | startDialogue result:`, result);
      this._session = result?.session;
      this.sessionId = result?.session?.id;
      this._currentNode = result?.node; // Handler returns 'node', not 'currentNode'
    } else {
      this._currentNode = this._session.currentNode;
    }

    // If no dialogue content exists, create a fallback greeting
    if (!this._currentNode) {
      const npcName = this._npcActor?.name || "NPC";
      this._currentNode = {
        id: "fallback-greeting",
        type: "greeting",
        text: `Greetings, traveler. I am ${npcName}. (No dialogue has been configured for this NPC yet.)`,
        speaker: "npc",
        emotion: "neutral",
        responses: [
          {
            id: "farewell",
            text: "Farewell.",
            nextNodeId: null // Ends dialogue
          }
        ]
      };
      console.warn(`${MODULE_ID} | No dialogue found for ${npcName}, using fallback greeting`);
    }
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Ensure dialogue data is initialized before preparing context
    await this._ensureInitialized();

    const npcConfig = getNpcHandler().getConfig(this.npcActorUuid);
    const portrait = this._getPortrait(npcConfig);
    const theme = game.settings.get(MODULE_ID, "theme") || "dark";

    // Get available responses (handle array or object map)
    let responses = this._currentNode?.responses || [];
    console.log(`${MODULE_ID} | Raw responses from node:`, responses, `isArray: ${Array.isArray(responses)}`);

    if (!Array.isArray(responses) && typeof responses === "object") {
      // Convert object map to array, preserving the key as the id
      responses = Object.entries(responses).map(([key, value]) => ({
        ...value,
        id: value.id || key  // Use existing id or the object key
      }));
    } else if (Array.isArray(responses)) {
      // Ensure array items have IDs - generate if missing
      responses = responses.map((r, index) => ({
        ...r,
        id: r.id || `response-${index}`  // Use existing id or generate one
      }));
    }

    console.log(`${MODULE_ID} | Processed responses with IDs:`, responses);
    const availableResponses = await this._filterAvailableResponses(responses);

    // Get available services if at a service node
    const services = this._currentNode?.services || [];

    // Build display text
    const dialogueText = this._displayedText || this._currentNode?.text || "";
    const speakerType = this._currentNode?.speaker || "npc";
    const speakerName = speakerType === "npc" ? (this._npcActor?.name || localize("NPC.Unknown")) : (this._playerActor?.name || game.user.name);

    // Debug logging
    console.log(`${MODULE_ID} | _prepareContext - currentNode:`, this._currentNode);
    console.log(`${MODULE_ID} | _prepareContext - dialogueText: "${dialogueText}"`);
    console.log(`${MODULE_ID} | _prepareContext - responses:`, responses);

    // Format responses with availability defaulting to true
    const formattedResponses = availableResponses.map((r, i) => {
      // Only include skillCheck if it's properly configured with both skill and dc
      const hasSkillCheck = r.skillCheck && r.skillCheck.skill && r.skillCheck.dc;
      return {
        ...r,
        index: i,
        shortcut: i < 9 ? i + 1 : null,
        available: r.available !== false, // Default to available
        requiresRoll: hasSkillCheck,
        skillCheck: hasSkillCheck ? {
          skill: r.skillCheck.skill,
          dc: r.skillCheck.dc,
          tooltip: `${r.skillCheck.skill} DC ${r.skillCheck.dc}`
        } : null
      };
    });

    // Format services with icons and labels
    const formattedServices = services.map(s => ({
      ...s,
      icon: this._getServiceIcon(s.type),
      label: localize(`Services.${s.type}`)
    }));

    // Get multiplayer info
    const participants = this._session?.participants || [];
    const isMultiplayer = participants.length > 1;

    return {
      ...context,
      // Top-level variables for header template
      npcPortrait: portrait,
      npcName: this._npcActor?.name || localize("NPC.Unknown"),
      npcTitle: npcConfig?.title || null,
      npcFaction: npcConfig?.faction?.name || null,
      npcFactionColor: npcConfig?.faction?.color || null,
      mood: this._currentNode?.emotion || "neutral",
      moodIcon: this._getMoodIcon(this._currentNode?.emotion || "neutral"),

      // Top-level variables for content template
      dialogueText,
      speakerName: speakerType === "npc" ? speakerName : null,
      isTypewriting: this._isTyping,
      hasItems: false, // TODO: implement item display
      hasQuest: false, // TODO: implement quest display

      // Top-level variables for responses template
      hasResponses: formattedResponses.length > 0,
      responses: formattedResponses,
      isMultiplayer,
      participantCount: participants.length,
      votingEnabled: false, // TODO: implement voting
      votesCollected: 0,
      hasVoted: false,

      // Top-level variables for footer template
      hasServices: formattedServices.length > 0,
      services: formattedServices,
      canGoBack: false, // TODO: implement history navigation
      showHistory: false,
      isGM: game.user.isGM,
      theme,

      // Structured data (for backwards compatibility)
      npc: {
        name: this._npcActor?.name || localize("NPC.Unknown"),
        portrait,
        uuid: this.npcActorUuid
      },
      player: {
        name: this._playerActor?.name || game.user.name,
        uuid: this.playerActorUuid
      },
      dialogue: {
        id: this.dialogueId,
        sessionId: this.sessionId,
        nodeId: this._currentNode?.id,
        text: dialogueText,
        fullText: this._currentNode?.text || "",
        speaker: speakerType,
        emotion: this._currentNode?.emotion || "neutral",
        isTyping: this._isTyping
      },
      participants,
      settings: {
        typewriterEnabled: game.settings.get(MODULE_ID, "typewriterSpeed") > 0,
        typewriterSpeed: game.settings.get(MODULE_ID, "typewriterSpeed"),
        soundEnabled: game.settings.get(MODULE_ID, "soundEnabled"),
        theme
      }
    };
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    // Start typewriter effect if enabled
    if (context.settings.typewriterEnabled && this._currentNode?.text) {
      this._startTypewriter(this._currentNode.text);
    } else {
      this._displayedText = this._currentNode?.text || "";
    }

    // Register keyboard shortcuts
    this._registerKeyboardShortcuts();
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);

    // Focus response container for keyboard navigation
    const responseContainer = this.element.querySelector(".dialogue-responses");
    if (responseContainer) {
      responseContainer.focus();
    }
  }

  /** @override */
  async _onClose(options) {
    await super._onClose(options);

    // Clean up
    this._stopTypewriter();
    this._unregisterSocketListener();
    this._unregisterKeyboardShortcuts();

    // End session if owner
    if (this._session && game.user.isGM) {
      await getDialogueHandler().endDialogue(this.sessionId);
    }
  }

  // ==================== Typewriter Effect ====================

  /**
   * Start typewriter effect
   * @param {string} text - Full text to display
   * @private
   */
  _startTypewriter(text) {
    this._fullText = text;
    this._displayedText = "";
    this._isTyping = true;

    const speed = game.settings.get(MODULE_ID, "typewriterSpeed") || 30;
    const delay = 1000 / speed; // Characters per second

    let index = 0;
    this._typewriterInterval = setInterval(() => {
      if (index < this._fullText.length) {
        this._displayedText += this._fullText[index];
        index++;
        this._updateDialogueText();
      } else {
        this._stopTypewriter();
      }
    }, delay);
  }

  /**
   * Stop typewriter effect and show full text
   * @private
   */
  _stopTypewriter() {
    if (this._typewriterInterval) {
      clearInterval(this._typewriterInterval);
      this._typewriterInterval = null;
    }

    if (this._isTyping) {
      this._displayedText = this._fullText;
      this._isTyping = false;
      this._updateDialogueText();
    }
  }

  /**
   * Update dialogue text display
   * @private
   */
  _updateDialogueText() {
    const textEl = this.element?.querySelector(".dialogue-text");
    if (textEl) {
      textEl.innerHTML = this._displayedText;
    }

    // Update typing indicator
    const indicator = this.element?.querySelector(".typing-indicator");
    if (indicator) {
      indicator.style.display = this._isTyping ? "inline" : "none";
    }
  }

  // ==================== Response Handling ====================

  /**
   * Filter responses based on conditions
   * @param {object[]|object} responses - All responses (array or object map)
   * @returns {object[]} Available responses
   * @private
   */
  async _filterAvailableResponses(responses) {
    const available = [];

    // Normalize responses to array if it's an object map
    let responseArray = responses;
    if (!Array.isArray(responses)) {
      if (responses && typeof responses === "object") {
        // Convert object map to array, preserving the key as the id
        responseArray = Object.entries(responses).map(([key, value]) => ({
          ...value,
          id: value.id || key  // Use existing id or the object key
        }));
      } else {
        responseArray = [];
      }
    }

    for (const response of responseArray) {
      if (response.conditions?.length > 0) {
        const conditionsMet = await getDialogueHandler().evaluateConditions(
          response.conditions,
          {
            npcActorUuid: this.npcActorUuid,
            playerActorUuid: this.playerActorUuid,
            session: this._session
          }
        );
        if (!conditionsMet) continue;
      }
      available.push(response);
    }

    return available;
  }

  /**
   * Select a response
   * @param {string} responseId - Response ID
   * @param {object} rollResult - Optional roll result for skill checks
   */
  async selectResponse(responseId, rollResult = null) {
    if (this._isTyping) {
      this._stopTypewriter();
      return;
    }

    try {
      console.log(`${MODULE_ID} | Selecting response: ${responseId}`);

      const result = await getDialogueHandler().selectResponse(
        this.sessionId,
        responseId,
        rollResult
      );

      console.log(`${MODULE_ID} | selectResponse result:`, result);

      if (result.ended) {
        // Dialogue ended
        console.log(`${MODULE_ID} | Dialogue ended, closing window`);
        await this.close();
        return;
      }

      // Handle service nodes (SHOP, BANK, etc.)
      if (result.service) {
        console.log(`${MODULE_ID} | Service node detected:`, result.service);
        await this._handleServiceNode(result.service, result.node);
        return;
      }

      if (!result.node) {
        // No node returned but not ended - something went wrong
        console.warn(`${MODULE_ID} | No node returned from selectResponse but not ended`);
        await this.close();
        return;
      }

      // Update current node
      this._currentNode = result.node;
      this._displayedText = "";

      console.log(`${MODULE_ID} | Moving to node:`, this._currentNode?.id, this._currentNode?.text?.substring(0, 50));

      // Re-render
      await this.render();

      // Start typewriter for new text
      if (game.settings.get(MODULE_ID, "typewriterSpeed") > 0 && this._currentNode?.text) {
        this._startTypewriter(this._currentNode.text);
      }

    } catch (error) {
      console.error(`${MODULE_ID} | Error selecting response:`, error);
      ui.notifications.error(error.message);
    }
  }

  /**
   * Handle skill check for response
   * @param {object} response - Response with skill check
   * @private
   */
  async _handleSkillCheck(response) {
    const skillCheck = response.skillCheck;
    if (!skillCheck || !this._playerActor) return null;

    // Roll the skill check
    const skill = this._playerActor.system.skills?.[skillCheck.skill];
    if (!skill) {
      ui.notifications.warn(localize("Errors.SkillNotFound"));
      return null;
    }

    // Use D&D 5e roll system
    const roll = await this._playerActor.rollSkill(skillCheck.skill, {
      targetValue: skillCheck.dc,
      chatMessage: true
    });

    return {
      total: roll.total,
      success: roll.total >= skillCheck.dc,
      critical: roll.dice[0]?.total === 20,
      fumble: roll.dice[0]?.total === 1
    };
  }

  // ==================== Actions ====================

  /**
   * Handle response selection
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onSelectResponse(event, target) {
    const responseId = target.dataset.responseId;
    const requiresRoll = target.dataset.requiresRoll === "true";

    let rollResult = null;
    if (requiresRoll) {
      // Handle responses as array or object map
      let response;
      const responses = this._currentNode?.responses;
      if (Array.isArray(responses)) {
        response = responses.find(r => r.id === responseId);
      } else if (responses && typeof responses === "object") {
        response = responses[responseId];
      }

      if (response?.skillCheck) {
        rollResult = await this._handleSkillCheck(response);
        if (!rollResult) return; // Roll was cancelled
      }
    }

    await this.selectResponse(responseId, rollResult);
  }

  /**
   * Skip typewriter effect
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static #onSkipTypewriter(event, target) {
    this._stopTypewriter();
  }

  /**
   * Open a service window
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onOpenService(event, target) {
    const serviceType = target.dataset.serviceType;

    // Route to appropriate service window
    const result = await getNpcHandler().accessService(
      this.npcActorUuid,
      this.playerActorUuid,
      serviceType
    );

    if (!result.success) {
      ui.notifications.error(result.error);
      return;
    }

    // Open appropriate window based on handler
    switch (result.handler) {
      case "merchant":
        game.bobsnpc?.ui?.openShop(this.npcActorUuid, this.playerActorUuid);
        break;
      case "bank":
        game.bobsnpc?.ui?.openBank(this.npcActorUuid, this.playerActorUuid);
        break;
      case "hireling":
        game.bobsnpc?.ui?.openHirelings(this.npcActorUuid, this.playerActorUuid);
        break;
      case "faction":
        game.bobsnpc?.ui?.openFactions(result.factions);
        break;
    }
  }

  /**
   * End dialogue
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onEndDialogue(event, target) {
    await this.close();
  }

  // ==================== Keyboard Shortcuts ====================

  /**
   * Register keyboard shortcuts
   * @private
   */
  _registerKeyboardShortcuts() {
    this._keyHandler = this._onKeyDown.bind(this);
    document.addEventListener("keydown", this._keyHandler);
  }

  /**
   * Unregister keyboard shortcuts
   * @private
   */
  _unregisterKeyboardShortcuts() {
    if (this._keyHandler) {
      document.removeEventListener("keydown", this._keyHandler);
      this._keyHandler = null;
    }
  }

  /**
   * Handle keyboard input
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  _onKeyDown(event) {
    // Only handle if this window is focused/active
    if (!this.element?.contains(document.activeElement) &&
        document.activeElement !== document.body) {
      return;
    }

    // Number keys 1-9 for response selection
    if (event.key >= "1" && event.key <= "9") {
      const index = parseInt(event.key) - 1;
      const responses = this.element?.querySelectorAll(".dialogue-response");
      if (responses?.[index]) {
        responses[index].click();
        event.preventDefault();
      }
    }

    // Space or Enter to skip typewriter
    if ((event.key === " " || event.key === "Enter") && this._isTyping) {
      this._stopTypewriter();
      event.preventDefault();
    }

    // Escape to close
    if (event.key === "Escape") {
      this.close();
      event.preventDefault();
    }
  }

  // ==================== Socket Integration ====================

  /**
   * Register socket listener for multiplayer updates
   * @private
   */
  _registerSocketListener() {
    this._socketHandler = this._onSocketMessage.bind(this);
    Hooks.on(`${MODULE_ID}.socketReceived`, this._socketHandler);
  }

  /**
   * Unregister socket listener
   * @private
   */
  _unregisterSocketListener() {
    if (this._socketHandler) {
      Hooks.off(`${MODULE_ID}.socketReceived`, this._socketHandler);
      this._socketHandler = null;
    }
  }

  /**
   * Handle socket messages
   * @param {object} data - Socket data
   * @private
   */
  async _onSocketMessage(data) {
    if (data.sessionId !== this.sessionId) return;

    switch (data.type) {
      case "dialogue.nodeChanged":
        this._currentNode = data.node;
        await this.render();
        if (game.settings.get(MODULE_ID, "typewriterSpeed") > 0 && this._currentNode?.text) {
          this._startTypewriter(this._currentNode.text);
        }
        break;

      case "dialogue.ended":
        await this.close();
        break;

      case "dialogue.participantJoined":
        await this.render();
        break;
    }
  }

  // ==================== Service Node Handling ====================

  /**
   * Handle a service node (SHOP, BANK, HIRE, STABLE, SERVICE)
   * @param {object} serviceData - Service data from the dialogue handler
   * @param {object} node - The service node
   * @private
   */
  async _handleServiceNode(serviceData, node) {
    console.log(`${MODULE_ID} | Handling service node:`, serviceData.type, serviceData.serviceType);

    // Store service info for potential callback
    this._pendingServiceNextNodeId = serviceData.nextNodeId;

    try {
      switch (serviceData.type) {
        case "shop":
          await this._openShopService(serviceData);
          break;
        case "bank":
          await this._openBankService(serviceData);
          break;
        case "hire":
          await this._openHireService(serviceData);
          break;
        case "stable":
          await this._openStableService(serviceData);
          break;
        case "service":
          await this._openGenericService(serviceData);
          break;
        default:
          console.warn(`${MODULE_ID} | Unknown service type: ${serviceData.type}`);
      }
    } catch (error) {
      console.error(`${MODULE_ID} | Error opening service:`, error);
      ui.notifications.error(localize("Errors.ServiceFailed"));
    }

    // After opening the service, decide what to do with the dialogue
    // For now, close the dialogue - the service window takes over
    // In the future, we could keep it open and return to it after service closes
    await this.close();
  }

  /**
   * Open shop service from service node
   * @param {object} serviceData - Service data
   * @private
   */
  async _openShopService(serviceData) {
    console.log(`${MODULE_ID} | Opening shop for NPC: ${serviceData.npcActorUuid}`);

    // Get the NPC's shop ID from their configuration
    const npc = await fromUuid(serviceData.npcActorUuid);
    const npcConfig = npc?.getFlag(MODULE_ID, "config");
    const shopId = npcConfig?.services?.merchant?.shopId;

    if (shopId) {
      // Open shop by shop ID
      game.bobsnpc?.ui?.openShop(shopId, this.playerActorUuid);
    } else {
      // Fallback: try to open shop by NPC UUID
      game.bobsnpc?.ui?.openShop(serviceData.npcActorUuid, this.playerActorUuid);
    }
  }

  /**
   * Open bank service from service node
   * @param {object} serviceData - Service data
   * @private
   */
  async _openBankService(serviceData) {
    console.log(`${MODULE_ID} | Opening bank for NPC: ${serviceData.npcActorUuid}`);
    game.bobsnpc?.ui?.openBank?.(serviceData.npcActorUuid, this.playerActorUuid);
  }

  /**
   * Open hire service from service node
   * @param {object} serviceData - Service data
   * @private
   */
  async _openHireService(serviceData) {
    console.log(`${MODULE_ID} | Opening hirelings for NPC: ${serviceData.npcActorUuid}`);
    game.bobsnpc?.ui?.openHirelings?.(serviceData.npcActorUuid, this.playerActorUuid);
  }

  /**
   * Open stable service from service node
   * @param {object} serviceData - Service data
   * @private
   */
  async _openStableService(serviceData) {
    console.log(`${MODULE_ID} | Opening stable for NPC: ${serviceData.npcActorUuid}`);
    game.bobsnpc?.ui?.openStable?.(serviceData.npcActorUuid, this.playerActorUuid);
  }

  /**
   * Open generic service from service node
   * @param {object} serviceData - Service data
   * @private
   */
  async _openGenericService(serviceData) {
    console.log(`${MODULE_ID} | Opening service ${serviceData.serviceType} for NPC: ${serviceData.npcActorUuid}`);
    // Generic services would be handled by a service window
    // For now, just log - specific services can be added as needed
  }

  // ==================== Helpers ====================

  /**
   * Get NPC portrait
   * @param {object} config - NPC config
   * @returns {string} Portrait path
   * @private
   */
  _getPortrait(config) {
    const defaultPortrait = "icons/svg/mystery-man.svg";

    // Handle case where actor isn't loaded yet
    if (!this._npcActor) {
      return defaultPortrait;
    }

    if (config?.portrait?.source === "custom" && config.portrait.customPath) {
      return config.portrait.customPath;
    }
    if (config?.portrait?.source === "token") {
      return this._npcActor.prototypeToken?.texture?.src || this._npcActor.img || defaultPortrait;
    }
    return this._npcActor.img || defaultPortrait;
  }

  /**
   * Get service icon
   * @param {string} serviceType - Service type
   * @returns {string} Icon class
   * @private
   */
  _getServiceIcon(serviceType) {
    const icons = {
      merchant: "fa-shopping-cart",
      bank: "fa-landmark",
      stable: "fa-horse",
      inn: "fa-bed",
      training: "fa-graduation-cap",
      hirelings: "fa-users",
      quests: "fa-scroll",
      faction: "fa-flag",
      fence: "fa-mask"
    };
    return icons[serviceType] || "fa-cog";
  }

  /**
   * Get mood/emotion icon
   * @param {string} mood - Mood/emotion type
   * @returns {string} Icon class
   * @private
   */
  _getMoodIcon(mood) {
    const icons = {
      neutral: "fa-meh",
      happy: "fa-smile",
      sad: "fa-frown",
      angry: "fa-angry",
      surprised: "fa-surprise",
      fearful: "fa-grimace",
      disgusted: "fa-dizzy",
      friendly: "fa-smile-beam",
      hostile: "fa-face-angry-horns",
      suspicious: "fa-face-raised-eyebrow",
      nervous: "fa-face-anxious-sweat"
    };
    return icons[mood] || "fa-meh";
  }

  // ==================== Static Factory ====================

  /**
   * Open dialogue with an NPC
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {object} options - Additional options
   * @returns {DialogueWindow}
   */
  static async open(npcActorUuid, playerActorUuid, options = {}) {
    // Check NPC configuration
    const npcConfig = getNpcHandler().getConfig(npcActorUuid);
    if (!npcConfig?.enabled) {
      ui.notifications.warn(localize("Errors.NPCNotConfigured"));
      return null;
    }

    // Start interaction
    const interaction = await getNpcHandler().startInteraction(npcActorUuid, playerActorUuid);
    if (!interaction.available) {
      if (interaction.unavailable) {
        ui.notifications.info(interaction.message || localize("NPC.Unavailable"));
      } else if (interaction.wrongLocation) {
        ui.notifications.info(interaction.message || localize("NPC.WrongLocation"));
      } else {
        ui.notifications.error(interaction.error);
      }
      return null;
    }

    // Create and render window
    const window = new DialogueWindow({
      npcActorUuid,
      playerActorUuid,
      dialogueId: interaction.dialogueId || options.dialogueId,
      sessionId: options.sessionId
    });

    await window.render(true);
    return window;
  }
}
