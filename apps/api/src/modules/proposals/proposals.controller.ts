import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  CreateProposalPresetDto,
  ProposalCustomizationDto,
  ProposalExportQueryDto,
  UpdateProposalPresetDto,
} from './dto/proposal.dto';
import { ProposalGeneratorService } from './services/proposal-generator.service';
import { ProposalPresetsService } from './services/proposal-presets.service';
import { PROPOSAL_SECTIONS } from './templates/proposal-template.sections';
import { buildSubscriptionPricing } from './utils/proposal-branding.util';

const PROPOSAL_ACCESS = [
  'official-documents:manage',
  'official-documents:read',
  'users:manage',
  'accounts:manage',
] as const;

@ApiBearerAuth()
@ApiTags('proposals')
@Controller({ path: 'proposals', version: '1' })
export class ProposalsController {
  constructor(
    private readonly generator: ProposalGeneratorService,
    private readonly presets: ProposalPresetsService,
  ) {}

  @Post('preview')
  @RequireAnyPermission(...PROPOSAL_ACCESS)
  async preview(
    @CurrentUser() user: JwtUser,
    @Body() dto: ProposalCustomizationDto,
  ) {
    return this.generator.previewHtml(user.tid, dto);
  }

  @Post('export')
  @RequireAnyPermission(...PROPOSAL_ACCESS)
  async export(
    @CurrentUser() user: JwtUser,
    @Body() dto: ProposalCustomizationDto,
    @Query() query: ProposalExportQueryDto,
    @Res() res: Response,
  ) {
    const format =
      query.format === 'docx' || query.format === 'html' ? query.format : 'pdf';
    const result = await this.generator.export(user.tid, dto, format);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader('Content-Length', String(result.buffer.length));
    return res.send(result.buffer);
  }

  @Get('defaults')
  @RequireAnyPermission(...PROPOSAL_ACCESS)
  getDefaults() {
    const studentStrength = 2200;
    const perStudentSubscriptionRate = 100;
    return {
      institutionName: 'Don Bosco College, Tura',
      proposalVersion: '1.0',
      studentStrength,
      perStudentSubscriptionRate,
      contactPerson: 'Dr (Fr) Jogesh B Sangma',
      contactEmail: 'principal@donboscocollege.ac.in',
      contactPhone: '+91-9678402086',
      addressLine:
        'Don Bosco College Tura, Sampalgre, West Garo Hills, Meghalaya 794002',
      primaryColor: '#1E40AF',
      secondaryColor: '#2563EB',
      proposalTheme: 'don-bosco',
      pricingLines: buildSubscriptionPricing(
        studentStrength,
        perStudentSubscriptionRate,
      ),
      sectionKeys: PROPOSAL_SECTIONS.map((s) => ({
        key: s.key,
        label: s.tocTitle,
      })),
    };
  }

  @Get('presets')
  @RequireAnyPermission(...PROPOSAL_ACCESS)
  listPresets(@CurrentUser() user: JwtUser) {
    return this.presets.list(user.tid);
  }

  @Post('presets')
  @RequireAnyPermission(...PROPOSAL_ACCESS)
  createPreset(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateProposalPresetDto,
  ) {
    return this.presets.create(user.tid, dto);
  }

  @Post('presets/:id')
  @RequireAnyPermission(...PROPOSAL_ACCESS)
  updatePreset(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateProposalPresetDto,
  ) {
    return this.presets.update(user.tid, id, dto);
  }

  @Post('presets/:id/delete')
  @RequireAnyPermission(...PROPOSAL_ACCESS)
  deletePreset(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.presets.remove(user.tid, id);
  }
}
