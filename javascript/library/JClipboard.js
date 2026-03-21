/**
 * 对 ClipboardAPI 的封装，自动处理意外情况并与本项目框架结合。
 */
export default {
  get, getAsync, copy
};

import utils from "../ui/utils.js";
import i18n from "../i18n.js";

let api_not_found_msg = () => { return ""; };
if (!navigator.clipboard) {
  api_not_found_msg = () => { return i18n.parseSafe("msg.clipboard.api_not_found"); };
  utils.msg(api_not_found_msg(), i18n.parseSafe("msg.done"), "error", 0);
};

/**
 * 暂停式获取剪贴板内容。相较于使用 {@link getAsync()}，该函数并不方便获取具体拒绝原因但是很简洁方便。
 * @param {boolean} [tip=true] 是否要告知用户状态
 * @returns {string|null} 获取到的文本内容，获取失败或未授权时返回 null
 */
export async function get(tip = true) {
  const promise = await getAsync(tip);
  promise.then((text) => {
    return text;
  }).catch((err) => {
    return null;
  });
};

/**
 * 异步获取剪贴板内容。
 * @see {@link get()} 如果你不想手动处理异步操作，你可以使用这个简化版。
 * @param {boolean} [tip=true] 是否要告知用户状态
 * @returns {Promise} 
 */
export function getAsync(tip = true) {
  return new Promise((resolve, reject) => {
    // API判断
    if (!navigator.clipboard) reject(api_not_found_msg());

    // 获取内容
    navigator.clipboard.readText().then((text) => {
      resolve(text);
    }).catch((err) => {
      reject(err);
      console.error("Failed to get clipboard content because ", err);
      if (tip) utils.msg(i18n.parseSafe("msg.clipboard.ungot", { msg: err.message }), i18n.parseSafe("msg.done"), "error");
    });
  });
};

/**
 * 向剪贴板写入内容，自动处理错误
 * @param {string} [text=""] 源文本
 * @param {boolean} [tip=true] 是否要告知用户状态
 * @returns {Promise} 返回该写入请求的 Promise
 */
export function copy(text = "", tip = true) {
  return new Promise((resolve, reject) => {
    // API判断
    if (!navigator.clipboard) reject(api_not_found_msg());

    // 参数处理
    if (!text) { text = ""; };
    if (typeof text !== "string") { text = String(text); };
    let partedText;
    if (tip) {
      partedText = text.slice(0, 20);
      if (text.length > 20) partedText += "...";
    };

    // 开始写入
    navigator.clipboard.writeText(text).then(() => {
      resolve();
      if (tip) utils.msg(i18n.parseSafe("msg.clipboard.copied", { text: partedText }), i18n.parseSafe("msg.done"), "success");
    }).catch((err) => {
      reject(err);
      console.error("Failed to copy text: ", text, " because ", err);
      if (tip) utils.msg(i18n.parseSafe("msg.clipboard.uncopied", { msg: err.message }), i18n.parseSafe("msg.done"), "error");
    });
  });
};