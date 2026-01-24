/**
 * Bob's Talking NPCs - Bank Window
 * Banking interface for deposits, withdrawals, loans, and safe deposit boxes
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";

import { localize, formatCurrency } from "../utils/helpers.mjs";
import { bankHandler } from "../handlers/bank-handler.mjs";
import { AccountType, TransactionType } from "../data/bank-model.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Bank Window Application
 * Displays banking services with account management
 */
export class BankWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options - Application options
   * @param {string} options.bankId - Bank NPC UUID
   * @param {string} options.playerActorUuid - Player actor UUID
   */
  constructor(options = {}) {
    super(options);

    this.bankId = options.bankId;
    this.playerActorUuid = options.playerActorUuid;

    this._bankActor = null;
    this._playerActor = null;
    this._session = null;
    this._sessionId = null;

    this._tab = "accounts"; // accounts, deposit, withdraw, transfer, loans, storage
    this._selectedAccountId = null;
    this._amount = 0;
    this._transferTargetId = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-bank",
    classes: ["bobsnpc", "bank-window"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.Bank.Title",
      icon: "fa-solid fa-landmark",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 700,
      height: 600
    },
    actions: {
      setTab: BankWindow.#onSetTab,
      selectAccount: BankWindow.#onSelectAccount,
      openAccount: BankWindow.#onOpenAccount,
      deposit: BankWindow.#onDeposit,
      withdraw: BankWindow.#onWithdraw,
      transfer: BankWindow.#onTransfer,
      requestLoan: BankWindow.#onRequestLoan,
      repayLoan: BankWindow.#onRepayLoan,
      rentBox: BankWindow.#onRentBox,
      accessBox: BankWindow.#onAccessBox,
      setAmount: BankWindow.#onSetAmount,
      setMax: BankWindow.#onSetMax,
      close: BankWindow.#onCloseBank
    }
  };

  /** @override */
  static PARTS = {
    header: {
      template: `modules/${MODULE_ID}/templates/bank/header.hbs`
    },
    tabs: {
      template: `modules/${MODULE_ID}/templates/bank/tabs.hbs`
    },
    content: {
      template: `modules/${MODULE_ID}/templates/bank/content.hbs`,
      scrollable: [".bank-content"]
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/bank/footer.hbs`
    }
  };

  /** @override */
  get title() {
    return this._bankActor?.name || localize("Bank.Title");
  }

  /** @override */
  async _preFirstRender(context, options) {
    await super._preFirstRender(context, options);

    // Load actors
    this._bankActor = await fromUuid(this.bankId);
    this._playerActor = await fromUuid(this.playerActorUuid);

    if (!this._bankActor) {
      throw new Error(localize("Errors.ActorNotFound"));
    }

    // Open bank session
    const result = await bankHandler.openBank(this.bankId, this.playerActorUuid);
    this._session = result.session;
    this._sessionId = result.sessionId;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const bank = bankHandler.getBank(this.bankId);
    const playerAccounts = await bankHandler.getPlayerAccounts(this.playerActorUuid, this.bankId);
    const playerGold = this._getPlayerGold();

    // Select first account if none selected
    if (!this._selectedAccountId && playerAccounts.length > 0) {
      this._selectedAccountId = playerAccounts[0].id;
    }

    const selectedAccount = playerAccounts.find(a => a.id === this._selectedAccountId);

    // Get loans if any
    const loans = await bankHandler.getPlayerLoans(this.playerActorUuid, this.bankId);

    // Get safe deposit boxes
    const boxes = await bankHandler.getPlayerBoxes(this.playerActorUuid, this.bankId);

    // Prepare context based on tab
    let tabContent = {};
    switch (this._tab) {
      case "accounts":
        tabContent = this._prepareAccountsTab(playerAccounts, bank);
        break;
      case "deposit":
      case "withdraw":
        tabContent = this._prepareTransactionTab(selectedAccount, playerGold);
        break;
      case "transfer":
        tabContent = await this._prepareTransferTab(selectedAccount, playerAccounts);
        break;
      case "loans":
        tabContent = this._prepareLoansTab(loans, bank);
        break;
      case "storage":
        tabContent = this._prepareStorageTab(boxes, bank);
        break;
    }

    return {
      ...context,
      bank: {
        name: this._bankActor.name,
        portrait: this._bankActor.img,
        uuid: this.bankId,
        interestRate: bank?.interestRate ?? 0.01,
        interestRateFormatted: `${((bank?.interestRate ?? 0.01) * 100).toFixed(1)}%`,
        loanRate: bank?.loanRate ?? 0.05,
        loanRateFormatted: `${((bank?.loanRate ?? 0.05) * 100).toFixed(1)}%`,
        transferFee: bank?.transferFee ?? 0.01,
        transferFeeFormatted: `${((bank?.transferFee ?? 0.01) * 100).toFixed(1)}%`
      },
      player: {
        name: this._playerActor?.name,
        uuid: this.playerActorUuid,
        gold: playerGold,
        goldFormatted: formatCurrency(playerGold)
      },
      tab: this._tab,
      accounts: playerAccounts.map(a => this._prepareAccount(a)),
      selectedAccount: selectedAccount ? this._prepareAccount(selectedAccount) : null,
      selectedAccountId: this._selectedAccountId,
      hasAccounts: playerAccounts.length > 0,
      loans: loans.map(l => this._prepareLoan(l)),
      hasLoans: loans.length > 0,
      boxes: boxes.map(b => this._prepareBox(b)),
      hasBoxes: boxes.length > 0,
      amount: this._amount,
      amountFormatted: formatCurrency(this._amount),
      ...tabContent,
      services: {
        checking: bank?.services?.checking ?? true,
        savings: bank?.services?.savings ?? true,
        loans: bank?.services?.loans ?? true,
        safeDeposit: bank?.services?.safeDeposit ?? true,
        transfer: bank?.services?.transfer ?? true
      },
      isGM: game.user.isGM,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /**
   * Prepare account for display
   * @param {object} account - Account data
   * @returns {object}
   * @private
   */
  _prepareAccount(account) {
    return {
      ...account,
      balanceFormatted: formatCurrency(account.balance),
      typeLabel: localize(`AccountType.${account.type}`),
      typeIcon: account.type === AccountType.SAVINGS ? "fa-piggy-bank" : "fa-wallet",
      isSelected: account.id === this._selectedAccountId,
      lastActivity: account.lastTransaction ?
        new Date(account.lastTransaction).toLocaleDateString() : localize("Bank.NoActivity")
    };
  }

  /**
   * Prepare loan for display
   * @param {object} loan - Loan data
   * @returns {object}
   * @private
   */
  _prepareLoan(loan) {
    const dueDate = new Date(loan.dueDate);
    const isOverdue = Date.now() > loan.dueDate;

    return {
      ...loan,
      principalFormatted: formatCurrency(loan.principal),
      remainingFormatted: formatCurrency(loan.remaining),
      paymentFormatted: formatCurrency(loan.paymentAmount),
      dueDate: dueDate.toLocaleDateString(),
      isOverdue,
      statusClass: isOverdue ? "overdue" : loan.remaining <= loan.paymentAmount ? "nearly-paid" : ""
    };
  }

  /**
   * Prepare safe deposit box for display
   * @param {object} box - Box data
   * @returns {object}
   * @private
   */
  _prepareBox(box) {
    const paidUntil = new Date(box.paidUntil);
    const isExpiring = (box.paidUntil - Date.now()) < 7 * 24 * 60 * 60 * 1000; // Less than 7 days

    return {
      ...box,
      sizeLabel: localize(`BoxSize.${box.size}`),
      paidUntilDate: paidUntil.toLocaleDateString(),
      isExpiring,
      itemCount: box.items?.length || 0,
      capacityUsed: `${box.items?.length || 0}/${box.capacity}`
    };
  }

  /**
   * Prepare accounts tab content
   * @param {object[]} accounts - Player accounts
   * @param {object} bank - Bank data
   * @returns {object}
   * @private
   */
  _prepareAccountsTab(accounts, bank) {
    const accountTypes = [];

    if (bank?.services?.checking) {
      accountTypes.push({
        type: AccountType.CHECKING,
        label: localize("AccountType.checking"),
        description: localize("Bank.CheckingDescription"),
        minDeposit: bank.minimumDeposit?.checking ?? 0,
        icon: "fa-wallet"
      });
    }

    if (bank?.services?.savings) {
      accountTypes.push({
        type: AccountType.SAVINGS,
        label: localize("AccountType.savings"),
        description: localize("Bank.SavingsDescription", {
          rate: ((bank.interestRate ?? 0.01) * 100).toFixed(1)
        }),
        minDeposit: bank.minimumDeposit?.savings ?? 100,
        icon: "fa-piggy-bank"
      });
    }

    return {
      accountTypes,
      totalBalance: accounts.reduce((sum, a) => sum + a.balance, 0),
      totalBalanceFormatted: formatCurrency(accounts.reduce((sum, a) => sum + a.balance, 0))
    };
  }

  /**
   * Prepare transaction tab content
   * @param {object} account - Selected account
   * @param {number} playerGold - Player's gold
   * @returns {object}
   * @private
   */
  _prepareTransactionTab(account, playerGold) {
    const isDeposit = this._tab === "deposit";

    return {
      maxAmount: isDeposit ? playerGold : (account?.balance || 0),
      maxAmountFormatted: formatCurrency(isDeposit ? playerGold : (account?.balance || 0)),
      actionLabel: isDeposit ? localize("Bank.Deposit") : localize("Bank.Withdraw"),
      actionIcon: isDeposit ? "fa-arrow-down" : "fa-arrow-up"
    };
  }

  /**
   * Prepare transfer tab content
   * @param {object} sourceAccount - Source account
   * @param {object[]} accounts - All player accounts
   * @returns {object}
   * @private
   */
  async _prepareTransferTab(sourceAccount, accounts) {
    // Get other players' accounts for transfer
    const otherPlayers = game.actors.filter(a =>
      a.hasPlayerOwner && a.uuid !== this.playerActorUuid
    );

    const transferTargets = [
      // Own accounts
      ...accounts
        .filter(a => a.id !== this._selectedAccountId)
        .map(a => ({
          id: a.id,
          label: `${localize("Bank.OwnAccount")}: ${a.name}`,
          type: "own"
        })),
      // Other players
      ...otherPlayers.map(p => ({
        id: p.uuid,
        label: p.name,
        type: "player"
      }))
    ];

    return {
      transferTargets,
      hasTransferTargets: transferTargets.length > 0,
      selectedTarget: this._transferTargetId
    };
  }

  /**
   * Prepare loans tab content
   * @param {object[]} loans - Player loans
   * @param {object} bank - Bank data
   * @returns {object}
   * @private
   */
  _prepareLoansTab(loans, bank) {
    const playerGold = this._getPlayerGold();
    const accounts = bankHandler.getPlayerAccounts(this.playerActorUuid, this.bankId);
    const totalAssets = playerGold + accounts.reduce((sum, a) => sum + a.balance, 0);

    // Calculate max loan amount (typically based on assets or fixed limit)
    const maxLoan = Math.min(
      bank?.maxLoanAmount ?? 10000,
      totalAssets * (bank?.loanToValueRatio ?? 2)
    );

    return {
      canRequestLoan: loans.filter(l => l.remaining > 0).length === 0,
      maxLoanAmount: maxLoan,
      maxLoanFormatted: formatCurrency(maxLoan),
      totalOwed: loans.reduce((sum, l) => sum + l.remaining, 0),
      totalOwedFormatted: formatCurrency(loans.reduce((sum, l) => sum + l.remaining, 0))
    };
  }

  /**
   * Prepare storage tab content
   * @param {object[]} boxes - Player boxes
   * @param {object} bank - Bank data
   * @returns {object}
   * @private
   */
  _prepareStorageTab(boxes, bank) {
    const availableSizes = [
      {
        size: "small",
        label: localize("BoxSize.small"),
        capacity: 10,
        price: bank?.boxPrices?.small ?? 10,
        priceFormatted: formatCurrency(bank?.boxPrices?.small ?? 10)
      },
      {
        size: "medium",
        label: localize("BoxSize.medium"),
        capacity: 25,
        price: bank?.boxPrices?.medium ?? 25,
        priceFormatted: formatCurrency(bank?.boxPrices?.medium ?? 25)
      },
      {
        size: "large",
        label: localize("BoxSize.large"),
        capacity: 50,
        price: bank?.boxPrices?.large ?? 50,
        priceFormatted: formatCurrency(bank?.boxPrices?.large ?? 50)
      }
    ];

    return {
      availableSizes,
      canRentMore: boxes.length < (bank?.maxBoxesPerPlayer ?? 3)
    };
  }

  /**
   * Get player gold amount
   * @returns {number}
   * @private
   */
  _getPlayerGold() {
    if (!this._playerActor) return 0;

    const currency = this._playerActor.system.currency;
    if (!currency) return 0;

    return (
      (currency.pp || 0) * 10 +
      (currency.gp || 0) +
      (currency.ep || 0) * 0.5 +
      (currency.sp || 0) * 0.1 +
      (currency.cp || 0) * 0.01
    );
  }

  // ==================== Actions ====================

  static #onSetTab(event, target) {
    this._tab = target.dataset.tab;
    this._amount = 0;
    this.render();
  }

  static #onSelectAccount(event, target) {
    this._selectedAccountId = target.dataset.accountId;
    this.render();
  }

  static async #onOpenAccount(event, target) {
    const accountType = target.dataset.accountType;

    try {
      const result = await bankHandler.openAccount(
        this.bankId,
        this.playerActorUuid,
        { type: accountType }
      );

      if (result.success) {
        ui.notifications.info(localize("Bank.AccountOpened"));
        this._selectedAccountId = result.account.id;
        this.render();
      } else {
        ui.notifications.error(result.error);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onDeposit(event, target) {
    if (this._amount <= 0 || !this._selectedAccountId) return;

    try {
      const result = await bankHandler.depositFunds(
        this._selectedAccountId,
        this._amount,
        this.playerActorUuid
      );

      if (result.success) {
        ui.notifications.info(localize("Bank.DepositSuccess", {
          amount: formatCurrency(this._amount)
        }));
        this._amount = 0;
        this.render();
      } else {
        ui.notifications.error(result.error);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onWithdraw(event, target) {
    if (this._amount <= 0 || !this._selectedAccountId) return;

    try {
      const result = await bankHandler.withdrawFunds(
        this._selectedAccountId,
        this._amount,
        this.playerActorUuid
      );

      if (result.success) {
        ui.notifications.info(localize("Bank.WithdrawSuccess", {
          amount: formatCurrency(this._amount)
        }));
        this._amount = 0;
        this.render();
      } else {
        ui.notifications.error(result.error);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onTransfer(event, target) {
    if (this._amount <= 0 || !this._selectedAccountId || !this._transferTargetId) return;

    try {
      const result = await bankHandler.transferFunds(
        this._selectedAccountId,
        this._transferTargetId,
        this._amount
      );

      if (result.success) {
        ui.notifications.info(localize("Bank.TransferSuccess", {
          amount: formatCurrency(this._amount)
        }));
        this._amount = 0;
        this._transferTargetId = null;
        this.render();
      } else {
        ui.notifications.error(result.error);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onRequestLoan(event, target) {
    if (this._amount <= 0) return;

    try {
      const result = await bankHandler.requestLoan(
        this.bankId,
        this.playerActorUuid,
        this._amount
      );

      if (result.success) {
        ui.notifications.info(localize("Bank.LoanApproved", {
          amount: formatCurrency(this._amount)
        }));
        this._amount = 0;
        this._tab = "accounts";
        this.render();
      } else {
        ui.notifications.error(result.error);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onRepayLoan(event, target) {
    const loanId = target.dataset.loanId;
    if (!loanId) return;

    try {
      const result = await bankHandler.repayLoan(
        loanId,
        this.playerActorUuid,
        this._amount > 0 ? this._amount : null
      );

      if (result.success) {
        ui.notifications.info(localize("Bank.LoanPayment", {
          amount: formatCurrency(result.paid)
        }));
        this._amount = 0;
        this.render();
      } else {
        ui.notifications.error(result.error);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onRentBox(event, target) {
    const size = target.dataset.size;
    if (!size) return;

    try {
      const result = await bankHandler.rentSafeDepositBox(
        this.bankId,
        this.playerActorUuid,
        size
      );

      if (result.success) {
        ui.notifications.info(localize("Bank.BoxRented"));
        this.render();
      } else {
        ui.notifications.error(result.error);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onAccessBox(event, target) {
    const boxId = target.dataset.boxId;
    if (!boxId) return;

    // Open safe deposit box interface
    // This would open a container-like interface for managing items
    ui.notifications.info(localize("Bank.BoxAccessed"));
  }

  static #onSetAmount(event, target) {
    this._amount = Math.max(0, parseInt(target.value) || 0);
  }

  static #onSetMax(event, target) {
    const maxAmount = parseFloat(target.dataset.max) || 0;
    this._amount = Math.floor(maxAmount);
    this.render();
  }

  static async #onCloseBank(event, target) {
    await this.close();
  }

  /** @override */
  async _onClose(options) {
    await super._onClose(options);

    // Close bank session
    if (this._sessionId) {
      await bankHandler.closeBank(this._sessionId);
    }
  }

  // ==================== Static Factory ====================

  /**
   * Open bank window
   * @param {string} bankId - Bank NPC UUID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {BankWindow}
   */
  static async open(bankId, playerActorUuid) {
    const window = new BankWindow({ bankId, playerActorUuid });
    await window.render(true);
    return window;
  }
}
