import { Inject, Injectable, forwardRef } from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { StudentsService } from '../students/students.service';

@Injectable()
export class AdmissionsEnrollmentService {
  constructor(
    @Inject(forwardRef(() => StudentsService))
    private readonly students: StudentsService,
  ) {}

  enrollFromApplication(
    user: JwtUser,
    applicationId: string,
    dto?: {
      programVersionId?: string;
      admissionBatchId?: string;
      primaryShiftId?: string;
    },
  ) {
    return this.students.enrollFromApplication(user, applicationId, {
      programVersionId: dto?.programVersionId,
      admissionBatchId: dto?.admissionBatchId,
      primaryShiftId: dto?.primaryShiftId,
    });
  }
}
