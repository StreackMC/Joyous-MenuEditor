import i18n from "../i18n.js";
import commands from "../backend/commands.js";
import MCColors from "../library/MCColors.js";

/** 匹配复杂转义的& */
const codeReg = /(?<!(?<!\\)\\(?:\\{2})*)&/g;
let originData = undefined;
let currentData = "";
/** 存储当前是否处于未保存的二次确认期：负数为不处于；正数为计时器的id */
let unsavedWarnStatus = -1;
let callbackFunc = (data) => { };

// 初始化子编辑器
export const mctPanel = {
  root: document.getElementById("mctext-panel"),
  dialogBtn: {
    cancel: document.getElementById("mctext-panel-btn-cancel"),
    confirm: document.getElementById("mctext-panel-btn-confirm"),
  },
  toolbar: {
    root: document.getElementById("mctext-toolbar"),
    scroll: document.getElementById("mctext-toolbar").firstElementChild,
  },
  view: {
    editor: document.getElementById("mctext-edit"),
    preview: document.getElementById("mctext-preview"),
  }
};

// 滚动转为水平
let rafId = null, pendingScroll = 0;
mctPanel.toolbar.root.addEventListener("wheel", (e) => {
  e.stopImmediatePropagation();
  e.preventDefault();
  pendingScroll += e.deltaY + e.deltaX;

  // 使用 requestAnimationFrame 合并更新，提升性能
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    mctPanel.toolbar.scroll.scrollLeft += pendingScroll * /* 滚动系数 */0.5;
    pendingScroll = 0;
    rafId = null;
  });
});

// 自适应高度
let renderTimeout = null;
/**
 * 计划渲染 textarea 中的文本，并立即更新 textarea 的高度
 */
function uploadToRender() {
  // 计划渲染，以免卡顿
  currentData = mctPanel.view.editor.value.replace(codeReg, "§");
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    mctPanel.view.preview.innerHTML = MCColors.toHtml(currentData);
    renderTimeout = null;
  }, 200);

  // 计算自适应高度
  mctPanel.view.editor.style.height = `inherit`;
  const viewHeight = mctPanel.view.preview.offsetHeight;
  const editorHeight = mctPanel.view.editor.scrollHeight;
  const finalHeight = /* 取最高的那个 */(viewHeight >= editorHeight) ? viewHeight : editorHeight;
  mctPanel.view.editor.style.height = `${7 + finalHeight}px`;
};
mctPanel.view.editor.addEventListener("input", uploadToRender);

// 水平进度同步
/** 防止循环触发 */
let isSyncing = false;
mctPanel.view.editor.addEventListener('scroll', () => {
  if (!isSyncing) {
    isSyncing = true;
    // 计算编辑区滚动百分比
    const percent = mctPanel.view.editor.scrollLeft / (mctPanel.view.editor.scrollWidth - mctPanel.view.editor.clientWidth);
    // 设置预览区滚动位置
    mctPanel.view.preview.scrollLeft = percent * (mctPanel.view.preview.scrollWidth - mctPanel.view.preview.clientWidth);
    isSyncing = false;
  }
});
mctPanel.view.preview.addEventListener('scroll', () => {
  if (!isSyncing) {
    isSyncing = true;
    const percent = mctPanel.view.preview.scrollLeft / (mctPanel.view.preview.scrollWidth - mctPanel.view.preview.clientWidth);
    mctPanel.view.editor.scrollLeft = percent * (mctPanel.view.editor.scrollWidth - mctPanel.view.editor.clientWidth);
    isSyncing = false;
  }
});

// 点击「取消」时询问是否要保存
mctPanel.dialogBtn.cancel.addEventListener("click", (e) => {
  if (
    originData === currentData/* 未产生更改，不询问是否保存 */
    || unsavedWarnStatus > 0/* 处于二次确认期，允许关闭 */
  ) { return; };
  e.stopImmediatePropagation();
  e.preventDefault();
  mctPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("panel.mctext.unsaved");
  unsavedWarnStatus = setTimeout(() => {
    mctPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("tooltip.cancel");
    unsavedWarnStatus = -1;
  }, 5e3);
});

// 关闭时清理
mctPanel.root.addEventListener("closed", () => {
  // 清理未保存提示的计时器
  if (unsavedWarnStatus > 0) {
    clearTimeout(unsavedWarnStatus);
    mctPanel.dialogBtn.cancel.innerHTML = i18n.parseSafe("tooltip.cancel");
    unsavedWarnStatus = -1;
  };
  // 清理数据
  originData = undefined;
  currentData = undefined;
});

// 编辑器工具栏的命令绑定
commands.regisiterCommand("panel.mctext.insert.italic", () => { insertAtCursor("§o"); });
commands.regisiterCommand("panel.mctext.insert.bold", () => { insertAtCursor("§l"); });
commands.regisiterCommand("panel.mctext.insert.underline", () => { insertAtCursor("§n"); });
commands.regisiterCommand("panel.mctext.insert.reset", () => { insertAtCursor("§r"); });
commands.regisiterCommand("panel.mctext.insert.format_code", () => { insertAtCursor("§"); });

// 插入颜色
commands.regisiterCommand("panel.mctext.insert.color.a", () => { insertAtCursor("§a"); });
commands.regisiterCommand("panel.mctext.insert.color.b", () => { insertAtCursor("§b"); });
commands.regisiterCommand("panel.mctext.insert.color.c", () => { insertAtCursor("§c"); });
commands.regisiterCommand("panel.mctext.insert.color.d", () => { insertAtCursor("§d"); });
commands.regisiterCommand("panel.mctext.insert.color.e", () => { insertAtCursor("§e"); });
commands.regisiterCommand("panel.mctext.insert.color.f", () => { insertAtCursor("§f"); });

// --- EXPORTS ---
/** 追加文本(本段为AI生成) */
export function insertAtCursor(textToInsert) {
  const textarea = mctPanel.view.editor;
  // 1. 获取当前光标位置
  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;

  // 2. 获取当前文本值
  const oldValue = textarea.value;

  // 3. 在光标位置插入新文本
  const newValue =
    oldValue.substring(0, startPos) +
    textToInsert +
    oldValue.substring(endPos);

  // 4. 更新 textarea 的值
  textarea.value = newValue;

  // 5. 将光标移动到插入文本之后
  const newCursorPos = startPos + textToInsert.length;
  textarea.setSelectionRange(newCursorPos, newCursorPos);
  textarea.focus();
  uploadToRender(); // 触发更新事件
}

/**
 * 打开一个 MC文本组件 子编辑器
 * @param {String} data 原文本
 * @param {function(data)} callback 回调函数
 * @throws 已有正在进行的编辑
 */
export function edit(data = "", callback = function (data) { }) {
  if (mctPanel.root.showed == "true") {
    throw new Error("已有正在进行的编辑");
  };
  // 存储数据
  originData = data;
  currentData = data;
  callbackFunc = callback;

  // 显示UI
  mctPanel.view.editor.textContent = data;
  mctPanel.root.showed = true;
  uploadToRender();
};
commands.regisiterCommand("panel.mctext.open", edit);

/**
 * 切换预览区背景色
 * @param {number} id 背景色编号，从0开始，溢出自动轮换
 */
export function switchPreviewBgColor(id = (mctPanel.view.preview.dataset.bgId + 1)) {
  id = ((id % BgColors.length) + BgColors.length) % BgColors.length;
  mctPanel.view.preview.style.backgroundColor = BgColors[id].cssBg;
  mctPanel.view.preview.dataset.bgId = id;
};
commands.regisiterCommand("panel.mctext.color_switch", switchPreviewBgColor);
const BgColors = [
  { cssBg: "var(--s-color-surface-container-high, #E7E8EA)"},
  { cssBg: "#fff" },
  { cssBg: "#000" },
];

edit(`
目前本功能还在开发\n这是测试用文本：

&l&a《年年对对》&r
&o&b哔哩哔哩拜年纪 &7/ &c多多poi &7/ &d泠鸢yousa &7/ &e诺子 &7/ &1祈Inory&r

&6作曲 &7:&f 西门振
&6编曲 &7:&f 西门振
&6作词 &7:&f St
&6演唱 &7:&f 泠鸢yousa/诺子/多多poi/祈Inory
&6和声设计 &7:&f 橘音kitsune
&6唢呐 &7:&f 浑元Rysn
&6说唱 &7:&f 蔚蓝边际
&6音乐发行 &7:&f 黄咏竹/吴哲宇/胡莎

&1云对雨来雪对风 鸿来燕去晚照对晴空
&2春对夏来秋对冬 对完了暮鼓对晨钟
&3写南北来对西东 鸣虫宿鸟柳绿对花红
&4年年桃符 岁岁春风
&5&n“新年快乐！”&r
&6谁摊 红纸一双题春再
&7遥看 金灯十里照福来
&8唯愿家家 岁岁年年鸿运载
&9盼 朝朝暮暮笑颜开
&0谁言 北斗初回添锦彩
&a唤得 东风乍暖纳祥财
&b凤舞龙飞 仄起平收赋慷慨
&c提笔间 话尽如意自在
&d九夏 三秋
&e百花魁 又报 一岁首
&f值此间 福禄满门 乾坤增寿
&g贺两行 祈万里河山 锦绣
&h我欢声歌唱
&i对联儿长 长久送吉祥
&j红纸上 墨色飞扬
&k盼新岁丰穰&r
&l再听 爆竹儿响&r
&m几声 回荡幸福 悠长
&n好祝 金铺地 玉满堂
&r&o对歌儿唱 唱过闹街巷
&r&p工巧间 字韵跌宕
&q道故事寻常
&r又听 岁钟响
&s几番 辞旧迎新 风光
&t遥望 梅花枝头春意放
&u嘉节号长春 桃符门上千家换
&v新年纳馀庆 爆竹声中一岁除
§#ffcd1a霞§#ffcd1a影§#ffcc1b知§#ffcc1b时§#ffcc1b序§#ffcb1b §#ffcb1c看§#ffcb1c遍§#ffca1c椒§#ffca1d花§#ffca1d献§#ffc91d岁§#ffc91d新§#ffc81e 
§#ffc81e东§#ffc81e风§#ffc71f除§#ffc71f夜§#ffc71f §#ffc61f唱§#ffc620对§#ffc620给§#ffc520谁§#ffc521听§#ffc521 
§#ffc421谁§#ffc421落§#ffc422 §#ffc322翰§#ffc322墨§#ffc323两§#ffc223行§#ffc223迎§#ffc223岁§#ffc124暖§#ffc124 
§#ffc024下§#ffc025对§#ffc025 §#ffbf25芳§#ffbf25醪§#ffbf26半§#ffbe26盏§#ffbe26却§#ffbe27年§#ffbd27寒§#ffbd27 
§#ffbd27常§#ffbc28愿§#ffbc28人§#ffbc28间§#ffbb29 §#ffbb29风§#ffbb29调§#ffba29雨§#ffba2a顺§#ffba2a和§#ffb92a万§#ffb92b万§#ffb82b 
§#ffb82b冀§#ffb82b §#ffb72c国§#ffb72c泰§#ffb72c民§#ffb62d安§#ffb62d瑞§#ffb62d千§#ffb52d千§#ffb52e 
§#ffb52e谁§#ffb42e书§#ffb42f §#ffb42f风§#ffb32f移§#ffb32f腊§#ffb330味§#ffb230弥§#ffb230春§#ffb231远§#ffb131 
§#ffb131更§#ffb032衬§#ffb032 §#ffb032雪§#ffaf32带§#ffaf33梅§#ffaf33香§#ffae33肇§#ffae34节§#ffae34欢§#ffad34 
§#ffad34扇§#ffad35面§#ffac35搓§#ffac35挪§#ffac36 §#ffab36无§#ffab36情§#ffab36流§#ffaa37水§#ffaa37对§#ffaa37佳§#ffa938联§#ffa938 
§#ffa838荏§#ffa838苒§#ffa839间§#ffa739 §#ffa739传§#ffa73a过§#ffa63a岁§#ffa63a岁§#ffa63a年§#ffa53b年§#ffa53b 
§#ffa53b玉§#ffa43c阙§#ffa43c琼§#ffa43c楼§#ffa33c 
§#ffa33d花§#ffa33d焰§#ffa23d尾§#ffa23e §#ffa23e再§#ffa13e遇§#ffa13e §#ffa03f柳§#ffa03f梢§#ffa03f头§#ff9f40 
§#ff9f40正§#ff9f40此§#ff9e40时§#ff9e41 §#ff9e41清§#ff9d41风§#ff9d42漫§#ff9d42漫§#ff9c42烟§#ff9c42火§#ff9c43悠§#ff9b43悠§#ff9b43 
§#ff9b44书§#ff9a44笔§#ff9a44下§#ff9a44 §#ff9945话§#ff9945人§#ff9845间§#ff9846 
§#ff9846日§#ff9746月§#ff9746 §#ff9747春§#ff9647秋§#ff9647 
§#ff9648我§#ff9548轻§#ff9548声§#ff9548歌§#ff9449唱§#ff9449 
§#ff9449对§#ff934a联§#ff934a儿§#ff934a方§#ff924a §#ff924b方§#ff924b正§#ff914b话§#ff914c吉§#ff904c祥§#ff904c 
§#ff904c红§#ff8f4d门§#ff8f4d上§#ff8f4d §#ff8e4e福§#ff8e4e字§#ff8e4e倒§#ff8d4e挂§#ff8d4f 
§#ff8d4f映§#ff8c4f国§#ff8c50泰§#ff8c50民§#ff8b50昌§#ff8b50 
§#ff8b51再§#ff8a51看§#ff8a51 §#ff8a52焰§#ff8952花§#ff8952儿§#ff8852放§#ff8853 
§#ff8853几§#ff8753团§#ff8754 §#ff8754相§#ff8654伴§#ff8654钟§#ff8655鼓§#ff8555 §#ff8555琳§#ff8556琅§#ff8456 
§#ff8456敬§#ff8456候§#ff8357 §#ff8357添§#ff8357福§#ff8258寿§#ff8258 §#ff8258驻§#ff8158安§#ff8159康§#ff8059 
§#ff8059对§#ff805a窗§#ff7f5a儿§#ff7f5a忙§#ff7f5a §#ff7e5b忙§#ff7e5b剪§#ff7e5b红§#ff7d5c花§#ff7d5c样§#ff7d5c 
§#ff7c5d看§#ff7c5d天§#ff7c5d外§#ff7b5d §#ff7b5e福§#ff7b5e星§#ff7a5e高§#ff7a5f照§#ff795f 
§#ff795f跨§#ff795f岁§#ff7860更§#ff7860万§#ff7860象§#ff7761 
§#ff7761又§#ff7761听§#ff7661 §#ff7662戏§#ff7662台§#ff7562响§#ff7563 
§#ff7563几§#ff7463声§#ff7463 §#ff7464鸿§#ff7364音§#ff7364招§#ff7365来§#ff7265 §#ff7265春§#ff7165光§#ff7166 
§#ff7166难§#ff7066忘§#ff7067 §#ff7067年§#ff6f67酒§#ff6f67杯§#ff6f68中§#ff6e68岁§#ff6e68月§#ff6e69长§#ff6d69 
§#ff6d69一§#ff6d69杯§#ff6c6a接§#ff6c6a新§#ff6c6a年§#ff6b6b东§#ff6b6b风§#ff6b6b晓§#ff6a6b畅§#ff6a6c 
§#ff696c鸿§#ff696c福§#ff696d写§#ff686d在§#ff686d红§#ff686d符§#ff676e上§#ff676e 
§#ff676e二§#ff666f杯§#ff666f和§#ff666f鞭§#ff656f炮§#ff6570声§#ff6570大§#ff6470街§#ff6471小§#ff6471巷§#ff6371 
§#ff6371裁§#ff6372韵§#ff6272成§#ff6272双§#ff6173财§#ff6173运§#ff6173旺§#ff6073 
§#ff6074三§#ff6074杯§#ff5f74诗§#ff5f75作§#ff5f75对§#ff5e75欢§#ff5e75歌§#ff5e76好§#ff5d76唱§#ff5d76 
§#ff5d77平§#ff5c77仄§#ff5c77间§#ff5c77再§#ff5b78话§#ff5b78枝§#ff5b78头§#ff5a79春§#ff5a79意§#ff5979荡§#ff5979 
§#ff597a倾§#ff587a觞§#ff587a 
§#ff587b纳§#ff577b如§#ff577b意§#ff577b吉§#ff567c祥§#ff567c 
§#ff567c我§#ff557d放§#ff557d声§#ff557d高§#ff547d唱§#ff547e 
§#ff547e对§#ff537e联§#ff537f儿§#ff537f长§#ff527f §#ff527f长§#ff5180久§#ff5180送§#ff5180吉§#ff5081祥§#ff5081 
§#ff5081红§#ff4f81纸§#ff4f82上§#ff4f82 §#ff4e82墨§#ff4e83色§#ff4e83飞§#ff4d83扬§#ff4d83 
§#ff4d84盼§#ff4c84新§#ff4c84岁§#ff4c85丰§#ff4b85穰§#ff4b85 
§#ff4b85我§#ff4a86听§#ff4a86 §#ff4986爆§#ff4987竹§#ff4987儿§#ff4887响§#ff4888 
§#ff4888几§#ff4788声§#ff4788 §#ff4789回§#ff4689荡§#ff4689幸§#ff468a福§#ff458a §#ff458a悠§#ff458a长§#ff448b 
§#ff448b道§#ff448b是§#ff438c §#ff438c年§#ff438c依§#ff428c旧§#ff428d §#ff418d岁§#ff418d寻§#ff418e常§#ff408e 
§#ff408e对§#ff408e联§#ff3f8f儿§#ff3f8f方§#ff3f8f §#ff3e90方§#ff3e90正§#ff3e90话§#ff3d90吉§#ff3d91祥§#ff3d91 
§#ff3c91红§#ff3c92门§#ff3c92上§#ff3b92 §#ff3b92福§#ff3b93字§#ff3a93倒§#ff3a93挂§#ff3994 
§#ff3994映§#ff3994国§#ff3894泰§#ff3895民§#ff3895昌§#ff3795 
§#ff3796又§#ff3796听§#ff3696 §#ff3696岁§#ff3697钟§#ff3597响§#ff3597 
§#ff3598我§#ff3498将§#ff3498 §#ff3498年§#ff3399年§#ff3399对§#ff3399对§#ff329a §#ff329a歌§#ff319a唱§#ff319a 
§#ff319b长§#ff309b望§#ff309b §#ff309c人§#ff2f9c间§#ff2f9c喜§#ff2f9c气§#ff2e9d洋§#ff2e9d洋
`);

export default {
  edit, elements: mctPanel,
  unsavedWarnStatus: () => unsavedWarnStatus,
  getData: () => currentData,
  getOriginData: () => originData,
  insertAtCursor,
  switchPreviewBgColor,
};