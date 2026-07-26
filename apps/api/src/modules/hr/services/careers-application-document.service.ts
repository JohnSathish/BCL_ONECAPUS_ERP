import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import { launchPdfBrowser } from '../../../common/pdf/launch-browser';
import { resolvePdfImageSrcAsync } from '../../../common/uploads/pdf-asset.util';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';
import { parsePortalExtras } from '../../../common/types/portal-extras.types';
import { PrismaService } from '../../../database/prisma.service';
import {
  docKindLabel,
  normalizeDocKind,
  type CareersStoredDocument,
} from '../constants/careers-document-kinds';
import {
  buildCareersApplicationHtml,
  type CareersApplicationPdfModel,
} from '../templates/careers-application.template';

@Injectable()
export class CareersApplicationDocumentService {
  private readonly logger = new Logger(CareersApplicationDocumentService.name);
  private readonly uploadRoot = resolveTenantUploadRoot();

  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async generateAndPersist(tenantId: string, applicationId: string) {
    const { buffer, verifyToken, contentHash, filename } = await this.renderPdf(
      tenantId,
      applicationId,
    );

    const dir = join(
      this.uploadRoot,
      tenantId,
      'recruitment-applications',
      applicationId,
    );
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), buffer);

    const url = `/uploads/tenants/${tenantId}/recruitment-applications/${applicationId}/${filename}`;
    await this.db().recruitmentApplication.update({
      where: { id: applicationId },
      data: {
        applicationPdfUrl: url,
        applicationPdfGeneratedAt: new Date(),
        verifyToken,
        contentHash,
      },
    });

    return {
      applicationPdfUrl: url,
      contentHash,
      verifyToken,
      generatedAt: new Date().toISOString(),
    };
  }

  async pdfBuffer(tenantId: string, applicationId: string) {
    const app = await this.requireApp(tenantId, applicationId);
    if (app.applicationPdfUrl) {
      const absolute = this.resolveDiskPath(app.applicationPdfUrl);
      try {
        await access(absolute);
        const buffer = await readFile(absolute);
        return {
          buffer,
          filename: this.zipSafeName(
            `${app.applicationNo ?? applicationId}-Application.pdf`,
          ),
        };
      } catch {
        /* regenerate below */
      }
    }
    const rendered = await this.renderPdf(tenantId, applicationId);
    await this.generateAndPersist(tenantId, applicationId);
    return {
      buffer: rendered.buffer,
      filename: this.zipSafeName(
        `${app.applicationNo ?? applicationId}-Application.pdf`,
      ),
    };
  }

  async listDocuments(tenantId: string, applicationId: string) {
    const app = await this.requireApp(tenantId, applicationId);
    const docs: Array<{
      key: string;
      kind: string;
      label: string;
      name: string;
      url: string;
      mimeType?: string | null;
    }> = [];

    if (app.applicationPdfUrl) {
      docs.push({
        key: 'application-pdf',
        kind: 'APPLICATION_PDF',
        label: 'Application PDF',
        name: 'Application.pdf',
        url: app.applicationPdfUrl,
        mimeType: 'application/pdf',
      });
    }

    const stored = this.collectedDocs(app);
    stored.forEach((d, i) => {
      docs.push({
        key: `doc-${i}`,
        kind: d.kind,
        label: docKindLabel(d.kind),
        name: d.name,
        url: d.url,
        mimeType: d.mimeType ?? null,
      });
    });

    return {
      applicationNo: app.applicationNo,
      applicationPdfUrl: app.applicationPdfUrl,
      applicationPdfGeneratedAt: app.applicationPdfGeneratedAt,
      contentHash: app.contentHash,
      verifyToken: app.verifyToken,
      documents: docs,
    };
  }

  async packageZip(tenantId: string, applicationId: string) {
    const app = await this.requireApp(tenantId, applicationId);
    const { buffer: pdfBuffer } = await this.pdfBuffer(tenantId, applicationId);
    const zip = new JSZip();
    zip.file('Application.pdf', pdfBuffer);

    const certs = zip.folder('Certificates');
    const other = zip.folder('Other');
    const used = new Set<string>(['Application.pdf']);

    for (const doc of this.collectedDocs(app)) {
      const kind = normalizeDocKind(doc.kind);
      const absolute = this.resolveDiskPath(doc.url);
      let fileBuf: Buffer;
      try {
        await access(absolute);
        fileBuf = await readFile(absolute);
      } catch {
        continue;
      }
      const ext = extname(doc.name) || extname(doc.url) || '';
      let base =
        kind === 'resume'
          ? `Resume${ext || '.pdf'}`
          : kind === 'photo'
            ? `PassportPhoto${ext || '.jpg'}`
            : `${docKindLabel(kind).replace(/[^\w.-]+/g, '_')}${ext || ''}`;
      base = this.zipSafeName(base);
      let name = base;
      let n = 1;
      while (used.has(name)) {
        name = `${n++}_${base}`;
      }
      used.add(name);

      if (kind === 'resume' || kind === 'photo') {
        zip.file(name, fileBuf);
      } else if (
        ['ug', 'pg', 'experience', 'net', 'phd', 'community'].includes(kind)
      ) {
        certs?.file(name, fileBuf);
      } else {
        other?.file(name, fileBuf);
      }
    }

    const zipName = this.zipSafeName(
      `${(app.applicationNo ?? applicationId).replace(/\//g, '-')}.zip`,
    );
    return {
      buffer: await zip.generateAsync({ type: 'nodebuffer' }),
      filename: zipName,
    };
  }

  async verifyByToken(token: string) {
    const app = await this.db().recruitmentApplication.findFirst({
      where: { verifyToken: token },
      include: {
        vacancy: {
          select: {
            title: true,
            department: { select: { name: true } },
          },
        },
      },
    });
    if (!app) throw new NotFoundException('Verification record not found');
    return {
      valid: true,
      applicationNo: app.applicationNo,
      candidateName: app.fullName,
      position: app.vacancy?.title ?? null,
      department: app.vacancy?.department?.name ?? null,
      appliedAt: app.appliedAt,
      contentHash: app.contentHash,
      generatedAt: app.applicationPdfGeneratedAt,
    };
  }

  private async renderPdf(tenantId: string, applicationId: string) {
    const app = await this.requireApp(tenantId, applicationId);
    const branding = await this.prisma.tenantBranding.findFirst({
      where: { tenantId },
    });
    const extras = parsePortalExtras(branding?.portalExtrasJson ?? null);
    const careers = extras.careersPortal ?? {};

    const verifyToken = app.verifyToken || randomUUID();
    const publicBase =
      process.env.CAREERS_PUBLIC_ORIGIN?.replace(/\/$/, '') ||
      process.env.WEB_ORIGIN?.replace(/\/$/, '') ||
      'https://career.donboscocollege.ac.in';
    const verifyUrl = `${publicBase}/careers-portal/verify/${verifyToken}`;

    const details = (app.applicationDetailsJson ?? {}) as Record<
      string,
      unknown
    >;
    const personal = (details.personal ?? {}) as Record<string, string>;
    const contact = (details.contact ?? {}) as Record<string, string>;
    const research = (details.research ?? {}) as Record<string, string>;
    const skills = (details.skills ?? {}) as Record<string, string>;
    const declaration = (details.declaration ?? {}) as Record<string, unknown>;
    const education = Array.isArray(details.education)
      ? (details.education as Array<Record<string, string>>)
      : [];
    const experience = Array.isArray(details.experience)
      ? (details.experience as Array<Record<string, string>>)
      : [];
    const references = Array.isArray(details.references)
      ? (details.references as Array<Record<string, string>>)
      : [];

    const year = new Date(app.appliedAt ?? Date.now()).getFullYear();
    const logoDataUri = await resolvePdfImageSrcAsync(branding?.logoUrl);
    const photoDataUri = await resolvePdfImageSrcAsync(app.photoUrl);
    const qrDataUri = await QRCode.toDataURL(
      JSON.stringify({
        applicationNo: app.applicationNo,
        name: app.fullName,
        position: app.vacancy?.title,
        verifyUrl,
      }),
      { margin: 1, width: 160, errorCorrectionLevel: 'M' },
    );

    const model: CareersApplicationPdfModel = {
      applicationNo: app.applicationNo ?? applicationId,
      appliedOn: this.formatDate(app.appliedAt),
      generatedAt: this.formatDateTime(new Date()),
      contentHashShort: 'pending',
      verifyUrl,
      qrDataUri,
      logoDataUri,
      photoDataUri,
      collegeName: branding?.displayName?.trim() || 'DON BOSCO COLLEGE, TURA',
      collegeAddress:
        (careers as { address?: string }).address ||
        branding?.address ||
        'Tura, West Garo Hills, Meghalaya - 794002',
      collegeWebsite:
        (careers as { website?: string }).website ||
        'www.donboscocollege.ac.in',
      collegePhone: (careers as { phone?: string }).phone || '—',
      collegeEmail: (careers as { email?: string }).email || '—',
      recruitmentSession: String(year),
      positionTitle: app.vacancy?.title ?? '—',
      departmentName: app.vacancy?.department?.name ?? '—',
      personal: {
        'Full Name': personal.fullName || app.fullName,
        "Father's Name": personal.fatherName || app.fatherName || '',
        "Mother's Name": personal.motherName || '',
        Gender: personal.gender || '',
        'Date of Birth':
          personal.dateOfBirth || this.formatDate(app.dateOfBirth),
        'Marital Status': personal.maritalStatus || '',
        Nationality: personal.nationality || '',
        'Aadhaar / Passport Number': personal.aadhaarOrPassport || '',
      },
      contact: {
        'Mobile Number': contact.mobile || app.mobile || '',
        'WhatsApp Number': contact.whatsapp || '',
        'Email Address': contact.email || app.email || '',
        'Current / Correspondence Address': contact.correspondenceAddress || '',
        'Permanent Address':
          contact.permanentAddress ||
          (app.addressJson as { line1?: string } | null)?.line1 ||
          '',
      },
      education: education.map((e) => ({
        qualification: e.qualification || e.type || '',
        university: e.university || '',
        institution: e.institution || e.specialization || '',
        year: e.year || '',
        score: e.score || '',
      })),
      experience: experience.map((e) => ({
        institution: e.institution || '',
        designation: e.designation || '',
        department: e.department || '',
        fromDate: e.fromDate || '',
        toDate: e.toDate || '',
        years: e.experience || e.years || '',
      })),
      research: {
        'Research Area': research.researchArea || '',
        Publications: research.publicationsCount || '',
        Journals: research.journals || research.publicationsCount || '',
        Books: research.booksPublished || '',
        Conferences: research.conferencePapers || '',
        Patents: research.patents || '',
        FDP: research.fdp || '',
        Workshops: research.workshops || '',
        'Research Projects': research.researchProjects || '',
        'Google Scholar': research.googleScholar || '',
        ORCID: research.orcid || '',
        'Scopus ID': research.scopusId || '',
        'NET Qualified': research.netQualified || '',
        'SET / SLET Qualified': research.setQualified || '',
        'Ph.D Details': research.phdDetails || '',
      },
      skills: {
        'Languages Known': skills.languagesKnown || '',
        'Computer Skills': skills.computerSkills || '',
        'Teaching Skills': skills.teachingSkills || '',
        'Research Skills': skills.researchSkills || '',
      },
      references: references.map((r) => ({
        name: r.name || '',
        designation: r.designation || '',
        institution: r.institution || '',
        email: r.email || '',
        phone: r.phone || '',
      })),
      declaration: {
        accepted:
          details.declarationAccepted || declaration.accepted ? 'Yes' : 'No',
        signatureName: String(
          declaration.signatureName || personal.fullName || app.fullName,
        ),
        place: String(declaration.place || ''),
        date: String(declaration.date || this.formatDate(new Date())),
      },
    };

    const html = buildCareersApplicationHtml(model);
    let browser;
    try {
      browser = await launchPdfBrowser();
    } catch (error) {
      this.logger.error(
        `Careers PDF browser launch failed for ${applicationId}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        'PDF engine is unavailable on the server.',
      );
    }

    let buffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 45000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `
          <div style="width:100%;font-size:8px;color:#617083;padding:0 12mm;display:flex;justify-content:space-between;">
            <span>Computer Generated Document</span>
            <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>`,
        margin: {
          top: '12mm',
          right: '12mm',
          bottom: '16mm',
          left: '12mm',
        },
      });
      buffer = Buffer.from(pdf);
    } catch (error) {
      this.logger.error(
        `Careers PDF render failed for ${applicationId}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        'Could not generate the application PDF.',
      );
    } finally {
      await browser.close().catch(() => undefined);
    }

    const contentHash = createHash('sha256').update(buffer).digest('hex');
    model.contentHashShort = contentHash.slice(0, 12);

    // Re-render footer hash once (optional lightweight — skip second render; hash is stored in DB)
    return {
      buffer,
      verifyToken,
      contentHash,
      filename: 'Application.pdf',
    };
  }

  private collectedDocs(app: {
    resumeUrl?: string | null;
    photoUrl?: string | null;
    certificatesJson?: unknown;
  }): CareersStoredDocument[] {
    const fromJson = Array.isArray(app.certificatesJson)
      ? (app.certificatesJson as CareersStoredDocument[])
      : [];
    const hasResume = fromJson.some(
      (d) => normalizeDocKind(d.kind) === 'resume',
    );
    const hasPhoto = fromJson.some((d) => normalizeDocKind(d.kind) === 'photo');
    const out = [...fromJson];
    if (app.resumeUrl && !hasResume) {
      out.unshift({
        kind: 'RESUME',
        name: basename(app.resumeUrl),
        url: app.resumeUrl,
        uploadedAt: new Date(0).toISOString(),
      });
    }
    if (app.photoUrl && !hasPhoto) {
      out.push({
        kind: 'PHOTO',
        name: basename(app.photoUrl),
        url: app.photoUrl,
        uploadedAt: new Date(0).toISOString(),
      });
    }
    return out;
  }

  private async requireApp(tenantId: string, applicationId: string) {
    const app = await this.db().recruitmentApplication.findFirst({
      where: { id: applicationId, tenantId },
      include: {
        vacancy: {
          select: {
            title: true,
            department: { select: { name: true } },
          },
        },
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  private resolveDiskPath(publicUrl: string) {
    const relative = publicUrl.replace(/^\//, '').replace(/^uploads\//, '');
    return join(this.uploadRoot, relative);
  }

  private zipSafeName(name: string) {
    return name.replace(/[^\w.\-]+/g, '_');
  }

  private formatDate(value?: Date | string | null) {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private formatDateTime(value: Date) {
    return value.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
