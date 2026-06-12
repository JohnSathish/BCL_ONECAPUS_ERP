import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { UsersService } from './users.service';

@ApiBearerAuth()
@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me/preferences')
  getPreferences(@CurrentUser() user: JwtUser) {
    return this.users.getPreferences(user.sub);
  }

  @Patch('me/preferences')
  updatePreferences(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateUserPreferencesDto,
  ) {
    return this.users.updatePreferences(user.sub, dto);
  }
}
