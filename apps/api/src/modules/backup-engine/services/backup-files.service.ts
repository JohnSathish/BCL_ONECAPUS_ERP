import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  assertZipArchive,
  BackupPackCancelledError,
  writeStoreZip,
  type ZipEntry,
  type ZipWriteProgress,
} from '../backup-zip.util';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, readdir, stat, writeFile } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class BackupFilesService {
  constructor(private readonly config: ConfigService) {}

  /** Match StorageService / admissions paths — never default to /data on Windows. */
  uploadRoot() {
    return this.resolveRoot(
      'UPLOAD_ROOT',
      join(process.cwd(), 'uploads'),
      '/data/uploads',
    );
  }

  storageRoot() {
    return this.resolveRoot(
      'STORAGE_ROOT',
      join(process.cwd(), 'storage'),
      '/data/storage',
    );
  }

  backupRoot() {
    return this.resolveRoot(
      'BACKUP_ROOT',
      join(process.cwd(), 'backups'),
      '/data/backups',
    );
  }

  private resolveRoot(
    envKey: string,
    localDefault: string,
    dockerDefault: string,
  ) {
    const configured = this.config.get<string>(envKey);
    if (configured) {
      if (
        process.platform === 'win32' &&
        configured.replace(/\\/g, '/').startsWith('/data')
      ) {
        return localDefault;
      }
      return configured;
    }
    return process.platform === 'win32' ? localDefault : dockerDefault;
  }

  runDir(runId: string) {
    return join(this.backupRoot(), runId);
  }

  async writeVerifiedZip(
    outputPath: string,
    entries: ZipEntry[],
    options?: {
      onProgress?: (progress: ZipWriteProgress) => void;
      isCancelled?: () => boolean;
    },
  ) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeStoreZip(outputPath, entries, options);
    const info = await assertZipArchive(outputPath);
    if (info.size <= 0) throw new Error('ZIP archive is empty');
    return { sizeBytes: BigInt(info.size) };
  }

  async sha256File(
    filePath: string,
    hooks?: {
      onProgress?: (bytesProcessed: number, bytesTotal: number) => void;
      isCancelled?: () => boolean;
    },
  ): Promise<string> {
    const hash = createHash('sha256');
    if (!hooks?.onProgress && !hooks?.isCancelled) {
      await pipeline(createReadStream(filePath), hash);
      return hash.digest('hex');
    }
    const total = (await stat(filePath)).size;
    let processed = 0;
    const stream = createReadStream(filePath);
    for await (const chunk of stream) {
      if (hooks.isCancelled?.()) {
        stream.destroy();
        throw new BackupPackCancelledError();
      }
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      hash.update(buf);
      processed += buf.length;
      hooks.onProgress?.(processed, total);
    }
    return hash.digest('hex');
  }

  private async hasZstd(): Promise<boolean> {
    try {
      await execFileAsync('zstd', ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  private async existingArchiveSources(): Promise<
    Array<{ parent: string; name: string }>
  > {
    const sources: Array<{ parent: string; name: string }> = [];
    for (const root of [this.uploadRoot(), this.storageRoot()]) {
      await mkdir(root, { recursive: true });
      const parent = dirname(root);
      await mkdir(parent, { recursive: true });
      try {
        const info = await stat(root);
        if (info.isDirectory()) {
          sources.push({ parent, name: basename(root) });
        }
      } catch {
        // skip unreadable paths
      }
    }
    return sources;
  }

  async archiveInstanceFiles(
    outputPath: string,
  ): Promise<{ sizeBytes: bigint }> {
    await mkdir(dirname(outputPath), { recursive: true });
    const useZstd = await this.hasZstd();
    const tarPath = outputPath.replace(/\.(tar\.zst|tar\.gz)$/, '.tar');
    const sources = await this.existingArchiveSources();

    if (!sources.length) {
      await writeFile(tarPath, '');
    } else {
      for (const { parent } of sources) {
        await mkdir(parent, { recursive: true });
      }
      await execFileAsync('tar', [
        '-cf',
        tarPath,
        ...sources.flatMap(({ parent, name }) => ['-C', parent, name]),
      ]);
    }

    if (useZstd) {
      await execFileAsync('zstd', ['-f', '-T0', tarPath, '-o', outputPath]);
      const { unlink } = await import('fs/promises');
      await unlink(tarPath).catch(() => undefined);
    } else {
      await pipeline(
        createReadStream(tarPath),
        createGzip({ level: 9 }),
        createWriteStream(outputPath),
      );
      const { unlink } = await import('fs/promises');
      await unlink(tarPath).catch(() => undefined);
    }

    const s = await stat(outputPath);
    return { sizeBytes: BigInt(s.size) };
  }

  async extractFilesArchive(archivePath: string): Promise<void> {
    const useZstd = archivePath.endsWith('.zst');
    let tarPath = archivePath;
    if (useZstd) {
      tarPath = archivePath.replace(/\.zst$/, '');
      await execFileAsync('zstd', ['-d', '-f', archivePath, '-o', tarPath]);
    } else if (archivePath.endsWith('.gz')) {
      const { createGunzip } = await import('zlib');
      tarPath = archivePath.replace(/\.gz$/, '');
      await pipeline(
        createReadStream(archivePath),
        createGunzip(),
        createWriteStream(tarPath),
      );
    }
    const extractRoot = dirname(this.uploadRoot());
    await mkdir(extractRoot, { recursive: true });
    await execFileAsync('tar', ['-xf', tarPath, '-C', extractRoot]);
    if (tarPath !== archivePath) {
      const { unlink } = await import('fs/promises');
      await unlink(tarPath).catch(() => undefined);
    }
  }

  async archiveTenantFiles(
    tenantId: string,
    tenantSlug: string,
    outputPath: string,
  ): Promise<{ sizeBytes: bigint; fileCount: number }> {
    await mkdir(dirname(outputPath), { recursive: true });
    const paths: string[] = [];
    for (const root of [this.uploadRoot(), this.storageRoot()]) {
      await collectTenantPaths(root, tenantId, paths);
    }
    if (!paths.length) {
      const { writeFile } = await import('fs/promises');
      await writeFile(outputPath, '');
      return { sizeBytes: 0n, fileCount: 0 };
    }
    const listFile = `${outputPath}.list`;
    const { writeFile } = await import('fs/promises');
    await writeFile(listFile, paths.join('\n'));
    const useZstd = await this.hasZstd();
    const tarPath = outputPath.replace(/\.(tar\.zst|tar\.gz)$/, '.tar');
    await execFileAsync('tar', ['-cf', tarPath, '-T', listFile]);
    if (useZstd) {
      await execFileAsync('zstd', ['-f', tarPath, '-o', outputPath]);
    } else {
      await pipeline(
        createReadStream(tarPath),
        createGzip({ level: 9 }),
        createWriteStream(outputPath),
      );
    }
    const { unlink } = await import('fs/promises');
    await unlink(tarPath).catch(() => undefined);
    await unlink(listFile).catch(() => undefined);
    const s = await stat(outputPath);
    return { sizeBytes: BigInt(s.size), fileCount: paths.length };
  }
}

async function collectTenantPaths(
  root: string,
  tenantId: string,
  out: string[],
) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const e of entries) {
      const full = join(root, e.name);
      if (e.isDirectory()) {
        if (e.name === tenantId || full.includes(tenantId)) {
          await walkDir(full, out);
        } else {
          await collectTenantPaths(full, tenantId, out);
        }
      } else if (full.includes(tenantId)) {
        out.push(full);
      }
    }
  } catch {
    // root may not exist in dev
  }
}

async function walkDir(dir: string, out: string[]) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await walkDir(full, out);
    else out.push(full);
  }
}
