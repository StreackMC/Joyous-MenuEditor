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
  document.querySelector("title").innerHTML = (title != null && title.length > 0) ? `${title} - Joyous Menu Editor` : `Joyous Menu Editor`;
}
/**
 * 设置标签页标题
 * @param {String} title 
*/
export function setPageTitle(title) {
  document.getElementById("ui-title").innerHTML = (title != null && title.length > 0) ? `${title}` : `Joyous Menu Editor`;
}