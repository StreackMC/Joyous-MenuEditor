/**
 * @fileoverview 前端i18n模块，支持加载翻译文件、DOM 刷新、带参数翻译和安全翻译。
 * @author DeepSeek 生成
 * @apinote 懒得用Vue就让AI生成了一个i18n
 * @module i18n
 */
export default {
  parse, parseSafe, load, refresh,
  getCurrentUrl,
  getCurrentTranslations: () => { return currentTranslations; },
};

/** 当前加载的翻译数据对象 */
export let currentTranslations = {};
let currentTranslationsUrl = "";

/**
 * 获取当前使用的翻译文件URL
 * @returns 
 */
export function getCurrentUrl() {
  return currentTranslationsUrl;
}

/**
 * 根据点号路径从翻译中获取值，自动查找默认值。
 * @param {string} path - 点号分隔的路径，如 "ui.title"
 * @returns {*} 路径对应的值，若不存在返回 undefined
 */
function getValueByPath(path) {
  let lookupCurrent = path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' && key in current ? current[key] : undefined;
  }, currentTranslations);
  return (lookupCurrent) ? lookupCurrent : path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' && key in current ? current[key] : undefined;
  }, defaultTranslations);
}

/**
 * 将字符串中的占位符 %key% 替换为对应的参数值
 * @param {string} text - 包含占位符的原始文本
 * @param {Object} params - 参数映射对象，如 { param1: "内容" }
 * @param {Function} [transformParam] - 可选的参数值转换函数（如转义）
 * @returns {string} 替换后的文本
 */
function replaceParams(text, params, transformParam = (v) => v) {
  if (!text || typeof text !== 'string') return '';
  if (!params || typeof params !== 'object') return text;

  return text.replace(/%(.*?)%/g, (match, key) => {
    const value = params[key];
    if (value === undefined) {
      return match; // 保留原占位符
    }
    // 将参数值转换为字符串并应用转换函数
    return transformParam(String(value));
  });
}

/**
 * 转义 HTML 特殊字符，防止 XSS 攻击
 * @param {string} str - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * 加载指定名称的翻译文件
 * @param {string} url - 翻译文件的路径
 * @returns {Promise<void>} 加载完成后解析的 Promise
 * @example
 * await load('zh-CN');
 */
export async function load(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    currentTranslations = await response.json();
    currentTranslationsUrl = url;
  } catch (error) {
    console.error(`加载翻译文件失败，将使用默认语言[zh_cn]: ${url}`, error);
    currentTranslations = {};
    currentTranslationsUrl = "";
  }
}

/**
 * 遍历 DOM 树，将所有带有 data-i18n 属性的元素内容中的 $$ 替换为对应的翻译文本
 * @returns {void}
 */
export function refresh() {
  const elements = document.querySelectorAll('[data-i18n]');
  const parseCache = new Map();

  elements.forEach((el) => {
    // 1. 处理元素自身的 data-i18n 属性（如果有）
    const i18nAttr = el.getAttribute('data-i18n');
    if (i18nAttr && !i18nAttr.includes('$$') && el.children.length === 0) {
      // 如果元素没有子元素，直接设置文本内容
      el.textContent = getCachedParse(i18nAttr, parseCache);
      return;
    }

    // 2. 处理文本节点
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // 跳过 script/style 标签
        if (node.parentElement?.tagName.match(/^(SCRIPT|STYLE)$/i)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach((node) => {
      const content = node.textContent;
      if (!content.includes('$$')) return;

      // 使用正则一次性找出所有占位符
      const newContent = content.replace(/\$(.*?)\$/g, (match, key) => {
        return getCachedParse(key, parseCache);
      });

      if (newContent !== content) {
        node.textContent = newContent;
      }
    });

    // 3. 处理属性中的占位符
    Array.from(el.attributes).forEach(attr => {
      if (attr.name === 'data-i18n' || !attr.value.includes('$$')) return;

      attr.value = attr.value.replace(/\$(.*?)\$/g, (match, key) => {
        return getCachedParse(key, parseCache);
      });
    });
  });
}

/**
 * 带缓存的解析函数
 */
function getCachedParse(key, cache) {
  if (!key) return '$$';

  if (cache.has(key)) {
    return cache.get(key);
  }

  let result;
  if (!key.includes('|')) {
    result = parse(key);
  } else {
    const [tr, ...paramParts] = key.split('|');
    const params = {};

    for (let i = 0; i < paramParts.length; i++) {
      const p = paramParts[i];
      const eqIndex = p.indexOf('=');
      if (eqIndex > 0) {
        params[p.slice(0, eqIndex)] = p.slice(eqIndex + 1);
      }
    }

    result = parse(tr, params);
  }

  cache.set(key, result);

  // 如果缓存太大，可以限制大小
  if (cache.size > 1000) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }

  return result;
}

/**
 * 根据键名获取翻译文本，并进行参数替换
 * 返回原始文本（可能包含 HTML 标签），调用者需自行处理 XSS
 * @param {string} key - 翻译键名，支持点号路径，如 "ui.title"
 * @param {Object} [params] - 参数映射对象，可选
 * @returns {string} 翻译后的文本，若键不存在返回空字符串
 * @example
 * parse("ui.title", { param1: "用户" })  // 返回 "欢迎用户"
 */
export function parse(key, params = {}) {
  const template = getValueByPath(key);
  if (template === undefined || template === null) {
    return '';
  }
  // 将模板转为字符串（可能为数字等）
  const templateStr = String(template);
  return replaceParams(templateStr, params);
}

/**
 * 根据键名获取翻译文本，并进行参数替换，同时自动对参数值进行 HTML 转义
 * 返回的文本适合直接作为 HTML 元素内容或属性值，安全防止 XSS
 * @param {string} key - 翻译键名，支持点号路径，如 "ui.title"
 * @param {Object} [params] - 参数映射对象，可选
 * @returns {string} 安全转义后的翻译文本，若键不存在返回空字符串
 * @example
 * parseSafe("ui.title", { param1: "<script>alert(1)</script>" })  // 返回 "欢迎 &lt;script&gt;..."
 */
export function parseSafe(key, params = {}) {
  const template = getValueByPath(key);
  if (template === undefined || template === null) {
    return '';
  }
  const templateStr = String(template);
  // 对每个参数值进行 HTML 转义后再替换
  return replaceParams(templateStr, params, escapeHtml);
}

let defaultLangResponse = await fetch(`./assets/i18n/zh_cn.json`);
if (!defaultLangResponse.ok) {
  putErrorStatusOnLoading("无法加载默认语言文件");
};
const defaultTranslations = await defaultLangResponse.json();