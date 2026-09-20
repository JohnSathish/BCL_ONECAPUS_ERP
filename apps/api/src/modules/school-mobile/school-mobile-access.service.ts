import { ForbiddenException, Injectable } from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from '../school-sis/school-sis.service';
import { resolveSchoolStaffIdForUser } from '../school-sis/school-sis-staff-lookup';
import {
  SCHOOL_MOBILE_PERMISSION_MANAGE,
  SCHOOL_MOBILE_PERMISSION_PARENT,
  SCHOOL_MOBILE_PERMISSION_STAFF,
  SCHOOL_MOBILE_PERMISSION_STUDENT,
  type SchoolMobilePersona,
} from './school-mobile.constants';

export type LinkedChild = {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  classLabel: string | null;
  photoUrl: string | null;
  rollNumber: string | null;
  academicYearName: string | null;
};

@Injectable()
export class SchoolMobileAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
  ) {}

  persona(user: JwtUser): SchoolMobilePersona {
    const perms = user.permissions ?? [];
    const roles = (user.roles ?? []).join(' ').toLowerCase();
    if (
      perms.includes(SCHOOL_MOBILE_PERMISSION_MANAGE) ||
      perms.includes('school-sis:manage') ||
      perms.includes('*') ||
      /\b(principal|college-admin|school-admin)\b/.test(roles)
    ) {
      return 'admin';
    }
    if (
      perms.includes(SCHOOL_MOBILE_PERMISSION_PARENT) ||
      /\bparent\b/.test(roles)
    ) {
      return 'parent';
    }
    if (
      perms.includes(SCHOOL_MOBILE_PERMISSION_STUDENT) ||
      /\bstudent\b/.test(roles)
    ) {
      return 'student';
    }
    if (
      perms.includes('fees.collection.view') ||
      /\baccountant|accounts\b/.test(roles)
    ) {
      return 'accountant';
    }
    if (perms.includes('library.issue') || /\blibrarian\b/.test(roles)) {
      return 'librarian';
    }
    if (
      perms.includes('transport.routes.view') ||
      /\btransport\b/.test(roles)
    ) {
      return 'transport';
    }
    if (
      perms.includes(SCHOOL_MOBILE_PERMISSION_STAFF) ||
      perms.includes('school-sis:read') ||
      /\bteacher|staff|hr-manager\b/.test(roles)
    ) {
      return 'teacher';
    }
    throw new ForbiddenException(
      'This account does not have St. Luke’s School app access.',
    );
  }

  assertAccess(user: JwtUser) {
    return this.persona(user);
  }

  assertOffice(user: JwtUser) {
    const persona = this.assertAccess(user);
    if (persona !== 'admin') {
      throw new ForbiddenException(
        'This screen is for the principal’s office.',
      );
    }
    return persona;
  }

  async childrenForUser(
    tenantId: string,
    userId: string,
  ): Promise<LinkedChild[]> {
    await this.sis.assertSecondarySisTenant(tenantId);
    const accounts = await this.prisma.schoolPersonAccount.findMany({
      where: { tenantId, userId },
    });
    const studentIds = new Set<string>();
    for (const row of accounts) {
      if (row.studentId) studentIds.add(row.studentId);
    }
    const guardianIds = accounts
      .map((row) => row.guardianId)
      .filter((id): id is string => Boolean(id));
    if (guardianIds.length) {
      const links = await this.prisma.schoolStudentGuardian.findMany({
        where: { guardianId: { in: guardianIds } },
        select: { studentId: true },
      });
      for (const link of links) studentIds.add(link.studentId);
    }
    if (!studentIds.size) return [];
    const year = await this.sis.currentYear(tenantId).catch(() => null);
    const students = await this.prisma.schoolStudent.findMany({
      where: {
        tenantId,
        id: { in: [...studentIds] },
        deletedAt: null,
      },
    });
    const enrollments = await this.prisma.schoolEnrollment.findMany({
      where: {
        tenantId,
        studentId: { in: [...studentIds] },
        deletedAt: null,
      },
      include: {
        academicYear: true,
        section: { include: { grade: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const byStudent = new Map<string, typeof enrollments>();
    for (const row of enrollments) {
      const list = byStudent.get(row.studentId) ?? [];
      list.push(row);
      byStudent.set(row.studentId, list);
    }
    return students.map((student) => {
      const picked = pickEnrollment(byStudent.get(student.id) ?? [], year?.id);
      const grade = picked?.section.grade;
      return {
        studentId: student.id,
        fullName: student.fullName,
        admissionNumber: student.admissionNumber,
        classLabel: grade
          ? `${grade.name}${picked?.section.name ? ` ${picked.section.name}` : ''}`
          : null,
        photoUrl: student.photoUrl,
        rollNumber:
          picked?.rollNumber ||
          byStudent.get(student.id)?.find((row) => row.rollNumber?.trim())
            ?.rollNumber ||
          null,
        academicYearName: picked?.academicYear?.name ?? year?.name ?? null,
      };
    });
  }

  async resolveStudentId(
    tenantId: string,
    user: JwtUser,
    requestedStudentId?: string,
  ): Promise<string | null> {
    const persona = this.persona(user);
    const children = await this.childrenForUser(tenantId, user.sub);
    if (persona === 'student') {
      return children[0]?.studentId ?? null;
    }
    if (persona === 'parent') {
      if (requestedStudentId) {
        const match = children.find(
          (child) => child.studentId === requestedStudentId,
        );
        if (!match) {
          throw new ForbiddenException(
            'That student is not linked to this parent account.',
          );
        }
        return match.studentId;
      }
      return children[0]?.studentId ?? null;
    }
    if (requestedStudentId && (persona === 'admin' || persona === 'teacher')) {
      return requestedStudentId;
    }
    return null;
  }

  async staffIdForUser(
    tenantId: string,
    user: JwtUser,
  ): Promise<string | null> {
    return resolveSchoolStaffIdForUser(this.prisma, tenantId, user);
  }
}

export function pickEnrollment<
  T extends {
    academicYearId: string;
    status: string;
    rollNumber: string | null;
    createdAt: Date;
  },
>(rows: T[], currentYearId?: string | null): T | null {
  if (!rows.length) return null;
  const current = currentYearId
    ? rows.find((row) => row.academicYearId === currentYearId)
    : undefined;
  const withRoll = rows.find((row) => row.rollNumber?.trim());
  return (
    current ||
    rows.find((row) => /^active$/i.test(row.status)) ||
    withRoll ||
    rows[0]
  );
}
