import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../database/prisma.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import {
  AvailabilityQueryDto,
  BuildingDto,
  FloorDto,
  InfrastructureQueryDto,
  ReservationDto,
  ReservationQueryDto,
  ReservationStatusDto,
  RoomDto,
  RoomTypeDto,
} from './dto/infrastructure.dto';

const DEFAULT_ROOM_TYPES = [
  ['CLASSROOM', 'Classroom'],
  ['SCIENCE_LAB', 'Science Lab'],
  ['COMPUTER_LAB', 'Computer Lab'],
  ['LANGUAGE_LAB', 'Language Lab'],
  ['SEMINAR_HALL', 'Seminar Hall'],
  ['CONFERENCE_ROOM', 'Conference Room'],
  ['AUDITORIUM', 'Auditorium'],
  ['TUTORIAL_ROOM', 'Tutorial Room'],
  ['SHARED_HALL', 'Shared Hall'],
  ['LIBRARY_HALL', 'Library Hall'],
  ['EXAMINATION_HALL', 'Examination Hall'],
  ['SMART_CLASSROOM', 'Smart Classroom'],
  ['RESEARCH_LAB', 'Research Lab'],
  ['WORKSHOP_ROOM', 'Workshop Room'],
  ['STUDIO', 'Studio'],
  ['MEETING_ROOM', 'Meeting Room'],
];

@Injectable()
export class InfrastructureService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string) {
    const [rooms, labs, halls, maintenance, reservations] = await Promise.all([
      this.prisma.classroom.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.classroom.count({
        where: { tenantId, deletedAt: null, isPracticalLab: true } as any,
      }),
      this.prisma.classroom.count({
        where: { tenantId, deletedAt: null, isSharedHall: true } as any,
      }),
      this.prisma.classroom.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'UNDER_MAINTENANCE',
        } as any,
      }),
      (this.prisma as any).infrastructureReservation.count({
        where: { tenantId, deletedAt: null, startAt: { gte: new Date() } },
      }),
    ]);
    return {
      totalRooms: rooms,
      classrooms: rooms - labs - halls,
      labs,
      sharedHalls: halls,
      activeRooms: await this.prisma.classroom.count({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' } as any,
      }),
      underMaintenance: maintenance,
      utilizationRate: rooms
        ? Math.round(
            ((reservations / Math.max(1, rooms)) * 100 + Number.EPSILON) * 100,
          ) / 100
        : 0,
      upcomingReservations: reservations,
    };
  }

  listBuildings(tenantId: string, query: InfrastructureQueryDto) {
    return (this.prisma as any).infrastructureBuilding.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.campusId ? { campusId: query.campusId } : {}),
        ...(query.status && query.status !== 'ALL'
          ? { status: query.status }
          : query.status === 'ALL'
            ? {}
            : { status: { not: 'ARCHIVED' } }),
        ...(query.search
          ? {
              OR: [
                { code: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async createBuilding(user: JwtUser, dto: BuildingDto) {
    this.assertText(dto.code, 'Building code is required.');
    this.assertText(dto.name, 'Building name is required.');
    const row = await (this.prisma as any).infrastructureBuilding.create({
      data: {
        tenantId: user.tid,
        ...dto,
        code: dto.code.trim().toUpperCase(),
        status: dto.status ?? 'ACTIVE',
      },
    });
    await this.audit(user, 'BUILDING', row.id, 'CREATE', null, row);
    return row;
  }

  async updateBuilding(user: JwtUser, id: string, dto: Partial<BuildingDto>) {
    const before = await this.getBuilding(user.tid, id);
    if (dto.code != null)
      this.assertText(dto.code, 'Building code is required.');
    if (dto.name != null)
      this.assertText(dto.name, 'Building name is required.');
    const row = await (this.prisma as any).infrastructureBuilding.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
      },
    });
    await this.audit(user, 'BUILDING', id, 'UPDATE', before, row);
    return row;
  }

  async getBuilding(tenantId: string, id: string) {
    const row = await (this.prisma as any).infrastructureBuilding.findFirst({
      where: { tenantId, id, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Building not found');
    return row;
  }

  async deleteBuilding(user: JwtUser, id: string) {
    const before = await this.getBuilding(user.tid, id);
    const dependencies = await this.buildingDependencies(user.tid, id);
    this.assertNoDependencies('building', dependencies);
    const row = await (this.prisma as any).infrastructureBuilding.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });
    await this.audit(user, 'BUILDING', id, 'DELETE', before, row);
    return row;
  }

  async archiveBuilding(user: JwtUser, id: string, archived = true) {
    const before = await this.getBuilding(user.tid, id);
    const row = await (this.prisma as any).infrastructureBuilding.update({
      where: { id },
      data: { status: archived ? 'ARCHIVED' : 'ACTIVE' },
    });
    await this.audit(
      user,
      'BUILDING',
      id,
      archived ? 'ARCHIVE' : 'ACTIVATE',
      before,
      row,
    );
    return row;
  }

  listFloors(tenantId: string, query: InfrastructureQueryDto) {
    return (this.prisma as any).infrastructureFloor.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.buildingId ? { buildingId: query.buildingId } : {}),
        ...(query.status && query.status !== 'ALL'
          ? { status: query.status }
          : query.status === 'ALL'
            ? {}
            : { status: { not: 'ARCHIVED' } }),
      },
      orderBy: [{ floorNumber: 'asc' }, { name: 'asc' }],
    });
  }

  async createFloor(user: JwtUser, dto: FloorDto) {
    if (!dto.buildingId) throw new BadRequestException('Building is required.');
    this.assertText(dto.name, 'Floor name is required.');
    await this.assertBuildingExists(user.tid, dto.buildingId);
    const row = await (this.prisma as any).infrastructureFloor.create({
      data: { tenantId: user.tid, ...dto, status: dto.status ?? 'ACTIVE' },
    });
    await this.audit(user, 'FLOOR', row.id, 'CREATE', null, row);
    return row;
  }

  async updateFloor(user: JwtUser, id: string, dto: Partial<FloorDto>) {
    const before = await (this.prisma as any).infrastructureFloor.findFirst({
      where: { tenantId: user.tid, id, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Floor not found');
    if (dto.name != null) this.assertText(dto.name, 'Floor name is required.');
    if (dto.buildingId != null)
      await this.assertBuildingExists(user.tid, dto.buildingId);
    const row = await (this.prisma as any).infrastructureFloor.update({
      where: { id },
      data: dto,
    });
    await this.audit(user, 'FLOOR', id, 'UPDATE', before, row);
    return row;
  }

  async deleteFloor(user: JwtUser, id: string) {
    const before = await (this.prisma as any).infrastructureFloor.findFirst({
      where: { tenantId: user.tid, id, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Floor not found');
    const dependencies = await this.floorDependencies(user.tid, id);
    this.assertNoDependencies('floor', dependencies);
    const row = await (this.prisma as any).infrastructureFloor.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });
    await this.audit(user, 'FLOOR', id, 'DELETE', before, row);
    return row;
  }

  async archiveFloor(user: JwtUser, id: string, archived = true) {
    const before = await (this.prisma as any).infrastructureFloor.findFirst({
      where: { tenantId: user.tid, id, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Floor not found');
    const row = await (this.prisma as any).infrastructureFloor.update({
      where: { id },
      data: { status: archived ? 'ARCHIVED' : 'ACTIVE' },
    });
    await this.audit(
      user,
      'FLOOR',
      id,
      archived ? 'ARCHIVE' : 'ACTIVATE',
      before,
      row,
    );
    return row;
  }

  listRoomTypes(tenantId: string) {
    return this.prisma.roomType.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async seedRoomTypes(user: JwtUser) {
    for (const [code, name] of DEFAULT_ROOM_TYPES) {
      await this.prisma.roomType.upsert({
        where: { tenantId_code: { tenantId: user.tid, code } },
        create: { tenantId: user.tid, code, name },
        update: { name, status: 'ACTIVE' } as any,
      });
    }
    await this.audit(user, 'ROOM_TYPE', null, 'SEED_DEFAULTS', null, {
      count: DEFAULT_ROOM_TYPES.length,
    });
    return this.listRoomTypes(user.tid);
  }

  async upsertRoomType(user: JwtUser, dto: RoomTypeDto) {
    const row = await this.prisma.roomType.upsert({
      where: {
        tenantId_code: {
          tenantId: user.tid,
          code: dto.code.trim().toUpperCase(),
        },
      },
      create: {
        tenantId: user.tid,
        ...dto,
        code: dto.code.trim().toUpperCase(),
        status: dto.status ?? 'ACTIVE',
      } as any,
      update: { ...dto, code: dto.code.trim().toUpperCase() } as any,
    });
    await this.audit(user, 'ROOM_TYPE', row.id, 'UPSERT', null, row);
    return row;
  }

  listRooms(tenantId: string, query: InfrastructureQueryDto) {
    const search = query.search?.trim();
    return this.prisma.classroom.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.campusId ? { campusId: query.campusId } : {}),
        ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
        ...(query.buildingId ? ({ buildingId: query.buildingId } as any) : {}),
        ...(query.floorId ? ({ floorId: query.floorId } as any) : {}),
        ...(query.status && query.status !== 'ALL'
          ? ({ status: query.status } as any)
          : query.status === 'ALL'
            ? {}
            : ({ status: { not: 'ARCHIVED' } } as any)),
        ...(query.type === 'LAB' ? ({ isPracticalLab: true } as any) : {}),
        ...(query.type === 'SHARED_HALL'
          ? ({ isSharedHall: true } as any)
          : {}),
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { campus: true, roomType: true },
      orderBy: [{ code: 'asc' }],
    });
  }

  async createRoom(user: JwtUser, dto: RoomDto) {
    this.assertText(dto.code, 'Room code is required.');
    this.assertText(dto.name, 'Room name is required.');
    await this.assertRoomRelations(user.tid, dto);
    const row = await this.prisma.classroom.create({
      data: this.roomData(user.tid, dto) as any,
    });
    await this.audit(user, 'ROOM', row.id, 'CREATE', null, row);
    return row;
  }

  async updateRoom(user: JwtUser, id: string, dto: Partial<RoomDto>) {
    const before = await this.prisma.classroom.findFirst({
      where: { tenantId: user.tid, id, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Room not found');
    if (dto.code != null) this.assertText(dto.code, 'Room code is required.');
    if (dto.name != null) this.assertText(dto.name, 'Room name is required.');
    await this.assertRoomRelations(user.tid, dto);
    const row = await this.prisma.classroom.update({
      where: { id },
      data: this.roomData(user.tid, dto, false) as any,
    });
    await this.audit(user, 'ROOM', id, 'UPDATE', before, row);
    return row;
  }

  async deleteRoom(user: JwtUser, id: string) {
    const before = await this.prisma.classroom.findFirst({
      where: { tenantId: user.tid, id, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Room not found');
    const dependencies = await this.roomDependencies(user.tid, id);
    this.assertNoDependencies('room', dependencies);
    const row = await this.prisma.classroom.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DELETED' } as any,
    });
    await this.audit(user, 'ROOM', id, 'DELETE', before, row);
    return row;
  }

  async archiveRoom(user: JwtUser, id: string, archived = true) {
    const before = await this.prisma.classroom.findFirst({
      where: { tenantId: user.tid, id, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Room not found');
    const row = await this.prisma.classroom.update({
      where: { id },
      data: { status: archived ? 'ARCHIVED' : 'ACTIVE' } as any,
    });
    await this.audit(
      user,
      'ROOM',
      id,
      archived ? 'ARCHIVE' : 'ACTIVATE',
      before,
      row,
    );
    return row;
  }

  async bulkRooms(user: JwtUser, dto: { ids?: string[]; action?: string }) {
    const ids = Array.from(new Set(dto.ids ?? [])).filter(Boolean);
    if (!ids.length) throw new BadRequestException('Select at least one room.');
    if (!dto.action) throw new BadRequestException('Bulk action is required.');
    const results = [];
    for (const id of ids) {
      if (dto.action === 'ARCHIVE')
        results.push(await this.archiveRoom(user, id, true));
      else if (dto.action === 'ACTIVATE')
        results.push(await this.archiveRoom(user, id, false));
      else if (dto.action === 'DELETE')
        results.push(await this.deleteRoom(user, id));
      else
        throw new BadRequestException(`Unsupported bulk action ${dto.action}.`);
    }
    return { count: results.length, results };
  }

  labs(tenantId: string) {
    return this.listRooms(tenantId, { type: 'LAB' });
  }

  sharedHalls(tenantId: string) {
    return this.listRooms(tenantId, { type: 'SHARED_HALL' });
  }

  async availability(tenantId: string, query: AvailabilityQueryDto) {
    const from = query.from ? new Date(query.from) : new Date();
    const to = query.to
      ? new Date(query.to)
      : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [rooms, reservations, timetable] = await Promise.all([
      this.prisma.classroom.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(query.classroomId ? { id: query.classroomId } : {}),
        },
        include: { campus: true, roomType: true },
        orderBy: [{ code: 'asc' }],
      }),
      (this.prisma as any).infrastructureReservation.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(query.classroomId ? { classroomId: query.classroomId } : {}),
          status: { notIn: ['CANCELLED', 'REJECTED'] },
          startAt: { lte: to },
          endAt: { gte: from },
        },
        orderBy: [{ startAt: 'asc' }],
      }),
      this.prisma.timetablePlanEntry.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(query.classroomId ? { classroomId: query.classroomId } : {}),
        },
        take: 500,
      }),
    ]);
    const roomCards = rooms.map((room: any) => {
      const roomReservations = reservations.filter(
        (reservation: any) => reservation.classroomId === room.id,
      );
      const roomTimetable = timetable.filter(
        (entry) => entry.classroomId === room.id,
      );
      const status =
        room.status !== 'ACTIVE'
          ? room.status
          : roomReservations.length
            ? 'RESERVED'
            : roomTimetable.length
              ? 'TIMETABLE_OCCUPIED'
              : 'FREE';
      return {
        room,
        status,
        reservations: roomReservations,
        timetableEntries: roomTimetable,
      };
    });
    return {
      from,
      to,
      rooms,
      reservations,
      timetableOccupancy: timetable,
      roomCards,
      summary: {
        totalRooms: rooms.length,
        free: roomCards.filter((card: any) => card.status === 'FREE').length,
        reserved: roomCards.filter((card: any) => card.status === 'RESERVED')
          .length,
        timetableOccupied: roomCards.filter(
          (card: any) => card.status === 'TIMETABLE_OCCUPIED',
        ).length,
        unavailable: roomCards.filter(
          (card: any) =>
            !['FREE', 'RESERVED', 'TIMETABLE_OCCUPIED'].includes(card.status),
        ).length,
      },
    };
  }

  listReservations(tenantId: string, query: ReservationQueryDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    return (this.prisma as any).infrastructureReservation.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.classroomId ? { classroomId: query.classroomId } : {}),
        ...(query.status && query.status !== 'ALL'
          ? { status: query.status }
          : {}),
        ...(from && to ? { startAt: { lte: to }, endAt: { gte: from } } : {}),
      },
      orderBy: [{ startAt: 'asc' }],
      take: 300,
    });
  }

  async reserve(user: JwtUser, dto: ReservationDto) {
    await this.assertReservableRoom(user.tid, dto.classroomId);
    if (new Date(dto.endAt) <= new Date(dto.startAt)) {
      throw new BadRequestException(
        'Reservation end time must be after start time',
      );
    }
    const overlap = await (
      this.prisma as any
    ).infrastructureReservation.findFirst({
      where: {
        tenantId: user.tid,
        classroomId: dto.classroomId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        startAt: { lt: new Date(dto.endAt) },
        endAt: { gt: new Date(dto.startAt) },
      },
    });
    if (overlap)
      throw new BadRequestException('Room is already reserved for this time');
    const row = await (this.prisma as any).infrastructureReservation.create({
      data: {
        tenantId: user.tid,
        ...dto,
        status: 'PENDING_APPROVAL',
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        requestedById: user.sub,
      },
    });
    await this.audit(user, 'RESERVATION', row.id, 'CREATE', null, row);
    return row;
  }

  async updateReservationStatus(
    user: JwtUser,
    id: string,
    dto: ReservationStatusDto,
  ) {
    const allowed = new Set([
      'PENDING_APPROVAL',
      'APPROVED',
      'RESERVED',
      'CANCELLED',
      'REJECTED',
      'COMPLETED',
    ]);
    const status = String(dto.status ?? '').toUpperCase();
    if (!allowed.has(status))
      throw new BadRequestException('Invalid reservation status.');
    const before = await (
      this.prisma as any
    ).infrastructureReservation.findFirst({
      where: { tenantId: user.tid, id, deletedAt: null },
    });
    if (!before) throw new NotFoundException('Reservation not found');
    if (['APPROVED', 'RESERVED'].includes(status)) {
      await this.assertReservableRoom(user.tid, before.classroomId);
      const overlap = await (
        this.prisma as any
      ).infrastructureReservation.findFirst({
        where: {
          tenantId: user.tid,
          id: { not: id },
          classroomId: before.classroomId,
          deletedAt: null,
          status: { in: ['PENDING_APPROVAL', 'APPROVED', 'RESERVED'] },
          startAt: { lt: before.endAt },
          endAt: { gt: before.startAt },
        },
      });
      if (overlap)
        throw new BadRequestException(
          'Cannot approve because another reservation overlaps this time.',
        );
    }
    const row = await (this.prisma as any).infrastructureReservation.update({
      where: { id },
      data: {
        status,
        remarks: dto.remarks ?? before.remarks,
        ...(status === 'APPROVED' || status === 'RESERVED'
          ? { approvedById: user.sub, approvedAt: new Date() }
          : {}),
      },
    });
    await this.audit(user, 'RESERVATION', id, `STATUS_${status}`, before, row);
    return row;
  }

  async reports(tenantId: string, type: string) {
    if (type === 'capacity') {
      const rooms = await this.listRooms(tenantId, {});
      return rooms.map((room: any) => ({
        code: room.code,
        name: room.name,
        type: room.roomType?.name,
        capacity: room.capacity,
        practicalCapacity: room.practicalCapacity,
        examCapacity: room.examCapacity,
        status: room.status,
      }));
    }
    if (type === 'maintenance') {
      return this.listRooms(tenantId, { status: 'UNDER_MAINTENANCE' });
    }
    if (type === 'shared-hall-usage') {
      return this.sharedHalls(tenantId);
    }
    return this.listRooms(tenantId, {});
  }

  async template(tenantId: string) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Rooms');
    sheet.addRow([
      'Room Code',
      'Room Name',
      'Campus',
      'Building',
      'Floor',
      'Type',
      'Capacity',
      'Practical Capacity',
      'Exam Capacity',
      'Shift Availability',
      'Department Restriction',
      'Facilities',
      'Flags',
      'Status',
    ]);
    sheet.getRow(1).font = { bold: true };
    const [campuses, roomTypes, departments, buildings, floors, shifts] =
      await Promise.all([
        this.prisma.campus.findMany({ where: { tenantId, deletedAt: null } }),
        this.listRoomTypes(tenantId),
        this.prisma.department.findMany({
          where: { tenantId, deletedAt: null },
        }),
        (this.prisma as any).infrastructureBuilding.findMany({
          where: { tenantId, deletedAt: null },
        }),
        (this.prisma as any).infrastructureFloor.findMany({
          where: { tenantId, deletedAt: null },
        }),
        this.prisma.shift.findMany({ where: { tenantId, deletedAt: null } }),
      ]);
    this.addSheet(
      workbook,
      'Campuses',
      ['Campus'],
      campuses.map((row) => [row.name]),
    );
    this.addSheet(
      workbook,
      'Buildings',
      ['Building'],
      buildings.map((row: any) => [row.name]),
    );
    this.addSheet(
      workbook,
      'Floors',
      ['Floor', 'Building'],
      floors.map((row: any) => [
        row.name,
        buildings.find((b: any) => b.id === row.buildingId)?.name ?? '',
      ]),
    );
    this.addSheet(
      workbook,
      'Room Types',
      ['Type'],
      roomTypes.map((row) => [row.name]),
    );
    this.addSheet(
      workbook,
      'Shifts',
      ['Shift'],
      shifts.map((row) => [row.name]),
    );
    this.addSheet(
      workbook,
      'Departments',
      ['Department'],
      departments.map((row) => [row.name]),
    );
    this.addSheet(
      workbook,
      'Statuses',
      ['Status'],
      [
        ['ACTIVE'],
        ['INACTIVE'],
        ['UNDER_MAINTENANCE'],
        ['BLOCKED'],
        ['RESERVED'],
        ['ARCHIVED'],
      ],
    );
    this.addSheet(
      workbook,
      'Facilities',
      ['Facility'],
      [
        ['Projector'],
        ['Smart Board'],
        ['WiFi'],
        ['AC'],
        ['Audio System'],
        ['Computers'],
        ['Internet'],
        ['Lab Equipment'],
        ['CCTV'],
        ['UPS Power'],
        ['Whiteboard'],
      ],
    );
    workbook.worksheets.forEach((ws) =>
      ws.columns.forEach((col) => (col.width = 24)),
    );
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async exportRooms(tenantId: string) {
    const rows = await this.listRooms(tenantId, {});
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Rooms');
    sheet.addRow(['Code', 'Name', 'Type', 'Capacity', 'Status', 'Facilities']);
    rows.forEach((room: any) =>
      sheet.addRow([
        room.code,
        room.name,
        room.roomType?.name ?? '',
        room.capacity,
        room.status,
        (room.facilities ?? []).join?.(',') ?? '',
      ]),
    );
    sheet.columns.forEach((col) => (col.width = 24));
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async importPreview(tenantId: string, buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet('Rooms') ?? workbook.worksheets[0];
    if (!sheet)
      return { summary: { total: 0, valid: 0, invalid: 0 }, rows: [] };
    const headers = (sheet.getRow(1).values as any[]).slice(1).map((v) =>
      String(v ?? '')
        .trim()
        .toLowerCase(),
    );
    const [existingRooms, campuses, buildings, floors, roomTypes] =
      await Promise.all([
        this.prisma.classroom.findMany({
          where: { tenantId },
          select: { code: true },
        }),
        this.prisma.campus.findMany({ where: { tenantId, deletedAt: null } }),
        (this.prisma as any).infrastructureBuilding.findMany({
          where: { tenantId, deletedAt: null },
        }),
        (this.prisma as any).infrastructureFloor.findMany({
          where: { tenantId, deletedAt: null },
        }),
        this.prisma.roomType.findMany({ where: { tenantId } }),
      ]);
    const existing = new Set(existingRooms.map((r) => r.code.toUpperCase()));
    const campusByName = new Map<string, any>(
      campuses.map((row) => [row.name.trim().toLowerCase(), row]),
    );
    const buildingByName = new Map<string, any>(
      buildings.map((row: any) => [row.name.trim().toLowerCase(), row]),
    );
    const floorByName = new Map<string, any>(
      floors.map((row: any) => [
        `${row.buildingId}:${row.name.trim().toLowerCase()}`,
        row,
      ]),
    );
    const typeEntries: Array<[string, any]> = [];
    roomTypes.forEach((row) => {
      typeEntries.push([row.name.trim().toLowerCase(), row]);
      typeEntries.push([row.code.trim().toLowerCase(), row]);
    });
    const typeByName = new Map<string, any>(typeEntries);
    const rows: any[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = (row.values as any[]).slice(1);
      if (values.every((v) => !String(v ?? '').trim())) return;
      const raw = Object.fromEntries(headers.map((h, i) => [h, values[i]]));
      const code = String(raw['room code'] ?? raw.code ?? '')
        .trim()
        .toUpperCase();
      const campus = String(raw.campus ?? '').trim();
      const building = String(raw.building ?? '').trim();
      const floor = String(raw.floor ?? '').trim();
      const type = String(raw.type ?? '').trim();
      const campusRow = campus ? campusByName.get(campus.toLowerCase()) : null;
      const buildingRow = building
        ? buildingByName.get(building.toLowerCase())
        : null;
      const floorRow =
        floor && buildingRow
          ? floorByName.get(`${buildingRow.id}:${floor.toLowerCase()}`)
          : null;
      const typeRow = type ? typeByName.get(type.toLowerCase()) : null;
      const errors = [];
      if (!code) errors.push('Room Code is required');
      if (!String(raw['room name'] ?? raw.name ?? '').trim())
        errors.push('Room Name is required');
      if (existing.has(code)) errors.push(`Room code ${code} already exists`);
      if (Number(raw.capacity ?? 0) < 0)
        errors.push('Capacity must be positive');
      if (campus && !campusRow) errors.push(`Campus ${campus} was not found`);
      if (building && !buildingRow)
        errors.push(`Building ${building} was not found`);
      if (floor && !floorRow)
        errors.push(
          `Floor ${floor} was not found under ${building || 'selected building'}`,
        );
      if (type && !typeRow) errors.push(`Room type ${type} was not found`);
      rows.push({
        rowNumber,
        status: errors.length ? 'INVALID' : 'VALID',
        errors,
        raw,
        resolved: {
          campusId: campusRow?.id,
          buildingId: buildingRow?.id,
          floorId: floorRow?.id,
          roomTypeId: typeRow?.id,
        },
      });
    });
    return {
      summary: {
        total: rows.length,
        valid: rows.filter((r) => r.status === 'VALID').length,
        invalid: rows.filter((r) => r.status === 'INVALID').length,
      },
      rows,
    };
  }

  async importCommit(user: JwtUser, buffer: Buffer) {
    const preview = await this.importPreview(user.tid, buffer);
    if (preview.rows.some((row: any) => row.status === 'INVALID'))
      throw new BadRequestException('Fix invalid rows before committing');
    let committed = 0;
    for (const row of preview.rows) {
      const raw = row.raw;
      await this.createRoom(user, {
        code: String(raw['room code']).trim().toUpperCase(),
        name: String(raw['room name']).trim(),
        campusId: row.resolved?.campusId,
        buildingId: row.resolved?.buildingId,
        floorId: row.resolved?.floorId,
        roomTypeId: row.resolved?.roomTypeId,
        capacity: Number(raw.capacity || 40),
        practicalCapacity: raw['practical capacity']
          ? Number(raw['practical capacity'])
          : undefined,
        examCapacity: raw['exam capacity']
          ? Number(raw['exam capacity'])
          : undefined,
        shiftAvailability: String(raw['shift availability'] ?? '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
        facilities: String(raw.facilities ?? '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
        supportedCategories: String(raw.flags ?? '')
          .split(',')
          .map((v) => v.trim().toUpperCase())
          .filter(Boolean),
        isPracticalLab: String(raw.flags ?? '')
          .toUpperCase()
          .includes('LAB'),
        isSharedHall: String(raw.flags ?? '')
          .toUpperCase()
          .includes('SHARED'),
        availableForExams: String(raw.flags ?? '')
          .toUpperCase()
          .includes('EXAM'),
        status: String(raw.status ?? 'ACTIVE').toUpperCase(),
      });
      committed += 1;
    }
    return { committed, summary: preview.summary };
  }

  auditLogs(tenantId: string) {
    return (this.prisma as any).infrastructureAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  private roomData(tenantId: string, dto: Partial<RoomDto>, create = true) {
    return {
      ...(create ? { tenantId } : {}),
      ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.name ? { name: dto.name.trim() } : {}),
      shortName: dto.shortName,
      description: dto.description,
      campusId: dto.campusId,
      buildingId: dto.buildingId,
      floorId: dto.floorId,
      roomTypeId: dto.roomTypeId,
      ...(dto.capacity != null ? { capacity: Number(dto.capacity) } : {}),
      practicalCapacity: dto.practicalCapacity,
      examCapacity: dto.examCapacity,
      standingCapacity: dto.standingCapacity,
      shiftAvailability: dto.shiftAvailability ?? undefined,
      departmentRestrictionMode: dto.departmentRestrictionMode ?? undefined,
      restrictedDepartmentIds: dto.restrictedDepartmentIds ?? undefined,
      preferredDepartmentIds: dto.preferredDepartmentIds ?? undefined,
      facilities: dto.facilities ?? undefined,
      supportedCategories: dto.supportedCategories ?? undefined,
      availableForTimetable: dto.availableForTimetable,
      availableForAttendance: dto.availableForAttendance,
      availableForExams: dto.availableForExams,
      availableForWorkshops: dto.availableForWorkshops,
      availableForSeminars: dto.availableForSeminars,
      availableForCombined: dto.availableForCombined,
      isSharedHall: dto.isSharedHall,
      isPracticalLab: dto.isPracticalLab,
      supportsMdc: dto.supportsMdc,
      supportsVac: dto.supportsVac,
      supportsAec: dto.supportsAec,
      supportsSec: dto.supportsSec,
      status: dto.status ?? undefined,
    };
  }

  private addSheet(
    workbook: ExcelJS.Workbook,
    name: string,
    headers: string[],
    rows: any[][],
  ) {
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(row));
  }

  private assertText(value: string | undefined | null, message: string) {
    if (!String(value ?? '').trim()) throw new BadRequestException(message);
  }

  private async assertBuildingExists(tenantId: string, buildingId: string) {
    const building = await (
      this.prisma as any
    ).infrastructureBuilding.findFirst({
      where: { tenantId, id: buildingId, deletedAt: null },
    });
    if (!building)
      throw new BadRequestException('Selected building was not found.');
    return building;
  }

  private async assertRoomRelations(tenantId: string, dto: Partial<RoomDto>) {
    if (dto.buildingId)
      await this.assertBuildingExists(tenantId, dto.buildingId);
    if (dto.floorId) {
      const floor = await (this.prisma as any).infrastructureFloor.findFirst({
        where: { tenantId, id: dto.floorId, deletedAt: null },
      });
      if (!floor)
        throw new BadRequestException('Selected floor was not found.');
      if (dto.buildingId && floor.buildingId !== dto.buildingId) {
        throw new BadRequestException(
          'Selected floor does not belong to the selected building.',
        );
      }
    }
    if (dto.roomTypeId) {
      const roomType = await this.prisma.roomType.findFirst({
        where: { tenantId, id: dto.roomTypeId } as any,
      });
      if (!roomType)
        throw new BadRequestException('Selected room type was not found.');
    }
  }

  private async assertReservableRoom(tenantId: string, classroomId: string) {
    const room = await this.prisma.classroom.findFirst({
      where: { tenantId, id: classroomId, deletedAt: null },
    });
    if (!room) throw new NotFoundException('Room not found');
    const status = String((room as any).status ?? 'ACTIVE').toUpperCase();
    if (!['ACTIVE', 'RESERVED'].includes(status)) {
      throw new BadRequestException(
        `Room cannot be reserved because it is ${status.toLowerCase()}.`,
      );
    }
    return room;
  }

  private async buildingDependencies(tenantId: string, id: string) {
    const [floors, rooms] = await Promise.all([
      (this.prisma as any).infrastructureFloor.count({
        where: { tenantId, buildingId: id, deletedAt: null },
      }),
      this.prisma.classroom.count({
        where: { tenantId, deletedAt: null, buildingId: id } as any,
      }),
    ]);
    return [
      { label: 'floors', count: floors },
      { label: 'rooms', count: rooms },
    ];
  }

  private async floorDependencies(tenantId: string, id: string) {
    const rooms = await this.prisma.classroom.count({
      where: { tenantId, deletedAt: null, floorId: id } as any,
    });
    return [{ label: 'rooms', count: rooms }];
  }

  private async roomDependencies(tenantId: string, id: string) {
    const [timetable, attendance, reservations, sections] = await Promise.all([
      this.prisma.timetablePlanEntry.count({
        where: { tenantId, classroomId: id, deletedAt: null },
      }),
      (this.prisma as any).studentAttendanceSession.count({
        where: { tenantId, classroomId: id, deletedAt: null },
      }),
      (this.prisma as any).infrastructureReservation.count({
        where: { tenantId, classroomId: id, deletedAt: null },
      }),
      this.prisma.offeringSection.count({
        where: { tenantId, classroomId: id, deletedAt: null },
      }),
    ]);
    return [
      { label: 'timetable allocations', count: timetable },
      { label: 'attendance sessions', count: attendance },
      { label: 'reservations/bookings', count: reservations },
      { label: 'academic section assignments', count: sections },
    ];
  }

  private assertNoDependencies(
    entity: string,
    dependencies: Array<{ label: string; count: number }>,
  ) {
    const used = dependencies.filter((dependency) => dependency.count > 0);
    if (!used.length) return;
    throw new BadRequestException({
      success: false,
      message: `Cannot delete ${entity}. Archive it instead because it is already linked.`,
      usedIn: used,
    });
  }

  private async audit(
    user: JwtUser,
    entity: string,
    entityId: string | null,
    action: string,
    before: unknown,
    after: unknown,
  ) {
    await (this.prisma as any).infrastructureAuditLog.create({
      data: {
        tenantId: user.tid,
        actorId: user.sub,
        entity,
        entityId,
        action,
        before: before as any,
        after: after as any,
      },
    });
  }
}
