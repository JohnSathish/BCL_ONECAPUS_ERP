import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { ENROLLED_LINE_STATUSES } from '../constants/lms.constants';

export type LmsAccessAction =
  | 'read'
  | 'manage'
  | 'upload'
  | 'publish'
  | 'announce';

@Injectable()
export class LmsAccessService {
  constructor(private readonly prisma: PrismaService) {}

  hasAdminLms(user: JwtUser): boolean {
    return (
      user.permissions.includes('lms:manage') ||
      user.permissions.includes('lms:workspace:manage') ||
      user.roles.includes('college-admin') ||
      user.roles.includes('super-admin')
    );
  }

  async getWorkspaceOrThrow(tenantId: string, workspaceId: string) {
    const workspace = await this.prisma.lmsWorkspace.findFirst({
      where: { id: workspaceId, tenantId, deletedAt: null },
      include: {
        course: { select: { code: true, title: true, credits: true } },
        courseOffering: {
          select: {
            semesterSequence: true,
            category: true,
            programVersion: {
              include: { program: { select: { code: true, name: true } } },
            },
          },
        },
        offeringSection: { select: { sectionCode: true } },
      },
    });
    if (!workspace) throw new NotFoundException('LMS workspace not found');
    return workspace;
  }

  async assertWorkspaceAccess(
    user: JwtUser,
    workspaceId: string,
    action: LmsAccessAction = 'read',
  ) {
    const workspace = await this.getWorkspaceOrThrow(user.tid, workspaceId);

    if (this.hasAdminLms(user)) {
      return workspace;
    }

    const staff = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
    });

    if (staff) {
      const assignment = await this.prisma.subjectTeachingAssignment.findFirst({
        where: {
          tenantId: user.tid,
          staffProfileId: staff.id,
          deletedAt: null,
          canAccessSubjectWorkspace: true,
          OR: [
            { offeringSectionId: workspace.offeringSectionId ?? undefined },
            {
              courseOfferingId: workspace.courseOfferingId,
              offeringSectionId: workspace.offeringSectionId ?? undefined,
            },
          ],
        },
      });
      if (assignment) {
        if (
          action === 'upload' &&
          !user.permissions.includes('lms:materials:upload')
        ) {
          throw new ForbiddenException(
            'Missing lms:materials:upload permission',
          );
        }
        if (
          action === 'publish' &&
          !user.permissions.includes('lms:materials:publish')
        ) {
          throw new ForbiddenException(
            'Missing lms:materials:publish permission',
          );
        }
        if (
          action === 'announce' &&
          !user.permissions.includes('lms:announcements:publish')
        ) {
          throw new ForbiddenException(
            'Missing lms:announcements:publish permission',
          );
        }
        return workspace;
      }
    }

    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
    });

    if (student && action === 'read') {
      const enrolled = await this.isStudentEnrolled(
        user.tid,
        student.id,
        workspace,
      );
      if (enrolled) return workspace;
    }

    if (user.permissions.includes('lms:read') && action === 'read' && staff) {
      return workspace;
    }

    throw new ForbiddenException(
      'You do not have access to this LMS workspace',
    );
  }

  async isStudentEnrolled(
    tenantId: string,
    studentId: string,
    workspace: {
      workspaceType: string;
      offeringSectionId: string | null;
      courseOfferingId: string;
    },
  ): Promise<boolean> {
    if (workspace.workspaceType === 'SECTION' && workspace.offeringSectionId) {
      const line = await this.prisma.semesterRegistrationLine.findFirst({
        where: {
          tenantId,
          offeringSectionId: workspace.offeringSectionId,
          status: { in: ENROLLED_LINE_STATUSES },
          registration: { studentId },
        },
      });
      return Boolean(line);
    }

    const line = await this.prisma.semesterRegistrationLine.findFirst({
      where: {
        tenantId,
        offeringId: workspace.courseOfferingId,
        status: { in: ENROLLED_LINE_STATUSES },
        registration: { studentId },
      },
    });
    return Boolean(line);
  }

  async getStudentId(user: JwtUser): Promise<string | null> {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: { id: true },
    });
    return student?.id ?? null;
  }

  async getStaffProfileId(user: JwtUser): Promise<string | null> {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
      select: { id: true },
    });
    return staff?.id ?? null;
  }
}
