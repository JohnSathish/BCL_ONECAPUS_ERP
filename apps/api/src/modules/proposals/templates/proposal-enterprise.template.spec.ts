import {
  renderEnterpriseProposalHtml,
  resolveCopy,
} from './proposal-enterprise.template';

import {
  BCL_COMPANY,
  buildSubscriptionPricing,
  resolveBclLogoDataUri,
} from '../utils/proposal-branding.util';

function baseContext() {
  const perStudentSubscriptionRate = 100;
  const studentStrength = 2200;
  return {
    institutionName: 'Don Bosco College, Tura',
    proposalDate: '09 July 2026',
    proposalVersion: '1.0',
    addressLine: 'Tura, Meghalaya',
    studentStrength,
    perStudentSubscriptionRate,
    contactPerson: 'Principal',
    contactEmail: 'principal@donboscocollege.ac.in',
    contactPhone: '+91-9678402086',
    companyName: BCL_COMPANY.name,
    companyTagline: BCL_COMPANY.tagline,
    companyEmail: BCL_COMPANY.email,
    companyPhone: BCL_COMPANY.phone,
    companyWebsite: BCL_COMPANY.website,
    companyWebsiteLabel: BCL_COMPANY.websiteLabel,
    companyWebsiteLabel: BCL_COMPANY.websiteLabel,
    primaryColor: '#1E40AF',
    secondaryColor: '#2563EB',
    proposalTheme: 'modern-blue',
    backgroundImageUrl: null,
    dashboardScreenshotUrl: null,
    mobileScreenshotUrl: null,
    principalDashboardScreenshotUrl: null,
    signatureUrl: null,
    qrCodeUrl: null,
    logoDataUri: null,
    bclLogoDataUri: resolveBclLogoDataUri(),
    pricingLines: buildSubscriptionPricing(
      studentStrength,
      perStudentSubscriptionRate,
    ),
    sectionToggles: {},
    copy: resolveCopy(),
  };
}

describe('renderEnterpriseProposalHtml', () => {
  it('renders a compact multi-page proposal with TOC and institution placeholders', () => {
    const html = renderEnterpriseProposalHtml(baseContext());
    expect(html).toContain('Don Bosco College, Tura');
    expect(html).toContain('BCL ONECAMPUS ERP');
    expect(html).toContain('PREPARED FOR');
    expect(html).toContain('OneCampus');
    expect(html).toContain('Table of Contents');
    expect(html).toContain('Executive Summary');
    expect(html).toContain('Annual Subscription');
    expect(html).toContain('Acceptance');
    expect(html).toContain(BCL_COMPANY.name);
    expect(html).toContain(BCL_COMPANY.email);
    expect(html).toContain('₹100 × 2,200 students');
    const pageCount = (html.match(/class="page"/g) ?? []).length;
    // Cover + TOC + ~11 content pages
    expect(pageCount).toBeGreaterThanOrEqual(10);
    expect(pageCount).toBeLessThanOrEqual(15);
  });

  it('respects section toggles by omitting disabled sections', () => {
    const html = renderEnterpriseProposalHtml({
      ...baseContext(),
      sectionToggles: { ai: false, acceptance: false },
    });
    expect(html).not.toContain('Artificial Intelligence');
    expect(html).not.toContain('Thank You');
    expect(html).toContain('Executive Summary');
  });
});
