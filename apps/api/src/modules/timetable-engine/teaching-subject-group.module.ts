import { Module } from '@nestjs/common';
import { TeachingSubjectGroupService } from './teaching-subject-group.service';

@Module({
  providers: [TeachingSubjectGroupService],
  exports: [TeachingSubjectGroupService],
})
export class TeachingSubjectGroupModule {}
