import uiUtils from "./ui/utils.js";
import commands from './backend/commandServer.js'; // 通常情况下建议使用命令系统调用UI/Tabs等功能，会自动处理错误，否则你可能需要自行处理错误
import { regisiteredCommands } from './backend/commandServer.js';
import i18n from './i18n.js';
// 虽然未使用，但需要确保加载
import tabs, { getCurrentTabId, tabsMap } from "./ui/tabs.js";
import command_panel from "./ui/panels/command.js";
import { regEditorsClazz } from "./backend/editorManager.js";
import autosave from "./backend/autosave.js";
import mcText from "./ui/panels/mctext.js";
import mcGradient from './ui/panels/mcgradient.js';
import fileServer from "./backend/fileServer.js";
import fileSidebar from "./ui/fileSidebar.js";

// 加载 versions.json
const response = await fetch('./version.json');
if (!response.ok) {
  putErrorStatusOnLoading("无法加载版本信息文件：" + response.status);
  throw new Error(`HTTP error! status: ${response.status}`);
}
const versionJson = await response.json();

// 判断 Hotkeys-js 是否被加载
if (!hotkeys) {
  putErrorStatusOnLoading("未能加载库 hotkeys-js");
}

// 加载UI和i18n
i18n.refresh();
uiUtils.setTitle();

// 注册前端按钮到命令的映射
commands.hook();

// 版本信息
// todo: 后续分离到 ui/about.js 里面
function versionDialogPopup() {
  const title = i18n.parse("about.title");
  const div = document.createElement("div");
  div.style = `margin: 1.2em .5em 1em .5em;width:max-content;text-wrap: nowrap;`;
  div.innerHTML = `<h2>Details</h2><p>${getVersionInfo().join("\n\n").replace(/\n/g, "<br>")}</p><h2>Functional Tests</h2><iframe src="https://rs.kdxiaoyi.top/api/browser-check" style="height:80%;"/>`;
  customElements.get("s-dialog").builder({ headline: title, view: div });
}
commands.regisiterCommand("version", versionDialogPopup);
commands.regisiterCommand("about", versionDialogPopup);
commands.regisiterCommand("ver", versionDialogPopup);

// 注册自动保存
let autoSaveInterval = setInterval(() => {
  commands.executeCommand("autosave.backup");
}, 60e3);

// 注册版本更新探测
var JME_update = {
  detect: async function (requestParam = new Date().getTime()) {
    if (this.session) { return; };
    // 请求最新的版本配置文件
    this.session = await fetch("./version.json?" + ((requestParam) ? requestParam : "")).then(async (rsp) => {
      const newVersionJson = await rsp.json();
      console.debug("Detecting new version: ", newVersionJson);
      if (newVersionJson.rev == versionJson.rev && newVersionJson.hash != versionJson.hash) {
        // 版本不一致
        console.warn("New version detected: ", newVersionJson, " , compared with ", versionJson);
        clearInterval(JME_update.timer);
        JME_update.timer = -1;
        uiUtils.msg(i18n.parseSafe(
          "about.update.message",
          {
            old: `${versionJson.hash}@${versionJson.ref}`,
            old_time: versionJson.build_time,
            new: `${newVersionJson.hash}@${versionJson.ref}`,
            new_time: newVersionJson.build_time,
          }
        ), i18n.parseSafe("about.update.tooltip"), "info", -1, () => { window.location.reload(); });
      }
    }).catch((e) => {
      console.error("Failed in detecting new version: ", e);
      // 静默处理
    }).finally(() => {
      this.session = null;
    });
  },
  /** 会话锁，保证同一时间只能存在一个请求 */
  session: null,
  /** 检查到更新后就检查了 */
  timer: -1,
};
JME_update.timer = setInterval(JME_update.detect, 60 * 1e3/* 每60秒检查一次 */);
commands.regisiterCommand("version.update", JME_update.detect);
commands.regisiterCommand("version.autoupdate", () => {
  if (JME_update.timer >= 0) {
    return (JME_update.session)
      ? `已启用自动更新检查(#${JME_update.timer})；正在检查更新。`
      : `已启用自动更新检查(#${JME_update.timer})；正等待下次检查。`;
  } else {
    return `已禁用自动更新检查(#${JME_update.timer})。`;
  }
});

// 注册离开提示框
if (!versionJson.debugmode) {
  window.addEventListener('beforeunload', function (e) {
    // 阻止离开
    e.preventDefault();
    e.returnValue = /* 兼容旧浏览器，这里的值在现代浏览器上会被忽略 */'现在离开可能不会保存您的修改';
    // 保存，这里在上下文结尾，就不 catch 了
    commands.executeCommandSlient("autosave.backup");
  });
} else {
  window.addEventListener('beforeunload', function (e) {
    // 保存，这里在上下文结尾，就不 catch 了
    commands.executeCommandSlient("autosave.backup");
  });
};

// 调试信息与模式
/** @returns {string[]} */
export function getVersionInfo() {
  let outputs = [];
  // 一般信息
  outputs.push([
    `Joyous Menu Editor (${i18n.parse("product.name")})`,
    "Copyright (C) 2025-present, StreackMC & kdxiaoyi.",
    "This software is licensed under <a target='_blank' href='https://github.com/StreackMC/Joyous-MenuEditor/'>Apache 2.0</a>."
  ].join("\n"));
  outputs.push([
    `Active Verison: ${versionJson.hash}`,
    `- Branch: ${versionJson.ref}`,
    `- Build Time: ${versionJson.build_time}`,
  ].join("\n"));
  outputs.push([
    `Language Pack: ${i18n.parse("product.i18n_pack.lang")}`,
    `- Description: ${i18n.parse("product.i18n_pack.description")}`,
    `- Author: ${i18n.parse("product.i18n_pack.credits")}`,
  ].join("\n"));

  // 调试信息
  if (versionJson.debugmode) {
    outputs.push("You are running in DEBUG mode. The debug info is listed below.");
    outputs.push([
      "system.time.timestamp= (UTC+0)" + new Date().getTime(),
      "system.time.offest= " + new Date().getTimezoneOffset(),
      "i18n.CurrentTranslation= " + JSON.stringify(i18n.getCurrentTranslations()),
      "commands.regisiteredCommands= " + [...regisiteredCommands.keys()],
      "editorManager.regisiteredEditors= " + [...regEditorsClazz.keys()],
      "tabs.currentTabs= " + getCurrentTabId(),
      "tabs.Tabs.bindmap= " + [...tabsMap.keys()],
      "files.currentFileSystem= " + JSON.stringify(fileServer.currentFileSystem, null, 2),
    ].join("\n"));
  };

  // 返回结果
  return outputs;
}
export function isDebugMode() {
  return versionJson.debugmode;
}

// 测试版提示
uiUtils.msg("当前您正在使用预览版", "好", "warning", -1);