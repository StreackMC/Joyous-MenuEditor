export default {};
// 加载 Editor 的具体实现
import { Editor } from "./editor.js";
import { EditorAce } from "./ace/ace.js";
import { EditorWelcome } from "./welcome/welcome.js";
import { EditorJmenu } from "./jmenu/jmenu.js";
import { EditorBrowser } from "./browser/browser.js";

// 由于 ESModule 的按深度加载，虽然一定程度上允许循环引用（Nodejs学着点）但是仍然需要手动调整加载顺序
// 故单独先加载 Editor 再加载其它的