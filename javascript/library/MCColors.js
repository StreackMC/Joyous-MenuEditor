/**
 * Minecraft 格式化代码处理工具，提供转换 HTML、清除代码、替换前缀等功能。
 * 参考：https://zh.minecraft.wiki/w/格式化代码
 * @author DeepSeek
 * @apinote 由D老师改编自 StreackLib 中的 utils/MCColors.java 这一 Java 代码。
 */

const COLORS = {
  '0': '#000000',
  '1': '#0000AA',
  '2': '#00AA00',
  '3': '#00AAAA',
  '4': '#AA0000',
  '5': '#AA00AA',
  '6': '#FFAA00',
  '7': '#AAAAAA',
  '8': '#555555',
  '9': '#5555FF',
  'a': '#55FF55',
  'b': '#55FFFF',
  'c': '#FF5555',
  'd': '#FF55FF',
  'e': '#FFFF55',
  'f': '#FFFFFF',
  'g': '#DDD605',
  'h': '#E3D4D1',
  'i': '#CECACA',
  'j': '#443A3B',
  'm': '#971607',
  // n是基岩版内才是颜色，本身原为下划线
  // 'n': '#B4684D',
  'p': '#DEB12D',
  'q': '#47A036',
  's': '#2CBAA8',
  't': '#21497B',
  'u': '#9A5CC6',
  'v': '#EB7114'
};

// 半角字符库：ASCII 可见字符 32-126
function randomHalfChar() {
  return String.fromCharCode(32 + Math.floor(Math.random() * 95));
}

// 全角字符库：基本 CJK 统一表意文字 U+4E00 ~ U+9FFF
function randomFullChar() {
  const start = 0x4E00;
  const end = 0x9FFF;
  const codePoint = start + Math.floor(Math.random() * (end - start + 1));
  return String.fromCodePoint(codePoint);
}

// 注册乱码字符
let obfStyleEle = document.createElement("style");
let /* RAF用 */doRenderInterval = -1, lastRendering = new Date().getTime();
obfStyleEle.dataset.comment = "Inserted by MCColors.js";
document.head.appendChild(obfStyleEle);
function startObfuscateInterval(intervalMs = 20) {
  doRenderInterval = Math.abs(Math.floor(intervalMs));
  requestAnimationFrame(renderRightNow);
}
function stopObfuscateInterval() {
  doRenderInterval = -1;
}
function renderRightNow(timestamp = new Date().getTime()) {
  if (Math.abs(timestamp - lastRendering) >= doRenderInterval) {
    // 符合间隔，开始更新
    let styles = ["--mc-obf-renderer-frame-at:" + new Date().getTime()];
    for (let index = 0; index <= 10; index++) {
      styles.push('--mc-obf-char-h-' + index + `:"${randomHalfChar()}"`);
      styles.push('--mc-obf-char-f-' + index + `:"${randomFullChar()}"`);
    }
    obfStyleEle.innerHTML = `.mc-obf-char{` + styles.join(";") + `}`;
  };
  if (doRenderInterval >= 0) requestAnimationFrame(renderRightNow);
}

/**
 * 判断字符是否为有效的十六进制字符
 * @param {string} c 单个字符
 * @returns {boolean}
 * @private
 */
function isHexChar(c) {
  return (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f');
}

/**
 * 判断字符串是否为6位有效的十六进制数
 * @param {string} s 字符串
 * @returns {boolean}
 * @private
 */
function isHex(s) {
  return s.length === 6 && [...s].every(isHexChar);
}

/**
 * 将文本包装为带样式的 span 标签
 * @param {string} text 要包装的文本（将自动进行 HTML 转义）
 * @param {string|null} color 颜色值（如 "#FF0000"），null 表示默认颜色
 * @param {boolean} bold 是否加粗
 * @param {boolean} italic 是否斜体
 * @param {boolean} underline 是否下划线
 * @param {boolean} strikethrough 是否删除线
 * @param {boolean} obfuscated 是否随机乱码（将添加 class="MC-format-obfuscated"）
 * @returns {string} 包装后的 HTML span 标签
 */
function wrapWithHtmlSpan(text, color, bold, italic, underline, strikethrough, obfuscated) {
  let obfCount = 0;
  let getObfCount = () => {
    obfCount++;
    if (obfCount > 10) obfCount = 0;
    return obfCount;
  };
  // HTML 转义
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 内部 HTML 处理
  let innerHtml;
  if (obfuscated) {
    const chars = Array.from(text);
    innerHtml = chars.map(ch => {
      const code = ch.codePointAt(0);
      // 判断是否属于 CJK 统一表意文字基本区（U+4E00 - U+9FFF）
      const isCJK = (code >= 0x4E00 && code <= 0x9FFF);
      const charClass = isCJK
        ? 'mc-obf-char mc-obf-full'   // 全角 → 用 --mc-obf-char-f
        : 'mc-obf-char mc-obf-half';  // 半角 → 用 --mc-obf-char-h
      const blankChar = (isCJK)
        ? "　"
        : "&nbsp;"
      startObfuscateInterval(); // 惰性初始化渲染进程，只在有 &k 被转义后才新建渲染循环
      return `<span class="${charClass}" data-obf="${getObfCount()}">${blankChar}</span>`;
    }).join('');
  } else {
    innerHtml = escapeHtml(text);
  }

  // 外层 span 属性
  const attrs = [];
  const style = [];
  if (obfuscated) attrs.push('class="MC-format-obfuscated"');
  if (color) style.push(`color: ${color}`);
  if (bold) {
    style.push('font-weight: bold');
  } else {
    style.push('font-weight: normal');
  };
  if (italic) {
    style.push('font-style: italic');
  } else {
    style.push('font-style: unset');
  };
  if (strikethrough && underline)
    style.push('text-decoration: line-through underline');
  else if (strikethrough)
    style.push('text-decoration: line-through');
  else if (underline)
    style.push('text-decoration: underline');
  if (style.length) attrs.push(`style="${style.join('; ')};"`);

  return `<span ${attrs.join(' ')}>${innerHtml}</span>`;
}

/**
 * 将 Minecraft 格式化代码（§）转换为 HTML
 * 支持：颜色代码（包含基岩版）、粗体(§l)、斜体(§o)、下划线(§n)、删除线(§m)、随机(§k)、重置(§r)
 * 以及 RGB 颜色格式：§#RRGGBB 和 §x§R§R§G§G§B§B
 * @param {string} text 要处理的文本（仅处理 § 开头的代码）
 * @returns {string} 转换后的 HTML 字符串
 */
function toHtml(text) {
  if (text == null || text === '') {
    return '<span></span>';
  }

  const parts = [];
  let currentText = [];

  let bold = false,
    italic = false,
    underline = false,
    strikethrough = false,
    obfuscated = false;
  let color = null;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (c === '§' && i + 1 < text.length) {
      const next = text[i + 1];
      let handled = false;

      // 尝试解析 RGB 短格式：§#RRGGBB
      if (next === '#') {
        if (i + 7 <= text.length) {
          const hexPart = text.substring(i + 2, i + 8);
          if (isHex(hexPart)) {
            // 输出当前累积文本
            if (currentText.length) {
              parts.push(wrapWithHtmlSpan(currentText.join(''), color, bold, italic, underline, strikethrough, obfuscated));
              currentText = [];
            }
            color = '#' + hexPart;
            i += 7; // 跳过 § # 和 6 个数字
            handled = true;
          }
        }
      }
      // 尝试解析 RGB 长格式：§x§R§R§G§G§B§B
      else if (next === 'x' || next === 'X') {
        if (i + 2 + 6 * 2 <= text.length) { // 至少需要 §x + 6组 §R
          let hex = '';
          let valid = true;
          let pos = i + 2; // 指向 §x 后的第一个字符
          for (let j = 0; j < 6; j++) {
            if (pos >= text.length || text[pos] !== '§') {
              valid = false;
              break;
            }
            pos++;
            if (pos >= text.length) {
              valid = false;
              break;
            }
            const digit = text[pos];
            if (!isHexChar(digit)) {
              valid = false;
              break;
            }
            hex += digit.toLowerCase();
            pos++;
          }
          if (valid) {
            if (currentText.length) {
              parts.push(wrapWithHtmlSpan(currentText.join(''), color, bold, italic, underline, strikethrough, obfuscated));
              currentText = [];
            }
            color = '#' + hex;
            i = pos - 1; // pos 指向最后一个 hex 之后，循环结束后 i++ 会指向正确位置
            handled = true;
          }
        }
      }

      if (handled) {
        continue; // 已经移动 i，跳过本次循环尾部的 i++
      }

      // 不是 RGB 格式，尝试旧版单个字符代码
      const code = next.toLowerCase();
      if (COLORS.hasOwnProperty(code) || ['l', 'o', 'n', 'm', 'k', 'r'].includes(code)) {
        // 输出当前累积文本
        if (currentText.length) {
          parts.push(wrapWithHtmlSpan(currentText.join(''), color, bold, italic, underline, strikethrough, obfuscated));
          currentText = [];
        }

        if (code === 'r') {
          bold = italic = underline = strikethrough = obfuscated = false;
          color = null;
        } else if (COLORS.hasOwnProperty(code)) {
          color = COLORS[code];
        } else if (code === 'l') {
          bold = true;
        } else if (code === 'o') {
          italic = true;
        } else if (code === 'n') {
          underline = true;
        } else if (code === 'm') {
          strikethrough = true;
        } else if (code === 'k') {
          obfuscated = true;
        }

        i++; // 跳过代码字符
      } else {
        // 无效代码，忽略这两个字符
        i++; // 跳过 next
        // 不输出任何内容，也不改变样式
      }
    } else if (c === '\n') {
      if (currentText.length) {
        parts.push(wrapWithHtmlSpan(currentText.join(''), color, bold, italic, underline, strikethrough, obfuscated));
        currentText = [];
      }
      parts.push('<br>');
    } else {
      currentText.push(c);
    }
  }

  if (currentText.length) {
    parts.push(wrapWithHtmlSpan(currentText.join(''), color, bold, italic, underline, strikethrough, obfuscated));
  }

  return `<span>${parts.join('')}</span>`;
}

/**
 * 清除所有以 § 开头的 Minecraft 格式化代码（不含 &）
 * 支持 RGB 格式：§#RRGGBB 和 §x§R§R§G§G§B§B
 * @param {string} text 要处理的文本
 * @returns {string} 清除代码后的纯文本
 */
function strip(text) {
  if (text == null) return '';
  // 匹配所有 § 开头的代码：旧版单字符、RGB短格式、RGB长格式
  return text.replace(/§(?:#[0-9a-fA-F]{6}|x(?:§[0-9a-fA-F]){6}|[0-9a-vA-V])/g, '');
}

/**
 * 清除所有以 § 或 & 开头的 Minecraft 格式化代码
 * 支持 RGB 格式：§#RRGGBB、§x§R§R§G§G§B§B 以及对应的 & 版本
 * @param {string} text 要处理的文本
 * @returns {string} 清除代码后的纯文本
 */
function remove(text) {
  if (text == null) return '';
  // 匹配所有 § 或 & 开头的代码
  return text.replace(/(§|&)(?:#[0-9a-fA-F]{6}|x(?:[§&][0-9a-fA-F]){6}|[0-9a-vA-V])/g, '');
}

/**
 * 将文本中的 & 替换为 §（仅当 & 后跟有效的格式化代码时）
 * 支持 RGB 格式：&#RRGGBB 和 &x&R&R&G&G&B&B
 * @param {string} text 源文本
 * @returns {string} 替换后的文本
 */
function parseWithDefault(text) {
  if (text == null) return '';
  return text.replace(
    /&(#[0-9a-fA-F]{6}|x(&[0-9a-fA-F]){6}|[0-9a-vA-V])/g,
    (match) => match.replace(/&/g, '§')
  );
}

/**
 * 使用指定的前缀替换为 §（仅当前缀后跟有效的格式化代码时）
 * @param {string|null|undefined} text 源文本
 * @param {string} prefix 要替换的前缀（不能为 null，可以为空字符串，此时不进行替换）
 * @returns {string} 替换后的文本
 * @throws {TypeError} 如果 prefix 为 null
 * @throws {TypeError} prefix 无法被视作 string
 * @throws {TypeError} text 无法被视作 string
 */
function parseWithPrefix(text, prefix) {
  // 对每个参数进行合法性校验
  if (!(typeof prefix === 'string')) {
    if (prefix?.replace) {// 存在 replace 方法就放行
    } else if (prefix?.toString) {
      // 尝试使用潜在的 toString
      prefix = prefix.toString();
    } else {
      try {
        prefix = new String(prefix);
      } catch (error) {
        throw new Error("参数 prefix 无法被视作文本：" + error.message);
      }
    }
  }
  if (prefix === null) {
    throw new TypeError('参数 prefix 为 null');
  }
  if (prefix === '') {
    return text == null ? '' : text;
  }
  if (!(typeof text === 'string')) {
    if (text?.replace) {// 存在 replace 方法就放行
    } else if (text?.toString) {
      // 尝试使用潜在的 toString
      text = text.toString();
    } else {
      try {
        text = new String(text);
      } catch (error) {
        throw new Error("参数 text 无法被视作文本：" + error.message);
      }
    }
  }
  if (text === null || text === undefined || text === '') return '';

  // 转义 prefix 中的正则特殊字符
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedPrefix = escapeRegExp(prefix);

  // 构建正则：前缀后跟 RGB 短格式、RGB 长格式或单字符
  const pattern = new RegExp(
    escapedPrefix + '(#[0-9a-fA-F]{6}|x(' + escapedPrefix + '[0-9a-fA-F]){6}|[0-9a-vA-V])',
    'g'
  );

  return text.replace(pattern, (match) => {
    // 将匹配到的字符串中的所有 prefix 替换为 §
    // 使用 split-join 避免正则转义问题
    return match.split(prefix).join('§');
  });
}

/**
 * 将文本中的特定前缀替换为 § 代码
 * 如果只传入一个参数，默认前缀为 '&'
 * 如果传入两个参数，使用第二个参数作为前缀
 * @param {string} text 源文本
 * @param {string} [prefix='&'] 要替换的前缀
 * @returns {string} 替换后的文本
 * @throws {TypeError} prefix 是 null
 * @throws {TypeError} prefix 无法被视作 string
 * @throws {TypeError} text 无法被视作 string
 */
function parse(text, prefix = '&') {
  // 当 prefix 被显式传递为 undefined 时，也使用默认值 '&'
  if (arguments.length === 1 || prefix === undefined) {
    return parseWithDefault(text);
  }
  return parseWithPrefix(text, prefix);
}

/**
 * 尝试将输入字符串解析为6位十六进制颜色值（#RRGGBB格式）
 * 支持格式：
 * - 标准HEX：有无#号、3位或6位（如 #FFF, #FFAA33, FFAA33）
 * - CSS rgb/rgba函数：rgb(255,100,50)、rgba(100%,50%,25%,0.5)
 * - 简单数字序列：255,100,50 或 255 100 50（支持百分比）
 * - Minecraft格式：&7 / §a（单字符颜色码）、&#RRGGBB、&xRRGGBB、&x&R&R&G&G&B&B
 * @param {string} input 待解析的颜色字符串
 * @returns {string|null} 标准6位HEX颜色（如"#FFAA33"）或null
 */
export function formatHex(input) {
  if (typeof input !== 'string') return null;

  // 清理字符串：去除首尾空白和不可见控制字符（保留空格用于后续解析）
  let str = input.trim();
  if (str.length === 0) return null;

  // ---------- 辅助函数 ----------
  const isHexChar = c => /[0-9a-fA-F]/.test(c);
  const isValidHex = s => /^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/i.test(s);
  const expandHex = hex3 => hex3.split('').map(ch => ch + ch).join('');

  // 将0-255整数转换为两位十六进制
  const toHexByte = n => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();

  // ---------- 1. 标准 HEX（带#）----------
  if (str.startsWith('#')) {
    const hexPart = str.slice(1);
    if (isValidHex(hexPart)) {
      const hex = hexPart.length === 3 ? expandHex(hexPart) : hexPart;
      return '#' + hex.toUpperCase();
    }
  }

  // ---------- 2. 无前缀纯 HEX ----------
  if (isValidHex(str)) {
    const hex = str.length === 3 ? expandHex(str) : str;
    return '#' + hex.toUpperCase();
  }

  // ---------- 3. CSS rgb/rgba 函数 ----------
  const rgbFuncMatch = str.match(/^rgba?\(\s*([^)]+)\)$/i);
  if (rgbFuncMatch) {
    const content = rgbFuncMatch[1];
    // 提取数值（支持整数、百分比、逗号/空格分隔）
    const parts = content.split(/[,\s]+/).filter(p => p !== '');
    if (parts.length >= 3) {
      const parseComp = (comp) => {
        comp = comp.trim();
        const isPercent = comp.endsWith('%');
        let num = parseFloat(comp);
        if (isNaN(num)) return null;
        if (isPercent) num = (num / 100) * 255;
        return Math.min(255, Math.max(0, Math.round(num)));
      };
      const r = parseComp(parts[0]);
      const g = parseComp(parts[1]);
      const b = parseComp(parts[2]);
      if (r !== null && g !== null && b !== null) {
        return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`.toUpperCase();
      }
    }
  }

  // ---------- 4. 简单数字序列（如 "255,100,50" 或 "255 100 50"）----------
  // 要求整个字符串仅由三个数值和分隔符组成
  const simpleNumMatch = str.match(/^\s*(\d{1,3}(?:\.\d+)?%?)\s*([,;\s]+)\s*(\d{1,3}(?:\.\d+)?%?)\s*([,;\s]+)\s*(\d{1,3}(?:\.\d+)?%?)\s*$/);
  if (simpleNumMatch) {
    const parseComp = (comp) => {
      comp = comp.trim();
      const isPercent = comp.endsWith('%');
      let num = parseFloat(comp);
      if (isNaN(num)) return null;
      if (isPercent) num = (num / 100) * 255;
      return Math.min(255, Math.max(0, Math.round(num)));
    };
    const r = parseComp(simpleNumMatch[1]);
    const g = parseComp(simpleNumMatch[3]);
    const b = parseComp(simpleNumMatch[5]);
    if (r !== null && g !== null && b !== null) {
      return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`.toUpperCase();
    }
  }

  // ---------- 5. Minecraft 格式化代码 ----------
  // 5.1 单字符颜色码（&a / §a）
  if (/^[&§][0-9a-v]$/i.test(str)) {
    const code = str[1].toLowerCase();
    if (COLORS.hasOwnProperty(code)) {
      return COLORS[code].toUpperCase();
    }
  }

  // 5.2 &#RRGGBB 或 §#RRGGBB
  const shortRgbMatch = str.match(/^[&§]#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (shortRgbMatch) {
    let hex = shortRgbMatch[1];
    if (hex.length === 3) hex = expandHex(hex);
    return '#' + hex.toUpperCase();
  }

  // 5.3 &x... / §x... 格式（支持 &xRRGGBB 和 &x&R&R&G&G&B&B）
  const extendedMatch = str.match(/^[&§]x((?:[&§]?[0-9a-fA-F]){6})$/);
  if (extendedMatch) {
    const raw = extendedMatch[1];
    // 提取所有十六进制字符（忽略分隔符 & 或 §）
    const hexChars = [];
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch !== '&' && ch !== '§' && isHexChar(ch)) {
        hexChars.push(ch.toLowerCase());
      }
    }
    if (hexChars.length === 6) {
      return '#' + hexChars.join('').toUpperCase();
    }
  }

  // 所有解析失败
  return null;
}

/**
 * Minecraft 格式化代码处理工具，提供转换 HTML、清除代码、替换前缀等功能。
 * 参考：https://zh.minecraft.wiki/w/格式化代码
 * @author DeepSeek
 * @apinote 由D老师改编自 StreackLib 中的 utils/MCColors.java 这一 Java 代码。
 */
export default {
  toHtml,
  wrapWithHtmlSpan,
  strip,
  remove,
  parse,
  COLORS,
  formatHex,
  randomFullChar,
  randomHalfChar,
  startObfuscateInterval,
  stopObfuscateInterval
};