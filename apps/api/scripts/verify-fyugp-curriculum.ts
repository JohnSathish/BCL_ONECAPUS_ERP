/**
 * One-shot verification for finalized FYUGP Sem 1–6 curriculum.
 *   npx tsx scripts/verify-fyugp-curriculum.ts
 */
import { execSync } from 'node:child_process';
import path from 'node:path';

const root = path.join(__dirname);
const checks = [
  'audit-fyugp-curriculum.ts',
  'check-day-sem1-pools.ts',
  'check-morning-sem1-pools.ts',
  'check-day-sem2-pools.ts',
  'check-morning-sem2-pools.ts',
  'check-day-sem3-pools.ts',
  'check-morning-sem3-pools.ts',
  'check-sem4-vtc-pools.ts',
  'check-day-sem6-vtc-pools.ts',
  'check-morning-sem6-vtc-pools.ts',
  'check-arts-curriculum-mappings.ts',
  'check-science-curriculum-mappings.ts',
  'check-commerce-curriculum-mappings.ts',
];

let failed = 0;
for (const script of checks) {
  console.log(`\n>> ${script}`);
  try {
    execSync(`npx tsx ${path.join(root, script)}`, {
      stdio: 'inherit',
      cwd: path.join(root, '..'),
    });
  } catch {
    failed += 1;
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll FYUGP curriculum checks passed.');
