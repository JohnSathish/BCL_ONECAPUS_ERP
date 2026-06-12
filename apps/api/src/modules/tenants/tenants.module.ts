import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantResolutionService } from './tenant-resolution.service';
import { TenantsService } from './tenants.service';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, TenantResolutionService],
  exports: [TenantsService, TenantResolutionService],
})
export class TenantsModule {}
