import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const serverBundle = resolve(process.cwd(), 'dist/frontend/server/server.mjs');
const npmExecPath = process.env.npm_execpath;
const fixedPort = Number(process.env.PORT ?? '4000');

if (!npmExecPath) {
  throw new Error('npm_execpath is not available');
}

const buildProcess = spawn(process.execPath, [npmExecPath, 'run', 'build', '--', '--configuration', 'development', '--watch'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverProcess = null;
let hasStartedServer = false;

const startServer = () => {
  if (!existsSync(serverBundle)) {
    return;
  }

  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }

  serverProcess = spawn(process.execPath, [serverBundle], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: String(fixedPort)
    }
  });

  hasStartedServer = true;
  console.log(`SSR server listening on http://localhost:${fixedPort}`);
};

const stopAll = () => {
  if (serverProcess) {
    serverProcess.kill();
  }

  if (!buildProcess.killed) {
    buildProcess.kill();
  }

  process.exit(0);
};

buildProcess.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);

  if (text.includes('Application bundle generation complete.')) {
    void startServer();
  }
});

buildProcess.stderr.on('data', (chunk) => {
  process.stderr.write(chunk.toString());
});

buildProcess.on('exit', (code) => {
  if (!hasStartedServer) {
    process.exit(code ?? 1);
  }
});

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
