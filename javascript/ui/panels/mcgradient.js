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
/** 
 * 存储当前的Promise，分别表示 resolve 和 reject
 * 
 * 同时也肩负着会话锁的职责
 * @type {Function[]}
 * */
let promiseCall = null;

// 初始化子编辑器
export const mcgPanel = {
  root: document.getElementById("mcgradient-panel"),
  dialogBtn: {
    cancel: document.getElementById("mcgradient-panel-btn-cancel"),
    confirm: document.getElementById("mcgradient-panel-btn-confirm"),
  },
  editarea: document.getElementById("mcgradient-panel-edit-input"),
  preview: document.getElementById("mcgradient-panel-edit-preview"),
};

export function edit(data = "", color1="#FFF", color2="#000") {
  return new Promise((resolve, reject) => {
    if (promiseCall != null) {
      reject(new Error("已有正在进行的编辑"));
    };
    // 存储数据
    originData = data;
    currentData = data;
    promiseCall = [resolve, reject];
  
    // 显示UI
    mcgPanel.root.showed = true;
  });
};

// 提交渲染
function uploadToRender() {
  currentData = mcgPanel.editarea.value;
  mcgPanel.preview.innerHTML = currentData;
}

// 点击「确认」时判断修改
mcgPanel.dialogBtn.confirm.addEventListener("click", (e) => {
  uploadToRender(); // 更新一次数据
  if (originData === currentData/* 未产生更改，不保存 */) {
    promiseCall[0].apply(this, [[false, originData]]);
    mcgPanel.root.showed = false;
    return;
  };
  promiseCall[0].apply(this, [[true, currentData]]);
});

// 点击「取消」时询问是否要保存
mcgPanel.dialogBtn.cancel.addEventListener("click", (e) => {
  uploadToRender(); // 更新一次数据
  if (
    originData === currentData/* 未产生更改，不询问是否保存 */
    || unsavedWarnStatus >= 0/* 处于二次确认期，允许关闭 */
  ) {
    promiseCall[0].apply(this, [[false, originData]]);
    mcgPanel.root.showed = false;
    return;
  };
  e.stopImmediatePropagation();
  e.preventDefault();
  mcgPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("panel.mcgradient.unsaved");
  unsavedWarnStatus = setTimeout(() => {
    mcgPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("tooltip.cancel");
    unsavedWarnStatus = -1;
  }, 5e3);
});

// 关闭时清理
mcgPanel.root.addEventListener("closed", () => {
  // 清理未保存提示的计时器
  if (unsavedWarnStatus > 0) {
    clearTimeout(unsavedWarnStatus);
    mcgPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("tooltip.cancel");
    unsavedWarnStatus = -1;
  };

  // 清理会话锁
  promiseCall = null;

  // 清理数据
  originData = undefined;
  currentData = undefined;
  mcgPanel.editarea.innerHTML = "";
  mcgPanel.preview.innerHTML = "";
});

export default {
  edit,
}

//debug
edit("1234")