import { Injectable } from '@nestjs/common';
import { resolvePdfImageSrc } from '../../../common/uploads/pdf-asset.util';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import {
  buildOfficialNoticeHtml,
  renderTemplateVars,
  type OfficialNoticeContact,
  type OfficialNoticeImportantItem,
} from '../templates/official-notice.template';
import {
  currentAcademicYearLabel,
  formatOfficialDate,
} from '../utils/date-format.util';
import { officialDb } from '../utils/official-documents-prisma.util';
import { ReferenceNumberService } from './reference-number.service';
import puppeteer from 'puppeteer';

const AUDIENCE_LABELS: Record<string, string> = {
  students: 'Students',
  staff: 'Non-Teaching Staff',
  faculty: 'Faculty Members',
  parents: 'Parents / Guardians',
  public: 'Public',
  hostel: 'Hostel Residents',
  ncc: 'NCC Cadets',
  nss: 'NSS Volunteers',
  clubs: 'Club Members',
};

const OFFICE_BY_ROLE: Record<string, string> = {
  PRINCIPAL: 'Office of the Principal',
  VICE_PRINCIPAL: 'Office of the Vice Principal',
  REGISTRAR: 'Office of the Registrar',
  CONTROLLER: 'Office of the Controller of Examinations',
  IQAC: 'IQAC Office',
  HR: 'Human Resources Office',
};

const LANDLINE_DEFAULT = '03651-222361';
const WEBSITE_DEFAULT = 'www.donboscocollege.ac.in';

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

  private websiteFromContactLine(contactLine?: string | null) {
    const match = contactLine?.match(/(?:Website|Web)\s*:\s*([^\s|]+)/i);
    return match?.[1]?.trim() || WEBSITE_DEFAULT;
  }

  private landlineFromContactLine(contactLine?: string | null) {
    const match = contactLine?.match(
      /(?:Ph\.?|Phone|Landline)\s*:?\s*([0-9+\-\s]{8,})/i,
    );
    return match?.[1]?.trim() || LANDLINE_DEFAULT;
  }

  /**
   * Structured letterhead contact. Mobile/email follow the issuing officer
   * when set (Principal vs Vice Principal).
   */
  buildContact(
    letterhead: { contactLine?: string | null },
    issuer?: {
      phone?: string | null;
      email?: string | null;
    } | null,
  ): OfficialNoticeContact {
    const website = this.websiteFromContactLine(letterhead.contactLine);
    const landline = this.landlineFromContactLine(letterhead.contactLine);
    const mobile =
      issuer?.phone?.trim() ||
      this.extractLabeled(letterhead.contactLine, 'Mobile') ||
      '+91 94021 52496';
    const email =
      issuer?.email?.trim() ||
      this.extractLabeled(letterhead.contactLine, 'Email') ||
      'principaldbct@gmail.com';
    return { landline, mobile, email, website };
  }

  /** @deprecated Prefer buildContact — kept for callers that need a flat line. */
  buildContactLine(
    letterhead: { contactLine?: string | null },
    issuer?: {
      phone?: string | null;
      email?: string | null;
    } | null,
  ) {
    const c = this.buildContact(letterhead, issuer);
    const parts: string[] = [];
    if (c.landline) parts.push(`Phone: ${c.landline}`);
    if (c.mobile) parts.push(`Mobile: ${c.mobile}`);
    if (c.email) parts.push(`Email: ${c.email}`);
    if (c.website) parts.push(`Website: ${c.website}`);
    return parts.join(' | ');
  }

  private extractLabeled(
    contactLine: string | null | undefined,
    label: string,
  ) {
    if (!contactLine) return null;
    const re = new RegExp(`${label}\\s*:\\s*([^|]+)`, 'i');
    const m = contactLine.match(re);
    return m?.[1]?.trim() || null;
  }

  private departmentLabel(
    issuer?: {
      roleCode?: string | null;
      designation?: string | null;
    } | null,
  ) {
    if (issuer?.roleCode && OFFICE_BY_ROLE[issuer.roleCode]) {
      return OFFICE_BY_ROLE[issuer.roleCode];
    }
    if (issuer?.designation?.trim()) {
      return `Office of the ${issuer.designation.trim()}`;
    }
    return 'Office of the Principal';
  }

  private recipientLines(
    audience: unknown,
    salutation?: string | null,
  ): string[] {
    const lines: string[] = [];
    if (audience && typeof audience === 'object' && !Array.isArray(audience)) {
      const map = audience as Record<string, unknown>;
      for (const [key, enabled] of Object.entries(map)) {
        if (!enabled) continue;
        if (typeof enabled === 'string' && enabled.trim()) {
          lines.push(enabled.trim());
          continue;
        }
        lines.push(AUDIENCE_LABELS[key] ?? key.replace(/_/g, ' '));
      }
      // Prefer faculty before staff/students ordering
      const order = [
        'Faculty Members',
        'Non-Teaching Staff',
        'Students',
        'Parents / Guardians',
      ];
      lines.sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
    }
    if (lines.length === 0 && salutation?.trim()) {
      // Parse "Dear Faculty members and Students" → rough recipients
      const cleaned = salutation
        .replace(/^dear\s+/i, '')
        .replace(/[,.]+$/g, '')
        .trim();
      if (cleaned) lines.push(cleaned);
    }
    return lines;
  }

  private importantItems(
    printSettings: unknown,
  ): OfficialNoticeImportantItem[] {
    if (!printSettings || typeof printSettings !== 'object') return [];
    const raw = (printSettings as { importantDates?: unknown }).importantDates;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as { label?: string; value?: string };
        if (!row.label?.trim() || !row.value?.trim()) return null;
        return { label: row.label.trim(), value: row.value.trim() };
      })
      .filter((x): x is OfficialNoticeImportantItem => Boolean(x));
  }

  private formatGeneratedAt(date = new Date()) {
    const datePart = formatOfficialDate(date);
    const timePart = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${datePart} · ${timePart}`;
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
      include: { branding: true },
    });
    const brandingLogo = tenant?.branding?.logoUrl ?? null;
    return {
      collegeName:
        tenant?.branding?.displayName ?? tenant?.name ?? 'Don Bosco College',
      addressLine:
        tenant?.branding?.address?.trim() || 'Tura, Meghalaya – 794002',
      contactLine: `Phone: ${LANDLINE_DEFAULT} | Mobile: +91 94021 52496 | Email: principaldbct@gmail.com | Website: ${WEBSITE_DEFAULT}`,
      logoPath: brandingLogo,
    };
  }

  async buildHtml(doc: Record<string, any>, referenceNo: string) {
    const settings = await this.referenceNumbers.getSettings(doc.tenantId);
    const letterhead = await this.resolveLetterhead(doc);
    const branding = await this.prisma.tenantBranding.findFirst({
      where: { tenantId: doc.tenantId },
    });
    const logoSrc = resolvePdfImageSrc(
      letterhead.logoPath ?? branding?.logoUrl ?? null,
    );
    const issuer = doc.issuer ?? {
      name: 'Authorized Signatory',
      designation: 'Office',
    };
    const contact = this.buildContact(letterhead, issuer);
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
    const signatureSrc = resolvePdfImageSrc(issuer.signaturePath);
    const attachments: Array<{ fileName?: string }> = Array.isArray(
      doc.attachments,
    )
      ? doc.attachments
      : [];

    return buildOfficialNoticeHtml({
      collegeName: letterhead.collegeName,
      addressLine: letterhead.addressLine,
      contact,
      logoSrc,
      referenceNo,
      dateLabel: formatOfficialDate(doc.publishedAt ?? new Date()),
      departmentLabel: this.departmentLabel(issuer),
      documentType: doc.documentType,
      title: doc.title,
      salutation: doc.salutation,
      recipientLines: this.recipientLines(doc.audience, doc.salutation),
      bodyHtml,
      importantItems: this.importantItems(doc.printSettings),
      attachmentNames: attachments
        .map((a) => a.fileName?.trim())
        .filter((n): n is string => Boolean(n)),
      issuerName: issuer.name,
      designation: issuer.designation,
      institutionShortName: 'Don Bosco College, Tura',
      signatureSrc,
      sealSrc: resolvePdfImageSrc(issuer.sealPath),
      digitallyApproved: Boolean(doc.approvedById) && !signatureSrc,
      verifyUrl,
      verifyCode: doc.verifyToken,
      generatedAtLabel: this.formatGeneratedAt(
        doc.publishedAt ? new Date(doc.publishedAt) : new Date(),
      ),
      pageLabel: 'Page 1 of 1',
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
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      // Allow webfonts a brief moment to settle for print quality
      await new Promise((r) => setTimeout(r, 400));
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async generateAndStore(doc: Record<string, any>, referenceNo: string) {
    const withAttachments =
      doc.attachments != null
        ? doc
        : await this.db().officialDocument.findFirst({
            where: { id: doc.id, tenantId: doc.tenantId },
            include: {
              issuer: { include: { letterhead: true } },
              letterhead: true,
              attachments: true,
            },
          });

    const html = await this.buildHtml(
      { ...doc, ...(withAttachments ?? {}) },
      referenceNo,
    );
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
