import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PlacementService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  // Recruiters
  listRecruiters(tenantId: string) {
    return this.db().placementRecruiter.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  createRecruiter(
    user: JwtUser,
    dto: {
      name: string;
      contactEmail?: string;
      contactPhone?: string;
      industry?: string;
      website?: string;
    },
  ) {
    return this.db().placementRecruiter.create({
      data: {
        tenantId: user.tid,
        name: dto.name.trim(),
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        industry: dto.industry,
        website: dto.website,
      },
    });
  }

  // Drives
  listDrives(tenantId: string, recruiterId?: string) {
    return this.db().placementDrive.findMany({
      where: {
        tenantId,
        ...(recruiterId ? { recruiterId } : {}),
      },
      include: { recruiter: true, applications: true },
      orderBy: { driveDate: 'desc' },
    });
  }

  createDrive(
    user: JwtUser,
    dto: {
      recruiterId: string;
      title: string;
      driveDate?: string;
      jobRole?: string;
      packageLpa?: number;
      eligibility?: Record<string, unknown>;
      status?: string;
    },
  ) {
    return this.db().placementDrive.create({
      data: {
        tenantId: user.tid,
        recruiterId: dto.recruiterId,
        title: dto.title.trim(),
        driveDate: dto.driveDate ? new Date(dto.driveDate) : null,
        jobRole: dto.jobRole,
        packageLpa: dto.packageLpa,
        eligibility: dto.eligibility ?? {},
        status: dto.status ?? 'DRAFT',
      },
    });
  }

  // Applications
  listApplications(tenantId: string, driveId?: string) {
    return this.db().placementApplication.findMany({
      where: {
        tenantId,
        ...(driveId ? { driveId } : {}),
      },
      include: { drive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async apply(
    user: JwtUser,
    dto: { driveId: string; studentId: string; status?: string },
  ) {
    const drive = await this.db().placementDrive.findFirst({
      where: { id: dto.driveId, tenantId: user.tid },
    });
    if (!drive) throw new NotFoundException('Drive not found');
    return this.db().placementApplication.create({
      data: {
        tenantId: user.tid,
        driveId: dto.driveId,
        studentId: dto.studentId,
        status: dto.status ?? 'APPLIED',
      },
    });
  }

  async updateApplicationStatus(tenantId: string, id: string, status: string) {
    const row = await this.db().placementApplication.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Application not found');
    return this.db().placementApplication.update({
      where: { id },
      data: { status },
    });
  }
}
