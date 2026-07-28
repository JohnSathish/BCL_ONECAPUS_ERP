import { Injectable } from '@nestjs/common';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { UpdateMoodleSettingsDto } from './dto/moodle.dto';

@Injectable()
export class MoodleSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldEncryptionService,
  ) {}

  async getOrCreate(tenantId: string) {
    const existing = await this.prisma.moodleSettings.findUnique({
      where: { tenantId },
    });
    if (existing) return this.maskSecrets(existing);
    const row = await this.prisma.moodleSettings.create({ data: { tenantId } });
    return this.maskSecrets(row);
  }

  async update(tenantId: string, dto: UpdateMoodleSettingsDto) {
    await this.prisma.moodleSettings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
    const row = await this.prisma.moodleSettings.update({
      where: { tenantId },
      data: {
        ...(dto.moodleUrl !== undefined
          ? { moodleUrl: dto.moodleUrl.trim() || null }
          : {}),
        ...(dto.wsToken !== undefined
          ? { wsTokenEncrypted: this.crypto.encrypt(dto.wsToken) }
          : {}),
        ...(dto.wsServiceName !== undefined
          ? { wsServiceName: dto.wsServiceName.trim() || null }
          : {}),
        ...(dto.ssoSecret !== undefined
          ? { ssoSecretEncrypted: this.crypto.encrypt(dto.ssoSecret) }
          : {}),
        ...(dto.enableSync !== undefined ? { enableSync: dto.enableSync } : {}),
        ...(dto.enableAutoUserCreation !== undefined
          ? { enableAutoUserCreation: dto.enableAutoUserCreation }
          : {}),
        ...(dto.enableAutoCourseCreation !== undefined
          ? { enableAutoCourseCreation: dto.enableAutoCourseCreation }
          : {}),
        ...(dto.enableAutoEnrollment !== undefined
          ? { enableAutoEnrollment: dto.enableAutoEnrollment }
          : {}),
        ...(dto.enableGradeSync !== undefined
          ? { enableGradeSync: dto.enableGradeSync }
          : {}),
        ...(dto.enableAttendanceSync !== undefined
          ? { enableAttendanceSync: dto.enableAttendanceSync }
          : {}),
        ...(dto.enableAssignmentSync !== undefined
          ? { enableAssignmentSync: dto.enableAssignmentSync }
          : {}),
        ...(dto.enableNotificationSync !== undefined
          ? { enableNotificationSync: dto.enableNotificationSync }
          : {}),
        ...(dto.ssoEnabled !== undefined ? { ssoEnabled: dto.ssoEnabled } : {}),
        ...(dto.cronIntervalMinutes !== undefined
          ? { cronIntervalMinutes: dto.cronIntervalMinutes }
          : {}),
      },
    });
    return this.maskSecrets(row);
  }

  async getDecrypted(tenantId: string) {
    const row = await this.prisma.moodleSettings.findUnique({
      where: { tenantId },
    });
    return {
      moodleUrl: row?.moodleUrl ?? null,
      wsToken: this.crypto.decrypt(row?.wsTokenEncrypted ?? null),
      wsServiceName: row?.wsServiceName ?? null,
      ssoSecret: this.crypto.decrypt(row?.ssoSecretEncrypted ?? null),
      settings: row,
    };
  }

  async markConnection(tenantId: string, status: string, error: string | null) {
    await this.prisma.moodleSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        connectionStatus: status,
        lastConnectionAt: new Date(),
        lastConnectionError: error,
      },
      update: {
        connectionStatus: status,
        lastConnectionAt: new Date(),
        lastConnectionError: error,
      },
    });
  }

  async isSyncEnabled(tenantId: string) {
    const row = await this.prisma.moodleSettings.findUnique({
      where: { tenantId },
    });
    return Boolean(row?.enableSync && row.moodleUrl && row.wsTokenEncrypted);
  }

  private maskSecrets<
    T extends {
      wsTokenEncrypted?: string | null;
      ssoSecretEncrypted?: string | null;
    },
  >(row: T) {
    return {
      ...row,
      wsTokenEncrypted: row.wsTokenEncrypted ? '***' : null,
      ssoSecretEncrypted: row.ssoSecretEncrypted ? '***' : null,
      hasWsToken: Boolean(row.wsTokenEncrypted),
      hasSsoSecret: Boolean(row.ssoSecretEncrypted),
    };
  }
}
