<center><h1>Joyous Menu Editor</h1><br><big>适用于Joyous插件的菜单可视化编辑器</big></center>

# 概述
本项目是Joyous这一Minecraft插件的菜单模块的配置文件编辑器，基于原生浏览器H5编写，采取解耦合的模块化设计。

~~目前支持打开单文件或者打开文件夹作为工作区，未来可能支持其它Joyous配置文件的编辑。~~还在开发。

# 构建
需注意，本项目虽然未使用框架或者打包工具，有些文件需要经过编译才能使用。

我们使用 [Github Actions](./.github/workflows/build_and_release.yml) 来完成这一流程并发布到 Github Pages 。<br>
你可点击 Pages 链接以开始使用。

# 项目架构

本项目的解耦合设计如下：

* [index.html](./index.html) - 应用主程序
* [assets/](./assets/) - 资源文件夹
* [javascript/](./javascript/) - JS代码
  * [backend/](./javascript/backend/) - 提供编辑器的内核以及与浏览器底层API的交互
  * [editor/](./javascript/editor/) - 具体编辑器实现
  * [library/](./javascript/library/) - 外部库
  * [ui/](./javascript/ui/) - 与前端UI的交互
  * [i18n.js](./javascript/i18n.js) - 简易的[多语言支持](#多语言)
  * [main.js](./javascript/main.js) - 应用JS代码主入口，负责初始化
* [css/](./css/) - CSS代码

## 多语言
本项目支持多语言，目前支持：

* [简体中文](./assets/i18n/zh_cn.json) (`zh_cn`，默认，100%)

也计划支持从非本仓库的地方加载自定义翻译文件。
有关编写翻译文件的帮助，目前还在编写。

---
We support alternative language by using JSON file.
Nowadays, the project has supported the listed language:

* [简体中文(Simpified Chinese)](./assets/i18n/zh_cn.json) (`zh_cn`, Default, 100%)

We are planning to support third-party language file to load custom translations.
About how to add a translation or make a customed one, the instruction hasn't been completed yet.

# 协议与版权
本项目以 [Apache 2.0](./LICENSE) 协议开源。

本项目在开发时使用了下列资源、代码或其它著作权作品，对此表示鸣谢：

* [Apprat/Sober](//github.com/Apprat/Sober) - MIT License
* Hotkeys-js - Kenny Wong & [Thomas Fuchs](https://github.com/madrobby/keymaster) - MIT License
* [uuidjs/uuid](//github.com/uuidjs/uuid) - MIT License