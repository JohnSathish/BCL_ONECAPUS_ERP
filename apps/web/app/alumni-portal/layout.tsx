import type { Metadata } from 'next';
import { ALUMNI_PUBLIC_URL } from '@/lib/alumni-host';

export const metadata: Metadata = {
  title: 'Alumni Association | Don Bosco College Tura',
  description:
    'Official Alumni Association portal of Don Bosco College, Tura — membership, events, directory, and giving back.',
  metadataBase: new URL(ALUMNI_PUBLIC_URL),
};

export default function AlumniPortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
