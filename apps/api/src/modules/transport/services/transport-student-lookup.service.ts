import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class TransportStudentLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async search(tenantId: string, q?: string, limit = 20) {
    const term = q?.trim();
    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(term
          ? {
              OR: [
                { enrollmentNumber: { contains: term, mode: 'insensitive' } },
                { rollNumber: { contains: term, mode: 'insensitive' } },
                {
                  masterProfile: {
                    fullName: { contains: term, mode: 'insensitive' },
                  },
                },
                {
                  masterProfile: {
                    mobileNumber: { contains: term, mode: 'insensitive' },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        masterProfile: { select: { fullName: true, mobileNumber: true } },
      },
      orderBy: { enrollmentNumber: 'asc' },
      take: Math.min(limit, 50),
    });

    return students.map((s) => ({
      id: s.id,
      enrollmentNumber: s.enrollmentNumber,
      fullName: s.masterProfile?.fullName ?? s.enrollmentNumber,
      mobile: s.masterProfile?.mobileNumber ?? null,
    }));
  }
}
