import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class LicenseAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    tenantLicenseId: string,
    action: string,
    actorId: string | undefined,
    previousValue?: unknown,
    newValue?: unknown,
  ) {
    await this.prisma.licenseAuditLog.create({
      data: {
        tenantLicenseId,
        action,
        actorId,
        previousValue: previousValue ? (previousValue as object) : undefined,
        newValue: newValue ? (newValue as object) : undefined,
      },
    });
  }

  async list(tenantLicenseId: string, limit = 50) {
    return this.prisma.licenseAuditLog.findMany({
      where: { tenantLicenseId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
