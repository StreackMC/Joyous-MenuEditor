#!/usr/bin/env node
/**
 * 本脚本用于精简 MC 译名的 key 值，并只保留方块或物品的译名
 */

const fs = require('fs');
const path = require('path');

// 获取命令行参数
const filename = process.argv[2];
if (!filename) {
  console.error('用法: node filter-minecraft.js <JSON文件路径>');
  process.exit(1);
}

try {
  // 1. 检查文件是否存在
  if (!fs.existsSync(filename)) {
    throw new Error(`文件不存在: ${filename}`);
  }

  // 2. 备份原始文件（添加随机后缀）
  const backupFilename = `${filename}_bak${Math.floor(Math.random() * 100000)}.json`;
  fs.copyFileSync(filename, backupFilename);
  console.log(`已备份到: ${backupFilename}`);

  // 3. 读取并解析 JSON
  const rawData = fs.readFileSync(filename, 'utf8');
  const originalObj = JSON.parse(rawData);

  // 4. 过滤键值对
  const filteredObj = {};
  const itemPrefix = 'item.minecraft.';
  const blockPrefix = 'block.minecraft.';

  for (const [key, value] of Object.entries(originalObj)) {
    let newKey = null;
    if (key.startsWith(itemPrefix)) {
      newKey = key;
      if (newKey !== null && !newKey.slice(itemPrefix.length).includes('.')) {
        // 如果匹配了前缀，且后续不包含点号，则保留
        filteredObj[newKey] = value;
      }
    } else if (key.startsWith(blockPrefix)) {
      newKey = key;
      if (newKey !== null && !newKey.slice(blockPrefix.length).includes('.')) {
        // 如果匹配了前缀，且后续不包含点号，则保留
        filteredObj[newKey] = value;
      }
    }
    // 否则舍弃（包括前缀不匹配，或新键含点）
  }

  // 5. 将过滤后的对象写回原文件（紧凑格式，节省空间）
  fs.writeFileSync(filename, JSON.stringify(filteredObj));
  console.log(`已过滤并写入: ${filename}`);

} catch (err) {
  console.error('错误:', err.message);
  process.exit(1);
}