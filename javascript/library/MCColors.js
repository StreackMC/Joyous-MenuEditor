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
  // HTML 转义（注意顺序：先转义 & 防止二次转义）
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const attrs = [];
  const style = [];

  if (obfuscated) {
    attrs.push('class="MC-format-obfuscated"');
  }
  if (color) {
    style.push(`color: ${color}`);
  }
  if (bold) {
    style.push('font-weight: bold');
  }
  if (italic) {
    style.push('font-style: italic');
  }
  if (strikethrough && underline) {
    style.push('text-decoration: line-through underline');
  } else if (strikethrough) {
    style.push('text-decoration: line-through');
  } else if (underline) {
    style.push('text-decoration: underline');
  }

  if (style.length) {
    attrs.push(`style="${style.join('; ')};"`);
  }

  return `<span ${attrs.join(' ')}>${escaped}</span>`;
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
 * @param {string} text 源文本
 * @param {string} prefix 要替换的前缀（不能为 null，可以为空字符串，此时不进行替换）
 * @returns {string} 替换后的文本
 * @throws {TypeError} 如果 prefix 为 null
 */
function parseWithPrefix(text, prefix) {
  if (prefix == null) {
    throw new TypeError('参数 prefix 为 null');
  }
  if (prefix === '') {
    return text == null ? '' : text;
  }
  if (text == null) return '';

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
 */
function parse(text, prefix = '&') {
  // 当 prefix 被显式传递为 undefined 时，也使用默认值 '&'
  if (arguments.length === 1 || prefix === undefined) {
    return parseWithDefault(text);
  }
  return parseWithPrefix(text, prefix);
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
  COLORS
};