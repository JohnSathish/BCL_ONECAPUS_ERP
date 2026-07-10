import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateVendorDto,
  ListQueryDto,
  UpdateVendorDto,
} from '../dto/accounting.dto';

@Injectable()
export class VendorService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      isActive: true,
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                code: { contains: query.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.accountingVendor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.accountingVendor.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async create(tenantId: string, dto: CreateVendorDto) {
    const existing = await this.prisma.accountingVendor.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Vendor ${dto.code} already exists`);
    }

    return this.prisma.accountingVendor.create({
      data: { tenantId, ...dto },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateVendorDto) {
    const vendor = await this.prisma.accountingVendor.findFirst({
      where: { tenantId, id },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    return this.prisma.accountingVendor.update({
      where: { id },
      data: dto,
    });
  }
}
