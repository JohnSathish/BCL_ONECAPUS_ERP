import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { DEFAULT_IA_COMPONENTS } from './ia.constants';
import { IaAuditService } from './ia-audit.service';
import type { IaComponentDto, IaSchemeDto } from './dto/ia.dto';

@Injectable()
export class IaSchemeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: IaAuditService,
  ) {}

  list(tenantId: string, query: { semesterNo?: number; courseId?: string }) {
    return (this.prisma as any).iaAssessmentScheme.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.semesterNo ? { semesterNo: query.semesterNo } : {}),
        ...(query.courseId ? { courseId: query.courseId } : {}),
      },
      include: { components: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await (this.prisma as any).iaAssessmentScheme.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { components: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw new NotFoundException('IA scheme not found');
    return row;
  }

  async create(user: JwtUser, dto: IaSchemeDto) {
    const components = dto.components?.length
      ? dto.components
      : [...DEFAULT_IA_COMPONENTS];
    const total = components.reduce((s, c) => s + Number(c.maxMarks), 0);
    const schemeTotal = dto.totalMaxMarks ?? total;
    if (Math.abs(total - schemeTotal) > 0.01) {
      throw new BadRequestException(
        `Component marks (${total}) must equal scheme total (${schemeTotal})`,
      );
    }

    const row = await (this.prisma as any).iaAssessmentScheme.create({
      data: {
        tenantId: user.tid,
        name: dto.name.trim(),
        academicYearId: dto.academicYearId,
        departmentId: dto.departmentId,
        programmeId: dto.programmeId,
        courseId: dto.courseId,
        offeringId: dto.offeringId,
        semesterNo: dto.semesterNo,
        totalMaxMarks: schemeTotal,
        passMark: dto.passMark,
        createdById: user.sub,
        components: {
          create: components.map((c: IaComponentDto, i: number) => ({
            tenantId: user.tid,
            code: c.code,
            label: c.label,
            maxMarks: c.maxMarks,
            weightage: c.weightage,
            isMandatory: c.isMandatory ?? true,
            sortOrder: c.sortOrder ?? i + 1,
          })),
        },
      },
      include: { components: { orderBy: { sortOrder: 'asc' } } },
    });
    await this.audit.log(user, 'IA_SCHEME', row.id, 'CREATE', null, row);
    return row;
  }

  async updateComponents(
    user: JwtUser,
    id: string,
    components: IaComponentDto[],
  ) {
    const scheme = await this.get(user.tid, id);
    if (scheme.isLocked) {
      throw new BadRequestException(
        'Scheme is locked after mark entry started',
      );
    }
    const total = components.reduce((s, c) => s + Number(c.maxMarks), 0);
    if (Math.abs(total - Number(scheme.totalMaxMarks)) > 0.01) {
      throw new BadRequestException(
        `Component marks (${total}) must equal scheme total (${scheme.totalMaxMarks})`,
      );
    }

    await (this.prisma as any).iaAssessmentComponent.deleteMany({
      where: { schemeId: id, tenantId: user.tid },
    });
    await (this.prisma as any).iaAssessmentComponent.createMany({
      data: components.map((c, i) => ({
        tenantId: user.tid,
        schemeId: id,
        code: c.code,
        label: c.label,
        maxMarks: c.maxMarks,
        weightage: c.weightage,
        isMandatory: c.isMandatory ?? true,
        sortOrder: c.sortOrder ?? i + 1,
      })),
    });
    const updated = await this.get(user.tid, id);
    await this.audit.log(
      user,
      'IA_SCHEME',
      id,
      'UPDATE_COMPONENTS',
      scheme,
      updated,
    );
    return updated;
  }

  async findForOffering(
    tenantId: string,
    offeringId?: string,
    courseId?: string,
  ) {
    if (offeringId) {
      const byOffering = await (
        this.prisma as any
      ).iaAssessmentScheme.findFirst({
        where: { tenantId, offeringId, deletedAt: null, status: 'ACTIVE' },
        include: { components: { orderBy: { sortOrder: 'asc' } } },
      });
      if (byOffering) return byOffering;
    }
    if (courseId) {
      return (this.prisma as any).iaAssessmentScheme.findFirst({
        where: { tenantId, courseId, deletedAt: null, status: 'ACTIVE' },
        include: { components: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
    }
    return null;
  }

  async lockScheme(tenantId: string, schemeId: string) {
    await (this.prisma as any).iaAssessmentScheme.update({
      where: { id: schemeId },
      data: { isLocked: true },
    });
  }
}
