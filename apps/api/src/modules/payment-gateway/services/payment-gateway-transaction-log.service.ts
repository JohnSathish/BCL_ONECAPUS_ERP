import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PaymentGatewayTransactionLogService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async list(
    tenantId: string,
    query: {
      status?: string;
      gateway?: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: Record<string, unknown> = {
      tenantId,
      paymentMode: 'ONLINE',
    };
    if (query.status) where.status = query.status;
    if (query.gateway) where.provider = query.gateway.toUpperCase();
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.db().paymentTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
        include: {
          allocations: {
            include: {
              demand: {
                select: {
                  id: true,
                  demandNo: true,
                  feeType: true,
                  academicYear: true,
                },
              },
            },
          },
        },
      }),
      this.db().paymentTransaction.count({ where }),
    ]);

    const studentIds = [
      ...new Set(items.map((p: { studentId: string }) => p.studentId)),
    ];
    const students =
      studentIds.length > 0
        ? await this.db().studentProfile.findMany({
            where: { tenantId, id: { in: studentIds } },
            select: {
              id: true,
              rollNumber: true,
              user: { select: { fullName: true } },
            },
          })
        : [];
    const studentMap = new Map(students.map((s: { id: string }) => [s.id, s]));

    const receipts = await this.db().feeReceipt.findMany({
      where: {
        tenantId,
        paymentId: { in: items.map((p: { id: string }) => p.id) },
      },
      select: { id: true, receiptNo: true, paymentId: true },
    });
    const receiptMap = new Map(
      receipts.map((r: { paymentId: string }) => [r.paymentId, r]),
    );

    return {
      total,
      items: items.map((tx: Record<string, unknown>) => {
        const student = studentMap.get(tx.studentId as string) as
          | {
              rollNumber?: string;
              user?: { fullName?: string };
            }
          | undefined;
        const receipt = receiptMap.get(tx.id as string) as
          | { receiptNo?: string }
          | undefined;
        const demand = (
          tx.allocations as Array<{ demand?: { feeType?: string } }>
        )?.[0]?.demand;
        return {
          id: tx.id,
          transactionId: tx.transactionNo,
          gateway: tx.provider,
          studentId: tx.studentId,
          studentName: student?.user?.fullName ?? null,
          rollNumber: student?.rollNumber ?? null,
          feeType: demand?.feeType ?? null,
          amount: Number(tx.amount),
          status: tx.status,
          gatewayReference: tx.providerPaymentId ?? tx.providerOrderId,
          erpReceiptNumber: receipt?.receiptNo ?? null,
          paymentDate: tx.paidAt ?? tx.createdAt,
          responseCode: tx.status,
          responseMessage:
            (tx.metadata as { message?: string })?.message ?? tx.status,
        };
      }),
    };
  }
}
