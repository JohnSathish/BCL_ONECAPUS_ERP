import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateIssuerDto,
  CreateLetterheadDto,
  CreateTemplateDto,
  UpdateIssuerDto,
  UpdateLetterheadDto,
  UpdateTemplateDto,
  UpsertOfficialDocumentSettingsDto,
} from '../dto/official-documents.dto';
import { officialDb } from '../utils/official-documents-prisma.util';

@Injectable()
export class OfficialDocumentSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return officialDb(this.prisma);
  }

  async get(tenantId: string) {
    let row = await this.db().officialDocumentSettings.findUnique({
      where: { tenantId },
    });
    if (!row) {
      row = await this.db().officialDocumentSettings.create({
        data: { tenantId },
      });
    }
    return row;
  }

  async update(tenantId: string, dto: UpsertOfficialDocumentSettingsDto) {
    await this.get(tenantId);
    return this.db().officialDocumentSettings.update({
      where: { tenantId },
      data: {
        defaultPrefix: dto.defaultPrefix,
        referencePattern: dto.referencePattern,
        verifyBaseUrl: dto.verifyBaseUrl,
      },
    });
  }

  async listLetterheads(tenantId: string) {
    return this.db().officialLetterhead.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async createLetterhead(tenantId: string, data: CreateLetterheadDto) {
    if (data.isDefault) {
      await this.db().officialLetterhead.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      });
    }
    return this.db().officialLetterhead.create({
      data: { tenantId, ...data },
    });
  }

  async updateLetterhead(
    tenantId: string,
    id: string,
    data: UpdateLetterheadDto,
  ) {
    const row = await this.db().officialLetterhead.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Letterhead not found');
    if (data.isDefault) {
      await this.db().officialLetterhead.updateMany({
        where: { tenantId, id: { not: id } },
        data: { isDefault: false },
      });
    }
    return this.db().officialLetterhead.update({ where: { id }, data });
  }

  async listIssuers(tenantId: string) {
    return this.db().officialDocumentIssuer.findMany({
      where: { tenantId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { letterhead: true },
    });
  }

  async createIssuer(tenantId: string, data: CreateIssuerDto) {
    return this.db().officialDocumentIssuer.create({
      data: { tenantId, ...data },
      include: { letterhead: true },
    });
  }

  async updateIssuer(tenantId: string, id: string, data: UpdateIssuerDto) {
    const row = await this.db().officialDocumentIssuer.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Issuer not found');
    return this.db().officialDocumentIssuer.update({
      where: { id },
      data,
      include: { letterhead: true },
    });
  }

  async listTemplates(tenantId: string, documentType?: string) {
    return this.db().officialDocumentTemplate.findMany({
      where: {
        tenantId,
        active: true,
        ...(documentType ? { documentType } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createTemplate(tenantId: string, data: CreateTemplateDto) {
    return this.db().officialDocumentTemplate.create({
      data: { tenantId, ...data },
    });
  }

  async updateTemplate(tenantId: string, id: string, data: UpdateTemplateDto) {
    const row = await this.db().officialDocumentTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Template not found');
    return this.db().officialDocumentTemplate.update({ where: { id }, data });
  }
}
