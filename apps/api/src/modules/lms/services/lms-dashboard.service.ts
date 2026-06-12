import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { ENROLLED_LINE_STATUSES } from '../constants/lms.constants';
import { LmsAccessService } from './lms-access.service';
import { LmsAssignmentsService } from './lms-assignments.service';

@Injectable()
export class LmsDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LmsAccessService,
    private readonly assignments: LmsAssignmentsService,
  ) {}

  async adminDashboard(tenantId: string) {
    const [
      activeWorkspaces,
      totalMaterials,
      recentUploads,
      announcements,
      assignmentSubmissions,
    ] = await Promise.all([
      this.prisma.lmsWorkspace.count({
        where: { tenantId, status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.lmsMaterial.count({
        where: { tenantId, deletedAt: null, status: 'PUBLISHED' },
      }),
      this.prisma.lmsAuditLog.count({
        where: {
          tenantId,
          entityType: 'MATERIAL',
          action: 'UPLOAD',
          createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
        },
      }),
      this.prisma.lmsAnnouncement.count({
        where: {
          tenantId,
          deletedAt: null,
          publishAt: { gte: new Date(Date.now() - 7 * 86400000) },
        },
      }),
      this.prisma.lmsAssignmentSubmission.count({
        where: {
          tenantId,
          submittedAt: { gte: new Date(Date.now() - 7 * 86400000) },
        },
      }),
    ]);

    return {
      cards: {
        activeWorkspaces,
        totalMaterials,
        facultyActivityUploads: recentUploads,
        recentAnnouncements: announcements,
        assignmentSubmissions,
        quizParticipation: 0,
        studentEngagementPct: null,
      },
    };
  }

  async myWorkspaces(user: JwtUser) {
    if (this.access.hasAdminLms(user)) {
      const result = await this.prisma.lmsWorkspace.findMany({
        where: { tenantId: user.tid, deletedAt: null, status: 'ACTIVE' },
        include: {
          course: { select: { code: true, title: true } },
          offeringSection: { select: { sectionCode: true } },
          _count: {
            select: {
              materials: { where: { status: 'PUBLISHED', deletedAt: null } },
            },
          },
        },
        take: 50,
        orderBy: { title: 'asc' },
      });
      return { role: 'admin', workspaces: result };
    }

    const staffId = await this.access.getStaffProfileId(user);
    if (staffId) {
      const assignments = await this.prisma.subjectTeachingAssignment.findMany({
        where: {
          tenantId: user.tid,
          staffProfileId: staffId,
          deletedAt: null,
          canAccessSubjectWorkspace: true,
        },
        select: { offeringSectionId: true, courseOfferingId: true },
      });

      const sectionIds = assignments.map((a) => a.offeringSectionId);
      const offeringIds = [
        ...new Set(assignments.map((a) => a.courseOfferingId).filter(Boolean)),
      ];

      const workspaces = await this.prisma.lmsWorkspace.findMany({
        where: {
          tenantId: user.tid,
          deletedAt: null,
          status: 'ACTIVE',
          OR: [
            { offeringSectionId: { in: sectionIds } },
            {
              workspaceType: 'POOL',
              courseOfferingId: { in: offeringIds as string[] },
            },
          ],
        },
        include: {
          course: { select: { code: true, title: true } },
          offeringSection: { select: { sectionCode: true } },
          _count: {
            select: {
              materials: { where: { status: 'PUBLISHED', deletedAt: null } },
            },
          },
        },
      });

      return { role: 'faculty', workspaces };
    }

    const studentId = await this.access.getStudentId(user);
    if (!studentId) return { role: 'unknown', workspaces: [] };

    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId: user.tid,
        status: { in: ENROLLED_LINE_STATUSES },
        registration: { studentId },
      },
      select: { offeringSectionId: true, offeringId: true },
    });

    const sectionIds = lines
      .map((l) => l.offeringSectionId)
      .filter(Boolean) as string[];
    const offeringIds = [...new Set(lines.map((l) => l.offeringId))];

    const workspaces = await this.prisma.lmsWorkspace.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          { offeringSectionId: { in: sectionIds } },
          { workspaceType: 'POOL', courseOfferingId: { in: offeringIds } },
        ],
      },
      include: {
        course: { select: { code: true, title: true } },
        offeringSection: { select: { sectionCode: true } },
        _count: {
          select: {
            materials: { where: { status: 'PUBLISHED', deletedAt: null } },
          },
        },
      },
    });

    const bookmarks = await this.prisma.lmsMaterialBookmark.count({
      where: { tenantId: user.tid, studentId },
    });

    const downloads = await this.prisma.lmsAuditLog.count({
      where: {
        tenantId: user.tid,
        actorId: user.sub,
        action: 'DOWNLOAD',
        entityType: 'MATERIAL',
      },
    });

    return {
      role: 'student',
      workspaces,
      progress: {
        enrolledWorkspaces: workspaces.length,
        bookmarks,
        materialsDownloaded: downloads,
        assignmentCompletionPct: 0,
        quizCompletionPct: 0,
      },
    };
  }

  async facultyDashboard(user: JwtUser) {
    const my = await this.myWorkspaces(user);
    const staffId = await this.access.getStaffProfileId(user);
    const pendingEvaluations = staffId
      ? await this.assignments.countPendingEvaluations(user.tid, staffId)
      : 0;
    return {
      cards: {
        mySubjects: my.workspaces.length,
        pendingEvaluations,
        assignmentsDue: pendingEvaluations,
        quizzesPending: 0,
      },
      workspaces: my.workspaces,
    };
  }

  async studentDashboard(user: JwtUser) {
    const my = await this.myWorkspaces(user);
    const studentId = await this.access.getStudentId(user);
    const assignmentsDue = studentId
      ? await this.assignments.countDueForStudent(user.tid, studentId)
      : 0;
    const announcements = await this.prisma.lmsAnnouncement.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        OR: [
          { workspaceId: { in: my.workspaces.map((w) => w.id) } },
          { audience: 'INSTITUTION' },
        ],
      },
      orderBy: { publishAt: 'desc' },
      take: 10,
    });

    return {
      cards: {
        myCourses: my.workspaces.length,
        notesAvailable: my.workspaces.reduce(
          (n, w) => n + w._count.materials,
          0,
        ),
        assignmentsDue,
        quizzesPending: 0,
        announcements: announcements.length,
      },
      workspaces: my.workspaces,
      announcements,
      progress: 'progress' in my ? my.progress : null,
    };
  }
}
