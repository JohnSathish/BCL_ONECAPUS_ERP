import localFont from 'next/font/local';
import type { Metadata } from 'next';
import { JOURNALS_PUBLIC_URL } from '@/lib/journals-host';
import './journals-portal.css';

/** Self-hosted fonts — Google Fonts fetch fails in Docker/VPS builds (ETIMEDOUT). */
const jpDisplay = localFont({
  src: [
    { path: './fonts/source-serif-4-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/source-serif-4-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/source-serif-4-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-jp-display',
  display: 'swap',
});

const jpSans = localFont({
  src: [
    { path: './fonts/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/inter-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/inter-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/inter-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
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
