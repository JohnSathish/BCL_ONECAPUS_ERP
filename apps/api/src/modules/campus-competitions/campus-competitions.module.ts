import { Module, forwardRef } from '@nestjs/common';
import { CertificatesModule } from '../certificates/certificates.module';
import { CommunicationModule } from '../communication/communication.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CampusCompetitionsController } from './campus-competitions.controller';
import { CompetitionChampionshipService } from './services/competition-championship.service';
import { CompetitionHousesService } from './services/competition-houses.service';
import { CompetitionMeetsService } from './services/competition-meets.service';
import { CompetitionRealtimePublisher } from './services/competition-realtime.publisher';
import { CompetitionScoringService } from './services/competition-scoring.service';

@Module({
  imports: [
    CertificatesModule,
    forwardRef(() => RealtimeModule),
    forwardRef(() => CommunicationModule),
  ],
  controllers: [CampusCompetitionsController],
  providers: [
    CompetitionHousesService,
    CompetitionMeetsService,
    CompetitionScoringService,
    CompetitionChampionshipService,
    CompetitionRealtimePublisher,
  ],
  exports: [
    CompetitionHousesService,
    CompetitionMeetsService,
    CompetitionScoringService,
    CompetitionChampionshipService,
  ],
})
export class CampusCompetitionsModule {}
