import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import type {
  BulkGenerateIdCardsDto,
  GenerateIdCardDto,
  ReissueIdCardDto,
  ReportLostCardDto,
  UpdateIdCardSettingsDto,
} from './dto/id-cards.dto';
import dbcClassicLayout from './seeds/dbc-classic.json';
import dbcPursuitExcellenceLayout from './seeds/dbc-pursuit-excellence.json';
import dbcPursuitStaffLayout from './seeds/dbc-pursuit-staff.json';
import corporateProfessionalLayout from './seeds/corporate-professional.json';

const LIBRARY_TEMPLATE_SEEDS = [
  {
    code: 'dbc-pursuit-excellence',
    name: 'DBC Pursuit of Excellence',
    holderType: 'STUDENT',
    layout: dbcPursuitExcellenceLayout,
  },
  {
    code: 'dbc-pursuit-staff',
    name: 'DBC Pursuit Staff (Navy & Gold)',
    holderType: 'STAFF',
    layout: dbcPursuitStaffLayout,
  },
  {
    code: 'dbc-classic',
    name: 'DBC Classic',
    holderType: 'STUDENT',
    layout: dbcClassicLayout,
  },
  {
    code: 'corporate-professional',
    name: 'Corporate Professional',
    holderType: 'STAFF',
    layout: corporateProfessionalLayout,
  },
] as const;

const DEFAULT_TEMPLATES = [
  {
    code: 'STUDENT',
    name: 'Student Template',
    holderType: 'STUDENT',
    isDefault: true,
    layout: {
      front: [
        'logo',
        'photo',
        'name',
        'registrationNumber',
        'rollNumber',
        'programme',
        'department',
        'semester',
        'academicYear',
        'qr',
        'validity',
      ],
      back: ['address', 'contact', 'barcode', 'terms', 'principalSignature'],
    },
  },
  {
    code: 'STAFF',
    name: 'Staff Template',
    holderType: 'STAFF',
    isDefault: true,
    layout: {
      front: [
        'logo',
        'photo',
        'name',
        'employeeId',
        'designation',
        'department',
        'bloodGroup',
        'qr',
      ],
      back: ['address', 'contact', 'emergencyContact', 'barcode', 'terms'],
    },
  },
  {
    code: 'VISITOR',
    name: 'Visitor Template',
    holderType: 'VISITOR',
    isDefault: true,
    layout: {
      front: ['logo', 'photo', 'name', 'validity', 'qr'],
      back: ['terms'],
    },
  },
  {
    code: 'LIBRARY',
    name: 'Library Member Template',
    holderType: 'LIBRARY',
    isDefault: true,
    layout: {
      front: ['logo', 'photo', 'name', 'memberId', 'qr'],
      back: ['terms'],
    },
  },
  {
    code: 'TEMPORARY',
    name: 'Temporary Pass',
    holderType: 'TEMPORARY',
    isDefault: true,
    layout: { front: ['logo', 'name', 'validity', 'qr'], back: ['terms'] },
  },
] as const;

@Injectable()
export class IdCardsService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as any;
  }

  async ensureDefaults(tenantId: string) {
    const settings = await this.db().idCardSettings.findUnique({
      where: { tenantId },
    });
    if (!settings) {
      await this.db().idCardSettings.create({ data: { tenantId } });
    }
    for (const tpl of DEFAULT_TEMPLATES) {
      await this.db().idCardTemplate.upsert({
        where: { tenantId_code: { tenantId, code: tpl.code } },
        create: { tenantId, ...tpl, layout: tpl.layout },
        update: {},
      });
    }
    await this.ensureLibraryTemplates(tenantId);
  }

  /** Seed v1 gallery templates for new tenants; never overwrite existing rows. */
  private async ensureLibraryTemplates(tenantId: string) {
    for (const seed of LIBRARY_TEMPLATE_SEEDS) {
      const existing = await this.db().idCardTemplate.findFirst({
        where: { tenantId, code: seed.code },
      });
      if (existing) continue;

      const hasDefaultForType = await this.db().idCardTemplate.findFirst({
        where: { tenantId, holderType: seed.holderType, isDefault: true },
      });

      await this.db().idCardTemplate.create({
        data: {
          tenantId,
          code: seed.code,
          name: seed.name,
          holderType: seed.holderType,
          layout: seed.layout,
          isDefault: !hasDefaultForType,
        },
      });
    }
  }

  async getDashboard(tenantId: string) {
    await this.ensureDefaults(tenantId);

    const [
      studentGenerated,
      studentPending,
      studentPrinted,
      studentAssigned,
      staffGenerated,
      staffPending,
      staffPrinted,
      staffAssigned,
      rfidMappedStudents,
      rfidUnmappedStudents,
      rfidMappedStaff,
      lostActive,
    ] = await Promise.all([
      this.db().idCardIssue.count({
        where: { tenantId, holderType: 'STUDENT' },
      }),
      this.db().idCardPrintRequest.count({
        where: { tenantId, holderType: 'STUDENT', status: 'PENDING' },
      }),
      this.db().idCardIssue.count({
        where: { tenantId, holderType: 'STUDENT', status: 'PRINTED' },
      }),
      this.db().idCardIssue.count({
        where: { tenantId, holderType: 'STUDENT', status: 'ASSIGNED' },
      }),
      this.db().idCardIssue.count({
        where: {
          tenantId,
          holderType: { in: ['STAFF', 'CONTRACT', 'VISITING', 'RESEARCH'] },
        },
      }),
      this.db().idCardPrintRequest.count({
        where: {
          tenantId,
          holderType: { in: ['STAFF', 'CONTRACT', 'VISITING', 'RESEARCH'] },
          status: 'PENDING',
        },
      }),
      this.db().idCardIssue.count({
        where: {
          tenantId,
          holderType: { in: ['STAFF', 'CONTRACT', 'VISITING', 'RESEARCH'] },
          status: 'PRINTED',
        },
      }),
      this.db().idCardIssue.count({
        where: {
          tenantId,
          holderType: { in: ['STAFF', 'CONTRACT', 'VISITING', 'RESEARCH'] },
          status: 'ASSIGNED',
        },
      }),
      this.prisma.student.count({
        where: { tenantId, deletedAt: null, rfidNumber: { not: null } },
      }),
      this.prisma.student.count({
        where: { tenantId, deletedAt: null, rfidNumber: null },
      }),
      this.db().staffProfile.count({
        where: { tenantId, deletedAt: null, rfidNo: { not: null } },
      }),
      this.db().idCardIssue.count({ where: { tenantId, status: 'LOST' } }),
    ]);

    return {
      studentCards: {
        generated: studentGenerated,
        pending: studentPending,
        printed: studentPrinted,
        assigned: studentAssigned,
      },
      staffCards: {
        generated: staffGenerated,
        pending: staffPending,
        printed: staffPrinted,
        assigned: staffAssigned,
      },
      rfid: {
        mapped: rfidMappedStudents + rfidMappedStaff,
        unmapped: rfidUnmappedStudents,
        studentMapped: rfidMappedStudents,
        staffMapped: rfidMappedStaff,
      },
      lostCards: { active: lostActive },
    };
  }

  async nextCardNumber(tenantId: string, holderType: string) {
    await this.ensureDefaults(tenantId);
    const settings = await this.db().idCardSettings.findUniqueOrThrow({
      where: { tenantId },
    });
    const year = new Date().getFullYear();
    const prefix = settings.qrPrefix ?? 'DBC';
    const typeCode =
      holderType === 'STAFF' ||
      holderType === 'CONTRACT' ||
      holderType === 'VISITING' ||
      holderType === 'RESEARCH'
        ? 'STF'
        : 'STU';
    const pattern = `${prefix}-${typeCode}-${year}-`;
    const count = await this.db().idCardIssue.count({
      where: { tenantId, cardNumber: { startsWith: pattern } },
    });
    return `${pattern}${String(count + 1).padStart(4, '0')}`;
  }

  async generateIssue(user: JwtUser, dto: GenerateIdCardDto) {
    if (dto.holderType === 'STUDENT') {
      if (!dto.studentId)
        throw new BadRequestException('studentId is required');
      const student = await this.prisma.student.findFirst({
        where: { id: dto.studentId, tenantId: user.tid, deletedAt: null },
      });
      if (!student) throw new NotFoundException('Student not found');
      const cardNumber = await this.nextCardNumber(user.tid, 'STUDENT');
      const template = await this.db().idCardTemplate.findFirst({
        where: { tenantId: user.tid, holderType: 'STUDENT', isDefault: true },
      });
      const settings = await this.db().idCardSettings.findUniqueOrThrow({
        where: { tenantId: user.tid },
      });
      const expiresAt = new Date();
      expiresAt.setFullYear(
        expiresAt.getFullYear() + (settings.validityYears ?? 2),
      );

      return this.db().idCardIssue.create({
        data: {
          tenantId: user.tid,
          cardNumber,
          holderType: 'STUDENT',
          studentId: dto.studentId,
          templateId: template?.id,
          qrPayload: cardNumber,
          rfidUid: student.rfidNumber,
          status: 'GENERATED',
          expiresAt,
          createdByUserId: user.sub,
        },
      });
    }

    if (!dto.staffProfileId)
      throw new BadRequestException('staffProfileId is required');
    const staff = await this.db().staffProfile.findFirst({
      where: { id: dto.staffProfileId, tenantId: user.tid, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff profile not found');
    const cardNumber = await this.nextCardNumber(user.tid, dto.holderType);
    const template = await this.db().idCardTemplate.findFirst({
      where: { tenantId: user.tid, holderType: 'STAFF', isDefault: true },
    });
    const settings = await this.db().idCardSettings.findUniqueOrThrow({
      where: { tenantId: user.tid },
    });
    const expiresAt = new Date();
    expiresAt.setFullYear(
      expiresAt.getFullYear() + (settings.validityYears ?? 2),
    );

    return this.db().idCardIssue.create({
      data: {
        tenantId: user.tid,
        cardNumber,
        holderType: dto.holderType,
        staffProfileId: dto.staffProfileId,
        templateId: template?.id,
        qrPayload: cardNumber,
        rfidUid: staff.rfidNo,
        status: 'GENERATED',
        expiresAt,
        createdByUserId: user.sub,
      },
    });
  }

  async bulkGenerate(user: JwtUser, dto: BulkGenerateIdCardsDto) {
    const BULK_LIMIT = 2000;

    if (dto.holderType === 'STAFF') {
      let staffProfileIds = dto.staffProfileIds ?? [];
      if (staffProfileIds.length === 0) {
        const staffRows = await this.prisma.staffProfile.findMany({
          where: {
            tenantId: user.tid,
            deletedAt: null,
            status: 'ACTIVE',
            ...(dto.departmentId ? { departmentId: dto.departmentId } : {}),
            ...(dto.staffType ? { staffType: dto.staffType as never } : {}),
          },
          select: { id: true, staffType: true },
          take: BULK_LIMIT,
        });
        staffProfileIds = staffRows.map((s) => s.id);
      }

      const created = [];
      let skipped = 0;
      for (const staffProfileId of staffProfileIds) {
        const existing = await this.db().idCardIssue.findFirst({
          where: {
            tenantId: user.tid,
            staffProfileId,
            status: { in: ['GENERATED', 'PRINTED', 'ASSIGNED'] },
          },
        });
        if (existing) {
          skipped += 1;
          continue;
        }
        const staff = await this.prisma.staffProfile.findFirst({
          where: { id: staffProfileId, tenantId: user.tid, deletedAt: null },
          select: { staffType: true },
        });
        if (!staff) continue;
        const holderType =
          staff.staffType === 'CONTRACT'
            ? 'CONTRACT'
            : staff.staffType === 'VISITING' || staff.staffType === 'GUEST'
              ? 'VISITING'
              : 'STAFF';
        created.push(
          await this.generateIssue(user, { holderType, staffProfileId }),
        );
      }
      return {
        generated: created.length,
        skipped,
        total: staffProfileIds.length,
        issues: created,
      };
    }

    let studentIds = dto.studentIds ?? [];
    if (dto.holderType === 'STUDENT' && studentIds.length === 0) {
      const students = await this.prisma.student.findMany({
        where: {
          tenantId: user.tid,
          deletedAt: null,
          ...(dto.departmentId ? { departmentId: dto.departmentId } : {}),
        },
        include: {
          masterProfile: true,
          academicProfile: true,
          programVersion: { include: { program: true } },
          semesterProgress: { orderBy: { semesterSequence: 'desc' }, take: 1 },
        },
        take: BULK_LIMIT,
      });
      studentIds = students
        .filter((s: any) => {
          if (dto.semester != null) {
            const sem = s.semesterProgress?.[0]?.semesterSequence;
            if (sem !== dto.semester) return false;
          }
          if (
            dto.programme &&
            s.programVersion?.program?.name !== dto.programme
          )
            return false;
          return true;
        })
        .map((s: any) => s.id);
    }

    const created = [];
    let skipped = 0;
    for (const studentId of studentIds) {
      const existing = await this.db().idCardIssue.findFirst({
        where: {
          tenantId: user.tid,
          studentId,
          status: { in: ['GENERATED', 'PRINTED', 'ASSIGNED'] },
        },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      created.push(
        await this.generateIssue(user, { holderType: 'STUDENT', studentId }),
      );
    }
    return {
      generated: created.length,
      skipped,
      total: studentIds.length,
      issues: created,
    };
  }

  async createStudentPrintRequest(
    user: JwtUser,
    studentId: string,
    requestType: 'NEW' | 'REPRINT',
    note?: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: user.tid, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    const request = await this.db().idCardPrintRequest.create({
      data: {
        tenantId: user.tid,
        holderType: 'STUDENT',
        studentId,
        requestType,
        note: note ?? null,
        requestedByUserId: user.sub,
        status: 'PENDING',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tid,
        userId: user.sub,
        module: 'id_cards',
        action: 'student.id_card_print_request',
        entityType: 'student',
        entityId: studentId,
        metadata: {
          requestType,
          note: note ?? null,
          status: 'PENDING',
          requestId: request.id,
          enrollmentNumber: student.enrollmentNumber,
          submittedAt: new Date().toISOString(),
        },
      },
    });

    return request;
  }

  async listPrintRequests(tenantId: string, status?: string) {
    const rows = await this.db().idCardPrintRequest.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        student: { include: { masterProfile: true } },
        staffProfile: { include: { designation: true, department: true } },
      },
    });

    return rows.map((row: any) => ({
      id: row.id,
      holderType: row.holderType,
      studentId: row.studentId,
      staffProfileId: row.staffProfileId,
      enrollmentNumber: row.student?.enrollmentNumber ?? null,
      fullName:
        row.student?.masterProfile?.fullName ??
        row.staffProfile?.fullName ??
        null,
      requestType: row.requestType,
      status: row.status,
      note: row.note,
      submittedAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    }));
  }

  async completePrintRequest(
    user: JwtUser,
    requestId: string,
    issueId?: string,
  ) {
    const request = await this.db().idCardPrintRequest.findFirst({
      where: { id: requestId, tenantId: user.tid },
    });
    if (!request) throw new NotFoundException('Print request not found');

    let issue = issueId
      ? await this.db().idCardIssue.findFirst({
          where: { id: issueId, tenantId: user.tid },
        })
      : null;

    if (!issue && request.studentId) {
      issue = await this.generateIssue(user, {
        holderType: 'STUDENT',
        studentId: request.studentId,
      });
    } else if (!issue && request.staffProfileId) {
      issue = await this.generateIssue(user, {
        holderType: request.holderType,
        staffProfileId: request.staffProfileId,
      });
    }

    if (issue) {
      await this.db().idCardIssue.update({
        where: { id: issue.id },
        data: { status: 'PRINTED', printedAt: new Date() },
      });
    }

    return this.db().idCardPrintRequest.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED',
        completedByUserId: user.sub,
        completedAt: new Date(),
        issueId: issue?.id,
      },
    });
  }

  async reissue(user: JwtUser, dto: ReissueIdCardDto) {
    const previous = await this.db().idCardIssue.findFirst({
      where: { id: dto.previousIssueId, tenantId: user.tid },
    });
    if (!previous) throw new NotFoundException('Previous card issue not found');

    await this.db().idCardIssue.update({
      where: { id: previous.id },
      data: {
        status: dto.reason === 'LOST' ? 'LOST' : 'REPLACED',
        lostReportedAt:
          dto.reason === 'LOST' ? new Date() : previous.lostReportedAt,
      },
    });

    const next = await this.generateIssue(user, {
      holderType: previous.holderType,
      studentId: previous.studentId ?? undefined,
      staffProfileId: previous.staffProfileId ?? undefined,
    });

    return this.db().idCardIssue.update({
      where: { id: next.id },
      data: {
        previousIssueId: previous.id,
        reissueReason: dto.reason,
        reissueFee: dto.reissueFee ?? null,
      },
    });
  }

  async reportLost(user: JwtUser, dto: ReportLostCardDto) {
    const issue = await this.db().idCardIssue.findFirst({
      where: { id: dto.issueId, tenantId: user.tid },
    });
    if (!issue) throw new NotFoundException('Card issue not found');

    return this.db().idCardIssue.update({
      where: { id: issue.id },
      data: {
        status: 'LOST',
        lostReportedAt: new Date(),
      },
    });
  }

  async verifyPublic(code: string) {
    const trimmed = decodeURIComponent(code.trim());
    const issue = await this.db().idCardIssue.findFirst({
      where: {
        OR: [{ cardNumber: trimmed }, { qrPayload: trimmed }],
        status: { in: ['GENERATED', 'PRINTED', 'ASSIGNED'] },
      },
      include: {
        student: {
          include: {
            masterProfile: true,
            department: true,
            programVersion: { include: { program: true } },
          },
        },
        staffProfile: { include: { designation: true, department: true } },
      },
    });

    if (!issue) {
      return { valid: false as const, message: 'Card not found or inactive' };
    }

    if (issue.expiresAt && issue.expiresAt < new Date()) {
      return { valid: false as const, message: 'Card expired' };
    }

    const isStudent = Boolean(issue.studentId);
    const photoUrl = isStudent
      ? issue.student?.masterProfile?.photoPath
      : issue.staffProfile?.photoUrl;

    return {
      valid: true as const,
      holderType: isStudent ? 'STUDENT' : 'STAFF',
      cardNumber: issue.cardNumber,
      status: issue.status,
      display: {
        photoUrl: photoUrl ?? null,
        name:
          issue.student?.masterProfile?.fullName ??
          issue.staffProfile?.fullName ??
          '—',
        department:
          issue.student?.department?.name ??
          issue.staffProfile?.department?.name ??
          issue.student?.programVersion?.program?.name ??
          null,
        designation:
          issue.staffProfile?.designation?.label ??
          (isStudent ? 'Student' : null),
        roleLabel: isStudent ? 'Valid Student' : 'Valid Staff',
      },
    };
  }

  async listTemplates(tenantId: string) {
    await this.ensureDefaults(tenantId);
    return this.db().idCardTemplate.findMany({
      where: { tenantId },
      orderBy: [{ holderType: 'asc' }, { name: 'asc' }],
    });
  }

  async getTemplate(tenantId: string, id: string) {
    await this.ensureDefaults(tenantId);
    const tpl = await this.db().idCardTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!tpl) throw new NotFoundException('Template not found');
    return tpl;
  }

  async updateTemplate(
    tenantId: string,
    id: string,
    dto: { name?: string; layout?: Record<string, unknown> },
  ) {
    await this.getTemplate(tenantId, id);
    return this.db().idCardTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.layout !== undefined ? { layout: dto.layout } : {}),
      },
    });
  }

  async duplicateTemplate(tenantId: string, id: string) {
    const source = await this.getTemplate(tenantId, id);
    const code = `${source.code}_COPY_${Date.now().toString(36).slice(-4).toUpperCase()}`;
    return this.db().idCardTemplate.create({
      data: {
        tenantId,
        code,
        name: `${source.name} (Copy)`,
        holderType: source.holderType,
        isDefault: false,
        layout: source.layout,
      },
    });
  }

  async createTemplate(
    tenantId: string,
    dto: {
      code: string;
      name: string;
      holderType: string;
      layout: Record<string, unknown>;
      setAsDefault?: boolean;
    },
  ) {
    await this.ensureDefaults(tenantId);
    const existing = await this.db().idCardTemplate.findFirst({
      where: { tenantId, code: dto.code },
    });
    if (existing) {
      if (dto.setAsDefault) {
        return this.setDefaultTemplate(tenantId, existing.id);
      }
      return existing;
    }

    if (dto.setAsDefault) {
      await this.db().idCardTemplate.updateMany({
        where: { tenantId, holderType: dto.holderType, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.db().idCardTemplate.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        holderType: dto.holderType,
        layout: dto.layout,
        isDefault: Boolean(dto.setAsDefault),
      },
    });
  }

  async setDefaultTemplate(tenantId: string, id: string) {
    const tpl = await this.getTemplate(tenantId, id);
    await this.db().idCardTemplate.updateMany({
      where: { tenantId, holderType: tpl.holderType, isDefault: true },
      data: { isDefault: false },
    });
    return this.db().idCardTemplate.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  async getSettings(tenantId: string) {
    await this.ensureDefaults(tenantId);
    return this.db().idCardSettings.findUniqueOrThrow({ where: { tenantId } });
  }

  async updateSettings(tenantId: string, dto: UpdateIdCardSettingsDto) {
    await this.ensureDefaults(tenantId);
    return this.db().idCardSettings.update({
      where: { tenantId },
      data: dto,
    });
  }

  async listIssues(
    tenantId: string,
    filters: {
      holderType?: string;
      status?: string;
      statuses?: string[];
      studentId?: string;
      staffProfileId?: string;
      departmentId?: string;
      staffType?: string;
      staffOnly?: boolean;
      studentOnly?: boolean;
      limit?: number;
    },
  ) {
    const take = Math.min(Math.max(filters.limit ?? 200, 1), 2000);
    const statusWhere = filters.statuses?.length
      ? { status: { in: filters.statuses } }
      : filters.status
        ? { status: filters.status }
        : {};

    const holderWhere = filters.staffOnly
      ? {
          staffProfileId: { not: null },
          ...(filters.departmentId || filters.staffType
            ? {
                staffProfile: {
                  deletedAt: null,
                  ...(filters.departmentId
                    ? { departmentId: filters.departmentId }
                    : {}),
                  ...(filters.staffType
                    ? { staffType: filters.staffType as never }
                    : {}),
                },
              }
            : {}),
        }
      : filters.studentOnly
        ? {
            studentId: { not: null },
            holderType: 'STUDENT' as const,
            ...(filters.departmentId
              ? {
                  student: {
                    deletedAt: null,
                    departmentId: filters.departmentId,
                  },
                }
              : { student: { deletedAt: null } }),
          }
        : {
            ...(filters.holderType ? { holderType: filters.holderType } : {}),
            ...(filters.studentId ? { studentId: filters.studentId } : {}),
            ...(filters.staffProfileId
              ? { staffProfileId: filters.staffProfileId }
              : {}),
          };

    return this.db().idCardIssue.findMany({
      where: {
        tenantId,
        ...statusWhere,
        ...holderWhere,
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async getReports(tenantId: string) {
    const [byStatus, reissues, pendingPrint] = await Promise.all([
      this.db().idCardIssue.groupBy({
        by: ['holderType', 'status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.db().idCardIssue.count({
        where: { tenantId, previousIssueId: { not: null } },
      }),
      this.db().idCardPrintRequest.count({
        where: { tenantId, status: 'PENDING' },
      }),
    ]);

    return {
      issuesByStatus: byStatus,
      reissueCount: reissues,
      pendingPrint,
    };
  }
}
