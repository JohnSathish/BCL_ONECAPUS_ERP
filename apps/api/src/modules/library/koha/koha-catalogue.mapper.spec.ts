import {
  classifyCollectionCode,
  mapBookRecord,
  mapCopyRecord,
  indexHeaders,
  parseIsbnList,
  splitPlaceAndPublisher,
  validationStatus,
} from './koha-catalogue.mapper';

const departments = [
  { id: 'dept-zoo', name: 'Zoology', code: 'ZOO' },
  { id: 'dept-com', name: 'Commerce', code: 'COM' },
];

describe('Koha catalogue mapping', () => {
  it('suggests a department only from an exact name and leaves it for review', () => {
    expect(classifyCollectionCode('Zoology', departments)).toMatchObject({
      status: 'NEEDS_REVIEW',
      departmentId: 'dept-zoo',
      method: 'SUGGESTED',
    });
    expect(classifyCollectionCode('REF', departments).status).toBe(
      'NOT_APPLICABLE',
    );
    expect(classifyCollectionCode('', departments).status).toBe('UNMAPPED');
    expect(classifyCollectionCode('General', departments)).toMatchObject({
      status: 'UNMAPPED',
      departmentId: null,
    });
  });

  it('parses ISBN and place:publisher without inventing a department from the title', () => {
    expect(parseIsbnList('978-81-123456-7-8; 812345678X')).toEqual({
      isbn10: '812345678X',
      isbn13: '9788112345678',
      invalid: false,
    });
    expect(splitPlaceAndPublisher('New Delhi:Rawat Publications', '')).toEqual({
      publicationPlace: 'New Delhi',
      publisher: 'Rawat Publications',
    });
  });

  it('keeps a withdrawn copy and flags a missing barcode instead of generating one', () => {
    const headers = indexHeaders([
      'itemnumber',
      'biblionumber',
      'barcode',
      'stocknumber',
      'ccode',
      'withdrawn',
      'itemlost',
      'damaged',
      'notforloan',
      'price',
      'dateaccessioned',
      'location',
    ]);
    const withdrawn = mapCopyRecord(
      [
        '10',
        '2',
        '0001',
        '',
        'Zoology',
        '1',
        '0',
        '0',
        '0',
        '120',
        '2020-01-15',
        '',
      ],
      headers,
    );
    expect(withdrawn?.copyStatus).toBe('WITHDRAWN');
    expect(withdrawn?.accessionNumber).toBe('0001');
    expect(withdrawn?.issues.some((issue) => issue.code === 'WITHDRAWN')).toBe(
      true,
    );

    const missing = mapCopyRecord(
      ['11', '2', '', '', 'Zoology', '0', '0', '0', '0', '', '', ''],
      headers,
    );
    expect(
      missing?.issues.some(
        (issue) =>
          issue.code === 'MISSING_BARCODE' && issue.severity === 'error',
      ),
    ).toBe(true);
    expect(validationStatus(missing?.issues ?? [])).toBe('INVALID');
  });

  it('requires a title and bibliographic id', () => {
    const headers = indexHeaders([
      'biblionumber',
      'title',
      'isbn',
      'publishercode',
    ]);
    const book = mapBookRecord(['55', 'Plant Physiology', '', ''], headers);
    expect(book?.title).toBe('Plant Physiology');
    expect(book?.issues).toEqual([]);
    const broken = mapBookRecord(['', '', '', ''], headers);
    expect(broken).toBeNull();
  });
});
