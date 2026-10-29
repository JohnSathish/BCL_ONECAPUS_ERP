import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { mergeFinePolicy } from '../domain/library-policy.types';
import type {
  CopyIncidentListQueryDto,
  ReplaceByBarcodeDto,
  ReplaceCopyIncidentDto,
  ReportCopyIncidentDto,
} from '../dto/library.dto';
import { LibraryCatalogueService } from './library-catalogue.service';
import { LibraryQrService } from './library-qr.service';
import { LibrarySettingsService } from './library-settings.service';

@Injectable()
export class LibraryCopyIncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogue: LibraryCatalogueService,
    private readonly qr: LibraryQrService,
    private readonly settings: LibrarySettingsService,
  ) {}

  private resolveBarcode(raw: string) {
    return this.qr.resolveScanCode(raw).code;
  }

  async summary(tenantId: string) {
    const [counts, reporterRows] = await Promise.all([
      this.prisma.$queryRaw<
        {
          total: number;
          lost: number;
          damaged: number;
          replaced: number;
          resolved: number;
          closed: number;
        }[]
      >`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE incident_type = 'LOST' AND status = 'OPEN')::int AS lost,
          COUNT(*) FILTER (WHERE incident_type = 'DAMAGED' AND status = 'OPEN')::int AS damaged,
          COUNT(*) FILTER (WHERE incident_type = 'REPLACED')::int AS replaced,
          COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved,
          COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS closed
        FROM library.library_copy_incidents
        WHERE tenant_id = CAST(${tenantId} AS uuid)
      `,
      this.prisma.libraryCopyIncident.findMany({
        where: { tenantId, reportedById: { not: null } },
        distinct: ['reportedById'],
        select: { reportedById: true },
        take: 100,
      }),
    ]);
    const row = counts[0];
    const ids = reporterRows
      .map((item) => item.reportedById)
      .filter((id): id is string => Boolean(id));
    const names = await this.reporterNames(tenantId, ids);
    return {
      total: Number(row?.total ?? 0),
      lost: Number(row?.lost ?? 0),
      damaged: Number(row?.damaged ?? 0),
      replaced: Number(row?.replaced ?? 0),
      resolved: Number(row?.resolved ?? 0),
      closed: Number(row?.closed ?? 0),
      reporters: ids.map((id) => ({ id, name: names.get(id) ?? 'Staff' })),
    };
  }

  async list(tenantId: string, query: CopyIncidentListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = await this.listWhere(tenantId, query);
    const orderBy =
      query.sort === 'oldest'
        ? { createdAt: 'asc' as const }
        : query.sort === 'title'
          ? { copy: { book: { title: 'asc' as const } } }
          : { createdAt: 'desc' as const };
    const [rows, total] = await Promise.all([
      this.prisma.libraryCopyIncident.findMany({
        where,
        include: {
          copy: {
            include: {
              book: {
                select: { title: true, author: true, accessionNo: true },
              },
            },
          },
          replacementCopy: {
            select: { id: true, barcode: true, accessionNumber: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.libraryCopyIncident.count({ where }),
    ]);
    const items = await this.enrichIncidents(tenantId, rows);
    return {
      items,
      total,
      page,
      limit,
      from: total ? skip + 1 : 0,
      to: Math.min(skip + items.length, total),
    };
  }

  async previewCopy(tenantId: string, code: string) {
    const barcode = this.resolveBarcode(code);
    const copy = await this.catalogue.findCopyByBarcode(tenantId, barcode);
    const open = await this.prisma.libraryCopyIncident.findFirst({
      where: { tenantId, copyId: copy.id, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, incidentType: true, chargeAmount: true },
    });
    return {
      copyId: copy.id,
      title: copy.book.title,
      author: copy.book.author,
      accessionNo: copy.accessionNumber || copy.book.accessionNo,
      barcode: copy.barcode,
      status: copy.status,
      openIncidentId: open?.id ?? null,
      openIncidentType: open?.incidentType ?? null,
      chargeAmount: open?.chargeAmount ? Number(open.chargeAmount) : null,
    };
  }

  async replaceByBarcode(user: JwtUser, dto: ReplaceByBarcodeDto) {
    const preview = await this.previewCopy(user.tid, dto.copyBarcode);
    if (!preview.openIncidentId) {
      throw new NotFoundException('No open incident for this copy');
    }
    return this.replaceCopy(user, preview.openIncidentId, {
      notes: dto.notes,
      replacementBarcode: dto.replacementBarcode,
    });
  }

  async listIncidents(
    tenantId: string,
    filters?: { status?: string; incidentType?: string },
  ) {
    const rows = await this.prisma.libraryCopyIncident.findMany({
      where: {
        tenantId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.incidentType
          ? { incidentType: filters.incidentType }
          : {}),
      },
      include: {
        copy: {
          include: { book: { select: { title: true, accessionNo: true } } },
        },
        replacementCopy: { select: { id: true, barcode: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({
      ...r,
      chargeAmount: r.chargeAmount ? Number(r.chargeAmount) : null,
    }));
  }

  async reportIncident(user: JwtUser, dto: ReportCopyIncidentDto) {
    const type = dto.incidentType.toUpperCase();
    if (!['LOST', 'DAMAGED'].includes(type)) {
      throw new BadRequestException('incidentType must be LOST or DAMAGED');
    }

    const barcode = this.resolveBarcode(dto.copyBarcode);
    const copy = await this.catalogue.findCopyByBarcode(user.tid, barcode);
    const libSettings = await this.settings.getSettings(user.tid);
    const finePolicy = mergeFinePolicy(libSettings.finePolicy);

    const activeLoan = await this.prisma.libraryLoan.findFirst({
      where: { tenantId: user.tid, copyId: copy.id, status: 'ACTIVE' },
    });

    let charge =
      dto.chargeAmount ??
      (type === 'DAMAGED'
        ? finePolicy.damageChargeDefault
        : copy.book.price
          ? Number(copy.book.price) * finePolicy.lostBookPenaltyMultiplier
          : finePolicy.damageChargeDefault * 2);

    if (charge < 0) charge = 0;

    const result = await this.prisma.$transaction(async (tx) => {
      const incident = await tx.libraryCopyIncident.create({
        data: {
          id: randomUUID(),
          tenantId: user.tid,
          copyId: copy.id,
          loanId: activeLoan?.id ?? null,
          incidentType: type,
          status: 'OPEN',
          notes: dto.notes?.trim(),
          chargeAmount: charge,
          reportedById: user.sub,
        },
        include: {
          copy: { include: { book: true } },
        },
      });

      await tx.libraryBookCopy.update({
        where: { id: copy.id },
        data: { status: type === 'LOST' ? 'LOST' : 'DAMAGED' },
      });

      if (activeLoan) {
        await tx.libraryLoan.update({
          where: { id: activeLoan.id },
          data: {
            status: 'RETURNED',
            returnedAt: new Date(),
            returnedById: user.sub,
          },
        });
      }

      if (charge > 0 && activeLoan) {
        await tx.libraryFine.create({
          data: {
            id: randomUUID(),
            tenantId: user.tid,
            loanId: activeLoan.id,
            amount: charge,
            reason: type === 'LOST' ? 'Lost book penalty' : 'Damage charge',
          },
        });
      }

      await tx.libraryAuditLog.create({
        data: {
          id: randomUUID(),
          tenantId: user.tid,
          actorId: user.sub,
          action: type,
          entityType: 'COPY',
          entityId: copy.id,
          metadata: {
            bookTitle: copy.book.title,
            charge,
          },
        },
      });

      return incident;
    });

    return {
      ...result,
      chargeAmount: result.chargeAmount ? Number(result.chargeAmount) : null,
    };
  }

  async replaceCopy(
    user: JwtUser,
    incidentId: string,
    dto: ReplaceCopyIncidentDto,
  ) {
    const incident = await this.prisma.libraryCopyIncident.findFirst({
      where: { tenantId: user.tid, id: incidentId, status: 'OPEN' },
      include: { copy: { include: { book: true } } },
    });
    if (!incident) throw new NotFoundException('Open incident not found');

    let replacementCopyId = dto.replacementCopyId;

    if (dto.replacementBarcode) {
      const barcode = this.resolveBarcode(dto.replacementBarcode);
      const existing = await this.catalogue.findCopyByBarcode(
        user.tid,
        barcode,
      );
      replacementCopyId = existing.id;
    } else if (!replacementCopyId) {
      const book = incident.copy.book;
      const copyNumber = book.totalCopies + 1;
      const newBarcode = `${book.accessionNo}-R${copyNumber}`;
      const created = await this.prisma.libraryBookCopy.create({
        data: {
          id: randomUUID(),
          tenantId: user.tid,
          bookId: book.id,
          copyNumber,
          barcode: newBarcode,
          status: 'AVAILABLE',
        },
      });
      await this.prisma.libraryBook.update({
        where: { id: book.id },
        data: { totalCopies: { increment: 1 } },
      });
      replacementCopyId = created.id;
    }

    const updated = await this.prisma.libraryCopyIncident.update({
      where: { id: incidentId },
      data: {
        status: 'RESOLVED',
        incidentType: 'REPLACED',
        replacementCopyId,
        resolvedAt: new Date(),
        notes: dto.notes
          ? `${incident.notes ?? ''}\nReplacement: ${dto.notes}`.trim()
          : incident.notes,
      },
      include: {
        copy: {
          include: { book: { select: { title: true, accessionNo: true } } },
        },
        replacementCopy: true,
      },
    });

    return {
      ...updated,
      chargeAmount: updated.chargeAmount ? Number(updated.chargeAmount) : null,
    };
  }

  async resolveIncident(user: JwtUser, incidentId: string, notes?: string) {
    const incident = await this.prisma.libraryCopyIncident.findFirst({
      where: { tenantId: user.tid, id: incidentId, status: 'OPEN' },
    });
    if (!incident) throw new NotFoundException('Open incident not found');

    return this.prisma.libraryCopyIncident.update({
      where: { id: incidentId },
      data: {
        status: 'CLOSED',
        resolvedAt: new Date(),
        notes: notes
          ? `${incident.notes ?? ''}\n${notes}`.trim()
          : incident.notes,
      },
      include: {
        copy: {
          include: { book: { select: { title: true, accessionNo: true } } },
        },
      },
    });
  }

  private async listWhere(tenantId: string, query: CopyIncidentListQueryDto) {
    const where: Prisma.LibraryCopyIncidentWhereInput = { tenantId };
    if (query.bucket === 'LOST') {
      where.incidentType = 'LOST';
      if (!query.status) where.status = 'OPEN';
    } else if (query.bucket === 'DAMAGED') {
      where.incidentType = 'DAMAGED';
      if (!query.status) where.status = 'OPEN';
    } else if (query.bucket === 'REPLACED') where.incidentType = 'REPLACED';
    else if (query.bucket === 'RESOLVED') where.status = 'RESOLVED';
    else if (query.bucket === 'CLOSED') where.status = 'CLOSED';
    if (query.incidentType) where.incidentType = query.incidentType;
    if (query.status) where.status = query.status;
    if (query.reportedById) where.reportedById = query.reportedById;

    const from = query.from ? startOfDay(query.from) : null;
    const to = query.to ? startOfDay(query.to) : null;
    if (from || to) {
      const createdAt: Prisma.DateTimeFilter = {};
      const start = from && to && from > to ? to : from;
      const endDay = from && to && from > to ? from : to;
      if (start) createdAt.gte = start;
      if (endDay) {
        const next = new Date(endDay);
        next.setDate(next.getDate() + 1);
        createdAt.lt = next;
      }
      where.createdAt = createdAt;
    }

    const search = query.search?.trim();
    if (!search) return where;

    const [students, staff, users] = await Promise.all([
      this.prisma.student.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { enrollmentNumber: { contains: search, mode: 'insensitive' } },
            {
              masterProfile: {
                fullName: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        },
        select: { id: true },
        take: 200,
      }),
      this.prisma.staffProfile.findMany({
        where: {
          tenantId,
          deletedAt: null,
          fullName: { contains: search, mode: 'insensitive' },
        },
        select: { id: true },
        take: 200,
      }),
      this.prisma.user.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { displayName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            {
              staffProfile: {
                fullName: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        },
        select: { id: true },
        take: 100,
      }),
    ]);
    const studentIds = students.map((row) => row.id);
    const staffIds = staff.map((row) => row.id);
    const loans =
      studentIds.length || staffIds.length
        ? await this.prisma.libraryLoan.findMany({
            where: {
              tenantId,
              OR: [
                ...(studentIds.length
                  ? [{ studentId: { in: studentIds } }]
                  : []),
                ...(staffIds.length
                  ? [{ staffProfileId: { in: staffIds } }]
                  : []),
              ],
            },
            select: { id: true },
            take: 500,
          })
        : [];
    const loanIds = loans.map((row) => row.id);
    const reporterIds = users.map((row) => row.id);
    where.AND = [
      {
        OR: [
          {
            copy: {
              book: { title: { contains: search, mode: 'insensitive' } },
            },
          },
          {
            copy: {
              book: { author: { contains: search, mode: 'insensitive' } },
            },
          },
          {
            copy: {
              book: { accessionNo: { contains: search, mode: 'insensitive' } },
            },
          },
          { copy: { barcode: { contains: search, mode: 'insensitive' } } },
          {
            copy: {
              accessionNumber: { contains: search, mode: 'insensitive' },
            },
          },
          ...(loanIds.length ? [{ loanId: { in: loanIds } }] : []),
          ...(reporterIds.length
            ? [{ reportedById: { in: reporterIds } }]
            : []),
        ],
      },
    ];
    return where;
  }

  private async enrichIncidents<
    T extends {
      id: string;
      loanId: string | null;
      reportedById: string | null;
      chargeAmount: Prisma.Decimal | null;
      copy: {
        barcode: string;
        accessionNumber: string | null;
        book: { title: string; author: string | null; accessionNo: string };
      };
    },
  >(tenantId: string, rows: T[]) {
    if (!rows.length) return [];
    const loanIds = rows
      .map((row) => row.loanId)
      .filter((id): id is string => Boolean(id));
    const reporterIds = rows
      .map((row) => row.reportedById)
      .filter((id): id is string => Boolean(id));
    const [loans, reporters] = await Promise.all([
      loanIds.length
        ? this.prisma.libraryLoan.findMany({
            where: { tenantId, id: { in: loanIds } },
            select: {
              id: true,
              studentId: true,
              staffProfileId: true,
              memberType: true,
            },
          })
        : [],
      this.reporterNames(tenantId, reporterIds),
    ]);
    const studentIds = loans
      .map((loan) => loan.studentId)
      .filter((id): id is string => Boolean(id));
    const staffIds = loans
      .map((loan) => loan.staffProfileId)
      .filter((id): id is string => Boolean(id));
    const [students, staff] = await Promise.all([
      studentIds.length
        ? this.prisma.student.findMany({
            where: { tenantId, id: { in: studentIds } },
            select: { id: true, masterProfile: { select: { fullName: true } } },
          })
        : [],
      staffIds.length
        ? this.prisma.staffProfile.findMany({
            where: { tenantId, id: { in: staffIds } },
            select: { id: true, fullName: true },
          })
        : [],
    ]);
    const loanMap = new Map(loans.map((loan) => [loan.id, loan]));
    const studentMap = new Map(
      students.map((student) => [
        student.id,
        student.masterProfile?.fullName ?? 'Student',
      ]),
    );
    const staffMap = new Map(staff.map((row) => [row.id, row.fullName]));
    return rows.map((row) => {
      const loan = row.loanId ? loanMap.get(row.loanId) : undefined;
      const memberName = loan?.studentId
        ? (studentMap.get(loan.studentId) ?? null)
        : loan?.staffProfileId
          ? (staffMap.get(loan.staffProfileId) ?? null)
          : null;
      return {
        ...row,
        chargeAmount: row.chargeAmount ? Number(row.chargeAmount) : null,
        title: row.copy.book.title,
        author: row.copy.book.author,
        accessionNo: row.copy.accessionNumber || row.copy.book.accessionNo,
        reportedByName: row.reportedById
          ? (reporters.get(row.reportedById) ?? 'Staff')
          : null,
        memberName,
        memberType: loan?.memberType ?? null,
      };
    });
  }

  private async reporterNames(tenantId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map<string, string>();
    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: unique } },
      select: {
        id: true,
        displayName: true,
        email: true,
        staffProfile: { select: { fullName: true } },
      },
    });
    return new Map(
      users.map((user) => [
        user.id,
        user.staffProfile?.fullName || user.displayName || user.email,
      ]),
    );
  }
}

function startOfDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}
