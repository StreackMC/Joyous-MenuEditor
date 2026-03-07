import { Editor } from "../editor.js";
import editorManager from "../../backend/editorManager.js";
import utils from "../../ui/utils.js";

const EditorId = "aceDefaultEditor";
const s = `
div.ace-editor-joyous { height:100%; }
`;

export class EditorAce extends Editor {
  /**
   * @param {string} content - 文件内容
   * @param {string} fileName - 文件名（用于检测语言和显示标题）
   */
  constructor(content, fileName) {
    super(content); // 调用父类构造函数（父类可能只接收一个参数，这里传内容）
    this.content = content || '';
    this.fileName = fileName || 'untitled';
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

  setData(content) {
    // 仅更新内容，文件名不变
    this.content = content;
    if (this.editorInstance) {
      this.editorInstance.setValue(content || '', -1);
    }
  }

  async init() {
    if (this.isInitialized) return;
    if (!this.container || !this.container.isConnected) {
      // 如果容器还未插入 DOM，等待一下
      await new Promise(resolve => setTimeout(resolve, 50));
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
}

// 注册编辑器
editorManager.regisiterEditor(EditorId, (data, filename) => {
  return "";
  // ACE 作为兜底编辑器不主动竞争文件
  // return (filename) ? filename : `Untitled-${editorManager.getUntitledId()}`;
}, EditorAce);

export default { EditorAce };