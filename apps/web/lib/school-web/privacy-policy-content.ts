export type PrivacySection = { heading: string; paragraphs: string[] };

export const ST_LUKES_PRIVACY_POLICY_PATH = '/privacy-policy';
export const ST_LUKES_PRIVACY_POLICY_URL = 'https://stlukestura.in/privacy-policy';
export const ST_LUKES_PRIVACY_POLICY_UPDATED = '19 September 2026';
export const ST_LUKES_PRIVACY_POLICY_TITLE = 'Privacy Policy | St. Luke’s Secondary School, Tura';
export const ST_LUKES_PRIVACY_POLICY_DESCRIPTION =
  'How St. Luke’s Secondary School, Tura collects, uses, shares and protects information in the official school website and St. Luke’s School Android app, including account login, messages and push notifications.';

export const ST_LUKES_PRIVACY_POLICY_SECTIONS: PrivacySection[] = [
  {
    heading: 'Who we are',
    paragraphs: [
      'This Privacy Policy is for St. Luke’s Secondary School, Walbakgre, P.O. Dakopgre, Tura – 794101, West Garo Hills, Meghalaya, India (“the School”, “we”, “us”). It covers the public website at https://stlukestura.in, the school ERP at https://erp.stlukestura.in, and the official St. Luke’s School mobile app (Android package in.stlukestura.school).',
      'The School is the data controller for school records and app accounts. BaseCode Labs Pvt. Ltd. hosts and maintains the software as a data processor on the School’s instructions. This policy is written so families, staff and Google Play users can see what the app and website do with personal information.',
      `Last updated: ${ST_LUKES_PRIVACY_POLICY_UPDATED}.`,
    ],
  },
  {
    heading: 'Who this app is for',
    paragraphs: [
      'The St. Luke’s School app is an institutional school app. It is only for people the School has given an account: typically staff, and where enabled, parents or guardians. It is not a public social network, not an advertising product, and not a children’s game or entertainment app.',
      'You cannot create a Play Store self-signup account. Login uses a username or staff identifier issued by the School. If you do not have a school account, do not install the app for personal use.',
    ],
  },
  {
    heading: 'Information we collect',
    paragraphs: [
      'Account and profile: name, login identifier, role (for example staff), contact details the School already holds, and profile information you can see in the app after sign-in.',
      'Authentication: password you type at login (sent securely to the server; the app does not keep your password after login), session tokens, optional device PIN or biometric unlock stored only on your phone, and a device identifier used to recognise this installation.',
      'School operations in the app: messages and notices sent to your account, notification history, and other school records the office has enabled for your role (for example attendance, reports or child/guardian links where the School uses them).',
      'Device and app technical data: app version, operating system (Android/iOS), device model or label, and push-notification token so we can deliver alerts.',
      'Website: pages you visit on stlukestura.in, standard server logs (which may include IP address, browser type and time), contact-form fields if you write to the office, and an optional on-site visitor counter. The public website does not require an account.',
    ],
  },
  {
    heading: 'How we collect it',
    paragraphs: [
      'You provide some data directly: login, contact-form messages, and any profile details you submit.',
      'The School already holds pupil and staff records in the school ERP. The app shows those records only after a successful authorised login.',
      'The app and servers collect some data automatically: device identifier, push token, app version, and security logs of sign-in attempts.',
      'We do not scrape your phone contacts, photos, microphone or location for this app. Photo-library permission, if shown by the operating system, is used only if you choose to share an image. Face ID / fingerprint stay on the device and are not uploaded to the School.',
    ],
  },
  {
    heading: 'How we use information',
    paragraphs: [
      'To sign you in and keep your session secure, including optional lock-screen or biometric unlock on the device.',
      'To show school messages, notices and other features your account is allowed to use.',
      'To send push notifications (for example a new message) and to open the correct screen when you tap a notification.',
      'To operate, secure and improve the website, ERP and app, including preventing abuse and diagnosing faults.',
      'To contact you about school business when you write to the office or when your role requires operational messages.',
      'We do not use this information to show third-party advertisements, to build advertising profiles, or to sell lists of users.',
    ],
  },
  {
    heading: 'Push notifications',
    paragraphs: [
      'If you allow notifications, the app registers a device token with Firebase Cloud Messaging (Google LLC) so the School can send alerts to that device. You can turn notifications off in Android settings at any time. Turning them off does not delete your school account.',
    ],
  },
  {
    heading: 'Sharing and third parties',
    paragraphs: [
      'We do not sell personal information.',
      'We share information only as needed to run the service: (1) authorised school staff who need it for their duties; (2) BaseCode Labs Pvt. Ltd. as software host and processor; (3) Google LLC / Firebase for push delivery; (4) our hosting and email providers that process data on our instructions; (5) law enforcement or regulators if Indian law requires it.',
      'Payment gateways are used only if the School enables online fees in a given year and you make a payment. This listing of the staff/school app does not by itself send card data to Google Play.',
    ],
  },
  {
    heading: 'Children and pupil records',
    paragraphs: [
      'St. Luke’s educates children, including pupils under 13. Pupil academic and administrative records are processed by the School as an educational institution, not for marketing to children.',
      'The mobile app is aimed at authorised adult users (staff and, where enabled, parents/guardians). We do not knowingly allow a child to create an independent consumer account in the Play Store app. We do not use pupil or family data for advertising, and we do not sell children’s information.',
      'Parents or guardians who want to know what records the School holds, or to request a correction, should contact the school office. The printed school handbook still governs ordinary parent communication.',
    ],
  },
  {
    heading: 'Security',
    paragraphs: [
      'Login and API traffic use HTTPS. Session tokens on the phone are stored in the device secure store, not in ordinary app settings. Passwords are not stored in the app after you sign in. School servers restrict access by account and role.',
      'No method of transmission or storage is perfectly secure. Please keep your password private, lock your phone, and tell the office if you think an account was misused.',
    ],
  },
  {
    heading: 'How long we keep data',
    paragraphs: [
      'School records (staff and pupil files, messages needed for school administration) are kept for as long as the School needs them for education, administration, legal or archive duties.',
      'App session tokens and push tokens are kept while the account or device remains active, and are removed or overwritten when you sign out, when the office disables the account, or when a device is unregistered.',
      'Website server logs are kept only for a limited operational period unless a security incident requires longer review.',
    ],
  },
  {
    heading: 'Your choices, access and deletion',
    paragraphs: [
      'You may request access to, or correction of, personal information the School holds about you by writing to the office.',
      'To stop using the app, sign out and uninstall it. That does not by itself delete school employment or pupil records.',
      'To delete or disable your St. Luke’s School app login, email admin@stlukestura.in with the subject “Delete my St. Luke’s School app account”, from the mailbox we have on file, and include your full name and login identifier. The office will disable mobile access. Statutory school records may still be kept as Indian education and employment rules require.',
      'Google Play users can also use the Play Store account-deletion / data-request path where Google provides one; the School still needs the email above to match the school login.',
    ],
  },
  {
    heading: 'Permissions the Android app may ask for',
    paragraphs: [
      'Internet — to sign in and load school data.',
      'Notifications — to alert you about messages and notices (optional; you can refuse).',
      'Biometric / screen lock — optional, stored on the device only.',
      'Boot completed / vibrate — so notifications can work after a device restart, as Android requires for reliable alerts.',
      'The app blocks microphone recording and system-alert overlay permissions.',
    ],
  },
  {
    heading: 'International processing',
    paragraphs: [
      'The School is in India. Hosting, email or Firebase may process data on servers outside India. We use those processors only to provide the school website, ERP and app.',
    ],
  },
  {
    heading: 'Changes',
    paragraphs: [
      'We may update this page when the app, website or the law changes. The “Last updated” date at the top of this policy will change. The current version will always be published at https://stlukestura.in/privacy-policy.',
    ],
  },
  {
    heading: 'Contact',
    paragraphs: [
      'St. Luke’s Secondary School, Walbakgre, P.O. Dakopgre, Tura – 794101, West Garo Hills, Meghalaya, India.',
      'Email: admin@stlukestura.in. Office hours: 9:00 a.m. to 2:30 p.m. The Principal may be met during school hours only.',
      'Software host (processor): BaseCode Labs Pvt. Ltd., https://basecodelabs.com.',
    ],
  },
];

export function stLukesPrivacyPolicyParagraphs(): string[] {
  const out: string[] = [];
  for (const section of ST_LUKES_PRIVACY_POLICY_SECTIONS) {
    out.push(`${section.heading}: ${section.paragraphs[0] ?? ''}`.trim());
    out.push(...section.paragraphs.slice(1));
  }
  return out.filter(Boolean);
}
