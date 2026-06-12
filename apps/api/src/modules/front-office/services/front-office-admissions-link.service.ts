import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { nextFrontOfficeNumber } from '../utils/front-office-numbers';

@Injectable()
export class FrontOfficeAdmissionsLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async deskSummary(tenantId: string) {
    const [pendingReview, submittedToday, recentApplications] =
      await Promise.all([
        this.prisma.admissionApplication.count({
          where: {
            tenantId,
            deletedAt: null,
            status: { in: ['submitted', 'under_review', 'pending_documents'] },
          },
        }),
        this.prisma.admissionApplication.count({
          where: {
            tenantId,
            deletedAt: null,
            submittedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
        this.prisma.admissionApplication.findMany({
          where: { tenantId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            applicationNumber: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
            submittedAt: true,
          },
        }),
      ]);

    const linkedEnquiries = await this.prisma.frontOfficeEnquiry.count({
      where: {
        tenantId,
        admissionApplicationId: { not: null },
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });

    return {
      pendingReview,
      submittedToday,
      linkedEnquiries,
      recentApplications: recentApplications.map((a) => ({
        ...a,
        fullName: `${a.firstName} ${a.lastName}`.trim(),
        adminHref: `/admin/admissions?application=${a.id}`,
      })),
      admissionsHref: '/admin/admissions',
    };
  }

  async linkEnquiry(user: JwtUser, enquiryId: string, applicationId: string) {
    const enquiry = await this.prisma.frontOfficeEnquiry.findFirst({
      where: { tenantId: user.tid, id: enquiryId },
    });
    if (!enquiry) throw new NotFoundException('Enquiry not found');

    const application = await this.prisma.admissionApplication.findFirst({
      where: { tenantId: user.tid, id: applicationId, deletedAt: null },
    });
    if (!application)
      throw new NotFoundException('Admission application not found');

    return this.prisma.frontOfficeEnquiry.update({
      where: { id: enquiryId },
      data: {
        admissionApplicationId: applicationId,
        programmeInterest:
          enquiry.programmeInterest ?? application.applicationNumber,
      },
    });
  }

  async createEnquiryFromApplication(user: JwtUser, applicationId: string) {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { tenantId: user.tid, id: applicationId, deletedAt: null },
    });
    if (!application)
      throw new NotFoundException('Admission application not found');

    const existing = await this.prisma.frontOfficeEnquiry.findFirst({
      where: {
        tenantId: user.tid,
        admissionApplicationId: applicationId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });
    if (existing) return existing;

    const enquiryNo = await nextFrontOfficeNumber(
      this.prisma,
      user.tid,
      'FO-E',
      'enquiry',
    );

    return this.prisma.frontOfficeEnquiry.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        enquiryNo,
        enquiryType: 'ADMISSION',
        fullName: `${application.firstName} ${application.lastName}`.trim(),
        mobile: application.phone,
        email: application.email,
        programmeInterest: application.applicationNumber,
        source: 'ADMISSIONS_DESK',
        notes: `Linked to application ${application.applicationNumber}`,
        admissionApplicationId: applicationId,
        createdById: user.sub,
        status: 'OPEN',
      },
    });
  }
}
