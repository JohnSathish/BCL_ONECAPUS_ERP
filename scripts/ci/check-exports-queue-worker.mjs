import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(__dirname, '../../apps/api/src');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const offenders = [];
for (const file of walk(apiSrc)) {
  if (file.endsWith('exports-queue.processor.ts')) continue;
  const text = fs.readFileSync(file, 'utf8');
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  if (/@Processor\(\s*['"]exports['"]\s*\)/.test(stripped)) {
    offenders.push(path.relative(apiSrc, file));
  }
}

if (offenders.length > 0) {
  console.error('Only shared/queue/exports-queue.processor.ts may use @Processor("exports").');
  console.error('Found extra exports workers:');
  for (const file of offenders) console.error(`  - ${file}`);
  process.exit(1);
}

console.log('OK: single exports queue worker');
