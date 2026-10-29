import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  overview: LibraryNaacOverview;
};

export type LibraryNaacOverview = {
  titles: number;
  copies: number;
  digital: number;
  members: number;
  students: number;
  staff: number;
  visits: number;
  activeLoans: number;
  issues: number;
  activeMembers: number;
  averageLoanDays: number | null;
  seats: number | null;
  automation: string[];
  growth: {
    titles: number | null;
    copies: number | null;
    digital: number | null;
    members: number | null;
    visits: number | null;
  };
  departments: {
    department: string;
    titles: number;
    copies: number;
    available: number;
    issued: number;
    overdue: number;
    lostDamaged: number;
    eResources: number;
  }[];
  resourceTypes: { name: string; count: number }[];
  years: { year: number; titles: number; copies: number; eResources: number }[];
  status: {
    available: number;
    issued: number;
    overdue: number;
    lostDamaged: number;
    other: number;
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
      overview: await this.collectionOverview(
        tenantId,
        query,
        from,
        to,
        genderVisits.total,
      ),
    };
  }

  private async collectionOverview(
    tenantId: string,
    query: NaacLibraryReportQueryDto,
    from: Date,
    to: Date,
    visits: number,
  ): Promise<LibraryNaacOverview> {
    const medium = query.medium ?? 'ALL';
    const physical = medium !== 'DIGITAL';
    const digital = medium !== 'PHYSICAL';
    const bookWhere: Prisma.LibraryBookWhereInput = {
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.departmentId
        ? {
            OR: [
              { departmentId: query.departmentId },
              { departments: { some: { departmentId: query.departmentId } } },
            ],
          }
        : {}),
    };
    const copyWhere: Prisma.LibraryBookCopyWhereInput = {
      tenantId,
      book: bookWhere,
    };
    const assetWhere: Prisma.LibraryDigitalAssetWhereInput = {
      tenantId,
      deletedAt: null,
      status: 'PUBLISHED',
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    };
    const span = Math.max(to.getTime() - from.getTime(), 0);
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - span);
    const physicalFilters = [
      Prisma.sql`c.tenant_id = CAST(${tenantId} AS uuid)`,
      Prisma.sql`b.deleted_at IS NULL`,
    ];
    if (query.departmentId) {
      physicalFilters.push(
        Prisma.sql`COALESCE(b.department_id, (
          SELECT bd.department_id FROM library.library_book_departments bd
          WHERE bd.book_id = b.id ORDER BY bd.created_at LIMIT 1
        )) = CAST(${query.departmentId} AS uuid)`,
      );
    }
    if (query.categoryId) {
      physicalFilters.push(
        Prisma.sql`b.category_id = CAST(${query.categoryId} AS uuid)`,
      );
    }
    const where = Prisma.join(physicalFilters, ' AND ');
    const assetFilters = [
      Prisma.sql`a.tenant_id = CAST(${tenantId} AS uuid)`,
      Prisma.sql`a.deleted_at IS NULL`,
      Prisma.sql`a.status = 'PUBLISHED'`,
    ];
    if (query.departmentId) {
      assetFilters.push(
        Prisma.sql`a.department_id = CAST(${query.departmentId} AS uuid)`,
      );
    }
    if (query.categoryId) {
      assetFilters.push(
        Prisma.sql`a.category_id = CAST(${query.categoryId} AS uuid)`,
      );
    }
    const assetWhereSql = Prisma.join(assetFilters, ' AND ');

    const [
      titles,
      copies,
      titlesThen,
      titlesAdded,
      copiesThen,
      copiesAdded,
      digitalCount,
      digitalThen,
      digitalAdded,
      previousVisits,
      activeLoans,
      issues,
      averageRow,
      activeMembersRow,
      memberRow,
      settings,
      departmentRows,
      categoryRows,
      yearRows,
      digitalDepartments,
      digitalYears,
    ] = await Promise.all([
      physical
        ? this.prisma.libraryBook.count({ where: { tenantId, ...bookWhere } })
        : 0,
      physical ? this.prisma.libraryBookCopy.count({ where: copyWhere }) : 0,
      physical
        ? this.prisma.libraryBook.count({
            where: {
              tenantId,
              ...bookWhere,
              copies: { some: { acquisitionDate: { lt: from } } },
            },
          })
        : 0,
      physical
        ? this.prisma.libraryBook.count({
            where: {
              tenantId,
              ...bookWhere,
              copies: {
                some: { acquisitionDate: { gte: from, lte: to } },
                none: { acquisitionDate: { lt: from } },
              },
            },
          })
        : 0,
      physical
        ? this.prisma.libraryBookCopy.count({
            where: { ...copyWhere, acquisitionDate: { lt: from } },
          })
        : 0,
      physical
        ? this.prisma.libraryBookCopy.count({
            where: { ...copyWhere, acquisitionDate: { gte: from, lte: to } },
          })
        : 0,
      digital
        ? this.prisma.libraryDigitalAsset.count({ where: assetWhere })
        : 0,
      digital
        ? this.prisma.libraryDigitalAsset.count({
            where: { ...assetWhere, createdAt: { lt: from } },
          })
        : 0,
      digital
        ? this.prisma.libraryDigitalAsset.count({
            where: { ...assetWhere, createdAt: { gte: from, lte: to } },
          })
        : 0,
      this.prisma.libraryVisit.count({
        where: { tenantId, entryAt: { gte: previousFrom, lte: previousTo } },
      }),
      physical
        ? this.prisma.libraryLoan.count({
            where: {
              tenantId,
              status: 'ACTIVE',
              returnedAt: null,
              copy: { book: bookWhere },
            },
          })
        : 0,
      physical
        ? this.prisma.libraryLoan.count({
            where: {
              tenantId,
              issuedAt: { gte: from, lte: to },
              copy: { book: bookWhere },
            },
          })
        : 0,
      physical
        ? this.prisma.$queryRaw<{ days: number | null }[]>`
            SELECT AVG(EXTRACT(EPOCH FROM (l.returned_at - l.issued_at)) / 86400.0) AS days
            FROM library.library_loans l
            JOIN library.library_book_copies c ON c.id = l.copy_id
            JOIN library.library_books b ON b.id = c.book_id
            WHERE l.tenant_id = CAST(${tenantId} AS uuid)
              AND l.returned_at IS NOT NULL
              AND l.returned_at >= l.issued_at
              AND l.issued_at >= ${from}
              AND l.issued_at <= ${to}
              AND ${where}
          `
        : Promise.resolve([{ days: null }]),
      physical
        ? this.prisma.$queryRaw<{ members: number }[]>`
            SELECT COUNT(DISTINCT person)::int AS members
            FROM (
              SELECT l.student_id AS person
              FROM library.library_loans l
              JOIN library.library_book_copies c ON c.id = l.copy_id
              JOIN library.library_books b ON b.id = c.book_id
              WHERE l.tenant_id = CAST(${tenantId} AS uuid)
                AND l.student_id IS NOT NULL
                AND l.issued_at >= ${from}
                AND l.issued_at <= ${to}
                AND ${where}
              UNION
              SELECT l.staff_profile_id
              FROM library.library_loans l
              JOIN library.library_book_copies c ON c.id = l.copy_id
              JOIN library.library_books b ON b.id = c.book_id
              WHERE l.tenant_id = CAST(${tenantId} AS uuid)
                AND l.staff_profile_id IS NOT NULL
                AND l.issued_at >= ${from}
                AND l.issued_at <= ${to}
                AND ${where}
            ) people
          `
        : Promise.resolve([{ members: 0 }]),
      this.prisma.$queryRaw<
        { students: number; staff: number; before: number; added: number }[]
      >`
        WITH people AS (
          SELECT student_id AS person_id, 'STUDENT' AS kind, entry_at AS at
          FROM library.library_visits
          WHERE tenant_id = CAST(${tenantId} AS uuid) AND student_id IS NOT NULL
          UNION ALL
          SELECT staff_profile_id, 'STAFF', entry_at
          FROM library.library_visits
          WHERE tenant_id = CAST(${tenantId} AS uuid) AND staff_profile_id IS NOT NULL
          UNION ALL
          SELECT student_id, 'STUDENT', issued_at
          FROM library.library_loans
          WHERE tenant_id = CAST(${tenantId} AS uuid) AND student_id IS NOT NULL
          UNION ALL
          SELECT staff_profile_id, 'STAFF', issued_at
          FROM library.library_loans
          WHERE tenant_id = CAST(${tenantId} AS uuid) AND staff_profile_id IS NOT NULL
        ),
        firsts AS (
          SELECT person_id, kind, MIN(at) AS first_at
          FROM people
          GROUP BY person_id, kind
        )
        SELECT
          COUNT(*) FILTER (WHERE kind = 'STUDENT')::int AS students,
          COUNT(*) FILTER (WHERE kind = 'STAFF')::int AS staff,
          COUNT(*) FILTER (WHERE first_at < ${from})::int AS before,
          COUNT(*) FILTER (WHERE first_at >= ${from} AND first_at <= ${to})::int AS added
        FROM firsts
      `,
      this.prisma.librarySettings.findUnique({
        where: { tenantId },
        select: {
          totalSeats: true,
          qrEntryEnabled: true,
          rfidEntryEnabled: true,
          selfCheckInEnabled: true,
        },
      }),
      physical
        ? this.prisma.$queryRaw<
            {
              department: string;
              titles: number;
              copies: number;
              available: number;
              issued: number;
              overdue: number;
              lost: number;
            }[]
          >`
            SELECT
              COALESCE(dep.department_name, NULLIF(BTRIM(c.collection_code), ''), '(Unmapped)') AS department,
              COUNT(DISTINCT b.id)::int AS titles,
              COUNT(c.id)::int AS copies,
              COUNT(c.id) FILTER (WHERE loan.id IS NULL AND c.status = 'AVAILABLE')::int AS available,
              COUNT(c.id) FILTER (
                WHERE loan.id IS NOT NULL
                  AND c.status NOT IN ('LOST', 'DAMAGED')
                  AND (loan.due_at IS NULL OR loan.due_at >= NOW())
              )::int AS issued,
              COUNT(c.id) FILTER (
                WHERE loan.id IS NOT NULL
                  AND c.status NOT IN ('LOST', 'DAMAGED')
                  AND loan.due_at < NOW()
              )::int AS overdue,
              COUNT(c.id) FILTER (WHERE c.status IN ('LOST', 'DAMAGED'))::int AS lost
            FROM library.library_book_copies c
            JOIN library.library_books b ON b.id = c.book_id
            LEFT JOIN LATERAL (
              SELECT COALESCE(b.department_id, (
                SELECT bd.department_id FROM library.library_book_departments bd
                WHERE bd.book_id = b.id ORDER BY bd.created_at LIMIT 1
              )) AS department_id
            ) mapped ON true
            LEFT JOIN core.departments dep ON dep.id = mapped.department_id AND dep.deleted_at IS NULL
            LEFT JOIN LATERAL (
              SELECT l.id, l.due_at
              FROM library.library_loans l
              WHERE l.copy_id = c.id AND l.returned_at IS NULL AND l.status = 'ACTIVE'
              LIMIT 1
            ) loan ON true
            WHERE ${where}
            GROUP BY 1
            ORDER BY copies DESC
          `
        : Promise.resolve([]),
      physical
        ? this.prisma.$queryRaw<{ name: string; count: number }[]>`
            SELECT COALESCE(cat.name, 'Uncategorised') AS name, COUNT(c.id)::int AS count
            FROM library.library_book_copies c
            JOIN library.library_books b ON b.id = c.book_id
            LEFT JOIN library.library_categories cat ON cat.id = b.category_id
            WHERE ${where}
            GROUP BY 1
            ORDER BY count DESC
          `
        : Promise.resolve([]),
      physical
        ? this.prisma.$queryRaw<
            { year: number; titles: number; copies: number }[]
          >`
            SELECT EXTRACT(YEAR FROM c.acquisition_date)::int AS year,
              COUNT(DISTINCT b.id)::int AS titles,
              COUNT(c.id)::int AS copies
            FROM library.library_book_copies c
            JOIN library.library_books b ON b.id = c.book_id
            WHERE ${where}
              AND c.acquisition_date IS NOT NULL
            GROUP BY 1
            ORDER BY 1
          `
        : Promise.resolve([]),
      digital
        ? this.prisma.$queryRaw<{ department: string; assets: number }[]>`
            SELECT COALESCE(dep.department_name, '(Unmapped)') AS department, COUNT(a.id)::int AS assets
            FROM library.library_digital_assets a
            LEFT JOIN core.departments dep ON dep.id = a.department_id AND dep.deleted_at IS NULL
            WHERE ${assetWhereSql}
            GROUP BY 1
          `
        : Promise.resolve([]),
      digital
        ? this.prisma.$queryRaw<{ year: number; assets: number }[]>`
            SELECT EXTRACT(YEAR FROM a.created_at)::int AS year, COUNT(a.id)::int AS assets
            FROM library.library_digital_assets a
            WHERE ${assetWhereSql}
            GROUP BY 1
          `
        : Promise.resolve([]),
    ]);

    const digitalByDepartment = new Map(
      digitalDepartments.map((row) => [row.department, Number(row.assets)]),
    );
    const departments = departmentRows.map((row) => ({
      department: row.department,
      titles: Number(row.titles),
      copies: Number(row.copies),
      available: Number(row.available),
      issued: Number(row.issued),
      overdue: Number(row.overdue),
      lostDamaged: Number(row.lost),
      eResources: digitalByDepartment.get(row.department) ?? 0,
    }));
    for (const [department, assets] of digitalByDepartment) {
      if (!departments.some((row) => row.department === department)) {
        departments.push({
          department,
          titles: 0,
          copies: 0,
          available: 0,
          issued: 0,
          overdue: 0,
          lostDamaged: 0,
          eResources: Number(assets),
        });
      }
    }
    const available = departments.reduce((sum, row) => sum + row.available, 0);
    const issued = departments.reduce((sum, row) => sum + row.issued, 0);
    const overdue = departments.reduce((sum, row) => sum + row.overdue, 0);
    const lostDamaged = departments.reduce(
      (sum, row) => sum + row.lostDamaged,
      0,
    );
    const topCategories = categoryRows.slice(0, 5).map((row) => ({
      name: row.name,
      count: Number(row.count),
    }));
    const otherCategories = categoryRows
      .slice(5)
      .reduce((sum, row) => sum + Number(row.count), 0);
    const resourceTypes = [
      ...topCategories,
      ...(otherCategories > 0
        ? [{ name: 'Others', count: otherCategories }]
        : []),
      ...(digitalCount > 0
        ? [{ name: 'E-Resources', count: digitalCount }]
        : []),
    ];
    const yearMap = new Map<
      number,
      { titles: number; copies: number; eResources: number }
    >();
    for (const row of yearRows) {
      yearMap.set(Number(row.year), {
        titles: Number(row.titles),
        copies: Number(row.copies),
        eResources: 0,
      });
    }
    for (const row of digitalYears) {
      const current = yearMap.get(Number(row.year)) ?? {
        titles: 0,
        copies: 0,
        eResources: 0,
      };
      current.eResources = Number(row.assets);
      yearMap.set(Number(row.year), current);
    }
    const yearNumbers = [...yearMap.keys()]
      .filter((year) => Number.isFinite(year))
      .sort((a, b) => a - b);
    const years: LibraryNaacOverview['years'] = [];
    if (yearNumbers.length) {
      for (
        let year = yearNumbers[0];
        year <= yearNumbers[yearNumbers.length - 1];
        year += 1
      ) {
        years.push({
          year,
          ...(yearMap.get(year) ?? { titles: 0, copies: 0, eResources: 0 }),
        });
      }
    }
    const members = memberRow[0] ?? {
      students: 0,
      staff: 0,
      before: 0,
      added: 0,
    };
    const automation = [
      settings?.qrEntryEnabled ? 'QR entry' : '',
      settings?.rfidEntryEnabled ? 'RFID entry' : '',
      settings?.selfCheckInEnabled ? 'Self check-in' : '',
    ].filter(Boolean);
    const average = averageRow[0]?.days;

    return {
      titles,
      copies,
      digital: digitalCount,
      members: Number(members.students) + Number(members.staff),
      students: Number(members.students),
      staff: Number(members.staff),
      visits,
      activeLoans,
      issues,
      activeMembers: Number(activeMembersRow[0]?.members ?? 0),
      averageLoanDays:
        average == null ? null : Math.round(Number(average) * 10) / 10,
      seats: settings?.totalSeats ?? null,
      automation,
      growth: {
        titles: ratio(titlesThen + titlesAdded, titlesThen),
        copies: ratio(copiesThen + copiesAdded, copiesThen),
        digital: ratio(digitalThen + digitalAdded, digitalThen),
        members: ratio(
          Number(members.before) + Number(members.added),
          Number(members.before),
        ),
        visits: ratio(visits, previousVisits),
      },
      departments,
      resourceTypes,
      years,
      status: {
        available,
        issued,
        overdue,
        lostDamaged,
        other: Math.max(0, copies - available - issued - overdue - lostDamaged),
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
      zip.file(
        'department-collection.csv',
        this.reports.toCsv(
          bundle.overview.departments as Record<string, unknown>[],
          [
            { key: 'department', header: 'Department' },
            { key: 'titles', header: 'Distinct Titles' },
            { key: 'copies', header: 'Physical Copies' },
            { key: 'available', header: 'Available' },
            { key: 'issued', header: 'Issued' },
            { key: 'overdue', header: 'Overdue' },
            { key: 'lostDamaged', header: 'Lost/Damaged' },
            { key: 'eResources', header: 'E-Resources' },
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

      const collectionSheet = workbook.addWorksheet('Department Collection');
      collectionSheet.addRow([
        'Department',
        'Distinct Titles',
        'Physical Copies',
        'Available',
        'Issued',
        'Overdue',
        'Lost/Damaged',
        'E-Resources',
      ]);
      for (const row of bundle.overview.departments) {
        collectionSheet.addRow([
          row.department,
          row.titles,
          row.copies,
          row.available,
          row.issued,
          row.overdue,
          row.lostDamaged,
          row.eResources,
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
      <h2>Department-wise Book Collection</h2>
      ${table(
        [
          'Department',
          'Titles',
          'Copies',
          'Available',
          'Issued',
          'Overdue',
          'Lost/Damaged',
          'E-Resources',
        ],
        bundle.overview.departments
          .slice(0, 25)
          .map((row) => [
            row.department,
            String(row.titles),
            String(row.copies),
            String(row.available),
            String(row.issued),
            String(row.overdue),
            String(row.lostDamaged),
            String(row.eResources),
          ]),
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

function ratio(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
