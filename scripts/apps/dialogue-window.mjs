/**
 * Bob's Talking NPCs - Dialogue Window
 * Main NPC conversation interface using Foundry V13 ApplicationV2
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";
import { dialogueHandler } from "../handlers/dialogue-handler.mjs";
import { npcHandler } from "../handlers/npc-handler.mjs";

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

    // Load actors
    this._npcActor = await fromUuid(this.npcActorUuid);
    this._playerActor = await fromUuid(this.playerActorUuid);

    if (!this._npcActor) {
      throw new Error(localize("Errors.ActorNotFound"));
    }

    // Start or resume dialogue session
    if (this.sessionId) {
      this._session = dialogueHandler.getSession(this.sessionId);
    }

    if (!this._session) {
      const result = await dialogueHandler.startDialogue(
        this.dialogueId,
        this.npcActorUuid,
        this.playerActorUuid
      );
      this._session = result.session;
      this.sessionId = result.sessionId;
      this._currentNode = result.currentNode;
    } else {
      this._currentNode = this._session.currentNode;
    }

    // Register for socket updates
    this._registerSocketListener();
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const npcConfig = npcHandler.getConfig(this.npcActorUuid);
    const portrait = this._getPortrait(npcConfig);
    const theme = game.settings.get(MODULE_ID, "theme") || "dark";

    // Get available responses
    const responses = this._currentNode?.responses || [];
    const availableResponses = await this._filterAvailableResponses(responses);

    // Get available services if at a service node
    const services = this._currentNode?.services || [];

    return {
      ...context,
      npc: {
        name: this._npcActor.name,
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
        text: this._displayedText || this._currentNode?.text || "",
        fullText: this._currentNode?.text || "",
        speaker: this._currentNode?.speaker || "npc",
        emotion: this._currentNode?.emotion || "neutral",
        isTyping: this._isTyping
      },
      responses: availableResponses.map((r, i) => ({
        ...r,
        index: i,
        shortcut: i < 9 ? i + 1 : null,
        requiresRoll: !!r.skillCheck,
        skillName: r.skillCheck?.skill ? localize(`Skills.${r.skillCheck.skill}`) : null,
        dc: r.skillCheck?.dc
      })),
      services: services.map(s => ({
        ...s,
        icon: this._getServiceIcon(s.type),
        label: localize(`Services.${s.type}`)
      })),
      settings: {
        typewriterEnabled: game.settings.get(MODULE_ID, "typewriterSpeed") > 0,
        typewriterSpeed: game.settings.get(MODULE_ID, "typewriterSpeed"),
        soundEnabled: game.settings.get(MODULE_ID, "soundEnabled"),
        theme
      },
      isGM: game.user.isGM,
      isMultiplayer: this._session?.participants?.length > 1,
      participants: this._session?.participants || []
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
      await dialogueHandler.endDialogue(this.sessionId);
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
   * @param {object[]} responses - All responses
   * @returns {object[]} Available responses
   * @private
   */
  async _filterAvailableResponses(responses) {
    const available = [];

    for (const response of responses) {
      if (response.conditions?.length > 0) {
        const conditionsMet = await dialogueHandler.evaluateConditions(
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
      const result = await dialogueHandler.selectResponse(
        this.sessionId,
        responseId,
        rollResult
      );

      if (result.ended) {
        // Dialogue ended
        await this.close();
        return;
      }

      // Update current node
      this._currentNode = result.node;
      this._displayedText = "";

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
      const response = this._currentNode?.responses?.find(r => r.id === responseId);
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
    const result = await npcHandler.accessService(
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

  // ==================== Helpers ====================

  /**
   * Get NPC portrait
   * @param {object} config - NPC config
   * @returns {string} Portrait path
   * @private
   */
  _getPortrait(config) {
    if (config?.portrait?.source === "custom" && config.portrait.customPath) {
      return config.portrait.customPath;
    }
    if (config?.portrait?.source === "token") {
      return this._npcActor.prototypeToken?.texture?.src || this._npcActor.img;
    }
    return this._npcActor.img;
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
    const npcConfig = npcHandler.getConfig(npcActorUuid);
    if (!npcConfig?.enabled) {
      ui.notifications.warn(localize("Errors.NPCNotConfigured"));
      return null;
    }

    // Start interaction
    const interaction = await npcHandler.startInteraction(npcActorUuid, playerActorUuid);
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
