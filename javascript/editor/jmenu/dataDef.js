export class JMenu {
  /** 现行版本 */
  static version = 1;
  /** Java版按钮 @type {Map<String,JavaButton>} */
  java;
  /** 基岩版按钮 @type {BedrockButton[]} */
  bedrock;
  /** 菜单标题 */
  title = "Untitled Menu";
  /** Java版菜单行数 */
  lines = 3;

  /**
   * @param {String} [rawData.title] 标题
   * @param {Number} [rawData.lines] Java版行数，不超过 6
   */
  constructor(rawData) {
    // 先读取基本配置
    this.title = (rawData.title) ? rawData.title : this.title;
    this.lines = (rawData.lines && rawData.lines > 0 && rawData.lines <= 6) ? rawData.lines : this.lines;
    const jeBtns = rawData["java-buttons"] || {};
    const beBtns = rawData["bedrock-buttons"] || [];
    this.java = getJavaButton(jeBtns);
    this.bedrock = getBedrockButton(beBtns);
  }

  /** 转回文本 @type {String} */
  toString() {
    const obj = {
      jme: "menu",
      jmev: JMenu.version,
      title: this.title,
      lines: this.lines,
      "java-buttons": {},
      "bedrock-buttons": [],
    };

    // java buttons
    for (const [slot, btn] of this.java.entries()) {
      const perm = (btn.permission_when_and_have === false && btn.permission) ? `!${btn.permission}` : (btn.permission || "");
      const entry = {
        display: {
          id: btn.id,
          enchant: !!btn.enchant_glint_override,
          tooltip: Array.isArray(btn.tooltip) ? btn.tooltip : [],
        },
        perm: perm,
      };
      const elseRaw = elseButtonToRaw(btn.else_button);
      if (elseRaw) entry.else = elseRaw;
      entry.action = btn.action_type || "none";
      entry.param = btn.action_param || "";
      obj["java-buttons"][slot] = entry;
    }

    // bedrock buttons
    for (const btn of this.bedrock) {
      const perm = (btn.permission_when_and_have === false && btn.permission) ? `!${btn.permission}` : (btn.permission || "");
      const entry = {
        display: {
          text: btn.text,
          icon: btn.icon || "",
        },
        perm: perm,
      };
      const elseRaw = elseButtonToRaw(btn.else_button);
      if (elseRaw) entry.else = elseRaw;
      entry.action = btn.action_type || "none";
      entry.param = btn.action_param || "";
      obj["bedrock-buttons"].push(entry);
    }

    return JSON.stringify(obj, null, 2);
  }
}

/** 获取合法的Java按钮数据 @return {Map<String,JavaButton>} */
function getJavaButton(jeBtns) {
  const data = new Map();
  Object.entries(jeBtns).forEach(([slot, btn]) => {
    // 对于每个Java菜单，校验并读取
    if (!slot || slot.length != 2) {
      console.warn("JMenu 初始化 ", jeBtns, " 时发现了非法的Java菜单槽位：", slot, " -> ", btn);
      return;
    }
    // 这一步没有必要但是我懒得改
    const [line, column] = [slot[0], slot[1]];
    if (line < 1 || line > 6 || column < 1 || column > 9) {
      // 确保槽位真的合法，超出行数只要在6行以内就行，多出来的视作隐藏
      console.warn("JMenu 初始化 ", jeBtns, " 时发现了非法的Java菜单槽位：", slot, " -> ", btn);
      return;
    }
    // 现在面向数据
    if (!btn?.display?.id) {
      // 确保按钮有效
      console.warn("JMenu 初始化 ", jeBtns, " 时发现了非法的Java菜单按钮：", slot, " -> ", btn);
      return;
    }
    data.set(slot, new JavaButton(btn));
  });
  return data;
}

/** 获取合法的Bedrock按钮数据 @return {BedrockButton[]} */
function getBedrockButton(beBtns) {
  const data = [];
  if (Array.isArray(beBtns)) {
    beBtns.forEach((btn) => {
      if (!btn?.display?.text) {
        // 确保按钮有效
        console.warn("JMenu 初始化 ", beBtns, " 时发现了非法的Bedrock菜单按钮：", btn);
        return;
      }
      data.push(new BedrockButton(btn));
    })
  }
  return data;
}

export class JavaButton {
  #_id;
  /** 物品ID @type {String} */
  get id() { return this.#_id; }
  set id(v) {
    this.#_id = (v?.toString()) ? v.toString() : "missingno";
  }

  #_number;
  /** 物品数量 @type {int} */
  get number() { return this.#_number; }
  set number(v) {
    this.#_number = Math.abs(printInt(v));
    if (this.#_number == 0 || this.#_number > 64) this.#_number = 1;
  }

  #_enchant_glint_override;
  get enchant_glint_override() { return this.#_enchant_glint_override; }
  set enchant_glint_override(v) { this.#_enchant_glint_override = !!v; }

  #_permission = ""; // 初始化默认值
  #_permission_when_and_have = true; // 私有化
  get permission() { return this.#_permission; }
  get permission_when_and_have() { return this.#_permission_when_and_have; }

  set permission(v) {
    // 删掉了 v === "!" 的歧义分支，保持纯粹
    if (typeof v != 'string' || v.length === 0) {
      this.#_permission = "";
      this.#_permission_when_and_have = true;
      return;
    }
    if (v.startsWith("!")) {
      this.#_permission_when_and_have = false;
      this.#_permission = v.slice(1);
    } else {
      this.#_permission_when_and_have = true;
      this.#_permission = v;
    }
  }

  #_action_type = "none";
  get action_type() { return this.#_action_type; }
  set action_type(v) {
    // 注意：如果 v 是 null/undefined，v?.toLowerCase() 返回 undefined，走 default
    const raw = v?.toLowerCase();
    switch (raw) {
      case "menu": this.#_action_type = "menu"; break;
      case "cmd": this.#_action_type = "cmd"; break;
      case "op": this.#_action_type = "op"; break;
      case "con": this.#_action_type = "con"; break;
      case "url": this.#_action_type = "url"; break;
      default: this.#_action_type = "none"; break;
    }
  }

  #_else_button = null;
  /** 回退按钮：当本按钮不可见时取而代之的按钮；null 表示未设置 @type {JavaButton|null} */
  get else_button() { return this.#_else_button; }
  set else_button(v) {
    if (v instanceof JavaButton) {
      this.#_else_button = v;
      return;
    }
    this.#_else_button = parseElseJavaButton(v);
  }

  action_param = "";
  tooltip = [];

  constructor(rawBtn) {
    if (!rawBtn?.display?.id) throw new Error("Invalid JavaButton: missing texture.");

    // 直接赋值触发 Setter
    this.id = rawBtn.display.id;
    this.enchant_glint_override = rawBtn.display.enchant;
    this.permission = rawBtn.perm;
    this.action_param = rawBtn.param || ""; // 简写
    this.action_type = rawBtn.action;
    // 回退按钮（其自身的 perm / else 判定无效，会被剥除）
    this.else_button = rawBtn.else;

    // tooltip 处理
    this.tooltip = (Array.isArray(rawBtn.display.tooltip) && rawBtn.display.tooltip.length > 0)
      ? rawBtn.display.tooltip
      : [];
  }
}

export class BedrockButton {
  /** 按钮显示文字 @type {String} */
  #_text;
  get text() { return this.#_text; }
  set text(v) {
    // 确保是字符串，若为空或非字符串则置为 "?"
    this.#_text = (typeof v === 'string' && v.length > 0) ? v : "?";
  }

  /** 按钮图标路径 @type {String} */
  #_icon;
  get icon() { return this.#_icon; }
  set icon(v) {
    // 图标可选，若未提供则置为空字符串
    this.#_icon = (typeof v === 'string') ? v : "";
  }

  // ---------- 权限相关（与 JavaButton 完全一致） ----------
  #_permission = "";
  #_permission_when_and_have = true;
  get permission() { return this.#_permission; }
  get permission_when_and_have() { return this.#_permission_when_and_have; }

  set permission(v) {
    if (typeof v !== 'string' || v.length === 0) {
      this.#_permission = "";
      this.#_permission_when_and_have = true;
      return;
    }
    if (v.startsWith("!")) {
      this.#_permission_when_and_have = false;
      this.#_permission = v.slice(1);
    } else {
      this.#_permission_when_and_have = true;
      this.#_permission = v;
    }
  }

  // ---------- 动作相关（与 JavaButton 完全一致） ----------
  #_action_type = "none";
  get action_type() { return this.#_action_type; }
  set action_type(v) {
    const raw = v?.toLowerCase();
    switch (raw) {
      case "menu": this.#_action_type = "menu"; break;
      case "cmd": this.#_action_type = "cmd"; break;
      case "op": this.#_action_type = "op"; break;
      case "con": this.#_action_type = "con"; break;
      case "url": this.#_action_type = "url"; break;
      default: this.#_action_type = "none"; break;
    }
  }

  /** 动作参数 @type {String} */
  action_param = "";

  #_else_button = null;
  /** 回退按钮：当本按钮不可见时取而代之的按钮；null 表示未设置 @type {BedrockButton|null} */
  get else_button() { return this.#_else_button; }
  set else_button(v) {
    if (v instanceof BedrockButton) {
      this.#_else_button = v;
      return;
    }
    this.#_else_button = parseElseBedrockButton(v);
  }

  // ---------- 构造函数 ----------
  constructor(rawBtn) {
    // 校验：必须存在 display 且包含 text
    if (!rawBtn?.display?.text) {
      throw new Error("Invalid BedrockButton: missing display.text");
    }

    // 赋值触发 Setter
    this.text = rawBtn.display.text;
    this.icon = rawBtn.display.icon;   // 可能 undefined，setter 会处理
    this.permission = rawBtn.perm;
    this.action_param = rawBtn.param || "";
    this.action_type = rawBtn.action;
    // 回退按钮（其自身的 perm / else 判定无效，会被剥除）
    this.else_button = rawBtn.else;
  }
}

/**
 * 解析 Java 回退按钮。
 * 回退按钮的 perm / else 属性判定无效，因此会被丢弃；
 * 并且必须提供合法的 display，否则视为无效（等同未设置）。
 * @param {Object} raw
 * @returns {JavaButton|null}
 */
function parseElseJavaButton(raw) {
  if (!raw?.display?.id) return null;
  try {
    return new JavaButton({ display: raw.display, action: raw.action, param: raw.param });
  } catch (e) {
    console.warn("JMenu 初始化时发现了非法的 Java 回退按钮：", raw, " -> ", e);
    return null;
  }
}

/**
 * 解析基岩版回退按钮。
 * 回退按钮的 perm / else 属性判定无效，因此会被丢弃；
 * 并且必须提供合法的 display，否则视为无效（等同未设置）。
 * @param {Object} raw
 * @returns {BedrockButton|null}
 */
function parseElseBedrockButton(raw) {
  if (!raw?.display?.text) return null;
  try {
    return new BedrockButton({ display: raw.display, action: raw.action, param: raw.param });
  } catch (e) {
    console.warn("JMenu 初始化时发现了非法的基岩版回退按钮：", raw, " -> ", e);
    return null;
  }
}

/**
 * 将回退按钮序列化为原始数据。
 * perm / else 在回退按钮中无效，因此不写入。
 * @param {JavaButton|BedrockButton|null} btn
 * @returns {Object|null}
 */
function elseButtonToRaw(btn) {
  if (btn instanceof JavaButton) {
    return {
      display: {
        id: btn.id,
        enchant: !!btn.enchant_glint_override,
        tooltip: Array.isArray(btn.tooltip) ? btn.tooltip : [],
      },
      action: btn.action_type || "none",
      param: btn.action_param || "",
    };
  }
  if (btn instanceof BedrockButton) {
    return {
      display: {
        text: btn.text,
        icon: btn.icon || "",
      },
      action: btn.action_type || "none",
      param: btn.action_param || "",
    };
  }
  return null;
}

export default {
  JMenu, JavaButton, BedrockButton
};