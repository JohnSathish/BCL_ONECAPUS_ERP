import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

export type StoragePutOptions = {
  contentType?: string;
  cacheControl?: string;
};

@Injectable()
export class StorageService {
  private readonly driver: 'local' | 's3' | 'r2';
  private readonly localRoot: string;

  constructor(private readonly config: ConfigService) {
    this.driver = (this.config.get<string>('STORAGE_DRIVER') ?? 'local') as
      | 'local'
      | 's3'
      | 'r2';
    this.localRoot =
      this.config.get<string>('STORAGE_ROOT') ?? join(process.cwd(), 'storage');
  }

  resolveLocalPath(key: string) {
    return join(this.localRoot, key.replace(/^\/+/, ''));
  }

  async put(key: string, data: Buffer, _opts?: StoragePutOptions) {
    if (this.driver === 'local') {
      const filePath = this.resolveLocalPath(key);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, data);
      return { key, path: filePath, url: null as string | null };
    }
    return this.putObjectStorage(key, data, _opts);
  }

  async get(key: string): Promise<Buffer | null> {
    if (this.driver === 'local') {
      try {
        return await readFile(this.resolveLocalPath(key));
      } catch {
        return null;
      }
    }
    return this.getObjectStorage(key);
  }

  async exists(key: string): Promise<boolean> {
    const buf = await this.get(key);
    return buf != null;
  }

  private async putObjectStorage(
    key: string,
    data: Buffer,
    opts?: StoragePutOptions,
  ) {
    const bucket = this.bucketName();
    if (!bucket) {
      const filePath = this.resolveLocalPath(key);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, data);
      return { key, path: filePath, url: null };
    }
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = this.s3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: opts?.contentType,
        CacheControl: opts?.cacheControl,
      }),
    );
    return { key, path: null, url: this.publicUrl(key) };
  }

  private async getObjectStorage(key: string): Promise<Buffer | null> {
    const bucket = this.bucketName();
    if (!bucket) return null;
    try {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const client = this.s3Client();
      const res = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      const body = res.Body;
      if (!body) return null;
      const chunks: Uint8Array[] = [];
      for await (const chunk of body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }

  private bucketName() {
    if (this.driver === 'r2') return this.config.get<string>('R2_BUCKET') ?? '';
    return this.config.get<string>('AWS_S3_BUCKET') ?? '';
  }

  private s3Client() {
    const { S3Client } =
      require('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3');
    if (this.driver === 'r2') {
      const accountId = this.config.get<string>('R2_ACCOUNT_ID');
      return new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID') ?? '',
          secretAccessKey:
            this.config.get<string>('R2_SECRET_ACCESS_KEY') ?? '',
        },
      });
    }
    return new S3Client({
      region: this.config.get<string>('AWS_REGION') ?? 'ap-south-1',
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

  private publicUrl(key: string) {
    const cdn = this.config.get<string>('CDN_URL');
    if (cdn) return `${cdn.replace(/\/$/, '')}/${key}`;
    return null;
  }
}
