// 编辑器注册默认要求
import editorManager from "../../backend/editorManager.js";
import { Editor } from "../editor.js";
import { FileNode } from "../../backend/fileServer.js";
import { JavaButton, BedrockButton, JMenu } from "./dataDef.js";
import MCColors from "../../library/MCColors.js";
const EditorId = "jmenu";

// 导出编辑器类
export class EditorJmenu extends Editor {
  /** @type {JMenu} */
  #data;

  constructor(data, filename) {
    this.#data = new JMenu()
  };
  getRegId() { return EditorId; };
  getData() { UnsupportedMethodException(); return {}; };
  getElement() { UnsupportedMethodException(); return new Element(); };
  init() { UnsupportedMethodException(); };
  setData(data) { UnsupportedMethodException(); };
  revert(step = 1) { UnsupportedMethodException(); };
  redo(step = 1) { UnsupportedMethodException(); };
  destroy() { UnsupportedMethodException(); };
  requireFlush = true;
};

editorManager.regisiterEditor(EditorId, async (data, filename) => {
  let content;
  try {
    if (data instanceof FileNode) {
      content = JSON.parse(await data.read());
    } else if (typeof data === 'string') {
      content = JSON.parse(data.read());
    }
  } catch (error) {
    content = {};
  }
  if (content.jme === "menu") {
    return (content.title) ? MCColors.remove(content.title) : "Untitled Menu";
  }
  return "";
}, EditorJmenu);