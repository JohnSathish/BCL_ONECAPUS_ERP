import { Injectable, Logger } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import { PrismaService } from '../../../database/prisma.service';
import {
  BIRTHDAY_POPUP_MESSAGE,
  birthdayOccursToday,
  istBirthdayDateKey,
} from './birthday-popup.logic';

const USER_TYPE = 'STUDENT';

export type BirthdayPopupStatus = {
  isBirthday: boolean;
  shouldDisplay: boolean;
  birthdayDate: string | null;
  studentName: string;
  profilePhoto: string | null;
  message: string;
  collegeName: string;
  dismissed: boolean;
};

const HIDDEN: BirthdayPopupStatus = {
  isBirthday: false,
  shouldDisplay: false,
  birthdayDate: null,
  studentName: '',
  profilePhoto: null,
  message: '',
  collegeName: '',
  dismissed: false,
};

@Injectable()
export class StudentBirthdayPopupService {
  private readonly logger = new Logger(StudentBirthdayPopupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async status(user: JwtUser): Promise<BirthdayPopupStatus> {
    try {
      const student = await this.loadStudent(user);
      if (!student) return HIDDEN;
      const birthdayDate = istBirthdayDateKey();
      const isBirthday = birthdayOccursToday(
        student.masterProfile?.dateOfBirth,
      );
      const collegeName = await this.collegeName(user.tid);
      const studentName = student.masterProfile?.fullName?.trim() || 'Student';
      const profilePhoto = toPublicUploadUrl(student.masterProfile?.photoPath);
      if (!isBirthday) {
        return {
          ...HIDDEN,
          studentName,
          collegeName,
          birthdayDate,
        };
      }
      const ack = await this.prisma.birthdayPopupAck.findUnique({
        where: {
          tenantId_userId_userType_birthdayDate: {
            tenantId: user.tid,
            userId: user.sub,
            userType: USER_TYPE,
            birthdayDate,
          },
        },
      });
      const dismissed = Boolean(ack?.dismissedAt);
      const alreadyShown = Boolean(ack?.shownAt || ack?.dismissedAt);
      return {
        isBirthday: true,
        shouldDisplay: !alreadyShown,
        birthdayDate,
        studentName,
        profilePhoto,
        message: BIRTHDAY_POPUP_MESSAGE,
        collegeName,
        dismissed,
      };
    } catch (error) {
      this.logger.warn(
        `Birthday popup status failed for user ${user.sub}: ${error instanceof Error ? error.name : 'error'}`,
      );
      return HIDDEN;
    }
  }

  async markShown(user: JwtUser) {
    return this.record(user, 'shown');
  }

  async dismiss(user: JwtUser) {
    return this.record(user, 'dismissed');
  }

  private async record(user: JwtUser, kind: 'shown' | 'dismissed') {
    const student = await this.loadStudent(user);
    const birthdayDate = istBirthdayDateKey();
    if (!student || !birthdayOccursToday(student.masterProfile?.dateOfBirth)) {
      return { recorded: false, birthdayDate };
    }
    const now = new Date();
    await this.prisma.birthdayPopupAck.upsert({
      where: {
        tenantId_userId_userType_birthdayDate: {
          tenantId: user.tid,
          userId: user.sub,
          userType: USER_TYPE,
          birthdayDate,
        },
      },
      create: {
        tenantId: user.tid,
        userId: user.sub,
        userType: USER_TYPE,
        birthdayDate,
        shownAt: now,
        dismissedAt: kind === 'dismissed' ? now : null,
      },
      update:
        kind === 'dismissed'
          ? { dismissedAt: now, shownAt: now }
          : { shownAt: now },
    });
    return { recorded: true, birthdayDate };
  }

  private async loadStudent(user: JwtUser) {
    return this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: {
        id: true,
        masterProfile: {
          select: { fullName: true, dateOfBirth: true, photoPath: true },
        },
      },
    });
  }

  private async collegeName(tenantId: string) {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: { displayName: true, shortName: true },
    });
    return (
      branding?.displayName?.trim() ||
      branding?.shortName?.trim() ||
      'Don Bosco College, Tura'
    );
  }
}
