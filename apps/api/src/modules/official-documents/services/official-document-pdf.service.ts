import { Injectable } from '@nestjs/common';
import { resolvePdfImageSrc } from '../../../common/uploads/pdf-asset.util';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import {
  buildOfficialNoticeHtml,
  renderTemplateVars,
} from '../templates/official-notice.template';
import {
  currentAcademicYearLabel,
  formatOfficialDate,
} from '../utils/date-format.util';
import { officialDb } from '../utils/official-documents-prisma.util';
import { ReferenceNumberService } from './reference-number.service';
import puppeteer from 'puppeteer';

@Injectable()
export class OfficialDocumentPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly referenceNumbers: ReferenceNumberService,
  ) {}

  private db() {
    return officialDb(this.prisma);
  }

  buildVerifyUrl(tenantId: string, token: string, baseUrl?: string | null) {
    const root =
      baseUrl?.trim() ||
      process.env.OFFICIAL_DOCUMENT_VERIFY_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://portal.donboscocollege.ac.in';
    const normalized = root.replace(/\/$/, '');
    return `${normalized}/verify/document/${token}`;
  }

  async resolveLetterhead(doc: Record<string, any>) {
    if (doc.letterhead) return doc.letterhead;
    if (doc.issuer?.letterhead) return doc.issuer.letterhead;
    const defaultLh = await this.db().officialLetterhead.findFirst({
      where: { tenantId: doc.tenantId, isDefault: true, active: true },
    });
    if (defaultLh) return defaultLh;
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: doc.tenantId },
    });
    return {
      collegeName: tenant?.name ?? 'Don Bosco College',
      addressLine: 'Tura, Meghalaya – 794002',
      contactLine:
        'Mobile: 9678402086 | Email: viceprincipal@donboscocollege.ac.in | Website: www.donboscocollege.ac.in',
      logoPath: null,
    };
  }

  async buildHtml(doc: Record<string, any>, referenceNo: string) {
    const settings = await this.referenceNumbers.getSettings(doc.tenantId);
    const letterhead = await this.resolveLetterhead(doc);
    const issuer = doc.issuer ?? {
      name: 'Authorized Signatory',
      designation: 'Office',
    };
    const verifyUrl = this.buildVerifyUrl(
      doc.tenantId,
      doc.verifyToken,
      settings.verifyBaseUrl,
    );
    const vars = {
      Today: formatOfficialDate(new Date()),
      CurrentDate: formatOfficialDate(new Date()),
      CollegeName: letterhead.collegeName,
      CollegeAddress: letterhead.addressLine,
      ReferenceNo: referenceNo,
      AcademicYear: currentAcademicYearLabel(),
      IssuerName: issuer.name,
      Designation: issuer.designation,
      Principal: issuer.roleCode === 'PRINCIPAL' ? issuer.name : '',
      VicePrincipal: issuer.roleCode === 'VICE_PRINCIPAL' ? issuer.name : '',
    };
    const bodyHtml = renderTemplateVars(doc.bodyHtml ?? '', vars);

    return buildOfficialNoticeHtml({
      collegeName: letterhead.collegeName,
      addressLine: letterhead.addressLine,
      contactLine: letterhead.contactLine,
      logoSrc: resolvePdfImageSrc(letterhead.logoPath),
      referenceNo,
      dateLabel: formatOfficialDate(doc.publishedAt ?? new Date()),
      documentType: doc.documentType,
      title: doc.title,
      salutation: doc.salutation,
      bodyHtml,
      issuerName: issuer.name,
      designation: issuer.designation,
      signatureSrc: resolvePdfImageSrc(issuer.signaturePath),
      sealSrc: resolvePdfImageSrc(issuer.sealPath),
      verifyUrl,
      verifyCode: doc.verifyToken,
    });
  }

  async htmlToPdf(html: string) {
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
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async generateAndStore(doc: Record<string, any>, referenceNo: string) {
    const html = await this.buildHtml(doc, referenceNo);
    const buffer = await this.htmlToPdf(html);
    const storageKey = `official-documents/${doc.tenantId}/${doc.id}.pdf`;
    await this.storage.put(storageKey, buffer, {
      contentType: 'application/pdf',
    });
    return { storageKey, html };
  }

  async getPdfBuffer(storageKey: string) {
    const buffer = await this.storage.get(storageKey);
    if (!buffer) throw new Error('PDF not found');
    return buffer;
  }
}
