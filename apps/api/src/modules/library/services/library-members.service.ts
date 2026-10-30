import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import {
  memberDirectoryCte,
  memberOrderSql,
  memberWhereSql,
  staffDerivedCase,
  staffKindCase,
  studentDerivedCase,
  studentKindCase,
  type MemberDirectoryFilters,
} from '../domain/library-member-directory';
import { BLOCK_REASONS } from '../domain/library-member-status.logic';
import { mergeCirculationPolicy } from '../domain/library-policy.types';
import type {
  LibraryMemberQueryDto,
  MemberBlockDto,
  MemberBulkDto,
  MemberPrivilegeDto,
  MemberUnblockDto,
} from '../dto/library.dto';
import { exportCatalogueReport } from '../reports/library-catalogue-report.export';
import { LibraryPolicyService } from './library-policy.service';
import { LibrarySettingsService } from './library-settings.service';

type DirectoryRow = {
  member_id: string;
  student_id: string | null;
  staff_profile_id: string | null;
  member_kind: string;
  full_name: string;
  member_code: string | null;
  roll_number: string | null;
  library_card: string | null;
  rfid: string | null;
  department: string | null;
  department_id: string | null;
  programme: string | null;
  designation: string | null;
  semester: number | null;
  academic_year: string | null;
  email: string | null;
  phone: string | null;
  photo_path: string | null;
  record_created_at: Date | string;
  derived_status: string;
  membership_id: string | null;
  display_status: string;
  block_reason: string | null;
  block_note: string | null;
  blocked_at: Date | string | null;
  blocked_by_id: string | null;
  loan_limit: number | null;
  loan_days: number | null;
  max_renewals: number | null;
  fine_exempt: boolean;
  expires_at: Date | string | null;
  membership_since: Date | string | null;
  synced_at: Date | string | null;
  active_loans: number;
  overdue_loans: number;
  total_loans: number;
  on_time_returns: number;
  visits: number;
  outstanding_fine: number | string;
  paid_fine: number | string;
  waived_fine: number | string;
  reading_score: number;
};

const EXPORT_CAP = 2000;

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function num(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapMember(row: DirectoryRow) {
  return {
    memberType: row.member_kind,
    memberId: row.member_id,
    studentId: row.student_id,
    staffProfileId: row.staff_profile_id,
    fullName: row.full_name,
    registrationNumber: row.member_code,
    rollNumber: row.roll_number,
    libraryCardNumber: row.library_card,
    rfid: row.rfid,
    department: row.department,
    departmentId: row.department_id,
    programme: row.programme,
    designation: row.designation,
    semester: row.semester,
    academicYear: row.academic_year,
    email: row.email,
    phone: row.phone,
    photoPath: row.photo_path,
    loanCount: num(row.total_loans),
    visitCount: num(row.visits),
    activeLoans: num(row.active_loans),
    overdueLoans: num(row.overdue_loans),
    outstandingFine: num(row.outstanding_fine),
    paidFine: num(row.paid_fine),
    waivedFine: num(row.waived_fine),
    onTimeReturns: num(row.on_time_returns),
    lastVisitAt: null as string | null,
    readingScore: num(row.reading_score),
    status: row.display_status,
    derivedStatus: row.derived_status,
    blockReason: row.block_reason,
    blockNote: row.block_note,
    blockedAt: iso(row.blocked_at),
    fineExempt: Boolean(row.fine_exempt),
    loanLimit: row.loan_limit,
    loanDays: row.loan_days,
    maxRenewals: row.max_renewals,
    expiresAt: iso(row.expires_at),
    recordCreatedAt: iso(row.record_created_at),
    membershipSince: iso(row.membership_since),
    syncedAt: iso(row.synced_at),
    membershipId: row.membership_id,
  };
}

function filtersFromQuery(
  query: LibraryMemberQueryDto,
): MemberDirectoryFilters {
  return {
    search: query.search,
    tab: query.tab,
    departmentId: query.departmentId,
    semester: query.semester,
    academicYear: query.academicYear,
    status: query.status?.toUpperCase(),
    hasOverdue: query.hasOverdue === 'true',
    hasFine: query.hasFine === 'true',
    hasActiveLoans: query.hasActiveLoans === 'true',
    hasBorrowed: query.hasBorrowed === 'true',
    sort: query.sort,
    sortDir: query.sortDir,
  };
}

@Injectable()
export class LibraryMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: LibrarySettingsService,
    private readonly policy: LibraryPolicyService,
  ) {}

  async listMembers(tenantId: string, query: LibraryMemberQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const filters = filtersFromQuery(query);
    const where = memberWhereSql(filters);
    const order = memberOrderSql(filters.sort, filters.sortDir);
    const directory = memberDirectoryCte(tenantId);
    const [rows, counts] = await Promise.all([
      this.prisma.$queryRaw<DirectoryRow[]>`
        ${directory}
        SELECT * FROM scored
        WHERE ${where}
        ORDER BY ${order}
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `,
      this.prisma.$queryRaw<{ count: number }[]>`
        ${directory}
        SELECT COUNT(*)::int AS count FROM scored WHERE ${where}
      `,
    ]);
    return {
      items: rows.map(mapMember),
      total: counts[0]?.count ?? 0,
      page,
      limit,
    };
  }

  async summary(tenantId: string) {
    const directory = memberDirectoryCte(tenantId);
    const [counts, departments, years, semesters, lastSync, settings] =
      await Promise.all([
        this.prisma.$queryRaw<
          {
            total: number;
            active_students: number;
            active_faculty: number;
            active_staff: number;
            research_scholars: number;
            students: number;
            faculty: number;
            staff: number;
            inactive: number;
            blocked: number;
            overdue_members: number;
            fine_members: number;
            readers: number;
          }[]
        >`
          ${directory}
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE member_kind = 'STUDENT' AND display_status = 'ACTIVE')::int AS active_students,
            COUNT(*) FILTER (WHERE member_kind = 'FACULTY' AND display_status = 'ACTIVE')::int AS active_faculty,
            COUNT(*) FILTER (WHERE member_kind = 'STAFF' AND display_status = 'ACTIVE')::int AS active_staff,
            COUNT(*) FILTER (WHERE member_kind = 'RESEARCH_SCHOLAR')::int AS research_scholars,
            COUNT(*) FILTER (WHERE member_kind = 'STUDENT')::int AS students,
            COUNT(*) FILTER (WHERE member_kind = 'FACULTY')::int AS faculty,
            COUNT(*) FILTER (WHERE member_kind = 'STAFF')::int AS staff,
            COUNT(*) FILTER (WHERE display_status = 'INACTIVE')::int AS inactive,
            COUNT(*) FILTER (WHERE display_status = 'BLOCKED')::int AS blocked,
            COUNT(*) FILTER (WHERE overdue_loans > 0)::int AS overdue_members,
            COUNT(*) FILTER (WHERE outstanding_fine > 0)::int AS fine_members,
            COUNT(*) FILTER (WHERE total_loans > 0)::int AS readers
          FROM scored
        `,
        this.prisma.$queryRaw<{ id: string; name: string }[]>`
          ${directory}
          SELECT DISTINCT department_id AS id, department AS name
          FROM scored
          WHERE department_id IS NOT NULL AND department IS NOT NULL
          ORDER BY department
        `,
        this.prisma.$queryRaw<{ name: string }[]>`
          ${directory}
          SELECT DISTINCT academic_year AS name
          FROM scored
          WHERE academic_year IS NOT NULL AND academic_year <> ''
          ORDER BY academic_year DESC
        `,
        this.prisma.$queryRaw<{ semester: number }[]>`
          ${directory}
          SELECT DISTINCT semester
          FROM scored
          WHERE semester IS NOT NULL
          ORDER BY semester
        `,
        this.prisma.libraryMemberSyncRun.findFirst({
          where: { tenantId },
          orderBy: { startedAt: 'desc' },
        }),
        this.settings.getSettings(tenantId),
      ]);
    const row = counts[0];
    const policy = mergeCirculationPolicy(settings.circulationPolicy);
    return {
      total: row?.total ?? 0,
      activeStudents: row?.active_students ?? 0,
      activeFaculty: row?.active_faculty ?? 0,
      activeStaff: row?.active_staff ?? 0,
      researchScholars: row?.research_scholars ?? 0,
      inactive: row?.inactive ?? 0,
      blocked: row?.blocked ?? 0,
      overdueMembers: row?.overdue_members ?? 0,
      fineMembers: row?.fine_members ?? 0,
      readers: row?.readers ?? 0,
      tabs: {
        all: row?.total ?? 0,
        students: row?.students ?? 0,
        faculty: row?.faculty ?? 0,
        staff: row?.staff ?? 0,
        researchScholars: row?.research_scholars ?? 0,
        inactive: row?.inactive ?? 0,
        blocked: row?.blocked ?? 0,
      },
      departments,
      academicYears: years.map((year) => year.name),
      semesters: semesters.map((item) => item.semester),
      roleDefaults: {
        student: policy.student,
        faculty: policy.faculty,
        staff: policy.staff,
        researchScholar: policy.researchScholar,
      },
      lastSync: lastSync
        ? {
            id: lastSync.id,
            scope: lastSync.scope,
            createdCount: lastSync.createdCount,
            updatedCount: lastSync.updatedCount,
            skippedCount: lastSync.skippedCount,
            failedCount: lastSync.failedCount,
            errors: lastSync.errors,
            startedAt: lastSync.startedAt.toISOString(),
            completedAt: lastSync.completedAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  async getMemberDetail(
    tenantId: string,
    memberId: string,
    memberType: string,
    loans: 'recent' | 'all' = 'recent',
  ) {
    const directory = memberDirectoryCte(tenantId, memberId);
    const rows = await this.prisma.$queryRaw<DirectoryRow[]>`
      ${directory}
      SELECT * FROM scored
      WHERE member_kind = ${memberType.toUpperCase()}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException('Member not found');
    const profile = mapMember(row);
    const memberWhere = row.student_id
      ? { tenantId, studentId: row.student_id }
      : { tenantId, staffProfileId: row.staff_profile_id! };
    const take = loans === 'all' ? 200 : 12;
    const [loanRows, fineRows, visits, subjects, months, events] =
      await Promise.all([
        this.prisma.libraryLoan.findMany({
          where: memberWhere,
          include: {
            copy: {
              include: {
                book: {
                  select: {
                    title: true,
                    accessionNo: true,
                    subject: true,
                    category: { select: { name: true } },
                  },
                },
              },
            },
          },
          orderBy: { issuedAt: 'desc' },
          take,
        }),
        this.prisma.libraryFine.findMany({
          where: { tenantId, loan: memberWhere },
          orderBy: { createdAt: 'desc' },
          take: 40,
          include: {
            loan: {
              include: {
                copy: { include: { book: { select: { title: true } } } },
              },
            },
          },
        }),
        this.prisma.libraryVisit.findMany({
          where: memberWhere,
          orderBy: { entryAt: 'desc' },
          take: 12,
        }),
        this.subjectCounts(tenantId, row),
        this.monthlyLoans(tenantId, row),
        row.membership_id
          ? this.prisma.libraryMembershipEvent.findMany({
              where: { tenantId, membershipId: row.membership_id },
              orderBy: { createdAt: 'desc' },
              take: 30,
            })
          : Promise.resolve([]),
      ]);
    const actorIds = [
      ...new Set(
        [row.blocked_by_id, ...events.map((event) => event.actorId)].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, displayName: true, email: true },
        })
      : [];
    const actorName = new Map(
      actors.map((actor) => [actor.id, actor.displayName || actor.email]),
    );
    const settings = await this.settings.getSettings(tenantId);
    const circulation = mergeCirculationPolicy(settings.circulationPolicy);
    const role = this.policy.memberRoleKey(row.member_kind);
    const defaults = circulation[role];
    const roleDefaults =
      'maxRenewals' in defaults
        ? {
            loanDays: defaults.loanDays,
            maxBooks: defaults.maxBooks,
            maxRenewals: defaults.maxRenewals,
          }
        : null;
    const now = new Date();
    return {
      profile,
      stats: {
        visitCount: profile.visitCount,
        loanCount: profile.loanCount,
        activeLoans: profile.activeLoans,
        overdueLoans: profile.overdueLoans,
        outstandingFine: profile.outstandingFine,
        paidFine: profile.paidFine,
        waivedFine: profile.waivedFine,
        readingScore: profile.readingScore,
      },
      roleDefaults,
      recentLoans: loanRows.map((loan) => ({
        id: loan.id,
        title: loan.copy.book.title,
        accessionNo: loan.copy.accessionNumber || loan.copy.book.accessionNo,
        barcode: loan.copy.barcode,
        subject:
          loan.copy.book.subject || loan.copy.book.category?.name || null,
        issuedAt: loan.issuedAt.toISOString(),
        dueAt: loan.dueAt.toISOString(),
        returnedAt: loan.returnedAt?.toISOString() ?? null,
        renewalCount: loan.renewalCount,
        status: loan.status,
        overdue: loan.status === 'ACTIVE' && loan.dueAt < now,
      })),
      loansTruncated: loans !== 'all' && profile.loanCount > loanRows.length,
      fines: fineRows.map((fine) => ({
        id: fine.id,
        title: fine.loan.copy.book.title,
        amount: Number(fine.amount),
        reason: fine.reason,
        status: fine.waivedAt ? 'WAIVED' : fine.paidAt ? 'PAID' : 'UNPAID',
        createdAt: fine.createdAt.toISOString(),
        paidAt: fine.paidAt?.toISOString() ?? null,
        waivedAt: fine.waivedAt?.toISOString() ?? null,
        waiveReason: fine.waiveReason,
      })),
      recentVisits: visits.map((visit) => ({
        id: visit.id,
        entryAt: visit.entryAt.toISOString(),
        exitAt: visit.exitAt?.toISOString() ?? null,
        durationMinutes: visit.durationMinutes,
      })),
      subjects,
      monthlyLoans: months,
      events: events.map((event) => ({
        id: event.id,
        action: event.action,
        reason: event.reason,
        note: event.note,
        actor: event.actorId ? (actorName.get(event.actorId) ?? null) : null,
        createdAt: event.createdAt.toISOString(),
      })),
      blockedBy: row.blocked_by_id
        ? (actorName.get(row.blocked_by_id) ?? null)
        : null,
    };
  }

  async sync(
    tenantId: string,
    scope: string,
    actorId?: string | null,
    selected?: { studentIds: string[]; staffIds: string[] },
  ) {
    const run = await this.prisma.libraryMemberSyncRun.create({
      data: {
        id: randomUUID(),
        tenantId,
        scope: selected ? 'SELECTED' : scope,
        actorId: actorId ?? null,
        errors: [],
      },
    });
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: { message: string }[] = [];
    const wantStudents = !selected && (scope === 'ALL' || scope === 'STUDENTS');
    const wantFaculty = !selected && (scope === 'ALL' || scope === 'FACULTY');
    const wantStaff = !selected && (scope === 'ALL' || scope === 'STAFF');
    const tasks: Promise<void>[] = [];
    if (wantStudents || selected?.studentIds.length) {
      tasks.push(
        this.syncStudents(tenantId, selected?.studentIds)
          .then((result) => {
            created += result.created;
            updated += result.updated;
            skipped += result.skipped;
          })
          .catch((error: unknown) => {
            failed += 1;
            errors.push({ message: errorText(error) });
          }),
      );
    }
    if (wantFaculty || wantStaff || selected?.staffIds.length) {
      const staffScope = selected
        ? 'ALL'
        : scope === 'FACULTY'
          ? 'FACULTY'
          : scope === 'STAFF'
            ? 'STAFF'
            : 'ALL';
      tasks.push(
        this.syncStaff(tenantId, staffScope, selected?.staffIds)
          .then((result) => {
            created += result.created;
            updated += result.updated;
            skipped += result.skipped;
          })
          .catch((error: unknown) => {
            failed += 1;
            errors.push({ message: errorText(error) });
          }),
      );
    }
    await Promise.all(tasks);
    const completed = await this.prisma.libraryMemberSyncRun.update({
      where: { id: run.id },
      data: {
        createdCount: created,
        updatedCount: updated,
        skippedCount: skipped,
        failedCount: failed,
        errors,
        completedAt: new Date(),
      },
    });
    await this.prisma.libraryAuditLog.create({
      data: {
        id: randomUUID(),
        tenantId,
        actorId: actorId ?? null,
        action: 'MEMBER_SYNC',
        entityType: 'MEMBERSHIP',
        metadata: {
          scope: completed.scope,
          created,
          updated,
          skipped,
          failed,
        },
      },
    });
    return {
      id: completed.id,
      scope: completed.scope,
      createdCount: created,
      updatedCount: updated,
      skippedCount: skipped,
      failedCount: failed,
      errors,
      startedAt: completed.startedAt.toISOString(),
      completedAt: completed.completedAt?.toISOString() ?? null,
    };
  }

  async blockMember(
    tenantId: string,
    memberId: string,
    actorId: string | undefined,
    dto: MemberBlockDto,
  ) {
    this.assertReason(dto.reason);
    const row = await this.requireRow(tenantId, memberId, dto.memberType);
    const membership = await this.ensureMembership(tenantId, row);
    const before = membershipSnapshot(membership);
    const updated = await this.prisma.libraryMembership.update({
      where: { id: membership.id },
      data: {
        status: 'BLOCKED',
        blockReason: dto.reason,
        blockNote: dto.note?.trim() || null,
        blockedAt: new Date(),
        blockedById: actorId ?? null,
      },
    });
    await this.recordChange(
      tenantId,
      updated.id,
      actorId,
      'BLOCK',
      dto.reason,
      dto.note,
      before,
      membershipSnapshot(updated),
    );
    return mapMember({ ...row, ...overlayFromMembership(updated, row) });
  }

  async unblockMember(
    tenantId: string,
    memberId: string,
    actorId: string | undefined,
    dto: MemberUnblockDto,
  ) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('A reason is required to remove a block');
    }
    const row = await this.requireRow(tenantId, memberId, dto.memberType);
    const membership = await this.ensureMembership(tenantId, row);
    const before = membershipSnapshot(membership);
    const updated = await this.prisma.libraryMembership.update({
      where: { id: membership.id },
      data: {
        status: row.derived_status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        blockReason: null,
        blockNote: null,
        blockedAt: null,
        blockedById: null,
      },
    });
    await this.recordChange(
      tenantId,
      updated.id,
      actorId,
      'UNBLOCK',
      dto.reason.trim(),
      null,
      before,
      membershipSnapshot(updated),
    );
    return mapMember({ ...row, ...overlayFromMembership(updated, row) });
  }

  async updatePrivileges(
    tenantId: string,
    memberId: string,
    actorId: string | undefined,
    dto: MemberPrivilegeDto,
  ) {
    const row = await this.requireRow(tenantId, memberId, dto.memberType);
    const membership = await this.ensureMembership(tenantId, row);
    const before = membershipSnapshot(membership);
    const data: Prisma.LibraryMembershipUpdateInput = {};
    if (dto.loanLimit !== undefined) data.loanLimit = dto.loanLimit;
    if (dto.loanDays !== undefined) data.loanDays = dto.loanDays;
    if (dto.maxRenewals !== undefined) data.maxRenewals = dto.maxRenewals;
    if (dto.fineExempt !== undefined) data.fineExempt = dto.fineExempt;
    if (dto.expiresAt !== undefined) {
      data.expiresAt = dto.expiresAt ? parseDate(dto.expiresAt) : null;
    }
    const updated = await this.prisma.libraryMembership.update({
      where: { id: membership.id },
      data,
    });
    await this.recordChange(
      tenantId,
      updated.id,
      actorId,
      'PRIVILEGE',
      null,
      null,
      before,
      membershipSnapshot(updated),
    );
    return mapMember({ ...row, ...overlayFromMembership(updated, row) });
  }

  async bulk(
    tenantId: string,
    actorId: string | undefined,
    dto: MemberBulkDto,
  ) {
    if (dto.action === 'BLOCK' && !dto.reason) {
      throw new BadRequestException('A block reason is required');
    }
    if (dto.action === 'SYNC') {
      const studentIds = dto.members
        .filter(
          (member) =>
            member.memberType === 'STUDENT' ||
            member.memberType === 'RESEARCH_SCHOLAR',
        )
        .map((member) => member.memberId);
      const staffIds = dto.members
        .filter(
          (member) =>
            member.memberType === 'FACULTY' ||
            member.memberType === 'STAFF' ||
            member.memberType === 'RESEARCH_SCHOLAR',
        )
        .map((member) => member.memberId);
      return this.sync(tenantId, 'SELECTED', actorId, { studentIds, staffIds });
    }
    let processed = 0;
    const failed: { memberId: string; message: string }[] = [];
    for (const member of dto.members) {
      try {
        if (dto.action === 'BLOCK') {
          await this.blockMember(tenantId, member.memberId, actorId, {
            memberType: member.memberType,
            reason: dto.reason!,
            note: dto.note,
          });
        } else if (dto.action === 'UNBLOCK' || dto.action === 'ACTIVATE') {
          await this.unblockMember(tenantId, member.memberId, actorId, {
            memberType: member.memberType,
            reason: dto.reason?.trim() || 'Bulk activate',
          });
        } else if (dto.action === 'EXPIRY') {
          await this.updatePrivileges(tenantId, member.memberId, actorId, {
            memberType: member.memberType,
            expiresAt: dto.expiresAt ?? null,
          });
        }
        processed += 1;
      } catch (error) {
        failed.push({ memberId: member.memberId, message: errorText(error) });
      }
    }
    await this.prisma.libraryAuditLog.create({
      data: {
        id: randomUUID(),
        tenantId,
        actorId: actorId ?? null,
        action: 'MEMBER_BULK',
        entityType: 'MEMBERSHIP',
        metadata: {
          action: dto.action,
          processed,
          failed: failed.length,
          reason: dto.reason ?? null,
        },
      },
    });
    return { processed, failed };
  }

  async exportRegister(tenantId: string, query: LibraryMemberQueryDto) {
    const format = query.format;
    if (format !== 'csv' && format !== 'xlsx' && format !== 'pdf') {
      throw new BadRequestException('Choose csv, xlsx, or pdf');
    }
    const filters = filtersFromQuery(query);
    const where = memberWhereSql(filters);
    const order = memberOrderSql(filters.sort, filters.sortDir);
    const directory = memberDirectoryCte(tenantId);
    const [rows, counts, institution] = await Promise.all([
      this.prisma.$queryRaw<DirectoryRow[]>`
        ${directory}
        SELECT * FROM scored
        WHERE ${where}
        ORDER BY ${order}
        LIMIT ${EXPORT_CAP}
      `,
      this.prisma.$queryRaw<{ count: number }[]>`
        ${directory}
        SELECT COUNT(*)::int AS count FROM scored WHERE ${where}
      `,
      this.prisma.institution.findFirst({
        where: { tenantId, deletedAt: null },
        select: { name: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const total = counts[0]?.count ?? rows.length;
    const payload = {
      key: 'library-members',
      title: 'Library member register',
      institutionName: institution?.name?.trim() || 'College',
      generatedAt: new Date().toISOString(),
      filters: describeFilters(filters),
      notes: [
        'Names, departments, and contact details come from student and staff records.',
        'Reading score uses visits, loans, on-time returns, and active membership.',
        total > rows.length
          ? `Showing the first ${rows.length} of ${total} matching members.`
          : `${total} matching members.`,
      ],
      columns: [
        { key: 'name', label: 'Member', text: true },
        { key: 'code', label: 'Member ID', text: true },
        { key: 'type', label: 'Type', text: true },
        { key: 'department', label: 'Department', text: true },
        { key: 'loans', label: 'Active loans' },
        { key: 'overdue', label: 'Overdue' },
        { key: 'fine', label: 'Outstanding fine' },
        { key: 'score', label: 'Reading score' },
        { key: 'status', label: 'Status', text: true },
      ],
      rows: rows.map((row) => ({
        name: row.full_name,
        code: row.member_code,
        type: row.member_kind,
        department: row.department,
        loans: num(row.active_loans),
        overdue: num(row.overdue_loans),
        fine: num(row.outstanding_fine),
        score: num(row.reading_score),
        status: row.display_status,
      })),
      total,
      page: 1,
      limit: rows.length,
      totals: {},
      formal: false,
    };
    const file = await exportCatalogueReport(payload, format);
    return {
      buffer: file.body,
      contentType: file.contentType,
      filename: `library-members.${file.extension}`,
    };
  }

  private async requireRow(
    tenantId: string,
    memberId: string,
    memberType: string,
  ) {
    const directory = memberDirectoryCte(tenantId, memberId);
    const rows = await this.prisma.$queryRaw<DirectoryRow[]>`
      ${directory}
      SELECT * FROM scored
      WHERE member_kind = ${memberType.toUpperCase()}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException('Member not found');
    return row;
  }

  private async ensureMembership(tenantId: string, row: DirectoryRow) {
    if (row.membership_id) {
      const existing = await this.prisma.libraryMembership.findFirst({
        where: { id: row.membership_id, tenantId },
      });
      if (existing) return existing;
    }
    return this.prisma.libraryMembership.create({
      data: {
        id: randomUUID(),
        tenantId,
        studentId: row.student_id,
        staffProfileId: row.staff_profile_id,
        memberKind: row.member_kind,
        status: row.derived_status,
        syncedAt: new Date(),
      },
    });
  }

  private async recordChange(
    tenantId: string,
    membershipId: string,
    actorId: string | undefined,
    action: string,
    reason: string | null | undefined,
    note: string | null | undefined,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ) {
    await this.prisma.libraryMembershipEvent.create({
      data: {
        id: randomUUID(),
        tenantId,
        membershipId,
        action,
        reason: reason ?? null,
        note: note?.trim() || null,
        actorId: actorId ?? null,
        before: before as Prisma.InputJsonValue,
        after: after as Prisma.InputJsonValue,
      },
    });
    await this.prisma.libraryAuditLog.create({
      data: {
        id: randomUUID(),
        tenantId,
        actorId: actorId ?? null,
        action: `MEMBER_${action}`,
        entityType: 'MEMBERSHIP',
        entityId: membershipId,
        before: before as Prisma.InputJsonValue,
        after: after as Prisma.InputJsonValue,
      },
    });
  }

  private assertReason(reason: string) {
    if (!(BLOCK_REASONS as readonly string[]).includes(reason)) {
      throw new BadRequestException('Choose a block reason');
    }
  }

  private async syncStudents(tenantId: string, ids?: string[]) {
    if (ids && ids.length === 0) return { created: 0, updated: 0, skipped: 0 };
    const tenant = Prisma.sql`CAST(${tenantId} AS uuid)`;
    const idFilter = ids?.length
      ? Prisma.sql`AND s.id IN (${Prisma.join(ids.map((id) => Prisma.sql`CAST(${id} AS uuid)`))})`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      { source_count: number; created_count: number; updated_count: number }[]
    >`
      WITH src AS (
        SELECT s.id AS student_id,
          ${studentKindCase()} AS member_kind,
          ${studentDerivedCase()} AS derived_status
        FROM academic.students s
        LEFT JOIN academic.student_profiles sp ON sp.student_id = s.id
        LEFT JOIN academic.student_academic_standings st ON st.student_id = s.id
        LEFT JOIN academic.program_versions pv ON pv.id = s.program_version_id
        LEFT JOIN academic.programs p ON p.id = pv.program_id
        WHERE s.tenant_id = ${tenant}
          AND s.deleted_at IS NULL
          ${idFilter}
      ),
      ins AS (
        INSERT INTO library.library_memberships (
          id, tenant_id, student_id, staff_profile_id, member_kind, status,
          fine_exempt, synced_at, created_at, updated_at
        )
        SELECT gen_random_uuid(), ${tenant}, src.student_id, NULL, src.member_kind,
          src.derived_status, false, NOW(), NOW(), NOW()
        FROM src
        WHERE NOT EXISTS (
          SELECT 1 FROM library.library_memberships m
          WHERE m.tenant_id = ${tenant} AND m.student_id = src.student_id
        )
        RETURNING student_id
      ),
      upd AS (
        UPDATE library.library_memberships m
        SET member_kind = src.member_kind,
          status = CASE WHEN m.status = 'BLOCKED' THEN 'BLOCKED' ELSE src.derived_status END,
          synced_at = NOW(),
          updated_at = NOW()
        FROM src
        WHERE m.tenant_id = ${tenant}
          AND m.student_id = src.student_id
          AND (
            m.member_kind IS DISTINCT FROM src.member_kind
            OR (m.status <> 'BLOCKED' AND m.status IS DISTINCT FROM src.derived_status)
          )
        RETURNING m.id
      )
      SELECT
        (SELECT COUNT(*)::int FROM src) AS source_count,
        (SELECT COUNT(*)::int FROM ins) AS created_count,
        (SELECT COUNT(*)::int FROM upd) AS updated_count
    `;
    return tally(rows[0]);
  }

  private async syncStaff(tenantId: string, scope: string, ids?: string[]) {
    if (ids && ids.length === 0) return { created: 0, updated: 0, skipped: 0 };
    const tenant = Prisma.sql`CAST(${tenantId} AS uuid)`;
    const scopeFilter =
      scope === 'FACULTY'
        ? Prisma.sql`AND upper(coalesce(sf.staff_type, '')) = 'TEACHING'`
        : scope === 'STAFF'
          ? Prisma.sql`AND upper(coalesce(sf.staff_type, '')) <> 'TEACHING'`
          : Prisma.empty;
    const idFilter = ids?.length
      ? Prisma.sql`AND sf.id IN (${Prisma.join(ids.map((id) => Prisma.sql`CAST(${id} AS uuid)`))})`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      { source_count: number; created_count: number; updated_count: number }[]
    >`
      WITH src AS (
        SELECT sf.id AS staff_profile_id,
          ${staffKindCase()} AS member_kind,
          ${staffDerivedCase()} AS derived_status
        FROM academic.staff_profiles sf
        LEFT JOIN core.designations dg ON dg.id = sf.designation_id
        WHERE sf.tenant_id = ${tenant}
          AND sf.deleted_at IS NULL
          ${scopeFilter}
          ${idFilter}
      ),
      ins AS (
        INSERT INTO library.library_memberships (
          id, tenant_id, student_id, staff_profile_id, member_kind, status,
          fine_exempt, synced_at, created_at, updated_at
        )
        SELECT gen_random_uuid(), ${tenant}, NULL, src.staff_profile_id, src.member_kind,
          src.derived_status, false, NOW(), NOW(), NOW()
        FROM src
        WHERE NOT EXISTS (
          SELECT 1 FROM library.library_memberships m
          WHERE m.tenant_id = ${tenant} AND m.staff_profile_id = src.staff_profile_id
        )
        RETURNING staff_profile_id
      ),
      upd AS (
        UPDATE library.library_memberships m
        SET member_kind = src.member_kind,
          status = CASE WHEN m.status = 'BLOCKED' THEN 'BLOCKED' ELSE src.derived_status END,
          synced_at = NOW(),
          updated_at = NOW()
        FROM src
        WHERE m.tenant_id = ${tenant}
          AND m.staff_profile_id = src.staff_profile_id
          AND (
            m.member_kind IS DISTINCT FROM src.member_kind
            OR (m.status <> 'BLOCKED' AND m.status IS DISTINCT FROM src.derived_status)
          )
        RETURNING m.id
      )
      SELECT
        (SELECT COUNT(*)::int FROM src) AS source_count,
        (SELECT COUNT(*)::int FROM ins) AS created_count,
        (SELECT COUNT(*)::int FROM upd) AS updated_count
    `;
    return tally(rows[0]);
  }

  private async subjectCounts(tenantId: string, row: DirectoryRow) {
    const tenant = Prisma.sql`CAST(${tenantId} AS uuid)`;
    const person = row.student_id
      ? Prisma.sql`l.student_id = CAST(${row.student_id} AS uuid)`
      : Prisma.sql`l.staff_profile_id = CAST(${row.staff_profile_id} AS uuid)`;
    return this.prisma.$queryRaw<{ subject: string; count: number }[]>`
      SELECT COALESCE(NULLIF(b.subject, ''), NULLIF(c.name, ''), 'Unclassified') AS subject,
        COUNT(*)::int AS count
      FROM library.library_loans l
      JOIN library.library_book_copies cp ON cp.id = l.copy_id
      JOIN library.library_books b ON b.id = cp.book_id
      LEFT JOIN library.library_categories c ON c.id = b.category_id
      WHERE l.tenant_id = ${tenant} AND ${person}
      GROUP BY 1
      ORDER BY count DESC, subject
      LIMIT 5
    `;
  }

  private async monthlyLoans(tenantId: string, row: DirectoryRow) {
    const tenant = Prisma.sql`CAST(${tenantId} AS uuid)`;
    const person = row.student_id
      ? Prisma.sql`student_id = CAST(${row.student_id} AS uuid)`
      : Prisma.sql`staff_profile_id = CAST(${row.staff_profile_id} AS uuid)`;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    return this.prisma.$queryRaw<{ month: string; count: number }[]>`
      SELECT to_char(issued_at AT TIME ZONE ${timeZone}, 'YYYY-MM') AS month,
        COUNT(*)::int AS count
      FROM library.library_loans
      WHERE tenant_id = ${tenant}
        AND ${person}
        AND issued_at >= NOW() - INTERVAL '6 months'
      GROUP BY 1
      ORDER BY 1
    `;
  }
}

function tally(row?: {
  source_count: number;
  created_count: number;
  updated_count: number;
}) {
  const source = row?.source_count ?? 0;
  const created = row?.created_count ?? 0;
  const updated = row?.updated_count ?? 0;
  return {
    created,
    updated,
    skipped: Math.max(0, source - created - updated),
  };
}

function errorText(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 300);
  return 'Sync failed';
}

function parseDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Enter a valid expiry date');
  }
  return date;
}

function membershipSnapshot(row: {
  status: string;
  memberKind: string;
  blockReason: string | null;
  loanLimit: number | null;
  loanDays: number | null;
  maxRenewals: number | null;
  fineExempt: boolean;
  expiresAt: Date | null;
}) {
  return {
    status: row.status,
    memberKind: row.memberKind,
    blockReason: row.blockReason,
    loanLimit: row.loanLimit,
    loanDays: row.loanDays,
    maxRenewals: row.maxRenewals,
    fineExempt: row.fineExempt,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

function overlayFromMembership(
  membership: {
    id: string;
    status: string;
    blockReason: string | null;
    blockNote: string | null;
    blockedAt: Date | null;
    loanLimit: number | null;
    loanDays: number | null;
    maxRenewals: number | null;
    fineExempt: boolean;
    expiresAt: Date | null;
    createdAt: Date;
    syncedAt: Date | null;
  },
  row: DirectoryRow,
): Partial<DirectoryRow> {
  return {
    membership_id: membership.id,
    display_status:
      membership.status === 'BLOCKED' ? 'BLOCKED' : row.derived_status,
    block_reason: membership.blockReason,
    block_note: membership.blockNote,
    blocked_at: membership.blockedAt,
    loan_limit: membership.loanLimit,
    loan_days: membership.loanDays,
    max_renewals: membership.maxRenewals,
    fine_exempt: membership.fineExempt,
    expires_at: membership.expiresAt,
    membership_since: membership.createdAt,
    synced_at: membership.syncedAt,
  };
}

function describeFilters(filters: MemberDirectoryFilters) {
  const parts = [
    filters.tab && filters.tab !== 'ALL' ? `Tab ${filters.tab}` : null,
    filters.status ? `Status ${filters.status}` : null,
    filters.search ? `Search ${filters.search}` : null,
    filters.academicYear ? `Year ${filters.academicYear}` : null,
    filters.semester != null ? `Semester ${filters.semester}` : null,
    filters.hasOverdue ? 'Overdue books' : null,
    filters.hasFine ? 'Outstanding fines' : null,
    filters.hasActiveLoans ? 'Books currently issued' : null,
    filters.hasBorrowed ? 'Has borrowed' : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'All members on record';
}
