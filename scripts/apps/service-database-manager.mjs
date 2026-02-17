/**
 * Bob's Talking NPCs - Service Database Manager
 * GM interface for managing reusable service templates,
 * pending approval requests, active orders, and global settings.
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize, formatCurrency, generateId } from "../utils/helpers.mjs";
import { ServiceCategory } from "../data/merchant-model.mjs";
import {
  formatDuration,
  GameTimeUnits,
  getCurrentGameTime,
  toGameTimeSeconds
} from "../data/service-request-model.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Get the service database instance
 */
function getServiceDatabase() {
  return game.bobsnpc?.handlers?.serviceDatabase;
}

/**
 * Get the merchant handler
 */
function getMerchantHandler() {
  return game.bobsnpc?.handlers?.merchant;
}

/**
 * Human-readable labels for service categories
 */
const CATEGORY_LABELS = {
  crafting: "Crafting & Repair",
  magic: "Magic Services",
  healing: "Healing & Restoration",
  lodging: "Lodging & Rest",
  foodDrink: "Food & Drink",
  training: "Training & Education",
  information: "Information & Lore",
  transport: "Transport & Mounts",
  storage: "Storage & Vaults",
  financial: "Financial Services",
  entertainment: "Entertainment & Leisure",
  legal: "Legal & Civic",
  bodyCare: "Body Care & Medicine",
  animal: "Animal Services",
  arts: "Arts & Music",
  maritime: "Maritime Services",
  civic: "Civic & Government",
  misc: "Miscellaneous"
};

/**
 * Category icons
 */
const CATEGORY_ICONS = {
  crafting: "fa-hammer",
  magic: "fa-wand-magic-sparkles",
  healing: "fa-heart",
  lodging: "fa-bed",
  foodDrink: "fa-utensils",
  training: "fa-graduation-cap",
  information: "fa-book",
  transport: "fa-horse",
  storage: "fa-warehouse",
  financial: "fa-coins",
  entertainment: "fa-masks-theater",
  legal: "fa-gavel",
  bodyCare: "fa-scissors",
  animal: "fa-paw",
  arts: "fa-palette",
  maritime: "fa-ship",
  civic: "fa-building-columns",
  misc: "fa-cog"
};

/**
 * Service Database Manager Application
 */
export class ServiceDatabaseManager extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._activeTab = "templates";
    this._searchFilter = "";
    this._expandedCategories = new Set();
    this._editingTemplate = null;
    this._hookId = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-service-database-manager",
    classes: ["bobsnpc", "service-database-manager"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.ServiceManager.Title",
      icon: "fa-solid fa-database",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 780,
      height: 680
    },
    actions: {
      switchTab: ServiceDatabaseManager.#onSwitchTab,
      toggleCategory: ServiceDatabaseManager.#onToggleCategory,
      editTemplate: ServiceDatabaseManager.#onEditTemplate,
      createTemplate: ServiceDatabaseManager.#onCreateTemplate,
      deleteTemplate: ServiceDatabaseManager.#onDeleteTemplate,
      toggleApproval: ServiceDatabaseManager.#onToggleApproval,
      saveTemplate: ServiceDatabaseManager.#onSaveTemplate,
      cancelEdit: ServiceDatabaseManager.#onCancelEdit,
      approveRequest: ServiceDatabaseManager.#onApproveRequest,
      denyRequest: ServiceDatabaseManager.#onDenyRequest,
      markReady: ServiceDatabaseManager.#onMarkReady,
      adjustTime: ServiceDatabaseManager.#onAdjustTime,
      cancelOrder: ServiceDatabaseManager.#onCancelOrder,
      resetDefaults: ServiceDatabaseManager.#onResetDefaults,
      refreshRequests: ServiceDatabaseManager.#onRefresh,
      setCategoryApproval: ServiceDatabaseManager.#onSetCategoryApproval
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/service-manager.hbs`,
      scrollable: [".tab-body"]
    }
  };

  /** @override */
  get title() {
    return localize("ServiceManager.Title");
  }

  /** @override */
  async _preFirstRender(context, options) {
    await super._preFirstRender(context, options);

    this._hookId = Hooks.on(`${MODULE_ID}.serviceRequestReceived`, () => {
      if (this._activeTab === "pending") this.render();
    });
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const db = getServiceDatabase();
    const handler = getMerchantHandler();

    context.activeTab = this._activeTab;
    context.isTemplatesTab = this._activeTab === "templates";
    context.isPendingTab = this._activeTab === "pending";
    context.isActiveTab = this._activeTab === "active";
    context.isSettingsTab = this._activeTab === "settings";
    context.theme = game.settings.get(MODULE_ID, "theme") || "dark";

    // === Templates Tab ===
    if (this._activeTab === "templates") {
      context.isEditing = !!this._editingTemplate;
      context.editingTemplate = this._editingTemplate;
      context.searchFilter = this._searchFilter;

      if (!context.isEditing && db) {
        const grouped = db.getTemplatesByCategory();
        const categories = [];

        for (const [catKey, templates] of Object.entries(grouped)) {
          // Filter by search
          let filtered = templates;
          if (this._searchFilter) {
            const query = this._searchFilter.toLowerCase();
            filtered = templates.filter(t =>
              t.name.toLowerCase().includes(query) ||
              t.type.toLowerCase().includes(query) ||
              t.description.toLowerCase().includes(query)
            );
          }

          if (filtered.length === 0) continue;

          categories.push({
            key: catKey,
            label: CATEGORY_LABELS[catKey] || catKey,
            icon: CATEGORY_ICONS[catKey] || "fa-cog",
            expanded: this._expandedCategories.has(catKey),
            templates: filtered.map(t => ({
              ...t,
              approvalLabel: t.defaultApprovalMode === "request" ? "Request" : "Auto",
              approvalClass: t.defaultApprovalMode === "request" ? "approval-request" : "approval-auto"
            })),
            count: filtered.length
          });
        }

        // Sort categories alphabetically by label
        categories.sort((a, b) => a.label.localeCompare(b.label));
        context.categories = categories;
        context.totalTemplates = db.size;
      }

      // Editing template: provide category/pricing options
      if (context.isEditing) {
        context.categoryOptions = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
          value, label, selected: value === this._editingTemplate?.category
        }));
        context.priceTypeOptions = [
          { value: "fixed", label: "Fixed Price", selected: this._editingTemplate?.priceType === "fixed" },
          { value: "percent", label: "Percentage of Item Value", selected: this._editingTemplate?.priceType === "percent" },
          { value: "perDay", label: "Per Day", selected: this._editingTemplate?.priceType === "perDay" },
          { value: "variable", label: "Variable (set at use)", selected: this._editingTemplate?.priceType === "variable" }
        ];
        context.durationUnitOptions = [
          { value: "hours", label: "Hours", selected: this._editingTemplate?.durationUnit === "hours" },
          { value: "days", label: "Days", selected: this._editingTemplate?.durationUnit === "days" },
          { value: "weeks", label: "Weeks", selected: this._editingTemplate?.durationUnit === "weeks" }
        ];
      }
    }

    // === Pending Tab ===
    if (this._activeTab === "pending") {
      const requests = handler?.getPendingServiceRequests() || [];
      context.requests = requests.map(request => ({
        ...request,
        timeAgo: this._formatTimeAgo(request.requestedAt),
        serviceIcon: request.serviceIcon || "fa-cog",
        serviceLabel: request.serviceName || request.type,
        costFormatted: formatCurrency(request.cost * 100),
        hasItem: !!(request.itemName || request.itemId)
      }));
      context.hasRequests = context.requests.length > 0;
      context.requestCount = context.requests.length;
    }

    // === Active Orders Tab ===
    if (this._activeTab === "active") {
      const activeOrders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
      const currentGameTime = getCurrentGameTime();

      context.activeOrders = activeOrders.map(order => {
        const readyAtGameTime = order.readyAtGameTime ?? 0;
        const isReady = currentGameTime >= readyAtGameTime;
        const timeRemaining = isReady ? 0 : readyAtGameTime - currentGameTime;

        return {
          ...order,
          serviceIcon: order.serviceIcon || "fa-cog",
          serviceLabel: order.serviceName || order.type,
          costFormatted: formatCurrency(order.cost * 100),
          isReady,
          timeRemainingStr: isReady ? "Ready" : formatDuration(timeRemaining),
          statusClass: isReady ? "ready" : "in-progress",
          hasItem: !!(order.itemName || order.itemId)
        };
      });
      context.hasActiveOrders = context.activeOrders.length > 0;
      context.activeOrderCount = context.activeOrders.length;
    }

    // === Settings Tab ===
    if (this._activeTab === "settings") {
      const globalDefaults = game.settings.get(MODULE_ID, "globalApprovalDefaults") || {};
      context.categorySettings = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
        key,
        label,
        icon: CATEGORY_ICONS[key] || "fa-cog",
        approvalMode: globalDefaults[key] || "auto",
        isAuto: (globalDefaults[key] || "auto") === "auto",
        isRequest: globalDefaults[key] === "request"
      }));
    }

    return context;
  }

  /**
   * Format timestamp as relative time
   */
  _formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Attach search input handler
    const searchInput = this.element?.querySelector(".search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this._searchFilter = e.target.value;
        this.render();
      });
    }
  }

  /** @override */
  async _onClose(options) {
    await super._onClose(options);
    if (this._hookId !== null) {
      Hooks.off(`${MODULE_ID}.serviceRequestReceived`, this._hookId);
      this._hookId = null;
    }
  }

  // ==================== Tab Actions ====================

  static async #onSwitchTab(event, target) {
    const tab = target.dataset.tab;
    if (tab) {
      this._activeTab = tab;
      this._editingTemplate = null;
      this.render();
    }
  }

  // ==================== Template Actions ====================

  static async #onToggleCategory(event, target) {
    const category = target.dataset.category;
    if (!category) return;

    if (this._expandedCategories.has(category)) {
      this._expandedCategories.delete(category);
    } else {
      this._expandedCategories.add(category);
    }
    this.render();
  }

  static async #onEditTemplate(event, target) {
    const templateId = target.dataset.templateId;
    if (!templateId) return;

    const db = getServiceDatabase();
    const template = db?.getTemplate(templateId);
    if (!template) return;

    this._editingTemplate = { ...template };
    this.render();
  }

  static async #onCreateTemplate(event, target) {
    this._editingTemplate = {
      id: null,
      type: "",
      category: "misc",
      name: "",
      description: "",
      icon: "fa-cog",
      basePrice: 0,
      priceType: "fixed",
      currency: "gp",
      defaultApprovalMode: "auto",
      hasDuration: false,
      durationUnit: "hours",
      baseDuration: 0,
      requiresItem: false,
      validItemTypes: [],
      executorId: null,
      customData: {},
      isBuiltIn: false,
      isCustom: true
    };
    this.render();
  }

  static async #onDeleteTemplate(event, target) {
    const templateId = target.dataset.templateId;
    if (!templateId) return;

    const db = getServiceDatabase();
    const template = db?.getTemplate(templateId);
    if (!template) return;

    if (template.isBuiltIn) {
      ui.notifications.warn("Cannot delete built-in templates.");
      return;
    }

    const confirmed = await Dialog.confirm({
      title: "Delete Template",
      content: `<p>Are you sure you want to delete the <strong>${template.name}</strong> template?</p>`
    });

    if (!confirmed) return;

    await db.deleteTemplate(templateId);
    ui.notifications.info(`Deleted template: ${template.name}`);
    this.render();
  }

  static async #onToggleApproval(event, target) {
    const templateId = target.dataset.templateId;
    if (!templateId) return;

    const db = getServiceDatabase();
    const template = db?.getTemplate(templateId);
    if (!template) return;

    const newMode = template.defaultApprovalMode === "auto" ? "request" : "auto";
    await db.updateTemplate(templateId, { defaultApprovalMode: newMode });
    this.render();
  }

  static async #onSaveTemplate(event, target) {
    // Gather form data
    const form = this.element?.querySelector(".template-edit-form");
    if (!form) return;

    const formData = new FormData(form);
    const data = {
      type: formData.get("type")?.trim(),
      category: formData.get("category"),
      name: formData.get("name")?.trim(),
      description: formData.get("description")?.trim(),
      icon: formData.get("icon")?.trim() || "fa-cog",
      basePrice: parseFloat(formData.get("basePrice")) || 0,
      priceType: formData.get("priceType"),
      currency: formData.get("currency") || "gp",
      defaultApprovalMode: formData.get("defaultApprovalMode"),
      hasDuration: formData.get("hasDuration") === "on",
      durationUnit: formData.get("durationUnit"),
      baseDuration: parseInt(formData.get("baseDuration")) || 0,
      requiresItem: formData.get("requiresItem") === "on"
    };

    if (!data.name) {
      ui.notifications.warn("Service name is required.");
      return;
    }

    if (!data.type) {
      // Auto-generate type from name
      data.type = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
    }

    const db = getServiceDatabase();
    if (!db) return;

    const existingId = this._editingTemplate?.id;
    if (existingId && db.getTemplate(existingId)) {
      await db.updateTemplate(existingId, data);
      ui.notifications.info(`Updated template: ${data.name}`);
    } else {
      await db.createTemplate(data);
      ui.notifications.info(`Created template: ${data.name}`);
    }

    this._editingTemplate = null;
    this.render();
  }

  static async #onCancelEdit(event, target) {
    this._editingTemplate = null;
    this.render();
  }

  // ==================== Pending Request Actions ====================

  static async #onApproveRequest(event, target) {
    const requestId = target.dataset.requestId;
    if (!requestId) return;

    const handler = getMerchantHandler();
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

    const reason = await new Promise(resolve => {
      new Dialog({
        title: "Deny Request",
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
            label: "Deny",
            callback: html => resolve(html.find('[name="reason"]').val() || null)
          },
          cancel: {
            icon: '<i class="fas fa-undo"></i>',
            label: "Cancel",
            callback: () => resolve(undefined)
          }
        },
        default: "deny"
      }).render(true);
    });

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

  // ==================== Active Order Actions ====================

  static async #onMarkReady(event, target) {
    const orderId = target.dataset.orderId;
    if (!orderId) return;

    const activeOrders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
    const orderIndex = activeOrders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    activeOrders[orderIndex].readyAtGameTime = getCurrentGameTime();
    await game.settings.set(MODULE_ID, "activeServiceOrders", activeOrders);

    ui.notifications.info("Order marked as ready.");
    this.render();
  }

  static async #onAdjustTime(event, target) {
    const orderId = target.dataset.orderId;
    if (!orderId) return;

    const activeOrders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
    const order = activeOrders.find(o => o.id === orderId);
    if (!order) return;

    const currentGameTime = getCurrentGameTime();
    const readyAtGameTime = order.readyAtGameTime ?? 0;
    const remainingSeconds = Math.max(0, readyAtGameTime - currentGameTime);
    const remainingDays = Math.floor(remainingSeconds / GameTimeUnits.DAY);
    const remainingHours = Math.floor((remainingSeconds % GameTimeUnits.DAY) / GameTimeUnits.HOUR);

    const content = `
      <form>
        <p><strong>Service:</strong> ${order.serviceName || order.type}</p>
        ${order.itemName ? `<p><strong>Item:</strong> ${order.itemName}</p>` : ""}
        <p><strong>Current time remaining:</strong> ${formatDuration(remainingSeconds)}</p>
        <hr>
        <div class="form-group">
          <label>New time remaining:</label>
          <div style="display: flex; gap: 10px; align-items: center;">
            <input type="number" name="newDays" value="${remainingDays}" min="0" style="width: 60px;">
            <span>days</span>
            <input type="number" name="newHours" value="${remainingHours}" min="0" max="23" style="width: 60px;">
            <span>hours</span>
          </div>
        </div>
      </form>
    `;

    const self = this;
    new Dialog({
      title: "Adjust Time",
      content,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save",
          callback: async (html) => {
            const newDays = parseInt(html.find('[name="newDays"]').val()) || 0;
            const newHours = parseInt(html.find('[name="newHours"]').val()) || 0;
            const newDuration = toGameTimeSeconds(newDays, newHours);
            const newReady = getCurrentGameTime() + newDuration;

            const orders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
            const idx = orders.findIndex(o => o.id === orderId);
            if (idx !== -1) {
              orders[idx].readyAtGameTime = newReady;
              orders[idx].workDuration = newDuration;
              await game.settings.set(MODULE_ID, "activeServiceOrders", orders);
              ui.notifications.info("Time adjusted.");
              self.render();
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "save"
    }, { classes: ["bobsnpc"], width: 400 }).render(true);
  }

  static async #onCancelOrder(event, target) {
    const orderId = target.dataset.orderId;
    if (!orderId) return;

    const confirmed = await Dialog.confirm({
      title: "Cancel Order",
      content: "<p>Cancel this order and refund the player?</p>"
    });
    if (!confirmed) return;

    const activeOrders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
    const orderIndex = activeOrders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = activeOrders[orderIndex];

    // Restore item if escrowed
    const actor = await fromUuid(order.playerActorUuid);
    if (actor && order.itemData) {
      const handler = getMerchantHandler();
      await handler?._restoreItemFromEscrow(actor, order.itemData);
    }

    // Refund gold
    if (actor && order.cost > 0) {
      const currentGold = actor.system?.currency?.gp || 0;
      await actor.update({ "system.currency.gp": currentGold + order.cost });
    }

    activeOrders.splice(orderIndex, 1);
    await game.settings.set(MODULE_ID, "activeServiceOrders", activeOrders);

    ui.notifications.info(`Order cancelled. ${order.cost > 0 ? "Gold refunded." : ""}`);
    this.render();
  }

  // ==================== Settings Actions ====================

  static async #onSetCategoryApproval(event, target) {
    const category = target.dataset.category;
    const mode = target.dataset.mode;
    if (!category || !mode) return;

    const globalDefaults = game.settings.get(MODULE_ID, "globalApprovalDefaults") || {};
    globalDefaults[category] = mode;
    await game.settings.set(MODULE_ID, "globalApprovalDefaults", globalDefaults);
    this.render();
  }

  static async #onResetDefaults(event, target) {
    const confirmed = await Dialog.confirm({
      title: "Reset to Defaults",
      content: "<p>Reset all service templates to built-in defaults? Custom templates will be removed.</p>"
    });
    if (!confirmed) return;

    const db = getServiceDatabase();
    await db?.resetToDefaults();
    ui.notifications.info("Service database reset to defaults.");
    this.render();
  }

  static async #onRefresh(event, target) {
    this.render();
  }

  // ==================== Static Factory ====================

  static async open() {
    const existing = Object.values(ui.windows).find(w => w instanceof ServiceDatabaseManager);
    if (existing) {
      existing.bringToTop();
      existing.render();
      return existing;
    }

    const mgr = new ServiceDatabaseManager();
    await mgr.render(true);
    return mgr;
  }
}
