#!/usr/bin/env node
/**
 * Start local Postgres + Redis via Docker Compose and wait until healthy.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function dockerAvailable() {
  const result = spawnSync('docker', ['info'], {
    cwd: root,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

async function waitFor(label, host, port) {
  const script = path.join(root, 'scripts', 'wait-for-tcp.mjs');
  run('node', [script, host, String(port), '120000', label]);
}

console.log('[dev:infra] Starting Postgres and Redis (docker compose)...');

if (!dockerAvailable()) {
  console.error(
    '[dev:infra] Docker is not running. Start Docker Desktop, then run:\n' +
      '  npm run dev:infra\n' +
      'Or start Postgres on localhost:15432 and Redis on localhost:6379 manually.',
  );
  process.exit(1);
}

run('docker', ['compose', 'up', '-d', 'postgres', 'redis']);

await waitFor('postgres:15432', '127.0.0.1', 15432);
await waitFor('redis:6379', '127.0.0.1', 6379);

console.log('[dev:infra] Infrastructure is ready.');
