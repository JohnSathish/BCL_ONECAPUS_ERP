import { Injectable } from '@nestjs/common';
import { stat } from 'fs/promises';
import { PrismaService } from '../../../database/prisma.service';
import { BackupDatabaseService } from './backup-database.service';
import { BackupFilesService } from './backup-files.service';

@Injectable()
export class BackupVerifyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly db: BackupDatabaseService,
    private readonly files: BackupFilesService,
  ) {}

  async verifyRun(runId: string) {
    const artifacts = await this.prisma.backupArtifact.findMany({
      where: { runId },
    });
    const results = [];
    for (const artifact of artifacts) {
      try {
        await stat(artifact.localPath);
        const checksum = await this.files.sha256File(artifact.localPath);
        const ok = artifact.checksumSha256
          ? artifact.checksumSha256 === checksum
          : true;
        if (artifact.kind === 'DATABASE' && ok) {
          await this.db.listDumpContents(artifact.localPath).catch(() => null);
        }
        await this.prisma.backupArtifact.update({
          where: { id: artifact.id },
          data: {
            checksumSha256: checksum,
            verifiedAt: ok ? new Date() : null,
          },
        });
        results.push({ artifactId: artifact.id, ok, checksum });
      } catch (err) {
        results.push({
          artifactId: artifact.id,
          ok: false,
          error: String(err),
        });
      }
    }
    const allOk = results.every((r) => r.ok);
    return { runId, allOk, results };
  }
}
