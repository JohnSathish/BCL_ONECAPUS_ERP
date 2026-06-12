import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { AcademicEngineService } from '../../academic-engine/academic-engine.service';
import { StudentDisplaySettingsService } from '../../administration/services/student-display-settings.service';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';
import { ExaminationsService } from '../../examinations/examinations.service';
import { FeeLedgerService } from '../../fees/services/fee-ledger.service';
import { LibraryQrService } from '../../library/services/library-qr.service';
import { LmsDashboardService } from '../../lms/services/lms-dashboard.service';
import { StudentAttendanceService } from '../../student-attendance/student-attendance.service';
import { TimetableEngineService } from '../../timetable-engine/timetable-engine.service';
import { StudentsService } from '../students.service';
import { StudentPortalCalendarService } from './student-portal-calendar.service';

const SNAPSHOT_CATEGORY_LABELS: Record<string, string> = {
  MAJOR: 'Major',
  MINOR: 'Minor',
  MDC: 'MDC',
  AEC: 'AEC',
  SEC: 'SEC',
  VAC: 'VAC',
};

const REGISTRATION_COMPLETE = new Set([
  'submitted',
  'pending_approval',
  'approved',
  'completed',
  'confirmed',
]);

function parseTimeToMinutes(time: string): number | null {
  const raw = String(time ?? '').trim();
  const match12 = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match12) {
    let hour = Number(match12[1]);
    const minute = Number(match12[2]);
    const period = match12[3]?.toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
  }
  const match24 = raw.match(/^(\d{1,2}):(\d{2})/);
  if (match24) return Number(match24[1]) * 60 + Number(match24[2]);
  return null;
}

function isCurrentSlot(startTime: string, endTime: string) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) return false;
  const current = new Date().getHours() * 60 + new Date().getMinutes();
  return current >= start && current < end;
}

function isPastSlot(endTime: string) {
  const end = parseTimeToMinutes(endTime);
  if (end == null) return false;
  return new Date().getHours() * 60 + new Date().getMinutes() >= end;
}

@Injectable()
export class StudentPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
    private readonly displaySettings: StudentDisplaySettingsService,
    private readonly attendance: StudentAttendanceService,
    private readonly fees: FeeLedgerService,
    private readonly timetable: TimetableEngineService,
    private readonly lms: LmsDashboardService,
    private readonly examinations: ExaminationsService,
    private readonly notifications: UserNotificationsService,
    private readonly libraryQr: LibraryQrService,
    private readonly academicEngine: AcademicEngineService,
    private readonly calendar: StudentPortalCalendarService,
  ) {}

  async resolveStudent(user: JwtUser) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      include: {
        masterProfile: true,
        department: { select: { id: true, name: true } },
        programVersion: { include: { program: { select: { name: true } } } },
      },
    });
    if (!student) {
      throw new NotFoundException(
        'No student profile is linked to this portal account. Contact the office to link your account.',
      );
    }
    return student;
  }

  async getMe(user: JwtUser) {
    const student = await this.resolveStudent(user);
    const format = await this.displaySettings.getFormat(user.tid);
    const displayName = this.displaySettings.formatName(
      student.masterProfile?.fullName,
      format,
    );
    return {
      id: student.id,
      fullName: student.masterProfile?.fullName ?? '',
      displayFullName: displayName,
      enrollmentNumber: student.enrollmentNumber,
      photoUrl: student.masterProfile?.photoPath ?? null,
      rfidNumber: student.rfidNumber,
      department: student.department?.name ?? null,
      programName: student.programVersion?.program?.name ?? null,
    };
  }

  async getHealth(user: JwtUser) {
    const student = await this.resolveStudent(user);
    return this.students.getStudentHealth(user, student.id);
  }

  async getDashboard(user: JwtUser) {
    const student = await this.resolveStudent(user);
    const format = await this.displaySettings.getFormat(user.tid);

    const [
      registration,
      attendance,
      ledger,
      weekTimetable,
      lmsDashboard,
      examResults,
      notifications,
      unreadCount,
      health,
      qrPass,
      loans,
      fines,
      certIssues,
      calendarEvents,
    ] = await Promise.all([
      this.academicEngine
        .getMyRegistration(user.tid, user.sub)
        .catch(() => null),
      this.attendance.studentPortalSummary(user),
      this.fees.myLedger(user.tid, user.sub),
      this.timetable.studentWeek(user),
      this.lms.studentDashboard(user).catch(() => null),
      this.examinations.studentResults(user).catch(() => ({
        summaries: [],
        marks: [],
        papers: [],
      })),
      this.notifications.list(user, 8),
      this.notifications.unreadCount(user),
      this.students.getStudentHealth(user, student.id).catch(() => null),
      this.libraryQr.getStudentQr(user).catch(() => null),
      this.prisma.libraryLoan.findMany({
        where: {
          tenantId: user.tid,
          studentId: student.id,
          status: { in: ['ACTIVE', 'OVERDUE'] },
          returnedAt: null,
        },
        select: { id: true },
      }),
      this.prisma.libraryFine.findMany({
        where: {
          tenantId: user.tid,
          paidAt: null,
          waivedAt: null,
          loan: { studentId: student.id },
        },
        select: { amount: true },
      }),
      this.prisma.certificateIssue.findMany({
        where: {
          tenantId: user.tid,
          studentId: student.id,
          status: 'ISSUED',
          revokedAt: null,
        },
        select: { id: true },
      }),
      this.calendar.buildForStudent(user.tid, student.id, { monthsSpan: 3 }),
    ]);

    const overallAttendance =
      attendance.overall != null ? Number(attendance.overall) : null;
    const demands = ledger?.demands ?? [];
    const feeDue = demands.reduce(
      (sum: number, d: { balanceAmount?: unknown }) =>
        sum + Number(d.balanceAmount ?? 0),
      0,
    );
    const feePaid = demands.reduce(
      (sum: number, d: { paidAmount?: unknown }) =>
        sum + Number(d.paidAmount ?? 0),
      0,
    );
    const semesterSequence =
      registration?.standing?.currentSemesterSequence ??
      registration?.registration?.semesterSequence ??
      null;
    const registrationComplete = REGISTRATION_COMPLETE.has(
      String(registration?.registration?.status ?? '').toLowerCase(),
    );
    const majorMinor = registration?.majorMinorTrack;
    const headerDepartment = await this.resolveHeaderMajorDepartment(
      user.tid,
      registration,
      majorMinor,
      student,
    );

    const libraryFinesDue = fines.reduce(
      (sum, f) => sum + Number(f.amount ?? 0),
      0,
    );
    const certAvailable = certIssues.length;
    const lmsCards = (lmsDashboard?.cards ?? {}) as Record<
      string,
      number | undefined
    >;
    const summaries = examResults?.summaries ?? [];
    const latestSgpa =
      summaries[0]?.sgpa != null ? Number(summaries[0].sgpa) : null;

    const displayName = this.displaySettings.formatName(
      student.masterProfile?.fullName,
      format,
    );

    const profileCompletion = this.profileCompletion({
      hasPhoto: Boolean(student.masterProfile?.photoPath),
      hasMobile: Boolean(student.masterProfile?.mobileNumber),
      hasRfid: Boolean(student.rfidNumber),
      registrationComplete,
      feesClear: feeDue <= 0,
    });

    const today = new Date().getDay();
    const entries = weekTimetable?.entries ?? [];
    const offeringIds = [
      ...new Set(
        entries
          .map((e: { courseOfferingId?: string | null }) => e.courseOfferingId)
          .filter(Boolean),
      ),
    ] as string[];
    const offerings =
      offeringIds.length > 0
        ? await this.prisma.courseOffering.findMany({
            where: { tenantId: user.tid, id: { in: offeringIds } },
            include: { course: { select: { code: true, title: true } } },
          })
        : [];
    const offeringMap = new Map(offerings.map((o) => [o.id, o]));

    const todayTimetable = entries
      .filter((e: { dayOfWeek: number }) => e.dayOfWeek === today)
      .sort(
        (a: { startTime: string }, b: { startTime: string }) =>
          (parseTimeToMinutes(a.startTime) ?? 0) -
          (parseTimeToMinutes(b.startTime) ?? 0),
      )
      .map((entry: Record<string, unknown>) => {
        const offering = entry.courseOfferingId
          ? offeringMap.get(String(entry.courseOfferingId))
          : null;
        const startTime = String(entry.startTime ?? '');
        const endTime = String(entry.endTime ?? '');
        return {
          ...entry,
          course: offering?.course
            ? { code: offering.course.code, title: offering.course.title }
            : null,
          isCurrent: isCurrentSlot(startTime, endTime),
          isPast: isPastSlot(endTime),
        };
      });

    const academicChips = this.academicSnapshotChips(registration, majorMinor);

    const attendanceTone =
      overallAttendance == null
        ? 'neutral'
        : overallAttendance >= 75
          ? 'good'
          : overallAttendance >= 65
            ? 'warn'
            : 'bad';

    return {
      profile: {
        studentId: student.id,
        fullName: student.masterProfile?.fullName ?? '',
        displayFullName: displayName,
        enrollmentNumber: student.enrollmentNumber,
        photoUrl: student.masterProfile?.photoPath ?? null,
        programLabel: headerDepartment,
        department: headerDepartment,
        semesterSequence,
        academicYear: weekTimetable?.plan?.name ?? null,
        rfidStatus: student.rfidNumber
          ? ('assigned' as const)
          : ('missing' as const),
        profileCompletion,
      },
      quickStats: [
        {
          key: 'attendance',
          title: 'Attendance',
          value:
            overallAttendance != null
              ? `${overallAttendance.toFixed(0)}%`
              : '—',
          tone: attendanceTone,
          href: '/student/attendance',
        },
        {
          key: 'semester',
          title: 'Current Semester',
          value:
            semesterSequence != null ? `Semester ${semesterSequence}` : '—',
          tone: 'neutral',
        },
        {
          key: 'fees',
          title: 'Fee Status',
          value: feeDue > 0 ? `Pending ₹${feeDue.toLocaleString()}` : 'PAID',
          tone: feeDue > 0 ? 'warn' : 'good',
          href: '/student/fees',
        },
        {
          key: 'library',
          title: 'Library Books',
          value: `${loans.length} Issued`,
          tone: 'neutral',
          href: '/student/library',
        },
        {
          key: 'certificates',
          title: 'Certificates',
          value: `${certAvailable} Available`,
          tone: 'neutral',
          href: '/student/certificates',
        },
        {
          key: 'cgpa',
          title: 'CGPA',
          value: latestSgpa != null ? String(latestSgpa) : '—',
          tone: latestSgpa != null && latestSgpa >= 7 ? 'good' : 'neutral',
          href: '/student/results',
        },
      ],
      academicChips,
      todayTimetable,
      attendance: {
        overall: overallAttendance,
        subjects: (attendance.subjects ?? []).map(
          (s: Record<string, unknown>) => ({
            id: String(s.id ?? s.courseId ?? ''),
            label: String(s.courseName ?? s.courseId ?? 'Subject').slice(0, 40),
            percentage: Number(s.percentage ?? 0),
          }),
        ),
        alerts: attendance.alerts ?? [],
      },
      fees: {
        paid: feePaid,
        due: feeDue,
        status: feeDue > 0 ? ('PENDING' as const) : ('PAID' as const),
        semesterLabel:
          demands.find(
            (d: { balanceAmount?: number }) => Number(d.balanceAmount) > 0,
          )?.billingPeriod ?? 'Current semester',
      },
      lms: {
        pendingAssignments: Number(lmsCards.assignmentsDue ?? 0),
        notesAvailable: Number(lmsCards.notesAvailable ?? 0),
        upcomingTests: Number(lmsCards.quizzesPending ?? 0),
      },
      examinations: {
        hasResults: summaries.length > 0,
        hasAdmitCard: Boolean(examResults),
        cgpa: latestSgpa,
      },
      library: { issuedBooks: loans.length, finesDue: libraryFinesDue },
      certificates: { available: certAvailable },
      health: health
        ? {
            score: health.score.score,
            label: health.score.label,
            tone: health.score.tone,
            signals: health.signals,
          }
        : {
            score: profileCompletion,
            label: 'Profile completion',
            tone: 'warn' as const,
            signals: [],
          },
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type ?? 'notice',
        title: n.title,
        body: n.body ?? '',
        createdAt: n.createdAt?.toISOString?.() ?? String(n.createdAt),
        read: Boolean(n.readAt),
        link: n.link ?? null,
      })),
      unreadNotificationCount: unreadCount.count ?? 0,
      calendarEvents,
      qrPass,
    };
  }

  private profileCompletion(input: {
    hasPhoto: boolean;
    hasMobile: boolean;
    hasRfid: boolean;
    registrationComplete: boolean;
    feesClear: boolean;
  }) {
    let score = 0;
    if (input.hasPhoto) score += 25;
    if (input.hasMobile) score += 15;
    if (input.hasRfid) score += 20;
    if (input.registrationComplete) score += 25;
    if (input.feesClear) score += 15;
    return Math.min(100, score);
  }

  private async resolveHeaderMajorDepartment(
    tenantId: string,
    registration: Awaited<
      ReturnType<AcademicEngineService['getMyRegistration']>
    > | null,
    majorMinor?: {
      majorSubject?: { id: string; name: string };
      minorSubject?: { id: string; name: string } | null;
    } | null,
    student?: {
      department?: { name: string } | null;
      programVersion?: { program?: { name: string } | null } | null;
    },
  ) {
    const lines = registration?.registration?.lines ?? [];
    const majorLine = lines.find(
      (l) => String(l.category ?? '').toUpperCase() === 'MAJOR',
    );
    const majorCourseId = majorLine?.offering?.course?.id;

    const subjectIds = majorMinor?.majorSubject?.id
      ? [majorMinor.majorSubject.id]
      : [];

    const [majorCourse, majorSubject] = await Promise.all([
      majorCourseId
        ? this.prisma.course.findFirst({
            where: { tenantId, id: majorCourseId },
            include: { department: { select: { name: true } } },
          })
        : Promise.resolve(null),
      subjectIds.length
        ? this.prisma.academicSubject.findFirst({
            where: { tenantId, id: subjectIds[0] },
            include: { department: { select: { name: true } } },
          })
        : Promise.resolve(null),
    ]);

    return (
      majorSubject?.department?.name ??
      student?.department?.name ??
      majorCourse?.department?.name ??
      majorMinor?.majorSubject?.name ??
      majorLine?.offering?.course?.title ??
      student?.programVersion?.program?.name ??
      'Programme'
    );
  }

  private academicSnapshotChips(
    registration: Awaited<
      ReturnType<AcademicEngineService['getMyRegistration']>
    > | null,
    majorMinor?: {
      majorSubject?: { name: string };
      minorSubject?: { name: string } | null;
    } | null,
  ) {
    const chips: { category: string; label: string; courseTitle: string }[] =
      [];
    const lines = registration?.registration?.lines ?? [];

    for (const line of lines) {
      const category = String(line.category ?? '').toUpperCase();
      if (['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC'].includes(category)) {
        chips.push({
          category,
          label: SNAPSHOT_CATEGORY_LABELS[category] ?? category,
          courseTitle:
            line.offering?.course?.title ?? line.offering?.course?.code ?? '—',
        });
      }
    }

    if (
      !chips.some((c) => c.category === 'MAJOR') &&
      majorMinor?.majorSubject
    ) {
      chips.unshift({
        category: 'MAJOR',
        label: SNAPSHOT_CATEGORY_LABELS.MAJOR,
        courseTitle: majorMinor.majorSubject.name,
      });
    }
    if (
      !chips.some((c) => c.category === 'MINOR') &&
      majorMinor?.minorSubject
    ) {
      chips.push({
        category: 'MINOR',
        label: SNAPSHOT_CATEGORY_LABELS.MINOR,
        courseTitle: majorMinor.minorSubject.name,
      });
    }

    const order = ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC'];
    return chips.sort(
      (a, b) => order.indexOf(a.category) - order.indexOf(b.category),
    );
  }
}
