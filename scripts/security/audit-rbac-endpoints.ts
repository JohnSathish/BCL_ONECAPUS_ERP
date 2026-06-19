/**
 * Static RBAC audit — fails CI if controller handlers lack @Public() or @RequirePermissions().
 *
 *   npx tsx scripts/security/audit-rbac-endpoints.ts
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const API_SRC = join(__dirname, '../../apps/api/src');

const JWT_ONLY_ALLOWLIST: Array<{ file: string; pattern: RegExp }> = [
  {
    file: 'modules/auth/auth.controller.ts',
    pattern: /change-password|sessions\/revoke-all|permissions\/refresh/,
  },
  { file: 'modules/auth/mfa/mfa.controller.ts', pattern: /status|setup|verify-setup|disable/ },
  { file: 'modules/auth/step-up.controller.ts', pattern: /step-up/ },
  { file: 'modules/users/users.controller.ts', pattern: /me\/preferences/ },
];

const PUBLIC_CONTROLLER_PATTERNS = [
  /health\.controller\.ts$/,
  /demo-request\.controller\.ts$/,
  /payroll-verify\.controller\.ts$/,
  /id-cards-public\.controller\.ts$/,
  /campus-kiosk-public\.controller\.ts$/,
  /auth\.controller\.ts$/,
];

type Finding = { file: string; line: number; handler: string; issue: string };

function walkControllers(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkControllers(full, out);
    else if (name.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

function hasGuardDecorators(text: string): boolean {
  return (
    /@Public\s*\(\s*\)/.test(text) ||
    /@RequirePermissions\s*\(/.test(text) ||
    /@RequireAnyPermission\s*\(/.test(text)
  );
}

function auditFile(absPath: string): Finding[] {
  const rel = relative(API_SRC, absPath).replace(/\\/g, '/');
  if (PUBLIC_CONTROLLER_PATTERNS.some((p) => p.test(rel))) return [];

  const src = readFileSync(absPath, 'utf8');
  const lines = src.split('\n');
  const findings: Finding[] = [];

  const classGuard = hasGuardDecorators(src.split('export class')[0] ?? '');

  const httpLine = /^\s*@(Get|Post|Put|Patch|Delete)\(/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!httpLine.test(line)) continue;

    const routeMatch = line.match(/@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/);
    const httpMethod = routeMatch?.[1] ?? 'HTTP';
    const routePath = routeMatch?.[2]?.replace(/['"]/g, '') ?? '';

    let blockStart = i;
    for (let j = i - 1; j >= 0; j--) {
      if (/^\s*(async\s+)?\w+\s*\(/.test(lines[j]!)) break;
      if (lines[j]!.trim() === '') continue;
      blockStart = j;
    }

    let blockEnd = i;
    for (let j = i + 1; j < Math.min(lines.length, i + 15); j++) {
      blockEnd = j;
      if (/^\s*(async\s+)?\w+\s*\([^)]*\)\s*(\{|:)/.test(lines[j]!)) break;
    }

    const block = lines.slice(blockStart, blockEnd + 1).join('\n');
    if (hasGuardDecorators(block) || classGuard) continue;

    const fnLine = lines.slice(i, blockEnd + 1).find((l) => /^\s*(async\s+)?\w+\s*\(/.test(l));
    const fnMatch = fnLine?.match(/^\s*(?:async\s+)?(\w+)\s*\(/);
    const handler = fnMatch?.[1] ?? (routePath || httpMethod);

    if (JWT_ONLY_ALLOWLIST.some((a) => rel.endsWith(a.file) && a.pattern.test(block))) {
      continue;
    }

    findings.push({
      file: rel,
      line: i + 1,
      handler,
      issue: `Missing @Public() or @RequirePermissions on ${httpMethod} ${routePath || '(root)'}`,
    });
  }

  return findings;
}

function main() {
  const controllers = walkControllers(API_SRC);
  const all: Finding[] = [];
  for (const f of controllers) {
    all.push(...auditFile(f));
  }

  if (!all.length) {
    console.log(`PASS  RBAC audit — ${controllers.length} controllers, no unguarded handlers.`);
    process.exit(0);
  }

  console.error(`FAIL  RBAC audit — ${all.length} unguarded handler(s):\n`);
  for (const f of all.slice(0, 40)) {
    console.error(`  ${f.file}:${f.line}  ${f.handler}  — ${f.issue}`);
  }
  if (all.length > 40) {
    console.error(`  … and ${all.length - 40} more`);
  }
  process.exit(1);
}

main();
