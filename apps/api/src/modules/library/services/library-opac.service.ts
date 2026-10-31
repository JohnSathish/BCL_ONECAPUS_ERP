import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { portalHostCandidates } from '../../../common/utils/request-host';
import { PrismaService } from '../../../database/prisma.service';
import { resolveCopyIssue } from '../domain/library-copy-issue.logic';
import { opacCopyAvailability } from '../domain/library-opac.logic';
import { mergeCirculationPolicy } from '../domain/library-policy.types';
import type {
  OpacSearchQueryDto,
  UpdateOpacSettingsDto,
} from '../dto/library-opac.dto';
import { LibraryCirculationService } from './library-circulation.service';
import { LibraryReservationService } from './library-reservation.service';
import { LibrarySettingsService } from './library-settings.service';

export type OpacSettings = {
  enabled: boolean;
  publicSearch: boolean;
  studentLogin: boolean;
  staffLogin: boolean;
  reservation: boolean;
  renewal: boolean;
  showFines: boolean;
  digital: boolean;
  maxReservations: number;
  reservationDays: number;
  hours: Array<{ label: string; hours: string }>;
  announcements: Array<{ text: string; date: string }>;
  contactPhone: string;
  contactEmail: string;
};

const DEFAULT_OPAC: OpacSettings = {
  enabled: true,
  publicSearch: true,
  studentLogin: true,
  staffLogin: true,
  reservation: true,
  renewal: true,
  showFines: true,
  digital: true,
  maxReservations: 2,
  reservationDays: 3,
  hours: [],
  announcements: [],
  contactPhone: '',
  contactEmail: '',
};

@Injectable()
export class LibraryOpacService {
  private readonly logger = new Logger(LibraryOpacService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: LibrarySettingsService,
    private readonly reservations: LibraryReservationService,
    private readonly circulation: LibraryCirculationService,
  ) {}

  async tenantIdForHost(hostHeader: string) {
    const candidates = portalHostCandidates(hostHeader.split(',')[0] ?? '');
    if (candidates.length === 0) return null;
    for (const candidate of candidates) {
      const domain = await this.prisma.tenantDomain.findFirst({
        where: { host: candidate, deletedAt: null, verified: true },
        select: { tenantId: true },
      });
      if (domain?.tenantId) return domain.tenantId;
    }
    return null;
  }

  async home(tenantId: string) {
    const [brand, settings, cards, recent, borrowed] = await Promise.all([
      this.brand(tenantId),
      this.publicSettings(tenantId),
      this.cards(tenantId),
      this.recentBooks(tenantId),
      this.mostBorrowed(tenantId),
    ]);
    return { ...brand, settings, cards, recent, mostBorrowed: borrowed };
  }

  async search(
    tenantId: string,
    query: OpacSearchQueryDto,
    actorId?: string | null,
    access: 'public' | 'member' = 'public',
  ) {
    const settings = await this.publicSettings(tenantId);
    if (access === 'public' && !settings.publicSearch) {
      throw new BadRequestException('The public catalogue is turned off.');
    }
    if (access === 'member' && !settings.enabled) {
      throw new BadRequestException('The library catalogue is turned off.');
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const q = query.q?.trim() ?? '';
    const like = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    const field = query.field ?? 'all';
    const text =
      q.length === 0
        ? Prisma.empty
        : field === 'title'
          ? Prisma.sql`AND b.title ILIKE ${like}`
          : field === 'author'
            ? Prisma.sql`AND COALESCE(b.author, '') ILIKE ${like}`
            : field === 'isbn'
              ? Prisma.sql`AND COALESCE(b.isbn, '') ILIKE ${like}`
              : field === 'subject'
                ? Prisma.sql`AND COALESCE(b.subject, '') ILIKE ${like}`
                : field === 'publisher'
                  ? Prisma.sql`AND COALESCE(b.publisher, '') ILIKE ${like}`
                  : field === 'accession'
                    ? Prisma.sql`AND EXISTS (
                        SELECT 1 FROM library.library_book_copies c
                        WHERE c.book_id = b.id
                          AND (COALESCE(c.accession_number, '') ILIKE ${like} OR c.barcode ILIKE ${like})
                      )`
                    : field === 'call'
                      ? Prisma.sql`AND (
                          COALESCE(b.classification_number, '') ILIKE ${like}
                          OR EXISTS (
                            SELECT 1 FROM library.library_book_copies c
                            WHERE c.book_id = b.id AND COALESCE(c.call_number, '') ILIKE ${like}
                          )
                        )`
                      : field === 'department'
                        ? Prisma.sql`AND EXISTS (
                          SELECT 1 FROM core.departments dep
                          WHERE dep.id = b.department_id AND dep.department_name ILIKE ${like}
                        )`
                        : Prisma.sql`AND (
                          b.title ILIKE ${like}
                          OR COALESCE(b.author, '') ILIKE ${like}
                          OR COALESCE(b.additional_authors, '') ILIKE ${like}
                          OR COALESCE(b.isbn, '') ILIKE ${like}
                          OR COALESCE(b.subject, '') ILIKE ${like}
                          OR COALESCE(b.publisher, '') ILIKE ${like}
                          OR COALESCE(b.description, '') ILIKE ${like}
                          OR COALESCE(b.classification_number, '') ILIKE ${like}
                          OR EXISTS (
                            SELECT 1 FROM library.library_book_copies c
                            WHERE c.book_id = b.id
                              AND (
                                COALESCE(c.accession_number, '') ILIKE ${like}
                                OR c.barcode ILIKE ${like}
                                OR COALESCE(c.call_number, '') ILIKE ${like}
                              )
                          )
                        )`;
    const availability =
      query.availability === 'available'
        ? Prisma.sql`AND EXISTS (
            SELECT 1 FROM library.library_book_copies c
            WHERE c.book_id = b.id AND c.status = 'AVAILABLE'
              AND (
                c.issue_allowed IS TRUE
                OR (
                  c.issue_allowed IS NULL
                  AND COALESCE(c.copy_type, '') NOT IN ('REFERENCE', 'RARE', 'RESTRICTED')
                  AND COALESCE(b.book_type, '') <> 'REFERENCE'
                )
              )
          )`
        : query.availability === 'borrowed'
          ? Prisma.sql`AND EXISTS (
              SELECT 1 FROM library.library_book_copies c
              JOIN library.library_loans l ON l.copy_id = c.id AND l.status = 'ACTIVE' AND l.returned_at IS NULL
              WHERE c.book_id = b.id
            )`
          : query.availability === 'reference'
            ? Prisma.sql`AND EXISTS (
                SELECT 1 FROM library.library_book_copies c
                WHERE c.book_id = b.id
                  AND (c.copy_type = 'REFERENCE' OR c.issue_allowed IS FALSE OR b.book_type = 'REFERENCE')
              )`
            : Prisma.empty;
    const department = query.departmentId
      ? Prisma.sql`AND b.department_id = CAST(${query.departmentId} AS uuid)`
      : Prisma.empty;
    const category = query.categoryId
      ? Prisma.sql`AND b.category_id = CAST(${query.categoryId} AS uuid)`
      : Prisma.empty;
    const year = query.year
      ? Prisma.sql`AND b.publication_year = ${query.year}`
      : Prisma.empty;
    const material =
      query.material === 'journal'
        ? Prisma.sql`AND UPPER(COALESCE(b.book_type, '')) IN ('JOURNAL', 'PERIODICAL')`
        : query.material === 'book'
          ? Prisma.sql`AND UPPER(COALESCE(b.book_type, '')) NOT IN ('JOURNAL', 'PERIODICAL')`
          : Prisma.empty;
    const order =
      query.sort === 'title_desc'
        ? Prisma.sql`b.title DESC`
        : query.sort === 'recent'
          ? Prisma.sql`b.created_at DESC`
          : query.sort === 'author'
            ? Prisma.sql`b.author ASC NULLS LAST, b.title ASC`
            : query.sort === 'borrowed'
              ? Prisma.sql`COUNT(l.id) DESC, b.title ASC`
              : Prisma.sql`b.title ASC`;
    const loanJoin =
      query.sort === 'borrowed'
        ? Prisma.sql`LEFT JOIN library.library_book_copies bc ON bc.book_id = b.id
                     LEFT JOIN library.library_loans l ON l.copy_id = bc.id`
        : Prisma.empty;
    const where = Prisma.sql`
      b.tenant_id = CAST(${tenantId} AS uuid) AND b.deleted_at IS NULL
      ${text} ${availability} ${department} ${category} ${year} ${material}
    `;
    let countRow: [{ total: number }];
    let idRows: { id: string }[];
    try {
      [countRow, idRows] = await Promise.all([
        this.prisma.$queryRaw<[{ total: number }]>`
        SELECT COUNT(DISTINCT b.id)::int AS total
        FROM library.library_books b
        WHERE ${where}
      `,
        this.prisma.$queryRaw<{ id: string }[]>`
        SELECT b.id
        FROM library.library_books b
        ${loanJoin}
        WHERE ${where}
        GROUP BY b.id, b.title, b.author, b.created_at
        ORDER BY ${order}
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `,
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown catalogue error';
      this.logger.error(
        `OPAC search failed for tenant ${tenantId}: ${message}`,
      );
      throw error;
    }
    const items = await this.cardsFor(
      tenantId,
      idRows.map((row) => row.id),
    );
    if (q) {
      await this.event(tenantId, 'SEARCH', actorId, null, q.slice(0, 120));
    }
    return { page, limit, total: Number(countRow[0]?.total ?? 0), items };
  }

  async book(tenantId: string, bookId: string, actorId?: string | null) {
    const book = await this.prisma.libraryBook.findFirst({
      where: { tenantId, id: bookId, deletedAt: null },
      include: {
        category: true,
        copies: {
          include: {
            loans: { where: { status: 'ACTIVE', returnedAt: null }, take: 1 },
          },
          orderBy: { accessionNumber: 'asc' },
        },
      },
    });
    if (!book) throw new NotFoundException('Book not found');
    const policy = await this.policy(tenantId);
    const departments = await this.departmentNames(tenantId, [
      book.departmentId,
    ]);
    const copies = book.copies.map((copy) => {
      const decision = resolveCopyIssue({
        copyType: copy.copyType,
        issueAllowed: copy.issueAllowed,
        categoryCode: book.category?.code,
        copyIssue: policy.copyIssue,
        referenceAllow: policy.reference.allowIssue,
        rareAllow: policy.rare.allowIssue,
      });
      const availability = opacCopyAvailability({
        status: copy.status,
        onLoan: copy.loans.length > 0,
        issueAllowed: decision.allowed,
        copyType: decision.copyType ?? copy.copyType,
      });
      return {
        id: copy.id,
        accessionNumber: copy.accessionNumber || copy.barcode,
        barcode: copy.barcode,
        copyType: decision.copyType ?? copy.copyType,
        callNumber: copy.callNumber || book.classificationNumber,
        shelf: copy.shelvingLocation,
        status: copy.status,
        availability: availability.label,
        tone: availability.tone,
      };
    });
    await this.event(tenantId, 'VIEW', actorId, book.id, null);
    return {
      id: book.id,
      title: book.title,
      author: [book.author, book.additionalAuthors].filter(Boolean).join(', '),
      isbn: book.isbn,
      publisher: book.publisher,
      publicationYear: book.publicationYear,
      edition: book.edition,
      subject: book.subject,
      category: book.category?.name ?? null,
      department: departments.get(book.departmentId ?? '') ?? null,
      classificationNumber: book.classificationNumber,
      language: book.language,
      coverImageUrl: book.coverImageUrl,
      total: copies.length,
      available: copies.filter((copy) => copy.tone === 'available').length,
      borrowed: copies.filter((copy) => copy.tone === 'borrowed').length,
      reference: copies.filter((copy) => copy.tone === 'reference').length,
      copies,
    };
  }

  async info(tenantId: string) {
    const [brand, settings, stored] = await Promise.all([
      this.brand(tenantId),
      this.publicSettings(tenantId),
      this.settings.getSettings(tenantId),
    ]);
    const policy = mergeCirculationPolicy(stored.circulationPolicy);
    return {
      ...brand,
      settings,
      rules: {
        studentLoanDays: policy.student.loanDays,
        studentMaxBooks: policy.student.maxBooks,
        studentRenewals: policy.student.maxRenewals,
        facultyLoanDays: policy.faculty.loanDays,
        facultyMaxBooks: policy.faculty.maxBooks,
        facultyRenewals: policy.faculty.maxRenewals,
        staffLoanDays: policy.staff.loanDays,
        staffMaxBooks: policy.staff.maxBooks,
        staffRenewals: policy.staff.maxRenewals,
        finePerDay: Number(stored.finePerDay),
        graceDays: stored.graceDays,
        workingDayLoans:
          policy.loanCalendar.excludeWeekends ||
          policy.loanCalendar.excludeHolidays,
        maxFine: Number(stored.maxFine),
        referenceIssue: policy.reference.allowIssue,
        rareIssue: policy.rare.allowIssue,
        reservationDays: settings.reservationDays,
        maxReservations: settings.maxReservations,
      },
    };
  }

  async account(user: JwtUser) {
    const person = await this.person(user);
    await this.expireReservations(user.tid);
    const [loans, reservations, fines, settings] = await Promise.all([
      this.prisma.libraryLoan.findMany({
        where: {
          tenantId: user.tid,
          ...(person.studentId
            ? { studentId: person.studentId }
            : { staffProfileId: person.staffProfileId }),
        },
        include: { copy: { include: { book: true } }, fines: true },
        orderBy: { issuedAt: 'desc' },
        take: 40,
      }),
      this.prisma.libraryReservation.findMany({
        where: {
          tenantId: user.tid,
          status: 'ACTIVE',
          ...(person.studentId
            ? { studentId: person.studentId }
            : { staffProfileId: person.staffProfileId }),
        },
        include: { book: { select: { title: true, author: true } } },
        orderBy: { reservedAt: 'asc' },
      }),
      this.prisma.libraryFine.findMany({
        where: {
          tenantId: user.tid,
          loan: person.studentId
            ? { studentId: person.studentId }
            : { staffProfileId: person.staffProfileId },
        },
        include: { loan: { include: { copy: { include: { book: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.publicSettings(user.tid),
    ]);
    const now = new Date();
    const active = loans.filter(
      (loan) => loan.status === 'ACTIVE' && !loan.returnedAt,
    );
    const positions = await Promise.all(
      reservations.map((row) =>
        this.reservations.queuePositionPublic(user.tid, row.bookId, row.id),
      ),
    );
    await this.event(user.tid, 'LOGIN', user.sub, null, person.memberType);
    return {
      profile: person,
      showFines: settings.showFines,
      renewalEnabled: settings.renewal,
      reservationEnabled: settings.reservation,
      stats: {
        borrowed: active.length,
        overdue: active.filter((loan) => loan.dueAt < now).length,
        dueSoon: active.filter((loan) => {
          const days = (loan.dueAt.getTime() - now.getTime()) / 86_400_000;
          return days >= 0 && days <= 3;
        }).length,
        reservations: reservations.length,
        outstandingFine: settings.showFines
          ? fines
              .filter((fine) => !fine.paidAt && !fine.waivedAt)
              .reduce((sum, fine) => sum + Number(fine.amount), 0)
          : null,
        totalBorrowed: loans.length,
      },
      loans: active.map((loan) => ({
        id: loan.id,
        title: loan.copy.book.title,
        author: loan.copy.book.author,
        accession: loan.copy.accessionNumber || loan.copy.barcode,
        barcode: loan.copy.barcode,
        issuedAt: loan.issuedAt,
        dueAt: loan.dueAt,
        renewalCount: loan.renewalCount,
        overdue: loan.dueAt < now,
      })),
      history: loans
        .filter((loan) => loan.returnedAt)
        .map((loan) => ({
          id: loan.id,
          title: loan.copy.book.title,
          accession: loan.copy.accessionNumber || loan.copy.barcode,
          issuedAt: loan.issuedAt,
          returnedAt: loan.returnedAt,
          renewalCount: loan.renewalCount,
        })),
      reservations: reservations.map((row, index) => ({
        id: row.id,
        title: row.book.title,
        author: row.book.author,
        reservedAt: row.reservedAt,
        queuePosition: positions[index],
        status: row.status,
      })),
      fines: settings.showFines
        ? fines.map((fine) => ({
            id: fine.id,
            title: fine.loan.copy.book.title,
            accession: fine.loan.copy.accessionNumber || fine.loan.copy.barcode,
            amount: Number(fine.amount),
            status: fine.waivedAt ? 'WAIVED' : fine.paidAt ? 'PAID' : 'UNPAID',
            reason: fine.reason,
            createdAt: fine.createdAt,
          }))
        : [],
      announcements: settings.announcements,
    };
  }

  async reserve(user: JwtUser, bookId: string) {
    const settings = await this.requireOpac(user.tid);
    if (!settings.reservation) {
      throw new BadRequestException('Online reservation is turned off.');
    }
    const person = await this.person(user);
    this.assertLoginAllowed(settings, person.memberType);
    if (person.status === 'BLOCKED') {
      throw new BadRequestException('This library account is blocked.');
    }
    const active = await this.prisma.libraryReservation.count({
      where: {
        tenantId: user.tid,
        status: 'ACTIVE',
        ...(person.studentId
          ? { studentId: person.studentId }
          : { staffProfileId: person.staffProfileId }),
      },
    });
    if (active >= settings.maxReservations) {
      throw new BadRequestException(
        `You already have ${active} active reservations. The limit is ${settings.maxReservations}.`,
      );
    }
    const created = await this.reservations.reserve(user, { bookId });
    await this.event(user.tid, 'RESERVE', user.sub, bookId, null);
    return created;
  }

  async cancelReservation(user: JwtUser, reservationId: string) {
    const person = await this.person(user);
    const row = await this.prisma.libraryReservation.findFirst({
      where: {
        tenantId: user.tid,
        id: reservationId,
        status: 'ACTIVE',
        ...(person.studentId
          ? { studentId: person.studentId }
          : { staffProfileId: person.staffProfileId }),
      },
    });
    if (!row) throw new NotFoundException('Reservation not found');
    return this.reservations.cancel(user, reservationId);
  }

  async renew(user: JwtUser, barcode: string) {
    const settings = await this.requireOpac(user.tid);
    if (!settings.renewal)
      throw new BadRequestException('Online renewal is turned off.');
    const person = await this.person(user);
    this.assertLoginAllowed(settings, person.memberType);
    if (person.status === 'BLOCKED') {
      throw new BadRequestException('This library account is blocked.');
    }
    const copy = await this.prisma.libraryBookCopy.findFirst({
      where: {
        tenantId: user.tid,
        OR: [{ barcode }, { accessionNumber: barcode }],
      },
      include: { book: true },
    });
    if (!copy) throw new NotFoundException('Book copy not found');
    const loan = await this.prisma.libraryLoan.findFirst({
      where: {
        tenantId: user.tid,
        copyId: copy.id,
        status: 'ACTIVE',
        ...(person.studentId
          ? { studentId: person.studentId }
          : { staffProfileId: person.staffProfileId }),
      },
    });
    if (!loan) {
      throw new BadRequestException('This copy is not on your account.');
    }
    const waiting = await this.prisma.libraryReservation.findFirst({
      where: {
        tenantId: user.tid,
        bookId: copy.bookId,
        status: 'ACTIVE',
        NOT: person.studentId
          ? { studentId: person.studentId }
          : { staffProfileId: person.staffProfileId },
      },
    });
    if (waiting) {
      throw new BadRequestException(
        'Another member is waiting for this title, so it cannot be renewed online.',
      );
    }
    const renewed = await this.circulation.renewLoan(user, copy.barcode);
    await this.event(user.tid, 'RENEW', user.sub, copy.bookId, null);
    return renewed;
  }

  async departments(tenantId: string) {
    return this.prisma.$queryRaw<
      { id: string; name: string; titles: number }[]
    >`
      SELECT d.id, d.department_name AS name, COUNT(b.id)::int AS titles
      FROM core.departments d
      JOIN library.library_books b
        ON b.department_id = d.id
       AND b.tenant_id = d.tenant_id
       AND b.deleted_at IS NULL
      WHERE d.tenant_id = CAST(${tenantId} AS uuid)
        AND d.deleted_at IS NULL
      GROUP BY d.id, d.department_name
      ORDER BY d.department_name ASC
    `;
  }

  async digital(tenantId: string, q?: string) {
    const settings = await this.publicSettings(tenantId);
    if (!settings.digital) return [];
    return this.prisma.libraryDigitalAsset.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { author: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        title: true,
        author: true,
        assetType: true,
        externalUrl: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 40,
    });
  }

  async usage(tenantId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const [events, searches, views] = await Promise.all([
      this.prisma.libraryOpacEvent.groupBy({
        by: ['kind'],
        where: { tenantId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.libraryOpacEvent.groupBy({
        by: ['query'],
        where: {
          tenantId,
          kind: 'SEARCH',
          createdAt: { gte: since },
          query: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { query: 'desc' } },
        take: 8,
      }),
      this.prisma.libraryOpacEvent.groupBy({
        by: ['bookId'],
        where: {
          tenantId,
          kind: 'VIEW',
          createdAt: { gte: since },
          bookId: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { bookId: 'desc' } },
        take: 8,
      }),
    ]);
    const books = await this.prisma.libraryBook.findMany({
      where: {
        id: {
          in: views
            .map((row) => row.bookId)
            .filter((id): id is string => Boolean(id)),
        },
      },
      select: { id: true, title: true },
    });
    const titles = new Map(books.map((book) => [book.id, book.title]));
    return {
      since: since.toISOString(),
      counts: Object.fromEntries(
        events.map((row) => [row.kind, row._count._all]),
      ),
      searches: searches.map((row) => ({
        query: row.query,
        count: row._count._all,
      })),
      views: views.map((row) => ({
        title: titles.get(row.bookId ?? '') ?? 'Book',
        count: row._count._all,
      })),
    };
  }

  async getAdminSettings(tenantId: string) {
    await this.settings.ensureTenantDefaults(tenantId);
    const row = await this.prisma.librarySettings.findUniqueOrThrow({
      where: { tenantId },
      select: { opacSettings: true },
    });
    return this.mergeSettings(row.opacSettings);
  }

  async saveAdminSettings(tenantId: string, dto: UpdateOpacSettingsDto) {
    const current = await this.getAdminSettings(tenantId);
    const next = { ...current, ...dto };
    await this.prisma.librarySettings.update({
      where: { tenantId },
      data: { opacSettings: next as unknown as Prisma.InputJsonValue },
    });
    return next;
  }

  private async cards(tenantId: string) {
    const [titles, copies, categories, counts] = await Promise.all([
      this.prisma.libraryBook.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.libraryBookCopy.count({
        where: { tenantId, book: { deletedAt: null } },
      }),
      this.prisma.libraryCategory.count({ where: { tenantId, active: true } }),
      this.prisma.$queryRaw<[{ authors: number; departments: number }]>`
        SELECT
          COUNT(DISTINCT NULLIF(b.author, ''))::int AS authors,
          COUNT(DISTINCT b.department_id)::int AS departments
        FROM library.library_books b
        WHERE b.tenant_id = CAST(${tenantId} AS uuid) AND b.deleted_at IS NULL
      `,
    ]);
    return {
      copies,
      titles,
      authors: Number(counts[0]?.authors ?? 0),
      categories,
      departments: Number(counts[0]?.departments ?? 0),
    };
  }

  private async recentBooks(tenantId: string) {
    const rows = await this.prisma.libraryBook.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true },
    });
    return this.cardsFor(
      tenantId,
      rows.map((row) => row.id),
    );
  }

  private async mostBorrowed(tenantId: string) {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT c.book_id AS id
      FROM library.library_loans l
      JOIN library.library_book_copies c ON c.id = l.copy_id
      JOIN library.library_books b ON b.id = c.book_id AND b.deleted_at IS NULL
      WHERE l.tenant_id = CAST(${tenantId} AS uuid)
      GROUP BY c.book_id
      ORDER BY COUNT(*) DESC
      LIMIT 8
    `;
    return this.cardsFor(
      tenantId,
      rows.map((row) => row.id),
    );
  }

  private async cardsFor(tenantId: string, ids: string[]) {
    if (!ids.length) return [];
    const policy = await this.policy(tenantId);
    const books = await this.prisma.libraryBook.findMany({
      where: { tenantId, id: { in: ids }, deletedAt: null },
      include: {
        category: true,
        copies: {
          include: {
            loans: {
              where: { status: 'ACTIVE', returnedAt: null },
              select: { id: true },
            },
          },
        },
      },
    });
    const order = new Map(ids.map((id, index) => [id, index]));
    return books
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((book) => {
        const tones = book.copies.map((copy) => {
          const decision = resolveCopyIssue({
            copyType: copy.copyType,
            issueAllowed: copy.issueAllowed,
            categoryCode: book.category?.code,
            copyIssue: policy.copyIssue,
            referenceAllow: policy.reference.allowIssue,
            rareAllow: policy.rare.allowIssue,
          });
          return opacCopyAvailability({
            status: copy.status,
            onLoan: copy.loans.length > 0,
            issueAllowed: decision.allowed,
            copyType: decision.copyType ?? copy.copyType,
          }).tone;
        });
        const pages = pageCountFromDescription(book.description);
        const callNumber =
          book.copies.find((copy) => copy.callNumber)?.callNumber ||
          book.classificationNumber;
        const available = tones.filter((tone) => tone === 'available').length;
        const borrowed = tones.filter((tone) => tone === 'borrowed').length;
        const reference = tones.filter((tone) => tone === 'reference').length;
        return {
          id: book.id,
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          publisher: book.publisher,
          publicationYear: book.publicationYear,
          bookType: book.bookType,
          subject: book.subject,
          language: book.language,
          pages,
          callNumber,
          coverImageUrl: book.coverImageUrl,
          total: book.copies.length,
          available,
          borrowed,
          reference,
          availability:
            available > 0
              ? 'available'
              : borrowed > 0
                ? 'issued'
                : reference > 0
                  ? 'reference'
                  : 'unavailable',
        };
      });
  }

  private async person(user: JwtUser) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: {
        id: true,
        rollNumber: true,
        enrollmentNumber: true,
        libraryCardNumber: true,
        department: { select: { name: true } },
        masterProfile: {
          select: { fullName: true, photoPath: true, studentStatus: true },
        },
      },
    });
    if (student) {
      const membership = await this.prisma.libraryMembership.findFirst({
        where: { tenantId: user.tid, studentId: student.id },
        select: { status: true },
      });
      return {
        memberType: 'Student' as const,
        studentId: student.id,
        staffProfileId: null as string | null,
        name: student.masterProfile?.fullName || 'Student',
        code: student.rollNumber || student.enrollmentNumber,
        card: student.libraryCardNumber,
        department: student.department?.name ?? null,
        photoUrl: student.masterProfile?.photoPath ?? null,
        status:
          membership?.status ||
          student.masterProfile?.studentStatus ||
          'ACTIVE',
      };
    }
    const staff = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        staffType: true,
        status: true,
        photoUrl: true,
        department: { select: { name: true } },
      },
    });
    if (!staff) {
      throw new BadRequestException(
        'This login is not linked to a student or staff library account.',
      );
    }
    const membership = await this.prisma.libraryMembership.findFirst({
      where: { tenantId: user.tid, staffProfileId: staff.id },
      select: { status: true },
    });
    return {
      memberType:
        staff.staffType === 'TEACHING'
          ? ('Faculty' as const)
          : ('Staff' as const),
      studentId: null as string | null,
      staffProfileId: staff.id,
      name: staff.fullName,
      code: staff.employeeCode,
      card: null,
      department: staff.department?.name ?? null,
      photoUrl: staff.photoUrl,
      status: membership?.status || staff.status,
    };
  }

  private assertLoginAllowed(settings: OpacSettings, memberType: string) {
    if (memberType === 'Student' && !settings.studentLogin) {
      throw new BadRequestException('Student library login is turned off.');
    }
    if (memberType !== 'Student' && !settings.staffLogin) {
      throw new BadRequestException('Staff library login is turned off.');
    }
  }

  private async requireOpac(tenantId: string) {
    const settings = await this.publicSettings(tenantId);
    if (!settings.enabled)
      throw new BadRequestException('The OPAC is turned off.');
    return settings;
  }

  private async expireReservations(tenantId: string) {
    const settings = await this.publicSettings(tenantId);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - settings.reservationDays);
    await this.prisma.libraryReservation.updateMany({
      where: { tenantId, status: 'ACTIVE', reservedAt: { lt: cutoff } },
      data: { status: 'EXPIRED', cancelledAt: new Date() },
    });
  }

  private async policy(tenantId: string) {
    const stored = await this.settings.getSettings(tenantId);
    return mergeCirculationPolicy(stored.circulationPolicy);
  }

  private async publicSettings(tenantId: string): Promise<OpacSettings> {
    await this.settings.ensureTenantDefaults(tenantId);
    const row = await this.prisma.librarySettings.findUnique({
      where: { tenantId },
      select: { opacSettings: true },
    });
    return this.mergeSettings(row?.opacSettings);
  }

  private mergeSettings(raw: unknown): OpacSettings {
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_OPAC };
    const source = raw as Partial<OpacSettings>;
    return {
      ...DEFAULT_OPAC,
      ...source,
      hours: Array.isArray(source.hours)
        ? source.hours.filter((row) => row?.label && row?.hours)
        : [],
      announcements: Array.isArray(source.announcements)
        ? source.announcements.filter((row) => row?.text).slice(0, 20)
        : [],
      maxReservations: clamp(
        source.maxReservations,
        1,
        10,
        DEFAULT_OPAC.maxReservations,
      ),
      reservationDays: clamp(
        source.reservationDays,
        1,
        30,
        DEFAULT_OPAC.reservationDays,
      ),
    };
  }

  private async brand(tenantId: string) {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: {
        displayName: true,
        campusName: true,
        address: true,
        logoUrl: true,
      },
    });
    return {
      collegeName: branding?.displayName || 'College library',
      campus: branding?.campusName || null,
      address: branding?.address || null,
      logoUrl: branding?.logoUrl || null,
    };
  }

  private async departmentNames(tenantId: string, ids: Array<string | null>) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return new Map<string, string>();
    const rows = await this.prisma.department.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  private async event(
    tenantId: string,
    kind: string,
    actorId?: string | null,
    bookId?: string | null,
    query?: string | null,
  ) {
    await this.prisma.libraryOpacEvent
      .create({
        data: {
          tenantId,
          kind,
          actorId: actorId || null,
          bookId: bookId || null,
          query: query || null,
        },
      })
      .catch(() => undefined);
  }
}

function pageCountFromDescription(description: string | null | undefined) {
  const match = description?.trim().match(/^(\d+)\s+pages$/i);
  return match ? Number(match[1]) : null;
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}
