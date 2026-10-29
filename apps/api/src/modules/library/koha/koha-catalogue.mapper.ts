export const KOHA_SOURCE = 'KOHA';

export const VERIFIED_FIELD_MAP = [
  {
    source: 'biblio.biblionumber / biblionumber',
    destination: 'sourceBibliographicId',
  },
  { source: 'biblio.title / title', destination: 'title' },
  { source: 'subtitle', destination: 'subtitle' },
  { source: 'author', destination: 'primary author' },
  { source: 'biblioitems.isbn / isbn', destination: 'isbn10 or isbn13' },
  { source: 'issn', destination: 'issn' },
  {
    source: 'biblioitems.publishercode / publishercode',
    destination: 'publisher and place when the value is Place:Publisher',
  },
  { source: 'place', destination: 'publicationPlace' },
  {
    source: 'publicationyear or copyrightdate',
    destination: 'publicationYear',
  },
  { source: 'editionstatement', destination: 'edition' },
  { source: 'seriestitle', destination: 'series' },
  { source: 'pages', destination: 'description' },
  { source: 'cn_class', destination: 'classificationNumber' },
  { source: 'items.itemnumber / itemnumber', destination: 'sourceItemId' },
  {
    source: 'items.barcode / barcode',
    destination: 'barcode and accession number',
  },
  {
    source: 'items.stocknumber / stocknumber',
    destination: 'accession number when present',
  },
  {
    source: 'items.itemcallnumber / itemcallnumber',
    destination: 'callNumber',
  },
  {
    source: 'items.ccode / ccode',
    destination: 'collectionCode, then department only after review',
  },
  { source: 'items.homebranch / homebranch', destination: 'home branch code' },
  { source: 'items.location / location', destination: 'shelvingLocation' },
  {
    source: 'items.dateaccessioned / dateaccessioned',
    destination: 'acquisitionDate',
  },
  { source: 'items.price / price', destination: 'acquisitionPrice' },
  { source: 'itype or itemtype', destination: 'item type code' },
  {
    source: 'withdrawn, itemlost, damaged, notforloan',
    destination: 'copy status',
  },
] as const;

export type Issue = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
};

export type DepartmentOption = { id: string; name: string; code: string };

export type MappingStatus =
  | 'MAPPED'
  | 'NEEDS_REVIEW'
  | 'UNMAPPED'
  | 'NOT_APPLICABLE';

export type CollectionClassification = {
  code: string;
  description: string;
  status: MappingStatus;
  departmentId: string | null;
  method: 'SUGGESTED' | 'NONE';
};

const NOT_A_DEPARTMENT = new Set(['ref', 'reference']);

export function cellToString(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === 'object') {
    const record = value as {
      text?: unknown;
      result?: unknown;
      richText?: { text?: string }[];
    };
    if (typeof record.text === 'string') return record.text.trim();
    if (Array.isArray(record.richText)) {
      return record.richText
        .map((part) => part.text ?? '')
        .join('')
        .trim();
    }
    if ('result' in record) return cellToString(record.result);
  }
  return String(value).trim();
}

export function headerKey(value: unknown) {
  return cellToString(value)
    .toLowerCase()
    .replace(/[\s_]+/g, '');
}

export function indexHeaders(headers: unknown[]) {
  const index = new Map<string, number>();
  headers.forEach((header, position) => {
    const key = headerKey(header);
    if (key && !index.has(key)) index.set(key, position);
  });
  return index;
}

export function readCell(
  row: unknown[],
  index: Map<string, number>,
  ...names: string[]
) {
  for (const name of names) {
    const at = index.get(headerKey(name));
    if (at == null) continue;
    const value = cellToString(row[at]);
    if (value) return value;
  }
  return '';
}

export function parseIsbnList(raw: string) {
  const tokens = raw
    .split(/[|;,\s]+/)
    .map((token) => token.replace(/[^0-9Xx]/g, ''))
    .filter(Boolean);
  let isbn10 = '';
  let isbn13 = '';
  let invalid = false;
  for (const token of tokens) {
    if (token.length === 13 && !isbn13) isbn13 = token;
    else if (token.length === 10 && !isbn10) isbn10 = token.toUpperCase();
    else invalid = true;
  }
  return {
    isbn10,
    isbn13,
    invalid: invalid || (!isbn10 && !isbn13 && Boolean(raw.trim())),
  };
}

export function splitPlaceAndPublisher(
  publisherCode: string,
  placeColumn: string,
) {
  const place = placeColumn.trim();
  const raw = publisherCode.trim();
  if (!raw) return { publicationPlace: place, publisher: '' };
  const match = raw.match(/^([^:]{2,60}):\s*(.+)$/);
  if (match && !place) {
    return { publicationPlace: match[1].trim(), publisher: match[2].trim() };
  }
  return { publicationPlace: place, publisher: raw };
}

export function parseYear(publicationYear: string, copyrightDate: string) {
  const raw = publicationYear.trim() || copyrightDate.trim();
  if (!raw) return { year: '', warning: false };
  const match = raw.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  if (!match) return { year: raw, warning: true };
  return { year: match[1], warning: raw !== match[1] };
}

export function parsePrice(raw: string) {
  if (!raw.trim()) return { price: '', warning: false };
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned || Number.isNaN(Number(cleaned)))
    return { price: '', warning: true };
  return { price: cleaned, warning: false };
}

export function parseIsoDate(raw: string) {
  if (!raw.trim()) return { iso: '', warning: false };
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return { iso: '', warning: true };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return valid
    ? { iso: `${match[1]}-${match[2]}-${match[3]}`, warning: false }
    : { iso: '', warning: true };
}

function flagOn(value: string) {
  return value.trim() !== '' && value.trim() !== '0';
}

export function mapCopyStatus(input: {
  withdrawn: string;
  itemLost: string;
  damaged: string;
  notForLoan: string;
}) {
  const issues: Issue[] = [];
  if (flagOn(input.withdrawn)) {
    issues.push({
      code: 'WITHDRAWN',
      severity: 'warning',
      message: `Koha withdrawn flag is ${input.withdrawn}. Copy status will be WITHDRAWN.`,
    });
    return { status: 'WITHDRAWN', issues };
  }
  if (flagOn(input.itemLost)) {
    issues.push({
      code: 'LOST',
      severity: 'warning',
      message: `Koha itemlost flag is ${input.itemLost}. Copy status will be LOST.`,
    });
    return { status: 'LOST', issues };
  }
  if (flagOn(input.damaged)) {
    issues.push({
      code: 'DAMAGED',
      severity: 'warning',
      message: `Koha damaged flag is ${input.damaged}. Copy status will be DAMAGED.`,
    });
    return { status: 'DAMAGED', issues };
  }
  if (flagOn(input.notForLoan)) {
    issues.push({
      code: 'NOT_FOR_LOAN',
      severity: 'warning',
      message: `Koha notforloan flag is ${input.notForLoan}. Copy status will be NOT_FOR_LOAN.`,
    });
    return { status: 'NOT_FOR_LOAN', issues };
  }
  return { status: 'AVAILABLE', issues };
}

export function normalizeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function classifyCollectionCode(
  rawCode: string,
  departments: DepartmentOption[],
): CollectionClassification {
  const code = rawCode.trim();
  if (!code) {
    return {
      code: '',
      description: 'No collection code on the Koha item',
      status: 'UNMAPPED',
      departmentId: null,
      method: 'NONE',
    };
  }
  const normalized = normalizeLabel(code);
  if (NOT_A_DEPARTMENT.has(normalized)) {
    return {
      code,
      description: 'Reference collection. This is not an academic department.',
      status: 'NOT_APPLICABLE',
      departmentId: null,
      method: 'NONE',
    };
  }
  const match = departments.find(
    (department) =>
      normalizeLabel(department.name) === normalized ||
      normalizeLabel(department.code) === normalized,
  );
  if (match) {
    return {
      code,
      description: `Collection name matches ERP department ${match.name}. Confirm before import.`,
      status: 'NEEDS_REVIEW',
      departmentId: match.id,
      method: 'SUGGESTED',
    };
  }
  return {
    code,
    description:
      'No ERP department has this exact name or code. Confirm a mapping or leave it unmapped.',
    status: 'UNMAPPED',
    departmentId: null,
    method: 'NONE',
  };
}

export type MappedBook = {
  sourceBibliographicId: string;
  title: string;
  subtitle: string;
  author: string;
  isbnRaw: string;
  isbn10: string;
  isbn13: string;
  issn: string;
  publisher: string;
  publicationYear: string;
  publicationPlace: string;
  edition: string;
  series: string;
  pages: string;
  classificationNumber: string;
  itemTypeCode: string;
  sourceUrl: string;
  issues: Issue[];
};

export type MappedCopy = {
  sourceItemId: string;
  sourceBibliographicId: string;
  barcode: string;
  accessionNumber: string;
  callNumber: string;
  collectionCode: string;
  homeBranchCode: string;
  shelvingLocation: string;
  itemTypeCode: string;
  acquisitionDate: string;
  acquisitionPrice: string;
  withdrawn: string;
  itemLost: string;
  damaged: string;
  notForLoan: string;
  copyStatus: string;
  issues: Issue[];
};

export function mapBookRecord(
  row: unknown[],
  headers: Map<string, number>,
): MappedBook | null {
  const sourceBibliographicId = readCell(row, headers, 'biblionumber');
  const title = readCell(row, headers, 'title');
  if (!sourceBibliographicId && !title) return null;
  const isbnRaw = readCell(row, headers, 'isbn');
  const isbn = parseIsbnList(isbnRaw);
  const publisherBits = splitPlaceAndPublisher(
    readCell(row, headers, 'publishercode'),
    readCell(row, headers, 'place'),
  );
  const year = parseYear(
    readCell(row, headers, 'publicationyear'),
    readCell(row, headers, 'copyrightdate'),
  );
  const issues: Issue[] = [];
  if (!sourceBibliographicId) {
    issues.push({
      code: 'MISSING_BIBLIO_ID',
      severity: 'error',
      message: 'Bibliographic id is missing.',
    });
  }
  if (!title) {
    issues.push({
      code: 'MISSING_TITLE',
      severity: 'error',
      message: 'Title is missing.',
    });
  }
  if (isbnRaw && isbn.invalid) {
    issues.push({
      code: 'ISBN_UNPARSED',
      severity: 'warning',
      message: `ISBN "${isbnRaw}" was kept as entered. A standard ISBN-10 or ISBN-13 was not found.`,
    });
  }
  if (year.warning) {
    issues.push({
      code: 'YEAR_UNPARSED',
      severity: 'warning',
      message: `Publication year "${year.year}" is not a plain four-digit year.`,
    });
  }
  return {
    sourceBibliographicId,
    title: title || '(missing title)',
    subtitle: readCell(row, headers, 'subtitle'),
    author: readCell(row, headers, 'author'),
    isbnRaw,
    isbn10: isbn.isbn10,
    isbn13: isbn.isbn13,
    issn: readCell(row, headers, 'issn'),
    publisher: publisherBits.publisher,
    publicationYear: year.year,
    publicationPlace: publisherBits.publicationPlace,
    edition: readCell(row, headers, 'editionstatement', 'edition'),
    series: readCell(row, headers, 'seriestitle', 'series'),
    pages: readCell(row, headers, 'pages'),
    classificationNumber: readCell(row, headers, 'cn_class', 'classification'),
    itemTypeCode: readCell(row, headers, 'itemtype', 'itype'),
    sourceUrl: readCell(row, headers, 'url'),
    issues,
  };
}

export function mapCopyRecord(
  row: unknown[],
  headers: Map<string, number>,
): MappedCopy | null {
  const sourceItemId = readCell(row, headers, 'itemnumber');
  const sourceBibliographicId = readCell(row, headers, 'biblionumber');
  const barcode = readCell(row, headers, 'barcode');
  if (!sourceItemId && !sourceBibliographicId && !barcode) return null;
  const stock = readCell(row, headers, 'stocknumber');
  const accessionNumber = stock || barcode;
  const withdrawn = readCell(row, headers, 'withdrawn');
  const itemLost = readCell(row, headers, 'itemlost');
  const damaged = readCell(row, headers, 'damaged');
  const notForLoan = readCell(row, headers, 'notforloan');
  const status = mapCopyStatus({ withdrawn, itemLost, damaged, notForLoan });
  const price = parsePrice(readCell(row, headers, 'price'));
  const acquired = parseIsoDate(readCell(row, headers, 'dateaccessioned'));
  const issues = [...status.issues];
  if (!sourceItemId) {
    issues.push({
      code: 'MISSING_ITEM_ID',
      severity: 'error',
      message: 'Koha item number is missing.',
    });
  }
  if (!sourceBibliographicId) {
    issues.push({
      code: 'MISSING_BIBLIO_ID',
      severity: 'error',
      message: 'Copy is not linked to a bibliographic id.',
    });
  }
  if (!barcode) {
    issues.push({
      code: 'MISSING_BARCODE',
      severity: 'error',
      message:
        'Barcode is missing. The copy was not given a generated barcode.',
    });
  }
  if (!stock) {
    issues.push({
      code: 'ACCESSION_FROM_BARCODE',
      severity: 'warning',
      message:
        'Koha stocknumber is empty. The barcode is preserved as the accession number.',
    });
  }
  if (!readCell(row, headers, 'location', 'permanent_location')) {
    issues.push({
      code: 'MISSING_LOCATION',
      severity: 'warning',
      message: 'Shelving location is empty and was not invented.',
    });
  }
  if (price.warning) {
    issues.push({
      code: 'PRICE_UNPARSED',
      severity: 'warning',
      message: 'Price could not be read as a number.',
    });
  }
  if (acquired.warning) {
    issues.push({
      code: 'DATE_UNPARSED',
      severity: 'warning',
      message: 'Accession date is not a YYYY-MM-DD date.',
    });
  }
  return {
    sourceItemId,
    sourceBibliographicId,
    barcode,
    accessionNumber,
    callNumber: readCell(row, headers, 'itemcallnumber', 'callnumber'),
    collectionCode: readCell(row, headers, 'ccode'),
    homeBranchCode: readCell(row, headers, 'homebranch'),
    shelvingLocation: readCell(row, headers, 'location', 'permanent_location'),
    itemTypeCode: readCell(row, headers, 'itype', 'itemtype'),
    acquisitionDate: acquired.iso,
    acquisitionPrice: price.price,
    withdrawn,
    itemLost,
    damaged,
    notForLoan,
    copyStatus: status.status,
    issues,
  };
}

export function validationStatus(issues: Issue[]) {
  if (
    issues.some(
      (issue) =>
        issue.severity === 'error' && issue.code.startsWith('DUPLICATE'),
    )
  ) {
    return 'DUPLICATE';
  }
  if (issues.some((issue) => issue.severity === 'error')) return 'INVALID';
  return 'VALID';
}

export function requiredColumnsPresent(
  headers: Map<string, number>,
  kind: 'books' | 'copies',
) {
  const required =
    kind === 'books'
      ? ['biblionumber', 'title']
      : ['itemnumber', 'biblionumber', 'barcode'];
  return required.filter((name) => !headers.has(headerKey(name)));
}
