import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import {
  ActivateCycleDto,
  ActivateSemesterDto,
  CreateAcademicSessionDto,
  CreateAdmissionBatchDto,
  CreatePromotionRunDto,
  CycleRolloverRollbackDto,
  IndividualPromotionDto,
  ProvisionFyugpDto,
  PromotionPreviewQueryDto,
  UpdateAcademicSessionDto,
  UpdateAdmissionBatchDto,
  UpsertInstitutionAcademicConfigDto,
} from './dto/academic-lifecycle.dto';
import { AcademicLifecycleService } from './academic-lifecycle.service';

@ApiBearerAuth()
@ApiTags('academic-lifecycle')
@Controller({ path: 'academic-lifecycle', version: '1' })
export class AcademicLifecycleController {
  constructor(private readonly service: AcademicLifecycleService) {}

  @Get('institutions/:institutionId/academic-config')
  @RequirePermissions('academic-lifecycle:read')
  getConfig(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
  ) {
    return this.service.getConfig(user.tid, institutionId);
  }

  @Patch('institutions/:institutionId/academic-config')
  @RequirePermissions('academic-lifecycle:manage')
  upsertConfig(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
    @Body() dto: UpsertInstitutionAcademicConfigDto,
  ) {
    return this.service.upsertConfig(user.tid, institutionId, dto);
  }

  @Get('institutions/:institutionId/academic-sessions')
  @RequirePermissions('academic-lifecycle:read')
  listAcademicSessions(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
  ) {
    return this.service.listAcademicSessions(user.tid, institutionId);
  }

  @Post('institutions/:institutionId/academic-sessions')
  @RequirePermissions('academic-lifecycle:manage')
  createAcademicSession(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
    @Body() dto: CreateAcademicSessionDto,
  ) {
    return this.service.createAcademicSession(user.tid, institutionId, dto);
  }

  @Patch('academic-sessions/:sessionId')
  @RequirePermissions('academic-lifecycle:manage')
  updateAcademicSession(
    @CurrentUser() user: JwtUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateAcademicSessionDto,
  ) {
    return this.service.updateAcademicSession(user.tid, sessionId, dto);
  }

  @Get('institutions/:institutionId/admission-batches')
  @RequirePermissions('academic-lifecycle:read')
  listAdmissionBatches(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
  ) {
    return this.service.listAdmissionBatches(user.tid, institutionId);
  }

  @Post('institutions/:institutionId/admission-batches')
  @RequirePermissions('academic-lifecycle:manage')
  createAdmissionBatch(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
    @Body() dto: CreateAdmissionBatchDto,
  ) {
    return this.service.createAdmissionBatch(user.tid, institutionId, dto);
  }

  @Patch('admission-batches/:batchId')
  @RequirePermissions('academic-lifecycle:manage')
  updateAdmissionBatch(
    @CurrentUser() user: JwtUser,
    @Param('batchId') batchId: string,
    @Body() dto: UpdateAdmissionBatchDto,
  ) {
    return this.service.updateAdmissionBatch(user.tid, batchId, dto);
  }

  @Get('institutions/:institutionId/batch-semester-mappings')
  @RequirePermissions('academic-lifecycle:read')
  listBatchSemesterMappings(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
  ) {
    return this.service.listBatchSemesterMappings(user.tid, institutionId);
  }

  @Post('institutions/:institutionId/admission-batches/backfill')
  @RequirePermissions('academic-lifecycle:manage')
  backfillAdmissionBatches(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
  ) {
    return this.service.backfillAdmissionBatches(user.tid, institutionId);
  }

  @Get('institutions/:institutionId/cycles/dashboard')
  @RequirePermissions('academic-lifecycle:read')
  getCycleDashboard(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
  ) {
    return this.service.getCycleDashboard(user.tid, institutionId);
  }

  @Post('institutions/:institutionId/cycles/activate-odd')
  @RequirePermissions('academic-lifecycle:manage')
  activateOddCycle(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
    @Body() dto: ActivateCycleDto,
  ) {
    return this.service.activateOddCycle(
      user.tid,
      institutionId,
      dto,
      user.sub,
    );
  }

  @Post('institutions/:institutionId/cycles/activate-even')
  @RequirePermissions('academic-lifecycle:manage')
  activateEvenCycle(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
    @Body() dto: ActivateCycleDto,
  ) {
    return this.service.activateEvenCycle(
      user.tid,
      institutionId,
      dto,
      user.sub,
    );
  }

  @Get('institutions/:institutionId/cycle-rollover/preview')
  @RequirePermissions('academic-lifecycle:read')
  previewCycleRollover(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
  ) {
    return this.service.previewCycleRollover(user.tid, institutionId);
  }

  @Post('institutions/:institutionId/cycle-rollover/apply')
  @RequirePermissions('academic-lifecycle:manage')
  applyCycleRollover(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
    @Body() dto: ActivateCycleDto,
  ) {
    return this.service.applyCycleRollover(
      user.tid,
      institutionId,
      dto,
      user.sub,
    );
  }

  @Post('institutions/:institutionId/cycle-rollover/rollback')
  @RequirePermissions('academic-lifecycle:manage')
  rollbackCycleRollover(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
    @Body() dto: CycleRolloverRollbackDto,
  ) {
    return this.service.rollbackCycleRollover(
      user.tid,
      institutionId,
      dto,
      user.sub,
    );
  }

  @Get('institutions/:institutionId/promotion-logs')
  @RequirePermissions('academic-lifecycle:read')
  getPromotionLogs(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getPromotionLogs(
      user.tid,
      institutionId,
      limit ? Number(limit) : 50,
    );
  }

  @Post('institutions/:institutionId/semesters/provision-fyugp')
  @RequirePermissions('academic-lifecycle:manage')
  provisionFyugp(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
    @Body() dto: ProvisionFyugpDto,
  ) {
    return this.service.provisionFyugp(user.tid, institutionId, dto);
  }

  @Get('institutions/:institutionId/semesters/structure')
  @RequirePermissions('academic-lifecycle:read')
  getStructure(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
  ) {
    return this.service.getStructure(user.tid, institutionId);
  }

  @Post('semesters/:semesterId/activate')
  @RequirePermissions('academic-lifecycle:manage')
  activateSemester(
    @CurrentUser() user: JwtUser,
    @Param('semesterId') semesterId: string,
    @Body() dto: ActivateSemesterDto,
  ) {
    return this.service.activateSemester(user.tid, semesterId, dto, user.sub);
  }

  @Post('semesters/:semesterId/freeze')
  @RequirePermissions('academic-lifecycle:manage')
  freezeSemester(
    @CurrentUser() user: JwtUser,
    @Param('semesterId') semesterId: string,
  ) {
    return this.service.freezeSemester(user.tid, semesterId, user.sub);
  }

  @Get('promotion-runs/preview')
  @RequirePermissions('academic-lifecycle:read')
  previewPromotion(
    @CurrentUser() user: JwtUser,
    @Query() query: PromotionPreviewQueryDto,
  ) {
    return this.service.previewPromotion(user.tid, query);
  }

  @Post('promotion-runs')
  @RequirePermissions('academic-lifecycle:manage')
  createPromotionRun(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePromotionRunDto,
  ) {
    return this.service.createPromotionRun(user.tid, dto, user.sub);
  }

  @Get('promotion-runs/:runId')
  @RequirePermissions('academic-lifecycle:read')
  getPromotionRun(@CurrentUser() user: JwtUser, @Param('runId') runId: string) {
    return this.service.getPromotionRun(user.tid, runId);
  }

  @Post('promotion-runs/:runId/apply')
  @RequirePermissions('academic-lifecycle:manage')
  applyPromotionRun(
    @CurrentUser() user: JwtUser,
    @Param('runId') runId: string,
  ) {
    return this.service.applyPromotionRun(user.tid, runId, user.sub);
  }

  @Post('promotion-runs/:runId/rollback')
  @RequirePermissions('academic-lifecycle:manage')
  rollbackPromotionRun(
    @CurrentUser() user: JwtUser,
    @Param('runId') runId: string,
  ) {
    return this.service.rollbackPromotionRun(user.tid, runId, user.sub);
  }

  @Post('students/:studentId/promotion')
  @RequirePermissions('academic-lifecycle:manage')
  individualPromotion(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
    @Body() dto: IndividualPromotionDto,
  ) {
    return this.service.individualPromotion(user.tid, studentId, dto, user.sub);
  }

  @Get('students/:studentId/promotion-history')
  @RequirePermissions('academic-lifecycle:read')
  promotionHistory(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
  ) {
    return this.service.promotionHistory(user.tid, studentId);
  }
}
