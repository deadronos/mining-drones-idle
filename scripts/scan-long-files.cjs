#!/usr/bin/env node
// scripts/scan-long-files.cjs
// Recursively scan /src for files > 300 lines and print them

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');
const DEFAULT_THRESHOLD = 300;

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split('\n').length;
}

function main() {
  const thresholdArg = process.argv.find(arg => arg.startsWith('--threshold='));
  const threshold = thresholdArg ? parseInt(thresholdArg.split('=')[1], 10) : DEFAULT_THRESHOLD;
  const jsonOutput = process.argv.includes('--json');

  const allFiles = getAllFiles(SRC_DIR);
  const longFiles = allFiles
    .map(file => ({ file, lines: countLines(file) }))
    .filter(({ lines }) => lines > threshold);

  if (jsonOutput) {
    console.log(JSON.stringify(longFiles, null, 2));
  } else {
    if (longFiles.length === 0) {
      console.log(`No files over ${threshold} lines.`);
      return;
    }
    console.log(`Files in /src over ${threshold} lines:`);
    longFiles.forEach(({ file, lines }) => {
      console.log(`${file.replace(/\\/g, '/')} (${lines} lines)`);
    });
  }
}

if (require.main === module) {
  main();
}
