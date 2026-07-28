import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type {
  EffectiveLmsProvider,
  EnrichedWorkspaceProvider,
  LmsProviderAdapter,
  WorkspaceProviderContext,
} from './lms-provider.types';

@Injectable()
export class NativeLmsAdapter implements LmsProviderAdapter {
  async resolveEffectiveProvider(
    _tenantId: string,
    workspace: WorkspaceProviderContext,
  ): Promise<EffectiveLmsProvider> {
    if (workspace.provider === 'MOODLE') return 'MOODLE';
    return 'NATIVE';
  }

  async enrichWorkspace(
    _user: JwtUser,
    _workspace: WorkspaceProviderContext,
  ): Promise<EnrichedWorkspaceProvider> {
    return {
      effectiveProvider: 'NATIVE',
      launchUrl: null,
      moodleSummary: null,
    };
  }

  async getLaunchUrl(): Promise<string | null> {
    return null;
  }
}
