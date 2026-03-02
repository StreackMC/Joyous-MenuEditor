import i18n from "../i18n.js";

export default {
  executeCommand, regisiterCommand
}

/**
 * 命令列表
 * @type {Map<String,Function>}
 */
const commands = new Map([
  ["editor.revert", () => { }],
]);

/**
 * 执行一个注册的命令
 * @param {String} cmd 命令
 * @param  {...any} arg 命令参数
 * @returns 该命令的返回值；找不到命令时返回 undefined；命令执行错误返回对应 Error
 */
export function executeCommand(cmd, ...arg) {
  try {
    const v = commands.get(cmd);
    return (typeof (v) === "function") ? v(...arg) : undefined;
  } catch (e) {
    window.msg(i18n.parse("msg.command_failure", { msg: e.message, cmd: cmd }));
    console.error(`无法执行命令 ${cmd} [${arg.join("|")}] ：`, e);
    return e;
  }
}

/**
 * 注册一个命令
 * @param {String} command 
 * @param {Function} func 
 */
export function regisiterCommand(command, func) {
  commands.set(command, func);
}
window.regisiterCommand = regisiterCommand; // 挂载到全局