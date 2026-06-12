import { Injectable } from '@nestjs/common';

import type { JwtUser } from '../../../common/decorators/current-user.decorator';

import { PrismaService } from '../../../database/prisma.service';

export type LibrarySearchResult = {
  books: {
    id: string;
    title: string;
    author?: string | null;
    accessionNo: string;
    type: 'BOOK';
    score: number;
  }[];

  digital: {
    id: string;
    title: string;
    author?: string | null;
    assetType: string;
    type: 'DIGITAL';
    score: number;
  }[];

  research: {
    id: string;
    title: string;
    itemType: string;
    type: 'RESEARCH';
    score: number;
  }[];

  total: number;
};

export type SearchType = 'ALL' | 'BOOK' | 'DIGITAL' | 'RESEARCH';

@Injectable()
export class LibrarySearchService {
  constructor(private readonly prisma: PrismaService) {}

  private scoreMatch(
    text: string | null | undefined,
    term: string,
    weight: number,
  ) {
    if (!text) return 0;

    const lower = text.toLowerCase();

    const q = term.toLowerCase();

    if (lower === q) return weight * 3;

    if (lower.startsWith(q)) return weight * 2;

    if (lower.includes(q)) return weight;

    return 0;
  }

  async search(
    user: JwtUser,
    q: string,
    limit = 20,
    type: SearchType = 'ALL',
  ): Promise<LibrarySearchResult> {
    const term = q.trim();

    if (!term || term.length < 2) {
      return { books: [], digital: [], research: [], total: 0 };
    }

    const isStudent =
      user.roles?.includes('student') &&
      !user.permissions?.includes('library:manage');

    const perType = Math.max(5, Math.ceil(limit / (type === 'ALL' ? 3 : 1)));

    const [booksRaw, digitalRaw, researchRaw] = await Promise.all([
      type === 'ALL' || type === 'BOOK'
        ? this.prisma.libraryBook.findMany({
            where: {
              tenantId: user.tid,

              deletedAt: null,

              OR: [
                { title: { contains: term, mode: 'insensitive' } },

                { author: { contains: term, mode: 'insensitive' } },

                { accessionNo: { contains: term, mode: 'insensitive' } },

                { isbn: { contains: term, mode: 'insensitive' } },
              ],
            },

            select: {
              id: true,
              title: true,
              author: true,
              accessionNo: true,
              isbn: true,
            },

            take: perType * 2,
          })
        : [],

      type === 'ALL' || type === 'DIGITAL'
        ? this.prisma.libraryDigitalAsset.findMany({
            where: {
              tenantId: user.tid,

              deletedAt: null,

              ...(isStudent ? { status: 'PUBLISHED' } : {}),

              OR: [
                { title: { contains: term, mode: 'insensitive' } },

                { author: { contains: term, mode: 'insensitive' } },

                { searchText: { contains: term, mode: 'insensitive' } },
              ],
            },

            select: {
              id: true,
              title: true,
              author: true,
              assetType: true,
              downloadCount: true,
            },

            take: perType * 2,
          })
        : [],

      type === 'ALL' || type === 'RESEARCH'
        ? this.prisma.researchRepositoryItem.findMany({
            where: {
              tenantId: user.tid,

              deletedAt: null,

              ...(isStudent
                ? { status: 'PUBLISHED' }
                : { status: { in: ['PUBLISHED', 'PENDING_REVIEW', 'DRAFT'] } }),

              OR: [
                { title: { contains: term, mode: 'insensitive' } },

                { abstract: { contains: term, mode: 'insensitive' } },

                { searchText: { contains: term, mode: 'insensitive' } },
              ],
            },

            select: {
              id: true,
              title: true,
              itemType: true,
              downloadCount: true,
            },

            take: perType * 2,
          })
        : [],
    ]);

    const books = booksRaw

      .map((b) => ({
        ...b,

        type: 'BOOK' as const,

        score:
          this.scoreMatch(b.title, term, 10) +
          this.scoreMatch(b.accessionNo, term, 8) +
          this.scoreMatch(b.isbn, term, 6) +
          this.scoreMatch(b.author, term, 4),
      }))

      .filter((b) => b.score > 0)

      .sort((a, b) => b.score - a.score)

      .slice(0, perType);

    const digital = digitalRaw

      .map((d) => ({
        id: d.id,

        title: d.title,

        author: d.author,

        assetType: d.assetType,

        type: 'DIGITAL' as const,

        score:
          this.scoreMatch(d.title, term, 10) +
          this.scoreMatch(d.author, term, 4) +
          Math.min(d.downloadCount, 50) * 0.1,
      }))

      .filter((d) => d.score > 0)

      .sort((a, b) => b.score - a.score)

      .slice(0, perType);

    const research = researchRaw

      .map((r) => ({
        id: r.id,

        title: r.title,

        itemType: r.itemType,

        type: 'RESEARCH' as const,

        score:
          this.scoreMatch(r.title, term, 10) +
          Math.min(r.downloadCount, 50) * 0.1,
      }))

      .filter((r) => r.score > 0)

      .sort((a, b) => b.score - a.score)

      .slice(0, perType);

    return {
      books,

      digital,

      research,

      total: books.length + digital.length + research.length,
    };
  }

  async suggestions(user: JwtUser, q: string, limit = 8) {
    const result = await this.search(user, q, limit, 'ALL');

    return [
      ...result.books.map((b) => ({
        label: b.title,
        type: 'BOOK' as const,
        id: b.id,
        meta: b.accessionNo,
      })),

      ...result.digital.map((d) => ({
        label: d.title,
        type: 'DIGITAL' as const,
        id: d.id,
        meta: d.assetType,
      })),

      ...result.research.map((r) => ({
        label: r.title,
        type: 'RESEARCH' as const,
        id: r.id,
        meta: r.itemType,
      })),
    ].slice(0, limit);
  }
}
