import { createRequire } from 'module';
import { join } from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeRequire = createRequire(__filename);

export function loadPrismaClientCtor(): new () => Record<string, unknown> {
  const moduleDir = join(__dirname);
  const candidates = [
    join(moduleDir, '../../../../api/node_modules/.prisma/client'),
    join(moduleDir, '../../../api/node_modules/.prisma/client'),
    join(moduleDir, '../../../../../node_modules/.prisma/client'),
    join(moduleDir, '../../../../../api/node_modules/.prisma/client'),
    join(moduleDir, '../../node_modules/.prisma/client'),
  ];
  for (const candidate of candidates) {
    try {
      return nodeRequire(candidate).PrismaClient;
    } catch {
      // try next
    }
  }
  throw new Error('Prisma client not found. Run: npm run db:generate -w api');
}

let prisma: Record<string, unknown> | null = null;

export function backupDb() {
  if (!prisma) prisma = new (loadPrismaClientCtor())();
  return prisma as {
    backupRun: {
      findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
      update: (args: unknown) => Promise<unknown>;
      create: (args: unknown) => Promise<Record<string, unknown>>;
    };
    backupArtifact: {
      create: (args: unknown) => Promise<unknown>;
      findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    };
    backupCloudTarget: {
      findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
      update: (args: unknown) => Promise<unknown>;
    };
    systemMaintenanceFlag: {
      upsert: (args: unknown) => Promise<unknown>;
    };
    $disconnect: () => Promise<void>;
  };
}

export function backupPaths() {
  const root = process.cwd();
  const localUploads = join(root, 'uploads');
  const localStorage = join(root, 'storage');
  const localBackups = join(root, 'backups');

  const resolve = (envValue: string | undefined, local: string, docker: string) => {
    if (envValue) {
      if (process.platform === 'win32' && envValue.replace(/\\/g, '/').startsWith('/data')) {
        return local;
      }
      return envValue;
    }
    return process.platform === 'win32' ? local : docker;
  };

  return {
    backupRoot: resolve(process.env.BACKUP_ROOT, localBackups, '/data/backups'),
    uploadRoot: resolve(process.env.UPLOAD_ROOT, localUploads, '/data/uploads'),
    storageRoot: resolve(process.env.STORAGE_ROOT, localStorage, '/data/storage'),
    databaseUrl: process.env.DATABASE_URL ?? '',
    skipDump: process.env.BACKUP_SKIP_DUMP === 'true' || process.platform === 'win32',
  };
}
