import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { StudentFeeSummaryService } from '../../fees/services/student-fee-summary.service';
import {
  student360Score,
  studentHealthSignals,
  type Student360Input,
} from '../utils/student-360.util';

export type DirectoryFeeSnapshot = {
  feeStatus: 'CLEAR' | 'DUE' | 'OVERDUE' | 'PARTIAL';
  feeDueAmount: number;
};

export type DirectoryAttendanceSnapshot = {
  attendancePercent: number | null;
  attendanceEligibility: 'ELIGIBLE' | 'CONDONATION' | 'DETAINED' | null;
  attendanceShortage: boolean;
};

export type DirectoryHostelSnapshot = {
  residenceType: 'HOSTELLER' | 'DAY_SCHOLAR' | null;
  hostelBlock: string | null;
  hostelRoom: string | null;
  isHosteller: boolean;
};

export type DirectoryOperationalSnapshot = DirectoryFeeSnapshot &
  DirectoryAttendanceSnapshot &
  DirectoryHostelSnapshot;

type ResidenceRow = {
  studentId: string;
  residenceType: string | null;
  hostelBlock: string | null;
  hostelRoom: string | null;
};

const ACTIVE_DEMAND_STATUSES = [
  'PUBLISHED',
  'LOCKED',
  'PARTIALLY_PAID',
] as const;
const ATTENDANCE_SHORTAGE_THRESHOLD = 75;

@Injectable()
export class StudentDirectoryEnrichmentService {
  private readonly logger = new Logger(StudentDirectoryEnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly feeSummary: StudentFeeSummaryService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  emptySnapshot(): DirectoryOperationalSnapshot {
    return {
      feeStatus: 'CLEAR',
      feeDueAmount: 0,
      attendancePercent: null,
      attendanceEligibility: null,
      attendanceShortage: false,
      residenceType: null,
      hostelBlock: null,
      hostelRoom: null,
      isHosteller: false,
    };
  }

  async loadForStudents(
    tenantId: string,
    studentIds: string[],
  ): Promise<Map<string, DirectoryOperationalSnapshot>> {
    const map = new Map<string, DirectoryOperationalSnapshot>();
    if (!studentIds.length) return map;

    for (const id of studentIds) {
      map.set(id, this.emptySnapshot());
    }

    const [feeMap, attendanceMap, residenceRows] = await Promise.all([
      this.safeLoad(
        () => this.loadFeeSnapshots(tenantId, studentIds),
        new Map(),
      ),
      this.safeLoad(
        () => this.loadAttendanceSnapshots(tenantId, studentIds),
        new Map(),
      ),
      this.safeLoad(
        () => this.loadResidenceRows(tenantId, studentIds),
        [] as ResidenceRow[],
      ),
    ]);

    for (const [studentId, fee] of feeMap) {
      const current = map.get(studentId)!;
      map.set(studentId, { ...current, ...fee });
    }

    for (const [studentId, attendance] of attendanceMap) {
      const current = map.get(studentId)!;
      map.set(studentId, { ...current, ...attendance });
    }

    for (const row of residenceRows) {
      const current = map.get(row.studentId);
      if (!current) continue;
      const residenceType =
        row.residenceType === 'HOSTELLER' || row.residenceType === 'DAY_SCHOLAR'
          ? row.residenceType
          : null;
      map.set(row.studentId, {
        ...current,
        residenceType,
        hostelBlock: row.hostelBlock ?? null,
        hostelRoom: row.hostelRoom ?? null,
        isHosteller: residenceType === 'HOSTELLER',
      });
    }

    return map;
  }

  async tenantOperationalCounts(tenantId: string) {
    const [feeDefaulters, hostelResidents, attendanceShortage] =
      await Promise.all([
        this.safeLoad(() => this.countFeeDefaulters(tenantId), 0),
        this.safeLoad(() => this.countHostellers(tenantId), 0),
        this.safeLoad(() => this.countAttendanceShortage(tenantId), 0),
      ]);

    return { feeDefaulters, hostelResidents, attendanceShortage };
  }

  async studentIdsMatchingFilters(
    tenantId: string,
    filters: {
      feeDue?: string;
      hostel?: string;
      attendanceShortage?: string;
      subjectPending?: string;
    },
  ): Promise<string[] | null> {
    const ids: string[][] = [];

    if (filters.feeDue === 'true') {
      ids.push(
        await this.safeLoad(() => this.listFeeDefaulterIds(tenantId), []),
      );
    }

    if (filters.hostel === 'true') {
      ids.push(await this.safeLoad(() => this.listHostellerIds(tenantId), []));
    }

    if (filters.attendanceShortage === 'true') {
      ids.push(
        await this.safeLoad(() => this.listAttendanceShortageIds(tenantId), []),
      );
    }

    if (filters.subjectPending === 'true') {
      ids.push(
        await this.safeLoad(() => this.listSubjectPendingIds(tenantId), []),
      );
    }

    if (!ids.length) return null;

    let result = new Set(ids[0]);
    for (let i = 1; i < ids.length; i += 1) {
      const next = new Set(ids[i]);
      result = new Set([...result].filter((id) => next.has(id)));
    }
    return [...result];
  }

  async getStudentHealth(
    tenantId: string,
    studentId: string,
    profileRow: Student360Input,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const snapshot =
      (await this.loadForStudents(tenantId, [studentId])).get(studentId) ??
      this.emptySnapshot();

    const input: Student360Input = {
      ...profileRow,
      ...snapshot,
    };

    return {
      ...snapshot,
      signals: studentHealthSignals(input),
      score: student360Score(input),
    };
  }

  async loadFeeSummary(tenantId: string, studentId: string) {
    const snapshot =
      (await this.loadForStudents(tenantId, [studentId])).get(studentId) ??
      this.emptySnapshot();

    const demands = await this.safeLoad(
      () =>
        this.db().studentFeeDemand.findMany({
          where: {
            tenantId,
            studentId,
            status: { in: [...ACTIVE_DEMAND_STATUSES] },
          },
          select: {
            id: true,
            demandNo: true,
            status: true,
            balanceAmount: true,
            totalAmount: true,
            paidAmount: true,
            dueDate: true,
            semesterNumber: true,
          },
          orderBy: { dueDate: 'asc' },
        }),
      [],
    );

    return {
      feeStatus: snapshot.feeStatus,
      feeDueAmount: snapshot.feeDueAmount,
      demands: demands.map((d: Record<string, unknown>) => ({
        id: d.id,
        demandNo: d.demandNo,
        status: d.status,
        balanceAmount: Number(d.balanceAmount ?? 0),
        totalAmount: Number(d.totalAmount ?? 0),
        paidAmount: Number(d.paidAmount ?? 0),
        dueDate: d.dueDate,
        semesterNumber: d.semesterNumber,
      })),
    };
  }

  async loadAttendanceSummary(tenantId: string, studentId: string) {
    const snapshot =
      (await this.loadForStudents(tenantId, [studentId])).get(studentId) ??
      this.emptySnapshot();

    const summaries = await this.safeLoad(
      () =>
        this.db().studentAttendanceSummary.findMany({
          where: { tenantId, studentId },
          select: {
            courseId: true,
            semesterNo: true,
            totalSessions: true,
            presentCount: true,
            percentage: true,
            metadata: true,
          },
          orderBy: { percentage: 'asc' },
        }),
      [],
    );

    return {
      attendancePercent: snapshot.attendancePercent,
      attendanceEligibility: snapshot.attendanceEligibility,
      attendanceShortage: snapshot.attendanceShortage,
      subjects: summaries.map((row: Record<string, unknown>) => {
        const metadata =
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : {};
        return {
          subjectName:
            (typeof metadata.subjectName === 'string' &&
              metadata.subjectName) ||
            (typeof metadata.courseTitle === 'string' &&
              metadata.courseTitle) ||
            (row.courseId as string | undefined) ||
            null,
          percentage: Number(row.percentage ?? 0),
          presentCount:
            row.presentCount != null ? Number(row.presentCount) : null,
          totalCount:
            row.totalSessions != null ? Number(row.totalSessions) : null,
          semesterSequence:
            row.semesterNo != null ? Number(row.semesterNo) : null,
        };
      }),
    };
  }

  async updateResidence(
    tenantId: string,
    studentId: string,
    data: {
      residenceType?: string | null;
      hostelBlock?: string | null;
      hostelRoom?: string | null;
    },
  ) {
    const existing = await this.loadResidenceRows(tenantId, [studentId]);
    const current = existing[0];

    const normalizeType = (value?: string | null) =>
      value === 'HOSTELLER' || value === 'DAY_SCHOLAR' ? value : null;

    const nextType =
      data.residenceType !== undefined
        ? normalizeType(data.residenceType)
        : normalizeType(current?.residenceType);
    const nextBlock =
      data.hostelBlock !== undefined
        ? data.hostelBlock
        : (current?.hostelBlock ?? null);
    const nextRoom =
      data.hostelRoom !== undefined
        ? data.hostelRoom
        : (current?.hostelRoom ?? null);

    await this.prisma.$executeRaw`
      INSERT INTO academic.student_academic_profiles (
        id, tenant_id, student_id, residence_type, hostel_block, hostel_room, class12_subjects, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(),
        ${tenantId}::uuid,
        ${studentId}::uuid,
        ${nextType},
        ${nextBlock},
        ${nextRoom},
        '[]'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (student_id) DO UPDATE SET
        residence_type = ${nextType},
        hostel_block = ${nextBlock},
        hostel_room = ${nextRoom},
        updated_at = NOW()
    `;
  }

  private async safeLoad<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.logger.warn(
        `Directory enrichment partial failure: ${error instanceof Error ? error.message : String(error)}`,
      );
      return fallback;
    }
  }

  private async loadResidenceRows(
    tenantId: string,
    studentIds: string[],
  ): Promise<ResidenceRow[]> {
    if (!studentIds.length) return [];
    return this.prisma.$queryRaw<ResidenceRow[]>`
      SELECT
        student_id AS "studentId",
        residence_type AS "residenceType",
        hostel_block AS "hostelBlock",
        hostel_room AS "hostelRoom"
      FROM academic.student_academic_profiles
      WHERE tenant_id = ${tenantId}::uuid
        AND student_id IN (${Prisma.join(studentIds.map((id) => Prisma.sql`${id}::uuid`))})
    `;
  }

  private async countHostellers(tenantId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM academic.student_academic_profiles sap
      INNER JOIN academic.students s
        ON s.id = sap.student_id AND s.tenant_id = sap.tenant_id
      WHERE sap.tenant_id = ${tenantId}::uuid
        AND s.deleted_at IS NULL
        AND sap.residence_type = 'HOSTELLER'
    `;
    return rows[0]?.count ?? 0;
  }

  private async listHostellerIds(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ studentId: string }[]>`
      SELECT sap.student_id AS "studentId"
      FROM academic.student_academic_profiles sap
      INNER JOIN academic.students s
        ON s.id = sap.student_id AND s.tenant_id = sap.tenant_id
      WHERE sap.tenant_id = ${tenantId}::uuid
        AND s.deleted_at IS NULL
        AND sap.residence_type = 'HOSTELLER'
    `;
    return rows.map((row) => row.studentId);
  }

  private async loadFeeSnapshots(
    tenantId: string,
    studentIds: string[],
  ): Promise<Map<string, DirectoryFeeSnapshot>> {
    const map = new Map<string, DirectoryFeeSnapshot>();
    const summaries = await this.feeSummary.getManyCached(tenantId, studentIds);
    for (const studentId of studentIds) {
      const row = summaries.get(studentId);
      if (!row || row.totalOutstanding <= 0) {
        map.set(studentId, { feeStatus: 'CLEAR', feeDueAmount: 0 });
        continue;
      }
      let feeStatus: DirectoryFeeSnapshot['feeStatus'] = 'DUE';
      if (row.feeStatus === 'OVERDUE') feeStatus = 'OVERDUE';
      else if (row.activeDemandCount > 1) feeStatus = 'PARTIAL';
      map.set(studentId, {
        feeStatus,
        feeDueAmount: Math.round(row.totalOutstanding * 100) / 100,
      });
    }
    return map;
  }

  private async loadAttendanceSnapshots(
    tenantId: string,
    studentIds: string[],
  ): Promise<Map<string, DirectoryAttendanceSnapshot>> {
    const map = new Map<string, DirectoryAttendanceSnapshot>();

    const eligibilityRows =
      await this.db().studentAttendanceEligibilitySnapshot.findMany({
        where: { tenantId, studentId: { in: studentIds } },
        select: {
          studentId: true,
          subjectPercentage: true,
          semesterPercentage: true,
          eligibilityStatus: true,
        },
        orderBy: { snapshotAt: 'desc' },
      });

    const eligibilityByStudent = new Map<
      string,
      {
        minSubject: number;
        semesterPct: number | null;
        status: string | null;
      }
    >();

    for (const row of eligibilityRows) {
      const subjectPct = Number(row.subjectPercentage ?? 0);
      const existing = eligibilityByStudent.get(row.studentId);
      if (!existing) {
        eligibilityByStudent.set(row.studentId, {
          minSubject: subjectPct,
          semesterPct:
            row.semesterPercentage != null
              ? Number(row.semesterPercentage)
              : null,
          status: row.eligibilityStatus ?? null,
        });
        continue;
      }
      existing.minSubject = Math.min(existing.minSubject, subjectPct);
      if (row.semesterPercentage != null && existing.semesterPct == null) {
        existing.semesterPct = Number(row.semesterPercentage);
      }
      if (
        row.eligibilityStatus === 'DETAINED' ||
        (existing.status !== 'DETAINED' &&
          row.eligibilityStatus === 'CONDONATION')
      ) {
        existing.status = row.eligibilityStatus;
      }
    }

    const summaryRows = await this.db().studentAttendanceSummary.findMany({
      where: { tenantId, studentId: { in: studentIds } },
      select: { studentId: true, percentage: true },
    });

    const summaryByStudent = new Map<string, number[]>();
    for (const row of summaryRows) {
      const list = summaryByStudent.get(row.studentId) ?? [];
      list.push(Number(row.percentage ?? 0));
      summaryByStudent.set(row.studentId, list);
    }

    for (const studentId of studentIds) {
      const eligibility = eligibilityByStudent.get(studentId);
      const percentages = summaryByStudent.get(studentId) ?? [];
      const avgFromSummaries = percentages.length
        ? Math.round(
            (percentages.reduce((sum, value) => sum + value, 0) /
              percentages.length) *
              100,
          ) / 100
        : null;

      const attendancePercent =
        eligibility?.semesterPct ?? avgFromSummaries ?? null;

      const minSubject =
        eligibility?.minSubject ??
        (percentages.length ? Math.min(...percentages) : null);

      const eligibilityStatus =
        eligibility?.status === 'ELIGIBLE' ||
        eligibility?.status === 'CONDONATION' ||
        eligibility?.status === 'DETAINED'
          ? eligibility.status
          : null;

      const attendanceShortage =
        (minSubject != null && minSubject < ATTENDANCE_SHORTAGE_THRESHOLD) ||
        eligibilityStatus === 'CONDONATION' ||
        eligibilityStatus === 'DETAINED';

      map.set(studentId, {
        attendancePercent,
        attendanceEligibility: eligibilityStatus,
        attendanceShortage,
      });
    }

    return map;
  }

  private async listFeeDefaulterIds(tenantId: string): Promise<string[]> {
    return this.feeSummary.listDefaulterStudentIds(tenantId);
  }

  private async countFeeDefaulters(tenantId: string): Promise<number> {
    const ids = await this.listFeeDefaulterIds(tenantId);
    return ids.length;
  }

  private async listAttendanceShortageIds(tenantId: string): Promise<string[]> {
    const fromEligibility =
      await this.db().studentAttendanceEligibilitySnapshot.findMany({
        where: {
          tenantId,
          eligibilityStatus: { in: ['CONDONATION', 'DETAINED'] },
        },
        distinct: ['studentId'],
        select: { studentId: true },
      });

    const eligibilityIds = new Set<string>(
      fromEligibility.map((row: { studentId: string }) => row.studentId),
    );

    const summaries = await this.db().studentAttendanceSummary.findMany({
      where: { tenantId },
      select: { studentId: true, percentage: true },
    });

    const minByStudent = new Map<string, number>();
    for (const row of summaries) {
      const pct = Number(row.percentage ?? 0);
      const current = minByStudent.get(row.studentId);
      if (current == null || pct < current) {
        minByStudent.set(row.studentId, pct);
      }
    }

    for (const [studentId, minPct] of minByStudent) {
      if (minPct < ATTENDANCE_SHORTAGE_THRESHOLD) {
        eligibilityIds.add(studentId);
      }
    }

    return this.filterActiveStudentIds(tenantId, [...eligibilityIds]);
  }

  private async filterActiveStudentIds(
    tenantId: string,
    studentIds: string[],
  ): Promise<string[]> {
    if (!studentIds.length) return [];
    const rows = await this.prisma.student.findMany({
      where: { tenantId, deletedAt: null, id: { in: studentIds } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  private async countAttendanceShortage(tenantId: string): Promise<number> {
    const ids = await this.listAttendanceShortageIds(tenantId);
    return ids.length;
  }

  private async listSubjectPendingIds(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ studentId: string }[]>`
      SELECT s.id AS "studentId"
      FROM academic.students s
      LEFT JOIN academic.student_academic_standings st
        ON st.student_id = s.id AND st.tenant_id = s.tenant_id
      WHERE s.tenant_id = ${tenantId}::uuid
        AND s.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM academic.semester_registrations sr
          WHERE sr.student_id = s.id
            AND sr.tenant_id = s.tenant_id
            AND sr.semester_sequence = COALESCE(st.current_semester_sequence, 1)
            AND sr.status = 'completed'
        )
    `;
    return rows.map((row) => row.studentId);
  }
}
