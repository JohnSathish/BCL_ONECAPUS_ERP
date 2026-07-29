import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { StaffProfileReviewService } from './services/staff-profile-review.service';

@ApiBearerAuth()
@ApiTags('staff-profile-review')
@Controller({ path: 'staff/profile-reviews', version: '1' })
export class StaffProfileReviewController {
  constructor(private readonly reviews: StaffProfileReviewService) {}

  @Get('pending')
  @RequireAnyPermission('staff:manage', 'staff:edit')
  listPending(@CurrentUser() user: JwtUser) {
    return this.reviews.listPending(user.tid);
  }

  @Post(':kind/:id/approve')
  @RequireAnyPermission('staff:manage', 'staff:edit')
  approve(
    @CurrentUser() user: JwtUser,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: { remarks?: string },
  ) {
    return this.reviews.review(
      user,
      kind.toUpperCase() as
        | 'QUALIFICATION'
        | 'EXPERIENCE'
        | 'CERTIFICATION'
        | 'DOCUMENT',
      id,
      'APPROVED',
      body.remarks,
    );
  }

  @Post(':kind/:id/reject')
  @RequireAnyPermission('staff:manage', 'staff:edit')
  reject(
    @CurrentUser() user: JwtUser,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: { remarks?: string },
  ) {
    return this.reviews.review(
      user,
      kind.toUpperCase() as
        | 'QUALIFICATION'
        | 'EXPERIENCE'
        | 'CERTIFICATION'
        | 'DOCUMENT',
      id,
      'REJECTED',
      body.remarks,
    );
  }
}
