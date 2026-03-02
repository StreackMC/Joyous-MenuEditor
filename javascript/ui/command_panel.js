import commands from "../backend/commands.js";
import i18n from "../i18n.js";
import UiUtils from "./utils.js";

export default {
  openCommandPanel,
}

const cmdPanel = document.getElementById("command-panel");
if (!cmdPanel) {
  UiUtils.msg(
    i18n.parse("ui.command_panel.invaild_session"),
    i18n.parse("msg.done"),
    "error"
  );
}

export function openCommandPanel() {
  cmdPanel.showed = true;
}
commands.regisiterCommand("command.pannel.open", openCommandPanel);