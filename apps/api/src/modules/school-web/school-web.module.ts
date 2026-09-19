import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { SchoolWebController } from './school-web.controller';
import { SchoolWebPublicController } from './school-web-public.controller';
import { SchoolWebService } from './school-web.service';
import { SchoolWebPresenceService } from './school-web-presence.service';

import { SchoolWebGalleryService } from './school-web-gallery.service';
import { SchoolWebGalleryController } from './school-web-gallery.controller';
import { SchoolWebMailService } from './school-web-mail.service';

@Module({
  imports: [AuthModule, TenantsModule],
  controllers: [
    SchoolWebPublicController,
    SchoolWebController,
    SchoolWebGalleryController,
  ],
  providers: [
    SchoolWebService,
    SchoolWebPresenceService,
    SchoolWebGalleryService,
    SchoolWebMailService,
  ],
  exports: [
    SchoolWebService,
    SchoolWebPresenceService,
    SchoolWebGalleryService,
    SchoolWebMailService,
  ],
})
export class SchoolWebModule {}
