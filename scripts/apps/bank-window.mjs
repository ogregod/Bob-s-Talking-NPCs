/**
 * Bob's Talking NPCs - Bank Window
 * Banking interface for deposits, withdrawals, loans, and safe deposit boxes
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";

import { localize, formatCurrency } from "../utils/helpers.mjs";
import {
  AccountType, TransactionType, LoanStatus, BankNetworkType,
  toCopper, copperToGold, addCurrency
} from "../data/bank-model.mjs";
import { getCurrentGameTime, formatDuration, formatDurationVerbose, GameTimeUnits } from "../data/service-request-model.mjs";

/** Get bank handler instance from API */
function getBankHandler() {
  return game.bobsnpc?.handlers?.bank;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Bank Window Application
 * Displays banking services with account management
 */
export class BankWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options - Application options
   * @param {string} options.bankId - Bank ID
   * @param {string} options.playerActorUuid - Player actor UUID
   */
  constructor(options = {}) {
    super(options);

    this.bankId = options.bankId;
    this.playerActorUuid = options.playerActorUuid;

    this._bankActor = null;
    this._playerActor = null;
    this._bank = null;
    this._session = null;
    this._sessionId = null;

    this._tab = "accounts"; // accounts, deposit, withdraw, transfer, loans, storage
    this._selectedAccountId = null;
    this._currencyAmount = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    this._loanAmount = 0;
    this._loanTerm = 12;
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
      width: 750,
      height: 650
    },
    actions: {
      setTab: BankWindow.#onSetTab,
      selectAccount: BankWindow.#onSelectAccount,
      openAccount: BankWindow.#onOpenAccount,
      confirmDeposit: BankWindow.#onDeposit,
      confirmWithdraw: BankWindow.#onWithdraw,
      confirmTransfer: BankWindow.#onTransfer,
      requestLoan: BankWindow.#onRequestLoan,
      repayLoan: BankWindow.#onRepayLoan,
      rentStorage: BankWindow.#onRentBox,
      storeItem: BankWindow.#onStoreItem,
      retrieveItem: BankWindow.#onRetrieveItem,
      setDepositAmount: BankWindow.#onQuickAmount,
      editBank: BankWindow.#onEditBank,
      processInterest: BankWindow.#onProcessInterest,
      closeBank: BankWindow.#onCloseBank
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
    return this._bank?.name || this._bankActor?.name || localize("Bank.Title");
  }

  /** @override */
  async _preFirstRender(context, options) {
    await super._preFirstRender(context, options);

    // Look up the bank data
    this._bank = getBankHandler()?.getBank(this.bankId);

    // Load the NPC actor associated with the bank
    if (this._bank?.location?.npcActorUuid) {
      this._bankActor = await fromUuid(this._bank.location.npcActorUuid);
    }

    // Load player actor
    this._playerActor = await fromUuid(this.playerActorUuid);

    // Open bank session
    const result = await getBankHandler()?.openBank(this.bankId, this.playerActorUuid);
    if (result) {
      this._session = result;
      this._sessionId = result.sessionId;
    }
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const bank = getBankHandler()?.getBank(this.bankId);
    if (!bank) return context;

    this._bank = bank;

    // Use network-aware methods for accounts, loans, boxes
    const playerAccounts = getBankHandler().getAccountsForPlayerAtBank(this.playerActorUuid, this.bankId);
    const playerCurrency = this._getPlayerCurrency();
    const playerGoldTotal = this._getPlayerGoldTotal();

    // Select first account if none selected
    if (!this._selectedAccountId && playerAccounts.length > 0) {
      this._selectedAccountId = playerAccounts[0].id;
    }

    const selectedAccount = playerAccounts.find(a => a.id === this._selectedAccountId);

    // Get loans and boxes
    const loans = getBankHandler().getLoansForPlayerAtBank(this.playerActorUuid, this.bankId);
    const boxes = getBankHandler().getSafeDepositBoxesForPlayerAtBank(this.playerActorUuid, this.bankId);

    // Prepare context based on tab
    let tabContent = {};
    switch (this._tab) {
      case "accounts":
        tabContent = this._prepareAccountsTab(playerAccounts, bank);
        break;
      case "deposit":
      case "withdraw":
        tabContent = this._prepareTransactionTab(selectedAccount, playerCurrency);
        break;
      case "transfer":
        tabContent = this._prepareTransferTab(selectedAccount, playerAccounts);
        break;
      case "loans":
        tabContent = this._prepareLoansTab(loans, bank, playerAccounts, playerGoldTotal);
        break;
      case "storage":
        tabContent = this._prepareStorageTab(boxes, bank);
        break;
    }

    // Compute totals
    const totalBalance = playerAccounts.reduce((sum, a) => sum + copperToGold(toCopper(a.balance)), 0);
    const totalDebt = loans.filter(l => l.status === LoanStatus.ACTIVE).reduce((sum, l) => sum + (l.remainingBalance || 0), 0);
    const activeLoans = loans.filter(l => l.status === LoanStatus.ACTIVE);

    return {
      ...context,
      // Bank info
      bankName: bank.name || this._bankActor?.name || localize("Bank.Title"),
      bankerName: this._bankActor?.name || null,
      bankIcon: bank.icon || "fa-landmark",
      bankColor: bank.color || "#4caf50",
      bankDescription: bank.description || "",

      // Network
      isLocal: bank.network?.type !== BankNetworkType.GLOBAL,
      isGlobal: bank.network?.type === BankNetworkType.GLOBAL,
      networkName: bank.network?.networkName || null,

      // Player
      playerName: this._playerActor?.name,
      playerGold: playerGoldTotal,
      playerGoldFormatted: formatCurrency(playerGoldTotal),
      playerCurrency,
      playerCurrencyTotal: formatCurrency(playerGoldTotal),

      // Tab state
      activeTab: this._tab,
      currencyAmount: this._currencyAmount,

      // Accounts
      accounts: playerAccounts.map(a => this._prepareAccount(a)),
      selectedAccount: selectedAccount ? this._prepareAccount(selectedAccount) : null,
      selectedAccountId: this._selectedAccountId,
      hasAccounts: playerAccounts.length > 0,
      accountCount: playerAccounts.length,

      // Balance summary
      totalBalance: totalBalance.toFixed(2),
      totalBalanceFormatted: formatCurrency(totalBalance),
      totalDebt: totalDebt.toFixed(2),
      totalDebtFormatted: formatCurrency(totalDebt),
      hasDebt: totalDebt > 0,

      // Loans
      loans: loans.map(l => this._prepareLoan(l)),
      activeLoans: activeLoans.map(l => this._prepareLoan(l)),
      hasLoans: loans.length > 0,
      hasActiveLoans: activeLoans.length > 0,
      loanCount: activeLoans.length,

      // Storage
      boxes: boxes.map(b => this._prepareBox(b)),
      hasBoxes: boxes.length > 0,
      storedItemCount: boxes.reduce((sum, b) => sum + (b.items?.length || 0), 0),

      // Services config
      services: {
        deposits: bank.services?.deposits ?? true,
        withdrawals: bank.services?.withdrawals ?? true,
        transfers: bank.services?.transfers ?? true,
        currencyExchange: bank.services?.currencyExchange ?? false,
        loans: bank.services?.loans ?? true,
        safeDeposit: bank.services?.safeDeposit ?? false
      },
      loansEnabled: bank.services?.loans ?? true,
      storageEnabled: bank.services?.safeDeposit ?? false,

      // Rates display
      savingsRate: bank.rates?.savingsInterest ?? 0.01,
      savingsRateFormatted: `${((bank.rates?.savingsInterest ?? 0.01) * 100).toFixed(1)}%`,
      loanRate: bank.rates?.loanInterest ?? 0.1,
      loanRateFormatted: `${((bank.rates?.loanInterest ?? 0.1) * 100).toFixed(1)}%`,
      transferFee: bank.fees?.transferFee ?? 0.01,
      transferFeeFormatted: `${((bank.fees?.transferFee ?? 0.01) * 100).toFixed(1)}%`,
      withdrawalFee: bank.fees?.withdrawalFee ?? 0,
      withdrawalFeeFormatted: `${((bank.fees?.withdrawalFee ?? 0) * 100).toFixed(1)}%`,

      // Interest payout
      interestPayoutDate: this._getNextInterestDate(bank),

      // Tab-specific content
      ...tabContent,

      // Meta
      isGM: game.user.isGM,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  // ==================== Context Helpers ====================

  /**
   * Get player's full currency breakdown
   * @returns {object} {pp, gp, ep, sp, cp}
   * @private
   */
  _getPlayerCurrency() {
    if (!this._playerActor) return { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    const c = this._playerActor.system?.currency || {};
    return {
      pp: c.pp || 0,
      gp: c.gp || 0,
      ep: c.ep || 0,
      sp: c.sp || 0,
      cp: c.cp || 0
    };
  }

  /**
   * Get player's total gold equivalent
   * @returns {number}
   * @private
   */
  _getPlayerGoldTotal() {
    const c = this._getPlayerCurrency();
    return copperToGold(toCopper(c));
  }

  /**
   * Format a currency object for display
   * @param {object} currency - {cp, sp, ep, gp, pp}
   * @returns {object}
   * @private
   */
  _formatCurrencyBreakdown(currency) {
    return {
      pp: currency.pp || 0,
      gp: currency.gp || 0,
      ep: currency.ep || 0,
      sp: currency.sp || 0,
      cp: currency.cp || 0,
      totalGold: copperToGold(toCopper(currency)),
      totalFormatted: formatCurrency(copperToGold(toCopper(currency)))
    };
  }

  /**
   * Get next interest payout date as a formatted string
   * @param {object} bank - Bank config
   * @returns {string|null}
   * @private
   */
  _getNextInterestDate(bank) {
    if (!bank.rates?.savingsInterest) return null;

    const handler = getBankHandler();
    const accounts = handler?.getAccountsForPlayerAtBank(this.playerActorUuid, this.bankId) || [];
    const savingsAccount = accounts.find(a => a.interest?.enabled);
    if (!savingsAccount) return null;

    const periodSeconds = savingsAccount.interest.period === "week"
      ? GameTimeUnits.WEEK
      : savingsAccount.interest.period === "year"
        ? GameTimeUnits.DAY * 365
        : GameTimeUnits.DAY * 30;

    const lastAccrual = savingsAccount.interest.lastAccrual || savingsAccount.openedAt || 0;
    const nextPayout = lastAccrual + periodSeconds;
    const now = getCurrentGameTime();
    const timeUntil = nextPayout - now;

    if (timeUntil <= 0) return localize("Bank.InterestReady") || "Ready";
    return formatDurationVerbose(timeUntil);
  }

  /**
   * Prepare account for display
   * @param {object} account - Account data
   * @returns {object}
   * @private
   */
  _prepareAccount(account) {
    const balanceBreakdown = this._formatCurrencyBreakdown(account.balance);
    const isChecking = account.type === AccountType.PERSONAL || account.type === AccountType.PARTY;
    const isSavings = account.type === AccountType.SAVINGS;

    // Format transactions for display (most recent 20, newest first)
    const formattedTransactions = (account.transactions || []).slice(-20).reverse().map(t => ({
      ...t,
      dateFormatted: this._formatGameTime(t.timestamp),
      typeIcon: t.type === TransactionType.DEPOSIT ? "fa-arrow-down"
        : t.type === TransactionType.WITHDRAWAL ? "fa-arrow-up"
        : t.type === TransactionType.TRANSFER ? "fa-exchange-alt"
        : t.type === TransactionType.INTEREST ? "fa-percentage"
        : "fa-receipt",
      typeClass: t.type === "deposit" ? "credit" : t.type === "interest" ? "interest" : "debit",
      isCredit: t.type === "deposit" || t.type === "interest",
      amountFormatted: `${(t.type === "deposit" || t.type === "interest") ? "+" : "-"}${formatCurrency(Math.abs(t.amount))}`,
      balanceAfterFormatted: typeof t.balanceAfter === "object"
        ? formatCurrency(copperToGold(toCopper(t.balanceAfter)))
        : formatCurrency(t.balanceAfter || 0)
    }));

    return {
      ...account,
      balance: balanceBreakdown,
      balanceFormatted: balanceBreakdown.totalFormatted,
      typeLabel: isSavings ? localize("Bank.Savings") : localize("Bank.Checking"),
      typeIcon: isSavings ? "fa-piggy-bank" : "fa-wallet",
      typeClass: isSavings ? "savings" : "checking",
      isSelected: account.id === this._selectedAccountId,
      accountNumber: account.accountNumber || "---",
      interestRate: account.interest?.enabled ? `${(account.interest.rate * 100).toFixed(1)}%` : null,
      hasInterest: account.interest?.enabled ?? false,
      lastActivity: this._formatGameTime(account.updatedAt),
      formattedTransactions,
      hasTransactions: formattedTransactions.length > 0
    };
  }

  /**
   * Prepare loan for display
   * @param {object} loan - Loan data
   * @returns {object}
   * @private
   */
  _prepareLoan(loan) {
    const now = getCurrentGameTime();
    const isOverdue = loan.nextPaymentDue ? now > loan.nextPaymentDue : false;
    const timeUntilDue = loan.nextPaymentDue ? loan.nextPaymentDue - now : 0;
    const progressPercent = loan.totalDue > 0 ? Math.round((loan.amountPaid / loan.totalDue) * 100) : 0;

    return {
      ...loan,
      principalFormatted: formatCurrency(loan.principal),
      totalDueFormatted: formatCurrency(loan.totalDue),
      amountPaidFormatted: formatCurrency(loan.amountPaid),
      remainingFormatted: formatCurrency(loan.remainingBalance),
      paymentFormatted: formatCurrency(loan.paymentAmount),
      interestRateFormatted: `${(loan.interestRate * 100).toFixed(1)}%`,
      dueDate: this._formatGameTime(loan.nextPaymentDue),
      isOverdue,
      daysRemaining: timeUntilDue > 0 ? Math.ceil(timeUntilDue / GameTimeUnits.DAY) : 0,
      daysRemainingLabel: timeUntilDue > 0 ? formatDuration(timeUntilDue) : localize("Bank.Overdue"),
      progressPercent,
      progressWidth: `${progressPercent}%`,
      statusLabel: loan.status === LoanStatus.ACTIVE ? localize("Bank.Active")
        : loan.status === LoanStatus.PAID ? localize("Bank.Paid")
        : loan.status === LoanStatus.DEFAULTED ? localize("Bank.Defaulted")
        : localize("Bank.Pending"),
      statusClass: loan.status === LoanStatus.ACTIVE ? (isOverdue ? "overdue" : "active")
        : loan.status === LoanStatus.PAID ? "paid"
        : loan.status === LoanStatus.DEFAULTED ? "defaulted"
        : "pending",
      paymentsDisplay: `${loan.paymentsMade}/${loan.numberOfPayments}`
    };
  }

  /**
   * Prepare safe deposit box for display
   * @param {object} box - Box data
   * @returns {object}
   * @private
   */
  _prepareBox(box) {
    const now = getCurrentGameTime();
    const isExpiring = box.paidUntil ? (box.paidUntil - now) < GameTimeUnits.WEEK : false;
    const isExpired = box.paidUntil ? now > box.paidUntil : false;
    const timeUntilExpiry = box.paidUntil ? box.paidUntil - now : 0;

    return {
      ...box,
      sizeLabel: box.size === "large" ? localize("Bank.Large")
        : box.size === "medium" ? localize("Bank.Medium")
        : localize("Bank.Small"),
      sizeIcon: box.size === "large" ? "fa-vault" : box.size === "medium" ? "fa-box" : "fa-box-archive",
      paidUntilFormatted: timeUntilExpiry > 0 ? formatDurationVerbose(timeUntilExpiry) : localize("Bank.Expired"),
      isExpiring,
      isExpired,
      itemCount: box.items?.length || 0,
      maxSlots: box.maxSlots || 10,
      capacityUsed: `${box.items?.length || 0}/${box.maxSlots || 10}`,
      capacityPercent: Math.round(((box.items?.length || 0) / (box.maxSlots || 10)) * 100),
      canStoreMore: (box.items?.length || 0) < (box.maxSlots || 10),
      storedItems: (box.items || []).map((item, index) => ({
        ...item,
        index,
        name: item.data?.name || item.name || "Unknown Item",
        img: item.data?.img || item.img || "icons/svg/item-bag.svg"
      }))
    };
  }

  /**
   * Format a game time value to a readable string
   * @param {number} gameTime - Game time in seconds
   * @returns {string}
   * @private
   */
  _formatGameTime(gameTime) {
    if (!gameTime) return "---";
    const now = getCurrentGameTime();
    const diff = now - gameTime;
    if (diff < 0) return formatDuration(Math.abs(diff)) + " from now";
    if (diff < GameTimeUnits.MINUTE) return "Just now";
    return formatDuration(diff) + " ago";
  }

  // ==================== Tab Preparation ====================

  /**
   * Prepare accounts tab content
   * @param {object[]} accounts - Player accounts
   * @param {object} bank - Bank data
   * @returns {object}
   * @private
   */
  _prepareAccountsTab(accounts, bank) {
    const accountTypes = [];

    if (bank.services?.deposits !== false) {
      accountTypes.push({
        type: AccountType.PERSONAL,
        label: localize("Bank.Checking"),
        description: localize("Bank.CheckingDescription") || "Standard account for deposits and withdrawals. No fees, instant access.",
        minDeposit: bank.access?.minimumDeposit ?? 0,
        icon: "fa-wallet",
        typeClass: "checking"
      });
    }

    if (bank.rates?.savingsInterest > 0) {
      accountTypes.push({
        type: AccountType.SAVINGS,
        label: localize("Bank.Savings"),
        description: (localize("Bank.SavingsDescription") || "Earn {rate} interest per month on your balance.").replace("{rate}", `${((bank.rates?.savingsInterest ?? 0.01) * 100).toFixed(1)}%`),
        minDeposit: bank.access?.minimumDeposit ?? 0,
        icon: "fa-piggy-bank",
        typeClass: "savings",
        interestRate: `${((bank.rates?.savingsInterest ?? 0.01) * 100).toFixed(1)}%`
      });
    }

    // Check which types the player already has
    const hasChecking = accounts.some(a => a.type === AccountType.PERSONAL || a.type === AccountType.PARTY);
    const hasSavings = accounts.some(a => a.type === AccountType.SAVINGS);

    return {
      accountTypes: accountTypes.filter(t => {
        if (t.type === AccountType.PERSONAL && hasChecking) return false;
        if (t.type === AccountType.SAVINGS && hasSavings) return false;
        return true;
      }),
      canOpenAccount: accountTypes.length > 0 && (!hasChecking || !hasSavings),
      totalBalanceGold: accounts.reduce((sum, a) => sum + copperToGold(toCopper(a.balance)), 0)
    };
  }

  /**
   * Prepare deposit/withdraw tab content
   * @param {object} account - Selected account
   * @param {object} playerCurrency - Player's currency
   * @returns {object}
   * @private
   */
  _prepareTransactionTab(account, playerCurrency) {
    const isDeposit = this._tab === "deposit";
    const accountBalance = account ? this._formatCurrencyBreakdown(account.balance) : null;

    return {
      isDeposit,
      isWithdraw: !isDeposit,
      maxCurrency: isDeposit ? playerCurrency : (account?.balance || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }),
      accountBalance,
      selectedAccountBalance: accountBalance?.totalFormatted || "0 gp",
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
  _prepareTransferTab(sourceAccount, accounts) {
    const otherPlayers = game.actors?.filter(a =>
      a.hasPlayerOwner && a.uuid !== this.playerActorUuid
    ) || [];

    const transferTargets = [
      ...accounts
        .filter(a => a.id !== this._selectedAccountId)
        .map(a => ({
          id: a.id,
          label: `${a.name} (${formatCurrency(copperToGold(toCopper(a.balance)))})`,
          type: "own",
          group: localize("Bank.OwnAccounts") || "Your Accounts"
        })),
      ...otherPlayers.map(p => ({
        id: `player:${p.uuid}`,
        label: p.name,
        type: "player",
        group: localize("Bank.OtherPlayers") || "Other Players"
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
   * @param {object[]} accounts - Player accounts
   * @param {number} playerGold - Player's gold total
   * @returns {object}
   * @private
   */
  _prepareLoansTab(loans, bank, accounts, playerGold) {
    const totalAssets = playerGold + accounts.reduce((sum, a) => sum + copperToGold(toCopper(a.balance)), 0);
    const activeLoans = loans.filter(l => l.status === LoanStatus.ACTIVE);

    const maxLoan = Math.min(
      bank.loans?.maxLoanAmount ?? 10000,
      totalAssets * 2
    );
    const minLoan = bank.loans?.minLoanAmount ?? 50;

    return {
      canRequestLoan: activeLoans.length === 0 && (bank.loans?.enabled ?? true),
      loansAvailable: bank.loans?.enabled ?? true,
      maxLoanAmount: maxLoan,
      maxLoanFormatted: formatCurrency(maxLoan),
      minLoan,
      maxLoan,
      loanInterestRate: `${((bank.rates?.loanInterest ?? 0.1) * 100).toFixed(1)}%`,
      repaymentPeriod: `${bank.loans?.maxLoanTerm ?? 52} weeks`,
      totalOwed: activeLoans.reduce((sum, l) => sum + (l.remainingBalance || 0), 0),
      totalOwedFormatted: formatCurrency(activeLoans.reduce((sum, l) => sum + (l.remainingBalance || 0), 0))
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
        label: localize("Bank.Small") || "Small",
        capacity: 10,
        icon: "fa-box-archive",
        price: bank.safeDeposit?.boxPriceSmall ?? 10,
        priceFormatted: formatCurrency(bank.safeDeposit?.boxPriceSmall ?? 10),
        period: bank.safeDeposit?.rentalPeriod || "month"
      },
      {
        size: "medium",
        label: localize("Bank.Medium") || "Medium",
        capacity: 20,
        icon: "fa-box",
        price: bank.safeDeposit?.boxPriceMedium ?? 25,
        priceFormatted: formatCurrency(bank.safeDeposit?.boxPriceMedium ?? 25),
        period: bank.safeDeposit?.rentalPeriod || "month"
      },
      {
        size: "large",
        label: localize("Bank.Large") || "Large",
        capacity: 30,
        icon: "fa-vault",
        price: bank.safeDeposit?.boxPriceLarge ?? 50,
        priceFormatted: formatCurrency(bank.safeDeposit?.boxPriceLarge ?? 50),
        period: bank.safeDeposit?.rentalPeriod || "month"
      }
    ];

    return {
      availableSizes,
      canRentMore: boxes.length < 3,
      hasStorage: boxes.length > 0,
      storedItems: boxes.reduce((sum, b) => sum + (b.items?.length || 0), 0),
      storageCapacity: boxes.reduce((sum, b) => sum + (b.maxSlots || 10), 0),
      storageFee: formatCurrency(
        boxes.reduce((sum, b) => sum + (b.rentalPrice || 0), 0)
      ),
      storageRentalCost: formatCurrency(bank.safeDeposit?.boxPriceSmall ?? 10)
    };
  }

  // ==================== Currency Input Helper ====================

  /**
   * Read currency amounts from form inputs
   * @param {HTMLElement} container - Container element
   * @returns {object} {cp, sp, ep, gp, pp}
   * @private
   */
  _readCurrencyInputs(container) {
    const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    for (const denom of ["pp", "gp", "ep", "sp", "cp"]) {
      const input = container?.querySelector(`input[name="currency.${denom}"]`);
      if (input) {
        currency[denom] = Math.max(0, parseInt(input.value) || 0);
      }
    }
    return currency;
  }

  // ==================== Actions ====================

  static #onSetTab(event, target) {
    this._tab = target.dataset.tab;
    this._currencyAmount = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    this.render();
  }

  static #onSelectAccount(event, target) {
    this._selectedAccountId = target.dataset.accountId || target.closest("[data-account-id]")?.dataset.accountId;
    this.render();
  }

  static async #onOpenAccount(event, target) {
    const accountType = target.dataset.accountType;

    try {
      const result = await getBankHandler().openAccount(
        this.bankId,
        this.playerActorUuid,
        { type: accountType }
      );

      if (result.success) {
        ui.notifications.info(result.message || localize("Bank.Messages.AccountOpened") || "Account opened!");
        this._selectedAccountId = result.account.id;
        this.render();
      } else {
        ui.notifications.error(result.message);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onDeposit(event, target) {
    if (!this._selectedAccountId) return;

    // Read currency from form
    const contentEl = this.element?.querySelector(".bank-content") || this.element;
    const currency = this._readCurrencyInputs(contentEl);
    const totalCopper = toCopper(currency);

    if (totalCopper <= 0) {
      ui.notifications.warn(localize("Bank.Messages.NoAmount") || "Enter an amount to deposit.");
      return;
    }

    try {
      const result = await getBankHandler().depositFunds(
        this._selectedAccountId,
        currency,
        this.playerActorUuid
      );

      if (result.success) {
        const goldEquiv = copperToGold(totalCopper);
        ui.notifications.info((localize("Bank.Messages.Deposited") || "Deposited {amount}").replace("{amount}", formatCurrency(goldEquiv)));
        // Reload player actor to get updated currency
        this._playerActor = await fromUuid(this.playerActorUuid);
        this._currencyAmount = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        this.render();
      } else {
        ui.notifications.error(result.message);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onWithdraw(event, target) {
    if (!this._selectedAccountId) return;

    const contentEl = this.element?.querySelector(".bank-content") || this.element;
    const currency = this._readCurrencyInputs(contentEl);
    const totalCopper = toCopper(currency);

    if (totalCopper <= 0) {
      ui.notifications.warn(localize("Bank.Messages.NoAmount") || "Enter an amount to withdraw.");
      return;
    }

    try {
      const result = await getBankHandler().withdrawFunds(
        this._selectedAccountId,
        currency,
        this.playerActorUuid
      );

      if (result.success) {
        const goldEquiv = copperToGold(totalCopper);
        ui.notifications.info((localize("Bank.Messages.Withdrawn") || "Withdrew {amount}").replace("{amount}", formatCurrency(goldEquiv)));
        this._playerActor = await fromUuid(this.playerActorUuid);
        this._currencyAmount = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        this.render();
      } else {
        ui.notifications.error(result.message);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onTransfer(event, target) {
    if (!this._selectedAccountId) return;

    const contentEl = this.element?.querySelector(".bank-content") || this.element;
    const currency = this._readCurrencyInputs(contentEl);
    const totalCopper = toCopper(currency);

    if (totalCopper <= 0) return;

    // Get transfer target from select
    const targetSelect = contentEl.querySelector("select[name='transferTo']");
    const targetId = targetSelect?.value || this._transferTargetId;
    if (!targetId) {
      ui.notifications.warn(localize("Bank.Messages.SelectTarget") || "Select a transfer target.");
      return;
    }

    try {
      const result = await getBankHandler().transferFunds(
        this._selectedAccountId,
        targetId,
        currency,
        this.playerActorUuid
      );

      if (result.success) {
        const goldEquiv = copperToGold(totalCopper);
        ui.notifications.info((localize("Bank.Messages.Transferred") || "Transferred {amount}").replace("{amount}", formatCurrency(goldEquiv)));
        this._currencyAmount = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        this._transferTargetId = null;
        this.render();
      } else {
        ui.notifications.error(result.message);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onRequestLoan(event, target) {
    const contentEl = this.element?.querySelector(".bank-content") || this.element;
    const amountInput = contentEl.querySelector("input[name='loanAmount']");
    const amount = parseInt(amountInput?.value) || 0;

    if (amount <= 0) return;

    try {
      const result = await getBankHandler().requestLoan(
        this.bankId,
        this.playerActorUuid,
        amount
      );

      if (result.success) {
        ui.notifications.info((localize("Bank.Messages.LoanTaken") || "Loan of {amount} taken").replace("{amount}", formatCurrency(amount)));
        this._tab = "loans";
        this.render();
      } else {
        ui.notifications.error(result.message);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onRepayLoan(event, target) {
    const loanId = target.dataset.loanId;
    if (!loanId) return;

    const contentEl = this.element?.querySelector(".bank-content") || this.element;
    const amountInput = contentEl.querySelector(`input[name='repayAmount-${loanId}']`);
    const loan = getBankHandler()?.getLoan(loanId);
    const amount = parseInt(amountInput?.value) || loan?.paymentAmount || 0;

    if (amount <= 0) return;

    try {
      const result = await getBankHandler().makeLoanPayment(
        loanId,
        amount,
        this.playerActorUuid
      );

      if (result.success) {
        const message = result.isPaidOff
          ? (localize("Bank.Messages.LoanPaidOff") || "Loan fully repaid!")
          : (localize("Bank.Messages.LoanRepaid") || "Loan payment of {amount} made").replace("{amount}", formatCurrency(amount));
        ui.notifications.info(message);
        this._playerActor = await fromUuid(this.playerActorUuid);
        this.render();
      } else {
        ui.notifications.error(result.message);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onRentBox(event, target) {
    const size = target.dataset.size;
    if (!size) return;

    try {
      const result = await getBankHandler().rentSafeDepositBox(
        this.bankId,
        this.playerActorUuid,
        size
      );

      if (result.success) {
        ui.notifications.info(localize("Bank.Messages.BoxRented") || "Safe deposit box rented!");
        this._playerActor = await fromUuid(this.playerActorUuid);
        this.render();
      } else {
        ui.notifications.error(result.message);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onStoreItem(event, target) {
    const boxId = target.dataset.boxId;
    if (!boxId) return;

    // Let the player pick an item from their inventory
    const actor = this._playerActor;
    if (!actor) return;

    const items = actor.items.filter(i => i.type !== "class" && i.type !== "feat" && i.type !== "spell");
    if (items.length === 0) {
      ui.notifications.warn("No items to store.");
      return;
    }

    // Simple selection dialog
    const choices = items.map(i => `<option value="${i.id}">${i.name}</option>`).join("");
    const content = `<form><div class="form-group"><label>Select Item</label><select name="itemId">${choices}</select></div></form>`;

    const dialog = await Dialog.prompt({
      title: localize("Bank.StoreItem") || "Store Item",
      content,
      callback: (html) => html.querySelector("select[name='itemId']")?.value,
      rejectClose: false
    });

    if (!dialog) return;

    const item = actor.items.get(dialog);
    if (!item) return;

    try {
      const result = await getBankHandler().storeInBox(boxId, item.uuid, this.playerActorUuid);
      if (result.success) {
        ui.notifications.info(localize("Bank.Messages.ItemStored") || "Item stored!");
        this._playerActor = await fromUuid(this.playerActorUuid);
        this.render();
      } else {
        ui.notifications.error(result.message);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onRetrieveItem(event, target) {
    const boxId = target.dataset.boxId;
    const itemIndex = parseInt(target.dataset.itemIndex);
    if (!boxId || isNaN(itemIndex)) return;

    try {
      const result = await getBankHandler().retrieveFromBox(boxId, itemIndex, this.playerActorUuid);
      if (result.success) {
        ui.notifications.info(localize("Bank.Messages.ItemRetrieved") || "Item retrieved!");
        this._playerActor = await fromUuid(this.playerActorUuid);
        this.render();
      } else {
        ui.notifications.error(result.message);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static #onQuickAmount(event, target) {
    const amount = target.dataset.amount;
    if (amount === "all") {
      // Set all denominations to player's current amounts
      const currency = this._getPlayerCurrency();
      const contentEl = this.element?.querySelector(".bank-content") || this.element;
      for (const denom of ["pp", "gp", "ep", "sp", "cp"]) {
        const input = contentEl.querySelector(`input[name="currency.${denom}"]`);
        if (input) input.value = currency[denom];
      }
    } else {
      const gp = parseInt(amount) || 0;
      const contentEl = this.element?.querySelector(".bank-content") || this.element;
      const gpInput = contentEl.querySelector('input[name="currency.gp"]');
      if (gpInput) gpInput.value = gp;
    }
  }

  static async #onEditBank(event, target) {
    // Open bank editor (will be implemented in Phase 6)
    try {
      const { BankEditor } = await import("./bank-editor.mjs");
      const editor = new BankEditor({ bankId: this.bankId });
      editor.render(true);
    } catch (error) {
      ui.notifications.warn("Bank editor not yet available.");
    }
  }

  static async #onProcessInterest(event, target) {
    if (!game.user.isGM) return;

    try {
      await getBankHandler().applyInterestToAllAccounts();
      ui.notifications.info(localize("Bank.Messages.InterestApplied") || "Interest processed for all accounts.");
      this.render();
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onCloseBank(event, target) {
    await this.close();
  }

  /** @override */
  async _onClose(options) {
    await super._onClose(options);

    if (this._sessionId) {
      getBankHandler()?.closeBank(this._sessionId);
    }
  }

  // ==================== Static Factory ====================

  /**
   * Open bank window
   * @param {string} bankId - Bank ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {BankWindow}
   */
  static async open(bankId, playerActorUuid) {
    const window = new BankWindow({ bankId, playerActorUuid });
    await window.render(true);
    return window;
  }
}
