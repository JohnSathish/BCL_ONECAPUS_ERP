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
    const keys = columns?.length
      ? columns
      : Object.keys(rows[0] ?? this.emptyRow());

    return {
      total,
      truncated: total > ROW_LIMIT,
      rowCount: rows.length,
      columns: resolveFieldLabels(keys),
      rows: sorted,
    };
  }

  private async loadLookupMaps(tenantId: string) {
    const types = [
      'blood_group',
      'religion',
      'category',
      'tribe',
      'denomination',
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
    const permanent = student.addresses.find(
      (a) => a.addressType === 'PERMANENT',
    );
    const present = student.addresses.find((a) => a.addressType === 'PRESENT');
    const father = student.guardians.find((g) => g.guardianType === 'FATHER');
    const mother = student.guardians.find((g) => g.guardianType === 'MOTHER');
    const board = student.boardExams[0];
    const age = profile?.dateOfBirth ? this.calcAge(profile.dateOfBirth) : null;

    return {
      rollNumber: student.rollNumber ?? student.enrollmentNumber,
      enrollmentNumber: student.enrollmentNumber,
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
      admissionDate: student.admissionDate,
      admissionType: profile?.admissionType ?? '',
      gender: profile?.gender ?? '',
      dateOfBirth: profile?.dateOfBirth,
      age,
      category: profile?.categoryLookupId
        ? (lookups.category.get(profile.categoryLookupId) ?? '')
        : '',
      religion: profile?.religionLookupId
        ? (lookups.religion.get(profile.religionLookupId) ?? '')
        : '',
      denomination: profile?.denominationLookupId
        ? (lookups.denomination.get(profile.denominationLookupId) ?? '')
        : '',
      tribe: profile?.tribeLookupId
        ? (lookups.tribe.get(profile.tribeLookupId) ?? '')
        : '',
      bloodGroup: profile?.bloodGroupLookupId
        ? (lookups.blood_group.get(profile.bloodGroupLookupId) ?? '')
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
      permanentAddress: this.formatAddress(permanent),
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
        '',
      minorDepartment:
        student.majorMinorTrack?.minorSubject?.department?.name ??
        student.majorMinorTrack?.minorSubject?.name ??
        '',
    };
  }

  private emptyRow(): Record<string, unknown> {
    return { rollNumber: '', fullName: '' };
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
