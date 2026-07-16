import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type {
  StudentReportExportDto,
  SubjectStrengthExportDto,
} from '../dto/student-reports.dto';
import type {
  CombinationReport,
  DepartmentStrengthReport,
  DepartmentStrengthStudentsReport,
  DepartmentSubjectSummaryReport,
  DistributionReport,
  ReportBucket,
  SubjectStrengthReport,
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
    return this.serialize(data, dto.reportType, dto.format);
  }

  async exportSubjectStrengthHub(
    tenantId: string,
    dto: SubjectStrengthExportDto,
    user?: JwtUser,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const variant = dto.variant ?? 'department';
    const format =
      dto.format === 'csv' ? 'csv' : dto.format === 'pdf' ? 'pdf' : 'xlsx';
    const reportType =
      variant === 'subject'
        ? 'subject-strength'
        : variant === 'department-summary'
          ? 'subject-strength-department-summary'
          : variant === 'department-students'
            ? 'subject-strength-department-students'
            : 'subject-strength-department';

    const data = await this.reports.getReportByType(
      tenantId,
      reportType,
      dto,
      user,
    );
    return this.serialize(data, reportType, format);
  }

  private async serialize(
    data: unknown,
    reportType: string,
    format: 'xlsx' | 'csv' | 'pdf',
  ) {
    if (format === 'csv') {
      return {
        buffer: Buffer.from(this.toCsv(data, reportType), 'utf-8'),
        filename: `student_report_${reportType}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }
    if (format === 'pdf') {
      const buffer = await this.toPdf(data, reportType);
      return {
        buffer,
        filename: `student_report_${reportType}.pdf`,
        contentType: 'application/pdf',
      };
    }
    const buffer = await this.toXlsx(data, reportType);
    return {
      buffer,
      filename: `student_report_${reportType}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private toCsv(data: unknown, reportType: string): string {
    const lines: string[] = [`Report Type,${reportType}`, ''];

    if (this.isDepartmentStrengthReport(data)) {
      lines.push(`Title,${data.title}`);
      lines.push(`Semester,${data.semesterLabel ?? ''}`);
      lines.push(`Academic Year,${data.academicYearLabel ?? ''}`);
      lines.push(`Total Departments,${data.summary.totalDepartments}`);
      lines.push(`Total Students,${data.summary.totalStudents}`);
      lines.push('');
      lines.push('Department,Major Subject,Total Students');
      for (const row of data.rows) {
        lines.push(
          `"${row.departmentName}","${row.majorSubjectName}",${row.studentCount}`,
        );
      }
      return lines.join('\n');
    }

    if (this.isDepartmentStudentsReport(data)) {
      lines.push(`Title,${data.title}`);
      lines.push(`Total,${data.total}`);
      lines.push('');
      lines.push(
        'Enrollment Number,Roll Number,Student Name,Major Department,Minor Department,Mobile Number,Admission Status',
      );
      for (const s of data.students) {
        lines.push(
          `"${s.enrollmentNumber}","${s.rollNumber}","${s.fullName}","${s.majorDepartment}","${s.minorDepartment}","${s.mobileNumber}","${s.admissionStatus}"`,
        );
      }
      return lines.join('\n');
    }

    if (this.isDepartmentSubjectSummaryReport(data)) {
      lines.push(`Title,${data.title}`);
      lines.push(`Semester,${data.semesterLabel ?? ''}`);
      lines.push('');
      lines.push(
        'Department,Category,Label,Course Code,Course Title,Student Count',
      );
      for (const dept of data.departments) {
        for (const line of dept.lines) {
          lines.push(
            `"${dept.departmentName}","${line.categoryLabel}","${line.label}","${line.courseCode}","${line.courseTitle}",${line.studentCount}`,
          );
        }
      }
      return lines.join('\n');
    }

    if (this.isSubjectStrengthReport(data)) {
      lines.push('Semester,Category,Course Code,Course Title,Student Count');
      for (const sem of data.semesters) {
        for (const cat of sem.categories) {
          for (const sub of cat.subjects) {
            lines.push(
              `"${sem.label}","${cat.label}","${sub.courseCode}","${sub.courseTitle}",${sub.studentCount}`,
            );
          }
        }
      }
      return lines.join('\n');
    }

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

    if (this.isDepartmentStrengthReport(data)) {
      sheet.addRow(['Title', data.title]);
      sheet.addRow(['Semester', data.semesterLabel ?? '']);
      sheet.addRow(['Academic Year', data.academicYearLabel ?? '']);
      sheet.addRow(['Total Departments', data.summary.totalDepartments]);
      sheet.addRow(['Total Students', data.summary.totalStudents]);
      sheet.addRow([]);
      sheet.addRow(['Department', 'Major Subject', 'Total Students']);
      for (const row of data.rows) {
        sheet.addRow([
          row.departmentName,
          row.majorSubjectName,
          row.studentCount,
        ]);
      }
    } else if (this.isDepartmentStudentsReport(data)) {
      sheet.addRow(['Title', data.title]);
      sheet.addRow(['Total', data.total]);
      sheet.addRow([]);
      sheet.addRow([
        'Enrollment Number',
        'Roll Number',
        'Student Name',
        'Major Department',
        'Minor Department',
        'Mobile Number',
        'Admission Status',
      ]);
      for (const s of data.students) {
        sheet.addRow([
          s.enrollmentNumber,
          s.rollNumber,
          s.fullName,
          s.majorDepartment,
          s.minorDepartment,
          s.mobileNumber,
          s.admissionStatus,
        ]);
      }
    } else if (this.isDepartmentSubjectSummaryReport(data)) {
      sheet.addRow(['Title', data.title]);
      sheet.addRow(['Semester', data.semesterLabel ?? '']);
      sheet.addRow([]);
      sheet.addRow([
        'Department',
        'Category',
        'Label',
        'Course Code',
        'Course Title',
        'Student Count',
      ]);
      for (const dept of data.departments) {
        for (const line of dept.lines) {
          sheet.addRow([
            dept.departmentName,
            line.categoryLabel,
            line.label,
            line.courseCode,
            line.courseTitle,
            line.studentCount,
          ]);
        }
      }
    } else if (this.isSubjectStrengthReport(data)) {
      sheet.addRow(['Title', data.title]);
      sheet.addRow(['Total Enrollments', data.totalEnrollments]);
      sheet.addRow([]);
      sheet.addRow([
        'Semester',
        'Category',
        'Course Code',
        'Course Title',
        'Student Count',
      ]);
      for (const sem of data.semesters) {
        for (const cat of sem.categories) {
          for (const sub of cat.subjects) {
            sheet.addRow([
              sem.label,
              cat.label,
              sub.courseCode,
              sub.courseTitle,
              sub.studentCount,
            ]);
          }
        }
      }
    } else if (this.isCombinationReport(data)) {
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

  private async toPdf(data: unknown, reportType: string): Promise<Buffer> {
    const title =
      data && typeof data === 'object' && 'title' in data
        ? String((data as { title: unknown }).title)
        : reportType;
    const bodyHtml = this.toPdfBody(data);
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
  h1 { font-size: 16px; margin: 0 0 8px; }
  .meta { color: #555; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; }
  th { background: #f3f4f6; }
  tfoot td { font-weight: 700; }
</style></head>
<body>
  <h1>${this.esc(title)}</h1>
  <div class="meta">Generated ${new Date().toLocaleString('en-IN')}</div>
  ${bodyHtml}
</body></html>`;

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
        margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private toPdfBody(data: unknown): string {
    if (this.isDepartmentStrengthReport(data)) {
      const rows = data.rows
        .map(
          (r) =>
            `<tr><td>${this.esc(r.departmentName)}</td><td>${this.esc(r.majorSubjectName)}</td><td>${r.studentCount}</td></tr>`,
        )
        .join('');
      return `<div class="meta">${this.esc(data.semesterLabel ?? '')}${
        data.academicYearLabel ? ` · ${this.esc(data.academicYearLabel)}` : ''
      } · Departments: ${data.summary.totalDepartments}</div>
      <table><thead><tr><th>Department</th><th>Major Subject</th><th>Total Students</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="2">Total Students</td><td>${data.summary.totalStudents}</td></tr></tfoot>
      </table>`;
    }
    if (this.isDepartmentStudentsReport(data)) {
      const rows = data.students
        .map(
          (s) =>
            `<tr><td>${this.esc(s.enrollmentNumber)}</td><td>${this.esc(s.rollNumber)}</td><td>${this.esc(s.fullName)}</td><td>${this.esc(s.majorDepartment)}</td><td>${this.esc(s.minorDepartment)}</td><td>${this.esc(s.mobileNumber)}</td><td>${this.esc(s.admissionStatus)}</td></tr>`,
        )
        .join('');
      return `<div class="meta">Total: ${data.total}</div>
      <table><thead><tr><th>Enrollment</th><th>Roll</th><th>Name</th><th>Major Dept</th><th>Minor Dept</th><th>Mobile</th><th>Admission</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
    }
    if (this.isDepartmentSubjectSummaryReport(data)) {
      const blocks = data.departments
        .map((d) => {
          const rows = d.lines
            .map(
              (l) =>
                `<tr><td>${this.esc(l.label)}</td><td>${this.esc(l.courseCode)}</td><td>${l.studentCount}</td></tr>`,
            )
            .join('');
          return `<h2 style="font-size:13px;margin:14px 0 6px">${this.esc(d.departmentName)}</h2>
          <table><thead><tr><th>Subject</th><th>Code</th><th>Students</th></tr></thead><tbody>${rows}</tbody></table>`;
        })
        .join('');
      return `<div class="meta">${this.esc(data.semesterLabel ?? '')}</div>${blocks}`;
    }
    if (this.isSubjectStrengthReport(data)) {
      const blocks = data.semesters
        .map((sem) => {
          const rows = sem.categories
            .flatMap((c) =>
              c.subjects.map(
                (s) =>
                  `<tr><td>${this.esc(c.label)}</td><td>${this.esc(s.courseTitle)}</td><td>${this.esc(s.courseCode)}</td><td>${s.studentCount}</td></tr>`,
              ),
            )
            .join('');
          return `<h2 style="font-size:13px;margin:14px 0 6px">${this.esc(sem.label)}</h2>
          <table><thead><tr><th>Category</th><th>Subject</th><th>Code</th><th>Students</th></tr></thead><tbody>${rows}</tbody></table>`;
        })
        .join('');
      return blocks;
    }
    return `<pre>${this.esc(JSON.stringify(data, null, 2))}</pre>`;
  }

  private esc(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  private isSubjectStrengthReport(
    data: unknown,
  ): data is SubjectStrengthReport {
    return Boolean(
      data &&
      typeof data === 'object' &&
      'semesters' in data &&
      'totalEnrollments' in data,
    );
  }

  private isDepartmentStrengthReport(
    data: unknown,
  ): data is DepartmentStrengthReport {
    return Boolean(
      data &&
      typeof data === 'object' &&
      'rows' in data &&
      'summary' in data &&
      'title' in data,
    );
  }

  private isDepartmentStudentsReport(
    data: unknown,
  ): data is DepartmentStrengthStudentsReport {
    return Boolean(
      data && typeof data === 'object' && 'students' in data && 'total' in data,
    );
  }

  private isDepartmentSubjectSummaryReport(
    data: unknown,
  ): data is DepartmentSubjectSummaryReport {
    return Boolean(
      data &&
      typeof data === 'object' &&
      'departments' in data &&
      'title' in data,
    );
  }
}
