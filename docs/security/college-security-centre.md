# College Security Centre

The Security Centre is a super-administrator tool for the college ERP. It records security events, raises alerts, and lets investigators read existing academic and finance audit tables. It does not replace module business rules.

Super-administrator roles are `super-admin`, `college-admin`, and `university-admin`. The API rejects every other role, including during impersonation. The menu item is hidden from other roles. The browser check is only a convenience; the NestJS `SuperAdminGuard` is the control that matters.

## Controls

| Control            | What it does                                                                                                                                                                                                                                                         | Limitation                                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in history    | Successful sign-in, failed sign-in, lockout, logout, password change, password reset, MFA change, new device, and expired refresh sessions are written to `platform.security_events`.                                                                                | A failure to write the event is logged and does not block sign-in.                                                                                                                                                                  |
| Account protection | Failed attempts are counted per tenant, address, and identifier. Defaults remain 8 failures in 20 minutes, then a 5 minute lock, then 15 minutes if the lock is repeated. Super administrators can change these bounds from Protection.                              | Limits are cached for up to 60 seconds. This slows password guessing; it does not stop a distributed attack.                                                                                                                        |
| Append-only events | PostgreSQL rejects `UPDATE` and `DELETE` on `security_events`. Alert titles, severity, and summaries are immutable. Acknowledgement changes only status fields.                                                                                                      | A database superuser can disable triggers or set `onecampus.allow_security_purge=on` for an explicit purge. The application has no delete API.                                                                                      |
| Hash chain         | Each event stores the SHA-256 of its payload plus the previous event hash. Integrity checks the latest 500 events.                                                                                                                                                   | A check of the latest window does not re-read the entire history. Timestamp precision differences can look like a break and should be investigated before they are treated as tampering.                                            |
| Threat rules       | Repeated failures, one address used against many accounts, permission-denial bursts, role changes, privileged account creation, bulk downloads, mass edits, backup deletion, file checksum changes, and new devices create alerts at Critical, High, Medium, or Low. | Rules are threshold detectors, not proof of an intrusion. The same rule and subject is suppressed for 15 minutes.                                                                                                                   |
| Notifications      | Open alerts can email and notify super administrators through the ERP notification inbox. Bodies contain the rule title and a short description.                                                                                                                     | Notices never include passwords, tokens, or student record values. Delivery depends on SMTP and the administrator's notification preference.                                                                                        |
| Sensitive changes  | The audit trail reads existing student, attendance, examination, fee, payroll, staff, permission, and platform audit tables, plus the new security events.                                                                                                           | Before/after values exist only where the source module already stored them. Credential-like fields are replaced with `[redacted]`. Payroll values are visible to super administrators in this screen and are not copied into email. |
| File watch         | Hourly checks, after protection settings are saved, hash `package.json`, `prisma/schema.prisma`, `src/main.ts`, and `src/app.module.ts` under `SECURITY_WATCH_ROOT` or the API working directory.                                                                    | The first scan records a baseline and does not alert. Accepting a new checksum is itself audited. This does not watch the whole server or container image.                                                                          |
| API gate           | Security Centre routes require the global JWT guard and `SuperAdminGuard`. Inputs use validation DTOs. Global rate limiting remains 300 requests per minute.                                                                                                         | Endpoints that do not declare `@RequirePermissions` are still authenticated, but any signed-in role can call them unless that module adds its own guard. Object ownership is enforced inside each module, not by this centre.       |
| Backup deletion    | Deleting a backup writes a critical security event for the backup's tenant. Instance backups with no tenant are reported to the first 20 active tenants.                                                                                                             | The file removal itself is still performed by the backup module. This centre detects and alerts; it does not add a second approval step.                                                                                            |

## API security posture already in the API

These controls were already present and were left in place:

- `JwtAuthGuard` is global. Routes opt out only with the public decorator.
- `PermissionsGuard` enforces `@RequirePermissions` on the server. Frontend menu checks are not trusted.
- `ValidationPipe` whitelists DTO fields and rejects unexpected ones.
- `AppThrottlerGuard` rate-limits the API.
- Helmet sets HSTS, `X-Frame-Options`, `nosniff`, and a strict referrer policy.
- Login responses and security notices do not add password hashes or refresh tokens to the new security trail.

A file-level inventory of the 178 NestJS controllers found 153 with a permission decorator and 40 with an explicit public route. Four controllers other than Security Centre declare neither: step-up, journal author, journal reviewer, and users. Those four remain behind the global JWT guard. Their object-level checks were not rewritten in this change.

A full route-by-route OWASP ASVS 5.0 review is a staging exercise. Use a staging copy of the database. Do not run destructive tests against production. Cover authentication, authorization, injection, XSS, CSRF, file upload, object-level access, and privilege changes. Record findings in the Security Centre audit trail rather than in student records.

## Operations

Apply the migration before opening the page:

`apps/api/prisma/migrations/20261107200000_security_centre/migration.sql`

The page is **System Administration → Administration → Security Centre**.

There is no administrator action that erases security events or alerts. Acknowledgement keeps the alert and adds an `ALERT_ACKNOWLEDGED` event.
