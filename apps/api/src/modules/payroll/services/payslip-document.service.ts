import { existsSync } from 'fs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';
import { pathToFileURL } from 'url';
import puppeteer from 'puppeteer';
import { PrismaService } from '../../../database/prisma.service';

type SignatorySlot = {
  label?: string;
  designation?: string;
  name?: string;
  imageUrl?: string;
};

type PayslipHeaderConfig = {
  institutionName?: string;
  addressLine?: string;
  affiliationLine?: string;
  accreditationLine?: string;
  signatoryLabel?: string;
  signatoryTitle?: string;
  signatoryName?: string;
  signatoryImageUrl?: string;
  websiteUrl?: string;
  signatories?: {
    prepared?: SignatorySlot;
    verified?: SignatorySlot;
    approved?: SignatorySlot;
  };
};

type PayslipInstitutionHeader = {
  name: string;
  addressLine: string | null;
  affiliationLine: string | null;
  accreditationLine: string | null;
  logoSrc: string | null;
  logoPlaceholder: string | null;
  websiteUrl: string;
  footer: string;
  signatories: {
    prepared: SignatorySlot & { imageSrc: string | null };
    verified: SignatorySlot & { imageSrc: string | null };
    approved: SignatorySlot & { imageSrc: string | null };
  };
};

@Injectable()
export class PayslipDocumentService {
  private uploadRoot = resolveTenantUploadRoot();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async generatePdf(tenantId: string, payslipId: string): Promise<string> {
    const html = await this.buildFullHtml(tenantId, payslipId);

    const dir = join(this.uploadRoot, tenantId, 'payslips');
    await mkdir(dir, { recursive: true });
    const filename = `${payslipId}.pdf`;
    const absPath = join(dir, filename);
    const publicPath = `/uploads/tenants/${tenantId}/payslips/${filename}`;

    await this.renderPdf(html, absPath);
    await this.prisma.payslip.update({
      where: { id: payslipId },
      data: { pdfPath: publicPath },
    });
    return publicPath;
  }

  async readPdfBuffer(tenantId: string, payslipId: string): Promise<Buffer> {
    const publicPath = await this.generatePdf(tenantId, payslipId);
    const { readFile } = await import('fs/promises');
    return readFile(join(process.cwd(), publicPath.replace(/^\//, '')));
  }

  async generateMergedPdf(
    tenantId: string,
    payslipIds: string[],
  ): Promise<Buffer> {
    const sheets: string[] = [];
    for (const id of payslipIds) {
      const html = await this.buildFullHtml(tenantId, id);
      const match = html.match(
        /<div class="sheet">[\s\S]*?<\/div>\s*(?=<\/body>)/,
      );
      if (match) sheets.push(`${match[0]}<div class="page-break"></div>`);
    }
    if (!sheets.length)
      throw new NotFoundException('No payslip content to merge');
    const sampleHtml = await this.buildFullHtml(tenantId, payslipIds[0]);
    const styleMatch =
      sampleHtml.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    const merged = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${styleMatch}.page-break{page-break-after:always;height:0}</style></head><body>${sheets.join('')}</body></html>`;
    return this.renderPdfBuffer(merged);
  }

  async generateSalaryCertificatePdf(
    tenantId: string,
    staffProfileId: string,
    bounds: {
      fromMonth: number;
      fromYear: number;
      toMonth: number;
      toYear: number;
    },
  ): Promise<Buffer> {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId },
      select: {
        fullName: true,
        employeeCode: true,
        photoUrl: true,
        bankName: true,
        accountNumber: true,
        department: { select: { name: true } },
        designation: { select: { label: true } },
      },
    });
    if (!staff) throw new NotFoundException('Staff not found');

    const months: Array<{ month: number; year: number }> = [];
    let y = bounds.fromYear;
    let m = bounds.fromMonth;
    const endKey = bounds.toYear * 100 + bounds.toMonth;
    while (y * 100 + m <= endKey) {
      months.push({ month: m, year: y });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }

    const payslips = await this.prisma.payslip.findMany({
      where: {
        tenantId,
        staffProfileId,
        OR: months.map((k) => ({ month: k.month, year: k.year })),
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    const grossTotal = payslips.reduce((s, p) => s + Number(p.grossSalary), 0);
    const netTotal = payslips.reduce((s, p) => s + Number(p.netSalary), 0);
    const fyLabel = `FY ${bounds.fromYear}-${String(bounds.toYear).slice(-2)}`;
    const header = await this.resolveInstitutionHeader(tenantId);
    const verifyBase = (
      this.config.get<string>('APP_PUBLIC_URL') ??
      this.config.get<string>('APP_URL') ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
    const verifyUrl = `${verifyBase}/verify/payslip/${payslips[payslips.length - 1]?.verifyToken ?? staff.employeeCode}`;
    const photoSrc = this.resolveLogoSrc(staff.photoUrl);
    const logoBlock = header.logoSrc
      ? `<img class="logo" src="${header.logoSrc}" alt="" />`
      : header.logoPlaceholder
        ? `<div class="logo-placeholder">${header.logoPlaceholder}</div>`
        : '';
    const photoBlock = photoSrc
      ? `<img class="emp-photo" src="${photoSrc}" alt="" />`
      : `<div class="emp-photo-placeholder">${staff.fullName
          .split(' ')
          .map((w) => w[0])
          .slice(0, 2)
          .join('')}</div>`;

    const rows = payslips
      .map((p) => {
        const mn = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ][p.month - 1];
        return `<tr><td>${mn} ${p.year}</td><td class="amt">₹${Number(p.grossSalary).toLocaleString('en-IN')}</td><td class="amt">₹${Number(p.netSalary).toLocaleString('en-IN')}</td></tr>`;
      })
      .join('');

    const sig = (slot: SignatorySlot & { imageSrc: string | null }) => `
      <div class="sig-slot">
        ${slot.imageSrc ? `<img class="sig-img" src="${slot.imageSrc}" alt="" />` : '<div class="sig-space"></div>'}
        <div class="sig-line">${slot.name || '&nbsp;'}</div>
        <p class="sig-designation">${slot.designation ?? ''}</p>
      </div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:32px;color:#111}
      .cert{max-width:720px;margin:0 auto;border:2px solid #1e3a5f;padding:28px}
      .header{display:grid;grid-template-columns:84px 1fr;gap:12px;border-bottom:2px solid #1e3a5f;padding-bottom:14px;margin-bottom:18px}
      .logo{width:72px;height:72px;object-fit:contain}
      .logo-placeholder{width:72px;height:72px;border:1px solid #cbd5e1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#64748b;text-align:center;padding:4px}
      .inst-name{font-size:17px;font-weight:700;color:#1e3a5f;margin:0;text-transform:uppercase}
      .inst-line{font-size:10px;color:#475569;margin:2px 0}
      .title{text-align:center;font-size:18px;font-weight:700;letter-spacing:1px;color:#1e3a5f;margin:16px 0;text-transform:uppercase}
      .emp{display:grid;grid-template-columns:64px 1fr;gap:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px}
      .emp-photo{width:64px;height:64px;border-radius:8px;object-fit:cover}
      .emp-photo-placeholder{width:64px;height:64px;border-radius:8px;background:#1e3a5f;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th,td{border:1px solid #d1d5db;padding:6px 8px;font-size:11px}
      th{background:#f1f5f9}
      td.amt{text-align:right}
      .summary{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
      .summary-box{padding:12px;border-radius:8px;text-align:center;font-weight:700}
      .gross-box{background:#dbeafe;color:#1e40af;border:1px solid #93c5fd}
      .net-box{background:#ecfdf5;color:#065f46;border:2px solid #86efac;font-size:16px}
      .sigs{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px}
      .sig-slot{text-align:center;font-size:10px}
      .sig-space{height:40px}
      .sig-img{max-height:40px;max-width:140px;object-fit:contain}
      .sig-line{border-top:1px solid #1e3a5f;padding-top:4px;font-weight:600}
      .sig-designation{color:#64748b;margin-top:2px}
      .qr{text-align:right;margin-top:16px}
      .footer{text-align:center;font-size:9px;color:#64748b;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px}
    </style></head><body>
      <div class="cert">
        <div class="header"><div>${logoBlock}</div>
          <div style="text-align:center">
            <p class="inst-name">${header.name}</p>
            ${header.addressLine ? `<p class="inst-line">${header.addressLine}</p>` : ''}
            ${header.affiliationLine ? `<p class="inst-line">${header.affiliationLine}</p>` : ''}
            ${header.accreditationLine ? `<p class="inst-line">${header.accreditationLine}</p>` : ''}
          </div>
        </div>
        <p class="title">Salary Certificate · ${fyLabel}</p>
        <div class="emp">${photoBlock}<div>
          <p style="font-weight:700;font-size:14px;margin:0 0 4px">${staff.fullName}</p>
          <p style="font-size:11px;margin:2px 0"><strong>ID:</strong> ${staff.employeeCode}</p>
          <p style="font-size:11px;margin:2px 0"><strong>Designation:</strong> ${staff.designation?.label ?? '—'}</p>
          <p style="font-size:11px;margin:2px 0"><strong>Department:</strong> ${staff.department?.name ?? '—'}</p>
        </div></div>
        <p style="font-size:12px;line-height:1.6;text-align:justify">This certifies that <strong>${staff.fullName}</strong> received salary for <strong>${payslips.length}</strong> month(s) during ${fyLabel}.</p>
        <table><tr><th>Period</th><th class="amt">Gross (₹)</th><th class="amt">Net (₹)</th></tr>${rows || '<tr><td colspan="3">No records.</td></tr>'}</table>
        <div class="summary">
          <div class="summary-box gross-box">Total Gross<br/>₹${grossTotal.toLocaleString('en-IN')}</div>
          <div class="summary-box net-box">Total Net<br/>₹${netTotal.toLocaleString('en-IN')}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;align-items:end">
          <div class="sigs">${sig(header.signatories.verified)}${sig(header.signatories.approved)}</div>
          <div class="qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(verifyUrl)}" width="72" height="72"/><p style="font-size:9px;color:#64748b">Scan to Verify</p></div>
        </div>
        <p class="footer"><strong>Generated by OneCampus ERP</strong><br/>${header.footer}</p>
      </div>
    </body></html>`;
    return this.renderPdfBuffer(html);
  }

  private async buildFullHtml(
    tenantId: string,
    payslipId: string,
  ): Promise<string> {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, tenantId },
      include: {
        staffProfile: {
          select: {
            fullName: true,
            employeeCode: true,
            photoUrl: true,
            bankName: true,
            accountNumber: true,
            ifsc: true,
            department: { select: { name: true } },
            designation: { select: { label: true } },
          },
        },
        lines: { orderBy: { sortOrder: 'asc' } },
        payrollRun: true,
        loanInstallments: {
          include: {
            staffLoan: {
              select: {
                loanNumber: true,
                principalAmount: true,
                balanceAmount: true,
                paidInstallments: true,
                totalInstallments: true,
              },
            },
          },
        },
      },
    });
    if (!payslip) throw new NotFoundException('Payslip not found');

    const activeLoans = await this.prisma.staffLoan.findMany({
      where: {
        tenantId,
        staffProfileId: payslip.staffProfileId,
        status: 'ACTIVE',
      },
      select: {
        loanNumber: true,
        principalAmount: true,
        balanceAmount: true,
        paidInstallments: true,
        totalInstallments: true,
      },
      take: 3,
    });

    const header = await this.resolveInstitutionHeader(tenantId);
    const verifyBase = (
      this.config.get<string>('APP_PUBLIC_URL') ??
      this.config.get<string>('APP_URL') ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
    return this.buildHtml(payslip, header, activeLoans, verifyBase);
  }

  private async resolveInstitutionHeader(
    tenantId: string,
  ): Promise<PayslipInstitutionHeader> {
    const [tenant, branding, settings] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      this.prisma.tenantBranding.findUnique({
        where: { tenantId },
        select: {
          displayName: true,
          address: true,
          badges: true,
          logoUrl: true,
        },
      }),
      this.prisma.payrollSettings.findUnique({
        where: { tenantId },
        select: { logoUrl: true, payslipFooter: true, exportLayouts: true },
      }),
    ]);

    const customHeader = (
      settings?.exportLayouts as Record<string, unknown> | null
    )?._payslipHeader as PayslipHeaderConfig | undefined;

    const badges = Array.isArray(branding?.badges)
      ? (branding!.badges as string[])
      : [];
    const displayName = branding?.displayName ?? tenant?.name ?? 'Institution';

    let addressLine = customHeader?.addressLine ?? branding?.address ?? null;
    if (addressLine && !/794002/.test(addressLine)) {
      addressLine = addressLine.replace(/\s*–?\s*794002\s*$/, '').trim();
      addressLine = `${addressLine} – 794002`;
    }

    const affiliationLine =
      customHeader?.affiliationLine ??
      badges.find((b) => /affiliated|nehu/i.test(b)) ??
      (/don bosco/i.test(displayName) ? 'Affiliated to NEHU, Shillong' : null);

    const accreditationLine =
      customHeader?.accreditationLine ??
      badges.find((b) => /naac/i.test(b)) ??
      (/don bosco/i.test(displayName) ? 'NAAC Accredited' : null);

    const logoUrl = settings?.logoUrl ?? branding?.logoUrl ?? null;
    const isDbc =
      /don bosco/i.test(displayName) ||
      /don bosco/i.test(customHeader?.institutionName ?? '');

    const slot = (
      key: 'prepared' | 'verified' | 'approved',
      defaults: SignatorySlot,
    ): SignatorySlot & { imageSrc: string | null } => {
      const cfg = customHeader?.signatories?.[key] ?? {};
      const legacy =
        key === 'prepared'
          ? {
              name: customHeader?.signatoryName,
              designation: customHeader?.signatoryTitle,
              label: customHeader?.signatoryLabel,
              imageUrl: customHeader?.signatoryImageUrl,
            }
          : {};
      const merged = { ...defaults, ...legacy, ...cfg };
      return { ...merged, imageSrc: this.resolveLogoSrc(merged.imageUrl) };
    };

    return {
      name: (customHeader?.institutionName ?? displayName).toUpperCase(),
      addressLine,
      affiliationLine,
      accreditationLine,
      logoSrc: this.resolveLogoSrc(logoUrl),
      logoPlaceholder: isDbc
        ? 'Don Bosco<br/>College Tura'
        : displayName.split(' ').slice(0, 2).join('<br/>') || null,
      websiteUrl:
        customHeader?.websiteUrl ??
        (isDbc ? 'https://erp.donboscocollege.ac.in' : ''),
      footer:
        settings?.payslipFooter ??
        'This is a computer-generated payslip. For queries contact the Accounts Office.',
      signatories: {
        prepared: slot('prepared', {
          label: 'Prepared By',
          designation: 'Accounts Officer',
          name: '',
        }),
        verified: slot('verified', {
          label: 'Verified By',
          designation: 'Administrative Officer',
          name: '',
        }),
        approved: slot('approved', {
          label: 'Approved By',
          designation: 'Principal',
          name: '',
        }),
      },
    };
  }

  private resolveLogoSrc(logoUrl?: string | null): string | null {
    return this.resolveAssetSrc(logoUrl);
  }

  /** Resolve asset for Puppeteer — only return URLs that can actually be loaded. */
  private resolveAssetSrc(assetUrl?: string | null): string | null {
    if (!assetUrl) return null;
    if (assetUrl.startsWith('http://') || assetUrl.startsWith('https://'))
      return assetUrl;
    if (assetUrl.startsWith('/uploads/') || assetUrl.startsWith('/branding/')) {
      const candidates = [
        join(process.cwd(), assetUrl.replace(/^\//, '')),
        join(process.cwd(), '..', 'web', 'public', assetUrl.replace(/^\//, '')),
      ];
      for (const absolute of candidates) {
        if (existsSync(absolute)) return pathToFileURL(absolute).href;
      }
      return null;
    }
    return null;
  }

  private buildHtml(
    payslip: {
      month: number;
      year: number;
      payScaleType: string;
      grossSalary: unknown;
      totalDeductions: unknown;
      netSalary: unknown;
      verifyToken: string | null;
      staffProfile: {
        fullName: string;
        employeeCode: string;
        photoUrl: string | null;
        bankName: string | null;
        accountNumber: string | null;
        ifsc: string | null;
        department: { name: string } | null;
        designation: { label: string } | null;
      };
      lines: Array<{
        componentName: string;
        componentType: string;
        componentCode?: string;
        amount: unknown;
      }>;
      loanInstallments: Array<{
        recoveredAmount: unknown;
        staffLoan: {
          loanNumber: string;
          principalAmount: unknown;
          balanceAmount: unknown;
          paidInstallments: number;
          totalInstallments: number;
        };
      }>;
    },
    institution: PayslipInstitutionHeader,
    activeLoans: Array<{
      loanNumber: string;
      principalAmount: unknown;
      balanceAmount: unknown;
      paidInstallments: number;
      totalInstallments: number;
    }>,
    verifyBase: string,
  ) {
    const earnings = payslip.lines.filter((l) => l.componentType === 'EARNING');
    const deductions = payslip.lines.filter(
      (l) => l.componentType === 'DEDUCTION',
    );
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const periodLabel = `${monthNames[payslip.month - 1]} ${payslip.year}`;

    const pfEmployer = payslip.lines.find(
      (l) => l.componentCode === 'PF_EMPLOYER',
    );
    const pfEmployee = payslip.lines.find(
      (l) => l.componentCode === 'PF_EMPLOYEE',
    );
    const ppf = payslip.lines.find((l) => l.componentCode === 'PPF');
    const employerAmt = pfEmployer ? Number(pfEmployer.amount) : 0;
    const employeeAmt = pfEmployee
      ? Number(pfEmployee.amount)
      : ppf && employerAmt > 0
        ? Number(ppf.amount) - employerAmt
        : ppf
          ? Number(ppf.amount) / 2
          : 0;

    const photoSrc = this.resolveAssetSrc(payslip.staffProfile.photoUrl);
    const bankLine =
      [
        payslip.staffProfile.bankName,
        payslip.staffProfile.accountNumber,
        payslip.staffProfile.ifsc,
      ]
        .filter(Boolean)
        .join(' · ') || '—';

    const loanRows =
      activeLoans.length > 0
        ? activeLoans
            .map((loan) => {
              const recovered =
                Number(loan.principalAmount) - Number(loan.balanceAmount);
              return `<tr>
            <td>${loan.loanNumber}</td>
            <td class="amt">₹${Number(loan.principalAmount).toLocaleString('en-IN')}</td>
            <td class="amt">₹${recovered.toLocaleString('en-IN')}</td>
            <td class="amt">₹${Number(loan.balanceAmount).toLocaleString('en-IN')}</td>
          </tr>`;
            })
            .join('')
        : '';

    const loanSection = activeLoans.length
      ? `<div class="section"><h3 class="section-title loan-title">Loan Recovery</h3>
        <table><tr><th>Loan No.</th><th class="amt">Loan Amount</th><th class="amt">Recovered</th><th class="amt">Outstanding</th></tr>${loanRows}</table></div>`
      : '';

    const pfSection =
      employerAmt > 0 || employeeAmt > 0
        ? `<div class="section"><h3 class="section-title pf-title">Provident Fund Summary</h3>
        <table class="pf-table">
          <tr><td>Employer Contribution</td><td class="amt">₹${employerAmt.toLocaleString('en-IN')}</td></tr>
          <tr><td>Employee Contribution</td><td class="amt">₹${employeeAmt.toLocaleString('en-IN')}</td></tr>
          <tr><td><strong>Total PF</strong></td><td class="amt"><strong>₹${(employerAmt + employeeAmt).toLocaleString('en-IN')}</strong></td></tr>
        </table></div>`
        : '';

    const verifyUrl = payslip.verifyToken
      ? `${verifyBase}/verify/payslip/${payslip.verifyToken}`
      : null;
    const qrHtml = verifyUrl
      ? `<div class="qr-block">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(verifyUrl)}" alt="QR" width="80" height="80"/>
          <p class="qr-label">Scan to Verify Payslip</p>
        </div>`
      : '';

    const metaLines = [
      institution.addressLine,
      institution.affiliationLine,
      institution.accreditationLine,
    ]
      .filter(Boolean)
      .map((line) => `<p class="inst-line">${line}</p>`)
      .join('');

    const logoBlock = institution.logoSrc
      ? `<img class="logo" src="${institution.logoSrc}" alt="" />`
      : institution.logoPlaceholder
        ? `<div class="logo-placeholder">${institution.logoPlaceholder}</div>`
        : '';

    const photoBlock = photoSrc
      ? `<img class="emp-photo" src="${photoSrc}" alt="" />`
      : `<div class="emp-photo-placeholder">${payslip.staffProfile.fullName
          .split(' ')
          .map((w) => w[0])
          .slice(0, 2)
          .join('')}</div>`;

    const sigBlock = (slot: SignatorySlot & { imageSrc: string | null }) => `
      <div class="sig-slot">
        <div class="sig-space">${slot.imageSrc ? `<img class="sig-img" src="${slot.imageSrc}" alt="" />` : ''}</div>
        <div class="sig-line">${slot.name || '&nbsp;'}</div>
        <p class="sig-designation">${slot.designation ?? ''}</p>
        <p class="sig-label">${slot.label ?? ''}</p>
      </div>`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}
      body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:24px;color:#111;background:#fff}
      .sheet{position:relative;max-width:760px;margin:0 auto;border:1px solid #cbd5e1;padding:22px 26px;overflow:hidden}
      .watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:700;color:rgba(30,58,95,0.05);letter-spacing:4px;transform:rotate(-24deg);pointer-events:none;z-index:0;white-space:nowrap}
      .content{position:relative;z-index:1}
      .inst-header{border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:14px}
      .inst-header-grid{display:grid;grid-template-columns:84px 1fr 130px;gap:10px;align-items:start}
      .inst-logo-cell{display:flex;justify-content:center;padding-top:2px}
      .logo{width:72px;height:72px;object-fit:contain}
      .logo-placeholder{width:72px;height:72px;border:1px solid #cbd5e1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#64748b;text-align:center;line-height:1.25;padding:4px}
      .inst-text{text-align:center;padding-top:2px}
      .inst-period{text-align:right;font-size:11px;font-weight:600;color:#334155;line-height:1.5;padding-top:8px}
      .inst-period strong{display:block;font-size:13px;color:#1e3a5f;margin-top:2px}
      .inst-name{font-size:16px;font-weight:700;letter-spacing:0.4px;margin:0 0 4px;color:#1e3a5f}
      .inst-line{font-size:10px;color:#475569;margin:2px 0;line-height:1.4}
      .doc-title{text-align:center;font-size:14px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1e3a5f;margin:14px 0 12px}
      .emp-card{display:grid;grid-template-columns:72px 1fr;gap:12px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:14px;background:#f8fafc}
      .emp-photo{width:64px;height:64px;border-radius:8px;object-fit:cover;border:1px solid #cbd5e1}
      .emp-photo-placeholder{width:64px;height:64px;border-radius:8px;background:#1e3a5f;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px}
      .emp-name{font-size:14px;font-weight:700;color:#1e293b;margin:0 0 2px}
      .emp-meta{font-size:11px;color:#475569;line-height:1.55;margin:0}
      .emp-meta span{display:inline-block;min-width:110px;color:#64748b}
      .section{margin-top:12px}
      .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 6px;padding:6px 8px;border-radius:4px}
      .earn-title{background:#dbeafe;color:#1e40af}
      .ded-title{background:#fee2e2;color:#991b1b}
      .loan-title{background:#fef3c7;color:#92400e}
      .pf-title{background:#ecfdf5;color:#065f46}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #d1d5db;padding:5px 8px;font-size:11px}
      th{background:#f8fafc;text-align:left;color:#1e293b;font-weight:600}
      td.amt{text-align:right;font-variant-numeric:tabular-nums}
      th.amt{text-align:right}
      .net-box{font-size:16px;font-weight:700;color:#065f46;margin-top:14px;padding:12px 14px;background:#ecfdf5;border:2px solid #86efac;border-radius:8px;text-align:center}
      .bottom-row{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:end;margin-top:20px}
      .signatures{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:8px}
      .sig-slot{text-align:center;font-size:10px}
      .sig-space{min-height:44px;display:flex;align-items:flex-end;justify-content:center}
      .sig-img{max-height:40px;max-width:120px;object-fit:contain}
      .sig-line{border-top:1px solid #1e3a5f;padding-top:4px;font-weight:600;color:#1e293b;min-height:18px}
      .sig-designation{color:#64748b;margin:2px 0 0;font-size:9px}
      .sig-label{font-weight:600;color:#1e3a5f;margin:4px 0 0;font-size:9px;text-transform:uppercase}
      .qr-block{text-align:center}
      .qr-label{font-size:9px;color:#64748b;margin:4px 0 0}
      .footer{margin-top:16px;font-size:9px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px;text-align:center;line-height:1.5}
      .footer strong{color:#475569}
    </style></head><body>
      <div class="sheet">
        <div class="watermark">DON BOSCO COLLEGE TURA</div>
        <div class="content">
          <div class="inst-header">
            <div class="inst-header-grid">
              <div class="inst-logo-cell">${logoBlock}</div>
              <div class="inst-text">
                <p class="inst-name">${institution.name}</p>
                ${metaLines}
              </div>
              <div class="inst-period">Salary Payslip<strong>Month: ${periodLabel}</strong></div>
            </div>
          </div>
          <p class="doc-title">Salary Payslip</p>
          <div class="emp-card">
            ${photoBlock}
            <div>
              <p class="emp-name">${payslip.staffProfile.fullName}</p>
              <p class="emp-meta"><span>Employee ID</span> ${payslip.staffProfile.employeeCode}</p>
              <p class="emp-meta"><span>Designation</span> ${payslip.staffProfile.designation?.label ?? '—'}</p>
              <p class="emp-meta"><span>Department</span> ${payslip.staffProfile.department?.name ?? '—'}</p>
              <p class="emp-meta"><span>Salary Scale</span> ${payslip.payScaleType.replace(/_/g, ' ')}</p>
              <p class="emp-meta"><span>Bank Account</span> ${bankLine}</p>
            </div>
          </div>
          <div class="section">
            <h3 class="section-title earn-title">Earnings</h3>
            <table>
              <tr><th>Component</th><th class="amt">Amount (₹)</th></tr>
              ${earnings.map((l) => `<tr><td>${l.componentName}</td><td class="amt">${Number(l.amount).toLocaleString('en-IN')}</td></tr>`).join('')}
              <tr><td><strong>Gross Salary</strong></td><td class="amt"><strong>${Number(payslip.grossSalary).toLocaleString('en-IN')}</strong></td></tr>
            </table>
          </div>
          <div class="section">
            <h3 class="section-title ded-title">Deductions</h3>
            <table>
              <tr><th>Component</th><th class="amt">Amount (₹)</th></tr>
              ${deductions.length ? deductions.map((l) => `<tr><td>${l.componentName}</td><td class="amt">${Number(l.amount).toLocaleString('en-IN')}</td></tr>`).join('') : '<tr><td colspan="2">—</td></tr>'}
              <tr><td><strong>Total Deductions</strong></td><td class="amt"><strong>${Number(payslip.totalDeductions).toLocaleString('en-IN')}</strong></td></tr>
            </table>
          </div>
          <div class="net-box">Net Salary Payable: ₹${Number(payslip.netSalary).toLocaleString('en-IN')}</div>
          ${loanSection}
          ${pfSection}
          <div class="bottom-row">
            <div class="signatures">
              ${sigBlock(institution.signatories.prepared)}
              ${sigBlock(institution.signatories.verified)}
              ${sigBlock(institution.signatories.approved)}
            </div>
            ${qrHtml}
          </div>
          <p class="footer">
            <strong>Generated by OneCampus ERP</strong><br/>
            ${institution.footer}
            ${institution.websiteUrl ? `<br/>${institution.websiteUrl}` : ''}
          </p>
        </div>
      </div>
    </body></html>`;
  }

  private async renderPdf(html: string, outputPath: string) {
    const buf = await this.renderPdfBuffer(html);
    const { writeFile } = await import('fs/promises');
    await writeFile(outputPath, buf);
  }

  private async renderPdfBuffer(html: string): Promise<Buffer> {
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
      // Allow QR code and logo images to finish loading before print.
      await new Promise((r) => setTimeout(r, 1500));
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
