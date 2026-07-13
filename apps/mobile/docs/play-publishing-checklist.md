# Google Play — publishing checklist (edu.onecampus.mobile)

**App:** Don Bosco College, Tura / BCL OneCampus ERP  
**Package:** `edu.onecampus.mobile`  
**Version name:** `1.0.0` · **versionCode:** `14`  
**Target SDK:** **35** · minSdk **24** · compileSdk **35**  
**Last updated:** 13 July 2026

Use this list before clicking **Send for review**. Items marked **DONE** are implemented in the repo; **YOU** must complete in Play Console / EAS / marketing assets.

---

## A. Build & signing

| #   | Item                                                                       | Status                                                                          |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A1  | Production AAB via EAS (`npm run build:prod:android`)                      | **YOU** — preferred path                                                        |
| A2  | EAS managed Play upload key / Play App Signing enrolled                    | **YOU**                                                                         |
| A3  | Local AAB with upload keystore (`android/keystore.properties`)             | Optional — see `keystore.properties.example`                                    |
| A4  | Never upload debug-signed APK/AAB                                          | Enforced (Gradle fails without upload key unless `ALLOW_DEBUG_RELEASE_SIGNING`) |
| A5  | `google-services.json` present for FCM (EAS secret `GOOGLE_SERVICES_JSON`) | **YOU** — see `docs/firebase-setup.md`                                          |
| A6  | ProGuard / shrink resources enabled on release                             | **DONE**                                                                        |

---

## B. Store listing assets

| #   | Item                            | Spec                        | Status                                                                            |
| --- | ------------------------------- | --------------------------- | --------------------------------------------------------------------------------- |
| B1  | App icon                        | 512×512 PNG                 | Use `assets/bcl-onecampus-logo.png` / Play Console upload                         |
| B2  | Feature graphic                 | 1024×500                    | **DONE** draft: `assets/store/feature-graphic.png` (verify dimensions in Console) |
| B3  | Phone screenshots               | ≥2, preferably 1080×1920    | **YOU** — capture login, dashboard, fees, notifications                           |
| B4  | Tablet screenshots              | Optional                    | **YOU**                                                                           |
| B5  | Short / full description        | See `play-store-listing.md` | **DONE** copy                                                                     |
| B6  | Category: Education             |                             | **YOU** in Console                                                                |
| B7  | Contact email / website / phone | `play-store-listing.md`     | **YOU**                                                                           |

---

## C. Legal & privacy (mandatory)

| #   | Item                                | URL / path                                         | Status                                                                         |
| --- | ----------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| C1  | Privacy policy (public HTTPS)       | https://basecodelabs.com/privacy-policy.html       | Host & verify live                                                             |
| C2  | Terms & conditions                  | https://basecodelabs.com/terms-and-conditions.html | Host & verify live                                                             |
| C3  | Account deletion URL (Play Console) | https://basecodelabs.com/account-deletion.html     | **DONE** page in `apps/web/public/account-deletion.html` — deploy to same host |
| C4  | In-app Privacy / Terms links        | Profile screens                                    | **DONE**                                                                       |
| C5  | In-app **Delete account**           | Student + Staff Profile → Delete account           | **DONE**                                                                       |
| C6  | Data Safety form                    | Follow `docs/play-data-safety.md`                  | **YOU** in Console                                                             |

---

## D. Permissions & policy

| #   | Item                                                  | Status                           |
| --- | ----------------------------------------------------- | -------------------------------- |
| D1  | `POST_NOTIFICATIONS` justified (push)                 | **DONE**                         |
| D2  | `CAMERA` for QR login only                            | **DONE** + permission string     |
| D3  | Biometric optional unlock                             | **DONE**                         |
| D4  | `RECORD_AUDIO` removed (not used)                     | **DONE**                         |
| D5  | `SYSTEM_ALERT_WINDOW` removed from release            | **DONE** (debug manifest only)   |
| D6  | Declare Photo/Files use in Data Safety if picker used | Align with `play-data-safety.md` |
| D7  | No deceptive ads / gambling / UGC without moderation  | N/A campus ERP                   |

---

## E. Security & auth

| #   | Item                                    | Status                               |
| --- | --------------------------------------- | ------------------------------------ |
| E1  | JWT in SecureStore; refresh rotation    | **DONE**                             |
| E2  | Logout clears session + push unregister | **DONE**                             |
| E3  | HTTPS API only in production            | Verify `EXPO_PUBLIC_API_URL`         |
| E4  | Play Integrity / App Check              | Deferred — not blocking first submit |
| E5  | Crash reporting (Crashlytics/Sentry)    | Deferred — recommend Phase B         |
| E6  | Firebase Analytics                      | Deferred — first-party events only   |

---

## F. Notifications & deep links

| #   | Item                              | Status             |
| --- | --------------------------------- | ------------------ |
| F1  | FCM push with native device token | **DONE** code path |
| F2  | Notification preferences UI       | **DONE**           |
| F3  | Custom scheme `onecampus://`      | **DONE**           |
| F4  | Verified App Links (https)        | Optional Phase B   |

---

## G. Versioning & package

| Field              | Value                                                                |
| ------------------ | -------------------------------------------------------------------- |
| applicationId      | `edu.onecampus.mobile`                                               |
| versionName        | `1.0.0`                                                              |
| versionCode        | `14`                                                                 |
| Launcher name      | Don Bosco College, Tura (`EXPO_PUBLIC_APP_NAME`)                     |
| Play listing title | BCL OneCampus ERP (≤30 chars) — keep consistent with branding choice |

Bump `versionCode` on every Play upload (Expo `app.config.ts` + `android/app/build.gradle`).

---

## H. Pre-submit smoke test

1. Fresh install from internal testing track
2. Login (student + staff)
3. Grant notification permission; receive test push
4. Fees / attendance / notifications open
5. Privacy, Terms, Delete account screens open
6. Logout clears session
7. App does not request microphone or draw-over-apps
8. Crash-free for 15 minutes of navigation

---

## I. Play Console steps (order)

1. Create app → package `edu.onecampus.mobile`
2. Set up Play App Signing
3. Upload AAB to **Internal testing** first
4. Complete Store listing + Feature graphic + screenshots
5. Complete **Data safety** (`docs/play-data-safety.md`)
6. Complete **App content**: Privacy policy URL, Account deletion URL
7. Target audience / News apps / COVID / Data protection questionnaires
8. Countries: India (expand as needed)
9. Promote Internal → Closed → Production when stable

---

## J. Known non-blockers (Phase B)

- Firebase Crashlytics + Analytics
- Play Integrity API / App Check
- HTTPS App Links + `assetlinks.json`
- OCR / advanced AI features

---

## Quick commands

```bash
cd apps/mobile
# Production AAB (Play) — recommended
npm run build:prod:android
npm run submit:android

# Local AAB (needs upload keystore)
npm run build:aab

# Local smoke APK (debug signing allowed)
npm run build:apk
```
