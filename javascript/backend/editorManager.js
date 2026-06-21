import { Editor } from "../editor/editor.js";
import i18n from "../i18n.js";
import tabs from "../ui/tabs.js";
import commands from "./commandServer.js";
import { FileNode, FolderNode } from "./fileServer.js";
import UI from "../ui/utils.js";
import { v4 as uuidv4 } from "../library/uuidjs/v4.js";

export let untitledCounts = 1;

/**
 * 获取自增的 Untitled-N 编号
 * @returns {number}
 */
export function getUntitledId() {
  untitledCounts += 1;
  return untitledCounts - 1;
}

/**
 * 已注册的 Editor 类集合
 * @type {Map<string, typeof Editor>}
 */
export let regEditorsClazz = new Map();

/**
 * 已注册的 Editor 验证函数集合
 * @type {Map<string, Function>}
 */
export let regEditorsVarify = new Map();

// ══════════════════════════════════════════════════════════
//  MemFileNode — 内存数据源统一接口
// ══════════════════════════════════════════════════════════

/**
 * 轻量级内存文件节点。
 *
 * 实现与 `FileNode` 相同的异步读取接口（`read` / `file` / `getSize` 等），
 * 但数据完全来自内存而非磁盘。用于将字符串、Blob 等原始数据**归一化**为
 * 统一的 `FileNode` 接口，使编辑器验证函数和构造器无需关心数据来源。
 *
 * **设计意图：**
 * - `openEditor()` 入口处将所有 `data` 统一为 `FileNode | MemFileNode`
 * - 编辑器**构造器**同步接收此节点，惰性存储引用
 * - 编辑器**`init()`** 中通过 `await this.fileNode.read()` 异步读取内容
 *
 * @implements {FileNode} 部分接口（仅文件相关方法）
 */
export class MemFileNode {
  /** @type {string} */ id;
  /** @type {string} */ name;
  /** @type {"file"} */ type = "file";
  /** @type {null} */ parentId = null;
  /** @type {null} */ handle = null;
  /** @type {*} */ #source;
  /** @type {string|undefined} */ #readCache;

  /**
   * @param {string|Blob|ArrayBuffer|*} source 数据源
   * @param {string} [name="untitled"] 文件名
   */
  constructor(source, name = "untitled") {
    this.id = uuidv4();
    this.name = name;
    this.#source = source;
  }

  /**
   * 读取文件内容为文本。
   * 结果会在首次读取后缓存，多次调用安全。
   * @returns {Promise<string>}
   */
  async read() {
    if (this.#readCache !== undefined) return this.#readCache;
    if (typeof this.#source === "string" || this.#source instanceof String) {
      this.#readCache = String(this.#source);
    } else if (this.#source instanceof Blob) {
      this.#readCache = await this.#source.text();
    } else if (this.#source instanceof ArrayBuffer) {
      this.#readCache = new TextDecoder().decode(this.#source);
    } else {
      this.#readCache = String(this.#source);
    }
    return this.#readCache;
  }

  /**
   * 获取文件对象
   * @returns {Promise<File>}
   */
  async file() {
    return new File([await this.read()], this.name);
  }

  /**
   * 获取文件大小（字节）
   * @returns {Promise<number>}
   */
  async getSize() {
    if (this.#source instanceof Blob) return this.#source.size;
    if (this.#source instanceof ArrayBuffer) return this.#source.byteLength;
    const text = await this.read();
    return text.length;
  }

  /**
   * 启发式判断是否为二进制文件。
   * 内存数据默认视为安全文本（显式传入 ArrayBuffer 的编辑器应自行判断）。
   * @returns {Promise<boolean>}
   */
  async isBinaryHeuristic() {
    return false;
  }

  /**
   * 获取最后修改时间
   * @returns {Promise<number>}
   */
  async getLastModified() {
    return Date.now();
  }
}

/**
 * 将任意原始数据归一化为 `FileNode | MemFileNode`。
 *
 * 归一化规则：
 * | 输入类型            | 输出                        |
 * |---------------------|-----------------------------|
 * | `FileNode`          | 原样返回                     |
 * | `MemFileNode`       | 原样返回                     |
 * | `string` / `String` | `new MemFileNode(str, name)` |
 * | `Blob` / `ArrayBuffer` | `new MemFileNode(src, name)` |
 * | 其他 `Object`       | `new MemFileNode(String(obj))` |
 * | `null` / `undefined` | `new MemFileNode("")`        |
 *
 * @param {*} raw - 原始数据
 * @param {string} [name="untitled"] - 建议的文件名
 * @returns {FileNode|MemFileNode}
 */
export function normalizeToFileNode(raw, name = "untitled") {
  if (raw instanceof FileNode || raw instanceof MemFileNode) return raw;
  if (raw === null || raw === undefined) {
    return new MemFileNode("", name);
  }
  if (typeof raw === "string" || raw instanceof String) {
    return new MemFileNode(String(raw), name);
  }
  // Blob / ArrayBuffer / 其他
  return new MemFileNode(raw, name);
}

// ══════════════════════════════════════════════════════════
//  编辑器注册
// ══════════════════════════════════════════════════════════

/**
 * 注册一个编辑器类型。
 *
 * @param {string} id - 编辑器唯一标识符（如 `"ace"`, `"jmenu"`）
 * @param {Function} varify - 验证函数，签名 `async (data: FileNode|MemFileNode, filename: string) => string|false`
 *    接收归一化后的文件节点。返回**非空字符串**表示接受此文件，该字符串用作标签页标题；
 *    返回 `""` 或 `false` 表示拒绝。
 * @param {typeof Editor} clazz - 编辑器类，构造器签名 `(fileNode: FileNode|MemFileNode, filename: string)`
 */
export function regisiterEditor(id, varify, clazz) {
  regEditorsClazz.set(id, clazz);
  regEditorsVarify.set(id, varify);
}

// ══════════════════════════════════════════════════════════
//  打开编辑器
// ══════════════════════════════════════════════════════════

/**
 * 打开一个编辑器，智能识别或强制指定打开方式。
 *
 * **数据归一化：**
 * 入口处将 `data` 统一为 `FileNode | MemFileNode`，之后所有路径（verify /
 * constructor / init）看到的都是同一接口。编辑器在构造器中**惰性存储**
 * 文件节点引用，在 `init()` 中通过 `await this.fileNode.read()` 异步读取。
 *
 * **匹配逻辑：**
 * 1. 若指定 `editorId` → 强制使用对应编辑器，验证失败时回退 `fname` 作标题
 * 2. 否则遍历所有注册的 `varify(data, fname)`，**首个返回非空字符串**的胜出
 * 3. 无匹配 → 降级使用 `ace` 编辑器（预读文本后传入构造器）
 *
 * @param {string|FileNode|MemFileNode|*} [data=""] - 原始数据，内部自动归一化
 * @param {string} [editorId] - 强制使用的编辑器 ID
 * @param {string} [fname] - 建议文件名/标题
 * @returns {Promise<string|null>} 新标签页的 UUID，失败返回 null
 * @throws 若指定 `editorId` 且找不到对应注册类
 */
export async function openEditor(data = "", editorId = undefined, fname = null) {
  // ── 归一化 ──
  const normalized = normalizeToFileNode(data, fname || undefined);
  fname = fname || normalized.name || `Untitled-${getUntitledId()}`;

  // ── 强制指定编辑器 ──
  if (editorId) {
    try {
      const clazz = regEditorsClazz.get(editorId);
      const func = regEditorsVarify.get(editorId);
      if (!clazz) throw new Error(`未注册的编辑器：${editorId}`);

      let title;
      try {
        title = await func.call(null, normalized, fname);
        if (!title) title = `Untitled-${getUntitledId()}`;
      } catch (error) {
        console.warn(`强制使用编辑器 ${editorId} 时验证失败：`, error, "\n 数据：", normalized);
        title = fname;
      }
      return tabs.openTab(new clazz(normalized, fname), title);
    } catch (error) {
      throw new Error(i18n.parseSafe("msg.unknownEditor", { editor: editorId }));
    }
  }

  // ── 自动匹配 ──
  for (const key of regEditorsVarify.keys()) {
    try {
      const title = await regEditorsVarify.get(key).call(null, normalized, fname);
      if (title) {
        const clazz = regEditorsClazz.get(key);
        if (!clazz) continue;
        try {
          return tabs.openTab(new clazz(normalized, fname), title);
        } catch (error) {
          console.warn(`编辑器 ${key} 验证通过但打开失败：`, error);
          continue;
        }
      }
    } catch (error) {
      console.log(`编辑器 ${key} 验证异常：`, error);
      continue;
    }
  }

  // ── ACE 兜底 ──
  const aceClazz = regEditorsClazz.get("ace");
  if (!aceClazz) {
    throw new Error(i18n.parseSafe("editor.ACE.err"));
  }
  try {
    // 大文件 / 二进制检查
    const size = await normalized.getSize();
    if (size >= 1_048_576) {
      const ok = await UI.ask(
        i18n.parseSafe("tooltip.tip"),
        i18n.parse("msg.too_large_file", {
          file: normalized.name,
          size: (size / 1024).toFixed(2),
        })
      );
      if (!ok) return null;
    }
    if (await normalized.isBinaryHeuristic()) {
      const ok = await UI.ask(
        i18n.parseSafe("tooltip.tip"),
        i18n.parse("msg.binary_file_sus", { file: normalized.name })
      );
      if (!ok) return null;
    }

    // ACE 期望构造器直接拿到字符串，故预读后传入
    const textContent = await normalized.read();
    return tabs.openTab(new aceClazz(textContent, fname), fname);
  } catch (error) {
    return null;
  }
}

commands.regisiterCommand("editor.open", openEditor);

/**
 * 获取当前活动编辑器的实例
 * @returns {Editor|null}
 */
export function getCurrentEditor() {
  try {
    const tab = tabs.getTab(tabs.getCurrentTabId());
    return tab.instance || null;
  } catch {
    return null;
  }
}

/** 撤销当前编辑器操作 */
commands.regisiterCommand("editor.revert", (step = 1) => {
  const editor = getCurrentEditor();
  if (editor && typeof editor.revert === "function") {
    editor.revert(step);
  }
});

/** 重做当前编辑器操作 */
commands.regisiterCommand("editor.redo", (step = 1) => {
  const editor = getCurrentEditor();
  if (editor && typeof editor.redo === "function") {
    editor.redo(step);
  }
});

/**
 * 确保数据是一串文本。
 *
 * 与 `normalizeToFileNode` 不同，此函数**直接提取文本内容**而非包装节点。
 * 适用于 ACE 等需要纯文本的兜底场景。
 *
 * @param {string|FileNode|MemFileNode|Object} data - 任意数据
 * @returns {Promise<string>} 文本内容
 */
export async function ensureText(data) {
  if (data instanceof FileNode || data instanceof MemFileNode) {
    return await data.read();
  }
  if (typeof data === "string" || data instanceof String) {
    return String(data);
  }
  try {
    return String(data);
  } catch {
    return "";
  }
}

export default {
  regisiterEditor,
  openEditor,
  regEditorsClazz,
  regEditorsVarify,
  getUntitledId,
  untitledCounts,
  ensureText,
  getCurrentEditor,
  normalizeToFileNode,
  MemFileNode,
};