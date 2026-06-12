import { Module } from '@nestjs/common';
import { ObeController } from './obe.controller';
import { ObeService } from './obe.service';

@Module({
  controllers: [ObeController],
  providers: [ObeService],
})
export class ObeModule {}
