import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from '../school-sis/school-sis.service';
import type { UpsertSchoolMobilePrayerDto } from './dto/school-mobile.dto';
import { isoWeekday, weekdayLabel } from './school-mobile.util';

const DEFAULT_PRAYERS: Array<{ weekday: number; title: string; body: string }> =
  [
    {
      weekday: 1,
      title: 'Monday morning prayer',
      body: 'Lord, as we begin this week, fill our school with Your light. Help every child, parent and teacher to work with honesty, kindness and courage. Amen.',
    },
    {
      weekday: 2,
      title: 'Tuesday morning prayer',
      body: 'God of wisdom, bless our classrooms today. Give us attentive minds, generous hearts and the grace to serve one another. Amen.',
    },
    {
      weekday: 3,
      title: 'Wednesday morning prayer',
      body: 'Heavenly Father, keep St. Luke’s in Your care. Guide our studies, our games and our friendships so that we may grow in knowledge, service and light. Amen.',
    },
    {
      weekday: 4,
      title: 'Thursday morning prayer',
      body: 'Lord Jesus, walk with us through this day. Help us to be truthful, respectful and ready to help a classmate in need. Amen.',
    },
    {
      weekday: 5,
      title: 'Friday morning prayer',
      body: 'God of peace, thank You for this week of learning. Bless our families and our school community as we rest and begin again. Amen.',
    },
    {
      weekday: 6,
      title: 'Saturday prayer',
      body: 'Creator God, we thank You for rest, family and the gift of this school. Keep us close to You. Amen.',
    },
    {
      weekday: 7,
      title: 'Sunday prayer',
      body: 'Lord, we praise You on this holy day. Renew our faith so we may return to school as children of light. Amen.',
    },
  ];

@Injectable()
export class SchoolMobilePrayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
  ) {}

  async ensureDefaults(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const count = await this.prisma.schoolMobilePrayer.count({
      where: { tenantId },
    });
    if (count > 0) return;
    await this.prisma.schoolMobilePrayer.createMany({
      data: DEFAULT_PRAYERS.map((row) => ({
        id: randomUUID(),
        tenantId,
        weekday: row.weekday,
        title: row.title,
        body: row.body,
        enabled: true,
      })),
    });
  }

  async list(tenantId: string) {
    await this.ensureDefaults(tenantId);
    const rows = await this.prisma.schoolMobilePrayer.findMany({
      where: { tenantId },
      orderBy: { weekday: 'asc' },
    });
    return rows.map((row) => ({
      ...row,
      weekdayLabel: weekdayLabel(row.weekday),
    }));
  }

  async today(tenantId: string, now = new Date()) {
    await this.ensureDefaults(tenantId);
    const weekday = isoWeekday(now);
    const row = await this.prisma.schoolMobilePrayer.findUnique({
      where: { tenantId_weekday: { tenantId, weekday } },
    });
    if (!row || !row.enabled) {
      return {
        weekday,
        weekdayLabel: weekdayLabel(weekday),
        title: 'Morning prayer',
        body: 'Lord, bless St. Luke’s Secondary School today. Amen.',
        enabled: true,
      };
    }
    return { ...row, weekdayLabel: weekdayLabel(row.weekday) };
  }

  async upsert(tenantId: string, dto: UpsertSchoolMobilePrayerDto) {
    await this.ensureDefaults(tenantId);
    const existing = await this.prisma.schoolMobilePrayer.findUnique({
      where: { tenantId_weekday: { tenantId, weekday: dto.weekday } },
    });
    if (!existing) throw new NotFoundException('Prayer day not found');
    return this.prisma.schoolMobilePrayer.update({
      where: { id: existing.id },
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        enabled: dto.enabled !== false,
      },
    });
  }
}
