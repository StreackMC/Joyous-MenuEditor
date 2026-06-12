/** 在 iframe_handle.html 中加载 */
import i18n from "../../i18n.js";

/** 白名单 */
const whitelist = [
  "kdxiaoyi.top",
  "kdx233.eu.org"
];

/** 需要秒数 */
const requrieTime = 5/* sec */;

/** 页面元素 */
const elements = {
  title: document.getElementById("title"),
  text: document.getElementById("text"),
  confirm_button: document.getElementById("confirmBtn"),
}

/** 获取指定参数的值。<b>没有转义，需要防范注入攻击。</b> @param {String} key 要获取的参数 @returns {String} 未转义的参数 */
function getQueryParam(key) {
  if (!getQueryParam.urlParams) getQueryParam.urlParams = new URLSearchParams(window.location.search);
  return getQueryParam.urlParams.get(key);
}

try {
  const rawURL = getQueryParam("url");
  const safeRawURL = encodeURI(rawURL);
  const targetURL = new URL(rawURL);

  // 判断是否是白名
  let allow = false, timer, timeleft = requrieTime;
  for (const element of whitelist) {
    if (targetURL.host.includes(element)) {
      allow = true;
      break;
    }
  }

  if (allow) {
    // 直接跳转
    window.location.replace(targetURL);
  } else {
    // 显示信息
    elements.title.innerHTML = i18n.parse("editor.browser.title.beforeload");
    elements.text.innerHTML = i18n.parse("editor.browser.text.beforeload", {
      url: safeRawURL,
      target: targetURL.host,
    });
    elements.confirm_button.innerText = i18n.parse("tooltip.confirm") + `(${timeleft}s)`;
    timer = setInterval(() => {
      timeleft--;
      elements.confirm_button.innerText = i18n.parse("tooltip.confirm") + `(${timeleft}s)`;
      if (timeleft <= 0) {
        clearInterval(timer);
        elements.confirm_button.innerText = i18n.parse("tooltip.confirm");
        if (!elements.confirm_button.dataset.error) {
          elements.confirm_button.disabled = false;
          elements.confirm_button.addEventListener("click", () => {
            window.location.assign(targetURL);
          });
        }
      }
    }, 1000);
  }
} catch (error) {
  elements.title.innerHTML = `错误`;
  elements.text.innerHTML = `页面无法初始化，因为：${error.message}`;
  elements.confirm_button.innerHTML = `确定`;
  elements.confirm_button.dataset.error = error.message;
  elements.confirm_button.disabled = true;
  console.error("无法加载页面：", error);
}
