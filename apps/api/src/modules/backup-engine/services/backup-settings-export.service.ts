import { Injectable } from '@nestjs/common';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../../database/prisma.service';
import { BackupFilesService } from './backup-files.service';

@Injectable()
export class BackupSettingsExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: BackupFilesService,
  ) {}

  async exportSettings(runId: string) {
    const settingsDir = join(this.files.runDir(runId), 'settings');
    const { mkdir } = await import('fs/promises');
    await mkdir(settingsDir, { recursive: true });

    const [tenants, branding, themes, security, rollSettings, studentDisplay] =
      await Promise.all([
        this.prisma.tenant.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        }),
        this.prisma.tenantBranding.findMany(),
        this.prisma.appThemeSettings.findMany(),
        this.prisma.tenantSecuritySettings.findMany(),
        this.prisma.rollNumberSettings.findMany(),
        this.prisma.studentDisplaySettings.findMany(),
      ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      tenants,
      branding,
      themes,
      security,
      rollSettings,
      studentDisplay,
    };

    const filePath = join(settingsDir, 'platform-settings.json');
    await writeFile(filePath, JSON.stringify(payload, null, 2));
    return filePath;
  }

  async buildManifest(runId: string, meta: Record<string, unknown>) {
    const manifestPath = join(this.files.runDir(runId), 'manifest.json');
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          version: 1,
          runId,
          createdAt: new Date().toISOString(),
          ...meta,
        },
        null,
        2,
      ),
    );
    return manifestPath;
  }
}
