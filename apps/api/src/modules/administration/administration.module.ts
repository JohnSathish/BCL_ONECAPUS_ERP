import { Module, forwardRef } from '@nestjs/common';
import { ImportModule } from '../../common/import/import.module';
import { AuthModule } from '../auth/auth.module';
import { StaffModule } from '../staff/staff.module';
import { AdminAuditHelper } from './admin-audit.helper';
import { RollNumberSettingsController } from './controllers/roll-number-settings.controller';
import { StudentDisplaySettingsController } from './controllers/student-display-settings.controller';
import { AuditController } from './controllers/audit.controller';
import { RbacController } from './controllers/rbac.controller';
import { SecurityController } from './controllers/security.controller';
import { UsersController } from './controllers/users.controller';
import { ImportCenterController } from './import/import-center.controller';
import { ImportCenterService } from './import/import-center.service';
import { PortalUsersImportHandler } from './import/portal-users-import.handler';
import { AuditService } from './services/audit.service';
import { RbacService } from './services/rbac.service';
import { RollNumberSettingsService } from './services/roll-number-settings.service';
import { StudentDisplaySettingsService } from './services/student-display-settings.service';
import { SecurityService } from './services/security.service';
import { UserProvisioningService } from './services/user-provisioning.service';
import { UsernameGenerationService } from './services/username-generation.service';
import { UsersService } from './services/users.service';

@Module({
  imports: [AuthModule, ImportModule, forwardRef(() => StaffModule)],
  controllers: [
    UsersController,
    RbacController,
    AuditController,
    SecurityController,
    RollNumberSettingsController,
    StudentDisplaySettingsController,
    ImportCenterController,
  ],
  providers: [
    AdminAuditHelper,
    UsernameGenerationService,
    RollNumberSettingsService,
    StudentDisplaySettingsService,
    UserProvisioningService,
    UsersService,
    RbacService,
    AuditService,
    SecurityService,
    PortalUsersImportHandler,
    ImportCenterService,
  ],
  exports: [
    UserProvisioningService,
    UsernameGenerationService,
    RollNumberSettingsService,
    StudentDisplaySettingsService,
    AdminAuditHelper,
  ],
})
export class AdministrationModule {}
