import tabs from "../ui/tabs";
import { v4 as uuidv4 } from "../library/uuidjs/v4.js";

// ------------------ 文件对象

/**
 * 当前打开的文件系统
 * @type {FileNode|FolderNode|null}
 */
export let currentFileSystem = null;

export function resolvePath(path = "", base = "") {
  try {
    let goal = currentFileSystem;
    if (!goal) throw new Error("没有可用的文件系统");

    // 解析 base ，先标准化输入
    if (path.startsWith("/") || (!base)) base = "";

    let triedResult = 

    // UUID无效，尝试递归解析
    const baseSplited = base.split("/");
    for (const element of baseSplited) {
      let triedResult = goal.resolve(element);
      if ((!triedResult) || triedResult.type != 'dir') {
        throw new Error("在节点", goal, "下发现无效的中间节点 ", element);
      }
      goal = triedResult;
    }
  } catch (e) {
    console.warn("无法基于", base, "解析路径 ", path, "：", e);
    return null;
  }
}

/** 一个文件对象 */
export class FileNode {
  constructor(name, handle, parentId = null) {
    this.id = uuidv4();
    this.name = name;           // 文件名
    this.type = "file";
    this.parentId = parentId;   // 父文件夹节点 id
    this.handle = handle;       // FileSystemFileHandle
    this.dirty = false;         // 未保存修改标记
    this.lastSavedTimestamp = null; // 上次保存时文件的修改时间
  }

  async read() {
    const file = await this.handle.getFile();
    return await file.text();
  }

  async save(content) {
    const writable = await this.handle.createWritable();
    await writable.write(content);
    await writable.close();
    const file = await this.handle.getFile();
    this.lastSavedTimestamp = file.lastModified;
    this.dirty = false;
  }
}

/** 一个文件夹对象 */
export class FolderNode {
  constructor(name, handle, parentId = null) {
    this.id = uuidv4();
    this.name = name;
    this.type = "dir";
    this.parentId = parentId;
    this.handle = handle;           // FileSystemDirectoryHandle
    this.children = new Map();      // key: 子节点 id, value: FileNode | FolderNode
    this.loaded = false;            // 是否已加载子节点内容
  }

  /**
   * 递归加载目录下的所有子节点（懒加载，首次调用时填充 children）
   * @returns {Promise<void>}
   */
  async loadChildren() {
    if (this.loaded) return;
    this.loaded = true;
    for await (const entry of this.handle.values()) {
      const existing = this.resolve(entry.name);
      if (existing) continue; // 避免重复添加
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
   * 导航到子节点
   * @param {string} name 子文件（夹）名称
   */
  resolve(name) {
    for (const child of this.children.values()) {
      if (child.name === name) return child;
    }
    return null;
  }

  /** 根据 UUID 导航到子节点 */
  resolveById(id) {
    return this.children.get(id);
  }

  addChild(node) {
    node.parentId = this.id;
    this.children.set(node.id, node);
    nodeMap.set(node.id, node);
  }

  removeChild(id) {
    const node = this.children.get(id);
    if (node) {
      node.parentId = null;
      this.children.delete(id);
      nodeMap.delete(id);
    }
  }
}

/** @type {Map<string, FileNode|FolderNode>} id -> 任意节点 */
export const nodeMap = new Map();

/** @type {Map<string, string>} 文件句柄的引用计数或简单映射（未使用） */
export const handleToNodeId = new WeakMap();

/**
 * 打开单个文件（通过文件选择器）
 * @returns {Promise<FileNode|null>} 返回创建的 FileNode，若用户取消则返回 null
 */
export async function openFile() {
  if (!window.showOpenFilePicker) {
    throw new Error("无法打开文件：不支持 FileSystemAccessAPI 。");
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: "文本/配置文件",
        accept: { "text/plain": [".txt", ".json", ".yaml", ".yml", ".cfg", ".conf", ".ini", ".xml", ".md"] }
      }],
      excludeAcceptAllOption: false,
      multiple: false,
    });
    const file = await handle.getFile();
    const node = new FileNode(file.name, handle);
    nodeMap.set(node.id, node);
    return node;
  } catch (err) {
    if (err.name !== "AbortError") {
      throw new Error("无法打开文件：" + err.message);
    }
    return null;
  }
}

/**
 * 打开文件夹，递归构建目录树，并添加到 roots 数组
 * @returns {Promise<FolderNode|null>}
 */
export async function openFolder() {
  if (!window.showDirectoryPicker) {
    throw new Error("无法打开文件夹：不支持的 API 。");
  }
  try {
    const handle = await window.showDirectoryPicker();
    const rootNode = new FolderNode(handle.name, handle);
    nodeMap.set(rootNode.id, rootNode);
    // 立即加载子节点（也可以懒加载，但通常用户期望看到内容）
    await rootNode.loadChildren();
    currentFileSystem = rootNode;
    return rootNode;
  } catch (err) {
    if (err.name !== "AbortError") {
      throw new Error("无法打开文件夹：" + err.message);
    }
    return null;
  }
}

/**
 * 创建一个软链接，注意这不会往硬盘上面写一个软链接
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

/**
 * 刷新某个文件夹节点（重新读取目录内容，同步 children）
 * @param {FolderNode} folderNode
 */
export async function refreshFolder(folderNode) {
  if (folderNode.type !== "dir") return;
  // 记录现有子节点名称映射（name -> node）
  const existing = new Map();
  for (const child of folderNode.children.values()) {
    existing.set(child.name, child);
  }
  // 遍历实际目录
  const newChildren = new Map();
  for await (const entry of folderNode.handle.values()) {
    let child = existing.get(entry.name);
    if (child) {
      // 已存在，移除原有标记
      existing.delete(entry.name);
      // 如果类型变了（例如文件变文件夹？极少见，忽略）
      newChildren.set(child.id, child);
    } else {
      // 新增节点
      let newNode;
      if (entry.kind === "file") {
        newNode = new FileNode(entry.name, entry, folderNode.id);
      } else {
        newNode = new FolderNode(entry.name, entry, folderNode.id);
        // 不自动加载深层子节点，保留懒加载能力
      }
      nodeMap.set(newNode.id, newNode);
      newChildren.set(newNode.id, newNode);
    }
  }
  // 删除已不存在的节点
  for (const [name, obsoleteNode] of existing) {
    folderNode.children.delete(obsoleteNode.id);
    nodeMap.delete(obsoleteNode.id);
    // 不处理深层
  }
  folderNode.children = newChildren;
  // 更新 loaded 标志（已经加载过）
  folderNode.loaded = true;
}

// ------------------ 与标签页的协作
/** 存储标签页到文件对象的映射 */
export const tab2File = new Map();

/**
 * 保存标签页的数据到文件
 * @param {number} tab 第几个标签页，不存在抛出错误
 */
export function saveToFile(tab = tabs.getCurrentTabId()) {
  if (tabs < 0 || tabs >= tabs.tabs.length) {
    throw new Error("无法保存数据：找不到标签页 #" + tab);
  }
}

// ------------------ 与自动保存的协作

// TODO: autosave.js会记录当前的目录树，并新增标签页和文件的绑定关系。