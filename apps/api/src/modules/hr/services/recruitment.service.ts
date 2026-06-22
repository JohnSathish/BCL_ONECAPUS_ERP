import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../../database/prisma.service';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  CreateInterviewDto,
  CreateOfferDto,
  CreateRecruitmentApplicationDto,
  CreateVacancyDto,
  UpdateApplicationStatusDto,
  UpdateInterviewDto,
  UpdateVacancyDto,
  UpdateVacancyStatusDto,
} from '../dto/recruitment.dto';
import { RecruitmentNotificationService } from './recruitment-notification.service';
import {
  ALL_RECRUITMENT_STATUSES,
  RECRUITMENT_PIPELINE_STAGES,
} from '../constants/recruitment-pipeline';

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

@Injectable()
export class RecruitmentService {
  private uploadRoot = resolveTenantUploadRoot();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: RecruitmentNotificationService,
  ) {}

  private async ensureUniqueSlug(
    tenantId: string,
    title: string,
    excludeId?: string,
  ) {
    let base = slugify(title);
    if (!base) base = 'vacancy';
    let slug = base;
    let n = 2;
    while (true) {
      const existing = await this.prisma.recruitmentVacancy.findFirst({
        where: {
          tenantId,
          slug,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
      });
      if (!existing) return slug;
      slug = `${base}-${n}`;
      n += 1;
    }
  }

  listVacancies(tenantId: string, status?: string) {
    return this.prisma.recruitmentVacancy.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, label: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createVacancy(user: JwtUser, dto: CreateVacancyDto) {
    const slug = await this.ensureUniqueSlug(user.tid, dto.title);
    return this.prisma.recruitmentVacancy.create({
      data: {
        tenantId: user.tid,
        title: dto.title,
        slug,
        departmentId: dto.departmentId,
        designationId: dto.designationId,
        staffType: dto.staffType,
        vacanciesCount: dto.vacanciesCount ?? 1,
        description: dto.description,
        jobDescriptionHtml: dto.jobDescriptionHtml,
        qualificationRequired: dto.qualificationRequired,
        experienceRequired: dto.experienceRequired,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        closingDate: dto.closingDate ? new Date(dto.closingDate) : null,
        advertisementPdfUrl: dto.advertisementPdfUrl,
        termsPdfUrl: dto.termsPdfUrl,
        instructionsHtml: dto.instructionsHtml,
        eligibilityJson: dto.eligibilityJson as object | undefined,
        createdById: user.sub,
      },
    });
  }

  async updateVacancyStatus(
    user: JwtUser,
    id: string,
    dto: UpdateVacancyStatusDto,
  ) {
    const existing = await this.prisma.recruitmentVacancy.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!existing) throw new NotFoundException('Vacancy not found');

    const slug =
      existing.slug ??
      (await this.ensureUniqueSlug(user.tid, existing.title, id));

    return this.prisma.recruitmentVacancy.update({
      where: { id, tenantId: user.tid },
      data: {
        status: dto.status,
        slug,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : undefined,
      },
    });
  }

  async getVacancy(tenantId: string, id: string) {
    const vacancy = await this.prisma.recruitmentVacancy.findFirst({
      where: { id, tenantId },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, label: true } },
      },
    });
    if (!vacancy) throw new NotFoundException('Vacancy not found');
    return vacancy;
  }

  async updateVacancy(user: JwtUser, id: string, dto: UpdateVacancyDto) {
    const existing = await this.getVacancy(user.tid, id);
    const slug =
      dto.slug?.trim() ||
      (dto.title && dto.title !== existing.title
        ? await this.ensureUniqueSlug(user.tid, dto.title, id)
        : existing.slug);

    const eligibilityJson =
      dto.selectionCommitteeJson !== undefined
        ? {
            ...((existing.eligibilityJson as object | null) ?? {}),
            selectionCommittee: dto.selectionCommitteeJson,
          }
        : undefined;

    return this.prisma.recruitmentVacancy.update({
      where: { id, tenantId: user.tid },
      data: {
        title: dto.title,
        slug,
        departmentId: dto.departmentId,
        designationId: dto.designationId,
        staffType: dto.staffType,
        vacanciesCount: dto.vacanciesCount,
        description: dto.description,
        jobDescriptionHtml: dto.jobDescriptionHtml,
        qualificationRequired: dto.qualificationRequired,
        experienceRequired: dto.experienceRequired,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        closingDate: dto.closingDate ? new Date(dto.closingDate) : undefined,
        advertisementPdfUrl: dto.advertisementPdfUrl,
        termsPdfUrl: dto.termsPdfUrl,
        instructionsHtml: dto.instructionsHtml,
        eligibilityJson,
      },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, label: true } },
      },
    });
  }

  listApplications(tenantId: string, vacancyId?: string) {
    return this.prisma.recruitmentApplication.findMany({
      where: { tenantId, ...(vacancyId ? { vacancyId } : {}) },
      include: {
        vacancy: {
          select: {
            title: true,
            status: true,
            slug: true,
            department: { select: { name: true } },
            designation: { select: { label: true } },
          },
        },
        interviews: { orderBy: { scheduledAt: 'desc' }, take: 5 },
        offers: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  async getApplication(tenantId: string, id: string) {
    const app = await this.prisma.recruitmentApplication.findFirst({
      where: { id, tenantId },
      include: {
        vacancy: {
          include: {
            department: { select: { name: true } },
            designation: { select: { label: true } },
          },
        },
        interviews: { orderBy: { scheduledAt: 'desc' } },
        offers: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async pipelineBoard(tenantId: string, vacancyId?: string) {
    const applications = await this.listApplications(tenantId, vacancyId);
    return RECRUITMENT_PIPELINE_STAGES.map((stage) => ({
      id: stage.id,
      label: stage.label,
      applications: applications.filter((a) =>
        (stage.statuses as readonly string[]).includes(a.status),
      ),
    }));
  }

  listInterviews(tenantId: string, status?: string) {
    return this.prisma.recruitmentInterview.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      include: {
        application: {
          select: {
            id: true,
            fullName: true,
            applicationNo: true,
            email: true,
            mobile: true,
            status: true,
            vacancy: { select: { title: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    });
  }

  createApplication(user: JwtUser, dto: CreateRecruitmentApplicationDto) {
    return this.prisma.recruitmentApplication.create({
      data: {
        tenantId: user.tid,
        vacancyId: dto.vacancyId,
        fullName: dto.fullName,
        email: dto.email,
        mobile: dto.mobile,
        resumeUrl: dto.resumeUrl,
        qualification: dto.qualification,
        experienceYears: dto.experienceYears,
        notes: dto.notes,
      },
    });
  }

  async updateApplicationStatus(
    user: JwtUser,
    id: string,
    dto: UpdateApplicationStatusDto,
  ) {
    if (!(ALL_RECRUITMENT_STATUSES as readonly string[]).includes(dto.status)) {
      throw new BadRequestException('Invalid status');
    }
    const app = await this.getApplication(user.tid, id);
    const updated = await this.prisma.recruitmentApplication.update({
      where: { id, tenantId: user.tid },
      data: {
        status: dto.status,
        notes: dto.reason
          ? `${app.notes ?? ''}\n[${dto.status}] ${dto.reason}`.trim()
          : undefined,
      },
      include: {
        vacancy: { select: { title: true } },
      },
    });

    if (dto.notify !== false) {
      if (dto.status === 'SELECTED' || dto.status === 'OFFERED') {
        await this.notifications.selected(user.tid, updated);
      } else if (dto.status === 'REJECTED') {
        await this.notifications.rejected(user.tid, updated, dto.reason);
      } else if (
        [
          'UNDER_REVIEW',
          'SHORTLISTED',
          'INTERVIEW',
          'WAITING_LIST',
          'HIRED',
          'APPOINTED',
        ].includes(dto.status)
      ) {
        await this.notifications.statusUpdated(user.tid, updated, dto.status);
      }
    }
    return updated;
  }

  async scheduleInterview(user: JwtUser, dto: CreateInterviewDto) {
    const interview = await this.prisma.recruitmentInterview.create({
      data: {
        tenantId: user.tid,
        applicationId: dto.applicationId,
        scheduledAt: new Date(dto.scheduledAt),
        venue: dto.venue,
        panelJson: dto.panelJson as object | undefined,
        notes: dto.notes,
      },
      include: {
        application: {
          include: { vacancy: { select: { title: true } } },
        },
      },
    });

    await this.prisma.recruitmentApplication.update({
      where: { id: dto.applicationId, tenantId: user.tid },
      data: { status: 'INTERVIEW' },
    });

    await this.notifications.interviewScheduled(
      user.tid,
      interview.application,
      interview,
    );

    return interview;
  }

  async updateInterview(user: JwtUser, id: string, dto: UpdateInterviewDto) {
    const interview = await this.prisma.recruitmentInterview.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!interview) throw new NotFoundException('Interview not found');

    return this.prisma.recruitmentInterview.update({
      where: { id },
      data: {
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        venue: dto.venue,
        panelJson: dto.panelJson as object | undefined,
        score: dto.score,
        status: dto.status,
        notes: dto.notes,
      },
      include: {
        application: {
          select: {
            id: true,
            fullName: true,
            applicationNo: true,
            vacancy: { select: { title: true } },
          },
        },
      },
    });
  }

  async uploadInterviewMinutes(
    user: JwtUser,
    id: string,
    file: Express.Multer.File,
  ) {
    const interview = await this.prisma.recruitmentInterview.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!interview) throw new NotFoundException('Interview not found');

    const dir = join(this.uploadRoot, user.tid, 'recruitment-interviews', id);
    await mkdir(dir, { recursive: true });
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `minutes-${Date.now()}-${safe}`;
    await writeFile(join(dir, filename), file.buffer);
    const url = `/uploads/tenants/${user.tid}/recruitment-interviews/${id}/${filename}`;

    const panel =
      interview.panelJson && typeof interview.panelJson === 'object'
        ? (interview.panelJson as Record<string, unknown>)
        : {};

    return this.prisma.recruitmentInterview.update({
      where: { id },
      data: {
        panelJson: {
          ...panel,
          minutesUrl: url,
          minutesUploadedAt: new Date().toISOString(),
        },
      },
    });
  }

  async sendDocumentsReminder(user: JwtUser, id: string, message?: string) {
    const app = await this.getApplication(user.tid, id);
    await this.notifications.documentsPending(user.tid, app, message);
    return { sent: true };
  }

  createOffer(user: JwtUser, dto: CreateOfferDto) {
    return this.prisma.recruitmentOffer.create({
      data: {
        tenantId: user.tid,
        applicationId: dto.applicationId,
        offeredSalary: dto.offeredSalary,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : null,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  async acceptOffer(user: JwtUser, offerId: string, staffProfileId: string) {
    const offer = await this.prisma.recruitmentOffer.findFirst({
      where: { id: offerId, tenantId: user.tid },
      include: { application: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    await this.prisma.recruitmentOffer.update({
      where: { id: offerId },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    return this.prisma.recruitmentApplication.update({
      where: { id: offer.applicationId },
      data: { status: 'HIRED', hiredStaffProfileId: staffProfileId },
    });
  }

  pipelineStats(tenantId: string) {
    return Promise.all([
      this.prisma.recruitmentVacancy.count({
        where: { tenantId, status: 'PUBLISHED' },
      }),
      this.prisma.recruitmentApplication.count({ where: { tenantId } }),
      this.prisma.recruitmentApplication.count({
        where: { tenantId, status: { in: ['APPLIED', 'SUBMITTED'] } },
      }),
      this.prisma.recruitmentApplication.count({
        where: { tenantId, status: 'SHORTLISTED' },
      }),
      this.prisma.recruitmentInterview.count({
        where: { tenantId, status: 'SCHEDULED' },
      }),
      this.prisma.recruitmentApplication.count({
        where: { tenantId, status: { in: ['SELECTED', 'OFFERED'] } },
      }),
      this.prisma.recruitmentApplication.count({
        where: { tenantId, status: { in: ['HIRED', 'APPOINTED'] } },
      }),
      this.prisma.recruitmentApplication.count({
        where: {
          tenantId,
          status: { in: ['APPOINTED', 'OFFERED'] },
          hiredStaffProfileId: null,
        },
      }),
      this.prisma.recruitmentApplication.count({
        where: { tenantId, status: 'OFFERED' },
      }),
    ]).then(
      ([
        openVacancies,
        totalApplications,
        submitted,
        shortlisted,
        interviews,
        offers,
        hired,
        joiningPending,
        offeredCount,
      ]) => {
        const accepted = hired;
        const offerAcceptanceRate =
          offeredCount + accepted > 0
            ? Math.round((accepted / (offeredCount + accepted)) * 100)
            : 0;
        return {
          openVacancies,
          totalApplications,
          submitted,
          shortlisted,
          interviews,
          offers,
          hired,
          joiningPending,
          offerAcceptanceRate,
        };
      },
    );
  }

  async recruitmentAnalytics(tenantId: string) {
    const [byStatus, vacancies, sourceCounts, recentPublic] = await Promise.all(
      [
        this.prisma.recruitmentApplication.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { _all: true },
        }),
        this.prisma.recruitmentVacancy.findMany({
          where: { tenantId },
          select: {
            id: true,
            title: true,
            status: true,
            slug: true,
            _count: { select: { applications: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.prisma.recruitmentApplication.groupBy({
          by: ['source'],
          where: { tenantId },
          _count: { _all: true },
        }),
        this.prisma.recruitmentApplication.count({
          where: {
            tenantId,
            source: 'PUBLIC',
            appliedAt: { gte: new Date(Date.now() - 30 * 86400000) },
          },
        }),
      ],
    );

    const totalApplications = byStatus.reduce(
      (sum, row) => sum + row._count._all,
      0,
    );
    const hired = byStatus
      .filter((r) => ['HIRED', 'APPOINTED'].includes(r.status))
      .reduce((sum, row) => sum + row._count._all, 0);
    const rejected =
      byStatus.find((r) => r.status === 'REJECTED')?._count._all ?? 0;
    const publicCount =
      sourceCounts.find((r) => r.source === 'PUBLIC')?._count._all ?? 0;
    const internalCount =
      sourceCounts.find((r) => r.source === 'INTERNAL')?._count._all ?? 0;

    return {
      funnel: byStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      byVacancy: vacancies.map((v) => ({
        id: v.id,
        title: v.title,
        status: v.status,
        slug: v.slug,
        applications: v._count.applications,
      })),
      totals: {
        applications: totalApplications,
        hired,
        rejected,
        conversionRate:
          totalApplications > 0
            ? Math.round((hired / totalApplications) * 1000) / 10
            : 0,
        publicApplications: publicCount,
        internalApplications: internalCount,
        publicLast30Days: recentPublic,
      },
    };
  }
}
