# Full Quality Program — Sprint Report (2026-07-12)

**Scope executed:** Phase 0 foundations + Phase 1 admin core Critical/High + Phase 2–4 regression gates for shared patterns, portals, and public login.

## Critical / High fixes shipped

| ID         | Severity | Module                                                           | Fix                                                                                                                                  |
| ---------- | -------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Q-2026-S1  | Critical | Students API                                                     | Added `@RequireAnyPermission` on summary, getOne, profile, sections, semester-registrations; enroll requires manage/admissions perms |
| Q-2026-S2  | Critical | Communication                                                    | `track/click` open-redirect blocked — only same-app relative paths                                                                   |
| Q-2026-S3  | High     | Notification links                                               | `canAccessPath` deny-by-default for unknown paths (web + API)                                                                        |
| Q-2026-S4  | High     | Admin nav                                                        | Children inherit parent permissions (no bare allow-all)                                                                              |
| Q-2026-S5  | High     | Admin RBAC UI                                                    | `AdminPermissionGuard` blocks forbidden modules with Access denied UI                                                                |
| Q-2026-S6  | High     | Admin a11y                                                       | Skip-to-content + `#main-content`; global `:focus-visible`                                                                           |
| Q-2026-S7  | High     | ERP kit                                                          | DataTable empty `role="status"`; QueryErrorPanel sanitizes permission dumps                                                          |
| Q-2026-S8  | High     | Students UI                                                      | Directory: access denied, error retry, empty filter state                                                                            |
| Q-2026-S9  | High     | Fees / Attendance / Exams / IA / Academic engine / Communication | Dashboard error panels + empty states (no more silent zeros)                                                                         |
| Q-2026-S10 | High     | Student/Staff portals                                            | Dashboard QueryErrorPanel on shell/dashboard failure                                                                                 |
| Q-2026-S11 | High     | Mobile / Login                                                   | Confirmed password-reset gate + safe `?next=` login redirect (prior sprint)                                                          |

## Performance / security

- Student PII endpoints no longer readable by any authenticated JWT without `students:read|manage`
- Phishing open-redirect on email click tracking closed
- Notification deep-links cannot escape into arbitrary relative URLs
- Admin module over-exposure reduced via route guard + nav inheritance

## UX

- Consistent error/empty patterns on Phase 1 hubs and end-user dashboards
- Patterns documented in `docs/quality/ERP-UI-PATTERNS.md`
- Ledger: `docs/quality/AUDIT-LEDGER.md`

## Remaining recommendations (Medium/Low)

1. Migrate remaining admin pages onto `ErpPageLayout` + `QueryErrorPanel` systematically
2. Add Playwright smoke for permission-denied admin routes
3. Bundle analysis for heaviest admin chart pages
4. Deploy to live VPS (`vps-update.sh`) so Class XII / Feedback / password-force API land in production
5. Full axe CI gate on critical paths
