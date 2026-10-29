import ExcelJS from 'exceljs';
import { normalizeLabel, type Issue } from './koha-catalogue.mapper';
import type {
  CatalogueRead,
  StagedBookDraft,
  StagedCopyDraft,
} from './koha-catalogue.reader';

const CAUTIOUS = new Set(['general', 'bba', 'environment']);

export type MappingRow = {
  code: string;
  description: string;
  suggestedDepartment: string;
  copies: number;
  status: 'NEEDS_REVIEW' | 'UNMAPPED' | 'NOT_APPLICABLE';
  remarks: string;
};

export function collectionMappingRows(copies: StagedCopyDraft[]): MappingRow[] {
  const counts = new Map<string, number>();
  for (const copy of copies) {
    const code = copy.collectionCode.trim();
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => {
      const normalized = normalizeLabel(code);
      if (!code) {
        return {
          code: '',
          description: 'No collection code on the Koha item',
          suggestedDepartment: '',
          copies: count,
          status: 'UNMAPPED' as const,
          remarks:
            'Department is unknown. The blank code is preserved and must be reviewed.',
        };
      }
      if (normalized === 'ref' || normalized === 'reference') {
        return {
          code,
          description: 'Reference collection',
          suggestedDepartment: '',
          copies: count,
          status: 'NOT_APPLICABLE' as const,
          remarks: 'This is a library collection, not an academic department.',
        };
      }
      return {
        code,
        description: 'Koha collection name',
        suggestedDepartment: code,
        copies: count,
        status: 'NEEDS_REVIEW' as const,
        remarks: CAUTIOUS.has(normalized)
          ? 'Confirm whether this collection is an academic department before import.'
          : 'Suggested from the collection name. Confirm it against an ERP department before import.',
      };
    })
    .sort((a, b) => b.copies - a.copies);
}

export function validationSummary(catalogue: CatalogueRead) {
  const books = catalogue.books;
  const copies = catalogue.copies;
  const issueCount = (rows: { issues: Issue[] }[], code: string) =>
    rows.filter((row) => row.issues.some((issue) => issue.code === code))
      .length;
  return [
    ['Total bibliographic records', books.length],
    ['Total physical copies', copies.length],
    [
      'Valid bibliographic records',
      books.filter((row) => row.validationStatus === 'VALID').length,
    ],
    [
      'Valid physical copies',
      copies.filter((row) => row.validationStatus === 'VALID').length,
    ],
    [
      'Duplicate candidates',
      books.filter((row) => row.validationStatus === 'DUPLICATE').length +
        copies.filter((row) => row.validationStatus === 'DUPLICATE').length,
    ],
    [
      'Missing accession numbers',
      copies.filter((row) => !row.accessionNumber).length,
    ],
    ['Missing barcodes', copies.filter((row) => !row.barcode).length],
    [
      'Missing department codes',
      copies.filter((row) => !row.collectionCode.trim()).length,
    ],
    [
      'Missing book titles',
      books.filter((row) =>
        row.issues.some((issue) => issue.code === 'MISSING_TITLE'),
      ).length,
    ],
    ['Missing authors', books.filter((row) => !row.author.trim()).length],
    ['Missing ISBNs', books.filter((row) => !row.isbnRaw.trim()).length],
    [
      'Missing shelf locations',
      copies.filter((row) => !row.shelvingLocation.trim()).length,
    ],
    ['Unparsed publication years', issueCount(books, 'YEAR_UNPARSED')],
    ['Unparsed prices', issueCount(copies, 'PRICE_UNPARSED')],
    ['Unparsed accession dates', issueCount(copies, 'DATE_UNPARSED')],
    [
      'Records requiring manual review',
      books.filter((row) => row.validationStatus !== 'VALID').length +
        copies.filter((row) => row.validationStatus !== 'VALID').length,
    ],
  ] as const;
}

export function reviewRows(catalogue: CatalogueRead) {
  const rows: string[][] = [];
  for (const book of catalogue.books) {
    const errors = book.issues.filter((issue) => issue.severity === 'error');
    if (!errors.length) continue;
    rows.push([
      'book',
      book.sourceBibliographicId,
      book.title,
      book.validationStatus,
      errors.map((issue) => issue.message).join(' | '),
    ]);
  }
  for (const copy of catalogue.copies) {
    const errors = copy.issues.filter((issue) => issue.severity === 'error');
    if (!errors.length) continue;
    rows.push([
      'copy',
      copy.sourceItemId,
      copy.barcode || copy.sourceBibliographicId,
      copy.validationStatus,
      errors.map((issue) => issue.message).join(' | '),
    ]);
  }
  return rows;
}

function bookMasterRow(book: StagedBookDraft, callNumber: string) {
  return [
    book.sourceBibliographicId,
    book.title,
    book.subtitle,
    book.author,
    '',
    book.isbnRaw,
    book.isbn13 || book.isbn10,
    book.edition,
    book.publisher,
    book.publicationYear,
    '',
    '',
    book.series,
    book.classificationNumber,
    callNumber,
    book.pages ? `${book.pages} pages` : '',
  ];
}

export async function buildPreparedWorkbook(catalogue: CatalogueRead) {
  const callByBook = new Map<string, string>();
  for (const copy of catalogue.copies) {
    if (copy.callNumber && !callByBook.has(copy.sourceBibliographicId)) {
      callByBook.set(copy.sourceBibliographicId, copy.callNumber);
    }
  }
  const titles = new Map(
    catalogue.books.map((book) => [book.sourceBibliographicId, book.title]),
  );
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BCL OneCampus';

  const books = workbook.addWorksheet('Books Master');
  books.addRow([
    'Koha bibliographic ID',
    'Book title',
    'Subtitle',
    'Primary author',
    'Additional authors',
    'ISBN',
    'Normalized ISBN',
    'Edition',
    'Publisher',
    'Publication year',
    'Language',
    'Subject',
    'Series',
    'Classification number',
    'Call number',
    'Description',
  ]);
  for (const book of catalogue.books) {
    books.addRow(
      bookMasterRow(book, callByBook.get(book.sourceBibliographicId) ?? ''),
    );
  }
  textColumns(books, [1, 6, 7]);

  const copies = workbook.addWorksheet('Individual Book Copies');
  copies.addRow([
    'Koha item ID',
    'Koha bibliographic ID',
    'Book title',
    'Accession number',
    'Barcode',
    'Department or collection code',
    'Branch',
    'Item type',
    'Shelf location',
    'Call number',
    'Acquisition date',
    'Acquisition price',
    'Source item status',
  ]);
  for (const copy of catalogue.copies) {
    copies.addRow([
      copy.sourceItemId,
      copy.sourceBibliographicId,
      titles.get(copy.sourceBibliographicId) ?? '',
      copy.accessionNumber,
      copy.barcode,
      copy.collectionCode,
      copy.homeBranchCode,
      copy.itemTypeCode,
      copy.shelvingLocation,
      copy.callNumber,
      copy.acquisitionDate,
      copy.acquisitionPrice,
      copy.copyStatus,
    ]);
  }
  textColumns(copies, [1, 2, 4, 5]);

  const mapping = workbook.addWorksheet('Department Mapping');
  mapping.addRow([
    'Original Koha collection code',
    'Collection description',
    'Suggested ERP department',
    'Number of associated physical copies',
    'Mapping status',
    'Verification remarks',
  ]);
  for (const row of collectionMappingRows(catalogue.copies)) {
    mapping.addRow([
      row.code,
      row.description,
      row.suggestedDepartment,
      row.copies,
      row.status,
      row.remarks,
    ]);
  }
  textColumns(mapping, [1]);

  const validation = workbook.addWorksheet('Import Validation');
  validation.addRow(['Check', 'Count']);
  for (const [label, count] of validationSummary(catalogue))
    validation.addRow([label, count]);
  validation.addRow([]);
  validation.addRow(['Notes']);
  for (const note of catalogue.notes) validation.addRow([note]);
  validation.addRow([
    'Incomplete rows and duplicate candidates are listed on Records For Review. They were not deleted.',
  ]);
  validation.addRow([
    'Language, subject and additional authors are blank because this Koha export has no MARC fields for them.',
  ]);

  const review = workbook.addWorksheet('Records For Review');
  review.addRow(['Level', 'Source ID', 'Title or barcode', 'Status', 'Issues']);
  for (const row of reviewRows(catalogue)) review.addRow(row);
  textColumns(review, [2, 3]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function textColumns(sheet: ExcelJS.Worksheet, indexes: number[]) {
  for (const index of indexes) {
    sheet.getColumn(index).numFmt = '@';
  }
}
