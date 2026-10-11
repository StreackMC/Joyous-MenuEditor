import i18n from "../../i18n.js";
import commands from "../../backend/commandServer.js";
import MCColors from "../../library/MCColors.js";
import utils from "../utils.js";
import JClipboard from "../../library/JClipboard.js";

/*
渐变色编辑器（类 PowerPoint 的多停止点渐变）
------------------------------------------------
- 在一条渐变滑轨上可放置任意数量的**颜色停止点**；
- 相邻停止点之间按所选模式线性插值（RGB / HSV 最短弧）；
- 停止点可用鼠标 / 触屏拖动改变位置，点击滑轨空白处新增，双击或按钮删除。
*/

// ======================== 预设渐变配置 ========================
/** 每个预设为等距分布的若干颜色 */
const PRESET_GRADIENTS = [
  { name: "Warm Flame", colors: ["#ff9a9e", "#fad0c4"] },
  { name: "Night Fade", colors: ["#a18cd1", "#fbc2eb"] },
  { name: "Spring Warmth", colors: ["#fad0c4", "#ffd1ff"] },
  { name: "Winter Neva", colors: ["#a1c4fd", "#c2e9fb"] },
  { name: "Tempting Azure", colors: ["#84fab0", "#8fd3f4"] },
  { name: "Twilight", colors: ["#4568dc", "#b06ab3"] },
  { name: "Heavy Rain", colors: ["#cfd9df", "#e2ebf0"] },
  { name: "Rainbow", colors: ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff"] },
  { name: "Sunset", colors: ["#0b1d51", "#ff7e5f", "#feb47b"] },
  { name: "Ocean", colors: ["#2b5876", "#4e4376", "#8ec5fc"] },
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

/**
 * 颜色停止点列表（按 pos 升序）。
 * @type {{pos:number, color:string}[]}
 */
let stops = [];
/** 当前选中的停止点索引 */
let selectedStop = 0;
/** 插值模式："rgb" | "hsv" */
let mode = "rgb";

// ======================== DOM 元素引用 ========================
const elements = {
  root: document.getElementById("mcgradient-panel"),
  dialogBtn: {
    cancel: document.getElementById("mcgradient-panel-btn-cancel"),
    confirm: document.getElementById("mcgradient-panel-btn-confirm"),
  },
  track: document.getElementById("mcgradient-track"),
  trackStops: document.getElementById("mcgradient-track-stops"),
  stopColorText: document.getElementById("mcgradient-stop-color-text"),
  stopColorPicker: document.getElementById("mcgradient-stop-color-picker"),
  stopAdd: document.getElementById("mcgradient-stop-add"),
  stopRemove: document.getElementById("mcgradient-stop-remove"),
  modeSwitch: document.getElementById("mcgradient-mode"),
  presetWrap: document.getElementById("mcgradient-panel-presets"),
  editarea: document.getElementById("mcgradient-panel-edit-parent"),
  inputbox: document.getElementById("mcgradient-panel-edit-input"),
  preview: document.getElementById("mcgradient-panel-edit-preview"),
  toolbar: document.getElementById("mcgradient-toolbar-n"),
};

// ======================== 颜色工具 ========================

/** 限制到 [0,1] */
function clamp01(v) { return Math.min(1, Math.max(0, v)); }

/**
 * HEX → RGB
 * @param {string} hex 形如 #RRGGBB
 * @returns {[number,number,number]}
 */
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * RGB → HEX（大写，含#）
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
function rgbToHex(r, g, b) {
  return "#" + [r, g, b]
    .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * RGB → HSV（H:0-360, S:0-1, V:0-1）
 * @returns {[number,number,number]}
 */
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

/**
 * HSV → RGB（返回 0-255 三通道）
 * @returns {[number,number,number]}
 */
function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0, gp = 0, bp = 0;
  if (h < 60) { rp = c; gp = x; }
  else if (h < 120) { rp = x; gp = c; }
  else if (h < 180) { gp = c; bp = x; }
  else if (h < 240) { gp = x; bp = c; }
  else if (h < 300) { rp = x; bp = c; }
  else { rp = c; bp = x; }
  return [(rp + m) * 255, (gp + m) * 255, (bp + m) * 255];
}

/**
 * RGB 模式线性插值
 * @param {string} hex1 起始颜色（含#）
 * @param {string} hex2 结束颜色（含#）
 * @param {number} t 0~1
 * @returns {string} 混合后的颜色（含#，大写）
 */
function mixRGB(hex1, hex2, t) {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/**
 * HSV 模式线性插值（色相走最短弧）
 * @param {string} hex1 起始颜色（含#）
 * @param {string} hex2 结束颜色（含#）
 * @param {number} t 0~1
 * @returns {string} 混合后的颜色（含#，大写）
 */
function mixHSV(hex1, hex2, t) {
  const [h1, s1, v1] = rgbToHsv(...hexToRgb(hex1));
  const [h2, s2, v2] = rgbToHsv(...hexToRgb(hex2));
  let dh = h2 - h1;
  if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const [r, g, b] = hsvToRgb(h1 + dh * t, s1 + (s2 - s1) * t, v1 + (v2 - v1) * t);
  return rgbToHex(r, g, b);
}

/**
 * 按当前模式混合两色
 * @param {string} hex1
 * @param {string} hex2
 * @param {number} t
 * @returns {string}
 */
function mix(hex1, hex2, t) {
  return mode === "hsv" ? mixHSV(hex1, hex2, t) : mixRGB(hex1, hex2, t);
}

// ======================== 停止点逻辑 ========================

/**
 * 规范化停止点数组：校验颜色、限制位置、按位置升序。
 * @param {{pos:number,color:string}[]} list
 * @returns {{pos:number,color:string}[]}
 */
function normalizeStops(list) {
  const cleaned = (Array.isArray(list) ? list : [])
    .map((s) => ({
      pos: clamp01(Number(s?.pos) || 0),
      color: MCColors.formatHex(s?.color) || "#FFFFFF",
    }))
    .sort((a, b) => a.pos - b.pos);
  if (cleaned.length === 0) cleaned.push({ pos: 0, color: "#FFFFFF" }, { pos: 1, color: "#000000" });
  else if (cleaned.length === 1) cleaned.push({ pos: clamp01(cleaned[0].pos + 0.001), color: cleaned[0].color });
  return cleaned;
}

/**
 * 由若干颜色构造等距停止点。
 * @param {string[]} colors
 * @returns {{pos:number,color:string}[]}
 */
function stopsFromColors(colors) {
  const n = colors.length;
  return colors.map((c, i) => ({ pos: n === 1 ? 0 : i / (n - 1), color: c }));
}

/**
 * 在位置 t（0~1）处采样颜色。
 * @param {number} t
 * @returns {string} HEX（含#，大写）
 */
function sampleAt(t) {
  if (stops.length === 0) return "#FFFFFF";
  if (t <= stops[0].pos) return stops[0].color;
  const last = stops[stops.length - 1];
  if (t >= last.pos) return last.color;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (t >= a.pos && t <= b.pos) {
      const span = b.pos - a.pos;
      const ratio = span <= 0 ? 0 : (t - a.pos) / span;
      return mix(a.color, b.color, ratio);
    }
  }
  return last.color;
}

/**
 * 根据文本和停止点生成渐变色 Minecraft 格式化代码
 * @param {string} originalText 原始文本
 * @returns {string} 包含 §#RRGGBB 的格式化字符串
 */
function buildGradientCode(originalText) {
  if (!originalText) return "";
  // 过滤字符，只允许旧的格式代码（已带颜色的会被移除）
  const txt = originalText.replace(/§(?:#[0-9a-fA-F]{6}|x(?:§[0-9a-fA-F]){6}|[0-9]|([a-jA-J]|[s-zS-Z]|[pqPQ]))/g, "");
  const chars = Array.from(txt);
  const visibleChars = chars.filter((char, index) => {
    if (char === "") return false;
    else if (char === "§") return false;
    else if (index != 0 && txt[index - 1] === "§") return false;
    else return true;
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
    const color = sampleAt(ratio);
    idx++;
    return `§${color}${ch}`;
  }).join("");
}

// ======================== 渲染 ========================

/**
 * 仅刷新滑轨背景（不重建标记）。
 */
function refreshTrackBackground() {
  if (!elements.track) return;
  // 按当前模式采样多段生成 CSS 渐变，保证与输出一致
  const SAMPLES = 48;
  const parts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    parts.push(`${sampleAt(t)} ${(t * 100).toFixed(2)}%`);
  }
  elements.track.style.backgroundImage = `linear-gradient(to right, ${parts.join(", ")})`;
}

/**
 * 仅刷新标记的选中态（不重建 DOM）。
 */
function updateMarkerSelection() {
  const wrap = elements.trackStops;
  if (!wrap) return;
  [...wrap.children].forEach((m, i) => {
    m.classList.toggle("selected", i === selectedStop);
  });
}

/**
 * 重建停止点标记（仅在停止点数量/顺序变化时调用）。
 */
function renderMarkers() {
  const wrap = elements.trackStops;
  if (!wrap) return;
  wrap.innerHTML = "";
  stops.forEach((stop, i) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "mcgradient-stop" + (i === selectedStop ? " selected" : "");
    marker.style.left = `${stop.pos * 100}%`;
    marker.style.setProperty("--stop-color", stop.color);
    marker.dataset.index = String(i);
    marker.title = `${stop.color} · ${Math.round(stop.pos * 100)}%`;
    marker.addEventListener("pointerdown", onStopPointerDown);
    marker.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeStop(i);
    });
    wrap.appendChild(marker);
  });
}

/**
 * 渲染渐变滑轨（背景 + 停止点标记）。
 */
function renderTrack() {
  refreshTrackBackground();
  renderMarkers();
}

/**
 * 同步选中停止点的颜色输入框显示。
 */
function syncStopColorFields() {
  const stop = stops[selectedStop];
  if (!stop) return;
  const hex = MCColors.formatHex(stop.color) || "#FFFFFF";
  if (elements.stopColorText) {
    elements.stopColorText.value = hex;
    elements.stopColorText.classList.remove("invalid");
  }
  if (elements.stopColorPicker) elements.stopColorPicker.value = hex;
}

// ======================== 停止点交互 ========================

/**
 * 选中指定停止点并同步颜色输入框。
 * @param {number} index
 */
function selectStop(index) {
  if (index < 0 || index >= stops.length) return;
  selectedStop = index;
  syncStopColorFields();
  renderTrack();
}

/**
 * 在指定位置新增停止点（颜色取该处采样值）。
 * @param {number} pos 0~1
 */
function addStopAt(pos) {
  pos = clamp01(pos);
  const color = sampleAt(pos);
  stops.push({ pos, color });
  stops.sort((a, b) => a.pos - b.pos);
  selectedStop = stops.findIndex((s) => s.pos === pos && s.color === color);
  if (selectedStop < 0) selectedStop = 0;
  syncStopColorFields();
  uploadToRender();
}

/**
 * 删除指定停止点（至少保留两个）。
 * @param {number} index
 */
function removeStop(index) {
  if (stops.length <= 2) return;
  stops.splice(index, 1);
  selectedStop = Math.min(selectedStop, stops.length - 1);
  syncStopColorFields();
  uploadToRender();
}

/**
 * 停止点拖动开始（支持鼠标 / 触屏）。
 * @param {PointerEvent} e
 */
function onStopPointerDown(e) {
  e.preventDefault();
  e.stopPropagation();
  const marker = e.currentTarget;
  const index = Number(marker.dataset.index);
  selectedStop = index;
  syncStopColorFields();
  // 仅更新选中态，**不能**重建标记（否则正在拖动的元素会被销毁）
  updateMarkerSelection();

  const rect = elements.trackStops.getBoundingClientRect();
  try { marker.setPointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }

  const onMove = (ev) => {
    const raw = rect.width <= 0 ? 0 : (ev.clientX - rect.left) / rect.width;
    // 不允许越过相邻停止点，保持顺序稳定
    const min = index > 0 ? stops[index - 1].pos + 0.001 : 0;
    const max = index < stops.length - 1 ? stops[index + 1].pos - 0.001 : 1;
    const pos = Math.min(max, Math.max(min, clamp01(raw)));
    stops[index].pos = pos;
    // 直接移动当前标记元素，避免重建导致指针捕获/监听丢失
    marker.style.left = `${pos * 100}%`;
    marker.title = `${stops[index].color} · ${Math.round(pos * 100)}%`;
    refreshTrackBackground();
    updateDataAndPreview();
  };
  const onUp = () => {
    marker.removeEventListener("pointermove", onMove);
    marker.removeEventListener("pointerup", onUp);
    marker.removeEventListener("pointercancel", onUp);
    try { marker.releasePointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
  };
  marker.addEventListener("pointermove", onMove);
  marker.addEventListener("pointerup", onUp);
  marker.addEventListener("pointercancel", onUp);
}

// ======================== 核心数据更新逻辑 ========================
let previewTimer = null;

/**
 * 重新计算 currentData 并防抖刷新预览 DOM（不触碰滑轨标记）。
 * @returns {boolean} 当前数据是否有效
 */
function updateDataAndPreview() {
  let status = true;
  const rawText = elements.inputbox.value;

  const validStops = stops.length >= 2 && stops.every((s) => MCColors.formatHex(s.color));
  if (validStops) {
    currentData = buildGradientCode(rawText);
  } else {
    currentData = rawText.replace(/§[0-9a-fk-orA-FK-OR#][0-9a-fA-F]{0,6}/g, "");
    status = false;
  }

  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    if (validStops) {
      elements.preview.innerHTML = MCColors.toHtml(currentData);
      elements.preview.classList.toggle("pixel", true);
    } else {
      elements.preview.innerHTML = i18n.parseSafe("panel.mcgradient.onerror.invaild_color");
      elements.preview.classList.toggle("pixel", false);
    }
    previewTimer = null;
  }, 200);

  return status;
}

/**
 * 同步更新 currentData（立即），并刷新滑轨与预览 DOM。
 * 这是整个面板的数据中枢：所有编辑操作都必须调用此函数。
 * @returns {boolean} 当前数据是否有效
 */
function uploadToRender() {
  const rawText = elements.inputbox.value;
  elements.inputbox.style.width = `max(calc(${rawText.length} * 1em + 1em), 100%)`;

  const status = updateDataAndPreview();
  refreshTrackBackground();
  renderMarkers();

  return status;
}

// ======================== 事件绑定 ========================

// 停止点颜色输入框
if (elements.stopColorText) {
  elements.stopColorText.addEventListener("focusout", () => {
    const parsed = MCColors.formatHex(elements.stopColorText.value);
    if (parsed && stops[selectedStop]) {
      stops[selectedStop].color = parsed;
      elements.stopColorText.classList.remove("invalid");
      if (elements.stopColorPicker) elements.stopColorPicker.value = parsed;
      uploadToRender();
    } else {
      elements.stopColorText.classList.add("invalid");
    }
  });
  elements.stopColorText.addEventListener("keydown", (e) => {
    if (e.key === "Enter") elements.stopColorText.blur();
  });
}
if (elements.stopColorPicker) {
  elements.stopColorPicker.addEventListener("input", () => {
    if (!stops[selectedStop]) return;
    const hex = elements.stopColorPicker.value.toUpperCase();
    stops[selectedStop].color = hex;
    if (elements.stopColorText) {
      elements.stopColorText.value = hex;
      elements.stopColorText.classList.remove("invalid");
    }
    uploadToRender();
  });
}

// 新增 / 删除停止点
if (elements.stopAdd) {
  elements.stopAdd.addEventListener("click", () => {
    // 在选中点与下一个点之间插入
    const next = stops[selectedStop + 1];
    const cur = stops[selectedStop];
    const pos = next ? (cur.pos + next.pos) / 2 : Math.min(1, cur.pos + 0.1);
    addStopAt(pos);
  });
}
if (elements.stopRemove) {
  elements.stopRemove.addEventListener("click", () => removeStop(selectedStop));
}

// 插值模式切换
if (elements.modeSwitch) {
  elements.modeSwitch.value = mode;
  elements.modeSwitch.addEventListener("change", () => {
    mode = elements.modeSwitch.value === "hsv" ? "hsv" : "rgb";
    uploadToRender();
  });
}

// 点击滑轨空白处新增停止点
if (elements.track) {
  elements.track.addEventListener("click", (e) => {
    if (e.target.closest(".mcgradient-stop")) return;
    const rect = elements.trackStops.getBoundingClientRect();
    if (rect.width <= 0) return;
    addStopAt((e.clientX - rect.left) / rect.width);
  });
}

// 文本编辑区域的事件
elements.inputbox.addEventListener("input", uploadToRender);
elements.inputbox.addEventListener("focus", uploadToRender);
elements.inputbox.addEventListener("cut", uploadToRender);
elements.inputbox.addEventListener("paste", uploadToRender);

// 滚动转为水平
[elements.toolbar, elements.presetWrap, elements.editarea].forEach((i) => {
  if (!i) return;
  i.addEventListener("wheel", (e) => {
    let rafId = null, pendingScroll = 0;
    e.stopImmediatePropagation();
    e.preventDefault();
    pendingScroll += e.deltaY + e.deltaX;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      i.scrollLeft += pendingScroll * 0.5;
      pendingScroll = 0;
      rafId = null;
    });
  });
});

// ======================== 预设按钮生成 ========================
function applyPreset(preset, reversed = false) {
  const colors = reversed ? [...preset.colors].reverse() : preset.colors;
  stops = normalizeStops(stopsFromColors(colors));
  selectedStop = 0;
  syncStopColorFields();
  uploadToRender();
}

function createPresetButtons() {
  if (!elements.presetWrap) return;
  elements.presetWrap.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const preset of PRESET_GRADIENTS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mcgradient-preset-btn";
    const stopsCss = preset.colors.map((c, i) => `${c} ${(i / Math.max(1, preset.colors.length - 1) * 100).toFixed(1)}%`).join(", ");
    btn.style = `--c-left:${preset.colors[0]};--c-right:${preset.colors[preset.colors.length - 1]};background:linear-gradient(to right, ${stopsCss});`;
    btn.textContent = preset.name;
    btn.title = preset.colors.join(" → ");
    btn.addEventListener("click", (e) => applyPreset(preset, e.shiftKey));
    fragment.appendChild(btn);
  }
  elements.presetWrap.appendChild(fragment);
}

// ======================== 对话框按钮逻辑 ========================
elements.dialogBtn.confirm.addEventListener("click", () => {
  if (!uploadToRender()) return;
  if (activePromise) {
    const resolve = activePromise[0];
    const changed = (originData !== currentData);
    resolve([changed, currentData]);
    activePromise = null;
  }
  elements.root.showed = false;
});

elements.dialogBtn.cancel.addEventListener("click", (e) => {
  uploadToRender();
  const changed = (originData !== currentData);
  if (!changed || unsavedWarnTimer >= 0) {
    if (activePromise) {
      activePromise[0]([false, originData]);
      activePromise = null;
    }
    elements.root.showed = false;
    return;
  }

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

/**
 * 在光标处插入文本
 * @param {string} textToInsert
 */
export function insertAtCursor(textToInsert) {
  const textarea = elements.inputbox;
  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;
  const oldValue = textarea.value;

  const newValue = oldValue.substring(0, startPos) + textToInsert + oldValue.substring(endPos);
  textarea.value = newValue;
  const newCursorPos = startPos + textToInsert.length;
  textarea.setSelectionRange(newCursorPos, newCursorPos);
  textarea.focus();
  uploadToRender();
}

/**
 * 切换预览区背景色
 * @param {number} id 背景色编号，从0开始，溢出自动轮换
 */
export function switchPreviewBgColor(id = (elements.preview.dataset.bgId + 1)) {
  id = ((id % BgColors.length) + BgColors.length) % BgColors.length;
  elements.preview.style.backgroundColor = BgColors[id].cssBg;
  elements.preview.dataset.bgId = id;
}
commands.regisiterCommand("panel.mcgradient.color_switch", switchPreviewBgColor);
const BgColors = [
  { cssBg: "transparent" },
  { cssBg: "#fff" },
  { cssBg: "#000" },
];

/**
 * 交换首尾停止点的颜色（保留兼容 API）。
 */
export function swapColors() {
  stops.reverse();
  stops.forEach((s, i) => { s.pos = stops.length === 1 ? 0 : i / (stops.length - 1); });
  selectedStop = 0;
  syncStopColorFields();
  uploadToRender();
}

/**
 * 兼容旧 API：用左右两端颜色重建停止点。
 * @param {string} leftValue
 * @param {string} rightValue
 */
export function setColorFields(leftValue, rightValue) {
  stops = normalizeStops([
    { pos: 0, color: MCColors.formatHex(leftValue) || "#FFFFFF" },
    { pos: 1, color: MCColors.formatHex(rightValue) || "#000000" },
  ]);
  selectedStop = 0;
  syncStopColorFields();
}

/**
 * 设置停止点列表
 * @param {{pos:number,color:string}[]} list
 */
export function setStops(list) {
  stops = normalizeStops(list);
  selectedStop = 0;
  syncStopColorFields();
}

/** 获取当前停止点（副本） */
export function getStops() {
  return stops.map((s) => ({ ...s }));
}

/**
 * 设置插值模式
 * @param {"rgb"|"hsv"} value
 */
export function setMode(value) {
  mode = value === "hsv" ? "hsv" : "rgb";
  if (elements.modeSwitch) elements.modeSwitch.value = mode;
}

/**
 * 打开渐变编辑器
 * @param {string} data 初始文本（纯文本或已有 § 代码）
 * @param {string} [color1] 左端颜色（未提供 stops 时使用）
 * @param {string} [color2] 右端颜色（未提供 stops 时使用）
 * @param {{stops?:{pos:number,color:string}[], mode?:"rgb"|"hsv"}} [options]
 * @returns {Promise<[boolean, string]>} [是否修改, 最终数据]
 */
export function edit(data = "", color1 = PRESET_GRADIENTS[0].colors[0], color2 = PRESET_GRADIENTS[0].colors[1], options = {}) {
  return new Promise((resolve, reject) => {
    if (activePromise) {
      reject(new Error("已有正在进行的编辑"));
      return;
    }
    originData = data;
    currentData = data;
    activePromise = [resolve, reject];

    // 初始化停止点与模式
    setStops(options.stops ?? [
      { pos: 0, color: MCColors.formatHex(color1) || color1 || "#FFFFFF" },
      { pos: 1, color: MCColors.formatHex(color2) || color2 || "#000000" },
    ]);
    setMode(options.mode ?? "rgb");

    elements.inputbox.value = data;
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
commands.regisiterCommand("panel.mcgradient.insert.strikethrough", () => { insertAtCursor("§m"); });
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
  setStops,
  getStops,
  setMode,
  switchPreviewBgColor,
  insertAtCursor
};
