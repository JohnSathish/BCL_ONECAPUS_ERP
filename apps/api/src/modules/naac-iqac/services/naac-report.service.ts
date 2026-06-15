import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { ReportExportDto } from '../dto/naac-iqac.dto';
import { naacDb } from './naac-prisma.util';
import { NaacEvidenceService } from './naac-evidence.service';

@Injectable()
export class NaacReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidence: NaacEvidenceService,
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
}
