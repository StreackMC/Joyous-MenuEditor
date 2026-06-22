import MCColors from "../../library/MCColors.js";
import { Item } from "../../library/MCItemStack.js";

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

  get src() {
    return this.getAttribute('src');
  }
  set src(val) {
    if (val == null) this.removeAttribute('src');
    else this.setAttribute('src', val);
  }
  get amount() {
    return this.getAttribute('amount');
  }
  set amount(val) {
    if (val == null) this.removeAttribute('amount');
    else this.setAttribute('amount', val);
  }
  get name() {
    return this.getAttribute('name');
  }
  set name(val) {
    if (val == null) this.removeAttribute('name');
    else this.setAttribute('name', val);
  }
  get lore() {
    return this.getAttribute('lore');
  }
  set lore(val) {
    if (val == null) this.removeAttribute('lore');
    else this.setAttribute('lore', val);
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
    /* 悬浮框文本溢出优化 */
    this._onTooltipWheel = this._onWheel.bind(this);
    this._wheelListenerAdded = false;
    /* 文本溢出时触控滚动支持 */
    this._touchScrollActive = false;     // 是否处于触摸滚动状态
    this._lastTouchPos = { x: 0, y: 0 }; // 上一次触摸点位置
    this._onDocTouchMove = this._onDocTouchMove.bind(this);
    this._onDocTouchEnd = this._onDocTouchEnd.bind(this);

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
          image-rendering: pixelated;
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
          image-rendering: pixelated;
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
          overflow: auto;
          /* 隐藏滚动条，因为不隐藏滚动条就会占据空间导致宽度计算错误。后续有时间修复或者换成自定义滚动条 */
          scrollbar-width: none;
          max-width: 80vw;
          max-height: 80vh;
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
        .minetip-tooltip::-webkit-scrollbar {
          width: 6px;
          height: 6px;
          background: #2a0a3a;
        }
        .minetip-tooltip::-webkit-scrollbar-thumb {
          background: #aa44aa;
          border-radius: 3px;
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
    this.addEventListener('wheel', this._onWheel);

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
    this.removeEventListener('wheel', this._onWheel);

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
        this._tooltipTitleEl.innerHTML = MCColors.toHtml("§f" + MCColors.parse(value)) || '';
        break;
      case 'lore':
        this._tooltipDescEl.innerHTML = MCColors.toHtml((MCColors.parse(value) || '').replace(/\n/g, `\n§o§5`)) || '';
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
    this._tooltipTitleEl.innerHTML = MCColors.toHtml(MCColors.parse(name)) || '';
    this._tooltipDescEl.innerHTML = MCColors.toHtml(MCColors.parse(lore)) || '';

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

    // 重置滚动位置（每次显示时回到顶部/左侧）
    this._tooltipEl.scrollTop = 0;
    this._tooltipEl.scrollLeft = 0;

    // 设置位置并显示
    this._tooltipEl.style.top = top + 'px';
    this._tooltipEl.style.left = left + 'px';
    this._tooltipEl.style.visibility = 'visible';
    this._tooltipEl.setAttribute('aria-hidden', 'false');
    this._tooltipVisible = true;

    // 添加滚轮监听（避免重复添加）
    if (!this._wheelListenerAdded) {
      this._tooltipEl.addEventListener('wheel', this._onWheel, { passive: false });
      this._wheelListenerAdded = true;
    }

    // 移动端额外添加全局触摸监听
    if (isMobile) {
      this._activateTouchScroll();
    }
  }

  /** 移动端激活自定义滚动 */
  _activateTouchScroll() {
    if (this._touchScrollActive) return;
    this._touchScrollActive = true;
    document.addEventListener('touchmove', this._onDocTouchMove, { passive: false });
    document.addEventListener('touchend', this._onDocTouchEnd);
    document.addEventListener('touchcancel', this._onDocTouchEnd);
  }

  /** 移动端停用自定义滚动 */
  _deactivateTouchScroll() {
    if (!this._touchScrollActive) return;
    this._touchScrollActive = false;
    document.removeEventListener('touchmove', this._onDocTouchMove);
    document.removeEventListener('touchend', this._onDocTouchEnd);
    document.removeEventListener('touchcancel', this._onDocTouchEnd);
  }

  /** 隐藏 tooltip */
  _hideTooltip() {
    this._tooltipEl.style.display = 'none';
    this._tooltipEl.style.visibility = 'hidden';
    this._tooltipEl.setAttribute('aria-hidden', 'true');
    this._tooltipVisible = false;
    if (this._wheelListenerAdded) {
      this._tooltipEl.removeEventListener('wheel', this._onWheel);
      this._wheelListenerAdded = false;
    }
    this._deactivateTouchScroll();
    this._lastTouchPos = { x: 0, y: 0 };
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

  /* wheel: 重定向滚动到悬浮框里面 */
  _onWheel(e) {
    e.preventDefault();
    e.stopPropagation();

    const el = this._tooltipEl;
    if (!el) return;

    if (e.shiftKey) {
      // Shift + 滚轮 → 横向滚动
      el.scrollLeft += e.deltaY;
    } else {
      // 普通滚轮 → 纵向滚动
      el.scrollTop += e.deltaY;
      // 如果鼠标支持横向滚轮，也处理横向
      if (e.deltaX !== 0) {
        el.scrollLeft += e.deltaX;
      }
    }
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
    // 如果触摸点在 tooltip 内且 tooltip 可见，则不隐藏，让原生滚动继续
    if (this._tooltipVisible && this._tooltipEl.contains(e.target)) {
      // 不执行任何隐藏操作，让浏览器原生处理滚动
      return;
    }

    if (this._touchShowTimer) {
      // 还未显示，直接取消
      this._clearTouchTimers();
    }
    if (this._touchShowTimer) {
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

    // 如果触摸点在 tooltip 内部，不自动隐藏（用户可能还在阅读）
    if (this._tooltipVisible && this._tooltipEl.contains(e.target)) {
      return;
    }

    if (this._tooltipVisible) {
      // 1.5 秒后自动隐藏
      this._touchHideTimer = setTimeout(() => {
        this._hideTooltip();
      }, 2000);
    }
  }

  /** touchcancel：立即隐藏 */
  _onTouchCancel() {
    this._clearTouchTimers();
    this._hideTooltip();
  }

  /** document.touchmove: 全局 touchmove 处理：滚动 tooltip 内容 */
  _onDocTouchMove(e) {
    // 如果 tooltip 未显示，忽略
    if (!this._tooltipVisible) {
      this._deactivateTouchScroll();
      return;
    }

    // 获取第一个触摸点
    const touch = e.touches[0];
    if (!touch) return;

    const currentX = touch.clientX;
    const currentY = touch.clientY;

    // 首次进入，记录起始点
    if (this._lastTouchPos.x === 0 && this._lastTouchPos.y === 0) {
      this._lastTouchPos = { x: currentX, y: currentY };
      return;
    }

    const deltaX = currentX - this._lastTouchPos.x;
    const deltaY = currentY - this._lastTouchPos.y;

    // 阈值：避免微小抖动触发滚动
    if (Math.abs(deltaX) < 2 && Math.abs(deltaY) < 2) return;

    // 阻止页面滚动穿透
    e.preventDefault();

    // 决定滚动方向：若水平移动距离明显大于垂直，则横向滚动；否则竖向滚动
    const el = this._tooltipEl;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // 横向滚动
      el.scrollLeft -= deltaX;
    } else {
      // 竖向滚动
      el.scrollTop -= deltaY;
    }

    // 更新上一次触摸位置
    this._lastTouchPos = { x: currentX, y: currentY };
  }

  /** document.touchend 触摸结束，清理状态 */
  _onDocTouchEnd() {
    this._lastTouchPos = { x: 0, y: 0 };
    this._deactivateTouchScroll();
  }
}
if (!customElements.get('mc-item-display')) {
  customElements.define('mc-item-display', HTMLmcItemDisplay);
}