import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { parseExcelDataSheet } from '../../common/import/excel.util';
import { PrismaService } from '../../database/prisma.service';
import { TimetableAllocationService } from './timetable-allocation.service';

const ALLOCATION_HEADERS = [
  'Department',
  'Programme',
  'Semester',
  'Paper Code',
  'Paper Name',
  'Section',
  'Shift',
  'Faculty Short Code',
  'Faculty Name',
  'Teaching Role',
  'Allocation %',
  'Weekly Hours',
  'Can Mark Attendance',
  'Can Enter Internal Marks',
  'Can Upload Lesson Plan',
  'Remarks',
  'Offering Section ID',
];

const TEACHING_ROLES = [
  'PRIMARY_FACULTY',
  'CO_FACULTY',
  'LAB_INSTRUCTOR',
  'PRACTICAL_FACULTY',
  'GUEST_FACULTY',
  'TUTOR',
  'MENTOR',
  'EVALUATOR',
  'INTERNSHIP_SUPERVISOR',
];

const YES_NO = ['YES', 'NO'];

@Injectable()
export class TimetableAllocationExcelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocations: TimetableAllocationService,
  ) {}

  async allocationTemplate(
    tenantId: string,
    filters: Record<string, string | undefined>,
  ) {
    const rows = await this.allocations.listRows(tenantId, filters);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Courses');
    sheet.addRow(ALLOCATION_HEADERS);
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) {
      sheet.addRow([
        row.department ?? '',
        row.programme ?? row.programmeName ?? '',
        row.semester ?? '',
        row.subjectCode ?? '',
        row.subjectName ?? '',
        row.sectionCode ?? '',
        row.shift ?? '',
        row.facultyInitial ?? row.staffCode ?? '',
        row.staffName ?? '',
        row.facultyTeam?.[0]?.role ?? 'PRIMARY_FACULTY',
        row.facultyTeam?.[0]?.allocationPercent ?? '',
        row.weeklyHours ?? '',
        'YES',
        row.facultyTeam?.[0]?.isPrimary ? 'YES' : 'NO',
        'YES',
        '',
        row.offeringSectionId,
      ]);
    }
    const staff = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        staffType: { in: ['TEACHING', 'teaching'] },
      },
      include: { department: true, primaryShift: true },
      orderBy: [{ fullName: 'asc' }],
    });
    this.addLookupSheet(
      workbook,
      'Departments',
      ['Department'],
      Array.from(new Set(rows.map((row) => row.department).filter(Boolean)))
        .sort()
        .map((value) => [value]),
    );
    this.addLookupSheet(
      workbook,
      'Programmes',
      ['Programme'],
      Array.from(
        new Set(
          rows.map((row) => row.programme ?? row.programmeName).filter(Boolean),
        ),
      )
        .sort()
        .map((value) => [value]),
    );
    this.addLookupSheet(
      workbook,
      'Papers',
      [
        'Paper Code',
        'Paper Name',
        'Department',
        'Programme',
        'Semester',
        'Section',
        'Shift',
        'Offering Section ID',
      ],
      rows.map((row) => [
        row.subjectCode ?? '',
        row.subjectName ?? '',
        row.department ?? '',
        row.programme ?? row.programmeName ?? '',
        row.semester ?? '',
        row.sectionCode ?? '',
        row.shift ?? '',
        row.offeringSectionId ?? '',
      ]),
    );
    this.addLookupSheet(
      workbook,
      'Sections',
      ['Section'],
      Array.from(new Set(rows.map((row) => row.sectionCode).filter(Boolean)))
        .sort()
        .map((value) => [value]),
    );
    this.addLookupSheet(
      workbook,
      'Shifts',
      ['Shift'],
      Array.from(new Set(rows.map((row) => row.shift).filter(Boolean)))
        .sort()
        .map((value) => [value]),
    );
    this.addLookupSheet(
      workbook,
      'Roles',
      ['Teaching Role'],
      TEACHING_ROLES.map((role) => [role]),
    );
    this.addLookupSheet(
      workbook,
      'YesNo',
      ['Value'],
      YES_NO.map((value) => [value]),
    );
    const staffSheet = workbook.addWorksheet('Faculty Lookup');
    staffSheet.addRow([
      'Faculty Short Code',
      'Employee Code',
      'Faculty Name',
      'Department',
      'Preferred Shift',
    ]);
    staffSheet.getRow(1).font = { bold: true };
    staff.forEach((member) =>
      staffSheet.addRow([
        member.shortCode ?? member.employeeCode,
        member.employeeCode,
        member.fullName,
        member.department?.name ?? '',
        member.primaryShift?.name ?? '',
      ]),
    );
    const roomSheet = workbook.addWorksheet('Room Lookup');
    roomSheet.addRow(['Room Code', 'Room Name', 'Capacity', 'Type']);
    roomSheet.getRow(1).font = { bold: true };
    const rooms = await this.prisma.classroom.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' } as any,
      include: { roomType: true },
      orderBy: [{ code: 'asc' }],
    });
    rooms.forEach((room) =>
      roomSheet.addRow([
        room.code,
        room.name,
        room.capacity,
        room.roomType?.name ?? '',
      ]),
    );
    this.applyTemplateFormatting(workbook, sheet);
    workbook.worksheets.forEach((ws) =>
      ws.columns.forEach((column) => {
        column.width = 22;
      }),
    );
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async validateAllocationUpload(tenantId: string, buffer: Buffer) {
    const parsedRows = await parseExcelDataSheet(buffer, 'Courses');
    const staff = await this.prisma.staffProfile.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, employeeCode: true, shortCode: true, fullName: true },
    });
    type FacultyLookup = (typeof staff)[number];
    const staffEntries: Array<[string, FacultyLookup]> = [];
    for (const member of staff) {
      [member.employeeCode, member.shortCode, member.fullName].forEach(
        (value) => {
          const key = this.key(value);
          if (key) staffEntries.push([key, member]);
        },
      );
    }
    const staffByCode = new Map<string, FacultyLookup>(staffEntries);
    const rooms = await this.prisma.classroom.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' } as any,
      select: { id: true, code: true },
    });
    const roomByCode = new Map(
      rooms.map((room) => [this.key(room.code), room]),
    );
    const allocationRows = await this.allocations.listRows(tenantId, {});
    const sectionByKey = new Map(
      allocationRows.map((item: any) => [
        this.sectionLookupKey({
          paperCode: item.subjectCode,
          programme: item.programme ?? item.programmeName,
          semester: item.semester,
          section: item.sectionCode,
          shift: item.shift,
        }),
        item.offeringSectionId,
      ]),
    );
    const rows = parsedRows.map((row) => {
      const raw = row.raw as Record<string, unknown>;
      const staffCode = this.pickText(raw, [
        'facultyshortcode',
        'faculty short code',
        'facultycode',
        'faculty code',
        'employeeCode',
        'employee code',
      ]);
      const staffCodes = staffCode
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter(Boolean);
      const roomCode = this.text(raw.preferredroom ?? raw['preferred room']);
      const paperCode = this.pickText(raw, [
        'papercode',
        'paper code',
        'subjectcode',
        'subject code',
        'courseCode',
      ]);
      const programme = this.pickText(raw, [
        'programmeCode',
        'programme',
        'program',
      ]);
      const semester = this.pickText(raw, ['semester', 'semesterno']);
      const section = this.pickText(raw, [
        'section',
        'sectionCode',
        'section code',
      ]);
      const shift = this.pickText(raw, ['shift', 'shiftCode', 'shift code']);
      const offeringSectionId =
        this.pickText(raw, ['offeringsectionid', 'offering section id']) ||
        sectionByKey.get(
          this.sectionLookupKey({
            paperCode,
            programme,
            semester,
            section,
            shift,
          }),
        ) ||
        '';
      const errors: string[] = [];
      const warnings: string[] = [];
      const staffMatches = staffCodes.map((code) => ({
        code,
        staff: staffByCode.get(this.key(code)) ?? null,
      }));
      const staffMatch = staffMatches[0]?.staff ?? null;
      const roomMatch = roomCode ? roomByCode.get(this.key(roomCode)) : null;
      if (!offeringSectionId) {
        errors.push(
          'Could not resolve section. Check Paper Code, Programme, Semester, Section and Shift.',
        );
      }
      staffMatches
        .filter((item) => !item.staff)
        .forEach((item) => errors.push(`Unknown faculty code: ${item.code}`));
      if (roomCode && !roomMatch)
        warnings.push(`Unknown room code: ${roomCode}`);
      const allocationPercent = Number(
        this.pickText(raw, ['allocation', 'allocation %']) || 0,
      );
      if (allocationPercent > 100)
        warnings.push('Allocation percentage is above 100%');
      return {
        rowNumber: row.rowNumber,
        status: errors.length ? 'INVALID' : 'VALID',
        errors,
        warnings,
        raw,
        normalized: {
          offeringSectionId,
          staffProfileId: staffMatch?.id ?? null,
          facultyTeam: staffMatches
            .filter((item) => item.staff)
            .map((item, index) => ({
              staffProfileId: item.staff!.id,
              facultyInitial: item.staff!.shortCode ?? item.code,
              role: this.role(
                raw.teachingrole ?? raw['teaching role'] ?? raw.role,
                index,
              ),
              allocationPercent: allocationPercent || undefined,
              workloadHours:
                Number(
                  this.pickText(raw, ['weeklyhours', 'weekly hours']) || 0,
                ) || undefined,
              canMarkAttendance: this.boolDefault(
                raw.canmarkattendance ?? raw['can mark attendance'],
                true,
              ),
              canEnterInternalMarks: this.boolDefault(
                raw.canenterinternalmarks ?? raw['can enter internal marks'],
                index === 0,
              ),
              canUploadLessonPlan: this.boolDefault(
                raw.canuploadlessonplan ?? raw['can upload lesson plan'],
                true,
              ),
              canAccessSubjectWorkspace: true,
            })),
          facultyInitial:
            this.pickText(raw, [
              'facultyshortcode',
              'faculty short code',
              'facultyinitial',
              'faculty initial',
            ]) ??
            staffMatch?.shortCode ??
            null,
          workloadHours: Number(
            this.pickText(raw, ['weeklyhours', 'weekly hours']) || 0,
          ),
          preferredRoomId: roomMatch?.id ?? null,
          combinedClass: this.bool(raw.combinedclass ?? raw['combined class']),
          combinedGroupId: this.text(
            raw.combinedgroupid ?? raw['combined group id'],
          ),
          labRequired: this.bool(raw.labrequired ?? raw['lab required']),
          status: this.text(raw.status) || 'DRAFT',
        },
      };
    });
    return {
      summary: {
        total: rows.length,
        valid: rows.filter((row) => row.status === 'VALID').length,
        invalid: rows.filter((row) => row.status === 'INVALID').length,
        warnings: rows.filter((row) => row.warnings.length).length,
      },
      rows,
    };
  }

  async commitAllocationUpload(tenantId: string, buffer: Buffer) {
    const preview = await this.validateAllocationUpload(tenantId, buffer);
    if (preview.rows.some((row) => row.status === 'INVALID')) {
      throw new BadRequestException(
        'Fix invalid allocation rows before committing',
      );
    }
    let committed = 0;
    for (const row of preview.rows) {
      const normalized = row.normalized as any;
      const facultyTeam = normalized.facultyTeam?.length
        ? normalized.facultyTeam
        : [{ staffProfileId: normalized.staffProfileId }];
      for (const member of facultyTeam.filter(
        (item: any) => item.staffProfileId,
      )) {
        await this.allocations.saveRow(tenantId, {
          ...normalized,
          staffProfileId: member.staffProfileId,
          facultyInitial: member.facultyInitial ?? normalized.facultyInitial,
          role: member.role,
          allocationPercent: member.allocationPercent,
          workloadHours: member.workloadHours ?? normalized.workloadHours,
          canMarkAttendance: member.canMarkAttendance,
          canEnterInternalMarks: member.canEnterInternalMarks,
          canUploadLessonPlan: member.canUploadLessonPlan,
          canAccessSubjectWorkspace: member.canAccessSubjectWorkspace,
        } as any);
        committed += 1;
      }
    }
    return { committed, summary: preview.summary };
  }

  private addLookupSheet(
    workbook: ExcelJS.Workbook,
    name: string,
    headers: string[],
    rows: Array<Array<string | number | null | undefined>>,
  ) {
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row.map((value) => value ?? '')));
    sheet.columns.forEach((column) => {
      column.width = 24;
    });
  }

  private applyTemplateFormatting(
    workbook: ExcelJS.Workbook,
    sheet: ExcelJS.Worksheet,
  ) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ALLOCATION_HEADERS.length },
    };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFF6FF' },
    };
    sheet.getColumn(15).hidden = true;

    const validationRows = 500;
    this.applyListValidation(
      sheet,
      1,
      `'Departments'!$A$2:$A$500`,
      validationRows,
    );
    this.applyListValidation(
      sheet,
      2,
      `'Programmes'!$A$2:$A$500`,
      validationRows,
    );
    this.applyListValidation(sheet, 3, '"1,2,3,4,5,6,7,8"', validationRows);
    this.applyListValidation(sheet, 4, `'Papers'!$A$2:$A$1000`, validationRows);
    this.applyListValidation(sheet, 5, `'Papers'!$B$2:$B$1000`, validationRows);
    this.applyListValidation(
      sheet,
      6,
      `'Sections'!$A$2:$A$500`,
      validationRows,
    );
    this.applyListValidation(sheet, 7, `'Shifts'!$A$2:$A$200`, validationRows);
    this.applyListValidation(
      sheet,
      8,
      `'Faculty Lookup'!$A$2:$A$1000`,
      validationRows,
    );
    this.applyListValidation(
      sheet,
      9,
      `'Faculty Lookup'!$C$2:$C$1000`,
      validationRows,
    );
    this.applyListValidation(sheet, 10, `'Roles'!$A$2:$A$20`, validationRows);
    this.applyListValidation(sheet, 13, `'YesNo'!$A$2:$A$3`, validationRows);
    this.applyListValidation(sheet, 14, `'YesNo'!$A$2:$A$3`, validationRows);
    this.applyListValidation(sheet, 15, `'YesNo'!$A$2:$A$3`, validationRows);

    for (let rowNo = 2; rowNo <= validationRows; rowNo += 1) {
      sheet.getCell(rowNo, 11).dataValidation = {
        type: 'decimal',
        operator: 'between',
        formulae: [0, 100],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: 'Invalid allocation',
        error: 'Allocation percentage must be between 0 and 100.',
      };
      sheet.getCell(rowNo, 12).dataValidation = {
        type: 'decimal',
        operator: 'greaterThanOrEqual',
        formulae: [0],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: 'Invalid weekly hours',
        error: 'Weekly hours must be 0 or higher.',
      };
    }
  }

  private applyListValidation(
    sheet: ExcelJS.Worksheet,
    columnNo: number,
    source: string,
    rows: number,
  ) {
    for (let rowNo = 2; rowNo <= rows; rowNo += 1) {
      sheet.getCell(rowNo, columnNo).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [source],
        showErrorMessage: true,
        errorTitle: 'Invalid value',
        error: 'Please select a value from the dropdown list.',
      };
    }
  }

  private text(value: unknown) {
    const text = String(value ?? '').trim();
    return text || '';
  }

  private pickText(row: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = row[key];
      const text = this.text(value);
      if (text) return text;
    }
    return '';
  }

  private key(value: unknown) {
    return this.text(value).toUpperCase();
  }

  private bool(value: unknown) {
    return ['YES', 'Y', 'TRUE', '1'].includes(this.key(value));
  }

  private boolDefault(value: unknown, fallback: boolean) {
    const normalized = this.key(value);
    if (!normalized) return fallback;
    return ['YES', 'Y', 'TRUE', '1'].includes(normalized);
  }

  private role(value: unknown, index: number) {
    const normalized = this.key(value).replace(/[\s-]+/g, '_');
    return normalized || (index === 0 ? 'PRIMARY_FACULTY' : 'CO_FACULTY');
  }

  private sectionLookupKey(input: {
    paperCode?: unknown;
    programme?: unknown;
    semester?: unknown;
    section?: unknown;
    shift?: unknown;
  }) {
    return [
      this.key(input.paperCode),
      this.key(input.programme),
      this.key(input.semester),
      this.key(input.section),
      this.key(input.shift),
    ].join('|');
  }
}
