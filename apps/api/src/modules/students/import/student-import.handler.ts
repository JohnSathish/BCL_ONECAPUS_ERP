import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import {
  createWorkbookWithSheets,
  excelColumnLetter,
  excelSheetListFormula,
  applyWorksheetListValidation,
} from '../../../common/import/excel.util';
import type {
  ImportModuleHandler,
  ImportModuleHandlerContext,
  ImportRowValidationResult,
  ImportValidateOptions,
  ParsedImportRow,
} from '../../../common/import/import.types';
import { parseFlexibleDate } from '../../../common/utils/parse-flexible-date';
import { PrismaService } from '../../../database/prisma.service';
import { isAcademicDepartment } from '../../organization/department-rules';
import { AcademicEngineService } from '../../academic-engine/academic-engine.service';
import { slugifySubject } from '../../academic-engine/domain/nep-categories';
import type { StudentImportMode } from '../dto/students.dto';
import { StudentSemesterResolverService } from '../services/student-semester-resolver.service';
import { StudentAbcService } from '../services/student-abc.service';
import {
  SEM1_ADMISSION_SAMPLE_ROW,
  SEM1_ADMISSION_TEMPLATE_HEADERS,
  SEM1_ADMISSION_TEMPLATE_HELPERS,
} from '../migration/sem1-admission-template';
import {
  SEM1_SUBJECT_IMPORT_HEADERS,
  SEM1_SUBJECT_IMPORT_HELPERS,
  SEM1_SUBJECT_IMPORT_SAMPLE_ROW,
  SEM1_HIDDEN_SHEETS,
  SEM1_STRUCTURE_NOTES,
} from '../migration/sem1-subject-import-template';
import {
  SEM3_ADMISSION_SAMPLE_ROW,
  SEM3_ADMISSION_TEMPLATE_HEADERS,
  SEM3_ADMISSION_TEMPLATE_HELPERS,
  SEM3_HIDDEN_SHEETS,
  SEM3_STRUCTURE_NOTES,
} from '../migration/sem3-admission-template';
import {
  SEM5_ADMISSION_SAMPLE_ROW,
  SEM5_ADMISSION_TEMPLATE_HEADERS,
  SEM5_ADMISSION_TEMPLATE_HELPERS,
  SEM5_HIDDEN_SHEETS,
  SEM5_STRUCTURE_NOTES,
} from '../migration/sem5-admission-template';
import {
  Sem1ImportCurriculumService,
  type Sem1ImportCurriculumCatalog,
} from './sem1-import-curriculum.service';
import {
  Sem3ImportCurriculumService,
  type Sem3ImportCurriculumCatalog,
} from './sem3-import-curriculum.service';
import {
  Sem5ImportCurriculumService,
  type Sem5ImportCurriculumCatalog,
} from './sem5-import-curriculum.service';
import {
  FULL_ADMISSION_IMPORT_HEADERS,
  FULL_ADMISSION_IMPORT_HELPERS,
  FULL_ADMISSION_STRUCTURE_NOTES,
  FULL_ADMISSION_HIDDEN_SHEETS,
  IMPORT_SECTION_LABELS,
  STUDENT_IMPORT_FIELD_REGISTRY,
} from './student-import-field-registry';
import { StudentImportProfileWriterService } from './student-import-profile-writer.service';

export type NormalizedStudentImportRow = {
  email: string;
  enrollmentNumber: string;
  applicationNumber?: string;
  admissionNumber?: string;
  formNumber?: string;
  universityRollNumber?: string;
  universityRegistrationNumber?: string;
  libraryCardNumber?: string;
  rollNumber?: string;
  fullName: string;
  mobileNumber?: string;
  whatsappNumber?: string;
  programVersionId: string;
  admissionBatchId: string;
  streamId: string;
  shiftId: string;
  departmentId?: string;
  sessionId?: string;
  currentSemester?: number;
  studentStatus?: string;
  admissionStatus?: string;
  admissionDate?: string;
  gender?: string;
  dateOfBirth?: string;
  categoryLookupId?: string;
  religionLookupId?: string;
  bloodGroupLookupId?: string;
  tribeLookupId?: string;
  denominationLookupId?: string;
  nationalityLookupId?: string;
  nationalId?: string;
  photoFileName?: string;
  fatherName?: string;
  fatherMobile?: string;
  fatherOccupation?: string;
  motherName?: string;
  motherMobile?: string;
  motherOccupation?: string;
  guardianName?: string;
  guardianMobile?: string;
  rfidNumber?: string;
  abcId?: string;
  residenceType?: string;
  hostelBlock?: string;
  hostelRoom?: string;
  transportNote?: string;
  scholarshipCategory?: string;
  boardExam?: {
    boardName?: string;
    schoolName?: string;
    examYear?: number;
    totalMarks?: number;
    percentage?: number;
    division?: string;
    registrationType?: string;
  };
  cuetDetail?: {
    cuetRollNumber?: string;
    cuetScore?: number;
  };
  majorSubjectSlug?: string;
  minorSubjectSlug?: string;
  academicMapping?: FyugpAcademicMapping;
  existingStudentId?: string;
  semesterOverride?: boolean;
  turaAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    district?: string;
    pinCode?: string;
  };
  homeAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    district?: string;
    pinCode?: string;
  };
};
type ExistingStudentRef = {
  id: string;
  enrollmentNumber: string;
  rollNumber: string | null;
  rfidNumber: string | null;
  admissionNumber: string | null;
  applicationNumber: string | null;
  universityRollNumber: string | null;
  universityRegistrationNumber: string | null;
  user: { email: string };
  masterProfile: {
    nationalId: string | null;
    mobileNumber: string | null;
  } | null;
  abcAccount: { abcId: string | null } | null;
};

type FyugpCategory =
  | 'MAJOR'
  | 'MINOR'
  | 'MDC'
  | 'AEC'
  | 'SEC'
  | 'VAC'
  | 'VTC'
  | 'INTERNSHIP';

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
  major2?: FyugpResolvedSelection;
  major3?: FyugpResolvedSelection;
  minor?: FyugpResolvedSelection;
  internship?: FyugpResolvedSelection;
  internshipArea?: { input: string; slug: string; resolvedLabel?: string };
  mdc?: FyugpResolvedSelection;
  aec?: FyugpResolvedSelection;
  sec?: FyugpResolvedSelection;
  vac?: FyugpResolvedSelection;
  vtc?: FyugpResolvedSelection;
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
  hidden?: boolean;
};

const FYUGP_CATEGORY_LABELS: Record<FyugpCategory, string> = {
  MAJOR: 'Major',
  MINOR: 'Minor',
  MDC: 'MDC',
  AEC: 'AEC',
  SEC: 'SEC',
  VAC: 'VAC',
  VTC: 'VTC',
  INTERNSHIP: 'Internship',
};

const SINGLE_SLOT_REGISTRATION_CATEGORIES = new Set<FyugpCategory>([
  'MINOR',
  'MDC',
  'AEC',
  'SEC',
  'VAC',
  'VTC',
  'INTERNSHIP',
]);

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
    { key: 'abcId', header: 'ABC_ID', required: false },
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
    { key: 'majorCourseCode2', header: 'MAJOR_CODE_2', required: false },
    { key: 'minorCourseCode', header: 'MINOR_CODE', required: false },
    { key: 'mdcCourseCode', header: 'MDC_CODE', required: false },
    { key: 'aecCourseCode', header: 'AEC_CODE', required: false },
    { key: 'secCourseCode', header: 'SEC_CODE', required: false },
    { key: 'vacCourseCode', header: 'VAC_CODE', required: false },
    { key: 'vtcCourseCode', header: 'VTC_CODE', required: false },
    { key: 'majorSubject', header: 'Major Subject', required: false },
    { key: 'minorSubject', header: 'Minor Subject', required: false },
    { key: 'mdcSubject', header: 'MDC Choice', required: false },
    { key: 'aecSubject', header: 'AEC', required: false },
    { key: 'secSubject', header: 'SEC', required: false },
    { key: 'vacSubject', header: 'VAC', required: false },
    { key: 'vtcSubject', header: 'VTC', required: false },
    { key: 'sectionCode', header: 'Section Code', required: false },
    { key: 'grp', header: 'Grp', required: false },
    { key: 'majorSection', header: 'Major Section', required: false },
    { key: 'minorSection', header: 'Minor Section', required: false },
    { key: 'mdcSection', header: 'MDC Section', required: false },
    { key: 'aecSection', header: 'AEC Section', required: false },
    { key: 'secSection', header: 'SEC Section', required: false },
    { key: 'vacSection', header: 'VAC Section', required: false },
    { key: 'vtcSection', header: 'VTC Section', required: false },
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
    private readonly abcService: StudentAbcService,
    private readonly sem1Curriculum: Sem1ImportCurriculumService,
    private readonly sem3Curriculum: Sem3ImportCurriculumService,
    private readonly sem5Curriculum: Sem5ImportCurriculumService,
    private readonly profileWriter: StudentImportProfileWriterService,
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
          admissionNumber: true,
          applicationNumber: true,
          universityRollNumber: true,
          universityRegistrationNumber: true,
          user: { select: { email: true } },
          masterProfile: {
            select: { nationalId: true, mobileNumber: true },
          },
          abcAccount: { select: { abcId: true } },
        },
      }),
      this.prisma.masterLookup.findMany({
        where: {
          tenantId,
          lookupType: {
            in: [
              'CATEGORY',
              'RELIGION',
              'BLOOD_GROUP',
              'TRIBE',
              'DENOMINATION',
              'NATIONALITY',
            ],
          },
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
    const admissionToStudentId = new Map<string, string>();
    const applicationToStudentId = new Map<string, string>();
    const universityRollToStudentId = new Map<string, string>();
    const universityRegToStudentId = new Map<string, string>();
    const abcToStudentId = new Map<string, string>();
    const mobileToStudentId = new Map<string, string>();
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
      if (student.admissionNumber) {
        admissionToStudentId.set(
          student.admissionNumber.trim().toUpperCase(),
          student.id,
        );
      }
      if (student.applicationNumber) {
        applicationToStudentId.set(
          student.applicationNumber.trim().toUpperCase(),
          student.id,
        );
      }
      if (student.universityRollNumber) {
        universityRollToStudentId.set(
          student.universityRollNumber.trim().toUpperCase(),
          student.id,
        );
      }
      if (student.universityRegistrationNumber) {
        universityRegToStudentId.set(
          student.universityRegistrationNumber.trim().toUpperCase(),
          student.id,
        );
      }
      const nationalId = student.masterProfile?.nationalId?.trim();
      if (nationalId) {
        aadhaarToStudentId.set(nationalId.toUpperCase(), student.id);
      }
      const mobile = student.masterProfile?.mobileNumber?.trim();
      if (mobile) {
        mobileToStudentId.set(mobile, student.id);
      }
      const abcId = student.abcAccount?.abcId?.trim();
      if (abcId) {
        abcToStudentId.set(abcId.toUpperCase(), student.id);
      }
    }
    const categoryByCode = new Map(
      lookups
        .filter((l) => l.lookupType === 'CATEGORY')
        .map((l) => [l.code.trim().toUpperCase(), l.id]),
    );
    const religionByKey = new Map<string, string>();
    const bloodGroupByKey = new Map<string, string>();
    const tribeByKey = new Map<string, string>();
    const denominationByKey = new Map<string, string>();
    const nationalityByKey = new Map<string, string>();
    for (const lookup of lookups) {
      const type = lookup.lookupType;
      const keys = [
        lookup.code.trim().toUpperCase(),
        lookup.label.trim().toLowerCase(),
      ];
      const target =
        type === 'CATEGORY'
          ? categoryByCode
          : type === 'RELIGION'
            ? religionByKey
            : type === 'BLOOD_GROUP'
              ? bloodGroupByKey
              : type === 'TRIBE'
                ? tribeByKey
                : type === 'DENOMINATION'
                  ? denominationByKey
                  : type === 'NATIONALITY'
                    ? nationalityByKey
                    : null;
      if (!target) continue;
      for (const key of keys) target.set(key, lookup.id);
    }
    const fileRegs = new Set<string>();
    const fileRolls = new Set<string>();
    const fileEmails = new Set<string>();
    const fileAadhaars = new Set<string>();
    const fileRfids = new Set<string>();
    const fileAdmissions = new Set<string>();
    const fileApplications = new Set<string>();
    const fileUniversityRolls = new Set<string>();
    const fileUniversityRegs = new Set<string>();
    const fileAbcs = new Set<string>();
    const fileMobiles = new Set<string>();
    const sem1Catalogs = await this.preloadSem1Catalogs(
      tenantId,
      programVersions.map((version) => version.id),
    );
    const sem3Catalogs = await this.preloadSem3Catalogs(
      tenantId,
      programVersions.map((version) => version.id),
    );
    const sem5Catalogs = await this.preloadSem5Catalogs(
      tenantId,
      programVersions.map((version) => version.id),
    );
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
        admissionToStudentId,
        applicationToStudentId,
        universityRollToStudentId,
        universityRegToStudentId,
        abcToStudentId,
        mobileToStudentId,
        fileRegs,
        fileRolls,
        fileEmails,
        fileAadhaars,
        fileRfids,
        fileAdmissions,
        fileApplications,
        fileUniversityRolls,
        fileUniversityRegs,
        fileAbcs,
        fileMobiles,
        categoryByCode,
        religionByKey,
        bloodGroupByKey,
        tribeByKey,
        denominationByKey,
        nationalityByKey,
        sem1Catalogs,
        sem3Catalogs,
        sem5Catalogs,
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
      admissionToStudentId: Map<string, string>;
      applicationToStudentId: Map<string, string>;
      universityRollToStudentId: Map<string, string>;
      universityRegToStudentId: Map<string, string>;
      abcToStudentId: Map<string, string>;
      mobileToStudentId: Map<string, string>;
      fileRegs: Set<string>;
      fileRolls: Set<string>;
      fileEmails: Set<string>;
      fileAadhaars: Set<string>;
      fileRfids: Set<string>;
      fileAdmissions: Set<string>;
      fileApplications: Set<string>;
      fileUniversityRolls: Set<string>;
      fileUniversityRegs: Set<string>;
      fileAbcs: Set<string>;
      fileMobiles: Set<string>;
      categoryByCode: Map<string, string>;
      religionByKey: Map<string, string>;
      bloodGroupByKey: Map<string, string>;
      tribeByKey: Map<string, string>;
      denominationByKey: Map<string, string>;
      nationalityByKey: Map<string, string>;
      sem1Catalogs: Map<string, Sem1ImportCurriculumCatalog>;
      sem3Catalogs: Map<string, Sem3ImportCurriculumCatalog>;
      sem5Catalogs: Map<string, Sem5ImportCurriculumCatalog>;
      fyugp: FyugpResolutionContext;
    },
  ): ImportRowValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const raw = row.raw as Record<string, unknown>;
    this.normalizeFullImportRowAliases(raw);
    const enrollmentNumber = String(
      raw.registrationNumber ??
        raw.enrollmentNumber ??
        raw.applicationNumber ??
        raw.admissionNumber ??
        '',
    ).trim();
    const applicationNumber = String(raw.applicationNumber ?? '').trim();
    const admissionNumber = String(raw.admissionNumber ?? '').trim();
    const formNumber = String(raw.formNumber ?? '').trim() || undefined;
    const universityRollNumber =
      String(raw.universityRollNumber ?? '').trim() || undefined;
    const universityRegistrationNumber =
      String(raw.universityRegistrationNumber ?? '').trim() || undefined;
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
    const abcId =
      String(raw.abcId ?? raw.abc_id ?? raw.ABC_ID ?? '').trim() || undefined;
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
    this.assertUniqueInFileAndDb(
      admissionNumber,
      ctx.fileAdmissions,
      ctx.admissionToStudentId,
      ownerId,
      'Duplicate admission number',
      errors,
    );
    this.assertUniqueInFileAndDb(
      applicationNumber,
      ctx.fileApplications,
      ctx.applicationToStudentId,
      ownerId,
      'Duplicate application number',
      errors,
    );
    this.assertUniqueInFileAndDb(
      universityRollNumber,
      ctx.fileUniversityRolls,
      ctx.universityRollToStudentId,
      ownerId,
      'Duplicate university roll number',
      errors,
    );
    this.assertUniqueInFileAndDb(
      universityRegistrationNumber,
      ctx.fileUniversityRegs,
      ctx.universityRegToStudentId,
      ownerId,
      'Duplicate university registration number',
      errors,
    );
    if (abcId) {
      const abcKey = abcId.toUpperCase();
      this.assertUniqueInFileAndDb(
        abcKey,
        ctx.fileAbcs,
        ctx.abcToStudentId,
        ownerId,
        'Duplicate ABC ID',
        errors,
      );
    }
    const mobileRaw = String(raw.mobile ?? raw.mobileNumber ?? '').trim();
    if (mobileRaw) {
      this.assertUniqueInFileAndDb(
        mobileRaw,
        ctx.fileMobiles,
        ctx.mobileToStudentId,
        ownerId,
        'Duplicate mobile number',
        errors,
      );
    }
    if (ctx.importMode === 'CREATE') {
      if (!fatherName) errors.push("Father's name is required");
      if (!motherName) errors.push("Mother's name is required");
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
    const religionRaw = this.normalizeImportReligion(
      String(raw.religion ?? '').trim(),
    );
    let religionLookupId: string | undefined;
    if (religionRaw) {
      religionLookupId =
        ctx.religionByKey.get(religionRaw.toUpperCase()) ??
        ctx.religionByKey.get(religionRaw.toLowerCase());
      if (!religionLookupId) {
        errors.push(`Unknown religion: ${religionRaw}`);
      }
    }
    const bloodGroupLookupId = this.resolveLookupId(
      this.normalizeImportBloodGroup(String(raw.bloodGroup ?? '').trim()),
      ctx.bloodGroupByKey,
      'blood group',
      errors,
    );
    const tribeLookupId = this.resolveLookupId(
      raw.tribe,
      ctx.tribeByKey,
      'tribe',
      errors,
    );
    const denominationLookupId = this.resolveLookupId(
      this.normalizeImportDenomination(String(raw.denomination ?? '').trim()),
      ctx.denominationByKey,
      'denomination',
      errors,
    );
    const nationalityLookupId = this.resolveLookupId(
      raw.nationality,
      ctx.nationalityByKey,
      'nationality',
      errors,
    );
    const genderRaw = String(raw.gender ?? '').trim();
    let gender: string | undefined;
    if (genderRaw) {
      const normalizedGender = this.normalizeGender(genderRaw);
      if (!normalizedGender) {
        errors.push(`Invalid gender: ${genderRaw}`);
      } else {
        gender = normalizedGender;
      }
    }
    const dobRaw = String(raw.dateOfBirth ?? '').trim();
    let dateOfBirth: string | undefined;
    if (dobRaw) {
      const parsedDob = this.parseImportDate(dobRaw);
      if (!parsedDob) {
        errors.push(`Invalid date of birth: ${dobRaw}`);
      } else {
        dateOfBirth = parsedDob;
      }
    }
    const admissionDateRaw = String(raw.admissionDate ?? '').trim();
    let admissionDate: string | undefined;
    if (admissionDateRaw) {
      const parsedAdmissionDate = this.parseImportDate(admissionDateRaw);
      if (!parsedAdmissionDate) {
        errors.push(`Invalid admission date: ${admissionDateRaw}`);
      } else {
        admissionDate = parsedAdmissionDate;
      }
    }
    const admissionStatus =
      String(raw.admissionStatus ?? '')
        .trim()
        .toUpperCase() || undefined;
    const libraryCardNumber =
      String(raw.libraryCardNumber ?? '').trim() || undefined;
    const whatsappNumber = String(raw.whatsappNumber ?? '').trim() || undefined;
    const photoFileName = String(raw.photoFileName ?? '').trim() || undefined;
    const fatherMobile = String(raw.fatherMobile ?? '').trim() || undefined;
    const fatherOccupation =
      String(raw.fatherOccupation ?? '').trim() || undefined;
    const motherMobile = String(raw.motherMobile ?? '').trim() || undefined;
    const motherOccupation =
      String(raw.motherOccupation ?? '').trim() || undefined;
    const guardianName = String(raw.guardianName ?? '').trim() || undefined;
    const guardianMobile = String(raw.guardianMobile ?? '').trim() || undefined;
    const scholarshipCategory =
      String(raw.scholarshipCategory ?? '').trim() || undefined;
    const transportNote = String(raw.transport ?? '').trim() || undefined;
    const residenceType = this.parseResidenceType(String(raw.hostel ?? ''));
    const boardExam = this.parseBoardExamFields(raw);
    const cuetDetail = this.parseCuetFields(raw);
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
    const majorDepartment = this.firstText(raw, [
      'majorDepartment',
      'majorDepartmentName',
    ]);
    const fyugpMapping = this.resolveFyugpMapping(raw, {
      programVersionId,
      semesterSequence: targetSemester,
      shiftId: shift?.id,
      fyugp: ctx.fyugp,
      errors,
      warnings,
      sem1Catalogs: ctx.sem1Catalogs,
      sem3Catalogs: ctx.sem3Catalogs,
      sem5Catalogs: ctx.sem5Catalogs,
    });
    const majorSubjectSlug =
      fyugpMapping.major?.subjectSlug ??
      (majorDepartment
        ? this.resolveMajorDepartmentSlug(
            majorDepartment,
            ctx.fyugp.subjectMasters,
          )
        : undefined);
    const minorSubjectSlug = fyugpMapping.minor?.subjectSlug;
    if (targetSemester === 1 && !majorDepartment && !fyugpMapping.major) {
      errors.push('Major Department is required for Semester 1 imports');
    }
    if (targetSemester === 3 && !majorDepartment && !fyugpMapping.major) {
      errors.push('Major Department is required for Semester 3 imports');
    }
    if (targetSemester === 5 && !majorDepartment && !fyugpMapping.major) {
      errors.push('Major Department is required for Semester 5 imports');
    }
    const turaLine1 = String(
      raw.presentLine1 ?? raw.turaLine1 ?? raw.addressInTura ?? '',
    ).trim();
    const turaLine2 = String(raw.presentPoliceStation ?? '').trim();
    const turaCity = String(raw.presentVillage ?? raw.turaCity ?? '').trim();
    const turaDistrict = String(raw.presentDistrict ?? '').trim();
    const turaState = String(
      raw.presentState ?? raw.turaState ?? raw.state ?? '',
    ).trim();
    const turaPinCode = String(
      raw.presentPinCode ?? raw.turaPinCode ?? '',
    ).trim();
    const homeLine1 = String(
      raw.permanentLine1 ?? raw.homeLine1 ?? raw.homeAddress ?? '',
    ).trim();
    const homeLine2 = String(raw.permanentVillage ?? '').trim();
    const homeCity = String(raw.homeCity ?? '').trim();
    const homeDistrict = String(raw.permanentDistrict ?? '').trim();
    const homeState = String(raw.permanentState ?? raw.homeState ?? '').trim();
    const homePinCode = String(
      raw.permanentPinCode ?? raw.homePinCode ?? '',
    ).trim();
    const turaAddress =
      turaLine1 ||
      turaLine2 ||
      turaCity ||
      turaDistrict ||
      turaState ||
      turaPinCode
        ? {
            line1: turaLine1 || undefined,
            line2: turaLine2 || undefined,
            city: turaCity || undefined,
            district: turaDistrict || undefined,
            state: turaState || undefined,
            pinCode: turaPinCode || undefined,
          }
        : undefined;
    const homeAddress =
      homeLine1 ||
      homeLine2 ||
      homeCity ||
      homeDistrict ||
      homeState ||
      homePinCode
        ? {
            line1: homeLine1 || undefined,
            line2: homeLine2 || undefined,
            city: homeCity || homeLine2 || undefined,
            district: homeDistrict || undefined,
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
            formNumber,
            universityRollNumber,
            universityRegistrationNumber,
            libraryCardNumber,
            rollNumber: rollNumber || undefined,
            fullName,
            mobileNumber: mobileRaw || undefined,
            whatsappNumber,
            programVersionId,
            admissionBatchId,
            streamId,
            shiftId: shift.id,
            departmentId,
            sessionId,
            currentSemester,
            studentStatus,
            admissionStatus,
            admissionDate,
            gender,
            dateOfBirth,
            categoryLookupId,
            religionLookupId,
            bloodGroupLookupId,
            tribeLookupId,
            denominationLookupId,
            nationalityLookupId,
            nationalId: aadhaar || undefined,
            photoFileName,
            fatherName,
            fatherMobile,
            fatherOccupation,
            motherName,
            motherMobile,
            motherOccupation,
            guardianName,
            guardianMobile,
            rfidNumber,
            abcId,
            residenceType: residenceType ?? undefined,
            transportNote,
            scholarshipCategory,
            boardExam,
            cuetDetail,
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
      sem1Catalogs?: Map<string, Sem1ImportCurriculumCatalog>;
      sem3Catalogs?: Map<string, Sem3ImportCurriculumCatalog>;
      sem5Catalogs?: Map<string, Sem5ImportCurriculumCatalog>;
    },
  ): FyugpAcademicMapping {
    const mapping: FyugpAcademicMapping = {
      tutorialGroup: this.readText(raw, 'tutorialGroup'),
      labBatch: this.readText(raw, 'labBatch'),
    };
    const sem1Resolved = this.resolveSem1FriendlySelections(raw, ctx, mapping);
    if (sem1Resolved) {
      return sem1Resolved;
    }
    const sem5Resolved = this.resolveSem5FriendlySelections(raw, ctx, mapping);
    if (sem5Resolved) {
      return sem5Resolved;
    }
    const sem3Resolved = this.resolveSem3FriendlySelections(raw, ctx, mapping);
    if (sem3Resolved) {
      return sem3Resolved;
    }
    const defaultSectionCode =
      this.firstText(raw, ['sectionCode', 'grp', 'tutorialGroup']) ??
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
        'major2',
        'MAJOR',
        this.firstText(raw, ['majorCourseCode2', 'majorCode2']),
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
      ['vtc', 'VTC', this.firstText(raw, ['vtcCourseCode', 'vtcCode']), 'CODE'],
      [
        'major',
        'MAJOR',
        this.firstText(raw, ['majorSubject', 'majorSubjectSlug']),
        'LEGACY',
      ],
      ['major2', 'MAJOR', this.firstText(raw, ['majorSubject2']), 'LEGACY'],
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
      ['vtc', 'VTC', this.readText(raw, 'vtcSubject'), 'LEGACY'],
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
            `${category} mapped from subject name "${input}". CODE columns with dropdown (CODE - Name) are preferred when available.`,
          );
        }
      }
    }
    const seen = new Map<string, FyugpCategory>();
    for (const selection of [
      mapping.major,
      mapping.major2,
      mapping.minor,
      mapping.mdc,
      mapping.aec,
      mapping.sec,
      mapping.vac,
      mapping.vtc,
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

  private resolveSem1FriendlySelections(
    raw: Record<string, unknown>,
    ctx: {
      programVersionId?: string;
      semesterSequence?: number;
      shiftId?: string;
      fyugp: FyugpResolutionContext;
      errors: string[];
      warnings: string[];
      sem1Catalogs?: Map<string, Sem1ImportCurriculumCatalog>;
    },
    mapping: FyugpAcademicMapping,
  ): FyugpAcademicMapping | undefined {
    const majorDepartment = this.firstText(raw, [
      'majorDepartment',
      'majorDepartmentName',
    ]);
    const minorDepartment = this.firstText(raw, [
      'minorDepartment',
      'minorDepartmentName',
    ]);
    const mdcDepartment = this.firstText(raw, [
      'mdcDepartment',
      'mdcPaper',
      'mdcSubject',
      'mdcChoice',
    ]);
    const aecPaper = this.firstText(raw, ['aecPaper', 'aecSubject', 'aec']);
    const secPaper = this.firstText(raw, [
      'secPaper',
      'secSubject',
      'sec',
      'skillPaper',
      'skillEnhancementCourse',
    ]);
    const vtcPaper = this.firstText(raw, ['vtcPaper', 'vtcSubject', 'vtc']);
    const internshipArea = this.firstText(raw, [
      'internshipArea',
      'internship',
    ]);

    const usesSem1Template = Boolean(
      ctx.semesterSequence === 1 &&
      (majorDepartment ||
        minorDepartment ||
        mdcDepartment ||
        aecPaper ||
        secPaper),
    );
    if (!usesSem1Template) return undefined;

    if (vtcPaper || internshipArea) {
      ctx.errors.push(
        'Semester 1 import cannot include VTC or Internship columns.',
      );
      return mapping;
    }

    if (ctx.semesterSequence !== 1) {
      ctx.errors.push(
        'Semester 1 paper columns require Current Semester = 1 on this row.',
      );
      return mapping;
    }
    if (!ctx.programVersionId) {
      ctx.errors.push(
        'Programme is required to resolve Semester 1 paper selections.',
      );
      return mapping;
    }

    const catalog = ctx.sem1Catalogs?.get(ctx.programVersionId);
    if (!catalog) {
      ctx.errors.push(
        'Semester 1 curriculum is not configured for the selected programme.',
      );
      return mapping;
    }

    const defaultSectionCode =
      this.firstText(raw, ['sectionCode', 'grp', 'tutorialGroup']) ??
      mapping.tutorialGroup ??
      undefined;
    const sectionPreferences = this.buildSectionPreferences(
      raw,
      defaultSectionCode,
    );
    const subjectCtx = {
      ...ctx,
      sectionPreferences,
      defaultSectionCode,
    };

    if (!majorDepartment) {
      ctx.errors.push('Major Department is required for Semester 1 import.');
    } else {
      const department = this.sem1Curriculum.resolveMajorDepartment(
        catalog,
        majorDepartment,
      );
      if (!department) {
        ctx.errors.push(
          `Unknown Major Department "${majorDepartment}" for programme ${catalog.programCode}. Choose from the template dropdown.`,
        );
      } else {
        mapping.major = this.resolveSem3OfferingSelection(
          department.paper,
          'MAJOR',
          subjectCtx,
        );
        if (mapping.major && !mapping.major.subjectSlug) {
          mapping.major.subjectSlug = department.subjectSlug;
        }

        if (!minorDepartment) {
          ctx.errors.push(
            'Minor Department is required for Semester 1 import.',
          );
        } else {
          const minorOption = this.sem1Curriculum.resolveMinorDepartment(
            catalog,
            department.departmentName,
            minorDepartment,
          );
          if (!minorOption) {
            ctx.errors.push(
              `Minor Department "${minorDepartment}" is not allowed for Major Department "${department.departmentName}". Choose from the template dropdown.`,
            );
          } else {
            mapping.minor = this.resolveSem3OfferingSelection(
              minorOption.paper,
              'MINOR',
              subjectCtx,
            );
            if (mapping.minor && !mapping.minor.subjectSlug) {
              mapping.minor.subjectSlug = minorOption.subjectSlug;
            }
          }
        }
      }
    }

    if (!mdcDepartment) {
      ctx.errors.push('MDC Department is required for Semester 1 import.');
    } else {
      const resolved = this.sem1Curriculum.resolveCategoryPaper(
        catalog.mdcDepartments,
        mdcDepartment,
        'MDC',
      );
      if (!resolved) {
        ctx.errors.push(
          `Unknown MDC Department "${mdcDepartment}" for Semester 1. Choose from the template dropdown.`,
        );
      } else {
        mapping.mdc = this.resolveSem3OfferingSelection(
          resolved,
          'MDC',
          subjectCtx,
        );
      }
    }

    if (!aecPaper) {
      ctx.errors.push('AEC Paper is required for Semester 1 import.');
    } else {
      const resolved = this.sem1Curriculum.resolveCategoryPaper(
        catalog.aecPapers,
        aecPaper,
        'AEC',
      );
      if (!resolved) {
        ctx.errors.push(
          `Unknown AEC Paper "${aecPaper}" for Semester 1. Choose from the template dropdown.`,
        );
      } else {
        mapping.aec = this.resolveSem3OfferingSelection(
          resolved,
          'AEC',
          subjectCtx,
        );
      }
    }

    if (!secPaper) {
      ctx.errors.push(
        'Skill Enhancement Course is required for Semester 1 import.',
      );
    } else {
      const resolved = this.sem1Curriculum.resolveCategoryPaper(
        catalog.secPapers,
        secPaper,
        'SEC',
      );
      if (!resolved) {
        ctx.errors.push(
          `Unknown Skill Enhancement Course "${secPaper}" for Semester 1. Choose from the template dropdown.`,
        );
      } else {
        mapping.sec = this.resolveSem3OfferingSelection(
          resolved,
          'SEC',
          subjectCtx,
        );
      }
    }

    mapping.vac = this.resolveSem3OfferingSelection(
      catalog.vacPaper,
      'VAC',
      subjectCtx,
    );

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

  private resolveSem5FriendlySelections(
    raw: Record<string, unknown>,
    ctx: {
      programVersionId?: string;
      semesterSequence?: number;
      shiftId?: string;
      fyugp: FyugpResolutionContext;
      errors: string[];
      warnings: string[];
      sem5Catalogs?: Map<string, Sem5ImportCurriculumCatalog>;
    },
    mapping: FyugpAcademicMapping,
  ): FyugpAcademicMapping | undefined {
    const majorDepartment = this.firstText(raw, [
      'majorDepartment',
      'majorDepartmentName',
    ]);
    const minorDepartment = this.firstText(raw, [
      'minorDepartment',
      'minorDepartmentName',
    ]);
    const internshipArea = this.firstText(raw, [
      'internshipArea',
      'internship',
    ]);
    const mdcPaper = this.firstText(raw, [
      'mdcPaper',
      'mdcSubject',
      'mdcChoice',
    ]);
    const aecPaper = this.firstText(raw, ['aecPaper', 'aecSubject', 'aec']);
    const secPaper = this.firstText(raw, ['secPaper', 'secSubject', 'sec']);
    const vtcPaper = this.firstText(raw, ['vtcPaper', 'vtcSubject', 'vtc']);

    const usesSem5Template = Boolean(
      ctx.semesterSequence === 5 &&
      (majorDepartment || minorDepartment || internshipArea),
    );
    if (!usesSem5Template) return undefined;

    if (mdcPaper || aecPaper || secPaper || vtcPaper) {
      ctx.errors.push(
        'Semester 5 import cannot include MDC, AEC, SEC, or VTC columns.',
      );
      return mapping;
    }

    if (ctx.semesterSequence !== 5) {
      ctx.errors.push(
        'Semester 5 paper columns require Current Semester = 5 on this row.',
      );
      return mapping;
    }
    if (!ctx.programVersionId) {
      ctx.errors.push(
        'Programme is required to resolve Semester 5 paper selections.',
      );
      return mapping;
    }

    const catalog = ctx.sem5Catalogs?.get(ctx.programVersionId);
    if (!catalog) {
      ctx.errors.push(
        'Semester 5 curriculum is not configured for the selected programme.',
      );
      return mapping;
    }

    const defaultSectionCode =
      this.firstText(raw, ['sectionCode', 'grp', 'tutorialGroup']) ??
      mapping.tutorialGroup ??
      undefined;
    const sectionPreferences = this.buildSectionPreferences(
      raw,
      defaultSectionCode,
    );
    const subjectCtx = {
      ...ctx,
      sectionPreferences,
      defaultSectionCode,
    };

    if (!majorDepartment) {
      ctx.errors.push('Major Department is required for Semester 5 import.');
    } else {
      const department = this.sem5Curriculum.resolveMajorDepartment(
        catalog,
        majorDepartment,
      );
      if (!department) {
        ctx.errors.push(
          `Unknown Major Department "${majorDepartment}" for programme ${catalog.programCode}. Choose from the template dropdown.`,
        );
      } else {
        mapping.major = this.resolveSem5OfferingSelection(
          department.paper1,
          'MAJOR',
          subjectCtx,
        );
        mapping.major2 = this.resolveSem5OfferingSelection(
          department.paper2,
          'MAJOR',
          subjectCtx,
        );
        mapping.major3 = this.resolveSem5OfferingSelection(
          department.paper3,
          'MAJOR',
          subjectCtx,
        );
        if (mapping.major && !mapping.major.subjectSlug) {
          mapping.major.subjectSlug = department.subjectSlug;
        }

        if (!minorDepartment) {
          ctx.errors.push(
            'Minor Department is required for Semester 5 import.',
          );
        } else {
          const allowedMinor = this.sem5Curriculum.resolveMinorDepartment(
            catalog,
            department.departmentName,
            minorDepartment,
          );
          if (!allowedMinor) {
            ctx.errors.push(
              `Minor Department "${minorDepartment}" is not allowed for Major Department "${department.departmentName}". Choose from the template dropdown.`,
            );
          } else {
            const minorOption =
              this.sem5Curriculum.resolveMinorDepartmentOption(
                catalog,
                minorDepartment,
              );
            if (!minorOption) {
              ctx.errors.push(
                `Minor Department "${minorDepartment}" is not configured in Semester 5 curriculum.`,
              );
            } else {
              mapping.minor = this.resolveSem5OfferingSelection(
                minorOption.paper,
                'MINOR',
                subjectCtx,
              );
              if (mapping.minor && !mapping.minor.subjectSlug) {
                mapping.minor.subjectSlug = minorOption.subjectSlug;
              }
            }
          }
        }

        if (!internshipArea) {
          ctx.errors.push('Internship Area is required for Semester 5 import.');
        } else {
          const resolvedArea =
            this.sem5Curriculum.resolveInternshipArea(internshipArea);
          if (!resolvedArea) {
            ctx.errors.push(
              `Unknown Internship Area "${internshipArea}". Choose from the template dropdown.`,
            );
          } else {
            mapping.internshipArea = {
              input: internshipArea,
              slug: slugifySubject(resolvedArea),
              resolvedLabel: resolvedArea,
            };
            mapping.internship = this.resolveSem5OfferingSelection(
              department.internship,
              'INTERNSHIP',
              subjectCtx,
            );
          }
        }
      }
    }

    const seen = new Map<string, FyugpCategory>();
    for (const selection of [
      mapping.major,
      mapping.major2,
      mapping.major3,
      mapping.minor,
      mapping.internship,
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

  private resolveSem5OfferingSelection(
    paper: {
      title: string;
      code: string;
      courseId: string;
      offeringId: string;
    },
    category: FyugpCategory,
    ctx: {
      shiftId?: string;
      fyugp: FyugpResolutionContext;
      errors: string[];
      warnings?: string[];
      sectionPreferences?: Partial<Record<FyugpCategory, string>>;
      defaultSectionCode?: string;
    },
  ): FyugpResolvedSelection | undefined {
    return this.resolveSem3OfferingSelection(paper, category, ctx);
  }

  private resolveSem3FriendlySelections(
    raw: Record<string, unknown>,
    ctx: {
      programVersionId?: string;
      semesterSequence?: number;
      shiftId?: string;
      fyugp: FyugpResolutionContext;
      errors: string[];
      warnings: string[];
      sem3Catalogs?: Map<string, Sem3ImportCurriculumCatalog>;
    },
    mapping: FyugpAcademicMapping,
  ): FyugpAcademicMapping | undefined {
    const majorDepartment = this.firstText(raw, [
      'majorDepartment',
      'majorDepartmentName',
    ]);
    const mdcPaper = this.firstText(raw, [
      'mdcPaper',
      'mdcSubject',
      'mdcChoice',
    ]);
    const aecPaper = this.firstText(raw, ['aecPaper', 'aecSubject', 'aec']);
    const secPaper = this.firstText(raw, ['secPaper', 'secSubject', 'sec']);
    const vtcPaper = this.firstText(raw, ['vtcPaper', 'vtcSubject', 'vtc']);
    const usesSem3Template = Boolean(
      majorDepartment || mdcPaper || aecPaper || secPaper || vtcPaper,
    );
    if (!usesSem3Template) return undefined;

    if (ctx.semesterSequence !== 3) {
      ctx.errors.push(
        'Semester 3 paper columns require Current Semester = 3 on this row.',
      );
      return mapping;
    }
    if (!ctx.programVersionId) {
      ctx.errors.push(
        'Programme is required to resolve Semester 3 paper selections.',
      );
      return mapping;
    }

    const catalog = ctx.sem3Catalogs?.get(ctx.programVersionId);
    if (!catalog) {
      ctx.errors.push(
        'Semester 3 curriculum is not configured for the selected programme.',
      );
      return mapping;
    }

    const defaultSectionCode =
      this.firstText(raw, ['sectionCode', 'grp', 'tutorialGroup']) ??
      mapping.tutorialGroup ??
      undefined;
    const sectionPreferences = this.buildSectionPreferences(
      raw,
      defaultSectionCode,
    );
    const subjectCtx = {
      ...ctx,
      sectionPreferences,
      defaultSectionCode,
    };

    if (!majorDepartment) {
      ctx.errors.push('Major Department is required for Semester 3 import.');
    } else {
      const department = this.sem3Curriculum.resolveMajorDepartment(
        catalog,
        majorDepartment,
      );
      if (!department) {
        ctx.errors.push(
          `Unknown Major Department "${majorDepartment}" for programme ${catalog.programCode}. Choose from the template dropdown.`,
        );
      } else {
        mapping.major = this.resolveSem3OfferingSelection(
          department.paper1,
          'MAJOR',
          subjectCtx,
        );
        mapping.major2 = this.resolveSem3OfferingSelection(
          department.paper2,
          'MAJOR',
          subjectCtx,
        );
        if (mapping.major && !mapping.major.subjectSlug) {
          mapping.major.subjectSlug = this.resolveMajorDepartmentSlug(
            majorDepartment,
            ctx.fyugp.subjectMasters,
          );
        }
      }
    }

    this.resolveSem3CategoryPaper(
      mapping,
      'mdc',
      'MDC',
      mdcPaper,
      catalog.mdcPapers,
      subjectCtx,
      ctx.errors,
    );
    this.resolveSem3CategoryPaper(
      mapping,
      'aec',
      'AEC',
      aecPaper,
      catalog.aecPapers,
      subjectCtx,
      ctx.errors,
    );
    this.resolveSem3CategoryPaper(
      mapping,
      'sec',
      'SEC',
      secPaper,
      catalog.secPapers,
      subjectCtx,
      ctx.errors,
    );
    this.resolveSem3CategoryPaper(
      mapping,
      'vtc',
      'VTC',
      vtcPaper,
      catalog.vtcPapers,
      subjectCtx,
      ctx.errors,
    );

    const seen = new Map<string, FyugpCategory>();
    for (const selection of [
      mapping.major,
      mapping.major2,
      mapping.mdc,
      mapping.aec,
      mapping.sec,
      mapping.vtc,
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

  private resolveSem3CategoryPaper(
    mapping: FyugpAcademicMapping,
    key: 'mdc' | 'aec' | 'sec' | 'vtc',
    category: FyugpCategory,
    input: string | undefined,
    options: Sem3ImportCurriculumCatalog['mdcPapers'],
    subjectCtx: {
      programVersionId?: string;
      semesterSequence?: number;
      shiftId?: string;
      fyugp: FyugpResolutionContext;
      errors: string[];
      warnings?: string[];
      sectionPreferences?: Partial<Record<FyugpCategory, string>>;
      defaultSectionCode?: string;
    },
    errors: string[],
  ) {
    if (!input) {
      errors.push(`${category} Paper is required for Semester 3 import.`);
      return;
    }
    const resolved = this.sem3Curriculum.resolveCategoryPaper(
      options,
      input,
      category,
    );
    if (!resolved) {
      errors.push(
        `Unknown ${category} Paper "${input}" for Semester 3. Choose from the template dropdown.`,
      );
      return;
    }
    mapping[key] = this.resolveSem3OfferingSelection(
      resolved,
      category,
      subjectCtx,
    );
  }

  private resolveSem3OfferingSelection(
    paper: {
      title: string;
      code: string;
      courseId: string;
      offeringId: string;
    },
    category: FyugpCategory,
    ctx: {
      shiftId?: string;
      fyugp: FyugpResolutionContext;
      errors: string[];
      warnings?: string[];
      sectionPreferences?: Partial<Record<FyugpCategory, string>>;
      defaultSectionCode?: string;
    },
  ): FyugpResolvedSelection | undefined {
    const offering = ctx.fyugp.offerings.find(
      (candidate) => candidate.id === paper.offeringId,
    );
    if (!offering) {
      ctx.errors.push(
        `${category} paper "${paper.title}" (${paper.code}) is not available for import.`,
      );
      return undefined;
    }
    const preferredSection =
      ctx.sectionPreferences?.[category] ?? ctx.defaultSectionCode;
    const section = preferredSection
      ? (offering.sections.find(
          (entry) =>
            entry.shiftId === ctx.shiftId &&
            entry.sectionCode.toUpperCase() === preferredSection.toUpperCase(),
        ) ??
        offering.sections.find(
          (entry) =>
            entry.sectionCode.toUpperCase() === preferredSection.toUpperCase(),
        ))
      : (offering.sections.find((entry) => entry.shiftId === ctx.shiftId) ??
        offering.sections[0]);
    const subjectSlug =
      offering.course.subjectSlug ??
      this.subjectSlugForOffering(offering, ctx.fyugp.subjectMasters, category);
    return {
      category,
      input: paper.title,
      resolvedLabel: `${paper.code} - ${paper.title}`,
      courseCode: paper.code,
      resolutionMode: 'NAME',
      subjectSlug,
      courseId: paper.courseId,
      courseOfferingId: offering.id,
      offeringSectionId: section?.id,
      sectionCode: section?.sectionCode,
      categoryPoolId: offering.categoryPoolId ?? undefined,
    };
  }

  private resolveMajorDepartmentSlug(
    majorDepartment: string,
    subjectMasters: SubjectMasterRow[],
  ) {
    const normalized = this.normalizeSubjectKey(majorDepartment);
    const match = subjectMasters.find(
      (subject) =>
        this.normalizeSubjectKey(subject.name) === normalized ||
        subject.slug === slugifySubject(majorDepartment),
    );
    return match?.slug ?? slugifySubject(majorDepartment);
  }

  private async preloadSem1Catalogs(
    tenantId: string,
    programVersionIds: string[],
  ): Promise<Map<string, Sem1ImportCurriculumCatalog>> {
    const catalogs = new Map<string, Sem1ImportCurriculumCatalog>();
    const uniqueIds = [...new Set(programVersionIds)];
    await Promise.all(
      uniqueIds.map(async (programVersionId) => {
        try {
          const catalog = await this.sem1Curriculum.buildCatalog(tenantId, {
            programVersionId,
            semesterSequence: 1,
          });
          catalogs.set(programVersionId, catalog);
        } catch {
          // Programme may not have Sem 1 curriculum yet — validation will surface per row.
        }
      }),
    );
    return catalogs;
  }

  private async preloadSem5Catalogs(
    tenantId: string,
    programVersionIds: string[],
  ): Promise<Map<string, Sem5ImportCurriculumCatalog>> {
    const catalogs = new Map<string, Sem5ImportCurriculumCatalog>();
    const uniqueIds = [...new Set(programVersionIds)];
    await Promise.all(
      uniqueIds.map(async (programVersionId) => {
        try {
          const catalog = await this.sem5Curriculum.buildCatalog(tenantId, {
            programVersionId,
            semesterSequence: 5,
          });
          catalogs.set(programVersionId, catalog);
        } catch {
          // Programme may not have Sem 5 curriculum yet — validation will surface per row.
        }
      }),
    );
    return catalogs;
  }

  private async preloadSem3Catalogs(
    tenantId: string,
    programVersionIds: string[],
  ): Promise<Map<string, Sem3ImportCurriculumCatalog>> {
    const catalogs = new Map<string, Sem3ImportCurriculumCatalog>();
    const uniqueIds = [...new Set(programVersionIds)];
    await Promise.all(
      uniqueIds.map(async (programVersionId) => {
        try {
          const catalog = await this.sem3Curriculum.buildCatalog(tenantId, {
            programVersionId,
            semesterSequence: 3,
          });
          catalogs.set(programVersionId, catalog);
        } catch {
          // Programme may not have Sem 3 curriculum yet — validation will surface per row.
        }
      }),
    );
    return catalogs;
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
      { category: 'VTC', keys: ['vtcSection'] },
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
        category === 'VAC' ||
        category === 'VTC') &&
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
    _normalized: string,
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
    const parsed = this.parseSubjectImportInput(input);
    const normalized = this.normalizeSubjectKey(
      this.templateCourseCode(parsed.codeCandidate),
    );

    let codeMatches = ctx.fyugp.offerings.filter(
      (offering) =>
        this.normalizeSubjectKey(
          this.templateCourseCode(offering.course.code),
        ) === normalized,
    );
    if (!codeMatches.length) {
      const displayKey = input.trim().toLowerCase();
      codeMatches = ctx.fyugp.offerings.filter(
        (offering) =>
          this.formatSubjectDisplayLabel(
            offering.course.code,
            offering.course.title,
          ).toLowerCase() === displayKey,
      );
    }
    if (!codeMatches.length) {
      ctx.errors.push(
        `Invalid ${category} mapping. Provided ${category}_CODE = "${input}". No paper found with this code or display label. Choose from the template dropdown.`,
      );
      return undefined;
    }

    const activeMatches = codeMatches.filter(
      (offering) =>
        String(offering.course.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
    );
    if (!activeMatches.length) {
      const found = codeMatches[0];
      ctx.errors.push(
        `Discontinued or inactive ${category} code: ${parsed.codeCandidate} (${found.course.title}). Choose an active paper from SUBJECT_MASTER.`,
      );
      return undefined;
    }

    const categoryMatches = this.codeOfferingCandidatesForCategory(
      activeMatches,
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

  private formatSubjectDisplayLabel(code: string, name: string) {
    return `${this.templateCourseCode(code)} - ${name.trim()}`;
  }

  private parseSubjectImportInput(input: string) {
    const trimmed = input.trim();
    const separator = ' - ';
    const idx = trimmed.indexOf(separator);
    if (idx > 0) {
      return {
        codeCandidate: trimmed.slice(0, idx).trim(),
        nameCandidate: trimmed.slice(idx + separator.length).trim(),
      };
    }
    return { codeCandidate: trimmed, nameCandidate: undefined };
  }

  private enrichCategoryReferenceRows(
    rows: (string | number | null)[][],
  ): (string | number | null)[][] {
    return rows.map((row) => {
      const code = String(row[0] ?? '');
      const name = String(row[1] ?? '');
      const displayLabel = this.formatSubjectDisplayLabel(code, name);
      return [code, name, displayLabel, ...row.slice(2)];
    });
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
          formNumber: n.formNumber,
          universityRollNumber: n.universityRollNumber,
          universityRegistrationNumber: n.universityRegistrationNumber,
          libraryCardNumber: n.libraryCardNumber,
          rollNumber: n.rollNumber,
          rfidNumber: n.rfidNumber,
          programVersionId: n.programVersionId,
          primaryShiftId: n.shiftId,
          campusId: shift?.campusId,
          departmentId: n.departmentId,
          admissionDate: n.admissionDate
            ? new Date(n.admissionDate)
            : new Date(),
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
          whatsappNumber: n.whatsappNumber,
          nationalId: n.nationalId,
          categoryLookupId: n.categoryLookupId,
          religionLookupId: n.religionLookupId,
          bloodGroupLookupId: n.bloodGroupLookupId,
          tribeLookupId: n.tribeLookupId,
          denominationLookupId: n.denominationLookupId,
          nationalityLookupId: n.nationalityLookupId,
          admissionStatus: n.admissionStatus ?? 'ACTIVE',
          studentStatus: n.studentStatus ?? 'STUDYING',
          photoPath: n.photoFileName,
        },
      });
      await this.profileWriter.upsertExtendedGuardians(
        tx,
        tenantId,
        student.id,
        n,
      );
      await this.profileWriter.upsertExtendedAddresses(
        tx,
        tenantId,
        student.id,
        n,
      );
      await this.profileWriter.persistExtendedProfile(
        tx,
        tenantId,
        student.id,
        n,
      );
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
    await this.persistInternshipAreaChoice(tenantId, studentId, n);
    if (n.abcId) {
      await this.abcService.upsertForStudent(tenantId, studentId, n.abcId);
    }
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
      if (n.formNumber) studentUpdates.formNumber = n.formNumber;
      if (n.universityRollNumber) {
        studentUpdates.universityRollNumber = n.universityRollNumber;
      }
      if (n.universityRegistrationNumber) {
        studentUpdates.universityRegistrationNumber =
          n.universityRegistrationNumber;
      }
      if (n.libraryCardNumber) {
        studentUpdates.libraryCardNumber = n.libraryCardNumber;
      }
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
      if (n.whatsappNumber) profileUpdates.whatsappNumber = n.whatsappNumber;
      if (n.nationalId) profileUpdates.nationalId = n.nationalId;
      if (n.categoryLookupId)
        profileUpdates.categoryLookupId = n.categoryLookupId;
      if (n.religionLookupId)
        profileUpdates.religionLookupId = n.religionLookupId;
      if (n.bloodGroupLookupId) {
        profileUpdates.bloodGroupLookupId = n.bloodGroupLookupId;
      }
      if (n.tribeLookupId) profileUpdates.tribeLookupId = n.tribeLookupId;
      if (n.denominationLookupId) {
        profileUpdates.denominationLookupId = n.denominationLookupId;
      }
      if (n.nationalityLookupId) {
        profileUpdates.nationalityLookupId = n.nationalityLookupId;
      }
      if (n.admissionStatus) profileUpdates.admissionStatus = n.admissionStatus;
      if (n.studentStatus) profileUpdates.studentStatus = n.studentStatus;
      if (n.photoFileName) profileUpdates.photoPath = n.photoFileName;
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
      await this.profileWriter.upsertExtendedGuardians(
        tx,
        tenantId,
        studentId,
        n,
      );
      await this.profileWriter.upsertExtendedAddresses(
        tx,
        tenantId,
        studentId,
        n,
      );
      await this.profileWriter.persistExtendedProfile(
        tx,
        tenantId,
        studentId,
        n,
      );
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
      await this.persistInternshipAreaChoice(tenantId, studentId, n);
      await this.createAcademicOnboardingRegistration(
        tx,
        tenantId,
        studentId,
        n,
        targetSemester,
      );
    });
    if (n.abcId) {
      await this.abcService.upsertForStudent(tenantId, studentId, n.abcId);
    }
    return studentId;
  }

  private normalizeFullImportRowAliases(raw: Record<string, unknown>) {
    const semester = Number.parseInt(String(raw.currentSemester ?? ''), 10);
    if (semester === 3) {
      if (!raw.majorDepartment && raw.majorDepartmentSem3) {
        raw.majorDepartment = raw.majorDepartmentSem3;
      }
      if (!raw.mdcSubject && raw.mdcPaperSem3)
        raw.mdcSubject = raw.mdcPaperSem3;
      if (!raw.aecSubject && raw.aecPaperSem3)
        raw.aecSubject = raw.aecPaperSem3;
      if (!raw.secSubject && raw.secPaperSem3)
        raw.secSubject = raw.secPaperSem3;
      if (!raw.vtcSubject && raw.vtcPaper) raw.vtcSubject = raw.vtcPaper;
    }
    if (semester === 5) {
      if (!raw.majorDepartment && raw.majorDepartmentSem5) {
        raw.majorDepartment = raw.majorDepartmentSem5;
      }
      if (!raw.minorDepartment && raw.minorDepartmentSem5) {
        raw.minorDepartment = raw.minorDepartmentSem5;
      }
    }
    if (semester === 1 && !raw.mdcSubject && raw.mdcDepartment) {
      raw.mdcSubject = raw.mdcDepartment;
    }
  }

  private assertUniqueInFileAndDb(
    value: string | undefined,
    fileSet: Set<string>,
    dbMap: Map<string, string>,
    ownerId: string | undefined,
    message: string,
    errors: string[],
  ) {
    if (!value) return;
    const key = value.trim();
    const normalizedKey = /^\d+$/.test(key) ? key : key.toUpperCase();
    const dbOwner = dbMap.get(normalizedKey) ?? dbMap.get(key);
    if (fileSet.has(normalizedKey)) {
      errors.push(message);
      return;
    }
    if (dbOwner && dbOwner !== ownerId) {
      errors.push(message);
      return;
    }
    fileSet.add(normalizedKey);
  }

  private resolveLookupId(
    rawValue: unknown,
    map: Map<string, string>,
    label: string,
    errors: string[],
  ) {
    const text = String(rawValue ?? '').trim();
    if (!text) return undefined;
    const id =
      map.get(text.toUpperCase()) ??
      map.get(text.toLowerCase()) ??
      map.get(text);
    if (!id) errors.push(`Unknown ${label}: ${text}`);
    return id;
  }

  private normalizeGender(value: string) {
    const upper = value.trim().toUpperCase();
    if (['MALE', 'M', 'BOY'].includes(upper)) return 'MALE';
    if (['FEMALE', 'F', 'GIRL'].includes(upper)) return 'FEMALE';
    if (['OTHER', 'O'].includes(upper)) return 'OTHER';
    return null;
  }

  private normalizeImportReligion(value: string) {
    if (!value) return '';
    const upper = value.trim().toUpperCase();
    const aliases: Record<string, string> = {
      CHRISTISN: 'Christian',
      HINDUISM: 'Hindu',
      BUDDHISM: 'Buddhist',
    };
    return aliases[upper] ?? value.trim();
  }

  private normalizeImportDenomination(value: string) {
    if (!value) return '';
    const upper = value.trim().toUpperCase();
    if (upper === 'OTHERS') return 'Other';
    return value.trim();
  }

  private normalizeImportBloodGroup(value: string) {
    if (!value) return '';
    const text = value.trim().replace(/\u2212/g, '-');
    const upper = text.toUpperCase();
    if (['NOT CHECKED', 'NA', 'N/A', 'UNKNOWN', 'NIL'].includes(upper)) {
      return '';
    }
    if (upper === '0+' || upper === '0 POS' || upper === '0POS') return 'O+';
    if (/^O\+VE$/i.test(text)) return 'O+';
    if (/^A\+VE$/i.test(text)) return 'A+';
    if (/^B\+VE$/i.test(text)) return 'B+';
    if (/^AB\+VE$/i.test(text)) return 'AB+';
    if (/^(A|B|O|AB)$/i.test(text)) return `${upper}+`;
    if (/^(A|B|O|AB)[+-]$/i.test(text)) {
      const group = text.slice(0, -1).toUpperCase();
      return text.endsWith('-') ? `${group}\u2212` : `${group}+`;
    }
    return text.trim();
  }

  private parseImportDate(value: string) {
    return parseFlexibleDate(value);
  }

  private parseResidenceType(hostelRaw: string) {
    const upper = hostelRaw.trim().toUpperCase();
    if (!upper) return null;
    if (['YES', 'Y', 'HOSTELLER', 'HOSTEL'].includes(upper)) return 'HOSTELLER';
    if (['NO', 'N', 'DAY_SCHOLAR', 'DAY SCHOLAR', 'DAY'].includes(upper)) {
      return 'DAY_SCHOLAR';
    }
    return null;
  }

  private parseBoardExamFields(raw: Record<string, unknown>) {
    const boardName = String(raw.boardName ?? raw.board ?? '').trim();
    const schoolName = String(raw.lastInstitution ?? '').trim();
    const examYearRaw = String(raw.boardYear ?? '').trim();
    const totalMarksRaw = String(raw.boardTotalMarks ?? '').trim();
    const percentageRaw = String(raw.boardPercentage ?? '').trim();
    const division = String(raw.boardDivision ?? '').trim();
    const registrationType = String(raw.boardRegistrationType ?? '').trim();
    if (
      !boardName &&
      !schoolName &&
      !examYearRaw &&
      !totalMarksRaw &&
      !percentageRaw
    ) {
      return undefined;
    }
    return {
      boardName: boardName || undefined,
      schoolName: schoolName || undefined,
      examYear: examYearRaw ? Number.parseInt(examYearRaw, 10) : undefined,
      totalMarks: totalMarksRaw
        ? Number.parseInt(totalMarksRaw, 10)
        : undefined,
      percentage: percentageRaw ? Number.parseFloat(percentageRaw) : undefined,
      division: division || undefined,
      registrationType: registrationType || undefined,
    };
  }

  private parseCuetFields(raw: Record<string, unknown>) {
    const cuetRollNumber = String(raw.cuetRollNumber ?? '').trim();
    const cuetScoreRaw = String(raw.cuetScore ?? '').trim();
    if (!cuetRollNumber && !cuetScoreRaw) return undefined;
    return {
      cuetRollNumber: cuetRollNumber || undefined,
      cuetScore: cuetScoreRaw ? Number.parseFloat(cuetScoreRaw) : undefined,
    };
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
      mapping.major2,
      mapping.major3,
      mapping.minor,
      mapping.internship,
      mapping.mdc,
      mapping.aec,
      mapping.sec,
      mapping.vac,
      mapping.vtc,
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
        const categoryExisting = SINGLE_SLOT_REGISTRATION_CATEGORIES.has(
          selection.category,
        )
          ? await tx.semesterRegistrationLine.findFirst({
              where: {
                tenantId,
                registrationId: registration.id,
                category: selection.category,
              },
            })
          : null;
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

  private async persistInternshipAreaChoice(
    tenantId: string,
    studentId: string,
    n: NormalizedStudentImportRow,
  ) {
    const internshipArea = n.academicMapping?.internshipArea;
    if (!internshipArea?.slug) return;
    const existing = await this.prisma.studentProgramChoice.findFirst({
      where: {
        tenantId,
        studentId,
        choiceType: 'INTERNSHIP_AREA',
        deletedAt: null,
      },
    });
    if (existing) {
      await this.prisma.studentProgramChoice.update({
        where: { id: existing.id },
        data: { subjectSlug: internshipArea.slug },
      });
    } else {
      await this.prisma.studentProgramChoice.create({
        data: {
          tenantId,
          studentId,
          choiceType: 'INTERNSHIP_AREA',
          subjectSlug: internshipArea.slug,
          status: 'active',
        },
      });
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
    instructions.addRow(['', '']);
    for (const note of this.templateInstructionNotes()) {
      instructions.addRow(note);
    }
    instructions.getRow(1).font = { bold: true };
    instructions.columns.forEach((col) => {
      col.width = 34;
    });

    this.applyDropdowns(students, headers, references);
    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async buildFullAdmissionTemplateWorkbook(options: {
    tenantId: string;
    programme?: string;
    programVersionId?: string;
    academicYearId?: string;
  }): Promise<Buffer> {
    let programme = options.programme;
    let programVersionId = options.programVersionId;
    const programmes = await this.sem1Curriculum.listPublishedProgrammes(
      options.tenantId,
    );
    if (!programme && !programVersionId) {
      const fallback =
        programmes.find((entry) => entry.code.startsWith('BA-')) ??
        programmes[0];
      if (!fallback) {
        throw new BadRequestException(
          'No published programme found. Publish a programme curriculum before downloading the full admission template.',
        );
      }
      programme = fallback.code;
      programVersionId = fallback.programVersionId;
    }

    const [
      sem1Catalog,
      sem3Catalog,
      sem5Catalog,
      sem1MajorDepartments,
      sem3MajorDepartments,
      sem5MajorDepartments,
      batches,
      streams,
      shifts,
      departments,
      academicYears,
      lookups,
    ] = await Promise.all([
      this.sem1Curriculum.buildCatalog(options.tenantId, {
        programme,
        programVersionId,
        semesterSequence: 1,
        academicYearId: options.academicYearId,
      }),
      this.sem3Curriculum.buildCatalog(options.tenantId, {
        programme,
        programVersionId,
        semesterSequence: 3,
      }),
      this.sem5Curriculum.buildCatalog(options.tenantId, {
        programme,
        programVersionId,
        semesterSequence: 5,
        academicYearId: options.academicYearId,
      }),
      this.sem1Curriculum.buildTenantMajorDepartments(options.tenantId, 1),
      this.sem3Curriculum.buildTenantMajorDepartments(options.tenantId, 3),
      this.sem5Curriculum.buildTenantMajorDepartments(options.tenantId, 5),
      this.prisma.admissionBatch.findMany({
        where: { tenantId: options.tenantId, deletedAt: null },
        select: { batchCode: true },
        orderBy: { batchCode: 'asc' },
      }),
      this.prisma.academicStream.findMany({
        where: { tenantId: options.tenantId, deletedAt: null },
        select: { code: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.shift.findMany({
        where: {
          tenantId: options.tenantId,
          deletedAt: null,
          status: 'ACTIVE',
        },
        select: { code: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.department.findMany({
        where: { tenantId: options.tenantId, deletedAt: null },
        select: { code: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.academicYear.findMany({
        where: { tenantId: options.tenantId, deletedAt: null },
        select: { name: true },
        orderBy: { name: 'desc' },
      }),
      this.prisma.masterLookup.findMany({
        where: {
          tenantId: options.tenantId,
          lookupType: {
            in: [
              'CATEGORY',
              'RELIGION',
              'BLOOD_GROUP',
              'TRIBE',
              'DENOMINATION',
              'NATIONALITY',
            ],
          },
          isActive: true,
        },
        select: { code: true, label: true, lookupType: true },
        orderBy: [{ lookupType: 'asc' }, { label: 'asc' }],
      }),
    ]);

    const sampleMajor =
      sem1Catalog.majorDepartments[0]?.departmentName ??
      sem1MajorDepartments[0]?.departmentName ??
      'Economics';
    const sampleMajorKey = this.sem1Curriculum.normalizeLabel(sampleMajor);
    const sampleMinor =
      sem1Catalog.minorByMajor[sampleMajorKey]?.[0] ?? 'History';
    const sampleBatch = batches[0]?.batchCode ?? 'BATCH-2026';
    const sampleStream = streams[0]?.code ?? 'ARTS';
    const sampleShift = shifts[0]?.code ?? 'DAY';
    const sampleSession =
      academicYears[0]?.name ?? sem1Catalog.curriculumLabel ?? '2026-27';

    const sampleByHeader: Record<string, string> = {
      'Academic Year': sampleSession,
      'Admission Date': '2026-06-01',
      'Admission Status': 'ACTIVE',
      'Admission Number': 'ADM-2026-0001',
      'Application Number': 'APP-2026-0001',
      'Form Number': 'FORM-001',
      'Registration Number': 'REG2026001',
      'Roll Number': '',
      'University Roll Number': '',
      'University Registration Number': '',
      'ABC ID': '',
      Shift: sampleShift,
      Programme: sem1Catalog.programCode,
      Department: departments[0]?.code ?? '',
      'Admission Batch': sampleBatch,
      Stream: sampleStream,
      Semester: '1',
      'Full Name': 'Priangshuman Marak',
      Gender: 'Male',
      'Date of Birth': '2006-01-15',
      'Blood Group':
        lookups.find((l) => l.lookupType === 'BLOOD_GROUP')?.label ?? '',
      Category:
        lookups.find((l) => l.lookupType === 'CATEGORY')?.code ?? 'GENERAL',
      'Tribe / Race':
        lookups.find((l) => l.lookupType === 'TRIBE')?.label ?? '',
      Religion: lookups.find((l) => l.lookupType === 'RELIGION')?.label ?? '',
      Denomination:
        lookups.find((l) => l.lookupType === 'DENOMINATION')?.label ?? '',
      Nationality:
        lookups.find((l) => l.lookupType === 'NATIONALITY')?.label ?? 'Indian',
      'Aadhaar Number': '',
      'Email Address': 'student@example.edu',
      'Student Mobile Number': '9876500000',
      'WhatsApp Number': '',
      'Photo File Name': '',
      "Father's Name": 'John Marak',
      "Father's Mobile": '9876500001',
      "Father's Occupation": 'Farmer',
      "Mother's Name": 'Jane Marak',
      "Mother's Mobile": '9876500002',
      "Mother's Occupation": 'Homemaker',
      'Guardian Name': '',
      'Guardian Mobile': '',
      'Present Address': '123 Main Street',
      'Present Village / Town': 'Tura',
      'Present Police Station': '',
      'Present District': 'West Garo Hills',
      'Present State': 'Meghalaya',
      'Present PIN Code': '794001',
      'Permanent Address': '',
      'Permanent Village / Town': '',
      'Permanent District': '',
      'Permanent State': '',
      'Permanent PIN Code': '',
      'Institution Last Attended': 'Don Bosco Higher Secondary School',
      'Board / University': 'MBOSE',
      'Registration / Private': 'REGULAR',
      'Year of Passing': '2025',
      'Total Marks': '450',
      Percentage: '90',
      Division: 'First',
      'CUET Marks': '',
      'CUET Roll Number': '',
      'Major Department': sampleMajor,
      'Minor Department': sampleMinor,
      MDC: sem1Catalog.mdcDepartments[0]?.title ?? '',
      AEC: sem1Catalog.aecPapers[0]?.title ?? '',
      SEC: sem1Catalog.secPapers[0]?.title ?? '',
      VAC: 'Auto-assigned',
      'Major Department (Sem 3)': '',
      'Second Major Department': '',
      'MDC (Sem 3)': '',
      'AEC (Sem 3)': '',
      'SEC (Sem 3)': '',
      VTC: '',
      'Major Department (Sem 5)': '',
      'Minor Department (Sem 5)': '',
      'Internship Subject': '',
      'RFID Number': '',
      'Library Card Number': '',
      Hostel: 'NO',
      Transport: 'NO',
      'Scholarship Category': '',
      'Student Status': 'STUDYING',
      'Section Code': 'A',
    };

    const headers = [...FULL_ADMISSION_IMPORT_HEADERS];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');
    sheet.addRow(headers);
    sheet.addRow(
      headers.map(
        (h) =>
          FULL_ADMISSION_IMPORT_HELPERS[h] ??
          'Optional — stored in student profile when supported',
      ),
    );
    sheet.addRow(headers.map((h) => sampleByHeader[h] ?? ''));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
    sheet.views = [{ state: 'frozen', ySplit: 2 }];
    sheet.columns.forEach((col) => {
      col.width = 24;
    });

    const lookupRows = (type: string) =>
      lookups
        .filter((l) => l.lookupType === type)
        .map((l) => [l.label, l.code]);

    const allSem1Minors = [
      ...new Set(
        Object.values(sem1Catalog.minorByMajor).flatMap((minors) => minors),
      ),
    ].sort((a, b) => a.localeCompare(b));
    const allSem5Minors = [
      ...new Set(
        Object.values(sem5Catalog.minorByMajor).flatMap((minors) => minors),
      ),
    ].sort((a, b) => a.localeCompare(b));

    const hiddenSheets: {
      name: string;
      headers: string[];
      rows: (string | number | null)[][];
      hidden?: boolean;
    }[] = [
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.programmes,
        headers: ['Programme Code', 'Programme Name', 'Program Version Id'],
        rows: programmes.map((p) => [p.code, p.name, p.programVersionId]),
        hidden: true,
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.shifts,
        headers: ['Shift'],
        rows: shifts.map((s) => [s.code]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.batches,
        headers: ['Admission Batch'],
        rows: batches.map((b) => [b.batchCode]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.streams,
        headers: ['Stream'],
        rows: streams.map((s) => [s.code]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.academicYears,
        headers: ['Academic Year'],
        rows: academicYears.map((y) => [y.name]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.departments,
        headers: ['Department Code', 'Department Name'],
        rows: departments.map((d) => [d.code, d.name]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.categories,
        headers: ['Category', 'Code'],
        rows: lookupRows('CATEGORY'),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.religions,
        headers: ['Religion'],
        rows: lookupRows('RELIGION').map(([label]) => [label]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.bloodGroups,
        headers: ['Blood Group'],
        rows: lookupRows('BLOOD_GROUP').map(([label]) => [label]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.tribes,
        headers: ['Tribe / Race'],
        rows: lookupRows('TRIBE').map(([label]) => [label]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.denominations,
        headers: ['Denomination'],
        rows: lookupRows('DENOMINATION').map(([label]) => [label]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.nationalities,
        headers: ['Nationality'],
        rows: lookupRows('NATIONALITY').map(([label]) => [label]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.sem1MajorDepartments,
        headers: ['Major Department'],
        rows: sem1MajorDepartments.map((d) => [d.departmentName]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.sem1Mdc,
        headers: ['MDC'],
        rows: sem1Catalog.mdcDepartments.map((p) => [p.title]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.sem1Aec,
        headers: ['AEC'],
        rows: sem1Catalog.aecPapers.map((p) => [p.title]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.sem1Sec,
        headers: ['SEC'],
        rows: sem1Catalog.secPapers.map((p) => [p.title]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.sem1AllMinors,
        headers: ['Minor Department'],
        rows: allSem1Minors.map((minor) => [minor]),
        hidden: true,
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.gender,
        headers: ['Gender'],
        rows: [['Male'], ['Female'], ['Other']],
        hidden: true,
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.semester,
        headers: ['Semester'],
        rows: [['1'], ['3'], ['5']],
        hidden: true,
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.admissionStatus,
        headers: ['Admission Status'],
        rows: [['ACTIVE'], ['PROVISIONAL'], ['CANCELLED']],
        hidden: true,
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.sem3MajorDepartments,
        headers: ['Major Department (Sem 3)'],
        rows: sem3MajorDepartments.map((d) => [d.departmentName]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.sem3Mdc,
        headers: ['MDC (Sem 3)'],
        rows: sem3Catalog.mdcPapers.map((p) => [p.title]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.sem3Aec,
        headers: ['AEC (Sem 3)'],
        rows: sem3Catalog.aecPapers.map((p) => [p.title]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.sem3Sec,
        headers: ['SEC (Sem 3)'],
        rows: sem3Catalog.secPapers.map((p) => [p.title]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.sem3Vtc,
        headers: ['VTC'],
        rows: sem3Catalog.vtcPapers.map((p) => [p.title]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.sem5MajorDepartments,
        headers: ['Major Department (Sem 5)'],
        rows: sem5MajorDepartments.map((d) => [d.departmentName]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.sem5Internship,
        headers: ['Internship Subject'],
        rows: sem5Catalog.internshipAreas.map((area) => [area]),
      },
      {
        name: FULL_ADMISSION_HIDDEN_SHEETS.sem5AllMinors,
        headers: ['Minor Department (Sem 5)'],
        rows: allSem5Minors.map((minor) => [minor]),
        hidden: true,
      },
    ];

    for (const ref of hiddenSheets) {
      const refSheet = workbook.addWorksheet(ref.name);
      refSheet.addRow(ref.headers);
      for (const row of ref.rows) refSheet.addRow(row);
      refSheet.getRow(1).font = { bold: true };
      refSheet.columns.forEach((col) => {
        col.width = 32;
      });
      if (ref.hidden) refSheet.state = 'veryHidden';
    }

    const curriculumInfo = workbook.addWorksheet('Curriculum Info');
    curriculumInfo.addRow(['Field', 'Value']);
    curriculumInfo.addRow(['Programme', sem1Catalog.programCode]);
    curriculumInfo.addRow(['Programme Name', sem1Catalog.programName]);
    curriculumInfo.addRow(['Curriculum', sem1Catalog.curriculumLabel]);
    curriculumInfo.addRow(['Program Version Id', sem1Catalog.programVersionId]);
    curriculumInfo.addRow([
      'Sem 1 Auto VAC',
      `${sem1Catalog.vacPaper.code} — ${sem1Catalog.vacPaper.title}`,
    ]);
    curriculumInfo.addRow(['Generated At', new Date().toISOString()]);
    curriculumInfo.getRow(1).font = { bold: true };
    curriculumInfo.columns.forEach((col) => {
      col.width = 36;
    });

    const instructions = workbook.addWorksheet('Instructions');
    instructions.addRow(['Section', 'Column', 'Notes']);
    let currentSection = '';
    for (const field of STUDENT_IMPORT_FIELD_REGISTRY.filter(
      (f) => f.visible && f.key !== 'vacNote',
    )) {
      const sectionLabel = IMPORT_SECTION_LABELS[field.section];
      instructions.addRow([
        sectionLabel !== currentSection ? sectionLabel : '',
        `${field.header}${field.required ? ' (required)' : ''}`,
        field.helper ??
          FULL_ADMISSION_IMPORT_HELPERS[field.header] ??
          'Imported when mapped',
      ]);
      currentSection = sectionLabel;
    }
    instructions.addRow(['', '', '']);
    for (const note of FULL_ADMISSION_STRUCTURE_NOTES) {
      instructions.addRow(['Overview', '', note]);
    }
    instructions.getRow(1).font = { bold: true };
    instructions.columns.forEach((col) => {
      col.width = 36;
    });

    this.applyFullAdmissionDropdowns(sheet, headers, hiddenSheets);

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private applyFullAdmissionDropdowns(
    sheet: ExcelJS.Worksheet,
    headers: string[],
    references: { name: string; rows: (string | number | null)[][] }[],
  ) {
    const refByName = new Map(references.map((ref) => [ref.name, ref]));
    const requiredHeaders = new Set(['Programme', 'Semester']);
    const listDropdownMap: Record<
      string,
      { refName: string; column?: string }
    > = {
      Programme: {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.programmes,
        column: 'A',
      },
      Shift: { refName: FULL_ADMISSION_HIDDEN_SHEETS.shifts, column: 'A' },
      'Admission Batch': {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.batches,
        column: 'A',
      },
      Stream: { refName: FULL_ADMISSION_HIDDEN_SHEETS.streams, column: 'A' },
      'Academic Year': {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.academicYears,
        column: 'A',
      },
      Department: {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.departments,
        column: 'A',
      },
      Category: {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.categories,
        column: 'A',
      },
      Religion: {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.religions,
        column: 'A',
      },
      'Blood Group': {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.bloodGroups,
        column: 'A',
      },
      'Tribe / Race': {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.tribes,
        column: 'A',
      },
      Denomination: {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.denominations,
        column: 'A',
      },
      Nationality: {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.nationalities,
        column: 'A',
      },
      Gender: { refName: FULL_ADMISSION_HIDDEN_SHEETS.gender, column: 'A' },
      Semester: {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.semester,
        column: 'A',
      },
      'Admission Status': {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.admissionStatus,
        column: 'A',
      },
      'Major Department': {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.sem1MajorDepartments,
        column: 'A',
      },
      'Minor Department': {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.sem1AllMinors,
        column: 'A',
      },
      MDC: { refName: FULL_ADMISSION_HIDDEN_SHEETS.sem1Mdc, column: 'A' },
      AEC: { refName: FULL_ADMISSION_HIDDEN_SHEETS.sem1Aec, column: 'A' },
      SEC: { refName: FULL_ADMISSION_HIDDEN_SHEETS.sem1Sec, column: 'A' },
      'Major Department (Sem 3)': {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.sem3MajorDepartments,
        column: 'A',
      },
      'MDC (Sem 3)': {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.sem3Mdc,
        column: 'A',
      },
      'AEC (Sem 3)': {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.sem3Aec,
        column: 'A',
      },
      'SEC (Sem 3)': {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.sem3Sec,
        column: 'A',
      },
      VTC: { refName: FULL_ADMISSION_HIDDEN_SHEETS.sem3Vtc, column: 'A' },
      'Major Department (Sem 5)': {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.sem5MajorDepartments,
        column: 'A',
      },
      'Minor Department (Sem 5)': {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.sem5AllMinors,
        column: 'A',
      },
      'Internship Subject': {
        refName: FULL_ADMISSION_HIDDEN_SHEETS.sem5Internship,
        column: 'A',
      },
    };

    for (const [header, config] of Object.entries(listDropdownMap)) {
      const columnIndex = headers.indexOf(header) + 1;
      const ref = refByName.get(config.refName);
      if (!columnIndex || !ref?.rows.length) continue;
      applyWorksheetListValidation(
        sheet,
        columnIndex,
        excelSheetListFormula(
          config.refName,
          ref.rows.length,
          config.column ?? 'A',
        ),
        { allowBlank: !requiredHeaders.has(header) },
      );
    }
  }

  async buildSem1AdmissionTemplateWorkbook(options: {
    tenantId: string;
    programme?: string;
    programVersionId?: string;
    semesterSequence?: number;
    academicYearId?: string;
  }): Promise<Buffer> {
    const semesterSequence = options.semesterSequence ?? 1;
    let programme = options.programme;
    let programVersionId = options.programVersionId;
    if (!programme && !programVersionId) {
      const programmes = await this.sem1Curriculum.listPublishedProgrammes(
        options.tenantId,
      );
      const fallback =
        programmes.find((entry) => entry.code.startsWith('BA-')) ??
        programmes[0];
      if (!fallback) {
        throw new BadRequestException(
          'No published programme found. Publish a programme curriculum before downloading the Semester 1 template.',
        );
      }
      programme = fallback.code;
      programVersionId = fallback.programVersionId;
    }
    const catalog = await this.sem1Curriculum.buildCatalog(options.tenantId, {
      programme,
      programVersionId,
      semesterSequence,
      academicYearId: options.academicYearId,
    });
    const majorDepartments =
      await this.sem1Curriculum.buildTenantMajorDepartments(
        options.tenantId,
        semesterSequence,
      );
    const programmes = await this.sem1Curriculum.listPublishedProgrammes(
      options.tenantId,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');
    const headers = [...SEM1_SUBJECT_IMPORT_HEADERS];
    const sampleMajor =
      catalog.majorDepartments[0]?.departmentName ??
      majorDepartments[0]?.departmentName ??
      'Economics';
    const sampleMajorKey = this.sem1Curriculum.normalizeLabel(sampleMajor);
    const sampleMinor = catalog.minorByMajor[sampleMajorKey]?.[0] ?? 'History';
    const sampleRow = {
      ...SEM1_SUBJECT_IMPORT_SAMPLE_ROW,
      Programme: catalog.programCode,
      'Current Semester': String(semesterSequence),
      'Major Department': sampleMajor,
      'Minor Department': sampleMinor,
      'MDC Department': catalog.mdcDepartments[0]?.title ?? '',
      'AEC Paper': catalog.aecPapers[0]?.title ?? '',
      'Skill Enhancement Course': catalog.secPapers[0]?.title ?? '',
    };

    sheet.addRow(headers);
    sheet.addRow(
      headers.map(
        (h) =>
          SEM1_SUBJECT_IMPORT_HELPERS[h] ??
          'Optional — stored in student profile when supported',
      ),
    );
    sheet.addRow(
      headers.map((h) => sampleRow[h as keyof typeof sampleRow] ?? ''),
    );
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
    sheet.views = [{ state: 'frozen', ySplit: 2 }];
    sheet.columns.forEach((col) => {
      col.width = 24;
    });

    const minorsByMajorRows = catalog.majorDepartments.map((major) => {
      const minors =
        catalog.minorByMajor[
          this.sem1Curriculum.normalizeLabel(major.departmentName)
        ] ?? [];
      return [major.departmentName, ...minors];
    });

    const hiddenSheets = [
      {
        name: SEM1_HIDDEN_SHEETS.programmes,
        headers: [
          'Programme Code',
          'Programme Name',
          'Program Version Id',
          'Curriculum',
        ],
        rows: programmes.map((programme) => [
          programme.code,
          programme.name,
          programme.programVersionId,
          programme.curriculumLabel,
        ]),
        hidden: true,
      },
      {
        name: SEM1_HIDDEN_SHEETS.majorDepartments,
        headers: ['Major Department'],
        rows: majorDepartments.map((department) => [department.departmentName]),
      },
      {
        name: SEM1_HIDDEN_SHEETS.majorLookup,
        headers: ['Major Department', 'Major Code', 'Major Title'],
        rows: catalog.majorDepartments.map((department) => [
          department.departmentName,
          department.paper.code,
          department.paper.title,
        ]),
        hidden: true,
      },
      {
        name: SEM1_HIDDEN_SHEETS.mdcDepartments,
        headers: ['MDC Department', 'Course Code'],
        rows: catalog.mdcDepartments.map((paper) => [paper.title, paper.code]),
      },
      {
        name: SEM1_HIDDEN_SHEETS.aecPapers,
        headers: ['AEC Paper', 'Course Code'],
        rows: catalog.aecPapers.map((paper) => [paper.title, paper.code]),
      },
      {
        name: SEM1_HIDDEN_SHEETS.secPapers,
        headers: ['Skill Enhancement Course', 'Course Code'],
        rows: catalog.secPapers.map((paper) => [paper.title, paper.code]),
      },
      {
        name: SEM1_HIDDEN_SHEETS.minorsByMajor,
        headers: [
          'Major Department',
          'Minor 1',
          'Minor 2',
          'Minor 3',
          'Minor 4',
          'Minor 5',
        ],
        rows: minorsByMajorRows,
        hidden: true,
      },
    ];

    for (const ref of hiddenSheets) {
      const refSheet = workbook.addWorksheet(ref.name);
      refSheet.addRow(ref.headers);
      for (const row of ref.rows) refSheet.addRow(row);
      refSheet.getRow(1).font = { bold: true };
      refSheet.columns.forEach((col) => {
        col.width = 32;
      });
      if (ref.hidden) {
        refSheet.state = 'veryHidden';
      }
    }

    const minorsSheet = workbook.getWorksheet(SEM1_HIDDEN_SHEETS.minorsByMajor);
    if (minorsSheet) {
      catalog.majorDepartments.forEach((major, index) => {
        const rowNumber = index + 2;
        const minors =
          catalog.minorByMajor[
            this.sem1Curriculum.normalizeLabel(major.departmentName)
          ] ?? [];
        if (!minors.length) return;
        const endCol = excelColumnLetter(1 + minors.length);
        const rangeName = this.excelMajorMinorsRangeName(major.departmentName);
        workbook.definedNames.add(
          rangeName,
          `'${SEM1_HIDDEN_SHEETS.minorsByMajor.replace(/'/g, "''")}'!$B$${rowNumber}:$${endCol}$${rowNumber}`,
        );
      });
    }

    const curriculumInfo = workbook.addWorksheet('Curriculum Info');
    curriculumInfo.addRow(['Field', 'Value']);
    curriculumInfo.addRow(['Programme', catalog.programCode]);
    curriculumInfo.addRow(['Programme Name', catalog.programName]);
    curriculumInfo.addRow(['Curriculum', catalog.curriculumLabel]);
    curriculumInfo.addRow(['Semester', catalog.semesterSequence]);
    curriculumInfo.addRow(['Program Version Id', catalog.programVersionId]);
    curriculumInfo.addRow([
      'Auto VAC',
      `${catalog.vacPaper.code} — ${catalog.vacPaper.title}`,
    ]);
    curriculumInfo.addRow(['Generated At', new Date().toISOString()]);
    curriculumInfo.getRow(1).font = { bold: true };
    curriculumInfo.columns.forEach((col) => {
      col.width = 36;
    });

    const instructions = workbook.addWorksheet('Instructions');
    instructions.addRow(['Column', 'Notes']);
    for (const header of headers) {
      instructions.addRow([
        header,
        SEM1_SUBJECT_IMPORT_HELPERS[header] ??
          'Imported when mapped; extra columns are preserved for future profile fields.',
      ]);
    }
    instructions.addRow(['', '']);
    for (const note of SEM1_STRUCTURE_NOTES) {
      instructions.addRow(['Structure', note]);
    }
    instructions.getRow(1).font = { bold: true };
    instructions.columns.forEach((col) => {
      col.width = 36;
    });

    this.applySem1Dropdowns(sheet, headers, hiddenSheets, programmes, catalog);
    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private applySem1Dropdowns(
    sheet: ExcelJS.Worksheet,
    headers: string[],
    references: {
      name: string;
      rows: (string | number | null)[][];
    }[],
    programmes: { code: string }[],
    catalog: Sem1ImportCurriculumCatalog,
  ) {
    const nameDropdownMap: Record<string, { refName: string; column: string }> =
      {
        Programme: { refName: SEM1_HIDDEN_SHEETS.programmes, column: 'A' },
        'Major Department': {
          refName: SEM1_HIDDEN_SHEETS.majorDepartments,
          column: 'A',
        },
        'MDC Department': {
          refName: SEM1_HIDDEN_SHEETS.mdcDepartments,
          column: 'A',
        },
        'AEC Paper': { refName: SEM1_HIDDEN_SHEETS.aecPapers, column: 'A' },
        'Skill Enhancement Course': {
          refName: SEM1_HIDDEN_SHEETS.secPapers,
          column: 'A',
        },
      };
    const refByName = new Map(references.map((ref) => [ref.name, ref]));
    const majorColIndex = headers.indexOf('Major Department') + 1;
    const minorColIndex = headers.indexOf('Minor Department') + 1;
    const majorColLetter = majorColIndex
      ? excelColumnLetter(majorColIndex)
      : 'L';

    for (const [header, config] of Object.entries(nameDropdownMap)) {
      const columnIndex = headers.indexOf(header) + 1;
      const ref = refByName.get(config.refName);
      if (!columnIndex) continue;
      if (header === 'Programme' && programmes.length) {
        const values = programmes.map((programme) => programme.code).join(',');
        for (let row = 3; row <= 1000; row += 1) {
          sheet.getCell(row, columnIndex).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: [`"${values}"`],
            showErrorMessage: true,
            errorTitle: 'Invalid programme',
            error: 'Choose a programme from the dropdown.',
          };
        }
        continue;
      }
      if (!ref?.rows.length) continue;
      const formula = this.excelReferenceFormula(
        config.refName,
        ref.rows.length,
        config.column,
      );
      for (let row = 3; row <= 1000; row += 1) {
        sheet.getCell(row, columnIndex).dataValidation = {
          type: 'list',
          allowBlank: header === 'Programme' ? false : true,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: 'Invalid selection',
          error: `Choose a valid option from ${config.refName}.`,
        };
      }
    }

    if (minorColIndex && majorColIndex && catalog.majorDepartments.length) {
      for (let row = 3; row <= 1000; row += 1) {
        sheet.getCell(row, minorColIndex).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [
            `=INDIRECT(SUBSTITUTE($${majorColLetter}${row}," ","_")&"_Minors")`,
          ],
          showErrorMessage: true,
          errorTitle: 'Invalid minor',
          error:
            'Choose a minor department allowed for the selected major department.',
        };
      }
    }
  }

  async buildSem1LegacyFullAdmissionTemplateWorkbook(): Promise<Buffer> {
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

  async buildSem3AdmissionTemplateWorkbook(options: {
    tenantId: string;
    programme?: string;
    programVersionId?: string;
    semesterSequence?: number;
  }): Promise<Buffer> {
    const semesterSequence = options.semesterSequence ?? 3;
    let programme = options.programme;
    let programVersionId = options.programVersionId;
    if (!programme && !programVersionId) {
      const programmes = await this.sem3Curriculum.listPublishedProgrammes(
        options.tenantId,
      );
      const fallback =
        programmes.find((entry) => entry.code.startsWith('BA-')) ??
        programmes[0];
      if (!fallback) {
        throw new BadRequestException(
          'No published programme found. Publish a programme curriculum before downloading the Semester 3 template.',
        );
      }
      programme = fallback.code;
      programVersionId = fallback.programVersionId;
    }
    const catalog = await this.sem3Curriculum.buildCatalog(options.tenantId, {
      programme,
      programVersionId,
      semesterSequence,
    });
    const majorDepartments =
      await this.sem3Curriculum.buildTenantMajorDepartments(
        options.tenantId,
        semesterSequence,
      );
    const programmes = await this.sem3Curriculum.listPublishedProgrammes(
      options.tenantId,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');
    const headers = [...SEM3_ADMISSION_TEMPLATE_HEADERS];
    const sampleRow = {
      ...SEM3_ADMISSION_SAMPLE_ROW,
      Programme: catalog.programCode,
      'Current Semester': String(semesterSequence),
      'Major Department':
        catalog.majorDepartments[0]?.departmentName ??
        majorDepartments[0]?.departmentName ??
        'Economics',
      'MDC Paper': catalog.mdcPapers[0]?.title ?? '',
      'AEC Paper': catalog.aecPapers[0]?.title ?? '',
      'SEC Paper': catalog.secPapers[0]?.title ?? '',
      'VTC Paper': catalog.vtcPapers[0]?.title ?? '',
    };

    sheet.addRow(headers);
    sheet.addRow(
      headers.map(
        (h) =>
          SEM3_ADMISSION_TEMPLATE_HELPERS[h] ??
          'Optional — stored in student profile when supported',
      ),
    );
    sheet.addRow(
      headers.map((h) => sampleRow[h as keyof typeof sampleRow] ?? ''),
    );
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
    sheet.views = [{ state: 'frozen', ySplit: 2 }];
    sheet.columns.forEach((col) => {
      col.width = 24;
    });

    const hiddenSheets = [
      {
        name: SEM3_HIDDEN_SHEETS.programmes,
        headers: ['Programme Code', 'Programme Name', 'Program Version Id'],
        rows: programmes.map((programme) => [
          programme.code,
          programme.name,
          programme.programVersionId,
        ]),
        hidden: true,
      },
      {
        name: SEM3_HIDDEN_SHEETS.majorDepartments,
        headers: ['Major Department'],
        rows: majorDepartments.map((department) => [department.departmentName]),
      },
      {
        name: SEM3_HIDDEN_SHEETS.majorLookup,
        headers: [
          'Major Department',
          'Paper 1 Code',
          'Paper 1 Title',
          'Paper 2 Code',
          'Paper 2 Title',
        ],
        rows: majorDepartments.map((department) => [
          department.departmentName,
          department.paper1.code,
          department.paper1.title,
          department.paper2.code,
          department.paper2.title,
        ]),
        hidden: true,
      },
      {
        name: SEM3_HIDDEN_SHEETS.mdcPapers,
        headers: ['MDC Paper', 'Course Code'],
        rows: catalog.mdcPapers.map((paper) => [paper.title, paper.code]),
      },
      {
        name: SEM3_HIDDEN_SHEETS.aecPapers,
        headers: ['AEC Paper', 'Course Code'],
        rows: catalog.aecPapers.map((paper) => [paper.title, paper.code]),
      },
      {
        name: SEM3_HIDDEN_SHEETS.secPapers,
        headers: ['SEC Paper', 'Course Code'],
        rows: catalog.secPapers.map((paper) => [paper.title, paper.code]),
      },
      {
        name: SEM3_HIDDEN_SHEETS.vtcPapers,
        headers: ['VTC Paper', 'Course Code'],
        rows: catalog.vtcPapers.map((paper) => [paper.title, paper.code]),
      },
    ];

    for (const ref of hiddenSheets) {
      const refSheet = workbook.addWorksheet(ref.name);
      refSheet.addRow(ref.headers);
      for (const row of ref.rows) refSheet.addRow(row);
      refSheet.getRow(1).font = { bold: true };
      refSheet.columns.forEach((col) => {
        col.width = 32;
      });
      if (ref.hidden) {
        refSheet.state = 'veryHidden';
      }
    }

    const curriculumInfo = workbook.addWorksheet('Curriculum Info');
    curriculumInfo.addRow(['Field', 'Value']);
    curriculumInfo.addRow(['Programme', catalog.programCode]);
    curriculumInfo.addRow(['Programme Name', catalog.programName]);
    curriculumInfo.addRow(['Semester', catalog.semesterSequence]);
    curriculumInfo.addRow(['Program Version Id', catalog.programVersionId]);
    curriculumInfo.addRow(['Generated At', new Date().toISOString()]);
    curriculumInfo.getRow(1).font = { bold: true };
    curriculumInfo.columns.forEach((col) => {
      col.width = 36;
    });

    const instructions = workbook.addWorksheet('Instructions');
    instructions.addRow(['Column', 'Notes']);
    for (const header of headers) {
      instructions.addRow([
        header,
        SEM3_ADMISSION_TEMPLATE_HELPERS[header] ??
          'Imported when mapped; extra columns are preserved for future profile fields.',
      ]);
    }
    instructions.addRow(['', '']);
    for (const note of SEM3_STRUCTURE_NOTES) {
      instructions.addRow(['Structure', note]);
    }
    instructions.getRow(1).font = { bold: true };
    instructions.columns.forEach((col) => {
      col.width = 36;
    });

    this.applySem3Dropdowns(sheet, headers, hiddenSheets, programmes);
    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async buildSem5AdmissionTemplateWorkbook(options: {
    tenantId: string;
    programme?: string;
    programVersionId?: string;
    semesterSequence?: number;
    academicYearId?: string;
  }): Promise<Buffer> {
    const semesterSequence = options.semesterSequence ?? 5;
    let programme = options.programme;
    let programVersionId = options.programVersionId;
    if (!programme && !programVersionId) {
      const programmes = await this.sem5Curriculum.listPublishedProgrammes(
        options.tenantId,
      );
      const fallback =
        programmes.find((entry) => entry.code.startsWith('BA-')) ??
        programmes[0];
      if (!fallback) {
        throw new BadRequestException(
          'No published programme found. Publish a programme curriculum before downloading the Semester 5 template.',
        );
      }
      programme = fallback.code;
      programVersionId = fallback.programVersionId;
    }
    const catalog = await this.sem5Curriculum.buildCatalog(options.tenantId, {
      programme,
      programVersionId,
      semesterSequence,
      academicYearId: options.academicYearId,
    });
    const majorDepartments =
      await this.sem5Curriculum.buildTenantMajorDepartments(
        options.tenantId,
        semesterSequence,
      );
    const programmes = await this.sem5Curriculum.listPublishedProgrammes(
      options.tenantId,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');
    const headers = [...SEM5_ADMISSION_TEMPLATE_HEADERS];
    const sampleMajor =
      catalog.majorDepartments[0]?.departmentName ??
      majorDepartments[0]?.departmentName ??
      'Economics';
    const sampleMajorKey = this.sem5Curriculum.normalizeLabel(sampleMajor);
    const sampleMinor = catalog.minorByMajor[sampleMajorKey]?.[0] ?? 'History';
    const sampleRow = {
      ...SEM5_ADMISSION_SAMPLE_ROW,
      Programme: catalog.programCode,
      'Current Semester': String(semesterSequence),
      'Major Department': sampleMajor,
      'Minor Department': sampleMinor,
      'Internship Area': catalog.internshipAreas[0] ?? 'Bank Internship',
    };

    sheet.addRow(headers);
    sheet.addRow(
      headers.map(
        (h) =>
          SEM5_ADMISSION_TEMPLATE_HELPERS[h] ??
          'Optional — stored in student profile when supported',
      ),
    );
    sheet.addRow(
      headers.map((h) => sampleRow[h as keyof typeof sampleRow] ?? ''),
    );
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
    sheet.views = [{ state: 'frozen', ySplit: 2 }];
    sheet.columns.forEach((col) => {
      col.width = 24;
    });

    const minorsByMajorRows = catalog.majorDepartments.map((major) => {
      const minors =
        catalog.minorByMajor[
          this.sem5Curriculum.normalizeLabel(major.departmentName)
        ] ?? [];
      return [major.departmentName, ...minors];
    });

    const hiddenSheets = [
      {
        name: SEM5_HIDDEN_SHEETS.programmes,
        headers: [
          'Programme Code',
          'Programme Name',
          'Program Version Id',
          'Curriculum',
        ],
        rows: programmes.map((programme) => [
          programme.code,
          programme.name,
          programme.programVersionId,
          programme.curriculumLabel,
        ]),
        hidden: true,
      },
      {
        name: SEM5_HIDDEN_SHEETS.majorDepartments,
        headers: ['Major Department'],
        rows: majorDepartments.map((department) => [department.departmentName]),
      },
      {
        name: SEM5_HIDDEN_SHEETS.majorLookup,
        headers: [
          'Major Department',
          'Paper 1 Code',
          'Paper 1 Title',
          'Paper 2 Code',
          'Paper 2 Title',
          'Paper 3 Code',
          'Paper 3 Title',
          'Internship Code',
          'Internship Title',
        ],
        rows: catalog.majorDepartments.map((department) => [
          department.departmentName,
          department.paper1.code,
          department.paper1.title,
          department.paper2.code,
          department.paper2.title,
          department.paper3.code,
          department.paper3.title,
          department.internship.code,
          department.internship.title,
        ]),
        hidden: true,
      },
      {
        name: SEM5_HIDDEN_SHEETS.internshipAreas,
        headers: ['Internship Area'],
        rows: catalog.internshipAreas.map((area) => [area]),
      },
      {
        name: SEM5_HIDDEN_SHEETS.minorsByMajor,
        headers: [
          'Major Department',
          'Minor 1',
          'Minor 2',
          'Minor 3',
          'Minor 4',
          'Minor 5',
        ],
        rows: minorsByMajorRows,
        hidden: true,
      },
    ];

    for (const ref of hiddenSheets) {
      const refSheet = workbook.addWorksheet(ref.name);
      refSheet.addRow(ref.headers);
      for (const row of ref.rows) refSheet.addRow(row);
      refSheet.getRow(1).font = { bold: true };
      refSheet.columns.forEach((col) => {
        col.width = 32;
      });
      if (ref.hidden) {
        refSheet.state = 'veryHidden';
      }
    }

    const minorsSheet = workbook.getWorksheet(SEM5_HIDDEN_SHEETS.minorsByMajor);
    if (minorsSheet) {
      catalog.majorDepartments.forEach((major, index) => {
        const rowNumber = index + 2;
        const minors =
          catalog.minorByMajor[
            this.sem5Curriculum.normalizeLabel(major.departmentName)
          ] ?? [];
        if (!minors.length) return;
        const endCol = excelColumnLetter(1 + minors.length);
        const rangeName = this.excelMajorMinorsRangeName(major.departmentName);
        workbook.definedNames.add(
          rangeName,
          `'${SEM5_HIDDEN_SHEETS.minorsByMajor.replace(/'/g, "''")}'!$B$${rowNumber}:$${endCol}$${rowNumber}`,
        );
      });
    }

    const curriculumInfo = workbook.addWorksheet('Curriculum Info');
    curriculumInfo.addRow(['Field', 'Value']);
    curriculumInfo.addRow(['Programme', catalog.programCode]);
    curriculumInfo.addRow(['Programme Name', catalog.programName]);
    curriculumInfo.addRow(['Curriculum', catalog.curriculumLabel]);
    curriculumInfo.addRow(['Semester', catalog.semesterSequence]);
    curriculumInfo.addRow(['Program Version Id', catalog.programVersionId]);
    curriculumInfo.addRow(['Generated At', new Date().toISOString()]);
    curriculumInfo.getRow(1).font = { bold: true };
    curriculumInfo.columns.forEach((col) => {
      col.width = 36;
    });

    const instructions = workbook.addWorksheet('Instructions');
    instructions.addRow(['Column', 'Notes']);
    for (const header of headers) {
      instructions.addRow([
        header,
        SEM5_ADMISSION_TEMPLATE_HELPERS[header] ??
          'Imported when mapped; extra columns are preserved for future profile fields.',
      ]);
    }
    instructions.addRow(['', '']);
    for (const note of SEM5_STRUCTURE_NOTES) {
      instructions.addRow(['Structure', note]);
    }
    instructions.getRow(1).font = { bold: true };
    instructions.columns.forEach((col) => {
      col.width = 36;
    });

    this.applySem5Dropdowns(sheet, headers, hiddenSheets, programmes, catalog);
    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private excelMajorMinorsRangeName(majorDepartment: string) {
    const sanitized = majorDepartment
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `${sanitized || 'Major'}_Minors`;
  }

  private applySem5Dropdowns(
    sheet: ExcelJS.Worksheet,
    headers: string[],
    references: {
      name: string;
      rows: (string | number | null)[][];
    }[],
    programmes: { code: string }[],
    catalog: Sem5ImportCurriculumCatalog,
  ) {
    const nameDropdownMap: Record<string, { refName: string; column: string }> =
      {
        Programme: { refName: SEM5_HIDDEN_SHEETS.programmes, column: 'A' },
        'Major Department': {
          refName: SEM5_HIDDEN_SHEETS.majorDepartments,
          column: 'A',
        },
        'Internship Area': {
          refName: SEM5_HIDDEN_SHEETS.internshipAreas,
          column: 'A',
        },
      };
    const refByName = new Map(references.map((ref) => [ref.name, ref]));
    const majorColIndex = headers.indexOf('Major Department') + 1;
    const minorColIndex = headers.indexOf('Minor Department') + 1;
    const majorColLetter = majorColIndex
      ? excelColumnLetter(majorColIndex)
      : 'L';

    for (const [header, config] of Object.entries(nameDropdownMap)) {
      const columnIndex = headers.indexOf(header) + 1;
      const ref = refByName.get(config.refName);
      if (!columnIndex) continue;
      if (header === 'Programme' && programmes.length) {
        const values = programmes.map((programme) => programme.code).join(',');
        for (let row = 3; row <= 1000; row += 1) {
          sheet.getCell(row, columnIndex).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: [`"${values}"`],
            showErrorMessage: true,
            errorTitle: 'Invalid programme',
            error: 'Choose a programme from the dropdown.',
          };
        }
        continue;
      }
      if (!ref?.rows.length) continue;
      const formula = this.excelReferenceFormula(
        config.refName,
        ref.rows.length,
        config.column,
      );
      for (let row = 3; row <= 1000; row += 1) {
        sheet.getCell(row, columnIndex).dataValidation = {
          type: 'list',
          allowBlank: header === 'Programme' ? false : true,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: 'Invalid selection',
          error: `Choose a valid option from ${config.refName}.`,
        };
      }
    }

    if (minorColIndex && majorColIndex && catalog.majorDepartments.length) {
      for (let row = 3; row <= 1000; row += 1) {
        sheet.getCell(row, minorColIndex).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [
            `=INDIRECT(SUBSTITUTE($${majorColLetter}${row}," ","_")&"_Minors")`,
          ],
          showErrorMessage: true,
          errorTitle: 'Invalid minor',
          error:
            'Choose a minor department allowed for the selected major department.',
        };
      }
    }
  }

  private applySem3Dropdowns(
    sheet: ExcelJS.Worksheet,
    headers: string[],
    references: {
      name: string;
      rows: (string | number | null)[][];
    }[],
    programmes: { code: string }[],
  ) {
    const nameDropdownMap: Record<string, { refName: string; column: string }> =
      {
        Programme: { refName: SEM3_HIDDEN_SHEETS.programmes, column: 'A' },
        'Major Department': {
          refName: SEM3_HIDDEN_SHEETS.majorDepartments,
          column: 'A',
        },
        'MDC Paper': { refName: SEM3_HIDDEN_SHEETS.mdcPapers, column: 'A' },
        'AEC Paper': { refName: SEM3_HIDDEN_SHEETS.aecPapers, column: 'A' },
        'SEC Paper': { refName: SEM3_HIDDEN_SHEETS.secPapers, column: 'A' },
        'VTC Paper': { refName: SEM3_HIDDEN_SHEETS.vtcPapers, column: 'A' },
      };
    const refByName = new Map(references.map((ref) => [ref.name, ref]));

    for (const [header, config] of Object.entries(nameDropdownMap)) {
      const columnIndex = headers.indexOf(header) + 1;
      const ref = refByName.get(config.refName);
      if (!columnIndex) continue;
      if (header === 'Programme' && programmes.length) {
        const values = programmes.map((programme) => programme.code).join(',');
        for (let row = 3; row <= 1000; row += 1) {
          sheet.getCell(row, columnIndex).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: [`"${values}"`],
            showErrorMessage: true,
            errorTitle: 'Invalid programme',
            error: 'Choose a programme from the dropdown.',
          };
        }
        continue;
      }
      if (!ref?.rows.length) continue;
      const formula = this.excelReferenceFormula(
        config.refName,
        ref.rows.length,
        config.column,
      );
      for (let row = 3; row <= 1000; row += 1) {
        sheet.getCell(row, columnIndex).dataValidation = {
          type: 'list',
          allowBlank: header === 'Programme' ? false : true,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: 'Invalid selection',
          error: `Choose a valid option from ${config.refName}.`,
        };
      }
    }
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
    const categoryHeaders = [
      'Code',
      'Name',
      'Display Label',
      'Semester',
      'Department',
      'Programme Applicability',
    ];
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

    const categorySheets: { category: FyugpCategory; name: string }[] = [
      { category: 'MAJOR', name: 'MAJOR Papers' },
      { category: 'MINOR', name: 'MINOR Papers' },
      { category: 'MDC', name: 'MDC Papers' },
      { category: 'AEC', name: 'AEC Papers' },
      { category: 'SEC', name: 'SEC Papers' },
      { category: 'VAC', name: 'VAC Papers' },
      { category: 'VTC', name: 'VTC Papers' },
    ];
    const subjectMasterRows: (string | number | null)[][] = [];
    const categoryReferences: TemplateReference[] = categorySheets.map(
      ({ category, name }) => {
        const rawRows = byCategory(category).length
          ? byCategory(category)
          : subjectFallback(category);
        const rows = this.enrichCategoryReferenceRows(rawRows);
        for (const row of rows) {
          subjectMasterRows.push([
            FYUGP_CATEGORY_LABELS[category],
            row[0],
            row[1],
            row[2],
          ]);
        }
        return { name, headers: categoryHeaders, rows };
      },
    );

    return [
      {
        name: 'SUBJECT_MASTER',
        headers: ['Subject Type', 'Code', 'Subject Name', 'Display Label'],
        rows: subjectMasterRows,
      },
      ...categoryReferences,
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
    const codeDropdownMap: Record<string, { refName: string; column: string }> =
      {
        MAJOR_CODE: { refName: 'MAJOR Papers', column: 'C' },
        MAJOR_CODE_2: { refName: 'MAJOR Papers', column: 'C' },
        MINOR_CODE: { refName: 'MINOR Papers', column: 'C' },
        MDC_CODE: { refName: 'MDC Papers', column: 'C' },
        AEC_CODE: { refName: 'AEC Papers', column: 'C' },
        SEC_CODE: { refName: 'SEC Papers', column: 'C' },
        VAC_CODE: { refName: 'VAC Papers', column: 'C' },
        VTC_CODE: { refName: 'VTC Papers', column: 'C' },
        Department: { refName: 'Departments', column: 'A' },
      };
    const nameDropdownMap: Record<string, { refName: string; column: string }> =
      {
        'Major Subject': { refName: 'MAJOR Papers', column: 'B' },
        'Major Subject 2': { refName: 'MAJOR Papers', column: 'B' },
        'Minor Subject': { refName: 'MINOR Papers', column: 'B' },
        'MDC Choice': { refName: 'MDC Papers', column: 'B' },
        AEC: { refName: 'AEC Papers', column: 'B' },
        SEC: { refName: 'SEC Papers', column: 'B' },
        VAC: { refName: 'VAC Papers', column: 'B' },
        VTC: { refName: 'VTC Papers', column: 'B' },
      };

    const applyListValidation = (
      header: string,
      refName: string,
      column: string,
      errorLabel: string,
    ) => {
      const columnIndex = headers.indexOf(header) + 1;
      const ref = refByName.get(refName);
      if (!columnIndex || !ref?.rows.length) return;
      const formula = this.excelReferenceFormula(
        refName,
        ref.rows.length,
        column,
      );
      for (let row = 3; row <= 1000; row += 1) {
        sheet.getCell(row, columnIndex).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: 'Invalid subject',
          error: `Choose a valid option from ${errorLabel}.`,
        };
      }
    };

    for (const [header, config] of Object.entries(codeDropdownMap)) {
      applyListValidation(
        header,
        config.refName,
        config.column,
        config.refName,
      );
    }
    for (const [header, config] of Object.entries(nameDropdownMap)) {
      applyListValidation(
        header,
        config.refName,
        config.column,
        config.refName,
      );
    }
  }

  private excelReferenceFormula(
    sheetName: string,
    rowCount: number,
    column = 'A',
  ) {
    return excelSheetListFormula(sheetName, rowCount, column);
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
      'Priangshuman Marak',
      'student@example.edu',
      '9876543210',
      '123456789012',
      'BA-ECO',
      'BATCH-2026',
      'ARTS',
      'DAY',
      '',
      '2026-27',
      '3',
      'STUDYING',
      'GENERAL',
      'CHRISTIAN',
      '',
      'John Marak',
      'Jane Marak',
      '',
      'ECO-200',
      'ECO-201',
      '',
      'MDC-210',
      'AEC-220',
      'SEC-230',
      '',
      'VTC-240',
      'ECO-200',
      '',
      'MDC-210',
      'AEC-220',
      'SEC-230',
      '',
      'VTC-240',
      'A',
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
      'TUT-A',
      'LAB-A',
      'Male',
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
        {
          code: this.templateCourseCode(line.offering.course.code),
          title: line.offering.course.title,
        },
      ]) ?? [],
    );
    const choiceByType = new Map(
      student.programChoices.map((choice) => [
        choice.choiceType,
        choice.subjectSlug,
      ]),
    );
    const codeCell = (category: string, slugFallback?: string) => {
      const entry = lineByCategory.get(category);
      if (entry?.code && entry?.title) {
        return this.formatSubjectDisplayLabel(entry.code, entry.title);
      }
      return entry?.code ?? slugFallback ?? '';
    };
    const nameCell = (category: string, slugFallback?: string) => {
      const entry = lineByCategory.get(category);
      return entry?.title ?? slugFallback ?? '';
    };
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
      codeCell('MAJOR', choiceByType.get('MAJOR')),
      codeCell('MINOR', choiceByType.get('MINOR')),
      codeCell('MDC'),
      codeCell('AEC'),
      codeCell('SEC'),
      codeCell('VAC'),
      nameCell('MAJOR', choiceByType.get('MAJOR')),
      nameCell('MINOR', choiceByType.get('MINOR')),
      nameCell('MDC'),
      nameCell('AEC'),
      nameCell('SEC'),
      nameCell('VAC'),
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

  private templateInstructionNotes(): [string, string][] {
    return [
      [
        'Subject dropdowns (MAJOR_CODE, MINOR_CODE, etc.)',
        'Use the dropdown to pick CODE - Subject Name (e.g. GAR100 - Garo Major). On import, only the code (GAR100) is saved — the name is for your reference.',
      ],
      [
        'Subject name columns (Major Subject, MDC Choice, etc.)',
        'Optional alternative: select or type the subject name only (e.g. Garo Major). The system maps names to codes automatically.',
      ],
      [
        'SUBJECT_MASTER sheet',
        'Full curriculum reference: Subject Type, Code, Subject Name, and Display Label. Use this to verify codes before import.',
      ],
      [
        'Category reference sheets',
        'MAJOR Papers, MINOR Papers, MDC Papers, etc. list active offerings for each NEP category with semester and programme applicability.',
      ],
      [
        'Invalid or discontinued subjects',
        'Import will fail with a clear error if a code or name is not in the configured curriculum, is inactive, or belongs to the wrong category.',
      ],
    ];
  }

  private helperTextForHeader(header: string) {
    const helpers: Record<string, string> = {
      MAJOR_CODE:
        'Select CODE - Subject Name from dropdown. Import stores the code only.',
      MAJOR_CODE_2:
        'Second major/core paper for Sem 3+ (e.g. ECO-201). Sem 1 uses Minor instead.',
      MINOR_CODE:
        'Select CODE - Subject Name from dropdown. Import stores the code only.',
      MDC_CODE:
        'Select CODE - Subject Name from dropdown. Import stores the code only.',
      AEC_CODE:
        'Select CODE - Subject Name from dropdown. Import stores the code only.',
      SEC_CODE:
        'Select CODE - Subject Name from dropdown. Import stores the code only.',
      VAC_CODE:
        'Select CODE - Subject Name from dropdown. Import stores the code only.',
      VTC_CODE:
        'Vocational Education & Training (Sem 3+). Select from dropdown.',
      'Major Subject':
        'Optional: enter subject name only — select from dropdown or type exact name.',
      'Minor Subject':
        'Optional: enter subject name only — select from dropdown or type exact name.',
      'MDC Choice':
        'Optional: enter MDC subject name — select from dropdown or type exact name.',
      AEC: 'Optional: enter AEC subject name — select from dropdown or type exact name.',
      SEC: 'Optional: enter SEC subject name — select from dropdown or type exact name.',
      VAC: 'Optional: enter VAC subject name — Sem 1 only; use VTC for Sem 3.',
      VTC: 'Optional: VTC paper for Sem 3+ (VTC-240 … VTC-249)',
      'Major Subject 2': 'Second major/core paper (Sem 3: SUB-201 / ECO-201)',
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

  getImportFieldRegistry() {
    return {
      sections: IMPORT_SECTION_LABELS,
      fields: STUDENT_IMPORT_FIELD_REGISTRY,
    };
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
