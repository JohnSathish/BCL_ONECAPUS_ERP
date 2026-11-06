import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import JSZip from 'jszip';
import { assertZipArchive, writeStoreZip } from './backup-zip.util';

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
});
