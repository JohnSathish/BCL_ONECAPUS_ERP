import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { mkdir, stat } from 'fs/promises';
import { dirname } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class BackupDatabaseService {
  private readonly logger = new Logger(BackupDatabaseService.name);

  constructor(private readonly config: ConfigService) {}

  pgDumpPath() {
    return this.config.get<string>('BACKUP_PG_DUMP_PATH', 'pg_dump');
  }

  pgRestorePath() {
    return this.config.get<string>('BACKUP_PG_RESTORE_PATH', 'pg_restore');
  }

  databaseUrl() {
    return this.config.get<string>('DATABASE_URL') ?? '';
  }

  skipDump() {
    return (
      this.config.get<string>('BACKUP_SKIP_DUMP') === 'true' ||
      process.platform === 'win32'
    );
  }

  async dumpDatabase(outputPath: string): Promise<{ sizeBytes: bigint }> {
    await mkdir(dirname(outputPath), { recursive: true });

    if (this.skipDump()) {
      this.logger.warn('Skipping pg_dump (BACKUP_SKIP_DUMP or Windows dev)');
      const { writeFile } = await import('fs/promises');
      await writeFile(outputPath, '-- stub backup for dev\n');
      const s = await stat(outputPath);
      return { sizeBytes: BigInt(s.size) };
    }

    const url = this.databaseUrl();
    await new Promise<void>((resolve, reject) => {
      const child = execFile(
        this.pgDumpPath(),
        ['-Fc', '--no-owner', '--no-acl', '-f', outputPath, url],
        (err) => (err ? reject(err) : resolve()),
      );
      child.stderr?.on('data', (d) => this.logger.debug(String(d)));
    });

    const s = await stat(outputPath);
    return { sizeBytes: BigInt(s.size) };
  }

  async restoreDatabase(dumpPath: string): Promise<void> {
    if (this.skipDump()) {
      this.logger.warn('Skipping pg_restore in dev stub mode');
      return;
    }
    const url = this.databaseUrl();
    await execFileAsync(this.pgRestorePath(), [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-acl',
      '-d',
      url,
      dumpPath,
    ]);
  }

  async listDumpContents(dumpPath: string): Promise<string> {
    if (this.skipDump()) return 'stub';
    const { stdout } = await execFileAsync(this.pgRestorePath(), [
      '--list',
      dumpPath,
    ]);
    return stdout;
  }
}
