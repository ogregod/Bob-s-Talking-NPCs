/**
 * Bob's Talking NPCs - Service Approval Dialog
 * GM interface for approving/denying service requests (repair, enchant)
 * Also manages active service orders (adjust time, mark ready)
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize, formatCurrency } from "../utils/helpers.mjs";
import {
  formatDuration,
  GameTimeUnits,
  getCurrentGameTime,
  toGameTimeSeconds
} from "../data/service-request-model.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Get merchant handler instance from API
 */
function getMerchantHandler() {
  return game.bobsnpc?.handlers?.merchant;
}

/**
 * Service Approval Dialog
 * Shows pending service requests to GMs for approval
 * Also allows managing active orders
 */
export class ServiceApprovalDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._hookId = null;
    this._activeTab = "pending"; // "pending" or "active"
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-service-approval",
    classes: ["bobsnpc", "service-approval-dialog"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.GM.ServiceManagement",
      icon: "fa-solid fa-clipboard-check",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 620,
      height: 580
    },
    actions: {
      approveRequest: ServiceApprovalDialog.#onApproveRequest,
      denyRequest: ServiceApprovalDialog.#onDenyRequest,
      refreshRequests: ServiceApprovalDialog.#onRefreshRequests,
      cleanupExpired: ServiceApprovalDialog.#onCleanupExpired,
      switchTab: ServiceApprovalDialog.#onSwitchTab,
      markReady: ServiceApprovalDialog.#onMarkReady,
      adjustTime: ServiceApprovalDialog.#onAdjustTime,
      cancelOrder: ServiceApprovalDialog.#onCancelOrder
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/service-approval.hbs`,
      scrollable: [".requests-list"]
    }
  };

  /** @override */
  get title() {
    return localize("GM.ServiceManagement");
  }

  /** @override */
  async _preFirstRender(context, options) {
    await super._preFirstRender(context, options);

    // Register hook to refresh when new requests come in
    this._hookId = Hooks.on(`${MODULE_ID}.serviceRequestReceived`, () => {
      this.render();
    });
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const handler = getMerchantHandler();

    // Pending requests
    const requests = handler?.getPendingServiceRequests() || [];
    const preparedRequests = requests.map(request => {
      const timeAgo = this._formatTimeAgo(request.requestedAt);
      const serviceIcon = request.serviceIcon || _getServiceIcon(request.type);
      const serviceLabel = request.serviceName || request.type;

      return {
        ...request,
        timeAgo,
        serviceIcon,
        serviceLabel,
        costFormatted: formatCurrency(request.cost * 100),
        hasItem: !!(request.itemName || request.itemId)
      };
    });

    // Active orders (all orders from all players)
    const activeOrders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
    const currentGameTime = getCurrentGameTime();

    const preparedActiveOrders = activeOrders.map(order => {
      const serviceIcon = order.serviceIcon || _getServiceIcon(order.type);
      const serviceLabel = order.serviceName || order.type;

      // Use game time for checking readiness
      const readyAtGameTime = order.readyAtGameTime ?? 0;
      const isReady = currentGameTime >= readyAtGameTime;
      const timeRemaining = isReady ? 0 : readyAtGameTime - currentGameTime;
      const timeRemainingStr = isReady ? localize("Service.ReadyNow") : formatDuration(timeRemaining);

      // Show game time remaining in days/hours format
      const remainingDays = Math.floor(timeRemaining / GameTimeUnits.DAY);
      const remainingHours = Math.floor((timeRemaining % GameTimeUnits.DAY) / GameTimeUnits.HOUR);

      return {
        ...order,
        serviceIcon,
        serviceLabel,
        costFormatted: formatCurrency(order.cost * 100),
        isReady,
        timeRemaining,
        timeRemainingStr,
        remainingDays,
        remainingHours,
        statusClass: isReady ? "ready" : "in-progress"
      };
    });

    return {
      ...context,
      activeTab: this._activeTab,
      isPendingTab: this._activeTab === "pending",
      isActiveTab: this._activeTab === "active",
      requests: preparedRequests,
      hasRequests: preparedRequests.length > 0,
      requestCount: preparedRequests.length,
      activeOrders: preparedActiveOrders,
      hasActiveOrders: preparedActiveOrders.length > 0,
      activeOrderCount: preparedActiveOrders.length,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /**
   * Format timestamp as relative time
   * @param {number} timestamp
   * @returns {string}
   * @private
   */
  _formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  /** @override */
  async _onClose(options) {
    await super._onClose(options);

    // Unregister hook
    if (this._hookId !== null) {
      Hooks.off(`${MODULE_ID}.serviceRequestReceived`, this._hookId);
      this._hookId = null;
    }
  }

  // ==================== Actions ====================

  static async #onSwitchTab(event, target) {
    const tab = target.dataset.tab;
    if (tab) {
      this._activeTab = tab;
      this.render();
    }
  }

  static async #onApproveRequest(event, target) {
    const requestId = target.dataset.requestId;
    if (!requestId) return;

    const handler = getMerchantHandler();

    // Use the new dialog that allows setting custom time
    const result = await handler?.showServiceApprovalDialog(requestId);

    if (result?.success) {
      ui.notifications.info(result.message);
    } else if (result?.message && result.message !== "Dialog closed") {
      ui.notifications.error(result?.message || "Failed to approve request");
    }

    this.render();
  }

  static async #onDenyRequest(event, target) {
    const requestId = target.dataset.requestId;
    if (!requestId) return;

    // Optionally ask for reason
    const reason = await new Promise(resolve => {
      new Dialog({
        title: localize("GM.DenyRequest"),
        content: `
          <form>
            <div class="form-group">
              <label>Reason (optional):</label>
              <input type="text" name="reason" placeholder="Enter reason for denial...">
            </div>
          </form>
        `,
        buttons: {
          deny: {
            icon: '<i class="fas fa-times"></i>',
            label: localize("GM.DenyRequest"),
            callback: html => resolve(html.find('[name="reason"]').val() || null)
          },
          cancel: {
            icon: '<i class="fas fa-undo"></i>',
            label: localize("Cancel"),
            callback: () => resolve(undefined)
          }
        },
        default: "deny"
      }).render(true);
    });

    // If cancelled, don't proceed
    if (reason === undefined) return;

    const handler = getMerchantHandler();
    const result = await handler?.processServiceRequest(requestId, false, reason);

    if (result?.success) {
      ui.notifications.info(result.message);
    } else {
      ui.notifications.error(result?.message || "Failed to deny request");
    }

    this.render();
  }

  static async #onRefreshRequests(event, target) {
    this.render();
  }

  static async #onCleanupExpired(event, target) {
    const handler = getMerchantHandler();
    const count = await handler?.cleanupExpiredRequests();

    if (count > 0) {
      ui.notifications.info(`Cleaned up ${count} expired requests`);
    } else {
      ui.notifications.info("No expired requests to clean up");
    }

    this.render();
  }

  static async #onMarkReady(event, target) {
    const orderId = target.dataset.orderId;
    if (!orderId) return;

    // Update the order to be ready now (using current game time)
    const activeOrders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
    const orderIndex = activeOrders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) {
      ui.notifications.error("Order not found");
      return;
    }

    // Set ready time to current game time (making it immediately ready)
    activeOrders[orderIndex].readyAtGameTime = getCurrentGameTime();
    await game.settings.set(MODULE_ID, "activeServiceOrders", activeOrders);

    ui.notifications.info(localize("GM.OrderMarkedReady"));
    this.render();
  }

  static async #onAdjustTime(event, target) {
    const orderId = target.dataset.orderId;
    if (!orderId) return;

    const activeOrders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
    const order = activeOrders.find(o => o.id === orderId);

    if (!order) {
      ui.notifications.error("Order not found");
      return;
    }

    // Calculate current remaining time in game time
    const currentGameTime = getCurrentGameTime();
    const readyAtGameTime = order.readyAtGameTime ?? 0;
    const remainingSeconds = Math.max(0, readyAtGameTime - currentGameTime);
    const remainingDays = Math.floor(remainingSeconds / GameTimeUnits.DAY);
    const remainingHours = Math.floor((remainingSeconds % GameTimeUnits.DAY) / GameTimeUnits.HOUR);
    const remainingStr = formatDuration(remainingSeconds);

    const content = `
      <form class="bobsnpc-adjust-time-dialog">
        <p><strong>${localize("GM.AdjustTime.Item")}:</strong> ${order.itemName}</p>
        <p><strong>${localize("GM.AdjustTime.CurrentTime")}:</strong> ${remainingStr}</p>
        <hr>
        <div class="form-group">
          <label>${localize("GM.AdjustTime.NewGameTime")}</label>
          <div class="form-fields" style="display: flex; gap: 10px; align-items: center;">
            <input type="number" name="newDays" value="${remainingDays}" min="0" step="1" style="width: 60px;">
            <span>${localize("Service.Approval.Days")}</span>
            <input type="number" name="newHours" value="${remainingHours}" min="0" max="23" step="1" style="width: 60px;">
            <span>${localize("Service.Approval.Hours")}</span>
          </div>
          <p class="hint">${localize("GM.AdjustTime.GameTimeHint")}</p>
        </div>
      </form>
    `;

    const self = this;
    new Dialog({
      title: localize("GM.AdjustTime.Title"),
      content,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: localize("Save"),
          callback: async (html) => {
            const newDays = parseInt(html.find('[name="newDays"]').val()) || 0;
            const newHours = parseInt(html.find('[name="newHours"]').val()) || 0;
            const newDurationSeconds = toGameTimeSeconds(newDays, newHours);
            const newReadyAtGameTime = getCurrentGameTime() + newDurationSeconds;

            const orders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
            const idx = orders.findIndex(o => o.id === orderId);
            if (idx !== -1) {
              orders[idx].readyAtGameTime = newReadyAtGameTime;
              orders[idx].workDuration = newDurationSeconds;
              await game.settings.set(MODULE_ID, "activeServiceOrders", orders);
              ui.notifications.info(localize("GM.AdjustTime.Updated"));
              self.render();
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: localize("Cancel")
        }
      },
      default: "save"
    }, {
      classes: ["bobsnpc", "adjust-time-dialog"],
      width: 400
    }).render(true);
  }

  static async #onCancelOrder(event, target) {
    const orderId = target.dataset.orderId;
    if (!orderId) return;

    const confirmed = await Dialog.confirm({
      title: localize("GM.CancelOrder.Title"),
      content: `<p>${localize("GM.CancelOrder.Confirm")}</p>`
    });

    if (!confirmed) return;

    const activeOrders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
    const orderIndex = activeOrders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) {
      ui.notifications.error("Order not found");
      return;
    }

    const order = activeOrders[orderIndex];

    // Restore item to player
    const actor = await fromUuid(order.playerActorUuid);
    if (actor && order.itemData) {
      const handler = getMerchantHandler();
      await handler?._restoreItemFromEscrow(actor, order.itemData);
    }

    // Refund gold
    if (actor) {
      const currentGold = actor.system?.currency?.gp || 0;
      await actor.update({ "system.currency.gp": currentGold + order.cost });
    }

    // Remove from active orders
    activeOrders.splice(orderIndex, 1);
    await game.settings.set(MODULE_ID, "activeServiceOrders", activeOrders);

    ui.notifications.info(localize("GM.CancelOrder.Cancelled", { item: order.itemName }));
    this.render();
  }

  // ==================== Static Factory ====================

  /**
   * Open the service approval dialog
   * @returns {ServiceApprovalDialog}
   */
  static async open() {
    // Check if already open
    const existing = Object.values(ui.windows).find(w => w instanceof ServiceApprovalDialog);
    if (existing) {
      existing.bringToTop();
      existing.render();
      return existing;
    }

    const dialog = new ServiceApprovalDialog();
    await dialog.render(true);
    return dialog;
  }
}

/**
 * Get service icon for a given service type (fallback map)
 * @param {string} serviceType
 * @returns {string}
 */
function _getServiceIcon(serviceType) {
  const iconMap = {
    repair: "fa-wrench", enchant: "fa-wand-magic-sparkles", identify: "fa-magnifying-glass",
    appraise: "fa-gem", healing: "fa-heart", cureDisease: "fa-virus-slash",
    curePoison: "fa-flask-vial", restoration: "fa-sparkles", resurrection: "fa-cross",
    blessing: "fa-hand-sparkles", longRest: "fa-bed", shortRest: "fa-mug-hot",
    skillTraining: "fa-graduation-cap", weaponTraining: "fa-swords",
    toolTraining: "fa-screwdriver-wrench", languageTraining: "fa-language",
    sparring: "fa-hand-fist", rumors: "fa-ear-listen", research: "fa-book",
    silvering: "fa-wand-sparkles", brewPotion: "fa-flask", scribeScroll: "fa-scroll",
    currencyExchange: "fa-money-bill-transfer", loan: "fa-hand-holding-dollar",
    pawn: "fa-scale-balanced"
  };
  return iconMap[serviceType] || "fa-cog";
}

/**
 * Register hook to auto-open approval dialog when GM receives a service request
 */
export function registerServiceApprovalHooks() {
  Hooks.on(`${MODULE_ID}.serviceRequestReceived`, (request) => {
    // Only for GMs
    if (!game.user.isGM) return;

    // Show notification with service name
    const serviceName = request.serviceName || request.type;
    const detail = request.itemName
      ? `${request.playerName} - ${serviceName} for ${request.itemName}`
      : `${request.playerName} - ${serviceName}`;
    ui.notifications.info(`${localize("GM.ServiceRequest")}: ${detail}`);

    // Optionally auto-open the dialog (configurable in future)
    // ServiceApprovalDialog.open();
  });
}
