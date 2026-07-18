import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import { PrismaService } from '../../../database/prisma.service';

const ACTIVE_REGISTRATION_STATUSES = [
  'submitted',
  'pending_approval',
  'approved',
  'completed',
  'confirmed',
];

export type BirthdayStudentRow = {
  studentId: string;
  userId: string;
  fullName: string;
  email: string | null;
  photoPath: string | null;
  programVersionId: string | null;
  departmentId: string | null;
  primaryShiftId: string | null;
  departmentName: string | null;
  programName: string | null;
};

export type BirthdayStaffRow = {
  staffProfileId: string;
  portalUserId: string;
  fullName: string;
  email: string | null;
  photoUrl: string | null;
  departmentId: string | null;
  departmentName: string | null;
};

export type BirthdayPeerRow = {
  studentId: string;
  userId: string;
  displayName: string;
  email: string | null;
};

export type BirthdayColleagueRow = {
  staffProfileId: string;
  portalUserId: string;
  displayName: string;
  email: string | null;
};

export type BirthdayWidgetPerson = {
  id: string;
  fullName: string;
  photoUrl: string | null;
  role: 'student' | 'staff';
};

export type BirthdayWidgetPayload = {
  isMyBirthday: boolean;
  birthdays: BirthdayWidgetPerson[];
};

const WIDGET_LIMIT = 20;

@Injectable()
export class BirthdayQueryService {
  constructor(private readonly prisma: PrismaService) {}

  todayParts(date = new Date()) {
    return { month: date.getMonth() + 1, day: date.getDate() };
  }

  async findStudentBirthdaysToday(
    tenantId: string,
    date = new Date(),
  ): Promise<BirthdayStudentRow[]> {
    const { month, day } = this.todayParts(date);
    return this.prisma.$queryRaw<BirthdayStudentRow[]>`
      SELECT
        s.id AS "studentId",
        s.user_id AS "userId",
        sp.full_name AS "fullName",
        sp.email AS email,
        sp.photo_path AS "photoPath",
        s.program_version_id AS "programVersionId",
        s.department_id AS "departmentId",
        s.primary_shift_id AS "primaryShiftId",
        d.name AS "departmentName",
        p.name AS "programName"
      FROM academic.student_profiles sp
      INNER JOIN academic.students s ON s.id = sp.student_id
      LEFT JOIN core.departments d ON d.id = s.department_id
      LEFT JOIN academic.program_versions pv ON pv.id = s.program_version_id
      LEFT JOIN academic.programs p ON p.id = pv.program_id
      WHERE sp.tenant_id = ${tenantId}::uuid
        AND s.deleted_at IS NULL
        AND sp.date_of_birth IS NOT NULL
        AND s.user_id IS NOT NULL
        AND EXTRACT(MONTH FROM sp.date_of_birth) = ${month}
        AND EXTRACT(DAY FROM sp.date_of_birth) = ${day}
      ORDER BY sp.full_name ASC
      LIMIT 500
    `;
  }

  async findStaffBirthdaysToday(
    tenantId: string,
    date = new Date(),
  ): Promise<BirthdayStaffRow[]> {
    const { month, day } = this.todayParts(date);
    return this.prisma.$queryRaw<BirthdayStaffRow[]>`
      SELECT
        sp.id AS "staffProfileId",
        sp.portal_user_id AS "portalUserId",
        sp.full_name AS "fullName",
        sp.email AS email,
        sp.photo_url AS "photoUrl",
        sp.department_id AS "departmentId",
        d.name AS "departmentName"
      FROM academic.staff_profiles sp
      LEFT JOIN core.departments d ON d.id = sp.department_id
      WHERE sp.tenant_id = ${tenantId}::uuid
        AND sp.deleted_at IS NULL
        AND sp.status = 'ACTIVE'
        AND sp.date_of_birth IS NOT NULL
        AND sp.portal_user_id IS NOT NULL
        AND EXTRACT(MONTH FROM sp.date_of_birth) = ${month}
        AND EXTRACT(DAY FROM sp.date_of_birth) = ${day}
      ORDER BY sp.full_name ASC
      LIMIT 200
    `;
  }

  async getStudentOfferingSectionIds(
    tenantId: string,
    studentId: string,
  ): Promise<string[]> {
    const statusList = Prisma.join(
      ACTIVE_REGISTRATION_STATUSES.map((s) => Prisma.sql`${s}`),
    );
    const rows = await this.prisma.$queryRaw<{ offeringSectionId: string }[]>`
      SELECT DISTINCT srl.offering_section_id AS "offeringSectionId"
      FROM academic.semester_registrations sr
      INNER JOIN academic.semester_registration_lines srl ON srl.registration_id = sr.id
      WHERE sr.tenant_id = ${tenantId}::uuid
        AND sr.student_id = ${studentId}::uuid
        AND LOWER(sr.status) IN (${statusList})
        AND srl.offering_section_id IS NOT NULL
    `;
    return rows.map((r) => r.offeringSectionId);
  }

  async findStudentPeers(
    tenantId: string,
    birthdayStudentId: string,
    birthdayStudent?: Pick<
      BirthdayStudentRow,
      'programVersionId' | 'departmentId' | 'primaryShiftId'
    >,
  ): Promise<BirthdayPeerRow[]> {
    const sectionIds = await this.getStudentOfferingSectionIds(
      tenantId,
      birthdayStudentId,
    );

    if (sectionIds.length > 0) {
      const statusList = Prisma.join(
        ACTIVE_REGISTRATION_STATUSES.map((s) => Prisma.sql`${s}`),
      );
      const sectionList = Prisma.join(
        sectionIds.map((id) => Prisma.sql`${id}::uuid`),
      );
      return this.prisma.$queryRaw<BirthdayPeerRow[]>`
        SELECT DISTINCT
          s.id AS "studentId",
          s.user_id AS "userId",
          sp.full_name AS "displayName",
          sp.email AS email
        FROM academic.semester_registration_lines srl
        INNER JOIN academic.semester_registrations sr ON sr.id = srl.registration_id
        INNER JOIN academic.students s ON s.id = sr.student_id
        INNER JOIN academic.student_profiles sp ON sp.student_id = s.id
        WHERE sr.tenant_id = ${tenantId}::uuid
          AND s.deleted_at IS NULL
          AND s.user_id IS NOT NULL
          AND s.id <> ${birthdayStudentId}::uuid
          AND srl.offering_section_id IN (${sectionList})
          AND LOWER(sr.status) IN (${statusList})
        LIMIT 500
      `;
    }

    const student =
      birthdayStudent ??
      (await this.prisma.student.findFirst({
        where: { id: birthdayStudentId, tenantId, deletedAt: null },
        select: {
          programVersionId: true,
          departmentId: true,
          primaryShiftId: true,
        },
      }));

    if (
      !student?.programVersionId &&
      !student?.departmentId &&
      !student?.primaryShiftId
    ) {
      return [];
    }

    const conditions: Prisma.Sql[] = [
      Prisma.sql`s.tenant_id = ${tenantId}::uuid`,
      Prisma.sql`s.deleted_at IS NULL`,
      Prisma.sql`s.user_id IS NOT NULL`,
      Prisma.sql`s.id <> ${birthdayStudentId}::uuid`,
    ];
    if (student.programVersionId) {
      conditions.push(
        Prisma.sql`s.program_version_id = ${student.programVersionId}::uuid`,
      );
    }
    if (student.departmentId) {
      conditions.push(
        Prisma.sql`s.department_id = ${student.departmentId}::uuid`,
      );
    }
    if (student.primaryShiftId) {
      conditions.push(
        Prisma.sql`s.primary_shift_id = ${student.primaryShiftId}::uuid`,
      );
    }

    return this.prisma.$queryRaw<BirthdayPeerRow[]>`
      SELECT
        s.id AS "studentId",
        s.user_id AS "userId",
        sp.full_name AS "displayName",
        sp.email AS email
      FROM academic.students s
      INNER JOIN academic.student_profiles sp ON sp.student_id = s.id
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY sp.full_name ASC
      LIMIT 500
    `;
  }

  async findStaffColleagues(
    tenantId: string,
    birthdayStaffProfileId: string,
    departmentId: string | null,
  ): Promise<BirthdayColleagueRow[]> {
    if (!departmentId) return [];

    return this.prisma.$queryRaw<BirthdayColleagueRow[]>`
      SELECT
        sp.id AS "staffProfileId",
        sp.portal_user_id AS "portalUserId",
        sp.full_name AS "displayName",
        sp.email AS email
      FROM academic.staff_profiles sp
      WHERE sp.tenant_id = ${tenantId}::uuid
        AND sp.deleted_at IS NULL
        AND sp.status = 'ACTIVE'
        AND sp.portal_user_id IS NOT NULL
        AND sp.department_id = ${departmentId}::uuid
        AND sp.id <> ${birthdayStaffProfileId}::uuid
      ORDER BY sp.full_name ASC
      LIMIT 200
    `;
  }

  async isStudentBirthdayToday(
    tenantId: string,
    studentId: string,
    date = new Date(),
  ): Promise<boolean> {
    const { month, day } = this.todayParts(date);
    const rows = await this.prisma.$queryRaw<{ ok: number }[]>`
      SELECT 1 AS ok
      FROM academic.student_profiles sp
      WHERE sp.tenant_id = ${tenantId}::uuid
        AND sp.student_id = ${studentId}::uuid
        AND sp.date_of_birth IS NOT NULL
        AND EXTRACT(MONTH FROM sp.date_of_birth) = ${month}
        AND EXTRACT(DAY FROM sp.date_of_birth) = ${day}
      LIMIT 1
    `;
    return rows.length > 0;
  }

  async isStaffBirthdayToday(
    tenantId: string,
    staffProfileId: string,
    date = new Date(),
  ): Promise<boolean> {
    const { month, day } = this.todayParts(date);
    const rows = await this.prisma.$queryRaw<{ ok: number }[]>`
      SELECT 1 AS ok
      FROM academic.staff_profiles sp
      WHERE sp.tenant_id = ${tenantId}::uuid
        AND sp.id = ${staffProfileId}::uuid
        AND sp.date_of_birth IS NOT NULL
        AND EXTRACT(MONTH FROM sp.date_of_birth) = ${month}
        AND EXTRACT(DAY FROM sp.date_of_birth) = ${day}
      LIMIT 1
    `;
    return rows.length > 0;
  }

  async getStudentWidgetBirthdays(
    tenantId: string,
    viewerStudentId: string,
    date = new Date(),
  ): Promise<BirthdayWidgetPayload> {
    const [isMyBirthday, viewerSections, todaysBirthdays] = await Promise.all([
      this.isStudentBirthdayToday(tenantId, viewerStudentId, date),
      this.getStudentOfferingSectionIds(tenantId, viewerStudentId),
      this.findStudentBirthdaysToday(tenantId, date),
    ]);

    const viewerStudent = await this.prisma.student.findFirst({
      where: { id: viewerStudentId, tenantId, deletedAt: null },
      select: {
        programVersionId: true,
        departmentId: true,
        primaryShiftId: true,
      },
    });

    const visible = new Map<string, BirthdayWidgetPerson>();

    for (const birthday of todaysBirthdays) {
      if (birthday.studentId === viewerStudentId) {
        visible.set(birthday.studentId, this.toStudentWidgetPerson(birthday));
        continue;
      }

      const sharesSection =
        viewerSections.length > 0 &&
        (await this.sharesOfferingSection(
          tenantId,
          birthday.studentId,
          viewerSections,
        ));

      const sharesProgramFallback =
        !sharesSection &&
        viewerStudent != null &&
        this.matchesProgramFallback(birthday, viewerStudent);

      if (sharesSection || sharesProgramFallback) {
        visible.set(birthday.studentId, this.toStudentWidgetPerson(birthday));
      }
    }

    return {
      isMyBirthday,
      birthdays: [...visible.values()].slice(0, WIDGET_LIMIT),
    };
  }

  async getStaffWidgetBirthdays(
    tenantId: string,
    viewerStaffProfileId: string,
    departmentId: string | null,
    date = new Date(),
  ): Promise<BirthdayWidgetPayload> {
    const [isMyBirthday, todaysBirthdays] = await Promise.all([
      this.isStaffBirthdayToday(tenantId, viewerStaffProfileId, date),
      this.findStaffBirthdaysToday(tenantId, date),
    ]);

    const birthdays = todaysBirthdays
      .filter(
        (row) =>
          row.departmentId && departmentId && row.departmentId === departmentId,
      )
      .map((row) => this.toStaffWidgetPerson(row))
      .slice(0, WIDGET_LIMIT);

    return { isMyBirthday, birthdays };
  }

  private matchesProgramFallback(
    birthday: Pick<
      BirthdayStudentRow,
      'programVersionId' | 'departmentId' | 'primaryShiftId'
    >,
    viewer: {
      programVersionId: string | null;
      departmentId: string | null;
      primaryShiftId: string | null;
    },
  ): boolean {
    if (
      birthday.programVersionId &&
      viewer.programVersionId &&
      birthday.programVersionId !== viewer.programVersionId
    ) {
      return false;
    }
    if (
      birthday.departmentId &&
      viewer.departmentId &&
      birthday.departmentId !== viewer.departmentId
    ) {
      return false;
    }
    if (
      birthday.primaryShiftId &&
      viewer.primaryShiftId &&
      birthday.primaryShiftId !== viewer.primaryShiftId
    ) {
      return false;
    }

    return (
      (birthday.programVersionId != null &&
        birthday.programVersionId === viewer.programVersionId) ||
      (birthday.departmentId != null &&
        birthday.departmentId === viewer.departmentId) ||
      (birthday.primaryShiftId != null &&
        birthday.primaryShiftId === viewer.primaryShiftId)
    );
  }

  private async sharesOfferingSection(
    tenantId: string,
    studentId: string,
    viewerSectionIds: string[],
  ): Promise<boolean> {
    const studentSections = await this.getStudentOfferingSectionIds(
      tenantId,
      studentId,
    );
    return studentSections.some((id) => viewerSectionIds.includes(id));
  }

  private toStudentWidgetPerson(row: BirthdayStudentRow): BirthdayWidgetPerson {
    return {
      id: row.studentId,
      fullName: row.fullName,
      photoUrl: toPublicUploadUrl(row.photoPath),
      role: 'student',
    };
  }

  private toStaffWidgetPerson(row: BirthdayStaffRow): BirthdayWidgetPerson {
    return {
      id: row.staffProfileId,
      fullName: row.fullName,
      photoUrl: row.photoUrl,
      role: 'staff',
    };
  }
}
