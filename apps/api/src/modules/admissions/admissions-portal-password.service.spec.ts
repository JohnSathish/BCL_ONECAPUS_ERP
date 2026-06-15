import { AdmissionsPortalPasswordService } from './admissions-portal-password.service';

describe('AdmissionsPortalPasswordService', () => {
  const service = Object.create(
    AdmissionsPortalPasswordService.prototype,
  ) as AdmissionsPortalPasswordService;
  const hashToken = (
    service as unknown as { hashToken: (token: string) => string }
  ).hashToken.bind(service);

  it('hashes tokens consistently', () => {
    const a = hashToken('sample-token');
    const b = hashToken('sample-token');
    const c = hashToken('other-token');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });
});
