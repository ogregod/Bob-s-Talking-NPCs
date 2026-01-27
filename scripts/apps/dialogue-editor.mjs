/**
 * Bob's Talking NPCs - Visual Dialogue Editor
 * Canvas-based node graph editor for creating dialogue trees
 */

const MODULE_ID = "bobs-talking-npcs";

import { localize } from "../utils/helpers.mjs";
import {
  NodeType,
  createDialogue,
  createNode,
  createResponse,
  addNode,
  removeNode,
  connectNodes,
  validateDialogue
} from "../data/dialogue-model.mjs";

/** Get dialogue handler */
function getDialogueHandler() {
  return game.bobsnpc?.handlers?.dialogue;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Visual Dialogue Editor Application
 * Canvas-based node graph editor for creating dialogue trees
 */
export class DialogueEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object|null} dialogue - Existing dialogue to edit, or null for new
   * @param {object} options - Application options
   */
  constructor(dialogue = null, options = {}) {
    super(options);

    // Working copy of dialogue
    this._dialogue = dialogue
      ? foundry.utils.deepClone(dialogue)
      : createDialogue({ name: localize("DialogueEditor.NewDialogue") });

    this._isNewDialogue = !dialogue;

    // Canvas state
    this._zoom = this._dialogue.editorZoom || 1;
    this._pan = { ...this._dialogue.editorPan } || { x: 0, y: 0 };
    this._isDragging = false;
    this._isPanning = false;
    this._dragOffset = { x: 0, y: 0 };
    this._selectedNodeId = null;
    this._hoveredNodeId = null;
    this._connectionStart = null;
    this._connectionType = null;

    // Undo/redo stacks
    this._undoStack = [];
    this._redoStack = [];
    this._maxUndoSteps = 50;

    // Canvas element reference
    this._canvas = null;
    this._ctx = null;
    this._animationFrameId = null;

    // Node dimensions
    this._nodeWidth = 200;
    this._nodeHeight = 80;
    this._socketRadius = 8;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "bobsnpc-dialogue-editor",
    classes: ["bobsnpc", "dialogue-editor"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "BOBSNPC.DialogueEditor.Title",
      icon: "fa-solid fa-project-diagram",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 1200,
      height: 800
    },
    actions: {
      addNode: DialogueEditor.#onAddNode,
      deleteNode: DialogueEditor.#onDeleteNode,
      duplicateNode: DialogueEditor.#onDuplicateNode,
      editNode: DialogueEditor.#onEditNode,
      undo: DialogueEditor.#onUndo,
      redo: DialogueEditor.#onRedo,
      zoomIn: DialogueEditor.#onZoomIn,
      zoomOut: DialogueEditor.#onZoomOut,
      zoomFit: DialogueEditor.#onZoomFit,
      zoomReset: DialogueEditor.#onZoomReset,
      validate: DialogueEditor.#onValidate,
      preview: DialogueEditor.#onPreview,
      save: DialogueEditor.#onSave,
      saveAndClose: DialogueEditor.#onSaveAndClose,
      exportDialogue: DialogueEditor.#onExport,
      importDialogue: DialogueEditor.#onImport
    }
  };

  /** @override */
  static PARTS = {
    toolbar: {
      template: `modules/${MODULE_ID}/templates/dialogue-editor/toolbar.hbs`
    },
    canvas: {
      template: `modules/${MODULE_ID}/templates/dialogue-editor/canvas.hbs`
    },
    sidebar: {
      template: `modules/${MODULE_ID}/templates/dialogue-editor/sidebar.hbs`
    },
    nodePanel: {
      template: `modules/${MODULE_ID}/templates/dialogue-editor/node-panel.hbs`
    }
  };

  /** @override */
  get title() {
    return this._isNewDialogue
      ? localize("DialogueEditor.TitleNew")
      : localize("DialogueEditor.TitleEdit").replace("{name}", this._dialogue.name);
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const nodeTypes = Object.entries(NodeType).map(([key, value]) => ({
      value,
      label: localize(`DialogueEditor.NodeType.${key}`),
      icon: this._getNodeTypeIcon(value)
    }));

    const selectedNode = this._selectedNodeId
      ? this._dialogue.nodes[this._selectedNodeId]
      : null;

    return {
      ...context,
      dialogue: this._dialogue,
      nodeTypes,
      selectedNode,
      selectedNodeId: this._selectedNodeId,
      zoom: Math.round(this._zoom * 100),
      canUndo: this._undoStack.length > 0,
      canRedo: this._redoStack.length > 0,
      nodeCount: Object.keys(this._dialogue.nodes).length,
      theme: game.settings.get(MODULE_ID, "theme") || "dark"
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Setup canvas
    this._canvas = this.element.querySelector("#dialogue-canvas");
    if (this._canvas) {
      this._ctx = this._canvas.getContext("2d");
      this._setupCanvasEvents();
      this._resizeCanvas();
      this._startRenderLoop();
    }

    // Setup keyboard shortcuts
    this._setupKeyboardShortcuts();
  }

  /** @override */
  async _onClose(options) {
    // Stop render loop
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }

    await super._onClose(options);
  }

  // ==================== Canvas Rendering ====================

  /**
   * Start the canvas render loop
   * @private
   */
  _startRenderLoop() {
    const render = () => {
      this._renderCanvas();
      this._animationFrameId = requestAnimationFrame(render);
    };
    render();
  }

  /**
   * Resize canvas to fit container
   * @private
   */
  _resizeCanvas() {
    if (!this._canvas) return;

    const container = this._canvas.parentElement;
    this._canvas.width = container.clientWidth;
    this._canvas.height = container.clientHeight;
  }

  /**
   * Main canvas render function
   * @private
   */
  _renderCanvas() {
    if (!this._ctx || !this._canvas) return;

    const ctx = this._ctx;
    const width = this._canvas.width;
    const height = this._canvas.height;

    // Clear canvas
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    this._drawGrid(ctx, width, height);

    // Apply transformations
    ctx.save();
    ctx.translate(this._pan.x, this._pan.y);
    ctx.scale(this._zoom, this._zoom);

    // Draw connections first (behind nodes)
    this._drawConnections(ctx);

    // Draw active connection being created
    if (this._connectionStart) {
      this._drawActiveConnection(ctx);
    }

    // Draw nodes
    Object.values(this._dialogue.nodes).forEach(node => {
      this._drawNode(ctx, node);
    });

    ctx.restore();
  }

  /**
   * Draw background grid
   * @private
   */
  _drawGrid(ctx, width, height) {
    const gridSize = 20 * this._zoom;
    const offsetX = this._pan.x % gridSize;
    const offsetY = this._pan.y % gridSize;

    ctx.strokeStyle = "#2a2a4a";
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = offsetX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  /**
   * Draw a node on the canvas
   * @private
   */
  _drawNode(ctx, node) {
    const x = node.position.x;
    const y = node.position.y;
    const w = this._nodeWidth;
    const h = this._nodeHeight;
    const r = 8; // Corner radius

    const isSelected = node.id === this._selectedNodeId;
    const isHovered = node.id === this._hoveredNodeId;
    const isStart = node.id === this._dialogue.startNodeId;

    // Node colors by type
    const colors = this._getNodeColors(node.type);

    // Shadow
    if (isSelected || isHovered) {
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = 15;
    }

    // Background
    ctx.fillStyle = isSelected ? colors.selected : colors.bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();

    // Border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isStart ? "#ffd700" : colors.border;
    ctx.lineWidth = isSelected ? 3 : isHovered ? 2 : 1;
    ctx.stroke();

    // Header bar
    ctx.fillStyle = colors.header;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 24, [r, r, 0, 0]);
    ctx.fill();

    // Node type icon
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px 'Font Awesome 6 Free'";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const icon = this._getNodeTypeIconChar(node.type);
    ctx.fillText(icon, x + 8, y + 12);

    // Node label
    ctx.font = "bold 12px system-ui";
    ctx.fillStyle = "#ffffff";
    const label = node.label || this._getNodeTypeLabel(node.type);
    ctx.fillText(this._truncateText(ctx, label, w - 40), x + 28, y + 12);

    // Node content preview
    ctx.font = "11px system-ui";
    ctx.fillStyle = "#aaaaaa";
    const preview = this._getNodePreview(node);
    const lines = this._wrapText(ctx, preview, w - 16);
    lines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, x + 8, y + 40 + i * 14);
    });

    // Draw sockets
    this._drawSockets(ctx, node, x, y, w, h);

    // Start indicator
    if (isStart) {
      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("START", x + w / 2, y - 8);
    }
  }

  /**
   * Draw connection sockets on a node
   * @private
   */
  _drawSockets(ctx, node, x, y, w, h) {
    const sr = this._socketRadius;

    // Input socket (left center)
    ctx.fillStyle = "#3498db";
    ctx.beginPath();
    ctx.arc(x, y + h / 2, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Output sockets depend on node type
    const outputs = this._getNodeOutputs(node);
    const spacing = h / (outputs.length + 1);

    outputs.forEach((output, i) => {
      const sy = y + spacing * (i + 1);
      ctx.fillStyle = output.color || "#2ecc71";
      ctx.beginPath();
      ctx.arc(x + w, sy, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Socket label
      if (outputs.length > 1) {
        ctx.font = "9px system-ui";
        ctx.fillStyle = "#888888";
        ctx.textAlign = "right";
        ctx.fillText(output.label, x + w - 12, sy + 3);
      }
    });
  }

  /**
   * Draw connections between nodes
   * @private
   */
  _drawConnections(ctx) {
    Object.values(this._dialogue.nodes).forEach(node => {
      const outputs = this._getNodeOutputsWithTargets(node);
      const w = this._nodeWidth;
      const h = this._nodeHeight;
      const spacing = h / (outputs.length + 1);

      outputs.forEach((output, i) => {
        if (!output.targetId || !this._dialogue.nodes[output.targetId]) return;

        const targetNode = this._dialogue.nodes[output.targetId];
        const startX = node.position.x + w;
        const startY = node.position.y + spacing * (i + 1);
        const endX = targetNode.position.x;
        const endY = targetNode.position.y + h / 2;

        this._drawBezierConnection(ctx, startX, startY, endX, endY, output.color || "#2ecc71");
      });
    });
  }

  /**
   * Draw a bezier curve connection
   * @private
   */
  _drawBezierConnection(ctx, x1, y1, x2, y2, color) {
    const dx = Math.abs(x2 - x1);
    const cp = Math.max(dx * 0.5, 50);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + cp, y1, x2 - cp, y2, x2, y2);
    ctx.stroke();

    // Arrow head
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 10 * Math.cos(angle - Math.PI / 6), y2 - 10 * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - 10 * Math.cos(angle + Math.PI / 6), y2 - 10 * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw active connection being created
   * @private
   */
  _drawActiveConnection(ctx) {
    if (!this._connectionStart) return;

    const { nodeId, socketIndex, x, y } = this._connectionStart;
    const mousePos = this._screenToWorld(this._lastMousePos || { x: 0, y: 0 });

    this._drawBezierConnection(ctx, x, y, mousePos.x, mousePos.y, "#ffffff88");
  }

  // ==================== Canvas Events ====================

  /**
   * Setup canvas event listeners
   * @private
   */
  _setupCanvasEvents() {
    if (!this._canvas) return;

    // Mouse events
    this._canvas.addEventListener("mousedown", this._onCanvasMouseDown.bind(this));
    this._canvas.addEventListener("mousemove", this._onCanvasMouseMove.bind(this));
    this._canvas.addEventListener("mouseup", this._onCanvasMouseUp.bind(this));
    this._canvas.addEventListener("wheel", this._onCanvasWheel.bind(this));
    this._canvas.addEventListener("contextmenu", this._onCanvasContextMenu.bind(this));
    this._canvas.addEventListener("dblclick", this._onCanvasDoubleClick.bind(this));

    // Resize observer
    const resizeObserver = new ResizeObserver(() => this._resizeCanvas());
    resizeObserver.observe(this._canvas.parentElement);
  }

  /**
   * Canvas mouse down handler
   * @private
   */
  _onCanvasMouseDown(event) {
    const pos = this._getMousePos(event);
    const worldPos = this._screenToWorld(pos);

    // Middle mouse or space+left click for panning
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      this._isPanning = true;
      this._dragOffset = { x: pos.x - this._pan.x, y: pos.y - this._pan.y };
      this._canvas.style.cursor = "grabbing";
      return;
    }

    // Left click
    if (event.button === 0) {
      // Check if clicking on a socket
      const socketHit = this._hitTestSockets(worldPos);
      if (socketHit) {
        this._startConnection(socketHit);
        return;
      }

      // Check if clicking on a node
      const nodeId = this._hitTestNodes(worldPos);
      if (nodeId) {
        this._selectNode(nodeId);
        this._isDragging = true;
        const node = this._dialogue.nodes[nodeId];
        this._dragOffset = {
          x: worldPos.x - node.position.x,
          y: worldPos.y - node.position.y
        };
        this._canvas.style.cursor = "move";
      } else {
        this._selectNode(null);
      }
    }
  }

  /**
   * Canvas mouse move handler
   * @private
   */
  _onCanvasMouseMove(event) {
    const pos = this._getMousePos(event);
    this._lastMousePos = pos;
    const worldPos = this._screenToWorld(pos);

    // Panning
    if (this._isPanning) {
      this._pan.x = pos.x - this._dragOffset.x;
      this._pan.y = pos.y - this._dragOffset.y;
      return;
    }

    // Dragging node
    if (this._isDragging && this._selectedNodeId) {
      const node = this._dialogue.nodes[this._selectedNodeId];
      node.position.x = Math.round((worldPos.x - this._dragOffset.x) / 20) * 20;
      node.position.y = Math.round((worldPos.y - this._dragOffset.y) / 20) * 20;
      return;
    }

    // Hover detection
    const nodeId = this._hitTestNodes(worldPos);
    if (nodeId !== this._hoveredNodeId) {
      this._hoveredNodeId = nodeId;
      this._canvas.style.cursor = nodeId ? "pointer" : "default";
    }
  }

  /**
   * Canvas mouse up handler
   * @private
   */
  _onCanvasMouseUp(event) {
    const pos = this._getMousePos(event);
    const worldPos = this._screenToWorld(pos);

    // End connection
    if (this._connectionStart) {
      const socketHit = this._hitTestSockets(worldPos, true);
      if (socketHit && socketHit.nodeId !== this._connectionStart.nodeId) {
        this._completeConnection(socketHit.nodeId);
      }
      this._connectionStart = null;
    }

    // End dragging
    if (this._isDragging) {
      this._saveUndoState();
    }

    this._isDragging = false;
    this._isPanning = false;
    this._canvas.style.cursor = "default";
  }

  /**
   * Canvas wheel handler for zoom
   * @private
   */
  _onCanvasWheel(event) {
    event.preventDefault();

    const pos = this._getMousePos(event);
    const worldPosBefore = this._screenToWorld(pos);

    // Zoom
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    this._zoom = Math.max(0.25, Math.min(2, this._zoom * delta));

    // Adjust pan to zoom toward mouse position
    const worldPosAfter = this._screenToWorld(pos);
    this._pan.x += (worldPosAfter.x - worldPosBefore.x) * this._zoom;
    this._pan.y += (worldPosAfter.y - worldPosBefore.y) * this._zoom;

    this.render({ parts: ["toolbar"] });
  }

  /**
   * Canvas context menu handler
   * @private
   */
  _onCanvasContextMenu(event) {
    event.preventDefault();

    const pos = this._getMousePos(event);
    const worldPos = this._screenToWorld(pos);
    const nodeId = this._hitTestNodes(worldPos);

    // Show context menu
    this._showContextMenu(event.clientX, event.clientY, nodeId, worldPos);
  }

  /**
   * Canvas double click handler
   * @private
   */
  _onCanvasDoubleClick(event) {
    const pos = this._getMousePos(event);
    const worldPos = this._screenToWorld(pos);
    const nodeId = this._hitTestNodes(worldPos);

    if (nodeId) {
      this._openNodeConfig(nodeId);
    } else {
      // Create new node at position
      this._createNodeAtPosition(worldPos);
    }
  }

  // ==================== Helper Functions ====================

  /**
   * Get mouse position relative to canvas
   * @private
   */
  _getMousePos(event) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   * @private
   */
  _screenToWorld(pos) {
    return {
      x: (pos.x - this._pan.x) / this._zoom,
      y: (pos.y - this._pan.y) / this._zoom
    };
  }

  /**
   * Hit test for nodes
   * @private
   */
  _hitTestNodes(worldPos) {
    for (const [id, node] of Object.entries(this._dialogue.nodes)) {
      if (
        worldPos.x >= node.position.x &&
        worldPos.x <= node.position.x + this._nodeWidth &&
        worldPos.y >= node.position.y &&
        worldPos.y <= node.position.y + this._nodeHeight
      ) {
        return id;
      }
    }
    return null;
  }

  /**
   * Hit test for sockets
   * @private
   */
  _hitTestSockets(worldPos, inputOnly = false) {
    for (const [id, node] of Object.entries(this._dialogue.nodes)) {
      const x = node.position.x;
      const y = node.position.y;
      const w = this._nodeWidth;
      const h = this._nodeHeight;
      const sr = this._socketRadius * 1.5; // Larger hit area

      // Input socket
      if (inputOnly || !inputOnly) {
        const inputDist = Math.sqrt(
          Math.pow(worldPos.x - x, 2) + Math.pow(worldPos.y - (y + h / 2), 2)
        );
        if (inputDist <= sr) {
          return { nodeId: id, type: "input", socketIndex: 0 };
        }
      }

      // Output sockets
      if (!inputOnly) {
        const outputs = this._getNodeOutputs(node);
        const spacing = h / (outputs.length + 1);

        for (let i = 0; i < outputs.length; i++) {
          const sy = y + spacing * (i + 1);
          const outputDist = Math.sqrt(
            Math.pow(worldPos.x - (x + w), 2) + Math.pow(worldPos.y - sy, 2)
          );
          if (outputDist <= sr) {
            return {
              nodeId: id,
              type: "output",
              socketIndex: i,
              connectionType: outputs[i].connectionType,
              x: x + w,
              y: sy
            };
          }
        }
      }
    }
    return null;
  }

  /**
   * Select a node
   * @private
   */
  _selectNode(nodeId) {
    this._selectedNodeId = nodeId;
    this.render({ parts: ["nodePanel", "sidebar"] });
  }

  /**
   * Start creating a connection
   * @private
   */
  _startConnection(socketHit) {
    if (socketHit.type === "output") {
      this._connectionStart = socketHit;
      this._connectionType = socketHit.connectionType;
    }
  }

  /**
   * Complete a connection to target node
   * @private
   */
  _completeConnection(targetNodeId) {
    if (!this._connectionStart) return;

    this._saveUndoState();

    const fromNodeId = this._connectionStart.nodeId;
    const connectionType = this._connectionStart.connectionType || "next";

    connectNodes(
      this._dialogue,
      fromNodeId,
      targetNodeId,
      connectionType,
      { text: localize("DialogueEditor.NewResponse") }
    );

    this.render({ parts: ["sidebar"] });
  }

  /**
   * Create a node at position
   * @private
   */
  async _createNodeAtPosition(worldPos, nodeType = NodeType.NPC_SPEECH) {
    this._saveUndoState();

    const node = addNode(this._dialogue, {
      type: nodeType,
      position: {
        x: Math.round(worldPos.x / 20) * 20,
        y: Math.round(worldPos.y / 20) * 20
      },
      label: this._getNodeTypeLabel(nodeType),
      text: ""
    });

    this._selectNode(node.id);
  }

  /**
   * Open node configuration dialog
   * @private
   */
  async _openNodeConfig(nodeId) {
    const node = this._dialogue.nodes[nodeId];
    if (!node) return;

    // Import and open the node config dialog
    const { DialogueNodeConfig } = await import("./dialogue-node-config.mjs");
    const config = new DialogueNodeConfig(node, this._dialogue, {
      callback: (updatedNode) => {
        this._saveUndoState();
        this._dialogue.nodes[nodeId] = updatedNode;
        this.render({ parts: ["sidebar", "nodePanel"] });
      }
    });
    config.render(true);
  }

  /**
   * Show context menu
   * @private
   */
  _showContextMenu(x, y, nodeId, worldPos) {
    // Remove existing menu
    document.querySelector(".dialogue-editor-context-menu")?.remove();

    const menu = document.createElement("div");
    menu.className = "dialogue-editor-context-menu";
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    if (nodeId) {
      const node = this._dialogue.nodes[nodeId];
      menu.innerHTML = `
        <div class="menu-item" data-action="edit">${localize("DialogueEditor.EditNode")}</div>
        <div class="menu-item" data-action="duplicate">${localize("DialogueEditor.DuplicateNode")}</div>
        <div class="menu-item" data-action="setStart">${localize("DialogueEditor.SetAsStart")}</div>
        <div class="menu-divider"></div>
        <div class="menu-item danger" data-action="delete">${localize("DialogueEditor.DeleteNode")}</div>
      `;

      menu.addEventListener("click", async (e) => {
        const action = e.target.dataset.action;
        menu.remove();

        switch (action) {
          case "edit":
            this._openNodeConfig(nodeId);
            break;
          case "duplicate":
            this._duplicateNode(nodeId);
            break;
          case "setStart":
            this._setStartNode(nodeId);
            break;
          case "delete":
            this._deleteNode(nodeId);
            break;
        }
      });
    } else {
      // No node - show add node menu
      const nodeTypes = Object.entries(NodeType).slice(0, 6);
      menu.innerHTML = nodeTypes.map(([key, value]) => `
        <div class="menu-item" data-type="${value}">
          <i class="fa-solid ${this._getNodeTypeIcon(value)}"></i>
          ${localize(`DialogueEditor.NodeType.${key}`)}
        </div>
      `).join("") + `
        <div class="menu-divider"></div>
        <div class="menu-item" data-action="addAll">${localize("DialogueEditor.MoreNodeTypes")}</div>
      `;

      menu.addEventListener("click", (e) => {
        const type = e.target.dataset.type;
        menu.remove();

        if (type) {
          this._createNodeAtPosition(worldPos, type);
        }
      });
    }

    document.body.appendChild(menu);

    // Close on click outside
    setTimeout(() => {
      document.addEventListener("click", () => menu.remove(), { once: true });
    }, 10);
  }

  // ==================== Node Helpers ====================

  /**
   * Get node colors by type
   * @private
   */
  _getNodeColors(type) {
    const colors = {
      [NodeType.NPC_SPEECH]: { bg: "#2d3a4a", header: "#3498db", border: "#5faee3", selected: "#3d4a5a", glow: "#3498db" },
      [NodeType.PLAYER_CHOICE]: { bg: "#3a2d4a", header: "#9b59b6", border: "#b07cc6", selected: "#4a3d5a", glow: "#9b59b6" },
      [NodeType.SKILL_CHECK]: { bg: "#4a3a2d", header: "#e67e22", border: "#eb9b4f", selected: "#5a4a3d", glow: "#e67e22" },
      [NodeType.SHOP]: { bg: "#2d4a3a", header: "#2ecc71", border: "#5ed897", selected: "#3d5a4a", glow: "#2ecc71" },
      [NodeType.QUEST_OFFER]: { bg: "#4a4a2d", header: "#f1c40f", border: "#f5d23d", selected: "#5a5a3d", glow: "#f1c40f" },
      [NodeType.QUEST_TURNIN]: { bg: "#4a4a2d", header: "#f39c12", border: "#f5b041", selected: "#5a5a3d", glow: "#f39c12" },
      [NodeType.BRANCH]: { bg: "#3a3a4a", header: "#95a5a6", border: "#adb9ba", selected: "#4a4a5a", glow: "#95a5a6" },
      [NodeType.END]: { bg: "#4a2d2d", header: "#e74c3c", border: "#ec7063", selected: "#5a3d3d", glow: "#e74c3c" }
    };
    return colors[type] || colors[NodeType.NPC_SPEECH];
  }

  /**
   * Get node type icon
   * @private
   */
  _getNodeTypeIcon(type) {
    const icons = {
      [NodeType.NPC_SPEECH]: "fa-comment",
      [NodeType.PLAYER_CHOICE]: "fa-comments",
      [NodeType.SKILL_CHECK]: "fa-dice-d20",
      [NodeType.SHOP]: "fa-store",
      [NodeType.QUEST_OFFER]: "fa-scroll",
      [NodeType.QUEST_TURNIN]: "fa-check-circle",
      [NodeType.REWARD]: "fa-gift",
      [NodeType.SERVICE]: "fa-concierge-bell",
      [NodeType.BANK]: "fa-landmark",
      [NodeType.HIRE]: "fa-user-plus",
      [NodeType.STABLE]: "fa-horse",
      [NodeType.BRANCH]: "fa-code-branch",
      [NodeType.END]: "fa-stop-circle"
    };
    return icons[type] || "fa-circle";
  }

  /**
   * Get icon character for canvas rendering
   * @private
   */
  _getNodeTypeIconChar(type) {
    const chars = {
      [NodeType.NPC_SPEECH]: "\uf075",
      [NodeType.PLAYER_CHOICE]: "\uf086",
      [NodeType.SKILL_CHECK]: "\uf6cf",
      [NodeType.SHOP]: "\uf54e",
      [NodeType.QUEST_OFFER]: "\uf70e",
      [NodeType.QUEST_TURNIN]: "\uf058",
      [NodeType.REWARD]: "\uf06b",
      [NodeType.SERVICE]: "\uf562",
      [NodeType.BANK]: "\uf19c",
      [NodeType.HIRE]: "\uf234",
      [NodeType.STABLE]: "\uf6f0",
      [NodeType.BRANCH]: "\uf126",
      [NodeType.END]: "\uf28d"
    };
    return chars[type] || "\uf111";
  }

  /**
   * Get node type label
   * @private
   */
  _getNodeTypeLabel(type) {
    const key = Object.entries(NodeType).find(([k, v]) => v === type)?.[0];
    return localize(`DialogueEditor.NodeType.${key}`) || type;
  }

  /**
   * Get node output sockets
   * @private
   */
  _getNodeOutputs(node) {
    switch (node.type) {
      case NodeType.NPC_SPEECH:
        return [{ connectionType: "response", color: "#2ecc71", label: "" }];
      case NodeType.PLAYER_CHOICE:
        return (node.responses || []).map((r, i) => ({
          connectionType: "response",
          color: "#9b59b6",
          label: `R${i + 1}`,
          responseId: r.id
        }));
      case NodeType.SKILL_CHECK:
        return [
          { connectionType: "success", color: "#2ecc71", label: "Pass" },
          { connectionType: "failure", color: "#e74c3c", label: "Fail" }
        ];
      case NodeType.QUEST_OFFER:
        return [
          { connectionType: "accept", color: "#2ecc71", label: "Accept" },
          { connectionType: "decline", color: "#e74c3c", label: "Decline" }
        ];
      case NodeType.QUEST_TURNIN:
        return [
          { connectionType: "success", color: "#2ecc71", label: "Done" },
          { connectionType: "failure", color: "#f39c12", label: "Incomplete" }
        ];
      case NodeType.BRANCH:
        const branches = (node.branches || []).map((b, i) => ({
          connectionType: "branch",
          color: "#95a5a6",
          label: `B${i + 1}`,
          branchId: b.id
        }));
        branches.push({ connectionType: "default", color: "#7f8c8d", label: "Default" });
        return branches;
      case NodeType.END:
        return [];
      default:
        return [{ connectionType: "next", color: "#2ecc71", label: "" }];
    }
  }

  /**
   * Get node outputs with their target node IDs
   * @private
   */
  _getNodeOutputsWithTargets(node) {
    switch (node.type) {
      case NodeType.NPC_SPEECH:
        return (node.responses || []).map(r => ({
          targetId: r.nextNodeId,
          color: "#2ecc71"
        }));
      case NodeType.PLAYER_CHOICE:
        return (node.responses || []).map(r => ({
          targetId: r.nextNodeId,
          color: "#9b59b6"
        }));
      case NodeType.SKILL_CHECK:
        return [
          { targetId: node.skillCheck?.successNodeId, color: "#2ecc71" },
          { targetId: node.skillCheck?.failureNodeId, color: "#e74c3c" }
        ];
      case NodeType.QUEST_OFFER:
        return [
          { targetId: node.acceptNodeId, color: "#2ecc71" },
          { targetId: node.declineNodeId, color: "#e74c3c" }
        ];
      case NodeType.QUEST_TURNIN:
        return [
          { targetId: node.successNodeId, color: "#2ecc71" },
          { targetId: node.incompleteNodeId, color: "#f39c12" }
        ];
      case NodeType.BRANCH:
        const outputs = (node.branches || []).map(b => ({
          targetId: b.nextNodeId,
          color: "#95a5a6"
        }));
        outputs.push({ targetId: node.defaultNodeId, color: "#7f8c8d" });
        return outputs;
      case NodeType.END:
        return [];
      default:
        return [{ targetId: node.nextNodeId, color: "#2ecc71" }];
    }
  }

  /**
   * Get node preview text
   * @private
   */
  _getNodePreview(node) {
    switch (node.type) {
      case NodeType.NPC_SPEECH:
      case NodeType.SKILL_CHECK:
      case NodeType.END:
        return node.text || localize("DialogueEditor.NoText");
      case NodeType.PLAYER_CHOICE:
        const count = (node.responses || []).length;
        return `${count} ${localize("DialogueEditor.Responses")}`;
      case NodeType.QUEST_OFFER:
      case NodeType.QUEST_TURNIN:
        return node.questId || localize("DialogueEditor.NoQuestSelected");
      case NodeType.BRANCH:
        const branchCount = (node.branches || []).length;
        return `${branchCount} ${localize("DialogueEditor.Branches")}`;
      default:
        return node.label || "";
    }
  }

  /**
   * Truncate text to fit width
   * @private
   */
  _truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;

    let truncated = text;
    while (ctx.measureText(truncated + "...").width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + "...";
  }

  /**
   * Wrap text to fit width
   * @private
   */
  _wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  // ==================== Undo/Redo ====================

  /**
   * Save current state for undo
   * @private
   */
  _saveUndoState() {
    this._undoStack.push(JSON.stringify(this._dialogue));
    if (this._undoStack.length > this._maxUndoSteps) {
      this._undoStack.shift();
    }
    this._redoStack = [];
  }

  /**
   * Undo last action
   * @private
   */
  _undo() {
    if (this._undoStack.length === 0) return;

    this._redoStack.push(JSON.stringify(this._dialogue));
    this._dialogue = JSON.parse(this._undoStack.pop());
    this._selectedNodeId = null;
    this.render({ parts: ["toolbar", "sidebar", "nodePanel"] });
  }

  /**
   * Redo last undone action
   * @private
   */
  _redo() {
    if (this._redoStack.length === 0) return;

    this._undoStack.push(JSON.stringify(this._dialogue));
    this._dialogue = JSON.parse(this._redoStack.pop());
    this._selectedNodeId = null;
    this.render({ parts: ["toolbar", "sidebar", "nodePanel"] });
  }

  // ==================== Keyboard Shortcuts ====================

  /**
   * Setup keyboard shortcuts
   * @private
   */
  _setupKeyboardShortcuts() {
    this._keydownHandler = this._onKeyDown.bind(this);
    document.addEventListener("keydown", this._keydownHandler);
  }

  /**
   * Handle keydown events
   * @private
   */
  _onKeyDown(event) {
    // Only handle when editor is focused
    if (!this.element?.contains(document.activeElement) && document.activeElement !== document.body) {
      return;
    }

    const isCtrl = event.ctrlKey || event.metaKey;

    // Ctrl+Z - Undo
    if (isCtrl && event.key === "z" && !event.shiftKey) {
      event.preventDefault();
      this._undo();
      return;
    }

    // Ctrl+Shift+Z or Ctrl+Y - Redo
    if ((isCtrl && event.shiftKey && event.key === "z") || (isCtrl && event.key === "y")) {
      event.preventDefault();
      this._redo();
      return;
    }

    // Delete - Delete selected node
    if ((event.key === "Delete" || event.key === "Backspace") && this._selectedNodeId) {
      event.preventDefault();
      this._deleteNode(this._selectedNodeId);
      return;
    }

    // Ctrl+D - Duplicate selected node
    if (isCtrl && event.key === "d" && this._selectedNodeId) {
      event.preventDefault();
      this._duplicateNode(this._selectedNodeId);
      return;
    }

    // Ctrl+S - Save
    if (isCtrl && event.key === "s") {
      event.preventDefault();
      this._save();
      return;
    }

    // Escape - Deselect
    if (event.key === "Escape") {
      if (this._connectionStart) {
        this._connectionStart = null;
      } else {
        this._selectNode(null);
      }
      return;
    }
  }

  // ==================== Node Operations ====================

  /**
   * Delete a node
   * @private
   */
  _deleteNode(nodeId) {
    this._saveUndoState();
    removeNode(this._dialogue, nodeId);

    if (this._selectedNodeId === nodeId) {
      this._selectedNodeId = null;
    }

    this.render({ parts: ["sidebar", "nodePanel"] });
  }

  /**
   * Duplicate a node
   * @private
   */
  _duplicateNode(nodeId) {
    const node = this._dialogue.nodes[nodeId];
    if (!node) return;

    this._saveUndoState();

    const newNode = addNode(this._dialogue, {
      ...foundry.utils.deepClone(node),
      id: undefined,
      position: {
        x: node.position.x + 40,
        y: node.position.y + 40
      },
      label: `${node.label || ""} (Copy)`
    });

    this._selectNode(newNode.id);
  }

  /**
   * Set a node as the start node
   * @private
   */
  _setStartNode(nodeId) {
    this._saveUndoState();
    this._dialogue.startNodeId = nodeId;
    ui.notifications.info(localize("DialogueEditor.StartNodeSet"));
  }

  // ==================== Actions ====================

  static #onAddNode(event, target) {
    const type = target.dataset.nodeType || NodeType.NPC_SPEECH;
    const centerX = (this._canvas.width / 2 - this._pan.x) / this._zoom;
    const centerY = (this._canvas.height / 2 - this._pan.y) / this._zoom;
    this._createNodeAtPosition({ x: centerX, y: centerY }, type);
  }

  static #onDeleteNode(event, target) {
    if (this._selectedNodeId) {
      this._deleteNode(this._selectedNodeId);
    }
  }

  static #onDuplicateNode(event, target) {
    if (this._selectedNodeId) {
      this._duplicateNode(this._selectedNodeId);
    }
  }

  static #onEditNode(event, target) {
    if (this._selectedNodeId) {
      this._openNodeConfig(this._selectedNodeId);
    }
  }

  static #onUndo(event, target) {
    this._undo();
  }

  static #onRedo(event, target) {
    this._redo();
  }

  static #onZoomIn(event, target) {
    this._zoom = Math.min(2, this._zoom * 1.2);
    this.render({ parts: ["toolbar"] });
  }

  static #onZoomOut(event, target) {
    this._zoom = Math.max(0.25, this._zoom / 1.2);
    this.render({ parts: ["toolbar"] });
  }

  static #onZoomFit(event, target) {
    const nodes = Object.values(this._dialogue.nodes);
    if (nodes.length === 0) return;

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + this._nodeWidth);
      maxY = Math.max(maxY, node.position.y + this._nodeHeight);
    });

    const padding = 50;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    const scaleX = this._canvas.width / contentWidth;
    const scaleY = this._canvas.height / contentHeight;
    this._zoom = Math.min(scaleX, scaleY, 1);

    this._pan.x = (this._canvas.width - contentWidth * this._zoom) / 2 - minX * this._zoom + padding * this._zoom;
    this._pan.y = (this._canvas.height - contentHeight * this._zoom) / 2 - minY * this._zoom + padding * this._zoom;

    this.render({ parts: ["toolbar"] });
  }

  static #onZoomReset(event, target) {
    this._zoom = 1;
    this._pan = { x: 0, y: 0 };
    this.render({ parts: ["toolbar"] });
  }

  static async #onValidate(event, target) {
    const result = validateDialogue(this._dialogue);

    if (result.valid && result.warnings.length === 0) {
      ui.notifications.info(localize("DialogueEditor.ValidationPassed"));
    } else {
      let message = "";
      if (result.errors.length > 0) {
        message += `<strong>${localize("DialogueEditor.Errors")}:</strong><ul>${result.errors.map(e => `<li>${e}</li>`).join("")}</ul>`;
      }
      if (result.warnings.length > 0) {
        message += `<strong>${localize("DialogueEditor.Warnings")}:</strong><ul>${result.warnings.map(w => `<li>${w}</li>`).join("")}</ul>`;
      }

      new Dialog({
        title: localize("DialogueEditor.ValidationResults"),
        content: `<div class="validation-results">${message}</div>`,
        buttons: { ok: { label: localize("Common.OK") } }
      }).render(true);
    }
  }

  static async #onPreview(event, target) {
    ui.notifications.info(localize("DialogueEditor.PreviewNotImplemented"));
  }

  static async #onSave(event, target) {
    await this._save();
  }

  static async #onSaveAndClose(event, target) {
    await this._save();
    this.close();
  }

  static #onExport(event, target) {
    const data = JSON.stringify(this._dialogue, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `dialogue-${this._dialogue.name.slugify()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    ui.notifications.info(localize("DialogueEditor.ExportSuccess"));
  }

  static async #onImport(event, target) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text);

        if (!imported.nodes || !imported.name) {
          throw new Error("Invalid dialogue format");
        }

        this._saveUndoState();
        this._dialogue = createDialogue(imported);
        this._selectedNodeId = null;
        this.render();

        ui.notifications.info(localize("DialogueEditor.ImportSuccess"));
      } catch (error) {
        console.error(`${MODULE_ID} | Import error:`, error);
        ui.notifications.error(localize("DialogueEditor.ImportError"));
      }
    };

    input.click();
  }

  /**
   * Save dialogue
   * @private
   */
  async _save() {
    try {
      // Update editor state
      this._dialogue.editorZoom = this._zoom;
      this._dialogue.editorPan = { ...this._pan };
      this._dialogue.updatedAt = Date.now();

      const handler = getDialogueHandler();
      if (!handler) {
        ui.notifications.error(localize("DialogueEditor.HandlerNotFound"));
        return;
      }

      if (this._isNewDialogue) {
        await handler.createDialogue(this._dialogue);
        this._isNewDialogue = false;
      } else {
        await handler.updateDialogue(this._dialogue.id, this._dialogue);
      }

      ui.notifications.info(localize("DialogueEditor.Saved"));
    } catch (error) {
      console.error(`${MODULE_ID} | Save error:`, error);
      ui.notifications.error(localize("DialogueEditor.SaveError"));
    }
  }

  // ==================== Static Factory ====================

  /**
   * Open dialogue editor for a dialogue
   * @param {object|string|null} dialogue - Dialogue data, ID, or null for new
   * @param {object} options - Additional options
   */
  static async open(dialogue = null, options = {}) {
    if (typeof dialogue === "string") {
      const handler = getDialogueHandler();
      dialogue = handler?.getDialogue(dialogue);
    }

    const editor = new DialogueEditor(dialogue, options);
    await editor.render(true);
    return editor;
  }
}
