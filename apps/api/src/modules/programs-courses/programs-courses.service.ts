import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CourseListQueryDto } from './dto/course-list-query.dto';
import { AcademicCatalogService } from './academic-catalog.service';
import { CurriculumOfferingListService } from './curriculum-offering-list.service';
import { ProgramDataCleanupService } from './program-data-cleanup.service';
import { ProgramVersionLifecycleService } from './program-version-lifecycle.service';
import type { CurriculumOfferingListQueryDto } from './dto/curriculum-offering-list-query.dto';
import {
  CreateCourseDto,
  CreateCourseOfferingDto,
  CreateProgramDto,
  CreateOfferingSectionDto,
  CreateProgramVersionDto,
  DuplicateProgramVersionDto,
  NormalizeProgramVersionsDto,
  RelabelProgramVersionDto,
  UpdateCourseDto,
  UpdateCourseOfferingDto,
  UpdateOfferingSectionDto,
  UpdateProgramDto,
} from './dto/programs-courses.dto';

/** HTTP-facing facade; all catalog persistence lives in {@link AcademicCatalogService}. */
@Injectable()
export class ProgramsCoursesService {
  constructor(
    private readonly catalog: AcademicCatalogService,
    private readonly versionLifecycle: ProgramVersionLifecycleService,
    private readonly dataCleanup: ProgramDataCleanupService,
    private readonly curriculumList: CurriculumOfferingListService,
  ) {}

  listPrograms(tenantId: string, query: PaginationQueryDto) {
    return this.catalog.listPrograms(tenantId, query);
  }

  getProgram(tenantId: string, id: string) {
    return this.catalog.getProgram(tenantId, id);
  }

  createProgram(tenantId: string, dto: CreateProgramDto) {
    return this.catalog.createProgram(tenantId, dto);
  }

  updateProgram(tenantId: string, id: string, dto: UpdateProgramDto) {
    return this.catalog.updateProgram(tenantId, id, dto);
  }

  createProgramVersion(user: JwtUser, dto: CreateProgramVersionDto) {
    return this.versionLifecycle.createDraft(user.tid, user.sub, {
      programId: dto.programId,
      cbcsEnabled: dto.cbcsEnabled,
      sourceVersionId: dto.sourceVersionId,
    });
  }

  listProgramVersions(tenantId: string, programId: string) {
    return this.versionLifecycle.listForProgram(tenantId, programId);
  }

  getProgramVersion(tenantId: string, id: string) {
    return this.versionLifecycle.getVersion(tenantId, id);
  }

  publishProgramVersion(user: JwtUser, id: string) {
    return this.versionLifecycle.publish(user.tid, user.sub, id);
  }

  archiveProgramVersion(user: JwtUser, id: string) {
    return this.versionLifecycle.archive(user.tid, user.sub, id);
  }

  deleteProgramVersion(tenantId: string, id: string) {
    return this.versionLifecycle.deleteIfSafe(tenantId, id);
  }

  purgeProgramVersion(tenantId: string, id: string) {
    return this.versionLifecycle.purgeAndDeleteUnusedVersion(tenantId, id);
  }

  relabelProgramVersion(tenantId: string, id: string, version: number) {
    return this.versionLifecycle.relabelVersion(tenantId, id, version);
  }

  normalizeProgramVersions(user: JwtUser, dto: NormalizeProgramVersionsDto) {
    return this.versionLifecycle.normalizeMistakenProgramVersions(
      user.tid,
      user.sub,
      dto.programCode,
      {
        keepVersionNumber: dto.keepVersionNumber,
        removeVersionNumbers: dto.removeVersionNumbers ?? [1, 2],
      },
    );
  }

  duplicateProgramVersion(user: JwtUser, sourceVersionId: string) {
    return this.versionLifecycle.duplicate(user.tid, user.sub, sourceVersionId);
  }

  listCourses(
    tenantId: string,
    query: CourseListQueryDto | PaginationQueryDto,
  ) {
    return this.catalog.listCourses(tenantId, query);
  }

  getCourse(tenantId: string, id: string) {
    return this.catalog.getCourse(tenantId, id);
  }

  checkCourseDuplicates(
    tenantId: string,
    params: {
      code?: string;
      title?: string;
      departmentId?: string;
      excludeCourseId?: string;
    },
  ) {
    return this.catalog.checkCourseDuplicates(tenantId, params);
  }

  createCourse(tenantId: string, dto: CreateCourseDto) {
    return this.catalog.createCourse(tenantId, dto);
  }

  updateCourse(tenantId: string, id: string, dto: UpdateCourseDto) {
    return this.catalog.updateCourse(tenantId, id, dto);
  }

  listOfferings(tenantId: string, programVersionId?: string) {
    return this.catalog.listOfferings(tenantId, programVersionId);
  }

  listCurriculumOfferings(
    tenantId: string,
    query: CurriculumOfferingListQueryDto,
  ) {
    return this.curriculumList.listCurriculumOfferings(tenantId, query);
  }

  createOffering(tenantId: string, dto: CreateCourseOfferingDto) {
    return this.catalog.createOffering(tenantId, dto);
  }

  updateOffering(tenantId: string, id: string, dto: UpdateCourseOfferingDto) {
    return this.catalog.updateOffering(tenantId, id, dto);
  }

  getCatalogSummary(tenantId: string) {
    return this.catalog.getCatalogSummary(tenantId);
  }

  softDeleteProgram(tenantId: string, id: string) {
    return this.catalog.softDeleteProgram(tenantId, id);
  }

  softDeleteCourse(tenantId: string, id: string) {
    return this.catalog.softDeleteCourse(tenantId, id);
  }

  deleteOffering(tenantId: string, id: string) {
    return this.catalog.hardDeleteOffering(tenantId, id);
  }

  listOfferingSections(user: JwtUser, offeringId: string) {
    return this.catalog.listOfferingSections(user, offeringId);
  }

  createOfferingSection(
    user: JwtUser,
    offeringId: string,
    dto: CreateOfferingSectionDto,
  ) {
    return this.catalog.createOfferingSection(user, offeringId, dto);
  }

  updateOfferingSection(
    user: JwtUser,
    sectionId: string,
    dto: UpdateOfferingSectionDto,
  ) {
    return this.catalog.updateOfferingSection(user, sectionId, dto);
  }

  deleteOfferingSection(user: JwtUser, sectionId: string) {
    return this.catalog.hardDeleteOfferingSection(user, sectionId);
  }

  getProgramDataCleanupReport(tenantId: string) {
    return this.dataCleanup.getReport(tenantId);
  }

  purgeCleanupVersion(tenantId: string, versionId: string) {
    return this.dataCleanup.purgeVersion(tenantId, versionId);
  }

  removeUnusedProgram(tenantId: string, programId: string) {
    return this.dataCleanup.removeUnusedProgram(tenantId, programId);
  }

  purgeOrphanProgramVersions(tenantId: string, programCode: string) {
    return this.dataCleanup.purgeOrphanVersions(tenantId, programCode);
  }
}
