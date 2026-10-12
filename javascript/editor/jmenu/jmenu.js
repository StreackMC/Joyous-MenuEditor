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
import JClipboard from "../../library/JClipboard.js";
import mctext from "../../ui/panels/mctext.js";
import mcitem from "../../ui/panels/mcitem.js";

/** 编辑器ID */
const EditorId = "jmenu";
/** 动画防抖间隔 */
const delayedUpdateTimeout = 100;
/** 编辑器 ShadowDOM 样式 */
const JMeleSTYLE = `
/* BASE */
.pixel {
  font-family: "mojangles", "unifont", sans-serif;
}
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
  grid-template-rows: calc(48px + var(--jm-actionbar-padding-y, 4px) + var(--jm-actionbar-padding-y, 4px)) auto 1fr;
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

/* 权限模拟横幅 */
.perm-sim-banner {
  grid-column: 1 / -1;
  grid-row-start: 2;
  width: calc(100% - var(--jm-actionbar-padding-x, min(5%, 16px)) - var(--jm-actionbar-padding-x, min(5%, 16px)));
  margin: 0 var(--jm-actionbar-padding-x, min(5%, 16px));
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: .5em;
  padding: .35em .8em;
  background: var(--s-color-warning-container, #ffe7ba);
  color: var(--s-color-on-warning-container, #4a3400);
  border-radius: .35em;
  font-size: .9em;
  z-index: 1;
}

.perm-sim-banner[hidden] {
  display: none;
}

.perm-sim-banner-text {
  flex: 1;
  min-width: 0;
}

/* 编辑对象（主按钮 / 回退按钮） */
.jm-else-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: .5em;
}

.jm-else-switch {
  flex: 1;
  min-width: 0;
}

.jm-else-hint {
  font-size: .85em;
  opacity: .8;
}

/* JAVA-AREA */
.java {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 1em;
  grid-row-start: 3;
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
  grid-row-start: 3;
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
  width: 100%;
}

.bedrock-card {
  max-width: none;
  width: 100%;
  margin: 0;
  box-sizing: border-box;
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

s-card div[slot="subhead"] {
  word-wrap: break-word;      /* 允许长单词换行 */
  word-break: break-all;      /* 允许任意字符换行（包括长字符串） */
  white-space: normal;        /* 默认值，允许换行（不是 nowrap） */
}
`;
/** 权限模式按钮状态图标 */
const SVG_ICONS = {
  having: `<svg viewBox="0 -960 960 960"><path d="M280-280v-400h400v400H280Zm80-80h240v-240H360v240Zm-240 80v-80h80v80h-80Zm0-320v-80h80v80h-80Zm160 480v-80h80v80h-80Zm0-640v-80h80v80h-80Zm320 640v-80h80v80h-80Zm0-640v-80h80v80h-80Zm160 480v-80h80v80h-80Zm0-320v-80h80v80h-80ZM480-480Z"/></svg>`,
  missing: `<svg viewBox="0 -960 960 960"><path d="M280-280v-400h400v400H280Zm-160 0v-80h80v80h-80Zm0-320v-80h80v80h-80Zm160 480v-80h80v80h-80Zm0-640v-80h80v80h-80Zm320 640v-80h80v80h-80Zm0-640v-80h80v80h-80Zm160 480v-80h80v80h-80Zm0-320v-80h80v80h-80Z"/></svg>`,
};

/** 「模拟权限」按钮图标 */
const SVG_PERM_SIM = `<svg viewBox="0 -960 960 960"><path d="M160-80v-240q0-33 23.5-56.5T240-400h480q33 0 56.5 23.5T800-320v240H160Zm80-160h480v-80H240v80Zm240-160L280-680q0-83 58.5-141.5T480-880q83 0 141.5 58.5T680-680L480-400Zm0-112 120-168q0-50-35-85t-85-35q-50 0-85 35t-35 85l120 168Zm0-144Z"></path></svg>`;

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
editorManager.regisiterEditor(EditorId, async (fileNode) => {
  let content;
  try {
    content = JSON.parse(await fileNode.read());
  } catch (error) {
    content = {};
  }
  // 仅表示是否接受该文件（返回 boolean）；标签页标题由文件名决定
  return content.jme === "menu";
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
  /** actionbar: switch perm status @type {HTMLElement} */ #_switchPermBtn; 
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
  /** java: copy btn @type {HTMLElement} */ #_javaCopyBtn;
  /** java: paste btn @type {HTMLElement} */ #_javaPasteBtn;
  /** bedrock: root container @type {HTMLElement} */ #_bedrockRoot;
  /** bedrock: list container @type {HTMLElement} */ #_bedrockList;
  /** bedrock: add button @type {HTMLElement} */ #_bedrockAddBtn;
  /** bedrock render queue @type {Array<[number, BedrockButton]>} */ #_bedrockRenderQueue = [];
  /** bedrock render queue timeout @type {number|null} */ #_bedrockRenderQueueTOid = null;
  /** 是否正在模拟权限 @type {boolean} */ #_simulatePerm = false;
  /** 模拟中玩家拥有的权限节点 @type {Set<string>} */ #_permSimOwned = new Set();
  /** actionbar: 权限模拟横幅 @type {HTMLElement} */ #_permSimBanner;
  /** 权限模拟横幅的重新配置按钮 @type {HTMLElement} */ #_permSimBannerConfig;
  /** 权限模拟横幅的关闭按钮 @type {HTMLElement} */ #_permSimBannerClose;
  /** 权限模拟按钮的 tooltip 文本 @type {HTMLElement|null} */ #_switchPermTipText;
  /** 当前编辑对象：'main' 主按钮 / 'else' 回退按钮 @type {'main'|'else'} */ #edittingTarget = 'main';
  /** java: 切换编辑对象的分段按钮 @type {HTMLElement} */ #_editTargetSwitch;
  /** java: 移除回退按钮的按钮 @type {HTMLElement} */ #_elseRemoveBtn;
  /** java: 当前编辑对象为回退按钮时的提示 @type {HTMLElement} */ #_elseHintEl;
  /** java: 编辑对象/移除回退按钮所在行 @type {HTMLElement} */ #_elseRowEl;

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
    // 切换文件时重置权限模拟与编辑对象
    this.#_simulatePerm = false;
    this.#_permSimOwned = new Set();
    this.#edittingTarget = 'main';
    this._updatePermSimUI();
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

    [this.#_renameTitleBtn, this.#_java2bedrockBtn, this.#_bedrock2javaBtn, this.#_switchPermBtn] = [
      this._buildTipBtn(
        '<svg viewBox="0 -960 960 960"><path d="m490-527 37 37 217-217-37-37-217 217ZM200-200h37l233-233-37-37-233 233v37Zm355-205L405-555l167-167-29-29-219 219-56-56 218-219q24-24 56.5-24t56.5 24l29 29 50-50q12-12 28.5-12t28.5 12l93 93q12 12 12 28.5T828-678L555-405ZM270-120H120v-150l285-285 150 150-285 285Z"></path></svg>',
        tr('rename_title'), true
      ),
      this._buildTipBtn('arrow_forward', tr('sync_java_to_bedrock')),
      this._buildTipBtn('arrow_back', tr('sync_bedrock_to_java')),
      this._buildTipBtn(
        SVG_PERM_SIM,
        tr('switch_perm_mode'),
        true
      ),
    ]
    actionbar.appendChild(this.#_switchPermBtn);
    actionbar.appendChild(this.#_renameTitleBtn);
    actionbar.appendChild(this.#_java2bedrockBtn);
    actionbar.appendChild(this.#_bedrock2javaBtn);

    // 记录权限模拟按钮的 tooltip 文本，便于切换到「退出模拟」文案
    this.#_switchPermTipText = this.#_switchPermBtn.querySelector('span') || null;

    // ─── 权限模拟横幅 ────────────────────────────
    const permSimBanner = ce('div', 'perm-sim-banner');
    permSimBanner.setAttribute('hidden', '');
    const permSimBannerText = ce('span', 'perm-sim-banner-text');
    permSimBannerText.textContent = tr('perm_sim_banner');
    // 重新配置模拟权限
    const permSimBannerConfig = document.createElement('s-icon-button');
    permSimBannerConfig.setAttribute('type', 'text');
    permSimBannerConfig.title = tr('perm_sim_config');
    permSimBannerConfig.innerHTML = `<s-icon>${SVG_PERM_SIM}</s-icon>`;
    // 关闭模拟
    const permSimBannerClose = document.createElement('s-icon-button');
    permSimBannerClose.setAttribute('type', 'text');
    permSimBannerClose.title = tr('perm_sim_close');
    permSimBannerClose.innerHTML = '<s-icon name="close"></s-icon>';
    permSimBanner.appendChild(permSimBannerText);
    permSimBanner.appendChild(permSimBannerConfig);
    permSimBanner.appendChild(permSimBannerClose);
    root.appendChild(permSimBanner);
    this.#_permSimBanner = permSimBanner;
    this.#_permSimBannerConfig = permSimBannerConfig;
    this.#_permSimBannerClose = permSimBannerClose;
    
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
    editArea.setAttribute('type', 'outlined');
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

    // ── 编辑对象：主按钮 / 回退按钮 ──
    const elseRow = ce('div', 'jm-else-row');
    const targetSwitch = document.createElement('s-segmented-button');
    targetSwitch.className = 'jm-else-switch';
    const mainSwitchItem = document.createElement('s-segmented-button-item');
    mainSwitchItem.setAttribute('value', 'main');
    mainSwitchItem.setAttribute('selected', '');
    mainSwitchItem.textContent = tr('edit_target_main');
    const elseSwitchItem = document.createElement('s-segmented-button-item');
    elseSwitchItem.setAttribute('value', 'else');
    elseSwitchItem.textContent = tr('edit_target_else');
    targetSwitch.appendChild(mainSwitchItem);
    targetSwitch.appendChild(elseSwitchItem);
    elseRow.appendChild(targetSwitch);
    // 移除回退按钮（仅编辑回退按钮时显示）
    const elseRemoveTip = this._buildTipBtn('close', tr('else_remove'), false, '');
    elseRemoveTip.classList.add('jm-else-remove');
    elseRemoveTip.style.display = 'none';
    elseRow.appendChild(elseRemoveTip);
    editBody.appendChild(elseRow);
    this.#_editTargetSwitch = targetSwitch;
    this.#_elseRowEl = elseRow;
    this.#_elseRemoveBtn = elseRemoveTip;
    // 回退按钮说明（常显）
    const elseHint = ce('div', 'jm-else-hint');
    elseHint.textContent = tr('else_perm_invalid');
    editBody.appendChild(elseHint);
    this.#_elseHintEl = elseHint;

    // ── Save ──
    const saveBtn = document.createElement('s-button');
    saveBtn.style.display = 'flex';
    saveBtn.setAttribute('type', 'filled-tonal');
    saveBtn.textContent = i18n.parse('tooltip.save');
    editBody.appendChild(saveBtn);
    this.#_saveBtn = saveBtn;

    // ── Copy / Paste (Java) ──
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.flexDirection = 'row';
    btnRow.style.gap = '.5em';
    editBody.appendChild(btnRow);

    const copyBtn = document.createElement('s-button');
    copyBtn.setAttribute('type', 'filled-tonal');
    copyBtn.textContent = tr('java_copy');
    btnRow.appendChild(copyBtn);
    this.#_javaCopyBtn = copyBtn;

    const pasteBtn = document.createElement('s-button');
    pasteBtn.setAttribute('type', 'filled-tonal');
    pasteBtn.textContent = tr('java_paste');
    btnRow.appendChild(pasteBtn);
    this.#_javaPasteBtn = pasteBtn;

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
    // 切换权限模拟：开启时先询问玩家拥有哪些权限
    this.#_switchPermBtn.addEventListener('click', () => {
      try {
        if (this.#_simulatePerm) {
          this._setPermSimulation(false);
        } else {
          this._startPermSimulation();
        }
      } catch (error) {
        console.error("Failed to switch permission simulation for", this.#_data, " : ", error);
      }
    });

    // 横幅：重新配置模拟权限
    if (this.#_permSimBannerConfig) {
      this.#_permSimBannerConfig.addEventListener('click', () => {
        this._startPermSimulation();
      });
    }

    // 横幅关闭按钮 → 退出模拟
    if (this.#_permSimBannerClose) {
      this.#_permSimBannerClose.addEventListener('click', () => {
        this._setPermSimulation(false);
      });
    }

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

    // Java → Bedrock 同步（可选择同步哪些按钮，按顺序映射）
    this.#_java2bedrockBtn.addEventListener('click', async () => {
      // 1. 收集有序的 Java 按钮
      const entries = [];
      if (this.#_data.java instanceof Map) {
        // 将 Map 按 key 排序后转为有序数组
        const sortedKeys = Array.from(this.#_data.java.keys()).sort(compareSlotKeys);
        for (const key of sortedKeys) {
          const btn = this.#_data.java.get(key);
          if (btn instanceof JavaButton) entries.push({ key, btn });
        }
      }
      if (entries.length === 0) {
        utils.msg(tr('sync_no_buttons'), i18n.parseSafe('msg.done'), 'warning');
        return;
      }

      // 2. 让用户选择要同步哪些按钮
      const selected = await pickButtonsForSync(entries, tr('sync_java_to_bedrock'));
      if (!selected || selected.length === 0) return;

      // 3. 依序生成基岩版按钮并覆盖
      this.#_data.bedrock = selected.map(({ btn }) => new BedrockButton({
        display: { text: btn.tooltip?.[0] || btn.id, icon: "" },
        perm: btn.permission ? (btn.permission_when_and_have ? "" : "!") + btn.permission : "",
        action: btn.action_type || "none",
        param: btn.action_param || "",
        else: btn.else_button ? {
          display: { text: btn.else_button.tooltip?.[0] || btn.else_button.id, icon: "" },
          action: btn.else_button.action_type || "none",
          param: btn.else_button.action_param || "",
        } : undefined,
      }));
      this._scheduleRender();
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
          param: btn.action_param || "",
          else: btn.else_button ? {
            display: { id: "paper", tooltip: [btn.else_button.text || "", ""] },
            action: btn.else_button.action_type || "none",
            param: btn.else_button.action_param || "",
          } : undefined,
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
      this._deleteJavaSlot();
    });

    // 复制按钮（Java）—— 针对当前编辑对象
    this.#_javaCopyBtn.addEventListener('click', () => {
      const raw = this._getTargetBtn();
      if (!raw) return;
      const isElse = this.#edittingTarget === 'else';
      const obj = {
        display: { id: raw.id, enchant: !!raw.enchant_glint_override, tooltip: raw.tooltip },
        perm: isElse ? '' : (raw.permission ? (raw.permission_when_and_have ? '' : '!') + raw.permission : ''),
        action: raw.action_type || 'none',
        param: raw.action_param || ''
      };
      // 回退按钮内部不允许再嵌套回退按钮
      if (!isElse && raw.else_button) {
        obj.else = {
          display: {
            id: raw.else_button.id,
            enchant: !!raw.else_button.enchant_glint_override,
            tooltip: raw.else_button.tooltip,
          },
          action: raw.else_button.action_type || 'none',
          param: raw.else_button.action_param || '',
        };
      }
      JClipboard.copy(JSON.stringify(obj, null, 2));
    });

    // 粘贴按钮（Java）—— 针对当前编辑对象
    this.#_javaPasteBtn.addEventListener('click', async () => {
      if (this.#edittingJslot == null) return;
      const data = await this._pasteButtonData();
      if (!data) return;
      // 检查是否要覆盖
      if (this.#edittingJitem && this.#edittingJitem.id !== 'minecraft:air' && this.#edittingJitem.getClearId() !== 'missingno') {
        try {
          await utils.askfor(
            i18n.parseSafe('tooltip.tip'),
            tr('java_paste_confirm', { slot: this.#edittingJslot + 1 }),
            i18n.parseSafe('tooltip.confirm'),
            i18n.parseSafe('tooltip.cancel')
          );
        } catch (_) { return; }
      }
      const [row, column] = getRowColumn(this.#edittingJslot);
      const key = `${row}${column}`;
      const newBtn = new JavaButton(data);
      if (this.#edittingTarget === 'else') {
        // 粘贴到回退按钮：其内部 perm / else 判定无效，一律剥除
        newBtn.permission = "";
        newBtn.else_button = null;
        if (!this.#edittingJbutton) return;
        this.#edittingJbutton.else_button = newBtn;
        this.#edittingJitem = JavaButton2Item(newBtn);
        this._loadJavaEditFields();
        this._commitJavaBtnUpdate(this.#edittingJslot, JavaButton2Item(this.#edittingJbutton), this.#edittingJbutton);
      } else {
        // 应用粘贴的按钮
        this.#_data.java.set(key, newBtn);
        this.#edittingJbutton = newBtn;
        this.#edittingJitem = JavaButton2Item(newBtn);
        this._commitJavaBtnUpdate(this.#edittingJslot, this.#edittingJitem, newBtn);
        this._startJavaBtnEdit(this.#edittingJslot, row, column, this.#edittingJitem);
      }
      this._scheduleRender();
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

    // 切换编辑对象（主按钮 / 回退按钮）
    this.#_editTargetSwitch.addEventListener('change', () => {
      this._setEditTarget(this.#_editTargetSwitch.value === 'else' ? 'else' : 'main');
    });

    // 移除回退按钮
    this.#_elseRemoveBtn.querySelector('s-icon-button').addEventListener('click', () => {
      if (!this.#edittingJbutton || this.#edittingJslot == null) return;
      this.#edittingJbutton.else_button = null;
      this._setEditTarget('main');
      this._commitJavaBtnUpdate(this.#edittingJslot, JavaButton2Item(this.#edittingJbutton), this.#edittingJbutton);
      this._scheduleRender();
      try { commandServer.executeCommand("files.save"); } catch (e) { console.warn(e); }
    });
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
    this.#_bedrockList.addEventListener('click', async (e) => {
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
        case 'copy':
          const btn = this.#_data.bedrock[index];
          if (!btn) break;
          JClipboard.copy(JSON.stringify({
            display: { text: btn.text, icon: btn.icon || '' },
            perm: btn.permission ? (btn.permission_when_and_have ? '' : '!') + btn.permission : '',
            action: btn.action_type || 'none',
            param: btn.action_param || ''
          }, null, 2));
          break;
        case 'delete':
          if (this.#_data.bedrock.length <= 1) break;
          try {
            await utils.askfor(
              i18n.parseSafe('tooltip.tip'),
              tr('bedrock_delete_confirm', { index: index + 1 }),
              tr('bedrock_delete'),
              i18n.parseSafe('tooltip.cancel')
            );
          } catch (_) { break; }
          this.#_data.bedrock.splice(index, 1);
          this._scheduleRender();
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
    // 当前编辑对象（主按钮 / 回退按钮）
    let isElse = false;
    let target = btn;

    // 构建对话框内容
    const dialog = document.createElement('s-dialog');
    dialog.setAttribute('showed', 'true');

    // headline
    const headline = document.createElement('div');
    headline.setAttribute('slot', 'headline');
    headline.textContent = tr('bedrock_edit_title', { index: index + 1 });
    dialog.appendChild(headline);

    // Style
    const styleEle = document.createElement('style');
    styleEle.innerHTML = `
      .jm-bedrock-editor-popup-root {
        --grid-min-width: 280px;    /* 每列最小宽度 */
        --grid-max-width: 320px;      /* 每列最大宽度（1fr = 自适应拉伸） */
        --grid-max-columns: 2;      /* 最大列数：1, 2, 3, 4... 设为 0 或 auto 表示不限制 */
        --grid-column-gap: 1.5em;  /* 水平间距 */
        --grid-row-gap: 1.5em;     /* 垂直间距 */
        --grid-padding: 1.5em;          /* 容器内边距 */
        display: grid;
        grid-template-columns: repeat(
            auto-fill,
            minmax(var(--grid-min-width), var(--grid-max-width))
        );
        max-width: min(calc((var(--grid-max-width) + var(--grid-column-gap)) * var(--grid-max-columns) - var(--grid-column-gap)), 100%);
        width: 100%;
        margin: 0 auto;
        padding: var(--grid-padding);
        gap: var(--grid-row-gap, var(--grid-gap)) var(--grid-column-gap, var(--grid-gap));
        justify-content: center;
        /* debug */
        /* border: 1px dashed #ccc; */
        /* background: rgba(0,0,0,0.02); */
      }
      .jm-bedrock-editor-popup-root .jm-bedrock-editor-popup-displaytext {
        grid-column: 1 / -1;
      }
      .jm-bedrock-editor-popup-root > * {
        width: 100%;
      }
    `;
    dialog.appendChild(styleEle);

    // base
    const textSlot = document.createElement('div');
    textSlot.setAttribute('slot', 'text');
    textSlot.classList.add("jm-bedrock-editor-popup-root");
    dialog.appendChild(textSlot);

    // ── 编辑对象：主按钮 / 回退按钮 ──
    const targetRow = ce('div', 'jm-else-row');
    targetRow.classList.add('jm-bedrock-editor-popup-displaytext');
    const targetSwitch = document.createElement('s-segmented-button');
    targetSwitch.className = 'jm-else-switch';
    const mainSwitchItem = document.createElement('s-segmented-button-item');
    mainSwitchItem.setAttribute('value', 'main');
    mainSwitchItem.setAttribute('selected', '');
    mainSwitchItem.textContent = tr('edit_target_main');
    const elseSwitchItem = document.createElement('s-segmented-button-item');
    elseSwitchItem.setAttribute('value', 'else');
    elseSwitchItem.textContent = tr('edit_target_else');
    targetSwitch.appendChild(mainSwitchItem);
    targetSwitch.appendChild(elseSwitchItem);
    targetRow.appendChild(targetSwitch);
    const elseRemoveTip = this._buildTipBtn('close', tr('else_remove'), false, '');
    elseRemoveTip.classList.add('jm-else-remove');
    elseRemoveTip.style.display = 'none';
    targetRow.appendChild(elseRemoveTip);
    textSlot.appendChild(targetRow);
    // 回退按钮说明（常显）
    const elseHint = ce('div', 'jm-else-hint');
    elseHint.textContent = tr('else_perm_invalid');
    textSlot.appendChild(elseHint);

    // 文本输入（附带渐变/文本编辑器快捷按钮）
    const textField = document.createElement('s-text-field');
    textField.setAttribute('label', tr('bedrock_text_label'));
    textField.setAttribute('type', 'multiline');
    textField.classList.add('jm-bedrock-editor-popup-displaytext');
    textField.value = target.text || '';
    textSlot.appendChild(textField);

    // 从剪贴板粘贴
    const pasteTip = document.createElement('s-tooltip');
    pasteTip.setAttribute('align', 'bottom');
    pasteTip.setAttribute('slot', 'end');
    const pasteBtn = document.createElement('s-icon-button');
    pasteBtn.setAttribute('type', 'text');
    pasteBtn.setAttribute('slot', 'trigger');
    pasteBtn.innerHTML = `<s-icon><svg viewBox="0 -960 960 960"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h167q11-35 43-57.5t70-22.5q40 0 71.5 22.5T594-840h166q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560h-80v120H280v-120h-80v560Zm280-560q17 0 28.5-11.5T520-800q0-17-11.5-28.5T480-840q-17 0-28.5 11.5T440-800q0 17 11.5 28.5T480-760Z"></path></svg></s-icon>`;
    pasteBtn.addEventListener('click', async () => {
      const text = await JClipboard.get();
      textField.value = text || "";
    });
    pasteTip.appendChild(pasteBtn);
    pasteTip.appendChild(document.createTextNode(i18n.parseSafe('tooltip.paste')));
    textField.appendChild(pasteTip);

    // 在渐变色编辑器中打开
    const mcgradientTip = document.createElement('s-tooltip');
    mcgradientTip.setAttribute('align', 'bottom');
    mcgradientTip.setAttribute('slot', 'end');
    mcgradientTip.innerHTML += i18n.parseSafe('panel.mcgradient.astool') + '<br>' + i18n.parseSafe('panel.mcgradient.astool_tip');
    const mcgradientBtn = document.createElement('s-icon-button');
    mcgradientBtn.setAttribute('type', 'text');
    mcgradientBtn.setAttribute('slot', 'trigger');
    mcgradientBtn.innerHTML = `<s-icon><svg viewBox="0 -960 960 960"><path d="M176-120q-19-4-35.5-20.5T120-176l664-664q21 5 36 20.5t21 35.5L176-120Zm-56-252v-112l356-356h112L120-372Zm0-308v-80q0-33 23.5-56.5T200-840h80L120-680Zm720 92v112l-19 19q-20-10-42.5-15.5T732-480l108-108ZM372-120l108-108q2 24 7.5 46.5T503-139l-19 19H372Zm308-80H560v-80h120v-120h80v120h120v80H760v120h-80v-120Z"></path></svg></s-icon>`;
    mcgradientBtn.addEventListener('click', () => {
      commandServer.executeCommand('panel.mcgradient.open');
    });
    mcgradientTip.appendChild(mcgradientBtn);
    textField.appendChild(mcgradientTip);

    // 在文本组件编辑器中打开
    const mctextTip = document.createElement('s-tooltip');
    mctextTip.setAttribute('align', 'bottom');
    mctextTip.setAttribute('slot', 'end');
    const mctextBtn = document.createElement('s-icon-button');
    mctextBtn.setAttribute('type', 'text');
    mctextBtn.setAttribute('slot', 'trigger');
    mctextBtn.innerHTML = `<s-icon><svg viewBox="0 -960 960 960"><path d="M200-200v-80h560v80H200Zm76-160 164-440h80l164 440h-76l-38-112H392l-40 112h-76Zm138-176h132l-64-182h-4l-64 182Z"></path></svg></s-icon>`;
    mctextBtn.addEventListener('click', async () => {
      try {
        const mctextModule = await import('../../ui/panels/mctext.js');
        const editor = mctextModule.default || mctextModule;
        const editFn = editor.edit || editor.mctextEdit;
        if (typeof editFn === 'function') {
          const [result, newText] = await editFn(textField.value);
          if (result) textField.value = newText;
        }
      } catch (e) { console.warn('Failed to open text editor:', e); }
    });
    mctextTip.appendChild(mctextBtn);
    mctextTip.appendChild(document.createTextNode(i18n.parseSafe('panel.mctext.ascall')));
    textField.appendChild(mctextTip);

    // 图标输入
    const iconField = document.createElement('s-text-field');
    iconField.setAttribute('label', tr('bedrock_icon_label'));
    iconField.value = target.icon || '';
    textSlot.appendChild(iconField);

    // 权限输入（带模式切换按钮 + 悬浮提示 + 输入过滤，参考 Java 版）
    const permField = document.createElement('s-text-field');
    permField.setAttribute('label', tr('permission_label'));
    permField.value = (target.permission || '').replace(/^!/, '');
    textSlot.appendChild(permField);

    let permMode = !target.permission.startsWith('!') && target.permission_when_and_have !== false;
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
    // 用 s-tooltip 包裹切换按钮以显示提示文本
    const permTip = document.createElement('s-tooltip');
    permTip.setAttribute('align', 'bottom');
    permTip.setAttribute('slot', 'end');
    permToggleBtn.setAttribute('slot', 'trigger');
    permTip.appendChild(permToggleBtn);
    permTip.appendChild(document.createTextNode(permMode ? tr('permission_have').replace(/<br>/g, ' ') : tr('permission_miss').replace(/<br>/g, ' ')));
    // 点击时同步更新提示文本
    permToggleBtn.addEventListener('click', () => {
      setTimeout(() => {
        permTip.lastChild.textContent = permMode ? tr('permission_have').replace(/<br>/g, ' ') : tr('permission_miss').replace(/<br>/g, ' ');
      }, 0);
    });
    permField.appendChild(permTip);

    // 输入过滤：自动去除 ! 字符，若开头有 ! 则反转模式（与 Java 版一致）
    permField.addEventListener('input', () => {
      const raw = permField.value;
      if (raw.startsWith('!')) {
        permField.value = raw.replace(/^!+/, '');
        permMode = !permMode;
        permToggleIcon.innerHTML = permMode ? SVG_ICONS.having : SVG_ICONS.missing;
        permTip.lastChild.textContent = permMode ? tr('permission_have').replace(/<br>/g, ' ') : tr('permission_miss').replace(/<br>/g, ' ');
      }
      if (permField.value.includes('!')) {
        permField.value = permField.value.replace(/!/g, '');
      }
    });

    // 动作类型选择器
    const actionPicker = document.createElement('s-picker');
    actionPicker.setAttribute('label', tr('action_type'));
    actionPicker.setAttribute('value', target.action_type || 'none');
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
    paramField.value = target.action_param || '';
    textSlot.appendChild(paramField);

    /** 刷新权限模式 UI（图标 + 提示文字） */
    const refreshPermModeUI = () => {
      permToggleIcon.innerHTML = permMode ? SVG_ICONS.having : SVG_ICONS.missing;
      permTip.lastChild.textContent = permMode ? tr('permission_have').replace(/<br>/g, ' ') : tr('permission_miss').replace(/<br>/g, ' ');
    };

    /** 切换/重新载入编辑对象 */
    const applyTarget = (nextIsElse) => {
      if (nextIsElse && !btn.else_button) {
        // 以主按钮为模板创建回退按钮
        btn.else_button = new BedrockButton({
          display: { text: btn.text || '?', icon: btn.icon || '' },
          action: btn.action_type || 'none',
          param: btn.action_param || '',
        });
      }
      isElse = !!nextIsElse;
      target = isElse ? btn.else_button : btn;
      textField.value = target.text || '';
      iconField.value = target.icon || '';
      permField.value = (target.permission || '').replace(/^!/, '');
      permMode = target.permission_when_and_have !== false;
      refreshPermModeUI();
      actionPicker.value = target.action_type || 'none';
      paramField.value = target.action_param || '';
      // 回退按钮不支持权限要求
      permField.disabled = isElse;
      permField.toggleAttribute('disabled', isElse);
      permTip.style.display = isElse ? 'none' : '';
      elseRemoveTip.style.display = isElse ? '' : 'none';
      targetSwitch.value = isElse ? 'else' : 'main';
      headline.textContent = isElse
        ? tr('bedrock_edit_title_else', { index: index + 1 })
        : tr('bedrock_edit_title', { index: index + 1 });
    };

    // 切换编辑对象
    targetSwitch.addEventListener('change', () => {
      applyTarget(targetSwitch.value === 'else');
    });

    // 移除回退按钮
    elseRemoveTip.querySelector('s-icon-button').addEventListener('click', () => {
      btn.else_button = null;
      applyTarget(false);
      this._commitBedrockUpdate(index, btn);
      this._scheduleRender();
    });

    // 粘贴按钮（从剪贴板读取按钮数据）
    const bedrockPasteBtn = document.createElement('s-button');
    bedrockPasteBtn.setAttribute('type', 'filled-tonal');
    bedrockPasteBtn.textContent = i18n.parseSafe('tooltip.paste');
    bedrockPasteBtn.addEventListener('click', async () => {
      const data = await this._pasteButtonData();
      if (!data) return;
      // 检查是否要覆盖
      if (target.text !== '?' && target.text !== '新按钮') {
        try {
          await utils.askfor(
            i18n.parseSafe('tooltip.tip'),
            tr('bedrock_paste_confirm', { index: index + 1 }),
            i18n.parseSafe('tooltip.confirm'),
            i18n.parseSafe('tooltip.cancel')
          );
        } catch (_) { return; }
      }
      // 应用粘贴的按钮数据
      if (data.display) {
        target.text = data.display.text || data.display.id || '?';
        target.icon = data.display.icon || '';
      }
      target.permission = isElse ? "" : (data.perm || '');
      target.action_type = data.action || 'none';
      target.action_param = data.param || '';
      // 回退按钮内部不允许再嵌套回退按钮
      if (isElse) target.else_button = null;
      this._commitBedrockUpdate(index, btn);
      dialog.removeAttribute('showed');
    });
    textSlot.appendChild(bedrockPasteBtn);

    // 删除按钮（危险操作，需确认）
    const deleteBtn = document.createElement('s-button');
    deleteBtn.setAttribute('type', 'filled-tonal');
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
    deleteBtn.style.backgroundColor = 'var(--s-color-error-container,#FFDAD6)';
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
      // 保存修改（回退按钮不支持权限要求）
      const rawPerm = permField.value.replace(/!/g, '');
      target.text = textField.value || '?';
      target.icon = iconField.value || '';
      target.permission = isElse ? "" : (permMode ? rawPerm : '!' + rawPerm);
      target.action_type = actionPicker.value;
      target.action_param = paramField.value || '';
      if (isElse) target.else_button = null;
      this._commitBedrockUpdate(index, btn);
      dialog.removeAttribute('showed');
    });
    dialog.appendChild(saveBtn);

    // 挂载到 s-page 下以确保正确的配色主题
    const page = document.querySelector('s-page') || document.body;
    page.appendChild(dialog);

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
  /** 当前编辑对象对应的按钮（主按钮或回退按钮） @returns {JavaButton|null} */
  _getTargetBtn() {
    const main = this.#edittingJbutton;
    if (!main) return null;
    return this.#edittingTarget === 'else' ? main.else_button : main;
  }

  /** 载入当前编辑对象的字段到编辑面板，并同步「编辑对象」相关 UI */
  _loadJavaEditFields() {
    const btn = this._getTargetBtn();
    if (!btn || this.#edittingJslot == null) return;
    const isElse = this.#edittingTarget === 'else';
    // 标题
    const [row, column] = getRowColumn(this.#edittingJslot);
    this._commitJavaTitle(tr(isElse ? 'title_edit_else' : 'title_edit', { slot: this.#edittingJslot + 1, column, row }), 'set');
    // 权限节点：去除 ! 前缀后再显示（! 用于标记权限模式，不存入输入框）
    this.#_permField.value = (btn.permission || '').replace(/^!/, '');
    this.#_actionPicker.value = btn.action_type;
    this.#_paramField.value = btn.action_param;
    // 权限模式：若原数据以 ! 开头，表示「无权限时可见」
    const rawPerm = btn.permission || '';
    const permMode = rawPerm.startsWith('!') ? !btn.permission_when_and_have : !!btn.permission_when_and_have;
    this._putAndGetPermBool(permMode);
    // 回退按钮不支持权限要求，因此禁用权限输入
    this.#_permField.disabled = isElse;
    this.#_permField.toggleAttribute('disabled', isElse);
    this.#_permField.querySelectorAll('s-tooltip').forEach((t) => { t.style.display = isElse ? 'none' : ''; });
    if (this.#_elseRemoveBtn) this.#_elseRemoveBtn.style.display = isElse ? '' : 'none';
    if (this.#_editTargetSwitch) this.#_editTargetSwitch.value = isElse ? 'else' : 'main';
  }

  /**
   * 切换 Java 编辑对象（主按钮 / 回退按钮）。
   * 若回退按钮尚不存在，则以主按钮为模板创建。
   * @param {'main'|'else'} target
   */
  _setEditTarget(target) {
    if (this.#edittingJslot == null || !this.#edittingJbutton) return;
    const main = this.#edittingJbutton;
    if (target === 'else' && !main.else_button) {
      main.else_button = cloneJavaButtonAsElse(main);
    }
    this.#edittingTarget = (target === 'else') ? 'else' : 'main';
    const btn = this._getTargetBtn();
    if (btn) this.#edittingJitem = JavaButton2Item(btn);
    this._loadJavaEditFields();
  }

  /** 立即渲染JavaButton编辑，无条件替换正在进行的编辑 @type {Item} item */
  _startJavaBtnEdit(index, row, column, item) {
    // 替换正在编辑的
    this.#edittingJbutton = this.#_data.java.get(`${row}${column}`);
    this.#edittingJitem = item;
    this.#edittingJslot = index;
    this.#edittingTarget = 'main';
    if (!this.#edittingJbutton) {
      // 空槽位：默认使用 air 作为物品 ID
      this.#edittingJbutton = new JavaButton({ display: { id: "air" } });
    }
    if (!this.#edittingJitem) {
      this.#edittingJitem = JavaButton2Item(this.#edittingJbutton);
    }
    // 载入信息
    this._loadJavaEditFields();
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

  /** 删除当前 Java 槽位按钮 */
  _deleteJavaSlot() {
    if (this.#edittingJslot == null) return;
    const [row, column] = getRowColumn(this.#edittingJslot);
    const key = `${row}${column}`;
    this.#_data.java.delete(key);
    this.#_chestEl.setItem(this.#edittingJslot, null);
    // 清空渲染队列，防止残留条目重新渲染已删除的按钮
    this.#javeBtnRenderQueue = [];
    if (this.#javeBtnRenderQueueTOid) {
      clearTimeout(this.#javeBtnRenderQueueTOid);
      this.#javeBtnRenderQueueTOid = null;
    }
    this.#edittingJbutton = null;
    this.#edittingJitem = null;
    this.#edittingJslot = null;
    this.#edittingTarget = 'main';
    this.#_editBody.removeAttribute('visible');
    this.#_unsaveCard.removeAttribute('visible');
    try { this.#_chestEl.highlightIndex = -1; } catch (_) {}
    this._commitJavaTitle(tr('title_idle'), 'set');
    try { commandServer.executeCommand("files.save"); } catch (e) { console.warn(e); }
  }

  /**
   * 从剪贴板读取按钮数据。
   * 优先尝试解析为按钮 JSON（含 display / action 字段），
   * 否则尝试作为 MC 物品读取。
   * @returns {Object|null} 可用于 new JavaButton() 或 new BedrockButton() 的数据，无效则返回 null
   */
  async _pasteButtonData() {
    const text = await JClipboard.get(false);
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      // 检查是否像按钮数据（有 display 或 action 字段）
      if (parsed && typeof parsed === 'object' && (parsed.display || parsed.action)) {
        return parsed;
      }
      // 尝试作为 MC 物品读取
      const item = getItemFromMC(text);
      if (item && item instanceof Item && item.id !== 'minecraft:air') {
        // 构建按钮数据
        return {
          display: {
            id: item.getClearId(),
            enchant: !!item.ISC?.enchantment_glint_override,
            tooltip: [item.getDisplayName(), ...(item.ISC?.lore || [])]
          },
          perm: '',
          action: 'none',
          param: ''
        };
      }
    } catch (_) { /* 无效 JSON，静默处理 */ }
    return null;
  }

  // ═════════════════════════════════════════════
  //  权限模拟
  // ═════════════════════════════════════════════

  /**
   * 收集菜单中所有按钮声明的权限节点（去重，按 Java 槽位顺序、再按基岩版顺序）。
   * 回退按钮的 perm 判定无效，因此不参与收集。
   * @returns {string[]}
   */
  _collectPermissions() {
    /** @type {string[]} */
    const list = [];
    const seen = new Set();
    const push = (btn) => {
      const perm = btn?.permission;
      if (!perm || seen.has(perm)) return;
      seen.add(perm);
      list.push(perm);
    };
    if (this.#_data?.java instanceof Map) {
      const keys = Array.from(this.#_data.java.keys()).sort(compareSlotKeys);
      for (const key of keys) push(this.#_data.java.get(key));
    }
    if (Array.isArray(this.#_data?.bedrock)) this.#_data.bedrock.forEach(push);
    return list;
  }

  /**
   * 依据按钮权限与当前模拟状态判断其是否应显示。
   *
   * 未开启模拟时忽略一切权限要求（总是显示）；
   * 开启模拟时按「玩家拥有 #_permSimOwned 中列出的权限」来判定：
   * - 需要拥有权限的按钮（permission_when_and_have === true）→ 拥有才显示
   * - 需要缺失该权限的按钮（permission_when_and_have === false）→ 缺失才显示
   * - 无权限要求的按钮 → 始终显示
   *
   * @param {JavaButton|BedrockButton} btn
   * @returns {boolean}
   */
  _isBtnVisibleWithPerm(btn) {
    if (!btn) return true;
    if (!this.#_simulatePerm) return true;
    if (!btn.permission) return true;
    const owned = this.#_permSimOwned.has(btn.permission);
    return btn.permission_when_and_have ? owned : !owned;
  }

  /**
   * 解析实际应渲染的按钮：主按钮可见则用主按钮，
   * 否则回退到 else（回退按钮不再判定权限）；都没有则返回 null（该位置不渲染）。
   * @param {JavaButton|BedrockButton} btn
   * @returns {{btn: JavaButton|BedrockButton|null, isElse: boolean}}
   */
  _resolveVisibleBtn(btn) {
    if (!btn) return { btn: null, isElse: false };
    if (this._isBtnVisibleWithPerm(btn)) return { btn, isElse: false };
    if (btn.else_button) return { btn: btn.else_button, isElse: true };
    return { btn: null, isElse: false };
  }

  /**
   * 开启/关闭权限模拟并刷新界面。
   * @param {boolean} on
   */
  _setPermSimulation(on) {
    this.#_simulatePerm = !!on;
    this._updatePermSimUI();
    this._recommitAllJava();
    this._scheduleRender();
  }

  /**
   * 开始（或重新配置）权限模拟：收集权限 → 询问玩家拥有哪些 → 应用。
   */
  async _startPermSimulation() {
    const perms = this._collectPermissions();
    if (perms.length === 0) {
      utils.msg(tr('perm_sim_no_perms'), i18n.parseSafe('msg.done'), 'warning');
      return;
    }
    const owned = await pickSimulatedPermissions(perms, this.#_permSimOwned);
    if (!owned) return; // 用户取消
    this.#_permSimOwned = owned;
    this._setPermSimulation(true);
  }

  /** 刷新模拟相关的 UI（横幅、按钮状态与 tooltip 文案）。 */
  _updatePermSimUI() {
    const on = this.#_simulatePerm;
    if (this.#_permSimBanner) {
      this.#_permSimBanner.hidden = !on;
      if (on) {
        const total = this._collectPermissions().length;
        const textEl = this.#_permSimBanner.querySelector('.perm-sim-banner-text');
        if (textEl) textEl.textContent = tr('perm_sim_banner', { owned: this.#_permSimOwned.size, total: total });
      }
    }
    const innerBtn = this.#_switchPermBtn ? this.#_switchPermBtn.querySelector('s-icon-button') : null;
    if (innerBtn) innerBtn.setAttribute('type', on ? 'filled' : 'outlined');
    if (this.#_switchPermTipText) {
      this.#_switchPermTipText.textContent = on ? tr('switch_perm_mode_exit') : tr('switch_perm_mode');
    }
  }

  /** 重新提交所有 Java 槽位渲染（切换模拟时用于刷新整箱物品）。 */
  _recommitAllJava() {
    if (!(this.#_data?.java instanceof Map)) return;
    for (const [slot, btn] of this.#_data.java.entries()) {
      if (!(btn instanceof JavaButton)) continue;
      if (!slot || slot.length < 2) continue;
      const line = parseInt(slot[0]);
      const column = parseInt(slot[1]);
      if (Number.isNaN(line) || Number.isNaN(column)) continue;
      const index = (line - 1) * 9 + (column - 1);
      if (index < 0 || index >= 54) continue;
      this._commitJavaBtnUpdate(index, JavaButton2Item(btn), btn);
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
        // 解析实际应显示的按钮（主按钮或其回退按钮；都没则清空槽位）
        const { btn: shownBtn, isElse } = this._resolveVisibleBtn(btn);
        if (!shownBtn) {
          this.#_chestEl.setItem(index, null);
          return;
        }
        const shownItem = isElse ? JavaButton2Item(shownBtn) : item;
        if (!Array.isArray(shownItem.ISC?.lore)) { shownItem.ISC.lore = []; }
        // 构建镜像物品，并显示附加信息
        const mirror = shownItem.clone();
        if (shownBtn.permission && !isElse) {
          // 有权限需求，就计算权限模式
          if (shownBtn.permission_when_and_have) {
            mirror.ISC.lore.push(MCColors.parse(tr("attach_to_tooltip_p", { perm: shownBtn.permission, action: shownBtn.action_type, param: shownBtn.action_param })));
          } else {
            mirror.ISC.lore.push(MCColors.parse(tr("attach_to_tooltip_np", { perm: shownBtn.permission, action: shownBtn.action_type, param: shownBtn.action_param })));
          }
        } else {
          // 没有权限需求（或当前显示的是回退按钮）
          mirror.ISC.lore.push(MCColors.parse(tr("attach_to_tooltip", { action: shownBtn.action_type, param: shownBtn.action_param })));
        }
        if (isElse) {
          // 说明这是因权限不可见而显示的替代按钮
          mirror.ISC.lore.push(MCColors.parse(tr("attach_to_tooltip_else", { perm: btn.permission })));
        } else if (btn.else_button) {
          // 主按钮显示时提醒它配置了回退按钮
          mirror.ISC.lore.push(MCColors.parse(tr("attach_to_tooltip_else_idle")));
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
        const resolved = this._resolveVisibleBtn(btn);
        if (!resolved.btn) return;
        processedIndexes.add(index);
        this._renderBedrockCard(index, resolved.btn, resolved.isElse, btn);
      });

      // 确保所有未在队列中的已有按钮也渲染
      if (Array.isArray(this.#_data?.bedrock)) {
        for (let i = 0; i < this.#_data.bedrock.length; i++) {
          const btn = this.#_data.bedrock[i];
          if (processedIndexes.has(i) || !(btn instanceof BedrockButton)) continue;
          const resolved = this._resolveVisibleBtn(btn);
          if (!resolved.btn) continue;
          this._renderBedrockCard(i, resolved.btn, resolved.isElse, btn);
        }
      }

      // 清空队列
      this.#_bedrockRenderQueue = [];
    })
  }

  /**
   * 渲染单个基岩版按钮卡片
   * @param {number} index
   * @param {BedrockButton} btn 实际要渲染的按钮（可能是回退按钮）
   * @param {boolean} [isElse=false] 当前渲染的是否为回退按钮
   * @param {BedrockButton} [originBtn] 原始按钮（用于展示权限判定信息）
   */
  _renderBedrockCard(index, btn, isElse = false, originBtn = btn) {
    const card = document.createElement('s-card');
    card.className = 'bedrock-card';
    card.setAttribute('type', 'outlined');
    card.dataset.index = index;

    // Headline: 操作类型
    const headline = document.createElement('div');
    const paramText = btn.action_param
      ? tr('bedrock_param_info', { param: btn.action_param })
      : tr('bedrock_param_none');
    headline.setAttribute('slot', 'subhead');
    headline.textContent = tr('action_type_' + (btn.action_type || 'none')) + paramText;
    headline.style = `border-top: 1px solid black; margin-top: 0.2em;`;
    card.appendChild(headline);
    
    // Text: 渲染后的 display.text（支持 § 格式）+ 权限指示器（小字带颜色）
    const textEl = document.createElement('div');
    textEl.setAttribute('slot', 'headline');
    textEl.style = `line-height: 1.4`;
    textEl.classList.add('pixel');
    textEl.innerHTML = MCColors.toHtml(MCColors.parse(btn.text || ''));
    card.appendChild(textEl);

    // 权限指示器
    const permEl = document.createElement('div');
    permEl.setAttribute('slot', 'subhead');
    if (isElse) {
      // 当前显示的是回退按钮
      permEl.style.color = 'var(--s-color-warning-container, #ffe169)';
      permEl.textContent = tr('bedrock_perm_else', { perm: originBtn.permission });
    } else if (btn.permission) {
      if (btn.permission_when_and_have) {
        // 有权限才可见 → 黄色警告
        permEl.style.color = 'var(--s-color-warning-container, #ffe169)';
        permEl.textContent = tr('bedrock_perm_have', { perm: btn.permission });
      } else {
        // 无权限才可见 → 红色错误
        permEl.style.color = 'var(--s-color-error, #ba1a1a)';
        permEl.textContent = tr('bedrock_perm_miss', { perm: btn.permission });
      }
    } else {
      // 无权限要求 → 绿色成功
      permEl.style.color = 'var(--s-color-success-container, #92f8b4)';
      permEl.textContent = tr('bedrock_perm_none');
    }
    card.appendChild(permEl);

    // 回退按钮提示（仅主按钮可见时提示存在性，避免误导）
    if (!isElse && btn.else_button) {
      const elseEl = document.createElement('div');
      elseEl.setAttribute('slot', 'subhead');
      elseEl.style.color = 'var(--s-color-primary, #415f91)';
      elseEl.textContent = tr('bedrock_else_info', { text: btn.else_button.text || '' });
      card.appendChild(elseEl);
    }
    // textEl.appendChild(permEl);

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

    // 复制
    const copyBtn = document.createElement('s-icon-button');
    copyBtn.setAttribute('type', 'text');
    copyBtn.dataset.bedrockAction = 'copy';
    copyBtn.style.width = `stretch`;
    copyBtn.innerHTML = `<s-icon><svg viewBox="0 -960 960 960"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"></path></svg></s-icon>`;
    actions.appendChild(copyBtn);
    
    // 删除（红色）
    const delBtn = document.createElement('s-icon-button');
    delBtn.setAttribute('type', 'text');
    delBtn.dataset.bedrockAction = 'delete';
    delBtn.style.width = `stretch`;
    delBtn.innerHTML = `<s-icon style="color:var(--s-color-error,#ba1a1a)"><svg viewBox="0 -960 960 960"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"></path></svg></s-icon>`;
    actions.appendChild(delBtn);

    card.appendChild(actions);

    this.#_bedrockList.appendChild(card);
  }

  /** 执行保存正在编辑的按钮（抽离以复用） */
  async _doSaveEditting() {
    if (this.#edittingJslot == null) return;
    try {
      const isElse = this.#edittingTarget === 'else';
      // 构建 permission：输入框已过滤 !，只需根据权限模式添加前缀（回退按钮不支持权限）
      let permission = this.#_permField.value.replace(/!/g, "");
      if (!this._putAndGetPermBool()) { permission = "!" + permission; };
      const candidate = Item2JavaButton(this.#edittingJitem, this.#_actionPicker.value, isElse ? "" : permission, this.#_paramField.value);
      const [row, column] = getRowColumn(this.#edittingJslot);
      const key = `${row}${column}`;
      if (isElse) {
        // 回退按钮：只更新嵌套按钮，不动主按钮
        if (!this.#edittingJbutton) return;
        this.#edittingJbutton.else_button = candidate;
      } else {
        // 保留原有的回退按钮（它不在本面板的字段中）
        candidate.else_button = this.#edittingJbutton ? this.#edittingJbutton.else_button : null;
        this.#edittingJbutton = candidate;
        // 同步回数据模型
        try {
          if (this.#_data && this.#_data.java instanceof Map) {
            this.#_data.java.set(key, this.#edittingJbutton);
          }
        } catch (err) { console.warn("Failed to sync edited button to JMenu data:", err); }
      }
      // 确保主按钮已存在于数据中，否则回退按钮会随临时对象一起丢失
      try {
        if (this.#_data && this.#_data.java instanceof Map && this.#_data.java.get(key) !== this.#edittingJbutton) {
          this.#_data.java.set(key, this.#edittingJbutton);
        }
      } catch (err) { console.warn("Failed to sync edited button to JMenu data:", err); }
      // 提交渲染：始终以主按钮 + 主按钮的物品渲染，回退按钮由渲染阶段按权限解析
      this._commitJavaBtnUpdate(this.#edittingJslot, JavaButton2Item(this.#edittingJbutton), this.#edittingJbutton);
      this._scheduleRender();
      // 调用保存命令
      try { commandServer.executeCommand("files.save"); } catch (e) { console.warn(e); }
      utils.msg(i18n.parseSafe("msg.savedTo", { path: `#${this.#edittingJslot + 1}${isElse ? ' (else)' : ''}` }), i18n.parseSafe("msg.done"), 'success');
    } catch (e) {
      console.warn("Failed to save editing button:", e);
    }
  }

  /** 判断当前编辑区是否有未保存的改动 */
  _isCurrentEditDirty() {
    if (this.#edittingJslot == null) return false;
    try {
      const isElse = this.#edittingTarget === 'else';
      // 构建将在保存时生成的 JavaButton（输入框已过滤 !）
      let permission = this.#_permField.value.replace(/!/g, "");
      if (!this._putAndGetPermBool()) { permission = "!" + permission; };
      const candidate = Item2JavaButton(this.#edittingJitem, this.#_actionPicker.value, isElse ? "" : permission, this.#_paramField.value);
      const original = this._getTargetBtn();
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
    const tipText = document.createElement('span');
    tipText.textContent = tip;
    tipEl.appendChild(tipText);
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
/**
 * 弹出「选择要同步的按钮」对话框，用于选择将哪些 Java 按钮同步到基岩版。
 * @param {Array<{key:string, btn:JavaButton}>} entries 已排序的 Java 按钮
 * @param {string} title 对话框标题
 * @returns {Promise<Array<{key:string, btn:JavaButton}>|null>} 选中的条目；取消或无选中返回 null
 */
async function pickButtonsForSync(entries, title) {
  const scroll = document.createElement('s-scroll-view');
  scroll.className = 'jmenu-sync-scroll';

  /** @type {HTMLElement[]} */
  const checkboxes = [];
  entries.forEach(({ key, btn }, i) => {
    const row = document.createElement('div');
    row.className = 'jmenu-sync-row';

    const cb = document.createElement('s-checkbox');
    cb.checked = true;

    const rowNo = key.length >= 2 ? key[0] : '?';
    const colNo = key.length >= 2 ? key[1] : '?';
    const text = (btn.tooltip && btn.tooltip[0]) ? btn.tooltip[0] : (btn.id || '');

    const span = document.createElement('span');
    span.textContent = `#${i + 1} [${rowNo}行 ${colNo}列] ${text}`;

    row.appendChild(cb);
    row.appendChild(span);
    // 点击行（复选框以外区域）切换勾选
    row.addEventListener('click', (e) => {
      if (e.target === cb || cb.contains(e.target)) return;
      cb.checked = !cb.checked;
    });

    scroll.appendChild(row);
    checkboxes.push(cb);
  });

  const toolbar = document.createElement('div');
  toolbar.className = 'jmenu-sync-toolbar';
  const mkBtn = (label, onclick) => {
    const b = document.createElement('s-button');
    b.type = 'text';
    b.textContent = label;
    b.addEventListener('click', (e) => { e.preventDefault(); onclick(); });
    return b;
  };
  toolbar.appendChild(mkBtn(tr('sync_select_all'), () => checkboxes.forEach((cb) => { cb.checked = true; })));
  toolbar.appendChild(mkBtn(tr('sync_select_none'), () => checkboxes.forEach((cb) => { cb.checked = false; })));
  toolbar.appendChild(mkBtn(tr('sync_select_invert'), () => checkboxes.forEach((cb) => { cb.checked = !cb.checked; })));

  const hint = document.createElement('div');
  hint.className = 'jmenu-sync-hint';
  hint.textContent = tr('sync_select_hint');

  let choice;
  try {
    choice = await utils.dialog(title, [hint, scroll, toolbar], true, [i18n.parseSafe('tooltip.confirm')]);
  } catch (_) {
    return null; // 用户取消
  }
  if (choice !== 0) return null;

  const selected = entries.filter((_, i) => checkboxes[i].checked);
  return selected.length > 0 ? selected : null;
}

function tr(key, params = {}) { return i18n.parseSafe(`editor.jmenu.${key}`, params); }
/** 以主按钮为模板创建回退按钮（回退按钮的 perm / else 无效，因此不继承） */
function cloneJavaButtonAsElse(btn) {
  return new JavaButton({
    display: {
      id: btn.id,
      enchant: !!btn.enchant_glint_override,
      tooltip: Array.isArray(btn.tooltip) ? [...btn.tooltip] : [],
    },
    action: btn.action_type || 'none',
    param: btn.action_param || '',
  });
}
/** 比较 Java 槽位键（如 "12"），按先行后列排序 */
function compareSlotKeys(a, b) {
  const [ar, ac] = [parseInt(a[0]), parseInt(a[1])];
  const [br, bc] = [parseInt(b[0]), parseInt(b[1])];
  if (Number.isNaN(ar) || Number.isNaN(br)) return String(a).localeCompare(String(b));
  return (ar - br) || (ac - bc);
}
/**
 * 弹出「模拟权限」对话框，用于选择模拟的玩家拥有哪些权限。
 * @param {string[]} perms 菜单中出现的全部权限节点
 * @param {Set<string>} [owned] 当前已勾选的权限
 * @returns {Promise<Set<string>|null>} 勾选结果；取消返回 null
 */
async function pickSimulatedPermissions(perms, owned = new Set()) {
  const scroll = ce('s-scroll-view', 'jmenu-sync-scroll');

  /** @type {HTMLElement[]} */
  const checkboxes = [];
  perms.forEach((perm) => {
    const row = ce('div', 'jmenu-sync-row');
    const cb = document.createElement('s-checkbox');
    cb.checked = owned.has(perm);
    const span = document.createElement('span');
    span.textContent = perm;
    row.appendChild(cb);
    row.appendChild(span);
    // 点击行（复选框以外区域）切换勾选
    row.addEventListener('click', (e) => {
      if (e.target === cb || cb.contains(e.target)) return;
      cb.checked = !cb.checked;
    });
    scroll.appendChild(row);
    checkboxes.push(cb);
  });

  const toolbar = ce('div', 'jmenu-sync-toolbar');
  const mkBtn = (label, onclick) => {
    const b = document.createElement('s-button');
    b.type = 'text';
    b.textContent = label;
    b.addEventListener('click', (e) => { e.preventDefault(); onclick(); });
    return b;
  };
  toolbar.appendChild(mkBtn(tr('sync_select_all'), () => checkboxes.forEach((cb) => { cb.checked = true; })));
  toolbar.appendChild(mkBtn(tr('sync_select_none'), () => checkboxes.forEach((cb) => { cb.checked = false; })));
  toolbar.appendChild(mkBtn(tr('sync_select_invert'), () => checkboxes.forEach((cb) => { cb.checked = !cb.checked; })));

  const hint = ce('div', 'jmenu-sync-hint');
  hint.textContent = tr('perm_sim_select_hint');

  let choice;
  try {
    choice = await utils.dialog(tr('perm_sim_dialog_title'), [hint, scroll, toolbar], true, [i18n.parseSafe('tooltip.confirm')]);
  } catch (_) {
    return null; // 用户取消
  }
  if (choice !== 0) return null;

  const result = new Set();
  perms.forEach((perm, i) => { if (checkboxes[i].checked) result.add(perm); });
  return result;
}
/**
 * 将按钮转换为物品
 * @param {JavaButton} btn 源JAVA按钮
 * @returns {Item} 
 */
export function JavaButton2Item(btn) {
  if (!(btn instanceof JavaButton)) return;
  if (btn.tooltip.length == 0) btn.tooltip.push("");
  if (btn.tooltip.length > 1) {
    const lores = btn.tooltip.slice(1);
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
