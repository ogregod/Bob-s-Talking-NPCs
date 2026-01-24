/**
 * Bob's Talking NPCs - NPC Configuration Data Model
 * Defines the structure for NPC roles and configuration
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";
import { generateId } from "../utils/helpers.mjs";

/**
 * NPC roles enum
 */
export const NPCRole = Object.freeze({
  QUEST_GIVER: "questGiver",
  QUEST_TURNIN: "questTurnIn",
  MERCHANT: "merchant",
  BANKER: "banker",
  STABLE_MASTER: "stableMaster",
  INNKEEPER: "innkeeper",
  TRAINER: "trainer",
  ENCHANTER: "enchanter",
  TRANSPORTER: "transporter",
  INFORMANT: "informant",
  HIRELING_RECRUITER: "hirelingRecruiter",
  FENCE: "fence",
  FACTION_REPRESENTATIVE: "factionRepresentative"
});

/**
 * NPC indicator types for visual markers
 */
export const IndicatorType = Object.freeze({
  NONE: "none",
  QUEST_AVAILABLE: "questAvailable",
  QUEST_TURNIN: "questTurnIn",
  QUEST_PROGRESS: "questProgress",
  MERCHANT: "merchant",
  TRAINER: "trainer",
  SERVICE: "service",
  DIALOGUE: "dialogue"
});

/**
 * Portrait source types
 */
export const PortraitSource = Object.freeze({
  TOKEN: "token",
  ACTOR: "actor",
  CUSTOM: "custom"
});

/**
 * Schedule day types
 */
export const ScheduleDays = Object.freeze({
  MONDAY: "monday",
  TUESDAY: "tuesday",
  WEDNESDAY: "wednesday",
  THURSDAY: "thursday",
  FRIDAY: "friday",
  SATURDAY: "saturday",
  SUNDAY: "sunday",
  WEEKDAYS: "weekdays",
  WEEKENDS: "weekends",
  ALL: "all"
});

/**
 * Create a schedule entry
 * @param {object} data - Schedule data
 * @returns {object}
 */
export function createScheduleEntry(data = {}) {
  return {
    id: data.id || generateId(),
    days: data.days || [ScheduleDays.ALL],
    from: data.from ?? 6,    // Hour (0-23)
    to: data.to ?? 22,
    location: data.location || null,  // Scene UUID for location-based schedule
    dialogueOverride: data.dialogueOverride || null  // Different dialogue during this time
  };
}

/**
 * Create NPC roles configuration
 * @param {object} data - Roles data
 * @returns {object}
 */
export function createRoles(data = {}) {
  return {
    [NPCRole.QUEST_GIVER]: data[NPCRole.QUEST_GIVER] ?? false,
    [NPCRole.QUEST_TURNIN]: data[NPCRole.QUEST_TURNIN] ?? false,
    [NPCRole.MERCHANT]: data[NPCRole.MERCHANT] ?? false,
    [NPCRole.BANKER]: data[NPCRole.BANKER] ?? false,
    [NPCRole.STABLE_MASTER]: data[NPCRole.STABLE_MASTER] ?? false,
    [NPCRole.INNKEEPER]: data[NPCRole.INNKEEPER] ?? false,
    [NPCRole.TRAINER]: data[NPCRole.TRAINER] ?? false,
    [NPCRole.ENCHANTER]: data[NPCRole.ENCHANTER] ?? false,
    [NPCRole.TRANSPORTER]: data[NPCRole.TRANSPORTER] ?? false,
    [NPCRole.INFORMANT]: data[NPCRole.INFORMANT] ?? false,
    [NPCRole.HIRELING_RECRUITER]: data[NPCRole.HIRELING_RECRUITER] ?? false,
    [NPCRole.FENCE]: data[NPCRole.FENCE] ?? false,
    [NPCRole.FACTION_REPRESENTATIVE]: data[NPCRole.FACTION_REPRESENTATIVE] ?? false
  };
}

/**
 * Create haggling configuration
 * @param {object} data - Haggling data
 * @returns {object}
 */
export function createHagglingConfig(data = {}) {
  return {
    enabled: data.enabled ?? true,
    persuasionDC: data.persuasionDC ?? 15,
    intimidationDC: data.intimidationDC ?? 18,
    deceptionDC: data.deceptionDC ?? 16,
    successDiscount: data.successDiscount ?? 0.1,  // 10% discount on success
    failureConsequences: {
      persuasion: data.failureConsequences?.persuasion || "none",
      intimidation: data.failureConsequences?.intimidation || "price_increase",
      deception: data.failureConsequences?.deception || "refuse_service"
    },
    refuseServiceDuration: data.refuseServiceDuration || "session",  // session, day, permanent
    maxAttempts: data.maxAttempts ?? 1,
    cooldownHours: data.cooldownHours ?? 24
  };
}

/**
 * Create portrait configuration
 * @param {object} data - Portrait data
 * @returns {object}
 */
export function createPortraitConfig(data = {}) {
  return {
    source: data.source || PortraitSource.TOKEN,
    customPath: data.customPath || null,
    showFrame: data.showFrame ?? true,
    frameStyle: data.frameStyle || "default"
  };
}

/**
 * Create voice configuration
 * @param {object} data - Voice data
 * @returns {object}
 */
export function createVoiceConfig(data = {}) {
  return {
    enabled: data.enabled ?? false,
    defaultVoicePath: data.defaultVoicePath || null,
    volume: data.volume ?? 0.8,
    pitch: data.pitch ?? 1.0  // For text-to-speech if implemented
  };
}

/**
 * Create schedule configuration
 * @param {object} data - Schedule data
 * @returns {object}
 */
export function createScheduleConfig(data = {}) {
  return {
    enabled: data.enabled ?? false,
    availability: (data.availability || []).map(a => createScheduleEntry(a)),
    unavailableDialogueId: data.unavailableDialogueId || null,
    unavailableMessage: data.unavailableMessage || "I'm not available right now."
  };
}

/**
 * Create NPC configuration
 * This is stored in actor.flags[MODULE_ID].config
 * @param {object} data - NPC config data
 * @returns {object}
 */
export function createNPCConfig(data = {}) {
  return {
    // Module enabled for this NPC
    enabled: data.enabled ?? false,

    // NPC Roles
    roles: createRoles(data.roles || {}),

    // Faction membership
    factions: data.factions || [],  // Array of faction IDs
    factionRanks: data.factionRanks || {},  // {factionId: rankId}

    // Dialogue
    dialogueId: data.dialogueId || null,
    greetingOverrides: data.greetingOverrides || {},  // {condition: dialogueNodeId}

    // Merchant config (if role enabled)
    merchant: data.merchant || null,  // Merchant model data

    // Bank config (if role enabled)
    bank: data.bank || null,  // Bank model data

    // Services (if roles enabled)
    services: {
      training: data.services?.training || null,
      enchanting: data.services?.enchanting || null,
      transportation: data.services?.transportation || null,
      information: data.services?.information || null,
      inn: data.services?.inn || null,
      repair: data.services?.repair || null
    },

    // Hirelings available (if recruiter)
    hirelings: data.hirelings || [],  // Actor UUIDs

    // Mounts available (if stable master)
    mounts: data.mounts || [],  // Actor UUIDs

    // Schedule
    schedule: createScheduleConfig(data.schedule || {}),

    // Location expectations
    expectedScenes: data.expectedScenes || [],  // Scene UUIDs
    wrongLocationDialogueId: data.wrongLocationDialogueId || null,
    wrongLocationMessage: data.wrongLocationMessage || null,

    // Haggling (overrides world settings)
    haggling: data.haggling ? createHagglingConfig(data.haggling) : null,

    // Portrait
    portrait: createPortraitConfig(data.portrait || {}),

    // Voice
    voice: createVoiceConfig(data.voice || {}),

    // Indicator icon override
    indicatorIcon: data.indicatorIcon || null,
    indicatorColor: data.indicatorColor || null,

    // Behavior
    canBeAttacked: data.canBeAttacked ?? true,
    essential: data.essential ?? false,  // Cannot be killed
    respawns: data.respawns ?? false,
    respawnDelay: data.respawnDelay || "day",

    // Memory
    remembersPlayers: data.remembersPlayers ?? true,
    visitCount: data.visitCount || {},  // {actorUuid: count}
    lastVisit: data.lastVisit || {},    // {actorUuid: timestamp}

    // Notes (GM only)
    gmNotes: data.gmNotes || "",

    // Metadata
    configuredAt: data.configuredAt || Date.now(),
    configuredBy: data.configuredBy || null
  };
}

/**
 * Get active roles for an NPC
 * @param {object} config - NPC config
 * @returns {string[]} Array of active role keys
 */
export function getActiveRoles(config) {
  if (!config?.roles) return [];
  return Object.entries(config.roles)
    .filter(([_, enabled]) => enabled)
    .map(([role]) => role);
}

/**
 * Check if NPC has a specific role
 * @param {object} config - NPC config
 * @param {string} role - Role to check
 * @returns {boolean}
 */
export function hasRole(config, role) {
  return config?.roles?.[role] ?? false;
}

/**
 * Get primary indicator for token
 * @param {object} config - NPC config
 * @returns {object|null} {icon, color, tooltip}
 */
export function getPrimaryIndicator(config) {
  if (!config?.enabled) return null;

  // Priority order for indicator display
  const priorityRoles = [
    { role: NPCRole.QUEST_GIVER, icon: "fa-exclamation", color: "#ffd700", tooltip: "Quest Available" },
    { role: NPCRole.QUEST_TURNIN, icon: "fa-question", color: "#ffd700", tooltip: "Quest Turn-in" },
    { role: NPCRole.MERCHANT, icon: "fa-coins", color: "#ff9800", tooltip: "Merchant" },
    { role: NPCRole.BANKER, icon: "fa-landmark", color: "#4caf50", tooltip: "Banker" },
    { role: NPCRole.INNKEEPER, icon: "fa-bed", color: "#795548", tooltip: "Innkeeper" },
    { role: NPCRole.TRAINER, icon: "fa-graduation-cap", color: "#2196f3", tooltip: "Trainer" },
    { role: NPCRole.STABLE_MASTER, icon: "fa-horse", color: "#8d6e63", tooltip: "Stable Master" },
    { role: NPCRole.FACTION_REPRESENTATIVE, icon: "fa-flag", color: "#9c27b0", tooltip: "Faction Rep" }
  ];

  for (const { role, icon, color, tooltip } of priorityRoles) {
    if (hasRole(config, role)) {
      return {
        icon: config.indicatorIcon || icon,
        color: config.indicatorColor || color,
        tooltip
      };
    }
  }

  // Default indicator for configured NPC
  return {
    icon: "fa-comment",
    color: "#607d8b",
    tooltip: "Talk"
  };
}

/**
 * Check if NPC is available based on schedule
 * @param {object} config - NPC config
 * @param {object} gameTime - Game time info (hour, day)
 * @returns {boolean}
 */
export function isNPCAvailable(config, gameTime = null) {
  if (!config?.schedule?.enabled) return true;
  if (!config.schedule.availability?.length) return true;

  // If no game time provided, assume always available
  if (!gameTime) return true;

  const { hour, dayOfWeek } = gameTime;

  return config.schedule.availability.some(entry => {
    // Check day
    const dayMatch = entry.days.some(day => {
      if (day === ScheduleDays.ALL) return true;
      if (day === ScheduleDays.WEEKDAYS) {
        return ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(dayOfWeek);
      }
      if (day === ScheduleDays.WEEKENDS) {
        return ["saturday", "sunday"].includes(dayOfWeek);
      }
      return day === dayOfWeek;
    });

    if (!dayMatch) return false;

    // Check time
    if (entry.from <= entry.to) {
      return hour >= entry.from && hour < entry.to;
    } else {
      // Overnight schedule (e.g., 22:00 to 06:00)
      return hour >= entry.from || hour < entry.to;
    }
  });
}

/**
 * Record a player visit
 * @param {object} config - NPC config (will be modified)
 * @param {string} actorUuid - Player actor UUID
 */
export function recordVisit(config, actorUuid) {
  if (!config.remembersPlayers) return;

  config.visitCount = config.visitCount || {};
  config.lastVisit = config.lastVisit || {};

  config.visitCount[actorUuid] = (config.visitCount[actorUuid] || 0) + 1;
  config.lastVisit[actorUuid] = Date.now();
}

/**
 * Get visit count for a player
 * @param {object} config - NPC config
 * @param {string} actorUuid - Player actor UUID
 * @returns {number}
 */
export function getVisitCount(config, actorUuid) {
  return config?.visitCount?.[actorUuid] || 0;
}

/**
 * Validate NPC config
 * @param {object} config - NPC config
 * @returns {object} {valid: boolean, errors: string[], warnings: string[]}
 */
export function validateNPCConfig(config) {
  const errors = [];
  const warnings = [];

  // Check for dialogue if enabled
  if (config.enabled && !config.dialogueId) {
    warnings.push("No dialogue configured - NPC won't have conversations");
  }

  // Check merchant config if role enabled
  if (hasRole(config, NPCRole.MERCHANT) && !config.merchant) {
    warnings.push("Merchant role enabled but no merchant config set");
  }

  // Check bank config if role enabled
  if (hasRole(config, NPCRole.BANKER) && !config.bank) {
    warnings.push("Banker role enabled but no bank config set");
  }

  // Check faction rep has factions
  if (hasRole(config, NPCRole.FACTION_REPRESENTATIVE) && !config.factions?.length) {
    warnings.push("Faction representative role enabled but no factions assigned");
  }

  // Check schedule validity
  if (config.schedule?.enabled) {
    for (const entry of config.schedule.availability || []) {
      if (entry.from < 0 || entry.from > 23) {
        errors.push(`Invalid schedule start hour: ${entry.from}`);
      }
      if (entry.to < 0 || entry.to > 23) {
        errors.push(`Invalid schedule end hour: ${entry.to}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * NPC templates for quick setup
 */
export const NPCTemplates = {
  merchant: {
    enabled: true,
    roles: createRoles({ [NPCRole.MERCHANT]: true }),
    portrait: createPortraitConfig({ source: PortraitSource.TOKEN })
  },

  quest_giver: {
    enabled: true,
    roles: createRoles({
      [NPCRole.QUEST_GIVER]: true,
      [NPCRole.QUEST_TURNIN]: true
    }),
    portrait: createPortraitConfig({ source: PortraitSource.TOKEN })
  },

  innkeeper: {
    enabled: true,
    roles: createRoles({
      [NPCRole.INNKEEPER]: true,
      [NPCRole.MERCHANT]: true,
      [NPCRole.INFORMANT]: true
    }),
    portrait: createPortraitConfig({ source: PortraitSource.TOKEN })
  },

  blacksmith: {
    enabled: true,
    roles: createRoles({
      [NPCRole.MERCHANT]: true
    }),
    services: {
      repair: {
        enabled: true,
        items: ["weapons", "armor"],
        priceMultiplier: 0.1
      }
    },
    portrait: createPortraitConfig({ source: PortraitSource.TOKEN })
  },

  banker: {
    enabled: true,
    roles: createRoles({
      [NPCRole.BANKER]: true
    }),
    portrait: createPortraitConfig({ source: PortraitSource.TOKEN })
  },

  trainer: {
    enabled: true,
    roles: createRoles({
      [NPCRole.TRAINER]: true
    }),
    portrait: createPortraitConfig({ source: PortraitSource.TOKEN })
  },

  stable_master: {
    enabled: true,
    roles: createRoles({
      [NPCRole.STABLE_MASTER]: true,
      [NPCRole.MERCHANT]: true
    }),
    portrait: createPortraitConfig({ source: PortraitSource.TOKEN })
  },

  fence: {
    enabled: true,
    roles: createRoles({
      [NPCRole.FENCE]: true,
      [NPCRole.INFORMANT]: true
    }),
    portrait: createPortraitConfig({ source: PortraitSource.TOKEN })
  },

  faction_rep: {
    enabled: true,
    roles: createRoles({
      [NPCRole.FACTION_REPRESENTATIVE]: true,
      [NPCRole.QUEST_GIVER]: true,
      [NPCRole.QUEST_TURNIN]: true
    }),
    portrait: createPortraitConfig({ source: PortraitSource.TOKEN })
  },

  blank: {
    enabled: true,
    roles: createRoles({}),
    portrait: createPortraitConfig({ source: PortraitSource.TOKEN })
  }
};

/**
 * Create NPC config from template
 * @param {string} templateName - Template name
 * @param {object} overrides - Data overrides
 * @returns {object}
 */
export function createNPCFromTemplate(templateName, overrides = {}) {
  const template = NPCTemplates[templateName] || NPCTemplates.blank;
  return createNPCConfig({
    ...template,
    ...overrides
  });
}
