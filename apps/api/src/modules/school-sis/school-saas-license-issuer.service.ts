import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { allSchoolLicenseModuleIds } from './school-sis-license.catalog';
import {
  fingerprintToken,
  generateHumanLicenseKey,
  signSchoolLicense,
  type SchoolLicenseClaims,
} from './school-sis-license.crypto';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class SchoolSaasLicenseIssuerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private privateKey() {
    const key = this.config.get<string>('LICENSE_PRIVATE_KEY')?.trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'License signing is not configured. Set LICENSE_PRIVATE_KEY on the license server only.',
      );
    }
    return key.replace(/\\n/g, '');
  }

  private publicKey() {
    const key = this.config.get<string>('LICENSE_PUBLIC_KEY')?.trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'LICENSE_PUBLIC_KEY is not configured.',
      );
    }
    return key.replace(/\\n/g, '');
  }

  async issue(
    actor: JwtUser,
    body: {
      institutionName: string;
      institutionCode: string;
      tenantId?: string;
      licenseType?: string;
      termDays?: number;
      maxStudents?: number;
      maxStaff?: number;
      installationLimit?: number;
      modules?: string[];
      validFrom?: string;
      notes?: string;
    },
  ) {
    const type = (body.licenseType || 'ANNUAL').toUpperCase();
    const termDays = body.termDays ?? (type === 'LIFETIME' ? 0 : 365);
    const nbf = body.validFrom ? new Date(body.validFrom) : new Date();
    const exp =
      type === 'LIFETIME' || termDays <= 0
        ? null
        : new Date(nbf.getTime() + termDays * 86400000);
    const id = randomUUID();
    const key = generateHumanLicenseKey(nbf.getUTCFullYear());
    const modules = body.modules?.length
      ? body.modules
      : allSchoolLicenseModuleIds();
    const claims: SchoolLicenseClaims = {
      v: 1,
      jti: id,
      key,
      instId: body.tenantId || '',
      instCode: body.institutionCode.trim().toLowerCase(),
      instName: body.institutionName.trim(),
      type,
      status: 'ISSUED',
      iat: new Date().toISOString(),
      nbf: nbf.toISOString(),
      exp: exp?.toISOString() ?? null,
      maxStudents: body.maxStudents ?? 2000,
      maxStaff: body.maxStaff ?? 250,
      maxAdmins: 50,
      installLimit: body.installationLimit ?? 3,
      modules,
      graceDays: 15,
      offlineHours: Number(
        this.config.get('LICENSE_OFFLINE_GRACE_PERIOD') ?? 72,
      ),
      expiredPolicy: 'read_only',
      licVer: '1.0',
    };
    const signedToken = signSchoolLicense(claims, this.privateKey());
    const row = await this.prisma.schoolSaasLicense.create({
      data: {
        id,
        licenseKey: key,
        tenantId: body.tenantId || null,
        institutionCode: claims.instCode,
        institutionName: claims.instName,
        licenseType: type,
        status: 'ISSUED',
        issuedAt: nbf,
        validFrom: nbf,
        expiresAt: exp,
        maxStudents: claims.maxStudents,
        maxStaff: claims.maxStaff,
        maxAdminUsers: claims.maxAdmins,
        installationLimit: claims.installLimit,
        modulesJson: modules,
        graceDays: 15,
        offlineGraceHours: claims.offlineHours,
        expiredPolicy: 'read_only',
        licenseVersion: '1.0',
        tokenFingerprint: fingerprintToken(signedToken),
        signedToken,
        notes: body.notes,
      },
    });
    await this.event(row.id, body.tenantId, actor.sub, 'LICENSE_ISSUED', {
      key,
    });
    return this.serialize(row, signedToken);
  }

  async list() {
    const rows = await this.prisma.schoolSaasLicense.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { _count: { select: { installations: true } } },
    });
    return rows.map((r) => this.serialize(r));
  }

  async get(id: string) {
    const row = await this.prisma.schoolSaasLicense.findUnique({
      where: { id },
      include: {
        installations: { orderBy: { activatedAt: 'desc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 80 },
        revocations: true,
      },
    });
    if (!row) throw new NotFoundException('License not found');
    return this.serialize(row, undefined, row);
  }

  async suspend(id: string, actor: JwtUser, reason?: string) {
    return this.setStatus(id, actor, 'SUSPENDED', 'LICENSE_SUSPENDED', reason);
  }

  async revoke(id: string, actor: JwtUser, reason?: string) {
    await this.prisma.schoolSaasRevocation.create({
      data: {
        licenseId: id,
        reason: reason || 'Revoked',
        revokedBy: actor.sub,
      },
    });
    return this.setStatus(id, actor, 'REVOKED', 'LICENSE_REVOKED', reason);
  }

  async activateIssued(id: string, actor: JwtUser) {
    return this.setStatus(id, actor, 'ACTIVE', 'LICENSE_ACTIVATED');
  }

  async renew(id: string, actor: JwtUser, days = 365) {
    const row = await this.require(id);
    const from =
      row.expiresAt && row.expiresAt > new Date() ? row.expiresAt : new Date();
    const expiresAt = new Date(from.getTime() + days * 86400000);
    return this.reissue(
      row.id,
      actor,
      { expiresAt, status: 'ACTIVE' },
      'LICENSE_RENEWED',
    );
  }

  async extend(id: string, actor: JwtUser, days = 30) {
    return this.renew(id, actor, days);
  }

  async patchLimits(
    id: string,
    actor: JwtUser,
    body: { maxStudents?: number; maxStaff?: number; modules?: string[] },
  ) {
    const row = await this.require(id);
    return this.reissue(
      row.id,
      actor,
      {
        maxStudents: body.maxStudents ?? row.maxStudents,
        maxStaff: body.maxStaff ?? row.maxStaff,
        modules: body.modules ?? (row.modulesJson as string[]),
      },
      'LICENSE_ENTITLEMENT_CHANGED',
    );
  }

  private async setStatus(
    id: string,
    actor: JwtUser,
    status: string,
    event: string,
    reason?: string,
  ) {
    const row = await this.require(id);
    if (status === 'REVOKED' && row.status === 'REVOKED') {
      throw new BadRequestException('License is already revoked');
    }
    return this.reissue(row.id, actor, { status }, event, { reason });
  }

  private async reissue(
    id: string,
    actor: JwtUser,
    patch: Record<string, unknown>,
    event: string,
    meta: Record<string, unknown> = {},
  ) {
    const row = await this.require(id);
    const modules =
      (patch.modules as string[] | undefined) ?? (row.modulesJson as string[]);
    const status = String(patch.status ?? row.status);
    const expiresAt = (patch.expiresAt as Date | undefined) ?? row.expiresAt;
    const claims: SchoolLicenseClaims = {
      v: 1,
      jti: row.id,
      key: row.licenseKey,
      instId: row.tenantId || '',
      instCode: row.institutionCode,
      instName: row.institutionName,
      type: row.licenseType,
      status,
      iat: new Date().toISOString(),
      nbf: row.validFrom.toISOString(),
      exp: expiresAt?.toISOString() ?? null,
      maxStudents: Number(patch.maxStudents ?? row.maxStudents),
      maxStaff: Number(patch.maxStaff ?? row.maxStaff),
      maxAdmins: row.maxAdminUsers,
      installLimit: row.installationLimit,
      modules,
      graceDays: row.graceDays,
      offlineHours: row.offlineGraceHours,
      expiredPolicy: row.expiredPolicy === 'lock' ? 'lock' : 'read_only',
      licVer: row.licenseVersion,
    };
    const signedToken = signSchoolLicense(claims, this.privateKey());
    const updated = await this.prisma.schoolSaasLicense.update({
      where: { id },
      data: {
        status,
        expiresAt,
        maxStudents: claims.maxStudents,
        maxStaff: claims.maxStaff,
        modulesJson: modules,
        tokenFingerprint: fingerprintToken(signedToken),
        signedToken,
      },
    });
    await this.event(id, row.tenantId, actor.sub, event, meta);
    return this.serialize(updated, signedToken);
  }

  private async require(id: string) {
    const row = await this.prisma.schoolSaasLicense.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('License not found');
    return row;
  }

  private async event(
    licenseId: string,
    tenantId: string | null | undefined,
    actorId: string | undefined,
    event: string,
    meta: Record<string, unknown> = {},
  ) {
    await this.prisma.schoolSaasLicenseEvent.create({
      data: {
        licenseId,
        tenantId: tenantId ?? undefined,
        actorId,
        event,
        metaJson: meta as Prisma.InputJsonValue,
      },
    });
  }

  serialize(
    row: {
      id: string;
      licenseKey: string;
      tenantId: string | null;
      institutionCode: string;
      institutionName: string;
      licenseType: string;
      status: string;
      issuedAt: Date;
      validFrom: Date;
      expiresAt: Date | null;
      activatedAt: Date | null;
      maxStudents: number;
      maxStaff: number;
      installationLimit: number;
      modulesJson: unknown;
      licenseVersion: string;
      _count?: { installations: number };
    },
    signedToken?: string,
    extra?: {
      installations?: unknown[];
      events?: unknown[];
    },
  ) {
    return {
      id: row.id,
      licenseKey: row.licenseKey,
      tenantId: row.tenantId,
      institutionCode: row.institutionCode,
      institutionName: row.institutionName,
      licenseType: row.licenseType,
      status: row.status,
      issuedAt: row.issuedAt,
      validFrom: row.validFrom,
      expiresAt: row.expiresAt,
      activatedAt: row.activatedAt,
      maxStudents: row.maxStudents,
      maxStaff: row.maxStaff,
      installationLimit: row.installationLimit,
      modules: row.modulesJson,
      licenseVersion: row.licenseVersion,
      installationCount: row._count?.installations,
      signedToken: signedToken || undefined,
      publicKeyConfigured: Boolean(this.config.get('LICENSE_PUBLIC_KEY')),
      installations: extra?.installations,
      events: extra?.events,
    };
  }

  assertIssuer(actor: JwtUser) {
    const perms = actor.permissions ?? [];
    if (
      !perms.includes('*') &&
      !perms.includes('platform:licenses:manage') &&
      !perms.includes('platform:licenses:read')
    ) {
      throw new ForbiddenException(
        'License administration is restricted to BaseCode Labs.',
      );
    }
  }
}
