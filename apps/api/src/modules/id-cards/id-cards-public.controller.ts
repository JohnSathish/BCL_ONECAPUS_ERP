import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { IdCardsService } from './id-cards.service';

@ApiTags('id-cards-public')
@Controller({ path: 'verify', version: '1' })
export class IdCardsPublicController {
  constructor(private readonly idCards: IdCardsService) {}

  @Public()
  @Get(':code')
  verify(@Param('code') code: string) {
    return this.idCards.verifyPublic(code);
  }
}
