import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createWorkbookWithSheets } from '../../../common/import/excel.util';
import type {
  ImportModuleHandler,
  ImportModuleHandlerContext,
  ImportRowValidationResult,
  ImportValidateOptions,
  ParsedImportRow,
} from '../../../common/import/import.types';
import { PrismaService } from '../../../database/prisma.service';
import { STAFF_TYPES, type StaffImportMode } from '../dto/staff.dto';
import { StaffImportCommitService } from './staff-import-commit.service';
import { StaffProvisioningService } from '../services/staff-provisioning.service';

export type NormalizedStaffImportRow = {
  employeeCode: string;
  fullName: string;
  gender?: string;
  dateOfBirth?: string;
  mobile: string;
  email?: string;
  aadhaarNo?: string;
  bloodGroup?: string;
  staffType: string;
  departmentId?: string;
  departmentCode?: string;
  designationId?: string;
  designationCode?: string;
  joiningDate?: string;
  primaryShiftId?: string;
  shiftCode?: string;
  employmentType?: string;
  status?: string;
  subjectCodes?: string[];
  courseIds?: string[];
  missingSubjectCodes?: string[];
  workloadLimit?: number;
  isHoD?: boolean;
  isClassTeacher?: boolean;
  createPortalAccount: boolean;
  username?: string;
  password?: string;
  roleSlug?: string;
  qualification?: string;
  specialization?: string;
  experienceYears?: number;
  addressJson?: Record<string, unknown>;
  photoUrl?: string;
  existingStaffId?: string;
};

const STAFF_TYPE_ALIASES: Record<string, string> = {
  TEACHING: 'TEACHING',
  TEACHER: 'TEACHING',
  FACULTY: 'TEACHING',
  'NON TEACHING': 'NON_TEACHING',
  NONTEACHING: 'NON_TEACHING',
  NON_TEACHING: 'NON_TEACHING',
  ADMIN: 'ADMIN',
  'ADMIN STAFF': 'ADMIN',
  GUEST: 'GUEST',
  'GUEST FACULTY': 'GUEST',
  VISITING: 'VISITING',
  'VISITING FACULTY': 'VISITING',
  CONTRACT: 'CONTRACT',
  'CONTRACT STAFF': 'CONTRACT',
};

function parseYesNo(value: unknown, defaultValue = false): boolean {
  if (value == null || value === '') return defaultValue;
  const s = String(value).trim().toUpperCase();
  return ['YES', 'Y', 'TRUE', '1'].includes(s);
}

function parseStaffType(raw: unknown): string | undefined {
  if (raw == null || raw === '') return undefined;
  const key = String(raw).trim().toUpperCase().replace(/-/g, ' ');
  return (
    STAFF_TYPE_ALIASES[key] ??
    STAFF_TYPE_ALIASES[key.replace(/\s+/g, '_')] ??
    key.replace(/\s+/g, '_')
  );
}

function fuzzyMatchDepartment(
  input: string,
  departments: { id: string; code: string; name: string }[],
): { id: string; code: string; warning?: string } | null {
  const upper = input.trim().toUpperCase();
  const exact = departments.find((d) => d.code.trim().toUpperCase() === upper);
  if (exact) return { id: exact.id, code: exact.code };

  const byName = departments.find((d) => d.name.trim().toUpperCase() === upper);
  if (byName) {
    return {
      id: byName.id,
      code: byName.code,
      warning: `Department matched by name: ${input} → ${byName.code}`,
    };
  }

  const partial = departments.find(
    (d) =>
      d.code.trim().toUpperCase().includes(upper) ||
      upper.includes(d.code.trim().toUpperCase()) ||
      d.name.trim().toUpperCase().includes(upper),
  );
  if (partial) {
    return {
      id: partial.id,
      code: partial.code,
      warning: `Department fuzzy match: ${input} → ${partial.code}`,
    };
  }
  return null;
}

@Injectable()
export class StaffImportHandler implements ImportModuleHandler<NormalizedStaffImportRow> {
  readonly module = 'STAFF' as const;
  readonly columnDefs = [
    { key: 'employeeCode', header: 'staff_code', required: true },
    { key: 'fullName', header: 'full_name', required: true },
    { key: 'gender', header: 'gender', required: false },
    { key: 'dateOfBirth', header: 'dob', required: false },
    { key: 'mobile', header: 'mobile', required: true },
    { key: 'email', header: 'email', required: false },
    { key: 'aadhaarNo', header: 'aadhaar', required: false },
    { key: 'bloodGroup', header: 'blood_group', required: false },
    { key: 'staffType', header: 'staff_type', required: true },
    { key: 'departmentCode', header: 'department', required: true },
    { key: 'designationCode', header: 'designation', required: false },
    { key: 'joiningDate', header: 'joining_date', required: false },
    { key: 'shiftCode', header: 'shift', required: false },
    { key: 'employmentStatus', header: 'employment_status', required: false },
    { key: 'subjectCodes', header: 'subject_codes', required: false },
    { key: 'workloadLimit', header: 'workload_limit', required: false },
    { key: 'hod', header: 'hod', required: false },
    { key: 'classTeacher', header: 'class_teacher', required: false },
    { key: 'createPortalUser', header: 'create_portal_user', required: false },
    { key: 'username', header: 'username', required: false },
    { key: 'password', header: 'password', required: false },
    { key: 'qualification', header: 'qualification', required: false },
    { key: 'specialization', header: 'specialization', required: false },
    { key: 'experienceYears', header: 'experience_years', required: false },
    { key: 'address', header: 'address', required: false },
    { key: 'city', header: 'city', required: false },
    { key: 'state', header: 'state', required: false },
    { key: 'pinCode', header: 'pincode', required: false },
    { key: 'photoUrl', header: 'photo_url', required: false },
    { key: 'roleSlug', header: 'role_slug', required: false },
  ];
  readonly nepForbiddenHeaders: string[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: StaffProvisioningService,
    private readonly commitHelper: StaffImportCommitService,
  ) {}

  async parseAndValidate(
    tenantId: string,
    rows: ParsedImportRow[],
    options?: ImportValidateOptions,
  ): Promise<ImportRowValidationResult[]> {
    const importMode =
      (options?.importMode as StaffImportMode | undefined) ?? 'CREATE';

    const [
      departments,
      designations,
      shifts,
      courses,
      existingStaff,
      portalUsers,
    ] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.designation.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, code: true, label: true },
      }),
      this.prisma.shift.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, code: true },
      }),
      this.prisma.course.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, code: true },
      }),
      this.prisma.staffProfile.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, employeeCode: true, email: true, mobile: true },
      }),
      this.prisma.user.findMany({
        where: { tenantId, deletedAt: null },
        select: { email: true },
      }),
    ]);

    const deptByCode = new Map(
      departments.map((d) => [d.code.trim().toUpperCase(), d]),
    );
    const desigByCode = new Map(
      designations.map((d) => [d.code.trim().toUpperCase(), d.id]),
    );
    const desigByLabel = new Map(
      designations.map((d) => [d.label.trim().toUpperCase(), d.id]),
    );
    const shiftByCode = new Map(
      shifts.map((s) => [s.code.trim().toUpperCase(), s.id]),
    );
    const courseByCode = new Map(
      courses.map((c) => [c.code.trim().toUpperCase(), c.id]),
    );
    const codeToStaff = new Map(
      existingStaff.map((s) => [s.employeeCode.trim().toUpperCase(), s]),
    );
    const emailSet = new Set([
      ...(existingStaff
        .map((s) => s.email?.trim().toLowerCase())
        .filter(Boolean) as string[]),
      ...portalUsers.map((u) => u.email.trim().toLowerCase()),
    ]);
    const mobileSet = new Set(
      existingStaff.map((s) => s.mobile?.trim()).filter(Boolean) as string[],
    );

    const fileCodes = new Set<string>();
    const fileEmails = new Set<string>();
    const fileMobiles = new Set<string>();

    return rows.map((row) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const raw = row.raw;

      const employeeCode = String(
        raw.employeeCode ?? raw.staff_code ?? '',
      ).trim();
      const fullName = String(raw.fullName ?? raw.full_name ?? '').trim();
      const mobile = String(raw.mobile ?? '').trim();
      const email = String(raw.email ?? '')
        .trim()
        .toLowerCase();
      const staffTypeRaw = parseStaffType(raw.staffType ?? raw.staff_type);
      const departmentInput = String(
        raw.departmentCode ?? raw.department ?? '',
      ).trim();
      const designationInput = String(
        raw.designationCode ?? raw.designation ?? '',
      ).trim();
      const shiftCode = String(raw.shiftCode ?? raw.shift ?? '')
        .trim()
        .toUpperCase();
      const subjectCodesRaw = String(
        raw.subjectCodes ?? raw.subject_codes ?? '',
      ).trim();
      const subjectCodes = subjectCodesRaw
        ? subjectCodesRaw
            .split(/[,;|]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      if (!fullName) errors.push('Full name is required');
      if (!employeeCode) errors.push('Staff code is required');
      if (!mobile) errors.push('Mobile is required');
      if (!staffTypeRaw) errors.push('Staff type is required');
      else if (
        !STAFF_TYPES.includes(staffTypeRaw as (typeof STAFF_TYPES)[number])
      ) {
        errors.push(`Invalid staff type: ${staffTypeRaw}`);
      }
      if (!departmentInput) errors.push('Department is required');

      const existingStaffRow = employeeCode
        ? codeToStaff.get(employeeCode.toUpperCase())
        : undefined;

      const codeKey = employeeCode.toUpperCase();
      if (employeeCode) {
        if (fileCodes.has(codeKey)) {
          errors.push('Duplicate staff code in file');
        } else {
          fileCodes.add(codeKey);
          if (existingStaffRow && importMode === 'CREATE') {
            errors.push('Staff code already exists');
          }
        }
      }

      if (email) {
        if (!email.includes('@')) errors.push('Valid email is required');
        if (fileEmails.has(email)) errors.push('Duplicate email in file');
        else {
          fileEmails.add(email);
          const sameStaffEmail =
            existingStaffRow?.email?.trim().toLowerCase() === email;
          if (emailSet.has(email) && !sameStaffEmail) {
            if (importMode === 'CREATE' || !existingStaffRow) {
              errors.push('Email already exists');
            }
          }
        }
      }

      if (mobile) {
        if (fileMobiles.has(mobile)) errors.push('Duplicate mobile in file');
        else {
          fileMobiles.add(mobile);
          const sameStaffMobile = existingStaffRow?.mobile === mobile;
          if (
            mobileSet.has(mobile) &&
            !sameStaffMobile &&
            (importMode === 'CREATE' || !existingStaffRow)
          ) {
            errors.push('Mobile already exists');
          }
        }
      }

      let departmentId: string | undefined;
      let departmentCode: string | undefined;
      if (departmentInput) {
        const exactDept = deptByCode.get(departmentInput.toUpperCase());
        const deptMatch =
          exactDept ?? fuzzyMatchDepartment(departmentInput, departments);
        if (!deptMatch) {
          errors.push(`Unknown department: ${departmentInput}`);
        } else {
          departmentId = deptMatch.id;
          departmentCode = deptMatch.code;
          if ('warning' in deptMatch && deptMatch.warning) {
            warnings.push(deptMatch.warning);
          }
        }
      }

      let designationId: string | undefined;
      if (designationInput) {
        designationId =
          desigByCode.get(designationInput.toUpperCase()) ??
          desigByLabel.get(designationInput.toUpperCase());
        if (!designationId) {
          warnings.push(`Designation not found: ${designationInput}`);
        }
      }

      let primaryShiftId: string | undefined;
      if (shiftCode) {
        primaryShiftId = shiftByCode.get(shiftCode);
        if (!primaryShiftId) warnings.push(`Shift not found: ${shiftCode}`);
      }

      const courseIds: string[] = [];
      const missingSubjectCodes: string[] = [];
      if (subjectCodes.length && staffTypeRaw === 'TEACHING') {
        for (const code of subjectCodes) {
          const courseId = courseByCode.get(code.toUpperCase());
          if (courseId) courseIds.push(courseId);
          else missingSubjectCodes.push(code);
        }
        if (missingSubjectCodes.length) {
          warnings.push(
            `Unknown subject codes: ${missingSubjectCodes.join(', ')}`,
          );
        }
      }

      const createPortalAccount = parseYesNo(
        raw.createPortalUser ?? raw.create_portal_user,
        true,
      );
      if (createPortalAccount && !email) {
        errors.push('Email is required when create_portal_user is YES');
      }

      const workloadRaw = raw.workloadLimit ?? raw.workload_limit;
      const workloadLimit =
        workloadRaw != null && workloadRaw !== ''
          ? Number(workloadRaw)
          : undefined;
      if (workloadLimit != null && Number.isNaN(workloadLimit)) {
        errors.push('Invalid workload_limit');
      }

      const expRaw = raw.experienceYears ?? raw.experience_years;
      const experienceYears =
        expRaw != null && expRaw !== ''
          ? parseInt(String(expRaw), 10)
          : undefined;

      const addressLine = String(raw.address ?? '').trim();
      const city = String(raw.city ?? '').trim();
      const state = String(raw.state ?? '').trim();
      const pinCode = String(raw.pinCode ?? raw.pincode ?? '').trim();
      const addressJson =
        addressLine || city || state || pinCode
          ? {
              line1: addressLine || undefined,
              city: city || undefined,
              state: state || undefined,
              pinCode: pinCode || undefined,
              bloodGroup:
                String(raw.bloodGroup ?? raw.blood_group ?? '').trim() ||
                undefined,
            }
          : undefined;

      const normalized: NormalizedStaffImportRow | undefined =
        errors.length === 0
          ? {
              employeeCode,
              fullName,
              gender: String(raw.gender ?? '').trim() || undefined,
              dateOfBirth:
                String(raw.dateOfBirth ?? raw.dob ?? '').trim() || undefined,
              mobile,
              email: email || undefined,
              aadhaarNo:
                String(raw.aadhaarNo ?? raw.aadhaar ?? '').trim() || undefined,
              bloodGroup:
                String(raw.bloodGroup ?? raw.blood_group ?? '').trim() ||
                undefined,
              staffType: staffTypeRaw!,
              departmentId,
              departmentCode,
              designationId,
              designationCode: designationInput || undefined,
              joiningDate:
                String(raw.joiningDate ?? raw.joining_date ?? '').trim() ||
                undefined,
              primaryShiftId,
              shiftCode: shiftCode || undefined,
              employmentType:
                String(raw.employmentStatus ?? raw.employment_status ?? '')
                  .trim()
                  .toUpperCase() || undefined,
              status:
                String(raw.employmentStatus ?? raw.employment_status ?? '')
                  .trim()
                  .toUpperCase() === 'INACTIVE'
                  ? 'INACTIVE'
                  : 'ACTIVE',
              subjectCodes: subjectCodes.length ? subjectCodes : undefined,
              courseIds: courseIds.length ? courseIds : undefined,
              missingSubjectCodes: missingSubjectCodes.length
                ? missingSubjectCodes
                : undefined,
              workloadLimit,
              isHoD: parseYesNo(raw.hod),
              isClassTeacher: parseYesNo(raw.classTeacher ?? raw.class_teacher),
              createPortalAccount,
              username: String(raw.username ?? '').trim() || undefined,
              password: String(raw.password ?? '').trim() || undefined,
              roleSlug:
                String(raw.roleSlug ?? raw.role_slug ?? '').trim() || undefined,
              qualification:
                String(raw.qualification ?? '').trim() || undefined,
              specialization:
                String(raw.specialization ?? '').trim() || undefined,
              experienceYears:
                experienceYears != null && !Number.isNaN(experienceYears)
                  ? experienceYears
                  : undefined,
              addressJson,
              photoUrl:
                String(raw.photoUrl ?? raw.photo_url ?? '').trim() || undefined,
              existingStaffId:
                existingStaffRow &&
                (importMode === 'MERGE' || importMode === 'REPLACE')
                  ? existingStaffRow.id
                  : undefined,
            }
          : undefined;

      if (
        existingStaffRow &&
        (importMode === 'MERGE' || importMode === 'REPLACE') &&
        errors.length === 0
      ) {
        warnings.push(`Existing staff matched by code: ${employeeCode}`);
      }

      return {
        rowNumber: row.rowNumber,
        status: errors.length ? 'INVALID' : 'VALID',
        raw,
        normalized,
        errors,
        warnings: warnings.length ? warnings : undefined,
        displayCode: employeeCode || undefined,
        displayTitle: fullName || email || undefined,
      };
    });
  }

  async commitRows(
    ctx: ImportModuleHandlerContext,
    rows: { rowNumber: number; normalized: NormalizedStaffImportRow }[],
  ) {
    const importMode =
      (ctx.options?.importMode as StaffImportMode | undefined) ?? 'CREATE';
    const created: { rowNumber: number; entityId: string }[] = [];

    for (const row of rows) {
      const n = row.normalized;
      const dto = this.toCreateDto(n);
      let staffId: string;

      if (
        n.existingStaffId &&
        (importMode === 'MERGE' || importMode === 'REPLACE')
      ) {
        const result = await this.provisioning.mergeFromImport(
          ctx.tenantId,
          n.existingStaffId,
          dto,
          importMode,
          ctx.userId,
        );
        staffId = result.staff.id;
      } else {
        const result = await this.provisioning.create(
          ctx.tenantId,
          dto,
          ctx.userId,
        );
        staffId = result.staff.id;
      }

      await this.commitHelper.applyPostProfileSteps(ctx.tenantId, staffId, n, {
        replaceEligibility: importMode === 'REPLACE',
      });

      created.push({ rowNumber: row.rowNumber, entityId: staffId });
    }

    return created;
  }

  private toCreateDto(n: NormalizedStaffImportRow) {
    const roleSlugs = n.roleSlug ? [n.roleSlug] : undefined;
    return {
      employeeCode: n.employeeCode,
      fullName: n.fullName,
      email: n.email,
      mobile: n.mobile,
      staffType: n.staffType,
      employmentType:
        n.employmentType ?? this.defaultEmploymentType(n.staffType),
      departmentId: n.departmentId,
      designationId: n.designationId,
      primaryShiftId: n.primaryShiftId,
      joiningDate: n.joiningDate,
      gender: n.gender,
      dateOfBirth: n.dateOfBirth,
      qualification: n.qualification,
      specialization: n.specialization,
      experienceYears: n.experienceYears,
      aadhaarNo: n.aadhaarNo,
      photoUrl: n.photoUrl,
      addressJson: n.addressJson as Prisma.InputJsonValue | undefined,
      status: n.status,
      createPortalAccount: n.createPortalAccount,
      portalRoleSlugs: roleSlugs,
      password: n.password,
    };
  }

  private defaultEmploymentType(staffType: string): string {
    if (staffType === 'CONTRACT') return 'CONTRACT';
    if (staffType === 'GUEST') return 'GUEST';
    if (staffType === 'VISITING') return 'VISITING';
    return 'PERMANENT';
  }

  async buildTemplateWorkbook(): Promise<Buffer> {
    const headers = this.columnDefs.map((c) => c.header);
    return createWorkbookWithSheets([
      {
        name: 'Staff',
        headers,
        rows: [
          [
            'EMP1001',
            'Dr Jane Faculty',
            'F',
            '1985-06-15',
            '9876543210',
            'jane.faculty@demo.edu',
            '',
            'O+',
            'TEACHING',
            'CS',
            'Professor',
            '2020-07-01',
            'MORNING',
            'ACTIVE',
            'CS101,CS102',
            '18',
            'NO',
            'NO',
            'YES',
            '',
            '',
            'Ph.D',
            'Computer Science',
            '12',
            'Campus Road',
            'Tura',
            'Meghalaya',
            '794001',
            '',
            'faculty',
          ],
          [
            'EMP2001',
            'John Accountant',
            'M',
            '1990-03-20',
            '9876543211',
            'john.account@demo.edu',
            '',
            '',
            'NON_TEACHING',
            'ADMIN',
            'Accountant',
            '2019-04-01',
            'DAY',
            'ACTIVE',
            '',
            '',
            'NO',
            'NO',
            'YES',
            '',
            '',
            'M.Com',
            'Finance',
            '8',
            'Admin Block',
            'Tura',
            'Meghalaya',
            '794001',
            '',
            'staff',
          ],
          [
            'EMP3001',
            'Mary Admin',
            'F',
            '1988-11-05',
            '9876543212',
            'mary.admin@demo.edu',
            '',
            '',
            'ADMIN',
            'ADMIN',
            'Office Manager',
            '2021-01-10',
            'DAY',
            'ACTIVE',
            '',
            '',
            'NO',
            'NO',
            'YES',
            '',
            '',
            'MBA',
            'Administration',
            '5',
            '',
            'Tura',
            'Meghalaya',
            '794001',
            '',
            'institution-admin',
          ],
        ],
      },
      {
        name: 'Instructions',
        headers: ['Column', 'Required', 'Description'],
        rows: this.columnDefs
          .map((c) => [c.header, c.required ? 'Yes' : 'No', c.key])
          .concat([
            [
              'Import modes',
              'No',
              'CREATE | MERGE | REPLACE — MERGE updates by staff_code',
            ],
            [
              'staff_type values',
              'Yes',
              'TEACHING, NON_TEACHING, ADMIN, GUEST, VISITING, CONTRACT',
            ],
            ['create_portal_user', 'No', 'YES or NO (default YES)'],
            [
              'subject_codes',
              'No',
              'Comma-separated course codes for TEACHING staff',
            ],
          ]),
      },
    ]);
  }

  async buildErrorReportWorkbook(
    rows: ImportRowValidationResult[],
  ): Promise<Buffer> {
    return createWorkbookWithSheets([
      {
        name: 'Errors',
        headers: ['Row', 'Code', 'Name', 'Errors', 'Warnings'],
        rows: rows
          .filter(
            (r) => r.status === 'INVALID' || (r.warnings?.length ?? 0) > 0,
          )
          .map((r) => [
            r.rowNumber,
            r.displayCode ?? '',
            r.displayTitle ?? '',
            r.errors.join('; '),
            r.warnings?.join('; ') ?? '',
          ]),
      },
    ]);
  }
}
