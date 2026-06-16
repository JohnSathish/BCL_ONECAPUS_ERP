'use client';

import { useQuery } from '@tanstack/react-query';
import { SectionCard } from '@/components/student-profile/student-profile-shell';
import { fetchStaffCommitteeMemberships } from '@/services/governance';

const ROLE_LABELS: Record<string, string> = {
  CHAIRPERSON: 'Chairperson',
  CONVENER: 'Convenor',
  SECRETARY: 'Secretary',
  MEMBER: 'Member',
  COORDINATOR: 'Coordinator',
  EXTERNAL_EXPERT: 'External Expert',
  STUDENT_REPRESENTATIVE: 'Student Representative',
};

export function StaffCommitteeMembershipsSection({ staffId }: { staffId: string }) {
  const q = useQuery({
    queryKey: ['governance', 'staff-memberships', staffId],
    queryFn: () => fetchStaffCommitteeMemberships(staffId),
  });

  const active = (q.data ?? []).filter((m) => m.status === 'ACTIVE');

  return (
    <SectionCard
      title="Committee memberships"
      description="Standing and statutory committee roles linked to this staff profile"
    >
      {active.length ? (
        <ul className="space-y-2">
          {active.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <span className="font-medium">{m.committeeName ?? 'Committee'}</span>
              <span className="text-muted-foreground">
                {ROLE_LABELS[m.role] ?? m.role.replace(/_/g, ' ')}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No active committee memberships.</p>
      )}
    </SectionCard>
  );
}
