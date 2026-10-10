import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import ts from 'typescript';

const compilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  strict: false,
  sourceMap: false,
  declaration: false,
  importHelpers: false,
  isolatedModules: true,
};

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full, files);
      continue;
    }
    if (
      !entry.endsWith('.ts') ||
      entry.endsWith('.spec.ts') ||
      entry.endsWith('.d.ts')
    )
      continue;
    files.push(full);
  }
  return files;
}

rmSync('dist', { recursive: true, force: true });

const files = walk('src');
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions,
    fileName: file,
    reportDiagnostics: false,
  });
  const target = join('dist', relative('src', file).replace(/\.ts$/, '.js'));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, outputText);
}

console.log(`Transpiled ${files.length} files`);
