/**
 * Migrate genuine Batch 2024 students from an offline SOURCE database to LIVE TARGET.
 *
 * - Default = dry-run (preview + report only; no writes)
 * - Apply only with CONFIRM=YES (or --confirm)
 * - Never updates/deletes existing live students (skip duplicates)
 * - Excludes demo/test markers
 * - Remaps master FKs by business codes (program, shift, batch, subjects, offerings)
 *
 * Env:
 *   SOURCE_DATABASE_URL   offline Postgres
 *   TARGET_DATABASE_URL   live Postgres (falls back to DATABASE_URL)
 *   TENANT_SLUG           default: demo
 *   BATCH_CODE            default: BATCH-2024
 *   ROLL_REGEX            default: ^(BA|BSC|BCOM|BSW|BCA|BAM)24-
 *
 * Usage (from apps/api):
 *   npx tsx scripts/migrate-batch-2024-offline-to-live.ts
 *   CONFIRM=YES npx tsx scripts/migrate-batch-2024-offline-to-live.ts
 *
 * PowerShell:
 *   $env:SOURCE_DATABASE_URL='postgresql://...'
 *   $env:TARGET_DATABASE_URL='postgresql://...'
 *   $env:TENANT_SLUG='demo'
 *   npx tsx scripts/migrate-batch-2024-offline-to-live.ts
 *   $env:CONFIRM='YES'; npx tsx scripts/migrate-batch-2024-offline-to-live.ts
 */
import { createHash, randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as bcrypt from 'bcrypt';
import { Prisma, PrismaClient } from '@prisma/client';

const SOURCE_URL = process.env.SOURCE_DATABASE_URL?.trim();
const TARGET_URL =
  process.env.TARGET_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
const TENANT_SLUG = (
  process.env.TENANT_SLUG?.trim() ||
  readArg('tenant') ||
  'demo'
).toLowerCase();
const BATCH_CODE = process.env.BATCH_CODE?.trim() || 'BATCH-2024';
const ROLL_REGEX = new RegExp(
  process.env.ROLL_REGEX?.trim() || '^(BA|BSC|BCOM|BSW|BCA|BAM)24-',
  'i',
);
const confirmed =
  process.env.CONFIRM === 'YES' || process.argv.includes('--confirm');
const apply = confirmed && !process.argv.includes('--dry-run');

type RowOutcome =
  | 'MIGRATE'
  | 'SKIP_DEMO'
  | 'SKIP_DUPLICATE'
  | 'INVALID'
  | 'FAILED'
  | 'MIGRATED';

type StudentReportRow = {
  sourceStudentId: string;
  enrollmentNumber: string;
  rollNumber: string | null;
  fullName: string | null;
  outcome: RowOutcome;
  reason?: string;
  warnings?: string[];
  targetStudentId?: string;
};

type MigrationReport = {
  startedAt: string;
  endedAt?: string;
  mode: 'dry-run' | 'apply';
  tenantSlug: string;
  batchCode: string;
  rollRegex: string;
  totals: {
    found: number;
    eligible: number;
    migrate: number;
    skippedDemo: number;
    skippedDuplicate: number;
    invalid: number;
    failed: number;
    migrated: number;
  };
  students: StudentReportRow[];
  unmappedMasters: string[];
};

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function isDemoEmail(email: string | null | undefined): boolean {
  return Boolean(email?.trim().toLowerCase().endsWith('@demo.edu'));
}

function isSyntheticEmail(email: string | null | undefined): boolean {
  const e = email?.trim().toLowerCase() ?? '';
  return e.endsWith('@students.local') || e.includes('@student.');
}

function isDemoStudent(s: {
  enrollmentNumber: string;
  rollNumber: string | null;
  importSource: string | null;
  fullName: string | null;
  userEmail: string | null;
}): boolean {
  if (s.importSource === 'DEMO_SEED') return true;
  if (s.enrollmentNumber.toUpperCase().startsWith('DEMO-')) return true;
  if ((s.rollNumber ?? '').toUpperCase().startsWith('DEMO')) return true;
  if (s.fullName && /^Demo Student/i.test(s.fullName)) return true;
  if (isDemoEmail(s.userEmail)) return true;
  return false;
}

function portalEmail(opts: {
  email?: string | null;
  rollNumber?: string | null;
  enrollmentNumber: string;
}): string {
  const email = opts.email?.trim().toLowerCase();
  if (email && email.includes('@') && !isDemoEmail(email)) return email;
  const id = (
    opts.rollNumber?.trim() ||
    opts.enrollmentNumber.trim() ||
    'student'
  )
    .toLowerCase()
    .replace(/[^a-z0-9._+-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return `${id || 'student'}@students.local`;
}

function defaultPassword(roll: string | null, enrollment: string): string {
  return (roll?.trim() || enrollment.trim() || 'Student@123').slice(0, 72);
}

async function resolveTenant(db: PrismaClient, slug: string) {
  const bySlug = await db.tenant.findFirst({
    where: { slug, deletedAt: null },
  });
  if (bySlug) return bySlug;
  const byName = await db.tenant.findFirst({
    where: {
      name: { contains: 'Don Bosco', mode: 'insensitive' },
      deletedAt: null,
    },
  });
  if (byName) return byName;
  return db.tenant.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
}

type TargetMaps = {
  studentRoleId: string;
  shiftsByCode: Map<string, { id: string; campusId: string }>;
  departmentsByCode: Map<string, string>;
  streamsByCode: Map<string, string>;
  batchesByCode: Map<string, string>;
  programVersionsByKey: Map<string, string>; // programCode|version
  subjectsBySlug: Map<string, string>;
  semestersByNumber: Map<number, string>;
  offeringsByKey: Map<string, string>; // courseCode|semSeq|category|programCode
  sectionsByKey: Map<string, string>; // offeringId|shiftCode|sectionCode
};

function offeringKey(
  courseCode: string,
  semesterSequence: number | null | undefined,
  category: string | null | undefined,
  programCode: string | null | undefined,
) {
  return [
    courseCode.trim().toUpperCase(),
    String(semesterSequence ?? ''),
    (category ?? '').trim().toUpperCase(),
    (programCode ?? '').trim().toUpperCase(),
  ].join('|');
}

async function loadTargetMaps(
  target: PrismaClient,
  tenantId: string,
): Promise<TargetMaps> {
  const role = await target.role.findFirst({
    where: { tenantId, slug: 'student', deletedAt: null },
  });
  if (!role) {
    throw new Error(`Target tenant missing role slug "student"`);
  }

  const shifts = await target.shift.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, code: true, campusId: true },
  });
  const departments = await target.department.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, code: true },
  });
  const streams = await target.academicStream.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, code: true },
  });
  const batches = await target.admissionBatch.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, batchCode: true },
  });
  const programVersions = await target.programVersion.findMany({
    where: { tenantId, deletedAt: null },
    select: {
      id: true,
      version: true,
      program: { select: { code: true } },
    },
  });
  const subjects = await target.academicSubject.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, slug: true },
  });
  const semesters = await target.semester.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, semesterNumber: true },
  });
  const offerings = await target.courseOffering.findMany({
    where: { tenantId, deletedAt: null },
    select: {
      id: true,
      category: true,
      semesterSequence: true,
      course: { select: { code: true } },
      programVersion: { select: { program: { select: { code: true } } } },
    },
  });
  const sections = await target.offeringSection.findMany({
    where: { tenantId, deletedAt: null },
    select: {
      id: true,
      sectionCode: true,
      courseOfferingId: true,
      shift: { select: { code: true } },
    },
  });

  const shiftsByCode = new Map(
    shifts.map((s) => [
      s.code.toUpperCase(),
      { id: s.id, campusId: s.campusId },
    ]),
  );
  const departmentsByCode = new Map(
    departments.map((d) => [d.code.toUpperCase(), d.id]),
  );
  const streamsByCode = new Map(
    streams.map((s) => [s.code.toUpperCase(), s.id]),
  );
  const batchesByCode = new Map(
    batches.map((b) => [b.batchCode.toUpperCase(), b.id]),
  );
  const programVersionsByKey = new Map(
    programVersions.map((pv) => [
      `${pv.program.code.toUpperCase()}|${pv.version}`,
      pv.id,
    ]),
  );
  const maxByProgram = new Map<string, { version: number; id: string }>();
  for (const pv of programVersions) {
    const code = pv.program.code.toUpperCase();
    const cur = maxByProgram.get(code);
    if (!cur || pv.version > cur.version) {
      maxByProgram.set(code, { version: pv.version, id: pv.id });
    }
  }
  for (const [code, v] of Array.from(maxByProgram.entries())) {
    programVersionsByKey.set(`${code}|*`, v.id);
  }

  const subjectsBySlug = new Map(
    subjects.map((s) => [s.slug.toLowerCase(), s.id]),
  );
  const semestersByNumber = new Map(
    semesters.map((s) => [s.semesterNumber, s.id]),
  );
  const offeringsByKey = new Map<string, string>();
  for (const o of offerings) {
    const key = offeringKey(
      o.course.code,
      o.semesterSequence,
      o.category,
      o.programVersion?.program?.code,
    );
    if (!offeringsByKey.has(key)) offeringsByKey.set(key, o.id);
    // loose without program
    const loose = offeringKey(
      o.course.code,
      o.semesterSequence,
      o.category,
      '',
    );
    if (!offeringsByKey.has(loose)) offeringsByKey.set(loose, o.id);
  }
  const sectionsByKey = new Map<string, string>();
  for (const sec of sections) {
    const key = [
      sec.courseOfferingId,
      sec.shift.code.toUpperCase(),
      sec.sectionCode.toUpperCase(),
    ].join('|');
    sectionsByKey.set(key, sec.id);
  }

  return {
    studentRoleId: role.id,
    shiftsByCode,
    departmentsByCode,
    streamsByCode,
    batchesByCode,
    programVersionsByKey,
    subjectsBySlug,
    semestersByNumber,
    offeringsByKey,
    sectionsByKey,
  };
}

const sourceInclude = {
  user: { select: { email: true, phone: true, displayName: true } },
  masterProfile: true,
  academicProfile: {
    include: {
      stream: { select: { code: true } },
      preferredShift: { select: { code: true } },
      admissionBatch: { select: { batchCode: true } },
    },
  },
  academicStanding: true,
  programChoices: { where: { deletedAt: null } },
  guardians: true,
  addresses: true,
  majorMinorTrack: {
    include: {
      majorSubject: { select: { slug: true } },
      minorSubject: { select: { slug: true } },
    },
  },
  vtcTrack: true,
  academicTracks: true,
  programVersion: {
    select: { version: true, program: { select: { code: true } } },
  },
  department: { select: { code: true } },
  primaryShift: { select: { code: true } },
  semesterRegistrations: {
    include: {
      semester: { select: { semesterNumber: true } },
      shift: { select: { code: true } },
      lines: {
        include: {
          offering: {
            select: {
              category: true,
              semesterSequence: true,
              course: { select: { code: true } },
              programVersion: {
                select: { program: { select: { code: true } } },
              },
            },
          },
          offeringSection: {
            select: {
              sectionCode: true,
              shift: { select: { code: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.StudentInclude;

type SourceStudent = Prisma.StudentGetPayload<{
  include: typeof sourceInclude;
}>;

function resolveProgramVersionId(
  maps: TargetMaps,
  programCode: string | null | undefined,
  version: number | null | undefined,
): string | null {
  if (!programCode) return null;
  const code = programCode.toUpperCase();
  if (version != null) {
    const hit = maps.programVersionsByKey.get(`${code}|${version}`);
    if (hit) return hit;
  }
  return maps.programVersionsByKey.get(`${code}|*`) ?? null;
}

function resolveOfferingId(
  maps: TargetMaps,
  line: SourceStudent['semesterRegistrations'][number]['lines'][number],
): string | null {
  const courseCode = line.offering?.course?.code;
  if (!courseCode) return null;
  const programCode = line.offering.programVersion?.program?.code ?? null;
  const key = offeringKey(
    courseCode,
    line.offering.semesterSequence,
    line.offering.category,
    programCode,
  );
  const hit = maps.offeringsByKey.get(key);
  if (hit) return hit;
  return (
    maps.offeringsByKey.get(
      offeringKey(
        courseCode,
        line.offering.semesterSequence,
        line.offering.category,
        '',
      ),
    ) ?? null
  );
}

async function migrateOne(
  target: PrismaClient,
  maps: TargetMaps,
  tenantId: string,
  src: SourceStudent,
  dryRun: boolean,
): Promise<StudentReportRow> {
  const fullName = src.masterProfile?.fullName ?? null;
  const base: StudentReportRow = {
    sourceStudentId: src.id,
    enrollmentNumber: src.enrollmentNumber,
    rollNumber: src.rollNumber,
    fullName,
    outcome: 'MIGRATE',
    warnings: [],
  };

  if (
    isDemoStudent({
      enrollmentNumber: src.enrollmentNumber,
      rollNumber: src.rollNumber,
      importSource: src.importSource,
      fullName,
      userEmail: src.user?.email ?? null,
    })
  ) {
    return { ...base, outcome: 'SKIP_DEMO', reason: 'Demo/test markers' };
  }

  if (
    !src.academicProfile?.admissionBatch ||
    src.academicProfile.admissionBatch.batchCode.toUpperCase() !==
      BATCH_CODE.toUpperCase()
  ) {
    return {
      ...base,
      outcome: 'INVALID',
      reason: `Not linked to admission batch ${BATCH_CODE}`,
    };
  }
  if (!src.rollNumber || !ROLL_REGEX.test(src.rollNumber)) {
    return {
      ...base,
      outcome: 'INVALID',
      reason: `Roll number does not match ${ROLL_REGEX}`,
    };
  }
  if (!src.masterProfile?.fullName?.trim()) {
    return { ...base, outcome: 'INVALID', reason: 'Missing full name' };
  }

  const dup = await target.student.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      OR: [
        { enrollmentNumber: src.enrollmentNumber },
        ...(src.rollNumber ? [{ rollNumber: src.rollNumber }] : []),
      ],
    },
    select: { id: true, enrollmentNumber: true, rollNumber: true },
  });
  if (dup) {
    return {
      ...base,
      outcome: 'SKIP_DUPLICATE',
      reason: `Exists on live as ${dup.enrollmentNumber} / ${dup.rollNumber ?? '—'}`,
    };
  }

  const email = portalEmail({
    email: src.masterProfile.email ?? src.user?.email,
    rollNumber: src.rollNumber,
    enrollmentNumber: src.enrollmentNumber,
  });
  if (!isSyntheticEmail(email)) {
    const emailUser = await target.user.findFirst({
      where: { tenantId, email, deletedAt: null },
      select: { id: true, email: true },
    });
    if (emailUser) {
      return {
        ...base,
        outcome: 'SKIP_DUPLICATE',
        reason: `Portal email already used: ${email}`,
      };
    }
  }

  const programCode = src.programVersion?.program?.code ?? null;
  const programVersionId = resolveProgramVersionId(
    maps,
    programCode,
    src.programVersion?.version ?? null,
  );
  if (src.programVersionId && !programVersionId) {
    return {
      ...base,
      outcome: 'INVALID',
      reason: `Program version not found on live for ${programCode} v${src.programVersion?.version}`,
    };
  }

  const shiftCode = src.primaryShift?.code ?? null;
  const shift = shiftCode
    ? maps.shiftsByCode.get(shiftCode.toUpperCase())
    : undefined;
  if (src.primaryShiftId && !shift) {
    return {
      ...base,
      outcome: 'INVALID',
      reason: `Shift code not found on live: ${shiftCode}`,
    };
  }

  const batchId = maps.batchesByCode.get(BATCH_CODE.toUpperCase());
  if (!batchId) {
    return {
      ...base,
      outcome: 'INVALID',
      reason: `Admission batch ${BATCH_CODE} missing on live`,
    };
  }

  const departmentId = src.department?.code
    ? (maps.departmentsByCode.get(src.department.code.toUpperCase()) ?? null)
    : null;
  if (src.departmentId && !departmentId) {
    base.warnings?.push(
      `Department ${src.department?.code} not found on live; leaving null`,
    );
  }

  const streamId = src.academicProfile.stream?.code
    ? (maps.streamsByCode.get(src.academicProfile.stream.code.toUpperCase()) ??
      null)
    : null;

  if (dryRun) {
    // Probe registration remaps for report only
    let unmappedLines = 0;
    for (const reg of src.semesterRegistrations) {
      for (const line of reg.lines) {
        if (!resolveOfferingId(maps, line)) unmappedLines += 1;
      }
    }
    if (unmappedLines) {
      base.warnings?.push(`${unmappedLines} registration line(s) unmapped`);
    }
    return { ...base, outcome: 'MIGRATE', reason: 'Would create on live' };
  }

  try {
    const passwordHash = await bcrypt.hash(
      defaultPassword(src.rollNumber, src.enrollmentNumber),
      12,
    );
    const username = (src.rollNumber || src.enrollmentNumber).trim();

    const newStudentId = await target.$transaction(async (tx) => {
      let user = await tx.user.findFirst({
        where: { tenantId, email },
      });
      if (user) {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            isActive: true,
            deletedAt: null,
            mustResetPassword: true,
            username,
            displayName: src.masterProfile!.fullName,
            phone: src.user?.phone ?? src.masterProfile?.mobileNumber ?? null,
            accountStatus: 'active',
          },
        });
      } else {
        user = await tx.user.create({
          data: {
            id: randomUUID(),
            tenantId,
            email,
            username,
            passwordHash,
            displayName: src.masterProfile!.fullName,
            phone: src.user?.phone ?? src.masterProfile?.mobileNumber ?? null,
            emailVerifiedAt: new Date(),
            isActive: true,
            mustResetPassword: true,
            accountStatus: 'active',
          },
        });
      }

      const hasRole = await tx.userRole.findFirst({
        where: {
          userId: user.id,
          roleId: maps.studentRoleId,
          deletedAt: null,
        },
      });
      if (!hasRole) {
        await tx.userRole.create({
          data: { userId: user.id, roleId: maps.studentRoleId },
        });
      }

      // Avoid RFID unique collisions
      let rfidNumber = src.rfidNumber;
      if (rfidNumber) {
        const rfidHit = await tx.student.findFirst({
          where: { tenantId, rfidNumber },
          select: { id: true },
        });
        if (rfidHit) rfidNumber = null;
      }

      const student = await tx.student.create({
        data: {
          id: randomUUID(),
          tenantId,
          userId: user.id,
          enrollmentNumber: src.enrollmentNumber,
          rollNumber: src.rollNumber,
          applicationNumber: src.applicationNumber,
          admissionNumber: src.admissionNumber,
          formNumber: src.formNumber,
          universityRollNumber: src.universityRollNumber,
          universityRegistrationNumber: src.universityRegistrationNumber,
          libraryCardNumber: src.libraryCardNumber,
          rfidNumber,
          programVersionId,
          primaryShiftId: shift?.id ?? null,
          campusId: shift?.campusId ?? null,
          departmentId: departmentId,
          admissionDate: src.admissionDate,
          importSource: 'BATCH_2024_OFFLINE_MIGRATE',
          admissionSource: src.admissionSource,
          // Do not copy admissionApplicationId / moodleUserId / importBatchId
        },
      });

      const p = src.masterProfile!;
      await tx.studentProfile.create({
        data: {
          id: randomUUID(),
          tenantId,
          studentId: student.id,
          fullName: p.fullName,
          email: isSyntheticEmail(p.email) ? null : p.email,
          gender: p.gender,
          dateOfBirth: p.dateOfBirth,
          mobileNumber: p.mobileNumber,
          whatsappNumber: p.whatsappNumber,
          nationalId: p.nationalId,
          maritalStatus: p.maritalStatus,
          studentStatus: p.studentStatus,
          // Drop lookup UUIDs (IDs differ across DBs)
          nationalityLookupId: null,
          bloodGroupLookupId: null,
          religionLookupId: null,
          categoryLookupId: null,
          tribeLookupId: null,
          denominationLookupId: null,
          differentlyAbled: p.differentlyAbled,
          ews: p.ews,
          address: p.address ?? undefined,
          guardianName: p.guardianName,
          guardianMobile: p.guardianMobile,
          photoPath: p.photoPath,
          admissionStatus: p.admissionStatus,
          admissionType: p.admissionType,
          admissionCategory: p.admissionCategory,
          homeSameAsTura: p.homeSameAsTura,
          bankName: p.bankName,
          accountHolderName: p.accountHolderName,
          accountNumber: p.accountNumber,
          ifsc: p.ifsc,
          branchName: p.branchName,
          emergencyContactName: p.emergencyContactName,
          emergencyContactRelation: p.emergencyContactRelation,
          emergencyContactMobile: p.emergencyContactMobile,
          panNumber: p.panNumber,
          alternateMobile: p.alternateMobile,
        },
      });

      const preferredShiftId = src.academicProfile.preferredShift?.code
        ? (maps.shiftsByCode.get(
            src.academicProfile.preferredShift.code.toUpperCase(),
          )?.id ?? null)
        : (shift?.id ?? null);

      await tx.studentAcademicProfile.create({
        data: {
          id: randomUUID(),
          tenantId,
          studentId: student.id,
          streamId,
          preferredShiftId,
          admissionYearId: null,
          admissionBatchId: batchId,
          class12Subjects: src.academicProfile.class12Subjects ?? [],
          nccEnrolled: src.academicProfile.nccEnrolled,
          languagePreferences:
            src.academicProfile.languagePreferences ?? undefined,
          languageEligibility:
            src.academicProfile.languageEligibility ?? undefined,
          residenceType: src.academicProfile.residenceType,
          hostelBlock: src.academicProfile.hostelBlock,
          hostelRoom: src.academicProfile.hostelRoom,
          previousCollegeName: src.academicProfile.previousCollegeName,
        },
      });

      if (src.academicStanding) {
        const st = src.academicStanding;
        await tx.studentAcademicStanding.create({
          data: {
            id: randomUUID(),
            tenantId,
            studentId: student.id,
            currentSemesterSequence: st.currentSemesterSequence,
            lifecycleState: st.lifecycleState,
            programmeStatus: st.programmeStatus,
            alumniEligible: st.alumniEligible,
            promotionLocked: st.promotionLocked,
            registrationLocked: st.registrationLocked,
            aggregatePercentageThroughSem6: st.aggregatePercentageThroughSem6,
            completedAt: st.completedAt,
            lastPromotedAt: st.lastPromotedAt,
          },
        });
      } else {
        await tx.studentAcademicStanding.create({
          data: {
            id: randomUUID(),
            tenantId,
            studentId: student.id,
            currentSemesterSequence: 5,
            lifecycleState: 'ACTIVE',
            programmeStatus: 'IN_PROGRESS',
          },
        });
      }

      for (const choice of src.programChoices) {
        await tx.studentProgramChoice.create({
          data: {
            id: randomUUID(),
            tenantId,
            studentId: student.id,
            choiceType: choice.choiceType,
            subjectSlug: choice.subjectSlug,
            departmentId: departmentId,
            status: choice.status,
            effectiveFromSemester: choice.effectiveFromSemester,
          },
        });
      }

      for (const g of src.guardians) {
        await tx.studentGuardian.create({
          data: {
            id: randomUUID(),
            tenantId,
            studentId: student.id,
            guardianType: g.guardianType,
            fullName: g.fullName,
            age: g.age,
            occupation: g.occupation,
            contactNumber: g.contactNumber,
            email: g.email,
          },
        });
      }

      for (const a of src.addresses) {
        await tx.studentAddress.create({
          data: {
            id: randomUUID(),
            tenantId,
            studentId: student.id,
            addressType: a.addressType,
            line1: a.line1,
            line2: a.line2,
            city: a.city,
            state: a.state,
            district: a.district,
            pinCode: a.pinCode,
          },
        });
      }

      if (src.majorMinorTrack) {
        const majorId = maps.subjectsBySlug.get(
          src.majorMinorTrack.majorSubject.slug.toLowerCase(),
        );
        const minorId = src.majorMinorTrack.minorSubject
          ? maps.subjectsBySlug.get(
              src.majorMinorTrack.minorSubject.slug.toLowerCase(),
            )
          : null;
        if (majorId) {
          await tx.studentMajorMinorTrack.create({
            data: {
              id: randomUUID(),
              tenantId,
              studentId: student.id,
              majorSubjectId: majorId,
              minorSubjectId: minorId ?? null,
              lockedAtSemester: src.majorMinorTrack.lockedAtSemester,
              isTrackLocked: src.majorMinorTrack.isTrackLocked,
              lockedAt: src.majorMinorTrack.lockedAt,
              unlockReason: src.majorMinorTrack.unlockReason,
              unlockedAt: src.majorMinorTrack.unlockedAt,
            },
          });
        } else {
          base.warnings?.push(
            `Major subject slug not on live: ${src.majorMinorTrack.majorSubject.slug}`,
          );
        }
      }

      if (src.vtcTrack) {
        await tx.studentVtcTrack.create({
          data: {
            id: randomUUID(),
            tenantId,
            studentId: student.id,
            trackGroupCode: src.vtcTrack.trackGroupCode,
            // Offering FKs differ; leave null unless we remap later
            selectedSem3OfferingId: null,
            selectedSem4OfferingId: null,
            selectedSem6OfferingId: null,
            lockedAtSemester: src.vtcTrack.lockedAtSemester,
            resetReason: src.vtcTrack.resetReason,
            resetAt: src.vtcTrack.resetAt,
          },
        });
      }

      for (const track of src.academicTracks) {
        await tx.studentAcademicTrack.create({
          data: {
            id: randomUUID(),
            tenantId,
            studentId: student.id,
            track: track.track,
            effectiveFromSemester: track.effectiveFromSemester,
            aggregatePercentageAtSelection:
              track.aggregatePercentageAtSelection,
            eligibilityOverride: track.eligibilityOverride,
            eligibilityOverrideReason: track.eligibilityOverrideReason,
          },
        });
      }

      for (const reg of src.semesterRegistrations) {
        const semesterId = maps.semestersByNumber.get(
          reg.semester.semesterNumber,
        );
        if (!semesterId) {
          base.warnings?.push(
            `Semester ${reg.semester.semesterNumber} missing on live; skipped registration`,
          );
          continue;
        }
        const regShiftId = reg.shift?.code
          ? (maps.shiftsByCode.get(reg.shift.code.toUpperCase())?.id ?? null)
          : (shift?.id ?? null);

        const createdReg = await tx.semesterRegistration.create({
          data: {
            id: randomUUID(),
            tenantId,
            studentId: student.id,
            semesterId,
            shiftId: regShiftId,
            semesterSequence: reg.semesterSequence,
            status: reg.status,
            submittedAt: reg.submittedAt,
            archivedAt: reg.archivedAt,
          },
        });

        for (const line of reg.lines) {
          const offeringId = resolveOfferingId(maps, line);
          if (!offeringId) {
            base.warnings?.push(
              `Unmapped offering ${line.offering?.course?.code ?? '?'} semSeq=${line.offering?.semesterSequence}`,
            );
            continue;
          }
          let sectionId: string | null = null;
          if (line.offeringSection) {
            const sectionKey = [
              offeringId,
              line.offeringSection.shift.code.toUpperCase(),
              line.offeringSection.sectionCode.toUpperCase(),
            ].join('|');
            sectionId = maps.sectionsByKey.get(sectionKey) ?? null;
          }
          try {
            await tx.semesterRegistrationLine.create({
              data: {
                id: randomUUID(),
                tenantId,
                registrationId: createdReg.id,
                offeringId,
                offeringSectionId: sectionId,
                category: line.category,
                status: line.status,
                priorityRank: line.priorityRank,
                assignmentSource: line.assignmentSource,
                registrationSource: line.registrationSource,
                generatedBy: line.generatedBy,
                eligibilityOverride: line.eligibilityOverride,
                eligibilityOverrideReason: line.eligibilityOverrideReason,
                credits: line.credits,
              },
            });
          } catch (err) {
            base.warnings?.push(
              `Failed line ${line.offering?.course?.code}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }

      return student.id;
    });

    return {
      ...base,
      outcome: 'MIGRATED',
      targetStudentId: newStudentId,
      reason: 'Created on live',
    };
  } catch (err) {
    return {
      ...base,
      outcome: 'FAILED',
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const startedAt = new Date();
  if (!SOURCE_URL) {
    console.error('SOURCE_DATABASE_URL is required (offline DB).');
    process.exit(1);
  }
  if (!TARGET_URL) {
    console.error('TARGET_DATABASE_URL or DATABASE_URL is required (live DB).');
    process.exit(1);
  }
  if (SOURCE_URL === TARGET_URL) {
    console.error('SOURCE_DATABASE_URL and TARGET_DATABASE_URL must differ.');
    process.exit(1);
  }

  const fingerprint = (url: string) =>
    createHash('sha256').update(url).digest('hex').slice(0, 12);

  console.log('=== Batch 2024 Offline → Live Migration ===');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Tenant slug: ${TENANT_SLUG}`);
  console.log(`Batch: ${BATCH_CODE}  Roll: ${ROLL_REGEX}`);
  console.log(`Source fingerprint: ${fingerprint(SOURCE_URL)}`);
  console.log(`Target fingerprint: ${fingerprint(TARGET_URL)}`);

  const source = new PrismaClient({
    datasources: { db: { url: SOURCE_URL } },
  });
  const target = new PrismaClient({
    datasources: { db: { url: TARGET_URL } },
  });

  const report: MigrationReport = {
    startedAt: startedAt.toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    tenantSlug: TENANT_SLUG,
    batchCode: BATCH_CODE,
    rollRegex: String(ROLL_REGEX),
    totals: {
      found: 0,
      eligible: 0,
      migrate: 0,
      skippedDemo: 0,
      skippedDuplicate: 0,
      invalid: 0,
      failed: 0,
      migrated: 0,
    },
    students: [],
    unmappedMasters: [],
  };

  try {
    const sourceTenant = await resolveTenant(source, TENANT_SLUG);
    const targetTenant = await resolveTenant(target, TENANT_SLUG);
    if (!sourceTenant || !targetTenant) {
      throw new Error('Could not resolve tenant on source and/or target');
    }
    console.log(`Source tenant: ${sourceTenant.slug} (${sourceTenant.id})`);
    console.log(`Target tenant: ${targetTenant.slug} (${targetTenant.id})`);

    const maps = await loadTargetMaps(target, targetTenant.id);
    if (!maps.batchesByCode.has(BATCH_CODE.toUpperCase())) {
      report.unmappedMasters.push(`AdmissionBatch ${BATCH_CODE}`);
      throw new Error(
        `Live is missing admission batch ${BATCH_CODE}. Create/sync masters before migrating.`,
      );
    }

    const candidates = await source.student.findMany({
      where: {
        tenantId: sourceTenant.id,
        deletedAt: null,
        academicProfile: {
          admissionBatch: { batchCode: BATCH_CODE },
        },
      },
      include: sourceInclude,
      orderBy: { rollNumber: 'asc' },
    });

    report.totals.found = candidates.length;
    console.log(
      `Found ${candidates.length} students on SOURCE for ${BATCH_CODE}`,
    );

    for (const src of candidates) {
      const row = await migrateOne(target, maps, targetTenant.id, src, !apply);
      report.students.push(row);
      switch (row.outcome) {
        case 'MIGRATE':
          report.totals.migrate += 1;
          report.totals.eligible += 1;
          break;
        case 'MIGRATED':
          report.totals.migrated += 1;
          report.totals.eligible += 1;
          break;
        case 'SKIP_DEMO':
          report.totals.skippedDemo += 1;
          break;
        case 'SKIP_DUPLICATE':
          report.totals.skippedDuplicate += 1;
          break;
        case 'INVALID':
          report.totals.invalid += 1;
          break;
        case 'FAILED':
          report.totals.failed += 1;
          break;
      }
    }

    report.endedAt = new Date().toISOString();

    const outDir = join(process.cwd(), 'storage', 'migration-reports');
    mkdirSync(outDir, { recursive: true });
    const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
    const outPath = join(outDir, `batch-2024-${stamp}.json`);
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

    console.log('\n--- Summary ---');
    console.log(JSON.stringify(report.totals, null, 2));
    console.log(`Report: ${outPath}`);
    if (!apply) {
      console.log(
        '\nDry-run complete. Re-run with CONFIRM=YES to insert into live.',
      );
    } else {
      console.log(
        `\nApplied. Migrated ${report.totals.migrated}; failed ${report.totals.failed}.`,
      );
      console.log(
        'Verify Student Directory for BA24-* / BATCH-2024. Photo files are path-only until uploads are synced.',
      );
    }
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
