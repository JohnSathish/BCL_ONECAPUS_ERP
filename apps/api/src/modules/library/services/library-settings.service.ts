import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import type { LibrarySettingsDto } from '../dto/library.dto';
import {
  DEFAULT_CIRCULATION_POLICY,
  DEFAULT_FINE_POLICY,
} from '../domain/library-policy.types';

export const DEFAULT_LIBRARY_CATEGORIES = [
  { code: 'REFERENCE', name: 'Reference Books', sortOrder: 1 },
  { code: 'TEXTBOOK', name: 'Text Books', sortOrder: 2 },
  { code: 'GENERAL', name: 'General Books', sortOrder: 3 },
  { code: 'COMPETITIVE', name: 'Competitive Exam Books', sortOrder: 4 },
  { code: 'RESEARCH', name: 'Research Books', sortOrder: 5 },
  { code: 'THESIS', name: 'Thesis', sortOrder: 6 },
  { code: 'DISSERTATION', name: 'Dissertations', sortOrder: 7 },
  { code: 'MAGAZINE', name: 'Magazines', sortOrder: 8 },
  { code: 'JOURNAL', name: 'Journals', sortOrder: 9 },
  { code: 'NEWSPAPER', name: 'Newspapers', sortOrder: 10 },
  { code: 'EBOOK', name: 'eBooks', sortOrder: 11 },
  { code: 'PROJECT', name: 'Project Reports', sortOrder: 12 },
  { code: 'GOVT', name: 'Government Publications', sortOrder: 13 },
  { code: 'RARE', name: 'Rare Collections', sortOrder: 14 },
];

@Injectable()
export class LibrarySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureTenantDefaults(tenantId: string) {
    const existing = await this.prisma.librarySettings.findUnique({
      where: { tenantId },
    });
    if (!existing) {
      await this.prisma.librarySettings.create({
        data: {
          id: randomUUID(),
          tenantId,
          circulationPolicy: DEFAULT_CIRCULATION_POLICY,
          finePolicy: DEFAULT_FINE_POLICY,
        },
      });
    }

    const count = await this.prisma.libraryCategory.count({
      where: { tenantId },
    });
    if (count === 0) {
      await this.prisma.libraryCategory.createMany({
        data: DEFAULT_LIBRARY_CATEGORIES.map((c) => ({
          id: randomUUID(),
          tenantId,
          ...c,
        })),
      });
    }
  }

  async getSettings(tenantId: string) {
    await this.ensureTenantDefaults(tenantId);
    return this.prisma.librarySettings.findUniqueOrThrow({
      where: { tenantId },
    });
  }

  async updateSettings(tenantId: string, dto: LibrarySettingsDto) {
    await this.ensureTenantDefaults(tenantId);
    return this.prisma.librarySettings.update({
      where: { tenantId },
      data: {
        totalSeats: dto.totalSeats,
        finePerDay: dto.finePerDay,
        graceDays: dto.graceDays,
        maxFine: dto.maxFine,
        defaultLoanDays: dto.defaultLoanDays,
        roomId: dto.roomId === undefined ? undefined : dto.roomId,
        maxUploadMb: dto.maxUploadMb,
        studentDigitalAccessEnabled: dto.studentDigitalAccessEnabled,
        qrEntryEnabled: dto.qrEntryEnabled,
        selfCheckInEnabled: dto.selfCheckInEnabled,
        zonesEnabled: dto.zonesEnabled,
        blockIssueOnUnpaidFines: dto.blockIssueOnUnpaidFines,
        overdueNotifyEnabled: dto.overdueNotifyEnabled,
        dueTomorrowNotifyEnabled: dto.dueTomorrowNotifyEnabled,
        assistantEnabled: dto.assistantEnabled,
        rfidEntryEnabled: dto.rfidEntryEnabled,
        maxRenewals: dto.maxRenewals,
        ...(dto.circulationPolicy !== undefined
          ? { circulationPolicy: dto.circulationPolicy }
          : {}),
        ...(dto.finePolicy !== undefined ? { finePolicy: dto.finePolicy } : {}),
        ...(dto.allowedMimeTypes !== undefined
          ? { allowedMimeTypes: dto.allowedMimeTypes }
          : {}),
        accessionPrefix: dto.accessionPrefix,
        accessionNextSeq: dto.accessionNextSeq,
      },
    });
  }
}
