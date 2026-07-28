import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { MoodleLmsAdapter } from './moodle-lms.adapter';
import { NativeLmsAdapter } from './native-lms.adapter';
import type { WorkspaceProviderContext } from './lms-provider.types';

@Injectable()
export class LmsProviderRouterService {
  constructor(
    private readonly native: NativeLmsAdapter,
    private readonly moodle: MoodleLmsAdapter,
  ) {}

  async enrichWorkspaces<T extends WorkspaceProviderContext>(
    user: JwtUser,
    workspaces: T[],
  ): Promise<
    Array<
      T & {
        effectiveProvider: 'NATIVE' | 'MOODLE';
        launchUrl?: string | null;
        moodleSummary?: { assignmentsDue: number; quizzesOpen: number } | null;
      }
    >
  > {
    return Promise.all(
      workspaces.map(async (workspace) => {
        const effectiveProvider = await this.moodle.resolveEffectiveProvider(
          user.tid,
          workspace,
        );
        if (effectiveProvider === 'MOODLE') {
          const enriched = await this.moodle.enrichWorkspace(user, workspace);
          return { ...workspace, ...enriched };
        }
        const enriched = await this.native.enrichWorkspace(user, workspace);
        return { ...workspace, ...enriched };
      }),
    );
  }

  getLaunchUrl(user: JwtUser, workspaceId: string) {
    return this.moodle.getLaunchUrl(user, workspaceId);
  }
}
