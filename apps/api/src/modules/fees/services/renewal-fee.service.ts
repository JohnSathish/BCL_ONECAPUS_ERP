import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type { GenerateDemandDto } from '../dto/fees.dto';
import { FeeDemandEngineService } from './fee-demand-engine.service';

@Injectable()
export class RenewalFeeService {
  constructor(private readonly demands: FeeDemandEngineService) {}

  yearForSemester(semesterNumber: number) {
    return {
      academicYearNo: Math.ceil(semesterNumber / 2),
      semesterStart:
        semesterNumber % 2 === 0 ? semesterNumber - 1 : semesterNumber,
      semesterEnd:
        semesterNumber % 2 === 0 ? semesterNumber : semesterNumber + 1,
    };
  }

  previewRenewal(tenantId: string, dto: GenerateDemandDto) {
    const semesterNumber = dto.semesterNumber ?? 1;
    const renewal = this.yearForSemester(semesterNumber);
    return this.demands.preview(tenantId, {
      ...dto,
      semesterNumber,
      demandType: 'RENEWAL',
      billingLayer: 'YEARLY',
      billingPeriod: `YEAR-${renewal.academicYearNo}`,
    });
  }

  generateRenewal(user: JwtUser, dto: GenerateDemandDto) {
    const semesterNumber = dto.semesterNumber ?? 1;
    const renewal = this.yearForSemester(semesterNumber);
    return this.demands.generate(user, {
      ...dto,
      semesterNumber,
      demandType: 'RENEWAL',
      billingLayer: 'YEARLY',
      billingPeriod: `YEAR-${renewal.academicYearNo}`,
    });
  }
}
