import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { paginate } from '../constants/official-documents.constants';
import { officialDb } from '../utils/official-documents-prisma.util';

@Injectable()
export class OfficialDocumentSearchService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return officialDb(this.prisma);
  }

  async fullTextSearch(
    tenantId: string,
    q: string,
    opts: { page?: number; limit?: number } = {},
  ) {
    const term = q.trim();
    const { page, limit, skip, take } = paginate(opts.page, opts.limit);
    const where: Record<string, unknown> = { tenantId };
    if (term) {
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { subject: { contains: term, mode: 'insensitive' } },
        { referenceNo: { contains: term, mode: 'insensitive' } },
        { bodyHtml: { contains: term, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.db().officialDocument.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: { issuer: true },
      }),
      this.db().officialDocument.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /**
   * Documents expiring soon. Uses expiryDate when set;
   * otherwise publishedAt + 365 days heuristic for published docs.
   */
  async listExpiring(
    tenantId: string,
    opts: { withinDays?: number; page?: number; limit?: number } = {},
  ) {
    const withinDays = opts.withinDays ?? 90;
    const { page, limit, skip, take } = paginate(opts.page, opts.limit);
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + withinDays);

    const withExpiry = await this.db().officialDocument.findMany({
      where: {
        tenantId,
        status: { in: ['PUBLISHED', 'ARCHIVED'] },
        OR: [
          {
            expiryDate: { not: null, gte: now, lte: horizon },
          },
          {
            expiryDate: null,
            publishedAt: {
              not: null,
              lte: new Date(horizon.getTime() - 365 * 24 * 60 * 60 * 1000),
              gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
            },
          },
        ],
      },
      skip,
      take,
      orderBy: [{ expiryDate: 'asc' }, { publishedAt: 'asc' }],
      include: { issuer: true },
    });

    const items = withExpiry.map(
      (doc: {
        expiryDate: Date | null;
        publishedAt: Date | null;
        [key: string]: unknown;
      }) => {
        const effectiveExpiry =
          doc.expiryDate ??
          (doc.publishedAt
            ? new Date(
                new Date(doc.publishedAt).getTime() + 365 * 24 * 60 * 60 * 1000,
              )
            : null);
        return { ...doc, effectiveExpiry };
      },
    );

    return { items, total: items.length, page, limit, withinDays };
  }
}
