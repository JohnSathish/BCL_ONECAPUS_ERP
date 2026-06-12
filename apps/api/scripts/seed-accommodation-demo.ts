/**
 * Seeds demo quarters, allotments, monthly charges (Prisma-only, no Nest bootstrap).
 * Run: npx ts-node --transpile-only scripts/seed-accommodation-demo.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_QUARTERS = [
  {
    code: 'QTR-101',
    quarterNumber: '101',
    quarterType: 'FACULTY',
    block: 'Block A',
    floor: 'G',
    rooms: 3,
    rent: 500,
    status: 'VACANT',
  },
  {
    code: 'QTR-102',
    quarterNumber: '102',
    quarterType: 'FACULTY',
    block: 'Block A',
    floor: '1',
    rooms: 3,
    rent: 500,
    status: 'VACANT',
  },
  {
    code: 'QTR-103',
    quarterNumber: '103',
    quarterType: 'TEACHING',
    block: 'Block A',
    floor: '1',
    rooms: 2,
    rent: 450,
    status: 'VACANT',
  },
  {
    code: 'QTR-104',
    quarterNumber: '104',
    quarterType: 'TEACHING',
    block: 'Block A',
    floor: '2',
    rooms: 2,
    rent: 450,
    status: 'VACANT',
  },
  {
    code: 'QTR-105',
    quarterNumber: '105',
    quarterType: 'NON_TEACHING',
    block: 'Block B',
    floor: 'G',
    rooms: 2,
    rent: 400,
    status: 'VACANT',
  },
  {
    code: 'QTR-106',
    quarterNumber: '106',
    quarterType: 'NON_TEACHING',
    block: 'Block B',
    floor: '1',
    rooms: 2,
    rent: 400,
    status: 'VACANT',
  },
  {
    code: 'QTR-107',
    quarterNumber: '107',
    quarterType: 'WARDEN',
    block: 'Block B',
    floor: '2',
    rooms: 4,
    rent: 600,
    status: 'VACANT',
  },
  {
    code: 'QTR-108',
    quarterNumber: '108',
    quarterType: 'GUEST_HOUSE',
    block: 'Guest House',
    floor: 'G',
    rooms: 1,
    rent: 800,
    status: 'VACANT',
  },
  {
    code: 'QTR-109',
    quarterNumber: '109',
    quarterType: 'VISITING_FACULTY',
    block: 'Guest House',
    floor: '1',
    rooms: 1,
    rent: 700,
    status: 'VACANT',
  },
  {
    code: 'QTR-110',
    quarterNumber: '110',
    quarterType: 'TEACHING',
    block: 'Block C',
    floor: 'G',
    rooms: 2,
    rent: 450,
    status: 'VACANT',
  },
  {
    code: 'QTR-111',
    quarterNumber: '111',
    quarterType: 'TEACHING',
    block: 'Block C',
    floor: '1',
    rooms: 2,
    rent: 450,
    status: 'MAINTENANCE',
  },
  {
    code: 'QTR-112',
    quarterNumber: '112',
    quarterType: 'PRINCIPAL',
    block: 'Block A',
    floor: 'G',
    rooms: 5,
    rent: 1000,
    status: 'RESERVED',
  },
] as const;

const ALLOTMENTS = [
  { staffName: 'ZINNIA K Marak', quarterCode: 'QTR-102' },
  { staffName: 'Kimberley Nokimbe', quarterCode: 'QTR-104' },
  { staffName: 'LOUIS ARIMBOOR', quarterCode: 'QTR-101' },
];

const DEFAULT_TYPES = [
  { slug: 'FACULTY', name: 'Faculty Quarter' },
  { slug: 'TEACHING', name: 'Teaching Staff Quarter' },
  { slug: 'NON_TEACHING', name: 'Non-Teaching Staff Quarter' },
  { slug: 'GUEST_HOUSE', name: 'Guest House' },
  { slug: 'VISITING_FACULTY', name: 'Visiting Faculty Accommodation' },
  { slug: 'WARDEN', name: 'Warden Quarter' },
  { slug: 'PRINCIPAL', name: 'Principal Residence' },
];

async function ensureTypes(tenantId: string) {
  for (const [i, t] of DEFAULT_TYPES.entries()) {
    await prisma.quarterTypeConfig.upsert({
      where: { tenantId_slug: { tenantId, slug: t.slug } },
      create: {
        tenantId,
        slug: t.slug,
        name: t.name,
        isSystem: true,
        sortOrder: (i + 1) * 10,
      },
      update: {},
    });
  }
}

async function allotStaff(
  tenantId: string,
  staffId: string,
  quarterId: string,
  adminId: string | null,
  allottedAt: Date,
) {
  const quarter = await prisma.staffQuarter.findUnique({
    where: { id: quarterId },
  });
  if (!quarter) return null;

  return prisma.$transaction(async (tx) => {
    const occ = await tx.quarterOccupancy.create({
      data: {
        tenantId,
        quarterId,
        staffProfileId: staffId,
        status: 'ACTIVE',
        allottedAt,
        monthlyRent: quarter.monthlyRent,
        waterCharge: quarter.waterCharge,
        electricityCharge: quarter.electricityCharge,
        maintenanceCharge: quarter.maintenanceCharge,
        internetCharge: quarter.internetCharge,
        payrollDeductionEnabled: true,
        notes: 'Demo seed allotment',
        createdById: adminId,
      },
    });
    await tx.staffQuarter.update({
      where: { id: quarterId },
      data: { status: 'OCCUPIED' },
    });
    await tx.quarterAuditLog.create({
      data: {
        tenantId,
        entityType: 'OCCUPANCY',
        entityId: occ.id,
        action: 'QUARTER_ALLOCATED',
        userId: adminId,
        newValue: { quarterId, staffProfileId: staffId },
      },
    });
    return occ;
  });
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  await ensureTypes(tenant.id);

  const existingCount = await prisma.staffQuarter.count({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  if (existingCount < 10) {
    for (const q of DEMO_QUARTERS) {
      const exists = await prisma.staffQuarter.findFirst({
        where: { tenantId: tenant.id, code: q.code },
      });
      if (exists) continue;
      await prisma.staffQuarter.create({
        data: {
          tenantId: tenant.id,
          code: q.code,
          quarterNumber: q.quarterNumber,
          quarterType: q.quarterType,
          block: q.block,
          floor: q.floor,
          numberOfRooms: q.rooms,
          status: q.status,
          monthlyRent: q.rent,
          waterCharge: 100,
          electricityCharge: 250,
          maintenanceCharge: 150,
          internetCharge: 0,
          remarks: 'Demo seed quarter',
        },
      });
    }
    console.log('Created demo quarters');
  } else {
    console.log(`Skipping quarter seed — ${existingCount} quarters exist`);
  }

  const allottedAt = new Date('2026-06-01');
  for (const a of ALLOTMENTS) {
    const staff = await prisma.staffProfile.findFirst({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        fullName: { contains: a.staffName, mode: 'insensitive' },
      },
    });
    if (!staff) {
      console.warn(`Staff not found: ${a.staffName}`);
      continue;
    }

    const active = await prisma.quarterOccupancy.findFirst({
      where: {
        tenantId: tenant.id,
        staffProfileId: staff.id,
        status: 'ACTIVE',
      },
    });
    if (active) {
      console.log(`Already allotted: ${staff.fullName} → existing occupancy`);
      continue;
    }

    let quarter = await prisma.staffQuarter.findFirst({
      where: { tenantId: tenant.id, code: a.quarterCode, deletedAt: null },
    });
    if (!quarter) {
      console.warn(`Quarter not found: ${a.quarterCode}`);
      continue;
    }
    if (quarter.status !== 'VACANT' && quarter.status !== 'OCCUPIED') {
      await prisma.staffQuarter.update({
        where: { id: quarter.id },
        data: { status: 'VACANT' },
      });
      quarter = { ...quarter, status: 'VACANT' };
    }
    if (quarter.status === 'OCCUPIED') {
      console.warn(
        `Quarter ${a.quarterCode} occupied by someone else — skipping ${staff.fullName}`,
      );
      continue;
    }

    const occ = await allotStaff(
      tenant.id,
      staff.id,
      quarter.id,
      admin?.id ?? null,
      allottedAt,
    );
    console.log(`Allotted ${staff.fullName} → ${a.quarterCode}`);

    const existingCharge = await prisma.quarterMonthlyCharge.findFirst({
      where: {
        tenantId: tenant.id,
        staffProfileId: staff.id,
        billingMonth: 6,
        billingYear: 2026,
        chargeType: 'ELECTRICITY',
      },
    });
    if (!existingCharge && occ) {
      await prisma.quarterMonthlyCharge.create({
        data: {
          tenantId: tenant.id,
          quarterId: quarter.id,
          staffProfileId: staff.id,
          occupancyId: occ.id,
          chargeType: 'ELECTRICITY',
          billingMonth: 6,
          billingYear: 2026,
          amount: 320,
          remarks: 'June electricity bill (demo seed)',
          createdById: admin?.id ?? null,
        },
      });
      console.log(`Posted electricity charge ₹320 for ${staff.fullName}`);
    }
  }

  const run = await prisma.payrollRun.findFirst({
    where: {
      tenantId: tenant.id,
      month: 6,
      year: 2026,
      payScaleType: 'COLLEGE_TEACHING',
    },
  });
  if (run) {
    console.log(
      `\nJune 2026 payroll run: ${run.id} (${run.status}, locked=${run.locked})`,
    );
    console.log(
      '→ Open HR → Payroll Runs → select June 2026 → Calculate to apply accommodation deductions',
    );
  } else {
    console.warn('\nJune 2026 COLLEGE_TEACHING payroll run not found');
  }

  const summary = await prisma.staffQuarter.groupBy({
    by: ['status'],
    where: { tenantId: tenant.id, deletedAt: null },
    _count: true,
  });
  console.log('\nQuarter status summary:', summary);
  console.log(
    'Active occupancies:',
    await prisma.quarterOccupancy.count({
      where: { tenantId: tenant.id, status: 'ACTIVE' },
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
