/**
 * Bob's Talking NPCs - Merchant Data Model
 * Defines the structure for shops, inventory, and pricing
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";
import { generateId } from "../utils/helpers.mjs";

/**
 * Shop type enum
 */
export const ShopType = Object.freeze({
  GENERAL: "general",
  WEAPONS: "weapons",
  ARMOR: "armor",
  MAGIC: "magic",
  POTIONS: "potions",
  SCROLLS: "scrolls",
  TOOLS: "tools",
  FOOD: "food",
  JEWELRY: "jewelry",
  BLACKSMITH: "blacksmith",
  TAILOR: "tailor",
  STABLE: "stable",
  INN: "inn",
  BLACK_MARKET: "blackMarket",
  CUSTOM: "custom"
});

/**
 * Stock refresh type enum
 */
export const StockRefreshType = Object.freeze({
  NEVER: "never",
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  ON_VISIT: "onVisit",
  CUSTOM: "custom"
});

/**
 * Item rarity enum (matches D&D 5e)
 */
export const ItemRarity = Object.freeze({
  COMMON: "common",
  UNCOMMON: "uncommon",
  RARE: "rare",
  VERY_RARE: "veryRare",
  LEGENDARY: "legendary",
  ARTIFACT: "artifact"
});

/**
 * Price display mode enum
 */
export const PriceDisplayMode = Object.freeze({
  EXACT: "exact",
  GOLD_DOWN: "goldDown",
  ALL: "all",
  RANGE: "range",
  HIDDEN: "hidden",
  ASK: "ask"
});

/**
 * Currency denomination enum
 */
export const Currency = Object.freeze({
  COPPER: "cp",
  SILVER: "sp",
  ELECTRUM: "ep",
  GOLD: "gp",
  PLATINUM: "pp"
});

/**
 * Item category enum for shop filtering
 */
export const ItemCategory = Object.freeze({
  WEAPONS: "weapons",
  ARMOR: "armor",
  GEAR: "gear",
  POTIONS: "potions",
  SCROLLS: "scrolls",
  CONSUMABLES: "consumables",
  TOOLS: "tools",
  MISC: "misc",
  ALL: "all"
});

/**
 * Service category enum - groups services by business type
 */
export const ServiceCategory = Object.freeze({
  CRAFTING: "crafting",       // Blacksmith, tailor, etc.
  MAGIC: "magic",             // Enchanting, identifying, etc.
  LODGING: "lodging",         // Inn rooms, long rests, etc.
  TRANSPORT: "transport",     // Stables, cart rental, etc.
  FOOD_DRINK: "foodDrink",    // Meals, drinks, rations
  ENTERTAINMENT: "entertainment", // Gambling, performances
  INFORMATION: "information", // Rumors, maps, quests
  STORAGE: "storage",         // Item storage, bank vaults
  TRAINING: "training",       // Skill training, proficiencies
  HEALING: "healing",         // Temple healing, curses, etc.
  LEGAL: "legal",             // Contracts, licenses, etc.
  MISC: "misc"                // Other services
});

/**
 * Service type enum - specific services that can be offered
 */
export const ServiceType = Object.freeze({
  // Crafting Services (Blacksmith, Tailor, Jeweler, etc.)
  REPAIR: "repair",
  SHARPEN: "sharpen",
  REINFORCE: "reinforce",
  RESIZE: "resize",
  CUSTOM_ORDER: "customOrder",
  ALTERATIONS: "alterations",
  POLISH: "polish",
  ENGRAVE: "engrave",

  // Magic Services (Magic Shop, Wizard, Temple)
  IDENTIFY: "identify",
  ENCHANT: "enchant",
  DISENCHANT: "disenchant",
  RECHARGE: "recharge",
  ATTUNE: "attune",
  SCRIBE_SCROLL: "scribeScroll",
  BREW_POTION: "brewPotion",
  REMOVE_CURSE: "removeCurse",

  // Appraisal Services
  APPRAISE: "appraise",
  AUTHENTICATE: "authenticate",

  // Lodging Services (Inn, Tavern)
  ROOM_COMMON: "roomCommon",
  ROOM_PRIVATE: "roomPrivate",
  ROOM_SUITE: "roomSuite",
  LONG_REST: "longRest",
  SHORT_REST: "shortRest",
  BATH: "bath",
  LAUNDRY: "laundry",

  // Food & Drink Services
  MEAL_POOR: "mealPoor",
  MEAL_MODEST: "mealModest",
  MEAL_COMFORTABLE: "mealComfortable",
  MEAL_WEALTHY: "mealWealthy",
  DRINKS: "drinks",
  RATIONS: "rations",
  FEAST: "feast",

  // Transport Services (Stable, Docks, Caravan)
  HORSE_RENTAL: "horseRental",
  HORSE_PURCHASE: "horsePurchase",
  HORSE_BOARDING: "horseBoarding",
  CART_RENTAL: "cartRental",
  CARRIAGE_RENTAL: "carriageRental",
  MOUNT_CARE: "mountCare",
  WAGON_REPAIR: "wagonRepair",
  PASSAGE_BOOK: "passageBook",

  // Storage Services (Bank, Warehouse)
  ITEM_STORAGE: "itemStorage",
  SAFE_DEPOSIT: "safeDeposit",
  CURRENCY_EXCHANGE: "currencyExchange",
  MONEY_TRANSFER: "moneyTransfer",

  // Information Services
  RUMORS: "rumors",
  MAP_PURCHASE: "mapPurchase",
  GUIDE_HIRE: "guideHire",
  TRANSLATION: "translation",
  RESEARCH: "research",

  // Training Services
  SKILL_TRAINING: "skillTraining",
  WEAPON_TRAINING: "weaponTraining",
  TOOL_TRAINING: "toolTraining",
  LANGUAGE_TRAINING: "languageTraining",
  SPARRING: "sparring",

  // Healing Services (Temple, Healer)
  HEALING: "healing",
  CURE_DISEASE: "cureDisease",
  CURE_POISON: "curePoison",
  RESTORATION: "restoration",
  RESURRECTION: "resurrection",
  BLESSING: "blessing",

  // Entertainment Services
  GAMBLING: "gambling",
  PERFORMANCE: "performance",
  FORTUNE_TELLING: "fortuneTelling",
  ARENA_FIGHT: "arenaFight",

  // Legal Services
  CONTRACT: "contract",
  LICENSE: "license",
  BOUNTY_POST: "bountyPost",
  NOTARY: "notary"
});

/**
 * Create a service definition
 * @param {object} data - Service data
 * @returns {object}
 */
export function createServiceDefinition(data = {}) {
  return {
    id: data.id || data.type || generateId(),
    type: data.type || ServiceType.REPAIR,
    category: data.category || ServiceCategory.MISC,
    name: data.name || "",
    description: data.description || "",
    icon: data.icon || "fa-cog",

    // Pricing
    enabled: data.enabled ?? false,
    basePrice: data.basePrice ?? 0,
    priceType: data.priceType || "fixed",  // fixed, percent, perDay, perItem, variable
    pricePercent: data.pricePercent ?? 0,  // For percent-based pricing
    pricePerUnit: data.pricePerUnit ?? 0,  // For per-day/per-item pricing
    currency: data.currency || "gp",

    // Duration
    hasDuration: data.hasDuration ?? false,
    durationUnit: data.durationUnit || "hours",  // hours, days, weeks
    baseDuration: data.baseDuration ?? 1,
    durationOptions: data.durationOptions || [],  // [{duration, price, label}]

    // Requirements
    requiresItem: data.requiresItem ?? false,
    validItemTypes: data.validItemTypes || [],  // Which item types can use this service
    requiresPayment: data.requiresPayment ?? true,
    requiresGMApproval: data.requiresGMApproval ?? false,

    // Results
    appliesEffect: data.appliesEffect || null,  // Active effect to apply
    modifiesItem: data.modifiesItem ?? false,
    createsItem: data.createsItem ?? false,
    outputItemUuid: data.outputItemUuid || null,

    // Availability
    dailyLimit: data.dailyLimit ?? 0,  // 0 = unlimited
    usesRemaining: data.usesRemaining ?? -1,
    cooldownHours: data.cooldownHours ?? 0,

    // Custom data for specific service types
    customData: data.customData || {}
  };
}

/**
 * Get default services for a shop type
 * @param {string} shopType - Shop type from ShopType enum
 * @returns {object[]} Array of service definitions
 */
export function getDefaultServicesForShopType(shopType) {
  const services = [];

  switch (shopType) {
    case ShopType.BLACKSMITH:
      services.push(
        createServiceDefinition({
          type: ServiceType.REPAIR,
          category: ServiceCategory.CRAFTING,
          name: "Repair Item",
          description: "Repair damaged weapons and armor",
          icon: "fa-wrench",
          enabled: true,
          priceType: "percent",
          pricePercent: 10,
          requiresItem: true,
          validItemTypes: ["weapon", "equipment"]
        }),
        createServiceDefinition({
          type: ServiceType.SHARPEN,
          category: ServiceCategory.CRAFTING,
          name: "Sharpen Weapon",
          description: "Sharpen a blade for improved performance",
          icon: "fa-swords",
          enabled: true,
          basePrice: 5,
          requiresItem: true,
          validItemTypes: ["weapon"]
        }),
        createServiceDefinition({
          type: ServiceType.CUSTOM_ORDER,
          category: ServiceCategory.CRAFTING,
          name: "Custom Order",
          description: "Commission a custom piece of equipment",
          icon: "fa-hammer",
          enabled: true,
          priceType: "variable",
          requiresGMApproval: true,
          hasDuration: true,
          durationUnit: "days",
          baseDuration: 7
        })
      );
      break;

    case ShopType.INN:
      services.push(
        createServiceDefinition({
          type: ServiceType.ROOM_COMMON,
          category: ServiceCategory.LODGING,
          name: "Common Room",
          description: "Sleep in the common room with other travelers",
          icon: "fa-bed",
          enabled: true,
          basePrice: 0.05,
          priceType: "perDay",
          pricePerUnit: 0.05,
          hasDuration: true,
          durationUnit: "days"
        }),
        createServiceDefinition({
          type: ServiceType.ROOM_PRIVATE,
          category: ServiceCategory.LODGING,
          name: "Private Room",
          description: "A private room with a bed and basic amenities",
          icon: "fa-door-closed",
          enabled: true,
          basePrice: 0.5,
          priceType: "perDay",
          pricePerUnit: 0.5,
          hasDuration: true,
          durationUnit: "days"
        }),
        createServiceDefinition({
          type: ServiceType.ROOM_SUITE,
          category: ServiceCategory.LODGING,
          name: "Suite",
          description: "Luxurious accommodations with premium amenities",
          icon: "fa-crown",
          enabled: true,
          basePrice: 2,
          priceType: "perDay",
          pricePerUnit: 2,
          hasDuration: true,
          durationUnit: "days"
        }),
        createServiceDefinition({
          type: ServiceType.MEAL_MODEST,
          category: ServiceCategory.FOOD_DRINK,
          name: "Hot Meal",
          description: "A filling hot meal",
          icon: "fa-utensils",
          enabled: true,
          basePrice: 0.03
        }),
        createServiceDefinition({
          type: ServiceType.DRINKS,
          category: ServiceCategory.FOOD_DRINK,
          name: "Drinks",
          description: "Ale, wine, or other beverages",
          icon: "fa-beer-mug-empty",
          enabled: true,
          basePrice: 0.04
        }),
        createServiceDefinition({
          type: ServiceType.LONG_REST,
          category: ServiceCategory.LODGING,
          name: "Long Rest",
          description: "Rest in comfort and recover fully",
          icon: "fa-moon",
          enabled: true,
          basePrice: 1,
          hasDuration: true,
          durationUnit: "hours",
          baseDuration: 8
        })
      );
      break;

    case ShopType.STABLE:
      services.push(
        createServiceDefinition({
          type: ServiceType.HORSE_BOARDING,
          category: ServiceCategory.TRANSPORT,
          name: "Horse Boarding",
          description: "Stable and feed your horse",
          icon: "fa-horse",
          enabled: true,
          basePrice: 0.5,
          priceType: "perDay",
          pricePerUnit: 0.5,
          hasDuration: true,
          durationUnit: "days"
        }),
        createServiceDefinition({
          type: ServiceType.HORSE_RENTAL,
          category: ServiceCategory.TRANSPORT,
          name: "Horse Rental",
          description: "Rent a horse for travel",
          icon: "fa-horse-head",
          enabled: true,
          basePrice: 2,
          priceType: "perDay",
          pricePerUnit: 2,
          hasDuration: true,
          durationUnit: "days"
        }),
        createServiceDefinition({
          type: ServiceType.CART_RENTAL,
          category: ServiceCategory.TRANSPORT,
          name: "Cart Rental",
          description: "Rent a cart for hauling goods",
          icon: "fa-trailer",
          enabled: true,
          basePrice: 1,
          priceType: "perDay",
          pricePerUnit: 1,
          hasDuration: true,
          durationUnit: "days"
        }),
        createServiceDefinition({
          type: ServiceType.CARRIAGE_RENTAL,
          category: ServiceCategory.TRANSPORT,
          name: "Carriage Rental",
          description: "Rent a carriage for comfortable travel",
          icon: "fa-carriage",
          enabled: true,
          basePrice: 5,
          priceType: "perDay",
          pricePerUnit: 5,
          hasDuration: true,
          durationUnit: "days"
        }),
        createServiceDefinition({
          type: ServiceType.MOUNT_CARE,
          category: ServiceCategory.TRANSPORT,
          name: "Mount Grooming",
          description: "Full grooming and care for your mount",
          icon: "fa-brush",
          enabled: true,
          basePrice: 1
        })
      );
      break;

    case ShopType.MAGIC:
      services.push(
        createServiceDefinition({
          type: ServiceType.IDENTIFY,
          category: ServiceCategory.MAGIC,
          name: "Identify Item",
          description: "Identify the magical properties of an item",
          icon: "fa-magnifying-glass",
          enabled: true,
          basePrice: 25,
          requiresItem: true
        }),
        createServiceDefinition({
          type: ServiceType.ENCHANT,
          category: ServiceCategory.MAGIC,
          name: "Enchant Item",
          description: "Apply a magical enchantment to an item",
          icon: "fa-wand-magic-sparkles",
          enabled: true,
          priceType: "variable",
          requiresItem: true,
          validItemTypes: ["weapon", "equipment"],
          requiresGMApproval: true,
          hasDuration: true,
          durationUnit: "days",
          baseDuration: 3
        }),
        createServiceDefinition({
          type: ServiceType.REMOVE_CURSE,
          category: ServiceCategory.MAGIC,
          name: "Remove Curse",
          description: "Remove a curse from an item or person",
          icon: "fa-hand-sparkles",
          enabled: true,
          basePrice: 100,
          requiresGMApproval: true
        }),
        createServiceDefinition({
          type: ServiceType.SCRIBE_SCROLL,
          category: ServiceCategory.MAGIC,
          name: "Scribe Scroll",
          description: "Have a spell scroll created",
          icon: "fa-scroll",
          enabled: true,
          priceType: "variable",
          requiresGMApproval: true,
          hasDuration: true,
          durationUnit: "days"
        })
      );
      break;

    case ShopType.TAILOR:
      services.push(
        createServiceDefinition({
          type: ServiceType.ALTERATIONS,
          category: ServiceCategory.CRAFTING,
          name: "Alterations",
          description: "Adjust clothing to fit perfectly",
          icon: "fa-scissors",
          enabled: true,
          basePrice: 2,
          requiresItem: true,
          validItemTypes: ["equipment"]
        }),
        createServiceDefinition({
          type: ServiceType.REPAIR,
          category: ServiceCategory.CRAFTING,
          name: "Mend Clothing",
          description: "Repair torn or damaged clothing",
          icon: "fa-needle",
          enabled: true,
          priceType: "percent",
          pricePercent: 5,
          requiresItem: true,
          validItemTypes: ["equipment"]
        }),
        createServiceDefinition({
          type: ServiceType.CUSTOM_ORDER,
          category: ServiceCategory.CRAFTING,
          name: "Custom Tailoring",
          description: "Commission custom clothing or robes",
          icon: "fa-shirt",
          enabled: true,
          priceType: "variable",
          requiresGMApproval: true,
          hasDuration: true,
          durationUnit: "days",
          baseDuration: 5
        })
      );
      break;

    default:
      // General services available to most shops
      services.push(
        createServiceDefinition({
          type: ServiceType.APPRAISE,
          category: ServiceCategory.MISC,
          name: "Appraise Item",
          description: "Get an expert appraisal of an item's value",
          icon: "fa-coins",
          enabled: false,
          basePrice: 5,
          requiresItem: true
        })
      );
  }

  return services;
}

/**
 * Create a shop inventory item
 * @param {object} data - Item data
 * @returns {object}
 */
export function createShopItem(data = {}) {
  return {
    id: data.id || generateId(),
    itemUuid: data.itemUuid || null,        // Reference to compendium/world item
    name: data.name || "",                   // Display name override
    quantity: data.quantity ?? -1,           // -1 = unlimited
    maxQuantity: data.maxQuantity ?? -1,     // For restocking

    // Pricing
    basePrice: data.basePrice ?? null,       // null = use item price
    priceOverride: data.priceOverride ?? null,
    buyMultiplier: data.buyMultiplier ?? 1.0,  // Shop's buy price multiplier
    sellMultiplier: data.sellMultiplier ?? 0.5, // What shop pays for items

    // Availability
    available: data.available ?? true,
    hidden: data.hidden ?? false,

    // Requirements
    requirements: {
      level: data.requirements?.level ?? 0,
      factionId: data.requirements?.factionId || null,
      factionRank: data.requirements?.factionRank || null,
      reputation: data.requirements?.reputation ?? 0,
      questCompleted: data.requirements?.questCompleted || null,
      custom: data.requirements?.custom || null
    },

    // Stock management
    restockQuantity: data.restockQuantity ?? 0,
    lastRestocked: data.lastRestocked || null,

    // Display
    featured: data.featured ?? false,
    sortOrder: data.sortOrder ?? 0,
    notes: data.notes || ""
  };
}

/**
 * Create a category for shop organization
 * @param {object} data - Category data
 * @returns {object}
 */
export function createShopCategory(data = {}) {
  return {
    id: data.id || generateId(),
    name: data.name || "New Category",
    icon: data.icon || "fa-box",
    color: data.color || null,
    sortOrder: data.sortOrder ?? 0,
    collapsed: data.collapsed ?? false,
    items: data.items || []  // Array of shop item IDs
  };
}

/**
 * Create merchant pricing configuration
 * @param {object} data - Pricing data
 * @returns {object}
 */
export function createPricingConfig(data = {}) {
  return {
    // Base multipliers
    baseBuyMultiplier: data.baseBuyMultiplier ?? 1.0,
    baseSellMultiplier: data.baseSellMultiplier ?? 0.5,

    // Price display
    displayMode: data.displayMode || PriceDisplayMode.EXACT,
    roundPrices: data.roundPrices ?? true,
    roundTo: data.roundTo || "sp",  // Round to nearest denomination

    // Charisma effects
    charismaAffectsPrices: data.charismaAffectsPrices ?? true,
    charismaMultiplierBuy: data.charismaMultiplierBuy ?? 0.02,   // Per CHA modifier
    charismaMultiplierSell: data.charismaMultiplierSell ?? 0.02,
    maxCharismaDiscount: data.maxCharismaDiscount ?? 0.2,  // 20% max

    // Faction/reputation discounts
    factionDiscounts: data.factionDiscounts || [],  // Array of {factionId, discount}
    reputationThresholds: data.reputationThresholds || [
      { minimum: 100, discount: 0.05 },
      { minimum: 300, discount: 0.10 },
      { minimum: 500, discount: 0.15 }
    ],

    // Rarity multipliers
    rarityMultipliers: {
      [ItemRarity.COMMON]: data.rarityMultipliers?.[ItemRarity.COMMON] ?? 1.0,
      [ItemRarity.UNCOMMON]: data.rarityMultipliers?.[ItemRarity.UNCOMMON] ?? 1.0,
      [ItemRarity.RARE]: data.rarityMultipliers?.[ItemRarity.RARE] ?? 1.2,
      [ItemRarity.VERY_RARE]: data.rarityMultipliers?.[ItemRarity.VERY_RARE] ?? 1.5,
      [ItemRarity.LEGENDARY]: data.rarityMultipliers?.[ItemRarity.LEGENDARY] ?? 2.0,
      [ItemRarity.ARTIFACT]: data.rarityMultipliers?.[ItemRarity.ARTIFACT] ?? 3.0
    },

    // Currency preferences
    preferredCurrency: data.preferredCurrency || Currency.GOLD,
    acceptedCurrencies: data.acceptedCurrencies || Object.values(Currency)
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

    // Skill DCs
    persuasionDC: data.persuasionDC ?? 15,
    intimidationDC: data.intimidationDC ?? 18,
    deceptionDC: data.deceptionDC ?? 16,
    insightDC: data.insightDC ?? 14,  // To gauge merchant's minimum

    // Success effects
    successDiscount: data.successDiscount ?? 0.1,
    criticalSuccessDiscount: data.criticalSuccessDiscount ?? 0.2,

    // Failure consequences
    failureConsequences: {
      persuasion: data.failureConsequences?.persuasion || "none",
      intimidation: data.failureConsequences?.intimidation || "price_increase",
      deception: data.failureConsequences?.deception || "refuse_service"
    },
    failurePriceIncrease: data.failurePriceIncrease ?? 0.1,

    // Service refusal
    refuseServiceDuration: data.refuseServiceDuration || "session",
    refuseServiceMessage: data.refuseServiceMessage || "I don't think we can do business today.",

    // Attempt limits
    maxAttempts: data.maxAttempts ?? 1,
    attemptsPerItem: data.attemptsPerItem ?? false,  // Per item or per transaction
    cooldownHours: data.cooldownHours ?? 24,

    // Minimum price floor
    minimumDiscount: data.minimumDiscount ?? 0,
    maximumDiscount: data.maximumDiscount ?? 0.3,  // 30% max total discount

    // Track haggling history
    history: data.history || {}  // {actorUuid: {attempts, lastAttempt, banned}}
  };
}

/**
 * Create stock refresh configuration
 * @param {object} data - Refresh data
 * @returns {object}
 */
export function createStockRefreshConfig(data = {}) {
  return {
    type: data.type || StockRefreshType.WEEKLY,
    interval: data.interval ?? 7,  // Days for custom interval
    lastRefresh: data.lastRefresh || null,

    // Partial refresh options
    partialRefresh: data.partialRefresh ?? true,
    refreshPercent: data.refreshPercent ?? 0.5,  // 50% of stock refreshes

    // Randomization
    randomizeQuantities: data.randomizeQuantities ?? true,
    quantityVariance: data.quantityVariance ?? 0.3,  // +/- 30%

    // New item chance
    newItemChance: data.newItemChance ?? 0.1,
    newItemPool: data.newItemPool || []  // Compendium UUIDs for random additions
  };
}

/**
 * Create a complete merchant/shop configuration
 * @param {object} data - Merchant data
 * @returns {object}
 */
export function createMerchant(data = {}) {
  return {
    id: data.id || generateId(),
    name: data.name || "Shop",
    description: data.description || "",
    type: data.type || ShopType.GENERAL,
    customType: data.customType || null,

    // Visual
    icon: data.icon || "fa-store",
    color: data.color || "#ff9800",
    bannerImage: data.bannerImage || null,

    // Inventory - Storefront (visible to players)
    inventory: (data.inventory || []).map(item => createShopItem(item)),
    categories: (data.categories || []).map(cat => createShopCategory(cat)),
    useCategories: data.useCategories ?? true,

    // Back Room Inventory (hidden from players, GM only)
    backroom: {
      enabled: data.backroom?.enabled ?? true,
      inventory: (data.backroom?.inventory || []).map(item => createShopItem(item)),
      // Where items go when players sell to shop
      autoAddPurchasedItems: data.backroom?.autoAddPurchasedItems ?? true,
      // Notes for the GM
      notes: data.backroom?.notes || ""
    },

    // Pricing
    pricing: createPricingConfig(data.pricing || {}),

    // Haggling
    haggling: createHagglingConfig(data.haggling || {}),

    // Stock management
    stockRefresh: createStockRefreshConfig(data.stockRefresh || {}),

    // Buy back (shop buying from players)
    buyBack: {
      enabled: data.buyBack?.enabled ?? true,
      itemTypes: data.buyBack?.itemTypes || [],  // Empty = all types
      excludeTypes: data.buyBack?.excludeTypes || [],
      maxValue: data.buyBack?.maxValue ?? 0,  // 0 = no limit
      requireIdentified: data.buyBack?.requireIdentified ?? true,
      excludeEquipped: data.buyBack?.excludeEquipped ?? true,
      excludeAttuned: data.buyBack?.excludeAttuned ?? true,
      // Per-type sell multipliers (what shop pays for each item type)
      typeMultipliers: {
        weapon: data.buyBack?.typeMultipliers?.weapon ?? 0.5,
        equipment: data.buyBack?.typeMultipliers?.equipment ?? 0.5,
        consumable: data.buyBack?.typeMultipliers?.consumable ?? 0.4,
        tool: data.buyBack?.typeMultipliers?.tool ?? 0.5,
        loot: data.buyBack?.typeMultipliers?.loot ?? 0.6
      }
    },

    // Services offered
    services: {
      identify: data.services?.identify ?? false,
      identifyPrice: data.services?.identifyPrice ?? 25,
      repair: data.services?.repair ?? false,
      repairPricePercent: data.services?.repairPricePercent ?? 0.1,
      enchant: data.services?.enchant ?? false,
      enchantPrices: data.services?.enchantPrices || {},
      appraise: data.services?.appraise ?? false,
      appraisePrice: data.services?.appraisePrice ?? 10
    },

    // Access control
    access: {
      factionRequired: data.access?.factionRequired || null,
      factionRankRequired: data.access?.factionRankRequired || null,
      reputationRequired: data.access?.reputationRequired ?? 0,
      questRequired: data.access?.questRequired || null,
      levelRequired: data.access?.levelRequired ?? 0,
      closedMessage: data.access?.closedMessage || "This shop is not available to you."
    },

    // Schedule (references NPC schedule if linked)
    useNPCSchedule: data.useNPCSchedule ?? true,
    customSchedule: data.customSchedule || null,

    // Currency drawer (shop's money for change/buying)
    drawer: {
      unlimited: data.drawer?.unlimited ?? true,
      cp: data.drawer?.cp ?? 0,
      sp: data.drawer?.sp ?? 0,
      ep: data.drawer?.ep ?? 0,
      gp: data.drawer?.gp ?? 1000,
      pp: data.drawer?.pp ?? 0
    },

    // Transaction history
    trackTransactions: data.trackTransactions ?? true,
    transactions: data.transactions || [],  // Array of transaction records

    // Linked NPC
    npcActorUuid: data.npcActorUuid || null,

    // Metadata
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
    createdBy: data.createdBy || null
  };
}

/**
 * Create a transaction record
 * @param {object} data - Transaction data
 * @returns {object}
 */
export function createTransaction(data = {}) {
  return {
    id: data.id || generateId(),
    timestamp: data.timestamp || Date.now(),
    type: data.type || "buy",  // buy, sell, service

    // Parties
    buyerUuid: data.buyerUuid || null,
    sellerUuid: data.sellerUuid || null,
    shopId: data.shopId || null,

    // Items
    items: data.items || [],  // Array of {itemUuid, quantity, price}

    // Total
    totalPrice: data.totalPrice ?? 0,
    currency: data.currency || Currency.GOLD,

    // Discounts applied
    discounts: {
      haggling: data.discounts?.haggling ?? 0,
      reputation: data.discounts?.reputation ?? 0,
      charisma: data.discounts?.charisma ?? 0,
      faction: data.discounts?.faction ?? 0,
      total: data.discounts?.total ?? 0
    },

    // Service details (if applicable)
    service: data.service || null,

    // Notes
    notes: data.notes || ""
  };
}

/**
 * Calculate item price with all modifiers
 * @param {object} shopItem - Shop item data
 * @param {object} merchant - Merchant data
 * @param {object} context - Context {actor, faction standings, etc.}
 * @param {string} transactionType - "buy" or "sell"
 * @returns {object} {basePrice, finalPrice, discounts}
 */
export function calculatePrice(shopItem, merchant, context = {}, transactionType = "buy") {
  const pricing = merchant.pricing;
  const isBuying = transactionType === "buy";

  // Get base price
  let basePrice = shopItem.priceOverride ?? shopItem.basePrice ?? 0;

  // Apply base multiplier
  const baseMultiplier = isBuying ? pricing.baseBuyMultiplier : pricing.baseSellMultiplier;
  let price = basePrice * baseMultiplier;

  // Apply item-specific multiplier
  const itemMultiplier = isBuying ? shopItem.buyMultiplier : shopItem.sellMultiplier;
  price *= itemMultiplier;

  // Track discounts
  const discounts = {
    charisma: 0,
    reputation: 0,
    faction: 0,
    total: 0
  };

  // Apply charisma modifier
  if (pricing.charismaAffectsPrices && context.charismaModifier !== undefined) {
    const charismaEffect = context.charismaModifier *
      (isBuying ? pricing.charismaMultiplierBuy : pricing.charismaMultiplierSell);
    const cappedEffect = Math.min(charismaEffect, pricing.maxCharismaDiscount);

    if (isBuying) {
      discounts.charisma = price * cappedEffect;
      price -= discounts.charisma;
    } else {
      discounts.charisma = price * cappedEffect;
      price += discounts.charisma;
    }
  }

  // Apply faction discount
  if (context.factionId && pricing.factionDiscounts) {
    const factionDiscount = pricing.factionDiscounts.find(
      fd => fd.factionId === context.factionId
    );
    if (factionDiscount && isBuying) {
      discounts.faction = price * factionDiscount.discount;
      price -= discounts.faction;
    }
  }

  // Apply reputation discount
  if (context.reputation && pricing.reputationThresholds && isBuying) {
    const applicableThreshold = [...pricing.reputationThresholds]
      .sort((a, b) => b.minimum - a.minimum)
      .find(t => context.reputation >= t.minimum);

    if (applicableThreshold) {
      discounts.reputation = price * applicableThreshold.discount;
      price -= discounts.reputation;
    }
  }

  // Calculate total discount
  discounts.total = discounts.charisma + discounts.reputation + discounts.faction;

  // Round price
  if (pricing.roundPrices) {
    price = roundPrice(price, pricing.roundTo);
  }

  // Ensure minimum price
  price = Math.max(price, isBuying ? 1 : 0);

  return {
    basePrice,
    finalPrice: Math.round(price * 100) / 100,
    discounts
  };
}

/**
 * Round price to nearest denomination
 * @param {number} price - Price in gold
 * @param {string} roundTo - Denomination to round to
 * @returns {number}
 */
export function roundPrice(price, roundTo = "sp") {
  const denominations = {
    [Currency.COPPER]: 0.01,
    [Currency.SILVER]: 0.1,
    [Currency.ELECTRUM]: 0.5,
    [Currency.GOLD]: 1,
    [Currency.PLATINUM]: 10
  };

  const unit = denominations[roundTo] || 0.1;
  return Math.round(price / unit) * unit;
}

/**
 * Convert price to currency breakdown
 * @param {number} priceInGold - Price in gold pieces
 * @returns {object} {pp, gp, ep, sp, cp}
 */
export function convertToCurrency(priceInGold) {
  const totalCopper = Math.round(priceInGold * 100);

  const pp = Math.floor(totalCopper / 1000);
  const remainder1 = totalCopper % 1000;

  const gp = Math.floor(remainder1 / 100);
  const remainder2 = remainder1 % 100;

  const ep = Math.floor(remainder2 / 50);
  const remainder3 = remainder2 % 50;

  const sp = Math.floor(remainder3 / 10);
  const cp = remainder3 % 10;

  return { pp, gp, ep, sp, cp };
}

/**
 * Convert currency breakdown to gold value
 * @param {object} currency - {pp, gp, ep, sp, cp}
 * @returns {number} Value in gold pieces
 */
export function convertToGold(currency) {
  return (
    (currency.pp || 0) * 10 +
    (currency.gp || 0) +
    (currency.ep || 0) * 0.5 +
    (currency.sp || 0) * 0.1 +
    (currency.cp || 0) * 0.01
  );
}

/**
 * Check if player can access a shop
 * @param {object} merchant - Merchant data
 * @param {object} context - {actor, factionStandings, completedQuests}
 * @returns {object} {canAccess: boolean, reason: string}
 */
export function checkShopAccess(merchant, context = {}) {
  const access = merchant.access;

  // Check level requirement
  if (access.levelRequired > 0) {
    const actorLevel = context.actor?.system?.details?.level || 0;
    if (actorLevel < access.levelRequired) {
      return {
        canAccess: false,
        reason: `Requires level ${access.levelRequired}`
      };
    }
  }

  // Check faction requirement
  if (access.factionRequired) {
    const standing = context.factionStandings?.[access.factionRequired];
    if (!standing) {
      return {
        canAccess: false,
        reason: "Requires faction membership"
      };
    }

    // Check faction rank
    if (access.factionRankRequired && standing.rank !== access.factionRankRequired) {
      return {
        canAccess: false,
        reason: `Requires faction rank: ${access.factionRankRequired}`
      };
    }
  }

  // Check reputation requirement
  if (access.reputationRequired > 0) {
    const reputation = context.reputation || 0;
    if (reputation < access.reputationRequired) {
      return {
        canAccess: false,
        reason: `Requires ${access.reputationRequired} reputation`
      };
    }
  }

  // Check quest requirement
  if (access.questRequired) {
    const completed = context.completedQuests || [];
    if (!completed.includes(access.questRequired)) {
      return {
        canAccess: false,
        reason: "Requires quest completion"
      };
    }
  }

  return { canAccess: true, reason: null };
}

/**
 * Check if item requirements are met
 * @param {object} shopItem - Shop item data
 * @param {object} context - Player context
 * @returns {object} {canPurchase: boolean, reason: string}
 */
export function checkItemRequirements(shopItem, context = {}) {
  const reqs = shopItem.requirements;

  if (!shopItem.available) {
    return { canPurchase: false, reason: "Item not available" };
  }

  if (shopItem.hidden) {
    return { canPurchase: false, reason: "Item is hidden" };
  }

  if (shopItem.quantity === 0) {
    return { canPurchase: false, reason: "Out of stock" };
  }

  // Check level
  if (reqs.level > 0) {
    const actorLevel = context.actor?.system?.details?.level || 0;
    if (actorLevel < reqs.level) {
      return { canPurchase: false, reason: `Requires level ${reqs.level}` };
    }
  }

  // Check faction
  if (reqs.factionId) {
    const standing = context.factionStandings?.[reqs.factionId];
    if (!standing) {
      return { canPurchase: false, reason: "Requires faction membership" };
    }

    if (reqs.factionRank && standing.rank !== reqs.factionRank) {
      return { canPurchase: false, reason: `Requires rank: ${reqs.factionRank}` };
    }

    if (reqs.reputation > 0 && (standing.reputation || 0) < reqs.reputation) {
      return { canPurchase: false, reason: `Requires ${reqs.reputation} reputation` };
    }
  }

  // Check quest
  if (reqs.questCompleted) {
    const completed = context.completedQuests || [];
    if (!completed.includes(reqs.questCompleted)) {
      return { canPurchase: false, reason: "Requires quest completion" };
    }
  }

  return { canPurchase: true, reason: null };
}

/**
 * Refresh shop stock based on configuration
 * @param {object} merchant - Merchant data
 * @returns {object} Updated merchant data
 */
export function refreshStock(merchant) {
  const config = merchant.stockRefresh;
  const now = Date.now();

  const updatedInventory = merchant.inventory.map(item => {
    // Skip items with unlimited stock
    if (item.maxQuantity === -1) {
      return item;
    }

    let newQuantity = item.quantity;

    if (config.partialRefresh) {
      // Partial refresh - restore some stock
      const toRestore = Math.ceil(item.maxQuantity * config.refreshPercent);
      newQuantity = Math.min(item.quantity + toRestore, item.maxQuantity);
    } else {
      // Full refresh - restore to max
      newQuantity = item.maxQuantity;
    }

    // Apply variance if enabled
    if (config.randomizeQuantities && newQuantity > 0) {
      const variance = Math.floor(newQuantity * config.quantityVariance);
      const adjustment = Math.floor(Math.random() * (variance * 2 + 1)) - variance;
      newQuantity = Math.max(0, newQuantity + adjustment);
    }

    return {
      ...item,
      quantity: newQuantity,
      lastRestocked: now
    };
  });

  return {
    ...merchant,
    inventory: updatedInventory,
    stockRefresh: {
      ...config,
      lastRefresh: now
    },
    updatedAt: now
  };
}

/**
 * Validate merchant data
 * @param {object} merchant - Merchant data
 * @returns {object} {valid: boolean, errors: string[], warnings: string[]}
 */
export function validateMerchant(merchant) {
  const errors = [];
  const warnings = [];

  if (!merchant.id) errors.push("Merchant ID is required");
  if (!merchant.name?.trim()) errors.push("Shop name is required");

  // Check inventory items
  for (const item of merchant.inventory || []) {
    if (!item.itemUuid && !item.name) {
      warnings.push(`Item ${item.id} has no item reference or name`);
    }
    if (item.basePrice === null && !item.itemUuid) {
      warnings.push(`Item ${item.name || item.id} has no price set`);
    }
  }

  // Check pricing config
  if (merchant.pricing.baseBuyMultiplier < 0) {
    errors.push("Buy multiplier cannot be negative");
  }
  if (merchant.pricing.baseSellMultiplier < 0) {
    errors.push("Sell multiplier cannot be negative");
  }

  // Check haggling config
  if (merchant.haggling.enabled) {
    if (merchant.haggling.maximumDiscount > 1) {
      errors.push("Maximum haggling discount cannot exceed 100%");
    }
    if (merchant.haggling.successDiscount > merchant.haggling.maximumDiscount) {
      warnings.push("Success discount exceeds maximum discount");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Merchant templates for quick creation
 */
export const MerchantTemplates = {
  general_store: {
    name: "General Store",
    type: ShopType.GENERAL,
    icon: "fa-store",
    pricing: createPricingConfig({
      baseBuyMultiplier: 1.0,
      baseSellMultiplier: 0.5
    }),
    haggling: createHagglingConfig({ enabled: true }),
    buyBack: { enabled: true }
  },

  blacksmith: {
    name: "Blacksmith",
    type: ShopType.BLACKSMITH,
    icon: "fa-hammer",
    pricing: createPricingConfig({
      baseBuyMultiplier: 1.1,
      baseSellMultiplier: 0.6
    }),
    services: {
      repair: true,
      repairPricePercent: 0.1
    },
    buyBack: {
      enabled: true,
      itemTypes: ["weapon", "equipment"],
      typeMultipliers: {
        weapon: 0.55,      // Blacksmith pays more for weapons
        equipment: 0.6     // Best rates for armor
      }
    }
  },

  alchemist: {
    name: "Alchemist",
    type: ShopType.POTIONS,
    icon: "fa-flask",
    pricing: createPricingConfig({
      baseBuyMultiplier: 1.2,
      baseSellMultiplier: 0.4
    }),
    services: {
      identify: true,
      identifyPrice: 25
    },
    buyBack: {
      enabled: true,
      itemTypes: ["consumable"],
      typeMultipliers: {
        consumable: 0.5    // Alchemist pays better for potions
      }
    }
  },

  magic_shop: {
    name: "Magic Shop",
    type: ShopType.MAGIC,
    icon: "fa-wand-sparkles",
    pricing: createPricingConfig({
      baseBuyMultiplier: 1.5,
      baseSellMultiplier: 0.3,
      rarityMultipliers: {
        [ItemRarity.UNCOMMON]: 1.2,
        [ItemRarity.RARE]: 1.5,
        [ItemRarity.VERY_RARE]: 2.0,
        [ItemRarity.LEGENDARY]: 3.0
      }
    }),
    services: {
      identify: true,
      identifyPrice: 50,
      enchant: true
    },
    haggling: createHagglingConfig({
      enabled: true,
      persuasionDC: 18,
      maximumDiscount: 0.15
    }),
    buyBack: {
      enabled: true,
      requireIdentified: true
    }
  },

  fence: {
    name: "Fence",
    type: ShopType.BLACK_MARKET,
    icon: "fa-mask",
    color: "#4a4a4a",
    pricing: createPricingConfig({
      baseBuyMultiplier: 1.5,
      baseSellMultiplier: 0.7,
      displayMode: PriceDisplayMode.ASK
    }),
    haggling: createHagglingConfig({
      enabled: true,
      persuasionDC: 12,
      deceptionDC: 14,
      maximumDiscount: 0.25
    }),
    buyBack: {
      enabled: true,
      typeMultipliers: {
        weapon: 0.65,      // Good rates on hot weapons
        equipment: 0.6,
        consumable: 0.5,
        tool: 0.55,
        loot: 0.75         // Best rates on gems and jewelry
      }
    },
    access: {
      reputationRequired: -50  // Need some notoriety
    }
  },

  inn: {
    name: "Inn & Tavern",
    type: ShopType.INN,
    icon: "fa-beer-mug-empty",
    pricing: createPricingConfig({
      baseBuyMultiplier: 1.0,
      baseSellMultiplier: 0.3
    }),
    services: {
      room: true,
      roomPrices: {
        common: 5,   // sp
        private: 20, // sp
        suite: 100   // sp
      }
    },
    buyBack: { enabled: false }
  },

  blank: {
    name: "New Shop",
    type: ShopType.CUSTOM,
    pricing: createPricingConfig({}),
    haggling: createHagglingConfig({ enabled: false }),
    buyBack: { enabled: true }
  }
};

/**
 * Create merchant from template
 * @param {string} templateName - Template name
 * @param {object} overrides - Data overrides
 * @returns {object}
 */
export function createMerchantFromTemplate(templateName, overrides = {}) {
  const template = MerchantTemplates[templateName] || MerchantTemplates.blank;
  return createMerchant({
    ...template,
    ...overrides
  });
}
