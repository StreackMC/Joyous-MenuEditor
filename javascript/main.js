import uiUtils from "./ui/utils.js";
import commands from './backend/commands.js'; // 通常情况下建议使用命令系统调用UI/Tabs等功能，会自动处理错误，否则你可能需要自行处理错误
import i18n from './i18n.js';
// 虽然未使用，但需要确保加载
import command_panel from "./ui/command_panel.js";
import tabs from "./ui/tabs.js";

// 加载 versions.json
const response = await fetch('./version.json');
if (!response.ok) {
  putErrorStatusOnLoading("无法加载版本信息文件："+response.status);
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

// 注册命令面板快捷键
hotkeys("ctrl+shift+p", () => { commands.executeCommand("command.panel.open"); return false; });

// 版本信息
function versionDialogPopup() {
  const title = i18n.parse("ui.about.title");
  const div = document.createElement("div");
  div.style = `margin: 1.2em .5em 1em .5em;width:max-content;`;
  div.innerHTML = 
`${versionJson.hash}@${versionJson.ref} [${versionJson.build_time}]<br>
<br>
Copyright (C) 2025-present, StreackMC & kdxiaoyi.<br>
This software is licensed under <a target='_blank' href='https://github.com/StreackMC/Joyous-MenuEditor/'>Apache 2.0</a>.
`;
  customElements.get("s-dialog").builder({ headline: title, view: div });
}
commands.regisiterCommand("version", versionDialogPopup);
commands.regisiterCommand("about", versionDialogPopup);
commands.regisiterCommand("ver", versionDialogPopup);

// 测试版提示
uiUtils.msg("当前您正在使用预览版", "好", "warning", -1);