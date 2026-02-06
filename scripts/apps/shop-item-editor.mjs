/**
 * Bob's Talking NPCs - Shop Item Editor
 * Dialog for editing individual shop item properties
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize, generateId } from "../utils/helpers.mjs";
import { createShopItem, ItemRarity } from "../data/merchant-model.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Shop Item Editor Application
 * Detailed editor for a single shop item
 */
export class ShopItemEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.shopItem = foundry.utils.deepClone(options.shopItem || createShopItem({}));
    this.callback = options.callback;
    this._linkedItem = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-shop-item-editor",
    classes: ["bobsnpc", "shop-item-editor"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.ShopItemEditor.Title",
      icon: "fa-solid fa-box",
      minimizable: false,
      resizable: true
    },
    position: {
      width: 500,
      height: "auto"
    },
    actions: {
      save: ShopItemEditor.#onSave,
      cancel: ShopItemEditor.#onCancel,
      browseItem: ShopItemEditor.#onBrowseItem,
      clearItem: ShopItemEditor.#onClearItem
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/shop-editor/shop-item-editor.hbs`
    }
  };

  /** @override */
  get title() {
    return this.shopItem.name || this._linkedItem?.name || localize("ShopItemEditor.Title");
  }

  /** @override */
  async _preFirstRender(context, options) {
    await super._preFirstRender(context, options);

    // Load linked item data
    if (this.shopItem.itemUuid) {
      try {
        this._linkedItem = await fromUuid(this.shopItem.itemUuid);
      } catch (e) {
        console.warn(`${MODULE_ID} | Could not load linked item:`, e);
      }
    }
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Get item details for display
    const linkedItemName = this._linkedItem?.name || "";
    const linkedItemImg = this._linkedItem?.img || "icons/svg/item-bag.svg";
    const linkedItemPrice = this._linkedItem?.system?.price?.value || 0;
    const linkedItemRarity = this._linkedItem?.system?.rarity || "common";

    // Build rarity options
    const rarityOptions = Object.entries(ItemRarity).map(([key, value]) => ({
      value,
      label: localize(`Rarity.${key}`),
      selected: this.shopItem.rarity === value
    }));

    return {
      ...context,
      item: this.shopItem,
      hasLinkedItem: !!this.shopItem.itemUuid,
      linkedItem: this._linkedItem ? {
        name: linkedItemName,
        img: linkedItemImg,
        price: linkedItemPrice,
        rarity: linkedItemRarity,
        uuid: this.shopItem.itemUuid
      } : null,

      // Display values
      displayName: this.shopItem.name || linkedItemName || "New Item",
      displayPrice: this.shopItem.basePrice ?? linkedItemPrice ?? 0,
      isUnlimited: this.shopItem.quantity === -1,

      // Options
      rarityOptions,

      // Requirements
      requirements: this.shopItem.requirements || {
        level: 0,
        faction: null,
        minReputation: 0,
        quest: null,
        rank: null
      }
    };
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this._setupFormListeners();
    this._setupDragDrop();
  }

  /**
   * Set up form change listeners
   */
  _setupFormListeners() {
    const form = this.element;

    // Listen to all input changes
    form.querySelectorAll("input, select, textarea").forEach(input => {
      input.addEventListener("change", (event) => {
        this._onInputChange(event);
      });
    });

    // Handle unlimited quantity checkbox
    const unlimitedCheckbox = form.querySelector("input[name='unlimited']");
    const quantityInput = form.querySelector("input[name='quantity']");

    if (unlimitedCheckbox && quantityInput) {
      unlimitedCheckbox.addEventListener("change", (event) => {
        if (event.target.checked) {
          this.shopItem.quantity = -1;
          quantityInput.disabled = true;
          quantityInput.value = "";
        } else {
          this.shopItem.quantity = parseInt(quantityInput.value) || 10;
          quantityInput.disabled = false;
        }
      });
    }
  }

  /**
   * Handle input changes
   * @param {Event} event
   */
  _onInputChange(event) {
    const input = event.target;
    const name = input.name;

    if (!name || name === "unlimited") return;

    let value = input.type === "checkbox" ? input.checked : input.value;

    // Convert numeric values
    if (input.type === "number") {
      value = parseFloat(value) || 0;
    }

    // Update shop item using dot notation path
    foundry.utils.setProperty(this.shopItem, name, value);
  }

  /**
   * Set up drag-drop for item linking
   */
  _setupDragDrop() {
    const dropZone = this.element.querySelector(".item-drop-zone");
    if (!dropZone) return;

    dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "link";
      dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", async (event) => {
      event.preventDefault();
      dropZone.classList.remove("drag-over");

      try {
        const data = JSON.parse(event.dataTransfer.getData("text/plain"));
        if (data.type === "Item") {
          await this._linkItem(data.uuid);
        } else {
          ui.notifications.warn(localize("ShopItemEditor.OnlyItemsAllowed"));
        }
      } catch (e) {
        console.error(`${MODULE_ID} | Error handling item drop:`, e);
      }
    });
  }

  /**
   * Link an item by UUID
   * @param {string} uuid
   */
  async _linkItem(uuid) {
    const item = await fromUuid(uuid);
    if (!item) {
      ui.notifications.error(localize("ShopItemEditor.ItemNotFound"));
      return;
    }

    this.shopItem.itemUuid = uuid;
    this.shopItem.name = this.shopItem.name || item.name;
    this.shopItem.basePrice = this.shopItem.basePrice ?? item.system?.price?.value ?? 0;
    this._linkedItem = item;

    await this.render();
    ui.notifications.info(localize("ShopItemEditor.ItemLinked", { name: item.name }));
  }

  // ==================== Actions ====================

  /**
   * Save changes
   */
  static async #onSave(event, target) {
    // Validate
    if (!this.shopItem.name && !this._linkedItem) {
      ui.notifications.error(localize("ShopItemEditor.NameOrItemRequired"));
      return;
    }

    // Ensure ID exists
    if (!this.shopItem.id) {
      this.shopItem.id = generateId();
    }

    // Call callback with updated item
    if (this.callback) {
      await this.callback(this.shopItem);
    }

    await this.close();
  }

  /**
   * Cancel editing
   */
  static async #onCancel(event, target) {
    await this.close();
  }

  /**
   * Browse for item
   */
  static async #onBrowseItem(event, target) {
    // Get item compendiums
    const itemPacks = game.packs.filter(p => p.documentName === "Item");

    if (itemPacks.length === 0) {
      ui.notifications.warn(localize("ShopItemEditor.NoItemCompendiums"));
      return;
    }

    // Create dialog to select compendium then item
    const content = `
      <form class="shop-item-browser">
        <div class="form-group">
          <label>${localize("ShopItemEditor.SelectCompendium")}</label>
          <select name="compendium" class="compendium-select">
            <option value="">${localize("ShopItemEditor.SelectOne")}</option>
            <option value="__world__">${localize("ShopItemEditor.WorldItems")}</option>
            ${itemPacks.map(p => `<option value="${p.collection}">${p.title}</option>`).join("")}
          </select>
        </div>
        <div class="form-group item-selection" style="display: none;">
          <label>${localize("ShopItemEditor.SelectItem")}</label>
          <select name="item" class="item-select">
          </select>
        </div>
      </form>
    `;

    const self = this;

    const dialog = new Dialog({
      title: localize("ShopItemEditor.BrowseItems"),
      content,
      buttons: {
        select: {
          icon: '<i class="fas fa-check"></i>',
          label: localize("Select"),
          callback: async (html) => {
            const itemUuid = html.find("select[name=item]").val();
            if (itemUuid) {
              await self._linkItem(itemUuid);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: localize("Cancel")
        }
      },
      default: "select",
      render: (html) => {
        const compendiumSelect = html.find("select[name=compendium]");
        const itemSelect = html.find("select[name=item]");
        const itemGroup = html.find(".item-selection");

        compendiumSelect.on("change", async (event) => {
          const packId = event.target.value;

          if (!packId) {
            itemGroup.hide();
            return;
          }

          let items = [];

          if (packId === "__world__") {
            // Get world items
            items = game.items.map(i => ({
              uuid: i.uuid,
              name: i.name,
              img: i.img,
              type: i.type
            }));
          } else {
            // Get compendium items
            const pack = game.packs.get(packId);
            if (pack) {
              const index = await pack.getIndex();
              items = index.map(i => ({
                uuid: `Compendium.${packId}.Item.${i._id}`,
                name: i.name,
                img: i.img,
                type: i.type
              }));
            }
          }

          // Sort by name
          items.sort((a, b) => a.name.localeCompare(b.name));

          // Populate item select
          itemSelect.html(
            `<option value="">${localize("ShopItemEditor.SelectOne")}</option>` +
            items.map(i => `<option value="${i.uuid}">${i.name} (${i.type})</option>`).join("")
          );

          itemGroup.show();
        });
      }
    });

    dialog.render(true);
  }

  /**
   * Clear linked item
   */
  static async #onClearItem(event, target) {
    this.shopItem.itemUuid = null;
    this._linkedItem = null;
    await this.render();
  }
}
