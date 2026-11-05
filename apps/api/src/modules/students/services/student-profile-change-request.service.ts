import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';
import {
  BANK_SECTION_VISIBLE,
  PROFILE_COMPLETION_CHECKS,
  STUDENT_EDITABLE_SECTIONS,
  STUDENT_SELF_UPLOAD_DOCUMENT_TYPES,
} from '../domain/profile-update-policy.defaults';
import { normalizeGenderCode } from '../domain/gender';
import { isTemporaryStudentLoginEmail } from '../student-credentials.util';
import { StudentProfileUpdatePolicyService } from './student-profile-update-policy.service';
import { Class12SubjectsService } from './class12-subjects.service';
import { StudentAbcService } from './student-abc.service';
import { isOthersClass12Board } from '../domain/class12-board-name';
import { isExcelImportedStudent } from '../domain/class12-subjects.util';

function serializeValue(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function comparableValue(fieldKey: string, value: unknown): string | null {
  const serialized = serializeValue(value);
  if (fieldKey !== 'dateOfBirth' || serialized == null) return serialized;
  const parsed = parseValue(serialized);
  const asDate = new Date(String(parsed));
  if (Number.isNaN(asDate.getTime())) return serialized;
  return asDate.toISOString().slice(0, 10);
}

function parseValue(raw: string | null | undefined) {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // Aadhaar, mobile, and ABC IDs are digit strings. JSON.parse would turn them
  // into numbers and can change the value the student typed.
  if (/^\d+$/.test(trimmed)) return trimmed;
  const looksStructured =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    trimmed === 'null' ||
    trimmed === 'true' ||
    trimmed === 'false';
  if (!looksStructured) return raw;
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

const PROFILE_FIELD_LABELS: Record<string, string> = {
  nationalId: 'Aadhaar number',
  bloodGroupLookupId: 'Blood group',
  fullName: 'Full name',
  mobileNumber: 'Mobile number',
  alternateMobile: 'Alternate mobile',
  email: 'Personal email',
  dateOfBirth: 'Date of birth',
  gender: 'Gender',
  abcId: 'ABC ID',
  panNumber: 'PAN',
  categoryLookupId: 'Category',
  religionLookupId: 'Religion',
  tribeLookupId: 'Tribe',
  denominationLookupId: 'Denomination',
  differentlyAbled: 'Differently abled',
  ews: 'Economically Weaker Section',
  nationalityLookupId: 'Nationality',
  maritalStatus: 'Marital status',
  whatsappNumber: 'WhatsApp number',
  emergencyContactMobile: 'Emergency mobile',
  bankDetails: 'Bank details',
  emergencyContact: 'Emergency contact',
  boardExam: 'Class XII',
  subjectMarks: 'Class XII subjects',
  current: 'Current address',
  permanent: 'Permanent address',
  FATHER: 'Father',
  MOTHER: 'Mother',
  GUARDIAN: 'Guardian',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keep existing DB value when client sends blank/undefined (never wipe with null). */
function coalesceText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function pickDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as any)[k] = v;
  }
  return out;
}

@Injectable()
export class StudentProfileChangeRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: StudentProfileUpdatePolicyService,
    private readonly notifications: UserNotificationsService,
    private readonly class12Subjects: Class12SubjectsService,
    private readonly abcService: StudentAbcService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  /** Keep the standard blood groups available even if only some lookups exist. */
  private async ensureBloodGroups(tenantId: string) {
    const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const existing = await this.prisma.masterLookup.findMany({
      where: { tenantId, lookupType: 'BLOOD_GROUP' },
      select: { id: true, label: true, code: true, isActive: true },
    });
    const standard = new Set(groups.map((label) => label.toUpperCase()));
    const inactiveIds = existing
      .filter(
        (row) =>
          !row.isActive &&
          standard.has(row.label.replace(/\s+/g, '').toUpperCase()),
      )
      .map((row) => row.id);
    if (inactiveIds.length) {
      await this.prisma.masterLookup.updateMany({
        where: { id: { in: inactiveIds } },
        data: { isActive: true },
      });
    }
    const labels = new Set(
      existing.map((row) => row.label.replace(/\s+/g, '').toUpperCase()),
    );
    const codes = new Set(existing.map((row) => row.code.toUpperCase()));
    const missing = groups.filter((label) => !labels.has(label.toUpperCase()));
    if (!missing.length) return;
    await this.prisma.masterLookup.createMany({
      data: missing.map((label) => {
        const preferred = label.replace('+', '_POS').replace('-', '_NEG');
        const code = codes.has(preferred) ? `STD_${preferred}` : preferred;
        codes.add(code);
        return {
          tenantId,
          lookupType: 'BLOOD_GROUP',
          code,
          label,
          sortOrder: groups.indexOf(label) + 1,
          isActive: true,
        };
      }),
      skipDuplicates: true,
    });
  }

  /** Apply queued personal-email and other auto-approve writes before the ERP reads the profile. */
  async syncStudentProfileWrites(tenantId: string, studentId: string) {
    await this.ensureBloodGroups(tenantId);
    await this.reconcilePendingItems(tenantId, studentId);
  }

  /** Same catch-up for the student directory, so pending personal emails show in the list. */
  async syncTenantProfileWrites(tenantId: string) {
    await this.ensureBloodGroups(tenantId);
    await this.reconcilePendingItems(tenantId);
  }

  async getCompletion(tenantId: string, studentId: string) {
    const [profile, guardians, addresses, boardExam, documents, abcAccount] =
      await Promise.all([
        this.prisma.studentProfile.findFirst({
          where: { tenantId, studentId },
        }),
        this.prisma.studentGuardian.findMany({
          where: { tenantId, studentId },
        }),
        this.prisma.studentAddress.findMany({ where: { tenantId, studentId } }),
        this.prisma.studentBoardExam.findFirst({
          where: { tenantId, studentId },
          include: { subjectMarks: true },
        }),
        this.prisma.studentDocument.findMany({
          where: { tenantId, studentId },
          select: { documentType: true, verificationStatus: true },
        }),
        this.prisma.abcAccount.findFirst({
          where: { tenantId, studentId, deletedAt: null },
          select: { abcId: true },
        }),
      ]);

    const father = guardians.find((g) => g.guardianType === 'FATHER');
    const currentAddress =
      addresses.find((a) => a.addressType === 'CURRENT') ??
      addresses.find((a) => a.addressType === 'TURA');
    const docTypes = new Set(
      documents.map((d) => d.documentType.toUpperCase()),
    );

    const missing: Array<{ key: string; label: string }> = [];
    const window = await this.policy.getUpdateWindow(tenantId);
    const bankVisible = BANK_SECTION_VISIBLE || window.bankSectionVisible;
    const activeChecks = PROFILE_COMPLETION_CHECKS.filter(
      (c) => c.key !== 'bank' || bankVisible,
    );
    const checks = activeChecks.map((check) => {
      let filled = false;
      switch (check.key) {
        case 'aadhaar':
          filled = Boolean(profile?.nationalId?.trim());
          break;
        case 'abcId':
          filled = Boolean(abcAccount?.abcId?.trim());
          break;
        case 'bloodGroup':
          filled = Boolean(profile?.bloodGroupLookupId);
          break;
        case 'mobile':
          filled = Boolean(profile?.mobileNumber?.trim());
          break;
        case 'email':
          filled = Boolean(profile?.email?.trim());
          break;
        case 'dob':
          filled = Boolean(profile?.dateOfBirth);
          break;
        case 'gender':
          filled = Boolean(profile?.gender?.trim());
          break;
        case 'fatherMobile':
          filled = Boolean(
            father?.contactNumber?.trim() || profile?.guardianMobile?.trim(),
          );
          break;
        case 'address':
          filled = Boolean(
            currentAddress?.line1?.trim() ||
            (profile?.address as any)?.line1 ||
            (profile?.address as any)?.city,
          );
          break;
        case 'bank':
          filled = Boolean(
            profile &&
            (profile as any).bankName &&
            (profile as any).accountNumber &&
            (profile as any).ifsc,
          );
          break;
        case 'classXii':
          filled = Boolean(
            boardExam?.boardName &&
            boardExam?.totalMarks != null &&
            (boardExam.subjectMarks?.length ?? 0) > 0,
          );
          break;
        case 'photo':
          filled = Boolean(profile?.photoPath) || docTypes.has('PHOTO');
          break;
        case 'categoryReservation':
          filled = Boolean(profile?.categoryLookupId);
          break;
        case 'marksheet':
          filled =
            docTypes.has('CLASS_XII_MARKSHEET') ||
            docTypes.has('MARKSHEET') ||
            Boolean(boardExam?.marksheetDocumentId);
          break;
        default:
          filled = false;
      }
      if (!filled) missing.push({ key: check.key, label: check.label });
      return { ...check, filled };
    });

    const filledCount = checks.filter((c) => c.filled).length;
    const percent =
      checks.length > 0 ? Math.round((filledCount / checks.length) * 100) : 0;

    return {
      percent,
      filledCount,
      totalCount: checks.length,
      missing,
      checks,
      canSubmit:
        missing.length === 0 || filledCount >= Math.ceil(checks.length * 0.5),
    };
  }

  async getSectionSnapshot(
    tenantId: string,
    studentId: string,
    section: string,
  ) {
    if (!STUDENT_EDITABLE_SECTIONS.includes(section as any)) {
      throw new BadRequestException(
        `Section ${section} is not student-editable`,
      );
    }
    const profile = await this.prisma.studentProfile.findFirst({
      where: { tenantId, studentId },
    });
    if (!profile) throw new NotFoundException('Student profile not found');

    if (section === 'personal' || section === 'contact') {
      const abcAccount =
        section === 'personal'
          ? await this.prisma.abcAccount.findFirst({
              where: { tenantId, studentId, deletedAt: null },
              select: { abcId: true },
            })
          : null;
      return {
        section,
        data: {
          fullName: profile.fullName,
          mobileNumber: profile.mobileNumber,
          alternateMobile: (profile as any).alternateMobile ?? null,
          email: profile.email,
          dateOfBirth: profile.dateOfBirth,
          gender: profile.gender,
          bloodGroupLookupId: profile.bloodGroupLookupId,
          nationalityLookupId: profile.nationalityLookupId,
          religionLookupId: profile.religionLookupId,
          categoryLookupId: profile.categoryLookupId,
          maritalStatus: profile.maritalStatus,
          nationalId: profile.nationalId,
          panNumber: (profile as any).panNumber ?? null,
          abcId: abcAccount?.abcId ?? null,
          whatsappNumber: profile.whatsappNumber,
          emergencyContactMobile:
            (profile as any).emergencyContactMobile ?? null,
        },
      };
    }
    if (section === 'bank') {
      return {
        section,
        data: {
          bankName: (profile as any).bankName ?? null,
          accountHolderName: (profile as any).accountHolderName ?? null,
          accountNumber: (profile as any).accountNumber ?? null,
          ifsc: (profile as any).ifsc ?? null,
          branchName: (profile as any).branchName ?? null,
        },
      };
    }
    if (section === 'emergency') {
      return {
        section,
        data: {
          emergencyContactName: (profile as any).emergencyContactName ?? null,
          emergencyContactRelation:
            (profile as any).emergencyContactRelation ?? null,
          emergencyContactMobile:
            (profile as any).emergencyContactMobile ?? null,
        },
      };
    }
    if (section === 'address') {
      const addresses = await this.prisma.studentAddress.findMany({
        where: { tenantId, studentId },
      });
      return {
        section,
        data: {
          // Import/admin historically used TURA/HOME; portal uses CURRENT/PERMANENT.
          current:
            addresses.find((a) => a.addressType === 'CURRENT') ??
            addresses.find((a) => a.addressType === 'TURA') ??
            null,
          permanent:
            addresses.find((a) => a.addressType === 'PERMANENT') ??
            addresses.find((a) => a.addressType === 'HOME') ??
            null,
        },
      };
    }
    if (section === 'guardians') {
      const guardians = await this.prisma.studentGuardian.findMany({
        where: { tenantId, studentId },
      });
      return {
        section,
        data: {
          FATHER: guardians.find((g) => g.guardianType === 'FATHER') ?? null,
          MOTHER: guardians.find((g) => g.guardianType === 'MOTHER') ?? null,
          GUARDIAN:
            guardians.find((g) => g.guardianType === 'GUARDIAN') ??
            guardians.find((g) => g.guardianType === 'LOCAL_GUARDIAN') ??
            null,
        },
      };
    }
    if (section === 'class_xii') {
      return { section, data: await this.getClassXii(tenantId, studentId) };
    }
    if (section === 'category_reservation') {
      return {
        section,
        data: {
          categoryLookupId: profile.categoryLookupId,
          religionLookupId: profile.religionLookupId,
          tribeLookupId: profile.tribeLookupId,
          denominationLookupId: profile.denominationLookupId,
          differentlyAbled: profile.differentlyAbled ?? false,
          ews: profile.ews ?? false,
        },
      };
    }
    if (section === 'documents') {
      const documents = await this.prisma.studentDocument.findMany({
        where: { tenantId, studentId },
        orderBy: { createdAt: 'desc' },
      });
      return {
        section,
        data: {
          documents,
          allowedTypes: [...STUDENT_SELF_UPLOAD_DOCUMENT_TYPES],
        },
      };
    }
    return { section, data: {} };
  }

  /**
   * Single payload for the student My Profile wizard: all editable sections,
   * completion, soft gate, change-request timeline, and lookup options.
   */
  async getProfileBootstrap(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      select: {
        id: true,
        rollNumber: true,
        enrollmentNumber: true,
        admissionNumber: true,
        masterProfile: { select: { fullName: true, photoPath: true } },
        department: { select: { name: true } },
        programVersion: {
          select: {
            program: { select: { name: true, code: true } },
          },
        },
        academicStanding: {
          select: { currentSemesterSequence: true },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    await this.ensureBloodGroups(tenantId);
    await this.reconcilePendingItems(tenantId, studentId);

    const sectionKeys = [
      'personal',
      'contact',
      'guardians',
      'address',
      'bank',
      'emergency',
      'class_xii',
      'documents',
      'category_reservation',
    ] as const;

    const [
      sectionsArr,
      completion,
      softGate,
      profileUpdate,
      changeRequests,
      lookups,
    ] = await Promise.all([
      Promise.all(
        sectionKeys.map(async (key) => ({
          key,
          ...(await this.getSectionSnapshot(tenantId, studentId, key)),
        })),
      ),
      this.getCompletion(tenantId, studentId),
      this.evaluateSoftGate(tenantId, studentId),
      this.policy.evaluateProfileUpdateAccess(tenantId, studentId),
      this.listRequests(tenantId, {
        studentId,
        take: 20,
      }).catch(() => []),
      this.prisma.masterLookup.findMany({
        where: {
          tenantId,
          lookupType: {
            in: [
              'BLOOD_GROUP',
              'RELIGION',
              'CATEGORY',
              'NATIONALITY',
              'GENDER',
              'TRIBE',
              'DENOMINATION',
            ],
          },
          isActive: true,
        },
        select: {
          id: true,
          label: true,
          code: true,
          lookupType: true,
          sortOrder: true,
        },
        orderBy: [
          { lookupType: 'asc' },
          { sortOrder: 'asc' },
          { label: 'asc' },
        ],
      }),
    ]);

    const sections: Record<string, unknown> = {};
    for (const row of sectionsArr) {
      sections[row.key] = row.data;
    }
    this.overlayPendingValues(sections, changeRequests);

    const reservation = sections.category_reservation as
      | Record<string, unknown>
      | undefined;
    const selectedLookupIds = [
      reservation?.categoryLookupId,
      reservation?.religionLookupId,
      reservation?.tribeLookupId,
      reservation?.denominationLookupId,
    ]
      .map((value) => (typeof value === 'string' ? value : ''))
      .filter((id) => UUID_RE.test(id));
    const knownLookupIds = new Set(lookups.map((row) => row.id));
    const missingLookupIds = selectedLookupIds.filter(
      (id) => !knownLookupIds.has(id),
    );
    if (missingLookupIds.length) {
      const extra = await this.prisma.masterLookup.findMany({
        where: { tenantId, id: { in: missingLookupIds } },
        select: {
          id: true,
          label: true,
          code: true,
          lookupType: true,
          sortOrder: true,
        },
      });
      lookups.push(...extra);
    }

    const lookupsByType: Record<
      string,
      Array<{ id: string; label: string; code: string | null }>
    > = {};
    for (const row of lookups) {
      const list = lookupsByType[row.lookupType] ?? [];
      list.push({ id: row.id, label: row.label, code: row.code });
      lookupsByType[row.lookupType] = list;
    }

    const latestRequest = Array.isArray(changeRequests)
      ? changeRequests[0]
      : null;

    return {
      student: {
        id: student.id,
        fullName:
          student.masterProfile?.fullName ??
          (sections.personal as any)?.fullName ??
          null,
        rollNumber: student.rollNumber,
        enrollmentNumber: student.enrollmentNumber,
        admissionNumber: student.admissionNumber,
        photoPath: student.masterProfile?.photoPath ?? null,
        department: student.department?.name ?? null,
        programme:
          student.programVersion?.program?.name ??
          student.programVersion?.program?.code ??
          null,
        semester: student.academicStanding?.currentSemesterSequence ?? null,
      },
      sections,
      completion: { ...completion, softGate },
      profileUpdate,
      visibleSections: {
        bank: Boolean(profileUpdate.bankSectionVisible || BANK_SECTION_VISIBLE),
      },
      verificationStatus: latestRequest?.status ?? 'NOT_SUBMITTED',
      changeRequests,
      lookups: {
        bloodGroup: lookupsByType.BLOOD_GROUP ?? [],
        religion: lookupsByType.RELIGION ?? [],
        category: lookupsByType.CATEGORY ?? [],
        tribe: lookupsByType.TRIBE ?? [],
        denomination: lookupsByType.DENOMINATION ?? [],
        nationality: lookupsByType.NATIONALITY ?? [],
        gender: lookupsByType.GENDER ?? [],
      },
      staticOptions: {
        genderFallback: [
          { value: 'MALE', label: 'Male' },
          { value: 'FEMALE', label: 'Female' },
          { value: 'TRANSGENDER', label: 'Transgender' },
          { value: 'OTHER', label: 'Other' },
          { value: 'PREFER_NOT_TO_SAY', label: 'Prefer Not To Say' },
        ],
        maritalStatus: [
          { value: 'SINGLE', label: 'Single' },
          { value: 'MARRIED', label: 'Married' },
          { value: 'DIVORCED', label: 'Divorced' },
          { value: 'WIDOWED', label: 'Widowed' },
        ],
        stream: [
          { value: 'ARTS', label: 'Arts' },
          { value: 'SCIENCE', label: 'Science' },
          { value: 'COMMERCE', label: 'Commerce' },
          { value: 'VOCATIONAL', label: 'Vocational' },
          { value: 'OTHERS', label: 'Others' },
        ],
        board: ['MBOSE', 'CBSE', 'ISC', 'NIOS', 'State Board', 'Others'],
        yearOfPassing: Array.from({ length: 31 }, (_, i) => {
          return new Date().getFullYear() - i;
        }),
      },
      readOnly: {
        rollNumber: student.rollNumber,
        enrollmentNumber: student.enrollmentNumber,
        admissionNumber: student.admissionNumber,
        programme:
          student.programVersion?.program?.name ??
          student.programVersion?.program?.code ??
          null,
        semester: student.academicStanding?.currentSemesterSequence ?? null,
        department: student.department?.name ?? null,
      },
    };
  }

  async getClassXii(tenantId: string, studentId: string) {
    const exam = await this.prisma.studentBoardExam.findFirst({
      where: { tenantId, studentId },
      include: { subjectMarks: { orderBy: { sortOrder: 'asc' } } },
    });
    return exam;
  }

  async upsertClassXii(
    user: JwtUser,
    studentId: string,
    input: {
      boardName?: string | null;
      boardNameOther?: string | null;
      schoolName?: string | null;
      boardRollNumber?: string | null;
      registrationNumber?: string | null;
      examYear?: number | null;
      stream?: string | null;
      totalMarks?: number | null;
      maximumMarks?: number | null;
      grade?: string | null;
      division?: string | null;
      subjects?: Array<{
        subjectName: string;
        marksObtained?: number | null;
        maxMarks?: number | null;
        grade?: string | null;
      }>;
    },
  ) {
    await this.assertStudentCanEditProfile(user.tid, studentId);

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: user.tid, deletedAt: null },
      select: { importSource: true, admissionSource: true },
    });
    const excelImported = isExcelImportedStudent(student ?? {});

    const percentage =
      input.totalMarks != null &&
      input.maximumMarks != null &&
      input.maximumMarks > 0
        ? Math.round((input.totalMarks / input.maximumMarks) * 10000) / 100
        : null;

    if (input.subjects) {
      await this.class12Subjects.assertSubjectMarksValid(
        user.tid,
        input.boardName,
        input.stream,
        input.subjects,
        {
          requireMinFive: !excelImported,
          strictMaster: !excelImported,
        },
      );
    }

    const existing = await this.prisma.studentBoardExam.findFirst({
      where: { tenantId: user.tid, studentId },
    });

    const otherBoardName = String(input.boardNameOther ?? '').trim();
    if (isOthersClass12Board(input.boardName) && !otherBoardName) {
      throw new BadRequestException('Enter the board name');
    }

    const payload = {
      boardName: input.boardName ?? undefined,
      ...(isOthersClass12Board(input.boardName)
        ? { boardNameOther: otherBoardName }
        : {}),
      schoolName: input.schoolName ?? undefined,
      boardRollNumber: input.boardRollNumber ?? undefined,
      registrationNumber: input.registrationNumber ?? undefined,
      examYear: input.examYear ?? undefined,
      stream: input.stream ?? undefined,
      totalMarks: input.totalMarks ?? undefined,
      maximumMarks: input.maximumMarks ?? undefined,
      percentage: percentage ?? undefined,
      grade: input.grade ?? undefined,
      division: input.division ?? undefined,
      verificationStatus: 'PENDING',
    };

    let examId: string;
    if (existing) {
      await this.prisma.studentBoardExam.update({
        where: { id: existing.id },
        data: payload as any,
      });
      examId = existing.id;
    } else {
      const created = await this.prisma.studentBoardExam.create({
        data: {
          tenantId: user.tid,
          studentId,
          ...(payload as any),
        },
      });
      examId = created.id;
    }

    if (input.subjects) {
      await this.prisma.studentBoardSubjectMark.deleteMany({
        where: { boardExamId: examId },
      });
      if (input.subjects.length) {
        await this.prisma.studentBoardSubjectMark.createMany({
          data: input.subjects.map((s, idx) => ({
            tenantId: user.tid,
            boardExamId: examId,
            subjectName: s.subjectName,
            marksObtained: s.marksObtained ?? null,
            maxMarks: s.maxMarks ?? null,
            grade: s.grade ?? null,
            sortOrder: idx,
          })),
        });
      }
    }

    // Queue Class XII as a change item for office verification
    await this.submitFieldChanges(user, studentId, [
      {
        sectionKey: 'class_xii',
        fieldKey: 'boardExam',
        newValue: {
          ...payload,
          subjects: input.subjects ?? [],
        },
      },
    ]);

    return this.getClassXii(user.tid, studentId);
  }

  async submitFieldChanges(
    user: JwtUser,
    studentId: string,
    changes: Array<{ sectionKey: string; fieldKey: string; newValue: unknown }>,
  ) {
    if (!changes.length) {
      throw new BadRequestException('No changes provided');
    }

    await this.assertStudentCanEditProfile(user.tid, studentId);

    const window = await this.policy.getUpdateWindow(user.tid);
    const bankVisible = BANK_SECTION_VISIBLE || window.bankSectionVisible;
    for (const change of changes) {
      if (change.sectionKey === 'bank' && !bankVisible) {
        throw new BadRequestException(
          'Bank details are not open for student update at this time.',
        );
      }
    }

    const snapshot = await this.getSectionSnapshot(
      user.tid,
      studentId,
      changes[0].sectionKey,
    ).catch(() => null);

    const request = await this.db().studentProfileChangeRequest.create({
      data: {
        tenantId: user.tid,
        studentId,
        status: 'PENDING',
        submittedAt: new Date(),
        metadata: { source: 'student_portal' },
      },
    });

    let pendingCount = 0;
    let autoCount = 0;

    for (const change of changes) {
      if (!STUDENT_EDITABLE_SECTIONS.includes(change.sectionKey as any)) {
        throw new BadRequestException(
          `Section ${change.sectionKey} cannot be updated by students`,
        );
      }
      const mode = await this.policy.getMode(
        user.tid,
        change.sectionKey,
        change.fieldKey,
      );
      if (mode === 'READ_ONLY') {
        throw new BadRequestException(
          `Field ${change.sectionKey}.${change.fieldKey} is read-only`,
        );
      }

      const previous =
        (snapshot?.data as any)?.[change.fieldKey] ??
        (snapshot?.data as any)?.data?.[change.fieldKey];
      const oldValue = serializeValue(previous);
      const newValue = serializeValue(change.newValue);
      if (
        comparableValue(change.fieldKey, previous) ===
        comparableValue(change.fieldKey, change.newValue)
      ) {
        continue;
      }
      const auto = mode === 'AUTO_APPROVE';
      // A blank Aadhaar must not erase a number already stored on the profile.
      if (
        change.fieldKey === 'nationalId' &&
        (change.newValue == null || String(change.newValue).trim() === '')
      ) {
        continue;
      }
      if (
        change.sectionKey === 'category_reservation' &&
        [
          'categoryLookupId',
          'religionLookupId',
          'tribeLookupId',
          'denominationLookupId',
        ].includes(change.fieldKey) &&
        !coalesceText(change.newValue)
      ) {
        continue;
      }

      const item = await this.db().studentProfileChangeItem.create({
        data: {
          tenantId: user.tid,
          requestId: request.id,
          sectionKey: change.sectionKey,
          fieldKey: change.fieldKey,
          oldValue,
          newValue,
          approvalStatus: 'PENDING',
          autoApproved: false,
        },
      });

      if (auto) {
        try {
          await this.applyItem(user.tid, studentId, item, user.sub);
          await this.db().studentProfileChangeItem.update({
            where: { id: item.id },
            data: {
              approvalStatus: 'AUTO_APPROVED',
              autoApproved: true,
              reviewedAt: new Date(),
              appliedAt: new Date(),
            },
          });
          autoCount += 1;
        } catch (error) {
          if (error instanceof BadRequestException) throw error;
          const message =
            error instanceof Error
              ? error.message
              : 'Could not save this field';
          await this.db().studentProfileChangeItem.update({
            where: { id: item.id },
            data: { reviewRemarks: message.slice(0, 500) },
          });
          pendingCount += 1;
        }
      } else {
        pendingCount += 1;
      }
    }

    if (pendingCount + autoCount === 0) {
      await this.db().studentProfileChangeRequest.delete({
        where: { id: request.id },
      });
      return {
        id: request.id,
        status: 'UNCHANGED',
        items: [],
        pendingCount: 0,
        autoCount: 0,
      };
    }

    const status =
      pendingCount === 0
        ? 'APPROVED'
        : autoCount > 0
          ? 'PARTIALLY_APPROVED'
          : 'PENDING';

    const updated = await this.db().studentProfileChangeRequest.update({
      where: { id: request.id },
      data: {
        status,
        reviewedAt: pendingCount === 0 ? new Date() : null,
      },
      include: { items: true },
    });

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: user.tid },
      select: { userId: true },
    });
    if (student?.userId) {
      await this.notifications
        .createInApp({
          tenantId: user.tid,
          userId: student.userId,
          type: 'STUDENT_PROFILE',
          title: 'Profile update submitted',
          body:
            pendingCount === 0
              ? 'Your profile changes were auto-approved and applied.'
              : `Your profile update is pending office verification (${pendingCount} field(s)).`,
          link: '/student/my-profile',
          metadata: { requestId: request.id },
        })
        .catch(() => undefined);
    }

    return updated;
  }

  async listRequests(
    tenantId: string,
    query: {
      status?: string;
      studentId?: string;
      sectionKey?: string;
      take?: number;
    },
  ) {
    // "PENDING" means a field still needs a decision. Mixed saves are stored as
    // PARTIALLY_APPROVED, so filtering the request status alone hides them.
    const awaitingReview = query.status === 'PENDING';
    if (awaitingReview) {
      await this.reconcilePendingItems(tenantId, query.studentId);
    }
    const rows = await this.db().studentProfileChangeRequest.findMany({
      where: {
        tenantId,
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(awaitingReview
          ? {
              items: {
                some: {
                  approvalStatus: { in: ['PENDING', 'NEEDS_INFO'] },
                  ...(query.sectionKey ? { sectionKey: query.sectionKey } : {}),
                },
              },
            }
          : {
              ...(query.status ? { status: query.status } : {}),
              ...(query.sectionKey
                ? { items: { some: { sectionKey: query.sectionKey } } }
                : {}),
            }),
      },
      include: {
        items: true,
        student: {
          select: {
            id: true,
            rollNumber: true,
            enrollmentNumber: true,
            admissionNumber: true,
            masterProfile: { select: { fullName: true, mobileNumber: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.take ?? 200,
    });
    return this.decorateRequests(tenantId, rows);
  }

  async reviewItem(
    user: JwtUser,
    itemId: string,
    action: 'APPROVE' | 'REJECT' | 'NEEDS_INFO',
    remarks?: string,
  ) {
    const item = await this.db().studentProfileChangeItem.findFirst({
      where: { id: itemId, tenantId: user.tid },
      include: { request: true },
    });
    if (!item) throw new NotFoundException('Change item not found');
    if (!['PENDING', 'NEEDS_INFO'].includes(item.approvalStatus)) {
      throw new BadRequestException('Item is already reviewed');
    }

    const approvalStatus =
      action === 'APPROVE'
        ? 'APPROVED'
        : action === 'REJECT'
          ? 'REJECTED'
          : 'NEEDS_INFO';

    const updated = await this.db().studentProfileChangeItem.update({
      where: { id: itemId },
      data: {
        approvalStatus,
        reviewedById: user.sub,
        reviewedAt: new Date(),
        reviewRemarks: remarks ?? null,
        appliedAt: action === 'APPROVE' ? new Date() : null,
      },
    });

    if (action === 'APPROVE') {
      await this.applyItem(user.tid, item.request.studentId, updated, user.sub);
    }

    await this.refreshRequestStatus(item.requestId, user.sub, remarks);

    const student = await this.prisma.student.findFirst({
      where: { id: item.request.studentId, tenantId: user.tid },
      select: { userId: true },
    });
    if (student?.userId) {
      const title =
        action === 'APPROVE'
          ? 'Profile update approved'
          : action === 'REJECT'
            ? 'Profile update rejected'
            : 'Additional information required';
      await this.notifications
        .createInApp({
          tenantId: user.tid,
          userId: student.userId,
          type: 'STUDENT_PROFILE',
          title,
          body:
            remarks ||
            `${item.sectionKey}.${item.fieldKey} was marked ${approvalStatus}.`,
          link: '/student/my-profile',
          metadata: { itemId, action },
        })
        .catch(() => undefined);
    }

    return updated;
  }

  async reviewRequest(
    user: JwtUser,
    requestId: string,
    action: 'APPROVE' | 'REJECT' | 'NEEDS_INFO',
    remarks?: string,
  ) {
    const request = await this.db().studentProfileChangeRequest.findFirst({
      where: { id: requestId, tenantId: user.tid },
      include: { items: true },
    });
    if (!request) throw new NotFoundException('Change request not found');

    for (const item of request.items) {
      if (
        item.approvalStatus === 'PENDING' ||
        item.approvalStatus === 'NEEDS_INFO'
      ) {
        await this.reviewItem(user, item.id, action, remarks);
      }
    }
    return this.db().studentProfileChangeRequest.findFirst({
      where: { id: requestId },
      include: { items: true },
    });
  }

  async bulkReviewRequests(
    user: JwtUser,
    requestIds: string[],
    action: 'APPROVE' | 'REJECT' | 'NEEDS_INFO',
    remarks?: string,
  ) {
    const results = [];
    for (const id of [...new Set(requestIds)].slice(0, 100)) {
      try {
        results.push({
          id,
          ok: true,
          request: await this.reviewRequest(user, id, action, remarks),
        });
      } catch (error) {
        results.push({
          id,
          ok: false,
          error: error instanceof Error ? error.message : 'Failed',
        });
      }
    }
    return {
      action,
      processed: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  async evaluateSoftGate(tenantId: string, studentId: string) {
    const [gates, completion] = await Promise.all([
      this.policy.getSoftGates(tenantId),
      this.getCompletion(tenantId, studentId),
    ]);
    const incomplete = completion.percent < gates.minCompletionPercent;
    const active = gates.enabled && incomplete;
    return {
      ...gates,
      completionPercent: completion.percent,
      missing: completion.missing,
      incomplete,
      active,
      blockRegistration: active && gates.softBlockRegistration,
      blockCertificates: active && gates.softBlockCertificates,
      message: active
        ? `Profile is ${completion.percent}% complete (minimum ${gates.minCompletionPercent}%). Please complete pending fields.`
        : null,
    };
  }

  async assertStudentCanEditProfile(tenantId: string, studentId: string) {
    const access = await this.policy.evaluateProfileUpdateAccess(
      tenantId,
      studentId,
    );
    if (!access.canEdit) {
      throw new ForbiddenException(
        access.message ||
          'The profile update period has ended. Please contact the College Office if you need to make any changes.',
      );
    }
    return access;
  }

  private async refreshRequestStatus(
    requestId: string,
    reviewerId?: string | null,
    remarks?: string,
  ) {
    const items = await this.db().studentProfileChangeItem.findMany({
      where: { requestId },
    });
    const pending = items.filter((i: any) =>
      ['PENDING', 'NEEDS_INFO'].includes(i.approvalStatus),
    ).length;
    const approved = items.filter((i: any) =>
      ['APPROVED', 'AUTO_APPROVED'].includes(i.approvalStatus),
    ).length;
    const rejected = items.filter(
      (i: any) => i.approvalStatus === 'REJECTED',
    ).length;

    let status = 'PENDING';
    if (pending === 0 && rejected === 0) status = 'APPROVED';
    else if (pending === 0 && approved === 0 && rejected > 0)
      status = 'REJECTED';
    else if (pending === 0) status = 'PARTIALLY_APPROVED';
    else if (items.some((i: any) => i.approvalStatus === 'NEEDS_INFO'))
      status = 'NEEDS_INFO';
    else if (approved > 0) status = 'PARTIALLY_APPROVED';

    await this.db().studentProfileChangeRequest.update({
      where: { id: requestId },
      data: {
        status,
        ...(reviewerId ? { reviewedById: reviewerId } : {}),
        reviewedAt: new Date(),
        ...(remarks ? { remarks } : {}),
      },
    });
  }

  /**
   * Write Aadhaar (and any other auto-approve field) that was left pending,
   * and drop no-op rows so the office queue only lists real decisions.
   */
  private async reconcilePendingItems(tenantId: string, studentId?: string) {
    await this.reapplyMissedProfileWrites(tenantId, studentId);
    const items = await this.db().studentProfileChangeItem.findMany({
      where: {
        tenantId,
        approvalStatus: { in: ['PENDING', 'NEEDS_INFO'] },
        ...(studentId ? { request: { studentId } } : {}),
      },
      include: { request: { select: { id: true, studentId: true } } },
      orderBy: { createdAt: 'asc' },
      take: studentId ? 100 : 300,
    });
    if (!items.length) return;

    const modeCache = new Map<string, string>();
    const touched = new Set<string>();
    for (const item of items) {
      const same = (item.oldValue ?? null) === (item.newValue ?? null);
      const cacheKey = `${item.sectionKey}::${item.fieldKey}`;
      if (!modeCache.has(cacheKey)) {
        modeCache.set(
          cacheKey,
          await this.policy.getMode(tenantId, item.sectionKey, item.fieldKey),
        );
      }
      const mode = modeCache.get(cacheKey);
      const shouldApply = mode === 'AUTO_APPROVE' && !same;
      if (!shouldApply && !same) continue;
      try {
        if (shouldApply) {
          await this.applyItem(tenantId, item.request.studentId, item, null);
        }
        await this.db().studentProfileChangeItem.update({
          where: { id: item.id },
          data: {
            approvalStatus: 'AUTO_APPROVED',
            autoApproved: true,
            reviewedAt: new Date(),
            appliedAt: new Date(),
          },
        });
        touched.add(item.requestId);
      } catch {
        // Leave the row pending so the office can still see and approve it.
      }
    }
    for (const requestId of touched) {
      await this.refreshRequestStatus(requestId);
    }
  }

  /**
   * Auto-approved Aadhaar (and blood group) sometimes stayed off the profile,
   * so the text box reloaded empty and the office queue had nothing to approve.
   * Write the value again, or put the row back to pending when the write fails.
   */
  private async reapplyMissedProfileWrites(
    tenantId: string,
    studentId?: string,
  ) {
    const items = await this.db().studentProfileChangeItem.findMany({
      where: {
        tenantId,
        sectionKey: 'personal',
        fieldKey: {
          in: ['nationalId', 'bloodGroupLookupId', 'gender', 'email'],
        },
        approvalStatus: { in: ['AUTO_APPROVED', 'APPROVED'] },
        ...(studentId ? { request: { studentId } } : {}),
      },
      include: { request: { select: { id: true, studentId: true } } },
      orderBy: { createdAt: 'desc' },
      take: studentId ? 30 : 200,
    });
    if (!items.length) return;

    const seen = new Set<string>();
    const touched = new Set<string>();
    for (const item of items) {
      const ownerId = item.request?.studentId as string | undefined;
      if (!ownerId) continue;
      const dedupe = `${ownerId}::${item.fieldKey}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);

      const parsed = parseValue(item.newValue);
      if (parsed == null || String(parsed).trim() === '') continue;

      const profile = await this.prisma.studentProfile.findFirst({
        where: { tenantId, studentId: ownerId },
        select: {
          nationalId: true,
          bloodGroupLookupId: true,
          gender: true,
          email: true,
          student: { select: { user: { select: { email: true } } } },
        },
      });
      const current =
        item.fieldKey === 'nationalId'
          ? profile?.nationalId
          : item.fieldKey === 'bloodGroupLookupId'
            ? profile?.bloodGroupLookupId
            : item.fieldKey === 'email'
              ? profile?.email
              : profile?.gender;
      if (item.fieldKey === 'email') {
        const next = String(parsed).trim().toLowerCase();
        const stored = String(current ?? '')
          .trim()
          .toLowerCase();
        const previous = String(parseValue(item.oldValue) ?? '')
          .trim()
          .toLowerCase();
        const login = String(profile?.student?.user?.email ?? '')
          .trim()
          .toLowerCase();
        if (!next || stored === next) continue;
        const stillPrevious =
          !stored ||
          stored === previous ||
          (login && stored === login) ||
          isTemporaryStudentLoginEmail(stored);
        if (!stillPrevious) continue;
      } else if (current && String(current).trim()) {
        continue;
      }

      try {
        await this.applyItem(tenantId, ownerId, item, null);
        const saved = await this.prisma.studentProfile.findFirst({
          where: { tenantId, studentId: ownerId },
          select: {
            nationalId: true,
            bloodGroupLookupId: true,
            gender: true,
            email: true,
          },
        });
        const after =
          item.fieldKey === 'nationalId'
            ? saved?.nationalId
            : item.fieldKey === 'bloodGroupLookupId'
              ? saved?.bloodGroupLookupId
              : item.fieldKey === 'email'
                ? saved?.email
                : saved?.gender;
        if (after && String(after).trim()) continue;
        throw new Error('Profile field was not saved');
      } catch {
        await this.db().studentProfileChangeItem.update({
          where: { id: item.id },
          data: {
            approvalStatus: 'PENDING',
            autoApproved: false,
            appliedAt: null,
            reviewRemarks:
              'Saved status did not update the profile. Approve it again from Pending Profile Updates.',
          },
        });
        touched.add(item.requestId);
      }
    }
    for (const requestId of touched) {
      await this.refreshRequestStatus(requestId);
    }
  }

  private overlayPendingValues(
    sections: Record<string, unknown>,
    changeRequests: unknown,
  ) {
    const requests = Array.isArray(changeRequests) ? [...changeRequests] : [];
    requests.reverse();
    for (const req of requests) {
      for (const item of (req as any).items ?? []) {
        if (!['PENDING', 'NEEDS_INFO'].includes(item.approvalStatus)) continue;
        const section = sections[item.sectionKey];
        if (!section || typeof section !== 'object' || Array.isArray(section)) {
          continue;
        }
        const value = parseValue(item.newValue);
        if (value == null || value === '') continue;
        (section as Record<string, unknown>)[item.fieldKey] = value;
      }
    }
  }

  private async decorateRequests(tenantId: string, rows: any[]) {
    const lookupIds = new Set<string>();
    for (const row of rows) {
      for (const item of row.items ?? []) {
        const value = parseValue(item.newValue);
        if (typeof value === 'string' && UUID_RE.test(value)) {
          lookupIds.add(value);
        }
      }
    }
    const lookups = lookupIds.size
      ? await this.prisma.masterLookup.findMany({
          where: { tenantId, id: { in: [...lookupIds] } },
          select: { id: true, label: true },
        })
      : [];
    const labels = new Map(lookups.map((row) => [row.id, row.label]));
    return rows.map((row) => ({
      ...row,
      items: (row.items ?? []).map((item: any) => {
        const parsed = parseValue(item.newValue);
        const asText =
          parsed == null
            ? ''
            : typeof parsed === 'object'
              ? JSON.stringify(parsed)
              : String(parsed);
        const displayValue =
          (typeof parsed === 'string' && labels.get(parsed)) || asText || '—';
        return {
          ...item,
          fieldLabel: PROFILE_FIELD_LABELS[item.fieldKey] ?? item.fieldKey,
          displayValue,
        };
      }),
    }));
  }

  private async applyItem(
    tenantId: string,
    studentId: string,
    item: any,
    actorId: string | null,
  ) {
    const value = parseValue(item.newValue);
    const section = item.sectionKey;
    const field = item.fieldKey;

    if (section === 'personal' || section === 'contact') {
      if (section === 'personal' && field === 'abcId') {
        await this.abcService.upsertForStudent(
          tenantId,
          studentId,
          coalesceText(value) ?? null,
        );
      } else {
        const data: Record<string, unknown> = {};
        if (
          [
            'fullName',
            'mobileNumber',
            'alternateMobile',
            'email',
            'gender',
            'maritalStatus',
            'nationalId',
            'panNumber',
            'whatsappNumber',
            'bloodGroupLookupId',
            'nationalityLookupId',
            'religionLookupId',
            'categoryLookupId',
            'emergencyContactMobile',
          ].includes(field)
        ) {
          let next = coalesceText(value);
          if (field === 'gender' && next) {
            next = normalizeGenderCode(next) || next.toUpperCase();
          }
          if (field === 'nationalId' && next) {
            next = next.replace(/\D/g, '');
            if (!/^\d{12}$/.test(next)) {
              throw new BadRequestException(
                'Aadhaar must be exactly 12 digits',
              );
            }
          }
          if (field === 'email' && next) {
            next = next.toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
              throw new BadRequestException('Enter a valid email address');
            }
          }
          // A blank submission must not erase a value already on the profile.
          if (next) data[field] = next;
        }
        if (field === 'dateOfBirth' && value) {
          const raw = String(value).slice(0, 10);
          const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
          const year = Number(match?.[1]);
          const month = Number(match?.[2]);
          const day = Number(match?.[3]);
          const parsed = new Date(year, month - 1, day);
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          const realCalendarDate =
            Boolean(match) &&
            parsed.getFullYear() === year &&
            parsed.getMonth() === month - 1 &&
            parsed.getDate() === day;
          if (
            !realCalendarDate ||
            year < 1900 ||
            Number.isNaN(parsed.getTime()) ||
            parsed > today
          ) {
            throw new BadRequestException('Enter a valid date of birth');
          }
          data.dateOfBirth = parsed;
        }
        if (Object.keys(data).length) {
          await this.prisma.studentProfile.update({
            where: { studentId },
            data: data as any,
          });
          if (
            field === 'email' &&
            typeof data.email === 'string' &&
            data.email
          ) {
            await this.softSyncLoginEmail(tenantId, studentId, data.email);
          }
        }
      }
    } else if (
      section === 'bank' &&
      field === 'bankDetails' &&
      value &&
      typeof value === 'object'
    ) {
      const v = value as Record<string, unknown>;
      await this.prisma.studentProfile.update({
        where: { studentId },
        data: pickDefined({
          bankName: coalesceText(v.bankName),
          accountHolderName: coalesceText(v.accountHolderName),
          accountNumber: coalesceText(v.accountNumber),
          ifsc: coalesceText(v.ifsc),
          branchName: coalesceText(v.branchName),
        }) as any,
      });
    } else if (
      section === 'emergency' &&
      field === 'emergencyContact' &&
      value &&
      typeof value === 'object'
    ) {
      const v = value as Record<string, unknown>;
      await this.prisma.studentProfile.update({
        where: { studentId },
        data: pickDefined({
          emergencyContactName: coalesceText(v.emergencyContactName),
          emergencyContactRelation: coalesceText(v.emergencyContactRelation),
          emergencyContactMobile: coalesceText(v.emergencyContactMobile),
        }) as any,
      });
    } else if (section === 'address' && value && typeof value === 'object') {
      // Mobile saves current/permanent. The ERP profile screen reads TURA/HOME.
      const addressTypes =
        field === 'permanent' ? ['PERMANENT', 'HOME'] : ['CURRENT', 'TURA'];
      const next = {
        line1: coalesceText((value as any).line1),
        line2: coalesceText((value as any).line2),
        city: coalesceText((value as any).city),
        state: coalesceText((value as any).state),
        district: coalesceText((value as any).district),
        pinCode: coalesceText((value as any).pinCode),
      };
      for (const addressType of addressTypes) {
        await this.prisma.studentAddress.upsert({
          where: { studentId_addressType: { studentId, addressType } },
          create: {
            tenantId,
            studentId,
            addressType,
            ...next,
          },
          update: next,
        });
      }
    } else if (section === 'guardians' && value && typeof value === 'object') {
      const guardianTypes =
        field === 'GUARDIAN' ? ['GUARDIAN', 'LOCAL_GUARDIAN'] : [field];
      const guardianData = {
        fullName: (value as any).fullName ?? null,
        occupation: (value as any).occupation ?? null,
        contactNumber: (value as any).contactNumber ?? null,
        email: (value as any).email ?? null,
      };
      for (const guardianType of guardianTypes) {
        await this.prisma.studentGuardian.upsert({
          where: {
            studentId_guardianType: { studentId, guardianType },
          },
          create: {
            tenantId,
            studentId,
            guardianType,
            ...guardianData,
          },
          update: guardianData,
        });
      }
    } else if (section === 'category_reservation') {
      const lookupTypes: Record<string, string> = {
        categoryLookupId: 'CATEGORY',
        religionLookupId: 'RELIGION',
        tribeLookupId: 'TRIBE',
        denominationLookupId: 'DENOMINATION',
      };
      const data: Record<string, unknown> = {};
      if (lookupTypes[field]) {
        const next = coalesceText(value);
        if (next) {
          if (!UUID_RE.test(next)) {
            throw new BadRequestException('Select a valid option');
          }
          const lookup = await this.prisma.masterLookup.findFirst({
            where: {
              id: next,
              tenantId,
              lookupType: lookupTypes[field],
            },
            select: { id: true },
          });
          if (!lookup) {
            throw new BadRequestException(
              'Select an option from the college list',
            );
          }
          data[field] = lookup.id;
        }
      }
      if (field === 'differentlyAbled' || field === 'ews') {
        if (
          value === true ||
          value === false ||
          value === 'true' ||
          value === 'false'
        ) {
          data[field] = value === true || value === 'true';
        }
      }
      if (Object.keys(data).length) {
        await this.prisma.studentProfile.update({
          where: { studentId },
          data: data as any,
        });
      }
    } else if (section === 'class_xii' && field === 'boardExam') {
      await this.prisma.studentBoardExam.updateMany({
        where: { tenantId, studentId },
        data: { verificationStatus: 'VERIFIED' } as any,
      });
    }

    await this.prisma.studentProfileAuditLog.create({
      data: {
        tenantId,
        studentId,
        sectionKey: section,
        fieldKey: field,
        oldValue: item.oldValue,
        newValue: item.newValue,
        actorId,
      },
    });
  }

  async completionDashboard(tenantId: string) {
    const students = await this.prisma.student.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        departmentId: true,
        department: { select: { name: true } },
        masterProfile: { select: { fullName: true } },
        rollNumber: true,
      },
      take: 2000,
    });

    const rows = [];
    for (const student of students) {
      const completion = await this.getCompletion(tenantId, student.id);
      rows.push({
        studentId: student.id,
        fullName: student.masterProfile?.fullName ?? '—',
        rollNumber: student.rollNumber,
        department: student.department?.name ?? '—',
        percent: completion.percent,
        missingCount: completion.missing.length,
        missing: completion.missing.map((m) => m.label),
      });
    }

    const byDepartment = new Map<string, { count: number; sum: number }>();
    for (const row of rows) {
      const bucket = byDepartment.get(row.department) ?? { count: 0, sum: 0 };
      bucket.count += 1;
      bucket.sum += row.percent;
      byDepartment.set(row.department, bucket);
    }

    return {
      students: rows.sort((a, b) => a.percent - b.percent),
      departmentSummary: Array.from(byDepartment.entries()).map(
        ([department, v]) => ({
          department,
          students: v.count,
          averagePercent: Math.round((v.sum / v.count) * 100) / 100,
        }),
      ),
      overallAverage:
        rows.length > 0
          ? Math.round(
              (rows.reduce((s, r) => s + r.percent, 0) / rows.length) * 100,
            ) / 100
          : 0,
      incompleteCount: rows.filter((r) => r.percent < 100).length,
    };
  }

  async buildReport(
    tenantId: string,
    type: string,
  ): Promise<{
    title: string;
    rows: Array<Record<string, unknown>>;
  }> {
    const dash = await this.completionDashboard(tenantId);
    if (type === 'incomplete') {
      return {
        title: 'Incomplete Profiles',
        rows: dash.students.filter((r) => r.percent < 100),
      };
    }
    if (type === 'missing-aadhaar') {
      return {
        title: 'Students Missing Aadhaar',
        rows: dash.students.filter((r) => r.missing.includes('Aadhaar Number')),
      };
    }
    if (type === 'missing-bank') {
      return {
        title: 'Students Missing Bank Details',
        rows: dash.students.filter((r) => r.missing.includes('Bank Details')),
      };
    }
    if (type === 'missing-parents') {
      return {
        title: 'Students Missing Parent Information',
        rows: dash.students.filter((r) =>
          r.missing.includes('Parent Mobile Number'),
        ),
      };
    }
    if (type === 'missing-photo') {
      return {
        title: 'Students Missing Passport Photo',
        rows: dash.students.filter((r) => r.missing.includes('Passport Photo')),
      };
    }
    if (type === 'missing-class-xii') {
      return {
        title: 'Students Missing Class XII Marks',
        rows: dash.students.filter((r) =>
          r.missing.includes('Class XII Marks'),
        ),
      };
    }
    if (type === 'pending-verification') {
      const pending = await this.listRequests(tenantId, { status: 'PENDING' });
      return {
        title: 'Students Pending Verification',
        rows: pending.map((r: any) => ({
          requestId: r.id,
          studentId: r.studentId,
          fullName: r.student?.masterProfile?.fullName,
          rollNumber: r.student?.rollNumber,
          status: r.status,
          submittedAt: r.submittedAt,
          itemCount: r.items?.length ?? 0,
        })),
      };
    }
    if (type === 'pending-documents') {
      const docs = await this.prisma.studentDocument.findMany({
        where: { tenantId, verificationStatus: 'PENDING' },
        include: {
          student: {
            select: {
              rollNumber: true,
              masterProfile: { select: { fullName: true } },
            },
          },
        },
        take: 500,
        orderBy: { createdAt: 'desc' },
      });
      return {
        title: 'Documents Pending Approval',
        rows: docs.map((d) => ({
          id: d.id,
          documentType: d.documentType,
          fullName: d.student?.masterProfile?.fullName,
          rollNumber: d.student?.rollNumber,
          createdAt: d.createdAt,
        })),
      };
    }
    if (type === 'department-completion') {
      return {
        title: 'Department-wise Profile Completion',
        rows: dash.departmentSummary,
      };
    }
    return { title: 'Profile Completion', rows: dash.students };
  }

  /**
   * Promote personal email to login when the college login was temporary
   * (@students.local / @student.*). Never fails the profile write.
   * Skips when the address is already used by another account.
   */
  private async softSyncLoginEmail(
    tenantId: string,
    studentId: string,
    contactEmail: string,
  ) {
    const normalized = contactEmail.trim().toLowerCase();
    if (!normalized || isTemporaryStudentLoginEmail(normalized)) return;

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      select: {
        userId: true,
        user: { select: { id: true, email: true } },
      },
    });
    if (!student?.user) return;

    const currentLogin = student.user.email.trim().toLowerCase();
    if (currentLogin === normalized) return;
    // Personal email stays on the student profile. Only a temporary login
    // (students.local / student.*) may be replaced.
    if (!isTemporaryStudentLoginEmail(currentLogin)) return;

    const taken = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email: { equals: normalized, mode: 'insensitive' },
        deletedAt: null,
        NOT: { id: student.userId },
      },
      select: { id: true },
    });
    if (taken) return;

    try {
      await this.prisma.user.update({
        where: { id: student.userId },
        data: { email: normalized },
      });
    } catch {
      // Unique race or other constraint — leave login as-is.
    }
  }
}
