import { useAuthStore } from '@/store/auth-store';

const BOOTSTRAP_WAIT_MS = 10_000;

/** Wait until persisted prefs are loaded and the refresh-cookie bootstrap has finished. */
export function waitForAuthBootstrap(): Promise<void> {
  const state = useAuthStore.getState();
  if (state.hasHydrated && !state.isBootstrapping) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      reject(new Error('Auth bootstrap timed out'));
    }, BOOTSTRAP_WAIT_MS);

    const unsub = useAuthStore.subscribe((next) => {
      if (next.hasHydrated && !next.isBootstrapping) {
        clearTimeout(timeout);
        unsub();
        resolve();
      }
    });
  });
}
