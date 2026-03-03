import { Editor } from "../editor.js";
import v4 from "../../library/uuidjs/v4.js"; const uuidv4 = v4;
import editorManager from "../../backend/editorManager.js";

const c = `
  width: max(calc(100% - 40px), 94%);
  max-width: 100%;
  margin: 20% min(20px, 3%) auto min(20px, 3%);
`;
const h = `
<div slot="headline" data-i18n>$ui.editor.welcome.headline$</div>
<div slot="text">
  <p data-i18n>$ui.editor.welcome.text1$</p>
  <p data-i18n>$ui.editor.welcome.text2$</p>
  <span style="color:var(--s-color-surface-container-lowest, #e0e3e2);font-size:small;">##uuidv4##</span>
</div>
<s-button data-i18n slot="action" data-click="editor.openFile">$editor.actions.openFile$</s-button>
<s-button data-i18n slot="action" data-click="editor.openFolder">$editor.actions.openFolder$</s-button>
`;
const EditorId = "welcomeEditor";

export class EditorWelcome extends Editor {
  ele = document.createElement("s-card");
  data;
  constructor(data) {
    super();
    this.data = (data) ? data : uuidv4();
    console.log("welcomeEditor created with ", data, " => ", this.data);
    this.ele.type = "outlined";
    this.ele.style = c;
    this.ele.innerHTML = h.replace("##uuidv4##", this.data);
  };
  getData() { return this.data; };
  getElement() { return this.ele; };
  setData(data) { this.data = data; };
  getRegId() { return EditorId; };
  init() { return; };
  destory() { return; };
}

editorManager.regisiterEditor(EditorId, (data) => {
  return "";
}, EditorWelcome);
