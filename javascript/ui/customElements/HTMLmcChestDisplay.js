// ───────────────────── HTMLmcChestDisplay ─────────────────────

import MCColors from "../../library/MCColors.js";
import { Item, getItemFromMC } from "../../library/MCItemStack.js";
import { HTMLmcItemDisplay } from "./HTMLmcItemDisplay.js";

/**
 * 箱子界面
 * 
 * 独有事件 onItemHover ，仅支持 addEventListener 监听：
 * ```javascript
 * document.querySelector('mc-chest-display').addEventListener('itemHover', (e) => {
 *   const { row, column, item, action } = e.detail;
 *   if (action === 'enter') {
 *     console.log(`悬停在第 ${row} 行 ${column} 列，物品：`, item);
 *   } else {
 *     console.log('离开槽位');
 *   }
 * });
 * ```
 * 
 * @apiNote 第几个是 0-index ，行列是 1-index
 * @attr {number} line - 显示的行数（1~6）
 * @attr {string} name - 箱子名称（支持 § 格式代码）
 */
export class HTMLmcChestDisplay extends HTMLElement {
  /** @type {Array<Item|null>} */
  #_items;

  static get observedAttributes() {
    return ['line', 'name'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._buildShadowDOM();
    this._onClick = this._onClick.bind(this);
    this._renderPending = false;
    this._renderId = null;
    this.#_items = new Array(54).fill(null);
  }

  // ---------- 属性访问器 ----------

  get line() {
    return parseInt(this.getAttribute('line')) || 1;
  }
  set line(val) {
    const num = parseInt(val);
    const valid = Math.min(Math.max(num, 1), 6);
    const current = this.line;
    if (valid !== current) {
      this.setAttribute('line', String(valid));
      // 属性变化会触发 attributeChangedCallback，但值相同则不触发，所以主动请求渲染
      this._requestRender();
    }
  }

  get name() {
    return this.getAttribute('name') || '';
  }
  set name(val) {
    if (val == null || val === '') {
      this.removeAttribute('name');
    } else {
      this.setAttribute('name', String(val));
    }
    // 属性变化会触发 attributeChangedCallback，但为了保险仍请求渲染（重复会被去重）
    this._requestRender();
  }

  // ---------- 数组接口 ----------

  /** 获取全部物品的副本 */
  get items() {
    return this.#_items.slice();
  }

  /**
   * 设置全部物品（清空后填充）
   * @param {Item[]|String[]} arr 物品列表，最大读取54个元素，无效物品自动舍弃
   */
  setItems(arr) {
    if (!Array.isArray(arr)) return;
    // 清空所有槽位
    this.#_items.fill(null);
    const max = Math.min(arr.length, 54);
    for (let i = 0; i < max; i++) {
      this.#_items[i] = ensureItem(arr[i]);
    }
    this._requestRender();
  }

  /**
   * 获取第几个物品
   * @param {number} index 0-indexed 位置
   * @returns {Item|null}
   */
  getItem(index) {
    if (index < 0 || index >= 54) return null;
    return this.#_items[index];
  }

  /**
   * 设置物品（自动转换类型）
   * @param {number} index 0-indexed 位置
   * @param {Item|String|null} item 物品或物品ID字符串，null 表示清空
   */
  setItem(index, item) {
    if (index < 0 || index >= 54) return;
    this.#_items[index] = ensureItem(item);
    this._requestRender();
  }

  /** 清空所有物品 */
  clear() {
    this.#_items.fill(null);
    this._requestRender();
  }

  /** 根据引用查询指定物品在第几个（引用比较） */
  indexOf(item) {
    return this.#_items.indexOf(item);
  }

  /** 根据引用查询指定物品是否存在 */
  includes(item) {
    return this.#_items.includes(item);
  }

  /** 物品数组长度（固定54） */
  get length() {
    return this.#_items.length;
  }

  // ---------- 生命周期 ----------

  connectedCallback() {
    // 捕获click
    this._grid.addEventListener('click', this._onClick);
    // 捕获hover
    const clazz = this;
    this.#hoverHandler = [
      (e) => { this._onMouseEnter(e, clazz); },
      (e) => { this._onMouseLeave(e, clazz); },
    ];
    this._grid.addEventListener('mouseenter', this.#hoverHandler[0], true);
    this._grid.addEventListener('mouseleave', this.#hoverHandler[1], true);
    // 首次渲染
    this._requestRender();
  }

  disconnectedCallback() {
    // 移除捕获
    this._grid.removeEventListener('click', this._onClick);
    this._grid.removeEventListener('mouseenter', this.#hoverHandler[0], true);
    this._grid.removeEventListener('mouseleave', this.#hoverHandler[1], true);
    // 取消待处理的动画帧
    if (this._renderId) {
      cancelAnimationFrame(this._renderId);
      this._renderId = null;
      this._renderPending = false;
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'line' || name === 'name') {
      // 忽略值相同的情况（有些浏览器可能仍触发）
      if (oldValue !== newValue) {
        this._requestRender();
      }
    }
  }

  // ---------- 渲染调度（rAF 去重） ----------

  _requestRender() {
    if (this._renderPending) return;
    this._renderPending = true;
    this._renderId = requestAnimationFrame(() => {
      this._renderPending = false;
      this._renderId = null;
      this._render();
    });
  }

  // ---------- 构建 Shadow DOM ----------

  _buildShadowDOM() {
    const style = document.createElement('style');
    style.textContent = /* css */ `
      :host {
        display: inline-block;
        position: relative;
        background-color: #C6C6C6;
        border: 2px solid;
        border-color: #DBDBDB #5B5B5B #5B5B5B #DBDBDB;
        padding: 6px;
        text-align: left;
        white-space: nowrap;
        vertical-align: bottom;
        user-select: none;
        -webkit-user-select: none;
        touch-action: manipulation;
        cursor: default;
        font-family: "Mojangles", "Arial Black", Unifont, sans-serif;
      }

      .chest-title {
        text-align: left;
        color: #AAAAAA;
        font-size: 1.2em;
        padding: 0 0 4px 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        line-height: 1.2;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(9, 1fr);
        gap: 2px;
        background: #6b6b6b;
        padding: 2px;
      }

      .slot {
        aspect-ratio: 1 / 1;
        background: #8B8B8B;
        border: 2px solid;
        border-color: #373737 #FFF #FFF #373737;
        box-sizing: border-box;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .slot:hover {
        border-color: #373737 #FFF #FFF #373737;
      }
      .slot > mc-item-display {
        display: block;
        width: 100%;
        height: 100%;
      }
      .slot-empty {
        aspect-ratio: 1 / 1;
        background: #8B8B8B;
        border: 2px solid;
        border-color: #373737 #FFF #FFF #373737;
        box-sizing: border-box;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
    `;

    const template = document.createElement('template');
    template.innerHTML = `
      <div class="chest-title" part="chest-title"></div>
      <div class="grid" part="grid"></div>
    `;

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._titleEl = this.shadowRoot.querySelector('.chest-title');
    this._grid = this.shadowRoot.querySelector('.grid');
  }

  // ---------- 渲染 ----------

  _render() {
    // ---- 渲染箱子名称 ----
    const nameAttr = this.getAttribute('name');
    if (nameAttr) {
      this._titleEl.style.display = 'block';
      // 用 MCColors 解析格式代码
      this._titleEl.innerHTML = MCColors.toHtml(MCColors.parse(nameAttr));
      // 设置 title 显示完整纯文本（去除格式）
      this._titleEl.title = MCColors.strip(nameAttr);
    } else {
      if (this.line <= 3) {
        this._titleEl.innerHTML = '箱子';
        this._titleEl.title = '箱子';
      } else {
        this._titleEl.innerHTML = '大型箱子';
        this._titleEl.title = '大型箱子';
      }
    }

    // ---- 渲染物品网格 ----
    const line = this.line;
    const total = Math.min(line * 9, 54);
    this._grid.innerHTML = '';

    for (let i = 0; i < total; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.index = i;
      const row = Math.floor(i / 9);
      const col = i % 9;
      slot.dataset.row = row;
      slot.dataset.column = col;

      const item = this.#_items[i];
      if (item && item instanceof Item) {
        const display = document.createElement('mc-item-display');
        // 图片路径
        const imgPath = `./assets/minecraft/items/${item.id.replace(/.*:/, '')}.png`;
        display.setAttribute('src', imgPath);
        display.setAttribute('amount', item.amount);

        // 名称（JSON 文本组件 → 纯文本）
        let nameText = '';
        if (item.ISC.item_name) {
          try {
            const parsed = JSON.parse(item.ISC.item_name);
            nameText = parsed.text || item.ISC.item_name;
          } catch {
            nameText = item.ISC.item_name;
          }
        }
        if (nameText) display.setAttribute('name', nameText);

        // 描述（JSON 数组 → 纯文本，每行用换行分隔）
        let loreText = '';
        if (item.ISC.lore && Array.isArray(item.ISC.lore)) {
          const lines = item.ISC.lore.map(line => {
            try {
              const parsed = JSON.parse(line);
              return parsed.text || line;
            } catch {
              return line;
            }
          });
          loreText = lines.join('\n');
        }
        if (loreText) display.setAttribute('lore', loreText);

        // 附魔光泽（如果组件存在）
        if (item.ISC.enchantment_glint_override) {
          display.setAttribute('enchantment-glint', '');
        }

        slot.appendChild(display);
      } else {
        slot.classList.add('slot-empty');
      }

      this._grid.appendChild(slot);
    }
  }

  // ---------- Hover事件 ----------

  #hoverHandler = [];

  _onMouseEnter(e, clazz) {
    const slot = e.target.closest('.slot');
    if (!slot) return;
    const index = parseInt(slot.dataset.index);
    const row = parseInt(slot.dataset.row) + 1;  // 转1-index
    const column = parseInt(slot.dataset.column) + 1;
    const item = clazz.#_items[index] || null;

    clazz.dispatchEvent(new CustomEvent('itemHover', {
      detail: { row, column, index, item, action: 'enter' },
      bubbles: true,
      composed: true
    }));
  }

  _onMouseLeave(e, clazz) {
    const slot = e.target.closest('.slot');
    if (!slot) return;
    const index = parseInt(slot.dataset.index);
    const row = parseInt(slot.dataset.row) + 1;
    const column = parseInt(slot.dataset.column) + 1;
    const item = clazz.#_items[index] || null;

    clazz.dispatchEvent(new CustomEvent('itemHover', {
      detail: { row, column, index, item, action: 'leave' },
      bubbles: true,
      composed: true
    }));
  }

  // ---------- 点击事件 ----------

  _onClick(e) {
    const slot = e.target.closest('.slot');
    if (!slot) return;

    const row = parseInt(slot.dataset.row);
    const column = parseInt(slot.dataset.column);
    const index = row * 9 + column;
    const item = this.#_items[index] || null; // 可能为 null

    const event = new CustomEvent('itemClick', {
      detail: {
        row: row + 1,      // 转为 1-indexed
        column: column + 1,
        index: index,
        item: item,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }
}

// 注册自定义元素
if (!customElements.get('mc-chest-display')) {
  customElements.define('mc-chest-display', HTMLmcChestDisplay);
}

// ---------- 工具函数 ----------

/**
 * 将输入转换为 Item 实例或 null
 * @param {Item|String|null} input
 * @returns {Item|null}
 */
export function ensureItem(input) {
  if (input instanceof Item) {
    return input;
  } else if (typeof input === 'string') {
    return getItemFromMC(input);
  } else {
    return null;
  }
}

/**
 * 将 1-indexed 的行列转换为 0-indexed 的线性索引
 * @param {number} row 第几行（1-indexed）
 * @param {number} column 第几列（1-indexed）
 * @returns {number} 0-indexed 索引
 */
export function getIndex(row, column) {
  return (row - 1) * 9 + (column - 1);
}

/**
 * 将 0-indexed 的线性索引转换为 1-indexed 的行列
 * @param {number} index 0-indexed 索引
 * @returns {number[]} [row, column]，均为 1-indexed
 */
export function getRowColumn(index) {
  return [Math.floor(index / 9) + 1, index % 9 + 1];
}

export default {
  getIndex, getRowColumn, ensureItem
};