import type { PrismaClient } from '@prisma/client';
import {
  cycleLineAmounts,
  DON_BOSCO_DEFAULT_FEE_CYCLES,
  DON_BOSCO_DEFAULT_FEE_HEADS,
} from '../../src/modules/fees/constants/fee-cycle.constants';

export async function seedDonBoscoFeeCycles(
  prisma: PrismaClient,
  tenantId: string,
  createdById?: string,
) {
  const db = prisma as unknown as Record<string, any>;

  const headMap = new Map<string, string>();
  for (const head of DON_BOSCO_DEFAULT_FEE_HEADS) {
    const row = await db.feeHeadMaster.upsert({
      where: { tenantId_code: { tenantId, code: head.code } },
      create: {
        tenantId,
        code: head.code,
        name: head.name,
        amount: head.amount,
        sortOrder: head.sortOrder,
        isActive: true,
        category: 'SESSION',
      },
      update: {
        name: head.name,
        amount: head.amount,
        sortOrder: head.sortOrder,
        isActive: true,
        deletedAt: null,
      },
    });
    headMap.set(head.code, row.id);
  }

  for (const cycle of DON_BOSCO_DEFAULT_FEE_CYCLES) {
    const existing = await db.academicFeeCycle.findFirst({
      where: { tenantId, code: cycle.code, deletedAt: null },
    });

    const amounts = cycleLineAmounts(cycle.code);
    const lines = Object.entries(amounts).map(([code, amount], index) => ({
      tenantId,
      feeHeadId: headMap.get(code)!,
      amount,
      sortOrder: (index + 1) * 10,
    }));

    if (existing) {
      await db.academicFeeCycleLine.deleteMany({
        where: { feeCycleId: existing.id },
      });
      await db.academicFeeCycleLine.createMany({
        data: lines.map((line) => ({ ...line, feeCycleId: existing.id })),
      });
      await db.academicFeeCycle.update({
        where: { id: existing.id },
        data: {
          name: cycle.name,
          fyugpYear: cycle.fyugpYear,
          startSemester: cycle.startSemester,
          endSemester: cycle.endSemester,
          totalAmount: cycle.totalAmount,
          description: cycle.description,
          status: 'ACTIVE',
        },
      });
      continue;
    }

    await db.academicFeeCycle.create({
      data: {
        tenantId,
        code: cycle.code,
        name: cycle.name,
        fyugpYear: cycle.fyugpYear,
        startSemester: cycle.startSemester,
        endSemester: cycle.endSemester,
        totalAmount: cycle.totalAmount,
        description: cycle.description,
        status: 'ACTIVE',
        createdById,
        lines: { create: lines },
      },
    });
  }

  console.log('Don Bosco FYUP fee heads and cycles seeded');
}
