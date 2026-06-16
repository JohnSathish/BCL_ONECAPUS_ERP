import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import type {
  CreateFacultyAchievementDto,
  CreateMouActivityDto,
  CreateMouDto,
  CreateStudentAchievementDto,
  ReviewAchievementDto,
} from '../dto/naac-iqac.dto';
import { paginate } from '../constants/naac.constants';
import { naacDb } from './naac-prisma.util';
import { NaacEvidenceService } from './naac-evidence.service';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';

@Injectable()
export class NaacAchievementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidence: NaacEvidenceService,
    private readonly storage: StorageService,
    private readonly notifications: UserNotificationsService,
  ) {}

  private db() {
    return naacDb(this.prisma);
  }

  async resolveStaffProfile(user: JwtUser) {
    return this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        departmentId: true,
      },
    });
  }

  private canManageAll(user: JwtUser) {
    return user.permissions?.includes('naac-iqac:manage') ?? false;
  }

  private async resolveStaffProfileId(user: JwtUser, requestedId?: string) {
    const own = await this.resolveStaffProfile(user);
    if (this.canManageAll(user) && requestedId) return requestedId;
    if (!own) {
      throw new BadRequestException(
        'No staff profile linked to your account. Contact HR to enable NAAC submissions.',
      );
    }
    if (requestedId && requestedId !== own.id) {
      throw new ForbiddenException(
        'Cannot submit achievements for another staff member',
      );
    }
    return own.id;
  }

  async listFaculty(
    tenantId: string,
    page?: number,
    limit?: number,
    filters?: { status?: string; staffProfileId?: string },
  ) {
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const where: Record<string, unknown> = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.staffProfileId) where.staffProfileId = filters.staffProfileId;

    const [items, total] = await Promise.all([
      this.db().naacFacultyAchievement.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { evidenceTag: true },
      }),
      this.db().naacFacultyAchievement.count({ where }),
    ]);
    return { items, total, page: p, limit: l };
  }

  async createFaculty(
    user: JwtUser,
    dto: CreateFacultyAchievementDto,
    file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('Evidence file is mandatory');

    const staffProfileId = await this.resolveStaffProfileId(
      user,
      dto.staffProfileId,
    );

    const storageKey = `naac/${user.tid}/achievements/faculty/${Date.now()}-${file.originalname}`;
    await this.storage.put(storageKey, file.buffer, {
      contentType: file.mimetype,
    });

    const achievement = await this.db().naacFacultyAchievement.create({
      data: {
        tenantId: user.tid,
        staffProfileId,
        achievementType: dto.achievementType,
        title: dto.title,
        description: dto.description,
        achievementDate: dto.achievementDate
          ? new Date(dto.achievementDate)
          : undefined,
        staffPublicationId: dto.staffPublicationId,
        staffAwardId: dto.staffAwardId,
        status: 'PENDING',
        submittedById: user.sub,
      },
    });

    const tag = await this.evidence.create(user, {
      sourceType: 'faculty_achievement',
      sourceId: achievement.id,
      criterion: dto.criterion,
      academicYear: dto.academicYear,
      metricCode: dto.metricCode,
      fileName: file.originalname,
      storageKey,
      evidenceNotes: dto.title,
    });

    return this.db().naacFacultyAchievement.update({
      where: { id: achievement.id },
      data: { evidenceTagId: tag.id },
      include: { evidenceTag: true },
    });
  }

  async reviewFaculty(user: JwtUser, id: string, dto: ReviewAchievementDto) {
    const row = await this.db().naacFacultyAchievement.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!row) throw new NotFoundException('Faculty achievement not found');
    if (row.status !== 'PENDING') {
      throw new BadRequestException(
        'Only pending achievements can be reviewed',
      );
    }
    if (!['APPROVED', 'REJECTED'].includes(dto.status)) {
      throw new BadRequestException('Status must be APPROVED or REJECTED');
    }

    const description = dto.reviewNotes
      ? [row.description, `[IQAC ${dto.status}]: ${dto.reviewNotes}`]
          .filter(Boolean)
          .join('\n\n')
      : row.description;

    const updated = await this.db().naacFacultyAchievement.update({
      where: { id },
      data: { status: dto.status, description },
      include: { evidenceTag: true },
    });

    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: row.staffProfileId, tenantId: user.tid },
      select: { portalUserId: true, fullName: true },
    });
    if (staff?.portalUserId) {
      await this.notifications.createInApp({
        tenantId: user.tid,
        userId: staff.portalUserId,
        type: 'NAAC_ACHIEVEMENT_REVIEW',
        title: `Achievement ${dto.status.toLowerCase()}`,
        body: `${updated.title} was ${dto.status.toLowerCase()} by IQAC`,
        link: '/staff/naac',
        metadata: { achievementId: id, status: dto.status },
      });
    }

    return updated;
  }

  async bulkReviewFaculty(
    user: JwtUser,
    dto: ReviewAchievementDto & { ids: string[] },
  ) {
    const reviewed: string[] = [];
    const skipped: string[] = [];
    for (const id of dto.ids) {
      try {
        await this.reviewFaculty(user, id, {
          status: dto.status,
          reviewNotes: dto.reviewNotes,
        });
        reviewed.push(id);
      } catch {
        skipped.push(id);
      }
    }
    return {
      reviewed: reviewed.length,
      skipped: skipped.length,
      ids: reviewed,
    };
  }

  async listStudent(
    tenantId: string,
    page?: number,
    limit?: number,
    filters?: { status?: string },
  ) {
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const where: Record<string, unknown> = { tenantId };
    if (filters?.status) where.status = filters.status;

    const [items, total] = await Promise.all([
      this.db().naacStudentAchievement.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.db().naacStudentAchievement.count({ where }),
    ]);
    return { items, total, page: p, limit: l };
  }

  async createStudent(
    user: JwtUser,
    dto: CreateStudentAchievementDto,
    file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('Evidence file is mandatory');

    const storageKey = `naac/${user.tid}/achievements/student/${Date.now()}-${file.originalname}`;
    await this.storage.put(storageKey, file.buffer, {
      contentType: file.mimetype,
    });

    const achievement = await this.db().naacStudentAchievement.create({
      data: {
        tenantId: user.tid,
        studentId: dto.studentId,
        achievementType: dto.achievementType,
        title: dto.title,
        description: dto.description,
        achievementDate: dto.achievementDate
          ? new Date(dto.achievementDate)
          : undefined,
        departmentId: dto.departmentId,
        status: 'PENDING',
        submittedById: user.sub,
      },
    });

    const tag = await this.evidence.create(user, {
      sourceType: 'student_achievement',
      sourceId: achievement.id,
      criterion: dto.criterion,
      academicYear: dto.academicYear,
      metricCode: dto.metricCode,
      departmentId: dto.departmentId,
      fileName: file.originalname,
      storageKey,
      evidenceNotes: dto.title,
    });

    return this.db().naacStudentAchievement.update({
      where: { id: achievement.id },
      data: { evidenceTagId: tag.id },
    });
  }

  async reviewStudent(user: JwtUser, id: string, dto: ReviewAchievementDto) {
    const row = await this.db().naacStudentAchievement.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!row) throw new NotFoundException('Student achievement not found');
    if (row.status !== 'PENDING') {
      throw new BadRequestException(
        'Only pending achievements can be reviewed',
      );
    }
    if (!['APPROVED', 'REJECTED'].includes(dto.status)) {
      throw new BadRequestException('Status must be APPROVED or REJECTED');
    }

    const description = dto.reviewNotes
      ? [row.description, `[IQAC ${dto.status}]: ${dto.reviewNotes}`]
          .filter(Boolean)
          .join('\n\n')
      : row.description;

    return this.db().naacStudentAchievement.update({
      where: { id },
      data: { status: dto.status, description },
    });
  }
}

@Injectable()
export class NaacMouService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly evidence: NaacEvidenceService,
  ) {}

  private db() {
    return naacDb(this.prisma);
  }

  async list(tenantId: string) {
    return this.db().naacMou.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { activities: true },
    });
  }

  async getById(tenantId: string, id: string) {
    const row = await this.db().naacMou.findFirst({
      where: { id, tenantId },
      include: { activities: { orderBy: { activityDate: 'desc' } } },
    });
    if (!row) throw new NotFoundException('MoU not found');
    return row;
  }

  async create(
    user: JwtUser,
    dto: CreateMouDto,
    file?: Express.Multer.File,
    academicYear = '2025-26',
  ) {
    let storageKey: string | undefined;
    let fileName: string | undefined;
    if (file?.buffer?.length) {
      storageKey = `naac/${user.tid}/mous/${Date.now()}-${file.originalname}`;
      await this.storage.put(storageKey, file.buffer, {
        contentType: file.mimetype,
      });
      fileName = file.originalname;
    }

    const mou = await this.db().naacMou.create({
      data: {
        tenantId: user.tid,
        partnerType: dto.partnerType,
        partnerName: dto.partnerName,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        storageKey,
        fileName,
        notes: dto.notes,
      },
    });

    if (storageKey) {
      await this.evidence.create(user, {
        sourceType: 'mou',
        sourceId: mou.id,
        criterion: 3,
        academicYear,
        metricCode: '3.5.1',
        fileName,
        storageKey,
        evidenceNotes: `MoU with ${dto.partnerName}`,
      });
    }

    return mou;
  }

  async addActivity(
    tenantId: string,
    mouId: string,
    dto: CreateMouActivityDto,
  ) {
    const mou = await this.getById(tenantId, mouId);
    return this.db().naacMouActivity.create({
      data: {
        tenantId,
        mouId: mou.id,
        title: dto.title,
        activityDate: dto.activityDate ? new Date(dto.activityDate) : undefined,
        outcomes: dto.outcomes,
        reportNotes: dto.reportNotes,
      },
    });
  }
}
