export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const BARCODE_PREVIEW_LIMIT = 100;
export const BARCODE_SELECT_LIMIT = 500;

export type LabelPreset = 'A4_2X4' | 'SINGLE' | 'CUSTOM' | 'ROLL';

export type LabelSettings = {
  preset: LabelPreset;
  pageWidthMm: number;
  pageHeightMm: number;
  columns: number;
  rows: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  gapXMm: number;
  gapYMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  barcodeHeightMm: number;
  moduleWidth: number;
  fontSizePt: number;
  showLogo: boolean;
  showTitle: boolean;
  showAuthor: boolean;
  showDepartment: boolean;
  showCallNumber: boolean;
  showAccession: boolean;
  headerTitle: string;
  headerSubtitle: string;
  headerCode: string;
};

export type BarcodeCopyInput = {
  id: string;
  accessionNumber: string | null;
  barcode: string;
  title: string;
  author: string | null;
  callNumber: string | null;
  department: string | null;
};

export type BarcodeLabel = {
  copyId: string;
  accessionNumber: string;
  encodedValue: string;
  title: string;
  author: string;
  callNumber: string;
  department: string;
};

export type RejectedCopy = {
  copyId: string;
  accessionNumber: string;
  reason: string;
};

const PRESETS = new Set<LabelPreset>(['A4_2X4', 'SINGLE', 'CUSTOM', 'ROLL']);

export function defaultLabelSettings(institution?: {
  name?: string | null;
  code?: string | null;
}): LabelSettings {
  const name = institution?.name?.trim() || 'College Library';
  const code =
    institution?.code?.trim() || (/don bosco/i.test(name) ? 'DBCL' : '');
  const fitted = fitLabels({
    pageWidthMm: A4_WIDTH_MM,
    pageHeightMm: A4_HEIGHT_MM,
    columns: 2,
    rows: 4,
    marginTopMm: 10,
    marginRightMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 10,
    gapXMm: 4,
    gapYMm: 4,
  });
  return {
    preset: 'A4_2X4',
    pageWidthMm: A4_WIDTH_MM,
    pageHeightMm: A4_HEIGHT_MM,
    columns: 2,
    rows: 4,
    marginTopMm: 10,
    marginRightMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 10,
    gapXMm: 4,
    gapYMm: 4,
    labelWidthMm: fitted.widthMm,
    labelHeightMm: fitted.heightMm,
    barcodeHeightMm: 14,
    moduleWidth: 1.4,
    fontSizePt: 8,
    showLogo: true,
    showTitle: true,
    showAuthor: true,
    showDepartment: true,
    showCallNumber: true,
    showAccession: true,
    headerTitle: name.toUpperCase(),
    headerSubtitle: 'LIBRARY',
    headerCode: code,
  };
}

export function fitLabels(input: {
  pageWidthMm: number;
  pageHeightMm: number;
  columns: number;
  rows: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  gapXMm: number;
  gapYMm: number;
}) {
  const columns = Math.max(input.columns, 1);
  const rows = Math.max(input.rows, 1);
  const innerWidth =
    input.pageWidthMm -
    input.marginLeftMm -
    input.marginRightMm -
    input.gapXMm * (columns - 1);
  const innerHeight =
    input.pageHeightMm -
    input.marginTopMm -
    input.marginBottomMm -
    input.gapYMm * (rows - 1);
  return {
    widthMm: roundMm(innerWidth / columns),
    heightMm: roundMm(innerHeight / rows),
  };
}

export function labelSheetFits(settings: LabelSettings) {
  const width =
    settings.columns * settings.labelWidthMm +
    Math.max(settings.columns - 1, 0) * settings.gapXMm +
    settings.marginLeftMm +
    settings.marginRightMm;
  const height =
    settings.rows * settings.labelHeightMm +
    Math.max(settings.rows - 1, 0) * settings.gapYMm +
    settings.marginTopMm +
    settings.marginBottomMm;
  return (
    width <= settings.pageWidthMm + 0.05 &&
    height <= settings.pageHeightMm + 0.05
  );
}

export function mergeLabelSettings(
  raw: unknown,
  institution?: { name?: string | null; code?: string | null },
): LabelSettings {
  const base = defaultLabelSettings(institution);
  if (!raw || typeof raw !== 'object') return base;
  const source = raw as Partial<LabelSettings>;
  const preset = PRESETS.has(source.preset as LabelPreset)
    ? (source.preset as LabelPreset)
    : base.preset;
  const next: LabelSettings = {
    ...base,
    ...pickNumbers(source),
    preset,
    showLogo: bool(source.showLogo, base.showLogo),
    showTitle: bool(source.showTitle, base.showTitle),
    showAuthor: bool(source.showAuthor, base.showAuthor),
    showDepartment: bool(source.showDepartment, base.showDepartment),
    showCallNumber: bool(source.showCallNumber, base.showCallNumber),
    showAccession: bool(source.showAccession, base.showAccession),
    headerTitle: text(source.headerTitle, base.headerTitle),
    headerSubtitle: text(source.headerSubtitle, base.headerSubtitle),
    headerCode: text(source.headerCode, base.headerCode),
  };
  next.columns = clamp(next.columns, 1, 6);
  next.rows = clamp(next.rows, 1, 20);
  if (next.preset === 'A4_2X4') {
    next.pageWidthMm = A4_WIDTH_MM;
    next.pageHeightMm = A4_HEIGHT_MM;
    const fitted = fitLabels(next);
    next.labelWidthMm = fitted.widthMm;
    next.labelHeightMm = fitted.heightMm;
  }
  if (next.preset === 'SINGLE') {
    next.columns = 1;
    next.rows = 1;
    next.pageWidthMm = roundMm(
      next.labelWidthMm + next.marginLeftMm + next.marginRightMm,
    );
    next.pageHeightMm = roundMm(
      next.labelHeightMm + next.marginTopMm + next.marginBottomMm,
    );
  }
  if (next.preset === 'ROLL') {
    next.columns = 1;
    next.rows = 1;
    next.pageWidthMm = roundMm(
      next.labelWidthMm + next.marginLeftMm + next.marginRightMm,
    );
    next.pageHeightMm = roundMm(
      next.labelHeightMm + next.marginTopMm + next.marginBottomMm,
    );
  }
  return next;
}

export function prepareBarcodeLabels(copies: BarcodeCopyInput[]) {
  const unique: BarcodeCopyInput[] = [];
  const seen = new Set<string>();
  for (const copy of copies) {
    if (seen.has(copy.id)) continue;
    seen.add(copy.id);
    unique.push(copy);
  }
  const accessionCounts = new Map<string, number>();
  for (const copy of unique) {
    const accession = copy.accessionNumber?.trim() ?? '';
    if (!accession) continue;
    accessionCounts.set(accession, (accessionCounts.get(accession) ?? 0) + 1);
  }
  const labels: BarcodeLabel[] = [];
  const rejected: RejectedCopy[] = [];
  for (const copy of unique) {
    const accession = copy.accessionNumber?.trim() ?? '';
    const barcode = copy.barcode?.trim() ?? '';
    const reason = rejectionReason(accession, barcode, accessionCounts);
    if (reason) {
      rejected.push({ copyId: copy.id, accessionNumber: accession, reason });
      continue;
    }
    labels.push({
      copyId: copy.id,
      accessionNumber: accession,
      encodedValue: accession,
      title: copy.title,
      author: copy.author?.trim() ?? '',
      callNumber: copy.callNumber?.trim() ?? '',
      department: copy.department?.trim() ?? '',
    });
  }
  return { labels, rejected };
}

function rejectionReason(
  accession: string,
  barcode: string,
  accessionCounts: Map<string, number>,
) {
  if (!accession) return 'Missing accession number';
  if (!barcode) return 'Missing barcode';
  if (accession !== barcode)
    return 'Accession number does not match the stored barcode';
  if ((accessionCounts.get(accession) ?? 0) > 1)
    return 'Duplicate accession number';
  return null;
}

function pickNumbers(source: Partial<LabelSettings>): Partial<LabelSettings> {
  const keys = [
    'pageWidthMm',
    'pageHeightMm',
    'columns',
    'rows',
    'marginTopMm',
    'marginRightMm',
    'marginBottomMm',
    'marginLeftMm',
    'gapXMm',
    'gapYMm',
    'labelWidthMm',
    'labelHeightMm',
    'barcodeHeightMm',
    'moduleWidth',
    'fontSizePt',
  ] as const;
  const allowZero = new Set<string>([
    'marginTopMm',
    'marginRightMm',
    'marginBottomMm',
    'marginLeftMm',
    'gapXMm',
    'gapYMm',
  ]);
  const next: Partial<LabelSettings> = {};
  for (const key of keys) {
    const value = source[key];
    const minimum = allowZero.has(key) ? 0 : 0.01;
    if (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= minimum
    ) {
      next[key] = value;
    }
  }
  return next;
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function text(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function roundMm(value: number) {
  return Math.round(value * 100) / 100;
}
