/**
 * Bob's Talking NPCs - Dialogue Browser
 * Application for browsing, selecting, and deleting dialogues
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";

/** Get dialogue handler */
function getDialogueHandler() {
  return game.bobsnpc?.handlers?.dialogue;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dialogue Browser Application
 * Browse, select, and manage saved dialogues
 */
export class DialogueBrowser extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options - Application options
   * @param {Function} options.callback - Callback when a dialogue is selected
   */
  constructor(options = {}) {
    super(options);
    this._callback = options.callback || null;
    this._selectedId = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-dialogue-browser",
    classes: ["bobsnpc", "dialogue-browser"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.DialogueEditor.BrowseDialogues",
      icon: "fa-solid fa-folder-open",
      minimizable: false,
      resizable: true
    },
    position: {
      width: 500,
      height: 450
    },
    actions: {
      selectDialogue: DialogueBrowser.#onSelectDialogue,
      deleteDialogue: DialogueBrowser.#onDeleteDialogue,
      openDialogue: DialogueBrowser.#onOpenDialogue,
      createNew: DialogueBrowser.#onCreateNew
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/dialogue-browser.hbs`
    }
  };

  /** @override */
  async _prepareContext(options) {
    const handler = getDialogueHandler();
    const dialogues = handler?.getAllDialogues() || [];

    // Sort by updated date (most recent first)
    dialogues.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    return {
      dialogues: dialogues.map(d => ({
        id: d.id,
        name: d.name || localize("DialogueEditor.UnnamedDialogue"),
        description: d.description || "",
        nodeCount: Object.keys(d.nodes || {}).length,
        updatedAt: d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : "",
        selected: d.id === this._selectedId
      })),
      hasDialogues: dialogues.length > 0,
      selectedId: this._selectedId,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Setup double-click to open
    const items = this.element.querySelectorAll(".dialogue-item");
    items.forEach(item => {
      item.addEventListener("dblclick", () => {
        const id = item.dataset.dialogueId;
        this._openDialogue(id);
      });
    });
  }

  /**
   * Open a dialogue in the editor
   * @param {string} dialogueId - Dialogue ID
   * @private
   */
  _openDialogue(dialogueId) {
    const handler = getDialogueHandler();
    const dialogue = handler?.getDialogue(dialogueId);

    if (dialogue && this._callback) {
      this._callback(dialogue);
    }

    this.close();
  }

  // ==================== Actions ====================

  static #onSelectDialogue(event, target) {
    const id = target.closest("[data-dialogue-id]")?.dataset.dialogueId;
    if (id) {
      this._selectedId = id;
      this.render();
    }
  }

  static async #onDeleteDialogue(event, target) {
    const id = target.closest("[data-dialogue-id]")?.dataset.dialogueId;
    if (!id) return;

    const handler = getDialogueHandler();
    const dialogue = handler?.getDialogue(id);
    if (!dialogue) return;

    const confirmed = await Dialog.confirm({
      title: localize("DialogueEditor.DeleteDialogue"),
      content: `<p>${localize("DialogueEditor.DeleteDialogueConfirm").replace("{name}", dialogue.name)}</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });

    if (confirmed) {
      await handler.deleteDialogue(id);
      if (this._selectedId === id) {
        this._selectedId = null;
      }
      ui.notifications.info(localize("DialogueEditor.DialogueDeleted"));
      this.render();
    }
  }

  static #onOpenDialogue(event, target) {
    if (this._selectedId) {
      this._openDialogue(this._selectedId);
    }
  }

  static async #onCreateNew(event, target) {
    if (this._callback) {
      this._callback(null); // null signals to create new
    }
    this.close();
  }
}
