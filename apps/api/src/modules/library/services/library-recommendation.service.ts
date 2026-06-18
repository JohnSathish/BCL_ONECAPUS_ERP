import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import {
  computeReadingScore,
  matchScore,
  tokenizeForMatch,
} from '../domain/library-reading-score';

export type RecommendedBook = {
  bookId: string;
  title: string;
  author: string | null;
  accessionNo: string;
  category: string | null;
  availableCopies: number;
  score: number;
  reasons: string[];
};

export type StudentLibraryDashboard = {
  profile: {
    fullName: string;
    department: string | null;
    programme: string | null;
    semester: number | null;
  };
  readingScore: {
    overall: number;
    visitsPoints: number;
    loansPoints: number;
    onTimePoints: number;
    membershipPoints: number;
    visitCount: number;
    totalLoans: number;
    onTimeReturns: number;
  };
  stats: {
    totalVisits: number;
    totalLoans: number;
    activeLoans: number;
    activeReservations: number;
    outstandingFine: number;
  };
  activeLoans: {
    id: string;
    bookTitle: string;
    dueAt: string;
    isOverdue: boolean;
  }[];
  readingHistory: {
    id: string;
    bookTitle: string;
    author: string | null;
    issuedAt: string;
    returnedAt: string | null;
    wasOverdue: boolean;
  }[];
  recommendations: RecommendedBook[];
};

@Injectable()
export class LibraryRecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveStudent(user: JwtUser) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      include: {
        masterProfile: { select: { fullName: true } },
        department: { select: { id: true, name: true, code: true } },
        programVersion: { include: { program: { select: { name: true } } } },
        academicProfile: { select: { class12Subjects: true } },
        academicStanding: { select: { currentSemesterSequence: true } },
      },
    });
    if (!student) throw new NotFoundException('Student record not found');
    return student;
  }

  async getStudentDashboard(user: JwtUser): Promise<StudentLibraryDashboard> {
    const student = await this.resolveStudent(user);
    const [visits, loans, reservations, fines, recommendations] =
      await Promise.all([
        this.prisma.libraryVisit.count({
          where: { tenantId: user.tid, studentId: student.id },
        }),
        this.prisma.libraryLoan.findMany({
          where: { tenantId: user.tid, studentId: student.id },
          include: { copy: { include: { book: true } }, fines: true },
          orderBy: { issuedAt: 'desc' },
          take: 100,
        }),
        this.prisma.libraryReservation.count({
          where: {
            tenantId: user.tid,
            studentId: student.id,
            status: 'ACTIVE',
          },
        }),
        this.prisma.libraryFine.aggregate({
          where: {
            tenantId: user.tid,
            paidAt: null,
            waivedAt: null,
            loan: { studentId: student.id },
          },
          _sum: { amount: true },
        }),
        this.getRecommendations(user, 12),
      ]);

    const returned = loans.filter((l) => l.status === 'RETURNED');
    const onTimeReturns = returned.filter(
      (l) => l.returnedAt && l.returnedAt <= l.dueAt,
    ).length;
    const score = computeReadingScore({
      visitCount: visits,
      totalLoans: loans.length,
      onTimeReturns,
      activeMember: true,
    });

    const activeLoans = loans
      .filter((l) => l.status === 'ACTIVE')
      .map((l) => ({
        id: l.id,
        bookTitle: l.copy.book.title,
        dueAt: l.dueAt.toISOString(),
        isOverdue: l.dueAt < new Date(),
      }));

    const readingHistory = loans.slice(0, 20).map((l) => ({
      id: l.id,
      bookTitle: l.copy.book.title,
      author: l.copy.book.author,
      issuedAt: l.issuedAt.toISOString(),
      returnedAt: l.returnedAt?.toISOString() ?? null,
      wasOverdue: Boolean(
        l.returnedAt && l.returnedAt > l.dueAt && l.fines.length > 0,
      ),
    }));

    return {
      profile: {
        fullName: student.masterProfile?.fullName ?? 'Student',
        department: student.department?.name ?? null,
        programme: student.programVersion?.program?.name ?? null,
        semester: student.academicStanding?.currentSemesterSequence ?? null,
      },
      readingScore: {
        ...score,
        visitCount: visits,
        totalLoans: loans.length,
        onTimeReturns,
      },
      stats: {
        totalVisits: visits,
        totalLoans: loans.length,
        activeLoans: activeLoans.length,
        activeReservations: reservations,
        outstandingFine: Number(fines._sum.amount ?? 0),
      },
      activeLoans,
      readingHistory,
      recommendations,
    };
  }

  async getRecommendations(
    user: JwtUser,
    limit = 12,
  ): Promise<RecommendedBook[]> {
    const student = await this.resolveStudent(user);
    const tenantId = user.tid;

    const [pastLoans, registrations, peerLoans, activeLoans, reservations] =
      await Promise.all([
        this.prisma.libraryLoan.findMany({
          where: { tenantId, studentId: student.id },
          include: {
            copy: { include: { book: { include: { category: true } } } },
          },
          take: 50,
        }),
        this.prisma.registration.findMany({
          where: { tenantId, studentId: student.id, deletedAt: null },
          include: {
            offering: {
              include: { course: { select: { title: true, code: true } } },
            },
          },
          take: 30,
        }),
        student.departmentId
          ? (async () => {
              const peers = await this.prisma.student.findMany({
                where: {
                  tenantId,
                  departmentId: student.departmentId!,
                  deletedAt: null,
                },
                select: { id: true },
                take: 300,
              });
              const peerIds = peers.map((p) => p.id);
              if (!peerIds.length) return [];
              return this.prisma.libraryLoan.findMany({
                where: {
                  tenantId,
                  studentId: { in: peerIds },
                  issuedAt: { gte: new Date(Date.now() - 365 * 86400000) },
                },
                include: { copy: { select: { bookId: true } } },
                take: 400,
              });
            })()
          : Promise.resolve([]),
        this.prisma.libraryLoan.findMany({
          where: { tenantId, studentId: student.id, status: 'ACTIVE' },
          select: { copy: { select: { bookId: true } } },
        }),
        this.prisma.libraryReservation.findMany({
          where: { tenantId, studentId: student.id, status: 'ACTIVE' },
          select: { bookId: true },
        }),
      ]);

    const excludeIds = new Set([
      ...activeLoans.map((l) => l.copy.bookId),
      ...reservations.map((r) => r.bookId),
    ]);

    const courseKeywords = registrations.flatMap((r) => [
      r.offering.course.title,
      r.offering.course.code,
    ]);

    const class12Raw = student.academicProfile?.class12Subjects;
    const class12Subjects: string[] = Array.isArray(class12Raw)
      ? class12Raw.map((s) => (typeof s === 'string' ? s : String(s)))
      : [];

    const deptTokens = student.department
      ? tokenizeForMatch(student.department.name)
      : [];

    const historyCategories = new Set(
      pastLoans
        .map((l) => l.copy.book.category?.name)
        .filter(Boolean) as string[],
    );

    const peerPopularity = new Map<string, number>();
    for (const loan of peerLoans) {
      const id = loan.copy.bookId;
      peerPopularity.set(id, (peerPopularity.get(id) ?? 0) + 1);
    }

    const books = await this.prisma.libraryBook.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        category: true,
        copies: { where: { status: 'AVAILABLE' }, select: { id: true } },
      },
      take: 400,
      orderBy: { createdAt: 'desc' },
    });

    const scored: RecommendedBook[] = [];

    for (const book of books) {
      if (excludeIds.has(book.id)) continue;

      const haystack = [
        book.title,
        book.author ?? '',
        book.category?.name ?? '',
        book.category?.code ?? '',
      ].join(' ');

      let score = 0;
      const reasons: string[] = [];

      const deptMatch = matchScore(haystack, deptTokens);
      if (deptMatch > 0 && student.department) {
        score += Math.min(40, deptMatch);
        reasons.push(`Matches ${student.department.name}`);
      }

      const courseMatch = matchScore(haystack, courseKeywords);
      if (courseMatch > 0) {
        score += Math.min(35, courseMatch);
        reasons.push('Related to your enrolled courses');
      }

      const subjectMatch = matchScore(haystack, class12Subjects);
      if (subjectMatch > 0) {
        score += Math.min(25, subjectMatch);
        reasons.push('Matches your Class 12 subjects');
      }

      if (book.category?.name && historyCategories.has(book.category.name)) {
        score += 30;
        reasons.push(`You read ${book.category.name} before`);
      }

      const peerCount = peerPopularity.get(book.id) ?? 0;
      if (peerCount > 0) {
        score += Math.min(20, peerCount * 2);
        reasons.push('Popular in your department');
      }

      if (book.copies.length > 0) {
        score += 5;
      }

      if (score <= 0) continue;

      scored.push({
        bookId: book.id,
        title: book.title,
        author: book.author,
        accessionNo: book.accessionNo,
        category: book.category?.name ?? null,
        availableCopies: book.copies.length,
        score,
        reasons: [...new Set(reasons)].slice(0, 3),
      });
    }

    scored.sort(
      (a, b) => b.score - a.score || b.availableCopies - a.availableCopies,
    );

    if (scored.length < limit) {
      const scoredIds = new Set(scored.map((s) => s.bookId));
      const mergedExclude = new Set([...excludeIds, ...scoredIds]);
      const fallback = await this.popularFallback(
        tenantId,
        mergedExclude,
        limit - scored.length,
      );
      scored.push(...fallback);
    }

    const seen = new Set<string>();
    return scored
      .filter((book) => {
        if (seen.has(book.bookId)) return false;
        seen.add(book.bookId);
        return true;
      })
      .slice(0, limit);
  }

  private async popularFallback(
    tenantId: string,
    excludeIds: Set<string>,
    count: number,
  ): Promise<RecommendedBook[]> {
    if (count <= 0) return [];

    const since = new Date();
    since.setDate(since.getDate() - 180);

    const recent = await this.prisma.libraryLoan.findMany({
      where: { tenantId, issuedAt: { gte: since } },
      include: { copy: { select: { bookId: true } } },
      take: 500,
    });

    const issueCounts = new Map<string, number>();
    for (const loan of recent) {
      const id = loan.copy.bookId;
      issueCounts.set(id, (issueCounts.get(id) ?? 0) + 1);
    }
    const topBookIds = [...issueCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([id]) => id);

    const books = topBookIds.length
      ? await this.prisma.libraryBook.findMany({
          where: { tenantId, id: { in: topBookIds }, deletedAt: null },
          include: {
            category: true,
            copies: { where: { status: 'AVAILABLE' } },
          },
        })
      : [];

    return topBookIds
      .map((bookId) => {
        const book = books.find((b) => b.id === bookId);
        if (!book || excludeIds.has(book.id)) return null;
        return {
          bookId: book.id,
          title: book.title,
          author: book.author,
          accessionNo: book.accessionNo,
          category: book.category?.name ?? null,
          availableCopies: book.copies.length,
          score: issueCounts.get(bookId) ?? 0,
          reasons: ['Trending in the library'],
        };
      })
      .filter(Boolean)
      .slice(0, count) as RecommendedBook[];
  }
}
