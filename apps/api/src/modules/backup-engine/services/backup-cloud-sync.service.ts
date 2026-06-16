import { Injectable, Logger } from '@nestjs/common';
import { readFile, stat } from 'fs/promises';
import { PrismaService } from '../../../database/prisma.service';
import { BackupCryptoService } from './backup-crypto.service';

type CloudCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
};

@Injectable()
export class BackupCloudSyncService {
  private readonly logger = new Logger(BackupCloudSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: BackupCryptoService,
  ) {}

  async listTargetsMasked() {
    const targets = await this.prisma.backupCloudTarget.findMany({
      orderBy: { provider: 'asc' },
    });
    return targets.map((t) => ({
      ...t,
      credentialsEncrypted: undefined,
      hasCredentials: Boolean(t.credentialsEncrypted),
    }));
  }

  async upsertTarget(input: {
    provider: string;
    bucket: string;
    region?: string;
    endpoint?: string;
    pathPrefix?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    enabled?: boolean;
  }) {
    let credentialsEncrypted: string | undefined;
    const existing = await this.prisma.backupCloudTarget.findUnique({
      where: { provider: input.provider },
    });
    if (input.accessKeyId && input.secretAccessKey) {
      credentialsEncrypted = this.crypto.encrypt(
        JSON.stringify({
          accessKeyId: input.accessKeyId,
          secretAccessKey: input.secretAccessKey,
        }),
      );
    } else if (existing?.credentialsEncrypted) {
      credentialsEncrypted = existing.credentialsEncrypted;
    }

    return this.prisma.backupCloudTarget.upsert({
      where: { provider: input.provider },
      create: {
        provider: input.provider,
        bucket: input.bucket,
        region: input.region,
        endpoint: input.endpoint,
        pathPrefix: input.pathPrefix ?? 'nep-backups',
        credentialsEncrypted,
        enabled: input.enabled ?? false,
      },
      update: {
        bucket: input.bucket,
        region: input.region,
        endpoint: input.endpoint,
        pathPrefix: input.pathPrefix,
        credentialsEncrypted,
        enabled: input.enabled,
      },
    });
  }

  private credentials(target: {
    credentialsEncrypted: string | null;
  }): CloudCredentials | null {
    if (!target.credentialsEncrypted) return null;
    try {
      return JSON.parse(this.crypto.decrypt(target.credentialsEncrypted));
    } catch {
      return null;
    }
  }

  private s3Client(target: {
    provider: string;
    region: string | null;
    endpoint: string | null;
    credentialsEncrypted: string | null;
  }) {
    const creds = this.credentials(target);
    if (!creds) throw new Error('Cloud credentials not configured');
    const { S3Client } =
      require('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3');
    const region = target.region ?? 'us-east-1';
    if (target.provider === 'BACKBLAZE_B2') {
      return new S3Client({
        region,
        endpoint: target.endpoint ?? undefined,
        credentials: creds,
        forcePathStyle: true,
      });
    }
    return new S3Client({ region, credentials: creds });
  }

  async uploadArtifact(artifactId: string) {
    const artifact = await this.prisma.backupArtifact.findUnique({
      where: { id: artifactId },
      include: { run: true },
    });
    if (!artifact) throw new Error('Artifact not found');

    const targets = await this.prisma.backupCloudTarget.findMany({
      where: { enabled: true },
    });
    if (!targets.length) {
      await this.prisma.backupArtifact.update({
        where: { id: artifactId },
        data: { cloudStatus: 'PENDING' },
      });
      return { uploaded: 0 };
    }

    const fileStat = await stat(artifact.localPath);
    const key = `${artifact.runId}/${artifact.kind.toLowerCase()}-${artifact.id}${suffixForPath(artifact.localPath)}`;
    let uploaded = 0;
    let lastError: string | undefined;

    for (const target of targets) {
      try {
        const client = this.s3Client(target);
        const { PutObjectCommand } =
          require('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3');
        const prefix = target.pathPrefix.replace(/\/+$/, '');
        const cloudKey = `${prefix}/${key}`;
        const body = await readFile(artifact.localPath);
        await client.send(
          new PutObjectCommand({
            Bucket: target.bucket,
            Key: cloudKey,
            Body: body,
            ContentLength: fileStat.size,
          }),
        );
        await this.prisma.backupCloudTarget.update({
          where: { id: target.id },
          data: { lastSyncAt: new Date(), lastSyncError: null },
        });
        uploaded++;
        await this.prisma.backupArtifact.update({
          where: { id: artifactId },
          data: { cloudStatus: 'SYNCED', cloudKey },
        });
      } catch (err) {
        lastError = String(err);
        this.logger.error(
          `Cloud upload failed ${target.provider}: ${lastError}`,
        );
        await this.prisma.backupCloudTarget.update({
          where: { id: target.id },
          data: { lastSyncError: lastError },
        });
        await this.prisma.backupArtifact.update({
          where: { id: artifactId },
          data: { cloudStatus: 'FAILED' },
        });
      }
    }

    return { uploaded, lastError };
  }

  async syncRun(runId: string) {
    const artifacts = await this.prisma.backupArtifact.findMany({
      where: { runId },
    });
    const results = [];
    for (const a of artifacts) {
      results.push(await this.uploadArtifact(a.id));
    }
    return results;
  }

  async deleteCloudObject(cloudKey: string | null) {
    if (!cloudKey) return;
    const targets = await this.prisma.backupCloudTarget.findMany({
      where: { enabled: true },
    });
    const { DeleteObjectCommand } =
      require('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3');
    for (const target of targets) {
      try {
        const client = this.s3Client(target);
        await client.send(
          new DeleteObjectCommand({ Bucket: target.bucket, Key: cloudKey }),
        );
      } catch (err) {
        this.logger.warn(`Cloud delete failed: ${String(err)}`);
      }
    }
  }
}

function suffixForPath(localPath: string) {
  const m = localPath.match(/(\.[^./\\]+(?:\.[^./\\]+)?)$/);
  return m?.[1] ?? '';
}
