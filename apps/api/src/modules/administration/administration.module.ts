import { Module, forwardRef } from '@nestjs/common';
import { ImportModule } from '../../common/import/import.module';
import { CommunicationModule } from '../communication/communication.module';
import { DemoAccountsController } from './controllers/demo-accounts.controller';
import { DemoAccountsService } from './services/demo-accounts.service';
import { AuthModule } from '../auth/auth.module';
import { SecurityCentreModule } from '../security-centre/security-centre.module';
import { StaffModule } from '../staff/staff.module';
import { AdminAuditHelper } from './admin-audit.helper';
import { DeviceSecurityModule } from './device-security.module';
import { DeviceSecurityController } from './controllers/device-security.controller';
import { RollNumberSettingsController } from './controllers/roll-number-settings.controller';
import { StudentDisplaySettingsController } from './controllers/student-display-settings.controller';
import { AuditController } from './controllers/audit.controller';
import { ErpUsersController } from './controllers/erp-users.controller';
import { RbacController } from './controllers/rbac.controller';
import { SecurityController } from './controllers/security.controller';
import { UsersController } from './controllers/users.controller';
import { ImportCenterController } from './import/import-center.controller';
import { ImportCenterService } from './import/import-center.service';
import { PortalUsersImportHandler } from './import/portal-users-import.handler';
import { AuditService } from './services/audit.service';
import { DeviceSecurityService } from './services/device-security.service';
import { ErpUsersService } from './services/erp-users.service';
import { RbacService } from './services/rbac.service';
import { RollNumberSettingsService } from './services/roll-number-settings.service';
import { StudentDisplaySettingsService } from './services/student-display-settings.service';
import { SecurityService } from './services/security.service';
import { SecurityCenterService } from './services/security-center.service';
import { UserProvisioningService } from './services/user-provisioning.service';
import { UsernameGenerationService } from './services/username-generation.service';
import { UsersService } from './services/users.service';

@Module({
  imports: [
    DeviceSecurityModule,
    AuthModule,
    SecurityCentreModule,
    ImportModule,
    CommunicationModule,
    forwardRef(() => StaffModule),
  ],
  controllers: [
    UsersController,
    ErpUsersController,
    RbacController,
    AuditController,
    SecurityController,
    DeviceSecurityController,
    RollNumberSettingsController,
    StudentDisplaySettingsController,
    ImportCenterController,
    DemoAccountsController,
  ],
  providers: [
    AdminAuditHelper,
    UsernameGenerationService,
    RollNumberSettingsService,
    StudentDisplaySettingsService,
    UserProvisioningService,
    UsersService,
    DemoAccountsService,
    ErpUsersService,
    RbacService,
    AuditService,
    SecurityService,
    SecurityCenterService,
    DeviceSecurityService,
    PortalUsersImportHandler,
    ImportCenterService,
  ],
  exports: [
    UserProvisioningService,
    UsernameGenerationService,
    RollNumberSettingsService,
    StudentDisplaySettingsService,
    AdminAuditHelper,
    DeviceSecurityModule,
  ],
})
export class AdministrationModule {}
