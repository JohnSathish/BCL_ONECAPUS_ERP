import { LibraryCatalogueReportsService } from './library-catalogue-reports.service';
import { exportCatalogueReport } from './library-catalogue-report.export';
import {
  csvCell,
  grandTotals,
  summarizeDepartmentCopies,
} from './library-catalogue-report.logic';
import { collectionMappingRows } from '../koha/koha-import-workbook';
import type { StagedCopyDraft } from '../koha/koha-catalogue.reader';

describe('library catalogue report counts', () => {
  it('counts one title with several copies once', () => {
    const rows = summarizeDepartmentCopies([
      { department: 'English', bookId: 'b1', status: 'AVAILABLE' },
      { department: 'English', bookId: 'b1', status: 'ISSUED' },
      { department: 'English', bookId: 'b2', status: 'AVAILABLE' },
    ]);
    expect(rows[0]).toEqual({
      department: 'English',
      titles: 2,
      copies: 3,
      available: 2,
      issued: 1,
    });
    expect(grandTotals(rows).copies).toBe(3);
  });

  it('compiles the report service and export', () => {
    expect(LibraryCatalogueReportsService).toBeDefined();
    expect(exportCatalogueReport).toBeDefined();
  });

  it('preserves a numeric barcode as text in csv', () => {
    expect(csvCell('0001')).toBe('"0001"');
  });

  it('does not treat REF or a blank collection as a confirmed department', () => {
    const copies = [
      draft('REF'),
      draft(''),
      draft('Zoology'),
      draft('Zoology'),
    ];
    const rows = collectionMappingRows(copies);
    expect(rows.find((row) => row.code === 'REF')?.status).toBe(
      'NOT_APPLICABLE',
    );
    expect(rows.find((row) => row.code === '')?.status).toBe('UNMAPPED');
    expect(rows.find((row) => row.code === 'Zoology')).toMatchObject({
      status: 'NEEDS_REVIEW',
      suggestedDepartment: 'Zoology',
      copies: 2,
    });
  });
});

function draft(collectionCode: string): StagedCopyDraft {
  return {
    sourceItemId: collectionCode || 'blank',
    sourceBibliographicId: '1',
    barcode: '0001',
    accessionNumber: '0001',
    callNumber: '',
    collectionCode,
    homeBranchCode: '',
    shelvingLocation: '',
    itemTypeCode: '',
    acquisitionDate: '',
    acquisitionPrice: '',
    withdrawn: '',
    itemLost: '',
    damaged: '',
    notForLoan: '',
    copyStatus: 'AVAILABLE',
    issues: [],
    validationStatus: 'VALID',
  };
}
