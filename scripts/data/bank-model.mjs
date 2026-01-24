/**
 * Bob's Talking NPCs - Bank Data Model
 * Defines the structure for banking, currency storage, and loans
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";
import { generateId } from "../utils/helpers.mjs";

/**
 * Account type enum
 */
export const AccountType = Object.freeze({
  PERSONAL: "personal",
  PARTY: "party",
  GUILD: "guild",
  MERCHANT: "merchant",
  SAVINGS: "savings"
});

/**
 * Transaction type enum
 */
export const TransactionType = Object.freeze({
  DEPOSIT: "deposit",
  WITHDRAWAL: "withdrawal",
  TRANSFER: "transfer",
  LOAN: "loan",
  LOAN_PAYMENT: "loanPayment",
  INTEREST: "interest",
  FEE: "fee",
  EXCHANGE: "exchange"
});

/**
 * Loan status enum
 */
export const LoanStatus = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  PAID: "paid",
  DEFAULTED: "defaulted",
  FORGIVEN: "forgiven"
});

/**
 * Currency types (D&D 5e standard)
 */
export const CurrencyType = Object.freeze({
  COPPER: "cp",
  SILVER: "sp",
  ELECTRUM: "ep",
  GOLD: "gp",
  PLATINUM: "pp"
});

/**
 * Currency conversion rates to copper pieces
 */
export const CurrencyRates = Object.freeze({
  [CurrencyType.COPPER]: 1,
  [CurrencyType.SILVER]: 10,
  [CurrencyType.ELECTRUM]: 50,
  [CurrencyType.GOLD]: 100,
  [CurrencyType.PLATINUM]: 1000
});

/**
 * Create a bank transaction record
 * @param {object} data - Transaction data
 * @returns {object}
 */
export function createTransaction(data = {}) {
  return {
    id: data.id || generateId(),
    timestamp: data.timestamp || Date.now(),
    type: data.type || TransactionType.DEPOSIT,

    // Accounts involved
    fromAccountId: data.fromAccountId || null,
    toAccountId: data.toAccountId || null,

    // Amount
    amount: {
      cp: data.amount?.cp ?? 0,
      sp: data.amount?.sp ?? 0,
      ep: data.amount?.ep ?? 0,
      gp: data.amount?.gp ?? 0,
      pp: data.amount?.pp ?? 0
    },

    // Exchange details (if currency exchange)
    exchange: data.exchange || null,  // {fromCurrency, toCurrency, rate}

    // Fees
    fee: data.fee ?? 0,

    // Reference
    reference: data.reference || "",
    performedBy: data.performedBy || null,  // Actor UUID
    approvedBy: data.approvedBy || null,    // Banker NPC

    // Status
    successful: data.successful ?? true,
    failureReason: data.failureReason || null
  };
}

/**
 * Create a bank account
 * @param {object} data - Account data
 * @returns {object}
 */
export function createBankAccount(data = {}) {
  return {
    id: data.id || generateId(),
    accountNumber: data.accountNumber || generateAccountNumber(),
    type: data.type || AccountType.PERSONAL,
    name: data.name || "Account",

    // Owner(s)
    ownerUuid: data.ownerUuid || null,  // Primary owner actor UUID
    ownerName: data.ownerName || null,
    coOwners: data.coOwners || [],      // Additional actor UUIDs with access

    // Balance
    balance: {
      cp: data.balance?.cp ?? 0,
      sp: data.balance?.sp ?? 0,
      ep: data.balance?.ep ?? 0,
      gp: data.balance?.gp ?? 0,
      pp: data.balance?.pp ?? 0
    },

    // Limits
    limits: {
      withdrawalLimit: data.limits?.withdrawalLimit ?? 0,  // 0 = no limit
      withdrawalPeriod: data.limits?.withdrawalPeriod || "day",
      withdrawnThisPeriod: data.limits?.withdrawnThisPeriod ?? 0,
      lastWithdrawal: data.limits?.lastWithdrawal || null,
      minimumBalance: data.limits?.minimumBalance ?? 0
    },

    // Interest (for savings accounts)
    interest: {
      enabled: data.interest?.enabled ?? false,
      rate: data.interest?.rate ?? 0.01,  // 1% per period
      period: data.interest?.period || "month",
      lastAccrual: data.interest?.lastAccrual || null,
      accruedAmount: data.interest?.accruedAmount ?? 0
    },

    // Transaction history
    transactions: data.transactions || [],  // Array of transaction IDs

    // Security
    pin: data.pin || null,  // Optional PIN for withdrawals
    requiresVerification: data.requiresVerification ?? false,

    // Status
    active: data.active ?? true,
    frozen: data.frozen ?? false,
    frozenReason: data.frozenReason || null,

    // Associated bank
    bankId: data.bankId || null,

    // Metadata
    openedAt: data.openedAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  };
}

/**
 * Create a loan record
 * @param {object} data - Loan data
 * @returns {object}
 */
export function createLoan(data = {}) {
  return {
    id: data.id || generateId(),
    status: data.status || LoanStatus.PENDING,

    // Borrower
    borrowerUuid: data.borrowerUuid || null,
    borrowerName: data.borrowerName || null,
    accountId: data.accountId || null,

    // Loan details
    principal: data.principal ?? 0,  // Original amount borrowed (in gold)
    interestRate: data.interestRate ?? 0.1,  // 10% per period
    interestPeriod: data.interestPeriod || "month",

    // Payment schedule
    totalDue: data.totalDue ?? 0,
    amountPaid: data.amountPaid ?? 0,
    remainingBalance: data.remainingBalance ?? 0,
    paymentAmount: data.paymentAmount ?? 0,  // Per period
    paymentFrequency: data.paymentFrequency || "weekly",
    numberOfPayments: data.numberOfPayments ?? 0,
    paymentsMade: data.paymentsMade ?? 0,

    // Dates
    requestedAt: data.requestedAt || Date.now(),
    approvedAt: data.approvedAt || null,
    disbursedAt: data.disbursedAt || null,
    dueDate: data.dueDate || null,
    nextPaymentDue: data.nextPaymentDue || null,
    paidOffAt: data.paidOffAt || null,

    // Collateral
    collateral: {
      required: data.collateral?.required ?? false,
      itemUuids: data.collateral?.itemUuids || [],
      propertyId: data.collateral?.propertyId || null,
      value: data.collateral?.value ?? 0
    },

    // Default handling
    missedPayments: data.missedPayments ?? 0,
    defaultThreshold: data.defaultThreshold ?? 3,  // Missed payments before default
    penaltyRate: data.penaltyRate ?? 0.05,  // Additional interest on late payments

    // Guarantor (if any)
    guarantorUuid: data.guarantorUuid || null,

    // Requirements to qualify
    requirements: {
      minimumReputation: data.requirements?.minimumReputation ?? 0,
      factionRank: data.requirements?.factionRank || null,
      accountAge: data.requirements?.accountAge ?? 0,  // Days
      creditHistory: data.requirements?.creditHistory ?? 0
    },

    // Payment history
    payments: data.payments || [],  // Array of payment records

    // Associated bank
    bankId: data.bankId || null,
    approvedBy: data.approvedBy || null,  // Banker who approved

    // Notes
    purpose: data.purpose || "",
    notes: data.notes || ""
  };
}

/**
 * Create bank configuration
 * @param {object} data - Bank data
 * @returns {object}
 */
export function createBank(data = {}) {
  return {
    id: data.id || generateId(),
    name: data.name || "Bank",
    description: data.description || "",

    // Location
    location: {
      sceneId: data.location?.sceneId || null,
      region: data.location?.region || null,
      npcActorUuid: data.location?.npcActorUuid || null  // Banker NPC
    },

    // Visual
    icon: data.icon || "fa-landmark",
    color: data.color || "#4caf50",

    // Services
    services: {
      deposits: data.services?.deposits ?? true,
      withdrawals: data.services?.withdrawals ?? true,
      transfers: data.services?.transfers ?? true,
      currencyExchange: data.services?.currencyExchange ?? true,
      loans: data.services?.loans ?? true,
      safeDeposit: data.services?.safeDeposit ?? false,  // Item storage
      investments: data.services?.investments ?? false
    },

    // Fees
    fees: {
      accountMaintenance: data.fees?.accountMaintenance ?? 0,  // Per month
      transactionFee: data.fees?.transactionFee ?? 0,
      withdrawalFee: data.fees?.withdrawalFee ?? 0,
      transferFee: data.fees?.transferFee ?? 0.01,  // 1% of transfer
      exchangeFee: data.fees?.exchangeFee ?? 0.05,   // 5% of exchange
      loanOriginationFee: data.fees?.loanOriginationFee ?? 0.02  // 2% of loan
    },

    // Interest rates
    rates: {
      savingsInterest: data.rates?.savingsInterest ?? 0.01,  // 1% per month
      loanInterest: data.rates?.loanInterest ?? 0.1,         // 10% per month
      penaltyInterest: data.rates?.penaltyInterest ?? 0.15   // 15% for late payments
    },

    // Loan configuration
    loans: {
      enabled: data.loans?.enabled ?? true,
      maxLoanAmount: data.loans?.maxLoanAmount ?? 10000,
      minLoanAmount: data.loans?.minLoanAmount ?? 50,
      maxLoanTerm: data.loans?.maxLoanTerm ?? 52,  // Weeks
      requiresCollateral: data.loans?.requiresCollateral ?? false,
      collateralRatio: data.loans?.collateralRatio ?? 1.5  // 150% of loan value
    },

    // Safe deposit boxes
    safeDeposit: {
      enabled: data.safeDeposit?.enabled ?? false,
      boxPriceSmall: data.safeDeposit?.boxPriceSmall ?? 10,
      boxPriceMedium: data.safeDeposit?.boxPriceMedium ?? 25,
      boxPriceLarge: data.safeDeposit?.boxPriceLarge ?? 50,
      rentalPeriod: data.safeDeposit?.rentalPeriod || "month"
    },

    // Access requirements
    access: {
      minimumDeposit: data.access?.minimumDeposit ?? 0,
      factionRequired: data.access?.factionRequired || null,
      factionRank: data.access?.factionRank || null,
      reputationRequired: data.access?.reputationRequired ?? 0
    },

    // Operating hours (reference to schedule model)
    schedule: data.schedule || null,

    // Bank's reserves (for GM tracking)
    reserves: {
      cp: data.reserves?.cp ?? 0,
      sp: data.reserves?.sp ?? 0,
      ep: data.reserves?.ep ?? 0,
      gp: data.reserves?.gp ?? 100000,
      pp: data.reserves?.pp ?? 0
    },

    // Accounts at this bank
    accountIds: data.accountIds || [],

    // Active loans
    loanIds: data.loanIds || [],

    // Metadata
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  };
}

/**
 * Create a safe deposit box
 * @param {object} data - Box data
 * @returns {object}
 */
export function createSafeDepositBox(data = {}) {
  return {
    id: data.id || generateId(),
    bankId: data.bankId || null,
    ownerUuid: data.ownerUuid || null,
    size: data.size || "small",  // small, medium, large

    // Contents
    items: data.items || [],  // Array of item UUIDs
    maxSlots: data.maxSlots ?? 10,
    maxWeight: data.maxWeight ?? 50,

    // Rental
    rentalPrice: data.rentalPrice ?? 10,
    rentalPeriod: data.rentalPeriod || "month",
    paidUntil: data.paidUntil || null,
    autoRenew: data.autoRenew ?? false,

    // Security
    keyRequired: data.keyRequired ?? true,
    keyItemUuid: data.keyItemUuid || null,
    dualKeyRequired: data.dualKeyRequired ?? false,
    accessLog: data.accessLog || [],

    // Metadata
    rentedAt: data.rentedAt || Date.now(),
    lastAccessed: data.lastAccessed || null
  };
}

/**
 * Generate a random account number
 * @returns {string}
 */
export function generateAccountNumber() {
  const segments = [];
  for (let i = 0; i < 3; i++) {
    segments.push(Math.floor(Math.random() * 10000).toString().padStart(4, "0"));
  }
  return segments.join("-");
}

/**
 * Convert currency amount to copper pieces
 * @param {object} currency - Currency breakdown
 * @returns {number} Total in copper pieces
 */
export function toCopper(currency) {
  return (
    (currency.cp || 0) * CurrencyRates[CurrencyType.COPPER] +
    (currency.sp || 0) * CurrencyRates[CurrencyType.SILVER] +
    (currency.ep || 0) * CurrencyRates[CurrencyType.ELECTRUM] +
    (currency.gp || 0) * CurrencyRates[CurrencyType.GOLD] +
    (currency.pp || 0) * CurrencyRates[CurrencyType.PLATINUM]
  );
}

/**
 * Convert copper pieces to gold (decimal)
 * @param {number} copper - Copper pieces
 * @returns {number} Gold equivalent
 */
export function copperToGold(copper) {
  return copper / CurrencyRates[CurrencyType.GOLD];
}

/**
 * Convert gold to optimal currency breakdown
 * @param {number} gold - Amount in gold
 * @returns {object} Currency breakdown
 */
export function goldToCurrency(gold) {
  const totalCopper = Math.round(gold * 100);

  const pp = Math.floor(totalCopper / 1000);
  const remainder1 = totalCopper % 1000;

  const gp = Math.floor(remainder1 / 100);
  const remainder2 = remainder1 % 100;

  const sp = Math.floor(remainder2 / 10);
  const cp = remainder2 % 10;

  return { pp, gp, ep: 0, sp, cp };
}

/**
 * Add currency amounts together
 * @param {object} a - First currency amount
 * @param {object} b - Second currency amount
 * @returns {object} Combined currency
 */
export function addCurrency(a, b) {
  return {
    cp: (a.cp || 0) + (b.cp || 0),
    sp: (a.sp || 0) + (b.sp || 0),
    ep: (a.ep || 0) + (b.ep || 0),
    gp: (a.gp || 0) + (b.gp || 0),
    pp: (a.pp || 0) + (b.pp || 0)
  };
}

/**
 * Subtract currency amounts (a - b)
 * @param {object} a - Currency to subtract from
 * @param {object} b - Currency to subtract
 * @returns {object|null} Result or null if insufficient funds
 */
export function subtractCurrency(a, b) {
  const totalA = toCopper(a);
  const totalB = toCopper(b);

  if (totalB > totalA) {
    return null;  // Insufficient funds
  }

  return goldToCurrency(copperToGold(totalA - totalB));
}

/**
 * Deposit funds to account
 * @param {object} account - Bank account
 * @param {object} amount - Currency to deposit
 * @param {string} reference - Transaction reference
 * @returns {object} {account, transaction}
 */
export function deposit(account, amount, reference = "") {
  const newBalance = addCurrency(account.balance, amount);

  const transaction = createTransaction({
    type: TransactionType.DEPOSIT,
    toAccountId: account.id,
    amount,
    reference
  });

  return {
    account: {
      ...account,
      balance: newBalance,
      transactions: [...account.transactions, transaction.id],
      updatedAt: Date.now()
    },
    transaction
  };
}

/**
 * Withdraw funds from account
 * @param {object} account - Bank account
 * @param {object} amount - Currency to withdraw
 * @param {object} bank - Bank configuration (for fees)
 * @param {string} reference - Transaction reference
 * @returns {object} {success, account, transaction, reason}
 */
export function withdraw(account, amount, bank, reference = "") {
  const withdrawalAmount = toCopper(amount);
  const fee = Math.round(withdrawalAmount * bank.fees.withdrawalFee);
  const totalRequired = withdrawalAmount + fee;
  const currentBalance = toCopper(account.balance);

  // Check minimum balance
  const minBalance = account.limits.minimumBalance * CurrencyRates[CurrencyType.GOLD];
  if (currentBalance - totalRequired < minBalance) {
    return {
      success: false,
      account,
      transaction: createTransaction({
        type: TransactionType.WITHDRAWAL,
        fromAccountId: account.id,
        amount,
        successful: false,
        failureReason: "Would violate minimum balance requirement"
      }),
      reason: "Would violate minimum balance requirement"
    };
  }

  // Check withdrawal limit
  if (account.limits.withdrawalLimit > 0) {
    const limitInCopper = account.limits.withdrawalLimit * CurrencyRates[CurrencyType.GOLD];
    if (account.limits.withdrawnThisPeriod + withdrawalAmount > limitInCopper) {
      return {
        success: false,
        account,
        transaction: createTransaction({
          type: TransactionType.WITHDRAWAL,
          fromAccountId: account.id,
          amount,
          successful: false,
          failureReason: "Exceeds withdrawal limit"
        }),
        reason: "Exceeds withdrawal limit"
      };
    }
  }

  // Check sufficient funds
  if (currentBalance < totalRequired) {
    return {
      success: false,
      account,
      transaction: createTransaction({
        type: TransactionType.WITHDRAWAL,
        fromAccountId: account.id,
        amount,
        successful: false,
        failureReason: "Insufficient funds"
      }),
      reason: "Insufficient funds"
    };
  }

  const newBalance = goldToCurrency(copperToGold(currentBalance - totalRequired));

  const transaction = createTransaction({
    type: TransactionType.WITHDRAWAL,
    fromAccountId: account.id,
    amount,
    fee: copperToGold(fee),
    reference
  });

  return {
    success: true,
    account: {
      ...account,
      balance: newBalance,
      transactions: [...account.transactions, transaction.id],
      limits: {
        ...account.limits,
        withdrawnThisPeriod: account.limits.withdrawnThisPeriod + withdrawalAmount,
        lastWithdrawal: Date.now()
      },
      updatedAt: Date.now()
    },
    transaction,
    reason: null
  };
}

/**
 * Transfer funds between accounts
 * @param {object} fromAccount - Source account
 * @param {object} toAccount - Destination account
 * @param {object} amount - Currency to transfer
 * @param {object} bank - Bank configuration
 * @param {string} reference - Transaction reference
 * @returns {object} {success, fromAccount, toAccount, transaction, reason}
 */
export function transfer(fromAccount, toAccount, amount, bank, reference = "") {
  const transferAmount = toCopper(amount);
  const fee = Math.round(transferAmount * bank.fees.transferFee);
  const totalRequired = transferAmount + fee;
  const currentBalance = toCopper(fromAccount.balance);

  if (currentBalance < totalRequired) {
    return {
      success: false,
      fromAccount,
      toAccount,
      transaction: createTransaction({
        type: TransactionType.TRANSFER,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        amount,
        successful: false,
        failureReason: "Insufficient funds"
      }),
      reason: "Insufficient funds"
    };
  }

  const newFromBalance = goldToCurrency(copperToGold(currentBalance - totalRequired));
  const newToBalance = addCurrency(toAccount.balance, amount);

  const transaction = createTransaction({
    type: TransactionType.TRANSFER,
    fromAccountId: fromAccount.id,
    toAccountId: toAccount.id,
    amount,
    fee: copperToGold(fee),
    reference
  });

  return {
    success: true,
    fromAccount: {
      ...fromAccount,
      balance: newFromBalance,
      transactions: [...fromAccount.transactions, transaction.id],
      updatedAt: Date.now()
    },
    toAccount: {
      ...toAccount,
      balance: newToBalance,
      transactions: [...toAccount.transactions, transaction.id],
      updatedAt: Date.now()
    },
    transaction,
    reason: null
  };
}

/**
 * Calculate loan payment schedule
 * @param {number} principal - Loan amount in gold
 * @param {number} interestRate - Interest rate per period
 * @param {number} numberOfPayments - Number of payments
 * @returns {object} {paymentAmount, totalInterest, totalDue}
 */
export function calculateLoanPayments(principal, interestRate, numberOfPayments) {
  // Simple interest calculation
  const totalInterest = principal * interestRate * (numberOfPayments / 12);
  const totalDue = principal + totalInterest;
  const paymentAmount = Math.ceil(totalDue / numberOfPayments);

  return {
    paymentAmount,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalDue: Math.round(totalDue * 100) / 100
  };
}

/**
 * Process loan payment
 * @param {object} loan - Loan record
 * @param {number} paymentAmount - Amount being paid (in gold)
 * @returns {object} Updated loan
 */
export function makeLoanPayment(loan, paymentAmount) {
  const newAmountPaid = loan.amountPaid + paymentAmount;
  const newRemainingBalance = Math.max(0, loan.totalDue - newAmountPaid);
  const newPaymentsMade = loan.paymentsMade + 1;

  let newStatus = loan.status;
  let paidOffAt = loan.paidOffAt;

  if (newRemainingBalance <= 0) {
    newStatus = LoanStatus.PAID;
    paidOffAt = Date.now();
  }

  return {
    ...loan,
    amountPaid: newAmountPaid,
    remainingBalance: newRemainingBalance,
    paymentsMade: newPaymentsMade,
    status: newStatus,
    paidOffAt,
    payments: [
      ...loan.payments,
      {
        id: generateId(),
        timestamp: Date.now(),
        amount: paymentAmount
      }
    ],
    updatedAt: Date.now()
  };
}

/**
 * Apply savings interest to account
 * @param {object} account - Bank account
 * @returns {object} Updated account
 */
export function applyInterest(account) {
  if (!account.interest.enabled) return account;

  const currentBalance = copperToGold(toCopper(account.balance));
  const interestEarned = currentBalance * account.interest.rate;

  if (interestEarned <= 0) return account;

  const interestCurrency = goldToCurrency(interestEarned);
  const newBalance = addCurrency(account.balance, interestCurrency);

  return {
    ...account,
    balance: newBalance,
    interest: {
      ...account.interest,
      lastAccrual: Date.now(),
      accruedAmount: account.interest.accruedAmount + interestEarned
    },
    updatedAt: Date.now()
  };
}

/**
 * Check if account can access a bank
 * @param {object} bank - Bank configuration
 * @param {object} context - Player context
 * @returns {object} {canAccess: boolean, reason: string}
 */
export function checkBankAccess(bank, context = {}) {
  const access = bank.access;

  // Check minimum deposit
  if (access.minimumDeposit > 0 && context.gold < access.minimumDeposit) {
    return {
      canAccess: false,
      reason: `Requires minimum deposit of ${access.minimumDeposit} gold`
    };
  }

  // Check faction requirement
  if (access.factionRequired) {
    const standing = context.factionStandings?.[access.factionRequired];
    if (!standing) {
      return {
        canAccess: false,
        reason: "Requires faction membership"
      };
    }

    if (access.factionRank && standing.rank !== access.factionRank) {
      return {
        canAccess: false,
        reason: `Requires faction rank: ${access.factionRank}`
      };
    }
  }

  // Check reputation
  if (access.reputationRequired > 0 && (context.reputation || 0) < access.reputationRequired) {
    return {
      canAccess: false,
      reason: `Requires ${access.reputationRequired} reputation`
    };
  }

  return { canAccess: true, reason: null };
}

/**
 * Check loan eligibility
 * @param {object} bank - Bank configuration
 * @param {object} account - Borrower's account
 * @param {number} requestedAmount - Loan amount requested
 * @param {object} context - Additional context
 * @returns {object} {eligible: boolean, maxAmount: number, reasons: string[]}
 */
export function checkLoanEligibility(bank, account, requestedAmount, context = {}) {
  const reasons = [];
  const loans = bank.loans;

  if (!loans.enabled) {
    return { eligible: false, maxAmount: 0, reasons: ["Loans not available"] };
  }

  // Check minimum and maximum
  if (requestedAmount < loans.minLoanAmount) {
    reasons.push(`Minimum loan amount is ${loans.minLoanAmount} gold`);
  }

  let maxAmount = loans.maxLoanAmount;

  // Check account age
  const accountAgeDays = (Date.now() - account.openedAt) / (24 * 60 * 60 * 1000);
  if (context.requirements?.accountAge > 0 && accountAgeDays < context.requirements.accountAge) {
    reasons.push(`Account must be at least ${context.requirements.accountAge} days old`);
  }

  // Check existing loans
  if (context.existingLoans?.length > 0) {
    const activeLoans = context.existingLoans.filter(l => l.status === LoanStatus.ACTIVE);
    if (activeLoans.length > 0) {
      reasons.push("Already have an active loan");
    }
  }

  // Check collateral
  if (loans.requiresCollateral) {
    const requiredCollateral = requestedAmount * loans.collateralRatio;
    if ((context.collateralValue || 0) < requiredCollateral) {
      reasons.push(`Requires collateral worth ${requiredCollateral} gold`);
    }
  }

  // Cap at maximum
  if (requestedAmount > maxAmount) {
    reasons.push(`Maximum loan amount is ${maxAmount} gold`);
  }

  return {
    eligible: reasons.length === 0,
    maxAmount: Math.min(requestedAmount, maxAmount),
    reasons
  };
}

/**
 * Validate bank account
 * @param {object} account - Bank account
 * @returns {object} {valid: boolean, errors: string[]}
 */
export function validateBankAccount(account) {
  const errors = [];

  if (!account.id) errors.push("Account ID is required");
  if (!account.ownerUuid) errors.push("Account owner is required");
  if (!Object.values(AccountType).includes(account.type)) {
    errors.push(`Invalid account type: ${account.type}`);
  }

  // Check for negative balances
  for (const [currency, amount] of Object.entries(account.balance)) {
    if (amount < 0) {
      errors.push(`Negative ${currency} balance not allowed`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Bank templates
 */
export const BankTemplates = {
  standard: {
    name: "Bank",
    services: {
      deposits: true,
      withdrawals: true,
      transfers: true,
      currencyExchange: true,
      loans: true
    },
    fees: {
      transactionFee: 0,
      withdrawalFee: 0,
      transferFee: 0.01,
      exchangeFee: 0.05
    },
    rates: {
      savingsInterest: 0.01,
      loanInterest: 0.1
    }
  },

  guild_bank: {
    name: "Guild Bank",
    services: {
      deposits: true,
      withdrawals: true,
      transfers: true,
      currencyExchange: false,
      loans: false,
      safeDeposit: true
    },
    fees: {
      transactionFee: 0,
      withdrawalFee: 0,
      transferFee: 0
    },
    access: {
      factionRequired: true
    }
  },

  moneylender: {
    name: "Moneylender",
    services: {
      deposits: false,
      withdrawals: false,
      transfers: false,
      currencyExchange: true,
      loans: true
    },
    fees: {
      exchangeFee: 0.1,
      loanOriginationFee: 0.05
    },
    rates: {
      loanInterest: 0.2
    },
    loans: {
      enabled: true,
      maxLoanAmount: 500,
      requiresCollateral: false
    }
  },

  royal_treasury: {
    name: "Royal Treasury",
    services: {
      deposits: true,
      withdrawals: true,
      transfers: true,
      currencyExchange: true,
      loans: true,
      safeDeposit: true
    },
    fees: {
      transactionFee: 0,
      withdrawalFee: 0,
      transferFee: 0,
      exchangeFee: 0.02
    },
    rates: {
      savingsInterest: 0.02,
      loanInterest: 0.05
    },
    access: {
      minimumDeposit: 1000,
      reputationRequired: 100
    }
  }
};

/**
 * Create bank from template
 * @param {string} templateName - Template name
 * @param {object} overrides - Data overrides
 * @returns {object}
 */
export function createBankFromTemplate(templateName, overrides = {}) {
  const template = BankTemplates[templateName] || BankTemplates.standard;
  return createBank({
    ...template,
    ...overrides
  });
}
