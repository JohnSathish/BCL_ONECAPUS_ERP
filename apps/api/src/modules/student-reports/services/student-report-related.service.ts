import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
export type ReportStudentRef = {
  studentId: string;
  rollNumber: string;
  fullName: string;
  admissionYearId: string | null;
};

export type RelatedSheet = {
  name: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
};

const SHEET_CAP = 20_000;
const LINK = [
  { key: 'rollNumber', label: 'Roll Number' },
  { key: 'fullName', label: 'Student Name' },
  { key: 'studentId', label: 'Student ID' },
];

@Injectable()
export class StudentReportRelatedService {
  private readonly logger = new Logger(StudentReportRelatedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async attach(
    tenantId: string,
    students: ReportStudentRef[],
    columns: string[] | null,
  ): Promise<{
    patches: Map<string, Record<string, unknown>>;
    sheets: RelatedSheet[];
  }> {
    const patches = new Map<string, Record<string, unknown>>();
    const sheets: RelatedSheet[] = [];
    if (!students.length || !columns?.length) return { patches, sheets };
    const wanted = new Set(columns);
    const needs = (key: string) => wanted.has(key);
    const ids = students.map((student) => student.studentId);
    const byId = new Map(
      students.map((student) => [student.studentId, student]),
    );
    for (const student of students) patches.set(student.studentId, {});

    const set = (studentId: string, values: Record<string, unknown>) => {
      const current = patches.get(studentId) ?? {};
      patches.set(studentId, { ...current, ...values });
    };

    if (needs('admissionYear')) {
      await this.safe(async () => {
        const yearIds = [
          ...new Set(
            students.map((student) => student.admissionYearId).filter(Boolean),
          ),
        ] as string[];
        if (!yearIds.length) return;
        const years = await this.prisma.academicYear.findMany({
          where: { id: { in: yearIds } },
          select: { id: true, name: true },
        });
        const names = new Map(years.map((year) => [year.id, year.name]));
        for (const student of students) {
          set(student.studentId, {
            admissionYear: student.admissionYearId
              ? (names.get(student.admissionYearId) ?? '')
              : '',
          });
        }
      });
    }

    if (needs('semesterRegistrationStatus')) {
      await this.safe(async () => {
        const rows = await this.prisma.semesterRegistration.findMany({
          where: { tenantId, studentId: { in: ids } },
          select: { studentId: true, semesterSequence: true, status: true },
          orderBy: { semesterSequence: 'desc' },
        });
        const seen = new Set<string>();
        for (const row of rows) {
          if (seen.has(row.studentId)) continue;
          seen.add(row.studentId);
          set(row.studentId, { semesterRegistrationStatus: row.status });
        }
      });
    }

    if (needs('profileVerificationStatus')) {
      await this.safe(async () => {
        const rows = await this.prisma.studentProfileChangeRequest.findMany({
          where: { tenantId, studentId: { in: ids } },
          select: { studentId: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
        const seen = new Set<string>();
        for (const row of rows) {
          if (seen.has(row.studentId)) continue;
          seen.add(row.studentId);
          set(row.studentId, { profileVerificationStatus: row.status });
        }
      });
    }

    if (needs('class12SubjectList')) {
      await this.safe(async () => {
        const marks = await this.prisma.studentBoardSubjectMark.findMany({
          where: { tenantId, boardExam: { studentId: { in: ids } } },
          select: {
            subjectName: true,
            marksObtained: true,
            maxMarks: true,
            grade: true,
            boardExam: { select: { studentId: true } },
          },
          take: SHEET_CAP,
        });
        const grouped = new Map<string, string[]>();
        const sheetRows: Record<string, unknown>[] = [];
        for (const mark of marks) {
          const student = byId.get(mark.boardExam.studentId);
          const label = `${mark.subjectName}${mark.marksObtained != null ? ` ${mark.marksObtained}` : ''}`;
          const list = grouped.get(mark.boardExam.studentId) ?? [];
          list.push(label);
          grouped.set(mark.boardExam.studentId, list);
          sheetRows.push({
            rollNumber: student?.rollNumber ?? '',
            fullName: student?.fullName ?? '',
            studentId: mark.boardExam.studentId,
            subjectName: mark.subjectName,
            marksObtained: mark.marksObtained ?? '',
            maxMarks: mark.maxMarks ?? '',
            grade: mark.grade ?? '',
          });
        }
        for (const [studentId, list] of grouped)
          set(studentId, { class12SubjectList: list.join(', ') });
        sheets.push({
          name: 'Class XII Marks',
          columns: [
            ...LINK,
            { key: 'subjectName', label: 'Subject Name' },
            { key: 'marksObtained', label: 'Marks Obtained' },
            { key: 'maxMarks', label: 'Maximum Marks' },
            { key: 'grade', label: 'Grade' },
          ],
          rows: sheetRows,
        });
      });
    }

    if (needs('registeredSubjects')) {
      await this.safe(async () => {
        const lines = await this.prisma.semesterRegistrationLine.findMany({
          where: { tenantId, registration: { studentId: { in: ids } } },
          select: {
            category: true,
            status: true,
            registration: {
              select: { studentId: true, semesterSequence: true, status: true },
            },
            offering: {
              select: {
                semesterSequence: true,
                titleOverride: true,
                course: { select: { code: true, title: true } },
              },
            },
          },
          take: SHEET_CAP,
        });
        const grouped = new Map<string, string[]>();
        const sheetRows: Record<string, unknown>[] = [];
        for (const line of lines) {
          const studentId = line.registration.studentId;
          const student = byId.get(studentId);
          const name =
            line.offering.titleOverride || line.offering.course.title;
          const code = line.offering.course.code;
          const list = grouped.get(studentId) ?? [];
          list.push(`${line.category}: ${name}`);
          grouped.set(studentId, list);
          sheetRows.push({
            rollNumber: student?.rollNumber ?? '',
            fullName: student?.fullName ?? '',
            studentId,
            subjectCode: code,
            subjectName: name,
            subjectType: line.category,
            semester: line.registration.semesterSequence,
            registrationStatus: line.registration.status,
            lineStatus: line.status,
          });
        }
        for (const [studentId, list] of grouped)
          set(studentId, { registeredSubjects: list.join('; ') });
        sheets.push({
          name: 'Subject Registration',
          columns: [
            ...LINK,
            { key: 'subjectCode', label: 'Subject Code' },
            { key: 'subjectName', label: 'Subject Name' },
            { key: 'subjectType', label: 'Subject Type' },
            { key: 'semester', label: 'Semester' },
            { key: 'registrationStatus', label: 'Registration Status' },
            { key: 'lineStatus', label: 'Line Status' },
          ],
          rows: sheetRows,
        });
      });
    }

    if (needs('documentSummary')) {
      await this.safe(async () => {
        const docs = await this.prisma.studentDocument.findMany({
          where: { tenantId, studentId: { in: ids } },
          select: {
            studentId: true,
            documentType: true,
            fileName: true,
            verificationStatus: true,
            createdAt: true,
          },
          take: SHEET_CAP,
        });
        const grouped = new Map<string, string[]>();
        const sheetRows: Record<string, unknown>[] = [];
        for (const doc of docs) {
          const student = byId.get(doc.studentId);
          const list = grouped.get(doc.studentId) ?? [];
          list.push(`${doc.documentType}: ${doc.verificationStatus}`);
          grouped.set(doc.studentId, list);
          sheetRows.push({
            rollNumber: student?.rollNumber ?? '',
            fullName: student?.fullName ?? '',
            studentId: doc.studentId,
            documentType: doc.documentType,
            fileName: doc.fileName,
            verificationStatus: doc.verificationStatus,
            uploadedAt: doc.createdAt.toISOString().slice(0, 10),
          });
        }
        for (const [studentId, list] of grouped)
          set(studentId, { documentSummary: list.join('; ') });
        sheets.push({
          name: 'Documents',
          columns: [
            ...LINK,
            { key: 'documentType', label: 'Document Type' },
            { key: 'fileName', label: 'File Name' },
            { key: 'verificationStatus', label: 'Verification Status' },
            { key: 'uploadedAt', label: 'Uploaded On' },
          ],
          rows: sheetRows,
        });
      });
    }

    if (
      needs('feePaidAmount') ||
      needs('lastPaymentDate') ||
      needs('lastPaymentMode') ||
      needs('lastPaymentReference') ||
      needs('feeTransactions')
    ) {
      await this.safe(async () => {
        const payments = await this.prisma.paymentTransaction.findMany({
          where: { tenantId, studentId: { in: ids }, status: 'SUCCESS' },
          select: {
            studentId: true,
            paidAt: true,
            paymentMode: true,
            amount: true,
            externalReference: true,
            transactionNo: true,
            status: true,
          },
          orderBy: { paidAt: 'desc' },
          take: SHEET_CAP,
        });
        const totals = new Map<string, number>();
        const latest = new Set<string>();
        const sheetRows: Record<string, unknown>[] = [];
        for (const payment of payments) {
          totals.set(
            payment.studentId,
            (totals.get(payment.studentId) ?? 0) + Number(payment.amount ?? 0),
          );
          if (!latest.has(payment.studentId)) {
            latest.add(payment.studentId);
            set(payment.studentId, {
              lastPaymentDate: payment.paidAt
                ? payment.paidAt.toISOString().slice(0, 10)
                : '',
              lastPaymentMode: payment.paymentMode,
              lastPaymentReference:
                payment.externalReference || payment.transactionNo,
            });
          }
          if (needs('feeTransactions')) {
            const student = byId.get(payment.studentId);
            sheetRows.push({
              rollNumber: student?.rollNumber ?? '',
              fullName: student?.fullName ?? '',
              studentId: payment.studentId,
              paidAt: payment.paidAt
                ? payment.paidAt.toISOString().slice(0, 10)
                : '',
              paymentMode: payment.paymentMode,
              amount: Number(payment.amount ?? 0),
              reference: payment.externalReference || payment.transactionNo,
              status: payment.status,
            });
          }
        }
        for (const [studentId, total] of totals) {
          set(studentId, { feePaidAmount: Math.round(total * 100) / 100 });
        }
        if (needs('feeTransactions')) {
          sheets.push({
            name: 'Fee Transactions',
            columns: [
              ...LINK,
              { key: 'paidAt', label: 'Payment Date' },
              { key: 'paymentMode', label: 'Payment Mode' },
              { key: 'amount', label: 'Amount' },
              { key: 'reference', label: 'Transaction Reference' },
              { key: 'status', label: 'Status' },
            ],
            rows: sheetRows,
          });
        }
      });
    }

    if (
      needs('attendanceWorkingDays') ||
      needs('attendancePresent') ||
      needs('attendanceAbsent') ||
      needs('attendanceDetail')
    ) {
      await this.safe(async () => {
        const rows = await this.prisma.studentAttendanceSummary.findMany({
          where: { tenantId, studentId: { in: ids } },
          select: {
            studentId: true,
            semesterNo: true,
            totalSessions: true,
            presentCount: true,
            absentCount: true,
            percentage: true,
          },
          take: SHEET_CAP,
        });
        const totals = new Map<
          string,
          { days: number; present: number; absent: number }
        >();
        const sheetRows: Record<string, unknown>[] = [];
        for (const row of rows) {
          const current = totals.get(row.studentId) ?? {
            days: 0,
            present: 0,
            absent: 0,
          };
          current.days += row.totalSessions;
          current.present += row.presentCount;
          current.absent += row.absentCount;
          totals.set(row.studentId, current);
          if (needs('attendanceDetail')) {
            const student = byId.get(row.studentId);
            sheetRows.push({
              rollNumber: student?.rollNumber ?? '',
              fullName: student?.fullName ?? '',
              studentId: row.studentId,
              semester: row.semesterNo ?? '',
              workingDays: row.totalSessions,
              present: row.presentCount,
              absent: row.absentCount,
              percentage: Number(row.percentage ?? 0),
            });
          }
        }
        for (const [studentId, total] of totals) {
          set(studentId, {
            attendanceWorkingDays: total.days,
            attendancePresent: total.present,
            attendanceAbsent: total.absent,
          });
        }
        if (needs('attendanceDetail')) {
          sheets.push({
            name: 'Attendance',
            columns: [
              ...LINK,
              { key: 'semester', label: 'Semester' },
              { key: 'workingDays', label: 'Working Days' },
              { key: 'present', label: 'Present' },
              { key: 'absent', label: 'Absent' },
              { key: 'percentage', label: 'Percentage' },
            ],
            rows: sheetRows,
          });
        }
      });
    }

    if (
      needs('examResultStatus') ||
      needs('examPercentage') ||
      needs('examSgpa') ||
      needs('examCgpa') ||
      needs('examSummary')
    ) {
      await this.safe(async () => {
        const results = await this.prisma.examResultSummary.findMany({
          where: { tenantId, studentId: { in: ids }, deletedAt: null },
          select: {
            studentId: true,
            sessionId: true,
            totalMarks: true,
            maxMarks: true,
            percentage: true,
            sgpa: true,
            cgpa: true,
            resultStatus: true,
          },
          orderBy: { calculatedAt: 'desc' },
          take: SHEET_CAP,
        });
        const sessionIds = [...new Set(results.map((row) => row.sessionId))];
        const sessions = sessionIds.length
          ? await this.prisma.examSession.findMany({
              where: { id: { in: sessionIds } },
              select: {
                id: true,
                name: true,
                examType: true,
                semesterNo: true,
              },
            })
          : [];
        const sessionName = new Map(
          sessions.map((session) => [session.id, session]),
        );
        const seen = new Set<string>();
        const sheetRows: Record<string, unknown>[] = [];
        for (const result of results) {
          const session = sessionName.get(result.sessionId);
          if (!seen.has(result.studentId)) {
            seen.add(result.studentId);
            set(result.studentId, {
              examResultStatus: result.resultStatus,
              examPercentage: Number(result.percentage ?? 0),
              examSgpa: result.sgpa != null ? Number(result.sgpa) : '',
              examCgpa: result.cgpa != null ? Number(result.cgpa) : '',
            });
          }
          if (needs('examSummary')) {
            const student = byId.get(result.studentId);
            sheetRows.push({
              rollNumber: student?.rollNumber ?? '',
              fullName: student?.fullName ?? '',
              studentId: result.studentId,
              examinationName: session?.name ?? '',
              examinationType: session?.examType ?? '',
              semester: session?.semesterNo ?? '',
              totalMarks: Number(result.totalMarks ?? 0),
              maxMarks: Number(result.maxMarks ?? 0),
              percentage: Number(result.percentage ?? 0),
              result: result.resultStatus,
            });
          }
        }
        if (needs('examSummary')) {
          sheets.push({
            name: 'Examination',
            columns: [
              ...LINK,
              { key: 'examinationName', label: 'Examination Name' },
              { key: 'examinationType', label: 'Examination Type' },
              { key: 'semester', label: 'Semester' },
              { key: 'totalMarks', label: 'Marks Obtained' },
              { key: 'maxMarks', label: 'Maximum Marks' },
              { key: 'percentage', label: 'Percentage' },
              { key: 'result', label: 'Result' },
            ],
            rows: sheetRows,
          });
        }
      });
    }

    if (needs('libraryMembershipStatus') || needs('libraryBlockReason')) {
      await this.safe(async () => {
        const rows = await this.prisma.libraryMembership.findMany({
          where: { tenantId, studentId: { in: ids } },
          select: { studentId: true, status: true, blockReason: true },
        });
        for (const row of rows) {
          if (!row.studentId) continue;
          set(row.studentId, {
            libraryMembershipStatus: row.status,
            libraryBlockReason: row.blockReason ?? '',
          });
        }
      });
    }

    return { patches, sheets };
  }

  private async safe(work: () => Promise<void>) {
    try {
      await work();
    } catch (error) {
      this.logger.warn(
        `Related report section skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
