import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { launchPdfBrowser } from '../../common/pdf/launch-browser';
import { resolvePdfImageSrc } from '../../common/uploads/pdf-asset.util';
import { resolveUploadRoot } from '../../common/uploads/upload-paths';
import { PrismaService } from '../../database/prisma.service';
import {
  isSchoolCycleSettings,
  SCHOOL_DOCUMENT_SLOTS,
  type SchoolCycleSettings,
} from './school-admission.constants';
import { resolveSchoolCasteCategory } from './school-admission-category';
import { schoolAddressPinCode } from './school-address-pin';
import { schoolDocumentDisplayStatus } from './school-document-display-status';
import { resolveApplicableSchoolCertificates } from './school-document-requirements';
import {
  evaluateSchoolAgeEligibility,
  formatUtcDateLong,
  parseDateOnly,
  TPS_KG_2027_CENSUS_DATE,
} from './school-age-eligibility';
import {
  mergeSchoolApplicationPdfPackage,
  prepareSchoolPdfAttachments,
  schoolAttachmentLabelForSlot,
} from './school-admissions-pdf-attachments';
import { parseSchoolDocumentSlotCode } from './school-upload-image';

export type SchoolSubmissionMeta = {
  pdfFileUrl?: string;
  pdfGeneratedAt?: string;
  pdfError?: string | null;
  /** 2+ = form PDF + uploaded document attachments package */
  pdfPackageVersion?: number;
  email?: {
    status: 'PENDING' | 'SENT' | 'FAILED';
    sentAt?: string | null;
    error?: string | null;
    providerRef?: string | null;
    lastAttemptAt?: string | null;
  };
};

const SCHOOL_PDF_PACKAGE_VERSION = 4;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInDate(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatInDateTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fileNameFromUrl(url: string): string {
  try {
    const path = url.split('?')[0] ?? url;
    return decodeURIComponent(path.split('/').pop() || 'receipt');
  } catch {
    return 'receipt';
  }
}

function schoolLogoCandidates(): string[] {
  return [
    join(process.cwd(), 'src/modules/school-admissions/assets/tps-logo.png'),
    join(process.cwd(), 'dist/modules/school-admissions/assets/tps-logo.png'),
    join(process.cwd(), '../web/public/school-admissions/tps-logo.png'),
    join(process.cwd(), 'apps/web/public/school-admissions/tps-logo.png'),
  ];
}

@Injectable()
export class SchoolAdmissionsPdfService {
  private readonly logger = new Logger(SchoolAdmissionsPdfService.name);
  private readonly uploadRoot = resolveUploadRoot();

  constructor(private readonly prisma: PrismaService) {}

  readSubmissionMeta(
    formData: Record<string, unknown> | null | undefined,
  ): SchoolSubmissionMeta {
    return asRecord(formData?.submission) as SchoolSubmissionMeta;
  }

  async generateAndStoreForApplication(
    tenantId: string,
    applicationId: string,
  ): Promise<{
    buffer: Buffer;
    filename: string;
    pdfFileUrl: string;
    meta: SchoolSubmissionMeta;
  }> {
    const application = await this.loadApplication(tenantId, applicationId);
    const { buffer, filename, html } = await this.renderPdf(application);
    void html;

    const dir = join(
      this.uploadRoot,
      'tenants',
      tenantId,
      'school-admissions',
      application.id,
    );
    mkdirSync(dir, { recursive: true });
    const storedName = `application-copy-${application.applicationNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
    writeFileSync(join(dir, storedName), buffer);
    const pdfFileUrl = `/uploads/tenants/${tenantId}/school-admissions/${application.id}/${storedName}`;

    const formData = asRecord(application.formData);
    const previous = this.readSubmissionMeta(formData);
    const meta: SchoolSubmissionMeta = {
      ...previous,
      pdfFileUrl,
      pdfGeneratedAt: new Date().toISOString(),
      pdfError: null,
      pdfPackageVersion: SCHOOL_PDF_PACKAGE_VERSION,
    };
    formData.submission = meta as unknown as Record<string, unknown>;

    await this.prisma.admissionApplication.update({
      where: { id: application.id },
      data: { formData: formData as Prisma.InputJsonValue },
    });

    return { buffer, filename, pdfFileUrl, meta };
  }

  async getStoredPdfForApplicant(tenantId: string, userId: string) {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { tenantId, applicantUserId: userId, deletedAt: null },
      include: { cycle: true, documents: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.applicantUserId !== userId) {
      throw new ForbiddenException('You cannot access this application PDF');
    }
    if (
      ![
        'submitted',
        'under_review',
        'allotted',
        'rejected',
        'shortlisted',
      ].includes(application.status)
    ) {
      throw new NotFoundException(
        'Application PDF is available after submission',
      );
    }
    return this.resolveOrGeneratePdf(application.tenantId, application.id);
  }

  async getStoredPdfForOffice(tenantId: string, applicationId: string) {
    const application = await this.loadApplication(tenantId, applicationId);
    if (
      ![
        'submitted',
        'under_review',
        'allotted',
        'rejected',
        'shortlisted',
      ].includes(application.status)
    ) {
      throw new NotFoundException(
        'Application PDF is available after the parent submits the application.',
      );
    }
    return this.resolveOrGeneratePdf(tenantId, applicationId);
  }

  private isStoredPdfStale(
    application: Awaited<
      ReturnType<SchoolAdmissionsPdfService['loadApplication']>
    >,
    meta: SchoolSubmissionMeta,
  ): boolean {
    if (!meta.pdfFileUrl || !meta.pdfGeneratedAt) return true;
    if ((meta.pdfPackageVersion ?? 0) < SCHOOL_PDF_PACKAGE_VERSION) return true;
    const generatedAt = Date.parse(meta.pdfGeneratedAt);
    if (!Number.isFinite(generatedAt)) return true;
    for (const doc of application.documents) {
      const updated = Date.parse(String(doc.updatedAt ?? doc.createdAt));
      if (Number.isFinite(updated) && updated > generatedAt) return true;
    }
    return false;
  }

  private async resolveOrGeneratePdf(tenantId: string, applicationId: string) {
    const application = await this.loadApplication(tenantId, applicationId);
    const formData = asRecord(application.formData);
    const meta = this.readSubmissionMeta(formData);
    const filename = `${application.applicationNumber.replace(/[^a-zA-Z0-9-]/g, '_')}_KG_2027_Application.pdf`;

    if (!this.isStoredPdfStale(application, meta) && meta.pdfFileUrl) {
      const absolute = this.absoluteFromPublicUrl(meta.pdfFileUrl);
      if (absolute && existsSync(absolute)) {
        return {
          buffer: readFileSync(absolute),
          filename,
          pdfFileUrl: meta.pdfFileUrl,
          meta,
        };
      }
    }

    return this.generateAndStoreForApplication(tenantId, applicationId);
  }

  private absoluteFromPublicUrl(publicUrl: string): string | null {
    const relative = publicUrl.replace(/^\//, '').replace(/^uploads\//, '');
    const absolute = join(this.uploadRoot, relative);
    return absolute;
  }

  private async loadApplication(tenantId: string, applicationId: string) {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
      include: {
        cycle: true,
        documents: true,
      },
    });
    if (!application || !isSchoolCycleSettings(application.cycle?.settings)) {
      throw new NotFoundException('Application not found');
    }
    return application as typeof application & {
      cycle: { settings: SchoolCycleSettings; title: string };
    };
  }

  private async renderPdf(
    application: Awaited<
      ReturnType<SchoolAdmissionsPdfService['loadApplication']>
    >,
  ) {
    const html = await this.buildHtml(application);
    const browser = await launchPdfBrowser();
    let formPdf: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      // Page numbers are stamped after attachments are merged (pdf-lib).
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
      });
      formPdf = Buffer.from(pdf);
    } finally {
      await browser.close();
    }

    const formData = asRecord(application.formData);
    const child = asRecord(formData.child);
    const category = resolveSchoolCasteCategory(child);
    const settings = application.cycle.settings;
    const applicable = resolveApplicableSchoolCertificates(formData, {
      categoryCode: category?.code ?? null,
      documentRequirements: settings.documentRequirements,
    });
    const fee = settings.applicationFee ?? 0;
    const applicantName =
      text(child.fullName) ||
      application.firstName ||
      application.applicationNumber;

    const slotLabel = new Map<string, string>(
      SCHOOL_DOCUMENT_SLOTS.map((slot) => [slot.code, slot.label]),
    );
    const attachmentDocs = application.documents
      .filter((doc) => Boolean(doc.fileUrl?.trim()))
      .map((doc) => {
        const parsed = parseSchoolDocumentSlotCode(doc.slotCode);
        const baseCode = parsed?.baseCode || doc.slotCode;
        const baseLabel = schoolAttachmentLabelForSlot(
          baseCode,
          slotLabel.get(baseCode) || baseCode,
        );
        return {
          slotCode: doc.slotCode,
          label: baseLabel,
          fileUrl: doc.fileUrl,
          mimeType: doc.mimeType,
          verificationStatus: doc.verificationStatus,
          updatedAt: doc.updatedAt,
          createdAt: doc.createdAt,
        };
      });

    const attachmentMeta = {
      applicationNumber: application.applicationNumber,
      applicantName,
      amountLabel: fee > 0 ? `Rs. ${fee}` : null,
      paymentReference: application.paymentReference,
    };

    const prepared = await prepareSchoolPdfAttachments({
      tenantId: application.tenantId,
      applicationId: application.id,
      docs: attachmentDocs,
      applicableCasteSlotCodes: applicable.map((item) => item.slotCode),
      meta: attachmentMeta,
      logger: this.logger,
    });

    const buffer = await mergeSchoolApplicationPdfPackage({
      formPdf,
      attachments: prepared,
      applicationNumber: application.applicationNumber,
      applicantName,
      meta: attachmentMeta,
    });

    const filename = `${application.applicationNumber.replace(/[^a-zA-Z0-9-]/g, '_')}_KG_2027_Application.pdf`;
    return { buffer, filename, html };
  }

  private async buildHtml(
    application: Awaited<
      ReturnType<SchoolAdmissionsPdfService['loadApplication']>
    >,
  ) {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId: application.tenantId },
    });
    const schoolName =
      branding?.displayName?.trim() || 'Tura Public School, Tura';
    const motto =
      text(branding?.productTagline) ||
      text(
        (branding?.portalExtrasJson as { tagline?: string } | null)?.tagline,
      ) ||
      'Glow in Integrity';
    const settings = application.cycle.settings;
    const formData = asRecord(application.formData);
    const child = asRecord(formData.child);
    const permanent = asRecord(formData.permanentAddress);
    const present = asRecord(formData.presentAddress);
    const father = asRecord(formData.father);
    const mother = asRecord(formData.mother);
    const sibling = asRecord(formData.sibling);
    const category = resolveSchoolCasteCategory(child);
    const photoDoc = application.documents.find((d) => d.slotCode === 'PHOTO');
    const receipt = application.documents.find(
      (d) => d.slotCode === 'PAYMENT_RECEIPT',
    );
    const photoSrc = resolvePdfImageSrc(photoDoc?.fileUrl);
    let logoSrc: string | null = null;
    for (const candidate of schoolLogoCandidates()) {
      if (existsSync(candidate)) {
        logoSrc = resolvePdfImageSrc(candidate) ?? null;
        if (!logoSrc) {
          try {
            const buf = readFileSync(candidate);
            logoSrc = `data:image/png;base64,${buf.toString('base64')}`;
          } catch {
            logoSrc = null;
          }
        }
        break;
      }
    }

    const applicable = resolveApplicableSchoolCertificates(formData, {
      categoryCode: category?.code ?? null,
      documentRequirements: settings.documentRequirements,
    });
    const uploaded = new Map(
      application.documents.map((doc) => [doc.slotCode, doc]),
    );

    const checklistItems: Array<{
      label: string;
      required: boolean;
      uploaded: boolean;
      displayStatus: string;
      statusClass: string;
    }> = [];

    for (const slot of SCHOOL_DOCUMENT_SLOTS) {
      if (
        [
          'CASTE_CERT',
          'MOTHER_ST_CERT',
          'FATHER_SC_OBC_CERT',
          'PAYMENT_RECEIPT',
        ].includes(slot.code)
      ) {
        continue;
      }
      if (!slot.required && !uploaded.has(slot.code)) {
        continue;
      }
      const doc = uploaded.get(slot.code);
      const display = schoolDocumentDisplayStatus({
        uploaded: Boolean(doc),
        verificationStatus: doc?.verificationStatus,
      });
      checklistItems.push({
        label: slot.label,
        required: slot.required,
        uploaded: Boolean(doc),
        displayStatus: display.displayLabel,
        statusClass:
          display.tone === 'success'
            ? 'st-ok'
            : display.tone === 'danger'
              ? 'st-bad'
              : display.tone === 'warning'
                ? 'st-wait'
                : 'st-miss',
      });
    }

    for (const item of applicable) {
      const doc = uploaded.get(item.slotCode);
      const display = schoolDocumentDisplayStatus({
        uploaded: Boolean(doc),
        verificationStatus: doc?.verificationStatus,
      });
      checklistItems.push({
        label: item.label,
        required: item.required,
        uploaded: Boolean(doc),
        displayStatus: display.displayLabel,
        statusClass:
          display.tone === 'success'
            ? 'st-ok'
            : display.tone === 'danger'
              ? 'st-bad'
              : display.tone === 'warning'
                ? 'st-wait'
                : 'st-miss',
      });
    }

    const receiptDisplay = schoolDocumentDisplayStatus({
      uploaded: Boolean(receipt),
      verificationStatus: receipt?.verificationStatus,
    });
    checklistItems.push({
      label: 'Admission Fee Payment Receipt',
      required: true,
      uploaded: Boolean(receipt),
      displayStatus: receiptDisplay.displayLabel,
      statusClass:
        receiptDisplay.tone === 'success'
          ? 'st-ok'
          : receiptDisplay.tone === 'danger'
            ? 'st-bad'
            : receiptDisplay.tone === 'warning'
              ? 'st-wait'
              : 'st-miss',
    });

    const casteNote =
      applicable.length === 0
        ? 'No community / category certificate is required for this applicant.'
        : applicable.map((a) => a.label).join('; ');

    const fee = settings.applicationFee ?? 0;
    const censusDate = settings.censusDate || TPS_KG_2027_CENSUS_DATE;
    const ageEval = evaluateSchoolAgeEligibility(
      text(child.dateOfBirth),
      censusDate,
      settings.minAgeYears,
      settings.maxAgeYearsExclusive,
    );
    const dobParsed = parseDateOnly(text(child.dateOfBirth));
    const dobLabel = dobParsed
      ? formatUtcDateLong(dobParsed)
      : text(child.dateOfBirth);
    const ageParts = ageEval.age;
    const ageYears = ageParts?.years ?? '—';
    const ageMonths = ageParts?.months ?? '—';
    const ageDays = ageParts?.days ?? '—';
    const eligibilityLabel = !text(child.dateOfBirth)
      ? '—'
      : ageEval.eligible
        ? 'ELIGIBLE'
        : 'NOT ELIGIBLE';

    const paymentRows: [string, string][] = [
      ['Application Number', application.applicationNumber],
      ['Amount', fee > 0 ? `₹${fee}` : 'As informed by school'],
      [
        'Bank Transaction / UTR / Reference No.',
        text(application.paymentReference) || '—',
      ],
      ['Receipt Status', receiptDisplay.displayLabel],
      [
        'Receipt Upload Date',
        formatInDateTime(receipt?.updatedAt || receipt?.createdAt),
      ],
      ['Receipt File', receipt ? fileNameFromUrl(receipt.fileUrl) : '—'],
      ['Verification Status', receiptDisplay.schoolVerificationLabel],
    ];
    if (receiptDisplay.verificationStatus === 'REJECTED') {
      paymentRows.push(['Rejection Reason', text(receipt?.remarks) || '—']);
    }

    const section = (title: string, rows: [string, string][]) => `
      <section class="block">
        <h2>${esc(title)}</h2>
        <table>
          ${rows
            .map(
              ([k, v]) =>
                `<tr><th>${esc(k)}</th><td>${esc(v || '—')}</td></tr>`,
            )
            .join('')}
        </table>
      </section>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(application.applicationNumber)} · K.G. Admission 2027</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #0f172a;
      font-family: "Segoe UI", Tahoma, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.45;
    }
    .masthead {
      text-align: center;
      padding: 0 8px 10px;
      margin: 0 0 12px;
      border-bottom: 2.5px solid #1a5336;
    }
    .masthead img.logo {
      display: block;
      margin: 0 auto 8px;
      width: 58px;
      height: auto;
      object-fit: contain;
    }
    .masthead h1 {
      margin: 0;
      font-size: 18px;
      line-height: 1.2;
      font-weight: 700;
      color: #1a5336;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .masthead .session {
      margin: 5px 0 0;
      color: #1a5336;
      font-weight: 650;
      font-size: 11.5px;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .masthead .motto {
      margin: 5px 0 0;
      color: #475569;
      font-size: 10.5px;
      font-style: italic;
    }
    .masthead .affiliation {
      margin: 4px 0 0;
      color: #64748b;
      font-size: 9.5px;
    }
    .profile {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      background: #eaf5ee;
      border: 1px solid #c6e2d1;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 14px;
    }
    .app-no {
      font-size: 16px;
      font-weight: 700;
      color: #1a5336;
      font-family: ui-monospace, Consolas, monospace;
    }
    .photo {
      width: 96px;
      height: 120px;
      object-fit: cover;
      border: 2px solid #1a5336;
      border-radius: 6px;
      background: #fff;
    }
    .block { margin: 0 0 12px; page-break-inside: avoid; }
    .block h2 {
      margin: 0 0 6px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #1a5336;
      border-bottom: 1px solid #c6e2d1;
      padding-bottom: 3px;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      text-align: left;
      vertical-align: top;
      padding: 4px 6px;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      width: 34%;
      color: #475569;
      font-weight: 600;
      background: #f8fafc;
    }
    .docs-table th.doc-name { width: 58%; }
    .docs-table th.doc-status { width: 42%; }
    .docs-table td { font-size: 10.5px; }
    .st-ok { color: #166534; font-weight: 700; }
    .st-wait { color: #a16207; font-weight: 700; }
    .st-bad { color: #b91c1c; font-weight: 700; }
    .st-miss { color: #64748b; font-weight: 700; }
    .age-card {
      margin: 10px 0 14px;
      border: 1.5px solid #1a5336;
      border-radius: 8px;
      background: #f7fbf8;
      padding: 10px 12px;
      page-break-inside: avoid;
    }
    .age-title {
      margin: 0 0 8px;
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      font-style: italic;
      letter-spacing: 0.04em;
      color: #1a5336;
      text-transform: uppercase;
    }
    .age-boxes {
      display: flex;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .age-unit {
      display: flex;
      border: 1px solid #1a5336;
      background: #fff;
      min-width: 88px;
    }
    .age-unit .val {
      min-width: 34px;
      padding: 6px 8px;
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      border-right: 1px solid #1a5336;
    }
    .age-unit .lbl {
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      color: #1a5336;
      display: flex;
      align-items: center;
    }
    .age-elig {
      margin: 8px 0 0;
      text-align: center;
      font-size: 11px;
      font-weight: 700;
    }
    .age-elig.ok { color: #166534; }
    .age-elig.bad { color: #b91c1c; }
    .decl {
      border: 1px solid #1a5336;
      border-radius: 8px;
      padding: 10px 12px;
      background: #f7fbf8;
      margin-top: 8px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      margin-top: 6px;
    }
    .note { color: #64748b; font-size: 10px; margin-top: 4px; }
  </style>
</head>
<body>
  <header class="masthead">
    ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="Tura Public School logo" />` : ''}
    <h1>${esc(schoolName)}</h1>
    <p class="session">K.G. Admission – Academic Session 2027</p>
    <p class="motto">“${esc(motto)}”</p>
    <p class="affiliation">Affiliated to CISCE, New Delhi</p>
  </header>

  <div class="profile">
    <div>
      <div class="app-no">Application No.: ${esc(application.applicationNumber)}</div>
      <div class="meta-grid">
        <div><strong>Applicant:</strong> ${esc(text(child.fullName) || application.firstName)}</div>
        <div><strong>Status:</strong> ${esc(application.status.replaceAll('_', ' '))}</div>
        <div><strong>Submitted:</strong> ${esc(formatInDateTime(application.submittedAt))}</div>
        <div><strong>Parent email:</strong> ${esc(application.email)}</div>
        <div><strong>Parent mobile:</strong> ${esc(application.phone || text(father.mobile) || text(mother.mobile) || '—')}</div>
        <div><strong>Category:</strong> ${esc(category?.label || '—')}${text(child.community) ? ` · ${esc(text(child.community))}` : ''}</div>
      </div>
    </div>
    ${photoSrc ? `<img class="photo" src="${photoSrc}" alt="Photograph" />` : '<div class="photo" style="display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;">No photo</div>'}
  </div>

  ${section('1. Child details', [
    ['Full name', text(child.fullName)],
    ['Date of birth', dobLabel],
    ['Gender', text(child.gender)],
    ['Blood group', text(child.bloodGroup)],
    ['Caste / Category', category?.label || text(child.caste)],
    ['Community / Tribe', text(child.community) || '—'],
    ['Nationality', text(child.nationality)],
    ['School last attended', text(child.lastSchool)],
    [
      'Attended Nursery',
      child.attendedNursery === true
        ? 'Yes'
        : child.attendedNursery === false
          ? 'No'
          : '—',
    ],
  ])}

  <section class="age-card">
    <p class="age-title">Age as on 1st January, 2027</p>
    <div class="age-boxes">
      <div class="age-unit"><span class="val">${esc(String(ageYears))}</span><span class="lbl">Years</span></div>
      <div class="age-unit"><span class="val">${esc(String(ageMonths))}</span><span class="lbl">Months</span></div>
      <div class="age-unit"><span class="val">${esc(String(ageDays))}</span><span class="lbl">Days</span></div>
    </div>
    <p class="age-elig ${ageEval.eligible ? 'ok' : 'bad'}">Eligibility: ${esc(eligibilityLabel)}</p>
  </section>

  ${section('2. Permanent address', [
    ['Village', text(permanent.village)],
    ['P.O.', text(permanent.po)],
    ['District', text(permanent.district)],
    ['State / UT', text(permanent.state)],
    ['PIN', schoolAddressPinCode(permanent)],
  ])}

  ${section('3. Present address', [
    ['Landmark / Village', text(present.landmark)],
    ['P.O.', text(present.po)],
    ['District', text(present.district)],
    ['State / UT', text(present.state)],
    ['PIN', schoolAddressPinCode(present)],
  ])}

  ${section("4. Father's details", [
    ['Full name', text(father.fullName)],
    ['Occupation', text(father.occupation)],
    ['Mobile', text(father.mobile)],
    ['Email', text(father.email)],
  ])}

  ${section("5. Mother's details", [
    ['Full name', text(mother.fullName)],
    ['Occupation', text(mother.occupation)],
    ['Mobile', text(mother.mobile)],
    ['Email', text(mother.email)],
  ])}

  ${section('6. Brother / sister studying in this school', [
    ['Name', text(sibling.name)],
    ['Class', text(sibling.className || sibling.class)],
  ])}

  <section class="block">
    <h2>7. Documents submitted</h2>
    <p class="note">Applicable certificates: ${esc(casteNote)}</p>
    <p class="note">
      Full copies of uploaded documents (except the passport photograph already shown above) are
      attached after this form in a compact DOCUMENT ATTACHMENTS section.
    </p>
    <table class="docs-table">
      <thead>
        <tr>
          <th class="doc-name">Document</th>
          <th class="doc-status">Status</th>
        </tr>
      </thead>
      <tbody>
        ${checklistItems
          .map(
            (item) =>
              `<tr>
                <td>${esc(item.label)} (${item.required ? 'Required' : 'Optional'})</td>
                <td class="${item.statusClass}">${esc(item.displayStatus)}</td>
              </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </section>

  ${section('8. Payment information', paymentRows)}

  <section class="block decl">
    <h2 style="border:none;padding:0;margin:0 0 6px;">9. Declaration</h2>
    <p style="margin:0;">
      I / We hereby declare that the information furnished in this K.G. Admission application for
      Academic Session 2027 is true and correct to the best of my / our knowledge. I / We understand
      that any false information may lead to cancellation of the application / admission.
    </p>
    <div class="meta-grid" style="margin-top:10px;">
      <div><strong>Parent / Guardian:</strong> ${esc(text(father.fullName) || text(mother.fullName) || '—')}</div>
      <div><strong>Applicant:</strong> ${esc(text(child.fullName) || application.firstName)}</div>
      <div><strong>Application No.:</strong> ${esc(application.applicationNumber)}</div>
      <div><strong>Submission date:</strong> ${esc(formatInDateTime(application.submittedAt))}</div>
      <div><strong>Status:</strong> ${esc(application.status.replaceAll('_', ' '))}</div>
    </div>
  </section>
</body>
</html>`;
  }
}
