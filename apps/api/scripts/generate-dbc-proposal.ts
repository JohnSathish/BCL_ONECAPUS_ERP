/**
 * Generate an updated BCL OneCampus ERP proposal PDF for Don Bosco College, Tura.
 *
 * Usage:
 *   npx tsx scripts/generate-dbc-proposal.ts
 *   npx tsx scripts/generate-dbc-proposal.ts --html
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import puppeteer from 'puppeteer';
import { renderEnterpriseProposalHtml } from '../src/modules/proposals/templates/proposal-enterprise.template';
import type { ProposalTemplateContext } from '../src/modules/proposals/templates/proposal-template.types';
import {
  BCL_COMPANY,
  buildSubscriptionPricing,
  generateWebsiteQrCodeDataUri,
  resolveBclLogoDataUri,
  resolveCoverCompositeDataUri,
  resolveInstitutionLogoDataUri,
  resolvePrincipalDashboardDataUri,
} from '../src/modules/proposals/utils/proposal-branding.util';

async function main() {
  const htmlOnly = process.argv.includes('--html');
  const studentStrength = 2200;
  const perStudentSubscriptionRate = 100;
  const proposalDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const context: ProposalTemplateContext = {
    institutionName: 'Don Bosco College, Tura',
    proposalDate,
    proposalVersion: '2.2',
    studentStrength,
    perStudentSubscriptionRate,
    contactPerson: 'Dr (Fr) Jogesh B Sangma',
    contactEmail: 'principal@donboscocollege.ac.in',
    contactPhone: '+91-9678402086',
    companyName: BCL_COMPANY.name,
    companyTagline: BCL_COMPANY.tagline,
    companyEmail: BCL_COMPANY.email,
    companyPhone: BCL_COMPANY.phone,
    companyWebsite: BCL_COMPANY.website,
    companyWebsiteLabel: BCL_COMPANY.websiteLabel,
    addressLine:
      'Don Bosco College Tura, Sampalgre, West Garo Hills, Meghalaya 794002',
    primaryColor: '#0B2E59',
    secondaryColor: '#C79A2B',
    proposalTheme: 'don-bosco',
    backgroundImageUrl: null,
    mobileScreenshotUrl: null,
    principalDashboardScreenshotUrl: resolvePrincipalDashboardDataUri(),
    signatureUrl: null,
    logoDataUri: resolveInstitutionLogoDataUri(),
    bclLogoDataUri: resolveBclLogoDataUri(),
    dashboardScreenshotUrl: resolveCoverCompositeDataUri(),
    qrCodeUrl: await generateWebsiteQrCodeDataUri(BCL_COMPANY.website),
    pricingLines: buildSubscriptionPricing(
      studentStrength,
      perStudentSubscriptionRate,
      {
        implementationAmount: 0,
        supportAmount: 0,
      },
    ),
    sectionToggles: {},
    copy: {
      executiveSummary:
        'BaseCode Labs Pvt. Ltd. presents this proposal for the annual subscription of BCL OneCampus ERP — a comprehensive Campus Management System designed for higher educational institutions following the NEP 2020 FYUGP framework. The platform digitizes academic and administrative operations of Don Bosco College, Tura, providing a centralized, secure, and efficient system for students, faculty, office staff, and leadership — including admissions, academics, examinations, fees with reconciliation, finance, HR, official documents, library, governance, NAAC/IQAC, college website CMS, research journals, Principal Desk analytics, and mobile apps.',
      implementation:
        'Implementation is included in the annual subscription and covers ERP installation, initial configuration, data migration support, user account creation, office staff training, and go-live support.',
      support:
        'Support during the active subscription period includes technical support, remote assistance, software updates, bug fixes, performance monitoring, backup assistance, and feature enhancements where applicable.',
    },
  };

  const html = renderEnterpriseProposalHtml(context);
  const outDir = join(process.cwd(), 'storage', 'proposals');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const baseName = `BCL-OneCampus-ERP-Proposal-DBC-Tura-v2.2-${stamp}`;

  const htmlPath = join(outDir, `${baseName}.html`);
  await writeFile(htmlPath, html, 'utf8');
  console.log('HTML:', htmlPath);

  if (htmlOnly) return;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 90_000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
    const pdfPath = join(outDir, `${baseName}.pdf`);
    await writeFile(pdfPath, pdf);
    console.log('PDF:', pdfPath);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
