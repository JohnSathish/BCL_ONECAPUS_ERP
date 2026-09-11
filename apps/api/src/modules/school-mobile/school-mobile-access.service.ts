import { ForbiddenException, Injectable } from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from '../school-sis/school-sis.service';
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
};

@Injectable()
export class SchoolMobileAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
  ) {}

  persona(user: JwtUser): SchoolMobilePersona {
    const perms = user.permissions ?? [];
    const roles = user.roles ?? [];
    if (
      perms.includes(SCHOOL_MOBILE_PERMISSION_MANAGE) ||
      roles.includes('principal') ||
      roles.includes('college-admin')
    ) {
      return 'admin';
    }
    if (perms.includes(SCHOOL_MOBILE_PERMISSION_PARENT)) return 'parent';
    if (perms.includes(SCHOOL_MOBILE_PERMISSION_STUDENT)) return 'student';
    if (
      perms.includes(SCHOOL_MOBILE_PERMISSION_STAFF) ||
      perms.includes('school-sis:read') ||
      roles.includes('teacher')
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
    const year = await this.sis.currentYear(tenantId);
    const students = await this.prisma.schoolStudent.findMany({
      where: {
        tenantId,
        id: { in: [...studentIds] },
        deletedAt: null,
      },
      include: {
        enrollments: {
          where: {
            deletedAt: null,
            status: 'ACTIVE',
            academicYearId: year.id,
          },
          include: { section: { include: { grade: true } } },
          take: 1,
        },
      },
    });
    return students.map((student) => {
      const enrollment = student.enrollments[0];
      const grade = enrollment?.section.grade;
      return {
        studentId: student.id,
        fullName: student.fullName,
        admissionNumber: student.admissionNumber,
        classLabel: grade
          ? `${grade.name}${enrollment?.section.name ? ` ${enrollment.section.name}` : ''}`
          : null,
        photoUrl: student.photoUrl,
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
    const email = user.email?.trim().toLowerCase();
    if (!email) return null;
    const staff = await this.prisma.schoolStaff.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        email: { equals: email, mode: 'insensitive' },
      },
      select: { id: true },
    });
    return staff?.id ?? null;
  }
}
