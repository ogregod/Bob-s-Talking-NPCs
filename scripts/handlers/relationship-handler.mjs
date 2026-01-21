/**
 * Bob's Talking NPCs - Relationship Handler
 * Manages individual NPC-player relationships
 */

import { MODULE_ID } from "../module.mjs";
import {
  createPlayerRelationship,
  createNPCRelationshipConfig,
  createRelationshipEvent,
  RelationshipTier,
  RelationshipEventType,
  GiftPreference,
  getTierForValue,
  getTierDisplay,
  modifyRelationship,
  processGift,
  applyDecay,
  getProgressToNextTier,
  validateRelationshipConfig
} from "../data/relationship-model.mjs";
import { generateId, getFlag, setFlag, localize } from "../utils/helpers.mjs";

/**
 * Storage keys
 */
const STORAGE_KEYS = {
  NPC_CONFIG: "relationshipConfig",
  PLAYER_RELATIONSHIPS: "relationships"
};

/**
 * Relationship Handler Class
 * Singleton managing NPC-player relationships
 */
export class RelationshipHandler {
  constructor() {
    this._initialized = false;
    this._relationshipCache = new Map();  // Cache for quick lookups
  }

  /**
   * Initialize the relationship handler
   */
  async initialize() {
    if (this._initialized) return;

    this._initialized = true;
    console.log(`${MODULE_ID} | Relationship Handler initialized`);
  }

  // ==================== RELATIONSHIP RETRIEVAL ====================

  /**
   * Get relationship between player and NPC
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @returns {object|null}
   */
  async getRelationship(playerActorUuid, npcActorUuid) {
    const cacheKey = `${playerActorUuid}:${npcActorUuid}`;

    // Check cache
    if (this._relationshipCache.has(cacheKey)) {
      return this._relationshipCache.get(cacheKey);
    }

    const playerActor = await fromUuid(playerActorUuid);
    if (!playerActor) return null;

    const relationships = getFlag(playerActor, STORAGE_KEYS.PLAYER_RELATIONSHIPS) || {};
    let relationship = relationships[npcActorUuid];

    if (!relationship) {
      // Get NPC config for starting value
      const npcConfig = await this.getNPCConfig(npcActorUuid);
      const startingValue = npcConfig?.startingValue ?? 0;

      relationship = createPlayerRelationship({
        npcActorUuid,
        playerActorUuid,
        value: startingValue,
        tier: getTierForValue(startingValue, npcConfig?.thresholds),
        firstMet: Date.now()
      });
    } else {
      relationship = createPlayerRelationship(relationship);
    }

    // Cache it
    this._relationshipCache.set(cacheKey, relationship);

    return relationship;
  }

  /**
   * Get all relationships for a player
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object} {npcActorUuid: relationship}
   */
  async getAllRelationships(playerActorUuid) {
    const playerActor = await fromUuid(playerActorUuid);
    if (!playerActor) return {};

    const relationships = getFlag(playerActor, STORAGE_KEYS.PLAYER_RELATIONSHIPS) || {};
    const result = {};

    for (const [npcUuid, relData] of Object.entries(relationships)) {
      result[npcUuid] = createPlayerRelationship(relData);
    }

    return result;
  }

  /**
   * Get all relationships with a specific NPC (all players)
   * @param {string} npcActorUuid - NPC actor UUID
   * @returns {object[]}
   */
  async getRelationshipsWithNPC(npcActorUuid) {
    const relationships = [];

    for (const actor of game.actors.filter(a => a.hasPlayerOwner)) {
      const rel = await this.getRelationship(actor.uuid, npcActorUuid);
      if (rel && rel.interactionCount > 0) {
        relationships.push(rel);
      }
    }

    return relationships;
  }

  // ==================== RELATIONSHIP MODIFICATION ====================

  /**
   * Modify relationship value
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {number} amount - Amount to change
   * @param {object} eventData - Event data {type, description, sourceId}
   * @returns {object} {relationship, tierChanged, milestones}
   */
  async modifyRelationship(playerActorUuid, npcActorUuid, amount, eventData = {}) {
    const relationship = await this.getRelationship(playerActorUuid, npcActorUuid);
    const config = await this.getNPCConfig(npcActorUuid);

    if (!relationship || !config?.enabled) {
      return { relationship, tierChanged: false, milestones: [] };
    }

    const previousTier = relationship.tier;
    const updatedRelationship = modifyRelationship(
      relationship,
      amount,
      config,
      {
        type: eventData.type || RelationshipEventType.CUSTOM,
        description: eventData.description || "",
        sourceId: eventData.sourceId
      }
    );

    // Extract metadata
    const tierChanged = updatedRelationship._tierChanged;
    const previousTierData = updatedRelationship._previousTier;
    const newMilestones = updatedRelationship._newMilestones || [];

    // Clean up internal properties
    delete updatedRelationship._tierChanged;
    delete updatedRelationship._previousTier;
    delete updatedRelationship._newMilestones;

    // Save
    await this._saveRelationship(playerActorUuid, npcActorUuid, updatedRelationship);

    // Handle tier change
    if (tierChanged) {
      await this._handleTierChange(
        playerActorUuid,
        npcActorUuid,
        previousTierData,
        updatedRelationship.tier
      );
    }

    // Handle milestones
    for (const milestone of newMilestones) {
      await this._handleMilestoneReached(playerActorUuid, npcActorUuid, milestone);
    }

    // Emit socket event
    this._emitSocket("relationshipChanged", {
      playerActorUuid,
      npcActorUuid,
      amount,
      newValue: updatedRelationship.value,
      newTier: updatedRelationship.tier,
      tierChanged
    });

    Hooks.callAll("bobsNPCRelationshipChanged", playerActorUuid, npcActorUuid, amount, updatedRelationship);

    return {
      relationship: updatedRelationship,
      tierChanged,
      previousTier: previousTierData,
      milestones: newMilestones
    };
  }

  /**
   * Set relationship to a specific value
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {number} value - New value
   * @param {string} reason - Reason for change
   */
  async setRelationship(playerActorUuid, npcActorUuid, value, reason = "Set by GM") {
    const relationship = await this.getRelationship(playerActorUuid, npcActorUuid);
    const currentValue = relationship?.value || 0;
    const amount = value - currentValue;

    return this.modifyRelationship(playerActorUuid, npcActorUuid, amount, {
      type: RelationshipEventType.CUSTOM,
      description: reason
    });
  }

  /**
   * Save relationship to storage
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {object} relationship - Relationship data
   * @private
   */
  async _saveRelationship(playerActorUuid, npcActorUuid, relationship) {
    const playerActor = await fromUuid(playerActorUuid);
    if (!playerActor) return;

    const relationships = getFlag(playerActor, STORAGE_KEYS.PLAYER_RELATIONSHIPS) || {};
    relationships[npcActorUuid] = relationship;
    await setFlag(playerActor, STORAGE_KEYS.PLAYER_RELATIONSHIPS, relationships);

    // Update cache
    const cacheKey = `${playerActorUuid}:${npcActorUuid}`;
    this._relationshipCache.set(cacheKey, relationship);
  }

  // ==================== TIER CHANGES ====================

  /**
   * Handle relationship tier change
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {string} previousTier - Previous tier
   * @param {string} newTier - New tier
   * @private
   */
  async _handleTierChange(playerActorUuid, npcActorUuid, previousTier, newTier) {
    const playerActor = await fromUuid(playerActorUuid);
    const npcActor = await fromUuid(npcActorUuid);

    if (!playerActor || !npcActor) return;

    const previousDisplay = getTierDisplay(previousTier);
    const newDisplay = getTierDisplay(newTier);

    const tierOrder = [
      RelationshipTier.HOSTILE,
      RelationshipTier.UNFRIENDLY,
      RelationshipTier.NEUTRAL,
      RelationshipTier.FRIENDLY,
      RelationshipTier.CLOSE,
      RelationshipTier.DEVOTED
    ];

    const previousIndex = tierOrder.indexOf(previousTier);
    const newIndex = tierOrder.indexOf(newTier);
    const isImprovement = newIndex > previousIndex;

    // Notify
    const message = isImprovement
      ? `${localize("BOBSNPC.RelationshipImproved")}: ${npcActor.name} - ${newDisplay.name}`
      : `${localize("BOBSNPC.RelationshipDeclined")}: ${npcActor.name} - ${newDisplay.name}`;

    ui.notifications.info(message);

    Hooks.callAll("bobsNPCRelationshipTierChanged", playerActorUuid, npcActorUuid, previousTier, newTier);
  }

  /**
   * Handle milestone reached
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {object} milestone - Milestone data
   * @private
   */
  async _handleMilestoneReached(playerActorUuid, npcActorUuid, milestone) {
    const playerActor = await fromUuid(playerActorUuid);
    const npcActor = await fromUuid(npcActorUuid);

    if (!playerActor || !npcActor) return;

    // Give rewards
    const rewards = milestone.rewards || {};

    if (rewards.gold > 0) {
      const currentGold = playerActor.system?.currency?.gp || 0;
      await playerActor.update({ "system.currency.gp": currentGold + rewards.gold });
    }

    if (rewards.xp > 0) {
      const currentXP = playerActor.system?.details?.xp?.value || 0;
      await playerActor.update({ "system.details.xp.value": currentXP + rewards.xp });
    }

    for (const itemReward of rewards.items || []) {
      const item = await fromUuid(itemReward.itemUuid);
      if (item) {
        const itemData = item.toObject();
        itemData.system.quantity = itemReward.quantity || 1;
        await playerActor.createEmbeddedDocuments("Item", [itemData]);
      }
    }

    // Unlock dialogue options
    for (const optionId of milestone.unlocks?.dialogueOptions || []) {
      const unlocked = getFlag(playerActor, "unlockedDialogueOptions") || [];
      if (!unlocked.includes(optionId)) {
        await setFlag(playerActor, "unlockedDialogueOptions", [...unlocked, optionId]);
      }
    }

    // Play achievement dialogue
    if (milestone.achievedDialogue) {
      Hooks.callAll("bobsNPCPlayDialogue", npcActorUuid, milestone.achievedDialogue, [playerActorUuid]);
    }

    // Notify
    ui.notifications.success(`${localize("BOBSNPC.MilestoneReached")}: ${milestone.name} (${npcActor.name})`);

    Hooks.callAll("bobsNPCMilestoneReached", playerActorUuid, npcActorUuid, milestone);
  }

  // ==================== GIFT SYSTEM ====================

  /**
   * Give a gift to an NPC
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {Item} item - Item being given
   * @returns {object} {success, preference, change, response, message}
   */
  async giveGift(playerActorUuid, npcActorUuid, item) {
    const relationship = await this.getRelationship(playerActorUuid, npcActorUuid);
    const config = await this.getNPCConfig(npcActorUuid);

    if (!config?.enabled) {
      return {
        success: false,
        message: localize("BOBSNPC.RelationshipsDisabled")
      };
    }

    const result = processGift(relationship, config, item);

    if (!result.canGift) {
      return {
        success: false,
        message: result.reason
      };
    }

    // Save updated relationship
    await this._saveRelationship(playerActorUuid, npcActorUuid, result.relationship);

    // Remove item from player inventory
    const playerActor = await fromUuid(playerActorUuid);
    if (playerActor) {
      const playerItem = playerActor.items.find(i => i.uuid === item.uuid || i.id === item.id);
      if (playerItem) {
        const qty = playerItem.system?.quantity || 1;
        if (qty <= 1) {
          await playerItem.delete();
        } else {
          await playerItem.update({ "system.quantity": qty - 1 });
        }
      }
    }

    // Get response message
    const responseMessage = this._getGiftResponse(result.preference, config);

    // Notify
    const preferenceDisplay = this._getPreferenceDisplay(result.preference);
    ui.notifications.info(`${localize("BOBSNPC.GiftGiven")}: ${preferenceDisplay.text}`);

    Hooks.callAll("bobsNPCGiftGiven", playerActorUuid, npcActorUuid, item, result);

    return {
      success: true,
      preference: result.preference,
      change: result.change,
      response: result.response || responseMessage,
      message: preferenceDisplay.text
    };
  }

  /**
   * Get gift preference display
   * @param {string} preference - Gift preference
   * @returns {object}
   * @private
   */
  _getPreferenceDisplay(preference) {
    const displays = {
      [GiftPreference.LOVED]: { text: localize("BOBSNPC.GiftLoved"), icon: "fa-heart", color: "#e91e63" },
      [GiftPreference.LIKED]: { text: localize("BOBSNPC.GiftLiked"), icon: "fa-smile", color: "#4caf50" },
      [GiftPreference.NEUTRAL]: { text: localize("BOBSNPC.GiftNeutral"), icon: "fa-meh", color: "#9e9e9e" },
      [GiftPreference.DISLIKED]: { text: localize("BOBSNPC.GiftDisliked"), icon: "fa-frown", color: "#ff9800" },
      [GiftPreference.HATED]: { text: localize("BOBSNPC.GiftHated"), icon: "fa-angry", color: "#f44336" }
    };

    return displays[preference] || displays[GiftPreference.NEUTRAL];
  }

  /**
   * Get generic gift response message
   * @param {string} preference - Gift preference
   * @param {object} config - NPC relationship config
   * @returns {string}
   * @private
   */
  _getGiftResponse(preference, config) {
    const responses = {
      [GiftPreference.LOVED]: [
        "This is exactly what I wanted! Thank you so much!",
        "How did you know? This is perfect!",
        "I love it! You're too kind!"
      ],
      [GiftPreference.LIKED]: [
        "That's very thoughtful of you, thank you.",
        "How nice! I appreciate this.",
        "This is lovely, thank you."
      ],
      [GiftPreference.NEUTRAL]: [
        "Oh... thank you, I suppose.",
        "That's... something. Thanks.",
        "I'll find a use for this."
      ],
      [GiftPreference.DISLIKED]: [
        "This isn't really my thing...",
        "I'm not sure what to do with this.",
        "Um... thanks, I guess."
      ],
      [GiftPreference.HATED]: [
        "Is this some kind of joke?",
        "I can't believe you'd give me this.",
        "Take this back. I don't want it."
      ]
    };

    const options = responses[preference] || responses[GiftPreference.NEUTRAL];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Check if player can give gift to NPC
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @returns {object} {canGift, reason, cooldownRemaining}
   */
  async canGiveGift(playerActorUuid, npcActorUuid) {
    const relationship = await this.getRelationship(playerActorUuid, npcActorUuid);
    const config = await this.getNPCConfig(npcActorUuid);

    if (!config?.enabled) {
      return { canGift: false, reason: localize("BOBSNPC.RelationshipsDisabled") };
    }

    if (!config.gifts?.enabled) {
      return { canGift: false, reason: localize("BOBSNPC.GiftsDisabled") };
    }

    // Check cooldown
    const now = Date.now();
    const cooldownMs = (config.gifts.cooldownHours || 24) * 60 * 60 * 1000;
    const lastGiftTime = relationship?.lastGiftTime || 0;

    if (lastGiftTime && (now - lastGiftTime) < cooldownMs) {
      const remainingMs = cooldownMs - (now - lastGiftTime);
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
      return {
        canGift: false,
        reason: localize("BOBSNPC.GiftCooldown"),
        cooldownRemaining: remainingHours
      };
    }

    // Check daily limit
    const today = new Date().toDateString();
    const lastGiftDay = lastGiftTime ? new Date(lastGiftTime).toDateString() : null;
    const giftsToday = lastGiftDay === today ? (relationship?.giftsToday || 0) : 0;

    if (giftsToday >= (config.gifts.maxPerDay || 1)) {
      return { canGift: false, reason: localize("BOBSNPC.GiftDailyLimit") };
    }

    return { canGift: true, reason: null };
  }

  // ==================== NPC CONFIGURATION ====================

  /**
   * Get NPC relationship configuration
   * @param {string} npcActorUuid - NPC actor UUID
   * @returns {object|null}
   */
  async getNPCConfig(npcActorUuid) {
    const npcActor = await fromUuid(npcActorUuid);
    if (!npcActor) return null;

    const config = getFlag(npcActor, STORAGE_KEYS.NPC_CONFIG);
    return config ? createNPCRelationshipConfig(config) : createNPCRelationshipConfig();
  }

  /**
   * Set NPC relationship configuration
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {object} config - Configuration data
   * @returns {boolean}
   */
  async setNPCConfig(npcActorUuid, config) {
    const npcActor = await fromUuid(npcActorUuid);
    if (!npcActor) return false;

    const validation = validateRelationshipConfig(createNPCRelationshipConfig(config));
    if (!validation.valid) {
      console.warn(`${MODULE_ID} | Invalid relationship config:`, validation.errors);
    }

    await setFlag(npcActor, STORAGE_KEYS.NPC_CONFIG, config);
    return true;
  }

  /**
   * Add gift preference to NPC
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {object} preference - Gift preference data
   */
  async addGiftPreference(npcActorUuid, preference) {
    const config = await this.getNPCConfig(npcActorUuid);
    if (!config) return;

    config.gifts.preferences.push(preference);
    await this.setNPCConfig(npcActorUuid, config);
  }

  /**
   * Add milestone to NPC
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {object} milestone - Milestone data
   */
  async addMilestone(npcActorUuid, milestone) {
    const config = await this.getNPCConfig(npcActorUuid);
    if (!config) return;

    config.milestones.push(milestone);
    await this.setNPCConfig(npcActorUuid, config);
  }

  // ==================== DECAY ====================

  /**
   * Apply relationship decay for all NPCs
   */
  async applyRelationshipDecay() {
    for (const playerActor of game.actors.filter(a => a.hasPlayerOwner)) {
      const relationships = await this.getAllRelationships(playerActor.uuid);

      for (const [npcUuid, relationship] of Object.entries(relationships)) {
        const config = await this.getNPCConfig(npcUuid);
        if (!config?.decay?.enabled) continue;

        const decayedRelationship = applyDecay(relationship, config);

        if (decayedRelationship.value !== relationship.value) {
          await this._saveRelationship(playerActor.uuid, npcUuid, decayedRelationship);
        }
      }
    }
  }

  // ==================== QUERIES ====================

  /**
   * Get NPCs with relationship at or above a tier
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} tier - Minimum tier
   * @returns {object[]}
   */
  async getNPCsAtTier(playerActorUuid, tier) {
    const relationships = await this.getAllRelationships(playerActorUuid);
    const tierOrder = [
      RelationshipTier.HOSTILE,
      RelationshipTier.UNFRIENDLY,
      RelationshipTier.NEUTRAL,
      RelationshipTier.FRIENDLY,
      RelationshipTier.CLOSE,
      RelationshipTier.DEVOTED
    ];

    const targetIndex = tierOrder.indexOf(tier);

    return Object.entries(relationships)
      .filter(([_, rel]) => tierOrder.indexOf(rel.tier) >= targetIndex)
      .map(([npcUuid, rel]) => ({ npcActorUuid: npcUuid, relationship: rel }));
  }

  /**
   * Get relationship progress info
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @returns {object}
   */
  async getRelationshipProgress(playerActorUuid, npcActorUuid) {
    const relationship = await this.getRelationship(playerActorUuid, npcActorUuid);
    const config = await this.getNPCConfig(npcActorUuid);

    if (!relationship || !config) return null;

    const progress = getProgressToNextTier(relationship.value, relationship.tier, config.thresholds);
    const currentDisplay = getTierDisplay(relationship.tier);
    const nextDisplay = progress.nextTier ? getTierDisplay(progress.nextTier) : null;

    return {
      currentValue: relationship.value,
      currentTier: relationship.tier,
      currentTierDisplay: currentDisplay,
      nextTier: progress.nextTier,
      nextTierDisplay: nextDisplay,
      nextThreshold: progress.threshold,
      progress: progress.percent,
      interactionCount: relationship.interactionCount,
      giftsGiven: relationship.giftsGiven,
      achievedMilestones: relationship.achievedMilestones
    };
  }

  /**
   * Get relationship summary for UI
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @returns {object|null}
   */
  async getRelationshipSummary(playerActorUuid, npcActorUuid) {
    const relationship = await this.getRelationship(playerActorUuid, npcActorUuid);
    const config = await this.getNPCConfig(npcActorUuid);
    const npcActor = await fromUuid(npcActorUuid);

    if (!relationship || !npcActor) return null;

    const progress = await this.getRelationshipProgress(playerActorUuid, npcActorUuid);
    const canGiftResult = await this.canGiveGift(playerActorUuid, npcActorUuid);

    return {
      npc: {
        uuid: npcActorUuid,
        name: npcActor.name,
        img: npcActor.img
      },
      relationship,
      config,
      progress,
      canGift: canGiftResult.canGift,
      giftCooldown: canGiftResult.cooldownRemaining,
      display: getTierDisplay(relationship.tier)
    };
  }

  // ==================== SPECIAL FLAGS ====================

  /**
   * Set relationship flag
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {string} flag - Flag name
   * @param {*} value - Flag value
   */
  async setRelationshipFlag(playerActorUuid, npcActorUuid, flag, value) {
    const relationship = await this.getRelationship(playerActorUuid, npcActorUuid);
    if (!relationship) return;

    relationship.flags = relationship.flags || {};
    relationship.flags.custom = relationship.flags.custom || {};
    relationship.flags.custom[flag] = value;

    await this._saveRelationship(playerActorUuid, npcActorUuid, relationship);
  }

  /**
   * Get relationship flag
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {string} flag - Flag name
   * @returns {*}
   */
  async getRelationshipFlag(playerActorUuid, npcActorUuid, flag) {
    const relationship = await this.getRelationship(playerActorUuid, npcActorUuid);
    return relationship?.flags?.custom?.[flag];
  }

  /**
   * Set romance flag
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {boolean} isRomance - Romance status
   */
  async setRomance(playerActorUuid, npcActorUuid, isRomance) {
    const relationship = await this.getRelationship(playerActorUuid, npcActorUuid);
    if (!relationship) return;

    relationship.flags.isRomance = isRomance;
    await this._saveRelationship(playerActorUuid, npcActorUuid, relationship);

    Hooks.callAll("bobsNPCRomanceChanged", playerActorUuid, npcActorUuid, isRomance);
  }

  /**
   * Set rival flag
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {boolean} isRival - Rival status
   */
  async setRival(playerActorUuid, npcActorUuid, isRival) {
    const relationship = await this.getRelationship(playerActorUuid, npcActorUuid);
    if (!relationship) return;

    relationship.flags.isRival = isRival;
    await this._saveRelationship(playerActorUuid, npcActorUuid, relationship);
  }

  // ==================== INTERACTION RECORDING ====================

  /**
   * Record an interaction (increments counter)
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   */
  async recordInteraction(playerActorUuid, npcActorUuid) {
    const relationship = await this.getRelationship(playerActorUuid, npcActorUuid);
    if (!relationship) return;

    relationship.interactionCount = (relationship.interactionCount || 0) + 1;
    relationship.lastInteraction = Date.now();

    await this._saveRelationship(playerActorUuid, npcActorUuid, relationship);
  }

  // ==================== CACHE MANAGEMENT ====================

  /**
   * Clear relationship cache
   */
  clearCache() {
    this._relationshipCache.clear();
  }

  /**
   * Invalidate cache for specific relationship
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} npcActorUuid - NPC actor UUID
   */
  invalidateCache(playerActorUuid, npcActorUuid) {
    const cacheKey = `${playerActorUuid}:${npcActorUuid}`;
    this._relationshipCache.delete(cacheKey);
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
      type: `relationship.${event}`,
      data
    });
  }
}

// Singleton instance
export const relationshipHandler = new RelationshipHandler();
