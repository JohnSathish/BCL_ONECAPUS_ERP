import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import JSZip from 'jszip';
import {
  assertZipArchive,
  BackupPackCancelledError,
  writeStoreZip,
} from './backup-zip.util';

describe('writeStoreZip', () => {
  it('writes a ZIP whose central directory JSZip can read', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'backup-zip-'));
    try {
      const dump = join(dir, 'database.dump');
      const manifest = join(dir, 'backup-manifest.json');
      await writeFile(dump, 'PGDMP college backup\n');
      await writeFile(
        manifest,
        '{"backupId":"test","collegeName":"Don Bosco College"}\n',
      );
      const zipPath = join(dir, 'college-backup.zip');
      await writeStoreZip(zipPath, [
        { name: 'backup-manifest.json', sourcePath: manifest },
        { name: 'database.dump', sourcePath: dump },
      ]);
      const info = await assertZipArchive(zipPath);
      expect(info.size).toBeGreaterThan(0);
      const zip = await JSZip.loadAsync(await readFile(zipPath));
      expect(Object.keys(zip.files).sort()).toEqual([
        'backup-manifest.json',
        'database.dump',
      ]);
      await expect(zip.file('database.dump')?.async('string')).resolves.toBe(
        'PGDMP college backup\n',
      );
      const parsed = JSON.parse(
        (await zip.file('backup-manifest.json')?.async('string')) ?? '{}',
      );
      expect(parsed.collegeName).toBe('Don Bosco College');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('reports scanned and copied bytes against the real file size', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'backup-zip-'));
    try {
      const dump = join(dir, 'database.dump');
      await writeFile(dump, 'PGDMP college backup\n');
      const sourceSize = (await readFile(dump)).length;
      const seen: Array<{
        phase: string;
        bytesProcessed: number;
        bytesTotal: number;
      }> = [];
      await writeStoreZip(
        join(dir, 'college-backup.zip'),
        [{ name: 'database.dump', sourcePath: dump }],
        { onProgress: (event) => seen.push(event) },
      );
      const reading = seen.filter((event) => event.phase === 'reading');
      const writing = seen.filter((event) => event.phase === 'writing');
      expect(reading.at(-1)).toMatchObject({
        bytesProcessed: sourceSize,
        bytesTotal: sourceSize,
      });
      expect(writing.at(-1)).toMatchObject({
        bytesProcessed: sourceSize,
        bytesTotal: sourceSize,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('stops before writing the archive when cancelled', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'backup-zip-'));
    try {
      const dump = join(dir, 'database.dump');
      await writeFile(dump, 'PGDMP college backup\n');
      await expect(
        writeStoreZip(
          join(dir, 'college-backup.zip'),
          [{ name: 'database.dump', sourcePath: dump }],
          { isCancelled: () => true },
        ),
      ).rejects.toBeInstanceOf(BackupPackCancelledError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
