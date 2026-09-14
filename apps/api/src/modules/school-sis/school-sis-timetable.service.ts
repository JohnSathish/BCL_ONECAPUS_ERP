import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import type {
  BulkSchoolTimetableSlotsDto,
  CopySchoolTimetableDto,
  MoveSchoolTimetableSlotDto,
  SaveSchoolTimetableBellsDto,
  SaveSchoolTimetableSlotDto,
} from './dto/school-sis.dto';
import {
  SCHOOL_WEEK_DAYS,
  ST_LUKES_BELLS,
  dayName,
  istNowParts,
  printedRange,
  toMinutes,
} from './school-sis-timetable-bells';
import { schoolTimetablePrintHtml } from './school-sis-timetable-print';

const DEFAULT_DAYS = [...SCHOOL_WEEK_DAYS];

const slotInclude = {
  subject: { select: { id: true, name: true, code: true, active: true } },
  staff: {
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      status: true,
      designation: true,
    },
  },
  section: {
    select: {
      id: true,
      name: true,
      grade: { select: { id: true, name: true, code: true } },
    },
  },
  bell: true,
} satisfies Prisma.SchoolTimetableSlotInclude;

@Injectable()
export class SchoolSisTimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
  ) {}

  private async year(tenantId: string, academicYearId?: string) {
    if (academicYearId) {
      const row = await this.prisma.schoolAcademicYear.findFirst({
        where: { id: academicYearId, tenantId, deletedAt: null },
      });
      if (!row) throw new NotFoundException('Academic year not found');
      return row;
    }
    return this.sis.currentYear(tenantId);
  }

  async ensureSetup(tenantId: string, academicYearId?: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.year(tenantId, academicYearId);
    const existingBells = await this.prisma.schoolTimetableBell.count({
      where: { tenantId, academicYearId: year.id },
    });
    if (!existingBells) {
      await this.prisma.schoolTimetableBell.createMany({
        data: ST_LUKES_BELLS.map((bell) => ({
          tenantId,
          academicYearId: year.id,
          ...bell,
        })),
      });
    } else {
      await this.prisma.schoolTimetableBell.updateMany({
        where: {
          tenantId,
          academicYearId: year.id,
          code: 'R1',
          kind: 'BREAK',
          label: { contains: 'Recess', mode: 'insensitive' },
        },
        data: { label: 'Short Break' },
      });
      await this.prisma.schoolTimetableBell.updateMany({
        where: {
          tenantId,
          academicYearId: year.id,
          code: 'R2',
          kind: 'BREAK',
          label: { contains: 'Recess', mode: 'insensitive' },
        },
        data: { label: 'Lunch/Break' },
      });
    }
    let plan = await this.prisma.schoolTimetablePlan.findFirst({
      where: { tenantId, academicYearId: year.id },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
    if (!plan) {
      plan = await this.prisma.schoolTimetablePlan.create({
        data: {
          tenantId,
          academicYearId: year.id,
          name: `${year.name} timetable`,
          status: 'DRAFT',
          daysJson: DEFAULT_DAYS,
        },
      });
    }
    const [bells, rooms] = await Promise.all([
      this.prisma.schoolTimetableBell.findMany({
        where: { tenantId, academicYearId: year.id },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolRoom.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      academicYear: year,
      plan,
      bells,
      rooms,
      days: asDays(plan.daysJson),
    };
  }

  async saveBells(tenantId: string, dto: SaveSchoolTimetableBellsDto) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.year(tenantId, dto.academicYearId);
    if (!dto.bells.length)
      throw new BadRequestException('At least one period or break is required');
    const codes = dto.bells.map((b) => b.code.trim().toUpperCase());
    if (new Set(codes).size !== codes.length)
      throw new BadRequestException('Bell codes must be unique');
    const existing = await this.prisma.schoolTimetableBell.findMany({
      where: { tenantId, academicYearId: year.id },
    });
    const keepIds = dto.bells.map((b) => b.id).filter(Boolean) as string[];
    const toDelete = existing.filter((row) => !keepIds.includes(row.id));
    if (toDelete.length) {
      const used = await this.prisma.schoolTimetableSlot.count({
        where: { tenantId, bellId: { in: toDelete.map((b) => b.id) } },
      });
      if (used) {
        throw new BadRequestException(
          'Cannot remove a period that already has timetable entries',
        );
      }
    }
    await this.prisma.$transaction(async (tx) => {
      if (toDelete.length) {
        await tx.schoolTimetableBell.deleteMany({
          where: { id: { in: toDelete.map((b) => b.id) } },
        });
      }
      for (const bell of dto.bells) {
        const data = {
          kind: bell.kind,
          code: bell.code.trim().toUpperCase(),
          label: bell.label.trim(),
          startTime: normalizeTime(bell.startTime),
          endTime: normalizeTime(bell.endTime),
          sortOrder: bell.sortOrder,
          periodNumber:
            bell.kind === 'PERIOD' ? (bell.periodNumber ?? null) : null,
        };
        if (bell.id) {
          await tx.schoolTimetableBell.update({
            where: { id: bell.id },
            data,
          });
        } else {
          await tx.schoolTimetableBell.create({
            data: { tenantId, academicYearId: year.id, ...data },
          });
        }
      }
      if (dto.days) {
        const plan = await tx.schoolTimetablePlan.findFirst({
          where: { tenantId, academicYearId: year.id },
        });
        if (plan) {
          await tx.schoolTimetablePlan.update({
            where: { id: plan.id },
            data: { daysJson: dto.days },
          });
        }
      }
    });
    return this.ensureSetup(tenantId, year.id);
  }

  async listRooms(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    return this.prisma.schoolRoom.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createRoom(tenantId: string, name: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Room name is required');
    try {
      return await this.prisma.schoolRoom.create({
        data: { tenantId, name: trimmed },
      });
    } catch {
      throw new ConflictException('A room with this name already exists');
    }
  }

  async deleteRoom(tenantId: string, id: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.prisma.schoolRoom.updateMany({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  async classGrid(tenantId: string, sectionId: string, publishedOnly: boolean) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const section = await this.prisma.schoolSection.findFirst({
      where: { id: sectionId, tenantId, deletedAt: null },
      include: { grade: true, academicYear: true },
    });
    if (!section) throw new NotFoundException('Section not found');
    const setup = await this.ensureSetup(tenantId, section.academicYearId);
    const plan = publishedOnly
      ? await this.prisma.schoolTimetablePlan.findFirst({
          where: {
            tenantId,
            academicYearId: section.academicYearId,
            status: 'PUBLISHED',
          },
          orderBy: { updatedAt: 'desc' },
        })
      : setup.plan;
    if (publishedOnly && !plan) {
      return { ...setup, plan: null, section, slots: [], days: setup.days };
    }
    const activePlan = plan ?? setup.plan;
    const slots = await this.prisma.schoolTimetableSlot.findMany({
      where: { tenantId, planId: activePlan.id, sectionId: section.id },
      include: slotInclude,
    });
    return {
      academicYear: setup.academicYear,
      plan: activePlan,
      bells: setup.bells,
      rooms: setup.rooms,
      days: asDays(activePlan.daysJson),
      section,
      slots,
    };
  }

  async teacherGrid(tenantId: string, staffId: string, publishedOnly: boolean) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const staff = await this.prisma.schoolStaff.findFirst({
      where: { id: staffId, tenantId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    const setup = await this.ensureSetup(tenantId);
    const plan = publishedOnly
      ? await this.prisma.schoolTimetablePlan.findFirst({
          where: {
            tenantId,
            academicYearId: setup.academicYear.id,
            status: 'PUBLISHED',
          },
        })
      : setup.plan;
    if (!plan) return { ...setup, staff, slots: [] };
    const slots = await this.prisma.schoolTimetableSlot.findMany({
      where: { tenantId, planId: plan.id, staffId: staff.id },
      include: slotInclude,
      orderBy: [{ dayOfWeek: 'asc' }],
    });
    return { ...setup, plan, staff, slots, days: asDays(plan.daysJson) };
  }

  async studentGrid(tenantId: string, studentId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const enrollment = await this.prisma.schoolEnrollment.findFirst({
      where: { tenantId, studentId, academicYearId: year.id, deletedAt: null },
      include: { section: { include: { grade: true } }, student: true },
    });
    if (!enrollment)
      throw new NotFoundException(
        'No enrollment for the current academic year',
      );
    const grid = await this.classGrid(tenantId, enrollment.sectionId, false);
    return {
      ...grid,
      student: {
        id: enrollment.student.id,
        fullName: enrollment.student.fullName,
      },
    };
  }

  async master(
    tenantId: string,
    filters: {
      dayOfWeek?: number;
      sectionId?: string;
      staffId?: string;
      room?: string;
    },
  ) {
    const setup = await this.ensureSetup(tenantId);
    const slots = await this.prisma.schoolTimetableSlot.findMany({
      where: {
        tenantId,
        planId: setup.plan.id,
        ...(filters.dayOfWeek ? { dayOfWeek: filters.dayOfWeek } : {}),
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
        ...(filters.staffId ? { staffId: filters.staffId } : {}),
        ...(filters.room ? { roomLabel: filters.room } : {}),
      },
      include: slotInclude,
      take: 2000,
    });
    return { ...setup, slots };
  }

  async upsertSlot(tenantId: string, dto: SaveSchoolTimetableSlotDto) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const setup = await this.ensureSetup(tenantId);
    const plan = dto.planId
      ? await this.prisma.schoolTimetablePlan.findFirst({
          where: { id: dto.planId, tenantId },
        })
      : setup.plan;
    if (!plan) throw new NotFoundException('Timetable plan not found');
    const bell = await this.prisma.schoolTimetableBell.findFirst({
      where: { id: dto.bellId, tenantId },
    });
    if (!bell) throw new NotFoundException('Period not found');
    if (bell.kind === 'BREAK')
      throw new BadRequestException('Breaks cannot have a subject or teacher');
    const section = await this.prisma.schoolSection.findFirst({
      where: { id: dto.sectionId, tenantId, deletedAt: null },
    });
    if (!section) throw new NotFoundException('Section not found');
    if (!asDays(plan.daysJson).includes(dto.dayOfWeek)) {
      throw new BadRequestException(
        'That day is not a school day in this timetable',
      );
    }
    const subjectId = dto.subjectId || null;
    const staffId = dto.staffId || null;
    const roomLabel = dto.roomLabel?.trim() || null;
    const printedSubject = dto.printedSubject?.trim() || null;
    const printedTeacher = dto.printedTeacher?.trim() || null;
    const needsConfirmation = Boolean(dto.needsConfirmation);
    if (subjectId) {
      const subject = await this.prisma.schoolSubject.findFirst({
        where: { id: subjectId, tenantId, deletedAt: null },
      });
      if (!subject) throw new NotFoundException('Subject not found');
      if (!subject.active)
        throw new BadRequestException('This subject is inactive');
    }
    if (staffId) {
      const staff = await this.prisma.schoolStaff.findFirst({
        where: { id: staffId, tenantId, deletedAt: null },
      });
      if (!staff) throw new NotFoundException('Teacher not found');
      if (staff.status !== 'ACTIVE')
        throw new BadRequestException('This teacher is not active');
    }
    await this.assertNoConflicts({
      tenantId,
      planId: plan.id,
      sectionId: section.id,
      bellId: bell.id,
      dayOfWeek: dto.dayOfWeek,
      staffId,
      roomLabel,
      allowOverride: Boolean(dto.allowOverride),
    });
    if (
      !subjectId &&
      !staffId &&
      !roomLabel &&
      !dto.notes &&
      !printedSubject &&
      !printedTeacher
    ) {
      await this.prisma.schoolTimetableSlot.deleteMany({
        where: {
          planId: plan.id,
          sectionId: section.id,
          bellId: bell.id,
          dayOfWeek: dto.dayOfWeek,
        },
      });
      return { cleared: true };
    }
    return this.prisma.schoolTimetableSlot.upsert({
      where: {
        planId_sectionId_bellId_dayOfWeek: {
          planId: plan.id,
          sectionId: section.id,
          bellId: bell.id,
          dayOfWeek: dto.dayOfWeek,
        },
      },
      update: {
        subjectId,
        staffId,
        roomLabel,
        notes: dto.notes?.trim() || null,
        printedSubject,
        printedTeacher,
        needsConfirmation,
      },
      create: {
        tenantId,
        planId: plan.id,
        sectionId: section.id,
        bellId: bell.id,
        dayOfWeek: dto.dayOfWeek,
        subjectId,
        staffId,
        roomLabel,
        notes: dto.notes?.trim() || null,
        printedSubject,
        printedTeacher,
        needsConfirmation,
      },
      include: slotInclude,
    });
  }

  async moveSlot(tenantId: string, dto: MoveSchoolTimetableSlotDto) {
    const slot = await this.prisma.schoolTimetableSlot.findFirst({
      where: { id: dto.slotId, tenantId },
    });
    if (!slot) throw new NotFoundException('Timetable entry not found');
    const target = await this.prisma.schoolTimetableSlot.findFirst({
      where: {
        planId: slot.planId,
        sectionId: slot.sectionId,
        bellId: dto.bellId,
        dayOfWeek: dto.dayOfWeek,
      },
    });
    if (target && target.id !== slot.id) {
      throw new ConflictException(
        'That period already has a lesson. Clear it first.',
      );
    }
    await this.assertNoConflicts({
      tenantId,
      planId: slot.planId,
      sectionId: slot.sectionId,
      bellId: dto.bellId,
      dayOfWeek: dto.dayOfWeek,
      staffId: slot.staffId,
      roomLabel: slot.roomLabel,
      allowOverride: Boolean(dto.allowOverride),
      ignoreSlotId: slot.id,
    });
    return this.prisma.schoolTimetableSlot.update({
      where: { id: slot.id },
      data: { bellId: dto.bellId, dayOfWeek: dto.dayOfWeek },
      include: slotInclude,
    });
  }

  async copySection(tenantId: string, dto: CopySchoolTimetableDto) {
    return this.copy(tenantId, { ...dto, mode: dto.mode || 'SECTION' });
  }

  async copy(tenantId: string, dto: CopySchoolTimetableDto) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const mode = dto.mode || 'SECTION';
    if (mode === 'YEAR') return this.copyYear(tenantId, dto);
    const setup = await this.ensureSetup(tenantId);
    const plan = dto.planId
      ? await this.prisma.schoolTimetablePlan.findFirst({
          where: { id: dto.planId, tenantId },
        })
      : setup.plan;
    if (!plan) throw new NotFoundException('Timetable plan not found');

    if (mode === 'DAY') {
      if (!dto.fromSectionId || dto.fromDay == null || dto.toDay == null) {
        throw new BadRequestException(
          'fromSectionId, fromDay and toDay are required',
        );
      }
      if (dto.fromDay === dto.toDay)
        throw new BadRequestException('Choose a different destination day');
      const source = await this.prisma.schoolTimetableSlot.findMany({
        where: {
          tenantId,
          planId: plan.id,
          sectionId: dto.fromSectionId,
          dayOfWeek: dto.fromDay,
        },
      });
      await this.prisma.$transaction(async (tx) => {
        await tx.schoolTimetableSlot.deleteMany({
          where: {
            tenantId,
            planId: plan.id,
            sectionId: dto.fromSectionId,
            dayOfWeek: dto.toDay,
          },
        });
        if (source.length) {
          await tx.schoolTimetableSlot.createMany({
            data: source.map((row) => ({
              tenantId,
              planId: plan.id,
              sectionId: dto.fromSectionId!,
              bellId: row.bellId,
              dayOfWeek: dto.toDay!,
              subjectId: row.subjectId,
              staffId: row.staffId,
              roomLabel: row.roomLabel,
              notes: row.notes,
              printedSubject: row.printedSubject,
              printedTeacher: row.printedTeacher,
              needsConfirmation: row.needsConfirmation,
            })),
          });
        }
      });
      return this.classGrid(tenantId, dto.fromSectionId, false);
    }

    if (mode === 'WEEK') {
      if (!dto.fromSectionId || !dto.toSectionId) {
        throw new BadRequestException(
          'fromSectionId and toSectionId are required',
        );
      }
      return this.copyClassWeek(
        tenantId,
        plan.id,
        dto.fromSectionId,
        dto.toSectionId,
      );
    }

    if (!dto.fromSectionId || !dto.toSectionId) {
      throw new BadRequestException(
        'fromSectionId and toSectionId are required',
      );
    }
    return this.copyClassWeek(
      tenantId,
      plan.id,
      dto.fromSectionId,
      dto.toSectionId,
    );
  }

  private async copyClassWeek(
    tenantId: string,
    planId: string,
    fromSectionId: string,
    toSectionId: string,
  ) {
    if (fromSectionId === toSectionId)
      throw new BadRequestException('Choose a different destination class');
    const [from, to] = await Promise.all([
      this.prisma.schoolSection.findFirst({
        where: { id: fromSectionId, tenantId, deletedAt: null },
      }),
      this.prisma.schoolSection.findFirst({
        where: { id: toSectionId, tenantId, deletedAt: null },
      }),
    ]);
    if (!from || !to) throw new NotFoundException('Section not found');
    const source = await this.prisma.schoolTimetableSlot.findMany({
      where: { tenantId, planId, sectionId: from.id },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.schoolTimetableSlot.deleteMany({
        where: { tenantId, planId, sectionId: to.id },
      });
      if (source.length) {
        await tx.schoolTimetableSlot.createMany({
          data: source.map((row) => ({
            tenantId,
            planId,
            sectionId: to.id,
            bellId: row.bellId,
            dayOfWeek: row.dayOfWeek,
            subjectId: row.subjectId,
            staffId: row.staffId,
            roomLabel: row.roomLabel,
            notes: row.notes,
            printedSubject: row.printedSubject,
            printedTeacher: row.printedTeacher,
            needsConfirmation: row.needsConfirmation,
          })),
        });
      }
    });
    return this.classGrid(tenantId, to.id, false);
  }

  async copyYear(tenantId: string, dto: CopySchoolTimetableDto) {
    if (!dto.fromYearId || !dto.toYearId) {
      throw new BadRequestException('fromYearId and toYearId are required');
    }
    if (dto.fromYearId === dto.toYearId) {
      throw new BadRequestException(
        'Choose a different destination academic year',
      );
    }
    const sourceSetup = await this.ensureSetup(tenantId, dto.fromYearId);
    const destSetup = await this.ensureSetup(tenantId, dto.toYearId);
    const destCount = await this.prisma.schoolTimetableSlot.count({
      where: { tenantId, planId: destSetup.plan.id },
    });
    if (destCount && !dto.replaceDest) {
      throw new BadRequestException(
        'The destination year already has a timetable. Historical years are never overwritten unless you confirm replace.',
      );
    }
    const sourceSlots = await this.prisma.schoolTimetableSlot.findMany({
      where: { tenantId, planId: sourceSetup.plan.id },
      include: { section: { include: { grade: true } }, bell: true },
    });
    const destSections = await this.prisma.schoolSection.findMany({
      where: {
        tenantId,
        academicYearId: dto.toYearId,
        deletedAt: null,
      },
      include: { grade: true },
    });
    const sectionMap = new Map(
      destSections.map((s) => [`${s.grade.code}:${s.name}`, s.id]),
    );
    const bellMap = new Map(destSetup.bells.map((b) => [b.code, b.id]));
    const rows = sourceSlots
      .map((row) => {
        const sectionId = sectionMap.get(
          `${row.section.grade.code}:${row.section.name}`,
        );
        const bellId = bellMap.get(row.bell.code);
        if (!sectionId || !bellId) return null;
        return {
          tenantId,
          planId: destSetup.plan.id,
          sectionId,
          bellId,
          dayOfWeek: row.dayOfWeek,
          subjectId: row.subjectId,
          staffId: row.staffId,
          roomLabel: row.roomLabel,
          notes: row.notes,
          printedSubject: row.printedSubject,
          printedTeacher: row.printedTeacher,
          needsConfirmation: row.needsConfirmation,
        };
      })
      .filter(Boolean);
    await this.prisma.$transaction(async (tx) => {
      if (dto.replaceDest) {
        await tx.schoolTimetableSlot.deleteMany({
          where: { tenantId, planId: destSetup.plan.id },
        });
      }
      if (rows.length) {
        await tx.schoolTimetableSlot.createMany({
          data: rows as Prisma.SchoolTimetableSlotCreateManyInput[],
        });
      }
    });
    return {
      copied: rows.length,
      skipped: sourceSlots.length - rows.length,
      sourceYearId: dto.fromYearId,
      destYearId: dto.toYearId,
    };
  }

  async publish(tenantId: string, planId?: string) {
    const setup = await this.ensureSetup(tenantId);
    const plan = planId
      ? await this.prisma.schoolTimetablePlan.findFirst({
          where: { id: planId, tenantId },
        })
      : setup.plan;
    if (!plan) throw new NotFoundException('Timetable plan not found');
    const summary = await this.validate(tenantId, plan.id);
    if (summary.teacherConflicts.length || summary.roomConflicts.length) {
      throw new ConflictException({
        message: 'Cannot publish while teacher or room conflicts remain',
        summary,
      });
    }
    await this.prisma.schoolTimetablePlan.updateMany({
      where: {
        tenantId,
        academicYearId: plan.academicYearId,
        status: 'PUBLISHED',
      },
      data: { status: 'ARCHIVED' },
    });
    const published = await this.prisma.schoolTimetablePlan.update({
      where: { id: plan.id },
      data: { status: 'PUBLISHED' },
    });
    return { plan: published, summary };
  }

  async validate(tenantId: string, planId?: string) {
    const setup = await this.ensureSetup(tenantId);
    const plan = planId
      ? await this.prisma.schoolTimetablePlan.findFirst({
          where: { id: planId, tenantId },
        })
      : setup.plan;
    if (!plan) throw new NotFoundException('Timetable plan not found');
    const slots = await this.prisma.schoolTimetableSlot.findMany({
      where: { tenantId, planId: plan.id },
      include: slotInclude,
    });
    const teacherConflicts: string[] = [];
    const roomConflicts: string[] = [];
    const missingTeachers: string[] = [];
    const missingSubjects: string[] = [];
    const seenTeacher = new Map<string, (typeof slots)[number]>();
    const seenRoom = new Map<string, (typeof slots)[number]>();
    for (const slot of slots) {
      const classLabel = `${slot.section.grade.name} ${slot.section.name}`;
      if (slot.staffId && !slot.subjectId) {
        missingSubjects.push(
          `${classLabel} ${dayName(slot.dayOfWeek)} ${slot.bell.label}`,
        );
      }
      if (slot.subjectId && !slot.staffId) {
        missingTeachers.push(
          `${classLabel} ${dayName(slot.dayOfWeek)} ${slot.bell.label}`,
        );
      }
      if (slot.staffId) {
        const key = `${slot.staffId}:${slot.dayOfWeek}:${slot.bellId}`;
        const other = seenTeacher.get(key);
        if (other && other.sectionId !== slot.sectionId) {
          teacherConflicts.push(
            `${slot.staff?.fullName} is already assigned to ${other.section.grade.name} ${other.section.name} during ${printedRange(slot.bell.startTime, slot.bell.endTime)}.`,
          );
        } else {
          seenTeacher.set(key, slot);
        }
      }
      if (slot.roomLabel) {
        const key = `${slot.roomLabel.toLowerCase()}:${slot.dayOfWeek}:${slot.bellId}`;
        const other = seenRoom.get(key);
        if (other && other.sectionId !== slot.sectionId) {
          roomConflicts.push(
            `${slot.roomLabel} is already used by ${other.section.grade.name} ${other.section.name} during ${slot.bell.label} on ${dayName(slot.dayOfWeek)}.`,
          );
        } else {
          seenRoom.set(key, slot);
        }
      }
    }
    const emptyPeriods: string[] = [];
    const needsConfirmation: string[] = [];
    const sections = await this.prisma.schoolSection.findMany({
      where: { tenantId, academicYearId: plan.academicYearId, deletedAt: null },
      include: { grade: true },
    });
    const periodBells = setup.bells.filter((b) => b.kind === 'PERIOD');
    const filled = new Set(
      slots.map((s) => `${s.sectionId}:${s.dayOfWeek}:${s.bellId}`),
    );
    for (const section of sections) {
      for (const day of asDays(plan.daysJson)) {
        for (const bell of periodBells) {
          if (!filled.has(`${section.id}:${day}:${bell.id}`)) {
            emptyPeriods.push(
              `${section.grade.name} ${section.name} · ${dayName(day)} · ${bell.label}`,
            );
          }
        }
      }
    }
    for (const slot of slots) {
      if (slot.needsConfirmation) {
        needsConfirmation.push(
          `${slot.section.grade.name} ${slot.section.name} · ${dayName(slot.dayOfWeek)} · ${slot.bell.label}`,
        );
      }
    }
    return {
      validEntries: slots.length,
      teacherConflicts,
      roomConflicts,
      missingTeachers,
      missingSubjects,
      emptyPeriods,
      needsConfirmation,
    };
  }

  async bulkUpsert(tenantId: string, dto: BulkSchoolTimetableSlotsDto) {
    const saved = [];
    for (const slot of dto.slots) {
      saved.push(await this.upsertSlot(tenantId, slot));
    }
    return { saved: saved.length };
  }

  async dashboard(tenantId: string) {
    const setup = await this.ensureSetup(tenantId);
    const summary = await this.validate(tenantId, setup.plan.id);
    const today = await this.todayBoard(tenantId);
    return {
      academicYear: setup.academicYear,
      plan: setup.plan,
      bells: setup.bells,
      days: setup.days,
      summary,
      today,
    };
  }

  async todayBoard(
    tenantId: string,
    filters?: { sectionId?: string; staffId?: string; studentId?: string },
  ) {
    const setup = await this.ensureSetup(tenantId);
    const { dayOfWeek, minutes } = istNowParts();
    let sectionId = filters?.sectionId;
    if (filters?.studentId) {
      const grid = await this.studentGrid(tenantId, filters.studentId);
      sectionId = grid.section?.id;
    }
    const slots =
      sectionId || filters?.staffId
        ? await this.prisma.schoolTimetableSlot.findMany({
            where: {
              tenantId,
              planId: setup.plan.id,
              dayOfWeek: dayOfWeek >= 1 && dayOfWeek <= 5 ? dayOfWeek : 1,
              ...(sectionId ? { sectionId } : {}),
              ...(filters?.staffId ? { staffId: filters.staffId } : {}),
            },
            include: slotInclude,
          })
        : [];
    const bells = setup.bells.map((bell) => {
      const start = toMinutes(bell.startTime);
      const end = toMinutes(bell.endTime);
      const state =
        dayOfWeek < 1 || dayOfWeek > 5
          ? 'weekend'
          : minutes >= end
            ? 'completed'
            : minutes >= start && minutes < end
              ? 'current'
              : 'upcoming';
      const slot = slots.find((s) => s.bellId === bell.id) ?? null;
      return { bell, slot, state };
    });
    const current = bells.find((b) => b.state === 'current') ?? null;
    const next = bells.find((b) => b.state === 'upcoming') ?? null;
    return {
      dayOfWeek,
      weekend: dayOfWeek < 1 || dayOfWeek > 5,
      bells,
      current,
      next,
      academicYear: setup.academicYear,
    };
  }

  async myTimetable(tenantId: string, email?: string | null) {
    if (!email) throw new NotFoundException('No staff email on this account');
    const staff = await this.prisma.schoolStaff.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        email: { equals: email, mode: 'insensitive' },
      },
    });
    if (!staff)
      throw new NotFoundException('No teacher record matches this login');
    const grid = await this.teacherGrid(tenantId, staff.id, false);
    const today = await this.todayBoard(tenantId, { staffId: staff.id });
    return { ...grid, today };
  }

  async printHtml(
    tenantId: string,
    filters: { dayOfWeek?: number; sectionId?: string },
  ) {
    const master = await this.master(tenantId, {
      dayOfWeek: filters.dayOfWeek,
      sectionId: filters.sectionId,
    });
    const sections = await this.prisma.schoolSection.findMany({
      where: {
        tenantId,
        academicYearId: master.academicYear.id,
        deletedAt: null,
        ...(filters.sectionId ? { id: filters.sectionId } : {}),
      },
      include: { grade: true },
      orderBy: [{ grade: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
    return schoolTimetablePrintHtml({
      yearName: master.academicYear.name,
      bells: master.bells,
      days: filters.dayOfWeek ? [filters.dayOfWeek] : master.days,
      sections: sections.map((s) => ({
        id: s.id,
        label: `${s.grade.name}${s.name && s.name !== 'A' ? ` ${s.name}` : ''}`,
      })),
      slots: master.slots,
    });
  }

  async printPdf(
    tenantId: string,
    filters: { dayOfWeek?: number; sectionId?: string },
  ) {
    const html = await this.printHtml(tenantId, filters);
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async exportExcel(tenantId: string, dayOfWeek?: number) {
    const ExcelJS = (await import('exceljs')).default;
    const master = await this.master(tenantId, { dayOfWeek });
    const sections = await this.prisma.schoolSection.findMany({
      where: {
        tenantId,
        academicYearId: master.academicYear.id,
        deletedAt: null,
      },
      include: { grade: true },
      orderBy: [{ grade: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
    const wb = new ExcelJS.Workbook();
    const days = dayOfWeek ? [dayOfWeek] : master.days;
    for (const day of days) {
      const sheet = wb.addWorksheet(dayName(day).slice(0, 31));
      sheet.addRow([
        'Class',
        ...master.bells.map(
          (b) => `${b.label} ${printedRange(b.startTime, b.endTime)}`,
        ),
      ]);
      for (const section of sections) {
        sheet.addRow([
          `${section.grade.name} ${section.name}`,
          ...master.bells.map((bell) => {
            if (bell.kind === 'BREAK') return bell.label;
            const slot = master.slots.find(
              (s) =>
                s.sectionId === section.id &&
                s.dayOfWeek === day &&
                s.bellId === bell.id,
            );
            if (!slot) return '';
            const subject = slot.subject?.name || slot.printedSubject || '';
            const teacher = slot.staff?.fullName || slot.printedTeacher || '';
            return [subject, teacher].filter(Boolean).join(' / ');
          }),
        ]);
      }
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private async assertNoConflicts(input: {
    tenantId: string;
    planId: string;
    sectionId: string;
    bellId: string;
    dayOfWeek: number;
    staffId: string | null;
    roomLabel: string | null;
    allowOverride: boolean;
    ignoreSlotId?: string;
  }) {
    if (input.staffId) {
      const clash = await this.prisma.schoolTimetableSlot.findFirst({
        where: {
          tenantId: input.tenantId,
          planId: input.planId,
          staffId: input.staffId,
          dayOfWeek: input.dayOfWeek,
          bellId: input.bellId,
          sectionId: { not: input.sectionId },
          ...(input.ignoreSlotId ? { id: { not: input.ignoreSlotId } } : {}),
        },
        include: {
          section: { include: { grade: true } },
          staff: true,
          bell: true,
        },
      });
      if (clash) {
        const msg = `${clash.staff?.fullName} is already assigned to ${clash.section.grade.name} ${clash.section.name} during ${printedRange(clash.bell.startTime, clash.bell.endTime)}.`;
        if (!input.allowOverride)
          throw new ConflictException({
            code: 'TEACHER_CONFLICT',
            message: msg,
          });
      }
    }
    if (input.roomLabel) {
      const clash = await this.prisma.schoolTimetableSlot.findFirst({
        where: {
          tenantId: input.tenantId,
          planId: input.planId,
          roomLabel: input.roomLabel,
          dayOfWeek: input.dayOfWeek,
          bellId: input.bellId,
          sectionId: { not: input.sectionId },
          ...(input.ignoreSlotId ? { id: { not: input.ignoreSlotId } } : {}),
        },
        include: { section: { include: { grade: true } }, bell: true },
      });
      if (clash) {
        const msg = `${input.roomLabel} is already assigned to ${clash.section.grade.name} ${clash.section.name} during this period.`;
        if (!input.allowOverride)
          throw new ConflictException({ code: 'ROOM_CONFLICT', message: msg });
      }
    }
  }
}

function normalizeTime(value: string) {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new BadRequestException('Use HH:MM times');
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function asDays(raw: unknown): number[] {
  if (Array.isArray(raw) && raw.every((n) => typeof n === 'number'))
    return raw as number[];
  return DEFAULT_DAYS;
}
