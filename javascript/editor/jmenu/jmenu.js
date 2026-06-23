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
  padding-bottom: unset;
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

.iteminfo-unsave s-button {
  margin: 0 0 .5em 1em;
}

/* BEDROCK-AREA */
.bedrock {
  display: flex;
  flex-direction: column;
  gap: .5em;
  padding: 1em;
  grid-row-start: 2;
}

.bedrock-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .5em;
  padding: 0 .2em;
}

.bedrock-header h2 {
  flex: 1;
  margin: 0;
  font-size: 1.1em;
  font-weight: 600;
}

.bedrock-list {
  display: flex;
  flex-direction: column;
  gap: .5em;
}

.bedrock-card {
  cursor: pointer;
}
.bedrock-card:hover {
  filter: brightness(1.05);
}

.bedrock-card-actions {
  display: flex;
  flex-direction: row;
  gap: .3em;
  margin-left: auto;
}
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
}, EditorJmenu, () => {
  // 返回一个空 JMenu 的 JSON 字符串
  return JSON.stringify({
    jme: "menu",
    jmev: 1,
    title: "",
    lines: 3,
    "java-buttons": {},
    "bedrock-buttons": []
  }, null, 2);
});

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
  /** java: expand chest size @type {HTMLElement} */ #_expandBtn;
  /** java: shrink chest size @type {HTMLElement} */ #_shrinkBtn;
  /** java: s-text-field for param @type {HTMLElement} */ #_paramField;
  /** java: reset btn for param @type {HTMLElement} */ #_paramClearBtn;
  /** java: delete btn @type {HTMLElement} */ #_javaDeleteBtn;
  /** bedrock: root container @type {HTMLElement} */ #_bedrockRoot;
  /** bedrock: list container @type {HTMLElement} */ #_bedrockList;
  /** bedrock: add button @type {HTMLElement} */ #_bedrockAddBtn;
  /** bedrock render queue @type {Array<[number, BedrockButton]>} */ #_bedrockRenderQueue = [];
  /** bedrock render queue timeout @type {number|null} */ #_bedrockRenderQueueTOid = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._buildShadowDOM();
    this._bindEvents_actionbar();
    this._bindEvents_java();
    this._bindEvents_bedrock();
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

    // prepare bedrock buttons
    if (Array.isArray(this.#_data.bedrock)) {
      for (let i = 0; i < this.#_data.bedrock.length; i++) {
        const btn = this.#_data.bedrock[i];
        if (btn instanceof BedrockButton) {
          this._commitBedrockUpdate(i, btn);
        }
      }
    }
    // reset UI state
    this._commitJavaTitle(tr('title_idle'), 'set');
    this.#_editBody.removeAttribute('visible');
    this.#_unsaveCard.removeAttribute('visible');
    // 清除高亮
    try { this.#_chestEl.highlightIndex = -1; } catch (_) {}
    // 清空基岩版渲染队列
    this.#_bedrockRenderQueue = [];
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
    // dismissBtn.setAttribute('slot', 'action');
    dismissBtn.style.backgroundColor = 'var(--s-color-error-container,#FFDAD6)';
    dismissBtn.setAttribute('type', 'filled-tonal');
    dismissBtn.textContent = tr('dismiss');
    unsaveCard.appendChild(dismissBtn);
    this.#_unsaveDismissBtn = dismissBtn;

    const saveUnsBtn = document.createElement('s-button');
    // saveUnsBtn.setAttribute('slot', 'action');
    saveUnsBtn.setAttribute('type', 'filled-tonal');
    saveUnsBtn.textContent = i18n.parse('tooltip.save');
    unsaveCard.appendChild(saveUnsBtn);
    this.#_unsaveSaveBtn = saveUnsBtn;

    const cancelBtn = document.createElement('s-button');
    // cancelBtn.setAttribute('slot', 'action');
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

    // ── Delete (Java) ──
    const deleteBtn = document.createElement('s-button');
    deleteBtn.style.display = 'flex';
    deleteBtn.setAttribute('type', 'filled-tonal');
    deleteBtn.style.backgroundColor = 'var(--s-color-error-container,#FFDAD6)';
    deleteBtn.textContent = tr('java_delete');
    editBody.appendChild(deleteBtn);
    this.#_javaDeleteBtn = deleteBtn;

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
    this.#_paramClearBtn = resetTip.querySelector('s-icon-button');

    // ── Chest Controller ──
    const expandBtn = document.createElement('s-button');
    expandBtn.setAttribute('slot', 'action');
    expandBtn.setAttribute('type', 'filled-tonal');
    expandBtn.textContent = tr('expand_chest');
    editArea.appendChild(expandBtn);
    this.#_expandBtn = expandBtn;

    const shrinkBtn = document.createElement('s-button');
    shrinkBtn.setAttribute('slot', 'action');
    shrinkBtn.setAttribute('type', 'filled-tonal');
    shrinkBtn.textContent = tr('shrink_chest');
    editArea.appendChild(shrinkBtn);
    this.#_shrinkBtn = shrinkBtn;
    
    // ─── Bedrock 区域 ───────────────────────────
    const bedrockRoot = ce('div', 'bedrock');
    root.appendChild(bedrockRoot);
    this.#_bedrockRoot = bedrockRoot;

    // 头部：标题 + 添加按钮
    const bedrockHeader = ce('div', 'bedrock-header');
    bedrockRoot.appendChild(bedrockHeader);
    const bedrockTitle = document.createElement('h2');
    bedrockTitle.textContent = tr('bedrock_title');
    bedrockHeader.appendChild(bedrockTitle);
    const addBtn = document.createElement('s-button');
    addBtn.setAttribute('type', 'filled-tonal');
    addBtn.textContent = tr('bedrock_add');
    bedrockHeader.appendChild(addBtn);
    this.#_bedrockAddBtn = addBtn;

    // 按钮列表容器
    const bedrockList = ce('div', 'bedrock-list');
    bedrockRoot.appendChild(bedrockList);
    this.#_bedrockList = bedrockList;
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

    // Java → Bedrock 同步（按顺序映射）
    this.#_java2bedrockBtn.addEventListener('click', async () => {
      try {
        await utils.askfor(
          i18n.parseSafe('tooltip.tip'),
          tr('sync_java_to_bedrock_confirm'),
          i18n.parseSafe('tooltip.confirm'),
          i18n.parseSafe('tooltip.cancel')
        );
      } catch (_) { return; }
      const javaArr = [];
      if (this.#_data.java instanceof Map) {
      if (this.#_data.java instanceof Map) {
        // 将 Map 按 key 排序后转为有序数组
        const sortedKeys = Array.from(this.#_data.java.keys()).sort((a, b) => {
          const [ar, ac] = [parseInt(a[0]), parseInt(a[1])];
          const [br, bc] = [parseInt(b[0]), parseInt(b[1])];
          return (ar - br) || (ac - bc);
        });
        for (const key of sortedKeys) {
          const btn = this.#_data.java.get(key);
          if (btn instanceof JavaButton) {
            javaArr.push(new BedrockButton({
              display: { text: btn.tooltip?.[0] || btn.id, icon: "" },
              perm: btn.permission ? (btn.permission_when_and_have ? "" : "!") + btn.permission : "",
              action: btn.action_type || "none",
              param: btn.action_param || ""
            }));
          }
        }
      }
      this.#_data.bedrock = javaArr;
      // 提交全部重渲染
      for (let i = 0; i < this.#_data.bedrock.length; i++) {
        this._commitBedrockUpdate(i, this.#_data.bedrock[i]);
      }
    });

    // Bedrock → Java 同步（按顺序映射到前 N 个格子）
    this.#_bedrock2javaBtn.addEventListener('click', async () => {
      if (!Array.isArray(this.#_data.bedrock)) return;
      try {
        await utils.askfor(
          i18n.parseSafe('tooltip.tip'),
          tr('sync_bedrock_to_java_confirm'),
          i18n.parseSafe('tooltip.confirm'),
          i18n.parseSafe('tooltip.cancel')
        );
      } catch (_) { return; }
      this.#_data.java.clear();
      const maxSlots = this.#_data.lines * 9;
      for (let i = 0; i < Math.min(this.#_data.bedrock.length, maxSlots); i++) {
        const btn = this.#_data.bedrock[i];
        if (!(btn instanceof BedrockButton)) continue;
        const row = Math.floor(i / 9) + 1;
        const col = (i % 9) + 1;
        const key = `${row}${col}`;
        const jBtn = new JavaButton({
          display: { id: "paper", tooltip: [btn.text || "", ""] },
          perm: btn.permission,
          action: btn.action_type || "none",
          param: btn.action_param || ""
        });
        this.#_data.java.set(key, jBtn);
        this._commitJavaBtnUpdate(i, JavaButton2Item(jBtn), jBtn);
      }
      this._scheduleRender();
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
      // 若当前编辑的物品 ID 为 air，则静默丢弃，不提示
      if (this.#edittingJitem && (this.#edittingJitem.id === 'minecraft:air' || this.#edittingJitem.getClearId() === 'air')) {
        this.#_unsaveCard.removeAttribute('visible');
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
    });

    // 删除按钮（Java 槽位）
    this.#_javaDeleteBtn.addEventListener('click', async () => {
      if (this.#edittingJslot == null) return;
      try {
        await utils.askfor(
          i18n.parseSafe('tooltip.tip'),
          tr('java_delete_confirm', { slot: this.#edittingJslot + 1 }),
          tr('java_delete'),
          i18n.parseSafe('tooltip.cancel')
        );
      } catch (_) { return; }
      // 从数据中移除
      const key = `${getRowColumn(this.#edittingJslot)[0]}${getRowColumn(this.#edittingJslot)[1]}`;
      this.#_data.java.delete(key);
      // 从箱子中移除
      this.#_chestEl.setItem(this.#edittingJslot, null);
      // 重置编辑状态
      this.#edittingJbutton = null;
      this.#edittingJitem = null;
      this.#edittingJslot = null;
      this.#_editBody.removeAttribute('visible');
      this.#_unsaveCard.removeAttribute('visible');
      try { this.#_chestEl.highlightIndex = -1; } catch (_) {}
      this._commitJavaTitle(tr('title_idle'), 'set');
      // 触发保存
      try { commandServer.executeCommand("files.save"); } catch (e) { console.warn(e); }
    });

    // 箱子大小改变
    this.#_shrinkBtn.addEventListener('click', () => {
      if (this.#_data.lines <= 1) return;
      this.#_data.lines--;
      this._scheduleRender();
    });
    this.#_expandBtn.addEventListener('click', () => {
      if (this.#_data.lines >= 6) return;
      this.#_data.lines++;
      this._scheduleRender();
    });

    // 权限模式反转
    this.#_permToggleBtn.addEventListener('click', () => { this._putAndGetPermBool(!this._putAndGetPermBool()); })
    
    // 权限输入框：自动过滤 ! 字符，若开头有 ! 则自动去除并反转模式
    this.#_permField.addEventListener('input', () => {
      const raw = this.#_permField.value;
      if (raw.startsWith('!')) {
        // 去掉开头的 ! 并反转权限模式
        this.#_permField.value = raw.replace(/^!+/, '');
        this._putAndGetPermBool(!this._putAndGetPermBool());
      }
      // 移除所有剩余的 ! 字符（防止粘贴或输入多个）
      if (this.#_permField.value.includes('!')) {
        this.#_permField.value = this.#_permField.value.replace(/!/g, '');
      }
    });

    // 清空按钮
    this.#_permRemoveBtn.addEventListener('click', () => {
      this.#_permField.value = "";
      this._putAndGetPermBool(true);
    });
    this.#_paramClearBtn.addEventListener('click', () => {
      this.#_paramField.value = "";
    })
  }

  // ═════════════════════════════════════════════
  //  基岩版事件绑定
  // ═════════════════════════════════════════════

  _bindEvents_bedrock() {
    // 添加新按钮（Alt＋点击→末尾，Shift＋点击→中间，普通→末尾并打开编辑）
    this.#_bedrockAddBtn.addEventListener('click', (e) => {
      const btn = new BedrockButton({
        display: { text: "新按钮", icon: "" },
        perm: "",
        action: "none",
        param: ""
      });
      const total = this.#_data.bedrock.length;
      let insertIndex;
      if (e.altKey) {
        // Alt：末尾
        insertIndex = total;
        this.#_data.bedrock.push(btn);
      } else if (e.shiftKey) {
        // Shift：正中间
        insertIndex = Math.floor(total / 2);
        this.#_data.bedrock.splice(insertIndex, 0, btn);
      } else {
        // 普通：末尾并打开编辑框
        insertIndex = total;
        this.#_data.bedrock.push(btn);
      }
      this._commitBedrockUpdate(insertIndex, btn);
      // 非 Alt 模式自动打开编辑框
      if (!e.altKey) {
        // 等待一帧让渲染完成
        requestAnimationFrame(() => { this._openBedrockEditDialog(insertIndex); });
      }
    });

    // 卡片操作按钮事件委托
    this.#_bedrockList.addEventListener('click', (e) => {
      const card = e.target.closest('.bedrock-card');
      if (!card) return;
      const index = parseInt(card.dataset.index);
      if (Number.isNaN(index) || !this.#_data?.bedrock?.[index]) return;

      // 判断点击的目标
      const target = e.target.closest('s-icon-button');
      if (!target) return;
      const action = target.dataset.bedrockAction;
      if (!action) return;

      switch (action) {
        case 'edit':
          this._openBedrockEditDialog(index);
          break;
        case 'up':
          this._moveBedrockButton(index, -1, e);
          break;
        case 'down':
          this._moveBedrockButton(index, 1, e);
          break;
      }
    });
  }

  /**
   * 移动基岩版按钮
   * @param {number} fromIndex 当前索引
   * @param {number} direction -1 上移, 1 下移
   * @param {MouseEvent} e 原始事件
   */
  _moveBedrockButton(fromIndex, direction, e) {
    const total = this.#_data.bedrock.length;
    if (total <= 1) return;
    let toIndex;
    if (e.altKey) {
      // Alt：移动到最顶端/最底端
      toIndex = direction < 0 ? 0 : total - 1;
    } else if (e.shiftKey) {
      // Shift：移动按钮总长度的 1/8（向上取整）
      const step = Math.ceil(total / 8);
      toIndex = fromIndex + direction * step;
    } else {
      // 普通：移动 1 格
      toIndex = fromIndex + direction;
    }
    // 钳制范围
    toIndex = Math.max(0, Math.min(total - 1, toIndex));
    if (toIndex === fromIndex) return;

    // 执行移动
    const [item] = this.#_data.bedrock.splice(fromIndex, 1);
    this.#_data.bedrock.splice(toIndex, 0, item);
    // 全量重渲染
    this._scheduleRender();
  }

  // ═════════════════════════════════════════════
  //  基岩版编辑对话框
  // ═════════════════════════════════════════════

  /**
   * 打开基岩版按钮编辑对话框
   * @param {number} index 按钮索引
   */
  _openBedrockEditDialog(index) {
    const btn = this.#_data.bedrock[index];
    if (!btn) return;

    // 构建对话框内容
    const dialog = document.createElement('s-dialog');
    dialog.setAttribute('showed', 'true');

    const headline = document.createElement('div');
    headline.setAttribute('slot', 'headline');
    headline.textContent = tr('bedrock_edit_title', { index: index + 1 });
    dialog.appendChild(headline);

    const textSlot = document.createElement('div');
    textSlot.setAttribute('slot', 'text');
    textSlot.style.display = 'flex';
    textSlot.style.flexDirection = 'column';
    textSlot.style.gap = '.8em';
    dialog.appendChild(textSlot);

    // 文本输入
    const textField = document.createElement('s-text-field');
    textField.setAttribute('label', tr('bedrock_text_label'));
    textField.value = btn.text || '';
    textSlot.appendChild(textField);

    // 图标输入
    const iconField = document.createElement('s-text-field');
    iconField.setAttribute('label', tr('bedrock_icon_label'));
    iconField.value = btn.icon || '';
    textSlot.appendChild(iconField);

    // 权限输入（带模式切换按钮，参考 Java 版）
    const permField = document.createElement('s-text-field');
    permField.setAttribute('label', tr('permission_label'));
    permField.value = (btn.permission || '').replace(/^!/, '');
    textSlot.appendChild(permField);

    let permMode = !btn.permission.startsWith('!') && btn.permission_when_and_have !== false;
    const permToggleIcon = document.createElement('s-icon');
    permToggleIcon.innerHTML = permMode ? SVG_ICONS.having : SVG_ICONS.missing;
    const permToggleBtn = document.createElement('s-icon-button');
    permToggleBtn.setAttribute('slot', 'end');
    permToggleBtn.setAttribute('type', 'text');
    permToggleBtn.appendChild(permToggleIcon);
    permToggleBtn.addEventListener('click', () => {
      permMode = !permMode;
      permToggleIcon.innerHTML = permMode ? SVG_ICONS.having : SVG_ICONS.missing;
    });
    permField.appendChild(permToggleBtn);

    // 动作类型选择器
    const actionPicker = document.createElement('s-picker');
    actionPicker.setAttribute('label', tr('action_type'));
    actionPicker.setAttribute('value', btn.action_type || 'none');
    const types = [
      ['menu', 'action_type_menu'], ['cmd', 'action_type_cmd'],
      ['op', 'action_type_op'], ['con', 'action_type_con'],
      ['url', 'action_type_url'], ['none', 'action_type_none'],
    ];
    for (const [val, key] of types) {
      const item = document.createElement('s-picker-item');
      item.setAttribute('value', val);
      item.textContent = tr(key);
      actionPicker.appendChild(item);
    }
    textSlot.appendChild(actionPicker);

    // 参数输入
    const paramField = document.createElement('s-text-field');
    paramField.setAttribute('label', tr('action_param'));
    paramField.value = btn.action_param || '';
    textSlot.appendChild(paramField);

    // 删除按钮（危险操作，需确认）
    const deleteBtn = document.createElement('s-button');
    deleteBtn.setAttribute('type', 'filled-tonal');
    deleteBtn.style.backgroundColor = 'var(--s-color-error-container,#FFDAD6)';
    deleteBtn.textContent = tr('bedrock_delete');
    deleteBtn.addEventListener('click', async () => {
      try {
        await utils.askfor(
          i18n.parseSafe('tooltip.tip'),
          tr('bedrock_delete_confirm', { index: index + 1 }),
          tr('bedrock_delete'),
          i18n.parseSafe('tooltip.cancel')
        );
        // 确认后执行删除
        this.#_data.bedrock.splice(index, 1);
        dialog.removeAttribute('showed');
        this._scheduleRender();
      } catch (_) { /* 用户取消，什么也不做 */ }
    });
    textSlot.appendChild(deleteBtn);

    // 操作按钮
    const cancelBtn = document.createElement('s-button');
    cancelBtn.setAttribute('slot', 'action');
    cancelBtn.setAttribute('type', 'text');
    cancelBtn.textContent = i18n.parse('tooltip.cancel');
    cancelBtn.addEventListener('click', () => { dialog.removeAttribute('showed'); });
    dialog.appendChild(cancelBtn);

    const saveBtn = document.createElement('s-button');
    saveBtn.setAttribute('slot', 'action');
    saveBtn.setAttribute('type', 'text');
    saveBtn.textContent = i18n.parse('tooltip.save');
    saveBtn.addEventListener('click', () => {
      // 保存修改
      const rawPerm = permField.value.replace(/!/g, '');
      btn.text = textField.value || '?';
      btn.icon = iconField.value || '';
      btn.permission = permMode ? rawPerm : '!' + rawPerm;
      btn.action_type = actionPicker.value;
      btn.action_param = paramField.value || '';
      this._commitBedrockUpdate(index, btn);
      dialog.removeAttribute('showed');
    });
    dialog.appendChild(saveBtn);

    // 挂载到 body
    document.body.appendChild(dialog);

    // 监听关闭事件，移除 DOM
    dialog.addEventListener('closed', () => {
      if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
    });
  }

  /** 队列渲染BedrockButton更新 */
  _commitBedrockUpdate(index, btn) {
    if (!(btn instanceof BedrockButton)) return;
    index = parseInt(index);
    if (Number.isNaN(index) || index < 0) return;
    // 去重：移除同一 index 的待处理项
    this.#_bedrockRenderQueue = this.#_bedrockRenderQueue.filter(([i]) => i !== index);
    this.#_bedrockRenderQueue.push([index, btn]);
    if (this.#_bedrockRenderQueueTOid) clearTimeout(this.#_bedrockRenderQueueTOid);
    this.#_bedrockRenderQueueTOid = setTimeout(() => {
      this._scheduleRender();
    }, delayedUpdateTimeout);
  }

  /** 进入DOM */
  connectedCallback() {
  }

  /** 退出DOM */
  disconnectedCallback() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this.#_bedrockRenderQueueTOid) clearTimeout(this.#_bedrockRenderQueueTOid);
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
    if (!this.#edittingJbutton) {
      // 空槽位：默认使用 air 作为物品 ID
      this.#edittingJbutton = new JavaButton({ display: { id: "air" } });
    }
    if (!this.#edittingJitem) {
      this.#edittingJitem = JavaButton2Item(this.#edittingJbutton);
    }
    // 载入信息
    this._commitJavaTitle(tr('title_edit', { slot: index + 1, column: column, row: row }), 'set');
    // 权限节点：去除 ! 前缀后再显示（! 用于标记权限模式，不存入输入框）
    this.#_permField.value = (this.#edittingJbutton.permission || '').replace(/^!/, '');
    this.#_actionPicker.value = this.#edittingJbutton.action_type;
    this.#_paramField.value = this.#edittingJbutton.action_param;
    // 权限模式：若原数据以 ! 开头，表示「无权限时可见」
    const rawPerm = this.#edittingJbutton.permission || '';
    const permMode = rawPerm.startsWith('!') ? !this.#edittingJbutton.permission_when_and_have : !!this.#edittingJbutton.permission_when_and_have;
    this._putAndGetPermBool(permMode);
    // 显示这个元素
    this.#_editBody.setAttribute("visible", true);
    // 标记当前正在编辑的格子（突出显示）
    try { this.#_chestEl.highlightIndex = index; } catch (_) {}
    // 若物品为 air，自动模拟点击「编辑物品」按钮，引导用户选取真正的物品
    if (this.#edittingJitem && (this.#edittingJitem.id === 'minecraft:air' || this.#edittingJitem.getClearId() === 'air')) {
      // 延迟一帧触发，确保 UI 已渲染完毕
      requestAnimationFrame(() => { this.#_editItemBtn.click(); });
    }
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
      
      // JavaChest 物品渲染
      this.#javeBtnRenderQueue.forEach(([index, item, btn]) => {
        if (!Array.isArray(item.ISC?.lore)) { item.ISC.lore = []; }
        // 构建镜像物品，并显示附加信息
        const mirror = item.clone();
        if (btn.permission) {
          // 有权限需求，就计算权限模式
          if (btn.permission_when_and_have) {
            mirror.ISC.lore.push(MCColors.parse(tr("attach_to_tooltip_p", { perm: btn.permission, action: btn.action_type, param: btn.action_param })));
          } else {
            mirror.ISC.lore.push(MCColors.parse(tr("attach_to_tooltip_np", { perm: btn.permission, action: btn.action_type, param: btn.action_param })));
          }
        } else {
          // 没有权限需求
          mirror.ISC.lore.push(MCColors.parse(tr("attach_to_tooltip", { action: btn.action_type, param: btn.action_param })));
        }
        // 附加并显示
        this.#_chestEl.setItem(index, mirror);
      });

      // JavaChest 行数渲染
      this.#_chestEl.line = this.#_data.lines;

      // ═══════ 基岩版按钮渲染 ═══════
      // 清空列表（但保留头部的添加按钮和标题）
      while (this.#_bedrockList.firstChild) {
        this.#_bedrockList.removeChild(this.#_bedrockList.firstChild);
      }

      // 处理渲染队列
      const processedIndexes = new Set();
      this.#_bedrockRenderQueue.forEach(([index, btn]) => {
        if (!(btn instanceof BedrockButton)) return;
        processedIndexes.add(index);
        this._renderBedrockCard(index, btn);
      });

      // 确保所有未在队列中的已有按钮也渲染
      if (Array.isArray(this.#_data?.bedrock)) {
        for (let i = 0; i < this.#_data.bedrock.length; i++) {
          if (!processedIndexes.has(i) && this.#_data.bedrock[i] instanceof BedrockButton) {
            this._renderBedrockCard(i, this.#_data.bedrock[i]);
          }
        }
      }

      // 清空队列
      this.#_bedrockRenderQueue = [];
    })
  }

  /**
   * 渲染单个基岩版按钮卡片
   * @param {number} index
   * @param {BedrockButton} btn
   */
  _renderBedrockCard(index, btn) {
    const card = document.createElement('s-card');
    card.className = 'bedrock-card';
    card.setAttribute('type', 'filled');
    card.dataset.index = index;

    // Headline: 按钮类型（文本|按钮→打开URL）
    const headline = document.createElement('div');
    headline.setAttribute('slot', 'headline');
    headline.textContent = tr('action_type_' + (btn.action_type || 'none'));
    card.appendChild(headline);

    // Subhead: 权限信息
    const subhead = document.createElement('div');
    subhead.setAttribute('slot', 'subhead');
    if (btn.permission) {
      subhead.textContent = btn.permission_when_and_have
        ? tr('bedrock_perm_have', { perm: btn.permission })
        : tr('bedrock_perm_miss', { perm: btn.permission });
    } else {
      subhead.textContent = tr('bedrock_perm_none');
    }
    card.appendChild(subhead);

    // Text: 渲染后的 display.text（支持 § 格式）
    const textEl = document.createElement('div');
    textEl.setAttribute('slot', 'text');
    textEl.innerHTML = MCColors.toHtml(MCColors.parse(btn.text || ''));
    card.appendChild(textEl);

    // Action slot: 三个操作按钮
    const actions = document.createElement('div');
    actions.setAttribute('slot', 'action');
    actions.className = 'bedrock-card-actions';

    // 上移
    const upBtn = document.createElement('s-icon-button');
    upBtn.setAttribute('type', 'text');
    upBtn.dataset.bedrockAction = 'up';
    upBtn.innerHTML = '<s-icon name="arrow_upward"></s-icon>';
    actions.appendChild(upBtn);

    // 下移
    const downBtn = document.createElement('s-icon-button');
    downBtn.setAttribute('type', 'text');
    downBtn.dataset.bedrockAction = 'down';
    downBtn.innerHTML = '<s-icon name="arrow_downward"></s-icon>';
    actions.appendChild(downBtn);

    // 编辑（SVG 铅笔图标）
    const editBtn = document.createElement('s-icon-button');
    editBtn.setAttribute('type', 'text');
    editBtn.dataset.bedrockAction = 'edit';
    editBtn.innerHTML = `<s-icon><svg viewBox="0 -960 960 960">
      <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"></path>
    </svg></s-icon>`;
    actions.appendChild(editBtn);

    card.appendChild(actions);

    this.#_bedrockList.appendChild(card);
  }

  /** 执行保存正在编辑的按钮（抽离以复用） */
  async _doSaveEditting() {
    if (this.#edittingJslot == null) return;
    try {
      // 构建 permission：输入框已过滤 !，只需根据权限模式添加前缀
      let permission = this.#_permField.value.replace(/!/g, "");
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
      // 构建将在保存时生成的 JavaButton（输入框已过滤 !）
      let permission = this.#_permField.value.replace(/!/g, "");
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
  let tooltips = [(btn.getDisplayName ? btn.getDisplayName() : (btn.ISC?.item_name || ""))];
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

//debug
commandServer.executeCommand("editor.open", `{
  "title": "&b主菜单",
  "lines": 3,
  "java-buttons": {
    "12": {
      "display": {
        "id": "apple",
        "enchant": false,
        "tooltip": [
          "&f第一个是按钮标题",
          "&f其它都是 Lore 行，且行首会自动添加 &r ，无需在此添加。"
        ]
      },
      "perm": "",
      "action": "menu",
      "param": "example"
    }
  },
  "bedrock-buttons": [
    {
      "display": {
        "text": "apple",
        "icon": "textures/ui/icon_recipe_nature.png"
      },
      "perm": "",
      "action": "menu",
      "param": "example"
    }
  ],
  "jme": "menu",
  "jmev": 1
}
  `);