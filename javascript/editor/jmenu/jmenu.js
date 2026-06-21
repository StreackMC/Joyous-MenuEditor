// 编辑器注册默认要求
import editorManager from "../../backend/editorManager.js";
import { Editor } from "../editor.js";
import { JavaButton, BedrockButton, JMenu } from "./dataDef.js";
import MCColors from "../../library/MCColors.js";
const EditorId = "jmenu";

// 导出编辑器类
export class EditorJmenu extends Editor {
  /** @type {JMenu} */
  #data;

  /**
   * @param {import("../../backend/editorManager.js").MemFileNode|import("../../backend/fileServer.js").FileNode} fileNode
   * @param {string} filename
   */
  constructor(fileNode, filename) {
    super(fileNode, filename);
    this.#data = new JMenu()
  };
  getRegId() { return EditorId; };
  getData() { UnsupportedMethodException(); return {}; };
  getElement() { UnsupportedMethodException(); return new Element(); };
  async init() {
    // TODO: 在此读取 fileNode 内容并解析到 #data
    // const text = await this.fileNode.read();
    // this.#data = JMenu.fromJSON(JSON.parse(text));
    UnsupportedMethodException();
  };
  setData(data) { UnsupportedMethodException(); };
  revert(step = 1) { UnsupportedMethodException(); };
  redo(step = 1) { UnsupportedMethodException(); };
  destroy() { UnsupportedMethodException(); };
  requireFlush = true;
};

/**
 * verify 函数 —— data 已由 openEditor 归一化为 FileNode | MemFileNode，
 * 直接调用 `await data.read()` 获取文本内容即可。
 */
editorManager.regisiterEditor(EditorId, async (fileNode, filename) => {
  let content;
  try {
    content = JSON.parse(await fileNode.read());
  } catch (error) {
    content = {};
  }
  if (content.jme === "menu") {
    return (content.title) ? MCColors.remove(content.title) : "Untitled Menu";
  }
  return "";
}, EditorJmenu);