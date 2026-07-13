# Google Play — BCL OneCampus ERP (v1.0.0)

**Application name:** BCL OneCampus ERP  
**Package name:** `edu.onecampus.mobile`  
**Version:** 1.0.0 (`versionCode` **14**)  
**Target SDK:** 35  
**Developer:** BaseCode Labs Pvt. Ltd.

See also:

- [docs/play-publishing-checklist.md](docs/play-publishing-checklist.md) — **final submission checklist**
- [docs/firebase-setup.md](docs/firebase-setup.md) — Firebase / FCM Console steps
- [docs/play-data-safety.md](docs/play-data-safety.md) — Data Safety form answers

---

## Store listing (English — India)

### App name (max 30 characters)

```
BCL OneCampus ERP
```

### Short description (max 80 characters)

```
College ERP for students & staff — fees, attendance, classes & alerts.
```

### Full description

```
BCL OneCampus ERP is the official mobile companion for institutions running BaseCode Labs OneCampus.

Students can:
• View and pay fees online
• Check attendance and academic alerts
• Read notifications and circulars
• Access timetable, results, leave, and library features as enabled by the college

Faculty and staff can:
• View today’s classes and weekly timetable
• Mark attendance and enter internal marks
• Apply for leave and view payslips
• Receive push alerts for duties, circulars, and reminders

Built for multi-institution deployments with secure JWT login, encrypted local session storage, and Firebase Cloud Messaging for push notifications.

Requirements:
• Active student or staff account issued by your institution
• Internet connection
• Android 8.0+ recommended (notification permission on Android 13+)

Support: contact@basecodelabs.com
Website: https://basecodelabs.com
Privacy policy: https://basecodelabs.com/privacy-policy.html
Terms: https://basecodelabs.com/terms-and-conditions.html
```

### Keywords / tags

Education, College ERP, Fees, Attendance, Faculty, Student Portal, Notifications

### Feature list (Play highlights)

- Secure campus login
- Fee dues & payments
- Attendance & academic alerts
- Faculty timetable, attendance, marks
- Push notifications with preferences
- In-app notification center
- Privacy policy & terms in-app

### Category

Education

### Contact

| Field              | Value                                              |
| ------------------ | -------------------------------------------------- |
| Email              | contact@basecodelabs.com                           |
| Phone              | +91 95663 63655                                    |
| Website            | https://basecodelabs.com                           |
| Privacy policy URL | https://basecodelabs.com/privacy-policy.html       |
| Terms URL          | https://basecodelabs.com/terms-and-conditions.html |
| Account deletion   | https://basecodelabs.com/account-deletion.html     |

Institution-specific builds may override privacy URL via `EXPO_PUBLIC_PRIVACY_POLICY_URL`.

---

## Required assets (prepare outside repo or add under `assets/store/`)

| Asset              | Spec                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| App icon           | 512×512 PNG                                                             |
| Adaptive icon      | Already configured in `app.config.ts`                                   |
| Splash             | Configured (`splash-solid.png`)                                         |
| Feature graphic    | 1024×500 PNG — `assets/store/feature-graphic.png`                       |
| Phone screenshots  | Min 2 (1080×1920 or similar) — capture into `assets/store/screenshots/` |
| Tablet screenshots | Optional                                                                |

---

## Data safety

Use [docs/play-data-safety.md](docs/play-data-safety.md). Summary:

- Collects name, email, user IDs, device IDs, academic/fee data as needed for ERP
- Shared with payment gateway only for fee payments
- Encrypted in transit (HTTPS); tokens in secure storage
- Not sold
- Users can disable push categories in-app

---

## Runtime permissions

| Permission                           | When                                                |
| ------------------------------------ | --------------------------------------------------- |
| Notifications (`POST_NOTIFICATIONS`) | After login / first push registration (Android 13+) |
| Internet                             | Always (API)                                        |
| Camera (QR login)                    | When scanning login QR codes                        |
| Biometric                            | Optional unlock after first login                   |
| Microphone / overlay                 | Not requested (blocked)                             |

---

## Pre-publish testing checklist

- [ ] Firebase project connected; `google-services.json` present for EAS/production builds
- [ ] Push received in foreground, background, and terminated states
- [ ] Android 13+ notification permission prompt works
- [ ] Deep links open fees / attendance / results / timetable / staff screens
- [ ] PUSH preferences skip disabled categories
- [ ] Notification Center: read, unread, archive, delete, search
- [ ] Admin Push Center → Compose with PUSH channel
- [ ] Privacy Policy, Terms, About, **Delete account** screens accessible
- [ ] Account deletion URL live: https://basecodelabs.com/account-deletion.html
- [ ] Release AAB installs and login works against production API
- [ ] No critical crashes on smoke paths (login, home, fees, notifications)
- [ ] targetSdk 35 build uploaded to Internal testing

---

## Release commands

```powershell
cd apps/mobile
# Place google-services.json, set .env / EAS secrets
npm run build:prod:android
npm run submit:android
```

### EAS secrets (example)

```powershell
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://your-api.example/api"
eas secret:create --scope project --name EXPO_PUBLIC_TENANT_SLUG --value "your-tenant"
eas secret:create --scope project --name EXPO_PUBLIC_APP_NAME --value "BCL OneCampus ERP"
eas secret:create --scope project --name EXPO_PUBLIC_PRIVACY_POLICY_URL --value "https://basecodelabs.com/privacy-policy.html"
eas secret:create --scope project --name EXPO_PUBLIC_TERMS_URL --value "https://basecodelabs.com/terms-and-conditions.html"
eas secret:create --scope project --name EXPO_PUBLIC_SUPPORT_EMAIL --value "contact@basecodelabs.com"
```

---

## Reviewer notes

```
Provide a demo student and/or staff account in Play Console App access.

Steps:
1. Sign in with the demo account and complete the arithmetic challenge.
2. Student: open Fees, Attendance, Notifications.
3. Staff: open Dashboard, Timetable, Notifications.
4. Profile → Notification preferences / About / Privacy / Terms / **Delete account**.

Push notifications require a production/dev-client build with Firebase google-services.json (not Expo Go).
```
