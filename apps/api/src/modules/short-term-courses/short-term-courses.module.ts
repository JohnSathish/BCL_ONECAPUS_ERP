import { Module, forwardRef } from '@nestjs/common';
import { FeesModule } from '../fees/fees.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { CommunicationModule } from '../communication/communication.module';
import { ShortTermCoursesController } from './short-term-courses.controller';
import { ShortTermCoursesService } from './services/short-term-courses.service';

@Module({
  imports: [
    forwardRef(() => FeesModule),
    CertificatesModule,
    CommunicationModule,
  ],
  controllers: [ShortTermCoursesController],
  providers: [ShortTermCoursesService],
  exports: [ShortTermCoursesService],
})
export class ShortTermCoursesModule {}
