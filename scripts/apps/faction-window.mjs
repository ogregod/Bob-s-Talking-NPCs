/**
 * Bob's Talking NPCs - Faction Window
 * Faction reputation and rank display using Foundry V13 ApplicationV2
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";
import { ReputationLevel } from "../data/faction-model.mjs";
import { FactionEditor } from "./faction-editor.mjs";

/** Get faction handler instance from API */
function getFactionHandler() {
  return game.bobsnpc?.handlers?.faction;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Faction Window Application
 * Displays faction standings, ranks, and reputation progress as collapseable cards
 */
export class FactionWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options - Application options
   * @param {string} options.actorUuid - Player actor UUID
   * @param {string} options.factionId - Specific faction to show (optional)
   */
  constructor(options = {}) {
    super(options);

    this.actorUuid = options.actorUuid || game.user.character?.uuid;
    this.initialFactionId = options.factionId || null;

    this._filter = "all"; // all, allied, neutral, hostile
    this._collapsedFactions = new Set(); // IDs of collapsed faction cards
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-factions",
    classes: ["bobsnpc", "faction-window"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.Factions.Title",
      icon: "fa-solid fa-flag",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 860,
      height: 700
    },
    actions: {
      setFilter: FactionWindow.#onSetFilter,
      toggleCollapse: FactionWindow.#onToggleCollapse,
      editFaction: FactionWindow.#onEditFaction,
      createFaction: FactionWindow.#onCreateFaction,
      modifyReputation: FactionWindow.#onModifyReputation
    }
  };

  /** @override */
  static PARTS = {
    header: {
      template: `modules/${MODULE_ID}/templates/factions/sidebar.hbs`
    },
    cards: {
      template: `modules/${MODULE_ID}/templates/factions/details.hbs`,
      scrollable: [".faction-cards-area"]
    }
  };

  /** @override */
  get title() {
    return localize("Factions.Title");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Get all factions
    const handler = getFactionHandler();
    if (!handler) {
      console.warn("bobs-talking-npcs | Faction handler not available");
      return {
        ...context,
        factionCards: [],
        hasFactions: false,
        filter: this._filter,
        counts: { all: 0, allied: 0, neutral: 0, hostile: 0 },
        isGM: game.user.isGM,
        theme: game.settings.get(MODULE_ID, "theme") || "dark"
      };
    }
    const allFactions = handler.getAllFactions?.() || [];

    // Get player's standings
    const playerStandings = await this._getPlayerStandings(allFactions);

    // Apply filter
    const filteredFactions = this._filterFactions(playerStandings);

    // If initial faction specified, expand it, collapse others
    if (this.initialFactionId && this._collapsedFactions.size === 0) {
      for (const f of filteredFactions) {
        if (f.id !== this.initialFactionId) {
          this._collapsedFactions.add(f.id);
        }
      }
      this.initialFactionId = null; // Only do this once
    }

    // Count factions by standing
    const counts = {
      all: playerStandings.length,
      allied: playerStandings.filter(f => f.standing === "allied").length,
      neutral: playerStandings.filter(f => f.standing === "neutral").length,
      hostile: playerStandings.filter(f => f.standing === "hostile").length
    };

    return {
      ...context,
      actorUuid: this.actorUuid,
      filter: this._filter,
      counts,
      factionCards: filteredFactions.map(f => this._prepareFactionCard(f)),
      hasFactions: filteredFactions.length > 0,
      isGM: game.user.isGM,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /**
   * Get player standings with all factions
   * @param {object[]} factions - All factions
   * @returns {object[]}
   * @private
   */
  async _getPlayerStandings(factions) {
    const standings = [];
    const handler = getFactionHandler();
    if (!handler) return standings;

    for (const faction of factions) {
      const reputation = handler.getReputation?.(this.actorUuid, faction.id) || 0;
      const rank = handler.getRank?.(this.actorUuid, faction.id) || null;
      const level = handler.getReputationLevel?.(reputation) || "neutral";

      standings.push({
        ...faction,
        reputation,
        rank,
        level,
        standing: this._getStandingCategory(level)
      });
    }

    return standings;
  }

  /**
   * Get standing category from reputation level
   * @param {string} level - Reputation level
   * @returns {string}
   * @private
   */
  _getStandingCategory(level) {
    switch (level) {
      case ReputationLevel.EXALTED:
      case ReputationLevel.REVERED:
      case ReputationLevel.HONORED:
        return "allied";
      case ReputationLevel.FRIENDLY:
      case ReputationLevel.NEUTRAL:
      case ReputationLevel.UNFRIENDLY:
        return "neutral";
      case ReputationLevel.HOSTILE:
      case ReputationLevel.HATED:
        return "hostile";
      default:
        return "neutral";
    }
  }

  /**
   * Filter factions by standing
   * @param {object[]} factions - Factions with standings
   * @returns {object[]}
   * @private
   */
  _filterFactions(factions) {
    if (this._filter === "all") return factions;
    return factions.filter(f => f.standing === this._filter);
  }

  /**
   * Prepare a full faction card for display (header + expanded body data)
   * @param {object} faction - Faction with standing data
   * @returns {object}
   * @private
   */
  _prepareFactionCard(faction) {
    const progress = this._calculateProgressToNext(faction);
    const ranks = faction.ranks || [];
    const roles = faction.roles || [];
    const relations = this._prepareFactionRelations(faction);
    const members = this._resolveMembers(faction);

    const MAX_MEMBERS = 8;
    const displayMembers = members.slice(0, MAX_MEMBERS);
    const moreMembers = Math.max(0, members.length - MAX_MEMBERS);

    return {
      id: faction.id,
      name: faction.name,
      icon: faction.icon || "fa-flag",
      color: faction.color || "#666666",
      shortDescription: faction.shortDescription || "",
      description: faction.description || "",
      headquarters: faction.headquarters,
      reputation: faction.reputation,
      level: faction.level,
      levelLabel: localize(`ReputationLevel.${faction.level}`),
      standing: faction.standing,
      standingClass: `standing-${faction.standing}`,
      progress,
      nextLevel: this._getNextLevel(faction.level),
      nextLevelLabel: this._getNextLevel(faction.level) ?
        localize(`ReputationLevel.${this._getNextLevel(faction.level)}`) : null,
      reputationNeeded: this._getReputationToNext(faction),
      ranks: ranks.map((r, i) => ({
        ...r,
        index: i,
        isCurrentRank: faction.rank?.id === r.id,
        isAchieved: faction.rank
          ? i <= ranks.findIndex(rank => rank.id === faction.rank?.id)
          : false,
        requirementsMet: faction.reputation >= (r.requiredReputation || 0)
      })),
      currentRank: faction.rank,
      roles: roles.map(r => ({
        ...r,
        isLeader: r.permissions?.isLeader || false
      })),
      members: displayMembers,
      hasMembers: displayMembers.length > 0,
      moreMembers,
      relations,
      hasRelations: relations.length > 0,
      benefits: this._prepareBenefits(faction),
      penalties: this._preparePenalties(faction),
      isCollapsed: this._collapsedFactions.has(faction.id)
    };
  }

  /**
   * Resolve NPC members for a faction with role/rank info
   * @param {object} faction - Faction data
   * @returns {object[]}
   * @private
   */
  _resolveMembers(faction) {
    const members = [];
    const roleMap = new Map((faction.roles || []).map(r => [r.id, r]));
    const rankMap = new Map((faction.ranks || []).map(r => [r.id, r]));

    for (const actor of game.actors || []) {
      const cfg = actor.getFlag(MODULE_ID, "config");
      if (!cfg) continue;
      const fList = Array.isArray(cfg.factions)
        ? cfg.factions
        : Object.values(cfg.factions || {});
      const entry = fList.find(f => f.factionId === faction.id);
      if (!entry) continue;

      const role = entry.roleId ? roleMap.get(entry.roleId) : null;
      const rank = entry.rank ? rankMap.get(entry.rank) : null;

      members.push({
        id: actor.id,
        name: actor.name,
        img: actor.img,
        roleName: role?.name || null,
        roleColor: role?.color || null,
        roleIcon: role?.icon || null,
        rankName: rank?.name || null,
        rankColor: rank?.color || null,
        isLeader: role?.permissions?.isLeader || false
      });
    }

    // Sort: leaders first, then by name
    members.sort((a, b) => {
      if (a.isLeader && !b.isLeader) return -1;
      if (!a.isLeader && b.isLeader) return 1;
      return a.name.localeCompare(b.name);
    });

    return members;
  }

  /**
   * Calculate progress to next reputation level
   * @param {object} faction - Faction with standing
   * @returns {object}
   * @private
   */
  _calculateProgressToNext(faction) {
    const thresholds = {
      [ReputationLevel.HATED]: -1000,
      [ReputationLevel.HOSTILE]: -500,
      [ReputationLevel.UNFRIENDLY]: -100,
      [ReputationLevel.NEUTRAL]: 0,
      [ReputationLevel.FRIENDLY]: 100,
      [ReputationLevel.HONORED]: 500,
      [ReputationLevel.REVERED]: 1000,
      [ReputationLevel.EXALTED]: 2000
    };

    const levels = Object.keys(thresholds);
    const currentIndex = levels.indexOf(faction.level);
    const currentThreshold = thresholds[faction.level];
    const nextLevel = levels[currentIndex + 1];
    const nextThreshold = nextLevel ? thresholds[nextLevel] : currentThreshold + 1000;

    const range = nextThreshold - currentThreshold;
    const current = faction.reputation - currentThreshold;
    const percent = Math.min(100, Math.max(0, (current / range) * 100));

    return {
      percent: Math.round(percent),
      current: faction.reputation,
      min: currentThreshold,
      max: nextThreshold
    };
  }

  /**
   * Get next reputation level
   * @param {string} currentLevel - Current level
   * @returns {string|null}
   * @private
   */
  _getNextLevel(currentLevel) {
    const levels = [
      ReputationLevel.HATED,
      ReputationLevel.HOSTILE,
      ReputationLevel.UNFRIENDLY,
      ReputationLevel.NEUTRAL,
      ReputationLevel.FRIENDLY,
      ReputationLevel.HONORED,
      ReputationLevel.REVERED,
      ReputationLevel.EXALTED
    ];

    const currentIndex = levels.indexOf(currentLevel);
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null;
  }

  /**
   * Get reputation needed for next level
   * @param {object} faction - Faction with standing
   * @returns {number}
   * @private
   */
  _getReputationToNext(faction) {
    const progress = this._calculateProgressToNext(faction);
    return progress.max - faction.reputation;
  }

  /**
   * Prepare faction relations for display
   * @param {object} faction - Faction data
   * @returns {object[]}
   * @private
   */
  _prepareFactionRelations(faction) {
    if (!faction.relations) return [];

    const handler = getFactionHandler();
    const allFactions = handler?.getAllFactions?.() || [];

    return Object.entries(faction.relations).map(([factionId, relation]) => {
      const relatedFaction = allFactions.find(f => f.id === factionId);
      return {
        factionId,
        factionName: relatedFaction?.name || factionId,
        factionIcon: relatedFaction?.icon || "fa-flag",
        factionColor: relatedFaction?.color || "#666666",
        type: relation.type,
        typeLabel: localize(`RelationType.${relation.type}`),
        typeClass: `relation-${relation.type}`,
        effect: relation.reputationEffect
      };
    });
  }

  /**
   * Prepare benefits for current standing
   * @param {object} faction - Faction with standing
   * @returns {object[]}
   * @private
   */
  _prepareBenefits(faction) {
    const benefits = [];

    if (faction.rank?.benefits) {
      benefits.push(...faction.rank.benefits.map(b => ({
        type: "rank",
        description: b,
        icon: "fa-star"
      })));
    }

    const levelBenefits = this._getLevelBenefits(faction.level);
    benefits.push(...levelBenefits);

    return benefits;
  }

  /**
   * Get benefits for reputation level
   * @param {string} level - Reputation level
   * @returns {object[]}
   * @private
   */
  _getLevelBenefits(level) {
    const benefits = {
      [ReputationLevel.FRIENDLY]: [
        { type: "discount", description: localize("Benefits.SmallDiscount"), icon: "fa-percent" }
      ],
      [ReputationLevel.HONORED]: [
        { type: "discount", description: localize("Benefits.MediumDiscount"), icon: "fa-percent" },
        { type: "access", description: localize("Benefits.SpecialQuests"), icon: "fa-scroll" }
      ],
      [ReputationLevel.REVERED]: [
        { type: "discount", description: localize("Benefits.LargeDiscount"), icon: "fa-percent" },
        { type: "access", description: localize("Benefits.ExclusiveItems"), icon: "fa-gem" }
      ],
      [ReputationLevel.EXALTED]: [
        { type: "discount", description: localize("Benefits.MaxDiscount"), icon: "fa-percent" },
        { type: "title", description: localize("Benefits.HonoraryTitle"), icon: "fa-crown" }
      ]
    };

    return benefits[level] || [];
  }

  /**
   * Prepare penalties for current standing
   * @param {object} faction - Faction with standing
   * @returns {object[]}
   * @private
   */
  _preparePenalties(faction) {
    const penalties = [];

    if (faction.standing === "hostile") {
      penalties.push(
        { description: localize("Penalties.RefuseService"), icon: "fa-ban" },
        { description: localize("Penalties.HostileNPCs"), icon: "fa-skull" }
      );
    } else if (faction.level === ReputationLevel.HATED) {
      penalties.push(
        { description: localize("Penalties.AttackOnSight"), icon: "fa-crosshairs" },
        { description: localize("Penalties.Bounty"), icon: "fa-coins" }
      );
    }

    return penalties;
  }

  // ==================== Actions ====================

  static #onSetFilter(event, target) {
    this._filter = target.dataset.filter;
    this._collapsedFactions.clear();
    this.render();
  }

  static #onToggleCollapse(event, target) {
    const factionId = target.dataset.factionId;
    if (!factionId) return;

    if (this._collapsedFactions.has(factionId)) {
      this._collapsedFactions.delete(factionId);
    } else {
      this._collapsedFactions.add(factionId);
    }
    this.render();
  }

  static async #onEditFaction(event, target) {
    if (!game.user.isGM) return;
    const factionId = target.dataset.factionId;
    const handler = getFactionHandler();
    const faction = handler?.getFaction?.(factionId) ?? handler?.getAllFactions?.().find(f => f.id === factionId);
    if (!faction) return;
    const editor = new FactionEditor(faction);
    editor.render(true);
  }

  static async #onCreateFaction(event, target) {
    if (!game.user.isGM) return;
    const editor = new FactionEditor(null);
    editor.render(true);
  }

  static async #onModifyReputation(event, target) {
    if (!game.user.isGM) return;
    const factionId = target.dataset.factionId;
    const handler = getFactionHandler();
    const faction = handler?.getFaction?.(factionId) ?? handler?.getAllFactions?.().find(f => f.id === factionId);
    if (!faction) return;

    const currentRep = handler?.getReputation?.(this.actorUuid, factionId) || 0;

    const content = `
      <div class="form-group">
        <label>Reputation Change (positive or negative)</label>
        <input type="number" name="repChange" value="0" style="width: 100%; text-align: center;" />
        <p class="hint">Current: ${currentRep} rep — ${faction.name}</p>
      </div>
    `;

    const result = await Dialog.prompt({
      title: `Modify Reputation — ${faction.name}`,
      content,
      label: "Apply",
      callback: (html) => {
        const val = parseInt(html.find("[name='repChange']").val()) || 0;
        return val;
      }
    });

    if (result !== null && result !== undefined && handler?.modifyReputation) {
      await handler.modifyReputation(this.actorUuid, factionId, result);
      this.render();
    }
  }

  // ==================== Hooks ====================

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    // Register for reputation updates
    this._hookId = Hooks.on(`${MODULE_ID}.reputationChanged`, () => this.render());
  }

  /** @override */
  async _onClose(options) {
    await super._onClose(options);

    if (this._hookId) {
      Hooks.off(`${MODULE_ID}.reputationChanged`, this._hookId);
    }
  }

  // ==================== Static Factory ====================

  /**
   * Open faction window
   * @param {string} actorUuid - Actor UUID (optional)
   * @param {string} factionId - Specific faction to show (optional)
   * @returns {FactionWindow}
   */
  static async open(actorUuid = null, factionId = null) {
    if (!actorUuid && game.user.character) {
      actorUuid = game.user.character.uuid;
    }

    const window = new FactionWindow({ actorUuid, factionId });
    await window.render(true);
    return window;
  }
}
