import { existsSync } from 'fs';
import { mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import ExcelJS from 'exceljs';
import {
  assertSafeZipEntry,
  readKohaCatalogueFile,
  KohaCatalogueReadError,
} from './koha-catalogue.reader';

const REAL_EXPORT =
  'C:\\Users\\johnm\\OneDrive\\Desktop\\KOHA BOOKS\\koha_catalogue_export (1).xlsx';

async function workbook(rows: { books: unknown[][]; copies: unknown[][] }) {
  const book = new ExcelJS.Workbook();
  const books = book.addWorksheet('Books Master');
  rows.books.forEach((row) => books.addRow(row));
  const copies = book.addWorksheet('Book Copies');
  rows.copies.forEach((row) => copies.addRow(row));
  const dir = await mkdtemp(join(tmpdir(), 'koha-'));
  const file = join(dir, 'catalogue.xlsx');
  await book.xlsx.writeFile(file);
  return file;
}

describe('Koha catalogue reader', () => {
  const bookHeaders = [
    'biblionumber',
    'title',
    'author',
    'isbn',
    'publishercode',
    'publicationyear',
  ];
  const copyHeaders = [
    'itemnumber',
    'biblionumber',
    'barcode',
    'stocknumber',
    'ccode',
    'homebranch',
    'itype',
    'location',
    'dateaccessioned',
    'price',
    'withdrawn',
    'itemlost',
    'damaged',
    'notforloan',
  ];

  it('keeps one title with many copies and reports a repeated barcode', async () => {
    const file = await workbook({
      books: [
        bookHeaders,
        ['1', 'Shared title', 'Author', '', 'Shillong:Publisher', '1999'],
        ['2', 'Single title', 'Author', '', '', ''],
      ],
      copies: [
        copyHeaders,
        [
          '10',
          '1',
          '0001',
          '',
          'Zoology',
          'DBCL',
          'BK',
          '',
          '2010-01-01',
          '10',
          '0',
          '0',
          '0',
          '0',
        ],
        [
          '11',
          '1',
          '0002',
          '',
          'Garo',
          'DBCL',
          'BK',
          '',
          '2010-01-02',
          '10',
          '0',
          '0',
          '0',
          '0',
        ],
        [
          '12',
          '1',
          '9322',
          '',
          'Chemistry',
          'DBCL',
          'REF',
          '',
          '',
          '',
          '0',
          '0',
          '0',
          '0',
        ],
        [
          '13',
          '2',
          '9322',
          '',
          'REF',
          '',
          'REF',
          '',
          '',
          '',
          '0',
          '0',
          '0',
          '0',
        ],
        ['14', '2', '', '', '', '', 'BK', '', '', '', '0', '0', '0', '0'],
      ],
    });
    const catalogue = await readKohaCatalogueFile(file, 'catalogue.xlsx');
    expect(catalogue.books).toHaveLength(2);
    expect(
      catalogue.copies.filter((copy) => copy.sourceBibliographicId === '1'),
    ).toHaveLength(3);
    const duplicate = catalogue.copies.filter(
      (copy) => copy.barcode === '9322',
    );
    expect(duplicate[0].validationStatus).toBe('VALID');
    expect(duplicate[1].validationStatus).toBe('DUPLICATE');
    expect(
      catalogue.copies.find((copy) => copy.sourceItemId === '14')
        ?.validationStatus,
    ).toBe('INVALID');
    expect(
      catalogue.notes.some((note) => note.includes('stocknumber is empty')),
    ).toBe(true);
  });

  it('refuses to execute an SQL dump', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'koha-sql-'));
    const file = join(dir, 'dump.sql');
    await writeFile(file, 'DROP TABLE library.library_books;');
    await expect(
      readKohaCatalogueFile(file, 'dump.sql'),
    ).rejects.toBeInstanceOf(KohaCatalogueReadError);
  });

  it('rejects a ZIP path that escapes the archive', () => {
    expect(() => assertSafeZipEntry('../secret.csv')).toThrow(
      /unsafe file path/,
    );
    expect(() => assertSafeZipEntry('C:/windows/secret.csv')).toThrow(
      /unsafe file path/,
    );
    expect(() => assertSafeZipEntry('catalogue/books.csv')).not.toThrow();
  });

  const real = existsSync(REAL_EXPORT) ? it : it.skip;
  real(
    'reads the Don Bosco Koha workbook counts',
    async () => {
      const catalogue = await readKohaCatalogueFile(
        REAL_EXPORT,
        'koha_catalogue_export (1).xlsx',
      );
      expect(catalogue.books).toHaveLength(13056);
      expect(catalogue.copies).toHaveLength(23113);
      expect(catalogue.copies.filter((copy) => !copy.barcode)).toHaveLength(19);
      const repeated = catalogue.copies.filter(
        (copy) => copy.barcode === '9322',
      );
      expect(repeated).toHaveLength(2);
      expect(
        repeated.filter((copy) => copy.validationStatus === 'DUPLICATE'),
      ).toHaveLength(1);
      expect(
        catalogue.copies.every(
          (copy) => copy.accessionNumber === (copy.barcode || ''),
        ),
      ).toBe(true);
    },
    120000,
  );
});
