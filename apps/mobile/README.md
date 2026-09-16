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

## School SIS (St. Luke’s / secondary school ERP)

The same Expo app switches to the school product after you pick **St. Luke's Secondary School** (or set `EXPO_PUBLIC_TENANT_SLUG=st-lukes-tura`). College student/staff/principal stacks are unchanged.

### Local development

1. Run the Nest API (`apps/api`) so `/api/v1/school-mobile/bootstrap` answers for tenant `st-lukes-tura`.
2. Copy `apps/mobile/.env.development` and set `EXPO_PUBLIC_API_URL` to your PC LAN IP (not `localhost`) when using a physical phone, e.g. `http://192.168.1.23:3001/api`.
3. Install and start:

```powershell
cd apps/mobile
npm install
npx expo start --port 8082
```

Android: `npx expo run:android` (dev client) or scan the QR from Expo Go if native modules match.  
iOS: `npx expo run:ios` on macOS.

### Login (school product)

School login uses `POST /v1/school-mobile/login` (admission number, email, or username + password). Captcha is skipped on the school product. Tokens stay in **expo-secure-store**.

Demo accounts (never production):

| Role    | Identifier                                | Password     |
| ------- | ----------------------------------------- | ------------ |
| Student | `student@stlukestura.in` or admission no. | `StLuke@123` |
| Parent  | `parent@stlukestura.in`                   | `StLuke@123` |
| Teacher | `teacher@stlukestura.in`                  | `StLuke@123` |
| Admin   | `admin@stlukestura.in`                    | `StLuke@123` |

RBAC: dashboards and tabs come from `school-mobile:*` / `school-sis:*` permissions. Payroll, HR, and user admin are hidden from students/parents. APIs still authorize independently.

### Push / Firebase

Android FCM: `apps/mobile/google-services.json`. iOS APNs: `GoogleService-Info.plist`. School devices register at `POST /v1/school-mobile/devices/register`. Deep links: `schoolerp://fees`, `schoolerp://attendance`, `schoolerp://notification/…`.

### Troubleshooting

| Symptom                          | Check                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Login 400 whitelist              | Body is only `identifier`, `password`, `deviceId`, `rememberMe`                |
| Cannot reach API from phone      | LAN IP + same Wi-Fi, Windows firewall allows 3001                              |
| College captcha on school tenant | Select St. Luke’s in the institution picker                                    |
| Wrong dashboard                  | JWT permissions must include `school-mobile:student` / parent / staff / manage |
