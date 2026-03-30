import commands from "../backend/commandServer.js";
import i18n from "../i18n.js";
import { Editor } from "../editor/editor.js";
import v4 from "../library/uuidjs/v4.js";
import editorManager from "../backend/editorManager.js";
const uuidv4 = v4;

function newEditorWelcome(...arg) {
  const clazz = editorManager.regEditorsClazz.get("welcome");
  return new clazz(...arg);
}

const eTabs = document.getElementById("editor-tabs");
const eView = document.getElementById("editor-views");
/**
 * 存储UUID到Tab的关系
 * @type {Map<string,Tab>}
 */
export let tabsMap = new Map();
/**
 * 以序号的形式存储UI上面的 s-tab-item 到 UUID 的关系
 * @type {string[]}
 */
export let tabs = [];
let currentTab = 0;

export class Tab {
  /**
   * 标签页标识符
   */
  id = "";
  /**
   * 标签页名字
   */
  name = "";
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
  frame = document.createElement("div");
  /**
   * 
   * @param {Editor} editorInstance 
   */
  constructor(editorInstance, name, id) {
    this.id = id;
    this.instance = editorInstance;
    this.name = name;

    // 构建元素
    this.switcher.root.value = this.id;
    this.switcher.content.slot = "text";
    this.switcher.content.innerHTML = this.name;
    this.switcher.btn.innerHTML = '<s-icon name="close"></s-icon>';
    this.frame.classList.add("editor-frame");
    this.frame.dataset.hidden = "true";
    this.frame.appendChild(this.instance.getElement());

    // 添加事件绑定
    this.switcher.root.addEventListener("click", (e) => {
      e.stopImmediatePropagation();
      commands.executeCommand("editor.switch", this.id);
    });
    this.switcher.btn.addEventListener("click", (e) => {
      e.stopPropagation();
      commands.executeCommand("editor.close", this.id);
    });

    // 构建元素结构
    this.switcher.content.appendChild(this.switcher.btn);
    this.switcher.root.appendChild(this.switcher.content);
  };
}

// 双击标签页切换器的空白区域打开空编辑器
eTabs.addEventListener("dblclick", (e) => {
  if (e.target != eTabs) { return; };
  e.stopPropagation();
  commands.executeCommand("editor.open");
});

/**
 * 打开一个标签页，默认使用「欢迎」
 * @param {Editor} editorInstance 编辑器实例
 * @param {string} name 标签页名称
 * @param {string} uuid Tab的标识符，默认自动设置。不推荐手动覆写
 * @returns {string} Tab实例的UUID
 */
export function openTab(editorInstance = newEditorWelcome(), name = i18n.parseSafe("editor.welcome.headline"), uuid = uuidv4()) {
  if (tabsMap.has(uuid)) { throw new Error("无法新建标签页，发现重复的UUID: ", uuid); };
  tabsMap.set(uuid, new Tab(editorInstance, name, uuid));
  tabs.push(uuid);

  // 推送到前端渲染
  eTabs.appendChild(tabsMap.get(uuid).switcher.root);
  eView.appendChild(tabsMap.get(uuid).frame);
  i18n.refresh(eView);
  commands.hook(eView);

  // 完成创建并显示
  switchTab(uuid);

  // 后初始化
  editorInstance.init();

  try {
    commands.executeCommandSlient("autosave.backup");
  } catch (ignore) { };
  return uuid;
}

/**
 * 关闭全部标签页
 */
export function closeAllTabs() {
  tabs.forEach((id) => { closeTab(id); });
}

/**
 * 关闭指定标签页
 * @param {number|string} index 以 0 开始为索引；使用文本时自动视作UUID
 */
export function closeTab(index = currentTab) {
  let target, origin;
  // 解析并切换到目标标签页
  try {
    origin = tabs[currentTab];
    if (typeof index === "string") {
      if (!tabsMap.has(index) || tabs.indexOf(index) < 0) { throw new Error(); };
      target = index;
    } else {
      if (index < 0 || index >= tabs.length) { throw new Error(); };
      target = tabs[index];
    }
  } catch (error) {
    throw new Error(i18n.parseSafe("msg.missing_tab", { index: index }));
  }
  switchTab(target);

  // 保存数据
  // todo: 需要能够弹出弹窗询问是否保存
  try { commands.executeCommand("editor.save"); } catch (e) { };

  // 先处理动画
  if (target != origin) {
    eTabs.value = origin;
  } else {
    eTabs.value = tabs[getTabsLength() - 1];
  };

  // 销毁标签页
  const targetTab = tabsMap.get(target);
  targetTab.instance.destroy();
  targetTab.switcher.root.remove();
  tabs.splice(tabs.indexOf(target), 1);
  targetTab.frame.remove();
  tabsMap.delete(target);

  // 切换回来
  if (target != origin) {
    switchTab(origin);
  } else {
    switchTab(getTabsLength() - 1);
  };
}

/**
 * 切换到指定标签页，如果标签页不存在抛出错误
 * @param {number|string} index 以 0 开始为索引；使用文本时自动视作UUID
 * @throws 标签页不存在
 */
export function switchTab(index = currentTab) {
  // 不存在活动标签页时创建一个
  if (getTabsLength() == 0) {
    openTab();
    return;
  };

  // 先隐藏旧的
  try {
    const oldOne = getTab(getCurrentTabId());
    oldOne.frame.dataset.hidden = "true";
  } catch (ignore) {
  }

  // 显示新的
  const newOne = getTab(index);
  eTabs.value = newOne.id;
  newOne.frame.dataset.hidden = "false";
  currentTab = tabs.indexOf(newOne.id);
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
  if (typeof index != "number" && !tabsMap.has(index)) {
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
commands.regisiterCommand("editor.openTab", openTab);
commands.regisiterCommandWithHotkey("editor.switch", switchTab, "ctrl+shift+tab");
commands.regisiterCommand("editor.which", getCurrentTabId);
commands.regisiterCommand("editor.howmany", getTabsLength);
commands.regisiterCommandWithHotkey("editor.close", closeTab, "alt+w");
commands.regisiterCommand("editor.closeAll", closeAllTabs);

export default {
  eTabs, eView, openTab, switchTab, getTab, Tab, tabs, getTabsLength, tabsMap, getCurrentTabId, closeAllTabs, closeTab
};