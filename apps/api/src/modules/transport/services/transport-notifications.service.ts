import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { ResolvedRecipient } from '../../communication/services/communication-audience.service';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';

@Injectable()
export class TransportNotificationsService {
  private readonly logger = new Logger(TransportNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly communication: CommunicationTriggerService,
  ) {}

  private async parentRecipients(
    tenantId: string,
    studentId: string,
  ): Promise<ResolvedRecipient[]> {
    const guardians = await this.prisma.studentGuardian.findMany({
      where: {
        tenantId,
        studentId,
        OR: [{ contactNumber: { not: null } }, { email: { not: null } }],
      },
    });

    const student = await this.prisma.student.findFirst({
      where: { tenantId, id: studentId, deletedAt: null },
      include: { masterProfile: { select: { fullName: true } } },
    });
    const studentName =
      student?.masterProfile?.fullName ??
      student?.enrollmentNumber ??
      'Student';

    return guardians.map((g) => ({
      recipientType: 'PARENT' as const,
      displayName: g.fullName ?? `Parent of ${studentName}`,
      email: g.email ?? undefined,
      phone: g.contactNumber ?? undefined,
      studentId,
    }));
  }

  private async assignmentContext(tenantId: string, assignmentId: string) {
    return this.prisma.transportStudentAssignment.findFirst({
      where: { tenantId, id: assignmentId },
      include: {
        route: {
          include: {
            vehicles: {
              where: { status: 'ACTIVE' },
              take: 1,
              orderBy: { capacity: 'desc' },
            },
          },
        },
        stop: { select: { name: true, pickupTime: true } },
      },
    });
  }

  async notifyAssignmentCreated(
    tenantId: string,
    assignmentId: string,
  ): Promise<string> {
    const assignment = await this.assignmentContext(tenantId, assignmentId);
    if (!assignment) return 'SKIPPED';

    const student = await this.prisma.student.findFirst({
      where: { tenantId, id: assignment.studentId, deletedAt: null },
      include: { masterProfile: { select: { fullName: true } } },
    });
    const studentName =
      student?.masterProfile?.fullName ??
      student?.enrollmentNumber ??
      'Student';
    const vehicle = assignment.route.vehicles[0];
    const institutionName =
      await this.communication.getInstitutionName(tenantId);

    const variables = {
      student_name: studentName,
      route_code: assignment.route.code,
      route_name: assignment.route.name,
      stop_name: assignment.stop?.name ?? '—',
      pickup_time: assignment.stop?.pickupTime ?? '—',
      driver_name: vehicle?.driverName ?? '—',
      driver_mobile: vehicle?.driverMobile ?? '—',
      institution_name: institutionName,
    };

    const recipients = await this.parentRecipients(
      tenantId,
      assignment.studentId,
    );
    if (!recipients.length) {
      await this.updateNotificationStatus(assignmentId, 'NO_GUARDIAN');
      return 'NO_GUARDIAN';
    }

    let sent = 0;
    for (const recipient of recipients) {
      try {
        const result = await this.communication.trigger({
          tenantId,
          templateCode: 'TRANSPORT_ASSIGNED',
          triggerKey: 'transport.assignment.created',
          entityType: 'transport_assignment',
          entityId: `${assignmentId}:${recipient.phone ?? recipient.email ?? recipient.displayName}`,
          recipient,
          variables,
          channels: ['IN_APP', 'EMAIL'],
        });
        if (!result.skipped) sent++;
      } catch (err) {
        this.logger.warn(
          `Parent notify failed for assignment ${assignmentId}: ${String(err)}`,
        );
      }
    }

    const status = sent > 0 ? 'SENT' : 'SKIPPED';
    await this.updateNotificationStatus(assignmentId, status);
    return status;
  }

  async notifyAssignmentCancelled(
    tenantId: string,
    assignmentId: string,
  ): Promise<string> {
    const assignment = await this.assignmentContext(tenantId, assignmentId);
    if (!assignment) return 'SKIPPED';

    const student = await this.prisma.student.findFirst({
      where: { tenantId, id: assignment.studentId, deletedAt: null },
      include: { masterProfile: { select: { fullName: true } } },
    });
    const studentName =
      student?.masterProfile?.fullName ??
      student?.enrollmentNumber ??
      'Student';
    const institutionName =
      await this.communication.getInstitutionName(tenantId);

    const variables = {
      student_name: studentName,
      route_code: assignment.route.code,
      route_name: assignment.route.name,
      institution_name: institutionName,
    };

    const recipients = await this.parentRecipients(
      tenantId,
      assignment.studentId,
    );
    if (!recipients.length) return 'NO_GUARDIAN';

    let sent = 0;
    for (const recipient of recipients) {
      try {
        const result = await this.communication.trigger({
          tenantId,
          templateCode: 'TRANSPORT_CANCELLED',
          triggerKey: 'transport.assignment.cancelled',
          entityType: 'transport_assignment',
          entityId: `${assignmentId}:cancel:${recipient.phone ?? recipient.email ?? recipient.displayName}`,
          recipient,
          variables,
          channels: ['IN_APP', 'EMAIL'],
          skipDedupe: true,
        });
        if (!result.skipped) sent++;
      } catch (err) {
        this.logger.warn(
          `Parent cancel notify failed for assignment ${assignmentId}: ${String(err)}`,
        );
      }
    }

    return sent > 0 ? 'SENT' : 'SKIPPED';
  }

  async notifyCapacityWarning(
    tenantId: string,
    routeId: string,
  ): Promise<boolean> {
    const route = await this.prisma.transportRoute.findFirst({
      where: { tenantId, id: routeId },
      include: {
        vehicles: { where: { status: 'ACTIVE' }, select: { capacity: true } },
        _count: { select: { assignments: { where: { status: 'ACTIVE' } } } },
      },
    });
    if (!route) return false;

    const capacity = route.vehicles.reduce((sum, v) => sum + v.capacity, 0);
    const assigned = route._count.assignments;
    const threshold = Math.ceil(
      (capacity * route.capacityWarningPercent) / 100,
    );
    if (capacity <= 0 || assigned < threshold) return false;

    const coordinators = await this.prisma.userRole.findMany({
      where: {
        deletedAt: null,
        role: {
          tenantId,
          slug: { in: ['transport-coordinator', 'college-admin'] },
        },
      },
      include: {
        user: {
          select: { id: true, email: true, displayName: true, phone: true },
        },
      },
      take: 20,
    });

    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    const variables = {
      route_code: route.code,
      route_name: route.name,
      assigned: String(assigned),
      capacity: String(capacity),
      institution_name: institutionName,
    };

    let sent = false;
    for (const row of coordinators) {
      if (!row.user) continue;
      const recipient: ResolvedRecipient = {
        recipientType: 'USER',
        userId: row.user.id,
        displayName: row.user.displayName ?? 'Transport Coordinator',
        email: row.user.email ?? undefined,
        phone: row.user.phone ?? undefined,
      };
      const result = await this.communication.trigger({
        tenantId,
        templateCode: 'TRANSPORT_CAPACITY_WARNING',
        triggerKey: 'transport.route.capacity_warning',
        entityType: 'transport_route',
        entityId: routeId,
        recipient,
        variables,
        channels: ['IN_APP', 'EMAIL'],
      });
      if (!result.skipped) sent = true;
    }
    return sent;
  }

  private async updateNotificationStatus(assignmentId: string, status: string) {
    await this.prisma.transportStudentAssignment.update({
      where: { id: assignmentId },
      data: {
        notificationStatus: status,
        parentNotifiedAt: status === 'SENT' ? new Date() : undefined,
      },
    });
  }
}
