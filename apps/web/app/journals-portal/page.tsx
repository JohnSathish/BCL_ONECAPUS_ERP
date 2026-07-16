'use client';

import { JournalHomePage } from '@/components/journals-portal/journal-home-page';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';

export default function JournalsPortalHomePage() {
  return (
    <JournalPublicShell>
      <JournalHomePage />
    </JournalPublicShell>
  );
}
