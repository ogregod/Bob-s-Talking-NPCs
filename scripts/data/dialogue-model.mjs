/**
 * Bob's Talking NPCs - Dialogue Data Model
 * Defines the structure and validation for dialogue trees
 */

import { MODULE_ID } from "../module.mjs";
import { generateId } from "../utils/helpers.mjs";

/**
 * Dialogue node types enum
 */
export const NodeType = Object.freeze({
  NPC_SPEECH: "npc_speech",
  PLAYER_CHOICE: "player_choice",
  SKILL_CHECK: "skill_check",
  SHOP: "shop",
  QUEST_OFFER: "quest_offer",
  QUEST_TURNIN: "quest_turnin",
  REWARD: "reward",
  SERVICE: "service",
  BANK: "bank",
  HIRE: "hire",
  STABLE: "stable",
  BRANCH: "branch",
  END: "end"
});

/**
 * Condition types enum
 */
export const ConditionType = Object.freeze({
  QUEST_STATUS: "quest_status",
  QUEST_OBJECTIVE: "quest_objective",
  FACTION_RANK: "faction_rank",
  FACTION_REPUTATION: "faction_reputation",
  RELATIONSHIP: "relationship",
  PLAYER_LEVEL: "player_level",
  PLAYER_CLASS: "player_class",
  PLAYER_RACE: "player_race",
  HAS_ITEM: "has_item",
  HAS_GOLD: "has_gold",
  FLAG: "flag",
  TIME: "time",
  PREVIOUS_CHOICE: "previous_choice",
  RANDOM: "random"
});

/**
 * Effect types enum
 */
export const EffectType = Object.freeze({
  MODIFY_RELATIONSHIP: "modify_relationship",
  MODIFY_FACTION_REP: "modify_faction_reputation",
  SET_FLAG: "set_flag",
  GIVE_ITEM: "give_item",
  TAKE_ITEM: "take_item",
  GIVE_GOLD: "give_gold",
  TAKE_GOLD: "take_gold",
  GIVE_XP: "give_xp",
  START_QUEST: "start_quest",
  COMPLETE_QUEST: "complete_quest",
  FAIL_QUEST: "fail_quest",
  COMPLETE_OBJECTIVE: "complete_objective",
  ADD_BOUNTY: "add_bounty",
  CHAT_MESSAGE: "chat_message",
  UNLOCK_AREA: "unlock_area",
  PLAY_SOUND: "play_sound",
  PLAY_ANIMATION: "play_animation"
});

/**
 * Comparison operators enum
 */
export const Comparison = Object.freeze({
  EQUALS: "eq",
  NOT_EQUALS: "neq",
  GREATER_THAN: "gt",
  GREATER_THAN_OR_EQUAL: "gte",
  LESS_THAN: "lt",
  LESS_THAN_OR_EQUAL: "lte"
});

/**
 * Create a condition
 * @param {object} data - Condition data
 * @returns {object}
 */
export function createCondition(data = {}) {
  const base = {
    id: data.id || generateId(),
    type: data.type || ConditionType.FLAG,
    inverted: data.inverted || false  // Negate the condition
  };

  switch (data.type) {
    case ConditionType.QUEST_STATUS:
      return {
        ...base,
        questId: data.questId || "",
        status: data.status || "completed"
      };

    case ConditionType.QUEST_OBJECTIVE:
      return {
        ...base,
        questId: data.questId || "",
        objectiveId: data.objectiveId || "",
        completed: data.completed ?? true
      };

    case ConditionType.FACTION_RANK:
      return {
        ...base,
        factionId: data.factionId || "",
        rank: data.rank || "",
        comparison: data.comparison || Comparison.GREATER_THAN_OR_EQUAL
      };

    case ConditionType.FACTION_REPUTATION:
      return {
        ...base,
        factionId: data.factionId || "",
        value: data.value || 0,
        comparison: data.comparison || Comparison.GREATER_THAN_OR_EQUAL
      };

    case ConditionType.RELATIONSHIP:
      return {
        ...base,
        value: data.value || 0,
        comparison: data.comparison || Comparison.GREATER_THAN_OR_EQUAL
      };

    case ConditionType.PLAYER_LEVEL:
      return {
        ...base,
        value: data.value || 1,
        comparison: data.comparison || Comparison.GREATER_THAN_OR_EQUAL
      };

    case ConditionType.PLAYER_CLASS:
      return {
        ...base,
        classes: data.classes || []
      };

    case ConditionType.PLAYER_RACE:
      return {
        ...base,
        races: data.races || []
      };

    case ConditionType.HAS_ITEM:
      return {
        ...base,
        itemId: data.itemId || "",
        quantity: data.quantity || 1
      };

    case ConditionType.HAS_GOLD:
      return {
        ...base,
        amount: data.amount || 0
      };

    case ConditionType.FLAG:
      return {
        ...base,
        scope: data.scope || "world",  // world, actor, npc
        key: data.key || "",
        value: data.value ?? true
      };

    case ConditionType.TIME:
      return {
        ...base,
        from: data.from || 6,   // Hour (0-23)
        to: data.to || 18
      };

    case ConditionType.PREVIOUS_CHOICE:
      return {
        ...base,
        dialogueId: data.dialogueId || "",
        choiceId: data.choiceId || ""
      };

    case ConditionType.RANDOM:
      return {
        ...base,
        chance: data.chance || 0.5  // 0-1 probability
      };

    default:
      return base;
  }
}

/**
 * Create an effect
 * @param {object} data - Effect data
 * @returns {object}
 */
export function createEffect(data = {}) {
  const base = {
    id: data.id || generateId(),
    type: data.type || EffectType.SET_FLAG
  };

  switch (data.type) {
    case EffectType.MODIFY_RELATIONSHIP:
      return {
        ...base,
        amount: data.amount || 0  // Can be negative
      };

    case EffectType.MODIFY_FACTION_REP:
      return {
        ...base,
        factionId: data.factionId || "",
        amount: data.amount || 0
      };

    case EffectType.SET_FLAG:
      return {
        ...base,
        scope: data.scope || "world",
        key: data.key || "",
        value: data.value ?? true
      };

    case EffectType.GIVE_ITEM:
    case EffectType.TAKE_ITEM:
      return {
        ...base,
        itemId: data.itemId || "",
        quantity: data.quantity || 1
      };

    case EffectType.GIVE_GOLD:
    case EffectType.TAKE_GOLD:
      return {
        ...base,
        amount: data.amount || 0
      };

    case EffectType.GIVE_XP:
      return {
        ...base,
        amount: data.amount || 0
      };

    case EffectType.START_QUEST:
    case EffectType.COMPLETE_QUEST:
    case EffectType.FAIL_QUEST:
      return {
        ...base,
        questId: data.questId || ""
      };

    case EffectType.COMPLETE_OBJECTIVE:
      return {
        ...base,
        questId: data.questId || "",
        objectiveId: data.objectiveId || ""
      };

    case EffectType.ADD_BOUNTY:
      return {
        ...base,
        amount: data.amount || 0,
        region: data.region || ""
      };

    case EffectType.CHAT_MESSAGE:
      return {
        ...base,
        content: data.content || "",
        whisper: data.whisper ?? false,
        speaker: data.speaker || "npc"  // npc, narrator, system
      };

    case EffectType.UNLOCK_AREA:
      return {
        ...base,
        sceneId: data.sceneId || ""
      };

    case EffectType.PLAY_SOUND:
      return {
        ...base,
        path: data.path || "",
        volume: data.volume ?? 0.8
      };

    case EffectType.PLAY_ANIMATION:
      return {
        ...base,
        animationId: data.animationId || ""
      };

    default:
      return base;
  }
}

/**
 * Create a dialogue response (player choice)
 * @param {object} data - Response data
 * @returns {object}
 */
export function createResponse(data = {}) {
  return {
    id: data.id || generateId(),
    text: data.text || "",
    nextNodeId: data.nextNodeId || null,
    conditions: (data.conditions || []).map(c => createCondition(c)),
    effects: (data.effects || []).map(e => createEffect(e)),
    skillCheck: data.skillCheck || null,  // {skill, dc} for inline checks
    hidden: data.hidden || false,         // Hide if conditions not met (vs disabled)
    order: data.order ?? 0
  };
}

/**
 * Create a skill check configuration
 * @param {object} data - Skill check data
 * @returns {object}
 */
export function createSkillCheck(data = {}) {
  return {
    skill: data.skill || "persuasion",
    dc: data.dc || 15,
    successNodeId: data.successNodeId || null,
    failureNodeId: data.failureNodeId || null,
    critSuccessNodeId: data.critSuccessNodeId || null,
    critFailureNodeId: data.critFailureNodeId || null,
    canRetry: data.canRetry ?? false,
    retryDC: data.retryDC || null,  // DC for retry (null = same DC)
    maxRetries: data.maxRetries || 1
  };
}

/**
 * Create a dialogue node
 * @param {object} data - Node data
 * @returns {object}
 */
export function createNode(data = {}) {
  const base = {
    id: data.id || generateId(),
    type: data.type || NodeType.NPC_SPEECH,

    // Visual editor position
    position: data.position || { x: 0, y: 0 },

    // Conditions to reach this node
    conditions: (data.conditions || []).map(c => createCondition(c)),

    // Effects when reaching this node
    effects: (data.effects || []).map(e => createEffect(e)),

    // Node label for editor
    label: data.label || ""
  };

  switch (data.type) {
    case NodeType.NPC_SPEECH:
      return {
        ...base,
        text: data.text || "",
        speaker: data.speaker || "self",  // "self" or Actor UUID
        portrait: data.portrait || {
          type: "token",  // token, actor, custom
          customPath: null
        },
        voiceLine: data.voiceLine || {
          type: null,  // file, url, null
          path: null,
          url: null
        },
        responses: (data.responses || []).map(r => createResponse(r)),
        autoAdvance: data.autoAdvance || null,  // {delay, nextNodeId} for auto-continue
        typewriterOverride: data.typewriterOverride || null  // Override player setting
      };

    case NodeType.PLAYER_CHOICE:
      return {
        ...base,
        prompt: data.prompt || "",  // Optional prompt text
        responses: (data.responses || []).map(r => createResponse(r)),
        timeLimit: data.timeLimit || null  // Seconds to choose (null = no limit)
      };

    case NodeType.SKILL_CHECK:
      return {
        ...base,
        text: data.text || "",  // Text shown during check
        skillCheck: createSkillCheck(data.skillCheck || {})
      };

    case NodeType.SHOP:
      return {
        ...base,
        text: data.text || "",
        shopType: data.shopType || "merchant",  // merchant, fence, stable
        nextNodeId: data.nextNodeId || null  // After shop closes
      };

    case NodeType.QUEST_OFFER:
      return {
        ...base,
        text: data.text || "",
        questId: data.questId || "",
        acceptNodeId: data.acceptNodeId || null,
        declineNodeId: data.declineNodeId || null
      };

    case NodeType.QUEST_TURNIN:
      return {
        ...base,
        text: data.text || "",
        questId: data.questId || "",
        successNodeId: data.successNodeId || null,  // Quest complete
        incompleteNodeId: data.incompleteNodeId || null  // Objectives not done
      };

    case NodeType.REWARD:
      return {
        ...base,
        text: data.text || "",
        rewards: data.rewards || {
          gold: 0,
          xp: 0,
          items: [],
          reputation: [],
          relationship: 0
        },
        nextNodeId: data.nextNodeId || null
      };

    case NodeType.SERVICE:
      return {
        ...base,
        text: data.text || "",
        serviceType: data.serviceType || "repair",  // repair, training, enchanting, etc.
        nextNodeId: data.nextNodeId || null
      };

    case NodeType.BANK:
      return {
        ...base,
        text: data.text || "",
        nextNodeId: data.nextNodeId || null
      };

    case NodeType.HIRE:
      return {
        ...base,
        text: data.text || "",
        nextNodeId: data.nextNodeId || null
      };

    case NodeType.STABLE:
      return {
        ...base,
        text: data.text || "",
        nextNodeId: data.nextNodeId || null
      };

    case NodeType.BRANCH:
      return {
        ...base,
        // Branch evaluates conditions and goes to first matching
        branches: (data.branches || []).map(b => ({
          id: b.id || generateId(),
          conditions: (b.conditions || []).map(c => createCondition(c)),
          nextNodeId: b.nextNodeId || null,
          priority: b.priority ?? 0
        })),
        defaultNodeId: data.defaultNodeId || null  // If no branch matches
      };

    case NodeType.END:
      return {
        ...base,
        text: data.text || "",  // Optional closing text
        endType: data.endType || "normal"  // normal, hostile, trade, etc.
      };

    default:
      return base;
  }
}

/**
 * Create a new dialogue tree
 * @param {object} data - Dialogue data
 * @returns {object}
 */
export function createDialogue(data = {}) {
  return {
    id: data.id || generateId(),
    actorUuid: data.actorUuid || null,
    name: data.name || "New Dialogue",
    description: data.description || "",

    // Starting configuration
    startNodeId: data.startNodeId || null,
    alternativeStartNodeId: data.alternativeStartNodeId || null,
    expectedScenes: data.expectedScenes || [],  // Scene UUIDs where this NPC should be

    // Nodes map
    nodes: {},

    // Metadata
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),

    // Editor settings
    editorZoom: data.editorZoom || 1,
    editorPan: data.editorPan || { x: 0, y: 0 }
  };
}

/**
 * Add a node to a dialogue
 * @param {object} dialogue - Dialogue data
 * @param {object} nodeData - Node data
 * @returns {object} The created node
 */
export function addNode(dialogue, nodeData) {
  const node = createNode(nodeData);
  dialogue.nodes[node.id] = node;
  dialogue.updatedAt = Date.now();

  // Set as start node if first node
  if (Object.keys(dialogue.nodes).length === 1) {
    dialogue.startNodeId = node.id;
  }

  return node;
}

/**
 * Remove a node from a dialogue
 * @param {object} dialogue - Dialogue data
 * @param {string} nodeId - Node ID to remove
 */
export function removeNode(dialogue, nodeId) {
  delete dialogue.nodes[nodeId];

  // Clean up references to this node
  Object.values(dialogue.nodes).forEach(node => {
    // Clean up responses
    if (node.responses) {
      node.responses = node.responses.filter(r => r.nextNodeId !== nodeId);
    }

    // Clean up direct references
    if (node.nextNodeId === nodeId) node.nextNodeId = null;
    if (node.successNodeId === nodeId) node.successNodeId = null;
    if (node.failureNodeId === nodeId) node.failureNodeId = null;
    if (node.acceptNodeId === nodeId) node.acceptNodeId = null;
    if (node.declineNodeId === nodeId) node.declineNodeId = null;
    if (node.defaultNodeId === nodeId) node.defaultNodeId = null;

    // Clean up skill check references
    if (node.skillCheck) {
      if (node.skillCheck.successNodeId === nodeId) node.skillCheck.successNodeId = null;
      if (node.skillCheck.failureNodeId === nodeId) node.skillCheck.failureNodeId = null;
      if (node.skillCheck.critSuccessNodeId === nodeId) node.skillCheck.critSuccessNodeId = null;
      if (node.skillCheck.critFailureNodeId === nodeId) node.skillCheck.critFailureNodeId = null;
    }

    // Clean up branch references
    if (node.branches) {
      node.branches = node.branches.filter(b => b.nextNodeId !== nodeId);
    }
  });

  // Update start node if necessary
  if (dialogue.startNodeId === nodeId) {
    const remainingNodes = Object.keys(dialogue.nodes);
    dialogue.startNodeId = remainingNodes[0] || null;
  }
  if (dialogue.alternativeStartNodeId === nodeId) {
    dialogue.alternativeStartNodeId = null;
  }

  dialogue.updatedAt = Date.now();
}

/**
 * Connect two nodes
 * @param {object} dialogue - Dialogue data
 * @param {string} fromNodeId - Source node ID
 * @param {string} toNodeId - Target node ID
 * @param {string} connectionType - Type of connection
 * @param {object} options - Additional options
 */
export function connectNodes(dialogue, fromNodeId, toNodeId, connectionType = "next", options = {}) {
  const fromNode = dialogue.nodes[fromNodeId];
  if (!fromNode) return;

  switch (connectionType) {
    case "next":
      fromNode.nextNodeId = toNodeId;
      break;
    case "response":
      const response = createResponse({
        ...options,
        nextNodeId: toNodeId
      });
      fromNode.responses = fromNode.responses || [];
      fromNode.responses.push(response);
      break;
    case "success":
      if (fromNode.skillCheck) fromNode.skillCheck.successNodeId = toNodeId;
      else fromNode.successNodeId = toNodeId;
      break;
    case "failure":
      if (fromNode.skillCheck) fromNode.skillCheck.failureNodeId = toNodeId;
      else fromNode.failureNodeId = toNodeId;
      break;
    case "accept":
      fromNode.acceptNodeId = toNodeId;
      break;
    case "decline":
      fromNode.declineNodeId = toNodeId;
      break;
    case "default":
      fromNode.defaultNodeId = toNodeId;
      break;
    case "branch":
      fromNode.branches = fromNode.branches || [];
      fromNode.branches.push({
        id: generateId(),
        conditions: options.conditions || [],
        nextNodeId: toNodeId,
        priority: options.priority ?? fromNode.branches.length
      });
      break;
  }

  dialogue.updatedAt = Date.now();
}

/**
 * Validate a dialogue tree
 * @param {object} dialogue - Dialogue data
 * @returns {object} {valid: boolean, errors: string[], warnings: string[]}
 */
export function validateDialogue(dialogue) {
  const errors = [];
  const warnings = [];

  // Check required fields
  if (!dialogue.id) errors.push("Dialogue ID is required");
  if (!dialogue.name?.trim()) errors.push("Dialogue name is required");

  // Check start node
  if (!dialogue.startNodeId) {
    errors.push("No start node defined");
  } else if (!dialogue.nodes[dialogue.startNodeId]) {
    errors.push("Start node does not exist");
  }

  // Check each node
  const nodeIds = Object.keys(dialogue.nodes);
  const referencedNodes = new Set();

  nodeIds.forEach(nodeId => {
    const node = dialogue.nodes[nodeId];

    // Track referenced nodes
    if (node.nextNodeId) referencedNodes.add(node.nextNodeId);
    if (node.successNodeId) referencedNodes.add(node.successNodeId);
    if (node.failureNodeId) referencedNodes.add(node.failureNodeId);
    if (node.acceptNodeId) referencedNodes.add(node.acceptNodeId);
    if (node.declineNodeId) referencedNodes.add(node.declineNodeId);
    if (node.defaultNodeId) referencedNodes.add(node.defaultNodeId);
    if (node.incompleteNodeId) referencedNodes.add(node.incompleteNodeId);

    if (node.responses) {
      node.responses.forEach(r => {
        if (r.nextNodeId) referencedNodes.add(r.nextNodeId);
      });
    }

    if (node.branches) {
      node.branches.forEach(b => {
        if (b.nextNodeId) referencedNodes.add(b.nextNodeId);
      });
    }

    if (node.skillCheck) {
      if (node.skillCheck.successNodeId) referencedNodes.add(node.skillCheck.successNodeId);
      if (node.skillCheck.failureNodeId) referencedNodes.add(node.skillCheck.failureNodeId);
      if (node.skillCheck.critSuccessNodeId) referencedNodes.add(node.skillCheck.critSuccessNodeId);
      if (node.skillCheck.critFailureNodeId) referencedNodes.add(node.skillCheck.critFailureNodeId);
    }

    // Check for broken references
    if (node.nextNodeId && !dialogue.nodes[node.nextNodeId]) {
      errors.push(`Node "${node.label || node.id}" references non-existent node`);
    }

    // Node-specific validation
    if (node.type === NodeType.NPC_SPEECH && !node.text?.trim()) {
      warnings.push(`NPC speech node "${node.label || node.id}" has no text`);
    }

    if (node.type === NodeType.SKILL_CHECK) {
      if (!node.skillCheck?.successNodeId) {
        warnings.push(`Skill check node "${node.label || node.id}" has no success path`);
      }
      if (!node.skillCheck?.failureNodeId) {
        warnings.push(`Skill check node "${node.label || node.id}" has no failure path`);
      }
    }
  });

  // Check for unreachable nodes (except start)
  nodeIds.forEach(nodeId => {
    if (nodeId !== dialogue.startNodeId &&
        nodeId !== dialogue.alternativeStartNodeId &&
        !referencedNodes.has(nodeId)) {
      warnings.push(`Node "${dialogue.nodes[nodeId].label || nodeId}" is unreachable`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Evaluate conditions for a player
 * @param {object[]} conditions - Array of conditions
 * @param {object} context - Evaluation context {actor, npc, ...}
 * @returns {boolean}
 */
export function evaluateConditions(conditions, context) {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every(condition => {
    let result = evaluateSingleCondition(condition, context);
    return condition.inverted ? !result : result;
  });
}

/**
 * Evaluate a single condition
 * @param {object} condition - Condition to evaluate
 * @param {object} context - Evaluation context
 * @returns {boolean}
 */
function evaluateSingleCondition(condition, context) {
  const { actor, npc } = context;

  switch (condition.type) {
    case ConditionType.PLAYER_LEVEL: {
      const level = actor?.system?.details?.level || 0;
      return compareValues(level, condition.value, condition.comparison);
    }

    case ConditionType.PLAYER_CLASS: {
      const actorClass = (actor?.system?.details?.class || "").toLowerCase();
      return condition.classes.some(c => actorClass.includes(c.toLowerCase()));
    }

    case ConditionType.PLAYER_RACE: {
      const actorRace = (actor?.system?.details?.race || "").toLowerCase();
      return condition.races.some(r => actorRace.includes(r.toLowerCase()));
    }

    case ConditionType.HAS_GOLD: {
      const gold = actor?.system?.currency?.gp || 0;
      return gold >= condition.amount;
    }

    case ConditionType.FLAG: {
      let flagSource;
      switch (condition.scope) {
        case "world":
          flagSource = game.world;
          break;
        case "actor":
          flagSource = actor;
          break;
        case "npc":
          flagSource = npc;
          break;
        default:
          flagSource = game.world;
      }
      const flagValue = flagSource?.getFlag(MODULE_ID, condition.key);
      return flagValue === condition.value;
    }

    case ConditionType.RANDOM: {
      return Math.random() < condition.chance;
    }

    case ConditionType.TIME: {
      // Would need Simple Calendar or game time integration
      // For now, return true
      return true;
    }

    // Other conditions would need access to quest/faction systems
    default:
      return true;
  }
}

/**
 * Compare values using comparison operator
 * @param {number} a - First value
 * @param {number} b - Second value
 * @param {string} comparison - Comparison operator
 * @returns {boolean}
 */
function compareValues(a, b, comparison) {
  switch (comparison) {
    case Comparison.EQUALS: return a === b;
    case Comparison.NOT_EQUALS: return a !== b;
    case Comparison.GREATER_THAN: return a > b;
    case Comparison.GREATER_THAN_OR_EQUAL: return a >= b;
    case Comparison.LESS_THAN: return a < b;
    case Comparison.LESS_THAN_OR_EQUAL: return a <= b;
    default: return a >= b;
  }
}

/**
 * Apply effects from a dialogue choice
 * @param {object[]} effects - Array of effects
 * @param {object} context - Execution context
 * @returns {Promise<object[]>} Results of each effect
 */
export async function applyEffects(effects, context) {
  const results = [];

  for (const effect of effects) {
    try {
      const result = await applySingleEffect(effect, context);
      results.push({ effect, success: true, result });
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to apply effect:`, error);
      results.push({ effect, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Apply a single effect
 * @param {object} effect - Effect to apply
 * @param {object} context - Execution context
 */
async function applySingleEffect(effect, context) {
  const { actor, npc } = context;

  switch (effect.type) {
    case EffectType.SET_FLAG: {
      let flagTarget;
      switch (effect.scope) {
        case "world":
          flagTarget = game.world;
          break;
        case "actor":
          flagTarget = actor;
          break;
        case "npc":
          flagTarget = npc;
          break;
        default:
          flagTarget = game.world;
      }
      await flagTarget.setFlag(MODULE_ID, effect.key, effect.value);
      return { scope: effect.scope, key: effect.key, value: effect.value };
    }

    case EffectType.CHAT_MESSAGE: {
      const messageData = {
        content: effect.content,
        speaker: effect.speaker === "npc" ?
          ChatMessage.getSpeaker({ actor: npc }) :
          ChatMessage.getSpeaker()
      };
      if (effect.whisper) {
        messageData.whisper = [game.user.id];
      }
      await ChatMessage.create(messageData);
      return { message: effect.content };
    }

    case EffectType.PLAY_SOUND: {
      if (effect.path) {
        AudioHelper.play({ src: effect.path, volume: effect.volume });
      }
      return { path: effect.path };
    }

    // Other effects would be handled by their respective systems
    default:
      return null;
  }
}

/**
 * D&D 5e skills for skill checks
 */
export const Skills = Object.freeze({
  ACROBATICS: "acr",
  ANIMAL_HANDLING: "ani",
  ARCANA: "arc",
  ATHLETICS: "ath",
  DECEPTION: "dec",
  HISTORY: "his",
  INSIGHT: "ins",
  INTIMIDATION: "itm",
  INVESTIGATION: "inv",
  MEDICINE: "med",
  NATURE: "nat",
  PERCEPTION: "prc",
  PERFORMANCE: "prf",
  PERSUASION: "per",
  RELIGION: "rel",
  SLEIGHT_OF_HAND: "slt",
  STEALTH: "ste",
  SURVIVAL: "sur"
});

/**
 * Get skill display name
 * @param {string} skillKey - Skill abbreviation
 * @returns {string}
 */
export function getSkillName(skillKey) {
  return CONFIG.DND5E?.skills?.[skillKey]?.label || skillKey;
}
