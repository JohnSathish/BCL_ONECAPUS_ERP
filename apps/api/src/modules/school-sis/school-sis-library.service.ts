import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisEventBus } from './school-sis-event-bus.service';
import { SchoolSisAccountsPostingService } from './school-sis-accounts.posting.service';
import { SchoolReportEngineService } from './report-engine/report-engine.service';
import {
  DEFAULT_CIRC_RULES,
  LIB_BOOK_TYPES,
  LIB_CATEGORIES,
} from './school-sis-library.catalog';
import {
  canRenew,
  dueDate,
  fineAmount,
  overdueDays,
  pickRule,
  validateIssue,
} from './school-sis-library.rules';
import { money } from './school-sis-accounts.money';

@Injectable()
export class SchoolSisLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly events: SchoolSisEventBus,
    private readonly accounts: SchoolSisAccountsPostingService,
    private readonly reports: SchoolReportEngineService,
  ) {}

  async ensure(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.prisma.schoolLibSettings.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
    const rules = await this.prisma.schoolLibCirculationRule.count({
      where: { tenantId },
    });
    if (!rules) {
      await this.prisma.schoolLibCirculationRule.createMany({
        data: DEFAULT_CIRC_RULES.map((r) => ({
          tenantId,
          memberKind: r.memberKind,
          gradePattern: r.gradePattern,
          maxBooks: r.maxBooks,
          loanDays: r.loanDays,
          maxRenewals: r.maxRenewals,
          finePerDay: money(r.finePerDay),
          graceDays: r.graceDays,
        })),
      });
    }
    const cats = await this.prisma.schoolLibCategory.count({
      where: { tenantId },
    });
    if (!cats) {
      await this.prisma.schoolLibCategory.createMany({
        data: LIB_CATEGORIES.map((name, i) => ({
          tenantId,
          name,
          sortOrder: i,
        })),
      });
    }
    const loc = await this.prisma.schoolLibLocation.count({
      where: { tenantId },
    });
    if (!loc) {
      await this.prisma.schoolLibLocation.create({
        data: {
          tenantId,
          building: 'Library',
          floor: 'Ground Floor',
          room: 'Main Library',
          section: 'General',
          rack: 'R01',
          shelf: 'S01',
          label: 'Library / Ground Floor / Main Library / General / R01 / S01',
        },
      });
    }
    return this.prisma.schoolLibSettings.findUniqueOrThrow({
      where: { tenantId },
    });
  }

  async dashboard(tenantId: string) {
    await this.ensure(tenantId);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [
      titles,
      copies,
      available,
      issued,
      overdue,
      reserved,
      lost,
      damaged,
      pendingFines,
      addedMonth,
      recentLoans,
    ] = await Promise.all([
      this.prisma.schoolLibBook.count({ where: { tenantId, active: true } }),
      this.prisma.schoolLibCopy.count({ where: { tenantId } }),
      this.prisma.schoolLibCopy.count({
        where: { tenantId, status: 'AVAILABLE' },
      }),
      this.prisma.schoolLibLoan.count({
        where: { tenantId, status: 'ISSUED' },
      }),
      this.prisma.schoolLibLoan.count({
        where: { tenantId, status: 'ISSUED', dueAt: { lt: new Date() } },
      }),
      this.prisma.schoolLibReservation.count({
        where: { tenantId, status: { in: ['WAITING', 'HOLD'] } },
      }),
      this.prisma.schoolLibCopy.count({ where: { tenantId, status: 'LOST' } }),
      this.prisma.schoolLibCopy.count({
        where: { tenantId, status: 'DAMAGED' },
      }),
      this.prisma.schoolLibFine.aggregate({
        where: { tenantId, status: 'PENDING' },
        _sum: { amount: true },
      }),
      this.prisma.schoolLibBook.count({
        where: { tenantId, createdAt: { gte: monthStart } },
      }),
      this.prisma.schoolLibLoan.findMany({
        where: { tenantId },
        orderBy: { issuedAt: 'desc' },
        take: 12,
        include: {
          copy: { include: { book: true } },
          member: { include: { student: true, staff: true } },
        },
      }),
    ]);
    const issuedRows = await this.prisma.schoolLibLoan.findMany({
      where: { tenantId, issuedAt: { gte: addMonths(-11) } },
      select: { issuedAt: true, returnedAt: true, status: true },
    });
    const monthly = bucketMonths(issuedRows);
    return {
      kpis: {
        titles,
        copies,
        available,
        issued,
        overdue,
        reserved,
        lost,
        damaged,
        pendingFines: Number(pendingFines._sum.amount ?? 0).toFixed(2),
        addedMonth,
      },
      monthly,
      recent: recentLoans,
      bookTypes: LIB_BOOK_TYPES,
    };
  }

  async saveSettings(tenantId: string, body: Record<string, unknown>) {
    await this.ensure(tenantId);
    return this.prisma.schoolLibSettings.update({
      where: { tenantId },
      data: {
        libraryName: str(body.libraryName),
        libraryCode: str(body.libraryCode),
        email: str(body.email) || null,
        phone: str(body.phone) || null,
        barcodePrefix: str(body.barcodePrefix) || 'STL-LIB-',
        accessionPrefix: str(body.accessionPrefix) || 'ACC',
        qrEnabled: body.qrEnabled !== false,
        graceDays: num(body.graceDays, 0),
        maxFine: money(num(body.maxFine, 0)),
        lostPenalty: money(num(body.lostPenalty, 0)),
        damagePenalty: money(num(body.damagePenalty, 0)),
        reservationHoldDays: num(body.reservationHoldDays, 2),
        skipWeekends: !!body.skipWeekends,
        skipHolidays: !!body.skipHolidays,
        blockOnOverdue: body.blockOnOverdue !== false,
        blockOnUnpaidFine: body.blockOnUnpaidFine !== false,
        requireClearance: body.requireClearance !== false,
      },
    });
  }

  async rules(tenantId: string) {
    await this.ensure(tenantId);
    return this.prisma.schoolLibCirculationRule.findMany({
      where: { tenantId },
      orderBy: { memberKind: 'asc' },
    });
  }

  async saveRule(tenantId: string, body: Record<string, unknown>, id?: string) {
    await this.ensure(tenantId);
    const data = {
      memberKind: str(body.memberKind) || 'STUDENT',
      gradePattern: str(body.gradePattern) || null,
      maxBooks: num(body.maxBooks, 2),
      loanDays: num(body.loanDays, 14),
      maxRenewals: num(body.maxRenewals, 1),
      finePerDay: money(num(body.finePerDay, 2)),
      graceDays: num(body.graceDays, 0),
      active: body.active !== false,
    };
    if (id) {
      return this.prisma.schoolLibCirculationRule.update({
        where: { id },
        data,
      });
    }
    return this.prisma.schoolLibCirculationRule.create({
      data: { tenantId, ...data },
    });
  }

  async masters(tenantId: string) {
    await this.ensure(tenantId);
    const [categories, authors, publishers, subjects, locations, vendors] =
      await Promise.all([
        this.prisma.schoolLibCategory.findMany({
          where: { tenantId },
          orderBy: { name: 'asc' },
        }),
        this.prisma.schoolLibAuthor.findMany({
          where: { tenantId },
          orderBy: { name: 'asc' },
        }),
        this.prisma.schoolLibPublisher.findMany({
          where: { tenantId },
          orderBy: { name: 'asc' },
        }),
        this.prisma.schoolLibSubject.findMany({
          where: { tenantId },
          orderBy: { name: 'asc' },
        }),
        this.prisma.schoolLibLocation.findMany({
          where: { tenantId },
          orderBy: { label: 'asc' },
        }),
        this.prisma.schoolLibVendor.findMany({
          where: { tenantId },
          orderBy: { name: 'asc' },
        }),
      ]);
    return {
      categories,
      authors,
      publishers,
      subjects,
      locations,
      vendors,
      bookTypes: LIB_BOOK_TYPES,
    };
  }

  async saveMaster(
    tenantId: string,
    kind: string,
    body: Record<string, unknown>,
  ) {
    await this.ensure(tenantId);
    if (kind === 'category') {
      return this.prisma.schoolLibCategory.create({
        data: { tenantId, name: str(body.name) },
      });
    }
    if (kind === 'author') {
      return this.prisma.schoolLibAuthor.create({
        data: {
          tenantId,
          name: str(body.name),
          biography: str(body.biography) || null,
        },
      });
    }
    if (kind === 'publisher') {
      return this.prisma.schoolLibPublisher.create({
        data: {
          tenantId,
          name: str(body.name),
          gstin: str(body.gstin) || null,
        },
      });
    }
    if (kind === 'subject') {
      return this.prisma.schoolLibSubject.create({
        data: { tenantId, name: str(body.name) },
      });
    }
    if (kind === 'location') {
      const label = [
        body.building,
        body.floor,
        body.room,
        body.section,
        body.rack,
        body.shelf,
      ]
        .filter(Boolean)
        .join(' / ');
      return this.prisma.schoolLibLocation.create({
        data: {
          tenantId,
          building: str(body.building) || 'Library',
          floor: str(body.floor) || null,
          room: str(body.room) || null,
          section: str(body.section) || null,
          rack: str(body.rack) || null,
          shelf: str(body.shelf) || null,
          label: label || str(body.label) || 'Library',
        },
      });
    }
    if (kind === 'vendor') {
      return this.prisma.schoolLibVendor.create({
        data: {
          tenantId,
          name: str(body.name),
          contact: str(body.contact) || null,
          phone: str(body.phone) || null,
          email: str(body.email) || null,
          gstin: str(body.gstin) || null,
          address: str(body.address) || null,
        },
      });
    }
    throw new BadRequestException('Unknown master');
  }

  async books(tenantId: string, q: { search?: string; available?: string }) {
    await this.ensure(tenantId);
    return this.prisma.schoolLibBook.findMany({
      where: {
        tenantId,
        OR: q.search
          ? [
              { title: { contains: q.search, mode: 'insensitive' } },
              { isbn: { contains: q.search, mode: 'insensitive' } },
              { keywords: { contains: q.search, mode: 'insensitive' } },
              { author: { name: { contains: q.search, mode: 'insensitive' } } },
            ]
          : undefined,
      },
      include: {
        author: true,
        category: true,
        publisher: true,
        subject: true,
        copies: true,
        _count: { select: { copies: true, reservations: true } },
      },
      orderBy: { title: 'asc' },
      take: 200,
    });
  }

  async getBook(tenantId: string, id: string) {
    const book = await this.prisma.schoolLibBook.findFirst({
      where: { id, tenantId },
      include: {
        author: true,
        category: true,
        publisher: true,
        subject: true,
        copies: {
          include: {
            location: true,
            loans: { take: 5, orderBy: { issuedAt: 'desc' } },
          },
        },
        reservations: {
          where: { status: { in: ['WAITING', 'HOLD'] } },
          include: { member: { include: { student: true, staff: true } } },
          orderBy: { queueNo: 'asc' },
        },
      },
    });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  async saveBook(tenantId: string, body: Record<string, unknown>, id?: string) {
    await this.ensure(tenantId);
    const data = {
      title: str(body.title),
      subtitle: str(body.subtitle) || null,
      isbn: str(body.isbn) || null,
      language: str(body.language) || 'English',
      bookType: str(body.bookType) || 'Other',
      edition: str(body.edition) || null,
      publicationYear: body.publicationYear ? num(body.publicationYear) : null,
      pages: body.pages ? num(body.pages) : null,
      description: str(body.description) || null,
      price: money(num(body.price, 0)),
      categoryId: str(body.categoryId) || null,
      authorId: str(body.authorId) || null,
      coAuthor: str(body.coAuthor) || null,
      publisherId: str(body.publisherId) || null,
      subjectId: str(body.subjectId) || null,
      keywords: str(body.keywords) || null,
    };
    if (!data.title) throw new BadRequestException('Title is required');
    if (id) {
      return this.prisma.schoolLibBook.update({ where: { id }, data });
    }
    return this.prisma.schoolLibBook.create({ data: { tenantId, ...data } });
  }

  async addCopies(
    tenantId: string,
    bookId: string,
    qty: number,
    locationId?: string,
  ) {
    await this.ensure(tenantId);
    const settings = await this.prisma.schoolLibSettings.findUniqueOrThrow({
      where: { tenantId },
    });
    const book = await this.getBook(tenantId, bookId);
    const existing = await this.prisma.schoolLibCopy.count({
      where: { tenantId },
    });
    const created = [];
    for (let i = 1; i <= Math.min(100, Math.max(1, qty)); i++) {
      const n = existing + i;
      const copyCode = `${settings.libraryCode}-${String(n).padStart(6, '0')}`;
      const accessionNo = `${settings.accessionPrefix}-${String(n).padStart(6, '0')}`;
      const barcode = `${settings.barcodePrefix}${String(n).padStart(6, '0')}`;
      created.push(
        await this.prisma.schoolLibCopy.create({
          data: {
            tenantId,
            bookId: book.id,
            copyCode,
            accessionNo,
            barcode,
            locationId: locationId || null,
            purchasePrice: book.price,
          },
        }),
      );
    }
    return created;
  }

  async syncMembers(tenantId: string) {
    await this.ensure(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const students = await this.prisma.schoolStudent.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, admissionNumber: true },
    });
    const staff = await this.prisma.schoolStaff.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, employeeCode: true, staffType: true },
    });
    let added = 0;
    for (const s of students) {
      const exists = await this.prisma.schoolLibMember.findFirst({
        where: { tenantId, studentId: s.id },
      });
      if (exists) continue;
      await this.prisma.schoolLibMember.create({
        data: {
          tenantId,
          studentId: s.id,
          memberKind: 'STUDENT',
          libraryCode: `STU-${s.admissionNumber}`,
          validUntil: year.endDate,
        },
      });
      added += 1;
    }
    for (const st of staff) {
      const exists = await this.prisma.schoolLibMember.findFirst({
        where: { tenantId, staffId: st.id },
      });
      if (exists) continue;
      await this.prisma.schoolLibMember.create({
        data: {
          tenantId,
          staffId: st.id,
          memberKind: st.staffType === 'TEACHING' ? 'TEACHING' : 'NON_TEACHING',
          libraryCode: `STF-${st.employeeCode}`,
        },
      });
      added += 1;
    }
    return { added };
  }

  async members(tenantId: string, kind?: string, search?: string) {
    await this.ensure(tenantId);
    return this.prisma.schoolLibMember.findMany({
      where: {
        tenantId,
        memberKind: kind || undefined,
        OR: search
          ? [
              { libraryCode: { contains: search, mode: 'insensitive' } },
              {
                student: {
                  fullName: { contains: search, mode: 'insensitive' },
                },
              },
              {
                student: {
                  admissionNumber: { contains: search, mode: 'insensitive' },
                },
              },
              {
                staff: { fullName: { contains: search, mode: 'insensitive' } },
              },
            ]
          : undefined,
      },
      include: {
        student: {
          include: {
            enrollments: {
              where: { deletedAt: null, status: 'ACTIVE' },
              take: 1,
              include: { section: { include: { grade: true } } },
            },
          },
        },
        staff: true,
        _count: {
          select: {
            loans: { where: { status: 'ISSUED' } },
            fines: { where: { status: 'PENDING' } },
          },
        },
      },
      take: 200,
      orderBy: { createdAt: 'desc' },
    });
  }

  async lookupMember(tenantId: string, q: string) {
    const term = q.trim();
    const row = await this.prisma.schoolLibMember.findFirst({
      where: {
        tenantId,
        OR: [
          { libraryCode: { equals: term, mode: 'insensitive' } },
          {
            student: { admissionNumber: { equals: term, mode: 'insensitive' } },
          },
          { staff: { employeeCode: { equals: term, mode: 'insensitive' } } },
        ],
      },
      include: {
        student: true,
        staff: true,
        loans: {
          where: { status: 'ISSUED' },
          include: { copy: { include: { book: true } } },
        },
        fines: { where: { status: 'PENDING' } },
      },
    });
    if (!row) throw new NotFoundException('Member not found');
    return row;
  }

  async lookupCopy(tenantId: string, q: string) {
    const term = q.trim();
    const copy = await this.prisma.schoolLibCopy.findFirst({
      where: {
        tenantId,
        OR: [
          { barcode: { equals: term, mode: 'insensitive' } },
          { accessionNo: { equals: term, mode: 'insensitive' } },
          { copyCode: { equals: term, mode: 'insensitive' } },
        ],
      },
      include: {
        book: { include: { author: true, category: true } },
        location: true,
        loans: {
          where: { status: 'ISSUED' },
          include: { member: { include: { student: true, staff: true } } },
        },
      },
    });
    if (!copy) throw new NotFoundException('Copy not found');
    return copy;
  }

  async issue(
    tenantId: string,
    dto: { memberQuery: string; copyQuery: string },
    actorUserId: string,
    ip?: string,
  ) {
    const settings = await this.ensure(tenantId);
    return this.prisma
      .$transaction(async (tx) => {
        const member = await this.memberIn(tx, tenantId, dto.memberQuery);
        const copy = await this.copyIn(tx, tenantId, dto.copyQuery);
        const gradeCode = await this.gradeCode(tx, tenantId, member.studentId);
        const rules = await tx.schoolLibCirculationRule.findMany({
          where: { tenantId, active: true },
        });
        const rule = pickRule(rules, member.memberKind, gradeCode);
        if (!rule)
          throw new BadRequestException('No circulation rule configured');
        const [activeLoans, overdueCount, unpaid] = await Promise.all([
          tx.schoolLibLoan.count({
            where: { tenantId, memberId: member.id, status: 'ISSUED' },
          }),
          tx.schoolLibLoan.count({
            where: {
              tenantId,
              memberId: member.id,
              status: 'ISSUED',
              dueAt: { lt: new Date() },
            },
          }),
          tx.schoolLibFine.count({
            where: { tenantId, memberId: member.id, status: 'PENDING' },
          }),
        ]);
        const hold = await tx.schoolLibReservation.findFirst({
          where: {
            tenantId,
            bookId: copy.bookId,
            status: { in: ['WAITING', 'HOLD'] },
          },
          orderBy: { queueNo: 'asc' },
        });
        const reservedForOther = !!(hold && hold.memberId !== member.id);
        const check = validateIssue({
          memberStatus: member.status,
          validUntil: member.validUntil,
          activeLoans,
          maxBooks: rule.maxBooks,
          overdueCount,
          unpaidFines: unpaid,
          blockOnOverdue: settings.blockOnOverdue,
          blockOnUnpaidFine: settings.blockOnUnpaidFine,
          copyStatus: copy.status,
          reservedForOther,
        });
        if (!check.ok) throw new BadRequestException(check.reason);
        const claimed = await tx.schoolLibCopy.updateMany({
          where: {
            id: copy.id,
            tenantId,
            status: { in: ['AVAILABLE', 'RESERVED'] },
            rowVersion: copy.rowVersion,
          },
          data: { status: 'ISSUED', rowVersion: { increment: 1 } },
        });
        if (claimed.count !== 1) {
          throw new ConflictException(
            'This copy was just issued by another librarian.',
          );
        }
        const loan = await tx.schoolLibLoan.create({
          data: {
            tenantId,
            memberId: member.id,
            copyId: copy.id,
            dueAt: dueDate(new Date(), rule.loanDays),
            issuedBy: actorUserId,
          },
          include: { copy: { include: { book: true } }, member: true },
        });
        if (hold && hold.memberId === member.id) {
          await tx.schoolLibReservation.update({
            where: { id: hold.id },
            data: { status: 'FULFILLED' },
          });
        }
        await this.auditTx(
          tx,
          tenantId,
          actorUserId,
          'ISSUED',
          'loan',
          loan.id,
          ip,
          {
            copy: copy.barcode,
          },
        );
        return loan;
      })
      .then(async (loan) => {
        await this.events.publish({
          event: 'library.issued',
          tenantId,
          studentId: loan.member.studentId ?? undefined,
          entityType: 'library_loan',
          entityId: loan.id,
          data: { title: loan.copy.book.title, dueAt: loan.dueAt },
        });
        return loan;
      });
  }

  async returnCopy(
    tenantId: string,
    dto: { copyQuery: string; condition?: string; notes?: string },
    actorUserId: string,
    ip?: string,
  ) {
    const settings = await this.ensure(tenantId);
    const loan = await this.prisma.$transaction(async (tx) => {
      const copy = await this.copyIn(tx, tenantId, dto.copyQuery);
      const open = await tx.schoolLibLoan.findFirst({
        where: { tenantId, copyId: copy.id, status: 'ISSUED' },
        include: { member: true, copy: { include: { book: true } } },
      });
      if (!open) throw new BadRequestException('No active loan for this copy.');
      const condition = (dto.condition || 'GOOD').toUpperCase();
      const days = overdueDays(open.dueAt, new Date(), settings.graceDays);
      const gradeCode = await this.gradeCode(
        tx,
        tenantId,
        open.member.studentId,
      );
      const rules = await tx.schoolLibCirculationRule.findMany({
        where: { tenantId, active: true },
      });
      const rule = pickRule(rules, open.member.memberKind, gradeCode);
      const amount = fineAmount(
        days,
        Number(rule?.finePerDay ?? 2),
        Number(settings.maxFine),
      );
      let copyStatus = 'AVAILABLE';
      if (condition === 'LOST') copyStatus = 'LOST';
      else if (condition.includes('DAMAGED')) copyStatus = 'DAMAGED';
      await tx.schoolLibLoan.update({
        where: { id: open.id },
        data: {
          status: 'RETURNED',
          returnedAt: new Date(),
          returnedBy: actorUserId,
          returnCondition: condition,
          returnNotes: dto.notes,
        },
      });
      await tx.schoolLibCopy.update({
        where: { id: copy.id },
        data: { status: copyStatus, condition, rowVersion: { increment: 1 } },
      });
      if (amount > 0) {
        await tx.schoolLibFine.create({
          data: {
            tenantId,
            memberId: open.memberId,
            loanId: open.id,
            kind: 'OVERDUE',
            amount: money(amount),
          },
        });
      }
      if (condition === 'LOST') {
        await tx.schoolLibLost.create({
          data: {
            tenantId,
            copyId: copy.id,
            memberId: open.memberId,
            recovery: money(
              Number(copy.purchasePrice) + Number(settings.lostPenalty),
            ),
          },
        });
      }
      if (copyStatus === 'DAMAGED') {
        await tx.schoolLibDamaged.create({
          data: {
            tenantId,
            copyId: copy.id,
            memberId: open.memberId,
            damageType: condition,
            notes: dto.notes,
            recovery: settings.damagePenalty,
          },
        });
      }
      const next = await tx.schoolLibReservation.findFirst({
        where: { tenantId, bookId: copy.bookId, status: 'WAITING' },
        orderBy: { queueNo: 'asc' },
      });
      if (next && copyStatus === 'AVAILABLE') {
        const holdUntil = new Date();
        holdUntil.setUTCDate(
          holdUntil.getUTCDate() + settings.reservationHoldDays,
        );
        await tx.schoolLibReservation.update({
          where: { id: next.id },
          data: { status: 'HOLD', holdUntil, notifiedAt: new Date() },
        });
        await tx.schoolLibCopy.update({
          where: { id: copy.id },
          data: { status: 'RESERVED' },
        });
      }
      await this.auditTx(
        tx,
        tenantId,
        actorUserId,
        'RETURNED',
        'loan',
        open.id,
        ip,
        {
          fine: amount,
        },
      );
      return { ...open, fine: amount };
    });
    await this.events.publish({
      event: loan.fine > 0 ? 'library.fine' : 'library.returned',
      tenantId,
      studentId: loan.member.studentId ?? undefined,
      entityType: 'library_loan',
      entityId: loan.id,
      data: { fine: loan.fine },
    });
    return loan;
  }

  async renew(tenantId: string, loanId: string, actorUserId: string) {
    const settings = await this.ensure(tenantId);
    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.schoolLibLoan.findFirst({
        where: { id: loanId, tenantId, status: 'ISSUED' },
        include: { member: true, copy: true },
      });
      if (!loan) throw new NotFoundException('Loan not found');
      const hold = await tx.schoolLibReservation.findFirst({
        where: {
          tenantId,
          bookId: loan.copy.bookId,
          status: { in: ['WAITING', 'HOLD'] },
          memberId: { not: loan.memberId },
        },
      });
      const gradeCode = await this.gradeCode(
        tx,
        tenantId,
        loan.member.studentId,
      );
      const rules = await tx.schoolLibCirculationRule.findMany({
        where: { tenantId, active: true },
      });
      const rule = pickRule(rules, loan.member.memberKind, gradeCode);
      const check = canRenew({
        renewals: loan.renewals,
        maxRenewals: rule?.maxRenewals ?? 0,
        reserved: !!hold,
        memberBlocked: loan.member.status === 'BLOCKED',
        overdue: loan.dueAt < new Date(),
      });
      if (!check.ok) throw new BadRequestException(check.reason);
      const nextDue = dueDate(loan.dueAt, rule?.loanDays ?? 14);
      return tx.schoolLibLoan.update({
        where: { id: loan.id },
        data: { dueAt: nextDue, renewals: { increment: 1 } },
      });
    });
  }

  async loans(tenantId: string, status?: string) {
    await this.ensure(tenantId);
    const now = new Date();
    return this.prisma.schoolLibLoan.findMany({
      where: {
        tenantId,
        status: status === 'OVERDUE' ? 'ISSUED' : status || undefined,
        dueAt: status === 'OVERDUE' ? { lt: now } : undefined,
      },
      include: {
        copy: { include: { book: { include: { author: true } } } },
        member: { include: { student: true, staff: true } },
      },
      orderBy: { issuedAt: 'desc' },
      take: 300,
    });
  }

  async reservations(tenantId: string) {
    return this.prisma.schoolLibReservation.findMany({
      where: { tenantId, status: { in: ['WAITING', 'HOLD'] } },
      include: {
        book: true,
        member: { include: { student: true, staff: true } },
      },
      orderBy: [{ bookId: 'asc' }, { queueNo: 'asc' }],
    });
  }

  async reserve(tenantId: string, bookId: string, memberId: string) {
    await this.ensure(tenantId);
    const available = await this.prisma.schoolLibCopy.count({
      where: { tenantId, bookId, status: 'AVAILABLE' },
    });
    if (available > 0) {
      throw new BadRequestException(
        'Copies are available — issue instead of reserving.',
      );
    }
    const last = await this.prisma.schoolLibReservation.findFirst({
      where: { tenantId, bookId },
      orderBy: { queueNo: 'desc' },
    });
    return this.prisma.schoolLibReservation.create({
      data: {
        tenantId,
        bookId,
        memberId,
        queueNo: (last?.queueNo ?? 0) + 1,
      },
    });
  }

  async fines(tenantId: string, status?: string) {
    return this.prisma.schoolLibFine.findMany({
      where: { tenantId, status: status || undefined },
      include: {
        member: { include: { student: true, staff: true } },
        loan: { include: { copy: { include: { book: true } } } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  async payFine(
    tenantId: string,
    fineId: string,
    dto: { amount?: number; mode?: string },
    actorUserId: string,
  ) {
    const fine = await this.prisma.schoolLibFine.findFirst({
      where: { id: fineId, tenantId },
      include: { member: { include: { student: true, staff: true } } },
    });
    if (!fine) throw new NotFoundException('Fine not found');
    if (fine.status !== 'PENDING')
      throw new BadRequestException('Fine is not pending');
    const pay = money(dto.amount ?? Number(fine.amount));
    const year = await this.sis.currentYear(tenantId);
    const seq = await this.prisma.schoolIdSequence.upsert({
      where: {
        tenantId_academicYearId_kind: {
          tenantId,
          academicYearId: year.id,
          kind: 'LIBRARY',
        },
      },
      update: { lastValue: { increment: 1 } },
      create: {
        tenantId,
        academicYearId: year.id,
        kind: 'LIBRARY',
        lastValue: 1,
      },
    });
    const receiptNo = `LIB/${year.code}/${String(seq.lastValue).padStart(4, '0')}`;
    const payment = await this.prisma.schoolLibFinePayment.create({
      data: {
        tenantId,
        fineId,
        amount: pay,
        mode: (dto.mode || 'CASH').toUpperCase(),
        collectedBy: actorUserId,
      },
    });
    const paid = money(fine.paidAmount).add(pay);
    const settled = paid.gte(fine.amount);
    await this.prisma.schoolLibFine.update({
      where: { id: fineId },
      data: {
        paidAmount: paid,
        status: settled ? 'PAID' : 'PENDING',
        receiptNo,
      },
    });
    try {
      const voucher = await this.accounts.postLibraryFine(tenantId, {
        paymentId: payment.id,
        receiptNo,
        amount: Number(pay),
        mode: (dto.mode || 'CASH').toUpperCase(),
        actorUserId,
        payerName:
          fine.member.student?.fullName ??
          fine.member.staff?.fullName ??
          fine.member.libraryCode,
      });
      await this.prisma.schoolLibFine.update({
        where: { id: fineId },
        data: { voucherId: voucher.id },
      });
    } catch {
      /* accounts books may not be seeded yet */
    }
    return { receiptNo, paid: Number(pay).toFixed(2) };
  }

  async waiveFine(
    tenantId: string,
    fineId: string,
    reason: string,
    actorUserId: string,
  ) {
    const fine = await this.prisma.schoolLibFine.findFirst({
      where: { id: fineId, tenantId },
    });
    if (!fine) throw new NotFoundException('Fine not found');
    await this.auditTx(
      this.prisma,
      tenantId,
      actorUserId,
      'FINE_WAIVED',
      'fine',
      fineId,
      undefined,
      { reason },
    );
    return this.prisma.schoolLibFine.update({
      where: { id: fineId },
      data: { status: 'WAIVED', waivedReason: reason },
    });
  }

  async markLost(
    tenantId: string,
    copyId: string,
    actorUserId: string,
    recovery?: number,
  ) {
    const settings = await this.ensure(tenantId);
    const copy = await this.prisma.schoolLibCopy.findFirst({
      where: { id: copyId, tenantId },
    });
    if (!copy) throw new NotFoundException('Copy not found');
    const amount =
      recovery ?? Number(copy.purchasePrice) + Number(settings.lostPenalty);
    await this.prisma.$transaction([
      this.prisma.schoolLibCopy.update({
        where: { id: copyId },
        data: { status: 'LOST' },
      }),
      this.prisma.schoolLibLost.create({
        data: { tenantId, copyId, recovery: money(amount) },
      }),
    ]);
    return { recovery: amount };
  }

  async purchases(tenantId: string) {
    return this.prisma.schoolLibPurchase.findMany({
      where: { tenantId },
      include: { vendor: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async savePurchase(
    tenantId: string,
    body: Record<string, unknown>,
    actorUserId: string,
  ) {
    return this.prisma.schoolLibPurchase.create({
      data: {
        tenantId,
        vendorId: str(body.vendorId) || null,
        kind: str(body.kind) || 'REQUEST',
        title: str(body.title) || 'Purchase request',
        notes: str(body.notes) || null,
        createdBy: actorUserId,
        items: {
          create: ((body.items as Array<Record<string, unknown>>) ?? []).map(
            (i) => ({
              tenantId,
              title: str(i.title),
              qty: num(i.qty, 1),
              unitPrice: money(num(i.unitPrice, 0)),
            }),
          ),
        },
      },
      include: { items: true },
    });
  }

  async receivePurchase(tenantId: string, id: string) {
    const po = await this.prisma.schoolLibPurchase.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!po) throw new NotFoundException('Purchase not found');
    for (const item of po.items) {
      const book = await this.prisma.schoolLibBook.create({
        data: { tenantId, title: item.title, price: item.unitPrice },
      });
      await this.addCopies(tenantId, book.id, item.qty);
    }
    return this.prisma.schoolLibPurchase.update({
      where: { id },
      data: { status: 'RECEIVED' },
    });
  }

  async startStock(tenantId: string, actorUserId: string) {
    const expected = await this.prisma.schoolLibCopy.count({
      where: { tenantId, status: { notIn: ['WITHDRAWN'] } },
    });
    return this.prisma.schoolLibStockCheck.create({
      data: { tenantId, expected, createdBy: actorUserId },
    });
  }

  async scanStock(tenantId: string, checkId: string, barcode: string) {
    const check = await this.prisma.schoolLibStockCheck.findFirst({
      where: { id: checkId, tenantId, status: 'OPEN' },
    });
    if (!check) throw new NotFoundException('Open stock check not found');
    const copy = await this.prisma.schoolLibCopy.findFirst({
      where: {
        tenantId,
        barcode: { equals: barcode.trim(), mode: 'insensitive' },
      },
    });
    try {
      await this.prisma.schoolLibStockItem.create({
        data: {
          tenantId,
          checkId,
          barcode: barcode.trim(),
          copyId: copy?.id ?? null,
          result: copy
            ? copy.status === 'DAMAGED'
              ? 'DAMAGED'
              : 'SCANNED'
            : 'EXTRA',
        },
      });
    } catch {
      throw new ConflictException('Barcode already scanned in this check');
    }
    return { found: !!copy, status: copy?.status };
  }

  async closeStock(tenantId: string, checkId: string) {
    const check = await this.prisma.schoolLibStockCheck.findFirst({
      where: { id: checkId, tenantId },
      include: { items: true },
    });
    if (!check) throw new NotFoundException('Stock check not found');
    const scannedIds = check.items
      .map((i) => i.copyId)
      .filter(Boolean) as string[];
    const missing = await this.prisma.schoolLibCopy.count({
      where: {
        tenantId,
        status: { notIn: ['WITHDRAWN', 'ISSUED'] },
        id: {
          notIn: scannedIds.length
            ? scannedIds
            : ['00000000-0000-0000-0000-000000000000'],
        },
      },
    });
    const extra = check.items.filter((i) => i.result === 'EXTRA').length;
    const damaged = check.items.filter((i) => i.result === 'DAMAGED').length;
    return this.prisma.schoolLibStockCheck.update({
      where: { id: checkId },
      data: {
        status: 'CLOSED',
        scanned: check.items.length,
        missing,
        extra,
        damaged,
        closedAt: new Date(),
      },
    });
  }

  async clearance(tenantId: string, studentId: string) {
    const member = await this.prisma.schoolLibMember.findFirst({
      where: { tenantId, studentId },
    });
    if (!member) {
      return { cleared: true, outstandingLoans: 0, pendingFines: 0 };
    }
    const [loans, fines] = await Promise.all([
      this.prisma.schoolLibLoan.count({
        where: { tenantId, memberId: member.id, status: 'ISSUED' },
      }),
      this.prisma.schoolLibFine.count({
        where: { tenantId, memberId: member.id, status: 'PENDING' },
      }),
    ]);
    return {
      cleared: loans === 0 && fines === 0,
      outstandingLoans: loans,
      pendingFines: fines,
      memberId: member.id,
    };
  }

  async mine(tenantId: string, userId: string, asParentChildId?: string) {
    await this.ensure(tenantId);
    if (asParentChildId) {
      const link = await this.prisma.schoolPersonAccount.findFirst({
        where: { tenantId, userId, studentId: asParentChildId },
      });
      if (!link) {
        const guardian = await this.prisma.schoolStudentGuardian.findFirst({
          where: { studentId: asParentChildId, guardian: { tenantId } },
        });
        if (!guardian)
          throw new ForbiddenException('Not linked to this student');
      }
    }
    const person = await this.prisma.schoolPersonAccount.findFirst({
      where: { tenantId, userId },
    });
    let member = await this.prisma.schoolLibMember.findFirst({
      where: asParentChildId
        ? { tenantId, studentId: asParentChildId }
        : {
            tenantId,
            OR: [
              { userId },
              { studentId: person?.studentId ?? undefined },
              { staffId: person?.staffId ?? undefined },
            ],
          },
      include: {
        student: true,
        staff: true,
        loans: {
          include: { copy: { include: { book: true } } },
          orderBy: { issuedAt: 'desc' },
        },
        fines: true,
        reservations: { include: { book: true } },
      },
    });
    if (!member && person?.studentId) {
      await this.syncMembers(tenantId);
      member = await this.prisma.schoolLibMember.findFirst({
        where: { tenantId, studentId: person.studentId },
        include: {
          student: true,
          staff: true,
          loans: { include: { copy: { include: { book: true } } } },
          fines: true,
          reservations: { include: { book: true } },
        },
      });
    }
    return member;
  }

  async audit(tenantId: string) {
    return this.prisma.schoolLibAudit.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async librarianActivity(tenantId: string) {
    const rows = await this.prisma.schoolLibLoan.groupBy({
      by: ['issuedBy'],
      where: { tenantId },
      _count: true,
    });
    return rows;
  }

  async exportReport(
    tenantId: string,
    key: string,
    format: 'pdf' | 'xlsx' | 'csv' | 'html',
  ) {
    await this.ensure(tenantId);
    const year = await this.sis.currentYear(tenantId);
    let title = 'Library Report';
    let columns: { key: string; label: string }[] = [];
    let rows: Record<string, unknown>[] = [];
    if (key === 'inventory') {
      const copies = await this.prisma.schoolLibCopy.findMany({
        where: { tenantId },
        include: { book: true },
      });
      title = 'Book Inventory';
      columns = [
        { key: 'barcode', label: 'Barcode' },
        { key: 'title', label: 'Title' },
        { key: 'status', label: 'Status' },
      ];
      rows = copies.map((c) => ({
        barcode: c.barcode,
        title: c.book.title,
        status: c.status,
      }));
    } else if (key === 'overdue') {
      const list = await this.loans(tenantId, 'OVERDUE');
      title = 'Overdue Books';
      columns = [
        { key: 'member', label: 'Member' },
        { key: 'title', label: 'Book' },
        { key: 'dueAt', label: 'Due' },
      ];
      rows = list.map((l) => ({
        member: l.member.student?.fullName ?? l.member.staff?.fullName,
        title: l.copy.book.title,
        dueAt: l.dueAt,
      }));
    } else {
      const list = await this.loans(tenantId, 'ISSUED');
      title = 'Current Loans';
      columns = [
        { key: 'member', label: 'Member' },
        { key: 'title', label: 'Book' },
        { key: 'dueAt', label: 'Due' },
      ];
      rows = list.map((l) => ({
        member: l.member.student?.fullName ?? l.member.staff?.fullName,
        title: l.copy.book.title,
        dueAt: l.dueAt,
      }));
    }
    return this.reports.generate({
      tenantId,
      format,
      document: {
        key: `library-${key}`,
        title,
        academicYear: year.name,
        columns,
        rows,
        official: true,
      },
    });
  }

  async labelsPdf(tenantId: string, copyIds: string[]) {
    await this.ensure(tenantId);
    const copies = await this.prisma.schoolLibCopy.findMany({
      where: { tenantId, id: { in: copyIds } },
      include: { book: true },
    });
    const year = await this.sis.currentYear(tenantId);
    return this.reports.generate({
      tenantId,
      format: 'pdf',
      document: {
        key: 'library-labels',
        title: 'Barcode labels',
        academicYear: year.name,
        columns: [
          { key: 'barcode', label: 'Barcode' },
          { key: 'title', label: 'Title' },
          { key: 'accessionNo', label: 'Accession' },
        ],
        rows: copies.map((c) => ({
          barcode: c.barcode,
          title: c.book.title,
          accessionNo: c.accessionNo,
        })),
      },
    });
  }

  private async memberIn(
    tx: Prisma.TransactionClient,
    tenantId: string,
    q: string,
  ) {
    const term = q.trim();
    const row = await tx.schoolLibMember.findFirst({
      where: {
        tenantId,
        OR: [
          { libraryCode: { equals: term, mode: 'insensitive' } },
          {
            student: { admissionNumber: { equals: term, mode: 'insensitive' } },
          },
          { staff: { employeeCode: { equals: term, mode: 'insensitive' } } },
        ],
      },
    });
    if (!row) throw new NotFoundException('Member not found');
    return row;
  }

  private async copyIn(
    tx: Prisma.TransactionClient,
    tenantId: string,
    q: string,
  ) {
    const term = q.trim();
    const copy = await tx.schoolLibCopy.findFirst({
      where: {
        tenantId,
        OR: [
          { barcode: { equals: term, mode: 'insensitive' } },
          { accessionNo: { equals: term, mode: 'insensitive' } },
          { copyCode: { equals: term, mode: 'insensitive' } },
        ],
      },
    });
    if (!copy) throw new NotFoundException('Copy not found');
    return copy;
  }

  private async gradeCode(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId?: string | null,
  ) {
    if (!studentId) return null;
    const enr = await tx.schoolEnrollment.findFirst({
      where: { tenantId, studentId, deletedAt: null, status: 'ACTIVE' },
      include: { section: { include: { grade: true } } },
    });
    return enr?.section.grade.code ?? null;
  }

  private auditTx(
    db: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    actorId: string,
    action: string,
    entityType: string,
    entityId?: string,
    ip?: string,
    after?: Record<string, unknown>,
  ) {
    return db.schoolLibAudit.create({
      data: {
        tenantId,
        actorId,
        action,
        entityType,
        entityId,
        ip,
        afterJson: (after ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}

function str(v: unknown) {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}
function num(v: unknown, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function addMonths(n: number) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + n);
  return d;
}
function bucketMonths(
  rows: Array<{ issuedAt: Date; returnedAt: Date | null }>,
) {
  const map = new Map<string, { issued: number; returned: number }>();
  for (const r of rows) {
    const ik = r.issuedAt.toISOString().slice(0, 7);
    const cur = map.get(ik) ?? { issued: 0, returned: 0 };
    cur.issued += 1;
    map.set(ik, cur);
    if (r.returnedAt) {
      const rk = r.returnedAt.toISOString().slice(0, 7);
      const c2 = map.get(rk) ?? { issued: 0, returned: 0 };
      c2.returned += 1;
      map.set(rk, c2);
    }
  }
  return [...map.entries()].sort().map(([month, v]) => ({ month, ...v }));
}
