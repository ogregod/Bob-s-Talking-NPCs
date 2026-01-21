/**
 * Bob's Talking NPCs - Crime Handler
 * Business logic for crime tracking, bounties, witnesses, and law enforcement
 */

import { MODULE_ID } from "../module.mjs";
import { localize, getFlag, setFlag, generateId } from "../utils/helpers.mjs";
import {
  CrimeType,
  BountyStatus,
  WitnessType,
  PunishmentType,
  DefaultCrimeBounties,
  createCrime,
  createBounty,
  createJurisdiction,
  createCriminalRecord,
  createWitness,
  calculateBounty,
  checkWitnessed,
  addBounty,
  payBounty,
  serveJailTime,
  pardonBounty,
  applyBountyDecay,
  getTotalBounty,
  getBountyStatus,
  JurisdictionTemplates,
  createJurisdictionFromTemplate
} from "../data/bounty-model.mjs";

/**
 * Crime Handler class
 * Manages all crime, bounty, and law enforcement operations
 */
export class CrimeHandler {
  constructor() {
    this._initialized = false;
    this._jurisdictionCache = new Map();
    this._bountyCache = new Map();
    this._crimeCache = new Map();
    this._recordCache = new Map();
  }

  /**
   * Initialize the crime handler
   */
  async initialize() {
    if (this._initialized) return;

    await this._loadJurisdictions();
    await this._loadBounties();
    await this._loadCrimes();

    this._initialized = true;
    console.log(`${MODULE_ID} | Crime handler initialized`);
  }

  // ==================== Jurisdiction Management ====================

  /**
   * Load all jurisdictions from world settings
   * @private
   */
  async _loadJurisdictions() {
    const jurisdictions = game.settings.get(MODULE_ID, "jurisdictions") || {};
    this._jurisdictionCache.clear();
    for (const [id, data] of Object.entries(jurisdictions)) {
      this._jurisdictionCache.set(id, data);
    }
  }

  /**
   * Load all bounties from world settings
   * @private
   */
  async _loadBounties() {
    const bounties = game.settings.get(MODULE_ID, "bounties") || {};
    this._bountyCache.clear();
    for (const [id, data] of Object.entries(bounties)) {
      this._bountyCache.set(id, data);
    }
  }

  /**
   * Load all crimes from world settings
   * @private
   */
  async _loadCrimes() {
    const crimes = game.settings.get(MODULE_ID, "crimes") || {};
    this._crimeCache.clear();
    for (const [id, data] of Object.entries(crimes)) {
      this._crimeCache.set(id, data);
    }
  }

  /**
   * Save jurisdictions to world settings
   * @private
   */
  async _saveJurisdictions() {
    const data = Object.fromEntries(this._jurisdictionCache);
    await game.settings.set(MODULE_ID, "jurisdictions", data);
  }

  /**
   * Save bounties to world settings
   * @private
   */
  async _saveBounties() {
    const data = Object.fromEntries(this._bountyCache);
    await game.settings.set(MODULE_ID, "bounties", data);
  }

  /**
   * Save crimes to world settings
   * @private
   */
  async _saveCrimes() {
    const data = Object.fromEntries(this._crimeCache);
    await game.settings.set(MODULE_ID, "crimes", data);
  }

  /**
   * Create a new jurisdiction
   * @param {object} data - Jurisdiction data
   * @returns {object} Created jurisdiction
   */
  async createJurisdiction(data) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const jurisdiction = createJurisdiction(data);
    this._jurisdictionCache.set(jurisdiction.id, jurisdiction);
    await this._saveJurisdictions();

    Hooks.callAll(`${MODULE_ID}.jurisdictionCreated`, jurisdiction);
    this._emitSocket("jurisdictionCreated", { jurisdiction });

    return jurisdiction;
  }

  /**
   * Create jurisdiction from template
   * @param {string} templateName - Template name (city, lawless, strict, frontier)
   * @param {object} overrides - Data overrides
   * @returns {object} Created jurisdiction
   */
  async createJurisdictionFromTemplate(templateName, overrides = {}) {
    const jurisdiction = createJurisdictionFromTemplate(templateName, overrides);
    this._jurisdictionCache.set(jurisdiction.id, jurisdiction);
    await this._saveJurisdictions();

    Hooks.callAll(`${MODULE_ID}.jurisdictionCreated`, jurisdiction);
    return jurisdiction;
  }

  /**
   * Get jurisdiction by ID
   * @param {string} jurisdictionId - Jurisdiction ID
   * @returns {object|null}
   */
  getJurisdiction(jurisdictionId) {
    return this._jurisdictionCache.get(jurisdictionId) || null;
  }

  /**
   * Get jurisdiction by scene ID
   * @param {string} sceneId - Scene ID
   * @returns {object|null}
   */
  getJurisdictionByScene(sceneId) {
    for (const jurisdiction of this._jurisdictionCache.values()) {
      if (jurisdiction.sceneIds.includes(sceneId)) {
        return jurisdiction;
      }
    }
    return null;
  }

  /**
   * Get all jurisdictions
   * @returns {object[]}
   */
  getAllJurisdictions() {
    return Array.from(this._jurisdictionCache.values());
  }

  /**
   * Update jurisdiction
   * @param {string} jurisdictionId - Jurisdiction ID
   * @param {object} updates - Updates to apply
   * @returns {object} Updated jurisdiction
   */
  async updateJurisdiction(jurisdictionId, updates) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const jurisdiction = this._jurisdictionCache.get(jurisdictionId);
    if (!jurisdiction) {
      throw new Error(localize("Errors.JurisdictionNotFound"));
    }

    const updated = {
      ...jurisdiction,
      ...updates,
      id: jurisdictionId,
      updatedAt: Date.now()
    };

    this._jurisdictionCache.set(jurisdictionId, updated);
    await this._saveJurisdictions();

    Hooks.callAll(`${MODULE_ID}.jurisdictionUpdated`, updated);
    this._emitSocket("jurisdictionUpdated", { jurisdiction: updated });

    return updated;
  }

  /**
   * Delete jurisdiction
   * @param {string} jurisdictionId - Jurisdiction ID
   */
  async deleteJurisdiction(jurisdictionId) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    this._jurisdictionCache.delete(jurisdictionId);
    await this._saveJurisdictions();

    Hooks.callAll(`${MODULE_ID}.jurisdictionDeleted`, jurisdictionId);
  }

  /**
   * Add scene to jurisdiction
   * @param {string} jurisdictionId - Jurisdiction ID
   * @param {string} sceneId - Scene ID
   */
  async addSceneToJurisdiction(jurisdictionId, sceneId) {
    const jurisdiction = this._jurisdictionCache.get(jurisdictionId);
    if (!jurisdiction) {
      throw new Error(localize("Errors.JurisdictionNotFound"));
    }

    // Remove from other jurisdictions first
    for (const [id, j] of this._jurisdictionCache.entries()) {
      if (j.sceneIds.includes(sceneId)) {
        j.sceneIds = j.sceneIds.filter(s => s !== sceneId);
        this._jurisdictionCache.set(id, j);
      }
    }

    if (!jurisdiction.sceneIds.includes(sceneId)) {
      jurisdiction.sceneIds.push(sceneId);
      jurisdiction.updatedAt = Date.now();
      this._jurisdictionCache.set(jurisdictionId, jurisdiction);
    }

    await this._saveJurisdictions();
  }

  // ==================== Crime Reporting ====================

  /**
   * Report a crime
   * @param {object} crimeData - Crime data
   * @param {object} options - Options
   * @returns {object} {crime, bounty, witnessed}
   */
  async reportCrime(crimeData, options = {}) {
    const {
      autoCalculateBounty = true,
      addToRecord = true,
      emitHooks = true
    } = options;

    // Check if crime system is enabled
    if (!game.settings.get(MODULE_ID, "crimeEnabled")) {
      return { crime: null, bounty: null, witnessed: false };
    }

    // Create the crime record
    const crime = createCrime({
      ...crimeData,
      reported: true,
      reportedAt: Date.now()
    });

    // Get jurisdiction
    const jurisdiction = crimeData.regionId
      ? this.getJurisdiction(crimeData.regionId)
      : this.getJurisdictionByScene(crimeData.sceneId || game.scenes.active?.id);

    // If no jurisdiction or crime disabled there, don't process
    if (!jurisdiction || !jurisdiction.crimeConfig.enabled) {
      return { crime, bounty: null, witnessed: false };
    }

    crime.regionId = jurisdiction.id;

    // Check if witnessed
    const witnessResult = checkWitnessed(crime, jurisdiction);
    if (!witnessResult.witnessed) {
      // Crime happened but wasn't properly witnessed
      crime.reported = false;
      this._crimeCache.set(crime.id, crime);
      await this._saveCrimes();

      if (emitHooks) {
        Hooks.callAll(`${MODULE_ID}.crimeUnwitnessed`, crime, witnessResult);
      }

      return { crime, bounty: null, witnessed: false };
    }

    // Calculate bounty
    if (autoCalculateBounty) {
      crime.baseBounty = DefaultCrimeBounties[crime.type] || 50;
      crime.calculatedBounty = calculateBounty(crime, jurisdiction);
    }

    // Save crime
    this._crimeCache.set(crime.id, crime);
    await this._saveCrimes();

    // Add bounty
    let bounty = null;
    if (crime.perpetratorUuid && addToRecord) {
      bounty = await this._addBountyForCrime(crime, jurisdiction);
    }

    if (emitHooks) {
      Hooks.callAll(`${MODULE_ID}.crimeReported`, crime, bounty, jurisdiction);
      this._emitSocket("crimeReported", { crime, bounty, jurisdictionId: jurisdiction.id });
    }

    // Notify
    this._notifyCrime(crime, jurisdiction);

    return { crime, bounty, witnessed: true };
  }

  /**
   * Add bounty for a crime
   * @param {object} crime - Crime data
   * @param {object} jurisdiction - Jurisdiction
   * @returns {object} Bounty
   * @private
   */
  async _addBountyForCrime(crime, jurisdiction) {
    // Get or create criminal record
    let record = await this.getCriminalRecord(crime.perpetratorUuid);
    if (!record) {
      record = await this._createCriminalRecord(crime.perpetratorUuid);
    }

    // Check for existing bounty in this jurisdiction
    let bounty = null;
    const existingBountyId = record.bounties[jurisdiction.id];

    if (existingBountyId) {
      bounty = this._bountyCache.get(existingBountyId);
      if (bounty && bounty.status === BountyStatus.ACTIVE) {
        // Add to existing bounty
        bounty = {
          ...bounty,
          amount: bounty.amount + crime.calculatedBounty,
          crimes: [...bounty.crimes, crime.id],
          updatedAt: Date.now()
        };
      } else {
        bounty = null;
      }
    }

    if (!bounty) {
      // Create new bounty
      const actor = await fromUuid(crime.perpetratorUuid);
      bounty = createBounty({
        targetActorUuid: crime.perpetratorUuid,
        targetName: actor?.name || crime.perpetratorName,
        regionId: jurisdiction.id,
        factionId: jurisdiction.enforcementFactionId,
        jurisdictionName: jurisdiction.name,
        amount: crime.calculatedBounty,
        crimes: [crime.id]
      });
    }

    this._bountyCache.set(bounty.id, bounty);
    await this._saveBounties();

    // Update criminal record
    record = addBounty(record, jurisdiction.id, crime.calculatedBounty, crime.id);
    record.bounties[jurisdiction.id] = bounty.id;

    // Update crime stats
    record.stats = this._updateCrimeStats(record.stats, crime.type);

    await this._saveCriminalRecord(record);

    return bounty;
  }

  /**
   * Update crime statistics
   * @param {object} stats - Current stats
   * @param {string} crimeType - Crime type
   * @returns {object} Updated stats
   * @private
   */
  _updateCrimeStats(stats, crimeType) {
    const newStats = { ...stats };

    switch (crimeType) {
      case CrimeType.THEFT:
      case CrimeType.PICKPOCKET:
        newStats.thefts = (newStats.thefts || 0) + 1;
        break;
      case CrimeType.ASSAULT:
        newStats.assaults = (newStats.assaults || 0) + 1;
        break;
      case CrimeType.MURDER:
        newStats.murders = (newStats.murders || 0) + 1;
        break;
    }

    return newStats;
  }

  /**
   * Notify about a crime
   * @param {object} crime - Crime data
   * @param {object} jurisdiction - Jurisdiction
   * @private
   */
  _notifyCrime(crime, jurisdiction) {
    const bountyStatus = getBountyStatus(crime.calculatedBounty);

    ui.notifications.warn(
      localize("Crime.Reported", {
        crime: localize(`CrimeTypes.${crime.type}`),
        jurisdiction: jurisdiction.name,
        bounty: crime.calculatedBounty
      })
    );
  }

  // ==================== Criminal Records ====================

  /**
   * Get criminal record for an actor
   * @param {string} actorUuid - Actor UUID
   * @returns {object|null}
   */
  async getCriminalRecord(actorUuid) {
    // Check cache first
    if (this._recordCache.has(actorUuid)) {
      return this._recordCache.get(actorUuid);
    }

    // Load from actor flags
    const actor = await fromUuid(actorUuid);
    if (!actor) return null;

    const record = getFlag(actor, "criminalRecord");
    if (record) {
      this._recordCache.set(actorUuid, record);
    }
    return record;
  }

  /**
   * Create criminal record for an actor
   * @param {string} actorUuid - Actor UUID
   * @returns {object}
   * @private
   */
  async _createCriminalRecord(actorUuid) {
    const record = createCriminalRecord({ playerActorUuid: actorUuid });
    this._recordCache.set(actorUuid, record);
    await this._saveCriminalRecord(record);
    return record;
  }

  /**
   * Save criminal record
   * @param {object} record - Criminal record
   * @private
   */
  async _saveCriminalRecord(record) {
    const actor = await fromUuid(record.playerActorUuid);
    if (!actor) return;

    await setFlag(actor, "criminalRecord", record);
    this._recordCache.set(record.playerActorUuid, record);
  }

  /**
   * Get total bounty for an actor
   * @param {string} actorUuid - Actor UUID
   * @returns {number}
   */
  async getTotalBounty(actorUuid) {
    const record = await this.getCriminalRecord(actorUuid);
    if (!record) return 0;

    const bountyData = Object.fromEntries(this._bountyCache);
    return getTotalBounty(record, bountyData);
  }

  /**
   * Get bounty in a specific jurisdiction
   * @param {string} actorUuid - Actor UUID
   * @param {string} jurisdictionId - Jurisdiction ID
   * @returns {object|null}
   */
  async getBountyInJurisdiction(actorUuid, jurisdictionId) {
    const record = await this.getCriminalRecord(actorUuid);
    if (!record) return null;

    const bountyId = record.bounties[jurisdictionId];
    if (!bountyId) return null;

    return this._bountyCache.get(bountyId) || null;
  }

  /**
   * Get all active bounties for an actor
   * @param {string} actorUuid - Actor UUID
   * @returns {object[]}
   */
  async getActiveBounties(actorUuid) {
    const record = await this.getCriminalRecord(actorUuid);
    if (!record) return [];

    const bounties = [];
    for (const bountyId of Object.values(record.bounties)) {
      const bounty = this._bountyCache.get(bountyId);
      if (bounty && bounty.status === BountyStatus.ACTIVE) {
        bounties.push(bounty);
      }
    }

    return bounties;
  }

  /**
   * Get bounty status for an actor
   * @param {string} actorUuid - Actor UUID
   * @returns {object}
   */
  async getBountyStatusForActor(actorUuid) {
    const total = await this.getTotalBounty(actorUuid);
    return getBountyStatus(total);
  }

  // ==================== Bounty Resolution ====================

  /**
   * Pay off bounty
   * @param {string} actorUuid - Actor UUID
   * @param {string} jurisdictionId - Jurisdiction ID
   * @param {number} amount - Amount to pay (null = full)
   * @returns {object} {success, bounty, remaining, refund}
   */
  async payBounty(actorUuid, jurisdictionId, amount = null) {
    const record = await this.getCriminalRecord(actorUuid);
    if (!record) {
      return { success: false, error: localize("Errors.NoRecord") };
    }

    const bountyId = record.bounties[jurisdictionId];
    if (!bountyId) {
      return { success: false, error: localize("Errors.NoBounty") };
    }

    let bounty = this._bountyCache.get(bountyId);
    if (!bounty || bounty.status !== BountyStatus.ACTIVE) {
      return { success: false, error: localize("Errors.BountyNotActive") };
    }

    // Get actor and check funds
    const actor = await fromUuid(actorUuid);
    if (!actor) {
      return { success: false, error: localize("Errors.ActorNotFound") };
    }

    const payAmount = amount ?? bounty.amount;
    const currency = actor.system?.currency;

    if (currency) {
      // D&D 5e currency handling
      const totalGold = this._calculateTotalGold(currency);
      if (totalGold < payAmount) {
        return {
          success: false,
          error: localize("Errors.InsufficientFunds"),
          required: payAmount,
          available: totalGold
        };
      }

      // Deduct currency
      await this._deductCurrency(actor, payAmount);
    }

    // Update bounty
    bounty = payBounty(bounty, payAmount);
    this._bountyCache.set(bountyId, bounty);
    await this._saveBounties();

    // Update record if fully paid
    if (bounty.status === BountyStatus.PAID) {
      record.totalBountyPaid += payAmount;
      record.stats.finesPaid = (record.stats.finesPaid || 0) + 1;
      await this._saveCriminalRecord(record);
    }

    Hooks.callAll(`${MODULE_ID}.bountyPaid`, actorUuid, bounty, payAmount);
    this._emitSocket("bountyPaid", { actorUuid, bounty, amount: payAmount });

    ui.notifications.info(
      localize("Crime.BountyPaid", {
        amount: payAmount,
        remaining: bounty.amount
      })
    );

    return {
      success: true,
      bounty,
      paid: payAmount,
      remaining: bounty.amount
    };
  }

  /**
   * Calculate total gold from D&D 5e currency
   * @param {object} currency - Currency object
   * @returns {number} Total in gold
   * @private
   */
  _calculateTotalGold(currency) {
    return (
      (currency.pp || 0) * 10 +
      (currency.gp || 0) +
      (currency.ep || 0) * 0.5 +
      (currency.sp || 0) * 0.1 +
      (currency.cp || 0) * 0.01
    );
  }

  /**
   * Deduct currency from actor
   * @param {Actor} actor - Actor
   * @param {number} amount - Amount in gold
   * @private
   */
  async _deductCurrency(actor, amount) {
    const currency = { ...actor.system.currency };
    let remaining = amount;

    // Deduct from lowest value first
    const denominations = [
      { key: "cp", rate: 0.01 },
      { key: "sp", rate: 0.1 },
      { key: "ep", rate: 0.5 },
      { key: "gp", rate: 1 },
      { key: "pp", rate: 10 }
    ];

    for (const { key, rate } of denominations) {
      if (remaining <= 0) break;
      const available = currency[key] || 0;
      const deductCoins = Math.min(available, Math.ceil(remaining / rate));
      const deductValue = deductCoins * rate;

      if (deductValue <= remaining + 0.001) {
        currency[key] = available - deductCoins;
        remaining -= deductValue;
      }
    }

    await actor.update({ "system.currency": currency });
  }

  /**
   * Serve jail time to clear bounty
   * @param {string} actorUuid - Actor UUID
   * @param {string} jurisdictionId - Jurisdiction ID
   * @param {number} hours - Hours to serve
   * @returns {object}
   */
  async serveJailTime(actorUuid, jurisdictionId, hours) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const record = await this.getCriminalRecord(actorUuid);
    if (!record) {
      return { success: false, error: localize("Errors.NoRecord") };
    }

    const bountyId = record.bounties[jurisdictionId];
    if (!bountyId) {
      return { success: false, error: localize("Errors.NoBounty") };
    }

    let bounty = this._bountyCache.get(bountyId);
    if (!bounty || bounty.status !== BountyStatus.ACTIVE) {
      return { success: false, error: localize("Errors.BountyNotActive") };
    }

    // Update bounty
    bounty = serveJailTime(bounty, hours);
    this._bountyCache.set(bountyId, bounty);
    await this._saveBounties();

    // Update record
    record.totalJailTime += hours;
    record.isJailed = false;
    record.jailReleaseTime = null;
    await this._saveCriminalRecord(record);

    Hooks.callAll(`${MODULE_ID}.jailTimeServed`, actorUuid, bounty, hours);
    this._emitSocket("jailTimeServed", { actorUuid, bounty, hours });

    ui.notifications.info(
      localize("Crime.JailServed", { hours })
    );

    return { success: true, bounty };
  }

  /**
   * Grant a pardon
   * @param {string} actorUuid - Actor UUID
   * @param {string} jurisdictionId - Jurisdiction ID
   * @param {string} pardonedBy - Who granted the pardon
   * @param {string} reason - Reason for pardon
   * @returns {object}
   */
  async grantPardon(actorUuid, jurisdictionId, pardonedBy, reason = "") {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const record = await this.getCriminalRecord(actorUuid);
    if (!record) {
      return { success: false, error: localize("Errors.NoRecord") };
    }

    const bountyId = record.bounties[jurisdictionId];
    if (!bountyId) {
      return { success: false, error: localize("Errors.NoBounty") };
    }

    let bounty = this._bountyCache.get(bountyId);
    if (!bounty || bounty.status !== BountyStatus.ACTIVE) {
      return { success: false, error: localize("Errors.BountyNotActive") };
    }

    // Update bounty
    bounty = pardonBounty(bounty, pardonedBy, reason);
    this._bountyCache.set(bountyId, bounty);
    await this._saveBounties();

    // Update record
    record.stats.pardonsReceived = (record.stats.pardonsReceived || 0) + 1;
    await this._saveCriminalRecord(record);

    Hooks.callAll(`${MODULE_ID}.pardonGranted`, actorUuid, bounty, pardonedBy);
    this._emitSocket("pardonGranted", { actorUuid, bounty, pardonedBy });

    ui.notifications.info(
      localize("Crime.Pardoned", { jurisdiction: bounty.jurisdictionName })
    );

    return { success: true, bounty };
  }

  /**
   * Clear all bounties for an actor
   * @param {string} actorUuid - Actor UUID
   */
  async clearAllBounties(actorUuid) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const record = await this.getCriminalRecord(actorUuid);
    if (!record) return;

    for (const bountyId of Object.values(record.bounties)) {
      const bounty = this._bountyCache.get(bountyId);
      if (bounty && bounty.status === BountyStatus.ACTIVE) {
        bounty.status = BountyStatus.PARDONED;
        bounty.amount = 0;
        bounty.resolvedAt = Date.now();
        this._bountyCache.set(bountyId, bounty);
      }
    }

    await this._saveBounties();
    Hooks.callAll(`${MODULE_ID}.bountiesCleared`, actorUuid);
  }

  // ==================== Witness Management ====================

  /**
   * Add witness to a crime
   * @param {string} crimeId - Crime ID
   * @param {object} witnessData - Witness data
   * @returns {object} Updated crime
   */
  async addWitness(crimeId, witnessData) {
    const crime = this._crimeCache.get(crimeId);
    if (!crime) {
      throw new Error(localize("Errors.CrimeNotFound"));
    }

    const witness = createWitness(witnessData);
    crime.witnesses.push(witness);

    this._crimeCache.set(crimeId, crime);
    await this._saveCrimes();

    Hooks.callAll(`${MODULE_ID}.witnessAdded`, crime, witness);
    return crime;
  }

  /**
   * Bribe a witness
   * @param {string} crimeId - Crime ID
   * @param {string} witnessId - Witness ID
   * @param {number} bribeAmount - Amount paid
   * @returns {object} {success, witness, crime}
   */
  async bribeWitness(crimeId, witnessId, bribeAmount) {
    const crime = this._crimeCache.get(crimeId);
    if (!crime) {
      throw new Error(localize("Errors.CrimeNotFound"));
    }

    const witnessIndex = crime.witnesses.findIndex(w => w.id === witnessId);
    if (witnessIndex === -1) {
      throw new Error(localize("Errors.WitnessNotFound"));
    }

    crime.witnesses[witnessIndex].bribed = true;
    this._crimeCache.set(crimeId, crime);
    await this._saveCrimes();

    Hooks.callAll(`${MODULE_ID}.witnessBribed`, crime, crime.witnesses[witnessIndex], bribeAmount);

    return {
      success: true,
      witness: crime.witnesses[witnessIndex],
      crime
    };
  }

  /**
   * Silence a witness (intimidation, etc.)
   * @param {string} crimeId - Crime ID
   * @param {string} witnessId - Witness ID
   * @param {string} method - How they were silenced
   * @returns {object}
   */
  async silenceWitness(crimeId, witnessId, method = "") {
    const crime = this._crimeCache.get(crimeId);
    if (!crime) {
      throw new Error(localize("Errors.CrimeNotFound"));
    }

    const witnessIndex = crime.witnesses.findIndex(w => w.id === witnessId);
    if (witnessIndex === -1) {
      throw new Error(localize("Errors.WitnessNotFound"));
    }

    crime.witnesses[witnessIndex].silenced = true;
    this._crimeCache.set(crimeId, crime);
    await this._saveCrimes();

    Hooks.callAll(`${MODULE_ID}.witnessSilenced`, crime, crime.witnesses[witnessIndex], method);

    return {
      success: true,
      witness: crime.witnesses[witnessIndex],
      crime
    };
  }

  // ==================== Arrest & Jail ====================

  /**
   * Attempt arrest of a player
   * @param {string} actorUuid - Actor UUID
   * @param {string} jurisdictionId - Jurisdiction ID
   * @param {object} options - Options
   * @returns {object}
   */
  async attemptArrest(actorUuid, jurisdictionId, options = {}) {
    const { guardUuid, dialogueFirst = true } = options;

    const jurisdiction = this.getJurisdiction(jurisdictionId);
    if (!jurisdiction) {
      throw new Error(localize("Errors.JurisdictionNotFound"));
    }

    const bounty = await this.getBountyInJurisdiction(actorUuid, jurisdictionId);
    if (!bounty || bounty.status !== BountyStatus.ACTIVE) {
      return { success: false, reason: "no_bounty" };
    }

    // Check if should start arrest dialogue
    if (dialogueFirst && jurisdiction.guardBehavior.arrestDialogueId) {
      Hooks.callAll(`${MODULE_ID}.arrestDialogueStart`, actorUuid, jurisdictionId, {
        dialogueId: jurisdiction.guardBehavior.arrestDialogueId,
        bounty
      });
      return { success: true, action: "dialogue_started" };
    }

    // Direct arrest
    return this.arrestActor(actorUuid, jurisdictionId);
  }

  /**
   * Arrest an actor (put in jail)
   * @param {string} actorUuid - Actor UUID
   * @param {string} jurisdictionId - Jurisdiction ID
   * @returns {object}
   */
  async arrestActor(actorUuid, jurisdictionId) {
    const record = await this.getCriminalRecord(actorUuid);
    if (!record) {
      return { success: false, error: localize("Errors.NoRecord") };
    }

    const jurisdiction = this.getJurisdiction(jurisdictionId);
    if (!jurisdiction) {
      throw new Error(localize("Errors.JurisdictionNotFound"));
    }

    // Calculate jail time based on crimes
    const bounty = await this.getBountyInJurisdiction(actorUuid, jurisdictionId);
    const jailHours = this._calculateJailTime(bounty, jurisdiction);

    // Update record
    record.isJailed = true;
    record.jailRegionId = jurisdictionId;
    record.jailReleaseTime = Date.now() + (jailHours * 60 * 60 * 1000);
    await this._saveCriminalRecord(record);

    Hooks.callAll(`${MODULE_ID}.actorArrested`, actorUuid, jurisdictionId, jailHours);
    this._emitSocket("actorArrested", { actorUuid, jurisdictionId, jailHours });

    ui.notifications.warn(
      localize("Crime.Arrested", { hours: jailHours })
    );

    return {
      success: true,
      jailed: true,
      jailHours,
      releaseTime: record.jailReleaseTime
    };
  }

  /**
   * Calculate jail time for bounty
   * @param {object} bounty - Bounty data
   * @param {object} jurisdiction - Jurisdiction
   * @returns {number} Hours
   * @private
   */
  _calculateJailTime(bounty, jurisdiction) {
    if (!bounty) return 0;

    // Base: 1 hour per 50 gold bounty
    let hours = Math.ceil(bounty.amount / 50);

    // Minimum 1 hour
    hours = Math.max(1, hours);

    // Maximum based on jurisdiction (default 168 = 1 week)
    const maxHours = 168;
    hours = Math.min(hours, maxHours);

    return hours;
  }

  /**
   * Resist arrest
   * @param {string} actorUuid - Actor UUID
   * @param {string} jurisdictionId - Jurisdiction ID
   * @returns {object}
   */
  async resistArrest(actorUuid, jurisdictionId) {
    const record = await this.getCriminalRecord(actorUuid);
    if (!record) return;

    const bountyId = record.bounties[jurisdictionId];
    if (bountyId) {
      const bounty = this._bountyCache.get(bountyId);
      if (bounty) {
        bounty.arrestsResisted += 1;
        this._bountyCache.set(bountyId, bounty);
        await this._saveBounties();
      }
    }

    // Add resisting arrest crime
    await this.reportCrime({
      type: CrimeType.RESISTING_ARREST,
      perpetratorUuid: actorUuid,
      regionId: jurisdictionId,
      witnesses: [{ type: WitnessType.GUARD }]
    });

    record.stats.arrestsEvaded = (record.stats.arrestsEvaded || 0) + 1;
    await this._saveCriminalRecord(record);

    Hooks.callAll(`${MODULE_ID}.arrestResisted`, actorUuid, jurisdictionId);
  }

  /**
   * Escape from jail
   * @param {string} actorUuid - Actor UUID
   * @returns {object}
   */
  async escapeJail(actorUuid) {
    const record = await this.getCriminalRecord(actorUuid);
    if (!record || !record.isJailed) {
      return { success: false, error: "Not jailed" };
    }

    const jurisdictionId = record.jailRegionId;

    // Add escape crime
    await this.reportCrime({
      type: CrimeType.ESCAPE,
      perpetratorUuid: actorUuid,
      regionId: jurisdictionId,
      caught: false,
      witnesses: [{ type: WitnessType.GUARD }]
    });

    // Update record
    record.isJailed = false;
    record.jailReleaseTime = null;
    record.stats.jailbreaks = (record.stats.jailbreaks || 0) + 1;
    await this._saveCriminalRecord(record);

    // Update bounty
    const bountyId = record.bounties[jurisdictionId];
    if (bountyId) {
      const bounty = this._bountyCache.get(bountyId);
      if (bounty) {
        bounty.escapeAttempts += 1;
        this._bountyCache.set(bountyId, bounty);
        await this._saveBounties();
      }
    }

    Hooks.callAll(`${MODULE_ID}.jailEscaped`, actorUuid, jurisdictionId);

    return { success: true };
  }

  /**
   * Check if actor is jailed
   * @param {string} actorUuid - Actor UUID
   * @returns {object} {jailed, regionId, releaseTime, remainingHours}
   */
  async getJailStatus(actorUuid) {
    const record = await this.getCriminalRecord(actorUuid);
    if (!record || !record.isJailed) {
      return { jailed: false };
    }

    const now = Date.now();
    const remainingMs = Math.max(0, record.jailReleaseTime - now);
    const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));

    // Auto-release if time served
    if (remainingMs <= 0) {
      await this.serveJailTime(actorUuid, record.jailRegionId, 0);
      return { jailed: false, released: true };
    }

    return {
      jailed: true,
      regionId: record.jailRegionId,
      releaseTime: record.jailReleaseTime,
      remainingHours
    };
  }

  // ==================== Bounty Decay ====================

  /**
   * Process bounty decay for all bounties
   */
  async processBountyDecay() {
    if (!game.user.isGM) return;

    for (const [bountyId, bounty] of this._bountyCache.entries()) {
      if (bounty.status !== BountyStatus.ACTIVE) continue;

      const jurisdiction = this.getJurisdiction(bounty.regionId);
      if (!jurisdiction) continue;

      const decayed = applyBountyDecay(bounty, jurisdiction);
      if (decayed.amount !== bounty.amount) {
        this._bountyCache.set(bountyId, decayed);

        if (decayed.status === BountyStatus.EXPIRED) {
          Hooks.callAll(`${MODULE_ID}.bountyExpired`, decayed);
        }
      }
    }

    await this._saveBounties();
  }

  // ==================== Guard Behavior ====================

  /**
   * Check if guards should attack on sight
   * @param {string} actorUuid - Actor UUID
   * @param {string} jurisdictionId - Jurisdiction ID
   * @returns {boolean}
   */
  async shouldAttackOnSight(actorUuid, jurisdictionId) {
    const jurisdiction = this.getJurisdiction(jurisdictionId);
    if (!jurisdiction || !jurisdiction.guardBehavior.attackOnSight) {
      return false;
    }

    const bounty = await this.getBountyInJurisdiction(actorUuid, jurisdictionId);
    if (!bounty || bounty.status !== BountyStatus.ACTIVE) {
      return false;
    }

    return bounty.amount >= jurisdiction.guardBehavior.attackOnSightThreshold;
  }

  /**
   * Get guard response level for an actor
   * @param {string} actorUuid - Actor UUID
   * @param {string} jurisdictionId - Jurisdiction ID
   * @returns {string} "none", "warn", "arrest", "attack"
   */
  async getGuardResponse(actorUuid, jurisdictionId) {
    const bounty = await this.getBountyInJurisdiction(actorUuid, jurisdictionId);
    if (!bounty || bounty.status !== BountyStatus.ACTIVE) {
      return "none";
    }

    const jurisdiction = this.getJurisdiction(jurisdictionId);
    if (!jurisdiction) return "none";

    if (await this.shouldAttackOnSight(actorUuid, jurisdictionId)) {
      return "attack";
    }

    if (bounty.amount >= 100) {
      return "arrest";
    }

    return "warn";
  }

  // ==================== Wanted Posters ====================

  /**
   * Create wanted poster for bounty
   * @param {string} bountyId - Bounty ID
   * @param {object} posterData - Poster configuration
   * @returns {object}
   */
  async createWantedPoster(bountyId, posterData = {}) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    const bounty = this._bountyCache.get(bountyId);
    if (!bounty) {
      throw new Error(localize("Errors.BountyNotFound"));
    }

    bounty.poster = {
      enabled: true,
      description: posterData.description || "",
      reward: posterData.reward ?? bounty.amount,
      deadOrAlive: posterData.deadOrAlive ?? false
    };

    this._bountyCache.set(bountyId, bounty);
    await this._saveBounties();

    Hooks.callAll(`${MODULE_ID}.wantedPosterCreated`, bounty);
    return bounty;
  }

  // ==================== Crime Queries ====================

  /**
   * Get crime by ID
   * @param {string} crimeId - Crime ID
   * @returns {object|null}
   */
  getCrime(crimeId) {
    return this._crimeCache.get(crimeId) || null;
  }

  /**
   * Get all crimes for an actor
   * @param {string} actorUuid - Actor UUID
   * @returns {object[]}
   */
  getCrimesForActor(actorUuid) {
    const crimes = [];
    for (const crime of this._crimeCache.values()) {
      if (crime.perpetratorUuid === actorUuid) {
        crimes.push(crime);
      }
    }
    return crimes.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get recent crimes in jurisdiction
   * @param {string} jurisdictionId - Jurisdiction ID
   * @param {number} limit - Max results
   * @returns {object[]}
   */
  getRecentCrimes(jurisdictionId, limit = 10) {
    const crimes = [];
    for (const crime of this._crimeCache.values()) {
      if (crime.regionId === jurisdictionId && crime.reported) {
        crimes.push(crime);
      }
    }
    return crimes
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // ==================== Socket Handling ====================

  /**
   * Emit socket event
   * @param {string} event - Event name
   * @param {object} data - Event data
   * @private
   */
  _emitSocket(event, data) {
    if (game.socket) {
      game.socket.emit(`module.${MODULE_ID}`, {
        type: `crime.${event}`,
        ...data
      });
    }
  }

  /**
   * Handle incoming socket events
   * @param {object} data - Socket data
   */
  async handleSocket(data) {
    const { type } = data;

    switch (type) {
      case "crime.crimeReported":
        if (!game.user.isGM) {
          await this._loadCrimes();
          await this._loadBounties();
        }
        break;

      case "crime.bountyPaid":
      case "crime.jailTimeServed":
      case "crime.pardonGranted":
        if (!game.user.isGM) {
          await this._loadBounties();
        }
        break;

      case "crime.actorArrested":
        Hooks.callAll(`${MODULE_ID}.actorArrested`, data.actorUuid, data.jurisdictionId, data.jailHours);
        break;

      case "crime.jurisdictionCreated":
      case "crime.jurisdictionUpdated":
        if (!game.user.isGM) {
          await this._loadJurisdictions();
        }
        break;
    }
  }

  // ==================== Data Export/Import ====================

  /**
   * Export all crime data
   * @returns {object}
   */
  exportData() {
    return {
      jurisdictions: Object.fromEntries(this._jurisdictionCache),
      bounties: Object.fromEntries(this._bountyCache),
      crimes: Object.fromEntries(this._crimeCache)
    };
  }

  /**
   * Import crime data
   * @param {object} data - Import data
   */
  async importData(data) {
    if (!game.user.isGM) {
      throw new Error(localize("Errors.GMOnly"));
    }

    if (data.jurisdictions) {
      this._jurisdictionCache.clear();
      for (const [id, jurisdiction] of Object.entries(data.jurisdictions)) {
        this._jurisdictionCache.set(id, jurisdiction);
      }
      await this._saveJurisdictions();
    }

    if (data.bounties) {
      this._bountyCache.clear();
      for (const [id, bounty] of Object.entries(data.bounties)) {
        this._bountyCache.set(id, bounty);
      }
      await this._saveBounties();
    }

    if (data.crimes) {
      this._crimeCache.clear();
      for (const [id, crime] of Object.entries(data.crimes)) {
        this._crimeCache.set(id, crime);
      }
      await this._saveCrimes();
    }
  }
}

// Singleton instance
export const crimeHandler = new CrimeHandler();
