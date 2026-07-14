import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { AccessDeviceService } from './services/access-device.service';
import { IpGeoService } from './services/ip-geo.service';
import { SecurityNotifyService } from './services/security-notify.service';
import { SuspiciousLoginService } from './services/suspicious-login.service';

/**
 * Lean module so AuthModule can import device services without circular
 * AdministrationModule ↔ AuthModule dependencies.
 */
@Module({
  imports: [CommunicationModule],
  providers: [
    IpGeoService,
    AccessDeviceService,
    SuspiciousLoginService,
    SecurityNotifyService,
  ],
  exports: [
    IpGeoService,
    AccessDeviceService,
    SuspiciousLoginService,
    SecurityNotifyService,
  ],
})
export class DeviceSecurityModule {}
