/**
 * Bob's Talking NPCs - Quest Data Model
 * Defines the structure and validation for quest data
 */

import { MODULE_ID } from "../module.mjs";
import { generateId } from "../utils/helpers.mjs";

/**
 * Quest status enum
 */
export const QuestStatus = Object.freeze({
  AVAILABLE: "available",
  ACCEPTED: "accepted",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  FAILED: "failed"
});

/**
 * Quest category enum
 */
export const QuestCategory = Object.freeze({
  MAIN_STORY: "main_story",
  SIDE_QUEST: "side_quest",
  BOUNTY: "bounty",
  DAILY: "daily",
  GUILD_CONTRACT: "guild_contract",
  CUSTOM: "custom"
});

/**
 * Quest visibility enum
 */
export const QuestVisibility = Object.freeze({
  PARTY: "party",
  INDIVIDUAL: "individual",
  CLASS_SPECIFIC: "class_specific",
  SECRET: "secret"
});

/**
 * Objective type enum
 */
export const ObjectiveType = Object.freeze({
  MANUAL: "manual",
  KILL_COUNT: "kill_count",
  ITEM_COLLECT: "item_collect",
  LOCATION: "location"
});

/**
 * Reward distribution enum
 */
export const RewardDistribution = Object.freeze({
  SPLIT: "split",
  FULL_EACH: "full_each",
  GM_CHOICE: "gm_choice"
});

/**
 * Repeatable type enum
 */
export const RepeatableType = Object.freeze({
  NONE: "none",
  DAILY: "daily",
  WEEKLY: "weekly",
  INFINITE: "infinite",
  COOLDOWN: "cooldown"
});

/**
 * On giver death behavior enum
 */
export const OnGiverDeath = Object.freeze({
  GM_PROMPT: "gm_prompt",
  FAIL: "fail",
  CONTINUE: "continue",
  USE_ALTERNATIVE: "use_alternative"
});

/**
 * Default quest objective structure
 */
export function createObjective(data = {}) {
  return {
    id: data.id || generateId(),
    text: data.text || "",
    type: data.type || ObjectiveType.MANUAL,
    completed: data.completed || false,
    hidden: data.hidden || false,
    optional: data.optional || false,
    order: data.order ?? 0,

    // Type-specific data
    killTarget: data.killTarget || null,        // Actor name or UUID for kill quests
    killCount: data.killCount || 0,             // Target kill count
    killCurrent: data.killCurrent || 0,         // Current kill count

    itemId: data.itemId || null,                // Item UUID for collect quests
    itemCount: data.itemCount || 0,             // Target item count
    itemCurrent: data.itemCurrent || 0,         // Current item count
    consumeItems: data.consumeItems ?? true,    // Remove items on turn-in

    locationSceneId: data.locationSceneId || null,  // Scene UUID for location quests
    locationRegion: data.locationRegion || null     // Region ID within scene
  };
}

/**
 * Default reward choice structure
 */
export function createRewardChoice(data = {}) {
  return {
    id: data.id || generateId(),
    type: data.type || "pick_one",              // pick_one, pick_x
    pickCount: data.pickCount || 1,
    options: data.options || []                 // Array of reward options
  };
}

/**
 * Default quest branch structure
 */
export function createBranch(data = {}) {
  return {
    id: data.id || generateId(),
    name: data.name || "",
    description: data.description || "",
    condition: data.condition || "dialogue_choice",
    conditionData: data.conditionData || {},
    rewards: data.rewards || createRewards(),
    consequences: data.consequences || {}
  };
}

/**
 * Default rewards structure
 */
export function createRewards(data = {}) {
  return {
    distribution: data.distribution || RewardDistribution.SPLIT,
    gold: data.gold || 0,
    xp: data.xp || 0,
    items: data.items || [],                    // Array of {compendiumId, quantity}
    choices: data.choices || [],                // Array of reward choices
    reputation: data.reputation || [],          // Array of {factionId, amount}
    relationship: data.relationship || [],      // Array of {actorUuid, amount}
    unlocks: data.unlocks || {
      dialogueOptions: [],
      areas: [],
      shops: []
    },
    companion: data.companion || null,          // Actor UUID
    property: data.property || null,            // Scene UUID
    titles: data.titles || [],                  // Array of title strings
    custom: data.custom || []                   // Array of custom text rewards
  };
}

/**
 * Default prerequisites structure
 */
export function createPrerequisites(data = {}) {
  return {
    level: data.level || 0,
    quests: data.quests || [],                  // Quest IDs that must be completed
    questsAny: data.questsAny || [],            // Any of these quests completed
    factionRank: data.factionRank || null,      // {factionId, rank}
    factionReputation: data.factionReputation || null, // {factionId, minimum}
    relationship: data.relationship || null,    // {actorUuid, minimum}
    items: data.items || [],                    // Items required to accept
    gold: data.gold || 0,                       // Gold required
    classes: data.classes || [],                // Player must be one of these classes
    races: data.races || [],                    // Player must be one of these races
    custom: data.custom || []                   // GM-defined requirements (text)
  };
}

/**
 * Default abandonment settings structure
 */
export function createAbandonmentSettings(data = {}) {
  return {
    allowed: data.allowed ?? true,
    consequences: {
      reputationLoss: data.consequences?.reputationLoss || [], // Array of {factionId, amount}
      relationshipLoss: data.consequences?.relationshipLoss || [], // Array of {actorUuid, amount}
      cooldownDays: data.consequences?.cooldownDays || 0,
      failRelatedQuests: data.consequences?.failRelatedQuests || []
    }
  };
}

/**
 * Default handout structure
 */
export function createHandout(data = {}) {
  return {
    id: data.id || generateId(),
    type: data.type || "image",                 // image, journal, text
    name: data.name || "",
    url: data.url || null,                      // For images
    pageId: data.pageId || null,                // For journal entries
    content: data.content || null,              // For text
    revealOnAccept: data.revealOnAccept ?? true,
    revealOnObjective: data.revealOnObjective || null // Objective ID
  };
}

/**
 * Create a new quest with default values
 * @param {object} data - Quest data overrides
 * @returns {object} Quest data object
 */
export function createQuest(data = {}) {
  return {
    id: data.id || generateId(),
    name: data.name || "New Quest",
    description: data.description || "",
    summary: data.summary || "",                // Short description for lists
    category: data.category || QuestCategory.SIDE_QUEST,
    customCategory: data.customCategory || null,
    rank: data.rank || null,                    // Faction rank requirement display
    status: data.status || QuestStatus.AVAILABLE,
    hidden: data.hidden || false,
    pinned: data.pinned || false,

    // Repeatable settings
    repeatable: {
      enabled: data.repeatable?.enabled || false,
      type: data.repeatable?.type || RepeatableType.NONE,
      cooldownDays: data.repeatable?.cooldownDays || 0,
      completionCount: data.repeatable?.completionCount || 0,
      lastCompleted: data.repeatable?.lastCompleted || null
    },

    // Quest giver
    giver: {
      actorUuid: data.giver?.actorUuid || null,
      turnInActorUuid: data.giver?.turnInActorUuid || null,
      turnInAlternatives: data.giver?.turnInAlternatives || [],
      acceptDialogueId: data.giver?.acceptDialogueId || null,
      turnInDialogueId: data.giver?.turnInDialogueId || null
    },

    // Party tracking
    acceptedBy: data.acceptedBy || [],          // Actor UUIDs
    acceptedAt: data.acceptedAt || null,
    completedAt: data.completedAt || null,
    visibility: data.visibility || QuestVisibility.PARTY,
    visibleToClasses: data.visibleToClasses || [],
    visibleToActors: data.visibleToActors || [],

    // Objectives
    objectives: (data.objectives || []).map(obj => createObjective(obj)),

    // Rewards
    rewards: createRewards(data.rewards || {}),

    // Prerequisites
    prerequisites: createPrerequisites(data.prerequisites || {}),

    // Branching
    branches: (data.branches || []).map(b => createBranch(b)),
    activeBranch: data.activeBranch || null,

    // Abandonment
    abandonment: createAbandonmentSettings(data.abandonment || {}),

    // On NPC death
    onGiverDeath: data.onGiverDeath || OnGiverDeath.GM_PROMPT,

    // Conflicts
    conflictsWith: data.conflictsWith || [],    // Quest IDs failed if this completes
    mutuallyExclusive: data.mutuallyExclusive || [], // Can't accept simultaneously

    // Display
    displayPrerequisites: data.displayPrerequisites || "locked", // locked, hidden

    // Handouts
    handouts: (data.handouts || []).map(h => createHandout(h)),

    // Notes
    partyNotes: data.partyNotes || "",
    playerNotes: data.playerNotes || {},        // Per-player notes {actorUuid: notes}

    // Timestamps
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),

    // Sorting
    sortOrder: data.sortOrder ?? 0,

    // Tracking for time-sensitive quests
    timeLimit: data.timeLimit || null,          // Time limit in hours (null = no limit)
    expiresAt: data.expiresAt || null           // Timestamp when quest expires
  };
}

/**
 * Validate quest data
 * @param {object} quest - Quest data to validate
 * @returns {object} {valid: boolean, errors: string[]}
 */
export function validateQuest(quest) {
  const errors = [];

  // Required fields
  if (!quest.id) errors.push("Quest ID is required");
  if (!quest.name?.trim()) errors.push("Quest name is required");

  // Valid enum values
  if (!Object.values(QuestStatus).includes(quest.status)) {
    errors.push(`Invalid quest status: ${quest.status}`);
  }
  if (!Object.values(QuestCategory).includes(quest.category)) {
    errors.push(`Invalid quest category: ${quest.category}`);
  }
  if (!Object.values(QuestVisibility).includes(quest.visibility)) {
    errors.push(`Invalid quest visibility: ${quest.visibility}`);
  }

  // Objectives validation
  if (quest.objectives) {
    quest.objectives.forEach((obj, index) => {
      if (!obj.id) errors.push(`Objective ${index + 1} is missing ID`);
      if (!obj.text?.trim()) errors.push(`Objective ${index + 1} is missing text`);
      if (!Object.values(ObjectiveType).includes(obj.type)) {
        errors.push(`Objective ${index + 1} has invalid type: ${obj.type}`);
      }
    });
  }

  // Giver validation
  if (quest.status !== QuestStatus.AVAILABLE && !quest.giver?.actorUuid) {
    // Warning, not error - quest can exist without giver for templates
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a quest's prerequisites are met for a player
 * @param {object} quest - Quest data
 * @param {Actor} actor - Player actor
 * @returns {object} {met: boolean, reasons: string[]}
 */
export function checkPrerequisites(quest, actor) {
  const reasons = [];
  const prereqs = quest.prerequisites;

  // Level check
  if (prereqs.level > 0) {
    const actorLevel = actor.system?.details?.level || 0;
    if (actorLevel < prereqs.level) {
      reasons.push(`Requires level ${prereqs.level}`);
    }
  }

  // Quest completion check
  if (prereqs.quests?.length > 0) {
    // Would need to check quest completion status
    // This is a stub - actual implementation needs quest storage access
  }

  // Faction rank check
  if (prereqs.factionRank) {
    // Would need to check faction standings
    // This is a stub - actual implementation needs faction storage access
  }

  // Gold check
  if (prereqs.gold > 0) {
    const actorGold = actor.system?.currency?.gp || 0;
    if (actorGold < prereqs.gold) {
      reasons.push(`Requires ${prereqs.gold} gold`);
    }
  }

  // Class check
  if (prereqs.classes?.length > 0) {
    const actorClass = actor.system?.details?.class?.toLowerCase() || "";
    if (!prereqs.classes.some(c => actorClass.includes(c.toLowerCase()))) {
      reasons.push(`Requires class: ${prereqs.classes.join(" or ")}`);
    }
  }

  // Race check
  if (prereqs.races?.length > 0) {
    const actorRace = actor.system?.details?.race?.toLowerCase() || "";
    if (!prereqs.races.some(r => actorRace.includes(r.toLowerCase()))) {
      reasons.push(`Requires race: ${prereqs.races.join(" or ")}`);
    }
  }

  return {
    met: reasons.length === 0,
    reasons
  };
}

/**
 * Calculate total objective progress
 * @param {object} quest - Quest data
 * @returns {object} {completed: number, total: number, percent: number}
 */
export function calculateProgress(quest) {
  const objectives = quest.objectives || [];
  const requiredObjectives = objectives.filter(o => !o.optional);
  const completedRequired = requiredObjectives.filter(o => o.completed);

  const total = requiredObjectives.length || 1;
  const completed = completedRequired.length;
  const percent = Math.round((completed / total) * 100);

  return { completed, total, percent };
}

/**
 * Check if all required objectives are complete
 * @param {object} quest - Quest data
 * @returns {boolean}
 */
export function isQuestReadyForTurnIn(quest) {
  const objectives = quest.objectives || [];
  const requiredObjectives = objectives.filter(o => !o.optional);
  return requiredObjectives.every(o => o.completed);
}

/**
 * Get quest journal page data for storage
 * @param {object} quest - Quest data
 * @returns {object} JournalEntryPage creation data
 */
export function getQuestPageData(quest) {
  return {
    name: quest.name,
    type: "text",
    text: {
      content: quest.description,
      format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML
    },
    flags: {
      [MODULE_ID]: {
        isQuest: true,
        questData: quest
      }
    }
  };
}

/**
 * Quest templates for quick creation
 */
export const QuestTemplates = {
  kill: {
    name: "Kill Quest",
    description: "Defeat enemies",
    category: QuestCategory.BOUNTY,
    objectives: [
      createObjective({
        text: "Defeat the target",
        type: ObjectiveType.KILL_COUNT,
        killCount: 1
      })
    ]
  },

  fetch: {
    name: "Fetch Quest",
    description: "Collect items",
    category: QuestCategory.SIDE_QUEST,
    objectives: [
      createObjective({
        text: "Collect the items",
        type: ObjectiveType.ITEM_COLLECT,
        itemCount: 1
      })
    ]
  },

  escort: {
    name: "Escort Quest",
    description: "Protect and escort an NPC",
    category: QuestCategory.SIDE_QUEST,
    objectives: [
      createObjective({
        text: "Meet with the escort target",
        type: ObjectiveType.MANUAL
      }),
      createObjective({
        text: "Escort them safely to the destination",
        type: ObjectiveType.LOCATION
      })
    ]
  },

  investigation: {
    name: "Investigation Quest",
    description: "Discover information",
    category: QuestCategory.SIDE_QUEST,
    objectives: [
      createObjective({
        text: "Gather clues",
        type: ObjectiveType.MANUAL
      }),
      createObjective({
        text: "Uncover the truth",
        type: ObjectiveType.MANUAL
      })
    ]
  },

  delivery: {
    name: "Delivery Quest",
    description: "Deliver an item to an NPC",
    category: QuestCategory.SIDE_QUEST,
    objectives: [
      createObjective({
        text: "Receive the package",
        type: ObjectiveType.ITEM_COLLECT,
        itemCount: 1
      }),
      createObjective({
        text: "Deliver to the recipient",
        type: ObjectiveType.MANUAL
      })
    ]
  },

  blank: {
    name: "New Quest",
    description: "",
    category: QuestCategory.SIDE_QUEST,
    objectives: []
  }
};

/**
 * Create a quest from a template
 * @param {string} templateName - Template name from QuestTemplates
 * @param {object} overrides - Data overrides
 * @returns {object} Quest data
 */
export function createQuestFromTemplate(templateName, overrides = {}) {
  const template = QuestTemplates[templateName] || QuestTemplates.blank;
  return createQuest({
    ...template,
    ...overrides,
    objectives: overrides.objectives ||
      template.objectives.map(o => createObjective({ ...o, id: generateId() }))
  });
}
