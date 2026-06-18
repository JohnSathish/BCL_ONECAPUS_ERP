import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PrincipalInstitutionalHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      studentsTotal,
      studentsActive,
      studentsDropout,
      studentsTransfer,
      staffTeaching,
      staffNonTeaching,
      feeSummaries,
      libraryLoans,
      libraryOverdue,
      libraryFines,
    ] = await Promise.all([
      this.prisma.student.count({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.student.count({
        where: {
          tenantId,
          deletedAt: null,
          academicStanding: { lifecycleState: 'ACTIVE' },
        },
      }),
      this.prisma.student.count({
        where: {
          tenantId,
          deletedAt: null,
          academicStanding: { lifecycleState: 'DROPPED_OUT' },
        },
      }),
      this.prisma.student.count({
        where: {
          tenantId,
          deletedAt: null,
          academicStanding: { lifecycleState: 'TRANSFERRED' },
        },
      }),
      this.prisma.staffProfile.count({
        where: { tenantId, deletedAt: null, staffType: 'TEACHING' },
      }),
      this.prisma.staffProfile.count({
        where: { tenantId, deletedAt: null, staffType: { not: 'TEACHING' } },
      }),
      (this.prisma as any).studentFeeSummary.aggregate({
        where: { tenantId },
        _sum: { totalPaid: true, totalOutstanding: true },
      }),
      this.prisma.libraryLoan.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      this.prisma.libraryLoan.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          dueAt: { lt: today },
        },
      }),
      this.prisma.libraryFine.aggregate({
        where: { tenantId, paidAt: { not: null } },
        _sum: { amount: true },
      }),
    ]);

    const collection = Number(feeSummaries._sum?.totalPaid ?? 0);
    const outstanding = Number(feeSummaries._sum?.totalOutstanding ?? 0);

    return {
      students: {
        total: studentsTotal,
        active: studentsActive,
        dropouts: studentsDropout,
        transfers: studentsTransfer,
      },
      staff: {
        teaching: staffTeaching,
        nonTeaching: staffNonTeaching,
        vacancies: 0,
      },
      finance: {
        collection,
        outstanding,
        scholarships: 0,
        concessions: 0,
      },
      library: {
        booksIssued: libraryLoans,
        overdueBooks: libraryOverdue,
        fineCollection: Number(libraryFines._sum?.amount ?? 0),
      },
      updatedAt: new Date().toISOString(),
    };
  }
}
