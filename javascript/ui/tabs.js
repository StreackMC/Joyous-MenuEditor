import commands from "../backend/commandServer.js";
import i18n from "../i18n.js";
import { Editor } from "../editor/editor.js";
import v4 from "../library/uuidjs/v4.js";
import UI from "./utils.js";
const uuidv4 = v4;

/*
╔══════════════════════════════════════════════════════════╗
║          标签页 / 编辑器生命周期                          ║
╚══════════════════════════════════════════════════════════╝

### 1. 打开（editorManager.openEditor）
- 数据归一化为 `FileNode | MemFileNode`
- 匹配或强制指定编辑器类型
- `new EditorClass(fileNode, filename)` —— **同步构造**，只存引用
- 调用 `tabs.openTab(instance)`，标签页标题**统一取 `instance.filename`**
  （编辑器不再具备指定标题的能力）

### 2. 挂载（Tab.mount）
- 构建 `switcher`（标签按钮 + 关闭按钮）与 `frame`（容器）
- 将 `instance.getElement()` 挂入 `frame`
- `switcher.root` → `#editor-tabs`，`frame` → `#editor-views`
- `i18n.refresh` / `commands.hook` 做声明式绑定

### 3. 激活 / 失活（Tab.activate / Tab.deactivate）
- `activate()` 显示 frame 并同步 `<s-tab>` 的 `value`
- `deactivate()` 隐藏 frame
- `switchTab(indexOrId)` 负责两者切换并维护 `currentTabIndex`

### 4. 后初始化（Tab.init → instance.init）
- 编辑器在此异步 `await this.fileNode.read()` 并完成渲染
- `openTab` **不等待** `init()` 完成，编辑器自行管理异步流程

### 5. 关闭（tabs.closeTab → Tab.destroy / Tab.unmount）
1. `switchTab(target)` 临时显示目标标签页
2. 保存检查（`requireFlush` 且数据与磁盘不一致时询问）
3. 关闭动画
4. `Tab.destroy()` → `instance.destroy()` 释放定时器 / 监听 / DOM
5. `Tab.unmount()` 移除 DOM
6. 从 `tabs` / `tabsMap` / `tab2File` 中删除
7. 切换回合适的剩余标签页

### 6. 全部关闭（closeAllTabs）
对 `tabs` 的**快照副本**依次执行上述关闭流程，避免边遍历边删除

### 7. 空状态（updateEmptyState）
- 没有任何标签页时，`#editor-empty` 显示 VSCode 风格的空白水印界面
- 在 `openTab` / `closeTab` / `switchTab` 后刷新

## 数据结构

### editorManager.js
* `Map<string, class> regEditorsClazz` —— 编辑器 ID → 构造器
* `Map<string, function> regEditorsVarify` —— 编辑器 ID → 验证函数
  （验证函数返回 `boolean`，仅表示是否接受该文件，不参与标题）

### tabs.js
* `string[] tabs` —— 按标签页顺序存储的 UUID 列表
* `number currentTabIndex` —— 当前活动标签页在 `tabs` 中的下标
* `Map<string, Tab> tabsMap` —— UUID → Tab 实例

#### Tab
* `id`：UUID 标识符
* `name`：标题，**统一取自编辑器文件名**（`instance.filename`）
* `instance`：绑定的 Editor 实例
* `state`：生命周期状态（created / mounted / active / disposed）
* switcher.root: <s-tab-item>  ──► 显示在 #editor-tabs，标签页按钮
* frame: <div class="editor-frame"> ──► 挂在 #editor-views
  * instance.getElement() 返回的 DOM 插入到此 frame 

*/

const eTabs = document.getElementById("editor-tabs");
const eView = document.getElementById("editor-views");
/** 无标签页时的空状态水印容器 */
const eEmpty = document.getElementById("editor-empty");
//const eScroll = eTabs.ShadowRoot.querySelector("div.container");

/**
 * 刷新空状态：仅在没有任何标签页时显示 VSCode 风格的空白水印界面。
 * 在会改变标签页数量或活动页的地方调用。
 */
export function updateEmptyState() {
  if (!eEmpty) return;
  eEmpty.hidden = getTabsLength() > 0;
}

/**
 * 存储标签页 UUID → FileNode 的映射关系。
 * 用于在保存时快速找到对应文件。
 * 由 fileServer.js 通过 bindTabToFile / unbindTab 维护。
 * @type {Map<string, FileNode>}
 */
export const tab2File = new Map();
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
let currentTabIndex = 0;

export class Tab {
  /** 标签页标识符 @type {string} */
  id = "";
  /** 标签页标题（统一取自编辑器文件名）@type {string} */
  name = "";
  /** 绑定的 Editor 实例 @type {Editor} */
  instance;
  /** 生命周期状态：created → mounted → active → disposed @type {string} */
  state = "created";
  /** 标签按钮 @type {{root: Element, content: Element, btn: Element}} */
  switcher = {
    root: document.createElement("s-tab-item"),
    content: document.createElement("div"),
    btn: document.createElement("s-icon-button"),
  };
  /** 标签页框架容器 @type {Element} */
  frame = document.createElement("div");

  /**
   * @param {Editor} editorInstance 编辑器实例（其 `filename` 作为标题）
   * @param {string} id Tab 标识符（UUID）
   */
  constructor(editorInstance, id) {
    this.id = id;
    this.instance = editorInstance;
    // 标题统一来自编辑器文件名
    this.name = editorInstance?.filename ?? "";

    // ── 构建按钮结构与容器 ──
    this.switcher.root.value = this.id;
    this.switcher.content.slot = "text";
    this.switcher.content.innerText = this.name;
    this.switcher.btn.innerHTML = '<s-icon name="close"></s-icon>';
    this.frame.classList.add("editor-frame");
    this.frame.dataset.hidden = "true";
    this.frame.appendChild(this.instance.getElement());

    this.switcher.content.appendChild(this.switcher.btn);
    this.switcher.root.appendChild(this.switcher.content);

    // ── 事件绑定 ──
    this.switcher.root.addEventListener("click", (e) => {
      e.stopImmediatePropagation();
      commands.executeCommand("editor.switch", this.id);
    });
    this.switcher.btn.addEventListener("click", (e) => {
      e.stopPropagation();
      commands.executeCommand("editor.close", this.id);
    });
  }

  // ─────────────────────────────────────────────
  //  生命周期
  // ─────────────────────────────────────────────

  /** 挂载到页面 DOM */
  mount() {
    eTabs.appendChild(this.switcher.root);
    eView.appendChild(this.frame);
    this.state = "mounted";
  }

  /** 从页面 DOM 卸载 */
  unmount() {
    this.switcher.root.remove();
    this.frame.remove();
  }

  /** 激活：显示此标签页并同步 <s-tab> 的 value */
  activate() {
    this.frame.dataset.hidden = "false";
    eTabs.value = this.id;
    this.state = "active";
  }

  /** 失活：隐藏此标签页 */
  deactivate() {
    this.frame.dataset.hidden = "true";
  }

  /** 后初始化：委托给编辑器实例 */
  init() {
    return this.instance.init();
  }

  /** 销毁：先让编辑器清理，再标记状态 */
  destroy() {
    try {
      this.instance.destroy();
    } finally {
      this.state = "disposed";
    }
  }
}

// 双击标签页切换器的空白区域打开新建文件对话框
eTabs.addEventListener("dblclick", (e) => {
  if (e.target != eTabs) { return; };
  e.stopPropagation();
  commands.executeCommand("file.new");
});

// 滚动转为水平
// let rafId = null, pendingScroll = 0;
// eTabs.addEventListener("wheel", (e) => {
//   e.stopImmediatePropagation();
//   e.preventDefault();
//   pendingScroll += e.deltaY + e.deltaX;

//   // 使用 requestAnimationFrame 合并更新，提升性能
//   if (rafId) cancelAnimationFrame(rafId);
//   rafId = requestAnimationFrame(() => {
//     eScroll.scrollLeft += pendingScroll * /* 滚动系数 */0.5;
//     pendingScroll = 0;
//     rafId = null;
//   });
// });

/**
 * 打开一个标签页。
 *
 * 生命周期：创建 Tab → 挂载 → 激活 → 后初始化。
 * 标题**统一取自 `editorInstance.filename`**；编辑器不再具备指定标题的能力。
 *
 * @param {Editor} editorInstance 编辑器实例
 * @param {string} [uuid] Tab 的标识符，默认自动生成。不推荐手动覆写
 * @returns {string|undefined} 新标签页的 UUID；实例无效时返回 undefined
 */
export function openTab(editorInstance, uuid = uuidv4()) {
  if (tabsMap.has(uuid)) { throw new Error(`无法新建标签页，发现重复的UUID: ${uuid}`); };
  if (!editorInstance || !(editorInstance instanceof Editor)) {
    // 发现无效实例，不新建
    return;
  }

  // 标题统一使用文件名；缺失时回退为 Untitled
  if (!editorInstance.filename) {
    editorInstance.filename = "Untitled";
  }

  // ── 创建并登记 ──
  const tab = new Tab(editorInstance, uuid);
  tabsMap.set(uuid, tab);
  tabs.push(uuid);

  // ── 挂载并完成声明式绑定 ──
  tab.mount();
  i18n.refresh(eView);
  commands.hook(eView);

  // ── 激活新标签页 ──
  switchTab(uuid);

  // ── 后初始化（不阻塞）──
  tab.init();

  // ── 更新空状态 ──
  updateEmptyState();

  // ── 自动备份 ──
  try {
    commands.executeCommandSlient("autosave.backup");
  } catch (ignore) { };
  return uuid;
}

/**
 * 关闭全部标签页。注意异步。
 * 遍历 `tabs` 的快照副本，避免边遍历边删除导致遗漏。
 */
export async function closeAllTabs() {
  for (const tabId of [...tabs]) {
    await closeTab(tabId);
  }
}

/**
 * 关闭指定标签页。注意异步。
 *
 * 生命周期收尾：临时切换 → 保存检查 → 关闭动画 → 销毁编辑器 → 卸载 DOM → 清理索引 → 回切。
 * @param {number|string} index 以 0 开始为索引；使用文本时自动视作UUID
 * @throws 标签页不存在
 */
export async function closeTab(index = currentTabIndex) {
  // ── 解析目标标签页与来源标签页 ──
  let target, origin;
  try {
    origin = tabs[currentTabIndex];
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
  const targetTab = tabsMap.get(target);

  // ── 临时切换到目标标签页（保存询问时用户能看到内容）──
  switchTab(target);
  await flushTabBeforeClose(targetTab);

  // ── 关闭动画 ──
  if (target != origin) {
    eTabs.value = origin;
  } else {
    eTabs.value = tabs[getTabsLength() - 1];
  };

  // ── 销毁编辑器并卸载 DOM ──
  targetTab.destroy();
  targetTab.unmount();

  // ── 清理索引 ──
  tabs.splice(tabs.indexOf(target), 1);
  tabsMap.delete(target);
  tab2File.delete(target);

  // ── 回切到合适的标签页 ──
  if (target != origin) {
    switchTab(origin);
  } else {
    switchTab(getTabsLength() - 1);
  };
}

/**
 * 关闭前的保存检查。
 *
 * 仅当编辑器 `requireFlush` 且绑定到文件、且内存数据与磁盘不一致时才询问。
 * @param {Tab} tab
 */
async function flushTabBeforeClose(tab) {
  if (!tab.instance.requireFlush) return;

  const fileNodeOfTheTab = tab2File.get(tab.id);
  if (!fileNodeOfTheTab) {
    // requireFlush 为 true 却找不到文件绑定 → 预期外情况，给出警告
    console.warn("无法为标签页", tab, "找到对应的文件绑定，试图寻找时返回了", fileNodeOfTheTab);
    return;
  }

  // 对比当前编辑器数据和磁盘文件是否一致
  const currentData = tab.instance.getData();
  const diskData = await window.joyous.filesGetData(fileNodeOfTheTab);
  if (currentData === diskData) return;

  // 数据不一样，需要询问是否保存
  const userRsp = await UI.dialog(
    i18n.parseSafe("msg.unsaved.title"),
    i18n.parseSafe("msg.unsaved.tip", { target: window.joyous.filesGetName(fileNodeOfTheTab) }),
    true,
    [i18n.parseSafe("tooltip.nosave"), i18n.parseSafe("tooltip.save")]
  );
  if (userRsp == 1) {
    await commands.executeCommand("files.save");
  }
}

/**
 * 切换到指定标签页，如果标签页不存在抛出错误
 * @param {number|string} index 以 0 开始为索引；使用文本时自动视作UUID
 * @throws 标签页不存在
 */
export function switchTab(index = currentTabIndex) {
  // 无标签页：清空选择并显示空状态（不再自动新建欢迎页）
  if (getTabsLength() == 0) {
    currentTabIndex = -1;
    eTabs.value = "";
    updateEmptyState();
    return;
  };

  // 先失活旧的（可能不存在，忽略）
  try {
    getTab(currentTabIndex).deactivate();
  } catch (ignore) {
  }

  // 再激活新的
  const newOne = getTab(index);
  newOne.activate();
  currentTabIndex = tabs.indexOf(newOne.id);
  updateEmptyState();
};

/**
 * 解析并获取获取 Tab 对象
 * @param {number|string} index 以 0 开始为索引；使用文本时自动视作UUID
 * @throws 标签页不存在
 * @returns {Tab}
 */
export function getTab(index = currentTabIndex) {
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
 * 获取当前活动标签页在 `tabs` 中的下标
 * @returns {number}
 */
export function getCurrentTabIndex() { return currentTabIndex; };

/* 注册命令 */
commands.regisiterCommand("editor.openTab", openTab);
commands.regisiterCommandWithHotkey("editor.switch", switchTab, "ctrl+shift+tab");
commands.regisiterCommand("editor.which", getCurrentTabIndex);
commands.regisiterCommand("editor.howmany", getTabsLength);
commands.regisiterCommandWithHotkey("editor.close", closeTab, "alt+w");
commands.regisiterCommand("editor.closeAll", closeAllTabs);

// 模块加载时同步一次空状态（初始无标签页时显示水印）
updateEmptyState();

export default {
  eTabs, eView, openTab, switchTab, getTab, Tab, tabs, getTabsLength, tabsMap, getCurrentTabIndex, updateEmptyState, closeAllTabs, closeTab
};