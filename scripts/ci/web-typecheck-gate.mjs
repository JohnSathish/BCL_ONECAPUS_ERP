#!/usr/bin/env node
/**
 * Fails CI when web TypeScript errors exceed the checked-in baseline.
 * Lower scripts/ci/web-typecheck-baseline.txt as errors are fixed.
 *
 * Usage: npm run typecheck -w web 2>&1 | tee typecheck.log
 *        node scripts/ci/web-typecheck-gate.mjs typecheck.log
 */
import fs from 'node:fs';
import path from 'node:path';

const logPath = process.argv[2] ?? 'typecheck.log';
const baselinePath = path.join(process.cwd(), 'scripts/ci/web-typecheck-baseline.txt');

const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
const matches = [...log.matchAll(/error TS\d+:/g)];
const count = matches.length;
const baseline = Number.parseInt(fs.readFileSync(baselinePath, 'utf8').trim(), 10);

console.log(`Web typecheck: ${count} error(s) (baseline ${baseline})`);

if (Number.isNaN(baseline)) {
  console.error('Invalid baseline file:', baselinePath);
  process.exit(1);
}

if (count > baseline) {
  console.error(
    `\n❌ Web typecheck regressed: ${count} errors (baseline allows ${baseline}).\n` +
      'Fix new TypeScript errors or update scripts/ci/web-typecheck-baseline.txt only when intentionally paying down debt.\n',
  );
  process.exit(1);
}

if (count < baseline) {
  console.log(
    `✓ ${baseline - count} fewer error(s) than baseline — consider lowering scripts/ci/web-typecheck-baseline.txt`,
  );
}

console.log('✓ Web typecheck within baseline');
