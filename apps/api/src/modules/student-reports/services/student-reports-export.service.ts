import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type { StudentReportExportDto } from '../dto/student-reports.dto';
import type {
  CombinationReport,
  DistributionReport,
  ReportBucket,
} from '../student-reports.types';
import { StudentReportsService } from './student-reports.service';

@Injectable()
export class StudentReportsExportService {
  constructor(private readonly reports: StudentReportsService) {}

  async export(
    tenantId: string,
    dto: StudentReportExportDto,
    user?: JwtUser,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const data = await this.reports.getReportByType(
      tenantId,
      dto.reportType,
      dto,
      user,
    );

    if (dto.format === 'csv') {
      return {
        buffer: Buffer.from(this.toCsv(data, dto.reportType), 'utf-8'),
        filename: `student_report_${dto.reportType}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    const buffer = await this.toXlsx(data, dto.reportType);
    return {
      buffer,
      filename: `student_report_${dto.reportType}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private toCsv(data: unknown, reportType: string): string {
    const lines: string[] = [`Report Type,${reportType}`, ''];

    if (this.isCombinationReport(data)) {
      lines.push('Major,Minor,Count');
      for (const row of data.combinations) {
        lines.push(`"${row.major}","${row.minor}",${row.count}`);
      }
      return lines.join('\n');
    }

    if (this.isDistributionReport(data)) {
      lines.push(`Title,${data.title}`);
      lines.push(`Total,${data.total}`);
      lines.push('');
      lines.push('Label,Count,Percentage');
      for (const b of data.buckets) {
        lines.push(`"${b.label}",${b.count},${b.percentage ?? ''}`);
      }
      if (data.crossTabs?.length) {
        for (const tab of data.crossTabs) {
          lines.push('');
          lines.push(`Cross Tab — ${tab.label}`);
          lines.push('Label,Count,Percentage');
          for (const b of tab.buckets) {
            lines.push(`"${b.label}",${b.count},${b.percentage ?? ''}`);
          }
        }
      }
      return lines.join('\n');
    }

    lines.push(JSON.stringify(data));
    return lines.join('\n');
  }

  private async toXlsx(data: unknown, reportType: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '1505 ERP';
    const sheet = workbook.addWorksheet('Report');

    sheet.addRow(['Report Type', reportType]);
    sheet.addRow(['Generated At', new Date().toISOString()]);
    sheet.addRow([]);

    if (this.isCombinationReport(data)) {
      sheet.addRow(['Major', 'Minor', 'Count']);
      for (const row of data.combinations) {
        sheet.addRow([row.major, row.minor, row.count]);
      }
    } else if (this.isDistributionReport(data)) {
      sheet.addRow(['Title', data.title]);
      sheet.addRow(['Total', data.total]);
      sheet.addRow([]);
      this.addBucketSheet(workbook, 'Summary', data.buckets);
      if (data.crossTabs?.length) {
        for (const tab of data.crossTabs) {
          this.addBucketSheet(workbook, tab.label.slice(0, 31), tab.buckets);
        }
      }
    } else if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(
        data as Record<string, unknown>,
      )) {
        if (Array.isArray(value) && value.length && this.isBucket(value[0])) {
          sheet.addRow([key]);
          sheet.addRow(['Label', 'Count', 'Percentage']);
          for (const b of value as ReportBucket[]) {
            sheet.addRow([b.label, b.count, b.percentage ?? '']);
          }
          sheet.addRow([]);
        } else if (typeof value !== 'object') {
          sheet.addRow([key, value]);
        }
      }
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private addBucketSheet(
    workbook: ExcelJS.Workbook,
    name: string,
    buckets: ReportBucket[],
  ) {
    const sheet = workbook.addWorksheet(name.slice(0, 31));
    sheet.addRow(['Label', 'Count', 'Percentage']);
    for (const b of buckets) {
      sheet.addRow([b.label, b.count, b.percentage ?? '']);
    }
  }

  private isBucket(v: unknown): v is ReportBucket {
    return Boolean(v && typeof v === 'object' && 'label' in v && 'count' in v);
  }

  private isDistributionReport(data: unknown): data is DistributionReport {
    return Boolean(
      data && typeof data === 'object' && 'buckets' in data && 'title' in data,
    );
  }

  private isCombinationReport(data: unknown): data is CombinationReport {
    return Boolean(data && typeof data === 'object' && 'combinations' in data);
  }
}
