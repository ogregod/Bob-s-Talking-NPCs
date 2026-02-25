/**
 * Bob's Talking NPCs - Faction Members Manager
 * Dedicated window for viewing and managing all members of a faction
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";
import { ReputationLevel } from "../data/faction-model.mjs";

function getFactionHandler() {
  return game.bobsnpc?.handlers?.faction;
}

function getMerchantHandler() {
  return game.bobsnpc?.handlers?.merchant;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class FactionMembersManager extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} faction - Full faction data object
   * @param {object} options - Application options
   */
  constructor(faction, options = {}) {
    super(options);
    this._faction = faction;
    this._search = "";
    this._sortBy = "name";    // name, rank, role, reputation
    this._sortDir = "asc";
    this._searchTimeout = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-faction-members",
    classes: ["bobsnpc", "faction-members-manager"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.FactionMembers.Title",
      icon: "fa-solid fa-users",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 960,
      height: 650
    },
    actions: {
      addMember: FactionMembersManager.#onAddMember,
      removeMember: FactionMembersManager.#onRemoveMember,
      openActorSheet: FactionMembersManager.#onOpenActorSheet,
      modifyReputation: FactionMembersManager.#onModifyReputation,
      sortBy: FactionMembersManager.#onSortBy
    }
  };

  /** @override */
  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/faction-members/manager.hbs`,
      scrollable: [".members-table-body"]
    }
  };

  /** @override */
  get title() {
    return `${this._faction.name} — Members`;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const handler = getFactionHandler();
    const merchantHandler = getMerchantHandler();

    // Gather all member data
    const allMembers = await this._gatherMembers(handler, merchantHandler);

    // Filter by search
    const filtered = this._search
      ? allMembers.filter(m => m.name.toLowerCase().includes(this._search.toLowerCase()))
      : allMembers;

    // Sort
    const members = this._sortMembers(filtered);

    // Build unaffiliated actor list for "Add Member" dropdown
    const memberActorIds = new Set(allMembers.map(m => m.actorId));
    const unaffiliated = (game.actors || [])
      .filter(a => !memberActorIds.has(a.id))
      .map(a => ({ id: a.id, name: a.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      ...context,
      faction: this._faction,
      factionColor: this._faction.color || "#666666",
      members,
      memberCount: allMembers.length,
      availableRanks: this._faction.ranks || [],
      availableRoles: this._faction.roles || [],
      unaffiliated,
      search: this._search,
      sortBy: this._sortBy,
      sortDir: this._sortDir,
      isGM: game.user.isGM,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /**
   * Gather all members of this faction from actor flags
   * @param {object} handler - Faction handler
   * @param {object} merchantHandler - Merchant handler
   * @returns {Promise<object[]>}
   * @private
   */
  async _gatherMembers(handler, merchantHandler) {
    const roleMap = new Map((this._faction.roles || []).map(r => [r.id, r]));
    const rankMap = new Map((this._faction.ranks || []).map(r => [r.id, r]));

    // Find all actors that have this faction in their config
    const memberEntries = [];
    for (const actor of game.actors || []) {
      const cfg = actor.getFlag(MODULE_ID, "config");
      if (!cfg) continue;
      const fList = Array.isArray(cfg.factions)
        ? cfg.factions
        : Object.values(cfg.factions || {});
      const entry = fList.find(f => f.factionId === this._faction.id);
      if (entry) {
        memberEntries.push({ actor, entry });
      }
    }

    // Fetch all standings in parallel
    const members = await Promise.all(memberEntries.map(async ({ actor, entry }) => {
      // Reputation from handler
      let reputation = 0;
      let reputationLevel = ReputationLevel.NEUTRAL;
      if (handler) {
        try {
          const standing = await handler.getStanding?.(actor.uuid, this._faction.id);
          reputation = standing?.reputation ?? 0;
        } catch (e) {
          // Fallback if handler fails
          reputation = 0;
        }
        reputationLevel = handler.getReputationLevel?.(reputation) ?? ReputationLevel.NEUTRAL;
      }

      // Role and rank resolution
      const role = entry.roleId ? roleMap.get(entry.roleId) : null;
      const rank = entry.rank ? rankMap.get(entry.rank) : null;

      // Business lookup via existing getMerchantForNPC method
      const merchant = merchantHandler?.getMerchantForNPC?.(actor.uuid) ?? null;

      // Rank sort order (for sorting by rank prestige)
      const rankOrder = rank
        ? (this._faction.ranks || []).findIndex(r => r.id === rank.id)
        : 9999;

      // Pre-build rank options for this member (avoids fragile Handlebars ../ scoping)
      const currentRankId = entry.rank || "";
      const rankOptions = (this._faction.ranks || []).map(r => ({
        id: r.id,
        name: r.name,
        selected: r.id === currentRankId
      }));

      // Pre-build role options for this member
      const currentRoleId = entry.roleId || "";
      const roleOptions = (this._faction.roles || []).map(r => ({
        id: r.id,
        name: r.name,
        selected: r.id === currentRoleId
      }));

      return {
        actorId: actor.id,
        actorUuid: actor.uuid,
        name: actor.name,
        img: actor.img,
        // Rank
        rankId: currentRankId,
        rankName: rank?.name || "—",
        rankColor: rank?.color || null,
        rankIcon: rank?.icon || null,
        rankOrder,
        rankOptions,
        // Role
        roleId: currentRoleId,
        roleName: role?.name || "—",
        roleColor: role?.color || null,
        roleIcon: role?.icon || null,
        isLeader: role?.permissions?.isLeader || false,
        roleOptions,
        // Reputation
        reputation,
        reputationLevel,
        reputationLevelLabel: localize(`ReputationLevel.${reputationLevel}`),
        // Business
        merchantId: merchant?.id || null,
        businessName: merchant?.name || null
      };
    }));

    // Leaders first, then alphabetical by default
    return members;
  }

  /**
   * Sort members array
   * @param {object[]} members
   * @returns {object[]}
   * @private
   */
  _sortMembers(members) {
    return [...members].sort((a, b) => {
      let result;
      switch (this._sortBy) {
        case "rank":
          result = a.rankOrder - b.rankOrder || a.name.localeCompare(b.name);
          break;
        case "role":
          result = (a.roleName === "—" ? "zzz" : a.roleName).localeCompare(
            b.roleName === "—" ? "zzz" : b.roleName
          );
          break;
        case "reputation":
          result = b.reputation - a.reputation; // Higher rep first when ascending
          break;
        case "name":
        default:
          result = a.name.localeCompare(b.name);
      }
      // Leaders always float to top regardless of sort
      if (a.isLeader && !b.isLeader) return -1;
      if (!a.isLeader && b.isLeader) return 1;
      return this._sortDir === "asc" ? result : -result;
    });
  }

  // ==================== Inline Field Change Handling ====================

  /**
   * Re-attach change listeners after every render.
   * Mirrors the bank-editor pattern: call _setupMemberListeners from _onRender,
   * use only public methods in event callbacks (no private method access from closures).
   * @override
   */
  _onRender(context, options) {
    super._onRender(context, options);
    this._setupMemberListeners();
  }

  /**
   * Attach change listeners to inline selects and the search input.
   * Called after every render so fresh DOM elements are covered.
   */
  _setupMemberListeners() {
    this.element.querySelectorAll("select[data-member-action]").forEach(select => {
      select.addEventListener("change", (event) => this._onMemberSelectChange(event));
    });

    const searchInput = this.element.querySelector(".member-search");
    if (searchInput) {
      searchInput.addEventListener("input", (event) => {
        clearTimeout(this._searchTimeout);
        this._searchTimeout = setTimeout(() => {
          this._search = event.target.value;
          this.render();
        }, 300);
      });
    }
  }

  /**
   * Handle a change on an inline rank or role select.
   * @param {Event} event
   */
  _onMemberSelectChange(event) {
    const { memberAction, actorId } = event.target.dataset;
    const value = event.target.value;
    if (!actorId || !memberAction) return;
    if (memberAction === "changeRank") this._updateMemberField(actorId, "rank", value);
    else if (memberAction === "changeRole") this._updateMemberField(actorId, "roleId", value);
  }

  /**
   * Update a single field on an actor's faction entry
   * @param {string} actorId
   * @param {string} field - "rank" or "roleId"
   * @param {string} value
   * @private
   */
  async _updateMemberField(actorId, field, value) {
    try {
      const actor = game.actors.get(actorId);
      if (!actor) {
        console.error(`FactionMembersManager: actor ${actorId} not found`);
        return;
      }

      const cfg = foundry.utils.deepClone(actor.getFlag(MODULE_ID, "config") || {});
      let fList = Array.isArray(cfg.factions)
        ? cfg.factions
        : Object.values(cfg.factions || {});
      const idx = fList.findIndex(f => f.factionId === this._faction.id);
      if (idx === -1) {
        console.error(`FactionMembersManager: faction entry ${this._faction.id} not found on actor ${actor.name}`);
        return;
      }

      fList[idx] = { ...fList[idx], [field]: value };
      cfg.factions = fList;

      await actor.setFlag(MODULE_ID, "config", cfg);
      this.render();
    } catch (err) {
      console.error("FactionMembersManager: failed to update member field", err);
      ui.notifications.error(`Failed to save: ${err.message}`);
    }
  }

  // ==================== Actions ====================

  static #onSortBy(event, target) {
    const newSort = target.dataset.sort;
    if (newSort === this._sortBy) {
      // Toggle direction
      this._sortDir = this._sortDir === "asc" ? "desc" : "asc";
    } else {
      this._sortBy = newSort;
      this._sortDir = "asc";
    }
    this.render();
  }

  static async #onAddMember(event, target) {
    const select = this.element.querySelector("select[name='newMemberActorId']");
    const actorId = select?.value;
    if (!actorId) {
      ui.notifications.warn(game.i18n.localize("BOBSNPC.FactionMembers.SelectActorFirst"));
      return;
    }

    const actor = game.actors.get(actorId);
    if (!actor) return;

    const cfg = foundry.utils.deepClone(actor.getFlag(MODULE_ID, "config") || {});
    const fList = Array.isArray(cfg.factions)
      ? cfg.factions
      : Object.values(cfg.factions || {});

    // Don't add if already a member
    if (fList.find(f => f.factionId === this._faction.id)) {
      ui.notifications.warn(game.i18n.localize("BOBSNPC.FactionMembers.AlreadyMember"));
      return;
    }

    fList.push({ factionId: this._faction.id, rank: "", roleId: "" });
    cfg.factions = fList;
    await actor.setFlag(MODULE_ID, "config", cfg);

    ui.notifications.info(game.i18n.format("BOBSNPC.FactionMembers.Added", { name: actor.name, faction: this._faction.name }));
    this.render();
  }

  static async #onRemoveMember(event, target) {
    const actorId = target.dataset.actorId;
    const actorName = target.dataset.actorName;

    const confirmed = await Dialog.confirm({
      title: game.i18n.localize("BOBSNPC.FactionMembers.RemoveTitle"),
      content: game.i18n.format("BOBSNPC.FactionMembers.RemoveConfirm", {
        name: actorName,
        faction: this._faction.name
      })
    });
    if (!confirmed) return;

    const actor = game.actors.get(actorId);
    if (!actor) return;

    const cfg = foundry.utils.deepClone(actor.getFlag(MODULE_ID, "config") || {});
    const fList = Array.isArray(cfg.factions)
      ? cfg.factions
      : Object.values(cfg.factions || {});
    cfg.factions = fList.filter(f => f.factionId !== this._faction.id);
    await actor.setFlag(MODULE_ID, "config", cfg);

    ui.notifications.info(game.i18n.format("BOBSNPC.FactionMembers.Removed", { name: actorName }));
    this.render();
  }

  static #onOpenActorSheet(event, target) {
    const actorId = target.dataset.actorId;
    const actor = game.actors.get(actorId);
    actor?.sheet?.render(true);
  }

  static async #onModifyReputation(event, target) {
    const actorId = target.dataset.actorId;
    const actorUuid = target.dataset.actorUuid;
    const actorName = target.dataset.actorName;
    const handler = getFactionHandler();

    const content = `
      <div class="form-group">
        <label>${game.i18n.localize("BOBSNPC.FactionMembers.RepChange")}</label>
        <input type="number" name="repChange" value="0" style="width: 100%; text-align: center;" />
        <p class="hint">${game.i18n.format("BOBSNPC.FactionMembers.RepHint", { name: actorName, faction: this._faction.name })}</p>
      </div>
    `;

    const result = await Dialog.prompt({
      title: game.i18n.format("BOBSNPC.FactionMembers.ModifyRepTitle", { name: actorName }),
      content,
      label: game.i18n.localize("BOBSNPC.Common.Apply"),
      callback: (html) => parseInt(html.find("[name='repChange']").val()) || 0,
      rejectClose: false
    });

    if (result !== null && result !== undefined && handler?.modifyReputation) {
      await handler.modifyReputation(actorUuid, this._faction.id, result);
      this.render();
    }
  }

  // ==================== Static Factory ====================

  /**
   * Open the members manager for a faction
   * @param {object} faction - Faction data object
   * @returns {FactionMembersManager}
   */
  static open(faction) {
    const manager = new FactionMembersManager(faction);
    manager.render(true);
    return manager;
  }
}
