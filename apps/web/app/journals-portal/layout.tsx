import { Inter, Cormorant_Garamond } from 'next/font/google';
import type { Metadata } from 'next';
import { JOURNALS_PUBLIC_URL } from '@/lib/journals-host';
import './journals-portal.css';

const jpDisplay = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jp-display',
  display: 'swap',
});

const jpSans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jp-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Transient — A Journal of Natural Sciences and Allied Subjects',
    template: '%s | Transient Journal',
  },
  description:
    'Peer-reviewed open-access journal of natural sciences and allied subjects published by Don Bosco College, Tura (ISSN 2250-0650).',
  metadataBase: new URL(JOURNALS_PUBLIC_URL),
  openGraph: {
    title: 'Transient Journal',
    description: 'A peer-reviewed open-access journal of natural sciences and allied subjects.',
    type: 'website',
  },
};

export default function JournalsPortalLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${jpDisplay.variable} ${jpSans.variable}`}>{children}</div>;
}
