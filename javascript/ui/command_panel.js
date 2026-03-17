import commands from "../backend/commands.js";
import i18n from "../i18n.js";
import UiUtils from "./utils.js";

const cmdPanel = document.getElementById("command-panel");
const cmdInput = document.getElementById("command-panel-input");
const cmdConsole = document.getElementById("command-panel-console");
if (!cmdPanel || !cmdInput) {
  UiUtils.msg(
    i18n.parse("panel.command.invaild_session"),
    i18n.parse("msg.done"),
    "error"
  );
}

export function openCommandPanel() {
  cmdPanel.showed = true;
}
export function closeCommandPanel() {
  cmdPanel.showed = false;
}
export function switchCommandPanel() {
  cmdPanel.showed = !cmdPanel.showed;
}

// 注册命令
commands.regisiterCommandWithHotkey("panel.commands.switch", switchCommandPanel, "ctrl+shift+p");
commands.regisiterCommand("panel.commands.open", openCommandPanel);
commands.regisiterCommand("panel.commands.close", closeCommandPanel);
commands.regisiterCommand("panel.commands.run", () => {
  const input = cmdInput.value;
  if (!input) {
    cmdConsole.innerHTML = i18n.parse("panel.command.readme");
  };
  const cmd = input.split(/(?<!\\)\|/g);
  try {
    if (cmd[0] == "panel.commands.run")/* 不允许调用自己 */ { throw new Error(i18n.parseSafe("panel.command.loop", { cmd: cmd[0] })); };
    let r = new String(commands.executeCommandSlient.apply(window, cmd));
    //if (r.length == 0) { r = ""; };
    cmdConsole.innerHTML = i18n.parse("panel.command.result", { result: r });
  } catch (error) {
    cmdConsole.innerHTML = i18n.parse("panel.command.error", { result: error.message });
  }
});
commands.regisiterCommand("panel.commands.clear", () => {
  cmdInput.value = "";
  cmdConsole.innerHTML = i18n.parse("panel.command.readme");
});

// 注册UI事件
cmdInput.addEventListener('keypress', (e) => {
  switch (e.code) {
    case "Enter":
      commands.executeCommand("panel.commands.run");
      break;
    default:
      break;
  }
});

export default {
  switchCommandPanel, openCommandPanel, closeCommandPanel, cmdPanel, cmdInput, cmdConsole
};