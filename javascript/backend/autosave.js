import webstorage from "./webstorage.js";
import tabs from "../ui/tabs.js";
import editorManager from "./editorManager.js";
import { msg } from "../ui/utils.js";
import i18n from "../i18n.js";
import commands from "./commandServer.js";

/** 是否正在恢复中——恢复期间跳过 backup，避免部分恢复的数据覆盖完整备份 */
let _isRecovering = false;

/**
 * 保存编辑器组。
 * 恢复过程中不执行，防止部分恢复的标签页覆盖完整备份数据。
 */
export function backupOpened() {
  if (_isRecovering) return;

  let data = [];
  tabs.tabs.forEach((tabId) => {
    const tabInstance = tabs.getTab(tabId);
    const dataGot = tabInstance.instance.getData();
    // 仅跳过 null/undefined（空字符串 "" 仍然需要保存，防止恢复时空文件丢失）
    if (dataGot === null || dataGot === undefined) { return; }
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

  // 同时持久化文件系统状态
  try {
    commands.executeCommandSlient("files.saveState");
  } catch (e) {
    // 文件系统可能未打开，静默忽略
  }
}

/**
 * 恢复保存的编辑器组，将自动关闭全部活动编辑器。
 * 恢复期间设置 _isRecovering 标志，阻止 backupOpened 覆盖备份数据。
 */
export async function recoverOpened() {
  // 设置恢复标志，防止 openTab 触发的 backupOpened 覆盖完整数据
  _isRecovering = true;

  let data = null;
  try {
    const stored = webstorage.Local.get("autosave.data");
    data = stored ? stored.e : null;
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("无有效的 autosave 数据");
    }
  } catch (error) {
    // 格式无效或无数据，忽略
    console.log("无有效的自动保存记录，自动忽略。", error);
    commands.executeCommand("editor.switch", 0);
    _isRecovering = false;
    return;
  }

  // 缓存打开编辑器的函数列表，稍后延后执行
  /** @type {Function[]} */
  let func = [];
  let which = 0;
  let untitledCount = 1;
  try {
    data.forEach((i) => {
      const clazz = editorManager.regEditorsClazz.get(i.editor);
      if (!clazz) {
        console.warn(`恢复时找不到编辑器类型 "${i.editor}"，跳过标签页 "${i.name}"`);
        return;
      }
      func.push(function () {
        try {
          tabs.openTab(new clazz(i.data, i.name), i.name, i.id);
        } catch (error) {
          console.error(`恢复标签页时遇到错误: `, error, `\n@ processData: `, i);
        }
      });
    });

    const storedWhich = webstorage.Local.get("autosave.which");
    which = (typeof storedWhich === "number" && storedWhich >= 0) ? storedWhich : 0;

    const storedCount = webstorage.Local.get("autosave.untitledCount");
    untitledCount = Math.floor(storedCount);
    if (typeof untitledCount !== "number" || untitledCount <= 0) { untitledCount = 1; }
  } catch (error) {
    msg(i18n.parseSafe("msg.autosave.fail_recover", { msg: error.message }), i18n.parseSafe("msg.done"), "error", 0);
    console.error("无法恢复工作区：", error);
    commands.executeCommand("editor.switch", 0);
    _isRecovering = false;
    return;
  }

  // 先关闭现有标签页（等待关闭完成再恢复，避免竞态）
  if (tabs.getTabsLength() >= 2) {
    await tabs.closeAllTabs();
  }

  // 无恢复数据时也无需继续
  if (func.length === 0) {
    tabs.switchTab(0);
    _isRecovering = false;
    return;
  }

  // 逐个打开恢复的标签页
  func.shift().apply(this);
  let loopId = setInterval(() => {
    if (func.length === 0) {
      clearInterval(loopId);
      try {
        tabs.switchTab(which);
      } catch (error) {
        console.error("无法恢复工作区原有标签页，使用默认值。");
        tabs.switchTab(0);
      }
      editorManager.untitledCounts = untitledCount;
      _isRecovering = false;
      return;
    }
    func.shift().apply(this);
  }, 20);
}

commands.regisiterCommand("autosave.backup", backupOpened);
commands.regisiterCommand("autosave.recover", recoverOpened);

export default {
  backupOpened, recoverOpened
};