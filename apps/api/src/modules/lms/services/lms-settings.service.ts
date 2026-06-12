import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class LmsSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(tenantId: string) {
    const existing = await this.prisma.lmsSettings.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;
    return this.prisma.lmsSettings.create({
      data: {
        tenantId,
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/zip',
          'image/jpeg',
          'image/png',
          'image/webp',
          'video/mp4',
          'audio/mpeg',
          'text/plain',
        ],
      },
    });
  }

  async update(
    tenantId: string,
    data: {
      maxUploadMb?: number;
      allowedMimeTypes?: string[];
      poolWorkspacesEnabled?: boolean;
      defaultVisibility?: string;
      featureFlags?: Record<string, boolean>;
    },
  ) {
    await this.getOrCreate(tenantId);
    return this.prisma.lmsSettings.update({
      where: { tenantId },
      data: {
        ...(data.maxUploadMb != null ? { maxUploadMb: data.maxUploadMb } : {}),
        ...(data.allowedMimeTypes
          ? { allowedMimeTypes: data.allowedMimeTypes }
          : {}),
        ...(data.poolWorkspacesEnabled != null
          ? { poolWorkspacesEnabled: data.poolWorkspacesEnabled }
          : {}),
        ...(data.defaultVisibility
          ? { defaultVisibility: data.defaultVisibility }
          : {}),
        ...(data.featureFlags ? { featureFlags: data.featureFlags } : {}),
      },
    });
  }
}
