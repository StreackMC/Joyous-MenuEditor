import commands from "../backend/commands.js";
import i18n from "../i18n.js";
import { Editor } from "../editor/editor.js";
import { EditorWelcome } from "../editor/welcome/welcome.js";
import v4 from "../library/uuidjs/v4.js"; const uuidv4 = v4;

const eTabs = document.getElementById("editor-tabs");
const eView = document.getElementById("editor-views");
/**
 * 存储UUID到Tab的关系
 * @type {Map<string,Tab>}
 */
export let tabsMap = new Map();
/**
 * 以序号的形式存储UI上面的 s-tab-item 到 UUID 的关系
 * @type {string}
 */
export let tabs = [];
let currentTab = 0;

export class Tab {
  id = "";
  /**
   * 当前标签页绑定的 Editor 实例
   */
  instance;
  /**
   * 当前标签页按钮的HTML元素
   */
  switcher = {
    root: document.createElement("s-tab-item"),
    content: document.createElement("div"),
    btn: document.createElement("s-icon-button"),
  };
  /**
   * 当前标签页对应的标签页框架
  * @type {Element}
  */
  frame = document.createElement("div");;
  /**
   * 
   * @param {Editor} editorInstance 
   */
  constructor(editorInstance, name, id) {
    this.id = id;
    this.instance = editorInstance;

    // 构建元素
    this.switcher.content.slot = "text";
    this.switcher.content.innerHTML = name;
    this.switcher.btn.innerHTML = '<s-icon name="close"></s-icon>';
    this.frame.classList.add("editor-frame");
    this.frame.dataset.hidden = true;
    this.frame.appendChild(editorInstance.getElement());

    // 添加事件绑定
    this.switcher.root.addEventListener("click", (e)=> {switchTab()})

    // 构建元素结构
    this.switcher.content.appendChild(this.switcher.btn);
    this.switcher.root.appendChild(this.switcher.content);
  };
}

/**
 * 打开一个编辑器，默认使用「欢迎」
 * @param {Editor} editorInstance 编辑器实例
 * @param {string} name 标签页名称
 * @returns {string} Tab实例的UUID
 */
export function openEditor(editorInstance = new EditorWelcome, name = i18n.parseSafe("ui.editor.welcome.headline")) {
  const uuid = uuidv4();
  tabsMap.set(uuid, new Tab(editorInstance, name, uuid));
  tabs.push(uuid);

  // 推送到前端渲染
  eTabs.appendChild(tabsMap.get(uuid).switcher.root);
  eView.appendChild(tabsMap.get(uuid).frame);
  commands.hook(eView);
  i18n.refresh(eView);

  // 完成创建并显示
  switchTab(uuid);
  return uuid;
}

/**
 * 切换到指定标签页，如果标签页不存在抛出错误
 * @param {number|string} index 以 0 开始为索引；使用文本时自动视作UUID
 * @throws 标签页不存在
 */
export function switchTab(index = currentTab) {
  const oldOne = getTab(getCurrentTabId());
  const newOne = getTab(index);

  // 先隐藏旧的
  oldOne.switcher.root.selected = "false";
  oldOne.frame.dataset.hidden = "true";

  // 显示新的
  newOne.switcher.root.selected = "true";
  newOne.frame.dataset.hidden = "false";
};

/**
 * 解析并获取获取 Tab 对象
 * @param {number|string} index 以 0 开始为索引；使用文本时自动视作UUID
 * @throws 标签页不存在
 * @returns {Tab}
 */
export function getTab(index = currentTab) {
  // 解析目标Tab
  if (typeof index === "number" && index >= 0 && index < getTabsLength()) { index = tabs[index]; };
  if (typeof index != "string" || !tabsMap.has(index)) {
    throw new Error(i18n.parseSafe("msg.missing_tab", { index: index }));
  };
  return tabsMap.get(index);
};

/**
 * 获取当前有多少标签页
 * @returns {number}
 */
export function getTabsLength() { return tabs.length; };

/**
 * 获取当前位于哪个标签页
 * @returns {number}
 */
export function getCurrentTabId() { return currentTab; };


/* 注册命令 */
commands.regisiterCommand("editor.open", openEditor);
commands.regisiterCommand("editor.which", () => currentTab);
//commands.regisiterCommand("editor.close", closeEditor);

export default {
  eTabs, eView, openEditor, switchTab, getTab, Tab, tabs, getTabsLength, tabsMap, getCurrentTabId
}