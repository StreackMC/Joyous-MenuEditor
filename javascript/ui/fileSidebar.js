import commands from "../backend/commandServer.js";
import fileServer, {FileNode, FileSystemEvent, FolderNode} from "../backend/fileServer.js";
import i18n from "../i18n.js";
import commandServer from "../backend/commandServer.js";
import { msg } from "./utils.js";

export const rootEle = document.getElementById("explorer");

// -------------------------- 与 fileServer 的协作

fileServer.onFileSystemChange(FileSystemEvent.OPENED, (eventType, detail) => {
  node2html(fileServer.resolvePath(), rootEle, true);
});

// -------------------------- 处理前端元素

/**
 * 获取一个节点对应的元素。如果遇到文件夹节点会自动递归调用这个函数避免批量获取导致的性能问题。
 * @param {FolderNode|FileNode} node 要绘制的节点
 * @param {HTMLElement} parentElement 父元素
 * @param {boolean} reset 是否重置父元素的内容
 */
async function node2html(node, parentElement = rootEle, reset = false) {
  if (reset) parentElement.innerHTML = "";
  if (node instanceof FolderNode) {
    // 是文件夹需要展开其子节点，所以先分类
    const child_folders = [];
    const child_files = [];
    await node.loadChildren();
    node.children.forEach((v, k) => {
      if (v instanceof FileNode) {
        child_files.push(v);
      } else if (v instanceof FolderNode) {
        child_folders.push(v);
      } else {
        console.warn("未知的子节点：", k, " -> ", v);
      };
    })

    // 接着先绘制文件夹
    const frag = document.createDocumentFragment();
    for (const element of child_folders) {
      // 先创建按钮
      const basebtn = document.createElement("s-menu-item");
      basebtn.innerText = element.name;
      basebtn.dataset.nodeid = element.id;// 声明式，如果后续要迁移到单独逻辑很有帮助
      frag.appendChild(basebtn);

      // 创建子菜单并绑定惰性加载
      const submenu = document.createElement("s-menu");
      submenu.slot = "menu";
      submenu.style.marginLeft = `.5em`;
      submenu.style.marginRight = `2px`;
      basebtn.appendChild(submenu);
      basebtn.addEventListener("click", (event) => {
        try {
          node2html(fileServer.nodeMap.get(basebtn.dataset.nodeid), submenu, true);
        } catch (error) {
          msg(i18n.parseSafe("msg.unable_to_open", { target: basebtn.dataset.nodeid, reason: error.message }), i18n.parseSafe("msg.ok"), "error");
          console.error("无法打开文件夹", basebtn.dataset.nodeid, " : ", error);
        } finally {
          event.stopImmediatePropagation();
        }
      });
    };

    // 再绘制文件
    for (const element of child_files) {
      // 依旧创建按钮
      const basebtn = document.createElement("s-menu-item");
      basebtn.innerText = element.name;
      basebtn.dataset.nodeid = element.id;
      frag.appendChild(basebtn);

      // 绑定事件
      basebtn.addEventListener("click", (event) => {
        try {
          fileServer.openFileInTab(fileServer.nodeMap.get(basebtn.dataset.nodeid));
        } catch (error) {
          msg(i18n.parseSafe("msg.unable_to_open", { target: basebtn.dataset.nodeid, reason: error.message }), i18n.parseSafe("msg.ok"), "error");
          console.error("无法打开文件", basebtn.dataset.nodeid, " : ", error);
        } finally {
          event.stopImmediatePropagation();
        }
      })
    }

    // 结束，插入
    parentElement.appendChild(frag);
  } else if (node instanceof FileNode) {
    // 依旧创建按钮
    const basebtn = document.createElement("s-menu-item");
    basebtn.innerText = element.name;
    basebtn.dataset.nodeid = element.id;
    parentElement.appendChild(basebtn);

    // 绑定事件
    basebtn.addEventListener("click", (event) => {
      try {
        fileServer.openFileInTab(fileServer.nodeMap.get(basebtn.dataset.nodeid));
      } catch (error) {
        msg(i18n.parseSafe("msg.unable_to_open", { target: basebtn.dataset.nodeid, reason: error.message }));
        console.error("无法打开文件", basebtn.dataset.nodeid, " : ", error);
      } finally {
        event.stopImmediatePropagation();
      }
    });
  } else {
    console.error("无法绘制文件结构：未知的文件类型", node);
  }
}

export default {}