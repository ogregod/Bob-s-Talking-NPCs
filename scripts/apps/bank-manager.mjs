/**
 * Bob's Talking NPCs - Banking Management System
 * GM tool for creating and managing banks across the world
 */

// Define MODULE_ID locally to avoid circular dependency
const MODULE_ID = "bobs-talking-npcs";

import { localize, formatCurrency } from "../utils/helpers.mjs";
import {
  createBank, AccountType, TransactionType, LoanStatus, BankNetworkType,
  toCopper, copperToGold, goldToCurrency
} from "../data/bank-model.mjs";
import { getCurrentGameTime } from "../data/service-request-model.mjs";

/** Get bank handler instance from API */
function getBankHandler() {
  return game.bobsnpc?.handlers?.bank;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Banking Management Application
 * Allows GMs to create, edit, and manage banks across the world
 */
export class BankingManager extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);

    this._activeTab = "banks";  // banks, create, edit, branches, settings
    this._selectedBankId = null;
    this._editingBank = null;
    this._filterFaction = null;
    this._filterScene = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-bank-manager",
    classes: ["bobsnpc", "bank-manager"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.BankManager.Title",
      icon: "fa-solid fa-landmark",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 900,
      height: 700
    },
    actions: {
      setTab: BankingManager.#onSetTab,
      selectBank: BankingManager.#onSelectBank,
      createBank: BankingManager.#onCreateBank,
      editBank: BankingManager.#onEditBank,
      deleteBank: BankingManager.#onDeleteBank,
      saveBank: BankingManager.#onSaveBank,
      cancelEdit: BankingManager.#onCancelEdit,
      createBranch: BankingManager.#onCreateBranch,
      removeBranch: BankingManager.#onRemoveBranch,
      assignNPC: BankingManager.#onAssignNPC,
      removeNPC: BankingManager.#onRemoveNPC,
      viewAccounts: BankingManager.#onViewAccounts,
      importTemplate: BankingManager.#onImportTemplate,
      filterByFaction: BankingManager.#onFilterByFaction,
      filterByScene: BankingManager.#onFilterByScene,
      clearFilters: BankingManager.#onClearFilters
    }
  };

  /** @override */
  static PARTS = {
    header: {
      template: `modules/${MODULE_ID}/templates/bank/manager-header.hbs`
    },
    tabs: {
      template: `modules/${MODULE_ID}/templates/bank/manager-tabs.hbs`
    },
    content: {
      template: `modules/${MODULE_ID}/templates/bank/manager-content.hbs`
    }
  };

  /** @override */
  async _prepareContext(options) {
    const handler = getBankHandler();
    if (!handler) {
      return {
        activeTab: this._activeTab,
        banks: [],
        error: "Banking system not initialized"
      };
    }

    const context = {
      activeTab: this._activeTab,
      isGM: game.user.isGM,
      MODULE_ID
    };

    // Get all banks
    const allBanks = handler.getAllBanks();

    // Apply filters
    let filteredBanks = allBanks;
    if (this._filterFaction) {
      filteredBanks = filteredBanks.filter(b => b.factionId === this._filterFaction);
    }
    if (this._filterScene) {
      filteredBanks = filteredBanks.filter(b => b.location?.sceneId === this._filterScene);
    }

    switch (this._activeTab) {
      case "banks":
        context.isBanksTab = true;
        context.banks = await this._prepareBanksList(filteredBanks);
        context.hasFilters = this._filterFaction || this._filterScene;
        context.factionOptions = await this._getFactionOptions();
        context.sceneOptions = this._getSceneOptions();
        break;

      case "create":
      case "edit":
        context.isEditTab = true;
        context.isCreating = this._activeTab === "create";
        context.bank = await this._prepareBankForEdit();
        context.factionOptions = await this._getFactionOptions();
        context.sceneOptions = this._getSceneOptions();
        context.npcOptions = await this._getNPCOptions();
        context.parentBankOptions = this._getParentBankOptions(allBanks);
        context.networkTypeOptions = this._getNetworkTypeOptions();
        break;

      case "branches":
        context.isBranchesTab = true;
        if (this._selectedBankId) {
          const selectedBank = handler.getBank(this._selectedBankId);
          context.selectedBank = await this._prepareBankWithBranches(selectedBank);
        }
        context.banks = await this._prepareBanksList(allBanks.filter(b => !b.isBranch));
        break;

      case "settings":
        context.isSettingsTab = true;
        context.globalSettings = this._prepareGlobalSettings();
        break;
    }

    return context;
  }

  /**
   * Prepare list of banks for display
   * @private
   */
  async _prepareBanksList(banks) {
    const handler = getBankHandler();

    return Promise.all(banks.map(async bank => {
      const accountCount = bank.accountIds?.length || 0;
      const loanCount = bank.loanIds?.length || 0;
      const branchCount = bank.branchIds?.length || 0;

      // Get faction info if assigned
      let factionInfo = null;
      if (bank.factionId && game.bobsnpc?.handlers?.faction) {
        try {
          const faction = await game.bobsnpc.handlers.faction.getFaction(bank.factionId);
          if (faction) {
            factionInfo = {
              name: faction.name,
              icon: faction.icon || "fa-flag"
            };
          }
        } catch (e) {
          console.debug(`${MODULE_ID} | Faction not found: ${bank.factionId}`);
        }
      }

      // Get scene info
      let sceneInfo = null;
      if (bank.location?.sceneId) {
        const scene = game.scenes.get(bank.location.sceneId);
        if (scene) {
          sceneInfo = {
            name: scene.name,
            thumb: scene.thumb || scene.background?.src
          };
        }
      }

      // Get banker NPCs
      const bankers = (bank.bankerNpcUuids || []).length;

      return {
        ...bank,
        accountCount,
        loanCount,
        branchCount,
        hasBranches: branchCount > 0,
        isBranch: bank.isBranch ?? false,
        factionInfo,
        sceneInfo,
        bankerCount: bankers,
        isSelected: bank.id === this._selectedBankId,
        networkLabel: bank.network?.type === "global" ? "Global Network" : "Local Bank",
        networkClass: bank.network?.type === "global" ? "global" : "local",
        savingsRate: `${((bank.rates?.savingsInterest || 0) * 100).toFixed(1)}%`,
        loanRate: `${((bank.rates?.loanInterest || 0) * 100).toFixed(1)}%`,
        totalReserves: formatCurrency(copperToGold(toCopper(bank.reserves || {}))),
        canEdit: true,
        canDelete: accountCount === 0 && loanCount === 0  // Only delete if no active accounts/loans
      };
    }));
  }

  /**
   * Prepare bank with branch information
   * @private
   */
  async _prepareBankWithBranches(bank) {
    if (!bank) return null;

    const handler = getBankHandler();
    const branches = [];

    for (const branchId of bank.branchIds || []) {
      const branch = handler.getBank(branchId);
      if (branch) {
        const scene = branch.location?.sceneId ? game.scenes.get(branch.location.sceneId) : null;
        branches.push({
          ...branch,
          sceneName: scene?.name || "Unknown Location",
          bankerCount: (branch.bankerNpcUuids || []).length,
          accountCount: (branch.accountIds || []).length
        });
      }
    }

    return {
      ...bank,
      branches,
      branchCount: branches.length
    };
  }

  /**
   * Prepare bank data for editing
   * @private
   */
  async _prepareBankForEdit() {
    if (this._activeTab === "create") {
      // Return default template for new bank
      return {
        name: "",
        description: "",
        icon: "fa-landmark",
        color: "#4caf50",
        network: { type: "local" },
        factionId: null,
        location: {
          sceneId: null,
          region: "",
          npcActorUuid: null
        },
        services: {
          deposits: true,
          withdrawals: true,
          transfers: true,
          currencyExchange: true,
          loans: true,
          safeDeposit: false
        },
        fees: {
          transferFee: 0.01,
          exchangeFee: 0.05,
          loanOriginationFee: 0.02
        },
        rates: {
          savingsInterest: 0.01,
          loanInterest: 0.1
        },
        loans: {
          enabled: true,
          maxLoanAmount: 10000,
          minLoanAmount: 50,
          requiresCollateral: false
        },
        interBranchFees: {
          enabled: true,
          transferFee: 5,
          itemRetrievalFee: 10
        },
        lockBoxPolicy: {
          branchSpecific: true,
          allowRemoteAccess: false,
          remoteAccessFee: 10
        }
      };
    } else if (this._editingBank) {
      return {
        ...this._editingBank
      };
    }
    return null;
  }

  /**
   * Get faction options for dropdown
   * @private
   */
  async _getFactionOptions() {
    const options = [{ value: "", label: "None (Independent Bank)" }];

    if (game.bobsnpc?.handlers?.faction?.getAllFactions) {
      try {
        const factions = await game.bobsnpc.handlers.faction.getAllFactions();
        for (const faction of factions) {
          options.push({
            value: faction.id,
            label: `${faction.name} (${faction.type || "Faction"})`
          });
        }
      } catch (e) {
        console.warn(`${MODULE_ID} | Could not load factions`);
      }
    }

    return options;
  }

  /**
   * Get scene options for dropdown
   * @private
   */
  _getSceneOptions() {
    const options = [{ value: "", label: "No Scene Assigned" }];

    for (const scene of game.scenes) {
      options.push({
        value: scene.id,
        label: scene.name
      });
    }

    return options;
  }

  /**
   * Get NPC options for banker assignment
   * @private
   */
  async _getNPCOptions() {
    const options = [];

    for (const actor of game.actors) {
      if (actor.type === "npc") {
        options.push({
          value: actor.uuid,
          label: `${actor.name} (${actor.system?.details?.race || "NPC"})`
        });
      }
    }

    return options;
  }

  /**
   * Get parent bank options (for creating branches)
   * @private
   */
  _getParentBankOptions(allBanks) {
    const options = [{ value: "", label: "None (Independent Bank)" }];

    // Only allow non-branch banks as parents
    const parentBanks = allBanks.filter(b => !b.isBranch);

    for (const bank of parentBanks) {
      options.push({
        value: bank.id,
        label: `${bank.name} (${bank.branchIds?.length || 0} branches)`
      });
    }

    return options;
  }

  /**
   * Get network type options
   * @private
   */
  _getNetworkTypeOptions() {
    return [
      { value: "local", label: "Local Bank" },
      { value: "global", label: "Global Network" }
    ];
  }

  /**
   * Prepare global banking settings
   * @private
   */
  _prepareGlobalSettings() {
    return {
      defaultSavingsRate: 0.01,
      defaultLoanRate: 0.1,
      defaultTransferFee: 0.01,
      enableBanking: game.settings?.get(MODULE_ID, "enableBanking") ?? true
    };
  }

  // ========================================================================
  // ACTION HANDLERS
  // ========================================================================

  /**
   * Set active tab
   * @private
   */
  static async #onSetTab(event, target) {
    this._activeTab = target.dataset.tab || "banks";
    this.render();
  }

  /**
   * Select a bank from the list
   * @private
   */
  static async #onSelectBank(event, target) {
    this._selectedBankId = target.dataset.bankId;
    this.render();
  }

  /**
   * Create new bank
   * @private
   */
  static async #onCreateBank(event, target) {
    this._activeTab = "create";
    this._editingBank = null;
    this.render();
  }

  /**
   * Edit existing bank
   * @private
   */
  static async #onEditBank(event, target) {
    const bankId = target.dataset.bankId || this._selectedBankId;
    if (!bankId) return;

    const handler = getBankHandler();
    const bank = handler.getBank(bankId);
    if (!bank) return;

    this._editingBank = bank;
    this._selectedBankId = bankId;
    this._activeTab = "edit";
    this.render();
  }

  /**
   * Delete a bank
   * @private
   */
  static async #onDeleteBank(event, target) {
    const bankId = target.dataset.bankId;
    if (!bankId) return;

    const handler = getBankHandler();
    const bank = handler.getBank(bankId);
    if (!bank) return;

    const confirmed = await Dialog.confirm({
      title: "Delete Bank",
      content: `
        <p>Are you sure you want to delete <strong>${bank.name}</strong>?</p>
        ${bank.accountIds?.length > 0 ? `<p class="notification error">This bank has ${bank.accountIds.length} active accounts!</p>` : ""}
        ${bank.branchIds?.length > 0 ? `<p class="notification warning">This bank has ${bank.branchIds.length} branches that will also be deleted!</p>` : ""}
      `,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });

    if (!confirmed) return;

    try {
      await handler.deleteBank(bankId);
      ui.notifications.info(`Bank "${bank.name}" deleted`);
      this._selectedBankId = null;
      this.render();
    } catch (error) {
      ui.notifications.error(`Failed to delete bank: ${error.message}`);
    }
  }

  /**
   * Save bank (create or update)
   * @private
   */
  static async #onSaveBank(event, target) {
    const form = this.element.querySelector("form.bank-edit-form");
    if (!form) return;

    const formData = new FormData(form);
    const handler = getBankHandler();

    try {
      // Build bank data from form
      const bankData = {
        name: formData.get("name"),
        description: formData.get("description"),
        icon: formData.get("icon") || "fa-landmark",
        color: formData.get("color") || "#4caf50",

        factionId: formData.get("factionId") || null,

        location: {
          sceneId: formData.get("sceneId") || null,
          region: formData.get("region") || "",
          npcActorUuid: null
        },

        network: {
          type: formData.get("networkType") || "local",
          networkId: formData.get("networkId") || null,
          networkName: formData.get("networkName") || null
        },

        parentBankId: formData.get("parentBankId") || null,
        isBranch: !!formData.get("parentBankId"),

        services: {
          deposits: formData.get("deposits") === "on",
          withdrawals: formData.get("withdrawals") === "on",
          transfers: formData.get("transfers") === "on",
          currencyExchange: formData.get("currencyExchange") === "on",
          loans: formData.get("loans") === "on",
          safeDeposit: formData.get("safeDeposit") === "on"
        },

        fees: {
          transferFee: parseFloat(formData.get("transferFee")) || 0.01,
          exchangeFee: parseFloat(formData.get("exchangeFee")) || 0.05,
          loanOriginationFee: parseFloat(formData.get("loanOriginationFee")) || 0.02
        },

        rates: {
          savingsInterest: parseFloat(formData.get("savingsInterest")) || 0.01,
          loanInterest: parseFloat(formData.get("loanInterest")) || 0.1
        },

        loans: {
          enabled: formData.get("loansEnabled") === "on",
          maxLoanAmount: parseInt(formData.get("maxLoanAmount")) || 10000,
          minLoanAmount: parseInt(formData.get("minLoanAmount")) || 50,
          requiresCollateral: formData.get("requiresCollateral") === "on"
        },

        interBranchFees: {
          enabled: formData.get("interBranchFeesEnabled") === "on",
          transferFee: parseInt(formData.get("interBranchTransferFee")) || 5,
          itemRetrievalFee: parseInt(formData.get("itemRetrievalFee")) || 10
        },

        lockBoxPolicy: {
          branchSpecific: formData.get("branchSpecific") === "on",
          allowRemoteAccess: formData.get("allowRemoteAccess") === "on",
          remoteAccessFee: parseInt(formData.get("remoteAccessFee")) || 10
        },

        bankerNpcUuids: this._editingBank?.bankerNpcUuids || []
      };

      let result;
      if (this._activeTab === "create") {
        // Create new bank
        result = await handler.createBank(bankData);
        ui.notifications.info(`Bank "${bankData.name}" created!`);
      } else {
        // Update existing bank
        await handler.updateBank(this._editingBank.id, bankData);
        result = { bank: { ...this._editingBank, ...bankData } };
        ui.notifications.info(`Bank "${bankData.name}" updated!`);
      }

      // If this is a branch, add to parent's branch list
      if (bankData.parentBankId && result.bank) {
        const parent = handler.getBank(bankData.parentBankId);
        if (parent) {
          const branchIds = new Set(parent.branchIds || []);
          branchIds.add(result.bank.id);
          await handler.updateBank(parent.id, { branchIds: Array.from(branchIds) });
        }
      }

      this._activeTab = "banks";
      this._editingBank = null;
      this.render();

    } catch (error) {
      ui.notifications.error(`Failed to save bank: ${error.message}`);
      console.error(error);
    }
  }

  /**
   * Cancel editing
   * @private
   */
  static async #onCancelEdit(event, target) {
    this._activeTab = "banks";
    this._editingBank = null;
    this.render();
  }

  /**
   * Create a new branch of selected bank
   * @private
   */
  static async #onCreateBranch(event, target) {
    const bankId = target.dataset.bankId || this._selectedBankId;
    if (!bankId) return;

    const handler = getBankHandler();
    const parent = handler.getBank(bankId);
    if (!parent) return;

    // Create branch based on parent settings
    this._editingBank = {
      ...parent,
      id: undefined,  // New ID will be generated
      name: `${parent.name} - Branch`,
      parentBankId: parent.id,
      isBranch: true,
      branchIds: [],
      accountIds: [],
      loanIds: [],
      location: {
        sceneId: null,
        region: "",
        npcActorUuid: null
      },
      bankerNpcUuids: []
    };

    this._activeTab = "create";
    this.render();
  }

  /**
   * Remove a branch from parent bank
   * @private
   */
  static async #onRemoveBranch(event, target) {
    const branchId = target.dataset.branchId;
    const parentId = target.dataset.parentId || this._selectedBankId;

    if (!branchId || !parentId) return;

    const handler = getBankHandler();
    const branch = handler.getBank(branchId);
    const parent = handler.getBank(parentId);

    if (!branch || !parent) return;

    const confirmed = await Dialog.confirm({
      title: "Remove Branch",
      content: `
        <p>Remove <strong>${branch.name}</strong> from <strong>${parent.name}</strong>?</p>
        ${branch.accountIds?.length > 0 ? `<p class="notification warning">This branch has ${branch.accountIds.length} active accounts!</p>` : ""}
      `,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });

    if (!confirmed) return;

    // Remove from parent's branch list
    const branchIds = (parent.branchIds || []).filter(id => id !== branchId);
    await handler.updateBank(parentId, { branchIds });

    // Delete the branch bank
    await handler.deleteBank(branchId);

    ui.notifications.info(`Branch "${branch.name}" removed`);
    this.render();
  }

  /**
   * Assign NPC as banker
   * @private
   */
  static async #onAssignNPC(event, target) {
    const bankId = this._editingBank?.id;
    if (!bankId) return;

    const npcSelector = await Dialog.prompt({
      title: "Assign Banker NPC",
      content: `
        <form>
          <div class="form-group">
            <label>Select NPC</label>
            <select name="npcUuid" required>
              ${game.actors.filter(a => a.type === "npc").map(npc =>
                `<option value="${npc.uuid}">${npc.name}</option>`
              ).join("")}
            </select>
          </div>
        </form>
      `,
      callback: (html) => html.querySelector('select[name="npcUuid"]')?.value,
      rejectClose: false
    });

    if (!npcSelector) return;

    this._editingBank.bankerNpcUuids = this._editingBank.bankerNpcUuids || [];
    if (!this._editingBank.bankerNpcUuids.includes(npcSelector)) {
      this._editingBank.bankerNpcUuids.push(npcSelector);
      this.render();
    }
  }

  /**
   * Remove NPC from bankers
   * @private
   */
  static async #onRemoveNPC(event, target) {
    const npcUuid = target.dataset.npcUuid;
    if (!npcUuid || !this._editingBank) return;

    this._editingBank.bankerNpcUuids = (this._editingBank.bankerNpcUuids || [])
      .filter(uuid => uuid !== npcUuid);

    this.render();
  }

  /**
   * View accounts at this bank
   * @private
   */
  static async #onViewAccounts(event, target) {
    const bankId = target.dataset.bankId;
    if (!bankId) return;

    // TODO: Open account viewer for this bank
    ui.notifications.info("Account viewer coming soon!");
  }

  /**
   * Import bank from template
   * @private
   */
  static async #onImportTemplate(event, target) {
    // TODO: Implement template import
    ui.notifications.info("Template import coming soon!");
  }

  /**
   * Filter banks by faction
   * @private
   */
  static async #onFilterByFaction(event, target) {
    this._filterFaction = target.value || null;
    this.render();
  }

  /**
   * Filter banks by scene
   * @private
   */
  static async #onFilterByScene(event, target) {
    this._filterScene = target.value || null;
    this.render();
  }

  /**
   * Clear all filters
   * @private
   */
  static async #onClearFilters(event, target) {
    this._filterFaction = null;
    this._filterScene = null;
    this.render();
  }

  /**
   * Open the banking manager
   * @returns {BankingManager}
   */
  static async open() {
    const manager = new BankingManager();
    await manager.render(true);
    return manager;
  }
}
