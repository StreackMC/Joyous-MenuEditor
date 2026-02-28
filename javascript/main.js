import titles from "./ui/titles.js";
import commands from './backend/commands.js';
import i18n from './i18n.js';

// 加载UI和i18n
i18n.refresh();
titles.setTitle();

// 注册前端按钮到命令的映射
document.querySelectorAll("*[data-click]").forEach((e) => {
  e.addEventListener("click", (event) => {
    commands.executeCommand(e.dataset.click, event);
  });
})