'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { StaffModulePlaceholder } from '@/components/staff-portal/layout/staff-module-placeholder';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchCommunicationCampaigns } from '@/services/communication';

export default function StaffAnnouncementsPage() {
  const enabled = useAuthQueryEnabled();
  const { data } = useQuery({
    queryKey: ['communication', 'campaigns', 'staff'],
    queryFn: () => fetchCommunicationCampaigns('SENT'),
    enabled,
  });

  const announcements = (data ?? []).filter(
    (c) => c.audienceType === 'FACULTY' || c.audienceType === 'DEPARTMENTS',
  );

  if (!announcements.length) {
    return (
      <StaffModulePlaceholder
        title="Announcements"
        heading="Announcements"
        description="College and department announcements for staff."
        actionHref="/staff/notifications"
        actionLabel="View notifications"
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Announcements</h1>
      {announcements.map((c) => (
        <div key={c.id} className="rounded-xl border border-border/80 bg-card p-4">
          <p className="font-medium">{c.subject}</p>
          <p className="mt-1 text-sm text-muted-foreground">{c.name}</p>
          <Link href="/staff/notifications" className="mt-2 inline-block text-sm text-primary">
            Open notifications
          </Link>
        </div>
      ))}
    </div>
  );
}
