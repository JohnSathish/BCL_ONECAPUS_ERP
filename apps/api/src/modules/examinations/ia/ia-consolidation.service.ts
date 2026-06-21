import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { IaAuditService } from './ia-audit.service';
import { IaSchemeService } from './ia-scheme.service';
import type { IaConsolidationGenerateDto } from './dto/ia.dto';

@Injectable()
export class IaConsolidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: IaAuditService,
    private readonly schemes: IaSchemeService,
  ) {}

  list(tenantId: string) {
    return (this.prisma as any).iaConsolidationSheet.findMany({
      where: { tenantId, deletedAt: null },
      include: { approvals: { orderBy: { sequence: 'asc' } } },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
  }

  async generate(user: JwtUser, dto: IaConsolidationGenerateDto) {
    const marks = await (this.prisma as any).iaComponentMark.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        ...(dto.sessionId ? { sessionId: dto.sessionId } : {}),
      },
      include: { component: true },
    });

    const sheet = await (this.prisma as any).iaConsolidationSheet.create({
      data: {
        tenantId: user.tid,
        name: dto.name.trim(),
        academicYearId: dto.academicYearId,
        departmentId: dto.departmentId,
        semesterNo: dto.semesterNo,
        sessionId: dto.sessionId,
        status: 'DRAFT',
        createdById: user.sub,
      },
    });

    const byStudentOffering = new Map<string, typeof marks>();
    for (const m of marks) {
      const key = `${m.studentId}:${m.schemeId}`;
      if (!byStudentOffering.has(key)) byStudentOffering.set(key, []);
      byStudentOffering.get(key)!.push(m);
    }

    const rows = [];
    for (const [, group] of byStudentOffering) {
      const first = group[0];
      const scheme = await this.schemes.get(user.tid, first.schemeId);
      const totalMarks = group.reduce(
        (s: number, g: { marks?: unknown; isAbsent?: boolean }) =>
          s + (g.isAbsent ? 0 : Number(g.marks ?? 0)),
        0,
      );
      const maxMarks = Number(scheme.totalMaxMarks);
      const percentage = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;
      const passMark = Number(scheme.passMark ?? maxMarks * 0.4);
      const componentJson = Object.fromEntries(
        group.map((g: { component: { code: string }; marks?: unknown }) => [
          g.component.code,
          g.marks != null ? Number(g.marks) : null,
        ]),
      );

      const row = await (this.prisma as any).iaConsolidationRow.create({
        data: {
          tenantId: user.tid,
          sheetId: sheet.id,
          studentId: first.studentId,
          schemeId: first.schemeId,
          offeringId: first.paperId ? undefined : scheme.offeringId,
          totalMarks,
          maxMarks,
          percentage,
          resultStatus: totalMarks >= passMark ? 'PASS' : 'FAIL',
          componentJson,
        },
      });
      rows.push(row);
    }

    await this.audit.log(user, 'IA_SHEET', sheet.id, 'GENERATE', null, {
      rowCount: rows.length,
    });
    return this.get(user.tid, sheet.id);
  }

  async get(tenantId: string, sheetId: string) {
    const sheet = await (this.prisma as any).iaConsolidationSheet.findFirst({
      where: { id: sheetId, tenantId, deletedAt: null },
      include: {
        approvals: { orderBy: { sequence: 'asc' } },
        rows: {
          include: {
            sheet: false,
          },
        },
      },
    });
    if (!sheet) throw new NotFoundException('Consolidation sheet not found');

    const studentIds = sheet.rows.map(
      (r: { studentId: string }) => r.studentId,
    );
    const students = studentIds.length
      ? await this.prisma.student.findMany({
          where: { id: { in: studentIds }, tenantId },
          select: {
            id: true,
            rollNumber: true,
            enrollmentNumber: true,
            user: { select: { displayName: true } },
          },
        })
      : [];

    return {
      ...sheet,
      rows: sheet.rows.map((r: { studentId: string }) => ({
        ...r,
        student: students.find((s) => s.id === r.studentId),
      })),
    };
  }
}
