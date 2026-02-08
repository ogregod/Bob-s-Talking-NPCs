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
  ShopType,
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
import { generateId, getFlag, setFlag, localize } from "../utils/helpers.mjs";
import {
  sendPurchaseMessage,
  sendSaleMessage,
  sendIdentifyMessage,
  sendRepairMessage,
  sendAppraiseMessage,
  sendEnchantMessage,
  sendServiceRequestToGM,
  sendServiceRequestResult
} from "../utils/chat.mjs";
import {
  createServiceRequest,
  ServiceRequestStatus,
  ApprovalRequiredServices,
  isRequestPending
} from "../data/service-request-model.mjs";
import { emit, emitToGM, SocketEvents } from "../socket.mjs";

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

    // Load from worldData.merchants (primary storage)
    const worldData = game.settings.get(MODULE_ID, "worldData") || {};
    const merchants = worldData.merchants || {};
    for (const [id, merchantData] of Object.entries(merchants)) {
      this._merchantCache.set(id, createMerchant(merchantData));
    }

    // Also load from shops settings (fallback storage) if not already in cache
    const shopsSettings = game.settings.get(MODULE_ID, "shops") || {};
    for (const [id, shopData] of Object.entries(shopsSettings)) {
      if (!this._merchantCache.has(id)) {
        this._merchantCache.set(id, createMerchant(shopData));
      }
    }
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

    for (const sale of sales) {
      const item = actor.items.find(i => i.uuid === sale.itemUuid || i.id === sale.itemId);
      if (!item) continue;

      // Check if shop buys this type
      if (merchant.buyBack.itemTypes.length > 0 &&
        !merchant.buyBack.itemTypes.includes(item.type)) {
        continue;
      }

      if (merchant.buyBack.excludeTypes.includes(item.type)) {
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

      // Get base price
      const basePrice = item.system?.price?.value || 0;
      const sellPrice = basePrice * merchant.pricing.baseSellMultiplier;

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

    switch (service) {
      case "identify":
        return this._serviceIdentify(merchant, actor, options);
      case "repair":
        return this._serviceRepair(merchant, actor, options);
      case "appraise":
        return this._serviceAppraise(merchant, actor, options);
      case "enchant":
        return this._serviceEnchant(merchant, actor, options);
      default:
        return { success: false, message: localize("Shop.ServiceNotAvailable") };
    }
  }

  /**
   * Identify service
   * @private
   */
  async _serviceIdentify(merchant, actor, options) {
    if (!merchant.services.identify) {
      return { success: false, message: localize("Shop.ServiceNotAvailable") };
    }

    const item = actor.items.get(options.itemId);
    if (!item) {
      return { success: false, message: localize("Shop.ItemNotFound") };
    }

    const cost = merchant.services.identifyPrice || 25;
    const gold = convertToGold(actor.system?.currency || {});

    if (gold < cost) {
      return { success: false, message: localize("Shop.InsufficientFunds") };
    }

    await this._deductGold(actor, cost);

    // Mark item as identified (system-specific)
    await item.update({ "system.identified": true });

    // Send private chat message
    await sendIdentifyMessage({
      playerName: actor.name,
      merchantName: merchant.name || "Merchant",
      itemName: item.name,
      itemImg: item.img,
      cost,
      playerId: game.user?.id
    });

    return {
      success: true,
      cost,
      message: `${item.name} ${localize("Shop.HasBeenIdentified")}`
    };
  }

  /**
   * Repair service - requires GM approval
   * @private
   */
  async _serviceRepair(merchant, actor, options) {
    if (!merchant.services.repair) {
      return { success: false, message: localize("Shop.ServiceNotAvailable") };
    }

    const item = actor.items.get(options.itemId);
    if (!item) {
      return { success: false, message: localize("Shop.ItemNotFound") };
    }

    // Calculate repair cost based on item value
    const basePrice = item.system?.price?.value || 0;
    const cost = Math.round(basePrice * (merchant.services.repairPricePercent || 0.1));
    const gold = convertToGold(actor.system?.currency || {});

    if (gold < cost) {
      return { success: false, message: localize("Shop.InsufficientFunds") };
    }

    // Create service request for GM approval
    const request = createServiceRequest({
      type: ApprovalRequiredServices.REPAIR,
      merchantId: merchant.id,
      merchantName: merchant.name || "Merchant",
      playerActorUuid: actor.uuid,
      playerActorId: actor.id,
      playerName: actor.name,
      playerId: game.user?.id,
      itemId: item.id,
      itemUuid: item.uuid,
      itemName: item.name,
      itemImg: item.img,
      itemType: item.type,
      cost
    });

    // Store the request
    const pendingRequests = game.settings.get(MODULE_ID, "pendingServiceRequests") || [];
    pendingRequests.push(request);
    await game.settings.set(MODULE_ID, "pendingServiceRequests", pendingRequests);

    // Send notification to GM
    await sendServiceRequestToGM({
      type: "repair",
      playerName: actor.name,
      merchantName: merchant.name || "Merchant",
      itemName: item.name,
      itemImg: item.img,
      cost,
      requestId: request.id
    });

    // Notify via socket if not GM
    if (!game.user.isGM) {
      emitToGM(SocketEvents.SERVICE_REQUEST, { request });
    }

    return {
      success: true,
      pending: true,
      requestId: request.id,
      cost,
      message: localize("Shop.Service.PendingApproval")
    };
  }

  /**
   * Appraise service
   * @private
   */
  async _serviceAppraise(merchant, actor, options) {
    if (!merchant.services.appraise) {
      return { success: false, message: localize("Shop.ServiceNotAvailable") };
    }

    const item = actor.items.get(options.itemId);
    if (!item) {
      return { success: false, message: localize("Shop.ItemNotFound") };
    }

    const cost = merchant.services.appraisePrice || 5;
    const gold = convertToGold(actor.system?.currency || {});

    if (gold < cost) {
      return { success: false, message: localize("Shop.InsufficientFunds") };
    }

    await this._deductGold(actor, cost);

    const value = item.system?.price?.value || 0;

    // Send private chat message
    await sendAppraiseMessage({
      playerName: actor.name,
      merchantName: merchant.name || "Merchant",
      itemName: item.name,
      itemImg: item.img,
      appraisedValue: value,
      cost,
      playerId: game.user?.id
    });

    return {
      success: true,
      cost,
      appraisedValue: value,
      message: `${item.name}: ${this._formatCurrency(value)}`
    };
  }

  /**
   * Enchant service - requires GM approval
   * @private
   */
  async _serviceEnchant(merchant, actor, options) {
    if (!merchant.services.enchant) {
      return { success: false, message: localize("Shop.ServiceNotAvailable") };
    }

    const item = actor.items.get(options.itemId);
    if (!item) {
      return { success: false, message: localize("Shop.ItemNotFound") };
    }

    // Get enchantment from options (should be selected from enchantment picker)
    const enchantmentId = options.enchantmentId;
    const enchantmentHandler = game.bobsnpc?.handlers?.enchantment;

    let enchantment = null;
    let cost = 0;

    if (enchantmentId && enchantmentHandler) {
      enchantment = enchantmentHandler.getEnchantment(enchantmentId);
      if (!enchantment) {
        return { success: false, message: localize("Enchantment.NotFound") };
      }

      // Calculate cost based on enchantment and item rarity
      const { calculateEnchantmentCost } = await import("../data/enchantment-model.mjs");
      const priceModifier = merchant.services?.enchantmentPriceModifier || 1;
      cost = calculateEnchantmentCost(enchantment, item.system?.rarity || "common", priceModifier);
    } else {
      // Fallback: Calculate base cost based on item value and rarity
      const basePrice = item.system?.price?.value || 100;
      const rarityMultiplier = {
        common: 1,
        uncommon: 1.5,
        rare: 2,
        veryRare: 3,
        legendary: 5,
        artifact: 10
      };
      const rarity = item.system?.rarity || "common";
      cost = Math.round(basePrice * (rarityMultiplier[rarity] || 1));
    }

    const gold = convertToGold(actor.system?.currency || {});

    if (gold < cost) {
      return { success: false, message: localize("Shop.InsufficientFunds") };
    }

    // Create service request for GM approval
    const request = createServiceRequest({
      type: ApprovalRequiredServices.ENCHANT,
      merchantId: merchant.id,
      merchantName: merchant.name || "Merchant",
      playerActorUuid: actor.uuid,
      playerActorId: actor.id,
      playerName: actor.name,
      playerId: game.user?.id,
      itemId: item.id,
      itemUuid: item.uuid,
      itemName: item.name,
      itemImg: item.img,
      itemType: item.type,
      enchantmentId: enchantmentId || null,
      enchantmentName: enchantment?.name || "Custom Enchantment",
      cost
    });

    // Store the request
    const pendingRequests = game.settings.get(MODULE_ID, "pendingServiceRequests") || [];
    pendingRequests.push(request);
    await game.settings.set(MODULE_ID, "pendingServiceRequests", pendingRequests);

    // Send notification to GM
    await sendServiceRequestToGM({
      type: "enchant",
      playerName: actor.name,
      merchantName: merchant.name || "Merchant",
      itemName: item.name,
      itemImg: item.img,
      enchantmentName: enchantment?.name || "Custom Enchantment",
      cost,
      requestId: request.id
    });

    // Notify via socket if not GM
    if (!game.user.isGM) {
      emitToGM(SocketEvents.SERVICE_REQUEST, { request });
    }

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
   * @returns {Promise<object>}
   */
  async processServiceRequest(requestId, approved, reason = null) {
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

    // Send appropriate chat message based on service type
    if (request.type === ApprovalRequiredServices.REPAIR) {
      await sendRepairMessage({
        playerName: request.playerName,
        merchantName: request.merchantName,
        itemName: request.itemName,
        itemImg: request.itemImg,
        cost: request.cost,
        playerId: request.playerId
      });
    } else if (request.type === ApprovalRequiredServices.ENCHANT) {
      await sendEnchantMessage({
        playerName: request.playerName,
        merchantName: request.merchantName,
        itemName: request.itemName,
        itemImg: request.itemImg,
        enchantmentName: request.enchantmentName,
        cost: request.cost,
        playerId: request.playerId
      });
    }

    // Notify player of approval
    emit(SocketEvents.SERVICE_APPROVE, {
      requestId,
      playerId: request.playerId
    });

    await sendServiceRequestResult({
      type: request.type,
      status: "approved",
      itemName: request.itemName,
      playerId: request.playerId
    });

    return { success: true, message: "Request approved and processed" };
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

// Singleton instance
export const merchantHandler = new MerchantHandler();
