import uiUtils from "./ui/utils.js";
import commands from './backend/commands.js';
import i18n from './i18n.js';

// 判断 Hotkeys-js 是否被加载
if (!hotkeys) {
  putErrorStatusOnLoading("未能加载库 hotkeys-js");
}

// 加载UI和i18n
i18n.refresh();
uiUtils.setTitle();

// 注册前端按钮到命令的映射
document.querySelectorAll("*[data-click]").forEach((e) => {
  e.addEventListener("click", (event) => {
  commands.executeCommand.apply(event, e.dataset.click.split("|"));
  });
})

// 测试版提示
uiUtils.msg("当前您正在使用预览版", "好", "warning", -1);