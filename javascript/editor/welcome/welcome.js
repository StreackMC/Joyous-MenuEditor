import { Editor } from "../editor.js";

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
  </div>
<s-button data-i18n slot="action" data-click="editor.openFile">$editor.actions.openFile$</s-button>
<s-button data-i18n slot="action" data-click="editor.openFolder">$editor.actions.openFolder$</s-button>
`;


export class EditorWelcome extends Editor {
  ele = document.createElement("s-card");
  constructor(data) {
    super();
    this.ele.type = "outlined";
    this.ele.style = c;
    this.ele.innerHTML = h;
  };
  getData() { return {} };
  getElement() { return this.ele; };
  setData() {};
}


