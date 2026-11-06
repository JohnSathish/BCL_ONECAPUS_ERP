import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CLASS12_MARKS_ROW_KEY,
  class12SubjectDisplayName,
  class12SubjectMatchKey,
  type Class12MarksBySubject,
} from '../domain/class12-report-columns';
export type ReportStudentRef = {
  studentId: string;
  rollNumber: string;
  fullName: string;
  admissionYearId: string | null;
  currentSemester?: number | null;
};

export type RelatedSheet = {
  name: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
};

const SHEET_CAP = 20_000;
const ELECTIVE_KEYS = ['mdc', 'aec', 'sec', 'vac', 'vtc'] as const;
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
    options?: { semester?: number | null },
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
        const exams = await this.loadBoardExams(tenantId, ids);
        const latest = new Map<string, (typeof exams)[number]>();
        for (const exam of exams) {
          const current = latest.get(exam.studentId);
          if (!current || this.preferBoardExam(exam, current) > 0) {
            latest.set(exam.studentId, exam);
          }
        }
        const sheetRows: Record<string, unknown>[] = [];
        for (const [studentId, exam] of latest) {
          const student = byId.get(studentId);
          const marks = this.class12Marks(exam.subjectMarks);
          const preview = Object.values(marks)
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((entry) =>
              entry.marks == null
                ? entry.display
                : `${entry.display} ${entry.marks}`,
            );
          set(studentId, {
            class12SubjectList: preview.join(', '),
            [CLASS12_MARKS_ROW_KEY]: marks,
          });
          for (const mark of exam.subjectMarks) {
            sheetRows.push({
              rollNumber: student?.rollNumber ?? '',
              fullName: student?.fullName ?? '',
              studentId,
              subjectName: class12SubjectDisplayName(mark.subjectName),
              marksObtained: this.numericMark(mark.marksObtained) ?? '',
              maxMarks: this.numericMark(mark.maxMarks) ?? '',
              grade: mark.grade ?? '',
            });
          }
        }
        sheets.push({
          name: 'Class XII Marks',
          columns: [
            ...LINK,
            { key: 'subjectName', label: 'Subject Name' },
            { key: 'marksObtained', label: 'Marks Obtained' },
            { key: 'maxMarks', label: 'Maximum Marks' },
            { key: 'grade', label: 'Grade' },
          ],
          rows: sheetRows.slice(0, SHEET_CAP),
        });
      });
    }

    if (ELECTIVE_KEYS.some((key) => needs(key))) {
      await this.safe(async () => {
        const lines = await this.loadElectiveLines(tenantId, ids);
        const byStudent = new Map<string, typeof lines>();
        for (const line of lines) {
          const studentId = line.registration.studentId;
          const list = byStudent.get(studentId) ?? [];
          list.push(line);
          byStudent.set(studentId, list);
        }
        const filteredSemester =
          options?.semester && options.semester > 0 ? options.semester : null;
        for (const student of students) {
          const semester = filteredSemester ?? student.currentSemester ?? null;
          const buckets: Record<(typeof ELECTIVE_KEYS)[number], string[]> = {
            mdc: [],
            aec: [],
            sec: [],
            vac: [],
            vtc: [],
          };
          for (const line of byStudent.get(student.studentId) ?? []) {
            if (
              semester != null &&
              line.registration.semesterSequence !== semester
            ) {
              continue;
            }
            if (semester == null) continue;
            const key = line.category.trim().toUpperCase().toLowerCase();
            if (
              !ELECTIVE_KEYS.includes(key as (typeof ELECTIVE_KEYS)[number])
            ) {
              continue;
            }
            const title =
              line.offering.titleOverride?.trim() ||
              line.offering.course.title?.trim() ||
              '';
            if (!title) continue;
            const bucket = buckets[key as (typeof ELECTIVE_KEYS)[number]];
            if (!bucket.includes(title)) bucket.push(title);
          }
          set(student.studentId, {
            mdc: buckets.mdc.join('; '),
            aec: buckets.aec.join('; '),
            sec: buckets.sec.join('; '),
            vac: buckets.vac.join('; '),
            vtc: buckets.vtc.join('; '),
          });
        }
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

  private async loadElectiveLines(tenantId: string, studentIds: string[]) {
    const lines: Array<{
      category: string;
      registration: { studentId: string; semesterSequence: number };
      offering: {
        titleOverride: string | null;
        course: { title: string };
      };
    }> = [];
    for (let offset = 0; offset < studentIds.length; offset += 2000) {
      const slice = studentIds.slice(offset, offset + 2000);
      const rows = await this.prisma.semesterRegistrationLine.findMany({
        where: {
          tenantId,
          registration: { studentId: { in: slice }, archivedAt: null },
        },
        select: {
          category: true,
          registration: { select: { studentId: true, semesterSequence: true } },
          offering: {
            select: {
              titleOverride: true,
              course: { select: { title: true } },
            },
          },
        },
      });
      lines.push(...rows);
    }
    return lines;
  }

  private async loadBoardExams(tenantId: string, studentIds: string[]) {
    const exams: Array<{
      studentId: string;
      examYear: number | null;
      createdAt: Date;
      subjectMarks: Array<{
        subjectName: string;
        marksObtained: number | null;
        maxMarks: number | null;
        grade: string | null;
        sortOrder: number;
      }>;
    }> = [];
    for (let offset = 0; offset < studentIds.length; offset += 2000) {
      const slice = studentIds.slice(offset, offset + 2000);
      const rows = await this.prisma.studentBoardExam.findMany({
        where: { tenantId, studentId: { in: slice } },
        select: {
          studentId: true,
          examYear: true,
          createdAt: true,
          subjectMarks: {
            orderBy: { sortOrder: 'asc' },
            select: {
              subjectName: true,
              marksObtained: true,
              maxMarks: true,
              grade: true,
              sortOrder: true,
            },
          },
        },
      });
      exams.push(...rows);
    }
    return exams;
  }

  /** Prefer an exam that has subject marks, then the later examination year. */
  private preferBoardExam(
    candidate: {
      examYear: number | null;
      createdAt: Date;
      subjectMarks: unknown[];
    },
    current: {
      examYear: number | null;
      createdAt: Date;
      subjectMarks: unknown[];
    },
  ) {
    const candidateMarks = candidate.subjectMarks.length > 0 ? 1 : 0;
    const currentMarks = current.subjectMarks.length > 0 ? 1 : 0;
    if (candidateMarks !== currentMarks) return candidateMarks - currentMarks;
    const candidateYear = candidate.examYear ?? -1;
    const currentYear = current.examYear ?? -1;
    if (candidateYear !== currentYear) return candidateYear - currentYear;
    return candidate.createdAt.getTime() - current.createdAt.getTime();
  }

  private class12Marks(
    marks: Array<{
      subjectName: string;
      marksObtained: number | null;
      sortOrder: number;
    }>,
  ): Class12MarksBySubject {
    const bySubject: Class12MarksBySubject = {};
    for (const mark of marks) {
      const display = class12SubjectDisplayName(mark.subjectName);
      const key = class12SubjectMatchKey(display);
      if (!key) continue;
      const numeric = this.numericMark(mark.marksObtained);
      const existing = bySubject[key];
      if (!existing) {
        bySubject[key] = { display, marks: numeric, sortOrder: mark.sortOrder };
      } else if (existing.marks == null && numeric != null) {
        existing.marks = numeric;
      }
    }
    return bySubject;
  }

  private numericMark(value: unknown): number | null {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
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
