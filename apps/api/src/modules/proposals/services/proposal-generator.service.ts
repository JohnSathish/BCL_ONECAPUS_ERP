import { Injectable } from '@nestjs/common';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import puppeteer from 'puppeteer';
import { resolvePdfImageSrcAsync } from '../../../common/uploads/pdf-asset.util';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import { PrismaService } from '../../../database/prisma.service';
import { ProposalCustomizationDto } from '../dto/proposal.dto';
import {
  renderEnterpriseProposalHtml,
  resolveCopy,
} from '../templates/proposal-enterprise.template';
import { PROPOSAL_SECTIONS } from '../templates/proposal-template.sections';
import type { ProposalTemplateContext } from '../templates/proposal-template.types';
import {
  BCL_COMPANY,
  buildSubscriptionPricing,
  generateWebsiteQrCodeDataUri,
  resolveBclLogoDataUri,
  resolveCoverCompositeDataUri,
  resolveInstitutionLogoDataUri,
  resolvePrincipalDashboardDataUri,
} from '../utils/proposal-branding.util';

type ProposalExportFormat = 'html' | 'pdf' | 'docx';

@Injectable()
export class ProposalGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async previewHtml(tenantId: string, dto: ProposalCustomizationDto) {
    const context = await this.buildContext(tenantId, dto);
    return {
      html: renderEnterpriseProposalHtml(context),
      context,
    };
  }

  async export(
    tenantId: string,
    dto: ProposalCustomizationDto,
    format: ProposalExportFormat,
  ) {
    const context = await this.buildContext(tenantId, dto);
    const html = renderEnterpriseProposalHtml(context);
    if (format === 'html') {
      return {
        format,
        buffer: Buffer.from(html, 'utf-8'),
        filename: this.buildFilename(context.institutionName, 'html'),
        contentType: 'text/html; charset=utf-8',
      };
    }
    if (format === 'pdf') {
      const buffer = await this.renderPdf(html);
      return {
        format,
        buffer,
        filename: this.buildFilename(context.institutionName, 'pdf'),
        contentType: 'application/pdf',
      };
    }
    const buffer = await this.renderDocx(context);
    return {
      format,
      buffer,
      filename: this.buildFilename(context.institutionName, 'docx'),
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  private async buildContext(tenantId: string, dto: ProposalCustomizationDto) {
    const [tenant, branding] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
      this.prisma.tenantBranding.findUnique({ where: { tenantId } }),
    ]);
    const logoUrl = dto.logoUrl ?? branding?.logoUrl;
    const [
      logoDataUri,
      backgroundImageDataUri,
      dashboardScreenshotDataUri,
      mobileScreenshotDataUri,
      signatureDataUri,
      qrCodeDataUri,
    ] = await Promise.all([
      resolvePdfImageSrcAsync(
        logoUrl ? (toPublicUploadUrl(logoUrl) ?? logoUrl) : null,
      ),
      resolvePdfImageSrcAsync(
        dto.backgroundImageUrl
          ? (toPublicUploadUrl(dto.backgroundImageUrl) ??
              dto.backgroundImageUrl)
          : null,
      ),
      resolvePdfImageSrcAsync(
        dto.dashboardScreenshotUrl
          ? (toPublicUploadUrl(dto.dashboardScreenshotUrl) ??
              dto.dashboardScreenshotUrl)
          : null,
      ),
      resolvePdfImageSrcAsync(
        dto.mobileScreenshotUrl
          ? (toPublicUploadUrl(dto.mobileScreenshotUrl) ??
              dto.mobileScreenshotUrl)
          : null,
      ),
      resolvePdfImageSrcAsync(
        dto.signatureUrl
          ? (toPublicUploadUrl(dto.signatureUrl) ?? dto.signatureUrl)
          : null,
      ),
      resolvePdfImageSrcAsync(
        dto.qrCodeUrl
          ? (toPublicUploadUrl(dto.qrCodeUrl) ?? dto.qrCodeUrl)
          : null,
      ),
    ]);
    const institutionName =
      dto.institutionName ??
      branding?.displayName ??
      tenant?.name ??
      'Institution';
    const sectionToggles = Object.fromEntries(
      (dto.sectionToggles ?? []).map((item) => [item.key, item.enabled]),
    );
    const studentStrength = dto.studentStrength ?? 2200;
    const perStudentSubscriptionRate = dto.perStudentSubscriptionRate ?? 100;
    const pricingLines = dto.pricingLines?.length
      ? dto.pricingLines
      : buildSubscriptionPricing(studentStrength, perStudentSubscriptionRate);
    const websiteQrCodeDataUri =
      qrCodeDataUri ??
      (await generateWebsiteQrCodeDataUri(BCL_COMPANY.website));

    const context: ProposalTemplateContext = {
      institutionName,
      proposalDate:
        dto.proposalDate ??
        new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
      proposalVersion: dto.proposalVersion ?? '1.0',
      studentStrength,
      perStudentSubscriptionRate,
      contactPerson: dto.contactPerson ?? 'Dr (Fr) Jogesh B Sangma',
      contactEmail: dto.contactEmail ?? 'principal@donboscocollege.ac.in',
      contactPhone: dto.contactPhone ?? '+91-9678402086',
      companyName: BCL_COMPANY.name,
      companyTagline: BCL_COMPANY.tagline,
      companyEmail: BCL_COMPANY.email,
      companyPhone: BCL_COMPANY.phone,
      companyWebsite: BCL_COMPANY.website,
      companyWebsiteLabel: BCL_COMPANY.websiteLabel,
      addressLine:
        dto.addressLine ??
        branding?.address ??
        'Don Bosco College Tura, Sampalgre, West Garo Hills, Meghalaya 794002',
      primaryColor: dto.primaryColor ?? branding?.primaryColor ?? '#1E40AF',
      secondaryColor: dto.secondaryColor ?? '#2563EB',
      proposalTheme: dto.proposalTheme ?? 'modern-blue',
      backgroundImageUrl: backgroundImageDataUri,
      mobileScreenshotUrl: mobileScreenshotDataUri,
      principalDashboardScreenshotUrl: resolvePrincipalDashboardDataUri(),
      signatureUrl: signatureDataUri,
      logoDataUri: logoDataUri ?? resolveInstitutionLogoDataUri(),
      bclLogoDataUri: resolveBclLogoDataUri(),
      dashboardScreenshotUrl:
        dashboardScreenshotDataUri ?? resolveCoverCompositeDataUri(),
      qrCodeUrl: websiteQrCodeDataUri,
      pricingLines,
      sectionToggles,
      copy: resolveCopy(dto.copyOverrides),
    };
    return context;
  }

  private async renderPdf(html: string) {
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
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private async renderDocx(context: ProposalTemplateContext) {
    const enabled = PROPOSAL_SECTIONS.filter(
      (s) => context.sectionToggles[s.key] !== false,
    );

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: 'BCL OneCampus ERP - Enterprise Proposal',
              heading: HeadingLevel.TITLE,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Prepared for ${context.institutionName}`,
                  bold: true,
                }),
              ],
            }),
            new Paragraph(`Date: ${context.proposalDate}`),
            new Paragraph(`Version: ${context.proposalVersion}`),
            new Paragraph(`Student Strength: ${context.studentStrength}`),
            ...enabled.flatMap((section) => [
              new Paragraph({
                text: section.tocTitle,
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph(
                `${section.tocTitle} — comprehensive details for ${context.institutionName} as part of the BCL OneCampus ERP enterprise proposal.`,
              ),
            ]),
            new Paragraph({
              text: 'Pricing Summary',
              heading: HeadingLevel.HEADING_1,
            }),
            ...context.pricingLines.map(
              (line) =>
                new Paragraph(
                  `${line.label}: ₹${line.amount.toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                  })}`,
                ),
            ),
            new Paragraph({
              text: `${context.companyName} | ${context.companyEmail} | ${context.companyPhone} | ${context.companyWebsiteLabel}`,
            }),
          ],
        },
      ],
    });

    return Buffer.from(await Packer.toBuffer(doc));
  }

  private buildFilename(institutionName: string, ext: 'html' | 'pdf' | 'docx') {
    const slug = institutionName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `bcl-proposal-${slug || 'institution'}.${ext}`;
  }
}
