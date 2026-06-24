#!/usr/bin/env node
/**
 * 本脚本用于列出指定目录下全部 .png 文件并写到数组内
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 封装提问为 Promise
function askQuestion(query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

// 递归遍历目录，收集所有 .png 文件（不区分大小写）的 basename（不含扩展名）
async function collectPngNames(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const names = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subNames = await collectPngNames(fullPath);
      names.push(...subNames);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      // 去掉 .png 后缀（不区分大小写）
      const base = entry.name.slice(0, -4);
      names.push(base);
    }
  }
  return names;
}

async function main() {
  // 获取命令行参数
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('用法: node list-items.js <目录路径> <版本号>');
    console.error('示例: node list-items.js ./images v1.0.0');
    process.exit(1);
  }

  const dirPath = path.resolve(args[0]);
  const version = args[1];

  // 检查目录是否存在
  try {
    await fs.access(dirPath);
  } catch {
    console.error(`错误: 目录 "${dirPath}" 不存在`);
    process.exit(1);
  }

  // 收集所有 png 文件名
  console.log(`正在扫描目录 "${dirPath}" 下的所有 .png 文件...`);
  const names = await collectPngNames(dirPath);
  console.log(`找到 ${names.length} 个 .png 文件`);

  // 准备新数据
  const newData = { items: names, version };

  const jsonPath = path.join(dirPath, 'list.json');
  let shouldWrite = true;
  let finalData = newData;

  // 检查 list.json 是否已存在
  try {
    await fs.access(jsonPath);
    // 文件存在，询问用户
    console.log(`\n文件 "${jsonPath}" 已存在。`);
    const answer = await askQuestion('请选择操作: (o)覆盖, (a)追加, (c)取消: ');

    if (answer === 'o' || answer === 'overwrite') {
      // 覆盖：直接使用新数据
      finalData = newData;
    } else if (answer === 'a' || answer === 'append') {
      // 追加：读取现有文件，合并 items
      let existing;
      try {
        const content = await fs.readFile(jsonPath, 'utf8');
        existing = JSON.parse(content);
        if (!Array.isArray(existing.items)) {
          throw new Error('现有 list.json 的 items 不是数组');
        }
      } catch (err) {
        console.error('读取现有 list.json 失败，将覆盖写入。', err.message);
        finalData = newData;
      }
      // 合并（不去重，保留原有顺序，新条目追加在后面）
      if (existing) {
        const combined = existing.items.concat(names);
        finalData = { items: combined, version }; // 使用新版本
        console.log(`合并后共有 ${combined.length} 个条目`);
      }
    } else {
      // 取消
      console.log('操作已取消。');
      shouldWrite = false;
    }
  } catch {
    // 文件不存在，直接写入
    // 无需询问
  }

  if (shouldWrite) {
    // 写入 JSON（格式化，缩进 2 空格）
    await fs.writeFile(jsonPath, JSON.stringify(finalData, null, 2), 'utf8');
    console.log(`成功写入 "${jsonPath}"`);
  }

  rl.close();
}

main().catch((err) => {
  console.error('发生错误:', err);
  rl.close();
  process.exit(1);
});