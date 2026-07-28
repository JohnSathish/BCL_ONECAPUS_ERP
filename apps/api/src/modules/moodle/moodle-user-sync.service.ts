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
        department: true,
        programVersion: { include: { program: true } },
        academicStanding: true,
        academicProfile: true,
      },
    });
    if (!student?.user) return null;

    const username = this.usernameFor(student.enrollmentNumber);
    const existing = await this.prisma.moodleUser.findFirst({
      where: { tenantId, erpUserId: student.userId },
    });
    if (existing) return existing;

    const created = await this.api.call<
      Array<{ id: number; username: string }>
    >({
      tenantId,
      wsfunction: 'core_user_create_users',
      params: {
        users: [
          {
            username,
            password: this.tempPassword(),
            firstname: student.user.displayName?.split(' ')[0] || 'Student',
            lastname:
              student.user.displayName?.split(' ').slice(1).join(' ') ||
              student.enrollmentNumber,
            email: student.user.email,
            idnumber: student.enrollmentNumber,
            auth: 'manual',
          },
        ],
      },
    });

    const moodleUserId = created?.[0]?.id;
    if (!moodleUserId) throw new Error('Moodle user create returned no id');

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

    const username = this.usernameFor(staff.employeeCode);
    const created = await this.api.call<Array<{ id: number }>>({
      tenantId,
      wsfunction: 'core_user_create_users',
      params: {
        users: [
          {
            username,
            password: this.tempPassword(),
            firstname:
              staff.portalUser.displayName?.split(' ')[0] ||
              staff.fullName.split(' ')[0] ||
              'Faculty',
            lastname:
              staff.portalUser.displayName?.split(' ').slice(1).join(' ') ||
              staff.fullName,
            email: staff.portalUser.email,
            idnumber: staff.employeeCode,
            auth: 'manual',
          },
        ],
      },
    });
    const moodleUserId = created?.[0]?.id;
    if (!moodleUserId) throw new Error('Moodle user create returned no id');

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

  private usernameFor(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_')
      .slice(0, 90);
  }

  private tempPassword() {
    return `Erp_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }
}
