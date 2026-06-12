import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import {
  GenerateFyugpRegistrationDto,
  SetHonoursTrackDto,
  ValidateFyugpRegistrationDto,
} from './dto/fyugp.dto';
import { AcademicEngineService } from './academic-engine.service';
import { AdmissionPoolsService } from './services/admission-pools.service';
import { HonoursTrackService } from './services/honours-track.service';
import { MajorMinorEligibilityService } from './services/major-minor-eligibility.service';
import { SemesterRulesService } from './services/semester-rules.service';
import { SubjectRegistrationEngineService } from './services/subject-registration-engine.service';
import type { HonoursTrack } from './domain/fyugp-templates';

@Controller({ path: 'fyugp', version: '1' })
export class FyugpController {
  constructor(
    private readonly semesterRules: SemesterRulesService,
    private readonly admissionPools: AdmissionPoolsService,
    private readonly engine: AcademicEngineService,
    private readonly registrationEngine: SubjectRegistrationEngineService,
    private readonly eligibility: MajorMinorEligibilityService,
    private readonly honoursTrack: HonoursTrackService,
  ) {}

  @Get('semester-rules/:semester')
  @RequireAnyPermission(
    'academic-engine:read',
    'students:read',
    'students:manage',
  )
  getSemesterRules(
    @CurrentUser() user: JwtUser,
    @Param('semester', ParseIntPipe) semester: number,
    @Query('programVersionId') programVersionId: string,
    @Query('honoursTrack') honoursTrack?: HonoursTrack,
    @Query('studentId') studentId?: string,
  ) {
    const trackPromise = studentId
      ? this.semesterRules.resolveHonoursTrackForStudent(
          user.tid,
          studentId,
          semester,
        )
      : Promise.resolve(honoursTrack ?? null);

    return trackPromise.then((track) =>
      this.semesterRules.getSemesterRule(
        user.tid,
        programVersionId,
        semester,
        track ?? honoursTrack ?? null,
      ),
    );
  }

  @Post('validate-registration')
  @RequireAnyPermission(
    'academic-engine:read',
    'students:read',
    'students:manage',
  )
  async validateRegistration(
    @CurrentUser() user: JwtUser,
    @Body() dto: ValidateFyugpRegistrationDto,
  ) {
    if (dto.registrationId) {
      return this.engine.validateRegistration(user.tid, dto.registrationId);
    }

    if (!dto.programVersionId || !dto.semesterSequence || !dto.selections) {
      return {
        ok: false,
        issues: [
          {
            code: 'INVALID_REQUEST',
            message:
              'Provide registrationId or programVersionId + semesterSequence + selections',
          },
        ],
      };
    }

    return this.admissionPools.validateSubjectBasket(user.tid, {
      programVersionId: dto.programVersionId,
      semesterSequence: dto.semesterSequence,
      shiftId: dto.shiftId,
      streamId: dto.streamId,
      majorSubjectSlug: dto.majorSubjectSlug,
      minorSubjectSlug: dto.minorSubjectSlug,
      selections: dto.selections,
    });
  }

  @Post('generate-registration')
  @RequirePermissions('academic-engine:manage')
  async generateRegistration(
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateFyugpRegistrationDto,
  ) {
    const lines =
      await this.registrationEngine.generateSemesterRegistrationLines({
        tenantId: user.tid,
        studentId: dto.studentId,
        programVersionId: dto.programVersionId,
        semesterSequence: dto.semesterSequence,
        shiftId: dto.shiftId,
        streamId: dto.streamId,
        subjectSelections: dto.subjectSelections,
        assignedById: user.sub,
      });

    if (dto.persist && dto.registrationId) {
      const registration = await this.registrationEngine.applyGeneratedLines(
        user.tid,
        dto.registrationId,
        lines,
        { assignedById: user.sub },
      );
      return { lines, registration };
    }

    return { lines };
  }

  @Get('eligible-subjects')
  @RequireAnyPermission(
    'academic-engine:read',
    'students:read',
    'students:manage',
  )
  async getEligibleSubjects(
    @CurrentUser() user: JwtUser,
    @Query('programVersionId') programVersionId: string,
    @Query('semester') semester: string,
    @Query('category') category: string,
    @Query('majorSubjectSlug') majorSubjectSlug?: string,
  ) {
    const semesterSequence = Number(semester);
    const cat = category.trim().toUpperCase();

    if (cat === 'MAJOR') {
      return this.eligibility.listEligibleMajors(
        user.tid,
        programVersionId,
        semesterSequence,
      );
    }

    if (cat === 'MINOR') {
      if (!majorSubjectSlug) {
        return [];
      }
      return this.eligibility.listEligibleMinors(
        user.tid,
        programVersionId,
        majorSubjectSlug,
        semesterSequence,
      );
    }

    return this.admissionPools.listPoolByNepRole(
      user.tid,
      programVersionId,
      semesterSequence,
      cat,
    );
  }

  @Get('students/:studentId/academic-track')
  @RequireAnyPermission(
    'academic-engine:read',
    'students:read',
    'students:manage',
  )
  getStudentAcademicTrack(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
    @Query('effectiveFromSemester') effectiveFromSemester?: string,
  ) {
    return this.honoursTrack.getTrack(
      user.tid,
      studentId,
      effectiveFromSemester ? Number(effectiveFromSemester) : 8,
    );
  }

  @Put('students/:studentId/academic-track')
  @RequireAnyPermission('academic-engine:manage', 'students:manage')
  setStudentAcademicTrack(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
    @Body() dto: SetHonoursTrackDto,
  ) {
    return this.honoursTrack.setTrack(user.tid, studentId, dto, user.sub);
  }
}
