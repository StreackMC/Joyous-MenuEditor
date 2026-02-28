import i18n from '../i18n.js';

export default {
  setPageTitle, setTitle, setUITitle,
  msg,
  changeColorTheme, changeShadeTheme
}

const spageEle = document.querySelector("s-page");
const titleEle = document.querySelector("title");
const uiTitleEle = document.getElementById("ui-title");
const mainBtn = document.querySelector("s-icon-button#explorerSwitcher");
function getAppName() {
  return i18n.parseSafe("product.name");
}

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
 * @param {string|boolean} [type='none'] 样式(none, info, success, warning, error) || 为兼容老版本，使用布尔值时视作'error'
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
window.msg = msg;

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
  return spageEle.toggle(target, animationCenter);
};

/**
 * 修改页面配色主题
 * @param {string} target 目标主题
 */
export function changeColorTheme(target = "green") {
  spageEle.colorTheme = target;
};