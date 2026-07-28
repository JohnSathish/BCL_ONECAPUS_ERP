import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { MoodleAuthService } from '../../moodle/moodle-auth.service';
import { LmsSettingsService } from '../services/lms-settings.service';
import type {
  EffectiveLmsProvider,
  EnrichedWorkspaceProvider,
  LmsProviderAdapter,
  WorkspaceProviderContext,
} from './lms-provider.types';

@Injectable()
export class MoodleLmsAdapter implements LmsProviderAdapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lmsSettings: LmsSettingsService,
    private readonly auth: MoodleAuthService,
  ) {}

  async resolveEffectiveProvider(
    tenantId: string,
    workspace: WorkspaceProviderContext,
  ): Promise<EffectiveLmsProvider> {
    if (workspace.provider === 'MOODLE') return 'MOODLE';
    if (workspace.provider === 'NATIVE') return 'NATIVE';
    const settings = await this.lmsSettings.getOrCreate(tenantId);
    return settings.defaultLmsProvider === 'MOODLE' ? 'MOODLE' : 'NATIVE';
  }

  async enrichWorkspace(
    user: JwtUser,
    workspace: WorkspaceProviderContext,
  ): Promise<EnrichedWorkspaceProvider> {
    const effectiveProvider = await this.resolveEffectiveProvider(
      user.tid,
      workspace,
    );
    if (effectiveProvider !== 'MOODLE') {
      return {
        effectiveProvider: 'NATIVE',
        launchUrl: null,
        moodleSummary: null,
      };
    }

    const now = new Date();
    const moodleCourse = await this.prisma.moodleCourse.findFirst({
      where: {
        tenantId: user.tid,
        OR: [
          { lmsWorkspaceId: workspace.id },
          ...(workspace.moodleCourseId != null
            ? [{ moodleCourseId: workspace.moodleCourseId }]
            : []),
        ],
      },
      select: { id: true },
    });

    let moodleSummary: EnrichedWorkspaceProvider['moodleSummary'] = null;
    if (moodleCourse) {
      const [assignmentsDue, quizzesOpen] = await Promise.all([
        this.prisma.moodleAssignment.count({
          where: {
            tenantId: user.tid,
            moodleCourseId: moodleCourse.id,
            dueAt: { gte: now },
          },
        }),
        this.prisma.moodleQuiz.count({
          where: {
            tenantId: user.tid,
            moodleCourseId: moodleCourse.id,
            OR: [{ timeClose: { gte: now } }, { timeClose: null }],
          },
        }),
      ]);
      moodleSummary = { assignmentsDue, quizzesOpen };
    }

    let launchUrl: string | null = null;
    try {
      launchUrl = await this.getLaunchUrl(user, workspace.id);
    } catch {
      launchUrl = null;
    }

    return { effectiveProvider: 'MOODLE', launchUrl, moodleSummary };
  }

  async getLaunchUrl(
    user: JwtUser,
    workspaceId: string,
  ): Promise<string | null> {
    const workspace = await this.prisma.lmsWorkspace.findFirst({
      where: { id: workspaceId, tenantId: user.tid, deletedAt: null },
    });
    if (!workspace) return null;

    const effectiveProvider = await this.resolveEffectiveProvider(
      user.tid,
      workspace,
    );
    if (effectiveProvider !== 'MOODLE') return null;

    const moodleCourseId =
      workspace.moodleCourseId ??
      (
        await this.prisma.moodleCourse.findFirst({
          where: { tenantId: user.tid, lmsWorkspaceId: workspace.id },
          select: { moodleCourseId: true },
        })
      )?.moodleCourseId;

    return this.auth.buildLaunchUrl({
      tenantId: user.tid,
      userId: user.sub,
      moodleCourseId: moodleCourseId ?? undefined,
      workspaceId,
    });
  }
}
