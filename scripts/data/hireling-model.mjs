/**
 * Bob's Talking NPCs - Hireling & Mount Data Model
 * Defines the structure for hired companions and mounts
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";
import { generateId } from "../utils/helpers.mjs";

/**
 * Hireling type enum
 */
export const HirelingType = Object.freeze({
  COMBAT: "combat",
  PORTER: "porter",
  GUIDE: "guide",
  HEALER: "healer",
  CRAFTSMAN: "craftsman",
  SCOUT: "scout",
  GUARD: "guard",
  SERVANT: "servant",
  SPECIALIST: "specialist",
  CUSTOM: "custom"
});

/**
 * Mount type enum
 */
export const MountType = Object.freeze({
  HORSE: "horse",
  PONY: "pony",
  WARHORSE: "warhorse",
  MULE: "mule",
  CAMEL: "camel",
  ELEPHANT: "elephant",
  EXOTIC: "exotic",
  FLYING: "flying",
  AQUATIC: "aquatic",
  CUSTOM: "custom"
});

/**
 * Contract type enum
 */
export const ContractType = Object.freeze({
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  QUEST: "quest",
  PERMANENT: "permanent",
  CUSTOM: "custom"
});

/**
 * Hireling status enum
 */
export const HirelingStatus = Object.freeze({
  AVAILABLE: "available",
  HIRED: "hired",
  WORKING: "working",
  INJURED: "injured",
  UNAVAILABLE: "unavailable",
  DEAD: "dead",
  DISMISSED: "dismissed"
});

/**
 * Loyalty level enum
 */
export const LoyaltyLevel = Object.freeze({
  DISLOYAL: "disloyal",
  RELUCTANT: "reluctant",
  NEUTRAL: "neutral",
  LOYAL: "loyal",
  DEVOTED: "devoted"
});

/**
 * Create hireling skills configuration
 * @param {object} data - Skills data
 * @returns {object}
 */
export function createHirelingSkills(data = {}) {
  return {
    combat: data.combat ?? 0,      // Combat effectiveness (0-10)
    stealth: data.stealth ?? 0,    // Stealth capability
    survival: data.survival ?? 0,  // Wilderness survival
    knowledge: data.knowledge ?? 0, // Lore/information
    social: data.social ?? 0,      // Social interactions
    crafting: data.crafting ?? 0,  // Crafting ability
    magic: data.magic ?? 0,        // Magical capability
    healing: data.healing ?? 0,    // Medical/healing
    custom: data.custom || {}      // Custom skill ratings
  };
}

/**
 * Create hireling contract terms
 * @param {object} data - Contract data
 * @returns {object}
 */
export function createContract(data = {}) {
  return {
    id: data.id || generateId(),
    type: data.type || ContractType.DAILY,

    // Payment
    wage: data.wage ?? 10,  // Gold per period
    paymentSchedule: data.paymentSchedule || "upfront",  // upfront, end, split
    lastPayment: data.lastPayment || null,
    nextPaymentDue: data.nextPaymentDue || null,
    totalPaid: data.totalPaid ?? 0,
    owedAmount: data.owedAmount ?? 0,

    // Duration
    startDate: data.startDate || null,
    endDate: data.endDate || null,  // null for permanent
    daysRemaining: data.daysRemaining ?? 0,

    // Quest-based contract
    questId: data.questId || null,
    questCompleted: data.questCompleted ?? false,

    // Terms
    terms: {
      combatRequired: data.terms?.combatRequired ?? false,
      dangerPay: data.terms?.dangerPay ?? 0,  // Extra per combat
      deathBenefit: data.terms?.deathBenefit ?? 0,  // Payment to next of kin
      equipmentProvided: data.terms?.equipmentProvided ?? false,
      lodgingProvided: data.terms?.lodgingProvided ?? false,
      foodProvided: data.terms?.foodProvided ?? false,
      lootShare: data.terms?.lootShare ?? 0,  // Percentage of loot
      custom: data.terms?.custom || []
    },

    // Renewal
    autoRenew: data.autoRenew ?? false,
    renewalTerms: data.renewalTerms || null
  };
}

/**
 * Create hireling loyalty tracking
 * @param {object} data - Loyalty data
 * @returns {object}
 */
export function createLoyaltyTracker(data = {}) {
  return {
    value: data.value ?? 50,  // 0-100 scale
    level: data.level || LoyaltyLevel.NEUTRAL,

    // Thresholds
    thresholds: {
      [LoyaltyLevel.DISLOYAL]: data.thresholds?.[LoyaltyLevel.DISLOYAL] ?? 0,
      [LoyaltyLevel.RELUCTANT]: data.thresholds?.[LoyaltyLevel.RELUCTANT] ?? 20,
      [LoyaltyLevel.NEUTRAL]: data.thresholds?.[LoyaltyLevel.NEUTRAL] ?? 40,
      [LoyaltyLevel.LOYAL]: data.thresholds?.[LoyaltyLevel.LOYAL] ?? 60,
      [LoyaltyLevel.DEVOTED]: data.thresholds?.[LoyaltyLevel.DEVOTED] ?? 80
    },

    // History
    history: data.history || [],  // Array of {timestamp, change, reason}

    // Modifiers
    modifiers: {
      paidOnTime: data.modifiers?.paidOnTime ?? 5,
      latePay: data.modifiers?.latePay ?? -10,
      noPay: data.modifiers?.noPay ?? -25,
      combatVictory: data.modifiers?.combatVictory ?? 2,
      combatDefeat: data.modifiers?.combatDefeat ?? -3,
      injuryNotTreated: data.modifiers?.injuryNotTreated ?? -15,
      goodTreatment: data.modifiers?.goodTreatment ?? 3,
      badTreatment: data.modifiers?.badTreatment ?? -10,
      betrayal: data.modifiers?.betrayal ?? -50
    }
  };
}

/**
 * Create a hireling definition
 * @param {object} data - Hireling data
 * @returns {object}
 */
export function createHireling(data = {}) {
  return {
    id: data.id || generateId(),
    actorUuid: data.actorUuid || null,  // Link to Foundry actor
    name: data.name || "Hireling",
    type: data.type || HirelingType.COMBAT,
    customType: data.customType || null,
    status: data.status || HirelingStatus.AVAILABLE,

    // Description
    description: data.description || "",
    backstory: data.backstory || "",
    portrait: data.portrait || null,

    // Stats
    level: data.level ?? 1,
    skills: createHirelingSkills(data.skills || {}),

    // Equipment
    equipment: data.equipment || [],  // Array of item UUIDs
    providedEquipment: data.providedEquipment || [],  // Equipment given by employer

    // Recruitment
    recruiter: {
      npcActorUuid: data.recruiter?.npcActorUuid || null,
      location: data.recruiter?.location || null,
      sceneId: data.recruiter?.sceneId || null
    },

    // Hiring cost
    hireCost: {
      base: data.hireCost?.base ?? 50,
      perLevel: data.hireCost?.perLevel ?? 25,
      minimumDays: data.hireCost?.minimumDays ?? 1,
      deposit: data.hireCost?.deposit ?? 0
    },

    // Current employment
    employer: data.employer || null,  // Player actor UUID
    contract: data.contract ? createContract(data.contract) : null,
    loyalty: createLoyaltyTracker(data.loyalty || {}),

    // Combat settings (if applicable)
    combat: {
      willFight: data.combat?.willFight ?? true,
      fleeThreshold: data.combat?.fleeThreshold ?? 0.25,  // HP percentage
      protectsEmployer: data.combat?.protectsEmployer ?? true,
      combatStyle: data.combat?.combatStyle || "melee",
      preferredTargets: data.combat?.preferredTargets || []
    },

    // Inventory (for porters)
    inventory: {
      enabled: data.inventory?.enabled ?? false,
      maxSlots: data.inventory?.maxSlots ?? 0,
      maxWeight: data.inventory?.maxWeight ?? 0,
      items: data.inventory?.items || []  // Array of item UUIDs
    },

    // Special abilities
    abilities: data.abilities || [],  // Array of ability descriptions

    // Requirements to hire
    requirements: {
      playerLevel: data.requirements?.playerLevel ?? 0,
      reputation: data.requirements?.reputation ?? 0,
      factionId: data.requirements?.factionId || null,
      factionRank: data.requirements?.factionRank || null,
      questCompleted: data.requirements?.questCompleted || null,
      custom: data.requirements?.custom || []
    },

    // Availability
    availability: {
      maxConcurrent: data.availability?.maxConcurrent ?? 1,  // How many can hire at once
      respawns: data.availability?.respawns ?? true,
      respawnDays: data.availability?.respawnDays ?? 7,
      unique: data.availability?.unique ?? false
    },

    // History
    employmentHistory: data.employmentHistory || [],  // Past contracts

    // Metadata
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  };
}

/**
 * Create mount stats
 * @param {object} data - Stats data
 * @returns {object}
 */
export function createMountStats(data = {}) {
  return {
    speed: data.speed ?? 60,           // Base movement speed
    carryCapacity: data.carryCapacity ?? 480,  // Pounds
    passengers: data.passengers ?? 1,   // Number of riders
    armor: data.armor ?? 0,            // Natural armor bonus
    stamina: data.stamina ?? 100,      // For travel exhaustion
    swim: data.swim ?? false,
    fly: data.fly ?? false,
    flySpeed: data.flySpeed ?? 0,
    climbSpeed: data.climbSpeed ?? 0
  };
}

/**
 * Create a mount definition
 * @param {object} data - Mount data
 * @returns {object}
 */
export function createMount(data = {}) {
  return {
    id: data.id || generateId(),
    actorUuid: data.actorUuid || null,
    name: data.name || "Mount",
    type: data.type || MountType.HORSE,
    customType: data.customType || null,
    status: data.status || HirelingStatus.AVAILABLE,

    // Description
    description: data.description || "",
    portrait: data.portrait || null,
    tokenImage: data.tokenImage || null,

    // Stats
    stats: createMountStats(data.stats || {}),

    // Training level
    training: {
      level: data.training?.level ?? 0,  // 0 = untrained, 5 = war-trained
      tricks: data.training?.tricks || [],
      combatTrained: data.training?.combatTrained ?? false,
      mountedCombat: data.training?.mountedCombat ?? false
    },

    // Stable/source
    stable: {
      npcActorUuid: data.stable?.npcActorUuid || null,
      location: data.stable?.location || null,
      sceneId: data.stable?.sceneId || null
    },

    // Pricing
    pricing: {
      purchase: data.pricing?.purchase ?? 75,
      rental: data.pricing?.rental ?? 5,  // Per day
      stabling: data.pricing?.stabling ?? 1,  // Per day
      deposit: data.pricing?.deposit ?? 20
    },

    // Ownership
    owner: data.owner || null,  // Player actor UUID
    isRented: data.isRented ?? false,
    rentalExpires: data.rentalExpires || null,
    stablingPaidUntil: data.stablingPaidUntil || null,

    // Equipment
    equipment: {
      saddle: data.equipment?.saddle || null,
      barding: data.equipment?.barding || null,
      saddlebags: data.equipment?.saddlebags || null,
      other: data.equipment?.other || []
    },

    // Saddlebag inventory
    saddlebags: {
      enabled: data.saddlebags?.enabled ?? false,
      maxSlots: data.saddlebags?.maxSlots ?? 0,
      maxWeight: data.saddlebags?.maxWeight ?? 0,
      items: data.saddlebags?.items || []
    },

    // Condition
    condition: {
      health: data.condition?.health ?? 100,  // Percentage
      fatigue: data.condition?.fatigue ?? 0,
      injured: data.condition?.injured ?? false,
      injuryDescription: data.condition?.injuryDescription || null
    },

    // Bonding (optional loyalty-like system)
    bonding: {
      enabled: data.bonding?.enabled ?? false,
      value: data.bonding?.value ?? 0,
      maxValue: data.bonding?.maxValue ?? 100,
      benefits: data.bonding?.benefits || []
    },

    // Requirements to purchase/rent
    requirements: {
      playerLevel: data.requirements?.playerLevel ?? 0,
      ridingProficiency: data.requirements?.ridingProficiency ?? false,
      factionId: data.requirements?.factionId || null,
      custom: data.requirements?.custom || []
    },

    // Metadata
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  };
}

/**
 * Create stable master configuration
 * @param {object} data - Stable data
 * @returns {object}
 */
export function createStableConfig(data = {}) {
  return {
    npcActorUuid: data.npcActorUuid || null,
    name: data.name || "Stable",

    // Available mounts for sale/rent
    mountsForSale: data.mountsForSale || [],   // Array of mount IDs
    mountsForRent: data.mountsForRent || [],   // Array of mount IDs

    // Stabled mounts (player-owned)
    stabledMounts: data.stabledMounts || {},  // {playerUuid: [mountIds]}

    // Pricing
    pricing: {
      stablingPerDay: data.pricing?.stablingPerDay ?? 1,
      feedingPerDay: data.pricing?.feedingPerDay ?? 0.5,
      groomingPerDay: data.pricing?.groomingPerDay ?? 0.5,
      healing: data.pricing?.healing ?? 10,
      training: data.pricing?.training ?? 50  // Per level
    },

    // Services
    services: {
      selling: data.services?.selling ?? true,
      renting: data.services?.renting ?? true,
      stabling: data.services?.stabling ?? true,
      healing: data.services?.healing ?? true,
      training: data.services?.training ?? false,
      breeding: data.services?.breeding ?? false
    },

    // Capacity
    maxCapacity: data.maxCapacity ?? 20,
    currentOccupancy: data.currentOccupancy ?? 0,

    // Metadata
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  };
}

/**
 * Get loyalty level for value
 * @param {number} value - Loyalty value (0-100)
 * @param {object} thresholds - Loyalty thresholds
 * @returns {string} Loyalty level
 */
export function getLoyaltyLevel(value, thresholds) {
  const levels = [
    LoyaltyLevel.DEVOTED,
    LoyaltyLevel.LOYAL,
    LoyaltyLevel.NEUTRAL,
    LoyaltyLevel.RELUCTANT,
    LoyaltyLevel.DISLOYAL
  ];

  for (const level of levels) {
    if (value >= thresholds[level]) {
      return level;
    }
  }

  return LoyaltyLevel.DISLOYAL;
}

/**
 * Modify loyalty value
 * @param {object} loyalty - Loyalty tracker
 * @param {number} change - Amount to change
 * @param {string} reason - Reason for change
 * @returns {object} Updated loyalty tracker
 */
export function modifyLoyalty(loyalty, change, reason = "") {
  const previousValue = loyalty.value;
  const newValue = Math.max(0, Math.min(100, previousValue + change));
  const newLevel = getLoyaltyLevel(newValue, loyalty.thresholds);

  return {
    ...loyalty,
    value: newValue,
    level: newLevel,
    history: [
      ...loyalty.history,
      {
        timestamp: Date.now(),
        change,
        previousValue,
        newValue,
        reason
      }
    ]
  };
}

/**
 * Calculate total hiring cost
 * @param {object} hireling - Hireling data
 * @param {object} contractTerms - Contract terms
 * @returns {object} {total, breakdown}
 */
export function calculateHiringCost(hireling, contractTerms) {
  const baseCost = hireling.hireCost.base + (hireling.level * hireling.hireCost.perLevel);

  let duration = 1;
  let multiplier = 1;

  switch (contractTerms.type) {
    case ContractType.DAILY:
      duration = contractTerms.days || 1;
      multiplier = 1;
      break;
    case ContractType.WEEKLY:
      duration = (contractTerms.weeks || 1) * 7;
      multiplier = 0.9;  // Weekly discount
      break;
    case ContractType.MONTHLY:
      duration = (contractTerms.months || 1) * 30;
      multiplier = 0.8;  // Monthly discount
      break;
    case ContractType.QUEST:
      duration = 1;  // Fixed fee
      multiplier = 2;  // Quest premium
      break;
    case ContractType.PERMANENT:
      duration = 1;
      multiplier = 10;  // Permanent hiring premium
      break;
  }

  const totalWage = baseCost * duration * multiplier;
  const deposit = hireling.hireCost.deposit;
  const dangerPay = contractTerms.terms?.combatRequired ? (baseCost * 0.5) : 0;

  return {
    total: Math.round(totalWage + deposit + dangerPay),
    breakdown: {
      baseWage: baseCost,
      duration,
      multiplier,
      totalWage: Math.round(totalWage),
      deposit,
      dangerPay: Math.round(dangerPay)
    }
  };
}

/**
 * Check loyalty consequences
 * @param {object} loyalty - Loyalty tracker
 * @returns {object} {willDesert, willBetray, moralePenalty}
 */
export function checkLoyaltyConsequences(loyalty) {
  return {
    willDesert: loyalty.level === LoyaltyLevel.DISLOYAL,
    willBetray: loyalty.value <= 10,
    moralePenalty: loyalty.level === LoyaltyLevel.RELUCTANT ? -2 :
      loyalty.level === LoyaltyLevel.DISLOYAL ? -5 : 0,
    combatPenalty: loyalty.value < 30 ? Math.floor((30 - loyalty.value) / 10) : 0
  };
}

/**
 * Validate hireling data
 * @param {object} hireling - Hireling data
 * @returns {object} {valid: boolean, errors: string[]}
 */
export function validateHireling(hireling) {
  const errors = [];

  if (!hireling.id) errors.push("Hireling ID is required");
  if (!hireling.name?.trim()) errors.push("Hireling name is required");
  if (!Object.values(HirelingType).includes(hireling.type)) {
    errors.push(`Invalid hireling type: ${hireling.type}`);
  }

  if (hireling.level < 0) errors.push("Level cannot be negative");
  if (hireling.hireCost.base < 0) errors.push("Base hire cost cannot be negative");

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate mount data
 * @param {object} mount - Mount data
 * @returns {object} {valid: boolean, errors: string[]}
 */
export function validateMount(mount) {
  const errors = [];

  if (!mount.id) errors.push("Mount ID is required");
  if (!mount.name?.trim()) errors.push("Mount name is required");
  if (!Object.values(MountType).includes(mount.type)) {
    errors.push(`Invalid mount type: ${mount.type}`);
  }

  if (mount.stats.speed < 0) errors.push("Speed cannot be negative");
  if (mount.stats.carryCapacity < 0) errors.push("Carry capacity cannot be negative");

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Hireling templates
 */
export const HirelingTemplates = {
  mercenary: {
    name: "Mercenary",
    type: HirelingType.COMBAT,
    level: 2,
    skills: createHirelingSkills({ combat: 6, survival: 3 }),
    hireCost: { base: 50, perLevel: 25 },
    combat: { willFight: true, fleeThreshold: 0.2 }
  },

  porter: {
    name: "Porter",
    type: HirelingType.PORTER,
    level: 1,
    skills: createHirelingSkills({ survival: 4 }),
    hireCost: { base: 10, perLevel: 5 },
    inventory: { enabled: true, maxSlots: 20, maxWeight: 200 },
    combat: { willFight: false, fleeThreshold: 0.75 }
  },

  guide: {
    name: "Guide",
    type: HirelingType.GUIDE,
    level: 1,
    skills: createHirelingSkills({ survival: 7, knowledge: 5 }),
    hireCost: { base: 20, perLevel: 10 },
    combat: { willFight: false }
  },

  healer: {
    name: "Healer",
    type: HirelingType.HEALER,
    level: 2,
    skills: createHirelingSkills({ healing: 7, knowledge: 4 }),
    hireCost: { base: 40, perLevel: 20 },
    combat: { willFight: false, protectsEmployer: false }
  },

  bodyguard: {
    name: "Bodyguard",
    type: HirelingType.GUARD,
    level: 3,
    skills: createHirelingSkills({ combat: 7, stealth: 3 }),
    hireCost: { base: 75, perLevel: 35 },
    combat: { willFight: true, fleeThreshold: 0.1, protectsEmployer: true }
  }
};

/**
 * Mount templates
 */
export const MountTemplates = {
  riding_horse: {
    name: "Riding Horse",
    type: MountType.HORSE,
    stats: createMountStats({ speed: 60, carryCapacity: 480, passengers: 1 }),
    training: { level: 1 },
    pricing: { purchase: 75, rental: 5, stabling: 1 }
  },

  warhorse: {
    name: "Warhorse",
    type: MountType.WARHORSE,
    stats: createMountStats({ speed: 60, carryCapacity: 540, passengers: 1, armor: 2 }),
    training: { level: 3, combatTrained: true, mountedCombat: true },
    pricing: { purchase: 400, rental: 20, stabling: 2 },
    requirements: { ridingProficiency: true }
  },

  mule: {
    name: "Mule",
    type: MountType.MULE,
    stats: createMountStats({ speed: 40, carryCapacity: 420, passengers: 1 }),
    training: { level: 0 },
    pricing: { purchase: 8, rental: 1, stabling: 0.5 }
  },

  pony: {
    name: "Pony",
    type: MountType.PONY,
    stats: createMountStats({ speed: 40, carryCapacity: 225, passengers: 1 }),
    training: { level: 1 },
    pricing: { purchase: 30, rental: 2, stabling: 0.5 }
  },

  griffon: {
    name: "Griffon",
    type: MountType.FLYING,
    stats: createMountStats({ speed: 30, carryCapacity: 400, passengers: 1, fly: true, flySpeed: 80 }),
    training: { level: 4, combatTrained: true },
    pricing: { purchase: 2000, rental: 100, stabling: 10 },
    requirements: { playerLevel: 8, ridingProficiency: true }
  }
};

/**
 * Create hireling from template
 * @param {string} templateName - Template name
 * @param {object} overrides - Data overrides
 * @returns {object}
 */
export function createHirelingFromTemplate(templateName, overrides = {}) {
  const template = HirelingTemplates[templateName] || HirelingTemplates.mercenary;
  return createHireling({
    ...template,
    ...overrides
  });
}

/**
 * Create mount from template
 * @param {string} templateName - Template name
 * @param {object} overrides - Data overrides
 * @returns {object}
 */
export function createMountFromTemplate(templateName, overrides = {}) {
  const template = MountTemplates[templateName] || MountTemplates.riding_horse;
  return createMount({
    ...template,
    ...overrides
  });
}
