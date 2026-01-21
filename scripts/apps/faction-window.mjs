/**
 * Bob's Talking NPCs - Faction Window
 * Faction reputation and rank display using Foundry V13 ApplicationV2
 */

import { MODULE_ID } from "../module.mjs";
import { localize } from "../utils/helpers.mjs";
import { factionHandler } from "../handlers/faction-handler.mjs";
import { ReputationLevel } from "../data/faction-model.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Faction Window Application
 * Displays faction standings, ranks, and reputation progress
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

    this._selectedFactionId = options.factionId || null;
    this._filter = "all"; // all, allied, neutral, hostile
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
      width: 750,
      height: 600
    },
    actions: {
      setFilter: FactionWindow.#onSetFilter,
      selectFaction: FactionWindow.#onSelectFaction,
      viewRanks: FactionWindow.#onViewRanks,
      viewRelations: FactionWindow.#onViewRelations,
      viewMembers: FactionWindow.#onViewMembers
    }
  };

  /** @override */
  static PARTS = {
    sidebar: {
      template: `modules/${MODULE_ID}/templates/factions/sidebar.hbs`,
      scrollable: [".faction-list"]
    },
    details: {
      template: `modules/${MODULE_ID}/templates/factions/details.hbs`,
      scrollable: [".faction-details-content"]
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
    const allFactions = factionHandler.getAllFactions();

    // Get player's standings
    const playerStandings = await this._getPlayerStandings(allFactions);

    // Apply filter
    const filteredFactions = this._filterFactions(playerStandings);

    // Select first faction if none selected
    if (!this._selectedFactionId && filteredFactions.length > 0) {
      this._selectedFactionId = filteredFactions[0].id;
    }

    // Get selected faction details
    const selectedFaction = this._selectedFactionId ?
      playerStandings.find(f => f.id === this._selectedFactionId) : null;

    // Count factions by standing
    const counts = {
      all: playerStandings.length,
      allied: playerStandings.filter(f => f.standing === "allied" || f.standing === "exalted").length,
      neutral: playerStandings.filter(f => f.standing === "neutral").length,
      hostile: playerStandings.filter(f => f.standing === "hostile" || f.standing === "hated").length
    };

    return {
      ...context,
      actorUuid: this.actorUuid,
      filter: this._filter,
      counts,
      factions: filteredFactions.map(f => this._prepareFactionListItem(f)),
      selectedFaction: selectedFaction ? this._prepareFactionDetails(selectedFaction) : null,
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

    for (const faction of factions) {
      const reputation = await factionHandler.getReputation(this.actorUuid, faction.id);
      const rank = await factionHandler.getRank(this.actorUuid, faction.id);
      const level = factionHandler.getReputationLevel(reputation);

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
   * Prepare faction for list display
   * @param {object} faction - Faction with standing
   * @returns {object}
   * @private
   */
  _prepareFactionListItem(faction) {
    const progress = this._calculateProgressToNext(faction);

    return {
      id: faction.id,
      name: faction.name,
      icon: faction.icon || "fa-flag",
      color: faction.color || "#666666",
      reputation: faction.reputation,
      level: faction.level,
      levelLabel: localize(`ReputationLevel.${faction.level}`),
      standing: faction.standing,
      standingClass: `standing-${faction.standing}`,
      rank: faction.rank?.name || null,
      rankIcon: faction.rank?.icon,
      progress,
      isSelected: faction.id === this._selectedFactionId
    };
  }

  /**
   * Prepare faction details for display
   * @param {object} faction - Faction with standing
   * @returns {object}
   * @private
   */
  _prepareFactionDetails(faction) {
    const progress = this._calculateProgressToNext(faction);
    const ranks = faction.ranks || [];
    const relations = this._prepareFactionRelations(faction);

    return {
      ...faction,
      levelLabel: localize(`ReputationLevel.${faction.level}`),
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
        isAchieved: i <= ranks.findIndex(rank => rank.id === faction.rank?.id),
        requirementsMet: faction.reputation >= (r.requiredReputation || 0)
      })),
      currentRank: faction.rank,
      relations,
      hasRelations: relations.length > 0,
      description: faction.description,
      headquarters: faction.headquarters,
      leader: faction.leader,
      benefits: this._prepareBenefits(faction),
      penalties: this._preparePenalties(faction)
    };
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

    const allFactions = factionHandler.getAllFactions();

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

    // Add rank benefits
    if (faction.rank?.benefits) {
      benefits.push(...faction.rank.benefits.map(b => ({
        type: "rank",
        description: b,
        icon: "fa-star"
      })));
    }

    // Add reputation level benefits
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
    this._selectedFactionId = null;
    this.render();
  }

  static #onSelectFaction(event, target) {
    this._selectedFactionId = target.dataset.factionId;
    this.render();
  }

  static #onViewRanks(event, target) {
    // Scroll to ranks section
    const ranksSection = this.element.querySelector(".faction-ranks");
    if (ranksSection) {
      ranksSection.scrollIntoView({ behavior: "smooth" });
    }
  }

  static #onViewRelations(event, target) {
    // Scroll to relations section
    const relationsSection = this.element.querySelector(".faction-relations");
    if (relationsSection) {
      relationsSection.scrollIntoView({ behavior: "smooth" });
    }
  }

  static async #onViewMembers(event, target) {
    const factionId = target.dataset.factionId;

    // Get NPCs belonging to this faction
    const npcs = await factionHandler.getFactionNPCs(factionId);

    // Show in a dialog
    const content = await renderTemplate(
      `modules/${MODULE_ID}/templates/factions/members-dialog.hbs`,
      { npcs, factionId }
    );

    new Dialog({
      title: localize("Factions.Members"),
      content,
      buttons: { close: { label: localize("Close") } }
    }).render(true);
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
