import editorManager from "../backend/editorManager.js";// 请保证路径正确！！
const EditorId = "exampleEditor";

/**
 * 仅作为一个Interface使用，需要自行 extends
 * @interface Editor 需要覆写全部方法并注册 Editor
 */
export class Editor {
  constructor(data) {
    if (new.target === Editor) { UnsupportedMethodException(); };
  };
  getRegId() { return EditorId; };
  getData() { UnsupportedMethodException(); return {}; };
  getElement() { UnsupportedMethodException(); return new Element(); };
  init() { UnsupportedMethodException(); };
  setData(data) { UnsupportedMethodException(); };
  destory() { UnsupportedMethodException(); };
};
editorManager.regisiterEditor(EditorId, (data) => {
  // 返回你的编辑器能否编辑 data ， data 可为任意类型
  // 如果编辑器被以指定的形式打开则不会调用此验证函数就直接打开
  return ""; // 如果返回了非空字符串，那么就会以字符串为标题打开你的编辑器
}, Editor);


/* 文档
文档上面的部分需要全部覆写，并保留API；文档下面的可以是 Editor 自己的内部代码。
新建一个 Editor 需要修改上面的 EditorId 用作编辑器标识符以及替换所有的 Unsupported... 为你自己的逻辑。

说明下生命周期：

创建：
1. 任何时候都应使用 commands.executeCommand("editor.open", new Editor(), "New Tab") 来打开一个编辑器
    注：也可使用 tabs.js 里面的 openEditor() ，下文同理
2. 此时自动交由 tabs.js 处理，流程如下：
3. 自动维护标签页周期，并向 Editor 调用 getElement() 获取编辑器元素
4. 将元素提交前端渲染，编辑器插入完成
5. 将编辑器下的翻译和声明式命令事件进行绑定
6. 之后调用 Editor 的 init() 函数允许后初始化
7. 自调用切换到指定标签页，完成显示

销毁：
1. 使用 commands.executeCommand("editor.close", index) 来关闭编辑器
2. 此时 tabs.js 自动维护标签页周期，流程略
3. 可能会触发 Editor.getData() 来保存数据
4. 最后使用 destory() 方法允许 Editor 做清理
*/

function UnsupportedMethodException() {
  throw new Error(`Unsupported Method Here[@${this}]: this function in the class is an interface, which should be extended and overwritten.`);
};

export default { Editor }; // 需要导出你的 Editor 类