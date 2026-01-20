/**
 * Bob's Talking NPCs - Property Data Model
 * Defines the structure for player-owned properties, housing, and businesses
 */

import { MODULE_ID } from "../module.mjs";
import { generateId } from "../utils/helpers.mjs";

/**
 * Property type enum
 */
export const PropertyType = Object.freeze({
  HOUSE: "house",
  APARTMENT: "apartment",
  MANOR: "manor",
  CASTLE: "castle",
  SHOP: "shop",
  TAVERN: "tavern",
  WORKSHOP: "workshop",
  FARM: "farm",
  WAREHOUSE: "warehouse",
  GUILD_HALL: "guildHall",
  SHIP: "ship",
  CAMP: "camp",
  CUSTOM: "custom"
});

/**
 * Property status enum
 */
export const PropertyStatus = Object.freeze({
  AVAILABLE: "available",
  OWNED: "owned",
  RENTED: "rented",
  UNDER_CONSTRUCTION: "underConstruction",
  DAMAGED: "damaged",
  DESTROYED: "destroyed",
  FORECLOSED: "foreclosed"
});

/**
 * Upgrade type enum
 */
export const UpgradeType = Object.freeze({
  STRUCTURAL: "structural",
  STORAGE: "storage",
  SECURITY: "security",
  COMFORT: "comfort",
  BUSINESS: "business",
  MAGICAL: "magical",
  STAFF: "staff",
  CUSTOM: "custom"
});

/**
 * Create property storage configuration
 * @param {object} data - Storage data
 * @returns {object}
 */
export function createStorageConfig(data = {}) {
  return {
    enabled: data.enabled ?? true,
    baseSlots: data.baseSlots ?? 20,
    bonusSlots: data.bonusSlots ?? 0,
    maxWeight: data.maxWeight ?? 500,

    // Storage containers
    containers: (data.containers || []).map(c => ({
      id: c.id || generateId(),
      name: c.name || "Container",
      type: c.type || "chest",
      slots: c.slots ?? 10,
      maxWeight: c.maxWeight ?? 100,
      locked: c.locked ?? false,
      items: c.items || []  // Array of item UUIDs
    })),

    // Special storage
    displayCases: data.displayCases || [],  // For trophies, items on display
    mannequins: data.mannequins || []       // For armor/outfit display
  };
}

/**
 * Create property upgrade definition
 * @param {object} data - Upgrade data
 * @returns {object}
 */
export function createUpgrade(data = {}) {
  return {
    id: data.id || generateId(),
    name: data.name || "New Upgrade",
    description: data.description || "",
    type: data.type || UpgradeType.STRUCTURAL,

    // Cost
    cost: {
      gold: data.cost?.gold ?? 0,
      materials: data.cost?.materials || [],  // Array of {itemUuid, quantity}
      laborDays: data.cost?.laborDays ?? 0
    },

    // Requirements
    requirements: {
      propertyLevel: data.requirements?.propertyLevel ?? 0,
      previousUpgrades: data.requirements?.previousUpgrades || [],
      playerLevel: data.requirements?.playerLevel ?? 0,
      factionRank: data.requirements?.factionRank || null,
      custom: data.requirements?.custom || []
    },

    // Effects
    effects: {
      storageBonus: data.effects?.storageBonus ?? 0,
      comfortBonus: data.effects?.comfortBonus ?? 0,
      securityBonus: data.effects?.securityBonus ?? 0,
      incomeBonus: data.effects?.incomeBonus ?? 0,
      staffSlots: data.effects?.staffSlots ?? 0,
      restBonus: data.effects?.restBonus ?? 0,
      customEffects: data.effects?.customEffects || []
    },

    // Visual
    icon: data.icon || null,
    sceneModification: data.sceneModification || null  // How it changes the scene
  };
}

/**
 * Create property staff member
 * @param {object} data - Staff data
 * @returns {object}
 */
export function createStaffMember(data = {}) {
  return {
    id: data.id || generateId(),
    actorUuid: data.actorUuid || null,
    name: data.name || "Staff Member",
    role: data.role || "servant",

    // Employment
    wage: data.wage ?? 5,  // Gold per week
    hiredAt: data.hiredAt || Date.now(),
    lastPaid: data.lastPaid || null,
    loyalty: data.loyalty ?? 50,

    // Duties
    duties: data.duties || [],
    schedule: data.schedule || null,  // Reference to schedule model

    // Effects
    effects: {
      maintenance: data.effects?.maintenance ?? 0,  // Property maintenance bonus
      security: data.effects?.security ?? 0,
      income: data.effects?.income ?? 0,
      services: data.effects?.services || []  // Services they provide
    }
  };
}

/**
 * Create property finances tracking
 * @param {object} data - Finance data
 * @returns {object}
 */
export function createPropertyFinances(data = {}) {
  return {
    // Income
    income: {
      enabled: data.income?.enabled ?? false,
      baseAmount: data.income?.baseAmount ?? 0,
      bonusAmount: data.income?.bonusAmount ?? 0,
      frequency: data.income?.frequency || "weekly",
      lastCollection: data.income?.lastCollection || null,
      pendingAmount: data.income?.pendingAmount ?? 0
    },

    // Expenses
    expenses: {
      maintenance: data.expenses?.maintenance ?? 0,
      staffWages: data.expenses?.staffWages ?? 0,
      taxes: data.expenses?.taxes ?? 0,
      other: data.expenses?.other ?? 0,
      frequency: data.expenses?.frequency || "weekly",
      lastPayment: data.expenses?.lastPayment || null,
      overdueAmount: data.expenses?.overdueAmount ?? 0
    },

    // Mortgage (if applicable)
    mortgage: {
      enabled: data.mortgage?.enabled ?? false,
      totalAmount: data.mortgage?.totalAmount ?? 0,
      remainingAmount: data.mortgage?.remainingAmount ?? 0,
      paymentAmount: data.mortgage?.paymentAmount ?? 0,
      paymentFrequency: data.mortgage?.paymentFrequency || "weekly",
      interestRate: data.mortgage?.interestRate ?? 0.05,
      lastPayment: data.mortgage?.lastPayment || null,
      missedPayments: data.mortgage?.missedPayments ?? 0,
      foreclosureThreshold: data.mortgage?.foreclosureThreshold ?? 3
    },

    // History
    history: data.history || []  // Array of transactions
  };
}

/**
 * Create property condition tracking
 * @param {object} data - Condition data
 * @returns {object}
 */
export function createPropertyCondition(data = {}) {
  return {
    overall: data.overall ?? 100,  // 0-100 percentage
    structural: data.structural ?? 100,
    cleanliness: data.cleanliness ?? 100,
    security: data.security ?? 100,

    // Decay
    decay: {
      enabled: data.decay?.enabled ?? true,
      rate: data.decay?.rate ?? 1,  // Points per week without maintenance
      lastCheck: data.decay?.lastCheck || null
    },

    // Damage
    damaged: data.damaged ?? false,
    damageDescription: data.damageDescription || null,
    repairCost: data.repairCost ?? 0,

    // Maintenance
    maintenanceCost: data.maintenanceCost ?? 0,
    lastMaintenance: data.lastMaintenance || null
  };
}

/**
 * Create a property definition
 * @param {object} data - Property data
 * @returns {object}
 */
export function createProperty(data = {}) {
  return {
    id: data.id || generateId(),
    name: data.name || "Property",
    description: data.description || "",
    type: data.type || PropertyType.HOUSE,
    customType: data.customType || null,
    status: data.status || PropertyStatus.AVAILABLE,

    // Location
    location: {
      sceneId: data.location?.sceneId || null,
      sceneName: data.location?.sceneName || null,
      region: data.location?.region || null,
      address: data.location?.address || "",
      coordinates: data.location?.coordinates || null
    },

    // Visual
    portrait: data.portrait || null,
    exteriorImage: data.exteriorImage || null,
    interiorImages: data.interiorImages || [],

    // Size and capacity
    size: {
      level: data.size?.level ?? 1,
      rooms: data.size?.rooms ?? 1,
      floors: data.size?.floors ?? 1,
      bedrooms: data.size?.bedrooms ?? 0,
      guestCapacity: data.size?.guestCapacity ?? 0
    },

    // Ownership
    ownership: {
      ownerUuid: data.ownership?.ownerUuid || null,
      ownerName: data.ownership?.ownerName || null,
      coOwners: data.ownership?.coOwners || [],  // Array of actor UUIDs
      purchaseDate: data.ownership?.purchaseDate || null,
      purchasePrice: data.ownership?.purchasePrice ?? 0
    },

    // Rental (if rented, not owned)
    rental: {
      isRented: data.rental?.isRented ?? false,
      landlordUuid: data.rental?.landlordUuid || null,
      rentAmount: data.rental?.rentAmount ?? 0,
      rentFrequency: data.rental?.rentFrequency || "weekly",
      rentDueDate: data.rental?.rentDueDate || null,
      leaseEnds: data.rental?.leaseEnds || null,
      deposit: data.rental?.deposit ?? 0
    },

    // Pricing (for purchase)
    pricing: {
      purchasePrice: data.pricing?.purchasePrice ?? 0,
      rentalPrice: data.pricing?.rentalPrice ?? 0,
      appraisedValue: data.pricing?.appraisedValue ?? 0,
      mortgageAvailable: data.pricing?.mortgageAvailable ?? false,
      mortgageDownPayment: data.pricing?.mortgageDownPayment ?? 0.2  // 20%
    },

    // Storage
    storage: createStorageConfig(data.storage || {}),

    // Upgrades
    availableUpgrades: (data.availableUpgrades || []).map(u => createUpgrade(u)),
    installedUpgrades: data.installedUpgrades || [],  // Array of upgrade IDs
    upgradeInProgress: data.upgradeInProgress || null,  // Current upgrade being built
    upgradeCompletionDate: data.upgradeCompletionDate || null,

    // Staff
    staff: {
      maxSlots: data.staff?.maxSlots ?? 0,
      members: (data.staff?.members || []).map(s => createStaffMember(s))
    },

    // Finances
    finances: createPropertyFinances(data.finances || {}),

    // Condition
    condition: createPropertyCondition(data.condition || {}),

    // Features
    features: {
      restBonus: data.features?.restBonus ?? 0,  // Bonus to long rest
      craftingStation: data.features?.craftingStation ?? false,
      craftingTypes: data.features?.craftingTypes || [],
      alchemyLab: data.features?.alchemyLab ?? false,
      library: data.features?.library ?? false,
      libraryBonus: data.features?.libraryBonus ?? 0,
      stable: data.features?.stable ?? false,
      stableCapacity: data.features?.stableCapacity ?? 0,
      garden: data.features?.garden ?? false,
      gardenYield: data.features?.gardenYield || [],
      teleportCircle: data.features?.teleportCircle ?? false,
      custom: data.features?.custom || []
    },

    // Security
    security: {
      level: data.security?.level ?? 0,
      locks: data.security?.locks ?? false,
      lockDC: data.security?.lockDC ?? 15,
      guards: data.security?.guards ?? 0,
      magicalWards: data.security?.magicalWards ?? false,
      wardDescription: data.security?.wardDescription || null,
      alarms: data.security?.alarms ?? false
    },

    // Access control
    access: {
      allowedActors: data.access?.allowedActors || [],  // Actor UUIDs with access
      publicAccess: data.access?.publicAccess ?? false,
      businessHours: data.access?.businessHours || null  // For shops/taverns
    },

    // Business (for income-generating properties)
    business: {
      enabled: data.business?.enabled ?? false,
      type: data.business?.type || null,
      inventory: data.business?.inventory || [],  // For shops
      services: data.business?.services || [],     // Services offered
      reputation: data.business?.reputation ?? 0,
      customers: data.business?.customers ?? 0     // Average daily customers
    },

    // Requirements to purchase
    requirements: {
      playerLevel: data.requirements?.playerLevel ?? 0,
      reputation: data.requirements?.reputation ?? 0,
      factionId: data.requirements?.factionId || null,
      factionRank: data.requirements?.factionRank || null,
      questCompleted: data.requirements?.questCompleted || null,
      gold: data.requirements?.gold ?? 0,
      custom: data.requirements?.custom || []
    },

    // Seller/Agent
    seller: {
      npcActorUuid: data.seller?.npcActorUuid || null,
      agentFee: data.seller?.agentFee ?? 0
    },

    // Metadata
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  };
}

/**
 * Calculate total storage capacity
 * @param {object} property - Property data
 * @returns {object} {slots, weight}
 */
export function calculateStorageCapacity(property) {
  const storage = property.storage;

  let totalSlots = storage.baseSlots + storage.bonusSlots;
  let totalWeight = storage.maxWeight;

  // Add container capacity
  for (const container of storage.containers) {
    totalSlots += container.slots;
    totalWeight += container.maxWeight;
  }

  // Add upgrade bonuses
  for (const upgradeId of property.installedUpgrades) {
    const upgrade = property.availableUpgrades.find(u => u.id === upgradeId);
    if (upgrade?.effects.storageBonus) {
      totalSlots += upgrade.effects.storageBonus;
    }
  }

  return { slots: totalSlots, weight: totalWeight };
}

/**
 * Calculate weekly expenses
 * @param {object} property - Property data
 * @returns {object} {total, breakdown}
 */
export function calculateWeeklyExpenses(property) {
  const expenses = property.finances.expenses;
  const mortgage = property.finances.mortgage;

  let staffWages = 0;
  for (const staff of property.staff.members) {
    staffWages += staff.wage;
  }

  const breakdown = {
    maintenance: expenses.maintenance,
    staffWages,
    taxes: expenses.taxes,
    other: expenses.other,
    mortgage: mortgage.enabled ? mortgage.paymentAmount : 0
  };

  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  return { total, breakdown };
}

/**
 * Calculate weekly income
 * @param {object} property - Property data
 * @returns {number} Weekly income
 */
export function calculateWeeklyIncome(property) {
  if (!property.finances.income.enabled) return 0;

  let income = property.finances.income.baseAmount +
    property.finances.income.bonusAmount;

  // Add staff income bonuses
  for (const staff of property.staff.members) {
    income += staff.effects.income;
  }

  // Add upgrade income bonuses
  for (const upgradeId of property.installedUpgrades) {
    const upgrade = property.availableUpgrades.find(u => u.id === upgradeId);
    if (upgrade?.effects.incomeBonus) {
      income += upgrade.effects.incomeBonus;
    }
  }

  return income;
}

/**
 * Apply condition decay
 * @param {object} property - Property data
 * @param {number} weeksPassed - Weeks since last check
 * @returns {object} Updated property
 */
export function applyConditionDecay(property, weeksPassed = 1) {
  if (!property.condition.decay.enabled) return property;

  const decayAmount = property.condition.decay.rate * weeksPassed;

  // Staff can reduce decay
  let maintenanceBonus = 0;
  for (const staff of property.staff.members) {
    maintenanceBonus += staff.effects.maintenance;
  }

  const effectiveDecay = Math.max(0, decayAmount - maintenanceBonus);

  const newCondition = {
    ...property.condition,
    overall: Math.max(0, property.condition.overall - effectiveDecay),
    structural: Math.max(0, property.condition.structural - effectiveDecay * 0.5),
    cleanliness: Math.max(0, property.condition.cleanliness - effectiveDecay * 2),
    decay: {
      ...property.condition.decay,
      lastCheck: Date.now()
    }
  };

  // Mark as damaged if condition is very low
  if (newCondition.overall < 25) {
    newCondition.damaged = true;
  }

  return {
    ...property,
    condition: newCondition,
    updatedAt: Date.now()
  };
}

/**
 * Check if upgrade can be installed
 * @param {object} property - Property data
 * @param {object} upgrade - Upgrade data
 * @param {object} context - Player context
 * @returns {object} {canInstall: boolean, reasons: string[]}
 */
export function checkUpgradeRequirements(property, upgrade, context = {}) {
  const reasons = [];
  const reqs = upgrade.requirements;

  // Check property level
  if (reqs.propertyLevel > property.size.level) {
    reasons.push(`Requires property level ${reqs.propertyLevel}`);
  }

  // Check previous upgrades
  for (const prevUpgradeId of reqs.previousUpgrades) {
    if (!property.installedUpgrades.includes(prevUpgradeId)) {
      const prevUpgrade = property.availableUpgrades.find(u => u.id === prevUpgradeId);
      reasons.push(`Requires upgrade: ${prevUpgrade?.name || prevUpgradeId}`);
    }
  }

  // Check player level
  if (reqs.playerLevel > 0 && context.playerLevel < reqs.playerLevel) {
    reasons.push(`Requires player level ${reqs.playerLevel}`);
  }

  // Check already installed
  if (property.installedUpgrades.includes(upgrade.id)) {
    reasons.push("Already installed");
  }

  // Check gold
  if (context.gold !== undefined && context.gold < upgrade.cost.gold) {
    reasons.push(`Requires ${upgrade.cost.gold} gold`);
  }

  return {
    canInstall: reasons.length === 0,
    reasons
  };
}

/**
 * Get rest bonus for property
 * @param {object} property - Property data
 * @returns {number} Rest bonus
 */
export function getRestBonus(property) {
  let bonus = property.features.restBonus;

  // Add comfort upgrades
  for (const upgradeId of property.installedUpgrades) {
    const upgrade = property.availableUpgrades.find(u => u.id === upgradeId);
    if (upgrade?.effects.restBonus) {
      bonus += upgrade.effects.restBonus;
    }
  }

  // Condition affects rest quality
  const conditionMultiplier = property.condition.overall / 100;
  bonus = Math.floor(bonus * conditionMultiplier);

  return bonus;
}

/**
 * Validate property data
 * @param {object} property - Property data
 * @returns {object} {valid: boolean, errors: string[], warnings: string[]}
 */
export function validateProperty(property) {
  const errors = [];
  const warnings = [];

  if (!property.id) errors.push("Property ID is required");
  if (!property.name?.trim()) errors.push("Property name is required");
  if (!Object.values(PropertyType).includes(property.type)) {
    errors.push(`Invalid property type: ${property.type}`);
  }

  // Check pricing
  if (property.pricing.purchasePrice < 0) {
    errors.push("Purchase price cannot be negative");
  }

  // Check condition
  if (property.condition.overall < 0 || property.condition.overall > 100) {
    errors.push("Condition must be between 0 and 100");
  }

  // Warnings
  if (property.status === PropertyStatus.OWNED && !property.ownership.ownerUuid) {
    warnings.push("Property marked as owned but has no owner");
  }

  if (property.finances.income.enabled && property.finances.income.baseAmount === 0) {
    warnings.push("Income is enabled but base amount is 0");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Property templates
 */
export const PropertyTemplates = {
  small_house: {
    name: "Small House",
    type: PropertyType.HOUSE,
    size: { level: 1, rooms: 3, floors: 1, bedrooms: 1 },
    pricing: { purchasePrice: 500, rentalPrice: 10 },
    storage: createStorageConfig({ baseSlots: 20, maxWeight: 500 }),
    features: { restBonus: 1 },
    security: { level: 1, locks: true, lockDC: 15 }
  },

  city_apartment: {
    name: "City Apartment",
    type: PropertyType.APARTMENT,
    size: { level: 1, rooms: 2, floors: 1, bedrooms: 1 },
    pricing: { purchasePrice: 300, rentalPrice: 8 },
    storage: createStorageConfig({ baseSlots: 10, maxWeight: 200 }),
    features: { restBonus: 1 },
    security: { level: 1, locks: true, lockDC: 12 }
  },

  manor_house: {
    name: "Manor House",
    type: PropertyType.MANOR,
    size: { level: 3, rooms: 12, floors: 2, bedrooms: 4, guestCapacity: 8 },
    pricing: { purchasePrice: 5000, rentalPrice: 100 },
    storage: createStorageConfig({ baseSlots: 100, maxWeight: 2000 }),
    staff: { maxSlots: 5 },
    features: { restBonus: 3, library: true, libraryBonus: 2, stable: true, stableCapacity: 4 },
    security: { level: 3, locks: true, lockDC: 20, guards: 2 },
    requirements: { playerLevel: 5 }
  },

  small_shop: {
    name: "Small Shop",
    type: PropertyType.SHOP,
    size: { level: 1, rooms: 2, floors: 1 },
    pricing: { purchasePrice: 1000, rentalPrice: 25 },
    storage: createStorageConfig({ baseSlots: 50, maxWeight: 1000 }),
    finances: createPropertyFinances({
      income: { enabled: true, baseAmount: 20, frequency: "weekly" },
      expenses: { maintenance: 5, taxes: 3 }
    }),
    business: { enabled: true, type: "retail" },
    security: { level: 2, locks: true, lockDC: 18 }
  },

  tavern: {
    name: "Tavern",
    type: PropertyType.TAVERN,
    size: { level: 2, rooms: 8, floors: 2, bedrooms: 4, guestCapacity: 20 },
    pricing: { purchasePrice: 2500, rentalPrice: 50 },
    storage: createStorageConfig({ baseSlots: 60, maxWeight: 1500 }),
    staff: { maxSlots: 3 },
    finances: createPropertyFinances({
      income: { enabled: true, baseAmount: 50, frequency: "weekly" },
      expenses: { maintenance: 10, taxes: 8 }
    }),
    business: { enabled: true, type: "hospitality" },
    features: { restBonus: 2 },
    security: { level: 2, locks: true, lockDC: 15 }
  },

  workshop: {
    name: "Workshop",
    type: PropertyType.WORKSHOP,
    size: { level: 1, rooms: 2, floors: 1 },
    pricing: { purchasePrice: 800, rentalPrice: 20 },
    storage: createStorageConfig({ baseSlots: 40, maxWeight: 800 }),
    features: { craftingStation: true, craftingTypes: ["smithing", "leatherworking"] },
    security: { level: 1, locks: true, lockDC: 15 }
  },

  farm: {
    name: "Farm",
    type: PropertyType.FARM,
    size: { level: 2, rooms: 4, floors: 1, bedrooms: 2 },
    pricing: { purchasePrice: 1500, rentalPrice: 30 },
    storage: createStorageConfig({ baseSlots: 80, maxWeight: 2000 }),
    staff: { maxSlots: 2 },
    finances: createPropertyFinances({
      income: { enabled: true, baseAmount: 30, frequency: "weekly" },
      expenses: { maintenance: 5 }
    }),
    features: { restBonus: 1, stable: true, stableCapacity: 6, garden: true },
    security: { level: 1, locks: true, lockDC: 12 }
  }
};

/**
 * Create property from template
 * @param {string} templateName - Template name
 * @param {object} overrides - Data overrides
 * @returns {object}
 */
export function createPropertyFromTemplate(templateName, overrides = {}) {
  const template = PropertyTemplates[templateName] || PropertyTemplates.small_house;
  return createProperty({
    ...template,
    ...overrides
  });
}
