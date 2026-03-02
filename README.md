<center><h1>Joyous Menu Editor</h1><br><big>适用于Joyous插件的菜单可视化编辑器</big></center>

# 概述
本项目是Joyous这一Minecraft插件的菜单模块的配置文件编辑器，基于原生浏览器H5编写，采取解耦合的模块化设计。

~~目前支持打开单文件或者打开文件夹作为工作区，未来可能支持其它Joyous配置文件的编辑。~~还在开发。

# 多语言
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

# 构建
需注意，本项目虽然未使用框架或者打包工具，有些文件需要经过编译才能使用。

我们使用 [Github Actions](./.github/workflows/build_and_release.yml) 来完成这一流程并发布到 Github Pages 。<br>
你可点击 Pages 链接以开始使用。

# 协议与版权
本项目以 [Apache 2.0](./LICENSE) 协议开源。