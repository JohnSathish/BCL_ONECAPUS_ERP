import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { UserProvisioningService } from '../../administration/services/user-provisioning.service';

@Injectable()
export class JournalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly provisioning: UserProvisioningService,
  ) {}

  async ensureRoles(tenantId: string) {
    for (const role of [
      {
        slug: 'journal_author',
        name: 'Journal Author',
        perms: ['journals:portal:author', 'notifications:read'],
      },
      {
        slug: 'journal_reviewer',
        name: 'Journal Reviewer',
        perms: ['journals:portal:reviewer', 'notifications:read'],
      },
    ]) {
      const row = await this.prisma.role.upsert({
        where: { tenantId_slug: { tenantId, slug: role.slug } },
        update: { name: role.name },
        create: {
          tenantId,
          slug: role.slug,
          name: role.name,
          isSystem: true,
        },
      });
      for (const slug of role.perms) {
        const perm = await this.prisma.permission.findFirst({
          where: { slug },
        });
        if (!perm) continue;
        const exists = await this.prisma.rolePermission.findFirst({
          where: { roleId: row.id, permissionId: perm.id },
        });
        if (!exists) {
          await this.prisma.rolePermission.create({
            data: { roleId: row.id, permissionId: perm.id },
          });
        }
      }
    }
  }

  async ensurePermissions() {
    for (const p of [
      {
        slug: 'journals:read',
        resource: 'journals',
        action: 'read',
        description: 'View journals CMS',
      },
      {
        slug: 'journals:manage',
        resource: 'journals',
        action: 'manage',
        description: 'Manage journals CMS and editorial workflow',
      },
      {
        slug: 'journals:portal:author',
        resource: 'journals',
        action: 'portal:author',
        description: 'Journal author portal self-service',
      },
      {
        slug: 'journals:portal:reviewer',
        resource: 'journals',
        action: 'portal:reviewer',
        description: 'Journal reviewer portal self-service',
      },
    ]) {
      await this.prisma.permission.upsert({
        where: { slug: p.slug },
        update: {
          resource: p.resource,
          action: p.action,
          description: p.description,
        },
        create: p,
      });
    }
  }

  async ensurePersonProfile(
    tenantId: string,
    userId: string,
    data?: {
      displayName?: string;
      email?: string;
      affiliation?: string;
      phone?: string;
      orcid?: string;
      bio?: string;
    },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) throw new BadRequestException('User not found');

    const existing = await this.prisma.journalPersonProfile.findFirst({
      where: { tenantId, userId },
    });
    if (existing) {
      return this.prisma.journalPersonProfile.update({
        where: { id: existing.id },
        data: {
          displayName: data?.displayName ?? existing.displayName,
          email: data?.email ?? existing.email,
          affiliation: data?.affiliation ?? existing.affiliation,
          phone: data?.phone ?? existing.phone,
          orcid: data?.orcid ?? existing.orcid,
          bio: data?.bio ?? existing.bio,
        },
      });
    }

    return this.prisma.journalPersonProfile.create({
      data: {
        tenantId,
        userId,
        displayName: data?.displayName || user.displayName || user.email,
        email: (data?.email || user.email).toLowerCase(),
        affiliation: data?.affiliation,
        phone: data?.phone || user.phone,
        orcid: data?.orcid,
        bio: data?.bio,
      },
    });
  }

  async register(
    tenantId: string,
    dto: {
      email: string;
      password: string;
      displayName: string;
      affiliation?: string;
      phone?: string;
      orcid?: string;
      department?: string;
      designation?: string;
      country?: string;
      asReviewer?: boolean;
    },
  ) {
    await this.ensurePermissions();
    await this.ensureRoles(tenantId);

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        'An account already exists for this email. Sign in with your existing password, or use a different email to register.',
      );
    }

    const roles = dto.asReviewer
      ? ['journal_author', 'journal_reviewer']
      : ['journal_author'];

    const { user } = await this.provisioning.ensureUserWithRoles(
      tenantId,
      email,
      roles,
      {
        password: dto.password,
        displayName: dto.displayName.trim(),
        phone: dto.phone,
        mustResetPassword: false,
        username: `jr_${email.split('@')[0]!.slice(0, 24)}_${randomBytes(2).toString('hex')}`,
      },
    );

    const bioParts = [
      dto.department ? `Department: ${dto.department.trim()}` : null,
      dto.designation ? `Designation: ${dto.designation.trim()}` : null,
      dto.country ? `Country: ${dto.country.trim()}` : null,
    ].filter(Boolean);

    const profile = await this.ensurePersonProfile(tenantId, user.id, {
      displayName: dto.displayName.trim(),
      email,
      affiliation: dto.affiliation?.trim(),
      phone: dto.phone?.trim(),
      orcid: dto.orcid?.trim() || undefined,
      bio: bioParts.length ? bioParts.join(' · ') : undefined,
    });

    return { userId: user.id, email, profile };
  }

  async login(
    tenantId: string,
    dto: { email: string; password: string; rememberMe?: boolean },
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    await this.ensurePermissions();
    await this.ensureRoles(tenantId);

    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { tenantId, email, deletedAt: null, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException(
        'No account found for this email. Check the spelling or register a new author account.',
      );
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account has no password set. Contact the editorial office or use ERP login.',
      );
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException(
        'Incorrect password. If you just registered, confirm you are using the same email address.',
      );
    }

    await this.ensurePersonProfile(tenantId, user.id, {
      displayName: user.displayName || email,
      email,
    });
    // ERP users logging in via journal portal get author role if missing
    await this.provisioning.attachRoles(tenantId, user.id, ['journal_author']);

    return this.auth.issueSessionForUser(
      tenantId,
      user.id,
      meta,
      dto.rememberMe,
    );
  }

  async me(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      include: {
        roles: { where: { deletedAt: null }, include: { role: true } },
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const profile = await this.ensurePersonProfile(tenantId, userId, {
      displayName: user.displayName || user.email,
      email: user.email,
    });

    const roleSlugs = user.roles.map((r) => r.role.slug);
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: roleSlugs,
      isAuthor:
        roleSlugs.includes('journal_author') ||
        roleSlugs.some((r) =>
          [
            'college-admin',
            'super-admin',
            'institution-admin',
            'faculty',
          ].includes(r),
        ),
      isReviewer: roleSlugs.includes('journal_reviewer'),
      isEditor: roleSlugs.some((r) =>
        ['college-admin', 'super-admin', 'institution-admin'].includes(r),
      ),
      profile,
    };
  }

  async ensureAuthorAccess(tenantId: string, userId: string) {
    await this.ensurePermissions();
    await this.ensureRoles(tenantId);
    await this.provisioning.attachRoles(tenantId, userId, ['journal_author']);
    return this.ensurePersonProfile(tenantId, userId);
  }

  async provisionReviewer(
    tenantId: string,
    email: string,
    displayName?: string,
  ) {
    await this.ensurePermissions();
    await this.ensureRoles(tenantId);
    const normalized = email.trim().toLowerCase();
    const tempPassword = `Jr!${randomBytes(4).toString('hex')}`;
    const { user, plainPassword } = await this.provisioning.ensureUserWithRoles(
      tenantId,
      normalized,
      ['journal_reviewer'],
      {
        password: tempPassword,
        displayName: displayName || normalized.split('@')[0],
        mustResetPassword: true,
        username: `jrv_${normalized.split('@')[0]!.slice(0, 24)}_${randomBytes(2).toString('hex')}`,
      },
    );
    await this.ensurePersonProfile(tenantId, user.id, {
      displayName: displayName || user.displayName || normalized,
      email: normalized,
    });
    return { user, plainPassword: plainPassword ?? tempPassword };
  }
}
