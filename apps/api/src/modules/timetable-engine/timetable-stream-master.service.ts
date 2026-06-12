import { Injectable, NotFoundException } from '@nestjs/common';
import { formatShiftTime } from '../../common/utils/shift-scope.util';
import { PrismaService } from '../../database/prisma.service';

type SemesterMode = 'ODD' | 'EVEN';

const FYUGP_SEMESTERS_BY_MODE: Record<SemesterMode, number[]> = {
  ODD: [1, 3, 5],
  EVEN: [2, 4, 6],
};

const STREAM_DEPARTMENT_MAP: Record<string, string[]> = {
  ARTS: [
    'ECONOMICS',
    'EDUCATION',
    'ENGLISH',
    'GARO',
    'GEOGRAPHY',
    'HISTORY',
    'PHILOSOPHY',
    'POLITICAL SCIENCE',
    'SOCIOLOGY',
  ],
  SCIENCE: ['BOTANY', 'CHEMISTRY', 'MATHEMATICS', 'PHYSICS', 'ZOOLOGY'],
  COMMERCE: ['COMMERCE'],
};

const DAY_LABELS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

@Injectable()
export class TimetableStreamMasterService {
  constructor(private readonly prisma: PrismaService) {}

  async masterRoutine(tenantId: string, planId: string) {
    const plan = await this.prisma.timetablePlan.findFirst({
      where: { tenantId, id: planId, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Timetable plan not found');

    const metadata = (plan.metadata ?? {}) as any;
    const semesterMode = this.normalizeSemesterMode(metadata.semesterMode);
    const semesterRows = FYUGP_SEMESTERS_BY_MODE[semesterMode];
    const dbStreams = await this.prisma.academicStream.findMany({
      where: { tenantId, deletedAt: null, isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    const groupCodes = new Set(['ARTS', 'SCIENCE', 'COMMERCE']);
    const requestedStreamCode = this.normalize(
      metadata.streamCode ?? metadata.streamName,
    );
    const targetStreams = requestedStreamCode
      ? dbStreams.filter(
          (stream) =>
            this.normalize(stream.code) === requestedStreamCode ||
            this.streamGroupFromDescription(stream.description) ===
              requestedStreamCode,
        )
      : dbStreams.filter((stream) => groupCodes.has(stream.code.toUpperCase()));

    const [slots, entries] = await Promise.all([
      this.prisma.timetableSlotTemplate.findMany({
        where: { tenantId, planId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.timetablePlanEntry.findMany({
        where: {
          tenantId,
          planId,
          deletedAt: null,
          status: { not: 'CANCELLED' },
          semesterSequence: { in: semesterRows },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
    ]);

    const courseIds = this.unique(entries.map((entry) => entry.courseId));
    const staffIds = this.unique(entries.map((entry) => entry.staffProfileId));
    const classroomIds = this.unique(entries.map((entry) => entry.classroomId));
    const offeringSectionIds = this.unique(
      entries.map((entry) => entry.offeringSectionId),
    );

    const [courses, staff, classrooms, sections] = await Promise.all([
      courseIds.length
        ? this.prisma.course.findMany({
            where: { tenantId, id: { in: courseIds } },
            include: { department: true },
          })
        : [],
      staffIds.length
        ? this.prisma.staffProfile.findMany({
            where: { tenantId, id: { in: staffIds } },
            include: { department: true },
          })
        : [],
      classroomIds.length
        ? this.prisma.classroom.findMany({
            where: { tenantId, id: { in: classroomIds } },
            include: { roomType: true },
          })
        : [],
      offeringSectionIds.length
        ? this.prisma.offeringSection.findMany({
            where: { tenantId, id: { in: offeringSectionIds } },
            include: {
              eligibleStreams: { include: { stream: true } },
              courseOffering: {
                include: {
                  programVersion: {
                    include: {
                      program: { include: { department: true } },
                    },
                  },
                },
              },
            },
          })
        : [],
    ]);

    const courseById = new Map(courses.map((course) => [course.id, course]));
    const staffById = new Map(staff.map((row) => [row.id, row]));
    const classroomById = new Map(classrooms.map((room) => [room.id, room]));
    const sectionById = new Map(
      sections.map((section) => [section.id, section]),
    );
    const effectiveSlots = slots.length
      ? slots
      : this.uniqueSlotsFromEntries(entries);
    const timeBlocks = this.buildTimeBlocks(effectiveSlots);
    const streamPayloads = targetStreams.map((stream) =>
      this.buildStreamPayload({
        streamCode: stream.code,
        streamName: stream.name,
        departmentNames: dbStreams
          .filter(
            (row) =>
              this.streamGroupFromDescription(row.description) ===
              stream.code.toUpperCase(),
          )
          .map((row) => row.name),
        semesterRows,
        timeBlocks,
        entries,
        courseById,
        staffById,
        classroomById,
        sectionById,
      }),
    );

    return {
      plan: {
        id: plan.id,
        name: plan.name,
        status: plan.status,
        approvalState: plan.approvalState,
        shiftId: plan.shiftId,
        academicYearId: plan.academicYearId,
        semesterMode,
        streamCode: requestedStreamCode || 'ALL',
      },
      title:
        requestedStreamCode && requestedStreamCode !== 'ALL'
          ? `${requestedStreamCode} Master Routine`
          : 'FYUGP Consolidated Stream Master Routine',
      semesterMode,
      semesterRows,
      days: [1, 2, 3, 4, 5, 6].map((value) => ({
        value,
        label:
          value === 6 &&
          effectiveSlots.some(
            (slot) => slot.dayOfWeek === 6 && slot.isSaturdayHalfDay,
          )
            ? 'Saturday (Half Day)'
            : DAY_LABELS[value],
      })),
      timeBlocks,
      streams: streamPayloads,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildStreamPayload(args: {
    streamCode: string;
    streamName: string;
    departmentNames: string[];
    semesterRows: number[];
    timeBlocks: ReturnType<TimetableStreamMasterService['buildTimeBlocks']>;
    entries: any[];
    courseById: Map<string, any>;
    staffById: Map<string, any>;
    classroomById: Map<string, any>;
    sectionById: Map<string, any>;
  }) {
    const streamEntries = args.entries.filter((entry) =>
      this.entryMatchesStream(
        entry,
        args.streamCode,
        args.courseById,
        args.sectionById,
      ),
    );

    return {
      code: args.streamCode,
      name: args.streamName,
      departments: args.departmentNames.length
        ? args.departmentNames
        : (STREAM_DEPARTMENT_MAP[args.streamCode] ?? []),
      rows: args.timeBlocks.map((block) => ({
        ...block,
        semesters: args.semesterRows.map((semester) => ({
          semester,
          label: `Sem ${semester}`,
          days: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
            dayOfWeek,
            label: DAY_LABELS[dayOfWeek],
            entries: streamEntries
              .filter(
                (entry) =>
                  entry.semesterSequence === semester &&
                  entry.dayOfWeek === dayOfWeek &&
                  formatShiftTime(entry.startTime) === block.startTime &&
                  formatShiftTime(entry.endTime) === block.endTime,
              )
              .map((entry) =>
                this.toMasterEntry(
                  entry,
                  args.courseById,
                  args.staffById,
                  args.classroomById,
                  args.sectionById,
                ),
              ),
          })),
        })),
      })),
      summary: {
        totalEntries: streamEntries.length,
        combinedEntries: streamEntries.filter((entry) => entry.isCombined)
          .length,
        parallelElectiveEntries: streamEntries.filter((entry) =>
          Boolean((entry.metadata as any)?.parallelGroupId),
        ).length,
      },
    };
  }

  private toMasterEntry(
    entry: any,
    courseById: Map<string, any>,
    staffById: Map<string, any>,
    classroomById: Map<string, any>,
    sectionById: Map<string, any>,
  ) {
    const course = entry.courseId ? courseById.get(entry.courseId) : null;
    const staff = entry.staffProfileId
      ? staffById.get(entry.staffProfileId)
      : null;
    const classroom = entry.classroomId
      ? classroomById.get(entry.classroomId)
      : null;
    const section = entry.offeringSectionId
      ? sectionById.get(entry.offeringSectionId)
      : null;
    const metadata = (entry.metadata ?? {}) as any;

    return {
      id: entry.id,
      periodNo: entry.periodNo,
      courseCode: course?.code ?? metadata.subjectCode ?? null,
      courseTitle: course?.title ?? metadata.subjectName ?? null,
      category: entry.fyugpCategory ?? metadata.paperType ?? null,
      facultyInitial: this.facultyInitial(staff),
      facultyName: staff?.fullName ?? null,
      roomCode: classroom?.code ?? metadata.preferredRoom ?? null,
      roomName: classroom?.name ?? null,
      roomType: classroom?.roomType?.name ?? classroom?.roomType?.code ?? null,
      sectionCode: entry.sectionCode ?? section?.sectionCode ?? null,
      isCombined: entry.isCombined,
      combinedGroupKey:
        entry.combinedGroupKey ?? metadata.combinedGroupId ?? null,
      leadFaculty: metadata.leadFaculty ?? null,
      mergedDepartments: metadata.mergedDepartments ?? [],
      parallelGroupId: metadata.parallelGroupId ?? null,
      slotType: entry.slotType,
      notes: entry.notes,
    };
  }

  private entryMatchesStream(
    entry: any,
    streamCode: string,
    courseById: Map<string, any>,
    sectionById: Map<string, any>,
  ) {
    const section = entry.offeringSectionId
      ? sectionById.get(entry.offeringSectionId)
      : null;
    const explicitStreams =
      section?.eligibleStreams?.map((item: any) =>
        this.normalize(item.stream?.code ?? item.stream?.name),
      ) ?? [];
    if (explicitStreams.includes(streamCode)) return true;

    const course = entry.courseId ? courseById.get(entry.courseId) : null;
    const departmentName = this.normalize(
      course?.department?.name ??
        course?.department?.code ??
        section?.courseOffering?.programVersion?.program?.department?.name ??
        section?.courseOffering?.programVersion?.program?.department?.code,
    );
    return (
      departmentName === streamCode ||
      (STREAM_DEPARTMENT_MAP[streamCode] ?? []).includes(departmentName)
    );
  }

  private streamGroupFromDescription(description?: string | null) {
    const match = String(description ?? '').match(/group:([A-Z]+)/i);
    return match ? match[1].toUpperCase() : null;
  }

  private buildTimeBlocks(slots: any[]) {
    const seen = new Set<string>();
    return slots
      .filter((slot) => {
        const key = `${formatShiftTime(slot.startTime)}:${formatShiftTime(slot.endTime)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .map((slot) => ({
        id: `${formatShiftTime(slot.startTime)}-${formatShiftTime(slot.endTime)}`,
        periodNo: slot.periodNo,
        label: slot.label,
        startTime: formatShiftTime(slot.startTime),
        endTime: formatShiftTime(slot.endTime),
        isBreak: slot.isBreak,
        isLunch: slot.isLunch,
        allowedCategories: Array.isArray(slot.allowedCategories)
          ? slot.allowedCategories
          : [],
      }));
  }

  private uniqueSlotsFromEntries(entries: any[]) {
    const seen = new Set<string>();
    return entries
      .filter((entry) => {
        const key = `${entry.dayOfWeek}:${entry.startTime.toISOString()}:${entry.endTime.toISOString()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((entry) => ({
        id: `entry-${entry.id}`,
        dayOfWeek: entry.dayOfWeek,
        periodNo: entry.periodNo ?? 0,
        label: entry.periodNo ? `P${entry.periodNo}` : 'Slot',
        startTime: entry.startTime,
        endTime: entry.endTime,
        isBreak: false,
        isLunch: false,
        isSaturdayHalfDay: entry.dayOfWeek === 6,
        allowedCategories: [],
      }));
  }

  private facultyInitial(staff?: any) {
    if (!staff) return null;
    if (staff.shortCode) return String(staff.shortCode).toUpperCase();
    const employeeCode = String(staff.employeeCode ?? '').trim();
    if (employeeCode.length <= 4) return employeeCode.toUpperCase();
    return String(staff.fullName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 4)
      .toUpperCase();
  }

  private unique(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.filter(Boolean))) as string[];
  }

  private normalizeSemesterMode(value: unknown): SemesterMode {
    return String(value ?? 'ODD').toUpperCase() === 'EVEN' ? 'EVEN' : 'ODD';
  }

  private normalize(value: unknown) {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  private streamName(code: string) {
    if (code === 'ARTS') return 'Arts';
    if (code === 'SCIENCE') return 'Science';
    if (code === 'COMMERCE') return 'Commerce';
    return code;
  }
}
