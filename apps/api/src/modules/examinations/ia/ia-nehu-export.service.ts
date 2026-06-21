import { Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { IaConsolidationService } from './ia-consolidation.service';

@Injectable()
export class IaNehuExportService {
  constructor(private readonly consolidation: IaConsolidationService) {}

  async exportSheet(
    tenantId: string,
    sheetId: string,
    format: 'xlsx' | 'csv' | 'pdf',
    res: Response,
  ) {
    const data = await this.consolidation.get(tenantId, sheetId);
    if (!data.rows?.length) throw new NotFoundException('No rows to export');

    const componentCodes: string[] = Array.from(
      new Set<string>(
        data.rows.flatMap((r: { componentJson: Record<string, unknown> }) =>
          Object.keys(r.componentJson ?? {}),
        ),
      ),
    ).sort();

    type ExportRow = {
      student?: {
        rollNumber?: string | null;
        enrollmentNumber?: string;
        user?: { displayName?: string | null };
      };
      totalMarks: unknown;
      maxMarks: unknown;
      percentage: unknown;
      resultStatus: string;
      componentJson: Record<string, number | null>;
    };

    const headers = [
      'Roll No',
      'NEHU Reg No',
      'Student Name',
      'Total',
      'Max',
      'Percentage',
      'Status',
      ...componentCodes,
    ];

    const rows: Array<Array<string | number>> = (data.rows as ExportRow[]).map(
      (r) => [
        r.student?.rollNumber ?? '',
        r.student?.enrollmentNumber ?? '',
        r.student?.user?.displayName ?? '',
        Number(r.totalMarks),
        Number(r.maxMarks),
        Number(r.percentage),
        r.resultStatus,
        ...componentCodes.map((c: string) => r.componentJson?.[c] ?? ''),
      ],
    );

    if (format === 'csv') {
      const csv = [
        headers.join(','),
        ...rows.map((r: Array<string | number>) => r.join(',')),
      ].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="nehu-ia-${sheetId}.csv"`,
      );
      return res.send(csv);
    }

    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('NEHU IA Marks');
      ws.addRow(headers);
      rows.forEach((r: Array<string | number>) => ws.addRow(r));
      ws.getRow(1).font = { bold: true };
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="nehu-ia-${sheetId}.xlsx"`,
      );
      await wb.xlsx.write(res);
      return res.end();
    }

    const html = `<!DOCTYPE html><html><head><title>NEHU IA Report</title>
      <style>body{font-family:Arial,sans-serif}table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #ccc;padding:6px;font-size:11px}th{background:#f0f0f0}</style></head>
      <body><h2>NEHU Internal Assessment Submission — ${data.name}</h2>
      <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r: Array<string | number>) => `<tr>${r.map((c: string | number) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="nehu-ia-${sheetId}.html"`,
    );
    return res.send(html);
  }
}
