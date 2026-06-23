import commands from "./commandServer.js";
import tabs, { tab2File, Tab } from "../ui/tabs.js";
import { msg, ask } from "../ui/utils.js";
import i18n from "../i18n.js";
import { v4 as uuidv4 } from "../library/uuidjs/v4.js";
import { IndexedDB } from "./webstorage.js";

if (!window.joyous) window.joyous = {};

// ==================== 核心数据结构 ====================

/**
 * 当前打开的文件系统（根目录树）
 * @type {FolderNode|null}
 */
export let currentFileSystem = null;

/**
 * 当前应用存储的文件系统节点索引（id → 节点对象）
 */
export const database = new IndexedDB({ dbName: "JoyousME-FileSystem", storeName: "fileNodes" });

// ==================== 路径工具 ====================

/**
 * 将路径字符串解析为文件系统节点。
 *
 * 路径规则：
 *  - 以 `/` 开头 → 从文件系统根 `currentFileSystem` 开始解析
 *  - 否则以 `base` 路径为基准解析（base 为空则也用根）
 *  - 支持 `.`（当前目录）、`..`（父目录）段
 *
 * @param {string} [path=""]   要解析的路径
 * @param {string} [base=""]   基准路径，仅当 path 是相对路径时生效
 * @returns {FileNode|FolderNode|null} 解析到的节点，失败返回 null
 */
export function resolvePath(path = "", base = "") {
  try {
    if (!currentFileSystem) throw new Error("没有可用的文件系统");

    // 决定起始节点
    let goal;
    if (path.startsWith("/") || !base) {
      // 绝对路径或无 base → 从根开始
      goal = currentFileSystem;
    } else {
      // 相对路径 → 先解析 base
      goal = resolvePath(base);
      if (!goal || goal.type !== "dir") {
        throw new Error(`基准路径 "${base}" 无效或不是文件夹`);
      }
    }

    // 标准化：移除开头的 /，然后按 / 分割
    const normalized = path.replace(/^\/+/, "");
    if (!normalized) return goal;

    const parts = normalized.split("/");
    for (const part of parts) {
      if (!part || part === ".") continue;
      if (part === "..") {
        if (goal.parentId) {
          const parent = nodeMap.get(goal.parentId);
          if (!parent) throw new Error("无法找到父节点");
          goal = parent;
        }
        // 已在根节点时忽略 ".."
        continue;
      }
      if (goal.type !== "dir") {
        throw new Error(`"${part}" 的父节点不是文件夹`);
      }
      const child = goal.resolve(part);
      if (!child) {
        throw new Error(`路径中找不到节点 "${part}"`);
      }
      goal = child;
    }
    return goal;
  } catch (e) {
    console.warn("无法基于", base, "解析路径", path, "：", e);
    return null;
  }
}

/**
 * 获取从根到指定节点的完整路径字符串
 * @param {FileNode|FolderNode} node
 * @returns {string} 例如 "/foo/bar/baz.txt"
 */
export function getNodePath(node) {
  const segments = [];
  let current = node;
  while (current) {
    segments.unshift(current.name);
    current = current.parentId ? nodeMap.get(current.parentId) : null;
  }
  return "/" + segments.join("/");
}

/**
 * 获取节点的父文件夹
 * @param {FileNode|FolderNode} node
 * @returns {FolderNode|null}
 */
export function getParent(node) {
  return node.parentId ? (nodeMap.get(node.parentId)) : null;
}

/**
 * 获取从根到指定节点的所有祖先（从近到远）
 * @param {FileNode|FolderNode} node
 * @returns {FolderNode[]}
 */
export function getAncestors(node) {
  const result = [];
  let current = node.parentId ? nodeMap.get(node.parentId) : null;
  while (current) {
    result.push(current);
    current = current.parentId ? nodeMap.get(current.parentId) : null;
  }
  return result;
}

// ==================== 节点类 ====================

/** 一个文件对象 */
export class FileNode {
  /** 对象ID @type {string} */
  id = uuidv4();
  /** 文件名 @type {string} */
  name;
  /** 类型 ["file","dir"] 。目前应为 "file" @type {string} */
  type = "file";
  /** 父节点ID，或者说属于哪个文件夹 @type {string|null} */
  parentId;
  /** @type {FileSystemFileHandle} */
  handle;
  /** 未保存修改标记 @type {boolean} */
  dirty = false;
  /** 上次修改时的保存时间 @type {number|null} */
  lastSavedTimestamp = null;

  constructor(name, handle, parentId = null) {
    this.name = name;
    this.parentId = parentId;
    this.handle = handle;
  }

  /**
   * 从磁盘读取文件内容
   * @returns {Promise<string>}
   */
  async read() {
    const file = await this.handle.getFile();
    return await file.text();
  }

  /**
   * 从磁盘读取文件
   * @returns {Promise<File>}
   */
  file() {
    return this.handle.getFile();
  }

  /**
   * 采样验证文件是否可能是二进制不可读文件。
   *
   * 策略（按优先级）：
   * 1. 发现空字节（0x00）→ 判定为二进制（几乎所有文本格式都会避开 NUL）
   * 2. 尝试解码为 UTF-8 → 若解码成功且无空字节，判定为文本（兼容全部 Unicode 字符）
   * 3. 回退：统计控制字符占比（排除制表符 0x09、换行 0x0A、回车 0x0D）
   *
   * @param {number} [sampleSize=4096] 采样精度：单位 B ，越大越准确但是越卡
   * @param {number} [sampleRate=0.05] 采样阳性指标：当命中不可打印字符比例不小于这个值时判定为不可读
   */
  async isBinaryHeuristic(sampleSize = 4096, sampleRate = 0.05) {
    const file = await this.handle.getFile();
    const buffer = await file.slice(0, sampleSize).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (bytes.length === 0) return false;

    // 1. 空字节检测——NUL 在文本文件中几乎从不出现
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x00) return true;
    }

    // 2. UTF-8 解码验证——能完整解码说明是有效的 Unicode 文本
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      decoder.decode(buffer);
      return false; // 有效的 UTF-8 文本，不是二进制
    } catch (_) {
      // 存在无效的 UTF-8 序列，回退到启发式检测
    }

    // 3. 回退：统计控制字符占比（排除文本常见空白符）
    let suspiciousCount = 0;
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      // 控制字符范围（排除 TAB/换行/回车）以及 DEL
      if ((b < 0x09) || (b > 0x0D && b < 0x20) || b === 0x7F) {
        suspiciousCount++;
      }
    }

    return (suspiciousCount / bytes.length) >= sampleRate;
  }

  /**
   * 写入内容到磁盘
   * @param {string} content
   */
  async save(content) {
    const writable = await this.handle.createWritable();
    await writable.write(content);
    await writable.close();
    const file = await this.handle.getFile();
    this.lastSavedTimestamp = file.lastModified;
    this.dirty = false;
  }

  /**
   * 获取文件大小
   * @returns {Promise<number>}
   */
  async getSize() {
    const file = await this.handle.getFile();
    return file.size;
  }

  /**
   * 获取最后修改时间
   * @returns {Promise<number>}
   */
  async getLastModified() {
    const file = await this.handle.getFile();
    return file.lastModified;
  }

  /**
   * 克隆此节点（浅复制句柄，共享同一磁盘文件）
   * @returns {FileNode}
   */
  clone(newParentId = null) {
    const node = new FileNode(this.name, this.handle, newParentId);
    node.lastSavedTimestamp = this.lastSavedTimestamp;
    return node;
  }

  /**
   * 序列化为可持久化的纯对象（不含 handle）
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      parentId: this.parentId,
      dirty: this.dirty,
      lastSavedTimestamp: this.lastSavedTimestamp,
    };
  }
}
// 给 tabs.js 用的，获取数据
window.joyous.filesGetData = async function (node) {
  if (node instanceof FileNode) {
    return await node.read();
  } else {
    return undefined;
  }
}
window.joyous.filesGetName = function (node) {
  if (node instanceof FileNode || node instanceof FolderNode) {
    return node.name;
  } else {
    return undefined;
  }
}

/** 一个文件夹对象 */
export class FolderNode {
  /** 对象ID @type {string} */
  id = uuidv4();
  /** 文件名 @type {string} */
  name;
  /** 类型 ["file","dir"] 。目前应为 "dir" @type {string} */
  type = "dir";
  /** 父节点ID，或者说属于哪个文件夹 @type {string|null} */
  parentId;
  /** @type {FileSystemFileHandle} */
  handle;
  /** 下属有哪些对象 @type {Map<String,FileNode|FolderNode>} */
  children = new Map();
  /**
   * 是否已加载子节点的内容。没有加载时 {@link children} 为空。
   * @type {boolean}
   * @see {@link loadChildren()} 使用这个加载子节点
   */
  loaded = false;

  constructor(name, handle, parentId = null) {
    this.name = name;
    this.parentId = parentId;
    this.handle = handle;
  }

  /**
   * 加载目录下的所有直接子节点（懒加载）
   * @returns {Promise<void>} 记得用 await
   * @see {@link loaded} 如果你需要重新加载，那么需要把这个标志设置为 false
   */
  async loadChildren() {
    if (this.loaded) return;
    this.loaded = true;
    for await (const entry of this.handle.values()) {
      const existing = this.resolve(entry.name);
      if (existing) continue;
      let childNode;
      if (entry.kind === "file") {
        childNode = new FileNode(entry.name, entry, this.id);
      } else if (entry.kind === "directory") {
        childNode = new FolderNode(entry.name, entry, this.id);
      } else {
        continue;
      }
      this.children.set(childNode.id, childNode);
      nodeMap.set(childNode.id, childNode);
    }
  }

  /**
   * 按名称查找直接子节点
   * @param {string} name
   * @returns {FileNode|FolderNode|null}
   */
  resolve(name) {
    for (const child of this.children.values()) {
      if (child.name === name) return child;
    }
    return null;
  }

  /** 按 UUID 查找直接子节点 */
  resolveById(id) {
    return this.children.get(id) || null;
  }

  /** 添加子节点（内存中） */
  addChild(node) {
    node.parentId = this.id;
    this.children.set(node.id, node);
    nodeMap.set(node.id, node);
  }

  /** 移除子节点（仅内存） */
  removeChild(id) {
    const node = this.children.get(id);
    if (node) {
      node.parentId = null;
      this.children.delete(id);
      nodeMap.delete(id);
    }
  }

  /**
   * 递归收集所有子节点（文件 + 文件夹），用于深拷贝等场景
   * @returns {{ files: FileNode[], folders: FolderNode[] }}
   */
  collectAllDescendants() {
    const files = [];
    const folders = [];
    for (const child of this.children.values()) {
      if (child.type === "file") {
        files.push(child);
      } else {
        folders.push(child);
        const sub = child.collectAllDescendants();
        files.push(...sub.files);
        folders.push(...sub.folders);
      }
    }
    return { files, folders };
  }

  /**
   * 序列化为可持久化的纯对象（不含 handle）
   * @returns {Object}
   */
  toJSON() {
    const childrenArr = [];
    for (const child of this.children.values()) {
      childrenArr.push(child.toJSON());
    }
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      parentId: this.parentId,
      loaded: this.loaded,
      children: childrenArr,
    };
  }
}

// ==================== 全局索引 ====================

/** @type {Map<string, FileNode|FolderNode>} id → 任意节点 */
export const nodeMap = new Map();

/** @type {WeakMap<object, string>} FileSystemHandle → 节点 id */
export const handleToNodeId = new WeakMap();

// ==================== 观察者模式（前端推送） ====================

/**
 * 文件系统变更事件类型枚举
 * @readonly
 * @enum {string}
 */
export const FileSystemEvent = {
  /** 文件系统被打开（打开文件夹） */
  OPENED: "opened",
  /** 文件系统被关闭 */
  CLOSED: "closed",
  /** 新文件创建 */
  FILE_CREATED: "file_created",
  /** 新文件夹创建 */
  FOLDER_CREATED: "folder_created",
  /** 节点被删除 */
  DELETED: "deleted",
  /** 节点被重命名 */
  RENAMED: "renamed",
  /** 节点被移动 */
  MOVED: "moved",
  /** 节点被复制 */
  COPIED: "copied",
  /** 目录内容被刷新 */
  REFRESHED: "refreshed",
  /** 文件系统整体结构变化（复合操作后的全量通知） */
  STRUCTURE_CHANGED: "structure_changed",
  /** 用户撤销了文件系统权限（浏览器设置中撤销） */
  PERMISSION_REVOKED: "permission_revoked",
};

/** @type {Map<string, Set<Function>>} 事件类型 → 回调函数集合 */
const eventListeners = new Map();

/**
 * 订阅文件系统变更事件
 * @param {string|string[]} eventTypes 事件类型（FileSystemEvent 的值），传入 "*" 监听所有事件
 * @param {Function} callback 回调函数，接收 (eventType, detail) 两个参数
 * @returns {Function} 取消订阅的函数
 */
export function onFileSystemChange(eventTypes, callback) {
  const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
  for (const type of types) {
    if (!eventListeners.has(type)) {
      eventListeners.set(type, new Set());
    }
    eventListeners.get(type).add(callback);
  }
  // 返回取消订阅函数
  return () => offFileSystemChange(eventTypes, callback);
}

/**
 * 取消订阅文件系统变更事件
 * @param {string|string[]} eventTypes
 * @param {Function} callback
 */
export function offFileSystemChange(eventTypes, callback) {
  const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
  for (const type of types) {
    const set = eventListeners.get(type);
    if (set) {
      set.delete(callback);
      if (set.size === 0) eventListeners.delete(type);
    }
  }
}

/**
 * 通知所有订阅者文件系统发生变更
 * @param {string} eventType 事件类型
 * @param {Object} [detail={}] 事件详情
 * @param {FileNode|FolderNode} [detail.node] 受影响的节点
 * @param {FileNode|FolderNode} [detail.oldNode] 变更前的节点（重命名时使用）
 * @param {FolderNode} [detail.parent] 父节点
 * @param {string} [detail.oldName] 旧名称（重命名时使用）
 * @param {*} ... 其他自定义字段
 */
export function notifyFileSystemChange(eventType, detail = {}) {
  const payload = { eventType, ...detail, timestamp: Date.now() };

  // 通知指定类型的订阅者
  const specific = eventListeners.get(eventType);
  if (specific) {
    for (const cb of specific) {
      try { cb(eventType, payload); } catch (e) { console.warn("文件系统事件回调出错：", e); }
    }
  }

  // 通知通配符 "*" 订阅者
  const wildcard = eventListeners.get("*");
  if (wildcard) {
    for (const cb of wildcard) {
      try { cb(eventType, payload); } catch (e) { console.warn("文件系统事件回调出错：", e); }
    }
  }
}

// ==================== 打开 / 关闭文件系统 ====================

/**
 * 在 nodeMap 中查找与给定 FileSystemHandle 指向相同文件/目录的节点。
 * 使用 FileSystemHandle.isSameEntry() 进行底层比对，而非句柄引用。
 * @param {FileSystemHandle} handle
 * @returns {Promise<FileNode|FolderNode|null>}
 */
async function findNodeByHandle(handle) {
  for (const [, node] of nodeMap) {
    if (!node.handle || typeof node.handle.isSameEntry !== 'function') continue;
    try {
      if (await node.handle.isSameEntry(handle)) {
        return node;
      }
    } catch (_) {
      // 权限不足或句柄失效，跳过此节点
    }
  }
  return null;
}

/**
 * 打开单个文件（通过浏览器文件选择器）。
 *
 * 如果选中的文件已存在于当前工作区文件树（或其句柄指向同一底层文件），
 * 则直接返回已有的 FileNode，避免重复节点和编辑器。
 *
 * @returns {Promise<FileNode|null>} 用户取消时返回 null
 */
export async function openFile() {
  if (!window.showOpenFilePicker) {
    throw new Error("无法打开文件：不支持 FileSystemAccessAPI 。");
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: "文本/配置文件",
        accept: {
          "text/plain": [".txt", ".json", ".yaml", ".yml", ".cfg", ".conf", ".ini", ".xml", ".md", ".js", ".ts", ".html", ".css"],
        },
      }],
      excludeAcceptAllOption: false,
      multiple: false,
    });

    // 检查是否已在现行文件系统中——避免同一个文件产生重复的 FileNode
    const existing = await findNodeByHandle(handle);
    if (existing) {
      console.log(`文件 "${existing.name}" 已在文件系统中，返回已有节点`);
      return existing;
    }

    const file = await handle.getFile();
    const node = new FileNode(file.name, handle);
    nodeMap.set(node.id, node);
    handleToNodeId.set(handle, node.id);
    return node;
  } catch (err) {
    if (err.name !== "AbortError") {
      throw new Error("无法打开文件：" + err.message);
    }
    return null;
  }
}

/**
 * 打开文件夹，构建目录树。
 *
 * 流程说明（重置文件服务器状态）：
 * 1. 检测并询问用户是否保存未保存的编辑器更改
 * 2. 用户取消 → 中止操作，返回 null
 * 3. 保存脏标签页（若用户选择"保存全部"）
 * 4. 关闭全部标签页
 * 5. 重置文件服务器状态（清空 nodeMap、currentFileSystem、tab2File）
 * 6. 请求用户选择文件夹
 * 7. 成功打开后：清除旧 IndexedDB 数据 → 持久化新句柄 → 完成
 *
 * @returns {Promise<FolderNode|null>}
 */
export async function openFolder() {
  if (!window.showDirectoryPicker) {
    throw new Error("无法打开文件夹：不支持的 API 。");
  }

  // ---- 第 1 步：关闭全部标签页 ----
  if (tabs.getTabsLength() > 0) {
    tabs.closeAllTabs();
  }

  // ---- 第 2 步：重置文件服务器状态 ----
  nodeMap.clear();
  currentFileSystem = null;
  tab2File.clear();
  //eventListeners.clear();

  // ---- 第 3 步：请求用户选择文件夹 ----
  try {
    const handle = await window.showDirectoryPicker();
    const rootNode = new FolderNode(handle.name, handle);
    nodeMap.set(rootNode.id, rootNode);
    handleToNodeId.set(handle, rootNode.id);
    await rootNode.loadChildren();
    currentFileSystem = rootNode;

    // ---- 第 4 步：清除旧数据 → 持久化新句柄 ----
    await clearAllStoredHandles();
    await persistAllHandles(rootNode);

    // ---- 第 5 步：启动文件系统变更监视器 ----
    startFileSystemWatcher();

    notifyFileSystemChange(FileSystemEvent.OPENED, { node: rootNode });
    return rootNode;
  } catch (err) {
    // 文件夹选择失败或用户取消 → 确保 tabs 仍有内容可显示
    if (tabs.getTabsLength() === 0) {
      try { commands.executeCommandSlient("editor.switch", 0); } catch (e) { /* 无可用编辑器，忽略 */ }
    }
    if (err.name !== "AbortError") {
      throw new Error("无法打开文件夹：" + err.message);
    }
    return null;
  }
}

/**
 * 关闭当前文件系统（清空索引）
 */
export function closeFileSystem() {
  stopFileSystemWatcher();
  nodeMap.clear();
  currentFileSystem = null;
  // 同时清理标签页绑定
  tab2File.clear();
  notifyFileSystemChange(FileSystemEvent.CLOSED);
}

/**
 * 彻底重置文件服务器——关闭所有标签页 + 清除内存 + 清除持久化数据。
 * 在权限撤销、工作区恢复失败等场景下使用，比 closeFileSystem 更彻底。
 */
export async function resetFileSystem() {
  // 停止文件系统监视器
  stopFileSystemWatcher();

  // 关闭所有标签页
  if (tabs.getTabsLength() > 0) {
    tabs.closeAllTabs();
  }

  // 清空内存
  nodeMap.clear();
  currentFileSystem = null;
  tab2File.clear();

  // 清空持久化数据（localStorage 中的元数据 + IndexedDB 中的句柄）
  try {
    localStorage.removeItem(AUTOSAVE_FS_KEY);
    localStorage.removeItem(AUTOSAVE_TAB_BIND_KEY);
    await clearAllStoredHandles();
  } catch (e) {
    console.warn("清理持久化数据失败：", e);
  }

  notifyFileSystemChange(FileSystemEvent.CLOSED);
}

// ==================== 文件系统权限管理 ====================

/**
 * 检查当前文件系统根句柄的读写权限。
 * @returns {Promise<"granted"|"denied"|"prompt">}
 */
export async function checkFileSystemPermission() {
  if (!currentFileSystem || !currentFileSystem.handle) return "granted";
  try {
    return await currentFileSystem.handle.queryPermission({ mode: "readwrite" });
  } catch (e) {
    console.warn("权限查询失败：", e);
    return "denied";
  }
}

/** 权限监控是否已初始化的标志 */
let permissionMonitorInitialized = false;

/**
 * 初始化文件系统权限监控。
 * 监听页面 focus 和 visibilitychange，在用户返回页面时主动检查权限是否被撤销。
 * 仅初始化一次，多次调用安全。
 */
export function initPermissionMonitor() {
  if (permissionMonitorInitialized) return;
  permissionMonitorInitialized = true;

  const check = async () => {
    if (!currentFileSystem) return; // 没有打开的文件系统，无需检查
    const perm = await checkFileSystemPermission();
    if (perm === "denied") {
      console.warn("检测到文件系统权限已被撤销，正在重置文件服务器……");
      notifyFileSystemChange(FileSystemEvent.PERMISSION_REVOKED, {
        previousState: "granted",
        newState: "denied",
      });
      await resetFileSystem();
      msg(
        i18n.parseSafe("msg.permission_revoked"),
        i18n.parseSafe("msg.ok"),
        "error",
        -1
      );
    }
  };

  // 页面获得焦点时检查（用户可能在其他标签页/设置中撤销了授权）
  window.addEventListener("focus", check);
  // 页面从隐藏变为可见时检查
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
}

// ==================== IndexedDB 句柄持久化 ====================

/**
 * 将单个节点的 FileSystemHandle 递归保存到 IndexedDB。
 * FileSystemHandle 是结构化克隆兼容的，可直接存入 IndexedDB。
 * @param {FileNode|FolderNode} node
 */
async function saveNodeHandleToDB(node) {
  if (!node.handle) return;
  await database.set(node.id, node.handle);
}

/**
 * 递归持久化整个文件系统的所有句柄到 IndexedDB。
 * 在打开文件夹成功后调用，以便后续恢复。
 * @param {FileNode|FolderNode} [node] 起始节点，默认为根
 */
export async function persistAllHandles(node = null) {
  const start = node || currentFileSystem;
  if (!start) return;

  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift();
    await saveNodeHandleToDB(current);
    if (current.type === "dir") {
      for (const child of current.children.values()) {
        queue.push(child);
      }
    }
  }
}

/**
 * 从 IndexedDB 清除所有文件句柄数据（打开新文件夹前清理旧数据）。
 */
export async function clearAllStoredHandles() {
  await database.reset_dangerous();
}

/**
 * 从 IndexedDB 加载指定节点的文件句柄。
 * 返回的 handle 可直接赋值给 `node.handle`。
 * @param {string} nodeId
 * @returns {Promise<FileSystemFileHandle|FileSystemDirectoryHandle|undefined>}
 */
export async function loadHandleFromDB(nodeId) {
  return await database.get(nodeId);
}

/**
 * 从 IndexedDB 加载所有已存储的句柄。
 * @returns {Promise<Object<string, FileSystemHandle>>} id → handle 的映射
 */
export async function loadAllHandlesFromDB() {
  return await database.getAll();
}

// ==================== 路径参数解析辅助 ====================

/**
 * 将输入解析为节点（接受节点对象或路径字符串）。
 * 路径以 `/` 开头 → 绝对路径；否则相对于当前文件系统根。
 * @param {FileNode|FolderNode|string} input
 * @param {FileNode|FolderNode} [relativeTo] 当 input 是相对路径时的参考节点
 * @returns {FileNode|FolderNode|null}
 */
function resolveNodeInput(input, relativeTo = undefined) {
  if (!input) return null;
  if (typeof input === "string") {
    // 路径字符串 → 用 resolvePath
    if (input.startsWith("/")) {
      return resolvePath(input);
    }
    // 相对路径：如果有参考节点，基于参考节点的父目录解析
    if (relativeTo) {
      const parentPath = getNodePath(getParent(relativeTo) || relativeTo);
      return resolvePath(input, parentPath);
    }
    return resolvePath(input);
  }
  // 已经是节点对象
  if (input instanceof FileNode || input instanceof FolderNode) return input;
  return null;
}

/**
 * 将输入解析为文件夹节点（接受节点对象或路径字符串）。
 * 支持 `.`（当前目录）、`..`（父目录）导航。
 * @param {FolderNode|string} input
 * @param {FileNode|FolderNode} [relativeTo] 相对路径的参考节点
 * @returns {FolderNode|null}
 */
function resolveFolderInput(input, relativeTo = undefined) {
  const node = resolveNodeInput(input, relativeTo);
  if (!node || node.type !== "dir") return null;
  return node;
}

/**
 * 确保参数是节点对象（如果是路径则自动解析并替换原参数）。
 * 用于包裹函数的第一参数——源节点。
 * @param {FileNode|FolderNode|string} nodeInput
 * @param {string} paramName 参数名（用于错误信息）
 * @returns {FileNode|FolderNode}
 */
function ensureNode(nodeInput, paramName = "node") {
  const node = resolveNodeInput(nodeInput);
  if (!node) throw new Error(`无效的 ${paramName}：无法解析为节点`);
  return node;
}

/**
 * 确保参数是文件夹节点（支持路径解析）。
 * 用于包裹函数的目标文件夹参数。
 * @param {FolderNode|string} folderInput
 * @param {FileNode|FolderNode} [relativeTo] 相对路径参考
 * @param {string} [paramName="targetFolder"]
 * @returns {FolderNode}
 */
function ensureFolder(folderInput, relativeTo = undefined, paramName = "targetFolder") {
  const folder = resolveFolderInput(folderInput, relativeTo);
  if (!folder) throw new Error(`无效的 ${paramName}：无法解析为文件夹`);
  return folder;
}

// ==================== 文件系统操作（增删改查） ====================

/**
 * 在指定文件夹下创建新文件。
 *
 * `parentFolder` 支持路径字符串（如 `/foo/bar`），也支持 `.` `..` 导航。
 *
 * @param {FolderNode|string} parentFolder 文件夹节点或路径
 * @param {string} fileName 文件名（含扩展名）
 * @returns {Promise<FileNode|null>}
 */
export async function createFile(parentFolder, fileName) {
  const resolved = ensureFolder(parentFolder, undefined, "parentFolder");
  if (!resolved.handle.getFileHandle) {
    throw new Error("文件夹句柄不支持创建文件（可能尚未加载）");
  }
  try {
    const handle = await resolved.handle.getFileHandle(fileName, { create: true });
    const node = new FileNode(fileName, handle, resolved.id);
    resolved.addChild(node);
    handleToNodeId.set(handle, node.id);
    notifyFileSystemChange(FileSystemEvent.FILE_CREATED, { node, parent: resolved });
    return node;
  } catch (err) {
    console.error("创建文件失败：", err);
    throw new Error(`无法创建文件 "${fileName}"：${err.message}`);
  }
}

/**
 * 在指定文件夹下创建新文件夹。
 *
 * `parentFolder` 支持路径字符串（如 `/foo`），也支持 `.` `..` 导航。
 *
 * @param {FolderNode|string} parentFolder 文件夹节点或路径
 * @param {string} dirName
 * @returns {Promise<FolderNode|null>}
 */
export async function createFolder(parentFolder, dirName) {
  const resolved = ensureFolder(parentFolder, undefined, "parentFolder");
  if (!resolved.handle.getDirectoryHandle) {
    throw new Error("文件夹句柄不支持创建文件夹");
  }
  try {
    const handle = await resolved.handle.getDirectoryHandle(dirName, { create: true });
    const node = new FolderNode(dirName, handle, resolved.id);
    resolved.addChild(node);
    handleToNodeId.set(handle, node.id);
    notifyFileSystemChange(FileSystemEvent.FOLDER_CREATED, { node, parent: resolved });
    return node;
  } catch (err) {
    console.error("创建文件夹失败：", err);
    throw new Error(`无法创建文件夹 "${dirName}"：${err.message}`);
  }
}

/**
 * 从磁盘删除文件或文件夹。
 *
 * `node` 支持路径字符串（如 `/foo/bar.txt`）。
 *
 * @param {FileNode|FolderNode|string} node
 * @param {boolean} [recursive=false] 删除文件夹时是否递归删除全部内容
 * @returns {Promise<boolean>}
 */
export async function deleteNode(node, recursive = false) {
  const resolvedNode = ensureNode(node, "node");
  const parent = getParent(resolvedNode);
  if (!parent) throw new Error("根节点不能删除");

  // 若有标签页绑定到此文件，先关闭或解绑
  if (resolvedNode.type === "file") {
    const boundTabs = getTabsBoundToFile(resolvedNode.id);
    for (const tabId of boundTabs) {
      unbindTab(tabId);
    }
  }

  try {
    await parent.handle.removeEntry(resolvedNode.name, { recursive });
    const nodeId = resolvedNode.id;
    const nodeName = resolvedNode.name;
    const nodeType = resolvedNode.type;
    parent.removeChild(resolvedNode.id);
    // 如果是文件夹，递归从 nodeMap 清除其所有后代
    if (resolvedNode.type === "dir") {
      await recursivelyRemoveFromMap(resolvedNode);
    }
    notifyFileSystemChange(FileSystemEvent.DELETED, {
      nodeId, nodeName, nodeType, parent,
    });
    return true;
  } catch (err) {
    console.error("删除失败：", err);
    throw new Error(`无法删除 "${resolvedNode.name}"：${err.message}`);
  }
}

/**
 * 递归从 nodeMap 移除节点及其所有后代
 * @param {FolderNode} folderNode
 */
async function recursivelyRemoveFromMap(folderNode) {
  for (const child of folderNode.children.values()) {
    if (child.type === "dir") {
      await recursivelyRemoveFromMap(child);
    }
    nodeMap.delete(child.id);
  }
}

/**
 * 重命名文件或文件夹。
 *
 * `node` 支持路径字符串（如 `/foo/bar.txt`）。
 *
 * @param {FileNode|FolderNode|string} node
 * @param {string} newName
 * @returns {Promise<boolean>}
 */
export async function renameNode(node, newName) {
  const resolvedNode = ensureNode(node, "node");
  if (resolvedNode === currentFileSystem) throw new Error("不能重命名根目录");
  if (!resolvedNode.handle) throw new Error("节点没有底层句柄，无法重命名");

  const parent = getParent(resolvedNode);
  if (!parent) throw new Error("根节点不能重命名");

  // FileSystemAccessAPI 不支持直接重命名，采用「创建新条目 + 复制内容 + 删除旧条目」策略
  const oldName = resolvedNode.name;
  try {
    if (resolvedNode.type === "file") {
      await renameFileNode(resolvedNode, newName, parent);
    } else {
      await renameDirNode(resolvedNode, newName, parent);
    }
    notifyFileSystemChange(FileSystemEvent.RENAMED, {
      node: resolvedNode, parent, oldName, newName,
    });
    return true;
  } catch (err) {
    console.error("重命名失败：", err);
    throw new Error(`无法重命名 "${resolvedNode.name}" 为 "${newName}"：${err.message}`);
  }
}

/**
 * 重命名文件的具体实现
 * @param {FileNode} node
 * @param {string} newName
 * @param {FolderNode} parent
 */
async function renameFileNode(node, newName, parent) {
  // 创建新文件句柄
  const newHandle = await parent.handle.getFileHandle(newName, { create: true });
  // 读取旧内容
  const content = await node.read();
  // 写入新文件
  const writable = await newHandle.createWritable();
  await writable.write(content);
  await writable.close();
  // 删除旧文件
  await parent.handle.removeEntry(node.name);

  // 更新内存中节点
  const oldId = node.id;
  node.name = newName;
  node.handle = newHandle;
  handleToNodeId.set(newHandle, oldId);
  // 刷新时间戳
  const file = await newHandle.getFile();
  node.lastSavedTimestamp = file.lastModified;
  node.dirty = false;
}

/**
 * 重命名文件夹的具体实现（递归复制）
 * @param {FolderNode} node
 * @param {string} newName
 * @param {FolderNode} parent
 */
async function renameDirNode(node, newName, parent) {
  // 创建新文件夹
  const newHandle = await parent.handle.getDirectoryHandle(newName, { create: true });
  // 递归复制内容
  await copyDirContent(node, newHandle);
  // 删除旧文件夹（递归）
  await parent.handle.removeEntry(node.name, { recursive: true });

  // 更新内存
  node.name = newName;
  node.handle = newHandle;
  handleToNodeId.set(newHandle, node.id);
}

/**
 * 递归复制文件夹内容（内部工具）
 * @param {FolderNode} source
 * @param {FileSystemDirectoryHandle} destHandle
 */
async function copyDirContent(source, destHandle) {
  for (const child of source.children.values()) {
    if (child.type === "file") {
      const content = await child.read();
      const newHandle = await destHandle.getFileHandle(child.name, { create: true });
      const writable = await newHandle.createWritable();
      await writable.write(content);
      await writable.close();
      child.handle = newHandle;
      handleToNodeId.set(newHandle, child.id);
    } else {
      const subHandle = await destHandle.getDirectoryHandle(child.name, { create: true });
      child.handle = subHandle;
      handleToNodeId.set(subHandle, child.id);
      await copyDirContent(child, subHandle);
    }
  }
}

/**
 * 移动文件或文件夹到目标文件夹。
 *
 * 两个参数都支持路径导航：
 *  - `node` 接受节点对象或路径字符串（`/foo/bar.txt`）
 *  - `targetFolder` 接受文件夹节点或路径字符串，
 *    相对路径基于 `node` 的父目录解析（支持 `.` `..`）
 *
 * @param {FileNode|FolderNode|string} node
 * @param {FolderNode|string} targetFolder
 * @returns {Promise<boolean>}
 */
export async function moveNode(node, targetFolder) {
  // ---- 路径解析 ----
  const resolvedNode = ensureNode(node, "node");
  if (resolvedNode === currentFileSystem) throw new Error("不能移动根目录");
  const resolvedTarget = ensureFolder(targetFolder, resolvedNode, "targetFolder");
  if (resolvedNode.parentId === resolvedTarget.id) {
    return true; // 已在目标文件夹中
  }
  // 检查是否把文件夹移入自身或后代
  if (resolvedNode.type === "dir") {
    let ancestor = resolvedTarget;
    while (ancestor) {
      if (ancestor.id === resolvedNode.id) {
        throw new Error("不能将文件夹移入自身或其子文件夹");
      }
      ancestor = ancestor.parentId ? nodeMap.get(ancestor.parentId) : null;
    }
  }

  const oldParent = getParent(resolvedNode);
  if (!oldParent) throw new Error("根节点不能移动");

  try {
    // 读取内容
    let content = null;
    if (resolvedNode.type === "file") {
      content = await resolvedNode.read();
    }

    // 在目标创建新条目
    if (resolvedNode.type === "file") {
      const newHandle = await resolvedTarget.handle.getFileHandle(resolvedNode.name, { create: true });
      const writable = await newHandle.createWritable();
      await writable.write(content);
      await writable.close();
      resolvedNode.handle = newHandle;
      handleToNodeId.set(newHandle, resolvedNode.id);
    } else {
      const newHandle = await resolvedTarget.handle.getDirectoryHandle(resolvedNode.name, { create: true });
      await copyDirContent(resolvedNode, newHandle);
      resolvedNode.handle = newHandle;
      handleToNodeId.set(newHandle, resolvedNode.id);
    }

    // 从原位置删除
    await oldParent.handle.removeEntry(resolvedNode.name, { recursive: resolvedNode.type === "dir" });

    // 更新内存树
    const movedNodeId = resolvedNode.id;
    const movedNodeName = resolvedNode.name;
    oldParent.removeChild(resolvedNode.id);
    resolvedTarget.addChild(resolvedNode);

    notifyFileSystemChange(FileSystemEvent.MOVED, {
      node: resolvedNode, oldParent, newParent: resolvedTarget,
      nodeName: movedNodeName,
    });
    return true;
  } catch (err) {
    console.error("移动失败：", err);
    throw new Error(`无法移动 "${resolvedNode.name}"：${err.message}`);
  }
}

/**
 * 复制文件或文件夹到目标文件夹。
 *
 * 前两个参数都支持路径导航：
 *  - `node` 接受节点对象或路径字符串
 *  - `targetFolder` 接受文件夹节点或路径字符串，
 *    相对路径基于 `node` 的父目录解析（支持 `.` `..`）
 *
 * @param {FileNode|FolderNode|string} node
 * @param {FolderNode|string} targetFolder
 * @param {string} [copyName] 可选的新名称，默认在原名称后加 "（副本）"
 * @returns {Promise<FileNode|FolderNode|null>}
 */
export async function copyNode(node, targetFolder, copyName = null) {
  const resolvedNode = ensureNode(node, "node");
  const resolvedTarget = ensureFolder(targetFolder, resolvedNode, "targetFolder");

  const destName = copyName || generateCopyName(resolvedNode.name, resolvedTarget);

  try {
    if (resolvedNode.type === "file") {
      const content = await resolvedNode.read();
      const newHandle = await resolvedTarget.handle.getFileHandle(destName, { create: true });
      const writable = await newHandle.createWritable();
      await writable.write(content);
      await writable.close();
      const newNode = new FileNode(destName, newHandle, resolvedTarget.id);
      const file = await newHandle.getFile();
      newNode.lastSavedTimestamp = file.lastModified;
      resolvedTarget.addChild(newNode);
      handleToNodeId.set(newHandle, newNode.id);
      notifyFileSystemChange(FileSystemEvent.COPIED, {
        node: newNode, source: resolvedNode, parent: resolvedTarget,
      });
      return newNode;
    } else {
      const newHandle = await resolvedTarget.handle.getDirectoryHandle(destName, { create: true });
      const newNode = new FolderNode(destName, newHandle, resolvedTarget.id);
      resolvedTarget.addChild(newNode);
      handleToNodeId.set(newHandle, newNode.id);
      // 递归复制子内容
      await resolvedNode.loadChildren();
      for (const child of resolvedNode.children.values()) {
        await copyNode(child, newNode);
      }
      notifyFileSystemChange(FileSystemEvent.COPIED, {
        node: newNode, source: resolvedNode, parent: resolvedTarget,
      });
      return newNode;
    }
  } catch (err) {
    console.error("复制失败：", err);
    throw new Error(`无法复制 "${resolvedNode.name}"：${err.message}`);
  }
}

/**
 * 生成不冲突的副本名称
 * @param {string} originalName
 * @param {FolderNode} targetFolder
 * @returns {string}
 */
function generateCopyName(originalName, targetFolder) {
  const dotIndex = originalName.lastIndexOf(".");
  let baseName, ext;
  if (dotIndex > 0) {
    baseName = originalName.substring(0, dotIndex);
    ext = originalName.substring(dotIndex);
  } else {
    baseName = originalName;
    ext = "";
  }
  let counter = 1;
  let newName;
  do {
    newName = `${baseName}（副本${counter}）${ext}`;
    counter++;
  } while (targetFolder.resolve(newName));
  return newName;
}

// ==================== 与标签页的协作 ====================

/**
 * 将标签页绑定到文件节点
 * @param {string} tabId 标签页 UUID
 * @param {FileNode} fileNode
 */
export function bindTabToFile(tabId, fileNode) {
  if (fileNode.type !== "file") throw new Error("只能将标签页绑定到文件节点");
  tab2File.set(tabId, fileNode);
}

/**
 * 获取标签页绑定的文件节点
 * @param {string} tabId
 * @returns {FileNode|undefined}
 */
export function getFileForTab(tabId) {
  return tab2File.get(tabId);
}

/**
 * 解除标签页与文件的绑定
 * @param {string} tabId
 */
export function unbindTab(tabId) {
  tab2File.delete(tabId);
}

/**
 * 查找所有绑定到指定文件的标签页 ID
 * @param {string} fileNodeId
 * @returns {string[]}
 */
export function getTabsBoundToFile(fileNodeId) {
  const result = [];
  for (const [tabId, fileNode] of tab2File) {
    if (fileNode.id === fileNodeId) {
      result.push(tabId);
    }
  }
  return result;
}

/**
 * 将文件节点作为数据源打开到编辑器标签页中
 * @param {FileNode} fileNode
 * @param {string} [editorId] 可选的编辑器标识符
 * @returns {Promise<string>|Promise<null} 新标签页的 UUID
 */
export async function openFileInTab(fileNode, editorId = undefined) {
  const resolved = ensureNode(fileNode, "fileNode");
  if (resolved.type !== "file") throw new Error("只能打开文件节点");

  // 查找重复绑定，避免数据竞态
  const result = getTabsBoundToFile(fileNode.id);
  if (result.length != 0) {
    const existingTabId = result.pop();
    tabs.switchTab(existingTabId);
    return existingTabId; // 返回已有标签页的 UUID，保持返回值语义一致
  }

  const tabId = await commands.executeCommand("editor.open", resolved, editorId, resolved.name);
  // 建立绑定
  if (tabId) {
    bindTabToFile(tabId, resolved);
  }
  return tabId;
}

/**
 * 保存标签页内容到绑定的文件。
 *
 * 若标签页未绑定文件（如从未保存过的新建标签页），则引导用户通过
 * 浏览器保存对话框选择存储位置；若绑定文件已被外部删除/重命名，
 * 则尝试在工作区中重建，重建失败时也回退到保存对话框。
 *
 * @param {string|number} tabId 标签页 UUID 或索引
 */
export async function saveToFile(tabId = tabs.getCurrentTabId()) {
  let tab;
  try {
    tab = tabs.getTab(tabId);
  } catch (e) {
    throw new Error("无法保存数据：找不到标签页 #" + tabId);
  }

  const data = tab.instance.getData();
  if (data === undefined || data === null) {
    throw new Error("编辑器没有返回有效数据");
  }
  const serialized = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  const fileNode = tab2File.get(tab.id);

  // ── 情况 A：无 FileNode 绑定 → 引导用户选择保存位置 ──
  if (!fileNode) {
    await saveToNewFile(serialized, tab.id, tab.name);
    return;
  }

  // ── 情况 B：有绑定，尝试写入磁盘 ──
  try {
    await fileNode.save(serialized);
  } catch (err) {
    if (err.name === "NotFoundError") {
      // 文件已被外部删除/重命名 → 尝试在工作区父目录中重建
      const parent = getParent(fileNode);
      if (parent && parent.handle) {
        try {
          const newHandle = await parent.handle.getFileHandle(fileNode.name, { create: true });
          fileNode.handle = newHandle;
          handleToNodeId.set(newHandle, fileNode.id);
          await fileNode.save(serialized);
          msg(
            i18n.parseSafe("msg.savedWith", { target: fileNode.name }),
            i18n.parseSafe("msg.done"), "success", 2000
          );
          return;
        } catch (_) { /* 重建失败，降级到保存对话框 */ }
      }
      // 没有父目录或重建失败 → 回退到保存对话框
      await saveToNewFile(serialized, tab.id, fileNode.name);
      return;
    }
    throw err; // 其他错误正常抛出
  }
}

/**
 * 通过浏览器保存对话框将数据写入用户指定的新文件，
 * 并自动建立标签页与文件的绑定关系。
 * @param {string} data 序列化后的数据
 * @param {string} tabId 标签页 UUID
 * @param {string} suggestedName 建议的文件名
 * @returns {Promise<FileNode>}
 */
async function saveToNewFile(data, tabId, suggestedName = "untitled.txt") {
  if (!window.showSaveFilePicker) {
    throw new Error("浏览器不支持保存文件。");
  }
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [{
      description: "文本/配置文件",
      accept: {
        "text/plain": [
          ".txt", ".json", ".yaml", ".yml", ".cfg", ".conf",
          ".ini", ".xml", ".md", ".js", ".ts", ".html", ".css",
        ],
      },
    }],
  });

  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();

  // 创建 FileNode 并绑定到此标签页
  const fileNode = new FileNode(handle.name, handle);
  nodeMap.set(fileNode.id, fileNode);
  handleToNodeId.set(handle, fileNode.id);
  bindTabToFile(tabId, fileNode);

  const file = await handle.getFile();
  fileNode.lastSavedTimestamp = file.lastModified;

  msg(
    i18n.parseSafe("msg.savedTo", { path: fileNode.name }),
    i18n.parseSafe("msg.done"), "success", 2000
  );
  return fileNode;
}

/**
 * 将当前标签页内容另存为新文件。
 *
 * 若存在文件系统（`currentFileSystem`），则在目标文件夹下创建文件；
 * 若不存在（如纯浏览器环境），则降级使用浏览器保存对话框（与 `saveToFile`
 * 无文件绑定时行为一致）。
 *
 * @param {string} fileName
 * @param {FolderNode|string} [targetFolder] 目标文件夹（节点或路径），默认根目录
 * @param {string|number} [tabId] 标签页
 * @returns {Promise<FileNode|null>}
 */
export async function saveAsToFile(fileName, targetFolder = null, tabId = tabs.getCurrentTabId()) {
  const tab = tabs.getTab(tabId);
  const data = tab.instance.getData();
  if (data === undefined || data === null) {
    throw new Error("编辑器没有返回有效数据");
  }
  const serialized = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  // 检查是否有文件系统
  const raw = targetFolder || currentFileSystem;
  if (!raw) {
    // 无文件系统，降级使用浏览器保存对话框（与 saveToFile 行为一致）
    return await saveToNewFile(serialized, tab.id, fileName || tab.name);
  }

  const folder = ensureFolder(raw, undefined, "targetFolder");
  const fileNode = await createFile(folder, fileName);
  await fileNode.save(serialized);
  bindTabToFile(tab.id, fileNode);
  return fileNode;
}

// ==================== 与自动保存的协作 ====================

const AUTOSAVE_FS_KEY = "autosave.filesystem";
const AUTOSAVE_TAB_BIND_KEY = "autosave.tab_bindings";

/**
 * 保存当前文件系统树结构到 localStorage 和 IndexedDB 。
 */
export async function saveFileSystemState() {
  if (!currentFileSystem) return;

  try {
    // 保存目录树结构元数据（名称、父子关系）
    const treeData = currentFileSystem.toJSON();

    // 保存标签页-文件绑定关系
    const bindings = {};
    for (const [tabId, fileNode] of tab2File) {
      bindings[tabId] = fileNode.id;
    }

    // 持久化到 localStorage
    localStorage.setItem(AUTOSAVE_FS_KEY, JSON.stringify({
      rootName: currentFileSystem.name,
      tree: treeData,
      timestamp: Date.now(),
    }));
    localStorage.setItem(AUTOSAVE_TAB_BIND_KEY, JSON.stringify(bindings));
  } catch (err) {
    console.warn("保存文件系统状态失败：", err);
  }
}

/**
 * 尝试从 localStorage 恢复文件系统状态元数据
 * @returns {{ rootName: string, tree: Object, bindings: Object }|null}
 */
export function loadFileSystemState() {
  try {
    const fsState = JSON.parse(localStorage.getItem(AUTOSAVE_FS_KEY) || "null");
    const bindings = JSON.parse(localStorage.getItem(AUTOSAVE_TAB_BIND_KEY) || "{}");
    if (!fsState) return null;
    return {
      rootName: fsState.rootName,
      tree: fsState.tree,
      bindings,
    };
  } catch {
    return null;
  }
}

// ==================== 文件系统变更监视器（高性能轮询） ====================

/** 监视器的定时器 ID，用于清理 */
let _watcherTimer = null;

/** 监视器的配置 */
const WATCHER_INTERVAL_TREE = 5000;   // 目录结构检查间隔（ms）
const WATCHER_INTERVAL_FILE = 10000;  // 已打开文件的外部修改检查间隔（ms）
let _watcherFileTick = 0;

/**
 * 快速比对根目录的子节点列表是否发生变化（仅比较名称集合）。
 * 不递归深层目录以保持高性能。
 * @param {FolderNode} rootNode
 * @returns {Promise<boolean>} 有变动返回 true
 */
async function hasTreeStructureChanged(rootNode) {
  const diskNames = new Set();
  try {
    for await (const entry of rootNode.handle.values()) {
      diskNames.add(entry.name);
    }
  } catch (_) {
    return false; // 权限不足时忽略
  }

  const memoryNames = new Set();
  for (const child of rootNode.children.values()) {
    memoryNames.add(child.name);
  }

  if (diskNames.size !== memoryNames.size) return true;
  for (const name of diskNames) {
    if (!memoryNames.has(name)) return true;
  }
  return false;
}

/**
 * 检查所有已打开（有标签页绑定）的文件是否被外部程序修改，
 * 若有则询问用户是否重新加载。
 */
async function checkExternalFileModifications() {
  for (const [tabId, fileNode] of tab2File) {
    if (!fileNode.handle || fileNode.lastSavedTimestamp === null) continue;
    try {
      const file = await fileNode.handle.getFile();
      if (file.lastModified !== fileNode.lastSavedTimestamp) {
        const tab = tabs.getTab(tabId);
        const userRsp = await ask(
          i18n.parseSafe("tooltip.tip"),
          i18n.parseSafe("msg.file_changed_external", { target: fileNode.name })
        );
        if (userRsp) {
          // 用户确认重新加载
          const content = await fileNode.read();
          tab.instance.setData(content);
          fileNode.lastSavedTimestamp = file.lastModified;
        } else {
          // 用户忽略本次变更，更新时间戳避免反复弹窗
          fileNode.lastSavedTimestamp = file.lastModified;
        }
      }
    } catch (_) {
      // 文件可能已被删除，忽略
    }
  }
}

/**
 * 文件系统变更监视器执行体。
 * - 每 5s 检查根目录子节点名称集合是否变化 → 变化时触发刷新并推送前端
 * - 每 10s 检查已打开文件的外部修改 → 变化时询问用户是否重新加载
 */
async function watcherTick() {
  if (!currentFileSystem) return;

  // 目录结构检测
  try {
    if (await hasTreeStructureChanged(currentFileSystem)) {
      console.log("检测到文件系统结构变化，正在刷新……");
      // 只刷新根节点级别的 children，深层目录由前端展开时自动同步
      await refreshFolder(currentFileSystem);
      // refreshFolder 已发出 REFRESHED 事件，前端会自动重绘
    }
  } catch (e) {
    console.warn("文件系统结构检测失败：", e);
  }

  // 已打开文件的外部修改检测（降低频率）
  _watcherFileTick++;
  if (_watcherFileTick * WATCHER_INTERVAL_TREE >= WATCHER_INTERVAL_FILE) {
    _watcherFileTick = 0;
    try {
      await checkExternalFileModifications();
    } catch (e) {
      console.warn("外部修改检测失败：", e);
    }
  }
}

/**
 * 启动文件系统变更监视器。
 * 在成功打开工作区后调用。
 */
function startFileSystemWatcher() {
  stopFileSystemWatcher();
  _watcherFileTick = 0;
  _watcherTimer = setInterval(watcherTick, WATCHER_INTERVAL_TREE);
  console.log(`文件系统监视器已启动（目录:${WATCHER_INTERVAL_TREE}ms, 文件:${WATCHER_INTERVAL_FILE}ms）`);
}

/**
 * 停止文件系统变更监视器。
 * 在关闭/重置文件系统时调用。
 */
function stopFileSystemWatcher() {
  if (_watcherTimer !== null) {
    clearInterval(_watcherTimer);
    _watcherTimer = null;
  }
}

/**
 * 从 JSON 元数据 + IndexedDB 句柄重建节点树（递归）。
 * 重建时会保留原始 node.id，保证与已持久化的标签页绑定关系兼容。
 * @param {Object} jsonNode toJSON() 输出的节点数据
 * @param {Object<string, FileSystemHandle>} handles id → handle 的映射
 * @param {string|null} parentId 父节点 id
 * @returns {FileNode|FolderNode|null} 重建后的节点，句柄缺失时返回 null
 */
function reconstructNodeFromJSON(jsonNode, handles, parentId = null) {
  const handle = handles[jsonNode.id];
  if (!handle) {
    console.warn(`重建节点时找不到句柄：${jsonNode.name}（${jsonNode.id}），跳过`);
    return null;
  }

  if (jsonNode.type === "file") {
    const node = new FileNode(jsonNode.name, handle, parentId);
    node.id = jsonNode.id; // 保留原始 ID，使标签页绑定关系仍然有效
    node.dirty = false;
    node.lastSavedTimestamp = jsonNode.lastSavedTimestamp || null;
    return node;
  }

  if (jsonNode.type === "dir") {
    const node = new FolderNode(jsonNode.name, handle, parentId);
    node.id = jsonNode.id;
    node.loaded = false; // 标记未加载——首次访问时会从磁盘同步最新子节点

    // 递归重建子节点
    if (jsonNode.children && Array.isArray(jsonNode.children)) {
      for (const childJson of jsonNode.children) {
        const child = reconstructNodeFromJSON(childJson, handles, node.id);
        if (child) {
          node.children.set(child.id, child);
          nodeMap.set(child.id, child);
          if (child.handle) {
            handleToNodeId.set(child.handle, child.id);
          }
        }
      }
    }

    return node;
  }

  console.warn("未知的节点类型：", jsonNode.type);
  return null;
}

/**
 * 尝试从持久化存储中恢复上一次的工作区状态。
 *
 * 恢复流程：
 * 1. 从 localStorage 读取目录树元数据 + 标签页绑定关系
 * 2. 从 IndexedDB 加载所有 FileSystemHandle
 * 3. 检查根句柄权限，必要时请求授权
 * 4. 重建内存中的文件树（FolderNode / FileNode）
 * 5. 重新打开之前打开的标签页
 * 6. 通知前端重绘文件树
 *
 * @returns {Promise<boolean>} 恢复成功返回 true，否则 false
 */
export async function restoreFileSystem() {
  // ---- 第 1 步：加载持久化的状态元数据 ----
  const state = loadFileSystemState();
  if (!state) {
    console.log("没有可恢复的文件系统状态");
    return false;
  }

  // ---- 第 2 步：从 IndexedDB 加载句柄 ----
  const handles = await loadAllHandlesFromDB();
  if (Object.keys(handles).length === 0) {
    console.log("IndexedDB 中没有文件句柄，无法恢复");
    return false;
  }

  // ---- 第 3 步：检查根句柄权限 ----
  const rootHandle = handles[state.tree.id];
  if (!rootHandle) {
    console.warn("找不到根目录句柄，无法恢复");
    return false;
  }

  try {
    let perm = await rootHandle.queryPermission({ mode: "readwrite" });
    if (perm === "denied") {
      console.warn("文件系统权限已被撤销，无法自动恢复工作区");
      msg(
        i18n.parseSafe("msg.permission_denied_restore"),
        i18n.parseSafe("msg.ok"),
        "warning",
        -1
      );
      return false;
    }
    if (perm === "prompt") {
      // 尝试主动请求权限（浏览器会弹出授权提示）
      perm = await rootHandle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        console.warn("用户未授权文件系统权限，工作区恢复中止");
        return false;
      }
    }
  } catch (e) {
    console.warn("恢复时权限检查失败：", e);
    msg(
      i18n.parseSafe("msg.permission_denied_restore"),
      i18n.parseSafe("msg.ok"),
      "warning",
      -1
    );
    return false;
  }

  // ---- 第 4 步：执行重置，然后重建树 ----
  // 先关闭现有的一切
  if (tabs.getTabsLength() > 0) {
    tabs.closeAllTabs();
  }
  nodeMap.clear();
  currentFileSystem = null;
  tab2File.clear();

  // 重建根节点
  const rootNode = reconstructNodeFromJSON(state.tree, handles, null);
  if (!rootNode || !(rootNode instanceof FolderNode)) {
    console.error("重建文件树失败");
    return false;
  }

  nodeMap.set(rootNode.id, rootNode);
  handleToNodeId.set(rootNode.handle, rootNode.id);
  currentFileSystem = rootNode;
  console.log(`工作区恢复成功：${state.rootName}（${rootNode.children.size} 个子节点）`);

  // ---- 第 5 步：恢复标签页 ----
  // 复用 openFileInTab 逻辑（传递 FileNode 而非文本，以便触发大小/二进制检测）
  const { bindings } = state;
  let restoredTabs = 0;
  for (const [oldTabId, fileNodeId] of Object.entries(bindings)) {
    const fileNode = nodeMap.get(fileNodeId);
    if (fileNode && fileNode.type === "file") {
      try {
        const newTabId = await openFileInTab(fileNode);
        if (newTabId) restoredTabs++;
      } catch (e) {
        console.warn(`无法恢复标签页 "${fileNode.name}"：`, e);
      }
    }
  }
  if (restoredTabs > 0) {
    console.log(`已恢复 ${restoredTabs} 个标签页`);
  }

  // ---- 第 6 步：启动文件系统监视器 ----
  startFileSystemWatcher();

  // ---- 第 7 步：通知前端 ----
  notifyFileSystemChange(FileSystemEvent.OPENED, {
    node: rootNode,
    restored: true,
    tabCount: restoredTabs,
  });

  return true;
}

/**
 * 刷新当前文件系统的目录树（从磁盘重新同步）
 * @param {FolderNode} [folderNode] 要刷新的节点，默认为根
 */
export async function refreshFileSystem(folderNode = null) {
  const target = folderNode || currentFileSystem;
  if (!target || target.type !== "dir") return;

  // 广度优先刷新
  const queue = [target];
  while (queue.length > 0) {
    const current = queue.shift();
    await refreshFolder(current);
    for (const child of current.children.values()) {
      if (child.type === "dir") {
        queue.push(child);
      }
    }
  }
  notifyFileSystemChange(FileSystemEvent.STRUCTURE_CHANGED, { node: target });
}

/**
 * 刷新某个文件夹节点（重新读取目录内容，同步 children）
 * @param {FolderNode} folderNode
 */
export async function refreshFolder(folderNode) {
  if (folderNode.type !== "dir") return;

  // 记录现有子节点名称映射（name → node）
  const existing = new Map();
  for (const child of folderNode.children.values()) {
    existing.set(child.name, child);
  }

  // 遍历实际目录
  const newChildren = new Map();
  for await (const entry of folderNode.handle.values()) {
    let child = existing.get(entry.name);
    if (child) {
      existing.delete(entry.name);
      newChildren.set(child.id, child);
    } else {
      let newNode;
      if (entry.kind === "file") {
        newNode = new FileNode(entry.name, entry, folderNode.id);
      } else {
        newNode = new FolderNode(entry.name, entry, folderNode.id);
      }
      nodeMap.set(newNode.id, newNode);
      handleToNodeId.set(entry, newNode.id);
      newChildren.set(newNode.id, newNode);
    }
  }

  // 删除已不存在的节点
  for (const [, obsoleteNode] of existing) {
    // 若有标签页绑定到此文件，需解绑
    if (obsoleteNode.type === "file") {
      const boundTabs = getTabsBoundToFile(obsoleteNode.id);
      for (const tabId of boundTabs) {
        unbindTab(tabId);
      }
    }
    folderNode.children.delete(obsoleteNode.id);
    nodeMap.delete(obsoleteNode.id);
  }

  folderNode.children = newChildren;
  folderNode.loaded = true;
  notifyFileSystemChange(FileSystemEvent.REFRESHED, { node: folderNode });
}

/**
 * 创建一个软链接（仅内存，不写磁盘）
 * @param {FileNode} fileNode
 * @param {FolderNode} targetFolder
 */
export function softlink(fileNode, targetFolder) {
  if (targetFolder.type !== "dir") throw new Error("目标不是文件夹");
  targetFolder.addChild(fileNode);
}

/**
 * 根据 ID 获取节点
 * @param {string} id
 * @returns {FileNode|FolderNode|undefined}
 */
export function getNodeById(id) {
  return nodeMap.get(id);
}

// ==================== 命令注册 ====================

/* 文件基础操作 */
commands.regisiterCommandWithHotkey("files.open", async () => {
  const fileNode = await openFile();
  if (!fileNode) return;
  openFileInTab(fileNode);
}, "ctrl+o");
commands.regisiterCommand("files.openFolder", () => openFolder());
commands.regisiterCommand("files.close", () => closeFileSystem());

commands.regisiterCommand("files.save", (tabId) => saveToFile(tabId));
commands.regisiterCommand("files.saveAs", (fileName, folder) => saveAsToFile(fileName, folder));
commands.regisiterCommandWithHotkey("files.saveCurrent", () => {
  try {
    saveToFile();
    msg(i18n.parseSafe("msg.saved"), i18n.parseSafe("msg.done"), "success", 2000);
  } catch (e) {
    msg(e.message, i18n.parseSafe("msg.done"), "error");
  }
}, "ctrl+s");

commands.regisiterCommand("files.createFile", (parent, name) => createFile(parent, name));
commands.regisiterCommand("files.createFolder", (parent, name) => createFolder(parent, name));
commands.regisiterCommand("files.delete", (node, recursive) => deleteNode(node, recursive));
commands.regisiterCommand("files.rename", (node, newName) => renameNode(node, newName));
commands.regisiterCommand("files.move", (node, target) => moveNode(node, target));
commands.regisiterCommand("files.copy", (node, target, copyName) => copyNode(node, target, copyName));

commands.regisiterCommand("files.refresh", (folder) => refreshFileSystem(folder));
commands.regisiterCommand("files.resolve", (path, base) => resolvePath(path, base));
commands.regisiterCommand("files.getPath", (node) => getNodePath(node));

/* 编辑器操作命令——供 data-click 声明式绑定使用 */
commands.regisiterCommand("editor.save", () => {
  try {
    saveToFile();
    msg(i18n.parseSafe("msg.saved"), i18n.parseSafe("msg.done"), "success", 2000);
  } catch (e) {
    msg(e.message, i18n.parseSafe("msg.done"), "error");
  }
});
commands.regisiterCommand("editor.saveAs", async () => {
  // 无论是否有文件系统，saveAsToFile 现在均会正确处理：
  // - 有文件系统 → 在目标文件夹创建文件
  // - 无文件系统 → 降级使用浏览器保存对话框
  const suggestedName = window.prompt(i18n.parseSafe("tooltip.saveAs"), "untitled.txt");
  if (!suggestedName) return;
  try {
    await saveAsToFile(suggestedName);
    msg(i18n.parseSafe("msg.savedTo", { path: suggestedName }), i18n.parseSafe("msg.done"), "success", 2000);
  } catch (e) {
    msg(e.message, i18n.parseSafe("msg.done"), "error");
  }
});

/* 自动保存钩子——在 autosave.backup 时同步持久化文件系统状态 */
commands.regisiterCommand("files.saveState", () => saveFileSystemState());

commands.regisiterCommand("files.tablink.close", (tabId) => unbindTab(tabId));

/* 文件系统恢复与权限管理 */
commands.regisiterCommand("files.restore", () => restoreFileSystem());
commands.regisiterCommand("files.reset", () => resetFileSystem());
commands.regisiterCommand("files.checkPermission", () => checkFileSystemPermission());

// ==================== 模块初始化 ====================

/**
 * 清除 autosave 遗留数据。
 * 文件系统恢复成功后会通过 openFileInTab 打开标签页并绑定文件，
 * 而 autosave.recover 如果发现数据也会尝试打开标签页，导致重复。
 * 故在模块加载时（早于 main.js 调用 autosave.recover）同步清除。
 */
function clearAutosaveData() {
  try {
    localStorage.removeItem("autosave.data");
    localStorage.removeItem("autosave.which");
    localStorage.removeItem("autosave.untitledCount");
  } catch (_) { /* 静默忽略 */ }
}
clearAutosaveData();

/** 页面加载时尝试恢复工作区并启动权限监控 */
(async function initFileServer() {
  // 先初始化权限监控（即使没有工作区也要挂载监听）
  initPermissionMonitor();
  
    // 在加载完成后恢复Editor
    window.addEventListener("load", () => {
      commands.executeCommand("autosave.recover");
    });

  // 尝试恢复上一次的工作区
  const restored = await restoreFileSystem();
  if (restored) {
    console.log("工作区已自动恢复");
  } else {
    console.log("无工作区可恢复，等待用户操作");
  }
})();

export default {
  // 核心
  currentFileSystem,
  nodeMap,
  handleToNodeId,
  tab2File,

  // 节点类
  FileNode,
  FolderNode,

  // 路径工具
  resolvePath,
  getNodePath,
  getParent,
  getAncestors,

  // 文件系统生命周期
  openFile,
  openFolder,
  closeFileSystem,
  resetFileSystem,
  restoreFileSystem,
  checkFileSystemPermission,
  initPermissionMonitor,
  reconstructNodeFromJSON,

  // CRUD
  createFile,
  createFolder,
  deleteNode,
  renameNode,
  moveNode,
  copyNode,

  // 刷新
  refreshFolder,
  refreshFileSystem,

  // 软链接
  softlink,
  getNodeById,

  // 标签页协作
  bindTabToFile,
  getFileForTab,
  unbindTab,
  getTabsBoundToFile,
  openFileInTab,
  saveToFile,
  saveAsToFile,

  // 持久化
  saveFileSystemState,
  loadFileSystemState,

  // 观察者模式
  FileSystemEvent,
  onFileSystemChange,
  offFileSystemChange,
  notifyFileSystemChange,
};