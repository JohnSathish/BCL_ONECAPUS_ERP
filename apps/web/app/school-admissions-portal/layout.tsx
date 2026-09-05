import type { Metadata } from 'next';
import { Great_Vibes, Libre_Baskerville } from 'next/font/google';
import { SchoolAdmissionsPortalGuard } from '@/components/school-admissions-portal/school-admissions-portal-guard';

const SCHOOL_PORTAL_LOGO_SRC = '/school-admissions/tps-logo.png';

const tpsScript = Great_Vibes({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-tps-script',
});

const tpsSerif = Libre_Baskerville({
  weight: ['400', '700'],
  subsets: ['latin'],
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
