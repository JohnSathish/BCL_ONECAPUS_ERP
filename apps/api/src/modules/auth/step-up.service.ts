import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { MfaService } from './mfa/mfa.service';

@Injectable()
export class StepUpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly mfa: MfaService,
  ) {}

  async authenticate(
    userId: string,
    input: { password?: string; totpCode?: string },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('User not found');

    let verified = false;
    if (input.password) {
      verified = await bcrypt.compare(input.password, user.passwordHash);
    } else if (input.totpCode) {
      verified = await this.mfa.verifyTotp(userId, input.totpCode);
    }
    if (!verified) throw new UnauthorizedException('Verification failed');

    const token = randomBytes(32).toString('base64url');
    await this.cache.set(`stepup:${userId}:${token}`, { used: false }, 300);
    return { stepUpToken: token, expiresInSeconds: 300 };
  }

  async verify(userId: string, token: string): Promise<boolean> {
    if (!token) return false;
    const key = `stepup:${userId}:${token}`;
    const row = await this.cache.get<{ used: boolean }>(key);
    if (!row || row.used) return false;
    await this.cache.set(key, { used: true }, 300);
    return true;
  }
}
