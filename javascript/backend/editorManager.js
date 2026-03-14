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
 * @param {string} fname 编辑器标题，建议传入文件名，最终由实际的编辑器依据此参数决定；指定了打开方式时且目标编辑器没有返回有效标题时则改为使用此参数。
 * @throws 找不到目标编辑器，若没有指定编辑器抛出此错误时表示默认的 ACE 编辑器都不可用
 */
export function openEditor(data = "", editorId = undefined, fname = null) {
  fname = (fname) ? fname : `Untitled-${getUntitledId()}`;

  // 如果指定了打开方式则直接打开
  try {
    if (editorId) {
      const clazz = regEditorsClazz.get(editorId);
      const func = regEditorsVarify.get(editorId);
      let title;
      try {
        title = func.apply(this, [data, fname]);
        if (!title) { throw new Error("目标编辑器不支持打开此类文件"); };
      } catch (error) {
        console.warn(`强制使用编辑器 ${editorId} 时，无法获取编辑器标题：`, error, "\n 目标数据：", data);
        title = fname;
      }
      tabs.openTab(new clazz(data, fname), title);//不catch潜在的null，由调用者自行处理
    };
  } catch (error) {
    throw new Error(i18n.parseSafe("msg.unknownEditor", { editor: editorId }));
  }

  // 判断打开方式
  try {
    regEditorsVarify.forEach((value, key) => {
      try {
        const title = value.apply(this, [data, fname]);
        if (title) {
          const clazz = regEditorsClazz.get(key);
          tabs.openTab(new clazz(data, fname), title);
          throw new Error("break here");// todo：用throw中断不太合理
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
  const aceClazz = regEditorsClazz.get("ace");
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
};