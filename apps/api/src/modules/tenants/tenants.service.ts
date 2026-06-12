import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { paginate, PaginationQueryDto } from '../../common/dto/pagination.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string) {
    return this.prisma.tenant.findFirst({
      where: { slug, deletedAt: null },
      include: { domains: { where: { deletedAt: null } } },
    });
  }

  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                slug: { contains: query.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return paginate(data, total, page, limit);
  }
}
