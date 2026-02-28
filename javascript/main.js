import titles from "./ui/titles.js";
import i18n from './i18n.js';

await i18n.load("zh_cn");
i18n.refresh();
titles.setTitle();