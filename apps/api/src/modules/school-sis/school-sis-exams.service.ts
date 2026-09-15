import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisCalendarService } from './school-sis-calendar.service';
import {
  DEFAULT_EXAM_TYPES,
  DEFAULT_GRADE_BANDS,
  DEFAULT_REMARK_BANDS,
} from './school-sis-exams.catalog';
import type {
  GenerateResultsDto,
  PublishResultDto,
  ReopenMarksDto,
  SaveExamComponentDto,
  SaveExamMarksDto,
  SaveExamScheduleDto,
  SaveExamSubjectDto,
  SaveGradeSystemDto,
  SaveSchoolExamDto,
  SaveSchoolExamSettingsDto,
  SaveSchoolExamTypeDto,
} from './dto/school-exams.dto';

export type ExamActor = {
  userId: string;
  email?: string;
  manage: boolean;
  teacher: boolean;
};

function n(v: Prisma.Decimal | number | string | null | undefined) {
  return Number(v ?? 0);
}

function roundValue(value: number, places: number, rounding: string) {
  const f = 10 ** Math.max(0, places);
  if (rounding === 'FLOOR') return Math.floor(value * f) / f;
  if (rounding === 'CEIL') return Math.ceil(value * f) / f;
  if (rounding === 'NEAREST') return Math.round(value);
  return Math.round(value * f) / f;
}

@Injectable()
export class SchoolSisExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly calendar: SchoolSisCalendarService,
  ) {}

  private async year(tenantId: string) {
    return this.sis.currentYear(tenantId);
  }

  async ensureSetup(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.prisma.schoolExamSettings.upsert({
      where: { tenantId },
      update: {},
      create: {
        tenantId,
        remarkBands: DEFAULT_REMARK_BANDS as unknown as Prisma.InputJsonValue,
      },
    });
    const typeCount = await this.prisma.schoolExamType.count({
      where: { tenantId, deletedAt: null },
    });
    if (typeCount === 0) {
      for (const t of DEFAULT_EXAM_TYPES) {
        await this.prisma.schoolExamType.create({
          data: {
            tenantId,
            code: t.code,
            name: t.name,
            defaultWeight: t.defaultWeight,
          },
        });
      }
    }
    const gs = await this.prisma.schoolGradeSystem.count({
      where: { tenantId },
    });
    if (gs === 0) {
      const system = await this.prisma.schoolGradeSystem.create({
        data: {
          tenantId,
          name: 'Percentage',
          kind: 'PERCENTAGE',
          isDefault: true,
        },
      });
      let i = 0;
      for (const b of DEFAULT_GRADE_BANDS) {
        await this.prisma.schoolGradeBand.create({
          data: {
            tenantId,
            systemId: system.id,
            code: b.code,
            label: b.label,
            minPercent: b.min,
            maxPercent: b.max,
            gradePoint: b.point,
            description: b.description,
            sortOrder: i++,
          },
        });
      }
      await this.prisma.schoolExamSettings.update({
        where: { tenantId },
        data: { defaultGradeSystemId: system.id },
      });
    }
  }

  async getSettings(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolExamSettings.findUniqueOrThrow({
      where: { tenantId },
    });
  }

  async saveSettings(
    tenantId: string,
    dto: SaveSchoolExamSettingsDto,
    actor: ExamActor,
  ) {
    if (!actor.manage)
      throw new ForbiddenException(
        'Not allowed to change examination settings',
      );
    const before = await this.getSettings(tenantId);
    const row = await this.prisma.schoolExamSettings.update({
      where: { tenantId },
      data: {
        passPercent: dto.passPercent ?? before.passPercent,
        rankingEnabled: dto.rankingEnabled ?? before.rankingEnabled,
        rankingMethod: dto.rankingMethod ?? before.rankingMethod,
        rankingTie: dto.rankingTie ?? before.rankingTie,
        graceEnabled: dto.graceEnabled ?? before.graceEnabled,
        graceMax: dto.graceMax ?? before.graceMax,
        decimalPlaces: dto.decimalPlaces ?? before.decimalPlaces,
        rounding: dto.rounding ?? before.rounding,
        absentCode: dto.absentCode ?? before.absentCode,
        medicalCode: dto.medicalCode ?? before.medicalCode,
        notAppearedCode: dto.notAppearedCode ?? before.notAppearedCode,
        attendanceMinPercent:
          dto.attendanceMinPercent ?? before.attendanceMinPercent,
        attendanceAffectsResult:
          dto.attendanceAffectsResult ?? before.attendanceAffectsResult,
        requirePassEverySubject:
          dto.requirePassEverySubject ?? before.requirePassEverySubject,
        maxFailedSubjects: dto.maxFailedSubjects ?? before.maxFailedSubjects,
        requireTheoryPass: dto.requireTheoryPass ?? before.requireTheoryPass,
        approvalWorkflow: dto.approvalWorkflow ?? before.approvalWorkflow,
        allowNegativeMarks: dto.allowNegativeMarks ?? before.allowNegativeMarks,
        defaultGradeSystemId:
          dto.defaultGradeSystemId ?? before.defaultGradeSystemId,
        reportTemplate: dto.reportTemplate ?? before.reportTemplate,
        showRankOnCard: dto.showRankOnCard ?? before.showRankOnCard,
        showPhotoOnCard: dto.showPhotoOnCard ?? before.showPhotoOnCard,
        remarkBands: dto.remarkBands
          ? (dto.remarkBands as Prisma.InputJsonValue)
          : (before.remarkBands ?? undefined),
      },
    });
    await this.audit(tenantId, actor, 'SETTINGS_UPDATED', row.id, before, row);
    return row;
  }

  private async audit(
    tenantId: string,
    actor: ExamActor,
    action: string,
    recordId?: string,
    oldValue?: unknown,
    newValue?: unknown,
    reason?: string,
  ) {
    await this.prisma.schoolExamAuditLog.create({
      data: {
        tenantId,
        userId: actor.userId,
        action,
        recordId,
        reason,
        oldValue:
          oldValue == null
            ? undefined
            : (JSON.parse(JSON.stringify(oldValue)) as Prisma.InputJsonValue),
        newValue:
          newValue == null
            ? undefined
            : (JSON.parse(JSON.stringify(newValue)) as Prisma.InputJsonValue),
      },
    });
  }

  async teacherStaff(tenantId: string, email?: string) {
    if (!email) return null;
    return this.prisma.schoolStaff.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        email: { equals: email, mode: 'insensitive' },
      },
    });
  }

  async listTypes(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolExamType.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async saveType(
    tenantId: string,
    dto: SaveSchoolExamTypeDto,
    actor: ExamActor,
    id?: string,
  ) {
    if (!actor.manage) throw new ForbiddenException('Not allowed');
    const data = {
      name: dto.name.trim(),
      code: dto.code.trim().toUpperCase(),
      description: dto.description || null,
      defaultWeight: dto.defaultWeight ?? 100,
      active: dto.active ?? true,
    };
    return id
      ? this.prisma.schoolExamType.update({ where: { id }, data })
      : this.prisma.schoolExamType.create({ data: { tenantId, ...data } });
  }

  async listExams(tenantId: string) {
    await this.ensureSetup(tenantId);
    const year = await this.year(tenantId);
    return this.prisma.schoolExam.findMany({
      where: { tenantId, academicYearId: year.id, deletedAt: null },
      include: {
        type: true,
        _count: { select: { marks: true, results: true, schedules: true } },
      },
      orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
    });
  }

  async saveExam(
    tenantId: string,
    dto: SaveSchoolExamDto,
    actor: ExamActor,
    id?: string,
  ) {
    if (!actor.manage)
      throw new ForbiddenException('Not allowed to manage examinations');
    const year = await this.year(tenantId);
    const data = {
      name: dto.name.trim(),
      typeId: dto.typeId,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      description: dto.description || null,
      status: dto.status || 'DRAFT',
      gradeIds: dto.gradeIds ?? [],
      settingsOverride: (dto.settingsOverride ?? {}) as Prisma.InputJsonValue,
      marksDeadline: dto.marksDeadline ? new Date(dto.marksDeadline) : null,
    };
    if (id) {
      const existing = await this.prisma.schoolExam.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('Examination not found');
      if (
        existing.status === 'PUBLISHED' &&
        dto.status &&
        dto.status !== 'PUBLISHED' &&
        dto.status !== 'ARCHIVED'
      ) {
        throw new BadRequestException(
          'Unpublish the result before changing a published examination',
        );
      }
      const updated = await this.prisma.schoolExam.update({
        where: { id },
        data,
      });
      if (dto.addToCalendar !== undefined) {
        await this.calendar.upsertExamEvent(
          tenantId,
          updated,
          !!dto.addToCalendar,
          {
            userId: actor.userId,
            manage: actor.manage,
          },
        );
      }
      return updated;
    }
    const exam = await this.prisma.schoolExam.create({
      data: { tenantId, academicYearId: year.id, ...data },
    });
    await this.seedStructure(tenantId, exam.id, dto.gradeIds ?? []);
    if (dto.addToCalendar) {
      await this.calendar.upsertExamEvent(tenantId, exam, true, {
        userId: actor.userId,
        manage: actor.manage,
      });
    }
    return exam;
  }

  async archiveExam(tenantId: string, id: string, actor: ExamActor) {
    if (!actor.manage) throw new ForbiddenException('Not allowed');
    const exam = await this.prisma.schoolExam.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { marks: true, results: true } } },
    });
    if (!exam) throw new NotFoundException('Examination not found');
    if (exam._count.marks > 0 || exam._count.results > 0) {
      await this.prisma.schoolExam.update({
        where: { id },
        data: { status: 'ARCHIVED', deletedAt: null },
      });
      throw new BadRequestException(
        'This examination contains academic records and cannot be permanently deleted. It has been archived.',
      );
    }
    await this.prisma.schoolExam.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    await this.audit(tenantId, actor, 'EXAM_ARCHIVED', id);
    return { ok: true };
  }

  private async seedStructure(
    tenantId: string,
    examId: string,
    gradeIds: string[],
  ) {
    const year = await this.year(tenantId);
    const settings = await this.getSettings(tenantId);
    const ids = gradeIds.length
      ? gradeIds
      : (
          await this.prisma.schoolGrade.findMany({
            where: { tenantId, deletedAt: null, active: true },
            select: { id: true },
          })
        ).map((g) => g.id);
    for (const gradeId of ids) {
      const maps = await this.prisma.schoolGradeSubject.findMany({
        where: { tenantId, academicYearId: year.id, gradeId },
        include: { subject: true },
      });
      for (const map of maps) {
        const max = map.subject.maxMarks ?? 100;
        const pass = map.subject.passMarks ?? n(settings.passPercent);
        const sub = await this.prisma.schoolExamSubject.create({
          data: {
            tenantId,
            examId,
            gradeId,
            subjectId: map.subjectId,
            maxTotal: max,
            passTotal: pass,
            theoryMax: map.subject.hasPractical ? Math.round(max * 0.8) : max,
            theoryPass: map.subject.hasPractical
              ? Math.round(pass * 0.8)
              : pass,
          },
        });
        await this.prisma.schoolExamComponent.create({
          data: {
            tenantId,
            examSubjectId: sub.id,
            name: 'Theory',
            code: 'THEORY',
            maxMarks: sub.theoryMax,
            passMarks: sub.theoryPass,
            sortOrder: 0,
          },
        });
        if (map.subject.hasPractical) {
          await this.prisma.schoolExamComponent.create({
            data: {
              tenantId,
              examSubjectId: sub.id,
              name: 'Practical',
              code: 'PRACTICAL',
              maxMarks: n(max) - n(sub.theoryMax),
              passMarks: 0,
              sortOrder: 1,
            },
          });
        }
      }
    }
  }

  async getExam(tenantId: string, id: string) {
    const exam = await this.prisma.schoolExam.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        type: true,
        subjects: {
          include: {
            subject: true,
            grade: true,
            components: { orderBy: { sortOrder: 'asc' } },
          },
        },
        schedules: {
          include: {
            section: { include: { grade: true } },
            subject: true,
            invigilators: { include: { staff: true } },
          },
          orderBy: { examDate: 'asc' },
        },
      },
    });
    if (!exam) throw new NotFoundException('Examination not found');
    return exam;
  }

  async saveSubject(
    tenantId: string,
    examId: string,
    dto: SaveExamSubjectDto,
    actor: ExamActor,
  ) {
    if (!actor.manage) throw new ForbiddenException('Not allowed');
    const settings = await this.getSettings(tenantId);
    return this.prisma.schoolExamSubject.upsert({
      where: {
        examId_gradeId_subjectId: {
          examId,
          gradeId: dto.gradeId,
          subjectId: dto.subjectId,
        },
      },
      update: {
        maxTotal: dto.maxTotal ?? 100,
        passTotal: dto.passTotal ?? n(settings.passPercent),
        weightage: dto.weightage ?? 100,
        requireTheoryPass: dto.requireTheoryPass ?? false,
        theoryMax: dto.theoryMax ?? 0,
        theoryPass: dto.theoryPass ?? 0,
      },
      create: {
        tenantId,
        examId,
        gradeId: dto.gradeId,
        subjectId: dto.subjectId,
        maxTotal: dto.maxTotal ?? 100,
        passTotal: dto.passTotal ?? n(settings.passPercent),
        weightage: dto.weightage ?? 100,
        requireTheoryPass: dto.requireTheoryPass ?? false,
        theoryMax: dto.theoryMax ?? 0,
        theoryPass: dto.theoryPass ?? 0,
      },
    });
  }

  async saveComponent(
    tenantId: string,
    examSubjectId: string,
    dto: SaveExamComponentDto,
    actor: ExamActor,
  ) {
    if (!actor.manage) throw new ForbiddenException('Not allowed');
    return this.prisma.schoolExamComponent.upsert({
      where: {
        examSubjectId_code: {
          examSubjectId,
          code: dto.code.trim().toUpperCase(),
        },
      },
      update: {
        name: dto.name,
        maxMarks: dto.maxMarks,
        passMarks: dto.passMarks ?? 0,
        weightage: dto.weightage ?? 100,
        sortOrder: dto.sortOrder ?? 0,
      },
      create: {
        tenantId,
        examSubjectId,
        name: dto.name,
        code: dto.code.trim().toUpperCase(),
        maxMarks: dto.maxMarks,
        passMarks: dto.passMarks ?? 0,
        weightage: dto.weightage ?? 100,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async saveSchedule(
    tenantId: string,
    dto: SaveExamScheduleDto,
    actor: ExamActor,
  ) {
    if (!actor.manage) throw new ForbiddenException('Not allowed');
    const row = await this.prisma.schoolExamSchedule.create({
      data: {
        tenantId,
        examId: dto.examId,
        sectionId: dto.sectionId,
        subjectId: dto.subjectId,
        examDate: new Date(dto.examDate),
        startTime: dto.startTime,
        endTime: dto.endTime,
        durationMin: dto.durationMin ?? 0,
        room: dto.room || null,
        maxMarks: dto.maxMarks ?? null,
        instructions: dto.instructions || null,
      },
    });
    if (dto.invigilatorId) {
      await this.assignInvigilator(
        tenantId,
        row.id,
        dto.invigilatorId,
        !!dto.overrideConflict,
        actor,
      );
    }
    return row;
  }

  async assignInvigilator(
    tenantId: string,
    scheduleId: string,
    staffId: string,
    override: boolean,
    actor: ExamActor,
  ) {
    const slot = await this.prisma.schoolExamSchedule.findFirst({
      where: { id: scheduleId, tenantId },
    });
    if (!slot) throw new NotFoundException('Schedule not found');
    const conflict = await this.prisma.schoolExamInvigilator.findFirst({
      where: {
        tenantId,
        staffId,
        schedule: {
          examDate: slot.examDate,
          startTime: slot.startTime,
          NOT: { id: scheduleId },
        },
      },
      include: {
        schedule: { include: { section: { include: { grade: true } } } },
      },
    });
    if (conflict && !override) {
      throw new BadRequestException(
        `This staff member is already assigned to ${conflict.schedule.section.grade.name} ${conflict.schedule.section.name} ${conflict.schedule.startTime}–${conflict.schedule.endTime}. Override to continue.`,
      );
    }
    return this.prisma.schoolExamInvigilator.create({
      data: { tenantId, scheduleId, staffId, override },
    });
  }

  async dashboard(tenantId: string) {
    await this.ensureSetup(tenantId);
    const year = await this.year(tenantId);
    const exams = await this.prisma.schoolExam.findMany({
      where: { tenantId, academicYearId: year.id, deletedAt: null },
      include: { type: true },
      orderBy: { startDate: 'asc' },
    });
    const now = new Date();
    const upcoming = exams.filter(
      (e) =>
        e.startDate &&
        e.startDate > now &&
        !['PUBLISHED', 'ARCHIVED', 'COMPLETED'].includes(e.status),
    );
    const ongoing = exams.filter(
      (e) => e.startDate && e.endDate && e.startDate <= now && e.endDate >= now,
    );
    const completed = exams.filter((e) =>
      ['COMPLETED', 'PUBLISHED', 'ARCHIVED'].includes(e.status),
    );
    const published = exams.filter((e) => e.status === 'PUBLISHED');
    const pendingMarks = await this.prisma.schoolExamMark.count({
      where: {
        tenantId,
        entryStatus: 'DRAFT',
        exam: { academicYearId: year.id, deletedAt: null },
      },
    });
    const results = await this.prisma.schoolExamResult.groupBy({
      by: ['status'],
      where: { tenantId, exam: { academicYearId: year.id } },
      _count: true,
    });
    const passed = results.find((r) => r.status === 'PASS')?._count ?? 0;
    const failed = results.find((r) => r.status === 'FAIL')?._count ?? 0;
    const appeared = results.reduce((s, r) => s + r._count, 0);
    return {
      upcoming: upcoming.length,
      ongoing: ongoing.length,
      completed: completed.length,
      marksPending: pendingMarks,
      resultsPublished: published.length,
      studentsAppeared: appeared,
      studentsPassed: passed,
      studentsFailed: failed,
      upcomingList: upcoming.slice(0, 8),
      exams,
    };
  }

  async marksRoster(
    tenantId: string,
    examId: string,
    sectionId: string,
    componentId: string,
    actor: ExamActor,
  ) {
    await this.assertMarksAccess(tenantId, examId, sectionId, actor);
    const component = await this.prisma.schoolExamComponent.findFirst({
      where: { id: componentId, tenantId },
      include: { examSubject: { include: { subject: true, exam: true } } },
    });
    if (!component)
      throw new NotFoundException('Assessment component not found');
    const year = await this.year(tenantId);
    const students = await this.prisma.schoolEnrollment.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        sectionId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: { student: true },
      orderBy: { rollNumber: 'asc' },
    });
    const marks = await this.prisma.schoolExamMark.findMany({
      where: { tenantId, examId, componentId },
    });
    const byStudent = new Map(marks.map((m) => [m.studentId, m]));
    return {
      component,
      maxMarks: n(component.maxMarks),
      rows: students.map((en) => {
        const m = byStudent.get(en.studentId);
        return {
          studentId: en.studentId,
          rollNumber: en.rollNumber,
          fullName: en.student.fullName,
          admissionNumber: en.student.admissionNumber,
          marks: m?.marks == null ? null : n(m.marks),
          status: m?.status ?? 'PRESENT',
          remarks: m?.remarks ?? '',
          entryStatus: m?.entryStatus ?? 'DRAFT',
        };
      }),
    };
  }

  private async assertMarksAccess(
    tenantId: string,
    examId: string,
    sectionId: string,
    actor: ExamActor,
  ) {
    if (actor.manage) return;
    const staff = await this.teacherStaff(tenantId, actor.email);
    if (!staff)
      throw new ForbiddenException('No staff profile linked to this account');
    const year = await this.year(tenantId);
    const assigned = await this.prisma.schoolSubjectTeacherAssignment.findFirst(
      {
        where: {
          tenantId,
          academicYearId: year.id,
          sectionId,
          staffId: staff.id,
          deletedAt: null,
        },
      },
    );
    if (!assigned)
      throw new ForbiddenException('You are not assigned to this class');
    void examId;
  }

  async saveMarks(tenantId: string, dto: SaveExamMarksDto, actor: ExamActor) {
    const settings = await this.getSettings(tenantId);
    const exam = await this.prisma.schoolExam.findFirst({
      where: { id: dto.examId, tenantId, deletedAt: null },
    });
    if (!exam) throw new NotFoundException('Examination not found');
    if (exam.status === 'PUBLISHED') {
      throw new BadRequestException(
        'Published results cannot be modified. Unpublish first.',
      );
    }
    const component = await this.prisma.schoolExamComponent.findFirst({
      where: { id: dto.componentId, tenantId },
    });
    if (!component) throw new NotFoundException('Component not found');
    const max = n(component.maxMarks);
    for (const row of dto.rows) {
      if (row.marks != null) {
        if (row.marks > max) {
          throw new BadRequestException(`Marks cannot exceed ${max}.`);
        }
        if (row.marks < 0 && !settings.allowNegativeMarks) {
          throw new BadRequestException('Negative marks are not allowed.');
        }
      }
    }
    await this.prisma.$transaction(async (tx) => {
      for (const row of dto.rows) {
        const existing = await tx.schoolExamMark.findUnique({
          where: {
            examId_componentId_studentId: {
              examId: dto.examId,
              componentId: dto.componentId,
              studentId: row.studentId,
            },
          },
        });
        if (
          existing?.entryStatus === 'SUBMITTED' &&
          !dto.submit &&
          !actor.manage
        ) {
          continue;
        }
        await tx.schoolExamMark.upsert({
          where: {
            examId_componentId_studentId: {
              examId: dto.examId,
              componentId: dto.componentId,
              studentId: row.studentId,
            },
          },
          update: {
            marks:
              row.status && row.status !== 'PRESENT'
                ? null
                : (row.marks ?? null),
            status: row.status || 'PRESENT',
            remarks: row.remarks || null,
            entryStatus: dto.submit ? 'SUBMITTED' : 'DRAFT',
            submittedAt: dto.submit
              ? new Date()
              : (existing?.submittedAt ?? null),
            submittedBy: dto.submit
              ? actor.userId
              : (existing?.submittedBy ?? null),
          },
          create: {
            tenantId,
            examId: dto.examId,
            componentId: dto.componentId,
            studentId: row.studentId,
            marks:
              row.status && row.status !== 'PRESENT'
                ? null
                : (row.marks ?? null),
            status: row.status || 'PRESENT',
            remarks: row.remarks || null,
            entryStatus: dto.submit ? 'SUBMITTED' : 'DRAFT',
            submittedAt: dto.submit ? new Date() : null,
            submittedBy: dto.submit ? actor.userId : null,
          },
        });
      }
    });
    if (dto.submit)
      await this.audit(tenantId, actor, 'MARKS_SUBMITTED', dto.examId);
    return { ok: true, submitted: !!dto.submit };
  }

  async reopenMarks(tenantId: string, dto: ReopenMarksDto, actor: ExamActor) {
    if (!actor.manage)
      throw new ForbiddenException('Not allowed to reopen marks');
    await this.prisma.schoolExamMark.updateMany({
      where: { tenantId, examId: dto.examId, componentId: dto.componentId },
      data: { entryStatus: 'DRAFT' },
    });
    await this.audit(
      tenantId,
      actor,
      'MARKS_REOPENED',
      dto.examId,
      null,
      dto,
      dto.reason,
    );
    return { ok: true };
  }

  async listGradeSystems(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolGradeSystem.findMany({
      where: { tenantId, active: true },
      include: { bands: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async saveGradeSystem(
    tenantId: string,
    dto: SaveGradeSystemDto,
    actor: ExamActor,
    id?: string,
  ) {
    if (!actor.manage) throw new ForbiddenException('Not allowed');
    const system = id
      ? await this.prisma.schoolGradeSystem.update({
          where: { id },
          data: {
            name: dto.name,
            kind: dto.kind ?? 'PERCENTAGE',
            isDefault: dto.isDefault ?? false,
          },
        })
      : await this.prisma.schoolGradeSystem.create({
          data: {
            tenantId,
            name: dto.name,
            kind: dto.kind ?? 'PERCENTAGE',
            isDefault: dto.isDefault ?? false,
          },
        });
    if (dto.bands) {
      await this.prisma.schoolGradeBand.deleteMany({
        where: { systemId: system.id },
      });
      let i = 0;
      for (const b of dto.bands) {
        await this.prisma.schoolGradeBand.create({
          data: {
            tenantId,
            systemId: system.id,
            code: b.code,
            label: b.label,
            minPercent: b.minPercent,
            maxPercent: b.maxPercent,
            gradePoint: b.gradePoint ?? 0,
            description: b.description,
            sortOrder: i++,
          },
        });
      }
    }
    return this.prisma.schoolGradeSystem.findFirst({
      where: { id: system.id },
      include: { bands: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  private resolveSettings(
    base: Awaited<ReturnType<SchoolSisExamsService['getSettings']>>,
    override: Prisma.JsonValue,
  ) {
    const o = (
      override && typeof override === 'object' ? override : {}
    ) as Record<string, unknown>;
    return {
      passPercent: n((o.passPercent as number) ?? base.passPercent),
      rankingEnabled: (o.rankingEnabled as boolean) ?? base.rankingEnabled,
      rankingMethod: String(o.rankingMethod ?? base.rankingMethod),
      rankingTie: String(o.rankingTie ?? base.rankingTie),
      graceEnabled: (o.graceEnabled as boolean) ?? base.graceEnabled,
      graceMax: Number(o.graceMax ?? base.graceMax),
      decimalPlaces: Number(o.decimalPlaces ?? base.decimalPlaces),
      rounding: String(o.rounding ?? base.rounding),
      requirePassEverySubject:
        (o.requirePassEverySubject as boolean) ?? base.requirePassEverySubject,
      maxFailedSubjects: Number(o.maxFailedSubjects ?? base.maxFailedSubjects),
      requireTheoryPass:
        (o.requireTheoryPass as boolean) ?? base.requireTheoryPass,
    };
  }

  private pickGrade(
    percent: number,
    bands: Array<{
      minPercent: Prisma.Decimal;
      maxPercent: Prisma.Decimal;
      code: string;
      gradePoint: Prisma.Decimal;
      label: string;
    }>,
  ) {
    const hit = bands.find(
      (b) => percent >= n(b.minPercent) && percent <= n(b.maxPercent),
    );
    return hit ?? bands[bands.length - 1] ?? null;
  }

  async generateResults(
    tenantId: string,
    dto: GenerateResultsDto,
    actor: ExamActor,
  ) {
    if (!actor.manage)
      throw new ForbiddenException('Not allowed to generate results');
    const exam = await this.getExam(tenantId, dto.examId);
    if (exam.status === 'PUBLISHED') {
      throw new BadRequestException(
        'Unpublish before regenerating. Existing published results were not changed.',
      );
    }
    const settingsRow = await this.getSettings(tenantId);
    const settings = this.resolveSettings(settingsRow, exam.settingsOverride);
    const gradeSystem = settingsRow.defaultGradeSystemId
      ? await this.prisma.schoolGradeSystem.findFirst({
          where: { tenantId, id: settingsRow.defaultGradeSystemId },
          include: { bands: { orderBy: { minPercent: 'desc' } } },
        })
      : await this.prisma.schoolGradeSystem.findFirst({
          where: { tenantId, isDefault: true },
          include: { bands: { orderBy: { minPercent: 'desc' } } },
        });
    const year = await this.year(tenantId);
    const enrollments = await this.prisma.schoolEnrollment.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        status: 'ACTIVE',
        deletedAt: null,
        ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
        ...(Array.isArray(exam.gradeIds) && (exam.gradeIds as string[]).length
          ? { section: { gradeId: { in: exam.gradeIds as string[] } } }
          : {}),
      },
      include: { student: true, section: true },
    });
    const allMarks = await this.prisma.schoolExamMark.findMany({
      where: { tenantId, examId: exam.id },
    });
    const markKey = (sid: string, cid: string) => `${sid}:${cid}`;
    const markMap = new Map(
      allMarks.map((m) => [markKey(m.studentId, m.componentId), m]),
    );

    const computed: Array<{
      studentId: string;
      sectionId: string;
      gradeId: string;
      total: number;
      max: number;
      percent: number;
      status: string;
      grade: string | null;
      point: number | null;
      grace: number;
      remarks: string | null;
      subjects: Array<{
        subjectId: string;
        obtained: number;
        max: number;
        percent: number;
        grade: string | null;
        status: string;
        grace: number;
      }>;
    }> = [];

    for (const en of enrollments) {
      const gradeSubjects = exam.subjects.filter(
        (s) => s.gradeId === en.section.gradeId,
      );
      if (!gradeSubjects.length) continue;
      let total = 0;
      let max = 0;
      let failed = 0;
      let allAbsent = true;
      let missing = false;
      let graceUsed = 0;
      const subjects: (typeof computed)[number]['subjects'] = [];
      for (const sub of gradeSubjects) {
        let obtained = 0;
        let subMax = 0;
        let theoryObt = 0;
        let presentAny = false;
        const weightSum = sub.components.reduce(
          (s, c) => s + n(c.weightage),
          0,
        );
        const useWeight =
          weightSum > 0 &&
          sub.components.some((c) => Math.abs(n(c.weightage) - 100) > 0.001);
        for (const comp of sub.components) {
          const cap = useWeight ? n(comp.weightage) : n(comp.maxMarks);
          subMax += cap;
          const m = markMap.get(markKey(en.studentId, comp.id));
          if (!m) {
            missing = true;
            continue;
          }
          if (m.status === 'PRESENT') {
            allAbsent = false;
            presentAny = true;
            const raw = n(m.marks);
            const contrib =
              useWeight && n(comp.maxMarks) > 0
                ? (raw / n(comp.maxMarks)) * n(comp.weightage)
                : raw;
            obtained += contrib;
            if (comp.code === 'THEORY') theoryObt += raw;
          } else if (
            [
              'ABSENT',
              'NOT_APPEARED',
              'MEDICAL',
              'EXEMPTED',
              'WITHHELD',
            ].includes(m.status)
          ) {
            if (m.status !== 'ABSENT' && m.status !== 'NOT_APPEARED')
              allAbsent = false;
          }
        }
        const pct = subMax > 0 ? (obtained / subMax) * 100 : 0;
        let subStatus = 'PASS';
        let subGrace = 0;
        const need = n(sub.passTotal);
        if (!presentAny && missing) subStatus = 'INCOMPLETE';
        else if (!presentAny) subStatus = 'ABSENT';
        else if (
          settings.requireTheoryPass &&
          sub.requireTheoryPass &&
          theoryObt < n(sub.theoryPass)
        ) {
          subStatus = 'FAIL';
        } else if (obtained < need) {
          const gap = need - obtained;
          if (settings.graceEnabled && graceUsed + gap <= settings.graceMax) {
            subGrace = gap;
            graceUsed += gap;
            obtained += gap;
            subStatus = 'PASS';
          } else subStatus = 'FAIL';
        }
        if (subStatus === 'FAIL') failed += 1;
        const g = this.pickGrade(pct, gradeSystem?.bands ?? []);
        subjects.push({
          subjectId: sub.subjectId,
          obtained,
          max: subMax || n(sub.maxTotal),
          percent: roundValue(pct, settings.decimalPlaces, settings.rounding),
          grade: g?.code ?? null,
          status: subStatus,
          grace: subGrace,
        });
        total += obtained;
        max += subMax || n(sub.maxTotal);
      }
      const percent = max > 0 ? (total / max) * 100 : 0;
      let status = 'PASS';
      if (allAbsent) status = 'ABSENT';
      else if (missing) status = 'INCOMPLETE';
      else if (percent < settings.passPercent) {
        const gapPct = settings.passPercent - percent;
        const gapMarks = (gapPct / 100) * max;
        if (
          settings.graceEnabled &&
          graceUsed + gapMarks <= settings.graceMax
        ) {
          graceUsed += gapMarks;
          total += gapMarks;
          status = 'PASS';
        } else status = 'FAIL';
      }
      if (status === 'PASS' && settings.requirePassEverySubject && failed > 0)
        status = 'FAIL';
      if (status === 'PASS' && failed > settings.maxFailedSubjects)
        status = 'FAIL';
      const g = this.pickGrade(
        roundValue(
          max > 0 ? (total / max) * 100 : 0,
          settings.decimalPlaces,
          settings.rounding,
        ),
        gradeSystem?.bands ?? [],
      );
      const bands = (await this.getSettings(tenantId)).remarkBands as Array<{
        min: number;
        max: number;
        text: string;
      }>;
      const remark = Array.isArray(bands)
        ? (bands.find((b) => percent >= b.min && percent <= b.max)?.text ??
          null)
        : null;
      computed.push({
        studentId: en.studentId,
        sectionId: en.sectionId,
        gradeId: en.section.gradeId,
        total,
        max,
        percent: roundValue(
          max > 0 ? (total / max) * 100 : 0,
          settings.decimalPlaces,
          settings.rounding,
        ),
        status,
        grade: g?.code ?? null,
        point: g ? n(g.gradePoint) : null,
        grace: graceUsed,
        remarks: remark,
        subjects,
      });
    }

    if (settings.rankingEnabled) {
      const tie = settings.rankingTie;
      const assign = (
        list: typeof computed,
        key: 'rankSection' | 'rankClass',
      ) => {
        const sorted = [...list].sort((a, b) => b.percent - a.percent);
        let lastPct = -1;
        let lastRank = 0;
        let index = 0;
        for (const row of sorted) {
          index += 1;
          let rank = index;
          if (row.percent === lastPct) {
            rank = lastRank;
            if (tie === 'STANDARD') rank = lastRank;
            if (tie === 'DENSE') rank = lastRank;
            if (tie === 'COMPETITION') rank = lastRank;
          } else if (tie === 'COMPETITION') {
            rank = index;
          } else if (tie === 'DENSE') {
            rank = lastRank ? lastRank + 1 : 1;
          }
          lastPct = row.percent;
          lastRank = rank;
          (row as any)[key] = rank;
        }
      };
      const bySection = new Map<string, typeof computed>();
      for (const row of computed) {
        const arr = bySection.get(row.sectionId) ?? [];
        arr.push(row);
        bySection.set(row.sectionId, arr);
      }
      if (
        settings.rankingMethod === 'SECTION' ||
        settings.rankingMethod === 'COMBINED'
      ) {
        for (const arr of bySection.values()) assign(arr, 'rankSection');
      }
      const byClass = new Map<string, typeof computed>();
      for (const row of computed) {
        const arr = byClass.get(row.gradeId) ?? [];
        arr.push(row);
        byClass.set(row.gradeId, arr);
      }
      if (
        settings.rankingMethod === 'CLASS' ||
        settings.rankingMethod === 'COMBINED'
      ) {
        for (const arr of byClass.values()) assign(arr, 'rankClass');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.schoolExamResult.deleteMany({
        where: {
          examId: exam.id,
          ...(dto.sectionId
            ? { studentId: { in: enrollments.map((e) => e.studentId) } }
            : {}),
        },
      });
      for (const row of computed) {
        const created = await tx.schoolExamResult.create({
          data: {
            tenantId,
            examId: exam.id,
            studentId: row.studentId,
            totalObtained: row.total,
            totalMax: row.max,
            percent: row.percent,
            grade: row.grade,
            gradePoint: row.point,
            status: row.status,
            rankSection: (row as any).rankSection ?? null,
            rankClass: (row as any).rankClass ?? null,
            graceApplied: row.grace,
            remarks: row.remarks,
            snapshot: settings as unknown as Prisma.InputJsonValue,
          },
        });
        for (const s of row.subjects) {
          await tx.schoolExamResultSubject.create({
            data: {
              tenantId,
              resultId: created.id,
              subjectId: s.subjectId,
              obtained: s.obtained,
              max: s.max,
              percent: s.percent,
              grade: s.grade,
              status: s.status,
              graceApplied: s.grace,
            },
          });
        }
      }
      await tx.schoolExam.update({
        where: { id: exam.id },
        data: { status: exam.status === 'DRAFT' ? 'COMPLETED' : exam.status },
      });
    });
    await this.audit(tenantId, actor, 'RESULTS_GENERATED', exam.id, null, {
      count: computed.length,
    });
    return { count: computed.length };
  }

  async publish(
    tenantId: string,
    dto: PublishResultDto,
    actor: ExamActor,
    publish: boolean,
  ) {
    if (!actor.manage) throw new ForbiddenException('Not allowed');
    const exam = await this.prisma.schoolExam.findFirst({
      where: { id: dto.examId, tenantId },
    });
    if (!exam) throw new NotFoundException('Examination not found');
    const count = await this.prisma.schoolExamResult.count({
      where: { examId: exam.id },
    });
    if (publish && count === 0) {
      throw new BadRequestException(
        'Please complete marks entry and generate results before publishing.',
      );
    }
    await this.prisma.schoolExam.update({
      where: { id: exam.id },
      data: {
        status: publish ? 'PUBLISHED' : 'COMPLETED',
        publishedAt: publish ? new Date() : null,
      },
    });
    await this.audit(
      tenantId,
      actor,
      publish ? 'RESULTS_PUBLISHED' : 'RESULTS_UNPUBLISHED',
      exam.id,
      null,
      null,
      dto.reason,
    );
    return { ok: true };
  }

  async listResults(tenantId: string, examId: string, sectionId?: string) {
    const exam = await this.prisma.schoolExam.findFirst({
      where: { id: examId, tenantId },
    });
    if (!exam) throw new NotFoundException('Examination not found');
    const year = await this.year(tenantId);
    const rows = await this.prisma.schoolExamResult.findMany({
      where: { examId, tenantId },
      include: {
        student: {
          include: {
            enrollments: {
              where: { academicYearId: year.id },
              include: { section: { include: { grade: true } } },
              take: 1,
            },
          },
        },
        subjects: { include: { subject: true } },
      },
      orderBy: { percent: 'desc' },
    });
    const filtered = sectionId
      ? rows.filter((r) => r.student.enrollments[0]?.sectionId === sectionId)
      : rows;
    const settings = await this.getSettings(tenantId);
    return {
      exam,
      rankingEnabled: settings.rankingEnabled,
      summary: {
        students: filtered.length,
        passed: filtered.filter((r) => r.status === 'PASS').length,
        failed: filtered.filter((r) => r.status === 'FAIL').length,
        absent: filtered.filter((r) => r.status === 'ABSENT').length,
        withheld: filtered.filter((r) => r.status === 'WITHHELD').length,
      },
      rows: filtered,
    };
  }

  async reportCard(
    tenantId: string,
    examId: string,
    studentId: string,
    actor: ExamActor,
  ) {
    const exam = await this.prisma.schoolExam.findFirst({
      where: { id: examId, tenantId },
      include: { type: true, academicYear: true },
    });
    if (!exam) throw new NotFoundException('Examination not found');
    if (exam.status !== 'PUBLISHED' && !actor.manage) {
      throw new ForbiddenException('Result is not published');
    }
    const result = await this.prisma.schoolExamResult.findUnique({
      where: { examId_studentId: { examId, studentId } },
      include: {
        student: true,
        subjects: { include: { subject: true } },
      },
    });
    if (!result) throw new NotFoundException('Result not found');
    const settings = await this.getSettings(tenantId);
    return { exam, result, settings };
  }

  async reports(tenantId: string, examId: string) {
    const data = await this.listResults(tenantId, examId);
    const bySubject = new Map<
      string,
      { name: string; scores: number[]; pass: number; fail: number }
    >();
    for (const row of data.rows) {
      for (const s of row.subjects) {
        const cur = bySubject.get(s.subjectId) ?? {
          name: s.subject.name,
          scores: [] as number[],
          pass: 0,
          fail: 0,
        };
        cur.scores.push(n(s.obtained));
        if (s.status === 'PASS') cur.pass += 1;
        if (s.status === 'FAIL') cur.fail += 1;
        bySubject.set(s.subjectId, cur);
      }
    }
    const subjects = [...bySubject.values()].map((s) => ({
      name: s.name,
      appeared: s.scores.length,
      highest: s.scores.length ? Math.max(...s.scores) : 0,
      lowest: s.scores.length ? Math.min(...s.scores) : 0,
      average: s.scores.length
        ? s.scores.reduce((a, b) => a + b, 0) / s.scores.length
        : 0,
      pass: s.pass,
      fail: s.fail,
      passPercent: s.scores.length ? (s.pass / s.scores.length) * 100 : 0,
    }));
    const grades = new Map<string, number>();
    for (const r of data.rows) {
      const g = r.grade || 'NA';
      grades.set(g, (grades.get(g) ?? 0) + 1);
    }
    return {
      summary: data.summary,
      passPercent:
        data.summary.students > 0
          ? (data.summary.passed / data.summary.students) * 100
          : 0,
      subjects,
      gradeDistribution: [...grades.entries()].map(([grade, count]) => ({
        grade,
        count,
      })),
      top: data.rankingEnabled ? data.rows.slice(0, 10) : [],
      pending: await this.prisma.schoolExamMark.groupBy({
        by: ['componentId'],
        where: { tenantId, examId, entryStatus: 'DRAFT' },
        _count: true,
      }),
    };
  }

  async listSchedules(tenantId: string, examId?: string) {
    await this.ensureSetup(tenantId);
    const year = await this.year(tenantId);
    return this.prisma.schoolExamSchedule.findMany({
      where: {
        tenantId,
        ...(examId ? { examId } : {}),
        exam: { academicYearId: year.id, deletedAt: null },
      },
      include: {
        exam: { include: { type: true } },
        section: { include: { grade: true } },
        subject: true,
        invigilators: { include: { staff: true } },
      },
      orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
    });
  }

  async studentPublished(tenantId: string, studentId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolExamResult.findMany({
      where: {
        tenantId,
        studentId,
        exam: { status: 'PUBLISHED', deletedAt: null },
      },
      include: {
        exam: { include: { type: true, academicYear: true } },
        subjects: { include: { subject: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
