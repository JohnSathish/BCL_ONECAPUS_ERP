import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { GatewayPaymentService } from '../../fees/services/gateway-payment.service';
import { CertificateVariableService } from '../../certificates/certificate-variable.service';
import { CertificateDocumentService } from '../../certificates/certificate-document.service';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';
import { randomUUID } from 'crypto';
import type {
  ApplyEnrollmentDto,
  AssignStaffDto,
  GradeAssessmentDto,
  MarkAttendanceDto,
  UpsertAssessmentDto,
  UpsertMaterialDto,
  UpsertSessionDto,
  UpsertShortTermBatchDto,
  UpsertShortTermCourseDto,
} from '../dto/short-term-courses.dto';

const CONFIRMED_STATUSES = ['CONFIRMED', 'COMPLETED'];

@Injectable()
export class ShortTermCoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: GatewayPaymentService,
    private readonly variables: CertificateVariableService,
    private readonly documents: CertificateDocumentService,
    @Optional() private readonly communication?: CommunicationTriggerService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  // ── Courses ──────────────────────────────────────────────────────────

  async listCourses(
    tenantId: string,
    query: { status?: string; includeArchived?: boolean } = {},
  ) {
    return this.db().shortTermCourse.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(!query.includeArchived && !query.status
          ? { status: { not: 'ARCHIVED' } }
          : {}),
      },
      include: {
        batches: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            _count: {
              select: {
                enrollments: {
                  where: { status: { in: CONFIRMED_STATUSES } },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getCourse(tenantId: string, id: string) {
    const row = await this.db().shortTermCourse.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        batches: {
          orderBy: { courseStartAt: 'desc' },
          include: {
            staff: true,
            _count: { select: { enrollments: true, sessions: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Course not found');
    return row;
  }

  async upsertCourse(
    user: JwtUser,
    dto: UpsertShortTermCourseDto,
    id?: string,
  ) {
    if (id) {
      const existing = await this.getCourse(user.tid, id);
      const existingFees =
        existing.fees && typeof existing.fees === 'object'
          ? (existing.fees as Record<string, unknown>)
          : {};
      return this.db().shortTermCourse.update({
        where: { id: existing.id },
        data: {
          ...(dto.code != null ? { code: dto.code.trim().toUpperCase() } : {}),
          ...(dto.name != null ? { name: dto.name.trim() } : {}),
          ...(dto.shortName != null ? { shortName: dto.shortName.trim() } : {}),
          ...(dto.category != null ? { category: dto.category } : {}),
          ...(dto.departmentId !== undefined
            ? { departmentId: dto.departmentId ?? null }
            : {}),
          ...(dto.description != null ? { description: dto.description } : {}),
          ...(dto.objectives != null ? { objectives: dto.objectives } : {}),
          ...(dto.outcomes != null ? { outcomes: dto.outcomes } : {}),
          ...(dto.bannerUrl !== undefined
            ? { bannerUrl: dto.bannerUrl ?? null }
            : {}),
          ...(dto.mode != null ? { mode: dto.mode } : {}),
          ...(dto.durationDays != null
            ? { durationDays: dto.durationDays }
            : {}),
          ...(dto.totalHours != null ? { totalHours: dto.totalHours } : {}),
          ...(dto.sessionsCount != null
            ? { sessionsCount: dto.sessionsCount }
            : {}),
          ...(dto.feeType != null ? { feeType: dto.feeType } : {}),
          ...(dto.fees != null
            ? { fees: { ...existingFees, ...dto.fees } }
            : {}),
          ...(dto.eligibility != null ? { eligibility: dto.eligibility } : {}),
          ...(dto.maxSeats != null ? { maxSeats: dto.maxSeats } : {}),
          ...(dto.certRules != null ? { certRules: dto.certRules } : {}),
          ...(dto.status != null ? { status: dto.status } : {}),
        },
      });
    }

    if (!dto.code?.trim() || !dto.name?.trim()) {
      throw new BadRequestException('Course code and name are required.');
    }

    const data = {
      code: dto.code.trim().toUpperCase(),
      name: dto.name.trim(),
      shortName: (dto.shortName ?? dto.code).trim(),
      category: dto.category ?? 'CERTIFICATE',
      departmentId: dto.departmentId ?? null,
      description: dto.description ?? '',
      objectives: dto.objectives ?? '',
      outcomes: dto.outcomes ?? [],
      bannerUrl: dto.bannerUrl ?? null,
      mode: dto.mode ?? 'OFFLINE',
      durationDays: dto.durationDays ?? 30,
      totalHours: dto.totalHours ?? 0,
      sessionsCount: dto.sessionsCount ?? 0,
      feeType: dto.feeType ?? 'PAID',
      fees: dto.fees ?? {},
      eligibility: dto.eligibility ?? { scope: 'ALL' },
      maxSeats: dto.maxSeats ?? 40,
      certRules: dto.certRules ?? {
        minAttendancePercent: 80,
        passRequired: true,
      },
      status: dto.status ?? 'DRAFT',
    };

    return this.db().shortTermCourse.create({
      data: {
        tenantId: user.tid,
        createdById: user.sub,
        ...data,
      },
    });
  }

  async publishCourse(user: JwtUser, id: string) {
    await this.getCourse(user.tid, id);
    return this.db().shortTermCourse.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });
  }

  // ── Catalogue (student-facing published) ─────────────────────────────

  async catalogue(tenantId: string) {
    const courses = await this.db().shortTermCourse.findMany({
      where: { tenantId, status: 'PUBLISHED', deletedAt: null },
      include: {
        batches: {
          where: { status: { in: ['UPCOMING', 'OPEN', 'RUNNING'] } },
          orderBy: { regStartAt: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      courses.map(async (course: any) => {
        const openBatch =
          course.batches.find((b: any) => this.isRegistrationOpen(b)) ??
          course.batches[0] ??
          null;
        const seats = openBatch
          ? await this.seatSnapshot(tenantId, openBatch.id, course.maxSeats)
          : null;
        return {
          ...course,
          openBatch,
          seats,
          registrationOpen: Boolean(
            openBatch && this.isRegistrationOpen(openBatch),
          ),
        };
      }),
    );
  }

  // ── Batches ──────────────────────────────────────────────────────────

  async listBatches(tenantId: string, courseId?: string) {
    return this.db().shortTermBatch.findMany({
      where: {
        tenantId,
        ...(courseId ? { courseId } : {}),
      },
      include: {
        course: {
          select: { id: true, code: true, name: true, maxSeats: true },
        },
        staff: true,
        _count: { select: { enrollments: true, sessions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertBatch(user: JwtUser, dto: UpsertShortTermBatchDto, id?: string) {
    await this.getCourse(user.tid, dto.courseId);
    const data = {
      courseId: dto.courseId,
      batchCode: dto.batchCode.trim().toUpperCase(),
      regStartAt: dto.regStartAt ? new Date(dto.regStartAt) : null,
      regEndAt: dto.regEndAt ? new Date(dto.regEndAt) : null,
      courseStartAt: dto.courseStartAt ? new Date(dto.courseStartAt) : null,
      courseEndAt: dto.courseEndAt ? new Date(dto.courseEndAt) : null,
      classroom: dto.classroom ?? null,
      meetingLink: dto.meetingLink ?? null,
      status: dto.status ?? 'UPCOMING',
    };
    if (id) {
      const existing = await this.db().shortTermBatch.findFirst({
        where: { id, tenantId: user.tid },
      });
      if (!existing) throw new NotFoundException('Batch not found');
      return this.db().shortTermBatch.update({ where: { id }, data });
    }
    return this.db().shortTermBatch.create({
      data: { tenantId: user.tid, ...data },
    });
  }

  async getBatch(tenantId: string, id: string) {
    const batch = await this.db().shortTermBatch.findFirst({
      where: { id, tenantId },
      include: {
        course: true,
        staff: true,
        sessions: { orderBy: { startsAt: 'asc' } },
        materials: { orderBy: { createdAt: 'desc' } },
        assessments: { orderBy: { createdAt: 'asc' } },
        enrollments: {
          orderBy: { registeredAt: 'desc' },
          take: 200,
        },
      },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    const seats = await this.seatSnapshot(
      tenantId,
      batch.id,
      batch.course.maxSeats,
    );
    return { ...batch, seats };
  }

  // ── Staff ────────────────────────────────────────────────────────────

  async assignStaff(user: JwtUser, batchId: string, dto: AssignStaffDto) {
    await this.requireBatch(user.tid, batchId);
    const existing = await this.db().shortTermStaffAssignment.findFirst({
      where: {
        batchId,
        staffUserId: dto.staffUserId,
        role: dto.role,
      },
    });
    if (existing) return existing;
    return this.db().shortTermStaffAssignment.create({
      data: {
        tenantId: user.tid,
        batchId,
        staffUserId: dto.staffUserId,
        role: dto.role,
      },
    });
  }

  async removeStaff(user: JwtUser, assignmentId: string) {
    const row = await this.db().shortTermStaffAssignment.findFirst({
      where: { id: assignmentId, tenantId: user.tid },
    });
    if (!row) throw new NotFoundException('Staff assignment not found');
    await this.db().shortTermStaffAssignment.delete({
      where: { id: assignmentId },
    });
    return { ok: true };
  }

  // ── Sessions / timetable ─────────────────────────────────────────────

  async upsertSession(
    user: JwtUser,
    batchId: string,
    dto: UpsertSessionDto,
    id?: string,
  ) {
    await this.requireBatch(user.tid, batchId);
    const data = {
      topic: dto.topic,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      venue: dto.venue ?? null,
      meetingLink: dto.meetingLink ?? null,
    };
    if (id) {
      return this.db().shortTermSession.update({
        where: { id },
        data,
      });
    }
    return this.db().shortTermSession.create({
      data: { tenantId: user.tid, batchId, ...data },
    });
  }

  // ── Materials ────────────────────────────────────────────────────────

  async upsertMaterial(user: JwtUser, batchId: string, dto: UpsertMaterialDto) {
    await this.requireBatch(user.tid, batchId);
    return this.db().shortTermMaterial.create({
      data: {
        tenantId: user.tid,
        batchId,
        title: dto.title,
        type: dto.type ?? 'NOTES',
        filePath: dto.filePath ?? null,
        fileUrl: dto.fileUrl ?? null,
        publishedAt: dto.publish === false ? null : new Date(),
        createdById: user.sub,
      },
    });
  }

  // ── Assessments ──────────────────────────────────────────────────────

  async upsertAssessment(
    user: JwtUser,
    batchId: string,
    dto: UpsertAssessmentDto,
    id?: string,
  ) {
    await this.requireBatch(user.tid, batchId);
    const data = {
      title: dto.title,
      type: dto.type ?? 'ASSIGNMENT',
      maxMarks: dto.maxMarks ?? 100,
      passMarks: dto.passMarks ?? 40,
      weightage: dto.weightage ?? 100,
      required: dto.required ?? true,
    };
    if (id) {
      return this.db().shortTermAssessment.update({ where: { id }, data });
    }
    return this.db().shortTermAssessment.create({
      data: { tenantId: user.tid, batchId, ...data },
    });
  }

  async gradeAssessment(
    user: JwtUser,
    assessmentId: string,
    dto: GradeAssessmentDto,
  ) {
    const assessment = await this.db().shortTermAssessment.findFirst({
      where: { id: assessmentId, tenantId: user.tid },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    const passed = Number(dto.marks) >= Number(assessment.passMarks);
    const existing = await this.db().shortTermAssessmentResult.findFirst({
      where: { assessmentId, enrollmentId: dto.enrollmentId },
    });
    if (existing) {
      return this.db().shortTermAssessmentResult.update({
        where: { id: existing.id },
        data: {
          marks: dto.marks,
          passed,
          gradedById: user.sub,
          gradedAt: new Date(),
        },
      });
    }
    return this.db().shortTermAssessmentResult.create({
      data: {
        tenantId: user.tid,
        assessmentId,
        enrollmentId: dto.enrollmentId,
        marks: dto.marks,
        passed,
        gradedById: user.sub,
      },
    });
  }

  // ── Attendance ───────────────────────────────────────────────────────

  async markAttendance(
    user: JwtUser,
    sessionId: string,
    dto: MarkAttendanceDto,
  ) {
    const session = await this.db().shortTermSession.findFirst({
      where: { id: sessionId, tenantId: user.tid },
    });
    if (!session) throw new NotFoundException('Session not found');

    const results = [];
    for (const row of dto.rows ?? []) {
      const existing = await this.db().shortTermAttendance.findFirst({
        where: { sessionId, enrollmentId: row.enrollmentId },
      });
      if (existing) {
        results.push(
          await this.db().shortTermAttendance.update({
            where: { id: existing.id },
            data: {
              status: row.status || 'PRESENT',
              markedById: user.sub,
              markedAt: new Date(),
            },
          }),
        );
      } else {
        results.push(
          await this.db().shortTermAttendance.create({
            data: {
              tenantId: user.tid,
              sessionId,
              enrollmentId: row.enrollmentId,
              status: row.status || 'PRESENT',
              markedById: user.sub,
            },
          }),
        );
      }
    }
    return { marked: results.length, rows: results };
  }

  // ── Enrollment + payment ─────────────────────────────────────────────

  async apply(user: JwtUser, studentId: string, dto: ApplyEnrollmentDto) {
    if (!dto.acceptTerms) {
      throw new BadRequestException('Please accept the terms to continue.');
    }
    const batch = await this.db().shortTermBatch.findFirst({
      where: { id: dto.batchId, tenantId: user.tid },
      include: { course: true },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    if (batch.course.status !== 'PUBLISHED') {
      throw new BadRequestException('Course is not open for registration.');
    }
    if (!this.isRegistrationOpen(batch)) {
      throw new BadRequestException(
        'Registration window is closed for this batch.',
      );
    }

    await this.assertEligibility(user.tid, studentId, batch.course.eligibility);

    const existing = await this.db().shortTermEnrollment.findFirst({
      where: { batchId: batch.id, studentId },
    });
    if (existing && !['CANCELLED'].includes(existing.status)) {
      throw new BadRequestException(
        'You are already registered for this batch.',
      );
    }

    const seats = await this.seatSnapshot(
      user.tid,
      batch.id,
      batch.course.maxSeats,
    );

    let status = 'APPLIED';
    let waitlistRank: number | null = null;
    if (seats.available <= 0) {
      status = 'WAITLISTED';
      waitlistRank = seats.waitlisted + 1;
    } else if (batch.course.feeType === 'PAID') {
      status = 'PAYMENT_PENDING';
    } else {
      status = 'CONFIRMED';
    }

    const enrollment = existing
      ? await this.db().shortTermEnrollment.update({
          where: { id: existing.id },
          data: {
            status,
            waitlistRank,
            registeredAt: new Date(),
            confirmedAt: status === 'CONFIRMED' ? new Date() : null,
          },
        })
      : await this.db().shortTermEnrollment.create({
          data: {
            tenantId: user.tid,
            batchId: batch.id,
            studentId,
            status,
            waitlistRank,
            confirmedAt: status === 'CONFIRMED' ? new Date() : null,
          },
        });

    if (status === 'PAYMENT_PENDING') {
      return this.initiatePayment(user, enrollment.id);
    }

    if (status === 'CONFIRMED') {
      void this.notifyRegistrationConfirmed(user.tid, {
        ...enrollment,
        batch,
      }).catch(() => undefined);
    }

    return { enrollment, checkout: null, waitlisted: status === 'WAITLISTED' };
  }

  async initiatePayment(user: JwtUser, enrollmentId: string) {
    const enrollment = await this.db().shortTermEnrollment.findFirst({
      where: { id: enrollmentId, tenantId: user.tid },
      include: { batch: { include: { course: true } } },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (
      !['PAYMENT_PENDING', 'APPLIED'].includes(enrollment.status) &&
      enrollment.status !== 'WAITLISTED'
    ) {
      throw new BadRequestException(
        'Payment is not required for this enrollment.',
      );
    }

    const course = enrollment.batch.course;
    const fees = (course.fees ?? {}) as Record<string, number>;
    const amount =
      Number(fees.courseFee ?? fees.registrationFee ?? 0) +
      Number(fees.gst ?? 0);
    if (amount <= 0) {
      throw new BadRequestException('Course fee is not configured.');
    }

    const demand = await this.ensureDemand(user, enrollment, amount, course);
    const checkout = await this.gateway.initiate(user, {
      studentId: enrollment.studentId,
      demandIds: [demand.id],
      amount,
    } as any);

    await this.db().shortTermEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: 'PAYMENT_PENDING',
        demandId: demand.id,
        paymentId: checkout?.payment?.id ?? null,
      },
    });

    return {
      enrollment: await this.db().shortTermEnrollment.findFirst({
        where: { id: enrollment.id },
      }),
      checkout,
      waitlisted: false,
    };
  }

  async confirmPayment(
    user: JwtUser,
    enrollmentId: string,
    paymentId?: string,
  ) {
    const enrollment = await this.db().shortTermEnrollment.findFirst({
      where: { id: enrollmentId, tenantId: user.tid },
      include: { batch: { include: { course: true } } },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    if (CONFIRMED_STATUSES.includes(enrollment.status)) {
      return enrollment;
    }

    const payId = paymentId ?? enrollment.paymentId ?? undefined;
    if (payId) {
      try {
        await this.gateway.reconcilePaymentById(user, payId);
      } catch {
        /* reconcile may no-op if already SUCCESS */
      }
    }

    if (enrollment.demandId) {
      const demand = await this.db().studentFeeDemand.findFirst({
        where: { id: enrollment.demandId, tenantId: user.tid },
      });
      const paid =
        demand &&
        (demand.status === 'PAID' || Number(demand.balanceAmount) <= 0);
      if (!paid) {
        throw new BadRequestException(
          'Payment is not confirmed yet. Complete gateway checkout and try again.',
        );
      }
    }

    return this.finalizeEnrollmentAfterPayment(user.tid, enrollment.id, payId);
  }

  /** Called from gateway completion or student confirm endpoint. */
  async finalizeEnrollmentAfterPayment(
    tenantId: string,
    enrollmentId: string,
    paymentId?: string | null,
  ) {
    const enrollment = await this.db().shortTermEnrollment.findFirst({
      where: { id: enrollmentId, tenantId },
      include: { batch: { include: { course: true } } },
    });
    if (!enrollment) return null;
    if (CONFIRMED_STATUSES.includes(enrollment.status)) return enrollment;

    const seats = await this.seatSnapshot(
      tenantId,
      enrollment.batchId,
      enrollment.batch.course.maxSeats,
    );
    const nextStatus = seats.available > 0 ? 'CONFIRMED' : 'WAITLISTED';

    const updated = await this.db().shortTermEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: nextStatus,
        paymentId: paymentId ?? enrollment.paymentId,
        confirmedAt: nextStatus === 'CONFIRMED' ? new Date() : null,
        waitlistRank: nextStatus === 'WAITLISTED' ? seats.waitlisted + 1 : null,
      },
      include: { batch: { include: { course: true } } },
    });

    if (nextStatus === 'CONFIRMED') {
      void this.notifyRegistrationConfirmed(tenantId, updated).catch(
        () => undefined,
      );
    }
    return updated;
  }

  private async notifyRegistrationConfirmed(tenantId: string, enrollment: any) {
    if (!this.communication) return;
    const student = await this.db().student.findFirst({
      where: { id: enrollment.studentId, tenantId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        masterProfile: { select: { fullName: true, email: true } },
      },
    });
    if (!student?.userId) return;
    const courseName = enrollment.batch?.course?.name ?? 'Short-term course';
    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    await this.communication.trigger({
      tenantId,
      templateCode: 'SHORT_TERM_REGISTRATION_CONFIRMED',
      triggerKey: 'SHORT_TERM_REGISTRATION_CONFIRMED',
      entityType: 'SHORT_TERM_ENROLLMENT',
      entityId: enrollment.id,
      recipient: {
        recipientType: 'STUDENT',
        userId: String(student.userId),
        studentId: enrollment.studentId,
        displayName:
          student.masterProfile?.fullName ??
          student.user?.displayName ??
          student.user?.email,
        email: student.masterProfile?.email ?? student.user?.email,
      },
      variables: {
        institution_name: institutionName,
        student_name:
          student.masterProfile?.fullName ??
          student.user?.displayName ??
          'Student',
        course_name: courseName,
        batch_code: enrollment.batch?.batchCode ?? '',
        status: enrollment.status,
        login_url: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
      },
      channels: ['EMAIL', 'IN_APP', 'PUSH'],
    });
  }

  async listEnrollments(
    tenantId: string,
    query: { batchId?: string; studentId?: string; status?: string } = {},
  ) {
    const rows = await this.db().shortTermEnrollment.findMany({
      where: {
        tenantId,
        ...(query.batchId ? { batchId: query.batchId } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        batch: { include: { course: true } },
        certificate: true,
      },
      orderBy: { registeredAt: 'desc' },
      take: 500,
    });

    const studentIds = [
      ...new Set(
        (rows as Array<{ studentId: string }>).map((r) => r.studentId),
      ),
    ];
    type StudentRow = {
      id: string;
      enrollmentNumber: string;
      rollNumber: string | null;
      masterProfile: { fullName: string | null } | null;
      user: { displayName: string | null; email: string | null } | null;
    };
    const students: StudentRow[] = studentIds.length
      ? ((await this.db().student.findMany({
          where: { tenantId, id: { in: studentIds }, deletedAt: null },
          select: {
            id: true,
            enrollmentNumber: true,
            rollNumber: true,
            masterProfile: { select: { fullName: true } },
            user: { select: { displayName: true, email: true } },
          },
        })) as StudentRow[])
      : [];
    const byId = new Map<string, StudentRow>(students.map((s) => [s.id, s]));

    return (rows as any[]).map((row) => {
      const student = byId.get(row.studentId);
      return {
        ...row,
        student: student
          ? {
              id: student.id,
              name:
                student.masterProfile?.fullName ??
                student.user?.displayName ??
                student.user?.email ??
                'Student',
              enrollmentNumber: student.enrollmentNumber,
              rollNumber: student.rollNumber,
            }
          : null,
      };
    });
  }

  async myLearning(user: JwtUser, studentId: string) {
    const enrollments = await this.listEnrollments(user.tid, { studentId });
    const catalogue = await this.catalogue(user.tid);
    return { catalogue, enrollments };
  }

  async studentAttendanceSummary(tenantId: string, enrollmentId: string) {
    const enrollment = await this.db().shortTermEnrollment.findFirst({
      where: { id: enrollmentId, tenantId },
      include: { batch: true },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    const sessions = await this.db().shortTermSession.count({
      where: { batchId: enrollment.batchId, tenantId },
    });
    const present = await this.db().shortTermAttendance.count({
      where: {
        enrollmentId,
        tenantId,
        status: { in: ['PRESENT', 'LATE'] },
      },
    });
    const percent = sessions > 0 ? Math.round((present / sessions) * 100) : 0;
    return { sessions, present, percent };
  }

  // ── Certificate eligibility + issue ──────────────────────────────────

  async checkCertificateEligibility(tenantId: string, enrollmentId: string) {
    const enrollment = await this.db().shortTermEnrollment.findFirst({
      where: { id: enrollmentId, tenantId },
      include: {
        batch: { include: { course: true, assessments: true } },
        certificate: true,
        results: true,
      },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (
      !CONFIRMED_STATUSES.includes(enrollment.status) &&
      enrollment.status !== 'COMPLETED'
    ) {
      return { eligible: false, reason: 'Enrollment is not confirmed.' };
    }

    const rules = (enrollment.batch.course.certRules ?? {}) as {
      minAttendancePercent?: number;
      passRequired?: boolean;
    };
    const attendance = await this.studentAttendanceSummary(
      tenantId,
      enrollmentId,
    );
    const minPct = Number(rules.minAttendancePercent ?? 80);
    if (attendance.percent < minPct) {
      return {
        eligible: false,
        reason: `Attendance ${attendance.percent}% is below required ${minPct}%.`,
        attendance,
      };
    }

    if (rules.passRequired !== false) {
      const required = (enrollment.batch.assessments ?? []).filter(
        (a: any) => a.required,
      );
      for (const a of required) {
        const result = (enrollment.results ?? []).find(
          (r: any) => r.assessmentId === a.id,
        );
        if (!result?.passed) {
          return {
            eligible: false,
            reason: `Assessment "${a.title}" not passed.`,
            attendance,
          };
        }
      }
    }

    return { eligible: true, attendance, existing: enrollment.certificate };
  }

  async issueCompletionCertificate(user: JwtUser, enrollmentId: string) {
    const check = await this.checkCertificateEligibility(
      user.tid,
      enrollmentId,
    );
    if (!check.eligible) {
      throw new BadRequestException(
        check.reason ?? 'Not eligible for certificate.',
      );
    }

    const enrollment = await this.db().shortTermEnrollment.findFirst({
      where: { id: enrollmentId, tenantId: user.tid },
      include: { batch: { include: { course: true } }, certificate: true },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (enrollment.certificate) {
      return { alreadyIssued: true, link: enrollment.certificate };
    }

    let category = await this.db().certificateCategory.findFirst({
      where: {
        tenantId: user.tid,
        code: 'SHORT_TERM_COMPLETION',
        deletedAt: null,
      },
    });
    if (!category) {
      category = await this.db().certificateCategory.create({
        data: {
          tenantId: user.tid,
          code: 'SHORT_TERM_COMPLETION',
          name: 'Short-Term Course Completion',
          group: 'ACADEMIC',
          description: 'Certificate of completion for short-term courses',
        },
      });
    }

    const course = enrollment.batch.course;
    const year = new Date().getFullYear();
    const seq = await this.db().certificateIssue.count({
      where: { tenantId: user.tid, categoryId: category.id },
    });
    const certificateNo = `STC/${course.code}/${year}/${String(seq + 1).padStart(4, '0')}`;
    const verificationToken = randomUUID();
    const variableSnapshot = await this.variables.buildStudentVariables(
      user.tid,
      enrollment.studentId,
      {
        programme: course.name,
        course_code: course.code,
        duration_days: String(course.durationDays),
        completion_date: new Date().toLocaleDateString('en-IN'),
        remarks: `Completed ${course.name} (${course.code})`,
        grade: 'Completed',
        certificate_number: certificateNo,
      },
      {
        verificationToken,
        certificateNo,
        categoryCode: 'SHORT_TERM_COMPLETION',
      },
    );

    const html = this.variables.renderTemplate(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
@page{size:A4 landscape;margin:12mm}
body{font-family:Georgia,serif;color:#1e3a5f;margin:0}
.wrap{border:3px double #1e3a5f;padding:18mm 16mm;min-height:170mm;position:relative}
h1{text-align:center;letter-spacing:2px;margin:0 0 6px;font-size:22px}
h2{text-align:center;letter-spacing:3px;margin:18px 0;font-size:18px;text-decoration:underline}
.meta{display:flex;justify-content:space-between;font-size:12px;margin-bottom:16px}
.body{font-size:14px;line-height:1.7;text-align:justify}
.footer{display:flex;justify-content:space-between;margin-top:36px;font-size:12px;text-align:center}
.footer div{min-width:28%}
.qr{text-align:center}
</style></head><body><div class="wrap">
  <h1>{{college_name_upper}}</h1>
  <p style="text-align:center;font-size:11px;margin:0">{{university_affiliation}} · {{naac_info}}</p>
  <h2>CERTIFICATE OF COMPLETION</h2>
  <div class="meta"><div>No. {{certificate_number}}</div><div>Verification: {{verification_id}}</div><div>{{date_of_issue}}</div></div>
  <div class="body">
    <p>This is to certify that <strong>{{student_title}} {{student_name}}</strong> has successfully completed the short-term programme
    <strong>{{programme}}</strong> ({{course_code}}) of duration <strong>{{duration_days}} days</strong> at {{college_name}}.</p>
    <p>Grade / Status: <strong>{{grade}}</strong>. Completion date: <strong>{{completion_date}}</strong>.</p>
  </div>
  <div class="footer">
    <div>{{registrar_block}}</div>
    <div class="qr">{{qr_code}}<div>{{verification_portal}}</div></div>
    <div>{{principal_signature_block}}</div>
  </div>
</div></body></html>`,
      variableSnapshot,
    );

    const issue = await this.db().certificateIssue.create({
      data: {
        tenantId: user.tid,
        categoryId: category.id,
        studentId: enrollment.studentId,
        certificateNo,
        renderedHtml: html,
        qrPayload: `/verify/certificates/${verificationToken}`,
        verificationToken,
        variableSnapshot,
        issuedById: user.sub,
      },
    });

    try {
      const document = await this.documents.persistCertificateDocument(
        user.tid,
        issue.id,
        html,
      );
      await this.db().certificateIssue.update({
        where: { id: issue.id },
        data: {
          pdfPath: document.primaryPath,
          metadata: { htmlPath: document.htmlPath, pdfPath: document.pdfPath },
        },
      });
    } catch {
      /* PDF optional if puppeteer unavailable */
    }

    const link = await this.db().shortTermCertificateLink.create({
      data: {
        tenantId: user.tid,
        enrollmentId: enrollment.id,
        certificateIssueId: issue.id,
      },
    });

    await this.db().shortTermEnrollment.update({
      where: { id: enrollment.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    void this.notifyCertificateReady(user.tid, enrollment, certificateNo).catch(
      () => undefined,
    );

    return { issue, link };
  }

  private async notifyCertificateReady(
    tenantId: string,
    enrollment: any,
    certificateNo: string,
  ) {
    if (!this.communication) return;
    const student = await this.db().student.findFirst({
      where: { id: enrollment.studentId, tenantId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        masterProfile: { select: { fullName: true, email: true } },
      },
    });
    if (!student?.userId) return;
    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    await this.communication.trigger({
      tenantId,
      templateCode: 'SHORT_TERM_CERTIFICATE_READY',
      triggerKey: 'SHORT_TERM_CERTIFICATE_READY',
      entityType: 'SHORT_TERM_ENROLLMENT',
      entityId: enrollment.id,
      recipient: {
        recipientType: 'STUDENT',
        userId: String(student.userId),
        studentId: enrollment.studentId,
        displayName:
          student.masterProfile?.fullName ??
          student.user?.displayName ??
          student.user?.email,
        email: student.masterProfile?.email ?? student.user?.email,
      },
      variables: {
        institution_name: institutionName,
        student_name:
          student.masterProfile?.fullName ??
          student.user?.displayName ??
          'Student',
        course_name: enrollment.batch?.course?.name ?? 'Short-term course',
        certificate_number: certificateNo,
        login_url: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
      },
      channels: ['EMAIL', 'IN_APP', 'PUSH'],
    });
  }

  // ── Dashboard / reports ──────────────────────────────────────────────

  async dashboard(tenantId: string) {
    const [
      activeCourses,
      completedBatches,
      enrollments,
      certificates,
      upcoming,
    ] = await Promise.all([
      this.db().shortTermCourse.count({
        where: { tenantId, status: 'PUBLISHED', deletedAt: null },
      }),
      this.db().shortTermBatch.count({
        where: { tenantId, status: 'COMPLETED' },
      }),
      this.db().shortTermEnrollment.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.db().shortTermCertificateLink.count({ where: { tenantId } }),
      this.db().shortTermSession.findMany({
        where: {
          tenantId,
          startsAt: { gte: new Date() },
        },
        orderBy: { startsAt: 'asc' },
        take: 8,
        include: { batch: { include: { course: true } } },
      }),
    ]);

    const registrationCount = enrollments.reduce(
      (s: number, r: any) => s + Number(r._count?._all ?? 0),
      0,
    );
    const confirmed = enrollments
      .filter(
        (r: any) =>
          CONFIRMED_STATUSES.includes(r.status) || r.status === 'COMPLETED',
      )
      .reduce((s: number, r: any) => s + Number(r._count?._all ?? 0), 0);

    const paidEnrollments = await this.db().shortTermEnrollment.findMany({
      where: {
        tenantId,
        status: { in: [...CONFIRMED_STATUSES, 'COMPLETED', 'PAYMENT_PENDING'] },
        demandId: { not: null },
      },
      select: { demandId: true },
      take: 2000,
    });
    let revenue = 0;
    if (paidEnrollments.length) {
      const demands = await this.db().studentFeeDemand.findMany({
        where: {
          tenantId,
          id: {
            in: paidEnrollments.map((e: any) => e.demandId).filter(Boolean),
          },
        },
        select: { paidAmount: true },
      });
      revenue = demands.reduce(
        (s: number, d: any) => s + Number(d.paidAmount ?? 0),
        0,
      );
    }

    return {
      activeCourses,
      completedBatches,
      registrations: registrationCount,
      confirmed,
      revenue,
      certificatesIssued: certificates,
      upcomingClasses: upcoming,
      byStatus: enrollments,
    };
  }

  async seedDemoCourses(user: JwtUser) {
    const demos = [
      {
        code: 'CAFA',
        name: 'Certificate Course in Chik Folk Arts',
        shortName: 'CAFA',
        durationDays: 30,
        fee: 500,
        seats: 40,
        description:
          'An introductory certificate programme in traditional Chik folk arts of the Garo Hills region.',
      },
      {
        code: 'BCCS',
        name: 'Basic Course on Computer Skills',
        shortName: 'BCCS',
        durationDays: 30,
        fee: 500,
        seats: 40,
        description:
          'Foundational computer literacy covering office tools, internet, and digital safety.',
      },
      {
        code: 'ELPC',
        name: 'English Language Proficiency Course',
        shortName: 'ELPC',
        durationDays: 45,
        fee: 750,
        seats: 35,
        description:
          'Intensive spoken and written English for academic and professional contexts.',
      },
      {
        code: 'BCCH',
        name: 'Basic Course in Computer Hardware',
        shortName: 'BCCH',
        durationDays: 30,
        fee: 800,
        seats: 30,
        description:
          'Hands-on introduction to PC components, assembly, troubleshooting, and maintenance.',
      },
      {
        code: 'BCTE',
        name: 'Basic Course in Tally',
        shortName: 'BCTE',
        durationDays: 30,
        fee: 600,
        seats: 40,
        description:
          'Practical Tally ERP fundamentals for accounting, GST, and small-business bookkeeping.',
      },
    ];

    const created = [];
    for (const demo of demos) {
      const existing = await this.db().shortTermCourse.findFirst({
        where: { tenantId: user.tid, code: demo.code, deletedAt: null },
      });
      if (existing) {
        created.push(existing);
        continue;
      }
      const course = await this.db().shortTermCourse.create({
        data: {
          tenantId: user.tid,
          createdById: user.sub,
          code: demo.code,
          name: demo.name,
          shortName: demo.shortName,
          description: demo.description,
          objectives: demo.description,
          outcomes: [
            'Demonstrate core competencies of the programme',
            'Complete continuous assessment and practical tasks',
            'Qualify for a college-issued certificate of completion',
          ],
          mode: 'OFFLINE',
          durationDays: demo.durationDays,
          totalHours: demo.durationDays,
          sessionsCount: Math.ceil(demo.durationDays / 2),
          feeType: 'PAID',
          fees: {
            registrationFee: 0,
            courseFee: demo.fee,
            gst: 0,
            lateFee: 100,
            currency: 'INR',
          },
          eligibility: { scope: 'ALL' },
          maxSeats: demo.seats,
          certRules: { minAttendancePercent: 80, passRequired: true },
          status: 'PUBLISHED',
        },
      });
      const start = new Date();
      start.setDate(start.getDate() + 7);
      const end = new Date(start);
      end.setDate(end.getDate() + demo.durationDays);
      const regStart = new Date();
      const regEnd = new Date(start);
      regEnd.setDate(regEnd.getDate() - 1);
      await this.db().shortTermBatch.create({
        data: {
          tenantId: user.tid,
          courseId: course.id,
          batchCode: `${demo.code}-2026-A`,
          regStartAt: regStart,
          regEndAt: regEnd,
          courseStartAt: start,
          courseEndAt: end,
          classroom: 'Seminar Hall',
          status: 'OPEN',
        },
      });
      created.push(course);
    }
    return { count: created.length, courses: created };
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private async requireBatch(tenantId: string, id: string) {
    const batch = await this.db().shortTermBatch.findFirst({
      where: { id, tenantId },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  private isRegistrationOpen(batch: {
    regStartAt?: Date | null;
    regEndAt?: Date | null;
    status?: string;
  }) {
    if (['CLOSED', 'COMPLETED', 'CANCELLED'].includes(batch.status ?? '')) {
      return false;
    }
    const now = Date.now();
    if (batch.regStartAt && new Date(batch.regStartAt).getTime() > now)
      return false;
    if (batch.regEndAt && new Date(batch.regEndAt).getTime() < now)
      return false;
    return true;
  }

  private async seatSnapshot(
    tenantId: string,
    batchId: string,
    maxSeats: number,
  ) {
    const confirmed = await this.db().shortTermEnrollment.count({
      where: {
        tenantId,
        batchId,
        status: { in: [...CONFIRMED_STATUSES, 'COMPLETED', 'PAYMENT_PENDING'] },
      },
    });
    const waitlisted = await this.db().shortTermEnrollment.count({
      where: { tenantId, batchId, status: 'WAITLISTED' },
    });
    const available = Math.max(0, maxSeats - confirmed);
    return { maxSeats, registered: confirmed, available, waitlisted };
  }

  private async assertEligibility(
    tenantId: string,
    studentId: string,
    eligibility: any,
  ) {
    const scope = String(eligibility?.scope ?? 'ALL').toUpperCase();
    if (scope === 'ALL') return;

    const student = await this.db().student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        programVersion: { include: { program: true } },
        academicStanding: true,
        department: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (
      Array.isArray(eligibility?.departmentIds) &&
      eligibility.departmentIds.length
    ) {
      if (!eligibility.departmentIds.includes(student.departmentId)) {
        throw new BadRequestException(
          'Your department is not eligible for this course.',
        );
      }
    }
    if (
      Array.isArray(eligibility?.programmeIds) &&
      eligibility.programmeIds.length
    ) {
      const programId = student.programVersion?.program?.id;
      if (!programId || !eligibility.programmeIds.includes(programId)) {
        throw new BadRequestException(
          'Your programme is not eligible for this course.',
        );
      }
    }
    if (Array.isArray(eligibility?.semesters) && eligibility.semesters.length) {
      const sem = student.academicStanding?.currentSemesterSequence;
      if (!sem || !eligibility.semesters.includes(sem)) {
        throw new BadRequestException(
          'Your semester is not eligible for this course.',
        );
      }
    }
  }

  private async ensureDemand(
    user: JwtUser,
    enrollment: any,
    amount: number,
    course: any,
  ) {
    if (enrollment.demandId) {
      const existing = await this.db().studentFeeDemand.findFirst({
        where: { id: enrollment.demandId, tenantId: user.tid },
      });
      if (existing && existing.status !== 'CANCELLED') return existing;
    }

    const demandNo = `STC-${course.code}-${Date.now().toString().slice(-6)}`;
    return this.db().studentFeeDemand.create({
      data: {
        tenantId: user.tid,
        studentId: enrollment.studentId,
        demandNo,
        demandType: 'SHORT_TERM_COURSE',
        feeProductCode: 'SHORT_TERM_COURSE',
        billingLayer: 'ONE_TIME',
        status: 'PUBLISHED',
        totalAmount: amount,
        balanceAmount: amount,
        publishedAt: new Date(),
        generatedById: user.sub,
        metadata: {
          shortTermEnrollmentId: enrollment.id,
          courseCode: course.code,
          batchId: enrollment.batchId,
        },
        lines: {
          create: [
            {
              tenantId: user.tid,
              code: 'STC_FEE',
              name: `${course.name} fee`,
              category: 'SHORT_TERM_COURSE',
              quantity: 1,
              unitAmount: amount,
              amount,
              sourceType: 'SHORT_TERM_COURSE',
              sourceRefId: enrollment.id,
            },
          ],
        },
      },
    });
  }

  async resolveStudentIdForUser(user: JwtUser) {
    const student = await this.db().student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      throw new BadRequestException(
        'No student profile linked to this account.',
      );
    }
    return student.id;
  }
}
