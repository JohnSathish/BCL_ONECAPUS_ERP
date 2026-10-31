import ExcelJS from 'exceljs';
import { DEFAULT_COPY_ISSUE } from '../domain/library-policy.types';
import {
  detailAvailability,
  detailCopyTypeLabel,
  rowsForDepartment,
  summarizeCopies,
  type DetailCopy,
} from './library-department-detail.logic';
import { buildDepartmentDetailWorkbook } from './library-department-detail-excel';

const rules = {
  copyIssue: { ...DEFAULT_COPY_ISSUE },
  referenceAllow: false,
  rareAllow: false,
};

function copy(patch: Partial<DetailCopy> = {}): DetailCopy {
  return {
    copyId: 'c1',
    bookId: 'b1',
    department: 'Garo',
    departments: ['Garo'],
    title: 'A·chik Golporang',
    author: 'Sangma, Dhoronsingh K',
    isbn: '0001234567890',
    edition: '3rd Reprint',
    publisher: 'Tura Book Room',
    year: '1984',
    subject: 'Garo Literature',
    accession: '28600',
    barcode: '28600',
    callNumber: 'G398.41 SAN',
    copyType: 'Normal',
    status: 'Available',
    ...patch,
  };
}

describe('department detail book list', () => {
  it('keeps a reference copy out of the available count', () => {
    expect(
      detailAvailability({
        status: 'AVAILABLE',
        onLoan: false,
        issueAllowed: null,
        copyType: 'REFERENCE',
        categoryCode: null,
        ...rules,
      }),
    ).toBe('Not for Issue');
    expect(detailCopyTypeLabel('REFERENCE', null)).toBe('Reference');
    expect(detailCopyTypeLabel('GENERAL', null)).toBe('Normal');
  });

  it('shows an open loan as issued', () => {
    expect(
      detailAvailability({
        status: 'AVAILABLE',
        onLoan: true,
        issueAllowed: true,
        copyType: 'GENERAL',
        categoryCode: null,
        ...rules,
      }),
    ).toBe('Issued');
  });

  it('counts each physical copy once and titles separately', () => {
    const shared = copy({
      copyId: 'c2',
      bookId: 'b1',
      accession: '28601',
      barcode: '28601',
      departments: ['Garo', 'English'],
      department: 'Garo',
      status: 'Issued',
    });
    const reference = copy({
      copyId: 'c3',
      bookId: 'b2',
      accession: '28602',
      barcode: '28602',
      copyType: 'Reference',
      status: 'Not for Issue',
      year: '1978',
    });
    const metrics = summarizeCopies([copy(), shared, reference]);
    expect(metrics.titles).toBe(2);
    expect(metrics.copies).toBe(3);
    expect(metrics.available).toBe(1);
    expect(metrics.issued).toBe(1);
    expect(metrics.reference).toBe(1);
    expect(metrics.yearRange).toBe('1978 – 1984');
    expect(
      rowsForDepartment([copy(), shared, reference], 'English'),
    ).toHaveLength(1);
    expect(rowsForDepartment([copy(), shared, reference], 'Garo')).toHaveLength(
      3,
    );
  });

  it('writes the accession and ISBN as text in the workbook', async () => {
    const buffer = await buildDepartmentDetailWorkbook({
      collegeName: 'Don Bosco College Tura',
      address: 'Tura, Meghalaya – 794002',
      generatedAt: '30 October 2026, 8:57 pm',
      generatedBy: 'Library System',
      academicYear: '',
      period: 'All records currently in the catalogue',
      layout: 'selected',
      departmentLabel: 'Garo',
      rows: [copy()],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Garo');
    expect(sheet?.getCell('C1').value).toBe('DON BOSCO COLLEGE TURA');
    const isbn = sheet?.getColumn(5);
    expect(isbn).toBeTruthy();
    let found = '';
    sheet?.eachRow((row) => {
      const value = row.getCell(5).value;
      if (value === '0001234567890') found = String(value);
    });
    expect(found).toBe('0001234567890');
  });
});
