/**
 * Bob's Talking NPCs - Trade Window
 * Player-to-player trading interface
 */

import { MODULE_ID } from "../module.mjs";
import { emit, SocketEvents } from "../socket.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Trade Window for exchanging items and gold between players
 * @extends ApplicationV2
 */
export class TradeWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-trade-window",
    classes: ["bobsnpc", "trade-window"],
    tag: "div",
    window: {
      title: "BOBSNPC.Trade.Title",
      icon: "fa-solid fa-handshake",
      resizable: true,
      minimizable: true
    },
    position: {
      width: 600,
      height: 500
    },
    actions: {
      addItem: TradeWindow.#onAddItem,
      removeItem: TradeWindow.#onRemoveItem,
      setGold: TradeWindow.#onSetGold,
      confirmTrade: TradeWindow.#onConfirmTrade,
      cancelTrade: TradeWindow.#onCancelTrade,
      lockOffer: TradeWindow.#onLockOffer,
      unlockOffer: TradeWindow.#onUnlockOffer
    }
  };

  /** @override */
  static PARTS = {
    header: {
      template: `modules/${MODULE_ID}/templates/trade/header.hbs`
    },
    yourOffer: {
      template: `modules/${MODULE_ID}/templates/trade/your-offer.hbs`
    },
    theirOffer: {
      template: `modules/${MODULE_ID}/templates/trade/their-offer.hbs`
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/trade/footer.hbs`
    }
  };

  /**
   * The trade session data
   * @type {object}
   */
  #tradeSession = null;

  /**
   * Your actor in the trade
   * @type {Actor}
   */
  #yourActor = null;

  /**
   * Their actor in the trade
   * @type {Actor}
   */
  #theirActor = null;

  /**
   * Your offer
   * @type {object}
   */
  #yourOffer = {
    items: [],
    gold: 0,
    locked: false,
    confirmed: false
  };

  /**
   * Their offer
   * @type {object}
   */
  #theirOffer = {
    items: [],
    gold: 0,
    locked: false,
    confirmed: false
  };

  /**
   * @param {object} options
   * @param {Actor} options.yourActor - The initiating player's actor
   * @param {Actor} options.theirActor - The target player's actor
   * @param {string} options.tradeId - Unique trade session ID
   */
  constructor(options = {}) {
    super(options);
    this.#yourActor = options.yourActor;
    this.#theirActor = options.theirActor;
    this.#tradeSession = {
      id: options.tradeId || foundry.utils.randomID(),
      initiator: options.yourActor?.uuid,
      target: options.theirActor?.uuid,
      startedAt: Date.now()
    };
  }

  /** @override */
  get title() {
    const theirName = this.#theirActor?.name || game.i18n.localize("BOBSNPC.Common.Unknown");
    return game.i18n.format("BOBSNPC.Trade.TitleWith", { name: theirName });
  }

  /** @override */
  async _prepareContext(options) {
    const yourInventory = this.#getInventory(this.#yourActor);
    const yourGold = this.#getGold(this.#yourActor);

    return {
      moduleId: MODULE_ID,
      tradeId: this.#tradeSession?.id,
      theme: game.settings.get(MODULE_ID, "theme"),

      // Your side
      yourActor: {
        id: this.#yourActor?.id,
        uuid: this.#yourActor?.uuid,
        name: this.#yourActor?.name,
        img: this.#yourActor?.img
      },
      yourInventory,
      yourGold,
      yourOffer: this.#yourOffer,
      yourOfferValue: this.#calculateOfferValue(this.#yourOffer),

      // Their side
      theirActor: {
        id: this.#theirActor?.id,
        uuid: this.#theirActor?.uuid,
        name: this.#theirActor?.name,
        img: this.#theirActor?.img
      },
      theirOffer: this.#theirOffer,
      theirOfferValue: this.#calculateOfferValue(this.#theirOffer),

      // Trade state
      canConfirm: this.#yourOffer.locked && this.#theirOffer.locked,
      bothConfirmed: this.#yourOffer.confirmed && this.#theirOffer.confirmed,
      waitingForThem: this.#yourOffer.confirmed && !this.#theirOffer.confirmed,
      waitingForYou: !this.#yourOffer.confirmed && this.#theirOffer.confirmed
    };
  }

  /**
   * Get actor's tradeable inventory
   * @param {Actor} actor
   * @returns {object[]}
   */
  #getInventory(actor) {
    if (!actor) return [];

    return actor.items
      .filter(item => {
        // Filter out non-physical items
        const validTypes = ["weapon", "equipment", "consumable", "tool", "loot", "container"];
        return validTypes.includes(item.type);
      })
      .map(item => ({
        id: item.id,
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        type: item.type,
        quantity: item.system.quantity || 1,
        price: item.system.price?.value || 0,
        priceUnit: item.system.price?.denomination || "gp",
        weight: item.system.weight || 0,
        rarity: item.system.rarity || "common",
        inOffer: this.#yourOffer.items.some(i => i.id === item.id)
      }));
  }

  /**
   * Get actor's gold amount
   * @param {Actor} actor
   * @returns {number}
   */
  #getGold(actor) {
    if (!actor?.system?.currency) return 0;

    const currency = actor.system.currency;
    // Convert to gold pieces
    return (currency.pp || 0) * 10 +
           (currency.gp || 0) +
           (currency.ep || 0) * 0.5 +
           (currency.sp || 0) * 0.1 +
           (currency.cp || 0) * 0.01;
  }

  /**
   * Calculate total value of an offer
   * @param {object} offer
   * @returns {number}
   */
  #calculateOfferValue(offer) {
    let total = offer.gold || 0;

    for (const item of offer.items) {
      total += (item.price || 0) * (item.quantity || 1);
    }

    return Math.round(total * 100) / 100;
  }

  /**
   * Update trade from socket message
   * @param {object} data - Trade update data
   */
  updateFromSocket(data) {
    if (data.tradeId !== this.#tradeSession?.id) return;

    if (data.type === "offer_update") {
      this.#theirOffer = data.offer;
      this.render();
    } else if (data.type === "trade_complete") {
      this.#completeTrade(data);
    } else if (data.type === "trade_cancelled") {
      ui.notifications.info(game.i18n.localize("BOBSNPC.Trade.Cancelled"));
      this.close();
    }
  }

  /**
   * Sync your offer to the other player
   */
  #syncOffer() {
    emit(SocketEvents.TRADE_UPDATE, {
      tradeId: this.#tradeSession.id,
      type: "offer_update",
      offer: this.#yourOffer,
      targetUuid: this.#theirActor?.uuid
    });
  }

  /* ===== Action Handlers ===== */

  /**
   * Add item to trade offer
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onAddItem(event, target) {
    const itemId = target.dataset.itemId;
    const item = this.#yourActor?.items.get(itemId);
    if (!item) return;

    // Check if already in offer
    if (this.#yourOffer.items.some(i => i.id === itemId)) {
      ui.notifications.warn(game.i18n.localize("BOBSNPC.Trade.ItemAlreadyInOffer"));
      return;
    }

    // Check if offer is locked
    if (this.#yourOffer.locked) {
      ui.notifications.warn(game.i18n.localize("BOBSNPC.Trade.OfferLocked"));
      return;
    }

    // Prompt for quantity if stackable
    let quantity = 1;
    const maxQuantity = item.system.quantity || 1;

    if (maxQuantity > 1) {
      quantity = await this.#promptQuantity(item.name, maxQuantity);
      if (!quantity) return;
    }

    this.#yourOffer.items.push({
      id: item.id,
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      quantity,
      price: item.system.price?.value || 0
    });

    this.#syncOffer();
    this.render();
  }

  /**
   * Remove item from trade offer
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static #onRemoveItem(event, target) {
    const itemId = target.dataset.itemId;

    if (this.#yourOffer.locked) {
      ui.notifications.warn(game.i18n.localize("BOBSNPC.Trade.OfferLocked"));
      return;
    }

    this.#yourOffer.items = this.#yourOffer.items.filter(i => i.id !== itemId);
    this.#syncOffer();
    this.render();
  }

  /**
   * Set gold amount in offer
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onSetGold(event, target) {
    if (this.#yourOffer.locked) {
      ui.notifications.warn(game.i18n.localize("BOBSNPC.Trade.OfferLocked"));
      return;
    }

    const maxGold = this.#getGold(this.#yourActor);

    const amount = await new Promise((resolve) => {
      new Dialog({
        title: game.i18n.localize("BOBSNPC.Trade.SetGold"),
        content: `
          <div class="form-group">
            <label>${game.i18n.localize("BOBSNPC.Trade.GoldAmount")}</label>
            <input type="number" name="gold" value="${this.#yourOffer.gold}" min="0" max="${maxGold}" step="0.01"/>
            <p class="hint">${game.i18n.format("BOBSNPC.Trade.MaxGold", { max: maxGold.toFixed(2) })}</p>
          </div>
        `,
        buttons: {
          ok: {
            label: game.i18n.localize("BOBSNPC.Common.OK"),
            callback: (html) => resolve(parseFloat(html.find('[name="gold"]').val()) || 0)
          },
          cancel: {
            label: game.i18n.localize("BOBSNPC.Common.Cancel"),
            callback: () => resolve(null)
          }
        },
        default: "ok"
      }).render(true);
    });

    if (amount === null) return;

    this.#yourOffer.gold = Math.min(Math.max(0, amount), maxGold);
    this.#syncOffer();
    this.render();
  }

  /**
   * Lock your offer
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static #onLockOffer(event, target) {
    this.#yourOffer.locked = true;
    this.#syncOffer();
    this.render();
  }

  /**
   * Unlock your offer
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static #onUnlockOffer(event, target) {
    this.#yourOffer.locked = false;
    this.#yourOffer.confirmed = false;
    this.#syncOffer();
    this.render();
  }

  /**
   * Confirm the trade
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onConfirmTrade(event, target) {
    if (!this.#yourOffer.locked || !this.#theirOffer.locked) {
      ui.notifications.warn(game.i18n.localize("BOBSNPC.Trade.BothMustLock"));
      return;
    }

    this.#yourOffer.confirmed = true;
    this.#syncOffer();

    // If both confirmed, execute the trade
    if (this.#theirOffer.confirmed) {
      await this.#executeTrade();
    } else {
      this.render();
    }
  }

  /**
   * Cancel the trade
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static #onCancelTrade(event, target) {
    emit(SocketEvents.TRADE_UPDATE, {
      tradeId: this.#tradeSession.id,
      type: "trade_cancelled",
      targetUuid: this.#theirActor?.uuid
    });

    ui.notifications.info(game.i18n.localize("BOBSNPC.Trade.Cancelled"));
    this.close();
  }

  /**
   * Execute the trade
   */
  async #executeTrade() {
    try {
      // Verify both sides still have the items/gold
      const yourGold = this.#getGold(this.#yourActor);
      const theirGold = this.#getGold(this.#theirActor);

      if (yourGold < this.#yourOffer.gold) {
        throw new Error(game.i18n.localize("BOBSNPC.Trade.InsufficientGold"));
      }

      // Transfer items from you to them
      for (const offerItem of this.#yourOffer.items) {
        const item = this.#yourActor.items.get(offerItem.id);
        if (!item) continue;

        const currentQty = item.system.quantity || 1;
        if (offerItem.quantity >= currentQty) {
          // Move entire item
          const itemData = item.toObject();
          await Item.create(itemData, { parent: this.#theirActor });
          await item.delete();
        } else {
          // Split stack
          const itemData = item.toObject();
          itemData.system.quantity = offerItem.quantity;
          await Item.create(itemData, { parent: this.#theirActor });
          await item.update({ "system.quantity": currentQty - offerItem.quantity });
        }
      }

      // Transfer items from them to you
      for (const offerItem of this.#theirOffer.items) {
        const item = this.#theirActor.items.get(offerItem.id);
        if (!item) continue;

        const currentQty = item.system.quantity || 1;
        if (offerItem.quantity >= currentQty) {
          const itemData = item.toObject();
          await Item.create(itemData, { parent: this.#yourActor });
          await item.delete();
        } else {
          const itemData = item.toObject();
          itemData.system.quantity = offerItem.quantity;
          await Item.create(itemData, { parent: this.#yourActor });
          await item.update({ "system.quantity": currentQty - offerItem.quantity });
        }
      }

      // Transfer gold
      if (this.#yourOffer.gold > 0) {
        await this.#transferGold(this.#yourActor, this.#theirActor, this.#yourOffer.gold);
      }
      if (this.#theirOffer.gold > 0) {
        await this.#transferGold(this.#theirActor, this.#yourActor, this.#theirOffer.gold);
      }

      // Notify completion
      emit(SocketEvents.TRADE_UPDATE, {
        tradeId: this.#tradeSession.id,
        type: "trade_complete",
        targetUuid: this.#theirActor?.uuid
      });

      ui.notifications.info(game.i18n.localize("BOBSNPC.Trade.Complete"));
      this.close();

    } catch (error) {
      console.error(`${MODULE_ID} | Trade failed:`, error);
      ui.notifications.error(error.message || game.i18n.localize("BOBSNPC.Trade.Failed"));
    }
  }

  /**
   * Transfer gold between actors
   * @param {Actor} from
   * @param {Actor} to
   * @param {number} amount - Amount in gold pieces
   */
  async #transferGold(from, to, amount) {
    // Convert to copper for precision
    const copper = Math.round(amount * 100);

    // Deduct from sender
    const fromCurrency = foundry.utils.deepClone(from.system.currency);
    let remaining = copper;

    // Deduct from lowest denomination first
    const deduct = (denom, value) => {
      const available = (fromCurrency[denom] || 0) * value;
      const toDeduct = Math.min(available, remaining);
      fromCurrency[denom] = Math.floor((available - toDeduct) / value);
      remaining -= toDeduct;
    };

    deduct("cp", 1);
    deduct("sp", 10);
    deduct("ep", 50);
    deduct("gp", 100);
    deduct("pp", 1000);

    await from.update({ "system.currency": fromCurrency });

    // Add to recipient (as gold pieces)
    const toCurrency = foundry.utils.deepClone(to.system.currency);
    const goldToAdd = Math.floor(copper / 100);
    const copperRemainder = copper % 100;

    toCurrency.gp = (toCurrency.gp || 0) + goldToAdd;
    toCurrency.cp = (toCurrency.cp || 0) + copperRemainder;

    await to.update({ "system.currency": toCurrency });
  }

  /**
   * Complete trade from socket notification
   * @param {object} data
   */
  #completeTrade(data) {
    ui.notifications.info(game.i18n.localize("BOBSNPC.Trade.Complete"));
    this.close();
  }

  /**
   * Prompt for quantity
   * @param {string} itemName
   * @param {number} max
   * @returns {Promise<number|null>}
   */
  async #promptQuantity(itemName, max) {
    return new Promise((resolve) => {
      new Dialog({
        title: game.i18n.localize("BOBSNPC.Trade.SelectQuantity"),
        content: `
          <div class="form-group">
            <label>${game.i18n.format("BOBSNPC.Trade.QuantityOf", { item: itemName })}</label>
            <input type="number" name="quantity" value="1" min="1" max="${max}"/>
            <p class="hint">${game.i18n.format("BOBSNPC.Trade.MaxQuantity", { max })}</p>
          </div>
        `,
        buttons: {
          ok: {
            label: game.i18n.localize("BOBSNPC.Common.OK"),
            callback: (html) => resolve(parseInt(html.find('[name="quantity"]').val()) || 1)
          },
          cancel: {
            label: game.i18n.localize("BOBSNPC.Common.Cancel"),
            callback: () => resolve(null)
          }
        },
        default: "ok"
      }).render(true);
    });
  }

  /** @override */
  async close(options = {}) {
    // Notify other party if closing without completing
    if (!this.#yourOffer.confirmed || !this.#theirOffer.confirmed) {
      emit(SocketEvents.TRADE_UPDATE, {
        tradeId: this.#tradeSession?.id,
        type: "trade_cancelled",
        targetUuid: this.#theirActor?.uuid
      });
    }
    return super.close(options);
  }
}
