/**
 * 快速引入 Joyous Menu Editor 的图标资源，该图标必须位于 /assets/icons/ 下。<br>
 * 若不指定后缀名，默认为 svg
 * <pre><code>
 * <icon-import src=""></icon-import>
 * </code></pre>
 */
export class IconImport extends HTMLImageElement {
  static get observedAttributes() {
    return ['name'];
  }

  constructor() {
    super();
  };

  // Name映射到src相关
  updateSrc(name = this.name()) {
    if (name.match(/\.[a-zA-Z0-9]{2,6}$/)) {
      this.setAttribute("src", `./assets/icons/${name}`);
    } else {
      this.setAttribute("src", `./assets/icons/${name}.svg`);
    };
  };
  name() {
    const attr = this.getAttribute('name');
    return (attr !== null) ? attr : '';
  };

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
customElements.define('j-icon', IconImport, { extends: 'img' });

// 由于 img 没有办法内联元素，也就没有办法插入样式，所以必须曲线救国
const style = document.createElement('style');
style.textContent = `
img[is="icon-import"] {
  touch-action: none;
  user-select: none;
  pointer-events: none;
}`;
style.dataset.comment = "Inserted by HTMLIconImportElement.js";
document.head.appendChild(style);