import {
  DEFAULT_REPORT_DESIGN,
  type ReportBranding,
  type ReportDocument,
} from './report-types';
import { renderReportHtml } from './report-html';

describe('report HTML template', () => {
  const branding: ReportBranding = {
    ...DEFAULT_REPORT_DESIGN,
    logoDataUri: null,
  };
  const doc: ReportDocument = {
    key: 'fee_monthly',
    title: 'Monthly Fee Collection Report',
    academicYear: '2026-27',
    columns: [{ key: 'name', label: 'Student' }],
    rows: [],
    generatedBy: 'Admin',
  };

  it('keeps school branding on an empty report', () => {
    const html = renderReportHtml(doc, branding);
    expect(html).toContain('St. Luke');
    expect(html).toContain('NO RECORDS FOUND');
    expect(html).toContain('Monthly Fee Collection Report');
  });
});
