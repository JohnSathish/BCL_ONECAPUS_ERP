import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateAbcAccountDto,
  CreateAbcTransactionDto,
  CreateCreditLedgerEntryDto,
} from './dto/nep-abc.dto';

@Injectable()
export class NepAbcService {
  constructor(private readonly prisma: PrismaService) {}

  getStudentLedger(tenantId: string, studentId: string) {
    return this.prisma.creditLedgerEntry.findMany({
      where: { tenantId, studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStudentCreditBalance(tenantId: string, studentId: string) {
    const entries = await this.prisma.creditLedgerEntry.findMany({
      where: { tenantId, studentId },
    });
    const balance = entries.reduce((sum, e) => sum + Number(e.credits), 0);
    return { studentId, balance, entries: entries.length };
  }

  createLedgerEntry(tenantId: string, dto: CreateCreditLedgerEntryDto) {
    return this.prisma.creditLedgerEntry.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        credits: dto.credits,
        entryType: dto.entryType,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        description: dto.description,
      },
    });
  }

  getAbcAccount(tenantId: string, studentId: string) {
    return this.prisma.abcAccount.findFirst({
      where: { tenantId, studentId, deletedAt: null },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
  }

  createAbcAccount(tenantId: string, dto: CreateAbcAccountDto) {
    return this.prisma.abcAccount.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        abcId: dto.abcId,
        status: dto.abcId ? 'linked' : 'pending',
      },
    });
  }

  createAbcTransaction(tenantId: string, dto: CreateAbcTransactionDto) {
    return this.prisma.abcTransaction.create({
      data: {
        tenantId,
        abcAccountId: dto.abcAccountId,
        direction: dto.direction,
        credits: dto.credits,
        externalRef: dto.externalRef,
        payload: { source: 'internal', portabilityReady: true },
      },
    });
  }

  exportPortabilityPayload(tenantId: string, studentId: string) {
    return this.prisma.abcAccount.findFirst({
      where: { tenantId, studentId },
      include: {
        student: { include: { creditLedger: true } },
        transactions: true,
      },
    });
  }
}
