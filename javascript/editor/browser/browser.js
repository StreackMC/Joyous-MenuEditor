const EditorId = "browser";

/**
 * 仅作为一个Interface使用，需要自行 extends
 * @interface Editor 需要覆写全部方法并注册 Editor
 */
export class EditorBrowser extends Editor {
  url = "https://mc.kdxiaoyi.top/Streack/";
  div = document.createElement("div");
  iframe = document.createElement("iframe");
  /**
   * 初始化一个编辑器
   * @param {*} data 
   * @param {string} filename 文件名
   */
  constructor(data, filename) {
    super();
    this.url = data;
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
  getData() { return this.url; };
  /**
   * 获取编辑器要插入的元素
   * @returns {Element}
   */
  getElement() { return this.iframe; };
  /**
   * 通知DOM树已插入，可进行初始化
   */
  init() { this.iframe.src = this.url; };
  /**
   * 设置编辑器数据
   * @param {*} data 
   */
  setData(data) {
    this.iframe.src = new URL(data,this.url).href;
    this.url = this.iframe.src;
  };
  /**
   * 撤销操作
   * @param {number} step 步数
   */
  revert(step = 1) {
    try {
      for (i = 1; i <= step; i++) {
        this.iframe.contentWindow.history.back();
      }
    } catch (ignore/* 同源策略限制无法进行导航 */) { }
  };
  /**
   * 重做操作
   * @param {number} step 步数
   */
  redo(step = 1) {
    try {
      for (i = 1; i <= step; i++) {
        this.iframe.contentWindow.history.forward();
      }
    } catch (ignore/* 同源策略限制无法进行导航 */) { }
  };
  /**
   * 通知清理编辑器数据，准备销毁
   */
  destroy() {
    this.iframe.src = "about:blank";
  };
};

import editorManager from "../../backend/editorManager.js";
import { Editor } from "../editor.js";
editorManager.regisiterEditor(EditorId, (data, filename) => {
  try {
    if (data.length > 2000/* 一般URL长度不超过2000字符 */) { throw new Error("too long data"); };
    const uri = new URL(data);
    return uri.hostname;
  } catch (ignore) {
    return "";
  }
}, EditorBrowser);