import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { LmsSettingsService } from './lms-settings.service';

const POOL_CATEGORIES = new Set(['MDC', 'AEC', 'SEC', 'VAC', 'VTC']);

@Injectable()
export class LmsWorkspaceService {
  private readonly logger = new Logger(LmsWorkspaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: LmsSettingsService,
  ) {}

  buildTitle(
    courseCode: string,
    courseTitle: string,
    sectionCode?: string | null,
  ) {
    return sectionCode
      ? `${courseCode} ${courseTitle} · ${sectionCode}`
      : `${courseCode} ${courseTitle}`;
  }

  async provisionSectionWorkspace(tenantId: string, offeringSectionId: string) {
    const section = await this.prisma.offeringSection.findFirst({
      where: { id: offeringSectionId, tenantId, deletedAt: null },
      include: {
        courseOffering: { include: { course: true } },
      },
    });
    if (!section) return null;

    const existing = await this.prisma.lmsWorkspace.findFirst({
      where: { offeringSectionId, tenantId, deletedAt: null },
    });
    if (existing) return existing;

    const course = section.courseOffering.course;
    const semesterNo =
      section.courseOffering.semesterSequence ??
      (await this.inferSemesterNo(tenantId, section.courseOfferingId)) ??
      1;

    return this.prisma.lmsWorkspace.create({
      data: {
        tenantId,
        workspaceType: 'SECTION',
        offeringSectionId: section.id,
        courseOfferingId: section.courseOfferingId,
        courseId: course.id,
        semesterNo,
        shiftId: section.shiftId,
        title: this.buildTitle(course.code, course.title, section.sectionCode),
        status: 'ACTIVE',
      },
    });
  }

  async provisionPoolWorkspace(tenantId: string, courseOfferingId: string) {
    const settings = await this.settings.getOrCreate(tenantId);
    if (!settings.poolWorkspacesEnabled) return null;

    const offering = await this.prisma.courseOffering.findFirst({
      where: { id: courseOfferingId, tenantId, deletedAt: null },
      include: { course: true },
    });
    if (!offering) return null;

    const category = offering.category?.toUpperCase();
    if (!category || !POOL_CATEGORIES.has(category)) return null;

    const existing = await this.prisma.lmsWorkspace.findFirst({
      where: {
        tenantId,
        courseOfferingId,
        workspaceType: 'POOL',
        deletedAt: null,
      },
    });
    if (existing) return existing;

    const semesterNo = offering.semesterSequence ?? 1;
    return this.prisma.lmsWorkspace.create({
      data: {
        tenantId,
        workspaceType: 'POOL',
        courseOfferingId: offering.id,
        courseId: offering.courseId,
        semesterNo,
        title: this.buildTitle(offering.course.code, offering.course.title),
        status: 'ACTIVE',
      },
    });
  }

  async provisionAllForTenant(tenantId: string) {
    const sections = await this.prisma.offeringSection.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });

    let created = 0;
    for (const section of sections) {
      const before = await this.prisma.lmsWorkspace.count({
        where: { tenantId, offeringSectionId: section.id },
      });
      await this.provisionSectionWorkspace(tenantId, section.id);
      const after = await this.prisma.lmsWorkspace.count({
        where: { tenantId, offeringSectionId: section.id },
      });
      if (after > before) created += 1;
    }

    const poolOfferings = await this.prisma.courseOffering.findMany({
      where: {
        tenantId,
        deletedAt: null,
        category: { in: [...POOL_CATEGORIES] },
      },
      select: { id: true },
    });

    for (const offering of poolOfferings) {
      const before = await this.prisma.lmsWorkspace.count({
        where: {
          tenantId,
          courseOfferingId: offering.id,
          workspaceType: 'POOL',
        },
      });
      await this.provisionPoolWorkspace(tenantId, offering.id);
      const after = await this.prisma.lmsWorkspace.count({
        where: {
          tenantId,
          courseOfferingId: offering.id,
          workspaceType: 'POOL',
        },
      });
      if (after > before) created += 1;
    }

    this.logger.log(
      `Provisioned ${created} new LMS workspace(s) for tenant ${tenantId}`,
    );
    return {
      created,
      sectionCount: sections.length,
      poolOfferingCount: poolOfferings.length,
    };
  }

  async listWorkspaces(
    tenantId: string,
    query: {
      semesterNo?: number;
      q?: string;
      status?: string;
      workspaceType?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      tenantId,
      deletedAt: null,
      ...(query.semesterNo ? { semesterNo: query.semesterNo } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.workspaceType ? { workspaceType: query.workspaceType } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              {
                course: {
                  code: { contains: query.q, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.lmsWorkspace.count({ where }),
      this.prisma.lmsWorkspace.findMany({
        where,
        include: {
          course: { select: { code: true, title: true, credits: true } },
          offeringSection: { select: { sectionCode: true } },
          _count: {
            select: { materials: true, announcements: true, lessonPlans: true },
          },
        },
        orderBy: [{ semesterNo: 'asc' }, { title: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getOverview(tenantId: string, workspaceId: string) {
    const workspace = await this.prisma.lmsWorkspace.findFirst({
      where: { id: workspaceId, tenantId, deletedAt: null },
      include: {
        course: true,
        courseOffering: {
          include: {
            programVersion: { include: { program: true } },
          },
        },
        offeringSection: {
          include: {
            staffProfile: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    if (!workspace) return null;

    const facultyTeam = workspace.offeringSectionId
      ? await this.prisma.subjectTeachingAssignment.findMany({
          where: {
            tenantId,
            offeringSectionId: workspace.offeringSectionId,
            deletedAt: null,
          },
          include: {
            staffProfile: { select: { id: true, fullName: true, email: true } },
          },
        })
      : await this.prisma.subjectTeachingAssignment.findMany({
          where: {
            tenantId,
            courseOfferingId: workspace.courseOfferingId,
            deletedAt: null,
          },
          include: {
            staffProfile: { select: { id: true, fullName: true, email: true } },
          },
        });

    const [
      materialCount,
      publishedMaterialCount,
      announcementCount,
      lessonPlanCount,
      assignmentCount,
    ] = await Promise.all([
      this.prisma.lmsMaterial.count({
        where: { workspaceId, tenantId, deletedAt: null },
      }),
      this.prisma.lmsMaterial.count({
        where: { workspaceId, tenantId, deletedAt: null, status: 'PUBLISHED' },
      }),
      this.prisma.lmsAnnouncement.count({
        where: { workspaceId, tenantId, deletedAt: null },
      }),
      this.prisma.lmsLessonPlan.count({
        where: { workspaceId, tenantId, deletedAt: null },
      }),
      this.prisma.lmsAssignment.count({
        where: {
          workspaceId,
          tenantId,
          deletedAt: null,
          status: { in: ['PUBLISHED', 'CLOSED'] },
        },
      }),
    ]);

    return {
      workspace,
      programme: workspace.courseOffering.programVersion?.program ?? null,
      facultyTeam: facultyTeam.map((a) => ({
        id: a.staffProfile.id,
        name: a.staffProfile.fullName,
        email: a.staffProfile.email,
        role: a.role,
        isPrimary: a.isPrimary,
      })),
      stats: {
        materialCount,
        publishedMaterialCount,
        announcementCount,
        lessonPlanCount,
        assignmentCount,
        assignmentCompletionPct: 0,
        quizParticipationPct: 0,
      },
    };
  }

  private async inferSemesterNo(tenantId: string, courseOfferingId: string) {
    const offering = await this.prisma.courseOffering.findFirst({
      where: { id: courseOfferingId, tenantId },
      select: { semesterSequence: true },
    });
    return offering?.semesterSequence ?? null;
  }
}
