import i18n from "../../i18n.js";
import commands from "../../backend/commandServer.js";
import MCColors from "../../library/MCColors.js";
import utils from "../utils.js";
import JClipboard from "../../library/JClipboard.js";

const PRESET_GRADIENTS = [
  { name: "sunset", left: "#ff7e5f", right: "#feb47b" },
  { name: "ocean", left: "#2193b0", right: "#6dd5ed" },
  { name: "orchid", left: "#8e2de2", right: "#4a00e0" },
  { name: "emerald", left: "#0f9b0f", right: "#a8e063" },
  { name: "fire", left: "#f12711", right: "#f5af19" },
  { name: "twilight", left: "#4568dc", right: "#b06ab3" },
];

const HEX_SHORT = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])?$/;
const HEX_LONG = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/;
const RGB_FUNC = /^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;

let originData = undefined;
let currentData = "";
let unsavedWarnStatus = -1;
let promiseCall = null;
let renderTimeout = null;

export const mcgPanel = {
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
  editarea: document.getElementById("mcgradient-panel-edit-input"),
  preview: document.getElementById("mcgradient-panel-edit-preview"),
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toHexChannel(value) {
  const hex = Number(value).toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
}

function normalizeHex(value) {
  if (typeof value !== "string") return null;
  const trimValue = value.trim();
  const shortMatch = trimValue.match(HEX_SHORT);
  if (shortMatch) {
    const [_, r, g, b] = shortMatch;
    return `#${r.repeat(2)}${g.repeat(2)}${b.repeat(2)}`.toUpperCase();
  }

  const longMatch = trimValue.match(HEX_LONG);
  if (longMatch) {
    return `#${longMatch[1]}`.toUpperCase();
  }

  return null;
}

function normalizeRgb(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(RGB_FUNC);
  if (!match) return null;
  const r = clamp(Number(match[1]), 0, 255);
  const g = clamp(Number(match[2]), 0, 255);
  const b = clamp(Number(match[3]), 0, 255);
  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`.toUpperCase();
}

function parseColor(value) {
  if (value == null) return null;
  const parsedHex = normalizeHex(value);
  if (parsedHex) return parsedHex;
  return normalizeRgb(value);
}

function updateColorInput(input, picker) {
  const parsed = parseColor(input.value);
  if (parsed) {
    input.classList.remove("invalid");
    picker.value = parsed;
  } else {
    input.classList.add("invalid");
  }
  return parsed;
}

function setColorFields(leftValue, rightValue) {
  mcgPanel.color.leftInput.value = leftValue;
  mcgPanel.color.rightInput.value = rightValue;
  const left = parseColor(leftValue) ?? "#FFFFFF";
  const right = parseColor(rightValue) ?? "#000000";
  mcgPanel.color.leftPicker.value = left;
  mcgPanel.color.rightPicker.value = right;
  mcgPanel.color.leftInput.classList.toggle("invalid", !parseColor(leftValue));
  mcgPanel.color.rightInput.classList.toggle("invalid", !parseColor(rightValue));
}

function mixColor(leftHex, rightHex, ratio) {
  const left = leftHex.slice(1);
  const right = rightHex.slice(1);
  const r1 = parseInt(left.slice(0, 2), 16);
  const g1 = parseInt(left.slice(2, 4), 16);
  const b1 = parseInt(left.slice(4, 6), 16);
  const r2 = parseInt(right.slice(0, 2), 16);
  const g2 = parseInt(right.slice(2, 4), 16);
  const b2 = parseInt(right.slice(4, 6), 16);
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`.toUpperCase();
}

function buildGradientCode(text, leftHex, rightHex) {
  if (!text) return "";
  const chars = Array.from(text);
  const visibleCount = chars.filter((ch) => ch !== "").length;
  if (visibleCount === 0) return text;

  let index = 0;
  return chars.map((char) => {
    if (char === "") {
      return char;
    }
    const ratio = visibleCount === 1 ? 0 : index / (visibleCount - 1);
    const color = mixColor(leftHex, rightHex, ratio);
    index += 1;
    return `§#${color}${char}`;
  }).join("");
}

function renderPreview() {
  currentData = mcgPanel.editarea.value;
  const leftColor = updateColorInput(mcgPanel.color.leftInput, mcgPanel.color.leftPicker);
  const rightColor = updateColorInput(mcgPanel.color.rightInput, mcgPanel.color.rightPicker);

  if (!leftColor || !rightColor) {
    mcgPanel.preview.innerHTML = MCColors.toHtml(currentData);
    return;
  }

  const gradientText = buildGradientCode(currentData, leftColor, rightColor);
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    mcgPanel.preview.innerHTML = MCColors.toHtml(gradientText);
    renderTimeout = null;
  }, 200);
}

function uploadToRender() {
  if (renderTimeout) {
    clearTimeout(renderTimeout);
    renderTimeout = null;
  }
  renderPreview();
}

function swapColors() {
  const leftValue = mcgPanel.color.leftInput.value;
  const rightValue = mcgPanel.color.rightInput.value;
  setColorFields(rightValue, leftValue);
  uploadToRender();
}

function createPresetButtons() {
  if (!mcgPanel.color.presetWrap) return;
  PRESET_GRADIENTS.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mcgradient-preset-btn";
    button.textContent = preset.name;
    button.title = `${preset.left} → ${preset.right}`;
    button.addEventListener("click", () => {
      setColorFields(preset.left, preset.right);
      uploadToRender();
    });
    mcgPanel.color.presetWrap.appendChild(button);
  });
}

mcgPanel.color.leftInput.addEventListener("input", () => {
  updateColorInput(mcgPanel.color.leftInput, mcgPanel.color.leftPicker);
  uploadToRender();
});
mcgPanel.color.rightInput.addEventListener("input", () => {
  updateColorInput(mcgPanel.color.rightInput, mcgPanel.color.rightPicker);
  uploadToRender();
});
mcgPanel.color.leftPicker.addEventListener("input", () => {
  const normalized = mcgPanel.color.leftPicker.value.toUpperCase();
  mcgPanel.color.leftInput.value = normalized;
  mcgPanel.color.leftInput.classList.remove("invalid");
  uploadToRender();
});
mcgPanel.color.rightPicker.addEventListener("input", () => {
  const normalized = mcgPanel.color.rightPicker.value.toUpperCase();
  mcgPanel.color.rightInput.value = normalized;
  mcgPanel.color.rightInput.classList.remove("invalid");
  uploadToRender();
});
mcgPanel.color.swapBtn.addEventListener("click", swapColors);
mcgPanel.editarea.addEventListener("input", uploadToRender);
mcgPanel.editarea.addEventListener("focus", uploadToRender);
mcgPanel.editarea.addEventListener("cut", uploadToRender);
mcgPanel.editarea.addEventListener("paste", uploadToRender);

mcgPanel.dialogBtn.confirm.addEventListener("click", () => {
  uploadToRender();
  const resolveFn = promiseCall && promiseCall[0];
  if (originData === currentData) {
    mcgPanel.root.showed = false;
    resolveFn?.apply(this, [[false, originData]]);
    return;
  }
  mcgPanel.root.showed = false;
  resolveFn?.apply(this, [[true, currentData]]);
});

mcgPanel.dialogBtn.cancel.addEventListener("click", (e) => {
  uploadToRender();
  if (
    originData === currentData ||
    unsavedWarnStatus >= 0
  ) {
    promiseCall[0].apply(this, [[false, originData]]);
    mcgPanel.root.showed = false;
    return;
  }

  e.stopImmediatePropagation();
  e.preventDefault();
  mcgPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("panel.mcgradient.unsaved");
  unsavedWarnStatus = setTimeout(() => {
    mcgPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("tooltip.cancel");
    unsavedWarnStatus = -1;
  }, 5000);
});

mcgPanel.root.addEventListener("closed", () => {
  if (unsavedWarnStatus > 0) {
    clearTimeout(unsavedWarnStatus);
    mcgPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("tooltip.cancel");
    unsavedWarnStatus = -1;
  }
  promiseCall = null;
  originData = undefined;
  currentData = undefined;
  mcgPanel.editarea.value = "";
  mcgPanel.preview.innerHTML = "";
});

export function edit(data = "", color1 = "#FFFFFF", color2 = "#000000") {
  return new Promise((resolve, reject) => {
    if (promiseCall != null) {
      reject(new Error("已有正在进行的编辑"));
      return;
    }

    originData = data;
    currentData = data;
    promiseCall = [resolve, reject];

    mcgPanel.editarea.value = data;
    setColorFields(color1, color2);
    mcgPanel.root.showed = true;
    uploadToRender();
  });
}

commands.regisiterCommand("panel.mcgradient.edit", edit);
commands.regisiterCommand("panel.mcgradient.open", (param) => {
  if (!param) { param = i18n.parseSafe("panel.mcgradient.default"); }
  edit(param).then(([status, data]) => {
    if (status) {
      JClipboard.copy(data);
    }
  });
  utils.msg(i18n.parseSafe("panel.mcgradient.astool_tip"), i18n.parseSafe("msg.done"), "info");
  originData = "";
});

createPresetButtons();

export default {
  edit,
  elements: mcgPanel,
  unsavedWarnStatus: () => unsavedWarnStatus,
  getData: () => currentData,
  getOriginData: () => originData,
  swapColors,
  setColorFields,
};
