import { Editor } from "../editor/editor.js";
import i18n from "../i18n.js";
import tabs from "../ui/tabs.js";
import commands from "./commands.js";

export let untitledCounts = 1;
/**
 * 获取一个 Untitled- 后面接的id,自动自增
 * @returns 
 */
export function getUntitledId() {
  untitledCounts += 1;
  return untitledCounts - 1;
}

/**
 * 已注册的 Editor 和 标识符
 * @type {Map<string,Editor>}
 */
export let regEditorsClazz = new Map();
/**
 * 已注册的 Editor 和 验证函数
 * @type {Map<string,Function>}
 */
export let regEditorsVarify = new Map();

/**
 * 
 * @param {string} id Editor 标识符
 * @param {Function} varify 验证函数
 * @param {Class} clazz 类
 */
export function regisiterEditor(id, varify, clazz) {
  regEditorsClazz.set(id, clazz);
  regEditorsVarify.set(id, varify);
}

/**
 * 打开一个编辑器，智能识别打开方式
 * @param {*} data 数据
 * @param {string} editorId 打开方式
 * @param {string} fname 编辑器标题，建议传入文件名，最终由实际的编辑器决定
 */
export function openEditor(data, editorId = undefined, fname = null) {
  fname = (fname) ? fname : `Untitled-${getUntitledId()}`;
  if (editorId) {
    // 如果指定了打开方式则直接打开
    const clazz = regEditorsClazz.get(editorId);
    tabs.openTab(new clazz(data, fname), fname);
  };
  // 判断打开方式
  try {
    regEditorsVarify.forEach((value, key) => {
      try {
        const title = value.apply(this, data, fname);
        if (title) {
          const clazz = regEditorsClazz.get(key);
          tabs.openTab(new clazz(data, fname), title);
          throw new Error("break here");
        };
      } catch (error) {
        console.log(`编辑器 ${key} 无法验证文件类型：`, error);
        return;
      };
    });
  } catch (ignore) {
    return;
  };

  // 没有打开方式，尝试默认编辑器 ACE
  const aceClazz = regEditorsClazz.get("aceDefaultEditor");
  if (!aceClazz) {
    throw new Error(i18n.parseSafe("editor.ACE.err"));
  }
  tabs.openTab(new aceClazz(data, fname), fname);
}

commands.regisiterCommand("editor.open", openEditor);

export default {
  regisiterEditor, openEditor,
  regEditorsClazz, regEditorsVarify,
  getUntitledId, untitledCounts
}