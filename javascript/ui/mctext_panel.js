import i18n from "../i18n.js";
import commands from "../backend/commands.js";

let originData = undefined;
let currentData = "";
/** 存储当前是否处于未保存的二次确认期：负数为不处于；正数为计时器的id */
let unsavedWarnStatus = -1;
let callbackFunc = (data) => { };

// 初始化子编辑器
export const mctPanel = {
  root: document.getElementById("mctext-panel"),
  dialogBtn: {
    cancel: document.getElementById("mctext-panel-btn-cancel"),
    confirm: document.getElementById("mctext-panel-btn-confirm"),
  },
};

// 点击「取消」时询问是否要保存
mctPanel.dialogBtn.cancel.addEventListener("click", (e) => {
  if (
    originData === currentData/* 未产生更改，不询问是否保存 */
    || unsavedWarnStatus > 0/* 处于二次确认期，允许关闭 */
  ) { return; };
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
  };
  // 清理数据
  originData = undefined;
  currentData = undefined;
});

/**
 * 打开一个 MC文本组件 子编辑器
 * @param {String} data 原文本
 * @param {function(data)} callback 回调函数
 */
export function edit(data = "", callback = function (data) { }) {
  if (mctPanel.root.showed == "true") {
    throw new Error("已有正在进行的编辑");
  };
  mctPanel.root.showed = true;
  originData = data;
  currentData = data;
  callbackFunc = callback;
};
commands.regisiterCommand("editor.sub.mctext", edit);

//edit(); //debug usage!!!!!

export default {
  edit, elements: mctPanel,
  unsavedWarnStatus: () => unsavedWarnStatus,
  getData: () => currentData,
  getOriginData: () => originData,
};