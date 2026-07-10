import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

type LineInput = {
  ledgerAccountId: string;
  entryType: string;
  amount: number | Prisma.Decimal;
  narration?: string;
};

@Injectable()
export class PostingService {
  constructor(private readonly prisma: PrismaService) {}

  validateBalancedLines(lines: LineInput[]) {
    if (lines.length < 2) {
      throw new BadRequestException(
        'A voucher must have at least two ledger lines',
      );
    }

    let debitTotal = 0;
    let creditTotal = 0;

    for (const line of lines) {
      const amount = Number(line.amount);
      if (amount <= 0) {
        throw new BadRequestException('Line amounts must be greater than zero');
      }
      if (line.entryType === 'DEBIT') debitTotal += amount;
      else if (line.entryType === 'CREDIT') creditTotal += amount;
      else {
        throw new BadRequestException(
          'Line entry type must be DEBIT or CREDIT',
        );
      }
    }

    if (Math.abs(debitTotal - creditTotal) > 0.005) {
      throw new BadRequestException(
        `Voucher is not balanced: debit ${debitTotal.toFixed(2)} ≠ credit ${creditTotal.toFixed(2)}`,
      );
    }

    return { debitTotal, creditTotal };
  }

  balanceDelta(nature: string, entryType: string, amount: number): number {
    const increasesWithDebit = nature === 'ASSET' || nature === 'EXPENSE';
    if (entryType === 'DEBIT') {
      return increasesWithDebit ? amount : -amount;
    }
    return increasesWithDebit ? -amount : amount;
  }

  async postVoucher(input: {
    tenantId: string;
    voucherId: string;
    postedById?: string;
  }) {
    const voucher = await this.prisma.accountingVoucher.findFirst({
      where: { tenantId: input.tenantId, id: input.voucherId },
      include: {
        lines: {
          include: {
            ledgerAccount: { include: { group: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        financialYear: true,
      },
    });

    if (!voucher) throw new BadRequestException('Voucher not found');
    if (voucher.status !== 'DRAFT') {
      throw new BadRequestException('Only draft vouchers can be posted');
    }
    if (voucher.financialYear.status === 'CLOSED') {
      throw new BadRequestException('Financial year is closed');
    }

    this.validateBalancedLines(
      voucher.lines.map((line) => ({
        ledgerAccountId: line.ledgerAccountId,
        entryType: line.entryType,
        amount: line.amount,
        narration: line.narration ?? undefined,
      })),
    );

    return this.prisma.$transaction(async (tx) => {
      for (const line of voucher.lines) {
        await tx.accountingLedgerPosting.create({
          data: {
            tenantId: input.tenantId,
            financialYearId: voucher.financialYearId,
            voucherId: voucher.id,
            voucherLineId: line.id,
            ledgerAccountId: line.ledgerAccountId,
            voucherDate: voucher.voucherDate,
            entryType: line.entryType,
            amount: line.amount,
            narration: line.narration ?? voucher.narration,
          },
        });

        const delta = this.balanceDelta(
          line.ledgerAccount.group.nature,
          line.entryType,
          Number(line.amount),
        );

        await tx.accountingLedgerAccount.update({
          where: { id: line.ledgerAccountId },
          data: {
            currentBalance: { increment: delta },
          },
        });
      }

      return tx.accountingVoucher.update({
        where: { id: voucher.id },
        data: {
          status: 'POSTED',
          postedById: input.postedById,
          postedAt: new Date(),
        },
        include: {
          lines: { include: { ledgerAccount: true } },
          voucherType: true,
          financialYear: true,
        },
      });
    });
  }
}
