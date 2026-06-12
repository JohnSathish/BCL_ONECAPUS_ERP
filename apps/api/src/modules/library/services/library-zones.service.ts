import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateReadingZoneDto,
  UpdateReadingZoneDto,
} from '../dto/library.dto';

export const DEFAULT_READING_ZONES = [
  { code: 'MAIN', name: 'Main Reading Hall', totalSeats: 120, sortOrder: 1 },
  { code: 'SILENT', name: 'Silent Zone', totalSeats: 60, sortOrder: 2 },
  { code: 'GROUP', name: 'Group Study Area', totalSeats: 40, sortOrder: 3 },
  { code: 'DIGITAL', name: 'Digital Lab', totalSeats: 30, sortOrder: 4 },
];

@Injectable()
export class LibraryZonesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaults(tenantId: string) {
    const count = await this.prisma.libraryReadingZone.count({
      where: { tenantId },
    });
    if (count > 0) return;
    await this.prisma.libraryReadingZone.createMany({
      data: DEFAULT_READING_ZONES.map((z) => ({
        id: randomUUID(),
        tenantId,
        ...z,
      })),
    });
  }

  async list(tenantId: string) {
    await this.ensureDefaults(tenantId);
    return this.prisma.libraryReadingZone.findMany({
      where: { tenantId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(tenantId: string, dto: CreateReadingZoneDto) {
    return this.prisma.libraryReadingZone.create({
      data: {
        id: randomUUID(),
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        totalSeats: dto.totalSeats ?? 50,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateReadingZoneDto) {
    const row = await this.prisma.libraryReadingZone.findFirst({
      where: { tenantId, id },
    });
    if (!row) throw new NotFoundException('Reading zone not found');
    return this.prisma.libraryReadingZone.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        totalSeats: dto.totalSeats,
        sortOrder: dto.sortOrder,
        active: dto.active,
      },
    });
  }

  async occupancy(tenantId: string) {
    const zones = await this.list(tenantId);
    const openVisits = await this.prisma.libraryVisit.groupBy({
      by: ['zoneId'],
      where: { tenantId, exitAt: null, zoneId: { not: null } },
      _count: { zoneId: true },
    });
    const countMap = new Map(
      openVisits.map((v) => [v.zoneId!, v._count.zoneId]),
    );

    return zones.map((z) => {
      const occupied = countMap.get(z.id) ?? 0;
      return {
        ...z,
        occupied,
        available: Math.max(0, z.totalSeats - occupied),
        occupancyPercent:
          z.totalSeats > 0 ? Math.round((occupied / z.totalSeats) * 100) : 0,
      };
    });
  }

  async pickZoneForEntry(tenantId: string, preferredZoneId?: string) {
    const zones = await this.occupancy(tenantId);
    if (!zones.length) return null;

    if (preferredZoneId) {
      const preferred = zones.find((z) => z.id === preferredZoneId);
      if (!preferred) throw new NotFoundException('Reading zone not found');
      if (preferred.available <= 0)
        throw new BadRequestException(`${preferred.name} is full`);
      return preferred;
    }

    const withCapacity = zones
      .filter((z) => z.available > 0)
      .sort((a, b) => b.available - a.available);
    return withCapacity[0] ?? null;
  }

  buildSeatLabel(zoneCode: string, occupied: number) {
    return `${zoneCode}-${String(occupied + 1).padStart(3, '0')}`;
  }
}
