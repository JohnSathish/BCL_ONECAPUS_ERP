import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { parseExcelDataSheet } from '../../common/import/excel.util';
import { PrismaService } from '../../database/prisma.service';
import {
  parseTimeToDate,
  formatShiftTime,
} from '../../common/utils/shift-scope.util';
import {
  ARTS_ODD_PAPER_BASKET,
  buildArtsRoutineSampleRows,
} from '../academic-engine/domain/arts-fyugp-odd-catalog';

const ROUTINE_HEADERS = [
  'Stream',
  'Shift',
  'Semester',
  'Day',
  'Period',
  'Subject Code',
  'Faculty Code',
  'Room',
  'Section',
  'Category',
];

const DAY_MAP: Record<string, number> = {
  MON: 1,
  MONDAY: 1,
  TUE: 2,
  TUESDAY: 2,
  WED: 3,
  WEDNESDAY: 3,
  THU: 4,
  THURSDAY: 4,
  FRI: 5,
  FRIDAY: 5,
  SAT: 6,
  SATURDAY: 6,
};

@Injectable()
export class TimetableRoutineExcelService {
  constructor(private readonly prisma: PrismaService) {}

  async routineTemplate(tenantId: string, planId: string) {
    const plan = await this.prisma.timetablePlan.findFirst({
      where: { id: planId, tenantId, deletedAt: null },
    });
    if (!plan) throw new BadRequestException('Timetable plan not found');
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: { tenantId, planId, deletedAt: null },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNo: 'asc' }],
    });
    const [streams, shifts, courses, staff, rooms] = await Promise.all([
      this.prisma.academicStream.findMany({
        where: { tenantId, deletedAt: null, isActive: true },
      }),
      this.prisma.shift.findMany({ where: { tenantId, deletedAt: null } }),
      this.prisma.course.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { code: 'asc' },
      }),
      this.prisma.staffProfile.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        take: 500,
      }),
      this.prisma.classroom.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        take: 300,
      }),
    ]);
    const courseById = new Map(courses.map((c) => [c.id, c]));
    const staffById = new Map(staff.map((s) => [s.id, s]));
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const metadata = (plan.metadata ?? {}) as any;
    const allowedSemesters: number[] = metadata.allowedSemesters ?? [1, 3, 5];
    const shiftName =
      shifts.find((s) => s.id === plan.shiftId)?.name ?? 'Day Shift';
    const streamLabel = metadata.streamCode ?? metadata.streamName ?? 'ARTS';
    const isOddArtsPlan =
      metadata.semesterMode === 'ODD' ||
      (allowedSemesters.length === 3 &&
        allowedSemesters.includes(1) &&
        allowedSemesters.includes(3) &&
        allowedSemesters.includes(5));

    const workbook = new ExcelJS.Workbook();
    this.addInstructionsSheet(workbook, isOddArtsPlan);
    const sheet = workbook.addWorksheet('Routine');
    sheet.addRow(ROUTINE_HEADERS);
    sheet.getRow(1).font = { bold: true };

    if (entries.length) {
      for (const entry of entries) {
        const course = entry.courseId ? courseById.get(entry.courseId) : null;
        const faculty = entry.staffProfileId
          ? staffById.get(entry.staffProfileId)
          : null;
        const room = entry.classroomId ? roomById.get(entry.classroomId) : null;
        sheet.addRow([
          streamLabel,
          shiftName,
          entry.semesterSequence ?? '',
          this.dayLabel(entry.dayOfWeek),
          entry.periodNo ? `P${entry.periodNo}` : '',
          course?.code ?? '',
          faculty?.shortCode ?? faculty?.employeeCode ?? '',
          room?.code ?? '',
          entry.sectionCode ?? '',
          entry.fyugpCategory ?? entry.slotType ?? '',
        ]);
      }
    } else if (isOddArtsPlan) {
      for (const sample of buildArtsRoutineSampleRows(streamLabel, shiftName)) {
        sheet.addRow([
          sample.stream,
          sample.shift,
          sample.semester,
          sample.day,
          sample.period,
          sample.subjectCode,
          '',
          '',
          sample.section,
          sample.category,
        ]);
      }
    }
    this.addLookup(
      workbook,
      'Streams',
      ['Code', 'Name'],
      streams.map((s) => [s.code, s.name]),
    );
    this.addLookup(
      workbook,
      'Shifts',
      ['Name'],
      shifts.map((s) => [s.name]),
    );
    this.addLookup(
      workbook,
      'Courses',
      ['Code', 'Title'],
      courses.map((c) => [c.code, c.title]),
    );
    if (isOddArtsPlan) {
      this.addPaperBasketSheet(workbook);
    }
    this.addLookup(
      workbook,
      'Faculty',
      ['Short Code', 'Name'],
      staff.map((s) => [s.shortCode ?? s.employeeCode ?? '', s.fullName]),
    );
    this.addLookup(
      workbook,
      'Rooms',
      ['Code', 'Name'],
      rooms.map((r) => [r.code, r.name]),
    );
    this.addLookup(
      workbook,
      'Days',
      ['Day'],
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
        (d) => [d],
      ),
    );
    this.addLookup(
      workbook,
      'Periods',
      ['Period'],
      ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'].map((p) => [p]),
    );
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async validateRoutineUpload(
    tenantId: string,
    planId: string,
    buffer: Buffer,
  ) {
    const plan = await this.prisma.timetablePlan.findFirst({
      where: { id: planId, tenantId, deletedAt: null },
    });
    if (!plan) throw new BadRequestException('Timetable plan not found');
    const parsedRows = await parseExcelDataSheet(buffer, 'Routine');
    const rows = parsedRows as Array<Record<string, unknown>>;
    const metadata = (plan.metadata ?? {}) as any;
    const allowedSemesters: number[] = metadata.allowedSemesters ?? [1, 3, 5];
    const [courses, staff, rooms, templates] = await Promise.all([
      this.prisma.course.findMany({ where: { tenantId, deletedAt: null } }),
      this.prisma.staffProfile.findMany({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.classroom.findMany({ where: { tenantId, deletedAt: null } }),
      this.prisma.timetableSlotTemplate.findMany({
        where: { tenantId, planId },
      }),
    ]);
    const courseByCode = new Map(courses.map((c) => [c.code.toUpperCase(), c]));
    const staffByCode = new Map(
      staff.flatMap((s) => {
        const keys = [s.shortCode, s.employeeCode]
          .filter(Boolean)
          .map((k) => String(k).toUpperCase());
        return keys.map((k) => [k, s] as const);
      }),
    );
    const roomByCode = new Map(rooms.map((r) => [r.code.toUpperCase(), r]));
    const results: any[] = [];
    let success = 0;
    let warnings = 0;
    let errors = 0;
    const draftKeys = new Set<string>();
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const issues: { level: string; message: string }[] = [];
      const semester = Number(row['Semester']);
      const day =
        DAY_MAP[
          String(row['Day'] ?? '')
            .trim()
            .toUpperCase()
        ] ?? null;
      const period =
        Number(String(row['Period'] ?? '').replace(/^P/i, '')) || null;
      const course = courseByCode.get(
        String(row['Subject Code'] ?? '')
          .trim()
          .toUpperCase(),
      );
      const faculty = staffByCode.get(
        String(row['Faculty Code'] ?? '')
          .trim()
          .toUpperCase(),
      );
      const room = roomByCode.get(
        String(row['Room'] ?? '')
          .trim()
          .toUpperCase(),
      );
      if (!semester || !allowedSemesters.includes(semester)) {
        issues.push({
          level: 'error',
          message: `Semester ${row['Semester']} not allowed in current mode.`,
        });
      }
      if (!day) issues.push({ level: 'error', message: 'Invalid day.' });
      if (!period) issues.push({ level: 'error', message: 'Invalid period.' });
      if (!course)
        issues.push({ level: 'error', message: 'Subject code not found.' });
      if (row['Faculty Code'] && !faculty)
        issues.push({ level: 'error', message: 'Faculty code not found.' });
      if (row['Room'] && !room)
        issues.push({ level: 'error', message: 'Room not found.' });
      const template = templates.find(
        (t) =>
          t.dayOfWeek === day &&
          t.periodNo === period &&
          !t.isBreak &&
          !t.isLunch,
      );
      if (day && period && !template) {
        issues.push({
          level: 'warning',
          message: 'Period not in slot template for this day.',
        });
      }
      const key = `${day}-${period}-${semester}-${row['Section'] ?? ''}-${course?.id ?? ''}`;
      if (draftKeys.has(key)) {
        issues.push({
          level: 'warning',
          message: 'Duplicate row for same day/period/section/subject.',
        });
      } else {
        draftKeys.add(key);
      }
      const hasError = issues.some((issue) => issue.level === 'error');
      if (hasError) errors += 1;
      else {
        success += 1;
        if (issues.some((issue) => issue.level === 'warning')) warnings += 1;
      }
      results.push({
        rowNo: i + 2,
        ...row,
        issues,
        resolved: {
          courseId: course?.id,
          staffProfileId: faculty?.id,
          classroomId: room?.id,
          dayOfWeek: day,
          periodNo: period,
          semesterSequence: semester,
          startTime: template ? formatShiftTime(template.startTime) : null,
          endTime: template ? formatShiftTime(template.endTime) : null,
          slotTemplateId: template?.id,
        },
      });
    }
    return {
      summary: {
        total: rows.length,
        success,
        warnings,
        errors,
        canCommit: success > 0,
      },
      rows: results,
    };
  }

  async commitRoutineUpload(
    tenantId: string,
    planId: string,
    buffer: Buffer,
    options?: { overrideConflicts?: boolean },
  ) {
    const preview = await this.validateRoutineUpload(tenantId, planId, buffer);
    const plan = await this.prisma.timetablePlan.findFirst({
      where: { id: planId, tenantId, deletedAt: null },
    });
    if (!plan) throw new BadRequestException('Timetable plan not found');
    let committed = 0;
    for (const row of preview.rows) {
      if (row.issues.some((issue: any) => issue.level === 'error')) continue;
      const resolved = row.resolved;
      if (!resolved?.courseId || !resolved.dayOfWeek || !resolved.periodNo)
        continue;
      await this.prisma.timetablePlanEntry.create({
        data: {
          tenantId,
          planId,
          shiftId: plan.shiftId,
          dayOfWeek: resolved.dayOfWeek,
          periodNo: resolved.periodNo,
          startTime: resolved.startTime
            ? parseTimeToDate(resolved.startTime)
            : parseTimeToDate('09:45:00'),
          endTime: resolved.endTime
            ? parseTimeToDate(resolved.endTime)
            : parseTimeToDate('10:30:00'),
          slotTemplateId: resolved.slotTemplateId,
          courseId: resolved.courseId,
          staffProfileId: resolved.staffProfileId,
          classroomId: resolved.classroomId,
          semesterSequence: resolved.semesterSequence,
          sectionCode: row['Section'] ? String(row['Section']) : null,
          fyugpCategory: row['Category']
            ? String(row['Category']).toUpperCase()
            : null,
          slotType: String(row['Category'] ?? 'THEORY')
            .toUpperCase()
            .includes('LAB')
            ? 'LAB'
            : 'THEORY',
          isLocked: true,
          source: 'MANUAL',
          metadata: options?.overrideConflicts
            ? { conflictOverride: true }
            : {},
        },
      });
      committed += 1;
    }
    return { committed, preview: preview.summary };
  }

  async exportRoutine(
    tenantId: string,
    planId: string,
    scope: 'draft' | 'published' | 'faculty' | 'room' = 'draft',
  ) {
    return this.routineTemplate(tenantId, planId);
  }

  private dayLabel(dayOfWeek: number) {
    return (
      ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
        dayOfWeek
      ] ?? ''
    );
  }

  private addLookup(
    workbook: ExcelJS.Workbook,
    name: string,
    headers: string[],
    rows: unknown[][],
  ) {
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
  }

  private addInstructionsSheet(
    workbook: ExcelJS.Workbook,
    isOddArtsPlan: boolean,
  ) {
    const sheet = workbook.addWorksheet('Instructions');
    const lines = [
      'Timetable Routine Import',
      'Fill the Routine sheet only. Other sheets are lookups.',
      'Stream / Shift / Semester / Day / Period / Subject Code are required.',
      'Faculty Code and Room are optional but validated when provided.',
      'Category must match FYUGP role: MAJOR, MINOR, MDC, AEC, SEC, VAC, VTC, INTERNSHIP, LAB.',
      'Day values: Monday, Tuesday, … or MON, TUE, …',
      'Period values: P1 … P7 or numeric 1 … 7',
    ];
    if (isOddArtsPlan) {
      lines.push(
        '',
        'Arts ODD semesters (1, 3, 5): see PaperBasket sheet for the NEHU paper layout.',
        'Sample rows on Routine illustrate Economics-major slots — replace Subject Code, Faculty, and Room.',
        'Sem 1: 6 papers (Major, Minor, MDC, AEC, SEC, VAC).',
        'Sem 3: 6 papers (2× Major, MDC, AEC, SEC, VTC).',
        'Sem 5: 5 papers (3× Major, Minor, Internship).',
      );
    }
    lines.forEach((line) => sheet.addRow([line]));
    sheet.getColumn(1).width = 100;
  }

  private addPaperBasketSheet(workbook: ExcelJS.Workbook) {
    const headers = [
      'Semester',
      'Category',
      'Papers',
      'Credits Each',
      'Code Pattern',
      'Example Code',
      'Example Title',
      'Notes',
    ];
    const sheet = workbook.addWorksheet('PaperBasket');
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    for (const row of ARTS_ODD_PAPER_BASKET) {
      sheet.addRow([
        row.semester,
        row.category,
        row.paperCount,
        row.creditsEach,
        row.codePattern,
        row.exampleCode,
        row.exampleTitle,
        row.notes ?? '',
      ]);
    }
    sheet.columns.forEach((column) => {
      column.width = 18;
    });
  }
}
