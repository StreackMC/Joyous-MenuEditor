// 编辑器注册默认要求
import editorManager from "../../backend/editorManager.js";
import { Editor } from "../editor.js";
const EditorId = "jmenu";


// 导出编辑器类
export class EditorJmenu extends Editor {
  constructor(data, filename) {
    if (new.target === Editor) { UnsupportedMethodException(); };
  };
  getRegId() { return EditorId; };
  getData() { UnsupportedMethodException(); return {}; };
  getElement() { UnsupportedMethodException(); return new Element(); };
  init() { UnsupportedMethodException(); };
  setData(data) { UnsupportedMethodException(); };
  revert(step = 1) { UnsupportedMethodException(); };
  redo(step = 1) { UnsupportedMethodException(); };
  destroy() { UnsupportedMethodException(); };
};
editorManager.regisiterEditor(EditorId, (data, filename) => {
  return "";
}, EditorJmenu);

// 开始编辑器代码
import elementsManager from './jmenuElements.js';
