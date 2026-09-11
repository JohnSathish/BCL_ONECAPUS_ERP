import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisFeesService } from '../school-sis/school-sis-fees.service';
import { SchoolSisTimetableService } from '../school-sis/school-sis-timetable.service';
import { SchoolWebGalleryService } from '../school-web/school-web-gallery.service';
import { SchoolWebService } from '../school-web/school-web.service';
import { SchoolMobileAccessService } from './school-mobile-access.service';
import { SchoolMobileInboxService } from './school-mobile-inbox.service';
import { SchoolMobilePrayerService } from './school-mobile-prayer.service';

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
    private readonly access: SchoolMobileAccessService,
    private readonly web: SchoolWebService,
    private readonly gallery: SchoolWebGalleryService,
    private readonly timetable: SchoolSisTimetableService,
    private readonly fees: SchoolSisFeesService,
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
      select: { displayName: true, email: true },
    });
    return {
      persona,
      displayName: account?.displayName || 'St. Luke’s family',
      email: account?.email || user.email,
      children,
      activeStudentId,
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
    let attendance = {
      status: 'unavailable' as const,
      message: 'Class attendance will appear here once the school enables it.',
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
    } else if (me.persona === 'teacher') {
      const staffId = await this.access.staffIdForUser(user.tid, user);
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
    return {
      greeting: greeting(),
      me,
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
        { key: 'attendance', label: 'Attendance', href: '/attendance' },
        ...shared,
      ];
    }
    return [
      { key: 'broadcast', label: 'Notify', href: '/more' },
      { key: 'students', label: 'Students', href: '/more' },
      ...shared,
    ];
  }
}
