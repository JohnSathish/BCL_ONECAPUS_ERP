import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { resolveTenantUploadRoot } from '../../common/uploads/upload-paths';
import { SCHOOL_ADMISSION_NUMBER_PREFIX } from './school-sis.constants';
import { resolveSchoolEnrollmentRollNumber } from './school-sis-roll-number';
import type { SaveSchoolStudentMasterDto } from './dto/school-sis.dto';
import { SchoolSisService } from './school-sis.service';
import { isSchoolPlaceholderEmail } from './school-sis-activation-contact';

const PHONE_RE = /^(?:\+?91[-\s]?)?[6-9]\d{9}$/;
const PIN_RE = /^\d{6}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const DOC_MIME = new Set([...IMAGE_MIME, 'application/pdf']);
const MAX_BYTES = 4 * 1024 * 1024;

function digits(value?: string | null) {
  return (value ?? '').replace(/\D/g, '');
}

function maskAadhaar(value?: string | null) {
  const d = digits(value);
  if (d.length !== 12) return value ?? null;
  return `XXXX-XXXX-${d.slice(-4)}`;
}

function isMaskedAadhaar(value?: string | null) {
  return /^XXXX[- ]?XXXX[- ]?\d{4}$/i.test((value ?? '').trim());
}

function emptyToNull(value?: string | null) {
  const t = value?.trim();
  return t ? t : null;
}

function addressJson(
  addr?: {
    line?: string;
    city?: string;
    state?: string;
    district?: string;
    pin?: string;
  } | null,
) {
  if (!addr) return {};
  return {
    line: addr.line?.trim() || '',
    city: addr.city?.trim() || '',
    state: addr.state?.trim() || '',
    district: addr.district?.trim() || '',
    pin: addr.pin?.trim() || '',
  };
}

@Injectable()
export class SchoolSisStudentMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
  ) {}

  private validateCommon(dto: SaveSchoolStudentMasterDto, strict: boolean) {
    if (strict) {
      if (!dto.fullName?.trim())
        throw new BadRequestException('Full Name is required');
      if (!dto.dateOfBirth)
        throw new BadRequestException('Date of Birth is required');
      if (!dto.gender) throw new BadRequestException('Gender is required');
      if (!dto.academicYearId)
        throw new BadRequestException('Academic Year is required');
      if (!dto.sectionId)
        throw new BadRequestException('Class and Section are required');
      if (!dto.status)
        throw new BadRequestException('Student Status is required');
    } else if (!dto.fullName?.trim() || dto.fullName.trim().length < 2) {
      throw new BadRequestException('Full Name is required to auto-save');
    }

    if (dto.dateOfBirth) {
      const dob = new Date(dto.dateOfBirth);
      if (Number.isNaN(dob.getTime()) || dob > new Date()) {
        throw new BadRequestException('Date of Birth is invalid');
      }
    }
    if (dto.admissionDate) {
      const ad = new Date(dto.admissionDate);
      if (Number.isNaN(ad.getTime())) {
        throw new BadRequestException('Admission Date is invalid');
      }
    }
    if (dto.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) {
      throw new BadRequestException('Student email is invalid');
    }
    if (dto.phone && !PHONE_RE.test(dto.phone.trim())) {
      throw new BadRequestException('Enter a valid Indian mobile number');
    }
    if (dto.aadhaarNumber && !isMaskedAadhaar(dto.aadhaarNumber)) {
      const d = digits(dto.aadhaarNumber);
      if (d.length !== 12)
        throw new BadRequestException('Aadhaar must be 12 digits');
    }
    for (const key of ['currentAddress', 'permanentAddress'] as const) {
      const pin = dto[key]?.pin?.trim();
      if (pin && !PIN_RE.test(pin))
        throw new BadRequestException('PIN Code must be 6 digits');
    }
    if (
      dto.bankIfsc?.trim() &&
      !IFSC_RE.test(dto.bankIfsc.trim().toUpperCase())
    ) {
      throw new BadRequestException('IFSC code is invalid');
    }
    for (const person of [dto.father, dto.mother, dto.guardian]) {
      if (person?.phone && !PHONE_RE.test(person.phone.trim())) {
        throw new BadRequestException(
          'Guardian phone must be a valid Indian mobile number',
        );
      }
    }
  }

  async getMaster(
    tenantId: string,
    studentId: string,
    includeMedical: boolean,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const student = await this.prisma.schoolStudent.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        guardians: {
          include: {
            guardian: { include: { personAccounts: { select: { id: true } } } },
          },
        },
        enrollments: {
          where: { deletedAt: null },
          include: {
            section: { include: { grade: true } },
            academicYear: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        previousSchools: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        enrollmentEvents: { orderBy: { createdAt: 'desc' }, take: 50 },
        siblingLinks: {
          include: {
            sibling: {
              include: {
                enrollments: {
                  where: { deletedAt: null, status: 'ACTIVE' },
                  include: { section: { include: { grade: true } } },
                  take: 1,
                },
              },
            },
          },
        },
        personAccounts: true,
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 40 },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    const current =
      student.enrollments.find((row) => row.status === 'ACTIVE') ??
      student.enrollments[0] ??
      null;
    const [classTeacher, gradeSubjects] = current
      ? await Promise.all([
          this.prisma.schoolClassTeacherAssignment.findFirst({
            where: {
              tenantId,
              academicYearId: current.academicYearId,
              sectionId: current.sectionId,
              deletedAt: null,
            },
            include: {
              staff: { select: { fullName: true, designation: true } },
            },
            orderBy: { role: 'asc' },
          }),
          this.prisma.schoolGradeSubject.findMany({
            where: {
              tenantId,
              academicYearId: current.academicYearId,
              gradeId: current.section.gradeId,
            },
            include: {
              subject: { select: { id: true, name: true, code: true } },
            },
            orderBy: { subject: { sortOrder: 'asc' } },
          }),
        ])
      : [null, []];
    const parentPortalActive =
      student.personAccounts.length > 0 ||
      student.guardians.some((link) => link.guardian.personAccounts.length > 0);
    const {
      aadhaarNumber,
      medicalHealth,
      allergies,
      medicalConditions,
      medications,
      emergencyNotes,
      ...rest
    } = student;
    const actorIds = [
      ...student.auditLogs.map((row) => row.actorUserId),
      ...student.enrollmentEvents.map((row) => row.actorUserId),
    ].filter((id): id is string => Boolean(id));
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: [...new Set(actorIds)] } },
          select: { id: true, displayName: true, email: true },
        })
      : [];
    const actorMap = new Map(
      actors.map((u) => [u.id, u.displayName || u.email]),
    );
    return {
      ...rest,
      aadhaarNumber: maskAadhaar(aadhaarNumber),
      aadhaarMasked: Boolean(aadhaarNumber),
      medical: includeMedical
        ? {
            medicalHealth,
            allergies,
            medicalConditions,
            medications,
            emergencyNotes,
          }
        : null,
      classTeacher: classTeacher?.staff
        ? {
            fullName: classTeacher.staff.fullName,
            designation: classTeacher.staff.designation,
          }
        : null,
      subjects: gradeSubjects.map((row) => ({
        id: row.subject.id,
        name: row.subject.name,
        code: row.subject.code,
      })),
      parentPortalActive,
      documents: student.documents.map((doc) => ({
        id: doc.id,
        slot: doc.slot,
        fileName: doc.fileName,
        verificationStatus: doc.verificationStatus,
        createdAt: doc.createdAt,
        hasFile: Boolean(doc.storageKey),
      })),
      auditLogs: student.auditLogs.map((log) => ({
        ...log,
        actorName: log.actorUserId
          ? (actorMap.get(log.actorUserId) ?? null)
          : null,
      })),
      enrollmentEvents: student.enrollmentEvents.map((ev) => ({
        ...ev,
        actorName: ev.actorUserId
          ? (actorMap.get(ev.actorUserId) ?? null)
          : null,
      })),
    };
  }

  async saveMaster(
    tenantId: string,
    actorUserId: string,
    dto: SaveSchoolStudentMasterDto,
    existingId?: string,
    includeMedical = true,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const strict = !dto.autosave;
    this.validateCommon(dto, strict);

    const existing = existingId
      ? await this.prisma.schoolStudent.findFirst({
          where: { id: existingId, tenantId, deletedAt: null },
        })
      : null;
    if (existingId && !existing)
      throw new NotFoundException('Student not found');

    let academicYear = dto.academicYearId
      ? await this.prisma.schoolAcademicYear.findFirst({
          where: { id: dto.academicYearId, tenantId, deletedAt: null },
        })
      : await this.sis.currentYear(tenantId);
    if (dto.academicYearId && !academicYear) {
      throw new BadRequestException('Academic year not found');
    }
    if (!academicYear) academicYear = await this.sis.currentYear(tenantId);

    let section = dto.sectionId
      ? await this.prisma.schoolSection.findFirst({
          where: {
            id: dto.sectionId,
            tenantId,
            academicYearId: academicYear.id,
            deletedAt: null,
          },
          include: { grade: true },
        })
      : null;
    if (dto.sectionId && !section) {
      throw new BadRequestException(
        'Class/section does not belong to the selected academic year',
      );
    }
    if (strict && !section) {
      throw new BadRequestException('Class and Section are required');
    }

    const aadhaar =
      dto.aadhaarNumber == null
        ? (existing?.aadhaarNumber ?? null)
        : isMaskedAadhaar(dto.aadhaarNumber)
          ? (existing?.aadhaarNumber ?? null)
          : digits(dto.aadhaarNumber) || null;

    const currentAddress = addressJson(dto.currentAddress);
    const permanentAddress = dto.permanentSameAsCurrent
      ? currentAddress
      : addressJson(dto.permanentAddress);

    try {
      const savedId = await this.prisma.$transaction(async (tx) => {
        const admissionNumber = existing
          ? await this.resolveAdmissionNumber(
              tx,
              tenantId,
              existing,
              dto.admissionNumber,
            )
          : dto.admissionNumber?.trim()
            ? dto.admissionNumber.trim().toUpperCase()
            : await this.nextAdmissionNumber(
                tx,
                tenantId,
                academicYear.id,
                academicYear.code,
              );

        const identity = {
          fullName: (dto.fullName ?? existing?.fullName ?? '').trim(),
          gender: dto.gender ?? existing?.gender ?? null,
          dateOfBirth: dto.dateOfBirth
            ? new Date(dto.dateOfBirth)
            : (existing?.dateOfBirth ?? null),
          status: dto.status ?? existing?.status ?? 'ACTIVE',
          phone:
            dto.phone !== undefined
              ? emptyToNull(dto.phone)
              : (existing?.phone ?? null),
          email:
            dto.email !== undefined
              ? emptyToNull(dto.email)
              : (existing?.email ?? null),
          bloodGroup:
            dto.bloodGroup !== undefined
              ? emptyToNull(dto.bloodGroup)
              : (existing?.bloodGroup ?? null),
          house:
            dto.house !== undefined
              ? emptyToNull(dto.house)
              : (existing?.house ?? null),
          nationality:
            dto.nationality !== undefined
              ? (emptyToNull(dto.nationality) ?? 'Indian')
              : (existing?.nationality ?? 'Indian'),
          religion:
            dto.religion !== undefined
              ? emptyToNull(dto.religion)
              : (existing?.religion ?? null),
          casteCategory:
            dto.casteCategory !== undefined
              ? emptyToNull(dto.casteCategory)
              : (existing?.casteCategory ?? null),
          motherTongue:
            dto.motherTongue !== undefined
              ? emptyToNull(dto.motherTongue)
              : (existing?.motherTongue ?? null),
          languagesKnown: dto.languagesKnown ?? existing?.languagesKnown ?? [],
          aadhaarNumber: aadhaar,
          photoUrl:
            dto.photoUrl !== undefined
              ? emptyToNull(dto.photoUrl)
              : (existing?.photoUrl ?? null),
          currentAddress: currentAddress as Prisma.InputJsonValue,
          permanentAddress: permanentAddress as Prisma.InputJsonValue,
          usesTransport: dto.usesTransport ?? existing?.usesTransport ?? false,
          transportJson: (dto.usesTransport
            ? (dto.transport ?? {})
            : {}) as Prisma.InputJsonValue,
          usesHostel: dto.usesHostel ?? existing?.usesHostel ?? false,
          hostelJson: (dto.usesHostel
            ? (dto.hostel ?? {})
            : {}) as Prisma.InputJsonValue,
          bankName: emptyToNull(dto.bankName),
          bankBranch: emptyToNull(dto.bankBranch),
          bankIfsc: emptyToNull(dto.bankIfsc)?.toUpperCase() ?? null,
          remarks: emptyToNull(dto.remarks),
          address: currentAddress.line || existing?.address || null,
        };

        const medical = includeMedical
          ? {
              medicalHealth: emptyToNull(dto.medicalHealth),
              allergies: dto.allergies ?? [],
              medicalConditions: emptyToNull(dto.medicalConditions),
              medications: emptyToNull(dto.medications),
              emergencyNotes: emptyToNull(dto.emergencyNotes),
            }
          : {};

        let studentId = existing?.id;
        if (!studentId) {
          const created = await tx.schoolStudent.create({
            data: {
              tenantId,
              admissionNumber,
              ...identity,
              ...medical,
            },
          });
          studentId = created.id;
          await tx.schoolEnrollmentEvent.create({
            data: {
              tenantId,
              studentId,
              type: 'CREATED',
              actorUserId,
            },
          });
          await tx.schoolStudentAuditLog.create({
            data: {
              tenantId,
              studentId,
              actorUserId,
              action: 'STUDENT_CREATED',
              entity: 'SchoolStudent',
              afterJson: { admissionNumber, fullName: identity.fullName },
            },
          });
        } else if (existing) {
          const beforeStatus = existing.status;
          const beforeAdmission = existing.admissionNumber;
          await tx.schoolStudent.update({
            where: { id: studentId },
            data: {
              admissionNumber,
              ...identity,
              ...medical,
            },
          });
          if (beforeAdmission !== admissionNumber) {
            await tx.schoolStudentAuditLog.create({
              data: {
                tenantId,
                studentId,
                actorUserId,
                action: 'ADMISSION_NUMBER_CHANGED',
                entity: 'SchoolStudent',
                beforeJson: { admissionNumber: beforeAdmission },
                afterJson: { admissionNumber },
              },
            });
          }
          if (beforeStatus !== identity.status) {
            await tx.schoolStudentAuditLog.create({
              data: {
                tenantId,
                studentId,
                actorUserId,
                action: 'STUDENT_STATUS_CHANGED',
                entity: 'SchoolStudent',
                beforeJson: { status: beforeStatus },
                afterJson: { status: identity.status },
              },
            });
          }
          await tx.schoolStudentAuditLog.create({
            data: {
              tenantId,
              studentId,
              actorUserId,
              action: dto.autosave ? 'STUDENT_AUTOSAVED' : 'STUDENT_UPDATED',
              entity: 'SchoolStudent',
              afterJson: { fullName: identity.fullName },
            },
          });
        }

        if (section) {
          await this.syncEnrollment(tx, {
            tenantId,
            studentId,
            academicYearId: academicYear.id,
            section,
            rollNumber: dto.rollNumber,
            admissionDate: dto.admissionDate,
            actorUserId,
            allowSectionChange: !existing,
          });
        }

        await this.syncGuardians(tx, tenantId, studentId, dto);
        await this.syncSiblings(tx, tenantId, studentId, dto);
        await this.syncPreviousSchool(tx, tenantId, studentId, dto);
        await this.syncLinkedLoginContact(
          tx,
          tenantId,
          studentId,
          identity.phone,
          identity.email,
        );
        return studentId;
      });

      return this.getMaster(tenantId, savedId, includeMedical);
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      )
        throw err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Admission number already exists');
      }
      throw err;
    }
  }

  private async nextAdmissionNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    academicYearId: string,
    yearCode: string,
  ) {
    const row = await tx.schoolIdSequence.upsert({
      where: {
        tenantId_academicYearId_kind: {
          tenantId,
          academicYearId,
          kind: 'ADMISSION',
        },
      },
      update: { lastValue: { increment: 1 } },
      create: { tenantId, academicYearId, kind: 'ADMISSION', lastValue: 1 },
    });
    return `${SCHOOL_ADMISSION_NUMBER_PREFIX}/${yearCode}/${String(row.lastValue).padStart(4, '0')}`;
  }

  private async resolveAdmissionNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    existing: { id: string; admissionNumber: string },
    next?: string,
  ) {
    const value = next?.trim().toUpperCase();
    if (!value || value === existing.admissionNumber)
      return existing.admissionNumber;
    const clash = await tx.schoolStudent.findFirst({
      where: {
        tenantId,
        admissionNumber: value,
        deletedAt: null,
        NOT: { id: existing.id },
      },
    });
    if (clash) throw new ConflictException('Admission number already exists');
    return value;
  }

  private async syncEnrollment(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      studentId: string;
      academicYearId: string;
      section: { id: string };
      rollNumber?: string;
      admissionDate?: string;
      actorUserId: string;
      allowSectionChange: boolean;
    },
  ) {
    const current = await tx.schoolEnrollment.findFirst({
      where: {
        tenantId: args.tenantId,
        studentId: args.studentId,
        academicYearId: args.academicYearId,
        deletedAt: null,
      },
    });
    if (!current) {
      const year = await tx.schoolAcademicYear.findFirst({
        where: { id: args.academicYearId, tenantId: args.tenantId },
      });
      const rollNumber = await resolveSchoolEnrollmentRollNumber(tx, {
        tenantId: args.tenantId,
        studentId: args.studentId,
        academicYearId: args.academicYearId,
        yearCode: year?.code ?? String(new Date().getFullYear()),
        requested: args.rollNumber,
      });
      const created = await tx.schoolEnrollment.create({
        data: {
          tenantId: args.tenantId,
          studentId: args.studentId,
          academicYearId: args.academicYearId,
          sectionId: args.section.id,
          rollNumber,
          admissionDate: args.admissionDate
            ? new Date(args.admissionDate)
            : new Date(),
          status: 'ACTIVE',
          source: 'OFFICE',
        },
      });
      await tx.schoolEnrollmentEvent.create({
        data: {
          tenantId: args.tenantId,
          studentId: args.studentId,
          enrollmentId: created.id,
          type: 'ENROLLED',
          toSectionId: args.section.id,
          actorUserId: args.actorUserId,
        },
      });
      await tx.schoolStudentAuditLog.create({
        data: {
          tenantId: args.tenantId,
          studentId: args.studentId,
          actorUserId: args.actorUserId,
          action: 'ENROLLMENT_CREATED',
          entity: 'SchoolEnrollment',
          afterJson: { enrollmentId: created.id, sectionId: args.section.id },
        },
      });
      return;
    }

    const year = await tx.schoolAcademicYear.findFirst({
      where: { id: args.academicYearId, tenantId: args.tenantId },
    });
    const rollNumber = await resolveSchoolEnrollmentRollNumber(tx, {
      tenantId: args.tenantId,
      studentId: args.studentId,
      academicYearId: args.academicYearId,
      yearCode: year?.code ?? String(new Date().getFullYear()),
      requested: args.rollNumber || current.rollNumber,
    });
    const nextSectionId = args.allowSectionChange
      ? args.section.id
      : current.sectionId;
    const updated = await tx.schoolEnrollment.update({
      where: { id: current.id },
      data: {
        rollNumber,
        admissionDate: args.admissionDate
          ? new Date(args.admissionDate)
          : current.admissionDate,
        sectionId: nextSectionId,
      },
    });
    if (current.sectionId !== nextSectionId) {
      await tx.schoolEnrollmentEvent.create({
        data: {
          tenantId: args.tenantId,
          studentId: args.studentId,
          enrollmentId: updated.id,
          type: 'SECTION_CHANGE',
          fromSectionId: current.sectionId,
          toSectionId: nextSectionId,
          actorUserId: args.actorUserId,
          note: 'Updated during initial enrollment save',
        },
      });
    }
  }

  private async syncLinkedLoginContact(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    phone: string | null,
    email: string | null,
  ) {
    const link = await tx.schoolPersonAccount.findFirst({
      where: { tenantId, studentId, personType: 'STUDENT' },
      select: { userId: true },
    });
    if (!link) return;
    const user = await tx.user.findFirst({
      where: { id: link.userId, tenantId, deletedAt: null },
      select: { id: true, email: true },
    });
    if (!user) return;
    const data: { phone: string | null; email?: string } = { phone };
    const nextEmail = email?.trim().toLowerCase() ?? '';
    if (
      nextEmail.includes('@') &&
      nextEmail !== user.email.trim().toLowerCase() &&
      !isSchoolPlaceholderEmail(nextEmail)
    ) {
      const taken = await tx.user.findFirst({
        where: {
          tenantId,
          email: nextEmail,
          deletedAt: null,
          NOT: { id: user.id },
        },
        select: { id: true },
      });
      if (!taken) data.email = nextEmail;
    }
    await tx.user.update({ where: { id: user.id }, data });
  }

  private async upsertGuardian(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    relation: string,
    relationship: string,
    person?: SaveSchoolStudentMasterDto['father'],
    isPrimary = false,
  ) {
    if (!person?.fullName?.trim()) return null;
    const data = {
      fullName: person.fullName.trim(),
      relation,
      phone: emptyToNull(person.phone),
      email: emptyToNull(person.email),
      occupation: emptyToNull(person.occupation),
      photoUrl: emptyToNull(person.photoUrl),
      address: addressJson(person.address) as Prisma.InputJsonValue,
      isPrimary,
    };
    let guardianId = person.id;
    if (guardianId) {
      const found = await tx.schoolGuardian.findFirst({
        where: { id: guardianId, tenantId, deletedAt: null },
      });
      if (!found) guardianId = undefined;
    }
    if (guardianId) {
      await tx.schoolGuardian.update({ where: { id: guardianId }, data });
    } else {
      const created = await tx.schoolGuardian.create({
        data: { tenantId, ...data },
      });
      guardianId = created.id;
    }
    await tx.schoolStudentGuardian.upsert({
      where: { studentId_guardianId: { studentId, guardianId } },
      create: { studentId, guardianId, relationship },
      update: { relationship },
    });
    return guardianId;
  }

  private async syncGuardians(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    dto: SaveSchoolStudentMasterDto,
  ) {
    const fatherId = await this.upsertGuardian(
      tx,
      tenantId,
      studentId,
      'FATHER',
      'FATHER',
      dto.father,
      dto.guardianType === 'FATHER' || dto.guardianSameAsFather,
    );
    await this.upsertGuardian(
      tx,
      tenantId,
      studentId,
      'MOTHER',
      'MOTHER',
      dto.mother,
      dto.guardianType === 'MOTHER',
    );
    if (dto.guardianSameAsFather && fatherId) {
      await tx.schoolStudentGuardian.upsert({
        where: { studentId_guardianId: { studentId, guardianId: fatherId } },
        create: { studentId, guardianId: fatherId, relationship: 'FATHER' },
        update: { relationship: 'FATHER' },
      });
      return;
    }
    if (dto.guardianType === 'FATHER' || dto.guardianType === 'MOTHER') return;
    await this.upsertGuardian(
      tx,
      tenantId,
      studentId,
      dto.guardianType === 'OTHER' ? 'OTHER' : 'GUARDIAN',
      dto.guardian?.relationship || dto.guardianType || 'GUARDIAN',
      dto.guardian,
      true,
    );
  }

  private async syncSiblings(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    dto: SaveSchoolStudentMasterDto,
  ) {
    if (dto.hasSiblings === false) {
      await tx.schoolStudentSibling.deleteMany({
        where: {
          tenantId,
          OR: [{ studentId }, { siblingStudentId: studentId }],
        },
      });
      return;
    }
    if (!dto.siblings) return;
    const wanted = dto.siblings.filter(
      (s) => s.siblingStudentId && s.siblingStudentId !== studentId,
    );
    const unique = new Map(
      wanted.map((s) => [s.siblingStudentId, s.relationship || 'SIBLING']),
    );
    for (const [siblingId, relationship] of unique) {
      const other = await tx.schoolStudent.findFirst({
        where: { id: siblingId, tenantId, deletedAt: null },
      });
      if (!other) throw new BadRequestException('Sibling student not found');
      await tx.schoolStudentSibling.upsert({
        where: {
          studentId_siblingStudentId: {
            studentId,
            siblingStudentId: siblingId,
          },
        },
        create: {
          id: randomUUID(),
          tenantId,
          studentId,
          siblingStudentId: siblingId,
          relationship,
        },
        update: { relationship },
      });
      await tx.schoolStudentSibling.upsert({
        where: {
          studentId_siblingStudentId: {
            studentId: siblingId,
            siblingStudentId: studentId,
          },
        },
        create: {
          id: randomUUID(),
          tenantId,
          studentId: siblingId,
          siblingStudentId: studentId,
          relationship,
        },
        update: { relationship },
      });
    }
  }

  private async syncPreviousSchool(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
    dto: SaveSchoolStudentMasterDto,
  ) {
    if (!dto.previousSchool) return;
    const existing = await tx.schoolStudentPreviousSchool.findFirst({
      where: { tenantId, studentId },
      orderBy: { createdAt: 'desc' },
    });
    if (dto.previousSchool.none) {
      if (existing)
        await tx.schoolStudentPreviousSchool.delete({
          where: { id: existing.id },
        });
      return;
    }
    const name = dto.previousSchool.schoolName?.trim();
    if (!name) return;
    const data = {
      schoolName: name,
      address: emptyToNull(dto.previousSchool.address),
      lastClass: emptyToNull(dto.previousSchool.lastClass),
      yearOfLeaving: emptyToNull(dto.previousSchool.yearOfLeaving),
      tcNumber: emptyToNull(dto.previousSchool.tcNumber),
      tcDate: dto.previousSchool.tcDate
        ? new Date(dto.previousSchool.tcDate)
        : null,
    };
    if (existing) {
      await tx.schoolStudentPreviousSchool.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await tx.schoolStudentPreviousSchool.create({
        data: { tenantId, studentId, ...data },
      });
    }
  }

  async savePhoto(
    tenantId: string,
    studentId: string,
    actorUserId: string,
    kind: 'STUDENT' | 'FATHER' | 'MOTHER' | 'GUARDIAN',
    file: Express.Multer.File,
  ) {
    this.assertFile(file, IMAGE_MIME);
    const master = await this.getMaster(tenantId, studentId, false);
    const stored = await this.writeFile(tenantId, studentId, 'photos', file);
    if (kind === 'STUDENT') {
      await this.prisma.schoolStudent.update({
        where: { id: studentId },
        data: { photoUrl: stored.publicPath },
      });
    } else {
      const relation = kind;
      const link = master.guardians.find(
        (g) => g.relationship === relation || g.guardian.relation === relation,
      );
      if (!link)
        throw new BadRequestException(
          'Save guardian details before uploading a photo',
        );
      await this.prisma.schoolGuardian.update({
        where: { id: link.guardian.id },
        data: { photoUrl: stored.publicPath },
      });
    }
    await this.prisma.schoolStudentAuditLog.create({
      data: {
        tenantId,
        studentId,
        actorUserId,
        action: 'PHOTO_UPLOADED',
        entity: kind,
        afterJson: { path: stored.publicPath },
      },
    });
    return { url: stored.publicPath };
  }

  async removePhoto(
    tenantId: string,
    studentId: string,
    actorUserId: string,
    kind: 'STUDENT',
  ) {
    await this.sis.getStudent(tenantId, studentId);
    await this.prisma.schoolStudent.update({
      where: { id: studentId },
      data: { photoUrl: null },
    });
    await this.prisma.schoolStudentAuditLog.create({
      data: {
        tenantId,
        studentId,
        actorUserId,
        action: 'PHOTO_REMOVED',
        entity: kind,
      },
    });
    return { ok: true };
  }

  async uploadDocument(
    tenantId: string,
    studentId: string,
    actorUserId: string,
    slot: string,
    file: Express.Multer.File,
    notes?: string,
  ) {
    this.assertFile(file, DOC_MIME);
    await this.sis.getStudent(tenantId, studentId);
    const stored = await this.writeFile(tenantId, studentId, 'documents', file);
    const existing = await this.prisma.schoolStudentDocument.findFirst({
      where: { tenantId, studentId, slot: slot.trim().toUpperCase() },
    });
    const row = existing
      ? await this.prisma.schoolStudentDocument.update({
          where: { id: existing.id },
          data: {
            fileName: stored.fileName,
            storageKey: stored.publicPath,
            mimeType: stored.mimeType,
            uploadedById: actorUserId,
            notes: emptyToNull(notes),
            verificationStatus: 'PENDING',
            verifiedAt: null,
            verifiedById: null,
          },
        })
      : await this.prisma.schoolStudentDocument.create({
          data: {
            tenantId,
            studentId,
            slot: slot.trim().toUpperCase(),
            fileName: stored.fileName,
            storageKey: stored.publicPath,
            mimeType: stored.mimeType,
            uploadedById: actorUserId,
            notes: emptyToNull(notes),
          },
        });
    await this.prisma.schoolStudentAuditLog.create({
      data: {
        tenantId,
        studentId,
        actorUserId,
        action: existing ? 'DOCUMENT_REPLACED' : 'DOCUMENT_UPLOADED',
        entity: 'SchoolStudentDocument',
        afterJson: { slot: row.slot, fileName: row.fileName },
      },
    });
    return row;
  }

  async streamDocument(
    tenantId: string,
    studentId: string,
    documentId: string,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const doc = await this.prisma.schoolStudentDocument.findFirst({
      where: { id: documentId, tenantId, studentId },
    });
    if (!doc?.storageKey) throw new NotFoundException('Document not found');
    const rel = doc.storageKey.replace(/^\/uploads\/tenants\//, '');
    const abs = join(resolveTenantUploadRoot(), rel);
    if (!existsSync(abs))
      throw new NotFoundException('Document file is missing');
    const stream = createReadStream(abs);
    return new StreamableFile(stream, {
      type: doc.mimeType || 'application/octet-stream',
      disposition: `inline; filename="${doc.fileName.replace(/"/g, '')}"`,
    });
  }

  async deleteDocument(
    tenantId: string,
    studentId: string,
    documentId: string,
    actorUserId: string,
  ) {
    const doc = await this.prisma.schoolStudentDocument.findFirst({
      where: { id: documentId, tenantId, studentId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.storageKey?.startsWith('/uploads/')) {
      try {
        await unlink(
          join(
            resolveTenantUploadRoot(),
            doc.storageKey.replace('/uploads/tenants/', ''),
          ),
        );
      } catch {
        /* ignore missing file */
      }
    }
    await this.prisma.schoolStudentDocument.delete({ where: { id: doc.id } });
    await this.prisma.schoolStudentAuditLog.create({
      data: {
        tenantId,
        studentId,
        actorUserId,
        action: 'DOCUMENT_DELETED',
        entity: 'SchoolStudentDocument',
        beforeJson: { slot: doc.slot, fileName: doc.fileName },
      },
    });
    return { ok: true };
  }

  private assertFile(
    file: Express.Multer.File | undefined,
    allowed: Set<string>,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('File is required');
    if (file.size > MAX_BYTES)
      throw new BadRequestException('File must be 4MB or smaller');
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Use JPG, PNG, WEBP, or PDF.',
      );
    }
  }

  private async writeFile(
    tenantId: string,
    studentId: string,
    folder: string,
    file: Express.Multer.File,
  ) {
    const ext =
      extname(file.originalname || '').toLowerCase() ||
      (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(ext)
      ? ext
      : '.bin';
    const filename = `${randomUUID()}${safeExt}`;
    const dir = join(
      resolveTenantUploadRoot(),
      tenantId,
      'school-sis',
      studentId,
      folder,
    );
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), file.buffer);
    return {
      fileName: file.originalname || filename,
      mimeType: file.mimetype,
      publicPath: `/uploads/tenants/${tenantId}/school-sis/${studentId}/${folder}/${filename}`,
    };
  }
}
