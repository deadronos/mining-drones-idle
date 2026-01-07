#!/usr/bin/env node
/* eslint-disable no-console */

import { spawnSync } from 'child_process';

function main() {
  const res = spawnSync('wasm-pack', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });

  if (res.status === 0) {
    const out = res.stdout.toString().trim();
    console.log(`wasm-pack found: ${out}`);
    process.exit(0);
  }

  console.error('\n🚨 wasm-pack not found or not runnable.');
  console.error('This project uses the Rust WASM toolchain. Install wasm-pack with:');
  console.error('\n  cargo install wasm-pack\n');
  console.error('Make sure your cargo bin directory (e.g. %USERPROFILE%\\.cargo\\bin on Windows) is on your PATH, then verify:');
  console.error('\n  wasm-pack --version\n');
  console.error('If you are on Windows ARM64 and saw "Unsupported platform" during npm install, installing wasm-pack via cargo avoids the failing npm postinstall step.');
  process.exit(1);
}

main();
