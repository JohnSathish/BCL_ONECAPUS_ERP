import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const assetDirs = [
  'src/modules/proposals/assets',
  'src/modules/school-admissions/assets',
  'src/modules/school-sis/assets',
];

for (const source of assetDirs) {
  if (!existsSync(source)) continue;
  const target = source.replace(/^src\//, 'dist/');
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}
