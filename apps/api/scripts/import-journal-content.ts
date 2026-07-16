/**
 * Reusable journal content importer (Google Sites → Journal CMS).
 *
 *   npx tsx scripts/import-journal-content.ts --tenant=demo --journal=transient --source=google-sites --base-url=https://sites.google.com/donboscocollege.ac.in/transient
 *   npx tsx scripts/import-journal-content.ts --tenant=demo --journal=transient --snapshot=./data/journals/transient/snapshot.json --dry-run
 *   npx tsx scripts/import-journal-content.ts ... --crawl-live
 */
import { readFile } from 'fs/promises';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../src/shared/storage/storage.service';
import { GoogleSitesAdapter } from '../src/modules/journals/import/google-sites.adapter';
import { JournalContentImporter } from '../src/modules/journals/import/journal-content.importer';
import type { JournalImportManifest } from '../src/modules/journals/import/types';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const tenantSlug = readArg('tenant') ?? 'demo';
  const journalSlug = readArg('journal') ?? 'transient';
  const source = readArg('source') ?? 'google-sites';
  const baseUrl =
    readArg('base-url') ??
    'https://sites.google.com/donboscocollege.ac.in/transient';
  const snapshot =
    readArg('snapshot') ??
    join(process.cwd(), 'data', 'journals', journalSlug, 'snapshot.json');
  const dryRun = hasFlag('dry-run');
  const crawlLive = hasFlag('crawl-live');

  const prisma = new PrismaClient();
  const config = new ConfigService(process.env);
  const storage = new StorageService(config);

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantSlug}`);
    }

    let manifest: JournalImportManifest;
    if (source === 'google-sites' || source === 'snapshot') {
      const adapter = new GoogleSitesAdapter({
        baseUrl,
        snapshotPath: snapshot,
        crawlLive,
      });
      manifest = await adapter.fetchManifest();
    } else if (source === 'json') {
      manifest = JSON.parse(
        await readFile(snapshot, 'utf8'),
      ) as JournalImportManifest;
    } else {
      throw new Error(
        `Unknown --source=${source} (use google-sites|snapshot|json)`,
      );
    }

    console.log(
      `Importing ${journalSlug} from ${manifest.source} (dryRun=${dryRun}, crawlLive=${crawlLive})…`,
    );

    const importer = new JournalContentImporter(prisma, storage);
    const report = await importer.run({
      tenantId: tenant.id,
      journalSlug,
      manifest,
      dryRun,
    });
    const reportKey = await importer.writeReportFile(report, journalSlug);

    console.log('—— Import report ——');
    console.log(JSON.stringify(report.counts, null, 2));
    console.log(`Report file: ${reportKey}`);
    console.log(
      `Pending review: ${report.items.filter((i) => i.status === 'pendingReview').length}`,
    );
    if (report.counts.failed > 0) {
      console.error(
        report.items.filter((i) => i.status === 'failed').slice(0, 20),
      );
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
