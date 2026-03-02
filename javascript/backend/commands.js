import i18n from "../i18n.js";

export default {
  executeCommand, regisiterCommand, isCommand, executeCommandSlient
}

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
 * @param {String} cmd 命令
 * @param  {...any} arg 命令参数
 * @returns 该命令的返回值；
 * @throws 命令不存在或者执行出错，会自动通知前端
 */
export function executeCommand(cmd, ...arg) {
  try {
    if (!isCommand(cmd)) { throw new Error(i18n.parseSafe("command_panel.notFound", { cmd: cmd })); };
    const v = commands.get(cmd);
    return v(...arg);
  } catch (e) {
    window.joyous.msg(i18n.parse("msg.command_failure", { msg: e.message, cmd: cmd }), i18n.parse("msg.done"), "error");
    console.error(`无法执行命令 ${cmd} [${arg.join("|")}] ：`, e);
    throw e;
  }
}

/**
 * 静默执行一个注册的命令
 * @param {String} cmd 命令
 * @param  {...any} arg 命令参数
 * @returns 该命令的返回值；
 * @throws 命令不存在或者执行出错，不会自动通知前端
 */
export function executeCommandSlient(cmd, ...arg) {
  try {
    if (!isCommand(cmd)) { throw new Error(i18n.parseSafe("command_panel.notFound", { cmd: cmd[0] })); };
    const v = commands.get(cmd);
    return v(...arg);
  } catch (e) {
    window.joyous.msg(i18n.parse("msg.command_failure", { msg: e.message, cmd: cmd }), i18n.parse("msg.done"), "error");
    console.error(`无法执行命令 ${cmd} [${arg.join("|")}] ：`, e);
    throw e;
  }
}

// 挂载到全局
window.joyous.executeCommand = executeCommand;
window.joyous.executeCommandSlient = executeCommandSlient;

/**
 * 注册一个命令
 * @param {String} command 
 * @param {Function} func 
 */
export function regisiterCommand(command, func) {
  commands.set(command, func);
}