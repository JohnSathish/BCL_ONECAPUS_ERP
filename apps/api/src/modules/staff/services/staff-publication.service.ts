import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export const PUBLICATION_TYPES = [
  'JOURNAL',
  'CONFERENCE',
  'BOOK',
  'CHAPTER',
  'PATENT',
  'RESEARCH_PAPER',
] as const;

@Injectable()
export class StaffPublicationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, staffProfileId: string) {
    await this.assertStaff(tenantId, staffProfileId);
    return this.prisma.staffPublication.findMany({
      where: { tenantId, staffProfileId },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(
    tenantId: string,
    staffProfileId: string,
    input: {
      title: string;
      publicationType: string;
      journal?: string;
      isbnIssn?: string;
      doi?: string;
      coAuthors?: string;
      indexedIn?: string;
      publishedAt?: string;
      attachmentUrl?: string;
    },
  ) {
    await this.assertStaff(tenantId, staffProfileId);
    return this.prisma.staffPublication.create({
      data: {
        tenantId,
        staffProfileId,
        title: input.title.trim(),
        publicationType: input.publicationType,
        journal: input.journal?.trim(),
        isbnIssn: input.isbnIssn?.trim(),
        doi: input.doi?.trim(),
        coAuthors: input.coAuthors?.trim(),
        indexedIn: input.indexedIn?.trim(),
        publishedAt: input.publishedAt
          ? new Date(input.publishedAt)
          : undefined,
        attachmentUrl: input.attachmentUrl,
      },
    });
  }

  async update(
    tenantId: string,
    staffProfileId: string,
    publicationId: string,
    input: Partial<{
      title: string;
      publicationType: string;
      journal: string | null;
      isbnIssn: string | null;
      doi: string | null;
      coAuthors: string | null;
      indexedIn: string | null;
      publishedAt: string | null;
      attachmentUrl: string | null;
    }>,
  ) {
    await this.assertPublication(tenantId, staffProfileId, publicationId);
    return this.prisma.staffPublication.update({
      where: { id: publicationId },
      data: {
        title: input.title?.trim(),
        publicationType: input.publicationType,
        journal: input.journal,
        isbnIssn: input.isbnIssn,
        doi: input.doi,
        coAuthors: input.coAuthors,
        indexedIn: input.indexedIn,
        publishedAt:
          input.publishedAt === null
            ? null
            : input.publishedAt
              ? new Date(input.publishedAt)
              : undefined,
        attachmentUrl: input.attachmentUrl,
      },
    });
  }

  async remove(
    tenantId: string,
    staffProfileId: string,
    publicationId: string,
  ) {
    await this.assertPublication(tenantId, staffProfileId, publicationId);
    await this.prisma.staffPublication.delete({ where: { id: publicationId } });
    return { ok: true };
  }

  private async assertStaff(tenantId: string, staffProfileId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
  }

  private async assertPublication(
    tenantId: string,
    staffProfileId: string,
    publicationId: string,
  ) {
    const pub = await this.prisma.staffPublication.findFirst({
      where: { id: publicationId, tenantId, staffProfileId },
    });
    if (!pub) throw new NotFoundException('Publication not found');
  }
}
