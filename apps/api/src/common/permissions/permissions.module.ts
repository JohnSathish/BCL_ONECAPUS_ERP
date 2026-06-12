import { Global, Module } from '@nestjs/common';
import { DataScopeService } from './data-scope.service';
import { PermissionAuditService } from './permission-audit.service';
import { PermissionResolverService } from './permission-resolver.service';

@Global()
@Module({
  providers: [
    PermissionResolverService,
    DataScopeService,
    PermissionAuditService,
  ],
  exports: [
    PermissionResolverService,
    DataScopeService,
    PermissionAuditService,
  ],
})
export class PermissionsModule {}
