import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { resolveSchoolStaffIdForUser } from './school-sis-staff-lookup';
import { SchoolSisAccessService } from './school-sis-access.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisPushService } from './school-sis-push.service';
import { homeworkListStatus } from './school-sis-homework.status';
import type { SaveSchoolHomeworkDto } from './dto/school-homework.dto';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type HomeworkActor = {
  userId: string;
  email?: string | null;
  manage: boolean;
};

function parseDay(value: string) {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function asJwt(actor: HomeworkActor): JwtUser {
  return {
    sub: actor.userId,
    tid: '',
    permissions: actor.manage ? ['school-sis:manage'] : [],
  } as JwtUser;
}

@Injectable()
export class SchoolSisHomeworkService {
  private readonly logger = new Logger(SchoolSisHomeworkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly access: SchoolSisAccessService,
    private readonly storage: StorageService,
    private readonly push: SchoolSisPushService,
  ) {}

  private async staffId(tenantId: string, actor: HomeworkActor) {
    return resolveSchoolStaffIdForUser(this.prisma, tenantId, {
      sub: actor.userId,
      email: actor.email,
    });
  }

  private async requireStaff(tenantId: string, actor: HomeworkActor) {
    const staffId = await this.staffId(tenantId, actor);
    if (!staffId) {
      throw new ForbiddenException('No staff profile is linked to this login');
    }
    return staffId;
  }

  private async sectionIds(tenantId: string, actor: HomeworkActor) {
    if (actor.manage) return null;
    return this.access.sectionIdsForUser(tenantId, actor.userId);
  }

  async options(tenantId: string, actor: HomeworkActor) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const staffId = await this.staffId(tenantId, actor);
    const allowed = await this.sectionIds(tenantId, actor);
    const sections = await this.prisma.schoolSection.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        active: true,
        ...(allowed ? { id: { in: allowed.length ? allowed : ['none'] } } : {}),
      },
      include: { grade: true },
      orderBy: [{ grade: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
    const gradeIds = [...new Set(sections.map((s) => s.gradeId))];
    const gradeSubjects = gradeIds.length
      ? await this.prisma.schoolGradeSubject.findMany({
          where: {
            tenantId,
            academicYearId: year.id,
            gradeId: { in: gradeIds },
          },
          include: { subject: true },
        })
      : [];
    const taught =
      staffId && !actor.manage
        ? await this.prisma.schoolSubjectTeacherAssignment.findMany({
            where: {
              tenantId,
              staffId,
              academicYearId: year.id,
              deletedAt: null,
            },
            include: { subject: true },
          })
        : [];
    const subjectMap = new Map<
      string,
      { id: string; name: string; gradeId?: string }
    >();
    for (const row of gradeSubjects) {
      if (!row.subject.active || row.subject.deletedAt) continue;
      subjectMap.set(`${row.gradeId}:${row.subjectId}`, {
        id: row.subjectId,
        name: row.subject.name,
        gradeId: row.gradeId,
      });
    }
    for (const row of taught) {
      if (!row.subject.active || row.subject.deletedAt) continue;
      subjectMap.set(row.subjectId, {
        id: row.subjectId,
        name: row.subject.name,
      });
    }
    const grades = new Map<
      string,
      {
        name: string;
        gradeId: string;
        sections: { id: string; name: string }[];
      }
    >();
    for (const section of sections) {
      const g = grades.get(section.grade.name) ?? {
        name: section.grade.name,
        gradeId: section.gradeId,
        sections: [],
      };
      g.sections.push({ id: section.id, name: section.name });
      grades.set(section.grade.name, g);
    }
    return {
      academicYearId: year.id,
      classes: [...grades.values()],
      subjects: [...subjectMap.values()],
    };
  }

  async list(tenantId: string, actor: HomeworkActor) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const staffId = await this.staffId(tenantId, actor);
    const allowed = await this.sectionIds(tenantId, actor);
    const rows = await this.prisma.schoolHomework.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        ...(actor.manage || !staffId ? {} : { staffId }),
        ...(allowed
          ? { sectionId: { in: allowed.length ? allowed : ['none'] } }
          : {}),
      },
      include: {
        section: { include: { grade: true } },
        subject: true,
        files: true,
        _count: { select: { submissions: true } },
      },
      orderBy: [{ assignDate: 'desc' }, { createdAt: 'desc' }],
    });
    const enrollCounts = await this.prisma.schoolEnrollment.groupBy({
      by: ['sectionId'],
      where: {
        tenantId,
        academicYearId: year.id,
        status: 'ACTIVE',
        deletedAt: null,
      },
      _count: { _all: true },
    });
    const enrolled = new Map(
      enrollCounts.map((r) => [r.sectionId, r._count._all]),
    );
    const today = todayKey();
    const items = rows.map((row) => {
      const listStatus = homeworkListStatus({
        status: row.status,
        dueDate: row.dueDate,
        today,
      });
      return {
        id: row.id,
        title: row.title,
        body: row.body,
        assignDate: row.assignDate.toISOString().slice(0, 10),
        dueDate: row.dueDate.toISOString().slice(0, 10),
        status: row.status,
        listStatus,
        visibleTo: row.visibleTo,
        sectionId: row.sectionId,
        subjectId: row.subjectId,
        classLabel: `${row.section.grade.name} ${row.section.name}`.trim(),
        subjectName: row.subject?.name ?? '—',
        submitted: row._count.submissions,
        enrolled: enrolled.get(row.sectionId) ?? 0,
        files: row.files.map((f) => ({
          id: f.id,
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
        })),
      };
    });
    return {
      academicYearId: year.id,
      kpis: {
        total: items.length,
        active: items.filter((i) => i.listStatus === 'active').length,
        pendingReview: items.filter((i) => i.listStatus === 'pending').length,
        pending: items.filter((i) => i.listStatus === 'pending').length,
        past: items.filter((i) => i.listStatus === 'completed').length,
        drafts: items.filter((i) => i.listStatus === 'draft').length,
      },
      items,
    };
  }

  async reports(tenantId: string, actor: HomeworkActor) {
    const data = await this.list(tenantId, actor);
    const byClass = new Map<
      string,
      {
        classLabel: string;
        total: number;
        active: number;
        pending: number;
        completed: number;
      }
    >();
    for (const item of data.items) {
      const row = byClass.get(item.classLabel) ?? {
        classLabel: item.classLabel,
        total: 0,
        active: 0,
        pending: 0,
        completed: 0,
      };
      row.total += 1;
      if (item.listStatus === 'active') row.active += 1;
      if (item.listStatus === 'pending') row.pending += 1;
      if (item.listStatus === 'completed') row.completed += 1;
      byClass.set(item.classLabel, row);
    }
    return { kpis: data.kpis, byClass: [...byClass.values()] };
  }

  async get(tenantId: string, actor: HomeworkActor, id: string) {
    const data = await this.list(tenantId, actor);
    const item = data.items.find((row) => row.id === id);
    if (!item) throw new NotFoundException('Homework not found');
    return item;
  }

  async save(
    tenantId: string,
    actor: HomeworkActor,
    dto: SaveSchoolHomeworkDto,
    files: Express.Multer.File[] = [],
    id?: string,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const staffId = await this.requireStaff(tenantId, actor);
    await this.access.assertSectionAccess(
      tenantId,
      asJwt(actor),
      dto.sectionId,
    );
    const year = await this.sis.currentYear(tenantId);
    const section = await this.prisma.schoolSection.findFirst({
      where: {
        id: dto.sectionId,
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
      },
    });
    if (!section) throw new BadRequestException('Class section was not found');
    if (dto.subjectId) {
      const subject = await this.prisma.schoolSubject.findFirst({
        where: { id: dto.subjectId, tenantId, deletedAt: null },
      });
      if (!subject) throw new BadRequestException('Subject was not found');
    }
    if (parseDay(dto.dueDate) < parseDay(dto.assignDate)) {
      throw new BadRequestException(
        'Due date cannot be before the assign date',
      );
    }
    const status = dto.asDraft ? 'DRAFT' : 'ASSIGNED';
    const visibleTo =
      dto.visibleTo === 'STUDENTS_PARENTS' ? 'STUDENTS_PARENTS' : 'STUDENTS';
    const payload = {
      tenantId,
      academicYearId: year.id,
      sectionId: dto.sectionId,
      subjectId: dto.subjectId || null,
      staffId,
      title: dto.title.trim(),
      body: (dto.body ?? '').trim(),
      assignDate: parseDay(dto.assignDate),
      dueDate: parseDay(dto.dueDate),
      status,
      visibleTo,
      deletedAt: null,
    };
    let homeworkId = id;
    let previousStatus: string | null = null;
    if (id) {
      const existing = await this.prisma.schoolHomework.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('Homework not found');
      previousStatus = existing.status;
      await this.prisma.schoolHomework.update({
        where: { id },
        data: payload,
      });
    } else {
      const created = await this.prisma.schoolHomework.create({
        data: payload,
      });
      homeworkId = created.id;
    }
    await this.storeFiles(tenantId, homeworkId!, files);
    const saved = await this.get(tenantId, actor, homeworkId!);
    const newlyAssigned =
      status === 'ASSIGNED' && (!id || previousStatus !== 'ASSIGNED');
    if (newlyAssigned) {
      void this.push
        .notifyHomeworkAssigned(tenantId, {
          homeworkId: homeworkId!,
          sectionId: saved.sectionId,
          subjectName: saved.subjectName,
          title: saved.title,
          classLabel: saved.classLabel,
          dueDate: saved.dueDate,
          visibleTo: saved.visibleTo,
        })
        .catch((err) => {
          this.logger.warn(
            `Homework push failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }
    return saved;
  }

  async duplicate(tenantId: string, actor: HomeworkActor, id: string) {
    const src = await this.prisma.schoolHomework.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!src) throw new NotFoundException('Homework not found');
    await this.access.assertSectionAccess(
      tenantId,
      asJwt(actor),
      src.sectionId,
    );
    const copy = await this.prisma.schoolHomework.create({
      data: {
        tenantId,
        academicYearId: src.academicYearId,
        sectionId: src.sectionId,
        subjectId: src.subjectId,
        staffId: src.staffId,
        title: src.title.endsWith('(Copy)') ? src.title : `${src.title} (Copy)`,
        body: src.body,
        assignDate: src.assignDate,
        dueDate: src.dueDate,
        status: 'DRAFT',
        visibleTo: src.visibleTo,
      },
    });
    return this.get(tenantId, actor, copy.id);
  }

  async remove(tenantId: string, actor: HomeworkActor, id: string) {
    const row = await this.prisma.schoolHomework.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Homework not found');
    await this.access.assertSectionAccess(
      tenantId,
      asJwt(actor),
      row.sectionId,
    );
    await this.prisma.schoolHomework.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  async studentList(tenantId: string, studentId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const enroll = await this.prisma.schoolEnrollment.findFirst({
      where: {
        tenantId,
        studentId,
        academicYearId: year.id,
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: { section: { include: { grade: true } } },
    });
    if (!enroll) return { items: [] };
    const today = todayKey();
    const rows = await this.prisma.schoolHomework.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        sectionId: enroll.sectionId,
        status: 'ASSIGNED',
        deletedAt: null,
        assignDate: { lte: new Date(`${today}T23:59:59.999Z`) },
      },
      include: { subject: true, files: true },
      orderBy: { dueDate: 'asc' },
    });
    const classLabel =
      `${enroll.section.grade.name} ${enroll.section.name}`.trim();
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        assignDate: row.assignDate.toISOString().slice(0, 10),
        dueDate: row.dueDate.toISOString().slice(0, 10),
        listStatus: homeworkListStatus({
          status: row.status,
          dueDate: row.dueDate,
          today,
        }),
        subjectName: row.subject?.name ?? '—',
        classLabel,
        files: row.files.map((f) => ({
          id: f.id,
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
        })),
      })),
    };
  }

  async studentGet(tenantId: string, studentId: string, homeworkId: string) {
    const list = await this.studentList(tenantId, studentId);
    const item = list.items.find((row) => row.id === homeworkId);
    if (!item) throw new NotFoundException('Homework not found');
    return item;
  }

  async openFile(
    tenantId: string,
    fileId: string,
    access:
      | { kind: 'staff'; actor: HomeworkActor }
      | { kind: 'student'; studentId: string },
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const file = await this.prisma.schoolHomeworkFile.findFirst({
      where: { id: fileId, tenantId },
      include: { homework: true },
    });
    if (!file || file.homework.deletedAt) {
      throw new NotFoundException('Attachment not found');
    }
    if (access.kind === 'staff') {
      await this.access.assertSectionAccess(
        tenantId,
        asJwt(access.actor),
        file.homework.sectionId,
      );
    } else {
      if (file.homework.status !== 'ASSIGNED') {
        throw new NotFoundException('Homework not found');
      }
      const year = await this.sis.currentYear(tenantId);
      const enroll = await this.prisma.schoolEnrollment.findFirst({
        where: {
          tenantId,
          studentId: access.studentId,
          academicYearId: year.id,
          sectionId: file.homework.sectionId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!enroll) throw new ForbiddenException('Not enrolled in this class');
    }
    const buf = await this.storage.get(file.storageKey);
    if (!buf?.length) throw new NotFoundException('Attachment file is missing');
    const safeName = file.fileName.replace(/"/g, '');
    return new StreamableFile(buf, {
      type: file.mimeType || 'application/octet-stream',
      disposition: `attachment; filename="${safeName}"`,
    });
  }

  private async storeFiles(
    tenantId: string,
    homeworkId: string,
    files: Express.Multer.File[],
  ) {
    for (const file of files ?? []) {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        throw new BadRequestException(
          'Use PDF, DOC, DOCX, JPG or PNG files only',
        );
      }
      if (file.size > MAX_FILE_BYTES) {
        throw new BadRequestException('Each file must be 5 MB or smaller');
      }
      const safe = file.originalname.replace(/[^\w.\-]+/g, '_').slice(0, 80);
      const key = `school-homework/${tenantId}/${homeworkId}/${Date.now()}-${safe}`;
      await this.storage.put(key, file.buffer, { contentType: file.mimetype });
      await this.prisma.schoolHomeworkFile.create({
        data: {
          tenantId,
          homeworkId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey: key,
        },
      });
    }
  }
}
