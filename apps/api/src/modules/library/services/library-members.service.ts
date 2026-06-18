import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { LibraryMemberQueryDto } from '../dto/library.dto';
import { LibraryFinesService } from './library-fines.service';

export type LibraryMemberListItem = {
  memberType: string;
  memberId: string;
  studentId?: string | null;
  staffProfileId?: string | null;
  fullName: string;
  registrationNumber?: string | null;
  department?: string | null;
  programme?: string | null;
  semester?: number | null;
  loanCount: number;
  visitCount: number;
  activeLoans: number;
  outstandingFine: number;
  lastVisitAt: string | null;
  readingScore: number;
};

@Injectable()
export class LibraryMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fines: LibraryFinesService,
  ) {}

  async listMembers(tenantId: string, query: LibraryMemberQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const search = query.search?.trim().toLowerCase();
    const memberTypeFilter = query.memberType?.toUpperCase();

    const [studentLoans, staffLoans, studentVisits, staffVisits] =
      await Promise.all([
        this.prisma.libraryLoan.groupBy({
          by: ['studentId'],
          where: { tenantId, studentId: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.libraryLoan.groupBy({
          by: ['staffProfileId'],
          where: { tenantId, staffProfileId: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.libraryVisit.groupBy({
          by: ['studentId'],
          where: { tenantId, studentId: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.libraryVisit.groupBy({
          by: ['staffProfileId'],
          where: {
            tenantId,
            staffProfileId: { not: null },
          },
          _count: { _all: true },
        }),
      ]);

    const map = new Map<
      string,
      {
        memberType: string;
        memberId: string;
        studentId?: string;
        staffProfileId?: string;
        loanCount: number;
        visitCount: number;
      }
    >();

    for (const row of studentLoans) {
      if (!row.studentId) continue;
      const key = `STUDENT:${row.studentId}`;
      const existing = map.get(key) ?? {
        memberType: 'STUDENT',
        memberId: row.studentId,
        studentId: row.studentId,
        loanCount: 0,
        visitCount: 0,
      };
      existing.loanCount = row._count._all;
      map.set(key, existing);
    }

    for (const row of staffLoans) {
      if (!row.staffProfileId) continue;
      const key = `STAFF:${row.staffProfileId}`;
      const existing = map.get(key) ?? {
        memberType: 'STAFF',
        memberId: row.staffProfileId,
        staffProfileId: row.staffProfileId,
        loanCount: 0,
        visitCount: 0,
      };
      existing.loanCount = row._count._all;
      map.set(key, existing);
    }

    for (const row of studentVisits) {
      if (!row.studentId) continue;
      const key = `STUDENT:${row.studentId}`;
      const existing = map.get(key) ?? {
        memberType: 'STUDENT',
        memberId: row.studentId,
        studentId: row.studentId,
        loanCount: 0,
        visitCount: 0,
      };
      existing.visitCount = row._count._all;
      map.set(key, existing);
    }

    for (const row of staffVisits) {
      if (!row.staffProfileId) continue;
      const key = `STAFF:${row.staffProfileId}`;
      const existing = map.get(key) ?? {
        memberType: 'STAFF',
        memberId: row.staffProfileId,
        staffProfileId: row.staffProfileId,
        loanCount: 0,
        visitCount: 0,
      };
      existing.visitCount = row._count._all;
      map.set(key, existing);
    }

    let entries = [...map.values()];
    if (memberTypeFilter) {
      entries = entries.filter((e) => e.memberType === memberTypeFilter);
    }

    const studentIds = entries
      .filter((e) => e.studentId)
      .map((e) => e.studentId!);
    const staffIds = entries
      .filter((e) => e.staffProfileId)
      .map((e) => e.staffProfileId!);

    const [students, staffProfiles, activeLoanCounts] = await Promise.all([
      studentIds.length
        ? this.prisma.student.findMany({
            where: { tenantId, id: { in: studentIds }, deletedAt: null },
            include: {
              masterProfile: { select: { fullName: true } },
              department: { select: { name: true } },
              programVersion: {
                include: { program: { select: { name: true } } },
              },
              academicStanding: { select: { currentSemesterSequence: true } },
            },
          })
        : [],
      staffIds.length
        ? this.prisma.staffProfile.findMany({
            where: { tenantId, id: { in: staffIds }, deletedAt: null },
            include: {
              department: { select: { name: true } },
            },
          })
        : [],
      this.prisma.libraryLoan.groupBy({
        by: ['studentId', 'staffProfileId'],
        where: { tenantId, status: 'ACTIVE' },
        _count: { _all: true },
      }),
    ]);

    const activeMap = new Map<string, number>();
    for (const row of activeLoanCounts) {
      if (row.studentId)
        activeMap.set(`STUDENT:${row.studentId}`, row._count._all);
      if (row.staffProfileId) {
        activeMap.set(`STAFF:${row.staffProfileId}`, row._count._all);
      }
    }

    const lastVisits = await this.prisma.libraryVisit.findMany({
      where: {
        tenantId,
        OR: [
          studentIds.length ? { studentId: { in: studentIds } } : {},
          staffIds.length ? { staffProfileId: { in: staffIds } } : {},
        ].filter((o) => Object.keys(o).length > 0),
      },
      orderBy: { entryAt: 'desc' },
      select: {
        studentId: true,
        staffProfileId: true,
        entryAt: true,
      },
      take: 500,
    });

    const lastVisitMap = new Map<string, Date>();
    for (const v of lastVisits) {
      const key = v.studentId
        ? `STUDENT:${v.studentId}`
        : v.staffProfileId
          ? `STAFF:${v.staffProfileId}`
          : null;
      if (key && !lastVisitMap.has(key)) lastVisitMap.set(key, v.entryAt);
    }

    let items: LibraryMemberListItem[] = await Promise.all(
      entries.map(async (entry) => {
        const key = `${entry.memberType}:${entry.memberId}`;
        if (entry.studentId) {
          const s = students.find((x) => x.id === entry.studentId);
          const fine = await this.fines.getUnpaidTotal(
            tenantId,
            entry.studentId,
          );
          const visitCount = entry.visitCount;
          const loanCount = entry.loanCount;
          return {
            memberType: 'STUDENT',
            memberId: entry.studentId,
            studentId: entry.studentId,
            fullName: s?.masterProfile?.fullName ?? 'Student',
            registrationNumber: s?.enrollmentNumber ?? null,
            department: s?.department?.name ?? null,
            programme: s?.programVersion?.program?.name ?? null,
            semester: s?.academicStanding?.currentSemesterSequence ?? null,
            loanCount,
            visitCount,
            activeLoans: activeMap.get(key) ?? 0,
            outstandingFine: fine,
            lastVisitAt: lastVisitMap.get(key)?.toISOString() ?? null,
            readingScore: Math.min(
              100,
              Math.round(visitCount * 4 + loanCount * 8 + 10),
            ),
          };
        }

        const sp = staffProfiles.find((x) => x.id === entry.staffProfileId);
        const fine = entry.staffProfileId
          ? await this.fines.getUnpaidTotalForStaff(
              tenantId,
              entry.staffProfileId,
            )
          : 0;
        const visitCount = entry.visitCount;
        const loanCount = entry.loanCount;
        return {
          memberType: entry.memberType,
          memberId: entry.staffProfileId!,
          staffProfileId: entry.staffProfileId,
          fullName: sp?.fullName ?? 'Staff',
          registrationNumber: sp?.employeeCode ?? null,
          department: sp?.department?.name ?? null,
          programme: null,
          semester: null,
          loanCount,
          visitCount,
          activeLoans: activeMap.get(key) ?? 0,
          outstandingFine: fine,
          lastVisitAt: lastVisitMap.get(key)?.toISOString() ?? null,
          readingScore: Math.min(
            100,
            Math.round(visitCount * 4 + loanCount * 8 + 10),
          ),
        };
      }),
    );

    if (search) {
      items = items.filter(
        (m) =>
          m.fullName.toLowerCase().includes(search) ||
          (m.registrationNumber?.toLowerCase().includes(search) ?? false) ||
          (m.department?.toLowerCase().includes(search) ?? false),
      );
    }

    items.sort(
      (a, b) =>
        b.loanCount + b.visitCount - (a.loanCount + a.visitCount) ||
        a.fullName.localeCompare(b.fullName),
    );

    const total = items.length;
    const start = (page - 1) * limit;
    return {
      items: items.slice(start, start + limit),
      total,
      page,
      limit,
    };
  }

  async getMemberDetail(
    tenantId: string,
    memberId: string,
    memberType: string,
  ) {
    const type = memberType.toUpperCase();
    const isStudent = type === 'STUDENT';

    if (isStudent) {
      const student = await this.prisma.student.findFirst({
        where: { tenantId, id: memberId, deletedAt: null },
        include: {
          masterProfile: true,
          department: { select: { name: true } },
          programVersion: {
            include: { program: { select: { name: true } } },
          },
          academicStanding: { select: { currentSemesterSequence: true } },
        },
      });
      if (!student) throw new NotFoundException('Member not found');
    } else {
      const staff = await this.prisma.staffProfile.findFirst({
        where: { tenantId, id: memberId, deletedAt: null },
        include: {
          department: { select: { name: true } },
        },
      });
      if (!staff) throw new NotFoundException('Member not found');
    }

    const memberWhere = isStudent
      ? { tenantId, studentId: memberId }
      : { tenantId, staffProfileId: memberId };

    const [loans, visits, visitCount, loanCount, activeLoans] =
      await Promise.all([
        this.prisma.libraryLoan.findMany({
          where: memberWhere,
          include: {
            copy: {
              include: { book: { select: { title: true, accessionNo: true } } },
            },
          },
          orderBy: { issuedAt: 'desc' },
          take: 20,
        }),
        this.prisma.libraryVisit.findMany({
          where: memberWhere,
          orderBy: { entryAt: 'desc' },
          take: 10,
        }),
        this.prisma.libraryVisit.count({ where: memberWhere }),
        this.prisma.libraryLoan.count({ where: memberWhere }),
        this.prisma.libraryLoan.count({
          where: { ...memberWhere, status: 'ACTIVE' },
        }),
      ]);

    const outstandingFine = isStudent
      ? await this.fines.getUnpaidTotal(tenantId, memberId)
      : await this.fines.getUnpaidTotalForStaff(tenantId, memberId);

    const list = await this.listMembers(tenantId, {
      page: 1,
      limit: 1000,
      memberType: type,
    });
    const summary = list.items.find((m) => m.memberId === memberId);

    return {
      profile: summary,
      stats: {
        visitCount,
        loanCount,
        activeLoans,
        outstandingFine,
        readingScore: summary?.readingScore ?? 0,
      },
      recentLoans: loans.map((l) => ({
        id: l.id,
        title: l.copy.book.title,
        accessionNo: l.copy.book.accessionNo,
        barcode: l.copy.barcode,
        issuedAt: l.issuedAt.toISOString(),
        dueAt: l.dueAt.toISOString(),
        returnedAt: l.returnedAt?.toISOString() ?? null,
        status: l.status,
      })),
      recentVisits: visits.map((v) => ({
        id: v.id,
        entryAt: v.entryAt.toISOString(),
        exitAt: v.exitAt?.toISOString() ?? null,
        durationMinutes: v.durationMinutes,
      })),
    };
  }
}
