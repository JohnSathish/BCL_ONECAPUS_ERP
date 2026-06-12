import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { NepCategory } from '../domain/nep-categories';
import { DEFAULT_SEMESTER_CREDIT_TARGET } from '../domain/fyugp-templates';
import { resolveSemesterCreditTarget } from './structure-rules.helper';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CreditLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async postConfirmedLine(
    tx: Tx,
    params: {
      tenantId: string;
      studentId: string;
      lineId: string;
      category: NepCategory;
      semesterSequence: number;
      courseCode: string;
      credits: Prisma.Decimal | number;
      descriptionPrefix?: string;
    },
  ) {
    const prefix = params.descriptionPrefix
      ? `${params.descriptionPrefix} — `
      : '';
    await tx.creditLedgerEntry.create({
      data: {
        tenantId: params.tenantId,
        studentId: params.studentId,
        credits: params.credits,
        entryType: 'registration',
        referenceType: 'semester_registration_line',
        referenceId: params.lineId,
        description: `${prefix}${params.courseCode} — Sem ${params.semesterSequence}`,
        metadata: {
          category: params.category,
          semesterSequence: params.semesterSequence,
        },
      },
    });

    const earned = await tx.semesterRegistrationLine.findMany({
      where: {
        registration: {
          studentId: params.studentId,
          semesterSequence: params.semesterSequence,
        },
        status: 'confirmed',
      },
      include: { offering: { include: { course: true } } },
    });
    const creditsSum = earned.reduce(
      (s, l) => s + Number(l.offering.course.credits),
      0,
    );

    const student = await tx.student.findFirst({
      where: { id: params.studentId },
      select: { programVersionId: true },
    });
    const creditsRequired = student?.programVersionId
      ? await resolveSemesterCreditTarget(
          tx,
          params.tenantId,
          student.programVersionId,
          params.semesterSequence,
        )
      : DEFAULT_SEMESTER_CREDIT_TARGET;

    await tx.studentSemesterProgress.upsert({
      where: {
        studentId_semesterSequence: {
          studentId: params.studentId,
          semesterSequence: params.semesterSequence,
        },
      },
      create: {
        tenantId: params.tenantId,
        studentId: params.studentId,
        semesterSequence: params.semesterSequence,
        creditsEarned: creditsSum,
        creditsRequired,
        status: 'in_progress',
      },
      update: { creditsEarned: creditsSum },
    });
  }

  async getCategoryBalances(tenantId: string, studentId: string) {
    const entries = await this.prisma.creditLedgerEntry.findMany({
      where: { tenantId, studentId, entryType: 'registration' },
      orderBy: { createdAt: 'asc' },
    });

    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const e of entries) {
      const meta = e.metadata as { category?: string } | null;
      const cat = meta?.category ?? 'OTHER';
      const val = Number(e.credits);
      byCategory[cat] = (byCategory[cat] ?? 0) + val;
      total += val;
    }

    return { total, byCategory, entries: entries.length };
  }

  async getDraftCreditSummary(
    tenantId: string,
    studentId: string,
    registrationId: string,
  ) {
    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: { registrationId, tenantId },
      include: { offering: { include: { course: true } } },
    });
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const l of lines) {
      const val = Number(l.offering.course.credits);
      byCategory[l.category] = (byCategory[l.category] ?? 0) + val;
      total += val;
    }
    const confirmed = await this.getCategoryBalances(tenantId, studentId);
    return { draftTotal: total, draftByCategory: byCategory, confirmed };
  }
}
