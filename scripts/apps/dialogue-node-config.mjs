/**
 * Bob's Talking NPCs - Dialogue Node Configuration Dialog
 * Detailed editor for individual dialogue nodes
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";
import {
  NodeType,
  ConditionType,
  EffectType,
  createCondition,
  createEffect,
  createResponse,
  createSkillCheck,
  Skills,
  getSkillName
} from "../data/dialogue-model.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dialogue Node Configuration Dialog
 * Allows detailed editing of a single dialogue node
 */
export class DialogueNodeConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} node - The node to edit
   * @param {object} dialogue - The parent dialogue (for context)
   * @param {object} options - Application options
   */
  constructor(node, dialogue, options = {}) {
    super(options);

    this._node = foundry.utils.deepClone(node);
    this._dialogue = dialogue;
    this._callback = options.callback || (() => {});
    this._activeTab = "content";
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-dialogue-node-config",
    classes: ["bobsnpc", "dialogue-node-config"],
    tag: "form",
    form: {
      handler: DialogueNodeConfig.#onFormSubmit,
      closeOnSubmit: false,
      submitOnChange: true
    },
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.DialogueEditor.NodeConfig",
      icon: "fa-solid fa-cog",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 600,
      height: 700
    },
    actions: {
      changeTab: DialogueNodeConfig.#onChangeTab,
      addResponse: DialogueNodeConfig.#onAddResponse,
      removeResponse: DialogueNodeConfig.#onRemoveResponse,
      moveResponseUp: DialogueNodeConfig.#onMoveResponseUp,
      moveResponseDown: DialogueNodeConfig.#onMoveResponseDown,
      addCondition: DialogueNodeConfig.#onAddCondition,
      removeCondition: DialogueNodeConfig.#onRemoveCondition,
      addEffect: DialogueNodeConfig.#onAddEffect,
      removeEffect: DialogueNodeConfig.#onRemoveEffect,
      addBranch: DialogueNodeConfig.#onAddBranch,
      removeBranch: DialogueNodeConfig.#onRemoveBranch,
      save: DialogueNodeConfig.#onSave,
      cancel: DialogueNodeConfig.#onCancel
    }
  };

  /** @override */
  static PARTS = {
    tabs: {
      template: `modules/${MODULE_ID}/templates/dialogue-node-config/tabs.hbs`
    },
    content: {
      template: `modules/${MODULE_ID}/templates/dialogue-node-config/content.hbs`,
      scrollable: [".tab-content"]
    },
    responses: {
      template: `modules/${MODULE_ID}/templates/dialogue-node-config/responses.hbs`,
      scrollable: [".tab-content"]
    },
    conditions: {
      template: `modules/${MODULE_ID}/templates/dialogue-node-config/conditions.hbs`,
      scrollable: [".tab-content"]
    },
    effects: {
      template: `modules/${MODULE_ID}/templates/dialogue-node-config/effects.hbs`,
      scrollable: [".tab-content"]
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/dialogue-node-config/footer.hbs`
    }
  };

  /** @override */
  get title() {
    const typeLabel = this._getNodeTypeLabel(this._node.type);
    return `${localize("DialogueEditor.NodeConfig")}: ${typeLabel}`;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Prepare skill options for skill checks
    const skillOptions = Object.entries(Skills).map(([key, value]) => ({
      value,
      label: getSkillName(value),
      selected: this._node.skillCheck?.skill === value
    }));

    // Prepare condition type options
    const conditionTypes = Object.entries(ConditionType).map(([key, value]) => ({
      value,
      label: localize(`DialogueEditor.ConditionType.${key}`)
    }));

    // Prepare effect type options
    const effectTypes = Object.entries(EffectType).map(([key, value]) => ({
      value,
      label: localize(`DialogueEditor.EffectType.${key}`)
    }));

    // Prepare node type options
    const nodeTypes = Object.entries(NodeType).map(([key, value]) => ({
      value,
      label: localize(`DialogueEditor.NodeType.${key}`),
      selected: this._node.type === value
    }));

    // Get other nodes for connection dropdowns
    const otherNodes = Object.values(this._dialogue.nodes)
      .filter(n => n.id !== this._node.id)
      .map(n => ({
        id: n.id,
        label: n.label || this._getNodeTypeLabel(n.type)
      }));

    return {
      ...context,
      node: this._node,
      nodeType: this._node.type,
      activeTab: this._activeTab,

      // Tab definitions
      tabs: this._prepareTabs(),

      // Options
      skillOptions,
      conditionTypes,
      effectTypes,
      nodeTypes,
      otherNodes,

      // Type-specific flags
      hasResponses: [NodeType.NPC_SPEECH, NodeType.PLAYER_CHOICE].includes(this._node.type),
      hasSkillCheck: this._node.type === NodeType.SKILL_CHECK,
      hasQuestId: [NodeType.QUEST_OFFER, NodeType.QUEST_TURNIN].includes(this._node.type),
      hasBranches: this._node.type === NodeType.BRANCH,
      hasShopType: this._node.type === NodeType.SHOP,
      hasEndType: this._node.type === NodeType.END,
      hasNextNode: ![NodeType.END, NodeType.BRANCH, NodeType.SKILL_CHECK, NodeType.QUEST_OFFER, NodeType.QUEST_TURNIN].includes(this._node.type),

      // Processed data
      responsesDisplay: this._prepareResponsesDisplay(),
      conditionsDisplay: this._prepareConditionsDisplay(this._node.conditions),
      effectsDisplay: this._prepareEffectsDisplay(this._node.effects),
      branchesDisplay: this._prepareBranchesDisplay(),

      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /**
   * Prepare tab definitions
   * @private
   */
  _prepareTabs() {
    const tabs = [
      { id: "content", label: localize("DialogueEditor.TabContent"), icon: "fa-file-alt" }
    ];

    // Add responses tab for applicable node types
    if ([NodeType.NPC_SPEECH, NodeType.PLAYER_CHOICE].includes(this._node.type)) {
      tabs.push({ id: "responses", label: localize("DialogueEditor.TabResponses"), icon: "fa-comments" });
    }

    // Branches tab for branch nodes
    if (this._node.type === NodeType.BRANCH) {
      tabs.push({ id: "branches", label: localize("DialogueEditor.TabBranches"), icon: "fa-code-branch" });
    }

    // Always show conditions and effects
    tabs.push(
      { id: "conditions", label: localize("DialogueEditor.TabConditions"), icon: "fa-filter" },
      { id: "effects", label: localize("DialogueEditor.TabEffects"), icon: "fa-bolt" }
    );

    return tabs.map(tab => ({
      ...tab,
      active: tab.id === this._activeTab,
      cssClass: tab.id === this._activeTab ? "active" : ""
    }));
  }

  /**
   * Prepare responses for display
   * @private
   */
  _prepareResponsesDisplay() {
    return (this._node.responses || []).map((response, index) => ({
      ...response,
      index,
      conditionsCount: response.conditions?.length || 0,
      effectsCount: response.effects?.length || 0,
      hasSkillCheck: !!response.skillCheck
    }));
  }

  /**
   * Prepare conditions for display
   * @private
   */
  _prepareConditionsDisplay(conditions) {
    return (conditions || []).map((condition, index) => ({
      ...condition,
      index,
      typeLabel: localize(`DialogueEditor.ConditionType.${Object.keys(ConditionType).find(k => ConditionType[k] === condition.type)}`)
    }));
  }

  /**
   * Prepare effects for display
   * @private
   */
  _prepareEffectsDisplay(effects) {
    return (effects || []).map((effect, index) => ({
      ...effect,
      index,
      typeLabel: localize(`DialogueEditor.EffectType.${Object.keys(EffectType).find(k => EffectType[k] === effect.type)}`)
    }));
  }

  /**
   * Prepare branches for display
   * @private
   */
  _prepareBranchesDisplay() {
    return (this._node.branches || []).map((branch, index) => ({
      ...branch,
      index,
      conditionsCount: branch.conditions?.length || 0,
      targetLabel: branch.nextNodeId
        ? (this._dialogue.nodes[branch.nextNodeId]?.label || branch.nextNodeId)
        : localize("DialogueEditor.NotConnected")
    }));
  }

  /**
   * Get node type label
   * @private
   */
  _getNodeTypeLabel(type) {
    const key = Object.entries(NodeType).find(([k, v]) => v === type)?.[0];
    return localize(`DialogueEditor.NodeType.${key}`) || type;
  }

  // ==================== Form Handling ====================

  static async #onFormSubmit(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);

    // Update node with form data
    if (data.node) {
      foundry.utils.mergeObject(this._node, data.node);
    }
  }

  // ==================== Actions ====================

  static #onChangeTab(event, target) {
    this._activeTab = target.dataset.tab;
    this.render();
  }

  static #onAddResponse(event, target) {
    if (!this._node.responses) {
      this._node.responses = [];
    }

    this._node.responses.push(createResponse({
      text: localize("DialogueEditor.NewResponse"),
      order: this._node.responses.length
    }));

    this.render({ parts: ["responses"] });
  }

  static #onRemoveResponse(event, target) {
    const index = parseInt(target.dataset.index);
    this._node.responses.splice(index, 1);
    this.render({ parts: ["responses"] });
  }

  static #onMoveResponseUp(event, target) {
    const index = parseInt(target.dataset.index);
    if (index <= 0) return;

    const responses = this._node.responses;
    [responses[index - 1], responses[index]] = [responses[index], responses[index - 1]];
    this.render({ parts: ["responses"] });
  }

  static #onMoveResponseDown(event, target) {
    const index = parseInt(target.dataset.index);
    if (index >= this._node.responses.length - 1) return;

    const responses = this._node.responses;
    [responses[index], responses[index + 1]] = [responses[index + 1], responses[index]];
    this.render({ parts: ["responses"] });
  }

  static #onAddCondition(event, target) {
    const targetType = target.dataset.target || "node";

    if (targetType === "node") {
      if (!this._node.conditions) {
        this._node.conditions = [];
      }
      this._node.conditions.push(createCondition({ type: ConditionType.FLAG }));
    } else if (targetType === "response") {
      const responseIndex = parseInt(target.dataset.responseIndex);
      const response = this._node.responses[responseIndex];
      if (!response.conditions) {
        response.conditions = [];
      }
      response.conditions.push(createCondition({ type: ConditionType.FLAG }));
    }

    this.render({ parts: ["conditions", "responses"] });
  }

  static #onRemoveCondition(event, target) {
    const targetType = target.dataset.target || "node";
    const index = parseInt(target.dataset.index);

    if (targetType === "node") {
      this._node.conditions.splice(index, 1);
    } else if (targetType === "response") {
      const responseIndex = parseInt(target.dataset.responseIndex);
      this._node.responses[responseIndex].conditions.splice(index, 1);
    }

    this.render({ parts: ["conditions", "responses"] });
  }

  static #onAddEffect(event, target) {
    const targetType = target.dataset.target || "node";

    if (targetType === "node") {
      if (!this._node.effects) {
        this._node.effects = [];
      }
      this._node.effects.push(createEffect({ type: EffectType.SET_FLAG }));
    } else if (targetType === "response") {
      const responseIndex = parseInt(target.dataset.responseIndex);
      const response = this._node.responses[responseIndex];
      if (!response.effects) {
        response.effects = [];
      }
      response.effects.push(createEffect({ type: EffectType.SET_FLAG }));
    }

    this.render({ parts: ["effects", "responses"] });
  }

  static #onRemoveEffect(event, target) {
    const targetType = target.dataset.target || "node";
    const index = parseInt(target.dataset.index);

    if (targetType === "node") {
      this._node.effects.splice(index, 1);
    } else if (targetType === "response") {
      const responseIndex = parseInt(target.dataset.responseIndex);
      this._node.responses[responseIndex].effects.splice(index, 1);
    }

    this.render({ parts: ["effects", "responses"] });
  }

  static #onAddBranch(event, target) {
    if (!this._node.branches) {
      this._node.branches = [];
    }

    this._node.branches.push({
      id: foundry.utils.randomID(),
      conditions: [],
      nextNodeId: null,
      priority: this._node.branches.length
    });

    this.render();
  }

  static #onRemoveBranch(event, target) {
    const index = parseInt(target.dataset.index);
    this._node.branches.splice(index, 1);
    this.render();
  }

  static async #onSave(event, target) {
    // Call the callback with updated node
    this._callback(this._node);
    this.close();
  }

  static #onCancel(event, target) {
    this.close();
  }
}
