import { Injectable } from '@nestjs/common';
import { ActiveSemesterService } from './services/active-semester.service';
import { AcademicSessionService } from './services/academic-session.service';
import { AdmissionBatchService } from './services/admission-batch.service';
import { BatchSemesterMappingService } from './services/batch-semester-mapping.service';
import { CycleActivationService } from './services/cycle-activation.service';
import { CycleRolloverService } from './services/cycle-rollover.service';
import { InstitutionAcademicConfigService } from './services/institution-academic-config.service';
import { PromotionRunService } from './services/promotion-run.service';
import { PromotionRegistrationService } from './services/promotion-registration.service';
import { SemesterLifecycleService } from './services/semester-lifecycle.service';
import type {
  ActivateCycleDto,
  ActivateSemesterDto,
  CreateAcademicSessionDto,
  CreateAdmissionBatchDto,
  CreatePromotionRunDto,
  CycleRolloverRollbackDto,
  IndividualPromotionDto,
  ProvisionFyugpDto,
  PromotionPreviewQueryDto,
  PromotionMappingPreviewQueryDto,
  PromotionValidateQueryDto,
  UpdateAcademicSessionDto,
  UpdateAdmissionBatchDto,
  UpsertInstitutionAcademicConfigDto,
} from './dto/academic-lifecycle.dto';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AcademicLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: InstitutionAcademicConfigService,
    private readonly lifecycle: SemesterLifecycleService,
    private readonly activeSemester: ActiveSemesterService,
    private readonly promotion: PromotionRunService,
    private readonly promotionRegistration: PromotionRegistrationService,
    private readonly sessions: AcademicSessionService,
    private readonly batches: AdmissionBatchService,
    private readonly mappings: BatchSemesterMappingService,
    private readonly cycleActivation: CycleActivationService,
    private readonly cycleRollover: CycleRolloverService,
  ) {}

  getConfig(tenantId: string, institutionId: string) {
    return this.config.get(tenantId, institutionId);
  }

  upsertConfig(
    tenantId: string,
    institutionId: string,
    dto: UpsertInstitutionAcademicConfigDto,
  ) {
    return this.config.upsert(tenantId, institutionId, dto);
  }

  provisionFyugp(
    tenantId: string,
    institutionId: string,
    dto: ProvisionFyugpDto,
  ) {
    return this.lifecycle.provisionFyugp(tenantId, institutionId, dto);
  }

  getStructure(tenantId: string, institutionId: string) {
    return this.lifecycle.getStructure(tenantId, institutionId);
  }

  listAcademicSessions(tenantId: string, institutionId: string) {
    return this.sessions.list(tenantId, institutionId);
  }

  createAcademicSession(
    tenantId: string,
    institutionId: string,
    dto: CreateAcademicSessionDto,
  ) {
    return this.sessions.create(tenantId, institutionId, dto);
  }

  updateAcademicSession(
    tenantId: string,
    sessionId: string,
    dto: UpdateAcademicSessionDto,
  ) {
    return this.sessions.update(tenantId, sessionId, dto);
  }

  listAdmissionBatches(tenantId: string, institutionId: string) {
    return this.batches.list(tenantId, institutionId);
  }

  createAdmissionBatch(
    tenantId: string,
    institutionId: string,
    dto: CreateAdmissionBatchDto,
  ) {
    return this.batches.create(tenantId, institutionId, dto);
  }

  updateAdmissionBatch(
    tenantId: string,
    batchId: string,
    dto: UpdateAdmissionBatchDto,
  ) {
    return this.batches.update(tenantId, batchId, dto);
  }

  listBatchSemesterMappings(tenantId: string, institutionId: string) {
    return this.mappings.listForInstitution(tenantId, institutionId);
  }

  backfillAdmissionBatches(tenantId: string, institutionId: string) {
    return this.batches.backfillFromProfiles(tenantId, institutionId);
  }

  getCycleDashboard(tenantId: string, institutionId: string) {
    return this.cycleActivation.getDashboard(tenantId, institutionId);
  }

  activateOddCycle(
    tenantId: string,
    institutionId: string,
    dto: ActivateCycleDto,
    actorId?: string,
  ) {
    return this.cycleActivation.activateOddCycle(
      tenantId,
      institutionId,
      dto,
      actorId,
    );
  }

  activateEvenCycle(
    tenantId: string,
    institutionId: string,
    dto: ActivateCycleDto,
    actorId?: string,
  ) {
    return this.cycleActivation.activateEvenCycle(
      tenantId,
      institutionId,
      dto,
      actorId,
    );
  }

  previewCycleRollover(tenantId: string, institutionId: string) {
    return this.cycleRollover.preview(tenantId, institutionId);
  }

  applyCycleRollover(
    tenantId: string,
    institutionId: string,
    dto: ActivateCycleDto,
    actorId?: string,
  ) {
    return this.cycleRollover.apply(tenantId, institutionId, dto, actorId);
  }

  rollbackCycleRollover(
    tenantId: string,
    institutionId: string,
    dto: CycleRolloverRollbackDto,
    actorId?: string,
  ) {
    return this.cycleRollover.rollback(
      tenantId,
      institutionId,
      dto.cycleRolloverGroupId,
      actorId,
    );
  }

  getPromotionLogs(tenantId: string, institutionId: string, limit = 50) {
    return this.prisma.semesterPromotionAuditLog.findMany({
      where: {
        tenantId,
        run: { institutionId },
      },
      include: {
        run: {
          include: {
            admissionBatch: true,
            appliedBy: { select: { email: true } },
          },
        },
        actor: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async activateSemester(
    tenantId: string,
    semesterId: string,
    dto: ActivateSemesterDto,
    actorId?: string,
  ) {
    const sem = await this.lifecycle.getSemester(tenantId, semesterId);
    const activated = await this.activeSemester.activate(
      tenantId,
      semesterId,
      dto,
      actorId,
    );

    let promotionPreview = null;
    if (dto.runPromotion && sem.semesterType === 'EVEN') {
      const pair = this.promotion.promotionPairForEven(sem.semesterNumber);
      if (pair) {
        promotionPreview = await this.promotion.preview(tenantId, {
          institutionId: sem.institutionId,
          fromSequence: pair.from,
          toSequence: pair.to,
          campusId: dto.campusId,
          shiftId: dto.shiftId,
        });
      }
    }

    return { semester: activated, promotionPreview };
  }

  freezeSemester(tenantId: string, semesterId: string, actorId?: string) {
    return this.lifecycle.freezeSemester(tenantId, semesterId, actorId);
  }

  previewPromotion(tenantId: string, query: PromotionPreviewQueryDto) {
    return this.promotion.preview(tenantId, query);
  }

  previewPromotionMappings(
    tenantId: string,
    query: PromotionMappingPreviewQueryDto,
  ) {
    return this.promotionRegistration.previewMappings(tenantId, query);
  }

  async validatePromotion(tenantId: string, query: PromotionValidateQueryDto) {
    const students = await this.promotionRegistration.previewMappings(
      tenantId,
      query,
    );
    const blocked = students.filter((s) => !s.valid);
    return {
      fromSequence: query.fromSequence,
      toSequence: query.toSequence,
      counts: {
        total: students.length,
        valid: students.length - blocked.length,
        blocked: blocked.length,
      },
      students,
      valid: blocked.length === 0,
    };
  }

  createPromotionRun(
    tenantId: string,
    dto: CreatePromotionRunDto,
    actorId?: string,
  ) {
    return this.promotion.createRun(tenantId, dto, actorId);
  }

  getPromotionRun(tenantId: string, runId: string) {
    return this.promotion.getRun(tenantId, runId);
  }

  applyPromotionRun(tenantId: string, runId: string, actorId?: string) {
    return this.promotion.applyRun(tenantId, runId, actorId);
  }

  rollbackPromotionRun(tenantId: string, runId: string, actorId?: string) {
    return this.promotion.rollbackRun(tenantId, runId, actorId);
  }

  individualPromotion(
    tenantId: string,
    studentId: string,
    dto: IndividualPromotionDto,
    actorId?: string,
  ) {
    return this.promotion.individualAction(tenantId, studentId, dto, actorId);
  }

  promotionHistory(tenantId: string, studentId: string) {
    return this.promotion.getPromotionHistory(tenantId, studentId);
  }

  getActiveSemestersForScope(
    tenantId: string,
    institutionId: string,
    campusId: string,
    shiftId: string,
  ) {
    return this.activeSemester.getActiveForScope(
      tenantId,
      institutionId,
      campusId,
      shiftId,
    );
  }

  resolveOperationalSemester(
    tenantId: string,
    institutionId: string,
    semesterSequence: number,
  ) {
    return this.cycleActivation.resolveOperationalSemester(
      tenantId,
      institutionId,
      semesterSequence,
    );
  }

  resolveBatchForEnrollment(
    tenantId: string,
    institutionId: string,
    entrySessionId: string,
    admissionYear: number,
  ) {
    return this.batches.resolveBatchForEnrollment(
      tenantId,
      institutionId,
      entrySessionId,
      admissionYear,
    );
  }

  /** @deprecated Use getActiveSemestersForScope — returns first active semester for compat */
  async getActiveSemesterForScope(
    tenantId: string,
    institutionId: string,
    campusId: string,
    shiftId: string,
  ) {
    const rows = await this.getActiveSemestersForScope(
      tenantId,
      institutionId,
      campusId,
      shiftId,
    );
    return rows[0] ?? null;
  }
}
