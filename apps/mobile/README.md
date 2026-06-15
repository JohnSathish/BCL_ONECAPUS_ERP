# OneCampus Mobile (Expo)

Student/staff shell for the OneCampus ERP mobile APIs.

## Quick start (Expo Go / dev server)

```powershell
cd apps/mobile
npm install
npm start
```

Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_TENANT_SLUG` in `.env`. On a physical device, use your PC LAN IP instead of `localhost`.

## Phase 2 screens

| Screen        | Route                      | API                                |
| ------------- | -------------------------- | ---------------------------------- |
| Fees          | `/(student)/fees`          | `/v1/fees/me/*`                    |
| Attendance    | `/(student)/attendance`    | `/v1/student-attendance/portal/me` |
| Notifications | `/(student)/notifications` | `/v1/communication/notifications`  |

`apiFetch` attaches the access token and refreshes on `401` via `POST /v1/auth/refresh` (mobile body tokens).

## Native Razorpay (EAS dev build)

`react-native-razorpay` does **not** work in Expo Go. Use a development build:

```powershell
cd apps/mobile
npm install
npx eas login
npx eas build --profile development --platform android
```

After installing the APK on your device:

```powershell
npm start
# press "a" or scan QR — opens in the dev client, not Expo Go
```

Fee checkout uses native Razorpay when `mode: LIVE` and keys are configured; otherwise `SAFE_MOCK` simulate or manual status poll.

## Scripts

| Command                     | Purpose                   |
| --------------------------- | ------------------------- |
| `npm start`                 | Metro on port **8082**    |
| `npm run typecheck`         | TypeScript check          |
| `npm run build:dev:android` | EAS development APK       |
| `npm run build:dev:ios`     | EAS development iOS build |

## Environment

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001/api
EXPO_PUBLIC_TENANT_SLUG=demo
```
