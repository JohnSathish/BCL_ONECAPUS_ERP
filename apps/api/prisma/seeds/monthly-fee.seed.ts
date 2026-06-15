import type { PrismaClient } from '@prisma/client';
import {
  DON_BOSCO_MONTHLY_PLANS,
  VTC_MONTHLY_MODIFIER,
} from '../../src/modules/fees/constants/monthly-fee.constants';
import { INSTITUTION_FEE_DEFAULTS } from '../../src/modules/fees/constants/collection-modes.constants';

export async function seedDonBoscoMonthlyPlans(
  prisma: PrismaClient,
  tenantId: string,
) {
  const db = prisma as unknown as Record<string, any>;
  const planDb = (prisma as any).monthlyFeePlan;
  if (!planDb) {
    console.warn(
      'MonthlyFeePlan model not in Prisma client — run prisma generate',
    );
    return;
  }

  const shifts = await db.shift.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, code: true },
  });
  const shiftByCode = new Map(
    shifts.map((s: { code: string; id: string }) => [
      s.code.toUpperCase(),
      s.id,
    ]),
  );

  for (const plan of DON_BOSCO_MONTHLY_PLANS) {
    let shiftId: string | null = null;
    if (plan.shiftCodes[0] !== '*') {
      shiftId =
        (shiftByCode.get(plan.shiftCodes[0].toUpperCase()) as
          | string
          | undefined) ?? null;
    }

    const existing = await planDb.findFirst({
      where: { tenantId, code: plan.code, deletedAt: null },
    });

    if (existing) {
      await db.monthlyFeePlanLine.deleteMany({
        where: { planId: existing.id },
      });
      await db.monthlyFeePlanLine.createMany({
        data: plan.lines.map((line, i) => ({
          tenantId,
          planId: existing.id,
          code: line.code,
          name: line.name,
          amount: line.amount,
          sortOrder: (i + 1) * 10,
        })),
      });
      continue;
    }

    await planDb.create({
      data: {
        tenantId,
        code: plan.code,
        name: plan.name,
        majorSlug: plan.majorSlug,
        shiftId,
        status: 'ACTIVE',
        lines: {
          create: plan.lines.map((line, i) => ({
            tenantId,
            code: line.code,
            name: line.name,
            amount: line.amount,
            sortOrder: (i + 1) * 10,
          })),
        },
      },
    });
  }

  await db.monthlyFeeModifier.upsert({
    where: { tenantId_code: { tenantId, code: VTC_MONTHLY_MODIFIER.code } },
    create: {
      tenantId,
      code: VTC_MONTHLY_MODIFIER.code,
      name: VTC_MONTHLY_MODIFIER.name,
      ruleType: VTC_MONTHLY_MODIFIER.ruleType,
      amount: VTC_MONTHLY_MODIFIER.amount,
      isActive: true,
    },
    update: { amount: VTC_MONTHLY_MODIFIER.amount, isActive: true },
  });

  const products = [
    {
      code: 'ADMISSION_SESSION',
      name: 'Admission & Session Fee',
      engineType: 'BIENNIAL',
      demandType: 'ADMISSION_SESSION',
    },
    {
      code: 'MONTHLY_TUITION',
      name: 'Monthly Tuition',
      engineType: 'MONTHLY',
      demandType: 'MONTHLY_TUITION',
    },
    {
      code: 'HOSTEL',
      name: 'Hostel Fee',
      engineType: 'CUSTOM',
      demandType: 'HOSTEL',
    },
    {
      code: 'TRANSPORT',
      name: 'Transport Fee',
      engineType: 'CUSTOM',
      demandType: 'TRANSPORT',
    },
    {
      code: 'EXAM_FEE',
      name: 'Examination Fee',
      engineType: 'CUSTOM',
      demandType: 'EXAM_FEE',
    },
  ];

  for (const p of products) {
    await db.feeProductRegistry.upsert({
      where: { tenantId_code: { tenantId, code: p.code } },
      create: {
        tenantId,
        ...p,
        isActive: p.code !== 'HOSTEL' && p.code !== 'TRANSPORT',
      },
      update: {
        name: p.name,
        engineType: p.engineType,
        demandType: p.demandType,
      },
    });
  }

  await db.feeFinanceSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      ...INSTITUTION_FEE_DEFAULTS,
      collectionModes: INSTITUTION_FEE_DEFAULTS.collectionModes,
    },
    update: {
      collectionModes: INSTITUTION_FEE_DEFAULTS.collectionModes,
      onlinePaymentEnabled: INSTITUTION_FEE_DEFAULTS.onlinePaymentEnabled,
      cashCollectionEnabled: INSTITUTION_FEE_DEFAULTS.cashCollectionEnabled,
      officeQrEnabled: INSTITUTION_FEE_DEFAULTS.officeQrEnabled,
      monthlyDueDay: INSTITUTION_FEE_DEFAULTS.monthlyDueDay,
      cashReceiptPrefix: INSTITUTION_FEE_DEFAULTS.cashReceiptPrefix,
      receiptPrefix: INSTITUTION_FEE_DEFAULTS.receiptPrefix,
      paymentRequestExpiryMinutes:
        INSTITUTION_FEE_DEFAULTS.paymentRequestExpiryMinutes,
    },
  });

  const schemes = [
    {
      code: 'MERIT',
      name: 'Merit Scholarship',
      schemeType: 'MERIT',
      calculationType: 'PERCENTAGE',
      value: 50,
    },
    {
      code: 'MINORITY',
      name: 'Minority Scholarship',
      schemeType: 'MINORITY',
      calculationType: 'FIXED',
      value: 2000,
    },
    {
      code: 'MANAGEMENT',
      name: 'Management Scholarship',
      schemeType: 'MANAGEMENT',
      calculationType: 'FIXED',
      value: 1000,
    },
    {
      code: 'SPORTS',
      name: 'Sports Scholarship',
      schemeType: 'SPORTS',
      calculationType: 'FIXED',
      value: 500,
    },
    {
      code: 'STAFF_CHILD',
      name: 'Staff Child Concession',
      schemeType: 'STAFF_CHILD',
      calculationType: 'PERCENTAGE',
      value: 25,
    },
  ];
  for (const s of schemes) {
    await db.scholarshipScheme.upsert({
      where: { tenantId_code: { tenantId, code: s.code } },
      create: { tenantId, ...s, isActive: true },
      update: { name: s.name, value: s.value, isActive: true },
    });
  }

  console.log('Don Bosco monthly fee plans seeded');
}
