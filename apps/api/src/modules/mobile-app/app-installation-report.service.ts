import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  AppInstallationExportQueryDto,
  AppInstallationReportQueryDto,
} from './dto/app-installation-report.dto';
import {
  buildInstallationPdf,
  buildInstallationWorkbook,
} from './app-installation-report.documents';
import {
  INSTALLATION_BASIS,
  UNASSIGNED_DEPARTMENT_ID,
  classifyInstallations,
  formatReportTimestamp,
  groupInstallation,
  inactiveLifecycles,
  inactiveProgrammes,
  inactiveStudentStatuses,
  matchesPersonSearch,
  matchesShiftFilter,
  pendingInstallationView,
  reportCollegeName,
  reportHeadingName,
  staffReportCategory,
  type DeviceSignal,
  type InstallSignal,
  type InstallationDepartment,
  type InstallationPerson,
  type InstallationSummary,
} from './app-installation-report.logic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLLEGE_APP_TYPES = ['STUDENT', 'STAFF', 'student', 'staff'];
const ACTIVE_STAFF = ['ACTIVE', 'ON_LEAVE'];

type ShiftHint = {
  name?: string | null;
  code?: string | null;
  category?: string | null;
};

type Candidate = {
  person: InstallationPerson;
  shift: ShiftHint;
};

export type AppInstallationReport = {
  collegeName: string;
  headingName: string;
  academicYear: { id: string; name: string; liveCensus: boolean } | null;
  generatedAt: string;
  generatedLabel: string;
  populationNote: string;
  basis: string;
  filters: {
    academicYearId: string | null;
    departmentId: string | null;
    semester: number | null;
    shift: string | null;
    category: string;
    status: string;
    search: string | null;
    presentation: 'screen' | 'pending';
  };
  summary: InstallationSummary;
  departments: InstallationDepartment[];
};

@Injectable()
export class AppInstallationReportService {
  constructor(private readonly prisma: PrismaService) {}

  async report(tenantId: string, query: AppInstallationReportQueryDto) {
    return this.compose(tenantId, query, query.presentation ?? 'screen');
  }

  async export(tenantId: string, query: AppInstallationExportQueryDto) {
    const presentation = query.scope === 'pending' ? 'pending' : 'screen';
    const report = await this.compose(
      tenantId,
      query,
      presentation,
      query.scope,
    );
    const file =
      query.format === 'pdf'
        ? await buildInstallationPdf(report, query.scope)
        : await buildInstallationWorkbook(report, query.scope);
    return file;
  }

  private async compose(
    tenantId: string,
    query: AppInstallationReportQueryDto,
    presentation: 'screen' | 'pending',
    scope?: 'summary' | 'detailed' | 'pending' | 'department',
  ): Promise<AppInstallationReport> {
    const generatedAt = new Date();
    const departmentId = this.departmentFilter(query.departmentId, scope);
    const category = query.category ?? 'ALL';
    const status = query.status ?? 'ALL';
    const semester =
      category === 'TEACHING' || category === 'NON_TEACHING'
        ? undefined
        : query.semester;
    const year = await this.resolveYear(tenantId, query.academicYearId);
    const includeStudents = category === 'ALL' || category === 'STUDENTS';
    const includeStaff =
      (category === 'ALL' ||
        category === 'TEACHING' ||
        category === 'NON_TEACHING') &&
      semester == null;

    const [students, staff, collegeName] = await Promise.all([
      includeStudents
        ? this.loadStudents(tenantId, {
            departmentId,
            semester,
            yearId: year.liveCensus ? undefined : year.year?.id,
          })
        : Promise.resolve([] as Candidate[]),
      includeStaff
        ? this.loadStaff(tenantId, { departmentId, category })
        : Promise.resolve([] as Candidate[]),
      this.collegeName(tenantId),
    ]);

    const studentUserIds = new Set(
      students
        .map((row) => row.person.userId)
        .filter((id): id is string => Boolean(id)),
    );
    const staffRows = staff.filter(
      (row) => !row.person.userId || !studentUserIds.has(row.person.userId),
    );
    const userIds = [
      ...students.map((row) => row.person.userId),
      ...staffRows.map((row) => row.person.userId),
    ].filter((id): id is string => Boolean(id));
    const [signals, logins] = await Promise.all([
      this.installationSignals(tenantId, userIds),
      this.appLastLogins(tenantId, userIds),
    ]);

    let people = [...students, ...staffRows].map((row) => {
      const signal = this.signalFor(row.person.userId, signals);
      return {
        ...row,
        person: {
          ...row.person,
          status: signal.status,
          lastActiveAt: signal.lastActiveAt,
          lastLoginAt: row.person.userId
            ? (logins.get(row.person.userId) ?? null)
            : null,
        },
      };
    });

    people = people.filter((row) => matchesShiftFilter(row.shift, query.shift));
    people = people.filter((row) =>
      matchesPersonSearch(row.person, query.search),
    );
    if (presentation !== 'pending' && status !== 'ALL') {
      people = people.filter((row) => row.person.status === status);
    }
    if (scope === 'department' && departmentId) {
      people = people.filter((row) => row.person.departmentId === departmentId);
    }

    const flat = people.map((row) => row.person);
    const grouped =
      presentation === 'pending'
        ? pendingInstallationView(flat)
        : groupInstallation(flat);

    const resolvedName = reportCollegeName(collegeName);
    return {
      collegeName: resolvedName,
      headingName: reportHeadingName(resolvedName),
      academicYear: year.year
        ? {
            id: year.year.id,
            name: year.year.name,
            liveCensus: year.liveCensus,
          }
        : null,
      generatedAt: generatedAt.toISOString(),
      generatedLabel: formatReportTimestamp(generatedAt),
      populationNote: year.liveCensus
        ? 'This is the current academic session, so every student still on the rolls is included, together with staff who are currently in service.'
        : 'This is an earlier academic session. Students are included when their admission year or a semester registration belongs to it. Staff in service are included with the current department record.',
      basis: INSTALLATION_BASIS,
      filters: {
        academicYearId: year.year?.id ?? null,
        departmentId: departmentId ?? null,
        semester: semester ?? null,
        shift: query.shift ?? null,
        category,
        status: presentation === 'pending' ? 'ALL' : status,
        search: query.search?.trim() || null,
        presentation,
      },
      summary: grouped.summary,
      departments: grouped.departments,
    };
  }

  private departmentFilter(
    departmentId: string | undefined,
    scope?: 'summary' | 'detailed' | 'pending' | 'department',
  ) {
    const value = departmentId?.trim();
    if (!value) {
      if (scope === 'department') {
        throw new BadRequestException('Choose a department to print.');
      }
      return undefined;
    }
    if (value === UNASSIGNED_DEPARTMENT_ID) return UNASSIGNED_DEPARTMENT_ID;
    if (!UUID.test(value)) {
      throw new BadRequestException('Department is not valid.');
    }
    return value;
  }

  private async resolveYear(tenantId: string, academicYearId?: string) {
    const current = await this.prisma.academicYear.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ isPrimarySession: true }, { status: 'ACTIVE' }],
      },
      orderBy: [{ isPrimarySession: 'desc' }, { startDate: 'desc' }],
    });
    if (!academicYearId) {
      return { year: current, liveCensus: true };
    }
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId, deletedAt: null },
    });
    if (!year) throw new BadRequestException('Academic year not found.');
    return {
      year,
      liveCensus: Boolean(current && current.id === year.id),
    };
  }

  private async collegeName(tenantId: string) {
    const institution = await this.prisma.institution.findFirst({
      where: { tenantId, deletedAt: null },
      select: { name: true },
      orderBy: { createdAt: 'asc' },
    });
    return institution?.name ?? null;
  }

  private signalFor(
    userId: string | null,
    signals: Map<string, InstallSignal>,
  ): InstallSignal {
    if (!userId) return { status: 'NOT_INSTALLED', lastActiveAt: null };
    return (
      signals.get(userId) ?? { status: 'NOT_INSTALLED', lastActiveAt: null }
    );
  }

  private async installationSignals(tenantId: string, userIds: string[]) {
    const devices: DeviceSignal[] = [];
    for (const chunk of chunks(unique(userIds), 1000)) {
      const rows = await this.prisma.mobileDevice.findMany({
        where: {
          tenantId,
          userId: { in: chunk },
          appType: { in: COLLEGE_APP_TYPES },
        },
        select: {
          userId: true,
          status: true,
          pushToken: true,
          lastSeenAt: true,
        },
      });
      for (const row of rows) {
        devices.push({
          userId: row.userId,
          status: row.status,
          pushToken: row.pushToken,
          lastSeenAt: row.lastSeenAt.toISOString(),
        });
      }
    }
    return classifyInstallations(devices);
  }

  private async appLastLogins(tenantId: string, userIds: string[]) {
    const map = new Map<string, string>();
    const ids = unique(userIds);
    for (const chunk of chunks(ids, 1000)) {
      const [sessions, events] = await Promise.all([
        this.prisma.$queryRaw<Array<{ user_id: string; last_login: Date }>>`
          SELECT user_id, MAX(created_at) AS last_login
          FROM platform.refresh_sessions
          WHERE tenant_id = ${tenantId}::uuid
            AND user_id IN (${Prisma.join(chunk.map((id) => Prisma.sql`${id}::uuid`))})
            AND (
              UPPER(COALESCE(metadata->>'clientType', '')) IN ('ANDROID', 'IOS', 'MOBILE')
              OR UPPER(COALESCE(metadata->>'appType', '')) IN ('STUDENT', 'STAFF')
            )
          GROUP BY user_id
        `,
        this.prisma.mobileAppEvent.groupBy({
          by: ['userId'],
          where: {
            tenantId,
            eventType: 'LOGIN',
            appType: { in: COLLEGE_APP_TYPES },
            userId: { in: chunk },
          },
          _max: { occurredAt: true },
        }),
      ]);
      for (const row of sessions) {
        rememberLater(map, row.user_id, new Date(row.last_login));
      }
      for (const row of events) {
        if (row.userId && row._max.occurredAt) {
          rememberLater(map, row.userId, row._max.occurredAt);
        }
      }
    }
    return map;
  }

  private async loadStudents(
    tenantId: string,
    filters: {
      departmentId?: string;
      semester?: number;
      yearId?: string;
    },
  ): Promise<Candidate[]> {
    const where: Prisma.StudentWhereInput = {
      tenantId,
      deletedAt: null,
      AND: [
        {
          OR: [
            { masterProfile: { is: null } },
            {
              masterProfile: {
                is: { studentStatus: { notIn: inactiveStudentStatuses } },
              },
            },
          ],
        },
        {
          OR: [
            { academicStanding: { is: null } },
            {
              academicStanding: {
                is: {
                  lifecycleState: { notIn: inactiveLifecycles },
                  programmeStatus: { notIn: inactiveProgrammes },
                },
              },
            },
          ],
        },
      ],
    };
    if (filters.departmentId === UNASSIGNED_DEPARTMENT_ID) {
      where.departmentId = null;
    } else if (filters.departmentId) {
      where.departmentId = filters.departmentId;
    }
    if (filters.semester) {
      where.academicStanding = {
        is: { currentSemesterSequence: filters.semester },
      };
    }
    if (filters.yearId) {
      const yearClause: Prisma.StudentWhereInput = {
        OR: [
          { academicProfile: { is: { admissionYearId: filters.yearId } } },
          {
            semesterProgress: {
              some: {
                calendarSemester: {
                  is: { academicYearId: filters.yearId, deletedAt: null },
                },
              },
            },
          },
          {
            semesterRegistrations: {
              some: {
                semester: {
                  is: { academicYearId: filters.yearId, deletedAt: null },
                },
              },
            },
          },
        ],
      };
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), yearClause];
    }

    const rows = await this.prisma.student.findMany({
      where,
      select: {
        id: true,
        userId: true,
        rollNumber: true,
        enrollmentNumber: true,
        departmentId: true,
        department: { select: { name: true } },
        primaryShift: { select: { name: true, code: true } },
        academicStanding: { select: { currentSemesterSequence: true } },
        user: { select: { email: true, phone: true, displayName: true } },
        masterProfile: {
          select: { fullName: true, email: true, mobileNumber: true },
        },
      },
    });

    return rows.map((row) => {
      const semester = row.academicStanding?.currentSemesterSequence ?? null;
      const departmentId = row.departmentId ?? UNASSIGNED_DEPARTMENT_ID;
      return {
        shift: {
          name: row.primaryShift?.name,
          code: row.primaryShift?.code,
        },
        person: {
          id: `student:${row.id}`,
          userId: row.userId,
          category: 'STUDENT',
          categoryLabel: 'Student',
          name:
            row.masterProfile?.fullName?.trim() ||
            row.user.displayName?.trim() ||
            'Unknown',
          identifier: row.rollNumber?.trim() || row.enrollmentNumber,
          roleLabel: semester ? `Semester ${semester}` : 'Semester not set',
          email: row.user.email || row.masterProfile?.email || null,
          mobile: row.masterProfile?.mobileNumber || row.user.phone || null,
          departmentId,
          departmentName: row.department?.name?.trim() || 'Unassigned',
          shiftLabel: row.primaryShift?.name?.trim() || '—',
          semester,
          status: 'NOT_INSTALLED',
          lastLoginAt: null,
          lastActiveAt: null,
          serial: 0,
        },
      };
    });
  }

  private async loadStaff(
    tenantId: string,
    filters: { departmentId?: string; category: string },
  ): Promise<Candidate[]> {
    const where: Prisma.StaffProfileWhereInput = {
      tenantId,
      deletedAt: null,
      status: { in: ACTIVE_STAFF },
      OR: [{ relievingDate: null }, { relievingDate: { gte: new Date() } }],
    };
    if (filters.departmentId === UNASSIGNED_DEPARTMENT_ID) {
      where.departmentId = null;
    } else if (filters.departmentId) {
      where.departmentId = filters.departmentId;
    }
    const rows = await this.prisma.staffProfile.findMany({
      where,
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        mobile: true,
        email: true,
        publicEmail: true,
        staffType: true,
        teachingShiftCategory: true,
        departmentId: true,
        portalUserId: true,
        department: { select: { name: true } },
        primaryShift: { select: { name: true, code: true } },
        designation: { select: { label: true, category: true } },
        portalUser: { select: { email: true, phone: true } },
      },
    });
    return rows
      .filter((row) => {
        const kind = staffReportCategory(
          row.staffType,
          row.designation?.category,
        );
        if (filters.category === 'TEACHING') return kind === 'TEACHING';
        if (filters.category === 'NON_TEACHING') return kind === 'NON_TEACHING';
        return true;
      })
      .map((row) => {
        const kind = staffReportCategory(
          row.staffType,
          row.designation?.category,
        );
        const departmentId = row.departmentId ?? UNASSIGNED_DEPARTMENT_ID;
        return {
          shift: {
            name: row.primaryShift?.name,
            code: row.primaryShift?.code,
            category: row.teachingShiftCategory,
          },
          person: {
            id: `staff:${row.id}`,
            userId: row.portalUserId,
            category: kind,
            categoryLabel:
              kind === 'TEACHING' ? 'Teaching Staff' : 'Non-Teaching Staff',
            name: row.fullName?.trim() || 'Unknown',
            identifier: row.employeeCode,
            roleLabel:
              row.designation?.label?.trim() || titleCase(row.staffType),
            email:
              row.email || row.publicEmail || row.portalUser?.email || null,
            mobile: row.mobile || row.portalUser?.phone || null,
            departmentId,
            departmentName: row.department?.name?.trim() || 'Unassigned',
            shiftLabel:
              row.primaryShift?.name?.trim() ||
              titleCase(row.teachingShiftCategory || '') ||
              '—',
            semester: null,
            status: 'NOT_INSTALLED',
            lastLoginAt: null,
            lastActiveAt: null,
            serial: 0,
          },
        };
      });
  }
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function unique(ids: string[]) {
  return [...new Set(ids)];
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function rememberLater(map: Map<string, string>, userId: string, when: Date) {
  const next = when.toISOString();
  const current = map.get(userId);
  if (!current || next > current) map.set(userId, next);
}
