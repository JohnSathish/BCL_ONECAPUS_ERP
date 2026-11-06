import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { class12BoardReportLabel } from '../../students/domain/class12-board-name';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { StudentDirectoryEnrichmentService } from '../../students/services/student-directory-enrichment.service';
import {
  canViewSensitiveReportFields,
  resolveFieldLabels,
  SENSITIVE_REPORT_FIELDS,
} from '../domain/student-report-field-registry';
import {
  completionPercent,
  isFilled,
  isValidEmail,
  isValidMobile,
} from '../../students/domain/profile-completion-monitor.logic';
import type { StudentReportFiltersDto } from '../dto/student-reports.dto';
import { StudentReportRelatedService } from './student-report-related.service';
import { StudentReportsQueryService } from './student-reports-query.service';

const MASTER_INCLUDE = {
  user: { select: { email: true, isActive: true, lastLoginAt: true } },
  createdBy: { select: { email: true, displayName: true } },
  lastModifiedBy: { select: { email: true, displayName: true } },
  admissionApplication: {
    select: {
      firstName: true,
      lastName: true,
      status: true,
      submittedAt: true,
      documentVerificationStatus: true,
    },
  },
  masterProfile: true,
  programVersion: {
    include: { program: { select: { code: true, name: true } } },
  },
  department: { select: { name: true } },
  primaryShift: { select: { name: true } },
  academicProfile: {
    include: {
      stream: { select: { name: true } },
      preferredShift: { select: { name: true } },
      admissionBatch: {
        include: { entrySession: { select: { name: true } } },
      },
    },
  },
  academicStanding: true,
  abcAccount: {
    select: {
      abcId: true,
      abcVerified: true,
      verificationStatus: true,
      status: true,
    },
  },
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
const PREVIEW_ROW_LIMIT = 25;

@Injectable()
export class StudentMasterAssemblerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: StudentReportsQueryService,
    private readonly directoryEnrichment: StudentDirectoryEnrichmentService,
    private readonly related: StudentReportRelatedService,
  ) {}

  async assemble(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
    columns?: string[],
    options?: { take?: number },
  ) {
    const requestedKeys = this.allowedColumns(
      this.normalizeColumnKeys(columns),
      user,
    );
    if (columns?.length && requestedKeys && requestedKeys.length === 0) {
      throw new ForbiddenException(
        'You do not have access to the selected fields.',
      );
    }
    const where = await this.applyOperationalWhere(
      tenantId,
      this.query.buildWhere(tenantId, filters, user),
      filters,
    );
    const take = Math.min(ROW_LIMIT, Math.max(1, options?.take ?? ROW_LIMIT));
    const [total, students, lookupMaps] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        include: MASTER_INCLUDE,
        orderBy: [{ rollNumber: 'asc' }, { enrollmentNumber: 'asc' }],
        take,
      }),
      this.loadLookupMaps(tenantId),
    ]);

    const operational = await this.directoryEnrichment.loadForStudents(
      tenantId,
      students.map((s) => s.id),
      this.enrichmentParts(requestedKeys, filters),
    );

    const rows = students.map((student) =>
      this.mapStudent(student, lookupMaps, operational.get(student.id)),
    );
    const related = await this.related.attach(
      tenantId,
      students.map((student) => ({
        studentId: student.id,
        rollNumber: student.rollNumber ?? student.enrollmentNumber,
        fullName: student.masterProfile?.fullName ?? '',
        admissionYearId: student.academicProfile?.admissionYearId ?? null,
        currentSemester:
          student.academicStanding?.currentSemesterSequence ?? null,
      })),
      requestedKeys,
      {
        semester:
          filters.semester && filters.semester > 0 ? filters.semester : null,
      },
    );
    for (const row of rows) {
      Object.assign(row, related.patches.get(String(row.studentId)) ?? {});
    }

    const sorted = this.sortRows(rows, filters);
    const allowSensitive = canViewSensitiveReportFields(user?.permissions);
    const keys =
      requestedKeys ??
      Object.keys(rows[0] ?? this.emptyRow()).filter(
        (key) => allowSensitive || !SENSITIVE_REPORT_FIELDS.has(key),
      );

    // Project to selected columns with stable string values for the UI/export.
    const projected = sorted.map((row) => {
      const next: Record<string, unknown> = {};
      for (const key of keys) {
        const value = row[key];
        next[key] = value == null ? '' : value;
      }
      if (keys.includes('class12SubjectList')) {
        next.class12MarksBySubject = row.class12MarksBySubject ?? {};
      }
      return next;
    });

    return {
      total,
      truncated: total > ROW_LIMIT,
      rowCount: projected.length,
      columns: resolveFieldLabels(keys),
      rows: projected,
      relatedSheets: related.sheets,
    };
  }

  /** Preview must not pull the full student graph. Export keeps the 10,000 cap. */
  static previewTake(limit?: number) {
    const requested = Number(limit);
    if (!Number.isFinite(requested) || requested <= 0) return PREVIEW_ROW_LIMIT;
    return Math.min(PREVIEW_ROW_LIMIT, Math.floor(requested));
  }

  private enrichmentParts(
    columns: string[] | null,
    filters: StudentReportFiltersDto,
  ) {
    const wants = (key: string) => !columns?.length || columns.includes(key);
    return {
      fee:
        wants('feeStatus') ||
        wants('feeDueAmount') ||
        Boolean(filters.feeStatus),
      attendance:
        wants('attendancePercent') ||
        wants('attendanceStatus') ||
        wants('attendanceWorkingDays'),
      residence:
        wants('residenceType') ||
        wants('hostelBlock') ||
        wants('hostelRoom') ||
        Boolean(filters.residenceType),
    };
  }

  private async applyOperationalWhere(
    tenantId: string,
    where: Prisma.StudentWhereInput,
    filters: StudentReportFiltersDto,
  ): Promise<Prisma.StudentWhereInput> {
    let next = where;
    if (filters.residenceType) {
      const current = next.academicProfile;
      const plain =
        current &&
        typeof current === 'object' &&
        !Array.isArray(current) &&
        !('is' in current) &&
        !('isNot' in current)
          ? (current as Prisma.StudentAcademicProfileWhereInput)
          : {};
      next = {
        ...next,
        academicProfile: { ...plain, residenceType: filters.residenceType },
      };
    }
    if (filters.feeStatus) {
      next = this.intersectStudentIds(
        next,
        await this.studentIdsForFeeStatus(tenantId, filters.feeStatus),
      );
    }
    return next;
  }

  private intersectStudentIds(
    where: Prisma.StudentWhereInput,
    ids: string[],
  ): Prisma.StudentWhereInput {
    const current = where.id;
    if (
      current &&
      typeof current === 'object' &&
      'in' in current &&
      Array.isArray(current.in)
    ) {
      const allow = new Set(ids);
      return {
        ...where,
        id: { in: current.in.filter((id) => allow.has(String(id))) },
      };
    }
    return { ...where, id: { in: ids } };
  }

  private async studentIdsForFeeStatus(
    tenantId: string,
    status: string,
  ): Promise<string[]> {
    if (status === 'CLEAR') {
      const due = await this.prisma.studentFeeSummary.findMany({
        where: { tenantId, totalOutstanding: { gt: 0 } },
        select: { studentId: true },
      });
      const dueIds = due.map((row) => row.studentId);
      const students = await this.prisma.student.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(dueIds.length ? { id: { notIn: dueIds } } : {}),
        },
        select: { id: true },
      });
      return students.map((row) => row.id);
    }

    const where: Prisma.StudentFeeSummaryWhereInput =
      status === 'OVERDUE'
        ? { tenantId, feeStatus: 'OVERDUE', totalOutstanding: { gt: 0 } }
        : status === 'PARTIAL'
          ? {
              tenantId,
              totalOutstanding: { gt: 0 },
              activeDemandCount: { gt: 1 },
              NOT: { feeStatus: 'OVERDUE' },
            }
          : status === 'DUE'
            ? {
                tenantId,
                feeStatus: 'DUE',
                totalOutstanding: { gt: 0 },
                activeDemandCount: { lte: 1 },
              }
            : { tenantId, feeStatus: status, totalOutstanding: { gt: 0 } };

    const rows = await this.prisma.studentFeeSummary.findMany({
      where,
      select: { studentId: true },
    });
    return rows.map((row) => row.studentId);
  }

  private async loadLookupMaps(tenantId: string) {
    // Master lookup types are stored uppercase (CATEGORY, RELIGION, …).
    const types = [
      'BLOOD_GROUP',
      'RELIGION',
      'CATEGORY',
      'TRIBE',
      'DENOMINATION',
      'NATIONALITY',
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
    const nameParts = this.splitName(
      profile?.fullName,
      student.admissionApplication,
    );
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
      boardNameOther: board?.boardNameOther ?? '',
      boardReportName: class12BoardReportLabel(
        board?.boardName,
        board?.boardNameOther,
      ),
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
      attendanceStatus: operational?.attendanceEligibility ?? '',
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
      studentId: student.id,
      formNumber: student.formNumber ?? '',
      libraryCardNumber: student.libraryCardNumber ?? '',
      firstName: nameParts.first,
      middleName: nameParts.middle,
      lastName: nameParts.last,
      nationality: this.lookup(
        lookups,
        'NATIONALITY',
        profile?.nationalityLookupId,
      ),
      panNumber: profile?.panNumber ?? '',
      alternateMobile: profile?.alternateMobile ?? '',
      whatsappNumber: profile?.whatsappNumber ?? '',
      emergencyContactName: profile?.emergencyContactName ?? '',
      emergencyContactRelation: profile?.emergencyContactRelation ?? '',
      emergencyContactMobile: profile?.emergencyContactMobile ?? '',
      fatherMobile: father?.contactNumber ?? '',
      fatherOccupation: father?.occupation ?? '',
      motherMobile: mother?.contactNumber ?? '',
      motherOccupation: mother?.occupation ?? '',
      presentVillage: present?.city ?? '',
      permanentVillage: permanent?.city ?? '',
      presentDistrict: present?.district ?? '',
      presentState: present?.state ?? '',
      presentPincode: present?.pinCode ?? '',
      admissionSource: student.admissionSource ?? '',
      admissionCategory: profile?.admissionCategory ?? '',
      applicationStatus: student.admissionApplication?.status ?? '',
      applicationSubmittedAt: this.formatDateOnly(
        student.admissionApplication?.submittedAt,
      ),
      previousCollegeName: student.academicProfile?.previousCollegeName ?? '',
      applicationDocumentStatus:
        student.admissionApplication?.documentVerificationStatus ?? '',
      majorSubject:
        student.majorMinorTrack?.majorSubject?.name ??
        this.humanizeSlug(majorChoice?.subjectSlug) ??
        '',
      minorSubject:
        student.majorMinorTrack?.minorSubject?.name ??
        this.humanizeSlug(minorChoice?.subjectSlug) ??
        '',
      preferredShift: student.academicProfile?.preferredShift?.name ?? '',
      nccEnrolled: student.academicProfile?.nccEnrolled ?? false,
      programmeStatus: student.academicStanding?.programmeStatus ?? '',
      profileCompletionPercent: this.profilePercent(student),
      schoolName: board?.schoolName ?? '',
      boardRollNumber: board?.boardRollNumber ?? '',
      boardRegistrationNumber: board?.registrationNumber ?? '',
      boardStream: board?.stream ?? '',
      boardTotalMarks: board?.totalMarks ?? '',
      boardMaximumMarks: board?.maximumMarks ?? '',
      boardGrade: board?.grade ?? '',
      boardDivision: board?.division ?? '',
      boardVerificationStatus: board?.verificationStatus ?? '',
      cuetApplied: student.cuetDetail?.cuetApplied ?? false,
      cuetSubjects: this.jsonList(student.cuetDetail?.cuetSubjects),
      abcVerificationStatus: student.abcAccount?.verificationStatus ?? '',
      abcStatus: student.abcAccount?.status ?? '',
      photoAvailable: isFilled(profile?.photoPath),
      appAccountStatus: student.user.isActive ? 'ACTIVE' : 'INACTIVE',
      lastLoginAt: this.formatDateOnly(student.user.lastLoginAt),
      profileUpdatedAt: this.formatDateOnly(profile?.updatedAt),
      accountCreatedAt: this.formatDateOnly(student.createdAt),
      accountUpdatedAt: this.formatDateOnly(student.updatedAt),
      createdBy:
        student.createdBy?.displayName || student.createdBy?.email || '',
      updatedBy:
        student.lastModifiedBy?.displayName ||
        student.lastModifiedBy?.email ||
        '',
      bankName: profile?.bankName ?? '',
      accountHolderName: profile?.accountHolderName ?? '',
      accountNumber: profile?.accountNumber ?? '',
      ifsc: profile?.ifsc ?? '',
      branchName: profile?.branchName ?? '',
    };
  }

  private allowedColumns(columns: string[] | null, user?: JwtUser) {
    if (!columns?.length) return columns;
    if (canViewSensitiveReportFields(user?.permissions)) return columns;
    return columns.filter((key) => !SENSITIVE_REPORT_FIELDS.has(key));
  }

  private lookup(
    lookups: Record<string, Map<string, string>>,
    type: string,
    id?: string | null,
  ) {
    if (!id) return '';
    return lookups[type]?.get(id) ?? '';
  }

  private splitName(
    fullName?: string | null,
    application?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null,
  ) {
    const parts = String(fullName ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length >= 2) {
      return {
        first: parts[0],
        middle: parts.slice(1, -1).join(' '),
        last: parts[parts.length - 1],
      };
    }
    return {
      first: parts[0] || application?.firstName || '',
      middle: '',
      last: application?.lastName || '',
    };
  }

  private jsonList(value: unknown) {
    if (Array.isArray(value))
      return value
        .map((item) => String(item))
        .filter(Boolean)
        .join(', ');
    if (value && typeof value === 'object') return JSON.stringify(value);
    return value == null ? '' : String(value);
  }

  private profilePercent(
    student: Prisma.StudentGetPayload<{ include: typeof MASTER_INCLUDE }>,
  ) {
    const profile = student.masterProfile;
    const filledAddress = (types: string[]) =>
      (student.addresses ?? []).some(
        (address) =>
          types.includes(String(address.addressType ?? '').toUpperCase()) &&
          [address.line1, address.city, address.district, address.pinCode].some(
            (part) => isFilled(part),
          ),
      );
    const guardian = (type: string) =>
      isFilled(
        student.guardians.find((row) => row.guardianType === type)?.fullName,
      );
    const checks = [
      isFilled(profile?.gender),
      isFilled(profile?.dateOfBirth),
      isFilled(profile?.bloodGroupLookupId),
      isValidMobile(profile?.mobileNumber),
      isValidEmail(profile?.email) || isValidEmail(student.user.email),
      filledAddress(['PERMANENT', 'HOME']),
      filledAddress(['CURRENT', 'TURA', 'PRESENT']),
      guardian('FATHER'),
      guardian('MOTHER'),
      isFilled(profile?.photoPath),
    ];
    return completionPercent(checks.filter((ok) => !ok).length, checks.length);
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
