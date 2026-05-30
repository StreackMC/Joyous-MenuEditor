/**
 * 物品堆叠组件对象。
 * 
 * 组件用于定义物品的额外属性和行为。支持的常用组件包括：
 * - `enchantment_glint_override` (boolean): 是否覆盖附魔光泽效果
 * - `item_name` (string): 自定义物品名称（JSON 文本格式）
 * - `lore` (Array): 物品描述文本（JSON 文本组件数组）
 * - `item_model` (string): 物品模型 ID
 * 
 * 其他组件会被保存但仅在部分方法中使用（如拷贝、合并等）。
 * 组件键名中的命名空间（如 `minecraft:`）会在解析时自动去除。
 * 
 * @typedef {Object} ItemComponents
 * @property {boolean} [enchantment_glint_override] - 覆盖附魔光泽效果
 * @property {string} [item_name] - 自定义物品名称（JSON 文本格式）
 * @property {Array} [lore] - 物品描述文本（JSON 文本组件数组）
 * @property {string} [item_model] - 物品模型 ID
 * @property {...any} [key:string] - 其他组件（保留但仅部分方法可用）
 */

import MCColors from "./MCColors.js";

/**
 * 表示一个物品堆叠（Item Stack）。
 * 
 * 物品堆叠包含物品 ID、数量以及可选的堆叠组件（数据组件）。
 * 堆叠组件用于定义物品的自定义行为、显示属性等。
 * 
 * @example
 * // 创建一个物品
 * const item = new Item('minecraft:apple', 5);
 * 
 * @example
 * // 创建带有组件的物品
 * const item = new Item('minecraft:stick', 1, {
 *   item_name: '{"text":"Magic Stick"}',
 *   enchantment_glint_override: true
 * });
 */
export class Item {
  /** @type {string} */ id;
  /** @type {number} */ amount;
  /** @type {ItemComponents} */ ISC;

  /**
   * 创建一个新的物品堆叠实例。
   * 
   * @param {string} [id="minecraft:air"] - 物品的命名空间 ID。若未提供命名空间，默认使用 `minecraft:`。解析失败时回退为 `minecraft:missingno`
   * @param {number} [amount=1] - 物品堆叠的数量
   * @param {ItemComponents} [ISC={}] - 物品堆叠组件。支持 `enchantment_glint_override`、`item_name`、`lore`、`item_model` 等组件，其他组件会被保留但仅在部分方法中使用
   */
  constructor(id = 'minecraft:air', amount = 1, ISC = {}) {
    this.id = this._resolveId(id);
    this.amount = Math.max(1, Math.min(99, amount));
    // 为 ISC 对象附加 toString 方法（伪类方式）
    this.ISC = this._createISCWithToString(ISC);
  }

  /**
   * 解析物品 ID，处理命名空间缺失和无效 ID 的情况。
   * 
   * @param {string} rawId - 原始物品 ID
   * @returns {string} 解析后的完整命名空间 ID
   * @private
   */
  _resolveId(rawId) {
    if (!rawId || typeof rawId !== 'string') return 'minecraft:missingno';

    let processed = rawId.trim();
    if (processed === '') return 'minecraft:missingno';

    if (!processed.includes(':')) {
      processed = `minecraft:${processed}`;
    }

    const validPattern = /^[a-z0-9._-]+:[a-z0-9./_-]+$/i;
    if (!validPattern.test(processed)) {
      return 'minecraft:missingno';
    }

    return processed;
  }

  /**
   * 创建一个带有 toString 方法的 ISC 对象（伪类方式）。
   * 
   * @param {ItemComponents} components - 原始组件对象
   * @returns {ItemComponents} 附加了 toString 方法的组件对象
   * @private
   */
  _createISCWithToString(components) {
    const obj = { ...components };
    // 为这个对象实例附加 toString 方法（不修改原型）
    obj.toString = function () {
      const entries = Object.entries(this);
      if (entries.length === 0) return '';

      return entries.map(([key, value]) => {
        const serializedValue = typeof value === 'string' ? JSON.stringify(value) : String(value);
        return `${key}=${serializedValue}`;
      }).join(',');
    };
    return obj;
  }

  #bind_element = null;
  /**
   * 获取、更新与此物品关联的 Minecraft 元素。
   * @apiNote 调用此方法是**更新**元素内容，也就是说会绑定一个元素并更新它，除非你移除绑定
   * @returns {HTMLmcItemDisplay} 当前版本未实现，返回 null
   */
  getElement() {
    if (this.#bind_element == null) {
      this.#bind_element = document.createElement("mc-item-display");
    };
    this.#bind_element.src = `./assets/minecraft/items/${this.id.trim().replace(/.*:/g, "")}.png` || "";
    this.#bind_element.amount = this.amount || 1;
    this.#bind_element.name = this.ISC.item_name || "";
    this.#bind_element.enchantmentGlint = (this.ISC.enchantment_glint_override) ? true : false;
    this.#bind_element.lore = this.ISC.lore || "";
    return this.#bind_element;
  }

  /**
   * 清除元素绑定，下次 get 时就会创建一个新的
   */
  clearElement() {
    this.#bind_element = null;
  }

  /**
   * 将物品堆叠序列化为原版 Minecraft 格式的字符串。
   * 
   * 格式规则：
   * - 数量为 1 时省略数量前缀
   * - 组件部分由 `ISC.toString()` 生成（仅包含实际存在的组件）
   * - 最终格式：`[数量x ]物品id[组件字符串]`
   * 
   * @returns {string} 原版格式的物品堆叠字符串
   * 
   * @example
   * const item = new Item('minecraft:stick', 3, { item_name: '{"text":"Good"}' });
   * console.log(item.toString()); // '3x minecraft:stick[item_name="{\\"text\\":\\"Good\\"}"]'
   */
  toString() {
    let result = this.id;
    const compStr = this.ISC.toString();
    if (compStr) {
      result += `[${compStr}]`;
    }
    if (this.amount !== 1) {
      result = `${this.amount}x ${result}`;
    }
    return result;
  }
}

/**
 * 从原版格式的字符串解析物品堆叠。
 * 
 * 支持的格式：
 * - `"minecraft:apple"` → 1 个苹果
 * - `"minecraft:stick[lore=[{text:"Good"}]]"` → 1 个带有 lore 的木棍
 * - `"minecraft:air[minecraft:item_name=\"物品名\"] 5"` → 5 个带有自定义名称的空气（命名空间前缀会被去除）
 * - `"5x minecraft:diamond"` → 5 个钻石（数量前缀在前）
 * 
 * 数量可以出现在物品描述之前（`数量x 物品...`）或之后（`物品... 数量`），但不能同时出现。
 * 组件键名中的命名空间（如 `minecraft:`）会被自动去除。
 * 解析失败时，物品 ID 回退为 `minecraft:missingno`，数量默认为 1，组件为空对象。
 * 
 * @param {string} mcString - 原版格式的物品堆叠字符串
 * @returns {Item} 解析得到的物品堆叠实例
 * 
 * @example
 * const apple = getItemFromMC('minecraft:apple');
 * const namedItem = getItemFromMC('minecraft:air[minecraft:item_name="Special"] 5');
 */
export function getItemFromMC(mcString) {
  if (typeof mcString !== 'string' || mcString.trim() === '') {
    return new Item('minecraft:missingno', 1, {});
  }

  try {
    let trimmed = mcString.trim();
    let amount = 1;
    let idAndComponents = trimmed;

    // 尝试匹配末尾的数量：格式 " ... 数字"
    const trailingNumberMatch = trimmed.match(/\s+(\d+)$/);
    if (trailingNumberMatch) {
      amount = parseInt(trailingNumberMatch[1], 10);
      idAndComponents = trimmed.substring(0, trailingNumberMatch.index).trim();
    }

    // 尝试匹配开头的数量：格式 "数字x ..."
    const leadingNumberMatch = idAndComponents.match(/^(\d+)\s*x\s*/i);
    if (leadingNumberMatch) {
      amount = parseInt(leadingNumberMatch[1], 10);
      idAndComponents = idAndComponents.substring(leadingNumberMatch[0].length).trim();
    }

    // 解析物品 ID 和组件部分
    let itemId = idAndComponents;
    let componentString = '';
    const bracketIndex = idAndComponents.indexOf('[');
    if (bracketIndex !== -1) {
      const lastBracket = idAndComponents.lastIndexOf(']');
      if (lastBracket === -1 || lastBracket <= bracketIndex) {
        throw new Error('Unmatched square brackets');
      }
      itemId = idAndComponents.substring(0, bracketIndex).trim();
      componentString = idAndComponents.substring(bracketIndex + 1, lastBracket);
    }

    // 解析组件字符串为对象，同时去除组件键名中的命名空间
    const components = {};
    if (componentString) {
      // 简单的键值对解析，支持不带引号的值、带双引号/单引号的值
      let i = 0;
      const len = componentString.length;
      const skipWhitespace = () => {
        while (i < len && /\s/.test(componentString[i])) i++;
      };
      const parseValue = () => {
        skipWhitespace();
        if (i >= len) return null;
        const ch = componentString[i];
        if (ch === '"' || ch === "'") {
          const quote = ch;
          i++;
          let value = '';
          let escaped = false;
          while (i < len) {
            const c = componentString[i];
            if (escaped) {
              value += c;
              escaped = false;
            } else if (c === '\\') {
              escaped = true;
            } else if (c === quote) {
              i++;
              break;
            } else {
              value += c;
            }
            i++;
          }
          return value;
        } else if (ch === 't' && componentString.substr(i, 4) === 'true') {
          i += 4;
          return true;
        } else if (ch === 'f' && componentString.substr(i, 5) === 'false') {
          i += 5;
          return false;
        } else if (/[0-9-]/.test(ch)) {
          let numStr = '';
          while (i < len && /[0-9.-]/.test(componentString[i])) {
            numStr += componentString[i];
            i++;
          }
          const num = parseFloat(numStr);
          return isNaN(num) ? numStr : num;
        } else {
          let str = '';
          while (i < len && !/[=,\]]/.test(componentString[i]) && !/\s/.test(componentString[i])) {
            str += componentString[i];
            i++;
          }
          return str;
        }
      };

      while (i < len) {
        skipWhitespace();
        if (i >= len) break;
        let key = '';
        while (i < len && componentString[i] !== '=') {
          if (!/\s/.test(componentString[i])) {
            key += componentString[i];
          }
          i++;
        }
        if (componentString[i] === '=') {
          i++;
          const value = parseValue();
          if (key) {
            // 去除键名中的命名空间（如 minecraft:item_name → item_name）
            const cleanKey = key.includes(':') ? key.split(':').pop() : key;
            components[cleanKey] = value;
          }
        }
        if (i < len && componentString[i] === ',') {
          i++;
        }
      }
    }

    return new Item(itemId, amount, components);
  } catch (error) {
    // 解析失败时返回 missingno
    return new Item('minecraft:missingno', 1, {});
  }
}

// ───────────────────── 以下代码由 DeepSeek 生成 ─────────────────────
// ───────────────────── 工具函数（模块级） ─────────────────────

/**
 * 计算悬浮提示框的最佳弹出位置
 * @param {number} pointerX  - 指针/手指的 X 坐标（viewport）
 * @param {number} pointerY  - 指针/手指的 Y 坐标（viewport）
 * @param {number} tipWidth  - 提示框预估宽度
 * @param {number} tipHeight - 提示框预估高度
 * @param {boolean} isMobile - 是否移动端（移动端额外偏移避免手指遮挡）
 * @returns {{ top: number, left: number }} 提示框的 fixed 定位坐标
 */
function calcTooltipPosition(pointerX, pointerY, tipWidth, tipHeight, isMobile) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = isMobile ? 28 : 12; // 移动端偏移更大，避免手指遮挡
  const edgeMargin = 8;

  // 候选方向：[水平偏移, 垂直偏移, 优先级说明]
  const candidates = [
    { dx: gap, dy: gap, label: '右下' }, // 首选：指针右下
    { dx: gap, dy: -tipHeight - gap, label: '右上' },
    { dx: -tipWidth - gap, dy: gap, label: '左下' },
    { dx: -tipWidth - gap, dy: -tipHeight - gap, label: '左上' },
  ];

  // 移动端优先向上弹出（手指下方空间通常不足且易被遮挡）
  if (isMobile) {
    candidates.unshift(
      { dx: gap, dy: -tipHeight - gap, label: '右上(移动优先)' },
      { dx: -tipWidth - gap, dy: -tipHeight - gap, label: '左上(移动优先)' },
    );
  }

  for (const cand of candidates) {
    const left = pointerX + cand.dx;
    const top = pointerY + cand.dy;
    if (
      left >= edgeMargin &&
      top >= edgeMargin &&
      left + tipWidth <= vw - edgeMargin &&
      top + tipHeight <= vh - edgeMargin
    ) {
      return { top, left };
    }
  }

  // 兜底：强制放在指针右下并 clamp 到视口内
  let fallbackLeft = pointerX + gap;
  let fallbackTop = pointerY + gap;
  fallbackLeft = Math.min(fallbackLeft, vw - tipWidth - edgeMargin);
  fallbackTop = Math.min(fallbackTop, vh - tipHeight - edgeMargin);
  fallbackLeft = Math.max(fallbackLeft, edgeMargin);
  fallbackTop = Math.max(fallbackTop, edgeMargin);
  return { top: fallbackTop, left: fallbackLeft };
}

/**
 * 通过 ResizeObserver 更新 amount 的 font-size
 * font-size = min(元素宽, 元素高) × 0.475
 * @param {HTMLElement} host     - 自定义元素宿主
 * @param {HTMLElement} amountEl - 数量文字元素
 */
function updateAmountFontSize(host, amountEl) {
  const rect = host.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height);
  const fontSize = size * 0.475;
  amountEl.style.fontSize = fontSize + 'px';
}

// ───────────────────── 自定义元素类 ─────────────────────
/**
 * ║  <mc-item-display> — Minecraft 物品展示自定义元素

 * ║  ESModule · ShadowDOM · 响应式 · 生产级
 *
 * 接受的属性（Attributes）：
 *   - src    : 图片地址
 *   - amount : 右下角数量文字
 *   - name   : 悬浮提示框第一行（物品名）
 *   - lore   : 悬浮提示框第二行（描述）
 *
 * 暴露的 Shadow Parts（供外部 CSS 通过 ::part() 选中）：
 *   - container        : 最外层容器
 *   - image-area       : 图片区域（1:1 正方形撑满）
 *   - image            : <img> 元素
 *   - amount           : 数量文字 <span>
 *   - tooltip          : 悬浮提示框
 *   - tooltip-title    : 提示框标题行
 *   - tooltip-description : 提示框描述行
 */
export class HTMLmcItemDisplay extends HTMLElement {
  /** @override */
  static get observedAttributes() {
    return ['src', 'amount', 'name', 'lore'];
  }

  constructor() {
    super();

    // --- 创建 ShadowDOM ---
    this.attachShadow({ mode: 'open' });

    // --- 内部状态 ---
    /** 移动端触摸显示 tooltip 的延迟计时器 */
    this._touchShowTimer = null;
    /** 移动端 touchend 后自动隐藏 tooltip 的计时器 */
    this._touchHideTimer = null;
    /** 防止 touch 后紧接着的 mouseenter 重复触发 */
    this._touchFlagTimestamp = 0;
    /** tooltip 是否正在显示 */
    this._tooltipVisible = false;
    /** ResizeObserver 实例 */
    this._resizeObserver = null;

    // --- 构建 ShadowDOM 结构 ---
    this._buildShadowDOM();

    // --- 绑定事件处理函数（便于移除） ---
    this._onMouseEnter = this._onMouseEnter.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onTouchCancel = this._onTouchCancel.bind(this);
  }

  /** 构建 ShadowDOM 内部结构 */
  _buildShadowDOM() {
    // --- 样式 ---
    const style = document.createElement('style');
    style.textContent = /* css */ `
        /* ========== 宿主元素默认样式 ========== */
        :host {
          display: inline-block;
          width: 160px;
          height: 160px;
          position: relative;
          /* 禁止选中、拖动、移动端长按菜单 */
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          touch-action: manipulation;
          cursor: default;
        }

        /* ========== 外层容器 ========== */
        .container {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        /* ========== 图片区域（1:1 撑满） ========== */
        .image-area {
          display: block;
          width: 100%;
          height: 100%;
          touch-action: none;
          user-select: none;
        }

        .image-area img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;       /* 绝对 1:1，不足部分留白 */
          image-rendering: auto;     /* 浏览器自行优化缩放 */
          pointer-events: auto;      /* img 可响应事件（冒泡到 host） */
          draggable: false;          /* 禁止拖动 */
          -webkit-user-drag: none;
          touch-action: none;
          user-select: none;
        }

        /* ========== 数量文字 ========== */
        .amount {
          position: absolute;
          bottom: 0;
          right: 0;
          pointer-events: none;       /* 点击穿透到元素本身 */
          color: #ffffff;
          /* 黑色描边（四向偏移模拟） */
          text-shadow:
            -1px -1px 0 #000000,
             1px -1px 0 #000000,
            -1px  1px 0 #000000,
             1px  1px 0 #000000,
             0px  2px 0 #000000,
             2px  0px 0 #000000,
            -2px  0px 0 #000000,
             0px -2px 0 #000000;
          line-height: 1;
          z-index: 1;
          font-variant-numeric: tabular-nums;
          letter-spacing: 1px;
        }

        /* ========== 悬浮提示框 ========== */
        .minetip-tooltip {
          position: fixed;
          top: 0;
          left: 0;
          display: none;
          pointer-events: none;
          z-index: 9999;
          background-color: #100010;
          background-color: rgba(16, 0, 16, 0.94);
          padding: 0.375em;
          font-family: "Mojangles", "Arial Black", Unifont, "WenQuanYi Bitmap Song", SimSun, MingLiU, Beijing, sans-serif;
          font-size: 16px;
          word-spacing: 4px;
          white-space: nowrap;
          line-height: 1.25em;
          margin: 0.125em 0.25em;
          color: #ffffff;
          text-shadow: 1px 1px 0 rgba(0,0,0,0.8);
        }

        /* ::before — 外边框效果 */
        .minetip-tooltip::before {
          content: "";
          position: absolute;
          top: 0.125em;
          right: -0.125em;
          bottom: 0.125em;
          left: -0.125em;
          border: 0.15em solid #100010;
          border-style: none solid;
          border-color: rgba(16, 0, 16, 0.94);
        }

        /* ::after — 渐变内边框 */
        .minetip-tooltip::after {
          content: "";
          position: absolute;
          top: 0.125em;
          right: 0;
          bottom: 0.125em;
          left: 0;
          border: 0.125em solid #2D0A63;
          border-image: linear-gradient(
            rgba(80, 0, 255, 0.31),
            rgba(40, 0, 127, 0.31)
          ) 1;
        }

        /* 标题行 */
        .minetip-title {
          display: block;
          color: #FFFFFF;
          text-shadow: 2px 2px 0 rgba(0,0,0,0.9);
          position: relative;
          z-index: 1;
        }

        /* 描述行 */
        .minetip-description {
          display: block;
          margin-top: 0.25em;
          color: #AA00AA;
          text-shadow: 1px 1px 0 rgba(0,0,0,0.8);
          position: relative;
          z-index: 1;
          font-style: italic;
        }
      `;

    // --- HTML 结构 ---
    const template = document.createElement('template');
    template.innerHTML = /* html */ `
        <div class="container" part="container">
          <!-- 图片区域 -->
          <div class="image-area" part="image-area">
            <img part="image" src="" alt="" draggable="false" oncontextmenu="return false" />
          </div>
          <!-- 数量文字 -->
          <span class="amount" part="amount"></span>
        </div>
        <!-- 悬浮提示框 -->
        <div class="minetip-tooltip" part="tooltip" role="tooltip" aria-hidden="true">
          <span class="minetip-title" part="tooltip-title"></span>
          <span class="minetip-description" part="tooltip-description"></span>
        </div>
      `;

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    // --- 缓存关键元素引用 ---
    /** @type {HTMLImageElement} */
    this._imgEl = this.shadowRoot.querySelector('img');
    /** @type {HTMLElement} */
    this._amountEl = this.shadowRoot.querySelector('.amount');
    /** @type {HTMLElement} */
    this._tooltipEl = this.shadowRoot.querySelector('.minetip-tooltip');
    /** @type {HTMLElement} */
    this._tooltipTitleEl = this.shadowRoot.querySelector('.minetip-title');
    /** @type {HTMLElement} */
    this._tooltipDescEl = this.shadowRoot.querySelector('.minetip-description');
  }

  // ──────────────────── 生命周期 ────────────────────

  /** @override */
  connectedCallback() {
    // 初始渲染属性
    this._syncAttributes();

    // ResizeObserver：监控宿主大小 → 动态更新 amount font-size
    this._resizeObserver = new ResizeObserver(() => {
      updateAmountFontSize(this, this._amountEl);
    });
    this._resizeObserver.observe(this);

    // 初始计算一次 font-size（下一帧确保布局完成）
    requestAnimationFrame(() => {
      updateAmountFontSize(this, this._amountEl);
    });

    // --- 事件监听 ---
    // 桌面端 hover
    this.addEventListener('mouseenter', this._onMouseEnter);
    this.addEventListener('mousemove', this._onMouseMove);
    this.addEventListener('mouseleave', this._onMouseLeave);

    // 移动端 touch
    this.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this.addEventListener('touchmove', this._onTouchMove, { passive: true });
    this.addEventListener('touchend', this._onTouchEnd);
    this.addEventListener('touchcancel', this._onTouchCancel);
  }

  /** @override */
  disconnectedCallback() {
    // 清理 ResizeObserver
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    // 清理计时器
    this._clearTouchTimers();

    // 移除事件监听
    this.removeEventListener('mouseenter', this._onMouseEnter);
    this.removeEventListener('mousemove', this._onMouseMove);
    this.removeEventListener('mouseleave', this._onMouseLeave);
    this.removeEventListener('touchstart', this._onTouchStart);
    this.removeEventListener('touchmove', this._onTouchMove);
    this.removeEventListener('touchend', this._onTouchEnd);
    this.removeEventListener('touchcancel', this._onTouchCancel);

    // 确保 tooltip 隐藏
    this._hideTooltip();
  }

  /** @override */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    this._syncAttribute(name, newValue);
  }

  // ──────────────────── 属性同步 ────────────────────

  /** 同步所有属性到内部 DOM */
  _syncAttributes() {
    this._syncAttribute('src', this.getAttribute('src'));
    this._syncAttribute('amount', this.getAttribute('amount'));
    this._syncAttribute('name', this.getAttribute('name'));
    this._syncAttribute('lore', this.getAttribute('lore'));
  }

  /** 同步单个属性 */
  _syncAttribute(name, value) {
    switch (name) {
      case 'src':
        this._imgEl.src = value || '';
        break;
      case 'amount':
        // amount 为空或者1则不显示
        if (value === null || value === undefined || value === '' || value == 1) {
          this._amountEl.style.display = 'none';
          this._amountEl.textContent = '';
        } else {
          this._amountEl.style.display = '';
          this._amountEl.textContent = value;
        }
        break;
      case 'name':
        this._tooltipTitleEl.innerHTML = MCColors.toHtml(value) || '';
        break;
      case 'lore':
        this._tooltipDescEl.innerHTML = MCColors.toHtml(value) || '';
        break;
      default:
        break;
    }
  }

  // ──────────────────── Tooltip 显示/隐藏 ────────────────────

  /**
   * 显示 tooltip（在指针附近智能定位）
   * @param {number} clientX - 指针 X
   * @param {number} clientY - 指针 Y
   * @param {boolean} isMobile - 是否来自移动端 touch
   */
  _showTooltip(clientX, clientY, isMobile = false) {
    const name = this.getAttribute('name') || '';
    const lore = this.getAttribute('lore') || '';

    // 如果没有任何内容，不显示
    if (!name && !lore) {
      this._hideTooltip();
      return;
    }

    // 更新内容
    this._tooltipTitleEl.innerHTML = MCColors.toHtml(name) || '';
    this._tooltipDescEl.innerHTML = MCColors.toHtml(lore) || '';

    // 先让 tooltip 可见但不可见（visibility:hidden）以获取尺寸
    this._tooltipEl.style.display = 'block';
    this._tooltipEl.style.visibility = 'hidden';

    const tipRect = this._tooltipEl.getBoundingClientRect();
    const tipWidth = tipRect.width;
    const tipHeight = tipRect.height;

    // 计算最佳位置
    const { top, left } = calcTooltipPosition(
      clientX, clientY, tipWidth, tipHeight, isMobile
    );

    // 设置位置并显示
    this._tooltipEl.style.top = top + 'px';
    this._tooltipEl.style.left = left + 'px';
    this._tooltipEl.style.visibility = 'visible';
    this._tooltipEl.setAttribute('aria-hidden', 'false');
    this._tooltipVisible = true;
  }

  /** 隐藏 tooltip */
  _hideTooltip() {
    this._tooltipEl.style.display = 'none';
    this._tooltipEl.style.visibility = 'hidden';
    this._tooltipEl.setAttribute('aria-hidden', 'true');
    this._tooltipVisible = false;
  }

  /** 清除所有 touch 相关计时器 */
  _clearTouchTimers() {
    if (this._touchShowTimer) {
      clearTimeout(this._touchShowTimer);
      this._touchShowTimer = null;
    }
    if (this._touchHideTimer) {
      clearTimeout(this._touchHideTimer);
      this._touchHideTimer = null;
    }
  }

  // ──────────────────── 桌面端事件处理 ────────────────────

  /** mouseenter：显示 tooltip */
  _onMouseEnter(e) {
    // 如果刚触发过 touch（800ms 内），忽略 mouseenter 防止重复
    if (Date.now() - this._touchFlagTimestamp < 800) return;

    this._showTooltip(e.clientX, e.clientY, false);
  }

  /** mousemove：更新 tooltip 位置 */
  _onMouseMove(e) {
    if (!this._tooltipVisible) return;
    // 快速更新位置（先隐藏→计算→显示，保证流畅）
    const name = this.getAttribute('name') || '';
    const lore = this.getAttribute('lore') || '';
    if (!name && !lore) {
      this._hideTooltip();
      return;
    }
    // 获取当前 tooltip 尺寸
    const tipRect = this._tooltipEl.getBoundingClientRect();
    const tipWidth = tipRect.width || 150; // 兜底
    const tipHeight = tipRect.height || 40;
    const { top, left } = calcTooltipPosition(
      e.clientX, e.clientY, tipWidth, tipHeight, false
    );
    this._tooltipEl.style.top = top + 'px';
    this._tooltipEl.style.left = left + 'px';
  }

  /** mouseleave：隐藏 tooltip */
  _onMouseLeave() {
    this._hideTooltip();
  }

  // ──────────────────── 移动端事件处理 ────────────────────

  /** touchstart：延迟显示 tooltip（模拟长按，约 350ms） */
  _onTouchStart(e) {
    this._touchFlagTimestamp = Date.now();
    this._clearTouchTimers();

    const touch = e.touches[0];
    if (!touch) return;

    const clientX = touch.clientX;
    const clientY = touch.clientY;

    // 延迟显示，模拟长按
    this._touchShowTimer = setTimeout(() => {
      this._showTooltip(clientX, clientY, true);
    }, 350);
  }

  /** touchmove：用户滑动 → 取消 tooltip */
  _onTouchMove() {
    if (this._touchShowTimer) {
      // 还未显示，直接取消
      this._clearTouchTimers();
    }
    if (this._tooltipVisible) {
      this._hideTooltip();
      this._clearTouchTimers();
    }
  }

  /** touchend：延迟隐藏 tooltip */
  _onTouchEnd() {
    this._clearTouchTimers();
    if (this._tooltipVisible) {
      // 1.5 秒后自动隐藏
      this._touchHideTimer = setTimeout(() => {
        this._hideTooltip();
      }, 1500);
    }
  }

  /** touchcancel：立即隐藏 */
  _onTouchCancel() {
    this._clearTouchTimers();
    this._hideTooltip();
  }
}
if (!customElements.get('mc-item-display')) {
  customElements.define('mc-item-display', HTMLmcItemDisplay);
}
