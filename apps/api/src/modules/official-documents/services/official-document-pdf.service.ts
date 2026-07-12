import { Injectable } from '@nestjs/common';
import {
  resolvePdfImageSrc,
  resolvePdfImageSrcAsync,
} from '../../../common/uploads/pdf-asset.util';
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

const AUDIENCE_FLAG_LABELS: Record<string, string> = {
  students: 'Students',
  all_students: 'All Students',
  teaching_staff: 'Teaching Staff',
  faculty: 'Teaching Staff',
  non_teaching_staff: 'Non-Teaching Staff',
  parents: 'Parents',
  alumni: 'Alumni',
  principal: 'Principal',
  hod: 'Heads of Department',
  public: 'Public',
  hostel: 'Hostel Residents',
  ncc: 'NCC Cadets',
  nss: 'NSS Volunteers',
  clubs: 'Club Members',
};

/** Keys that expand or are handled specially — not shown as raw labels. */
const AUDIENCE_CONTROL_KEYS = new Set([
  'students',
  'all_students',
  'staff',
  'teaching_staff',
  'faculty',
  'non_teaching_staff',
  'parents',
  'alumni',
  'principal',
  'hod',
  'public',
  'hostel',
  'ncc',
  'nss',
  'clubs',
  'filters',
  'labels',
  'targets',
  'recipients',
  'committee',
  'committeeIds',
  'committeeNames',
  'includeMembers',
]);

const FILTER_LABEL_PREFIX: Record<string, string> = {
  semester: 'Semester',
  semesterNo: 'Semester',
  semesterLabel: '',
  department: 'Department of',
  departmentName: 'Department of',
  shift: '',
  shiftName: '',
  programme: '',
  programmeName: '',
  campus: '',
  year: 'Year',
  section: 'Section',
  class: 'Class',
};

const RECIPIENT_ORDER = [
  'All Students',
  'Students',
  'Teaching Staff',
  'Non-Teaching Staff',
  'Heads of Department',
  'Principal',
  'Parents',
  'Alumni',
  'Hostel Residents',
  'NCC Cadets',
  'NSS Volunteers',
  'Club Members',
  'Public',
];

function isTruthyAudienceFlag(value: unknown): boolean {
  if (value === true || value === 1 || value === '1' || value === 'true') {
    return true;
  }
  if (
    typeof value === 'string' &&
    value.trim() &&
    value !== 'false' &&
    value !== '0'
  ) {
    return true;
  }
  return false;
}

function formatFilterValue(key: string, raw: unknown): string | null {
  if (raw == null || raw === false) return null;
  if (Array.isArray(raw)) {
    const parts = raw.map((v) => String(v).trim()).filter(Boolean);
    if (!parts.length) return null;
    const joined = parts.join(', ');
    const prefix = FILTER_LABEL_PREFIX[key];
    if (prefix === '') return joined;
    if (prefix) return `${prefix} ${joined}`.replace(/\s+/g, ' ').trim();
    return joined;
  }
  if (typeof raw === 'object') return null;
  const value = String(raw).trim();
  if (!value || value === 'true' || value === 'false') return null;
  const prefix = FILTER_LABEL_PREFIX[key];
  if (prefix === undefined) {
    // Unknown filter key with a string value — show as-is if already descriptive
    if (/semester|department|shift|programme|year|section/i.test(value)) {
      return value;
    }
    const prettyKey = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    return `${prettyKey} ${value}`.trim();
  }
  if (prefix === '') return value;
  // Avoid "Department of Department of Economics"
  if (prefix && value.toLowerCase().startsWith(prefix.toLowerCase())) {
    return value;
  }
  if (key.startsWith('semester') && /^semester\b/i.test(value)) return value;
  return `${prefix} ${value}`.replace(/\s+/g, ' ').trim();
}

/**
 * Build the PDF "To" list from the document audience JSON.
 * Mirrors Communication / Official Documents audience selection.
 */
export function buildRecipientLinesFromAudience(
  audience: unknown,
  salutation?: string | null,
): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  const push = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) return;
    seen.add(trimmed.toLowerCase());
    lines.push(trimmed);
  };

  if (audience && typeof audience === 'object' && !Array.isArray(audience)) {
    const map = audience as Record<string, unknown>;
    const hasStudents =
      isTruthyAudienceFlag(map.students) ||
      isTruthyAudienceFlag(map.all_students);
    const hasStaff = isTruthyAudienceFlag(map.staff);
    const hasTeaching =
      isTruthyAudienceFlag(map.teaching_staff) ||
      isTruthyAudienceFlag(map.faculty);
    const hasNonTeaching = isTruthyAudienceFlag(map.non_teaching_staff);
    const hasOtherStaffScope = hasTeaching || hasNonTeaching;

    if (hasStudents) {
      push(
        hasStaff || hasOtherStaffScope || isTruthyAudienceFlag(map.all_students)
          ? 'All Students'
          : 'Students',
      );
    }

    if (hasStaff) {
      // "Staff" means both teaching and non-teaching
      push('Teaching Staff');
      push('Non-Teaching Staff');
    } else {
      if (hasTeaching) push('Teaching Staff');
      if (hasNonTeaching) push('Non-Teaching Staff');
    }

    for (const key of [
      'parents',
      'alumni',
      'principal',
      'hod',
      'public',
      'hostel',
      'ncc',
      'nss',
      'clubs',
    ]) {
      if (isTruthyAudienceFlag(map[key])) {
        push(AUDIENCE_FLAG_LABELS[key] ?? key);
      }
    }

    // Committees (names resolved by PDF service into audience.committeeNames)
    if (
      isTruthyAudienceFlag(map.committee) ||
      Array.isArray(map.committeeIds)
    ) {
      const names = map.committeeNames;
      if (Array.isArray(names)) {
        for (const name of names) {
          if (typeof name === 'string' && name.trim()) {
            push(
              name.trim().endsWith('Members')
                ? name.trim()
                : `${name.trim()} Members`,
            );
          }
        }
      }
    }

    // Explicit label / target arrays
    for (const listKey of ['labels', 'targets', 'recipients'] as const) {
      const list = map[listKey];
      if (Array.isArray(list)) {
        for (const item of list) {
          if (typeof item === 'string' && item.trim()) push(item);
        }
      }
    }

    // Nested filters object
    const filters = map.filters;
    if (filters && typeof filters === 'object' && !Array.isArray(filters)) {
      for (const [fkey, fval] of Object.entries(
        filters as Record<string, unknown>,
      )) {
        const formatted = formatFilterValue(fkey, fval);
        if (formatted) push(formatted);
      }
    } else if (Array.isArray(filters)) {
      for (const item of filters) {
        if (typeof item === 'string' && item.trim()) push(item);
        else if (item && typeof item === 'object') {
          const row = item as { label?: string; value?: string };
          if (row.label && row.value) push(`${row.label} ${row.value}`.trim());
          else if (row.value) push(String(row.value));
        }
      }
    }

    // Top-level filter-like string fields
    for (const [key, value] of Object.entries(map)) {
      if (AUDIENCE_CONTROL_KEYS.has(key)) continue;
      if (key in FILTER_LABEL_PREFIX || typeof value === 'string') {
        const formatted = formatFilterValue(key, value);
        if (formatted) push(formatted);
      }
    }

    lines.sort((a, b) => {
      const ia = RECIPIENT_ORDER.indexOf(a);
      const ib = RECIPIENT_ORDER.indexOf(b);
      const aIsFilter = ia === -1;
      const bIsFilter = ib === -1;
      // Audience groups first (known order), then filters alphabetically
      if (!aIsFilter && !bIsFilter) return ia - ib;
      if (!aIsFilter && bIsFilter) return -1;
      if (aIsFilter && !bIsFilter) return 1;
      return a.localeCompare(b);
    });
  }

  if (lines.length === 0 && salutation?.trim()) {
    const cleaned = salutation
      .replace(/^dear\s+/i, '')
      .replace(/[,.]+$/g, '')
      .trim();
    if (cleaned) push(cleaned);
  }

  return lines;
}

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
    return buildRecipientLinesFromAudience(audience, salutation);
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

  private parseMeetingInfo(printSettings: unknown) {
    if (!printSettings || typeof printSettings !== 'object') return null;
    const m = (printSettings as { meeting?: Record<string, unknown> }).meeting;
    if (!m || typeof m !== 'object') return null;
    const agendaRaw = m.agenda;
    const agenda = Array.isArray(agendaRaw)
      ? agendaRaw.map((a) => String(a ?? '').trim()).filter(Boolean)
      : typeof agendaRaw === 'string'
        ? agendaRaw
            .split(/\n|;/)
            .map((a) => a.trim())
            .filter(Boolean)
        : [];
    return {
      title: typeof m.title === 'string' ? m.title : undefined,
      date:
        typeof m.date === 'string' && m.date.trim()
          ? /^\d{4}-\d{2}-\d{2}/.test(m.date.trim())
            ? formatOfficialDate(m.date.trim())
            : m.date.trim()
          : undefined,
      time: typeof m.time === 'string' ? m.time : undefined,
      venue: typeof m.venue === 'string' ? m.venue : undefined,
      duration: typeof m.duration === 'string' ? m.duration : undefined,
      convenedBy: typeof m.convenedBy === 'string' ? m.convenedBy : undefined,
      chairperson:
        typeof m.chairperson === 'string' ? m.chairperson : undefined,
      agenda,
    };
  }

  private formatCommitteeRole(
    role?: string | null,
    designation?: string | null,
  ) {
    const raw = (role || designation || 'Member').trim();
    return raw
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private async loadCommitteeTables(
    tenantId: string,
    audience: unknown,
  ): Promise<{
    committeeNames: string[];
    tables: Array<{
      committeeName: string;
      members: Array<{ name: string; designation: string }>;
    }>;
    includeMembers: boolean;
  }> {
    if (!audience || typeof audience !== 'object' || Array.isArray(audience)) {
      return { committeeNames: [], tables: [], includeMembers: false };
    }
    const map = audience as Record<string, unknown>;
    const ids = Array.isArray(map.committeeIds)
      ? map.committeeIds.filter((id): id is string => typeof id === 'string')
      : [];
    const includeMembers = map.includeMembers !== false;
    if (!ids.length) {
      return { committeeNames: [], tables: [], includeMembers };
    }

    const committees = await this.prisma.governanceCommittee.findMany({
      where: {
        tenantId,
        id: { in: ids },
        NOT: { status: 'INACTIVE' },
      },
      orderBy: { name: 'asc' },
      include: {
        members: {
          where: { status: 'ACTIVE' },
          orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
        },
      },
    });

    const byId = new Map(committees.map((c) => [c.id, c]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((c): c is (typeof committees)[number] => Boolean(c));

    const ROLE_RANK: Record<string, number> = {
      CHAIRMAN: 1,
      CHAIRPERSON: 1,
      PRINCIPAL: 2,
      CONVENER: 3,
      CONVENOR: 3,
      COORDINATOR: 4,
      SECRETARY: 5,
      JOINT_SECRETARY: 6,
      CHIEF_EDITOR: 7,
      EDITOR: 8,
      MEMBER: 90,
      EX_OFFICIO: 91,
      EX_OFFICIO_MEMBER: 91,
    };

    const tables = ordered.map((c) => {
      const members = [...c.members].sort((a, b) => {
        const ra = ROLE_RANK[a.role?.toUpperCase?.() ?? ''] ?? 50;
        const rb = ROLE_RANK[b.role?.toUpperCase?.() ?? ''] ?? 50;
        if (ra !== rb) return ra - rb;
        return a.displayName.localeCompare(b.displayName);
      });
      return {
        committeeName: c.name,
        members: members.map((m) => ({
          name: m.displayName,
          designation: this.formatCommitteeRole(m.role, m.designation),
        })),
      };
    });

    return {
      committeeNames: ordered.map((c) => c.name),
      tables: includeMembers ? tables : [],
      includeMembers,
    };
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
    const logoSrc =
      (await resolvePdfImageSrcAsync(
        letterhead.logoPath ?? branding?.logoUrl ?? null,
      )) ??
      resolvePdfImageSrc(letterhead.logoPath ?? branding?.logoUrl ?? null);
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
    const bodyHtml = renderTemplateVars(doc.bodyHtml ?? '', vars)
      // Collapse stacked empty paragraphs that waste vertical space
      .replace(/(?:<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>\s*){2,}/gi, '');
    const signatureSrc = resolvePdfImageSrc(issuer.signaturePath);
    const attachments: Array<{ fileName?: string }> = Array.isArray(
      doc.attachments,
    )
      ? doc.attachments
      : [];

    const committeeData = await this.loadCommitteeTables(
      doc.tenantId,
      doc.audience,
    );
    const audienceForRecipients =
      doc.audience && typeof doc.audience === 'object'
        ? {
            ...(doc.audience as Record<string, unknown>),
            committee: committeeData.committeeNames.length > 0,
            committeeNames: committeeData.committeeNames,
          }
        : doc.audience;

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
      recipientLines: this.recipientLines(
        audienceForRecipients,
        doc.salutation,
      ),
      bodyHtml,
      importantItems: this.importantItems(doc.printSettings),
      attachmentNames: attachments
        .map((a) => a.fileName?.trim())
        .filter((n): n is string => Boolean(n)),
      meetingInfo: this.parseMeetingInfo(doc.printSettings),
      committeeTables: committeeData.tables,
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
        margin: { top: '8mm', right: '12mm', bottom: '10mm', left: '12mm' },
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
