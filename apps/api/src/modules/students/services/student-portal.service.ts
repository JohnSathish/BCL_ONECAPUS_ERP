import { Injectable, NotFoundException } from '@nestjs/common';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { AcademicEngineService } from '../../academic-engine/academic-engine.service';
import { StudentDisplaySettingsService } from '../../administration/services/student-display-settings.service';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';
import { BirthdayQueryService } from '../../communication/services/birthday-query.service';
import { ExaminationsService } from '../../examinations/examinations.service';
import { StudentFeeSummaryService } from '../../fees/services/student-fee-summary.service';
import { LibraryQrService } from '../../library/services/library-qr.service';
import { LmsDashboardService } from '../../lms/services/lms-dashboard.service';
import { StudentAttendanceService } from '../../student-attendance/student-attendance.service';
import { TimetableEngineService } from '../../timetable-engine/timetable-engine.service';
import { StudentsService } from '../students.service';
import { StudentPortalCalendarService } from './student-portal-calendar.service';
import { getZonedWeekday } from '../../../common/utils/time-greeting';

const SNAPSHOT_CATEGORY_LABELS: Record<string, string> = {
  MAJOR: 'Major',
  MINOR: 'Minor',
  MDC: 'MDC',
  AEC: 'AEC',
  SEC: 'SEC',
  VAC: 'VAC',
  VTC: 'VTC',
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

/** Normalize timetable times to "09:45 AM" (drop seconds / ISO noise). */
function formatDisplayTime(time: string): string {
  const raw = String(time ?? '').trim();
  if (!raw) return '—';
  const mins = parseTimeToMinutes(raw);
  if (mins == null) {
    return raw.replace(/:(\d{2}):\d{2}\b/, ':$1').replace(/\s+/g, ' ');
  }
  const hour24 = Math.floor(mins / 60);
  const minute = mins % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
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
    private readonly feeSummary: StudentFeeSummaryService,
    private readonly timetable: TimetableEngineService,
    private readonly lms: LmsDashboardService,
    private readonly examinations: ExaminationsService,
    private readonly notifications: UserNotificationsService,
    private readonly libraryQr: LibraryQrService,
    private readonly academicEngine: AcademicEngineService,
    private readonly calendar: StudentPortalCalendarService,
    private readonly birthdays: BirthdayQueryService,
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
      rollNumber: student.rollNumber,
      universityRollNumber: student.universityRollNumber,
      universityRegistrationNumber: student.universityRegistrationNumber,
      photoUrl: toPublicUploadUrl(student.masterProfile?.photoPath),
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
      feeSummaryRow,
      unreadCount,
      attendancePct,
      academicYear,
      examResults,
      libraryLoans,
      primaryShift,
    ] = await Promise.all([
      this.academicEngine
        .getMyRegistration(user.tid, user.sub)
        .catch(() => null),
      this.feeSummary.get(user.tid, student.id),
      this.notifications.unreadCount(user),
      this.attendance
        .studentPortalSummary(user)
        .then((a) => (a.overall != null ? Number(a.overall) : null)),
      this.prisma.academicYear.findFirst({
        where: {
          tenantId: user.tid,
          deletedAt: null,
          OR: [{ status: 'ACTIVE' }, { isPrimarySession: true }],
        },
        select: { name: true },
        orderBy: { startDate: 'desc' },
      }),
      this.examinations.studentResults(user).catch(() => null),
      this.prisma.libraryLoan.findMany({
        where: {
          tenantId: user.tid,
          studentId: student.id,
          status: { in: ['ACTIVE', 'OVERDUE'] },
          returnedAt: null,
        },
        select: { id: true, dueAt: true },
        orderBy: { dueAt: 'asc' },
        take: 20,
      }),
      student.primaryShiftId
        ? this.prisma.shift.findFirst({
            where: { id: student.primaryShiftId, tenantId: user.tid },
            select: { id: true, name: true, code: true },
          })
        : Promise.resolve(null),
    ]);

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

    const displayName = this.displaySettings.formatName(
      student.masterProfile?.fullName,
      format,
    );

    const feeDue = feeSummaryRow.totalOutstanding;
    const feePaid = feeSummaryRow.totalPaid;

    const profileCompletion = this.profileCompletion({
      hasPhoto: Boolean(student.masterProfile?.photoPath),
      hasMobile: Boolean(student.masterProfile?.mobileNumber),
      hasRfid: Boolean(student.rfidNumber),
      registrationComplete,
      feesClear: feeDue <= 0,
    });

    const academicChips = await this.withFacultyNames(
      user.tid,
      this.academicSnapshotChips(registration, majorMinor),
      registration,
    );

    const attendanceTone =
      attendancePct == null
        ? 'neutral'
        : attendancePct >= 75
          ? 'good'
          : attendancePct >= 65
            ? 'warn'
            : 'bad';

    const summaries = examResults?.summaries ?? [];
    const cgpa = summaries[0]?.sgpa != null ? Number(summaries[0].sgpa) : null;

    const nextDue = libraryLoans.find((l) => l.dueAt)?.dueAt ?? null;
    let libraryDueInDays: number | null = null;
    if (nextDue) {
      const ms = new Date(nextDue).getTime() - Date.now();
      libraryDueInDays = Math.ceil(ms / 86_400_000);
    }

    return {
      profile: {
        studentId: student.id,
        fullName: student.masterProfile?.fullName ?? '',
        displayFullName: displayName,
        enrollmentNumber: student.enrollmentNumber,
        rollNumber: student.rollNumber,
        universityRollNumber: student.universityRollNumber,
        universityRegistrationNumber: student.universityRegistrationNumber,
        photoUrl: toPublicUploadUrl(student.masterProfile?.photoPath),
        programLabel: headerDepartment,
        department: headerDepartment,
        semesterSequence,
        academicYear: academicYear?.name ?? null,
        shiftId: primaryShift?.id ?? student.primaryShiftId ?? null,
        shiftName: primaryShift?.name ?? null,
        shiftCode: primaryShift?.code ?? null,
        rfidStatus: student.rfidNumber
          ? ('assigned' as const)
          : ('missing' as const),
        profileCompletion,
      },
      quickStats: [
        {
          key: 'attendance',
          title: 'Attendance',
          value: attendancePct != null ? `${attendancePct.toFixed(0)}%` : '—',
          tone: attendanceTone,
          href: '/student/attendance',
        },
        {
          key: 'fees',
          title: 'Fee Status',
          value: feeDue > 0 ? `Pending ₹${feeDue.toLocaleString()}` : 'PAID',
          tone: feeDue > 0 ? 'warn' : 'good',
          href: '/student/fees',
        },
        {
          key: 'cgpa',
          title: 'CGPA',
          value: cgpa != null && !Number.isNaN(cgpa) ? cgpa.toFixed(2) : '—',
          tone: 'neutral',
          href: '/student/results',
        },
        {
          key: 'credits',
          title: 'Credits Earned',
          value: '—',
          tone: 'neutral',
          href: '/student/registration',
        },
        {
          key: 'library',
          title: 'Library Books',
          value: String(libraryLoans.length),
          subvalue:
            libraryDueInDays != null
              ? libraryDueInDays >= 0
                ? `Due in ${libraryDueInDays} day${libraryDueInDays === 1 ? '' : 's'}`
                : `Overdue by ${Math.abs(libraryDueInDays)} day${Math.abs(libraryDueInDays) === 1 ? '' : 's'}`
              : libraryLoans.length
                ? 'Books issued'
                : 'No books issued',
          tone:
            libraryDueInDays != null && libraryDueInDays < 0
              ? 'bad'
              : 'neutral',
          href: '/student/library',
        },
      ],
      academicChips,
      unreadNotificationCount: unreadCount.count ?? 0,
      fees: {
        paid: feePaid,
        due: feeDue,
        status: feeDue > 0 ? ('PENDING' as const) : ('PAID' as const),
        semesterLabel: 'Current semester',
      },
      examinations: {
        hasResults: summaries.length > 0,
        hasAdmitCard: Boolean(examResults),
        cgpa,
      },
      library: {
        issuedBooks: libraryLoans.length,
        finesDue: 0,
        dueInDays: libraryDueInDays,
      },
    };
  }

  async getDashboardWidgetAttendance(user: JwtUser) {
    return this.attendance.studentPortalSummary(user);
  }

  async getDashboardWidgetFees(user: JwtUser) {
    const student = await this.resolveStudent(user);
    const summary = await this.feeSummary.get(user.tid, student.id);
    return {
      paid: summary.totalPaid,
      due: summary.totalOutstanding,
      status: summary.totalOutstanding > 0 ? 'PENDING' : 'PAID',
      semesterLabel: 'Current semester',
    };
  }

  async getDashboardWidgetTimetable(user: JwtUser) {
    const student = await this.resolveStudent(user);
    const weekTimetable = await this.timetable.studentWeek(user);
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

    const todayEntries = entries
      .filter((e: { dayOfWeek: number }) => e.dayOfWeek === today)
      .sort(
        (a: { startTime: string }, b: { startTime: string }) =>
          (parseTimeToMinutes(a.startTime) ?? 0) -
          (parseTimeToMinutes(b.startTime) ?? 0),
      );

    const staffIds = [
      ...new Set(
        todayEntries
          .map((e: { staffProfileId?: string | null }) => e.staffProfileId)
          .filter(Boolean),
      ),
    ] as string[];
    const classroomIds = [
      ...new Set(
        todayEntries
          .map((e: { classroomId?: string | null }) => e.classroomId)
          .filter(Boolean),
      ),
    ] as string[];

    const [staffRows, classroomRows] = await Promise.all([
      staffIds.length
        ? this.prisma.staffProfile.findMany({
            where: { tenantId: user.tid, id: { in: staffIds } },
            select: { id: true, fullName: true, shortCode: true },
          })
        : Promise.resolve([]),
      classroomIds.length
        ? this.prisma.classroom.findMany({
            where: { tenantId: user.tid, id: { in: classroomIds } },
            select: { id: true, code: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const staffMap = new Map(staffRows.map((s) => [s.id, s]));
    const classroomMap = new Map(classroomRows.map((c) => [c.id, c]));

    return todayEntries.map((entry: Record<string, unknown>) => {
      const offering = entry.courseOfferingId
        ? offeringMap.get(String(entry.courseOfferingId))
        : null;
      const startTime = String(entry.startTime ?? '');
      const endTime = String(entry.endTime ?? '');
      const staff = entry.staffProfileId
        ? staffMap.get(String(entry.staffProfileId))
        : null;
      const classroom = entry.classroomId
        ? classroomMap.get(String(entry.classroomId))
        : null;
      return {
        ...entry,
        course: offering?.course
          ? { code: offering.course.code, title: offering.course.title }
          : null,
        staffProfile: staff
          ? { fullName: staff.fullName, shortCode: staff.shortCode }
          : null,
        classroom: classroom
          ? { code: classroom.code, name: classroom.name }
          : null,
        isCurrent: isCurrentSlot(startTime, endTime),
        isPast: isPastSlot(endTime),
      };
    });
  }

  async getDashboardWidgetLms(user: JwtUser) {
    const lmsDashboard = await this.lms
      .studentDashboard(user)
      .catch(() => null);
    const lmsCards = (lmsDashboard?.cards ?? {}) as Record<
      string,
      number | undefined
    >;
    return {
      pendingAssignments: Number(lmsCards.assignmentsDue ?? 0),
      notesAvailable: Number(lmsCards.notesAvailable ?? 0),
      upcomingTests: Number(lmsCards.quizzesPending ?? 0),
    };
  }

  async getDashboardWidgetExaminations(user: JwtUser) {
    const examResults = await this.examinations
      .studentResults(user)
      .catch(() => ({
        summaries: [],
        marks: [],
        papers: [],
      }));
    const summaries = examResults?.summaries ?? [];
    const latestSgpa =
      summaries[0]?.sgpa != null ? Number(summaries[0].sgpa) : null;
    return {
      hasResults: summaries.length > 0,
      hasAdmitCard: Boolean(examResults),
      cgpa: latestSgpa,
    };
  }

  async getDashboardWidgetNotifications(user: JwtUser) {
    const [notifications, unreadCount] = await Promise.all([
      this.notifications.list(user, 8),
      this.notifications.unreadCount(user),
    ]);
    return {
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
    };
  }

  async getDashboardWidgetCalendar(user: JwtUser) {
    const student = await this.resolveStudent(user);
    return this.calendar.buildForStudent(user.tid, student.id, {
      monthsSpan: 3,
    });
  }

  async getDashboardWidgetLibrary(user: JwtUser) {
    const student = await this.resolveStudent(user);
    const [loans, fines] = await Promise.all([
      this.prisma.libraryLoan.findMany({
        where: {
          tenantId: user.tid,
          studentId: student.id,
          status: { in: ['ACTIVE', 'OVERDUE'] },
          returnedAt: null,
        },
        select: { id: true, dueAt: true },
        orderBy: { dueAt: 'asc' },
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
    ]);
    const libraryFinesDue = fines.reduce(
      (sum, f) => sum + Number(f.amount ?? 0),
      0,
    );
    const nextDue = loans.find((l) => l.dueAt)?.dueAt ?? null;
    let dueInDays: number | null = null;
    if (nextDue) {
      dueInDays = Math.ceil(
        (new Date(nextDue).getTime() - Date.now()) / 86_400_000,
      );
    }
    return { issuedBooks: loans.length, finesDue: libraryFinesDue, dueInDays };
  }

  async getDashboardWidgetHealth(user: JwtUser) {
    const student = await this.resolveStudent(user);
    const health = await this.students
      .getStudentHealth(user, student.id)
      .catch(() => null);
    if (health) {
      return {
        score: health.score.score,
        label: health.score.label,
        tone: health.score.tone,
        signals: health.signals,
      };
    }
    return {
      score: 0,
      label: 'Profile completion',
      tone: 'warn' as const,
      signals: [],
    };
  }

  async getDashboardWidgetQrPass(user: JwtUser) {
    return this.libraryQr.getStudentQr(user).catch(() => null);
  }

  async getDashboardWidgetBirthdays(user: JwtUser) {
    const student = await this.resolveStudent(user);
    return this.birthdays.getStudentWidgetBirthdays(user.tid, student.id);
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

  /**
   * Resolve faculty for dashboard subject chips.
   * Prefer staff whose home department matches the course department.
   * Cross-department assignments are ignored (shown as —) so bad links
   * (e.g. Economics staff on a Political Science paper) never surface.
   */
  private async withFacultyNames(
    tenantId: string,
    chips: {
      category: string;
      label: string;
      courseTitle: string;
      courseCode?: string | null;
      credits?: number;
      facultyName?: string | null;
    }[],
    registration: Awaited<
      ReturnType<AcademicEngineService['getMyRegistration']>
    > | null,
  ) {
    if (!chips.length) return chips;

    type StaffLite = {
      fullName?: string | null;
      shortCode?: string | null;
      departmentId?: string | null;
    };

    const staffLabel = (s?: StaffLite | null) =>
      s?.fullName?.trim() || s?.shortCode?.trim() || null;

    const lines = registration?.registration?.lines ?? [];
    const sectionIds = [
      ...new Set(
        lines
          .map((l) => l.offeringSectionId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const courseIds = [
      ...new Set(
        lines
          .map((l) => l.offering?.course?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [teachingRows, subjectRows] = await Promise.all([
      sectionIds.length
        ? this.prisma.subjectTeachingAssignment.findMany({
            where: {
              tenantId,
              offeringSectionId: { in: sectionIds },
              deletedAt: null,
            },
            include: {
              staffProfile: {
                select: {
                  fullName: true,
                  shortCode: true,
                  departmentId: true,
                },
              },
              course: { select: { id: true, departmentId: true, code: true } },
            },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          })
        : Promise.resolve([]),
      sectionIds.length || courseIds.length
        ? this.prisma.staffSubjectAssignment.findMany({
            where: {
              tenantId,
              OR: [
                ...(sectionIds.length
                  ? [{ offeringSectionId: { in: sectionIds } }]
                  : []),
                ...(courseIds.length ? [{ courseId: { in: courseIds } }] : []),
              ],
            },
            include: {
              staffProfile: {
                select: {
                  fullName: true,
                  shortCode: true,
                  departmentId: true,
                },
              },
              course: { select: { id: true, departmentId: true, code: true } },
            },
            orderBy: { isPrimaryFaculty: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const pickMatching = (
      courseDeptId: string | null | undefined,
      candidates: Array<{ staff: StaffLite | null | undefined; rank: number }>,
    ): string | null => {
      const usable = candidates
        .map((c) => ({
          name: staffLabel(c.staff),
          deptId: c.staff?.departmentId ?? null,
          rank: c.rank,
        }))
        .filter((c) => c.name);

      if (!usable.length) return null;

      // Course has a home department → only same-department staff
      if (courseDeptId) {
        const match = usable
          .filter((c) => c.deptId === courseDeptId)
          .sort((a, b) => a.rank - b.rank);
        return match[0]?.name ?? null;
      }

      // No course department to validate against → best-ranked candidate
      return usable.sort((a, b) => a.rank - b.rank)[0]?.name ?? null;
    };

    const lineMeta = new Map<
      string,
      {
        sectionId: string | null;
        courseId?: string;
        courseDeptId?: string | null;
        sectionStaff?: StaffLite | null;
        sectionAssignStaff?: StaffLite[];
        teachingStaff?: StaffLite[];
      }
    >();

    for (const line of lines) {
      const code = line.offering?.course?.code;
      if (!code) continue;
      const section = line.offeringSection as
        | {
            staffProfile?: StaffLite | null;
            subjectAssignments?: Array<{ staffProfile?: StaffLite | null }>;
            subjectTeachingAssignments?: Array<{
              staffProfile?: StaffLite | null;
            }>;
          }
        | null
        | undefined;

      lineMeta.set(String(code), {
        sectionId: (line.offeringSectionId as string | null) ?? null,
        courseId: line.offering?.course?.id,
        courseDeptId: line.offering?.course?.departmentId ?? null,
        sectionStaff: section?.staffProfile ?? null,
        sectionAssignStaff: (section?.subjectAssignments ?? [])
          .map((a) => a.staffProfile)
          .filter(Boolean) as StaffLite[],
        teachingStaff: (section?.subjectTeachingAssignments ?? [])
          .map((a) => a.staffProfile)
          .filter(Boolean) as StaffLite[],
      });
    }

    return chips.map((chip) => {
      const meta = chip.courseCode ? lineMeta.get(chip.courseCode) : undefined;
      if (!meta) return { ...chip, facultyName: null };

      const candidates: Array<{
        staff: StaffLite | null | undefined;
        rank: number;
      }> = [];

      // Prefer explicit teaching assignments (same section)
      for (const row of teachingRows) {
        if (
          meta.sectionId &&
          row.offeringSectionId === meta.sectionId &&
          (!meta.courseId || row.courseId === meta.courseId)
        ) {
          candidates.push({
            staff: row.staffProfile,
            rank: row.isPrimary ? 1 : 2,
          });
        }
      }

      for (const s of meta.teachingStaff ?? []) {
        candidates.push({ staff: s, rank: 2 });
      }

      // Section primary + subject assignments (section-scoped only)
      if (meta.sectionStaff) {
        candidates.push({ staff: meta.sectionStaff, rank: 3 });
      }
      for (const s of meta.sectionAssignStaff ?? []) {
        candidates.push({ staff: s, rank: 3 });
      }

      for (const row of subjectRows) {
        if (meta.sectionId && row.offeringSectionId === meta.sectionId) {
          candidates.push({
            staff: row.staffProfile,
            rank: row.isPrimaryFaculty ? 3 : 4,
          });
        }
      }

      const facultyName = pickMatching(meta.courseDeptId, candidates);
      return { ...chip, facultyName };
    });
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
    const chips: {
      category: string;
      label: string;
      courseTitle: string;
      courseCode?: string | null;
      credits?: number;
      facultyName?: string | null;
    }[] = [];
    const lines = registration?.registration?.lines ?? [];

    for (const line of lines) {
      const category = String(line.category ?? '').toUpperCase();
      if (
        ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC', 'VTC'].includes(category)
      ) {
        const course = line.offering?.course;
        chips.push({
          category,
          label: SNAPSHOT_CATEGORY_LABELS[category] ?? category,
          courseTitle: course?.title ?? course?.code ?? '—',
          courseCode: course?.code ?? null,
          credits: Number(line.credits ?? course?.credits ?? 0),
          // Faculty resolved later with department matching
          facultyName: null,
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
        courseCode: null,
        credits: 0,
        facultyName: null,
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
        courseCode: null,
        credits: 0,
        facultyName: null,
      });
    }

    const order = ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC', 'VTC'];
    return chips.sort(
      (a, b) => order.indexOf(a.category) - order.indexOf(b.category),
    );
  }

  async getMobileAcademics(user: JwtUser) {
    const student = await this.resolveStudent(user);
    const [
      registration,
      attendance,
      creditSummary,
      weekTimetable,
      lmsDash,
      examResults,
      academicYear,
      shift,
      allRegistrations,
      programVersion,
    ] = await Promise.all([
      this.academicEngine
        .getMyRegistration(user.tid, user.sub)
        .catch(() => null),
      this.attendance.studentPortalSummary(user).catch(() => null),
      this.academicEngine
        .getMyCreditSummary(user.tid, user.sub)
        .catch(() => null),
      this.timetable
        .studentWeek(user)
        .catch(() => ({ entries: [] as Record<string, unknown>[] })),
      this.lms.studentDashboard(user).catch(() => null),
      this.examinations.studentResults(user).catch(() => null),
      this.prisma.academicYear.findFirst({
        where: {
          tenantId: user.tid,
          deletedAt: null,
          OR: [{ status: 'ACTIVE' }, { isPrimarySession: true }],
        },
        select: { name: true },
        orderBy: { startDate: 'desc' },
      }),
      student.primaryShiftId
        ? this.prisma.shift.findFirst({
            where: { id: student.primaryShiftId, tenantId: user.tid },
            select: { name: true },
          })
        : Promise.resolve(null),
      this.prisma.semesterRegistration.findMany({
        where: { tenantId: user.tid, studentId: student.id },
        include: {
          semester: { select: { sequence: true, name: true } },
          lines: {
            include: {
              offering: { include: { course: true } },
              offeringSection: {
                include: { shift: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      student.programVersionId
        ? this.prisma.programVersion.findFirst({
            where: { id: student.programVersionId, tenantId: user.tid },
            select: {
              version: true,
              program: { select: { name: true } },
              structureTemplate: {
                select: { totalSemesters: true, semesterCreditTarget: true },
              },
            },
          })
        : Promise.resolve(null),
    ]);

    const majorMinor = registration?.majorMinorTrack;
    const headerDepartment = await this.resolveHeaderMajorDepartment(
      user.tid,
      registration,
      majorMinor,
      student,
    );
    const semesterSequence =
      registration?.standing?.currentSemesterSequence ??
      registration?.registration?.semesterSequence ??
      null;
    const lines = registration?.registration?.lines ?? [];
    const sectionIds = [
      ...new Set(lines.map((l) => l.offeringSectionId).filter(Boolean)),
    ] as string[];
    const offeringIds = [
      ...new Set(lines.map((l) => l.offeringId).filter(Boolean)),
    ] as string[];

    const [teachingGroups, offerings, classrooms] = await Promise.all([
      sectionIds.length
        ? this.prisma.teachingSubjectGroup.findMany({
            where: {
              tenantId: user.tid,
              offeringSectionId: { in: sectionIds },
            },
            include: {
              primaryStaffProfile: {
                select: { fullName: true, employeeCode: true },
              },
            },
          })
        : Promise.resolve([]),
      offeringIds.length
        ? this.prisma.courseOffering.findMany({
            where: { tenantId: user.tid, id: { in: offeringIds } },
            include: {
              course: {
                select: { id: true, code: true, title: true, credits: true },
              },
            },
          })
        : Promise.resolve([]),
      (() => {
        const classroomIds = [
          ...new Set(
            (weekTimetable.entries ?? [])
              .map((e) => e.classroomId as string | undefined)
              .filter(Boolean),
          ),
        ] as string[];
        return classroomIds.length
          ? this.prisma.classroom.findMany({
              where: { tenantId: user.tid, id: { in: classroomIds } },
              select: { id: true, name: true, code: true },
            })
          : Promise.resolve([]);
      })(),
    ]);

    const facultyBySection = new Map(
      teachingGroups.map((g) => [
        g.offeringSectionId,
        g.primaryStaffProfile?.fullName ?? null,
      ]),
    );
    const offeringMap = new Map(offerings.map((o) => [o.id, o]));
    const classroomMap = new Map(
      classrooms.map((c) => [c.id, c.name ?? c.code]),
    );

    const attendanceByCourseId = new Map<string, number>();
    for (const row of attendance?.subjects ?? []) {
      if (row.courseId) {
        attendanceByCourseId.set(row.courseId, Number(row.percentage ?? 0));
      }
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const code = meta.courseCode as string | undefined;
      if (code) attendanceByCourseId.set(code, Number(row.percentage ?? 0));
    }

    const examMarks =
      (
        examResults as {
          marks?: {
            marksObtained?: unknown;
            maxMarks?: unknown;
            paperId?: string;
          }[];
        }
      )?.marks ?? [];
    const examPapers =
      (
        examResults as {
          papers?: { id: string; paperCode?: string; paperTitle?: string }[];
        }
      )?.papers ?? [];
    const paperMap = new Map(examPapers.map((p) => [p.id, p]));

    const majorCount = { n: 0 };
    const categoryOrder = ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC', 'VTC'];
    const subjects = lines
      .map((line) => {
        const category = String(line.category ?? '').toUpperCase();
        const course =
          line.offering?.course ?? offeringMap.get(line.offeringId)?.course;
        const courseId = course?.id ?? null;
        const courseCode = course?.code ?? '—';
        const courseTitle = course?.title ?? courseCode;
        const credits = Number(line.credits ?? course?.credits ?? 0);

        let categoryLabel = SNAPSHOT_CATEGORY_LABELS[category] ?? category;
        if (category === 'MAJOR') {
          majorCount.n += 1;
          categoryLabel =
            majorCount.n === 1
              ? 'Major Paper I'
              : majorCount.n === 2
                ? 'Major Paper II'
                : `Major ${majorCount.n}`;
        }

        const roomEntry = (weekTimetable.entries ?? []).find(
          (e) =>
            e.courseOfferingId === line.offeringId &&
            (e.offeringSectionId == null ||
              e.offeringSectionId === line.offeringSectionId),
        );
        const roomId = roomEntry?.classroomId as string | undefined;
        const room = roomId ? (classroomMap.get(roomId) ?? null) : null;

        const matchingMark = examMarks.find((m) => {
          const paper = m.paperId ? paperMap.get(m.paperId) : null;
          if (!paper) return false;
          return (
            paper.paperCode === courseCode ||
            paper.paperTitle?.toLowerCase().includes(courseTitle.toLowerCase())
          );
        });

        return {
          id: line.id,
          category,
          categoryLabel,
          courseCode,
          courseTitle,
          credits,
          facultyName: line.offeringSectionId
            ? (facultyBySection.get(line.offeringSectionId) ?? null)
            : null,
          room,
          attendancePercent:
            courseId != null
              ? (attendanceByCourseId.get(courseId) ??
                attendanceByCourseId.get(courseCode) ??
                null)
              : null,
          internalMarks: matchingMark
            ? {
                obtained: Number(matchingMark.marksObtained ?? 0),
                max: Number(matchingMark.maxMarks ?? 20),
              }
            : null,
          assignmentStatus: null as string | null,
          offeringId: line.offeringId,
          offeringSectionId: line.offeringSectionId,
        };
      })
      .sort(
        (a, b) =>
          categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category),
      );

    const snapshot = this.academicSnapshotChips(registration, majorMinor);
    const registrationStatus = String(
      registration?.registration?.status ?? 'not_registered',
    );
    const totalCredits =
      creditSummary?.total ?? subjects.reduce((sum, s) => sum + s.credits, 0);
    const targetCredits =
      programVersion?.structureTemplate?.semesterCreditTarget ?? 20;

    const mapTimetableSlot = (entry: Record<string, unknown>) => {
      const offering = entry.courseOfferingId
        ? offeringMap.get(String(entry.courseOfferingId))
        : null;
      const course = (entry.course ?? offering?.course) as
        | { code?: string; title?: string }
        | null
        | undefined;
      const group = entry.teachingSubjectGroup as
        | { code?: string; title?: string; fyugpCategory?: string }
        | null
        | undefined;
      const staff = entry.staffProfile as
        | { fullName?: string; shortCode?: string | null }
        | null
        | undefined;
      const start = formatDisplayTime(String(entry.startTime ?? ''));
      const end = formatDisplayTime(String(entry.endTime ?? ''));
      const roomId = entry.classroomId as string | undefined;
      const sectionId = entry.offeringSectionId
        ? String(entry.offeringSectionId)
        : null;
      const category = String(
        group?.fyugpCategory ??
          entry.fyugpCategory ??
          lines.find((l) => l.offeringId === entry.courseOfferingId)
            ?.category ??
          '',
      ).toUpperCase();
      const title =
        course?.title ?? group?.title ?? course?.code ?? group?.code ?? 'Class';
      const code = course?.code ?? group?.code ?? null;
      return {
        time: `${start} – ${end}`,
        startTime: start,
        endTime: end,
        title,
        courseCode: code,
        category: category || null,
        facultyName:
          staff?.fullName ??
          (sectionId ? facultyBySection.get(sectionId) : null) ??
          null,
        room: roomId ? (classroomMap.get(roomId) ?? null) : null,
        isCurrent: isCurrentSlot(start, end),
        isPast: isPastSlot(end),
      };
    };

    const today = getZonedWeekday();
    const todayClasses = (weekTimetable.entries ?? [])
      .filter((e) => e.dayOfWeek === today)
      .sort(
        (a, b) =>
          (parseTimeToMinutes(String(a.startTime ?? '')) ?? 0) -
          (parseTimeToMinutes(String(b.startTime ?? '')) ?? 0),
      )
      .map((entry) => mapTimetableSlot(entry as Record<string, unknown>));

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyTimetable = dayNames.map((day, dayOfWeek) => ({
      day,
      dayOfWeek,
      slots: (weekTimetable.entries ?? [])
        .filter((e) => e.dayOfWeek === dayOfWeek)
        .sort(
          (a, b) =>
            (parseTimeToMinutes(String(a.startTime ?? '')) ?? 0) -
            (parseTimeToMinutes(String(b.startTime ?? '')) ?? 0),
        )
        .map((entry) => mapTimetableSlot(entry as Record<string, unknown>)),
    }));

    const attendanceBySubject = (attendance?.subjects ?? []).map(
      (row: {
        metadata?: unknown;
        percentage?: unknown;
        presentCount?: number;
        totalSessions?: number;
      }) => {
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        const title =
          (meta.courseTitle as string | undefined) ??
          (meta.courseCode as string | undefined) ??
          (meta.title as string | undefined) ??
          'Subject';
        return {
          label: title,
          percentage: Number(row.percentage ?? 0),
          presentCount: row.presentCount,
          totalSessions: row.totalSessions,
        };
      },
    );

    const semesterProgress = categoryOrder
      .filter(
        (cat) => subjects.some((s) => s.category === cat) || cat === 'MAJOR',
      )
      .map((cat) => {
        const catSubjects = subjects.filter((s) => s.category === cat);
        if (cat === 'MINOR' && catSubjects.length === 0) return null;
        return {
          category: cat,
          label: SNAPSHOT_CATEGORY_LABELS[cat] ?? cat,
          registered: catSubjects.length > 0,
          credits: catSubjects.reduce((sum, s) => sum + s.credits, 0),
        };
      })
      .filter(Boolean) as {
      category: string;
      label: string;
      registered: boolean;
      credits: number;
    }[];

    const totalSemesters =
      programVersion?.structureTemplate?.totalSemesters ?? 6;
    const currentSem = semesterSequence ?? 1;
    const completedSemesters = new Set(
      allRegistrations
        .filter((r) =>
          ['submitted', 'approved', 'completed', 'confirmed'].includes(
            String(r.status).toLowerCase(),
          ),
        )
        .map((r) => r.semester?.sequence)
        .filter((n): n is number => n != null),
    );

    const journey = Array.from({ length: totalSemesters }, (_, i) => {
      const sem = i + 1;
      const reg = allRegistrations.find((r) => r.semester?.sequence === sem);
      let status: 'completed' | 'current' | 'upcoming' = 'upcoming';
      if (sem < currentSem || completedSemesters.has(sem)) status = 'completed';
      else if (sem === currentSem) status = 'current';
      return {
        semesterSequence: sem,
        label: `Semester ${sem}`,
        status,
        registrationStatus: reg?.status ?? null,
        subjectCount: reg?.lines?.length ?? 0,
        credits: (reg?.lines ?? []).reduce(
          (sum, line) =>
            sum + Number(line.credits ?? line.offering?.course?.credits ?? 0),
          0,
        ),
      };
    });

    return {
      header: {
        academicYear: academicYear?.name ?? null,
        programme:
          programVersion?.program?.name ??
          student.programVersion?.program?.name ??
          'Programme',
        semesterSequence,
        semesterLabel:
          semesterSequence != null ? `Semester ${semesterSequence}` : '—',
        shift: shift?.name ?? lines[0]?.offeringSection?.shift?.name ?? null,
        department: headerDepartment,
        registrationStatus,
        registrationComplete: REGISTRATION_COMPLETE.has(
          registrationStatus.toLowerCase(),
        ),
        totalCredits,
        targetCredits,
        curriculumVersion: programVersion
          ? `Version ${programVersion.version}`
          : null,
        status: 'ACTIVE',
        major: majorMinor?.majorSubject?.name ?? null,
        minor: majorMinor?.minorSubject?.name ?? null,
      },
      snapshot,
      subjects,
      attendanceBySubject,
      todayClasses,
      weeklyTimetable,
      semesterProgress,
      journey,
      internalMarks: subjects
        .filter((s) => s.internalMarks)
        .map((s) => ({
          label: s.courseTitle,
          category: s.categoryLabel,
          ...s.internalMarks!,
        })),
      assignmentsDue: Number(
        (lmsDash as { cards?: { assignmentsDue?: number } })?.cards
          ?.assignmentsDue ?? 0,
      ),
      downloads: {
        syllabusAvailable: await this.hasPublishedSyllabusForCourses(
          user.tid,
          lines
            .map(
              (line) =>
                line.offering?.course?.id ??
                offeringMap.get(line.offeringId)?.course?.id ??
                null,
            )
            .filter((id): id is string => Boolean(id)),
        ),
        curriculumAvailable: Boolean(programVersion?.version),
        subjectListAvailable: subjects.length > 0,
      },
    };
  }

  private async hasPublishedSyllabusForCourses(
    tenantId: string,
    courseIds: string[],
  ) {
    const unique = [...new Set(courseIds)];
    if (!unique.length) return false;
    const count = await this.prisma.syllabusDocument.count({
      where: {
        tenantId,
        courseId: { in: unique },
        status: 'PUBLISHED',
        deletedAt: null,
      },
    });
    return count > 0;
  }
}
