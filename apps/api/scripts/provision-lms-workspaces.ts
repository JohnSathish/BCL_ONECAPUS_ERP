/**
 * Provision LMS workspaces for existing offering sections and pool offerings.
 *
 *   npx ts-node --transpile-only scripts/provision-lms-workspaces.ts
 *   npx ts-node --transpile-only scripts/provision-lms-workspaces.ts --tenant=demo
 */
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { LmsWorkspaceService } from '../src/modules/lms/services/lms-workspace.service';
import { LmsSettingsService } from '../src/modules/lms/services/lms-settings.service';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = readArg('tenant') ?? 'demo';

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const settings = app.get(LmsSettingsService);
    const workspaces = app.get(LmsWorkspaceService);
    await settings.getOrCreate(tenant.id);
    const result = await workspaces.provisionAllForTenant(tenant.id);
    console.log(`LMS workspace provision complete for ${tenantSlug}:`, result);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
