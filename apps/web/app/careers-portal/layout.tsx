import type { Metadata } from 'next';
import {
  CAREERS_DEFAULT_DESCRIPTION,
  CAREERS_PUBLIC_URL,
  careersOpenGraph,
  careersTwitter,
} from '@/lib/careers-seo';

export const metadata: Metadata = {
  title: 'Careers | Don Bosco College Tura — Join Our Academic Community',
  description:
    'Official recruitment portal of Don Bosco College, Tura. Apply for teaching and non-teaching positions at a NAAC accredited institution in Meghalaya.',
  metadataBase: new URL(CAREERS_PUBLIC_URL),
  alternates: { canonical: CAREERS_PUBLIC_URL },
  openGraph: careersOpenGraph({
    title: 'Careers | Don Bosco College Tura',
    description: CAREERS_DEFAULT_DESCRIPTION,
  }),
  twitter: careersTwitter({
    title: 'Careers | Don Bosco College Tura',
    description: CAREERS_DEFAULT_DESCRIPTION,
  }),
  robots: { index: true, follow: true },
};

export default function CareersPortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
