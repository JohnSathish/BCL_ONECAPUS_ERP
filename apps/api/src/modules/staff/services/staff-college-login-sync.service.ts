import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../database/prisma.service';
import {
  COLLEGE_EMAIL_DOMAIN,
  isOfficialCollegeEmail,
  normalizeEmail,
  officialCollegeEmail,
} from '../utils/staff-college-email.util';

/** Published in the faculty app notice. Shared only until first sign-in. */
const NOTICE_TEMP_PASSWORD = 'Dbcstaff@2026';
const NOTICE_PASSWORD_ACTION = 'staff_notice_temp_password_2026';

export type StaffCollegeLoginSyncStatus =
  | 'updated'
  | 'unchanged'
  | 'skipped'
  | 'conflict';

@Injectable()
export class StaffCollegeLoginSyncService implements OnModuleInit {
  private readonly logger = new Logger(StaffCollegeLoginSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.prepareStaffLogins().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Staff college login sync failed: ${message}`);
    });
  }

  async prepareStaffLogins() {
    await this.syncAll();
    await this.applyUnseenLoginPasswords();
  }

  /**
   * Point each staff portal login at the official college email already
   * stored on the staff record. Staff with only a personal address are left
   * unchanged.
   */
  async syncAll() {
    const rows = await this.prisma.staffProfile.findMany({
      where: { deletedAt: null, portalUserId: { not: null } },
      select: { id: true },
    });
    const counts = { updated: 0, unchanged: 0, skipped: 0, conflict: 0 };
    for (const row of rows) {
      const result = await this.syncStaffPortalLogin(row.id);
      counts[result.status] += 1;
    }
    this.logger.log(
      `Staff college login sync: ${counts.updated} updated, ${counts.unchanged} already matched, ${counts.skipped} left unchanged, ${counts.conflict} conflicts`,
    );
    return counts;
  }

  /**
   * One-time notice password for staff who have never signed in.
   * Accounts with a portal or app login are left unchanged.
   */
  async applyUnseenLoginPasswords() {
    const tenants = await this.prisma.staffProfile.findMany({
      where: { deletedAt: null, portalUserId: { not: null } },
      distinct: ['tenantId'],
      select: { tenantId: true },
    });
    let updated = 0;
    for (const { tenantId } of tenants) {
      const done = await this.prisma.auditLog.findFirst({
        where: { tenantId, action: NOTICE_PASSWORD_ACTION },
        select: { id: true },
      });
      if (done) continue;

      const count = await this.applyTenantNoticePasswords(tenantId);
      updated += count;
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          module: 'staff',
          action: NOTICE_PASSWORD_ACTION,
          entityType: 'StaffNotice',
          metadata: { updated: count },
        },
      });
      this.logger.log(
        `Temporary password set for ${count} staff accounts that have not signed in`,
      );
    }
    return { updated };
  }

  private async applyTenantNoticePasswords(tenantId: string) {
    const rows = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'ON_LEAVE'] },
        portalUser: {
          is: {
            deletedAt: null,
            isActive: true,
            lastLoginAt: null,
            refreshSessions: { none: {} },
            email: {
              endsWith: `@${COLLEGE_EMAIL_DOMAIN}`,
              mode: 'insensitive',
            },
          },
        },
      },
      select: { portalUserId: true, fullName: true },
    });
    const pending = rows.filter(
      (row): row is { portalUserId: string; fullName: string } =>
        Boolean(row.portalUserId),
    );
    if (!pending.length) return 0;

    const now = new Date();
    const passwordHash = await bcrypt.hash(NOTICE_TEMP_PASSWORD, 12);
    for (const row of pending) {
      await this.prisma.user.update({
        where: { id: row.portalUserId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          mustResetPassword: true,
        },
      });
      await this.prisma.passwordHistory.create({
        data: { userId: row.portalUserId, passwordHash },
      });
    }
    return pending.length;
  }

  async assertAvailable(tenantId: string, portalUserId: string, email: string) {
    const official = normalizeEmail(email);
    if (!official || !isOfficialCollegeEmail(official)) return;
    const taken = await this.findOtherUser(tenantId, portalUserId, official);
    if (taken) {
      throw new ConflictException(
        'Email is already used by another portal login',
      );
    }
  }

  async syncStaffPortalLogin(
    staffProfileId: string,
    options?: { strict?: boolean },
  ): Promise<{ status: StaffCollegeLoginSyncStatus; email?: string }> {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        fullName: true,
        email: true,
        publicEmail: true,
        personalEmail: true,
        portalUserId: true,
        portalUser: {
          select: { id: true, email: true, username: true, deletedAt: true },
        },
      },
    });
    if (
      !staff?.portalUserId ||
      !staff.portalUser ||
      staff.portalUser.deletedAt
    ) {
      return { status: 'skipped' };
    }

    const official = officialCollegeEmail(staff.email, staff.publicEmail);
    if (!official) return { status: 'skipped' };

    const current = normalizeEmail(staff.portalUser.email);
    if (current === official) return { status: 'unchanged', email: official };

    const taken = await this.findOtherUser(
      staff.tenantId,
      staff.portalUserId,
      official,
    );
    if (taken) {
      if (options?.strict) {
        throw new ConflictException(
          'Email is already used by another portal login',
        );
      }
      this.logger.warn(
        `Left ${staff.fullName} on ${current ?? 'their current login'}: ${official} is already used by another portal login`,
      );
      return { status: 'conflict', email: official };
    }

    const previousUsername = staff.portalUser.username?.trim() ?? '';
    const usernameFollowsEmail =
      !previousUsername || previousUsername.toLowerCase() === (current ?? '');
    let nextUsername: string | undefined;
    if (usernameFollowsEmail) {
      const usernameTaken = await this.prisma.user.findFirst({
        where: {
          tenantId: staff.tenantId,
          username: { equals: official, mode: 'insensitive' },
          NOT: { id: staff.portalUserId },
        },
        select: { id: true },
      });
      if (!usernameTaken) nextUsername = official;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: staff.portalUserId! },
          data: {
            email: official,
            ...(nextUsername ? { username: nextUsername } : {}),
          },
        });
        if (
          !staff.personalEmail?.trim() &&
          current &&
          !isOfficialCollegeEmail(current)
        ) {
          await tx.staffProfile.update({
            where: { id: staff.id },
            data: { personalEmail: current },
          });
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        if (options?.strict) {
          throw new ConflictException(
            'Email is already used by another portal login',
          );
        }
        this.logger.warn(
          `Left ${staff.fullName} unchanged: ${official} is already used by another portal login`,
        );
        return { status: 'conflict', email: official };
      }
      throw error;
    }

    this.logger.log(`Portal login for ${staff.fullName} is now ${official}`);
    return { status: 'updated', email: official };
  }

  private findOtherUser(tenantId: string, portalUserId: string, email: string) {
    return this.prisma.user.findFirst({
      where: {
        tenantId,
        email: { equals: email, mode: 'insensitive' },
        NOT: { id: portalUserId },
      },
      select: { id: true },
    });
  }
}
