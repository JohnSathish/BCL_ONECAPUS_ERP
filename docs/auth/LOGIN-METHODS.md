# Alternate login methods (QR, RFID, biometric, future SSO)

This document describes operator-facing behaviour for non-password login on BCL OneCampus.

## Tenant toggles

Configured on `TenantSecuritySettings` (per institution):

| Flag                  | Default | Meaning                                                                                                                                                              |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allowBiometricLogin` | `true`  | Mobile may offer device biometric unlock for an **already established** session (local OS biometrics + refresh token). This is not server-side fingerprint matching. |
| `allowQrLogin`        | `false` | Enables QR challenge issue/redeem.                                                                                                                                   |
| `allowRfidLogin`      | `false` | Enables RFID / card UID redeem.                                                                                                                                      |

Exposed to clients via `GET /v1/auth/context` → `loginMethods`.

## Biometric meaning

**Biometric login** in the mobile app means:

1. User previously signed in with password (or QR/RFID) and a refresh session exists on the device.
2. The OS biometric prompt unlocks the locally stored refresh token.
3. The app refreshes access tokens and opens the portal.

It does **not** compare campus biometric device templates on the server for portal login. Staff attendance biometric sync (`StaffProfile.biometricId`) is a separate feature.

## QR login (Phase 2)

### Flow

1. Student (or staff) signs in on the **web** portal.
2. Opens **Settings → Show login QR** (`/student/settings/login-qr`).
3. Web calls `POST /v1/auth/qr/issue` (JWT required, `allowQrLogin` must be on).
4. API stores a **SHA-256 hash** of a one-time token; TTL ≈ **5 minutes**.
5. Mobile (or another client) scans/pastes the code and calls `POST /v1/auth/qr/redeem` with `{ token }`.
6. Token is validated (hash match, not expired, not redeemed), then marked redeemed once and a normal session is issued.

### Payload (QR content)

The QR encodes a JSON payload (not a password), for example:

```json
{
  "type": "onecampus.auth.qr",
  "v": 1,
  "token": "<opaque>",
  "expiresAt": "2026-07-12T12:00:00.000Z"
}
```

Redeem accepts either the raw `token` string or the full JSON string (token is extracted).

### Security notes

- One-time use; concurrent redeem races lose after the first successful claim.
- Issue requires an authenticated session for the target user.
- Audit: `auditLog` action `auth.login` with `metadata.method = "qr"`, plus `AuthLoginEvent`.

## RFID login (Phase 3)

### Mapping

Within the tenant:

1. **Student** — `Student.rfidNumber` (unique per tenant when set).
2. **Staff** — `StaffProfile.rfidNo` → `portalUserId`.

Card UID is normalised (trim / case-insensitive match). Desk and testing clients may send `{ cardUid }` without NFC hardware.

### Flow

1. Tenant enables `allowRfidLogin`.
2. Client calls public `POST /v1/auth/rfid/redeem` with `{ cardUid }`.
3. On match, session issued; audit method `rfid`.
4. Unknown cards write a failed `AuthLoginEvent` and return 401.

Mobile provides manual Card UID entry when `react-native-nfc-manager` is not present; NFC is attempted via dynamic `require` only if installed.

## Session issuance hook

`AuthService.loginWithAlternateMethod(tenantId, userId, method, meta)`:

- Loads active user for tenant.
- Issues the same access/refresh tokens as password login (`issueTokens`).
- Skips password and MFA (caller already proved presence via QR possession or physical card).
- Writes `auditLog` + `AuthLoginEvent` with `method`: `qr` | `rfid` | `biometric_unlock`.

## Session / password policy knobs

| Setting                                                                      | Behaviour                                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `sessionTimeoutMinutes`                                                      | Caps access-token TTL and (when Remember me is off) refresh TTL.          |
| `passwordExpiryDays`                                                         | After N days since `passwordChangedAt`, login forces `mustResetPassword`. |
| `requireUppercase` / `requireLowercase` / `requireNumber` / `requireSpecial` | Password complexity flags used by `PasswordPolicyService`.                |
| `maxConcurrentSessions`                                                      | Oldest refresh sessions are revoked when a new one would exceed the cap.  |

## Per-attempt audit

Beyond aggregate `LoginAttempt` (lockout counters), `AuthLoginEvent` stores success / failure / lockout rows with `method` (`password`, `biometric_unlock`, `qr`, `rfid`). Admin → Security → Login History shows method on audit log entries.

## CAPTCHA / challenge

Password login still requires the math challenge. After repeated failures the account/IP is locked (`LoginAttempt`). Optional Turnstile / CAPTCHA escalation is not wired yet; keep the math challenge as the primary bot friction.

## Future SSO / passkeys (stubs)

`UserIdentity` (`provider`, `providerUserId`, optional `metadata`) is the intended link table for:

- Microsoft / Google OIDC (`provider` = `microsoft` / `google`)
- Passkeys / WebAuthn (`provider` = `webauthn`)

No redeem endpoints yet. Operators should keep SSO disabled in the mobile chooser until identity linking and IdP configuration exist.

## API summary

| Method | Path                   | Auth                 | Notes                                                               |
| ------ | ---------------------- | -------------------- | ------------------------------------------------------------------- |
| POST   | `/v1/auth/qr/issue`    | JWT                  | Returns `{ token, expiresAt, payload, qrDataUrl? }`                 |
| POST   | `/v1/auth/qr/redeem`   | Public + tenant host | Body `{ token }` → session                                          |
| POST   | `/v1/auth/rfid/redeem` | Public + tenant host | Body `{ cardUid }` → session                                        |
| GET    | `/v1/auth/context`     | Public               | Includes `loginMethods` flags                                       |
| POST   | `/v1/auth/refresh`     | Public + refresh     | Optional `unlockMethod: "biometric_unlock"` audits biometric unlock |
