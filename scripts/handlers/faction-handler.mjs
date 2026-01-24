/**
 * Bob's Talking NPCs - Faction Handler
 * Manages factions, reputation, ranks, and faction relationships
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";
import {
  createFaction,
  createRank,
  createPlayerStanding,
  createFactionRelationship,
  FactionRelationType,
  DefaultRanks,
  getRankForReputation,
  getNextRank,
  checkRankRequirements,
  calculateReputationChanges,
  getStandingDescription,
  validateFaction,
  createDefaultRanks
} from "../data/faction-model.mjs";
import { generateId, getFlag, setFlag, localize } from "../utils/helpers.mjs";

/**
 * Storage keys
 */
const STORAGE_KEYS = {
  FACTIONS: "factions",
  PLAYER_STANDINGS: "factionStandings"
};

/**
 * Faction Handler Class
 * Singleton managing all faction operations
 */
export class FactionHandler {
  constructor() {
    this._initialized = false;
    this._factionCache = new Map();
  }

  /**
   * Initialize the faction handler
   */
  async initialize() {
    if (this._initialized) return;

    await this._loadFactions();

    this._initialized = true;
    console.log(`${MODULE_ID} | Faction Handler initialized`);
  }

  // ==================== FACTION STORAGE ====================

  /**
   * Load factions from world storage
   * @private
   */
  async _loadFactions() {
    const worldData = game.settings.get(MODULE_ID, "worldData") || {};
    const factions = worldData.factions || {};

    this._factionCache.clear();
    for (const [id, factionData] of Object.entries(factions)) {
      this._factionCache.set(id, createFaction(factionData));
    }
  }

  /**
   * Save factions to world storage
   * @private
   */
  async _saveFactions() {
    const worldData = game.settings.get(MODULE_ID, "worldData") || {};
    worldData.factions = Object.fromEntries(this._factionCache);
    await game.settings.set(MODULE_ID, "worldData", worldData);
  }

  /**
   * Get a faction by ID
   * @param {string} factionId - Faction ID
   * @returns {object|null}
   */
  getFaction(factionId) {
    return this._factionCache.get(factionId) || null;
  }

  /**
   * Get all factions
   * @returns {object[]}
   */
  getAllFactions() {
    return Array.from(this._factionCache.values());
  }

  /**
   * Get factions an NPC belongs to
   * @param {string} npcActorUuid - NPC actor UUID
   * @returns {object[]}
   */
  getFactionsForNPC(npcActorUuid) {
    return this.getAllFactions().filter(f => f.members.includes(npcActorUuid));
  }

  // ==================== FACTION CRUD ====================

  /**
   * Create a new faction
   * @param {object} data - Faction data
   * @returns {object}
   */
  async createFaction(data) {
    const faction = createFaction({
      ...data,
      id: data.id || generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    const validation = validateFaction(faction);
    if (!validation.valid) {
      console.warn(`${MODULE_ID} | Faction validation errors:`, validation.errors);
    }

    this._factionCache.set(faction.id, faction);
    await this._saveFactions();

    Hooks.callAll("bobsNPCFactionCreated", faction);

    return faction;
  }

  /**
   * Update a faction
   * @param {string} factionId - Faction ID
   * @param {object} updates - Updates to apply
   * @returns {object|null}
   */
  async updateFaction(factionId, updates) {
    const faction = this.getFaction(factionId);
    if (!faction) return null;

    const updatedFaction = {
      ...faction,
      ...updates,
      id: factionId,
      updatedAt: Date.now()
    };

    this._factionCache.set(factionId, updatedFaction);
    await this._saveFactions();

    Hooks.callAll("bobsNPCFactionUpdated", updatedFaction);

    return updatedFaction;
  }

  /**
   * Delete a faction
   * @param {string} factionId - Faction ID
   * @returns {boolean}
   */
  async deleteFaction(factionId) {
    const faction = this.getFaction(factionId);
    if (!faction) return false;

    this._factionCache.delete(factionId);
    await this._saveFactions();

    // Clean up player standings
    await this._removeStandingsForFaction(factionId);

    // Update relationship references in other factions
    for (const otherFaction of this.getAllFactions()) {
      if (otherFaction.factionRelationships.some(r => r.factionId === factionId)) {
        await this.updateFaction(otherFaction.id, {
          factionRelationships: otherFaction.factionRelationships.filter(r => r.factionId !== factionId)
        });
      }
    }

    Hooks.callAll("bobsNPCFactionDeleted", factionId);

    return true;
  }

  // ==================== MEMBERSHIP ====================

  /**
   * Add an NPC to a faction
   * @param {string} factionId - Faction ID
   * @param {string} npcActorUuid - NPC actor UUID
   * @returns {boolean}
   */
  async addMember(factionId, npcActorUuid) {
    const faction = this.getFaction(factionId);
    if (!faction) return false;

    if (!faction.members.includes(npcActorUuid)) {
      await this.updateFaction(factionId, {
        members: [...faction.members, npcActorUuid]
      });
    }

    return true;
  }

  /**
   * Remove an NPC from a faction
   * @param {string} factionId - Faction ID
   * @param {string} npcActorUuid - NPC actor UUID
   * @returns {boolean}
   */
  async removeMember(factionId, npcActorUuid) {
    const faction = this.getFaction(factionId);
    if (!faction) return false;

    await this.updateFaction(factionId, {
      members: faction.members.filter(uuid => uuid !== npcActorUuid)
    });

    return true;
  }

  // ==================== PLAYER STANDINGS ====================

  /**
   * Get player standing with a faction
   * @param {string} actorUuid - Player actor UUID
   * @param {string} factionId - Faction ID
   * @returns {object|null}
   */
  async getStanding(actorUuid, factionId) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return null;

    const standings = getFlag(actor, STORAGE_KEYS.PLAYER_STANDINGS) || {};
    const standing = standings[factionId];

    if (!standing) {
      // Return default standing
      const faction = this.getFaction(factionId);
      if (!faction) return null;

      return createPlayerStanding({
        reputation: faction.reputation.startingValue,
        rank: this._getLowestRankId(faction)
      });
    }

    return createPlayerStanding(standing);
  }

  /**
   * Get all standings for a player
   * @param {string} actorUuid - Player actor UUID
   * @returns {object} {factionId: standing}
   */
  async getAllStandings(actorUuid) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return {};

    const standings = getFlag(actor, STORAGE_KEYS.PLAYER_STANDINGS) || {};
    const result = {};

    for (const [factionId, standing] of Object.entries(standings)) {
      result[factionId] = createPlayerStanding(standing);
    }

    return result;
  }

  /**
   * Set player standing with a faction
   * @param {string} actorUuid - Player actor UUID
   * @param {string} factionId - Faction ID
   * @param {object} standing - Standing data
   * @private
   */
  async _setStanding(actorUuid, factionId, standing) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return;

    const standings = getFlag(actor, STORAGE_KEYS.PLAYER_STANDINGS) || {};
    standings[factionId] = standing;
    await setFlag(actor, STORAGE_KEYS.PLAYER_STANDINGS, standings);
  }

  /**
   * Remove standings for a deleted faction
   * @param {string} factionId - Faction ID
   * @private
   */
  async _removeStandingsForFaction(factionId) {
    for (const actor of game.actors.filter(a => a.hasPlayerOwner)) {
      const standings = getFlag(actor, STORAGE_KEYS.PLAYER_STANDINGS) || {};
      if (standings[factionId]) {
        delete standings[factionId];
        await setFlag(actor, STORAGE_KEYS.PLAYER_STANDINGS, standings);
      }
    }
  }

  // ==================== REPUTATION ====================

  /**
   * Modify reputation with a faction
   * @param {string} actorUuid - Player actor UUID
   * @param {string} factionId - Faction ID
   * @param {number} amount - Amount to change
   * @param {object} options - Options {reason, propagate}
   * @returns {object} {standing, rankChanged, newRank, changes}
   */
  async modifyReputation(actorUuid, factionId, amount, options = {}) {
    const faction = this.getFaction(factionId);
    if (!faction) return null;

    const currentStanding = await this.getStanding(actorUuid, factionId) ||
      createPlayerStanding({ reputation: faction.reputation.startingValue });

    const previousRep = currentStanding.reputation;
    const previousRank = currentStanding.rank;

    // Calculate new reputation (clamped to bounds)
    let newRep = previousRep + amount;
    newRep = Math.max(faction.reputation.min, Math.min(faction.reputation.max, newRep));

    // Get new rank
    const newRankData = getRankForReputation(faction, newRep);
    const newRank = newRankData?.id || previousRank;
    const rankChanged = newRank !== previousRank;

    // Update standing
    const updatedStanding = {
      ...currentStanding,
      reputation: newRep,
      rank: newRank,
      lastActivity: Date.now(),
      history: [
        ...currentStanding.history,
        {
          date: Date.now(),
          change: amount,
          reason: options.reason || "Unknown",
          previousRep,
          newRep
        }
      ]
    };

    await this._setStanding(actorUuid, factionId, updatedStanding);

    // Handle rank change
    if (rankChanged) {
      await this._handleRankChange(actorUuid, faction, previousRank, newRank, newRankData);
    }

    // Calculate and apply ripple effects to related factions
    const changes = [{ factionId, amount, newRep }];

    if (options.propagate !== false) {
      const rippleChanges = calculateReputationChanges(faction, amount, this.getAllFactions());

      for (const rippleChange of rippleChanges) {
        if (rippleChange.factionId !== factionId && rippleChange.amount !== 0) {
          const rippleResult = await this.modifyReputation(
            actorUuid,
            rippleChange.factionId,
            rippleChange.amount,
            { reason: `Ripple from ${faction.name}`, propagate: false }
          );
          if (rippleResult) {
            changes.push({
              factionId: rippleChange.factionId,
              amount: rippleChange.amount,
              newRep: rippleResult.standing.reputation
            });
          }
        }
      }
    }

    // Emit socket event
    this._emitSocket("reputationChanged", {
      actorUuid,
      factionId,
      amount,
      newRep,
      rankChanged,
      newRank
    });

    Hooks.callAll("bobsNPCReputationChanged", actorUuid, factionId, amount, updatedStanding);

    return {
      standing: updatedStanding,
      rankChanged,
      newRank: rankChanged ? newRankData : null,
      previousRank: rankChanged ? previousRank : null,
      changes
    };
  }

  /**
   * Set reputation to a specific value
   * @param {string} actorUuid - Player actor UUID
   * @param {string} factionId - Faction ID
   * @param {number} value - New reputation value
   * @param {string} reason - Reason for change
   */
  async setReputation(actorUuid, factionId, value, reason = "Set by GM") {
    const currentStanding = await this.getStanding(actorUuid, factionId);
    const currentRep = currentStanding?.reputation || 0;
    const amount = value - currentRep;

    return this.modifyReputation(actorUuid, factionId, amount, { reason, propagate: false });
  }

  /**
   * Handle rank change events
   * @param {string} actorUuid - Player actor UUID
   * @param {object} faction - Faction data
   * @param {string} previousRankId - Previous rank ID
   * @param {string} newRankId - New rank ID
   * @param {object} newRankData - New rank data
   * @private
   */
  async _handleRankChange(actorUuid, faction, previousRankId, newRankId, newRankData) {
    const actor = await fromUuid(actorUuid);
    if (!actor) return;

    const previousRank = faction.ranks.find(r => r.id === previousRankId);
    const isPromotion = (newRankData?.order || 0) > (previousRank?.order || 0);

    // Apply one-time rewards for promotions
    if (isPromotion && newRankData?.benefits?.rewards?.length > 0) {
      for (const reward of newRankData.benefits.rewards) {
        switch (reward.type) {
          case "gold":
            const currentGold = actor.system?.currency?.gp || 0;
            await actor.update({ "system.currency.gp": currentGold + reward.amount });
            break;
          case "item":
            const item = await fromUuid(reward.itemUuid);
            if (item) {
              await actor.createEmbeddedDocuments("Item", [item.toObject()]);
            }
            break;
          case "xp":
            const currentXP = actor.system?.details?.xp?.value || 0;
            await actor.update({ "system.details.xp.value": currentXP + reward.amount });
            break;
        }
      }
    }

    // Apply titles
    if (newRankData?.benefits?.titles?.length > 0) {
      const currentTitles = getFlag(actor, "titles") || [];
      const newTitles = [...new Set([...currentTitles, ...newRankData.benefits.titles])];
      await setFlag(actor, "titles", newTitles);
    }

    // Notify
    this._notifyRankChange(actor, faction, previousRank, newRankData, isPromotion);

    Hooks.callAll("bobsNPCRankChanged", actorUuid, faction.id, previousRankId, newRankId, isPromotion);
  }

  /**
   * Notify player of rank change
   * @private
   */
  _notifyRankChange(actor, faction, previousRank, newRank, isPromotion) {
    const message = isPromotion
      ? `${localize("BOBSNPC.RankPromoted")}: ${newRank.name} (${faction.name})`
      : `${localize("BOBSNPC.RankDemoted")}: ${newRank.name} (${faction.name})`;

    ui.notifications.info(message);

    // Chat message
    const content = `
      <div class="bobsnpc-rank-change ${isPromotion ? "promotion" : "demotion"}">
        <h3>${faction.name}</h3>
        <p>${actor.name} ${isPromotion ? localize("BOBSNPC.HasBeenPromoted") : localize("BOBSNPC.HasBeenDemoted")}</p>
        <p><strong>${previousRank?.name || "None"}</strong> → <strong>${newRank.name}</strong></p>
      </div>
    `;

    ChatMessage.create({
      content,
      speaker: { alias: faction.name }
    });
  }

  // ==================== RANKS ====================

  /**
   * Get current rank for player in faction
   * @param {string} actorUuid - Player actor UUID
   * @param {string} factionId - Faction ID
   * @returns {object|null} Rank data
   */
  async getRank(actorUuid, factionId) {
    const standing = await this.getStanding(actorUuid, factionId);
    if (!standing) return null;

    const faction = this.getFaction(factionId);
    if (!faction) return null;

    return faction.ranks.find(r => r.id === standing.rank) || null;
  }

  /**
   * Get next rank for player to achieve
   * @param {string} actorUuid - Player actor UUID
   * @param {string} factionId - Faction ID
   * @returns {object|null} {rank, requirements, progress}
   */
  async getNextRankInfo(actorUuid, factionId) {
    const standing = await this.getStanding(actorUuid, factionId);
    if (!standing) return null;

    const faction = this.getFaction(factionId);
    if (!faction) return null;

    const nextRank = getNextRank(faction, standing.rank);
    if (!nextRank) return null;

    const requirements = checkRankRequirements(nextRank, standing, {});

    // Calculate progress percentage
    const currentRank = faction.ranks.find(r => r.id === standing.rank);
    const currentThreshold = currentRank?.requirements?.reputation || 0;
    const nextThreshold = nextRank.requirements?.reputation || 0;
    const range = nextThreshold - currentThreshold;
    const progress = range > 0
      ? Math.min(100, Math.round(((standing.reputation - currentThreshold) / range) * 100))
      : 0;

    return {
      rank: nextRank,
      requirements: requirements.reasons,
      met: requirements.met,
      progress
    };
  }

  /**
   * Get the lowest rank ID for a faction
   * @param {object} faction - Faction data
   * @returns {string|null}
   * @private
   */
  _getLowestRankId(faction) {
    const sortedRanks = [...faction.ranks].sort((a, b) => a.order - b.order);
    return sortedRanks[0]?.id || null;
  }

  /**
   * Add a rank to a faction
   * @param {string} factionId - Faction ID
   * @param {object} rankData - Rank data
   * @returns {object|null} Updated faction
   */
  async addRank(factionId, rankData) {
    const faction = this.getFaction(factionId);
    if (!faction) return null;

    const rank = createRank(rankData);
    const updatedRanks = [...faction.ranks, rank].sort((a, b) => a.order - b.order);

    return this.updateFaction(factionId, { ranks: updatedRanks });
  }

  /**
   * Update a rank
   * @param {string} factionId - Faction ID
   * @param {string} rankId - Rank ID
   * @param {object} updates - Updates to apply
   * @returns {object|null}
   */
  async updateRank(factionId, rankId, updates) {
    const faction = this.getFaction(factionId);
    if (!faction) return null;

    const rankIndex = faction.ranks.findIndex(r => r.id === rankId);
    if (rankIndex === -1) return null;

    const updatedRanks = [...faction.ranks];
    updatedRanks[rankIndex] = { ...updatedRanks[rankIndex], ...updates };

    return this.updateFaction(factionId, { ranks: updatedRanks });
  }

  /**
   * Remove a rank from a faction
   * @param {string} factionId - Faction ID
   * @param {string} rankId - Rank ID
   * @returns {object|null}
   */
  async removeRank(factionId, rankId) {
    const faction = this.getFaction(factionId);
    if (!faction) return null;

    if (faction.ranks.length <= 1) {
      console.warn(`${MODULE_ID} | Cannot remove last rank from faction`);
      return null;
    }

    const updatedRanks = faction.ranks.filter(r => r.id !== rankId);
    return this.updateFaction(factionId, { ranks: updatedRanks });
  }

  // ==================== FACTION RELATIONSHIPS ====================

  /**
   * Set relationship between two factions
   * @param {string} factionId - Primary faction ID
   * @param {string} targetFactionId - Target faction ID
   * @param {string} type - Relationship type
   * @param {number} reputationEffect - Reputation multiplier
   * @returns {boolean}
   */
  async setFactionRelationship(factionId, targetFactionId, type, reputationEffect = 0) {
    const faction = this.getFaction(factionId);
    if (!faction) return false;

    const existingIndex = faction.factionRelationships.findIndex(
      r => r.factionId === targetFactionId
    );

    const relationship = createFactionRelationship({
      factionId: targetFactionId,
      type,
      reputationEffect
    });

    let updatedRelationships;
    if (existingIndex >= 0) {
      updatedRelationships = [...faction.factionRelationships];
      updatedRelationships[existingIndex] = relationship;
    } else {
      updatedRelationships = [...faction.factionRelationships, relationship];
    }

    await this.updateFaction(factionId, { factionRelationships: updatedRelationships });
    return true;
  }

  /**
   * Get relationship between two factions
   * @param {string} factionId - Primary faction ID
   * @param {string} targetFactionId - Target faction ID
   * @returns {object|null}
   */
  getFactionRelationship(factionId, targetFactionId) {
    const faction = this.getFaction(factionId);
    if (!faction) return null;

    return faction.factionRelationships.find(r => r.factionId === targetFactionId) ||
      createFactionRelationship({ factionId: targetFactionId });
  }

  /**
   * Get all allied factions
   * @param {string} factionId - Faction ID
   * @returns {object[]}
   */
  getAlliedFactions(factionId) {
    const faction = this.getFaction(factionId);
    if (!faction) return [];

    return faction.factionRelationships
      .filter(r => r.type === FactionRelationType.ALLIED)
      .map(r => this.getFaction(r.factionId))
      .filter(f => f !== null);
  }

  /**
   * Get all enemy factions
   * @param {string} factionId - Faction ID
   * @returns {object[]}
   */
  getEnemyFactions(factionId) {
    const faction = this.getFaction(factionId);
    if (!faction) return [];

    return faction.factionRelationships
      .filter(r => r.type === FactionRelationType.ENEMY)
      .map(r => this.getFaction(r.factionId))
      .filter(f => f !== null);
  }

  // ==================== HOSTILE BEHAVIOR ====================

  /**
   * Check if faction is hostile to player
   * @param {string} actorUuid - Player actor UUID
   * @param {string} factionId - Faction ID
   * @returns {boolean}
   */
  async isHostile(actorUuid, factionId) {
    const faction = this.getFaction(factionId);
    if (!faction) return false;

    const standing = await this.getStanding(actorUuid, factionId);
    if (!standing) return false;

    return standing.reputation <= faction.hostileThreshold;
  }

  /**
   * Check if faction attacks player on sight
   * @param {string} actorUuid - Player actor UUID
   * @param {string} factionId - Faction ID
   * @returns {boolean}
   */
  async attacksOnSight(actorUuid, factionId) {
    const faction = this.getFaction(factionId);
    if (!faction || !faction.attackOnSight) return false;

    return this.isHostile(actorUuid, factionId);
  }

  // ==================== REPUTATION DECAY ====================

  /**
   * Apply reputation decay for all factions
   */
  async applyReputationDecay() {
    const now = Date.now();

    for (const faction of this.getAllFactions()) {
      if (!faction.reputation.decay.enabled) continue;

      const intervalMs = this._getDecayIntervalMs(faction.reputation.decay.interval);

      // Check each player
      for (const actor of game.actors.filter(a => a.hasPlayerOwner)) {
        const standing = await this.getStanding(actor.uuid, faction.id);
        if (!standing) continue;

        const lastActivity = standing.lastActivity || standing.joinedAt || now;
        const elapsed = now - lastActivity;

        if (elapsed >= intervalMs) {
          const intervals = Math.floor(elapsed / intervalMs);
          const decayAmount = faction.reputation.decay.amount * intervals;

          if (decayAmount > 0) {
            await this.modifyReputation(
              actor.uuid,
              faction.id,
              -decayAmount,
              { reason: "Reputation decay", propagate: false }
            );
          }
        }
      }
    }
  }

  /**
   * Get decay interval in milliseconds
   * @param {string} interval - Interval type
   * @returns {number}
   * @private
   */
  _getDecayIntervalMs(interval) {
    switch (interval) {
      case "day": return 24 * 60 * 60 * 1000;
      case "week": return 7 * 24 * 60 * 60 * 1000;
      case "month": return 30 * 24 * 60 * 60 * 1000;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  }

  // ==================== QUESTS ====================

  /**
   * Get quests available from a faction for a player
   * @param {string} actorUuid - Player actor UUID
   * @param {string} factionId - Faction ID
   * @returns {object[]}
   */
  async getAvailableQuests(actorUuid, factionId) {
    const faction = this.getFaction(factionId);
    if (!faction) return [];

    const standing = await this.getStanding(actorUuid, factionId);
    if (!standing) return [];

    const rank = faction.ranks.find(r => r.id === standing.rank);
    if (!rank) return [];

    const accessibleRankTags = rank.benefits?.questAccess || [];

    // Get quests from quest handler
    const allQuests = game.bobsnpc?.quests?.getAllQuests() || [];

    return allQuests.filter(quest => {
      // Check if quest belongs to this faction
      if (!faction.questIds.includes(quest.id)) return false;

      // Check if quest is available
      if (quest.status !== "available") return false;

      // Check rank access
      if (quest.rank && !accessibleRankTags.includes(quest.rank)) return false;

      return true;
    });
  }

  /**
   * Record quest completion for faction
   * @param {string} actorUuid - Player actor UUID
   * @param {string} factionId - Faction ID
   */
  async recordQuestCompletion(actorUuid, factionId) {
    const standing = await this.getStanding(actorUuid, factionId);
    if (!standing) return;

    const updatedStanding = {
      ...standing,
      questsCompleted: (standing.questsCompleted || 0) + 1,
      lastActivity: Date.now()
    };

    await this._setStanding(actorUuid, factionId, updatedStanding);
  }

  // ==================== DISCOUNTS ====================

  /**
   * Get price discount for player from faction
   * @param {string} actorUuid - Player actor UUID
   * @param {string} factionId - Faction ID
   * @returns {number} Discount percentage (0-1)
   */
  async getPriceDiscount(actorUuid, factionId) {
    const rank = await this.getRank(actorUuid, factionId);
    return rank?.benefits?.priceDiscount || 0;
  }

  // ==================== UTILITIES ====================

  /**
   * Get standing description for player
   * @param {string} actorUuid - Player actor UUID
   * @param {string} factionId - Faction ID
   * @returns {string}
   */
  async getStandingDescriptionForPlayer(actorUuid, factionId) {
    const standing = await this.getStanding(actorUuid, factionId);
    if (!standing) return "unknown";

    return getStandingDescription(standing.reputation);
  }

  /**
   * Get faction summary for UI
   * @param {string} actorUuid - Player actor UUID
   * @param {string} factionId - Faction ID
   * @returns {object|null}
   */
  async getFactionSummary(actorUuid, factionId) {
    const faction = this.getFaction(factionId);
    if (!faction) return null;

    const standing = await this.getStanding(actorUuid, factionId);
    const rank = await this.getRank(actorUuid, factionId);
    const nextRankInfo = await this.getNextRankInfo(actorUuid, factionId);

    return {
      faction,
      standing,
      rank,
      nextRank: nextRankInfo?.rank || null,
      progress: nextRankInfo?.progress || 0,
      standingDescription: getStandingDescription(standing?.reputation || 0),
      isHostile: await this.isHostile(actorUuid, factionId),
      discount: rank?.benefits?.priceDiscount || 0
    };
  }

  // ==================== SOCKET ====================

  /**
   * Emit socket event
   * @param {string} event - Event name
   * @param {object} data - Event data
   * @private
   */
  _emitSocket(event, data) {
    game.socket?.emit(`module.${MODULE_ID}`, {
      type: `faction.${event}`,
      data
    });
  }
}

// Singleton instance
export const factionHandler = new FactionHandler();
