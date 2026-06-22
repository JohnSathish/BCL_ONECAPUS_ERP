import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../../database/prisma.service';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';
import type { SubmitCareersApplicationDto } from '../dto/careers-portal.dto';
import { verifyTurnstileToken } from '../../../common/utils/turnstile.util';
import { RecruitmentNotificationService } from './recruitment-notification.service';
import { buildCareersStatusTimeline } from '../constants/careers-status-timeline';
import { sanitizeDisplayText } from '../../../common/utils/display-text.util';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import { parsePortalExtras } from '../../../common/types/portal-extras.types';

const DOCUMENT_UPLOAD_BLOCKED = new Set(['REJECTED', 'HIRED', 'APPOINTED']);

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

@Injectable()
export class CareersPortalService {
  private uploadRoot = resolveTenantUploadRoot();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: RecruitmentNotificationService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async getPortalInfo(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      branding,
      openCount,
      applicationsReceived,
      interviewsScheduled,
      facultyRecruited,
      publishedJobs,
      alertJobs,
      staffCount,
      studentCount,
      deptCount,
    ] = await Promise.all([
      this.prisma.tenantBranding.findFirst({ where: { tenantId } }),
      this.db().recruitmentVacancy.count({
        where: {
          tenantId,
          status: 'PUBLISHED',
          OR: [{ closingDate: null }, { closingDate: { gte: today } }],
        },
      }),
      this.db().recruitmentApplication.count({
        where: { tenantId, source: 'PUBLIC' },
      }),
      this.db().recruitmentInterview.count({
        where: { tenantId, status: 'SCHEDULED', scheduledAt: { gte: today } },
      }),
      this.db().recruitmentApplication.count({
        where: { tenantId, status: { in: ['APPOINTED', 'HIRED'] } },
      }),
      this.db().recruitmentVacancy.findMany({
        where: {
          tenantId,
          status: 'PUBLISHED',
          OR: [{ closingDate: null }, { closingDate: { gte: today } }],
        },
        select: { departmentId: true },
      }),
      this.db().recruitmentVacancy.findMany({
        where: {
          tenantId,
          status: 'PUBLISHED',
          OR: [{ closingDate: null }, { closingDate: { gte: today } }],
        },
        select: {
          title: true,
          closingDate: true,
          department: { select: { name: true } },
        },
        orderBy: [{ closingDate: 'asc' }, { publishedAt: 'desc' }],
        take: 12,
      }),
      this.prisma.staffProfile
        .count({ where: { tenantId, deletedAt: null } })
        .catch(() => 0),
      this.prisma.student
        .count({ where: { tenantId, deletedAt: null } })
        .catch(() => 0),
      this.prisma.department
        .count({
          where: {
            tenantId,
            deletedAt: null,
            status: 'ACTIVE',
            departmentType: 'ACADEMIC',
          },
        })
        .catch(() => 0),
    ]);

    const departmentsHiring = new Set(
      publishedJobs
        .map((j: { departmentId?: string | null }) => j.departmentId)
        .filter(Boolean),
    ).size;

    const badges = Array.isArray(branding?.badges)
      ? (branding!.badges as unknown[])
      : [];
    const portalExtras = parsePortalExtras(branding?.portalExtrasJson);
    const careersExtras = portalExtras.careersPortal ?? {};
    const naacFromBadges = badges.find(
      (b) => typeof b === 'string' && b.toLowerCase().includes('naac'),
    ) as string | undefined;

    const roleLabels = [
      ...new Set(
        (
          alertJobs as Array<{
            title: string;
            department?: { name: string } | null;
          }>
        ).map((j) => j.department?.name ?? j.title),
      ),
    ].slice(0, 8);

    const closingDates = (alertJobs as Array<{ closingDate?: Date | null }>)
      .map((j) => j.closingDate)
      .filter(Boolean) as Date[];
    const latestClosing = closingDates.length
      ? closingDates.reduce((a, b) => (a > b ? a : b))
      : null;

    return {
      collegeName: branding?.displayName ?? 'Don Bosco College, Tura',
      shortName: branding?.shortName ?? 'DBC Tura',
      address:
        sanitizeDisplayText(branding?.address) ??
        'Tura, West Garo Hills, Meghalaya',
      logoUrl:
        toPublicUploadUrl(branding?.logoUrl) ?? branding?.logoUrl ?? null,
      primaryColor: branding?.primaryColor ?? '#1e3a5f',
      accentColor: branding?.accentColor ?? '#c8102e',
      openVacancies: openCount,
      portalTitle: 'Join Our Academic Community',
      portalSubtitle:
        sanitizeDisplayText(branding?.portalSubtitle) ??
        'Build your career with one of the leading NAAC accredited institutions in Meghalaya.',
      contactPhone: '+91 3651 232 291',
      contactEmail: 'career@donboscocollege.ac.in',
      websiteUrl: 'https://donboscocollege.ac.in',
      whatsappSupport: '+91 98630 00000',
      stats: {
        openPositions: openCount,
        applicationsReceived,
        departmentsHiring,
        interviewsScheduled,
        facultyRecruited,
      },
      institutional: {
        facultyMembers: staffCount >= 20 ? staffCount : 150,
        students: studentCount >= 100 ? studentCount : 3000,
        departments: deptCount >= 5 ? deptCount : 17,
        naacGrade: naacFromBadges ?? 'NAAC B Grade',
        yearsOfExcellence: 39,
      },
      principalMessage: {
        name: careersExtras.principalName ?? 'Rev. Fr. Principal',
        title:
          careersExtras.principalTitle ?? 'Principal, Don Bosco College Tura',
        message:
          careersExtras.principalMessage ??
          'We welcome passionate educators who are committed to academic excellence, research, and the holistic development of our students. Join us in shaping the future of Northeast India.',
        photoUrl: toPublicUploadUrl(careersExtras.principalPhotoUrl) ?? null,
      },
      heroImages: (careersExtras.heroImages ?? [])
        .map((url) => toPublicUploadUrl(url))
        .filter(Boolean) as string[],
      hiringAlert:
        alertJobs.length > 0
          ? {
              active: true,
              headline: 'NOW HIRING',
              roles: roleLabels,
              closingDate: latestClosing?.toISOString() ?? null,
            }
          : null,
    };
  }

  listPublishedJobs(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.db().recruitmentVacancy.findMany({
      where: {
        tenantId,
        status: 'PUBLISHED',
        OR: [{ closingDate: null }, { closingDate: { gte: today } }],
      },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, label: true } },
      },
      orderBy: [{ closingDate: 'asc' }, { publishedAt: 'desc' }],
    });
  }

  async getJobBySlug(tenantId: string, slug: string) {
    const job = await this.db().recruitmentVacancy.findFirst({
      where: { tenantId, slug, status: 'PUBLISHED' },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, label: true } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.closingDate && job.closingDate < new Date()) {
      throw new NotFoundException('This vacancy has closed');
    }
    return job;
  }

  async submitApplication(
    tenantId: string,
    dto: SubmitCareersApplicationDto,
    remoteIp?: string,
  ) {
    if (dto.website?.trim()) {
      throw new BadRequestException('Could not submit application');
    }
    await verifyTurnstileToken(dto.turnstileToken, remoteIp);

    const vacancy = await this.db().recruitmentVacancy.findFirst({
      where: { id: dto.vacancyId, tenantId, status: 'PUBLISHED' },
    });
    if (!vacancy)
      throw new BadRequestException('Vacancy is not open for applications');

    if (vacancy.closingDate && vacancy.closingDate < new Date()) {
      throw new BadRequestException('Application deadline has passed');
    }

    const applicationNo = await this.nextApplicationNo(tenantId);

    const application = await this.db().recruitmentApplication.create({
      data: {
        tenantId,
        vacancyId: dto.vacancyId,
        applicationNo,
        fullName: dto.fullName.trim(),
        fatherName: dto.fatherName?.trim(),
        email: dto.email.trim().toLowerCase(),
        mobile: dto.mobile.trim(),
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        addressJson: dto.addressJson ?? undefined,
        qualification: dto.qualification,
        experienceYears: dto.experienceYears,
        applicationDetailsJson: dto.applicationDetailsJson ?? undefined,
        resumeUrl: dto.resumeUrl,
        photoUrl: dto.photoUrl,
        certificatesJson: dto.certificatesJson ?? undefined,
        source: 'PUBLIC',
        status: 'APPLIED',
      },
      include: { vacancy: { select: { title: true } } },
    });

    void this.notifications.applicationReceived(tenantId, application);
    void this.notifications.hrNewApplication(tenantId, application);

    return {
      applicationNo,
      applicationId: application.id,
      message: 'Application submitted successfully',
    };
  }

  async getApplicationStatus(
    tenantId: string,
    applicationNo: string,
    mobile: string,
  ) {
    const app = await this.db().recruitmentApplication.findFirst({
      where: {
        tenantId,
        applicationNo: applicationNo.trim().toUpperCase(),
        mobile: mobile.trim(),
      },
      include: {
        vacancy: {
          select: {
            title: true,
            slug: true,
            department: { select: { name: true } },
            designation: { select: { label: true } },
          },
        },
        interviews: {
          where: { status: 'SCHEDULED' },
          orderBy: { scheduledAt: 'asc' },
          take: 1,
        },
      },
    });
    if (!app) throw new NotFoundException('Application not found');

    const canUploadDocuments = !DOCUMENT_UPLOAD_BLOCKED.has(app.status);

    return {
      applicationNo: app.applicationNo,
      applicationId: app.id,
      fullName: app.fullName,
      status: app.status,
      appliedAt: app.appliedAt,
      canUploadDocuments,
      resumeUploaded: Boolean(app.resumeUrl),
      photoUploaded: Boolean(app.photoUrl),
      certificatesCount: Array.isArray(app.certificatesJson)
        ? app.certificatesJson.length
        : 0,
      vacancy: app.vacancy,
      interview: app.interviews?.[0]
        ? {
            scheduledAt: app.interviews[0].scheduledAt,
            venue: app.interviews[0].venue,
          }
        : null,
      timeline: buildCareersStatusTimeline(app.status),
    };
  }

  private async verifyApplicationAccess(
    tenantId: string,
    applicationNo: string,
    mobile: string,
  ) {
    const app = await this.db().recruitmentApplication.findFirst({
      where: {
        tenantId,
        applicationNo: applicationNo.trim().toUpperCase(),
        mobile: mobile.trim(),
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async uploadVerifiedDocument(
    tenantId: string,
    applicationNo: string,
    mobile: string,
    kind: string,
    file: Express.Multer.File,
  ) {
    const app = await this.verifyApplicationAccess(
      tenantId,
      applicationNo,
      mobile,
    );
    if (DOCUMENT_UPLOAD_BLOCKED.has(app.status)) {
      throw new BadRequestException(
        'Document upload is not available for this application',
      );
    }
    return this.persistUpload(tenantId, app.id, kind, file);
  }

  async persistUpload(
    tenantId: string,
    applicationId: string,
    kind: string,
    file: Express.Multer.File,
  ) {
    const app = await this.db().recruitmentApplication.findFirst({
      where: { id: applicationId, tenantId },
    });
    if (!app) throw new NotFoundException('Application not found');

    const url = await this.saveUpload(tenantId, applicationId, kind, file);

    if (kind === 'resume') {
      await this.db().recruitmentApplication.update({
        where: { id: applicationId },
        data: { resumeUrl: url },
      });
    } else if (kind === 'photo') {
      await this.db().recruitmentApplication.update({
        where: { id: applicationId },
        data: { photoUrl: url },
      });
    } else if (kind === 'certificate') {
      const existing = Array.isArray(app.certificatesJson)
        ? (app.certificatesJson as Array<{ name: string; url: string }>)
        : [];
      await this.db().recruitmentApplication.update({
        where: { id: applicationId },
        data: {
          certificatesJson: [
            ...existing,
            {
              name: file.originalname,
              url,
              uploadedAt: new Date().toISOString(),
            },
          ],
        },
      });
    }

    return { url, kind };
  }

  async saveUpload(
    tenantId: string,
    applicationId: string,
    kind: string,
    file: Express.Multer.File,
  ) {
    const dir = join(
      this.uploadRoot,
      tenantId,
      'recruitment-applications',
      applicationId,
    );
    await mkdir(dir, { recursive: true });
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${kind}-${Date.now()}-${safe}`;
    await writeFile(join(dir, filename), file.buffer);
    return `/uploads/tenants/${tenantId}/recruitment-applications/${applicationId}/${filename}`;
  }

  async ensureUniqueSlug(tenantId: string, title: string, excludeId?: string) {
    let base = slugify(title);
    if (!base) base = 'vacancy';
    let slug = base;
    let n = 2;
    while (true) {
      const existing = await this.db().recruitmentVacancy.findFirst({
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

  private async nextApplicationNo(tenantId: string) {
    const year = new Date().getFullYear();
    const seq = await this.db().recruitmentApplicationSequence.upsert({
      where: { tenantId_year: { tenantId, year } },
      create: { tenantId, year, currentNo: 1 },
      update: { currentNo: { increment: 1 } },
    });
    const no = seq.currentNo;
    return `DBC-APP-${year}-${String(no).padStart(5, '0')}`;
  }
}
