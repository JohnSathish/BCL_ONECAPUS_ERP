import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  DEFAULT_STUDENT_NAME_DISPLAY_FORMAT,
  formatStudentDisplayName,
  normalizeStudentNameDisplayFormat,
  type StudentNameDisplayFormat,
} from '../../../common/utils/student-name-format';
import type { UpdateStudentDisplaySettingsDto } from '../dto/student-display-settings.dto';

@Injectable()
export class StudentDisplaySettingsService {
  private readonly formatCache = new Map<string, StudentNameDisplayFormat>();

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    const row = await this.ensureSettings(tenantId);
    const nameDisplayFormat = normalizeStudentNameDisplayFormat(
      row.nameDisplayFormat,
    );
    this.formatCache.set(tenantId, nameDisplayFormat);
    return { nameDisplayFormat };
  }

  async getFormat(tenantId: string): Promise<StudentNameDisplayFormat> {
    const cached = this.formatCache.get(tenantId);
    if (cached) return cached;
    const settings = await this.getSettings(tenantId);
    return settings.nameDisplayFormat;
  }

  formatName(
    name: string | null | undefined,
    format?: StudentNameDisplayFormat,
  ): string {
    return formatStudentDisplayName(
      name,
      format ?? DEFAULT_STUDENT_NAME_DISPLAY_FORMAT,
    );
  }

  async formatNameForTenant(
    tenantId: string,
    name: string | null | undefined,
  ): Promise<string> {
    const format = await this.getFormat(tenantId);
    return this.formatName(name, format);
  }

  async updateSettings(tenantId: string, dto: UpdateStudentDisplaySettingsDto) {
    await this.ensureSettings(tenantId);
    const updated = await this.prisma.studentDisplaySettings.update({
      where: { tenantId },
      data: {
        ...(dto.nameDisplayFormat !== undefined
          ? {
              nameDisplayFormat: normalizeStudentNameDisplayFormat(
                dto.nameDisplayFormat,
              ),
            }
          : {}),
      },
    });
    const nameDisplayFormat = normalizeStudentNameDisplayFormat(
      updated.nameDisplayFormat,
    );
    this.formatCache.set(tenantId, nameDisplayFormat);
    return { nameDisplayFormat };
  }

  private async ensureSettings(tenantId: string) {
    const existing = await this.prisma.studentDisplaySettings.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;
    return this.prisma.studentDisplaySettings.create({
      data: {
        tenantId,
        nameDisplayFormat: DEFAULT_STUDENT_NAME_DISPLAY_FORMAT,
      },
    });
  }
}
