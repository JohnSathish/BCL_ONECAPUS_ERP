export type ReportGroup =
  | 'Collection'
  | 'Circulation'
  | 'Inventory'
  | 'Administrative';

export type CatalogueReportDefinition = {
  key: string;
  title: string;
  group: ReportGroup;
  kind: 'copies' | 'summary' | 'loans' | 'batches' | 'notice';
  sensitive: boolean;
  formal: boolean;
  unavailableReason?: string;
};

export const CATALOGUE_REPORTS: CatalogueReportDefinition[] = [
  {
    key: 'catalogue',
    title: 'Complete Library Catalogue',
    group: 'Collection',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'department-summary',
    title: 'Department-Wise Book Collection',
    group: 'Collection',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'department-detail',
    title: 'Department-Wise Detailed Book List',
    group: 'Collection',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'subject',
    title: 'Subject-Wise Book Collection',
    group: 'Collection',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'category',
    title: 'Category-Wise Collection',
    group: 'Collection',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'publisher',
    title: 'Publisher-Wise Collection',
    group: 'Collection',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'author',
    title: 'Author-Wise Collection',
    group: 'Collection',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'language',
    title: 'Language-Wise Collection',
    group: 'Collection',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'acquisition-year',
    title: 'Year-Wise Acquisition Report',
    group: 'Collection',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'branch',
    title: 'Branch-Wise Collection',
    group: 'Collection',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'shelf',
    title: 'Shelf Location and Classification Report',
    group: 'Collection',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'unmapped',
    title: 'Books Without Department Mapping',
    group: 'Collection',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'missing-accession',
    title: 'Books Without Accession Numbers',
    group: 'Collection',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'missing-barcode',
    title: 'Books Without Barcodes',
    group: 'Collection',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'duplicates',
    title: 'Duplicate Barcode and Accession Report',
    group: 'Collection',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'issued',
    title: 'Currently Issued Books',
    group: 'Circulation',
    kind: 'loans',
    sensitive: false,
    formal: false,
  },
  {
    key: 'available',
    title: 'Available Books',
    group: 'Circulation',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'overdue',
    title: 'Overdue Books',
    group: 'Circulation',
    kind: 'loans',
    sensitive: false,
    formal: false,
  },
  {
    key: 'lost',
    title: 'Lost Books',
    group: 'Circulation',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'damaged',
    title: 'Damaged Books',
    group: 'Circulation',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'issue-history',
    title: 'Issue and Return History',
    group: 'Circulation',
    kind: 'loans',
    sensitive: false,
    formal: false,
  },
  {
    key: 'student-borrowing',
    title: 'Student-Wise Borrowing History',
    group: 'Circulation',
    kind: 'loans',
    sensitive: true,
    formal: false,
  },
  {
    key: 'faculty-borrowing',
    title: 'Faculty-Wise Borrowing History',
    group: 'Circulation',
    kind: 'loans',
    sensitive: true,
    formal: false,
  },
  {
    key: 'department-borrowing',
    title: 'Department-Wise Borrowing Statistics',
    group: 'Circulation',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'fines',
    title: 'Fine and Outstanding Dues Report',
    group: 'Circulation',
    kind: 'loans',
    sensitive: true,
    formal: false,
  },
  {
    key: 'frequent',
    title: 'Frequently Borrowed Books',
    group: 'Circulation',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'not-returned',
    title: 'Books Not Returned by the Due Date',
    group: 'Circulation',
    kind: 'loans',
    sensitive: false,
    formal: false,
  },
  {
    key: 'total-copies',
    title: 'Total Physical Copies',
    group: 'Inventory',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'total-titles',
    title: 'Total Distinct Titles',
    group: 'Inventory',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'acquisition-register',
    title: 'Acquisition Register',
    group: 'Inventory',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'donated-gifts',
    title: 'Donated and Gifted Books',
    group: 'Inventory',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'purchased-period',
    title: 'Books Purchased During a Selected Period',
    group: 'Inventory',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'department-acquisition',
    title: 'Department-Wise Acquisition',
    group: 'Inventory',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'acquisition-cost',
    title: 'Acquisition Cost by Department',
    group: 'Inventory',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'stock-verification',
    title: 'Book Stock Verification Report',
    group: 'Inventory',
    kind: 'notice',
    sensitive: false,
    formal: true,
    unavailableReason:
      'Stock verification has not been recorded, so unaccounted copies cannot be calculated.',
  },
  {
    key: 'unaccounted',
    title: 'Missing or Unaccounted-for Copies',
    group: 'Inventory',
    kind: 'notice',
    sensitive: false,
    formal: false,
    unavailableReason:
      'A stock-verification count is required before missing copies can be listed.',
  },
  {
    key: 'lost-damaged-inventory',
    title: 'Lost and Damaged Inventory',
    group: 'Inventory',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'accession-range',
    title: 'Books by Accession Number Range',
    group: 'Inventory',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'department-statistics',
    title: 'Department-Wise Library Statistics',
    group: 'Administrative',
    kind: 'summary',
    sensitive: false,
    formal: true,
  },
  {
    key: 'period-summary',
    title: 'Monthly and Annual Library Summary',
    group: 'Administrative',
    kind: 'summary',
    sensitive: false,
    formal: true,
  },
  {
    key: 'stock-statement',
    title: 'Complete Library Stock Statement',
    group: 'Administrative',
    kind: 'summary',
    sensitive: false,
    formal: true,
  },
  {
    key: 'principal-stock',
    title: 'Department-Wise Stock Statement for the Principal',
    group: 'Administrative',
    kind: 'summary',
    sensitive: false,
    formal: true,
  },
  {
    key: 'collection-growth',
    title: 'Collection Growth Report',
    group: 'Administrative',
    kind: 'summary',
    sensitive: false,
    formal: false,
  },
  {
    key: 'unverified',
    title: 'Unmapped and Unverified Catalogue Records',
    group: 'Administrative',
    kind: 'copies',
    sensitive: false,
    formal: false,
  },
  {
    key: 'import-history',
    title: 'Import History and Reconciliation Report',
    group: 'Administrative',
    kind: 'batches',
    sensitive: false,
    formal: false,
  },
  {
    key: 'principal-summary',
    title: "Principal's Library Summary",
    group: 'Administrative',
    kind: 'summary',
    sensitive: false,
    formal: true,
  },
];

export function reportDefinition(key: string) {
  return CATALOGUE_REPORTS.find((report) => report.key === key) ?? null;
}

export type DepartmentTally = {
  department: string;
  titles: number;
  copies: number;
  available: number;
  issued: number;
};

export function summarizeDepartmentCopies(
  rows: { department: string; bookId: string; status: string }[],
) {
  const map = new Map<
    string,
    { titles: Set<string>; copies: number; available: number; issued: number }
  >();
  for (const row of rows) {
    const bucket = map.get(row.department) ?? {
      titles: new Set<string>(),
      copies: 0,
      available: 0,
      issued: 0,
    };
    bucket.titles.add(row.bookId);
    bucket.copies += 1;
    if (row.status === 'AVAILABLE') bucket.available += 1;
    if (row.status === 'ISSUED' || row.status === 'OVERDUE') bucket.issued += 1;
    map.set(row.department, bucket);
  }
  const result: DepartmentTally[] = [...map.entries()].map(
    ([department, bucket]) => ({
      department,
      titles: bucket.titles.size,
      copies: bucket.copies,
      available: bucket.available,
      issued: bucket.issued,
    }),
  );
  result.sort((a, b) => b.copies - a.copies);
  return result;
}

export function grandTotals(rows: DepartmentTally[]) {
  return rows.reduce(
    (sum, row) => ({
      titles: sum.titles + row.titles,
      copies: sum.copies + row.copies,
      available: sum.available + row.available,
      issued: sum.issued + row.issued,
    }),
    { titles: 0, copies: 0, available: 0, issued: 0 },
  );
}

export function csvDocument(
  headers: string[],
  rows: string[][],
  preamble: string[],
) {
  const lines = [
    ...preamble.map((line) => csvCell(line)),
    headers.map(csvCell).join(','),
  ];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return lines.join('\r\n');
}

export type ReportColumn = { key: string; label: string; text?: boolean };

export type ReportPayload = {
  key: string;
  title: string;
  institutionName: string;
  generatedAt: string;
  filters: string;
  notes: string[];
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  total: number;
  page: number;
  limit: number;
  totals: Record<string, number>;
  unavailable?: string;
  formal: boolean;
};

export function csvCell(value: string) {
  const text = value ?? '';
  if (/[",\n\r]/.test(text) || /^\d+$/.test(text))
    return `"${text.replace(/"/g, '""')}"`;
  return text;
}
