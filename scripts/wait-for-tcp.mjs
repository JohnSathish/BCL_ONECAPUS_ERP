#!/usr/bin/env node
/**
 * Wait until a TCP host:port accepts connections (used before API boot in dev).
 */
import net from 'node:net';

const host = process.argv[2] ?? '127.0.0.1';
const port = Number(process.argv[3] ?? '15432');
const timeoutMs = Number(process.argv[4] ?? '90000');
const label = process.argv[5] ?? `${host}:${port}`;

if (!Number.isFinite(port)) {
  console.error('[wait-for-tcp] Invalid port:', process.argv[3]);
  process.exit(1);
}

function probe() {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

const started = Date.now();

async function main() {
  while (Date.now() - started < timeoutMs) {
    if (await probe()) {
      console.log(`[wait-for-tcp] ${label} is ready`);
      return;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.error(
    `[wait-for-tcp] Timed out waiting for ${label} after ${timeoutMs}ms.\n` +
      'Start infrastructure with: npm run dev:infra',
  );
  process.exit(1);
}

main().catch((error) => {
  console.error('[wait-for-tcp] Failed:', error);
  process.exit(1);
});
