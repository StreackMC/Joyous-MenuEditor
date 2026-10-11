import commands from "../backend/commandServer.js";
import fileServer, {FileNode, FileSystemEvent, FolderNode, currentFileSystem} from "../backend/fileServer.js";
import i18n from "../i18n.js";
import commandServer from "../backend/commandServer.js";
import UI, { msg } from "./utils.js";
import editorManager from "../backend/editorManager.js";

export const rootEle = document.getElementById("explorer");

// ==================== 渲染状态追踪 ====================

/**
 * 已渲染节点的 DOM 元素映射（nodeId → { item, menu }）。
 * 用于在文件系统变更时精确定位到已渲染的 UI，实现局部增量更新。
 * @type {Map<string, { item: HTMLElement, menu: HTMLElement|null }>}
 */
const renderedNodes = new Map();

/**
 * 已展开的文件夹 nodeId 集合。
 * 仅当文件夹在此集合中时，其子节点变更才会触发局部重绘——避免对未展开的深层子树做无用功。
 * @type {Set<string>}
 */
const expandedFolders = new Set();

/**
 * 左侧栏空状态容器（未打开文件/工作区时显示快捷操作）。
 * @type {HTMLElement|null}
 */
const explorerEmptyEle = document.getElementById("explorer-empty");

/**
 * 刷新左侧栏空状态：没有任何已渲染节点时显示「打开文件 / 打开工作区」按钮。
 */
function updateExplorerEmptyState() {
  if (!explorerEmptyEle) return;
  explorerEmptyEle.hidden = renderedNodes.size > 0;
}

// ==================== 右键菜单（新建文件 / 文件夹、复制 / 剪切 / 粘贴 / 重命名 / 删除） ====================

/** 右键菜单（s-popup-menu）@type {HTMLElement|null} */
const explorerMenu = document.getElementById("explorer-menu");
/** 左侧栏容器（整片区域均可右键）@type {HTMLElement|null} */
const leftSidebarEle = document.getElementById("left-sidebar");
/** 当前右键目标的节点 ID @type {string|null} */
let contextNodeId = null;
/**
 * 剪贴板：记录被复制/剪切的项目，等待粘贴。
 * `mode` 为 "copy" 时粘贴为副本，"cut" 时粘贴为移动。
 * @type {{ node: FileNode|FolderNode, mode: "copy"|"cut" }|null}
 */
let clipboard = null;

/**
 * 在指定坐标打开资源管理器右键菜单。
 * @param {FileNode|FolderNode} node 目标节点
 * @param {number} x
 * @param {number} y
 */
function openExplorerMenu(node, x, y) {
  if (!explorerMenu || !node) return;
  contextNodeId = node.id;
  updateExplorerMenuItems(node);
  // s-popup-menu 支持坐标定位；点击菜单项会自动关闭
  explorerMenu.show({ x, y, origin: "left top" });
}

/** 关闭资源管理器右键菜单。 */
function closeExplorerMenu() {
  if (explorerMenu && typeof explorerMenu.close === "function") {
    try { explorerMenu.close(); } catch (ignore) { }
  }
  contextNodeId = null;
}

/**
 * 右键菜单当前是否已展开。
 * @returns {boolean}
 */
function isExplorerMenuOpen() {
  const popup = explorerMenu?.shadowRoot?.querySelector("s-popup");
  return !!popup && popup.hasAttribute("showed");
}

/**
 * 从右键事件目标解析资源管理器节点。
 * 命中具体条目时返回对应节点，否则回退为工作区根目录（空白区域右键）。
 * @param {EventTarget|null} target
 * @returns {FileNode|FolderNode|null}
 */
function nodeFromEventTarget(target) {
  const item = (target instanceof Element) ? target.closest("s-menu-item[data-nodeid]") : null;
  if (item) {
    const node = fileServer.nodeMap.get(item.dataset.nodeid);
    if (node) return node;
  }
  return currentFileSystem || null;
}

/**
 * 在元素列表中穿透遮罩寻找光标下的资源管理器节点。
 * @param {Element[]} elements
 * @returns {FileNode|FolderNode|null}
 */
function nodeFromElementsPoint(elements) {
  for (const el of elements) {
    if (!(el instanceof Element)) continue;
    const item = el.closest?.("s-menu-item[data-nodeid]");
    if (item) {
      const node = fileServer.nodeMap.get(item.dataset.nodeid);
      if (node) return node;
    }
  }
  return null;
}

// 资源管理器区域右键 → 唤起菜单（含空白区域）；
// 菜单已展开时再次右键 → 抑制系统菜单（并尝试就地重新打开）
document.addEventListener("contextmenu", (e) => {
  const inExplorer = !!leftSidebarEle && e.target instanceof Node && leftSidebarEle.contains(e.target);
  if (inExplorer && !isExplorerMenuOpen()) {
    e.preventDefault();
    openExplorerMenu(nodeFromEventTarget(e.target), e.clientX, e.clientY);
    return;
  }
  if (isExplorerMenuOpen()) {
    // 菜单展开时它自带遮罩层，需统一处理以防弹出系统菜单
    e.preventDefault();
    closeExplorerMenu();
    // 尝试穿透遮罩：若光标仍在资源管理器上，就地重新打开
    const under = document.elementsFromPoint(e.clientX, e.clientY);
    const stillInSidebar = !!leftSidebarEle && under.some((el) => leftSidebarEle.contains(el));
    if (stillInSidebar) {
      const node = nodeFromElementsPoint(under) || currentFileSystem || null;
      // 等待关闭动画结束再打开，避免动画竞态导致 show 被忽略
      const { clientX: x, clientY: y } = e;
      setTimeout(() => openExplorerMenu(node, x, y), 160);
    }
  }
}, true);

/**
 * 依据目标节点与剪贴板状态刷新各菜单项的可见性。
 * - 复制 / 剪切 / 重命名 / 删除：对非根节点可用
 * - 粘贴：仅当目标是文件夹且剪贴板非空时可用
 * @param {FileNode|FolderNode} node
 */
function updateExplorerMenuItems(node) {
  if (!explorerMenu) return;
  const isRoot = !fileServer.getParent(node);
  const targetFolder = node.type === "dir" ? node : fileServer.getParent(node);
  const setVisible = (action, visible) => {
    const item = explorerMenu.querySelector(`s-popup-menu-item[data-action="${action}"]`);
    if (item) item.style.display = visible ? "" : "none";
  };
  setVisible("newfile", !!targetFolder);
  setVisible("newfolder", !!targetFolder);
  setVisible("copy", !isRoot);
  setVisible("cut", !isRoot);
  setVisible("paste", node.type === "dir" && !!clipboard);
  setVisible("rename", !isRoot);
  setVisible("delete", !isRoot);
}

/**
 * 包装 `UI.dialog`：用户点「取消」（Promise 被 reject）时返回 -1，
 * 避免异常冒泡到上层而误报「命令失败」。
 * @param {...*} args 与 `UI.dialog` 相同
 * @returns {Promise<number>} 被点击按钮的索引；取消返回 -1
 */
async function safeDialog(...args) {
  try {
    return await UI.dialog(...args);
  } catch (_) {
    return -1;
  }
}

/**
 * 弹出「重命名」输入对话框。
 * @param {FileNode|FolderNode} node
 * @returns {Promise<string|null>} 新名称；取消或未修改返回 null
 */
async function promptNewName(node) {
  const field = document.createElement("s-text-field");
  field.label = i18n.parseSafe("explorer.rename.label");
  field.value = node.name;
  const choice = await safeDialog(i18n.parseSafe("explorer.action.rename"), field, true, [i18n.parseSafe("tooltip.confirm")]);
  if (choice !== 0) return null;
  const value = String(field.value ?? "").trim();
  if (!value || value === node.name) return null;
  return value;
}

/**
 * 弹出「新建文件」对话框：文件名输入框 + 类型下拉菜单（s-picker）。
 * @returns {Promise<{name: string, editorId: string}|null>}
 */
async function promptNewFile() {
  const field = document.createElement("s-text-field");
  field.label = i18n.parseSafe("explorer.newFile.nameLabel");
  field.value = i18n.parseSafe("explorer.newFile.defaultName");

  const picker = editorManager.buildNewFileTypePicker();

  const wrap = document.createElement("div");
  wrap.style = "display:flex;flex-direction:column;gap:.8em;min-width:16em;padding-top:.4em;";
  wrap.appendChild(field);
  wrap.appendChild(picker);

  const choice = await safeDialog(i18n.parseSafe("explorer.action.newFile"), wrap, true, [i18n.parseSafe("tooltip.confirm")]);
  if (choice !== 0) return null;
  const name = String(field.value ?? "").trim();
  const editorId = picker.value;
  if (!name || !editorId) return null;
  return { name, editorId };
}

/**
 * 弹出「新建文件夹」对话框，用户名输入。
 * @returns {Promise<string|null>}
 */
async function promptNewFolderName() {
  const field = document.createElement("s-text-field");
  field.label = i18n.parseSafe("explorer.newFolder.nameLabel");
  field.value = i18n.parseSafe("explorer.newFolder.defaultName");
  const choice = await safeDialog(i18n.parseSafe("explorer.action.newFolder"), field, true, [i18n.parseSafe("tooltip.confirm")]);
  if (choice !== 0) return null;
  const name = String(field.value ?? "").trim();
  return name || null;
}

/**
 * 解析「新建」操作的应放入的目标文件夹：
 * 右键文件夹则为其自身，右键文件则为其父目录。
 * @param {FileNode|FolderNode} node
 * @returns {FolderNode|null}
 */
function resolveTargetFolder(node) {
  const folder = node.type === "dir" ? node : fileServer.getParent(node);
  return (folder && folder.type === "dir") ? folder : null;
}

/**
 * 执行资源管理器右键菜单动作。
 * @param {"copy"|"cut"|"paste"|"rename"|"delete"} action
 * @param {FileNode|FolderNode} node
 */
async function runExplorerAction(action, node) {
  const name = node.name;
  try {
    switch (action) {
      case "newfile": {
        const folder = resolveTargetFolder(node);
        if (!folder) return;
        const opts = await promptNewFile();
        if (!opts) return;
        await folder.loadChildren();
        if (folder.resolve(opts.name)) {
          msg(i18n.parseSafe("explorer.duplicate", { name: opts.name }), i18n.parseSafe("msg.done"), "warning", 3000);
          return;
        }
        const newNode = await fileServer.createFile(folder, opts.name);
        const newFileFn = editorManager.regEditorNewFile.get(opts.editorId);
        if (typeof newFileFn === "function") await newNode.save(newFileFn());
        await fileServer.openFileInTab(newNode, opts.editorId);
        break;
      }
      case "newfolder": {
        const folder = resolveTargetFolder(node);
        if (!folder) return;
        const name = await promptNewFolderName();
        if (!name) return;
        await folder.loadChildren();
        if (folder.resolve(name)) {
          msg(i18n.parseSafe("explorer.duplicate", { name: name }), i18n.parseSafe("msg.done"), "warning", 3000);
          return;
        }
        await fileServer.createFolder(folder, name);
        break;
      }
      case "copy":
      case "cut": {
        // 只把项目放入剪贴板，真正的复制/移动在「粘贴」时发生
        clipboard = { node, mode: action };
        msg(
          i18n.parseSafe(action === "cut" ? "explorer.done.cut" : "explorer.done.copy", { target: name }),
          i18n.parseSafe("msg.done"), "success", 2000
        );
        break;
      }
      case "paste": {
        if (!clipboard) return;
        const source = clipboard.node;
        // 源可能已被删除/移出工作区
        if (!fileServer.nodeMap.has(source.id)) { clipboard = null; return; }
        if (clipboard.mode === "cut") {
          await fileServer.moveNode(source, node);
          clipboard = null;
          msg(i18n.parseSafe("explorer.done.move", { target: source.name }), i18n.parseSafe("msg.done"), "success", 2000);
        } else {
          await fileServer.copyNode(source, node);
          msg(i18n.parseSafe("explorer.done.paste", { target: source.name }), i18n.parseSafe("msg.done"), "success", 2000);
        }
        break;
      }
      case "rename": {
        const newName = await promptNewName(node);
        if (!newName) return;
        await fileServer.renameNode(node, newName);
        msg(i18n.parseSafe("explorer.done.rename", { target: name }), i18n.parseSafe("msg.done"), "success", 2000);
        break;
      }
      case "delete": {
        const ok = await UI.ask(
          i18n.parseSafe("explorer.action.delete"),
          i18n.parseSafe("explorer.deleteConfirm", { target: name })
        );
        if (!ok) return;
        await fileServer.deleteNode(node, node.type === "dir");
        // 若剪贴板引用的正是被删除的项，清空剪贴板
        if (clipboard && clipboard.node.id === node.id) clipboard = null;
        msg(i18n.parseSafe("explorer.done.delete", { target: name }), i18n.parseSafe("msg.done"), "success", 2000);
        break;
      }
    }
  } catch (error) {
    msg(i18n.parseSafe("msg.command_failure", { msg: error?.message || String(error) }), i18n.parseSafe("msg.done"), "error");
    console.error("资源管理器操作失败：", action, node, error);
  }
}

// 菜单项点击 → 执行动作（s-popup-menu 会自动关闭菜单）
if (explorerMenu) {
  explorerMenu.addEventListener("click", (e) => {
    const item = (e.target instanceof Element) ? e.target.closest("s-popup-menu-item") : null;
    if (!item || !item.dataset.action) return;
    const action = item.dataset.action;
    const nodeId = contextNodeId;
    closeExplorerMenu();
    const node = nodeId ? fileServer.nodeMap.get(nodeId) : undefined;
    if (!node) return;
    runExplorerAction(action, node);
  });
}

// ==================== 与 fileServer 的协作（全事件监听） ====================

/** 取消订阅函数的数组，用于重新初始化时清理旧监听，防止内存泄漏 */
let unsubscribeFns = [];

/**
 * 设置文件系统变更的全量监听器。
 * 每次打开新文件夹时会调用此函数初始化，旧监听器会被自动清理。
 */
function setupEventListeners() {
  // 清理旧监听器，防止重复订阅导致内存泄漏
  for (const fn of unsubscribeFns) fn();
  unsubscribeFns = [];

  // ── 文件系统打开：全量渲染 ──
  unsubscribeFns.push(
    fileServer.onFileSystemChange(FileSystemEvent.OPENED, async () => {
      renderedNodes.clear();
      expandedFolders.clear();
      await node2html(currentFileSystem, rootEle, true);
      updateExplorerEmptyState();
    })
  );

  // ── 文件系统关闭：清空全部 ──
  unsubscribeFns.push(
    fileServer.onFileSystemChange(FileSystemEvent.CLOSED, () => {
      rootEle.innerHTML = "";
      renderedNodes.clear();
      expandedFolders.clear();
      updateExplorerEmptyState();
    })
  );

  // ── 创建（文件/文件夹）：刷新父级视图 ──
  const createHandler = async (_eventType, detail) => {
    await refreshParentAfterChange(detail.parent);
    updateExplorerEmptyState();
  };
  unsubscribeFns.push(
    fileServer.onFileSystemChange(
      [FileSystemEvent.FILE_CREATED, FileSystemEvent.FOLDER_CREATED],
      createHandler
    )
  );

  // ── 删除：清理追踪记录并重绘父级 ──
  unsubscribeFns.push(
    fileServer.onFileSystemChange(FileSystemEvent.DELETED, async (_eventType, detail) => {
      unregisterNode(detail.nodeId);
      await refreshParentAfterChange(detail.parent);
      updateExplorerEmptyState();
    })
  );

  // ── 重命名：重绘父级列表 ──
  unsubscribeFns.push(
    fileServer.onFileSystemChange(FileSystemEvent.RENAMED, (_eventType, detail) => {
      const { parent } = detail;
      if (parent && expandedFolders.has(parent.id)) {
        rerenderFolderChildren(parent);
      }
    })
  );

  // ── 移动：原父级和新父级都需重绘 ──
  unsubscribeFns.push(
    fileServer.onFileSystemChange(FileSystemEvent.MOVED, async (_eventType, detail) => {
      const { oldParent, newParent } = detail;
      await refreshParentAfterChange(oldParent);
      await refreshParentAfterChange(newParent);
    })
  );

  // ── 复制：若目标父级已展开则重绘 ──
  unsubscribeFns.push(
    fileServer.onFileSystemChange(FileSystemEvent.COPIED, async (_eventType, detail) => {
      await refreshParentAfterChange(detail.parent);
    })
  );

  // ── 刷新：重绘对应文件夹 ──
  unsubscribeFns.push(
    fileServer.onFileSystemChange(FileSystemEvent.REFRESHED, (_eventType, detail) => {
      const { node } = detail;
      if (node && expandedFolders.has(node.id)) rerenderFolderChildren(node);
    })
  );

  // ── 结构变更：全量重绘（安全兜底） ──
  unsubscribeFns.push(
    fileServer.onFileSystemChange(FileSystemEvent.STRUCTURE_CHANGED, async () => {
      renderedNodes.clear();
      expandedFolders.clear();
      await node2html(currentFileSystem, rootEle, true);
      updateExplorerEmptyState();
    })
  );
}

// ==================== 节点注册 / 注销（防内存泄漏） ====================

/**
 * 注册一个已渲染节点到追踪系统。
 * @param {string} nodeId
 * @param {HTMLElement} itemEl <s-menu-item> 元素
 * @param {HTMLElement|null} [menuEl] 文件夹的 <s-menu> 子菜单元素
 */
function registerNode(nodeId, itemEl, menuEl = null) {
  renderedNodes.set(nodeId, { item: itemEl, menu: menuEl });
}

/**
 * 从追踪系统中递归注销节点及其所有 DOM 后代的记录。
 * 在节点删除或父级重绘前调用，防止悬挂引用导致内存泄漏。
 * @param {string} nodeId
 */
function unregisterNode(nodeId) {
  const entry = renderedNodes.get(nodeId);
  if (!entry) return;

  // 若为已展开的文件夹，递归清理其所有可见子节点
  if (entry.menu) {
    const childItems = entry.menu.querySelectorAll("s-menu-item[data-nodeid]");
    for (const child of childItems) {
      const childId = child.dataset.nodeid;
      if (childId) {
        renderedNodes.delete(childId);
        expandedFolders.delete(childId);
      }
    }
  }

  renderedNodes.delete(nodeId);
  expandedFolders.delete(nodeId);
}

/**
 * 重新渲染某个文件夹的子节点列表。
 * 仅清理并重绘 <s-menu> 内部，保留文件夹 <s-menu-item> 元素本身及其展开状态。
 * @param {FolderNode} folderNode
 */
async function rerenderFolderChildren(folderNode) {
  const entry = renderedNodes.get(folderNode.id);
  if (!entry || !entry.menu) return;

  const menuEl = entry.menu;

  // 先清理旧子节点的追踪记录，确保无悬挂引用
  const oldItems = menuEl.querySelectorAll("s-menu-item[data-nodeid]");
  for (const item of oldItems) {
    const childId = item.dataset.nodeid;
    if (childId) {
      renderedNodes.delete(childId);
      expandedFolders.delete(childId);
    }
  }

  // 清空 DOM → 旧元素及绑定的事件监听器将随 GC 自动回收
  menuEl.innerHTML = "";
  await node2html(folderNode, menuEl, false);
}

/**
 * 节点增删/移动后刷新受影响父文件夹的视图。
 * 根目录不会被记入 `expandedFolders`，需要整体重绘根列表。
 * @param {FolderNode|undefined} parent
 */
async function refreshParentAfterChange(parent) {
  if (!parent) return;
  const root = currentFileSystem;
  if (root && parent.id === root.id) {
    await rerenderRootList();
  } else if (expandedFolders.has(parent.id)) {
    await rerenderFolderChildren(parent);
  }
}

/**
 * 重绘根目录列表：清空全部已渲染记录后重新绘制。
 */
async function rerenderRootList() {
  renderedNodes.clear();
  expandedFolders.clear();
  await node2html(currentFileSystem, rootEle, true);
}

// ==================== 前端元素绘制 ====================

/**
 * 递归绘制文件树节点到指定父元素。
 * 同时会将每个创建的 DOM 元素注册到 `renderedNodes` 中，
 * 并在展开文件夹时将文件夹 ID 加入 `expandedFolders`。
 * @param {FolderNode|FileNode} node 要绘制的节点
 * @param {HTMLElement} parentElement 父元素
 * @param {boolean} reset 是否重置父元素的内容
 */
async function node2html(node, parentElement = rootEle, reset = false) {
  if (reset) parentElement.innerHTML = "";
  if (node instanceof FolderNode) {
    // 是文件夹需要展开其子节点，所以先分类
    const child_folders = [];
    const child_files = [];
    await node.loadChildren();
    node.children.forEach((v, k) => {
      if (v instanceof FileNode) {
        child_files.push(v);
      } else if (v instanceof FolderNode) {
        child_folders.push(v);
      } else {
        console.warn("未知的子节点：", k, " -> ", v);
      };
    })

    // 接着先绘制文件夹
    const frag = document.createDocumentFragment();
    for (const element of child_folders) {
      // 先创建按钮
      const basebtn = document.createElement("s-menu-item");
      basebtn.innerText = element.name;
      basebtn.dataset.nodeid = element.id;// 声明式，如果后续要迁移到单独逻辑很有帮助
      frag.appendChild(basebtn);

      // 创建子菜单并绑定惰性加载
      const submenu = document.createElement("s-menu");
      submenu.slot = "menu";
      submenu.style.marginLeft = `.5em`;
      submenu.style.marginRight = `2px`;
      basebtn.appendChild(submenu);

      // 注册到渲染追踪系统
      registerNode(element.id, basebtn, submenu);

      basebtn.addEventListener("click", (event) => {
        try {
          const folderNode = fileServer.nodeMap.get(basebtn.dataset.nodeid);
          if (!folderNode) throw new Error("节点已不存在于文件系统中");
          // 标记为已展开，以便后续增量更新
          expandedFolders.add(folderNode.id);
          node2html(folderNode, submenu, true);
        } catch (error) {
          msg(i18n.parseSafe("msg.unable_to_open", { target: basebtn.dataset.nodeid, reason: error.message }), i18n.parseSafe("msg.ok"), "error");
          console.error("无法打开文件夹", basebtn.dataset.nodeid, " : ", error);
        } finally {
          event.stopImmediatePropagation();
        }
      });
    };

    // 再绘制文件
    for (const element of child_files) {
      // 依旧创建按钮
      const basebtn = document.createElement("s-menu-item");
      basebtn.innerText = element.name;
      basebtn.dataset.nodeid = element.id;
      frag.appendChild(basebtn);

      // 注册到渲染追踪系统
      registerNode(element.id, basebtn);

      // 绑定事件
      basebtn.addEventListener("click", (event) => {
        try {
          const fileNode = fileServer.nodeMap.get(basebtn.dataset.nodeid);
          if (fileNode) fileServer.openFileInTab(fileNode);
        } catch (error) {
          msg(i18n.parseSafe("msg.unable_to_open", { target: basebtn.dataset.nodeid, reason: error.message }), i18n.parseSafe("msg.ok"), "error");
          console.error("无法打开文件", basebtn.dataset.nodeid, " : ", error);
        } finally {
          event.stopImmediatePropagation();
        }
      })
    }

    // 结束，插入
    parentElement.appendChild(frag);
  } else if (node instanceof FileNode) {
    // 依旧创建按钮
    const basebtn = document.createElement("s-menu-item");
    basebtn.innerText = node.name;
    basebtn.dataset.nodeid = node.id;
    parentElement.appendChild(basebtn);

    // 注册到渲染追踪系统
    registerNode(node.id, basebtn);

    // 绑定事件
    basebtn.addEventListener("click", (event) => {
      try {
        const fileNode = fileServer.nodeMap.get(basebtn.dataset.nodeid);
        if (fileNode) fileServer.openFileInTab(fileNode);
      } catch (error) {
        msg(i18n.parseSafe("msg.unable_to_open", { target: basebtn.dataset.nodeid, reason: error.message }));
        console.error("无法打开文件", basebtn.dataset.nodeid, " : ", error);
      } finally {
        event.stopImmediatePropagation();
      }
    });
  } else {
    console.error("无法绘制文件结构：未知的文件类型", node);
  }
}

// ==================== 初始化 ====================

// 模块加载时立即注册监听器
setupEventListeners();

// 初始同步一次空状态（未打开工作区时显示快捷操作）
updateExplorerEmptyState();

export default {}