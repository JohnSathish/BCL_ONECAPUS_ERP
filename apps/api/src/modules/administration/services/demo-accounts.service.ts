import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import {
  COLLEGE_IOS_BUNDLE_ID,
  FcmPushService,
} from '../../communication/services/fcm-push.service';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';

const DEMO = 'DEMO';
const STUDENT_LOGIN = 'DEMO-STUDENT';
const STAFF_LOGIN = 'DEMO-STAFF';
const STUDENT_PASSWORD = 'DemoStudent@2026';
const STAFF_PASSWORD = 'DemoStaff@2026';

type DemoKind = 'STUDENT' | 'STAFF';

@Injectable()
export class DemoAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: UserNotificationsService,
    private readonly fcm: FcmPushService,
  ) {}

  async list(tenantId: string) {
    const created = await this.ensureDefaults(tenantId);
    const users = await this.prisma.user.findMany({
      where: { tenantId, accountType: DEMO, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        student: {
          select: { id: true, rollNumber: true, enrollmentNumber: true },
        },
        staffProfile: {
          select: { id: true, employeeCode: true, fullName: true },
        },
        roles: {
          where: { deletedAt: null },
          include: { role: { select: { slug: true } } },
        },
      },
    });
    return {
      created,
      accounts: users.map((user) => this.toRow(user)),
    };
  }

  async create(
    tenantId: string,
    input: {
      kind: DemoKind;
      loginId?: string;
      displayName?: string;
      password?: string;
    },
  ) {
    const loginId = (
      input.loginId?.trim() || this.nextLogin(input.kind)
    ).toUpperCase();
    if (!/^DEMO-[A-Z0-9-]{2,40}$/.test(loginId)) {
      throw new BadRequestException('Demo login IDs must start with DEMO-.');
    }
    const password = input.password?.trim() || this.generatedPassword();
    this.assertPassword(password);
    const account = await this.provision(tenantId, {
      kind: input.kind,
      loginId,
      displayName:
        input.displayName?.trim() ||
        (input.kind === 'STUDENT' ? 'Demo Student' : 'Demo Staff'),
      password,
    });
    return { ...account, password };
  }

  async resetPassword(tenantId: string, userId: string, password?: string) {
    const user = await this.requireDemo(tenantId, userId);
    const next = password?.trim() || this.generatedPassword();
    this.assertPassword(next);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(next, 12),
        mustResetPassword: false,
        passwordChangedAt: new Date(),
      },
    });
    return { userId: user.id, password: next };
  }

  async setActive(tenantId: string, userId: string, active: boolean) {
    const user = await this.requireDemo(tenantId, userId);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isActive: active, accountStatus: active ? 'active' : 'disabled' },
    });
    return { userId: user.id, active };
  }

  async devices(tenantId: string, userId: string) {
    await this.requireDemo(tenantId, userId);
    const rows = await this.prisma.mobileDevice.findMany({
      where: { tenantId, userId },
      orderBy: { lastSeenAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      appType: row.appType,
      platform: row.platform,
      deviceModel: row.deviceModel,
      appVersion: row.appVersion,
      status: row.status,
      hasPushToken: Boolean(row.pushToken),
      lastSeenAt: row.lastSeenAt.toISOString(),
    }));
  }

  async notificationHistory(tenantId: string, userId: string) {
    await this.requireDemo(tenantId, userId);
    const rows = await this.prisma.demoNotificationTest.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const notificationIds = rows
      .map((row) => row.notificationId)
      .filter((id): id is string => Boolean(id));
    const notifications = notificationIds.length
      ? await this.prisma.userNotification.findMany({
          where: { id: { in: notificationIds } },
          select: { id: true, readAt: true },
        })
      : [];
    const readAt = new Map(notifications.map((row) => [row.id, row.readAt]));
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      pushStatus: row.pushStatus,
      pushDetail: row.pushDetail,
      createdAt: row.createdAt.toISOString(),
      readAt: row.notificationId
        ? (readAt.get(row.notificationId)?.toISOString() ?? null)
        : null,
    }));
  }

  async sendTest(
    actor: JwtUser,
    userId: string,
    input: { title?: string; body?: string },
  ) {
    const user = await this.requireDemo(actor.tid, userId);
    const title = input.title?.trim() || 'Demo notification';
    const body =
      input.body?.trim() ||
      'This is a test notification for the demo account. It stays in the in-app notification menu.';
    const inbox = await this.notifications.createInApp({
      tenantId: actor.tid,
      userId: user.id,
      type: 'DEMO_PUSH_TEST',
      title,
      body,
      metadata: {
        source: 'demo_account_test',
        category: 'general',
      },
    });
    const devices = await this.prisma.mobileDevice.findMany({
      where: {
        tenantId: actor.tid,
        userId: user.id,
        status: 'ACTIVE',
        pushToken: { not: null },
      },
      select: { pushToken: true },
    });
    const tokens = devices
      .map((row) => row.pushToken)
      .filter((token): token is string => Boolean(token));
    const push = tokens.length
      ? await this.fcm.sendToTokens(tokens, {
          title,
          body,
          apnsBundleId: COLLEGE_IOS_BUNDLE_ID,
          data: {
            notificationId: inbox?.id ?? '',
            category: 'general',
            type: 'DEMO_PUSH_TEST',
          },
        })
      : {
          ok: false,
          provider: 'fcm',
          error: 'No device has registered a push token yet',
        };
    const pushStatus = !tokens.length
      ? 'NO_DEVICE'
      : push.ok
        ? 'SENT'
        : 'FAILED';
    const saved = await this.prisma.demoNotificationTest.create({
      data: {
        tenantId: actor.tid,
        userId: user.id,
        sentById: actor.sub,
        title,
        body,
        pushStatus,
        pushDetail: push.ok
          ? `Delivered to ${push.successCount ?? tokens.length} device(s)`
          : (push.error ?? 'Push was not accepted'),
        notificationId: inbox?.id,
      },
    });
    return {
      id: saved.id,
      pushStatus,
      pushDetail: saved.pushDetail,
      inApp: Boolean(inbox?.id),
    };
  }

  private async ensureDefaults(tenantId: string) {
    const created: Array<{
      kind: DemoKind;
      loginId: string;
      password: string;
    }> = [];
    const student = await this.findLogin(tenantId, STUDENT_LOGIN);
    if (!student) {
      await this.provision(tenantId, {
        kind: 'STUDENT',
        loginId: STUDENT_LOGIN,
        displayName: 'Demo Student',
        password: STUDENT_PASSWORD,
      });
      created.push({
        kind: 'STUDENT',
        loginId: STUDENT_LOGIN,
        password: STUDENT_PASSWORD,
      });
    }
    const staff = await this.findLogin(tenantId, STAFF_LOGIN);
    if (!staff) {
      await this.provision(tenantId, {
        kind: 'STAFF',
        loginId: STAFF_LOGIN,
        displayName: 'Demo Staff',
        password: STAFF_PASSWORD,
      });
      created.push({
        kind: 'STAFF',
        loginId: STAFF_LOGIN,
        password: STAFF_PASSWORD,
      });
    }
    return created;
  }

  private async provision(
    tenantId: string,
    input: {
      kind: DemoKind;
      loginId: string;
      displayName: string;
      password: string;
    },
  ) {
    const existing = await this.findLogin(tenantId, input.loginId);
    if (existing)
      throw new ConflictException(`${input.loginId} is already in use.`);
    const email = `${input.loginId.toLowerCase()}@demo.onecampus.invalid`;
    const passwordHash = await bcrypt.hash(input.password, 12);
    const role = await this.roleFor(tenantId, input.kind);
    if (!role) {
      throw new BadRequestException(
        input.kind === 'STUDENT'
          ? 'The student role is not set up for this college.'
          : 'The faculty role is not set up for this college.',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId,
          email,
          username: input.loginId,
          displayName: input.displayName,
          passwordHash,
          emailVerifiedAt: new Date(),
          isActive: true,
          accountStatus: 'active',
          accountType: DEMO,
          mustResetPassword: false,
        },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
      if (input.kind === 'STUDENT') {
        const student = await tx.student.create({
          data: {
            tenantId,
            userId: user.id,
            enrollmentNumber: input.loginId,
            rollNumber: input.loginId,
            accountType: DEMO,
          },
        });
        await tx.studentProfile.create({
          data: {
            tenantId,
            studentId: student.id,
            fullName: input.displayName,
            email,
            studentStatus: 'DEMO',
            admissionStatus: 'DEMO',
          },
        });
      } else {
        await tx.staffProfile.create({
          data: {
            tenantId,
            portalUserId: user.id,
            employeeCode: input.loginId,
            fullName: input.displayName,
            email,
            staffType: 'TEACHING',
            employmentType: 'DEMO',
            employeeCodeAutoGenerated: false,
            status: 'ACTIVE',
            accountType: DEMO,
            showOnWebsite: false,
          },
        });
      }
      return {
        userId: user.id,
        kind: input.kind,
        loginId: input.loginId,
        displayName: input.displayName,
      };
    });
  }

  private async roleFor(tenantId: string, kind: DemoKind) {
    const slugs = kind === 'STUDENT' ? ['student'] : ['faculty', 'staff'];
    return this.prisma.role.findFirst({
      where: { tenantId, slug: { in: slugs }, deletedAt: null },
      orderBy: { slug: 'asc' },
    });
  }

  private async findLogin(tenantId: string, loginId: string) {
    return this.prisma.user.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { username: { equals: loginId, mode: 'insensitive' } },
          {
            email: {
              equals: `${loginId.toLowerCase()}@demo.onecampus.invalid`,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: { id: true },
    });
  }

  private async requireDemo(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, accountType: DEMO, deletedAt: null },
      include: { student: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('Demo account not found.');
    return user;
  }

  private toRow(user: {
    id: string;
    displayName: string | null;
    email: string;
    username: string | null;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    student: { rollNumber: string | null; enrollmentNumber: string } | null;
    staffProfile: { employeeCode: string; fullName: string } | null;
    roles: Array<{ role: { slug: string } }>;
  }) {
    const kind: DemoKind = user.student ? 'STUDENT' : 'STAFF';
    return {
      userId: user.id,
      kind,
      displayName:
        user.displayName || user.staffProfile?.fullName || 'Demo account',
      loginId:
        user.student?.rollNumber ||
        user.staffProfile?.employeeCode ||
        user.username ||
        user.email,
      email: user.email,
      active: user.isActive,
      roles: user.roles.map((row) => row.role.slug),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private nextLogin(kind: DemoKind) {
    const suffix = randomBytes(2).toString('hex').toUpperCase();
    return kind === 'STUDENT' ? `DEMO-STU-${suffix}` : `DEMO-STF-${suffix}`;
  }

  private generatedPassword() {
    return `Demo-${randomBytes(4).toString('hex')}A1`;
  }

  private assertPassword(password: string) {
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }
  }
}
