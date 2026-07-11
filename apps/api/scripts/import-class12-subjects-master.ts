/**
 * Import Class XII Subject Master from CSV into SupportBoardSubject.
 *
 * Usage (from apps/api):
 *   npx tsx scripts/import-class12-subjects-master.ts
 *   npx tsx scripts/import-class12-subjects-master.ts --csv=prisma/data/class12-subjects-master.csv
 *   npx tsx scripts/import-class12-subjects-master.ts --tenant=<uuid>
 *
 * Deactivates legacy unscoped (GENERAL / null board) seed rows so they no longer
 * appear in Class XII dropdowns.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const out: { csv?: string; tenant?: string } = {};
  for (const a of args) {
    if (a.startsWith('--csv=')) out.csv = a.slice(6);
    if (a.startsWith('--tenant=')) out.tenant = a.slice(9);
  }
  return out;
}

function normalizeStream(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!s) return 'GENERAL';
  if (s.includes('HUMANITIES') || s === 'ARTS' || s === 'ART') return 'ARTS';
  if (s.includes('SCIENCE') || s === 'SCI') return 'SCIENCE';
  if (s.includes('COMMERCE') || s === 'COM') return 'COMMERCE';
  return s.replace(/[^A-Z0-9]+/g, '_');
}

function normalizeBoard(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, ' ');
}

function slugify(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function buildCode(board: string, stream: string, subjectName: string): string {
  return `${board.replace(/[^A-Z0-9]+/g, '_')}_${stream}_${slugify(subjectName)}`.slice(
    0,
    80,
  );
}

function parseCsv(content: string): Array<{
  boardCode: string;
  streamCode: string;
  subjectName: string;
  sortOrder: number;
}> {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].toLowerCase();
  if (!header.includes('boardcode') || !header.includes('subjectname')) {
    throw new Error(
      'CSV must have header: boardCode,streamCode,subjectName,sortOrder',
    );
  }
  const rows: Array<{
    boardCode: string;
    streamCode: string;
    subjectName: string;
    sortOrder: number;
  }> = [];
  for (const line of lines.slice(1)) {
    // Simple CSV split (no quoted commas in this template)
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length < 3) continue;
    const [boardCode, streamCode, subjectName, sortRaw] = parts;
    if (!boardCode || !subjectName) continue;
    rows.push({
      boardCode: normalizeBoard(boardCode),
      streamCode: normalizeStream(streamCode || 'GENERAL'),
      subjectName: subjectName.trim(),
      sortOrder: Number(sortRaw) || 0,
    });
  }
  return rows;
}

async function main() {
  const args = parseArgs();
  const csvPath =
    args.csv ??
    join(__dirname, '..', 'prisma', 'data', 'class12-subjects-master.csv');
  const content = readFileSync(csvPath, 'utf8');
  const rows = parseCsv(content);
  if (!rows.length) {
    throw new Error(`No rows parsed from ${csvPath}`);
  }

  const tenants = args.tenant
    ? await prisma.tenant.findMany({
        where: { id: args.tenant, deletedAt: null },
      })
    : await prisma.tenant.findMany({ where: { deletedAt: null } });

  if (!tenants.length) {
    throw new Error('No tenants found');
  }

  console.log(
    `Importing ${rows.length} Class XII subjects for ${tenants.length} tenant(s)…`,
  );

  for (const tenant of tenants) {
    let created = 0;
    let updated = 0;

    // Soft-deactivate legacy unscoped GENERAL / null board rows
    const deactivated = await prisma.supportBoardSubject.updateMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        OR: [
          { boardType: null },
          { boardType: { equals: 'GENERAL', mode: 'insensitive' } },
        ],
      },
      data: { isActive: false },
    });
    console.log(
      `  tenant ${tenant.id}: deactivated ${deactivated.count} legacy GENERAL/null board rows`,
    );

    for (const row of rows) {
      const subjectCode = buildCode(
        row.boardCode,
        row.streamCode,
        row.subjectName,
      );
      const existing = await prisma.supportBoardSubject.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [
            { subjectCode },
            {
              boardType: { equals: row.boardCode, mode: 'insensitive' },
              category: { equals: row.streamCode, mode: 'insensitive' },
              subjectName: { equals: row.subjectName, mode: 'insensitive' },
              deletedAt: null,
            },
          ],
        },
      });

      if (existing) {
        await prisma.supportBoardSubject.update({
          where: { id: existing.id },
          data: {
            subjectCode,
            subjectName: row.subjectName,
            boardType: row.boardCode,
            category: row.streamCode,
            sortOrder: row.sortOrder,
            isActive: true,
            deletedAt: null,
          },
        });
        updated++;
      } else {
        await prisma.supportBoardSubject.create({
          data: {
            tenantId: tenant.id,
            subjectCode,
            subjectName: row.subjectName,
            boardType: row.boardCode,
            category: row.streamCode,
            sortOrder: row.sortOrder,
            isActive: true,
          },
        });
        created++;
      }
    }

    console.log(`  tenant ${tenant.id}: created=${created} updated=${updated}`);
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
