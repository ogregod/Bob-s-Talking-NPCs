/**
 * Bob's Talking NPCs - Service Approval Dialog
 * GM interface for approving/denying service requests (repair, enchant)
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize, formatCurrency } from "../utils/helpers.mjs";

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
 */
export class ServiceApprovalDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._hookId = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-service-approval",
    classes: ["bobsnpc", "service-approval-dialog"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.GM.PendingRequests",
      icon: "fa-solid fa-clipboard-check",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 500,
      height: 400
    },
    actions: {
      approveRequest: ServiceApprovalDialog.#onApproveRequest,
      denyRequest: ServiceApprovalDialog.#onDenyRequest,
      refreshRequests: ServiceApprovalDialog.#onRefreshRequests,
      cleanupExpired: ServiceApprovalDialog.#onCleanupExpired
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
    return localize("GM.PendingRequests");
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
    const requests = handler?.getPendingServiceRequests() || [];

    // Prepare request data for display
    const preparedRequests = requests.map(request => {
      const timeAgo = this._formatTimeAgo(request.requestedAt);
      const serviceIcon = request.type === "repair" ? "fa-wrench" : "fa-wand-magic-sparkles";
      const serviceLabel = request.type === "repair"
        ? localize("Shop.Service.Repair")
        : localize("Shop.Service.Enchant");

      return {
        ...request,
        timeAgo,
        serviceIcon,
        serviceLabel,
        costFormatted: formatCurrency(request.cost * 100)
      };
    });

    return {
      ...context,
      requests: preparedRequests,
      hasRequests: preparedRequests.length > 0,
      requestCount: preparedRequests.length,
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

  static async #onApproveRequest(event, target) {
    const requestId = target.dataset.requestId;
    if (!requestId) return;

    const handler = getMerchantHandler();
    const result = await handler?.processServiceRequest(requestId, true);

    if (result?.success) {
      ui.notifications.info(result.message);
    } else {
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
 * Register hook to auto-open approval dialog when GM receives a service request
 */
export function registerServiceApprovalHooks() {
  Hooks.on(`${MODULE_ID}.serviceRequestReceived`, (request) => {
    // Only for GMs
    if (!game.user.isGM) return;

    // Show notification
    ui.notifications.info(
      `${localize("GM.ServiceRequest")}: ${request.playerName} - ${request.type} for ${request.itemName}`
    );

    // Optionally auto-open the dialog (configurable in future)
    // ServiceApprovalDialog.open();
  });
}
