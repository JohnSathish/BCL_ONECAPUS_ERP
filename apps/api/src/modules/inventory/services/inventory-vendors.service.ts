import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateVendorDto,
  ListQueryDto,
  UpdateVendorDto,
} from '../dto/inventory.dto';

@Injectable()
export class InventoryVendorsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, query: ListQueryDto) {
    const q = query.q?.trim();
    return this.prisma.inventoryVendor.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { purchaseOrders: true } } },
      orderBy: { name: 'asc' },
      take: query.limit ?? 50,
    });
  }

  async create(user: JwtUser, dto: CreateVendorDto) {
    const code = dto.code.trim().toUpperCase();
    const exists = await this.prisma.inventoryVendor.findFirst({
      where: { tenantId: user.tid, code },
    });
    if (exists) throw new BadRequestException('Vendor code already exists');

    return this.prisma.inventoryVendor.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        code,
        name: dto.name.trim(),
        contactName: dto.contactName?.trim(),
        mobile: dto.mobile?.trim(),
        email: dto.email?.trim(),
        address: dto.address?.trim(),
        gstin: dto.gstin?.trim(),
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateVendorDto) {
    const row = await this.prisma.inventoryVendor.findFirst({
      where: { tenantId: user.tid, id },
    });
    if (!row) throw new NotFoundException('Vendor not found');

    return this.prisma.inventoryVendor.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        contactName: dto.contactName?.trim(),
        mobile: dto.mobile?.trim(),
        email: dto.email?.trim(),
        address: dto.address?.trim(),
        gstin: dto.gstin?.trim(),
        status: dto.status,
      },
    });
  }
}
