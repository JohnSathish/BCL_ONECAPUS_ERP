import {
  buildInstallationPdf,
  buildInstallationWorkbook,
} from './app-installation-report.documents';
import type { AppInstallationReport } from './app-installation-report.service';

const report: AppInstallationReport = {
  collegeName: 'Don Bosco College, Tura',
  headingName: 'DON BOSCO COLLEGE, TURA',
  academicYear: { id: 'year-1', name: '2026-2027', liveCensus: true },
  generatedAt: '2026-11-10T04:30:00.000Z',
  generatedLabel: '10 Nov 2026, 10:00 am',
  populationNote: 'Current session.',
  basis:
    'Installed means an active college app device with a valid push token.',
  filters: {
    academicYearId: 'year-1',
    departmentId: null,
    semester: null,
    shift: null,
    category: 'ALL',
    status: 'ALL',
    search: null,
    presentation: 'pending',
  },
  summary: {
    total: 2,
    installed: 1,
    notInstalled: 1,
    unverified: 0,
    percent: 50,
    highest: { id: 'eng', name: 'English', percent: 50, total: 2 },
    lowest: { id: 'eng', name: 'English', percent: 50, total: 2 },
  },
  departments: [
    {
      id: 'eng',
      serial: 1,
      name: 'English',
      total: 2,
      installed: 1,
      notInstalled: 1,
      unverified: 0,
      percent: 50,
      people: [
        {
          id: 'student:1',
          userId: 'user-1',
          category: 'STUDENT',
          categoryLabel: 'Student',
          name: 'Asha',
          identifier: 'ENG-01',
          roleLabel: 'Semester 1',
          email: 'asha@college.edu',
          mobile: '9000000000',
          departmentId: 'eng',
          departmentName: 'English',
          shiftLabel: 'Day',
          semester: 1,
          status: 'NOT_INSTALLED',
          lastLoginAt: null,
          lastActiveAt: null,
          serial: 1,
        },
      ],
      followUp: [],
    },
  ],
};

describe('installation report files', () => {
  it('builds an A4 notice PDF and an Excel workbook from the same figures', async () => {
    const pdf = await buildInstallationPdf(report, 'pending');
    const workbook = await buildInstallationWorkbook(report, 'pending');
    expect(pdf.contentType).toBe('application/pdf');
    expect(pdf.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.filename).toContain('pending');
    expect(workbook.buffer.subarray(0, 2).toString()).toBe('PK');
    expect(workbook.filename.endsWith('.xlsx')).toBe(true);
  });
});
