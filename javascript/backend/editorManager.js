import { Editor } from "../editor/editor.js";
import i18n from "../i18n.js";
import tabs from "../ui/tabs.js";
import commands from "./commandServer.js";
import { FileNode, FolderNode } from "./fileServer.js";
import UI from "../ui/utils.js";

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
 * @returns {Promise<string|null>} 打开失败使用 null
 * @param {string|FileNode} data 数据
 * @param {string} editorId 打开方式
 * @param {string} fname 编辑器标题，建议传入文件名，最终由实际的编辑器依据此参数决定；指定了打开方式时且目标编辑器没有返回有效标题时则改为使用此参数。
 * @throws 找不到目标编辑器，若没有指定编辑器抛出此错误时表示默认的 ACE 编辑器都不可用
 */
export async function openEditor(data = "", editorId = undefined, fname = null) {
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
      const tabId = tabs.openTab(new clazz(data, fname), title);
      return tabId;
    };
  } catch (error) {
    throw new Error(i18n.parseSafe("msg.unknownEditor", { editor: editorId }));
  }

  // 判断打开方式
  let tabId = null;
  for (const key of regEditorsVarify.keys()) {
    try {
      const title = regEditorsVarify.get(key).apply(this, [data, fname]);
      if (title) {
        const clazz = regEditorsClazz.get(key);
        try {
          tabId = tabs.openTab(new clazz(data, fname), title);
        } catch (error) {
          console.warn(`编辑器 ${key} 验证了文件类型，但无法打开：`, error)
          continue;
        }
        break;
      } else {
        continue;
      };
    } catch (error) {
      console.log(`编辑器 ${key} 无法验证文件类型：`, error);
      continue;
    };
  };
  if (tabId) { return tabId; };

  // 没有打开方式，尝试默认编辑器 ACE
  const aceClazz = regEditorsClazz.get("ace");
  if (!aceClazz) {
    throw new Error(i18n.parseSafe("editor.ACE.err"));
  }
  try {
    if (data instanceof FileNode) {
      const size = await data.getSize();
      if (size >= 1048576/* Byte */) {
        const usrRsp_size = await UI.ask(i18n.parseSafe("tooltip.tip"), i18n.parse("msg.too_large_file", { file: data.name, size: (size / 1024).toFixed(2) }));
        if (!usrRsp_size) throw new Error("Aborted by user [too_large_size]");
      }
      if (await data.isBinaryHeuristic()) {
        const usrRsp_bin = await UI.ask(i18n.parseSafe("tooltip.tip"), i18n.parse("msg.binary_file_sus", { file: data.name }));
        if (!usrRsp_bin) throw new Error("Aborted by user [binary_file_sus]");
      }
    }
    const dataTexted = await ensureText(data);
    return tabs.openTab(new aceClazz(dataTexted, fname), fname);
  } catch (error) {
    return null;
  }
}

commands.regisiterCommand("editor.open", openEditor);

/**
 * 获取当前活动编辑器的实例
 * @returns {Editor|null}
 */
export function getCurrentEditor() {
  try {
    const tab = tabs.getTab(tabs.getCurrentTabId());
    return tab.instance || null;
  } catch {
    return null;
  }
}

/** 撤销当前编辑器操作 */
commands.regisiterCommand("editor.revert", (step = 1) => {
  const editor = getCurrentEditor();
  if (editor && typeof editor.revert === "function") {
    editor.revert(step);
  }
});

/** 重做当前编辑器操作 */
commands.regisiterCommand("editor.redo", (step = 1) => {
  const editor = getCurrentEditor();
  if (editor && typeof editor.redo === "function") {
    editor.redo(step);
  }
});

/**
 * 确保数据是一串文本
 * @param {string|FileNode|Object} data 原数据
 * @return {string|Promise<String>} 封装为一个文本
 */
export async function ensureText(data) {
  if (typeof data === "string") {
    return data;
  } else if (data instanceof String) {
    return data;
  } else if (data instanceof FileNode) {
    return await data.read();
  } else {
    try {
      // 尝试调用可能实现的 toString() 方法
      return data.toString();
    } catch (error) {
      return new String(data);
    }
  }
}

export default {
  regisiterEditor, openEditor,
  regEditorsClazz, regEditorsVarify,
  getUntitledId, untitledCounts,
  ensureText,
  getCurrentEditor,
};