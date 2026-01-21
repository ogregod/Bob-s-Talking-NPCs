/**
 * Bob's Talking NPCs - Bank Handler
 * Manages banking, accounts, transactions, loans, and safe deposit boxes
 */

import { MODULE_ID } from "../module.mjs";
import {
  createBank,
  createBankAccount,
  createLoan,
  createTransaction,
  createSafeDepositBox,
  AccountType,
  TransactionType,
  LoanStatus,
  CurrencyType,
  toCopper,
  copperToGold,
  goldToCurrency,
  addCurrency,
  subtractCurrency,
  deposit,
  withdraw,
  transfer,
  calculateLoanPayments,
  makeLoanPayment,
  applyInterest,
  checkBankAccess,
  checkLoanEligibility,
  validateBankAccount
} from "../data/bank-model.mjs";
import { generateId, getFlag, setFlag, localize } from "../utils/helpers.mjs";

/**
 * Storage keys
 */
const STORAGE_KEYS = {
  BANKS: "banks",
  ACCOUNTS: "bankAccounts",
  LOANS: "loans",
  SAFE_DEPOSIT: "safeDepositBoxes"
};

/**
 * Bank Handler Class
 * Singleton managing all banking operations
 */
export class BankHandler {
  constructor() {
    this._initialized = false;
    this._bankCache = new Map();
    this._accountCache = new Map();
    this._loanCache = new Map();
    this._safeDepositCache = new Map();
    this._activeBankSessions = new Map();
  }

  /**
   * Initialize the bank handler
   */
  async initialize() {
    if (this._initialized) return;

    await this._loadData();

    this._initialized = true;
    console.log(`${MODULE_ID} | Bank Handler initialized`);
  }

  // ==================== DATA LOADING ====================

  /**
   * Load all banking data
   * @private
   */
  async _loadData() {
    const worldData = game.settings.get(MODULE_ID, "worldData") || {};

    // Load banks
    const banks = worldData.banks || {};
    this._bankCache.clear();
    for (const [id, bankData] of Object.entries(banks)) {
      this._bankCache.set(id, createBank(bankData));
    }

    // Load accounts
    const accounts = worldData.bankAccounts || {};
    this._accountCache.clear();
    for (const [id, accountData] of Object.entries(accounts)) {
      this._accountCache.set(id, createBankAccount(accountData));
    }

    // Load loans
    const loans = worldData.loans || {};
    this._loanCache.clear();
    for (const [id, loanData] of Object.entries(loans)) {
      this._loanCache.set(id, createLoan(loanData));
    }

    // Load safe deposit boxes
    const boxes = worldData.safeDepositBoxes || {};
    this._safeDepositCache.clear();
    for (const [id, boxData] of Object.entries(boxes)) {
      this._safeDepositCache.set(id, createSafeDepositBox(boxData));
    }
  }

  /**
   * Save all banking data
   * @private
   */
  async _saveData() {
    const worldData = game.settings.get(MODULE_ID, "worldData") || {};
    worldData.banks = Object.fromEntries(this._bankCache);
    worldData.bankAccounts = Object.fromEntries(this._accountCache);
    worldData.loans = Object.fromEntries(this._loanCache);
    worldData.safeDepositBoxes = Object.fromEntries(this._safeDepositCache);
    await game.settings.set(MODULE_ID, "worldData", worldData);
  }

  // ==================== BANK CRUD ====================

  /**
   * Get bank by ID
   * @param {string} bankId - Bank ID
   * @returns {object|null}
   */
  getBank(bankId) {
    return this._bankCache.get(bankId) || null;
  }

  /**
   * Get all banks
   * @returns {object[]}
   */
  getAllBanks() {
    return Array.from(this._bankCache.values());
  }

  /**
   * Get bank for NPC
   * @param {string} npcActorUuid - NPC actor UUID
   * @returns {object|null}
   */
  getBankForNPC(npcActorUuid) {
    return this.getAllBanks().find(b => b.location.npcActorUuid === npcActorUuid) || null;
  }

  /**
   * Create a new bank
   * @param {object} data - Bank data
   * @returns {object}
   */
  async createBank(data) {
    const bank = createBank({
      ...data,
      id: data.id || generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    this._bankCache.set(bank.id, bank);
    await this._saveData();

    Hooks.callAll("bobsNPCBankCreated", bank);

    return bank;
  }

  /**
   * Update a bank
   * @param {string} bankId - Bank ID
   * @param {object} updates - Updates to apply
   * @returns {object|null}
   */
  async updateBank(bankId, updates) {
    const bank = this.getBank(bankId);
    if (!bank) return null;

    const updatedBank = {
      ...bank,
      ...updates,
      id: bankId,
      updatedAt: Date.now()
    };

    this._bankCache.set(bankId, updatedBank);
    await this._saveData();

    return updatedBank;
  }

  // ==================== BANK ACCESS ====================

  /**
   * Open bank for a player
   * @param {string} bankId - Bank ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object} {success, bank, account, message}
   */
  async openBank(bankId, playerActorUuid) {
    const bank = this.getBank(bankId);
    if (!bank) {
      return { success: false, message: localize("BOBSNPC.BankNotFound") };
    }

    // Build context
    const context = await this._buildPlayerContext(playerActorUuid);

    // Check access
    const accessResult = checkBankAccess(bank, context);
    if (!accessResult.canAccess) {
      return { success: false, message: accessResult.reason };
    }

    // Get or create account
    let account = this.getAccountForPlayer(playerActorUuid, bankId);

    // Create session
    const sessionId = generateId();
    this._activeBankSessions.set(sessionId, {
      bankId,
      playerActorUuid,
      accountId: account?.id,
      startedAt: Date.now()
    });

    Hooks.callAll("bobsNPCBankOpened", bank, playerActorUuid);

    return {
      success: true,
      sessionId,
      bank,
      account,
      hasAccount: !!account,
      message: null
    };
  }

  /**
   * Close bank session
   * @param {string} sessionId - Session ID
   */
  closeBank(sessionId) {
    this._activeBankSessions.delete(sessionId);
  }

  /**
   * Build player context
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object}
   * @private
   */
  async _buildPlayerContext(playerActorUuid) {
    const actor = await fromUuid(playerActorUuid);
    if (!actor) return {};

    const currency = actor.system?.currency || {};
    const gold = copperToGold(toCopper(currency));

    const factionStandings = await game.bobsnpc?.factions?.getAllStandings(playerActorUuid) || {};

    return {
      actor,
      gold,
      factionStandings,
      reputation: 0  // Could be derived from factions
    };
  }

  // ==================== ACCOUNTS ====================

  /**
   * Get account by ID
   * @param {string} accountId - Account ID
   * @returns {object|null}
   */
  getAccount(accountId) {
    return this._accountCache.get(accountId) || null;
  }

  /**
   * Get account for player at specific bank
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} bankId - Bank ID
   * @returns {object|null}
   */
  getAccountForPlayer(playerActorUuid, bankId) {
    for (const account of this._accountCache.values()) {
      if (account.ownerUuid === playerActorUuid && account.bankId === bankId) {
        return account;
      }
    }
    return null;
  }

  /**
   * Get all accounts for player
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object[]}
   */
  getAccountsForPlayer(playerActorUuid) {
    return Array.from(this._accountCache.values())
      .filter(a => a.ownerUuid === playerActorUuid || a.coOwners.includes(playerActorUuid));
  }

  /**
   * Open a new bank account
   * @param {string} bankId - Bank ID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {object} options - Account options
   * @returns {object} {success, account, message}
   */
  async openAccount(bankId, playerActorUuid, options = {}) {
    const bank = this.getBank(bankId);
    if (!bank) {
      return { success: false, message: localize("BOBSNPC.BankNotFound") };
    }

    // Check if already has account
    const existingAccount = this.getAccountForPlayer(playerActorUuid, bankId);
    if (existingAccount) {
      return { success: false, message: localize("BOBSNPC.AccountAlreadyExists") };
    }

    const actor = await fromUuid(playerActorUuid);
    if (!actor) {
      return { success: false, message: localize("BOBSNPC.PlayerNotFound") };
    }

    // Check minimum deposit
    if (bank.access.minimumDeposit > 0) {
      const gold = copperToGold(toCopper(actor.system?.currency || {}));
      if (gold < bank.access.minimumDeposit) {
        return { success: false, message: localize("BOBSNPC.MinimumDepositRequired") };
      }
    }

    // Create account
    const account = createBankAccount({
      bankId,
      ownerUuid: playerActorUuid,
      ownerName: actor.name,
      type: options.type || AccountType.PERSONAL,
      name: options.name || `${actor.name}'s Account`
    });

    this._accountCache.set(account.id, account);

    // Add to bank's account list
    await this.updateBank(bankId, {
      accountIds: [...bank.accountIds, account.id]
    });

    await this._saveData();

    Hooks.callAll("bobsNPCAccountOpened", account, bank);

    return { success: true, account, message: localize("BOBSNPC.AccountOpened") };
  }

  /**
   * Close a bank account
   * @param {string} accountId - Account ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object} {success, withdrawnBalance, message}
   */
  async closeAccount(accountId, playerActorUuid) {
    const account = this.getAccount(accountId);
    if (!account) {
      return { success: false, message: localize("BOBSNPC.AccountNotFound") };
    }

    if (account.ownerUuid !== playerActorUuid) {
      return { success: false, message: localize("BOBSNPC.NotAccountOwner") };
    }

    // Withdraw remaining balance
    const balance = toCopper(account.balance);
    if (balance > 0) {
      const actor = await fromUuid(playerActorUuid);
      if (actor) {
        const gold = copperToGold(balance);
        const currentGold = actor.system?.currency?.gp || 0;
        await actor.update({ "system.currency.gp": currentGold + gold });
      }
    }

    // Remove account
    this._accountCache.delete(accountId);

    // Update bank
    const bank = this.getBank(account.bankId);
    if (bank) {
      await this.updateBank(bank.id, {
        accountIds: bank.accountIds.filter(id => id !== accountId)
      });
    }

    await this._saveData();

    return {
      success: true,
      withdrawnBalance: copperToGold(balance),
      message: localize("BOBSNPC.AccountClosed")
    };
  }

  // ==================== DEPOSITS & WITHDRAWALS ====================

  /**
   * Deposit funds into account
   * @param {string} accountId - Account ID
   * @param {object} amount - Currency amount {cp, sp, ep, gp, pp}
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object} {success, account, message}
   */
  async depositFunds(accountId, amount, playerActorUuid) {
    const account = this.getAccount(accountId);
    if (!account) {
      return { success: false, message: localize("BOBSNPC.AccountNotFound") };
    }

    // Verify ownership
    if (account.ownerUuid !== playerActorUuid && !account.coOwners.includes(playerActorUuid)) {
      return { success: false, message: localize("BOBSNPC.NotAuthorized") };
    }

    const actor = await fromUuid(playerActorUuid);
    if (!actor) {
      return { success: false, message: localize("BOBSNPC.PlayerNotFound") };
    }

    // Check player has funds
    const playerCurrency = actor.system?.currency || {};
    const depositCopper = toCopper(amount);
    const playerCopper = toCopper(playerCurrency);

    if (playerCopper < depositCopper) {
      return { success: false, message: localize("BOBSNPC.InsufficientFunds") };
    }

    // Perform deposit
    const result = deposit(account, amount, "Player deposit");

    // Update account
    this._accountCache.set(accountId, result.account);

    // Deduct from player
    const goldAmount = copperToGold(depositCopper);
    const currentGold = actor.system?.currency?.gp || 0;
    await actor.update({ "system.currency.gp": currentGold - goldAmount });

    await this._saveData();

    // Emit event
    this._emitSocket("deposit", {
      accountId,
      amount,
      playerActorUuid
    });

    Hooks.callAll("bobsNPCDeposit", result.account, amount, playerActorUuid);

    return {
      success: true,
      account: result.account,
      transaction: result.transaction,
      message: localize("BOBSNPC.DepositComplete")
    };
  }

  /**
   * Withdraw funds from account
   * @param {string} accountId - Account ID
   * @param {object} amount - Currency amount
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object} {success, account, message}
   */
  async withdrawFunds(accountId, amount, playerActorUuid) {
    const account = this.getAccount(accountId);
    if (!account) {
      return { success: false, message: localize("BOBSNPC.AccountNotFound") };
    }

    // Verify ownership
    if (account.ownerUuid !== playerActorUuid && !account.coOwners.includes(playerActorUuid)) {
      return { success: false, message: localize("BOBSNPC.NotAuthorized") };
    }

    // Check frozen
    if (account.frozen) {
      return { success: false, message: account.frozenReason || localize("BOBSNPC.AccountFrozen") };
    }

    const bank = this.getBank(account.bankId);
    if (!bank) {
      return { success: false, message: localize("BOBSNPC.BankNotFound") };
    }

    // Perform withdrawal
    const result = withdraw(account, amount, bank, "Player withdrawal");

    if (!result.success) {
      return { success: false, message: result.reason };
    }

    // Update account
    this._accountCache.set(accountId, result.account);

    // Give to player
    const actor = await fromUuid(playerActorUuid);
    if (actor) {
      const goldAmount = copperToGold(toCopper(amount));
      const currentGold = actor.system?.currency?.gp || 0;
      await actor.update({ "system.currency.gp": currentGold + goldAmount });
    }

    await this._saveData();

    this._emitSocket("withdrawal", {
      accountId,
      amount,
      playerActorUuid
    });

    Hooks.callAll("bobsNPCWithdrawal", result.account, amount, playerActorUuid);

    return {
      success: true,
      account: result.account,
      transaction: result.transaction,
      message: localize("BOBSNPC.WithdrawalComplete")
    };
  }

  /**
   * Transfer funds between accounts
   * @param {string} fromAccountId - Source account ID
   * @param {string} toAccountId - Destination account ID
   * @param {object} amount - Currency amount
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object} {success, message}
   */
  async transferFunds(fromAccountId, toAccountId, amount, playerActorUuid) {
    const fromAccount = this.getAccount(fromAccountId);
    const toAccount = this.getAccount(toAccountId);

    if (!fromAccount || !toAccount) {
      return { success: false, message: localize("BOBSNPC.AccountNotFound") };
    }

    // Verify ownership of source account
    if (fromAccount.ownerUuid !== playerActorUuid && !fromAccount.coOwners.includes(playerActorUuid)) {
      return { success: false, message: localize("BOBSNPC.NotAuthorized") };
    }

    const bank = this.getBank(fromAccount.bankId);
    if (!bank) {
      return { success: false, message: localize("BOBSNPC.BankNotFound") };
    }

    // Perform transfer
    const result = transfer(fromAccount, toAccount, amount, bank, "Player transfer");

    if (!result.success) {
      return { success: false, message: result.reason };
    }

    // Update accounts
    this._accountCache.set(fromAccountId, result.fromAccount);
    this._accountCache.set(toAccountId, result.toAccount);

    await this._saveData();

    Hooks.callAll("bobsNPCTransfer", fromAccountId, toAccountId, amount, playerActorUuid);

    return {
      success: true,
      fromAccount: result.fromAccount,
      toAccount: result.toAccount,
      transaction: result.transaction,
      message: localize("BOBSNPC.TransferComplete")
    };
  }

  // ==================== LOANS ====================

  /**
   * Get loan by ID
   * @param {string} loanId - Loan ID
   * @returns {object|null}
   */
  getLoan(loanId) {
    return this._loanCache.get(loanId) || null;
  }

  /**
   * Get loans for player
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object[]}
   */
  getLoansForPlayer(playerActorUuid) {
    return Array.from(this._loanCache.values())
      .filter(l => l.borrowerUuid === playerActorUuid);
  }

  /**
   * Request a loan
   * @param {string} bankId - Bank ID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {number} amount - Loan amount in gold
   * @param {object} options - Loan options
   * @returns {object} {success, loan, message}
   */
  async requestLoan(bankId, playerActorUuid, amount, options = {}) {
    const bank = this.getBank(bankId);
    if (!bank) {
      return { success: false, message: localize("BOBSNPC.BankNotFound") };
    }

    if (!bank.loans.enabled) {
      return { success: false, message: localize("BOBSNPC.LoansNotAvailable") };
    }

    const account = this.getAccountForPlayer(playerActorUuid, bankId);
    if (!account) {
      return { success: false, message: localize("BOBSNPC.AccountRequired") };
    }

    // Check eligibility
    const existingLoans = this.getLoansForPlayer(playerActorUuid);
    const eligibility = checkLoanEligibility(bank, account, amount, {
      existingLoans,
      requirements: bank.loans,
      collateralValue: options.collateralValue || 0
    });

    if (!eligibility.eligible) {
      return { success: false, message: eligibility.reasons.join(", ") };
    }

    // Calculate payments
    const paymentInfo = calculateLoanPayments(
      amount,
      bank.rates.loanInterest,
      options.numberOfPayments || 12
    );

    // Create loan
    const loan = createLoan({
      borrowerUuid: playerActorUuid,
      borrowerName: account.ownerName,
      accountId: account.id,
      bankId,
      principal: amount,
      interestRate: bank.rates.loanInterest,
      totalDue: paymentInfo.totalDue,
      remainingBalance: paymentInfo.totalDue,
      paymentAmount: paymentInfo.paymentAmount,
      numberOfPayments: options.numberOfPayments || 12,
      status: LoanStatus.PENDING,
      purpose: options.purpose || ""
    });

    this._loanCache.set(loan.id, loan);

    // Add to bank's loan list
    await this.updateBank(bankId, {
      loanIds: [...bank.loanIds, loan.id]
    });

    await this._saveData();

    Hooks.callAll("bobsNPCLoanRequested", loan, bank);

    return {
      success: true,
      loan,
      paymentInfo,
      message: localize("BOBSNPC.LoanRequested")
    };
  }

  /**
   * Approve a loan (GM action)
   * @param {string} loanId - Loan ID
   * @returns {object} {success, loan, message}
   */
  async approveLoan(loanId) {
    const loan = this.getLoan(loanId);
    if (!loan) {
      return { success: false, message: localize("BOBSNPC.LoanNotFound") };
    }

    if (loan.status !== LoanStatus.PENDING) {
      return { success: false, message: localize("BOBSNPC.LoanNotPending") };
    }

    // Update loan status
    const updatedLoan = {
      ...loan,
      status: LoanStatus.ACTIVE,
      approvedAt: Date.now(),
      disbursedAt: Date.now()
    };

    this._loanCache.set(loanId, updatedLoan);

    // Deposit loan amount to account
    const account = this.getAccount(loan.accountId);
    if (account) {
      const result = deposit(account, { gp: loan.principal }, "Loan disbursement");
      this._accountCache.set(account.id, result.account);
    }

    await this._saveData();

    Hooks.callAll("bobsNPCLoanApproved", updatedLoan);

    return { success: true, loan: updatedLoan, message: localize("BOBSNPC.LoanApproved") };
  }

  /**
   * Make a loan payment
   * @param {string} loanId - Loan ID
   * @param {number} amount - Payment amount in gold
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object} {success, loan, message}
   */
  async makeLoanPayment(loanId, amount, playerActorUuid) {
    const loan = this.getLoan(loanId);
    if (!loan) {
      return { success: false, message: localize("BOBSNPC.LoanNotFound") };
    }

    if (loan.borrowerUuid !== playerActorUuid) {
      return { success: false, message: localize("BOBSNPC.NotBorrower") };
    }

    if (loan.status !== LoanStatus.ACTIVE) {
      return { success: false, message: localize("BOBSNPC.LoanNotActive") };
    }

    // Check player has funds
    const actor = await fromUuid(playerActorUuid);
    if (!actor) {
      return { success: false, message: localize("BOBSNPC.PlayerNotFound") };
    }

    const gold = copperToGold(toCopper(actor.system?.currency || {}));
    if (gold < amount) {
      return { success: false, message: localize("BOBSNPC.InsufficientFunds") };
    }

    // Process payment
    const updatedLoan = makeLoanPayment(loan, amount);
    this._loanCache.set(loanId, updatedLoan);

    // Deduct from player
    const currentGold = actor.system?.currency?.gp || 0;
    await actor.update({ "system.currency.gp": currentGold - amount });

    await this._saveData();

    const isPaidOff = updatedLoan.status === LoanStatus.PAID;

    Hooks.callAll("bobsNPCLoanPayment", updatedLoan, amount);

    return {
      success: true,
      loan: updatedLoan,
      isPaidOff,
      message: isPaidOff ? localize("BOBSNPC.LoanPaidOff") : localize("BOBSNPC.PaymentReceived")
    };
  }

  // ==================== SAFE DEPOSIT BOXES ====================

  /**
   * Get safe deposit box
   * @param {string} boxId - Box ID
   * @returns {object|null}
   */
  getSafeDepositBox(boxId) {
    return this._safeDepositCache.get(boxId) || null;
  }

  /**
   * Get safe deposit boxes for player
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object[]}
   */
  getSafeDepositBoxesForPlayer(playerActorUuid) {
    return Array.from(this._safeDepositCache.values())
      .filter(b => b.ownerUuid === playerActorUuid);
  }

  /**
   * Rent a safe deposit box
   * @param {string} bankId - Bank ID
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} size - Box size (small, medium, large)
   * @returns {object} {success, box, message}
   */
  async rentSafeDepositBox(bankId, playerActorUuid, size = "small") {
    const bank = this.getBank(bankId);
    if (!bank || !bank.safeDeposit.enabled) {
      return { success: false, message: localize("BOBSNPC.ServiceNotAvailable") };
    }

    // Get price for size
    const prices = {
      small: bank.safeDeposit.boxPriceSmall,
      medium: bank.safeDeposit.boxPriceMedium,
      large: bank.safeDeposit.boxPriceLarge
    };

    const price = prices[size] || prices.small;

    // Check funds
    const actor = await fromUuid(playerActorUuid);
    if (!actor) {
      return { success: false, message: localize("BOBSNPC.PlayerNotFound") };
    }

    const gold = copperToGold(toCopper(actor.system?.currency || {}));
    if (gold < price) {
      return { success: false, message: localize("BOBSNPC.InsufficientFunds") };
    }

    // Create box
    const box = createSafeDepositBox({
      bankId,
      ownerUuid: playerActorUuid,
      size,
      rentalPrice: price,
      rentalPeriod: bank.safeDeposit.rentalPeriod,
      paidUntil: this._calculatePaidUntil(bank.safeDeposit.rentalPeriod),
      maxSlots: size === "large" ? 30 : size === "medium" ? 20 : 10,
      maxWeight: size === "large" ? 150 : size === "medium" ? 100 : 50
    });

    this._safeDepositCache.set(box.id, box);

    // Deduct payment
    const currentGold = actor.system?.currency?.gp || 0;
    await actor.update({ "system.currency.gp": currentGold - price });

    await this._saveData();

    return { success: true, box, message: localize("BOBSNPC.BoxRented") };
  }

  /**
   * Store item in safe deposit box
   * @param {string} boxId - Box ID
   * @param {string} itemUuid - Item UUID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object} {success, message}
   */
  async storeInBox(boxId, itemUuid, playerActorUuid) {
    const box = this.getSafeDepositBox(boxId);
    if (!box) {
      return { success: false, message: localize("BOBSNPC.BoxNotFound") };
    }

    if (box.ownerUuid !== playerActorUuid) {
      return { success: false, message: localize("BOBSNPC.NotBoxOwner") };
    }

    // Check capacity
    if (box.items.length >= box.maxSlots) {
      return { success: false, message: localize("BOBSNPC.BoxFull") };
    }

    // Move item from player to box
    const actor = await fromUuid(playerActorUuid);
    const item = actor?.items.find(i => i.uuid === itemUuid || i.id === itemUuid.split(".").pop());

    if (!item) {
      return { success: false, message: localize("BOBSNPC.ItemNotFound") };
    }

    // Store item data
    box.items.push({
      uuid: item.uuid,
      data: item.toObject(),
      storedAt: Date.now()
    });

    // Delete from player inventory
    await item.delete();

    // Update access log
    box.accessLog.push({
      timestamp: Date.now(),
      action: "store",
      itemName: item.name
    });

    box.lastAccessed = Date.now();

    this._safeDepositCache.set(boxId, box);
    await this._saveData();

    return { success: true, message: localize("BOBSNPC.ItemStored") };
  }

  /**
   * Retrieve item from safe deposit box
   * @param {string} boxId - Box ID
   * @param {number} itemIndex - Index of item in box
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object} {success, item, message}
   */
  async retrieveFromBox(boxId, itemIndex, playerActorUuid) {
    const box = this.getSafeDepositBox(boxId);
    if (!box) {
      return { success: false, message: localize("BOBSNPC.BoxNotFound") };
    }

    if (box.ownerUuid !== playerActorUuid) {
      return { success: false, message: localize("BOBSNPC.NotBoxOwner") };
    }

    if (itemIndex < 0 || itemIndex >= box.items.length) {
      return { success: false, message: localize("BOBSNPC.ItemNotFound") };
    }

    const storedItem = box.items[itemIndex];

    // Create item in player inventory
    const actor = await fromUuid(playerActorUuid);
    if (!actor) {
      return { success: false, message: localize("BOBSNPC.PlayerNotFound") };
    }

    const created = await actor.createEmbeddedDocuments("Item", [storedItem.data]);

    // Remove from box
    box.items.splice(itemIndex, 1);

    // Update access log
    box.accessLog.push({
      timestamp: Date.now(),
      action: "retrieve",
      itemName: storedItem.data.name
    });

    box.lastAccessed = Date.now();

    this._safeDepositCache.set(boxId, box);
    await this._saveData();

    return {
      success: true,
      item: created[0],
      message: localize("BOBSNPC.ItemRetrieved")
    };
  }

  /**
   * Calculate paid until date
   * @param {string} period - Rental period
   * @returns {number} Timestamp
   * @private
   */
  _calculatePaidUntil(period) {
    const now = Date.now();
    switch (period) {
      case "week":
        return now + 7 * 24 * 60 * 60 * 1000;
      case "month":
        return now + 30 * 24 * 60 * 60 * 1000;
      case "year":
        return now + 365 * 24 * 60 * 60 * 1000;
      default:
        return now + 30 * 24 * 60 * 60 * 1000;
    }
  }

  // ==================== INTEREST & MAINTENANCE ====================

  /**
   * Apply interest to all savings accounts
   */
  async applyInterestToAllAccounts() {
    for (const account of this._accountCache.values()) {
      if (!account.interest.enabled) continue;

      const updatedAccount = applyInterest(account);
      if (updatedAccount.balance !== account.balance) {
        this._accountCache.set(account.id, updatedAccount);
      }
    }

    await this._saveData();
  }

  /**
   * Check loan payments and apply penalties
   */
  async checkLoanPayments() {
    const now = Date.now();

    for (const loan of this._loanCache.values()) {
      if (loan.status !== LoanStatus.ACTIVE) continue;

      // Check if payment is overdue
      if (loan.nextPaymentDue && now > loan.nextPaymentDue) {
        const updatedLoan = {
          ...loan,
          missedPayments: loan.missedPayments + 1
        };

        // Check for default
        if (updatedLoan.missedPayments >= loan.defaultThreshold) {
          updatedLoan.status = LoanStatus.DEFAULTED;
          Hooks.callAll("bobsNPCLoanDefaulted", updatedLoan);
        }

        this._loanCache.set(loan.id, updatedLoan);
      }
    }

    await this._saveData();
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
      type: `bank.${event}`,
      data
    });
  }
}

// Singleton instance
export const bankHandler = new BankHandler();
