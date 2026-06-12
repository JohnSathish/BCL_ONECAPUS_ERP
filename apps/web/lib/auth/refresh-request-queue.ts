export type RefreshQueueEntry = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

/** Flush queued 401 retries after a single refresh completes or fails. */
export function processRefreshQueue(
  queue: RefreshQueueEntry[],
  error: unknown | null,
  token: string | null,
): RefreshQueueEntry[] {
  for (const entry of queue) {
    if (error) entry.reject(error);
    else if (token) entry.resolve(token);
  }
  return [];
}
