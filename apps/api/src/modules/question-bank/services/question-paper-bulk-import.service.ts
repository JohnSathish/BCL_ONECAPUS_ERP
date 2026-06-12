import { BadRequestException, Injectable } from '@nestjs/common';
import { basename, extname } from 'path';
import JSZip from 'jszip';
import {
  createWorkbookWithSheets,
  parseExcelDataSheet,
} from '../../../common/import/excel.util';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { QuestionBankAssetsService } from './question-bank-assets.service';
import { QuestionPapersService } from './question-papers.service';

const PAPER_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.zip',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

export type BulkPreviewRow = {
  rowNumber: number;
  status: 'VALID' | 'INVALID';
  errors: string[];
  normalized?: Record<string, unknown>;
  fileMatched?: boolean;
};

@Injectable()
export class QuestionPaperBulkImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: QuestionBankAssetsService,
    private readonly papers: QuestionPapersService,
  ) {}

  async preview(
    user: JwtUser,
    excelFile: Express.Multer.File,
    zipFile?: Express.Multer.File,
  ) {
    if (!excelFile?.buffer?.length)
      throw new BadRequestException('Excel file is required');
    const parsedRows = await this.parseExcelRows(excelFile.buffer);
    const rows = parsedRows.map((r) => r.raw);
    const zipEntries = zipFile?.buffer?.length
      ? await this.expandZip(zipFile.buffer)
      : new Map<string, Express.Multer.File>();

    const [courses, departments, academicYears] = await Promise.all([
      this.prisma.course.findMany({
        where: { tenantId: user.tid, deletedAt: null },
        select: { id: true, code: true, title: true },
      }),
      this.prisma.department.findMany({
        where: { tenantId: user.tid, deletedAt: null },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.academicYear.findMany({
        where: { tenantId: user.tid, deletedAt: null },
        select: { id: true, name: true },
      }),
    ]);

    const courseByCode = new Map(courses.map((c) => [c.code.toLowerCase(), c]));
    const deptByName = new Map(
      departments.map((d) => [d.name.toLowerCase(), d]),
    );
    const deptByCode = new Map(
      departments.map((d) => [d.code.toLowerCase(), d]),
    );
    const yearByLabel = new Map(
      academicYears.map((y) => [String(y.name).toLowerCase(), y]),
    );

    const validated: BulkPreviewRow[] = rows.map(
      (raw: Record<string, unknown>, index: number) => {
        const errors: string[] = [];
        const paperCode = String(raw.paperCode ?? raw.papercode ?? '').trim();
        const subject = String(
          raw.subject ?? raw.paperName ?? raw.papername ?? '',
        ).trim();
        const department = String(
          raw.department ?? raw.departmentCode ?? raw.departmentcode ?? '',
        ).trim();
        const semester =
          Number(raw.semester ?? raw.semesterNo ?? raw.semesterno ?? 0) ||
          undefined;
        const academicYear = String(
          raw.academicYear ?? raw.academicyear ?? '',
        ).trim();
        const paperType = String(
          raw.paperType ?? raw.papertype ?? 'UNIVERSITY_EXAM',
        ).trim();
        const examYear = Number(raw.examYear ?? raw.examyear ?? 0) || undefined;
        const examMonth =
          Number(raw.examMonth ?? raw.exammonth ?? 0) || undefined;
        const fileName = String(raw.fileName ?? raw.filename ?? '').trim();
        const maxMarks = Number(raw.maxMarks ?? raw.maxmarks ?? 0) || undefined;
        const durationMinutes =
          Number(raw.durationMinutes ?? raw.durationminutes ?? 0) || undefined;

        if (!paperCode) errors.push('paperCode is required');
        if (!subject) errors.push('subject is required');
        if (!fileName) errors.push('fileName is required');

        const course = paperCode
          ? courseByCode.get(paperCode.toLowerCase())
          : undefined;
        if (paperCode && !course)
          errors.push(`Unknown course code: ${paperCode}`);

        let departmentId: string | undefined;
        if (department) {
          const dept =
            deptByName.get(department.toLowerCase()) ??
            deptByCode.get(department.toLowerCase());
          if (!dept) errors.push(`Unknown department: ${department}`);
          else departmentId = dept.id;
        }

        let academicYearId: string | undefined;
        if (academicYear) {
          const year = yearByLabel.get(academicYear.toLowerCase());
          if (!year) errors.push(`Unknown academic year: ${academicYear}`);
          else academicYearId = year.id;
        }

        const fileMatched = zipEntries.has(fileName.toLowerCase());
        if (zipFile && !fileMatched)
          errors.push(`No matching file in ZIP: ${fileName}`);

        const normalized = {
          paperCode,
          paperName: subject,
          courseId: course?.id,
          departmentId,
          academicYearId,
          semesterNo: semester,
          paperType,
          examYear,
          examMonth,
          fileName,
          maxMarks,
          durationMinutes,
        };

        return {
          rowNumber: index + 2,
          status: errors.length ? 'INVALID' : 'VALID',
          errors,
          normalized: errors.length ? undefined : normalized,
          fileMatched,
        };
      },
    );

    return {
      summary: {
        total: validated.length,
        valid: validated.filter((r) => r.status === 'VALID').length,
        invalid: validated.filter((r) => r.status === 'INVALID').length,
      },
      rows: validated,
      zipFileCount: zipEntries.size,
    };
  }

  async commit(
    user: JwtUser,
    rows: Record<string, unknown>[],
    zipFile?: Express.Multer.File,
  ) {
    if (!rows.length) throw new BadRequestException('No rows to import');
    const zipEntries = zipFile?.buffer?.length
      ? await this.expandZip(zipFile.buffer)
      : new Map<string, Express.Multer.File>();
    const settings = await this.papers.getSettings(user.tid);
    const created: string[] = [];

    for (const row of rows) {
      const fileName = String(row.fileName ?? '');
      const zipEntry = zipEntries.get(fileName.toLowerCase());
      if (!zipEntry)
        throw new BadRequestException(`Missing file for row: ${fileName}`);

      const course = row.courseId
        ? await this.prisma.course.findFirst({
            where: { id: String(row.courseId) },
            select: { code: true },
          })
        : null;

      const saved = await this.assets.savePaperFile(user.tid, zipEntry, {
        courseCode: course?.code ?? String(row.paperCode ?? 'general'),
        examYear: Number(row.examYear) || undefined,
        maxUploadMb: settings.maxUploadMb,
        allowedMimeTypes: settings.allowedMimeTypes as string[],
      });

      const paper = await this.papers.createInternal(user, {
        paperCode: String(row.paperCode),
        paperName: String(row.paperName),
        courseId: row.courseId ? String(row.courseId) : undefined,
        departmentId: row.departmentId ? String(row.departmentId) : undefined,
        academicYearId: row.academicYearId
          ? String(row.academicYearId)
          : undefined,
        semesterNo: row.semesterNo ? Number(row.semesterNo) : undefined,
        paperType: String(row.paperType ?? 'UNIVERSITY_EXAM'),
        examYear: row.examYear ? Number(row.examYear) : undefined,
        examMonth: row.examMonth ? Number(row.examMonth) : undefined,
        maxMarks: row.maxMarks ? Number(row.maxMarks) : undefined,
        durationMinutes: row.durationMinutes
          ? Number(row.durationMinutes)
          : undefined,
        ...saved,
        status: 'DRAFT',
      });
      created.push(paper.id);
    }

    return { imported: created.length, paperIds: created };
  }

  async buildTemplateWorkbook() {
    return createWorkbookWithSheets([
      {
        name: 'Question Papers',
        headers: [
          'paperCode',
          'subject',
          'department',
          'semester',
          'academicYear',
          'paperType',
          'examYear',
          'examMonth',
          'fileName',
          'maxMarks',
          'durationMinutes',
        ],
        rows: [
          [
            'CHE251',
            'Organic Chemistry',
            'Chemistry',
            '3',
            '2024-25',
            'UNIVERSITY_EXAM',
            '2024',
            '11',
            'CHE251_2024.pdf',
            '70',
            '180',
          ],
        ],
      },
    ]);
  }

  private parseExcelRows(buffer: Buffer) {
    return parseExcelDataSheet(buffer, 'Question Papers');
  }

  private async expandZip(buffer: Buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const out = new Map<string, Express.Multer.File>();
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      const name = basename(entry.name);
      const ext = extname(name).toLowerCase();
      if (!PAPER_EXTENSIONS.has(ext)) continue;
      const fileBuffer = await entry.async('nodebuffer');
      out.set(name.toLowerCase(), {
        fieldname: 'file',
        originalname: name,
        encoding: '7bit',
        mimetype: this.mimeFromExt(ext),
        size: fileBuffer.length,
        buffer: fileBuffer,
        stream: null as any,
        destination: '',
        filename: name,
        path: '',
      });
    }
    return out;
  }

  private mimeFromExt(ext: string) {
    const map: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx':
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.zip': 'application/zip',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}
