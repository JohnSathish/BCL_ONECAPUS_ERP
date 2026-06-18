import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { LibraryRecommendationService } from './library-recommendation.service';
import { LibrarySearchService } from './library-search.service';
import { LibrarySettingsService } from './library-settings.service';

export type AssistantLink = { label: string; href: string };

export type AssistantResult = {
  type: 'BOOK' | 'DIGITAL' | 'RESEARCH';
  title: string;
  meta: string;
  id?: string;
};

export type LibraryAssistantResponse = {
  answer: string;
  links: AssistantLink[];
  results: AssistantResult[];
  suggestedFollowUps: string[];
  source: 'library-assistant';
};

@Injectable()
export class LibraryKnowledgeAssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: LibrarySearchService,
    private readonly recommendations: LibraryRecommendationService,
    private readonly settings: LibrarySettingsService,
  ) {}

  defaultPrompts(isStudent: boolean) {
    const common = [
      'Find books on economics',
      'Show latest books added',
      'Where is my book located?',
      'What are the most borrowed books?',
    ];
    if (isStudent) {
      return [
        ...common,
        'When are my books due?',
        'Recommend books for my department',
        'How many library visits do I have?',
      ];
    }
    return [
      ...common,
      'Library footfall today',
      'Export NAAC library report',
      'How many overdue loans?',
    ];
  }

  async ask(
    user: JwtUser,
    question: string,
  ): Promise<LibraryAssistantResponse> {
    const libSettings = await this.settings.getSettings(user.tid);
    if (libSettings.assistantEnabled === false) {
      return {
        answer:
          'The Library Knowledge Assistant is disabled by your librarian.',
        links: [{ label: 'Library settings', href: '/admin/library/settings' }],
        results: [],
        suggestedFollowUps: [],
        source: 'library-assistant',
      };
    }

    const q = question.trim().toLowerCase();
    if (!q) {
      return this.help(user);
    }

    if (
      this.matches(q, ['recommend', 'suggest', 'for my department', 'for me'])
    ) {
      return this.recommendationsIntent(user);
    }

    if (
      this.matches(q, [
        'my loan',
        'due date',
        'overdue',
        'borrowed',
        'when is due',
      ])
    ) {
      return this.myLoansIntent(user);
    }

    if (this.matches(q, ['fine', 'penalty', 'outstanding'])) {
      return this.finesIntent(user);
    }

    if (
      this.matches(q, ['where', 'location', 'rack', 'shelf', 'find on shelf'])
    ) {
      return this.locationIntent(user, question);
    }

    if (
      this.matches(q, [
        'latest',
        'new book',
        'recently added',
        'new acquisition',
      ])
    ) {
      return this.latestBooksIntent(user.tid);
    }

    if (this.matches(q, ['naac', 'accreditation', 'iqac', 'audit report'])) {
      return this.naacIntent();
    }

    if (
      this.matches(q, [
        'footfall',
        'visitor',
        'occupancy',
        'seats',
        'capacity',
        'how many inside',
      ])
    ) {
      return this.occupancyIntent(user.tid);
    }

    if (
      this.matches(q, ['digital', 'ebook', 'e-book', 'journal', 'pdf download'])
    ) {
      return this.digitalIntent(user, question);
    }

    if (
      this.matches(q, ['most borrowed', 'popular book', 'top book', 'reading'])
    ) {
      return this.popularIntent(user.tid);
    }

    if (
      this.matches(q, ['find', 'search', 'book on', 'books about', 'show me'])
    ) {
      return this.searchIntent(user, question);
    }

    return this.help(user);
  }

  private matches(q: string, phrases: string[]) {
    return phrases.some((p) => q.includes(p));
  }

  private extractTopic(question: string) {
    const cleaned = question
      .replace(/^(find|search|show|books on|book on|about)\s+/i, '')
      .replace(/\?+$/, '')
      .trim();
    return cleaned.length >= 2 ? cleaned : question.trim();
  }

  private async searchIntent(
    user: JwtUser,
    question: string,
  ): Promise<LibraryAssistantResponse> {
    const topic = this.extractTopic(question);
    const hits = await this.search.search(user, topic, 8, 'ALL');
    const results: AssistantResult[] = [
      ...hits.books.map((b) => ({
        type: 'BOOK' as const,
        title: b.title,
        meta: `${b.author ?? 'Unknown author'} · ${b.accessionNo}`,
        id: b.id,
      })),
      ...hits.digital.map((d) => ({
        type: 'DIGITAL' as const,
        title: d.title,
        meta: d.assetType.replace(/_/g, ' '),
        id: d.id,
      })),
      ...hits.research.map((r) => ({
        type: 'RESEARCH' as const,
        title: r.title,
        meta: r.itemType.replace(/_/g, ' '),
        id: r.id,
      })),
    ];

    if (!results.length) {
      return {
        answer: `No catalogue matches for "${topic}". Try a shorter keyword or check spelling.`,
        links: [{ label: 'Search catalogue', href: '/admin/library/search' }],
        results: [],
        suggestedFollowUps: [
          'Show latest books added',
          'Recommend books for my department',
        ],
        source: 'library-assistant',
      };
    }

    const lines = results
      .slice(0, 5)
      .map((r, i) => `${i + 1}. ${r.title} (${r.meta})`)
      .join('\n');

    return {
      answer: `Found ${hits.total} match(es) for "${topic}":\n${lines}`,
      links: [
        {
          label: 'Open search',
          href: `/admin/library/search?q=${encodeURIComponent(topic)}`,
        },
      ],
      results: results.slice(0, 8),
      suggestedFollowUps: [
        `Where is ${results[0]?.title} located?`,
        'Recommend similar books',
      ],
      source: 'library-assistant',
    };
  }

  private async recommendationsIntent(
    user: JwtUser,
  ): Promise<LibraryAssistantResponse> {
    try {
      const recs = await this.recommendations.getRecommendations(user, 6);
      if (!recs.length) {
        return {
          answer:
            'No personalized recommendations yet — visit the library or borrow books to improve suggestions.',
          links: [{ label: 'Student library', href: '/student/library' }],
          results: [],
          suggestedFollowUps: [
            'Find books on economics',
            'Show latest books added',
          ],
          source: 'library-assistant',
        };
      }
      const lines = recs
        .map(
          (r, i) =>
            `${i + 1}. ${r.title}${r.author ? ` — ${r.author}` : ''} (${r.reasons[0] ?? 'Suggested'})`,
        )
        .join('\n');
      return {
        answer: `Recommended for you:\n${lines}`,
        links: [{ label: 'My library dashboard', href: '/student/library' }],
        results: recs.map((r) => ({
          type: 'BOOK' as const,
          title: r.title,
          meta: r.reasons.join(', '),
          id: r.bookId,
        })),
        suggestedFollowUps: [
          'When are my books due?',
          'Find books on my courses',
        ],
        source: 'library-assistant',
      };
    } catch {
      return {
        answer:
          'Recommendations are available to students with an active library membership.',
        links: [],
        results: [],
        suggestedFollowUps: ['Find books on economics'],
        source: 'library-assistant',
      };
    }
  }

  private async myLoansIntent(
    user: JwtUser,
  ): Promise<LibraryAssistantResponse> {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
    });
    if (!student) {
      return {
        answer: 'Loan history is shown on the student library portal.',
        links: [
          { label: 'Circulation desk', href: '/admin/library/circulation' },
        ],
        results: [],
        suggestedFollowUps: ['Find books on economics'],
        source: 'library-assistant',
      };
    }

    const loans = await this.prisma.libraryLoan.findMany({
      where: { tenantId: user.tid, studentId: student.id, status: 'ACTIVE' },
      include: { copy: { include: { book: true } } },
      orderBy: { dueAt: 'asc' },
    });

    if (!loans.length) {
      return {
        answer: 'You have no active loans right now.',
        links: [{ label: 'Browse library', href: '/student/library' }],
        results: [],
        suggestedFollowUps: [
          'Recommend books for my department',
          'Find books on economics',
        ],
        source: 'library-assistant',
      };
    }

    const now = new Date();
    const lines = loans
      .map((l) => {
        const overdue = l.dueAt < now;
        return `• ${l.copy.book.title} — due ${l.dueAt.toLocaleDateString('en-IN')}${overdue ? ' (OVERDUE)' : ''}`;
      })
      .join('\n');

    return {
      answer: `You have ${loans.length} active loan(s):\n${lines}`,
      links: [{ label: 'My library', href: '/student/library' }],
      results: loans.map((l) => ({
        type: 'BOOK' as const,
        title: l.copy.book.title,
        meta: `Due ${l.dueAt.toLocaleDateString('en-IN')}`,
        id: l.copy.book.id,
      })),
      suggestedFollowUps: [
        'Do I have any fines?',
        'Recommend books for my department',
      ],
      source: 'library-assistant',
    };
  }

  private async finesIntent(user: JwtUser): Promise<LibraryAssistantResponse> {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
    });
    if (!student) {
      return {
        answer: 'Ask at the circulation desk for fine balance.',
        links: [{ label: 'Circulation', href: '/admin/library/circulation' }],
        results: [],
        suggestedFollowUps: [],
        source: 'library-assistant',
      };
    }

    const fines = await this.prisma.libraryFine.findMany({
      where: {
        tenantId: user.tid,
        paidAt: null,
        waivedAt: null,
        loan: { studentId: student.id },
      },
      include: { loan: { include: { copy: { include: { book: true } } } } },
    });

    if (!fines.length) {
      return {
        answer: 'You have no unpaid library fines.',
        links: [],
        results: [],
        suggestedFollowUps: ['When are my books due?'],
        source: 'library-assistant',
      };
    }

    const total = fines.reduce((s, f) => s + Number(f.amount), 0);
    const lines = fines
      .map(
        (f) => `• ${f.loan.copy.book.title} — ₹${Number(f.amount).toFixed(2)}`,
      )
      .join('\n');

    return {
      answer: `Outstanding fines total ₹${total.toFixed(2)}:\n${lines}\n\nPlease pay at the circulation desk.`,
      links: [{ label: 'My library', href: '/student/library' }],
      results: [],
      suggestedFollowUps: ['When are my books due?'],
      source: 'library-assistant',
    };
  }

  private async locationIntent(
    user: JwtUser,
    question: string,
  ): Promise<LibraryAssistantResponse> {
    const topic = this.extractTopic(question);
    const hits = await this.search.search(user, topic, 3, 'BOOK');
    if (!hits.books.length) {
      return {
        answer: `Could not find a book matching "${topic}" for location lookup.`,
        links: [{ label: 'Search', href: '/admin/library/search' }],
        results: [],
        suggestedFollowUps: ['Find books on economics'],
        source: 'library-assistant',
      };
    }

    const book = await this.prisma.libraryBook.findFirst({
      where: { tenantId: user.tid, id: hits.books[0]!.id, deletedAt: null },
      include: { copies: { where: { status: 'AVAILABLE' }, take: 1 } },
    });

    if (!book) {
      return {
        answer: 'Book record not found.',
        links: [],
        results: [],
        suggestedFollowUps: [],
        source: 'library-assistant',
      };
    }

    const parts = [
      book.section,
      book.rack,
      book.shelf,
      book.row,
      book.location,
    ].filter(Boolean);
    const loc = parts.length
      ? parts.join(' · ')
      : 'Location not catalogued — ask at the desk';
    const avail = book.copies.length
      ? 'Copy available'
      : 'All copies currently issued';

    return {
      answer: `"${book.title}" (${book.accessionNo})\nLocation: ${loc}\n${avail}`,
      links: [{ label: 'Catalogue', href: `/admin/library/catalogue` }],
      results: [
        {
          type: 'BOOK',
          title: book.title,
          meta: loc,
          id: book.id,
        },
      ],
      suggestedFollowUps: [
        'Find similar books',
        'Recommend books for my department',
      ],
      source: 'library-assistant',
    };
  }

  private async latestBooksIntent(
    tenantId: string,
  ): Promise<LibraryAssistantResponse> {
    const books = await this.prisma.libraryBook.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { category: true },
    });

    const lines = books
      .map(
        (b, i) =>
          `${i + 1}. ${b.title} (${b.accessionNo}) — ${b.category?.name ?? 'General'}`,
      )
      .join('\n');

    return {
      answer: books.length
        ? `Latest additions:\n${lines}`
        : 'No books in catalogue yet.',
      links: [
        { label: 'Accession workflow', href: '/admin/library/accession' },
      ],
      results: books.map((b) => ({
        type: 'BOOK' as const,
        title: b.title,
        meta: b.accessionNo,
        id: b.id,
      })),
      suggestedFollowUps: ['Find books on economics', 'Most borrowed books'],
      source: 'library-assistant',
    };
  }

  private naacIntent(): LibraryAssistantResponse {
    return {
      answer:
        'Generate NAAC-ready library evidence from the NAAC Reports bundle — footfall, department usage, e-resources, and reading statistics. Link the PDF to IQAC Evidence in one click.',
      links: [
        { label: 'NAAC Library Reports', href: '/admin/library/naac-reports' },
        { label: 'IQAC Evidence', href: '/admin/naac/evidence' },
      ],
      results: [],
      suggestedFollowUps: ['Library footfall today', 'Most borrowed books'],
      source: 'library-assistant',
    };
  }

  private async occupancyIntent(
    tenantId: string,
  ): Promise<LibraryAssistantResponse> {
    const settings = await this.settings.getSettings(tenantId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [inside, todayVisits] = await Promise.all([
      this.prisma.libraryVisit.count({
        where: { tenantId, exitAt: null },
      }),
      this.prisma.libraryVisit.count({
        where: { tenantId, entryAt: { gte: startOfDay } },
      }),
    ]);

    const available = Math.max(0, settings.totalSeats - inside);
    return {
      answer: `Live occupancy: ${inside} inside, ${available} seats free (${settings.totalSeats} total).\nToday's footfall: ${todayVisits} visits.`,
      links: [
        { label: 'Library dashboard', href: '/admin/library' },
        { label: 'Entry analytics', href: '/admin/library/visits' },
      ],
      results: [],
      suggestedFollowUps: ['Export NAAC library report', 'Most borrowed books'],
      source: 'library-assistant',
    };
  }

  private async digitalIntent(
    user: JwtUser,
    question: string,
  ): Promise<LibraryAssistantResponse> {
    const topic = this.extractTopic(question);
    const hits = await this.search.search(user, topic, 6, 'DIGITAL');
    if (!hits.digital.length) {
      return {
        answer:
          'No digital resources matched. Browse the Digital Library section.',
        links: [{ label: 'Digital library', href: '/admin/library/digital' }],
        results: [],
        suggestedFollowUps: ['Find books on economics'],
        source: 'library-assistant',
      };
    }

    const lines = hits.digital
      .map((d, i) => `${i + 1}. ${d.title} (${d.assetType.replace(/_/g, ' ')})`)
      .join('\n');

    return {
      answer: `Digital resources:\n${lines}`,
      links: [{ label: 'Digital library', href: '/admin/library/digital' }],
      results: hits.digital.map((d) => ({
        type: 'DIGITAL' as const,
        title: d.title,
        meta: d.assetType,
        id: d.id,
      })),
      suggestedFollowUps: ['Find print books on same topic'],
      source: 'library-assistant',
    };
  }

  private async popularIntent(
    tenantId: string,
  ): Promise<LibraryAssistantResponse> {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const loans = await this.prisma.libraryLoan.findMany({
      where: { tenantId, issuedAt: { gte: since } },
      include: {
        copy: {
          include: {
            book: { select: { id: true, title: true, author: true } },
          },
        },
      },
      take: 500,
    });

    const counts = new Map<
      string,
      { title: string; author: string | null; n: number }
    >();
    for (const loan of loans) {
      const b = loan.copy.book;
      const row = counts.get(b.id) ?? {
        title: b.title,
        author: b.author,
        n: 0,
      };
      row.n += 1;
      counts.set(b.id, row);
    }

    const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 8);
    const lines = top
      .map((r, i) => `${i + 1}. ${r.title} (${r.n} issues)`)
      .join('\n');

    return {
      answer: top.length
        ? `Most borrowed (last 90 days):\n${lines}`
        : 'No circulation data in the last 90 days yet.',
      links: [{ label: 'Reading analytics', href: '/admin/library/analytics' }],
      results: top.map((r) => ({
        type: 'BOOK' as const,
        title: r.title,
        meta: `${r.n} issues`,
      })),
      suggestedFollowUps: ['Library footfall today', 'Show latest books'],
      source: 'library-assistant',
    };
  }

  private async help(user: JwtUser): Promise<LibraryAssistantResponse> {
    const isStudent = user.roles?.includes('student') ?? false;
    return {
      answer: isStudent
        ? 'I can help you find books, check due dates, get recommendations, and locate titles on the shelf. Try a question below.'
        : 'I can search the catalogue, summarize footfall, list popular titles, and guide you to NAAC library reports.',
      links: [
        { label: 'Library dashboard', href: '/admin/library' },
        { label: 'Search', href: '/admin/library/search' },
      ],
      results: [],
      suggestedFollowUps: this.defaultPrompts(isStudent).slice(0, 4),
      source: 'library-assistant',
    };
  }
}
