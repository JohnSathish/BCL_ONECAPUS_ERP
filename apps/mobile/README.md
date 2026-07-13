# OneCampus Mobile (Expo)

Student mobile app for fees, attendance, and notifications.

## Quick start (Expo Go / dev server)

```powershell
cd apps/mobile
npm install
npm start
```

## Universal multi-institution mode

See [docs/universal-app.md](docs/universal-app.md). One Play app can connect to many isolated ERP servers via the institution picker. Publish `onecampus-schools.json` and set `EXPO_PUBLIC_SCHOOL_REGISTRY_URL`.

For local dev without the picker, set `EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_TENANT_SLUG` in `.env`.

## Environment

Set `EXPO_PUBLIC_SCHOOL_REGISTRY_URL` (universal) or `EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_TENANT_SLUG` (single-college build), and `EXPO_PUBLIC_PRIVACY_POLICY_URL` in `.env`. On a physical device, use your PC LAN IP instead of `localhost`.

Example privacy URL when web is deployed:

```
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://your-college-domain.edu/mobile-privacy.html
```

## v1 screens

| Screen        | Route                      | API                                |
| ------------- | -------------------------- | ---------------------------------- |
| Fees          | `/(student)/fees`          | `/v1/fees/me/*`                    |
| Attendance    | `/(student)/attendance`    | `/v1/student-attendance/portal/me` |
| Notifications | `/(student)/notifications` | `/v1/communication/notifications`  |

Staff portal login is disabled in v1 (student-only Play release).

## Google Play release (production AAB)

**Primary checklist:** [`docs/play-publishing-checklist.md`](docs/play-publishing-checklist.md)  
Also: [`play-store-listing.md`](play-store-listing.md), [`docs/play-data-safety.md`](docs/play-data-safety.md), [`docs/firebase-setup.md`](docs/firebase-setup.md).

1. Copy `.env.production.example` → `.env` with production API URL, tenant slug, and privacy / account-deletion URLs.
2. Deploy `apps/web/public/privacy-policy.html`, `terms-and-conditions.html`, and **`account-deletion.html`** to your public HTTPS host.
3. Ensure EAS secret `GOOGLE_SERVICES_JSON` (or local `google-services.json`) for FCM.
4. Log in to EAS: `npx eas login`
5. Build production Android bundle:

```powershell
npm run build:prod:android
```

6. Submit to Play internal track:

```powershell
npm run submit:android
```

Production builds **exclude** `expo-dev-client`. Use `npm run build:dev:android` for Razorpay native testing.
Local AAB (upload keystore required): `npm run build:aab`.

## Native Razorpay (EAS dev build)

`react-native-razorpay` does **not** work in Expo Go. Use a development build:

```powershell
npm run build:dev:android
```

After installing the APK on your device:

```powershell
npm start
```

Fee checkout uses native Razorpay when `mode: LIVE` and keys are configured; otherwise `SAFE_MOCK` simulate or manual status poll.

## Scripts

| Command                         | Purpose                           |
| ------------------------------- | --------------------------------- |
| `npm start`                     | Metro on port **8082**            |
| `npm run typecheck`             | TypeScript check                  |
| `npm run build:dev:android`     | EAS development APK (dev client)  |
| `npm run build:preview:android` | Internal preview APK              |
| `npm run build:prod:android`    | Production AAB for Google Play    |
| `npm run build:aab`             | Local AAB (upload keystore)       |
| `npm run build:apk`             | Local release APK (debug sign OK) |
| `npm run submit:android`        | Submit latest AAB to Play         |

## Environment

```
EXPO_PUBLIC_API_URL=https://erp.donboscocollege.ac.in/api
EXPO_PUBLIC_TENANT_SLUG=demo
EXPO_PUBLIC_APP_NAME=DBC Student
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://donboscocollege.ac.in/mobile-privacy.html
EXPO_PUBLIC_SUPPORT_EMAIL=principaldbct@gmail.com
```
