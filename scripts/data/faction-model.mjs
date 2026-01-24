/**
 * Bob's Talking NPCs - Faction Data Model
 * Defines the structure for factions, ranks, and reputation
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";
import { generateId } from "../utils/helpers.mjs";

/**
 * Faction relationship types enum
 */
export const FactionRelationType = Object.freeze({
  ALLIED: "allied",
  NEUTRAL: "neutral",
  RIVAL: "rival",
  ENEMY: "enemy"
});

/**
 * Default faction ranks
 */
export const DefaultRanks = Object.freeze({
  COPPER: "copper",
  IRON: "iron",
  SILVER: "silver",
  GOLD: "gold",
  PLATINUM: "platinum",
  MYTHRIL: "mythril"
});

/**
 * Reputation level enum
 */
export const ReputationLevel = Object.freeze({
  HATED: "hated",
  HOSTILE: "hostile",
  UNFRIENDLY: "unfriendly",
  NEUTRAL: "neutral",
  FRIENDLY: "friendly",
  HONORED: "honored",
  REVERED: "revered",
  EXALTED: "exalted"
});

/**
 * Create a faction rank
 * @param {object} data - Rank data
 * @returns {object}
 */
export function createRank(data = {}) {
  return {
    id: data.id || generateId(),
    name: data.name || "New Rank",
    order: data.order ?? 0,

    // Requirements to reach this rank
    requirements: {
      reputation: data.requirements?.reputation ?? 0,
      questsCompleted: data.requirements?.questsCompleted ?? 0,
      rankUpQuest: data.requirements?.rankUpQuest || null,  // Quest ID
      itemRequired: data.requirements?.itemRequired || null, // Item UUID
      goldRequired: data.requirements?.goldRequired ?? 0,
      custom: data.requirements?.custom || []  // GM-defined text requirements
    },

    // Benefits of this rank
    benefits: {
      questAccess: data.benefits?.questAccess || [],  // Quest rank tags
      priceDiscount: data.benefits?.priceDiscount ?? 0,  // Percentage (0-1)
      dialogueUnlocks: data.benefits?.dialogueUnlocks || [],
      titles: data.benefits?.titles || [],
      rewards: data.benefits?.rewards || [],  // One-time rewards on reaching rank
      services: data.benefits?.services || [],  // Services unlocked
      custom: data.benefits?.custom || []  // GM-defined text benefits
    },

    // Visual
    icon: data.icon || null,
    color: data.color || null
  };
}

/**
 * Create default rank set
 * @returns {object[]}
 */
export function createDefaultRanks() {
  return [
    createRank({
      id: DefaultRanks.COPPER,
      name: "Copper",
      order: 0,
      requirements: { reputation: 0 },
      benefits: {
        questAccess: ["copper"],
        priceDiscount: 0
      },
      color: "#b87333"
    }),
    createRank({
      id: DefaultRanks.IRON,
      name: "Iron",
      order: 1,
      requirements: { reputation: 100, questsCompleted: 3 },
      benefits: {
        questAccess: ["copper", "iron"],
        priceDiscount: 0.05,
        rewards: [{ type: "gold", amount: 50 }]
      },
      color: "#43464b"
    }),
    createRank({
      id: DefaultRanks.SILVER,
      name: "Silver",
      order: 2,
      requirements: { reputation: 250, questsCompleted: 8 },
      benefits: {
        questAccess: ["copper", "iron", "silver"],
        priceDiscount: 0.1,
        rewards: [{ type: "gold", amount: 150 }]
      },
      color: "#c0c0c0"
    }),
    createRank({
      id: DefaultRanks.GOLD,
      name: "Gold",
      order: 3,
      requirements: { reputation: 500, questsCompleted: 15 },
      benefits: {
        questAccess: ["copper", "iron", "silver", "gold"],
        priceDiscount: 0.15,
        titles: ["Honored Member"],
        rewards: [{ type: "gold", amount: 500 }]
      },
      color: "#ffd700"
    }),
    createRank({
      id: DefaultRanks.PLATINUM,
      name: "Platinum",
      order: 4,
      requirements: { reputation: 1000, questsCompleted: 25 },
      benefits: {
        questAccess: ["copper", "iron", "silver", "gold", "platinum"],
        priceDiscount: 0.2,
        titles: ["Champion"],
        rewards: [{ type: "gold", amount: 1000 }]
      },
      color: "#e5e4e2"
    }),
    createRank({
      id: DefaultRanks.MYTHRIL,
      name: "Mythril",
      order: 5,
      requirements: { reputation: 2000, questsCompleted: 50 },
      benefits: {
        questAccess: ["copper", "iron", "silver", "gold", "platinum", "mythril"],
        priceDiscount: 0.25,
        titles: ["Legend"],
        rewards: [{ type: "gold", amount: 2500 }]
      },
      color: "#4fc3f7"
    })
  ];
}

/**
 * Create a faction relationship with another faction
 * @param {object} data - Relationship data
 * @returns {object}
 */
export function createFactionRelationship(data = {}) {
  return {
    factionId: data.factionId || "",
    type: data.type || FactionRelationType.NEUTRAL,
    reputationEffect: data.reputationEffect ?? 0  // Multiplier for rep gain/loss
  };
}

/**
 * Create a player's standing with a faction
 * @param {object} data - Standing data
 * @returns {object}
 */
export function createPlayerStanding(data = {}) {
  return {
    reputation: data.reputation ?? 0,
    rank: data.rank || null,
    questsCompleted: data.questsCompleted ?? 0,
    joinedAt: data.joinedAt || null,
    lastActivity: data.lastActivity || null,
    history: data.history || []  // Array of {date, change, reason}
  };
}

/**
 * Create a new faction
 * @param {object} data - Faction data
 * @returns {object}
 */
export function createFaction(data = {}) {
  return {
    id: data.id || generateId(),
    name: data.name || "New Faction",
    description: data.description || "",
    shortDescription: data.shortDescription || "",

    // Visual
    icon: data.icon || null,
    color: data.color || "#7c4dff",
    banner: data.banner || null,

    // Headquarters
    headquarters: {
      sceneId: data.headquarters?.sceneId || null,
      specialDialogue: data.headquarters?.specialDialogue ?? true,
      coordinates: data.headquarters?.coordinates || null
    },

    // Ranks
    ranks: data.ranks || createDefaultRanks(),
    useDefaultRanks: data.useDefaultRanks ?? true,

    // Reputation configuration
    reputation: {
      min: data.reputation?.min ?? -100,
      max: data.reputation?.max ?? 2000,
      startingValue: data.reputation?.startingValue ?? 0,
      decay: {
        enabled: data.reputation?.decay?.enabled ?? false,
        amount: data.reputation?.decay?.amount ?? 1,
        interval: data.reputation?.decay?.interval || "week"  // day, week, month
      }
    },

    // Relationships with other factions
    factionRelationships: (data.factionRelationships || []).map(r =>
      createFactionRelationship(r)
    ),

    // Members (NPC Actor UUIDs)
    members: data.members || [],

    // Player standings (stored separately in world flags, but structure defined here)
    // playerStandings: { [actorUuid]: PlayerStanding }

    // Quests offered by this faction
    questIds: data.questIds || [],

    // Shops/services associated with this faction
    shopIds: data.shopIds || [],
    serviceIds: data.serviceIds || [],

    // Hostile behavior settings
    hostileThreshold: data.hostileThreshold ?? -50,
    attackOnSight: data.attackOnSight ?? false,
    bountyEnabled: data.bountyEnabled ?? true,

    // Metadata
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
    createdBy: data.createdBy || null
  };
}

/**
 * Get the rank for a given reputation value
 * @param {object} faction - Faction data
 * @param {number} reputation - Reputation value
 * @returns {object|null} Rank data or null
 */
export function getRankForReputation(faction, reputation) {
  const sortedRanks = [...faction.ranks].sort((a, b) => b.order - a.order);

  for (const rank of sortedRanks) {
    if (reputation >= rank.requirements.reputation) {
      return rank;
    }
  }

  return faction.ranks[0] || null;  // Return lowest rank
}

/**
 * Get the next rank above current
 * @param {object} faction - Faction data
 * @param {string} currentRankId - Current rank ID
 * @returns {object|null} Next rank or null if at max
 */
export function getNextRank(faction, currentRankId) {
  const sortedRanks = [...faction.ranks].sort((a, b) => a.order - b.order);
  const currentIndex = sortedRanks.findIndex(r => r.id === currentRankId);

  if (currentIndex === -1 || currentIndex === sortedRanks.length - 1) {
    return null;
  }

  return sortedRanks[currentIndex + 1];
}

/**
 * Check if player meets rank requirements
 * @param {object} rank - Rank data
 * @param {object} standing - Player standing
 * @param {object} context - Additional context (quests completed, etc.)
 * @returns {object} {met: boolean, reasons: string[]}
 */
export function checkRankRequirements(rank, standing, context = {}) {
  const reasons = [];

  if (standing.reputation < rank.requirements.reputation) {
    reasons.push(`Requires ${rank.requirements.reputation} reputation (have ${standing.reputation})`);
  }

  if (rank.requirements.questsCompleted > 0) {
    const completed = standing.questsCompleted || 0;
    if (completed < rank.requirements.questsCompleted) {
      reasons.push(`Requires ${rank.requirements.questsCompleted} quests completed (have ${completed})`);
    }
  }

  if (rank.requirements.goldRequired > 0 && context.gold !== undefined) {
    if (context.gold < rank.requirements.goldRequired) {
      reasons.push(`Requires ${rank.requirements.goldRequired} gold`);
    }
  }

  if (rank.requirements.rankUpQuest && !context.questCompleted) {
    reasons.push("Requires completion of rank-up quest");
  }

  return {
    met: reasons.length === 0,
    reasons
  };
}

/**
 * Calculate reputation change considering faction relationships
 * @param {object} faction - Primary faction
 * @param {number} amount - Base reputation change
 * @param {object[]} allFactions - All factions in the world
 * @returns {object[]} Array of {factionId, amount} for all affected factions
 */
export function calculateReputationChanges(faction, amount, allFactions) {
  const changes = [{ factionId: faction.id, amount }];

  // Calculate ripple effects to related factions
  for (const relationship of faction.factionRelationships) {
    const relatedFaction = allFactions.find(f => f.id === relationship.factionId);
    if (!relatedFaction) continue;

    const effect = relationship.reputationEffect;
    if (effect === 0) continue;

    const relatedChange = Math.round(amount * effect);
    if (relatedChange !== 0) {
      changes.push({
        factionId: relationship.factionId,
        amount: relatedChange
      });
    }
  }

  return changes;
}

/**
 * Get faction standing description
 * @param {number} reputation - Reputation value
 * @returns {string} Standing description key
 */
export function getStandingDescription(reputation) {
  if (reputation <= -75) return "hostile";
  if (reputation <= -50) return "hated";
  if (reputation <= -25) return "unfriendly";
  if (reputation < 50) return "neutral";
  if (reputation < 150) return "friendly";
  if (reputation < 300) return "trusted";
  if (reputation < 500) return "honored";
  return "exalted";
}

/**
 * Validate faction data
 * @param {object} faction - Faction data
 * @returns {object} {valid: boolean, errors: string[]}
 */
export function validateFaction(faction) {
  const errors = [];

  if (!faction.id) errors.push("Faction ID is required");
  if (!faction.name?.trim()) errors.push("Faction name is required");

  if (faction.ranks?.length === 0) {
    errors.push("Faction must have at least one rank");
  }

  // Check rank ordering
  const rankOrders = faction.ranks?.map(r => r.order) || [];
  const uniqueOrders = new Set(rankOrders);
  if (rankOrders.length !== uniqueOrders.size) {
    errors.push("Rank orders must be unique");
  }

  // Check faction relationships reference valid factions
  // (Would need faction list to validate)

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Faction templates for quick creation
 */
export const FactionTemplates = {
  adventurers_guild: {
    name: "Adventurer's Guild",
    description: "A professional organization for adventurers seeking quests and glory.",
    color: "#ffd700",
    ranks: createDefaultRanks(),
    hostileThreshold: -100,
    bountyEnabled: false
  },

  thieves_guild: {
    name: "Thieves Guild",
    description: "A shadowy organization of rogues, cutpurses, and information brokers.",
    color: "#4a4a4a",
    ranks: [
      createRank({ id: "initiate", name: "Initiate", order: 0, requirements: { reputation: 0 } }),
      createRank({ id: "footpad", name: "Footpad", order: 1, requirements: { reputation: 50 } }),
      createRank({ id: "bandit", name: "Bandit", order: 2, requirements: { reputation: 150 } }),
      createRank({ id: "prowler", name: "Prowler", order: 3, requirements: { reputation: 300 } }),
      createRank({ id: "shadowfoot", name: "Shadowfoot", order: 4, requirements: { reputation: 600 } }),
      createRank({ id: "master_thief", name: "Master Thief", order: 5, requirements: { reputation: 1000 } })
    ],
    hostileThreshold: -75,
    bountyEnabled: true
  },

  merchant_consortium: {
    name: "Merchant Consortium",
    description: "A powerful trade organization controlling commerce in the region.",
    color: "#4caf50",
    ranks: [
      createRank({ id: "associate", name: "Associate", order: 0, requirements: { reputation: 0 }, benefits: { priceDiscount: 0 } }),
      createRank({ id: "trader", name: "Trader", order: 1, requirements: { reputation: 100 }, benefits: { priceDiscount: 0.05 } }),
      createRank({ id: "merchant", name: "Merchant", order: 2, requirements: { reputation: 300 }, benefits: { priceDiscount: 0.1 } }),
      createRank({ id: "magnate", name: "Magnate", order: 3, requirements: { reputation: 600 }, benefits: { priceDiscount: 0.15 } }),
      createRank({ id: "tycoon", name: "Tycoon", order: 4, requirements: { reputation: 1000 }, benefits: { priceDiscount: 0.2 } })
    ],
    hostileThreshold: -50,
    bountyEnabled: false
  },

  city_watch: {
    name: "City Watch",
    description: "The official law enforcement and military organization of the city.",
    color: "#2196f3",
    ranks: [
      createRank({ id: "citizen", name: "Citizen", order: 0, requirements: { reputation: 0 } }),
      createRank({ id: "ally", name: "Ally", order: 1, requirements: { reputation: 100 } }),
      createRank({ id: "deputy", name: "Deputy", order: 2, requirements: { reputation: 300 } }),
      createRank({ id: "sergeant", name: "Sergeant", order: 3, requirements: { reputation: 600 } }),
      createRank({ id: "captain", name: "Captain", order: 4, requirements: { reputation: 1000 } })
    ],
    hostileThreshold: -25,
    attackOnSight: true,
    bountyEnabled: true
  },

  mages_college: {
    name: "Mage's College",
    description: "An institution dedicated to the study and practice of arcane magic.",
    color: "#9c27b0",
    ranks: [
      createRank({ id: "novice", name: "Novice", order: 0, requirements: { reputation: 0 } }),
      createRank({ id: "apprentice", name: "Apprentice", order: 1, requirements: { reputation: 100 } }),
      createRank({ id: "journeyman", name: "Journeyman", order: 2, requirements: { reputation: 250 } }),
      createRank({ id: "adept", name: "Adept", order: 3, requirements: { reputation: 500 } }),
      createRank({ id: "magister", name: "Magister", order: 4, requirements: { reputation: 800 } }),
      createRank({ id: "archmage", name: "Archmage", order: 5, requirements: { reputation: 1500 } })
    ],
    hostileThreshold: -50,
    bountyEnabled: false
  },

  blank: {
    name: "New Faction",
    description: "",
    color: "#7c4dff",
    ranks: createDefaultRanks()
  }
};

/**
 * Create a faction from a template
 * @param {string} templateName - Template name
 * @param {object} overrides - Data overrides
 * @returns {object}
 */
export function createFactionFromTemplate(templateName, overrides = {}) {
  const template = FactionTemplates[templateName] || FactionTemplates.blank;
  return createFaction({
    ...template,
    ...overrides,
    ranks: overrides.ranks || template.ranks.map(r => ({ ...r, id: r.id || generateId() }))
  });
}
