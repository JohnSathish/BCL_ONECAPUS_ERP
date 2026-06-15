#!/usr/bin/env node
/**
 * Run k6 inside Docker with host networking that works on Linux and Windows.
 * Usage: node scripts/load-test/run-k6.mjs [pre-launch-smoke.js|pre-launch.js]
 *
 * Env: BASE_URL (default http://host.docker.internal:3001/api for local turbo dev)
 *      TENANT_SLUG, STUDENT_EMAIL, STUDENT_PASSWORD
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptName = process.argv[2] || 'pre-launch-smoke.js';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mountPath = scriptDir.replace(/\\/g, '/');

// Direct API port in turbo dev; override for nginx/staging (e.g. http://host.docker.internal/api)
const baseUrl = process.env.BASE_URL || 'http://host.docker.internal:3001/api';

const envArgs = [
  ['BASE_URL', baseUrl],
  ['TENANT_SLUG', process.env.TENANT_SLUG || 'demo'],
  ['STUDENT_EMAIL', process.env.STUDENT_EMAIL || 'student@demo.edu'],
  ['STUDENT_PASSWORD', process.env.STUDENT_PASSWORD || 'Student@123'],
]
  .filter(([, v]) => v)
  .flatMap(([k, v]) => ['-e', `${k}=${v}`]);

const dockerArgs = [
  'run',
  '--rm',
  // Required on Linux Docker; also fixes Windows when host.docker.internal DNS fails
  '--add-host=host.docker.internal:host-gateway',
  '-v',
  `${mountPath}:/scripts`,
  ...envArgs,
  'grafana/k6',
  'run',
  `/scripts/${scriptName}`,
];

console.log(`[load-test] BASE_URL=${baseUrl}`);
console.log(`[load-test] script=${scriptName}`);

const result = spawnSync('docker', dockerArgs, { stdio: 'inherit' });
process.exit(result.status ?? 1);
