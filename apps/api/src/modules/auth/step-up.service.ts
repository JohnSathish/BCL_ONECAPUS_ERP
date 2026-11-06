import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { MfaService } from './mfa/mfa.service';

const STEP_UP_TTL_SECONDS = 300;

type StepUpClaims = {
  sub: string;
  exp: number;
  nonce: string;
};

@Injectable()
export class StepUpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly mfa: MfaService,
    private readonly config: ConfigService,
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

    const token = this.sign(userId);
    await this.cache.set(
      this.cacheKey(userId, token),
      { used: false },
      STEP_UP_TTL_SECONDS,
    );
    return { stepUpToken: token, expiresInSeconds: STEP_UP_TTL_SECONDS };
  }

  async verify(userId: string, token: string): Promise<boolean> {
    const claims = this.read(token);
    if (!claims || claims.sub !== userId || claims.exp < Date.now())
      return false;

    const key = this.cacheKey(userId, token);
    const row = await this.cache.get<{ used: boolean }>(key);
    if (row?.used) return false;
    await this.cache.set(key, { used: true }, STEP_UP_TTL_SECONDS);
    return true;
  }

  private cacheKey(userId: string, token: string) {
    return `stepup:${userId}:${token}`;
  }

  private sign(userId: string) {
    const claims: StepUpClaims = {
      sub: userId,
      exp: Date.now() + STEP_UP_TTL_SECONDS * 1000,
      nonce: randomBytes(16).toString('base64url'),
    };
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `${body}.${this.mac(body)}`;
  }

  private read(token: string): StepUpClaims | null {
    const splitAt = token.lastIndexOf('.');
    if (splitAt <= 0) return null;
    const body = token.slice(0, splitAt);
    const signature = token.slice(splitAt + 1);
    const expected = this.mac(body);
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right))
      return null;
    try {
      const claims = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as StepUpClaims;
      if (!claims?.sub || !claims.exp || !claims.nonce) return null;
      return claims;
    } catch {
      return null;
    }
  }

  private mac(body: string) {
    return createHmac(
      'sha256',
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    )
      .update(body)
      .digest('base64url');
  }
}
