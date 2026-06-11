import commands from "../backend/commandServer.js";
import fileServer, {FileNode, FileSystemEvent, FolderNode} from "../backend/fileServer.js";
import i18n from "../i18n.js";
import commandServer from "../backend/commandServer.js";
import { msg } from "./utils.js";

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
    fileServer.onFileSystemChange(FileSystemEvent.OPENED, () => {
      renderedNodes.clear();
      expandedFolders.clear();
      node2html(fileServer.resolvePath(), rootEle, true);
    })
  );

  // ── 文件系统关闭：清空全部 ──
  unsubscribeFns.push(
    fileServer.onFileSystemChange(FileSystemEvent.CLOSED, () => {
      rootEle.innerHTML = "";
      renderedNodes.clear();
      expandedFolders.clear();
    })
  );

  // ── 创建（文件/文件夹）：若父级已展开则局部重绘 ──
  const createHandler = (_eventType, detail) => {
    const { parent } = detail;
    if (parent && expandedFolders.has(parent.id)) {
      rerenderFolderChildren(parent);
    }
  };
  unsubscribeFns.push(
    fileServer.onFileSystemChange(
      [FileSystemEvent.FILE_CREATED, FileSystemEvent.FOLDER_CREATED],
      createHandler
    )
  );

  // ── 删除：清理追踪记录并重绘父级 ──
  unsubscribeFns.push(
    fileServer.onFileSystemChange(FileSystemEvent.DELETED, (_eventType, detail) => {
      unregisterNode(detail.nodeId);
      const { parent } = detail;
      if (parent && expandedFolders.has(parent.id)) {
        rerenderFolderChildren(parent);
      }
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
    fileServer.onFileSystemChange(FileSystemEvent.MOVED, (_eventType, detail) => {
      const { oldParent, newParent } = detail;
      if (oldParent && expandedFolders.has(oldParent.id)) rerenderFolderChildren(oldParent);
      if (newParent && expandedFolders.has(newParent.id)) rerenderFolderChildren(newParent);
    })
  );

  // ── 复制：若目标父级已展开则重绘 ──
  unsubscribeFns.push(
    fileServer.onFileSystemChange(FileSystemEvent.COPIED, (_eventType, detail) => {
      const { parent } = detail;
      if (parent && expandedFolders.has(parent.id)) rerenderFolderChildren(parent);
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
    fileServer.onFileSystemChange(FileSystemEvent.STRUCTURE_CHANGED, () => {
      renderedNodes.clear();
      expandedFolders.clear();
      node2html(fileServer.resolvePath(), rootEle, true);
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

export default {}