import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';
import type ExcelJS from 'exceljs';
import { PrismaService } from '../../../database/prisma.service';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A5F' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

const TITLE_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 14,
  color: { argb: 'FF1E3A5F' },
};

const SUBTITLE_FONT: Partial<ExcelJS.Font> = {
  size: 11,
  color: { argb: 'FF475569' },
};

@Injectable()
export class PayrollExcelStylesService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveInstitutionHeader(tenantId: string) {
    const [tenant, branding, settings] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      this.prisma.tenantBranding.findUnique({
        where: { tenantId },
        select: { displayName: true, logoUrl: true },
      }),
      this.prisma.payrollSettings.findUnique({
        where: { tenantId },
        select: { logoUrl: true },
      }),
    ]);

    const institutionName =
      branding?.displayName ?? tenant?.name ?? 'Institution';
    const logoUrl = settings?.logoUrl ?? branding?.logoUrl ?? null;
    return { institutionName, logoUrl };
  }

  async applyReportHeader(
    ws: ExcelJS.Worksheet,
    tenantId: string,
    title: string,
    subtitle?: string,
  ) {
    const { institutionName, logoUrl } =
      await this.resolveInstitutionHeader(tenantId);

    ws.addRow([institutionName]);
    const titleRow = ws.addRow([title]);
    titleRow.font = TITLE_FONT;
    if (subtitle) {
      const subRow = ws.addRow([subtitle]);
      subRow.font = SUBTITLE_FONT;
    }
    ws.addRow([`Generated: ${new Date().toLocaleString('en-IN')}`]);
    ws.addRow([]);

    const logoPath = this.resolveLocalLogoPath(logoUrl);
    if (logoPath) {
      try {
        const workbook = ws.workbook;
        const imageId = workbook.addImage({
          filename: logoPath,
          extension: logoPath.endsWith('.png') ? 'png' : 'jpeg',
        });
        ws.addImage(imageId, {
          tl: { col: 0, row: 0 },
          ext: { width: 80, height: 40 },
        });
      } catch {
        // Logo optional — continue without image
      }
    }

    return { institutionName };
  }

  styleTableHeaderRow(row: ExcelJS.Row, columnCount: number) {
    row.font = HEADER_FONT;
    row.height = 22;
    for (let i = 1; i <= columnCount; i++) {
      const cell = row.getCell(i);
      cell.fill = HEADER_FILL;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    }
  }

  styleDataRow(row: ExcelJS.Row, columnCount: number, zebra: boolean) {
    if (zebra) {
      for (let i = 1; i <= columnCount; i++) {
        row.getCell(i).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
    }
    for (let i = 1; i <= columnCount; i++) {
      row.getCell(i).border = {
        bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
      };
    }
  }

  styleTotalsRow(row: ExcelJS.Row, columnCount: number) {
    row.font = { bold: true, size: 11 };
    for (let i = 1; i <= columnCount; i++) {
      const cell = row.getCell(i);
      cell.border = {
        top: { style: 'double', color: { argb: 'FF1E3A5F' } },
      };
    }
  }

  applyCurrencyFormat(ws: ExcelJS.Worksheet, columnIndexes: number[]) {
    for (const colIdx of columnIndexes) {
      ws.getColumn(colIdx).numFmt = '#,##0.00';
      ws.getColumn(colIdx).width = 14;
    }
  }

  private resolveLocalLogoPath(logoUrl?: string | null): string | null {
    if (!logoUrl || !logoUrl.startsWith('/uploads/')) return null;
    const absolute = join(process.cwd(), logoUrl.replace(/^\//, ''));
    return existsSync(absolute) ? absolute : null;
  }
}
