'use client';

import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { PrincipalCommunicationHub } from '@/components/principal-desk/principal-communication-hub';

export default function PrincipalCommsInboxPage() {
  return (
    <PrincipalDeskShell
      title="Communication Hub"
      subtitle="Private Principal mailbox"
      className="max-w-[1600px]"
    >
      <PrincipalCommunicationHub initialFolder="INBOX" />
    </PrincipalDeskShell>
  );
}
