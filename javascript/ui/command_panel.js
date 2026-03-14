import commands from "../backend/commands.js";
import i18n from "../i18n.js";
import UiUtils from "./utils.js";

const cmdPanel = document.getElementById("command-panel");
const cmdInput = document.getElementById("command-panel-input");
const cmdConsole = document.getElementById("command-panel-console");
if (!cmdPanel || !cmdInput) {
  UiUtils.msg(
    i18n.parse("command_panel.invaild_session"),
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
commands.regisiterCommandWithHotkey("command.panel.switch", switchCommandPanel, "ctrl+shift+p");
commands.regisiterCommand("command.panel.open", openCommandPanel);
commands.regisiterCommand("command.panel.close", closeCommandPanel);
commands.regisiterCommand("command.panel.run", () => {
  const input = cmdInput.value;
  if (!input) {
    cmdConsole.innerHTML = i18n.parse("command_panel.readme");
  };
  const cmd = input.split(/(?<!\\)\|/g);
  try {
    if (cmd[0] == "command.panel.run")/* 不允许调用自己 */ { throw new Error(i18n.parseSafe("command_panel.loop", { cmd: cmd[0] })); };
    let r = new String(commands.executeCommandSlient.apply(window, cmd));
    //if (r.length == 0) { r = ""; };
    cmdConsole.innerHTML = i18n.parse("command_panel.result", { result: r });
  } catch (error) {
    cmdConsole.innerHTML = i18n.parse("command_panel.error", { result: error.message });
  }
});
commands.regisiterCommand("command.panel.clear", () => {
  cmdInput.value = "";
  cmdConsole.innerHTML = i18n.parse("command_panel.readme");
});

// 注册UI事件
cmdInput.addEventListener('keypress', (e) => {
  switch (e.code) {
    case "Enter":
      commands.executeCommand("command.panel.run");
      break;
    default:
      break;
  }
});

export default {
  switchCommandPanel, openCommandPanel, closeCommandPanel, cmdPanel, cmdInput, cmdConsole
};