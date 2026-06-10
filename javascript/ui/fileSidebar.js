import commands from "../backend/commandServer.js";
import {
  currentFileSystem,
  FileNode,
  FolderNode,
  FileSystemEvent,
  onFileSystemChange,
  offFileSystemChange,
  resolvePath,
  getNodePath,
  getParent,
  getAncestors,
  getNodeById,
  nodeMap,
} from "../backend/fileServer.js";
import i18n from "../i18n.js";

// ==================== 前端刷新订阅机制 ====================

/**
 * 侧栏绘制回调集合。
 * UI 组件（如文件树渲染器）通过 {@link onSidebarRefresh} 注册回调，
 * 当文件系统发生任何变更时，这些回调会被依次调用。
 * @type {Set<Function>}
 */
const refreshCallbacks = new Set();

/**
 * 注册一个侧栏刷新回调。当文件系统树发生变更时会被调用。
 * 回调签名: `(payload: FileSystemPayload) => void`
 *
 * @param {Function} callback 接收一个 payload 对象
 * @returns {Function} 取消注册的函数
 */
export function onSidebarRefresh(callback) {
  refreshCallbacks.add(callback);
  return () => refreshCallbacks.delete(callback);
}

/**
 * 取消注册侧栏刷新回调
 * @param {Function} callback
 */
export function offSidebarRefresh(callback) {
  refreshCallbacks.delete(callback);
}

/**
 * 主动通知所有侧栏回调进行刷新
 * @param {Object} [payload={}] 可选的负载信息
 */
function notifySidebarRefresh(payload = {}) {
  for (const cb of refreshCallbacks) {
    try {
      cb(payload);
    } catch (e) {
      console.warn("侧栏刷新回调出错：", e);
    }
  }
}

// ==================== 事件到刷新的桥接 ====================

/**
 * 将来自 fileServer 的文件系统变更事件转化为侧栏刷新通知。
 * 防抖：短时间内多次变更合并为一次刷新。
 * @type {ReturnType<typeof setTimeout>|null}
 */
let refreshDebounceTimer = null;
const REFRESH_DEBOUNCE_MS = 50;

/**
 * 防抖的刷新调度
 * @param {string} eventType
 * @param {Object} detail
 */
function scheduleRefresh(eventType, detail) {
  if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
  refreshDebounceTimer = setTimeout(() => {
    refreshDebounceTimer = null;
    notifySidebarRefresh({ eventType, ...detail, fileSystemReady: !!currentFileSystem });
  }, REFRESH_DEBOUNCE_MS);
}

// 订阅全部文件系统事件
const unsubscribeAll = onFileSystemChange("*", (eventType, detail) => {
  scheduleRefresh(eventType, detail);
});

// ==================== 前端查询接口 ====================

/**
 * 获取当前文件系统的根节点
 * @returns {FolderNode|null}
 */
export function getRoot() {
  return currentFileSystem;
}

/**
 * 判断文件系统是否已打开
 * @returns {boolean}
 */
export function isFileSystemOpen() {
  return currentFileSystem !== null;
}

/**
 * 获取指定文件夹的直接子节点列表（按名称排序）
 * @param {string|FolderNode} folder 路径字符串或 FolderNode 实例
 * @returns {Promise<Array<{node: FileNode|FolderNode, path: string}>>}
 */
export async function listDirectory(folder = currentFileSystem) {
  const folderNode = typeof folder === "string" ? resolvePath(folder) : folder;
  if (!folderNode || folderNode.type !== "dir") return [];

  await folderNode.loadChildren();
  const entries = [];
  for (const child of folderNode.children.values()) {
    entries.push({
      node: child,
      path: getNodePath(child),
    });
  }
  // 文件夹在前，按名称排序
  entries.sort((a, b) => {
    if (a.node.type !== b.node.type) {
      return a.node.type === "dir" ? -1 : 1;
    }
    return a.node.name.localeCompare(b.node.name);
  });
  return entries;
}

/**
 * 获取文件的基本信息
 * @param {string|FileNode} file
 * @returns {Promise<Object|null>}
 */
export async function getFileInfo(file) {
  const fileNode = typeof file === "string" ? resolvePath(file) : file;
  if (!fileNode || fileNode.type !== "file") return null;

  try {
    const handleFile = await fileNode.handle.getFile();
    return {
      name: fileNode.name,
      path: getNodePath(fileNode),
      size: handleFile.size,
      lastModified: handleFile.lastModified,
      dirty: fileNode.dirty,
    };
  } catch {
    return {
      name: fileNode.name,
      path: getNodePath(fileNode),
      size: 0,
      lastModified: 0,
      dirty: fileNode.dirty,
    };
  }
}

/**
 * 递归获取完整的目录树结构（供 UI 渲染使用）
 * @param {FolderNode} [folder] 起始文件夹，默认为根
 * @param {number} [depth=0] 当前递归深度
 * @param {number} [maxDepth=20] 最大深度限制
 * @returns {Promise<Object|null>} 树形结构对象
 */
export async function getDirectoryTree(folder = null, depth = 0, maxDepth = 20) {
  const folderNode = folder || currentFileSystem;
  if (!folderNode || folderNode.type !== "dir") return null;
  if (depth > maxDepth) return { name: folderNode.name, type: "dir", path: getNodePath(folderNode), truncated: true };

  await folderNode.loadChildren();
  const children = [];
  for (const child of folderNode.children.values()) {
    if (child.type === "file") {
      const info = await getFileInfo(child);
      children.push({
        id: child.id,
        name: child.name,
        type: "file",
        path: getNodePath(child),
        size: info ? info.size : 0,
        dirty: child.dirty,
      });
    } else {
      const subtree = await getDirectoryTree(child, depth + 1, maxDepth);
      if (subtree) {
        subtree.id = child.id;
        children.push(subtree);
      }
    }
  }
  // 排序：文件夹在前
  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    id: folderNode.id,
    name: folderNode.name,
    type: "dir",
    path: getNodePath(folderNode),
    children,
  };
}

/**
 * 搜索文件名（模糊匹配）
 * @param {string} query 搜索关键词
 * @param {FolderNode} [folder] 起始搜索目录，默认为根
 * @param {number} [maxResults=50] 最大结果数
 * @returns {Promise<Array<{node: FileNode, path: string}>>}
 */
export async function searchFiles(query, folder = null, maxResults = 50) {
  const folderNode = folder || currentFileSystem;
  if (!folderNode || folderNode.type !== "dir") return [];

  const results = [];
  const queue = [folderNode];
  const lowerQuery = query.toLowerCase();

  while (queue.length > 0 && results.length < maxResults) {
    const current = queue.shift();
    await current.loadChildren();
    for (const child of current.children.values()) {
      if (results.length >= maxResults) break;
      if (child.name.toLowerCase().includes(lowerQuery)) {
        results.push({ node: child, path: getNodePath(child) });
      }
      if (child.type === "dir") {
        queue.push(child);
      }
    }
  }
  return results;
}

/**
 * 从文件系统中选择一个文件并打开（请求后端执行）
 * @param {string} [startPath] 起始路径
 * @returns {Promise<boolean>} 是否成功打开
 */
export async function pickAndOpenFile(startPath) {
  try {
    await commands.executeCommand("files.open");
    return true;
  } catch {
    return false;
  }
}

/**
 * 请求后端刷新文件系统，并推送前端刷新
 * @param {FolderNode} [folder] 要刷新的文件夹，默认为根
 */
export async function requestRefresh(folder = null) {
  try {
    await commands.executeCommand("files.refresh", folder);
    // refresh 内部会触发 notifyFileSystemChange → 我们的订阅会收到 → scheduleRefresh
    // 但为确保 UI 更新，再补一个直接通知
    notifySidebarRefresh({ eventType: "user_requested_refresh", fileSystemReady: !!currentFileSystem });
  } catch (e) {
    console.warn("请求文件系统刷新失败：", e);
  }
}

// ==================== 生命周期管理 ====================

/**
 * 清理侧栏的所有订阅和回调（在页面卸载或组件销毁时调用）
 */
export function destroy() {
  // 取消所有后端事件订阅
  if (typeof unsubscribeAll === "function") {
    unsubscribeAll();
  }
  // 清空前端回调
  refreshCallbacks.clear();
  // 清除待执行的防抖
  if (refreshDebounceTimer) {
    clearTimeout(refreshDebounceTimer);
    refreshDebounceTimer = null;
  }
}

// ==================== 导出默认 ====================

export default {
  // 刷新订阅
  onSidebarRefresh,
  offSidebarRefresh,

  // 状态查询
  getRoot,
  isFileSystemOpen,

  // 数据查询
  listDirectory,
  getFileInfo,
  getDirectoryTree,
  searchFiles,

  // 操作
  pickAndOpenFile,
  requestRefresh,

  // 生命周期
  destroy,
};
