import {
  defaultLabelSettings,
  labelSheetFits,
  mergeLabelSettings,
  prepareBarcodeLabels,
  upgradeLegacyLabelStock,
  type LabelSettings,
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

  it('fits two 50×25 mm labels across a Zebra GT800 row', () => {
    const settings = defaultLabelSettings({
      name: 'Don Bosco College, Tura',
      code: 'DBCL',
    });
    expect(settings.preset).toBe('ZEBRA_2UP');
    expect(settings.columns).toBe(2);
    expect(settings.rows).toBe(1);
    expect(settings.labelWidthMm).toBe(50);
    expect(settings.labelHeightMm).toBe(24.89);
    expect(settings.pageWidthMm).toBe(101.6);
    expect(settings.pageHeightMm).toBe(24.89);
    expect(settings.gapXMm).toBe(1.6);
    expect(settings.showLogo).toBe(false);
    expect(settings.showTitle).toBe(false);
    expect(settings.headerTitle).toBe('');
    expect(settings.headerCode).toBe('DBCL');
    expect(labelSheetFits(settings)).toBe(true);
  });

  it('keeps the Zebra page when a saved template still asks for a logo', () => {
    const merged = mergeLabelSettings(
      {
        preset: 'ZEBRA_2UP',
        showLogo: true,
        headerTitle: 'DON BOSCO COLLEGE, TURA',
        labelWidthMm: 90,
        headerCode: 'DBCL',
      },
      { name: 'Don Bosco College, Tura', code: 'DBCL' },
    );
    expect(merged.labelWidthMm).toBe(50);
    expect(merged.labelHeightMm).toBe(24.89);
    expect(merged.pageWidthMm).toBe(101.6);
    expect(merged.showLogo).toBe(false);
    expect(merged.headerTitle).toBe('');
    expect(merged.headerCode).toBe('DBCL');
    expect(labelSheetFits(merged)).toBe(true);
  });

  it('moves the old A4 logo sheet onto the Zebra stock', () => {
    const legacy: LabelSettings = {
      preset: 'A4_2X4',
      pageWidthMm: 210,
      pageHeightMm: 297,
      columns: 2,
      rows: 4,
      marginTopMm: 10,
      marginRightMm: 10,
      marginBottomMm: 10,
      marginLeftMm: 10,
      gapXMm: 4,
      gapYMm: 4,
      labelWidthMm: 93,
      labelHeightMm: 64.75,
      barcodeHeightMm: 14,
      moduleWidth: 1.4,
      fontSizePt: 8,
      showLogo: true,
      showTitle: true,
      showAuthor: true,
      showDepartment: true,
      showCallNumber: true,
      showAccession: true,
      headerTitle: 'DON BOSCO COLLEGE, TURA',
      headerSubtitle: 'LIBRARY',
      headerCode: 'DBCL',
    };
    const upgraded = upgradeLegacyLabelStock(legacy, {
      name: 'Don Bosco College, Tura',
      code: 'DBCL',
    });
    expect(upgraded.preset).toBe('ZEBRA_2UP');
    expect(upgraded.showLogo).toBe(false);
    expect(upgraded.headerTitle).toBe('');
    expect(upgraded.headerCode).toBe('DBCL');
    expect(upgraded.labelWidthMm).toBe(50);
    expect(labelSheetFits(upgraded)).toBe(true);

    const custom = upgradeLegacyLabelStock({ ...legacy, showLogo: false });
    expect(custom.preset).toBe('A4_2X4');
  });
});
