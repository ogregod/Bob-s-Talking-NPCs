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
      openCustomFund: BankWindow.#onOpenCustomFund,
      closeAccount: BankWindow.#onCloseAccount,
      renameAccount: BankWindow.#onRenameAccount,
      confirmDeposit: BankWindow.#onDeposit,
      confirmWithdraw: BankWindow.#onWithdraw,
      confirmTransfer: BankWindow.#onTransfer,
      confirmSendMoney: BankWindow.#onSendMoney,
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
      case "sendMoney":
        tabContent = this._prepareSendMoneyTab(playerAccounts);
        break;
      case "loans":
        tabContent = this._prepareLoansTab(loans, bank, playerAccounts, playerGoldTotal);
        break;
      case "storage":
        tabContent = this._prepareStorageTab(boxes, bank);
        break;
    }

    // Compute totals (work in copper to avoid gold-float errors)
    const totalBalanceCopper = playerAccounts.reduce((sum, a) => sum + toCopper(a.balance), 0);
    const totalBalance = copperToGold(totalBalanceCopper);
    const totalDebtCopper = loans.filter(l => l.status === LoanStatus.ACTIVE)
      .reduce((sum, l) => sum + Math.round((l.remainingBalance || 0) * 100), 0);
    const totalDebt = copperToGold(totalDebtCopper);
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
      playerGoldFormatted: formatCurrency(playerCurrency),
      playerCurrency,
      playerCurrencyTotal: formatCurrency(playerCurrency),

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
      totalBalanceFormatted: formatCurrency(totalBalanceCopper),
      totalDebt: totalDebt.toFixed(2),
      totalDebtFormatted: formatCurrency(totalDebtCopper),
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
      totalFormatted: formatCurrency(currency)   // pass object directly – formatCurrency handles {pp,gp,ep,sp,cp}
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
    const isCustomFund = account.type === AccountType.CUSTOM_FUND;

    // Format transactions for display (most recent 20, newest first)
    // Filter out legacy string IDs (old data stored IDs, new data stores full objects)
    const rawTransactions = (account.transactions || [])
      .filter(t => t !== null && typeof t === "object" && t.id);
    const formattedTransactions = rawTransactions.slice(-20).reverse().map(t => {
      const isCredit = t.type === TransactionType.DEPOSIT || t.type === TransactionType.INTEREST
        || (t.type === TransactionType.TRANSFER && t.toAccountId === account.id);
      return {
        ...t,
        dateFormatted: this._formatGameTime(t.timestamp),
        typeIcon: t.type === TransactionType.DEPOSIT ? "fa-arrow-down"
          : t.type === TransactionType.WITHDRAWAL ? "fa-arrow-up"
          : t.type === TransactionType.TRANSFER ? "fa-exchange-alt"
          : t.type === TransactionType.INTEREST ? "fa-percentage"
          : "fa-receipt",
        typeClass: isCredit ? "credit" : "debit",
        isCredit,
        // Pass currency object directly – formatCurrency expects copper or {pp,gp,ep,sp,cp}
        amountFormatted: `${isCredit ? "+" : "-"}${formatCurrency(t.amount || {})}`,
        balanceAfterFormatted: t.balanceAfter && typeof t.balanceAfter === "object"
          ? formatCurrency(t.balanceAfter)
          : null
      };
    });

    // Custom fund progress
    const savingsGoal = account.metadata?.savingsGoal || 0;
    const currentBalance = balanceBreakdown.totalGold;
    const goalProgress = savingsGoal > 0 ? Math.min(100, Math.round((currentBalance / savingsGoal) * 100)) : 0;

    return {
      ...account,
      balance: balanceBreakdown,
      balanceFormatted: balanceBreakdown.totalFormatted,
      typeLabel: isCustomFund ? account.name
        : isSavings ? localize("Bank.Savings")
        : localize("Bank.Checking"),
      typeIcon: isCustomFund ? "fa-bullseye" : isSavings ? "fa-piggy-bank" : "fa-wallet",
      typeClass: isCustomFund ? "custom-fund" : isSavings ? "savings" : "checking",
      isSelected: account.id === this._selectedAccountId,
      isCustomFund,
      isChecking,
      isSavings,
      accountNumber: account.accountNumber || "---",
      interestRate: account.interest?.enabled ? `${(account.interest.rate * 100).toFixed(1)}%` : null,
      hasInterest: account.interest?.enabled ?? false,
      hasSavingsGoal: savingsGoal > 0,
      savingsGoal: savingsGoal,
      savingsGoalFormatted: formatCurrency(Math.round(savingsGoal * 100)),
      goalProgress,
      goalProgressWidth: `${goalProgress}%`,
      goalReached: currentBalance >= savingsGoal && savingsGoal > 0,
      amountRemaining: Math.max(0, savingsGoal - currentBalance),
      amountRemainingFormatted: formatCurrency(Math.round(Math.max(0, savingsGoal - currentBalance) * 100)),
      lastActivity: this._formatGameTime(account.updatedAt),
      formattedTransactions,
      hasTransactions: formattedTransactions.length > 0,
      canClose: isCustomFund,  // Only custom funds can be closed
      canRename: isCustomFund  // Only custom funds can be renamed
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
      principalFormatted: formatCurrency(Math.round((loan.principal || 0) * 100)),
      totalDueFormatted: formatCurrency(Math.round((loan.totalDue || 0) * 100)),
      amountPaidFormatted: formatCurrency(Math.round((loan.amountPaid || 0) * 100)),
      remainingFormatted: formatCurrency(Math.round((loan.remainingBalance || 0) * 100)),
      paymentFormatted: formatCurrency(Math.round((loan.paymentAmount || 0) * 100)),
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
    const customFunds = accounts.filter(a => a.type === AccountType.CUSTOM_FUND);

    return {
      accountTypes: accountTypes.filter(t => {
        if (t.type === AccountType.PERSONAL && hasChecking) return false;
        if (t.type === AccountType.SAVINGS && hasSavings) return false;
        return true;
      }),
      canOpenAccount: accountTypes.length > 0 && (!hasChecking || !hasSavings),
      canCreateCustomFund: true,  // Always allow creating custom funds
      customFunds: customFunds.map(a => this._prepareAccount(a)),
      hasCustomFunds: customFunds.length > 0,
      customFundCount: customFunds.length,
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
    // Transfer tab: only own accounts (same-owner = no fee)
    const transferTargets = accounts
      .map(a => ({
        id: a.id,
        label: `${a.name || a.typeLabel} – ${formatCurrency(a.balance)}`,
        type: "own",
        isSelected: a.id === this._selectedAccountId
      }));

    return {
      transferTargets,
      hasTransferTargets: transferTargets.filter(t => !t.isSelected).length > 0
    };
  }

  /**
   * Prepare send-money tab content (send to other players / NPCs)
   * @param {object[]} accounts - Player's accounts
   * @returns {object}
   * @private
   */
  _prepareSendMoneyTab(accounts) {
    const handler = getBankHandler();

    // Build player recipient list
    const playerRecipients = (game.actors?.contents || [])
      .filter(a => a.hasPlayerOwner && a.uuid !== this.playerActorUuid)
      .map(a => {
        const acct = handler.getAccountForPlayer(a.uuid, this.bankId);
        return {
          id: `player:${a.uuid}`,
          name: a.name,
          img: a.img || "icons/svg/mystery-man.svg",
          type: "player",
          hasAccount: !!acct,
          accountBalance: acct ? formatCurrency(acct.balance) : null
        };
      });

    // Source account options
    const sourceAccounts = accounts.map(a => ({
      id: a.id,
      label: `${a.name || a.typeLabel} – ${formatCurrency(a.balance)}`
    }));

    return {
      sendSourceAccounts: sourceAccounts,
      hasSendSourceAccounts: sourceAccounts.length > 0,
      playerRecipients,
      hasPlayerRecipients: playerRecipients.length > 0,
      // Fee notice: transferring to other players applies the bank's transfer fee
      sendFee: this._bank?.fees?.transferFee ?? 0.01,
      sendFeeFormatted: `${((this._bank?.fees?.transferFee ?? 0.01) * 100).toFixed(1)}%`
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

    const totalOwedGold = activeLoans.reduce((sum, l) => sum + (l.remainingBalance || 0), 0);
    return {
      canRequestLoan: activeLoans.length === 0 && (bank.loans?.enabled ?? true),
      loansAvailable: bank.loans?.enabled ?? true,
      maxLoanAmount: maxLoan,
      maxLoanFormatted: formatCurrency(Math.round(maxLoan * 100)),
      minLoan,
      maxLoan,
      loanInterestRate: `${((bank.rates?.loanInterest ?? 0.1) * 100).toFixed(1)}%`,
      repaymentPeriod: `${bank.loans?.maxLoanTerm ?? 52} weeks`,
      totalOwed: totalOwedGold,
      totalOwedFormatted: formatCurrency(Math.round(totalOwedGold * 100))
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
        priceFormatted: formatCurrency(Math.round((bank.safeDeposit?.boxPriceSmall ?? 10) * 100)),
        period: bank.safeDeposit?.rentalPeriod || "month"
      },
      {
        size: "medium",
        label: localize("Bank.Medium") || "Medium",
        capacity: 20,
        icon: "fa-box",
        price: bank.safeDeposit?.boxPriceMedium ?? 25,
        priceFormatted: formatCurrency(Math.round((bank.safeDeposit?.boxPriceMedium ?? 25) * 100)),
        period: bank.safeDeposit?.rentalPeriod || "month"
      },
      {
        size: "large",
        label: localize("Bank.Large") || "Large",
        capacity: 30,
        icon: "fa-vault",
        price: bank.safeDeposit?.boxPriceLarge ?? 50,
        priceFormatted: formatCurrency(Math.round((bank.safeDeposit?.boxPriceLarge ?? 50) * 100)),
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
        Math.round(boxes.reduce((sum, b) => sum + (b.rentalPrice || 0), 0) * 100)
      ),
      storageRentalCost: formatCurrency(Math.round((bank.safeDeposit?.boxPriceSmall ?? 10) * 100))
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

  static async #onOpenCustomFund(event, target) {
    // Prompt for fund name and optional goal amount
    const dialog = await Dialog.prompt({
      title: localize("Bank.CreateCustomFund") || "Create Custom Savings Fund",
      content: `
        <form class="bobsnpc-form">
          <div class="form-group">
            <label>${localize("Bank.FundName") || "Fund Name"}</label>
            <input type="text" name="fundName" placeholder="${localize("Bank.FundNamePlaceholder") || "e.g. Sword Fund, House Fund"}" required />
          </div>
          <div class="form-group">
            <label>${localize("Bank.SavesGoal") || "Savings Goal (optional)"}</label>
            <input type="number" name="savingsGoal" placeholder="1000" min="0" />
            <small>${localize("Bank.SavesGoalHint") || "Set a target amount you're saving for"}</small>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" name="enableInterest" checked />
              ${localize("Bank.EnableInterest") || "Earn interest on this fund"}
            </label>
          </div>
        </form>
      `,
      callback: (html) => {
        const form = html.querySelector("form");
        const formData = new FormData(form);
        return {
          name: formData.get("fundName")?.trim(),
          savingsGoal: parseInt(formData.get("savingsGoal")) || 0,
          enableInterest: formData.get("enableInterest") === "on"
        };
      },
      rejectClose: false
    });

    if (!dialog || !dialog.name) return;

    try {
      const bank = getBankHandler().getBank(this.bankId);
      const result = await getBankHandler().openAccount(
        this.bankId,
        this.playerActorUuid,
        {
          type: AccountType.CUSTOM_FUND,
          name: dialog.name,
          metadata: {
            savingsGoal: dialog.savingsGoal,
            createdAt: getCurrentGameTime()
          },
          interest: dialog.enableInterest ? {
            enabled: true,
            rate: bank.rates?.savingsInterest ?? 0.01,
            period: "month",
            lastAccrual: null,
            accruedAmount: 0
          } : { enabled: false }
        }
      );

      if (result.success) {
        ui.notifications.info(localize("Bank.Messages.FundCreated") || `${dialog.name} fund created!`);
        this._selectedAccountId = result.account.id;
        this.render();
      } else {
        ui.notifications.error(result.message);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onCloseAccount(event, target) {
    const accountId = target.dataset.accountId || this._selectedAccountId;
    if (!accountId) return;

    const account = getBankHandler().getAccount(accountId);
    if (!account) return;

    const balance = copperToGold(toCopper(account.balance));
    const balanceFormatted = formatCurrency(account.balance);

    const confirmed = await Dialog.confirm({
      title: localize("Bank.CloseAccount") || "Close Account",
      content: `
        <p>${localize("Bank.CloseAccountConfirm") || "Are you sure you want to close this account?"}</p>
        <p><strong>${account.name}</strong></p>
        <p>${localize("Bank.CurrentBalance") || "Current Balance"}: <strong>${balanceFormatted}</strong></p>
        ${balance > 0 ? `<p class="notification warning">${localize("Bank.BalanceWillBeWithdrawn") || "The remaining balance will be withdrawn to your character."}</p>` : ""}
      `,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });

    if (!confirmed) return;

    try {
      const result = await getBankHandler().closeAccount(accountId, this.playerActorUuid);
      if (result.success) {
        ui.notifications.info(result.message || localize("Bank.Messages.AccountClosed") || "Account closed!");
        this._selectedAccountId = null;
        this._playerActor = await fromUuid(this.playerActorUuid);
        this.render();
      } else {
        ui.notifications.error(result.message);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onRenameAccount(event, target) {
    const accountId = target.dataset.accountId || this._selectedAccountId;
    if (!accountId) return;

    const account = getBankHandler().getAccount(accountId);
    if (!account) return;

    const newName = await Dialog.prompt({
      title: localize("Bank.RenameAccount") || "Rename Account",
      content: `
        <form>
          <div class="form-group">
            <label>${localize("Bank.AccountName") || "Account Name"}</label>
            <input type="text" name="accountName" value="${account.name}" required autofocus />
          </div>
        </form>
      `,
      callback: (html) => html.querySelector('input[name="accountName"]')?.value?.trim(),
      rejectClose: false
    });

    if (!newName) return;

    try {
      // Update account name via handler
      const handler = getBankHandler();
      const updated = { ...account, name: newName, updatedAt: getCurrentGameTime() };
      handler._accountCache.set(accountId, updated);
      await handler._saveData();

      ui.notifications.info(localize("Bank.Messages.AccountRenamed") || "Account renamed!");
      this.render();
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onDeposit(event, target) {
    const contentEl = this.element?.querySelector(".bank-content") || this.element;

    // Read which account to deposit into from the form selector
    const accountSelect = contentEl.querySelector("select[name='depositAccount']");
    const accountId = accountSelect?.value || this._selectedAccountId;
    if (!accountId) return;

    const currency = this._readCurrencyInputs(contentEl);
    const totalCopper = toCopper(currency);

    if (totalCopper <= 0) {
      ui.notifications.warn(localize("Bank.Messages.NoAmount"));
      return;
    }

    try {
      const result = await getBankHandler().depositFunds(accountId, currency, this.playerActorUuid);

      if (result.success) {
        // Pass the currency object – formatCurrency handles {pp,gp,ep,sp,cp} correctly
        ui.notifications.info(localize("Bank.Messages.Deposited", { amount: formatCurrency(currency) }));
        this._selectedAccountId = accountId;
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
    const contentEl = this.element?.querySelector(".bank-content") || this.element;

    // Read which account to withdraw from
    const accountSelect = contentEl.querySelector("select[name='withdrawAccount']");
    const accountId = accountSelect?.value || this._selectedAccountId;
    if (!accountId) return;

    const currency = this._readCurrencyInputs(contentEl);
    const totalCopper = toCopper(currency);

    if (totalCopper <= 0) {
      ui.notifications.warn(localize("Bank.Messages.NoAmount"));
      return;
    }

    try {
      const result = await getBankHandler().withdrawFunds(accountId, currency, this.playerActorUuid);

      if (result.success) {
        ui.notifications.info(localize("Bank.Messages.Withdrawn", { amount: formatCurrency(currency) }));
        this._selectedAccountId = accountId;
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
    const contentEl = this.element?.querySelector(".bank-content") || this.element;

    // Read from/to selects
    const fromSelect = contentEl.querySelector("select[name='transferFrom']");
    const fromAccountId = fromSelect?.value || this._selectedAccountId;
    if (!fromAccountId) return;

    const toSelect = contentEl.querySelector("select[name='transferTo']");
    const toAccountId = toSelect?.value;
    if (!toAccountId) {
      ui.notifications.warn(localize("Bank.Messages.SelectTarget"));
      return;
    }

    if (fromAccountId === toAccountId) {
      ui.notifications.warn("Cannot transfer to the same account.");
      return;
    }

    const currency = this._readCurrencyInputs(contentEl);
    const totalCopper = toCopper(currency);
    if (totalCopper <= 0) {
      ui.notifications.warn(localize("Bank.Messages.NoAmount"));
      return;
    }

    try {
      const result = await getBankHandler().transferFunds(fromAccountId, toAccountId, currency, this.playerActorUuid);

      if (result.success) {
        ui.notifications.info(localize("Bank.Messages.Transferred", { amount: formatCurrency(currency) }));
        this._selectedAccountId = fromAccountId;
        this._currencyAmount = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        this.render();
      } else {
        ui.notifications.error(result.message);
      }
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #onSendMoney(event, target) {
    const contentEl = this.element?.querySelector(".bank-content") || this.element;

    const fromSelect = contentEl.querySelector("select[name='sendFrom']");
    const fromAccountId = fromSelect?.value || this._selectedAccountId;
    if (!fromAccountId) return;

    const recipientSelect = contentEl.querySelector("select[name='sendRecipient']");
    const recipientId = recipientSelect?.value;
    if (!recipientId) {
      ui.notifications.warn(localize("Bank.Messages.SelectTarget"));
      return;
    }

    const currency = this._readCurrencyInputs(contentEl);
    const totalCopper = toCopper(currency);
    if (totalCopper <= 0) {
      ui.notifications.warn(localize("Bank.Messages.NoAmount"));
      return;
    }

    const noteInput = contentEl.querySelector("input[name='sendNote']");
    const note = noteInput?.value?.trim() || "";

    try {
      const result = await getBankHandler().transferFunds(fromAccountId, recipientId, currency, this.playerActorUuid);

      if (result.success) {
        ui.notifications.info(localize("Bank.Messages.Transferred", { amount: formatCurrency(currency) }));
        this._currencyAmount = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        this._tab = "accounts";
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
