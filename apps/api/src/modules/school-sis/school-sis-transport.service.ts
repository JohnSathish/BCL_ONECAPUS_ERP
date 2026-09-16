import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisEventBus } from './school-sis-event-bus.service';
import {
  capacityBand,
  documentLifecycle,
  estimatedMinutes,
  haversineMeters,
  resolveSchoolTransportMapConfig,
} from './school-sis-transport-map';
import type {
  BoardingDto,
  BreakdownDto,
  BulkAllocationDto,
  BulkAttendanceDto,
  GenerateTripsDto,
  GpsPingDto,
  ImportRowsDto,
  ReviewRequestDto,
  SaveAllocationDto,
  SaveConcessionDto,
  SaveFeePlanDto,
  SaveFuelDto,
  SaveGeofenceDto,
  SaveIncidentDto,
  SaveMaintenanceDto,
  SavePersonnelDocumentDto,
  SavePersonnelDto,
  SaveRequestDto,
  SaveRouteDto,
  SaveStopDto,
  SaveTransportSettingsDto,
  SaveVehicleDocumentDto,
  SaveVehicleDto,
  TripActionDto,
} from './dto/school-transport.dto';

export type TransportActor = {
  userId: string;
  manage: boolean;
  canOverride: boolean;
  ip?: string;
  personnelId?: string;
};

const DEFAULT_POLICY = {
  enabled: true,
  documentExpiryDays: 30,
  gpsIntervalSeconds: 20,
  gpsStaleSeconds: 90,
  gpsRetentionDays: 90,
  trackWhenIdle: false,
  boardingRequired: true,
  dropRequired: true,
  allowManualAttendance: true,
  attendanceEditMinutes: 1440,
  etaSpeedKmh: 25,
  expectedKmplMin: 0,
  expectedKmplMax: 0,
  notifyBoarding: true,
  notifyDrop: true,
  notifyDelay: true,
  notifyEmergency: true,
  notifyBreakdown: true,
  feeMethod: 'ROUTE',
  billingFrequency: 'MONTHLY',
  feeGraceDays: 7,
};

function d(v?: string | null) {
  return v ? new Date(`${v.slice(0, 10)}T00:00:00.000Z`) : undefined;
}

function json(v: unknown): Prisma.InputJsonValue {
  return (v ?? {}) as Prisma.InputJsonValue;
}

function policyOf(row: { policyJson?: unknown } | null) {
  const extra =
    row?.policyJson && typeof row.policyJson === 'object'
      ? (row.policyJson as Record<string, unknown>)
      : {};
  return { ...DEFAULT_POLICY, ...extra };
}

function pageOf(q: { page?: string; limit?: string }) {
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit ?? 25) || 25));
  return { page, limit, skip: (page - 1) * limit };
}

@Injectable()
export class SchoolSisTransportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly events: SchoolSisEventBus,
  ) {}

  private async boot(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const settings = await this.prisma.schoolTransportSettings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
    return { year, settings, policy: policyOf(settings) };
  }

  private async audit(
    tenantId: string,
    actor: TransportActor,
    action: string,
    recordId: string | null,
    oldValue: unknown,
    newValue: unknown,
    reason?: string,
  ) {
    await this.prisma.schoolTransportAuditLog.create({
      data: {
        tenantId,
        userId: actor.userId,
        action,
        recordId,
        oldValue: oldValue == null ? undefined : json(oldValue),
        newValue: newValue == null ? undefined : json(newValue),
        reason,
      },
    });
  }

  private async notify(
    tenantId: string,
    eventType: string,
    title: string,
    body: string,
    extra?: { tripId?: string; studentId?: string; emergency?: boolean },
  ) {
    await this.prisma.schoolTransportNotification.create({
      data: {
        tenantId,
        tripId: extra?.tripId,
        studentId: extra?.studentId,
        eventType,
        channel: 'IN_APP',
        title,
        body,
        status: 'QUEUED',
      },
    });
    await this.events.publish({
      event: eventType,
      tenantId,
      studentId: extra?.studentId,
      entityId: extra?.tripId,
      emergency: extra?.emergency,
      data: { title, body },
    });
  }

  async dashboard(tenantId: string) {
    const { year, settings, policy } = await this.boot(tenantId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const warnDays = Number(policy.documentExpiryDays ?? 30);
    const soon = new Date();
    soon.setDate(soon.getDate() + warnDays);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      vehicles,
      activeVehicles,
      maintVehicles,
      routes,
      activeRoutes,
      studentsUsing,
      allStudents,
      drivers,
      attendants,
      tripsToday,
      boarded,
      dropped,
      pendingFee,
      expiringDocs,
      emergencies,
      monthMaint,
      monthFuel,
      upcomingService,
      overdueService,
    ] = await Promise.all([
      this.prisma.schoolTransportVehicle.count({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.schoolTransportVehicle.count({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      }),
      this.prisma.schoolTransportVehicle.count({
        where: { tenantId, deletedAt: null, status: 'MAINTENANCE' },
      }),
      this.prisma.schoolTransportRoute.count({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.schoolTransportRoute.count({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      }),
      this.prisma.schoolTransportStudentAllocation.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          academicYearId: year.id,
        },
      }),
      this.prisma.schoolStudent.count({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      }),
      this.prisma.schoolTransportPersonnel.count({
        where: { tenantId, deletedAt: null, kind: 'DRIVER' },
      }),
      this.prisma.schoolTransportPersonnel.count({
        where: { tenantId, deletedAt: null, kind: 'ATTENDANT' },
      }),
      this.prisma.schoolTransportTrip.count({
        where: { tenantId, date: today },
      }),
      this.prisma.schoolTransportBoardingEvent.count({
        where: { tenantId, eventType: 'BOARDED', occurredAt: { gte: today } },
      }),
      this.prisma.schoolTransportBoardingEvent.count({
        where: { tenantId, eventType: 'DROPPED', occurredAt: { gte: today } },
      }),
      this.prisma.schoolTransportFeeAssignment.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.schoolTransportVehicleDocument.count({
        where: {
          tenantId,
          deletedAt: null,
          expiryDate: { gte: today, lte: soon },
        },
      }),
      this.prisma.schoolTransportIncident.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: ['OPEN', 'ACKNOWLEDGED'] },
          severity: { in: ['HIGH', 'CRITICAL'] },
        },
      }),
      this.prisma.schoolTransportMaintenance.aggregate({
        where: { tenantId, deletedAt: null, date: { gte: monthStart } },
        _sum: { cost: true },
      }),
      this.prisma.schoolTransportFuelLog.aggregate({
        where: { tenantId, deletedAt: null, date: { gte: monthStart } },
        _sum: { totalAmount: true },
      }),
      this.prisma.schoolTransportMaintenance.count({
        where: {
          tenantId,
          deletedAt: null,
          nextServiceDate: { gte: today, lte: soon },
        },
      }),
      this.prisma.schoolTransportMaintenance.count({
        where: {
          tenantId,
          deletedAt: null,
          nextServiceDate: { lt: today },
        },
      }),
    ]);

    return {
      academicYear: year,
      settings: { ...settings, policy },
      map: this.mapConfig(settings, policy),
      kpis: {
        totalVehicles: vehicles,
        activeVehicles,
        vehiclesUnderMaintenance: maintVehicles,
        totalRoutes: routes,
        activeRoutes,
        studentsUsingTransport: studentsUsing,
        studentsNotAssigned: Math.max(0, allStudents - studentsUsing),
        drivers,
        attendants,
        todaysTrips: tripsToday,
        todaysBoarding: boarded,
        todaysDropoff: dropped,
        transportFeePending: pendingFee,
        expiringDocuments: expiringDocs,
        activeEmergencies: emergencies,
        maintenanceCostThisMonth: monthMaint._sum.cost ?? 0,
        fuelCostThisMonth: monthFuel._sum.totalAmount ?? 0,
        upcomingService,
        overdueService,
      },
    };
  }

  mapConfig(
    settings: {
      mapProvider: string;
      gpsEnabled: boolean;
      geofenceDefaultMeters: number;
    },
    policy: ReturnType<typeof policyOf>,
  ) {
    return resolveSchoolTransportMapConfig({
      mapProvider: settings.mapProvider,
      gpsEnabled: settings.gpsEnabled,
      intervalSeconds: Number(policy.gpsIntervalSeconds),
      staleSeconds: Number(policy.gpsStaleSeconds),
      geofenceMeters: settings.geofenceDefaultMeters,
      trackWhenIdle: Boolean(policy.trackWhenIdle),
    });
  }

  async getSettings(tenantId: string) {
    const { settings, policy, year } = await this.boot(tenantId);
    return {
      ...settings,
      policy,
      academicYear: year,
      map: this.mapConfig(settings, policy),
    };
  }

  async saveSettings(
    tenantId: string,
    actor: TransportActor,
    dto: SaveTransportSettingsDto,
  ) {
    if (!actor.manage) throw new ForbiddenException('Not allowed');
    const { settings } = await this.boot(tenantId);
    const next = await this.prisma.schoolTransportSettings.update({
      where: { id: settings.id },
      data: {
        transportName: dto.transportName,
        managerName: dto.managerName,
        emergencyContact: dto.emergencyContact,
        gpsEnabled: dto.gpsEnabled,
        gpsProvider: dto.gpsProvider,
        mapProvider: dto.mapProvider,
        gpsOfflineMinutes: dto.gpsOfflineMinutes,
        overspeedKmh: dto.overspeedKmh,
        geofenceDefaultMeters: dto.geofenceDefaultMeters,
        allowCapacityOverride: dto.allowCapacityOverride,
        requireCapacityApproval: dto.requireCapacityApproval,
        requireValidDocuments: dto.requireValidDocuments,
        blockExpiredDriver: dto.blockExpiredDriver,
        allowDriverOverride: dto.allowDriverOverride,
        notifyParents: dto.notifyParents,
        notifySms: dto.notifySms,
        notifyWhatsapp: dto.notifyWhatsapp,
        notifyEmail: dto.notifyEmail,
        notifyPush: dto.notifyPush,
        preTripChecklistRequired: dto.preTripChecklistRequired,
        postTripChecklistRequired: dto.postTripChecklistRequired,
        blockDispatchOnFail: dto.blockDispatchOnFail,
        policyJson: dto.policyJson ? json(dto.policyJson) : undefined,
      },
    });
    await this.audit(
      tenantId,
      actor,
      'SETTINGS_UPDATED',
      next.id,
      settings,
      next,
    );
    return this.getSettings(tenantId);
  }

  async listVehicles(tenantId: string, q: Record<string, string | undefined>) {
    const { year, policy } = await this.boot(tenantId);
    const { skip, limit, page } = pageOf(q);
    const where: Prisma.SchoolTransportVehicleWhereInput = {
      tenantId,
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { code: { contains: q.search, mode: 'insensitive' } },
              {
                registrationNumber: { contains: q.search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.schoolTransportVehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          documents: { where: { deletedAt: null } },
          routes: {
            where: { deletedAt: null, status: 'ACTIVE' },
            include: { driver: true, attendant: true },
            take: 1,
          },
          _count: { select: { allocations: true } },
        },
      }),
      this.prisma.schoolTransportVehicle.count({ where }),
    ]);
    const warn = Number(policy.documentExpiryDays);
    return {
      page,
      limit,
      total,
      academicYearId: year.id,
      items: rows.map((v) => {
        const docs = Object.fromEntries(
          v.documents.map((d) => [
            d.kind,
            documentLifecycle(d.expiryDate, warn),
          ]),
        );
        const route = v.routes[0];
        const cap = capacityBand(
          v._count.allocations,
          v.totalCapacity || v.seatingCapacity,
        );
        return {
          ...v,
          assignedRoute: route?.name ?? null,
          driver: route?.driver?.fullName ?? null,
          attendant: route?.attendant?.fullName ?? null,
          gpsStatus: v.gpsDeviceId ? 'LINKED' : 'NONE',
          insuranceStatus: docs.INSURANCE ?? 'UNKNOWN',
          fitnessStatus: docs.FITNESS ?? 'UNKNOWN',
          permitStatus: docs.PERMIT ?? 'UNKNOWN',
          pollutionStatus: docs.POLLUTION ?? 'UNKNOWN',
          capacity: cap,
        };
      }),
    };
  }

  async saveVehicle(
    tenantId: string,
    actor: TransportActor,
    dto: SaveVehicleDto,
    id?: string,
  ) {
    await this.boot(tenantId);
    const seating = dto.seatingCapacity ?? 0;
    const standing = dto.standingCapacity ?? 0;
    const data = {
      tenantId,
      code: dto.code?.trim() || `VEH-${Date.now().toString(36).toUpperCase()}`,
      registrationNumber: dto.registrationNumber.trim().toUpperCase(),
      vehicleType: dto.vehicleType ?? 'SCHOOL_BUS',
      make: dto.make,
      model: dto.model,
      year: dto.year,
      colour: dto.colour,
      seatingCapacity: seating,
      standingCapacity: standing,
      totalCapacity: seating + standing,
      ownership: dto.ownership ?? 'SCHOOL_OWNED',
      fuelType: dto.fuelType,
      odometer: dto.odometer ?? 0,
      gpsDeviceId: dto.gpsDeviceId,
      status: dto.status ?? 'ACTIVE',
      fleetRole: dto.fleetRole ?? 'PRIMARY',
      remarks: dto.remarks,
      detailsJson: dto.detailsJson ? json(dto.detailsJson) : undefined,
      updatedBy: actor.userId,
    };
    const row = id
      ? await this.prisma.schoolTransportVehicle.update({
          where: { id },
          data,
        })
      : await this.prisma.schoolTransportVehicle.create({
          data: { ...data, createdBy: actor.userId },
        });
    await this.audit(
      tenantId,
      actor,
      id ? 'VEHICLE_UPDATED' : 'VEHICLE_CREATED',
      row.id,
      null,
      row,
    );
    return row;
  }

  async saveVehicleDocument(
    tenantId: string,
    actor: TransportActor,
    vehicleId: string,
    dto: SaveVehicleDocumentDto,
    id?: string,
  ) {
    await this.boot(tenantId);
    const vehicle = await this.prisma.schoolTransportVehicle.findFirst({
      where: { id: vehicleId, tenantId, deletedAt: null },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const data = {
      tenantId,
      vehicleId,
      kind: dto.kind,
      documentNumber: dto.documentNumber,
      issueDate: d(dto.issueDate),
      expiryDate: d(dto.expiryDate),
      attachmentUrl: dto.attachmentUrl,
      remarks: dto.remarks,
      updatedBy: actor.userId,
    };
    const row = id
      ? await this.prisma.schoolTransportVehicleDocument.update({
          where: { id },
          data,
        })
      : await this.prisma.schoolTransportVehicleDocument.create({
          data: { ...data, createdBy: actor.userId },
        });
    await this.audit(
      tenantId,
      actor,
      'VEHICLE_DOCUMENT_SAVED',
      row.id,
      null,
      row,
    );
    return row;
  }

  async listPersonnel(
    tenantId: string,
    kind: string,
    q: Record<string, string | undefined>,
  ) {
    const { policy } = await this.boot(tenantId);
    const { skip, limit, page } = pageOf(q);
    const where: Prisma.SchoolTransportPersonnelWhereInput = {
      tenantId,
      deletedAt: null,
      kind,
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { fullName: { contains: q.search, mode: 'insensitive' } },
              { code: { contains: q.search, mode: 'insensitive' } },
              { mobile: { contains: q.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.schoolTransportPersonnel.findMany({
        where,
        skip,
        take: limit,
        include: { documents: { where: { deletedAt: null } } },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.schoolTransportPersonnel.count({ where }),
    ]);
    const warn = Number(policy.documentExpiryDays);
    return {
      page,
      limit,
      total,
      items: items.map((p) => ({
        ...p,
        licenseStatus: documentLifecycle(p.licenseExpiry, warn),
        documents: p.documents.map((d) => ({
          ...d,
          status: documentLifecycle(d.expiryDate, warn),
        })),
      })),
    };
  }

  async savePersonnel(
    tenantId: string,
    actor: TransportActor,
    dto: SavePersonnelDto,
    id?: string,
  ) {
    await this.boot(tenantId);
    const data = {
      tenantId,
      kind: dto.kind,
      employment: dto.employment ?? 'SCHOOL_STAFF',
      staffId: dto.staffId,
      code:
        dto.code?.trim() ||
        `${dto.kind.slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`,
      fullName: dto.fullName.trim(),
      photoUrl: dto.photoUrl,
      mobile: dto.mobile,
      address: dto.address,
      emergencyContact: dto.emergencyContact,
      licenseNumber: dto.licenseNumber,
      licenseType: dto.licenseType,
      licenseIssueDate: d(dto.licenseIssueDate),
      licenseExpiry: d(dto.licenseExpiry),
      experienceYears: dto.experienceYears,
      status: dto.status ?? 'ACTIVE',
      updatedBy: actor.userId,
    };
    const row = id
      ? await this.prisma.schoolTransportPersonnel.update({
          where: { id },
          data,
        })
      : await this.prisma.schoolTransportPersonnel.create({
          data: { ...data, createdBy: actor.userId },
        });
    await this.audit(
      tenantId,
      actor,
      id ? 'PERSONNEL_UPDATED' : 'PERSONNEL_CREATED',
      row.id,
      null,
      row,
    );
    return row;
  }

  async savePersonnelDocument(
    tenantId: string,
    actor: TransportActor,
    personnelId: string,
    dto: SavePersonnelDocumentDto,
  ) {
    await this.boot(tenantId);
    const row = await this.prisma.schoolTransportPersonnelDocument.create({
      data: {
        tenantId,
        personnelId,
        kind: dto.kind,
        documentNumber: dto.documentNumber,
        issueDate: d(dto.issueDate),
        expiryDate: d(dto.expiryDate),
        attachmentUrl: dto.attachmentUrl,
        remarks: dto.remarks,
      },
    });
    await this.audit(
      tenantId,
      actor,
      'PERSONNEL_DOCUMENT_SAVED',
      row.id,
      null,
      row,
    );
    return row;
  }

  async listStops(tenantId: string, q: Record<string, string | undefined>) {
    await this.boot(tenantId);
    const { skip, limit, page } = pageOf(q);
    const where: Prisma.SchoolTransportStopWhereInput = {
      tenantId,
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { code: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.schoolTransportStop.findMany({
        where,
        skip,
        take: limit,
        include: {
          routeStops: { include: { route: true } },
          _count: { select: { pickupAllocations: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.schoolTransportStop.count({ where }),
    ]);
    return { page, limit, total, items };
  }

  async saveStop(
    tenantId: string,
    actor: TransportActor,
    dto: SaveStopDto,
    id?: string,
  ) {
    await this.boot(tenantId);
    const data = {
      tenantId,
      code: dto.code?.trim() || `STP-${Date.now().toString(36).toUpperCase()}`,
      name: dto.name.trim(),
      area: dto.area,
      landmark: dto.landmark,
      latitude: dto.latitude,
      longitude: dto.longitude,
      geofenceMeters: dto.geofenceMeters,
      morningPickup: dto.morningPickup,
      afternoonDrop: dto.afternoonDrop,
      maxStudents: dto.maxStudents ?? 0,
      status: dto.status ?? 'ACTIVE',
      safetyJson: dto.safetyJson ? json(dto.safetyJson) : undefined,
      updatedBy: actor.userId,
    };
    const row = id
      ? await this.prisma.schoolTransportStop.update({ where: { id }, data })
      : await this.prisma.schoolTransportStop.create({
          data: { ...data, createdBy: actor.userId },
        });
    await this.audit(
      tenantId,
      actor,
      id ? 'STOP_UPDATED' : 'STOP_CREATED',
      row.id,
      null,
      row,
    );
    return row;
  }

  async listRoutes(tenantId: string, q: Record<string, string | undefined>) {
    const { year } = await this.boot(tenantId);
    const { skip, limit, page } = pageOf(q);
    const where: Prisma.SchoolTransportRouteWhereInput = {
      tenantId,
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { code: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.schoolTransportRoute.findMany({
        where,
        skip,
        take: limit,
        include: {
          vehicle: true,
          driver: true,
          attendant: true,
          stops: { include: { stop: true }, orderBy: { stopNumber: 'asc' } },
          _count: {
            select: {
              allocations: {
                where: {
                  status: 'ACTIVE',
                  deletedAt: null,
                  academicYearId: year.id,
                },
              },
            },
          },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.schoolTransportRoute.count({ where }),
    ]);
    return {
      page,
      limit,
      total,
      items: items.map((r) => {
        const max =
          r.maxCapacity ||
          r.vehicle?.totalCapacity ||
          r.vehicle?.seatingCapacity ||
          0;
        return {
          ...r,
          assigned: r._count.allocations,
          capacity: capacityBand(r._count.allocations, max),
        };
      }),
    };
  }

  private async assertDriverEligible(
    tenantId: string,
    driverId: string | undefined,
    override?: boolean,
    actor?: TransportActor,
  ) {
    if (!driverId) return;
    const { settings } = await this.boot(tenantId);
    const driver = await this.prisma.schoolTransportPersonnel.findFirst({
      where: { id: driverId, tenantId, deletedAt: null },
    });
    if (!driver) throw new BadRequestException('Driver not found');
    if (driver.status !== 'ACTIVE' || driver.blocked) {
      throw new BadRequestException('Driver is not eligible for assignment');
    }
    const expired =
      driver.licenseExpiry && driver.licenseExpiry.getTime() < Date.now();
    if (expired && settings.blockExpiredDriver) {
      if (!(override && settings.allowDriverOverride && actor?.canOverride)) {
        throw new BadRequestException(
          'Driver licence is expired. An authorised override is required.',
        );
      }
    }
  }

  async saveRoute(
    tenantId: string,
    actor: TransportActor,
    dto: SaveRouteDto,
    id?: string,
  ) {
    await this.boot(tenantId);
    await this.assertDriverEligible(
      tenantId,
      dto.driverId,
      dto.overrideDriver,
      actor,
    );
    const data = {
      tenantId,
      code: dto.code?.trim() || `R-${Date.now().toString(36).toUpperCase()}`,
      name: dto.name.trim(),
      direction: dto.direction ?? 'BOTH',
      routeType: dto.routeType ?? 'BOTH',
      startPoint: dto.startPoint,
      endPoint: dto.endPoint,
      maxCapacity: dto.maxCapacity,
      morningStartTime: dto.morningStartTime,
      schoolArrivalTime: dto.schoolArrivalTime,
      afternoonDepartureTime: dto.afternoonDepartureTime,
      distanceKm: dto.distanceKm,
      estimatedMinutes: dto.estimatedMinutes,
      vehicleId: dto.vehicleId,
      driverId: dto.driverId,
      attendantId: dto.attendantId,
      status: dto.status ?? 'ACTIVE',
      updatedBy: actor.userId,
    };
    const row = await this.prisma.$transaction(async (tx) => {
      const saved = id
        ? await tx.schoolTransportRoute.update({ where: { id }, data })
        : await tx.schoolTransportRoute.create({
            data: { ...data, createdBy: actor.userId },
          });
      if (dto.stops) {
        await tx.schoolTransportRouteStop.deleteMany({
          where: { routeId: saved.id, tenantId },
        });
        if (dto.stops.length) {
          await tx.schoolTransportRouteStop.createMany({
            data: dto.stops.map((s) => ({
              tenantId,
              routeId: saved.id,
              stopId: s.stopId,
              stopNumber: s.stopNumber,
              pickupTime: s.pickupTime,
              dropTime: s.dropTime,
            })),
          });
        }
      }
      return saved;
    });
    await this.audit(
      tenantId,
      actor,
      id ? 'ROUTE_UPDATED' : 'ROUTE_CREATED',
      row.id,
      null,
      row,
    );
    return row;
  }

  async searchStudents(tenantId: string, q: string) {
    await this.boot(tenantId);
    const term = q.trim();
    if (!term) return [];
    return this.prisma.schoolStudent.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { fullName: { contains: term, mode: 'insensitive' } },
          { admissionNumber: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term } },
        ],
      },
      take: 20,
      select: {
        id: true,
        fullName: true,
        admissionNumber: true,
        photoUrl: true,
        phone: true,
        usesTransport: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { section: { include: { grade: true } } },
        },
      },
    });
  }

  async listAllocations(
    tenantId: string,
    q: Record<string, string | undefined>,
  ) {
    const { year } = await this.boot(tenantId);
    await this.expireTemporary(tenantId);
    const { skip, limit, page } = pageOf(q);
    const where: Prisma.SchoolTransportStudentAllocationWhereInput = {
      tenantId,
      deletedAt: null,
      academicYearId: q.academicYearId || year.id,
      ...(q.status ? { status: q.status } : {}),
      ...(q.routeId ? { routeId: q.routeId } : {}),
      ...(q.search
        ? {
            student: {
              OR: [
                { fullName: { contains: q.search, mode: 'insensitive' } },
                {
                  admissionNumber: { contains: q.search, mode: 'insensitive' },
                },
              ],
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.schoolTransportStudentAllocation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              admissionNumber: true,
              photoUrl: true,
              phone: true,
            },
          },
          route: true,
          vehicle: true,
          pickupStop: true,
          dropStop: true,
          feePlan: true,
        },
      }),
      this.prisma.schoolTransportStudentAllocation.count({ where }),
    ]);
    return { page, limit, total, items };
  }

  private async expireTemporary(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.prisma.schoolTransportStudentAllocation.updateMany({
      where: {
        tenantId,
        deletedAt: null,
        isTemporary: true,
        status: 'ACTIVE',
        validUntil: { lt: today },
      },
      data: { status: 'EXPIRED' },
    });
  }

  private async assertCapacity(
    tenantId: string,
    routeId: string,
    vehicleId: string | undefined,
    override?: boolean,
    actor?: TransportActor,
  ) {
    const { settings, year } = await this.boot(tenantId);
    const route = await this.prisma.schoolTransportRoute.findFirst({
      where: { id: routeId, tenantId, deletedAt: null },
      include: { vehicle: true },
    });
    if (!route) throw new BadRequestException('Route not found');
    const vehicle = vehicleId
      ? await this.prisma.schoolTransportVehicle.findFirst({
          where: { id: vehicleId, tenantId, deletedAt: null },
        })
      : route.vehicle;
    if (vehicle && vehicle.status !== 'ACTIVE') {
      throw new BadRequestException('Inactive vehicle cannot be assigned');
    }
    const max =
      route.maxCapacity ||
      vehicle?.totalCapacity ||
      vehicle?.seatingCapacity ||
      0;
    const assigned = await this.prisma.schoolTransportStudentAllocation.count({
      where: {
        tenantId,
        routeId,
        status: 'ACTIVE',
        deletedAt: null,
        academicYearId: year.id,
      },
    });
    if (max > 0 && assigned >= max) {
      const allowed =
        override &&
        settings.allowCapacityOverride &&
        (actor?.canOverride || !settings.requireCapacityApproval);
      if (!allowed) {
        throw new BadRequestException(
          `Route is at capacity (${assigned}/${max}). Authorised override required.`,
        );
      }
    }
    return { route, vehicle, assigned, max };
  }

  async saveAllocation(
    tenantId: string,
    actor: TransportActor,
    dto: SaveAllocationDto,
  ) {
    const { year } = await this.boot(tenantId);
    const from = d(dto.validFrom) ?? new Date();
    const tripMode = dto.tripMode ?? 'BOTH';
    const clash = await this.prisma.schoolTransportStudentAllocation.findFirst({
      where: {
        tenantId,
        studentId: dto.studentId,
        status: 'ACTIVE',
        deletedAt: null,
        tripMode: { in: [tripMode, 'BOTH'] },
        OR: [{ validUntil: null }, { validUntil: { gte: from } }],
      },
    });
    if (clash && clash.routeId === dto.routeId && !dto.isTemporary) {
      throw new BadRequestException(
        'Student already has an active allocation for this trip type',
      );
    }
    if (clash && clash.routeId !== dto.routeId && !dto.isTemporary) {
      await this.prisma.schoolTransportStudentAllocation.update({
        where: { id: clash.id },
        data: {
          status: 'SUPERSEDED',
          validUntil: from,
          updatedBy: actor.userId,
        },
      });
      await this.prisma.schoolTransportAllocationHistory.create({
        data: {
          tenantId,
          allocationId: clash.id,
          studentId: clash.studentId,
          routeId: clash.routeId,
          vehicleId: clash.vehicleId,
          pickupStopId: clash.pickupStopId,
          dropStopId: clash.dropStopId,
          status: 'SUPERSEDED',
          validFrom: clash.validFrom,
          validUntil: from,
          reason: 'Reallocated',
          actorUserId: actor.userId,
          snapshotJson: json(clash),
        },
      });
    }
    await this.assertCapacity(
      tenantId,
      dto.routeId,
      dto.vehicleId,
      dto.capacityOverride,
      actor,
    );
    const row = await this.prisma.schoolTransportStudentAllocation.create({
      data: {
        tenantId,
        academicYearId: dto.academicYearId || year.id,
        studentId: dto.studentId,
        routeId: dto.routeId,
        vehicleId: dto.vehicleId,
        pickupStopId: dto.pickupStopId,
        dropStopId: dto.dropStopId,
        tripMode,
        validFrom: from,
        validUntil: d(dto.validUntil),
        feePlanId: dto.feePlanId,
        concessionKind: dto.concessionKind,
        capacityOverride: Boolean(dto.capacityOverride),
        overrideReason: dto.overrideReason,
        isTemporary: Boolean(dto.isTemporary),
        temporaryReason: dto.temporaryReason,
        remarks: dto.remarks,
        qrToken: randomUUID(),
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
    await this.prisma.schoolStudent.update({
      where: { id: dto.studentId },
      data: { usesTransport: true },
    });
    if (dto.feePlanId) {
      const plan = await this.prisma.schoolTransportFeePlan.findFirst({
        where: { id: dto.feePlanId, tenantId },
      });
      if (plan) {
        await this.prisma.schoolTransportFeeAssignment.create({
          data: {
            tenantId,
            studentId: dto.studentId,
            allocationId: row.id,
            planId: plan.id,
            amount: plan.amount,
            concessionAmt: 0,
            netAmount: plan.amount,
            validFrom: from,
            validUntil: d(dto.validUntil),
            status: 'ACTIVE',
          },
        });
      }
    }
    await this.prisma.schoolTransportAllocationHistory.create({
      data: {
        tenantId,
        allocationId: row.id,
        studentId: row.studentId,
        routeId: row.routeId,
        vehicleId: row.vehicleId,
        pickupStopId: row.pickupStopId,
        dropStopId: row.dropStopId,
        status: 'ACTIVE',
        validFrom: row.validFrom,
        validUntil: row.validUntil,
        reason: dto.isTemporary ? 'Temporary' : 'Allocated',
        actorUserId: actor.userId,
        snapshotJson: json(row),
      },
    });
    await this.audit(tenantId, actor, 'STUDENT_ALLOCATED', row.id, null, row);
    return row;
  }

  async bulkAllocate(
    tenantId: string,
    actor: TransportActor,
    dto: BulkAllocationDto,
  ) {
    const results: { ok: string[]; failed: { id: string; error: string }[] } = {
      ok: [],
      failed: [],
    };
    for (const studentId of dto.studentIds) {
      try {
        await this.saveAllocation(tenantId, actor, {
          studentId,
          routeId: dto.routeId,
          pickupStopId: dto.pickupStopId,
          dropStopId: dto.dropStopId,
          vehicleId: dto.vehicleId,
          tripMode: dto.tripMode,
          validFrom: dto.validFrom,
          validUntil: dto.validUntil,
          capacityOverride: dto.capacityOverride,
          overrideReason: dto.overrideReason,
        });
        results.ok.push(studentId);
      } catch (err) {
        results.failed.push({
          id: studentId,
          error: err instanceof Error ? err.message : 'Failed',
        });
      }
    }
    await this.audit(tenantId, actor, 'BULK_ALLOCATION', null, null, results);
    return results;
  }

  async endAllocation(
    tenantId: string,
    actor: TransportActor,
    id: string,
    reason?: string,
  ) {
    const row = await this.prisma.schoolTransportStudentAllocation.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Allocation not found');
    const updated = await this.prisma.schoolTransportStudentAllocation.update({
      where: { id },
      data: {
        status: 'ENDED',
        validUntil: new Date(),
        updatedBy: actor.userId,
      },
    });
    await this.prisma.schoolTransportAllocationHistory.create({
      data: {
        tenantId,
        allocationId: id,
        studentId: row.studentId,
        routeId: row.routeId,
        status: 'ENDED',
        validFrom: row.validFrom,
        validUntil: new Date(),
        reason: reason ?? 'Removed',
        actorUserId: actor.userId,
        snapshotJson: json(row),
      },
    });
    await this.audit(
      tenantId,
      actor,
      'STUDENT_REMOVED',
      id,
      row,
      updated,
      reason,
    );
    return updated;
  }

  async generateTrips(
    tenantId: string,
    actor: TransportActor,
    dto: GenerateTripsDto,
  ) {
    const { year } = await this.boot(tenantId);
    const date = d(dto.date)!;
    const holiday = await this.prisma.schoolHoliday.findFirst({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        status: 'ACTIVE',
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
    const special = await this.prisma.schoolTransportCalendarEvent.findFirst({
      where: {
        tenantId,
        academicYearId: year.id,
        kind: 'SPECIAL_WORKING',
        startDate: { lte: date },
        endDate: { gte: date },
        deletedAt: null,
      },
    });
    if (holiday && !special && !dto.includeSpecialWorking) {
      throw new BadRequestException(
        'School holiday — normal trips are not generated. Enable a special working day to override.',
      );
    }
    const routes = await this.prisma.schoolTransportRoute.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(dto.routeId ? { id: dto.routeId } : {}),
      },
      include: { stops: true, vehicle: true },
    });
    const created = [];
    for (const route of routes) {
      if (!route.vehicleId) continue;
      for (const tripType of ['MORNING_PICKUP', 'AFTERNOON_DROP'] as const) {
        if (
          route.routeType === 'MORNING_PICKUP' &&
          tripType !== 'MORNING_PICKUP'
        )
          continue;
        if (
          route.routeType === 'AFTERNOON_DROP' &&
          tripType !== 'AFTERNOON_DROP'
        )
          continue;
        const trip = await this.prisma.schoolTransportTrip.upsert({
          where: {
            tenantId_date_routeId_tripType: {
              tenantId,
              date,
              routeId: route.id,
              tripType,
            },
          },
          create: {
            tenantId,
            academicYearId: year.id,
            date,
            routeId: route.id,
            vehicleId: route.vehicleId,
            driverId: route.driverId,
            attendantId: route.attendantId,
            tripType,
            createdBy: actor.userId,
          },
          update: {},
        });
        if (route.stops.length) {
          await this.prisma.schoolTransportTripStop.createMany({
            data: route.stops.map((s) => ({
              tenantId,
              tripId: trip.id,
              stopId: s.stopId,
              stopNumber: s.stopNumber,
            })),
            skipDuplicates: true,
          });
        }
        created.push(trip);
      }
    }
    await this.audit(tenantId, actor, 'TRIPS_GENERATED', null, null, {
      date: dto.date,
      count: created.length,
    });
    return { count: created.length, items: created };
  }

  async listTrips(tenantId: string, q: Record<string, string | undefined>) {
    await this.boot(tenantId);
    const { skip, limit, page } = pageOf(q);
    const date = q.date ? d(q.date) : undefined;
    const where: Prisma.SchoolTransportTripWhereInput = {
      tenantId,
      ...(date ? { date } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.routeId ? { routeId: q.routeId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.schoolTransportTrip.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { tripType: 'asc' }],
        include: {
          route: true,
          vehicle: true,
          driver: true,
          attendant: true,
          _count: { select: { boarding: true } },
        },
      }),
      this.prisma.schoolTransportTrip.count({ where }),
    ]);
    return { page, limit, total, items };
  }

  async tripAction(
    tenantId: string,
    actor: TransportActor,
    id: string,
    action: 'start' | 'complete' | 'cancel' | 'delay',
    dto: TripActionDto,
  ) {
    const { settings } = await this.boot(tenantId);
    const trip = await this.prisma.schoolTransportTrip.findFirst({
      where: { id, tenantId },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status === 'COMPLETED' && action !== 'delay') {
      throw new BadRequestException('Completed trips cannot be edited');
    }
    const next =
      action === 'start'
        ? 'IN_PROGRESS'
        : action === 'complete'
          ? 'COMPLETED'
          : action === 'cancel'
            ? 'CANCELLED'
            : 'DELAYED';
    const updated = await this.prisma.schoolTransportTrip.update({
      where: { id },
      data: {
        status: next,
        startedAt: action === 'start' ? new Date() : trip.startedAt,
        completedAt: action === 'complete' ? new Date() : trip.completedAt,
        cancelledAt: action === 'cancel' ? new Date() : trip.cancelledAt,
        cancelReason: dto.reason,
        delayedReason: action === 'delay' ? dto.reason : trip.delayedReason,
        safetyOverride: dto.safetyOverride ?? trip.safetyOverride,
        safetyOverrideBy: dto.safetyOverride
          ? actor.userId
          : trip.safetyOverrideBy,
      },
    });
    if (action === 'delay' && settings.notifyParents) {
      await this.notify(
        tenantId,
        'TRANSPORT_DELAY',
        'Transport delay',
        dto.reason || 'The school bus is delayed.',
        { tripId: id },
      );
    }
    await this.audit(
      tenantId,
      actor,
      `TRIP_${action.toUpperCase()}`,
      id,
      trip,
      updated,
    );
    return updated;
  }

  async tripRoster(tenantId: string, tripId: string) {
    await this.boot(tenantId);
    const trip = await this.prisma.schoolTransportTrip.findFirst({
      where: { id: tripId, tenantId },
      include: { route: true, vehicle: true, driver: true, attendant: true },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    const allocations =
      await this.prisma.schoolTransportStudentAllocation.findMany({
        where: {
          tenantId,
          routeId: trip.routeId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              admissionNumber: true,
              photoUrl: true,
            },
          },
          pickupStop: true,
          dropStop: true,
        },
      });
    const events = await this.prisma.schoolTransportBoardingEvent.findMany({
      where: { tripId, tenantId },
      orderBy: { occurredAt: 'desc' },
    });
    const latest = new Map<string, string>();
    for (const e of events) {
      if (!latest.has(e.studentId)) latest.set(e.studentId, e.eventType);
    }
    return {
      trip,
      students: allocations.map((a, i) => ({
        index: i + 1,
        student: a.student,
        stop: trip.tripType === 'AFTERNOON_DROP' ? a.dropStop : a.pickupStop,
        status: latest.get(a.studentId) ?? 'NOT_BOARDED',
      })),
    };
  }

  async recordBoarding(
    tenantId: string,
    actor: TransportActor,
    tripId: string,
    dto: BoardingDto,
  ) {
    const { settings, policy } = await this.boot(tenantId);
    const trip = await this.prisma.schoolTransportTrip.findFirst({
      where: { id: tripId, tenantId },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (
      !['STARTED', 'IN_PROGRESS', 'SCHEDULED', 'DELAYED'].includes(trip.status)
    ) {
      throw new BadRequestException('Trip is not open for attendance');
    }
    if (!policy.allowManualAttendance && dto.method === 'MANUAL') {
      throw new BadRequestException('Manual attendance is disabled');
    }
    const alloc = await this.prisma.schoolTransportStudentAllocation.findFirst({
      where: {
        tenantId,
        studentId: dto.studentId,
        routeId: trip.routeId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
    const row = await this.prisma.schoolTransportBoardingEvent.create({
      data: {
        tenantId,
        tripId,
        studentId: dto.studentId,
        allocationId: alloc?.id,
        vehicleId: trip.vehicleId,
        routeId: trip.routeId,
        stopId: dto.stopId,
        eventType: dto.eventType,
        method: dto.method ?? 'MANUAL',
        recordedBy: actor.userId,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });
    if (
      settings.notifyParents &&
      policy.notifyBoarding &&
      dto.eventType === 'BOARDED'
    ) {
      await this.notify(
        tenantId,
        'TRANSPORT_BOARDING',
        'Boarded',
        'Your child has boarded the school bus.',
        { tripId, studentId: dto.studentId },
      );
    }
    if (
      settings.notifyParents &&
      policy.notifyDrop &&
      dto.eventType === 'DROPPED'
    ) {
      await this.notify(
        tenantId,
        'TRANSPORT_DROPOFF',
        'Arrived',
        'Your child has arrived at the designated stop.',
        { tripId, studentId: dto.studentId },
      );
    }
    await this.audit(tenantId, actor, 'ATTENDANCE', row.id, null, row);
    return row;
  }

  async bulkAttendance(
    tenantId: string,
    actor: TransportActor,
    tripId: string,
    dto: BulkAttendanceDto,
  ) {
    if (!dto.confirm) {
      throw new BadRequestException(
        'Confirmation is required for bulk attendance',
      );
    }
    const roster = await this.tripRoster(tenantId, tripId);
    const results = [];
    for (const s of roster.students) {
      results.push(
        await this.recordBoarding(tenantId, actor, tripId, {
          studentId: s.student.id,
          eventType: dto.eventType,
          stopId: s.stop?.id,
          method: 'BULK',
        }),
      );
    }
    return { count: results.length };
  }

  async saveMaintenance(
    tenantId: string,
    actor: TransportActor,
    dto: SaveMaintenanceDto,
  ) {
    await this.boot(tenantId);
    const row = await this.prisma.schoolTransportMaintenance.create({
      data: {
        tenantId,
        vehicleId: dto.vehicleId,
        serviceType: dto.serviceType,
        date: d(dto.date)!,
        odometer: dto.odometer,
        vendor: dto.vendor,
        invoiceNumber: dto.invoiceNumber,
        cost: dto.cost ?? 0,
        nextServiceDate: d(dto.nextServiceDate),
        nextServiceOdometer: dto.nextServiceOdometer,
        description: dto.description,
        attachmentUrl: dto.attachmentUrl,
        createdBy: actor.userId,
      },
    });
    await this.audit(tenantId, actor, 'MAINTENANCE', row.id, null, row);
    return row;
  }

  async listMaintenance(tenantId: string, vehicleId?: string) {
    await this.boot(tenantId);
    return this.prisma.schoolTransportMaintenance.findMany({
      where: { tenantId, deletedAt: null, ...(vehicleId ? { vehicleId } : {}) },
      include: { vehicle: true },
      orderBy: { date: 'desc' },
      take: 100,
    });
  }

  async saveFuel(tenantId: string, actor: TransportActor, dto: SaveFuelDto) {
    const { policy } = await this.boot(tenantId);
    const litres = Number(dto.litres);
    const total = dto.totalAmount ?? Math.round((dto.rate ?? 0) * litres);
    const prev = await this.prisma.schoolTransportFuelLog.findFirst({
      where: { tenantId, vehicleId: dto.vehicleId, deletedAt: null },
      orderBy: { date: 'desc' },
    });
    const km = prev ? dto.odometer - prev.odometer : 0;
    const kmpl = litres > 0 && km > 0 ? km / litres : null;
    const flags: string[] = [];
    const min = Number(policy.expectedKmplMin ?? 0);
    const max = Number(policy.expectedKmplMax ?? 0);
    if (kmpl != null && min > 0 && kmpl < min) flags.push('LOW_MILEAGE');
    if (kmpl != null && max > 0 && kmpl > max) flags.push('HIGH_MILEAGE');
    const row = await this.prisma.schoolTransportFuelLog.create({
      data: {
        tenantId,
        vehicleId: dto.vehicleId,
        date: d(dto.date)!,
        odometer: dto.odometer,
        fuelType: dto.fuelType,
        litres,
        rate: dto.rate ?? 0,
        totalAmount: total,
        station: dto.station,
        receiptNo: dto.receiptNo,
        driverId: dto.driverId,
        flagsJson: json(flags),
        createdBy: actor.userId,
      },
    });
    return { ...row, km, kmpl, costPerKm: km > 0 ? total / km : null, flags };
  }

  async listFuel(tenantId: string, vehicleId?: string) {
    await this.boot(tenantId);
    return this.prisma.schoolTransportFuelLog.findMany({
      where: { tenantId, deletedAt: null, ...(vehicleId ? { vehicleId } : {}) },
      include: { vehicle: true, driver: true },
      orderBy: { date: 'desc' },
      take: 100,
    });
  }

  async saveIncident(
    tenantId: string,
    actor: TransportActor,
    dto: SaveIncidentDto,
  ) {
    const { settings, policy } = await this.boot(tenantId);
    const count = await this.prisma.schoolTransportIncident.count({
      where: { tenantId },
    });
    const row = await this.prisma.schoolTransportIncident.create({
      data: {
        tenantId,
        incidentNo: `INC-${String(count + 1).padStart(4, '0')}`,
        kind: dto.kind,
        severity: dto.severity ?? (dto.sos ? 'CRITICAL' : 'MEDIUM'),
        date: d(dto.date) ?? new Date(),
        vehicleId: dto.vehicleId,
        routeId: dto.routeId,
        driverId: dto.driverId,
        tripId: dto.tripId,
        location: dto.location,
        latitude: dto.latitude,
        longitude: dto.longitude,
        description: dto.description,
        actionTaken: dto.actionTaken,
        sos: Boolean(dto.sos),
        studentsJson: json(dto.studentsJson ?? []),
        createdBy: actor.userId,
      },
    });
    if (
      (row.severity === 'CRITICAL' || row.sos) &&
      (settings.notifyParents || policy.notifyEmergency)
    ) {
      await this.notify(
        tenantId,
        'TRANSPORT_EMERGENCY',
        'Transport emergency',
        dto.description,
        { tripId: dto.tripId, emergency: true },
      );
    }
    await this.audit(tenantId, actor, 'INCIDENT_CREATED', row.id, null, row);
    return row;
  }

  async listIncidents(tenantId: string) {
    await this.boot(tenantId);
    return this.prisma.schoolTransportIncident.findMany({
      where: { tenantId, deletedAt: null },
      include: { vehicle: true, route: true, driver: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async resolveIncident(
    tenantId: string,
    actor: TransportActor,
    id: string,
    actionTaken?: string,
  ) {
    const row = await this.prisma.schoolTransportIncident.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        actionTaken,
      },
    });
    await this.audit(tenantId, actor, 'INCIDENT_RESOLVED', id, null, row);
    return row;
  }

  async reportBreakdown(
    tenantId: string,
    actor: TransportActor,
    dto: BreakdownDto,
  ) {
    const { settings, policy } = await this.boot(tenantId);
    await this.prisma.schoolTransportVehicle.update({
      where: { id: dto.vehicleId },
      data: { status: 'OUT_OF_SERVICE' },
    });
    const incident = await this.saveIncident(tenantId, actor, {
      kind: 'BREAKDOWN',
      severity: 'HIGH',
      vehicleId: dto.vehicleId,
      tripId: dto.tripId,
      description: dto.description || 'Vehicle breakdown reported',
    });
    const backups = await this.prisma.schoolTransportVehicle.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        fleetRole: 'BACKUP',
        id: { not: dto.vehicleId },
      },
      take: 10,
    });
    if (dto.replacementVehicleId && dto.tripId) {
      await this.prisma.schoolTransportTrip.update({
        where: { id: dto.tripId },
        data: {
          vehicleId: dto.replacementVehicleId,
          driverId: dto.replacementDriverId,
        },
      });
    }
    if (
      dto.notifyParents !== false &&
      (settings.notifyParents || policy.notifyBreakdown)
    ) {
      await this.notify(
        tenantId,
        'TRANSPORT_BREAKDOWN',
        'Transport update',
        'A school vehicle has broken down. A replacement is being arranged.',
        { tripId: dto.tripId },
      );
    }
    await this.audit(tenantId, actor, 'BREAKDOWN', incident.id, null, {
      incident,
      backups: backups.map((b) => b.id),
    });
    return { incident, suggestedBackups: backups };
  }

  async pingGps(tenantId: string, actor: TransportActor, dto: GpsPingDto) {
    const { settings, policy } = await this.boot(tenantId);
    if (!settings.gpsEnabled) {
      throw new BadRequestException('GPS is disabled for this school');
    }
    const trip = dto.tripId
      ? await this.prisma.schoolTransportTrip.findFirst({
          where: { id: dto.tripId, tenantId },
        })
      : await this.prisma.schoolTransportTrip.findFirst({
          where: {
            tenantId,
            vehicleId: dto.vehicleId,
            status: { in: ['STARTED', 'IN_PROGRESS', 'DELAYED'] },
          },
          orderBy: { date: 'desc' },
        });
    if (!trip && !policy.trackWhenIdle) {
      throw new BadRequestException(
        'Location updates are only accepted during an active trip',
      );
    }
    const row = await this.prisma.schoolTransportGpsLocation.create({
      data: {
        tenantId,
        vehicleId: dto.vehicleId,
        tripId: trip?.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        speedKmh: dto.speedKmh,
        heading: dto.heading,
        accuracy: dto.accuracy,
        source: 'MOBILE',
      },
    });
    const fences = await this.prisma.schoolTransportGeofence.findMany({
      where: { tenantId, active: true, deletedAt: null },
    });
    for (const f of fences) {
      const meters = haversineMeters(
        dto.latitude,
        dto.longitude,
        Number(f.latitude),
        Number(f.longitude),
      );
      if (meters <= f.radiusMeters) {
        await this.prisma.schoolTransportGpsAlert.create({
          data: {
            tenantId,
            vehicleId: dto.vehicleId,
            tripId: trip?.id,
            kind: `ENTER_${f.kind}`,
            message: `Entered ${f.name}`,
            latitude: dto.latitude,
            longitude: dto.longitude,
          },
        });
      }
    }
    const retainDays = Number(policy.gpsRetentionDays ?? 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retainDays);
    await this.prisma.schoolTransportGpsLocation.deleteMany({
      where: { tenantId, recordedAt: { lt: cutoff }, tripId: null },
    });
    return row;
  }

  async tracking(tenantId: string) {
    const { settings, policy } = await this.boot(tenantId);
    const staleMs = Number(policy.gpsStaleSeconds ?? 90) * 1000;
    const vehicles = await this.prisma.schoolTransportVehicle.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'MAINTENANCE'] },
      },
      include: {
        routes: {
          where: { deletedAt: null, status: 'ACTIVE' },
          take: 1,
          include: { driver: true },
        },
        gpsLocations: { orderBy: { recordedAt: 'desc' }, take: 1 },
        trips: {
          where: { status: { in: ['STARTED', 'IN_PROGRESS', 'DELAYED'] } },
          take: 1,
          include: {
            route: { include: { stops: { include: { stop: true } } } },
          },
        },
      },
    });
    return {
      map: this.mapConfig(settings, policy),
      gpsEnabled: settings.gpsEnabled,
      vehicles: vehicles.map((v) => {
        const last = v.gpsLocations[0];
        const trip = v.trips[0];
        const age = last ? Date.now() - last.recordedAt.getTime() : null;
        const motion =
          !last || (age != null && age > staleMs)
            ? 'OFFLINE'
            : Number(last.speedKmh ?? 0) < 2
              ? 'STOPPED'
              : 'MOVING';
        let eta: {
          nextStop: string;
          minutes: number;
          distanceMeters: number;
          estimated: true;
        } | null = null;
        if (last && trip?.route.stops.length) {
          const next = trip.route.stops.find((s) => s.stop.latitude != null);
          if (next?.stop.latitude != null && next.stop.longitude != null) {
            const dist = haversineMeters(
              Number(last.latitude),
              Number(last.longitude),
              Number(next.stop.latitude),
              Number(next.stop.longitude),
            );
            eta = {
              nextStop: next.stop.name,
              minutes: estimatedMinutes(dist, Number(policy.etaSpeedKmh ?? 25)),
              distanceMeters: Math.round(dist),
              estimated: true,
            };
          }
        }
        return {
          id: v.id,
          code: v.code,
          registrationNumber: v.registrationNumber,
          driver: v.routes[0]?.driver?.fullName ?? null,
          route: v.routes[0]?.name ?? trip?.route.name ?? null,
          status: motion,
          speedKmh: last ? Number(last.speedKmh ?? 0) : null,
          lastUpdated: last?.recordedAt ?? null,
          stale: age != null && age > staleMs,
          latitude: last ? Number(last.latitude) : null,
          longitude: last ? Number(last.longitude) : null,
          tripStatus: trip?.status ?? 'IDLE',
          eta,
        };
      }),
    };
  }

  async saveGeofence(
    tenantId: string,
    actor: TransportActor,
    dto: SaveGeofenceDto,
    id?: string,
  ) {
    const { settings } = await this.boot(tenantId);
    const data = {
      tenantId,
      kind: dto.kind,
      name: dto.name,
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusMeters: dto.radiusMeters ?? settings.geofenceDefaultMeters,
      stopId: dto.stopId,
      active: dto.active ?? true,
      createdBy: actor.userId,
    };
    const row = id
      ? await this.prisma.schoolTransportGeofence.update({
          where: { id },
          data,
        })
      : await this.prisma.schoolTransportGeofence.create({ data });
    return row;
  }

  async listGeofences(tenantId: string) {
    await this.boot(tenantId);
    return this.prisma.schoolTransportGeofence.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async saveFeePlan(
    tenantId: string,
    actor: TransportActor,
    dto: SaveFeePlanDto,
    id?: string,
  ) {
    const { year } = await this.boot(tenantId);
    const data = {
      tenantId,
      academicYearId: dto.academicYearId || year.id,
      name: dto.name,
      code: dto.code?.trim() || `FP-${Date.now().toString(36).toUpperCase()}`,
      cadence: dto.cadence ?? 'MONTHLY',
      pricingModel: dto.pricingModel ?? 'ROUTE',
      amount: dto.amount,
      routeId: dto.routeId,
      stopId: dto.stopId,
      active: dto.active ?? true,
    };
    const row = id
      ? await this.prisma.schoolTransportFeePlan.update({ where: { id }, data })
      : await this.prisma.schoolTransportFeePlan.create({ data });
    await this.audit(tenantId, actor, 'FEE_PLAN', row.id, null, row);
    return row;
  }

  async listFeePlans(tenantId: string) {
    const { year } = await this.boot(tenantId);
    return this.prisma.schoolTransportFeePlan.findMany({
      where: { tenantId, academicYearId: year.id, deletedAt: null },
      include: { concessions: true },
      orderBy: { name: 'asc' },
    });
  }

  async saveConcession(
    tenantId: string,
    _actor: TransportActor,
    dto: SaveConcessionDto,
  ) {
    await this.boot(tenantId);
    return this.prisma.schoolTransportFeeConcession.create({
      data: {
        tenantId,
        planId: dto.planId,
        kind: dto.kind,
        name: dto.name,
        percent: dto.percent,
        amount: dto.amount,
        active: dto.active ?? true,
      },
    });
  }

  async saveRequest(
    tenantId: string,
    actor: TransportActor,
    dto: SaveRequestDto,
  ) {
    const { year } = await this.boot(tenantId);
    return this.prisma.schoolTransportRequest.create({
      data: {
        tenantId,
        academicYearId: year.id,
        studentId: dto.studentId,
        kind: dto.kind,
        routeId: dto.routeId,
        stopId: dto.stopId,
        validFrom: d(dto.validFrom),
        validUntil: d(dto.validUntil),
        reason: dto.reason,
        createdBy: actor.userId,
      },
    });
  }

  async listRequests(tenantId: string, status?: string) {
    await this.boot(tenantId);
    return this.prisma.schoolTransportRequest.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: { student: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async reviewRequest(
    tenantId: string,
    actor: TransportActor,
    id: string,
    dto: ReviewRequestDto,
  ) {
    const row = await this.prisma.schoolTransportRequest.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Request not found');
    const updated = await this.prisma.schoolTransportRequest.update({
      where: { id },
      data: {
        status: dto.status,
        remarks: dto.remarks,
        reviewedBy: actor.userId,
        reviewedAt: new Date(),
      },
    });
    await this.notify(
      tenantId,
      dto.status === 'APPROVED'
        ? 'TRANSPORT_REQUEST_APPROVED'
        : 'TRANSPORT_REQUEST_REJECTED',
      'Transport request',
      dto.remarks || dto.status,
      { studentId: row.studentId },
    );
    return updated;
  }

  async importRows(
    tenantId: string,
    actor: TransportActor,
    dto: ImportRowsDto,
  ) {
    const successful: number[] = [];
    const failed: { row: number; error: string }[] = [];
    const skipped: number[] = [];
    for (let i = 0; i < dto.rows.length; i += 1) {
      const row = dto.rows[i];
      try {
        if (dto.entity === 'vehicles') {
          const reg = String(row.registrationNumber ?? '').trim();
          if (!reg) throw new Error('Registration required');
          const exists = await this.prisma.schoolTransportVehicle.findFirst({
            where: { tenantId, registrationNumber: reg.toUpperCase() },
          });
          if (exists) {
            skipped.push(i + 1);
            continue;
          }
          await this.saveVehicle(tenantId, actor, {
            registrationNumber: reg,
            code: String(row.code ?? ''),
            vehicleType: String(row.vehicleType ?? 'SCHOOL_BUS'),
            seatingCapacity: Number(row.seatingCapacity ?? 0),
          });
          successful.push(i + 1);
        } else {
          throw new Error('Unsupported import entity');
        }
      } catch (err) {
        failed.push({
          row: i + 1,
          error: err instanceof Error ? err.message : 'Invalid',
        });
      }
    }
    await this.audit(tenantId, actor, 'IMPORT', null, null, {
      entity: dto.entity,
      successful: successful.length,
      failed: failed.length,
    });
    return { successful: successful.length, failed, skipped: skipped.length };
  }

  async mobileMyTrip(tenantId: string, staffId?: string | null) {
    await this.boot(tenantId);
    const person = staffId
      ? await this.prisma.schoolTransportPersonnel.findFirst({
          where: { tenantId, deletedAt: null, staffId, status: 'ACTIVE' },
        })
      : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const trip = person
      ? await this.prisma.schoolTransportTrip.findFirst({
          where: {
            tenantId,
            date: today,
            status: { notIn: ['CANCELLED'] },
            OR: [{ driverId: person.id }, { attendantId: person.id }],
          },
          include: {
            route: { include: { stops: { include: { stop: true } } } },
            vehicle: true,
            driver: true,
            attendant: true,
          },
          orderBy: { tripType: 'asc' },
        })
      : null;
    return { personnel: person, trip };
  }

  async assertTripStaff(
    tenantId: string,
    tripId: string,
    staffId?: string | null,
  ) {
    const trip = await this.prisma.schoolTransportTrip.findFirst({
      where: { id: tripId, tenantId },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (!staffId) throw new ForbiddenException('Not assigned to this trip');
    const person = await this.prisma.schoolTransportPersonnel.findFirst({
      where: { tenantId, staffId, deletedAt: null },
    });
    if (
      !person ||
      (trip.driverId !== person.id && trip.attendantId !== person.id)
    ) {
      throw new ForbiddenException('Not assigned to this trip');
    }
    return { trip, person };
  }

  async parentCard(tenantId: string, studentIds: string[]) {
    await this.boot(tenantId);
    if (!studentIds.length) return [];
    const allocs = await this.prisma.schoolTransportStudentAllocation.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds },
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        student: true,
        route: true,
        vehicle: true,
        pickupStop: true,
        dropStop: true,
      },
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const trips = await this.prisma.schoolTransportTrip.findMany({
      where: {
        tenantId,
        date: today,
        routeId: { in: allocs.map((a) => a.routeId) },
      },
    });
    return allocs.map((a) => {
      const trip = trips.find((t) => t.routeId === a.routeId);
      return {
        studentId: a.studentId,
        studentName: a.student.fullName,
        route: a.route.name,
        vehicle: a.vehicle?.registrationNumber ?? null,
        stop: a.pickupStop.name,
        tripStatus: trip?.status ?? 'NOT_STARTED',
      };
    });
  }

  async listAudit(tenantId: string) {
    await this.boot(tenantId);
    return this.prisma.schoolTransportAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
