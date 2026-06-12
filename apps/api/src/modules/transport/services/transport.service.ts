import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  AssignStudentDto,
  CreateRouteDto,
  CreateStopDto,
  CreateVehicleDto,
  ListQueryDto,
  UpdateRouteDto,
  UpdateVehicleDto,
} from '../dto/transport.dto';
import {
  buildRouteCapacitySnapshot,
  sumVehicleCapacity,
} from '../utils/transport-capacity.util';
import { TransportCapacityService } from './transport-capacity.service';
import { TransportNotificationsService } from './transport-notifications.service';

@Injectable()
export class TransportRoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListQueryDto) {
    const where = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
    };
    return this.prisma.transportRoute.findMany({
      where,
      include: {
        stops: { orderBy: { sortOrder: 'asc' } },
        vehicles: { where: { status: 'ACTIVE' } },
        _count: { select: { assignments: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { code: 'asc' },
      take: query.limit ?? 50,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.transportRoute.findFirst({
      where: { tenantId, id },
      include: {
        stops: { orderBy: { sortOrder: 'asc' } },
        vehicles: true,
        assignments: {
          where: { status: 'ACTIVE' },
          take: 100,
        },
      },
    });
    if (!row) throw new NotFoundException('Route not found');
    return row;
  }

  async create(user: JwtUser, dto: CreateRouteDto) {
    const exists = await this.prisma.transportRoute.findFirst({
      where: { tenantId: user.tid, code: dto.code.trim().toUpperCase() },
    });
    if (exists) throw new BadRequestException('Route code already exists');

    return this.prisma.transportRoute.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
        startPoint: dto.startPoint?.trim(),
        endPoint: dto.endPoint?.trim(),
        fareAmount: dto.fareAmount,
        capacityWarningPercent: dto.capacityWarningPercent ?? 90,
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateRouteDto) {
    await this.get(user.tid, id);
    return this.prisma.transportRoute.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        startPoint: dto.startPoint?.trim(),
        endPoint: dto.endPoint?.trim(),
        fareAmount: dto.fareAmount,
        capacityWarningPercent: dto.capacityWarningPercent,
        status: dto.status,
      },
    });
  }

  async addStop(user: JwtUser, routeId: string, dto: CreateStopDto) {
    await this.get(user.tid, routeId);
    const maxOrder = await this.prisma.transportRouteStop.aggregate({
      where: { tenantId: user.tid, routeId },
      _max: { sortOrder: true },
    });

    return this.prisma.transportRouteStop.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        routeId,
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
        pickupTime: dto.pickupTime?.trim(),
      },
    });
  }
}

@Injectable()
export class TransportVehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListQueryDto) {
    return this.prisma.transportVehicle.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.routeId ? { routeId: query.routeId } : {}),
      },
      include: { route: { select: { id: true, code: true, name: true } } },
      orderBy: { registrationNo: 'asc' },
      take: query.limit ?? 50,
    });
  }

  async create(user: JwtUser, dto: CreateVehicleDto) {
    return this.prisma.transportVehicle.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        registrationNo: dto.registrationNo.trim().toUpperCase(),
        vehicleType: dto.vehicleType ?? 'BUS',
        capacity: dto.capacity ?? 40,
        driverName: dto.driverName?.trim(),
        driverMobile: dto.driverMobile?.trim(),
        routeId: dto.routeId,
      },
      include: { route: true },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateVehicleDto) {
    const row = await this.prisma.transportVehicle.findFirst({
      where: { tenantId: user.tid, id },
    });
    if (!row) throw new NotFoundException('Vehicle not found');
    return this.prisma.transportVehicle.update({
      where: { id },
      data: {
        vehicleType: dto.vehicleType,
        capacity: dto.capacity,
        driverName: dto.driverName?.trim(),
        driverMobile: dto.driverMobile?.trim(),
        routeId: dto.routeId === undefined ? undefined : dto.routeId,
        status: dto.status,
      },
      include: { route: true },
    });
  }
}

@Injectable()
export class TransportAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: TransportNotificationsService,
  ) {}

  async list(tenantId: string, query: ListQueryDto) {
    const items = await this.prisma.transportStudentAssignment.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.routeId ? { routeId: query.routeId } : {}),
      },
      include: {
        route: { select: { code: true, name: true } },
        stop: { select: { name: true, pickupTime: true } },
      },
      orderBy: { assignedAt: 'desc' },
      take: query.limit ?? 100,
    });

    const studentIds = [...new Set(items.map((i) => i.studentId))];
    const students = studentIds.length
      ? await this.prisma.student.findMany({
          where: { tenantId, id: { in: studentIds } },
          include: { masterProfile: { select: { fullName: true } } },
        })
      : [];

    return items.map((a) => ({
      ...a,
      studentName:
        students.find((s) => s.id === a.studentId)?.masterProfile?.fullName ??
        students.find((s) => s.id === a.studentId)?.enrollmentNumber ??
        a.studentId,
      enrollmentNumber: students.find((s) => s.id === a.studentId)
        ?.enrollmentNumber,
    }));
  }

  async assign(user: JwtUser, dto: AssignStudentDto) {
    const route = await this.prisma.transportRoute.findFirst({
      where: { tenantId: user.tid, id: dto.routeId, status: 'ACTIVE' },
    });
    if (!route) throw new NotFoundException('Route not found');

    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, id: dto.studentId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    const activeCount = await this.prisma.transportStudentAssignment.count({
      where: { tenantId: user.tid, routeId: dto.routeId, status: 'ACTIVE' },
    });
    const vehicles = await this.prisma.transportVehicle.findMany({
      where: { tenantId: user.tid, routeId: dto.routeId, status: 'ACTIVE' },
      select: { capacity: true },
    });
    const routeCapacity = sumVehicleCapacity(vehicles);
    if (routeCapacity > 0 && activeCount >= routeCapacity) {
      throw new BadRequestException(
        `Route ${route.code} is at capacity (${routeCapacity})`,
      );
    }

    await this.prisma.transportStudentAssignment.updateMany({
      where: { tenantId: user.tid, studentId: dto.studentId, status: 'ACTIVE' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    const assignment = await this.prisma.transportStudentAssignment.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        studentId: dto.studentId,
        routeId: dto.routeId,
        stopId: dto.stopId,
        academicYearId: dto.academicYearId,
        assignedByUserId: user.sub,
        status: 'ACTIVE',
      },
      include: { route: true, stop: true },
    });

    if (dto.notifyParents !== false) {
      await this.notifications.notifyAssignmentCreated(user.tid, assignment.id);
    }

    const snapshot = buildRouteCapacitySnapshot(
      activeCount + 1,
      routeCapacity,
      route.capacityWarningPercent,
    );
    if (snapshot.nearCapacity || snapshot.atCapacity) {
      await this.notifications.notifyCapacityWarning(user.tid, dto.routeId);
    }

    return this.prisma.transportStudentAssignment.findFirst({
      where: { id: assignment.id },
      include: { route: true, stop: true },
    });
  }

  async cancel(user: JwtUser, id: string) {
    const row = await this.prisma.transportStudentAssignment.findFirst({
      where: { tenantId: user.tid, id, status: 'ACTIVE' },
    });
    if (!row) throw new NotFoundException('Assignment not found');

    await this.notifications.notifyAssignmentCancelled(user.tid, id);

    return this.prisma.transportStudentAssignment.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }
}

@Injectable()
export class TransportDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacity: TransportCapacityService,
  ) {}

  async dashboard(tenantId: string) {
    const [activeRoutes, activeVehicles, assignedStudents, totalCapacity] =
      await Promise.all([
        this.prisma.transportRoute.count({
          where: { tenantId, status: 'ACTIVE' },
        }),
        this.prisma.transportVehicle.count({
          where: { tenantId, status: 'ACTIVE' },
        }),
        this.prisma.transportStudentAssignment.count({
          where: { tenantId, status: 'ACTIVE' },
        }),
        this.prisma.transportVehicle.aggregate({
          where: { tenantId, status: 'ACTIVE' },
          _sum: { capacity: true },
        }),
      ]);

    const routeLoad = await this.prisma.transportRoute.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        _count: { select: { assignments: { where: { status: 'ACTIVE' } } } },
        vehicles: { where: { status: 'ACTIVE' }, select: { capacity: true } },
      },
      take: 10,
    });

    const capacityAlerts = await this.capacity.listAlerts(tenantId);
    const routesAtCapacity = capacityAlerts.filter((a) => a.atCapacity).length;
    const routesNearCapacity = capacityAlerts.filter(
      (a) => a.nearCapacity,
    ).length;

    return {
      activeRoutes,
      activeVehicles,
      assignedStudents,
      totalCapacity: totalCapacity._sum.capacity ?? 0,
      utilizationPercent:
        (totalCapacity._sum.capacity ?? 0) > 0
          ? Math.round(
              (assignedStudents / (totalCapacity._sum.capacity ?? 1)) * 100,
            )
          : 0,
      routesAtCapacity,
      routesNearCapacity,
      capacityAlerts,
      routeLoad: routeLoad.map((r) => {
        const capacity = sumVehicleCapacity(r.vehicles);
        const assigned = r._count.assignments;
        const snapshot = buildRouteCapacitySnapshot(
          assigned,
          capacity,
          r.capacityWarningPercent,
        );
        return {
          id: r.id,
          code: r.code,
          name: r.name,
          assigned,
          capacity,
          utilizationPct: snapshot.utilizationPct,
          atCapacity: snapshot.atCapacity,
          nearCapacity: snapshot.nearCapacity,
        };
      }),
    };
  }
}
