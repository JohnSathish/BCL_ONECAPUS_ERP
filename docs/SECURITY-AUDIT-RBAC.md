# ERP Role-Based Access Control — Security Audit Report

**Date:** 2026-06-03  
**Severity:** Critical (student → admin module via notification)  
**Status:** Mitigations implemented (see “Fixes applied”)

---

## Executive summary

A student user could click an in-app notification and land on `/admin/communication` with the full admin shell visible. Root cause: **hardcoded admin notification links** plus **missing frontend route guards** on `/admin/*`. Backend API permissions blocked data, but the UI exposed administrative navigation chrome — a privilege escalation and information-disclosure risk.

---

## Vulnerability: notification → admin redirect

| Item               | Detail                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| **Vector**         | In-app notification bell → `link: '/admin/communication'`                    |
| **Affected users** | All campaign recipients including students                                   |
| **Root cause**     | `communication-delivery.service.ts` set admin link for every IN_APP delivery |
| **Impact**         | Student sees admin layout; may explore admin URLs; trust boundary broken     |

### Fixes applied

1. **Role-aware link resolution** — triggers map to portal-specific destinations (e.g. fee → `/student/fees`, certificate → `/student/certificates`).
2. **Link sanitization on create** — `createInApp()` strips admin paths for non-admin roles.
3. **Link sanitization on read** — notification list API rewrites unsafe links per JWT roles.
4. **Frontend click guard** — `NotificationPanel` validates links before `router.push()`.

---

## Route protection audit

| Portal       | Before                                    | After                                                           |
| ------------ | ----------------------------------------- | --------------------------------------------------------------- |
| `/admin/*`   | Auth only (`useRequireAuth`)              | **`AdminPortalGuard`** layout — blocks student/staff-only users |
| `/staff/*`   | Per-page `useRequireStaffPortal`          | **`StaffPortalGuard`** layout (defense in depth)                |
| `/student/*` | Auth only                                 | Unchanged (student-safe modules)                                |
| Direct URL   | Student could open `/admin/communication` | Redirect to **`/access-denied`**                                |

**Remaining gap:** Individual admin pages do not yet check fine-grained permissions (e.g. `communication:read`). API enforces this; UI shows access-denied message where added (Communication Center).

---

## API security audit

| Endpoint group                                      | Permission enforcement                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| Communication hub (dashboard, campaigns, templates) | `communication:read` / `communication:manage` ✓                           |
| Notification list / read / preferences              | **Was:** JWT only → **Now:** `notifications:read` (or comm permissions) ✓ |
| Certificates, fees, students, etc.                  | Module-specific permissions ✓                                             |

**Principle:** Backend remains authoritative; frontend guards are UX + defense in depth.

---

## Menu security audit

| Area              | Before                                                  | After                                                        |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| Admin sidebar     | Only 3 items permission-filtered; default **allow all** | **Deny by default**; student-only users see **no admin nav** |
| Student sidebar   | Correct (`ROLE_NAV.student`)                            | Unchanged                                                    |
| Communication nav | Hidden without `communication:read`                     | Unchanged (correct)                                          |

**Remaining gap:** Full per-route permission map for all 137 admin pages not yet centralized in one config file.

---

## Notification data isolation

| Control                                      | Status                                                      |
| -------------------------------------------- | ----------------------------------------------------------- |
| Notifications scoped to `userId`             | ✓ (existing)                                                |
| Students receive only their deliveries       | ✓ (campaign audience)                                       |
| Admin-only operational alerts to students    | **Fixed** — no admin deep-links                             |
| Audience metadata (programme, section, etc.) | Partial — stored on campaigns; not yet enforced on list API |

---

## Centralized permission engine

New shared modules:

| Location                                                             | Purpose                                       |
| -------------------------------------------------------------------- | --------------------------------------------- |
| `apps/web/lib/permissions/portal-access.ts`                          | Portal access, path checks, link sanitization |
| `apps/api/src/common/permissions/portal-access.ts`                   | Server-side mirror                            |
| `apps/api/src/modules/communication/utils/notification-link.util.ts` | Trigger → destination mapping                 |
| `scripts/security/audit-rbac-endpoints.ts`                           | CI static audit — fails on unguarded routes   |

Run before each release:

```bash
npx tsx scripts/security/audit-rbac-endpoints.ts
# or: npm run audit:rbac-endpoints -w api
```

---

## Cross-module risks identified

| Risk                                                      | Severity | Status                                    |
| --------------------------------------------------------- | -------- | ----------------------------------------- |
| Notification admin link                                   | Critical | **Fixed**                                 |
| No admin layout guard                                     | High     | **Fixed**                                 |
| Admin nav default-allow                                   | High     | **Fixed**                                 |
| `notifications:read` unused                               | Medium   | **Fixed**                                 |
| Unrendered template vars (`{{subject}}`) in notifications | Low      | Open — compose flow should pass variables |
| Fine-grained page guards on all admin routes              | Medium   | Partial                                   |
| Shift/accountant/parent portal guards                     | Medium   | Not yet layout-wrapped                    |

---

## Verification checklist

After deploy + re-seed + user log out/in:

- [ ] Student clicks fee/certificate notification → lands on `/student/fees` or `/student/certificates`
- [ ] Student navigates to `/admin/communication` → **Access denied**
- [ ] Student notification list never returns `/admin/*` links
- [ ] HOD/admin retain access to authorized admin modules
- [ ] Communication API returns 403 for users without `communication:read`

---

## Files changed (security fix)

- `apps/api/.../communication-delivery.service.ts`
- `apps/api/.../user-notifications.service.ts`
- `apps/api/.../communication.controller.ts`
- `apps/api/.../portal-access.ts`, `notification-link.util.ts`
- `apps/web/app/admin/layout.tsx`
- `apps/web/app/staff/layout.tsx`
- `apps/web/app/access-denied/page.tsx`
- `apps/web/components/dashboard/notification-panel.tsx`
- `apps/web/lib/admin-nav-visibility.ts`
- `apps/web/lib/permissions/portal-access.ts`
- `apps/api/prisma/seed.ts` (`notifications:read` on student/faculty/staff/hod)
