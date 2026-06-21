export class JMenu {
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
  }
}

export default {
  JMenu, JavaButton, BedrockButton
};