import type { JwtUser } from '../../../common/decorators/current-user.decorator';

export type EffectiveLmsProvider = 'NATIVE' | 'MOODLE';

export type WorkspaceProviderContext = {
  id: string;
  provider?: string | null;
  moodleCourseId?: number | null;
};

export type EnrichedWorkspaceProvider = {
  effectiveProvider: EffectiveLmsProvider;
  launchUrl?: string | null;
  moodleSummary?: {
    assignmentsDue: number;
    quizzesOpen: number;
  } | null;
};

export interface LmsProviderAdapter {
  resolveEffectiveProvider(
    tenantId: string,
    workspace: WorkspaceProviderContext,
  ): Promise<EffectiveLmsProvider>;

  enrichWorkspace(
    user: JwtUser,
    workspace: WorkspaceProviderContext & { title?: string },
  ): Promise<EnrichedWorkspaceProvider>;

  getLaunchUrl(user: JwtUser, workspaceId: string): Promise<string | null>;
}
