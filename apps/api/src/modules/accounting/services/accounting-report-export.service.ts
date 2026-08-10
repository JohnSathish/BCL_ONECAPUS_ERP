import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { buildInstitutionalExcelReport } from '../../../common/reports';
import { resolvePdfImageSrcAsync } from '../../../common/uploads/pdf-asset.util';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import { PrismaService } from '../../../database/prisma.service';
import { resolveProductName } from '../../branding/branding-defaults';
import { BooksQueryDto } from '../dto/accounting.dto';
import { renderAccountingReportPdfHtml } from '../templates/accounting-report.template';
import { FinancialReportsService } from './financial-reports.service';

type ExportFormat = 'pdf' | 'xlsx';

@Injectable()
export class AccountingReportExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: FinancialReportsService,
  ) {}

  async exportTrialBalance(
    tenantId: string,
    query: BooksQueryDto,
    format: ExportFormat,
  ) {
    const data = await this.reports.trialBalance(tenantId, query);
    const ctx = await this.institutionContext(tenantId);
    const columns = [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Ledger' },
      { key: 'groupName', label: 'Group' },
      { key: 'openingDebit', label: 'Open Dr', align: 'right' as const },
      { key: 'openingCredit', label: 'Open Cr', align: 'right' as const },
      { key: 'periodDebit', label: 'Period Dr', align: 'right' as const },
      { key: 'periodCredit', label: 'Period Cr', align: 'right' as const },
      { key: 'closingDebit', label: 'Close Dr', align: 'right' as const },
      { key: 'closingCredit', label: 'Close Cr', align: 'right' as const },
    ];
    const rows = (data.rows ?? []).map((row) => ({ ...row }));
    const meta = this.baseMeta(
      ctx,
      'Trial Balance',
      '📒',
      data.financialYear?.label,
      {
        'Closing Debit': this.inr(data.totals?.closingDebit ?? 0),
        'Closing Credit': this.inr(data.totals?.closingCredit ?? 0),
        Ledgers: rows.length,
      },
      [
        { label: 'Financial Year', value: data.financialYear?.label ?? '—' },
        { label: 'Period From', value: this.dateLabel(data.fromDate) },
        { label: 'Period To', value: this.dateLabel(data.toDate) },
      ],
    );

    return this.buildExport(format, meta, columns, rows, 'trial-balance');
  }

  async exportProfitAndLoss(
    tenantId: string,
    query: BooksQueryDto,
    format: ExportFormat,
  ) {
    const data = await this.reports.profitAndLoss(tenantId, query);
    const ctx = await this.institutionContext(tenantId);
    const incomeRows = (data.income ?? []).map((row) => ({
      section: 'Income',
      groupName: row.groupName,
      amount: row.amount,
    }));
    const expenseRows = (data.expenses ?? []).map((row) => ({
      section: 'Expense',
      groupName: row.groupName,
      amount: row.amount,
    }));
    const rows = [...incomeRows, ...expenseRows];
    const columns = [
      { key: 'section', label: 'Section' },
      { key: 'groupName', label: 'Account Group' },
      { key: 'amount', label: 'Amount', align: 'right' as const },
    ];
    const meta = this.baseMeta(
      ctx,
      'Profit & Loss Statement',
      '📈',
      data.financialYear?.label,
      {
        'Total Income': this.inr(data.totalIncome ?? 0),
        'Total Expenses': this.inr(data.totalExpenses ?? 0),
        [data.resultLabel ?? 'Net Result']: this.inr(data.netProfit ?? 0),
      },
      [
        { label: 'Financial Year', value: data.financialYear?.label ?? '—' },
        { label: 'Period From', value: this.dateLabel(data.fromDate) },
        { label: 'Period To', value: this.dateLabel(data.toDate) },
      ],
    );

    return this.buildExport(format, meta, columns, rows, 'profit-and-loss');
  }

  async exportBalanceSheet(
    tenantId: string,
    query: BooksQueryDto,
    format: ExportFormat,
  ) {
    const data = await this.reports.balanceSheet(tenantId, query);
    const ctx = await this.institutionContext(tenantId);
    const assetRows = (data.assets ?? []).map((row) => ({
      section: 'Assets',
      groupName: row.groupName,
      amount: row.amount,
    }));
    const liabilityRows = (data.liabilities ?? []).map((row) => ({
      section: 'Liabilities',
      groupName: row.groupName,
      amount: row.amount,
    }));
    const rows = [
      ...assetRows,
      ...liabilityRows,
      {
        section: data.surplusLabel ?? 'Surplus',
        groupName: data.surplusLabel ?? 'Surplus / Deficit',
        amount: data.surplus ?? 0,
      },
    ];
    const columns = [
      { key: 'section', label: 'Section' },
      { key: 'groupName', label: 'Account Group' },
      { key: 'amount', label: 'Amount', align: 'right' as const },
    ];
    const meta = this.baseMeta(
      ctx,
      'Balance Sheet',
      '⚖️',
      data.financialYear?.label,
      {
        'Total Assets': this.inr(data.totalAssets ?? 0),
        'Liabilities & Surplus': this.inr(data.totalLiabilitiesAndSurplus ?? 0),
        Status: data.balanced ? 'Balanced' : 'Review Required',
      },
      [
        { label: 'Financial Year', value: data.financialYear?.label ?? '—' },
        { label: 'As On', value: this.dateLabel(data.toDate) },
      ],
    );

    return this.buildExport(format, meta, columns, rows, 'balance-sheet');
  }

  private async buildExport(
    format: ExportFormat,
    meta: ReturnType<AccountingReportExportService['baseMeta']>,
    columns: Array<{
      key: string;
      label: string;
      align?: 'left' | 'center' | 'right';
    }>,
    rows: Array<Record<string, unknown>>,
    filenameBase: string,
  ) {
    if (format === 'xlsx') {
      const built = await buildInstitutionalExcelReport({
        meta: {
          institutionName: meta.institutionName,
          institutionTagline: meta.institutionTagline,
          productName: meta.productName,
          reportTitle: meta.reportTitle,
          reportIcon: meta.reportIcon,
          academicYear: meta.academicYear,
          filterLines: meta.filterLines,
          summary: meta.summary,
          generatedAt: meta.generatedAt,
        },
        sheets: [{ name: meta.reportTitle, columns, rows }],
        filenameBase,
      });
      return {
        format: 'xlsx' as const,
        buffer: built.buffer,
        filename: built.filename,
      };
    }

    const html = renderAccountingReportPdfHtml({
      institutionName: meta.institutionName,
      institutionTagline: meta.institutionTagline,
      productName: meta.productName,
      reportTitle: meta.reportTitle,
      reportIcon: meta.reportIcon,
      logoDataUri: meta.logoDataUri,
      primaryColor: meta.primaryColor,
      generatedAt: meta.generatedAt,
      filterLines: meta.filterLines,
      summary: meta.summary,
      columns,
      rows,
    });
    const buffer = await this.renderPdf(html);
    return {
      format: 'pdf' as const,
      buffer,
      filename: `${filenameBase}.pdf`,
    };
  }

  private baseMeta(
    ctx: Awaited<
      ReturnType<AccountingReportExportService['institutionContext']>
    >,
    reportTitle: string,
    reportIcon: string,
    academicYear: string | undefined,
    summary: Record<string, string | number>,
    filterLines: Array<{ label: string; value: string }>,
  ) {
    return {
      institutionName: ctx.institutionName,
      institutionTagline: ctx.institutionTagline,
      productName: ctx.productName,
      reportTitle,
      reportIcon,
      academicYear,
      summary,
      filterLines,
      logoDataUri: ctx.logoDataUri,
      primaryColor: ctx.primaryColor,
      generatedAt: new Date(),
    };
  }

  private async institutionContext(tenantId: string) {
    const [tenant, branding] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
      this.prisma.tenantBranding.findUnique({ where: { tenantId } }),
    ]);
    const logoUrl = branding?.logoUrl
      ? (toPublicUploadUrl(branding.logoUrl) ?? branding.logoUrl)
      : null;
    const logoDataUri = await resolvePdfImageSrcAsync(logoUrl);
    return {
      institutionName: branding?.displayName ?? tenant?.name ?? 'Institution',
      institutionTagline:
        branding?.portalSubtitle ??
        branding?.campusName ??
        'Affiliated Institution · Meghalaya',
      productName: resolveProductName(branding?.productName),
      logoDataUri,
      primaryColor: branding?.primaryColor ?? '#1e3a8a',
    };
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
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      const pdf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private inr(value: number) {
    return `₹${Number(value || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private dateLabel(value?: string | Date | null) {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
