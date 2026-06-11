import commands from "../backend/commandServer.js";
import i18n from "../i18n.js";
import { Editor } from "../editor/editor.js";
import v4 from "../library/uuidjs/v4.js";
import editorManager from "../backend/editorManager.js";
import UI from "./utils.js";
const uuidv4 = v4;

/*
## 编辑生命周期全流程 （AI生成）
虽然这里不是用来放文档的，但是测试版你先忍忍，正式版再迁移。

### 1. 请求打开编辑器
调用 `commands.executeCommand("editor.open", data, editorId?, filename?)` 或直接 `editorManager.openEditor(data, editorId, fname)`。

- `fname` 默认 `Untitled-N`，用于回退标题。
- 若指定 `editorId` → 强制使用对应注册类；若验证失败则回退 `fname` 作为标题。
- 否则遍历所有已注册编辑器的 `verifyFn(data, fname)`，**第一个返回非空字符串**的编辑器胜出，返回值作为标签标题。
- 无匹配 → 降级使用 `ace` 编辑器（未注册则抛错）。

> 打开编辑器就是「打开数据」，这个过程中包含打开标签页
> 也就是说这个过程自动分配标签页

> 如果不使用 files.open ，就不会绑定有效文件，也就会提示“要保存文件吗”

### 2. 创建标签页与编辑器实例
`tabs.openTab(new EditorClass(data, fname), title)`：

- 生成 UUID，构建 `Tab` 对象：
  - `switcher`（标签按钮 + 关闭按钮）
  - `frame`（容器，初始 `dataset.hidden = "true"`）
  - 将 `editorInstance.getElement()` 挂载到 `frame` 中
- 将 `switcher.root` 追加到 `#editor-tabs`，`frame` 追加到 `#editor-views`
- 调用 `i18n.refresh` 和 `commands.hook` 做声明式绑定
- 调用 `switchTab(uuid)` **显示该标签页**（隐藏当前，显示新 frame）
- 调用 `editorInstance.init()` → 编辑器执行真正的初始化（事件绑定、加载内容等）

> ✅ 此时编辑器已可见且可交互。

### 3. 编辑与保存
- 用户编辑操作由具体编辑器内部处理。
- 保存由外部触发（如快捷键、菜单），调用 `commands.executeCommand("editor.save")`，编辑器需实现 `getData()` 返回当前数据。
- 自动备份通过 `autosave.backup` 命令在打开标签页后触发。

### 4. 关闭标签页（资源清理）
`commands.executeCommand("editor.close", indexOrId)` → `tabs.closeTab`：

1. 切换到目标标签页（临时显示）。
2. 调用 `commands.executeCommand("editor.save")`（可弹出保存确认，目前 todo）。
3. 执行 UI 动画（更新 `<s-tabs>` 的 `value`）。
4. 调用 `targetTab.instance.destroy()` → **编辑器清理自己的定时器、事件监听、DOM 引用等**。
5. 移除 `switcher.root` 和 `frame` 的 DOM 节点。
6. 从 `tabs` 数组和 `tabsMap` 中删除该标签页。
7. 切换回合适的剩余标签页（如原活动页或最后一个）。

### 5. 全局关闭
`closeAllTabs` 遍历所有标签页依次执行上述关闭流程。

## 数据结构

### editorManager.js

* `Map<String,class> regEditorsClazz` 存储编辑器ID和编辑器构造器的映射
* `Map<String,function> regEditorsVarify` 存储编辑器ID和数据验证函数的映射

这两个被 `openEditor` 使用，并用于打开编辑器。接下来会分配标签页

### tabs.js

* `string[] tabs` 当前第几个标签页的标识符
* `number currentTab` 现在是第几个标签页？（配合 tabs 使用）
* `Map<string,Tab> tabsMap` 存储标识符到Tab实例的映射

#### Tab

* id: "uuid-1" 标识符（反向绑定）
* name: "index.html" （标题）
* instance: 绑定到一个Editor实例
* switcher.root: <s-tab-item>  ──► 显示在 #editor-tabs，标签页按钮
* frame: <div class="editor-frame"> ──► 挂在 #editor-views
  * instance.getElement() 返回的 DOM 插入到此 frame 

*/

function newEditorWelcome(...arg) {
  const clazz = editorManager.regEditorsClazz.get("welcome");
  return new clazz(...arg);
}

const eTabs = document.getElementById("editor-tabs");
const eView = document.getElementById("editor-views");
/**
 * 存储标签页 UUID → FileNode 的映射关系。
 * 用于在保存时快速找到对应文件。
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
  if (!editorInstance || !(editorInstance instanceof Editor)) {
    // 发现无效实例，不新建
    return;
  }
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
 * 关闭全部标签页。注意异步。
 */
export async function closeAllTabs() {
  for (const element of tabs) {
    await closeTab(element);
  }
}

/**
 * 关闭指定标签页。注意异步。
 * @param {number|string} index 以 0 开始为索引；使用文本时自动视作UUID
 * @throws
 */
export async function closeTab(index = currentTab) {
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
  const targetTab = tabsMap.get(target);
  switchTab(target);

  // 保存数据
  let fileNodeOfTheTab;
  if (targetTab.instance.requireFlush) {
    fileNodeOfTheTab = tab2File.get(target);
  } else {
    fileNodeOfTheTab = null;
  }
  if (fileNodeOfTheTab) {
    // 对比当前编辑器数据和磁盘文件是否一致
    const currentData = targetTab.instance.getData();
    const diskData = await window.joyous.filesGetData(fileNodeOfTheTab);
    if (currentData !== diskData) {
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
  } else if (targetTab.instance.requireFlush) {
    // requireFlush 为 true 却找不到文件绑定 → 预期外情况，给出警告
    console.warn("无法为标签页", targetTab, "找到对应的文件绑定，试图寻找时返回了", fileNodeOfTheTab);
  }

  // 先处理动画
  if (target != origin) {
    eTabs.value = origin;
  } else {
    eTabs.value = tabs[getTabsLength() - 1];
  };

  // 销毁标签页
  targetTab.instance.destroy();
  targetTab.switcher.root.remove();
  tabs.splice(tabs.indexOf(target), 1);
  targetTab.frame.remove();
  tabsMap.delete(target);
  tab2File.delete(target);

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