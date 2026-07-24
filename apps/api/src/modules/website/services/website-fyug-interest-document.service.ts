import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';
import QRCode from 'qrcode';
import { launchPdfBrowser } from '../../../common/pdf/launch-browser';
import { PrismaService } from '../../../database/prisma.service';
import { resolveUploadRoot } from '../../../common/uploads/upload-paths';

export type FyugInterestRecord = {
  id: string;
  applicationNumber: string | null;
  academicSession: string;
  fullName: string;
  photographUrl: string | null;
  photographKey: string | null;
  gender: string;
  dateOfBirth: Date;
  mobile: string;
  whatsapp: string;
  email: string;
  state: string;
  fatherName: string;
  fatherMobile: string;
  motherName: string;
  motherMobile: string;
  collegeLastAttended: string;
  affiliatedUniversity: string;
  majorCourse: string;
  minorCourse: string;
  applyingHonoursIn: string;
  cuetScore: string;
  cgpaSemesterV: string;
  percentageSemesterV: string;
  hasBackPapers: boolean;
  backPaperDetails: string;
  signatureName: string;
  status: string;
  createdAt: Date;
};

@Injectable()
export class WebsiteFyugInterestDocumentService {
  private readonly logger = new Logger(WebsiteFyugInterestDocumentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getInterest(tenantId: string, id: string): Promise<FyugInterestRecord> {
    const row = await this.prisma.websiteFyugInterest.findFirst({
      where: { id, tenantId },
    });
    if (!row)
      throw new NotFoundException('FYUG interest registration not found');
    return row;
  }

  async renderPdfBuffer(tenantId: string, id: string): Promise<Buffer> {
    const row = await this.getInterest(tenantId, id);
    const html = await this.buildHtml(row);
    let browser;
    try {
      browser = await launchPdfBrowser();
    } catch (error) {
      this.logger.error(
        `FYUG PDF browser launch failed for ${id}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        'PDF engine is unavailable on the server. Install Chromium or set PUPPETEER_EXECUTABLE_PATH.',
      );
    }
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      });
      return Buffer.from(pdf);
    } catch (error) {
      this.logger.error(
        `FYUG PDF render failed for ${id}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        'Could not generate the application PDF. Please try again.',
      );
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  private async buildHtml(row: FyugInterestRecord): Promise<string> {
    const appNo = row.applicationNumber || row.id.slice(0, 8).toUpperCase();
    const logoSrc = await this.resolveLogoDataUri();
    const photoSrc = await this.resolvePhotoDataUri(row);
    const verifyUrl = `https://donboscocollege.ac.in/admission/fyug-2026?app=${encodeURIComponent(appNo)}`;
    const qrSrc = await QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: 140,
      errorCorrectionLevel: 'M',
    });
    const dob = this.formatDate(row.dateOfBirth);
    const submitted = this.formatDateTime(row.createdAt);
    const generated = this.formatDateTime(new Date());
    const session = row.academicSession || '2026-2027';
    const dash = (value?: string | null) => {
      const v = (value ?? '').toString().trim();
      return v || '—';
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${this.escape(appNo)} – FYUG Application</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #1f2a37;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.35;
  }
  .page {
    position: relative;
    min-height: 277mm;
    padding-bottom: 28px;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }
  .watermark {
    position: absolute;
    inset: 18% 8% 22%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 0;
    opacity: 0.07;
    font-size: 42px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #0b2e59;
    text-align: center;
    transform: rotate(-18deg);
  }
  .content { position: relative; z-index: 1; }
  .header {
    display: grid;
    grid-template-columns: 78px 1fr 92px;
    gap: 12px;
    align-items: center;
    margin-bottom: 10px;
  }
  .logo {
    width: 72px;
    height: 72px;
    object-fit: contain;
  }
  .brand { text-align: center; }
  .brand h1 {
    margin: 0;
    color: #0b2e59;
    font-size: 18px;
    letter-spacing: 0.02em;
  }
  .brand p {
    margin: 2px 0 0;
    color: #35506d;
    font-size: 10px;
  }
  .qr-wrap { text-align: center; }
  .qr-wrap img { width: 78px; height: 78px; }
  .qr-wrap span {
    display: block;
    margin-top: 2px;
    font-size: 8px;
    color: #617083;
    line-height: 1.2;
  }
  .title-bar {
    background: #0b2e59;
    color: #fff;
    text-align: center;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 8px 10px;
    font-size: 12px;
    margin-bottom: 8px;
  }
  .meta {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
    border: 1px solid #c9d3df;
    background: #eef2f6;
    margin-bottom: 10px;
  }
  .meta div {
    padding: 7px 8px;
    border-right: 1px solid #c9d3df;
  }
  .meta div:last-child { border-right: 0; }
  .meta label {
    display: block;
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #617083;
    margin-bottom: 2px;
  }
  .meta strong { color: #0b2e59; font-size: 11px; }
  .profile {
    display: grid;
    grid-template-columns: 92px 1fr;
    gap: 10px;
    border: 1px solid #c9d3df;
    padding: 8px;
    margin-bottom: 10px;
  }
  .photo {
    width: 84px;
    height: 100px;
    object-fit: cover;
    border: 1px solid #b7c4d3;
    background: #f3f6f9;
  }
  .photo-fallback {
    width: 84px;
    height: 100px;
    border: 1px solid #b7c4d3;
    background: #f3f6f9;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #90a0b2;
    font-size: 9px;
    text-align: center;
    padding: 6px;
  }
  .profile h2 {
    margin: 0 0 6px;
    color: #0b2e59;
    font-size: 11px;
    letter-spacing: 0.05em;
  }
  .profile-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 14px;
  }
  .profile-grid div span {
    display: block;
    font-size: 8.5px;
    color: #617083;
    text-transform: uppercase;
  }
  .section { margin-bottom: 8px; }
  .section-title {
    background: #0b2e59;
    color: #fff;
    font-weight: 700;
    padding: 5px 8px;
    font-size: 10.5px;
    letter-spacing: 0.03em;
  }
  table.fields {
    width: 100%;
    border-collapse: collapse;
  }
  table.fields th,
  table.fields td {
    border: 1px solid #c9d3df;
    padding: 5px 7px;
    vertical-align: top;
    text-align: left;
  }
  table.fields th {
    width: 28%;
    background: #f7f9fb;
    color: #35506d;
    font-weight: 600;
    font-size: 10px;
  }
  .triple {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 8px 0;
  }
  .triple .box {
    border: 1px solid #c9d3df;
    min-height: 54px;
    padding: 7px;
    text-align: center;
  }
  .triple .box span {
    display: block;
    font-size: 8.5px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #617083;
    margin-bottom: 4px;
  }
  .triple .box strong {
    color: #0b2e59;
    font-size: 12px;
  }
  .declaration, .digital {
    border: 1px solid #c9d3df;
    padding: 8px 10px;
    margin-top: 10px;
  }
  .declaration h3, .digital h3 {
    margin: 0 0 6px;
    color: #0b2e59;
    font-size: 11px;
    letter-spacing: 0.04em;
  }
  .declaration p {
    margin: 0;
    color: #35506d;
    font-size: 10.5px;
    text-align: justify;
  }
  .digital-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 4px;
  }
  .signature {
    font-family: "Segoe Script", "Brush Script MT", cursive;
    font-size: 18px;
    color: #0b2e59;
    margin-top: 8px;
  }
  .note {
    margin-top: 4px;
    font-size: 8.5px;
    color: #7a8a9c;
  }
  .footer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: 1.3fr 1fr 1.2fr;
    gap: 8px;
    color: #7a8a9c;
    font-size: 8.5px;
    border-top: 1px solid #d5dde6;
    padding-top: 6px;
  }
  .footer .center { text-align: center; }
  .footer .right { text-align: right; }
</style>
</head>
<body>
  <div class="page">
    <div class="watermark">DON BOSCO COLLEGE TURA</div>
    <div class="content">
      <div class="header">
        ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="College logo" />` : '<div></div>'}
        <div class="brand">
          <h1>DON BOSCO COLLEGE, TURA</h1>
          <p>Affiliated to North Eastern Hill University (NEHU), Shillong</p>
          <p>Re-accredited with ‘B’ Grade by NAAC, Bangalore</p>
          <p>Academic Session ${this.escape(session)}</p>
        </div>
        <div class="qr-wrap">
          <img src="${qrSrc}" alt="Verification QR" />
          <span>Scan to Verify<br/>Application Submission</span>
        </div>
      </div>

      <div class="title-bar">FOURTH YEAR UNDERGRADUATE HONOURS PROGRAMME (NEP 2020) APPLICATION FORM</div>

      <div class="meta">
        <div><label>Application No.</label><strong>${this.escape(appNo)}</strong></div>
        <div><label>Application Date</label><strong>${this.escape(this.formatDate(row.createdAt))}</strong></div>
        <div><label>Status</label><strong>${this.escape(row.status)}</strong></div>
        <div><label>Academic Year</label><strong>${this.escape(session)}</strong></div>
      </div>

      <div class="profile">
        ${
          photoSrc
            ? `<img class="photo" src="${photoSrc}" alt="Applicant photograph" />`
            : `<div class="photo-fallback">Photograph<br/>not available</div>`
        }
        <div>
          <h2>CANDIDATE PROFILE</h2>
          <div class="profile-grid">
            <div><span>Candidate Name</span><strong>${this.escape(row.fullName)}</strong></div>
            <div><span>Date of Birth</span><strong>${this.escape(dob)}</strong></div>
            <div><span>Email</span><strong>${this.escape(row.email)}</strong></div>
            <div><span>Gender</span><strong>${this.escape(row.gender)}</strong></div>
            <div><span>Mobile</span><strong>${this.escape(row.mobile)}</strong></div>
            <div><span>State</span><strong>${this.escape(row.state)}</strong></div>
          </div>
        </div>
      </div>

      <section class="section">
        <div class="section-title">SECTION A: PERSONAL INFORMATION</div>
        <table class="fields">
          <tr><th>Full Name</th><td>${this.escape(row.fullName)}</td></tr>
          <tr><th>Gender</th><td>${this.escape(row.gender)}</td></tr>
          <tr><th>Date of Birth</th><td>${this.escape(dob)}</td></tr>
          <tr><th>Mobile Number</th><td>${this.escape(row.mobile)}</td></tr>
          <tr><th>WhatsApp Number</th><td>${this.escape(dash(row.whatsapp))}</td></tr>
          <tr><th>Email Address</th><td>${this.escape(row.email)}</td></tr>
          <tr><th>State</th><td>${this.escape(row.state)}</td></tr>
        </table>
      </section>

      <section class="section">
        <div class="section-title">SECTION B: PARENT / GUARDIAN DETAILS</div>
        <table class="fields">
          <tr><th>Father's Name</th><td>${this.escape(row.fatherName)}</td></tr>
          <tr><th>Father's Mobile</th><td>${this.escape(row.fatherMobile)}</td></tr>
          <tr><th>Mother's Name</th><td>${this.escape(row.motherName)}</td></tr>
          <tr><th>Mother's Mobile</th><td>${this.escape(row.motherMobile)}</td></tr>
        </table>
      </section>

      <section class="section">
        <div class="section-title">SECTION C: PREVIOUS COLLEGE DETAILS</div>
        <table class="fields">
          <tr><th>College Last Attended</th><td>${this.escape(row.collegeLastAttended)}</td></tr>
          <tr><th>Affiliated University</th><td>${this.escape(row.affiliatedUniversity)}</td></tr>
        </table>
      </section>

      <section class="section">
        <div class="section-title">SECTION D: ACADEMIC INFORMATION</div>
      </section>
    </div>
    <div class="footer">
      <div>Don Bosco College, Tura<br/>https://donboscocollege.ac.in · FYUG Honours Application Portal</div>
      <div class="center">Page 1 of 2<br/>System Generated Document</div>
      <div class="right">Generated on ${this.escape(generated)}</div>
    </div>
  </div>

  <div class="page">
    <div class="watermark">DON BOSCO COLLEGE TURA</div>
    <div class="content">
      <div class="triple">
        <div class="box"><span>Major</span><strong>${this.escape(row.majorCourse)}</strong></div>
        <div class="box"><span>Minor</span><strong>${this.escape(row.minorCourse)}</strong></div>
        <div class="box"><span>Honours Applied</span><strong>${this.escape(row.applyingHonoursIn)}</strong></div>
      </div>

      <table class="fields">
        <tr><th>CUET 2026 Score</th><td>${this.escape(dash(row.cuetScore))}</td></tr>
        <tr><th>CGPA till Semester V</th><td>${this.escape(dash(row.cgpaSemesterV))}</td></tr>
        <tr><th>Percentage till Semester V</th><td>${this.escape(dash(row.percentageSemesterV))}</td></tr>
      </table>

      <section class="section" style="margin-top:10px">
        <div class="section-title">SECTION E: BACK PAPERS (SEMESTER I - V)</div>
        <table class="fields">
          <tr>
            <th>Any Back Papers?</th>
            <td>${row.hasBackPapers ? `Yes${row.backPaperDetails ? ` — ${this.escape(row.backPaperDetails)}` : ''}` : 'No'}</td>
          </tr>
        </table>
      </section>

      <div class="declaration">
        <h3>DECLARATION</h3>
        <p>
          I hereby declare that the information furnished above is true and correct to the best of my knowledge
          and belief. I understand that any false information may lead to cancellation of my admission.
          I also declare that I do not have any back papers in Semesters I to V of the Four-Year Undergraduate Programme.
        </p>
      </div>

      <div class="digital">
        <h3>DIGITAL SUBMISSION</h3>
        <div class="digital-grid">
          <div>
            <strong>Submitted Digitally</strong>
            <div>Date: ${this.escape(this.formatDate(row.createdAt))}</div>
            <div>Time: ${this.escape(this.formatTime(row.createdAt))}</div>
            <div class="note">System Generated Document / No Physical Signature Required</div>
          </div>
          <div>
            <strong>Applicant Signature</strong>
            <div class="signature">${this.escape(row.signatureName || row.fullName)}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="footer">
      <div>Don Bosco College, Tura<br/>https://donboscocollege.ac.in · FYUG Honours Application Portal</div>
      <div class="center">Page 2 of 2<br/>System Generated Document / No Physical Signature Required</div>
      <div class="right">Generated on ${this.escape(generated)} · Submitted ${this.escape(submitted)}</div>
    </div>
  </div>
</body>
</html>`;
  }

  private async resolveLogoDataUri(): Promise<string | null> {
    const candidates = [
      join(process.cwd(), '../college-web/public/images/college-logo.png'),
      join(process.cwd(), '../web/public/branding/college-logo.png'),
      join(process.cwd(), 'assets/college-logo.png'),
    ];
    for (const path of candidates) {
      try {
        const buf = await readFile(path);
        return `data:image/png;base64,${buf.toString('base64')}`;
      } catch {
        // try next
      }
    }
    return null;
  }

  private async resolvePhotoDataUri(
    row: FyugInterestRecord,
  ): Promise<string | null> {
    if (row.photographKey) {
      try {
        const buf = await readFile(
          join(resolveUploadRoot(), row.photographKey),
        );
        const mime = row.photographKey.endsWith('.png')
          ? 'image/png'
          : row.photographKey.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg';
        return `data:${mime};base64,${buf.toString('base64')}`;
      } catch {
        // fall through
      }
    }
    if (row.photographUrl?.startsWith('/uploads/')) {
      try {
        const buf = await readFile(
          join(
            resolveUploadRoot(),
            row.photographUrl.replace(/^\/uploads\//, ''),
          ),
        );
        return `data:image/jpeg;base64,${buf.toString('base64')}`;
      } catch {
        // fall through
      }
    }
    if (row.photographUrl?.startsWith('http')) {
      try {
        const res = await fetch(row.photographUrl);
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        const mime = res.headers.get('content-type') || 'image/jpeg';
        return `data:${mime};base64,${buf.toString('base64')}`;
      } catch {
        return null;
      }
    }
    return null;
  }

  private formatDate(value: Date): string {
    return new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  }

  private formatTime(value: Date): string {
    return new Date(value).toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  }

  private formatDateTime(value: Date): string {
    return `${this.formatDate(value)}, ${this.formatTime(value)}`;
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
