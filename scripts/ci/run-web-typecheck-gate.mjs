#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const logPath = path.join(process.cwd(), 'typecheck-web.log');

try {
  const output = execSync('npm run typecheck -w web', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  fs.writeFileSync(logPath, output);
} catch (error) {
  const err = error;
  const stdout = err?.stdout?.toString?.() ?? '';
  const stderr = err?.stderr?.toString?.() ?? '';
  fs.writeFileSync(logPath, `${stdout}\n${stderr}`);
}

execSync(`node scripts/ci/web-typecheck-gate.mjs "${logPath}"`, {
  stdio: 'inherit',
});
