/** White-label campus portal — college-first in-app; product branding on splash/about */
export const COLLEGE_NAME = 'Don Bosco College, Tura';
/**
 * Compile-time fallback only. Prefer remote branding.productName from bootstrap/login context.
 * Do not treat this as the platform identity for other tenants.
 */
export const PRODUCT_NAME = 'Bosco Connect';
export const APP_VERSION = '1.0.21';
export const DEVELOPER_NAME = 'BaseCode Labs Pvt. Ltd.';
export const DEVELOPER_TAGLINE = 'Your Technology Growth Partner';
/** Shown under college name on welcome/login (client-facing) */
export const COLLEGE_PORTAL_SUBTITLE = 'Official ERP Portal';
/** Splash-only product tagline */
export const PORTAL_TAGLINE = 'Smart Education Management Platform';
export const PORTAL_AUDIENCE = 'Students • Faculty • Staff • Administration';
export const SPLASH_AUDIENCE_LINE = 'Student • Faculty • Parent';
export const SPLASH_PRODUCT_TAGLINE = 'Smart Education Management Platform';
export const SPLASH_MOTTO = 'Smart Campus. Better Future.';
export const SPLASH_ROLES = [
  { icon: '🎓', label: 'Student' },
  { icon: '👔', label: 'Faculty' },
  { icon: '👨‍👩‍👧', label: 'Parent' },
  { icon: '💼', label: 'Staff' },
] as const;
export const POWERED_BY_TAGLINE = 'Your Technology Growth Partner';
export const INSTITUTION_WELCOME_MESSAGE = 'Welcome to Don Bosco College, Tura';
export const SIGN_IN_CTA = 'Sign In to Campus Portal';
export const LOGIN_ACCESS_SUBTITLE = 'Access your campus portal';

export const NAAC_ACCREDITATION_LABEL = "NAAC Re-accredited with Grade 'B'";

export const NAAC_ACCREDITATION_SHORT = "Grade 'B'";

export const INSTITUTION_AFFILIATION_LINES = [
  'Affiliated to the North Eastern Hill University (NEHU), Shillong – 793 002',
  'Recognised by the University Grants Commission (UGC), New Delhi',
  "Re-accredited with 'B' Grade by NAAC, Bangalore",
] as const;

export const INSTITUTION_AFFILIATION = INSTITUTION_AFFILIATION_LINES[0];

export const INSTITUTION_BADGES = [
  'Established 1987',
  NAAC_ACCREDITATION_LABEL,
  'Affiliated to NEHU',
  'Meghalaya',
  'UGC Recognized',
] as const;

export const DON_BOSCO_QUOTE = {
  text: 'Education is a matter of the heart.',
  author: 'Don Bosco',
} as const;

export const WELCOME_FEATURE_CARDS = [
  { id: 'admissions', icon: '🎓', label: 'Admissions', tone: '#1e40af' },
  { id: 'academics', icon: '📚', label: 'Academics', tone: '#2563eb' },
  { id: 'attendance', icon: '🕒', label: 'Attendance', tone: '#0d9488' },
  { id: 'finance', icon: '💰', label: 'Finance', tone: '#d97706' },
  { id: 'library', icon: '📖', label: 'Library', tone: '#7c3aed' },
  { id: 'examination', icon: '📝', label: 'Examination', tone: '#be185d' },
] as const;

export const WELCOME_QUICK_ACCESS = [
  {
    id: 'admission',
    icon: '🎓',
    label: 'Track Admission',
    url: 'https://donboscocollege.ac.in/admissions',
  },
  {
    id: 'certificate',
    icon: '✅',
    label: 'Verify Certificate',
    url: 'https://donboscocollege.ac.in',
  },
  { id: 'result', icon: '📋', label: 'Check Result', url: 'https://donboscocollege.ac.in' },
  {
    id: 'prospectus',
    icon: '📄',
    label: 'Download Prospectus',
    url: 'https://donboscocollege.ac.in',
  },
  { id: 'fees', icon: '💳', label: 'Pay Fees', route: '/(auth)/login' as const },
  { id: 'website', icon: '🌐', label: 'College Website', url: 'https://donboscocollege.ac.in' },
] as const;

export const DEFAULT_PORTAL_UPDATES = [
  'Admissions Open for 2026–27',
  'Semester III Internal Assessment Starts',
  'Fee Payment Last Date — 15 July',
  'Placement Drive — Register Now',
] as const;

export const COLLEGE_WEBSITE_URL =
  process.env.EXPO_PUBLIC_COLLEGE_WEBSITE_URL ?? 'https://donboscocollege.ac.in';

export const DEFAULT_PORTAL_STATS = {
  students: 3200,
  faculty: 150,
  departments: 32,
  academicYear: '2026-27',
} as const;

export const SPLASH_ERP_MODULES = [
  'Admissions',
  'Academics',
  'Attendance',
  'Examinations',
  'Finance',
  'Library',
  'Human Resources',
  'Results',
  'AI Analytics',
] as const;

/** Rotating labels on splash — one module at a time, not a static screen title. */
export const SPLASH_ROTATING_MODULES = [
  'Admissions',
  'Academics',
  'Attendance',
  'Finance',
  'Examinations',
  'Library',
] as const;

export const SPLASH_AFFILIATION_LINE = 'Affiliated to NEHU';

export const SPLASH_LOADING_PHASES = [
  'Initializing Secure Services…',
  'Preparing Academic Engine…',
  'Connecting Campus Services…',
  'Launching Dashboard…',
] as const;

export const SPLASH_DID_YOU_KNOW = [
  '📚 Students can download hall tickets from the app.',
  '📅 View your timetable after sign-in.',
  '💰 Pay fees securely online.',
  '📢 Read college notices instantly.',
  '🎓 Check results and exam schedules.',
] as const;

/** One campus scene per weekday (0 = Sunday). Override via EXPO_PUBLIC_SPLASH_CAMPUS_URLS (comma-separated, 7 URLs). */
export const SPLASH_DAILY_CAMPUS_BACKGROUNDS: readonly { label: string; uri: string }[] = (() => {
  const envUrls = process.env.EXPO_PUBLIC_SPLASH_CAMPUS_URLS?.split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  const labels = [
    'College Entrance',
    'Main Building',
    'Library',
    'Science Block',
    'Graduation Day',
    'Chapel',
    'Campus Life',
  ] as const;
  if (envUrls && envUrls.length >= 7) {
    return labels.map((label, i) => ({ label, uri: envUrls[i]! }));
  }
  return labels.map((label) => ({ label, uri: '' }));
})();

export const SPLASH_QUOTES = [
  DON_BOSCO_QUOTE,
  { text: 'Pursuit of Excellence', author: COLLEGE_NAME },
] as const;

export const SPLASH_TRUST_BADGES = [
  'Secure Login',
  '256-bit Encryption',
  'NEP 2020 Ready',
] as const;

export const SPLASH_DURATION_MS = 2800;

export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? 'https://basecodelabs.com/privacy-policy.html';

export const TERMS_URL =
  process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://basecodelabs.com/terms-and-conditions.html';

/** Google Play account-deletion disclosure URL (also linked from Play Console). */
export const ACCOUNT_DELETION_URL =
  process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL ?? 'https://basecodelabs.com/account-deletion.html';

export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'contact@basecodelabs.com';

export const SUPPORT_PHONE = process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? '9566363655';

export const WHATSAPP_SUPPORT_URL =
  process.env.EXPO_PUBLIC_WHATSAPP_SUPPORT_URL ?? 'https://wa.me/919566363655';

export const CAMPUS_LOCATION = 'Tura, Meghalaya';

export const LOGIN_TRUST_BADGES = [
  { icon: '📖', label: 'NEP 2020 Ready' },
  { icon: '⭐', label: NAAC_ACCREDITATION_LABEL },
  { icon: '🏛', label: 'Affiliated to NEHU' },
  { icon: '✅', label: 'UGC Recognized' },
  { icon: '🔒', label: '100% Secure' },
] as const;

export const APP_DISPLAY_NAME = process.env.EXPO_PUBLIC_APP_NAME ?? COLLEGE_NAME;

export const POWERED_BY = 'Powered by BaseCode Labs';
export const BASECODE_WEBSITE_URL = 'https://www.basecodelabs.com';

/** Cards implemented in mobile v1 — hide backend-enabled stubs until built. */
export const MVP_STUDENT_CARDS = [
  'attendance',
  'fees',
  'notifications',
  'timetable',
  'lms',
  'library',
  'examinations',
] as const;

export type MvpStudentCard = (typeof MVP_STUDENT_CARDS)[number];

export function isMvpStudentCard(card: string): card is MvpStudentCard {
  return (MVP_STUDENT_CARDS as readonly string[]).includes(card);
}
