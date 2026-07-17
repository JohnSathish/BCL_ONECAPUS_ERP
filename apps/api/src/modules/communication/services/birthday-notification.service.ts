import { Injectable, Logger } from '@nestjs/common';
import { CommunicationTriggerService } from './communication-trigger.service';
import { BirthdayQueryService } from './birthday-query.service';

@Injectable()
export class BirthdayNotificationService {
  private readonly logger = new Logger(BirthdayNotificationService.name);

  constructor(
    private readonly query: BirthdayQueryService,
    private readonly triggers: CommunicationTriggerService,
  ) {}

  async processTenantStudentBirthdays(tenantId: string, year: number) {
    const institutionName = await this.triggers.getInstitutionName(tenantId);
    const birthdays = await this.query.findStudentBirthdaysToday(tenantId);

    let selfSent = 0;
    let peerSent = 0;

    for (const birthday of birthdays) {
      const selfResult = await this.triggers.trigger({
        tenantId,
        templateCode: 'STUDENT_BIRTHDAY_SELF',
        triggerKey: `student.birthday.self.${year}.${birthday.studentId}`,
        entityType: 'student_birthday',
        entityId: birthday.studentId,
        recipient: {
          recipientType: 'STUDENT',
          userId: birthday.userId,
          studentId: birthday.studentId,
          displayName: birthday.fullName,
          email: birthday.email ?? undefined,
        },
        variables: {
          student_name: birthday.fullName,
          institution_name: institutionName,
          program_name: birthday.programName ?? '',
          department_name: birthday.departmentName ?? '',
        },
        channels: ['IN_APP', 'PUSH'],
      });
      if (!selfResult.skipped) selfSent += 1;

      const peers = await this.query.findStudentPeers(
        tenantId,
        birthday.studentId,
        birthday,
      );

      for (const peer of peers) {
        const peerResult = await this.triggers.trigger({
          tenantId,
          templateCode: 'STUDENT_BIRTHDAY_PEER',
          triggerKey: `student.birthday.peer.${year}.${peer.userId}.${birthday.studentId}`,
          entityType: 'student_birthday_peer',
          entityId: `${peer.userId}:${birthday.studentId}`,
          recipient: {
            recipientType: 'STUDENT',
            userId: peer.userId,
            studentId: peer.studentId,
            displayName: peer.displayName,
            email: peer.email ?? undefined,
          },
          variables: {
            student_name: birthday.fullName,
            institution_name: institutionName,
            program_name: birthday.programName ?? '',
            department_name: birthday.departmentName ?? '',
          },
          channels: ['IN_APP', 'PUSH'],
        });
        if (!peerResult.skipped) peerSent += 1;
      }
    }

    this.logger.log(
      `Tenant ${tenantId}: student birthdays ${birthdays.length}, self sent ${selfSent}, peer sent ${peerSent}`,
    );
  }

  async processTenantStaffBirthdays(tenantId: string, year: number) {
    const institutionName = await this.triggers.getInstitutionName(tenantId);
    const birthdays = await this.query.findStaffBirthdaysToday(tenantId);

    let selfSent = 0;
    let colleagueSent = 0;

    for (const birthday of birthdays) {
      const selfResult = await this.triggers.trigger({
        tenantId,
        templateCode: 'STAFF_BIRTHDAY_SELF',
        triggerKey: `staff.birthday.self.${year}.${birthday.staffProfileId}`,
        entityType: 'staff_birthday',
        entityId: birthday.staffProfileId,
        recipient: {
          recipientType: 'FACULTY',
          userId: birthday.portalUserId,
          staffProfileId: birthday.staffProfileId,
          displayName: birthday.fullName,
          email: birthday.email ?? undefined,
        },
        variables: {
          staff_name: birthday.fullName,
          institution_name: institutionName,
          department_name: birthday.departmentName ?? '',
        },
        channels: ['IN_APP', 'PUSH'],
      });
      if (!selfResult.skipped) selfSent += 1;

      const colleagues = await this.query.findStaffColleagues(
        tenantId,
        birthday.staffProfileId,
        birthday.departmentId,
      );

      for (const colleague of colleagues) {
        const colleagueResult = await this.triggers.trigger({
          tenantId,
          templateCode: 'STAFF_BIRTHDAY_COLLEAGUE',
          triggerKey: `staff.birthday.colleague.${year}.${colleague.portalUserId}.${birthday.staffProfileId}`,
          entityType: 'staff_birthday_colleague',
          entityId: `${colleague.portalUserId}:${birthday.staffProfileId}`,
          recipient: {
            recipientType: 'FACULTY',
            userId: colleague.portalUserId,
            staffProfileId: colleague.staffProfileId,
            displayName: colleague.displayName,
            email: colleague.email ?? undefined,
          },
          variables: {
            staff_name: birthday.fullName,
            institution_name: institutionName,
            department_name: birthday.departmentName ?? '',
          },
          channels: ['IN_APP', 'PUSH'],
        });
        if (!colleagueResult.skipped) colleagueSent += 1;
      }
    }

    this.logger.log(
      `Tenant ${tenantId}: staff birthdays ${birthdays.length}, self sent ${selfSent}, colleague sent ${colleagueSent}`,
    );
  }
}
