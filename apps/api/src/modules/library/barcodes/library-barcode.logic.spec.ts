import {
  defaultLabelSettings,
  labelSheetFits,
  prepareBarcodeLabels,
} from './library-barcode.logic';

describe('library barcode labels', () => {
  const copy = {
    id: 'copy-1',
    accessionNumber: '39043',
    barcode: '39043',
    title: 'Introduction to Sociology',
    author: 'Giddens, Anthony',
    callNumber: '306.0954 GID',
    department: 'Sociology',
  };

  it('encodes the accession number and keeps the title off the barcode', () => {
    const result = prepareBarcodeLabels([copy]);
    expect(result.rejected).toEqual([]);
    expect(result.labels).toEqual([
      expect.objectContaining({
        encodedValue: '39043',
        accessionNumber: '39043',
        title: 'Introduction to Sociology',
      }),
    ]);
    expect(result.labels[0].encodedValue).not.toContain('Sociology');
  });

  it('prints one label when the same copy is selected twice', () => {
    const result = prepareBarcodeLabels([copy, { ...copy }]);
    expect(result.labels).toHaveLength(1);
  });

  it('rejects a missing accession number and does not invent one', () => {
    const result = prepareBarcodeLabels([
      { ...copy, id: 'copy-2', accessionNumber: '  ', barcode: '39044' },
    ]);
    expect(result.labels).toHaveLength(0);
    expect(result.rejected[0].reason).toMatch(/Missing accession/);
  });

  it('rejects duplicate accession numbers without changing them', () => {
    const result = prepareBarcodeLabels([
      copy,
      { ...copy, id: 'copy-2', barcode: '39043' },
    ]);
    expect(result.labels).toHaveLength(0);
    expect(result.rejected).toHaveLength(2);
    expect(
      result.rejected.every((row) => row.accessionNumber === '39043'),
    ).toBe(true);
  });

  it('fits eight labels on an A4 sheet after margins and gaps', () => {
    const settings = defaultLabelSettings({
      name: 'Don Bosco College, Tura',
      code: 'DBCL',
    });
    expect(settings.columns * settings.rows).toBe(8);
    expect(settings.headerCode).toBe('DBCL');
    expect(labelSheetFits(settings)).toBe(true);
  });
});
