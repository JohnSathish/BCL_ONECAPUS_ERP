import { api } from './api';

export type SchoolReportExportKind = 'pdf-portrait' | 'pdf-landscape' | 'xlsx' | 'print';

export function kindToSchoolReportExport(kind: SchoolReportExportKind) {
  return {
    format: (kind === 'xlsx' ? 'xlsx' : kind === 'print' ? 'html' : 'pdf') as
      | 'xlsx'
      | 'pdf'
      | 'html',
    orientation: (kind === 'pdf-landscape' ? 'landscape' : 'portrait') as 'portrait' | 'landscape',
  };
}

export async function fetchSchoolReportCatalog() {
  const { data } = await api.get('/v1/school-sis/reports/catalog');
  return data as {
    modules: Array<{ id: string; label: string }>;
    reports: Array<{ key: string; title: string; description: string; module: string }>;
  };
}

export async function fetchSchoolReportPreview(key: string, filters: Record<string, string>) {
  const { data } = await api.get('/v1/school-sis/reports/preview', { params: { key, ...filters } });
  return data as {
    report: { title: string; key: string };
    columns: Array<{ key: string; label: string }>;
    rows: Array<Record<string, unknown>>;
    kpis: Array<{ label: string; value: string | number }>;
    empty: boolean;
    total: number;
  };
}

export async function fetchSchoolReportDesign() {
  const { data } = await api.get('/v1/school-sis/reports/design');
  return data as { settings: Record<string, unknown>; branding: Record<string, unknown> };
}

export async function saveSchoolReportDesign(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/school-sis/reports/design', payload);
  return data;
}

export async function fetchSchoolReportAudit() {
  const { data } = await api.get('/v1/school-sis/reports/audit');
  return data as Array<Record<string, unknown>>;
}

function filenameFromDisposition(header: string | undefined, fallback: string) {
  const match = header?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

export async function downloadSchoolReport(payload: {
  key: string;
  format: 'pdf' | 'xlsx' | 'html' | 'csv';
  filters?: Record<string, string>;
  orientation?: 'portrait' | 'landscape';
}) {
  const res = await api.post('/v1/school-sis/reports/export', payload, { responseType: 'blob' });
  const blob = res.data as Blob;
  const name = filenameFromDisposition(
    res.headers['content-disposition'],
    `school-report.${payload.format}`,
  );
  if (payload.format === 'html') {
    const html = await blob.text();
    const { printHtmlDocument } = await import('@/lib/print-html-document');
    await printHtmlDocument(html, { title: payload.key });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadFeeRegisterReport(
  params: Record<string, string | undefined>,
  format: 'xlsx' | 'pdf' | 'html',
  orientation?: 'portrait' | 'landscape',
) {
  const res = await api.get('/v1/school-sis/fees/monthly/register-export', {
    params: { ...params, format, orientation },
    responseType: 'blob',
  });
  if (format === 'html') {
    const html = await (res.data as Blob).text();
    const { printHtmlDocument } = await import('@/lib/print-html-document');
    await printHtmlDocument(html, {
      title: 'Fee collection register',
      width: '297mm',
      height: '210mm',
    });
    return;
  }
  const name = filenameFromDisposition(
    res.headers['content-disposition'],
    `fee-register.${format === 'pdf' ? 'pdf' : 'xlsx'}`,
  );
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadPendingFeeReport(
  params: Record<string, string | undefined>,
  format: 'xlsx' | 'pdf' | 'html',
  orientation?: 'portrait' | 'landscape',
) {
  const res = await api.get('/v1/school-sis/fees/monthly/pending-export', {
    params: { ...params, format, orientation },
    responseType: 'blob',
  });
  if (format === 'html') {
    const html = await (res.data as Blob).text();
    const { printHtmlDocument } = await import('@/lib/print-html-document');
    await printHtmlDocument(html, { title: 'Pending fees', width: '297mm', height: '210mm' });
    return;
  }
  const name = filenameFromDisposition(
    res.headers['content-disposition'],
    `pending-fees.${format === 'pdf' ? 'pdf' : 'xlsx'}`,
  );
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadFeeStructureReport(
  id: string,
  format: 'xlsx' | 'pdf' | 'html',
  orientation?: 'portrait' | 'landscape',
) {
  const res = await api.get(`/v1/school-sis/fees/structures/${id}/export`, {
    params: { format, orientation },
    responseType: 'blob',
  });
  if (format === 'html') {
    const html = await (res.data as Blob).text();
    const { printHtmlDocument } = await import('@/lib/print-html-document');
    await printHtmlDocument(html, { title: 'Fee structure' });
    return;
  }
  const name = filenameFromDisposition(
    res.headers['content-disposition'],
    `fee-structure.${format === 'pdf' ? 'pdf' : 'xlsx'}`,
  );
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadUserWiseReport(
  params: Record<string, string | undefined>,
  format: 'xlsx' | 'pdf' | 'html',
  orientation?: 'portrait' | 'landscape',
) {
  const res = await api.get('/v1/school-sis/fees/monthly/reports/user-wise-collection/export', {
    params: { ...params, format, orientation },
    responseType: 'blob',
  });
  if (format === 'html') {
    const html = await (res.data as Blob).text();
    const { printHtmlDocument } = await import('@/lib/print-html-document');
    await printHtmlDocument(html, { title: 'User-wise collection' });
    return;
  }
  const name = filenameFromDisposition(
    res.headers['content-disposition'],
    `user-wise-collection.${format === 'pdf' ? 'pdf' : 'xlsx'}`,
  );
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
