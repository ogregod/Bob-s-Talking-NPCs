import { BusinessType, BusinessCategory, ShopType, ShopDisplayMode, ServiceType, ServiceCategory, createServiceDefinition, createMerchant } from "./merchant-model.mjs";

export const BusinessTypeRegistry = new Map();

// ============================================================================
// CATEGORY I: THE FORGE, STONE, & EARTH (Heavy Industry)
// ============================================================================

// 1. Village Blacksmith
BusinessTypeRegistry.set(BusinessType.VILLAGE_BLACKSMITH, {
  type: BusinessType.VILLAGE_BLACKSMITH,
  category: BusinessCategory.FORGE_STONE_EARTH,
  name: "Village Blacksmith",
  subtitle: "General Smithing",
  description: "A soot-stained open-air workshop where iron meets fire. The ring of hammer on anvil echoes through the village from dawn to dusk.",
  icon: "fa-hammer",
  color: "#8B4513",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: ShopType.BLACKSMITH,
  pricing: { baseBuyMultiplier: 1.1, baseSellMultiplier: 0.6 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: true, itemTypes: ["weapon", "equipment", "tool"] },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.REPAIR, category: ServiceCategory.CRAFTING, name: "Repair Equipment", description: "Mend damaged weapons, armor, and tools back to working order", icon: "fa-wrench", basePrice: 10, priceType: "percent" },
    { type: ServiceType.SHARPEN, category: ServiceCategory.CRAFTING, name: "Sharpen Blade", description: "Hone a dull edge to razor sharpness on the grinding wheel", icon: "fa-swords", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.CRAFTING, name: "Custom Forging", description: "Commission a bespoke piece of ironwork to your exact specifications", icon: "fa-fire", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.REINFORCE, category: ServiceCategory.CRAFTING, name: "Reinforce Armor", description: "Strengthen weak points in armor with additional rivets and plating", icon: "fa-shield-halved", basePrice: 15, priceType: "percent" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.SHOEING, sourceType: BusinessType.FARRIER, category: ServiceCategory.CRAFTING, name: "Basic Horseshoeing", description: "Simple horseshoeing for common mounts", icon: "fa-horse-head", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.KEY_CUTTING, sourceType: BusinessType.LOCKSMITH, category: ServiceCategory.CRAFTING, name: "Cut a Simple Key", description: "Forge a basic iron key from a template", icon: "fa-key", basePrice: 3, priceType: "fixed" }
  ],
  tags: ["smith", "metal", "repair", "forge"]
});

// 2. Master Weaponsmith
BusinessTypeRegistry.set(BusinessType.MASTER_WEAPONSMITH, {
  type: BusinessType.MASTER_WEAPONSMITH,
  category: BusinessCategory.FORGE_STONE_EARTH,
  name: "Master Weaponsmith",
  subtitle: "Master Weaponsmith",
  description: "A prestigious forge where master artisans craft blades of legendary quality. The walls display swords that have turned the tide of wars.",
  icon: "fa-gavel",
  color: "#B22222",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: ShopType.WEAPONS,
  pricing: { baseBuyMultiplier: 1.3, baseSellMultiplier: 0.55 },
  haggling: { enabled: true, persuasionDC: 16 },
  buyBack: { enabled: true, itemTypes: ["weapon"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.SHARPEN, category: ServiceCategory.CRAFTING, name: "Expert Sharpening", description: "A master's edge that can split a hair lengthwise", icon: "fa-swords", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.BLADE_HONING, category: ServiceCategory.CRAFTING, name: "Blade Honing", description: "Precision honing to restore a blade's perfect geometry", icon: "fa-staff-snake", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.SILVERING, category: ServiceCategory.CRAFTING, name: "Silver a Weapon", description: "Coat a weapon in alchemical silver to strike creatures of the night", icon: "fa-moon", basePrice: 100, priceType: "fixed" },
    { type: ServiceType.HAFTING, category: ServiceCategory.CRAFTING, name: "Hafting & Pommel Work", description: "Replace or upgrade a weapon's haft, grip, or pommel", icon: "fa-hammer", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.CRAFTING, name: "Commission Masterwork", description: "Commission a weapon crafted to exacting standards by a true master", icon: "fa-fire", basePrice: 200, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.REPAIR, sourceType: BusinessType.VILLAGE_BLACKSMITH, category: ServiceCategory.CRAFTING, name: "Weapon Repair", description: "Mend a damaged weapon back to fighting condition", icon: "fa-wrench", basePrice: 10, priceType: "percent" },
    { type: ServiceType.ENCHANT, sourceType: BusinessType.ENCHANTER, category: ServiceCategory.MAGIC, name: "Enchant Weapon", description: "Imbue a weapon with arcane power through runic forging", icon: "fa-wand-sparkles", basePrice: 250, priceType: "fixed" }
  ],
  tags: ["weapons", "blades", "master", "forge"]
});

// 3. Armorer
BusinessTypeRegistry.set(BusinessType.ARMORER, {
  type: BusinessType.ARMORER,
  category: BusinessCategory.FORGE_STONE_EARTH,
  name: "Armorer",
  subtitle: "Armor Specialist",
  description: "A well-ordered workshop hung with breastplates, hauberks, and shields. Every piece is fitted to protect its wearer against the cruelest blows.",
  icon: "fa-shield-halved",
  color: "#4682B4",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: ShopType.ARMOR,
  pricing: { baseBuyMultiplier: 1.2, baseSellMultiplier: 0.55 },
  haggling: { enabled: true, persuasionDC: 15 },
  buyBack: { enabled: true, itemTypes: ["equipment"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.REPAIR, category: ServiceCategory.CRAFTING, name: "Armor Repair", description: "Hammer out dents, replace broken links, and restore protective integrity", icon: "fa-wrench", basePrice: 15, priceType: "percent" },
    { type: ServiceType.REFITTING, category: ServiceCategory.CRAFTING, name: "Refit Armor", description: "Adjust a suit of armor to fit a new wearer perfectly", icon: "fa-ruler", basePrice: 20, priceType: "percent" },
    { type: ServiceType.ARMOR_SPIKES, category: ServiceCategory.CRAFTING, name: "Add Armor Spikes", description: "Affix wicked iron spikes to a suit of armor", icon: "fa-explosion", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.REINFORCE, category: ServiceCategory.CRAFTING, name: "Reinforce Armor", description: "Add extra plates and rivets to strengthen vulnerable joints", icon: "fa-shield-halved", basePrice: 25, priceType: "percent" },
    { type: ServiceType.HERALDRY, category: ServiceCategory.CRAFTING, name: "Heraldic Engraving", description: "Engrave a coat of arms or sigil onto shield or breastplate", icon: "fa-flag", basePrice: 30, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.LEATHERWORK, sourceType: BusinessType.LEATHERWORKER, category: ServiceCategory.CRAFTING, name: "Leather Strapping", description: "Replace worn leather straps and padding in plate armor", icon: "fa-vest", basePrice: 8, priceType: "fixed" },
    { type: ServiceType.ENCHANT, sourceType: BusinessType.ENCHANTER, category: ServiceCategory.MAGIC, name: "Enchant Armor", description: "Weave protective enchantments into a suit of armor", icon: "fa-wand-sparkles", basePrice: 250, priceType: "fixed" }
  ],
  tags: ["armor", "plate", "mail", "shield"]
});

// 4. Farrier
BusinessTypeRegistry.set(BusinessType.FARRIER, {
  type: BusinessType.FARRIER,
  category: BusinessCategory.FORGE_STONE_EARTH,
  name: "Farrier",
  subtitle: "Horse & Hoof Specialist",
  description: "A low-roofed smithy that smells of hot iron and horse. Steady hands shoe the mounts that carry adventurers across the realm.",
  icon: "fa-horse-head",
  color: "#8B7355",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 12 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.SHOEING, category: ServiceCategory.CRAFTING, name: "Horseshoeing", description: "Fit and nail a fresh set of iron shoes for a mount", icon: "fa-horse-head", basePrice: 8, priceType: "fixed" },
    { type: ServiceType.HOOF_CARE, category: ServiceCategory.CRAFTING, name: "Hoof Trimming & Care", description: "Trim, clean, and treat hooves to prevent lameness", icon: "fa-hand-holding-medical", basePrice: 4, priceType: "fixed" },
    { type: ServiceType.MOUNT_CARE, category: ServiceCategory.TRANSPORT, name: "Full Mount Grooming", description: "A thorough brushing, hoof oiling, and mane braiding for your mount", icon: "fa-brush", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.HORSE_BOARDING, category: ServiceCategory.TRANSPORT, name: "Temporary Stabling", description: "A stall with hay and water while your horse is being shod", icon: "fa-warehouse", basePrice: 2, priceType: "perDay" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.REPAIR, sourceType: BusinessType.VILLAGE_BLACKSMITH, category: ServiceCategory.CRAFTING, name: "Tack Repair", description: "Mend broken bits, stirrups, and horseshoe nails", icon: "fa-wrench", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.ANIMAL_HEALING, sourceType: BusinessType.ANIMAL_HANDLER, category: ServiceCategory.ANIMAL, name: "Treat Lame Horse", description: "Poultice and bandage a lame or injured mount", icon: "fa-heart-pulse", basePrice: 10, priceType: "fixed" }
  ],
  tags: ["horse", "hoof", "farrier", "shoe"]
});

// 5. Locksmith
BusinessTypeRegistry.set(BusinessType.LOCKSMITH, {
  type: BusinessType.LOCKSMITH,
  category: BusinessCategory.FORGE_STONE_EARTH,
  name: "Locksmith",
  subtitle: "Locks & Security",
  description: "A cramped but orderly shop filled with tumblers, picks, and blank keys. The locksmith knows every trick for keeping things in -- or out.",
  icon: "fa-key",
  color: "#696969",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.2, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 15 },
  buyBack: { enabled: true, itemTypes: ["tool"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.KEY_CUTTING, category: ServiceCategory.CRAFTING, name: "Cut a Key", description: "Cut a precision key from a blank or an impression", icon: "fa-key", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.LOCK_OPENING, category: ServiceCategory.CRAFTING, name: "Open a Lock", description: "Defeat a stubborn lock through skill, not brute force", icon: "fa-lock-open", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.REPAIR, category: ServiceCategory.CRAFTING, name: "Repair Lock or Mechanism", description: "Fix a jammed, rusted, or broken lock mechanism", icon: "fa-wrench", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.SECRET_DOORS, category: ServiceCategory.CRAFTING, name: "Install Hidden Lock", description: "Conceal a lock mechanism within a wall, floor, or piece of furniture", icon: "fa-door-closed", basePrice: 75, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.FINE_METALWORK, sourceType: BusinessType.FINE_METALSMITH, category: ServiceCategory.CRAFTING, name: "Decorative Lock Fittings", description: "Ornate escutcheons and keyhole plates in fine metals", icon: "fa-ring", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.TRAP_MAKING, sourceType: BusinessType.ENGINEER_TINKERER, category: ServiceCategory.CRAFTING, name: "Trap a Lock", description: "Rig a lock with a needle trap or alarm mechanism", icon: "fa-skull-crossbones", basePrice: 50, priceType: "fixed" }
  ],
  tags: ["lock", "key", "security", "vault"]
});

// 6. Smelter & Refinery
BusinessTypeRegistry.set(BusinessType.SMELTER_REFINERY, {
  type: BusinessType.SMELTER_REFINERY,
  category: BusinessCategory.FORGE_STONE_EARTH,
  name: "Smelter & Refinery",
  subtitle: "Ore Processing",
  description: "A roaring furnace complex where raw ore is transformed into gleaming ingots. Rivers of molten metal flow through stone channels day and night.",
  icon: "fa-fire-flame-curved",
  color: "#CD853F",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.7 },
  haggling: { enabled: true, persuasionDC: 13 },
  buyBack: { enabled: true, itemTypes: ["loot"] },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.SMELTING, category: ServiceCategory.CRAFTING, name: "Smelt Ore", description: "Fire raw ore in the blast furnace to extract pure metal", icon: "fa-fire-flame-curved", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.REFINING, category: ServiceCategory.CRAFTING, name: "Refine Metal", description: "Purify crude metal into higher-grade ingots through repeated heating", icon: "fa-flask-vial", basePrice: 20, priceType: "fixed" },
    { type: ServiceType.SCRAP_MELTING, category: ServiceCategory.CRAFTING, name: "Melt Scrap", description: "Melt down broken weapons and armor into reusable metal stock", icon: "fa-recycle", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.SLAG_DISPOSAL, category: ServiceCategory.CRAFTING, name: "Slag Disposal", description: "Safe disposal of toxic smelting byproducts and slag heaps", icon: "fa-trash-can", basePrice: 2, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.APPRAISE, sourceType: BusinessType.VILLAGE_BLACKSMITH, category: ServiceCategory.INFORMATION, name: "Appraise Ore", description: "Determine the purity and value of an ore sample", icon: "fa-coins", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.REPAIR, sourceType: BusinessType.VILLAGE_BLACKSMITH, category: ServiceCategory.CRAFTING, name: "Reforge from Ingot", description: "Provide raw metal to have a simple item reforged", icon: "fa-wrench", basePrice: 15, priceType: "fixed" }
  ],
  tags: ["smelter", "ore", "metal", "refine"]
});

// 7. Stonemason
BusinessTypeRegistry.set(BusinessType.STONEMASON, {
  type: BusinessType.STONEMASON,
  category: BusinessCategory.FORGE_STONE_EARTH,
  name: "Stonemason",
  subtitle: "Stone & Architecture",
  description: "A dusty yard of granite blocks and marble slabs. The mason's chisel reveals beauty sleeping within the stone, from castle walls to cathedral gargoyles.",
  icon: "fa-landmark",
  color: "#808080",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.1, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.STONEWORK, category: ServiceCategory.CRAFTING, name: "Stonework", description: "Cut, shape, and lay stone for walls, floors, and foundations", icon: "fa-cubes", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.STATUARY, category: ServiceCategory.CRAFTING, name: "Carve Statue", description: "Sculpt a figure or bust from a block of fine stone", icon: "fa-chess-queen", basePrice: 100, priceType: "fixed" },
    { type: ServiceType.EXCAVATION, category: ServiceCategory.CRAFTING, name: "Excavation Work", description: "Dig cellars, tunnels, or foundations through earth and rock", icon: "fa-mountain", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.STRUCTURAL_REPAIR, category: ServiceCategory.CRAFTING, name: "Structural Repair", description: "Repair crumbling walls, cracked foundations, and damaged masonry", icon: "fa-house-crack", basePrice: 30, priceType: "fixed" },
    { type: ServiceType.SECRET_DOORS, category: ServiceCategory.CRAFTING, name: "Hidden Passage", description: "Construct a concealed door or passage within stonework", icon: "fa-door-closed", basePrice: 200, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.RENOVATION, sourceType: BusinessType.CARPENTER_JOINER, category: ServiceCategory.CRAFTING, name: "Joint Stone & Timber", description: "Coordinate with carpenters to frame stone structures with timber", icon: "fa-tree", basePrice: 40, priceType: "fixed" }
  ],
  tags: ["stone", "mason", "build", "architecture"]
});

// 8. Fine Metalsmith
BusinessTypeRegistry.set(BusinessType.FINE_METALSMITH, {
  type: BusinessType.FINE_METALSMITH,
  category: BusinessCategory.FORGE_STONE_EARTH,
  name: "Fine Metalsmith",
  subtitle: "Precious Metals & Filigree",
  description: "A refined workshop where gold, silver, and mithral are shaped into works of breathtaking delicacy. Every piece is a treasure worthy of royalty.",
  icon: "fa-ring",
  color: "#DAA520",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.4, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 16 },
  buyBack: { enabled: true, itemTypes: ["equipment", "loot"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.FINE_METALWORK, category: ServiceCategory.CRAFTING, name: "Fine Metalwork", description: "Craft intricate pieces from precious metals with exquisite detail", icon: "fa-gem", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.ENGRAVE, category: ServiceCategory.CRAFTING, name: "Engraving", description: "Etch names, runes, or intricate patterns into metal surfaces", icon: "fa-pen-fancy", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.POLISH, category: ServiceCategory.CRAFTING, name: "Polish & Restore", description: "Bring a tarnished piece back to its original gleaming luster", icon: "fa-star", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.RESIZE, category: ServiceCategory.CRAFTING, name: "Resize Ring or Circlet", description: "Adjust a ring, circlet, or bracelet to fit a new wearer", icon: "fa-ring", basePrice: 8, priceType: "percent" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.CRAFTING, name: "Commission Fine Piece", description: "Commission a bespoke piece of jewelry or ornamental metalwork", icon: "fa-crown", basePrice: 150, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.APPRAISE, sourceType: BusinessType.VILLAGE_BLACKSMITH, category: ServiceCategory.INFORMATION, name: "Appraise Precious Metal", description: "Determine the purity, weight, and value of precious metals and gems", icon: "fa-coins", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.ENCHANT, sourceType: BusinessType.ENCHANTER, category: ServiceCategory.MAGIC, name: "Enchant Jewelry", description: "Imbue a fine piece with protective or empowering magic", icon: "fa-wand-sparkles", basePrice: 300, priceType: "fixed" }
  ],
  tags: ["gold", "silver", "filigree", "jewelry", "fine"]
});

// ============================================================================
// CATEGORY II: THE WOOD, HIDE, & FIBER TRADES
// ============================================================================

// 9. Carpenter & Joiner
BusinessTypeRegistry.set(BusinessType.CARPENTER_JOINER, {
  type: BusinessType.CARPENTER_JOINER,
  category: BusinessCategory.WOOD_HIDE_FIBER,
  name: "Carpenter & Joiner",
  subtitle: "Woodwork & Construction",
  description: "A fragrant workshop of fresh-cut timber and curling wood shavings. From humble shelves to grand staircases, the carpenter shapes the bones of civilization.",
  icon: "fa-tree",
  color: "#D2691E",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 13 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.WOODWORKING, category: ServiceCategory.CRAFTING, name: "Woodworking", description: "Cut, plane, and join timber for any purpose", icon: "fa-tree", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.FURNITURE, category: ServiceCategory.CRAFTING, name: "Craft Furniture", description: "Build sturdy tables, chairs, chests, and beds from solid wood", icon: "fa-couch", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.STRUCTURAL_REPAIR, category: ServiceCategory.CRAFTING, name: "Structural Timber Repair", description: "Replace rotted beams, broken joists, and damaged framework", icon: "fa-house-crack", basePrice: 20, priceType: "fixed" },
    { type: ServiceType.RENOVATION, category: ServiceCategory.CRAFTING, name: "Renovation Work", description: "Remodel rooms, add partitions, or expand existing structures", icon: "fa-house-chimney", basePrice: 50, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.WHEEL_REPAIR, sourceType: BusinessType.WHEELWRIGHT, category: ServiceCategory.CRAFTING, name: "Replace Wooden Parts", description: "Replace broken spokes, axles, and other wooden vehicle components", icon: "fa-dharmachakra", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.HIDDEN_COMPARTMENTS, sourceType: BusinessType.COOPER, category: ServiceCategory.CRAFTING, name: "Hidden Compartment", description: "Build a secret compartment into furniture or a structure", icon: "fa-eye-slash", basePrice: 40, priceType: "fixed" }
  ],
  tags: ["wood", "carpentry", "build", "furniture"]
});

// 10. Cooper
BusinessTypeRegistry.set(BusinessType.COOPER, {
  type: BusinessType.COOPER,
  category: BusinessCategory.WOOD_HIDE_FIBER,
  name: "Cooper",
  subtitle: "Barrels & Containers",
  description: "The rhythmic tap of a mallet on barrel staves fills this workshop. Every cask is watertight, built to survive the roughest roads and the saltiest seas.",
  icon: "fa-wine-bottle",
  color: "#A0522D",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 12 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.COOPERAGE, category: ServiceCategory.CRAFTING, name: "Barrel Making", description: "Craft watertight barrels, casks, and tubs from seasoned staves", icon: "fa-wine-bottle", basePrice: 8, priceType: "fixed" },
    { type: ServiceType.HIDDEN_COMPARTMENTS, category: ServiceCategory.CRAFTING, name: "False-Bottom Barrel", description: "Build a barrel with a cunningly concealed hidden compartment", icon: "fa-eye-slash", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.REPAIR, category: ServiceCategory.CRAFTING, name: "Repair Barrel", description: "Fix leaking seams, replace broken hoops, and restore burst casks", icon: "fa-wrench", basePrice: 3, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.WATERPROOFING, sourceType: BusinessType.CHANDLER, category: ServiceCategory.CRAFTING, name: "Waterproof Seal", description: "Apply a wax and pitch seal for guaranteed watertight storage", icon: "fa-droplet", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.WOODWORKING, sourceType: BusinessType.CARPENTER_JOINER, category: ServiceCategory.CRAFTING, name: "Custom Container", description: "Craft a non-standard wooden container or crate to specification", icon: "fa-box", basePrice: 10, priceType: "fixed" }
  ],
  tags: ["barrel", "cask", "container", "cooper"]
});

// 11. Wheelwright
BusinessTypeRegistry.set(BusinessType.WHEELWRIGHT, {
  type: BusinessType.WHEELWRIGHT,
  category: BusinessCategory.WOOD_HIDE_FIBER,
  name: "Wheelwright",
  subtitle: "Wheels & Vehicles",
  description: "An expansive yard where heavy wheels lean against fences and half-built carts await their axles. Without the wheelwright, no caravan rolls.",
  icon: "fa-dharmachakra",
  color: "#8B6914",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 13 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.WHEEL_REPAIR, category: ServiceCategory.CRAFTING, name: "Wheel Repair", description: "Replace broken spokes, rims, and hubs to get a wheel turning again", icon: "fa-dharmachakra", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.VEHICLE_UPGRADES, category: ServiceCategory.CRAFTING, name: "Vehicle Upgrades", description: "Reinforce a wagon bed, add springs, or upgrade axle fittings", icon: "fa-arrow-up", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.WAGON_REPAIR, category: ServiceCategory.CRAFTING, name: "Wagon Repair", description: "Full restoration of a damaged cart or wagon to roadworthy condition", icon: "fa-trailer", basePrice: 25, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.WOODWORKING, sourceType: BusinessType.CARPENTER_JOINER, category: ServiceCategory.CRAFTING, name: "Rebuild Wagon Bed", description: "Replace planking and framing in a rotted-out wagon bed", icon: "fa-tree", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.REPAIR, sourceType: BusinessType.VILLAGE_BLACKSMITH, category: ServiceCategory.CRAFTING, name: "Iron Fittings", description: "Replace iron axle bands, wheel rims, and coupling hardware", icon: "fa-wrench", basePrice: 12, priceType: "fixed" }
  ],
  tags: ["wheel", "cart", "wagon", "vehicle"]
});

// 12. Bowyer
BusinessTypeRegistry.set(BusinessType.BOWYER, {
  type: BusinessType.BOWYER,
  category: BusinessCategory.WOOD_HIDE_FIBER,
  name: "Bowyer",
  subtitle: "Bow Crafting",
  description: "Staves of yew, ash, and horn line the walls of this quiet workshop. The bowyer bends wood and sinew into instruments of deadly precision.",
  icon: "fa-bullseye",
  color: "#556B2F",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.2, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: true, itemTypes: ["weapon"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.BOW_CRAFTING, category: ServiceCategory.CRAFTING, name: "Craft Bow", description: "Shape a new longbow, shortbow, or crossbow from seasoned wood", icon: "fa-bullseye", basePrice: 30, priceType: "fixed" },
    { type: ServiceType.BOW_STRINGING, category: ServiceCategory.CRAFTING, name: "Restring Bow", description: "Replace a worn or snapped bowstring with a fresh one", icon: "fa-link", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.CUSTOM_DRAW, category: ServiceCategory.CRAFTING, name: "Custom Draw Weight", description: "Adjust a bow's draw weight and length to match a specific archer", icon: "fa-sliders", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.REPAIR, category: ServiceCategory.CRAFTING, name: "Repair Bow", description: "Mend a cracked limb or replace a damaged grip on a bow", icon: "fa-wrench", basePrice: 8, priceType: "percent" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.ENCHANT, sourceType: BusinessType.ENCHANTER, category: ServiceCategory.MAGIC, name: "Enchant Bow", description: "Imbue a bow with arcane accuracy or elemental force", icon: "fa-wand-sparkles", basePrice: 250, priceType: "fixed" },
    { type: ServiceType.FLETCHING, sourceType: BusinessType.FLETCHER, category: ServiceCategory.CRAFTING, name: "Bundle of Arrows", description: "Order a quiver of well-fletched arrows to accompany a new bow", icon: "fa-location-arrow", basePrice: 5, priceType: "fixed" }
  ],
  tags: ["bow", "longbow", "crossbow", "ranged"]
});

// 13. Fletcher
BusinessTypeRegistry.set(BusinessType.FLETCHER, {
  type: BusinessType.FLETCHER,
  category: BusinessCategory.WOOD_HIDE_FIBER,
  name: "Fletcher",
  subtitle: "Arrows & Ammunition",
  description: "Bundles of straight shafts stand in racks while goose feathers and sharpened broadheads cover every surface. The fletcher's art makes the archer deadly.",
  icon: "fa-location-arrow",
  color: "#6B8E23",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.1, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 12 },
  buyBack: { enabled: true, itemTypes: ["consumable"] },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.FLETCHING, category: ServiceCategory.CRAFTING, name: "Fletch Arrows", description: "Craft a batch of straight, true-flying arrows with keen heads", icon: "fa-location-arrow", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.FLINT_KNAPPING, category: ServiceCategory.CRAFTING, name: "Knap Arrowheads", description: "Shape flint, obsidian, or stone into razor-sharp arrowheads", icon: "fa-gem", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.SPECIALTY_AMMO, category: ServiceCategory.CRAFTING, name: "Specialty Ammunition", description: "Craft broadheads, bodkin points, fire arrows, or blunted tips", icon: "fa-burst", basePrice: 15, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.BOW_STRINGING, sourceType: BusinessType.BOWYER, category: ServiceCategory.CRAFTING, name: "Emergency Restring", description: "Replace a snapped bowstring in the field", icon: "fa-link", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.ENCHANT, sourceType: BusinessType.ENCHANTER, category: ServiceCategory.MAGIC, name: "Enchant Ammunition", description: "Imbue a batch of arrows or bolts with elemental energy", icon: "fa-wand-sparkles", basePrice: 100, priceType: "fixed" }
  ],
  tags: ["arrow", "bolt", "ammo", "fletcher"]
});

// 14. Tanner
BusinessTypeRegistry.set(BusinessType.TANNER, {
  type: BusinessType.TANNER,
  category: BusinessCategory.WOOD_HIDE_FIBER,
  name: "Tanner",
  subtitle: "Hide Processing",
  description: "The pungent reek of tanning vats announces this workshop from a block away. Raw hides are scraped, soaked, and cured into supple leather here.",
  icon: "fa-cow",
  color: "#8B4513",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.6 },
  haggling: { enabled: true, persuasionDC: 12 },
  buyBack: { enabled: true, itemTypes: ["loot"] },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.TANNING, category: ServiceCategory.CRAFTING, name: "Tan a Hide", description: "Cure and tan a raw animal hide into workable leather", icon: "fa-cow", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.HIDE_PROCESSING, category: ServiceCategory.CRAFTING, name: "Process Exotic Hide", description: "Prepare a dragon, wyvern, or other exotic hide for crafting", icon: "fa-dragon", basePrice: 50, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.LEATHERWORK, sourceType: BusinessType.LEATHERWORKER, category: ServiceCategory.CRAFTING, name: "Basic Leatherwork", description: "Shape freshly tanned leather into simple goods", icon: "fa-vest", basePrice: 8, priceType: "fixed" },
    { type: ServiceType.WATERPROOFING, sourceType: BusinessType.CHANDLER, category: ServiceCategory.CRAFTING, name: "Waterproof Hide", description: "Treat a hide with wax and oil for water resistance", icon: "fa-droplet", basePrice: 5, priceType: "fixed" }
  ],
  tags: ["hide", "leather", "tan", "cure"]
});

// 15. Leatherworker
BusinessTypeRegistry.set(BusinessType.LEATHERWORKER, {
  type: BusinessType.LEATHERWORKER,
  category: BusinessCategory.WOOD_HIDE_FIBER,
  name: "Leatherworker",
  subtitle: "Leather Goods",
  description: "Racks of belts, bags, and armor pieces fill this workshop. The sharp smell of leather and the steady punch of an awl mark the leatherworker's trade.",
  icon: "fa-vest",
  color: "#A0522D",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.1, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 13 },
  buyBack: { enabled: true, itemTypes: ["equipment"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.LEATHERWORK, category: ServiceCategory.CRAFTING, name: "Leather Crafting", description: "Stitch and tool leather into armor, bags, belts, and scabbards", icon: "fa-vest", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.REPAIR, category: ServiceCategory.CRAFTING, name: "Repair Leather Goods", description: "Patch torn leather armor, replace broken straps, and restitch seams", icon: "fa-wrench", basePrice: 8, priceType: "percent" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.CRAFTING, name: "Custom Leather Order", description: "Commission a bespoke leather item crafted to your measurements", icon: "fa-ruler", basePrice: 40, priceType: "fixed" },
    { type: ServiceType.RESIZE, category: ServiceCategory.CRAFTING, name: "Resize Leather Armor", description: "Adjust leather armor to fit a different wearer", icon: "fa-arrows-left-right", basePrice: 10, priceType: "percent" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.COBBLING, sourceType: BusinessType.COBBLER, category: ServiceCategory.CRAFTING, name: "Repair Boots", description: "Resole and restitch a worn pair of leather boots", icon: "fa-shoe-prints", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.TANNING, sourceType: BusinessType.TANNER, category: ServiceCategory.CRAFTING, name: "Tan a Hide", description: "Send a raw hide to be tanned before working it", icon: "fa-cow", basePrice: 5, priceType: "fixed" }
  ],
  tags: ["leather", "goods", "craft", "armor"]
});

// 16. Cobbler
BusinessTypeRegistry.set(BusinessType.COBBLER, {
  type: BusinessType.COBBLER,
  category: BusinessCategory.WOOD_HIDE_FIBER,
  name: "Cobbler",
  subtitle: "Footwear",
  description: "Rows of boots and shoes line the shelves, from peasant clogs to noble riding boots. The cobbler ensures every adventurer walks in comfort.",
  icon: "fa-shoe-prints",
  color: "#654321",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.1, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 12 },
  buyBack: { enabled: true, itemTypes: ["equipment"] },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.COBBLING, category: ServiceCategory.CRAFTING, name: "Craft Footwear", description: "Stitch together a sturdy pair of boots or shoes", icon: "fa-shoe-prints", basePrice: 8, priceType: "fixed" },
    { type: ServiceType.REPAIR, category: ServiceCategory.CRAFTING, name: "Resole & Mend", description: "Replace worn soles and patch holes in well-traveled boots", icon: "fa-wrench", basePrice: 3, priceType: "percent" },
    { type: ServiceType.HIDDEN_HEELS, category: ServiceCategory.CRAFTING, name: "Hidden Heel Compartment", description: "Hollow out a boot heel to conceal a small item or message", icon: "fa-eye-slash", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.RESIZE, category: ServiceCategory.CRAFTING, name: "Resize Boots", description: "Stretch or take in a pair of boots for a better fit", icon: "fa-arrows-left-right", basePrice: 5, priceType: "percent" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.LEATHERWORK, sourceType: BusinessType.LEATHERWORKER, category: ServiceCategory.CRAFTING, name: "Custom Leather Boots", description: "Commission fine leather riding or adventuring boots", icon: "fa-vest", basePrice: 20, priceType: "fixed" },
    { type: ServiceType.DYEING, sourceType: BusinessType.WEAVER_DYER, category: ServiceCategory.CRAFTING, name: "Dye Leather", description: "Dye boots or shoes in a fashionable color", icon: "fa-palette", basePrice: 5, priceType: "fixed" }
  ],
  tags: ["shoes", "boots", "cobble", "footwear"]
});

// 17. Tailor
BusinessTypeRegistry.set(BusinessType.TAILOR, {
  type: BusinessType.TAILOR,
  category: BusinessCategory.WOOD_HIDE_FIBER,
  name: "Tailor",
  subtitle: "Clothing & Textiles",
  description: "Bolts of silk, wool, and linen fill this cozy shop. The tailor's needle transforms raw cloth into everything from peasant tunics to courtly finery.",
  icon: "fa-scissors",
  color: "#8B008B",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: ShopType.TAILOR,
  pricing: { baseBuyMultiplier: 1.1, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 13 },
  buyBack: { enabled: true, itemTypes: ["equipment"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.ALTERATIONS, category: ServiceCategory.CRAFTING, name: "Alterations", description: "Take in, let out, or reshape a garment for a perfect fit", icon: "fa-scissors", basePrice: 5, priceType: "percent" },
    { type: ServiceType.RESIZE, category: ServiceCategory.CRAFTING, name: "Resize Garment", description: "Adjust clothing to fit a different body type entirely", icon: "fa-arrows-left-right", basePrice: 8, priceType: "percent" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.CRAFTING, name: "Commission Garment", description: "Have a fine outfit or robe tailored to your exact specifications", icon: "fa-shirt", basePrice: 30, priceType: "fixed" },
    { type: ServiceType.REPAIR, category: ServiceCategory.CRAFTING, name: "Mend Clothing", description: "Patch tears, replace buttons, and darn holes in damaged clothing", icon: "fa-wrench", basePrice: 3, priceType: "percent" },
    { type: ServiceType.DYEING, category: ServiceCategory.CRAFTING, name: "Dye Garment", description: "Change the color of a garment with quality dyes", icon: "fa-palette", basePrice: 5, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.WEAVING, sourceType: BusinessType.WEAVER_DYER, category: ServiceCategory.CRAFTING, name: "Custom Fabric", description: "Order a bolt of specially woven cloth for a garment", icon: "fa-scroll", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.LEATHERWORK, sourceType: BusinessType.LEATHERWORKER, category: ServiceCategory.CRAFTING, name: "Leather Accents", description: "Add leather trim, belts, or reinforcement to clothing", icon: "fa-vest", basePrice: 8, priceType: "fixed" }
  ],
  tags: ["clothing", "tailor", "fashion", "sew"]
});

// 18. Weaver & Dyer
BusinessTypeRegistry.set(BusinessType.WEAVER_DYER, {
  type: BusinessType.WEAVER_DYER,
  category: BusinessCategory.WOOD_HIDE_FIBER,
  name: "Weaver & Dyer",
  subtitle: "Textiles & Dyes",
  description: "Great looms clack and shuttle in this colorful workshop. Vats of indigo, madder, and woad produce fabrics in every shade the eye can imagine.",
  icon: "fa-palette",
  color: "#DB7093",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 12 },
  buyBack: { enabled: true, itemTypes: ["loot"] },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.WEAVING, category: ServiceCategory.CRAFTING, name: "Weave Cloth", description: "Weave raw fiber into bolts of linen, wool, or silk cloth", icon: "fa-scroll", basePrice: 8, priceType: "fixed" },
    { type: ServiceType.DYEING, category: ServiceCategory.CRAFTING, name: "Dye Fabric", description: "Immerse cloth or garments in rich, colorfast dyes", icon: "fa-palette", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.RUG_MAKING, category: ServiceCategory.CRAFTING, name: "Weave Rug or Tapestry", description: "Create a decorative rug, tapestry, or wall hanging", icon: "fa-table-cells", basePrice: 30, priceType: "fixed" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.CRAFTING, name: "Custom Fabric Order", description: "Commission a bolt of cloth in a specific weave, weight, and color", icon: "fa-ruler", basePrice: 20, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.ALTERATIONS, sourceType: BusinessType.TAILOR, category: ServiceCategory.CRAFTING, name: "Simple Hemming", description: "Hem or edge a length of cloth for finished use", icon: "fa-scissors", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.ROPE_MAKING, sourceType: BusinessType.ROPEMAKER, category: ServiceCategory.CRAFTING, name: "Cord & Twine", description: "Spin leftover fiber into cord, twine, and thread", icon: "fa-link", basePrice: 2, priceType: "fixed" }
  ],
  tags: ["weave", "dye", "textile", "fabric", "color"]
});

// 19. Ropemaker
BusinessTypeRegistry.set(BusinessType.ROPEMAKER, {
  type: BusinessType.ROPEMAKER,
  category: BusinessCategory.WOOD_HIDE_FIBER,
  name: "Ropemaker",
  subtitle: "Rope & Cordage",
  description: "Long ropes hang in coils from ceiling hooks while a great rope-walk stretches behind the shop. Every ship, well, and dungeon delve needs strong cordage.",
  icon: "fa-link",
  color: "#BDB76B",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 11 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.ROPE_MAKING, category: ServiceCategory.CRAFTING, name: "Make Rope", description: "Twist and braid raw hemp or silk into strong, reliable rope", icon: "fa-link", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.NET_MAKING, category: ServiceCategory.CRAFTING, name: "Weave Net", description: "Knot a fishing net, cargo net, or trapping net to size", icon: "fa-border-all", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.REPAIR, category: ServiceCategory.CRAFTING, name: "Splice & Repair Rope", description: "Splice frayed ends and repair damaged lengths of rope", icon: "fa-wrench", basePrice: 1, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.WATERPROOFING, sourceType: BusinessType.CHANDLER, category: ServiceCategory.CRAFTING, name: "Waterproof Rope", description: "Treat rope with tar and wax for maritime or wet conditions", icon: "fa-droplet", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.WEAVING, sourceType: BusinessType.WEAVER_DYER, category: ServiceCategory.CRAFTING, name: "Decorative Cordwork", description: "Braid colored cords for decorative or ceremonial use", icon: "fa-palette", basePrice: 5, priceType: "fixed" }
  ],
  tags: ["rope", "cord", "net", "rigging"]
});

// ============================================================================
// CATEGORY III: ARCANE, ACADEMIC, & SPECIALIST
// ============================================================================

// 20. Apothecary
BusinessTypeRegistry.set(BusinessType.APOTHECARY, {
  type: BusinessType.APOTHECARY,
  category: BusinessCategory.ARCANE_ACADEMIC,
  name: "Apothecary",
  subtitle: "Remedies & Herbs",
  description: "Dried herbs hang from the rafters and shelves groan under the weight of labeled jars and bottles. The apothecary brews cures for ailments both common and arcane.",
  icon: "fa-mortar-pestle",
  color: "#228B22",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: ShopType.POTIONS,
  pricing: { baseBuyMultiplier: 1.2, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: true, itemTypes: ["consumable", "loot"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.BREW_POTION, category: ServiceCategory.MAGIC, name: "Brew Remedy", description: "Compound a potion, salve, or tincture from rare herbs and reagents", icon: "fa-flask-vial", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.CURE_DISEASE, category: ServiceCategory.HEALING, name: "Treat Disease", description: "Prescribe herbal remedies and poultices to fight infection and plague", icon: "fa-virus-slash", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.CURE_POISON, category: ServiceCategory.HEALING, name: "Neutralize Poison", description: "Administer antivenom or a purging draught to cleanse toxins", icon: "fa-skull-crossbones", basePrice: 20, priceType: "fixed" },
    { type: ServiceType.APPRAISE, category: ServiceCategory.INFORMATION, name: "Identify Herb or Reagent", description: "Determine the properties and value of an unknown herb or substance", icon: "fa-leaf", basePrice: 5, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.HEALING, sourceType: BusinessType.TEMPLE_LARGE, category: ServiceCategory.HEALING, name: "Healing Poultice", description: "Apply a restorative herbal poultice to speed natural healing", icon: "fa-heart-pulse", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.IDENTIFY, sourceType: BusinessType.WIZARDS_TOWER, category: ServiceCategory.MAGIC, name: "Identify Potion", description: "Determine the magical properties of an unknown potion", icon: "fa-magnifying-glass", basePrice: 15, priceType: "fixed" }
  ],
  tags: ["potion", "herb", "remedy", "medicine"]
});

// 21. Alchemist
BusinessTypeRegistry.set(BusinessType.ALCHEMIST, {
  type: BusinessType.ALCHEMIST,
  category: BusinessCategory.ARCANE_ACADEMIC,
  name: "Alchemist",
  subtitle: "Transmutation & Compounds",
  description: "Bubbling retorts and spiraling glass tubes fill this laboratory with strange fumes. The alchemist seeks to transform base matter into wondrous substances.",
  icon: "fa-flask",
  color: "#9932CC",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.3, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 15 },
  buyBack: { enabled: true, itemTypes: ["consumable", "loot"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.BREW_POTION, category: ServiceCategory.MAGIC, name: "Synthesize Compound", description: "Distill, combine, and transmute reagents into potent alchemical products", icon: "fa-flask-vial", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.IDENTIFY, category: ServiceCategory.MAGIC, name: "Analyze Substance", description: "Subject an unknown substance to rigorous alchemical analysis", icon: "fa-magnifying-glass", basePrice: 20, priceType: "fixed" },
    { type: ServiceType.APPRAISE, category: ServiceCategory.INFORMATION, name: "Appraise Reagent", description: "Assess the purity and market value of alchemical ingredients", icon: "fa-coins", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.MAGIC, name: "Custom Formula", description: "Develop a bespoke alchemical formula to your specifications", icon: "fa-prescription-bottle", basePrice: 100, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.ENCHANT, sourceType: BusinessType.ENCHANTER, category: ServiceCategory.MAGIC, name: "Alchemical Enchantment", description: "Infuse an item with alchemical essences that mimic enchantment", icon: "fa-wand-sparkles", basePrice: 200, priceType: "fixed" },
    { type: ServiceType.GLASSWORK, sourceType: BusinessType.GLASSBLOWER, category: ServiceCategory.CRAFTING, name: "Custom Glassware", description: "Commission specialized alchemical vessels and apparatus", icon: "fa-wine-glass", basePrice: 15, priceType: "fixed" }
  ],
  tags: ["alchemy", "transmute", "elixir", "compound"]
});

// 22. Wizard's Tower
BusinessTypeRegistry.set(BusinessType.WIZARDS_TOWER, {
  type: BusinessType.WIZARDS_TOWER,
  category: BusinessCategory.ARCANE_ACADEMIC,
  name: "Wizard's Tower",
  subtitle: "Arcane Services",
  description: "A tower of weathered stone crackling with residual magic. Glowing runes line the doorframe and the air hums with barely contained arcane power.",
  icon: "fa-hat-wizard",
  color: "#4169E1",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: ShopType.MAGIC,
  pricing: { baseBuyMultiplier: 1.5, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 18 },
  buyBack: { enabled: true, itemTypes: ["consumable", "loot"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.IDENTIFY, category: ServiceCategory.MAGIC, name: "Identify Magic Item", description: "Unravel the enchantments woven into a mysterious artifact", icon: "fa-magnifying-glass", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.ENCHANT, category: ServiceCategory.MAGIC, name: "Enchant Item", description: "Bind arcane power into an item through ritual and will", icon: "fa-wand-magic-sparkles", basePrice: 300, priceType: "fixed" },
    { type: ServiceType.ARCANE_CONSULTATION, category: ServiceCategory.MAGIC, name: "Arcane Consultation", description: "Consult the wizard on matters of magic, planar lore, or ancient mysteries", icon: "fa-hat-wizard", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.TELEPORTATION, category: ServiceCategory.MAGIC, name: "Teleportation Circle", description: "Travel instantly to a known teleportation circle in another location", icon: "fa-circle-nodes", basePrice: 250, priceType: "fixed" },
    { type: ServiceType.SPELL_COPYING, category: ServiceCategory.MAGIC, name: "Copy Spell", description: "Allow a wizard to copy a spell from the tower's library into their spellbook", icon: "fa-book-open", basePrice: 50, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.SCRIBE_SCROLL, sourceType: BusinessType.SCRIBE_SCRIVENER, category: ServiceCategory.MAGIC, name: "Scribe Spell Scroll", description: "Have a spell inscribed onto a scroll for later use", icon: "fa-scroll", basePrice: 100, priceType: "fixed" },
    { type: ServiceType.LORE_RESEARCH, sourceType: BusinessType.LIBRARY_ARCHIVES, category: ServiceCategory.INFORMATION, name: "Arcane Research", description: "Research a specific magical topic in the tower's private library", icon: "fa-book", basePrice: 30, priceType: "fixed" }
  ],
  tags: ["wizard", "magic", "arcane", "tower", "spell"]
});

// 23. Scribe & Scrivener
BusinessTypeRegistry.set(BusinessType.SCRIBE_SCRIVENER, {
  type: BusinessType.SCRIBE_SCRIVENER,
  category: BusinessCategory.ARCANE_ACADEMIC,
  name: "Scribe & Scrivener",
  subtitle: "Written Works",
  description: "Ink-stained fingers and the quiet scratch of quill on parchment define this studious shop. Every document, scroll, and forgery passes through the scribe's hand.",
  icon: "fa-feather-pointed",
  color: "#DEB887",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: ShopType.SCROLLS,
  pricing: { baseBuyMultiplier: 1.2, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: true, itemTypes: ["consumable", "loot"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.LETTER_WRITING, category: ServiceCategory.MISC, name: "Write a Letter", description: "Compose a formal letter, petition, or correspondence in elegant script", icon: "fa-envelope", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.SCRIBE_SCROLL, category: ServiceCategory.MAGIC, name: "Scribe Scroll", description: "Inscribe a spell scroll with precise arcane notation", icon: "fa-scroll", basePrice: 75, priceType: "fixed" },
    { type: ServiceType.FORGERY, category: ServiceCategory.MISC, name: "Produce a Forgery", description: "Create a convincing replica of a document, seal, or signature", icon: "fa-stamp", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.MISC, name: "Commission Manuscript", description: "Have a book, codex, or illuminated manuscript produced to order", icon: "fa-book", basePrice: 100, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.LORE_RESEARCH, sourceType: BusinessType.LIBRARY_ARCHIVES, category: ServiceCategory.INFORMATION, name: "Research a Topic", description: "Search through texts and records for information on a subject", icon: "fa-magnifying-glass", basePrice: 20, priceType: "fixed" },
    { type: ServiceType.CARTOGRAPHY, sourceType: BusinessType.CARTOGRAPHER, category: ServiceCategory.INFORMATION, name: "Copy a Map", description: "Produce a faithful copy of an existing map or chart", icon: "fa-map", basePrice: 15, priceType: "fixed" }
  ],
  tags: ["scribe", "scroll", "write", "document"]
});

// 24. Cartographer
BusinessTypeRegistry.set(BusinessType.CARTOGRAPHER, {
  type: BusinessType.CARTOGRAPHER,
  category: BusinessCategory.ARCANE_ACADEMIC,
  name: "Cartographer",
  subtitle: "Maps & Navigation",
  description: "Walls papered with maps of distant lands and uncharted wilderness. The cartographer's art reveals the shape of the world to those brave enough to explore it.",
  icon: "fa-map",
  color: "#F4A460",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.2, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: true, itemTypes: ["loot"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.CARTOGRAPHY, category: ServiceCategory.INFORMATION, name: "Draw a Map", description: "Survey and draft an accurate map of a region, dungeon, or route", icon: "fa-map", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.MAP_DECIPHERING, category: ServiceCategory.INFORMATION, name: "Decipher Old Map", description: "Interpret faded, coded, or ancient cartographic notations", icon: "fa-compass-drafting", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.MAP_PURCHASE, category: ServiceCategory.INFORMATION, name: "Purchase Map", description: "Buy a pre-made map of a known region or trade route", icon: "fa-map-location-dot", basePrice: 15, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.LORE_RESEARCH, sourceType: BusinessType.LIBRARY_ARCHIVES, category: ServiceCategory.INFORMATION, name: "Geographic Research", description: "Research historical borders, lost cities, and forgotten paths", icon: "fa-book", basePrice: 20, priceType: "fixed" },
    { type: ServiceType.TRANSLATION, sourceType: BusinessType.INTERPRETER, category: ServiceCategory.INFORMATION, name: "Translate Map Labels", description: "Translate foreign place names and legends on imported maps", icon: "fa-language", basePrice: 10, priceType: "fixed" }
  ],
  tags: ["map", "chart", "navigation", "explore"]
});

// 25. Enchanter
BusinessTypeRegistry.set(BusinessType.ENCHANTER, {
  type: BusinessType.ENCHANTER,
  category: BusinessCategory.ARCANE_ACADEMIC,
  name: "Enchanter",
  subtitle: "Magical Enhancement",
  description: "Runes glow faintly on every surface of this hushed workshop. The enchanter channels raw arcane energy into permanent magical effects bound to mundane objects.",
  icon: "fa-wand-sparkles",
  color: "#9400D3",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.5, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 17 },
  buyBack: { enabled: true, itemTypes: ["weapon", "equipment"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.ENCHANT, category: ServiceCategory.MAGIC, name: "Enchant Item", description: "Weave permanent magical properties into a weapon, armor, or trinket", icon: "fa-wand-magic-sparkles", basePrice: 250, priceType: "fixed" },
    { type: ServiceType.DISENCHANT, category: ServiceCategory.MAGIC, name: "Disenchant Item", description: "Strip an item of its magical properties, salvaging residual essence", icon: "fa-ban", basePrice: 100, priceType: "fixed" },
    { type: ServiceType.RECHARGE, category: ServiceCategory.MAGIC, name: "Recharge Magic Item", description: "Restore expended charges to a wand, staff, or charged item", icon: "fa-bolt", basePrice: 150, priceType: "fixed" },
    { type: ServiceType.ATTUNE, category: ServiceCategory.MAGIC, name: "Attunement Assistance", description: "Guide an adventurer through the delicate process of attuning to a magical item", icon: "fa-hand-sparkles", basePrice: 50, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.IDENTIFY, sourceType: BusinessType.WIZARDS_TOWER, category: ServiceCategory.MAGIC, name: "Identify Enchantment", description: "Determine exactly what enchantments are woven into an item", icon: "fa-magnifying-glass", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.APPRAISE, sourceType: BusinessType.APOTHECARY, category: ServiceCategory.INFORMATION, name: "Appraise Enchanted Item", description: "Assess the market value of an enchanted item based on its properties", icon: "fa-coins", basePrice: 15, priceType: "fixed" }
  ],
  tags: ["enchant", "magic", "enhance", "imbue"]
});

// 26. Engineer & Tinkerer
BusinessTypeRegistry.set(BusinessType.ENGINEER_TINKERER, {
  type: BusinessType.ENGINEER_TINKERER,
  category: BusinessCategory.ARCANE_ACADEMIC,
  name: "Engineer & Tinkerer",
  subtitle: "Gadgets & Devices",
  description: "Gears, springs, and half-assembled contraptions cover every surface. The tinkerer's mind sees mechanisms where others see only chaos.",
  icon: "fa-gears",
  color: "#B8860B",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.2, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: true, itemTypes: ["tool", "weapon"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.GADGET_REPAIR, category: ServiceCategory.CRAFTING, name: "Repair Device", description: "Fix a broken clockwork, mechanical, or intricate device", icon: "fa-gears", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.TRAP_MAKING, category: ServiceCategory.CRAFTING, name: "Build Trap", description: "Design and construct a mechanical trap, alarm, or deterrent", icon: "fa-skull-crossbones", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.CRAFTING, name: "Commission Gadget", description: "Design and build a custom mechanical device to specification", icon: "fa-lightbulb", basePrice: 75, priceType: "fixed" },
    { type: ServiceType.REPAIR, category: ServiceCategory.CRAFTING, name: "General Repair", description: "Fix any complex mechanism, from crossbow triggers to clockwork toys", icon: "fa-wrench", basePrice: 10, priceType: "percent" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.KEY_CUTTING, sourceType: BusinessType.LOCKSMITH, category: ServiceCategory.CRAFTING, name: "Precision Key", description: "Machine a complex key for an intricate mechanical lock", icon: "fa-key", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.GLASSWORK, sourceType: BusinessType.GLASSBLOWER, category: ServiceCategory.CRAFTING, name: "Optical Components", description: "Commission precision glass lenses and prisms for devices", icon: "fa-eye", basePrice: 20, priceType: "fixed" }
  ],
  tags: ["engineer", "tinker", "gadget", "device", "trap"]
});

// 27. Glassblower
BusinessTypeRegistry.set(BusinessType.GLASSBLOWER, {
  type: BusinessType.GLASSBLOWER,
  category: BusinessCategory.ARCANE_ACADEMIC,
  name: "Glassblower",
  subtitle: "Glass & Optics",
  description: "The furnace glows cherry-red as the glassblower spins molten glass into vessels of crystalline beauty. Light dances through prisms and lenses of every shape.",
  icon: "fa-wine-glass",
  color: "#87CEEB",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.1, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 13 },
  buyBack: { enabled: true, itemTypes: ["loot"] },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.GLASSWORK, category: ServiceCategory.CRAFTING, name: "Blow Glassware", description: "Shape molten glass into decorative or functional vessels", icon: "fa-wine-glass", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.GLASS_CONTAINERS, category: ServiceCategory.CRAFTING, name: "Potion Vials & Bottles", description: "Produce sturdy vials, flasks, and bottles for alchemical use", icon: "fa-flask", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.OPTICS, category: ServiceCategory.CRAFTING, name: "Grind Lenses", description: "Grind and polish glass into precision lenses and magnifiers", icon: "fa-eye", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.REPAIR, category: ServiceCategory.CRAFTING, name: "Repair Glassware", description: "Mend cracked glass instruments and delicate vessels", icon: "fa-wrench", basePrice: 5, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.CANDLE_MAKING, sourceType: BusinessType.CHANDLER, category: ServiceCategory.CRAFTING, name: "Glass Lantern Panes", description: "Produce glass panels for lanterns and lamps", icon: "fa-lightbulb", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.FINE_METALWORK, sourceType: BusinessType.FINE_METALSMITH, category: ServiceCategory.CRAFTING, name: "Metal & Glass Setting", description: "Set glass gems or lenses in fine metal frames", icon: "fa-ring", basePrice: 20, priceType: "fixed" }
  ],
  tags: ["glass", "lens", "bottle", "optic"]
});

// 28. Chandler
BusinessTypeRegistry.set(BusinessType.CHANDLER, {
  type: BusinessType.CHANDLER,
  category: BusinessCategory.ARCANE_ACADEMIC,
  name: "Chandler",
  subtitle: "Candles, Soap, & Wax",
  description: "The warm glow of a hundred candles lights this fragrant shop. Tallow, beeswax, and sweet-smelling soap fill barrels along the walls.",
  icon: "fa-fire",
  color: "#FFD700",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 11 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.CANDLE_MAKING, category: ServiceCategory.CRAFTING, name: "Candle Making", description: "Dip or mold candles from tallow, beeswax, or scented blends", icon: "fa-fire", basePrice: 1, priceType: "fixed" },
    { type: ServiceType.WATERPROOFING, category: ServiceCategory.CRAFTING, name: "Waterproofing", description: "Seal leather, cloth, or wood with wax and pitch for water resistance", icon: "fa-droplet", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.CRAFTING, name: "Custom Candle Order", description: "Commission specialty candles -- scented, colored, long-burning, or ritual use", icon: "fa-wand-sparkles", basePrice: 10, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.BREWING, sourceType: BusinessType.BREWER_VINTNER, category: ServiceCategory.FOOD_DRINK, name: "Scented Oils", description: "Blend fragrant oils for lamps, baths, and perfumes", icon: "fa-bottle-droplet", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.TANNING, sourceType: BusinessType.TANNER, category: ServiceCategory.CRAFTING, name: "Wax Leather Treatment", description: "Apply a protective wax coating to finished leather goods", icon: "fa-cow", basePrice: 3, priceType: "fixed" }
  ],
  tags: ["candle", "wax", "soap", "chandler"]
});

// ============================================================================
// CATEGORY IV: FOOD, PROVISIONS, & GENERAL GOODS
// ============================================================================

// 29. General Store
BusinessTypeRegistry.set(BusinessType.GENERAL_STORE, {
  type: BusinessType.GENERAL_STORE,
  category: BusinessCategory.FOOD_PROVISIONS,
  name: "General Store",
  subtitle: "General Goods",
  description: "A cramped but well-stocked shop bursting with everything an adventurer could need. Rope hangs from the ceiling, rations fill the shelves, and the shopkeep knows the price of it all.",
  icon: "fa-store",
  color: "#8B7D6B",
  displayMode: ShopDisplayMode.SHOP,
  legacyShopType: ShopType.GENERAL,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 13 },
  buyBack: { enabled: true, itemTypes: [] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.APPRAISE, category: ServiceCategory.INFORMATION, name: "Appraise Item", description: "Get a fair estimate of what something is worth from a seasoned trader", icon: "fa-coins", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.MISC, name: "Special Order", description: "Place an order for goods not currently in stock", icon: "fa-clipboard-list", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.ITEM_STORAGE, category: ServiceCategory.STORAGE, name: "Store Goods", description: "Leave excess gear in the back room for safekeeping", icon: "fa-box", basePrice: 1, priceType: "perDay" },
    { type: ServiceType.RATIONS, category: ServiceCategory.FOOD_DRINK, name: "Trail Rations", description: "Purchase a day's worth of dried meat, hardtack, and dried fruit", icon: "fa-apple-whole", basePrice: 1, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.REPAIR, sourceType: BusinessType.VILLAGE_BLACKSMITH, category: ServiceCategory.CRAFTING, name: "Quick Mend", description: "A rough but serviceable field repair on damaged gear", icon: "fa-wrench", basePrice: 5, priceType: "percent" },
    { type: ServiceType.RUMORS, sourceType: BusinessType.GENERAL_STORE, category: ServiceCategory.INFORMATION, name: "Local Gossip", description: "The shopkeep hears everything -- for a price, so might you", icon: "fa-ear-listen", basePrice: 2, priceType: "fixed" }
  ],
  tags: ["general", "store", "supplies", "goods"]
});

// 30. Butcher
BusinessTypeRegistry.set(BusinessType.BUTCHER, {
  type: BusinessType.BUTCHER,
  category: BusinessCategory.FOOD_PROVISIONS,
  name: "Butcher",
  subtitle: "Meat & Game",
  description: "Haunches and sausages hang from iron hooks in a cool, stone-walled shop. The butcher's cleaver falls with practiced precision on cuts both common and exotic.",
  icon: "fa-drumstick-bite",
  color: "#B22222",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 12 },
  buyBack: { enabled: true, itemTypes: ["loot"] },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.MEAT_CUTTING, category: ServiceCategory.FOOD_DRINK, name: "Butcher Game", description: "Break down a whole carcass into usable cuts of meat", icon: "fa-drumstick-bite", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.MEAT_PRESERVATION, category: ServiceCategory.FOOD_DRINK, name: "Salt & Smoke Meat", description: "Cure meat with salt and smoke so it keeps for weeks on the road", icon: "fa-bacon", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.RATIONS, category: ServiceCategory.FOOD_DRINK, name: "Meat Rations", description: "Purchase dried or smoked meat ready for travel", icon: "fa-apple-whole", basePrice: 1, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.TANNING, sourceType: BusinessType.TANNER, category: ServiceCategory.CRAFTING, name: "Save the Hide", description: "Carefully skin a carcass and prepare the hide for tanning", icon: "fa-cow", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.HIDE_PROCESSING, sourceType: BusinessType.TANNER, category: ServiceCategory.CRAFTING, name: "Process Monster Hide", description: "Strip and prepare an exotic monster hide for the tanner", icon: "fa-dragon", basePrice: 10, priceType: "fixed" }
  ],
  tags: ["meat", "butcher", "game", "provision"]
});

// 31. Baker
BusinessTypeRegistry.set(BusinessType.BAKER, {
  type: BusinessType.BAKER,
  category: BusinessCategory.FOOD_PROVISIONS,
  name: "Baker",
  subtitle: "Bread & Pastries",
  description: "The irresistible aroma of fresh bread wafts through the streets at dawn. Golden loaves, sweet pastries, and hearty pies fill the baker's shelves each morning.",
  icon: "fa-bread-slice",
  color: "#DEB887",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 11 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.BAKING, category: ServiceCategory.FOOD_DRINK, name: "Fresh Baking", description: "Bake bread, pies, or pastries fresh from the oven", icon: "fa-bread-slice", basePrice: 1, priceType: "fixed" },
    { type: ServiceType.HARDTACK, category: ServiceCategory.FOOD_DRINK, name: "Hardtack & Waybread", description: "Bake dense, long-lasting travel bread that survives any journey", icon: "fa-cookie", basePrice: 2, priceType: "fixed" },
    { type: ServiceType.RATIONS, category: ServiceCategory.FOOD_DRINK, name: "Bread Rations", description: "Purchase a day's supply of bread and baked goods for the road", icon: "fa-apple-whole", basePrice: 1, priceType: "fixed" },
    { type: ServiceType.FEAST, category: ServiceCategory.FOOD_DRINK, name: "Feast Bread & Pastries", description: "Supply fine breads and elaborate pastries for a banquet or feast", icon: "fa-cake-candles", basePrice: 10, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.MILLING, sourceType: BusinessType.MILLER, category: ServiceCategory.FOOD_DRINK, name: "Mill Fresh Flour", description: "Have grain milled to order for the freshest possible flour", icon: "fa-wheat-awn", basePrice: 2, priceType: "fixed" },
    { type: ServiceType.BREWING, sourceType: BusinessType.BREWER_VINTNER, category: ServiceCategory.FOOD_DRINK, name: "Yeast & Starters", description: "Source fresh yeast and sourdough starters from the brewer", icon: "fa-beer-mug-empty", basePrice: 1, priceType: "fixed" }
  ],
  tags: ["bread", "bake", "pastry", "food"]
});

// 32. Miller
BusinessTypeRegistry.set(BusinessType.MILLER, {
  type: BusinessType.MILLER,
  category: BusinessCategory.FOOD_PROVISIONS,
  name: "Miller",
  subtitle: "Grain & Flour",
  description: "The great millstone turns day and night, grinding golden grain into fine flour. Sacks of wheat, barley, and oats are stacked high in the dusty mill house.",
  icon: "fa-wheat-awn",
  color: "#F5DEB3",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 11 },
  buyBack: { enabled: true, itemTypes: ["loot"] },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.MILLING, category: ServiceCategory.FOOD_DRINK, name: "Mill Grain", description: "Grind wheat, barley, or other grain into flour between the millstones", icon: "fa-wheat-awn", basePrice: 2, priceType: "fixed" },
    { type: ServiceType.GRAIN_STORAGE, category: ServiceCategory.STORAGE, name: "Store Grain", description: "Keep sacks of grain dry and safe from vermin in the mill loft", icon: "fa-warehouse", basePrice: 1, priceType: "perDay" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.BAKING, sourceType: BusinessType.BAKER, category: ServiceCategory.FOOD_DRINK, name: "Simple Flatbread", description: "Bake basic flatbread from freshly milled flour on the mill hearth", icon: "fa-bread-slice", basePrice: 1, priceType: "fixed" },
    { type: ServiceType.BREWING, sourceType: BusinessType.BREWER_VINTNER, category: ServiceCategory.FOOD_DRINK, name: "Malted Grain", description: "Prepare malted barley or wheat for the brewing process", icon: "fa-beer-mug-empty", basePrice: 3, priceType: "fixed" }
  ],
  tags: ["grain", "flour", "mill", "grind"]
});

// 33. Brewer & Vintner
BusinessTypeRegistry.set(BusinessType.BREWER_VINTNER, {
  type: BusinessType.BREWER_VINTNER,
  category: BusinessCategory.FOOD_PROVISIONS,
  name: "Brewer & Vintner",
  subtitle: "Drinks & Spirits",
  description: "Great oak vats bubble and ferment in this fragrant brewery. From humble ale to fine elven wine, the brewer transforms grain and grape into liquid gold.",
  icon: "fa-beer-mug-empty",
  color: "#722F37",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 13 },
  buyBack: { enabled: true, itemTypes: ["consumable"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.BREWING, category: ServiceCategory.FOOD_DRINK, name: "Brew Ale or Wine", description: "Brew a batch of ale, mead, wine, or spirits from quality ingredients", icon: "fa-beer-mug-empty", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.WATER_PURIFICATION, category: ServiceCategory.FOOD_DRINK, name: "Purify Water", description: "Boil, filter, and treat water to make it safe for drinking on the road", icon: "fa-droplet", basePrice: 1, priceType: "fixed" },
    { type: ServiceType.VINEGAR_MAKING, category: ServiceCategory.FOOD_DRINK, name: "Brew Vinegar", description: "Produce vinegar for pickling, preserving, and cleaning wounds", icon: "fa-bottle-water", basePrice: 2, priceType: "fixed" },
    { type: ServiceType.DRINKS, category: ServiceCategory.FOOD_DRINK, name: "Purchase Drinks", description: "Buy flagons of ale, bottles of wine, or flasks of spirits to take away", icon: "fa-wine-bottle", basePrice: 1, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.COOPERAGE, sourceType: BusinessType.COOPER, category: ServiceCategory.CRAFTING, name: "Aging Barrels", description: "Source quality oak barrels for aging wine and spirits", icon: "fa-wine-bottle", basePrice: 8, priceType: "fixed" },
    { type: ServiceType.FEAST, sourceType: BusinessType.BAKER, category: ServiceCategory.FOOD_DRINK, name: "Feast Beverages", description: "Supply drinks for a banquet, feast, or celebration", icon: "fa-champagne-glasses", basePrice: 15, priceType: "fixed" }
  ],
  tags: ["brew", "wine", "ale", "mead", "spirits"]
});

// 34. Fishmonger
BusinessTypeRegistry.set(BusinessType.FISHMONGER, {
  type: BusinessType.FISHMONGER,
  category: BusinessCategory.FOOD_PROVISIONS,
  name: "Fishmonger",
  subtitle: "Fish & Seafood",
  description: "Glistening fish packed in ice and salt fill the stalls of this riverside market. The fishmonger shouts the day's catch while gulls wheel overhead.",
  icon: "fa-fish",
  color: "#5F9EA0",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 11 },
  buyBack: { enabled: true, itemTypes: ["loot"] },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.FISH_SALE, category: ServiceCategory.FOOD_DRINK, name: "Fresh Fish", description: "Purchase the day's freshest catch, gutted and scaled to order", icon: "fa-fish", basePrice: 1, priceType: "fixed" },
    { type: ServiceType.FISH_OIL, category: ServiceCategory.FOOD_DRINK, name: "Fish Oil & Byproducts", description: "Purchase rendered fish oil for lamps, waterproofing, or medicinal use", icon: "fa-bottle-droplet", basePrice: 2, priceType: "fixed" },
    { type: ServiceType.RATIONS, category: ServiceCategory.FOOD_DRINK, name: "Smoked Fish Rations", description: "Buy salt-cured or smoked fish that will last for weeks on the road", icon: "fa-apple-whole", basePrice: 1, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.MEAT_PRESERVATION, sourceType: BusinessType.BUTCHER, category: ServiceCategory.FOOD_DRINK, name: "Salt & Smoke Fish", description: "Preserve a large catch by salting, smoking, or pickling", icon: "fa-bacon", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.NET_MAKING, sourceType: BusinessType.ROPEMAKER, category: ServiceCategory.CRAFTING, name: "Repair Fishing Net", description: "Mend torn nets and replace rotted cordage", icon: "fa-border-all", basePrice: 3, priceType: "fixed" }
  ],
  tags: ["fish", "seafood", "market", "fresh"]
});

// ============================================================================
// CATEGORY V: HOSPITALITY, TRAVEL, & BEASTS
// ============================================================================

// 35. Inn
BusinessTypeRegistry.set(BusinessType.INN, {
  type: BusinessType.INN,
  category: BusinessCategory.HOSPITALITY_TRAVEL,
  name: "Inn",
  subtitle: "Rest & Lodging",
  description: "A warm hearth, a soft bed, and a hot meal await weary travelers. The inn is a sanctuary on the road, where stories and coin change hands freely.",
  icon: "fa-bed",
  color: "#B8860B",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: ShopType.INN,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 13 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.ROOM_COMMON, category: ServiceCategory.LODGING, name: "Common Room", description: "A spot on the floor near the fire with a shared blanket", icon: "fa-users", basePrice: 1, priceType: "perDay" },
    { type: ServiceType.ROOM_PRIVATE, category: ServiceCategory.LODGING, name: "Private Room", description: "A small but clean room with a bed, washbasin, and lockable door", icon: "fa-bed", basePrice: 5, priceType: "perDay" },
    { type: ServiceType.ROOM_SUITE, category: ServiceCategory.LODGING, name: "Fine Suite", description: "A spacious suite with featherbed, writing desk, and private hearth", icon: "fa-crown", basePrice: 20, priceType: "perDay" },
    { type: ServiceType.LONG_REST, category: ServiceCategory.LODGING, name: "Long Rest", description: "A full night's undisturbed sleep in safety and comfort", icon: "fa-moon", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.MEAL_COMFORTABLE, category: ServiceCategory.FOOD_DRINK, name: "Hot Meal", description: "A hearty plate of stew, bread, and cheese from the kitchen", icon: "fa-utensils", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.BATH, category: ServiceCategory.LODGING, name: "Hot Bath", description: "A copper tub of steaming water with soap and towels", icon: "fa-bath", basePrice: 2, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.DRINKS, sourceType: BusinessType.TAVERN, category: ServiceCategory.FOOD_DRINK, name: "Drinks", description: "Ale, wine, and spirits served at the common room bar", icon: "fa-beer-mug-empty", basePrice: 1, priceType: "fixed" },
    { type: ServiceType.RUMORS, sourceType: BusinessType.TAVERN, category: ServiceCategory.INFORMATION, name: "Traveler's Gossip", description: "Hear the latest news from fellow travelers at the hearth", icon: "fa-ear-listen", basePrice: 2, priceType: "fixed" }
  ],
  tags: ["inn", "lodging", "rest", "sleep", "room"]
});

// 36. Tavern
BusinessTypeRegistry.set(BusinessType.TAVERN, {
  type: BusinessType.TAVERN,
  category: BusinessCategory.HOSPITALITY_TRAVEL,
  name: "Tavern",
  subtitle: "Drinks & Merriment",
  description: "Laughter, music, and the clink of mugs fill this rowdy establishment. The tavern is where deals are struck, fights break out, and adventures begin.",
  icon: "fa-beer-mug-empty",
  color: "#8B4513",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 12 },
  buyBack: { enabled: false },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.DRINKS, category: ServiceCategory.FOOD_DRINK, name: "Drinks", description: "Ale, mead, wine, and spirits -- name your poison", icon: "fa-beer-mug-empty", basePrice: 1, priceType: "fixed" },
    { type: ServiceType.MEAL_POOR, category: ServiceCategory.FOOD_DRINK, name: "Bar Snacks", description: "Bread, cheese, and pickled eggs at the bar", icon: "fa-utensils", basePrice: 1, priceType: "fixed" },
    { type: ServiceType.MEAL_MODEST, category: ServiceCategory.FOOD_DRINK, name: "Tavern Meal", description: "A filling bowl of stew with bread and a mug of ale", icon: "fa-bowl-food", basePrice: 2, priceType: "fixed" },
    { type: ServiceType.RUMORS, category: ServiceCategory.INFORMATION, name: "Buy a Round of Rumors", description: "Loosen tongues with free drinks and hear the latest gossip", icon: "fa-ear-listen", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.GAMBLING, category: ServiceCategory.ENTERTAINMENT, name: "Gambling Table", description: "Try your luck at dice, cards, or arm-wrestling", icon: "fa-dice", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.PERFORMANCE, category: ServiceCategory.ENTERTAINMENT, name: "Live Entertainment", description: "Enjoy bards, storytellers, and performers on the tavern stage", icon: "fa-music", basePrice: 2, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.ROOM_COMMON, sourceType: BusinessType.INN, category: ServiceCategory.LODGING, name: "Sleep It Off", description: "Pass out on a bench or in the corner after a heavy night", icon: "fa-bed", basePrice: 1, priceType: "fixed" },
    { type: ServiceType.SHORT_REST, sourceType: BusinessType.INN, category: ServiceCategory.LODGING, name: "Quick Nap", description: "Rest in a quiet corner booth to catch your breath", icon: "fa-couch", basePrice: 1, priceType: "fixed" }
  ],
  tags: ["tavern", "bar", "drinks", "gambling", "social"]
});

// 37. Stable & Livery
BusinessTypeRegistry.set(BusinessType.STABLE_LIVERY, {
  type: BusinessType.STABLE_LIVERY,
  category: BusinessCategory.HOSPITALITY_TRAVEL,
  name: "Stable & Livery",
  subtitle: "Mounts & Transport",
  description: "The warm smell of hay and horse fills this sprawling stable. Mounts of every breed stand in well-kept stalls, ready for the road.",
  icon: "fa-horse",
  color: "#8B7355",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: ShopType.STABLE,
  pricing: { baseBuyMultiplier: 1.1, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: true, itemTypes: ["equipment"] },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.HORSE_BOARDING, category: ServiceCategory.TRANSPORT, name: "Board Mount", description: "A clean stall with fresh hay, water, and daily grooming", icon: "fa-warehouse", basePrice: 5, priceType: "perDay" },
    { type: ServiceType.HORSE_RENTAL, category: ServiceCategory.TRANSPORT, name: "Rent a Horse", description: "Hire a reliable riding horse for the day or week", icon: "fa-horse", basePrice: 10, priceType: "perDay" },
    { type: ServiceType.HORSE_PURCHASE, category: ServiceCategory.TRANSPORT, name: "Purchase Mount", description: "Buy a trained riding horse, warhorse, or pack animal", icon: "fa-horse", basePrice: 75, priceType: "fixed" },
    { type: ServiceType.CART_RENTAL, category: ServiceCategory.TRANSPORT, name: "Rent Cart or Wagon", description: "Hire a cart, wagon, or carriage with or without a driver", icon: "fa-trailer", basePrice: 5, priceType: "perDay" },
    { type: ServiceType.MOUNT_CARE, category: ServiceCategory.TRANSPORT, name: "Mount Grooming & Care", description: "Full grooming, hoof check, and health assessment for your mount", icon: "fa-brush", basePrice: 3, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.SHOEING, sourceType: BusinessType.FARRIER, category: ServiceCategory.CRAFTING, name: "Horseshoeing", description: "Have your mount shod with fresh shoes by the on-site farrier", icon: "fa-horse-head", basePrice: 8, priceType: "fixed" },
    { type: ServiceType.WAGON_REPAIR, sourceType: BusinessType.WHEELWRIGHT, category: ServiceCategory.CRAFTING, name: "Wagon Repair", description: "Get a damaged cart or wagon fixed in the stable yard", icon: "fa-wrench", basePrice: 15, priceType: "fixed" }
  ],
  tags: ["stable", "horse", "mount", "transport", "livery"]
});

// 38. Menagerie
BusinessTypeRegistry.set(BusinessType.MENAGERIE, {
  type: BusinessType.MENAGERIE,
  category: BusinessCategory.HOSPITALITY_TRAVEL,
  name: "Menagerie",
  subtitle: "Exotic Creatures",
  description: "Cages and enclosures house creatures from across the planes. The menagerie keeper tends beasts both wondrous and terrifying with equal care.",
  icon: "fa-dragon",
  color: "#2E8B57",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.5, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 16 },
  buyBack: { enabled: true, itemTypes: ["loot"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.COMPANION_SALE, category: ServiceCategory.ANIMAL, name: "Purchase Exotic Beast", description: "Buy a rare or exotic creature as a companion, guard, or curiosity", icon: "fa-dragon", basePrice: 200, priceType: "fixed" },
    { type: ServiceType.FAMILIAR_SOURCING, category: ServiceCategory.ANIMAL, name: "Source a Familiar", description: "Acquire a suitable creature for use as an arcane familiar", icon: "fa-dove", basePrice: 100, priceType: "fixed" },
    { type: ServiceType.BEAST_TAMING, category: ServiceCategory.ANIMAL, name: "Tame Wild Beast", description: "Break and domesticate a captured wild creature", icon: "fa-shield-dog", basePrice: 75, priceType: "fixed" },
    { type: ServiceType.ANIMAL_REHABILITATION, category: ServiceCategory.ANIMAL, name: "Rehabilitate Creature", description: "Nurse an injured or sick exotic creature back to health", icon: "fa-heart-pulse", basePrice: 30, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.ANIMAL_TRAINING, sourceType: BusinessType.ANIMAL_HANDLER, category: ServiceCategory.ANIMAL, name: "Train Exotic Beast", description: "Teach an exotic creature to obey commands and perform tasks", icon: "fa-graduation-cap", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.ANIMAL_HEALING, sourceType: BusinessType.ANIMAL_HANDLER, category: ServiceCategory.ANIMAL, name: "Veterinary Care", description: "Treat disease and injury in exotic creatures", icon: "fa-kit-medical", basePrice: 25, priceType: "fixed" }
  ],
  tags: ["menagerie", "exotic", "beast", "creature", "familiar"]
});

// 39. Animal Handler
BusinessTypeRegistry.set(BusinessType.ANIMAL_HANDLER, {
  type: BusinessType.ANIMAL_HANDLER,
  category: BusinessCategory.HOSPITALITY_TRAVEL,
  name: "Animal Handler",
  subtitle: "Training & Veterinary",
  description: "A patient trainer works with hounds, hawks, and horses in a fenced paddock. The animal handler speaks the language of beasts through trust and discipline.",
  icon: "fa-shield-dog",
  color: "#6B8E23",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 13 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.ANIMAL_TRAINING, category: ServiceCategory.ANIMAL, name: "Train Animal", description: "Teach an animal new tricks, commands, or combat behavior", icon: "fa-graduation-cap", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.ANIMAL_HEALING, category: ServiceCategory.ANIMAL, name: "Treat Animal", description: "Diagnose and treat injuries, illness, or poisoning in animals", icon: "fa-kit-medical", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.ANIMAL_REHABILITATION, category: ServiceCategory.ANIMAL, name: "Rehabilitate Animal", description: "Restore an abused, traumatized, or feral animal to docility", icon: "fa-heart-pulse", basePrice: 20, priceType: "fixed" },
    { type: ServiceType.PEST_CONTROL, category: ServiceCategory.ANIMAL, name: "Pest Control", description: "Deploy trained animals to clear rats, snakes, or other vermin", icon: "fa-bug", basePrice: 10, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.HORSE_BOARDING, sourceType: BusinessType.STABLE_LIVERY, category: ServiceCategory.TRANSPORT, name: "Animal Boarding", description: "Board dogs, hawks, or other companion animals during your stay", icon: "fa-warehouse", basePrice: 3, priceType: "perDay" },
    { type: ServiceType.COMPANION_SALE, sourceType: BusinessType.MENAGERIE, category: ServiceCategory.ANIMAL, name: "Trained Companion", description: "Purchase a pre-trained guard dog, hunting hawk, or messenger bird", icon: "fa-dove", basePrice: 50, priceType: "fixed" }
  ],
  tags: ["animal", "handler", "trainer", "veterinary"]
});

// 40. Courier & Post
BusinessTypeRegistry.set(BusinessType.COURIER_POST, {
  type: BusinessType.COURIER_POST,
  category: BusinessCategory.HOSPITALITY_TRAVEL,
  name: "Courier & Post",
  subtitle: "Messages & Parcels",
  description: "Fleet-footed runners and mounted riders wait for dispatch in this busy post house. Letters and parcels cross kingdoms through the courier's network.",
  icon: "fa-envelope",
  color: "#4169E1",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.COURIER_SERVICE, category: ServiceCategory.TRANSPORT, name: "Send a Letter", description: "Dispatch a letter or message by foot courier to a nearby settlement", icon: "fa-envelope", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.CARAVAN_POST, category: ServiceCategory.TRANSPORT, name: "Parcel by Caravan", description: "Send a package with the next merchant caravan heading in your direction", icon: "fa-box", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.SECURE_TRANSPORT, category: ServiceCategory.TRANSPORT, name: "Secure Delivery", description: "Hire an armed courier for valuable or sensitive deliveries", icon: "fa-lock", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.CARRIER_PIGEON, category: ServiceCategory.TRANSPORT, name: "Send by Pigeon", description: "Dispatch an urgent short message by trained carrier pigeon", icon: "fa-dove", basePrice: 3, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.MAGIC_MAIL, sourceType: BusinessType.WIZARDS_TOWER, category: ServiceCategory.MAGIC, name: "Arcane Sending", description: "Arrange a magical Sending spell for instant cross-continent messaging", icon: "fa-wand-sparkles", basePrice: 100, priceType: "fixed" },
    { type: ServiceType.LETTER_WRITING, sourceType: BusinessType.SCRIBE_SCRIVENER, category: ServiceCategory.MISC, name: "Write a Letter", description: "Have a professional scribe compose your correspondence", icon: "fa-feather-pointed", basePrice: 3, priceType: "fixed" }
  ],
  tags: ["courier", "post", "mail", "delivery", "message"]
});

// 41. Guide & Ranger Lodge
BusinessTypeRegistry.set(BusinessType.GUIDE_RANGER_LODGE, {
  type: BusinessType.GUIDE_RANGER_LODGE,
  category: BusinessCategory.HOSPITALITY_TRAVEL,
  name: "Guide & Ranger Lodge",
  subtitle: "Wilderness Expertise",
  description: "A rugged lodge at the edge of civilization where rangers, scouts, and guides gather. Maps of wild trails and monster tracks cover the walls.",
  icon: "fa-compass",
  color: "#2F4F4F",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.1, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: true, itemTypes: ["weapon", "tool"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.GUIDE_HIRE, category: ServiceCategory.INFORMATION, name: "Hire a Guide", description: "Employ an experienced wilderness guide to lead you through dangerous terrain", icon: "fa-compass", basePrice: 25, priceType: "perDay" },
    { type: ServiceType.MAP_PURCHASE, category: ServiceCategory.INFORMATION, name: "Trail Map", description: "Purchase a hand-drawn map of local trails, hunting grounds, or danger zones", icon: "fa-map", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.RUMORS, category: ServiceCategory.INFORMATION, name: "Wilderness Intel", description: "Learn about monster sightings, bandit camps, and trail conditions from scouts", icon: "fa-binoculars", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.SKILL_TRAINING, category: ServiceCategory.TRAINING, name: "Survival Training", description: "Learn wilderness survival skills: tracking, foraging, and shelter-building", icon: "fa-campground", basePrice: 25, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.ANIMAL_TRAINING, sourceType: BusinessType.ANIMAL_HANDLER, category: ServiceCategory.ANIMAL, name: "Train Hunting Companion", description: "Train a dog or hawk for hunting and tracking in the wild", icon: "fa-shield-dog", basePrice: 30, priceType: "fixed" },
    { type: ServiceType.BOUNTY_POST, sourceType: BusinessType.TOWN_HALL, category: ServiceCategory.LEGAL, name: "Monster Bounties", description: "Check the bounty board for wanted creatures and their rewards", icon: "fa-scroll", basePrice: 0, priceType: "fixed" }
  ],
  tags: ["guide", "ranger", "wilderness", "scout", "trail"]
});

// ============================================================================
// CATEGORY VI: CIVIC, FAITH, & LAW
// ============================================================================

// 42. Town Hall
BusinessTypeRegistry.set(BusinessType.TOWN_HALL, {
  type: BusinessType.TOWN_HALL,
  category: BusinessCategory.CIVIC_FAITH_LAW,
  name: "Town Hall",
  subtitle: "Government & Administration",
  description: "The seat of local authority where laws are made, taxes collected, and justice administered. Clerks bustle between stacks of ledgers and proclamations.",
  icon: "fa-building-columns",
  color: "#708090",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: false, persuasionDC: 18 },
  buyBack: { enabled: false },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.TAX_COLLECTION, category: ServiceCategory.CIVIC, name: "Pay Taxes & Fees", description: "Pay local taxes, tolls, or administrative fees at the clerk's window", icon: "fa-coins", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.LAND_DEED, category: ServiceCategory.CIVIC, name: "File Land Deed", description: "Register ownership of property, land, or a building", icon: "fa-file-signature", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.BUILDING_PERMIT, category: ServiceCategory.CIVIC, name: "Building Permit", description: "Obtain permission to construct, modify, or expand a structure", icon: "fa-hammer", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.LICENSE, category: ServiceCategory.LEGAL, name: "Business License", description: "Purchase a license to operate a business, guild, or trade within town", icon: "fa-id-card", basePrice: 20, priceType: "fixed" },
    { type: ServiceType.BOUNTY_POST, category: ServiceCategory.LEGAL, name: "Bounty Board", description: "Post or claim bounties on wanted criminals and dangerous creatures", icon: "fa-scroll", basePrice: 0, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.NOTARY, sourceType: BusinessType.TOWN_HALL, category: ServiceCategory.LEGAL, name: "Notarize Document", description: "Have an official notary witness and seal a legal document", icon: "fa-stamp", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.LEGAL_COUNSEL, sourceType: BusinessType.JAIL_STOCKS, category: ServiceCategory.LEGAL, name: "Legal Counsel", description: "Consult with the town's legal advisor on matters of law", icon: "fa-scale-balanced", basePrice: 15, priceType: "fixed" }
  ],
  tags: ["government", "civic", "tax", "law", "permit"]
});

// 43. Bank & Exchange
BusinessTypeRegistry.set(BusinessType.BANK_EXCHANGE, {
  type: BusinessType.BANK_EXCHANGE,
  category: BusinessCategory.CIVIC_FAITH_LAW,
  name: "Bank & Exchange",
  subtitle: "Finance & Vaults",
  description: "Iron-bound doors guard vault rooms stacked with coin and bullion. The banker counts, exchanges, and lends with the precision of a master accountant.",
  icon: "fa-landmark",
  color: "#DAA520",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.5 },
  haggling: { enabled: false, persuasionDC: 18 },
  buyBack: { enabled: false },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.CURRENCY_EXCHANGE, category: ServiceCategory.FINANCIAL, name: "Exchange Currency", description: "Convert between copper, silver, electrum, gold, and platinum at market rates", icon: "fa-coins", basePrice: 1, priceType: "percent" },
    { type: ServiceType.SAFE_DEPOSIT, category: ServiceCategory.STORAGE, name: "Safe Deposit Box", description: "Store valuables in a locked, guarded vault box", icon: "fa-vault", basePrice: 10, priceType: "perDay" },
    { type: ServiceType.MONEY_TRANSFER, category: ServiceCategory.FINANCIAL, name: "Money Transfer", description: "Wire funds to a partner bank in another city via sealed letter of credit", icon: "fa-paper-plane", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.LOAN, category: ServiceCategory.FINANCIAL, name: "Take a Loan", description: "Borrow gold against collateral or credit, with interest", icon: "fa-hand-holding-dollar", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.ITEM_STORAGE, category: ServiceCategory.STORAGE, name: "Vault Storage", description: "Store bulky or valuable items in the bank's secured vaults", icon: "fa-box", basePrice: 5, priceType: "perDay" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.APPRAISE, sourceType: BusinessType.FINE_METALSMITH, category: ServiceCategory.INFORMATION, name: "Appraise Valuables", description: "Have a certified appraiser assess the value of gems, art, or bullion", icon: "fa-magnifying-glass", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.CONTRACT, sourceType: BusinessType.TOWN_HALL, category: ServiceCategory.LEGAL, name: "Financial Contract", description: "Draft and notarize a financial agreement or promissory note", icon: "fa-file-contract", basePrice: 15, priceType: "fixed" }
  ],
  tags: ["bank", "vault", "exchange", "finance", "gold"]
});

// 44. Temple (Large)
BusinessTypeRegistry.set(BusinessType.TEMPLE_LARGE, {
  type: BusinessType.TEMPLE_LARGE,
  category: BusinessCategory.CIVIC_FAITH_LAW,
  name: "Temple",
  subtitle: "Divine Services",
  description: "Soaring arches and stained glass cast colored light across the nave. The faithful gather here to pray, heal, and seek guidance from the divine.",
  icon: "fa-place-of-worship",
  color: "#FFD700",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: false, persuasionDC: 16 },
  buyBack: { enabled: false },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.HEALING, category: ServiceCategory.HEALING, name: "Divine Healing", description: "Receive miraculous healing through prayer and divine grace", icon: "fa-heart-pulse", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.CURE_DISEASE, category: ServiceCategory.HEALING, name: "Cure Disease", description: "Cleanse disease through holy rites and divine intervention", icon: "fa-virus-slash", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.REMOVE_CURSE, category: ServiceCategory.HEALING, name: "Remove Curse", description: "Break a curse through ritual prayer and divine power", icon: "fa-hand-sparkles", basePrice: 100, priceType: "fixed" },
    { type: ServiceType.RESTORATION, category: ServiceCategory.HEALING, name: "Restoration", description: "Restore drained abilities, youth, or vitality through greater divine magic", icon: "fa-sun", basePrice: 200, priceType: "fixed" },
    { type: ServiceType.RESURRECTION, category: ServiceCategory.HEALING, name: "Raise the Dead", description: "Call a departed soul back from the beyond to rejoin the living", icon: "fa-cross", basePrice: 500, priceType: "fixed" },
    { type: ServiceType.BLESSING, category: ServiceCategory.HEALING, name: "Receive Blessing", description: "Receive a priestly blessing for protection, luck, or safe travels", icon: "fa-hand-holding-heart", basePrice: 10, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.CURE_POISON, sourceType: BusinessType.APOTHECARY, category: ServiceCategory.HEALING, name: "Cure Poison", description: "Purify venom through prayer and herbal antidotes kept by the temple", icon: "fa-skull-crossbones", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.DONATION, sourceType: BusinessType.TEMPLE_LARGE, category: ServiceCategory.MISC, name: "Make a Donation", description: "Contribute gold to the temple's charitable works and earn divine favor", icon: "fa-hand-holding-heart", basePrice: 10, priceType: "fixed" }
  ],
  tags: ["temple", "church", "healing", "divine", "faith"]
});

// 45. Shrine (Small)
BusinessTypeRegistry.set(BusinessType.SHRINE_SMALL, {
  type: BusinessType.SHRINE_SMALL,
  category: BusinessCategory.CIVIC_FAITH_LAW,
  name: "Shrine",
  subtitle: "Roadside Devotion",
  description: "A humble stone shrine beside the road where travelers pause to pray. A single acolyte tends the eternal flame and offers what comfort they can.",
  icon: "fa-hands-praying",
  color: "#C0C0C0",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: false, persuasionDC: 12 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.BLESSING, category: ServiceCategory.HEALING, name: "Traveler's Blessing", description: "Receive a humble blessing for safe passage on the road ahead", icon: "fa-hand-holding-heart", basePrice: 2, priceType: "fixed" },
    { type: ServiceType.HEALING, category: ServiceCategory.HEALING, name: "Minor Healing", description: "A simple prayer of healing to mend minor wounds", icon: "fa-heart-pulse", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.SHORT_REST, category: ServiceCategory.LODGING, name: "Rest at the Shrine", description: "Rest in peace and quiet beside the shrine's calming presence", icon: "fa-moon", basePrice: 0, priceType: "fixed" },
    { type: ServiceType.FORTUNE_TELLING, category: ServiceCategory.ENTERTAINMENT, name: "Read the Omens", description: "The shrine keeper interprets signs and portents for the devout", icon: "fa-eye", basePrice: 5, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.CURE_DISEASE, sourceType: BusinessType.TEMPLE_LARGE, category: ServiceCategory.HEALING, name: "Herbal Remedy", description: "The acolyte offers simple herbal remedies for common ailments", icon: "fa-leaf", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.DONATION, sourceType: BusinessType.TEMPLE_LARGE, category: ServiceCategory.MISC, name: "Leave an Offering", description: "Leave a coin, candle, or token at the shrine", icon: "fa-hand-holding-heart", basePrice: 1, priceType: "fixed" }
  ],
  tags: ["shrine", "prayer", "roadside", "blessing", "faith"]
});

// 46. Undertaker
BusinessTypeRegistry.set(BusinessType.UNDERTAKER, {
  type: BusinessType.UNDERTAKER,
  category: BusinessCategory.CIVIC_FAITH_LAW,
  name: "Undertaker",
  subtitle: "Death & Burial",
  description: "A solemn establishment where the dead are prepared for their final journey. The undertaker works in quiet dignity, providing closure to the grieving.",
  icon: "fa-cross",
  color: "#2F2F2F",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: false, persuasionDC: 14 },
  buyBack: { enabled: true, itemTypes: ["loot"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.BURIAL_SERVICE, category: ServiceCategory.BODY_CARE, name: "Burial Service", description: "A dignified burial with coffin, grave, and graveside rites", icon: "fa-cross", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.EMBALMING, category: ServiceCategory.BODY_CARE, name: "Embalming", description: "Preserve a body through embalming for transport or delayed burial", icon: "fa-flask-vial", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.CREMATION, category: ServiceCategory.BODY_CARE, name: "Cremation", description: "Reduce remains to ashes on a proper funeral pyre", icon: "fa-fire", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.IDENTIFY, category: ServiceCategory.INFORMATION, name: "Identify Remains", description: "Determine the cause of death or identity of unknown remains", icon: "fa-magnifying-glass", basePrice: 10, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.BLESSING, sourceType: BusinessType.TEMPLE_LARGE, category: ServiceCategory.HEALING, name: "Last Rites", description: "Arrange for a priest to perform proper funeral rites", icon: "fa-hands-praying", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.STONEWORK, sourceType: BusinessType.STONEMASON, category: ServiceCategory.CRAFTING, name: "Headstone", description: "Commission a carved stone marker for the grave", icon: "fa-landmark", basePrice: 20, priceType: "fixed" }
  ],
  tags: ["undertaker", "burial", "funeral", "death"]
});

// 47. Jail & Stocks
BusinessTypeRegistry.set(BusinessType.JAIL_STOCKS, {
  type: BusinessType.JAIL_STOCKS,
  category: BusinessCategory.CIVIC_FAITH_LAW,
  name: "Jail & Stocks",
  subtitle: "Law Enforcement",
  description: "Iron-barred cells and heavy chains await those who break the law. The jailer watches with dispassionate eyes, keys jangling at their belt.",
  icon: "fa-scale-balanced",
  color: "#4A4A4A",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: false, persuasionDC: 16 },
  buyBack: { enabled: false },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.FINE_PAYMENT, category: ServiceCategory.CIVIC, name: "Pay a Fine", description: "Pay outstanding fines for petty crimes and misdemeanors", icon: "fa-coins", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.BAIL, category: ServiceCategory.CIVIC, name: "Post Bail", description: "Post bail to secure the release of a jailed companion", icon: "fa-key", basePrice: 100, priceType: "fixed" },
    { type: ServiceType.PRISONER_INFO, category: ServiceCategory.INFORMATION, name: "Prisoner Visitation", description: "Visit or inquire about a prisoner held in the cells", icon: "fa-person-circle-question", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.LEGAL_COUNSEL, category: ServiceCategory.LEGAL, name: "Legal Counsel", description: "Consult with a legal advisor about charges, defense, or rights", icon: "fa-scale-balanced", basePrice: 15, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.BOUNTY_POST, sourceType: BusinessType.TOWN_HALL, category: ServiceCategory.LEGAL, name: "Wanted Posters", description: "Review the current wanted posters for fugitives and their bounties", icon: "fa-scroll", basePrice: 0, priceType: "fixed" },
    { type: ServiceType.CONTRACT, sourceType: BusinessType.TOWN_HALL, category: ServiceCategory.LEGAL, name: "File Complaint", description: "File a formal legal complaint or accusation with the authorities", icon: "fa-file-contract", basePrice: 5, priceType: "fixed" }
  ],
  tags: ["jail", "prison", "law", "stocks", "justice"]
});

// ============================================================================
// CATEGORY VII: THE ARTS, LEISURE, & BODY
// ============================================================================

// 48. Barber-Surgeon
BusinessTypeRegistry.set(BusinessType.BARBER_SURGEON, {
  type: BusinessType.BARBER_SURGEON,
  category: BusinessCategory.ARTS_LEISURE_BODY,
  name: "Barber-Surgeon",
  subtitle: "Grooming & Medicine",
  description: "A striped pole marks this dual-purpose shop where a skilled hand wields razor and scalpel with equal dexterity. Shaves, haircuts, and battlefield surgery under one roof.",
  icon: "fa-scissors",
  color: "#DC143C",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 12 },
  buyBack: { enabled: false },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.HAIRCUT, category: ServiceCategory.BODY_CARE, name: "Haircut & Styling", description: "A trim, shaping, or full restyle with hot shears", icon: "fa-scissors", basePrice: 2, priceType: "fixed" },
    { type: ServiceType.SHAVE, category: ServiceCategory.BODY_CARE, name: "Clean Shave", description: "A smooth shave with hot towels and sharp steel", icon: "fa-face-smile", basePrice: 1, priceType: "fixed" },
    { type: ServiceType.DENTISTRY, category: ServiceCategory.BODY_CARE, name: "Pull a Tooth", description: "Extract a rotten or aching tooth with practiced efficiency", icon: "fa-tooth", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.MINOR_SURGERY, category: ServiceCategory.BODY_CARE, name: "Minor Surgery", description: "Stitch wounds, set bones, and remove arrowheads with a steady hand", icon: "fa-kit-medical", basePrice: 15, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.HEALING, sourceType: BusinessType.TEMPLE_LARGE, category: ServiceCategory.HEALING, name: "Treat Wounds", description: "Clean and bandage injuries using herbal salves and poultices", icon: "fa-heart-pulse", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.CURE_DISEASE, sourceType: BusinessType.APOTHECARY, category: ServiceCategory.HEALING, name: "Diagnose Illness", description: "Examine symptoms and prescribe treatment for common diseases", icon: "fa-stethoscope", basePrice: 10, priceType: "fixed" }
  ],
  tags: ["barber", "surgeon", "haircut", "medicine"]
});

// 49. Bathhouse
BusinessTypeRegistry.set(BusinessType.BATHHOUSE, {
  type: BusinessType.BATHHOUSE,
  category: BusinessCategory.ARTS_LEISURE_BODY,
  name: "Bathhouse",
  subtitle: "Relaxation & Cleansing",
  description: "Steam rises from heated pools in this tiled sanctuary. The bathhouse offers respite from the road's grime and the weight of the world.",
  icon: "fa-bath",
  color: "#4682B4",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 11 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.BATHING, category: ServiceCategory.BODY_CARE, name: "Public Bath", description: "Soak in the communal heated pools with soap and towels provided", icon: "fa-bath", basePrice: 1, priceType: "fixed" },
    { type: ServiceType.BATH, category: ServiceCategory.BODY_CARE, name: "Private Bath", description: "A private copper tub with scented oils and heated water", icon: "fa-bath", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.MASSAGE_SERVICE, category: ServiceCategory.BODY_CARE, name: "Massage", description: "A deep-tissue massage to ease aching muscles and old injuries", icon: "fa-hand-holding-heart", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.LAUNDRY, category: ServiceCategory.LODGING, name: "Laundry Service", description: "Have your filthy adventuring clothes washed, dried, and folded", icon: "fa-shirt", basePrice: 2, priceType: "fixed" },
    { type: ServiceType.SHORT_REST, category: ServiceCategory.LODGING, name: "Rest & Relax", description: "Spend time resting in the warm, soothing atmosphere of the baths", icon: "fa-spa", basePrice: 2, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.HAIRCUT, sourceType: BusinessType.BARBER_SURGEON, category: ServiceCategory.BODY_CARE, name: "Grooming", description: "Get a haircut and shave while you soak", icon: "fa-scissors", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.HEALING, sourceType: BusinessType.TEMPLE_LARGE, category: ServiceCategory.HEALING, name: "Healing Waters", description: "Soak in mineral-rich hot springs rumored to have restorative properties", icon: "fa-heart-pulse", basePrice: 10, priceType: "fixed" }
  ],
  tags: ["bath", "bathhouse", "relaxation", "steam", "spa"]
});

// 50. Artist's Studio
BusinessTypeRegistry.set(BusinessType.ARTISTS_STUDIO, {
  type: BusinessType.ARTISTS_STUDIO,
  category: BusinessCategory.ARTS_LEISURE_BODY,
  name: "Artist's Studio",
  subtitle: "Fine Arts & Portraits",
  description: "Canvases, chisels, and pigments fill this light-drenched workshop. The artist captures likenesses, illuminates manuscripts, and creates beauty on commission.",
  icon: "fa-paintbrush",
  color: "#FF6347",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.3, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: true, itemTypes: ["loot"] },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.PORTRAIT, category: ServiceCategory.ARTS, name: "Paint Portrait", description: "Sit for a painted portrait in oils, from a quick sketch to a grand canvas", icon: "fa-image", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.COMMISSION_ART, category: ServiceCategory.ARTS, name: "Commission Artwork", description: "Order a painting, mural, or sculpture to your specifications", icon: "fa-paintbrush", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.ART_RESTORATION, category: ServiceCategory.ARTS, name: "Restore Artwork", description: "Clean, repair, and restore damaged paintings, frescoes, or sculptures", icon: "fa-wand-magic-sparkles", basePrice: 30, priceType: "fixed" },
    { type: ServiceType.SKETCH_ARTIST, category: ServiceCategory.ARTS, name: "Sketch a Likeness", description: "Quick charcoal sketch of a person, place, or creature from description", icon: "fa-pen", basePrice: 5, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.FORGERY, sourceType: BusinessType.SCRIBE_SCRIVENER, category: ServiceCategory.MISC, name: "Art Forgery", description: "Produce a convincing replica of a known painting or artwork", icon: "fa-stamp", basePrice: 100, priceType: "fixed" },
    { type: ServiceType.HERALDRY, sourceType: BusinessType.ARMORER, category: ServiceCategory.CRAFTING, name: "Paint Heraldry", description: "Design and paint a coat of arms or guild sigil", icon: "fa-flag", basePrice: 15, priceType: "fixed" }
  ],
  tags: ["art", "artist", "portrait", "paint", "studio"]
});

// 51. Luthier
BusinessTypeRegistry.set(BusinessType.LUTHIER, {
  type: BusinessType.LUTHIER,
  category: BusinessCategory.ARTS_LEISURE_BODY,
  name: "Luthier",
  subtitle: "Musical Instruments",
  description: "Lutes, lyres, and flutes hang from pegs in this resonant workshop. The luthier shapes wood and string into instruments that can move hearts and command magic.",
  icon: "fa-guitar",
  color: "#CD853F",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.2, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: true, itemTypes: ["tool"] },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.INSTRUMENT_REPAIR, category: ServiceCategory.ARTS, name: "Repair Instrument", description: "Fix cracks, replace strings, and restore damaged instruments", icon: "fa-wrench", basePrice: 10, priceType: "percent" },
    { type: ServiceType.INSTRUMENT_TUNING, category: ServiceCategory.ARTS, name: "Tune Instrument", description: "Professionally tune and adjust an instrument for perfect pitch", icon: "fa-sliders", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.ARTS, name: "Commission Instrument", description: "Have a bespoke instrument crafted from fine woods and materials", icon: "fa-guitar", basePrice: 100, priceType: "fixed" },
    { type: ServiceType.APPRAISE, category: ServiceCategory.INFORMATION, name: "Appraise Instrument", description: "Assess the age, origin, and value of a musical instrument", icon: "fa-magnifying-glass", basePrice: 5, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.ENCHANT, sourceType: BusinessType.ENCHANTER, category: ServiceCategory.MAGIC, name: "Enchant Instrument", description: "Imbue an instrument with magical resonance for bardic casting", icon: "fa-wand-sparkles", basePrice: 200, priceType: "fixed" },
    { type: ServiceType.WOODWORKING, sourceType: BusinessType.CARPENTER_JOINER, category: ServiceCategory.CRAFTING, name: "Custom Wood Selection", description: "Source rare tonewoods for an instrument body or neck", icon: "fa-tree", basePrice: 25, priceType: "fixed" }
  ],
  tags: ["luthier", "music", "instrument", "lute", "bard"]
});

// 52. Jeweler
BusinessTypeRegistry.set(BusinessType.JEWELER, {
  type: BusinessType.JEWELER,
  category: BusinessCategory.ARTS_LEISURE_BODY,
  name: "Jeweler",
  subtitle: "Gems & Precious Stones",
  description: "Velvet-lined cases display rings, necklaces, and crowns set with dazzling gems. The jeweler's loupe reveals flaws invisible to the naked eye.",
  icon: "fa-gem",
  color: "#E6E6FA",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: ShopType.JEWELRY,
  pricing: { baseBuyMultiplier: 1.4, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 16 },
  buyBack: { enabled: true, itemTypes: ["equipment", "loot"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.APPRAISE, category: ServiceCategory.INFORMATION, name: "Appraise Gems", description: "Examine and assess the cut, clarity, and value of precious stones", icon: "fa-gem", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.CRAFTING, name: "Commission Jewelry", description: "Design a custom piece of jewelry with your choice of metals and gems", icon: "fa-ring", basePrice: 100, priceType: "fixed" },
    { type: ServiceType.REPAIR, category: ServiceCategory.CRAFTING, name: "Repair Jewelry", description: "Fix broken clasps, replace missing stones, and restore damaged pieces", icon: "fa-wrench", basePrice: 15, priceType: "percent" },
    { type: ServiceType.RESIZE, category: ServiceCategory.CRAFTING, name: "Resize Jewelry", description: "Adjust rings, bracelets, and circlets for a perfect fit", icon: "fa-ring", basePrice: 8, priceType: "fixed" },
    { type: ServiceType.POLISH, category: ServiceCategory.CRAFTING, name: "Clean & Polish", description: "Restore the brilliance of tarnished or dull jewelry", icon: "fa-star", basePrice: 3, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.ENCHANT, sourceType: BusinessType.ENCHANTER, category: ServiceCategory.MAGIC, name: "Enchant Jewelry", description: "Have gems enchanted with protective or enhancing magic", icon: "fa-wand-sparkles", basePrice: 250, priceType: "fixed" },
    { type: ServiceType.FINE_METALWORK, sourceType: BusinessType.FINE_METALSMITH, category: ServiceCategory.CRAFTING, name: "Fine Metal Setting", description: "Set gems in elaborate gold or platinum mountings", icon: "fa-ring", basePrice: 30, priceType: "fixed" }
  ],
  tags: ["jeweler", "gems", "rings", "precious", "stones"]
});

// ============================================================================
// CATEGORY VIII: ILLICIT, NICHE, & MARITIME
// ============================================================================

// 53. Mercenary Guild
BusinessTypeRegistry.set(BusinessType.MERCENARY_GUILD, {
  type: BusinessType.MERCENARY_GUILD,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Mercenary Guild",
  subtitle: "Swords for Hire",
  description: "Scarred warriors sharpen blades and swap war stories in this fortified guild hall. For the right price, the guild provides muscle for any job.",
  icon: "fa-swords",
  color: "#8B0000",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.2, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 16 },
  buyBack: { enabled: true, itemTypes: ["weapon", "equipment"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.HIRE_MERCENARY, category: ServiceCategory.MISC, name: "Hire Mercenary", description: "Contract a trained fighter for guard duty, escort, or combat operations", icon: "fa-swords", basePrice: 50, priceType: "perDay" },
    { type: ServiceType.BOUNTY_CLAIM, category: ServiceCategory.LEGAL, name: "Claim Bounty", description: "Turn in proof of a completed bounty contract for payment", icon: "fa-scroll", basePrice: 0, priceType: "fixed" },
    { type: ServiceType.WEAPON_PROFICIENCY, category: ServiceCategory.TRAINING, name: "Combat Training", description: "Train with veteran fighters to improve weapon technique", icon: "fa-dumbbell", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.SPARRING, category: ServiceCategory.TRAINING, name: "Sparring Match", description: "Test your skills against a guild member in a non-lethal bout", icon: "fa-hand-fist", basePrice: 5, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.RUMORS, sourceType: BusinessType.TAVERN, category: ServiceCategory.INFORMATION, name: "War Intelligence", description: "Hear about conflicts, dangers, and opportunities from the field", icon: "fa-ear-listen", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.REPAIR, sourceType: BusinessType.VILLAGE_BLACKSMITH, category: ServiceCategory.CRAFTING, name: "Field Repairs", description: "Quick weapon and armor repairs by the guild's armorer", icon: "fa-wrench", basePrice: 10, priceType: "percent" }
  ],
  tags: ["mercenary", "guild", "fighter", "hire", "combat"]
});

// 54. Pawn Shop & Fence
BusinessTypeRegistry.set(BusinessType.PAWN_SHOP_FENCE, {
  type: BusinessType.PAWN_SHOP_FENCE,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Pawn Shop & Fence",
  subtitle: "Buy, Sell, & No Questions",
  description: "A dimly lit shop crammed with mismatched goods of dubious provenance. The proprietor buys anything and asks nothing about where it came from.",
  icon: "fa-mask",
  color: "#2F4F4F",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: ShopType.BLACK_MARKET,
  pricing: { baseBuyMultiplier: 0.8, baseSellMultiplier: 0.7 },
  haggling: { enabled: true, persuasionDC: 15 },
  buyBack: { enabled: true, itemTypes: [] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.PAWN, category: ServiceCategory.FINANCIAL, name: "Pawn an Item", description: "Leave an item as collateral for a quick loan -- buy it back later or lose it", icon: "fa-hand-holding-dollar", basePrice: 0, priceType: "percent" },
    { type: ServiceType.FENCING_STOLEN, category: ServiceCategory.FINANCIAL, name: "Fence Goods", description: "Sell stolen or questionable goods with no questions asked", icon: "fa-mask", basePrice: 0, priceType: "percent" },
    { type: ServiceType.APPRAISE, category: ServiceCategory.INFORMATION, name: "Street Appraisal", description: "Quick and dirty valuation -- the fence knows what everything is worth on the black market", icon: "fa-magnifying-glass", basePrice: 2, priceType: "fixed" },
    { type: ServiceType.HIDE_SERVICE, category: ServiceCategory.MISC, name: "Lay Low", description: "Use the back room to hide from guards, creditors, or worse", icon: "fa-eye-slash", basePrice: 10, priceType: "perDay" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.DISGUISE_SERVICE, sourceType: BusinessType.PAWN_SHOP_FENCE, category: ServiceCategory.MISC, name: "Quick Disguise", description: "Assemble a passable disguise from the shop's eclectic inventory", icon: "fa-masks-theater", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.RUMORS, sourceType: BusinessType.TAVERN, category: ServiceCategory.INFORMATION, name: "Underworld Gossip", description: "Hear whispers about heists, gang movements, and shady deals", icon: "fa-ear-listen", basePrice: 5, priceType: "fixed" }
  ],
  tags: ["pawn", "fence", "black market", "stolen", "shady"]
});

// 55. Brothel
BusinessTypeRegistry.set(BusinessType.BROTHEL, {
  type: BusinessType.BROTHEL,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Brothel",
  subtitle: "Companionship & Secrets",
  description: "Silk curtains, perfumed air, and soft music define this discreet establishment. The madame runs a tight operation where discretion is the most valued currency.",
  icon: "fa-heart",
  color: "#C71585",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: false },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.PERFORMANCE, category: ServiceCategory.ENTERTAINMENT, name: "Entertainment", description: "Music, dancing, and companionship in a luxurious setting", icon: "fa-music", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.PILLOW_TALK, category: ServiceCategory.INFORMATION, name: "Pillow Talk", description: "Powerful people let secrets slip in moments of intimacy", icon: "fa-comment-dots", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.DRINKS, category: ServiceCategory.FOOD_DRINK, name: "Fine Drinks", description: "Expensive wines and spirits served in crystal glasses", icon: "fa-wine-glass", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.ROOM_PRIVATE, category: ServiceCategory.LODGING, name: "Private Room", description: "A perfumed room with a comfortable bed and absolute privacy", icon: "fa-bed", basePrice: 15, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.RUMORS, sourceType: BusinessType.TAVERN, category: ServiceCategory.INFORMATION, name: "Gossip Network", description: "The staff hears everything from their wealthy and powerful clientele", icon: "fa-ear-listen", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.DISGUISE_SERVICE, sourceType: BusinessType.PAWN_SHOP_FENCE, category: ServiceCategory.MISC, name: "Change of Clothes", description: "Leave wearing something completely different than you arrived in", icon: "fa-masks-theater", basePrice: 10, priceType: "fixed" }
  ],
  tags: ["brothel", "companionship", "secrets", "entertainment"]
});

// 56. Shipyard
BusinessTypeRegistry.set(BusinessType.SHIPYARD, {
  type: BusinessType.SHIPYARD,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Shipyard",
  subtitle: "Vessel Construction & Repair",
  description: "The crack of timber and the smell of tar fill this sprawling dockside operation. Hulls are laid, keels raised, and vessels made seaworthy.",
  icon: "fa-ship",
  color: "#2F4F4F",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.2, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 15 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.SHIP_REPAIR, category: ServiceCategory.MARITIME, name: "Repair Hull", description: "Patch holes, replace rotted planking, and restore a damaged hull", icon: "fa-ship", basePrice: 100, priceType: "fixed" },
    { type: ServiceType.CAULKING, category: ServiceCategory.MARITIME, name: "Caulk & Seal", description: "Seal hull seams with oakum and tar to prevent leaks", icon: "fa-droplet", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.MARITIME, name: "Commission Vessel", description: "Order a new boat, ship, or barge built to your specifications", icon: "fa-anchor", basePrice: 500, priceType: "fixed" },
    { type: ServiceType.SALVAGE, category: ServiceCategory.MARITIME, name: "Salvage Operations", description: "Recover cargo and materials from sunken or wrecked vessels", icon: "fa-life-ring", basePrice: 75, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.WOODWORKING, sourceType: BusinessType.CARPENTER_JOINER, category: ServiceCategory.CRAFTING, name: "Deck Carpentry", description: "Rebuild deck planking and interior woodwork on vessels", icon: "fa-tree", basePrice: 30, priceType: "fixed" },
    { type: ServiceType.ROPE_MAKING, sourceType: BusinessType.ROPEMAKER, category: ServiceCategory.CRAFTING, name: "Ship's Rigging", description: "Replace worn rigging, halyards, and lines", icon: "fa-link", basePrice: 20, priceType: "fixed" }
  ],
  tags: ["shipyard", "ship", "vessel", "maritime", "dock"]
});

// 57. Navigator & Harbor
BusinessTypeRegistry.set(BusinessType.NAVIGATOR_HARBOR, {
  type: BusinessType.NAVIGATOR_HARBOR,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Navigator & Harbor",
  subtitle: "Charts & Passage",
  description: "Charts, astrolabes, and weathered logbooks crowd this harbor office. The navigator knows every current, shoal, and safe anchorage from here to the far shores.",
  icon: "fa-anchor",
  color: "#4682B4",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.1, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.SEA_CHARTS, category: ServiceCategory.MARITIME, name: "Sea Charts", description: "Purchase or copy nautical charts of coastal waters and trade routes", icon: "fa-map", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.PILOTING, category: ServiceCategory.MARITIME, name: "Hire a Pilot", description: "Contract an experienced harbor pilot to guide your vessel safely", icon: "fa-compass", basePrice: 20, priceType: "fixed" },
    { type: ServiceType.PASSAGE_BOOK, category: ServiceCategory.TRANSPORT, name: "Book Passage", description: "Arrange passage aboard a merchant vessel heading to another port", icon: "fa-ticket", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.WEATHER_PREDICTION, category: ServiceCategory.MARITIME, name: "Weather Forecast", description: "Consult experienced sailors about wind, weather, and sailing conditions", icon: "fa-cloud-sun", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.DOCKING, category: ServiceCategory.MARITIME, name: "Dock & Moorage", description: "Rent a berth at the harbor docks for your vessel", icon: "fa-anchor", basePrice: 5, priceType: "perDay" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.CARTOGRAPHY, sourceType: BusinessType.CARTOGRAPHER, category: ServiceCategory.INFORMATION, name: "Chart Correction", description: "Have a cartographer update and correct your navigational charts", icon: "fa-pen-ruler", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.SHIP_REPAIR, sourceType: BusinessType.SHIPYARD, category: ServiceCategory.MARITIME, name: "Emergency Repairs", description: "Arrange emergency hull repairs through the harbor's shipwright", icon: "fa-ship", basePrice: 50, priceType: "fixed" }
  ],
  tags: ["navigator", "harbor", "charts", "maritime", "port"]
});

// 58. Mining Office
BusinessTypeRegistry.set(BusinessType.MINING_OFFICE, {
  type: BusinessType.MINING_OFFICE,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Mining Office",
  subtitle: "Claims & Ore",
  description: "Dusty ledgers and mineral samples fill this no-nonsense office. The mining master controls who digs where, and takes a cut of everything that comes up.",
  icon: "fa-helmet-safety",
  color: "#A0522D",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.6 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: true, itemTypes: ["loot"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.MINING_CLAIM, category: ServiceCategory.CIVIC, name: "Stake a Claim", description: "Register a mining claim for exclusive rights to dig a specific area", icon: "fa-mountain", basePrice: 100, priceType: "fixed" },
    { type: ServiceType.ORE_APPRAISAL, category: ServiceCategory.INFORMATION, name: "Appraise Ore", description: "Have a mine assayer test and value your raw ore samples", icon: "fa-gem", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.BLASTING_SUPPLIES, category: ServiceCategory.MISC, name: "Blasting Supplies", description: "Purchase black powder, fuses, and other demolition materials", icon: "fa-bomb", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.GUIDE_HIRE, category: ServiceCategory.INFORMATION, name: "Hire Mine Guide", description: "Contract an experienced miner to guide you through underground tunnels", icon: "fa-person-digging", basePrice: 15, priceType: "perDay" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.SMELTING, sourceType: BusinessType.SMELTER_REFINERY, category: ServiceCategory.CRAFTING, name: "Process Ore", description: "Arrange to have raw ore processed at a nearby smelter", icon: "fa-fire-flame-curved", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.EXCAVATION, sourceType: BusinessType.STONEMASON, category: ServiceCategory.CRAFTING, name: "Tunnel Work", description: "Contract stoneworkers to shore up tunnels and dig new shafts", icon: "fa-mountain", basePrice: 50, priceType: "fixed" }
  ],
  tags: ["mining", "ore", "claim", "underground"]
});

// 59. Asylum
BusinessTypeRegistry.set(BusinessType.ASYLUM, {
  type: BusinessType.ASYLUM,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Asylum",
  subtitle: "Care for the Afflicted",
  description: "Behind high walls and barred windows, the afflicted wander and whisper. The asylum keeper provides care -- or at least containment -- for those lost to madness.",
  icon: "fa-brain",
  color: "#696969",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: false, persuasionDC: 14 },
  buyBack: { enabled: false },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.ASYLUM_CARE, category: ServiceCategory.BODY_CARE, name: "Commit Patient", description: "Admit someone suffering from madness, possession, or mental affliction", icon: "fa-brain", basePrice: 10, priceType: "perDay" },
    { type: ServiceType.HEALING, category: ServiceCategory.HEALING, name: "Treat Madness", description: "Attempt to cure or manage mental afflictions through care and restraint", icon: "fa-heart-pulse", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.PRISONER_INFO, category: ServiceCategory.INFORMATION, name: "Visit a Patient", description: "Visit someone committed to the asylum -- if the keeper permits it", icon: "fa-person-circle-question", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.RESEARCH, category: ServiceCategory.INFORMATION, name: "Study Afflictions", description: "Access the asylum's records on rare mental conditions and curses", icon: "fa-book-medical", basePrice: 15, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.REMOVE_CURSE, sourceType: BusinessType.TEMPLE_LARGE, category: ServiceCategory.HEALING, name: "Exorcism", description: "Arrange for a priest to attempt to lift a curse or banish a possessing entity", icon: "fa-cross", basePrice: 100, priceType: "fixed" },
    { type: ServiceType.RESTORATION, sourceType: BusinessType.TEMPLE_LARGE, category: ServiceCategory.HEALING, name: "Restoration", description: "Seek divine restoration for permanent mental afflictions", icon: "fa-sun", basePrice: 200, priceType: "fixed" }
  ],
  tags: ["asylum", "madness", "care", "mental", "affliction"]
});

// 60. Orphanage
BusinessTypeRegistry.set(BusinessType.ORPHANAGE, {
  type: BusinessType.ORPHANAGE,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Orphanage",
  subtitle: "Charity & Street Smarts",
  description: "A crowded, drafty building filled with the laughter and tears of children with nowhere else to go. The matron stretches every copper to keep them fed.",
  icon: "fa-children",
  color: "#DEB887",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: false, persuasionDC: 10 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.DONATION, category: ServiceCategory.MISC, name: "Make a Donation", description: "Contribute gold, food, or supplies to help feed and shelter the children", icon: "fa-hand-holding-heart", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.STREET_URCHIN_INFO, category: ServiceCategory.INFORMATION, name: "Street Urchin Network", description: "The orphans see and hear everything on the streets -- for candy or coin, they'll share", icon: "fa-eye", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.APPRENTICE_RECRUITMENT, category: ServiceCategory.MISC, name: "Recruit an Apprentice", description: "Take on an orphan as an apprentice -- giving them a trade and a future", icon: "fa-graduation-cap", basePrice: 0, priceType: "fixed" },
    { type: ServiceType.HIDE_SERVICE, category: ServiceCategory.MISC, name: "Hide Among the Children", description: "Nobody looks twice at an orphanage -- lay low among the chaos", icon: "fa-eye-slash", basePrice: 5, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.RUMORS, sourceType: BusinessType.TAVERN, category: ServiceCategory.INFORMATION, name: "Street Gossip", description: "The children bring back scraps of overheard conversations from across town", icon: "fa-ear-listen", basePrice: 2, priceType: "fixed" },
    { type: ServiceType.COURIER_SERVICE, sourceType: BusinessType.COURIER_POST, category: ServiceCategory.TRANSPORT, name: "Urchin Messenger", description: "Send a quick, discreet message via a swift-footed street child", icon: "fa-envelope", basePrice: 1, priceType: "fixed" }
  ],
  tags: ["orphanage", "charity", "children", "urchin", "street"]
});

// 61. Library & Archives
BusinessTypeRegistry.set(BusinessType.LIBRARY_ARCHIVES, {
  type: BusinessType.LIBRARY_ARCHIVES,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Library & Archives",
  subtitle: "Knowledge & Lore",
  description: "Towering shelves of books, scrolls, and codices stretch into the shadows. The archivist guards centuries of accumulated knowledge with zealous dedication.",
  icon: "fa-book",
  color: "#8B4513",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: false, persuasionDC: 14 },
  buyBack: { enabled: true, itemTypes: ["loot"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.LORE_RESEARCH, category: ServiceCategory.INFORMATION, name: "Research a Topic", description: "Spend hours poring over texts to uncover information on a specific subject", icon: "fa-book-open-reader", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.RESEARCH, category: ServiceCategory.INFORMATION, name: "Hire a Researcher", description: "Commission an archivist to search for information on your behalf", icon: "fa-magnifying-glass", basePrice: 30, priceType: "fixed" },
    { type: ServiceType.TRANSLATION, category: ServiceCategory.INFORMATION, name: "Translate Text", description: "Have an ancient or foreign text translated by the library's scholars", icon: "fa-language", basePrice: 20, priceType: "fixed" },
    { type: ServiceType.SPELL_COPYING, category: ServiceCategory.MAGIC, name: "Copy Spell from Archive", description: "Wizards may copy spells from the library's collection into their own spellbook", icon: "fa-book", basePrice: 50, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.CARTOGRAPHY, sourceType: BusinessType.CARTOGRAPHER, category: ServiceCategory.INFORMATION, name: "Historical Maps", description: "Access the library's collection of historical and antique maps", icon: "fa-map", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.SCRIBE_SCROLL, sourceType: BusinessType.SCRIBE_SCRIVENER, category: ServiceCategory.MAGIC, name: "Commission Copy", description: "Have a rare text copied by a professional scribe", icon: "fa-scroll", basePrice: 25, priceType: "fixed" }
  ],
  tags: ["library", "archive", "books", "lore", "knowledge"]
});

// 62. Glasshouse
BusinessTypeRegistry.set(BusinessType.GLASSHOUSE, {
  type: BusinessType.GLASSHOUSE,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Glasshouse",
  subtitle: "Exotic Plants & Herbs",
  description: "A structure of iron and glass panels shelters exotic plants from harsh climates. Rare herbs, poisonous flowers, and magical fungi thrive in the humid warmth.",
  icon: "fa-seedling",
  color: "#228B22",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.2, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 13 },
  buyBack: { enabled: true, itemTypes: ["consumable", "loot"] },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.MISC, name: "Cultivate Rare Plant", description: "Commission the growing of a rare or exotic herb from seed or cutting", icon: "fa-seedling", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.APPRAISE, category: ServiceCategory.INFORMATION, name: "Identify Plant", description: "Have an unknown plant, herb, or fungus identified by an expert botanist", icon: "fa-leaf", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.CURE_POISON, category: ServiceCategory.HEALING, name: "Antidote Herbs", description: "Source fresh antidote herbs for poison treatment", icon: "fa-leaf", basePrice: 15, priceType: "fixed" },
    { type: ServiceType.RESEARCH, category: ServiceCategory.INFORMATION, name: "Botanical Research", description: "Study the properties and uses of rare plants in the collection", icon: "fa-flask-vial", basePrice: 10, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.BREW_POTION, sourceType: BusinessType.APOTHECARY, category: ServiceCategory.MAGIC, name: "Herbal Preparation", description: "Prepare dried herbs and fresh ingredients for potion brewing", icon: "fa-mortar-pestle", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.GLASSWORK, sourceType: BusinessType.GLASSBLOWER, category: ServiceCategory.CRAFTING, name: "Glass Panel Repair", description: "Replace broken glass panels in the conservatory structure", icon: "fa-wine-glass", basePrice: 10, priceType: "fixed" }
  ],
  tags: ["glasshouse", "plants", "herbs", "greenhouse", "botanical"]
});

// 63. Paper Maker
BusinessTypeRegistry.set(BusinessType.PAPER_MAKER, {
  type: BusinessType.PAPER_MAKER,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Paper Maker",
  subtitle: "Paper & Parchment",
  description: "Vats of pulped rag and stretched drying frames fill this workshop. The paper maker transforms raw fiber into smooth sheets ready for ink and history.",
  icon: "fa-note-sticky",
  color: "#F5F5DC",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 11 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.PAPER_MAKING, category: ServiceCategory.CRAFTING, name: "Make Paper", description: "Produce sheets of fine writing paper, parchment, or vellum from raw materials", icon: "fa-note-sticky", basePrice: 2, priceType: "fixed" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.CRAFTING, name: "Custom Paper", description: "Commission paper in specific sizes, weights, colors, or with watermarks", icon: "fa-ruler", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.WATERPROOFING, category: ServiceCategory.CRAFTING, name: "Waterproof Document", description: "Treat paper or parchment with wax to resist water damage", icon: "fa-droplet", basePrice: 3, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.LETTER_WRITING, sourceType: BusinessType.SCRIBE_SCRIVENER, category: ServiceCategory.MISC, name: "Stationery Set", description: "Purchase a complete writing set with ink, quills, and fine paper", icon: "fa-pen", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.CANDLE_MAKING, sourceType: BusinessType.CHANDLER, category: ServiceCategory.CRAFTING, name: "Sealing Wax", description: "Purchase colored sealing wax for document security", icon: "fa-stamp", basePrice: 2, priceType: "fixed" }
  ],
  tags: ["paper", "parchment", "vellum", "stationery"]
});

// 64. Potter & Ceramics
BusinessTypeRegistry.set(BusinessType.POTTER_CERAMICS, {
  type: BusinessType.POTTER_CERAMICS,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Potter & Ceramics",
  subtitle: "Clay & Earthenware",
  description: "A potter's wheel spins endlessly in this clay-splattered workshop. Shelves of bowls, jars, and tiles wait for the kiln's transforming heat.",
  icon: "fa-mug-hot",
  color: "#CD853F",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.4 },
  haggling: { enabled: true, persuasionDC: 11 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.POTTERY, category: ServiceCategory.CRAFTING, name: "Pottery", description: "Throw and fire bowls, jars, jugs, and vessels on the potter's wheel", icon: "fa-mug-hot", basePrice: 3, priceType: "fixed" },
    { type: ServiceType.TILE_MAKING, category: ServiceCategory.CRAFTING, name: "Make Tiles", description: "Produce decorative or functional ceramic floor and wall tiles", icon: "fa-table-cells", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.CUSTOM_ORDER, category: ServiceCategory.CRAFTING, name: "Custom Ceramics", description: "Commission unique pottery with specific glazes, shapes, or decorations", icon: "fa-paintbrush", basePrice: 15, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.DYEING, sourceType: BusinessType.WEAVER_DYER, category: ServiceCategory.CRAFTING, name: "Colored Glaze", description: "Apply specialty colored glazes from imported pigments", icon: "fa-palette", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.REPAIR, sourceType: BusinessType.VILLAGE_BLACKSMITH, category: ServiceCategory.CRAFTING, name: "Repair Kiln", description: "Fix and maintain the kiln's iron fittings and firebricks", icon: "fa-wrench", basePrice: 10, priceType: "fixed" }
  ],
  tags: ["potter", "ceramics", "clay", "kiln", "earthenware"]
});

// 65. Falconer
BusinessTypeRegistry.set(BusinessType.FALCONER, {
  type: BusinessType.FALCONER,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Falconer",
  subtitle: "Raptors & Hunting Birds",
  description: "Hooded hawks and falcons perch on leather-wrapped stands in this mews. The falconer speaks softly, earning the fierce trust of the sky's deadliest hunters.",
  icon: "fa-feather",
  color: "#8B6914",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.3, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 15 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.FALCONRY, category: ServiceCategory.ANIMAL, name: "Train Raptor", description: "Capture and train a hawk, falcon, or eagle for hunting or scouting", icon: "fa-feather", basePrice: 50, priceType: "fixed" },
    { type: ServiceType.COMPANION_SALE, category: ServiceCategory.ANIMAL, name: "Purchase Raptor", description: "Buy a trained hunting bird -- hawk, falcon, or owl", icon: "fa-dove", basePrice: 75, priceType: "fixed" },
    { type: ServiceType.ANIMAL_HEALING, category: ServiceCategory.ANIMAL, name: "Treat Raptor", description: "Treat injuries, broken feathers, or illness in a bird of prey", icon: "fa-kit-medical", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.CARRIER_PIGEON, category: ServiceCategory.TRANSPORT, name: "Message by Bird", description: "Send a message via trained raptor or carrier hawk", icon: "fa-dove", basePrice: 5, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.ANIMAL_TRAINING, sourceType: BusinessType.ANIMAL_HANDLER, category: ServiceCategory.ANIMAL, name: "Advanced Commands", description: "Teach a raptor complex tricks and combat maneuvers", icon: "fa-graduation-cap", basePrice: 30, priceType: "fixed" },
    { type: ServiceType.LEATHERWORK, sourceType: BusinessType.LEATHERWORKER, category: ServiceCategory.CRAFTING, name: "Falconry Gear", description: "Commission leather jesses, hoods, and gauntlets for falconry", icon: "fa-vest", basePrice: 15, priceType: "fixed" }
  ],
  tags: ["falconer", "hawk", "falcon", "raptor", "hunting"]
});

// 66. Interpreter
BusinessTypeRegistry.set(BusinessType.INTERPRETER, {
  type: BusinessType.INTERPRETER,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Interpreter",
  subtitle: "Languages & Translation",
  description: "A polyglot scholar fluent in a dozen tongues offers translation services from a book-lined study. From Elvish poetry to Infernal contracts, no text is beyond their skill.",
  icon: "fa-language",
  color: "#4682B4",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 13 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.INTERPRETATION, category: ServiceCategory.INFORMATION, name: "Live Interpretation", description: "Hire an interpreter to translate during negotiations, interrogations, or audiences", icon: "fa-language", basePrice: 15, priceType: "perDay" },
    { type: ServiceType.TRANSLATION, category: ServiceCategory.INFORMATION, name: "Translate Document", description: "Translate a written document from one language to another", icon: "fa-file-lines", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.LANGUAGE_TRAINING, category: ServiceCategory.TRAINING, name: "Language Lessons", description: "Study a new language with a patient and experienced teacher", icon: "fa-chalkboard-user", basePrice: 25, priceType: "fixed" },
    { type: ServiceType.ETIQUETTE_TRAINING, category: ServiceCategory.TRAINING, name: "Cultural Briefing", description: "Learn the customs, etiquette, and taboos of a foreign culture before a diplomatic visit", icon: "fa-handshake", basePrice: 15, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.LORE_RESEARCH, sourceType: BusinessType.LIBRARY_ARCHIVES, category: ServiceCategory.INFORMATION, name: "Linguistic Research", description: "Research the origins and meanings of ancient or obscure languages", icon: "fa-book", basePrice: 20, priceType: "fixed" },
    { type: ServiceType.LETTER_WRITING, sourceType: BusinessType.SCRIBE_SCRIVENER, category: ServiceCategory.MISC, name: "Multilingual Letters", description: "Compose diplomatic correspondence in multiple languages", icon: "fa-envelope", basePrice: 10, priceType: "fixed" }
  ],
  tags: ["interpreter", "language", "translation", "diplomat"]
});

// 67. Moneylender
BusinessTypeRegistry.set(BusinessType.MONEYLENDER, {
  type: BusinessType.MONEYLENDER,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Moneylender",
  subtitle: "Loans & Debt",
  description: "A nondescript door leads to a dimly lit counting room. The moneylender offers coin when no one else will -- but the interest is always steep.",
  icon: "fa-hand-holding-dollar",
  color: "#556B2F",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 17 },
  buyBack: { enabled: false },
  backroom: { enabled: true },
  coreServices: [
    { type: ServiceType.LOAN, category: ServiceCategory.FINANCIAL, name: "Take a Loan", description: "Borrow gold at steep interest -- collateral or reputation required", icon: "fa-hand-holding-dollar", basePrice: 0, priceType: "percent" },
    { type: ServiceType.DEBT_COLLECTION, category: ServiceCategory.FINANCIAL, name: "Debt Collection", description: "Pay off an existing debt, or hire the moneylender's agents to collect from others", icon: "fa-file-invoice-dollar", basePrice: 10, priceType: "percent" },
    { type: ServiceType.CURRENCY_EXCHANGE, category: ServiceCategory.FINANCIAL, name: "Exchange Currency", description: "Convert between currencies at less favorable rates than a bank, but no questions asked", icon: "fa-coins", basePrice: 2, priceType: "percent" },
    { type: ServiceType.SAFE_DEPOSIT, category: ServiceCategory.STORAGE, name: "Stash Gold", description: "Hide coin in the moneylender's vault -- off the books, off the record", icon: "fa-vault", basePrice: 5, priceType: "perDay" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.CONTRACT, sourceType: BusinessType.TOWN_HALL, category: ServiceCategory.LEGAL, name: "Debt Contract", description: "Draw up a legally binding loan agreement with penalties for default", icon: "fa-file-contract", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.HIRE_MERCENARY, sourceType: BusinessType.MERCENARY_GUILD, category: ServiceCategory.MISC, name: "Hire Enforcer", description: "Send muscle to persuade reluctant debtors to pay what they owe", icon: "fa-hand-fist", basePrice: 25, priceType: "fixed" }
  ],
  tags: ["moneylender", "loan", "debt", "usury", "finance"]
});

// 68. Town Crier
BusinessTypeRegistry.set(BusinessType.TOWN_CRIER, {
  type: BusinessType.TOWN_CRIER,
  category: BusinessCategory.ILLICIT_NICHE_MARITIME,
  name: "Town Crier",
  subtitle: "News & Announcements",
  description: "A bellowing voice and a brass bell announce the news of the day. The town crier stands at the crossroads, the living newspaper of the settlement.",
  icon: "fa-bullhorn",
  color: "#FF8C00",
  displayMode: ShopDisplayMode.SERVICES,
  legacyShopType: null,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.3 },
  haggling: { enabled: true, persuasionDC: 11 },
  buyBack: { enabled: false },
  backroom: { enabled: false },
  coreServices: [
    { type: ServiceType.PROCLAMATION, category: ServiceCategory.MISC, name: "Public Proclamation", description: "Have your message shouted to the public at the town square", icon: "fa-bullhorn", basePrice: 5, priceType: "fixed" },
    { type: ServiceType.ADVERTISING, category: ServiceCategory.MISC, name: "Advertise Business", description: "Have the crier announce your goods, services, or upcoming events", icon: "fa-rectangle-ad", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.RUMORS, category: ServiceCategory.INFORMATION, name: "News of the Day", description: "Hear the latest local news, decrees, and announcements", icon: "fa-newspaper", basePrice: 1, priceType: "fixed" },
    { type: ServiceType.BOUNTY_POST, category: ServiceCategory.LEGAL, name: "Announce Bounty", description: "Have a wanted notice or bounty announcement cried in the public square", icon: "fa-scroll", basePrice: 15, priceType: "fixed" }
  ],
  crossCompatibleServices: [
    { type: ServiceType.COURIER_SERVICE, sourceType: BusinessType.COURIER_POST, category: ServiceCategory.TRANSPORT, name: "Spread the Word", description: "Arrange for the crier's message to be carried to neighboring settlements", icon: "fa-envelope", basePrice: 10, priceType: "fixed" },
    { type: ServiceType.LETTER_WRITING, sourceType: BusinessType.SCRIBE_SCRIVENER, category: ServiceCategory.MISC, name: "Written Notice", description: "Have a notice drafted and posted on the town board", icon: "fa-feather-pointed", basePrice: 3, priceType: "fixed" }
  ],
  tags: ["crier", "news", "announcement", "proclamation"]
});

// ============================================================================
// SPECIAL: CUSTOM BUSINESS TYPE
// ============================================================================

BusinessTypeRegistry.set(BusinessType.CUSTOM, {
  type: BusinessType.CUSTOM,
  category: null,
  name: "Custom Business",
  subtitle: "GM-Defined",
  description: "A unique establishment defined entirely by the GM. All services, inventory, and personality are manually configured.",
  icon: "fa-wand-magic-sparkles",
  color: "#9370DB",
  displayMode: ShopDisplayMode.MIXED,
  legacyShopType: ShopType.CUSTOM,
  pricing: { baseBuyMultiplier: 1.0, baseSellMultiplier: 0.5 },
  haggling: { enabled: true, persuasionDC: 14 },
  buyBack: { enabled: true, itemTypes: [] },
  backroom: { enabled: false },
  coreServices: [],
  crossCompatibleServices: [],
  tags: ["custom"]
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the full business definition for a business type
 * @param {string} businessType - BusinessType enum value
 * @returns {object|null}
 */
export function getBusinessDefinition(businessType) {
  return BusinessTypeRegistry.get(businessType) || null;
}

/**
 * Get all businesses in a specific category
 * @param {string} category - BusinessCategory enum value
 * @returns {object[]}
 */
export function getBusinessesByCategory(category) {
  const results = [];
  for (const def of BusinessTypeRegistry.values()) {
    if (def.category === category) results.push(def);
  }
  return results;
}

/**
 * Get core services for a business type
 * @param {string} businessType - BusinessType enum value
 * @returns {object[]}
 */
export function getCoreServices(businessType) {
  const def = BusinessTypeRegistry.get(businessType);
  return def ? def.coreServices : [];
}

/**
 * Get cross-compatible (Plan B) services for a business type
 * @param {string} businessType - BusinessType enum value
 * @returns {object[]}
 */
export function getCrossCompatibleServices(businessType) {
  const def = BusinessTypeRegistry.get(businessType);
  return def ? def.crossCompatibleServices : [];
}

/**
 * Get all available services (core + cross-compatible) for a business type
 * @param {string} businessType - BusinessType enum value
 * @returns {object[]}
 */
export function getAllAvailableServices(businessType) {
  const def = BusinessTypeRegistry.get(businessType);
  if (!def) return [];
  return [...def.coreServices, ...def.crossCompatibleServices];
}

/**
 * Legacy migration map: ShopType -> BusinessType
 */
const LEGACY_SHOP_TYPE_MAP = {
  [ShopType.GENERAL]: BusinessType.GENERAL_STORE,
  [ShopType.WEAPONS]: BusinessType.MASTER_WEAPONSMITH,
  [ShopType.ARMOR]: BusinessType.ARMORER,
  [ShopType.MAGIC]: BusinessType.WIZARDS_TOWER,
  [ShopType.POTIONS]: BusinessType.APOTHECARY,
  [ShopType.SCROLLS]: BusinessType.SCRIBE_SCRIVENER,
  [ShopType.BLACKSMITH]: BusinessType.VILLAGE_BLACKSMITH,
  [ShopType.TAILOR]: BusinessType.TAILOR,
  [ShopType.STABLE]: BusinessType.STABLE_LIVERY,
  [ShopType.INN]: BusinessType.INN,
  [ShopType.BLACK_MARKET]: BusinessType.PAWN_SHOP_FENCE,
  [ShopType.JEWELRY]: BusinessType.JEWELER,
  [ShopType.TOOLS]: BusinessType.GENERAL_STORE,
  [ShopType.FOOD]: BusinessType.GENERAL_STORE,
  [ShopType.CUSTOM]: BusinessType.CUSTOM
};

/**
 * Map a legacy ShopType to the new BusinessType
 * @param {string} shopType - ShopType enum value
 * @returns {string|null} BusinessType value or null
 */
export function getBusinessTypeFromLegacyShopType(shopType) {
  return LEGACY_SHOP_TYPE_MAP[shopType] || null;
}

/**
 * Get all business types as an array of definitions, sorted by category then name
 * @returns {object[]}
 */
export function getAllBusinessTypes() {
  const all = Array.from(BusinessTypeRegistry.values());
  const categoryOrder = Object.values(BusinessCategory);
  return all.sort((a, b) => {
    const catA = categoryOrder.indexOf(a.category);
    const catB = categoryOrder.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Search business types by tag
 * @param {string} tag - Tag to search for
 * @returns {object[]}
 */
export function searchBusinessTypes(tag) {
  const results = [];
  const lower = tag.toLowerCase();
  for (const def of BusinessTypeRegistry.values()) {
    if (def.tags.some(t => t.includes(lower)) || def.name.toLowerCase().includes(lower)) {
      results.push(def);
    }
  }
  return results;
}

/**
 * Create a merchant data object from a business type definition
 * @param {string} businessType - BusinessType enum value
 * @param {object} overrides - Optional field overrides
 * @returns {object} Merchant data ready for createMerchant
 */
export function createMerchantFromBusinessType(businessType, overrides = {}) {
  const def = getBusinessDefinition(businessType);
  if (!def) {
    return createMerchant({ businessType, ...overrides });
  }

  // Build services list from core services
  const servicesList = def.coreServices.map(s => ({
    ...s,
    enabled: true
  }));

  // Add cross-compatible services (enabled by default)
  for (const s of def.crossCompatibleServices) {
    servicesList.push({ ...s, enabled: true });
  }

  return createMerchant({
    name: def.name,
    description: def.description,
    type: def.legacyShopType || ShopType.CUSTOM,
    businessType: def.type,
    businessCategory: def.category,
    icon: def.icon,
    color: def.color,
    displayMode: def.displayMode || ShopDisplayMode.AUTO,
    pricing: def.pricing,
    haggling: def.haggling,
    buyBack: def.buyBack,
    backroom: def.backroom,
    servicesList,
    _dataVersion: 2,
    ...overrides
  });
}