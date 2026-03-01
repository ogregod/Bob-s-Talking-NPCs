/**
 * Bob's Talking NPCs - Merchant Handler
 * Manages shops, pricing, inventory, haggling, and transactions
 */

// Define MODULE_ID locally to avoid circular dependency with module.mjs
const MODULE_ID = "bobs-talking-npcs";
import {
  createMerchant,
  createShopItem,
  createTransaction,
  BusinessType,
  BusinessCategory,
  StockRefreshType,
  ItemRarity,
  PriceDisplayMode,
  Currency,
  calculatePrice,
  roundPrice,
  convertToCurrency,
  convertToGold,
  checkShopAccess,
  checkItemRequirements,
  refreshStock,
  validateMerchant
} from "../data/merchant-model.mjs";
import {
  getBusinessDefinition,
  getBusinessTypeFromLegacyShopType
} from "../data/business-registry.mjs";
import { getExecutor, executeService } from "../services/service-executor-registry.mjs";
import { generateId, getFlag, setFlag, localize, formatCurrency } from "../utils/helpers.mjs";
import {
  sendPurchaseMessage,
  sendSaleMessage,
  sendIdentifyMessage,
  sendRepairMessage,
  sendAppraiseMessage,
  sendEnchantMessage,
  sendServiceRequestToGM,
  sendServiceRequestResult,
  getPrivateWhisperTargets
} from "../utils/chat.mjs";
import {
  createServiceRequest,
  ServiceRequestStatus,
  ApprovalRequiredServices,
  isRequestPending,
  isRequestReady,
  getTimeUntilReady,
  formatDuration,
  GameTimeUnits,
  getCurrentGameTime,
  calculateReadyGameTime,
  toGameTimeSeconds
} from "../data/service-request-model.mjs";
import { FailConsequence } from "../data/enchantment-model.mjs";
import { emit, emitToGM, SocketEvents, requestPickupFromGM } from "../socket.mjs";
import { ServiceSelectionDialog } from "../apps/service-selection-dialog.mjs";

/**
 * Check if an executor handles its own escrow/approval flow
 * (e.g., repair and enchant executors create their own requests)
 */
function _isEscrowExecutor(executor) {
  return executor && ["repair", "enchant"].includes(executor.id);
}

/**
 * Storage keys
 */
const STORAGE_KEYS = {
  MERCHANTS: "merchants",
  HAGGLING_HISTORY: "hagglingHistory"
};

/**
 * Merchant Handler Class
 * Singleton managing all merchant/shop operations
 */
export class MerchantHandler {
  constructor() {
    this._initialized = false;
    this._merchantCache = new Map();
    this._activeShopSessions = new Map();
  }

  /**
   * Initialize the merchant handler
   */
  async initialize() {
    if (this._initialized) return;

    await this._loadMerchants();

    this._initialized = true;
    console.log(`${MODULE_ID} | Merchant Handler initialized`);
  }

  // ==================== MERCHANT STORAGE ====================

  /**
   * Load merchants from storage
   * Loads from both worldData.merchants and shops settings for compatibility
   * @private
   */
  async _loadMerchants() {
    this._merchantCache.clear();
    let needsSave = false;

    // Load from worldData.merchants (primary storage)
    const worldData = game.settings.get(MODULE_ID, "worldData") || {};
    const merchants = worldData.merchants || {};
    for (const [id, merchantData] of Object.entries(merchants)) {
      const merchant = createMerchant(merchantData);
      if (this._migrateMerchant(merchant)) needsSave = true;
      this._merchantCache.set(id, merchant);
    }

    // Also load from shops settings (fallback storage) if not already in cache
    const shopsSettings = game.settings.get(MODULE_ID, "shops") || {};
    for (const [id, shopData] of Object.entries(shopsSettings)) {
      if (!this._merchantCache.has(id)) {
        const merchant = createMerchant(shopData);
        if (this._migrateMerchant(merchant)) needsSave = true;
        this._merchantCache.set(id, merchant);
      }
    }

    // Persist migrations
    if (needsSave) {
      await this._saveMerchants();
      console.log(`${MODULE_ID} | Migrated merchants to BusinessType format`);
    }
  }

  /**
   * Migrate a merchant from legacy ShopType to BusinessType if needed
   * @param {object} merchant - Merchant data object
   * @returns {boolean} true if migration occurred
   * @private
   */
  _migrateMerchant(merchant) {
    if (merchant.businessType) return false;
    if (!merchant.type) return false;

    const businessType = getBusinessTypeFromLegacyShopType(merchant.type);
    if (!businessType) return false;

    merchant.businessType = businessType;
    const def = getBusinessDefinition(businessType);
    if (def) {
      merchant.businessCategory = def.category;
    }
    merchant._dataVersion = 2;

    return true;
  }

  /**
   * Save merchants to storage
   * @private
   */
  async _saveMerchants() {
    const worldData = game.settings.get(MODULE_ID, "worldData") || {};
    worldData.merchants = Object.fromEntries(this._merchantCache);
    await game.settings.set(MODULE_ID, "worldData", worldData);
  }

  /**
   * Get merchant by ID
   * Checks cache, then worldData.merchants, then shops settings
   * @param {string} merchantId - Merchant ID
   * @returns {object|null}
   */
  getMerchant(merchantId) {
    // Try cache first
    let merchant = this._merchantCache.get(merchantId);
    if (merchant) return merchant;

    // Try worldData.merchants (primary storage)
    const worldData = game.settings.get(MODULE_ID, "worldData") || {};
    const merchants = worldData.merchants || {};
    if (merchants[merchantId]) {
      return createMerchant(merchants[merchantId]);
    }

    // Fall back to shops settings (fallback storage)
    const shopsSettings = game.settings.get(MODULE_ID, "shops") || {};
    if (shopsSettings[merchantId]) {
      return createMerchant(shopsSettings[merchantId]);
    }

    return null;
  }

  /**
   * Get all merchants
   * Merges from cache, worldData.merchants, and shops settings
   * @returns {object[]}
   */
  getAllMerchants() {
    const allMerchants = new Map();

    // Get from cache first
    for (const [id, merchant] of this._merchantCache) {
      allMerchants.set(id, merchant);
    }

    // Add from worldData.merchants if not in cache
    const worldData = game.settings.get(MODULE_ID, "worldData") || {};
    const merchants = worldData.merchants || {};
    for (const [id, merchantData] of Object.entries(merchants)) {
      if (!allMerchants.has(id)) {
        allMerchants.set(id, createMerchant(merchantData));
      }
    }

    // Add from shops settings if not already present
    const shopsSettings = game.settings.get(MODULE_ID, "shops") || {};
    for (const [id, shopData] of Object.entries(shopsSettings)) {
      if (!allMerchants.has(id)) {
        allMerchants.set(id, createMerchant(shopData));
      }
    }

    return Array.from(allMerchants.values());
  }

  /**
   * Get merchant for NPC
   * @param {string} npcActorUuid - NPC actor UUID
   * @returns {object|null}
   */
  getMerchantForNPC(npcActorUuid) {
    return this.getAllMerchants().find(m => m.npcActorUuid === npcActorUuid) || null;
  }

  /**
   * Get merchant by NPC's configured shop ID
   * Falls back to finding by npcActorUuid if shopId not found
   * @param {string} npcActorUuid - NPC actor UUID
   * @param {string} shopId - Optional explicit shop ID from NPC config
   * @returns {object|null}
   */
  getMerchantForNPCConfig(npcActorUuid, shopId = null) {
    // If explicit shopId provided, use it
    if (shopId) {
      const merchant = this.getMerchant(shopId);
      if (merchant) return merchant;
    }

    // Fall back to finding by npcActorUuid
    return this.getMerchantForNPC(npcActorUuid);
  }

  // ==================== MERCHANT CRUD ====================

  /**
   * Create a new merchant
   * @param {object} data - Merchant data
   * @returns {object}
   */
  async createMerchant(data) {
    const merchant = createMerchant({
      ...data,
      id: data.id || generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    const validation = validateMerchant(merchant);
    if (!validation.valid) {
      console.warn(`${MODULE_ID} | Merchant validation errors:`, validation.errors);
    }

    this._merchantCache.set(merchant.id, merchant);
    await this._saveMerchants();

    Hooks.callAll("bobsNPCMerchantCreated", merchant);

    return merchant;
  }

  /**
   * Update a merchant
   * @param {string} merchantId - Merchant ID
   * @param {object} updates - Updates to apply
   * @returns {object|null}
   */
  async updateMerchant(merchantId, updates) {
    const merchant = this.getMerchant(merchantId);
    if (!merchant) return null;

    const updatedMerchant = {
      ...merchant,
      ...updates,
      id: merchantId,
      updatedAt: Date.now()
    };

    this._merchantCache.set(merchantId, updatedMerchant);
    await this._saveMerchants();

    Hooks.callAll("bobsNPCMerchantUpdated", updatedMerchant);

    return updatedMerchant;
  }

  /**
   * Delete a merchant
   * @param {string} merchantId - Merchant ID
   * @returns {boolean}
   */
  async deleteMerchant(merchantId) {
    if (!this._merchantCache.has(merchantId)) return false;

    this._merchantCache.delete(merchantId);
    await this._saveMerchants();

    Hooks.callAll("bobsNPCMerchantDeleted", merchantId);

    return true;
  }

  // ==================== SHOP ACCESS ====================

  /**
   * Open a shop for a player
   * @param {string} merchantId - Merchant ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object} {success, merchant, items, message}
   */
  async openShop(merchantId, playerActorUuid) {
    const merchant = this.getMerchant(merchantId);
    if (!merchant) {
      return { success: false, message: localize("Shop.ShopNotFound") };
    }

    // Build context for access check
    const context = await this._buildPlayerContext(playerActorUuid);

    // Check access
    const accessResult = checkShopAccess(merchant, context);
    if (!accessResult.canAccess) {
      return {
        success: false,
        message: merchant.access.closedMessage || accessResult.reason
      };
    }

    // Get available items with prices
    const items = await this._getShopItemsForPlayer(merchant, context);

    // Create shop session
    const sessionId = generateId();
    this._activeShopSessions.set(sessionId, {
      merchantId,
      playerActorUuid,
      startedAt: Date.now(),
      cart: []
    });

    Hooks.callAll("bobsNPCShopOpened", merchant, playerActorUuid);

    return {
      success: true,
      sessionId,
      merchant,
      items,
      message: null
    };
  }

  /**
   * Close a shop session
   * @param {string} sessionId - Session ID
   */
  closeShop(sessionId) {
    this._activeShopSessions.delete(sessionId);
  }

  /**
   * Build player context for price calculations
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object}
   * @private
   */
  async _buildPlayerContext(playerActorUuid) {
    const actor = await fromUuid(playerActorUuid);
    if (!actor) return {};

    // Get charisma modifier
    const charisma = actor.system?.abilities?.cha?.mod || 0;

    // Get faction standings
    const factionStandings = await game.bobsnpc?.handlers?.faction?.getAllStandings?.(playerActorUuid) || {};

    // Get completed quests
    const completedQuests = await game.bobsnpc?.handlers?.quest?.getCompletedQuests?.(playerActorUuid) || [];

    // Get current gold
    const gold = convertToGold(actor.system?.currency || {});

    return {
      actor,
      charismaModifier: charisma,
      factionStandings,
      completedQuests: completedQuests.map(q => q.id),
      gold,
      playerLevel: actor.system?.details?.level || 0
    };
  }

  /**
   * Get shop items with availability and pricing for player
   * @param {object} merchant - Merchant data
   * @param {object} context - Player context
   * @returns {object[]}
   * @private
   */
  async _getShopItemsForPlayer(merchant, context) {
    const items = [];

    for (const shopItem of merchant.inventory) {
      // Check requirements
      const reqCheck = checkItemRequirements(shopItem, context);

      // Calculate price
      const priceInfo = calculatePrice(shopItem, merchant, context, "buy");

      // Get item details from UUID
      let itemDetails = null;
      if (shopItem.itemUuid) {
        const item = await fromUuid(shopItem.itemUuid);
        if (item) {
          itemDetails = {
            name: item.name,
            img: item.img,
            type: item.type,
            rarity: item.system?.rarity || "common",
            description: item.system?.description?.value || ""
          };
        }
      }

      items.push({
        ...shopItem,
        itemDetails,
        displayName: shopItem.name || itemDetails?.name || "Unknown Item",
        displayImg: itemDetails?.img || "icons/svg/item-bag.svg",
        canPurchase: reqCheck.canPurchase,
        purchaseReason: reqCheck.reason,
        basePrice: priceInfo.basePrice,
        finalPrice: priceInfo.finalPrice,
        discounts: priceInfo.discounts,
        priceDisplay: this._formatPrice(priceInfo.finalPrice, merchant.pricing.displayMode)
      });
    }

    return items;
  }

  /**
   * Format price for display
   * @param {number} price - Price in gold
   * @param {string} displayMode - Display mode
   * @returns {string}
   * @private
   */
  _formatPrice(price, displayMode) {
    switch (displayMode) {
      case PriceDisplayMode.HIDDEN:
        return "???";
      case PriceDisplayMode.ASK:
        return localize("Shop.AskPrice");
      case PriceDisplayMode.RANGE:
        const low = Math.floor(price * 0.8);
        const high = Math.ceil(price * 1.2);
        return `${low}-${high} gp`;
      case PriceDisplayMode.EXACT:
      default:
        return this._formatCurrency(price);
    }
  }

  /**
   * Format currency for display
   * @param {number} gold - Amount in gold
   * @returns {string}
   * @private
   */
  _formatCurrency(gold) {
    const currency = convertToCurrency(gold);
    const parts = [];

    if (currency.pp > 0) parts.push(`${currency.pp} pp`);
    if (currency.gp > 0) parts.push(`${currency.gp} gp`);
    if (currency.sp > 0) parts.push(`${currency.sp} sp`);
    if (currency.cp > 0) parts.push(`${currency.cp} cp`);

    return parts.join(", ") || "0 gp";
  }

  // ==================== TRANSACTIONS ====================

  /**
   * Purchase items from shop
   * @param {string} sessionId - Shop session ID
   * @param {object[]} purchases - Array of {itemId, quantity}
   * @returns {object} {success, transaction, message, items}
   */
  async purchaseItems(sessionId, purchases) {
    const session = this._activeShopSessions.get(sessionId);
    if (!session) {
      return { success: false, message: localize("Shop.SessionNotFound") };
    }

    const merchant = this.getMerchant(session.merchantId);
    if (!merchant) {
      return { success: false, message: localize("Shop.ShopNotFound") };
    }

    const context = await this._buildPlayerContext(session.playerActorUuid);
    const actor = context.actor;

    // Calculate total and validate purchases
    let totalCost = 0;
    const itemsToPurchase = [];

    for (const purchase of purchases) {
      const shopItem = merchant.inventory.find(i => i.id === purchase.itemId);
      if (!shopItem) continue;

      // Check availability
      const reqCheck = checkItemRequirements(shopItem, context);
      if (!reqCheck.canPurchase) {
        return { success: false, message: `${shopItem.name}: ${reqCheck.reason}` };
      }

      // Check quantity
      if (shopItem.quantity !== -1 && shopItem.quantity < purchase.quantity) {
        return { success: false, message: localize("Shop.InsufficientStock") };
      }

      // Calculate price
      const priceInfo = calculatePrice(shopItem, merchant, context, "buy");
      const itemTotal = priceInfo.finalPrice * purchase.quantity;
      totalCost += itemTotal;

      itemsToPurchase.push({
        shopItem,
        quantity: purchase.quantity,
        unitPrice: priceInfo.finalPrice,
        totalPrice: itemTotal
      });
    }

    // Check if player can afford
    if (context.gold < totalCost) {
      return { success: false, message: localize("Shop.InsufficientFunds") };
    }

    // Process purchase
    const purchasedItems = [];

    for (const purchase of itemsToPurchase) {
      // Give item to player
      if (purchase.shopItem.itemUuid) {
        const item = await fromUuid(purchase.shopItem.itemUuid);
        if (item) {
          const itemData = item.toObject();
          itemData.system.quantity = purchase.quantity;
          const created = await actor.createEmbeddedDocuments("Item", [itemData]);
          purchasedItems.push(created[0]);
        }
      }

      // Update shop inventory
      if (purchase.shopItem.quantity !== -1) {
        const newQty = purchase.shopItem.quantity - purchase.quantity;
        await this._updateShopItemQuantity(merchant.id, purchase.shopItem.id, newQty);
      }
    }

    // Deduct gold
    await this._deductGold(actor, totalCost);

    // Record transaction
    const transaction = createTransaction({
      type: "buy",
      buyerUuid: session.playerActorUuid,
      shopId: merchant.id,
      items: itemsToPurchase.map(p => ({
        itemUuid: p.shopItem.itemUuid,
        name: p.shopItem.name,
        quantity: p.quantity,
        price: p.unitPrice
      })),
      totalPrice: totalCost,
      currency: Currency.GOLD
    });

    if (merchant.trackTransactions) {
      await this._recordTransaction(merchant.id, transaction);
    }

    Hooks.callAll("bobsNPCPurchase", merchant, session.playerActorUuid, purchasedItems, totalCost);

    // Send private chat message
    await sendPurchaseMessage({
      playerName: actor.name,
      merchantName: merchant.name || "Merchant",
      items: itemsToPurchase.map(p => ({
        name: p.shopItem.name,
        quantity: p.quantity,
        price: p.unitPrice
      })),
      total: totalCost,
      playerId: game.user?.id
    });

    return {
      success: true,
      transaction,
      items: purchasedItems,
      totalCost,
      message: localize("Shop.PurchaseComplete")
    };
  }

  /**
   * Sell items to shop
   * @param {string} sessionId - Shop session ID
   * @param {object[]} sales - Array of {itemUuid, quantity}
   * @returns {object} {success, transaction, totalValue, message}
   */
  async sellItems(sessionId, sales) {
    const session = this._activeShopSessions.get(sessionId);
    if (!session) {
      return { success: false, message: localize("Shop.SessionNotFound") };
    }

    const merchant = this.getMerchant(session.merchantId);
    if (!merchant) {
      return { success: false, message: localize("Shop.ShopNotFound") };
    }

    if (!merchant.buyBack.enabled) {
      return { success: false, message: localize("Shop.ShopDoesNotBuy") };
    }

    const context = await this._buildPlayerContext(session.playerActorUuid);
    const actor = context.actor;

    let totalValue = 0;
    const itemsToSell = [];

    // Ensure buyBack has required arrays (defensive for old shop data)
    const acceptedTypes = merchant.buyBack?.itemTypes || [];
    const excludedTypes = merchant.buyBack?.excludeTypes || [];

    for (const sale of sales) {
      const item = actor.items.find(i => i.uuid === sale.itemUuid || i.id === sale.itemId);
      if (!item) continue;

      // Check if shop buys this type (empty array = all types accepted)
      if (acceptedTypes.length > 0 && !acceptedTypes.includes(item.type)) {
        continue;
      }

      if (excludedTypes.includes(item.type)) {
        continue;
      }

      // Check if equipped
      if (merchant.buyBack.excludeEquipped && item.system?.equipped) {
        continue;
      }

      // Check if attuned
      if (merchant.buyBack.excludeAttuned && item.system?.attunement === 2) {
        continue;
      }

      // Get base price and type-specific multiplier
      const basePrice = item.system?.price?.value || 0;
      const typeMultiplier = merchant.buyBack?.typeMultipliers?.[item.type]
        ?? merchant.pricing.baseSellMultiplier;
      const sellPrice = basePrice * typeMultiplier;

      // Check max value
      if (merchant.buyBack.maxValue > 0 && sellPrice > merchant.buyBack.maxValue) {
        continue;
      }

      const quantity = Math.min(sale.quantity || 1, item.system?.quantity || 1);
      const itemTotal = sellPrice * quantity;

      totalValue += itemTotal;
      itemsToSell.push({ item, quantity, unitPrice: sellPrice, totalPrice: itemTotal });
    }

    if (itemsToSell.length === 0) {
      return { success: false, message: localize("Shop.NoItemsToSell") };
    }

    // Check shop can afford (if not unlimited)
    if (!merchant.drawer.unlimited) {
      const drawerValue = convertToGold(merchant.drawer);
      if (drawerValue < totalValue) {
        return { success: false, message: localize("Shop.ShopCannotAfford") };
      }
    }

    // Process sale
    for (const sale of itemsToSell) {
      const currentQty = sale.item.system?.quantity || 1;
      if (currentQty <= sale.quantity) {
        await sale.item.delete();
      } else {
        await sale.item.update({ "system.quantity": currentQty - sale.quantity });
      }
    }

    // Add sold items to shop's back room (if enabled)
    if (merchant.backroom?.enabled && merchant.backroom?.autoAddPurchasedItems) {
      for (const sale of itemsToSell) {
        const backroomItem = createShopItem({
          itemUuid: sale.item.uuid || null,
          name: sale.item.name,
          img: sale.item.img,
          quantity: sale.quantity,
          basePrice: sale.item.system?.price?.value || sale.unitPrice,
          category: sale.item.type,
          rarity: sale.item.system?.rarity || "common",
          notes: `Purchased from ${actor.name}`
        });
        await this._addToBackroom(merchant.id, backroomItem);
      }
    }

    // Give gold to player
    await this._giveGold(actor, totalValue);

    // Update shop drawer
    if (!merchant.drawer.unlimited) {
      await this._deductFromDrawer(merchant.id, totalValue);
    }

    // Record transaction
    const transaction = createTransaction({
      type: "sell",
      sellerUuid: session.playerActorUuid,
      shopId: merchant.id,
      items: itemsToSell.map(s => ({
        itemUuid: s.item.uuid,
        name: s.item.name,
        quantity: s.quantity,
        price: s.unitPrice
      })),
      totalPrice: totalValue,
      currency: Currency.GOLD
    });

    if (merchant.trackTransactions) {
      await this._recordTransaction(merchant.id, transaction);
    }

    Hooks.callAll("bobsNPCSale", merchant, session.playerActorUuid, itemsToSell, totalValue);

    // Send private chat message
    await sendSaleMessage({
      playerName: actor.name,
      merchantName: merchant.name || "Merchant",
      items: itemsToSell.map(s => ({
        name: s.item.name,
        quantity: s.quantity,
        price: s.unitPrice
      })),
      total: totalValue,
      playerId: game.user?.id
    });

    return {
      success: true,
      transaction,
      totalValue,
      message: `${localize("Shop.SaleComplete")}: ${this._formatCurrency(totalValue)}`
    };
  }

  // ==================== HAGGLING ====================

  /**
   * Attempt to haggle for a better price
   * @param {string} sessionId - Shop session ID
   * @param {string} itemId - Item ID
   * @param {string} skill - Skill used (persuasion, intimidation, deception)
   * @param {number} rollTotal - Roll result
   * @returns {object} {success, newPrice, discount, consequence, message}
   */
  async attemptHaggle(sessionId, itemId, skill, rollTotal) {
    const session = this._activeShopSessions.get(sessionId);
    if (!session) {
      return { success: false, message: localize("Shop.SessionNotFound") };
    }

    const merchant = this.getMerchant(session.merchantId);
    if (!merchant || !merchant.haggling.enabled) {
      return { success: false, message: localize("Shop.HagglingDisabled") };
    }

    const haggling = merchant.haggling;
    const playerActorUuid = session.playerActorUuid;

    // Check haggling history
    const history = haggling.history[playerActorUuid] || { attempts: 0, lastAttempt: null, banned: false };

    if (history.banned) {
      return { success: false, message: haggling.refuseServiceMessage };
    }

    // Check cooldown
    if (history.lastAttempt) {
      const cooldownMs = haggling.cooldownHours * 60 * 60 * 1000;
      if (Date.now() - history.lastAttempt < cooldownMs) {
        return { success: false, message: localize("Shop.HagglingCooldown") };
      }
    }

    // Check max attempts
    if (history.attempts >= haggling.maxAttempts) {
      return { success: false, message: localize("Shop.HagglingMaxAttempts") };
    }

    // Get DC for skill
    const dc = this._getHagglingDC(haggling, skill);

    // Determine success
    const success = rollTotal >= dc;
    const criticalSuccess = rollTotal >= dc + 10;

    let discount = 0;
    let consequence = null;

    if (success) {
      discount = criticalSuccess ? haggling.criticalSuccessDiscount : haggling.successDiscount;
      discount = Math.min(discount, haggling.maximumDiscount);
    } else {
      // Apply failure consequence
      consequence = haggling.failureConsequences[skill];

      switch (consequence) {
        case "price_increase":
          discount = -haggling.failurePriceIncrease;
          break;
        case "refuse_service":
          history.banned = true;
          break;
        case "none":
        default:
          break;
      }
    }

    // Update history
    history.attempts++;
    history.lastAttempt = Date.now();

    await this.updateMerchant(merchant.id, {
      haggling: {
        ...haggling,
        history: {
          ...haggling.history,
          [playerActorUuid]: history
        }
      }
    });

    // Calculate new price if item specified
    let newPrice = null;
    if (itemId && discount !== 0) {
      const shopItem = merchant.inventory.find(i => i.id === itemId);
      if (shopItem) {
        const context = await this._buildPlayerContext(playerActorUuid);
        const priceInfo = calculatePrice(shopItem, merchant, context, "buy");
        newPrice = priceInfo.finalPrice * (1 - discount);
      }
    }

    Hooks.callAll("bobsNPCHaggle", merchant, playerActorUuid, skill, success, discount);

    return {
      success,
      criticalSuccess,
      discount,
      newPrice,
      consequence,
      message: success
        ? localize("Shop.HagglingSuccess")
        : localize("Shop.HagglingFailed")
    };
  }

  /**
   * Get haggling DC for skill
   * @param {object} haggling - Haggling config
   * @param {string} skill - Skill name
   * @returns {number}
   * @private
   */
  _getHagglingDC(haggling, skill) {
    switch (skill.toLowerCase()) {
      case "persuasion": return haggling.persuasionDC;
      case "intimidation": return haggling.intimidationDC;
      case "deception": return haggling.deceptionDC;
      case "insight": return haggling.insightDC;
      default: return haggling.persuasionDC;
    }
  }

  // ==================== INVENTORY MANAGEMENT ====================

  /**
   * Add item to shop inventory
   * @param {string} merchantId - Merchant ID
   * @param {object} itemData - Item data
   * @returns {object|null}
   */
  async addShopItem(merchantId, itemData) {
    const merchant = this.getMerchant(merchantId);
    if (!merchant) return null;

    const shopItem = createShopItem(itemData);
    const updatedInventory = [...merchant.inventory, shopItem];

    await this.updateMerchant(merchantId, { inventory: updatedInventory });

    return shopItem;
  }

  /**
   * Remove item from shop inventory
   * @param {string} merchantId - Merchant ID
   * @param {string} itemId - Shop item ID
   * @returns {boolean}
   */
  async removeShopItem(merchantId, itemId) {
    const merchant = this.getMerchant(merchantId);
    if (!merchant) return false;

    const updatedInventory = merchant.inventory.filter(i => i.id !== itemId);
    await this.updateMerchant(merchantId, { inventory: updatedInventory });

    return true;
  }

  /**
   * Update shop item quantity
   * @param {string} merchantId - Merchant ID
   * @param {string} itemId - Shop item ID
   * @param {number} quantity - New quantity
   * @private
   */
  async _updateShopItemQuantity(merchantId, itemId, quantity) {
    const merchant = this.getMerchant(merchantId);
    if (!merchant) return;

    const updatedInventory = merchant.inventory.map(item =>
      item.id === itemId ? { ...item, quantity } : item
    );

    await this.updateMerchant(merchantId, { inventory: updatedInventory });
  }

  /**
   * Refresh shop stock
   * @param {string} merchantId - Merchant ID
   */
  async refreshShopStock(merchantId) {
    const merchant = this.getMerchant(merchantId);
    if (!merchant) return;

    const refreshedMerchant = refreshStock(merchant);
    await this.updateMerchant(merchantId, {
      inventory: refreshedMerchant.inventory,
      stockRefresh: refreshedMerchant.stockRefresh
    });

    Hooks.callAll("bobsNPCStockRefreshed", refreshedMerchant);
  }

  /**
   * Check and refresh all shops based on schedule
   */
  async checkStockRefresh() {
    const now = Date.now();

    for (const merchant of this.getAllMerchants()) {
      const refresh = merchant.stockRefresh;
      if (refresh.type === StockRefreshType.NEVER) {
        continue;
      }

      const lastRefresh = refresh.lastRefresh || 0;
      let shouldRefresh = false;

      switch (refresh.type) {
        case StockRefreshType.DAILY:
          shouldRefresh = now - lastRefresh > 24 * 60 * 60 * 1000;
          break;
        case StockRefreshType.WEEKLY:
          shouldRefresh = now - lastRefresh > 7 * 24 * 60 * 60 * 1000;
          break;
        case StockRefreshType.MONTHLY:
          shouldRefresh = now - lastRefresh > 30 * 24 * 60 * 60 * 1000;
          break;
        case StockRefreshType.CUSTOM:
          const intervalDays = refresh.customIntervalDays || 7;
          shouldRefresh = now - lastRefresh > intervalDays * 24 * 60 * 60 * 1000;
          break;
      }

      if (shouldRefresh) {
        await this.refreshShopStock(merchant.id);
      }
    }
  }

  // ==================== SERVICES ====================

  /**
   * Use a shop service
   * @param {string} sessionId - Shop session ID
   * @param {string} service - Service type
   * @param {object} options - Service options
   * @returns {object} {success, cost, message}
   */
  async useService(sessionId, service, options = {}) {
    const session = this._activeShopSessions.get(sessionId);
    if (!session) {
      return { success: false, message: localize("Shop.SessionNotFound") };
    }

    const merchant = this.getMerchant(session.merchantId);
    if (!merchant) {
      return { success: false, message: localize("Shop.ShopNotFound") };
    }

    const context = await this._buildPlayerContext(session.playerActorUuid);
    const actor = context.actor;

    // Resolve the service definition from the merchant
    const serviceDef = this._resolveServiceDefinition(merchant, service);
    if (!serviceDef) {
      return { success: false, message: localize("Shop.ServiceNotAvailable") };
    }

    // Show service selection dialog for services with dynamic pricing (tiered, spell level, enchantment)
    if (ServiceSelectionDialog.needsDialog(serviceDef)) {
      const item = options.itemId ? actor.items.get(options.itemId) : null;
      const dialogResult = await ServiceSelectionDialog.show(serviceDef, { actor, merchant, item });
      if (!dialogResult?.confirmed) {
        return { success: false, cancelled: true, message: localize("Shop.ServiceCancelled") };
      }
      // Merge dialog selections into options
      options = {
        ...options,
        selectedTier: dialogResult.tier,
        spellLevel: dialogResult.spellLevel,
        quantity: dialogResult.quantity,
        enchantmentId: dialogResult.enchantment?.id || options.enchantmentId
      };
    }

    // Resolve approval mode
    const approvalMode = this._resolveApprovalMode(merchant, serviceDef);

    // Get the executor for this service type
    const executor = getExecutor(service);
    if (!executor) {
      return { success: false, message: localize("Shop.ServiceNotAvailable") };
    }

    // Build execution context
    const execContext = {
      actor,
      merchant,
      serviceDef,
      options,
      gameTime: game?.time?.worldTime ?? 0,
      deductGold: this._deductGold.bind(this),
      restoreItemFromEscrow: this._restoreItemFromEscrow.bind(this)
    };

    // If approval is required and the executor doesn't handle its own escrow,
    // route through the general approval flow
    if (approvalMode === "request" && !_isEscrowExecutor(executor)) {
      return this._submitServiceRequest(merchant, actor, serviceDef, executor, options);
    }

    // Execute directly (auto-approve or executor handles its own approval)
    return executor.execute(execContext);
  }

  /**
   * Resolve the service definition for a given service type from the merchant
   * @param {object} merchant - Merchant data
   * @param {string} serviceType - Service type string
   * @returns {object|null}
   * @private
   */
  _resolveServiceDefinition(merchant, serviceType) {
    // First check servicesList for registry-defined services
    const fromList = (merchant.servicesList || []).find(s => s.type === serviceType && s.enabled);
    if (fromList) return fromList;

    // Check legacy service booleans (identify, repair, appraise, enchant)
    const legacyMap = {
      identify: { type: "identify", enabled: merchant.services?.identify, basePrice: merchant.services?.identifyPrice || 25, icon: "fa-magnifying-glass", name: "Identify" },
      repair: { type: "repair", enabled: merchant.services?.repair, basePrice: 0, priceType: "percent", pricePercent: merchant.services?.repairPricePercent || 10, icon: "fa-wrench", name: "Repair" },
      appraise: { type: "appraise", enabled: merchant.services?.appraise, basePrice: merchant.services?.appraisePrice || 5, icon: "fa-gem", name: "Appraise" },
      enchant: { type: "enchant", enabled: merchant.services?.enchant, basePrice: 0, icon: "fa-wand-magic-sparkles", name: "Enchant", enchantmentPriceModifier: merchant.services?.enchantmentPriceModifier || 1 }
    };

    if (legacyMap[serviceType]?.enabled) {
      return legacyMap[serviceType];
    }

    return null;
  }

  /**
   * Resolve the approval mode for a service.
   * Priority: per-service override > shop default > template default > global default > "auto"
   * @param {object} merchant - Merchant data
   * @param {object} serviceDef - Service definition
   * @returns {string} "auto" or "request"
   * @private
   */
  _resolveApprovalMode(merchant, serviceDef) {
    // 1. Per-service override
    if (serviceDef.approvalMode && serviceDef.approvalMode !== "inherit") {
      return serviceDef.approvalMode;
    }

    // 2. Shop-wide default
    if (merchant.defaultApprovalMode) {
      return merchant.defaultApprovalMode;
    }

    // 3. Template default (from service database)
    if (serviceDef.templateId) {
      const serviceDB = game.bobsnpc?.handlers?.serviceDatabase;
      const template = serviceDB?.getTemplate(serviceDef.templateId);
      if (template?.defaultApprovalMode) return template.defaultApprovalMode;
    }

    // 4. Global default for this service type
    try {
      const globals = game.settings.get(MODULE_ID, "globalApprovalDefaults") || {};
      if (globals[serviceDef.type]) return globals[serviceDef.type];
    } catch (e) {
      // Setting may not be registered yet
    }

    // 5. Default to auto
    return "auto";
  }

  /**
   * Submit a service request for GM approval (for non-escrow services).
   * This is the generalized version that works with any service type.
   * @private
   */
  async _submitServiceRequest(merchant, actor, serviceDef, executor, options) {
    const cost = serviceDef.basePrice || 0;
    const gold = convertToGold(actor.system?.currency || {});

    if (cost > 0 && gold < cost) {
      return { success: false, message: localize("Shop.InsufficientFunds") };
    }

    // Create a service request without item escrow
    const request = createServiceRequest({
      type: serviceDef.type,
      merchantId: merchant.id,
      merchantName: merchant.name || "Merchant",
      playerActorUuid: actor.uuid,
      playerActorId: actor.id,
      playerName: actor.name,
      playerId: game.user?.id,
      cost,
      serviceName: serviceDef.name || serviceDef.type,
      serviceIcon: serviceDef.icon || "fa-concierge-bell"
    });

    // Store the request
    if (game.user.isGM) {
      const pendingRequests = game.settings.get(MODULE_ID, "pendingServiceRequests") || [];
      pendingRequests.push(request);
      await game.settings.set(MODULE_ID, "pendingServiceRequests", pendingRequests);
    } else {
      emitToGM(SocketEvents.SERVICE_REQUEST, { request });
    }

    // Notify GM
    await sendServiceRequestToGM({
      type: serviceDef.type,
      playerName: actor.name,
      merchantName: merchant.name || "Merchant",
      cost,
      requestId: request.id,
      serviceName: serviceDef.name
    });

    ui.notifications.info(localize("Shop.Service.PendingApproval"));

    return {
      success: true,
      pending: true,
      requestId: request.id,
      cost,
      message: localize("Shop.Service.PendingApproval")
    };
  }

  /**
   * Process a service request (called by GM to approve)
   * @param {string} requestId - Request ID
   * @param {boolean} approved - Whether the request is approved
   * @param {string} [reason] - Reason for denial
   * @param {object} [options] - Additional options
   * @param {number} [options.durationDays] - Duration in game days
   * @param {number} [options.durationHours] - Duration in game hours
   * @returns {Promise<object>}
   */
  async processServiceRequest(requestId, approved, reason = null, options = {}) {
    if (!game.user.isGM) {
      return { success: false, message: "Only GMs can process service requests" };
    }

    // Find and remove the request
    const pendingRequests = game.settings.get(MODULE_ID, "pendingServiceRequests") || [];
    const requestIndex = pendingRequests.findIndex(r => r.id === requestId);

    if (requestIndex === -1) {
      return { success: false, message: "Request not found" };
    }

    const request = pendingRequests[requestIndex];
    pendingRequests.splice(requestIndex, 1);
    await game.settings.set(MODULE_ID, "pendingServiceRequests", pendingRequests);

    if (!approved) {
      // Restore item to player since we're denying the request
      const actor = await fromUuid(request.playerActorUuid);
      if (actor && request.itemData) {
        await this._restoreItemFromEscrow(actor, request.itemData);
        ui.notifications.info(localize("Service.ItemReturned", { item: request.itemName }));
      }

      // Notify player of denial
      emit(SocketEvents.SERVICE_DENY, {
        requestId,
        playerId: request.playerId,
        reason
      });

      await sendServiceRequestResult({
        type: request.type,
        status: "denied",
        itemName: request.itemName,
        playerId: request.playerId
      });

      return { success: true, message: "Request denied" };
    }

    // Process the approved request
    const actor = await fromUuid(request.playerActorUuid);
    if (!actor) {
      return { success: false, message: "Player actor not found" };
    }

    const merchant = this.getMerchant(request.merchantId);
    if (!merchant) {
      return { success: false, message: "Merchant not found" };
    }

    // Deduct gold from player
    await this._deductGold(actor, request.cost);

    // Check if this is a non-item service that should execute immediately on approval
    const isItemEscrow = !!request.itemData;

    if (!isItemEscrow) {
      // Non-item service: execute immediately via executor
      const executor = getExecutor(request.type);
      if (executor && typeof executor.execute === "function") {
        const execContext = {
          actor,
          merchant,
          serviceDef: { type: request.type, name: request.serviceName, icon: request.serviceIcon, basePrice: 0 },
          options: request.customData || {},
          gameTime: getCurrentGameTime(),
          deductGold: async () => {}, // Gold already deducted above
          restoreItemFromEscrow: this._restoreItemFromEscrow.bind(this)
        };

        try {
          await executor.execute(execContext);
        } catch (err) {
          console.error(`${MODULE_ID} | Error executing approved service:`, err);
        }
      }

      // Notify player of approval and immediate completion
      emit(SocketEvents.SERVICE_APPROVE, {
        requestId,
        playerId: request.playerId,
        readyAtGameTime: getCurrentGameTime(),
        readyTimeStr: "Complete"
      });

      return { success: true, message: "Request approved and service executed" };
    }

    // Item escrow service: goes through the standard duration/pickup flow
    let durationDays = options.durationDays ?? 0;
    let durationHours = options.durationHours ?? 0;

    // If no custom duration provided, use settings defaults
    if (durationDays === 0 && durationHours === 0) {
      try {
        durationDays = request.type === "repair"
          ? game.settings.get(MODULE_ID, "repairDuration")
          : game.settings.get(MODULE_ID, "enchantDuration");
      } catch (e) {
        durationDays = 1;
      }
    }

    // Convert to game time seconds
    const workDurationSeconds = toGameTimeSeconds(durationDays, durationHours);
    const currentGameTime = getCurrentGameTime();
    const readyAtGameTime = calculateReadyGameTime(workDurationSeconds);

    // Create an active service order (item is being worked on)
    const serviceOrder = {
      ...request,
      status: ServiceRequestStatus.APPROVED,
      processedAt: Date.now(),
      processedBy: game.user.id,
      workDuration: workDurationSeconds,
      startedAtGameTime: currentGameTime,
      readyAtGameTime: readyAtGameTime,
      readyAt: null
    };

    // Add to active orders
    const activeOrders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
    activeOrders.push(serviceOrder);
    await game.settings.set(MODULE_ID, "activeServiceOrders", activeOrders);

    // Notify player of approval with pickup time
    const readyTimeStr = workDurationSeconds > 0 ? formatDuration(workDurationSeconds) : "Ready now";

    emit(SocketEvents.SERVICE_APPROVE, {
      requestId,
      playerId: request.playerId,
      readyAtGameTime,
      readyTimeStr
    });

    // Send chat message about the order being accepted
    await this._sendServiceAcceptedMessage({
      type: request.type,
      playerName: request.playerName,
      merchantName: request.merchantName,
      itemName: request.itemName,
      itemImg: request.itemImg,
      enchantmentName: request.enchantmentName,
      cost: request.cost,
      readyTimeStr,
      playerId: request.playerId
    });

    return { success: true, message: "Request approved - item is being worked on" };
  }

  /**
   * Show a dialog for GM to approve/deny a service request with options
   * @param {string} requestId - Request ID
   * @returns {Promise<object>}
   */
  async showServiceApprovalDialog(requestId) {
    if (!game.user.isGM) {
      return { success: false, message: "Only GMs can process service requests" };
    }

    const pendingRequests = game.settings.get(MODULE_ID, "pendingServiceRequests") || [];
    const request = pendingRequests.find(r => r.id === requestId);

    if (!request) {
      return { success: false, message: "Request not found" };
    }

    // Get default duration based on type (in days for game time)
    let defaultDurationDays = 1;
    try {
      if (request.type === "repair") {
        defaultDurationDays = game.settings.get(MODULE_ID, "repairDuration");
      } else if (request.type === "enchant") {
        defaultDurationDays = game.settings.get(MODULE_ID, "enchantDuration");
      }
    } catch (e) {
      defaultDurationDays = 1;
    }

    const serviceType = request.serviceName || request.type;

    const content = `
      <form class="bobsnpc-approval-dialog">
        <div class="request-summary">
          <div class="request-item">
            <img src="${request.itemImg || 'icons/svg/item-bag.svg'}" alt="${request.itemName}" class="item-image">
            <div class="item-details">
              <strong>${request.itemName}</strong>
              <span class="service-type">${serviceType}</span>
              ${request.enchantmentName ? `<span class="enchantment">${request.enchantmentName}</span>` : ''}
            </div>
          </div>
          <div class="request-meta">
            <p><strong>${localize("Service.Approval.Player")}:</strong> ${request.playerName}</p>
            <p><strong>${localize("Service.Approval.Merchant")}:</strong> ${request.merchantName}</p>
            <p><strong>${localize("Service.Approval.Cost")}:</strong> ${formatCurrency(request.cost * 100)}</p>
          </div>
        </div>
        <hr>
        <div class="form-group">
          <label>${localize("Service.Approval.GameTimeDuration")}</label>
          <div class="form-fields" style="display: flex; gap: 10px; align-items: center;">
            <input type="number" id="duration-days" name="durationDays"
                   value="${defaultDurationDays}" min="0" step="1" style="width: 60px;">
            <span>${localize("Service.Approval.Days")}</span>
            <input type="number" id="duration-hours" name="durationHours"
                   value="0" min="0" max="23" step="1" style="width: 60px;">
            <span>${localize("Service.Approval.Hours")}</span>
          </div>
          <p class="hint">${localize("Service.Approval.GameTimeHint")}</p>
        </div>
        <div class="form-group">
          <label for="deny-reason">${localize("Service.Approval.DenyReason")}</label>
          <input type="text" id="deny-reason" name="denyReason" placeholder="${localize("Service.Approval.DenyReasonPlaceholder")}">
        </div>
      </form>
    `;

    return new Promise((resolve) => {
      new Dialog({
        title: localize("Service.Approval.Title"),
        content,
        buttons: {
          approve: {
            icon: '<i class="fas fa-check"></i>',
            label: localize("Service.Approval.Approve"),
            callback: async (html) => {
              const durationDays = parseInt(html.find('[name="durationDays"]').val()) || 0;
              const durationHours = parseInt(html.find('[name="durationHours"]').val()) || 0;
              const result = await this.processServiceRequest(requestId, true, null, { durationDays, durationHours });
              resolve(result);
            }
          },
          deny: {
            icon: '<i class="fas fa-times"></i>',
            label: localize("Service.Approval.Deny"),
            callback: async (html) => {
              const reason = html.find('[name="denyReason"]').val() || null;
              const result = await this.processServiceRequest(requestId, false, reason);
              resolve(result);
            }
          }
        },
        default: "approve",
        close: () => resolve({ success: false, message: "Dialog closed" })
      }, {
        classes: ["bobsnpc", "service-approval-dialog"],
        width: 400
      }).render(true);
    });
  }

  /**
   * Send a message that a service order has been accepted
   * @private
   */
  async _sendServiceAcceptedMessage({ type, playerName, merchantName, itemName, itemImg, enchantmentName, cost, readyTimeStr, playerId, serviceName, serviceIcon: customIcon }) {
    const imgHtml = itemImg ? `<img src="${itemImg}" class="item-icon" alt="${itemName}">` : "";
    const iconMap = { repair: "fa-wrench", enchant: "fa-wand-magic-sparkles", identify: "fa-magnifying-glass", appraise: "fa-gem" };
    const serviceIcon = customIcon || iconMap[type] || "fa-concierge-bell";
    const serviceTitle = serviceName || (type === "repair"
      ? localize("Chat.Service.RepairAccepted")
      : type === "enchant" ? localize("Chat.Service.EnchantAccepted") : `${type} Accepted`);

    const enchantmentLine = enchantmentName
      ? `<p><strong>${localize("Enchantment.Name")}:</strong> ${enchantmentName}</p>`
      : "";

    const content = `
      <div class="bobsnpc-chat-message service-accepted ${type}">
        <div class="service-header">
          <i class="fa-solid ${serviceIcon}"></i>
          <strong>${serviceTitle}</strong>
        </div>
        <div class="service-details">
          ${imgHtml}
          <div class="service-text">
            <p><strong>${localize("Shop.Item")}:</strong> ${itemName}</p>
            ${enchantmentLine}
            <p><strong>${localize("Chat.Service.Cost")}:</strong> ${formatCurrency(cost * 100)}</p>
            <p class="ready-time"><i class="fa-solid fa-clock"></i> <strong>${localize("Chat.Service.ReadyIn")}:</strong> ${readyTimeStr}</p>
          </div>
        </div>
        <p class="pickup-notice">${localize("Chat.Service.PickupNotice")}</p>
      </div>
    `;

    await ChatMessage.create({
      content,
      whisper: getPrivateWhisperTargets(playerId),
      speaker: { alias: merchantName },
      flags: {
        [MODULE_ID]: {
          type: "serviceAccepted",
          serviceType: type
        }
      }
    });
  }

  /**
   * Get a player's active service orders
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {object[]}
   */
  getPlayerServiceOrders(playerActorUuid) {
    const activeOrders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
    return activeOrders.filter(order =>
      order.playerActorUuid === playerActorUuid &&
      (order.status === ServiceRequestStatus.APPROVED || order.status === ServiceRequestStatus.READY)
    ).map(order => ({
      ...order,
      isReady: isRequestReady(order),
      timeRemaining: getTimeUntilReady(order),
      timeRemainingStr: formatDuration(getTimeUntilReady(order))
    }));
  }

  /**
   * Pick up a completed service order
   * Restores item from escrow and applies enchantments if applicable
   * @param {string} orderId - The order ID
   * @param {string} playerActorUuid - Player actor UUID
   * @returns {Promise<object>}
   */
  async pickupServiceOrder(orderId, playerActorUuid) {
    // If not GM, route through socket so GM handles the settings update
    if (!game.user.isGM) {
      try {
        const result = await requestPickupFromGM(orderId, playerActorUuid);
        if (result.success) {
          ui.notifications.info(result.message);
        }
        return result;
      } catch (error) {
        console.error(`${MODULE_ID} | Pickup request failed:`, error);
        return { success: false, message: error.message };
      }
    }

    // GM can process directly
    return this._processPickupAsGM(orderId, playerActorUuid);
  }

  /**
   * Process a pickup order as GM (handles settings update)
   * Called directly by GM or via socket from player
   * @param {string} orderId
   * @param {string} playerActorUuid
   * @returns {Promise<object>}
   */
  async _processPickupAsGM(orderId, playerActorUuid) {
    const activeOrders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
    const orderIndex = activeOrders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) {
      return { success: false, message: localize("Service.OrderNotFound") };
    }

    const order = activeOrders[orderIndex];

    // Verify the player owns this order
    if (order.playerActorUuid !== playerActorUuid) {
      return { success: false, message: localize("Service.NotYourOrder") };
    }

    // Check if the order is ready
    if (!isRequestReady(order)) {
      const timeLeft = formatDuration(getTimeUntilReady(order));
      return { success: false, message: localize("Service.NotReady", { time: timeLeft }) };
    }

    // Get the player actor
    const actor = await fromUuid(playerActorUuid);
    if (!actor) {
      return { success: false, message: localize("Service.ActorNotFound") };
    }

    // Check if we have item data to restore (item escrow services)
    if (!order.itemData) {
      // Non-item service order that's ready - just complete it
      activeOrders.splice(orderIndex, 1);
      await game.settings.set(MODULE_ID, "activeServiceOrders", activeOrders);

      const message = localize("Service.PickedUp", { item: order.serviceName || order.type });
      ui.notifications.info(message);
      return { success: true, message, order };
    }

    let resultItem = null;
    let enchantmentFailed = false;
    let failConsequence = null;

    // Use executor's onPickup if available, otherwise fall back to built-in logic
    const executor = getExecutor(order.type);

    if (executor && typeof executor.onPickup === "function") {
      // Delegate to the executor's pickup handler
      try {
        const pickupResult = await executor.onPickup(
          order, actor,
          this._restoreItemFromEscrow.bind(this),
          this._handleFailedEnchantment.bind(this),
          this._applyEnchantmentAndRestore.bind(this)
        );
        resultItem = pickupResult.item;
        enchantmentFailed = pickupResult.failed || false;
        failConsequence = order.failConsequence;

        if (enchantmentFailed) {
          await this._sendEnchantmentFailureMessage({
            playerName: order.playerName,
            merchantName: order.merchantName,
            itemName: order.itemName,
            itemImg: order.itemImg,
            enchantmentName: order.enchantmentName,
            failConsequence,
            playerId: order.playerId
          });
        }
      } catch (err) {
        console.error(`${MODULE_ID} | Executor onPickup failed for ${order.type}:`, err);
        // Fallback: restore item from escrow
        resultItem = await this._restoreItemFromEscrow(actor, order.itemData);
      }
    } else if (order.type === "repair" || order.type.startsWith("repair")) {
      // REPAIR fallback: Simply restore the item
      resultItem = await this._restoreItemFromEscrow(actor, order.itemData);

      await sendRepairMessage({
        playerName: order.playerName,
        merchantName: order.merchantName,
        itemName: resultItem.name,
        itemImg: resultItem.img,
        cost: order.cost,
        playerId: order.playerId
      });
    } else if (order.type === "enchant") {
      // ENCHANT: Check for failure, then apply enchantment
      const enchantmentHandler = game.bobsnpc?.handlers?.enchantment;
      let enchantment = null;

      if (order.enchantmentId && enchantmentHandler) {
        enchantment = enchantmentHandler.getEnchantment(order.enchantmentId);
      }

      // Roll for enchantment failure if not already rolled
      if (order.failRollResult === null && enchantment && enchantment.failRate > 0) {
        const failRoll = Math.random() * 100;
        order.failRollResult = failRoll;
        order.enchantmentFailed = failRoll < enchantment.failRate;

        if (order.enchantmentFailed) {
          order.failConsequence = enchantment.failConsequence || FailConsequence.NONE;
        }
      }

      enchantmentFailed = order.enchantmentFailed || false;
      failConsequence = order.failConsequence;

      if (enchantmentFailed) {
        // Handle failed enchantment
        const failResult = await this._handleFailedEnchantment(actor, order, enchantment);
        resultItem = failResult.item;

        // Send failure message
        await this._sendEnchantmentFailureMessage({
          playerName: order.playerName,
          merchantName: order.merchantName,
          itemName: order.itemName,
          itemImg: order.itemImg,
          enchantmentName: order.enchantmentName,
          failConsequence,
          playerId: order.playerId
        });
      } else {
        // Success: Apply enchantment to item
        resultItem = await this._applyEnchantmentAndRestore(actor, order, enchantment);

        await sendEnchantMessage({
          playerName: order.playerName,
          merchantName: order.merchantName,
          itemName: resultItem.name,
          itemImg: resultItem.img,
          enchantmentName: order.enchantmentName,
          cost: order.cost,
          playerId: order.playerId
        });
      }
    }

    // Remove from active orders
    activeOrders.splice(orderIndex, 1);
    await game.settings.set(MODULE_ID, "activeServiceOrders", activeOrders);

    const message = enchantmentFailed
      ? localize("Service.EnchantmentFailed", { item: order.itemName })
      : localize("Service.PickedUp", { item: resultItem?.name || order.itemName });

    ui.notifications.info(message);

    return {
      success: true,
      message,
      order,
      item: resultItem,
      enchantmentFailed,
      failConsequence
    };
  }

  /**
   * Restore an item from escrow to player inventory
   * @param {Actor} actor - The player actor
   * @param {object} itemData - The stored item data
   * @returns {Promise<Item>}
   * @private
   */
  async _restoreItemFromEscrow(actor, itemData) {
    const [newItem] = await actor.createEmbeddedDocuments("Item", [itemData]);
    console.log(`${MODULE_ID} | Restored item "${newItem.name}" from escrow`);
    return newItem;
  }

  /**
   * Apply enchantment to item and restore to player inventory
   * @param {Actor} actor - The player actor
   * @param {object} order - The service order
   * @param {object} enchantment - The enchantment to apply
   * @returns {Promise<Item>}
   * @private
   */
  async _applyEnchantmentAndRestore(actor, order, enchantment) {
    const enchantmentHandler = game.bobsnpc?.handlers?.enchantment;
    const itemData = foundry.utils.deepClone(order.itemData);

    // Update item name to include enchantment
    if (enchantment) {
      itemData.name = `${itemData.name} (${enchantment.name})`;

      // Upgrade rarity if enchantment rarity is higher
      const rarityOrder = ["common", "uncommon", "rare", "veryRare", "legendary", "artifact"];
      const itemRarityIndex = rarityOrder.indexOf(itemData.system?.rarity || "common");
      const enchantRarityIndex = rarityOrder.indexOf(enchantment.rarity || "common");

      if (enchantRarityIndex > itemRarityIndex && itemData.system) {
        itemData.system.rarity = enchantment.rarity;
      }

      // Add enchantment metadata to item flags
      if (!itemData.flags) itemData.flags = {};
      itemData.flags[MODULE_ID] = {
        ...itemData.flags[MODULE_ID],
        enchanted: true,
        enchantmentId: enchantment.id,
        enchantmentName: enchantment.name,
        enchantedAt: Date.now(),
        enchantedBy: order.merchantName
      };
    }

    // Create the item in player inventory
    const [newItem] = await actor.createEmbeddedDocuments("Item", [itemData]);
    console.log(`${MODULE_ID} | Created enchanted item "${newItem.name}"`);

    // Apply Active Effect to the item if enchantment has mechanical effects
    if (enchantment && enchantmentHandler && enchantment.mechanicalEffects?.length > 0) {
      await enchantmentHandler.applyEnchantmentToItem(newItem, enchantment);
    }

    return newItem;
  }

  /**
   * Handle a failed enchantment
   * @param {Actor} actor - The player actor
   * @param {object} order - The service order
   * @param {object} enchantment - The enchantment that failed
   * @returns {Promise<{item: Item|null}>}
   * @private
   */
  async _handleFailedEnchantment(actor, order, enchantment) {
    const failConsequence = order.failConsequence || FailConsequence.NONE;

    switch (failConsequence) {
      case FailConsequence.DESTROYED:
        // Item is destroyed - don't restore it
        console.log(`${MODULE_ID} | Item "${order.itemName}" destroyed due to failed enchantment`);
        return { item: null };

      case FailConsequence.CURSED:
        // Apply curse enchantment instead
        if (enchantment?.cursedEnchantmentId) {
          const enchantmentHandler = game.bobsnpc?.handlers?.enchantment;
          const curseEnchantment = enchantmentHandler?.getEnchantment(enchantment.cursedEnchantmentId);

          if (curseEnchantment) {
            const item = await this._applyEnchantmentAndRestore(actor, order, curseEnchantment);
            console.log(`${MODULE_ID} | Applied curse "${curseEnchantment.name}" to item "${order.itemName}"`);
            return { item };
          }
        }
        // If no curse defined, fall through to return unenchanted
        // falls through

      case FailConsequence.NONE:
      default:
        // Return item unenchanted
        const item = await this._restoreItemFromEscrow(actor, order.itemData);
        console.log(`${MODULE_ID} | Returned unenchanted item "${order.itemName}" after failed enchantment`);
        return { item };
    }
  }

  /**
   * Send a message about an enchantment failure
   * @private
   */
  async _sendEnchantmentFailureMessage({ playerName, merchantName, itemName, itemImg, enchantmentName, failConsequence, playerId }) {
    const imgHtml = itemImg ? `<img src="${itemImg}" class="item-icon" alt="${itemName}">` : "";

    let consequenceText;
    switch (failConsequence) {
      case FailConsequence.DESTROYED:
        consequenceText = localize("Enchantment.Failure.Destroyed", { item: itemName });
        break;
      case FailConsequence.CURSED:
        consequenceText = localize("Enchantment.Failure.Cursed", { item: itemName });
        break;
      case FailConsequence.NONE:
      default:
        consequenceText = localize("Enchantment.Failure.ReturnedUnenchanted", { item: itemName });
    }

    const content = `
      <div class="bobsnpc-chat-message service-failed enchant">
        <div class="service-header failure">
          <i class="fa-solid fa-skull-crossbones"></i>
          <strong>${localize("Enchantment.Failure.Title")}</strong>
        </div>
        <div class="service-details">
          ${imgHtml}
          <div class="service-text">
            <p><strong>${localize("Shop.Item")}:</strong> ${itemName}</p>
            <p><strong>${localize("Enchantment.Name")}:</strong> ${enchantmentName}</p>
            <p class="consequence">${consequenceText}</p>
          </div>
        </div>
      </div>
    `;

    await ChatMessage.create({
      content,
      whisper: getPrivateWhisperTargets(playerId),
      speaker: { alias: merchantName },
      flags: {
        [MODULE_ID]: {
          type: "enchantmentFailed",
          failConsequence
        }
      }
    });
  }

  /**
   * Get pending service requests (GM only)
   * @returns {object[]}
   */
  getPendingServiceRequests() {
    if (!game.user.isGM) return [];
    const requests = game.settings.get(MODULE_ID, "pendingServiceRequests") || [];
    return requests.filter(r => isRequestPending(r));
  }

  /**
   * Clean up expired service requests
   * @returns {Promise<number>} Number of requests cleaned up
   */
  async cleanupExpiredRequests() {
    if (!game.user.isGM) return 0;

    const pendingRequests = game.settings.get(MODULE_ID, "pendingServiceRequests") || [];
    const activeRequests = pendingRequests.filter(r => isRequestPending(r));
    const expiredCount = pendingRequests.length - activeRequests.length;

    if (expiredCount > 0) {
      await game.settings.set(MODULE_ID, "pendingServiceRequests", activeRequests);
    }

    return expiredCount;
  }

  // ==================== CURRENCY HELPERS ====================

  /**
   * Deduct gold from actor
   * @param {Actor} actor - Actor
   * @param {number} amount - Amount in gold
   * @private
   */
  async _deductGold(actor, amount) {
    const currency = convertToCurrency(amount);
    const currentGold = actor.system?.currency?.gp || 0;

    // Simple deduction from gold for now
    await actor.update({ "system.currency.gp": Math.max(0, currentGold - amount) });
  }

  /**
   * Give gold to actor
   * @param {Actor} actor - Actor
   * @param {number} amount - Amount in gold
   * @private
   */
  async _giveGold(actor, amount) {
    const currentGold = actor.system?.currency?.gp || 0;
    await actor.update({ "system.currency.gp": currentGold + amount });
  }

  /**
   * Deduct from merchant drawer
   * @param {string} merchantId - Merchant ID
   * @param {number} amount - Amount in gold
   * @private
   */
  async _deductFromDrawer(merchantId, amount) {
    const merchant = this.getMerchant(merchantId);
    if (!merchant) return;

    const currentGold = merchant.drawer.gp;
    await this.updateMerchant(merchantId, {
      drawer: {
        ...merchant.drawer,
        gp: Math.max(0, currentGold - amount)
      }
    });
  }

  /**
   * Record transaction
   * @param {string} merchantId - Merchant ID
   * @param {object} transaction - Transaction data
   * @private
   */
  async _recordTransaction(merchantId, transaction) {
    const merchant = this.getMerchant(merchantId);
    if (!merchant) return;

    const transactions = [...merchant.transactions, transaction];

    // Keep only last 100 transactions
    if (transactions.length > 100) {
      transactions.splice(0, transactions.length - 100);
    }

    await this.updateMerchant(merchantId, { transactions });
  }

  // ==================== BACK ROOM ====================

  /**
   * Add an item to a merchant's back room inventory
   * @param {string} merchantId - Merchant ID
   * @param {object} shopItem - Shop item data
   * @private
   */
  async _addToBackroom(merchantId, shopItem) {
    const merchant = this.getMerchant(merchantId);
    if (!merchant) return;

    const backroom = merchant.backroom || { enabled: true, inventory: [], autoAddPurchasedItems: true, notes: "" };
    const backroomInventory = [...(backroom.inventory || []), shopItem];

    await this.updateMerchant(merchantId, {
      backroom: {
        ...backroom,
        inventory: backroomInventory
      }
    });
  }

  /**
   * Move an item from back room to storefront
   * @param {string} merchantId - Merchant ID
   * @param {string} itemId - Item ID in backroom
   * @returns {boolean} Success
   */
  async moveToStorefront(merchantId, itemId) {
    const merchant = this.getMerchant(merchantId);
    if (!merchant?.backroom?.inventory) return false;

    const itemIndex = merchant.backroom.inventory.findIndex(i => i.id === itemId);
    if (itemIndex < 0) return false;

    const backroomInventory = [...merchant.backroom.inventory];
    const [item] = backroomInventory.splice(itemIndex, 1);
    const storefrontInventory = [...(merchant.inventory || []), item];

    await this.updateMerchant(merchantId, {
      inventory: storefrontInventory,
      backroom: {
        ...merchant.backroom,
        inventory: backroomInventory
      }
    });

    return true;
  }

  /**
   * Move an item from storefront to back room
   * @param {string} merchantId - Merchant ID
   * @param {string} itemId - Item ID in storefront
   * @returns {boolean} Success
   */
  async moveToBackroom(merchantId, itemId) {
    const merchant = this.getMerchant(merchantId);
    if (!merchant?.inventory) return false;

    const itemIndex = merchant.inventory.findIndex(i => i.id === itemId);
    if (itemIndex < 0) return false;

    const storefrontInventory = [...merchant.inventory];
    const [item] = storefrontInventory.splice(itemIndex, 1);

    const backroom = merchant.backroom || { enabled: true, inventory: [], autoAddPurchasedItems: true, notes: "" };
    const backroomInventory = [...(backroom.inventory || []), item];

    await this.updateMerchant(merchantId, {
      inventory: storefrontInventory,
      backroom: {
        ...backroom,
        inventory: backroomInventory
      }
    });

    return true;
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
      type: `merchant.${event}`,
      data
    });
  }
}
