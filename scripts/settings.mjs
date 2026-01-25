/**
 * Bob's Talking NPCs - Settings Registration
 * Registers all world (GM) and client (player) settings
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";

/**
 * Register all module settings
 * Called during the init hook
 */
export function registerSettings() {
  // World Settings (GM-level)
  registerWorldSettings();

  // Client Settings (Player-level)
  registerClientSettings();

  // Keybindings
  registerKeybindings();

  console.log(`${MODULE_ID} | Settings registered`);
}

/**
 * Register world-scoped settings (GM controls)
 */
function registerWorldSettings() {
  // ===== Party Settings =====

  game.settings.register(MODULE_ID, "partyDefinition", {
    name: "BOBSNPC.Settings.PartyDefinition.Name",
    hint: "BOBSNPC.Settings.PartyDefinition.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      "primary_party": "BOBSNPC.Settings.PartyDefinition.PrimaryParty",
      "folder": "BOBSNPC.Settings.PartyDefinition.Folder",
      "manual": "BOBSNPC.Settings.PartyDefinition.Manual"
    },
    default: "primary_party",
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "partyFolder", {
    name: "BOBSNPC.Settings.PartyFolder.Name",
    hint: "BOBSNPC.Settings.PartyFolder.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "",
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "partyManualList", {
    name: "Party Manual List",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  // ===== Quest Settings =====

  game.settings.register(MODULE_ID, "questDistribution", {
    name: "BOBSNPC.Settings.QuestDistribution.Name",
    hint: "BOBSNPC.Settings.QuestDistribution.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      "split": "BOBSNPC.Settings.QuestDistribution.Split",
      "full_each": "BOBSNPC.Settings.QuestDistribution.FullEach",
      "gm_choice": "BOBSNPC.Settings.QuestDistribution.GMChoice"
    },
    default: "split",
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "allowQuestAbandonment", {
    name: "BOBSNPC.Settings.AllowQuestAbandonment.Name",
    hint: "BOBSNPC.Settings.AllowQuestAbandonment.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "showLockedQuests", {
    name: "BOBSNPC.Settings.ShowLockedQuests.Name",
    hint: "BOBSNPC.Settings.ShowLockedQuests.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "questMarkers", {
    name: "BOBSNPC.Settings.QuestMarkers.Name",
    hint: "BOBSNPC.Settings.QuestMarkers.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  // ===== NPC Settings =====

  game.settings.register(MODULE_ID, "npcIndicators", {
    name: "BOBSNPC.Settings.NPCIndicators.Name",
    hint: "BOBSNPC.Settings.NPCIndicators.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "scheduleEnabled", {
    name: "BOBSNPC.Settings.ScheduleEnabled.Name",
    hint: "BOBSNPC.Settings.ScheduleEnabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  // ===== Economy Settings =====

  game.settings.register(MODULE_ID, "currencyDisplay", {
    name: "BOBSNPC.Settings.CurrencyDisplay.Name",
    hint: "BOBSNPC.Settings.CurrencyDisplay.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      "gold_down": "BOBSNPC.Settings.CurrencyDisplay.GoldDown",
      "all": "BOBSNPC.Settings.CurrencyDisplay.All"
    },
    default: "gold_down",
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "hagglingEnabled", {
    name: "BOBSNPC.Settings.HagglingEnabled.Name",
    hint: "BOBSNPC.Settings.HagglingEnabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "charismaAffectsPrices", {
    name: "BOBSNPC.Settings.CharismaAffectsPrices.Name",
    hint: "BOBSNPC.Settings.CharismaAffectsPrices.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  // ===== Crime Settings =====

  game.settings.register(MODULE_ID, "crimeEnabled", {
    name: "BOBSNPC.Settings.CrimeEnabled.Name",
    hint: "BOBSNPC.Settings.CrimeEnabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "stealingEnabled", {
    name: "BOBSNPC.Settings.StealingEnabled.Name",
    hint: "BOBSNPC.Settings.StealingEnabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "bountyEnabled", {
    name: "BOBSNPC.Settings.BountyEnabled.Name",
    hint: "BOBSNPC.Settings.BountyEnabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  // ===== Dialogue Settings =====

  game.settings.register(MODULE_ID, "sharedDialogues", {
    name: "BOBSNPC.Settings.SharedDialogues.Name",
    hint: "BOBSNPC.Settings.SharedDialogues.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "dialogueVoting", {
    name: "BOBSNPC.Settings.DialogueVoting.Name",
    hint: "BOBSNPC.Settings.DialogueVoting.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "skillCheckVisibility", {
    name: "BOBSNPC.Settings.SkillCheckVisibility.Name",
    hint: "BOBSNPC.Settings.SkillCheckVisibility.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      "public": "BOBSNPC.Settings.SkillCheckVisibility.Public",
      "private": "BOBSNPC.Settings.SkillCheckVisibility.Private",
      "gm_choice": "BOBSNPC.Settings.SkillCheckVisibility.GMChoice"
    },
    default: "public",
    requiresReload: false
  });

  // ===== Audio Settings =====

  game.settings.register(MODULE_ID, "soundEffectsEnabled", {
    name: "BOBSNPC.Settings.SoundEffectsEnabled.Name",
    hint: "BOBSNPC.Settings.SoundEffectsEnabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  // ===== Loot Settings =====

  game.settings.register(MODULE_ID, "lootDistribution", {
    name: "BOBSNPC.Settings.LootDistribution.Name",
    hint: "BOBSNPC.Settings.LootDistribution.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      "free": "BOBSNPC.Settings.LootDistribution.Free",
      "need_greed": "BOBSNPC.Settings.LootDistribution.NeedGreed",
      "round_robin": "BOBSNPC.Settings.LootDistribution.RoundRobin",
      "party_vault": "BOBSNPC.Settings.LootDistribution.PartyVault",
      "gm": "BOBSNPC.Settings.LootDistribution.GM"
    },
    default: "need_greed",
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "corpseConsolidation", {
    name: "BOBSNPC.Settings.CorpseConsolidation.Name",
    hint: "BOBSNPC.Settings.CorpseConsolidation.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  // ===== Data Storage Settings (Hidden) =====

  // World data storage for quests, factions, dialogue states, etc.
  game.settings.register(MODULE_ID, "worldData", {
    name: "World Data",
    scope: "world",
    config: false,
    type: Object,
    default: {
      quests: {},
      factions: {},
      dialogues: {},
      merchants: {},
      banks: {}
    }
  });

  // Crime jurisdictions configuration
  game.settings.register(MODULE_ID, "jurisdictions", {
    name: "Jurisdictions",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // Hireling data storage
  game.settings.register(MODULE_ID, "hirelings", {
    name: "Hirelings",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // Property data storage
  game.settings.register(MODULE_ID, "properties", {
    name: "Properties",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });
}

/**
 * Register client-scoped settings (Player controls)
 */
function registerClientSettings() {
  // ===== Quest Tracker Settings =====

  game.settings.register(MODULE_ID, "questTrackerEnabled", {
    name: "BOBSNPC.Settings.QuestTracker.Name",
    hint: "BOBSNPC.Settings.QuestTracker.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false,
    onChange: (value) => {
      // Toggle quest tracker visibility
      Hooks.call(`${MODULE_ID}.questTrackerToggle`, value);
    }
  });

  game.settings.register(MODULE_ID, "questTrackerPosition", {
    name: "BOBSNPC.Settings.QuestTrackerPosition.Name",
    hint: "BOBSNPC.Settings.QuestTrackerPosition.Hint",
    scope: "client",
    config: false,
    type: Object,
    default: { x: 10, y: 200 }
  });

  // ===== Notification Settings =====

  game.settings.register(MODULE_ID, "notificationLevel", {
    name: "BOBSNPC.Settings.NotificationLevel.Name",
    hint: "BOBSNPC.Settings.NotificationLevel.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      "minimal": "BOBSNPC.Settings.NotificationLevel.Minimal",
      "normal": "BOBSNPC.Settings.NotificationLevel.Normal",
      "verbose": "BOBSNPC.Settings.NotificationLevel.Verbose"
    },
    default: "normal",
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "toastEnabled", {
    name: "BOBSNPC.Settings.ToastEnabled.Name",
    hint: "BOBSNPC.Settings.ToastEnabled.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "soundEnabled", {
    name: "BOBSNPC.Settings.SoundEnabled.Name",
    hint: "BOBSNPC.Settings.SoundEnabled.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  // ===== Dialogue Settings =====

  game.settings.register(MODULE_ID, "typewriterSpeed", {
    name: "BOBSNPC.Settings.TypewriterSpeed.Name",
    hint: "BOBSNPC.Settings.TypewriterSpeed.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      "slow": "BOBSNPC.Settings.TypewriterSpeed.Slow",
      "normal": "BOBSNPC.Settings.TypewriterSpeed.Normal",
      "fast": "BOBSNPC.Settings.TypewriterSpeed.Fast",
      "instant": "BOBSNPC.Settings.TypewriterSpeed.Instant"
    },
    default: "normal",
    requiresReload: false
  });

  // ===== Appearance Settings =====

  game.settings.register(MODULE_ID, "theme", {
    name: "BOBSNPC.Settings.Theme.Name",
    hint: "BOBSNPC.Settings.Theme.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      "dark": "BOBSNPC.Settings.Theme.Dark",
      "light": "BOBSNPC.Settings.Theme.Light",
      "parchment": "BOBSNPC.Settings.Theme.Parchment",
      "high_contrast": "BOBSNPC.Settings.Theme.HighContrast"
    },
    default: "dark",
    requiresReload: false,
    onChange: (value) => {
      applyTheme(value);
    }
  });

  game.settings.register(MODULE_ID, "fontSize", {
    name: "BOBSNPC.Settings.FontSize.Name",
    hint: "BOBSNPC.Settings.FontSize.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      "small": "BOBSNPC.Settings.FontSize.Small",
      "medium": "BOBSNPC.Settings.FontSize.Medium",
      "large": "BOBSNPC.Settings.FontSize.Large",
      "xlarge": "BOBSNPC.Settings.FontSize.XLarge"
    },
    default: "medium",
    requiresReload: false,
    onChange: (value) => {
      applyFontSize(value);
    }
  });

  game.settings.register(MODULE_ID, "customCss", {
    name: "BOBSNPC.Settings.CustomCSS.Name",
    hint: "BOBSNPC.Settings.CustomCSS.Hint",
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  // ===== Favorites =====

  game.settings.register(MODULE_ID, "favoriteNpcs", {
    name: "Favorite NPCs",
    scope: "client",
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, "favoriteFactions", {
    name: "Favorite Factions",
    scope: "client",
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, "pinnedQuests", {
    name: "Pinned Quests",
    scope: "client",
    config: false,
    type: Array,
    default: []
  });
}

/**
 * Register keybindings
 */
function registerKeybindings() {
  game.keybindings.register(MODULE_ID, "openQuestLog", {
    name: "BOBSNPC.Keybindings.OpenQuestLog",
    hint: "Open the quest log window",
    editable: [
      { key: "KeyJ" }
    ],
    onDown: () => {
      game.bobsnpc?.ui?.openQuestLog();
      return true;
    },
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  game.keybindings.register(MODULE_ID, "openFactions", {
    name: "BOBSNPC.Keybindings.OpenFactions",
    hint: "Open the faction overview window",
    editable: [
      { key: "KeyJ", modifiers: ["Shift"] }
    ],
    onDown: () => {
      game.bobsnpc?.ui?.openFactionOverview();
      return true;
    },
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  game.keybindings.register(MODULE_ID, "toggleTracker", {
    name: "BOBSNPC.Keybindings.ToggleTracker",
    hint: "Toggle the quest tracker visibility",
    editable: [
      { key: "KeyT", modifiers: ["Shift"] }
    ],
    onDown: () => {
      const current = game.settings.get(MODULE_ID, "questTrackerEnabled");
      game.settings.set(MODULE_ID, "questTrackerEnabled", !current);
      return true;
    },
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
}

/**
 * Apply theme to module elements
 * @param {string} theme - Theme name
 */
export function applyTheme(theme) {
  // Remove all theme classes
  document.body.classList.remove(
    "bobsnpc-theme-dark",
    "bobsnpc-theme-light",
    "bobsnpc-theme-parchment",
    "bobsnpc-theme-high-contrast"
  );

  // Add new theme class
  const themeClass = `bobsnpc-theme-${theme.replace("_", "-")}`;
  document.body.classList.add(themeClass);

  console.log(`${MODULE_ID} | Applied theme: ${theme}`);
}

/**
 * Apply font size to module elements
 * @param {string} size - Font size setting
 */
export function applyFontSize(size) {
  // Remove all font size classes
  document.body.classList.remove(
    "bobsnpc-font-small",
    "bobsnpc-font-medium",
    "bobsnpc-font-large",
    "bobsnpc-font-xlarge"
  );

  // Add new font size class
  document.body.classList.add(`bobsnpc-font-${size}`);

  console.log(`${MODULE_ID} | Applied font size: ${size}`);
}

/**
 * Initialize appearance settings on ready
 * Called after settings are loaded
 */
export function initializeAppearance() {
  const theme = game.settings.get(MODULE_ID, "theme");
  const fontSize = game.settings.get(MODULE_ID, "fontSize");

  applyTheme(theme);
  applyFontSize(fontSize);
}

/**
 * Get a setting value with type safety
 * @param {string} key - Setting key
 * @returns {*} Setting value
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
