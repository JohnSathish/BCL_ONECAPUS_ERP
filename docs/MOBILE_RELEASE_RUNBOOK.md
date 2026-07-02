# Mobile Release Runbook (DBC Student)

## 0) Preconditions (one-time)

- Play Console app exists: `edu.onecampus.mobile`
- EAS project linked
- Service account JSON configured in `eas submit` (done once interactively)
- Privacy policy live: `https://donboscocollege.ac.in/mobile-privacy.html`

## 1) Set production env (`apps/mobile/.env`)

```env
EXPO_PUBLIC_API_URL=https://erp.donboscocollege.ac.in/api
EXPO_PUBLIC_TENANT_SLUG=demo
EXPO_PUBLIC_APP_NAME=DBC Student
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://donboscocollege.ac.in/mobile-privacy.html
EXPO_PUBLIC_SUPPORT_EMAIL=principaldbct@gmail.com
```

## 2) Validate before build

```powershell
cd apps/mobile
npm run typecheck
npx expo export:embed --eager --platform android --dev false
```

Both must pass.

## 3) Build production AAB

```powershell
npm run build:prod:android
```

- Wait for EAS completion.
- Copy build URL/artifact URL from output.

## 4) Submit to Play Internal Testing

First time / interactive:

```powershell
npx eas submit --platform android --profile production --latest
```

After credentials are saved:

```powershell
npx eas submit --platform android --profile production --latest --non-interactive
```

## 5) Play Console rollout

- Go to `Testing` -> `Internal testing`
- Verify new release artifact
- Add release notes (short)
- Roll out to testers

Suggested release note:

- "Initial DBC Student release: fees, attendance, notifications, login hardening, workspace stability."

## 6) Smoke test checklist (internal track)

- Login with student test account
- Home loads with 3 cards
- Attendance screen loads data
- Notifications list opens and mark-read works
- Fees screen loads and payment flow opens
- Logout works
- Relaunch app stays stable

## 7) Promote flow

- Internal -> Closed testing (small real user set)
- Monitor crashes/feedback 24-48h
- Then Production rollout (staged % recommended)

## 8) Rollback plan (if bad release)

- In Play Console, halt rollout
- Promote previous good release (or create hotfix build and push to internal first)
- Keep one known-good AAB reference in release notes/docs

## 9) Technical note

- Mobile is isolated from monorepo hoisting (root workspaces exclude `apps/mobile`) to prevent React Native version conflicts during Expo/EAS bundling.
