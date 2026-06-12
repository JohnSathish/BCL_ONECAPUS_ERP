import { Module } from '@nestjs/common';

import { CommunicationModule } from '../communication/communication.module';

import { TransportCapacityService } from './services/transport-capacity.service';

import { TransportNotificationsService } from './services/transport-notifications.service';

import { TransportStudentLookupService } from './services/transport-student-lookup.service';

import {
  TransportAssignmentsService,
  TransportDashboardService,
  TransportRoutesService,
  TransportVehiclesService,
} from './services/transport.service';

import { TransportController } from './transport.controller';

@Module({
  imports: [CommunicationModule],

  controllers: [TransportController],

  providers: [
    TransportDashboardService,

    TransportRoutesService,

    TransportVehiclesService,

    TransportAssignmentsService,

    TransportCapacityService,

    TransportNotificationsService,

    TransportStudentLookupService,
  ],
})
export class TransportModule {}
