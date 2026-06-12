import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type { CreateGatePassDto, ListQueryDto } from '../dto/front-office.dto';
import {
  buildGatePassScanPayload,
  gatePassQrImageUrl,
  generateGatePassCode,
  normalizeGatePassScan,
  nextFrontOfficeNumber,
} from '../utils/front-office-numbers';

@Injectable()
export class FrontOfficeGatePassesService {
  constructor(private readonly prisma: PrismaService) {}

  private async expireStale(tenantId: string) {
    await this.prisma.frontOfficeGatePass.updateMany({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'CHECKED_IN'] },
        validUntil: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
  }

  async list(tenantId: string, query: ListQueryDto) {
    await this.expireStale(tenantId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              {
                visitorName: {
                  contains: query.q,
                  mode: 'insensitive' as const,
                },
              },
              {
                passNumber: { contains: query.q, mode: 'insensitive' as const },
              },
              { mobile: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.frontOfficeGatePass.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.frontOfficeGatePass.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async create(user: JwtUser, dto: CreateGatePassDto) {
    const validUntil = dto.validUntil
      ? new Date(dto.validUntil)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (validUntil <= new Date()) {
      throw new BadRequestException('validUntil must be in the future');
    }

    const refNo = await nextFrontOfficeNumber(
      this.prisma,
      user.tid,
      'FO-GP',
      'gatePass',
    );

    let scanCode = generateGatePassCode();
    for (let i = 0; i < 5; i++) {
      const exists = await this.prisma.frontOfficeGatePass.findFirst({
        where: { tenantId: user.tid, scanCode },
      });
      if (!exists) break;
      scanCode = generateGatePassCode();
    }

    const row = await this.prisma.frontOfficeGatePass.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        passNumber: refNo,
        scanCode,
        visitorName: dto.visitorName.trim(),
        mobile: dto.mobile?.trim(),
        idProofType: dto.idProofType?.trim(),
        idProofNumber: dto.idProofNumber?.trim(),
        hostName: dto.hostName?.trim(),
        hostDepartment: dto.hostDepartment?.trim(),
        hostMobile: dto.hostMobile?.trim(),
        purpose: dto.purpose?.trim(),
        vehicleNo: dto.vehicleNo?.trim(),
        validUntil,
        createdById: user.sub,
        status: 'ACTIVE',
      },
    });

    return this.withLabel(row);
  }

  withLabel(
    row: Awaited<ReturnType<typeof this.prisma.frontOfficeGatePass.create>>,
  ) {
    const scanPayload = buildGatePassScanPayload(row.scanCode);
    return {
      ...row,
      scanPayload,
      qrImageUrl: gatePassQrImageUrl(scanPayload),
    };
  }

  async printLabel(user: JwtUser, id: string) {
    const row = await this.prisma.frontOfficeGatePass.findFirst({
      where: { tenantId: user.tid, id },
    });
    if (!row) throw new NotFoundException('Gate pass not found');
    return this.withLabel(row);
  }

  async lookupByScan(tenantId: string, raw: string) {
    await this.expireStale(tenantId);
    const parsed = normalizeGatePassScan(raw);
    const row = await this.prisma.frontOfficeGatePass.findFirst({
      where: {
        tenantId,
        ...(parsed.field === 'scanCode'
          ? { scanCode: parsed.value }
          : { passNumber: parsed.value }),
      },
    });
    if (!row) throw new NotFoundException('Gate pass not found');
    return this.withLabel(row);
  }

  async lookup(tenantId: string, passNumber: string) {
    return this.lookupByScan(tenantId, passNumber);
  }

  async checkIn(user: JwtUser, id: string) {
    const row = await this.prisma.frontOfficeGatePass.findFirst({
      where: { tenantId: user.tid, id },
    });
    if (!row) throw new NotFoundException('Gate pass not found');
    if (row.status === 'EXPIRED' || row.validUntil < new Date()) {
      throw new BadRequestException('Gate pass has expired');
    }
    if (row.status === 'CHECKED_IN')
      throw new BadRequestException('Visitor already checked in');
    if (row.status === 'CHECKED_OUT' || row.status === 'CANCELLED') {
      throw new BadRequestException(`Pass is ${row.status}`);
    }

    return this.prisma.frontOfficeGatePass.update({
      where: { id },
      data: { status: 'CHECKED_IN', checkInAt: new Date() },
    });
  }

  async checkOut(user: JwtUser, id: string) {
    const row = await this.prisma.frontOfficeGatePass.findFirst({
      where: { tenantId: user.tid, id },
    });
    if (!row) throw new NotFoundException('Gate pass not found');
    if (row.status !== 'CHECKED_IN')
      throw new BadRequestException('Visitor is not checked in');

    return this.prisma.frontOfficeGatePass.update({
      where: { id },
      data: { status: 'CHECKED_OUT', checkOutAt: new Date() },
    });
  }

  async cancel(user: JwtUser, id: string) {
    const row = await this.prisma.frontOfficeGatePass.findFirst({
      where: { tenantId: user.tid, id },
    });
    if (!row) throw new NotFoundException('Gate pass not found');
    if (row.status === 'CHECKED_OUT')
      throw new BadRequestException('Pass already completed');

    return this.prisma.frontOfficeGatePass.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}
