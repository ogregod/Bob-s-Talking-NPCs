/**
 * Bob's Talking NPCs - Bounty & Crime Data Model
 * Defines the structure for crime tracking, bounties, and law enforcement
 */

import { MODULE_ID } from "../module.mjs";
import { generateId } from "../utils/helpers.mjs";

/**
 * Crime type enum
 */
export const CrimeType = Object.freeze({
  THEFT: "theft",
  PICKPOCKET: "pickpocket",
  ASSAULT: "assault",
  MURDER: "murder",
  TRESPASSING: "trespassing",
  SMUGGLING: "smuggling",
  VANDALISM: "vandalism",
  FRAUD: "fraud",
  ESCAPE: "escape",
  RESISTING_ARREST: "resistingArrest",
  CUSTOM: "custom"
});

/**
 * Bounty status enum
 */
export const BountyStatus = Object.freeze({
  ACTIVE: "active",
  PAID: "paid",
  SERVED: "served",
  PARDONED: "pardoned",
  EXPIRED: "expired"
});

/**
 * Witness type enum
 */
export const WitnessType = Object.freeze({
  VICTIM: "victim",
  BYSTANDER: "bystander",
  GUARD: "guard",
  NPC: "npc",
  PLAYER: "player"
});

/**
 * Punishment type enum
 */
export const PunishmentType = Object.freeze({
  FINE: "fine",
  JAIL: "jail",
  COMMUNITY_SERVICE: "communityService",
  EXECUTION: "execution",
  BANISHMENT: "banishment",
  CONFISCATION: "confiscation",
  CUSTOM: "custom"
});

/**
 * Default crime bounty values
 */
export const DefaultCrimeBounties = Object.freeze({
  [CrimeType.THEFT]: 50,
  [CrimeType.PICKPOCKET]: 25,
  [CrimeType.ASSAULT]: 100,
  [CrimeType.MURDER]: 1000,
  [CrimeType.TRESPASSING]: 20,
  [CrimeType.SMUGGLING]: 200,
  [CrimeType.VANDALISM]: 30,
  [CrimeType.FRAUD]: 150,
  [CrimeType.ESCAPE]: 200,
  [CrimeType.RESISTING_ARREST]: 150
});

/**
 * Create a witness record
 * @param {object} data - Witness data
 * @returns {object}
 */
export function createWitness(data = {}) {
  return {
    id: data.id || generateId(),
    type: data.type || WitnessType.BYSTANDER,
    actorUuid: data.actorUuid || null,
    name: data.name || "Unknown",
    canTestify: data.canTestify ?? true,
    bribed: data.bribed ?? false,
    silenced: data.silenced ?? false,  // Intimidated, killed, etc.
    credibility: data.credibility ?? 1.0  // Affects testimony weight
  };
}

/**
 * Create a crime record
 * @param {object} data - Crime data
 * @returns {object}
 */
export function createCrime(data = {}) {
  return {
    id: data.id || generateId(),
    type: data.type || CrimeType.CUSTOM,
    customType: data.customType || null,

    // Who committed the crime
    perpetratorUuid: data.perpetratorUuid || null,
    perpetratorName: data.perpetratorName || "Unknown",

    // Where and when
    timestamp: data.timestamp || Date.now(),
    sceneId: data.sceneId || null,
    location: data.location || null,  // Text description
    regionId: data.regionId || null,  // For jurisdiction

    // Victim (if applicable)
    victimUuid: data.victimUuid || null,
    victimName: data.victimName || null,

    // Evidence
    witnesses: (data.witnesses || []).map(w => createWitness(w)),
    caught: data.caught ?? false,
    caughtBy: data.caughtBy || null,
    evidence: data.evidence || [],  // Array of evidence descriptions

    // Value assessment
    stolenValue: data.stolenValue ?? 0,
    damageValue: data.damageValue ?? 0,
    baseBounty: data.baseBounty ?? 0,
    calculatedBounty: data.calculatedBounty ?? 0,

    // Status
    reported: data.reported ?? false,
    reportedAt: data.reportedAt || null,
    reportedBy: data.reportedBy || null,

    // Notes
    description: data.description || "",
    gmNotes: data.gmNotes || ""
  };
}

/**
 * Create a bounty record
 * @param {object} data - Bounty data
 * @returns {object}
 */
export function createBounty(data = {}) {
  return {
    id: data.id || generateId(),
    status: data.status || BountyStatus.ACTIVE,

    // Target
    targetActorUuid: data.targetActorUuid || null,
    targetName: data.targetName || "Unknown",

    // Jurisdiction
    regionId: data.regionId || null,
    factionId: data.factionId || null,  // Law enforcement faction
    jurisdictionName: data.jurisdictionName || "Unknown",

    // Bounty amount
    amount: data.amount ?? 0,

    // Associated crimes
    crimes: data.crimes || [],  // Array of crime IDs

    // Timeline
    issuedAt: data.issuedAt || Date.now(),
    expiresAt: data.expiresAt || null,  // null = never expires
    resolvedAt: data.resolvedAt || null,

    // Resolution
    resolution: {
      type: data.resolution?.type || null,  // paid, served, pardoned, etc.
      resolvedBy: data.resolution?.resolvedBy || null,
      amountPaid: data.resolution?.amountPaid ?? 0,
      jailTime: data.resolution?.jailTime ?? 0,  // In-game hours
      notes: data.resolution?.notes || ""
    },

    // Wanted poster
    poster: {
      enabled: data.poster?.enabled ?? false,
      description: data.poster?.description || "",
      reward: data.poster?.reward ?? 0,
      deadOrAlive: data.poster?.deadOrAlive ?? false
    },

    // Escalation tracking
    arrestsResisted: data.arrestsResisted ?? 0,
    escapeAttempts: data.escapeAttempts ?? 0,

    // Metadata
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  };
}

/**
 * Create a region/jurisdiction configuration
 * @param {object} data - Region data
 * @returns {object}
 */
export function createJurisdiction(data = {}) {
  return {
    id: data.id || generateId(),
    name: data.name || "New Region",
    description: data.description || "",

    // Scenes in this jurisdiction
    sceneIds: data.sceneIds || [],

    // Law enforcement
    enforcementFactionId: data.enforcementFactionId || null,
    guardActorUuids: data.guardActorUuids || [],

    // Crime configuration
    crimeConfig: {
      enabled: data.crimeConfig?.enabled ?? true,

      // Bounty multipliers per crime type
      bountyMultipliers: {
        [CrimeType.THEFT]: data.crimeConfig?.bountyMultipliers?.[CrimeType.THEFT] ?? 1.0,
        [CrimeType.PICKPOCKET]: data.crimeConfig?.bountyMultipliers?.[CrimeType.PICKPOCKET] ?? 1.0,
        [CrimeType.ASSAULT]: data.crimeConfig?.bountyMultipliers?.[CrimeType.ASSAULT] ?? 1.0,
        [CrimeType.MURDER]: data.crimeConfig?.bountyMultipliers?.[CrimeType.MURDER] ?? 1.0,
        [CrimeType.TRESPASSING]: data.crimeConfig?.bountyMultipliers?.[CrimeType.TRESPASSING] ?? 1.0,
        [CrimeType.SMUGGLING]: data.crimeConfig?.bountyMultipliers?.[CrimeType.SMUGGLING] ?? 1.0,
        [CrimeType.VANDALISM]: data.crimeConfig?.bountyMultipliers?.[CrimeType.VANDALISM] ?? 1.0,
        [CrimeType.FRAUD]: data.crimeConfig?.bountyMultipliers?.[CrimeType.FRAUD] ?? 1.0,
        [CrimeType.ESCAPE]: data.crimeConfig?.bountyMultipliers?.[CrimeType.ESCAPE] ?? 1.0,
        [CrimeType.RESISTING_ARREST]: data.crimeConfig?.bountyMultipliers?.[CrimeType.RESISTING_ARREST] ?? 1.0
      },

      // Stolen value multiplier for bounty
      stolenValueMultiplier: data.crimeConfig?.stolenValueMultiplier ?? 1.0,

      // Witness requirements
      requireWitness: data.crimeConfig?.requireWitness ?? true,
      minimumWitnesses: data.crimeConfig?.minimumWitnesses ?? 1
    },

    // Punishment configuration
    punishments: {
      [CrimeType.THEFT]: data.punishments?.[CrimeType.THEFT] || [
        { type: PunishmentType.FINE, multiplier: 2 },
        { type: PunishmentType.JAIL, hours: 24 }
      ],
      [CrimeType.PICKPOCKET]: data.punishments?.[CrimeType.PICKPOCKET] || [
        { type: PunishmentType.FINE, multiplier: 1.5 }
      ],
      [CrimeType.ASSAULT]: data.punishments?.[CrimeType.ASSAULT] || [
        { type: PunishmentType.FINE, multiplier: 1 },
        { type: PunishmentType.JAIL, hours: 48 }
      ],
      [CrimeType.MURDER]: data.punishments?.[CrimeType.MURDER] || [
        { type: PunishmentType.JAIL, hours: 168 },
        { type: PunishmentType.EXECUTION, condition: "repeated" }
      ],
      [CrimeType.TRESPASSING]: data.punishments?.[CrimeType.TRESPASSING] || [
        { type: PunishmentType.FINE, multiplier: 1 }
      ]
    },

    // Guard behavior
    guardBehavior: {
      attackOnSight: data.guardBehavior?.attackOnSight ?? false,
      attackOnSightThreshold: data.guardBehavior?.attackOnSightThreshold ?? 5000,
      pursuitDistance: data.guardBehavior?.pursuitDistance ?? 100,
      callReinforcements: data.guardBehavior?.callReinforcements ?? true,
      arrestDialogueId: data.guardBehavior?.arrestDialogueId || null
    },

    // Bounty decay
    bountyDecay: {
      enabled: data.bountyDecay?.enabled ?? false,
      amountPerDay: data.bountyDecay?.amountPerDay ?? 10,
      minimumAge: data.bountyDecay?.minimumAge ?? 7  // Days before decay starts
    },

    // Metadata
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  };
}

/**
 * Create player criminal record
 * @param {object} data - Record data
 * @returns {object}
 */
export function createCriminalRecord(data = {}) {
  return {
    playerActorUuid: data.playerActorUuid || null,

    // Crime history
    crimes: data.crimes || [],  // Array of crime IDs
    totalCrimes: data.totalCrimes ?? 0,

    // Bounty tracking per region
    bounties: data.bounties || {},  // {regionId: bountyId}
    totalBountyPaid: data.totalBountyPaid ?? 0,
    totalJailTime: data.totalJailTime ?? 0,

    // Statistics
    stats: {
      thefts: data.stats?.thefts ?? 0,
      assaults: data.stats?.assaults ?? 0,
      murders: data.stats?.murders ?? 0,
      arrestsEvaded: data.stats?.arrestsEvaded ?? 0,
      jailbreaks: data.stats?.jailbreaks ?? 0,
      pardonsReceived: data.stats?.pardonsReceived ?? 0,
      finesPaid: data.stats?.finesPaid ?? 0
    },

    // Current status
    isJailed: data.isJailed ?? false,
    jailRegionId: data.jailRegionId || null,
    jailReleaseTime: data.jailReleaseTime || null,

    // Reputation with law
    lawReputation: data.lawReputation ?? 0,  // Negative = notorious

    // Metadata
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  };
}

/**
 * Calculate bounty for a crime
 * @param {object} crime - Crime data
 * @param {object} jurisdiction - Jurisdiction config
 * @returns {number} Calculated bounty amount
 */
export function calculateBounty(crime, jurisdiction) {
  // Base bounty for crime type
  let bounty = DefaultCrimeBounties[crime.type] || 50;

  // Apply jurisdiction multiplier
  const multiplier = jurisdiction.crimeConfig.bountyMultipliers[crime.type] || 1.0;
  bounty *= multiplier;

  // Add stolen value if applicable
  if (crime.stolenValue > 0) {
    bounty += crime.stolenValue * jurisdiction.crimeConfig.stolenValueMultiplier;
  }

  // Add damage value if applicable
  if (crime.damageValue > 0) {
    bounty += crime.damageValue * 0.5;
  }

  // Increase for being caught in the act
  if (crime.caught) {
    bounty *= 1.2;
  }

  // Increase based on witness count
  const witnessCount = crime.witnesses.filter(w => w.canTestify && !w.silenced).length;
  if (witnessCount > 1) {
    bounty *= 1 + (witnessCount - 1) * 0.1;  // 10% per additional witness
  }

  return Math.round(bounty);
}

/**
 * Check if crime was witnessed
 * @param {object} crime - Crime data
 * @param {object} jurisdiction - Jurisdiction config
 * @returns {object} {witnessed: boolean, validWitnesses: number}
 */
export function checkWitnessed(crime, jurisdiction) {
  const validWitnesses = crime.witnesses.filter(w =>
    w.canTestify && !w.silenced && !w.bribed
  );

  const required = jurisdiction.crimeConfig.minimumWitnesses;
  const witnessed = !jurisdiction.crimeConfig.requireWitness ||
    validWitnesses.length >= required;

  return {
    witnessed,
    validWitnesses: validWitnesses.length,
    required
  };
}

/**
 * Add bounty for region (creates or updates)
 * @param {object} criminalRecord - Player criminal record
 * @param {string} regionId - Region ID
 * @param {number} amount - Bounty amount to add
 * @param {string} crimeId - Crime ID
 * @returns {object} Updated criminal record
 */
export function addBounty(criminalRecord, regionId, amount, crimeId) {
  const existingBountyId = criminalRecord.bounties[regionId];

  const newCrimes = [...criminalRecord.crimes];
  if (crimeId && !newCrimes.includes(crimeId)) {
    newCrimes.push(crimeId);
  }

  return {
    ...criminalRecord,
    crimes: newCrimes,
    totalCrimes: criminalRecord.totalCrimes + 1,
    bounties: {
      ...criminalRecord.bounties,
      [regionId]: existingBountyId || generateId()
    },
    updatedAt: Date.now()
  };
}

/**
 * Pay off bounty
 * @param {object} bounty - Bounty data
 * @param {number} amountPaid - Amount being paid
 * @returns {object} Updated bounty
 */
export function payBounty(bounty, amountPaid) {
  const remainingAmount = bounty.amount - amountPaid;

  if (remainingAmount <= 0) {
    return {
      ...bounty,
      status: BountyStatus.PAID,
      amount: 0,
      resolvedAt: Date.now(),
      resolution: {
        ...bounty.resolution,
        type: "paid",
        amountPaid: bounty.amount
      },
      updatedAt: Date.now()
    };
  }

  return {
    ...bounty,
    amount: remainingAmount,
    resolution: {
      ...bounty.resolution,
      amountPaid: (bounty.resolution?.amountPaid || 0) + amountPaid
    },
    updatedAt: Date.now()
  };
}

/**
 * Serve jail time
 * @param {object} bounty - Bounty data
 * @param {number} hoursServed - Hours served
 * @returns {object} Updated bounty
 */
export function serveJailTime(bounty, hoursServed) {
  return {
    ...bounty,
    status: BountyStatus.SERVED,
    resolvedAt: Date.now(),
    resolution: {
      ...bounty.resolution,
      type: "served",
      jailTime: hoursServed
    },
    updatedAt: Date.now()
  };
}

/**
 * Pardon bounty
 * @param {object} bounty - Bounty data
 * @param {string} pardonedBy - Who granted the pardon
 * @param {string} reason - Reason for pardon
 * @returns {object} Updated bounty
 */
export function pardonBounty(bounty, pardonedBy, reason = "") {
  return {
    ...bounty,
    status: BountyStatus.PARDONED,
    amount: 0,
    resolvedAt: Date.now(),
    resolution: {
      ...bounty.resolution,
      type: "pardoned",
      resolvedBy: pardonedBy,
      notes: reason
    },
    updatedAt: Date.now()
  };
}

/**
 * Apply bounty decay
 * @param {object} bounty - Bounty data
 * @param {object} jurisdiction - Jurisdiction config
 * @returns {object} Updated bounty
 */
export function applyBountyDecay(bounty, jurisdiction) {
  if (!jurisdiction.bountyDecay.enabled) return bounty;
  if (bounty.status !== BountyStatus.ACTIVE) return bounty;

  const now = Date.now();
  const ageInDays = (now - bounty.issuedAt) / (24 * 60 * 60 * 1000);

  if (ageInDays < jurisdiction.bountyDecay.minimumAge) return bounty;

  const daysToDecay = ageInDays - jurisdiction.bountyDecay.minimumAge;
  const decay = Math.floor(daysToDecay) * jurisdiction.bountyDecay.amountPerDay;

  const newAmount = Math.max(0, bounty.amount - decay);

  if (newAmount === 0) {
    return {
      ...bounty,
      status: BountyStatus.EXPIRED,
      amount: 0,
      resolvedAt: now,
      resolution: {
        ...bounty.resolution,
        type: "expired"
      },
      updatedAt: now
    };
  }

  return {
    ...bounty,
    amount: newAmount,
    updatedAt: now
  };
}

/**
 * Get total bounty for a player across all regions
 * @param {object} criminalRecord - Player criminal record
 * @param {object} bountyData - Bounty storage {bountyId: bounty}
 * @returns {number} Total bounty amount
 */
export function getTotalBounty(criminalRecord, bountyData) {
  let total = 0;

  for (const bountyId of Object.values(criminalRecord.bounties)) {
    const bounty = bountyData[bountyId];
    if (bounty && bounty.status === BountyStatus.ACTIVE) {
      total += bounty.amount;
    }
  }

  return total;
}

/**
 * Get bounty status display
 * @param {number} bountyAmount - Current bounty amount
 * @returns {object} {level, name, color, icon}
 */
export function getBountyStatus(bountyAmount) {
  if (bountyAmount <= 0) {
    return { level: "clear", name: "Clear", color: "#4caf50", icon: "fa-check" };
  }
  if (bountyAmount < 100) {
    return { level: "minor", name: "Minor Offender", color: "#ffeb3b", icon: "fa-exclamation" };
  }
  if (bountyAmount < 500) {
    return { level: "wanted", name: "Wanted", color: "#ff9800", icon: "fa-user-secret" };
  }
  if (bountyAmount < 1000) {
    return { level: "criminal", name: "Criminal", color: "#f44336", icon: "fa-skull" };
  }
  if (bountyAmount < 5000) {
    return { level: "notorious", name: "Notorious", color: "#9c27b0", icon: "fa-skull-crossbones" };
  }
  return { level: "public_enemy", name: "Public Enemy", color: "#000000", icon: "fa-crown" };
}

/**
 * Validate bounty data
 * @param {object} bounty - Bounty data
 * @returns {object} {valid: boolean, errors: string[]}
 */
export function validateBounty(bounty) {
  const errors = [];

  if (!bounty.id) errors.push("Bounty ID is required");
  if (!bounty.targetActorUuid && !bounty.targetName) {
    errors.push("Target actor or name is required");
  }
  if (bounty.amount < 0) errors.push("Bounty amount cannot be negative");
  if (!Object.values(BountyStatus).includes(bounty.status)) {
    errors.push(`Invalid bounty status: ${bounty.status}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Jurisdiction templates
 */
export const JurisdictionTemplates = {
  city: {
    name: "City",
    crimeConfig: {
      enabled: true,
      requireWitness: true,
      minimumWitnesses: 1,
      stolenValueMultiplier: 1.0
    },
    guardBehavior: {
      attackOnSight: false,
      attackOnSightThreshold: 5000,
      callReinforcements: true
    },
    bountyDecay: {
      enabled: true,
      amountPerDay: 5,
      minimumAge: 30
    }
  },

  lawless: {
    name: "Lawless Territory",
    crimeConfig: {
      enabled: false
    },
    guardBehavior: {
      attackOnSight: false
    },
    bountyDecay: {
      enabled: false
    }
  },

  strict: {
    name: "Strict Region",
    crimeConfig: {
      enabled: true,
      requireWitness: false,
      bountyMultipliers: {
        [CrimeType.THEFT]: 1.5,
        [CrimeType.ASSAULT]: 2.0,
        [CrimeType.MURDER]: 2.0
      },
      stolenValueMultiplier: 2.0
    },
    guardBehavior: {
      attackOnSight: true,
      attackOnSightThreshold: 1000,
      callReinforcements: true
    },
    bountyDecay: {
      enabled: false
    }
  },

  frontier: {
    name: "Frontier",
    crimeConfig: {
      enabled: true,
      requireWitness: true,
      minimumWitnesses: 2,
      bountyMultipliers: {
        [CrimeType.THEFT]: 0.5,
        [CrimeType.ASSAULT]: 0.5,
        [CrimeType.MURDER]: 0.75
      },
      stolenValueMultiplier: 0.5
    },
    guardBehavior: {
      attackOnSight: false,
      callReinforcements: false
    },
    bountyDecay: {
      enabled: true,
      amountPerDay: 10,
      minimumAge: 7
    }
  }
};

/**
 * Create jurisdiction from template
 * @param {string} templateName - Template name
 * @param {object} overrides - Data overrides
 * @returns {object}
 */
export function createJurisdictionFromTemplate(templateName, overrides = {}) {
  const template = JurisdictionTemplates[templateName] || JurisdictionTemplates.city;
  return createJurisdiction({
    ...template,
    ...overrides
  });
}
