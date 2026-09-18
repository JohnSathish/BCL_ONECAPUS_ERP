import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisAttendanceService } from '../school-sis/school-sis-attendance.service';
import { SchoolSisExamsService } from '../school-sis/school-sis-exams.service';
import { SchoolSisFeesService } from '../school-sis/school-sis-fees.service';
import { SchoolSisService } from '../school-sis/school-sis.service';
import { SchoolSisTimetableService } from '../school-sis/school-sis-timetable.service';
import { SchoolWebGalleryService } from '../school-web/school-web-gallery.service';
import { SchoolWebService } from '../school-web/school-web.service';
import {
  pickEnrollment,
  SchoolMobileAccessService,
} from './school-mobile-access.service';
import { SchoolMobileInboxService } from './school-mobile-inbox.service';
import { SchoolMobilePrayerService } from './school-mobile-prayer.service';
import {
  istNowParts,
  toMinutes,
} from '../school-sis/school-sis-timetable-bells';

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

@Injectable()
export class SchoolMobileHomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly access: SchoolMobileAccessService,
    private readonly web: SchoolWebService,
    private readonly gallery: SchoolWebGalleryService,
    private readonly timetable: SchoolSisTimetableService,
    private readonly fees: SchoolSisFeesService,
    private readonly attendanceSvc: SchoolSisAttendanceService,
    private readonly exams: SchoolSisExamsService,
    private readonly prayer: SchoolMobilePrayerService,
    private readonly inbox: SchoolMobileInboxService,
  ) {}

  async me(user: JwtUser, childId?: string) {
    const persona = this.access.assertAccess(user);
    const children = await this.access.childrenForUser(user.tid, user.sub);
    const activeStudentId = await this.access.resolveStudentId(
      user.tid,
      user,
      childId,
    );
    const account = await this.prisma.user.findFirst({
      where: { id: user.sub, tenantId: user.tid },
      select: {
        displayName: true,
        email: true,
        username: true,
        mustResetPassword: true,
      },
    });
    let staff: {
      fullName: string;
      photoUrl: string | null;
      designation: string | null;
    } | null = null;
    if (persona === 'admin' || persona === 'teacher') {
      const staffId = await this.access.staffIdForUser(user.tid, user);
      if (staffId) {
        staff = await this.prisma.schoolStaff.findFirst({
          where: { id: staffId, tenantId: user.tid },
          select: { fullName: true, photoUrl: true, designation: true },
        });
      }
    }
    const activeChild =
      children.find((child) => child.studentId === activeStudentId) ??
      children[0] ??
      null;
    let student: Record<string, unknown> | null = null;
    if (activeChild) {
      const year = await this.sis.currentYear(user.tid).catch(() => null);
      const row = await this.prisma.schoolStudent.findFirst({
        where: { id: activeChild.studentId, tenantId: user.tid },
        include: {
          guardians: { include: { guardian: true } },
          enrollments: {
            where: { deletedAt: null },
            include: {
              academicYear: true,
              section: { include: { grade: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      const enrollment = row ? pickEnrollment(row.enrollments, year?.id) : null;
      const classLabel =
        activeChild.classLabel ||
        (enrollment?.section.grade
          ? `${enrollment.section.grade.name}${
              enrollment.section.name ? ` ${enrollment.section.name}` : ''
            }`
          : null);
      student = row
        ? {
            id: row.id,
            fullName: row.fullName,
            admissionNumber: row.admissionNumber,
            photoUrl: row.photoUrl,
            gender: row.gender,
            dateOfBirth: row.dateOfBirth,
            phone: row.phone,
            email: row.email,
            address:
              formatSchoolAddress(row.address) ||
              formatSchoolAddress(row.currentAddress),
            bloodGroup: row.bloodGroup,
            status: row.status,
            classLabel,
            rollNumber:
              enrollment?.rollNumber ||
              row.enrollments.find((item) => item.rollNumber?.trim())
                ?.rollNumber ||
              null,
            academicYearName:
              enrollment?.academicYear?.name || year?.name || null,
            guardians: row.guardians.map((link) => ({
              fullName: link.guardian.fullName,
              relation: link.relationship || link.guardian.relation,
              phone: link.guardian.phone,
            })),
          }
        : null;
    }
    return {
      persona,
      displayName:
        persona === 'admin' || persona === 'teacher'
          ? staff?.fullName || account?.displayName || 'St. Luke’s family'
          : (student?.fullName as string | undefined) ||
            account?.displayName ||
            'St. Luke’s family',
      email: account?.email || user.email,
      username: account?.username,
      mustResetPassword: Boolean(account?.mustResetPassword),
      children,
      activeStudentId,
      student,
      staff,
    };
  }

  async home(user: JwtUser, childId?: string) {
    const me = await this.me(user, childId);
    const [bundle, prayer, inbox, gallery] = await Promise.all([
      this.web.getPublicBundle(user.tid),
      this.prayer.today(user.tid),
      this.inbox.list(user),
      this.gallery.listPublic(user.tid, { page: 1 }),
    ]);
    const flashSection = bundle.homepage.find(
      (row: { key: string; payload: unknown }) => row.key === 'flashNews',
    );
    let timetable: unknown = null;
    let fees: unknown = null;
    let exams: unknown = null;
    let attendance: Record<string, unknown> = {
      status: 'unavailable',
      percent: null,
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
    };
    if (me.activeStudentId) {
      try {
        timetable = await this.timetable.studentGrid(
          user.tid,
          me.activeStudentId,
        );
      } catch {
        timetable = null;
      }
      try {
        fees = await this.fees.forStudent(user.tid, me.activeStudentId);
      } catch {
        fees = null;
      }
      try {
        const profile = await this.attendanceSvc.studentProfile(
          user.tid,
          me.activeStudentId,
        );
        const month = profile.month as
          | { present?: number; absent?: number; late?: number; leave?: number }
          | undefined;
        attendance = {
          status: 'ok',
          percent: profile.percent,
          present: month?.present ?? 0,
          absent: month?.absent ?? 0,
          late: month?.late ?? 0,
          leave: month?.leave ?? 0,
          calendar: profile.calendar,
          workingDays: profile.workingDays,
          band: profile.band,
        };
      } catch {
        attendance = { status: 'unavailable', percent: null };
      }
      try {
        exams = await this.exams.studentPublished(user.tid, me.activeStudentId);
      } catch {
        exams = null;
      }
    }
    let staffId: string | null = null;
    if (me.persona === 'teacher' || me.persona === 'admin') {
      staffId = await this.access.staffIdForUser(user.tid, user);
      if (staffId) {
        try {
          timetable = await this.timetable.teacherGrid(
            user.tid,
            staffId,
            false,
          );
        } catch {
          timetable = null;
        }
      }
    }
    const now = new Date();
    const upcomingEvents = (bundle.events ?? []).filter(
      (event: { startsAt?: Date | string | null }) =>
        !event.startsAt || new Date(event.startsAt) >= now,
    );
    let office: {
      students: number;
      teachers: number;
      classes: number;
      attendanceToday: number | null;
      present: number;
      absent: number;
      late: number;
      classesMarked: number;
      classesTotal: number;
    } | null = null;
    if (me.persona === 'admin') {
      try {
        const [students, teachers, classes, att] = await Promise.all([
          this.prisma.schoolStudent.count({
            where: { tenantId: user.tid, deletedAt: null, status: 'ACTIVE' },
          }),
          this.prisma.schoolStaff.count({
            where: {
              tenantId: user.tid,
              deletedAt: null,
              status: 'ACTIVE',
              staffType: 'TEACHING',
            },
          }),
          this.prisma.schoolSection.count({
            where: { tenantId: user.tid, deletedAt: null, active: true },
          }),
          this.attendanceSvc.dashboard(user.tid, {}),
        ]);
        office = {
          students,
          teachers,
          classes,
          attendanceToday:
            typeof att.totals?.percent === 'number' ? att.totals.percent : null,
          present: att.totals?.present ?? 0,
          absent: att.totals?.absent ?? 0,
          late: att.totals?.late ?? 0,
          classesMarked: att.completion?.submitted ?? 0,
          classesTotal: att.completion?.total ?? classes,
        };
      } catch {
        office = {
          students: 0,
          teachers: 0,
          classes: 0,
          attendanceToday: null,
          present: 0,
          absent: 0,
          late: 0,
          classesMarked: 0,
          classesTotal: 0,
        };
      }
    }
    let desk: Record<string, unknown> | null = null;
    if (me.persona === 'teacher' && staffId) {
      desk = await this.teacherDesk(user.tid, staffId, timetable);
    }
    return {
      greeting: greeting(),
      me,
      office,
      desk,
      flashNews: flashSection?.payload ?? { label: 'FLASH NEWS', items: [] },
      prayer,
      unreadCount: inbox.unreadCount,
      notices: (bundle.notices ?? []).slice(0, 8),
      events: upcomingEvents.slice(0, 8),
      albums: gallery.albums.slice(0, 8),
      pages: bundle.pages ?? [],
      site: {
        displayName: bundle.site.displayName,
        motto: bundle.site.motto,
        email: bundle.site.email,
        phone: bundle.site.phone,
        addressLine: bundle.site.addressLine,
        city: bundle.site.city,
        extrasJson: bundle.site.extrasJson,
      },
      attendance,
      timetable,
      fees,
      exams,
      quickLinks: this.quickLinks(me.persona),
    };
  }

  private quickLinks(persona: string) {
    const shared = [
      { key: 'notices', label: 'Notices', href: '/notices' },
      { key: 'events', label: 'Events', href: '/events' },
      { key: 'gallery', label: 'Gallery', href: '/gallery' },
      { key: 'prayer', label: 'Morning prayer', href: '/prayer' },
      { key: 'school', label: 'School info', href: '/school' },
    ];
    if (persona === 'student' || persona === 'parent') {
      return [
        { key: 'attendance', label: 'Attendance', href: '/attendance' },
        { key: 'timetable', label: 'Timetable', href: '/timetable' },
        { key: 'academics', label: 'Academics', href: '/academics' },
        { key: 'fees', label: 'Fees', href: '/fees' },
        ...shared,
      ];
    }
    if (persona === 'teacher') {
      return [
        { key: 'timetable', label: 'Timetable', href: '/timetable' },
        { key: 'attendance', label: 'Take attendance', href: '/attendance' },
        { key: 'leave', label: 'Leave', href: '/leave' },
        { key: 'hr', label: 'My HR', href: '/hr' },
        ...shared,
      ];
    }
    if (persona === 'accountant') {
      return [
        { key: 'fees', label: 'Fees', href: '/fees' },
        { key: 'reports', label: 'Reports', href: '/reports' },
        ...shared,
      ];
    }
    if (persona === 'librarian') {
      return [
        { key: 'library', label: 'Library', href: '/library' },
        ...shared,
      ];
    }
    if (persona === 'transport') {
      return [
        { key: 'transport', label: 'Transport', href: '/transport' },
        ...shared,
      ];
    }
    return [
      { key: 'broadcast', label: 'Notify', href: '/more' },
      { key: 'students', label: 'Students', href: '/more' },
      ...shared,
    ];
  }

  private async teacherDesk(tenantId: string, staffId: string, grid: unknown) {
    type Slot = {
      id: string;
      dayOfWeek?: number;
      subject?: { name?: string } | null;
      section?: { id?: string; name?: string; grade?: { name?: string } };
      bell?: { startTime?: string; endTime?: string; sortOrder?: number };
    };
    const slots = ((grid as { slots?: Slot[] } | null)?.slots ?? []) as Slot[];
    const { dayOfWeek, minutes } = istNowParts();
    const assignments = await this.prisma.schoolClassTeacherAssignment.findMany(
      {
        where: { tenantId, staffId, deletedAt: null },
        include: { section: { include: { grade: true } } },
      },
    );
    const sectionMap = new Map<string, { id: string; label: string }>();
    for (const row of assignments) {
      sectionMap.set(row.sectionId, {
        id: row.sectionId,
        label: `${row.section.grade.name} ${row.section.name}`.trim(),
      });
    }
    for (const slot of slots) {
      const id = slot.section?.id;
      if (!id) continue;
      const label =
        `${slot.section?.grade?.name ?? ''} ${slot.section?.name ?? ''}`.trim();
      if (label) sectionMap.set(id, { id, label });
    }
    const sectionIds = [...sectionMap.keys()];
    const enrollCounts = sectionIds.length
      ? await this.prisma.schoolEnrollment.groupBy({
          by: ['sectionId'],
          where: {
            tenantId,
            sectionId: { in: sectionIds },
            status: 'ACTIVE',
            deletedAt: null,
          },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map(
      enrollCounts.map((row) => [row.sectionId, row._count._all]),
    );
    const todaySlots = slots
      .filter((slot) => slot.dayOfWeek === dayOfWeek)
      .sort(
        (a, b) =>
          (a.bell?.sortOrder ?? toMinutes(a.bell?.startTime ?? '00:00')) -
          (b.bell?.sortOrder ?? toMinutes(b.bell?.startTime ?? '00:00')),
      );
    const todayDone = todaySlots.filter((slot) => {
      const end = slot.bell?.endTime;
      return end ? toMinutes(end) <= minutes : false;
    }).length;
    const year = new Date().getFullYear();
    const balances = await this.prisma.schoolHrLeaveBalance.findMany({
      where: { tenantId, staffId, year },
    });
    const leaveRemaining = balances.reduce(
      (sum, row) =>
        sum + Number(row.opening) + Number(row.accrued) - Number(row.taken),
      0,
    );
    const attBySection = new Map<string, number>();
    if (sectionIds.length) {
      try {
        const att = await this.attendanceSvc.dashboard(tenantId, {
          sectionIds,
        });
        for (const row of att.byClass) {
          attBySection.set(row.sectionId, row.percent);
        }
      } catch {
        /* optional */
      }
    }
    return {
      classCount: sectionMap.size,
      classLabels: [...sectionMap.values()].map((row) => row.label).slice(0, 6),
      studentCount: [...countMap.values()].reduce((n, v) => n + v, 0),
      todayTotal: todaySlots.length,
      todayDone,
      leaveRemaining: Math.max(0, Math.round(leaveRemaining)),
      todaySchedule: todaySlots.map((slot) => ({
        id: slot.id,
        start: this.clockLabel(slot.bell?.startTime),
        end: this.clockLabel(slot.bell?.endTime),
        classLabel:
          `${slot.section?.grade?.name ?? ''} ${slot.section?.name ?? ''}`.trim() ||
          'Class',
        subject: slot.subject?.name ?? 'Period',
      })),
      classes: [...sectionMap.values()].map((row) => ({
        id: row.id,
        label: row.label,
        students: countMap.get(row.id) ?? 0,
        percent: attBySection.get(row.id) ?? null,
      })),
    };
  }

  private clockLabel(hhmm?: string | null) {
    if (!hhmm) return '—';
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h)) return hhmm;
    const am = h < 12;
    const hr = h % 12 || 12;
    return `${String(hr).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
  }
}

function formatSchoolAddress(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const text = value.trim();
    return text || null;
  }
  if (typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const parts = [
    row.line1,
    row.line2,
    row.village,
    row.locality,
    row.town,
    row.city,
    row.district,
    row.state,
    row.pin || row.pincode,
  ]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}
