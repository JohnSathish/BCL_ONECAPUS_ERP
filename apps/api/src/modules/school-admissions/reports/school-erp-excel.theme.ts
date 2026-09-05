import type ExcelJS from 'exceljs';

/** Tura Public School ERP Excel theme — school institution branding. */
export const SCHOOL_ERP_EXCEL_THEME = {
  primary: 'FF1B4D3E',
  primaryDeep: 'FF0F241C',
  accent: 'FFC5A572',
  headerFg: 'FFFFFFFF',
  pageBg: 'FFF3F6F4',
  zebra: 'FFEAF5EE',
  border: 'FFC5D4CC',
  muted: 'FF5B6B64',
  text: 'FF0F1F1A',
  softGold: 'FFF8F1E6',
  status: {
    green: 'FFDCFCE7',
    blue: 'FFDBEAFE',
    grey: 'FFF1F5F9',
    orange: 'FFFFEDD5',
    red: 'FFFEE2E2',
  },
} as const;

export type SchoolErpExcelColumnType =
  | 'text'
  | 'date'
  | 'datetime'
  | 'number'
  | 'currency'
  | 'boolean'
  | 'status'
  | 'phone'
  | 'code';

export type SchoolErpExcelColumn = {
  key: string;
  header: string;
  width?: number;
  type?: SchoolErpExcelColumnType;
  wrap?: boolean;
  align?: 'left' | 'center' | 'right';
};

export type SchoolErpExcelMeta = {
  schoolName: string;
  schoolLocation?: string;
  reportTitle: string;
  subtitle?: string;
  sessionLabel?: string;
  moduleLabel?: string;
  generatedAt?: Date;
  generatedBy?: string;
  filenameBase: string;
  printHeaderLeft?: string;
  printHeaderCenter?: string;
};

export type SchoolErpStatPair = { label: string; value: number | string };

export function schoolErpThinBorder(): Partial<ExcelJS.Borders> {
  const edge: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: SCHOOL_ERP_EXCEL_THEME.border },
  };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

export function schoolErpStatusFill(raw: string): string | null {
  const value = raw.trim().toLowerCase().replaceAll('_', ' ');
  if (
    [
      'submitted',
      'fee paid',
      'paid',
      'admission granted',
      'allotted',
      'granted',
      'verified',
      'complete',
      'yes',
    ].includes(value)
  ) {
    return SCHOOL_ERP_EXCEL_THEME.status.green;
  }
  if (['in progress', 'draft / in progress', 'new'].includes(value)) {
    return SCHOOL_ERP_EXCEL_THEME.status.blue;
  }
  if (['draft', 'not started', '—', '-'].includes(value)) {
    return SCHOOL_ERP_EXCEL_THEME.status.grey;
  }
  if (
    [
      'under review',
      'payment pending',
      'pending',
      'partial',
      'missing',
    ].includes(value)
  ) {
    return SCHOOL_ERP_EXCEL_THEME.status.orange;
  }
  if (
    ['not granted', 'rejected', 'failed', 'cancelled', 'closed'].includes(value)
  ) {
    return SCHOOL_ERP_EXCEL_THEME.status.red;
  }
  return null;
}

export function formatSchoolErpGeneratedAt(date: Date): string {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function schoolErpReportFilename(
  base: string,
  generatedAt = new Date(),
): string {
  const d = String(generatedAt.getDate()).padStart(2, '0');
  const m = String(generatedAt.getMonth() + 1).padStart(2, '0');
  const y = generatedAt.getFullYear();
  const safe = base
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '')
    .replace(/\s+/g, '_');
  return `${safe}_${d}-${m}-${y}.xlsx`;
}

export function colLetter(index1Based: number): string {
  let n = index1Based;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
