/**
 * 物品堆叠组件对象。
 * 
 * 组件用于定义物品的额外属性和行为。支持的常用组件包括：
 * - `enchantment_glint_override` (boolean): 是否覆盖附魔光泽效果
 * - `item_name` (string): 自定义物品名称（JSON 文本格式）
 * - `lore` (Array<string>): 物品描述文本（JSON 文本组件数组）
 * - `item_model` (string): 物品模型 ID
 * 
 * 其他组件会被保存但仅在部分方法中使用（如拷贝、合并等）。
 * 组件键名中的命名空间（如 `minecraft:`）会在解析时自动去除。
 * 
 * @typedef {Object} ItemComponents
 * @property {boolean} [enchantment_glint_override] - 覆盖附魔光泽效果
 * @property {string} [item_name] - 自定义物品名称（JSON 文本格式）
 * @property {string[]} [lore] - 物品描述文本（JSON 文本组件数组）
 * @property {string} [item_model] - 物品模型 ID
 * @property {...any} [key:string] - 其他组件（保留但仅部分方法可用）
 */


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
import i18n from "../i18n.js";

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
    // 注意：ISC.item_name 不再在此处自动填充。
    // 读取展示名称请使用 getDisplayName() 方法，
    // 其按 ISC.custom_name > ISC.item_name > 翻译名称 > 回退ID 的优先级返回。
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
   * @returns {HTMLmcItemDisplay}
   */
  getElement() {
    if (this.#bind_element == null) {
      this.#bind_element = document.createElement("mc-item-display");
    };
    this.#bind_element.amount = this.amount || 1;
    this.#bind_element.name = this.getDisplayName();
    this.#bind_element.enchantmentGlint = (this.ISC.enchantment_glint_override) ? true : false;
    this.#bind_element.lore = this.ISC.lore.join("\n") || "";
    // 材质处理，先获取不带命名空间的
    const id = this.getClearId();
    if (id === 'air') {
      // 空气不绘制图案，使用空白svg
      this.#bind_element.src = `./assets/icons/none.svg`;
    } else if (id === 'missingno') {
      // 错误物品使用丢失材质
      this.#bind_element.src = `./assets/icons/missingno.svg`;
    } else {
      // 查找材质
      this.#bind_element.src = `./assets/minecraft/items/${id}.png`;
    }
    return this.#bind_element;
  }

  /**
   * 获取物品的展示名称。
   * 优先级：ISC.custom_name > ISC.item_name > i18n 翻译名称 > 回退 ID
   * @returns {string} 纯文本展示名称
   */
  getDisplayName() {
    // 1. custom_name（显式用户覆写）
    if (this.ISC && this.ISC.custom_name) {
      const v = String(this.ISC.custom_name).trim();
      if (v) return v;
    }
    // 2. item_name（原始数据组件，可能是 JSON 文本组件字符串或纯文本）
    if (this.ISC && this.ISC.item_name) {
      const v = String(this.ISC.item_name).trim();
      if (v) {
        // 尝试解析 JSON 文本组件（如 {"text":"苹果"}）
        try {
          const parsed = JSON.parse(v);
          if (parsed && typeof parsed === 'object' && parsed.text) return parsed.text;
        } catch (_) { /* 不是 JSON，直接返回纯文本 */ }
        return v;
      }
    }
    // 3. 从 i18n 模块中查找物品本来的名字
    try {
      const key = (this.id || '').split(':').pop();
      return i18n.parseMinecraft(key);
    } catch (_) { /* 静默 */ }
    // 4. 回退：返回 item.minecraft.<id> 形式的键
    const fallbackId = (this.id || '').split(':').pop() || 'unknown';
    return `item.minecraft.${fallbackId}`;
  }

  /**
   * 清除元素绑定，下次 get 时就会创建一个新的
   */
  clearElement() {
    this.#bind_element = null;
  }

  /** 获取不带命名空间的 ID */
  getClearId() {
    return this.id.trim().replace(/.*:/g, "");
  }

  /**
   * 将物品堆叠序列化为原版 Minecraft 格式的字符串。
   * 格式：[数量x ]物品id[组件字符串]
   * 组件字符串采用简化 SNBT 风格：key1=value1,key2=value2
   * 
   * @returns {string} 原版格式的物品堆叠字符串
   */
  toString() {
    let result = this.id;

    // 生成组件字符串
    const componentPairs = [];
    for (const [key, value] of Object.entries(this.ISC)) {
      if (value === undefined || value === null) continue;
      // 跳过内部方法
      if (key === 'toString') continue;

      // 序列化值
      let serialized;
      if (Array.isArray(value)) {
        // 数组序列化为 [value1,value2,...]
        const items = value.map(v => {
          if (typeof v === 'string') {
            // 字符串需要引号
            return JSON.stringify(v);
          }
          return String(v);
        });
        serialized = `[${items.join(',')}]`;
      } else if (typeof value === 'string') {
        // 字符串需要引号
        serialized = JSON.stringify(value);
      } else if (typeof value === 'boolean' || typeof value === 'number') {
        serialized = String(value);
      } else if (typeof value === 'object') {
        // 对象序列化为简化 SNBT
        serialized = objectToSNBT(value);
      } else {
        serialized = String(value);
      }

      componentPairs.push(`${key}=${serialized}`);
    }

    const compStr = componentPairs.join(',');
    if (compStr) {
      result += `[${compStr}]`;
    }

    if (this.amount !== 1) {
      result = `${this.amount}x ${result}`;
    }
    return result;
  }

  /**
   * 创建当前物品堆叠的深拷贝。
   * @returns {Item} 新的物品堆叠实例，拥有独立的属性。
   */
  clone() {
    // 提取 ISC 中的数据属性，排除 function（如 toString）
    const dataOnly = {};
    for (const [key, value] of Object.entries(this.ISC)) {
      if (key === 'toString') continue; // 跳过函数
      dataOnly[key] = value;
    }

    // 深拷贝数据对象
    let iscCopy;
    if (typeof structuredClone === 'function') {
      iscCopy = structuredClone(dataOnly);
    } else {
      iscCopy = JSON.parse(JSON.stringify(dataOnly));
    }

    // 创建新实例，构造函数会自动重新生成 toString
    return new Item(this.id, this.amount, iscCopy);
  }
}

/**
 * 从原版格式的字符串解析物品堆叠。
 * 支持格式：[数量x ]物品id[组件字符串] 或 物品id[组件字符串] 数量
 * 组件字符串采用简化 SNBT 风格：key1=value1,key2=value2
 * 支持字符串（引号可选）、数字、布尔值、数组
 * 
 * @param {string} mcString - 原版格式的物品堆叠字符串
 * @returns {Item} 解析得到的物品堆叠实例
 */
export function getItemFromMC(mcString) {
  if (typeof mcString !== 'string' || mcString.trim() === '') {
    return new Item('minecraft:missingno', 1, {});
  }

  try {
    let trimmed = mcString.trim();
    let amount = 1;
    let idAndComponents = trimmed;

    // 匹配末尾数量：" ... 数字"
    const trailingMatch = trimmed.match(/\s+(\d+)$/);
    if (trailingMatch) {
      amount = parseInt(trailingMatch[1], 10);
      idAndComponents = trimmed.substring(0, trailingMatch.index).trim();
    }

    // 匹配开头数量："数字x ..."
    const leadingMatch = idAndComponents.match(/^(\d+)\s*x\s*/i);
    if (leadingMatch) {
      amount = parseInt(leadingMatch[1], 10);
      idAndComponents = idAndComponents.substring(leadingMatch[0].length).trim();
    }

    let itemId = idAndComponents;
    let componentStr = '';
    const bracketIndex = idAndComponents.indexOf('[');
    if (bracketIndex !== -1) {
      const lastBracket = idAndComponents.lastIndexOf(']');
      if (lastBracket === -1 || lastBracket <= bracketIndex) {
        throw new Error('Unmatched square brackets');
      }
      itemId = idAndComponents.substring(0, bracketIndex).trim();
      componentStr = idAndComponents.substring(bracketIndex + 1, lastBracket);
    }

    // 解析组件字符串为对象
    const components = {};
    if (componentStr) {
      const parsed = parseSNBTComponents(componentStr);
      // 解析结果合并到 components，键名去除命名空间
      for (const [key, value] of Object.entries(parsed)) {
        const cleanKey = key.includes(':') ? key.split(':').pop() : key;
        components[cleanKey] = value;
      }
    }

    return new Item(itemId, amount, components);
  } catch (error) {
    return new Item('minecraft:missingno', 1, {});
  }
}

/**
 * 解析简化 SNBT 风格的组件字符串
 * @param {string} str - 组件字符串，如 'item_name="Magic Stick",enchantment_glint_override=true,lore=["Line1","Line2"]'
 * @returns {Object} 解析后的对象
 */
function parseSNBTComponents(str) {
  const result = {};
  let i = 0;
  const len = str.length;

  const skipWhitespace = () => {
    while (i < len && /\s/.test(str[i])) i++;
  };

  const parseValue = () => {
    skipWhitespace();
    if (i >= len) return null;
    const ch = str[i];
    if (ch === '"' || ch === "'") {
      // 带引号的字符串
      const quote = ch;
      i++;
      let value = '';
      let escaped = false;
      while (i < len) {
        const c = str[i];
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
    } else if (ch === '[') {
      // 数组
      i++;
      const arr = [];
      skipWhitespace();
      if (i < len && str[i] === ']') {
        i++;
        return arr;
      }
      while (i < len) {
        const val = parseValue();
        if (val !== undefined) arr.push(val);
        skipWhitespace();
        if (i < len && str[i] === ',') {
          i++;
          skipWhitespace();
        } else if (i < len && str[i] === ']') {
          i++;
          break;
        }
      }
      return arr;
    } else if (ch === '{') {
      // 对象（简化 SNBT）
      i++;
      const obj = {};
      skipWhitespace();
      if (i < len && str[i] === '}') {
        i++;
        return obj;
      }
      while (i < len) {
        let key = '';
        while (i < len && str[i] !== ':' && !/\s/.test(str[i])) {
          key += str[i];
          i++;
        }
        skipWhitespace();
        if (str[i] === ':') {
          i++;
          skipWhitespace();
          const val = parseValue();
          if (key) obj[key] = val;
        }
        skipWhitespace();
        if (i < len && str[i] === ',') {
          i++;
          skipWhitespace();
        } else if (i < len && str[i] === '}') {
          i++;
          break;
        }
      }
      return obj;
    } else if (ch === 't' && str.substr(i, 4) === 'true') {
      i += 4;
      return true;
    } else if (ch === 'f' && str.substr(i, 5) === 'false') {
      i += 5;
      return false;
    } else if (/[0-9-]/.test(ch)) {
      let numStr = '';
      while (i < len && /[0-9.eE+-]/.test(str[i])) {
        numStr += str[i];
        i++;
      }
      const num = parseFloat(numStr);
      return isNaN(num) ? numStr : num;
    } else {
      // 无引号字符串
      let strVal = '';
      while (i < len && !/[=,\]]/.test(str[i]) && !/\s/.test(str[i])) {
        strVal += str[i];
        i++;
      }
      return strVal;
    }
  };

  while (i < len) {
    skipWhitespace();
    if (i >= len) break;

    // 解析键
    let key = '';
    while (i < len && str[i] !== '=' && !/\s/.test(str[i])) {
      key += str[i];
      i++;
    }
    skipWhitespace();
    if (str[i] === '=') {
      i++;
      const value = parseValue();
      if (key) result[key] = value;
    }
    skipWhitespace();
    if (i < len && str[i] === ',') {
      i++;
    }
  }
  return result;
}

/**
 * 将对象序列化为简化 SNBT 字符串
 * @param {Object} obj - 要序列化的对象
 * @returns {string} SNBT 字符串
 */
function objectToSNBT(obj) {
  const entries = [];
  for (const [k, v] of Object.entries(obj)) {
    let serialized;
    if (typeof v === 'string') {
      serialized = JSON.stringify(v);
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      serialized = String(v);
    } else if (Array.isArray(v)) {
      serialized = `[${v.map(item => {
        if (typeof item === 'string') return JSON.stringify(item);
        return String(item);
      }).join(',')}]`;
    } else if (typeof v === 'object') {
      serialized = objectToSNBT(v);
    } else {
      serialized = String(v);
    }
    entries.push(`${k}:${serialized}`);
  }
  return `{${entries.join(',')}}`;
}

/**
 * 将 §x 格式的文本转换为 Minecraft 文本组件 JSON 字符串
 * @param {string} legacyText - 包含 §x 格式化代码的文本
 * @returns {string} 文本组件 JSON 字符串
 */
export function legacyToTextComponent(legacyText) {
  if (!legacyText || typeof legacyText !== 'string') return '""';
  // 简化实现：直接返回带格式的纯文本
  // 实际应解析 §x 代码并生成对应的 JSON 格式
  return JSON.stringify(legacyText);
}

/**
 * 将 Minecraft 文本组件 JSON 字符串转换为 §x 格式的文本
 * @param {string} jsonText - 文本组件 JSON 字符串
 * @returns {string} §x 格式的文本
 */
export function textComponentToLegacy(jsonText) {
  if (!jsonText || typeof jsonText !== 'string') return '';
  try {
    const parsed = JSON.parse(jsonText);
    if (typeof parsed === 'string') return parsed;
    // 简化实现：仅提取纯文本
    if (parsed.text) return parsed.text;
    return '';
  } catch (e) {
    return jsonText;
  }
}