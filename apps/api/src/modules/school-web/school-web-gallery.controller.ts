import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  SCHOOL_WEB_PERMISSION_MANAGE,
  SCHOOL_WEB_PERMISSION_MEDIA,
  SCHOOL_WEB_PERMISSION_PUBLISH,
  SCHOOL_WEB_PERMISSION_READ,
} from './school-web.constants';
import {
  PatchSchoolWebGalleryItemDto,
  SchoolWebGalleryBulkAlbumsDto,
  SchoolWebGalleryBulkItemsDto,
  SchoolWebGalleryReorderDto,
  UpsertSchoolWebGalleryAlbumDto,
  UpsertSchoolWebGalleryTaxonomyDto,
} from './dto/school-web.dto';
import { SchoolWebGalleryService } from './school-web-gallery.service';
import {
  GALLERY_MAX_BYTES,
  GALLERY_MAX_FILES,
} from './school-web-gallery.util';

@ApiBearerAuth()
@ApiTags('school-web-gallery')
@Controller({ path: 'school-web/gallery', version: '1' })
export class SchoolWebGalleryController {
  constructor(private readonly gallery: SchoolWebGalleryService) {}

  @Get('dashboard')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_READ,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  dashboard(@CurrentUser() user: JwtUser) {
    return this.gallery.dashboard(user.tid);
  }

  @Get('categories')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_READ,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  categories(@CurrentUser() user: JwtUser) {
    return this.gallery.listCategories(user.tid);
  }

  @Post('categories')
  @RequireAnyPermission(SCHOOL_WEB_PERMISSION_MANAGE)
  upsertCategory(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertSchoolWebGalleryTaxonomyDto,
  ) {
    return this.gallery.upsertCategory(user.tid, dto, dto.id);
  }

  @Delete('categories/:id')
  @RequireAnyPermission(SCHOOL_WEB_PERMISSION_MANAGE)
  deleteCategory(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.gallery.deleteCategory(user.tid, id);
  }

  @Get('tags')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_READ,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  tags(@CurrentUser() user: JwtUser) {
    return this.gallery.listTags(user.tid);
  }

  @Post('tags')
  @RequireAnyPermission(SCHOOL_WEB_PERMISSION_MANAGE)
  upsertTag(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertSchoolWebGalleryTaxonomyDto,
  ) {
    return this.gallery.upsertTag(user.tid, dto, dto.id);
  }

  @Delete('tags/:id')
  @RequireAnyPermission(SCHOOL_WEB_PERMISSION_MANAGE)
  deleteTag(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.gallery.deleteTag(user.tid, id);
  }

  @Get()
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_READ,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  list(
    @CurrentUser() user: JwtUser,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('visibility') visibility?: string,
    @Query('categoryId') categoryId?: string,
    @Query('tagId') tagId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.gallery.listOffice(user.tid, {
      q,
      status,
      visibility,
      categoryId,
      tagId,
      from,
      to,
    });
  }

  @Post('bulk')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_MANAGE,
    SCHOOL_WEB_PERMISSION_PUBLISH,
  )
  bulk(
    @CurrentUser() user: JwtUser,
    @Body() dto: SchoolWebGalleryBulkAlbumsDto,
  ) {
    return this.gallery.bulkAlbums(user.tid, user.sub, dto);
  }

  @Post()
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_MANAGE,
    SCHOOL_WEB_PERMISSION_PUBLISH,
  )
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertSchoolWebGalleryAlbumDto,
  ) {
    return this.gallery.upsertAlbum(user.tid, user.sub, dto);
  }

  @Get(':id')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_READ,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  get(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query('page') page?: string,
  ) {
    return this.gallery.getOffice(user.tid, id, page ? Number(page) : 1);
  }

  @Patch(':id')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_MANAGE,
    SCHOOL_WEB_PERMISSION_PUBLISH,
  )
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertSchoolWebGalleryAlbumDto,
  ) {
    return this.gallery.upsertAlbum(user.tid, user.sub, dto, id);
  }

  @Post(':id/images')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_MEDIA,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  @UseInterceptors(
    FilesInterceptor('files', GALLERY_MAX_FILES, {
      storage: memoryStorage(),
      limits: { fileSize: GALLERY_MAX_BYTES },
    }),
  )
  upload(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.gallery.uploadImages(user.tid, user.sub, id, files ?? []);
  }

  @Post(':id/images/bulk')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_MEDIA,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  bulkItems(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SchoolWebGalleryBulkItemsDto,
  ) {
    return this.gallery.bulkItems(user.tid, user.sub, id, dto);
  }

  @Post(':id/reorder')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_MEDIA,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  reorder(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SchoolWebGalleryReorderDto,
  ) {
    return this.gallery.reorder(user.tid, id, dto);
  }

  @Post(':id/cover/:itemId')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_MANAGE,
    SCHOOL_WEB_PERMISSION_MEDIA,
  )
  cover(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.gallery.setCover(user.tid, user.sub, id, itemId);
  }

  @Patch('items/:itemId')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_MEDIA,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  patchItem(
    @CurrentUser() user: JwtUser,
    @Param('itemId') itemId: string,
    @Body() dto: PatchSchoolWebGalleryItemDto,
  ) {
    return this.gallery.patchItem(user.tid, user.sub, itemId, dto);
  }

  @Post(':id/items/:itemId/file')
  @RequireAnyPermission(
    SCHOOL_WEB_PERMISSION_MEDIA,
    SCHOOL_WEB_PERMISSION_MANAGE,
  )
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: GALLERY_MAX_BYTES },
    }),
  )
  replace(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.gallery.replaceImage(user.tid, user.sub, id, itemId, file);
  }
}
