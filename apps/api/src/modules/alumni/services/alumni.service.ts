import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AlumniService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  list(tenantId: string, query: { graduationYear?: number; q?: string } = {}) {
    return this.db().alumniProfile.findMany({
      where: {
        tenantId,
        ...(query.graduationYear
          ? { graduationYear: query.graduationYear }
          : {}),
        ...(query.q?.trim()
          ? {
              OR: [
                { fullName: { contains: query.q.trim(), mode: 'insensitive' } },
                { email: { contains: query.q.trim(), mode: 'insensitive' } },
                {
                  currentOrg: { contains: query.q.trim(), mode: 'insensitive' },
                },
              ],
            }
          : {}),
      },
      orderBy: { fullName: 'asc' },
      take: 200,
    });
  }

  get(tenantId: string, id: string) {
    return this.db().alumniProfile.findFirst({ where: { id, tenantId } });
  }

  create(
    user: JwtUser,
    dto: {
      studentId?: string;
      userId?: string;
      fullName: string;
      graduationYear?: number;
      programme?: string;
      email?: string;
      phone?: string;
      currentOrg?: string;
      currentRole?: string;
      mentorshipOptIn?: boolean;
    },
  ) {
    return this.db().alumniProfile.create({
      data: {
        tenantId: user.tid,
        studentId: dto.studentId,
        userId: dto.userId,
        fullName: dto.fullName.trim(),
        graduationYear: dto.graduationYear,
        programme: dto.programme,
        email: dto.email,
        phone: dto.phone,
        currentOrg: dto.currentOrg,
        currentRole: dto.currentRole,
        mentorshipOptIn: dto.mentorshipOptIn ?? false,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<{
      fullName: string;
      graduationYear: number;
      programme: string;
      email: string;
      phone: string;
      currentOrg: string;
      currentRole: string;
      mentorshipOptIn: boolean;
      status: string;
    }>,
  ) {
    const row = await this.get(tenantId, id);
    if (!row) throw new NotFoundException('Alumni profile not found');
    return this.db().alumniProfile.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
      },
    });
  }
}
