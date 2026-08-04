/**
 * Production cleanup: remove student fee transactional test data and lock student Fee Module.
 *
 * KEPT: fee masters, categories/heads, structures, cycles, plans, fine rules, gateway providers,
 * FeeFinanceSettings row (flag updated), collection centers registry.
 *
 * REMOVED (tenant-scoped): demands, demand lines, payments, allocations, receipts, ledger,
 * payment requests, external fee payments, fee summaries, settlement match lines,
 * related accounting integration logs + vouchers for FEE_LEDGER_ENTRY, fee-related notifications.
 *
 * Run from apps/api (after applying migration for student_portal_fees_enabled):
 *
 *   CONFIRM=YES npx ts-node --transpile-only scripts/purge-student-fee-transactions.ts
 *   CONFIRM=YES TENANT_SLUG=your-slug npx ts-node --transpile-only scripts/purge-student-fee-transactions.ts
 *   DRY_RUN=1 CONFIRM=YES npx ts-node --transpile-only scripts/purge-student-fee-transactions.ts
 *
 * Windows PowerShell:
 *   $env:CONFIRM='YES'; $env:TENANT_SLUG='demo'; npx ts-node --transpile-only scripts/purge-student-fee-transactions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const confirmed = process.env.CONFIRM === 'YES';

async function resolveTenant() {
  const slug = process.env.TENANT_SLUG?.trim();
  if (slug) {
    const bySlug = await prisma.tenant.findFirst({
      where: { slug, deletedAt: null },
    });
    if (bySlug) return bySlug;
  }
  const byName = await prisma.tenant.findFirst({
    where: {
      name: { contains: 'Don Bosco', mode: 'insensitive' },
      deletedAt: null,
    },
  });
  if (byName) return byName;
  return prisma.tenant.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
}

async function countWhere(label: string, fn: () => Promise<number>) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`  count skipped for ${label}:`, (err as Error).message);
    return -1;
  }
}

async function main() {
  if (!confirmed) {
    throw new Error(
      'Refusing to run without CONFIRM=YES (this permanently deletes fee transaction data).',
    );
  }

  const tenant = await resolveTenant();
  if (!tenant) throw new Error('Tenant not found');
  const tenantId = tenant.id;

  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}Purging student fee transactions for ${tenant.name} (${tenantId})`,
  );

  const before = {
    paymentAllocation: await countWhere('paymentAllocation', () =>
      prisma.paymentAllocation.count({ where: { tenantId } }),
    ),
    feeSettlementLine: await countWhere('feeSettlementLine', () =>
      prisma.feeSettlementLine.count({ where: { tenantId } }),
    ),
    paymentGatewayLog: await countWhere('paymentGatewayLog', () =>
      prisma.paymentGatewayLog.count({ where: { tenantId } }),
    ),
    paymentWebhookLog: await countWhere('paymentWebhookLog', () =>
      prisma.paymentWebhookLog.count({ where: { tenantId } }),
    ),
    feeReceipt: await countWhere('feeReceipt', () =>
      prisma.feeReceipt.count({ where: { tenantId } }),
    ),
    feePaymentRequest: await countWhere('feePaymentRequest', () =>
      prisma.feePaymentRequest.count({ where: { tenantId } }),
    ),
    externalFeePayment: await countWhere('externalFeePayment', () =>
      prisma.externalFeePayment.count({ where: { tenantId } }),
    ),
    studentFeeLedgerEntry: await countWhere('studentFeeLedgerEntry', () =>
      prisma.studentFeeLedgerEntry.count({ where: { tenantId } }),
    ),
    feeConcession: await countWhere('feeConcession', () =>
      prisma.feeConcession.count({ where: { tenantId } }),
    ),
    paymentTransaction: await countWhere('paymentTransaction', () =>
      prisma.paymentTransaction.count({ where: { tenantId } }),
    ),
    studentFeeDemandLine: await countWhere('studentFeeDemandLine', () =>
      prisma.studentFeeDemandLine.count({ where: { tenantId } }),
    ),
    studentFeeDemand: await countWhere('studentFeeDemand', () =>
      prisma.studentFeeDemand.count({ where: { tenantId } }),
    ),
    studentFeeSummary: await countWhere('studentFeeSummary', () =>
      prisma.studentFeeSummary.count({ where: { tenantId } }),
    ),
    feeAuditLog: await countWhere('feeAuditLog', () =>
      prisma.feeAuditLog.count({ where: { tenantId } }),
    ),
    publicFeePayAuditLog: await countWhere('publicFeePayAuditLog', () =>
      prisma.publicFeePayAuditLog.count({ where: { tenantId } }),
    ),
  };
  console.log('Counts before:', before);

  if (dryRun) {
    console.log(
      '[DRY RUN] Would: unlink exam demand FKs, hard-delete rows above, disable studentPortalFeesEnabled / onlinePayment / academic due blocks, clear FEE accounting vouchers + fee notifications.',
    );
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.examApplication.updateMany({
        where: { tenantId, demandId: { not: null } },
        data: { demandId: null },
      });

      await tx.feeSettlementLine.deleteMany({ where: { tenantId } });
      await tx.paymentAllocation.deleteMany({ where: { tenantId } });
      await tx.paymentGatewayLog.deleteMany({ where: { tenantId } });
      await tx.paymentWebhookLog.deleteMany({ where: { tenantId } });
      await tx.feeReceipt.deleteMany({ where: { tenantId } });
      await tx.feePaymentRequest.deleteMany({ where: { tenantId } });
      await tx.externalFeePayment.deleteMany({ where: { tenantId } });
      await tx.studentFeeLedgerEntry.deleteMany({ where: { tenantId } });
      await tx.feeConcession.deleteMany({ where: { tenantId } });
      await tx.paymentTransaction.deleteMany({ where: { tenantId } });
      await tx.studentFeeDemandLine.deleteMany({ where: { tenantId } });
      await tx.studentFeeDemand.deleteMany({ where: { tenantId } });
      await tx.studentFeeSummary.deleteMany({ where: { tenantId } });
      await tx.feeAuditLog.deleteMany({ where: { tenantId } });
      await tx.publicFeePayAuditLog.deleteMany({ where: { tenantId } });

      const logs = await tx.accountingIntegrationLog.findMany({
        where: {
          tenantId,
          sourceModule: 'FEES',
          sourceType: 'FEE_LEDGER_ENTRY',
        },
        select: { id: true, voucherId: true },
      });
      const voucherIds = [
        ...new Set(logs.map((l) => l.voucherId).filter(Boolean) as string[]),
      ];
      await tx.accountingIntegrationLog.deleteMany({
        where: {
          tenantId,
          sourceModule: 'FEES',
          sourceType: 'FEE_LEDGER_ENTRY',
        },
      });
      if (voucherIds.length) {
        await tx.accountingVoucherLine.deleteMany({
          where: { voucherId: { in: voucherIds } },
        });
        await tx.accountingVoucher.deleteMany({
          where: { id: { in: voucherIds }, tenantId },
        });
      }

      await tx.feeFinanceSettings.upsert({
        where: { tenantId },
        create: {
          tenantId,
          studentPortalFeesEnabled: false,
          blockHallTicketOnDue: false,
          blockRegistrationOnDue: false,
          onlinePaymentEnabled: false,
        },
        update: {
          studentPortalFeesEnabled: false,
          blockHallTicketOnDue: false,
          blockRegistrationOnDue: false,
          onlinePaymentEnabled: false,
        },
      });

      await tx.userNotification.deleteMany({
        where: {
          tenantId,
          OR: [
            { type: { contains: 'FEE', mode: 'insensitive' } },
            { title: { contains: 'fee', mode: 'insensitive' } },
            { body: { contains: 'fee demand', mode: 'insensitive' } },
            { body: { contains: 'pending fee', mode: 'insensitive' } },
            { link: { contains: 'fee', mode: 'insensitive' } },
          ],
        },
      });
    },
    { timeout: 300_000 },
  );

  const after = {
    studentFeeDemand: await prisma.studentFeeDemand.count({
      where: { tenantId },
    }),
    paymentTransaction: await prisma.paymentTransaction.count({
      where: { tenantId },
    }),
    feeReceipt: await prisma.feeReceipt.count({ where: { tenantId } }),
    studentFeeSummary: await prisma.studentFeeSummary.count({
      where: { tenantId },
    }),
  };
  console.log('Counts after (key tables):', after);

  const settings = await prisma.feeFinanceSettings.findUnique({
    where: { tenantId },
  });
  console.log('studentPortalFeesEnabled =', settings?.studentPortalFeesEnabled);
  console.log(
    'Done. Students will see Due ₹0 and a locked Fee Module until you re-enable Student Fee Module in Fee Settings.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
