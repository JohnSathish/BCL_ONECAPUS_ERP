import { createHash, randomBytes } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { MoodleSettingsService } from './moodle-settings.service';

type LaunchPayload = {
  userId: string;
  tenantId: string;
  moodleCourseId?: number;
  workspaceId?: string;
  exp: number;
  nonce: string;
};

@Injectable()
export class MoodleAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: MoodleSettingsService,
    private readonly config: ConfigService,
  ) {}

  async createLaunchToken(input: {
    tenantId: string;
    userId: string;
    moodleCourseId?: number;
    workspaceId?: string;
  }) {
    const cfg = await this.settings.getDecrypted(input.tenantId);
    if (!cfg.settings?.ssoEnabled) {
      throw new UnauthorizedException('Moodle SSO is disabled');
    }
    const payload: LaunchPayload = {
      userId: input.userId,
      tenantId: input.tenantId,
      moodleCourseId: input.moodleCourseId,
      workspaceId: input.workspaceId,
      exp: Math.floor(Date.now() / 1000) + 60,
      nonce: randomBytes(16).toString('hex'),
    };
    const secret =
      cfg.ssoSecret ?? this.config.get<string>('MOODLE_SSO_SECRET') ?? '';
    if (!secret)
      throw new UnauthorizedException('Moodle SSO secret is not configured');
    const token = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHash('sha256')
      .update(`${token}.${secret}`)
      .digest('base64url');
    return `${token}.${sig}`;
  }

  async buildLaunchUrl(input: {
    tenantId: string;
    userId: string;
    moodleCourseId?: number;
    workspaceId?: string;
  }) {
    const cfg = await this.settings.getDecrypted(input.tenantId);
    if (!cfg.moodleUrl)
      throw new UnauthorizedException('Moodle URL is not configured');
    const token = await this.createLaunchToken(input);
    const base = cfg.moodleUrl.replace(/\/+$/, '');
    const path = input.moodleCourseId
      ? `/course/view.php?id=${input.moodleCourseId}`
      : '/my/courses.php';
    const wanturl = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    return `${base}/auth/erp/login.php?token=${encodeURIComponent(token)}&wanturl=${encodeURIComponent(wanturl)}`;
  }

  async verifyLaunchToken(token: string) {
    const [payloadPart, sig] = token.split('.');
    if (!payloadPart || !sig)
      throw new UnauthorizedException('Invalid SSO token');
    let payload: LaunchPayload;
    try {
      payload = JSON.parse(
        Buffer.from(payloadPart, 'base64url').toString('utf8'),
      ) as LaunchPayload;
    } catch {
      throw new UnauthorizedException('Invalid SSO token payload');
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('SSO token expired');
    }
    const cfg = await this.settings.getDecrypted(payload.tenantId);
    const secret =
      cfg.ssoSecret ?? this.config.get<string>('MOODLE_SSO_SECRET') ?? '';
    const expected = createHash('sha256')
      .update(`${payloadPart}.${secret}`)
      .digest('base64url');
    if (expected !== sig)
      throw new UnauthorizedException('Invalid SSO token signature');

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.userId,
        tenantId: payload.tenantId,
        deletedAt: null,
      },
      include: {
        student: true,
        staffProfile: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const moodleUser = await this.prisma.moodleUser.findFirst({
      where: { tenantId: payload.tenantId, erpUserId: user.id },
    });
    const display = user.displayName ?? user.email;

    return {
      tenantId: payload.tenantId,
      userId: user.id,
      email: user.email,
      displayName: display,
      moodleUserId:
        moodleUser?.moodleUserId ??
        user.student?.moodleUserId ??
        user.staffProfile?.moodleUserId,
      moodleCourseId: payload.moodleCourseId ?? null,
      workspaceId: payload.workspaceId ?? null,
    };
  }
}
