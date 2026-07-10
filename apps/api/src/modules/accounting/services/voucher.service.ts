import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateVoucherDto,
  UpdateVoucherDto,
  VoucherListQueryDto,
} from '../dto/accounting.dto';
import { formatVoucherNo } from '../utils/financial-year.util';
import { AccountingAuditService } from './accounting-audit.service';
import { FinancialYearService } from './financial-year.service';
import { PostingService } from './posting.service';

@Injectable()
export class VoucherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialYear: FinancialYearService,
    private readonly posting: PostingService,
    private readonly audit: AccountingAuditService,
  ) {}

  async listTypes(tenantId: string) {
    return this.prisma.accountingVoucherType.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async list(tenantId: string, query: VoucherListQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.voucherTypeId ? { voucherTypeId: query.voucherTypeId } : {}),
      ...(query.financialYearId
        ? { financialYearId: query.financialYearId }
        : {}),
      ...(query.fromDate || query.toDate
        ? {
            voucherDate: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                voucherNo: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                narration: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                referenceNo: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.accountingVoucher.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ voucherDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          voucherType: true,
          financialYear: true,
          lines: { include: { ledgerAccount: true } },
        },
      }),
      this.prisma.accountingVoucher.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async get(tenantId: string, id: string) {
    const voucher = await this.prisma.accountingVoucher.findFirst({
      where: { tenantId, id },
      include: {
        voucherType: true,
        financialYear: true,
        lines: {
          include: { ledgerAccount: { include: { group: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    return voucher;
  }

  async create(tenantId: string, dto: CreateVoucherDto, createdById?: string) {
    const activeFy = await this.financialYear.getActive(tenantId);
    const voucherType = await this.prisma.accountingVoucherType.findFirst({
      where: { tenantId, id: dto.voucherTypeId, isActive: true },
    });
    if (!voucherType) {
      throw new BadRequestException('Invalid voucher type');
    }

    const { debitTotal } = this.posting.validateBalancedLines(dto.lines);

    const voucherDate = new Date(dto.voucherDate);
    if (voucherDate < activeFy.startDate || voucherDate > activeFy.endDate) {
      throw new BadRequestException(
        'Voucher date must fall within the active financial year',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const sequence = await tx.accountingVoucherSequence.upsert({
        where: {
          tenantId_voucherTypeId_financialYearId: {
            tenantId,
            voucherTypeId: voucherType.id,
            financialYearId: activeFy.id,
          },
        },
        create: {
          tenantId,
          voucherTypeId: voucherType.id,
          financialYearId: activeFy.id,
          currentNo: 1,
        },
        update: { currentNo: { increment: 1 } },
      });

      const voucherNo = formatVoucherNo(
        voucherType.prefix,
        activeFy.label,
        sequence.currentNo,
      );

      const voucher = await tx.accountingVoucher.create({
        data: {
          tenantId,
          financialYearId: activeFy.id,
          voucherTypeId: voucherType.id,
          voucherNo,
          voucherDate,
          status: 'DRAFT',
          narration: dto.narration,
          referenceNo: dto.referenceNo,
          chequeNo: dto.chequeNo,
          paymentMode: dto.paymentMode,
          totalAmount: debitTotal,
          createdById,
          lines: {
            create: dto.lines.map((line, index) => ({
              tenantId,
              ledgerAccountId: line.ledgerAccountId,
              entryType: line.entryType,
              amount: line.amount,
              narration: line.narration,
              sortOrder: index,
            })),
          },
        },
        include: {
          voucherType: true,
          financialYear: true,
          lines: { include: { ledgerAccount: true } },
        },
      });

      return voucher;
    });
  }

  async update(tenantId: string, id: string, dto: UpdateVoucherDto) {
    const voucher = await this.get(tenantId, id);
    if (voucher.status !== 'DRAFT') {
      throw new BadRequestException('Only draft vouchers can be edited');
    }

    if (dto.lines) {
      this.posting.validateBalancedLines(dto.lines);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.accountingVoucherLine.deleteMany({
          where: { voucherId: id },
        });
      }

      const debitTotal = dto.lines
        ? this.posting.validateBalancedLines(dto.lines).debitTotal
        : undefined;

      return tx.accountingVoucher.update({
        where: { id },
        data: {
          ...(dto.voucherDate
            ? { voucherDate: new Date(dto.voucherDate) }
            : {}),
          narration: dto.narration,
          referenceNo: dto.referenceNo,
          chequeNo: dto.chequeNo,
          paymentMode: dto.paymentMode,
          ...(debitTotal !== undefined ? { totalAmount: debitTotal } : {}),
          ...(dto.lines
            ? {
                lines: {
                  create: dto.lines.map((line, index) => ({
                    tenantId,
                    ledgerAccountId: line.ledgerAccountId,
                    entryType: line.entryType,
                    amount: line.amount,
                    narration: line.narration,
                    sortOrder: index,
                  })),
                },
              }
            : {}),
        },
        include: {
          voucherType: true,
          financialYear: true,
          lines: { include: { ledgerAccount: true } },
        },
      });
    });
  }

  async post(tenantId: string, id: string, postedById?: string, ip?: string) {
    const before = await this.get(tenantId, id);
    const posted = await this.posting.postVoucher({
      tenantId,
      voucherId: id,
      postedById,
    });

    await this.audit.log({
      tenantId,
      entityType: 'VOUCHER',
      entityId: id,
      action: 'POSTED',
      actorId: postedById,
      ipAddress: ip,
      before: { status: before.status },
      after: { status: posted.status, voucherNo: posted.voucherNo },
    });

    return posted;
  }
}
