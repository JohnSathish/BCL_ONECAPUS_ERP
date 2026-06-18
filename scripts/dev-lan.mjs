#!/usr/bin/env node
/**
 * Start dev stack reachable on the office LAN (0.0.0.0).
 * Staff open http://<your-lan-ip>:3000 from other PCs on the same network.
 */
import { spawn, execSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

function detectLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

const lanIp = detectLanIp();
const webOrigin = `http://${lanIp}:3000`;

console.log('\n=== NEP ERP — LAN dev server ===');
console.log(`LAN URL for staff:  ${webOrigin}`);
console.log(`API (direct):       http://${lanIp}:3001/api`);
console.log('\nRegistering LAN host in tenant_domains…');

try {
  execSync(`npx tsx scripts/production-bootstrap.ts --register-host ${lanIp}`, {
    cwd: join(rootDir, 'apps/api'),
    stdio: 'inherit',
    shell: true,
  });
} catch {
  console.warn('Could not auto-register LAN host. Run production-bootstrap manually.');
}

console.log('\nWindows firewall: allow inbound TCP 3000 and 3001 if staff cannot connect.');
console.log('Press Ctrl+C to stop.\n');

try {
  execSync('npm run dev:infra', { cwd: rootDir, stdio: 'inherit', shell: true });
  execSync('npm run dev:free-ports', { cwd: rootDir, stdio: 'inherit', shell: true });
} catch {
  process.exit(1);
}

const env = {
  ...process.env,
  API_HOST: '0.0.0.0',
  HOST: '0.0.0.0',
  WEB_ORIGIN: webOrigin,
  CORS_EXTRA_ORIGINS: webOrigin,
};

const procs = [
  spawn('npm', ['run', 'dev', '-w', 'api'], { cwd: rootDir, env, stdio: 'inherit', shell: true }),
  spawn('npm', ['run', 'dev', '-w', 'worker'], {
    cwd: rootDir,
    env,
    stdio: 'inherit',
    shell: true,
  }),
  spawn('npm', ['run', 'dev:lan', '-w', 'web'], {
    cwd: rootDir,
    env,
    stdio: 'inherit',
    shell: true,
  }),
];

function shutdown() {
  for (const p of procs) {
    try {
      p.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

procs[0].on('exit', (code) => {
  if (code && code !== 0) shutdown();
});
procs[1].on('exit', (code) => {
  if (code && code !== 0) shutdown();
});
procs[2].on('exit', (code) => {
  if (code && code !== 0) shutdown();
});
