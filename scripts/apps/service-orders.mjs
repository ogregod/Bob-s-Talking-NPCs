/**
 * Bob's Talking NPCs - Service Orders Window
 * Player interface for viewing and picking up service orders
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";
import {
  ServiceRequestStatus,
  isRequestReady,
  getTimeUntilReady,
  formatDuration
} from "../data/service-request-model.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Get merchant handler instance from API
 */
function getMerchantHandler() {
  return game.bobsnpc?.handlers?.merchant;
}

/**
 * Service Orders Application
 * Allows players to view their active service orders and pick up ready items
 */
export class ServiceOrdersWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._playerActorUuid = options.playerActorUuid || null;
    this._merchantId = options.merchantId || null;
    this._refreshInterval = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-service-orders",
    classes: ["bobsnpc", "service-orders"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.Service.Orders",
      icon: "fa-solid fa-clipboard-list",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 550,
      height: 520
    },
    actions: {
      pickupOrder: ServiceOrdersWindow.#onPickupOrder,
      refresh: ServiceOrdersWindow.#onRefresh
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/service-orders.hbs`,
      scrollable: [".orders-list"]
    }
  };

  /** @override */
  get title() {
    return localize("Service.YourOrders");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const handler = getMerchantHandler();
    if (!handler || !this._playerActorUuid) {
      context.orders = [];
      context.hasOrders = false;
      return context;
    }

    // Get all orders for this player
    let orders = handler.getPlayerServiceOrders(this._playerActorUuid);

    // Filter by merchant if specified
    if (this._merchantId) {
      orders = orders.filter(o => o.merchantId === this._merchantId);
    }

    // Prepare orders for display
    const preparedOrders = orders.map(order => {
      const ready = isRequestReady(order);
      const timeRemaining = getTimeUntilReady(order);

      return {
        ...order,
        isReady: ready,
        statusLabel: ready
          ? localize("Service.Status.Ready")
          : localize("Service.Status.InProgress"),
        statusClass: ready ? "ready" : "pending",
        timeRemainingStr: ready ? localize("Service.ReadyNow") : formatDuration(timeRemaining),
        typeLabel: order.type === "repair"
          ? localize("Service.Type.Repair")
          : localize("Service.Type.Enchant"),
        typeIcon: order.type === "repair" ? "fa-wrench" : "fa-wand-magic-sparkles",
        queueInfo: order.queuePosition > 0
          ? localize("Service.QueuePosition", { position: order.queuePosition })
          : ""
      };
    });

    // Sort: ready first, then by ready time (using game time)
    preparedOrders.sort((a, b) => {
      if (a.isReady && !b.isReady) return -1;
      if (!a.isReady && b.isReady) return 1;
      // Sort by game time ready, falling back to legacy readyAt
      const aReady = a.readyAtGameTime ?? a.readyAt ?? 0;
      const bReady = b.readyAtGameTime ?? b.readyAt ?? 0;
      return aReady - bReady;
    });

    context.orders = preparedOrders;
    context.hasOrders = preparedOrders.length > 0;
    context.readyCount = preparedOrders.filter(o => o.isReady).length;
    context.pendingCount = preparedOrders.filter(o => !o.isReady).length;

    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Start auto-refresh every 30 seconds
    this._startAutoRefresh();
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);

    // Stop auto-refresh
    this._stopAutoRefresh();
  }

  /**
   * Start auto-refresh interval
   * @private
   */
  _startAutoRefresh() {
    if (this._refreshInterval) return;

    this._refreshInterval = setInterval(() => {
      this.render(false);
    }, 30000); // 30 seconds
  }

  /**
   * Stop auto-refresh interval
   * @private
   */
  _stopAutoRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
  }

  // ==================== ACTIONS ====================

  /**
   * Handle picking up an order
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onPickupOrder(event, target) {
    const orderId = target.closest("[data-order-id]")?.dataset.orderId;
    if (!orderId) return;

    const handler = getMerchantHandler();
    if (!handler || !this._playerActorUuid) return;

    // Disable button while processing
    target.disabled = true;
    target.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${localize("Service.PickingUp")}`;

    try {
      const result = await handler.pickupServiceOrder(orderId, this._playerActorUuid);

      if (result.success) {
        // Re-render to remove the picked up order
        await this.render(false);

        // If no more orders, close the window
        const orders = handler.getPlayerServiceOrders(this._playerActorUuid);
        if (orders.length === 0) {
          this.close();
        }
      } else {
        ui.notifications.warn(result.message);
        target.disabled = false;
        target.innerHTML = `<i class="fa-solid fa-hand"></i> ${localize("Service.PickUp")}`;
      }
    } catch (error) {
      console.error(`${MODULE_ID} | Error picking up order:`, error);
      ui.notifications.error(localize("Service.PickupError"));
      target.disabled = false;
      target.innerHTML = `<i class="fa-solid fa-hand"></i> ${localize("Service.PickUp")}`;
    }
  }

  /**
   * Handle manual refresh
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onRefresh(event, target) {
    await this.render(false);
    ui.notifications.info(localize("Service.OrdersRefreshed"));
  }

  // ==================== STATIC METHODS ====================

  /**
   * Open the service orders window for a player
   * @param {string} playerActorUuid - Player actor UUID
   * @param {string} [merchantId] - Optional merchant ID to filter orders
   * @returns {ServiceOrdersWindow}
   */
  static open(playerActorUuid, merchantId = null) {
    const existing = Object.values(ui.windows).find(
      w => w instanceof ServiceOrdersWindow && w._playerActorUuid === playerActorUuid
    );

    if (existing) {
      existing._merchantId = merchantId;
      existing.render(true);
      return existing;
    }

    const window = new ServiceOrdersWindow({
      playerActorUuid,
      merchantId
    });
    window.render(true);
    return window;
  }
}
