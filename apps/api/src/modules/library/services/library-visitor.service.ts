import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import type { RegisterVisitorDto } from '../dto/library.dto';

@Injectable()
export class LibraryVisitorService {
  constructor(private readonly prisma: PrismaService) {}

  private generatePassNumber() {
    const suffix = Math.floor(100000 + Math.random() * 900000);
    return `VP${suffix}`;
  }

  async register(tenantId: string, dto: RegisterVisitorDto) {
    let passNumber = this.generatePassNumber();
    for (let i = 0; i < 5; i++) {
      const exists = await this.prisma.libraryVisitor.findFirst({
        where: { tenantId, passNumber },
      });
      if (!exists) break;
      passNumber = this.generatePassNumber();
    }

    return this.prisma.libraryVisitor.create({
      data: {
        id: randomUUID(),
        tenantId,
        passNumber,
        fullName: dto.fullName.trim(),
        mobile: dto.mobile?.trim(),
        institution: dto.institution?.trim(),
        purpose: dto.purpose?.trim(),
      },
    });
  }

  async getByPass(tenantId: string, passNumber: string) {
    const row = await this.prisma.libraryVisitor.findFirst({
      where: { tenantId, passNumber },
    });
    if (!row) throw new NotFoundException('Visitor pass not found');
    return row;
  }

  async list(tenantId: string, limit = 50) {
    return this.prisma.libraryVisitor.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
