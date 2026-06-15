import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CommunicationTriggerService } from '../communication/services/communication-trigger.service';

const PURPOSE = 'applicant_portal';
const TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AdmissionsPortalPasswordService {
  private readonly logger = new Logger(AdmissionsPortalPasswordService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly communication: CommunicationTriggerService,
    private readonly config: ConfigService,
  ) {}

  async requestReset(
    tenantId: string,
    input: { email?: string; applicationNumber?: string },
    portalOrigin: string,
  ) {
    const match = await this.resolveApplicant(tenantId, input);
    if (!match) {
      return { accepted: true as const };
    }

    const { user, application } = match;
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await this.prisma.passwordResetToken.updateMany({
      where: {
        tenantId,
        userId: user.id,
        purpose: PURPOSE,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    const record = await this.prisma.passwordResetToken.create({
      data: {
        tenantId,
        userId: user.id,
        tokenHash,
        purpose: PURPOSE,
        expiresAt,
      },
    });

    const resetLink = `${portalOrigin.replace(/\/$/, '')}/admissions-portal/reset-password?token=${encodeURIComponent(token)}`;
    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    const displayName =
      `${application.firstName} ${application.lastName}`.trim();

    await this.communication.trigger({
      tenantId,
      templateCode: 'APPLICANT_PASSWORD_RESET',
      triggerKey: 'admission.password_reset',
      entityType: 'password_reset',
      entityId: record.id,
      skipDedupe: true,
      channels: ['EMAIL'],
      recipient: {
        recipientType: 'USER',
        userId: user.id,
        displayName,
        email: application.email,
        phone: application.phone ?? undefined,
      },
      variables: {
        student_name: displayName,
        application_number: application.applicationNumber,
        reset_link: resetLink,
        expiry_minutes: '60',
        institution_name: institutionName,
      },
    });

    if (!this.config.get<string>('SMTP_HOST')) {
      this.logger.log(
        `[applicant-password-reset] to=${application.email} link=${resetLink}`,
      );
    }

    const devPreview =
      this.config.get<string>('NODE_ENV') !== 'production' &&
      !this.config.get<string>('SMTP_HOST');

    return {
      accepted: true as const,
      ...(devPreview ? { devResetLink: resetLink } : {}),
    };
  }

  async confirmReset(tenantId: string, token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);
    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        tenantId,
        tokenHash,
        purpose: PURPOSE,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: true,
      },
    });

    if (!record?.user || !record.user.isActive || record.user.deletedAt) {
      throw new UnauthorizedException('Invalid or expired reset link');
    }

    const application = await this.prisma.admissionApplication.findFirst({
      where: {
        tenantId,
        applicantUserId: record.userId,
        deletedAt: null,
      },
    });
    if (!application) {
      throw new UnauthorizedException('Invalid or expired reset link');
    }

    await this.auth.resetPasswordAndRevokeSessions(record.userId, newPassword);
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { mustResetPassword: false, passwordChangedAt: new Date() },
    });
    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return { success: true };
  }

  private async resolveApplicant(
    tenantId: string,
    input: { email?: string; applicationNumber?: string },
  ) {
    const email = input.email?.trim().toLowerCase();
    const applicationNumber = input.applicationNumber?.trim().toUpperCase();

    if (!email && !applicationNumber) return null;

    const application = await this.prisma.admissionApplication.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        applicantUserId: { not: null },
        ...(email ? { email } : {}),
        ...(applicationNumber ? { applicationNumber } : {}),
      },
      include: { applicantUser: true },
    });

    if (!application?.applicantUser) return null;
    return { application, user: application.applicantUser };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
