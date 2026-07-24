/**
 * One-time import of FYUG interest registrations from Excel.
 *
 * Usage:
 *   npx tsx scripts/import-fyug-interest-xlsx.ts
 *   npx tsx scripts/import-fyug-interest-xlsx.ts --tenant=demo --dry-run
 *   npx tsx scripts/import-fyug-interest-xlsx.ts --file="E:/path/to/file.xlsx"
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import {
  resolveStorageRoot,
  resolveUploadRoot,
} from '../src/common/uploads/upload-paths';

const SOURCE_ORIGIN = 'https://donboscocollege.ac.in';
const DEFAULT_FILE = 'E:/Projects/1505NEWERP/fyug-admissions (8).xlsx';

type CliOptions = {
  tenantSlug: string;
  dryRun: boolean;
  file: string;
  skipPhotos: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  let tenantSlug = 'demo';
  let dryRun = false;
  let file = DEFAULT_FILE;
  let skipPhotos = false;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--skip-photos') skipPhotos = true;
    else if (arg.startsWith('--tenant='))
      tenantSlug = arg.slice('--tenant='.length) || 'demo';
    else if (arg.startsWith('--file=')) file = arg.slice('--file='.length);
  }
  return { tenantSlug, dryRun, file, skipPhotos };
}

function cellText(value: unknown): string {
  if (value == null) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value).trim();
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text.trim();
    if ('result' in obj && obj.result != null) return String(obj.result).trim();
    if (obj instanceof Date) return obj.toISOString();
  }
  return String(value).trim();
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
  const text = cellText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return new Date(`${text.slice(0, 10)}T00:00:00.000Z`);
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()),
  );
}

function yesNo(value: unknown): boolean {
  const text = cellText(value).toLowerCase();
  return text === 'yes' || text === 'true' || text === '1' || text === 'y';
}

async function writeDual(storageKey: string, buffer: Buffer) {
  const storagePath = join(resolveStorageRoot(), storageKey);
  await mkdir(dirname(storagePath), { recursive: true });
  await writeFile(storagePath, buffer);
  const uploadPath = join(resolveUploadRoot(), storageKey);
  await mkdir(dirname(uploadPath), { recursive: true });
  await writeFile(uploadPath, buffer);
}

async function downloadPhoto(
  photoPath: string,
  tenantId: string,
  siteId: string,
): Promise<{ publicUrl: string; storageKey: string } | null> {
  if (!photoPath) return null;
  const absolute = photoPath.startsWith('http')
    ? photoPath
    : `${SOURCE_ORIGIN}${photoPath.startsWith('/') ? '' : '/'}${photoPath}`;
  try {
    const res = await fetch(absolute, {
      headers: { 'user-agent': 'BCL-OneCampus-FyugImporter/1.0' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) return null;
    const contentType = (res.headers.get('content-type') || 'image/jpeg').split(
      ';',
    )[0];
    const ext =
      extname(photoPath.split('?')[0]).toLowerCase() ||
      (contentType.includes('png')
        ? '.png'
        : contentType.includes('webp')
          ? '.webp'
          : '.jpg');
    const hash = createHash('sha1').update(absolute).digest('hex').slice(0, 10);
    const storageKey = `website/${tenantId}/${siteId}/fyug/${randomUUID()}-${hash}${ext}`;
    await writeDual(storageKey, buffer);
    return { publicUrl: `/uploads/${storageKey}`, storageKey };
  } catch {
    return null;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const report = {
    found: 0,
    imported: 0,
    skipped: 0,
    photos: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: opts.tenantSlug },
    });
    if (!tenant) throw new Error(`Tenant not found: ${opts.tenantSlug}`);
    const actor = await prisma.user.findFirst({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true },
    });
    if (!actor) throw new Error('No active user for tenant');
    const site = await prisma.websiteSite.upsert({
      where: { tenantId: tenant.id },
      update: { updatedById: actor.id },
      create: {
        tenantId: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(opts.file);
    const sheet = wb.worksheets[0];
    if (!sheet) throw new Error('Excel has no worksheets');
    const headers = (sheet.getRow(1).values as unknown[])
      .slice(1)
      .map((v) => cellText(v));
    const col = (name: string) =>
      headers.findIndex((h) => h.toLowerCase() === name.toLowerCase()) + 1;

    const indexes = {
      applicationNo: col('Application No'),
      name: col('Name'),
      mobile: col('Mobile'),
      whatsapp: col('WhatsApp'),
      email: col('Email'),
      gender: col('Gender'),
      dob: col('Date of Birth'),
      state: col('State'),
      college: col('College'),
      university: col('Affiliated University'),
      otherUniversity: col('Other University'),
      major: col('Major'),
      minor: col('Minor'),
      honours: col('Honours Applied'),
      cuet: col('CUET Score'),
      cgpa: col('CGPA'),
      percentage: col('Percentage'),
      backPapers: col('Back Papers'),
      backPaperDetails: col('Back Paper Details'),
      status: col('Status'),
      remarks: col('Remarks'),
      fatherName: col('Father Name'),
      fatherMobile: col('Father Mobile'),
      motherName: col('Mother Name'),
      motherMobile: col('Mother Mobile'),
      photo: col('Photo URL'),
      signature: col('Typed Signature'),
      submittedAt: col('Submitted At'),
      session: col('Academic Session'),
    };

    for (let r = 2; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      const fullName = cellText(row.getCell(indexes.name).value);
      const email = cellText(row.getCell(indexes.email).value).toLowerCase();
      const applicationNumber = cellText(
        row.getCell(indexes.applicationNo).value,
      );
      if (!fullName && !email && !applicationNumber) continue;
      report.found += 1;
      const label = applicationNumber || email || fullName;

      try {
        if (!fullName || !email || !applicationNumber) {
          throw new Error('Missing required application no / name / email');
        }
        const existing = await prisma.websiteFyugInterest.findFirst({
          where: {
            siteId: site.id,
            applicationNumber,
          },
        });
        if (existing) {
          report.skipped += 1;
          console.log(`[${r}] SKIP ${label}`);
          continue;
        }

        const dob = parseDate(row.getCell(indexes.dob).value);
        if (!dob) throw new Error(`Invalid DOB for ${label}`);
        const submittedAt =
          parseDate(row.getCell(indexes.submittedAt).value) ?? new Date();
        // parseDate zeros time — for submittedAt keep original if ISO string
        const submittedRaw = cellText(row.getCell(indexes.submittedAt).value);
        const createdAt = submittedRaw ? new Date(submittedRaw) : submittedAt;
        const genderRaw = cellText(row.getCell(indexes.gender).value);
        const gender = genderRaw.toLowerCase().startsWith('f')
          ? 'Female'
          : genderRaw.toLowerCase().startsWith('m')
            ? 'Male'
            : genderRaw || 'Male';
        const university =
          cellText(row.getCell(indexes.university).value) ||
          cellText(row.getCell(indexes.otherUniversity).value) ||
          'NEHU';
        const photoPath = cellText(row.getCell(indexes.photo).value);
        let photographUrl: string | null = null;
        let photographKey: string | null = null;
        if (!opts.skipPhotos && photoPath && !opts.dryRun) {
          const stored = await downloadPhoto(photoPath, tenant.id, site.id);
          if (stored) {
            photographUrl = stored.publicUrl;
            photographKey = stored.storageKey;
            report.photos += 1;
          }
        }

        if (opts.dryRun) {
          report.imported += 1;
          console.log(`[${r}] DRY ${label}`);
          continue;
        }

        await prisma.websiteFyugInterest.create({
          data: {
            tenantId: tenant.id,
            siteId: site.id,
            applicationNumber,
            academicSession:
              cellText(row.getCell(indexes.session).value) || '2026-2027',
            fullName: fullName.toUpperCase(),
            photographUrl,
            photographKey,
            gender,
            dateOfBirth: dob,
            mobile: cellText(row.getCell(indexes.mobile).value).slice(0, 30),
            whatsapp:
              cellText(row.getCell(indexes.whatsapp).value).slice(0, 30) ||
              cellText(row.getCell(indexes.mobile).value).slice(0, 30),
            email,
            state: cellText(row.getCell(indexes.state).value) || 'Meghalaya',
            fatherName: cellText(row.getCell(indexes.fatherName).value) || '—',
            fatherMobile:
              cellText(row.getCell(indexes.fatherMobile).value).slice(0, 30) ||
              '—',
            motherName: cellText(row.getCell(indexes.motherName).value) || '—',
            motherMobile:
              cellText(row.getCell(indexes.motherMobile).value).slice(0, 30) ||
              '—',
            collegeLastAttended:
              cellText(row.getCell(indexes.college).value) || '—',
            affiliatedUniversity: university,
            majorCourse: cellText(row.getCell(indexes.major).value) || '—',
            minorCourse: cellText(row.getCell(indexes.minor).value) || '—',
            applyingHonoursIn:
              cellText(row.getCell(indexes.honours).value) || '—',
            cuetScore: cellText(row.getCell(indexes.cuet).value),
            cgpaSemesterV: cellText(row.getCell(indexes.cgpa).value),
            percentageSemesterV: cellText(
              row.getCell(indexes.percentage).value,
            ),
            hasBackPapers: yesNo(row.getCell(indexes.backPapers).value),
            backPaperDetails: cellText(
              row.getCell(indexes.backPaperDetails).value,
            ),
            declarationAccepted: true,
            signatureName:
              cellText(row.getCell(indexes.signature).value) || fullName,
            remarks: cellText(row.getCell(indexes.remarks).value),
            status: cellText(row.getCell(indexes.status).value) || 'SUBMITTED',
            createdAt: Number.isNaN(createdAt.getTime())
              ? new Date()
              : createdAt,
          },
        });
        report.imported += 1;
        console.log(`[${r}] OK ${label}${photographUrl ? ' +photo' : ''}`);
      } catch (error) {
        report.failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        report.errors.push(`${label}: ${message}`);
        console.error(`[${r}] FAIL ${label}`, message);
      }
    }

    console.log('\nIMPORT REPORT');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
