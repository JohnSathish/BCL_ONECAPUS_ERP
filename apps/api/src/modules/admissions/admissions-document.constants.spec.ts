import {
  findMissingRequiredDocuments,
  formatMissingDocumentLabels,
  resolveRequiredDocumentSlots,
} from './admissions-document.constants';

describe('admissions-document.constants', () => {
  it('requires photo and marksheets by default', () => {
    expect(resolveRequiredDocumentSlots({})).toEqual([
      'PHOTO',
      'STD10',
      'STD12',
    ]);
  });

  it('requires EWS certificate when category is EWS', () => {
    expect(
      resolveRequiredDocumentSlots({ personal: { category: 'EWS' } }),
    ).toEqual(['PHOTO', 'STD10', 'STD12', 'EWS']);
  });

  it('lists missing uploads with friendly labels', () => {
    const missing = findMissingRequiredDocuments(['PHOTO'], {
      personal: { category: 'GENERAL' },
    });
    expect(missing).toEqual(['STD10', 'STD12']);
    expect(formatMissingDocumentLabels(missing)).toContain('STD X');
    expect(formatMissingDocumentLabels(missing)).toContain('STD XII');
  });
});
