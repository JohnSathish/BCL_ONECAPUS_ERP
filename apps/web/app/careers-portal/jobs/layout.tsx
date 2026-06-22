import type { Metadata } from 'next';
import {
  CAREERS_DEFAULT_DESCRIPTION,
  CAREERS_PUBLIC_URL,
  careersOpenGraph,
  careersTwitter,
} from '@/lib/careers-seo';

export const metadata: Metadata = {
  title: 'Current Openings | Don Bosco College Careers',
  description: CAREERS_DEFAULT_DESCRIPTION,
  alternates: { canonical: `${CAREERS_PUBLIC_URL}/jobs` },
  openGraph: careersOpenGraph({
    title: 'Current Openings | Don Bosco College Careers',
    description: CAREERS_DEFAULT_DESCRIPTION,
    path: '/jobs',
  }),
  twitter: careersTwitter({
    title: 'Current Openings | Don Bosco College Careers',
    description: CAREERS_DEFAULT_DESCRIPTION,
  }),
};

export default function CareersJobsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
