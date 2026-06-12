'use client';

import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { pingActivity } from '@/lib/auth/session-activity';
import { createHttpClient } from '@/lib/http/create-client';

export const api = createHttpClient({
  onSuccess: pingActivity,
  onUnauthorized: (error, retry) => tokenRefreshManager.handle401(error, retry),
});

export { API_BASE_URL } from '@/lib/http/env';
