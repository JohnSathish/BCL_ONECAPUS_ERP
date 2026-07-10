# Persistent login & session (mobile)

## Launch flow

Splash → school configured? → silent `POST /v1/auth/refresh` → dashboard.  
If refresh fails (revoked/expired) → login with “Your session has expired.”  
If offline but tokens exist locally → open cached dashboard.

## Secure storage

Tokens and user snapshot live in **expo-secure-store** (Android Keystore-backed).  
Institution config (`oc_school_config`) and device id survive logout.

## API env (Nest)

| Variable                   | Default | Purpose                               |
| -------------------------- | ------- | ------------------------------------- |
| `JWT_ACCESS_TTL`           | `1200s` | Access token lifetime                 |
| `JWT_REFRESH_TTL`          | `7d`    | Refresh when Remember me is off       |
| `JWT_REFRESH_TTL_REMEMBER` | `30d`   | Refresh when Remember me is on        |
| `REFRESH_REUSE_GRACE_MS`   | `10000` | Grace for concurrent refresh rotation |

`rememberMe` is stored on `RefreshSession.metadata` and reapplied on every refresh rotation.

## Logout

Mobile calls `POST /v1/auth/logout` with the refresh token, unregisters the push device, then clears local SecureStore tokens (school kept).
