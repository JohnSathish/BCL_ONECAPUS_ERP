import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { renderBirthdayWishesPdf } from './birthday-wishes-report.document';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import { PrismaService } from '../../../database/prisma.service';
import { QueueService } from '../../../shared/queue/queue.service';
import {
  addCalendarDays,
  birthdayChannels,
  birthdayVariables,
  classifyWish,
  daysInMonth,
  istCalendar,
  istDayBounds,
  monthDayPairs,
  normalizeBirthdayTemplate,
  normalizeSendTime,
  type BirthdayChannel,
  type BirthdayWhen,
  type BirthdayWishStatus,
  type CalendarDate,
} from '../domain/birthday-calendar';
import type {
  BirthdayHistoryQueryDto,
  BirthdayListQueryDto,
  PreviewBirthdayWishDto,
  SaveBirthdaySettingsDto,
  SaveBirthdayTemplateDto,
  SendBirthdayWishesDto,
} from '../dto/birthday-wishes.dto';
import { BirthdayNotificationService } from './birthday-notification.service';
import { BirthdayQueryService } from './birthday-query.service';
import { CommunicationTemplateRendererService } from './communication-template-renderer.service';
import { CommunicationTriggerService } from './communication-trigger.service';

const SETTINGS_CODE = 'birthday.wishes.settings';
const DIRECTORY_CAP = 1500;
const CARD_CODES = ['STUDENT_BIRTHDAY_CARD', 'STAFF_BIRTHDAY_CARD'] as const;

type DirectoryRow = {
  id: string;
  userId: string | null;
  fullName: string;
  code: string | null;
  department: string | null;
  programme: string | null;
  semester: number | null;
  dateOfBirth: Date | string;
  contact: string | null;
  email: string | null;
  photoPath: string | null;
  staffType: string | null;
  month: number;
  day: number;
};

type WishSettings = {
  enabled: boolean;
  studentsEnabled: boolean;
  staffEnabled: boolean;
  sendTime: string;
  channels: BirthdayChannel[];
  studentTemplateCode: string;
  staffTemplateCode: string;
  upcomingReminders: boolean;
  preventDuplicates: boolean;
  notifyPeers: boolean;
  lastRunDate: string | null;
};

const DEFAULT_SETTINGS: WishSettings = {
  enabled: true,
  studentsEnabled: true,
  staffEnabled: true,
  sendTime: '08:00',
  channels: ['IN_APP', 'PUSH'],
  studentTemplateCode: 'STUDENT_BIRTHDAY_SELF',
  staffTemplateCode: 'STAFF_BIRTHDAY_SELF',
  upcomingReminders: false,
  preventDuplicates: true,
  notifyPeers: true,
  lastRunDate: null,
};

@Injectable()
export class BirthdayWishesService {
  private readonly logger = new Logger(BirthdayWishesService.name);
  private readonly retryAfter = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly query: BirthdayQueryService,
    private readonly notifications: BirthdayNotificationService,
    private readonly triggers: CommunicationTriggerService,
    private readonly renderer: CommunicationTemplateRendererService,
    private readonly queue: QueueService,
  ) {}

  async overview(tenantId: string) {
    const today = istCalendar();
    const year = today.year;
    const upcoming = monthDayPairs(addCalendarDays(today, 1), 7);
    const [
      studentsToday,
      staffToday,
      upcomingStudents,
      upcomingStaff,
      sentToday,
      failedToday,
    ] = await Promise.all([
      this.countStudents(tenantId, [{ month: today.month, day: today.day }]),
      this.countStaff(
        tenantId,
        [{ month: today.month, day: today.day }],
        'ALL',
      ),
      this.countStudents(tenantId, upcoming),
      this.countStaff(tenantId, upcoming, 'ALL'),
      this.countSentToday(tenantId, today),
      this.countFailedToday(tenantId, today),
    ]);
    const wished = await this.countWishedTodayPeople(tenantId, year, today);
    const pending = Math.max(0, studentsToday + staffToday - wished);
    return {
      todayStudents: studentsToday,
      todayStaff: staffToday,
      upcoming: upcomingStudents + upcomingStaff,
      sentToday,
      pending,
      failed: failedToday,
      timezone: 'Asia/Kolkata',
      date: today.dateKey,
    };
  }

  async list(tenantId: string, query: BirthdayListQueryDto) {
    const today = istCalendar();
    const audience = query.audience ?? 'STUDENT';
    const window = query.window ?? 'today';
    const pairs = this.pairsFor(today, window, query.month, query.day);
    const search = query.search?.trim() ?? '';
    const staffType = query.staffType ?? 'ALL';
    const rows =
      audience === 'STUDENT'
        ? await this.studentDirectory(tenantId, pairs, search)
        : await this.staffDirectory(tenantId, pairs, search, staffType);
    const decorated = await this.withStatus(
      tenantId,
      audience,
      rows,
      today,
      window,
      query.month,
    );
    const filtered = query.status
      ? decorated.filter((row) => row.status === query.status)
      : decorated;
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(50, Math.max(5, query.pageSize ?? 10));
    const start = (page - 1) * pageSize;
    return {
      audience,
      window,
      total: filtered.length,
      page,
      pageSize,
      rows: filtered.slice(start, start + pageSize),
    };
  }

  async calendar(tenantId: string, monthKey?: string) {
    const today = istCalendar();
    const parsed = this.parseMonth(monthKey, today);
    const [students, staff] = await Promise.all([
      this.countsByDay(tenantId, 'STUDENT', parsed.month),
      this.countsByDay(tenantId, 'STAFF', parsed.month),
    ]);
    const days = Array.from(
      { length: daysInMonth(parsed.year, parsed.month) },
      (_, index) => {
        const day = index + 1;
        return {
          day,
          students: students.get(day) ?? 0,
          staff: staff.get(day) ?? 0,
        };
      },
    );
    return {
      month: `${parsed.year}-${String(parsed.month).padStart(2, '0')}`,
      year: parsed.year,
      monthNumber: parsed.month,
      startWeekday: new Date(
        Date.UTC(parsed.year, parsed.month - 1, 1),
      ).getUTCDay(),
      today:
        parsed.year === today.year && parsed.month === today.month
          ? today.day
          : null,
      days,
    };
  }

  async history(tenantId: string, query: BirthdayHistoryQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 20));
    const where = this.historyWhere(tenantId, query);
    const [totalRow] = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      ${where}
    `;
    const rows = await this.prisma.$queryRaw<
      Array<{
        recipientName: string | null;
        recipientType: string | null;
        birthdayDate: string | null;
        message: string | null;
        channel: string | null;
        sentAt: Date | null;
        status: string | null;
        sentBy: string | null;
        failureReason: string | null;
      }>
    >`
      SELECT
        r.display_name AS "recipientName",
        r.recipient_type AS "recipientType",
        c.metadata->>'birthdayDate' AS "birthdayDate",
        COALESCE(NULLIF(c.body_text, ''), c.subject) AS message,
        l.channel AS channel,
        COALESCE(l.sent_at, l.created_at) AS "sentAt",
        l.status AS status,
        COALESCE(
          c.metadata->>'sentBy',
          CASE
            WHEN COALESCE(c.metadata->>'trigger', '') ILIKE '%manual%' THEN 'Manual'
            ELSE 'Automatic'
          END
        ) AS "sentBy",
        l.error_message AS "failureReason"
      ${where}
      ORDER BY l.created_at DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `;
    return {
      total: totalRow?.count ?? 0,
      page,
      pageSize,
      rows: rows.map((row) => ({
        ...row,
        sentAt: row.sentAt ? new Date(row.sentAt).toISOString() : null,
        category: this.categoryLabel(row.recipientType),
      })),
    };
  }

  async exportHistory(tenantId: string, query: BirthdayHistoryQueryDto) {
    const data = await this.history(tenantId, {
      ...query,
      page: 1,
      pageSize: 100,
    });
    const all = data.rows;
    let offsetPage = 2;
    while (all.length < data.total && all.length < 2000) {
      const next = await this.history(tenantId, {
        ...query,
        page: offsetPage,
        pageSize: 100,
      });
      all.push(...next.rows);
      if (!next.rows.length) break;
      offsetPage += 1;
    }
    if (query.format === 'pdf') return this.toPdf(tenantId, all);
    return this.toExcel(all);
  }

  async templates(tenantId: string) {
    await this.ensureCardTemplates(tenantId);
    return this.prisma.communicationTemplate.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { category: 'BIRTHDAY' },
          { code: { contains: 'BIRTHDAY', mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  async saveTemplate(user: JwtUser, input: SaveBirthdayTemplateDto) {
    const code = `BIRTHDAY_${input.audience}_${Date.now().toString(36).toUpperCase()}`;
    const body = normalizeBirthdayTemplate(input.body);
    return this.prisma.communicationTemplate.create({
      data: {
        tenantId: user.tid,
        code,
        name: input.name.trim(),
        category: 'BIRTHDAY',
        subject: normalizeBirthdayTemplate(input.subject),
        bodyText: body,
        bodyHtml: this.cardHtml(input.name, body),
        variables: ['name', 'department', 'college_name'],
        channels: ['IN_APP', 'PUSH', 'EMAIL'],
        createdById: user.sub,
      },
    });
  }

  async updateTemplate(
    user: JwtUser,
    id: string,
    input: SaveBirthdayTemplateDto,
  ) {
    const existing = await this.prisma.communicationTemplate.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
    });
    if (!existing)
      throw new BadRequestException('Birthday template not found.');
    const body = normalizeBirthdayTemplate(input.body);
    return this.prisma.communicationTemplate.update({
      where: { id },
      data: {
        name: input.name.trim(),
        subject: normalizeBirthdayTemplate(input.subject),
        bodyText: body,
        bodyHtml: this.cardHtml(input.name, body),
      },
    });
  }

  async getSettings(tenantId: string): Promise<WishSettings> {
    const row = await this.prisma.communicationAutomationRule.findUnique({
      where: { tenantId_code: { tenantId, code: SETTINGS_CODE } },
    });
    if (row) return this.readSettings(row.isEnabled, row.config);
    const legacy = await this.prisma.communicationAutomationRule.findMany({
      where: {
        tenantId,
        code: { in: ['student.birthday.daily', 'staff.birthday.daily'] },
      },
    });
    const student = legacy.find(
      (rule) => rule.code === 'student.birthday.daily',
    );
    const staff = legacy.find((rule) => rule.code === 'staff.birthday.daily');
    const channels = birthdayChannels(
      (student?.channels as string[] | undefined) ?? DEFAULT_SETTINGS.channels,
    );
    return {
      ...DEFAULT_SETTINGS,
      enabled: (student?.isEnabled ?? true) || (staff?.isEnabled ?? true),
      studentsEnabled: student?.isEnabled ?? true,
      staffEnabled: staff?.isEnabled ?? true,
      channels,
    };
  }

  async saveSettings(user: JwtUser, input: SaveBirthdaySettingsDto) {
    const sendTime = normalizeSendTime(input.sendTime);
    if (!sendTime)
      throw new BadRequestException('Choose a sending time as HH:MM.');
    if (!input.channels.length) {
      throw new BadRequestException(
        'Choose at least one notification channel.',
      );
    }
    const current = await this.getSettings(user.tid);
    const next: WishSettings = {
      ...current,
      enabled: input.enabled,
      studentsEnabled: input.studentsEnabled,
      staffEnabled: input.staffEnabled,
      sendTime,
      channels: birthdayChannels(input.channels),
      studentTemplateCode:
        input.studentTemplateCode.trim() ||
        DEFAULT_SETTINGS.studentTemplateCode,
      staffTemplateCode:
        input.staffTemplateCode.trim() || DEFAULT_SETTINGS.staffTemplateCode,
      upcomingReminders: input.upcomingReminders,
      preventDuplicates: input.preventDuplicates,
      notifyPeers: input.notifyPeers,
    };
    await this.persistSettings(user.tid, next);
    return next;
  }

  async preview(tenantId: string, input: PreviewBirthdayWishDto) {
    const collegeName = await this.triggers.getInstitutionName(tenantId);
    const person = input.id
      ? (await this.peopleByIds(tenantId, input.audience, [input.id]))[0]
      : null;
    const sample = person ?? {
      id: 'sample',
      userId: null,
      fullName: input.audience === 'STUDENT' ? 'Aisha Sangma' : 'John Sangma',
      code: input.audience === 'STUDENT' ? 'BA24-001' : 'DBC-014',
      department: 'English',
      programme: 'Bachelor of Arts',
      semester: input.audience === 'STUDENT' ? 5 : null,
      contact: '9876543210',
      email: 'student@example.com',
      photoPath: null,
      staffType: input.audience === 'STAFF' ? 'TEACHING' : null,
      month: istCalendar().month,
      day: istCalendar().day,
      dateOfBirth: new Date(),
    };
    const message = await this.resolveMessage(
      tenantId,
      input.audience,
      sample,
      {
        templateId: input.templateId,
        subject: input.subject,
        body: input.body,
      },
    );
    const variables = birthdayVariables({
      fullName: sample.fullName,
      department: sample.department,
      collegeName,
      code: sample.code,
      programme: sample.programme,
      semester: sample.semester,
    });
    const rendered = this.renderer.renderAll(
      {
        subject: normalizeBirthdayTemplate(message.subject),
        bodyText: normalizeBirthdayTemplate(message.body),
        bodyHtml: normalizeBirthdayTemplate(message.html),
      },
      variables,
    );
    return {
      subject: rendered.subject,
      body: rendered.bodyText,
      html: rendered.bodyHtml,
      recipient: sample.fullName,
    };
  }

  async send(user: JwtUser, input: SendBirthdayWishesDto) {
    if (!input.ids.length)
      throw new BadRequestException('Select at least one person.');
    if (!input.channels.length) {
      throw new BadRequestException(
        'Choose at least one notification channel.',
      );
    }
    const channels = birthdayChannels(input.channels);
    const people = await this.peopleByIds(user.tid, input.audience, input.ids);
    if (!people.length)
      throw new BadRequestException('No matching people were found.');
    const settings = await this.getSettings(user.tid);
    const collegeName = await this.triggers.getInstitutionName(user.tid);
    const today = istCalendar();
    let queued = 0;
    let skipped = 0;
    let failed = 0;
    const results: Array<{
      id: string;
      name: string;
      status: string;
      reason?: string;
    }> = [];

    for (const person of people) {
      const outcome = await this.deliverOne({
        tenantId: user.tid,
        audience: input.audience,
        person,
        channels,
        collegeName,
        year: today.year,
        sentBy: 'Manual',
        actorEmail: user.email,
        preventDuplicates: settings.preventDuplicates,
        retry: Boolean(input.retry),
        templateId: input.templateId,
        subject: input.subject,
        body: input.body,
      });
      if (outcome.status === 'QUEUED') queued += 1;
      else if (outcome.status === 'SKIPPED') skipped += 1;
      else failed += 1;
      results.push({
        id: person.id,
        name: person.fullName,
        status: outcome.status,
        reason: outcome.reason,
      });
    }
    return { queued, skipped, failed, results };
  }

  async runDueAutomations() {
    const now = istCalendar();
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active', deletedAt: null },
      select: { id: true },
    });
    for (const tenant of tenants) {
      try {
        const settings = await this.getSettings(tenant.id);
        if (settings.lastRunDate === now.dateKey) continue;
        if (now.timeKey < settings.sendTime) continue;
        const wishesOn =
          settings.enabled &&
          (settings.studentsEnabled || settings.staffEnabled);
        if (!wishesOn && !settings.upcomingReminders) continue;
        const hold = this.retryAfter.get(tenant.id) ?? 0;
        if (hold > Date.now()) continue;
        await this.runTenant(tenant.id, settings, now);
        await this.persistSettings(tenant.id, {
          ...settings,
          lastRunDate: now.dateKey,
        });
        this.retryAfter.delete(tenant.id);
      } catch (error) {
        this.retryAfter.set(tenant.id, Date.now() + 15 * 60 * 1000);
        this.logger.error(
          `Birthday automation failed for tenant ${tenant.id}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
  }

  private async runTenant(
    tenantId: string,
    settings: WishSettings,
    now: CalendarDate,
  ) {
    const channels = birthdayChannels(settings.channels);
    if (settings.enabled && settings.studentsEnabled) {
      await this.notifications.processTenantStudentBirthdays(
        tenantId,
        now.year,
        {
          channels,
          templateCode: settings.studentTemplateCode,
          notifyPeers: settings.notifyPeers,
        },
      );
    }
    if (settings.enabled && settings.staffEnabled) {
      await this.notifications.processTenantStaffBirthdays(tenantId, now.year, {
        channels,
        templateCode: settings.staffTemplateCode,
        notifyPeers: settings.notifyPeers,
      });
    }
    if (settings.upcomingReminders) {
      await this.sendUpcomingReminders(tenantId, now);
    }
  }

  private async sendUpcomingReminders(tenantId: string, now: CalendarDate) {
    const tomorrow = addCalendarDays(now, 1);
    const [students, staff] = await Promise.all([
      this.query.findStudentBirthdaysToday(
        tenantId,
        this.instantFor(tomorrow.year, tomorrow.month, tomorrow.day),
      ),
      this.query.findStaffBirthdaysToday(
        tenantId,
        this.instantFor(tomorrow.year, tomorrow.month, tomorrow.day),
      ),
    ]);
    const collegeName = await this.triggers.getInstitutionName(tenantId);
    for (const student of students) {
      await this.queueNotice({
        tenantId,
        triggerKey: `student.birthday.upcoming.${now.year}.${student.studentId}`,
        entityType: 'student_birthday_upcoming',
        entityId: student.studentId,
        recipientType: 'STUDENT',
        userId: student.userId,
        studentId: student.studentId,
        fullName: student.fullName,
        email: student.email,
        department: student.departmentName,
        programme: student.programName,
        collegeName,
      });
    }
    for (const member of staff) {
      await this.queueNotice({
        tenantId,
        triggerKey: `staff.birthday.upcoming.${now.year}.${member.staffProfileId}`,
        entityType: 'staff_birthday_upcoming',
        entityId: member.staffProfileId,
        recipientType: 'FACULTY',
        userId: member.portalUserId,
        staffProfileId: member.staffProfileId,
        fullName: member.fullName,
        email: member.email,
        department: member.departmentName,
        collegeName,
      });
    }
  }

  private async queueNotice(input: {
    tenantId: string;
    triggerKey: string;
    entityType: string;
    entityId: string;
    recipientType: 'STUDENT' | 'FACULTY';
    userId: string;
    studentId?: string;
    staffProfileId?: string;
    fullName: string;
    email: string | null;
    department?: string | null;
    programme?: string | null;
    collegeName: string;
  }) {
    const existing = await this.prisma.communicationTriggerLog.findUnique({
      where: {
        tenantId_triggerKey_entityType_entityId: {
          tenantId: input.tenantId,
          triggerKey: input.triggerKey,
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
      select: { id: true },
    });
    if (existing) return;
    const variables = birthdayVariables({
      fullName: input.fullName,
      department: input.department,
      collegeName: input.collegeName,
      programme: input.programme,
    });
    const body = this.renderer.render(
      'Hello {{name}}, tomorrow is your birthday. {{college_name}} will send you warm wishes in the morning.',
      variables,
    );
    const campaign = await this.prisma.communicationCampaign.create({
      data: {
        tenantId: input.tenantId,
        name: `Birthday reminder: ${input.fullName}`.slice(0, 200),
        subject: 'Your birthday is tomorrow',
        bodyText: body,
        bodyHtml: this.cardHtml('Tomorrow is your birthday', body),
        audienceType: 'INDIVIDUAL',
        channels: ['IN_APP', 'PUSH'] as Prisma.InputJsonValue,
        status: 'SENDING',
        metadata: {
          trigger: input.triggerKey,
          entityType: input.entityType,
          entityId: input.entityId,
          templateCode: 'BIRTHDAY_UPCOMING',
          sentBy: 'Automatic',
        } as Prisma.InputJsonValue,
      },
    });
    await this.prisma.communicationRecipient.create({
      data: {
        tenantId: input.tenantId,
        campaignId: campaign.id,
        recipientType: input.recipientType,
        userId: input.userId,
        studentId: input.studentId,
        staffProfileId: input.staffProfileId,
        displayName: input.fullName,
        email: input.email,
      },
    });
    await this.prisma.communicationTriggerLog.create({
      data: {
        tenantId: input.tenantId,
        triggerKey: input.triggerKey,
        entityType: input.entityType,
        entityId: input.entityId,
        campaignId: campaign.id,
      },
    });
    await this.queue.enqueueNotification({
      jobType: 'campaign-deliver',
      tenantId: input.tenantId,
      campaignId: campaign.id,
    });
  }

  private async deliverOne(input: {
    tenantId: string;
    audience: 'STUDENT' | 'STAFF';
    person: DirectoryRow;
    channels: BirthdayChannel[];
    collegeName: string;
    year: number;
    sentBy: 'Manual' | 'Automatic';
    actorEmail?: string;
    preventDuplicates: boolean;
    retry: boolean;
    templateId?: string;
    subject?: string;
    body?: string;
  }) {
    const baseKey =
      input.audience === 'STUDENT'
        ? `student.birthday.self.${input.year}.${input.person.id}`
        : `staff.birthday.self.${input.year}.${input.person.id}`;
    const entityType =
      input.audience === 'STUDENT' ? 'student_birthday' : 'staff_birthday';
    let triggerKey = baseKey;
    if (input.preventDuplicates) {
      const existing = await this.prisma.communicationTriggerLog.findUnique({
        where: {
          tenantId_triggerKey_entityType_entityId: {
            tenantId: input.tenantId,
            triggerKey: baseKey,
            entityType,
            entityId: input.person.id,
          },
        },
      });
      if (existing) {
        const failed = await this.campaignFailed(existing.campaignId);
        if (!input.retry || !failed) {
          return {
            status: 'SKIPPED' as const,
            reason: failed
              ? 'Already attempted. Use retry for a failed wish.'
              : 'A birthday wish was already sent this year.',
          };
        }
        triggerKey = `${baseKey}.retry.${istCalendar().dateKey}`;
      }
    }
    const message = await this.resolveMessage(
      input.tenantId,
      input.audience,
      input.person,
      input,
    );
    const variables = birthdayVariables({
      fullName: input.person.fullName,
      department: input.person.department,
      collegeName: input.collegeName,
      code: input.person.code,
      programme: input.person.programme,
      semester: input.person.semester,
    });
    const rendered = this.renderer.renderAll(
      {
        subject: normalizeBirthdayTemplate(message.subject),
        bodyText: normalizeBirthdayTemplate(message.body),
        bodyHtml: normalizeBirthdayTemplate(message.html),
      },
      variables,
    );
    const birthdayDate = this.birthdayLabel(
      input.person.month,
      input.person.day,
      input.year,
    );
    try {
      const campaign = await this.prisma.communicationCampaign.create({
        data: {
          tenantId: input.tenantId,
          templateId: message.templateId,
          name: `Birthday wish: ${input.person.fullName}`.slice(0, 200),
          subject: rendered.subject || 'Happy Birthday',
          bodyHtml: rendered.bodyHtml || undefined,
          bodyText: rendered.bodyText || undefined,
          audienceType: 'INDIVIDUAL',
          audienceFilter: {
            userIds: input.person.userId ? [input.person.userId] : [],
          } as Prisma.InputJsonValue,
          channels: input.channels as Prisma.InputJsonValue,
          status: 'SENDING',
          metadata: {
            trigger: triggerKey,
            entityType,
            entityId: input.person.id,
            templateCode: message.templateCode,
            sentBy: input.actorEmail
              ? `${input.sentBy} · ${input.actorEmail}`
              : input.sentBy,
            birthdayDate,
            variables,
          } as Prisma.InputJsonValue,
        },
      });
      await this.prisma.communicationRecipient.create({
        data: {
          tenantId: input.tenantId,
          campaignId: campaign.id,
          recipientType: input.audience === 'STUDENT' ? 'STUDENT' : 'FACULTY',
          userId: input.person.userId,
          studentId: input.audience === 'STUDENT' ? input.person.id : undefined,
          staffProfileId:
            input.audience === 'STAFF' ? input.person.id : undefined,
          displayName: input.person.fullName,
          email: input.person.email,
          phone: input.person.contact,
        },
      });
      await this.prisma.communicationTriggerLog.create({
        data: {
          tenantId: input.tenantId,
          triggerKey,
          entityType,
          entityId: input.person.id,
          campaignId: campaign.id,
        },
      });
      await this.queue.enqueueNotification({
        jobType: 'campaign-deliver',
        tenantId: input.tenantId,
        campaignId: campaign.id,
      });
      return { status: 'QUEUED' as const };
    } catch (error) {
      this.logger.warn(
        `Birthday wish failed for ${input.person.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        status: 'FAILED' as const,
        reason: 'The wish could not be queued.',
      };
    }
  }

  private async campaignFailed(campaignId: string | null) {
    if (!campaignId) return true;
    const logs = await this.prisma.communicationDeliveryLog.findMany({
      where: { campaignId },
      select: { status: true },
    });
    if (!logs.length) return false;
    const success = logs.some(
      (log) => log.status === 'SENT' || log.status === 'DELIVERED',
    );
    return !success && logs.some((log) => log.status === 'FAILED');
  }

  private async resolveMessage(
    tenantId: string,
    audience: 'STUDENT' | 'STAFF',
    _person: DirectoryRow,
    input: { templateId?: string; subject?: string; body?: string },
  ) {
    const settings = await this.getSettings(tenantId);
    const template = input.templateId
      ? await this.prisma.communicationTemplate.findFirst({
          where: {
            id: input.templateId,
            tenantId,
            deletedAt: null,
            isActive: true,
          },
        })
      : await this.prisma.communicationTemplate.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            isActive: true,
            code:
              audience === 'STUDENT'
                ? settings.studentTemplateCode
                : settings.staffTemplateCode,
          },
        });
    const customBody = input.body?.trim();
    if (!template && !customBody) {
      throw new BadRequestException(
        'Choose a birthday template or write a message.',
      );
    }
    return {
      templateId: template?.id,
      templateCode: template?.code ?? 'BIRTHDAY_CUSTOM',
      subject:
        input.subject?.trim() ||
        template?.subject ||
        'Happy Birthday, {{name}}!',
      body:
        customBody ||
        template?.bodyText ||
        'Happy Birthday, {{name}}! Wishing you a wonderful year from {{college_name}}.',
      html: customBody
        ? this.cardHtml('Birthday', customBody)
        : template?.bodyHtml || customBody || '',
    };
  }

  private async withStatus(
    tenantId: string,
    audience: 'STUDENT' | 'STAFF',
    rows: DirectoryRow[],
    today: CalendarDate,
    window: string,
    monthKey?: string,
  ) {
    const ids = rows.map((row) => row.id);
    const logs = ids.length
      ? await this.prisma.communicationTriggerLog.findMany({
          where: {
            tenantId,
            entityId: { in: ids },
            entityType:
              audience === 'STUDENT' ? 'student_birthday' : 'staff_birthday',
          },
          select: {
            entityId: true,
            campaignId: true,
            triggerKey: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const yearKey = `.self.${today.year}.`;
    const relevant = logs.filter((log) => log.triggerKey.includes(yearKey));
    const campaignIds = relevant
      .map((log) => log.campaignId)
      .filter((id): id is string => Boolean(id));
    const deliveries = campaignIds.length
      ? await this.prisma.communicationDeliveryLog.findMany({
          where: { campaignId: { in: campaignIds } },
          select: { campaignId: true, status: true, errorMessage: true },
        })
      : [];
    const byEntity = new Map<string, (typeof relevant)[number]>();
    for (const log of relevant) {
      if (!byEntity.has(log.entityId)) byEntity.set(log.entityId, log);
    }
    return rows.map((row) => {
      const log = byEntity.get(row.id);
      const own = deliveries.filter(
        (item) => item.campaignId === log?.campaignId,
      );
      const success = own.some(
        (item) => item.status === 'SENT' || item.status === 'DELIVERED',
      );
      const failed = own.find((item) => item.status === 'FAILED');
      const delivery = success
        ? 'SUCCESS'
        : failed
          ? 'FAILED'
          : own.length
            ? 'QUEUED'
            : 'NONE';
      const when = this.whenFor(row, today, window, monthKey);
      const status: BirthdayWishStatus = classifyWish({
        when,
        hasTrigger: Boolean(log),
        delivery,
      });
      return {
        id: row.id,
        audience,
        userId: row.userId,
        fullName: row.fullName,
        code: row.code,
        department: row.department,
        programme: row.programme,
        semester: row.semester,
        dateOfBirth: this.asDate(row.dateOfBirth),
        contact: row.contact,
        email: row.email,
        photoUrl: toPublicUploadUrl(row.photoPath),
        staffType: this.staffKind(row.staffType),
        status,
        failureReason:
          status === 'FAILED' ? (failed?.errorMessage ?? null) : null,
      };
    });
  }

  private whenFor(
    row: DirectoryRow,
    today: CalendarDate,
    window: string,
    monthKey?: string,
  ): BirthdayWhen {
    if (row.month === today.month && row.day === today.day) return 'TODAY';
    if (window !== 'month') return 'FUTURE';
    const parsed = this.parseMonth(monthKey, today);
    if (
      parsed.year > today.year ||
      (parsed.year === today.year && parsed.month > today.month)
    ) {
      return 'FUTURE';
    }
    if (parsed.year < today.year || parsed.month < today.month) return 'PAST';
    return row.day > today.day ? 'FUTURE' : 'PAST';
  }

  private pairsFor(
    today: CalendarDate,
    window: string,
    monthKey?: string,
    day?: number,
  ) {
    if (window === 'today') return monthDayPairs(today, 1);
    if (window === 'tomorrow')
      return monthDayPairs(addCalendarDays(today, 1), 1);
    if (window === 'next7') return monthDayPairs(today, 7);
    if (window === 'next30') return monthDayPairs(today, 30);
    const parsed = this.parseMonth(monthKey, today);
    if (day) return [{ month: parsed.month, day }];
    return Array.from(
      { length: daysInMonth(parsed.year, parsed.month) },
      (_, index) => ({
        month: parsed.month,
        day: index + 1,
      }),
    );
  }

  private parseMonth(monthKey: string | undefined, today: CalendarDate) {
    const match = /^(\d{4})-(\d{2})$/.exec(monthKey ?? '');
    if (!match) return { year: today.year, month: today.month };
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12)
      return { year: today.year, month: today.month };
    return { year, month };
  }

  private async studentDirectory(
    tenantId: string,
    pairs: Array<{ month: number; day: number }>,
    search: string,
  ) {
    const match = this.pairSql(pairs, 'sp.date_of_birth');
    const searchSql = this.searchSql(search, [
      'sp.full_name',
      's.roll_number',
      'd.department_name',
      'sp.mobile_number',
      'sp.email',
    ]);
    return this.prisma.$queryRaw<DirectoryRow[]>`
      SELECT
        s.id AS id,
        s.user_id AS "userId",
        sp.full_name AS "fullName",
        s.roll_number AS code,
        d.department_name AS department,
        p.name AS programme,
        sas.current_semester_sequence AS semester,
        sp.date_of_birth AS "dateOfBirth",
        COALESCE(sp.mobile_number, sp.whatsapp_number) AS contact,
        sp.email AS email,
        sp.photo_path AS "photoPath",
        NULL AS "staffType",
        EXTRACT(MONTH FROM sp.date_of_birth)::int AS month,
        EXTRACT(DAY FROM sp.date_of_birth)::int AS day
      FROM academic.student_profiles sp
      INNER JOIN academic.students s ON s.id = sp.student_id
      LEFT JOIN core.departments d ON d.id = s.department_id
      LEFT JOIN academic.program_versions pv ON pv.id = s.program_version_id
      LEFT JOIN academic.programs p ON p.id = pv.program_id
      LEFT JOIN academic.student_academic_standings sas ON sas.student_id = s.id
      WHERE sp.tenant_id = ${tenantId}::uuid
        AND s.deleted_at IS NULL
        AND s.account_type = 'NORMAL'
        AND sp.date_of_birth IS NOT NULL
        AND ${match}
        ${searchSql}
      ORDER BY EXTRACT(MONTH FROM sp.date_of_birth), EXTRACT(DAY FROM sp.date_of_birth), sp.full_name
      LIMIT ${DIRECTORY_CAP}
    `;
  }

  private async staffDirectory(
    tenantId: string,
    pairs: Array<{ month: number; day: number }>,
    search: string,
    staffType: string,
  ) {
    const match = this.pairSql(pairs, 'sp.date_of_birth');
    const searchSql = this.searchSql(search, [
      'sp.full_name',
      'sp.employee_code',
      'd.department_name',
      'sp.mobile',
      'sp.email',
    ]);
    const typeSql =
      staffType === 'TEACHING'
        ? Prisma.sql`AND UPPER(sp.staff_type) = 'TEACHING'`
        : staffType === 'NON_TEACHING'
          ? Prisma.sql`AND UPPER(COALESCE(sp.staff_type, '')) <> 'TEACHING'`
          : Prisma.empty;
    return this.prisma.$queryRaw<DirectoryRow[]>`
      SELECT
        sp.id AS id,
        sp.portal_user_id AS "userId",
        sp.full_name AS "fullName",
        sp.employee_code AS code,
        d.department_name AS department,
        NULL AS programme,
        NULL::int AS semester,
        sp.date_of_birth AS "dateOfBirth",
        sp.mobile AS contact,
        sp.email AS email,
        sp.photo_url AS "photoPath",
        sp.staff_type AS "staffType",
        EXTRACT(MONTH FROM sp.date_of_birth)::int AS month,
        EXTRACT(DAY FROM sp.date_of_birth)::int AS day
      FROM academic.staff_profiles sp
      LEFT JOIN core.departments d ON d.id = sp.department_id
      WHERE sp.tenant_id = ${tenantId}::uuid
        AND sp.deleted_at IS NULL
        AND sp.account_type = 'NORMAL'
        AND sp.status = 'ACTIVE'
        AND sp.date_of_birth IS NOT NULL
        AND ${match}
        ${typeSql}
        ${searchSql}
      ORDER BY EXTRACT(MONTH FROM sp.date_of_birth), EXTRACT(DAY FROM sp.date_of_birth), sp.full_name
      LIMIT ${DIRECTORY_CAP}
    `;
  }

  private async peopleByIds(
    tenantId: string,
    audience: 'STUDENT' | 'STAFF',
    ids: string[],
  ) {
    if (audience === 'STUDENT') {
      return this.prisma.$queryRaw<DirectoryRow[]>`
        SELECT
          s.id AS id,
          s.user_id AS "userId",
          sp.full_name AS "fullName",
          s.roll_number AS code,
          d.department_name AS department,
          p.name AS programme,
          sas.current_semester_sequence AS semester,
          sp.date_of_birth AS "dateOfBirth",
          COALESCE(sp.mobile_number, sp.whatsapp_number) AS contact,
          sp.email AS email,
          sp.photo_path AS "photoPath",
          NULL AS "staffType",
          EXTRACT(MONTH FROM sp.date_of_birth)::int AS month,
          EXTRACT(DAY FROM sp.date_of_birth)::int AS day
        FROM academic.students s
        INNER JOIN academic.student_profiles sp ON sp.student_id = s.id
        LEFT JOIN core.departments d ON d.id = s.department_id
        LEFT JOIN academic.program_versions pv ON pv.id = s.program_version_id
        LEFT JOIN academic.programs p ON p.id = pv.program_id
        LEFT JOIN academic.student_academic_standings sas ON sas.student_id = s.id
        WHERE s.tenant_id = ${tenantId}::uuid
          AND s.deleted_at IS NULL
        AND s.account_type = 'NORMAL'
          AND s.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      `;
    }
    return this.prisma.$queryRaw<DirectoryRow[]>`
      SELECT
        sp.id AS id,
        sp.portal_user_id AS "userId",
        sp.full_name AS "fullName",
        sp.employee_code AS code,
        d.department_name AS department,
        NULL AS programme,
        NULL::int AS semester,
        sp.date_of_birth AS "dateOfBirth",
        sp.mobile AS contact,
        sp.email AS email,
        sp.photo_url AS "photoPath",
        sp.staff_type AS "staffType",
        EXTRACT(MONTH FROM sp.date_of_birth)::int AS month,
        EXTRACT(DAY FROM sp.date_of_birth)::int AS day
      FROM academic.staff_profiles sp
      LEFT JOIN core.departments d ON d.id = sp.department_id
      WHERE sp.tenant_id = ${tenantId}::uuid
        AND sp.deleted_at IS NULL
        AND sp.account_type = 'NORMAL'
        AND sp.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    `;
  }

  private async countStudents(
    tenantId: string,
    pairs: Array<{ month: number; day: number }>,
  ) {
    const match = this.pairSql(pairs, 'sp.date_of_birth');
    const [row] = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM academic.student_profiles sp
      INNER JOIN academic.students s ON s.id = sp.student_id
      WHERE sp.tenant_id = ${tenantId}::uuid
        AND s.deleted_at IS NULL
        AND s.account_type = 'NORMAL'
        AND sp.date_of_birth IS NOT NULL
        AND ${match}
    `;
    return row?.count ?? 0;
  }

  private async countStaff(
    tenantId: string,
    pairs: Array<{ month: number; day: number }>,
    staffType: string,
  ) {
    const match = this.pairSql(pairs, 'sp.date_of_birth');
    const typeSql =
      staffType === 'TEACHING'
        ? Prisma.sql`AND UPPER(sp.staff_type) = 'TEACHING'`
        : staffType === 'NON_TEACHING'
          ? Prisma.sql`AND UPPER(COALESCE(sp.staff_type, '')) <> 'TEACHING'`
          : Prisma.empty;
    const [row] = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM academic.staff_profiles sp
      WHERE sp.tenant_id = ${tenantId}::uuid
        AND sp.deleted_at IS NULL
        AND sp.account_type = 'NORMAL'
        AND sp.status = 'ACTIVE'
        AND sp.date_of_birth IS NOT NULL
        AND ${match}
        ${typeSql}
    `;
    return row?.count ?? 0;
  }

  private async countsByDay(
    tenantId: string,
    audience: 'STUDENT' | 'STAFF',
    month: number,
  ) {
    const rows =
      audience === 'STUDENT'
        ? await this.prisma.$queryRaw<Array<{ day: number; count: number }>>`
            SELECT EXTRACT(DAY FROM sp.date_of_birth)::int AS day, COUNT(*)::int AS count
            FROM academic.student_profiles sp
            INNER JOIN academic.students s ON s.id = sp.student_id
            WHERE sp.tenant_id = ${tenantId}::uuid
              AND s.deleted_at IS NULL
        AND s.account_type = 'NORMAL'
              AND sp.date_of_birth IS NOT NULL
              AND EXTRACT(MONTH FROM sp.date_of_birth)::int = ${month}
            GROUP BY 1
          `
        : await this.prisma.$queryRaw<Array<{ day: number; count: number }>>`
            SELECT EXTRACT(DAY FROM sp.date_of_birth)::int AS day, COUNT(*)::int AS count
            FROM academic.staff_profiles sp
            WHERE sp.tenant_id = ${tenantId}::uuid
              AND sp.deleted_at IS NULL
        AND sp.account_type = 'NORMAL'
              AND sp.status = 'ACTIVE'
              AND sp.date_of_birth IS NOT NULL
              AND EXTRACT(MONTH FROM sp.date_of_birth)::int = ${month}
            GROUP BY 1
          `;
    return new Map(rows.map((row) => [row.day, row.count]));
  }

  private async countSentToday(tenantId: string, today: CalendarDate) {
    const bounds = istDayBounds(today.dateKey);
    const [row] = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM platform.communication_trigger_logs
      WHERE tenant_id = ${tenantId}::uuid
        AND created_at >= ${bounds.start}
        AND created_at < ${bounds.end}
        AND (
          trigger_key LIKE 'student.birthday.self.%'
          OR trigger_key LIKE 'staff.birthday.self.%'
        )
        AND trigger_key NOT LIKE '%.retry.%'
    `;
    return row?.count ?? 0;
  }

  private async countWishedTodayPeople(
    tenantId: string,
    year: number,
    today: CalendarDate,
  ) {
    const studentKey = `student.birthday.self.${year}.%`;
    const staffKey = `staff.birthday.self.${year}.%`;
    const [row] = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT t.entity_id)::int AS count
      FROM platform.communication_trigger_logs t
      WHERE t.tenant_id = ${tenantId}::uuid
        AND t.entity_type IN ('student_birthday', 'staff_birthday')
        AND (t.trigger_key LIKE ${studentKey} OR t.trigger_key LIKE ${staffKey})
        AND t.trigger_key NOT LIKE '%.retry.%'
        AND (
          EXISTS (
            SELECT 1
            FROM academic.student_profiles sp
            INNER JOIN academic.students s ON s.id = sp.student_id
            WHERE s.id = t.entity_id
              AND s.deleted_at IS NULL
        AND s.account_type = 'NORMAL'
              AND EXTRACT(MONTH FROM sp.date_of_birth)::int = ${today.month}
              AND EXTRACT(DAY FROM sp.date_of_birth)::int = ${today.day}
          )
          OR EXISTS (
            SELECT 1
            FROM academic.staff_profiles sp
            WHERE sp.id = t.entity_id
              AND sp.deleted_at IS NULL
        AND sp.account_type = 'NORMAL'
              AND EXTRACT(MONTH FROM sp.date_of_birth)::int = ${today.month}
              AND EXTRACT(DAY FROM sp.date_of_birth)::int = ${today.day}
          )
        )
    `;
    return row?.count ?? 0;
  }

  private async countFailedToday(tenantId: string, today: CalendarDate) {
    const bounds = istDayBounds(today.dateKey);
    const [row] = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM platform.communication_delivery_logs l
      INNER JOIN platform.communication_campaigns c ON c.id = l.campaign_id
      WHERE l.tenant_id = ${tenantId}::uuid
        AND l.status = 'FAILED'
        AND l.created_at >= ${bounds.start}
        AND l.created_at < ${bounds.end}
        AND (
          COALESCE(c.metadata->>'trigger', '') ILIKE '%birthday%'
          OR COALESCE(c.metadata->>'templateCode', '') ILIKE '%BIRTHDAY%'
        )
    `;
    return row?.count ?? 0;
  }

  private historyWhere(tenantId: string, query: BirthdayHistoryQueryDto) {
    const search = query.search?.trim()
      ? `%${query.search.trim().replace(/[%_]/g, '')}%`
      : '';
    const audienceSql =
      query.audience === 'STUDENT'
        ? Prisma.sql`AND r.recipient_type = 'STUDENT'`
        : query.audience === 'STAFF'
          ? Prisma.sql`AND r.recipient_type IN ('FACULTY', 'STAFF')`
          : Prisma.empty;
    const searchSql = search
      ? Prisma.sql`AND (
          COALESCE(r.display_name, '') ILIKE ${search}
          OR COALESCE(c.subject, '') ILIKE ${search}
        )`
      : Prisma.empty;
    return Prisma.sql`
      FROM platform.communication_delivery_logs l
      INNER JOIN platform.communication_campaigns c ON c.id = l.campaign_id
      LEFT JOIN platform.communication_recipients r ON r.id = l.recipient_id
      WHERE l.tenant_id = ${tenantId}::uuid
        AND (
          COALESCE(c.metadata->>'trigger', '') ILIKE '%birthday%'
          OR COALESCE(c.metadata->>'templateCode', '') ILIKE '%BIRTHDAY%'
        )
        ${audienceSql}
        ${searchSql}
    `;
  }

  private pairSql(
    pairs: Array<{ month: number; day: number }>,
    column: string,
  ) {
    const list = Prisma.join(
      pairs.map((pair) => Prisma.sql`(${pair.month}::int, ${pair.day}::int)`),
    );
    return Prisma.sql`(EXTRACT(MONTH FROM ${Prisma.raw(column)})::int, EXTRACT(DAY FROM ${Prisma.raw(column)})::int) IN (${list})`;
  }

  private searchSql(search: string, columns: string[]) {
    if (!search) return Prisma.empty;
    const like = `%${search.replace(/[%_]/g, '')}%`;
    const checks = Prisma.join(
      columns.map(
        (column) =>
          Prisma.sql`COALESCE(${Prisma.raw(column)}, '') ILIKE ${like}`,
      ),
      ' OR ',
    );
    return Prisma.sql`AND (${checks})`;
  }

  private async persistSettings(tenantId: string, settings: WishSettings) {
    const channels = birthdayChannels(settings.channels);
    await this.prisma.communicationAutomationRule.upsert({
      where: { tenantId_code: { tenantId, code: SETTINGS_CODE } },
      create: {
        tenantId,
        code: SETTINGS_CODE,
        name: 'Birthday Wishes',
        category: 'BIRTHDAY',
        isEnabled: settings.enabled,
        schedule: this.cronFor(settings.sendTime),
        channels,
        templateCode: settings.studentTemplateCode,
        config: settings as unknown as Prisma.InputJsonValue,
      },
      update: {
        isEnabled: settings.enabled,
        schedule: this.cronFor(settings.sendTime),
        channels,
        templateCode: settings.studentTemplateCode,
        config: settings as unknown as Prisma.InputJsonValue,
      },
    });
    await this.syncLegacyRule(
      tenantId,
      'student.birthday.daily',
      'Student Birthday Alerts',
      settings.studentsEnabled && settings.enabled,
      channels,
      settings,
    );
    await this.syncLegacyRule(
      tenantId,
      'staff.birthday.daily',
      'Staff Birthday Alerts',
      settings.staffEnabled && settings.enabled,
      channels,
      settings,
    );
  }

  private async syncLegacyRule(
    tenantId: string,
    code: string,
    name: string,
    isEnabled: boolean,
    channels: BirthdayChannel[],
    settings: WishSettings,
  ) {
    await this.prisma.communicationAutomationRule.upsert({
      where: { tenantId_code: { tenantId, code } },
      create: {
        tenantId,
        code,
        name,
        category: 'BIRTHDAY',
        isEnabled,
        schedule: this.cronFor(settings.sendTime),
        channels,
        templateCode: code.startsWith('student')
          ? settings.studentTemplateCode
          : settings.staffTemplateCode,
      },
      update: {
        isEnabled,
        schedule: this.cronFor(settings.sendTime),
        channels,
      },
    });
  }

  private readSettings(isEnabled: boolean, config: unknown): WishSettings {
    const raw = (config ?? {}) as Partial<WishSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      enabled: isEnabled,
      channels: birthdayChannels(raw.channels ?? DEFAULT_SETTINGS.channels),
      sendTime:
        normalizeSendTime(raw.sendTime ?? '') ?? DEFAULT_SETTINGS.sendTime,
    };
  }

  private cronFor(sendTime: string) {
    const [hour, minute] = sendTime.split(':');
    return `${Number(minute)} ${Number(hour)} * * *`;
  }

  private async ensureCardTemplates(tenantId: string) {
    const text =
      'Happy Birthday, {{name}}!\n\nWishing you a wonderful year filled with happiness, good health, success and countless blessings.\n\nWith best wishes,\n{{college_name}}';
    for (const code of CARD_CODES) {
      const existing = await this.prisma.communicationTemplate.findFirst({
        where: { tenantId, code, deletedAt: null },
        select: { id: true },
      });
      if (existing) continue;
      const staff = code.startsWith('STAFF');
      await this.prisma.communicationTemplate.create({
        data: {
          tenantId,
          code,
          name: staff ? 'Staff birthday card' : 'Student birthday card',
          category: 'BIRTHDAY',
          subject: 'Happy Birthday, {{name}}!',
          bodyText: text,
          bodyHtml: this.cardHtml(
            staff ? 'Staff greeting' : 'Student greeting',
            text,
          ),
          variables: ['name', 'department', 'college_name'],
          channels: ['IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP'],
        },
      });
    }
  }

  private cardHtml(title: string, body: string) {
    const safe = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
    return `<div style="max-width:520px;margin:0 auto;border-radius:18px;overflow:hidden;border:1px solid #f3e8ff;font-family:Georgia,serif;">
<div style="background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;padding:28px 24px;text-align:center;">
<div style="font-size:36px;line-height:1;">🎂</div>
<div style="margin-top:8px;font-size:22px;font-weight:700;">${title}</div>
</div>
<div style="padding:24px;color:#334155;font-size:16px;line-height:1.6;background:#fffaf5;">${safe}</div>
</div>`;
  }

  private async toExcel(
    rows: Array<{
      recipientName: string | null;
      category: string;
      birthdayDate: string | null;
      message: string | null;
      channel: string | null;
      sentAt: string | null;
      status: string | null;
      sentBy: string | null;
      failureReason: string | null;
    }>,
  ) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Birthday wishes');
    sheet.columns = [
      { header: 'Recipient', key: 'recipientName', width: 28 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Birthday', key: 'birthdayDate', width: 16 },
      { header: 'Message', key: 'message', width: 48 },
      { header: 'Channel', key: 'channel', width: 14 },
      { header: 'Sent at', key: 'sentAt', width: 22 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Sent by', key: 'sentBy', width: 28 },
      { header: 'Failure reason', key: 'failureReason', width: 36 },
    ];
    sheet.addRows(rows);
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      filename: 'birthday-wishes.xlsx',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Buffer.from(buffer),
    };
  }

  private async toPdf(
    tenantId: string,
    rows: Array<{
      recipientName: string | null;
      category: string;
      channel: string | null;
      status: string | null;
      sentAt: string | null;
      sentBy: string | null;
      failureReason: string | null;
    }>,
  ) {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: { displayName: true, shortName: true, logoUrl: true },
    });
    const collegeName =
      branding?.displayName?.trim() ||
      branding?.shortName?.trim() ||
      (await this.triggers.getInstitutionName(tenantId));
    return {
      filename: 'birthday-wishes-report.pdf',
      contentType: 'application/pdf',
      body: await renderBirthdayWishesPdf({
        collegeName,
        logoUrl: branding?.logoUrl ?? null,
        rows,
      }),
    };
  }

  private staffKind(value: string | null) {
    if (!value) return null;
    return value.toUpperCase() === 'TEACHING' ? 'Teaching' : 'Non-teaching';
  }

  private categoryLabel(value: string | null) {
    if (value === 'STUDENT') return 'Student';
    if (value === 'FACULTY' || value === 'STAFF') return 'Staff';
    return value ?? '—';
  }

  private asDate(value: Date | string) {
    if (value instanceof Date) {
      const year = value.getUTCFullYear();
      const month = String(value.getUTCMonth() + 1).padStart(2, '0');
      const day = String(value.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return String(value).slice(0, 10);
  }

  private birthdayLabel(month: number, day: number, year: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private instantFor(year: number, month: number, day: number) {
    return new Date(Date.UTC(year, month - 1, day, 6, 30));
  }
}
