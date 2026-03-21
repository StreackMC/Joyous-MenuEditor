import i18n from "../../i18n.js";
import commands from "../../backend/commandServer.js";
import MCColors from "../../library/MCColors.js";
import utils from "../utils.js";
import JClipboard from "../../library/JClipboard.js";

/** 匹配复杂转义的& */
const codeReg = /(?<!(?<!\\)\\(?:\\{2})*)&/g;
let originData = undefined;
let currentData = "";
/** 存储当前是否处于未保存的二次确认期：负数为不处于；正数为计时器的id */
let unsavedWarnStatus = -1;
/** @type {Function[]} 存储当前的Promise，分别表示 resolve 和 reject */
let promiseCall = null;

// 初始化子编辑器
export const mctPanel = {
  root: document.getElementById("mctext-panel"),
  dialogBtn: {
    cancel: document.getElementById("mctext-panel-btn-cancel"),
    confirm: document.getElementById("mctext-panel-btn-confirm"),
  },
  toolbar: {
    root: document.getElementById("mctext-toolbar"),
    scroll: document.getElementById("mctext-toolbar").firstElementChild,
  },
  view: {
    editor: document.getElementById("mctext-edit"),
    preview: document.getElementById("mctext-preview"),
  }
};

// 滚动转为水平
let rafId = null, pendingScroll = 0;
mctPanel.toolbar.root.addEventListener("wheel", (e) => {
  e.stopImmediatePropagation();
  e.preventDefault();
  pendingScroll += e.deltaY + e.deltaX;

  // 使用 requestAnimationFrame 合并更新，提升性能
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    mctPanel.toolbar.scroll.scrollLeft += pendingScroll * /* 滚动系数 */0.5;
    pendingScroll = 0;
    rafId = null;
  });
});

// 自适应高度
let renderTimeout = null;
/**
 * 计划渲染 textarea 中的文本，并立即更新 textarea 的高度
 */
function uploadToRender() {
  // 计划渲染，以免卡顿
  currentData = mctPanel.view.editor.value.replace(codeReg, "§");
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    mctPanel.view.preview.innerHTML = MCColors.toHtml(currentData);
    renderTimeout = null;
  }, 200);

  // 计算自适应高度
  mctPanel.view.editor.style.height = `inherit`;
  const viewHeight = mctPanel.view.preview.offsetHeight;
  const editorHeight = mctPanel.view.editor.scrollHeight;
  const finalHeight = /* 取最高的那个 */(viewHeight >= editorHeight) ? viewHeight : editorHeight;
  mctPanel.view.editor.style.height = `${7 + finalHeight}px`;
};

// 绑定事件
mctPanel.view.editor.addEventListener("input", uploadToRender);
mctPanel.view.editor.addEventListener("focus", uploadToRender);
mctPanel.view.editor.addEventListener("cut", uploadToRender);
mctPanel.view.editor.addEventListener("paste", uploadToRender);

// 水平进度同步
/** 防止循环触发 */
let isSyncing = false;
mctPanel.view.editor.addEventListener('scroll', () => {
  if (!isSyncing) {
    isSyncing = true;
    // 计算编辑区滚动百分比
    const percent = mctPanel.view.editor.scrollLeft / (mctPanel.view.editor.scrollWidth - mctPanel.view.editor.clientWidth);
    // 设置预览区滚动位置
    mctPanel.view.preview.scrollLeft = percent * (mctPanel.view.preview.scrollWidth - mctPanel.view.preview.clientWidth);
    isSyncing = false;
  }
});
mctPanel.view.preview.addEventListener('scroll', () => {
  if (!isSyncing) {
    isSyncing = true;
    const percent = mctPanel.view.preview.scrollLeft / (mctPanel.view.preview.scrollWidth - mctPanel.view.preview.clientWidth);
    mctPanel.view.editor.scrollLeft = percent * (mctPanel.view.editor.scrollWidth - mctPanel.view.editor.clientWidth);
    isSyncing = false;
  }
});

// 点击「确认」时判断修改
mctPanel.dialogBtn.confirm.addEventListener("click", (e) => {
  uploadToRender(); // 更新一次数据
  if (originData === currentData/* 未产生更改，不保存 */) {
    promiseCall[0].apply(this, [[false, originData]]);
    return;
  };
  promiseCall[0].apply(this, [[true, currentData]]);
});

// 点击「取消」时询问是否要保存
mctPanel.dialogBtn.cancel.addEventListener("click", (e) => {
  uploadToRender(); // 更新一次数据
  if (
    originData === currentData/* 未产生更改，不询问是否保存 */
    || unsavedWarnStatus > 0/* 处于二次确认期，允许关闭 */
  ) {
    promiseCall[0].apply(this, [[false, originData]]);
    return;
  };
  e.stopImmediatePropagation();
  e.preventDefault();
  mctPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("panel.mctext.unsaved");
  unsavedWarnStatus = setTimeout(() => {
    mctPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("tooltip.cancel");
    unsavedWarnStatus = -1;
  }, 5e3);
});

// 关闭时清理
mctPanel.root.addEventListener("closed", () => {
  // 清理未保存提示的计时器
  if (unsavedWarnStatus > 0) {
    clearTimeout(unsavedWarnStatus);
    mctPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("tooltip.cancel");
    unsavedWarnStatus = -1;
    promiseCall = null;
  };
  // 清理数据
  originData = undefined;
  currentData = undefined;
  mctPanel.view.editor.innerHTML = "";
  mctPanel.view.preview.innerHTML = "";
});

// 编辑器工具栏的命令绑定
commands.regisiterCommand("panel.mctext.insert.italic", () => { insertAtCursor("§o"); });
commands.regisiterCommand("panel.mctext.insert.bold", () => { insertAtCursor("§l"); });
commands.regisiterCommand("panel.mctext.insert.underline", () => { insertAtCursor("§n"); });
commands.regisiterCommand("panel.mctext.insert.reset", () => { insertAtCursor("§r"); });
commands.regisiterCommand("panel.mctext.insert.format_code", () => { insertAtCursor("§"); });

// 插入颜色（未实现）
// commands.regisiterCommand("panel.mctext.insert.color.a", () => { insertAtCursor("§a"); });
// commands.regisiterCommand("panel.mctext.insert.color.b", () => { insertAtCursor("§b"); });
// commands.regisiterCommand("panel.mctext.insert.color.c", () => { insertAtCursor("§c"); });
// commands.regisiterCommand("panel.mctext.insert.color.d", () => { insertAtCursor("§d"); });
// commands.regisiterCommand("panel.mctext.insert.color.e", () => { insertAtCursor("§e"); });
// commands.regisiterCommand("panel.mctext.insert.color.f", () => { insertAtCursor("§f"); });

// --- EXPORTS ---
/** 追加文本(本段为AI生成) */
export function insertAtCursor(textToInsert) {
  const textarea = mctPanel.view.editor;
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
 * 打开一个 MC文本组件 子编辑器
 * @param {String} data 原文本
 * @returns {Promise} 返回一个异步 Promise ，含有数据 [status, data] :
 * * {boolean} status 是否产生了修改
 * * {string} data 最终数据
 * @throws 已有正在进行的编辑
 */
export function edit(data = "") {
  return new Promise((resolve, reject) => {
    if (promiseCall != null) {
      reject(new Error("已有正在进行的编辑"));
    };
    // 存储数据
    originData = data;
    currentData = data;
    promiseCall = [resolve, reject];
  
    // 显示UI
    mctPanel.view.editor.textContent = data;
    mctPanel.root.showed = true;
    uploadToRender();
  });
};
commands.regisiterCommand("panel.mctext.edit", edit);
commands.regisiterCommand("panel.mctext.open", (param) => {
  // 打开一个面板，行为是自动复制结果
  if (!param) { param = i18n.parseSafe("panel.mctext.default"); };
  edit(param).then(([status, data]) => {
    if (status) {
      JClipboard.copy(data);
    };
  });
  utils.msg(i18n.parseSafe("panel.mctext.astool_tip"), i18n.parseSafe("msg.done"), "info");
  originData = "";
});

/**
 * 切换预览区背景色
 * @param {number} id 背景色编号，从0开始，溢出自动轮换
 */
export function switchPreviewBgColor(id = (mctPanel.view.preview.dataset.bgId + 1)) {
  id = ((id % BgColors.length) + BgColors.length) % BgColors.length;
  mctPanel.view.preview.style.backgroundColor = BgColors[id].cssBg;
  mctPanel.view.preview.dataset.bgId = id;
};
commands.regisiterCommand("panel.mctext.color_switch", switchPreviewBgColor);
const BgColors = [
  { cssBg: "var(--s-color-surface-container-high, #E7E8EA)"},
  { cssBg: "#fff" },
  { cssBg: "#000" },
];

export default {
  edit, elements: mctPanel,
  unsavedWarnStatus: () => unsavedWarnStatus,
  getData: () => currentData,
  getOriginData: () => originData,
  insertAtCursor,
  switchPreviewBgColor,
};