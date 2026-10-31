import { portalHostCandidates } from './request-host';

describe('portalHostCandidates', () => {
  it('maps the OPAC host onto the college ERP and apex hosts', () => {
    expect(portalHostCandidates('opac.donboscocollege.ac.in')).toEqual([
      'opac.donboscocollege.ac.in',
      'erp.donboscocollege.ac.in',
      'donboscocollege.ac.in',
    ]);
  });

  it('leaves the college ERP host unchanged', () => {
    expect(portalHostCandidates('erp.donboscocollege.ac.in')).toEqual([
      'erp.donboscocollege.ac.in',
    ]);
  });
});
