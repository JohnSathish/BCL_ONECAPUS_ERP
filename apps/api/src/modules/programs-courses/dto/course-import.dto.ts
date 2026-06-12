import { IsIn, IsUUID } from 'class-validator';
import { IMPORT_COMMIT_MODES } from '../../../common/import/import.types';

export class CommitCourseImportDto {
  @IsUUID()
  batchId!: string;

  @IsIn([...IMPORT_COMMIT_MODES])
  mode!: (typeof IMPORT_COMMIT_MODES)[number];
}
