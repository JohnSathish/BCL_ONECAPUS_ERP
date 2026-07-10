# Firebase setup — BCL OneCampus ERP (Android)

Use this checklist to connect the Expo mobile app and Nest API to Firebase Cloud Messaging.

## 1. Create the Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Create project **BCL OneCampus ERP** (or rename an existing project).
3. Google Analytics can stay disabled for Phase A (enable later for Crashlytics / Analytics).

## 2. Register the Android app

1. Add an Android app with package name: `edu.onecampus.mobile`
2. Download `google-services.json`
3. Place it at:

```
apps/mobile/google-services.json
```

This file is gitignored. Do not commit production keys.

4. Confirm `app.config.ts` points at `./google-services.json` (`android.googleServicesFile`).
5. Keep the file gitignored, but ensure [`.easignore`](../.easignore) **allows** it into EAS cloud builds (required for real FCM tokens).

## 3. Enable Cloud Messaging

1. Project settings → Cloud Messaging
2. Ensure Cloud Messaging API (V1) is enabled in Google Cloud for the same project
3. Phase A only needs FCM. Defer Analytics, Crashlytics, Performance, Remote Config, App Check.

## 4. Service account for the Nest API

The API sends pushes via FCM HTTP v1 ([`fcm-push.service.ts`](../../api/src/modules/communication/services/fcm-push.service.ts)).

1. Google Cloud Console → IAM → Service Accounts → create (or use Firebase Admin SDK account)
2. Grant **Firebase Cloud Messaging Admin** (or equivalent messaging send role)
3. Create a JSON key and set API env:

```env
FCM_DEMO_MODE=false
FCM_PROJECT_ID=your-firebase-project-id
FCM_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

For local smoke tests without Firebase, set `FCM_DEMO_MODE=true` (logs instead of sending).

## 5. Expo / EAS

1. Install deps in `apps/mobile` (`expo-notifications`, `expo-device`)
2. Use a **development** or **preview/production** EAS build (not Expo Go) for real FCM tokens
3. EAS project id is already in `app.config.ts` → `extra.eas.projectId`
4. Upload `google-services.json` as an EAS file secret if building in the cloud:

```powershell
cd apps/mobile
eas secret:create --scope project --type file --name GOOGLE_SERVICES_JSON --value ./google-services.json
```

Wire the file into the build profile if your EAS workflow expects a copied path (see Expo docs for `googleServicesFile`).

## 6. Verify end-to-end

1. Install a preview/dev-client build on a physical Android device (or emulator with Google Play)
2. Sign in → accept notification permission (Android 13+)
3. Confirm `platform.mobile_devices.push_token` is populated for the user
4. Admin → Communication → Push → Compose with channel **PUSH** → send to yourself
5. Confirm delivery in foreground, background, and killed states
6. Tap notification → correct deep link screen opens

### Localhost real-device checklist

```env
# apps/api/.env — must match Firebase project in google-services.json
FCM_DEMO_MODE=false
FCM_PROJECT_ID=bcl-onecampus-erp
FCM_CLIENT_EMAIL=firebase-adminsdk-...@bcl-onecampus-erp.iam.gserviceaccount.com
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
APP_PUBLIC_URL=http://127.0.0.1:3001
```

1. Restart the API after changing FCM env.
2. Phone and PC on the same Wi‑Fi; set mobile school API URL to your LAN IP (e.g. `http://192.168.x.x:3001/api`), not `localhost`.
3. Rebuild a **preview** APK **with** `google-services.json` present (EAS file secret if cloud build). Expo Go cannot register real FCM tokens.
4. Sign in on the phone → allow notifications.
5. Run `node apps/api/scripts/check-push-devices.mjs` — `withToken` must be > 0.
6. Push Center should show **Connected** (not Demo mode) and active devices > 0.
7. Compose a PUSH to yourself and confirm the phone receives it.

Quick DB check:

```powershell
cd apps/api
node scripts/check-push-devices.mjs
```

## 7. Phase B (deferred)

- Firebase Analytics
- Crashlytics
- Performance Monitoring
- Remote Config
- App Check / In-App Messaging
