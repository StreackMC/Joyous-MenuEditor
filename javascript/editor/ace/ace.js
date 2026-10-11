import { Editor } from "../editor.js";
import editorManager from "../../backend/editorManager.js";
import utils from "../../ui/utils.js";

const EditorId = "ace";
const s = `
div.ace-editor-joyous { height:100%; }
`;

export class EditorAce extends Editor {
  /**
   * ACE 既可作为兜底编辑器（`openEditor` 的 fallback 会**预读文本**，
   * 于是 `content` 为 `string`），也可能被**强制指定**（如 `file.new` / 新建文件），
   * 此时 `content` 为 `FileNode | MemFileNode`，需在 `init()` 中异步读取。
   *
   * @param {string|import("../../backend/fileServer.js").FileNode|import("../../backend/editorManager.js").MemFileNode} content
   *    预读的文本内容，或待读取的文件节点
   * @param {string} fileName - 文件名（用于检测语法高亮和显示标题）
   */
  constructor(content, fileName) {
    const isFileNode = !!content && typeof content.read === 'function';
    // 传入节点时交给父类存储，统一在 init() 中异步读取
    super(isFileNode ? content : null, fileName || "untitled");
    this.content = isFileNode ? '' : ((typeof content === 'string') ? content : String(content ?? ''));
    this.fileName = this.filename;
    this.container = null;
    this.editorInstance = null;
    this.isInitialized = false;
  }

  getData() {
    // 返回当前编辑器内容
    if (!this.editorInstance) return this.content;
    return this.editorInstance.getValue();
  }

  getElement() {
    if (this.container) return this.container;
    // 创建容器，Ace 将挂载到此 div
    const subdiv = document.createElement('div');
    subdiv.style = `width:100%;height:100%;`;
    subdiv.classList.add('ace-editor-container');

    const style = document.createElement("style");
    style.innerHTML = s;

    this.container = document.createElement('div');
    this.container.classList.add("ace-editor-joyous");
    this.container.appendChild(subdiv);
    this.container.appendChild(style);
    return this.container;
  }

  async setData(content) {
    // 仅更新内容，文件名不变
    this.content = (typeof content === 'string') ? content : String(content ?? '');
    if (this.editorInstance) {
      this.editorInstance.setValue(this.content, -1);
    }
  }

  async init() {
    if (this.isInitialized) return;
    if (!this.container || !this.container.isConnected) {
      // 如果容器还未插入 DOM，等待一下
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // 强制指定编辑器时构造器拿到的是文件节点，在此异步读取内容
    if (this.fileNode) {
      try {
        this.content = await this.fileNode.read();
      } catch (error) {
        console.warn("ACE 编辑器读取文件内容失败：", error);
      }
    }

    if (typeof ace === 'undefined') {
      utils.msg(i18n.parseSafe("editor.ACE.err"), i18n.parseSafe("msg.done"), "warning");
      console.error(i18n.parseSafe("editor.ACE.err"));
      return;
    }

    const mode = this.getAceMode(this.fileName);

    this.container.parentElement.classList.add("ace-editor-joyous");

    this.editorInstance = ace.edit(this.container.firstChild, {
      value: this.content,
      mode: mode,
      theme: 'ace/theme/monokai', // 可选主题
      fontSize: 14,
      showPrintMargin: false,
      wrap: true,
      enableBasicAutocompletion: true,
      enableLiveAutocompletion: true,
      enableSnippets: false
    });

    this.isInitialized = true;
  }

  getAceMode(fileName) {
    if (!fileName) return 'ace/mode/text';
    const ext = fileName.split('.').pop().toLowerCase();
    const modeMap = {
      'js': 'javascript', 'ts': 'typescript', 'jsx': 'javascript', 'tsx': 'typescript',
      'json': 'json', 'html': 'html', 'css': 'css', 'md': 'markdown',
      'py': 'python', 'java': 'java', 'c': 'c_cpp', 'cpp': 'c_cpp', 'go': 'golang',
      'rs': 'rust', 'php': 'php', 'rb': 'ruby', 'swift': 'swift', 'kt': 'kotlin',
      'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml', 'sql': 'sql',
      'sh': 'sh', 'bash': 'sh',
    };
    return `ace/mode/${modeMap[ext] || 'text'}`;
  }

  destroy() {
    if (this.editorInstance) {
      this.editorInstance.destroy();
      this.editorInstance = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.isInitialized = false;
  }

  getRegId() {
    return EditorId;
  }

  revert(step = 1) { UnsupportedMethodException(); };

  redo(step = 1) { UnsupportedMethodException(); };

  requireFlush = true;
}

// 注册编辑器
// ACE 作为兑底编辑器不主动竞争文件（验证始终返回 false）
editorManager.regisiterEditor(EditorId, () => false, EditorAce, () => "");

export default { EditorAce };