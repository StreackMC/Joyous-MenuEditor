const EditorId = "browser";

/**
 * 内嵌浏览器编辑器 —— 将 URL 内容展示在 iframe 中。
 * data 已由 openEditor 归一化为 FileNode | MemFileNode，
 * 构造器不直接读取，通过 **init()** 或构造器中的异步微任务获取 URL。
 */
export class EditorBrowser extends Editor {
  url = "https://mc.kdxiaoyi.top/Streack/";
  iframe = document.createElement("iframe");
  /**
   * @param {import("../../backend/editorManager.js").MemFileNode|import("../../backend/fileServer.js").FileNode} fileNode
   * @param {string} filename
   */
  constructor(fileNode, filename) {
    super(fileNode, filename);
    // 构造器不能 await，但可以启动异步读取
    // 同时保存引用以便 init() 中再次确认
    this.url = "./iframe_handle.html?url=";
    this._pendingUrl = fileNode.read().then(text => {
      this.url = "./iframe_handle.html?url=" + encodeURIComponent(text);
      // 如果 iframe 已经挂载且 init 已过，直接设置
      if (this.iframe && !this.iframe.src) {
        this.iframe.src = this.url;
      }
    });
  };
  getRegId() { return EditorId; };
  getData() { return this.url; };
  getElement() { return this.iframe; };
  async init() {
    // 等待 URL 解析完成再设置 iframe 地址
    await this._pendingUrl;
    this.iframe.src = this.url;
  };
  setData(data) {
    this.iframe.src = new URL(data,this.url).href;
    this.url = this.iframe.src;
  };
  revert(step = 1) {
    try {
      for (let i = 1; i <= step; i++) {
        this.iframe.contentWindow.history.back();
      }
    } catch (ignore) { }
  };
  redo(step = 1) {
    try {
      for (let i = 1; i <= step; i++) {
        this.iframe.contentWindow.history.forward();
      }
    } catch (ignore) { }
  };
  destroy() {
    this.iframe.src = "about:blank";
  };
};

import editorManager from "../../backend/editorManager.js";
import { Editor } from "../editor.js";

/**
 * verify 函数 —— data 已归一化为 FileNode | MemFileNode，
 * 通过 `await data.read()` 获取 URL 文本。
 */
editorManager.regisiterEditor(EditorId, async (fileNode, filename) => {
  try {
    const text = (await fileNode.read()).trim();
    if (text.length > 2000) throw new Error("too long data");
    const uri = new URL(text);
    return uri.hostname;
  } catch (ignore) {
    return "";
  }
}, EditorBrowser);