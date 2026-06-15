import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../../database/prisma.service';
import { academicYearLabel } from '../constants/governance.constants';
import type { ReportExportDto } from '../dto/governance.dto';
import {
  renderGovernanceReportHtml,
  rowsToCsv,
} from '../templates/governance-report.template';
import { GovernancePdfService } from './governance-pdf.service';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: GovernancePdfService,
  ) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async export(tenantId: string, dto: ReportExportDto) {
    const dataset = await this.buildDataset(tenantId, dto);
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
    });

    if (dto.format === 'csv') {
      const csv = rowsToCsv(dataset.columns, dataset.rows);
      return {
        fileName: `${dto.reportType}.csv`,
        mimeType: 'text/csv',
        buffer: Buffer.from(csv, 'utf8'),
      };
    }

    if (dto.format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Report');
      sheet.addRow(dataset.columns);
      for (const row of dataset.rows) {
        sheet.addRow(dataset.columns.map((col) => row[col] ?? ''));
      }
      sheet.getRow(1).font = { bold: true };
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      return {
        fileName: `${dto.reportType}.xlsx`,
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer,
      };
    }

    const html = renderGovernanceReportHtml({
      institutionName: tenant?.name ?? 'Institution',
      reportTitle: dataset.title,
      generatedAt: new Date().toLocaleString('en-IN'),
      academicYear: dto.academicYear,
      columns: dataset.columns,
      rows: dataset.rows,
    });
    const buffer = await this.pdf.htmlToPdf(html);
    return {
      fileName: `${dto.reportType}.pdf`,
      mimeType: 'application/pdf',
      buffer,
    };
  }

  private async buildDataset(tenantId: string, dto: ReportExportDto) {
    switch (dto.reportType) {
      case 'committee-summary':
        return this.committeeSummary(tenantId);
      case 'meeting-register':
        return this.meetingRegister(tenantId, dto);
      case 'attendance-summary':
        return this.attendanceSummary(tenantId, dto);
      case 'atr-register':
        return this.atrRegister(tenantId, dto);
      case 'task-register':
        return this.taskRegister(tenantId, dto);
      case 'naac-evidence':
        return this.naacEvidence(tenantId);
      case 'performance-scorecard':
        return this.performanceScorecard(
          tenantId,
          dto.academicYear ?? academicYearLabel(),
        );
      default:
        throw new BadRequestException('Unsupported report type');
    }
  }

  private async committeeSummary(tenantId: string) {
    const committees = await this.db().governanceCommittee.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { members: true, meetings: true, actionItems: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      title: 'Committee Summary',
      columns: [
        'Code',
        'Name',
        'Category',
        'Status',
        'Members',
        'Meetings',
        'ATR Items',
      ],
      rows: committees.map((c: Record<string, unknown>) => ({
        Code: (c.shortCode as string) ?? '',
        Name: c.name,
        Category: c.category,
        Status: c.status,
        Members: (c._count as { members: number }).members,
        Meetings: (c._count as { meetings: number }).meetings,
        'ATR Items': (c._count as { actionItems: number }).actionItems,
      })),
    };
  }

  private async meetingRegister(tenantId: string, dto: ReportExportDto) {
    const where: Record<string, unknown> = { tenantId };
    if (dto.committeeId) where.committeeId = dto.committeeId;
    if (dto.from || dto.to) {
      where.meetingDate = {};
      if (dto.from)
        (where.meetingDate as Record<string, Date>).gte = new Date(dto.from);
      if (dto.to)
        (where.meetingDate as Record<string, Date>).lte = new Date(dto.to);
    }

    const meetings = await this.db().governanceMeeting.findMany({
      where,
      include: { committee: { select: { shortCode: true } } },
      orderBy: { meetingDate: 'desc' },
    });

    return {
      title: 'Meeting Register',
      columns: ['Date', 'Committee', 'Title', 'Mode', 'Status', 'Venue'],
      rows: meetings.map((m: Record<string, unknown>) => ({
        Date: new Date(m.meetingDate as string).toLocaleDateString('en-IN'),
        Committee: (m.committee as { shortCode: string }).shortCode,
        Title: m.title,
        Mode: m.meetingMode,
        Status: m.status,
        Venue: m.venue ?? '—',
      })),
    };
  }

  private async attendanceSummary(tenantId: string, dto: ReportExportDto) {
    const where: Record<string, unknown> = { tenantId };
    if (dto.committeeId) where.meeting = { committeeId: dto.committeeId };

    const rows = await this.db().governanceMeetingAttendance.findMany({
      where,
      include: {
        meeting: {
          select: {
            title: true,
            meetingDate: true,
            committee: { select: { shortCode: true } },
          },
        },
      },
      orderBy: { markedAt: 'desc' },
      take: 500,
    });

    return {
      title: 'Attendance Summary',
      columns: ['Date', 'Committee', 'Meeting', 'Member', 'Status', 'Method'],
      rows: rows.map((r: Record<string, unknown>) => ({
        Date: new Date(
          (r.meeting as { meetingDate: string }).meetingDate,
        ).toLocaleDateString('en-IN'),
        Committee: (r.meeting as { committee: { shortCode: string } }).committee
          .shortCode,
        Meeting: (r.meeting as { title: string }).title,
        Member: r.displayName ?? '—',
        Status: r.status,
        Method: r.method,
      })),
    };
  }

  private async atrRegister(tenantId: string, dto: ReportExportDto) {
    const where: Record<string, unknown> = { tenantId };
    if (dto.committeeId) where.committeeId = dto.committeeId;

    const items = await this.db().governanceActionItem.findMany({
      where,
      include: { committee: { select: { shortCode: true } } },
      orderBy: { targetDate: 'asc' },
    });

    return {
      title: 'Action Taken Report Register',
      columns: [
        'Committee',
        'Action Item',
        'Assigned To',
        'Target Date',
        'Status',
        'Priority',
      ],
      rows: items.map((i: Record<string, unknown>) => ({
        Committee: (i.committee as { shortCode: string }).shortCode,
        'Action Item': i.actionItem,
        'Assigned To': i.assignedName ?? '—',
        'Target Date': i.targetDate
          ? new Date(i.targetDate as string).toLocaleDateString('en-IN')
          : '—',
        Status: i.status,
        Priority: i.priority,
      })),
    };
  }

  private async taskRegister(tenantId: string, dto: ReportExportDto) {
    const where: Record<string, unknown> = { tenantId };
    if (dto.committeeId) where.committeeId = dto.committeeId;

    const tasks = await this.db().governanceTask.findMany({
      where,
      include: { committee: { select: { shortCode: true } } },
      orderBy: { dueDate: 'asc' },
    });

    return {
      title: 'Task Register',
      columns: ['Committee', 'Title', 'Assigned To', 'Due Date', 'Status'],
      rows: tasks.map((t: Record<string, unknown>) => ({
        Committee: (t.committee as { shortCode: string }).shortCode,
        Title: t.title,
        'Assigned To': t.assignedName ?? '—',
        'Due Date': t.dueDate
          ? new Date(t.dueDate as string).toLocaleDateString('en-IN')
          : '—',
        Status: t.status,
      })),
    };
  }

  private async naacEvidence(tenantId: string) {
    const tags = await this.db().governanceNaacTag.findMany({
      where: { tenantId },
      orderBy: [{ criterion: 'asc' }, { createdAt: 'desc' }],
    });

    return {
      title: 'NAAC Evidence Register',
      columns: [
        'Criterion',
        'Entity Type',
        'Entity ID',
        'Evidence Notes',
        'Created',
      ],
      rows: tags.map((t: Record<string, unknown>) => ({
        Criterion: t.criterion,
        'Entity Type': t.entityType,
        'Entity ID': t.entityId,
        'Evidence Notes': t.evidenceNotes ?? '—',
        Created: new Date(t.createdAt as string).toLocaleDateString('en-IN'),
      })),
    };
  }

  private async performanceScorecard(tenantId: string, academicYear: string) {
    const snapshots = await this.db().governancePerformanceSnapshot.findMany({
      where: { tenantId, academicYear },
      include: { committee: { select: { shortCode: true, name: true } } },
      orderBy: { scoreTotal: 'desc' },
    });

    return {
      title: 'Performance Scorecard',
      columns: ['Committee', 'Name', 'Score', 'Academic Year'],
      rows: snapshots.map((s: Record<string, unknown>) => ({
        Committee: (s.committee as { shortCode: string }).shortCode,
        Name: (s.committee as { name: string }).name,
        Score: Number(s.scoreTotal).toFixed(2),
        'Academic Year': s.academicYear,
      })),
    };
  }
}
