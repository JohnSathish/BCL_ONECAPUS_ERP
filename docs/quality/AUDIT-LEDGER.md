# BCL OneCampus ERP — Quality Audit Ledger

**Program:** Full Quality Program (1B Admin core → Full)  
**Started:** 2026-07-12  
**Updated:** 2026-07-12  
**Severity:** Critical | High | Medium | Low  
**Status:** Open | In Progress | Fixed | Deferred

## Workflow

1. Identify issue → assign ID
2. Record severity, module, why it matters
3. Implement fix → smoke-test
4. Mark Fixed with before/after

## Summary

| Severity   | Open    | Fixed this sprint |
| ---------- | ------- | ----------------- |
| Critical   | 0       | 2                 |
| High       | 0       | 9+                |
| Medium/Low | Backlog | Patterns doc      |

---

## Issue log

| ID         | Severity | Module                                                             | Status | Summary                                                               |
| ---------- | -------- | ------------------------------------------------------------------ | ------ | --------------------------------------------------------------------- |
| Q-2026-001 | High     | Foundations                                                        | Fixed  | Created audit ledger + UI patterns docs                               |
| Q-2026-002 | High     | Admin shell                                                        | Fixed  | Skip-to-content + `:focus-visible`                                    |
| Q-2026-003 | High     | Admin RBAC UI                                                      | Fixed  | Route permission guard shows Access denied (not silent redirect only) |
| Q-2026-004 | High     | ERP DataTable / QueryErrorPanel                                    | Fixed  | Accessible empty state; sanitize permission error text                |
| Q-2026-005 | Critical | Students API                                                       | Fixed  | Decorated unprotected read/enroll endpoints                           |
| Q-2026-006 | High     | Students UI                                                        | Fixed  | Directory empty/error/forbidden states                                |
| Q-2026-007 | High     | Admin nav                                                          | Fixed  | Nav children inherit parent permissions                               |
| Q-2026-008 | Critical | Communication                                                      | Fixed  | Closed open redirect on track/click                                   |
| Q-2026-009 | High     | Notifications                                                      | Fixed  | `canAccessPath` deny unknown paths (web+API)                          |
| Q-2026-010 | High     | Fees / Attendance / Exams / IA / Academic engine / Comm dashboards | Fixed  | QueryErrorPanel — no silent KPI zeros                                 |
| Q-2026-011 | High     | Student/Staff portals                                              | Fixed  | Dashboard load errors surfaced with retry                             |
| Q-2026-012 | High     | Mobile + Login                                                     | Fixed  | Temp password force + secure `next=` (prior + verified)               |
| Q-2026-013 | Medium   | Foundations                                                        | Fixed  | `docs/quality/ERP-UI-PATTERNS.md`                                     |

---

## Phase exit

| Phase                        | Status                                                               |
| ---------------------------- | -------------------------------------------------------------------- |
| P0 Foundations               | Done                                                                 |
| P1 Admin core Critical/High  | Done (hub + API)                                                     |
| P2 Rest of admin             | Done for shared RBAC/shell; page-by-page Medium migration deferred   |
| P3 End-user portals + mobile | Done for Critical/High dashboards + mobile regression                |
| P4 Public desks              | Done for login `next=` + shared LoginForm; desk shells use same auth |

See also: [PROGRAM-REPORT-2026-07-12.md](./PROGRAM-REPORT-2026-07-12.md)

## Remaining recommendations

- Progressive `QueryErrorPanel` on every admin list page
- Playwright RBAC smoke
- Live VPS deploy of this sprint
- axe CI on critical portals
