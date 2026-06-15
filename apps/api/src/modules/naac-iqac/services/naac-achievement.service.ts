import {
  BadRequestException,
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
} from '../dto/naac-iqac.dto';
import { paginate } from '../constants/naac.constants';
import { naacDb } from './naac-prisma.util';
import { NaacEvidenceService } from './naac-evidence.service';

@Injectable()
export class NaacAchievementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidence: NaacEvidenceService,
    private readonly storage: StorageService,
  ) {}

  private db() {
    return naacDb(this.prisma);
  }

  async listFaculty(tenantId: string, page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const [items, total] = await Promise.all([
      this.db().naacFacultyAchievement.findMany({
        where: { tenantId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { evidenceTag: true },
      }),
      this.db().naacFacultyAchievement.count({ where: { tenantId } }),
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

    const storageKey = `naac/${user.tid}/achievements/faculty/${Date.now()}-${file.originalname}`;
    await this.storage.put(storageKey, file.buffer, {
      contentType: file.mimetype,
    });

    const tag = await this.evidence.create(user, {
      sourceType: 'faculty_achievement',
      sourceId: user.sub,
      criterion: dto.criterion,
      academicYear: dto.academicYear,
      metricCode: dto.metricCode,
      fileName: file.originalname,
      storageKey,
      evidenceNotes: dto.title,
    });

    return this.db().naacFacultyAchievement.create({
      data: {
        tenantId: user.tid,
        staffProfileId: dto.staffProfileId,
        achievementType: dto.achievementType,
        title: dto.title,
        description: dto.description,
        achievementDate: dto.achievementDate
          ? new Date(dto.achievementDate)
          : undefined,
        staffPublicationId: dto.staffPublicationId,
        staffAwardId: dto.staffAwardId,
        evidenceTagId: tag.id,
        status: 'PENDING',
        submittedById: user.sub,
      },
      include: { evidenceTag: true },
    });
  }

  async listStudent(tenantId: string, page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const [items, total] = await Promise.all([
      this.db().naacStudentAchievement.findMany({
        where: { tenantId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.db().naacStudentAchievement.count({ where: { tenantId } }),
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

    const tag = await this.evidence.create(user, {
      sourceType: 'student_achievement',
      sourceId: dto.studentId ?? user.sub,
      criterion: dto.criterion,
      academicYear: dto.academicYear,
      metricCode: dto.metricCode,
      departmentId: dto.departmentId,
      fileName: file.originalname,
      storageKey,
      evidenceNotes: dto.title,
    });

    return this.db().naacStudentAchievement.create({
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
        evidenceTagId: tag.id,
        status: 'PENDING',
        submittedById: user.sub,
      },
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

  async create(user: JwtUser, dto: CreateMouDto, file?: Express.Multer.File) {
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
        academicYear: '2025-26',
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
