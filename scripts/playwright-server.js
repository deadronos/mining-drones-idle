#!/usr/bin/env node
const http = require('http');
const { spawn } = require('child_process');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 5173;

function checkServer() {
  return new Promise((resolve) => {
    const req = http.request({ method: 'GET', host: HOST, port: PORT, path: '/' }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(true));
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

(async () => {
  const up = await checkServer();
  if (up) {
    console.log(`Dev server already listening on http://${HOST}:${PORT}`);
    // keep node process alive until killed by Playwright
    setInterval(() => {}, 1000);
    return;
  }

  console.log('Starting dev server: npm run dev -- --host');
  const child = spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'dev', '--', '--host'],
    {
      stdio: 'inherit',
      shell: false,
    },
  );

  child.on('exit', (code) => {
    console.log(`Dev server process exited with ${code}`);
    process.exit(code);
  });

  // forward signals
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
})();
