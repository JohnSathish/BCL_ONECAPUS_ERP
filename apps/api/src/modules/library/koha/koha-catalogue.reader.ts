import { createReadStream } from 'fs';
import { extname } from 'path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
  cellToString,
  headerKey,
  indexHeaders,
  mapBookRecord,
  mapCopyRecord,
  requiredColumnsPresent,
  validationStatus,
  type Issue,
  type MappedBook,
  type MappedCopy,
} from './koha-catalogue.mapper';

const MAX_ZIP_ENTRIES = 20;
const MAX_UNCOMPRESSED = 200 * 1024 * 1024;

export type StagedBookDraft = MappedBook & { validationStatus: string };
export type StagedCopyDraft = MappedCopy & { validationStatus: string };

export type CatalogueRead = {
  books: StagedBookDraft[];
  copies: StagedCopyDraft[];
  itemTypes: { code: string; description: string }[];
  branches: { code: string; name: string }[];
  bookHeaders: string[];
  copyHeaders: string[];
  notes: string[];
};

export class KohaCatalogueReadError extends Error {}

export function assertSafeZipEntry(name: string) {
  const normalized = name.replace(/\\/g, '/');
  const unsafe =
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split('/').some((part) => part === '..');
  if (unsafe)
    throw new KohaCatalogueReadError('The ZIP contains an unsafe file path.');
}

function sheetKind(name: string) {
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (key.includes('booksmaster') || key === 'books' || key === 'biblio')
    return 'books';
  if (key.includes('bookcopies') || key === 'copies' || key === 'items')
    return 'copies';
  if (key.includes('catalogue') && key.includes('copies')) return 'combined';
  if (key.includes('itemtype')) return 'itemTypes';
  if (key.includes('branch')) return 'branches';
  return 'ignore';
}

function valuesOf(row: ExcelJS.Row) {
  const values = row.values as unknown[];
  return Array.isArray(values) ? values.slice(1) : [];
}

export async function readKohaCatalogueFile(
  filePath: string,
  originalName: string,
): Promise<CatalogueRead> {
  const extension = extname(originalName || filePath).toLowerCase();
  if (extension === '.sql') {
    throw new KohaCatalogueReadError(
      'SQL dumps are not executed. Upload the Koha catalogue workbook (.xlsx) or CSV files.',
    );
  }
  if (extension === '.zip') return readZip(filePath);
  if (extension === '.csv') {
    const text = await readText(filePath);
    const kind = sheetKind(originalName);
    if (kind === 'copies') return finalize(emptyRead(), [], parseCsv(text));
    return finalize(emptyRead(), parseCsv(text), []);
  }
  if (extension !== '.xlsx') {
    throw new KohaCatalogueReadError(
      'Upload an .xlsx workbook, a .csv file, or a .zip of those files.',
    );
  }
  return readXlsx(filePath);
}

async function readXlsx(filePath: string): Promise<CatalogueRead> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const buckets: Record<string, unknown[][]> = {
    books: [],
    copies: [],
    combined: [],
    itemTypes: [],
    branches: [],
  };
  for (const sheet of workbook.worksheets) {
    const kind = sheetKind(sheet.name);
    if (kind === 'ignore') continue;
    sheet.eachRow((row) => {
      buckets[kind].push(valuesOf(row));
    });
  }
  return rowsToCatalogue(buckets);
}

async function readZip(filePath: string): Promise<CatalogueRead> {
  const zip = await JSZip.loadAsync(await readBuffer(filePath));
  const files = Object.values(zip.files).filter((entry) => !entry.dir);
  if (files.length > MAX_ZIP_ENTRIES) {
    throw new KohaCatalogueReadError('The ZIP contains too many files.');
  }
  let uncompressed = 0;
  const collected: { name: string; data: Buffer }[] = [];
  for (const entry of files) {
    assertSafeZipEntry(entry.name);
    const data = await entry.async('nodebuffer');
    uncompressed += data.length;
    if (uncompressed > MAX_UNCOMPRESSED) {
      throw new KohaCatalogueReadError(
        'The ZIP expands beyond the 200 MB safety limit.',
      );
    }
    collected.push({
      name: entry.name.split(/[/\\]/).pop() || entry.name,
      data,
    });
  }
  const xlsx = collected.find((file) =>
    file.name.toLowerCase().endsWith('.xlsx'),
  );
  if (xlsx) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx.data as unknown as ExcelJS.Buffer);
    const tmp = workbook;
    const buckets: Record<string, unknown[][]> = {
      books: [],
      copies: [],
      combined: [],
      itemTypes: [],
      branches: [],
    };
    for (const sheet of tmp.worksheets) {
      const kind = sheetKind(sheet.name);
      if (kind === 'ignore') continue;
      sheet.eachRow((row) => buckets[kind].push(valuesOf(row)));
    }
    return rowsToCatalogue(buckets);
  }
  const books = collected.find((file) => sheetKind(file.name) === 'books');
  const copies = collected.find((file) => sheetKind(file.name) === 'copies');
  if (!books || !copies) {
    throw new KohaCatalogueReadError(
      'The ZIP must contain an .xlsx catalogue or CSV files named for books and copies.',
    );
  }
  return finalize(
    emptyRead(),
    parseCsv(books.data.toString('utf8')),
    parseCsv(copies.data.toString('utf8')),
  );
}

function rowsToCatalogue(buckets: Record<string, unknown[][]>) {
  const itemTypes = lookupRows(buckets.itemTypes, 'itemtype', 'description');
  const branches = lookupRows(buckets.branches, 'branchcode', 'branchname');
  if (buckets.books.length && buckets.copies.length) {
    return finalize(
      { ...emptyRead(), itemTypes, branches },
      buckets.books,
      buckets.copies,
    );
  }
  if (buckets.combined.length > 1) {
    return finalize(
      { ...emptyRead(), itemTypes, branches },
      buckets.combined,
      buckets.combined,
    );
  }
  throw new KohaCatalogueReadError(
    'The workbook needs a Books Master sheet and a Book Copies sheet, or a Catalogue + Copies sheet.',
  );
}

function lookupRows(rows: unknown[][], codeHeader: string, nameHeader: string) {
  if (rows.length < 2) return [];
  const headers = indexHeaders(rows[0]);
  const codeAt = headers.get(headerKey(codeHeader));
  const nameAt = headers.get(headerKey(nameHeader));
  const out: { code: string; name: string }[] = [];
  for (const row of rows.slice(1)) {
    const code = codeAt == null ? '' : cellToString(row[codeAt]);
    const name = nameAt == null ? '' : cellToString(row[nameAt]);
    if (code) out.push({ code, name: name || code });
  }
  return out;
}

function finalize(
  base: CatalogueRead,
  bookRows: unknown[][],
  copyRows: unknown[][],
): CatalogueRead {
  if (bookRows.length < 2 || copyRows.length < 2) {
    throw new KohaCatalogueReadError('The catalogue file has no data rows.');
  }
  const bookHeaders = indexHeaders(bookRows[0]);
  const copyHeaders = indexHeaders(copyRows[0]);
  const missingBooks = requiredColumnsPresent(bookHeaders, 'books');
  const missingCopies = requiredColumnsPresent(copyHeaders, 'copies');
  if (missingBooks.length || missingCopies.length) {
    throw new KohaCatalogueReadError(
      `Required columns are missing: ${[...missingBooks, ...missingCopies].join(', ')}.`,
    );
  }
  const seenBiblio = new Map<string, number>();
  const books: StagedBookDraft[] = [];
  let missingBookRows = 0;
  for (const row of bookRows.slice(1)) {
    const mapped = mapBookRecord(row, bookHeaders);
    if (!mapped) continue;
    const issues = [...mapped.issues];
    let sourceBibliographicId = mapped.sourceBibliographicId;
    if (!sourceBibliographicId) {
      missingBookRows += 1;
      sourceBibliographicId = `missing-${missingBookRows}`;
    } else {
      const seen = (seenBiblio.get(sourceBibliographicId) ?? 0) + 1;
      seenBiblio.set(sourceBibliographicId, seen);
      if (seen > 1) {
        issues.push({
          code: 'DUPLICATE_BIBLIO_ID',
          severity: 'error',
          message: `Bibliographic id ${mapped.sourceBibliographicId} appears more than once.`,
        });
        sourceBibliographicId = `${mapped.sourceBibliographicId}#duplicate-${seen}`;
      }
    }
    books.push({
      ...mapped,
      sourceBibliographicId,
      issues,
      validationStatus: validationStatus(issues),
    });
  }
  const biblioIds = new Set(
    books
      .filter((book) => book.validationStatus !== 'DUPLICATE')
      .map((book) => book.sourceBibliographicId),
  );
  const seenItems = new Map<string, number>();
  const seenBarcodes = new Set<string>();
  const copies: StagedCopyDraft[] = [];
  let stockFilled = 0;
  let locationFilled = 0;
  let missingItems = 0;
  for (const row of copyRows.slice(1)) {
    const mapped = mapCopyRecord(row, copyHeaders);
    if (!mapped) continue;
    const issues: Issue[] = mapped.issues.filter(
      (issue) =>
        issue.code !== 'ACCESSION_FROM_BARCODE' &&
        issue.code !== 'MISSING_LOCATION',
    );
    let sourceItemId = mapped.sourceItemId;
    if (!sourceItemId) {
      missingItems += 1;
      sourceItemId = `missing-item-${missingItems}`;
    } else {
      const seen = (seenItems.get(sourceItemId) ?? 0) + 1;
      seenItems.set(sourceItemId, seen);
      if (seen > 1) {
        issues.push({
          code: 'DUPLICATE_ITEM_ID',
          severity: 'error',
          message: `Item number ${mapped.sourceItemId} appears more than once.`,
        });
        sourceItemId = `${mapped.sourceItemId}#duplicate-${seen}`;
      }
    }
    if (mapped.accessionNumber && mapped.accessionNumber !== mapped.barcode)
      stockFilled += 1;
    if (mapped.shelvingLocation) locationFilled += 1;
    else {
      issues.push({
        code: 'MISSING_LOCATION',
        severity: 'warning',
        message: 'Shelving location is empty and was not invented.',
      });
    }
    if (!mapped.accessionNumber || mapped.accessionNumber === mapped.barcode) {
      issues.push({
        code: 'ACCESSION_FROM_BARCODE',
        severity: 'warning',
        message:
          'Koha stocknumber is empty. The barcode is preserved as the accession number.',
      });
    }
    if (mapped.barcode && seenBarcodes.has(mapped.barcode)) {
      issues.push({
        code: 'DUPLICATE_BARCODE',
        severity: 'error',
        message: `Barcode ${mapped.barcode} appears more than once in this file.`,
      });
    }
    if (
      mapped.sourceBibliographicId &&
      !biblioIds.has(mapped.sourceBibliographicId)
    ) {
      issues.push({
        code: 'MISSING_BOOK',
        severity: 'error',
        message: `No bibliographic record exists for id ${mapped.sourceBibliographicId}.`,
      });
    }
    if (mapped.barcode) seenBarcodes.add(mapped.barcode);
    copies.push({
      ...mapped,
      sourceItemId,
      issues,
      validationStatus: validationStatus(issues),
    });
  }
  const booksWithCopies = new Set(
    copies.map((copy) => copy.sourceBibliographicId),
  );
  const notes = [
    stockFilled === 0
      ? 'stocknumber is empty on every copy. Each barcode is preserved as the accession number and is not replaced with a generated number.'
      : `${stockFilled} copies have a stocknumber distinct from the barcode.`,
    locationFilled === 0
      ? 'location is empty. Shelving location was not invented from the classification number.'
      : `${locationFilled} copies include a shelving location.`,
    `${books.filter((book) => !booksWithCopies.has(book.sourceBibliographicId)).length} bibliographic records have no physical copies.`,
    'Collection codes are kept even when they are not confirmed as academic departments.',
    'This workbook has no MARC author, subject, or language fields beyond the author column.',
  ];
  return {
    books,
    copies,
    itemTypes: base.itemTypes,
    branches: base.branches,
    bookHeaders: bookRows[0].map((cell) => cellToString(cell)).filter(Boolean),
    copyHeaders: copyRows[0].map((cell) => cellToString(cell)).filter(Boolean),
    notes,
  };
}

function emptyRead(): CatalogueRead {
  return {
    books: [],
    copies: [],
    itemTypes: [],
    branches: [],
    bookHeaders: [],
    copyHeaders: [],
    notes: [],
  };
}

function parseCsv(text: string): unknown[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((line) => line.some((value) => value !== ''));
}

function readBuffer(filePath: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function readText(filePath: string) {
  return readBuffer(filePath).then((buffer) => buffer.toString('utf8'));
}
