import { createHttpClient } from '@/lib/http/create-client';

/** Unauthenticated HTTP client for health checks and auth bootstrap. */
export const publicClient = createHttpClient({ attachAuth: false });
