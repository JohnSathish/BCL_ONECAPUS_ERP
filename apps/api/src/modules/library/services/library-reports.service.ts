import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { ReportQueryDto } from '../dto/library.dto';

@Injectable()
export class LibraryReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private dateRange(query: ReportQueryDto) {
    const from = query.from
      ? new Date(query.from)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const to = query.to ? new Date(query.to) : new Date();
    return { from, to };
  }

  async dailyVisitors(tenantId: string, query: ReportQueryDto) {
    const { from, to } = this.dateRange(query);
    const visits = await this.prisma.libraryVisit.findMany({
      where: { tenantId, entryAt: { gte: from, lte: to } },
      orderBy: { entryAt: 'desc' },
    });
    return { from, to, total: visits.length, visits };
  }

  async departmentWiseVisitors(tenantId: string, query: ReportQueryDto) {
    const { from, to } = this.dateRange(query);
    const visits = await this.prisma.libraryVisit.findMany({
      where: {
        tenantId,
        memberType: 'STUDENT',
        entryAt: { gte: from, lte: to },
      },
    });
    const studentIds = [
      ...new Set(visits.map((v) => v.studentId).filter(Boolean)),
    ] as string[];
    const students = studentIds.length
      ? await this.prisma.student.findMany({
          where: { tenantId, id: { in: studentIds } },
          include: { department: { select: { id: true, name: true } } },
        })
      : [];
    const map = new Map<
      string,
      { departmentId: string | null; departmentName: string; count: number }
    >();
    for (const visit of visits) {
      const student = students.find((s) => s.id === visit.studentId);
      const key = student?.departmentId ?? 'unknown';
      const name = student?.department?.name ?? 'Unknown';
      const row = map.get(key) ?? {
        departmentId: student?.departmentId ?? null,
        departmentName: name,
        count: 0,
      };
      row.count += 1;
      map.set(key, row);
    }
    return {
      from,
      to,
      rows: [...map.values()].sort((a, b) => b.count - a.count),
    };
  }

  async genderWiseVisitors(tenantId: string, query: ReportQueryDto) {
    const { from, to } = this.dateRange(query);
    const visits = await this.prisma.libraryVisit.findMany({
      where: {
        tenantId,
        memberType: 'STUDENT',
        entryAt: { gte: from, lte: to },
      },
    });
    const studentIds = [
      ...new Set(visits.map((v) => v.studentId).filter(Boolean)),
    ] as string[];
    const students = studentIds.length
      ? await this.prisma.student.findMany({
          where: { tenantId, id: { in: studentIds } },
          include: { masterProfile: { select: { gender: true } } },
        })
      : [];
    let male = 0;
    let female = 0;
    let other = 0;
    for (const visit of visits) {
      const gender =
        students
          .find((s) => s.id === visit.studentId)
          ?.masterProfile?.gender?.toUpperCase() ?? '';
      if (gender.startsWith('M')) male += 1;
      else if (gender.startsWith('F')) female += 1;
      else other += 1;
    }
    return { from, to, male, female, other, total: visits.length };
  }

  async peakHours(tenantId: string, query: ReportQueryDto) {
    const { from, to } = this.dateRange(query);
    const visits = await this.prisma.libraryVisit.findMany({
      where: { tenantId, entryAt: { gte: from, lte: to } },
      select: { entryAt: true },
    });
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: visits.filter((v) => v.entryAt.getHours() === hour).length,
    }));
    return { from, to, buckets };
  }

  async accessionRegister(tenantId: string) {
    return this.prisma.libraryBook.findMany({
      where: { tenantId, deletedAt: null },
      include: { category: true, copies: true },
      orderBy: { accessionNo: 'asc' },
    });
  }

  async categoryStock(tenantId: string) {
    const categories = await this.prisma.libraryCategory.findMany({
      where: { tenantId, active: true },
      include: {
        books: { where: { deletedAt: null }, include: { copies: true } },
      },
    });
    return categories.map((c) => ({
      categoryId: c.id,
      categoryName: c.name,
      bookCount: c.books.length,
      copyCount: c.books.reduce((sum, b) => sum + b.copies.length, 0),
      availableCopies: c.books.reduce(
        (sum, b) =>
          sum + b.copies.filter((cp) => cp.status === 'AVAILABLE').length,
        0,
      ),
    }));
  }

  async issueReport(tenantId: string, query: ReportQueryDto) {
    const { from, to } = this.dateRange(query);
    return this.prisma.libraryLoan.findMany({
      where: { tenantId, issuedAt: { gte: from, lte: to } },
      include: { copy: { include: { book: true } }, fines: true },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async returnReport(tenantId: string, query: ReportQueryDto) {
    const { from, to } = this.dateRange(query);
    return this.prisma.libraryLoan.findMany({
      where: { tenantId, returnedAt: { gte: from, lte: to } },
      include: { copy: { include: { book: true } }, fines: true },
      orderBy: { returnedAt: 'desc' },
    });
  }

  async fineReport(tenantId: string, query: ReportQueryDto) {
    const { from, to } = this.dateRange(query);
    return this.prisma.libraryFine.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      include: { loan: { include: { copy: { include: { book: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async mostBorrowed(tenantId: string, query: ReportQueryDto) {
    const { from, to } = this.dateRange(query);
    const loans = await this.prisma.libraryLoan.findMany({
      where: { tenantId, issuedAt: { gte: from, lte: to } },
      include: { copy: { include: { book: true } } },
    });
    const map = new Map<
      string,
      { bookId: string; title: string; count: number }
    >();
    for (const loan of loans) {
      const book = loan.copy.book;
      const row = map.get(book.id) ?? {
        bookId: book.id,
        title: book.title,
        count: 0,
      };
      row.count += 1;
      map.set(book.id, row);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 20);
  }

  async leastBorrowed(tenantId: string, query: ReportQueryDto) {
    const rows = await this.mostBorrowed(tenantId, query);
    return [...rows].reverse().slice(0, 20);
  }

  async digitalDownloadReport(tenantId: string, query: ReportQueryDto) {
    const { from, to } = this.dateRange(query);
    return this.prisma.libraryDigitalAccessLog.findMany({
      where: {
        tenantId,
        action: 'DOWNLOAD',
        createdAt: { gte: from, lte: to },
      },
      include: { asset: { select: { title: true, assetType: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async popularDigitalAssets(tenantId: string, query: ReportQueryDto) {
    const { from, to } = this.dateRange(query);
    const logs = await this.prisma.libraryDigitalAccessLog.groupBy({
      by: ['assetId'],
      where: {
        tenantId,
        action: 'DOWNLOAD',
        createdAt: { gte: from, lte: to },
      },
      _count: { assetId: true },
      orderBy: { _count: { assetId: 'desc' } },
      take: 20,
    });
    const ids = logs.map((l) => l.assetId);
    const assets = ids.length
      ? await this.prisma.libraryDigitalAsset.findMany({
          where: { tenantId, id: { in: ids } },
        })
      : [];
    return logs.map((l) => ({
      assetId: l.assetId,
      downloads: l._count.assetId,
      title: assets.find((a) => a.id === l.assetId)?.title ?? 'Unknown',
    }));
  }

  async researchUsageReport(tenantId: string, query: ReportQueryDto) {
    const { from, to } = this.dateRange(query);
    return this.prisma.researchRepositoryAccessLog.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      include: { item: { select: { title: true, itemType: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  toCsv(
    rows: Record<string, unknown>[],
    columns: { key: string; header: string }[],
  ) {
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const header = columns.map((c) => escape(c.header)).join(',');
    const body = rows
      .map((row) => columns.map((c) => escape(row[c.key])).join(','))
      .join('\n');
    return `${header}\n${body}`;
  }

  async exportDepartmentVisitorsCsv(tenantId: string, query: ReportQueryDto) {
    const data = await this.departmentWiseVisitors(tenantId, query);
    return this.toCsv(data.rows as Record<string, unknown>[], [
      { key: 'departmentName', header: 'Department' },
      { key: 'count', header: 'Visits' },
    ]);
  }

  async exportAccessionCsv(tenantId: string) {
    const books = await this.accessionRegister(tenantId);
    const rows = books.map((b) => ({
      accessionNo: b.accessionNo,
      title: b.title,
      author: b.author ?? '',
      category: b.category?.name ?? '',
      copies: b.copies.length,
    }));
    return this.toCsv(rows, [
      { key: 'accessionNo', header: 'Accession No' },
      { key: 'title', header: 'Title' },
      { key: 'author', header: 'Author' },
      { key: 'category', header: 'Category' },
      { key: 'copies', header: 'Copies' },
    ]);
  }

  async exportOverdueCsv(tenantId: string) {
    const loans = await this.prisma.libraryLoan.findMany({
      where: { tenantId, status: 'ACTIVE', dueAt: { lt: new Date() } },
      include: { copy: { include: { book: true } } },
      orderBy: { dueAt: 'asc' },
    });
    const rows = loans.map((l) => ({
      barcode: l.copy.barcode,
      title: l.copy.book.title,
      dueAt: l.dueAt.toISOString().slice(0, 10),
      studentId: l.studentId ?? '',
      daysOverdue: Math.ceil(
        (Date.now() - l.dueAt.getTime()) / (24 * 60 * 60 * 1000),
      ),
    }));
    return this.toCsv(rows, [
      { key: 'barcode', header: 'Barcode' },
      { key: 'title', header: 'Title' },
      { key: 'dueAt', header: 'Due Date' },
      { key: 'daysOverdue', header: 'Days Overdue' },
      { key: 'studentId', header: 'Student ID' },
    ]);
  }

  async exportFinesCsv(tenantId: string, query: ReportQueryDto) {
    const fines = await this.fineReport(tenantId, query);
    const rows = fines.map((f) => ({
      book: f.loan.copy.book.title,
      amount: Number(f.amount),
      reason: f.reason ?? '',
      status: f.paidAt ? 'PAID' : f.waivedAt ? 'WAIVED' : 'UNPAID',
      createdAt: f.createdAt.toISOString().slice(0, 10),
    }));
    return this.toCsv(rows, [
      { key: 'book', header: 'Book' },
      { key: 'amount', header: 'Amount' },
      { key: 'reason', header: 'Reason' },
      { key: 'status', header: 'Status' },
      { key: 'createdAt', header: 'Date' },
    ]);
  }
}
