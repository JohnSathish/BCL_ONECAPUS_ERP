import { Module } from '@nestjs/common';
import { IdCardsController } from './id-cards.controller';
import { IdCardsPublicController } from './id-cards-public.controller';
import { IdCardsService } from './id-cards.service';
import { IdCardDocumentService } from './id-card-document.service';
import { IdCardAssetsService } from './id-card-assets.service';

@Module({
  controllers: [IdCardsController, IdCardsPublicController],
  providers: [IdCardsService, IdCardDocumentService, IdCardAssetsService],
  exports: [IdCardsService, IdCardDocumentService, IdCardAssetsService],
})
export class IdCardsModule {}
