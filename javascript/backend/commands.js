import i18n from "../i18n.js";

export default {
  executeCommand, regisiterCommand, isCommand, executeCommandSlient, hook, regisiterCommandWithHotkey, regisiterHotkey
};

/**
 * 命令列表
 * @type {Map<String,Function>}
 */
const commands = new Map([
  ["echo", (...args) => { return new String(args.join("")); }],
]);

/**
 * 判断指定的命令是否存在
 * @param {String} cmd 
 * @returns 
 */
export function isCommand(cmd) {
  if (!commands.has(cmd)) return false;
  return (typeof (commands.get(cmd)) === "function");
}

/**
 * 执行一个注册的命令
 * @param {String} cmd 命令，忽略大小写和空白字符
 * @param  {...any} arg 命令参数
 * @returns 该命令的返回值；
 * @throws 命令不存在或者执行出错，会自动通知前端
 */
export function executeCommand(cmd, ...arg) {
  try {
    const cmdLowerCase = cmd.toLocaleLowerCase().replace(/\s+/g, "");
    if (!isCommand(cmdLowerCase)) { throw new Error(i18n.parseSafe("command_panel.notFound", { cmd: cmd })); };
    const v = commands.get(cmdLowerCase);
    return v.apply(this, arg);
  } catch (e) {
    window.joyous.msg(i18n.parse("msg.command_failure", { msg: e.message }), i18n.parse("msg.done"), "error");
    console.error(`无法执行命令 ${cmd} [${arg.join("|")}] ：`, e);
    throw e;
  }
}

/**
 * 静默执行一个注册的命令
 * @param {String} cmd 命令，忽略大小写和空白字符
 * @param  {...any} arg 命令参数
 * @returns 该命令的返回值；
 * @throws 命令不存在或者执行出错，不会自动通知前端
 */
export function executeCommandSlient(cmd, ...arg) {
  try {
    const cmdLowerCase = cmd.toLowerCase().replace(/\s+/g, "");
    if (!isCommand(cmdLowerCase)) { throw new Error(i18n.parseSafe("command_panel.notFound", { cmd: cmd })); };
    const v = commands.get(cmdLowerCase);
    return v.apply(this, arg);
  } catch (e) {
    console.error(`无法执行命令 ${cmd} [${arg.join("|")}] ：`, e);
    throw e;
  }
}

// 挂载到全局
window.joyous.executeCommand = executeCommand;
window.joyous.executeCommandSlient = executeCommandSlient;

/**
 * 注册一个命令
 * @apinote 可以活用 this 判断上下文，例如 Event 通常是来自某个事件，而 window 可能来自命令面板
 * @param {String} command 命令，忽略大小写和空白字符
 * @param {Function} func 
 */
export function regisiterCommand(command, func) {
  commands.set(command.toLowerCase().replace(/\s+/g, ""), func);
}

/**
 * 注册一个命令，顺便绑定快捷键
 * @param {String} command 
 * @param {Function} func 
 * @param {string} key 快捷键
 * @param {...*} args 快捷键触发时的参数
 * @see {@link regisiterCommand(command, func)}
 */
export function regisiterCommandWithHotkey(command, func, key, ...args) {
  commands.set(command.toLowerCase().replace(/\s+/g, ""), func);
  if (key) {
    hotkeys(key, () => { executeCommand(command, ...args); return false; });
  };
}

/**
 * 注册一个快捷键绑定命令
 * 该快捷键被注册后会自动取消默认行为和冒泡，不能监听和影响浏览器保留按键
 * @param {string} key 快捷键
 * @param {String} command 
 * @param {...*} args 快捷键触发时的参数
 */
export function regisiterHotkey(key, command, ...args) {
  if (!key || !command) { return; };
  hotkeys(key, () => { executeCommand(command, ...args); return false; });
}

/**
 * 注册某个元素下的声明式命令
 * @param {Element} root 
 */
export function hook(root = document.body) {
  root.querySelectorAll("*[data-click]").forEach((e) => {
    const cmd = e.dataset.click;
    e.addEventListener("click", (event) => {
      executeCommand.apply(event, cmd.split("|"));
    });
    e.removeAttribute("data-click"); // 移除以免重复绑定
  });
}