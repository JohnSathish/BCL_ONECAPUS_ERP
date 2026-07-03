import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { StudentDirectoryEnrichmentService } from '../../students/services/student-directory-enrichment.service';
import { resolveFieldLabels } from '../domain/student-report-field-registry';
import type { StudentReportFiltersDto } from '../dto/student-reports.dto';
import { StudentReportsQueryService } from './student-reports-query.service';

const MASTER_INCLUDE = {
  user: { select: { email: true } },
  masterProfile: true,
  programVersion: {
    include: { program: { select: { code: true, name: true } } },
  },
  department: { select: { name: true } },
  primaryShift: { select: { name: true } },
  academicProfile: {
    include: {
      stream: { select: { name: true } },
      admissionBatch: {
        include: { entrySession: { select: { name: true } } },
      },
    },
  },
  academicStanding: true,
  abcAccount: { select: { abcId: true, abcVerified: true } },
  addresses: true,
  guardians: true,
  boardExams: { orderBy: { examYear: 'desc' as const }, take: 1 },
  cuetDetail: true,
  majorMinorTrack: {
    include: {
      majorSubject: { include: { department: { select: { name: true } } } },
      minorSubject: { include: { department: { select: { name: true } } } },
    },
  },
  programChoices: {
    where: { status: 'active', deletedAt: null },
  },
} satisfies Prisma.StudentInclude;

const ROW_LIMIT = 10_000;

@Injectable()
export class StudentMasterAssemblerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: StudentReportsQueryService,
    private readonly directoryEnrichment: StudentDirectoryEnrichmentService,
  ) {}

  async assemble(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
    columns?: string[],
  ) {
    const where = this.query.buildWhere(tenantId, filters, user);
    const [total, students, lookupMaps] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        include: MASTER_INCLUDE,
        orderBy: [{ rollNumber: 'asc' }, { enrollmentNumber: 'asc' }],
        take: ROW_LIMIT,
      }),
      this.loadLookupMaps(tenantId),
    ]);

    const operational = await this.directoryEnrichment.loadForStudents(
      tenantId,
      students.map((s) => s.id),
    );

    let filteredStudents = students;
    if (filters.feeStatus || filters.residenceType) {
      filteredStudents = students.filter((student) => {
        const op = operational.get(student.id);
        if (filters.feeStatus && op?.feeStatus !== filters.feeStatus) {
          return false;
        }
        if (
          filters.residenceType &&
          op?.residenceType !== filters.residenceType
        ) {
          return false;
        }
        return true;
      });
    }

    const rows = filteredStudents.map((student) =>
      this.mapStudent(student, lookupMaps, operational.get(student.id)),
    );

    const sorted = this.sortRows(rows, filters);
    const requestedKeys = this.normalizeColumnKeys(columns);
    const keys = requestedKeys?.length
      ? requestedKeys
      : Object.keys(rows[0] ?? this.emptyRow());

    // Project to selected columns with stable string values for the UI/export.
    const projected = sorted.map((row) => {
      const next: Record<string, unknown> = {};
      for (const key of keys) {
        const value = row[key];
        next[key] = value == null ? '' : value;
      }
      return next;
    });

    return {
      total,
      truncated: total > ROW_LIMIT,
      rowCount: projected.length,
      columns: resolveFieldLabels(keys),
      rows: projected,
    };
  }

  private async loadLookupMaps(tenantId: string) {
    // Master lookup types are stored uppercase (CATEGORY, RELIGION, …).
    const types = [
      'BLOOD_GROUP',
      'RELIGION',
      'CATEGORY',
      'TRIBE',
      'DENOMINATION',
    ] as const;
    const entries = await Promise.all(
      types.map(
        async (lookupType) =>
          [
            lookupType,
            await this.query.loadLookupMap(tenantId, lookupType),
          ] as const,
      ),
    );
    return Object.fromEntries(entries) as Record<
      (typeof types)[number],
      Map<string, string>
    >;
  }

  private mapStudent(
    student: Prisma.StudentGetPayload<{ include: typeof MASTER_INCLUDE }>,
    lookups: Record<string, Map<string, string>>,
    operational?: ReturnType<
      StudentDirectoryEnrichmentService['emptySnapshot']
    >,
  ): Record<string, unknown> {
    const profile = student.masterProfile;
    // Profile/import use HOME (permanent) and TURA (local/present); older rows
    // may use PERMANENT / PRESENT / CURRENT.
    const addresses = student.addresses ?? [];
    const permanent =
      this.pickAddress(addresses, ['HOME', 'PERMANENT']) ??
      // Fall back to any address that has content (import variants).
      addresses.find((address) => this.formatAddress(address)) ??
      null;
    const present = this.pickAddress(addresses, [
      'TURA',
      'PRESENT',
      'CURRENT',
      'CORRESPONDENCE',
    ]);
    const father = student.guardians.find((g) => g.guardianType === 'FATHER');
    const mother = student.guardians.find((g) => g.guardianType === 'MOTHER');
    const board = student.boardExams[0];
    const age = profile?.dateOfBirth ? this.calcAge(profile.dateOfBirth) : null;
    const majorChoice = student.programChoices?.find(
      (choice) => choice.choiceType === 'MAJOR',
    );
    const minorChoice = student.programChoices?.find(
      (choice) => choice.choiceType === 'MINOR',
    );

    return {
      rollNumber: student.rollNumber ?? student.enrollmentNumber,
      enrollmentNumber: student.enrollmentNumber,
      universityRollNumber: student.universityRollNumber ?? '',
      universityRegistrationNumber: student.universityRegistrationNumber ?? '',
      admissionNumber: student.admissionNumber,
      applicationNumber: student.applicationNumber,
      rfidNumber: student.rfidNumber,
      fullName: profile?.fullName ?? '',
      programme: student.programVersion?.program?.name ?? '',
      programmeVersion: student.programVersion?.version ?? '',
      department: student.department?.name ?? '',
      shift: student.primaryShift?.name ?? '',
      stream: student.academicProfile?.stream?.name ?? '',
      batch: student.academicProfile?.admissionBatch?.batchCode ?? '',
      session:
        student.academicProfile?.admissionBatch?.entrySession?.name ?? '',
      currentSemester: student.academicStanding?.currentSemesterSequence ?? '',
      academicStatus: student.academicStanding?.lifecycleState ?? '',
      admissionStatus: profile?.admissionStatus ?? '',
      studentStatus: profile?.studentStatus ?? '',
      admissionDate: this.formatDateOnly(student.admissionDate),
      admissionType: profile?.admissionType ?? '',
      gender: profile?.gender ?? '',
      dateOfBirth: this.formatDateOnly(profile?.dateOfBirth),
      age,
      category: profile?.categoryLookupId
        ? (lookups.CATEGORY.get(profile.categoryLookupId) ?? '')
        : '',
      religion: profile?.religionLookupId
        ? (lookups.RELIGION.get(profile.religionLookupId) ?? '')
        : '',
      denomination: profile?.denominationLookupId
        ? (lookups.DENOMINATION.get(profile.denominationLookupId) ?? '')
        : '',
      tribe: profile?.tribeLookupId
        ? (lookups.TRIBE.get(profile.tribeLookupId) ?? '')
        : '',
      bloodGroup: profile?.bloodGroupLookupId
        ? (lookups.BLOOD_GROUP.get(profile.bloodGroupLookupId) ?? '')
        : '',
      maritalStatus: profile?.maritalStatus ?? '',
      nationalId: profile?.nationalId ?? '',
      differentlyAbled: profile?.differentlyAbled ?? false,
      ews: profile?.ews ?? false,
      email: profile?.email ?? student.user.email,
      mobileNumber: profile?.mobileNumber ?? '',
      fatherName: father?.fullName ?? '',
      motherName: mother?.fullName ?? '',
      guardianName: profile?.guardianName ?? '',
      guardianMobile: profile?.guardianMobile ?? '',
      permanentAddress:
        this.formatAddress(permanent) || this.formatAddress(present),
      presentAddress: this.formatAddress(present),
      state: permanent?.state ?? present?.state ?? '',
      district: permanent?.district ?? present?.district ?? '',
      pincode: permanent?.pinCode ?? present?.pinCode ?? '',
      boardName: board?.boardName ?? '',
      boardYear: board?.examYear ?? '',
      boardPercentage: board?.percentage ? Number(board.percentage) : '',
      cuetRoll: student.cuetDetail?.cuetRollNumber ?? '',
      cuetScore: student.cuetDetail?.cuetScore
        ? Number(student.cuetDetail.cuetScore)
        : '',
      abcId: student.abcAccount?.abcId ?? '',
      abcVerified: student.abcAccount?.abcVerified ?? false,
      feeStatus: operational?.feeStatus ?? 'CLEAR',
      feeDueAmount: operational?.feeDueAmount ?? 0,
      residenceType: operational?.residenceType ?? '',
      hostelBlock: operational?.hostelBlock ?? '',
      hostelRoom: operational?.hostelRoom ?? '',
      attendancePercent: operational?.attendancePercent ?? '',
      majorDepartment:
        student.majorMinorTrack?.majorSubject?.department?.name ??
        student.majorMinorTrack?.majorSubject?.name ??
        student.department?.name ??
        this.humanizeSlug(majorChoice?.subjectSlug) ??
        '',
      minorDepartment:
        student.majorMinorTrack?.minorSubject?.department?.name ??
        student.majorMinorTrack?.minorSubject?.name ??
        this.humanizeSlug(minorChoice?.subjectSlug) ??
        '',
    };
  }

  private emptyRow(): Record<string, unknown> {
    return { rollNumber: '', fullName: '' };
  }

  private pickAddress<T extends { addressType: string }>(
    addresses: T[],
    types: string[],
  ): T | null {
    const preferred = new Set(types.map((type) => type.toUpperCase()));
    return (
      addresses.find((address) =>
        preferred.has(String(address.addressType ?? '').toUpperCase()),
      ) ?? null
    );
  }

  private humanizeSlug(slug?: string | null): string {
    if (!slug?.trim()) return '';
    return slug
      .trim()
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  private normalizeColumnKeys(columns?: string[] | string): string[] | null {
    if (columns == null) return null;
    if (Array.isArray(columns)) {
      return columns.map((key) => String(key).trim()).filter(Boolean);
    }
    if (typeof columns === 'string' && columns.trim()) {
      // Query-string may arrive as a single key or comma-separated list.
      return columns
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
    }
    return null;
  }

  private formatAddress(
    addr?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      district?: string | null;
      state?: string | null;
      pinCode?: string | null;
    } | null,
  ) {
    if (!addr) return '';
    return [
      addr.line1,
      addr.line2,
      addr.city,
      addr.district,
      addr.state,
      addr.pinCode,
    ]
      .filter(Boolean)
      .join(', ');
  }

  private calcAge(dob: Date) {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
    return age;
  }

  /** Report cells should show date only, never ISO time (T00:00:00.000Z). */
  private formatDateOnly(value?: Date | string | null): string {
    if (value == null || value === '') return '';
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return '';
      const y = value.getUTCFullYear();
      const m = String(value.getUTCMonth() + 1).padStart(2, '0');
      const d = String(value.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const match = String(value)
      .trim()
      .match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/);
    return match?.[1] ?? '';
  }

  private sortRows(
    rows: Record<string, unknown>[],
    filters: StudentReportFiltersDto,
  ) {
    const key = filters.sortBy;
    if (!key) return rows;
    const dir = filters.sortDirection === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }
}
