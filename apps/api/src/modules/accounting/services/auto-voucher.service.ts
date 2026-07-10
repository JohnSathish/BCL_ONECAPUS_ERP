import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { formatVoucherNo } from '../utils/financial-year.util';
import { FinancialYearService } from './financial-year.service';
import { PostingService } from './posting.service';

type AutoVoucherLine = {
  ledgerAccountId: string;
  entryType: 'DEBIT' | 'CREDIT';
  amount: number;
  narration?: string;
};

@Injectable()
export class AutoVoucherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialYear: FinancialYearService,
    private readonly posting: PostingService,
  ) {}

  async postBalanced(input: {
    tenantId: string;
    voucherTypeCode: string;
    voucherDate: Date;
    narration: string;
    referenceNo?: string;
    paymentMode?: string;
    lines: AutoVoucherLine[];
    postedById?: string;
    metadata?: Record<string, unknown>;
  }) {
    const activeFy = await this.financialYear.getActive(input.tenantId);
    const voucherType = await this.prisma.accountingVoucherType.findFirst({
      where: {
        tenantId: input.tenantId,
        code: input.voucherTypeCode,
        isActive: true,
      },
    });
    if (!voucherType) {
      throw new BadRequestException(
        `${input.voucherTypeCode} voucher type is not configured`,
      );
    }

    this.posting.validateBalancedLines(input.lines);

    return this.prisma.$transaction(async (tx) => {
      const sequence = await tx.accountingVoucherSequence.upsert({
        where: {
          tenantId_voucherTypeId_financialYearId: {
            tenantId: input.tenantId,
            voucherTypeId: voucherType.id,
            financialYearId: activeFy.id,
          },
        },
        create: {
          tenantId: input.tenantId,
          voucherTypeId: voucherType.id,
          financialYearId: activeFy.id,
          currentNo: 1,
        },
        update: { currentNo: { increment: 1 } },
      });

      const debitTotal = input.lines
        .filter((line) => line.entryType === 'DEBIT')
        .reduce((sum, line) => sum + line.amount, 0);

      const voucherNo = formatVoucherNo(
        voucherType.prefix,
        activeFy.label,
        sequence.currentNo,
      );

      const voucher = await tx.accountingVoucher.create({
        data: {
          tenantId: input.tenantId,
          financialYearId: activeFy.id,
          voucherTypeId: voucherType.id,
          voucherNo,
          voucherDate: input.voucherDate,
          status: 'DRAFT',
          narration: input.narration,
          referenceNo: input.referenceNo,
          paymentMode: input.paymentMode,
          totalAmount: debitTotal,
          createdById: input.postedById,
          metadata: input.metadata as object | undefined,
          lines: {
            create: input.lines.map((line, index) => ({
              tenantId: input.tenantId,
              ledgerAccountId: line.ledgerAccountId,
              entryType: line.entryType,
              amount: line.amount,
              narration: line.narration,
              sortOrder: index,
            })),
          },
        },
        include: {
          lines: { include: { ledgerAccount: { include: { group: true } } } },
        },
      });

      for (const line of voucher.lines) {
        await tx.accountingLedgerPosting.create({
          data: {
            tenantId: input.tenantId,
            financialYearId: activeFy.id,
            voucherId: voucher.id,
            voucherLineId: line.id,
            ledgerAccountId: line.ledgerAccountId,
            voucherDate: input.voucherDate,
            entryType: line.entryType,
            amount: line.amount,
            narration: line.narration ?? input.narration,
          },
        });

        const delta = this.posting.balanceDelta(
          line.ledgerAccount.group.nature,
          line.entryType,
          Number(line.amount),
        );
        await tx.accountingLedgerAccount.update({
          where: { id: line.ledgerAccountId },
          data: { currentBalance: { increment: delta } },
        });
      }

      return tx.accountingVoucher.update({
        where: { id: voucher.id },
        data: {
          status: 'POSTED',
          postedById: input.postedById,
          postedAt: new Date(),
        },
      });
    });
  }
}
