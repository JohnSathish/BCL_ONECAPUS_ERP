import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SCHOOL_SIS_PRODUCT } from './school-sis.constants';
import {
  daysRemainingFrom,
  fingerprintToken,
  verifySchoolLicense,
  type SchoolLicenseClaims,
} from './school-sis-license.crypto';
import { NAV_MODULE_LICENSE } from './school-sis-license.catalog';
import { SchoolSaasLicenseIssuerService } from './school-saas-license-issuer.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

const FRIENDLY: Record<string, string> = {
  INVALID_LICENSE:
    'The license key could not be verified. Please check the key and try again.',
  WRONG_PRODUCT:
    "That key is a college ERP license (Don Bosco), not a St. Luke's school license. Generate a school key in BaseCode Platform → School licenses. School keys start with BCL-SLS-.",
  EXPIRED: 'This license has expired. Please renew your ERP license.',
  WRONG_INSTITUTION: 'This license is not registered for this institution.',
  REVOKED:
    'This license has been revoked. Please contact BaseCode Labs support.',
  SUSPENDED:
    'This license has been suspended. Please contact BaseCode Labs support.',
  SERVER:
    'License verification is temporarily unavailable. Your existing license status remains valid during the configured offline grace period.',
  MODULE: 'Module not included in your license.',
  STUDENT_LIMIT: 'Student license limit reached. Please upgrade your license.',
  STAFF_LIMIT: 'Staff license limit reached. Please upgrade your license.',
};

@Injectable()
export class SchoolSisLicenseService {
  private readonly log = new Logger(SchoolSisLicenseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly issuer: SchoolSaasLicenseIssuerService,
  ) {}

  private publicKey() {
    return (
      this.config
        .get<string>('LICENSE_PUBLIC_KEY')
        ?.trim()
        ?.replace(/\\n/g, '') ?? ''
    );
  }

  private validationIntervalMs() {
    const raw = Number(this.config.get('LICENSE_VALIDATION_INTERVAL') ?? 86400);
    if (!Number.isFinite(raw) || raw <= 0) return 86_400_000;
    return raw * 1000;
  }

  async snapshot(tenantId: string) {
    const state = await this.prisma.schoolLicenseState.findUnique({
      where: { tenantId },
    });
    if (!state) {
      return this.emptySnapshot(tenantId);
    }
    return this.present(tenantId, state);
  }

  async publicStatus(tenantId: string) {
    const snap = await this.snapshot(tenantId);
    return {
      tone: snap.tone,
      label: snap.label,
      daysRemaining: snap.daysRemaining,
      expiresAt: snap.expiresAt,
      licenseType: snap.licenseType,
      institutionName: snap.institutionName,
      warning: snap.warning,
      expired: snap.tone === 'expired',
      modules: snap.enabledModules,
    };
  }

  async activate(
    tenantId: string,
    actor: JwtUser,
    body: {
      licenseKey: string;
      institutionName: string;
      institutionCode: string;
      adminEmail: string;
    },
    meta?: { ip?: string; userAgent?: string },
  ) {
    this.assertManage(actor);
    const tokenOrKey = body.licenseKey.trim();
    const issued = await this.resolveIssued(tokenOrKey);
    const claims = this.verifyToken(issued.signedToken);
    this.assertInstitution(claims, tenantId, body.institutionCode);
    this.assertNotRevoked(issued.status, claims);
    const installationId = await this.bindInstallation(
      tenantId,
      issued.id,
      actor,
      body,
      meta,
    );
    const next = await this.persistState(
      tenantId,
      issued.id,
      issued.licenseKey,
      issued.signedToken,
      claims,
      actor.sub,
      installationId,
    );
    await this.audit(tenantId, next.id, actor.sub, 'LICENSE_ACTIVATED', meta, {
      key: issued.licenseKey,
    });
    await this.prisma.schoolSaasLicense.update({
      where: { id: issued.id },
      data: { status: 'ACTIVE', activatedAt: new Date(), tenantId },
    });
    return this.present(tenantId, next);
  }

  async renew(
    tenantId: string,
    actor: JwtUser,
    body: { licenseKey: string },
    meta?: { ip?: string; userAgent?: string },
  ) {
    this.assertManage(actor);
    const issued = await this.resolveIssued(body.licenseKey.trim());
    const claims = this.verifyToken(issued.signedToken);
    this.assertInstitution(claims, tenantId, claims.instCode);
    this.assertNotRevoked(issued.status, claims);
    const prev = await this.prisma.schoolLicenseState.findUnique({
      where: { tenantId },
    });
    const next = await this.persistState(
      tenantId,
      issued.id,
      issued.licenseKey,
      issued.signedToken,
      claims,
      actor.sub,
    );
    await this.audit(tenantId, next.id, actor.sub, 'LICENSE_RENEWED', meta, {
      previousExpiry: prev
        ? (prev.claimsJson as SchoolLicenseClaims).exp
        : null,
      newExpiry: claims.exp,
    });
    return this.present(tenantId, next);
  }

  async validate(tenantId: string, actor: JwtUser | null, source = 'manual') {
    const state = await this.prisma.schoolLicenseState.findUnique({
      where: { tenantId },
    });
    if (!state) throw new BadRequestException(FRIENDLY.INVALID_LICENSE);
    try {
      const issued = await this.prisma.schoolSaasLicense.findFirst({
        where: { licenseKey: state.licenseKey ?? undefined },
      });
      if (issued?.status === 'REVOKED') throw new Error('REVOKED');
      if (issued?.status === 'SUSPENDED') throw new Error('SUSPENDED');
      const claims = this.verifyToken(state.signedToken);
      const next = await this.persistState(
        tenantId,
        issued?.id ?? state.licenseId,
        state.licenseKey,
        state.signedToken,
        claims,
        actor?.sub,
      );
      await this.prisma.schoolLicenseValidation.create({
        data: { tenantId, stateId: next.id, ok: true, source, message: 'ok' },
      });
      if (actor) {
        await this.audit(
          tenantId,
          next.id,
          actor.sub,
          'LICENSE_VALIDATED',
          {},
          { source },
        );
      }
      return this.present(tenantId, next);
    } catch (e) {
      const code = e instanceof Error ? e.message : 'INVALID_LICENSE';
      await this.prisma.schoolLicenseValidation.create({
        data: {
          tenantId,
          stateId: state.id,
          ok: false,
          source,
          message: FRIENDLY[code] ?? String(e),
        },
      });
      if (
        this.inOfflineGrace(state) &&
        (code === 'SERVER' || e instanceof HttpException)
      ) {
        return this.present(tenantId, state, FRIENDLY.SERVER);
      }
      throw this.httpFor(code);
    }
  }

  async deactivate(
    tenantId: string,
    actor: JwtUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    this.assertManage(actor);
    const state = await this.prisma.schoolLicenseState.findUnique({
      where: { tenantId },
    });
    if (!state) return { ok: true };
    await this.prisma.schoolSaasInstallation.updateMany({
      where: {
        tenantId,
        installationId: state.installationId,
        status: 'ACTIVE',
      },
      data: { status: 'DEACTIVATED', deactivatedAt: new Date() },
    });
    await this.audit(
      tenantId,
      state.id,
      actor.sub,
      'INSTALLATION_DEACTIVATED',
      meta,
    );
    await this.prisma.schoolLicenseState.delete({ where: { tenantId } });
    return { ok: true };
  }

  async events(tenantId: string, actor: JwtUser) {
    this.assertManage(actor);
    return this.prisma.schoolLicenseEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async assertModule(tenantId: string, moduleId: string) {
    const snap = await this.snapshot(tenantId);
    if (snap.tone === 'unlicensed' || snap.tone === 'validation') return;
    if (snap.tone === 'expired' && snap.expiredPolicy === 'lock') {
      throw new HttpException(
        {
          code: 'LICENSE_EXPIRED',
          message: `Your ERP license has expired. License expired on: ${this.fmt(snap.expiresAt)}. Please renew your license to continue using the ERP.`,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    if (snap.tone === 'expired' && snap.expiredPolicy === 'read_only') return;
    if (!snap.enabledModules.includes(moduleId)) {
      throw new ForbiddenException({
        code: 'LICENSE_MODULE',
        message: FRIENDLY.MODULE,
      });
    }
  }

  async assertWritable(tenantId: string) {
    const snap = await this.snapshot(tenantId);
    if (snap.tone === 'unlicensed') return;
    if (snap.tone === 'suspended' || snap.tone === 'revoked') {
      throw new ForbiddenException(FRIENDLY.REVOKED);
    }
    if (snap.tone === 'expired') {
      throw new HttpException(
        {
          code: 'LICENSE_EXPIRED',
          message: `Your ERP license has expired. License expired on: ${this.fmt(snap.expiresAt)}. Please renew your license to continue using the ERP.`,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  async assertStudentCapacity(tenantId: string) {
    const snap = await this.snapshot(tenantId);
    if (!snap.maxStudents) return;
    const count = await this.prisma.schoolStudent.count({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
    });
    if (count >= snap.maxStudents) {
      throw new ForbiddenException({
        code: 'LICENSE_STUDENT_LIMIT',
        message: FRIENDLY.STUDENT_LIMIT,
      });
    }
  }

  async assertStaffCapacity(tenantId: string) {
    const snap = await this.snapshot(tenantId);
    if (!snap.maxStaff) return;
    const count = await this.prisma.schoolStaff.count({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
    });
    if (count >= snap.maxStaff) {
      throw new ForbiddenException({
        code: 'LICENSE_STAFF_LIMIT',
        message: FRIENDLY.STAFF_LIMIT,
      });
    }
  }

  navAllowed(enabledModules: string[], navId: string) {
    const need = NAV_MODULE_LICENSE[navId];
    if (!need) return true;
    if (!enabledModules.length) return true;
    return enabledModules.includes(need);
  }

  @Cron('15 */6 * * *')
  async refreshDueValidations() {
    const due = await this.prisma.schoolLicenseState.findMany({
      where: { nextValidationAt: { lte: new Date() } },
      take: 50,
    });
    for (const row of due) {
      try {
        await this.validate(row.tenantId, null, 'scheduled');
      } catch (e) {
        this.log.warn(
          `Scheduled license validation failed for ${row.tenantId}: ${String(e)}`,
        );
      }
    }
  }

  private verifyToken(token: string): SchoolLicenseClaims {
    const pub = this.publicKey();
    if (!pub) throw this.httpFor('SERVER');
    try {
      return verifySchoolLicense(token, pub);
    } catch {
      throw this.httpFor('INVALID_LICENSE');
    }
  }

  private async resolveIssued(licenseKey: string) {
    if (isCollegeErpLicenseKey(licenseKey)) {
      throw this.httpFor('WRONG_PRODUCT');
    }
    if (licenseKey.startsWith('BCL1.')) {
      const claims = this.verifyToken(licenseKey);
      const row = await this.prisma.schoolSaasLicense.findFirst({
        where: { licenseKey: claims.key },
      });
      if (!row) throw this.httpFor('INVALID_LICENSE');
      if (
        fingerprintToken(licenseKey) !== row.tokenFingerprint &&
        licenseKey !== row.signedToken
      ) {
        const current = this.verifyToken(row.signedToken);
        if (current.key !== claims.key) throw this.httpFor('INVALID_LICENSE');
      }
      return row;
    }
    const row = await this.prisma.schoolSaasLicense.findUnique({
      where: { licenseKey },
    });
    if (!row) throw this.httpFor('INVALID_LICENSE');
    return row;
  }

  private assertInstitution(
    claims: SchoolLicenseClaims,
    tenantId: string,
    code: string,
  ) {
    const wanted = code.trim().toLowerCase();
    if (
      claims.instCode &&
      claims.instCode !== wanted &&
      claims.instId &&
      claims.instId !== tenantId
    ) {
      throw this.httpFor('WRONG_INSTITUTION');
    }
    if (claims.instCode && claims.instCode !== wanted && !claims.instId) {
      throw this.httpFor('WRONG_INSTITUTION');
    }
  }

  private assertNotRevoked(status: string, claims: SchoolLicenseClaims) {
    if (status === 'REVOKED' || claims.status === 'REVOKED')
      throw this.httpFor('REVOKED');
    if (status === 'SUSPENDED' || claims.status === 'SUSPENDED')
      throw this.httpFor('SUSPENDED');
  }

  private async bindInstallation(
    tenantId: string,
    licenseId: string,
    actor: JwtUser,
    body: { adminEmail: string },
    meta?: { ip?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.schoolLicenseState.findUnique({
      where: { tenantId },
    });
    const installationId = existing?.installationId ?? randomUUID();
    const license = await this.prisma.schoolSaasLicense.findUnique({
      where: { id: licenseId },
    });
    const active = await this.prisma.schoolSaasInstallation.count({
      where: { licenseId, status: 'ACTIVE' },
    });
    const already = await this.prisma.schoolSaasInstallation.findFirst({
      where: { licenseId, installationId },
    });
    if (!already && license && active >= license.installationLimit) {
      throw new ForbiddenException(
        'Installation limit reached for this license.',
      );
    }
    await this.prisma.schoolSaasInstallation.upsert({
      where: { licenseId_installationId: { licenseId, installationId } },
      update: {
        status: 'ACTIVE',
        lastSeenAt: new Date(),
        adminEmail: body.adminEmail,
        hostname: meta?.ip,
        deactivatedAt: null,
      },
      create: {
        licenseId,
        tenantId,
        installationId,
        adminEmail: body.adminEmail,
        hostname: meta?.ip,
      },
    });
    return installationId;
  }

  private async persistState(
    tenantId: string,
    licenseId: string | null | undefined,
    licenseKey: string | null | undefined,
    signedToken: string,
    claims: SchoolLicenseClaims,
    actorId?: string,
    installationId?: string,
  ) {
    const existing = await this.prisma.schoolLicenseState.findUnique({
      where: { tenantId },
    });
    const installId =
      installationId ?? existing?.installationId ?? randomUUID();
    const interval = this.validationIntervalMs();
    const now = new Date();
    return this.prisma.schoolLicenseState.upsert({
      where: { tenantId },
      update: {
        licenseId: licenseId ?? undefined,
        licenseKey,
        signedToken,
        claimsJson: claims as object,
        status: this.computeStatus(claims, now),
        lastValidatedAt: now,
        nextValidationAt: new Date(now.getTime() + interval),
        lastServerError: null,
        activatedAt: existing?.activatedAt ?? now,
        activatedBy: existing?.activatedBy ?? actorId,
      },
      create: {
        tenantId,
        licenseId,
        licenseKey,
        installationId: installId,
        signedToken,
        claimsJson: claims as object,
        status: this.computeStatus(claims, now),
        lastValidatedAt: now,
        nextValidationAt: new Date(now.getTime() + interval),
        activatedAt: now,
        activatedBy: actorId,
      },
    });
  }

  private computeStatus(claims: SchoolLicenseClaims, now: Date) {
    if (claims.status === 'REVOKED') return 'REVOKED';
    if (claims.status === 'SUSPENDED') return 'SUSPENDED';
    const days = daysRemainingFrom(claims.exp, now);
    if (days !== null && days < 0) return 'EXPIRED';
    return 'ACTIVE';
  }

  private inOfflineGrace(state: {
    lastValidatedAt: Date | null;
    claimsJson: unknown;
  }) {
    const hours = Number(
      (state.claimsJson as SchoolLicenseClaims)?.offlineHours ?? 72,
    );
    if (!state.lastValidatedAt) return false;
    return Date.now() - state.lastValidatedAt.getTime() < hours * 3600_000;
  }

  private async present(
    tenantId: string,
    state: {
      licenseKey: string | null;
      installationId: string;
      claimsJson: unknown;
      status: string;
      lastValidatedAt: Date | null;
      nextValidationAt: Date | null;
      lastServerError: string | null;
      activatedAt: Date | null;
      signedToken: string;
    },
    serverNote?: string,
  ) {
    const claims = state.claimsJson as SchoolLicenseClaims;
    const now = new Date();
    const days = daysRemainingFrom(claims.exp, now);
    const totalDays =
      claims.exp && claims.nbf
        ? Math.max(
            1,
            Math.round(
              (new Date(claims.exp).getTime() -
                new Date(claims.nbf).getTime()) /
                86400000,
            ),
          )
        : 365;
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    const extras =
      (branding?.portalExtrasJson as { schoolProduct?: string } | null) ?? {};
    const students = await this.prisma.schoolStudent.count({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
    });
    const staff = await this.prisma.schoolStaff.count({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
    });
    const installs = await this.prisma.schoolSaasInstallation.count({
      where: { tenantId, status: 'ACTIVE' },
    });
    const tone = this.tone(state.status, days);
    return {
      schoolProduct: extras.schoolProduct ?? SCHOOL_SIS_PRODUCT,
      tone,
      label: this.label(tone, days),
      licenseKey: state.licenseKey,
      licenseType: claims.type,
      institutionName: claims.instName || branding?.displayName,
      institutionId: tenantId,
      institutionCode: claims.instCode,
      activatedAt: state.activatedAt,
      validFrom: claims.nbf,
      expiresAt: claims.exp,
      daysRemaining: days,
      termDays: totalDays,
      progress:
        days == null
          ? 100
          : Math.max(
              0,
              Math.min(100, Math.round((Math.max(days, 0) / totalDays) * 100)),
            ),
      maxStudents: claims.maxStudents,
      maxStaff: claims.maxStaff,
      maxAdmins: claims.maxAdmins,
      studentsUsed: students,
      staffUsed: staff,
      enabledModules: claims.modules ?? [],
      installationLimit: claims.installLimit,
      installations: installs,
      installationId: state.installationId,
      licenseVersion: claims.licVer,
      lastValidatedAt: state.lastValidatedAt,
      nextValidationAt: state.nextValidationAt,
      licenseServerStatus: serverNote ? 'degraded' : 'ok',
      serverNote,
      warning: this.warning(tone, days, claims.exp),
      expiredPolicy: claims.expiredPolicy,
      status: state.status,
    };
  }

  private emptySnapshot(tenantId: string) {
    return {
      tone: 'unlicensed' as const,
      label: 'Validation Required',
      licenseKey: null,
      licenseType: null,
      institutionName: null,
      institutionId: tenantId,
      institutionCode: null,
      activatedAt: null,
      validFrom: null,
      expiresAt: null,
      daysRemaining: null,
      termDays: 365,
      progress: 0,
      maxStudents: null,
      maxStaff: null,
      maxAdmins: null,
      studentsUsed: 0,
      staffUsed: 0,
      enabledModules: [] as string[],
      installationLimit: null,
      installations: 0,
      installationId: null,
      licenseVersion: null,
      lastValidatedAt: null,
      nextValidationAt: null,
      licenseServerStatus: 'unknown',
      warning:
        'No ERP license is activated. Enter a license key from BaseCode Labs to activate this installation.',
      expiredPolicy: 'read_only' as const,
      status: 'MISSING',
    };
  }

  private tone(status: string, days: number | null) {
    if (status === 'REVOKED') return 'revoked';
    if (status === 'SUSPENDED') return 'suspended';
    if (status === 'EXPIRED' || (days !== null && days < 0)) return 'expired';
    if (days !== null && days <= 3) return 'expiring_very_soon';
    if (days !== null && days <= 15) return 'expiring_soon';
    if (status === 'ACTIVE') return 'active';
    return 'validation';
  }

  private label(tone: string, days: number | null) {
    if (tone === 'active') return 'Active';
    if (tone === 'expiring_soon') return 'Expiring Soon';
    if (tone === 'expiring_very_soon') return 'Expiring Very Soon';
    if (tone === 'expired') return 'Expired';
    if (tone === 'suspended') return 'Suspended';
    if (tone === 'revoked') return 'Revoked';
    return 'Validation Required';
  }

  private warning(tone: string, days: number | null, exp: string | null) {
    if (tone === 'expired') {
      return `Your ERP license has expired. License expired on: ${this.fmt(exp)}. Please renew your license to continue using the ERP.`;
    }
    const marks = [60, 30, 15, 7, 3, 1];
    if (days === null) return null;
    const hit = marks.find((m) => days <= m && days >= 0);
    if (!hit) return null;
    return `License expires in ${days} day${days === 1 ? '' : 's'}. Please contact the ERP administrator to renew your annual license.`;
  }

  private fmt(iso?: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private async audit(
    tenantId: string,
    stateId: string,
    actorId: string | undefined,
    event: string,
    meta?: { ip?: string; userAgent?: string },
    extra: Record<string, unknown> = {},
  ) {
    await this.prisma.schoolLicenseEvent.create({
      data: {
        tenantId,
        stateId,
        actorId,
        event,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        metaJson: extra as Prisma.InputJsonValue,
      },
    });
  }

  private assertManage(actor: JwtUser) {
    const p = actor.permissions ?? [];
    if (
      !p.includes('*') &&
      !p.includes('school-sis:manage') &&
      !p.includes('license:activate') &&
      !p.includes('license.manage')
    ) {
      throw new ForbiddenException(
        'Only authorised administrators can manage the ERP license.',
      );
    }
  }

  private httpFor(code: string): HttpException {
    const message = FRIENDLY[code] ?? FRIENDLY.INVALID_LICENSE;
    if (code === 'EXPIRED')
      return new HttpException({ code, message }, HttpStatus.PAYMENT_REQUIRED);
    if (code === 'SERVER')
      return new HttpException(
        { code, message },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    if (
      code === 'WRONG_INSTITUTION' ||
      code === 'REVOKED' ||
      code === 'SUSPENDED'
    ) {
      return new ForbiddenException({ code, message });
    }
    return new BadRequestException({ code, message });
  }
}

function isCollegeErpLicenseKey(key: string) {
  const k = key.trim().toUpperCase();
  if (k.startsWith('BCL-SLS-') || k.startsWith('BCL1.')) return false;
  return (
    /^BCL-\d{4}-/.test(k) || /^BCL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}/.test(k)
  );
}
