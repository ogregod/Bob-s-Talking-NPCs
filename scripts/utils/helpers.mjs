/**
 * Bob's Talking NPCs - Utility Functions
 * Common utilities used throughout the module
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";

// ===== Localization Helpers =====

/**
 * Get a localized string
 * @param {string} key - Localization key (without BOBSNPC prefix)
 * @param {object} data - Interpolation data
 * @returns {string}
 */
export function localize(key, data = {}) {
  return game.i18n.format(`BOBSNPC.${key}`, data);
}

/**
 * Check if a localization key exists
 * @param {string} key - Localization key (without BOBSNPC prefix)
 * @returns {boolean}
 */
export function hasLocalization(key) {
  return game.i18n.has(`BOBSNPC.${key}`);
}

// ===== Settings Helpers =====

/**
 * Get a setting value
 * @param {string} key - Setting key
 * @returns {*}
 */
export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 * @returns {Promise<*>}
 */
export async function setSetting(key, value) {
  return game.settings.set(MODULE_ID, key, value);
}

// ===== Flag Helpers =====

/**
 * Get module flag from a document
 * @param {Document} document - Foundry document
 * @param {string} key - Flag key
 * @returns {*}
 */
export function getFlag(document, key) {
  return document.getFlag(MODULE_ID, key);
}

/**
 * Set module flag on a document
 * @param {Document} document - Foundry document
 * @param {string} key - Flag key
 * @param {*} value - Flag value
 * @returns {Promise<Document>}
 */
export async function setFlag(document, key, value) {
  return document.setFlag(MODULE_ID, key, value);
}

/**
 * Remove module flag from a document
 * @param {Document} document - Foundry document
 * @param {string} key - Flag key
 * @returns {Promise<Document>}
 */
export async function unsetFlag(document, key) {
  return document.unsetFlag(MODULE_ID, key);
}

/**
 * Update a nested flag value
 * @param {Document} document - Foundry document
 * @param {string} key - Flag key (supports dot notation)
 * @param {*} value - Value to set
 * @returns {Promise<Document>}
 */
export async function updateFlag(document, key, value) {
  const current = getFlag(document, key.split(".")[0]) || {};
  const updated = foundry.utils.setProperty(current, key.split(".").slice(1).join("."), value);
  return setFlag(document, key.split(".")[0], updated);
}

// ===== User Helpers =====

/**
 * Check if current user is GM
 * @returns {boolean}
 */
export function isGM() {
  return game.user.isGM;
}

/**
 * Get the active GM user
 * @returns {User|null}
 */
export function getActiveGM() {
  return game.users.activeGM;
}

/**
 * Get user's assigned character
 * @param {User} user - User document (defaults to current user)
 * @returns {Actor|null}
 */
export function getUserCharacter(user = game.user) {
  return user.character;
}

/**
 * Check if user owns an actor
 * @param {Actor} actor
 * @param {User} user - User document (defaults to current user)
 * @returns {boolean}
 */
export function userOwnsActor(actor, user = game.user) {
  return actor.testUserPermission(user, "OWNER");
}

// ===== Party Helpers =====

/**
 * Get party members based on current settings
 * @returns {Actor[]}
 */
export function getPartyMembers() {
  const partyDef = getSetting("partyDefinition");

  switch (partyDef) {
    case "primary_party":
      // Use D&D 5e primary party if available
      return game.actors.party?.members || [];

    case "folder":
      const folderId = getSetting("partyFolder");
      if (!folderId) return [];
      return game.actors.filter(a => a.folder?.id === folderId && a.type === "character");

    case "manual":
      const uuids = getSetting("partyManualList") || [];
      return uuids.map(uuid => fromUuidSync(uuid)).filter(Boolean);

    default:
      return [];
  }
}

/**
 * Check if an actor is a party member
 * @param {Actor} actor
 * @returns {boolean}
 */
export function isPartyMember(actor) {
  return getPartyMembers().some(m => m.id === actor.id);
}

/**
 * Get party member UUIDs
 * @returns {string[]}
 */
export function getPartyMemberUuids() {
  return getPartyMembers().map(m => m.uuid);
}

// ===== Currency Helpers =====

/**
 * Currency denomination values in copper pieces
 */
export const CURRENCY_VALUES = {
  pp: 1000,
  gp: 100,
  ep: 50,
  sp: 10,
  cp: 1
};

/**
 * Convert a currency object to copper pieces
 * @param {object} currency - Currency object {pp, gp, ep, sp, cp}
 * @returns {number}
 */
export function currencyToCopper(currency) {
  const { pp = 0, gp = 0, ep = 0, sp = 0, cp = 0 } = currency;
  return (pp * CURRENCY_VALUES.pp) +
         (gp * CURRENCY_VALUES.gp) +
         (ep * CURRENCY_VALUES.ep) +
         (sp * CURRENCY_VALUES.sp) +
         cp;
}

/**
 * Convert copper pieces to a currency object
 * @param {number} copper - Amount in copper
 * @param {boolean} includeAllDenominations - Include all denominations or just gp down
 * @returns {object}
 */
export function copperToCurrency(copper, includeAllDenominations = false) {
  if (includeAllDenominations) {
    const pp = Math.floor(copper / CURRENCY_VALUES.pp);
    copper %= CURRENCY_VALUES.pp;
    const gp = Math.floor(copper / CURRENCY_VALUES.gp);
    copper %= CURRENCY_VALUES.gp;
    const ep = Math.floor(copper / CURRENCY_VALUES.ep);
    copper %= CURRENCY_VALUES.ep;
    const sp = Math.floor(copper / CURRENCY_VALUES.sp);
    const cp = copper % CURRENCY_VALUES.sp;
    return { pp, gp, ep, sp, cp };
  }

  // Gold down format
  const gp = Math.floor(copper / CURRENCY_VALUES.gp);
  copper %= CURRENCY_VALUES.gp;
  const sp = Math.floor(copper / CURRENCY_VALUES.sp);
  const cp = copper % CURRENCY_VALUES.sp;
  return { gp, sp, cp };
}

/**
 * Format currency for display
 * @param {object|number} currency - Currency object or copper amount
 * @param {string} format - Display format ("gold_down" or "all")
 * @returns {string}
 */
export function formatCurrency(currency, format = null) {
  // Use setting if format not specified
  if (!format) {
    format = getSetting("currencyDisplay");
  }

  // Convert copper number to object if needed
  if (typeof currency === "number") {
    currency = copperToCurrency(currency, format === "all");
  }

  const { pp = 0, gp = 0, ep = 0, sp = 0, cp = 0 } = currency;

  if (format === "all") {
    const parts = [];
    if (pp) parts.push(`${pp}pp`);
    if (gp) parts.push(`${gp}gp`);
    if (ep) parts.push(`${ep}ep`);
    if (sp) parts.push(`${sp}sp`);
    if (cp) parts.push(`${cp}cp`);
    return parts.join(" ") || "0cp";
  }

  // gold_down format
  const parts = [];
  if (gp) parts.push(`${gp}gp`);
  if (sp) parts.push(`${sp}sp`);
  if (cp) parts.push(`${cp}cp`);
  return parts.join(" ") || "0gp";
}

/**
 * Check if actor has enough currency
 * @param {Actor} actor
 * @param {number} amountInCopper
 * @returns {boolean}
 */
export function hasEnoughCurrency(actor, amountInCopper) {
  const actorCurrency = actor.system?.currency || {};
  const actorCopper = currencyToCopper(actorCurrency);
  return actorCopper >= amountInCopper;
}

// ===== Relationship Helpers =====

/**
 * Relationship tier thresholds
 */
export const RELATIONSHIP_TIERS = {
  hostile: { min: -100, max: -75, label: "Hostile" },
  hated: { min: -74, max: -50, label: "Hated" },
  unfriendly: { min: -49, max: -25, label: "Unfriendly" },
  neutral: { min: -24, max: 24, label: "Neutral" },
  friendly: { min: 25, max: 49, label: "Friendly" },
  trusted: { min: 50, max: 74, label: "Trusted" },
  allied: { min: 75, max: 100, label: "Allied" }
};

/**
 * Get relationship tier from value
 * @param {number} value - Relationship value (-100 to 100)
 * @returns {string} Tier key
 */
export function getRelationshipTier(value) {
  if (value <= -75) return "hostile";
  if (value <= -50) return "hated";
  if (value <= -25) return "unfriendly";
  if (value < 25) return "neutral";
  if (value < 50) return "friendly";
  if (value < 75) return "trusted";
  return "allied";
}

/**
 * Get relationship tier info
 * @param {number} value
 * @returns {object}
 */
export function getRelationshipTierInfo(value) {
  const tier = getRelationshipTier(value);
  return {
    key: tier,
    ...RELATIONSHIP_TIERS[tier],
    value
  };
}

// ===== ID Generation =====

/**
 * Generate a unique ID
 * @param {number} length - ID length (default: 16)
 * @returns {string}
 */
export function generateId(length = 16) {
  return foundry.utils.randomID(length);
}

// ===== Object Helpers =====

/**
 * Deep merge objects
 * @param {object} target - Target object
 * @param {object} source - Source object
 * @param {object} options - Merge options
 * @returns {object}
 */
export function deepMerge(target, source, options = {}) {
  return foundry.utils.mergeObject(target, source, {
    recursive: true,
    ...options
  });
}

/**
 * Deep clone an object
 * @param {*} obj - Object to clone
 * @returns {*}
 */
export function deepClone(obj) {
  return foundry.utils.deepClone(obj);
}

/**
 * Check if object is empty
 * @param {object} obj
 * @returns {boolean}
 */
export function isEmpty(obj) {
  return foundry.utils.isEmpty(obj);
}

// ===== Function Helpers =====

/**
 * Create a debounced function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function}
 */
export function debounce(func, wait) {
  return foundry.utils.debounce(func, wait);
}

/**
 * Create a throttled function
 * @param {Function} func - Function to throttle
 * @param {number} wait - Wait time in ms
 * @returns {Function}
 */
export function throttle(func, wait) {
  return foundry.utils.throttle(func, wait);
}

// ===== Hook Helpers =====

/**
 * Emit a module hook
 * @param {string} hookName - Hook name (without btnpc. prefix)
 * @param {...*} args - Hook arguments
 */
export function callHook(hookName, ...args) {
  Hooks.call(`btnpc.${hookName}`, ...args);
}

/**
 * Emit a module hook to all listeners
 * @param {string} hookName - Hook name (without btnpc. prefix)
 * @param {...*} args - Hook arguments
 */
export function callAllHooks(hookName, ...args) {
  Hooks.callAll(`btnpc.${hookName}`, ...args);
}

// ===== Logging Helpers =====

/**
 * Log a debug message
 * @param {...*} args - Log arguments
 */
export function debug(...args) {
  console.log(`${MODULE_ID} |`, ...args);
}

/**
 * Log a warning
 * @param {...*} args - Log arguments
 */
export function warn(...args) {
  console.warn(`${MODULE_ID} |`, ...args);
}

/**
 * Log an error
 * @param {...*} args - Log arguments
 */
export function error(...args) {
  console.error(`${MODULE_ID} |`, ...args);
}

// ===== Notification Helpers =====

/**
 * Show a UI notification
 * @param {string} message - Message to display
 * @param {string} type - "info", "warn", "error"
 * @param {object} options - Notification options
 */
export function notify(message, type = "info", options = {}) {
  const notificationLevel = getSetting("notificationLevel");

  // Skip if notification level is minimal and this is just info
  if (notificationLevel === "minimal" && type === "info" && !options.force) {
    return;
  }

  ui.notifications[type](message, options);
}

/**
 * Show a localized notification
 * @param {string} key - Localization key
 * @param {object} data - Interpolation data
 * @param {string} type - Notification type
 * @param {object} options - Notification options
 */
export function notifyLocalized(key, data = {}, type = "info", options = {}) {
  const message = localize(key, data);
  notify(message, type, options);
}

// ===== Validation Helpers =====

/**
 * Check if a value is a valid UUID
 * @param {string} value
 * @returns {boolean}
 */
export function isValidUuid(value) {
  if (typeof value !== "string") return false;
  return /^[A-Za-z]+\.[A-Za-z0-9]{16}$/.test(value) ||
         /^Compendium\.[^.]+\.[^.]+\.[A-Za-z0-9]{16}$/.test(value);
}

/**
 * Clamp a number between min and max
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ===== Array Helpers =====

/**
 * Remove duplicates from an array
 * @param {Array} arr
 * @param {Function} keyFn - Optional key function for object comparison
 * @returns {Array}
 */
export function unique(arr, keyFn = null) {
  if (keyFn) {
    const seen = new Set();
    return arr.filter(item => {
      const key = keyFn(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return [...new Set(arr)];
}

/**
 * Shuffle an array (Fisher-Yates)
 * @param {Array} arr
 * @returns {Array}
 */
export function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ===== Time Helpers =====

/**
 * Format a date for display
 * @param {Date|string|number} date
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatDate(date, options = {}) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(game.i18n.lang, options);
}

/**
 * Format a date and time for display
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString(game.i18n.lang);
}
