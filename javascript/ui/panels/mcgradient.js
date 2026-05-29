import i18n from "../../i18n.js";
import commands from "../../backend/commandServer.js";
import MCColors from "../../library/MCColors.js";
import utils from "../utils.js";
import JClipboard from "../../library/JClipboard.js";

/*
TODO:
1. 添加更多渐变色
2. 优化渐变色按钮展示
3. 将预览区弄成单行的
4. 给三个横向展示的框添加横向滚动
*/

// ======================== 预设渐变配置 ========================
const PRESET_GRADIENTS = [
  { name: "Warm Flame", left: "#ff9a9e", right: "#fad0c4" },
  { name: "Night Fade", left: "#a18cd1", right: "#fbc2eb" },
  { name: "Spring Warmth", left: "#fad0c4", right: "#ffd1ff" },
  { name: "Winter Neva", left: "#a1c4fd", right: "#c2e9fb" },
  { name: "Tempting Azure", left: "#84fab0", right: "#8fd3f4" },
  { name: "Twilight", left: "#4568dc", right: "#b06ab3" },
  { name: "Heavy Rain", left: "#cfd9df", right: "#e2ebf0" },
];

// ======================== 全局状态 ========================
/** 打开编辑器时的原始数据（用于判断是否修改） */
let originData = "";
/** 当前编辑后的最终数据（同步更新，渐变色代码） */
let currentData = "";
/** 未保存警告计时器ID，-1 表示未激活 */
let unsavedWarnTimer = -1;
/** 会话锁：存储当前 Promise 的 resolve/reject */
let activePromise = null;

// ======================== DOM 元素引用 ========================
const elements = {
  root: document.getElementById("mcgradient-panel"),
  dialogBtn: {
    cancel: document.getElementById("mcgradient-panel-btn-cancel"),
    confirm: document.getElementById("mcgradient-panel-btn-confirm"),
  },
  color: {
    leftInput: document.getElementById("mcgradient-panel-color-left"),
    rightInput: document.getElementById("mcgradient-panel-color-right"),
    leftPicker: document.getElementById("mcgradient-panel-color-left-picker"),
    rightPicker: document.getElementById("mcgradient-panel-color-right-picker"),
    swapBtn: document.getElementById("mcgradient-panel-swap-btn"),
    presetWrap: document.getElementById("mcgradient-panel-presets"),
  },
  editarea: document.getElementById("mcgradient-panel-edit-parent"),
  inputbox: document.getElementById("mcgradient-panel-edit-input"),
  preview: document.getElementById("mcgradient-panel-edit-preview"),
  toolbar: document.getElementById("mcgradient-toolbar-n"),
};

// ======================== 工具函数 ========================
/**
 * 将 0~255 数值转换为两位十六进制
 * @param {number} value 0-255
 * @returns {string} 两位十六进制字符串
 */
function toHexChannel(value) {
  const hex = Math.round(value).toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
}

/**
 * 线性插值混合两种颜色
 * @param {string} leftHex 起始颜色（含#）
 * @param {string} rightHex 结束颜色（含#）
 * @param {number} ratio 0~1 之间的比例
 * @returns {string} 混合后的颜色（含#，大写）
 */
function mixColor(leftHex, rightHex, ratio) {
  const left = leftHex.slice(1), right = rightHex.slice(1);
  const r1 = parseInt(left.slice(0, 2), 16), g1 = parseInt(left.slice(2, 4), 16), b1 = parseInt(left.slice(4, 6), 16);
  const r2 = parseInt(right.slice(0, 2), 16), g2 = parseInt(right.slice(2, 4), 16), b2 = parseInt(right.slice(4, 6), 16);
  const r = r1 + (r2 - r1) * ratio;
  const g = g1 + (g2 - g1) * ratio;
  const b = b1 + (b2 - b1) * ratio;
  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`.toUpperCase();
}

/**
 * 根据文本和两端颜色生成渐变色 Minecraft 格式化代码
 * @param {string} originalText 原始文本
 * @param {string} leftHex 左端颜色（含#）
 * @param {string} rightHex 右端颜色（含#）
 * @returns {string} 包含 §#RRGGBB 的格式化字符串
 */
function buildGradientCode(originalText, leftHex, rightHex) {
  if (!originalText) return "";
  // 过滤字符，只允许 k l m n o 和 r 修饰
  let txt = originalText.replace(/§(?:#[0-9a-fA-F]{6}|x(?:§[0-9a-fA-F]){6}|[0-9]|([a-jA-J]|[s-zS-Z]|[pqPQ]))/g, '');
  const chars = Array.from(txt);
  const visibleChars = chars.filter((char, index) => {
    // 跳过§和§转义的字符
    if (char === "") {
      return false;
    } else if (char === "§") {
      return false;
    } else if (index != 0 && txt[index - 1] === "§") {
      return false;
    } else {
      return true;
    }
  });
  const visibleCount = visibleChars.length;
  if (visibleCount === 0) return txt;

  let idx = 0;
  return chars.map((ch, index) => {
    if (
      ch === ""
      || ch === "§"
      || (index != 0 && chars[index - 1] === "§")
    ) return ch;
    const ratio = visibleCount === 1 ? 0 : idx / (visibleCount - 1);
    const color = mixColor(leftHex, rightHex, ratio);
    idx++;
    return `§${color}${ch}`;
  }).join("");
}

/**
 * 从输入框读取颜色并标准化，同时更新颜色选择器的值
 * @param {HTMLInputElement} input 文本输入框
 * @param {HTMLInputElement} picker color 类型输入框
 * @returns {string|null} 标准化后的 HEX 颜色（含#），无效时返回 null
 */
function syncColorFromInput(input, picker) {
  const parsed = MCColors.formatHex(input.value);
  if (parsed) {
    input.classList.remove("invalid");
    picker.value = parsed;
    return parsed;
  } else {
    input.classList.add("invalid");
    return null;
  }
}

/**
 * 设置左右颜色控件的显示值（同步输入框和颜色选择器）
 * @param {string} leftValue 左侧颜色（含#）
 * @param {string} rightValue 右侧颜色（含#）
 */
function setColorFields(leftValue, rightValue) {
  elements.color.leftInput.value = leftValue;
  elements.color.rightInput.value = rightValue;
  const leftHex = MCColors.formatHex(leftValue) ?? "#FFFFFF";
  const rightHex = MCColors.formatHex(rightValue) ?? "#000000";
  elements.color.leftPicker.value = leftHex;
  elements.color.rightPicker.value = rightHex;
  elements.color.leftInput.classList.toggle("invalid", !MCColors.formatHex(leftValue));
  elements.color.rightInput.classList.toggle("invalid", !MCColors.formatHex(rightValue));
}

// ======================== 核心数据更新逻辑 ========================
let previewTimer = null;

/**
 * 同步更新 currentData（立即），并防抖刷新预览 DOM
 * 这是整个面板的数据中枢：所有编辑操作都必须调用此函数
 * @returns {boolean} 会返回当前数据是否有效
 */
function uploadToRender() {
  let status = true;

  // 1. 读取当前颜色（无效颜色则降级为纯文本）
  const leftColor = MCColors.formatHex(elements.color.leftInput.value);
  const rightColor = MCColors.formatHex(elements.color.rightInput.value);
  const rawText = elements.inputbox.value;
  elements.inputbox.style.width = `max(calc(${rawText.length} * 1em + 1em), 100%)`;

  if (leftColor && rightColor) {
    // 有效颜色 -> 生成渐变色代码
    currentData = buildGradientCode(rawText, leftColor, rightColor);
  } else {
    // 颜色无效时，降级为纯文本（去掉所有格式化代码）
    currentData = rawText.replace(/§[0-9a-fk-orA-FK-OR#][0-9a-fA-F]{0,6}/g, "");
    status = false;
  }

  // 2. 防抖更新预览 DOM（仅 UI 延迟，数据已是最新）
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    if (leftColor && rightColor) {
      // 有效颜色
      elements.preview.innerHTML = MCColors.toHtml(currentData);
      elements.preview.classList.toggle("pixel", true);
    } else {
      // 颜色无效时，显示错误
      elements.preview.innerHTML = i18n.parseSafe("panel.mcgradient.onerror.invaild_color");
      elements.preview.classList.toggle("pixel", false);
    }
    previewTimer = null;
  }, 200);

  return status;
}

/**
 * 包装 syncDataAndSchedulePreview，用于事件绑定（保持一致性）
 */
function handleDataChange() {
  uploadToRender();
}

// ======================== 交互事件绑定 ========================
// 颜色输入框失焦时同步颜色选择器并刷新
elements.color.leftInput.addEventListener("focusout", () => {
  syncColorFromInput(elements.color.leftInput, elements.color.leftPicker);
  uploadToRender();
});
elements.color.rightInput.addEventListener("focusout", () => {
  syncColorFromInput(elements.color.rightInput, elements.color.rightPicker);
  uploadToRender();
});

// 颜色选择器直接修改输入框的值
elements.color.leftPicker.addEventListener("input", () => {
  const normalized = elements.color.leftPicker.value.toUpperCase();
  elements.color.leftInput.value = normalized;
  elements.color.leftInput.classList.remove("invalid");
  uploadToRender();
});
elements.color.rightPicker.addEventListener("input", () => {
  const normalized = elements.color.rightPicker.value.toUpperCase();
  elements.color.rightInput.value = normalized;
  elements.color.rightInput.classList.remove("invalid");
  uploadToRender();
});

// 交换左右颜色
function swapColors() {
  const left = elements.color.leftInput.value;
  const right = elements.color.rightInput.value;
  setColorFields(right, left);
  uploadToRender();
}
//elements.color.swapBtn.addEventListener("click", swapColors);

// 文本编辑区域的事件
elements.inputbox.addEventListener("input", handleDataChange);
elements.inputbox.addEventListener("focus", handleDataChange);
elements.inputbox.addEventListener("cut", handleDataChange);
elements.inputbox.addEventListener("paste", handleDataChange);

// 滚动转为水平
[elements.toolbar, elements.color.presetWrap, elements.editarea].forEach((i) => {
  i.addEventListener("wheel", (e) => {
    let rafId = null, pendingScroll = 0;
    e.stopImmediatePropagation();
    e.preventDefault();
    pendingScroll += e.deltaY + e.deltaX;
  
    // 使用 requestAnimationFrame 合并更新，提升性能
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      i.scrollLeft += pendingScroll * /* 滚动系数 */0.5;
      pendingScroll = 0;
      rafId = null;
    });
  });
});

// ======================== 预设按钮生成 ========================
function createPresetButtons() {
  if (!elements.color.presetWrap) return;
  elements.color.presetWrap.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const preset of PRESET_GRADIENTS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mcgradient-preset-btn";
    btn.style = `--c-left:${preset.left};--c-right:${preset.right};`;
    btn.textContent = preset.name;
    btn.title = `${preset.left} → ${preset.right}`;
    btn.addEventListener("click", (e) => {
      if (e.shiftKey) {
        setColorFields(preset.right, preset.left);
      } else {
        setColorFields(preset.left, preset.right);
      }
      uploadToRender();
    });
    fragment.appendChild(btn);
  }
  elements.color.presetWrap.appendChild(fragment);
}

// ======================== 对话框按钮逻辑 ========================
// 确认：返回当前数据（无论是否修改）
elements.dialogBtn.confirm.addEventListener("click", () => {
  // 确保数据最新且有效（以防万一）
  if (!uploadToRender()) {
    return;
  }

  if (activePromise) {
    const resolve = activePromise[0];
    const changed = (originData !== currentData);
    resolve([changed, currentData]);
    activePromise = null;
  }
  elements.root.showed = false;
});

// 取消：如果有未保存修改，显示警告；否则直接关闭
elements.dialogBtn.cancel.addEventListener("click", (e) => {
  uploadToRender();  // 刷新数据，用于比较
  const changed = (originData !== currentData);
  if (!changed || unsavedWarnTimer >= 0) {
    // 无修改，或已处于二次确认期 -> 直接关闭，放弃更改
    if (activePromise) {
      activePromise[0]([false, originData]);
      activePromise = null;
    }
    elements.root.showed = false;
    return;
  }

  // 有未保存修改，显示警告并阻止关闭
  e.stopImmediatePropagation();
  e.preventDefault();
  elements.dialogBtn.cancel.innerHTML = i18n.parseSafe("panel.mcgradient.unsaved");
  unsavedWarnTimer = setTimeout(() => {
    elements.dialogBtn.cancel.innerHTML = i18n.parseSafe("tooltip.cancel");
    unsavedWarnTimer = -1;
  }, 5000);
});

// 面板关闭时清理资源
elements.root.addEventListener("closed", () => {
  if (unsavedWarnTimer >= 0) {
    clearTimeout(unsavedWarnTimer);
    elements.dialogBtn.cancel.innerHTML = i18n.parseSafe("tooltip.cancel");
    unsavedWarnTimer = -1;
  }
  activePromise = null;
  originData = "";
  currentData = "";
  elements.inputbox.value = "";
  elements.preview.innerHTML = "";
});

// ======================== 对外 API ========================
/** 追加文本(本段为AI生成) */
export function insertAtCursor(textToInsert) {
  const textarea = elements.inputbox;
  // 1. 获取当前光标位置
  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;

  // 2. 获取当前文本值
  const oldValue = textarea.value;

  // 3. 在光标位置插入新文本
  const newValue =
    oldValue.substring(0, startPos) +
    textToInsert +
    oldValue.substring(endPos);

  // 4. 更新 textarea 的值
  textarea.value = newValue;

  // 5. 将光标移动到插入文本之后
  const newCursorPos = startPos + textToInsert.length;
  textarea.setSelectionRange(newCursorPos, newCursorPos);
  textarea.focus();
  uploadToRender(); // 触发更新事件
}

/**
 * 切换预览区背景色
 * @param {number} id 背景色编号，从0开始，溢出自动轮换
 */
export function switchPreviewBgColor(id = (elements.preview.dataset.bgId + 1)) {
  id = ((id % BgColors.length) + BgColors.length) % BgColors.length;
  elements.preview.style.backgroundColor = BgColors[id].cssBg;
  elements.preview.dataset.bgId = id;
};
commands.regisiterCommand("panel.mcgradient.color_switch", switchPreviewBgColor);
const BgColors = [
  { cssBg: "transparent"},
  { cssBg: "#fff" },
  { cssBg: "#000" },
];

/**
 * 打开渐变编辑器
 * @param {string} data 初始文本（纯文本或已有 § 代码）
 * @param {string} color1 左端颜色
 * @param {string} color2 右端颜色
 * @returns {Promise<[boolean, string]>} [是否修改, 最终数据]
 */
export function edit(data = "", color1 = PRESET_GRADIENTS[0].left, color2 = PRESET_GRADIENTS[0].right) {
  return new Promise((resolve, reject) => {
    if (activePromise) {
      reject(new Error("已有正在进行的编辑"));
      return;
    }
    originData = data;
    currentData = data;           // 临时值，稍后 sync 会覆盖
    activePromise = [resolve, reject];

    // 设置界面初始值
    elements.inputbox.value = data;
    setColorFields(color1, color2);
    // 立即计算一次 currentData 并显示预览
    uploadToRender();

    elements.root.showed = true;
  });
}

// 注册命令
commands.regisiterCommand("panel.mcgradient.edit", edit);
commands.regisiterCommand("panel.mcgradient.open", (param) => {
  if (!param) param = i18n.parseSafe("panel.mcgradient.default");
  edit(param).then(([changed, data]) => {
    if (changed) {
      JClipboard.copy(data);
    }
  });
  utils.msg(i18n.parseSafe("panel.mcgradient.astool_tip"), i18n.parseSafe("msg.done"), "info");
});
commands.regisiterCommand("panel.mcgradient.color_swap", () => {
  swapColors();
});

// 编辑器工具栏的命令绑定
commands.regisiterCommand("panel.mcgradient.insert.italic", () => { insertAtCursor("§o"); });
commands.regisiterCommand("panel.mcgradient.insert.bold", () => { insertAtCursor("§l"); });
commands.regisiterCommand("panel.mcgradient.insert.underline", () => { insertAtCursor("§n"); });
commands.regisiterCommand("panel.mcgradient.insert.reset", () => { insertAtCursor("§r"); });
commands.regisiterCommand("panel.mcgradient.insert.format_code", () => { insertAtCursor("§"); });

// 初始化预设按钮
createPresetButtons();

export default {
  edit,
  elements,
  unsavedWarnStatus: () => unsavedWarnTimer,
  getData: () => currentData,
  getOriginData: () => originData,
  swapColors,
  setColorFields,
  switchPreviewBgColor,
  insertAtCursor
};