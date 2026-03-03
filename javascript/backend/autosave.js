import webstorage from "./webstorage.js";
import tabs from "../ui/tabs.js";
import editorManager from "./editorManager.js";
import { msg } from "../ui/utils.js";
import i18n from "../i18n.js";
import commands from "./commands.js";

/**
 * 保存编辑器组
 */
export function backupOpened() {
  let data = [];
  tabs.tabs.forEach((tabId) => {
    const tabInstance = tabs.getTab(tabId);
    data.push({
      id: tabInstance.id,
      data: tabInstance.instance.setData(),
      name: tabInstance.name,
      editor: tabInstance.instance.getRegId(),
    });
  });
  webstorage.Local.set("autosave.data", { e: data });
  webstorage.Local.set("autosave.which", tabs.getCurrentTabId());
}

/**
 * 恢复保存的编辑器组，将自动关闭全部活动编辑器
 */
export function recoverOpened() {
  let data = null;
  try {
    data = webstorage.Local.get("autosave.data").e;
    if (!data) { throw new Error("无效的 data ：", data); };
  } catch (error) {
    // 格式无效，忽略
    console.log("无效的保存编辑器记录。自动忽略。", error);
    return;
  };
  // 缓存打开编辑器的函数列表，稍后延后执行。
  /** @type {Function[]} */
  let func = [];
  let which = -1;
  try {
    data.forEach((i) => {
      func.push(function () {
        tabs.openTab(
          new editorManager.regEditorsClazz.get(i.editor)(i.data),
          i.name,
          i.id
        );
      });
    });
    which = webstorage.Local.get("autosave.which");
  } catch (error) {
    msg(i18n.parseSafe("msg.autosave.fail_recover", { msg: error.message }), i18n.parseSafe("msg.okay"), "error", 0);
    console.error("无法恢复工作区：", error);
    return;
  };

  tabs.closeAllTabs();
  let loopId = setInterval(() => {
    func.shift().apply(this);
    if (func.length == 0) { clearTimeout(loopId); };
  }, 1000);
  tabs.closeTab(0);
  tabs.switchTab(which);
}

commands.regisiterCommand("autosave.backup", backupOpened);
commands.regisiterCommand("autosave.recover", recoverOpened);

export default {
  backupOpened, recoverOpened
}