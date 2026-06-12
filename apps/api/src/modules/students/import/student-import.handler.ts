import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { createWorkbookWithSheets } from '../../../common/import/excel.util';
import type {
  ImportModuleHandler,
  ImportModuleHandlerContext,
  ImportRowValidationResult,
  ImportValidateOptions,
  ParsedImportRow,
} from '../../../common/import/import.types';
import { PrismaService } from '../../../database/prisma.service';
import { isAcademicDepartment } from '../../organization/department-rules';
import { AcademicEngineService } from '../../academic-engine/academic-engine.service';
import { slugifySubject } from '../../academic-engine/domain/nep-categories';
import type { StudentImportMode } from '../dto/students.dto';
import { StudentSemesterResolverService } from '../services/student-semester-resolver.service';
import {
  SEM1_ADMISSION_SAMPLE_ROW,
  SEM1_ADMISSION_TEMPLATE_HEADERS,
  SEM1_ADMISSION_TEMPLATE_HELPERS,
} from '../migration/sem1-admission-template';

export type NormalizedStudentImportRow = {
  email: string;
  enrollmentNumber: string;
  applicationNumber?: string;
  admissionNumber?: string;
  rollNumber?: string;
  fullName: string;
  mobileNumber?: string;
  programVersionId: string;
  admissionBatchId: string;
  streamId: string;
  shiftId: string;
  departmentId?: string;
  sessionId?: string;
  currentSemester?: number;
  studentStatus?: string;
  gender?: string;
  dateOfBirth?: string;
  categoryLookupId?: string;
  religionLookupId?: string;
  nationalId?: string;
  fatherName?: string;
  motherName?: string;
  rfidNumber?: string;
  majorSubjectSlug?: string;
  minorSubjectSlug?: string;
  academicMapping?: FyugpAcademicMapping;
  existingStudentId?: string;
  semesterOverride?: boolean;
  turaAddress?: {
    line1?: string;
    city?: string;
    state?: string;
    pinCode?: string;
  };
  homeAddress?: {
    line1?: string;
    city?: string;
    state?: string;
    pinCode?: string;
  };
};
type ExistingStudentRef = {
  id: string;
  enrollmentNumber: string;
  rollNumber: string | null;
  rfidNumber: string | null;
  user: { email: string };
  masterProfile: { nationalId: string | null } | null;
};

type FyugpCategory = 'MAJOR' | 'MINOR' | 'MDC' | 'AEC' | 'SEC' | 'VAC';

type FyugpResolvedSelection = {
  category: FyugpCategory;
  input: string;
  resolvedLabel: string;
  courseCode?: string;
  resolutionMode?: 'CODE' | 'SLUG' | 'NAME';
  subjectSlug?: string;
  courseId?: string;
  courseOfferingId?: string;
  offeringSectionId?: string;
  sectionCode?: string;
  categoryPoolId?: string;
  warnings?: string[];
};

type FyugpAcademicMapping = {
  major?: FyugpResolvedSelection;
  minor?: FyugpResolvedSelection;
  mdc?: FyugpResolvedSelection;
  aec?: FyugpResolvedSelection;
  sec?: FyugpResolvedSelection;
  vac?: FyugpResolvedSelection;
  tutorialGroup?: string;
  labBatch?: string;
};

type SubjectMasterRow = {
  id: string;
  slug: string;
  name: string;
  programmeGroup: string | null;
  isActive: boolean;
  department?: { id: string; code: string; name: string } | null;
};

type OfferingCandidate = {
  id: string;
  category: string | null;
  semesterSequence: number | null;
  programVersionId: string | null;
  categoryPoolId: string | null;
  courseId: string;
  course: {
    id: string;
    code: string;
    title: string;
    subjectSlug: string | null;
    status: string;
    department?: { id: string; code: string; name: string } | null;
  };
  categoryPool?: {
    categoryType: string;
    semesterNo: number;
    active: boolean;
    assignments: {
      programVersionId: string;
      semesterNo: number;
      active: boolean;
    }[];
  } | null;
  sections: {
    id: string;
    shiftId: string;
    sectionCode: string;
    capacity: number;
    seatLedger?: { confirmedCount: number; waitlistCount: number } | null;
  }[];
};

type ExistingStudentTemplateRow = {
  enrollmentNumber: string;
  rollNumber: string | null;
  user: { email: string };
  masterProfile: {
    fullName: string;
    mobileNumber: string | null;
    studentStatus: string | null;
  } | null;
  programVersion?: {
    program: {
      code: string;
      name: string;
      department?: { code: string; name: string } | null;
    };
  } | null;
  department?: { code: string; name: string } | null;
  primaryShift?: { code: string; name: string } | null;
  academicProfile?: {
    stream?: { code: string; name: string } | null;
    admissionBatch?: { batchCode: string; currentSemester: number } | null;
  } | null;
  programChoices: { choiceType: string; subjectSlug: string; status: string }[];
  semesterRegistrations: {
    semesterSequence: number;
    lines: {
      category: string;
      offering: {
        course: {
          title: string;
          code: string;
          courseType: string;
          subjectSlug: string | null;
        };
      };
    }[];
  }[];
};

type TemplateReference = {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
};

type FyugpResolutionContext = {
  subjectMasters: SubjectMasterRow[];
  offerings: OfferingCandidate[];
};

const PROGRAMME_LOOKUP_LIMIT = 15;

@Injectable()
export class StudentImportHandler implements ImportModuleHandler<NormalizedStudentImportRow> {
  readonly module = 'STUDENT_MASTER' as const;
  readonly columnDefs = [
    { key: 'applicationNumber', header: 'Application Number', required: false },
    { key: 'admissionNumber', header: 'Admission Number', required: false },
    {
      key: 'registrationNumber',
      header: 'Registration Number',
      required: false,
    },
    { key: 'rollNumber', header: 'Roll Number', required: false },
    { key: 'fullName', header: 'Full Name', required: true },
    { key: 'email', header: 'Email', required: true },
    { key: 'mobile', header: 'Mobile', required: false },
    { key: 'programme', header: 'Programme', required: true },
    { key: 'admissionBatch', header: 'Admission Batch', required: true },
    { key: 'stream', header: 'Stream', required: true },
    { key: 'shift', header: 'Shift', required: true },
    { key: 'department', header: 'Department', required: false },
    { key: 'academicSession', header: 'Academic Session', required: false },
    { key: 'currentSemester', header: 'Current Semester', required: false },
    { key: 'studentStatus', header: 'Student Status', required: false },
    { key: 'category', header: 'Category', required: false },
    { key: 'religion', header: 'Religion', required: false },
    { key: 'aadhaar', header: 'Aadhaar', required: false },
    { key: 'fatherName', header: 'Father Name', required: false },
    { key: 'motherName', header: 'Mother Name', required: false },
    { key: 'rfid', header: 'RFID', required: false },
    { key: 'majorCourseCode', header: 'MAJOR_CODE', required: false },
    { key: 'minorCourseCode', header: 'MINOR_CODE', required: false },
    { key: 'mdcCourseCode', header: 'MDC_CODE', required: false },
    { key: 'aecCourseCode', header: 'AEC_CODE', required: false },
    { key: 'secCourseCode', header: 'SEC_CODE', required: false },
    { key: 'vacCourseCode', header: 'VAC_CODE', required: false },
    { key: 'majorSubject', header: 'Major Subject', required: false },
    { key: 'minorSubject', header: 'Minor Subject', required: false },
    { key: 'mdcSubject', header: 'MDC Choice', required: false },
    { key: 'aecSubject', header: 'AEC', required: false },
    { key: 'secSubject', header: 'SEC', required: false },
    { key: 'vacSubject', header: 'VAC', required: false },
    { key: 'sectionCode', header: 'Section Code', required: false },
    { key: 'majorSection', header: 'Major Section', required: false },
    { key: 'minorSection', header: 'Minor Section', required: false },
    { key: 'mdcSection', header: 'MDC Section', required: false },
    { key: 'aecSection', header: 'AEC Section', required: false },
    { key: 'secSection', header: 'SEC Section', required: false },
    { key: 'vacSection', header: 'VAC Section', required: false },
    { key: 'majorSubject2', header: 'Major Subject 2', required: false },
    { key: 'minorSubject2', header: 'Minor Subject 2', required: false },
    { key: 'electiveSubject', header: 'Elective Subject', required: false },
    { key: 'skillPaper', header: 'Skill Paper', required: false },
    { key: 'tutorialGroup', header: 'Tutorial Group', required: false },
    { key: 'labBatch', header: 'Lab Batch', required: false },
    { key: 'gender', header: 'Gender', required: false },
    { key: 'dateOfBirth', header: 'Date of Birth', required: false },
    { key: 'turaLine1', header: 'Tura Address Line 1', required: false },
    { key: 'turaCity', header: 'Tura City', required: false },
    { key: 'turaState', header: 'Tura State', required: false },
    { key: 'turaPinCode', header: 'Tura PIN', required: false },
    { key: 'homeLine1', header: 'Home Address Line 1', required: false },
    { key: 'homeCity', header: 'Home City', required: false },
    { key: 'homeState', header: 'Home State', required: false },
    { key: 'homePinCode', header: 'Home PIN', required: false },
  ];
  readonly nepForbiddenHeaders: string[] = [];
  constructor(
    private readonly prisma: PrismaService,
    private readonly academicEngine: AcademicEngineService,
    private readonly semesterResolver: StudentSemesterResolverService,
  ) {}
  async parseAndValidate(
    tenantId: string,
    rows: ParsedImportRow[],
    options?: ImportValidateOptions,
  ): Promise<ImportRowValidationResult[]> {
    const importMode =
      (options?.importMode as StudentImportMode | undefined) ?? 'CREATE';
    const [
      programVersions,
      batches,
      semesters,
      streams,
      shifts,
      departments,
      existingStudents,
      lookups,
      academicSessions,
      activeCampuses,
      subjectMasters,
      courseOfferings,
    ] = await Promise.all([
      this.prisma.programVersion.findMany({
        where: { tenantId, deletedAt: null, status: 'PUBLISHED' },
        include: { program: { select: { code: true, name: true } } },
      }),
      this.prisma.admissionBatch.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          batchCode: true,
          currentSemester: true,
          cycleType: true,
          entrySessionId: true,
          institutionId: true,
          entrySession: { select: { name: true } },
        },
      }),
      this.prisma.semester.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          institutionId: true,
          semesterNumber: true,
          semesterType: true,
          isActive: true,
          timetableEnabled: true,
          registrationOpen: true,
        },
      }),
      this.prisma.academicStream.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, code: true },
      }),
      this.prisma.shift.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          campus: { deletedAt: null },
        },
        select: { id: true, code: true, campusId: true },
      }),
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, code: true, campusId: true, departmentType: true },
      }),
      this.prisma.student.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          enrollmentNumber: true,
          rollNumber: true,
          rfidNumber: true,
          user: { select: { email: true } },
          masterProfile: { select: { nationalId: true } },
        },
      }),
      this.prisma.masterLookup.findMany({
        where: {
          tenantId,
          lookupType: { in: ['CATEGORY', 'RELIGION'] },
          isActive: true,
        },
        select: { id: true, code: true, label: true, lookupType: true },
      }),
      this.prisma.academicYear.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true },
      }),
      this.prisma.campus.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.academicSubject.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          department: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.courseOffering.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          course: {
            include: {
              department: { select: { id: true, code: true, name: true } },
            },
          },
          categoryPool: {
            include: {
              assignments: {
                where: { active: true },
                select: {
                  programVersionId: true,
                  semesterNo: true,
                  active: true,
                },
              },
            },
          },
          sections: {
            where: { deletedAt: null, status: { in: ['active', 'ACTIVE'] } },
            include: { seatLedger: true },
          },
        },
      }),
    ]);
    const pvByCode = new Map(
      programVersions.flatMap((pv) =>
        this.programmeLookupKeys(pv.program.code, pv.program.name).map(
          (key) => [key, pv.id] as const,
        ),
      ),
    );
    const availableProgrammeCodes = [
      ...new Set(
        programVersions.map((pv) => pv.program.code.trim().toUpperCase()),
      ),
    ].sort();
    const batchByCode = new Map(
      batches.map((b) => [b.batchCode.trim().toUpperCase(), b]),
    );
    const streamByCode = new Map(
      streams.map((s) => [s.code.trim().toUpperCase(), s.id]),
    );
    const shiftByCampusAndCode = new Map(
      shifts.map((s) => [`${s.campusId}:${s.code.trim().toUpperCase()}`, s]),
    );
    const deptByCode = new Map(
      departments.map((d) => [d.code.trim().toUpperCase(), d]),
    );
    const sessionByName = new Map(
      academicSessions.map((s) => [
        this.normalizeAcademicSession(s.name),
        s.id,
      ]),
    );
    const regToStudent = new Map<string, ExistingStudentRef>();
    const emailToStudentId = new Map<string, string>();
    const rollToStudentId = new Map<string, string>();
    const aadhaarToStudentId = new Map<string, string>();
    const rfidToStudentId = new Map<string, string>();
    for (const student of existingStudents) {
      regToStudent.set(student.enrollmentNumber.trim().toUpperCase(), student);
      emailToStudentId.set(student.user.email.trim().toLowerCase(), student.id);
      if (student.rollNumber) {
        rollToStudentId.set(
          student.rollNumber.trim().toUpperCase(),
          student.id,
        );
      }
      if (student.rfidNumber) {
        rfidToStudentId.set(
          student.rfidNumber.trim().toUpperCase(),
          student.id,
        );
      }
      const nationalId = student.masterProfile?.nationalId?.trim();
      if (nationalId) {
        aadhaarToStudentId.set(nationalId.toUpperCase(), student.id);
      }
    }
    const categoryByCode = new Map(
      lookups
        .filter((l) => l.lookupType === 'CATEGORY')
        .map((l) => [l.code.trim().toUpperCase(), l.id]),
    );
    const religionByKey = new Map<string, string>();
    for (const lookup of lookups.filter((l) => l.lookupType === 'RELIGION')) {
      religionByKey.set(lookup.code.trim().toUpperCase(), lookup.id);
      religionByKey.set(lookup.label.trim().toLowerCase(), lookup.id);
    }
    const fileRegs = new Set<string>();
    const fileRolls = new Set<string>();
    const fileEmails = new Set<string>();
    const fileAadhaars = new Set<string>();
    const fileRfids = new Set<string>();
    return rows.map((row) =>
      this.validateRow(row, {
        importMode,
        pvByCode,
        availableProgrammeCodes,
        batchByCode,
        semesters,
        streamByCode,
        shiftByCampusAndCode,
        deptByCode,
        sessionByName,
        defaultCampusId: activeCampuses[0]?.id,
        regToStudent,
        emailToStudentId,
        rollToStudentId,
        aadhaarToStudentId,
        rfidToStudentId,
        fileRegs,
        fileRolls,
        fileEmails,
        fileAadhaars,
        fileRfids,
        categoryByCode,
        religionByKey,
        fyugp: {
          subjectMasters,
          offerings: courseOfferings,
        },
      }),
    );
  }
  private validateRow(
    row: ParsedImportRow,
    ctx: {
      importMode: StudentImportMode;
      pvByCode: Map<string, string>;
      availableProgrammeCodes: string[];
      batchByCode: Map<
        string,
        {
          id: string;
          batchCode: string;
          currentSemester: number;
          cycleType: string;
          entrySessionId: string;
          institutionId: string;
          entrySession?: { name: string } | null;
        }
      >;
      semesters: {
        institutionId: string;
        semesterNumber: number;
        semesterType: string;
        isActive: boolean;
        timetableEnabled: boolean;
        registrationOpen: boolean;
      }[];
      streamByCode: Map<string, string>;
      shiftByCampusAndCode: Map<string, { id: string; campusId: string }>;
      deptByCode: Map<
        string,
        { id: string; campusId: string | null; departmentType?: string | null }
      >;
      sessionByName: Map<string, string>;
      defaultCampusId?: string;
      regToStudent: Map<string, ExistingStudentRef>;
      emailToStudentId: Map<string, string>;
      rollToStudentId: Map<string, string>;
      aadhaarToStudentId: Map<string, string>;
      rfidToStudentId: Map<string, string>;
      fileRegs: Set<string>;
      fileRolls: Set<string>;
      fileEmails: Set<string>;
      fileAadhaars: Set<string>;
      fileRfids: Set<string>;
      categoryByCode: Map<string, string>;
      religionByKey: Map<string, string>;
      fyugp: FyugpResolutionContext;
    },
  ): ImportRowValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const raw = row.raw;
    const enrollmentNumber = String(
      raw.registrationNumber ??
        raw.enrollmentNumber ??
        raw.applicationNumber ??
        raw.admissionNumber ??
        '',
    ).trim();
    const applicationNumber = String(raw.applicationNumber ?? '').trim();
    const admissionNumber = String(raw.admissionNumber ?? '').trim();
    const rollNumber = String(raw.rollNumber ?? '').trim();
    const fullName = String(raw.fullName ?? '').trim();
    const email = String(raw.email ?? '')
      .trim()
      .toLowerCase();
    const programmeCode = String(
      raw.programme ?? raw.programmeCode ?? raw.programCode ?? '',
    )
      .trim()
      .toUpperCase();
    const batchCode = String(
      raw.admissionBatch ?? raw.batchCode ?? raw.batch ?? '',
    )
      .trim()
      .toUpperCase();
    const streamCode = String(raw.stream ?? raw.streamCode ?? '')
      .trim()
      .toUpperCase();
    const shiftCode = String(raw.shift ?? raw.shiftCode ?? '')
      .trim()
      .toUpperCase();
    const academicSessionRaw = String(
      raw.academicSession ?? raw.session ?? '',
    ).trim();
    const studentStatus = String(raw.studentStatus ?? '').trim() || undefined;
    const aadhaar = String(raw.aadhaar ?? raw.nationalId ?? '').trim();
    const fatherName = String(raw.fatherName ?? '').trim() || undefined;
    const motherName = String(raw.motherName ?? '').trim() || undefined;
    const rfidNumber =
      String(raw.rfid ?? raw.rfidNumber ?? '').trim() || undefined;
    if (!enrollmentNumber)
      errors.push(
        'Registration number is required (use Application Number if roll not assigned yet)',
      );
    if (!fullName) errors.push('Full name is required');
    if (!email || !email.includes('@')) errors.push('Valid email is required');
    if (!programmeCode) errors.push('Programme code is required');
    if (!batchCode) errors.push('Batch code is required');
    if (!streamCode) errors.push('Stream code is required');
    if (!shiftCode) errors.push('Shift code is required');
    const usedApplicationAsReg =
      !String(raw.registrationNumber ?? raw.enrollmentNumber ?? '').trim() &&
      Boolean(applicationNumber || admissionNumber);
    if (usedApplicationAsReg) {
      warnings.push(
        'Using Application/Admission number as registration number until a roll number is assigned.',
      );
    }
    const regKey = enrollmentNumber.toUpperCase();
    const existingStudent = enrollmentNumber
      ? ctx.regToStudent.get(regKey)
      : undefined;
    let existingStudentId: string | undefined;
    if (enrollmentNumber) {
      if (ctx.fileRegs.has(regKey)) {
        errors.push('Duplicate registration number');
      } else {
        ctx.fileRegs.add(regKey);
        if (existingStudent) {
          if (ctx.importMode === 'MERGE') {
            existingStudentId = existingStudent.id;
          } else {
            errors.push('Duplicate registration number');
          }
        }
      }
    }
    const ownerId = existingStudentId;
    if (rollNumber) {
      const rollKey = rollNumber.toUpperCase();
      const dbOwner = ctx.rollToStudentId.get(rollKey);
      if (ctx.fileRolls.has(rollKey)) {
        errors.push('Duplicate roll number');
      } else if (dbOwner && dbOwner !== ownerId) {
        errors.push('Duplicate roll number');
      } else {
        ctx.fileRolls.add(rollKey);
      }
    }
    if (email) {
      const dbOwner = ctx.emailToStudentId.get(email);
      const fileDup = ctx.fileEmails.has(email);
      if (fileDup) {
        errors.push('Duplicate email');
      } else if (dbOwner && dbOwner !== ownerId) {
        errors.push('Duplicate email');
      } else {
        ctx.fileEmails.add(email);
      }
    }
    if (aadhaar) {
      const aadhaarKey = aadhaar.toUpperCase();
      const dbOwner = ctx.aadhaarToStudentId.get(aadhaarKey);
      const fileDup = ctx.fileAadhaars.has(aadhaarKey);
      if (fileDup) {
        errors.push('Duplicate Aadhaar number');
      } else if (dbOwner && dbOwner !== ownerId) {
        errors.push('Duplicate Aadhaar number');
      } else {
        ctx.fileAadhaars.add(aadhaarKey);
      }
    }
    if (rfidNumber) {
      const rfidKey = rfidNumber.toUpperCase();
      const dbOwner = ctx.rfidToStudentId.get(rfidKey);
      const fileDup = ctx.fileRfids.has(rfidKey);
      if (fileDup) {
        errors.push('Duplicate RFID number');
      } else if (dbOwner && dbOwner !== ownerId) {
        errors.push('Duplicate RFID number');
      } else {
        ctx.fileRfids.add(rfidKey);
      }
    }
    const programVersionId =
      ctx.pvByCode.get(programmeCode) ??
      ctx.pvByCode.get(this.normalizeProgrammeCode(programmeCode));
    if (programmeCode && !programVersionId) {
      const suggestions = this.programmeSuggestions(
        programmeCode,
        ctx.availableProgrammeCodes,
      );
      errors.push(
        suggestions.length
          ? `Unknown programme code: ${programmeCode}. Available matching programme codes: ${suggestions.join(', ')}`
          : `Unknown programme code: ${programmeCode}. Publish the programme version or use one of: ${ctx.availableProgrammeCodes.slice(0, PROGRAMME_LOOKUP_LIMIT).join(', ') || 'no published programmes configured'}`,
      );
    }
    const batch = ctx.batchByCode.get(batchCode);
    const admissionBatchId = batch?.id;
    if (batchCode && !admissionBatchId) {
      errors.push(`Unknown batch code: ${batchCode}`);
    }
    const streamId = ctx.streamByCode.get(streamCode);
    if (streamCode && !streamId) {
      errors.push(`Unknown stream code: ${streamCode}`);
    }
    const deptCode = String(
      raw.department ?? raw.departmentCode ?? raw.majorDeptCode ?? '',
    )
      .trim()
      .toUpperCase();
    const department = deptCode ? ctx.deptByCode.get(deptCode) : undefined;
    const departmentId = department?.id;
    if (deptCode && !departmentId) {
      errors.push(`Unknown department code: ${deptCode}`);
    } else if (department && !isAcademicDepartment(department.departmentType)) {
      errors.push(
        `Department ${deptCode} is administrative and cannot be assigned to a student`,
      );
    }
    const campusId = department?.campusId ?? ctx.defaultCampusId;
    const shift =
      campusId && shiftCode
        ? ctx.shiftByCampusAndCode.get(`${campusId}:${shiftCode}`)
        : undefined;
    if (shiftCode && !shift) {
      errors.push(`Unknown shift code: ${shiftCode}`);
    }
    let sessionId: string | undefined;
    if (academicSessionRaw) {
      const normalizedAcademicSession =
        this.normalizeAcademicSession(academicSessionRaw);
      const batchEntrySessionName = batch?.entrySession?.name;
      if (
        batch &&
        batchEntrySessionName &&
        normalizedAcademicSession ===
          this.normalizeAcademicSession(batchEntrySessionName)
      ) {
        sessionId = batch.entrySessionId;
      } else {
        sessionId = ctx.sessionByName.get(normalizedAcademicSession);
      }
      if (!sessionId) {
        errors.push(`Unknown academic session: ${academicSessionRaw}`);
      } else if (batch && batch.entrySessionId !== sessionId) {
        errors.push(
          `Academic session "${academicSessionRaw}" does not match admission batch "${batch.batchCode}" entry session "${batch.entrySession?.name ?? batch.entrySessionId}".`,
        );
      }
    } else if (batch) {
      sessionId = batch.entrySessionId;
    }
    let currentSemester: number | undefined;
    let semesterOverride = false;
    const currentSemesterRaw = raw.currentSemester;
    if (
      currentSemesterRaw != null &&
      String(currentSemesterRaw).trim() !== ''
    ) {
      currentSemester = parseInt(String(currentSemesterRaw), 10);
      if (Number.isNaN(currentSemester) || currentSemester < 1) {
        errors.push('Invalid current semester');
        currentSemester = undefined;
      } else if (batch && currentSemester !== batch.currentSemester) {
        semesterOverride = true;
      }
    }
    const categoryCode = String(raw.category ?? raw.categoryCode ?? '')
      .trim()
      .toUpperCase();
    const categoryLookupId = categoryCode
      ? ctx.categoryByCode.get(categoryCode)
      : undefined;
    if (categoryCode && !categoryLookupId) {
      errors.push(`Unknown category code: ${categoryCode}`);
    }
    const religionRaw = String(raw.religion ?? '').trim();
    let religionLookupId: string | undefined;
    if (religionRaw) {
      religionLookupId =
        ctx.religionByKey.get(religionRaw.toUpperCase()) ??
        ctx.religionByKey.get(religionRaw.toLowerCase());
      if (!religionLookupId) {
        errors.push(`Unknown religion: ${religionRaw}`);
      }
    }
    const targetSemester = currentSemester ?? batch?.currentSemester;
    if (batch && targetSemester) {
      const activeMode = this.activeSemesterMode(batch, ctx.semesters);
      const requestedMode = targetSemester % 2 === 0 ? 'EVEN' : 'ODD';
      if (activeMode && requestedMode !== activeMode) {
        errors.push(
          `Semester ${targetSemester} is not allowed in the active ${activeMode} cycle.`,
        );
      }
    }
    const fyugpMapping = this.resolveFyugpMapping(raw, {
      programVersionId,
      semesterSequence: targetSemester,
      shiftId: shift?.id,
      fyugp: ctx.fyugp,
      errors,
      warnings,
    });
    const majorSubjectSlug = fyugpMapping.major?.subjectSlug;
    const minorSubjectSlug = fyugpMapping.minor?.subjectSlug;
    const turaLine1 = String(raw.turaLine1 ?? raw.addressInTura ?? '').trim();
    const turaCity = String(raw.turaCity ?? '').trim();
    const turaState = String(raw.turaState ?? raw.state ?? '').trim();
    const turaPinCode = String(raw.turaPinCode ?? '').trim();
    const homeLine1 = String(raw.homeLine1 ?? raw.homeAddress ?? '').trim();
    const homeCity = String(raw.homeCity ?? '').trim();
    const homeState = String(raw.homeState ?? '').trim();
    const homePinCode = String(raw.homePinCode ?? '').trim();
    const turaAddress =
      turaLine1 || turaCity || turaState || turaPinCode
        ? {
            line1: turaLine1 || undefined,
            city: turaCity || undefined,
            state: turaState || undefined,
            pinCode: turaPinCode || undefined,
          }
        : undefined;
    const homeAddress =
      homeLine1 || homeCity || homeState || homePinCode
        ? {
            line1: homeLine1 || undefined,
            city: homeCity || undefined,
            state: homeState || undefined,
            pinCode: homePinCode || undefined,
          }
        : undefined;
    const normalized: NormalizedStudentImportRow | undefined =
      errors.length === 0 &&
      programVersionId &&
      admissionBatchId &&
      streamId &&
      shift
        ? {
            email,
            enrollmentNumber,
            applicationNumber: applicationNumber || undefined,
            admissionNumber: admissionNumber || undefined,
            rollNumber: rollNumber || undefined,
            fullName,
            mobileNumber:
              String(raw.mobile ?? raw.mobileNumber ?? '').trim() || undefined,
            programVersionId,
            admissionBatchId,
            streamId,
            shiftId: shift.id,
            departmentId,
            sessionId,
            currentSemester,
            studentStatus,
            gender: String(raw.gender ?? '').trim() || undefined,
            dateOfBirth: String(raw.dateOfBirth ?? '').trim() || undefined,
            categoryLookupId,
            religionLookupId,
            nationalId: aadhaar || undefined,
            fatherName,
            motherName,
            rfidNumber,
            majorSubjectSlug,
            minorSubjectSlug,
            academicMapping: fyugpMapping,
            existingStudentId,
            semesterOverride: semesterOverride || undefined,
            turaAddress,
            homeAddress,
          }
        : undefined;
    return {
      rowNumber: row.rowNumber,
      status: errors.length ? 'INVALID' : 'VALID',
      raw,
      normalized,
      errors,
      warnings,
      displayCode: enrollmentNumber || undefined,
      displayTitle: fullName || undefined,
    };
  }
  async commitRows(
    ctx: ImportModuleHandlerContext,
    rows: { rowNumber: number; normalized: NormalizedStudentImportRow }[],
  ) {
    const created: { rowNumber: number; entityId: string }[] = [];
    for (const row of rows) {
      const n = row.normalized;
      try {
        const studentId = n.existingStudentId
          ? await this.mergeStudentRecord(ctx, n.existingStudentId, n)
          : await this.createStudentRecord(ctx, n);
        created.push({ rowNumber: row.rowNumber, entityId: studentId });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown import error';
        throw new BadRequestException(
          `Row ${row.rowNumber} (${n.enrollmentNumber || n.email}): ${message}`,
        );
      }
    }
    return created;
  }

  private resolveFyugpMapping(
    raw: Record<string, unknown>,
    ctx: {
      programVersionId?: string;
      semesterSequence?: number;
      shiftId?: string;
      fyugp: FyugpResolutionContext;
      errors: string[];
      warnings: string[];
    },
  ): FyugpAcademicMapping {
    const mapping: FyugpAcademicMapping = {
      tutorialGroup: this.readText(raw, 'tutorialGroup'),
      labBatch: this.readText(raw, 'labBatch'),
    };
    const defaultSectionCode =
      this.firstText(raw, ['sectionCode']) ??
      mapping.tutorialGroup ??
      undefined;
    const sectionPreferences = this.buildSectionPreferences(
      raw,
      defaultSectionCode,
    );
    const subjectCtx = { ...ctx, sectionPreferences, defaultSectionCode };
    const requests: [
      keyof FyugpAcademicMapping,
      FyugpCategory,
      string | undefined,
      'CODE' | 'LEGACY',
    ][] = [
      [
        'major',
        'MAJOR',
        this.firstText(raw, [
          'majorCourseCode',
          'majorCode',
          'majorSubjectCode',
        ]),
        'CODE',
      ],
      [
        'minor',
        'MINOR',
        this.firstText(raw, [
          'minorCourseCode',
          'minorCode',
          'minorSubjectCode',
        ]),
        'CODE',
      ],
      ['mdc', 'MDC', this.firstText(raw, ['mdcCourseCode', 'mdcCode']), 'CODE'],
      ['aec', 'AEC', this.firstText(raw, ['aecCourseCode', 'aecCode']), 'CODE'],
      ['sec', 'SEC', this.firstText(raw, ['secCourseCode', 'secCode']), 'CODE'],
      ['vac', 'VAC', this.firstText(raw, ['vacCourseCode', 'vacCode']), 'CODE'],
      [
        'major',
        'MAJOR',
        this.firstText(raw, ['majorSubject', 'majorSubjectSlug']),
        'LEGACY',
      ],
      [
        'minor',
        'MINOR',
        this.firstText(raw, ['minorSubject', 'minorSubjectSlug']),
        'LEGACY',
      ],
      ['mdc', 'MDC', this.readText(raw, 'mdcSubject'), 'LEGACY'],
      ['aec', 'AEC', this.readText(raw, 'aecSubject'), 'LEGACY'],
      [
        'sec',
        'SEC',
        this.firstText(raw, ['secSubject', 'skillPaper']),
        'LEGACY',
      ],
      ['vac', 'VAC', this.readText(raw, 'vacSubject'), 'LEGACY'],
    ];

    for (const [key, category, input, mode] of requests) {
      if (!input) continue;
      if (mapping[key as keyof FyugpAcademicMapping]) {
        continue;
      }
      const resolved = this.resolveSubjectInput(
        input,
        category,
        subjectCtx,
        mode,
      );
      if (resolved) {
        (
          mapping as Record<string, FyugpResolvedSelection | string | undefined>
        )[key] = resolved;
        ctx.warnings.push(...(resolved.warnings ?? []));
        if (mode === 'LEGACY') {
          ctx.warnings.push(
            `${category} uses a legacy name-based column. Use ${category}_CODE for safer imports.`,
          );
        }
      }
    }
    const seen = new Map<string, FyugpCategory>();
    for (const selection of [
      mapping.major,
      mapping.minor,
      mapping.mdc,
      mapping.aec,
      mapping.sec,
      mapping.vac,
    ]) {
      if (!selection) continue;
      const duplicateKey =
        selection.courseId ??
        selection.subjectSlug ??
        this.normalizeSubjectKey(selection.resolvedLabel);
      const previous = seen.get(duplicateKey);
      if (previous) {
        ctx.errors.push(
          `Duplicate subject allocation: ${selection.resolvedLabel} is already selected for ${previous}.`,
        );
      } else {
        seen.set(duplicateKey, selection.category);
      }
    }

    return mapping;
  }

  private buildSectionPreferences(
    raw: Record<string, unknown>,
    defaultSectionCode?: string,
  ): Partial<Record<FyugpCategory, string>> {
    const prefs: Partial<Record<FyugpCategory, string>> = {};
    const categories: { category: FyugpCategory; keys: string[] }[] = [
      { category: 'MAJOR', keys: ['majorSection'] },
      { category: 'MINOR', keys: ['minorSection'] },
      { category: 'MDC', keys: ['mdcSection'] },
      { category: 'AEC', keys: ['aecSection'] },
      { category: 'SEC', keys: ['secSection'] },
      { category: 'VAC', keys: ['vacSection'] },
    ];
    for (const { category, keys } of categories) {
      const value = this.firstText(raw, keys) ?? defaultSectionCode;
      if (value) prefs[category] = value;
    }
    return prefs;
  }

  private resolveSubjectInput(
    input: string,
    category: FyugpCategory,
    ctx: {
      programVersionId?: string;
      semesterSequence?: number;
      shiftId?: string;
      fyugp: FyugpResolutionContext;
      errors: string[];
      warnings?: string[];
      sectionPreferences?: Partial<Record<FyugpCategory, string>>;
      defaultSectionCode?: string;
    },
    mode: 'CODE' | 'LEGACY',
  ): FyugpResolvedSelection | undefined {
    const normalized = this.normalizeSubjectKey(input);
    if (mode === 'CODE') {
      return this.resolveSubjectCodeInput(input, normalized, category, ctx);
    }

    const ambiguousNameMatches = ctx.fyugp.offerings.filter((offering) =>
      this.keyMatches(
        [this.normalizeSubjectKey(offering.course.title)],
        normalized,
      ),
    );
    const ambiguousCategories = new Set(
      ambiguousNameMatches.map((offering) =>
        this.offeringCategoryLabel(offering),
      ),
    );
    if (ambiguousCategories.size > 1) {
      ctx.errors.push(
        `Multiple papers found with name "${input}". Please use course code.`,
      );
      return undefined;
    }

    const subjectMatches = ctx.fyugp.subjectMasters.filter((subject) =>
      this.subjectMatches(subject, normalized),
    );
    const activeSubjects = subjectMatches.filter((subject) => subject.isActive);
    if (subjectMatches.length && !activeSubjects.length) {
      ctx.errors.push(`Inactive subject: ${input}`);
      return undefined;
    }
    if (activeSubjects.length > 1) {
      ctx.errors.push(
        `Duplicate mapping for ${category} Subject "${input}": ${activeSubjects
          .map((s) => s.name)
          .join(', ')}`,
      );
      return undefined;
    }
    const subject = activeSubjects[0];

    const categoryOfferings = this.offeringCandidatesForImportCategory(
      category,
      ctx,
    );
    const crossCategoryMatches = ctx.fyugp.offerings.filter((offering) => {
      if (this.offeringHasCategory(offering, category)) return false;
      if ((category === 'MAJOR' || category === 'MINOR') && subject)
        return false;
      return this.offeringMatches(offering, normalized, category, subject);
    });
    const ownMajorMatch =
      category === 'MAJOR' &&
      categoryOfferings.some(
        (offering) =>
          this.offeringMatches(offering, normalized, category, subject) &&
          this.offeringInScope(
            offering,
            category,
            ctx.programVersionId,
            ctx.semesterSequence,
          ),
      );
    if (
      crossCategoryMatches.length &&
      !(category === 'MINOR' && this.fyugpMinorUsesCrossMajor(ctx)) &&
      !ownMajorMatch
    ) {
      const actual = this.offeringCategoryLabel(crossCategoryMatches[0]);
      ctx.errors.push(
        `${category} Subject "${input}" is configured as ${actual}, not ${category}.`,
      );
      return undefined;
    }

    const offeringMatches = categoryOfferings.filter((offering) =>
      this.offeringMatches(offering, normalized, category, subject),
    );
    const scoped = offeringMatches.filter((offering) =>
      this.offeringInImportScope(
        offering,
        category,
        ctx.programVersionId,
        ctx.semesterSequence,
      ),
    );
    if (offeringMatches.length && !scoped.length) {
      ctx.errors.push(
        `${category} Subject "${input}" is not configured for the selected programme, semester, or shift.`,
      );
      return undefined;
    }
    if (!subject && !scoped.length) {
      ctx.errors.push(`Unknown ${category} Subject: ${input}`);
      return undefined;
    }
    if (
      (category === 'MDC' ||
        category === 'AEC' ||
        category === 'SEC' ||
        category === 'VAC') &&
      !scoped.length
    ) {
      ctx.errors.push(
        `${category} Paper "${input}" is not available in active course offerings.`,
      );
      return undefined;
    }
    if (scoped.length > 1) {
      const uniqueCourseIds = new Set(
        scoped.map((offering) => offering.courseId),
      );
      if (uniqueCourseIds.size > 1) {
        ctx.errors.push(
          `Duplicate mapping for ${category} Subject "${input}": ${scoped
            .map((offering) => offering.course.title)
            .join(', ')}`,
        );
        return undefined;
      }
    }

    const picked = this.pickBestOffering(scoped, ctx.shiftId);
    const preferredSection =
      ctx.sectionPreferences?.[category] ?? ctx.defaultSectionCode;
    const sectionResult = this.resolveOfferingSection(
      picked?.sections ?? [],
      ctx.shiftId,
      preferredSection,
    );
    if (sectionResult.error) {
      ctx.errors.push(`${category}: ${sectionResult.error}`);
      return undefined;
    }
    const section = sectionResult.section;
    const warnings: string[] = [...(sectionResult.warnings ?? [])];
    if (
      section?.seatLedger &&
      section.seatLedger.confirmedCount >= section.capacity
    ) {
      warnings.push(
        `${category} Subject "${input}" section ${section.sectionCode} is at or above capacity.`,
      );
    }
    const subjectSlug =
      subject?.slug ??
      picked?.course.subjectSlug ??
      this.subjectSlugForOffering(picked, ctx.fyugp.subjectMasters, category);

    return {
      category,
      input,
      resolvedLabel: picked?.course.title ?? subject?.name ?? input,
      courseCode: picked?.course.code,
      resolutionMode: picked?.course.code
        ? 'CODE'
        : subject?.slug
          ? 'SLUG'
          : 'NAME',
      subjectSlug,
      courseId: picked?.courseId,
      courseOfferingId: picked?.id,
      offeringSectionId: section?.id,
      sectionCode: section?.sectionCode,
      categoryPoolId: picked?.categoryPoolId ?? undefined,
      warnings,
    };
  }

  private resolveSubjectCodeInput(
    input: string,
    normalized: string,
    category: FyugpCategory,
    ctx: {
      programVersionId?: string;
      semesterSequence?: number;
      shiftId?: string;
      fyugp: FyugpResolutionContext;
      errors: string[];
      warnings?: string[];
      sectionPreferences?: Partial<Record<FyugpCategory, string>>;
      defaultSectionCode?: string;
    },
  ): FyugpResolvedSelection | undefined {
    const codeMatches = ctx.fyugp.offerings.filter(
      (offering) =>
        this.normalizeSubjectKey(offering.course.code) === normalized,
    );
    if (!codeMatches.length) {
      ctx.errors.push(
        `Invalid ${category} mapping. Provided ${category}_CODE = ${input}. No active paper found with this code.`,
      );
      return undefined;
    }

    const categoryMatches = this.codeOfferingCandidatesForCategory(
      codeMatches,
      category,
      ctx,
    );
    if (!categoryMatches.length) {
      const found = codeMatches[0];
      ctx.errors.push(
        [
          `Invalid ${category} mapping.`,
          `Provided: ${category}_CODE = ${input}`,
          `Expected Category = ${category}`,
          `Found Category = ${this.offeringCategoryLabel(found) || 'UNKNOWN'}`,
          `Paper: ${found.course.title}`,
        ].join(' '),
      );
      return undefined;
    }

    const scoped = categoryMatches.filter((offering) =>
      this.offeringInImportScope(
        offering,
        category,
        ctx.programVersionId,
        ctx.semesterSequence,
      ),
    );
    if (!scoped.length) {
      const found = categoryMatches[0];
      ctx.errors.push(
        `${category}_CODE ${input} (${found.course.title}) is not configured for the selected programme or semester.`,
      );
      return undefined;
    }

    const picked = this.pickBestOffering(scoped, ctx.shiftId);
    const preferredSection =
      ctx.sectionPreferences?.[category] ?? ctx.defaultSectionCode;
    const sectionResult = this.resolveOfferingSection(
      picked?.sections ?? [],
      ctx.shiftId,
      preferredSection,
    );
    if (sectionResult.error) {
      ctx.errors.push(`${category}: ${sectionResult.error}`);
      return undefined;
    }
    const section = sectionResult.section;
    const warnings: string[] = [...(sectionResult.warnings ?? [])];
    if (
      section?.seatLedger &&
      section.seatLedger.confirmedCount >= section.capacity
    ) {
      warnings.push(
        `${category}_CODE ${input} section ${section.sectionCode} is at or above capacity.`,
      );
    }
    const subjectSlug =
      picked?.course.subjectSlug ??
      this.subjectSlugForOffering(picked, ctx.fyugp.subjectMasters, category);

    return {
      category,
      input,
      resolvedLabel: picked?.course.title ?? input,
      courseCode: picked?.course.code ?? input,
      resolutionMode: 'CODE',
      subjectSlug,
      courseId: picked?.courseId,
      courseOfferingId: picked?.id,
      offeringSectionId: section?.id,
      sectionCode: section?.sectionCode,
      categoryPoolId: picked?.categoryPoolId ?? undefined,
      warnings,
    };
  }

  private subjectMatches(subject: SubjectMasterRow, normalized: string) {
    const keys = [
      subject.name,
      subject.slug,
      subject.programmeGroup,
      subject.department?.name,
      subject.department?.code,
    ]
      .filter(Boolean)
      .map((value) => this.normalizeSubjectKey(String(value)));
    return this.keyMatches(keys, normalized);
  }

  private subjectSlugForOffering(
    offering: OfferingCandidate | undefined,
    subjects: SubjectMasterRow[],
    category: FyugpCategory,
  ) {
    if (!offering || (category !== 'MAJOR' && category !== 'MINOR')) {
      return undefined;
    }
    const department = offering.course.department;
    const subject = subjects.find(
      (candidate) =>
        candidate.isActive &&
        ((department?.id && candidate.department?.id === department.id) ||
          (department?.code &&
            candidate.department?.code?.toUpperCase() ===
              department.code.toUpperCase()) ||
          (department?.name &&
            this.normalizeSubjectKey(candidate.name) ===
              this.normalizeSubjectKey(department.name))),
    );
    if (subject?.slug) return subject.slug;
    if (department?.name) return slugifySubject(department.name);
    return undefined;
  }

  private offeringMatches(
    offering: OfferingCandidate,
    normalized: string,
    category: FyugpCategory,
    subject?: SubjectMasterRow,
  ) {
    const keys = [
      offering.course.title,
      offering.course.code,
      offering.course.subjectSlug,
      offering.course.department?.name,
      offering.course.department?.code,
    ]
      .filter(Boolean)
      .map((value) => this.normalizeSubjectKey(String(value)));
    if (this.keyMatches(keys, normalized)) return true;
    if (subject?.slug && offering.course.subjectSlug === subject.slug)
      return true;
    return false;
  }

  private offeringHasCategory(
    offering: OfferingCandidate,
    category: FyugpCategory,
  ) {
    return this.offeringCategoryLabel(offering) === category;
  }

  private offeringCategoryLabel(offering: OfferingCandidate) {
    return String(
      offering.category ?? offering.categoryPool?.categoryType ?? '',
    ).toUpperCase();
  }

  private keyMatches(keys: string[], normalized: string) {
    const compact = this.compactSubjectKey(normalized);
    return keys.some((key) => {
      const keyCompact = this.compactSubjectKey(key);
      return (
        key === normalized ||
        keyCompact === compact ||
        this.aliasKey(key) === this.aliasKey(normalized)
      );
    });
  }

  private programmeLookupKeys(code: string, name?: string | null) {
    const values = [code, name].filter(Boolean).flatMap((value) => {
      const text = String(value);
      return [
        text.trim().toUpperCase(),
        this.normalizeProgrammeCode(text),
        this.normalizeSubjectKey(text).toUpperCase(),
      ];
    });
    return [...new Set(values.filter(Boolean))];
  }

  private normalizeProgrammeCode(value: string) {
    return value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '');
  }

  private normalizeAcademicSession(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[\u2010-\u2015]/g, '-')
      .replace(/\s+/g, '');
  }

  private programmeSuggestions(input: string, available: string[]) {
    const normalized = this.normalizeProgrammeCode(input);
    return available
      .filter((code) => {
        const candidate = this.normalizeProgrammeCode(code);
        return (
          candidate.includes(normalized) ||
          normalized.includes(candidate) ||
          candidate.split('').filter((char) => normalized.includes(char))
            .length >= Math.min(4, normalized.length)
        );
      })
      .slice(0, PROGRAMME_LOOKUP_LIMIT);
  }

  private aliasKey(value: string) {
    return this.compactSubjectKey(value)
      .replace(/^polsci(ence)?$/, 'politicalscience')
      .replace(/^env(ironment)?stud(y|ies)$/, 'environmentstudies')
      .replace(/^comm(uncative|unicative)?eng(lish)?$/, 'communicativeenglish');
  }

  private fyugpMinorUsesCrossMajor(ctx: {
    programVersionId?: string;
    semesterSequence?: number;
  }) {
    return ctx.semesterSequence === 1 || ctx.semesterSequence === 3;
  }

  private offeringCandidatesForImportCategory(
    category: FyugpCategory,
    ctx: {
      programVersionId?: string;
      semesterSequence?: number;
      fyugp: FyugpResolutionContext;
    },
  ) {
    if (category === 'MINOR' && this.fyugpMinorUsesCrossMajor(ctx)) {
      return ctx.fyugp.offerings.filter(
        (offering) =>
          this.offeringHasCategory(offering, 'MAJOR') &&
          (!ctx.semesterSequence ||
            offering.semesterSequence == null ||
            offering.semesterSequence === ctx.semesterSequence) &&
          offering.programVersionId &&
          offering.programVersionId !== ctx.programVersionId,
      );
    }
    return ctx.fyugp.offerings.filter((offering) =>
      this.offeringHasCategory(offering, category),
    );
  }

  private codeOfferingCandidatesForCategory(
    codeMatches: OfferingCandidate[],
    category: FyugpCategory,
    ctx: {
      programVersionId?: string;
      semesterSequence?: number;
    },
  ) {
    const direct = codeMatches.filter((offering) =>
      this.offeringHasCategory(offering, category),
    );
    if (
      direct.length ||
      category !== 'MINOR' ||
      !this.fyugpMinorUsesCrossMajor(ctx)
    ) {
      return direct;
    }
    return codeMatches.filter(
      (offering) =>
        this.offeringHasCategory(offering, 'MAJOR') &&
        offering.programVersionId &&
        offering.programVersionId !== ctx.programVersionId &&
        (!ctx.semesterSequence ||
          offering.semesterSequence == null ||
          offering.semesterSequence === ctx.semesterSequence),
    );
  }

  private offeringInImportScope(
    offering: OfferingCandidate,
    category: FyugpCategory,
    programVersionId?: string,
    semesterSequence?: number,
  ) {
    if (
      category === 'MINOR' &&
      this.fyugpMinorUsesCrossMajor({ programVersionId, semesterSequence })
    ) {
      if (
        semesterSequence &&
        offering.semesterSequence &&
        offering.semesterSequence !== semesterSequence
      ) {
        return false;
      }
      return Boolean(
        offering.programVersionId &&
        programVersionId &&
        offering.programVersionId !== programVersionId,
      );
    }
    return this.offeringInScope(
      offering,
      category,
      programVersionId,
      semesterSequence,
    );
  }

  private offeringInScope(
    offering: OfferingCandidate,
    category: FyugpCategory,
    programVersionId?: string,
    semesterSequence?: number,
  ) {
    if (
      semesterSequence &&
      offering.semesterSequence &&
      offering.semesterSequence !== semesterSequence
    ) {
      return false;
    }
    if (category === 'MAJOR' || category === 'MINOR') {
      return (
        !programVersionId ||
        !offering.programVersionId ||
        offering.programVersionId === programVersionId
      );
    }
    if (!programVersionId) return true;
    if (
      offering.programVersionId &&
      offering.programVersionId !== programVersionId
    ) {
      return false;
    }
    if (!offering.categoryPoolId) return true;
    return Boolean(
      offering.categoryPool?.assignments.some(
        (assignment) =>
          assignment.programVersionId === programVersionId &&
          (!semesterSequence || assignment.semesterNo === semesterSequence),
      ),
    );
  }

  private activeSemesterMode(
    batch: { institutionId: string; cycleType: string },
    semesters: {
      institutionId: string;
      semesterNumber: number;
      semesterType: string;
      isActive: boolean;
      timetableEnabled: boolean;
      registrationOpen: boolean;
    }[],
  ) {
    const active = semesters.filter(
      (semester) =>
        semester.institutionId === batch.institutionId &&
        (semester.isActive ||
          semester.timetableEnabled ||
          semester.registrationOpen),
    );
    if (!active.length)
      return String(batch.cycleType ?? '').toUpperCase() || undefined;
    const odd = active.some((semester) => semester.semesterNumber % 2 === 1);
    const even = active.some((semester) => semester.semesterNumber % 2 === 0);
    if (odd && !even) return 'ODD';
    if (even && !odd) return 'EVEN';
    return String(batch.cycleType ?? '').toUpperCase() || undefined;
  }

  private pickBestOffering(offerings: OfferingCandidate[], shiftId?: string) {
    return [...offerings].sort((a, b) => {
      const aShift = a.sections.some((section) => section.shiftId === shiftId)
        ? 0
        : 1;
      const bShift = b.sections.some((section) => section.shiftId === shiftId)
        ? 0
        : 1;
      return aShift - bShift;
    })[0];
  }

  private resolveOfferingSection(
    sections: OfferingCandidate['sections'],
    shiftId?: string,
    preferredSectionCode?: string,
  ): {
    section?: OfferingCandidate['sections'][number];
    warnings?: string[];
    error?: string;
  } {
    const scoped = shiftId
      ? sections.filter((section) => section.shiftId === shiftId)
      : sections;
    const pool = scoped.length ? scoped : sections;
    if (!pool.length) {
      return preferredSectionCode
        ? {
            error: `Section "${preferredSectionCode}" not found — no sections configured for this paper.`,
          }
        : { error: 'No sections configured for this paper.' };
    }
    if (preferredSectionCode) {
      const normalizedPreferred =
        this.normalizeSectionCode(preferredSectionCode);
      const exact = pool.find(
        (section) =>
          this.normalizeSectionCode(section.sectionCode) ===
          normalizedPreferred,
      );
      if (!exact) {
        const available = [
          ...new Set(pool.map((section) => section.sectionCode)),
        ].join(', ');
        return {
          error: `Section "${preferredSectionCode}" not found. Available: ${available || 'none'}.`,
        };
      }
      return { section: exact };
    }
    const section = [...pool].sort((a, b) => {
      const aLoad = a.seatLedger?.confirmedCount ?? 0;
      const bLoad = b.seatLedger?.confirmedCount ?? 0;
      return aLoad - bLoad;
    })[0];
    return { section, warnings: [] };
  }

  private normalizeSectionCode(value: string) {
    return value.trim().toUpperCase().replace(/\s+/g, '');
  }

  private firstText(raw: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = this.readText(raw, key);
      if (value) return value;
    }
    return undefined;
  }

  private readText(raw: Record<string, unknown>, key: string) {
    const value = raw[key];
    return value == null ? undefined : String(value).trim() || undefined;
  }

  private normalizeSubjectKey(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/\bpol\b/g, 'political')
      .replace(/\bsci\b/g, 'science')
      .replace(/\benv\b/g, 'environment')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private compactSubjectKey(value: string) {
    return this.normalizeSubjectKey(value).replace(/\s+/g, '');
  }

  private async createStudentRecord(
    ctx: ImportModuleHandlerContext,
    n: NormalizedStudentImportRow,
  ) {
    const { tenantId, userId, batchId } = ctx;
    const existingUser = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: n.email } },
    });
    const passwordHash = await bcrypt.hash('Student@123', 12);
    const studentRole = await this.prisma.role.findFirst({
      where: { tenantId, slug: 'student' },
    });
    const shift = await this.prisma.shift.findFirst({
      where: { id: n.shiftId, tenantId },
    });
    const batch = await this.prisma.admissionBatch.findFirst({
      where: { id: n.admissionBatchId, tenantId },
      include: { entrySession: true },
    });
    if (!batch) throw new BadRequestException('Invalid batch');
    const targetSemester =
      n.semesterOverride && n.currentSemester != null
        ? n.currentSemester
        : batch.currentSemester;
    const studentId = await this.prisma.$transaction(async (tx) => {
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: { passwordHash, isActive: true, deletedAt: null },
          })
        : await tx.user.create({
            data: {
              tenantId,
              email: n.email,
              passwordHash,
              emailVerifiedAt: new Date(),
              isActive: true,
            },
          });
      if (studentRole) {
        const hasRole = await tx.userRole.findFirst({
          where: { userId: user.id, roleId: studentRole.id, deletedAt: null },
        });
        if (!hasRole) {
          await tx.userRole.create({
            data: { userId: user.id, roleId: studentRole.id },
          });
        }
      }
      const student = await tx.student.create({
        data: {
          tenantId,
          userId: user.id,
          enrollmentNumber: n.enrollmentNumber,
          applicationNumber: n.applicationNumber,
          admissionNumber: n.admissionNumber,
          rollNumber: n.rollNumber,
          rfidNumber: n.rfidNumber,
          programVersionId: n.programVersionId,
          primaryShiftId: n.shiftId,
          campusId: shift?.campusId,
          departmentId: n.departmentId,
          admissionDate: new Date(),
          importSource: 'IMPORT',
          importBatchId: batchId,
          createdById: userId,
        },
      });
      await tx.studentProfile.create({
        data: {
          tenantId,
          studentId: student.id,
          fullName: n.fullName,
          email: n.email,
          gender: n.gender,
          dateOfBirth: n.dateOfBirth ? new Date(n.dateOfBirth) : null,
          mobileNumber: n.mobileNumber,
          nationalId: n.nationalId,
          categoryLookupId: n.categoryLookupId,
          religionLookupId: n.religionLookupId,
          studentStatus: n.studentStatus ?? 'STUDYING',
        },
      });
      await this.upsertGuardians(tx, tenantId, student.id, n);
      await this.upsertAddresses(tx, tenantId, student.id, n);
      await this.createAcademicOnboardingRegistration(
        tx,
        tenantId,
        student.id,
        n,
        targetSemester,
      );
      await tx.studentAcademicStanding.upsert({
        where: { studentId: student.id },
        create: {
          tenantId,
          studentId: student.id,
          currentSemesterSequence: targetSemester,
          lifecycleState: 'ACTIVE',
          programmeStatus: 'IN_PROGRESS',
        },
        update: { currentSemesterSequence: targetSemester },
      });
      return student.id;
    });
    await this.academicEngine.bootstrapStudentAcademic(tenantId, studentId, {
      streamId: n.streamId,
      departmentId: n.departmentId,
      admissionBatchId: n.admissionBatchId,
      admissionYearId: batch.entrySessionId,
      institutionId: batch.entrySession?.institutionId ?? undefined,
      majorSubjectSlug: n.majorSubjectSlug,
      minorSubjectSlug: n.minorSubjectSlug,
    });
    return studentId;
  }
  private async mergeStudentRecord(
    ctx: ImportModuleHandlerContext,
    studentId: string,
    n: NormalizedStudentImportRow,
  ) {
    const { tenantId, userId, batchId } = ctx;
    const existing = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: { masterProfile: true, user: true },
    });
    if (!existing) throw new BadRequestException('Student not found for merge');
    const shift = n.shiftId
      ? await this.prisma.shift.findFirst({
          where: { id: n.shiftId, tenantId },
        })
      : null;
    const batch = await this.prisma.admissionBatch.findFirst({
      where: { id: n.admissionBatchId, tenantId },
      include: { entrySession: true },
    });
    if (!batch) throw new BadRequestException('Invalid batch');
    const targetSemester =
      n.semesterOverride && n.currentSemester != null
        ? n.currentSemester
        : batch.currentSemester;
    await this.prisma.$transaction(async (tx) => {
      const studentUpdates: Record<string, unknown> = {
        importBatchId: batchId,
        importSource: 'IMPORT',
        lastModifiedById: userId,
      };
      if (n.applicationNumber)
        studentUpdates.applicationNumber = n.applicationNumber;
      if (n.admissionNumber) studentUpdates.admissionNumber = n.admissionNumber;
      if (n.rollNumber) studentUpdates.rollNumber = n.rollNumber;
      if (n.rfidNumber) studentUpdates.rfidNumber = n.rfidNumber;
      if (n.programVersionId)
        studentUpdates.programVersionId = n.programVersionId;
      if (n.shiftId) studentUpdates.primaryShiftId = n.shiftId;
      if (shift?.campusId) studentUpdates.campusId = shift.campusId;
      if (n.departmentId) studentUpdates.departmentId = n.departmentId;
      await tx.student.update({
        where: { id: studentId },
        data: studentUpdates,
      });
      const profileUpdates: Prisma.StudentProfileUpdateInput = {};
      if (n.fullName) profileUpdates.fullName = n.fullName;
      if (n.email) profileUpdates.email = n.email;
      if (n.gender) profileUpdates.gender = n.gender;
      if (n.dateOfBirth) profileUpdates.dateOfBirth = new Date(n.dateOfBirth);
      if (n.mobileNumber) profileUpdates.mobileNumber = n.mobileNumber;
      if (n.nationalId) profileUpdates.nationalId = n.nationalId;
      if (n.categoryLookupId)
        profileUpdates.categoryLookupId = n.categoryLookupId;
      if (n.religionLookupId)
        profileUpdates.religionLookupId = n.religionLookupId;
      if (n.studentStatus) profileUpdates.studentStatus = n.studentStatus;
      if (Object.keys(profileUpdates).length > 0) {
        await tx.studentProfile.upsert({
          where: { studentId },
          create: {
            tenantId,
            studentId,
            fullName: n.fullName,
            email: n.email,
            gender: n.gender,
            dateOfBirth: n.dateOfBirth ? new Date(n.dateOfBirth) : null,
            mobileNumber: n.mobileNumber,
            nationalId: n.nationalId,
            categoryLookupId: n.categoryLookupId,
            religionLookupId: n.religionLookupId,
            studentStatus: n.studentStatus ?? 'STUDYING',
          },
          update: profileUpdates,
        });
        await this.writeProfileAuditLogs(
          tx,
          tenantId,
          studentId,
          userId,
          existing.masterProfile,
          profileUpdates,
        );
      }
      await this.upsertGuardians(tx, tenantId, studentId, n);
      await this.upsertAddresses(tx, tenantId, studentId, n);
      if (n.streamId || n.admissionBatchId) {
        await tx.studentAcademicProfile.upsert({
          where: { studentId },
          create: {
            tenantId,
            studentId,
            streamId: n.streamId,
            admissionBatchId: n.admissionBatchId,
            class12Subjects: [],
          },
          update: {
            ...(n.streamId ? { streamId: n.streamId } : {}),
            ...(n.admissionBatchId
              ? { admissionBatchId: n.admissionBatchId }
              : {}),
          },
        });
      }
      if (n.semesterOverride && n.currentSemester != null) {
        await tx.studentAcademicStanding.upsert({
          where: { studentId },
          create: {
            tenantId,
            studentId,
            currentSemesterSequence: targetSemester,
            lifecycleState: 'ACTIVE',
            programmeStatus: 'IN_PROGRESS',
          },
          update: { currentSemesterSequence: targetSemester },
        });
      } else if (n.admissionBatchId) {
        await this.semesterResolver.syncStandingToBatch(
          tenantId,
          studentId,
          n.admissionBatchId,
        );
      }
      await this.academicEngine.bootstrapStudentAcademic(tenantId, studentId, {
        streamId: n.streamId,
        departmentId: n.departmentId,
        admissionBatchId: n.admissionBatchId,
        admissionYearId: batch.entrySessionId,
        institutionId: batch.entrySession?.institutionId ?? undefined,
        majorSubjectSlug: n.majorSubjectSlug,
        minorSubjectSlug: n.minorSubjectSlug,
      });
      await this.createAcademicOnboardingRegistration(
        tx,
        tenantId,
        studentId,
        n,
        targetSemester,
      );
    });
    return studentId;
  }
  private async upsertGuardians(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    n: NormalizedStudentImportRow,
  ) {
    if (n.fatherName) {
      await tx.studentGuardian.upsert({
        where: {
          studentId_guardianType: { studentId, guardianType: 'FATHER' },
        },
        create: {
          tenantId,
          studentId,
          guardianType: 'FATHER',
          fullName: n.fatherName,
        },
        update: { fullName: n.fatherName },
      });
    }
    if (n.motherName) {
      await tx.studentGuardian.upsert({
        where: {
          studentId_guardianType: { studentId, guardianType: 'MOTHER' },
        },
        create: {
          tenantId,
          studentId,
          guardianType: 'MOTHER',
          fullName: n.motherName,
        },
        update: { fullName: n.motherName },
      });
    }
  }

  private async createAcademicOnboardingRegistration(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    n: NormalizedStudentImportRow,
    semesterSequence: number,
  ) {
    const mapping = n.academicMapping;
    if (!mapping) return;
    const selections = [
      mapping.major,
      mapping.minor,
      mapping.mdc,
      mapping.aec,
      mapping.sec,
      mapping.vac,
    ].filter((selection): selection is FyugpResolvedSelection =>
      Boolean(selection?.courseOfferingId),
    );
    if (!selections.length) return;

    const batch = await tx.admissionBatch.findFirst({
      where: { id: n.admissionBatchId, tenantId },
    });
    const semester = await tx.semester.findFirst({
      where: {
        tenantId,
        semesterNumber: semesterSequence,
        deletedAt: null,
        ...(batch?.institutionId ? { institutionId: batch.institutionId } : {}),
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    if (!semester) return;

    const registration = await tx.semesterRegistration.upsert({
      where: { studentId_semesterId: { studentId, semesterId: semester.id } },
      create: {
        tenantId,
        studentId,
        semesterId: semester.id,
        semesterSequence,
        shiftId: n.shiftId,
        status: 'draft',
      },
      update: {
        shiftId: n.shiftId,
        semesterSequence,
      },
    });

    for (const [index, selection] of selections.entries()) {
      const existing = await tx.semesterRegistrationLine.findFirst({
        where: {
          tenantId,
          registrationId: registration.id,
          offeringId: selection.courseOfferingId,
        },
      });
      const data = {
        tenantId,
        registrationId: registration.id,
        offeringId: selection.courseOfferingId as string,
        offeringSectionId: selection.offeringSectionId,
        category: selection.category,
        status: 'pending',
        priorityRank: index + 1,
        assignmentSource: selection.categoryPoolId ? 'SHARED_POOL' : 'DIRECT',
        registrationSource: 'STUDENT_IMPORT',
        generatedBy: 'FYUGP_IMPORT_ONBOARDING',
      };
      if (existing) {
        await tx.semesterRegistrationLine.update({
          where: { id: existing.id },
          data,
        });
      } else {
        const categoryExisting = await tx.semesterRegistrationLine.findFirst({
          where: {
            tenantId,
            registrationId: registration.id,
            category: selection.category,
          },
        });
        if (categoryExisting) {
          await tx.semesterRegistrationLine.update({
            where: { id: categoryExisting.id },
            data,
          });
        } else {
          await tx.semesterRegistrationLine.create({ data });
        }
      }
    }
  }

  private async upsertAddresses(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    n: NormalizedStudentImportRow,
  ) {
    if (n.turaAddress) {
      await tx.studentAddress.upsert({
        where: { studentId_addressType: { studentId, addressType: 'TURA' } },
        create: {
          tenantId,
          studentId,
          addressType: 'TURA',
          ...n.turaAddress,
        },
        update: n.turaAddress,
      });
    }
    if (n.homeAddress) {
      await tx.studentAddress.upsert({
        where: { studentId_addressType: { studentId, addressType: 'HOME' } },
        create: {
          tenantId,
          studentId,
          addressType: 'HOME',
          ...n.homeAddress,
        },
        update: n.homeAddress,
      });
    }
  }
  private async writeProfileAuditLogs(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    actorId: string,
    existing: { [key: string]: unknown } | null,
    updates: Prisma.StudentProfileUpdateInput,
  ) {
    const fieldMap: Record<string, keyof Prisma.StudentProfileUpdateInput> = {
      fullName: 'fullName',
      email: 'email',
      gender: 'gender',
      dateOfBirth: 'dateOfBirth',
      mobileNumber: 'mobileNumber',
      nationalId: 'nationalId',
      categoryLookupId: 'categoryLookupId',
      religionLookupId: 'religionLookupId',
      studentStatus: 'studentStatus',
    };
    for (const [fieldKey, prismaKey] of Object.entries(fieldMap)) {
      if (!(prismaKey in updates)) continue;
      const newVal = updates[prismaKey];
      const oldVal = existing?.[fieldKey];
      const oldStr =
        oldVal instanceof Date
          ? oldVal.toISOString().slice(0, 10)
          : oldVal != null
            ? String(oldVal)
            : null;
      const newStr =
        newVal instanceof Date
          ? newVal.toISOString().slice(0, 10)
          : newVal != null
            ? String(newVal)
            : null;
      if (oldStr === newStr) continue;
      await tx.studentProfileAuditLog.create({
        data: {
          tenantId,
          studentId,
          sectionKey: 'import',
          fieldKey,
          oldValue: oldStr,
          newValue: newStr,
          actorId,
        },
      });
    }
  }
  async buildTemplateWorkbook(options?: {
    mode?: 'blank' | 'prefilled';
    tenantId?: string;
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const students = workbook.addWorksheet('Students');
    const headers = this.columnDefs.map((c) => c.header);
    const helper = headers.map((header) => this.helperTextForHeader(header));
    students.addRow(headers);
    students.addRow(helper);
    if (options?.mode === 'prefilled' && options.tenantId) {
      for (const row of await this.prefilledTemplateRows(options.tenantId)) {
        students.addRow(this.templateRowValues(row));
      }
    } else {
      students.addRow(this.sampleTemplateRow());
    }
    students.getRow(1).font = { bold: true };
    students.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
    students.views = [{ state: 'frozen', ySplit: 2 }];
    students.columns.forEach((col) => {
      col.width = 22;
    });

    const references = await this.buildTemplateReferences();
    for (const ref of references) {
      const sheet = workbook.addWorksheet(ref.name);
      sheet.addRow(ref.headers);
      for (const row of ref.rows) sheet.addRow(row);
      sheet.getRow(1).font = { bold: true };
      sheet.columns.forEach((col) => {
        col.width = 28;
      });
    }
    const instructions = workbook.addWorksheet('Instructions');
    instructions.addRow(['Column', 'Description']);
    for (const col of this.columnDefs) {
      instructions.addRow([
        `${col.header}${col.required ? ' (required)' : ''}`,
        this.helperTextForHeader(col.header),
      ]);
    }
    instructions.getRow(1).font = { bold: true };
    instructions.columns.forEach((col) => {
      col.width = 34;
    });

    this.applyDropdowns(students, headers, references);
    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async buildSem1AdmissionTemplateWorkbook(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Admission');
    const headers = [...SEM1_ADMISSION_TEMPLATE_HEADERS];
    sheet.addRow(headers);
    sheet.addRow(
      headers.map(
        (h) =>
          SEM1_ADMISSION_TEMPLATE_HELPERS[h] ??
          'Optional — stored in student profile when supported',
      ),
    );
    sheet.addRow(headers.map((h) => SEM1_ADMISSION_SAMPLE_ROW[h] ?? ''));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
    sheet.views = [{ state: 'frozen', ySplit: 2 }];
    sheet.columns.forEach((col) => {
      col.width = 24;
    });

    const instructions = workbook.addWorksheet('Instructions');
    instructions.addRow(['Column', 'Notes']);
    for (const header of headers) {
      instructions.addRow([
        header,
        SEM1_ADMISSION_TEMPLATE_HELPERS[header] ??
          'Imported when mapped; extra columns are preserved for future profile fields.',
      ]);
    }
    instructions.getRow(1).font = { bold: true };
    instructions.columns.forEach((col) => {
      col.width = 36;
    });

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private async buildTemplateReferences(): Promise<TemplateReference[]> {
    const [subjects, courseOfferings, departments] = await Promise.all([
      this.prisma.academicSubject.findMany({
        where: { deletedAt: null, isActive: true },
        include: { department: { select: { code: true, name: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.courseOffering.findMany({
        where: {
          deletedAt: null,
          course: { deletedAt: null, status: 'ACTIVE' },
        },
        include: {
          course: {
            include: { department: { select: { code: true, name: true } } },
          },
          programVersion: {
            include: { program: { select: { code: true, name: true } } },
          },
          categoryPool: {
            include: {
              assignments: {
                where: { active: true },
                include: {
                  programVersion: {
                    include: {
                      program: { select: { code: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { course: { title: 'asc' } },
      }),
      this.prisma.department.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    ]);
    const byCategory = (category: FyugpCategory) =>
      courseOfferings
        .filter(
          (offering) =>
            String(
              offering.category ??
                offering.categoryPool?.categoryType ??
                offering.course.courseType,
            ).toUpperCase() === category,
        )
        .map((offering) => [
          this.templateCourseCode(offering.course.code),
          offering.course.title,
          String(
            offering.semesterSequence ??
              offering.categoryPool?.semesterNo ??
              '',
          ),
          offering.course.department?.name ?? '',
          this.programmeApplicability(offering),
        ]);
    const subjectFallback = (category: FyugpCategory) =>
      subjects.map((s) => [
        s.slug,
        s.name,
        'All eligible semesters',
        s.department?.name ?? '',
        `${category} subject master`,
      ]);
    return [
      {
        name: 'MAJOR Papers',
        headers: [
          'Code',
          'Name',
          'Semester',
          'Department',
          'Programme Applicability',
        ],
        rows: byCategory('MAJOR').length
          ? byCategory('MAJOR')
          : subjectFallback('MAJOR'),
      },
      {
        name: 'MINOR Papers',
        headers: [
          'Code',
          'Name',
          'Semester',
          'Department',
          'Programme Applicability',
        ],
        rows: byCategory('MINOR').length
          ? byCategory('MINOR')
          : subjectFallback('MINOR'),
      },
      {
        name: 'MDC Papers',
        headers: [
          'Code',
          'Name',
          'Semester',
          'Department',
          'Programme Applicability',
        ],
        rows: byCategory('MDC'),
      },
      {
        name: 'AEC Papers',
        headers: [
          'Code',
          'Name',
          'Semester',
          'Department',
          'Programme Applicability',
        ],
        rows: byCategory('AEC'),
      },
      {
        name: 'SEC Papers',
        headers: [
          'Code',
          'Name',
          'Semester',
          'Department',
          'Programme Applicability',
        ],
        rows: byCategory('SEC'),
      },
      {
        name: 'VAC Papers',
        headers: [
          'Code',
          'Name',
          'Semester',
          'Department',
          'Programme Applicability',
        ],
        rows: byCategory('VAC'),
      },
      {
        name: 'Departments',
        headers: ['Department Name', 'Code', 'Type'],
        rows: departments.map((d) => [d.name, d.code, d.departmentType]),
      },
    ];
  }

  private applyDropdowns(
    sheet: ExcelJS.Worksheet,
    headers: string[],
    references: { name: string; rows: (string | number | null)[][] }[],
  ) {
    const refByName = new Map(references.map((ref) => [ref.name, ref]));
    const dropdownMap: Record<string, string> = {
      MAJOR_CODE: 'MAJOR Papers',
      MINOR_CODE: 'MINOR Papers',
      MDC_CODE: 'MDC Papers',
      AEC_CODE: 'AEC Papers',
      SEC_CODE: 'SEC Papers',
      VAC_CODE: 'VAC Papers',
      Department: 'Departments',
    };
    for (const [header, refName] of Object.entries(dropdownMap)) {
      const columnIndex = headers.indexOf(header) + 1;
      const ref = refByName.get(refName);
      if (!columnIndex || !ref?.rows.length) continue;
      if (!ref.rows.length) continue;
      const formula = this.excelReferenceFormula(refName, ref.rows.length);
      for (let row = 3; row <= 1000; row += 1) {
        sheet.getCell(row, columnIndex).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: 'Invalid code',
          error: `Choose a code from ${refName}.`,
        };
      }
    }
  }

  private excelReferenceFormula(sheetName: string, rowCount: number) {
    const safeName = sheetName.replace(/'/g, "''");
    return `'${safeName}'!$A$2:$A$${rowCount + 1}`;
  }

  private templateCourseCode(code: string) {
    return code.replace(/[\u2010-\u2015]/g, '-').trim();
  }

  private programmeApplicability(offering: any) {
    if (offering.programVersion?.program) {
      return `${offering.programVersion.program.code} - ${offering.programVersion.program.name}`;
    }
    const programs = offering.categoryPool?.assignments
      ?.map((assignment: any) => assignment.programVersion?.program)
      .filter(Boolean)
      .map((program: any) => `${program.code} - ${program.name}`);
    return programs?.length
      ? [...new Set(programs)].join(', ')
      : 'All eligible programmes';
  }

  private sampleTemplateRow() {
    return [
      '',
      '',
      'REG2026001',
      '001',
      'Jane Doe',
      'jane@example.com',
      '9876543210',
      'BCA',
      '2026-BCA',
      'SCIENCE',
      'MORNING',
      'CS',
      '2026-27',
      '1',
      'STUDYING',
      'GENERAL',
      'CHRISTIAN',
      '123456789012',
      'John Doe',
      'Jane Doe Sr',
      'RFID001',
      'GAR100',
      'EDU101',
      'MDC101',
      'AEC101',
      'SEC101',
      'VAC101',
      '',
      '',
      '',
      '',
      'TUT-A',
      'LAB-A',
      'F',
      '2006-01-15',
      '123 Main St',
      'Tura',
      'Meghalaya',
      '794001',
      '',
      '',
      '',
      '',
    ];
  }

  private async prefilledTemplateRows(
    tenantId: string,
  ): Promise<ExistingStudentTemplateRow[]> {
    return this.prisma.student.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        user: { select: { email: true } },
        masterProfile: {
          select: { fullName: true, mobileNumber: true, studentStatus: true },
        },
        programVersion: {
          include: {
            program: {
              include: { department: { select: { code: true, name: true } } },
            },
          },
        },
        department: { select: { code: true, name: true } },
        primaryShift: { select: { code: true, name: true } },
        academicProfile: {
          include: {
            stream: { select: { code: true, name: true } },
            admissionBatch: {
              select: { batchCode: true, currentSemester: true },
            },
          },
        },
        programChoices: { where: { status: { not: 'ARCHIVED' } } },
        semesterRegistrations: {
          orderBy: { semesterSequence: 'desc' },
          take: 1,
          include: {
            lines: {
              include: { offering: { include: { course: true } } },
            },
          },
        },
      },
      orderBy: { enrollmentNumber: 'asc' },
      take: 5000,
    }) as unknown as Promise<ExistingStudentTemplateRow[]>;
  }

  private templateRowValues(student: ExistingStudentTemplateRow) {
    const latestRegistration = student.semesterRegistrations[0];
    const lineByCategory = new Map(
      latestRegistration?.lines.map((line) => [
        String(line.category).toUpperCase(),
        line.offering.course.code,
      ]) ?? [],
    );
    const choiceByType = new Map(
      student.programChoices.map((choice) => [
        choice.choiceType,
        choice.subjectSlug,
      ]),
    );
    return [
      '',
      '',
      student.enrollmentNumber,
      student.rollNumber ?? '',
      student.masterProfile?.fullName ?? '',
      student.user.email,
      student.masterProfile?.mobileNumber ?? '',
      student.programVersion?.program.code ?? '',
      student.academicProfile?.admissionBatch?.batchCode ?? '',
      student.academicProfile?.stream?.code ?? '',
      student.primaryShift?.code ?? '',
      student.department?.code ??
        student.programVersion?.program.department?.code ??
        '',
      '',
      String(
        student.academicProfile?.admissionBatch?.currentSemester ??
          latestRegistration?.semesterSequence ??
          '',
      ),
      student.masterProfile?.studentStatus ?? 'STUDYING',
      '',
      '',
      '',
      '',
      '',
      '',
      lineByCategory.get('MAJOR') ?? choiceByType.get('MAJOR') ?? '',
      lineByCategory.get('MINOR') ?? choiceByType.get('MINOR') ?? '',
      lineByCategory.get('MDC') ?? '',
      lineByCategory.get('AEC') ?? '',
      lineByCategory.get('SEC') ?? '',
      lineByCategory.get('VAC') ?? '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ];
  }

  private helperTextForHeader(header: string) {
    const helpers: Record<string, string> = {
      'Major Subject': 'Enter configured department/major name, e.g. GARO',
      'Minor Subject': 'Enter configured minor/department name, e.g. EDUCATION',
      'MDC Subject': 'Enter FYUGP MDC paper name',
      'AEC Subject': 'Enter AEC paper name',
      'SEC Subject': 'Enter SEC paper name',
      'VAC Subject': 'Enter VAC paper name',
      'Major Subject 2': 'Optional second major paper or track',
      'Minor Subject 2': 'Optional second minor paper or track',
      'Elective Subject': 'Optional elective paper name',
      'Skill Paper':
        'Optional skill paper, treated as SEC if SEC Subject is blank',
      'Tutorial Group': 'Optional tutorial group label',
      'Lab Batch': 'Optional lab batch label',
    };
    return (
      helpers[header] ?? 'Enter institutional data in the displayed format.'
    );
  }
  async buildErrorReportWorkbook(
    rows: ImportRowValidationResult[],
  ): Promise<Buffer> {
    const failed = rows.filter((r) => r.status === 'INVALID');
    return createWorkbookWithSheets([
      {
        name: 'Errors',
        headers: ['Row', 'Registration', 'Name', 'Errors'],
        rows: failed.map((r) => [
          r.rowNumber,
          r.displayCode ?? '',
          r.displayTitle ?? '',
          r.errors.join('; '),
        ]),
      },
    ]);
  }
}
