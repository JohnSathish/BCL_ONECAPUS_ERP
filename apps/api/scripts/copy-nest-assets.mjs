import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

function copyJson(dir) {
  for (const entry of readdirSync(dir)) {
    const source = join(dir, entry);
    if (statSync(source).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      copyJson(source);
      continue;
    }
    if (!entry.endsWith('.json')) continue;
    const target = source.replace(/^src[/\\]/, 'dist/');
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target);
  }
}

copyJson('src');
