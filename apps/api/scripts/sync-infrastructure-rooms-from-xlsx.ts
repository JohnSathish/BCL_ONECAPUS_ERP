/**
 * Sync college classroom halls from infrastructure-rooms.xlsx (Prisma-only).
 *
 * Match key: tenantId + code = ROOM-{hall} (no duplicates).
 * Creates missing rooms; updates capacity / floor / name / desk metadata when changed.
 *
 *   npx tsx scripts/sync-infrastructure-rooms-from-xlsx.ts --dry-run
 *   npx tsx scripts/sync-infrastructure-rooms-from-xlsx.ts
 *   npx tsx scripts/sync-infrastructure-rooms-from-xlsx.ts --xlsx="C:/path/to/file.xlsx"
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

type ExcelRoom = {
  sl: number;
  hall: string;
  floorRaw: string;
  classType: string;
  capacity: number;
  deskBench: string;
};

type SyncPlan = {
  code: string;
  name: string;
  shortName: string;
  capacity: number;
  floorId: string;
  buildingId: string;
  roomTypeId: string;
  campusId: string | null;
  metadata: Record<string, unknown>;
  description: string;
  action: 'create' | 'update' | 'unchanged';
  changes: string[];
};

const CLASS_TYPE_NAMES: Record<string, string> = {
  'HONS. CL-1': 'Honours Classroom 1',
  'HONS. CL-2': 'Honours Classroom 2',
  'GEN.CL': 'General Classroom',
  'SCI.CL-1': 'Science Classroom 1',
  'SCI.CL-2': 'Science Classroom 2',
  'ADDL.CL-1': 'Additional Classroom 1',
  'HONS.CL': 'Honours Classroom',
  'ZOO. HONS': 'Zoology Honours Classroom',
  'ZOO. GEN': 'Zoology General Classroom',
  'HONS.PHY': 'Physics Honours Classroom',
  'HONS.MTH': 'Mathematics Honours Classroom',
  'COMMERCE-1': 'Commerce Classroom 1',
  'COMMER-2': 'Commerce Classroom 2',
  'COMM-3': 'Commerce Classroom 3',
};

const FLOOR_ALIASES: Record<string, { name: string; floorNumber: number }> = {
  'g.floor': { name: 'Ground Floor', floorNumber: 0 },
  'g floor': { name: 'Ground Floor', floorNumber: 0 },
  'ground floor': { name: 'Ground Floor', floorNumber: 0 },
  '1st floor': { name: 'First Floor', floorNumber: 1 },
  '1stfloor': { name: 'First Floor', floorNumber: 1 },
  'first floor': { name: 'First Floor', floorNumber: 1 },
  '2nd floor': { name: 'Second Floor', floorNumber: 2 },
  '2ndfloor': { name: 'Second Floor', floorNumber: 2 },
  'second floor': { name: 'Second Floor', floorNumber: 2 },
};

function parseArgs(argv: string[]) {
  const dryRun = argv.includes('--dry-run');
  const xlsxArg = argv.find((a) => a.startsWith('--xlsx='));
  const xlsxPath = xlsxArg
    ? resolve(xlsxArg.slice('--xlsx='.length))
    : resolve(__dirname, 'data/infrastructure-rooms.xlsx');
  return { dryRun, xlsxPath };
}

function normalizeFloorKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function roomNameFromClassType(classType: string, hall: string): string {
  const key = classType.trim().toUpperCase().replace(/\s+/g, ' ');
  const mapped =
    CLASS_TYPE_NAMES[key] ??
    CLASS_TYPE_NAMES[classType.trim()] ??
    `${classType.trim()} (Hall ${hall})`;
  return mapped;
}

function shortNameFromClassType(classType: string): string {
  return classType
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .slice(0, 24);
}

/** Minimal xlsx reader via ExcelJS (already a dependency of the API). */
async function parseXlsx(path: string): Promise<ExcelRoom[]> {
  // exceljs is CJS; default import shape varies under tsx
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ExcelJSMod = require('exceljs') as typeof import('exceljs') & {
    default?: typeof import('exceljs');
  };
  const ExcelJS = (ExcelJSMod as any).default ?? ExcelJSMod;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync(path) as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Workbook has no sheets');

  const rows: ExcelRoom[] = [];
  sheet.eachRow((row: any, rowNumber: number) => {
    if (rowNumber <= 2) return; // title + header
    const values = (row.values as any[]).slice(1);
    const sl = Number(values[0]);
    const hallRaw = values[1];
    if (!hallRaw && !sl) return;
    const hall = String(hallRaw ?? '').trim();
    if (!hall) return;
    const floorRaw = String(values[2] ?? '').trim();
    const classType = String(values[3] ?? '').trim();
    const capacity = Number(values[4] ?? 0);
    const deskBench = String(values[5] ?? '').trim();
    rows.push({
      sl: Number.isFinite(sl) ? sl : rowNumber - 2,
      hall,
      floorRaw,
      classType,
      capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : 40,
      deskBench,
    });
  });
  return rows;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableJson(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(',')}}`;
}

function metaEqual(a: unknown, b: Record<string, unknown>): boolean {
  return stableJson(a ?? {}) === stableJson(b);
}

async function main() {
  const { dryRun, xlsxPath } = parseArgs(process.argv.slice(2));
  const excelRows = await parseXlsx(xlsxPath);
  if (!excelRows.length) throw new Error(`No room rows in ${xlsxPath}`);

  console.log(`XLSX: ${xlsxPath}`);
  console.log(`Rows: ${excelRows.length} | dryRun=${dryRun}`);

  const prisma = new PrismaClient();
  try {
    const tenant =
      (await prisma.tenant.findFirst({
        where: { name: { contains: 'Don Bosco' } },
      })) ?? (await prisma.tenant.findFirst({ where: { slug: 'demo' } }));
    if (!tenant) throw new Error('Tenant not found');

    const campus = await prisma.campus.findFirst({
      where: { tenantId: tenant.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    let building = await (prisma as any).infrastructureBuilding.findFirst({
      where: { tenantId: tenant.id, deletedAt: null, name: 'Main Building' },
    });
    if (!building) {
      building = await (prisma as any).infrastructureBuilding.findFirst({
        where: { tenantId: tenant.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
    }
    if (!building) {
      throw new Error(
        'No infrastructure building found. Create Main Building first.',
      );
    }

    const floors = await (prisma as any).infrastructureFloor.findMany({
      where: {
        tenantId: tenant.id,
        buildingId: building.id,
        deletedAt: null,
      },
    });
    const floorByName = new Map<string, any>(
      floors.map((f: any) => [f.name.trim().toLowerCase(), f]),
    );

    // Ensure Ground / First / Second floors exist for Excel mapping
    for (const alias of Object.values(FLOOR_ALIASES)) {
      const key = alias.name.toLowerCase();
      if (floorByName.has(key)) continue;
      if (dryRun) {
        console.log(`[dry-run] would create floor: ${alias.name}`);
        continue;
      }
      const created = await (prisma as any).infrastructureFloor.create({
        data: {
          tenantId: tenant.id,
          buildingId: building.id,
          name: alias.name,
          floorNumber: alias.floorNumber,
          status: 'ACTIVE',
        },
      });
      floorByName.set(key, created);
      console.log(`Created floor: ${alias.name}`);
    }

    let roomType = await prisma.roomType.findFirst({
      where: { tenantId: tenant.id, code: 'CLASSROOM' },
    });
    if (!roomType) {
      roomType = await prisma.roomType.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { sortOrder: 'asc' },
      });
    }
    if (!roomType) throw new Error('No room type found for tenant');

    const existing = await prisma.classroom.findMany({
      where: { tenantId: tenant.id },
    });
    const byCode = new Map(
      existing.map((r) => [r.code.trim().toUpperCase(), r]),
    );

    const plans: SyncPlan[] = [];
    const seenCodes = new Set<string>();

    for (const row of excelRows) {
      const code = `ROOM-${String(row.hall).trim()}`.toUpperCase();
      if (seenCodes.has(code)) {
        console.warn(`Skipping duplicate hall in Excel: ${row.hall}`);
        continue;
      }
      seenCodes.add(code);

      const floorKey = normalizeFloorKey(row.floorRaw);
      const floorAlias = FLOOR_ALIASES[floorKey];
      if (!floorAlias) {
        throw new Error(
          `Unknown floor "${row.floorRaw}" for hall ${row.hall}. Add an alias.`,
        );
      }
      const floor = floorByName.get(floorAlias.name.toLowerCase());
      if (!floor && !dryRun) {
        throw new Error(
          `Floor ${floorAlias.name} missing under ${building.name}`,
        );
      }

      const name = roomNameFromClassType(row.classType, String(row.hall));
      const shortName = shortNameFromClassType(row.classType);
      const metadata = {
        source: 'infrastructure-rooms.xlsx',
        hall: String(row.hall),
        classType: row.classType.trim(),
        deskBench: row.deskBench,
        floorLabel: row.floorRaw.trim(),
      };
      const description = [
        row.classType.trim(),
        row.deskBench ? `Desk/Bench: ${row.deskBench}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      const current = byCode.get(code);
      const floorId = floor?.id ?? `pending:${floorAlias.name}`;
      const changes: string[] = [];

      if (!current || current.deletedAt) {
        plans.push({
          code,
          name,
          shortName,
          capacity: row.capacity,
          floorId,
          buildingId: building.id,
          roomTypeId: roomType.id,
          campusId: campus?.id ?? null,
          metadata,
          description,
          action: 'create',
          changes: current?.deletedAt
            ? ['restore soft-deleted', 'set fields from Excel']
            : ['new from Excel'],
        });
        continue;
      }

      if (current.name !== name)
        changes.push(`name: ${current.name} → ${name}`);
      if ((current.shortName ?? '') !== shortName)
        changes.push(`shortName: ${current.shortName ?? ''} → ${shortName}`);
      if (current.capacity !== row.capacity)
        changes.push(`capacity: ${current.capacity} → ${row.capacity}`);
      if (current.buildingId !== building.id)
        changes.push(`building → ${building.name}`);
      if (current.floorId !== floor?.id)
        changes.push(`floor → ${floorAlias.name}`);
      if (current.roomTypeId !== roomType.id)
        changes.push(`roomType → ${roomType.code}`);
      if (campus?.id && current.campusId !== campus.id)
        changes.push(`campus → ${campus.name}`);
      if ((current.description ?? '') !== description)
        changes.push('description');
      if (!metaEqual(current.metadata, metadata)) changes.push('metadata');

      plans.push({
        code,
        name,
        shortName,
        capacity: row.capacity,
        floorId,
        buildingId: building.id,
        roomTypeId: roomType.id,
        campusId: campus?.id ?? null,
        metadata,
        description,
        action: changes.length ? 'update' : 'unchanged',
        changes,
      });
    }

    const summary = {
      create: plans.filter((p) => p.action === 'create').length,
      update: plans.filter((p) => p.action === 'update').length,
      unchanged: plans.filter((p) => p.action === 'unchanged').length,
    };
    console.log('\nPlan summary:', summary);
    for (const p of plans) {
      const tag =
        p.action === 'unchanged' ? '=' : p.action === 'create' ? '+' : '~';
      console.log(
        `${tag} ${p.code} | ${p.name} | cap=${p.capacity} | ${p.changes.join('; ') || 'no changes'}`,
      );
    }

    if (dryRun) {
      console.log('\nDry-run only — no writes.');
      return;
    }

    let created = 0;
    let updated = 0;
    for (const p of plans) {
      if (p.action === 'unchanged') continue;
      const current = byCode.get(p.code);

      if (!current) {
        await prisma.classroom.create({
          data: {
            tenantId: tenant.id,
            code: p.code,
            name: p.name,
            shortName: p.shortName,
            description: p.description,
            capacity: p.capacity,
            campusId: p.campusId,
            buildingId: p.buildingId,
            floorId: p.floorId,
            roomTypeId: p.roomTypeId,
            status: 'ACTIVE',
            availableForTimetable: true,
            availableForAttendance: true,
            metadata: p.metadata,
          },
        });
        created += 1;
        continue;
      }

      await prisma.classroom.update({
        where: { id: current.id },
        data: {
          name: p.name,
          shortName: p.shortName,
          description: p.description,
          capacity: p.capacity,
          campusId: p.campusId,
          buildingId: p.buildingId,
          floorId: p.floorId,
          roomTypeId: p.roomTypeId,
          status: 'ACTIVE',
          deletedAt: null,
          metadata: p.metadata,
        },
      });
      updated += 1;
    }

    console.log(`\nDone. created=${created} updated=${updated}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
