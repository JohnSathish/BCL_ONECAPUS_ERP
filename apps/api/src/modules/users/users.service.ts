import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';

export type UserPreferencesDto = {
  appearanceMode: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string): Promise<UserPreferencesDto> {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      select: { appearanceMode: true },
    });
    return { appearanceMode: user.appearanceMode };
  }

  async updatePreferences(
    userId: string,
    dto: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesDto> {
    const data: { appearanceMode?: string } = {};
    if (dto.appearanceMode !== undefined) {
      data.appearanceMode = dto.appearanceMode;
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: { appearanceMode: true },
    });
    return { appearanceMode: user.appearanceMode };
  }
}
