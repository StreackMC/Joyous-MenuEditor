# 命令大全

## javascript/main.js:
* `version`
  * 弹出「关于」信息
* `about`
  * 弹出「关于」信息
* `ver`
  * 弹出「关于」信息

## javascript/backend/autosave.js:
* `autosave.backup`
  * 立即进行一次备份
* `autosave.recover`
  * 恢复工作区备份

## javascript/backend/commands.js:
* `echo` `[...text]`
  * 返回输入的参数

## javascript/backend/editorManager.js:
* `editor.open` `[data]` `[editorId]` `[fname]`
  * @param {*} data 数据
  * @param {string} editorId 打开方式
  * @param {string} fname 编辑器标题，建议传入文件名，最终由实际的编辑器决定
  * 打开一个编辑器

## javascript/ui/command_panel.js:
* `command.panel.switch`
  * 切换命令面板显示状态
* `command.panel.open`
  * 展示命令面板
* `command.panel.close`
  * 关闭命令面板
* `command.panel.run`
  * 运行命令面板中的命令
* `command.panel.clear`
  * 清空命令面板中的输入

## javascript/ui/mctext_panel.js:
* `editor.sub.mctext`
  * 打开一个编辑器
  * @param {String} data 原文本
  * @param {function(data)} callback 回调函数

## javascript/ui/tabs.js:
* `editor.openTab`
  * 打开一个标签页，默认使用「欢迎」
  * @param {Editor} editorInstance 编辑器实例
  * @param {string} name 标签页名称
  * @param {string} uuid Tab的标识符，默认自动设置。不推荐手动覆写
  * @returns {string} Tab实例的UUID
* `editor.switch`
  * 切换到指定标签页，如果标签页不存在抛出错误
  * @param {number|string} index 以 0 开始为索引；使用文本时自动视作UUID
  * @throws 标签页不存在
* `editor.which`
  * 获取当前位于哪个标签页
* `editor.howmany`
  * 获取当前有多少标签页
* `editor.close`
  * 关闭指定标签页
  * @param {number|string} index 以 0 开始为索引；使用文本时自动视作UUID
* `editor.closeAll`
  * 关闭场上全部标签页
  * 任何情况下没有活动标签页会自动新建一个「欢迎」标签页
