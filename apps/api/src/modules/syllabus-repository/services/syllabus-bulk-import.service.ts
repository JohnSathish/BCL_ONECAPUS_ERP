import { BadRequestException, Injectable } from '@nestjs/common';
import { basename, extname } from 'path';
import JSZip from 'jszip';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  createWorkbookWithSheets,
  parseExcelDataSheet,
} from '../../../common/import/excel.util';
import { PrismaService } from '../../../database/prisma.service';
import { SyllabusDocumentsService } from './syllabus-documents.service';

const PDF_EXTENSIONS = new Set(['.pdf']);

export type SyllabusBulkPreviewRow = {
  rowNumber: number;
  status: 'VALID' | 'INVALID';
  errors: string[];
  normalized?: Record<string, unknown>;
  fileMatched?: boolean;
};

@Injectable()
export class SyllabusBulkImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: SyllabusDocumentsService,
  ) {}

  async preview(
    user: JwtUser,
    excelFile: Express.Multer.File,
    zipFile?: Express.Multer.File,
  ) {
    if (!excelFile?.buffer?.length) {
      throw new BadRequestException('Excel file is required');
    }
    const rows = (await this.parseExcelRows(excelFile.buffer)).map(
      (r) => r.raw,
    );
    const zipEntries = zipFile?.buffer?.length
      ? await this.expandZip(zipFile.buffer)
      : new Map<string, Express.Multer.File>();

    const [courses, academicYears] = await Promise.all([
      this.prisma.course.findMany({
        where: { tenantId: user.tid, deletedAt: null },
        select: {
          id: true,
          code: true,
          title: true,
          credits: true,
          departmentId: true,
          courseType: true,
        },
      }),
      this.prisma.academicYear.findMany({
        where: { tenantId: user.tid, deletedAt: null },
        select: { id: true, name: true },
      }),
    ]);
    const courseByCode = new Map(courses.map((c) => [c.code.toLowerCase(), c]));
    const yearByLabel = new Map(
      academicYears.map((y) => [String(y.name).toLowerCase(), y]),
    );

    const validated: SyllabusBulkPreviewRow[] = rows.map(
      (raw: Record<string, unknown>, index: number) => {
        const errors: string[] = [];
        const paperCode = String(raw.paperCode ?? raw.papercode ?? '').trim();
        const fileName = String(raw.fileName ?? raw.filename ?? '').trim();
        const academicYear = String(
          raw.academicYear ?? raw.academicyear ?? '',
        ).trim();
        const semester =
          Number(raw.semester ?? raw.semesterNo ?? raw.semesterno ?? 0) ||
          undefined;
        const category =
          String(raw.category ?? '')
            .trim()
            .toUpperCase() || undefined;
        const curriculumVersion =
          String(raw.curriculumVersion ?? raw.curriculumversion ?? '').trim() ||
          undefined;
        const credits = Number(raw.credits ?? 0) || undefined;
        const notes = String(raw.notes ?? '').trim() || undefined;

        if (!paperCode) errors.push('paperCode is required');
        if (!fileName) errors.push('fileName is required');
        if (fileName && !fileName.toLowerCase().endsWith('.pdf')) {
          errors.push('fileName must be a PDF');
        }

        const course = paperCode
          ? courseByCode.get(paperCode.toLowerCase())
          : undefined;
        if (paperCode && !course)
          errors.push(`Unknown course code: ${paperCode}`);

        let academicYearId: string | undefined;
        if (academicYear) {
          const year = yearByLabel.get(academicYear.toLowerCase());
          if (!year) errors.push(`Unknown academic year: ${academicYear}`);
          else academicYearId = year.id;
        }

        const fileMatched = zipEntries.has(fileName.toLowerCase());
        if (zipFile && !fileMatched) {
          errors.push(`No matching file in ZIP: ${fileName}`);
        }

        return {
          rowNumber: index + 2,
          status: errors.length ? 'INVALID' : 'VALID',
          errors,
          normalized: errors.length
            ? undefined
            : {
                paperCode: course?.code ?? paperCode,
                paperTitle: course?.title,
                courseId: course?.id,
                departmentId: course?.departmentId,
                academicYearId,
                academicYear,
                semesterNo: semester,
                category,
                subjectType: course?.courseType,
                curriculumVersion,
                credits: credits ?? course?.credits,
                notes,
                fileName,
              },
          fileMatched,
        };
      },
    );

    return {
      summary: {
        total: validated.length,
        valid: validated.filter((row) => row.status === 'VALID').length,
        invalid: validated.filter((row) => row.status === 'INVALID').length,
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
    const created: string[] = [];
    const versioned: string[] = [];

    for (const row of rows) {
      const fileName = String(row.fileName ?? '');
      const zipEntry = zipEntries.get(fileName.toLowerCase());
      if (!zipEntry) {
        throw new BadRequestException(`Missing file for row: ${fileName}`);
      }
      const result = await this.documents.create(
        user,
        {
          courseId: row.courseId ? String(row.courseId) : undefined,
          paperCode: String(row.paperCode),
          paperTitle: row.paperTitle ? String(row.paperTitle) : undefined,
          departmentId: row.departmentId ? String(row.departmentId) : undefined,
          academicYearId: row.academicYearId
            ? String(row.academicYearId)
            : undefined,
          academicYear: row.academicYear ? String(row.academicYear) : undefined,
          semesterNo: row.semesterNo ? Number(row.semesterNo) : undefined,
          category: row.category ? String(row.category) : undefined,
          subjectType: row.subjectType ? String(row.subjectType) : undefined,
          curriculumVersion: row.curriculumVersion
            ? String(row.curriculumVersion)
            : undefined,
          credits: row.credits ? Number(row.credits) : undefined,
          notes: row.notes ? String(row.notes) : undefined,
        },
        zipEntry,
      );
      if ('version' in result && result.version) {
        versioned.push(result.document.id);
      } else if ('id' in result) {
        created.push(result.id);
      } else if ('document' in result && result.document?.id) {
        versioned.push(result.document.id);
      }
    }

    return {
      imported: created.length,
      versioned: versioned.length,
      documentIds: [...created, ...versioned],
    };
  }

  async buildTemplateWorkbook() {
    return createWorkbookWithSheets([
      {
        name: 'Syllabus Documents',
        headers: [
          'paperCode',
          'fileName',
          'academicYear',
          'semester',
          'category',
          'curriculumVersion',
          'credits',
          'notes',
        ],
        rows: [
          [
            'CHE251',
            'CHE251_syllabus.pdf',
            '2024-25',
            '3',
            'MAJOR',
            'FYUGP-2024',
            '4',
            '',
          ],
        ],
      },
    ]);
  }

  private parseExcelRows(buffer: Buffer) {
    return parseExcelDataSheet(buffer, 'Syllabus Documents');
  }

  private async expandZip(buffer: Buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const out = new Map<string, Express.Multer.File>();
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      const name = basename(entry.name);
      const ext = extname(name).toLowerCase();
      if (!PDF_EXTENSIONS.has(ext)) continue;
      const fileBuffer = await entry.async('nodebuffer');
      out.set(name.toLowerCase(), {
        fieldname: 'file',
        originalname: name,
        encoding: '7bit',
        mimetype: 'application/pdf',
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
}
