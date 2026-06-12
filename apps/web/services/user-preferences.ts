import type { UserPreferences } from '@/types/branding';
import { api } from './api';

export async function fetchUserPreferences(): Promise<UserPreferences> {
  const { data } = await api.get<UserPreferences>('/v1/users/me/preferences');
  return data;
}

export async function updateUserAppearanceMode(
  appearanceMode: UserPreferences['appearanceMode'],
): Promise<UserPreferences> {
  const { data } = await api.patch<UserPreferences>('/v1/users/me/preferences', {
    appearanceMode,
  });
  return data;
}
