const EditorId = "example";

/**
 * 编辑器基类 —— 所有编辑器须继承此类并覆写全部方法。
 *
 * ── 数据模型 ──
 * 自 `editorManager.openEditor()` 入口起，所有 `data` 均被**归一化**为
 * `FileNode | MemFileNode` 接口。编辑器**构造器**同步接收此节点并存储引用，
 * 在 `init()` 中通过 `await this.fileNode.read()` 异步读取内容。
 *
 * - `FileNode`  ：来自磁盘文件系统（{@link fileServer.js}）
 * - `MemFileNode`：来自内存（字符串、Blob 等），见 {@link editorManager.js}
 *
 * ── 生命周期 ──
 * ```
 * 1. editorManager.openEditor(rawData, editorId?, filename?)
 *      ↓ 归一化：rawData → FileNode | MemFileNode
 * 2. new MyEditor(fileNode, filename)     ← 同步，只存引用
 *      ↓
 * 3. tabs.openTab(instance, title)
 *      ↓ 内部调用 instance.getElement()
 *      ↓ 挂载到 DOM
 *      ↓ 执行 i18n.refresh / commands.hook
 *      ↓ 切换到标签页
 * 4. instance.init()                      ← 可 async，在此读取数据
 * ```
 *
 * @interface Editor
 */
export class Editor {
  /**
   * @param {import("../backend/editorManager.js").MemFileNode|import("../backend/fileServer.js").FileNode} fileNode - 归一化后的文件节点
   * @param {string} filename - 文件名/标题
   */
  constructor(fileNode, filename) {
    if (new.target === Editor) { UnsupportedMethodException(); };
    /**
     * 文件节点引用。在 `init()` 中通过 `await this.fileNode.read()` 读取内容。
     * @type {import("../backend/editorManager.js").MemFileNode|import("../backend/fileServer.js").FileNode}
     */
    this.fileNode = fileNode;
    /** @type {string} */
    this.filename = filename;
  };
  /**
   * 获取编辑器的标识符
   * @returns {String}
   */
  getRegId() { return EditorId; };
  /**
   * 获取编辑器当前数据
   * @returns {*}
   */
  getData() { UnsupportedMethodException(); return {}; };
  /**
   * 获取编辑器要插入的元素
   * @returns {Element}
   */
  getElement() { UnsupportedMethodException(); return new Element(); };
  /**
   * **后初始化** —— DOM 已挂载完成后调用。
   *
   * 可在此进行以下操作：
   * - 通过 `await this.fileNode.read()` 异步读取文件内容
   * - 绑定事件、创建 Ace / 富文本等第三方实例
   * - 执行需要 DOM 的渲染逻辑
   *
   * 支持返回 `Promise`，但 `tabs.openTab()` 不会等待它完成，
   * 编辑器需自行管理异步流程。
   */
  async init() { UnsupportedMethodException(); };
  /**
   * 设置编辑器数据
   * @param {*} data 理论上这里应该和构造器的那个一样，但是实际取决于调用方。
   */
  async setData(data) { UnsupportedMethodException(); };
  /**
   * 撤销操作
   * @param {number} step 步数
   */
  revert(step = 1) { UnsupportedMethodException(); };
  /**
   * 重做操作
   * @param {number} step 步数
   */
  redo(step = 1) { UnsupportedMethodException(); };
  /**
   * 通知清理编辑器数据，准备销毁
   */
  destroy() { UnsupportedMethodException(); };
  /**
   * 是否需要存盘。没有编辑功能的可以设为 `false`，关闭时不会触发保存检查。
   * @type {boolean}
   */
  requireFlush = false;
};

// ══════════════════════════════════════════════════════════
//  注册示例（解除注释后可用）
// ══════════════════════════════════════════════════════════
//
// 验证函数签名：async (fileNode, filename) => string | false
//   - fileNode : FileNode | MemFileNode（已归一化）
//   - filename : string
//   - 返回非空字符串 = 接受此文件，该字符串用作标签页标题
//   - 返回 "" 或 false = 拒绝
//
// 构造器签名：(fileNode, filename)
//   - fileNode : FileNode | MemFileNode（与 verify 收到的同一个）
//   - filename : string
//   - 同步操作，异步读取请放在 init() 中
//
// import editorManager from "../backend/editorManager.js";
// editorManager.regisiterEditor(EditorId,
//   async (fileNode, filename) => {
//     const text = await fileNode.read();
//     if (text.startsWith("magic")) return filename || "Magic File";
//     return "";
//   },
//   Editor
// );

/* 后生命周期
销毁：
1. 使用 commands.executeCommand("editor.close", index) 来关闭编辑器
2. 此时 tabs.js 自动维护标签页周期，流程略
3. 可能会触发 Editor.getData() 来保存数据
4. 最后使用 destroy() 方法允许 Editor 做清理
    注：先调用再销毁任何已渲染的前端元素

主题：
页面主题状态是被动更新的，即不会主动下发给编辑器
在 ui/utils.js 里面有探测当前颜色主题（黑暗还是白天）的函数 getColorTheme()
推荐注册一个监听 media 的事件，自动切换颜色主题就依赖于这个监听，记得要销毁
*/

function UnsupportedMethodException() {
  throw new Error(`Unsupported Method Here[@${this}]: this function in the class is an interface, which should be extended and overwritten.`);
};

export default { Editor }; // 需要导出你的 Editor 类