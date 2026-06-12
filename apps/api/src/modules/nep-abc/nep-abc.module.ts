import { Module } from '@nestjs/common';
import { NepAbcController } from './nep-abc.controller';
import { NepAbcService } from './nep-abc.service';

@Module({
  controllers: [NepAbcController],
  providers: [NepAbcService],
  exports: [NepAbcService],
})
export class NepAbcModule {}
