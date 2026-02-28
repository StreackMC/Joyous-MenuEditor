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
 * @returns 该命令的返回值；找不到命令时返回 undefined
 */
export function executeCommand(cmd, ...arg) {
  const v = commands.get(cmd);
  return (typeof (v) === "function") ? v(...arg) : undefined;
}

/**
 * 注册一个命令
 * @param {String} command 
 * @param {Function} func 
 */
export function regisiterCommand(command, func) {
  commands.set(command, func);
}