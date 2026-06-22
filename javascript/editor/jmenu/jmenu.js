// 编辑器注册默认要求
import editorManager from "../../backend/editorManager.js";
import { Editor } from "../editor.js";
import { JavaButton, BedrockButton, JMenu } from "./dataDef.js";
import MCColors from "../../library/MCColors.js";
import i18n from "../../i18n.js";
import { HTMLmcItemDisplay } from "../../ui/customElements/HTMLmcItemDisplay.js";
import { ensureItem, getIndex, getRowColumn, HTMLmcChestDisplay } from "../../ui/customElements/HTMLmcChestDisplay.js";
import commandServer from "../../backend/commandServer.js";
import { Item, getItemFromMC } from "../../library/MCItemStack.js";
import utils from "../../ui/utils.js";
import mctext from "../../ui/panels/mctext.js";
import mcitem from "../../ui/panels/mcitem.js";

/** 编辑器ID */
const EditorId = "jmenu";
/** 动画防抖间隔 */
const delayedUpdateTimeout = 100;
/** 编辑器 ShadowDOM 样式 */
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
  transition: height 0.2s ease;
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
  flex-direction: column;
  gap: .9em;
  display: none;
  pointer-events: none;
}

.iteminfo-body[visible="true"] {
  display: flex;
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
/** 权限模式按钮状态图标 */
const SVG_ICONS = {
  having: `<svg viewBox="0 -960 960 960"><path d="M280-280v-400h400v400H280Zm80-80h240v-240H360v240Zm-240 80v-80h80v80h-80Zm0-320v-80h80v80h-80Zm160 480v-80h80v80h-80Zm0-640v-80h80v80h-80Zm320 640v-80h80v80h-80Zm0-640v-80h80v80h-80Zm160 480v-80h80v80h-80Zm0-320v-80h80v80h-80ZM480-480Z"/></svg>`,
  missing: `<svg viewBox="0 -960 960 960"><path d="M280-280v-400h400v400H280Zm-160 0v-80h80v80h-80Zm0-320v-80h80v80h-80Zm160 480v-80h80v80h-80Zm0-640v-80h80v80h-80Zm320 640v-80h80v80h-80Zm0-640v-80h80v80h-80Zm160 480v-80h80v80h-80Zm0-320v-80h80v80h-80Z"/></svg>`,
};

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

// ───────────────────── JMElement ─────────────────────

export class JMElement extends HTMLElement {
  /** Menu Data @type {JMenu|null} */ #_data;
  
  // DOM refs
  /** java: save btn @type {HTMLElement} */ #_saveBtn;
  /** java: item edit btn @type {HTMLElement} */ #_editItemBtn;
  /** actionbar: title @type {HTMLElement} */ #_titleEl; 
  /** actionbar: title rename btn @type {HTMLElement} */ #_renameTitleBtn; 
  /** actionbar: java2bedrock @type {HTMLElement} */ #_java2bedrockBtn; 
  /** actionbar: bedrock2java @type {HTMLElement} */ #_bedrock2javaBtn; 
  /** java: mc-chest-display @type {HTMLmcChestDisplay} */ #_chestEl;
  /** java: s-card.iteminfo-root @type {HTMLElement} */ #_editArea;
  /** java: .iteminfo-body @type {HTMLElement} */ #_editBody;
  /** java: h2 in edit area @type {HTMLElement} */ #_slotTitleEl;
  /** java: s-card.iteminfo-unsave @type {HTMLElement} */ #_unsaveCard;
  /** java: unsave text div @type {HTMLElement} */ #_unsaveTextEl;
  /** java: unsave dismiss btn @type {HTMLElement} */ #_unsaveDismissBtn;
  /** java: unsave cancel btn @type {HTMLElement} */ #_unsaveCancelBtn;
  /** java: unsave save btn @type {HTMLElement} */ #_unsaveSaveBtn;
  /** pending switch target */ #_pendingSwitch = null;
  /** java: float-tips for perm @type {HTMLElement} */ #_permToggleTip;
  /** java: s-text-field for perm @type {HTMLElement} */ #_permField;
  /** java: s-icon-button for perm mode toggle @type {HTMLElement} */ #_permToggleBtn;
  /** java: s-icon inside perm mode toggle @type {HTMLElement} */ #_permToggleIcon;
  /** java: s-icon-button for remove @type {HTMLElement} */ #_permRemoveBtn;
  /** java: s-picker for action type @type {HTMLElement} */ #_actionPicker;
  /** java: s-text-field for param @type {HTMLElement} */ #_paramField;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._buildShadowDOM();
    this._bindEvents_actionbar();
    this._bindEvents_java();
  }

  // ═════════════════════════════════════════════
  //  公共接口
  // ═════════════════════════════════════════════

  /** @param {JMenu} data */
  setData(data) {
    if (!(data instanceof JMenu)) throw new Error("Unrecognized Data Type: " + data);
    this.#_data = data;
    // 更新 UI：菜单标题、箱子名称与行数、以及格子物品
    // actionbar title must be plain text (remove formatting codes)
    this.#_titleEl.textContent = MCColors.remove(this.#_data.title || "");
    this.#_titleEl.title = MCColors.strip(this.#_data.title || "");
    // chest: set name and line count
    this.#_chestEl.name = MCColors.parse(this.#_data.title || "");
    this.#_chestEl.line = this.#_data.lines || 3;

    // prepare items array (54 slots)
    if (this.#_data.java instanceof Map) {
      for (const [slot, btn] of this.#_data.java.entries()) {
        if (!slot || slot.length < 2) continue;
        const line = parseInt(slot[0]);
        const column = parseInt(slot[1]);
        if (Number.isNaN(line) || Number.isNaN(column)) continue;
        const index = (line - 1) * 9 + (column - 1);
        if (index >= 0 && index < 54) {
          // 物品有效，提交渲染
          this._commitJavaBtnUpdate(index, JavaButton2Item(btn), btn);
        }
      }
    }
    // reset UI state
    this._commitJavaTitle(tr('title_idle'), 'set');
    this.#_editBody.removeAttribute('visible');
    this.#_unsaveCard.removeAttribute('visible');
    // 清除高亮
    try { this.#_chestEl.highlightIndex = -1; } catch (_) {}
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
    [this.#_renameTitleBtn, this.#_java2bedrockBtn, this.#_bedrock2javaBtn,] = [
      this._buildTipBtn(
        '<svg viewBox="0 -960 960 960"><path d="m490-527 37 37 217-217-37-37-217 217ZM200-200h37l233-233-37-37-233 233v37Zm355-205L405-555l167-167-29-29-219 219-56-56 218-219q24-24 56.5-24t56.5 24l29 29 50-50q12-12 28.5-12t28.5 12l93 93q12 12 12 28.5T828-678L555-405ZM270-120H120v-150l285-285 150 150-285 285Z"></path></svg>',
        tr('rename_title'), true
      ),
      this._buildTipBtn('arrow_forward', tr('sync_java_to_bedrock')),
      this._buildTipBtn('arrow_back', tr('sync_bedrock_to_java')),
    ]
    actionbar.appendChild(this.#_renameTitleBtn);
    actionbar.appendChild(this.#_java2bedrockBtn);
    actionbar.appendChild(this.#_bedrock2javaBtn);

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

    // Java标题—— 始终可见
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
    this.#_unsaveDismissBtn = dismissBtn;

    const saveUnsBtn = document.createElement('s-button');
    saveUnsBtn.setAttribute('slot', 'action');
    saveUnsBtn.setAttribute('type', 'filled-tonal');
    saveUnsBtn.textContent = i18n.parse('tooltip.save');
    unsaveCard.appendChild(saveUnsBtn);
    this.#_unsaveSaveBtn = saveUnsBtn;

    const cancelBtn = document.createElement('s-button');
    cancelBtn.setAttribute('slot', 'action');
    cancelBtn.setAttribute('type', 'filled-tonal');
    cancelBtn.textContent = i18n.parse('tooltip.cancel');
    unsaveCard.appendChild(cancelBtn);
    this.#_unsaveCancelBtn = cancelBtn;

    // ── Save ──
    const saveBtn = document.createElement('s-button');
    saveBtn.style.display = 'flex';
    saveBtn.setAttribute('type', 'filled-tonal');
    saveBtn.textContent = i18n.parse('tooltip.save');
    editBody.appendChild(saveBtn);
    this.#_saveBtn = saveBtn;

    // ── Edit item ──
    const editItemBtn = document.createElement('s-button');
    editItemBtn.style.display = 'flex';
    editItemBtn.setAttribute('type', 'filled-tonal');
    editItemBtn.textContent = tr('edit_item');
    editBody.appendChild(editItemBtn);
    this.#_editItemBtn = editItemBtn;

    // ── Permission field ──
    const permField = document.createElement('s-text-field');
    permField.style.display = 'grid';
    permField.style.width = 'auto';
    permField.setAttribute('label', tr('permission_label'));
    editBody.appendChild(permField);
    this.#_permField = permField;

    // 权限切换按钮
    const permTip = ce("span", "");
    const permTipRoot = this._buildTipBtn(SVG_ICONS.fullscreen, "", false, "");
    permTipRoot.setAttribute('slot', 'end');
    permField.appendChild(permTipRoot);
    permTipRoot.appendChild(permTip);
    this.#_permToggleTip = permTip;
    this.#_permToggleBtn = permTipRoot.querySelector('s-icon-button');
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
    this.#_actionPicker = picker;

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

  /** 挂载 ACTIONBAR 事件 */
  _bindEvents_actionbar() {
    // 修改 MenuTitle
    this.#_renameTitleBtn.addEventListener('click', () => {
      try {
        const where = this;
        mctext.edit(this.#_data.title).then(([result, newText]) => {
          if (result) this.#_data.title = newText;
          where._scheduleRender();
        });
      } catch (error) {
        console.error("Failed to rename the menu", this.#_data, " as ", error);
      }
    });
  }

  /** 挂载 Java区域 事件 */
  _bindEvents_java() {
    // hover 移动
    this.#_chestEl.addEventListener('itemHover', (e) => {
      const { row, column, item, index, action } = e.detail;
      if (action === 'enter') {
        // enter
        this._commitJavaTitle(tr("title_hover", { slot: index + 1, column: column, row: row }), 'temp');
      } else {
        // leave
        this._commitJavaTitle(null, 'reset');
      }
    });
    
    // click 点击事件
    this.#_chestEl.addEventListener('itemClick', (e) => {
      const { row, column, /* 注意此处item的tooltip已经被污染了 */item, index } = e.detail;
      // 若没有正在编辑或编辑的是同一格，则直接开始/切换
      if (!this.#edittingJbutton || this.#edittingJslot === index) {
        this._startJavaBtnEdit(index, row, column, null);
        return;
      }
      // 有正在进行的编辑且目标不同，先判断是否有未保存的改动
      if (!this._isCurrentEditDirty()) {
        // 无改动，直接切换
        this._startJavaBtnEdit(index, row, column, null);
        return;
      }
      // 有未保存改动，弹出未保存提示
      this.#_pendingSwitch = { index, row, column, item };
      this.#_unsaveTextEl.innerHTML = i18n.parseSafe("editor.jmenu.unsave_text", { slot: this.#edittingJslot + 1, row: getRowColumn(this.#edittingJslot)[0], column: getRowColumn(this.#edittingJslot)[1] });
      this.#_unsaveCard.setAttribute('visible', 'true');
    });

    // save 保存按钮
    this.#_saveBtn.addEventListener('click', e => {
      this._doSaveEditting();
    });

    // unsave prompt actions
    this.#_unsaveDismissBtn.addEventListener('click', () => {
      // 舍弃当前编辑并切换到待处理的槽位
      this.#_unsaveCard.removeAttribute('visible');
      const pending = this.#_pendingSwitch;
      this.#_pendingSwitch = null;
      // 不保存当前编辑，直接切换
      this._startJavaBtnEdit(pending.index, pending.row, pending.column, null);
    });
    this.#_unsaveSaveBtn.addEventListener('click', async () => {
      // 先保存当前编辑，然后切换
      await this._doSaveEditting();
      this.#_unsaveCard.removeAttribute('visible');
      const pending = this.#_pendingSwitch;
      this.#_pendingSwitch = null;
      this._startJavaBtnEdit(pending.index, pending.row, pending.column, null);
    });
    this.#_unsaveCancelBtn.addEventListener('click', () => {
      // 取消切换，保留当前编辑
      this.#_unsaveCard.removeAttribute('visible');
      this.#_pendingSwitch = null;
    });

    // 编辑物品按钮
    this.#_editItemBtn.addEventListener('click', e => {
      try {
        const where = this;
        mcitem.edit(this.#edittingJitem).then(([result, newItem]) => {
          if (result) this.#edittingJitem = newItem;
          where._scheduleRender();
        });
      } catch (error) {
        console.error("Failed to edit the menu button item", this.#edittingJitem, " as ", error);
      }
    })
  }

  /** 进入DOM */
  connectedCallback() {
  }

  /** 退出DOM */
  disconnectedCallback() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  // ═════════════════════════════════════════════
  //  渲染API + rAF防抖
  // ═════════════════════════════════════════════

  #originJavaTitle = "";
  #pendingJavaTitle = "";
  #pendingJavaTitleTOid = null;
  /** 防抖渲染 JavaTitle @param {'temp'|'reset'|'set'} [mode] */
  _commitJavaTitle(text, mode = 'temp') {
    switch (mode) {
      case 'reset':
        this.#pendingJavaTitle = this.#originJavaTitle;
        break;
      case 'set':
        this.#pendingJavaTitle = text;
        this.#originJavaTitle = text;
        break;
      default:
        this.#pendingJavaTitle = text;
        break;
    }
    if (this.#pendingJavaTitleTOid) clearTimeout(this.#pendingJavaTitleTOid);
    this.#pendingJavaTitleTOid = setTimeout(() => {
      this._scheduleRender();
    }, delayedUpdateTimeout);
  }

  #javeBtnRenderQueue = [];
  #javeBtnRenderQueueTOid = null;
  /** 队列渲染JavaButton更新 (0-index) @param {Item} item @param {JavaButton} btn */
  _commitJavaBtnUpdate(index, item, btn) {
    if (!(btn instanceof JavaButton)) return;
    if (!(item instanceof Item)) return;
    index = parseInt(index);
    if (index < 0 || index >= 54) return;
    this.#javeBtnRenderQueue.push([index, /* rAF渲染时会ensure一遍，此处不重复调用 */item, btn]);
    if (this.#javeBtnRenderQueueTOid) clearTimeout(this.#javeBtnRenderQueueTOid);
    this.#javeBtnRenderQueueTOid = setTimeout(() => {
      this._scheduleRender();
    }, delayedUpdateTimeout);
  }

  /** 正在编辑的按钮 @type {JavaButton|null} */
  #edittingJbutton = null;
  /** 正在编辑的按钮序号 @type {int|null} */
  #edittingJslot = null;
  /** 正在编辑的按钮物品 @type {Item|null} */
  #edittingJitem = null;
  /** 立即渲染JavaButton编辑，无条件替换正在进行的编辑 @type {Item} item */
  _startJavaBtnEdit(index, row, column, item) {
    // 替换正在编辑的
    this.#edittingJbutton = this.#_data.java.get(`${row}${column}`);
    this.#edittingJitem = item;
    this.#edittingJslot = index;
    if (!this.#edittingJbutton) this.#edittingJbutton = new JavaButton({ display: { id: "apple" } });
    if (!this.#edittingJitem) this.#edittingJitem = JavaButton2Item(this.#edittingJbutton);
    // 载入信息
    this._commitJavaTitle(tr('title_edit', { slot: index + 1, column: column, row: row }), 'set');
    this.#_permField.value = this.#edittingJbutton.permission;
    this.#_actionPicker.value = this.#edittingJbutton.action_type;
    this.#_paramField.value = this.#edittingJbutton.action_param;
    this._putAndGetPermBool(!!this.#edittingJbutton.permission_when_and_have);
    // 显示这个元素
    this.#_editBody.setAttribute("visible", true);
    // 标记当前正在编辑的格子（突出显示）
    try { this.#_chestEl.highlightIndex = index; } catch (_) {}
  }

  _rafId = null;
  /** 请求渲染，在下个帧完成，自动合并防抖 */
  _scheduleRender() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); };
    this._rafId = requestAnimationFrame(() => {
      // 执行渲染
      this._rafId = null;
      // Menu Title
      const isMenuTitleChanged = this._renderReplacer(this.#_titleEl, 'textContent', MCColors.remove(this.#_data.title));
      if (isMenuTitleChanged) {
        this.#_chestEl.name = MCColors.parse(this.#_data.title);
      }
      // Java编辑面板 title
      this._renderReplacer(this.#_slotTitleEl, 'textContent', this.#pendingJavaTitle);
      // JavaChest
      this.#javeBtnRenderQueue.forEach(([index, item, btn]) => {
        if (!Array.isArray(item.ISC?.lore)) { item.ISC.lore = []; }
        const mirror = item.clone();
        mirror.ISC.lore.push(MCColors.parse(tr("attach_to_tooltip", { action: btn.action_type, param: btn.action_param })));
        this.#_chestEl.setItem(index, mirror);
      });
    })
  }

  /** 执行保存正在编辑的按钮（抽离以复用） */
  async _doSaveEditting() {
    if (this.#edittingJslot == null) return;
    try {
      // 构建 permission
      let permission = this.#_permField.value.replaceAll(/!/g, "");
      if (!this._putAndGetPermBool()) { permission = "!" + permission; };
      this.#edittingJbutton = Item2JavaButton(this.#edittingJitem, this.#_actionPicker.value, permission, this.#_paramField.value);
      this._commitJavaBtnUpdate(this.#edittingJslot, this.#edittingJitem, this.#edittingJbutton);
      // 同步回数据模型
      try {
        const [row, column] = getRowColumn(this.#edittingJslot);
        const key = `${row}${column}`;
        if (this.#_data && this.#_data.java instanceof Map) {
          this.#_data.java.set(key, this.#edittingJbutton);
        }
      } catch (err) { console.warn("Failed to sync edited button to JMenu data:", err); }
      // 调用保存命令
      try { commandServer.executeCommand("files.save"); } catch (e) { console.warn(e); }
      utils.msg(i18n.parseSafe("msg.savedTo", { path: `#${this.#edittingJslot + 1}` }), i18n.parseSafe("msg.done"), 'success');
    } catch (e) {
      console.warn("Failed to save editing button:", e);
    }
  }

  /** 判断当前编辑区是否有未保存的改动 */
  _isCurrentEditDirty() {
    if (this.#edittingJslot == null) return false;
    try {
      // 构建将在保存时生成的 JavaButton
      let permission = this.#_permField.value.replaceAll(/!/g, "");
      if (!this._putAndGetPermBool()) { permission = "!" + permission; };
      const candidate = Item2JavaButton(this.#edittingJitem, this.#_actionPicker.value, permission, this.#_paramField.value);
      const original = this.#edittingJbutton;
      if (!original) return true;
      // 对比关键字段
      const fieldsEqual = (
        candidate.id === original.id &&
        candidate.number === original.number &&
        !!candidate.enchant_glint_override === !!original.enchant_glint_override &&
        candidate.action_type === original.action_type &&
        (candidate.action_param || "") === (original.action_param || "") &&
        (candidate.permission || "") === (original.permission || "") &&
        (candidate.permission_when_and_have === original.permission_when_and_have) &&
        Array.isArray(candidate.tooltip) && Array.isArray(original.tooltip) &&
        candidate.tooltip.length === original.tooltip.length &&
        candidate.tooltip.every((v, i) => v === original.tooltip[i])
      );
      return !fieldsEqual;
    } catch (e) {
      return true;
    }
  }

  /** 
   * 渲染辅助器：比较当前值和目标值，若不同则更新。
   * 会自动转换类型。
   * @param {HTMLElement} el - 要操作的目标元素
   * @param {string} targetProp - 要设置的属性名（如 'innerText'）
   * @param {string} targetValue - 目标值
   * @returns {boolean} 是否替换了
   */
  _renderReplacer(el, targetProp, targetValue) {
    const currentValue = el[targetProp];
    if (currentValue != targetValue) {
      el[targetProp] = targetValue;
      return true;
    }
    return false;
  }

  // ═════════════════════════════════════════════
  //  辅助
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

  #javaPermStatus = true;
  /**
   * 设置/获取权限切换按钮的状态
   * @param {null|boolean} status 严格布尔则设置，否则仅获取
   * @returns （设置完成后）当前状态
   */
  _putAndGetPermBool(status) {
    if (status === true) {
      this.#javaPermStatus = true;
      this.#_permToggleTip.innerHTML = tr("permission_have");
      this.#_permToggleIcon.innerHTML = SVG_ICONS.having;
      return true;
    } else if (status === false) {
      this.#javaPermStatus = false;
      this.#_permToggleTip.innerHTML = tr("permission_miss");
      this.#_permToggleIcon.innerHTML = SVG_ICONS.missing;
      return false;
    } else {
      return this.#javaPermStatus;
    }
  }
}

customElements.define("jmenu-editor", JMElement);

// ───────────────────── 辅助函数 ─────────────────────

/** 创建元素 @returns {HTMLElement} */
function ce(t, c) { const e = document.createElement(t); if (c) e.className = c; return e; }
/** 获取基于本编辑器节点的翻译键，其他节点请使用正常方法 */
function tr(key, params = {}) { return i18n.parseSafe(`editor.jmenu.${key}`, params); }
/**
 * 将按钮转换为物品
 * @param {JavaButton} btn 源JAVA按钮
 * @returns {Item} 
 */
export function JavaButton2Item(btn) {
  if (!(btn instanceof JavaButton)) return;
  if (btn.tooltip.length == 0) btn.tooltip.push("");
  if (btn.tooltip.length > 1) {
    const lores = btn.tooltip.slice(1, -1);
    return new Item(btn.id, btn.number, {
      enchantment_glint_override: !!btn.enchant_glint_override,
      item_name: btn.tooltip[0],
      lore: lores,
    });
  } else {
    return new Item(btn.id, btn.number, {
      enchantment_glint_override: !!btn.enchant_glint_override,
      item_name: btn.tooltip[0],
    });
  }
}
/**
 * 将物品转换为按钮
 * @param {Item} btn 物品
 * @param {string} [action="none"] 
 * @param {string} [param=""] 
 * @param {string} [perm=""] 
 * @returns {JavaButton} 按钮
 */
export function Item2JavaButton(btn, action = "none", perm = "", param = "") {
  let tooltips = [(btn.ISC?.item_name || "")];
  tooltips.push(...(btn.ISC?.lore || []));
  return new JavaButton({
    display: {
      id: btn.id || "missingno",
      enchant: btn?.ISC?.enchantment_glint_override || false,
      tooltip: tooltips,
    },
    action: (action || "none"),
    perm: (perm || ""),
    param: (param || "")
  });
}
