import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LibraryAssetsService } from './library-assets.service';

describe('LibraryAssetsService download paths', () => {
  const previous = process.env.UPLOAD_ROOT;
  const uploadRoot = mkdtempSync(join(tmpdir(), 'library-uploads-'));
  const tenantId = '11111111-1111-1111-1111-111111111111';

  beforeAll(() => {
    process.env.UPLOAD_ROOT = uploadRoot;
  });

  afterAll(() => {
    if (previous === undefined) delete process.env.UPLOAD_ROOT;
    else process.env.UPLOAD_ROOT = previous;
  });

  it('opens a question-paper file stored under UPLOAD_ROOT, not the app folder', () => {
    const relative = join(
      'tenants',
      tenantId,
      'question-bank',
      '2026',
      'garo',
      'paper.pdf',
    );
    const absolute = join(uploadRoot, relative);
    mkdirSync(join(absolute, '..'), { recursive: true });
    writeFileSync(absolute, 'pdf');
    const service = new LibraryAssetsService();
    const opened = service.openStreamByPath(
      tenantId,
      `/uploads/${relative.replace(/\\/g, '/')}`,
    );
    opened.stream.close();
    expect(opened.fileName).toBe('paper.pdf');
  });

  it('rejects a path that leaves the tenant upload folder', () => {
    const service = new LibraryAssetsService();
    expect(() =>
      service.openStreamByPath(
        tenantId,
        `/uploads/tenants/${tenantId}/../../secret.pdf`,
      ),
    ).toThrow('Path traversal blocked');
  });
});
