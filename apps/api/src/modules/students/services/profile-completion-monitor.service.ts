import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../../database/prisma.service';
import { CommunicationSmsService } from '../../communication/services/communication-sms.service';
import { CommunicationWhatsAppService } from '../../communication/services/communication-whatsapp.service';
import { FcmPushService } from '../../communication/services/fcm-push.service';
import { normalizeGenderCode } from '../domain/gender';
import {
  DEFAULT_PROFILE_REMINDER,
  PROFILE_MONITOR_FIELDS,
  completionPercent,
  isFilled,
  isMonitorFieldKey,
  isValidEmail,
  isValidMobile,
  missingFields,
  normalizeMobile,
  normalizeRequiredKeys,
  personalizeReminder,
  type MonitorPresence,
  type ProfileMonitorFieldKey,
} from '../domain/profile-completion-monitor.logic';

const SYNC_RECIPIENTS = 40;
const COLLEGE_NAME = 'Don Bosco College, Tura';

type Channel = 'WHATSAPP' | 'SMS' | 'PUSH';
type Audience = 'incomplete' | 'selected' | 'missing_field';

export type MonitorFilters = {
  search?: string;
  departmentId?: string;
  semester?: number;
  shiftId?: string;
  gender?: string;
  missingField?: string;
  status?: 'incomplete' | 'complete' | 'all';
  academicYearId?: string;
};

type LoadedStudent = Awaited<
  ReturnType<ProfileCompletionMonitorService['loadStudents']>
>[number];

@Injectable()
export class ProfileCompletionMonitorService {
  private readonly logger = new Logger(ProfileCompletionMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: CommunicationWhatsAppService,
    private readonly sms: CommunicationSmsService,
    private readonly fcm: FcmPushService,
  ) {}

  async overview(
    tenantId: string,
    filters: MonitorFilters,
    page = 1,
    pageSize = 10,
  ) {
    const required = await this.requiredKeys(tenantId);
    const evaluated = await this.evaluate(tenantId, filters, required);
    const structural = evaluated.filter((row) =>
      this.matchesStructure(row, filters),
    );
    const table = structural.filter((row) => this.matchesTable(row, filters));
    const safePage = Math.max(1, page);
    const safeSize = Math.min(50, Math.max(5, pageSize));
    const start = (safePage - 1) * safeSize;
    const complete = structural.filter(
      (row) => row.missing.length === 0,
    ).length;
    const incomplete = structural.length - complete;
    return {
      summary: {
        total: structural.length,
        complete,
        incomplete,
        completePercent: structural.length
          ? Math.round((complete / structural.length) * 1000) / 10
          : 0,
        incompletePercent: structural.length
          ? Math.round((incomplete / structural.length) * 1000) / 10
          : 0,
        pendingVerification: await this.pendingVerificationCount(
          tenantId,
          structural.map((row) => row.studentId),
        ),
      },
      requiredKeys: required,
      fields: PROFILE_MONITOR_FIELDS,
      rows: table.slice(start, start + safeSize),
      total: table.length,
      page: safePage,
      pageSize: safeSize,
      defaultMessage: DEFAULT_PROFILE_REMINDER,
      channels: {
        whatsapp: this.whatsapp.isConfigured(),
        sms: this.sms.isConfigured(),
        push: this.fcm.isConfigured(),
      },
    };
  }

  async matchingIds(tenantId: string, filters: MonitorFilters) {
    const required = await this.requiredKeys(tenantId);
    const evaluated = await this.evaluate(tenantId, filters, required);
    return evaluated
      .filter(
        (row) =>
          this.matchesStructure(row, filters) &&
          this.matchesTable(row, filters),
      )
      .map((row) => row.studentId);
  }

  async analytics(tenantId: string, filters: MonitorFilters) {
    const required = await this.requiredKeys(tenantId);
    const rows = (await this.evaluate(tenantId, filters, required)).filter(
      (row) => this.matchesStructure(row, filters),
    );
    const incomplete = rows.filter((row) => row.missing.length > 0);
    const byField = PROFILE_MONITOR_FIELDS.filter((field) =>
      required.includes(field.key),
    ).map((field) => {
      const missing = rows.filter((row) =>
        row.missing.some((item) => item.key === field.key),
      ).length;
      return {
        key: field.key,
        label: field.label,
        missing,
        filled: rows.length - missing,
        filledPercent: rows.length
          ? Math.round(((rows.length - missing) / rows.length) * 100)
          : 0,
      };
    });
    const departments = new Map<
      string,
      { students: number; complete: number }
    >();
    for (const row of rows) {
      const bucket = departments.get(row.department) ?? {
        students: 0,
        complete: 0,
      };
      bucket.students += 1;
      if (row.missing.length === 0) bucket.complete += 1;
      departments.set(row.department, bucket);
    }
    return {
      incompleteStudents: incomplete.length,
      multipleMissing: incomplete.filter((row) => row.missing.length > 1)
        .length,
      byField,
      byDepartment: [...departments.entries()]
        .map(([department, value]) => ({
          department,
          students: value.students,
          complete: value.complete,
          completePercent: value.students
            ? Math.round((value.complete / value.students) * 100)
            : 0,
        }))
        .sort((a, b) => a.completePercent - b.completePercent),
    };
  }

  async exportWorkbook(
    tenantId: string,
    filters: MonitorFilters,
    studentIds?: string[],
  ) {
    const required = await this.requiredKeys(tenantId);
    let rows = (await this.evaluate(tenantId, filters, required)).filter(
      (row) =>
        this.matchesStructure(row, filters) && this.matchesTable(row, filters),
    );
    if (studentIds?.length) {
      const wanted = new Set(studentIds);
      rows = rows.filter((row) => wanted.has(row.studentId));
    }
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Profile completion');
    sheet.columns = [
      { header: 'Roll Number', key: 'rollNumber', width: 16 },
      { header: 'Student Name', key: 'fullName', width: 28 },
      { header: 'Department', key: 'department', width: 22 },
      { header: 'Semester', key: 'semester', width: 12 },
      { header: 'Shift', key: 'shift', width: 16 },
      { header: 'Mobile Number', key: 'mobile', width: 16 },
      { header: 'Gender Status', key: 'gender', width: 16 },
      { header: 'Date of Birth Status', key: 'dob', width: 20 },
      { header: 'Blood Group Status', key: 'bloodGroup', width: 18 },
      { header: 'Other Missing Fields', key: 'other', width: 36 },
      { header: 'Profile Completion Percentage', key: 'percent', width: 18 },
    ];
    for (const row of rows) {
      const missing = new Set(row.missing.map((item) => item.key));
      sheet.addRow({
        rollNumber: row.rollNumber,
        fullName: row.fullName,
        department: row.department,
        semester: row.semester,
        shift: row.shift,
        mobile: row.mobileNumber ?? '',
        gender: missing.has('gender') ? 'Missing' : 'Filled',
        dob: missing.has('dob') ? 'Missing' : 'Filled',
        bloodGroup: missing.has('bloodGroup') ? 'Missing' : 'Filled',
        other: row.missing
          .filter((item) => !['gender', 'dob', 'bloodGroup'].includes(item.key))
          .map((item) => item.label)
          .join(', '),
        percent: row.percent,
      });
    }
    const buffer = await book.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async getSettings(tenantId: string) {
    const row = await this.prisma.profileCompletionSetting.findUnique({
      where: { tenantId },
    });
    return {
      requiredKeys: normalizeRequiredKeys(row?.requiredKeys),
      reminderIntervalHours: row?.reminderIntervalHours ?? 24,
      fields: PROFILE_MONITOR_FIELDS,
      defaultMessage: DEFAULT_PROFILE_REMINDER,
    };
  }

  async saveSettings(
    tenantId: string,
    input: { requiredKeys: string[]; reminderIntervalHours?: number },
  ) {
    const requiredKeys = normalizeRequiredKeys(input.requiredKeys);
    const reminderIntervalHours = Math.min(
      24 * 30,
      Math.max(1, Number(input.reminderIntervalHours ?? 24)),
    );
    await this.prisma.profileCompletionSetting.upsert({
      where: { tenantId },
      create: { tenantId, requiredKeys, reminderIntervalHours },
      update: { requiredKeys, reminderIntervalHours },
    });
    return this.getSettings(tenantId);
  }

  async history(tenantId: string, page = 1) {
    const take = 20;
    const skip = (Math.max(1, page) - 1) * take;
    const [rows, total] = await Promise.all([
      this.prisma.profileReminderBatch.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          deliveries: {
            select: { status: true, error: true, studentId: true },
          },
        },
      }),
      this.prisma.profileReminderBatch.count({ where: { tenantId } }),
    ]);
    const actors = await this.prisma.user.findMany({
      where: {
        id: {
          in: rows
            .map((row) => row.sentById)
            .filter((id): id is string => Boolean(id)),
        },
      },
      select: { id: true, email: true, displayName: true },
    });
    const actorName = new Map(
      actors.map((actor) => [actor.id, actor.displayName || actor.email]),
    );
    return {
      total,
      page,
      rows: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        channel: row.channel,
        audience: row.audience,
        recipients: row.recipientCount,
        successful: row.successCount,
        failed: row.failedCount,
        skipped: row.skippedCount,
        sentBy: row.sentById ? (actorName.get(row.sentById) ?? '—') : '—',
        message: row.messageTemplate,
        failures: row.deliveries
          .filter((item) => item.status === 'FAILED')
          .slice(0, 20)
          .map((item) => item.error)
          .filter(Boolean),
      })),
    };
  }

  async sendReminder(
    tenantId: string,
    actorId: string,
    input: MonitorFilters & {
      channel: Channel;
      audience: Audience;
      message: string;
      studentIds?: string[];
      missingField?: string;
    },
  ) {
    const message = input.message.trim();
    if (message.length < 10)
      throw new BadRequestException('Write a reminder message first.');
    const required = await this.requiredKeys(tenantId);
    const intervalHours = (await this.getSettings(tenantId))
      .reminderIntervalHours;
    let recipients = (await this.evaluate(tenantId, input, required)).filter(
      (row) => this.matchesStructure(row, input) && row.missing.length > 0,
    );
    if (input.audience === 'selected') {
      const wanted = new Set(input.studentIds ?? []);
      recipients = recipients.filter((row) => wanted.has(row.studentId));
    } else if (input.audience === 'missing_field') {
      if (!input.missingField || !isMonitorFieldKey(input.missingField)) {
        throw new BadRequestException('Choose the missing field to remind.');
      }
      recipients = recipients.filter((row) =>
        row.missing.some((item) => item.key === input.missingField),
      );
    }
    if (!recipients.length)
      throw new BadRequestException(
        'No incomplete students match this reminder.',
      );
    const channelReady =
      input.channel === 'PUSH'
        ? this.fcm.isConfigured()
        : input.channel === 'WHATSAPP'
          ? this.whatsapp.isConfigured()
          : this.sms.isConfigured();
    if (!channelReady) {
      throw new BadRequestException(
        input.channel === 'WHATSAPP'
          ? 'WhatsApp is not configured, so the reminder was not sent.'
          : input.channel === 'SMS'
            ? 'SMS is not configured, so the reminder was not sent.'
            : 'Push notifications are not configured, so the reminder was not sent.',
      );
    }

    const batch = await this.prisma.profileReminderBatch.create({
      data: {
        tenantId,
        channel: input.channel,
        audience: input.audience,
        messageTemplate: message,
        recipientCount: recipients.length,
        sentById: actorId,
      },
    });

    const work = () =>
      this.deliverBatch(
        batch.id,
        tenantId,
        actorId,
        recipients,
        { channel: input.channel, audience: input.audience, message },
        intervalHours,
      );
    if (recipients.length > SYNC_RECIPIENTS) {
      void work().catch((error) =>
        this.logger.error(
          `Profile reminder ${batch.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      return {
        batchId: batch.id,
        recipients: recipients.length,
        success: 0,
        failed: 0,
        skipped: 0,
        queued: true,
      };
    }
    const counts = await work();
    return { batchId: batch.id, recipients: recipients.length, ...counts };
  }

  private async deliverBatch(
    batchId: string,
    tenantId: string,
    actorId: string,
    recipients: Array<{
      studentId: string;
      fullName: string;
      rollNumber: string | null;
      mobileNumber: string | null;
      whatsappNumber: string | null;
      userId: string;
      missing: Array<{ label: string }>;
    }>,
    input: { channel: Channel; audience: Audience; message: string },
    intervalHours: number,
  ) {
    let success = 0;
    let failed = 0;
    let skipped = 0;
    const since = new Date(Date.now() - intervalHours * 60 * 60 * 1000);
    for (const student of recipients) {
      const recent = await this.prisma.profileReminderDelivery.findFirst({
        where: {
          tenantId,
          studentId: student.studentId,
          channel: input.channel,
          status: 'SENT',
          sentAt: { gte: since },
        },
        select: { id: true },
      });
      const body = personalizeReminder(input.message, {
        studentName: student.fullName,
        rollNumber: student.rollNumber ?? '',
        missingFields: student.missing.map((item) => item.label),
        collegeName: COLLEGE_NAME,
      });
      if (recent) {
        skipped += 1;
        await this.recordDelivery(
          batchId,
          tenantId,
          student,
          input.channel,
          'SKIPPED',
          {
            error: `A ${input.channel} reminder was already sent within ${intervalHours} hours.`,
          },
        );
        continue;
      }
      const result = await this.deliver(student, input.channel, body);
      if (result.status === 'SENT') success += 1;
      else failed += 1;
      await this.recordDelivery(
        batchId,
        tenantId,
        student,
        input.channel,
        result.status,
        result,
      );
    }

    await this.prisma.profileReminderBatch.update({
      where: { id: batchId },
      data: {
        successCount: success,
        failedCount: failed,
        skippedCount: skipped,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        module: 'students',
        action: 'PROFILE_COMPLETION_REMINDER',
        entityType: 'profile_reminder_batch',
        entityId: batchId,
        metadata: {
          channel: input.channel,
          audience: input.audience,
          recipients: recipients.length,
          success,
          failed,
          skipped,
        },
      },
    });
    return { success, failed, skipped };
  }

  private async deliver(
    student: {
      mobileNumber: string | null;
      whatsappNumber: string | null;
      userId: string;
      fullName: string;
    },
    channel: Channel,
    body: string,
  ): Promise<{
    status: 'SENT' | 'FAILED';
    provider?: string;
    providerRef?: string;
    error?: string;
    destination?: string;
  }> {
    if (channel === 'WHATSAPP' || channel === 'SMS') {
      const destination = normalizeMobile(
        channel === 'WHATSAPP'
          ? student.whatsappNumber || student.mobileNumber
          : student.mobileNumber,
      );
      if (!destination) {
        return {
          status: 'FAILED',
          error: 'Mobile number is missing or invalid.',
          destination: student.mobileNumber ?? undefined,
        };
      }
      const configured =
        channel === 'WHATSAPP'
          ? this.whatsapp.isConfigured()
          : this.sms.isConfigured();
      if (!configured) {
        return {
          status: 'FAILED',
          destination,
          provider: channel === 'WHATSAPP' ? 'whatsapp' : 'sms',
          error:
            channel === 'WHATSAPP'
              ? 'WhatsApp Business API is not configured, so the message was not sent.'
              : 'SMS gateway is not configured, so the message was not sent.',
        };
      }
      const sendOnce = () =>
        channel === 'WHATSAPP'
          ? this.whatsapp.send({ to: destination, body })
          : this.sms.send({ to: destination, message: body });
      const first = await sendOnce();
      const confirmed = first.ok && first.provider !== 'dev-log';
      if (confirmed) {
        return {
          status: 'SENT',
          destination,
          provider: first.provider,
          providerRef: first.providerRef,
        };
      }
      const retry = await sendOnce();
      if (retry.ok && retry.provider !== 'dev-log') {
        return {
          status: 'SENT',
          destination,
          provider: retry.provider,
          providerRef: retry.providerRef,
        };
      }
      return {
        status: 'FAILED',
        destination,
        provider: retry.provider,
        error:
          retry.error || first.error || 'The gateway did not confirm delivery.',
      };
    }

    const devices = await this.prisma.mobileDevice.findMany({
      where: {
        userId: student.userId,
        status: 'ACTIVE',
        pushToken: { not: null },
      },
      select: { pushToken: true },
    });
    const tokens = devices
      .map((device) => device.pushToken)
      .filter((token): token is string => Boolean(token));
    if (!tokens.length) {
      return {
        status: 'FAILED',
        error: 'No registered device with a push token.',
      };
    }
    if (!this.fcm.isConfigured()) {
      return {
        status: 'FAILED',
        provider: 'fcm',
        error:
          'Firebase Cloud Messaging is not configured, so the notification was not sent.',
      };
    }
    const result = await this.fcm.sendToTokens(tokens, {
      title: 'Complete Your Student Profile',
      body: body.slice(0, 180),
      data: { type: 'PROFILE_COMPLETION' },
    });
    if (
      result.ok &&
      result.provider !== 'fcm-demo' &&
      (result.successCount ?? 0) > 0
    ) {
      return {
        status: 'SENT',
        provider: result.provider,
        providerRef: result.providerRef,
      };
    }
    return {
      status: 'FAILED',
      provider: result.provider,
      error: result.error || 'Push notification was not confirmed.',
    };
  }

  private recordDelivery(
    batchId: string,
    tenantId: string,
    student: { studentId: string },
    channel: Channel,
    status: 'SENT' | 'FAILED' | 'SKIPPED',
    extra: {
      provider?: string;
      providerRef?: string;
      error?: string;
      destination?: string;
    },
  ) {
    return this.prisma.profileReminderDelivery.create({
      data: {
        batchId,
        tenantId,
        studentId: student.studentId,
        channel,
        destination: extra.destination,
        status,
        provider: extra.provider,
        providerRef: extra.providerRef,
        error: extra.error,
      },
    });
  }

  private async requiredKeys(tenantId: string) {
    const row = await this.prisma.profileCompletionSetting.findUnique({
      where: { tenantId },
    });
    return normalizeRequiredKeys(row?.requiredKeys);
  }

  private async pendingVerificationCount(
    tenantId: string,
    studentIds: string[],
  ) {
    if (!studentIds.length) return 0;
    const rows = await this.prisma.studentProfileChangeRequest.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds },
        items: { some: { approvalStatus: { in: ['PENDING', 'NEEDS_INFO'] } } },
      },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    return rows.length;
  }

  private matchesStructure(
    row: {
      departmentId: string | null;
      semester: number;
      shiftId: string | null;
      gender: string | null;
    },
    filters: MonitorFilters,
  ) {
    if (filters.semester && row.semester !== filters.semester) return false;
    if (filters.gender) {
      const wanted =
        normalizeGenderCode(filters.gender) ||
        filters.gender.trim().toUpperCase();
      const actual = normalizeGenderCode(row.gender);
      if (
        actual !== wanted &&
        String(row.gender ?? '')
          .trim()
          .toUpperCase() !== wanted
      )
        return false;
    }
    return true;
  }

  private matchesTable(
    row: {
      missing: Array<{ key: string }>;
      fullName: string;
      rollNumber: string | null;
      mobileNumber: string | null;
    },
    filters: MonitorFilters,
  ) {
    const status = filters.status ?? 'incomplete';
    if (status === 'incomplete' && row.missing.length === 0) return false;
    if (status === 'complete' && row.missing.length > 0) return false;
    if (
      filters.missingField &&
      !row.missing.some((item) => item.key === filters.missingField)
    )
      return false;
    const query = filters.search?.trim().toLowerCase();
    if (!query) return true;
    return `${row.fullName} ${row.rollNumber ?? ''} ${row.mobileNumber ?? ''}`
      .toLowerCase()
      .includes(query);
  }

  private async evaluate(
    tenantId: string,
    filters: MonitorFilters,
    required: ProfileMonitorFieldKey[],
  ) {
    const students = await this.loadStudents(tenantId, filters);
    return students.map((student) => this.toRow(student, required));
  }

  private toRow(student: LoadedStudent, required: ProfileMonitorFieldKey[]) {
    const profile = student.masterProfile;
    const presence = this.presence(student);
    const missing = missingFields(presence, required);
    return {
      studentId: student.id,
      userId: student.userId,
      fullName: profile?.fullName ?? '—',
      rollNumber: student.rollNumber,
      department: student.department?.name ?? '—',
      departmentId: student.departmentId,
      programme: student.programVersion?.program?.name ?? '—',
      semester: student.academicStanding?.currentSemesterSequence ?? 1,
      shift: student.primaryShift?.name ?? '—',
      shiftId: student.primaryShiftId,
      gender: profile?.gender ?? null,
      mobileNumber: profile?.mobileNumber ?? null,
      whatsappNumber: profile?.whatsappNumber ?? null,
      missing,
      percent: completionPercent(missing.length, required.length),
      updatedAt: profile?.updatedAt ?? student.updatedAt,
    };
  }

  private presence(student: LoadedStudent): MonitorPresence {
    const profile = student.masterProfile;
    const addresses = student.addresses ?? [];
    const guardians = student.guardians ?? [];
    const addressFilled = (types: string[]) =>
      addresses.some(
        (address) =>
          types.includes(address.addressType) &&
          [address.line1, address.city, address.district, address.pinCode].some(
            (part) => isFilled(part),
          ),
      );
    const guardianFilled = (type: string) =>
      isFilled(
        guardians.find((guardian) => guardian.guardianType === type)?.fullName,
      );
    return {
      gender: isFilled(profile?.gender),
      dob: isFilled(profile?.dateOfBirth),
      bloodGroup: isFilled(profile?.bloodGroupLookupId),
      mobile: isValidMobile(profile?.mobileNumber),
      email: isValidEmail(profile?.email) || isValidEmail(student.user?.email),
      permanentAddress: addressFilled(['PERMANENT', 'HOME']),
      presentAddress: addressFilled(['CURRENT', 'TURA']),
      fatherName: guardianFilled('FATHER'),
      motherName: guardianFilled('MOTHER'),
      photo: isFilled(profile?.photoPath),
    };
  }

  private loadStudents(tenantId: string, filters: MonitorFilters) {
    return this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.shiftId ? { primaryShiftId: filters.shiftId } : {}),
        ...(filters.academicYearId
          ? {
              academicProfile: {
                is: { admissionYearId: filters.academicYearId },
              },
            }
          : {}),
        ...(filters.semester
          ? {
              academicStanding: {
                is: { currentSemesterSequence: filters.semester },
              },
            }
          : {}),
      },
      select: {
        id: true,
        userId: true,
        rollNumber: true,
        departmentId: true,
        primaryShiftId: true,
        updatedAt: true,
        department: { select: { name: true } },
        primaryShift: { select: { name: true } },
        programVersion: { select: { program: { select: { name: true } } } },
        academicStanding: { select: { currentSemesterSequence: true } },
        user: { select: { email: true } },
        masterProfile: {
          select: {
            fullName: true,
            gender: true,
            dateOfBirth: true,
            bloodGroupLookupId: true,
            mobileNumber: true,
            whatsappNumber: true,
            email: true,
            photoPath: true,
            updatedAt: true,
          },
        },
        addresses: {
          select: {
            addressType: true,
            line1: true,
            city: true,
            district: true,
            pinCode: true,
          },
        },
        guardians: { select: { guardianType: true, fullName: true } },
      },
      orderBy: [{ rollNumber: 'asc' }],
      take: 8000,
    });
  }
}
