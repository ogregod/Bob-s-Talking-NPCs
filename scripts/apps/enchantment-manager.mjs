/**
 * Bob's Talking NPCs - Enchantment Manager
 * GM interface for managing the master enchantment list
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";
import {
  createEnchantment,
  createMechanicalEffect,
  EnchantmentItemType,
  EnchantmentRarity,
  FailConsequence,
  ActivationType,
  ActivationCost,
  DurationType,
  MechanicalEffectType,
  DamageType,
  RechargeType,
  DEFAULT_ENCHANTMENTS
} from "../data/enchantment-model.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * D&D 5e abilities
 */
const ABILITIES = [
  { value: "str", label: "Strength" },
  { value: "dex", label: "Dexterity" },
  { value: "con", label: "Constitution" },
  { value: "int", label: "Intelligence" },
  { value: "wis", label: "Wisdom" },
  { value: "cha", label: "Charisma" }
];

/**
 * D&D 5e skills
 */
const SKILLS = [
  { value: "acr", label: "Acrobatics" },
  { value: "ani", label: "Animal Handling" },
  { value: "arc", label: "Arcana" },
  { value: "ath", label: "Athletics" },
  { value: "dec", label: "Deception" },
  { value: "his", label: "History" },
  { value: "ins", label: "Insight" },
  { value: "itm", label: "Intimidation" },
  { value: "inv", label: "Investigation" },
  { value: "med", label: "Medicine" },
  { value: "nat", label: "Nature" },
  { value: "prc", label: "Perception" },
  { value: "prf", label: "Performance" },
  { value: "per", label: "Persuasion" },
  { value: "rel", label: "Religion" },
  { value: "slt", label: "Sleight of Hand" },
  { value: "ste", label: "Stealth" },
  { value: "sur", label: "Survival" }
];

/**
 * Get enchantment handler instance from API
 */
function getEnchantmentHandler() {
  return game.bobsnpc?.handlers?.enchantment;
}

/**
 * Enchantment Manager Application
 * Allows GMs to manage the master list of enchantments
 */
export class EnchantmentManager extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._editingId = null;
    this._pendingMechanicalEffects = []; // Temporary storage for effects being edited
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-enchantment-manager",
    classes: ["bobsnpc", "enchantment-manager"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.Enchantment.Manager",
      icon: "fa-solid fa-wand-sparkles",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 700,
      height: 600
    },
    actions: {
      addEnchantment: EnchantmentManager.#onAddEnchantment,
      editEnchantment: EnchantmentManager.#onEditEnchantment,
      deleteEnchantment: EnchantmentManager.#onDeleteEnchantment,
      saveEnchantment: EnchantmentManager.#onSaveEnchantment,
      cancelEdit: EnchantmentManager.#onCancelEdit,
      resetDefaults: EnchantmentManager.#onResetDefaults,
      exportEnchantments: EnchantmentManager.#onExportEnchantments,
      importEnchantments: EnchantmentManager.#onImportEnchantments,
      addMechanicalEffect: EnchantmentManager.#onAddMechanicalEffect,
      removeMechanicalEffect: EnchantmentManager.#onRemoveMechanicalEffect
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/enchantment-manager.hbs`,
      scrollable: [".enchantment-list"]
    }
  };

  /** @override */
  get title() {
    return localize("Enchantment.Manager");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const handler = getEnchantmentHandler();
    const enchantments = handler?.getAllEnchantments() || [];

    // Prepare enchantments for display
    const preparedEnchantments = enchantments.map(ench => ({
      ...ench,
      typeLabel: localize(`Enchantment.Types.${ench.type}`),
      rarityLabel: localize(`Enchantment.Rarity.${ench.rarity}`),
      effectsList: ench.effects?.join(", ") || "",
      isEditing: ench.id === this._editingId,
      hasFailRate: ench.failRate > 0,
      hasMechanicalEffects: ench.mechanicalEffects?.length > 0
    }));

    // Group by type
    const groupedEnchantments = {};
    for (const ench of preparedEnchantments) {
      if (!groupedEnchantments[ench.type]) {
        groupedEnchantments[ench.type] = {
          type: ench.type,
          typeLabel: ench.typeLabel,
          enchantments: []
        };
      }
      groupedEnchantments[ench.type].enchantments.push(ench);
    }

    // Type options for form
    const typeOptions = Object.entries(EnchantmentItemType).map(([key, value]) => ({
      value,
      label: localize(`Enchantment.Types.${value}`),
      selected: false
    }));

    // Rarity options for form
    const rarityOptions = Object.entries(EnchantmentRarity).map(([key, value]) => ({
      value,
      label: localize(`Enchantment.Rarity.${value}`),
      selected: false
    }));

    // Fail consequence options
    const failConsequenceOptions = Object.entries(FailConsequence).map(([key, value]) => ({
      value,
      label: localize(`Enchantment.FailConsequences.${value}`)
    }));

    // Activation type options
    const activationTypeOptions = Object.entries(ActivationType).map(([key, value]) => ({
      value,
      label: localize(`Enchantment.ActivationTypes.${value}`)
    }));

    // Activation cost options
    const activationCostOptions = Object.entries(ActivationCost).map(([key, value]) => ({
      value,
      label: localize(`Enchantment.ActivationCosts.${value}`)
    }));

    // Duration type options
    const durationTypeOptions = Object.entries(DurationType).map(([key, value]) => ({
      value,
      label: localize(`Enchantment.DurationTypes.${value}`)
    }));

    // Recharge type options
    const rechargeTypeOptions = Object.entries(RechargeType).map(([key, value]) => ({
      value,
      label: localize(`Enchantment.RechargeTypes.${value}`)
    }));

    // Mechanical effect type options
    const effectTypeOptions = Object.entries(MechanicalEffectType).map(([key, value]) => ({
      value,
      label: localize(`Enchantment.EffectTypes.${value}`)
    }));

    // Damage type options
    const damageTypeOptions = Object.entries(DamageType).map(([key, value]) => ({
      value,
      label: localize(`Enchantment.DamageTypes.${value}`)
    }));

    // Ability options
    const abilityOptions = ABILITIES.map(a => ({
      value: a.value,
      label: a.label
    }));

    // Skill options
    const skillOptions = SKILLS.map(s => ({
      value: s.value,
      label: s.label
    }));

    // Get editing enchantment if any
    let editingEnchantment = null;
    let mechanicalEffects = [];
    if (this._editingId) {
      if (this._editingId === "new") {
        editingEnchantment = null;
        mechanicalEffects = this._pendingMechanicalEffects;
      } else {
        editingEnchantment = handler?.getEnchantment(this._editingId);
        // Use pending effects if we have them, otherwise use the enchantment's effects
        mechanicalEffects = this._pendingMechanicalEffects.length > 0
          ? this._pendingMechanicalEffects
          : (editingEnchantment?.mechanicalEffects || []);
      }
    }

    // Prepare mechanical effects with labels and indices
    const preparedMechanicalEffects = mechanicalEffects.map((effect, index) => ({
      ...effect,
      index,
      typeLabel: localize(`Enchantment.EffectTypes.${effect.type}`),
      damageTypeLabel: effect.damageType ? localize(`Enchantment.DamageTypes.${effect.damageType}`) : null,
      abilityLabel: effect.ability ? ABILITIES.find(a => a.value === effect.ability)?.label : null,
      skillLabel: effect.skill ? SKILLS.find(s => s.value === effect.skill)?.label : null,
      showDamageType: ["damage_bonus", "resistance", "immunity"].includes(effect.type),
      showDice: effect.type === "damage_bonus",
      showAbility: ["ability_bonus", "save_bonus"].includes(effect.type),
      showSkill: effect.type === "skill_bonus",
      showValue: !["resistance", "immunity"].includes(effect.type)
    }));

    // Get other enchantments for cursed enchantment selection
    const curseOptions = enchantments
      .filter(e => e.id !== this._editingId)
      .map(e => ({
        value: e.id,
        label: e.name
      }));

    return {
      ...context,
      enchantments: preparedEnchantments,
      groupedEnchantments: Object.values(groupedEnchantments),
      hasEnchantments: preparedEnchantments.length > 0,
      enchantmentCount: preparedEnchantments.length,
      typeOptions,
      rarityOptions,
      failConsequenceOptions,
      activationTypeOptions,
      activationCostOptions,
      durationTypeOptions,
      rechargeTypeOptions,
      effectTypeOptions,
      damageTypeOptions,
      abilityOptions,
      skillOptions,
      curseOptions,
      isEditing: this._editingId !== null,
      editingEnchantment,
      mechanicalEffects: preparedMechanicalEffects,
      hasMechanicalEffects: preparedMechanicalEffects.length > 0,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  // ==================== Actions ====================

  static async #onAddEnchantment(event, target) {
    this._editingId = "new";
    this._pendingMechanicalEffects = [];
    this.render();
  }

  static async #onEditEnchantment(event, target) {
    const enchantmentId = target.dataset.enchantmentId;
    this._editingId = enchantmentId;
    // Load the enchantment's mechanical effects into pending
    const handler = getEnchantmentHandler();
    const enchantment = handler?.getEnchantment(enchantmentId);
    this._pendingMechanicalEffects = enchantment?.mechanicalEffects ? [...enchantment.mechanicalEffects] : [];
    this.render();
  }

  static async #onDeleteEnchantment(event, target) {
    const enchantmentId = target.dataset.enchantmentId;

    const confirmed = await Dialog.confirm({
      title: localize("Enchantment.Delete"),
      content: `<p>${localize("Enchantment.ConfirmDelete")}</p>`
    });

    if (!confirmed) return;

    const handler = getEnchantmentHandler();
    await handler?.deleteEnchantment(enchantmentId);

    ui.notifications.info(localize("Enchantment.Deleted"));
    this.render();
  }

  static async #onSaveEnchantment(event, target) {
    event.preventDefault();

    const form = this.element.querySelector("form.enchantment-form");
    if (!form) return;

    const formData = new FormData(form);

    // Basic info
    const data = {
      name: formData.get("name"),
      description: formData.get("description"),
      type: formData.get("type"),
      rarity: formData.get("rarity"),
      baseCost: parseInt(formData.get("baseCost")) || 100,
      effects: formData.get("effects")?.split("\n").filter(e => e.trim()) || [],
      icon: formData.get("icon") || "fa-wand-sparkles",

      // Fail mechanics
      failRate: parseInt(formData.get("failRate")) || 0,
      failConsequence: formData.get("failConsequence") || "none",
      cursedEnchantmentId: formData.get("cursedEnchantmentId") || null,

      // Activation configuration
      activationType: formData.get("activationType") || "passive",
      activationCost: formData.get("activationCost") || "none",
      charges: parseInt(formData.get("charges")) || 0,
      rechargeType: formData.get("rechargeType") || "dawn",

      // Duration configuration
      durationType: formData.get("durationType") || "permanent",
      durationValue: parseInt(formData.get("durationValue")) || 0,

      // Work duration
      workDurationHours: formData.get("workDurationHours") !== ""
        ? parseFloat(formData.get("workDurationHours"))
        : null,

      // Mechanical effects
      mechanicalEffects: this._pendingMechanicalEffects
    };

    const handler = getEnchantmentHandler();

    try {
      if (this._editingId === "new") {
        await handler.createEnchantment(data);
      } else {
        await handler.updateEnchantment(this._editingId, data);
      }

      ui.notifications.info(localize("Enchantment.Saved"));
      this._editingId = null;
      this._pendingMechanicalEffects = [];
      this.render();
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onCancelEdit(event, target) {
    this._editingId = null;
    this._pendingMechanicalEffects = [];
    this.render();
  }

  static async #onAddMechanicalEffect(event, target) {
    // Show a dialog to configure the new effect
    const effectTypeOptions = Object.entries(MechanicalEffectType)
      .map(([key, value]) => `<option value="${value}">${localize(`Enchantment.EffectTypes.${value}`)}</option>`)
      .join("");

    const damageTypeOptions = Object.entries(DamageType)
      .map(([key, value]) => `<option value="${value}">${localize(`Enchantment.DamageTypes.${value}`)}</option>`)
      .join("");

    const abilityOptions = ABILITIES
      .map(a => `<option value="${a.value}">${a.label}</option>`)
      .join("");

    const skillOptions = SKILLS
      .map(s => `<option value="${s.value}">${s.label}</option>`)
      .join("");

    const content = `
      <form class="bobsnpc-effect-dialog">
        <div class="form-group">
          <label>${localize("Enchantment.Effects.Type")}</label>
          <select name="type" class="effect-type-select">
            ${effectTypeOptions}
          </select>
        </div>
        <div class="form-group value-group">
          <label>${localize("Enchantment.Effects.Value")}</label>
          <input type="number" name="value" value="1" min="0">
        </div>
        <div class="form-group damage-type-group" style="display:none;">
          <label>${localize("Enchantment.Effects.DamageType")}</label>
          <select name="damageType">
            ${damageTypeOptions}
          </select>
        </div>
        <div class="form-group dice-group" style="display:none;">
          <label>${localize("Enchantment.Effects.DiceCount")}</label>
          <input type="number" name="diceCount" value="1" min="1">
          <label>${localize("Enchantment.Effects.DiceSize")}</label>
          <select name="diceSize">
            <option value="4">d4</option>
            <option value="6" selected>d6</option>
            <option value="8">d8</option>
            <option value="10">d10</option>
            <option value="12">d12</option>
          </select>
        </div>
        <div class="form-group ability-group" style="display:none;">
          <label>${localize("Enchantment.Effects.Ability")}</label>
          <select name="ability">
            <option value="all">All</option>
            ${abilityOptions}
          </select>
        </div>
        <div class="form-group skill-group" style="display:none;">
          <label>${localize("Enchantment.Effects.Skill")}</label>
          <select name="skill">
            ${skillOptions}
          </select>
        </div>
      </form>
      <script>
        document.querySelector('.effect-type-select').addEventListener('change', function() {
          const type = this.value;
          const damageGroup = document.querySelector('.damage-type-group');
          const diceGroup = document.querySelector('.dice-group');
          const abilityGroup = document.querySelector('.ability-group');
          const skillGroup = document.querySelector('.skill-group');
          const valueGroup = document.querySelector('.value-group');

          damageGroup.style.display = ['damage_bonus', 'resistance', 'immunity'].includes(type) ? 'block' : 'none';
          diceGroup.style.display = type === 'damage_bonus' ? 'block' : 'none';
          abilityGroup.style.display = ['ability_bonus', 'save_bonus'].includes(type) ? 'block' : 'none';
          skillGroup.style.display = type === 'skill_bonus' ? 'block' : 'none';
          valueGroup.style.display = !['resistance', 'immunity'].includes(type) ? 'block' : 'none';
        });
      </script>
    `;

    const self = this;
    new Dialog({
      title: localize("Enchantment.Effects.Add"),
      content,
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: localize("Common.Add"),
          callback: (html) => {
            const type = html.find('[name="type"]').val();
            const effect = createMechanicalEffect({
              type,
              value: parseInt(html.find('[name="value"]').val()) || 0,
              damageType: html.find('[name="damageType"]').val() || null,
              diceCount: parseInt(html.find('[name="diceCount"]').val()) || 0,
              diceSize: parseInt(html.find('[name="diceSize"]').val()) || 6,
              ability: html.find('[name="ability"]').val() || null,
              skill: html.find('[name="skill"]').val() || null
            });

            self._pendingMechanicalEffects.push(effect);
            self.render();
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: localize("Common.Cancel")
        }
      },
      default: "add",
      render: (html) => {
        // Set up the toggle behavior for showing/hiding fields
        html.find('.effect-type-select').trigger('change');
      }
    }, {
      classes: ["bobsnpc", "effect-dialog"],
      width: 350
    }).render(true);
  }

  static async #onRemoveMechanicalEffect(event, target) {
    const index = parseInt(target.dataset.effectIndex);
    if (isNaN(index) || index < 0 || index >= this._pendingMechanicalEffects.length) return;

    this._pendingMechanicalEffects.splice(index, 1);
    this.render();
  }

  static async #onResetDefaults(event, target) {
    const confirmed = await Dialog.confirm({
      title: "Reset to Defaults",
      content: "<p>This will replace all enchantments with the default set. Continue?</p>"
    });

    if (!confirmed) return;

    const handler = getEnchantmentHandler();
    await handler?.resetToDefaults();

    ui.notifications.info("Enchantments reset to defaults");
    this.render();
  }

  static async #onExportEnchantments(event, target) {
    const handler = getEnchantmentHandler();
    const json = handler?.exportEnchantments();

    if (!json) return;

    // Create download
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bobsnpc-enchantments.json";
    a.click();
    URL.revokeObjectURL(url);

    ui.notifications.info("Enchantments exported");
  }

  static async #onImportEnchantments(event, target) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const text = await file.text();

      const replace = await Dialog.confirm({
        title: "Import Enchantments",
        content: "<p>Replace existing enchantments or add to them?</p>",
        yes: "Replace All",
        no: "Add to Existing"
      });

      const handler = getEnchantmentHandler();
      try {
        const count = await handler?.importEnchantments(text, replace);
        ui.notifications.info(`Imported ${count} enchantments`);
        this.render();
      } catch (error) {
        ui.notifications.error(`Import failed: ${error.message}`);
      }
    };

    input.click();
  }

  // ==================== Static Factory ====================

  /**
   * Open the enchantment manager
   * @returns {EnchantmentManager}
   */
  static async open() {
    // Check if already open
    const existing = Object.values(ui.windows).find(w => w instanceof EnchantmentManager);
    if (existing) {
      existing.bringToTop();
      return existing;
    }

    const manager = new EnchantmentManager();
    await manager.render(true);
    return manager;
  }
}
