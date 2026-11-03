import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type {
  BookCondition,
  CirculationType,
  Returner,
} from '../domain/library-circulation-ledger.logic';

type Db = Prisma.TransactionClient;

export type LedgerLoan = {
  id: string;
  tenantId: string;
  copyId: string;
  memberType: string;
  studentId: string | null;
  staffProfileId: string | null;
  issuedAt: Date;
};

export type LedgerEntry = {
  loan: LedgerLoan;
  type: CirculationType;
  occurredAt: Date;
  processedById?: string | null;
  previousDueAt?: Date | null;
  dueAt?: Date | null;
  renewalNumber?: number;
  returnedAt?: Date | null;
  returner?:
    | (Returner & { studentId?: string | null; staffId?: string | null })
    | null;
  bookCondition?: BookCondition | null;
  isLate?: boolean;
  daysLate?: number | null;
  fineAmount?: number | null;
  fineId?: string | null;
  remarks?: string | null;
  source?: 'DESK' | 'OPAC' | 'INCIDENT';
};

export type BorrowerSnapshot = {
  name: string | null;
  code: string | null;
  departmentId: string | null;
  departmentName: string | null;
  semesterNo: number | null;
};

/**
 * Writes the append-only circulation history. Always called with the same
 * transaction client that changes the loan, so the loan and its history row
 * are saved together or not at all.
 */
@Injectable()
export class LibraryCirculationLedgerService {
  async borrower(
    db: Db,
    loan: Pick<LedgerLoan, 'studentId' | 'staffProfileId'>,
  ): Promise<BorrowerSnapshot> {
    if (loan.studentId) {
      const student = await db.student.findUnique({
        where: { id: loan.studentId },
        select: {
          rollNumber: true,
          enrollmentNumber: true,
          departmentId: true,
          department: { select: { name: true } },
          masterProfile: { select: { fullName: true } },
          academicStanding: { select: { currentSemesterSequence: true } },
        },
      });
      return {
        name: student?.masterProfile?.fullName ?? null,
        code: student?.rollNumber?.trim() || student?.enrollmentNumber || null,
        departmentId: student?.departmentId ?? null,
        departmentName: student?.department?.name ?? null,
        semesterNo: student?.academicStanding?.currentSemesterSequence ?? null,
      };
    }
    if (loan.staffProfileId) {
      const staff = await db.staffProfile.findUnique({
        where: { id: loan.staffProfileId },
        select: {
          fullName: true,
          employeeCode: true,
          departmentId: true,
          department: { select: { name: true } },
        },
      });
      return {
        name: staff?.fullName ?? null,
        code: staff?.employeeCode ?? null,
        departmentId: staff?.departmentId ?? null,
        departmentName: staff?.department?.name ?? null,
        semesterNo: null,
      };
    }
    return {
      name: null,
      code: null,
      departmentId: null,
      departmentName: null,
      semesterNo: null,
    };
  }

  async record(db: Db, entry: LedgerEntry, snapshot?: BorrowerSnapshot) {
    const borrower = snapshot ?? (await this.borrower(db, entry.loan));
    const processor = entry.processedById
      ? await db.user.findUnique({
          where: { id: entry.processedById },
          select: { displayName: true, email: true },
        })
      : null;
    return db.libraryCirculationTransaction.create({
      data: {
        id: randomUUID(),
        tenantId: entry.loan.tenantId,
        loanId: entry.loan.id,
        copyId: entry.loan.copyId,
        transactionType: entry.type,
        occurredAt: entry.occurredAt,
        memberType: entry.loan.memberType,
        studentId: entry.loan.studentId,
        staffProfileId: entry.loan.staffProfileId,
        borrowerName: borrower.name,
        borrowerCode: borrower.code,
        departmentId: borrower.departmentId,
        departmentName: borrower.departmentName,
        semesterNo: borrower.semesterNo,
        issuedAt: entry.loan.issuedAt,
        previousDueAt: entry.previousDueAt ?? null,
        dueAt: entry.dueAt ?? null,
        renewalNumber: entry.renewalNumber ?? 0,
        returnedAt: entry.returnedAt ?? null,
        returnedByType: entry.returner?.type ?? null,
        returnedByName: entry.returner?.name ?? null,
        returnedByCode: entry.returner?.code ?? null,
        returnedByStudentId: entry.returner?.studentId ?? null,
        returnedByStaffId: entry.returner?.staffId ?? null,
        processedById: entry.processedById ?? null,
        processedByName: processor
          ? processor.displayName?.trim() || processor.email
          : null,
        bookCondition: entry.bookCondition ?? null,
        isLate: entry.isLate ?? false,
        daysLate: entry.daysLate ?? null,
        fineAmount: entry.fineAmount ?? null,
        fineId: entry.fineId ?? null,
        remarks: entry.remarks?.trim() || null,
        source: entry.source ?? 'DESK',
      },
    });
  }
}
