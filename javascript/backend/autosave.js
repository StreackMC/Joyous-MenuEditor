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
    const dataGot = tabInstance.instance.getData();
    if (!dataGot) { return; };
    data.push({
      id: tabInstance.id,
      data: dataGot,
      name: tabInstance.name,
      editor: tabInstance.instance.getRegId(),
    });
  });
  webstorage.Local.set("autosave.data", { e: data });
  webstorage.Local.set("autosave.which", tabs.getCurrentTabId());
  webstorage.Local.set("autosave.untitledCount", editorManager.untitledCounts);
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
    commands.executeCommand("editor.switch"/* switchTab 会发现没有活动标签页，就会自动新建一个 */, 0);
    return;
  };
  // 缓存打开编辑器的函数列表，稍后延后执行。
  /** @type {Function[]} */
  let func = [];
  let which = -1;
  let untitledCount = 1;
  try {
    data.forEach((i) => {// todo 没有错误处理
      const clazz = editorManager.regEditorsClazz.get(i.editor);
      func.push(function () {
        tabs.openTab(
          new clazz(i.data, i.name),
          i.name,
          i.id
        );
      });
    });
    which = webstorage.Local.get("autosave.which");
    untitledCount = Math.floor(webstorage.Local.get("autosave.untitledCount"));
    if (typeof untitledCount != "number" || untitledCount <= 0) { untitledCount = 1; };
  } catch (error) {
    msg(i18n.parseSafe("msg.autosave.fail_recover", { msg: error.message }), i18n.parseSafe("msg.done"), "error", 0);
    console.error("无法恢复工作区：", error);
    commands.executeCommand("editor.switch"/* switchTab 会发现没有活动标签页，就会自动新建一个 */, 0);
    return;
  };

  if (tabs.getTabsLength() >= 2) {
    tabs.closeAllTabs();
  };
  func.shift().apply(this);
  let loopId = setInterval(() => {
    if (func.length == 0) {
      clearInterval(loopId);
      try {
        tabs.switchTab(which);
      } catch (error) {
        console.error("无法恢复工作区原有标签页，使用默认值。");
        tabs.switchTab(0);
      }
      editorManager.untitledCounts = untitledCount;
      return;
    };
    func.shift().apply(this);
  }, 20);
}

commands.regisiterCommand("autosave.backup", backupOpened);
commands.regisiterCommand("autosave.recover", recoverOpened);

export default {
  backupOpened, recoverOpened
}