import { licenseDomainAllowed } from './school-sis-license-domain';

describe('licenseDomainAllowed', () => {
  it('allows any host when restriction is empty', () => {
    expect(licenseDomainAllowed('', ['st-lukes-tura'])).toBe(true);
    expect(licenseDomainAllowed(null, ['example.com'])).toBe(true);
  });

  it('treats stlukestura.in and st-lukes-tura as the same school', () => {
    expect(licenseDomainAllowed('stlukestura.in', ['st-lukes-tura'])).toBe(
      true,
    );
    expect(licenseDomainAllowed('st-lukes-tura', ['erp.stlukestura.in'])).toBe(
      true,
    );
    expect(
      licenseDomainAllowed('https://www.stlukestura.in/', ['st-lukes-tura']),
    ).toBe(true);
  });

  it('rejects a different school', () => {
    expect(licenseDomainAllowed('stlukestura.in', ['other-school'])).toBe(
      false,
    );
  });
});
