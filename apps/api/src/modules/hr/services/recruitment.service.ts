import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  CreateInterviewDto,
  CreateOfferDto,
  CreateRecruitmentApplicationDto,
  CreateVacancyDto,
  UpdateVacancyStatusDto,
} from '../dto/recruitment.dto';

@Injectable()
export class RecruitmentService {
  constructor(private readonly prisma: PrismaService) {}

  listVacancies(tenantId: string, status?: string) {
    return this.prisma.recruitmentVacancy.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  createVacancy(user: JwtUser, dto: CreateVacancyDto) {
    return this.prisma.recruitmentVacancy.create({
      data: {
        tenantId: user.tid,
        title: dto.title,
        departmentId: dto.departmentId,
        designationId: dto.designationId,
        staffType: dto.staffType,
        vacanciesCount: dto.vacanciesCount ?? 1,
        description: dto.description,
        closingDate: dto.closingDate ? new Date(dto.closingDate) : null,
        createdById: user.sub,
      },
    });
  }

  updateVacancyStatus(user: JwtUser, id: string, dto: UpdateVacancyStatusDto) {
    return this.prisma.recruitmentVacancy.update({
      where: { id, tenantId: user.tid },
      data: {
        status: dto.status,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : undefined,
      },
    });
  }

  listApplications(tenantId: string, vacancyId?: string) {
    return this.prisma.recruitmentApplication.findMany({
      where: { tenantId, ...(vacancyId ? { vacancyId } : {}) },
      include: {
        vacancy: { select: { title: true, status: true } },
        interviews: { orderBy: { scheduledAt: 'desc' }, take: 3 },
        offers: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { appliedAt: 'desc' },
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

  updateApplicationStatus(user: JwtUser, id: string, status: string) {
    return this.prisma.recruitmentApplication.update({
      where: { id, tenantId: user.tid },
      data: { status },
    });
  }

  scheduleInterview(user: JwtUser, dto: CreateInterviewDto) {
    return this.prisma.recruitmentInterview.create({
      data: {
        tenantId: user.tid,
        applicationId: dto.applicationId,
        scheduledAt: new Date(dto.scheduledAt),
        venue: dto.venue,
        panelJson: dto.panelJson as object | undefined,
        notes: dto.notes,
      },
    });
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
      this.prisma.recruitmentApplication.count({
        where: { tenantId, status: 'SUBMITTED' },
      }),
      this.prisma.recruitmentApplication.count({
        where: { tenantId, status: 'SHORTLISTED' },
      }),
      this.prisma.recruitmentInterview.count({
        where: { tenantId, status: 'SCHEDULED' },
      }),
      this.prisma.recruitmentOffer.count({
        where: { tenantId, status: 'SENT' },
      }),
      this.prisma.recruitmentApplication.count({
        where: { tenantId, status: 'HIRED' },
      }),
    ]).then(
      ([openVacancies, submitted, shortlisted, interviews, offers, hired]) => ({
        openVacancies,
        submitted,
        shortlisted,
        interviews,
        offers,
        hired,
      }),
    );
  }
}
