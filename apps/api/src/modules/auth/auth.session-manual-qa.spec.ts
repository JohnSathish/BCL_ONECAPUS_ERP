/**
 * Manual QA checklist for enterprise session management.
 * Run these scenarios by hand after auth changes; they are skipped in CI.
 *
 * @see apps/web/components/providers/session-provider.tsx
 */
describe.skip('Session management manual QA', () => {
  it('long-form entry: type in course form 20+ min with no API calls — no logout until idle', () => {});

  it('proactive refresh: after login, access token refreshes ~2 min before expiry without redirect', () => {});

  it('parallel 401: trigger several API calls with expired access — all succeed after single refresh', () => {});

  it('idle warning: no input for 13 min — modal appears with Continue / Logout', () => {});

  it('idle logout: ignore modal for 2 more min — logout only after 15 min inactivity', () => {});

  it('typing guard: with focus in a textarea at 15 min idle — forced logout suppressed until blur', () => {});

  it('multi-tab: logout in one tab clears session and redirects all tabs to login', () => {});

  it('remember me: login with checkbox — refresh cookie persists 30 days (check Set-Cookie maxAge)', () => {});

  it('unsaved changes: dirty course form — browser beforeunload and idle logout confirm', () => {});

  it('draft restore: refresh page mid course edit — restore draft prompt and recovered fields', () => {});
});
