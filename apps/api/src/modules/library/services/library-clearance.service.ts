import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import QRCode from 'qrcode';
import puppeteer from 'puppeteer';

import { PrismaService } from '../../../database/prisma.service';
import { resolvePublicUploadFsPath } from '../../../common/uploads/upload-paths';
import {
  renderClearanceCardsHtml,
  type ClearanceCardPrintModel,
} from '../domain/library-clearance-card.html';
import {
  assertClearanceDecision,
  collegeHeader,
  deriveLibraryChecks,
  formatCardDate,
  formatCardNumber,
  formatMobile,
  normalizeKey,
  parseCardScan,
  semesterLabel,
  yearCode,
  type ChecklistDecision,
} from '../domain/library-clearance.logic';
import type {
  BulkClearanceDto,
  ClearanceListQueryDto,
  ClearancePreviewQueryDto,
  SaveClearanceDto,
  UpdateClearanceDto,
} from '../dto/library-clearance.dto';

const BULK_LIMIT = 400;

const studentInclude = {
  masterProfile: { select: { fullName: true, mobileNumber: true } },
  department: { select: { id: true, name: true } },
  programVersion: {
    select: { programId: true, program: { select: { name: true } } },
  },
  academicStanding: { select: { currentSemesterSequence: true } },
  academicProfile: {
    select: {
      admissionBatch: { select: { entrySession: { select: { name: true } } } },
    },
  },
  user: { select: { phone: true } },
} satisfies Prisma.StudentInclude;

type StudentRow = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;
type CardRow = Prisma.LibraryClearanceCardGetPayload<{
  include: { events: true };
}>;
type Position = {
  activeLoans: number;
  outstandingDues: number;
  openIncidents: number;
  membershipBlocked: boolean;
};

function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function parseCollegeDate(value?: string | null) {
  if (!value) return null;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new BadRequestException('Use a valid clearance date.');
  }
  return new Date(`${day}T00:00:00.000Z`);
}

function isoDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function money(value: Prisma.Decimal | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function studentSearch(term: string): Prisma.StudentWhereInput {
  return {
    OR: [
      { rollNumber: { contains: term, mode: 'insensitive' } },
      { enrollmentNumber: { contains: term, mode: 'insensitive' } },
      { universityRegistrationNumber: { contains: term, mode: 'insensitive' } },
      {
        masterProfile: {
          is: { fullName: { contains: term, mode: 'insensitive' } },
        },
      },
    ],
  };
}

function semesterWhere(
  semester?: number,
): Prisma.StudentWhereInput | undefined {
  if (!semester) return undefined;
  if (semester === 1) {
    return {
      OR: [
        { academicStanding: { is: { currentSemesterSequence: 1 } } },
        { academicStanding: { is: null } },
      ],
    };
  }
  return { academicStanding: { is: { currentSemesterSequence: semester } } };
}

@Injectable()
export class LibraryClearanceService {
  constructor(private readonly prisma: PrismaService) {}

  async options(tenantId: string, actorId: string) {
    const [
      academicYears,
      departments,
      programmes,
      examinations,
      branding,
      names,
    ] = await Promise.all([
      this.prisma.academicYear.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true, status: true, isPrimarySession: true },
        orderBy: [{ isPrimarySession: 'desc' }, { startDate: 'desc' }],
      }),
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.program.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.libraryClearanceCard.findMany({
        where: { tenantId },
        distinct: ['examinationName'],
        select: { examinationName: true },
        orderBy: { examinationName: 'asc' },
        take: 50,
      }),
      this.prisma.tenantBranding.findUnique({
        where: { tenantId },
        select: { displayName: true },
      }),
      this.actorNames([actorId]),
    ]);
    return {
      academicYears,
      departments,
      programmes,
      examinations: examinations.map((row) => row.examinationName),
      semesters: [1, 2, 3, 4, 5, 6, 7, 8],
      collegeName: branding?.displayName || 'Don Bosco College, Tura',
      librarianName: names.get(actorId) ?? '',
    };
  }

  async searchStudents(tenantId: string, rawQuery: string) {
    const term = parseCardScan(rawQuery).cardNumber;
    if (term.length < 2) return [];
    const students = await this.prisma.student.findMany({
      where: {
        AND: [
          { tenantId, deletedAt: null, accountType: 'NORMAL' },
          studentSearch(term),
        ],
      },
      include: studentInclude,
      orderBy: [{ rollNumber: 'asc' }, { enrollmentNumber: 'asc' }],
      take: 20,
    });
    return students.map((student) => {
      const snap = this.toSnapshot(student);
      return {
        studentId: snap.studentId,
        studentName: snap.studentName,
        rollNumber: snap.rollNumber,
        registrationNumber: snap.registrationNumber,
        programme: snap.programme,
        department: snap.department,
        currentSemester: snap.currentSemester,
        mobileNumber: formatMobile(snap.mobileNumber),
      };
    });
  }

  async preview(
    tenantId: string,
    studentId: string,
    query: ClearancePreviewQueryDto,
  ) {
    const student = await this.loadStudent(tenantId, studentId);
    const snap = this.toSnapshot(student);
    const semester = query.semester || snap.currentSemester;
    const position = (await this.positions(tenantId, [student.id])).get(
      student.id,
    )!;
    const checks = deriveLibraryChecks(position);
    const existing =
      query.academicYear?.trim() && query.examinationName?.trim()
        ? await this.prisma.libraryClearanceCard.findFirst({
            where: {
              tenantId,
              studentId,
              academicYearKey: normalizeKey(query.academicYear),
              examinationKey: normalizeKey(query.examinationName),
              semester,
            },
          })
        : null;
    return {
      student: {
        ...snap,
        mobileNumber: formatMobile(snap.mobileNumber),
        semester,
        semesterLabel: semesterLabel(semester),
      },
      library: { ...position, ...checks },
      existing: existing ? this.toRow(existing) : null,
    };
  }

  async list(tenantId: string, query: ClearanceListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const status = query.status ?? 'ALL';
    const ready = Boolean(
      query.academicYear?.trim() &&
      query.examinationName?.trim() &&
      query.semester,
    );
    const summaryWhere = this.cardWhere(tenantId, query);
    const [cleared, pending, notYetProcessed] = await Promise.all([
      this.prisma.libraryClearanceCard.count({
        where: { ...summaryWhere, status: 'CLEARED' },
      }),
      this.prisma.libraryClearanceCard.count({
        where: { ...summaryWhere, status: 'PENDING' },
      }),
      ready ? this.countUnprocessed(tenantId, query) : Promise.resolve(null),
    ]);
    const skip = (page - 1) * limit;
    type DeskRow =
      | ReturnType<LibraryClearanceService['toRow']>
      | Awaited<ReturnType<LibraryClearanceService['unprocessedRows']>>[number];
    let rows: DeskRow[] = [];
    let total = 0;

    if (status === 'NOT_PROCESSED') {
      total = notYetProcessed ?? 0;
      if (ready)
        rows = await this.unprocessedRows(tenantId, query, skip, limit);
    } else if (status === 'CLEARED' || status === 'PENDING') {
      total = status === 'CLEARED' ? cleared : pending;
      const cards = await this.prisma.libraryClearanceCard.findMany({
        where: { ...summaryWhere, status },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      });
      rows = cards.map((card) => this.toRow(card));
    } else {
      const cardTotal = cleared + pending;
      total = cardTotal + (ready ? (notYetProcessed ?? 0) : 0);
      if (skip < cardTotal) {
        const cards = await this.prisma.libraryClearanceCard.findMany({
          where: summaryWhere,
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
        });
        rows = cards.map((card) => this.toRow(card));
      }
      if (rows.length < limit && ready) {
        rows.push(
          ...(await this.unprocessedRows(
            tenantId,
            query,
            Math.max(0, skip - cardTotal),
            limit - rows.length,
          )),
        );
      }
    }

    return {
      summary: {
        totalStudents: ready
          ? cleared + pending + (notYetProcessed ?? 0)
          : null,
        cleared,
        pending,
        notYetProcessed,
      },
      contextReady: ready,
      page,
      limit,
      total,
      rows,
    };
  }

  async detail(tenantId: string, id: string) {
    return this.present(tenantId, id);
  }

  async history(tenantId: string, studentId: string) {
    await this.loadStudent(tenantId, studentId);
    const cards = await this.prisma.libraryClearanceCard.findMany({
      where: { tenantId, studentId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { cards: cards.map((card) => this.toRow(card)) };
  }

  async create(tenantId: string, actorId: string, dto: SaveClearanceDto) {
    const student = await this.loadStudent(tenantId, dto.studentId);
    const snap = this.toSnapshot(student);
    const decision = this.decision(dto);
    const position = (await this.positions(tenantId, [student.id])).get(
      student.id,
    )!;
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const card = await tx.libraryClearanceCard.create({
          data: {
            ...this.identityData(
              tenantId,
              snap,
              dto.academicYear,
              dto.examinationName,
              dto.semester,
            ),
            cardNumber: await this.nextCardNumber(
              tx,
              tenantId,
              dto.academicYear,
            ),
            verifyToken: randomBytes(16).toString('hex'),
            ...decision,
            ...this.positionData(position),
            createdById: actorId,
            updatedById: actorId,
          },
        });
        await tx.libraryClearanceEvent.create({
          data: {
            tenantId,
            cardId: card.id,
            actorId,
            action: 'CREATED',
            after: this.auditShape(card),
          },
        });
        return card;
      });
      return this.present(tenantId, created.id);
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException(
          'A clearance card already exists for this student, examination and semester.',
        );
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateClearanceDto,
  ) {
    const current = await this.findCard(tenantId, id);
    const decision = this.decision(dto);
    const position = (await this.positions(tenantId, [current.studentId])).get(
      current.studentId,
    )!;
    const before = this.auditShape(current);
    const card = await this.prisma.libraryClearanceCard.update({
      where: { id: current.id },
      data: {
        ...decision,
        ...this.positionData(position),
        updatedById: actorId,
      },
    });
    await this.prisma.libraryClearanceEvent.create({
      data: {
        tenantId,
        cardId: card.id,
        actorId,
        action: 'UPDATED',
        before,
        after: this.auditShape(card),
      },
    });
    return this.present(tenantId, card.id);
  }

  async recheck(tenantId: string, actorId: string, id: string) {
    const current = await this.findCard(tenantId, id);
    const position = (await this.positions(tenantId, [current.studentId])).get(
      current.studentId,
    )!;
    const checks = deriveLibraryChecks(position);
    const status = checks.status === 'PENDING' ? 'PENDING' : current.status;
    const remarks =
      status === 'PENDING'
        ? current.remarks?.trim() ||
          checks.suggestedRemarks ||
          'Clearance is pending.'
        : current.remarks;
    const before = this.auditShape(current);
    const card = await this.prisma.libraryClearanceCard.update({
      where: { id: current.id },
      data: {
        status,
        booksReturned: checks.booksReturned,
        duesStatus: checks.duesStatus,
        lostDamagedStatus: checks.lostDamagedStatus,
        accountStatus: checks.accountStatus,
        remarks,
        clearedOn: status === 'CLEARED' ? current.clearedOn : null,
        ...this.positionData(position),
        updatedById: actorId,
      },
    });
    await this.prisma.libraryClearanceEvent.create({
      data: {
        tenantId,
        cardId: card.id,
        actorId,
        action: 'RECHECKED',
        before,
        after: this.auditShape(card),
        note: 'Verification lines were read again from borrowed books, dues and open incidents.',
      },
    });
    return this.present(tenantId, card.id);
  }

  async regenerate(tenantId: string, actorId: string, id: string) {
    const current = await this.findCard(tenantId, id);
    const snap = this.toSnapshot(
      await this.loadStudent(tenantId, current.studentId),
    );
    const before = this.auditShape(current);
    const card = await this.prisma.libraryClearanceCard.update({
      where: { id: current.id },
      data: {
        studentName: snap.studentName,
        rollNumber: snap.rollNumber,
        registrationNumber: snap.registrationNumber,
        programme: snap.programme,
        department: snap.department,
        departmentId: snap.departmentId,
        programId: snap.programId,
        mobileNumber: snap.mobileNumber,
        academicSession: snap.academicSession,
        updatedById: actorId,
      },
    });
    await this.prisma.libraryClearanceEvent.create({
      data: {
        tenantId,
        cardId: card.id,
        actorId,
        action: 'REGENERATED',
        before,
        after: this.auditShape(card),
        note: 'Student details were refreshed. The card number and clearance decision were kept.',
      },
    });
    return this.present(tenantId, card.id);
  }

  async bulk(tenantId: string, actorId: string, dto: BulkClearanceDto) {
    const academicYear = dto.academicYear.trim();
    const examinationName = dto.examinationName.trim();
    if (!academicYear || !examinationName) {
      throw new BadRequestException(
        'Academic year and examination name are required.',
      );
    }
    let capped = false;
    let missing = 0;
    let students: StudentRow[];
    if (dto.studentIds?.length) {
      students = await this.prisma.student.findMany({
        where: {
          tenantId,
          deletedAt: null,
          accountType: 'NORMAL',
          id: { in: dto.studentIds },
        },
        include: studentInclude,
      });
      missing = dto.studentIds.length - students.length;
    } else {
      const where = await this.unprocessedWhere(tenantId, {
        academicYear,
        examinationName,
        semester: dto.semester,
        departmentId: dto.departmentId,
        programId: dto.programId,
      });
      const found = await this.prisma.student.findMany({
        where,
        include: studentInclude,
        orderBy: [{ rollNumber: 'asc' }, { enrollmentNumber: 'asc' }],
        take: BULK_LIMIT + 1,
      });
      capped = found.length > BULK_LIMIT;
      students = found.slice(0, BULK_LIMIT);
    }
    const existing = students.length
      ? await this.prisma.libraryClearanceCard.findMany({
          where: {
            tenantId,
            academicYearKey: normalizeKey(academicYear),
            examinationKey: normalizeKey(examinationName),
            semester: dto.semester,
            studentId: { in: students.map((student) => student.id) },
          },
          select: { studentId: true },
        })
      : [];
    const have = new Set(existing.map((row) => row.studentId));
    const todo = students.filter((student) => !have.has(student.id));
    const positions = await this.positions(
      tenantId,
      todo.map((student) => student.id),
    );
    const librarian =
      dto.librarianName?.trim() ||
      (await this.actorNames([actorId])).get(actorId) ||
      null;
    let created = 0;
    let cleared = 0;
    let pending = 0;
    let conflicts = 0;
    for (const student of todo) {
      const snap = this.toSnapshot(student);
      const position = positions.get(student.id)!;
      const checks = deriveLibraryChecks(position);
      const status =
        checks.status === 'CLEARED' && librarian ? 'CLEARED' : 'PENDING';
      const remarks =
        status === 'PENDING'
          ? dto.remarks?.trim() ||
            checks.suggestedRemarks ||
            'Clearance is pending.'
          : dto.remarks?.trim() || null;
      try {
        await this.prisma.$transaction(async (tx) => {
          const card = await tx.libraryClearanceCard.create({
            data: {
              ...this.identityData(
                tenantId,
                snap,
                academicYear,
                examinationName,
                dto.semester,
              ),
              cardNumber: await this.nextCardNumber(tx, tenantId, academicYear),
              verifyToken: randomBytes(16).toString('hex'),
              status,
              booksReturned: checks.booksReturned,
              duesStatus: checks.duesStatus,
              lostDamagedStatus: checks.lostDamagedStatus,
              accountStatus: checks.accountStatus,
              remarks,
              librarianName: librarian,
              clearedOn:
                status === 'CLEARED'
                  ? parseCollegeDate(dto.clearedOn || todayIso())
                  : null,
              ...this.positionData(position),
              createdById: actorId,
              updatedById: actorId,
            },
          });
          await tx.libraryClearanceEvent.create({
            data: {
              tenantId,
              cardId: card.id,
              actorId,
              action: 'CREATED',
              after: this.auditShape(card),
              note: 'Created from bulk clearance.',
            },
          });
        });
        created += 1;
        if (status === 'CLEARED') cleared += 1;
        else pending += 1;
      } catch (error) {
        if (isUniqueConflict(error)) conflicts += 1;
        else throw error;
      }
    }
    return {
      created,
      skipped: missing + (students.length - todo.length) + conflicts,
      cleared,
      pending,
      capped,
    };
  }

  async printHtml(
    tenantId: string,
    ids: string[],
    layout: 'single' | 'pair',
    autoPrint: boolean,
  ) {
    return { html: await this.render(tenantId, ids, layout, autoPrint) };
  }

  async printPdf(tenantId: string, ids: string[], layout: 'single' | 'pair') {
    const html = await this.render(tenantId, ids, layout, false);
    const buffer = await this.htmlToPdf(html);
    return {
      buffer,
      filename:
        ids.length === 1
          ? 'library-clearance-card.pdf'
          : 'library-clearance-cards.pdf',
      contentType: 'application/pdf',
    };
  }

  private async render(
    tenantId: string,
    ids: string[],
    layout: 'single' | 'pair',
    autoPrint: boolean,
  ) {
    if (!ids.length)
      throw new BadRequestException('Select at least one clearance card.');
    const cards = await this.prisma.libraryClearanceCard.findMany({
      where: { tenantId, id: { in: ids } },
    });
    if (cards.length !== ids.length) {
      throw new NotFoundException(
        'One or more clearance cards were not found.',
      );
    }
    const byId = new Map(cards.map((card) => [card.id, card]));
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    const header = collegeHeader({
      displayName: branding?.displayName,
      address: branding?.address,
      portalSubtitle: branding?.portalSubtitle,
    });
    const logoDataUri = await this.logoDataUri(branding?.logoUrl ?? null);
    const nehuRolls = await this.nehuRollNumbers(
      tenantId,
      cards.map((card) => card.studentId),
    );
    const models = await Promise.all(
      ids.map(async (id) => {
        const card = byId.get(id)!;
        const qrDataUri = await QRCode.toDataURL(
          `${card.cardNumber}|${card.verifyToken}`,
          {
            margin: 0,
            width: 180,
            errorCorrectionLevel: 'M',
          },
        );
        const model: ClearanceCardPrintModel = {
          collegeName: header.name,
          affiliation: header.affiliation,
          place: header.place,
          logoDataUri,
          cardNumber: card.cardNumber,
          examinationName: card.examinationName,
          academicYear: card.academicYear,
          semesterLabel: card.semesterLabel,
          studentName: card.studentName,
          rollNumber: card.rollNumber ?? '',
          registrationNumber:
            nehuRolls.get(card.studentId) || card.registrationNumber || '',
          programme: card.programme ?? '',
          department: card.department ?? '',
          academicSession: card.academicSession ?? '',
          mobileNumber: formatMobile(card.mobileNumber),
          booksReturned:
            card.booksReturned as ChecklistDecision['booksReturned'],
          duesStatus: card.duesStatus as ChecklistDecision['duesStatus'],
          lostDamagedStatus:
            card.lostDamagedStatus as ChecklistDecision['lostDamagedStatus'],
          accountStatus:
            card.accountStatus as ChecklistDecision['accountStatus'],
          status: card.status as ChecklistDecision['status'],
          remarks: card.remarks ?? '',
          librarianName: card.librarianName ?? '',
          clearedOnLabel: formatCardDate(isoDate(card.clearedOn)),
          qrDataUri,
        };
        return model;
      }),
    );
    return renderClearanceCardsHtml({ layout, autoPrint, cards: models });
  }

  private async htmlToPdf(html: string) {
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
      });
      return Buffer.from(pdf);
    } catch {
      throw new ServiceUnavailableException(
        'The clearance card PDF could not be prepared. Use Print and choose Save as PDF.',
      );
    } finally {
      await browser?.close();
    }
  }

  private decision(dto: UpdateClearanceDto) {
    const message = assertClearanceDecision(dto);
    if (message) throw new BadRequestException(message);
    const librarianName = dto.librarianName?.trim() || null;
    if (dto.status === 'CLEARED' && !librarianName) {
      throw new BadRequestException(
        "Enter the librarian's name before marking the card cleared.",
      );
    }
    return {
      status: dto.status,
      booksReturned: dto.booksReturned,
      duesStatus: dto.duesStatus,
      lostDamagedStatus: dto.lostDamagedStatus,
      accountStatus: dto.accountStatus,
      remarks: dto.remarks?.trim() || null,
      librarianName,
      clearedOn:
        dto.status === 'CLEARED'
          ? parseCollegeDate(dto.clearedOn || todayIso())
          : parseCollegeDate(dto.clearedOn),
    };
  }

  private identityData(
    tenantId: string,
    snap: ReturnType<LibraryClearanceService['toSnapshot']>,
    academicYear: string,
    examinationName: string,
    semester: number,
  ) {
    return {
      tenantId,
      studentId: snap.studentId,
      academicYear: academicYear.trim(),
      academicYearKey: normalizeKey(academicYear),
      examinationName: examinationName.trim(),
      examinationKey: normalizeKey(examinationName),
      semester,
      semesterLabel: semesterLabel(semester),
      studentName: snap.studentName,
      rollNumber: snap.rollNumber,
      registrationNumber: snap.registrationNumber,
      programme: snap.programme,
      department: snap.department,
      departmentId: snap.departmentId,
      programId: snap.programId,
      mobileNumber: snap.mobileNumber,
      academicSession: snap.academicSession,
    };
  }

  private positionData(position: Position) {
    return {
      activeLoans: position.activeLoans,
      outstandingDues: position.outstandingDues,
      openIncidents: position.openIncidents,
      membershipBlocked: position.membershipBlocked,
    };
  }

  private async nextCardNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    academicYear: string,
  ) {
    const code = yearCode(academicYear);
    const row = await tx.libraryClearanceSequence.upsert({
      where: { tenantId_yearCode: { tenantId, yearCode: code } },
      create: { tenantId, yearCode: code, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
    });
    return formatCardNumber(academicYear, row.lastValue);
  }

  private cardWhere(
    tenantId: string,
    query: ClearanceListQueryDto,
  ): Prisma.LibraryClearanceCardWhereInput {
    const term = parseCardScan(query.search ?? '').cardNumber;
    const where: Prisma.LibraryClearanceCardWhereInput = { tenantId };
    if (query.academicYear?.trim())
      where.academicYearKey = normalizeKey(query.academicYear);
    if (query.examinationName?.trim())
      where.examinationKey = normalizeKey(query.examinationName);
    if (query.semester) where.semester = query.semester;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.programId) where.programId = query.programId;
    if (term) {
      where.OR = [
        { studentName: { contains: term, mode: 'insensitive' } },
        { rollNumber: { contains: term, mode: 'insensitive' } },
        { registrationNumber: { contains: term, mode: 'insensitive' } },
        { cardNumber: { contains: term, mode: 'insensitive' } },
        { programme: { contains: term, mode: 'insensitive' } },
        { department: { contains: term, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private async processedIds(tenantId: string, query: ClearanceListQueryDto) {
    if (
      !query.academicYear?.trim() ||
      !query.examinationName?.trim() ||
      !query.semester
    )
      return [];
    const cards = await this.prisma.libraryClearanceCard.findMany({
      where: {
        tenantId,
        academicYearKey: normalizeKey(query.academicYear),
        examinationKey: normalizeKey(query.examinationName),
        semester: query.semester,
      },
      select: { studentId: true },
    });
    return cards.map((card) => card.studentId);
  }

  private async unprocessedWhere(
    tenantId: string,
    query: ClearanceListQueryDto,
  ): Promise<Prisma.StudentWhereInput> {
    const exclude = await this.processedIds(tenantId, query);
    const term = parseCardScan(query.search ?? '').cardNumber;
    const parts: Prisma.StudentWhereInput[] = [
      { tenantId, deletedAt: null, accountType: 'NORMAL' },
    ];
    if (query.departmentId) parts.push({ departmentId: query.departmentId });
    if (query.programId)
      parts.push({ programVersion: { is: { programId: query.programId } } });
    const semester = semesterWhere(query.semester);
    if (semester) parts.push(semester);
    if (term) parts.push(studentSearch(term));
    if (exclude.length) parts.push({ id: { notIn: exclude } });
    return { AND: parts };
  }

  private async countUnprocessed(
    tenantId: string,
    query: ClearanceListQueryDto,
  ) {
    return this.prisma.student.count({
      where: await this.unprocessedWhere(tenantId, query),
    });
  }

  private async unprocessedRows(
    tenantId: string,
    query: ClearanceListQueryDto,
    skip: number,
    take: number,
  ) {
    if (
      !query.academicYear?.trim() ||
      !query.examinationName?.trim() ||
      !query.semester ||
      take < 1
    ) {
      return [];
    }
    const students = await this.prisma.student.findMany({
      where: await this.unprocessedWhere(tenantId, query),
      include: studentInclude,
      orderBy: [{ rollNumber: 'asc' }, { enrollmentNumber: 'asc' }],
      skip,
      take,
    });
    return students.map((student) => {
      const snap = this.toSnapshot(student);
      return {
        kind: 'NOT_PROCESSED' as const,
        id: null,
        studentId: snap.studentId,
        cardNumber: null,
        studentName: snap.studentName,
        rollNumber: snap.rollNumber,
        registrationNumber: snap.registrationNumber,
        programme: snap.programme,
        department: snap.department,
        semester: query.semester!,
        semesterLabel: semesterLabel(query.semester!),
        academicYear: query.academicYear!.trim(),
        examinationName: query.examinationName!.trim(),
        academicSession: snap.academicSession,
        mobileNumber: formatMobile(snap.mobileNumber),
        status: 'NOT_PROCESSED' as const,
        booksReturned: null,
        duesStatus: null,
        lostDamagedStatus: null,
        accountStatus: null,
        remarks: null,
        librarianName: null,
        clearedOn: null,
        activeLoans: null,
        outstandingDues: null,
        openIncidents: null,
        updatedAt: null,
      };
    });
  }

  private async positions(tenantId: string, studentIds: string[]) {
    const map = new Map<string, Position>();
    for (const id of studentIds) {
      map.set(id, {
        activeLoans: 0,
        outstandingDues: 0,
        openIncidents: 0,
        membershipBlocked: false,
      });
    }
    if (!studentIds.length) return map;
    const [loans, fines, memberships] = await Promise.all([
      this.prisma.libraryLoan.findMany({
        where: { tenantId, studentId: { in: studentIds } },
        select: { id: true, studentId: true, status: true },
      }),
      this.prisma.libraryFine.findMany({
        where: {
          tenantId,
          paidAt: null,
          waivedAt: null,
          loan: { studentId: { in: studentIds }, tenantId },
        },
        select: { amount: true, loan: { select: { studentId: true } } },
      }),
      this.prisma.libraryMembership.findMany({
        where: { tenantId, studentId: { in: studentIds } },
        select: { studentId: true, status: true },
      }),
    ]);
    for (const loan of loans) {
      if (loan.status === 'ACTIVE' && loan.studentId)
        map.get(loan.studentId)!.activeLoans += 1;
    }
    for (const fine of fines) {
      const studentId = fine.loan.studentId;
      if (!studentId) continue;
      const row = map.get(studentId);
      if (row)
        row.outstandingDues = money(row.outstandingDues + money(fine.amount));
    }
    const owner = new Map(loans.map((loan) => [loan.id, loan.studentId]));
    if (loans.length) {
      const incidents = await this.prisma.libraryCopyIncident.findMany({
        where: {
          tenantId,
          status: 'OPEN',
          incidentType: { in: ['LOST', 'DAMAGED'] },
          loanId: { in: loans.map((loan) => loan.id) },
        },
        select: { loanId: true },
      });
      for (const incident of incidents) {
        const studentId = incident.loanId ? owner.get(incident.loanId) : null;
        if (studentId) map.get(studentId)!.openIncidents += 1;
      }
    }
    for (const membership of memberships) {
      if (membership.studentId && membership.status === 'BLOCKED') {
        map.get(membership.studentId)!.membershipBlocked = true;
      }
    }
    return map;
  }

  private async loadStudent(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId,
        deletedAt: null,
        accountType: 'NORMAL',
      },
      include: studentInclude,
    });
    if (!student) throw new NotFoundException('Student record not found.');
    return student;
  }

  private toSnapshot(student: StudentRow) {
    return {
      studentId: student.id,
      studentName:
        student.masterProfile?.fullName?.trim() || student.enrollmentNumber,
      rollNumber: student.rollNumber?.trim() || student.enrollmentNumber,
      registrationNumber:
        student.universityRollNumber?.trim() ||
        student.admissionNumber?.trim() ||
        null,
      programme: student.programVersion?.program?.name ?? null,
      department: student.department?.name ?? null,
      departmentId: student.departmentId,
      programId: student.programVersion?.programId ?? null,
      mobileNumber:
        student.masterProfile?.mobileNumber?.trim() ||
        student.user?.phone?.trim() ||
        null,
      academicSession:
        student.academicProfile?.admissionBatch?.entrySession?.name ?? null,
      currentSemester: student.academicStanding?.currentSemesterSequence ?? 1,
    };
  }

  private async findCard(tenantId: string, id: string) {
    const card = await this.prisma.libraryClearanceCard.findFirst({
      where: { id, tenantId },
    });
    if (!card) throw new NotFoundException('Clearance card not found.');
    return card;
  }

  private async present(tenantId: string, id: string) {
    const card = await this.prisma.libraryClearanceCard.findFirst({
      where: { id, tenantId },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 40 } },
    });
    if (!card) throw new NotFoundException('Clearance card not found.');
    const names = await this.actorNames(
      card.events.map((event) => event.actorId),
    );
    return this.toDetail(card, names);
  }

  private toRow(card: {
    id: string;
    studentId: string;
    cardNumber: string;
    studentName: string;
    rollNumber: string | null;
    registrationNumber: string | null;
    programme: string | null;
    department: string | null;
    semester: number;
    semesterLabel: string;
    academicYear: string;
    examinationName: string;
    academicSession: string | null;
    mobileNumber: string | null;
    status: string;
    booksReturned: string;
    duesStatus: string;
    lostDamagedStatus: string;
    accountStatus: string;
    remarks: string | null;
    librarianName: string | null;
    clearedOn: Date | null;
    activeLoans: number;
    outstandingDues: Prisma.Decimal;
    openIncidents: number;
    updatedAt: Date;
  }) {
    return {
      kind: 'CARD' as const,
      id: card.id,
      studentId: card.studentId,
      cardNumber: card.cardNumber,
      studentName: card.studentName,
      rollNumber: card.rollNumber,
      registrationNumber: card.registrationNumber,
      programme: card.programme,
      department: card.department,
      semester: card.semester,
      semesterLabel: card.semesterLabel,
      academicYear: card.academicYear,
      examinationName: card.examinationName,
      academicSession: card.academicSession,
      mobileNumber: formatMobile(card.mobileNumber),
      status: card.status,
      booksReturned: card.booksReturned,
      duesStatus: card.duesStatus,
      lostDamagedStatus: card.lostDamagedStatus,
      accountStatus: card.accountStatus,
      remarks: card.remarks,
      librarianName: card.librarianName,
      clearedOn: isoDate(card.clearedOn),
      activeLoans: card.activeLoans,
      outstandingDues: money(card.outstandingDues),
      openIncidents: card.openIncidents,
      updatedAt: card.updatedAt.toISOString(),
    };
  }

  private toDetail(card: CardRow, names: Map<string, string>) {
    return {
      ...this.toRow(card),
      membershipBlocked: card.membershipBlocked,
      verifyToken: card.verifyToken,
      events: card.events.map((event) => ({
        id: event.id,
        action: event.action,
        note: event.note,
        before: event.before,
        after: event.after,
        actorName: event.actorId
          ? (names.get(event.actorId) ?? 'Staff')
          : 'Staff',
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  private auditShape(card: {
    status: string;
    booksReturned: string;
    duesStatus: string;
    lostDamagedStatus: string;
    accountStatus: string;
    remarks: string | null;
    librarianName: string | null;
    clearedOn: Date | null;
    studentName: string;
    rollNumber: string | null;
    cardNumber: string;
  }) {
    return {
      status: card.status,
      booksReturned: card.booksReturned,
      duesStatus: card.duesStatus,
      lostDamagedStatus: card.lostDamagedStatus,
      accountStatus: card.accountStatus,
      remarks: card.remarks,
      librarianName: card.librarianName,
      clearedOn: isoDate(card.clearedOn),
      studentName: card.studentName,
      rollNumber: card.rollNumber,
      cardNumber: card.cardNumber,
    };
  }

  private async actorNames(ids: Array<string | null | undefined>) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return new Map<string, string>();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, displayName: true, email: true },
    });
    return new Map(
      users.map((user) => [user.id, user.displayName?.trim() || user.email]),
    );
  }

  private async nehuRollNumbers(tenantId: string, studentIds: string[]) {
    const ids = [...new Set(studentIds)];
    if (!ids.length) return new Map<string, string>();
    const students = await this.prisma.student.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, universityRollNumber: true, admissionNumber: true },
    });
    return new Map(
      students.map((student) => [
        student.id,
        student.universityRollNumber?.trim() ||
          student.admissionNumber?.trim() ||
          '',
      ]),
    );
  }

  private async logoDataUri(logoUrl: string | null) {
    const paths = collegeLogoCandidates(logoUrl);
    for (const path of paths) {
      try {
        const buf = await readFile(path);
        return imageDataUri(path, buf);
      } catch {
        // The next candidate may exist when the API is started from another folder.
      }
    }
    const remote = await readRemoteLogo(logoUrl);
    return remote;
  }
}

const LOGO_RELATIVE_PATHS = [
  'apps/web/public/branding/college-logo.png',
  'apps/college-web/public/images/college-logo.png',
  'apps/api/src/modules/library/assets/college-logo.png',
  'src/modules/library/assets/college-logo.png',
  'modules/library/assets/college-logo.png',
];

function collegeLogoCandidates(logoUrl: string | null) {
  const paths: string[] = [join(__dirname, '../assets/college-logo.png')];
  if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
    try {
      paths.push(resolvePublicUploadFsPath(logoUrl));
    } catch {
      // A branding URL that is not an upload path still has the packaged logo.
    }
  }
  for (const root of directoryRoots()) {
    for (const relative of LOGO_RELATIVE_PATHS) {
      paths.push(join(root, relative));
    }
  }
  return [...new Set(paths)];
}

function directoryRoots() {
  const roots: string[] = [];
  for (const start of [process.cwd(), __dirname]) {
    let cursor = start;
    for (let depth = 0; depth < 8; depth += 1) {
      roots.push(cursor);
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
  }
  return roots;
}

function imageDataUri(path: string, buf: Buffer) {
  const mime =
    path.endsWith('.jpg') || path.endsWith('.jpeg')
      ? 'image/jpeg'
      : path.endsWith('.webp')
        ? 'image/webp'
        : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function readRemoteLogo(logoUrl: string | null) {
  const urls = [
    logoUrl && /^https?:\/\//i.test(logoUrl) ? logoUrl : '',
    'https://erp.donboscocollege.ac.in/branding/college-logo.png',
    'https://donboscocollege.ac.in/images/college-logo.png',
  ].filter(Boolean);
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) continue;
      const buf = Buffer.from(await response.arrayBuffer());
      if (buf.length < 8) continue;
      const mime = response.headers.get('content-type') || 'image/png';
      if (!mime.startsWith('image/')) continue;
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      // The packaged file is preferred. A public copy is only a fallback.
    }
  }
  return null;
}
