import i18n from '../i18n.js';

export default {
  setPageTitle, setTitle, setUITitle,
  msg, ask, askfor, dialog,
  changeColorTheme, changeShadeTheme,
  getColorTheme, getShadeTheme,
};

let shadeTheme = "light";
let colorTheme = "green";
const Dialog = customElements.get("s-dialog");
const spageEle = document.querySelector("s-page");
const titleEle = document.querySelector("title");
const uiTitleEle = document.getElementById("ui-title");
const mainBtn = document.querySelector("s-icon-button#explorerSwitcher");
function getAppName() {
  return i18n.parseSafe("product.name");
}
if (!window.joyous) window.joyous = {};

/**
 * 
 * @param {string} title 标题
 * @param {string} text 内容
 * @param {boolean} allowCancel 是否要添加一个「取消」按键。点击后Promise会被reject.
 * @param  {string[]} btns 按钮列表，每个都是一个文本，用作按钮显示的文字。点击后会 resolve 第几个被点击。 0 起始。
 * @returns 
 */
export function dialog(title = "", text = "", allowCancel = true, btns = [i18n.parseSafe("tooltip.confirm")]) {
  return new Promise((resolve, reject) => {
    const btnList = [];
    if (allowCancel) btnList.push({ text: i18n.parseSafe("tooltip.cancel"), click: (event) => { reject(event); } });
    btns.forEach((element, i) => {
      btnList.push({ text: element, click: (event) => { resolve(i); } });
    });
    const dialog = Dialog.builder({
      headline: title, text: text,
      actions: btnList,
    });
    dialog.setAttribute("disable-bg-close", "true");
    dialog.setAttribute("disable-forced-size", "true");
    dialog.showed = true;
  });
}

/**
 * 拉起一个对话框并等待用户作答
 * @param {string} title 对话框标题
 * @param {string} text 对话框内容
 * @param {string} confirmText 「确认」的文本
 * @param {string} cancelText 「取消」的文本
 * @returns {Promise<MouseEvent>} 异步操作。其拒绝与成功取决于用户作答。
 * @see {@link ask()} 只关心返回值可以用这个
 */
export function askfor(title = "", text = "", confirmText = i18n.parseSafe("tooltip.confirm"), cancelText = i18n.parseSafe("tooltip.cancel")) {
  return new Promise((resolve, reject) => {
    const dialog = Dialog.builder({
      headline: title, text: text,
      actions: [
        { text: cancelText, click: (event) => { reject(event); }},
        { text: confirmText, click: (event) => { resolve(event); }},
      ]
    });
    dialog.setAttribute("disable-bg-close", "true");
    dialog.setAttribute("disable-forced-size", "true");
  });
}
window.joyous.askfor = askfor;

/**
 * 拉起一个对话框并等待用户作答
 * @param {string} title 对话框标题
 * @param {string} text 对话框内容
 * @param {string} confirmText 「确认」的文本
 * @param {string} cancelText 「取消」的文本
 * @returns {Promise<boolean>} 需要 await 阻塞处理。用户是否「确认」。
 * @see {@link askfor()} 如果你需要拿到点击事件的话
 */
export async function ask(title = "", text = "", confirmText = i18n.parseSafe("tooltip.confirm"), cancelText = i18n.parseSafe("tooltip.cancel")) {
  try {
    await askfor(title, text, confirmText, cancelText);
    return true;
  } catch (error) {
    return false
  }
}
window.joyous.ask = ask;

/**
 * 设置标题
 * @param {String} title 
 */
export function setTitle(title) {
  setUITitle(title);
  setPageTitle(title);
}

/**
 * 设置UI标题
 * @param {String} title 
 */
export function setUITitle(title) {
  titleEle.innerHTML = (title != null && title.length > 0) ? `${title} - ${getAppName()}` : `${getAppName()}`;
}

/**
 * 设置标签页标题
 * @param {String} title 
*/
export function setPageTitle(title) {
  uiTitleEle.innerHTML = (title != null && title.length > 0) ? `${title}` : `${getAppName()}`;
}

/**
 * 弹出轻量消息提示框
 * @param {string} Message 消息文本
 * @param {string} [ConfirmBtnText=''] 确认按钮文字
 * @param {'none'|'info'|'success'|'warning'|'error'|true} [type='none'] 样式 || 为兼容老版本，使用布尔值时视作'error'
 * @param {number} [duration=4000] 自动关闭时长（毫秒）；≤0 则不自动关闭
 * @param {function} [onclick] 点击确认按钮时的回调函数
 * @param {string} [align='auto'] 弹窗位置 'auto'|'top'|'bottom'
 * @param {string} [icon] 传递一个图标
 * @returns {JSON} 传递参数时构造的JSON
 */
export function msg(Message, ConfirmBtnText, type, duration, onclick, align, icon) {
  let infoJSON = {
    root: spageEle,
    text: Message,
    type: type,
    action: {},
  };
  if (ConfirmBtnText) { infoJSON.action.text = ConfirmBtnText.toString(); };
  if (type === true) { infoJSON.type = "error"; };
  if (duration) { infoJSON.duration = parseInt(duration.toString()); };
  if (onclick) { infoJSON.action.click = onclick; };
  if (align) { infoJSON.align = ["auto", "top", "bottom"][align.toString().match(/\d+/) % 3]; };
  if (icon) { infoJSON.icon = icon; };
  customElements.get("s-snackbar").builder(infoJSON);
  return infoJSON;
};
// 挂载到全局对象上
window.joyous.msg = msg;

/**
 * 修改页面明暗主题
 * @param {string} target 目标主题 auto, light, dark
 * @param {HTMLElement|any} [animationCenter] 动画中心元素
 * @returns {any}
 */
export function changeShadeTheme(target, animationCenter = mainBtn) {
  if /* 若传入无效动画中心元素则指定为侧栏按钮 */ (!(animationCenter instanceof HTMLElement)) {
    animationCenter = mainBtn;
  };
  shadeTheme = target;
  return spageEle.toggle(target, animationCenter);
};

/**
 * 修改页面配色主题
 * @param {string} target 目标主题
 */
export function changeColorTheme(target = "green") {
  colorTheme = target;
  spageEle.colorTheme = target;
};

/**
 * 获取页面明暗主题
 * @returns {string} auto, light, dark
 */
export function getShadeTheme() {
  return shadeTheme;
};

/**
 * 获取页面配色主题
 * @returns {string} 目标主题
 */
export function getColorTheme() {
  return colorTheme;
};