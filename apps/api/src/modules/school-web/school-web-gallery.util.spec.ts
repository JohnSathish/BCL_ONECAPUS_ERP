import {
  isPublicAlbum,
  slugifyGallery,
  galleryFileLooksSafe,
} from './school-web-gallery.util';

describe('school-web-gallery.util', () => {
  it('slugifies titles', () => {
    expect(slugifyGallery("St. Luke's Annual Day 2026")).toBe(
      'st-lukes-annual-day-2026',
    );
  });

  it('hides private and draft albums from the public site', () => {
    expect(isPublicAlbum({ status: 'PUBLISHED', visibility: 'PUBLIC' })).toBe(
      true,
    );
    expect(isPublicAlbum({ status: 'DRAFT', visibility: 'PUBLIC' })).toBe(
      false,
    );
    expect(isPublicAlbum({ status: 'PUBLISHED', visibility: 'PRIVATE' })).toBe(
      false,
    );
    expect(
      isPublicAlbum({
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        deletedAt: new Date(),
      }),
    ).toBe(false);
  });

  it('hides scheduled albums until the publish time', () => {
    const later = new Date(Date.now() + 60_000);
    expect(
      isPublicAlbum({
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        scheduledAt: later,
      }),
    ).toBe(false);
  });

  it('rejects non-image payloads', () => {
    expect(
      galleryFileLooksSafe({
        originalname: 'x.exe',
        mimetype: 'application/octet-stream',
        size: 12,
        buffer: Buffer.from('MZ'),
      }),
    ).toBe(false);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(
      galleryFileLooksSafe({
        originalname: 'a.jpg',
        mimetype: 'image/jpeg',
        size: jpeg.length,
        buffer: jpeg,
      }),
    ).toBe(true);
  });
});
