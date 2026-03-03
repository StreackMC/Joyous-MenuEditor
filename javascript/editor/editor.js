/**
 * 仅作为一个Interface使用，需要自行 extends
 * @interface
 */
export class Editor {
  constructor(data) {
    if (new.target === Editor) { UnsupportedMethodException(); };
  };
  getData() { UnsupportedMethodException(); return {}; };
  getElement() { UnsupportedMethodException(); return new Element(); };
  setData() { UnsupportedMethodException(); };
}

/*
说明下生命周期：

创建：
1. 任何时候都应使用 commands.executeCommand("editor.open", new Editor(), "New Tab") 来打开一个编辑器
    注：也可使用 tabs.js 里面的 openEditor() ，下文同理
2. 此时自动交由 tabs.js 处理
3. tabs.js 自动维护标签页机制，并向 Editor 调用 getElement() 获取编辑器元素
4. tabs.js 将元素提交前端渲染，编辑器插入完成
5. tabs.js 将编辑器下的翻译和声明式命令事件进行绑定
6. tabs.js 自调用切换到指定标签页，完成显示

销毁：
1. 使用 commands.executeCommand("editor.close", index) 来关闭编辑器
*/

function UnsupportedMethodException() {
  throw new Error(`Unsupported Method Here[@${this}]: this function in the class is an interface, which should be extended and overwritten.`);
};

export default { Editor };