# Google Play — Data Safety (BCL OneCampus ERP)

Use these answers when completing Play Console → App content → Data safety.

**Package:** `edu.onecampus.mobile`  
**App name:** BCL OneCampus ERP

## Does your app collect or share user data?

**Yes** — collected for account, academics, fees, and device security. **Not sold.** Shared only with payment processors when the user pays fees.

## Data collected

| Data type                     | Collected                                              | Shared                                                    | Optional | Purpose                              |
| ----------------------------- | ------------------------------------------------------ | --------------------------------------------------------- | -------- | ------------------------------------ |
| Name                          | Yes                                                    | No                                                        | No       | Profile display, campus records      |
| Email                         | Yes                                                    | No                                                        | No       | Authentication, account recovery     |
| Phone number                  | Yes (if on record)                                     | No                                                        | Yes      | Support / OTP (future)               |
| User IDs                      | Yes                                                    | No                                                        | No       | Session, multi-device security       |
| Device or other IDs           | Yes                                                    | No (FCM token used only to deliver pushes via Google FCM) | No       | Push notifications, fraud prevention |
| App activity                  | Yes (screen / login / push open events to college ERP) | No                                                        | Yes      | Reliability, product improvement     |
| Financial info                | Yes (fee dues / payment status)                        | With Razorpay (or configured gateway)                     | No       | Fee payment                          |
| Photos                        | Yes (profile / document upload when user chooses)      | No                                                        | Yes      | Profile & verification               |
| Attendance / academic records | Yes                                                    | No                                                        | No       | Core ERP features                    |

## Why data is collected

- Provide authenticated student and staff ERP features
- Deliver in-app and push notifications the user opted into
- Process fee payments
- Secure sessions across devices

## Protection

- HTTPS only for API traffic
- JWT access + refresh tokens; refresh rotation
- Credentials and tokens in encrypted device storage (`expo-secure-store`)
- Role-based permissions on the server
- No sale of personal information

## Data deletion / account

- **In-app:** Profile → **Delete account** (student and staff). Submits a deletion request to the college ERP and/or emails support.
- **Web URL (Play Console):** https://basecodelabs.com/account-deletion.html
- Accounts are institution-managed. Academic / fee records may be retained under institutional and legal retention policies. Login access is deactivated after the institution processes the request.
- Email: contact@basecodelabs.com

## Notifications

- Push requires runtime permission (Android 13+)
- Users can disable categories in-app (fee, attendance, examination, etc.)
- OS-level notification settings still apply

## Encryption

- In transit: TLS
- At rest on device: OS-backed secure storage for tokens
- Server: institution-hosted database with access controls

## Reviewer notes

Provide a demo student (and optionally staff) account in Play Console App access. Do not commit credentials to git.
