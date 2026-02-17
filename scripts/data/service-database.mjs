/**
 * Bob's Talking NPCs - Service Database
 * Centralized database of reusable service templates.
 * Stored in a world setting and merged with built-in defaults.
 */

const MODULE_ID = "bobs-talking-npcs";
import { generateId } from "../utils/helpers.mjs";
import { ServiceType, ServiceCategory } from "./merchant-model.mjs";

/**
 * Create a service template definition.
 * Templates are stored in the service database and referenced by shops.
 * @param {object} data
 * @returns {object}
 */
export function createServiceTemplate(data = {}) {
  return {
    id: data.id || generateId(),
    type: data.type || ServiceType.REPAIR,
    category: data.category || ServiceCategory.MISC,
    name: data.name || "",
    description: data.description || "",
    icon: data.icon || "fa-cog",

    // Pricing
    basePrice: data.basePrice ?? 0,
    priceType: data.priceType || "fixed",
    currency: data.currency || "gp",

    // Approval
    defaultApprovalMode: data.defaultApprovalMode || "auto", // "auto" | "request"

    // Duration
    hasDuration: data.hasDuration ?? false,
    durationUnit: data.durationUnit || "hours",
    baseDuration: data.baseDuration ?? 0,

    // Requirements
    requiresItem: data.requiresItem ?? false,
    validItemTypes: data.validItemTypes || [],

    // Execution
    executorId: data.executorId || null,
    customData: data.customData || {},

    // Metadata
    isBuiltIn: data.isBuiltIn ?? false,
    isCustom: data.isCustom ?? true,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  };
}

/**
 * Built-in default service templates.
 * These are the "factory" templates seeded on first load.
 */
const BUILT_IN_TEMPLATES = [
  // === CRAFTING SERVICES ===
  { type: "repair", category: "crafting", name: "Repair", description: "Restore a damaged item to working condition.", icon: "fa-wrench", basePrice: 0, priceType: "percent", requiresItem: true, defaultApprovalMode: "request" },
  { type: "sharpen", category: "crafting", name: "Sharpen", description: "Hone a blade or point to razor sharpness.", icon: "fa-slash", basePrice: 5, requiresItem: true, defaultApprovalMode: "request" },
  { type: "reinforce", category: "crafting", name: "Reinforce", description: "Strengthen an item's structure.", icon: "fa-shield-halved", basePrice: 0, priceType: "percent", requiresItem: true, defaultApprovalMode: "request" },
  { type: "resize", category: "crafting", name: "Resize", description: "Adjust armor or clothing to fit a new wearer.", icon: "fa-ruler", basePrice: 0, priceType: "percent", requiresItem: true, defaultApprovalMode: "request" },
  { type: "customOrder", category: "crafting", name: "Custom Order", description: "Commission a custom-made item.", icon: "fa-hammer", basePrice: 50, defaultApprovalMode: "request" },
  { type: "alterations", category: "crafting", name: "Alterations", description: "Modify clothing or robes for a new wearer.", icon: "fa-scissors", basePrice: 10, requiresItem: true, defaultApprovalMode: "auto" },
  { type: "polish", category: "crafting", name: "Polish", description: "Clean and polish an item to a shine.", icon: "fa-sparkles", basePrice: 2, requiresItem: true, defaultApprovalMode: "auto" },
  { type: "engrave", category: "crafting", name: "Engrave", description: "Etch designs or text into metal or stone.", icon: "fa-pen-nib", basePrice: 15, requiresItem: true, defaultApprovalMode: "auto" },
  { type: "silvering", category: "crafting", name: "Silvering", description: "Coat a weapon in silver to overcome resistance.", icon: "fa-wand-sparkles", basePrice: 100, requiresItem: true, defaultApprovalMode: "request", hasDuration: true, durationUnit: "days", baseDuration: 3 },
  { type: "hafting", category: "crafting", name: "Hafting", description: "Replace a broken handle on a weapon or tool.", icon: "fa-hammer", basePrice: 5, requiresItem: true, defaultApprovalMode: "auto" },
  { type: "bladeHoning", category: "crafting", name: "Blade Honing", description: "Sharpen to a razor edge. +1 damage for 24 hours.", icon: "fa-khanda", basePrice: 10, requiresItem: true, defaultApprovalMode: "auto" },
  { type: "refitting", category: "crafting", name: "Refit Armor", description: "Resize heavy armor to fit a specific wearer.", icon: "fa-vest", basePrice: 0, priceType: "percent", requiresItem: true, defaultApprovalMode: "request" },
  { type: "armorSpikes", category: "crafting", name: "Armor Spikes", description: "Add spikes to armor. Grappling foes take 1d4 piercing.", icon: "fa-burst", basePrice: 25, requiresItem: true, defaultApprovalMode: "request" },
  { type: "heraldry", category: "crafting", name: "Heraldry", description: "Etch or paint a noble crest onto a shield.", icon: "fa-shield", basePrice: 20, requiresItem: true, defaultApprovalMode: "auto" },
  { type: "smelting", category: "crafting", name: "Smelting", description: "Process raw ore into tradeable ingots.", icon: "fa-fire", basePrice: 5, defaultApprovalMode: "auto" },
  { type: "refining", category: "crafting", name: "Refining", description: "Purify raw materials into higher-quality form.", icon: "fa-flask-vial", basePrice: 10, defaultApprovalMode: "auto" },
  { type: "scrapMelting", category: "crafting", name: "Scrap Melting", description: "Melt down looted armor into raw metal bars.", icon: "fa-dumpster-fire", basePrice: 3, requiresItem: true, defaultApprovalMode: "auto" },
  { type: "shoeing", category: "crafting", name: "Horse Shoeing", description: "Fit iron shoes to a mount.", icon: "fa-horse", basePrice: 8, defaultApprovalMode: "auto" },
  { type: "hoofCare", category: "crafting", name: "Hoof Care", description: "Treat and trim a mount's hooves.", icon: "fa-horse-head", basePrice: 5, defaultApprovalMode: "auto" },
  { type: "keyCutting", category: "crafting", name: "Key Cutting", description: "Copy an existing key.", icon: "fa-key", basePrice: 10, defaultApprovalMode: "auto" },
  { type: "lockOpening", category: "crafting", name: "Lock Opening", description: "Open a lock without the key.", icon: "fa-lock-open", basePrice: 25, defaultApprovalMode: "auto" },
  { type: "stonework", category: "crafting", name: "Stonework", description: "Cut and shape stone blocks.", icon: "fa-cubes-stacked", basePrice: 20, defaultApprovalMode: "request" },
  { type: "cooperage", category: "crafting", name: "Cooperage", description: "Build barrels, crates, or containers.", icon: "fa-box", basePrice: 5, defaultApprovalMode: "auto" },
  { type: "woodworking", category: "crafting", name: "Woodworking", description: "Craft or repair wooden items.", icon: "fa-tree", basePrice: 10, requiresItem: false, defaultApprovalMode: "auto" },
  { type: "cobbling", category: "crafting", name: "Cobbling", description: "Repair or make footwear.", icon: "fa-shoe-prints", basePrice: 5, requiresItem: true, defaultApprovalMode: "auto" },
  { type: "leatherwork", category: "crafting", name: "Leatherworking", description: "Craft or repair leather goods.", icon: "fa-vest-patches", basePrice: 10, requiresItem: true, defaultApprovalMode: "auto" },
  { type: "tanning", category: "crafting", name: "Tanning", description: "Process raw hides into cured leather.", icon: "fa-cow", basePrice: 5, defaultApprovalMode: "auto" },
  { type: "dyeing", category: "crafting", name: "Dyeing", description: "Change the color of cloth or leather.", icon: "fa-palette", basePrice: 3, requiresItem: true, defaultApprovalMode: "auto" },
  { type: "weaving", category: "crafting", name: "Weaving", description: "Weave cloth on a loom.", icon: "fa-grip-lines", basePrice: 5, defaultApprovalMode: "auto" },
  { type: "ropeMaking", category: "crafting", name: "Rope Making", description: "Braid hemp, silk, or wire rope.", icon: "fa-link", basePrice: 2, defaultApprovalMode: "auto" },
  { type: "fletching", category: "crafting", name: "Fletching", description: "Make arrows, bolts, or darts.", icon: "fa-bullseye", basePrice: 1, defaultApprovalMode: "auto" },
  { type: "glasswork", category: "crafting", name: "Glassblowing", description: "Craft vials, bottles, or windows.", icon: "fa-wine-glass", basePrice: 5, defaultApprovalMode: "auto" },
  { type: "candleMaking", category: "crafting", name: "Candle Making", description: "Make candles, torches, or lamp oil.", icon: "fa-candle-holder", basePrice: 1, defaultApprovalMode: "auto" },
  { type: "pottery", category: "crafting", name: "Pottery", description: "Craft jars, urns, bowls, or tiles.", icon: "fa-jar", basePrice: 2, defaultApprovalMode: "auto" },
  { type: "paperMaking", category: "crafting", name: "Paper Making", description: "Produce paper or parchment.", icon: "fa-scroll", basePrice: 1, defaultApprovalMode: "auto" },

  // === MAGIC SERVICES ===
  { type: "identify", category: "magic", name: "Identify", description: "Reveal the properties of a magical item.", icon: "fa-magnifying-glass", basePrice: 25, requiresItem: true, defaultApprovalMode: "auto" },
  { type: "enchant", category: "magic", name: "Enchant Item", description: "Apply a magical enchantment to an item.", icon: "fa-wand-magic-sparkles", basePrice: 100, requiresItem: true, defaultApprovalMode: "request", hasDuration: true, durationUnit: "days", baseDuration: 7 },
  { type: "disenchant", category: "magic", name: "Disenchant", description: "Remove magical properties from an item.", icon: "fa-ban", basePrice: 50, requiresItem: true, defaultApprovalMode: "request" },
  { type: "recharge", category: "magic", name: "Recharge", description: "Refill charges on a staff or wand.", icon: "fa-bolt", basePrice: 75, requiresItem: true, defaultApprovalMode: "request" },
  { type: "removeCurse", category: "magic", name: "Remove Curse", description: "Break a curse on a creature or item.", icon: "fa-hand-sparkles", basePrice: 150, defaultApprovalMode: "request" },
  { type: "scribeScroll", category: "magic", name: "Scribe Scroll", description: "Copy a spell onto a scroll.", icon: "fa-scroll", basePrice: 50, defaultApprovalMode: "request", hasDuration: true, durationUnit: "days", baseDuration: 3 },
  { type: "brewPotion", category: "magic", name: "Brew Potion", description: "Brew a magical potion.", icon: "fa-flask", basePrice: 50, defaultApprovalMode: "request", hasDuration: true, durationUnit: "days", baseDuration: 2 },
  { type: "spellCopying", category: "magic", name: "Spell Copying", description: "Transcribe a spell into a spellbook.", icon: "fa-book-sparkles", basePrice: 25, defaultApprovalMode: "auto" },

  // === APPRAISAL ===
  { type: "appraise", category: "crafting", name: "Appraise", description: "Determine the monetary value of an item.", icon: "fa-gem", basePrice: 5, requiresItem: true, defaultApprovalMode: "auto" },
  { type: "authenticate", category: "crafting", name: "Authenticate", description: "Verify the authenticity of an item.", icon: "fa-certificate", basePrice: 10, requiresItem: true, defaultApprovalMode: "auto" },

  // === HEALING SERVICES ===
  { type: "healing", category: "healing", name: "Healing", description: "Restore hit points through divine or natural means.", icon: "fa-heart", basePrice: 25, defaultApprovalMode: "auto", customData: { healAmount: 0 } },
  { type: "cureDisease", category: "healing", name: "Cure Disease", description: "Remove a disease affliction.", icon: "fa-virus-slash", basePrice: 50, defaultApprovalMode: "auto" },
  { type: "curePoison", category: "healing", name: "Cure Poison", description: "Neutralize poison in a creature's body.", icon: "fa-flask-vial", basePrice: 25, defaultApprovalMode: "auto" },
  { type: "restoration", category: "healing", name: "Restoration", description: "Restore ability scores and remove debilitating conditions.", icon: "fa-sparkles", basePrice: 100, defaultApprovalMode: "request" },
  { type: "resurrection", category: "healing", name: "Resurrection", description: "Raise a fallen companion from the dead.", icon: "fa-cross", basePrice: 1000, defaultApprovalMode: "request" },
  { type: "blessing", category: "healing", name: "Blessing", description: "Receive a divine blessing granting temporary benefits.", icon: "fa-hand-sparkles", basePrice: 10, defaultApprovalMode: "auto" },

  // === LODGING SERVICES ===
  { type: "roomCommon", category: "lodging", name: "Common Room", description: "A bed of hay in the common room.", icon: "fa-bed", basePrice: 0.05, defaultApprovalMode: "auto" },
  { type: "roomPrivate", category: "lodging", name: "Private Room", description: "A private room with a door that locks.", icon: "fa-door-closed", basePrice: 0.5, defaultApprovalMode: "auto" },
  { type: "roomSuite", category: "lodging", name: "Suite", description: "A luxurious suite with fine furnishings.", icon: "fa-crown", basePrice: 2, defaultApprovalMode: "auto" },
  { type: "longRest", category: "lodging", name: "Long Rest", description: "A full night's rest to recover hit points and abilities.", icon: "fa-bed", basePrice: 0.5, defaultApprovalMode: "auto" },
  { type: "shortRest", category: "lodging", name: "Short Rest", description: "A brief respite to catch your breath.", icon: "fa-mug-hot", basePrice: 0.1, defaultApprovalMode: "auto" },
  { type: "bath", category: "lodging", name: "Bath", description: "A warm bath to clean up and relax.", icon: "fa-bath", basePrice: 0.1, defaultApprovalMode: "auto" },
  { type: "laundry", category: "lodging", name: "Laundry", description: "Have your clothes cleaned.", icon: "fa-shirt", basePrice: 0.05, defaultApprovalMode: "auto" },

  // === FOOD & DRINK ===
  { type: "mealPoor", category: "foodDrink", name: "Poor Meal", description: "A simple bowl of gruel or bread.", icon: "fa-bowl-rice", basePrice: 0.01, defaultApprovalMode: "auto" },
  { type: "mealModest", category: "foodDrink", name: "Modest Meal", description: "Stew, bread, and ale.", icon: "fa-utensils", basePrice: 0.03, defaultApprovalMode: "auto" },
  { type: "mealComfortable", category: "foodDrink", name: "Comfortable Meal", description: "Roast meat, fresh bread, and decent wine.", icon: "fa-drumstick-bite", basePrice: 0.1, defaultApprovalMode: "auto" },
  { type: "mealWealthy", category: "foodDrink", name: "Wealthy Meal", description: "Fine dining with exotic dishes.", icon: "fa-plate-wheat", basePrice: 0.5, defaultApprovalMode: "auto" },
  { type: "drinks", category: "foodDrink", name: "Drinks", description: "Ale, wine, or spirits.", icon: "fa-beer-mug-empty", basePrice: 0.02, defaultApprovalMode: "auto" },
  { type: "rations", category: "foodDrink", name: "Trail Rations", description: "Preserved food for the road.", icon: "fa-apple-whole", basePrice: 0.5, defaultApprovalMode: "auto" },
  { type: "feast", category: "foodDrink", name: "Feast", description: "A grand banquet for many guests.", icon: "fa-champagne-glasses", basePrice: 10, defaultApprovalMode: "request" },

  // === TRAINING ===
  { type: "skillTraining", category: "training", name: "Skill Training", description: "Train in a specific skill over time.", icon: "fa-graduation-cap", basePrice: 25, defaultApprovalMode: "request", hasDuration: true, durationUnit: "days", baseDuration: 1 },
  { type: "weaponTraining", category: "training", name: "Weapon Training", description: "Learn to use a new type of weapon.", icon: "fa-swords", basePrice: 25, defaultApprovalMode: "request", hasDuration: true, durationUnit: "days", baseDuration: 1 },
  { type: "toolTraining", category: "training", name: "Tool Training", description: "Learn to use a set of tools.", icon: "fa-screwdriver-wrench", basePrice: 25, defaultApprovalMode: "request", hasDuration: true, durationUnit: "days", baseDuration: 1 },
  { type: "languageTraining", category: "training", name: "Language Training", description: "Learn a new language.", icon: "fa-language", basePrice: 25, defaultApprovalMode: "request", hasDuration: true, durationUnit: "days", baseDuration: 1 },
  { type: "sparring", category: "training", name: "Sparring", description: "Practice combat for a temporary buff.", icon: "fa-hand-fist", basePrice: 5, defaultApprovalMode: "auto" },

  // === INFORMATION ===
  { type: "rumors", category: "information", name: "Rumors", description: "Hear the latest gossip and news.", icon: "fa-ear-listen", basePrice: 1, defaultApprovalMode: "auto" },
  { type: "mapPurchase", category: "information", name: "Map Purchase", description: "Buy a map of the local area.", icon: "fa-map", basePrice: 10, defaultApprovalMode: "auto" },
  { type: "guideHire", category: "information", name: "Hire Guide", description: "Hire a local guide for the wilderness.", icon: "fa-compass", basePrice: 5, defaultApprovalMode: "request" },
  { type: "translation", category: "information", name: "Translation", description: "Translate foreign or ancient text.", icon: "fa-language", basePrice: 10, defaultApprovalMode: "auto" },
  { type: "research", category: "information", name: "Research", description: "Research a topic in local archives.", icon: "fa-book", basePrice: 10, defaultApprovalMode: "auto" },
  { type: "loreResearch", category: "information", name: "Lore Research", description: "Delve into arcane or historical lore.", icon: "fa-scroll", basePrice: 25, defaultApprovalMode: "auto" },
  { type: "fortuneTelling", category: "information", name: "Fortune Telling", description: "Have your fortune read by a seer.", icon: "fa-crystal-ball", basePrice: 5, defaultApprovalMode: "auto" },

  // === TRANSPORT ===
  { type: "horseRental", category: "transport", name: "Horse Rental", description: "Rent a riding horse for the day.", icon: "fa-horse", basePrice: 1, defaultApprovalMode: "auto" },
  { type: "horsePurchase", category: "transport", name: "Horse Purchase", description: "Buy a horse.", icon: "fa-horse", basePrice: 75, defaultApprovalMode: "request" },
  { type: "horseBoarding", category: "transport", name: "Horse Boarding", description: "Board a mount at the stable.", icon: "fa-house-chimney", basePrice: 0.5, defaultApprovalMode: "auto" },
  { type: "cartRental", category: "transport", name: "Cart Rental", description: "Rent a cart or wagon for the day.", icon: "fa-cart-flatbed", basePrice: 2, defaultApprovalMode: "auto" },
  { type: "passageBook", category: "transport", name: "Book Passage", description: "Book passage on a ship or caravan.", icon: "fa-ship", basePrice: 10, defaultApprovalMode: "request" },

  // === STORAGE / FINANCIAL ===
  { type: "itemStorage", category: "storage", name: "Item Storage", description: "Rent a storage space for belongings.", icon: "fa-warehouse", basePrice: 1, defaultApprovalMode: "auto" },
  { type: "safeDeposit", category: "storage", name: "Safe Deposit", description: "Rent a secure vault for valuables.", icon: "fa-vault", basePrice: 5, defaultApprovalMode: "auto" },
  { type: "currencyExchange", category: "financial", name: "Currency Exchange", description: "Convert coins between denominations.", icon: "fa-money-bill-transfer", basePrice: 0, defaultApprovalMode: "auto" },
  { type: "loan", category: "financial", name: "Loan", description: "Borrow money at interest.", icon: "fa-hand-holding-dollar", basePrice: 0, defaultApprovalMode: "request" },
  { type: "pawn", category: "financial", name: "Pawn Item", description: "Sell an item for quick cash at reduced value.", icon: "fa-scale-balanced", basePrice: 0, requiresItem: true, defaultApprovalMode: "auto" },
  { type: "bail", category: "financial", name: "Bail", description: "Pay to release someone from jail.", icon: "fa-gavel", basePrice: 50, defaultApprovalMode: "request" },

  // === ENTERTAINMENT ===
  { type: "gambling", category: "entertainment", name: "Gambling", description: "Try your luck at cards, dice, or dragonchess.", icon: "fa-dice", basePrice: 1, defaultApprovalMode: "auto" },
  { type: "performance", category: "entertainment", name: "Performance", description: "Watch or participate in entertainment.", icon: "fa-masks-theater", basePrice: 1, defaultApprovalMode: "auto" },
  { type: "arenaFight", category: "entertainment", name: "Arena Fight", description: "Compete in arena combat.", icon: "fa-shield-halved", basePrice: 5, defaultApprovalMode: "request" },

  // === LEGAL ===
  { type: "contract", category: "legal", name: "Draft Contract", description: "Have a legal contract drafted.", icon: "fa-file-contract", basePrice: 10, defaultApprovalMode: "auto" },
  { type: "license", category: "legal", name: "Purchase License", description: "Obtain an official permit or license.", icon: "fa-id-card", basePrice: 25, defaultApprovalMode: "request" },
  { type: "bountyPost", category: "legal", name: "Post Bounty", description: "Post an official bounty or wanted poster.", icon: "fa-scroll", basePrice: 50, defaultApprovalMode: "request" },

  // === BODY CARE ===
  { type: "haircut", category: "bodyCare", name: "Haircut", description: "A fresh cut and grooming.", icon: "fa-scissors", basePrice: 0.05, defaultApprovalMode: "auto" },
  { type: "shave", category: "bodyCare", name: "Shave", description: "A close shave with a straight razor.", icon: "fa-scissors", basePrice: 0.02, defaultApprovalMode: "auto" },
  { type: "dentistry", category: "bodyCare", name: "Dentistry", description: "Have a tooth pulled or treated.", icon: "fa-tooth", basePrice: 1, defaultApprovalMode: "auto" },
  { type: "minorSurgery", category: "bodyCare", name: "Minor Surgery", description: "Stitching, bone-setting, or leech therapy.", icon: "fa-syringe", basePrice: 10, defaultApprovalMode: "request" },
  { type: "bathing", category: "bodyCare", name: "Bathhouse Visit", description: "A luxurious bath with heated pools.", icon: "fa-hot-tub-person", basePrice: 0.5, defaultApprovalMode: "auto" },
  { type: "massageService", category: "bodyCare", name: "Massage", description: "Remove a level of exhaustion.", icon: "fa-hands", basePrice: 2, defaultApprovalMode: "auto" },
  { type: "burialService", category: "bodyCare", name: "Burial", description: "A proper burial or cremation.", icon: "fa-cross", basePrice: 5, defaultApprovalMode: "auto" },
  { type: "embalming", category: "bodyCare", name: "Embalming", description: "Preserve a body to pause the Raise Dead timer.", icon: "fa-bandage", basePrice: 25, defaultApprovalMode: "request" },

  // === ANIMAL ===
  { type: "animalTraining", category: "animal", name: "Animal Training", description: "Teach a pet a new trick.", icon: "fa-dog", basePrice: 10, defaultApprovalMode: "request", hasDuration: true, durationUnit: "days", baseDuration: 7 },
  { type: "animalHealing", category: "animal", name: "Animal Healing", description: "Treat an injured mount or companion.", icon: "fa-paw", basePrice: 5, defaultApprovalMode: "auto" },
  { type: "falconry", category: "animal", name: "Falconry Service", description: "Hire a hunting bird or clear pests.", icon: "fa-dove", basePrice: 5, defaultApprovalMode: "auto" },

  // === ARTS ===
  { type: "portrait", category: "arts", name: "Portrait", description: "Have a portrait painted to increase renown.", icon: "fa-image", basePrice: 25, defaultApprovalMode: "request", hasDuration: true, durationUnit: "days", baseDuration: 3 },
  { type: "instrumentRepair", category: "arts", name: "Instrument Repair", description: "Fix a damaged musical instrument.", icon: "fa-guitar", basePrice: 10, requiresItem: true, defaultApprovalMode: "auto" },

  // === MARITIME ===
  { type: "shipRepair", category: "maritime", name: "Ship Repair", description: "Repair a ship's hull or rigging.", icon: "fa-ship", basePrice: 100, defaultApprovalMode: "request", hasDuration: true, durationUnit: "days", baseDuration: 7 },
  { type: "docking", category: "maritime", name: "Docking", description: "Assign a slip for your vessel.", icon: "fa-anchor", basePrice: 2, defaultApprovalMode: "auto" },
  { type: "seaCharts", category: "maritime", name: "Sea Charts", description: "Purchase navigational charts.", icon: "fa-map", basePrice: 15, defaultApprovalMode: "auto" },

  // === CIVIC ===
  { type: "taxCollection", category: "civic", name: "Pay Taxes", description: "Pay your civic taxes and dues.", icon: "fa-building-columns", basePrice: 0, defaultApprovalMode: "auto" },
  { type: "landDeed", category: "civic", name: "Land Deed", description: "Purchase a deed to land.", icon: "fa-file-contract", basePrice: 100, defaultApprovalMode: "request" },
  { type: "finePayment", category: "civic", name: "Pay Fine", description: "Pay off a legal fine.", icon: "fa-gavel", basePrice: 0, defaultApprovalMode: "auto" },

  // === MILITARY / ILLICIT ===
  { type: "hireMercenary", category: "entertainment", name: "Hire Mercenary", description: "Hire a bodyguard or soldier.", icon: "fa-person-military-rifle", basePrice: 50, defaultApprovalMode: "request" },
  { type: "fencingStolen", category: "financial", name: "Fence Goods", description: "Sell stolen goods, no questions asked.", icon: "fa-mask", basePrice: 0, requiresItem: true, defaultApprovalMode: "request" },
  { type: "disguiseService", category: "entertainment", name: "Disguise", description: "Get a convincing disguise.", icon: "fa-masks-theater", basePrice: 10, defaultApprovalMode: "auto" },
  { type: "hideService", category: "lodging", name: "Lay Low", description: "Hide from pursuers for a time.", icon: "fa-eye-slash", basePrice: 5, defaultApprovalMode: "request" },
];

/**
 * Service Database Class
 * Manages the centralized collection of service templates.
 */
export class ServiceDatabase {
  constructor() {
    this._cache = new Map();
    this._initialized = false;
  }

  /**
   * Initialize the database - load from settings and merge with built-ins.
   */
  async initialize() {
    if (this._initialized) return;

    try {
      // Load custom templates from world settings
      const stored = game.settings.get(MODULE_ID, "serviceDatabase") || {};
      const customTemplates = stored.templates || [];

      // Load built-in templates
      for (const data of BUILT_IN_TEMPLATES) {
        const template = createServiceTemplate({
          ...data,
          id: `builtin_${data.type}`,
          isBuiltIn: true,
          isCustom: false
        });
        this._cache.set(template.id, template);
      }

      // Load custom templates (override built-ins if same ID)
      for (const data of customTemplates) {
        const template = createServiceTemplate(data);
        this._cache.set(template.id, template);
      }

      this._initialized = true;
      console.log(`${MODULE_ID} | Service Database initialized with ${this._cache.size} templates`);
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to initialize Service Database:`, error);
      this._initialized = true; // Don't retry
    }
  }

  /**
   * Get a template by ID
   * @param {string} id
   * @returns {object|null}
   */
  getTemplate(id) {
    return this._cache.get(id) || null;
  }

  /**
   * Get a template by service type (returns the first match, preferring built-in)
   * @param {string} serviceType
   * @returns {object|null}
   */
  getTemplateByType(serviceType) {
    for (const template of this._cache.values()) {
      if (template.type === serviceType) return template;
    }
    return null;
  }

  /**
   * Get all templates
   * @returns {object[]}
   */
  getAllTemplates() {
    return [...this._cache.values()];
  }

  /**
   * Get templates grouped by category
   * @returns {Object<string, object[]>}
   */
  getTemplatesByCategory(category = null) {
    const all = this.getAllTemplates();
    if (category) {
      return all.filter(t => t.category === category);
    }
    // Group by category
    const grouped = {};
    for (const t of all) {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push(t);
    }
    return grouped;
  }

  /**
   * Create a new custom template
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createTemplate(data) {
    const template = createServiceTemplate({
      ...data,
      isBuiltIn: false,
      isCustom: true
    });
    this._cache.set(template.id, template);
    await this._save();
    return template;
  }

  /**
   * Update an existing template
   * @param {string} id
   * @param {object} updates
   * @returns {Promise<object|null>}
   */
  async updateTemplate(id, updates) {
    const existing = this._cache.get(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    this._cache.set(id, updated);
    await this._save();
    return updated;
  }

  /**
   * Delete a custom template (cannot delete built-ins)
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteTemplate(id) {
    const template = this._cache.get(id);
    if (!template || template.isBuiltIn) return false;

    this._cache.delete(id);
    await this._save();
    return true;
  }

  /**
   * Reset to defaults (removes all custom templates)
   * @returns {Promise<void>}
   */
  async resetToDefaults() {
    this._cache.clear();
    for (const data of BUILT_IN_TEMPLATES) {
      const template = createServiceTemplate({
        ...data,
        id: `builtin_${data.type}`,
        isBuiltIn: true,
        isCustom: false
      });
      this._cache.set(template.id, template);
    }
    await this._save();
  }

  /**
   * Get the count of templates
   * @returns {number}
   */
  get size() {
    return this._cache.size;
  }

  /**
   * Save custom templates to world settings
   * @private
   */
  async _save() {
    const customTemplates = [];
    for (const template of this._cache.values()) {
      if (template.isCustom || !template.isBuiltIn) {
        customTemplates.push(template);
      }
    }

    try {
      await game.settings.set(MODULE_ID, "serviceDatabase", {
        templates: customTemplates,
        savedAt: Date.now()
      });
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to save Service Database:`, error);
    }
  }
}
