import { createRequire } from 'module';
import { join } from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeRequire = createRequire(__filename);

/** Resolve generated Prisma client across monorepo dev paths and Docker (/app). */
export function loadPrismaClientCtor(): new () => Record<string, unknown> {
  const moduleDir = join(__dirname);
  const candidates = [
    join(process.cwd(), 'node_modules/.prisma/client'),
    join(moduleDir, '../../node_modules/.prisma/client'),
    join(moduleDir, '../../../api/node_modules/.prisma/client'),
    join(moduleDir, '../../../../api/node_modules/.prisma/client'),
    join(moduleDir, '../../../../../node_modules/.prisma/client'),
    join(moduleDir, '../../../../../api/node_modules/.prisma/client'),
  ];
  for (const candidate of candidates) {
    try {
      return nodeRequire(candidate).PrismaClient;
    } catch {
      // try next path
    }
  }
  throw new Error('Prisma client not found. Run: npm run db:generate -w api');
}
