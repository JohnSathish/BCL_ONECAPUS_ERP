import { IsIn, IsOptional } from 'class-validator';
import { STUDENT_NAME_DISPLAY_FORMATS } from '../../../common/utils/student-name-format';

export class UpdateStudentDisplaySettingsDto {
  @IsOptional()
  @IsIn([...STUDENT_NAME_DISPLAY_FORMATS])
  nameDisplayFormat?: string;
}
