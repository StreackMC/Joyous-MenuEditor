/**
 * MC物品编辑器面板
 * 
 * 提供可视化的MC物品编辑功能，支持：
 * - 物品ID选择/搜索（基于 i18n minecraft.items 定义）
 * - 数量、物品模型、附魔光效
 * - 自定义名称和描述文本（Lore）委托给 mctext.js 专业面板处理
 * - 实时预览（mc-item-display 自定义元素）
 * 
 * API 模式：
 * - 会话锁（只允许同时进行一个编辑）
 * - Promise 异步操作
 * - 完成后返回 MCItemStack 的 Item 实例
 * 
 * @module mcitem
 */

import i18n from "../../i18n.js";
import commands from "../../backend/commandServer.js";
import utils from "../utils.js";
import JClipboard from "../../library/JClipboard.js";
import { Item, getItemFromMC } from "../../library/MCItemStack.js";
import mctext from "./mctext.js";

// ──────────────────── 全局状态 ────────────────────

/** 打开编辑器时的原始 Item 副本序列化字符串（用于判断是否修改） */
let originSerialized = "";
/** 当前编辑中的 Item 实例 @type {Item|null} */
let currentItem = null;
/** 未保存警告计时器 ID，-1 表示未激活 */
let unsavedWarnStatus = -1;
/** 会话锁：存储当前 Promise 的 [resolve, reject] */
let promiseCall = null;

// ──────────────────── DOM 元素引用 ────────────────────

export const mcitemPanel = {
  root: document.getElementById("mcitem-panel"),
  dialogBtn: {
    cancel: document.getElementById("mcitem-panel-btn-cancel"),
    confirm: document.getElementById("mcitem-panel-btn-confirm"),
  },
  fields: {
    id: document.getElementById("mcitem-id"),
    amount: document.getElementById("mcitem-amount"),
    model: document.getElementById("mcitem-model"),
    glint: document.getElementById("mcitem-glint"),
  },
  textBtns: {
    editName: document.getElementById("mcitem-btn-edit-name"),
    editLore: document.getElementById("mcitem-btn-edit-lore"),
  },
  browse: {
    btn: document.getElementById("mcitem-id-browse"),
    dialog: document.getElementById("mcitem-browser"),
    search: document.getElementById("mcitem-browser-search"),
    list: document.getElementById("mcitem-browser-list"),
    close: document.getElementById("mcitem-browser-btn-close"),
  },
  previewElement: document.getElementById("mcitem-preview-element"),
};

// ──────────────────── 字段双向绑定 ────────────────────

/**
 * 从表单字段读取值，更新 currentItem 并刷新预览
 */
function syncFieldsToItem() {
  if (!currentItem) return;

  // 物品 ID
  const rawId = mcitemPanel.fields.id.value || "minecraft:air";
  currentItem.id = currentItem._resolveId(rawId);

  // 数量
  const amt = parseInt(mcitemPanel.fields.amount.value, 10);
  currentItem.amount = isNaN(amt) ? 1 : Math.max(1, Math.min(99, amt));

  // 物品模型
  const modelRaw = mcitemPanel.fields.model.value || "";
  currentItem.ISC.item_model = modelRaw || undefined;

  // 附魔光效
  currentItem.ISC.enchantment_glint_override = mcitemPanel.fields.glint.checked || false;

  // 更新预览
  updateItemPreview();
}

/**
 * 将 currentItem 的值写入表单字段
 */
function syncItemToFields() {
  if (!currentItem) return;

  // 物品 ID（去除 minecraft: 前缀）
  const displayId = currentItem.id.replace(/^minecraft:/, "");
  mcitemPanel.fields.id.value = displayId;

  // 数量
  mcitemPanel.fields.amount.value = String(currentItem.amount);

  // 物品模型
  mcitemPanel.fields.model.value = currentItem.ISC.item_model || "";

  // 附魔光效
  mcitemPanel.fields.glint.checked = !!currentItem.ISC.enchantment_glint_override;

  // 更新预览
  updateItemPreview();
}

/**
 * 更新 mc-item-display 预览元素
 */
function updateItemPreview() {
  if (!currentItem) return;
  const el = mcitemPanel.previewElement;
  if (!el) return;

  const itemId = currentItem.id.replace(/^minecraft:/, "");
  el.src = `./assets/minecraft/items/${itemId}.png`;

  el.amount = currentItem.amount > 1 ? String(currentItem.amount) : "";

  // 自定义名称（使用 Item.getDisplayName() 统一处理）
  el.name = currentItem.getDisplayName ? currentItem.getDisplayName() : (currentItem.ISC?.item_name || '');

  // Lore（数组转文本）
  const loreArr = currentItem.ISC.lore || [];
  el.lore = loreArr.join("\n");

  // 附魔光效
  if (currentItem.ISC.enchantment_glint_override) {
    el.dataset.glint = "true";
  } else {
    delete el.dataset.glint;
  }
}

// ──────────────────── 字段变化监听 ────────────────────

mcitemPanel.fields.id.addEventListener("change", syncFieldsToItem);
mcitemPanel.fields.id.addEventListener("input", syncFieldsToItem);
mcitemPanel.fields.amount.addEventListener("change", syncFieldsToItem);
mcitemPanel.fields.model.addEventListener("change", syncFieldsToItem);
mcitemPanel.fields.model.addEventListener("input", syncFieldsToItem);
mcitemPanel.fields.glint.addEventListener("change", syncFieldsToItem);

// ──────────────────── 委托至 mctext ────────────────────

/**
 * 从 currentItem 中提取名称纯文本
 * @returns {string}
 */
function getNamePlainText() {
  if (!currentItem) return "";
  // 使用 Item.getDisplayName() 统一获取展示名称
  return currentItem.getDisplayName ? currentItem.getDisplayName() : (currentItem.ISC?.item_name || '');
}

/**
 * 从 currentItem 中提取 Lore 原始文本（§ 格式，多行）
 * @returns {string}
 */
function getLoreText() {
  if (!currentItem) return "";
  const loreArr = currentItem.ISC.lore || [];
  return loreArr.join("\n");
}

/** 点击"编辑自定义名称" → 委托 mctext */
if (mcitemPanel.textBtns.editName) {
  mcitemPanel.textBtns.editName.addEventListener("click", () => {
    if (!currentItem) return;
    const currentName = getNamePlainText();
    mctext.edit(currentName).then(([status, newName]) => {
      if (status) {
        // mctext 返回的是 § 格式文本，需要转为 JSON 文本组件
        currentItem.ISC.item_name = newName
          ? `{"text":"${newName.replace(/"/g, '\\"').replaceAll(/\n/g, "")}"}`
          : "";
        updateItemPreview();
      }
    });
  });
}

/** 点击"编辑描述文本" → 委托 mctext */
if (mcitemPanel.textBtns.editLore) {
  mcitemPanel.textBtns.editLore.addEventListener("click", () => {
    if (!currentItem) return;
    const currentLore = getLoreText();
    mctext.edit(currentLore).then(([status, newLore]) => {
      if (status) {
        // mctext 返回 § 格式文本，按行分割作为 lore 数组
        currentItem.ISC.lore = newLore ? newLore.split("\n") : [];
        updateItemPreview();
      }
    });
  });
}

// ──────────────────── 按钮事件 ────────────────────

/** 确认按钮：保存修改 */
mcitemPanel.dialogBtn.confirm.addEventListener("click", () => {
  syncFieldsToItem();
  const currentSerialized = currentItem ? currentItem.toString() : "";
  if (originSerialized === currentSerialized) {
    if (promiseCall) promiseCall[0]([false, currentItem]);
    return;
  }
  if (promiseCall) promiseCall[0]([true, currentItem]);
});

/** 取消按钮：询问是否保存 */
mcitemPanel.dialogBtn.cancel.addEventListener("click", (e) => {
  syncFieldsToItem();
  const currentSerialized = currentItem ? currentItem.toString() : "";
  if (originSerialized === currentSerialized || unsavedWarnStatus > 0) {
    if (promiseCall) promiseCall[0]([false, currentItem]);
    return;
  }
  e.stopImmediatePropagation();
  e.preventDefault();
  mcitemPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("panel.mcitem.unsaved");
  unsavedWarnStatus = setTimeout(() => {
    mcitemPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("tooltip.cancel");
    unsavedWarnStatus = -1;
  }, 5e3);
});

// ──────────────────── 关闭清理 ────────────────────

mcitemPanel.root.addEventListener("closed", () => {
  if (unsavedWarnStatus > 0) {
    clearTimeout(unsavedWarnStatus);
    mcitemPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("tooltip.cancel");
    unsavedWarnStatus = -1;
  }
  promiseCall = null;
  originSerialized = "";
  currentItem = null;
  mcitemPanel.fields.id.value = "";
  mcitemPanel.fields.amount.value = "1";
  mcitemPanel.fields.model.value = "";
  mcitemPanel.fields.glint.checked = false;
  if (mcitemPanel.previewElement) {
    mcitemPanel.previewElement.src = "";
    mcitemPanel.previewElement.amount = "";
    mcitemPanel.previewElement.name = "";
    mcitemPanel.previewElement.lore = "";
    delete mcitemPanel.previewElement.dataset.glint;
  }
});

// ──────────────────── 物品浏览器 ────────────────────

let _cachedItemList = null;

function getItemList() {
  if (_cachedItemList) return _cachedItemList;
  // 优先使用已加载的 Minecraft 物品翻译（对象映射），回退到默认翻译
  const translationsObj = i18n.getCurrentMcTranslations()
    || i18n.getDefaultMcTranslations()
    || {};
  const entries = Object.keys(translationsObj).map(k => ({ key: k, translation: translationsObj[k] }));
  _cachedItemList = entries.filter(v => v && v.key && v.translation);
  return _cachedItemList;
}

function renderBrowserList(query = "") {
  const list = mcitemPanel.browse.list;
  if (!list) return;

  const items = getItemList();
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter(item =>
        item.key.toLowerCase().includes(q) ||
        item.translation.toLowerCase().includes(q)
      )
    : items;

  list.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = i18n.parseSafe("panel.mcitem.browser.no_result");
    empty.style.cssText = "width:100%;text-align:center;padding:2rem;color:var(--s-color-on-surface-variant,#40484C);";
    list.appendChild(empty);
    return;
  }

  filtered.forEach(item => {
    const div = document.createElement("div");
    div.className = "mcitem-browser-item";
    div.dataset.key = item.key;

    const display = document.createElement("mc-item-display");
    display.src = `./assets/minecraft/items/${item.key}.png`;
    display.amount = "";
    div.appendChild(display);

    const nameSpan = document.createElement("span");
    nameSpan.className = "mcitem-browser-item-name";
    nameSpan.textContent = i18n.parseMinecraft(item.key);
    div.appendChild(nameSpan);

    div.addEventListener("click", () => selectItem(item.key));
    list.appendChild(div);
  });
}

function selectItem(key) {
  if (!currentItem) return;
  mcitemPanel.fields.id.value = key;
  mcitemPanel.browse.dialog.showed = false;
  syncFieldsToItem();
}

if (mcitemPanel.browse.btn) {
  mcitemPanel.browse.btn.addEventListener("click", () => {
    _cachedItemList = null;
    renderBrowserList();
    mcitemPanel.browse.dialog.showed = true;
    setTimeout(() => {
      if (mcitemPanel.browse.search && mcitemPanel.browse.search.native) {
        mcitemPanel.browse.search.native.focus();
      }
    }, 300);
  });
}

if (mcitemPanel.browse.search) {
  mcitemPanel.browse.search.addEventListener("input", () => {
    renderBrowserList(mcitemPanel.browse.search.value);
  });
}

if (mcitemPanel.browse.close) {
  mcitemPanel.browse.close.addEventListener("click", () => {
    mcitemPanel.browse.dialog.showed = false;
  });
}

if (mcitemPanel.browse.dialog) {
  mcitemPanel.browse.dialog.addEventListener("closed", () => {
    if (mcitemPanel.browse.search) mcitemPanel.browse.search.value = "";
  });
}

// ──────────────────── 核心 API ────────────────────

/**
 * 打开 MC物品编辑器
 * 
 * @param {Item|string} [data] - 要编辑的物品。可以是 Item 实例，也可以是原版格式字符串。
 *                               不传或传 null 则创建一个新物品（空气）。
 * @returns {Promise<[boolean, Item|null]>} 返回 [status, item]：
 *   - status: boolean - true 表示用户确认修改，false 表示取消
 *   - item: Item|null - 编辑后的 Item 实例
 * @throws {Error} 如果已有正在进行的编辑
 */
export function edit(data) {
  return new Promise((resolve, reject) => {
    if (promiseCall !== null) {
      reject(new Error("已有正在进行的编辑"));
      return;
    }

    let item;
    if (data instanceof Item) {
      item = data;
    } else if (typeof data === "string" && data.trim()) {
      item = getItemFromMC(data);
    } else {
      item = new Item("minecraft:air", 1, {});
    }

    originSerialized = item.toString();
    currentItem = item;
    promiseCall = [resolve, reject];

    syncItemToFields();
    mcitemPanel.root.showed = true;
  });
}
commands.regisiterCommand("panel.mcitem.edit", edit);

/**
 * 以工具模式打开物品编辑器 —— 编辑完成后自动复制结果到剪贴板
 */
commands.regisiterCommand("panel.mcitem.open", (param) => {
  if (!param) {
    param = new Item("minecraft:apple", 1, {
      item_name: '{"text":"Apple"}',
    });
  }
  utils.msg(
    i18n.parseSafe("panel.mcitem.astool_tip"),
    i18n.parseSafe("msg.done"),
    "info"
  );
  edit(param).then(([status, item]) => {
    if (status && item) {
      JClipboard.copy(item.toString());
    }
  });
  originSerialized = "";
});

// ──────────────────── 默认导出 ────────────────────

export default {
  edit,
  elements: mcitemPanel,
  unsavedWarnStatus: () => unsavedWarnStatus,
  getCurrentItem: () => currentItem,
  getOriginSerialized: () => originSerialized,
};