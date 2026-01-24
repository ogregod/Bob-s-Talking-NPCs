/**
 * Bob's Talking NPCs - Relationship Data Model
 * Defines the structure for NPC-player relationships
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";
import { generateId } from "../utils/helpers.mjs";

/**
 * Relationship tier enum
 */
export const RelationshipTier = Object.freeze({
  HOSTILE: "hostile",
  UNFRIENDLY: "unfriendly",
  NEUTRAL: "neutral",
  FRIENDLY: "friendly",
  CLOSE: "close",
  DEVOTED: "devoted"
});

/**
 * Gift preference enum
 */
export const GiftPreference = Object.freeze({
  LOVED: "loved",
  LIKED: "liked",
  NEUTRAL: "neutral",
  DISLIKED: "disliked",
  HATED: "hated"
});

/**
 * Relationship event type enum
 */
export const RelationshipEventType = Object.freeze({
  GIFT: "gift",
  QUEST_COMPLETED: "questCompleted",
  QUEST_FAILED: "questFailed",
  DIALOGUE_CHOICE: "dialogueChoice",
  COMBAT: "combat",
  THEFT: "theft",
  FAVOR: "favor",
  BETRAYAL: "betrayal",
  VISIT: "visit",
  TIME_DECAY: "timeDecay",
  CUSTOM: "custom"
});

/**
 * Default relationship thresholds
 */
export const DefaultThresholds = Object.freeze({
  [RelationshipTier.HOSTILE]: -100,
  [RelationshipTier.UNFRIENDLY]: -50,
  [RelationshipTier.NEUTRAL]: 0,
  [RelationshipTier.FRIENDLY]: 50,
  [RelationshipTier.CLOSE]: 150,
  [RelationshipTier.DEVOTED]: 300
});

/**
 * Create a relationship event record
 * @param {object} data - Event data
 * @returns {object}
 */
export function createRelationshipEvent(data = {}) {
  return {
    id: data.id || generateId(),
    timestamp: data.timestamp || Date.now(),
    type: data.type || RelationshipEventType.CUSTOM,
    change: data.change ?? 0,
    previousValue: data.previousValue ?? 0,
    newValue: data.newValue ?? 0,
    description: data.description || "",
    sourceId: data.sourceId || null,  // Quest ID, item UUID, dialogue ID, etc.
    hidden: data.hidden ?? false       // Hidden from player view
  };
}

/**
 * Create a gift preference entry
 * @param {object} data - Gift data
 * @returns {object}
 */
export function createGiftPreference(data = {}) {
  return {
    itemType: data.itemType || null,     // weapon, armor, consumable, etc.
    itemSubtype: data.itemSubtype || null, // sword, potion, etc.
    itemTag: data.itemTag || null,        // Custom tag matching
    itemUuid: data.itemUuid || null,      // Specific item
    preference: data.preference || GiftPreference.NEUTRAL,
    relationshipChange: data.relationshipChange ?? 0,
    response: data.response || null       // Custom dialogue response
  };
}

/**
 * Create a relationship milestone
 * @param {object} data - Milestone data
 * @returns {object}
 */
export function createMilestone(data = {}) {
  return {
    id: data.id || generateId(),
    tier: data.tier || RelationshipTier.FRIENDLY,
    threshold: data.threshold ?? 50,
    name: data.name || "",
    description: data.description || "",

    // Unlocks
    unlocks: {
      dialogueOptions: data.unlocks?.dialogueOptions || [],
      quests: data.unlocks?.quests || [],
      services: data.unlocks?.services || [],
      discounts: data.unlocks?.discounts ?? 0,
      gifts: data.unlocks?.gifts || [],
      information: data.unlocks?.information || []
    },

    // One-time rewards when reached
    rewards: {
      items: data.rewards?.items || [],
      gold: data.rewards?.gold ?? 0,
      xp: data.rewards?.xp ?? 0,
      custom: data.rewards?.custom || []
    },

    // Display
    icon: data.icon || null,
    color: data.color || null,
    achievedDialogue: data.achievedDialogue || null  // Dialogue ID to play
  };
}

/**
 * Create NPC relationship configuration
 * Stored on the NPC's actor flags
 * @param {object} data - Configuration data
 * @returns {object}
 */
export function createNPCRelationshipConfig(data = {}) {
  return {
    enabled: data.enabled ?? true,

    // Thresholds for tiers
    thresholds: {
      [RelationshipTier.HOSTILE]: data.thresholds?.[RelationshipTier.HOSTILE] ?? -100,
      [RelationshipTier.UNFRIENDLY]: data.thresholds?.[RelationshipTier.UNFRIENDLY] ?? -50,
      [RelationshipTier.NEUTRAL]: data.thresholds?.[RelationshipTier.NEUTRAL] ?? 0,
      [RelationshipTier.FRIENDLY]: data.thresholds?.[RelationshipTier.FRIENDLY] ?? 50,
      [RelationshipTier.CLOSE]: data.thresholds?.[RelationshipTier.CLOSE] ?? 150,
      [RelationshipTier.DEVOTED]: data.thresholds?.[RelationshipTier.DEVOTED] ?? 300
    },

    // Value limits
    minValue: data.minValue ?? -200,
    maxValue: data.maxValue ?? 500,
    startingValue: data.startingValue ?? 0,

    // Decay settings
    decay: {
      enabled: data.decay?.enabled ?? false,
      amount: data.decay?.amount ?? 1,
      interval: data.decay?.interval || "week",  // day, week, month
      minimum: data.decay?.minimum ?? 0,         // Don't decay below this
      requiresVisit: data.decay?.requiresVisit ?? true  // Only decay if not visited
    },

    // Gift system
    gifts: {
      enabled: data.gifts?.enabled ?? true,
      cooldownHours: data.gifts?.cooldownHours ?? 24,
      maxPerDay: data.gifts?.maxPerDay ?? 1,
      preferences: (data.gifts?.preferences || []).map(p => createGiftPreference(p)),
      defaultChange: {
        [GiftPreference.LOVED]: data.gifts?.defaultChange?.[GiftPreference.LOVED] ?? 25,
        [GiftPreference.LIKED]: data.gifts?.defaultChange?.[GiftPreference.LIKED] ?? 10,
        [GiftPreference.NEUTRAL]: data.gifts?.defaultChange?.[GiftPreference.NEUTRAL] ?? 2,
        [GiftPreference.DISLIKED]: data.gifts?.defaultChange?.[GiftPreference.DISLIKED] ?? -5,
        [GiftPreference.HATED]: data.gifts?.defaultChange?.[GiftPreference.HATED] ?? -15
      }
    },

    // Milestones
    milestones: (data.milestones || []).map(m => createMilestone(m)),

    // Dialogue overrides based on relationship
    dialogueOverrides: data.dialogueOverrides || {},  // {tier: dialogueNodeId}
    greetingOverrides: data.greetingOverrides || {},  // {tier: greeting text or id}

    // Combat behavior
    combatBehavior: {
      attacksAtHostile: data.combatBehavior?.attacksAtHostile ?? false,
      fleeThreshold: data.combatBehavior?.fleeThreshold ?? null,
      callsForHelp: data.combatBehavior?.callsForHelp ?? false
    },

    // Display settings
    display: {
      showToPlayers: data.display?.showToPlayers ?? true,
      showNumericValue: data.display?.showNumericValue ?? false,
      showTierName: data.display?.showTierName ?? true,
      showProgressBar: data.display?.showProgressBar ?? true
    }
  };
}

/**
 * Create a player's relationship with an NPC
 * Stored in world flags or actor flags
 * @param {object} data - Relationship data
 * @returns {object}
 */
export function createPlayerRelationship(data = {}) {
  return {
    npcActorUuid: data.npcActorUuid || null,
    playerActorUuid: data.playerActorUuid || null,

    // Current state
    value: data.value ?? 0,
    tier: data.tier || RelationshipTier.NEUTRAL,

    // History
    history: (data.history || []).map(e => createRelationshipEvent(e)),

    // Gift tracking
    giftsGiven: data.giftsGiven ?? 0,
    lastGiftTime: data.lastGiftTime || null,
    giftsToday: data.giftsToday ?? 0,
    giftHistory: data.giftHistory || [],  // Array of {itemUuid, timestamp, change}

    // Interaction tracking
    firstMet: data.firstMet || null,
    lastInteraction: data.lastInteraction || null,
    interactionCount: data.interactionCount ?? 0,

    // Milestones achieved
    achievedMilestones: data.achievedMilestones || [],  // Milestone IDs

    // Special flags
    flags: {
      hasBetrayed: data.flags?.hasBetrayed ?? false,
      isRomance: data.flags?.isRomance ?? false,
      isRival: data.flags?.isRival ?? false,
      isMentor: data.flags?.isMentor ?? false,
      custom: data.flags?.custom || {}
    },

    // Metadata
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  };
}

/**
 * Get relationship tier for a value
 * @param {number} value - Relationship value
 * @param {object} thresholds - Tier thresholds
 * @returns {string} Relationship tier
 */
export function getTierForValue(value, thresholds = DefaultThresholds) {
  const tiers = [
    RelationshipTier.DEVOTED,
    RelationshipTier.CLOSE,
    RelationshipTier.FRIENDLY,
    RelationshipTier.NEUTRAL,
    RelationshipTier.UNFRIENDLY,
    RelationshipTier.HOSTILE
  ];

  for (const tier of tiers) {
    if (value >= thresholds[tier]) {
      return tier;
    }
  }

  return RelationshipTier.HOSTILE;
}

/**
 * Get tier display information
 * @param {string} tier - Relationship tier
 * @returns {object} {name, color, icon}
 */
export function getTierDisplay(tier) {
  const displays = {
    [RelationshipTier.HOSTILE]: {
      name: "Hostile",
      color: "#f44336",
      icon: "fa-face-angry"
    },
    [RelationshipTier.UNFRIENDLY]: {
      name: "Unfriendly",
      color: "#ff9800",
      icon: "fa-face-frown"
    },
    [RelationshipTier.NEUTRAL]: {
      name: "Neutral",
      color: "#9e9e9e",
      icon: "fa-face-meh"
    },
    [RelationshipTier.FRIENDLY]: {
      name: "Friendly",
      color: "#8bc34a",
      icon: "fa-face-smile"
    },
    [RelationshipTier.CLOSE]: {
      name: "Close",
      color: "#03a9f4",
      icon: "fa-face-grin"
    },
    [RelationshipTier.DEVOTED]: {
      name: "Devoted",
      color: "#e91e63",
      icon: "fa-heart"
    }
  };

  return displays[tier] || displays[RelationshipTier.NEUTRAL];
}

/**
 * Calculate relationship change with modifiers
 * @param {number} baseChange - Base relationship change
 * @param {object} context - Context with modifiers
 * @returns {number} Modified change value
 */
export function calculateRelationshipChange(baseChange, context = {}) {
  let change = baseChange;

  // Apply charisma modifier if applicable
  if (context.charismaModifier && context.applyCharisma) {
    const charismaBonus = context.charismaModifier * 0.1;  // 10% per modifier
    if (baseChange > 0) {
      change = Math.round(change * (1 + charismaBonus));
    } else {
      change = Math.round(change * (1 - charismaBonus * 0.5));  // Less effect on negative
    }
  }

  // Apply tier multiplier
  if (context.currentTier && context.tierMultipliers) {
    const multiplier = context.tierMultipliers[context.currentTier] || 1;
    change = Math.round(change * multiplier);
  }

  // Apply event type multiplier
  if (context.eventType && context.eventMultipliers) {
    const multiplier = context.eventMultipliers[context.eventType] || 1;
    change = Math.round(change * multiplier);
  }

  return change;
}

/**
 * Modify relationship value with bounds and tier update
 * @param {object} relationship - Player relationship data
 * @param {number} change - Amount to change
 * @param {object} config - NPC relationship config
 * @param {object} eventData - Event data for history
 * @returns {object} Updated relationship
 */
export function modifyRelationship(relationship, change, config, eventData = {}) {
  const previousValue = relationship.value;
  const previousTier = relationship.tier;

  // Calculate new value with bounds
  let newValue = previousValue + change;
  newValue = Math.max(config.minValue, Math.min(config.maxValue, newValue));

  // Determine new tier
  const newTier = getTierForValue(newValue, config.thresholds);

  // Create history event
  const event = createRelationshipEvent({
    type: eventData.type || RelationshipEventType.CUSTOM,
    change,
    previousValue,
    newValue,
    description: eventData.description || "",
    sourceId: eventData.sourceId
  });

  // Check for newly achieved milestones
  const newMilestones = [];
  if (newValue > previousValue) {
    for (const milestone of config.milestones || []) {
      if (
        newValue >= milestone.threshold &&
        previousValue < milestone.threshold &&
        !relationship.achievedMilestones.includes(milestone.id)
      ) {
        newMilestones.push(milestone);
      }
    }
  }

  return {
    ...relationship,
    value: newValue,
    tier: newTier,
    history: [...relationship.history, event],
    achievedMilestones: [
      ...relationship.achievedMilestones,
      ...newMilestones.map(m => m.id)
    ],
    lastInteraction: Date.now(),
    interactionCount: relationship.interactionCount + 1,
    updatedAt: Date.now(),
    _tierChanged: previousTier !== newTier,
    _previousTier: previousTier,
    _newMilestones: newMilestones
  };
}

/**
 * Process a gift given to NPC
 * @param {object} relationship - Player relationship
 * @param {object} config - NPC relationship config
 * @param {object} item - Item data
 * @returns {object} {relationship, preference, change, response, canGift, reason}
 */
export function processGift(relationship, config, item) {
  if (!config.gifts.enabled) {
    return {
      relationship,
      canGift: false,
      reason: "This NPC does not accept gifts"
    };
  }

  // Check cooldown
  const now = Date.now();
  const cooldownMs = config.gifts.cooldownHours * 60 * 60 * 1000;
  if (relationship.lastGiftTime && (now - relationship.lastGiftTime) < cooldownMs) {
    const remainingHours = Math.ceil((cooldownMs - (now - relationship.lastGiftTime)) / (60 * 60 * 1000));
    return {
      relationship,
      canGift: false,
      reason: `Must wait ${remainingHours} more hour(s)`
    };
  }

  // Check daily limit
  const today = new Date().toDateString();
  const lastGiftDay = relationship.lastGiftTime
    ? new Date(relationship.lastGiftTime).toDateString()
    : null;

  const giftsToday = lastGiftDay === today ? relationship.giftsToday : 0;
  if (giftsToday >= config.gifts.maxPerDay) {
    return {
      relationship,
      canGift: false,
      reason: "Daily gift limit reached"
    };
  }

  // Determine gift preference
  let preference = GiftPreference.NEUTRAL;
  let customResponse = null;

  for (const pref of config.gifts.preferences) {
    let matches = false;

    if (pref.itemUuid && item.uuid === pref.itemUuid) {
      matches = true;
    } else if (pref.itemType && item.type === pref.itemType) {
      if (!pref.itemSubtype || item.system?.type?.value === pref.itemSubtype) {
        matches = true;
      }
    } else if (pref.itemTag && item.flags?.[MODULE_ID]?.tags?.includes(pref.itemTag)) {
      matches = true;
    }

    if (matches) {
      preference = pref.preference;
      customResponse = pref.response;
      break;
    }
  }

  // Calculate relationship change
  const change = config.gifts.defaultChange[preference];

  // Apply the change
  const updatedRelationship = modifyRelationship(
    {
      ...relationship,
      giftsGiven: relationship.giftsGiven + 1,
      lastGiftTime: now,
      giftsToday: giftsToday + 1,
      giftHistory: [
        ...relationship.giftHistory,
        { itemUuid: item.uuid, timestamp: now, change, preference }
      ]
    },
    change,
    config,
    {
      type: RelationshipEventType.GIFT,
      description: `Gift: ${item.name}`,
      sourceId: item.uuid
    }
  );

  return {
    relationship: updatedRelationship,
    canGift: true,
    preference,
    change,
    response: customResponse
  };
}

/**
 * Apply time-based decay to relationship
 * @param {object} relationship - Player relationship
 * @param {object} config - NPC relationship config
 * @returns {object} Updated relationship or original if no decay
 */
export function applyDecay(relationship, config) {
  if (!config.decay.enabled) return relationship;

  const now = Date.now();
  const lastInteraction = relationship.lastInteraction || relationship.createdAt;

  // Calculate intervals passed
  const intervalMs = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000
  }[config.decay.interval] || 7 * 24 * 60 * 60 * 1000;

  const elapsed = now - lastInteraction;
  const intervalsPassed = Math.floor(elapsed / intervalMs);

  if (intervalsPassed <= 0) return relationship;

  // Calculate decay amount
  const totalDecay = config.decay.amount * intervalsPassed;

  // Don't decay below minimum
  if (relationship.value <= config.decay.minimum) return relationship;

  const decayAmount = Math.min(
    totalDecay,
    relationship.value - config.decay.minimum
  );

  if (decayAmount <= 0) return relationship;

  return modifyRelationship(
    relationship,
    -decayAmount,
    config,
    {
      type: RelationshipEventType.TIME_DECAY,
      description: `Time decay: ${intervalsPassed} ${config.decay.interval}(s)`
    }
  );
}

/**
 * Get progress to next tier
 * @param {number} value - Current relationship value
 * @param {string} currentTier - Current tier
 * @param {object} thresholds - Tier thresholds
 * @returns {object} {nextTier, threshold, current, percent}
 */
export function getProgressToNextTier(value, currentTier, thresholds = DefaultThresholds) {
  const tierOrder = [
    RelationshipTier.HOSTILE,
    RelationshipTier.UNFRIENDLY,
    RelationshipTier.NEUTRAL,
    RelationshipTier.FRIENDLY,
    RelationshipTier.CLOSE,
    RelationshipTier.DEVOTED
  ];

  const currentIndex = tierOrder.indexOf(currentTier);

  // Already at max tier
  if (currentIndex === tierOrder.length - 1) {
    return {
      nextTier: null,
      threshold: thresholds[currentTier],
      current: value,
      percent: 100
    };
  }

  const nextTier = tierOrder[currentIndex + 1];
  const currentThreshold = thresholds[currentTier];
  const nextThreshold = thresholds[nextTier];

  const range = nextThreshold - currentThreshold;
  const progress = value - currentThreshold;
  const percent = Math.min(100, Math.max(0, Math.round((progress / range) * 100)));

  return {
    nextTier,
    threshold: nextThreshold,
    current: value,
    percent
  };
}

/**
 * Validate relationship configuration
 * @param {object} config - NPC relationship config
 * @returns {object} {valid: boolean, errors: string[]}
 */
export function validateRelationshipConfig(config) {
  const errors = [];

  // Check thresholds are in order
  const thresholdValues = [
    config.thresholds[RelationshipTier.HOSTILE],
    config.thresholds[RelationshipTier.UNFRIENDLY],
    config.thresholds[RelationshipTier.NEUTRAL],
    config.thresholds[RelationshipTier.FRIENDLY],
    config.thresholds[RelationshipTier.CLOSE],
    config.thresholds[RelationshipTier.DEVOTED]
  ];

  for (let i = 1; i < thresholdValues.length; i++) {
    if (thresholdValues[i] <= thresholdValues[i - 1]) {
      errors.push("Relationship tier thresholds must be in ascending order");
      break;
    }
  }

  // Check bounds
  if (config.minValue >= config.maxValue) {
    errors.push("Min value must be less than max value");
  }

  if (config.startingValue < config.minValue || config.startingValue > config.maxValue) {
    errors.push("Starting value must be within min/max bounds");
  }

  // Check gift config
  if (config.gifts.enabled) {
    if (config.gifts.maxPerDay < 1) {
      errors.push("Max gifts per day must be at least 1");
    }
    if (config.gifts.cooldownHours < 0) {
      errors.push("Gift cooldown cannot be negative");
    }
  }

  // Check decay config
  if (config.decay.enabled) {
    if (config.decay.amount <= 0) {
      errors.push("Decay amount must be positive");
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Relationship configuration templates
 */
export const RelationshipTemplates = {
  standard: {
    enabled: true,
    thresholds: { ...DefaultThresholds },
    minValue: -200,
    maxValue: 500,
    startingValue: 0,
    decay: { enabled: false },
    gifts: { enabled: true, cooldownHours: 24, maxPerDay: 1 },
    display: { showToPlayers: true, showNumericValue: false }
  },

  merchant: {
    enabled: true,
    thresholds: { ...DefaultThresholds },
    minValue: -100,
    maxValue: 300,
    startingValue: 0,
    decay: { enabled: false },
    gifts: { enabled: false },
    display: { showToPlayers: false }
  },

  romance: {
    enabled: true,
    thresholds: {
      [RelationshipTier.HOSTILE]: -100,
      [RelationshipTier.UNFRIENDLY]: -50,
      [RelationshipTier.NEUTRAL]: 0,
      [RelationshipTier.FRIENDLY]: 100,
      [RelationshipTier.CLOSE]: 250,
      [RelationshipTier.DEVOTED]: 500
    },
    minValue: -200,
    maxValue: 1000,
    startingValue: 0,
    decay: { enabled: true, amount: 2, interval: "week", minimum: 0 },
    gifts: { enabled: true, cooldownHours: 12, maxPerDay: 2 },
    display: { showToPlayers: true, showProgressBar: true }
  },

  rival: {
    enabled: true,
    thresholds: { ...DefaultThresholds },
    minValue: -300,
    maxValue: 200,
    startingValue: -25,
    decay: { enabled: false },
    gifts: { enabled: false },
    combatBehavior: { attacksAtHostile: true },
    display: { showToPlayers: true }
  },

  faction_npc: {
    enabled: true,
    thresholds: { ...DefaultThresholds },
    minValue: -200,
    maxValue: 500,
    startingValue: 0,
    decay: { enabled: true, amount: 1, interval: "month", minimum: -50 },
    gifts: { enabled: true, cooldownHours: 48, maxPerDay: 1 },
    display: { showToPlayers: true }
  }
};

/**
 * Create relationship config from template
 * @param {string} templateName - Template name
 * @param {object} overrides - Data overrides
 * @returns {object}
 */
export function createRelationshipConfigFromTemplate(templateName, overrides = {}) {
  const template = RelationshipTemplates[templateName] || RelationshipTemplates.standard;
  return createNPCRelationshipConfig({
    ...template,
    ...overrides
  });
}
