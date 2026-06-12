import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { LicenseWriteAction } from '../licensing.types';
import { LicenseStatusService } from './license-status.service';

const BLOCK_MESSAGE = 'License expired. Please renew your subscription.';

@Injectable()
export class LicenseEnforcementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: LicenseStatusService,
  ) {}

  async assertWriteAllowed(
    tenantId: string,
    action: LicenseWriteAction,
  ): Promise<void> {
    const license = await this.prisma.tenantLicense.findUnique({
      where: { tenantId },
    });
    if (!license) return;

    const computed = this.status.compute(license);
    if (computed.isWriteBlocked) {
      throw new ForbiddenException({
        message: BLOCK_MESSAGE,
        errorCode: 'LICENSE_WRITE_BLOCKED',
        action,
        status: computed.status,
      });
    }
  }
}
