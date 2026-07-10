import { Module } from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { ProposalGeneratorService } from './services/proposal-generator.service';
import { ProposalPresetsService } from './services/proposal-presets.service';

@Module({
  controllers: [ProposalsController],
  providers: [ProposalGeneratorService, ProposalPresetsService],
  exports: [ProposalGeneratorService, ProposalPresetsService],
})
export class ProposalsModule {}
