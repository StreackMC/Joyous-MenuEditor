/* 这不是一个 ESModule ! */

/**
 * 快速引入 Joyous Menu Editor 的图标资源，该图标必须位于 /assets/icons/ 下。<br>
 * 若不指定后缀名，默认为 svg
 * <pre><code>
 * <icon-import src=""></icon-import>
 * </code></pre>
 */
class IconImport extends HTMLImageElement {
  static get observedAttributes() {
    return ['name'];
  }

  constructor() {
    super();
    this.updateSrc();
  };

  // Name映射到src相关
  updateSrc(name = this.getName()) {
    if (this.getName().match(/\.[a-zA-Z0-9]{2,6}$/)) {
      this.setAttribute("src", `./assets/icons/${name}`);
    } else {
      this.setAttribute("src", `./assets/icons/${name}.svg`);
    };
  };
  getName() { return this.getAttribute('name'); };

  // 注册更新
  connectedCallback() {// 被渲染
    this.updateSrc();
  };
  attributeChangedCallback(name, oldValue, newValue) {// name 被修改
    if (oldValue === newValue) return;
    this.updateSrc();
  };
}

// 注册自定义元素
customElements.define('icon-import', IconImport, { extends: 'img' });