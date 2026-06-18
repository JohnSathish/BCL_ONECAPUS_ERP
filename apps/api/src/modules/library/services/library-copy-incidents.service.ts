import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { mergeFinePolicy } from '../domain/library-policy.types';
import type {
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
}
