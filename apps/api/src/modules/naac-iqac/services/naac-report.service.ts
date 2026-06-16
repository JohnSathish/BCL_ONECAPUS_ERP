import { Injectable } from '@nestjs/common';
import JSZip from 'jszip';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import type { ReportExportDto } from '../dto/naac-iqac.dto';
import { naacDb } from './naac-prisma.util';
import { NaacEvidenceService } from './naac-evidence.service';

@Injectable()
export class NaacReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidence: NaacEvidenceService,
    private readonly storage: StorageService,
  ) {}

  private db() {
    return naacDb(this.prisma);
  }

  async export(tenantId: string, dto: ReportExportDto) {
    const { items } = await this.evidence.search(tenantId, {
      criterion: dto.criterion,
      academicYear: dto.academicYear,
      limit: 500,
    });

    if (dto.reportType === 'evidence-index') {
      const rows = items.map((t: Record<string, unknown>) => ({
        criterion: t.criterion,
        metricCode: t.metricCode ?? '',
        academicYear: t.academicYear ?? '',
        sourceType: t.sourceType,
        fileName: t.fileName ?? '',
        evidenceNotes: t.evidenceNotes ?? '',
        origin: t.origin ?? 'nims',
      }));

      if (dto.format === 'csv') {
        const header = 'Criterion,Metric,Year,Source,File,Notes,Origin\n';
        const body = rows
          .map((r) =>
            [
              r.criterion,
              r.metricCode,
              r.academicYear,
              r.sourceType,
              r.fileName,
              r.evidenceNotes,
              r.origin,
            ]
              .map((v) => `"${String(v).replace(/"/g, '""')}"`)
              .join(','),
          )
          .join('\n');
        return { format: 'csv', content: header + body, rowCount: rows.length };
      }

      return { format: dto.format ?? 'json', rows, rowCount: rows.length };
    }

    if (dto.reportType === 'dvv-checklist') {
      return {
        format: 'json',
        message: 'Use GET /dvv/readiness for DVV checklist',
      };
    }

    return { format: 'json', items, total: items.length };
  }

  async exportEvidencePack(
    tenantId: string,
    dto: ReportExportDto,
  ): Promise<Buffer> {
    const where: Record<string, unknown> = { tenantId };
    if (dto.criterion) where.criterion = dto.criterion;
    if (dto.academicYear) where.academicYear = dto.academicYear;

    const tags = await this.db().naacEvidenceTag.findMany({
      where,
      orderBy: [{ criterion: 'asc' }, { metricCode: 'asc' }],
      take: 500,
    });

    const zip = new JSZip();
    const manifest: Array<Record<string, unknown>> = [];
    let fileCount = 0;

    for (const tag of tags) {
      const entry = {
        id: tag.id,
        criterion: tag.criterion,
        metricCode: tag.metricCode,
        academicYear: tag.academicYear,
        sourceType: tag.sourceType,
        sourceId: tag.sourceId,
        fileName: tag.fileName,
        evidenceNotes: tag.evidenceNotes,
        included: false,
      };

      if (tag.storageKey) {
        const buffer = await this.storage.get(tag.storageKey);
        if (buffer) {
          const folder = `criterion-${tag.criterion}/${tag.metricCode || 'general'}`;
          const safeName = tag.fileName || `${tag.id}.bin`;
          zip.file(`${folder}/${safeName}`, buffer);
          entry.included = true;
          fileCount += 1;
        }
      }

      manifest.push(entry);
    }

    zip.file(
      'manifest.json',
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          criterion: dto.criterion ?? 'all',
          academicYear: dto.academicYear ?? 'all',
          tagCount: tags.length,
          fileCount,
          items: manifest,
        },
        null,
        2,
      ),
    );

    return zip.generateAsync({ type: 'nodebuffer' });
  }
}
