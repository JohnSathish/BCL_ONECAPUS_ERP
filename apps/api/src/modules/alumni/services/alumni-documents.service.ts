import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import QRCode from 'qrcode';
import { PrismaService } from '../../../database/prisma.service';
import { resolvePdfImageSrcAsync } from '../../../common/uploads/pdf-asset.util';

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inr(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

@Injectable()
export class AlumniDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPaymentReceiptPdf(
    tenantId: string,
    input: { alumniId: string; paymentId: string; paymentToken: string },
  ) {
    const payment = await this.requirePaidPayment(tenantId, input);
    return this.renderReceiptForPayment(tenantId, payment);
  }

  async getAdminPaymentReceiptPdf(
    tenantId: string,
    alumniId: string,
    paymentId: string,
  ) {
    const payment = await this.prisma.alumniPayment.findFirst({
      where: { id: paymentId, tenantId, alumniId, status: 'PAID' },
    });
    if (!payment) throw new NotFoundException('Paid payment not found');
    return this.renderReceiptForPayment(tenantId, payment);
  }

  private async renderReceiptForPayment(
    tenantId: string,
    payment: {
      id: string;
      alumniId: string;
      receiptNumber: string | null;
      paidAt: Date | null;
      updatedAt: Date;
      amountPaise: number;
      gateway: string | null;
      gatewayPaymentId: string | null;
      gatewayOrderId: string | null;
    },
  ) {
    const alumni = await this.prisma.alumniProfile.findFirst({
      where: { id: payment.alumniId, tenantId },
      include: {
        memberships: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { membershipType: true },
        },
      },
    });
    if (!alumni) throw new NotFoundException('Alumni registration not found');

    const branding = await this.resolveBranding(tenantId);
    const membership = alumni.memberships[0];
    const html = this.buildReceiptHtml({
      collegeName: branding.collegeName,
      associationName: branding.associationName,
      address: branding.address,
      logoSrc: branding.logoSrc,
      receiptNumber:
        payment.receiptNumber || `ALU-RCP-${payment.id.slice(0, 8)}`,
      paidAt: payment.paidAt ?? payment.updatedAt,
      amountLabel: inr(payment.amountPaise),
      gateway: payment.gateway || 'ONLINE',
      gatewayPaymentId: payment.gatewayPaymentId,
      gatewayOrderId: payment.gatewayOrderId,
      fullName: alumni.fullName,
      email: alumni.email,
      phone: alumni.phone,
      department: alumni.department,
      graduationYear: alumni.graduationYear,
      membershipType: membership?.membershipType?.name ?? 'Membership',
      membershipNumber: alumni.membershipNumber,
      applicationRef: `ALU-${alumni.createdAt.getFullYear()}-${alumni.id.slice(0, 8).toUpperCase()}`,
    });

    return {
      buffer: await this.renderPdf(html, 'A4'),
      filename: `${payment.receiptNumber || 'alumni-receipt'}.pdf`,
    };
  }

  async getMembershipCardPdf(tenantId: string, alumniId: string) {
    const alumni = await this.prisma.alumniProfile.findFirst({
      where: { id: alumniId, tenantId },
      include: {
        memberships: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { membershipType: true },
        },
      },
    });
    if (!alumni) throw new NotFoundException('Alumni profile not found');
    if (alumni.status !== 'ACTIVE' || !alumni.membershipNumber) {
      throw new BadRequestException(
        'Membership card is available only after membership activation.',
      );
    }

    const branding = await this.resolveBranding(tenantId);
    const membership = alumni.memberships[0];
    const photoSrc = await resolvePdfImageSrcAsync(alumni.photoUrl);
    const qrPayload = JSON.stringify({
      type: 'ALUMNI_MEMBERSHIP',
      membershipNumber: alumni.membershipNumber,
      alumniId: alumni.id,
      name: alumni.fullName,
    });
    let qrSrc: string | null = null;
    try {
      qrSrc = await QRCode.toDataURL(qrPayload, {
        margin: 1,
        width: 160,
        errorCorrectionLevel: 'M',
      });
    } catch {
      qrSrc = null;
    }

    const html = this.buildMembershipCardHtml({
      collegeName: branding.collegeName,
      associationName: branding.associationName,
      logoSrc: branding.logoSrc,
      photoSrc,
      qrSrc,
      fullName: alumni.fullName,
      membershipNumber: alumni.membershipNumber,
      membershipType: membership?.membershipType?.name ?? 'Member',
      department: alumni.department,
      graduationYear: alumni.graduationYear,
      activatedAt: alumni.activatedAt,
      validUntil: membership?.expiresAt ?? null,
      isLifetime: membership?.membershipType?.isLifetime ?? false,
    });

    return {
      buffer: await this.renderPdf(html, {
        width: '86mm',
        height: '54mm',
      }),
      filename: `alumni-card-${alumni.membershipNumber}.pdf`,
    };
  }

  private async requirePaidPayment(
    tenantId: string,
    input: { alumniId: string; paymentId: string; paymentToken: string },
  ) {
    const payment = await this.prisma.alumniPayment.findFirst({
      where: {
        id: input.paymentId,
        tenantId,
        alumniId: input.alumniId,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    const meta = (payment.metadata ?? {}) as { paymentToken?: string };
    if (meta.paymentToken !== input.paymentToken) {
      throw new BadRequestException('Invalid payment token');
    }
    if (payment.status !== 'PAID') {
      throw new BadRequestException(
        'Payment receipt is available after successful payment',
      );
    }
    return payment;
  }

  private async resolveBranding(tenantId: string) {
    const [settings, branding] = await Promise.all([
      this.prisma.alumniAssociationSettings.findUnique({ where: { tenantId } }),
      this.prisma.tenantBranding.findUnique({
        where: { tenantId },
        select: { displayName: true, address: true, logoUrl: true },
      }),
    ]);

    const collegeName =
      branding?.displayName?.trim() || 'Don Bosco College Tura';
    const associationName =
      settings?.associationName?.trim() || 'Alumni Association';
    const logoUrl =
      settings?.logoUrl || branding?.logoUrl || '/branding/college-logo.png';

    return {
      collegeName,
      associationName,
      address:
        settings?.address?.trim() ||
        branding?.address?.trim() ||
        'Tura, West Garo Hills, Meghalaya',
      logoSrc: await resolvePdfImageSrcAsync(logoUrl),
    };
  }

  private buildReceiptHtml(data: {
    collegeName: string;
    associationName: string;
    address: string;
    logoSrc: string | null;
    receiptNumber: string;
    paidAt: Date;
    amountLabel: string;
    gateway: string;
    gatewayPaymentId: string | null;
    gatewayOrderId: string | null;
    fullName: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    graduationYear: number | null;
    membershipType: string;
    membershipNumber: string | null;
    applicationRef: string;
  }) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${esc(data.receiptNumber)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:28px;font-family:Georgia,'Times New Roman',serif;color:#0A2342;background:#fff}
  .sheet{max-width:720px;margin:0 auto;border:2px solid #0A2342;border-radius:12px;overflow:hidden}
  .top{display:flex;gap:16px;align-items:center;padding:20px 24px;background:linear-gradient(135deg,#0A2342,#16375f);color:#fff}
  .logo{width:64px;height:64px;border-radius:50%;background:#fff;object-fit:contain;padding:4px}
  .college{font-size:20px;font-weight:700;margin:0}
  .assoc{margin:4px 0 0;color:#F4B400;font-size:14px}
  .addr{margin:6px 0 0;font-size:11px;opacity:.85;font-family:Arial,sans-serif}
  .title{text-align:center;padding:18px 24px 8px;font-size:18px;letter-spacing:.08em;text-transform:uppercase;color:#0A2342}
  .receipt-no{text-align:center;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#0A2342}
  .badge{display:inline-block;margin-top:8px;padding:4px 10px;border-radius:999px;background:#ecfdf5;color:#166534;font-size:11px;font-family:Arial,sans-serif;font-weight:700}
  .body{padding:8px 24px 24px;font-family:Arial,sans-serif}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin-top:16px}
  .field label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}
  .field span{display:block;margin-top:2px;font-size:13px;font-weight:600;color:#0A2342}
  .amount{margin-top:18px;background:#fff8e7;border:1px solid #F4B400;border-radius:10px;padding:14px;text-align:center}
  .amount .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#92400e}
  .amount .val{font-size:28px;font-weight:700;color:#0A2342;margin-top:4px}
  .note{margin-top:16px;font-size:12px;line-height:1.55;color:#334155;background:#f8fafc;border-left:4px solid #F4B400;padding:10px 12px}
  .footer{margin-top:22px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b;text-align:center}
</style></head><body>
<div class="sheet">
  <div class="top">
    ${data.logoSrc ? `<img class="logo" src="${data.logoSrc}" alt="" />` : ''}
    <div>
      <p class="college">${esc(data.collegeName)}</p>
      <p class="assoc">${esc(data.associationName)}</p>
      <p class="addr">${esc(data.address)}</p>
    </div>
  </div>
  <div class="title">Membership Payment Receipt</div>
  <div class="receipt-no">${esc(data.receiptNumber)}</div>
  <div style="text-align:center"><span class="badge">PAYMENT SUCCESSFUL</span></div>
  <div class="body">
    <div class="grid">
      <div class="field"><label>Received From</label><span>${esc(data.fullName)}</span></div>
      <div class="field"><label>Payment Date</label><span>${esc(fmtDateTime(data.paidAt))}</span></div>
      <div class="field"><label>Email</label><span>${esc(data.email || '—')}</span></div>
      <div class="field"><label>Mobile</label><span>${esc(data.phone || '—')}</span></div>
      <div class="field"><label>Department</label><span>${esc(data.department || '—')}</span></div>
      <div class="field"><label>Passing Year</label><span>${esc(data.graduationYear ?? '—')}</span></div>
      <div class="field"><label>Membership Type</label><span>${esc(data.membershipType)}</span></div>
      <div class="field"><label>Application Ref</label><span>${esc(data.applicationRef)}</span></div>
      <div class="field"><label>Payment Gateway</label><span>${esc(data.gateway)}</span></div>
      <div class="field"><label>Gateway Payment ID</label><span>${esc(data.gatewayPaymentId || '—')}</span></div>
      <div class="field"><label>Order / Reference</label><span>${esc(data.gatewayOrderId || '—')}</span></div>
      <div class="field"><label>Membership ID</label><span>${esc(data.membershipNumber || 'Pending activation')}</span></div>
    </div>
    <div class="amount">
      <div class="lbl">Amount Paid</div>
      <div class="val">${esc(data.amountLabel)}</div>
    </div>
    <div class="note">
      Received with thanks towards Alumni Association membership.
      Membership activation and digital membership card will be issued after verification by the Alumni Office.
    </div>
    <div class="footer">
      This is a computer-generated receipt of ${esc(data.collegeName)} ${esc(data.associationName)}.
      No signature is required.
    </div>
  </div>
</div>
</body></html>`;
  }

  private buildMembershipCardHtml(data: {
    collegeName: string;
    associationName: string;
    logoSrc: string | null;
    photoSrc: string | null;
    qrSrc: string | null;
    fullName: string;
    membershipNumber: string;
    membershipType: string;
    department: string | null;
    graduationYear: number | null;
    activatedAt: Date | null;
    validUntil: Date | null;
    isLifetime: boolean;
  }) {
    const validity = data.isLifetime
      ? 'Lifetime'
      : data.validUntil
        ? `Valid till ${fmtDate(data.validUntil)}`
        : 'Active';

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${esc(data.membershipNumber)}</title>
<style>
  *{box-sizing:border-box}
  @page{size:86mm 54mm;margin:0}
  body{margin:0;padding:0;width:86mm;height:54mm;font-family:Arial,sans-serif;color:#0A2342;background:#fff}
  .card{width:86mm;height:54mm;border:1.5px solid #0A2342;border-radius:4mm;overflow:hidden;position:relative;background:
    linear-gradient(135deg,rgba(10,35,66,.04),rgba(244,180,0,.08)),#fff}
  .band{height:11mm;background:#0A2342;color:#fff;display:flex;align-items:center;gap:2.5mm;padding:0 3mm}
  .logo{width:8mm;height:8mm;border-radius:50%;background:#fff;object-fit:contain;padding:.5mm}
  .titles{line-height:1.15}
  .college{font-size:7px;font-weight:700;letter-spacing:.02em}
  .assoc{font-size:6px;color:#F4B400;margin-top:.5mm}
  .body{display:grid;grid-template-columns:16mm 1fr 14mm;gap:2.5mm;padding:2.5mm 3mm 2mm}
  .photo{width:15mm;height:18mm;object-fit:cover;border-radius:1.5mm;border:1px solid #cbd5e1;background:#e2e8f0}
  .photo-ph{width:15mm;height:18mm;border-radius:1.5mm;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:8px;color:#64748b}
  .name{font-size:10px;font-weight:700;margin:0 0 1mm}
  .meta{font-size:6.5px;line-height:1.35;color:#334155}
  .id{margin-top:1.5mm;font-size:7.5px;font-weight:700;color:#0A2342}
  .gold{color:#b45309}
  .qr{width:13mm;height:13mm;object-fit:contain}
  .footer{position:absolute;left:0;right:0;bottom:0;height:5mm;background:#F4B400;color:#0A2342;display:flex;align-items:center;justify-content:space-between;padding:0 3mm;font-size:6px;font-weight:700}
</style></head><body>
<div class="card">
  <div class="band">
    ${data.logoSrc ? `<img class="logo" src="${data.logoSrc}" alt="" />` : ''}
    <div class="titles">
      <div class="college">${esc(data.collegeName)}</div>
      <div class="assoc">${esc(data.associationName)} · Membership Card</div>
    </div>
  </div>
  <div class="body">
    ${
      data.photoSrc
        ? `<img class="photo" src="${data.photoSrc}" alt="" />`
        : `<div class="photo-ph">PHOTO</div>`
    }
    <div>
      <p class="name">${esc(data.fullName)}</p>
      <div class="meta">${esc(data.membershipType)}</div>
      <div class="meta">${esc(data.department || '—')} · ${esc(data.graduationYear ?? '—')}</div>
      <div class="meta">Activated ${esc(fmtDate(data.activatedAt))}</div>
      <div class="id">ID: <span class="gold">${esc(data.membershipNumber)}</span></div>
    </div>
    ${data.qrSrc ? `<img class="qr" src="${data.qrSrc}" alt="" />` : '<div></div>'}
  </div>
  <div class="footer">
    <span>Digital Membership Card</span>
    <span>${esc(validity)}</span>
  </div>
</div>
</body></html>`;
  }

  private async renderPdf(
    html: string,
    format: 'A4' | { width: string; height: string },
  ) {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdfOptions =
        format === 'A4'
          ? {
              format: 'A4' as const,
              printBackground: true,
              margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
            }
          : {
              width: format.width,
              height: format.height,
              printBackground: true,
              margin: { top: '0', right: '0', bottom: '0', left: '0' },
            };
      return Buffer.from(await page.pdf(pdfOptions));
    } finally {
      await browser.close();
    }
  }
}
