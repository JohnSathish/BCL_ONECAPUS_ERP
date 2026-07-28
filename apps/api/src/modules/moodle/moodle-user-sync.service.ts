import { createHash, randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MoodleApiService } from './moodle-api.service';
import { MoodleEventsService } from './moodle-events.service';
import { MoodleSettingsService } from './moodle-settings.service';

@Injectable()
export class MoodleUserSyncService {
  private readonly logger = new Logger(MoodleUserSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: MoodleApiService,
    private readonly settings: MoodleSettingsService,
    private readonly events: MoodleEventsService,
  ) {}

  async syncStudent(tenantId: string, studentId: string) {
    const cfg = await this.prisma.moodleSettings.findUnique({
      where: { tenantId },
    });
    if (!cfg?.enableSync || !cfg.enableAutoUserCreation) return null;

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        user: true,
        masterProfile: true,
        department: true,
        programVersion: { include: { program: true } },
        academicStanding: true,
        academicProfile: true,
      },
    });
    if (!student?.user) return null;

    const existing = await this.prisma.moodleUser.findFirst({
      where: { tenantId, erpUserId: student.userId },
    });
    if (existing) return existing;

    const username = this.usernameFor(
      student.enrollmentNumber,
      student.user.email,
      student.userId,
    );
    const names = this.splitName(
      student.masterProfile?.fullName ||
        student.user.displayName ||
        student.enrollmentNumber ||
        'Student',
      'Student',
      student.enrollmentNumber || 'Learner',
    );

    const moodleUserId = await this.resolveOrCreateMoodleUser(tenantId, {
      username,
      firstname: names.firstname,
      lastname: names.lastname,
      email: student.user.email,
      idnumber: student.enrollmentNumber || username,
    });

    await this.prisma.student.update({
      where: { id: student.id },
      data: { moodleUserId },
    });

    const row = await this.prisma.moodleUser.create({
      data: {
        tenantId,
        erpUserId: student.userId,
        erpEntityType: 'STUDENT',
        erpEntityId: student.id,
        moodleUserId,
        username,
        email: student.user.email,
        syncStatus: 'SYNCED',
        lastSyncedAt: new Date(),
      },
    });

    await this.events.emit({
      tenantId,
      entityType: 'STUDENT',
      entityId: student.id,
      action: 'USER_CREATED',
      payload: { moodleUserId },
    });

    return row;
  }

  async syncStaff(tenantId: string, staffProfileId: string) {
    const cfg = await this.prisma.moodleSettings.findUnique({
      where: { tenantId },
    });
    if (!cfg?.enableSync || !cfg.enableAutoUserCreation) return null;

    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
      include: { portalUser: true },
    });
    if (!staff?.portalUserId || !staff.portalUser) return null;

    const existing = await this.prisma.moodleUser.findFirst({
      where: { tenantId, erpUserId: staff.portalUserId },
    });
    if (existing) return existing;

    const username = this.usernameFor(
      staff.employeeCode,
      staff.portalUser.email,
      staff.portalUserId,
    );
    const names = this.splitName(
      staff.portalUser.displayName || staff.fullName || staff.employeeCode,
      'Faculty',
      staff.employeeCode || 'Staff',
    );

    const moodleUserId = await this.resolveOrCreateMoodleUser(tenantId, {
      username,
      firstname: names.firstname,
      lastname: names.lastname,
      email: staff.portalUser.email,
      idnumber: staff.employeeCode || username,
    });

    await this.prisma.staffProfile.update({
      where: { id: staff.id },
      data: { moodleUserId },
    });

    return this.prisma.moodleUser.create({
      data: {
        tenantId,
        erpUserId: staff.portalUserId,
        erpEntityType: 'STAFF',
        erpEntityId: staff.id,
        moodleUserId,
        username,
        email: staff.portalUser.email,
        syncStatus: 'SYNCED',
        lastSyncedAt: new Date(),
      },
    });
  }

  private async resolveOrCreateMoodleUser(
    tenantId: string,
    input: {
      username: string;
      firstname: string;
      lastname: string;
      email: string;
      idnumber: string;
    },
  ) {
    const byEmail = await this.findMoodleUserId(tenantId, 'email', input.email);
    if (byEmail) return byEmail;

    const byUsername = await this.findMoodleUserId(
      tenantId,
      'username',
      input.username,
    );
    if (byUsername) return byUsername;

    try {
      const created = await this.api.call<
        Array<{ id: number; username: string }>
      >({
        tenantId,
        wsfunction: 'core_user_create_users',
        params: {
          users: [
            {
              username: input.username,
              // Let Moodle generate a policy-compliant password (SSO users won't need it).
              createpassword: 1,
              firstname: input.firstname,
              lastname: input.lastname,
              email: input.email,
              idnumber: input.idnumber,
              auth: 'manual',
            },
          ],
        },
      });

      const moodleUserId = created?.[0]?.id;
      if (!moodleUserId) throw new Error('Moodle user create returned no id');
      return moodleUserId;
    } catch (err) {
      // Common race/duplicate: email or username already exists in Moodle.
      const again =
        (await this.findMoodleUserId(tenantId, 'email', input.email)) ||
        (await this.findMoodleUserId(tenantId, 'username', input.username));
      if (again) return again;
      throw err;
    }
  }

  private async findMoodleUserId(
    tenantId: string,
    field: 'email' | 'username',
    value: string,
  ) {
    if (!value?.trim()) return null;
    try {
      const found = await this.api.call<Array<{ id: number }>>({
        tenantId,
        wsfunction: 'core_user_get_users_by_field',
        params: { field, values: [value.trim()] },
      });
      const id = found?.[0]?.id;
      return id ? Number(id) : null;
    } catch (err) {
      this.logger.debug(
        `Moodle lookup by ${field} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private splitName(
    fullName: string,
    fallbackFirst: string,
    fallbackLast: string,
  ) {
    const cleaned = fullName.replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      return { firstname: fallbackFirst, lastname: fallbackLast };
    }
    const parts = cleaned.split(' ');
    const firstname = (parts[0] || fallbackFirst).slice(0, 100);
    const lastname = (parts.slice(1).join(' ') || fallbackLast).slice(0, 100);
    return {
      firstname: firstname || fallbackFirst,
      lastname: lastname || fallbackLast,
    };
  }

  private usernameFor(
    primary?: string | null,
    email?: string | null,
    fallbackId?: string | null,
  ) {
    const fromPrimary = this.sanitizeUsername(primary ?? '');
    if (fromPrimary.length >= 2) return fromPrimary;

    const local = (email ?? '').split('@')[0] ?? '';
    const fromEmail = this.sanitizeUsername(local);
    if (fromEmail.length >= 2) return fromEmail;

    const hash = createHash('sha1')
      .update(fallbackId || email || primary || randomBytes(8))
      .digest('hex')
      .slice(0, 10);
    return `u_${hash}`;
  }

  private sanitizeUsername(value: string) {
    let out = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9._-]/g, '_')
      .replace(/^[._-]+/, '')
      .replace(/[._-]+$/, '')
      .slice(0, 90);
    if (out && /^[0-9]/.test(out)) out = `u_${out}`;
    return out;
  }
}
