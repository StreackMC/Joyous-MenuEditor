import titles from "./ui/titles.js";
import i18n from './i18n.js';
import { currentTranslations } from './i18n.js';

// 加载UI和i18n
await i18n.load("zh_cn");
i18n.refresh();
if (currentTranslations.product) { };
titles.setTitle();

// 加载完毕后移除遮罩
document.getElementById("loading").remove();