import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type { CreateMomDto, UpdateMomDto } from '../dto/governance.dto';
import { GovernanceMeetingService } from './governance-meeting.service';
import { GovernancePdfService } from './governance-pdf.service';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceMomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meetings: GovernanceMeetingService,
    private readonly pdf: GovernancePdfService,
  ) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async getForMeeting(tenantId: string, meetingId: string) {
    await this.meetings.getById(tenantId, meetingId);
    return this.db().governanceMeetingMinute.findMany({
      where: { tenantId, meetingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(tenantId: string, id: string) {
    const row = await this.db().governanceMeetingMinute.findFirst({
      where: { id, tenantId },
      include: {
        meeting: {
          include: {
            committee: { select: { name: true, shortCode: true } },
            agendaItems: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Minutes not found');
    return row;
  }

  async create(user: JwtUser, dto: CreateMomDto) {
    await this.meetings.getById(user.tid, dto.meetingId);
    return this.db().governanceMeetingMinute.create({
      data: {
        tenantId: user.tid,
        meetingId: dto.meetingId,
        discussion: dto.discussion,
        decisions: dto.decisions,
        resolutions: dto.resolutions,
        futureActions: dto.futureActions,
        createdById: user.sub,
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateMomDto) {
    const row = await this.getById(user.tid, id);
    if (row.status === 'PUBLISHED') {
      throw new NotFoundException('Published minutes cannot be edited');
    }

    return this.db().governanceMeetingMinute.update({
      where: { id },
      data: {
        discussion: dto.discussion,
        decisions: dto.decisions,
        resolutions: dto.resolutions,
        futureActions: dto.futureActions,
        status: dto.status,
      },
    });
  }

  async publish(user: JwtUser, id: string) {
    const row = await this.getById(user.tid, id);
    const pdfPath = await this.pdf.generateMomPdf(user.tid, row);

    return this.db().governanceMeetingMinute.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        pdfPath,
      },
    });
  }
}
