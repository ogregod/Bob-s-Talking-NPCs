/**
 * Bob's Talking NPCs - Bank Editor
 * GM-facing application for configuring bank settings
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize, formatCurrency } from "../utils/helpers.mjs";
import { BankNetworkType, BankTemplates } from "../data/bank-model.mjs";

/** Get bank handler instance */
function getBankHandler() {
  return game.bobsnpc?.handlers?.bank;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Bank Editor Application
 * Allows GMs to configure bank properties, services, rates, and policies
 */
export class BankEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);

    this.bankId = options.bankId;
    this._bank = null;
    this._activeTab = "basic";
  }

  get id() {
    return `bobsnpc-bank-editor-${this.bankId || "new"}`;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["bobsnpc", "bank-editor"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.Bank.EditBank",
      icon: "fa-solid fa-landmark",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 680,
      height: 600
    },
    actions: {
      switchTab: BankEditor.#onSwitchTab,
      save: BankEditor.#onSave,
      cancel: BankEditor.#onCancel,
      applyTemplate: BankEditor.#onApplyTemplate
    }
  };

  /** @override */
  static PARTS = {
    navigation: {
      template: `modules/${MODULE_ID}/templates/bank-editor/navigation.hbs`
    },
    content: {
      template: `modules/${MODULE_ID}/templates/bank-editor/content.hbs`,
      scrollable: [".editor-content"]
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/bank-editor/footer.hbs`
    }
  };

  /** @override */
  get title() {
    return this._bank?.name
      ? `${localize("Bank.EditBank")}: ${this._bank.name}`
      : localize("Bank.EditBank");
  }

  /** @override */
  async _preFirstRender(context, options) {
    await super._preFirstRender(context, options);
    await this._loadBankData();
  }

  async _loadBankData() {
    if (this.bankId) {
      this._bank = foundry.utils.deepClone(getBankHandler()?.getBank(this.bankId));
    }
    if (!this._bank) {
      this._bank = this._getDefaultBank();
    }
  }

  _getDefaultBank() {
    return {
      name: "New Bank",
      description: "",
      icon: "fa-landmark",
      color: "#4caf50",
      network: {
        type: BankNetworkType.LOCAL,
        networkId: null,
        networkName: null
      },
      services: {
        deposits: true,
        withdrawals: true,
        transfers: true,
        currencyExchange: false,
        loans: true,
        safeDeposit: false
      },
      rates: {
        savingsInterest: 0.01,
        loanInterest: 0.1
      },
      fees: {
        depositFee: 0,
        withdrawalFee: 0,
        transferFee: 0.01,
        accountMaintenanceFee: 0
      },
      loans: {
        enabled: true,
        minLoanAmount: 50,
        maxLoanAmount: 10000,
        maxLoanTerm: 52,
        defaultThreshold: 3,
        requiresCollateral: false,
        requiresGMApproval: true
      },
      safeDeposit: {
        enabled: false,
        boxPriceSmall: 10,
        boxPriceMedium: 25,
        boxPriceLarge: 50,
        rentalPeriod: "month",
        maxBoxesPerPlayer: 3
      },
      access: {
        minimumDeposit: 0,
        requiredFaction: null,
        requiredReputation: 0
      }
    };
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const bank = this._bank;

    // Tab configuration
    const tabs = [
      { id: "basic", label: localize("BankEditor.TabBasic") || "Basic", icon: "fa-info-circle", active: this._activeTab === "basic" },
      { id: "services", label: localize("BankEditor.TabServices") || "Services", icon: "fa-cogs", active: this._activeTab === "services" },
      { id: "fees", label: localize("BankEditor.TabFees") || "Fees & Rates", icon: "fa-percentage", active: this._activeTab === "fees" },
      { id: "loans", label: localize("BankEditor.TabLoans") || "Loans", icon: "fa-file-invoice-dollar", active: this._activeTab === "loans" },
      { id: "storage", label: localize("BankEditor.TabStorage") || "Storage", icon: "fa-vault", active: this._activeTab === "storage" },
      { id: "access", label: localize("BankEditor.TabAccess") || "Access", icon: "fa-shield-halved", active: this._activeTab === "access" }
    ];

    // Network type options
    const networkOptions = [
      { value: BankNetworkType.LOCAL, label: localize("Bank.LocalBank") || "Local Bank", selected: bank.network?.type === BankNetworkType.LOCAL },
      { value: BankNetworkType.GLOBAL, label: localize("Bank.GlobalNetwork") || "Global Network", selected: bank.network?.type === BankNetworkType.GLOBAL }
    ];

    // Template options
    const templateOptions = Object.keys(BankTemplates).map(key => ({
      value: key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
    }));

    // Rental period options
    const rentalPeriodOptions = [
      { value: "week", label: "Weekly", selected: bank.safeDeposit?.rentalPeriod === "week" },
      { value: "month", label: "Monthly", selected: bank.safeDeposit?.rentalPeriod === "month" },
      { value: "year", label: "Yearly", selected: bank.safeDeposit?.rentalPeriod === "year" }
    ];

    // Icon options
    const iconOptions = [
      { value: "fa-landmark", label: "Bank", selected: bank.icon === "fa-landmark" },
      { value: "fa-building-columns", label: "Columns", selected: bank.icon === "fa-building-columns" },
      { value: "fa-vault", label: "Vault", selected: bank.icon === "fa-vault" },
      { value: "fa-coins", label: "Coins", selected: bank.icon === "fa-coins" },
      { value: "fa-sack-dollar", label: "Money Sack", selected: bank.icon === "fa-sack-dollar" },
      { value: "fa-scale-balanced", label: "Scales", selected: bank.icon === "fa-scale-balanced" },
      { value: "fa-crown", label: "Crown", selected: bank.icon === "fa-crown" },
      { value: "fa-shield", label: "Shield", selected: bank.icon === "fa-shield" }
    ];

    return {
      ...context,
      bank,
      tabs,
      activeTab: this._activeTab,
      networkOptions,
      templateOptions,
      rentalPeriodOptions,
      iconOptions,
      isNewBank: !this.bankId,
      isGlobal: bank.network?.type === BankNetworkType.GLOBAL
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this._setupFormListeners();
  }

  _setupFormListeners() {
    const form = this.element;
    if (!form) return;

    form.querySelectorAll("input, select, textarea").forEach(input => {
      input.addEventListener("change", (event) => this._onInputChange(event));
    });
  }

  _onInputChange(event) {
    const input = event.target;
    const name = input.name;
    if (!name) return;

    let value;
    if (input.type === "checkbox") {
      value = input.checked;
    } else if (input.type === "number") {
      value = parseFloat(input.value) || 0;
    } else {
      value = input.value;
    }

    foundry.utils.setProperty(this._bank, name, value);
  }

  // ==================== Actions ====================

  static async #onSwitchTab(event, target) {
    const tabId = target.dataset.tab;
    if (tabId && tabId !== this._activeTab) {
      this._activeTab = tabId;
      await this.render();
    }
  }

  static async #onSave(event, target) {
    const bank = this._bank;

    if (!bank.name?.trim()) {
      ui.notifications.error(localize("BankEditor.NameRequired") || "Bank name is required.");
      return;
    }

    const handler = getBankHandler();
    if (!handler) {
      ui.notifications.error("Bank handler not available.");
      return;
    }

    if (this.bankId) {
      await handler.updateBank(this.bankId, bank);
      ui.notifications.info(`${bank.name} updated.`);
    } else {
      const result = await handler.createBank(bank);
      this.bankId = result.id;
      ui.notifications.info(`${bank.name} created.`);
    }

    await this.close();
  }

  static async #onCancel(event, target) {
    await this.close();
  }

  static async #onApplyTemplate(event, target) {
    const select = this.element.querySelector("select[name='template']");
    const templateName = select?.value;
    if (!templateName || !BankTemplates[templateName]) return;

    const template = BankTemplates[templateName];
    const keepFields = ["name", "description", "icon", "color", "network"];

    // Merge template while keeping identity fields
    const preserved = {};
    for (const field of keepFields) {
      preserved[field] = this._bank[field];
    }

    this._bank = {
      ...this._bank,
      ...template,
      ...preserved
    };

    ui.notifications.info(`Template "${templateName}" applied.`);
    await this.render();
  }
}
