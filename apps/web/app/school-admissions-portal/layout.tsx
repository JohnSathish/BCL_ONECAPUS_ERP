import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { SchoolAdmissionsPortalGuard } from '@/components/school-admissions-portal/school-admissions-portal-guard';

const SCHOOL_PORTAL_LOGO_SRC = '/school-admissions/tps-logo.png';

/** Bundled faces. next/font/google fetches Google at build time and fails in Docker. */
const tpsScript = localFont({
  src: './fonts/great-vibes-latin-400-normal.woff2',
  weight: '400',
  style: 'normal',
  variable: '--font-tps-script',
});

const tpsSerif = localFont({
  src: [
    { path: './fonts/libre-baskerville-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/libre-baskerville-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-tps-serif',
});

export const metadata: Metadata = {
  title: 'Tura Public School · K.G. Admission',
  description: 'Online K.G. admission portal for Tura Public School, Tura.',
  icons: {
    icon: [{ url: SCHOOL_PORTAL_LOGO_SRC, type: 'image/png' }],
    apple: [{ url: SCHOOL_PORTAL_LOGO_SRC, type: 'image/png' }],
    shortcut: SCHOOL_PORTAL_LOGO_SRC,
  },
};

export default function SchoolAdmissionsPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${tpsScript.variable} ${tpsSerif.variable}`}>
      <SchoolAdmissionsPortalGuard>{children}</SchoolAdmissionsPortalGuard>
    </div>
  );
}
