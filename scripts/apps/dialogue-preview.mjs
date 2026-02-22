/**
 * Bob's Talking NPCs - Dialogue Preview
 * Test dialogue trees without needing an actual NPC
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";
import { NodeType } from "../data/dialogue-model.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dialogue Preview Application
 * Simulates dialogue execution for testing
 */
export class DialoguePreview extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} dialogue - Dialogue tree to preview
   * @param {object} options - Application options
   */
  constructor(dialogue, options = {}) {
    super(options);

    this._dialogue = foundry.utils.deepClone(dialogue);
    this._currentNodeId = dialogue.startNodeId || Object.keys(dialogue.nodes)[0];
    this._history = []; // Track visited nodes
    this._mockVariables = {}; // Mock session variables
    this._typewriterInterval = null;
    this._displayedText = "";
    this._fullText = "";
    this._isTyping = false;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-dialogue-preview",
    classes: ["bobsnpc", "dialogue-preview", "dialogue-window"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.DialoguePreview.Title",
      icon: "fa-solid fa-play-circle",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 650,
      height: 550
    },
    actions: {
      selectResponse: DialoguePreview.#onSelectResponse,
      skipTypewriter: DialoguePreview.#onSkipTypewriter,
      goBack: DialoguePreview.#onGoBack,
      restart: DialoguePreview.#onRestart,
      close: DialoguePreview.#onClose
    }
  };

  /** @override */
  static PARTS = {
    header: {
      template: `modules/${MODULE_ID}/templates/dialogue-preview/header.hbs`
    },
    content: {
      template: `modules/${MODULE_ID}/templates/dialogue-preview/content.hbs`,
      scrollable: [".dialogue-text-container"]
    },
    responses: {
      template: `modules/${MODULE_ID}/templates/dialogue-preview/responses.hbs`
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/dialogue-preview/footer.hbs`
    }
  };

  /** @override */
  get title() {
    return `${localize("DialoguePreview.Title")}: ${this._dialogue.name}`;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const currentNode = this._dialogue.nodes[this._currentNodeId];
    if (!currentNode) {
      return {
        ...context,
        error: true,
        errorMessage: "No start node found. Set a start node in the dialogue editor.",
        theme: game.settings.get(MODULE_ID, "theme") || "dark"
      };
    }

    // Prepare node display
    const nodeDisplay = this._prepareNodeDisplay(currentNode);

    // Prepare responses
    const responses = this._prepareResponses(currentNode);

    // Get speaker name
    const speakerName = currentNode.speaker === "custom" && currentNode.customSpeaker
      ? currentNode.customSpeaker
      : "NPC";

    return {
      ...context,
      dialogue: this._dialogue,
      currentNode,
      nodeDisplay,
      nodeType: currentNode.type,
      nodeTypeLabel: this._getNodeTypeLabel(currentNode.type),
      speakerName,
      speakerPortrait: this._getMockPortrait(),
      displayedText: this._displayedText || nodeDisplay.text,
      isTyping: this._isTyping,
      responses,
      hasResponses: responses.length > 0,
      canGoBack: this._history.length > 0,
      isPreview: true,
      previewMode: true,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Start typewriter effect for text nodes
    if (!this._isTyping && context.currentNode?.text) {
      this._startTypewriter(context.currentNode.text);
    }
  }

  /**
   * Prepare node display information
   * @private
   */
  _prepareNodeDisplay(node) {
    const display = {
      text: node.text || "",
      icon: this._getNodeTypeIcon(node.type),
      color: this._getNodeTypeColor(node.type)
    };

    // Add special information based on node type
    switch (node.type) {
      case NodeType.SHOP:
        const businessType = node.businessType ? this._getBusinessTypeName(node.businessType) : "Generic";
        const shopId = node.shopId ? ` (${node.shopId})` : "";
        display.specialInfo = `Opens shop: ${businessType}${shopId}`;
        break;

      case NodeType.QUEST_OFFER:
        display.specialInfo = `Offers quest: ${node.questId || "Unknown"}`;
        break;

      case NodeType.QUEST_TURNIN:
        display.specialInfo = `Turn in quest: ${node.questId || "Unknown"}`;
        break;

      case NodeType.SKILL_CHECK:
        const skill = node.skillCheck?.skill || "Unknown";
        const dc = node.skillCheck?.dc || 0;
        display.specialInfo = `${skill} check (DC ${dc})`;
        break;

      case NodeType.BANK:
        display.specialInfo = "Opens bank interface";
        break;

      case NodeType.SERVICE:
        display.specialInfo = `Service: ${node.serviceType || "Unknown"}`;
        break;

      case NodeType.END:
        display.specialInfo = "Dialogue ends";
        break;
    }

    return display;
  }

  /**
   * Prepare response options for display
   * @private
   */
  _prepareResponses(node) {
    const responses = [];

    switch (node.type) {
      case NodeType.NPC_SPEECH:
        // Continue button
        if (node.nextNodeId) {
          responses.push({
            id: "continue",
            text: "[Continue]",
            nextNodeId: node.nextNodeId,
            available: true
          });
        }
        break;

      case NodeType.PLAYER_CHOICE:
        // Player response options
        (node.responses || []).forEach((response, index) => {
          // Check conditions (simplified for preview)
          const available = this._checkConditions(response.conditions || []);
          responses.push({
            id: response.id,
            index,
            text: response.text || `Response ${index + 1}`,
            nextNodeId: response.nextNodeId,
            available,
            unavailableReason: available ? null : "Conditions not met (preview)",
            hasSkillCheck: !!response.skillCheck
          });
        });
        break;

      case NodeType.SKILL_CHECK:
        // Success/Failure buttons
        responses.push({
          id: "success",
          text: "[Pass Check] (Preview)",
          nextNodeId: node.skillCheck?.successNodeId,
          available: true,
          success: true
        });
        responses.push({
          id: "failure",
          text: "[Fail Check] (Preview)",
          nextNodeId: node.skillCheck?.failureNodeId,
          available: true,
          failure: true
        });
        break;

      case NodeType.QUEST_OFFER:
        responses.push({
          id: "accept",
          text: "[Accept Quest] (Preview)",
          nextNodeId: node.acceptNodeId,
          available: true
        });
        responses.push({
          id: "decline",
          text: "[Decline Quest] (Preview)",
          nextNodeId: node.declineNodeId,
          available: true
        });
        break;

      case NodeType.QUEST_TURNIN:
        responses.push({
          id: "complete",
          text: "[Complete Quest] (Preview)",
          nextNodeId: node.successNodeId,
          available: true
        });
        responses.push({
          id: "incomplete",
          text: "[Quest Not Done] (Preview)",
          nextNodeId: node.incompleteNodeId,
          available: true
        });
        break;

      case NodeType.SHOP:
      case NodeType.BANK:
      case NodeType.SERVICE:
        // Continue after service node
        if (node.nextNodeId) {
          responses.push({
            id: "continue",
            text: "[Close Shop/Service] (Preview)",
            nextNodeId: node.nextNodeId,
            available: true
          });
        }
        break;

      case NodeType.BRANCH:
        // Show each branch option
        (node.branches || []).forEach((branch, index) => {
          responses.push({
            id: `branch_${index}`,
            text: `[Branch ${index + 1}] ${branch.label || "Unlabeled"}`,
            nextNodeId: branch.nextNodeId,
            available: this._checkConditions(branch.conditions || [])
          });
        });
        break;

      case NodeType.END:
        // No responses for end nodes
        break;
    }

    return responses;
  }

  /**
   * Check conditions (simplified for preview)
   * @private
   */
  _checkConditions(conditions) {
    if (!conditions || conditions.length === 0) return true;

    // In preview mode, randomly pass ~80% of conditions for testing
    return Math.random() > 0.2;
  }

  /**
   * Start typewriter effect
   * @private
   */
  _startTypewriter(text) {
    this._fullText = text;
    this._displayedText = "";
    this._isTyping = true;

    let charIndex = 0;
    const speed = 30; // ms per character

    this._typewriterInterval = setInterval(() => {
      if (charIndex < this._fullText.length) {
        this._displayedText += this._fullText[charIndex];
        charIndex++;
        this.render({ parts: ["content"] });
      } else {
        this._stopTypewriter();
      }
    }, speed);
  }

  /**
   * Stop typewriter effect
   * @private
   */
  _stopTypewriter() {
    if (this._typewriterInterval) {
      clearInterval(this._typewriterInterval);
      this._typewriterInterval = null;
    }
    this._isTyping = false;
    this._displayedText = this._fullText;
    this.render({ parts: ["content", "responses"] });
  }

  /**
   * Get node type label
   * @private
   */
  _getNodeTypeLabel(type) {
    const labels = {
      [NodeType.NPC_SPEECH]: "NPC Speech",
      [NodeType.PLAYER_CHOICE]: "Player Choice",
      [NodeType.SKILL_CHECK]: "Skill Check",
      [NodeType.SHOP]: "Shop",
      [NodeType.QUEST_OFFER]: "Quest Offer",
      [NodeType.QUEST_TURNIN]: "Quest Turn-In",
      [NodeType.REWARD]: "Reward",
      [NodeType.SERVICE]: "Service",
      [NodeType.BANK]: "Bank",
      [NodeType.HIRE]: "Hire",
      [NodeType.STABLE]: "Stable",
      [NodeType.BRANCH]: "Branch",
      [NodeType.END]: "End"
    };
    return labels[type] || type;
  }

  /**
   * Get node type icon
   * @private
   */
  _getNodeTypeIcon(type) {
    const icons = {
      [NodeType.NPC_SPEECH]: "fa-comment",
      [NodeType.PLAYER_CHOICE]: "fa-comments",
      [NodeType.SKILL_CHECK]: "fa-dice-d20",
      [NodeType.SHOP]: "fa-store",
      [NodeType.QUEST_OFFER]: "fa-scroll",
      [NodeType.QUEST_TURNIN]: "fa-check-circle",
      [NodeType.REWARD]: "fa-gift",
      [NodeType.SERVICE]: "fa-concierge-bell",
      [NodeType.BANK]: "fa-landmark",
      [NodeType.HIRE]: "fa-user-plus",
      [NodeType.STABLE]: "fa-horse",
      [NodeType.BRANCH]: "fa-code-branch",
      [NodeType.END]: "fa-stop-circle"
    };
    return icons[type] || "fa-circle";
  }

  /**
   * Get node type color
   * @private
   */
  _getNodeTypeColor(type) {
    const colors = {
      [NodeType.NPC_SPEECH]: "#3498db",
      [NodeType.PLAYER_CHOICE]: "#9b59b6",
      [NodeType.SKILL_CHECK]: "#e67e22",
      [NodeType.SHOP]: "#2ecc71",
      [NodeType.QUEST_OFFER]: "#f1c40f",
      [NodeType.QUEST_TURNIN]: "#f39c12",
      [NodeType.REWARD]: "#e74c3c",
      [NodeType.SERVICE]: "#16a085",
      [NodeType.BANK]: "#27ae60",
      [NodeType.HIRE]: "#8e44ad",
      [NodeType.STABLE]: "#d35400",
      [NodeType.BRANCH]: "#95a5a6",
      [NodeType.END]: "#c0392b"
    };
    return colors[type] || "#95a5a6";
  }

  /**
   * Get business type name
   * @private
   */
  _getBusinessTypeName(businessType) {
    // Try to get from localization
    try {
      return localize(`BusinessTypes.${businessType}.Label`) || businessType;
    } catch {
      return businessType;
    }
  }

  /**
   * Get mock portrait
   * @private
   */
  _getMockPortrait() {
    return "icons/svg/mystery-man.svg";
  }

  // ==================== Event Handlers ====================

  static #onSelectResponse(event, target) {
    const responseId = target.dataset.responseId;
    const nextNodeId = target.dataset.nextNodeId;

    if (!nextNodeId) {
      ui.notifications.warn("This response has no next node configured.");
      return;
    }

    // Stop typewriter
    this._stopTypewriter();

    // Save current node to history
    this._history.push(this._currentNodeId);

    // Move to next node
    this._currentNodeId = nextNodeId;

    // Render
    this.render();
  }

  static #onSkipTypewriter(event, target) {
    this._stopTypewriter();
  }

  static #onGoBack(event, target) {
    if (this._history.length === 0) return;

    this._stopTypewriter();
    this._currentNodeId = this._history.pop();
    this.render();
  }

  static #onRestart(event, target) {
    this._stopTypewriter();
    this._currentNodeId = this._dialogue.startNodeId || Object.keys(this._dialogue.nodes)[0];
    this._history = [];
    this._mockVariables = {};
    this.render();
  }

  static #onClose(event, target) {
    this.close();
  }

  /** @override */
  async close(options = {}) {
    this._stopTypewriter();
    return super.close(options);
  }

  // ==================== Static Factory ====================

  /**
   * Open dialogue preview
   * @param {object} dialogue - Dialogue tree to preview
   * @param {object} options - Additional options
   */
  static async open(dialogue, options = {}) {
    if (!dialogue) {
      ui.notifications.error("No dialogue provided for preview.");
      return null;
    }

    if (!dialogue.startNodeId && !Object.keys(dialogue.nodes || {}).length) {
      ui.notifications.error("Dialogue has no nodes to preview.");
      return null;
    }

    const preview = new DialoguePreview(dialogue, options);
    await preview.render(true);
    return preview;
  }
}
