import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type {
  ActivateLicenseKeyDto,
  CreateLicenseKeyDto,
} from '../dto/licensing.dto';
import { LICENSE_TYPE_LABELS } from '../licensing.types';
import { LicenseAuditService } from './license-audit.service';
import { LicenseStatusService } from './license-status.service';

@Injectable()
export class LicenseActivationKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: LicenseAuditService,
    private readonly status: LicenseStatusService,
  ) {}

  normalizeKey(raw: string): string {
    return raw.trim().toUpperCase().replace(/\s+/g, '');
  }

  async listKeys(status?: string) {
    return this.prisma.licenseActivationKey.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createKeys(dto: CreateLicenseKeyDto, user: JwtUser) {
    const quantity = dto.quantity ?? 1;
    if (quantity < 1 || quantity > 50) {
      throw new BadRequestException('Quantity must be between 1 and 50');
    }

    const plan =
      dto.subscriptionPlan ??
      LICENSE_TYPE_LABELS[
        dto.licenseType as keyof typeof LICENSE_TYPE_LABELS
      ] ??
      dto.licenseType;

    const created = [];
    for (let i = 0; i < quantity; i += 1) {
      const row = await this.prisma.licenseActivationKey.create({
        data: {
          activationKey: await this.uniqueActivationKey(),
          label: dto.label,
          licenseType: dto.licenseType,
          subscriptionPlan: plan,
          termDays: dto.termDays,
          gracePeriodDays: dto.gracePeriodDays ?? 15,
          maxStudents: dto.maxStudents,
          maxStaff: dto.maxStaff,
          storageLimitMb: dto.storageLimitMb,
          keyExpiresAt: dto.keyExpiresAt
            ? new Date(dto.keyExpiresAt)
            : undefined,
          internalNotes: dto.internalNotes,
          createdById: user.sub,
        },
      });
      created.push(row);
    }

    return { items: created, total: created.length };
  }

  async revokeKey(id: string) {
    const key = await this.prisma.licenseActivationKey.findUnique({
      where: { id },
    });
    if (!key) throw new NotFoundException('Activation key not found');
    if (key.status === 'REDEEMED') {
      throw new BadRequestException('Redeemed keys cannot be revoked');
    }
    return this.prisma.licenseActivationKey.update({
      where: { id },
      data: { status: 'REVOKED' },
    });
  }

  async redeemKey(tenantId: string, user: JwtUser, dto: ActivateLicenseKeyDto) {
    const normalized = this.normalizeKey(dto.activationKey);
    const key = await this.prisma.licenseActivationKey.findUnique({
      where: { activationKey: normalized },
    });

    if (!key) throw new BadRequestException('Invalid license key');
    if (key.status === 'REDEEMED')
      throw new BadRequestException('This license key has already been used');
    if (key.status === 'REVOKED')
      throw new BadRequestException('This license key has been revoked');
    if (key.keyExpiresAt && new Date() > key.keyExpiresAt) {
      throw new BadRequestException('This license key has expired');
    }

    const now = new Date();
    let license = await this.prisma.tenantLicense.findUnique({
      where: { tenantId },
    });

    if (!license) {
      const licenseNumber = await this.nextLicenseNumber();
      const expiryDate = this.addDays(now, key.termDays);
      license = await this.prisma.tenantLicense.create({
        data: {
          tenantId,
          licenseNumber,
          licenseType: key.licenseType,
          subscriptionPlan: key.subscriptionPlan,
          startDate: now,
          expiryDate,
          renewalDate: now,
          gracePeriodDays: key.gracePeriodDays,
          maxStudents: key.maxStudents,
          maxStaff: key.maxStaff,
          storageLimitMb: key.storageLimitMb,
          createdById: user.sub,
        },
      });
      await this.audit.log(license.id, 'LICENSE_CREATED', user.sub, null, {
        source: 'activation_key',
        activationKeyId: key.id,
      });
    } else {
      const previousExpiry = license.expiryDate;
      const base =
        previousExpiry && previousExpiry > now
          ? new Date(previousExpiry)
          : new Date(now);
      const newExpiryDate = this.addDays(base, key.termDays);

      license = await this.prisma.tenantLicense.update({
        where: { id: license.id },
        data: {
          expiryDate: newExpiryDate,
          renewalDate: now,
          licenseType: key.licenseType,
          subscriptionPlan: key.subscriptionPlan,
          gracePeriodDays: key.gracePeriodDays,
          maxStudents: key.maxStudents ?? license.maxStudents,
          maxStaff: key.maxStaff ?? license.maxStaff,
          storageLimitMb: key.storageLimitMb ?? license.storageLimitMb,
          suspendedAt: null,
          suspendedById: null,
          suspensionReason: null,
        },
      });

      await this.prisma.licenseRenewal.create({
        data: {
          tenantLicenseId: license.id,
          previousExpiryDate: previousExpiry,
          newExpiryDate,
          notes: `Activated via license key ${key.activationKey}`,
          updatedById: user.sub,
        },
      });

      await this.audit.log(
        license.id,
        'LICENSE_KEY_REDEEMED',
        user.sub,
        { expiryDate: previousExpiry },
        {
          expiryDate: newExpiryDate,
          activationKeyId: key.id,
        },
      );
    }

    await this.prisma.licenseActivationKey.update({
      where: { id: key.id },
      data: {
        status: 'REDEEMED',
        redeemedAt: now,
        redeemedByTenantId: tenantId,
        redeemedByUserId: user.sub,
        tenantLicenseId: license.id,
      },
    });

    const computed = this.status.compute(license);
    return {
      success: true,
      message: 'License activated successfully',
      license: {
        licenseNumber: license.licenseNumber,
        subscriptionPlan: license.subscriptionPlan,
        expiryDate: license.expiryDate,
        ...computed,
      },
    };
  }

  private async uniqueActivationKey(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = this.formatActivationKey(randomBytes(8));
      const exists = await this.prisma.licenseActivationKey.findUnique({
        where: { activationKey: candidate },
      });
      if (!exists) return candidate;
    }
    throw new BadRequestException('Unable to generate activation key');
  }

  private formatActivationKey(bytes: Buffer): string {
    const hex = bytes.toString('hex').toUpperCase();
    const body = hex.slice(0, 16).padEnd(16, '0');
    return `BCLK-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${body.slice(12, 16)}`;
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  private async nextLicenseNumber() {
    const year = new Date().getFullYear();
    const count = await this.prisma.tenantLicense.count();
    return `BCL-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}
