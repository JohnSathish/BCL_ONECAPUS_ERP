import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { EntryExitReportQueryDto } from '../dto/library.dto';

const EXPORT_CAP = 8_000;
const DEFAULT_LONG_STAY_MINUTES = 180;

type VisitStatus = 'INSIDE' | 'EXITED' | 'INCOMPLETE';
type EnrichedVisit = {
  id: string;
  memberType: string;
  studentId: string | null;
  staffProfileId: string | null;
  visitorId: string | null;
  memberId: string | null;
  memberCode: string | null;
  memberName: string;
  departmentId: string | null;
  department: string | null;
  programme: string | null;
  semester: number | null;
  gender: string | null;
  mobile: string | null;
  date: string;
  entryAt: Date;
  exitAt: Date | null;
  durationMinutes: number;
  stayLabel: string;
  status: VisitStatus;
  zoneName: string | null;
  seatLabel: string | null;
};

@Injectable()
export class LibraryEntryExitReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async filterOptions(tenantId: string) {
    const [departments, programs] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.program.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { departments, programs };
  }

  async summary(tenantId: string, query: EntryExitReportQueryDto) {
    const range = this.resolveRange(query);
    const prev = this.previousRange(range);
    const [currentRows, previousRows, header] = await Promise.all([
      this.loadEnriched(tenantId, query, range, EXPORT_CAP),
      this.loadEnriched(tenantId, query, prev, EXPORT_CAP),
      this.institutionHeader(tenantId),
    ]);
    const current = this.computeKpis(currentRows);
    const prior = this.computeKpis(previousRows);
    const hourly = this.hourlyFrom(currentRows, range);
    const peak = hourly.reduce(
      (best, b) => (b.entries > best.entries ? b : best),
      hourly[0] ?? { hour: 8, entries: 0, exits: 0, footfall: 0 },
    );
    const deptCounts = new Map<string, number>();
    const studentCounts = new Map<string, { name: string; count: number }>();
    for (const row of currentRows) {
      const dept = row.department ?? 'Unknown';
      deptCounts.set(dept, (deptCounts.get(dept) ?? 0) + 1);
      if (row.memberType === 'STUDENT' && row.memberCode) {
        const prevCount = studentCounts.get(row.memberCode) ?? {
          name: row.memberName,
          count: 0,
        };
        prevCount.count += 1;
        studentCounts.set(row.memberCode, prevCount);
      }
    }
    const mostVisitedDepartment = [...deptCounts.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    const mostFrequentStudent = [...studentCounts.entries()].sort(
      (a, b) => b[1].count - a[1].count,
    )[0];
    return {
      header,
      range,
      previousRange: prev,
      kpis: {
        totalVisits: {
          value: current.totalVisits,
          deltaPct: this.deltaPct(current.totalVisits, prior.totalVisits),
        },
        totalEntries: {
          value: current.totalEntries,
          deltaPct: this.deltaPct(current.totalEntries, prior.totalEntries),
        },
        totalExits: {
          value: current.totalExits,
          deltaPct: this.deltaPct(current.totalExits, prior.totalExits),
        },
        currentlyInside: {
          value: current.currentlyInside,
          deltaPct: this.deltaPct(
            current.currentlyInside,
            prior.currentlyInside,
          ),
        },
        averageStayMinutes: {
          value: current.averageStayMinutes,
          deltaPct: this.deltaPct(
            current.averageStayMinutes,
            prior.averageStayMinutes,
          ),
        },
        longestStayMinutes: {
          value: current.longestStayMinutes,
          deltaPct: null as number | null,
        },
        maleVisitors: {
          value: current.male,
          deltaPct: this.deltaPct(current.male, prior.male),
        },
        femaleVisitors: {
          value: current.female,
          deltaPct: this.deltaPct(current.female, prior.female),
        },
      },
      peakHour: {
        label: this.hourLabel(peak.hour),
        entries: peak.entries,
      },
      mostVisitedDepartment: mostVisitedDepartment
        ? { name: mostVisitedDepartment[0], visits: mostVisitedDepartment[1] }
        : null,
      mostFrequentStudent: mostFrequentStudent
        ? {
            code: mostFrequentStudent[0],
            name: mostFrequentStudent[1].name,
            visits: mostFrequentStudent[1].count,
          }
        : null,
    };
  }

  async visits(tenantId: string, query: EntryExitReportQueryDto) {
    const range = this.resolveRange(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const rows = await this.loadEnriched(tenantId, query, range, EXPORT_CAP);
    const sorted = this.sortRows(
      rows,
      query.sortBy ?? 'entryAt',
      query.sortDir ?? 'desc',
    );
    const total = sorted.length;
    const slice = sorted.slice((page - 1) * limit, page * limit);
    return {
      range,
      items: slice.map((row, i) => ({
        slNo: (page - 1) * limit + i + 1,
        ...this.toJson(row),
      })),
      total,
      page,
      limit,
    };
  }

  async currentlyInside(tenantId: string, query: EntryExitReportQueryDto) {
    const open = await this.prisma.libraryVisit.findMany({
      where: { tenantId, exitAt: null },
      orderBy: { entryAt: 'asc' },
      take: 500,
    });
    if (!open.length) return { items: [], total: 0 };
    const minEntry = open[0]!.entryAt;
    const rows = await this.loadEnriched(
      tenantId,
      { ...query, visitStatus: undefined, period: 'custom' },
      { from: minEntry, to: new Date() },
      EXPORT_CAP,
    );
    const inside = rows
      .filter((r) => !r.exitAt)
      .sort((a, b) => a.entryAt.getTime() - b.entryAt.getTime());
    return {
      items: inside.map((row) => this.toJson(row)),
      total: inside.length,
    };
  }

  async departments(tenantId: string, query: EntryExitReportQueryDto) {
    const range = this.resolveRange(query);
    const rows = await this.loadEnriched(tenantId, query, range, EXPORT_CAP);
    const map = new Map<
      string,
      {
        departmentId: string | null;
        department: string;
        visits: number;
        entries: number;
        exits: number;
        inside: number;
        stayMinutes: number[];
      }
    >();
    for (const row of rows) {
      const key = row.departmentId ?? row.department ?? 'unknown';
      const rec = map.get(key) ?? {
        departmentId: row.departmentId,
        department: row.department ?? 'Unknown',
        visits: 0,
        entries: 0,
        exits: 0,
        inside: 0,
        stayMinutes: [],
      };
      rec.visits += 1;
      rec.entries += 1;
      if (row.exitAt) rec.exits += 1;
      if (!row.exitAt) rec.inside += 1;
      rec.stayMinutes.push(row.durationMinutes);
      map.set(key, rec);
    }
    return {
      range,
      rows: [...map.values()]
        .map((r) => ({
          departmentId: r.departmentId,
          department: r.department,
          visits: r.visits,
          entries: r.entries,
          exits: r.exits,
          currentlyInside: r.inside,
          averageStayMinutes: r.stayMinutes.length
            ? Math.round(
                r.stayMinutes.reduce((s, n) => s + n, 0) / r.stayMinutes.length,
              )
            : 0,
          maximumStayMinutes: r.stayMinutes.length
            ? Math.max(...r.stayMinutes)
            : 0,
        }))
        .sort((a, b) => b.visits - a.visits),
    };
  }

  async hourly(tenantId: string, query: EntryExitReportQueryDto) {
    const range = this.resolveRange(query);
    const rows = await this.loadEnriched(tenantId, query, range, EXPORT_CAP);
    const buckets = this.hourlyFrom(rows, range);
    const peak = buckets.reduce(
      (best, b) => (b.entries > best.entries ? b : best),
      buckets[0] ?? { hour: 8, entries: 0, exits: 0, footfall: 0 },
    );
    return {
      range,
      buckets,
      peakHour: { label: this.hourLabel(peak.hour), entries: peak.entries },
    };
  }

  async insights(tenantId: string, query: EntryExitReportQueryDto) {
    const range = this.resolveRange(query);
    const threshold = query.longStayMinutes ?? DEFAULT_LONG_STAY_MINUTES;
    const rows = await this.loadEnriched(tenantId, query, range, EXPORT_CAP);
    const byMember = new Map<
      string,
      { name: string; code: string; visits: number; minutes: number }
    >();
    const byDayMember = new Map<string, number>();
    for (const row of rows) {
      const key = row.memberCode ?? row.id;
      const rec = byMember.get(key) ?? {
        name: row.memberName,
        code: row.memberCode ?? '',
        visits: 0,
        minutes: 0,
      };
      rec.visits += 1;
      rec.minutes += row.durationMinutes;
      byMember.set(key, rec);
      const dayKey = `${row.date}|${key}`;
      byDayMember.set(dayKey, (byDayMember.get(dayKey) ?? 0) + 1);
    }
    const frequent = [...byMember.values()]
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 8);
    const hours = [...byMember.values()]
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 8);
    return {
      range,
      longStayMinutes: threshold,
      frequentVisitors: frequent,
      highestHours: hours,
      longStays: rows
        .filter((r) => r.durationMinutes >= threshold)
        .sort((a, b) => b.durationMinutes - a.durationMinutes)
        .slice(0, 20)
        .map((r) => this.toJson(r)),
      incompleteExits: rows
        .filter((r) => r.status === 'INCOMPLETE')
        .map((r) => this.toJson(r)),
      multipleVisitsSameDay: [...byDayMember.entries()].filter(
        ([, count]) => count > 1,
      ).length,
      firstEntry: rows.length
        ? this.toJson(rows.reduce((a, b) => (a.entryAt < b.entryAt ? a : b)))
        : null,
      lastExit: rows.filter((r) => r.exitAt).length
        ? this.toJson(
            rows
              .filter((r) => r.exitAt)
              .reduce((a, b) => (a.exitAt! > b.exitAt! ? a : b)),
          )
        : null,
    };
  }

  async studentHistory(
    tenantId: string,
    studentId: string,
    query: EntryExitReportQueryDto,
    includeContact: boolean,
  ) {
    const range = this.resolveRange(query);
    const rows = await this.loadEnriched(
      tenantId,
      { ...query, studentId, memberType: 'STUDENT' },
      range,
      EXPORT_CAP,
    );
    const student = await this.prisma.student.findFirst({
      where: { tenantId, id: studentId, deletedAt: null },
      include: {
        masterProfile: true,
        department: { select: { name: true } },
        programVersion: { include: { program: { select: { name: true } } } },
        academicStanding: { select: { currentSemesterSequence: true } },
      },
    });
    const minutes = rows.map((r) => r.durationMinutes);
    return {
      student: student
        ? {
            id: student.id,
            studentId: student.rollNumber ?? student.enrollmentNumber,
            name: student.masterProfile?.fullName ?? 'Unknown',
            department: student.department?.name ?? null,
            programme: student.programVersion?.program?.name ?? null,
            semester: student.academicStanding?.currentSemesterSequence ?? null,
            gender: this.bucketGender(student.masterProfile?.gender),
            mobile: includeContact
              ? (student.masterProfile?.mobileNumber ?? null)
              : null,
          }
        : null,
      summary: {
        totalVisits: rows.length,
        totalMinutes: minutes.reduce((s, n) => s + n, 0),
        averageMinutes: minutes.length
          ? Math.round(minutes.reduce((s, n) => s + n, 0) / minutes.length)
          : 0,
        longestMinutes: minutes.length ? Math.max(...minutes) : 0,
        firstVisit: rows.length
          ? rows.reduce((a, b) => (a.entryAt < b.entryAt ? a : b)).entryAt
          : null,
        lastVisit: rows.length
          ? rows.reduce((a, b) => (a.entryAt > b.entryAt ? a : b)).entryAt
          : null,
      },
      visits: rows.map((r) => this.toJson(r)),
    };
  }

  async exportExcel(tenantId: string, query: EntryExitReportQueryDto) {
    const { header, range, rows, filters } = await this.exportDataset(
      tenantId,
      query,
    );
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Bosco Connect Library';
    const ws = wb.addWorksheet('Entry Exit', {
      views: [{ state: 'frozen', ySplit: 8 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });
    const colCount = 11;
    ws.mergeCells(1, 1, 1, colCount);
    ws.mergeCells(2, 1, 2, colCount);
    ws.mergeCells(3, 1, 3, colCount);
    ws.mergeCells(4, 1, 4, colCount);
    ws.mergeCells(5, 1, 5, colCount);
    ws.mergeCells(6, 1, 6, colCount);
    ws.mergeCells(7, 1, 7, colCount);
    this.titleCell(ws.getCell('A1'), header.collegeName, 16);
    this.titleCell(ws.getCell('A2'), 'LIBRARY', 13);
    this.titleCell(ws.getCell('A3'), 'LIBRARY ENTRY & EXIT REPORT', 14);
    ws.getCell('A4').value =
      `Date Range: ${this.formatLongDate(range.from)} – ${this.formatLongDate(range.to)}`;
    ws.getCell('A5').value =
      `Generated On: ${this.formatLongDateTime(new Date())}`;
    ws.getCell('A6').value = `Filters: ${filters}`;
    ws.getCell('A7').value = `Records: ${rows.length}`;
    for (const r of [4, 5, 6, 7]) {
      ws.getCell(`A${r}`).font = { size: 10, color: { argb: 'FF334155' } };
      ws.getCell(`A${r}`).alignment = { horizontal: 'left' };
    }

    const headers = [
      'Student ID',
      'Student Name',
      'Department',
      'Course',
      'Year/Semester',
      'Gender',
      'Date',
      'In Time',
      'Out Time',
      'Stay Duration',
      'Status',
    ];
    const headerRow = ws.getRow(8);
    headers.forEach((label, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = label;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0A0F1E' },
      };
      cell.font = { bold: true, color: { argb: 'FF67E8F9' }, size: 11 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      cell.border = this.thinBorder('FF22D3EE');
    });
    headerRow.height = 22;

    rows.forEach((row, idx) => {
      const excelRow = ws.addRow([
        row.memberCode ?? '',
        row.memberName,
        row.department ?? '',
        row.programme ?? '',
        row.semester != null ? String(row.semester) : '',
        row.gender ?? '',
        this.formatDate(row.entryAt),
        this.formatTime(row.entryAt),
        row.exitAt ? this.formatTime(row.exitAt) : '—',
        row.stayLabel,
        this.statusLabel(row.status),
      ]);
      excelRow.eachCell((cell) => {
        cell.border = this.thinBorder('FFCBD5E1');
        cell.font = { size: 10, color: { argb: 'FF0F172A' } };
        if (idx % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFECFEFF' },
          };
        }
      });
      const statusCell = excelRow.getCell(11);
      if (row.status === 'INSIDE') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD1FAE5' },
        };
      } else if (row.status === 'INCOMPLETE') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEF3C7' },
        };
      }
    });

    [14, 28, 22, 22, 14, 12, 14, 12, 12, 14, 16].forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
    ws.headerFooter.oddFooter = '&LLibrary Entry & Exit Report&RPage &P of &N';
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return {
      buffer,
      filename: `library-entry-exit-${this.formatDate(range.from)}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async exportCsv(tenantId: string, query: EntryExitReportQueryDto) {
    const { rows } = await this.exportDataset(tenantId, query);
    const header = [
      'Student ID',
      'Student Name',
      'Department',
      'Course',
      'Year/Semester',
      'Gender',
      'Date',
      'In Time',
      'Out Time',
      'Stay Duration',
      'Status',
    ];
    const lines = [
      header.map((h) => this.csvCell(h)).join(','),
      ...rows.map((row) =>
        [
          row.memberCode ?? '',
          row.memberName,
          row.department ?? '',
          row.programme ?? '',
          row.semester != null ? String(row.semester) : '',
          row.gender ?? '',
          this.formatDate(row.entryAt),
          this.formatTime(row.entryAt),
          row.exitAt ? this.formatTime(row.exitAt) : '',
          row.stayLabel,
          this.statusLabel(row.status),
        ]
          .map((v) => this.csvCell(v))
          .join(','),
      ),
    ];
    const csv = `\uFEFF${lines.join('\n')}`;
    return {
      buffer: Buffer.from(csv, 'utf8'),
      filename: `library-entry-exit.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  async exportPdf(tenantId: string, query: EntryExitReportQueryDto) {
    const { header, range, rows, filters, kpis } = await this.exportDataset(
      tenantId,
      query,
    );
    const html = this.pdfHtml(header, range, filters, kpis, rows);
    const buffer = await this.htmlToPdf(html);
    return {
      buffer,
      filename: `library-entry-exit.pdf`,
      contentType: 'application/pdf',
    };
  }

  private async exportDataset(
    tenantId: string,
    query: EntryExitReportQueryDto,
  ) {
    const range = this.resolveRange(query);
    const [header, rows] = await Promise.all([
      this.institutionHeader(tenantId),
      this.loadEnriched(tenantId, query, range, EXPORT_CAP),
    ]);
    return {
      header,
      range,
      rows: this.sortRows(
        rows,
        query.sortBy ?? 'entryAt',
        query.sortDir ?? 'desc',
      ),
      filters: this.filterLabel(query),
      kpis: this.computeKpis(rows),
    };
  }

  private async loadEnriched(
    tenantId: string,
    query: EntryExitReportQueryDto,
    range: { from: Date; to: Date },
    take: number,
  ): Promise<EnrichedVisit[]> {
    const memberFilter = await this.memberIdFilter(tenantId, query);
    const where: Prisma.LibraryVisitWhereInput = {
      tenantId,
      entryAt: { gte: range.from, lte: range.to },
      ...(query.memberType && query.memberType !== 'ALL'
        ? { memberType: query.memberType }
        : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...memberFilter,
      ...this.statusWhere(query.visitStatus),
    };
    const visits = await this.prisma.libraryVisit.findMany({
      where,
      orderBy: { entryAt: 'desc' },
      take,
      include: { zone: { select: { name: true } } },
    });
    const studentIds = [
      ...new Set(visits.map((v) => v.studentId).filter(Boolean)),
    ] as string[];
    const staffIds = [
      ...new Set(visits.map((v) => v.staffProfileId).filter(Boolean)),
    ] as string[];
    const visitorIds = [
      ...new Set(visits.map((v) => v.visitorId).filter(Boolean)),
    ] as string[];
    const [students, staff, visitors] = await Promise.all([
      studentIds.length
        ? this.prisma.student.findMany({
            where: { tenantId, id: { in: studentIds } },
            include: {
              masterProfile: true,
              department: { select: { id: true, name: true } },
              programVersion: {
                include: { program: { select: { id: true, name: true } } },
              },
              academicStanding: {
                select: { currentSemesterSequence: true },
              },
            },
          })
        : [],
      staffIds.length
        ? this.prisma.staffProfile.findMany({
            where: { tenantId, id: { in: staffIds } },
            include: { department: { select: { id: true, name: true } } },
          })
        : [],
      visitorIds.length
        ? this.prisma.libraryVisitor.findMany({
            where: { tenantId, id: { in: visitorIds } },
          })
        : [],
    ]);
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const staffMap = new Map(staff.map((s) => [s.id, s]));
    const visitorMap = new Map(visitors.map((v) => [v.id, v]));
    const now = Date.now();
    const startToday = this.startOfDay(new Date());
    const enriched: EnrichedVisit[] = [];
    for (const visit of visits) {
      if (!this.inTimeRange(visit.entryAt, query.timeRange)) continue;
      const student = visit.studentId
        ? studentMap.get(visit.studentId)
        : undefined;
      const staffMember = visit.staffProfileId
        ? staffMap.get(visit.staffProfileId)
        : undefined;
      const visitor = visit.visitorId
        ? visitorMap.get(visit.visitorId)
        : undefined;
      const gender = this.bucketGender(
        student?.masterProfile?.gender ?? staffMember?.gender,
      );
      if (query.gender && query.gender !== 'ALL' && gender !== query.gender) {
        continue;
      }
      const durationMinutes = visit.exitAt
        ? (visit.durationMinutes ??
          Math.max(
            0,
            Math.round(
              (visit.exitAt.getTime() - visit.entryAt.getTime()) / 60000,
            ),
          ))
        : Math.max(0, Math.round((now - visit.entryAt.getTime()) / 60000));
      const status: VisitStatus = visit.exitAt
        ? 'EXITED'
        : visit.entryAt < startToday
          ? 'INCOMPLETE'
          : 'INSIDE';
      enriched.push({
        id: visit.id,
        memberType: visit.memberType,
        studentId: visit.studentId,
        staffProfileId: visit.staffProfileId,
        visitorId: visit.visitorId,
        memberId: visit.studentId ?? visit.staffProfileId ?? visit.visitorId,
        memberCode:
          student?.rollNumber ??
          student?.enrollmentNumber ??
          staffMember?.employeeCode ??
          visitor?.passNumber ??
          null,
        memberName:
          student?.masterProfile?.fullName ??
          staffMember?.fullName ??
          visitor?.fullName ??
          'Unknown',
        departmentId:
          student?.departmentId ?? staffMember?.departmentId ?? null,
        department:
          student?.department?.name ??
          staffMember?.department?.name ??
          visitor?.institution ??
          null,
        programme: student?.programVersion?.program?.name ?? null,
        semester: student?.academicStanding?.currentSemesterSequence ?? null,
        gender,
        mobile: student?.masterProfile?.mobileNumber ?? visitor?.mobile ?? null,
        date: this.formatDate(visit.entryAt),
        entryAt: visit.entryAt,
        exitAt: visit.exitAt,
        durationMinutes,
        stayLabel: this.durationLabel(durationMinutes),
        status,
        zoneName: visit.zone?.name ?? null,
        seatLabel: visit.seatLabel,
      });
    }
    return enriched;
  }

  private async memberIdFilter(
    tenantId: string,
    query: EntryExitReportQueryDto,
  ): Promise<Prisma.LibraryVisitWhereInput> {
    const needsStudentScan = Boolean(
      query.departmentId ||
      query.programId ||
      query.semester != null ||
      (query.search && query.search.trim()),
    );
    if (!needsStudentScan) return {};

    const search = query.search?.trim();
    const studentWhere: Prisma.StudentWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.programId
        ? { programVersion: { programId: query.programId } }
        : {}),
      ...(query.semester != null
        ? { academicStanding: { currentSemesterSequence: query.semester } }
        : {}),
      ...(search
        ? {
            OR: [
              { rollNumber: { contains: search, mode: 'insensitive' } },
              { enrollmentNumber: { contains: search, mode: 'insensitive' } },
              {
                masterProfile: {
                  is: {
                    OR: [
                      { fullName: { contains: search, mode: 'insensitive' } },
                      {
                        mobileNumber: { contains: search, mode: 'insensitive' },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [students, staff, visitors] = await Promise.all([
      this.prisma.student.findMany({
        where: studentWhere,
        select: { id: true },
        take: 4_000,
      }),
      search
        ? this.prisma.staffProfile.findMany({
            where: {
              tenantId,
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { employeeCode: { contains: search, mode: 'insensitive' } },
              ],
            },
            select: { id: true },
            take: 500,
          })
        : [],
      search
        ? this.prisma.libraryVisitor.findMany({
            where: {
              tenantId,
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { passNumber: { contains: search, mode: 'insensitive' } },
                { mobile: { contains: search, mode: 'insensitive' } },
              ],
            },
            select: { id: true },
            take: 500,
          })
        : [],
    ]);
    const or: Prisma.LibraryVisitWhereInput[] = [];
    if (students.length)
      or.push({ studentId: { in: students.map((s) => s.id) } });
    if (staff.length)
      or.push({ staffProfileId: { in: staff.map((s) => s.id) } });
    if (visitors.length)
      or.push({ visitorId: { in: visitors.map((v) => v.id) } });
    if (!or.length) return { id: { in: [] } };
    return { OR: or };
  }

  private statusWhere(
    status?: EntryExitReportQueryDto['visitStatus'],
  ): Prisma.LibraryVisitWhereInput {
    if (!status || status === 'ALL') return {};
    const startToday = this.startOfDay(new Date());
    if (status === 'EXITED') return { exitAt: { not: null } };
    if (status === 'INSIDE') {
      return { exitAt: null, entryAt: { gte: startToday } };
    }
    return { exitAt: null, entryAt: { lt: startToday } };
  }

  private resolveRange(query: EntryExitReportQueryDto) {
    const now = new Date();
    const period =
      query.period ?? (query.from || query.to ? 'custom' : 'today');
    if (period === 'custom' || query.from || query.to) {
      const from = query.from
        ? this.parseStart(query.from)
        : this.startOfDay(now);
      const to = query.to ? this.parseEnd(query.to) : now;
      return { from, to };
    }
    if (period === 'yesterday') {
      const from = this.startOfDay(now);
      from.setDate(from.getDate() - 1);
      const to = this.startOfDay(now);
      to.setMilliseconds(-1);
      return { from, to };
    }
    if (period === 'week') {
      const from = this.startOfDay(now);
      const day = from.getDay() || 7;
      from.setDate(from.getDate() - day + 1);
      return { from, to: now };
    }
    if (period === 'month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to: now };
    }
    if (period === 'year') {
      const year =
        now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
      return { from: new Date(year, 6, 1), to: now };
    }
    return { from: this.startOfDay(now), to: now };
  }

  private previousRange(range: { from: Date; to: Date }) {
    const span = range.to.getTime() - range.from.getTime();
    return {
      from: new Date(range.from.getTime() - span),
      to: new Date(range.from.getTime() - 1),
    };
  }

  private computeKpis(rows: EnrichedVisit[]) {
    const stays = rows.map((r) => r.durationMinutes);
    return {
      totalVisits: rows.length,
      totalEntries: rows.length,
      totalExits: rows.filter((r) => r.exitAt).length,
      currentlyInside: rows.filter((r) => !r.exitAt).length,
      averageStayMinutes: stays.length
        ? Math.round(stays.reduce((s, n) => s + n, 0) / stays.length)
        : 0,
      longestStayMinutes: stays.length ? Math.max(...stays) : 0,
      male: rows.filter((r) => r.gender === 'MALE').length,
      female: rows.filter((r) => r.gender === 'FEMALE').length,
    };
  }

  private hourlyFrom(rows: EnrichedVisit[], range: { from: Date; to: Date }) {
    const startHour = 8;
    const endHour = 18;
    const buckets = Array.from({ length: endHour - startHour + 1 }, (_, i) => {
      const hour = startHour + i;
      return {
        hour,
        label: this.hourLabel(hour),
        entries: 0,
        exits: 0,
        footfall: 0,
      };
    });
    for (const row of rows) {
      const eh = row.entryAt.getHours();
      const entryBucket = buckets.find((b) => b.hour === eh);
      if (entryBucket) {
        entryBucket.entries += 1;
        entryBucket.footfall += 1;
      }
      if (row.exitAt) {
        const xh = row.exitAt.getHours();
        const exitBucket = buckets.find((b) => b.hour === xh);
        if (exitBucket) exitBucket.exits += 1;
      }
    }
    void range;
    return buckets;
  }

  private sortRows(
    rows: EnrichedVisit[],
    sortBy: NonNullable<EntryExitReportQueryDto['sortBy']>,
    sortDir: 'asc' | 'desc',
  ) {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'exitAt') {
        cmp = (a.exitAt?.getTime() ?? 0) - (b.exitAt?.getTime() ?? 0);
      } else if (sortBy === 'duration') {
        cmp = a.durationMinutes - b.durationMinutes;
      } else if (sortBy === 'department') {
        cmp = (a.department ?? '').localeCompare(b.department ?? '');
      } else if (sortBy === 'name') {
        cmp = a.memberName.localeCompare(b.memberName);
      } else {
        cmp = a.entryAt.getTime() - b.entryAt.getTime();
      }
      return cmp * dir;
    });
  }

  private async institutionHeader(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    return {
      collegeName: tenant?.name ?? 'Don Bosco College Tura',
      libraryName: 'LIBRARY',
    };
  }

  private toJson(row: EnrichedVisit) {
    return {
      id: row.id,
      memberType: row.memberType,
      studentId: row.studentId,
      memberCode: row.memberCode,
      memberName: row.memberName,
      departmentId: row.departmentId,
      department: row.department,
      programme: row.programme,
      semester: row.semester,
      gender: row.gender,
      date: row.date,
      entryAt: row.entryAt.toISOString(),
      exitAt: row.exitAt?.toISOString() ?? null,
      inTime: this.formatTime(row.entryAt),
      outTime: row.exitAt ? this.formatTime(row.exitAt) : '—',
      durationMinutes: row.durationMinutes,
      stayLabel: row.stayLabel,
      status: row.status,
      statusLabel: this.statusLabel(row.status),
      zoneName: row.zoneName,
      seatLabel: row.seatLabel,
    };
  }

  private filterLabel(query: EntryExitReportQueryDto) {
    const parts = [
      `Department: ${query.departmentId ? 'Selected' : 'All'}`,
      `User Type: ${query.memberType && query.memberType !== 'ALL' ? query.memberType : 'All'}`,
      `Status: ${query.visitStatus && query.visitStatus !== 'ALL' ? query.visitStatus : 'All'}`,
    ];
    if (query.search) parts.push(`Search: ${query.search}`);
    return parts.join(' · ');
  }

  private deltaPct(current: number, previous: number) {
    if (previous <= 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  }

  private bucketGender(raw?: string | null) {
    const g = (raw ?? '').toUpperCase();
    if (g.startsWith('M')) return 'MALE';
    if (g.startsWith('F')) return 'FEMALE';
    return raw ? 'OTHER' : null;
  }

  private inTimeRange(
    entryAt: Date,
    range?: EntryExitReportQueryDto['timeRange'],
  ) {
    if (!range || range === 'ALL') return true;
    const hour = entryAt.getHours();
    if (range === 'MORNING') return hour >= 5 && hour < 12;
    if (range === 'AFTERNOON') return hour >= 12 && hour < 17;
    return hour >= 17 || hour < 5;
  }

  private startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private parseStart(value: string) {
    const d = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) d.setHours(0, 0, 0, 0);
    return d;
  }

  private parseEnd(value: string) {
    const d = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) d.setHours(23, 59, 59, 999);
    return d;
  }

  private durationLabel(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h <= 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  private statusLabel(status: VisitStatus) {
    if (status === 'INSIDE') return 'Currently Inside';
    if (status === 'INCOMPLETE') return 'Incomplete';
    return 'Exited';
  }

  private hourLabel(hour: number) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hour)}:00–${pad(hour + 1)}:00`;
  }

  private formatDate(d: Date) {
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private formatTime(d: Date) {
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  private formatLongDate(d: Date) {
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  private formatLongDateTime(d: Date) {
    return `${this.formatLongDate(d)}, ${this.formatTime(d)}`;
  }

  private csvCell(value: string) {
    if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
    return value;
  }

  private titleCell(cell: ExcelJS.Cell, text: string, size: number) {
    cell.value = text;
    cell.font = { bold: true, size, color: { argb: 'FF0A0F1E' } };
    cell.alignment = { horizontal: 'center' };
  }

  private thinBorder(color: string): Partial<ExcelJS.Borders> {
    const edge: Partial<ExcelJS.Border> = {
      style: 'thin',
      color: { argb: color },
    };
    return { top: edge, left: edge, bottom: edge, right: edge };
  }

  private pdfHtml(
    header: { collegeName: string; libraryName: string },
    range: { from: Date; to: Date },
    filters: string,
    kpis: ReturnType<LibraryEntryExitReportsService['computeKpis']>,
    rows: EnrichedVisit[],
  ) {
    const body = rows
      .slice(0, 500)
      .map(
        (row, i) =>
          `<tr><td>${i + 1}</td><td>${this.esc(row.memberCode ?? '')}</td><td>${this.esc(row.memberName)}</td><td>${this.esc(row.department ?? '')}</td><td>${this.esc(row.programme ?? '')}</td><td>${row.semester ?? ''}</td><td>${this.formatDate(row.entryAt)}</td><td>${this.formatTime(row.entryAt)}</td><td>${row.exitAt ? this.formatTime(row.exitAt) : '—'}</td><td>${row.stayLabel}</td><td>${this.statusLabel(row.status)}</td></tr>`,
      )
      .join('');
    return `<!doctype html><html><head><meta charset="utf-8"/><style>
      body{font-family:Segoe UI,system-ui,sans-serif;color:#0f172a;font-size:11px}
      h1,h2,h3{margin:0;text-align:center}
      h1{font-size:18px} h2{font-size:13px;letter-spacing:.12em;margin-top:4px} h3{font-size:14px;margin:10px 0}
      .meta{margin:10px 0;color:#334155}
      .kpis{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
      .kpi{border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;min-width:110px}
      .kpi b{display:block;font-size:16px}
      table{width:100%;border-collapse:collapse}
      th{background:#0a0f1e;color:#67e8f9;padding:6px;border:1px solid #0a0f1e}
      td{border:1px solid #cbd5e1;padding:5px}
      tr:nth-child(even) td{background:#ecfeff}
      .empty{text-align:center;color:#64748b;padding:24px}
    </style></head><body>
      <h1>${this.esc(header.collegeName)}</h1>
      <h2>${this.esc(header.libraryName)}</h2>
      <h3>LIBRARY ENTRY &amp; EXIT REPORT</h3>
      <div class="meta">Date Range: ${this.formatLongDate(range.from)} – ${this.formatLongDate(range.to)}<br/>Generated On: ${this.formatLongDateTime(new Date())}<br/>Filters: ${this.esc(filters)}</div>
      <div class="kpis">
        <div class="kpi">Total visits<b>${kpis.totalVisits}</b></div>
        <div class="kpi">Entries<b>${kpis.totalEntries}</b></div>
        <div class="kpi">Exits<b>${kpis.totalExits}</b></div>
        <div class="kpi">Inside<b>${kpis.currentlyInside}</b></div>
        <div class="kpi">Avg stay<b>${this.durationLabel(kpis.averageStayMinutes)}</b></div>
      </div>
      ${
        rows.length
          ? `<table><thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Department</th><th>Course</th><th>Year</th><th>Date</th><th>In</th><th>Out</th><th>Duration</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`
          : `<p class="empty">No library visit records found for the selected filters.</p>`
      }
    </body></html>`;
  }

  private esc(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
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
        landscape: true,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate:
          '<div style="font-size:9px;width:100%;padding:0 12mm;color:#64748b;display:flex;justify-content:space-between;"><span>Library Entry & Exit Report</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
        margin: { top: '12mm', right: '10mm', bottom: '16mm', left: '10mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
