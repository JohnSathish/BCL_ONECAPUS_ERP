# Google Play — DBC Student app (v1.0)

Use this when creating the Play Console listing for the Don Bosco College Tura student mobile app.

**Package name:** `edu.onecampus.mobile`  
**Production API:** `https://erp.donboscocollege.ac.in/api`  
**Tenant slug:** `demo` (must match database seed)

---

## Store listing (English — India)

### App name (max 30 characters)

```
DBC Student
```

Alternative if you prefer full college name:

```
Don Bosco College Student
```

### Short description (max 80 characters)

```
Fees, attendance & notifications for Don Bosco College Tura students.
```

### Full description

```
DBC Student is the official mobile app for students of Don Bosco College, Tura.

Sign in with your college student account to:

• View and pay fees online (Razorpay)
• Check subject-wise attendance and shortfall alerts
• Read college notifications and mark them as read

Built on BCL OneCampus ERP. This v1 release focuses on everyday student needs. More features (timetable, results, library) will arrive in future updates.

Requirements:
• Active student account issued by the college
• Internet connection

Support: principaldbct@gmail.com
Privacy policy: https://donboscocollege.ac.in/mobile-privacy.html
```

### App category

- **Category:** Education
- **Tags (if prompted):** Education, College, Student

### Contact details

| Field              | Value                                             |
| ------------------ | ------------------------------------------------- |
| Email              | principaldbct@gmail.com                           |
| Website            | https://donboscocollege.ac.in                     |
| Privacy policy URL | https://donboscocollege.ac.in/mobile-privacy.html |

---

## Content rating questionnaire (typical answers)

| Question                              | Answer               |
| ------------------------------------- | -------------------- |
| Violence, sexual content, drugs, etc. | No                   |
| User-generated content                | No                   |
| Shares user location                  | No                   |
| Digital purchases                     | Yes (fee payments)   |
| Unrestricted internet                 | Yes (API + payments) |

Expected rating: **Everyone** or **PEGI 3 / rated for 3+** (no mature content).

---

## Data safety form

Declare the following (adjust if your live deployment differs):

### Data collected

| Data type                     | Collected | Shared        | Purpose                                     |
| ----------------------------- | --------- | ------------- | ------------------------------------------- |
| Email address                 | Yes       | No            | Account authentication                      |
| Name                          | Yes       | No            | Display student profile                     |
| User IDs                      | Yes       | No            | Session / device security                   |
| Financial info                | Yes       | With Razorpay | Fee payment processing                      |
| App activity (in-app actions) | Optional  | No            | Reliability (if you enable analytics later) |
| Device or other IDs           | Yes       | No            | Device registration, fraud prevention       |

### Security practices

- Data encrypted in transit (HTTPS)
- Users can request deletion via college administration
- Data is not sold to third parties

### Data deletion

Students should contact the college office to deactivate portal access or request data handling per institutional policy.

---

## Screenshots (recommended)

Capture on a phone with production or staging API:

1. **Login** — “OneCampus Student” sign-in screen
2. **Home** — Quick access cards (Fees, Attendance, Notifications)
3. **Fees** — Fee summary / pay flow (mask real student data)
4. **Attendance** — Subject-wise percentage view
5. **Notifications** — Inbox list

Minimum: **2 phone screenshots** (Play requirement). Provide 1080×1920 or 1080×2340 PNG/JPEG.

Optional: 7-inch tablet screenshots if you enable tablet support later.

---

## Feature graphic

1024×500 PNG — college logo + “DBC Student” + tagline “Fees · Attendance · Notifications”.

---

## Release checklist

1. Copy `apps/mobile/.env.production.example` → `.env` (or set EAS secrets).
2. Deploy `apps/web/public/mobile-privacy.html` to `https://donboscocollege.ac.in/mobile-privacy.html`.
3. Confirm API is live at `https://erp.donboscocollege.ac.in/api/v1/mobile-app/bootstrap?appType=student`.
4. Build: `cd apps/mobile && npm run build:prod:android`
5. Upload AAB to **Internal testing** first; test with a real student account.
6. Test fee payment on a physical device (Razorpay LIVE keys on server).
7. Promote to **Closed testing** → **Production** after verification.

### EAS secrets (optional, for cloud builds without local .env)

```powershell
cd apps/mobile
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://erp.donboscocollege.ac.in/api"
eas secret:create --scope project --name EXPO_PUBLIC_TENANT_SLUG --value "demo"
eas secret:create --scope project --name EXPO_PUBLIC_APP_NAME --value "DBC Student"
eas secret:create --scope project --name EXPO_PUBLIC_PRIVACY_POLICY_URL --value "https://donboscocollege.ac.in/mobile-privacy.html"
eas secret:create --scope project --name EXPO_PUBLIC_SUPPORT_EMAIL --value "principaldbct@gmail.com"
```

---

## What to tell Google reviewers (release notes / testing instructions)

```
Test account: Use a student demo account provided by the college administrator.

Steps:
1. Open app → Sign in with student email and password.
2. Complete the arithmetic challenge shown on screen.
3. Home shows Fees, Attendance, Notifications.
4. Fees → view balance; payment requires valid Razorpay configuration.

This app is for enrolled students of Don Bosco College Tura only.
Staff accounts are not supported in v1.
```

Provide a **real demo student** login in Play Console “App access” section (not committed to git).
