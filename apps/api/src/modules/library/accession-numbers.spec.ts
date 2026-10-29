import {
  accessionSeries,
  availabilityToStatuses,
  formatAccessionNo,
  splitAuthors,
} from './accession-numbers';

describe('accession numbers', () => {
  it('builds the configured ACC-year-sequence format', () => {
    expect(formatAccessionNo('ACC', 2026, 1)).toBe('ACC-2026-00001');
  });

  it('reserves a distinct number for every physical copy', () => {
    const numbers = accessionSeries('ACC', 2026, 12, 5);
    expect(numbers).toEqual([
      'ACC-2026-00012',
      'ACC-2026-00013',
      'ACC-2026-00014',
      'ACC-2026-00015',
      'ACC-2026-00016',
    ]);
    expect(new Set(numbers).size).toBe(5);
  });

  it('keeps a second batch from overlapping the first', () => {
    const first = accessionSeries('ACC', 2026, 1, 5);
    const second = accessionSeries('ACC', 2026, 6, 3);
    expect(first[first.length - 1]).toBe('ACC-2026-00005');
    expect(second[0]).toBe('ACC-2026-00006');
  });

  it('maps received stock to the accession queue and shelved stock to available copies', () => {
    expect(availabilityToStatuses('RECEIVED')).toEqual({
      accessionStatus: 'PENDING',
      copyStatus: 'PROCESSING',
    });
    expect(availabilityToStatuses('ON_SHELF').copyStatus).toBe('AVAILABLE');
    expect(availabilityToStatuses('WITHDRAWN').accessionStatus).toBe(
      'WITHDRAWN',
    );
  });

  it('keeps the first author on the book and the rest as additional authors', () => {
    expect(splitAuthors('Ada Lovelace, Charles Babbage')).toEqual({
      primary: 'Ada Lovelace',
      additional: 'Charles Babbage',
    });
  });
});
