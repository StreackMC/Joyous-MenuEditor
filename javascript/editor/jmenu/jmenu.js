// 编辑器注册默认要求
import editorManager from "../../backend/editorManager.js";
import { Editor } from "../editor.js";
import { JavaButton, BedrockButton, JMenu } from "./dataDef.js";
import MCColors from "../../library/MCColors.js";
import i18n from "../../i18n.js";
import { HTMLmcChestDisplay } from "../../ui/customElements/HTMLmcChestDisplay.js";
import commandServer from "../../backend/commandServer.js";
const EditorId = "jmenu";

const JMeleSTYLE = `
/* BASE */
.root {
  --jm-actionbar-padding-y: 4px;
  --jm-actionbar-padding-x: min(5%, 16px);
  --jm-actionbar-bg-color: rgba(248, 249, 251, 0.9);
  --jm-accept-min-width: 400px;
  background: transparent;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(max(var(--jm-accept-min-width, 400px), 50%), 1fr));
  grid-template-rows: calc(48px + var(--jm-actionbar-padding-y, 4px) + var(--jm-actionbar-padding-y, 4px)) auto;
  overflow: auto;
}

/* ACTIONBAR */
.actionbar {
  background-color: var(--jm-actionbar-bg-color, rgba(248, 249, 251, 0.9));
  backdrop-filter: blur(30px) saturate(200%);
  width: calc(100% - var(--jm-actionbar-padding-x, min(5%, 16px)) - var(--jm-actionbar-padding-x, min(5%, 16px)));
  grid-column: 1 / -1;
  position: sticky;
  top: 0;
  padding: var(--jm-actionbar-padding-y, 4px) var(--jm-actionbar-padding-x, min(5%, 16px)) var(--jm-actionbar-padding-y, 4px) var(--jm-actionbar-padding-x, min(5%, 16px));
  display: flex;
  flex-direction: row;
  gap: min(max(.5%, 5px), 10px);
  align-items: center;
  align-content: center;
  overflow-y: hidden;
  overflow-x: auto;
  z-index: 2;
}

.actionbar s-icon-button {
  width: calc((48px + var(--jm-actionbar-padding-y, 4px) + var(--jm-actionbar-padding-y, 4px)) *
      /* 高度的多少倍： */
      0.75);
}

.title {
  overflow: hidden;
  white-space: nowrap;
  flex: 6;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  font-size: calc((48px + var(--jm-actionbar-padding-y, 4px) + var(--jm-actionbar-padding-y, 4px)) *
      /* 高度的多少倍： */
      0.35);
}

.title::after {
  flex: auto;
}

/* JAVA-AREA */
.java {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 1em;
  grid-row-start: 2;
}

.chest {
  margin-left: auto;
  margin-right: auto;
}

mc-chest-display {
  width: 394px;
}

.iteminfo-root {
  margin-top: 1em;
  max-width: unset;
  width: 80%;
  padding: 1em;
  display: flex;
  flex-direction: column;
  gap: .9em;
}

.iteminfo-root h2 {
  overflow: hidden;
  white-space: nowrap;
  margin: 0 0 0 .2em;
  font-size: 1.1em;
  font-weight: 600;
  cursor: default;
}

.iteminfo-root h2.edit-hint {
  color: var(--s-color-outline, #6f7979);
  font-style: italic;
  font-weight: 400 !important;
}

.iteminfo-body {
  display: flex;
  flex-direction: column;
  gap: .9em;
  opacity: 0;
  transform: translateY(-12px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  pointer-events: none;
}

.iteminfo-body[visible] {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.iteminfo-unsave {
  max-width: unset;
  width: 80%;
  margin: 0 auto 0 auto;
  display: none;
}

.iteminfo-unsave[visible] {
  display: block;
}

/* BEDROCK-AREA */
.bedrock {}
`;

// ───────────────────── EditorJmenu ─────────────────────

export class EditorJmenu extends Editor {
  /** @type {Promise<String>} */
  #dataTask;
  /** @type {JMElement} */
  element;

  /**
   * @param {import("../../backend/editorManager.js").MemFileNode|import("../../backend/fileServer.js").FileNode} fileNode
   * @param {string} filename
   */
  constructor(fileNode, filename) {
    super(fileNode, filename);
    this.data = null;
    this.#dataTask = this.fileNode.read();
    this.element = new JMElement();
    this.element.style = `width:100%;height:100%`;
  }
  getRegId() { return EditorId; }
  getData() {
    const d = this.element.getData();
    return (d instanceof JMenu) ? d.toString() : `{"jme":"menu","jmev":${JMenu.version}}`;
  }
  getElement() { return this.element; }
  async init() {
    const raw = await this.#dataTask;
    this.setData(new JMenu(JSON.parse(raw)));
  }
  async setData(data) {
    if (data instanceof JMenu) {
      this.element.setData(data);
    }
  }
  revert(step = 1) { /* todo */ }
  redo(step = 1) { /* todo */ }
  destroy() { this.element.remove(); }
  requireFlush = true;
}

/**
 * verify 函数 —— data 已由 openEditor 归一化为 FileNode | MemFileNode，
 * 直接调用 `await data.read()` 获取文本内容即可。
 */
editorManager.regisiterEditor(EditorId, async (fileNode, filename) => {
  let content;
  try {
    content = JSON.parse(await fileNode.read());
  } catch (error) {
    content = {};
  }
  if (content.jme === "menu") {
    return (content.title) ? MCColors.remove(content.title) : "Untitled Menu";
  }
  return "";
}, EditorJmenu);

// ───────────────────── SVG 图标常量 ─────────────────────

const SVG_ICONS = {
  // 全屏 — have 状态
  fullscreen: `<svg viewBox="0 -960 960 960"><path d="M280-280v-400h400v400H280Zm80-80h240v-240H360v240Zm-240 80v-80h80v80h-80Zm0-320v-80h80v80h-80Zm160 480v-80h80v80h-80Zm0-640v-80h80v80h-80Zm320 640v-80h80v80h-80Zm0-640v-80h80v80h-80Zm160 480v-80h80v80h-80Zm0-320v-80h80v80h-80ZM480-480Z"/></svg>`,
  // 缩小 — miss 状态
  fullscreen_exit: `<svg viewBox="0 -960 960 960"><path d="M280-280v-400h400v400H280Zm-160 0v-80h80v80h-80Zm0-320v-80h80v80h-80Zm160 480v-80h80v80h-80Zm0-640v-80h80v80h-80Zm320 640v-80h80v80h-80Zm0-640v-80h80v80h-80Zm160 480v-80h80v80h-80Zm0-320v-80h80v80h-80Z"/></svg>`,
};

// ───────────────────── JMElement ─────────────────────

export class JMElement extends HTMLElement {
  /** @type {JMenu|null} */          #_data;
  /** @type {number} */ #_hoverIndex = -1;
  /** @type {number} */ #_selectedIndex = -1;
  /** @type {number|null} */ #_pendingSelection = null;
  /** @type {boolean} */ #_unsaved = false;

  // DOM refs
  /** @type {HTMLElement} */ #_titleEl;       // actionbar title
  /** @type {HTMLmcChestDisplay} */ #_chestEl;       // mc-chest-display
  /** @type {HTMLElement} */ #_editArea;      // s-card.iteminfo-root
  /** @type {HTMLElement} */ #_editBody;      // .iteminfo-body
  /** @type {HTMLElement} */ #_slotTitleEl;   // h2 in edit area
  /** @type {HTMLElement} */ #_unsaveCard;    // s-card.iteminfo-unsave
  /** @type {HTMLElement} */ #_unsaveTextEl;  // unsave text div
  /** @type {HTMLElement} */ #_permField;     // s-text-field for perm
  /** @type {HTMLElement} */ #_permToggleBtn; // s-icon-button for toggle
  /** @type {HTMLElement} */ #_permToggleIcon; // s-icon inside toggle
  /** @type {HTMLElement} */ #_permRemoveBtn; // s-icon-button for remove
  /** @type {HTMLElement} */ #_picker;        // s-picker for action type
  /** @type {HTMLElement} */ #_paramField;    // s-text-field for param

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._buildShadowDOM();
    this._bindEvents();
  }

  // ═════════════════════════════════════════════
  //  公共接口
  // ═════════════════════════════════════════════

  /** @param {JMenu} data */
  setData(data) {
    if (!(data instanceof JMenu)) throw new Error("Unrecognized Data Type: " + data);
    this.#_data = data;
    // 更新 UI：菜单标题、箱子名称与行数、以及格子物品
    try {
      // actionbar title
      this.#_titleEl.innerHTML = MCColors.toHtml(this.#_data.title || "");
      this.#_titleEl.title = MCColors.strip(this.#_data.title || "");
    } catch (e) {
      this.#_titleEl.textContent = this.#_data.title || "";
    }
    // chest: set name and line count
    try { this.#_chestEl.name = this.#_data.title || ""; } catch (e) { this.#_chestEl.setAttribute('name', this.#_data.title || ''); }
    try { this.#_chestEl.line = this.#_data.lines || 3; } catch (e) { this.#_chestEl.setAttribute('line', String(this.#_data.lines || 3)); }

    // prepare items array (54 slots)
    const itemsArr = new Array(54).fill(null);
    if (this.#_data.java instanceof Map) {
      for (const [slot, btn] of this.#_data.java.entries()) {
        if (!slot || slot.length < 2) continue;
        const line = parseInt(slot[0]);
        const column = parseInt(slot[1]);
        if (Number.isNaN(line) || Number.isNaN(column)) continue;
        const idx = (line - 1) * 9 + (column - 1);
        if (idx >= 0 && idx < 54) {
          itemsArr[idx] = btn.id || null;
        }
      }
    }
    this.#_chestEl.setItems(itemsArr);
    // reset UI state
    this.#_slotTitleEl.textContent = tr('title_idle');
    this.#_editBody.removeAttribute('visible');
    this.#_unsaveCard.removeAttribute('visible');
  }

  /** @returns {JMenu|null} */
  getData() { return this.#_data; }

  // ═════════════════════════════════════════════
  //  ShadowDOM 构建
  // ═════════════════════════════════════════════

  _buildShadowDOM() {
    const shadow = this.shadowRoot;

    // 1. 样式
    const style = document.createElement('style');
    style.textContent = JMeleSTYLE;
    shadow.appendChild(style);

    // 2. 根容器
    const root = ce('div', 'root');
    shadow.appendChild(root);

    // ─── Action Bar ──────────────────────────────
    const actionbar = ce('div', 'actionbar');
    root.appendChild(actionbar);

    const title = ce('div', 'title');
    title.textContent = '';
    actionbar.appendChild(title);
    this.#_titleEl = title;

    // 重命名按钮
    actionbar.appendChild(this._buildTipBtn(
      '<svg viewBox="0 -960 960 960"><path d="m490-527 37 37 217-217-37-37-217 217ZM200-200h37l233-233-37-37-233 233v37Zm355-205L405-555l167-167-29-29-219 219-56-56 218-219q24-24 56.5-24t56.5 24l29 29 50-50q12-12 28.5-12t28.5 12l93 93q12 12 12 28.5T828-678L555-405ZM270-120H120v-150l285-285 150 150-285 285Z"></path></svg>',
      tr('rename_title'), true
    ));
    actionbar.appendChild(this._buildTipBtn('arrow_forward', tr('sync_java_to_bedrock')));
    actionbar.appendChild(this._buildTipBtn('arrow_back', tr('sync_bedrock_to_java')));

    // ─── Java 区域 ──────────────────────────────
    const java = ce('div', 'java');
    root.appendChild(java);

    const chest = document.createElement('mc-chest-display');
    chest.className = 'chest';
    chest.setAttribute('line', '6');
    java.appendChild(chest);
    this.#_chestEl = chest;

    // 编辑面板
    const editArea = document.createElement('s-card');
    editArea.className = 'iteminfo-root';
    java.appendChild(editArea);
    this.#_editArea = editArea;

    // 位置标题（即用户所指的"标题"）—— 始终可见
    const slotTitle = document.createElement('h2');
    slotTitle.textContent = '';
    editArea.appendChild(slotTitle);
    this.#_slotTitleEl = slotTitle;

    // ── 可隐藏内容（body）──
    const editBody = document.createElement('div');
    editBody.className = 'iteminfo-body';
    editArea.appendChild(editBody);
    this.#_editBody = editBody;

    // ── Unsaved ──
    const unsaveCard = document.createElement('s-card');
    unsaveCard.className = 'iteminfo-unsave';
    editBody.appendChild(unsaveCard);
    this.#_unsaveCard = unsaveCard;

    const unsaveText = document.createElement('div');
    unsaveText.setAttribute('slot', 'text');
    unsaveCard.appendChild(unsaveText);
    this.#_unsaveTextEl = unsaveText;

    const dismissBtn = document.createElement('s-button');
    dismissBtn.setAttribute('slot', 'action');
    dismissBtn.style.backgroundColor = 'var(--s-color-error-container,#FFDAD6)';
    dismissBtn.setAttribute('type', 'filled-tonal');
    dismissBtn.textContent = tr('dismiss');
    unsaveCard.appendChild(dismissBtn);

    const cancelBtn = document.createElement('s-button');
    cancelBtn.setAttribute('slot', 'action');
    cancelBtn.setAttribute('type', 'filled-tonal');
    cancelBtn.textContent = tr('cancel');
    unsaveCard.appendChild(cancelBtn);

    // ── Save ──
    const saveBtn = document.createElement('s-button');
    saveBtn.style.display = 'flex';
    saveBtn.setAttribute('type', 'filled-tonal');
    saveBtn.textContent = tr('save');
    editBody.appendChild(saveBtn);

    // ── Edit item ──
    const editItemBtn = document.createElement('s-button');
    editItemBtn.style.display = 'flex';
    editItemBtn.setAttribute('type', 'filled-tonal');
    editItemBtn.textContent = tr('edit_item');
    editBody.appendChild(editItemBtn);

    // ── Permission field ──
    const permField = document.createElement('s-text-field');
    permField.style.display = 'grid';
    permField.style.width = 'auto';
    permField.setAttribute('label', tr('permission_label'));
    editBody.appendChild(permField);
    this.#_permField = permField;

    // 权限切换按钮（单个，SVG 动态替换：fullscreen ↔ fullscreen_exit）
    const permTip = this._buildTipBtn(SVG_ICONS.fullscreen, tr('permission_switch'), false, "");
    permTip.setAttribute('slot', 'end');
    permField.appendChild(permTip);
    this.#_permToggleBtn = permTip.querySelector('s-icon-button');
    this.#_permToggleIcon = this.#_permToggleBtn.querySelector('s-icon');

    // 权限移除按钮
    const permRemoveTip = this._buildTipBtn('close', tr('permission_remove'), false, "");
    permRemoveTip.setAttribute('slot', 'end');
    permField.appendChild(permRemoveTip);
    this.#_permRemoveBtn = permRemoveTip.querySelector('s-icon-button');

    // ── Action type picker ──
    const picker = document.createElement('s-picker');
    picker.setAttribute('label', tr('action_type'));
    picker.setAttribute('value', 'none');
    editBody.appendChild(picker);
    const types = [
      ['menu', 'action_type_menu'], ['cmd', 'action_type_cmd'],
      ['op', 'action_type_op'], ['con', 'action_type_con'],
      ['url', 'action_type_url'], ['none', 'action_type_none'],
    ];
    for (const [val, key] of types) {
      const item = document.createElement('s-picker-item');
      item.setAttribute('value', val);
      item.textContent = tr(key);
      picker.appendChild(item);
    }
    this.#_picker = picker;

    // ── Action param field ──
    const paramField = document.createElement('s-text-field');
    paramField.style.display = 'grid';
    paramField.style.width = 'auto';
    paramField.setAttribute('label', tr('action_param'));
    editBody.appendChild(paramField);
    this.#_paramField = paramField;

    const resetTip = this._buildTipBtn('close', tr('action_param_reset'), false, "");
    resetTip.setAttribute('slot', 'end');
    paramField.appendChild(resetTip);

    // ─── Bedrock 区域 ───────────────────────────
    root.appendChild(ce('div', 'bedrock'));
  }

  // ═════════════════════════════════════════════
  //  事件绑定
  // ═════════════════════════════════════════════

  _bindEvents() {
    // 悬停事件：更新标题提示
    this.#_chestEl.addEventListener('itemHover', e => {
      const { action, row, column, index } = e.detail;
      if (action === 'enter') {
        this.#_hoverIndex = index;
        this.#_slotTitleEl.textContent = tr('title_hover', { slot: index + 1, row, column });
      } else if (action === 'leave') {
        this.#_hoverIndex = -1;
        if (this.#_selectedIndex === -1) this.#_slotTitleEl.textContent = tr('title_idle');
      }
    });

    // 点击事件：选中/编辑或触发未保存提示
    this.#_chestEl.addEventListener('itemClick', e => {
      const { row, column, index } = e.detail;
      if (this.#_unsaved && this.#_selectedIndex !== -1 && this.#_selectedIndex !== index) {
        // 待执行的选择保留，以便用户在未保存提示中决定
        this.#_pendingSelection = index;
        this._showUnsavePrompt(this.#_selectedIndex);
        return;
      }
      this._applySelection(index, row, column);
    });

    // 点击编辑区外部时（预留：用于取消或收起）
    this.#_editArea.addEventListener('click', e => {
      // 不处理默认行为，目前留空以允许内嵌控件响应
    });

    // 表单控件变化
    this.#_picker.addEventListener('change', e => { this.#_unsaved = true; });
    this.#_permField.addEventListener('input', e => { this.#_unsaved = true; });
    this.#_paramField.addEventListener('input', e => { this.#_unsaved = true; });

    // unsave card buttons
    const dismissBtn = this.#_unsaveCard.querySelector('s-button[slot="action"]');
    const cancelBtn = Array.from(this.#_unsaveCard.querySelectorAll('s-button[slot="action"]'))[1];
    if (dismissBtn) dismissBtn.addEventListener('click', () => {
      this.#_unsaved = false;
      this.#_unsaveCard.removeAttribute('visible');
      if (this.#_pendingSelection != null) {
        const idx = this.#_pendingSelection; this.#_pendingSelection = null;
        const rc = this._indexToRowCol(idx);
        this._applySelection(idx, rc[0], rc[1]);
      }
    });
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      this.#_unsaveCard.removeAttribute('visible');
      this.#_pendingSelection = null;
    });

    // save button (first in editBody following unsave card)
    const saveBtn = this.#_editBody.querySelector('s-button[type="filled-tonal"]');
    if (saveBtn) saveBtn.addEventListener('click', () => { this._saveCurrentEdit(); });

    // permission toggle and remove
    if (this.#_permToggleBtn) this.#_permToggleBtn.addEventListener('click', () => { this._togglePermPreview(); });
    if (this.#_permRemoveBtn) this.#_permRemoveBtn.addEventListener('click', () => { this.#_permField.setAttribute('value', ''); this.#_unsaved = true; });

    // param reset button
    const resetTip = this.#_paramField.querySelector('s-tooltip');
    if (resetTip) {
      const resetBtn = resetTip.querySelector('s-icon-button');
      if (resetBtn) resetBtn.addEventListener('click', () => { this.#_paramField.setAttribute('value', ''); this.#_unsaved = true; });
    }
  }

  // Helper: convert index -> [row, column] (1-indexed)
  _indexToRowCol(index) {
    const row = Math.floor(index / 9) + 1;
    const column = (index % 9) + 1;
    return [row, column];
  }

  // 显示未保存提示，填充提示文本
  _showUnsavePrompt(idx) {
    const [row, column] = this._indexToRowCol(idx);
    this.#_unsaveTextEl.textContent = tr('unsave_text', { slot: idx + 1, row, column });
    this.#_unsaveCard.setAttribute('visible', '');
  }

  // 应用选中并展开编辑区
  _applySelection(index, row, column) {
    // 取消之前选中样式
    this._clearSelectedStyle();
    this.#_selectedIndex = index;
    // 设置选中样式（直接操作 chest shadow slots）
    try {
      const slotEl = this.#_chestEl.shadowRoot?.querySelector(`.slot[data-index="${index}"]`);
      if (slotEl) {
        slotEl.style.transition = 'box-shadow 0.2s ease, transform 0.2s ease';
        slotEl.style.boxShadow = '0 0 0 3px rgba(63,138,255,0.55)';
        slotEl.style.transform = 'translateY(-2px)';
      }
    } catch (e) {}

    // Fill edit area with current button data if exists
    const key = `${String(row)}${String(column)}`;
    const btn = (this.#_data && this.#_data.java && this.#_data.java.get) ? this.#_data.java.get(key) : null;
    // 标题显示
    const titleKey = i18n.has && i18n.has(`editor.jmenu.title_edit`) ? 'title_edit' : 'title_hover';
    this.#_slotTitleEl.textContent = tr(titleKey, { slot: index + 1, row, column });
    // 显示编辑区
    this.#_editBody.setAttribute('visible', '');

    if (btn) {
      // permission
      const permVal = btn.permission || '';
      this.#_permField.setAttribute('value', permVal);
      // update toggle icon
      const iconSvg = (btn.permission_when_and_have) ? SVG_ICONS.fullscreen : SVG_ICONS.fullscreen_exit;
      if (this.#_permToggleIcon) this.#_permToggleIcon.innerHTML = iconSvg;
      // show/hide remove button
      if (permVal && permVal.length > 0) this.#_permRemoveBtn.style.display = '';
      else this.#_permRemoveBtn.style.display = 'none';
      // action type
      this.#_picker.setAttribute('value', btn.action_type || 'none');
      // param
      this.#_paramField.setAttribute('value', btn.action_param || '');
    } else {
      this.#_permField.setAttribute('value', '');
      if (this.#_permToggleIcon) this.#_permToggleIcon.innerHTML = SVG_ICONS.fullscreen;
      this.#_permRemoveBtn.style.display = 'none';
      this.#_picker.setAttribute('value', 'none');
      this.#_paramField.setAttribute('value', '');
    }
    // mark unsaved false for now
    this.#_unsaved = false;
  }

  _clearSelectedStyle() {
    try {
      const prev = this.#_chestEl.shadowRoot?.querySelector('.slot[style*="box-shadow"]');
      if (prev) {
        prev.style.boxShadow = '';
        prev.style.transform = '';
      }
    } catch (e) {}
  }

  // 保存当前编辑到数据模型
  _saveCurrentEdit() {
    if (this.#_selectedIndex < 0) return;
    const [row, column] = this._indexToRowCol(this.#_selectedIndex);
    const key = `${String(row)}${String(column)}`;
    let btn = (this.#_data && this.#_data.java && this.#_data.java.get) ? this.#_data.java.get(key) : null;
    if (!btn) {
      // 创建一个最小占位按钮以保证数据存在
      // 这里仅用默认 MC 缺省图标
      btn = new JavaButton({ display: { id: 'missingno' } });
      this.#_data.java.set(key, btn);
    }
    const permVal = this.#_permField.getAttribute('value') || '';
    btn.permission = permVal;
    // toggled preview is stored only after save
    const pickerVal = this.#_picker.getAttribute('value') || 'none';
    btn.action_type = pickerVal;
    const paramVal = this.#_paramField.getAttribute('value') || '';
    btn.action_param = paramVal;

    // update chest display (in case id changed)
    const items = this.#_chestEl.items;
    items[this.#_selectedIndex] = btn.id || null;
    this.#_chestEl.setItems(items);

    this.#_unsaved = false;
    this.#_unsaveCard.removeAttribute('visible');
  }

  _togglePermPreview() {
    // 切换当前编辑中的权限显示（仅 UI 预览）
    const cur = this.#_permToggleIcon;
    if (!cur) return;
    const isHave = cur.innerHTML === SVG_ICONS.fullscreen;
    cur.innerHTML = isHave ? SVG_ICONS.fullscreen_exit : SVG_ICONS.fullscreen;
    this.#_unsaved = true;
  }

  // ═════════════════════════════════════════════
  //  辅助：构建 s-tooltip > s-icon-button > s-icon
  // ═════════════════════════════════════════════

  /**
   * @param {string} icon  icon name 或 SVG HTML
   * @param {string} tip   提示文字
   * @param {boolean} [raw=false] 是否作为原始 SVG
   * @param {"outlined"|"filled-tonal|"filled"|""|null} [type] 
   * @returns {HTMLElement} s-tooltip
   */
  _buildTipBtn(icon, tip, raw = false, type = "outlined") {
    const tipEl = document.createElement('s-tooltip');
    tipEl.setAttribute('align', 'bottom');
    const btn = document.createElement('s-icon-button');
    btn.setAttribute('slot', 'trigger');
    btn.setAttribute('type', type);
    const iconEl = document.createElement('s-icon');
    if (raw) iconEl.innerHTML = icon;
    else iconEl.setAttribute('name', icon);
    btn.appendChild(iconEl);
    tipEl.appendChild(btn);
    tipEl.appendChild(document.createTextNode(tip));
    return tipEl;
  }
}

customElements.define("jmenu-editor", JMElement);

// ───────────────────── 辅助函数 ─────────────────────

/** 创建元素 @returns {HTMLElement} */
function ce(t, c) { const e = document.createElement(t); if (c) e.className = c; return e; }
function tr(key, params = {}) { return i18n.parseSafe(`editor.jmenu.${key}`, params); }