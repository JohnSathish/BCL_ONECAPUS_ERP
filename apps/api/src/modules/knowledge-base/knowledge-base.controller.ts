import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { PrismaService } from '../../database/prisma.service';
import { KnowledgeIngestService } from './knowledge-ingest.service';
import { KnowledgeQueryService } from './knowledge-query.service';
import type { KnowledgeSourceType } from './knowledge-source-types';

@ApiTags('knowledge-base')
@ApiBearerAuth()
@Controller({ path: 'knowledge-base', version: '1' })
export class KnowledgeBaseController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingest: KnowledgeIngestService,
    private readonly query: KnowledgeQueryService,
  ) {}

  @Get('status')
  @RequireAnyPermission(
    'reports:read',
    'academic:read',
    'academic:manage',
    'students:read',
  )
  async status(@CurrentUser() user: JwtUser) {
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { tenantId: user.tid },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        sourceType: true,
        version: true,
        status: true,
        pageCount: true,
        fileName: true,
        createdAt: true,
        _count: {
          select: {
            courses: true,
            facts: true,
            semesterPlans: true,
            chunks: true,
          },
        },
      },
    });

    const defCounts = await this.prisma.$queryRaw<
      Array<{ document_id: string; count: bigint }>
    >`
      SELECT document_id::text AS document_id, COUNT(*)::bigint AS count
      FROM platform.knowledge_definitions
      WHERE tenant_id = ${user.tid}::uuid
        AND document_id IS NOT NULL
      GROUP BY document_id
    `;
    const defByDoc = new Map(
      defCounts.map((r) => [r.document_id, Number(r.count)]),
    );

    const active = docs.find((d) => d.status === 'ACTIVE');
    const coursesBySemester = active
      ? await this.prisma.knowledgeCourse.groupBy({
          by: ['semester'],
          where: { documentId: active.id },
          _count: { _all: true },
          orderBy: { semester: 'asc' },
        })
      : [];

    return {
      documents: docs.map((d) => ({
        ...d,
        _count: {
          ...d._count,
          definitions: defByDoc.get(d.id) ?? 0,
        },
      })),
      activeDocumentId: active?.id ?? null,
      coursesBySemester: coursesBySemester.map((row) => ({
        semester: row.semester,
        courses: row._count._all,
      })),
    };
  }

  @Post('ask')
  @RequireAnyPermission(
    'reports:read',
    'academic:read',
    'academic:manage',
    'students:read',
  )
  async ask(@CurrentUser() user: JwtUser, @Body() body: { question?: string }) {
    const question = body.question?.trim();
    if (!question) throw new BadRequestException('question is required');
    const answer = await this.query.answer(user.tid, question);
    if (!answer) {
      return {
        found: false,
        answer:
          'No matching institutional knowledge found. Upload curriculum or policy documents to the Knowledge Base.',
      };
    }
    return { found: true, ...answer };
  }

  @Post('seed/fyugp-framework')
  @RequirePermissions('academic:manage')
  async seedFramework(@CurrentUser() user: JwtUser) {
    return {
      ok: true,
      ...(await this.ingest.seedFyugpFramework(user.tid)),
    };
  }

  @Post('sync/erp-catalog')
  @RequirePermissions('academic:manage')
  async syncErp(@CurrentUser() user: JwtUser) {
    return {
      ok: true,
      ...(await this.ingest.syncFromErpCatalog(user.tid)),
    };
  }

  @Get('template/courses.xlsx')
  @RequireAnyPermission('academic:read', 'academic:manage')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.ingest.buildCoursesTemplate();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="onecampus-knowledge-courses-template.xlsx"',
    );
    res.send(buffer);
  }

  @Post('ingest/courses-excel')
  @RequirePermissions('academic:manage')
  @UseInterceptors(FileInterceptor('file'))
  async ingestCoursesExcel(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Upload an Excel file (.xlsx)');
    }
    const result = await this.ingest.importCoursesExcel(
      user.tid,
      file.buffer,
      file.originalname,
    );
    return { ok: true, ...result };
  }

  @Post('ingest/regulation-pdf')
  @RequirePermissions('academic:manage')
  @UseInterceptors(FileInterceptor('file'))
  async ingestRegulationPdf(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file?: Express.Multer.File,
    @Body()
    body?: {
      title?: string;
      sourceType?: string;
      version?: string;
    },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Upload a PDF file');
    }
    const title = body?.title?.trim();
    const sourceType = body?.sourceType?.trim();
    if (!title || !sourceType) {
      throw new BadRequestException('title and sourceType are required');
    }
    const result = await this.ingest.ingestRegulationPdf(
      user.tid,
      file.buffer,
      {
        title,
        sourceType: sourceType as KnowledgeSourceType,
        fileName: file.originalname,
        version: body?.version,
      },
    );
    return { ok: true, ...result };
  }

  @Post('ingest/curriculum-pdf')
  @RequirePermissions('academic:manage')
  @UseInterceptors(FileInterceptor('file'))
  async ingestCurriculumPdf(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: { filePath?: string },
  ) {
    let filePath = body?.filePath?.trim();
    let tempPath: string | null = null;

    if (file?.buffer?.length) {
      tempPath = path.join(
        os.tmpdir(),
        `kb-curriculum-${Date.now()}-${file.originalname || 'doc.pdf'}`,
      );
      fs.writeFileSync(tempPath, file.buffer);
      filePath = tempPath;
    }

    if (!filePath) {
      throw new BadRequestException(
        'Provide a PDF upload (file) or filePath to an existing PDF on the server.',
      );
    }

    try {
      const result = await this.ingest.ingestNehuCurriculumPdf(
        user.tid,
        filePath,
      );
      return { ok: true, ...result };
    } finally {
      if (tempPath && fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          /* ignore */
        }
      }
    }
  }
}
