import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  buildRouteCapacitySnapshot,
  sumVehicleCapacity,
} from '../utils/transport-capacity.util';

@Injectable()
export class TransportCapacityService {
  constructor(private readonly prisma: PrismaService) {}

  async routeCapacity(tenantId: string, routeId: string) {
    const route = await this.prisma.transportRoute.findFirst({
      where: { tenantId, id: routeId },
      include: {
        vehicles: { where: { status: 'ACTIVE' }, select: { capacity: true } },
        _count: { select: { assignments: { where: { status: 'ACTIVE' } } } },
      },
    });
    if (!route) throw new NotFoundException('Route not found');

    const capacity = sumVehicleCapacity(route.vehicles);
    const assigned = route._count.assignments;
    const snapshot = buildRouteCapacitySnapshot(
      assigned,
      capacity,
      route.capacityWarningPercent,
    );

    return {
      routeId: route.id,
      code: route.code,
      name: route.name,
      ...snapshot,
    };
  }

  async listAlerts(tenantId: string) {
    const routes = await this.prisma.transportRoute.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        vehicles: { where: { status: 'ACTIVE' }, select: { capacity: true } },
        _count: { select: { assignments: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { code: 'asc' },
    });

    return routes
      .map((route) => {
        const capacity = sumVehicleCapacity(route.vehicles);
        const assigned = route._count.assignments;
        const snapshot = buildRouteCapacitySnapshot(
          assigned,
          capacity,
          route.capacityWarningPercent,
        );
        return {
          routeId: route.id,
          code: route.code,
          name: route.name,
          ...snapshot,
          severity: snapshot.atCapacity
            ? 'CRITICAL'
            : snapshot.nearCapacity
              ? 'WARNING'
              : 'OK',
        };
      })
      .filter((r) => r.atCapacity || r.nearCapacity);
  }
}
