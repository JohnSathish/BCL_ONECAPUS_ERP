import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import { NaacEvidenceService } from '../../naac-iqac/services/naac-evidence.service';
import type {
  LinkLibraryNaacEvidenceDto,
  NaacLibraryReportQueryDto,
} from '../dto/library.dto';
import { LibraryAnalyticsService } from './library-analytics.service';
import { LibraryReportsService } from './library-reports.service';

export type LibraryNaacBundle = {
  generatedAt: string;
  period: { from: string; to: string };
  academicYear?: string;
  summary: {
    totalTitles: number;
    totalCopies: number;
    availableCopies: number;
    digitalAssets: number;
    researchItems: number;
    activeLoans: number;
    overdueLoans: number;
  };
  footfall: {
    totalVisits: number;
    male: number;
    female: number;
    other: number;
    peakHour: number;
    peakCount: number;
  };
  booksAddedYearWise: { year: number; titles: number; copies: number }[];
  departmentUsage: {
    departmentName: string;
    visits: number;
    issues: number;
    uniqueReaders: number;
  }[];
  studentUsage: {
    uniqueStudents: number;
    totalVisits: number;
    totalIssues: number;
  };
  facultyUsage: {
    uniqueFaculty: number;
    totalVisits: number;
    totalIssues: number;
  };
  eResourceUsage: {
    digitalDownloads: number;
    digitalViews: number;
    researchAccess: number;
    topDigital: { title: string; downloads: number }[];
  };
  readingStatistics: {
    topBooks: { title: string; issueCount: number }[];
    topReaders: {
      fullName: string;
      issueCount: number;
      department?: string | null;
    }[];
  };
  expenditure: {
    finesCollected: number;
    finesWaived: number;
    bookValueOnShelf: number;
    note: string;
  };
  journalSubscriptions: {
    printJournalTitles: number;
    digitalJournalAssets: number;
    eJournalDownloads: number;
  };
};

@Injectable()
export class LibraryNaacReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: LibraryReportsService,
    private readonly analytics: LibraryAnalyticsService,
    private readonly storage: StorageService,
    private readonly naacEvidence: NaacEvidenceService,
  ) {}

  private period(query: NaacLibraryReportQueryDto) {
    const from = query.from
      ? new Date(query.from)
      : new Date(new Date().getFullYear(), 0, 1);
    const to = query.to ? new Date(query.to) : new Date();
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  async buildBundle(
    tenantId: string,
    query: NaacLibraryReportQueryDto,
  ): Promise<LibraryNaacBundle> {
    const { from, to } = this.period(query);
    const reportQuery = {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };

    const [
      genderVisits,
      peakHours,
      deptVisitors,
      reading,
      popularDigital,
      digitalLogs,
      researchLogs,
      dashboard,
    ] = await Promise.all([
      this.reports.genderWiseVisitors(tenantId, reportQuery),
      this.reports.peakHours(tenantId, reportQuery),
      this.reports.departmentWiseVisitors(tenantId, reportQuery),
      this.analytics.readingAnalytics(
        tenantId,
        Math.ceil((to.getTime() - from.getTime()) / 86400000) || 365,
      ),
      this.reports.popularDigitalAssets(tenantId, reportQuery),
      this.reports.digitalDownloadReport(tenantId, reportQuery),
      this.reports.researchUsageReport(tenantId, reportQuery),
      this.analytics.dashboard(tenantId),
    ]);

    const peak = [...peakHours.buckets].sort(
      (a, b) => b.count - a.count,
    )[0] ?? {
      hour: 0,
      count: 0,
    };

    const books = await this.prisma.libraryBook.findMany({
      where: { tenantId, deletedAt: null },
      include: { copies: true, category: true },
    });

    const yearMap = new Map<number, { titles: number; copies: number }>();
    for (const book of books) {
      const year = book.createdAt.getFullYear();
      const row = yearMap.get(year) ?? { titles: 0, copies: 0 };
      row.titles += 1;
      row.copies += book.copies.length;
      yearMap.set(year, row);
    }

    const deptIssueMap = new Map(
      reading.departmentUsage.map((d) => [d.departmentName, d]),
    );
    const departmentUsage = deptVisitors.rows.map((v) => {
      const issues = deptIssueMap.get(v.departmentName);
      return {
        departmentName: v.departmentName,
        visits: v.count,
        issues: issues?.issueCount ?? 0,
        uniqueReaders: issues?.uniqueReaders ?? 0,
      };
    });

    const periodLoans = await this.prisma.libraryLoan.findMany({
      where: { tenantId, issuedAt: { gte: from, lte: to } },
      select: { studentId: true, staffProfileId: true, memberType: true },
    });

    const studentLoanIds = new Set(
      periodLoans.filter((l) => l.studentId).map((l) => l.studentId!),
    );
    const facultyLoanIds = new Set(
      periodLoans
        .filter((l) => l.memberType === 'FACULTY' || l.memberType === 'STAFF')
        .map((l) => l.staffProfileId!)
        .filter(Boolean),
    );

    const studentVisits = await this.prisma.libraryVisit.count({
      where: {
        tenantId,
        memberType: 'STUDENT',
        entryAt: { gte: from, lte: to },
      },
    });
    const facultyVisits = await this.prisma.libraryVisit.count({
      where: {
        tenantId,
        memberType: { in: ['FACULTY', 'STAFF'] },
        entryAt: { gte: from, lte: to },
      },
    });

    const digitalViews = await this.prisma.libraryDigitalAccessLog.count({
      where: {
        tenantId,
        action: 'VIEW',
        createdAt: { gte: from, lte: to },
      },
    });

    const paidFines = await this.prisma.libraryFine.aggregate({
      where: {
        tenantId,
        paidAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    });
    const waivedFines = await this.prisma.libraryFine.aggregate({
      where: {
        tenantId,
        waivedAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    });

    const bookValue = books.reduce(
      (sum, b) => sum + (b.price ? Number(b.price) * b.copies.length : 0),
      0,
    );

    const journalCategory = await this.prisma.libraryCategory.findFirst({
      where: { tenantId, code: 'JOURNAL' },
    });
    const printJournalTitles = journalCategory
      ? books.filter((b) => b.categoryId === journalCategory.id).length
      : books.filter((b) =>
          (b.category?.code ?? '').toUpperCase().includes('JOURNAL'),
        ).length;

    const digitalJournalAssets = await this.prisma.libraryDigitalAsset.count({
      where: {
        tenantId,
        assetType: { in: ['JOURNAL', 'E_JOURNAL', 'NEWSPAPER'] },
        deletedAt: null,
      },
    });

    const eJournalDownloads = digitalLogs.filter(
      (l) =>
        l.asset?.assetType === 'JOURNAL' || l.asset?.assetType === 'E_JOURNAL',
    ).length;

    return {
      generatedAt: new Date().toISOString(),
      period: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      },
      academicYear: query.academicYear,
      summary: {
        totalTitles: dashboard.totalTitles ?? books.length,
        totalCopies: dashboard.totalBooks ?? 0,
        availableCopies: dashboard.availableCopies ?? 0,
        digitalAssets: dashboard.digitalAssets ?? 0,
        researchItems: dashboard.researchItems ?? 0,
        activeLoans: dashboard.activeLoans ?? 0,
        overdueLoans: dashboard.overdueLoans ?? 0,
      },
      footfall: {
        totalVisits: genderVisits.total,
        male: genderVisits.male,
        female: genderVisits.female,
        other: genderVisits.other,
        peakHour: peak.hour,
        peakCount: peak.count,
      },
      booksAddedYearWise: [...yearMap.entries()]
        .map(([year, v]) => ({ year, ...v }))
        .sort((a, b) => b.year - a.year),
      departmentUsage,
      studentUsage: {
        uniqueStudents: studentLoanIds.size,
        totalVisits: studentVisits,
        totalIssues: periodLoans.filter((l) => l.studentId).length,
      },
      facultyUsage: {
        uniqueFaculty: facultyLoanIds.size,
        totalVisits: facultyVisits,
        totalIssues: periodLoans.filter((l) => l.staffProfileId).length,
      },
      eResourceUsage: {
        digitalDownloads: digitalLogs.length,
        digitalViews,
        researchAccess: researchLogs.length,
        topDigital: popularDigital.slice(0, 10).map((r) => ({
          title: r.title,
          downloads: r.downloads,
        })),
      },
      readingStatistics: {
        topBooks: reading.topBooks.slice(0, 20).map((b) => ({
          title: b.title,
          issueCount: b.issueCount,
        })),
        topReaders: reading.topReaders.slice(0, 20).map((r) => ({
          fullName: r.fullName,
          issueCount: r.issueCount,
          department: r.department,
        })),
      },
      expenditure: {
        finesCollected: Number(paidFines._sum.amount ?? 0),
        finesWaived: Number(waivedFines._sum.amount ?? 0),
        bookValueOnShelf: bookValue,
        note: 'Fines and catalogued book value; dedicated procurement ledger can be linked in a future phase.',
      },
      journalSubscriptions: {
        printJournalTitles,
        digitalJournalAssets,
        eJournalDownloads,
      },
    };
  }

  async export(
    tenantId: string,
    query: NaacLibraryReportQueryDto,
    format: 'pdf' | 'xlsx' | 'csv',
  ) {
    const bundle = await this.buildBundle(tenantId, query);
    const stamp = bundle.period.to;

    if (format === 'csv') {
      const zip = new JSZip();
      zip.file(
        'summary.csv',
        this.reports.toCsv(
          [bundle.summary as unknown as Record<string, unknown>],
          [
            { key: 'totalTitles', header: 'Total Titles' },
            { key: 'totalCopies', header: 'Total Copies' },
            { key: 'digitalAssets', header: 'Digital Assets' },
            { key: 'activeLoans', header: 'Active Loans' },
          ],
        ),
      );
      zip.file(
        'footfall.csv',
        this.reports.toCsv(
          [bundle.footfall as unknown as Record<string, unknown>],
          [
            { key: 'totalVisits', header: 'Total Visits' },
            { key: 'male', header: 'Male' },
            { key: 'female', header: 'Female' },
            { key: 'peakHour', header: 'Peak Hour' },
          ],
        ),
      );
      zip.file(
        'books-yearwise.csv',
        this.reports.toCsv(
          bundle.booksAddedYearWise as Record<string, unknown>[],
          [
            { key: 'year', header: 'Year' },
            { key: 'titles', header: 'Titles Added' },
            { key: 'copies', header: 'Copies Added' },
          ],
        ),
      );
      zip.file(
        'department-usage.csv',
        this.reports.toCsv(
          bundle.departmentUsage as Record<string, unknown>[],
          [
            { key: 'departmentName', header: 'Department' },
            { key: 'visits', header: 'Visits' },
            { key: 'issues', header: 'Issues' },
            { key: 'uniqueReaders', header: 'Unique Readers' },
          ],
        ),
      );
      zip.file(
        'reading-top-books.csv',
        this.reports.toCsv(
          bundle.readingStatistics.topBooks as Record<string, unknown>[],
          [
            { key: 'title', header: 'Title' },
            { key: 'issueCount', header: 'Issues' },
          ],
        ),
      );
      zip.file('manifest.json', JSON.stringify(bundle, null, 2));
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      return {
        buffer,
        filename: `library-naac-reports-${stamp}.zip`,
        contentType: 'application/zip',
      };
    }

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'BCL Smart Library';
      workbook.created = new Date();

      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.addRow(['Metric', 'Value']);
      for (const [k, v] of Object.entries(bundle.summary)) {
        summarySheet.addRow([k, v]);
      }

      const footfallSheet = workbook.addWorksheet('Footfall');
      footfallSheet.addRow(['Metric', 'Value']);
      for (const [k, v] of Object.entries(bundle.footfall)) {
        footfallSheet.addRow([k, v]);
      }

      const deptSheet = workbook.addWorksheet('Department Usage');
      deptSheet.addRow(['Department', 'Visits', 'Issues', 'Unique Readers']);
      for (const row of bundle.departmentUsage) {
        deptSheet.addRow([
          row.departmentName,
          row.visits,
          row.issues,
          row.uniqueReaders,
        ]);
      }

      const booksSheet = workbook.addWorksheet('Books Added');
      booksSheet.addRow(['Year', 'Titles', 'Copies']);
      for (const row of bundle.booksAddedYearWise) {
        booksSheet.addRow([row.year, row.titles, row.copies]);
      }

      const readSheet = workbook.addWorksheet('Reading Stats');
      readSheet.addRow(['Title', 'Issue Count']);
      for (const row of bundle.readingStatistics.topBooks) {
        readSheet.addRow([row.title, row.issueCount]);
      }

      const eResSheet = workbook.addWorksheet('E-Resources');
      eResSheet.addRow(['Metric', 'Value']);
      for (const [k, v] of Object.entries(bundle.eResourceUsage)) {
        if (Array.isArray(v)) continue;
        eResSheet.addRow([k, v]);
      }

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      return {
        buffer,
        filename: `library-naac-reports-${stamp}.xlsx`,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }

    const html = this.renderPdfHtml(bundle);
    const buffer = await this.htmlToPdf(html);
    return {
      buffer,
      filename: `library-naac-reports-${stamp}.pdf`,
      contentType: 'application/pdf',
    };
  }

  async linkEvidence(user: JwtUser, dto: LinkLibraryNaacEvidenceDto) {
    const format = dto.format ?? 'pdf';
    const query: NaacLibraryReportQueryDto = {
      from: dto.from,
      to: dto.to,
      academicYear: dto.academicYear,
    };
    const exported = await this.export(user.tid, query, format);
    const reportId = randomUUID();
    const storageKey = `tenants/${user.tid}/library/naac-reports/${reportId}/${exported.filename}`;
    await this.storage.put(storageKey, exported.buffer, {
      contentType: exported.contentType,
    });

    const tag = await this.naacEvidence.create(user, {
      sourceType: 'library_naac_report',
      sourceId: reportId,
      criterion: dto.criterion ?? 4,
      metricCode: dto.metricCode ?? '4.2.1',
      academicYear: dto.academicYear,
      activityTitle: 'Smart Library NAAC Report Bundle',
      evidenceNotes:
        dto.evidenceNotes ??
        `Library NAAC bundle ${query.from ?? 'YTD'} to ${query.to ?? 'today'} (${format.toUpperCase()})`,
      fileName: exported.filename,
      storageKey,
    });

    return { tag, reportId, filename: exported.filename, storageKey };
  }

  private renderPdfHtml(bundle: LibraryNaacBundle) {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const table = (headers: string[], rows: string[][]) => `
      <table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <style>
        body{font-family:system-ui,sans-serif;font-size:11px;color:#111;padding:24px}
        h1{font-size:18px;margin:0 0 4px} h2{font-size:13px;margin:24px 0 8px;border-bottom:1px solid #ccc}
        table{width:100%;border-collapse:collapse;margin-bottom:12px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#f3f4f6}.meta{color:#666;font-size:10px;margin-bottom:16px}
        .kpi{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
        .kpi span{background:#eef2ff;padding:6px 10px;border-radius:6px}
      </style></head><body>
      <h1>NAAC Library Report Bundle</h1>
      <p class="meta">Generated ${esc(bundle.generatedAt.slice(0, 16).replace('T', ' '))} · Period ${esc(bundle.period.from)} to ${esc(bundle.period.to)}${bundle.academicYear ? ` · AY ${esc(bundle.academicYear)}` : ''}</p>
      <div class="kpi">
        <span>Titles: ${bundle.summary.totalTitles}</span>
        <span>Copies: ${bundle.summary.totalCopies}</span>
        <span>Digital: ${bundle.summary.digitalAssets}</span>
        <span>Footfall: ${bundle.footfall.totalVisits}</span>
        <span>Overdue: ${bundle.summary.overdueLoans}</span>
      </div>
      <h2>Footfall</h2>
      ${table(
        ['Total', 'Male', 'Female', 'Peak Hour', 'Peak Count'],
        [
          [
            String(bundle.footfall.totalVisits),
            String(bundle.footfall.male),
            String(bundle.footfall.female),
            String(bundle.footfall.peakHour),
            String(bundle.footfall.peakCount),
          ],
        ],
      )}
      <h2>Books Added (Year-wise)</h2>
      ${table(
        ['Year', 'Titles', 'Copies'],
        bundle.booksAddedYearWise.map((r) => [
          String(r.year),
          String(r.titles),
          String(r.copies),
        ]),
      )}
      <h2>Department Usage</h2>
      ${table(
        ['Department', 'Visits', 'Issues', 'Readers'],
        bundle.departmentUsage
          .slice(0, 25)
          .map((r) => [
            r.departmentName,
            String(r.visits),
            String(r.issues),
            String(r.uniqueReaders),
          ]),
      )}
      <h2>Top Books (Reading)</h2>
      ${table(
        ['Title', 'Issues'],
        bundle.readingStatistics.topBooks
          .slice(0, 15)
          .map((r) => [r.title, String(r.issueCount)]),
      )}
      <h2>E-Resource Usage</h2>
      ${table(
        ['Downloads', 'Views', 'Research Access'],
        [
          [
            String(bundle.eResourceUsage.digitalDownloads),
            String(bundle.eResourceUsage.digitalViews),
            String(bundle.eResourceUsage.researchAccess),
          ],
        ],
      )}
      <h2>Expenditure Proxy</h2>
      <p>Fines collected: ₹${bundle.expenditure.finesCollected.toFixed(2)} · Book value on shelf: ₹${bundle.expenditure.bookValueOnShelf.toFixed(2)}</p>
      <p class="meta">${esc(bundle.expenditure.note)}</p>
      </body></html>`;
  }

  private async htmlToPdf(html: string) {
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
        printBackground: true,
        margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
